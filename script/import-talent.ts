import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type TalentType = "actor" | "director" | "writer" | "composer";
type Gender = "male" | "female" | "unknown";

type InputPerson = {
  name: string;
  type: TalentType;
  gender?: Gender;
  tmdbId?: number;
  birthYear?: number;
  nationality?: string;
  awards?: number;
  starRating?: number;
  askingPrice?: number;
  boxOfficeAvg?: number;
  popularity?: number;
  performance?: number;
  experience?: number;
  fame?: number;
  imageUrl?: string;
  skills?: Partial<Record<typeof skillNames[number], number>>;
};

type TmdbCredit = {
  id: number;
  media_type?: string;
  title?: string;
  release_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  job?: string;
  department?: string;
};

type Warning = { level: "warning" | "blocking"; message: string };

type DraftPerson = {
  name: string;
  birthYear: number | null;
  nationality: string;
  gender?: Gender;
  starRating: number;
  askingPrice: number;
  boxOfficeAvg: number;
  awards: number;
  popularity: number;
  performance: number;
  experience: number;
  fame: number;
  genres: string[];
  imageUrl: string | null;
  skills: Record<string, number>;
  genreBaseline: number;
  importEvidence: Record<string, unknown>;
  importWarnings: string[];
};

type DraftFile = {
  generatedAt: string;
  sourceInput: string;
  people: Array<{ input: InputPerson; group: string; talent: DraftPerson; warnings: Warning[] }>;
};

const root = process.cwd();
const dataDirectory = path.join(root, "shared", "data");
const draftDirectory = path.join(dataDirectory, "talent-import-drafts");
const cachePath = path.join(root, ".local-data", "talent-import-cache.json");
const manifestPath = path.join(root, "shared", "content", "content-manifest.json");
const tmdbBase = "https://api.themoviedb.org/3";
const wikidataBase = "https://www.wikidata.org/w/api.php";
const currentYear = new Date().getUTCFullYear();
const skillNames = ["action", "drama", "comedy", "thriller", "horror", "scifi", "animation", "romance", "fantasy", "musicals"] as const;

const genreMap: Record<number, typeof skillNames[number] | null> = {
  28: "action",
  12: null,
  16: "animation",
  35: "comedy",
  80: "thriller",
  99: null,
  18: "drama",
  10751: null,
  14: "fantasy",
  36: "drama",
  27: "horror",
  10402: "musicals",
  9648: "thriller",
  10749: "romance",
  878: "scifi",
  53: "thriller",
  10752: "drama",
  37: "drama",
};

const genreLabels: Record<typeof skillNames[number], string> = {
  action: "Action", drama: "Drama", comedy: "Comedy", thriller: "Thriller",
  horror: "Horror", scifi: "Sci-Fi", animation: "Animation", romance: "Romance",
  fantasy: "Fantasy", musicals: "Musicals",
};

const roleJobs: Record<Exclude<TalentType, "actor">, Set<string>> = {
  director: new Set(["Director"]),
  writer: new Set(["Writer", "Screenplay", "Story", "Teleplay"]),
  composer: new Set(["Original Music Composer", "Music", "Songs"]),
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const round = (value: number) => Math.round(value);
const normalizeName = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

class JsonCache {
  private values: Record<string, { storedAt: number; value: unknown }> = {};
  private dirty = false;

  constructor() {
    if (fs.existsSync(cachePath)) {
      try { this.values = JSON.parse(fs.readFileSync(cachePath, "utf8")); } catch { this.values = {}; }
    }
  }

  get(key: string): unknown | undefined {
    const entry = this.values[key];
    if (!entry || Date.now() - entry.storedAt > 14 * 24 * 60 * 60 * 1000) return undefined;
    return entry.value;
  }

  set(key: string, value: unknown): void {
    this.values[key] = { storedAt: Date.now(), value };
    this.dirty = true;
  }

  save(): void {
    if (!this.dirty) return;
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, `${JSON.stringify(this.values)}\n`);
  }
}

const cache = new JsonCache();

async function cachedFetch(key: string, url: string, headers: Record<string, string> = {}): Promise<any> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { headers: { Accept: "application/json", ...headers } });
    if (response.ok) {
      const value = await response.json();
      cache.set(key, value);
      return value;
    }
    if (response.status === 429 || response.status >= 500) {
      await sleep(Number(response.headers.get("retry-after") || 1) * 1000 * (attempt + 1));
      continue;
    }
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  throw new Error(`Provider did not respond after retries: ${url}`);
}

