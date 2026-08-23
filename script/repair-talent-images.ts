import fs from "node:fs";
import path from "node:path";

type TalentType = "actor" | "director" | "writer" | "composer";

type TalentReference = {
  sourcePath: string;
  group: string;
  type: TalentType;
  item: Record<string, any>;
};

const root = process.cwd();
const dataDirectory = path.join(root, "shared", "data");
const cachePath = path.join(root, ".local-data", "talent-image-cache.json");
const reportPath = path.join(root, ".local-data", "talent-image-report.json");
const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
const apply = process.argv.includes("--apply");
const concurrency = 16;

if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is missing from .env");

const cache: Record<string, any> = fs.existsSync(cachePath)
  ? JSON.parse(fs.readFileSync(cachePath, "utf8"))
  : {};
let cacheWrites = 0;

function saveCache(): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(cache)}\n`);
  cacheWrites = 0;
}

async function tmdb(endpoint: string): Promise<any> {
  if (cache[endpoint] !== undefined) return cache[endpoint];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://api.themoviedb.org/3${endpoint}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 429 || response.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`TMDB ${response.status} for ${endpoint}`);
      cache[endpoint] = await response.json();
      cacheWrites++;
      if (cacheWrites >= 50) saveCache();
      return cache[endpoint];
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error(`TMDB unavailable for ${endpoint}`);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

const department: Record<TalentType, string> = {
  actor: "Acting",
  director: "Directing",
  writer: "Writing",
  composer: "Sound",
};

const manualAliases: Record<string, { query: string; tmdbId?: number }> = {
  "writer:thecoenbrothers": { query: "Joel Coen", tmdbId: 1223 },
  "writer:stevezaillian": { query: "Steven Zaillian" },
};

async function resolvePerson(reference: TalentReference): Promise<{ tmdbId: number; profilePath: string | null } | null> {
  const existingId = Number(reference.item.importEvidence?.tmdbId || reference.item.imageTmdbId) || null;
  let details: any | null = null;
  if (existingId) details = await tmdb(`/person/${existingId}?language=en-US`);

  if (!details) {
    const key = `${reference.type}:${normalize(reference.item.name)}`;
    const alias = manualAliases[key];
    if (alias?.tmdbId) {
      details = await tmdb(`/person/${alias.tmdbId}?language=en-US`);
    } else {
      const queryName = alias?.query || reference.item.name;
      const search = await tmdb(`/search/person?query=${encodeURIComponent(queryName)}&include_adult=false&language=en-US&page=1`);
      const exact = (search.results || []).filter((candidate: any) => normalize(candidate.name) === normalize(queryName));
      const candidates = (exact.length ? exact : search.results || []).slice(0, 6);
      const candidateDetails = await Promise.all(candidates.map((candidate: any) => tmdb(`/person/${candidate.id}?language=en-US`)));
      const birthYear = Number(reference.item.birthYear) || null;
      candidateDetails.sort((a: any, b: any) => {
        const score = (person: any) => {
          const personYear = Number(String(person.birthday || "").slice(0, 4)) || null;
          return (normalize(person.name) === normalize(queryName) ? 500 : 0)
            + (person.known_for_department === department[reference.type] ? 250 : 0)
            + (birthYear && personYear === birthYear ? 1_000 : 0)
            + Number(person.popularity || 0);
        };
        return score(b) - score(a);
      });
      details = candidateDetails[0] || null;
    }
  }

  if (!details?.id) return null;
  let profilePath = details.profile_path as string | null;
  if (!profilePath) {
    const images = await tmdb(`/person/${details.id}/images`);
    const profiles = [...(images.profiles || [])].sort((a: any, b: any) => Number(b.vote_count || 0) - Number(a.vote_count || 0));
    profilePath = profiles[0]?.file_path || null;
  }
  return { tmdbId: details.id, profilePath };
}

async function mapConcurrent<T, R>(items: T[], mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function loadReferences(): { documents: Map<string, any>; references: TalentReference[] } {
  const filenames = [
    "talent.json",
    ...fs.readdirSync(dataDirectory).filter(file => /^talent-current-batch-\d+\.json$/i.test(file)).sort(),
  ];
  const documents = new Map<string, any>();
  const references: TalentReference[] = [];
  for (const filename of filenames) {
    const sourcePath = path.join(dataDirectory, filename);
    const document = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    documents.set(sourcePath, document);
    for (const group of ["actors", "actresses", "directors", "writers", "composers"]) {
      const type: TalentType = group === "actors" || group === "actresses" ? "actor" : group.slice(0, -1) as TalentType;
      for (const item of document[group] || []) references.push({ sourcePath, group, type, item });
    }
  }
  return { documents, references };
}

async function urlWorks(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    return response.ok && (response.headers.get("content-type") || "").startsWith("image/");
  } catch {
    return false;
  }
}

async function main() {
  const { documents, references } = loadReferences();
  console.log(`Resolving ${references.length} talent profiles with ${concurrency} workers...`);
  let completed = 0;
  const resolutions = await mapConcurrent(references, async reference => {
    try {
      return await resolvePerson(reference);
    } finally {
      completed++;
      if (completed % 100 === 0 || completed === references.length) console.log(`  ${completed}/${references.length}`);
    }
  });
  saveCache();

  const unresolved: Array<{ name: string; type: string; source: string; tmdbId?: number }> = [];
  const urls: string[] = [];
  for (let index = 0; index < references.length; index++) {
    const reference = references[index];
    const resolution = resolutions[index];
    if (!resolution?.profilePath) {
      unresolved.push({
        name: reference.item.name,
        type: reference.type,
        source: path.basename(reference.sourcePath),
        tmdbId: resolution?.tmdbId,
      });
      continue;
    }
    const imageUrl = `https://image.tmdb.org/t/p/w500${resolution.profilePath}`;
    reference.item.imageUrl = imageUrl;
    reference.item.imageTmdbId = resolution.tmdbId;
    urls.push(imageUrl);
  }

  console.log(`Validating ${urls.length} TMDB image URLs...`);
  const uniqueUrls = [...new Set(urls)];
  const validity = await mapConcurrent(uniqueUrls, urlWorks);
  const deadUrls = uniqueUrls.filter((_, index) => !validity[index]);
  const unresolvedReferences = references.filter((_, index) => !resolutions[index]?.profilePath);
  const fallbackUrls = [...new Set(unresolvedReferences.map(reference => reference.item.imageUrl).filter(Boolean))] as string[];
  const fallbackValidity = await mapConcurrent(fallbackUrls, urlWorks);
  const deadFallbackUrls = fallbackUrls.filter((_, index) => !fallbackValidity[index]);
  const verifiedFallbackUrls = fallbackUrls.filter((_, index) => fallbackValidity[index]);
  const report = {
    total: references.length,
    resolved: urls.length,
    unresolved,
    uniqueUrls: uniqueUrls.length,
    deadUrls,
    verifiedFallbackUrls,
    deadFallbackUrls,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ total: report.total, resolved: report.resolved, unresolved: unresolved.length, deadUrls: deadUrls.length }, null, 2));
  console.log(`Report: ${reportPath}`);

  if (deadUrls.length) {
    console.error("TMDB returned broken image URLs; source files were not changed.");
    process.exitCode = 2;
    return;
  }
  if (!apply) {
    console.log("Dry run passed. Rerun with --apply to write source files.");
    return;
  }
  for (const reference of unresolvedReferences) {
    if (deadFallbackUrls.includes(reference.item.imageUrl)) reference.item.imageUrl = null;
  }
  for (const [sourcePath, document] of documents) fs.writeFileSync(sourcePath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Updated ${documents.size} source files with ${urls.length} verified TMDB profiles.`);
  if (deadFallbackUrls.length) console.warn(`Cleared ${deadFallbackUrls.length} broken fallback image URLs.`);
  if (unresolved.length) {
    console.warn(`${unresolved.length} correct TMDB people have no profile image available; their existing fallback was preserved.`);
  }
}

main().catch(error => {
  saveCache();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
