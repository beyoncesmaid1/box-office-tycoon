import type {
  PremiumAllocation,
  PremiumAllocationCandidate,
  PremiumBookingLike,
  PremiumFormat,
  PremiumSuitabilityInput,
  PremiumSuitabilityResult,
  TerritoryWeekInput,
  TerritoryWeekResult,
} from "./types";
import { DEFAULT_SIMULATION_CONFIG } from "./balance-config";

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.max(minimum, Math.min(maximum, value));
const BALANCE = DEFAULT_SIMULATION_CONFIG.exhibition;

const normalizedGenre = (genre: string): string =>
  genre.toLowerCase().replace(/[\s-]/g, "");

const IMAX_GENRE_FIT: Record<string, number> = {
  action: 95,
  scifi: 100,
  fantasy: 96,
  animation: 86,
  thriller: 62,
  horror: 52,
  musicals: 48,
  drama: 36,
  comedy: 28,
  romance: 28,
};

const DOLBY_GENRE_FIT: Record<string, number> = {
  horror: 96,
  action: 92,
  scifi: 90,
  musicals: 90,
  fantasy: 84,
  thriller: 82,
  animation: 78,
  drama: 58,
  romance: 52,
  comedy: 44,
};

const GLOBAL_ACCESSIBILITY: Record<string, number> = {
  action: 96,
  scifi: 100,
  fantasy: 96,
  animation: 97,
  thriller: 72,
  musicals: 68,
  horror: 62,
  drama: 55,
  romance: 54,
  comedy: 46,
};

/** Existing genre is the only reliable signal for how broadly a film travels. */
export function getGenreGlobalAccessibility(genre: string): number {
  return GLOBAL_ACCESSIBILITY[normalizedGenre(genre)] ?? 60;
}

export function calculatePremiumSuitability(
  input: PremiumSuitabilityInput,
): PremiumSuitabilityResult {
  const genre = normalizedGenre(input.genre);
  const productionScale = clamp(
    100 * (1 - Math.exp(-Math.max(0, input.productionBudget) /
      Math.max(1, input.viableBudget * BALANCE.productionScaleHalfSaturation))),
  );
  const visualAmbition = clamp(input.cinematographyQuality ?? 55);
  const vfxScale = clamp(input.vfxQuality ?? productionScale * 0.55);
  const soundAmbition = clamp(
    100 * (1 - Math.exp(-Math.max(0, input.soundBudget ?? 0) /
      Math.max(2_000_000, input.viableBudget * 0.055))),
  );
  const composer = input.composer;
  const musicStrength = composer
    ? clamp(
      Number(composer.performance ?? 50) * 0.45 +
      Number(composer.skillOrchestral ?? 50) * 0.3 +
      Number(composer.skillElectronic ?? 50) * 0.25,
    )
    : 42;
  const imaxGenreFit = IMAX_GENRE_FIT[genre] ?? 45;
  const dolbyGenreFit = DOLBY_GENRE_FIT[genre] ?? 55;
  const positioning = clamp(input.largeFormatPositioning ?? 45);

  const imaxSuitability = clamp(
    productionScale * 0.28 +
    visualAmbition * 0.22 +
    vfxScale * 0.2 +
    imaxGenreFit * 0.22 +
    positioning * 0.08,
  );
  const dolbySuitability = clamp(
    soundAmbition * 0.28 +
    musicStrength * 0.18 +
    visualAmbition * 0.16 +
    productionScale * 0.12 +
    dolbyGenreFit * 0.26,
  );

  return {
    imaxSuitability,
    dolbySuitability,
    breakdown: {
      productionScale,
      visualAmbition,
      vfxScale,
      soundAmbition,
      musicStrength,
      imaxGenreFit,
      dolbyGenreFit,
    },
  };
}

function accessWeight(accessLevel: PremiumAllocationCandidate["accessLevel"]): number {
  if (accessLevel === "priority") return 1.35;
  if (accessLevel === "exclusive") return 1.5;
  return 1;
}