function tmdbHeaders(): Record<string, string> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is missing. Add it to .env (see .env.example), then run this command again.");
  return { Authorization: `Bearer ${token}` };
}

async function tmdb(endpoint: string): Promise<any> {
  return cachedFetch(`tmdb:${endpoint}`, `${tmdbBase}${endpoint}`, tmdbHeaders());
}

async function wikidata(parameters: Record<string, string>): Promise<any> {
  const query = new URLSearchParams({ origin: "*", format: "json", ...parameters });
  return cachedFetch(`wikidata:${query.toString()}`, `${wikidataBase}?${query}`);
}

function relevantCredits(type: TalentType, credits: any): TmdbCredit[] {
  const source: TmdbCredit[] = type === "actor" ? credits.cast || [] : credits.crew || [];
  const filtered = source.filter(credit => {
    if (credit.media_type !== "movie" || !credit.id || !credit.release_date) return false;
    if (new Date(credit.release_date).getTime() > Date.now()) return false;
    if (type === "actor") return true;
    return roleJobs[type].has(credit.job || "");
  });
  const unique = new Map<number, TmdbCredit>();
  for (const credit of filtered) {
    const existing = unique.get(credit.id);
    if (!existing || (credit.vote_count || 0) > (existing.vote_count || 0)) unique.set(credit.id, credit);
  }
  return [...unique.values()];
}

function adjustedRating(credit: TmdbCredit): number {
  const votes = Math.max(0, credit.vote_count || 0);
  const score = clamp((credit.vote_average || 6) * 10, 0, 100);
  return (score * votes + 60 * 250) / (votes + 250);
}

function weightedQuality(credits: TmdbCredit[]): number {
  const qualified = credits.filter(credit => (credit.vote_count || 0) >= 20).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).slice(0, 30);
  if (!qualified.length) return 55;
  let total = 0;
  let weight = 0;
  for (const credit of qualified) {
    const creditWeight = Math.sqrt(Math.min(20_000, credit.vote_count || 0));
    total += adjustedRating(credit) * creditWeight;
    weight += creditWeight;
  }
  return total / weight;
}

function calculateSkills(credits: TmdbCredit[]): { skills: Record<string, number>; evidence: Record<string, unknown> } {
  const grouped = Object.fromEntries(skillNames.map(name => [name, [] as TmdbCredit[]])) as Record<typeof skillNames[number], TmdbCredit[]>;
  for (const credit of credits) {
    for (const genreId of credit.genre_ids || []) {
      const skill = genreMap[genreId];
      if (skill && (credit.vote_count || 0) >= 20) grouped[skill].push(credit);
    }
  }
  const skills: Record<string, number> = {};
  const evidence: Record<string, unknown> = {};
  for (const skill of skillNames) {
    const genreCredits = [...new Map(grouped[skill].map(credit => [credit.id, credit])).values()]
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    if (!genreCredits.length) {
      skills[skill] = 40;
      continue;
    }
    const weights = genreCredits.map(credit => Math.sqrt(Math.min(10_000, credit.vote_count || 0)));
    const weighted = genreCredits.reduce((sum, credit, index) => sum + adjustedRating(credit) * weights[index], 0) / weights.reduce((sum, value) => sum + value, 0);
    skills[skill] = round(clamp(weighted, 35, 96));
    evidence[skill] = {
      score: skills[skill],
      credits: genreCredits.length,
      examples: genreCredits.slice(0, 3).map(credit => `${credit.title} (${round(adjustedRating(credit))})`),
    };
  }
  return { skills, evidence };
}

