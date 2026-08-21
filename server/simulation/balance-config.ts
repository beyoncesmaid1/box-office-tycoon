export const SIMULATION_GENRES = [
  "action",
  "comedy",
  "drama",
  "horror",
  "scifi",
  "romance",
  "thriller",
  "animation",
  "fantasy",
  "musicals",
] as const;

export type SimulationGenre = (typeof SIMULATION_GENRES)[number];

export interface GenreBalance {
  productionScale: number;
  viableBudget: number;
  marketCeiling: number;
  baseCommercialAppeal: number;
  criticBias: number;
  audienceBias: number;
  departmentNeeds: {
    sets: number;
    costumes: number;
    stunts: number;
    makeup: number;
    practicalEffects: number;
    sound: number;
  };
}

export interface CriticLensWeights {
  script: number;
  direction: number;
  craft: number;
  cast: number;
  collaboration: number;
  ambition: number;
}

export interface AudienceLensWeights {
  castExperience: number;
  genreSatisfaction: number;
  spectacle: number;
  entertainment: number;
  starAppeal: number;
  familiarity: number;
}

export interface GenreReceptionLens {
  critic: CriticLensWeights;
  audience: AudienceLensWeights;
}

export interface QualityBalanceConfig {
  componentWeights: {
    script: number;
    direction: number;
    cast: number;
    craft: number;
  };
  talentFitWeight: number;
  collaborationWeight: number;
  budgetContribution: number;
  budgetCurveExponent: number;
  interactionLimit: number;
  latentNoiseSd: number;
  criticNoiseSd: number;
  audienceNoiseSd: number;
  criticAudienceCorrelation: number;
  criticLensStrength: number;
  audienceLensStrength: number;
  criticLensMaximumAdjustment: number;
  audienceLensMaximumAdjustment: number;
  expectationModifierMaximum: number;
  expectationResponseScale: number;
  genreReceptionLenses: Record<SimulationGenre, GenreReceptionLens>;
  badFilmThreshold: number;
  badFilmMaximumPenalty: number;
  perfectScoreBaseChance: number;
  perfectScoreEliteMultiplier: number;
}

export interface BoxOfficeBalanceConfig {
  baseDomesticDemand: number;
  marketingHalfSaturation: number;
  marketingMaximumBoost: number;
  starPowerWeight: number;
  conceptWeight: number;
  franchiseWeight: number;
  qualityAwarenessWeight: number;
  screenCapacityPerTheater: number;
  maximumTheaters: number;
  competitionPressure: number;
  openingVarianceSd: number;
  expectationBaseline: number;
  womSensitivity: number;
  weeklyDecayBase: number;
  minimumWeeklyRetention: number;
  maximumWeeklyRetention: number;
  maximumRunWeeks: number;
  closeBelowGross: number;
}

export interface CampaignBalanceConfig {
  domesticReachHalfSaturation: number;
  prereleaseAwarenessDecay: number;
  prereleaseInterestDecay: number;
  postreleaseInterestDecay: number;
  postreleaseBuzzDecay: number;
  maximumOrganicReachPerWeek: number;
}

export interface ExhibitionBalanceConfig {
  productionScaleHalfSaturation: number;
  openingAddressableAdmissionsDomestic: number;
  productionDemandFloor: number;
  retentionBase: number;
  eventThreshold: number;
  eventRange: number;
  eventCurveExponent: number;
  eventMaximumIntensity: number;
  eventDemandBoost: number;
  eventCapacityBoost: number;
  eventPremiumTurnoverBoost: number;
  eventInternationalReachBoost: number;
  phenomenonThreshold: number;
  phenomenonRange: number;
  phenomenonCurveExponent: number;
  phenomenonDiscoveryShare: number;
  phenomenonCapacityBoost: number;
  phenomenonPremiumTurnoverBoost: number;
  phenomenonRetentionBoost: number;
  maximumPremiumDemandShare: number;
}

