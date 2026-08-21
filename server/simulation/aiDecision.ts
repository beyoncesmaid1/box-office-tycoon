export type RandomSource = () => number;

export interface AITalentCandidate {
  id: string;
  type: string;
  askingPrice?: number | null;
  starRating?: number | null;
  boxOfficeAvg?: number | null;
  awards?: number | null;
  popularity?: number | null;
  performance?: number | null;
  experience?: number | null;
  fame?: number | null;
  genres?: unknown;
  isActive?: boolean | null;
  currentFilmId?: string | null;
  busyUntilWeek?: number | null;
  busyUntilYear?: number | null;
  [key: string]: unknown;
}

export interface AIStudioDecisionProfile {
  decisionQuality: number;
  explorationRate: number;
  riskTolerance: number;
  valueDiscipline: number;
  preferredGenres: string[];
}

export interface TalentSelectionContext {
  genre: string;
  role: "director" | "writer" | "actor" | "composer";
  currentWeek: number;
  currentYear: number;
  remainingBudget: number;
  profile: AIStudioDecisionProfile;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const stat = (value: unknown, fallback = 50) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function normalNoise(rng: RandomSource): number {
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function genreSkillKey(genre: string): string {
  return `skill${genre.charAt(0).toUpperCase()}${genre.slice(1).toLowerCase()}`;
}

function listedGenreFit(candidate: AITalentCandidate, genre: string): number {
  const genres = candidate.genres;
  if (Array.isArray(genres)) {
    return genres.some(value => String(value).toLowerCase() === genre.toLowerCase()) ? 75 : 40;
  }
  if (genres && typeof genres === "object") {
    const entry = Object.entries(genres as Record<string, unknown>)
      .find(([key]) => key.toLowerCase() === genre.toLowerCase());
    if (entry) return stat(entry[1], 65);
  }
  return 50;
}

export function getCandidateGenreFit(candidate: AITalentCandidate, genre: string): number {
  const skill = stat(candidate[genreSkillKey(genre)], NaN);
  return Number.isFinite(skill) ? skill : listedGenreFit(candidate, genre);
}

export function isTalentAvailable(
  candidate: AITalentCandidate,
  currentWeek: number,
  currentYear: number,
): boolean {
  if (candidate.isActive === false || candidate.currentFilmId) return false;
  if (!candidate.busyUntilWeek || !candidate.busyUntilYear) return true;
  return candidate.busyUntilYear < currentYear ||
    (candidate.busyUntilYear === currentYear && candidate.busyUntilWeek <= currentWeek);
}

export function createStudioDecisionProfile(
  studio: { id?: string; name?: string; prestigeLevel?: number | null; strategy?: string | null },
): AIStudioDecisionProfile {
  const seedText = `${studio.id || ""}:${studio.name || ""}`;
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const trait = (shift: number) => ((hash >>> shift) & 255) / 255;
  const prestige = Math.max(1, stat(studio.prestigeLevel, 1));
  const strategy = studio.strategy && studio.strategy !== "balanced" ? [studio.strategy] : [];

  return {
    decisionQuality: clamp01(0.38 + prestige * 0.07 + trait(0) * 0.12),
    explorationRate: clamp01(0.32 - prestige * 0.025 + trait(8) * 0.12),
    riskTolerance: clamp01(0.25 + trait(16) * 0.6),
    valueDiscipline: clamp01(0.35 + trait(24) * 0.55),
    preferredGenres: strategy,
  };
}

export function scoreTalentCandidate(
  candidate: AITalentCandidate,
  context: TalentSelectionContext,
): number {
  const performance = stat(candidate.performance) / 100;
  const experience = stat(candidate.experience) / 100;
  const fame = stat(candidate.fame) / 100;
  const popularity = stat(candidate.popularity) / 100;
  const genreFit = getCandidateGenreFit(candidate, context.genre) / 100;
  const awards = Math.min(1, stat(candidate.awards, 0) / 8);
  const history = Math.min(1, Math.log1p(stat(candidate.boxOfficeAvg, 0)) / Math.log(1_000_000_001));
  const price = Math.max(0, stat(candidate.askingPrice, 0));
  const budgetShare = price / Math.max(1, context.remainingBudget);
  const pricePenalty = Math.min(1.5, budgetShare * (1.1 + context.profile.valueDiscipline));

  let creative = 0;
  let commercial = 0;
  switch (context.role) {
    case "director":
      creative = performance * 0.32 + experience * 0.24 + genreFit * 0.32 + awards * 0.12;
      commercial = fame * 0.55 + history * 0.30 + popularity * 0.15;
      break;
    case "writer":
      creative = performance * 0.38 + experience * 0.27 + genreFit * 0.35;
      commercial = history * 0.55 + awards * 0.30 + fame * 0.15;
      break;
    case "composer":
      creative = performance * 0.38 + experience * 0.22 + genreFit * 0.30 + awards * 0.10;
      commercial = fame * 0.55 + popularity * 0.25 + history * 0.20;
      break;
    default:
      creative = performance * 0.42 + genreFit * 0.38 + experience * 0.20;
      commercial = fame * 0.45 + popularity * 0.25 + history * 0.25 + awards * 0.05;
  }

  const commercialWeight = 0.18 + context.profile.riskTolerance * 0.25;
  return creative * (1 - commercialWeight) + commercial * commercialWeight - pricePenalty * 0.28;
}

export function selectTalentCandidate<T extends AITalentCandidate>(
  candidates: T[],
  context: TalentSelectionContext,
  rng: RandomSource = Math.random,
): T | undefined {
  const eligible = candidates.filter(candidate =>
    isTalentAvailable(candidate, context.currentWeek, context.currentYear) &&
    stat(candidate.askingPrice, 0) <= context.remainingBudget
  );
  if (eligible.length === 0) return undefined;

  if (rng() < context.profile.explorationRate) {
    return eligible[Math.floor(rng() * eligible.length)];
  }

  const observationSigma = 0.32 * (1 - context.profile.decisionQuality) + 0.04;
  const temperature = 0.08 + (1 - context.profile.decisionQuality) * 0.22;
  const observations = eligible.map(candidate =>
    scoreTalentCandidate(candidate, context) + normalNoise(rng) * observationSigma
  );
  const peak = Math.max(...observations);
  const weights = observations.map(value => Math.exp((value - peak) / temperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let roll = rng() * total;
  for (let i = 0; i < eligible.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

export interface AIVFXCandidate {
  id: string;
  cost: number;
  quality: number;
  specialization: string[];
}

export function selectVFXStudio<T extends AIVFXCandidate>(
  candidates: T[],
  genre: string,
  availableBudget: number,
  profile: AIStudioDecisionProfile,
  rng: RandomSource = Math.random,
): T | undefined {
  const eligible = candidates.filter(candidate => candidate.cost <= availableBudget);
  if (eligible.length === 0) return undefined;
  if (rng() < profile.explorationRate) return eligible[Math.floor(rng() * eligible.length)];

  const scored = eligible.map(candidate => {
    const fit = candidate.specialization.some(value => value.toLowerCase() === genre.toLowerCase()) ? 1 : 0.25;
    const quality = candidate.quality / 100;
    const efficiency = quality / Math.max(0.15, candidate.cost / Math.max(1, availableBudget));
    const utility = quality * 0.5 + fit * 0.3 + Math.min(1, efficiency) * 0.2;
    return { candidate, observed: utility + normalNoise(rng) * (0.24 * (1 - profile.decisionQuality) + 0.03) };
  });
  scored.sort((a, b) => b.observed - a.observed);
  return scored[0].candidate;
}

export function selectAIGenre(
  genres: string[],
  profile: AIStudioDecisionProfile,
  recentGenreReturns: Partial<Record<string, number>> = {},
  rng: RandomSource = Math.random,
): string {
  const utilities = genres.map(genre => {
    const preference = profile.preferredGenres.includes(genre) ? 0.35 : 0;
    const history = Math.max(-0.25, Math.min(0.25, recentGenreReturns[genre] || 0));
    return preference + history * (0.35 + profile.decisionQuality * 0.35) +
      normalNoise(rng) * (0.20 + (1 - profile.decisionQuality) * 0.25);
  });
  const peak = Math.max(...utilities);
  const temperature = 0.30 + (1 - profile.decisionQuality) * 0.35;
  const weights = utilities.map(value => Math.exp((value - peak) / temperature));
  let roll = rng() * weights.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < genres.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return genres[i];
  }
  return genres[genres.length - 1];
}