function careerMetrics(details: any, credits: TmdbCredit[]) {
  const years = credits.map(credit => Number((credit.release_date || "").slice(0, 4))).filter(Boolean);
  const span = years.length ? Math.max(...years) - Math.min(...years) + 1 : 0;
  const creditCount = credits.length;
  const maxVotes = Math.max(0, ...credits.map(credit => credit.vote_count || 0));
  const tmdbPopularity = Math.max(0, Number(details.popularity) || 0);
  const fame = round(clamp(24 + Math.log10(maxVotes + 10) * 9 + Math.log1p(tmdbPopularity) * 5, 30, 97));
  const popularity = round(clamp(28 + Math.log1p(tmdbPopularity) * 12 + Math.log10(maxVotes + 10) * 4, 35, 98));
  const performance = round(clamp(weightedQuality(credits) + 7, 42, 96));
  const experience = round(clamp(34 + Math.min(34, span * 1.25) + Math.min(28, Math.log2(creditCount + 1) * 5), 35, 98));
  const composite = fame * 0.4 + performance * 0.35 + experience * 0.25;
  const starRating = composite >= 87 ? 5 : composite >= 75 ? 4 : composite >= 61 ? 3 : composite >= 48 ? 2 : 1;
  return { fame, popularity, performance, experience, starRating, span, creditCount, latestYear: years.length ? Math.max(...years) : null };
}

function askingPrice(type: TalentType, fame: number, performance: number): number {
  const typeMultiplier: Record<TalentType, number> = { actor: 1, director: 1.25, writer: 0.38, composer: 0.3 };
  const base = 125_000 + Math.pow(fame / 100, 3.4) * 20_000_000 + Math.max(0, performance - 75) * 90_000;
  return Math.round(base * typeMultiplier[type] / 25_000) * 25_000;
}

async function mapConcurrent<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function resolveTmdbPerson(input: InputPerson): Promise<{ details: any; credits: TmdbCredit[]; warnings: Warning[] }> {
  const warnings: Warning[] = [];
  let id = input.tmdbId;
  if (!id) {
    const search = await tmdb(`/search/person?query=${encodeURIComponent(input.name)}&include_adult=false&language=en-US&page=1`);
    const results = (search.results || []).filter((candidate: any) => normalizeName(candidate.name) === normalizeName(input.name));
    if (!results.length) throw new Error(`No exact TMDB match for ${input.name}. Add tmdbId to the input if the name differs.`);
    const preferredDepartment: Record<TalentType, string> = { actor: "Acting", director: "Directing", writer: "Writing", composer: "Sound" };
    const ranked = [...results].sort((a: any, b: any) => {
      const aFit = a.known_for_department === preferredDepartment[input.type] ? 1000 : 0;
      const bFit = b.known_for_department === preferredDepartment[input.type] ? 1000 : 0;
      return bFit + (b.popularity || 0) - aFit - (a.popularity || 0);
    });
    id = ranked[0].id;
    if (ranked.length > 1 && Math.abs((ranked[0].popularity || 0) - (ranked[1].popularity || 0)) < 5) {
      warnings.push({ level: "blocking", message: `Ambiguous TMDB match (${ranked.length} exact-name results). Add tmdbId to confirm the right person.` });
    }
  }
  const [details, combined] = await Promise.all([
    tmdb(`/person/${id}?language=en-US`),
    tmdb(`/person/${id}/combined_credits?language=en-US`),
  ]);
  const credits = relevantCredits(input.type, combined);
  if (!credits.length) warnings.push({ level: "blocking", message: `TMDB has no released movie credits matching the ${input.type} role.` });
  return { details, credits, warnings };
}

function claimEntityId(claim: any): string | null {
  return claim?.mainsnak?.datavalue?.value?.id || null;
}