export interface DistributionTargets {
  /** Broad random production slate: mean critic score should be about 58-65. */
  randomCriticMean: readonly [number, number];
  /** Ordinary slate share scoring below 40: enough failures to keep greenlights risky. */
  randomCriticBelow40Rate: readonly [number, number];
  /** Ordinary slate share scoring at least 80: uncommon, not miraculous. */
  randomCriticAtLeast80Rate: readonly [number, number];
  /** A displayed 100 should remain an exceptional long-run event. */
  perfectScoreRateMaximum: number;
  /** Skilled decisions should improve outcomes without removing variance. */
  skilledCriticMeanAdvantage: readonly [number, number];
  /** Marketing-heavy mediocre films may open well but should have shorter legs. */
  expectedWideReleaseLegs: readonly [number, number];
  /** Useful gross bands for checking broad economic scale, not hard guarantees. */
  lowBudgetMedianWorldwideGross: readonly [number, number];
  highBudgetMedianWorldwideGross: readonly [number, number];
}

export interface SimulationBalanceConfig {
  quality: QualityBalanceConfig;
  boxOffice: BoxOfficeBalanceConfig;
  campaign: CampaignBalanceConfig;
  exhibition: ExhibitionBalanceConfig;
  genres: Record<SimulationGenre, GenreBalance>;
  targets: DistributionTargets;
}

const genre = (
  productionScale: number,
  viableBudget: number,
  marketCeiling: number,
  baseCommercialAppeal: number,
  criticBias: number,
  audienceBias: number,
  departmentNeeds: GenreBalance["departmentNeeds"],
): GenreBalance => ({
  productionScale,
  viableBudget,
  marketCeiling,
  baseCommercialAppeal,
  criticBias,
  audienceBias,
  departmentNeeds,
});

const receptionLens = (
  critic: CriticLensWeights,
  audience: AudienceLensWeights,
): GenreReceptionLens => ({ critic, audience });

