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

export interface AIProductionBudgetPlan {
  productionBudget: number;
  isTentpole: boolean;
}

export interface AIDepartmentBudgetPlan {
  setsBudget: number;
  costumesBudget: number;
  stuntsBudget: number;
  makeupBudget: number;
  practicalEffectsBudget: number;
  soundCrewBudget: number;
}

export interface AIFilmCommitmentPlan extends AIDepartmentBudgetPlan {
  departmentBudget: number;
  talentBudgetLimit: number;
  vfxBudgetCeiling: number;
  marketingBudget: number;
  contingencyReserve: number;
  plannedAllIn: number;
  projectedAllIn: number;
  commitmentLimit: number;
  isAffordable: boolean;
  planningError: number;
}

export interface AIPlannedFilmCommitment {
  production: AIProductionBudgetPlan;
  commitment: AIFilmCommitmentPlan;
}

const TENTPOLE_GENRES = new Set(["action", "scifi", "fantasy", "animation"]);
const TENTPOLE_BUDGET_FLOOR = 170_000_000;

/**
 * Choose the physical scale of an AI film. Most projects retain the existing
 * genre ranges. A small share of globally accessible projects can become real
 * tentpoles when the studio can afford the production, departments, talent,
 * and VFX that come with one.
 */
export function selectAIProductionBudget(
  genre: string,
  availableBudget: number,
  profile: AIStudioDecisionProfile,
  rng: RandomSource = Math.random,
  allowTentpole = true,
): AIProductionBudgetPlan {
  const safeAvailableBudget = Math.max(0, availableBudget);
  const affordableTentpoleCeiling = Math.min(300_000_000, safeAvailableBudget * 0.58);
  // Seven major studios should collectively mount a real event slate, not one
  // oversized production every few years. The two-project concurrency guard in
  // routes.ts prevents this high eligible-project rate from becoming unlimited.
  const tentpoleChance = 0.68 + profile.riskTolerance * 0.12;
  const canAttemptTentpole = allowTentpole &&
    TENTPOLE_GENRES.has(genre) &&
    affordableTentpoleCeiling >= TENTPOLE_BUDGET_FLOOR;

  if (canAttemptTentpole && rng() < tentpoleChance) {
    return {
      productionBudget: TENTPOLE_BUDGET_FLOOR +
        rng() * (affordableTentpoleCeiling - TENTPOLE_BUDGET_FLOOR),
      isTentpole: true,
    };
  }

  let productionBudget: number;
  if (genre === "action" || genre === "scifi") {
    productionBudget = 40_000_000 + rng() * 90_000_000;
  } else if (genre === "animation") {
    productionBudget = 30_000_000 + rng() * 90_000_000;
  } else if (genre === "fantasy") {
    productionBudget = 50_000_000 + rng() * 80_000_000;
  } else if (genre === "thriller") {
    productionBudget = 15_000_000 + rng() * 65_000_000;
  } else if (genre === "comedy" || genre === "romance") {
    productionBudget = 8_000_000 + rng() * 52_000_000;
  } else if (genre === "musicals") {
    productionBudget = 25_000_000 + rng() * 95_000_000;
  } else if (genre === "horror") {
    productionBudget = rng() < 0.8
      ? 1_000_000 + rng() * 14_000_000
      : 40_000_000 + rng() * 40_000_000;
  } else if (genre === "drama") {
    productionBudget = 4_000_000 + rng() * 36_000_000;
  } else {
    productionBudget = 8_000_000 + rng() * 52_000_000;
  }

  return { productionBudget, isTentpole: false };
}

/**
 * Estimate the complete commitment before an AI studio greenlights a film.
 * The categories share the production target as their anchor, so an inexpensive
 * film cannot independently choose blockbuster talent, VFX, and marketing.
 * Forecast noise and rare underestimates preserve imperfect studio behavior.
 */
