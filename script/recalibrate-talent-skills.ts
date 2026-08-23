import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const batchPath = path.join(root, "shared", "data", "talent-current-batch-01.json");
const batch = JSON.parse(await fs.readFile(batchPath, "utf8"));
const asOf = "2026-08-23";
const headers = { "User-Agent": "Mozilla/5.0 BoxOfficeTycoonTalentResearch/1.0" };

const groupInfo = {
  actors: { type: "actor", role: /actor|voice/i },
  actresses: { type: "actor", role: /actor|voice/i },
  directors: { type: "director", role: /director/i },
  writers: { type: "writer", role: /screenwriter|writer/i },
  composers: { type: "composer", role: /original music|music|composer/i },
} as const;

const skillNames = [
  "action", "drama", "comedy", "thriller", "horror", "scifi",
  "animation", "romance", "fantasy", "musicals",
] as const;

const slugOverrides: Record<string, string> = {
  "Andrew Scott": "andrew_scott_2",
  "Aunjanue Ellis-Taylor": "aunjanue_ellis",
  "Bill Skarsgård": "771821133",
  "Celine Song": "celine_song_2",
  "Da'Vine Joy Randolph": "davine_joy_randolph",
  "Gael García Bernal": "gael_garcia_bernal",
  "Geneva Robertson-Dworet": "geneva_robertson_dworet_2",
  "Gina Prince-Bythewood": "gina_princebythewood",
  "Lee Byung-hun": "byung_hun_lee",
  "Michael Green": "michael-green",
  "Daniel Pemberton": "daniel_pemberton_2",
  "Yahya Abdul-Mateen II": "yahya_abdul_mateen_ii",
};

const manualCredits: Record<string, any[]> = {
  "Zach Baylin": [
    { title: "The Order", year: 2024, score: 93, genres: ["action", "drama", "thriller"] },
    { title: "The Crow", year: 2024, score: 22, genres: ["action", "horror", "fantasy"] },
    { title: "Bob Marley: One Love", year: 2024, score: 43, genres: ["drama", "musicals"] },
    { title: "Gran Turismo: Based on a True Story", year: 2023, score: 65, genres: ["action", "drama"] },
    { title: "Creed III", year: 2023, score: 89, genres: ["drama"] },
    { title: "King Richard", year: 2021, score: 90, genres: ["drama"] },
  ],
};