export const DEFAULT_SIMULATION_CONFIG: SimulationBalanceConfig = {
  quality: {
    componentWeights: { script: 0.3, direction: 0.27, cast: 0.23, craft: 0.2 },
    talentFitWeight: 0.07,
    collaborationWeight: 0.04,
    budgetContribution: 4,
    budgetCurveExponent: 0.68,
    interactionLimit: 3,
    latentNoiseSd: 7.5,
    criticNoiseSd: 5.8,
    audienceNoiseSd: 5.3,
    criticAudienceCorrelation: 0.4,
    criticLensStrength: 1.35,
    audienceLensStrength: 1.5,
    criticLensMaximumAdjustment: 18,
    audienceLensMaximumAdjustment: 22,
    expectationModifierMaximum: 4,
    expectationResponseScale: 18,
    genreReceptionLenses: {
      action: receptionLens(
        { script: 0.2, direction: 0.24, craft: 0.2, cast: 0.1, collaboration: 0.1, ambition: 0.16 },
        { castExperience: 0.13, genreSatisfaction: 0.23, spectacle: 0.27, entertainment: 0.17, starAppeal: 0.12, familiarity: 0.08 },
      ),
      comedy: receptionLens(
        { script: 0.31, direction: 0.19, craft: 0.1, cast: 0.2, collaboration: 0.16, ambition: 0.04 },
        { castExperience: 0.24, genreSatisfaction: 0.25, spectacle: 0.04, entertainment: 0.27, starAppeal: 0.13, familiarity: 0.07 },
      ),
      drama: receptionLens(
        { script: 0.33, direction: 0.26, craft: 0.12, cast: 0.15, collaboration: 0.11, ambition: 0.03 },
        { castExperience: 0.26, genreSatisfaction: 0.17, spectacle: 0.04, entertainment: 0.27, starAppeal: 0.14, familiarity: 0.12 },
      ),
      horror: receptionLens(
        { script: 0.21, direction: 0.25, craft: 0.2, cast: 0.08, collaboration: 0.12, ambition: 0.14 },
        { castExperience: 0.1, genreSatisfaction: 0.3, spectacle: 0.16, entertainment: 0.23, starAppeal: 0.06, familiarity: 0.15 },
      ),
      scifi: receptionLens(
        { script: 0.22, direction: 0.23, craft: 0.2, cast: 0.08, collaboration: 0.1, ambition: 0.17 },
        { castExperience: 0.11, genreSatisfaction: 0.21, spectacle: 0.28, entertainment: 0.17, starAppeal: 0.1, familiarity: 0.13 },
      ),
      romance: receptionLens(
        { script: 0.31, direction: 0.2, craft: 0.1, cast: 0.19, collaboration: 0.16, ambition: 0.04 },
        { castExperience: 0.28, genreSatisfaction: 0.22, spectacle: 0.04, entertainment: 0.25, starAppeal: 0.13, familiarity: 0.08 },
      ),
      thriller: receptionLens(
        { script: 0.27, direction: 0.25, craft: 0.16, cast: 0.1, collaboration: 0.13, ambition: 0.09 },
        { castExperience: 0.14, genreSatisfaction: 0.27, spectacle: 0.14, entertainment: 0.25, starAppeal: 0.1, familiarity: 0.1 },
      ),
      animation: receptionLens(
        { script: 0.25, direction: 0.18, craft: 0.24, cast: 0.05, collaboration: 0.11, ambition: 0.17 },
        { castExperience: 0.08, genreSatisfaction: 0.24, spectacle: 0.25, entertainment: 0.25, starAppeal: 0.07, familiarity: 0.11 },
      ),
      fantasy: receptionLens(
        { script: 0.2, direction: 0.22, craft: 0.2, cast: 0.08, collaboration: 0.11, ambition: 0.19 },
        { castExperience: 0.11, genreSatisfaction: 0.22, spectacle: 0.27, entertainment: 0.17, starAppeal: 0.09, familiarity: 0.14 },
      ),
      musicals: receptionLens(
        { script: 0.19, direction: 0.2, craft: 0.23, cast: 0.13, collaboration: 0.13, ambition: 0.12 },
        { castExperience: 0.16, genreSatisfaction: 0.25, spectacle: 0.17, entertainment: 0.22, starAppeal: 0.09, familiarity: 0.11 },
      ),
    },
    badFilmThreshold: 48,
    badFilmMaximumPenalty: 18,
    perfectScoreBaseChance: 0.000002,
    perfectScoreEliteMultiplier: 18,
  },
  boxOffice: {
    baseDomesticDemand: 120_000_000,
    marketingHalfSaturation: 42_000_000,
    marketingMaximumBoost: 0.9,
    starPowerWeight: 0.28,
    conceptWeight: 0.37,
    franchiseWeight: 0.25,
    qualityAwarenessWeight: 0,
    screenCapacityPerTheater: 22_000,
    maximumTheaters: 5_100,
    competitionPressure: 0.7,
    openingVarianceSd: 0.17,
    expectationBaseline: 58,
    womSensitivity: 0.006,
    weeklyDecayBase: 0.5,
    minimumWeeklyRetention: 0.25,
    maximumWeeklyRetention: 0.72,
    maximumRunWeeks: 16,
    closeBelowGross: 90_000,
  },
  campaign: {
    domesticReachHalfSaturation: 20_000_000,
    prereleaseAwarenessDecay: 0.992,
    prereleaseInterestDecay: 0.975,
    postreleaseInterestDecay: 0.94,
    postreleaseBuzzDecay: 0.88,
    maximumOrganicReachPerWeek: 0.16,
  },
  exhibition: {
    productionScaleHalfSaturation: 0.75,
    openingAddressableAdmissionsDomestic: 54_000_000,
    productionDemandFloor: 0.62,
    retentionBase: 0.51,
    eventThreshold: 67,
    eventRange: 18,
    eventCurveExponent: 2.2,
    eventMaximumIntensity: 0.3,
    eventDemandBoost: 3.4,
    eventCapacityBoost: 6,
    eventPremiumTurnoverBoost: 0.65,
    eventInternationalReachBoost: 0.28,
    phenomenonThreshold: 76,
    phenomenonRange: 18,
    phenomenonCurveExponent: 2.1,
    phenomenonDiscoveryShare: 0.018,
    phenomenonCapacityBoost: 2,
    phenomenonPremiumTurnoverBoost: 0.4,
    phenomenonRetentionBoost: 0.08,
    maximumPremiumDemandShare: 0.46,
  },
  genres: {
    action: genre(72_000_000, 85_000_000, 1.35, 72, -2, 3, {
      sets: 0.75, costumes: 0.45, stunts: 1, makeup: 0.45, practicalEffects: 0.85, sound: 0.85,
    }),
    comedy: genre(28_000_000, 35_000_000, 0.78, 62, -1, 3, {
      sets: 0.45, costumes: 0.4, stunts: 0.2, makeup: 0.25, practicalEffects: 0.15, sound: 0.4,
    }),
    drama: genre(22_000_000, 28_000_000, 0.62, 50, 4, -1, {
      sets: 0.5, costumes: 0.55, stunts: 0.1, makeup: 0.4, practicalEffects: 0.1, sound: 0.45,
    }),
    horror: genre(16_000_000, 19_000_000, 0.72, 68, -4, 2, {
      sets: 0.65, costumes: 0.35, stunts: 0.45, makeup: 0.9, practicalEffects: 0.75, sound: 0.8,
    }),
    scifi: genre(82_000_000, 105_000_000, 1.42, 73, 1, 2, {
      sets: 0.95, costumes: 0.75, stunts: 0.65, makeup: 0.6, practicalEffects: 1, sound: 0.9,
    }),
    romance: genre(20_000_000, 24_000_000, 0.58, 55, 0, 2, {
      sets: 0.45, costumes: 0.65, stunts: 0.05, makeup: 0.4, practicalEffects: 0.05, sound: 0.45,
    }),
    thriller: genre(31_000_000, 40_000_000, 0.82, 64, 1, 1, {
      sets: 0.6, costumes: 0.35, stunts: 0.55, makeup: 0.45, practicalEffects: 0.5, sound: 0.8,
    }),
    animation: genre(74_000_000, 92_000_000, 1.3, 76, 2, 3, {
      sets: 0.25, costumes: 0.15, stunts: 0.1, makeup: 0.05, practicalEffects: 0.2, sound: 1,
    }),
    fantasy: genre(76_000_000, 98_000_000, 1.34, 72, 0, 2, {
      sets: 1, costumes: 1, stunts: 0.65, makeup: 0.75, practicalEffects: 0.9, sound: 0.85,
    }),
    musicals: genre(48_000_000, 58_000_000, 0.88, 61, 2, 2, {
      sets: 0.75, costumes: 0.9, stunts: 0.3, makeup: 0.55, practicalEffects: 0.3, sound: 1,
    }),
  },
  targets: {
    randomCriticMean: [58, 65],
    randomCriticBelow40Rate: [0.05, 0.14],
    randomCriticAtLeast80Rate: [0.04, 0.10],
    perfectScoreRateMaximum: 0.0001,
    skilledCriticMeanAdvantage: [7, 16],
    expectedWideReleaseLegs: [2.2, 4.6],
    lowBudgetMedianWorldwideGross: [15_000_000, 90_000_000],
    highBudgetMedianWorldwideGross: [160_000_000, 650_000_000],
  },
};

export function resolveGenre(
  value: string,
  config: SimulationBalanceConfig = DEFAULT_SIMULATION_CONFIG,
): GenreBalance {
  const normalized = value.toLowerCase().replace(/[\s-]/g, "");
  if (normalized === "sci-fi" || normalized === "sciencefiction") return config.genres.scifi;
  return config.genres[normalized as SimulationGenre] ?? config.genres.drama;
}