async function wikidataEnrichment(name: string, birthYear: number | null): Promise<{ nationality: string | null; awards: number | null; evidence: unknown }> {
  try {
    const search = await wikidata({ action: "wbsearchentities", search: name, language: "en", type: "item", limit: "5" });
    const ids = (search.search || []).map((item: any) => item.id);
    if (!ids.length) return { nationality: null, awards: null, evidence: null };
    const entitiesResponse = await wikidata({ action: "wbgetentities", ids: ids.join("|"), props: "claims|labels", languages: "en" });
    const entities = Object.values(entitiesResponse.entities || {}) as any[];
    const ranked = entities.map(entity => {
      const date = entity.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time;
      const year = date ? Number(String(date).slice(1, 5)) : null;
      return { entity, score: birthYear && year === birthYear ? 100 : normalizeName(entity.labels?.en?.value || "") === normalizeName(name) ? 20 : 0 };
    }).sort((a, b) => b.score - a.score);
    if (!ranked[0] || ranked[0].score < 20) return { nationality: null, awards: null, evidence: null };
    const entity = ranked[0].entity;
    const citizenshipIds = (entity.claims?.P27 || []).map(claimEntityId).filter(Boolean);
    const awardIds = [...new Set((entity.claims?.P166 || []).map(claimEntityId).filter(Boolean))];
    let nationality: string | null = null;
    if (citizenshipIds.length) {
      const labels = await wikidata({ action: "wbgetentities", ids: citizenshipIds.join("|"), props: "labels", languages: "en" });
      const country = labels.entities?.[citizenshipIds[0]]?.labels?.en?.value;
      const demonyms: Record<string, string> = {
        "United States of America": "American", "United Kingdom": "British", Canada: "Canadian", Australia: "Australian",
        France: "French", Germany: "German", Italy: "Italian", Spain: "Spanish", Mexico: "Mexican", India: "Indian",
        Ireland: "Irish", "South Korea": "South Korean", Japan: "Japanese", China: "Chinese", Brazil: "Brazilian",
        Sweden: "Swedish", Denmark: "Danish", Norway: "Norwegian", Poland: "Polish", Netherlands: "Dutch",
      };
      nationality = demonyms[country] || country || null;
    }
    return { nationality, awards: awardIds.length, evidence: { wikidataId: entity.id, citizenshipIds, awardIds } };
  } catch {
    return { nationality: null, awards: null, evidence: null };
  }
}

async function revenueAverage(credits: TmdbCredit[]): Promise<{ value: number; sample: Array<{ title: string; revenue: number }> }> {
  const candidates = [...credits].sort((a, b) => ((b.vote_count || 0) + (b.popularity || 0) * 50) - ((a.vote_count || 0) + (a.popularity || 0) * 50)).slice(0, 10);
  const movies = await mapConcurrent(candidates, 5, credit => tmdb(`/movie/${credit.id}?language=en-US`));
  const sample = movies.filter(movie => Number(movie.revenue) > 0).map(movie => ({ title: movie.title, revenue: Number(movie.revenue) }));
  if (!sample.length) return { value: 0, sample: [] };
  const sorted = sample.map(movie => movie.revenue).sort((a, b) => a - b);
  const trimmed = sorted.length >= 6 ? sorted.slice(1, -1) : sorted;
  return { value: round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length), sample };
}

function genderFromTmdb(value: number): Gender {
  return value === 1 ? "female" : value === 2 ? "male" : "unknown";
}

async function buildDraftPerson(input: InputPerson): Promise<{ talent: DraftPerson; warnings: Warning[] }> {
  const { details, credits, warnings } = await resolveTmdbPerson(input);
  const birthYear = input.birthYear || (details.birthday ? Number(String(details.birthday).slice(0, 4)) : null);
  const [wiki, revenue] = await Promise.all([wikidataEnrichment(details.name, birthYear), revenueAverage(credits)]);
  const metrics = careerMetrics(details, credits);
  const skillResult = calculateSkills(credits);
  const skills = { ...skillResult.skills, ...(input.skills || {}) };
  const gender = input.gender || genderFromTmdb(details.gender);
  const nationality = input.nationality || wiki.nationality || "Unknown";
  const awards = input.awards ?? wiki.awards ?? 0;
  if (!input.nationality && !wiki.nationality) warnings.push({ level: "warning", message: "Nationality could not be confirmed; review the generated value." });
  if (input.awards === undefined && wiki.awards === null) warnings.push({ level: "warning", message: "Awards could not be confirmed; review the generated value." });
  if (metrics.latestYear !== null && metrics.latestYear < currentYear - 6) warnings.push({ level: "warning", message: `No matching released movie credit since ${metrics.latestYear}; confirm this person is still current.` });
  if (revenue.sample.length < 3) warnings.push({ level: "warning", message: `Only ${revenue.sample.length} movies had reported revenue; box-office average has low confidence.` });
  const topGenres = skillNames.filter(skill => skills[skill] > 40).sort((a, b) => skills[b] - skills[a]).slice(0, 3).map(skill => genreLabels[skill]);
  const talent: DraftPerson = {
    name: details.name,
    birthYear,
    nationality,
    ...(input.type === "actor" ? { gender } : {}),
    starRating: input.starRating ?? metrics.starRating,
    askingPrice: input.askingPrice ?? askingPrice(input.type, input.fame ?? metrics.fame, input.performance ?? metrics.performance),
    boxOfficeAvg: input.boxOfficeAvg ?? revenue.value,
    awards,
    popularity: input.popularity ?? metrics.popularity,
    performance: input.performance ?? metrics.performance,
    experience: input.experience ?? metrics.experience,
    fame: input.fame ?? metrics.fame,
    genres: topGenres,
    imageUrl: input.imageUrl ?? (details.profile_path ? `https://image.tmdb.org/t/p/w500${details.profile_path}` : null),
    skills,
    genreBaseline: 40,
    importEvidence: {
      sources: ["TMDB person details", "TMDB combined credits", "TMDB movie details", ...(wiki.evidence ? ["Wikidata"] : [])],
      tmdbId: details.id,
      tmdbPopularity: details.popularity,
      relevantMovieCredits: metrics.creditCount,
      careerSpanYears: metrics.span,
      latestCreditYear: metrics.latestYear,
      revenueSample: revenue.sample,
      genreEvidence: skillResult.evidence,
      wikidata: wiki.evidence,
      method: "Automated draft; weighted ratings are shrunk toward 60 when vote counts are small.",
    },
    importWarnings: warnings.map(warning => warning.message),
  };
  return { talent, warnings };
}

