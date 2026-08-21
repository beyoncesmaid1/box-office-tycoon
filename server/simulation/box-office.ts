import {
  DEFAULT_SIMULATION_CONFIG,
  type SimulationBalanceConfig,
  resolveGenre,
} from "./balance-config";
import { normal, systemRng, type RandomSource } from "./rng";
import type { BoxOfficeInput, BoxOfficeResult, TalentLike } from "./types";

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.max(minimum, Math.min(maximum, value));

const finite = (value: number | null | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function talentDraw(talent: TalentLike): number {
  const fame = clamp(finite(talent.fame, 50));
  const popularity = clamp(finite(talent.popularity, fame));
  return fame * 0.7 + popularity * 0.3;
}

function aggregateStarPower(input: BoxOfficeInput): number {
  if (typeof input.starPower === "number") return clamp(input.starPower);
  const draws = (input.stars ?? []).map(talentDraw).sort((left, right) => right - left);
  if (draws.length === 0) return 35;
  // The marquee name matters most; additional stars add less incremental awareness.
  return clamp(draws[0] * 0.62 + (draws[1] ?? draws[0] * 0.5) * 0.25 +
    (draws[2] ?? 0) * 0.13);
}

function defaultInternationalMultiplier(genre: string): number {
  const normalized = genre.toLowerCase().replace(/[\s-]/g, "");
  if (["action", "scifi", "fantasy", "animation"].includes(normalized)) return 1.75;
  if (["comedy", "horror", "romance"].includes(normalized)) return 1.05;
  return 1.3;
}

/**
 * Simulates a complete theatrical run. Opening demand is driven chiefly by
 * awareness and commercial appeal; reception versus expectations drives legs.
 */
export function simulateBoxOffice(
  input: BoxOfficeInput,
  rng: RandomSource = systemRng,
  config: SimulationBalanceConfig = DEFAULT_SIMULATION_CONFIG,
): BoxOfficeResult {
  const balance = config.boxOffice;
  const genre = resolveGenre(input.genre, config);
  const audienceScore100 = clamp(input.audienceScore <= 10
    ? input.audienceScore * 10
    : input.audienceScore);
  const audienceExperience100 = clamp(finite(
    input.audienceExperience,
    audienceScore100,
  ));
  const criticScore = clamp(input.criticScore);
  const concept = clamp(finite(input.conceptCommerciality, genre.baseCommercialAppeal));
  const starPower = aggregateStarPower(input);
  const franchise = clamp(finite(input.franchiseAwareness, 0));
  const timing = clamp(finite(input.releaseTiming, 55));
  const competition = clamp(finite(input.competition, 45));

  const commercialAppeal = clamp(
    genre.baseCommercialAppeal * 0.38 +
    concept * 0.52 +
    Math.min(100, input.productionBudget / genre.viableBudget * 100) * 0.1,
  );
  const organicAwareness = clamp(
    starPower * balance.starPowerWeight +
    concept * balance.conceptWeight +
    franchise * balance.franchiseWeight,
  );
  const positiveMarketing = Math.max(0, input.marketingBudget);
  const marketingSaturation = positiveMarketing /
    (positiveMarketing + balance.marketingHalfSaturation);
  const marketingReach = marketingSaturation * balance.marketingMaximumBoost;
  const effectiveAwareness = clamp(
    organicAwareness + (100 - organicAwareness) * marketingReach,
  );

  const marketCeilingMultiplier = genre.marketCeiling;
  const derivedTheaters = Math.round(
    450 + (balance.maximumTheaters - 450) *
    Math.pow(effectiveAwareness / 100, 0.78) *
    (0.82 + 0.18 * marketCeilingMultiplier),
  );
  const theaterCount = Math.round(clamp(
    finite(input.theaterCount, derivedTheaters),
    100,
    balance.maximumTheaters,
  ));
  const competitionMultiplier = 1 -
    (competition / 100) * balance.competitionPressure;
  const timingMultiplier = 0.82 + timing / 100 * 0.36;
  const capacity = theaterCount * balance.screenCapacityPerTheater *
    competitionMultiplier * timingMultiplier;

  const productionScale = 0.35 + 0.65 *
    (1 - Math.exp(-Math.max(0, input.productionBudget) / genre.viableBudget));
  const demandBeforeCapacity =
    balance.baseDomesticDemand *
    marketCeilingMultiplier *
    Math.pow(effectiveAwareness / 100, 1.18) *
    (0.38 + 0.62 * commercialAppeal / 100) *
    productionScale *
    competitionMultiplier *
    timingMultiplier;
  // Log-normal variance keeps the multiplier positive and avoids upward mean bias.
  const varianceZ = normal(rng);
  const openingVarianceMultiplier = Math.exp(
    balance.openingVarianceSd * varianceZ -
    (balance.openingVarianceSd ** 2) / 2,
  );
  const domesticOpening = Math.max(
    0,
    Math.min(capacity, demandBeforeCapacity) * openingVarianceMultiplier,
  );

  const hype = marketingSaturation * 13 + starPower / 100 * 8 + franchise / 100 * 9;
  const expectedAudienceScore = clamp(
    finite(input.audienceExpectation, balance.expectationBaseline + hype),
  );
  const wordOfMouthDelta = audienceExperience100 - expectedAudienceScore;
  const initialRetention = clamp(
    balance.weeklyDecayBase +
    wordOfMouthDelta * balance.womSensitivity,
    balance.minimumWeeklyRetention,
    balance.maximumWeeklyRetention,
  );
  const internationalMultiplier = Math.max(
    0,
    finite(input.internationalMultiplier, defaultInternationalMultiplier(input.genre)),
  );

  const domesticWeeks: number[] = [];
  let domesticWeek = domesticOpening;
  for (let week = 0; week < balance.maximumRunWeeks; week += 1) {
    domesticWeeks.push(domesticWeek);
    const lateRunStabilization = Math.min(0.08, week * 0.012);
    const retention = clamp(
      initialRetention + lateRunStabilization,
      balance.minimumWeeklyRetention,
      balance.maximumWeeklyRetention,
    );
    domesticWeek *= retention;
    if (week >= 3 && domesticWeek * (1 + internationalMultiplier) < balance.closeBelowGross) {
      break;
    }
  }

  const domesticGross = domesticWeeks.reduce((total, gross) => total + gross, 0);
  const internationalGross = domesticGross * internationalMultiplier;
  const weeklyGrosses = domesticWeeks.map((gross) =>
    Math.round(gross * (1 + internationalMultiplier)));
  const totalGross = domesticGross + internationalGross;
  const openingWeekend = weeklyGrosses[0] ?? 0;

  return {
    openingWeekend,
    totalGross: Math.round(totalGross),
    domesticGross: Math.round(domesticGross),
    internationalGross: Math.round(internationalGross),
    weeklyGrosses,
    theaterCount,
    legsMultiplier: openingWeekend > 0
      ? Math.round((totalGross / openingWeekend) * 100) / 100
      : 0,
    breakdown: {
      commercialAppeal: Math.round(commercialAppeal * 10) / 10,
      starPower: Math.round(starPower * 10) / 10,
      organicAwareness: Math.round(organicAwareness * 10) / 10,
      marketingSaturation: Math.round(marketingSaturation * 1000) / 1000,
      effectiveAwareness: Math.round(effectiveAwareness * 10) / 10,
      releaseTiming: timing,
      competition,
      capacity: Math.round(capacity),
      demandBeforeCapacity: Math.round(demandBeforeCapacity),
      openingVarianceMultiplier: Math.round(openingVarianceMultiplier * 1000) / 1000,
      expectedAudienceScore: Math.round(expectedAudienceScore * 10) / 10,
      wordOfMouthDelta: Math.round(wordOfMouthDelta * 10) / 10,
      initialRetention: Math.round(initialRetention * 1000) / 1000,
      marketCeilingMultiplier,
    },
  };
}