export function planAIFilmCommitment(
  genre: string,
  productionPlan: AIProductionBudgetPlan,
  availableBudget: number,
  profile: AIStudioDecisionProfile,
  rng: RandomSource = Math.random,
): AIFilmCommitmentPlan {
  const productionBudget = Math.max(0, productionPlan.productionBudget);
  const isEffectsGenre = ["action", "scifi", "fantasy", "animation", "horror"]
    .includes(genre.toLowerCase());
  const variation = (minimum: number, maximum: number) =>
    minimum + rng() * (maximum - minimum);

  const setsBudget = productionBudget * variation(0.08, 0.20);
  const costumesBudget = productionBudget * variation(0.02, 0.05);
  const stuntsBudget = productionBudget * (
    ["action", "scifi", "fantasy"].includes(genre.toLowerCase())
      ? variation(0.04, 0.10)
      : variation(0.01, 0.04)
  );
  const makeupBudget = productionBudget * variation(0.01, 0.03);
  const practicalEffectsBudget = productionBudget * variation(0.02, 0.06);
  const soundCrewBudget = productionBudget * variation(0.01, 0.03);
  const departmentBudget = setsBudget + costumesBudget + stuntsBudget +
    makeupBudget + practicalEffectsBudget + soundCrewBudget;

  const talentRatio = productionPlan.isTentpole
    ? 0.18 + profile.riskTolerance * 0.10 - profile.valueDiscipline * 0.035
    : 0.25 + profile.riskTolerance * 0.12 - profile.valueDiscipline * 0.06;
  const talentNoise = variation(0.82, 1.18);
  let talentBudgetLimit = Math.max(
    Math.min(7_000_000, productionBudget * 0.65),
    productionBudget * talentRatio * talentNoise,
  );

  const vfxBaseRatio: Record<string, number> = {
    action: productionPlan.isTentpole ? 0.42 : 0.24,
    scifi: productionPlan.isTentpole ? 0.50 : 0.34,
    fantasy: productionPlan.isTentpole ? 0.46 : 0.30,
    animation: productionPlan.isTentpole ? 0.48 : 0.32,
    horror: productionPlan.isTentpole ? 0.24 : 0.14,
  };
  let vfxBudgetCeiling = isEffectsGenre
    ? productionBudget * (vfxBaseRatio[genre.toLowerCase()] || 0.2) * variation(0.78, 1.22)
    : 0;

  const marketingRatio = productionPlan.isTentpole
    ? 0.58 + profile.riskTolerance * 0.28 + variation(-0.08, 0.12)
    : 0.30 + profile.riskTolerance * 0.32 + variation(-0.08, 0.12);
  let marketingBudget = productionBudget * Math.max(0.2, marketingRatio);

  // A minority of projects make an identifiable bad commitment: an excessive
  // package, effects escalation, or panic-sized campaign. This is deliberately
  // stochastic rather than a permanent rule for any budget tier.
  const mistakeChance = 0.035 + profile.explorationRate * 0.09 +
    profile.riskTolerance * 0.025;
  if (rng() < mistakeChance) {
    const overrun = variation(1.18, 1.55);
    const category = Math.floor(rng() * 3);
    if (category === 0) talentBudgetLimit *= overrun;
    else if (category === 1 && isEffectsGenre) vfxBudgetCeiling *= overrun;
    else marketingBudget *= overrun;
  }

  const plannedAllIn = productionBudget + departmentBudget + talentBudgetLimit +
    vfxBudgetCeiling + marketingBudget;
  const contingencyRate = 0.055 + (1 - profile.valueDiscipline) * 0.075 +
    profile.riskTolerance * 0.025;
  const contingencyReserve = plannedAllIn * contingencyRate;
  const forecastSigma = 0.035 + (1 - profile.decisionQuality) * 0.09;
  let planningError = Math.max(0.78, Math.min(1.18,
    1 + normalNoise(rng) * forecastSigma));
  if (rng() < mistakeChance * 0.45) planningError *= variation(0.78, 0.92);
  const projectedAllIn = (plannedAllIn + contingencyReserve) * planningError;
  const commitmentShare = 0.78 + profile.valueDiscipline * 0.09 +
    profile.riskTolerance * 0.055;
  const commitmentLimit = Math.max(0, availableBudget) * Math.min(0.94, commitmentShare);

  return {
    setsBudget,
    costumesBudget,
    stuntsBudget,
    makeupBudget,
    practicalEffectsBudget,
    soundCrewBudget,
    departmentBudget,
    talentBudgetLimit,
    vfxBudgetCeiling,
    marketingBudget,
    contingencyReserve,
    plannedAllIn,
    projectedAllIn,
    commitmentLimit,
    isAffordable: projectedAllIn <= commitmentLimit,
    planningError,
  };
}