function readInput(inputPath: string): InputPerson[] {
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const people = Array.isArray(parsed) ? parsed : parsed.people;
  if (!Array.isArray(people) || !people.length) throw new Error("Input must contain a non-empty people array.");
  for (const [index, person] of people.entries()) {
    if (!person?.name || !["actor", "director", "writer", "composer"].includes(person.type)) {
      throw new Error(`Invalid person at position ${index + 1}; each person needs name and type.`);
    }
  }
  return people;
}

function groupFor(input: InputPerson, talent: DraftPerson): string {
  if (input.type === "actor") return talent.gender === "female" ? "actresses" : "actors";
  return `${input.type}s`;
}

function existingPeople(): Set<string> {
  const names = new Set<string>();
  const files = ["talent.json", ...fs.readdirSync(dataDirectory).filter(file => /^talent-current-batch-\d+\.json$/i.test(file))];
  for (const file of files) {
    const source = JSON.parse(fs.readFileSync(path.join(dataDirectory, file), "utf8"));
    for (const group of ["actors", "actresses", "directors", "writers", "composers"]) {
      const type = group === "actors" || group === "actresses" ? "actor" : group.slice(0, -1);
      for (const person of source[group] || []) names.add(`${type}:${normalizeName(person.name)}`);
    }
  }
  return names;
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function reportMarkdown(draft: DraftFile): string {
  const blocking = draft.people.flatMap(person => person.warnings).filter(warning => warning.level === "blocking").length;
  const warnings = draft.people.flatMap(person => person.warnings).filter(warning => warning.level === "warning").length;
  const lines = [
    "# Talent import preview", "", `Generated: ${draft.generatedAt}`, `People: ${draft.people.length}`, `Blocking issues: ${blocking}`, `Review warnings: ${warnings}`, "",
    "| Name | Role | Stars | Fame | Performance | Experience | Box-office avg | Issues |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const person of draft.people) {
    const t = person.talent;
    const issues = person.warnings.map(warning => `${warning.level === "blocking" ? "BLOCK" : "Review"}: ${warning.message}`).join("<br>") || "—";
    lines.push(`| ${t.name} | ${person.input.type} | ${t.starRating} | ${t.fame} | ${t.performance} | ${t.experience} | $${Math.round(t.boxOfficeAvg / 1_000_000)}M | ${issues} |`);
  }
  lines.push("", "## What happens next", "", "Correct ambiguous entries by adding `tmdbId` or field overrides to the input. Then run the apply command with this draft JSON file.", "");
  return lines.join("\n");
}

async function preview(inputArgument: string): Promise<string> {
  const inputPath = path.resolve(root, inputArgument);
  const people = readInput(inputPath);
  const known = existingPeople();
  const seen = new Set<string>();
  console.log(`Researching ${people.length} people (up to 8 at once; repeat runs use the local cache)...`);
  let completed = 0;
  const generated = await mapConcurrent(people, 8, async input => {
    const result = await buildDraftPerson(input);
    const key = `${input.type}:${normalizeName(result.talent.name)}`;
    if (known.has(key)) result.warnings.push({ level: "blocking", message: "This person already exists in game content." });
    if (seen.has(key)) result.warnings.push({ level: "blocking", message: "This person appears more than once in this import." });
    seen.add(key);
    completed++;
    if (completed % 10 === 0 || completed === people.length) console.log(`  ${completed}/${people.length} complete`);
    return { input, group: groupFor(input, result.talent), talent: result.talent, warnings: result.warnings };
  });
  cache.save();
  const draft: DraftFile = { generatedAt: new Date().toISOString(), sourceInput: path.relative(root, inputPath), people: generated };
  fs.mkdirSync(draftDirectory, { recursive: true });
  const stem = `${path.basename(inputPath, path.extname(inputPath))}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const draftPath = path.join(draftDirectory, `${stem}.json`);
  const reportPath = path.join(draftDirectory, `${stem}.md`);
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${reportMarkdown(draft)}\n`);
  console.log(`Preview JSON: ${draftPath}`);
  console.log(`Review report: ${reportPath}`);
  return draftPath;
}