/**
 * Shared finite-capacity allocator. Call once for IMAX and once for Dolby.
 * Active bookings must already be filtered to the territory/week being cleared.
 */
export function allocatePremiumFormat(input: {
  format: PremiumFormat;
  territorySupply: number;
  candidates: readonly PremiumAllocationCandidate[];
  activeBookings?: readonly PremiumBookingLike[];
}): PremiumAllocation[] {
  const supply = Math.max(0, input.territorySupply);
  const exclusive = (input.activeBookings ?? []).find(
    booking => booking.format === input.format &&
      booking.accessLevel === "exclusive" &&
      booking.status !== "declined" &&
      booking.status !== "expired",
  );
  const exclusiveShare = input.format === "imax" ? 0.9 : 0.7;
  const reservedPool = exclusive ? supply * exclusiveShare : 0;
  const allocations = new Map<string, PremiumAllocation>();

  for (const candidate of input.candidates) {
    allocations.set(candidate.filmId, {
      filmId: candidate.filmId,
      allocatedAdmissions: 0,
      reservedAdmissions: 0,
      utilizedAdmissions: 0,
    });
  }

  if (exclusive) {
    const candidate = input.candidates.find(item => item.filmId === exclusive.filmId);
    const allocation = allocations.get(exclusive.filmId);
    if (candidate && allocation) {
      const utilized = Math.min(reservedPool, Math.max(0, candidate.formatDemand));
      allocation.allocatedAdmissions += utilized;
      allocation.reservedAdmissions = reservedPool;
      allocation.utilizedAdmissions += utilized;
    }
  }

  let openSupply = Math.max(0, supply - reservedPool);
  let eligible = input.candidates
    .map(candidate => ({
      candidate,
      remainingDemand: Math.max(
        0,
        candidate.formatDemand -
        (allocations.get(candidate.filmId)?.allocatedAdmissions ?? 0),
      ),
    }))
    .filter(item => item.remainingDemand > 0);

  // Iterative capped proportional allocation redistributes only open capacity.
  for (let pass = 0; pass < 4 && openSupply > 0.5 && eligible.length > 0; pass += 1) {
    const weights = eligible.map(({ candidate, remainingDemand }) => {
      const suitability = Math.pow(clamp(candidate.suitability) / 100, 1.35);
      const freshness = candidate.isOpeningWeek ? 1.16 : 0.92;
      const occupancy = clamp(candidate.recentOccupancy ?? 65, 20, 100) / 100;
      return Math.max(0.0001,
        remainingDemand * suitability * accessWeight(candidate.accessLevel) *
        freshness * (0.75 + occupancy * 0.25));
    });
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    let usedThisPass = 0;

    eligible.forEach((item, index) => {
      const proposed = openSupply * (weights[index] / weightTotal);
      const granted = Math.min(item.remainingDemand, proposed);
      const allocation = allocations.get(item.candidate.filmId)!;
      allocation.allocatedAdmissions += granted;
      allocation.utilizedAdmissions += granted;
      item.remainingDemand -= granted;
      usedThisPass += granted;
    });

    openSupply = Math.max(0, openSupply - usedThisPass);
    eligible = eligible.filter(item => item.remainingDemand > 0.5);
    if (usedThisPass < 0.5) break;
  }

  return Array.from(allocations.values());
}

function geometricMean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const safe = values.map(value => clamp(value, 0.01, 1));
  return Math.exp(safe.reduce((sum, value) => sum + Math.log(value), 0) / safe.length);
}