function slug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function decodeHtml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function fetchText(url: string, attempt = 0): Promise<string> {
  const response = await fetch(url, { headers });
  if ((response.status === 403 || response.status === 429 || response.status >= 500) && attempt < 6) {
    await new Promise(resolve => setTimeout(resolve, 1_500 * (attempt + 1)));
    return fetchText(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function parseFilmographyModule(html: string): any {
  const match = html.match(/<script data-json="filmographyModule" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  return JSON.parse(decodeHtml(match[1].trim())).paginatedData || null;
}

function parseFilmographyCards(html: string): any[] {
  return [...html.matchAll(/<filmography-card\s+media-url="([^"]+)"[\s\S]*?<\/filmography-card>/g)]
    .map(match => {
      const block = match[0];
      const value = (slot: string) => decodeHtml(
        block.match(new RegExp(`<rt-text slot="${slot}"[^>]*>([\\s\\S]*?)<\\/rt-text>`))?.[1]
          ?.replace(/<[^>]+>/g, "").trim() || "",
      );
      const scoreText = value("critics-score").replace("%", "");
      return {
        titleUrl: match[1],
        title: value("title"),
        celebCredits: value("credits"),
        yearsFeatured: value("years-featured"),
        tomatometerScore: scoreText ? { score: scoreText } : undefined,
      };
    });
}

async function getFilmography(html: string): Promise<any[]> {
  const module = parseFilmographyModule(html);
  if (!module) return parseFilmographyCards(html);
  if (!module.api) return module.media?.length ? module.media : parseFilmographyCards(html);
  try {
    const apiResponse = JSON.parse(await fetchText(`https://www.rottentomatoes.com${module.api}`));
    return apiResponse.media || module.media || [];
  } catch {
    return module.media?.length ? module.media : parseFilmographyCards(html);
  }
}

function parseGenres(html: string): string[] {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const match of scripts) {
    try {
      const value = JSON.parse(decodeHtml(match[1].trim()));
      const candidates = Array.isArray(value) ? value : value["@graph"] || [value];
      const movie = candidates.find((item: any) => item?.["@type"] === "Movie"
        || (Array.isArray(item?.["@type"]) && item["@type"].includes("Movie")));
      if (movie) return Array.isArray(movie.genre) ? movie.genre : movie.genre ? [movie.genre] : [];
    } catch { /* Ignore unrelated structured-data blocks. */ }
  }
  return [];
}

function gameGenres(genres: string[]): Set<string> {
  const joined = genres.join(" ").toLowerCase();
  const result = new Set<string>();
  if (/action|adventure/.test(joined)) result.add("action");
  if (/drama|biography|history|war|western/.test(joined)) result.add("drama");
  if (/comedy/.test(joined)) result.add("comedy");
  if (/mystery|thriller|crime/.test(joined)) result.add("thriller");
  if (/horror/.test(joined)) result.add("horror");
  if (/sci-fi|science fiction/.test(joined)) result.add("scifi");
  if (/animation|kids|family/.test(joined)) result.add("animation");
  if (/romance/.test(joined)) result.add("romance");
  if (/fantasy/.test(joined)) result.add("fantasy");
  if (/musical|music/.test(joined)) result.add("musicals");
  return result;
}

function evidenceScore(credits: any[]): number {
  const scores = credits.map(credit => credit.score).sort((a, b) => b - a);
  if (scores.length === 1) return Math.round(Math.max(25, Math.min(95, scores[0])));
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const best = scores.slice(0, Math.min(3, scores.length));
  const bestAverage = best.reduce((sum, score) => sum + score, 0) / best.length;
  return Math.round(Math.max(20, Math.min(95, average * 0.65 + bestAverage * 0.35)));
}

async function mapLimited<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const people = Object.entries(groupInfo).flatMap(([group, info]) =>
  (batch[group] || []).map((person: any) => ({ group, info, person })));
const movieCache = new Map<string, Promise<string[]>>();
const failures: string[] = [];

async function getMovieGenres(titleUrl: string): Promise<string[]> {
  if (!movieCache.has(titleUrl)) {
    movieCache.set(titleUrl, fetchText(`https://www.rottentomatoes.com${titleUrl}`).then(parseGenres));
  }
  return movieCache.get(titleUrl)!;
}

async function processPerson(entry: typeof people[number]) {
  const { person, info } = entry;
  const personSlug = slugOverrides[person.name] || slug(person.name);
  let html: string;
  try {
    html = await fetchText(`https://www.rottentomatoes.com/celebrity/${personSlug}`);
  } catch (error) {
    failures.push(`${person.name}: ${error}`);
    return;
  }
  const filmography = (await getFilmography(html))
    .filter((credit: any) => info.role.test(String(credit.celebCredits || "")))
    .filter((credit: any) => Number.isFinite(Number(credit.tomatometerScore?.score)))
    .filter((credit: any) => Number(credit.yearsFeatured || 0) <= 2026)
    .slice(0, 18);

  const credits = filmography.length
    ? await mapLimited(filmography, 3, async (credit: any) => ({
      title: credit.title,
      year: Number(credit.yearsFeatured || 0),
      score: Number(credit.tomatometerScore.score),
      reviews: Number(credit.tomatometerScore.ratingCount || 0),
      genres: [...gameGenres(await getMovieGenres(credit.titleUrl))],
    }))
    : manualCredits[person.name] || [];
  if (!credits.length) {
    failures.push(`${person.name}: no relevant scored film credits found at ${personSlug}`);
    return;
  }

  const skills: Record<string, number> = {};
  const genreEvidence: Record<string, any> = {};
  for (const skill of skillNames) {
    const matching = credits.filter(credit => credit.genres.includes(skill));
    skills[skill] = matching.length ? evidenceScore(matching) : 40;
    if (matching.length) {
      genreEvidence[skill] = {
        score: skills[skill],
        credits: matching.length,
        examples: matching.slice(0, 3).map(credit => `${credit.title} (${credit.score})`),
      };
    }
  }
  person.genreBaseline = 40;
  person.skills = {
    ...skills,
    ...(person.skills?.cinematography == null ? {} : { cinematography: person.skills.cinematography }),
    ...(person.skills?.editing == null ? {} : { editing: person.skills.editing }),
    ...(person.skills?.orchestral == null ? {} : { orchestral: person.skills.orchestral }),
    ...(person.skills?.electronic == null ? {} : { electronic: person.skills.electronic }),
  };
  person.skillEvidence = {
    source: "Rotten Tomatoes Tomatometer",
    asOf,
    sampledCredits: credits.length,
    genres: genreEvidence,
  };
  console.log(`${person.name}: ${credits.length} scored credits`);
}

for (let index = 0; index < people.length; index += 2) {
  await Promise.all(people.slice(index, index + 2).map(processPerson));
}

if (failures.length) {
  throw new Error(`Talent research incomplete:\n${failures.join("\n")}`);
}

batch.skillRatingMethod = {
  source: "Rotten Tomatoes Tomatometer filmography and movie genres",
  asOf,
  rules: "Relevant credited films only; one-film genre uses that score; repeated work blends the full average with the three best scores; 40 means no sampled evidence.",
};
await fs.writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