function applyDraft(draftArgument: string): void {
  const draftPath = path.resolve(root, draftArgument);
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8")) as DraftFile;
  const blocking = draft.people.flatMap(person => person.warnings).filter(warning => warning.level === "blocking");
  if (blocking.length) throw new Error(`Cannot apply: the preview contains ${blocking.length} blocking issue(s). Fix the input and preview it again.`);
  const batchNumbers = fs.readdirSync(dataDirectory).map(file => /^talent-current-batch-(\d+)\.json$/i.exec(file)).filter(Boolean).map(match => Number(match![1]));
  const nextBatch = Math.max(0, ...batchNumbers) + 1;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const output: any = { contentVersion: Number(manifest.contentVersion) + 1, actors: [], actresses: [], directors: [], writers: [], composers: [] };
  for (const person of draft.people) output[person.group].push(person.talent);
  const outputPath = path.join(dataDirectory, `talent-current-batch-${String(nextBatch).padStart(2, "0")}.json`);
  if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing batch: ${outputPath}`);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  try {
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "content:build"], { cwd: root, stdio: "inherit" });
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:content"], { cwd: root, stdio: "inherit" });
  } catch (error) {
    fs.unlinkSync(outputPath);
    execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "content:build"], { cwd: root, stdio: "inherit" });
    throw error;
  }
  console.log(`Applied ${draft.people.length} people to ${outputPath}. Review it before committing.`);
}

function selfTest(): void {
  const credits: TmdbCredit[] = [
    { id: 1, media_type: "movie", title: "Great Action", release_date: "2024-01-01", genre_ids: [28, 12], vote_average: 9, vote_count: 5000 },
    { id: 2, media_type: "movie", title: "Poor Horror", release_date: "2023-01-01", genre_ids: [27], vote_average: 4, vote_count: 5000 },
    { id: 3, media_type: "movie", title: "Adventure Only", release_date: "2022-01-01", genre_ids: [12], vote_average: 10, vote_count: 5000 },
  ];
  const result = calculateSkills(credits);
  assert(result.skills.action > 80);
  assert(result.skills.horror < 50);
  assert.equal(result.skills.fantasy, 40);
  assert.equal(result.skills.comedy, 40);
  assert(careerMetrics({ popularity: 50 }, credits).performance >= 42);
  assert(askingPrice("actor", 90, 90) > askingPrice("writer", 90, 90));
  console.log("Talent importer self-test passed.");
}

function usage(): never {
  console.log("Usage:");
  console.log("  npm run talent:preview -- shared/data/my-talent-list.json");
  console.log("  npm run talent:apply -- shared/data/talent-import-drafts/<preview>.json");
  console.log("  npm run test:talent-import");
  process.exit(1);
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === "self-test") return selfTest();
  if (command === "preview") {
    if (!argument) usage();
    await preview(argument);
    return;
  }
  if (command === "apply") {
    if (!argument) usage();
    applyDraft(argument);
    return;
  }
  usage();
}

main().catch(error => {
  cache.save();
  console.error(`Talent import failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
