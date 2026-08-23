import { DEFAULT_SIMULATION_CONFIG } from "./balance-config";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeGenre = (genre: string): string =>
  genre.toLowerCase().replace(/[^a-z]/g, "");

const RELATED_GENRES: Record<string, ReadonlySet<string>> = {
  action: new Set(["scifi", "fantasy", "thriller"]),
  scifi: new Set(["action", "fantasy", "thriller"]),
  fantasy: new Set(["action", "scifi", "animation"]),
  thriller: new Set(["action", "scifi", "horror", "drama"]),
  horror: new Set(["thriller"]),
  animation: new Set(["fantasy", "comedy", "musicals"]),
  comedy: new Set(["animation", "romance", "musicals"]),
  romance: new Set(["comedy", "drama", "musicals"]),
  drama: new Set(["romance", "thriller"]),
  musicals: new Set(["animation", "comedy", "romance"]),
};

function audienceOverlap(leftGenre: string, rightGenre: string): number {
  const left = normalizeGenre(leftGenre);
  const right = normalizeGenre(rightGenre);
  if (left === right) return 1;
  if (RELATED_GENRES[left]?.has(right) || RELATED_GENRES[right]?.has(left)) return 0.78;
  return 0.48;
}

export interface TerritoryAudienceCandidate {
  filmId: string;
  genre: string;
  unconstrainedDemandAdmissions: number;
  eventIntensity: number;
  releaseTiming: number;
  isOpeningWeek: boolean;
}

export interface TerritoryAudienceAllocation {
  filmId: string;
  unconstrainedDemandAdmissions: number;
  allocatedAdmissions: number;
  allocationShare: number;
  demandFulfillment: number;
}

export interface TerritoryAudienceMarketResult {
  territoryCode: string;
  basePoolAdmissions: number;
  expandedPoolAdmissions: number;
  unconstrainedDemandAdmissions: number;
  allocatedAdmissions: number;
  utilization: number;
  allocations: TerritoryAudienceAllocation[];
}

/**
 * Clears one territory's complete weekly audience market before any physical
 * screen or premium-format caps are applied. It never creates demand: if films
 * collectively want fewer tickets than the pool contains, every claim passes
 * through unchanged.
 */
export function allocateTerritoryAudienceMarket(input: {
  territoryCode: string;
  territoryMarketShare: number;
  candidates: readonly TerritoryAudienceCandidate[];
}): TerritoryAudienceMarketResult {
  const candidates = input.candidates.map(candidate => ({
    ...candidate,
    unconstrainedDemandAdmissions: Math.max(0, candidate.unconstrainedDemandAdmissions),
  }));
  const totalDemand = candidates.reduce(
    (sum, candidate) => sum + candidate.unconstrainedDemandAdmissions,
    0,
  );
  const marketScale = Math.max(0.005, input.territoryMarketShare / 0.35);
  const basePool = DEFAULT_SIMULATION_CONFIG.exhibition.weeklyAudienceAdmissionsDomestic *
    marketScale;
  const demandWeightedTiming = totalDemand > 0
    ? candidates.reduce(
      (sum, candidate) => sum +
        candidate.releaseTiming * candidate.unconstrainedDemandAdmissions,
      0,
    ) / totalDemand
    : 52;
  const seasonalExpansion = 0.9 + clamp01(demandWeightedTiming / 100) * 0.2;
  const eventStrengths = candidates
    .map(candidate => clamp01(
      candidate.eventIntensity /
        DEFAULT_SIMULATION_CONFIG.exhibition.eventMaximumIntensity,
    ))
    .sort((left, right) => right - left);
  const eventExpansion = 1 +
    (eventStrengths[0] || 0) * 0.22 +
    (eventStrengths[1] || 0) * 0.08 +
    (eventStrengths[2] || 0) * 0.03;
  // Multiple genuine events can bring infrequent customers into the market,
  // but high film demand cannot expand the territory without limit.
  const demandExpansion = 1 + Math.min(
    0.1,
    Math.max(0, totalDemand / Math.max(1, basePool) - 1) * 0.025,
  );
  const expandedPool = basePool * seasonalExpansion * eventExpansion * demandExpansion;
  const availableAdmissions = Math.min(totalDemand, expandedPool);

  const allocations = new Map<string, number>(
    candidates.map(candidate => [candidate.filmId, 0]),
  );
  if (totalDemand <= expandedPool) {
    for (const candidate of candidates) {
      allocations.set(candidate.filmId, candidate.unconstrainedDemandAdmissions);
    }
  } else {
    let remainingPool = availableAdmissions;
    let eligible = candidates.map(candidate => ({
      candidate,
      remainingDemand: candidate.unconstrainedDemandAdmissions,
    })).filter(item => item.remainingDemand > 0);

    for (let pass = 0; pass < 8 && remainingPool > 0.5 && eligible.length > 0; pass += 1) {
      const weights = eligible.map(({ candidate, remainingDemand }) => {
        const otherDemand = Math.max(0, totalDemand - candidate.unconstrainedDemandAdmissions);
        const overlapExposure = otherDemand > 0
          ? candidates.reduce((sum, rival) => rival.filmId === candidate.filmId
            ? sum
            : sum + rival.unconstrainedDemandAdmissions *
              audienceOverlap(candidate.genre, rival.genre), 0) / otherDemand
          : 0;
        const overlapModifier = 1 - overlapExposure * 0.08;
        // Super-linear choice weight lets a genuinely stronger film resist a
        // crowded market instead of every title receiving the same haircut.
        return Math.max(
          0.0001,
          Math.pow(remainingDemand, 1.18) * overlapModifier,
        );
      });
      const weightTotal = weights.reduce((sum, value) => sum + value, 0);
      let used = 0;
      eligible.forEach((item, index) => {
        const proposed = remainingPool * weights[index] / weightTotal;
        const granted = Math.min(item.remainingDemand, proposed);
        allocations.set(
          item.candidate.filmId,
          (allocations.get(item.candidate.filmId) || 0) + granted,
        );
        item.remainingDemand -= granted;
        used += granted;
      });
      remainingPool = Math.max(0, remainingPool - used);
      eligible = eligible.filter(item => item.remainingDemand > 0.5);
      if (used < 0.5) break;
    }
  }

  const allocatedTotal = Array.from(allocations.values())
    .reduce((sum, value) => sum + value, 0);
  return {
    territoryCode: input.territoryCode,
    basePoolAdmissions: basePool,
    expandedPoolAdmissions: expandedPool,
    unconstrainedDemandAdmissions: totalDemand,
    allocatedAdmissions: allocatedTotal,
    utilization: expandedPool > 0 ? Math.min(1, allocatedTotal / expandedPool) : 0,
    allocations: candidates.map(candidate => {
      const allocated = allocations.get(candidate.filmId) || 0;
      return {
        filmId: candidate.filmId,
        unconstrainedDemandAdmissions: candidate.unconstrainedDemandAdmissions,
        allocatedAdmissions: allocated,
        allocationShare: allocatedTotal > 0 ? allocated / allocatedTotal : 0,
        demandFulfillment: candidate.unconstrainedDemandAdmissions > 0
          ? allocated / candidate.unconstrainedDemandAdmissions
          : 1,
      };
    }),
  };
}