export function estimatePremiumFormatDemand(
  totalDemandAdmissions: number,
  imaxSuitability: number,
  dolbySuitability: number,
): { regular: number; imax: number; dolby: number } {
  let imaxShare = 0.3 * Math.pow(clamp((imaxSuitability - 30) / 70, 0, 1), 1.4);
  let dolbyShare = 0.24 * Math.pow(clamp((dolbySuitability - 30) / 70, 0, 1), 1.35);
  const premiumTotal = imaxShare + dolbyShare;
  if (premiumTotal > BALANCE.maximumPremiumDemandShare) {
    const normalization = BALANCE.maximumPremiumDemandShare / premiumTotal;
    imaxShare *= normalization;
    dolbyShare *= normalization;
  }
  return {
    regular: totalDemandAdmissions * (1 - imaxShare - dolbyShare),
    imax: totalDemandAdmissions * imaxShare,
    dolby: totalDemandAdmissions * dolbyShare,
  };
}

export function simulateTerritoryWeek(input: TerritoryWeekInput): TerritoryWeekResult {
  const audienceExperience = clamp(input.audienceExperience);
  const awareness = clamp(input.campaign.awareness) / 100;
  const interest = clamp(input.campaign.interest) / 100;
  const appeal = clamp(input.commercialAppeal) / 100;
  const timing = 0.82 + clamp(input.releaseTiming) / 100 * 0.36;
  const competitionOpportunity = 1 -
    clamp(input.competition) / 100 * 0.68;
  const productionScale = clamp(input.productionScale) / 100;
  const launchHook = clamp(input.launchHook) / 100;
  const marketScale = Math.max(0.005, input.territoryMarketShare / 0.35);
  const variance = clamp(input.demandVariance ?? 1, 0.45, 1.75);
  const premiumReadiness = clamp(
    (clamp(input.imaxSuitability) * 0.58 + clamp(input.dolbySuitability) * 0.42) / 100,
    0.2,
    1,
  );
  const globalAccessibility = getGenreGlobalAccessibility(input.genre) / 100;
  const eventPotential = clamp(geometricMean([
    awareness,
    interest,
    appeal,
    Math.max(0.18, productionScale),
    Math.max(0.18, launchHook),
    clamp(timing / 1.18, 0.2, 1),
    clamp(competitionOpportunity, 0.2, 1),
    premiumReadiness,
    globalAccessibility,
  ]) * 100);
  const eventIntensity = Math.min(
    BALANCE.eventMaximumIntensity,
    Math.pow(
      clamp(
        (eventPotential - BALANCE.eventThreshold) / BALANCE.eventRange,
        0,
        1,
      ),
      BALANCE.eventCurveExponent,
    ),
  );
  const eventDemandMultiplier = 1 + BALANCE.eventDemandBoost * eventIntensity;

  const womDelta = audienceExperience - clamp(input.openingExpectation);
  const deliveryStrength = clamp((womDelta - 8) / 24, 0, 1);
  const experienceStrength = clamp((audienceExperience - 62) / 36, 0, 1);
  const organicMomentum = clamp(
    (input.campaign.buzz + 12) / 30 + Math.max(0, womDelta - 8) / 80,
    0.05,
    1,
  );
  const phenomenonPotential = input.weekNumber === 0 ? 0 : clamp(geometricMean([
    deliveryStrength,
    experienceStrength,
    organicMomentum,
    globalAccessibility,
  ]) * 100);
  const rawPhenomenonIntensity = input.weekNumber === 0 ? 0 : Math.pow(
    clamp(
      (phenomenonPotential - BALANCE.phenomenonThreshold) /
        BALANCE.phenomenonRange,
      0,
      1,
    ),
    BALANCE.phenomenonCurveExponent,
  );
  // Anticipated events and sleeper phenomena are separate paths. A film that
  // already opened as a major event cannot stack the full sleeper expansion.
  const phenomenonIntensity = rawPhenomenonIntensity *
    (1 - clamp(eventIntensity / 0.1, 0, 1));

  const internationalReach = 1 +
    BALANCE.eventInternationalReachBoost * eventIntensity * globalAccessibility *
    (input.territoryCode === "NA" ? 0.15 : 1);
  const openingAddressableAdmissions =
    BALANCE.openingAddressableAdmissionsDomestic * marketScale * internationalReach;
  const openingDemand = openingAddressableAdmissions *
    Math.pow(awareness, 1.08) *
    Math.pow(interest, 1.02) *
    (0.34 + appeal * 0.66) *
    (BALANCE.productionDemandFloor +
      productionScale * (1 - BALANCE.productionDemandFloor)) *
    timing *
    competitionOpportunity *
    eventDemandMultiplier *
    variance;

  const retention = clamp(
    BALANCE.retentionBase +
    womDelta * 0.006 +
    input.campaign.buzz * 0.0012 +
    Math.min(0.08, input.weekNumber * 0.012) +
    BALANCE.phenomenonRetentionBoost * phenomenonIntensity,
    0.22,
    0.86,
  );
  const previousAdmissions = Math.max(0, input.previousWeekGross ?? 0) /
    Math.max(1, input.baseTicketPrice * 1.08);
  const holdoverDemand = previousAdmissions * retention *
    (0.94 + awareness * 0.03 + interest * 0.03);
  const discoveryDecay = Math.exp(-Math.max(0, input.weekNumber - 1) / 8);
  const organicDiscoveryDemand = openingAddressableAdmissions *
    BALANCE.phenomenonDiscoveryShare * phenomenonIntensity * discoveryDecay *
    (0.45 + awareness * 0.35 + interest * 0.2);
  const totalDemandAdmissions = input.weekNumber === 0
    ? openingDemand
    : holdoverDemand + organicDiscoveryDemand;

  const formatDemand = estimatePremiumFormatDemand(
    totalDemandAdmissions,
    input.imaxSuitability,
    input.dolbySuitability,
  );
  const premiumTurnover = 1 +
    BALANCE.eventPremiumTurnoverBoost * eventIntensity +
    BALANCE.phenomenonPremiumTurnoverBoost * phenomenonIntensity;
  const imaxAdmissions = Math.min(
    formatDemand.imax,
    Math.max(0, input.imaxAllocationAdmissions) * premiumTurnover,
  );
  const dolbyAdmissions = Math.min(
    formatDemand.dolby,
    Math.max(0, input.dolbyAllocationAdmissions) * premiumTurnover,
  );
  // Most viewers unable to obtain their preferred premium format can choose a
  // regular presentation, but some demand is lost rather than duplicated.
  const premiumSpillover =
    Math.max(0, formatDemand.imax - imaxAdmissions) * 0.82 +
    Math.max(0, formatDemand.dolby - dolbyAdmissions) * 0.86;
  const eventDensity = 1 +
    BALANCE.eventCapacityBoost * eventIntensity +
    BALANCE.phenomenonCapacityBoost * phenomenonIntensity;
  const regularCapacity = Math.max(0, input.regularCapacityAdmissions) * eventDensity;
  const regularDemand = formatDemand.regular + premiumSpillover;
  const regularAdmissions = Math.min(regularDemand, regularCapacity);

  const regularGross = regularAdmissions * input.baseTicketPrice;
  const imaxGross = imaxAdmissions * input.imaxTicketPrice;
  const dolbyGross = dolbyAdmissions * input.dolbyTicketPrice;

  return {
    gross: Math.round(regularGross + imaxGross + dolbyGross),
    regularGross: Math.round(regularGross),
    imaxGross: Math.round(imaxGross),
    dolbyGross: Math.round(dolbyGross),
    totalDemandAdmissions,
    regularDemandAdmissions: regularDemand,
    imaxDemandAdmissions: formatDemand.imax,
    dolbyDemandAdmissions: formatDemand.dolby,
    regularAdmissions,
    imaxAdmissions,
    dolbyAdmissions,
    eventPotential,
    eventIntensity,
    phenomenonPotential,
    phenomenonIntensity,
    regularCapacityAdmissions: regularCapacity,
    retention,
  };
}