export function selectAffordableAIFilmCommitment(
  genre: string,
  availableBudget: number,
  profile: AIStudioDecisionProfile,
  rng: RandomSource = Math.random,
  allowTentpole = true,
): AIPlannedFilmCommitment {
  let production = selectAIProductionBudget(
    genre,
    availableBudget,
    profile,
    rng,
    allowTentpole,
  );
  let commitment = planAIFilmCommitment(
    genre,
    production,
    availableBudget,
    profile,
    rng,
  );
  if (!commitment.isAffordable && production.isTentpole) {
    production = selectAIProductionBudget(
      genre,
      availableBudget,
      profile,
      rng,
      false,
    );
    commitment = planAIFilmCommitment(
      genre,
      production,
      availableBudget,
      profile,
      rng,
    );
  }

  const minimumProductionByGenre: Record<string, number> = {
    action: 15_000_000,
    scifi: 18_000_000,
    fantasy: 18_000_000,
    animation: 20_000_000,
    thriller: 8_000_000,
    comedy: 4_000_000,
    romance: 4_000_000,
    musicals: 12_000_000,
    horror: 2_000_000,
    drama: 2_000_000,
  };
  const minimumProduction = minimumProductionByGenre[genre.toLowerCase()] || 4_000_000;
  for (let attempt = 0; attempt < 3 && !commitment.isAffordable; attempt += 1) {
    const scale = Math.max(0.35, Math.min(
      0.9,
      commitment.commitmentLimit / Math.max(1, commitment.projectedAllIn) * 0.94,
    ));
    const nextBudget = Math.max(minimumProduction, production.productionBudget * scale);
    if (nextBudget >= production.productionBudget * 0.98) break;
    production = { productionBudget: nextBudget, isTentpole: false };
    commitment = planAIFilmCommitment(
      genre,
      production,
      availableBudget,
      profile,
      rng,
    );
  }
  return { production, commitment };
}

export function createTentpoleDecisionProfile(
  profile: AIStudioDecisionProfile,
): AIStudioDecisionProfile {
  return {
    ...profile,
    decisionQuality: Math.max(0.76, profile.decisionQuality),
    explorationRate: Math.min(0.1, profile.explorationRate),
    riskTolerance: Math.max(0.8, profile.riskTolerance),
    valueDiscipline: Math.min(0.55, profile.valueDiscipline),
  };
}

export function calculateAIMarketingRatio(
  profile: AIStudioDecisionProfile,
  isTentpole: boolean,
  rng: RandomSource = Math.random,
): number {
  if (isTentpole) {
    return 0.72 + profile.riskTolerance * 0.12 + rng() * 0.16;
  }
  return 0.38 + profile.riskTolerance * 0.30 +
    rng() * (0.30 - profile.valueDiscipline * 0.10);
}

export function isAITentpoleBudget(genre: string, productionBudget: number): boolean {
  return TENTPOLE_GENRES.has(genre) && productionBudget >= TENTPOLE_BUDGET_FLOOR;
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
