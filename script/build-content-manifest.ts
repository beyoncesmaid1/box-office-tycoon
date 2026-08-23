import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const legacyPath = path.join(root, "shared", "data", "talent.json");
const dataDirectory = path.join(root, "shared", "data");
const outputDirectory = path.join(root, "shared", "content");
const contentPath = path.join(outputDirectory, "base-content.json");
const manifestPath = path.join(outputDirectory, "content-manifest.json");

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function deterministicNumber(seed: string, minimum: number, maximum: number): number {
  const value = crypto.createHash("sha256").update(seed).digest().readUInt32BE(0);
  return minimum + (value % (maximum - minimum + 1));
}

function defaultAskingPrice(type: string, fame: number, id: string): number {
  let minimum = 25_000;
  let maximum = 250_000;
  if (fame >= 85) [minimum, maximum] = [7_500_000, 25_000_000];
  else if (fame >= 70) [minimum, maximum] = [4_000_000, 12_500_000];
  else if (fame >= 55) [minimum, maximum] = [1_500_000, 6_000_000];
  else if (fame >= 40) [minimum, maximum] = [500_000, 2_500_000];
  else if (fame >= 25) [minimum, maximum] = [150_000, 1_000_000];
  let price = deterministicNumber(`${id}:asking-price`, minimum, maximum);
  if (type === "director") price *= 1.5;
  else if (type === "writer") price *= 0.4;
  else if (type === "composer") price *= 0.3;
  return Math.round(price);
}

const sourcePaths = [
  legacyPath,
  ...fs.readdirSync(dataDirectory)
    .filter(file => /^talent-current-batch-\d+\.json$/i.test(file))
    .sort()
    .map(file => path.join(dataDirectory, file)),
];
const sources = sourcePaths.map(sourcePath => JSON.parse(fs.readFileSync(sourcePath, "utf8")));
const contentVersion = Math.max(1, ...sources.map(source => Number(source.contentVersion) || 1));
const groups = [
  ["directors", "director", "unknown"],
  ["actors", "actor", "male"],
  ["actresses", "actor", "female"],
  ["writers", "writer", "unknown"],
  ["composers", "composer", "unknown"],
] as const;
const usedIds = new Set<string>();
const usedPeople = new Set<string>();
const talent: Record<string, unknown>[] = [];

for (const [group, type, defaultGender] of groups) {
  for (const source of sources) for (const rawItem of source[group] || []) {
    const defaults = source.defaults?.[group] || {};
    const item = {
      ...defaults,
      ...rawItem,
      skills: { ...(defaults.skills || {}), ...(rawItem.skills || {}) },
    };
    const personKey = `${type}:${String(item.name).trim().toLowerCase()}`;
    if (usedPeople.has(personKey)) {
      throw new Error(`Duplicate talent entry: ${item.name} (${type})`);
    }
    usedPeople.add(personKey);
    const baseId = `talent-${type}-${slug(item.name)}`;
    let id = baseId;
    if (usedIds.has(id)) {
      id = `${baseId}-${item.birthYear || slug(item.nationality || item.gender || group)}`;
    }
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);

    const genreBySkill: Record<string, string> = {
      skillAction: "action", skillDrama: "drama", skillComedy: "comedy",
      skillThriller: "thriller", skillHorror: "horror", skillScifi: "scifi",
      skillAnimation: "animation", skillRomance: "romance", skillFantasy: "fantasy",
      skillMusicals: "musicals", skillCinematography: "cinematography",
      skillEditing: "editing", skillOrchestral: "orchestral", skillElectronic: "electronic",
    };
    const skill = (field: string) => item[field] ?? item.skills?.[genreBySkill[field]]
      ?? item.genreBaseline ?? deterministicNumber(`${id}:${field}`, 20, 100);
    const fame = item.fame ?? deterministicNumber(`${id}:fame`, 20, 100);
    const skills = {
      skillAction: skill("skillAction"),
      skillDrama: skill("skillDrama"),
      skillComedy: skill("skillComedy"),
      skillThriller: skill("skillThriller"),
      skillHorror: skill("skillHorror"),
      skillScifi: skill("skillScifi"),
      skillAnimation: skill("skillAnimation"),
      skillRomance: skill("skillRomance"),
      skillFantasy: skill("skillFantasy"),
      skillMusicals: skill("skillMusicals"),
      skillCinematography: type === "director" ? skill("skillCinematography") : 50,
      skillEditing: type === "director" ? skill("skillEditing") : 50,
      skillOrchestral: type === "composer" ? skill("skillOrchestral") : 50,
      skillElectronic: type === "composer" ? skill("skillElectronic") : 50,
    };
    talent.push({
      id,
      name: item.name,
      type,
      gender: item.gender || defaultGender,
      nationality: item.nationality || "American",
      starRating: item.starRating ?? 3,
      askingPrice: item.askingPrice ?? defaultAskingPrice(type, fame, id),
      boxOfficeAvg: item.boxOfficeAvg ?? 100_000_000,
      awards: item.awards ?? 0,
      genres: {
        action: skills.skillAction,
        drama: skills.skillDrama,
        comedy: skills.skillComedy,
        thriller: skills.skillThriller,
        horror: skills.skillHorror,
        scifi: skills.skillScifi,
        animation: skills.skillAnimation,
        romance: skills.skillRomance,
        fantasy: skills.skillFantasy,
        musicals: skills.skillMusicals,
      },
      genreTags: Array.isArray(item.genres) ? item.genres : [],
      isActive: true,
      imageUrl: item.imageUrl || null,
      birthYear: item.birthYear || null,
      popularity: item.popularity ?? 50,
      performance: item.performance ?? deterministicNumber(`${id}:performance`, 20, 100),
      experience: item.experience ?? deterministicNumber(`${id}:experience`, 20, 100),
      fame,
      ...skills,
    });
  }
}

fs.mkdirSync(outputDirectory, { recursive: true });
const content = `${JSON.stringify({ schemaVersion: 1, contentVersion, talent }, null, 2)}\n`;
fs.writeFileSync(contentPath, content);
const sha256 = crypto.createHash("sha256").update(content).digest("hex");
const manifest = {
  contentVersion,
  schemaVersion: 1,
  contentFile: "base-content.json",
  sha256,
  talentCount: talent.length,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built content version ${manifest.contentVersion}: ${talent.length} talent (${sha256})`);
