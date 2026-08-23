export interface TalentLike {
  performance?: number | null;
  experience?: number | null;
  fame?: number | null;
  popularity?: number | null;
  genres?: unknown;
  skillAction?: number | null;
  skillDrama?: number | null;
  skillComedy?: number | null;
  skillThriller?: number | null;
  skillHorror?: number | null;
  skillScifi?: number | null;
  skillAnimation?: number | null;
  skillRomance?: number | null;
  skillFantasy?: number | null;
  skillMusicals?: number | null;
  skillCinematography?: number | null;
  skillOrchestral?: number | null;
  skillElectronic?: number | null;
}

export interface DepartmentBudgets {
  sets?: number | null;
  costumes?: number | null;
  stunts?: number | null;
  makeup?: number | null;
  practicalEffects?: number | null;
  sound?: number | null;
}

export interface FilmQualityInput {
  genre: string;
  productionBudget: number;
  scriptQuality?: number | null;
  cinematographyQuality?: number | null;
  director?: TalentLike | null;
  writer?: TalentLike | null;
  cast?: readonly TalentLike[] | null;
  cinematographer?: TalentLike | null;
  editor?: TalentLike | null;
  composer?: TalentLike | null;
  vfxQuality?: number | null;
  vfxGenreFit?: number | null;
  departmentBudgets?: DepartmentBudgets;
  /** Optional 0-100 concept-to-genre fit known by the caller. */
  conceptFit?: number | null;
  /** Optional production execution modifier on a 0-100 scale. */
  productionExecution?: number | null;
  /** Optional 0-100 franchise or familiar-IP recognition. */
  franchiseFamiliarity?: number | null;
  /** Optional market-weighted campaign expectation snapshot, 0-100. */
  audienceExpectation?: number | null;
}

export interface QualityComponentBreakdown {
  script: number;
  direction: number;
  cast: number;
  craft: number;
  talentFit: number;
  collaboration: number;
  budgetSupport: number;
  interaction: number;
  badFilmPenalty: number;
}

export interface FilmQualityResult {
  criticScore: number;
  /** Stored schema compatibility: audience score remains on the existing 0-10 scale. */
  audienceScore: number;
  audienceScore100: number;
  /** Audience interpretation before campaign expectations alter the displayed score. */
  audienceExperienceScore100: number;
  latentQuality: number;
  expectedCriticScore: number;
  /** Expected intrinsic audience experience before reception noise. */
  expectedAudienceExperience: number;
  /** Expected displayed audience reception after the expectation response. */
  expectedAudienceScore: number;
  isBadFilm: boolean;
  /** Compatibility flag: true when either group independently awards a perfect score. */
  isPerfectScore: boolean;
  isCriticPerfect: boolean;
  isAudiencePerfect: boolean;
  uncertainty: {
    sharedShock: number;
    criticShock: number;
    audienceShock: number;
    randomGap: number;
  };
  reception: {
    sharedReception: number;
    criticLensScore: number;
    audienceLensScore: number;
    criticPreferenceDelta: number;
    audiencePreferenceDelta: number;
    criticGenrePrior: number;
    audienceGenrePrior: number;
    audienceExpectation: number;
    expectationModifier: number;
    deliveryGap: number;
    criticDimensions: {
      script: number;
      direction: number;
      craft: number;
      cast: number;
      collaboration: number;
      ambition: number;
    };
    audienceDimensions: {
      castExperience: number;
      genreSatisfaction: number;
      spectacle: number;
      entertainment: number;
      starAppeal: number;
      familiarity: number;
    };
  };
  breakdown: QualityComponentBreakdown;
}

export interface BoxOfficeInput {
  genre: string;
  productionBudget: number;
  marketingBudget: number;
  criticScore: number;
  /** Accepts either the schema's 0-10 value or a 0-100 value. */
  audienceScore: number;
  /** Intrinsic audience experience for WOM; defaults to audienceScore for old callers. */
  audienceExperience?: number | null;
  /** 0-100; unlike quality, this measures how sellable the premise is. */
  conceptCommerciality?: number | null;
  /** 0-100 aggregate fame/popularity or provide talent in `stars`. */
  starPower?: number | null;
  stars?: readonly TalentLike[] | null;
  /** 0-100 franchise/IP recognition. */
  franchiseAwareness?: number | null;
  /** 0-100 release-date suitability. */
  releaseTiming?: number | null;
  /** 0 means empty calendar, 100 means severe direct competition. */
  competition?: number | null;
  /** Explicit override; otherwise derived from awareness and market scale. */
  theaterCount?: number | null;
  /** Optional advance audience expectation, 0-100. */
  audienceExpectation?: number | null;
  internationalMultiplier?: number | null;
}

export interface BoxOfficeResult {
  openingWeekend: number;
  totalGross: number;
  domesticGross: number;
  internationalGross: number;
  weeklyGrosses: number[];
  theaterCount: number;
  legsMultiplier: number;
  breakdown: {
    commercialAppeal: number;
    starPower: number;
    organicAwareness: number;
    marketingSaturation: number;
    effectiveAwareness: number;
    releaseTiming: number;
    competition: number;
    capacity: number;
    demandBeforeCapacity: number;
    openingVarianceMultiplier: number;
    expectedAudienceScore: number;
    wordOfMouthDelta: number;
    initialRetention: number;
    marketCeilingMultiplier: number;
  };
}

export type CampaignActionKind =
  | "teaser"
  | "targeted-media"
  | "broad-awareness"
  | "publicity"
  | "opening-blitz"
  | "post-release";

export interface TerritoryCampaignState {
  awareness: number;
  interest: number;
  expectation: number;
  buzz: number;
  paidReach: number;
}

export interface CampaignActionProfile {
  kind: CampaignActionKind;
  name: string;
  minimumWeeksFromRelease: number;
  maximumWeeksFromRelease: number;
  awarenessEffect: number;
  interestEffect: number;
  expectationEffect: number;
  buzzEffect: number;
  responseVolatility: number;
}

export interface CampaignActionInput {
  state: TerritoryCampaignState;
  action: CampaignActionKind;
  spend: number;
  territoryMarketShare: number;
  territoryFit: number;
  targetingFit: number;
  weeksFromRelease: number;
  creativeStrength: number;
}

export interface CampaignActionResult {
  state: TerritoryCampaignState;
  reachGain: number;
  effectiveSpend: number;
  response: number;
}

export type PremiumFormat = "imax" | "dolby";
export type PremiumAccessLevel = "standard" | "priority" | "exclusive";

export interface PremiumSuitabilityInput {
  genre: string;
  productionBudget: number;
  viableBudget: number;
  cinematographyQuality?: number | null;
  vfxQuality?: number | null;
  soundBudget?: number | null;
  composer?: TalentLike | null;
  largeFormatPositioning?: number | null;
}

export interface PremiumSuitabilityResult {
  imaxSuitability: number;
  dolbySuitability: number;
  breakdown: {
    productionScale: number;
    visualAmbition: number;
    vfxScale: number;
    soundAmbition: number;
    musicStrength: number;
    imaxGenreFit: number;
    dolbyGenreFit: number;
  };
}

export interface PremiumBookingLike {
  filmId: string;
  format: PremiumFormat;
  territoryCode: string;
  accessLevel: PremiumAccessLevel;
  startWeek: number;
  startYear: number;
  durationWeeks: number;
  status?: string;
}

export interface PremiumAllocationCandidate {
  filmId: string;
  formatDemand: number;
  suitability: number;
  accessLevel: PremiumAccessLevel;
  isOpeningWeek: boolean;
  recentOccupancy?: number;
}

export interface PremiumAllocation {
  filmId: string;
  allocatedAdmissions: number;
  reservedAdmissions: number;
  utilizedAdmissions: number;
}

export interface TerritoryWeekInput {
  territoryCode: string;
  territoryMarketShare: number;
  genre: string;
  productionScale: number;
  /** 0-1 share of budget-supported blockbuster infrastructure actually deployed. */
  blockbusterDeployment?: number;
  commercialAppeal: number;
  launchHook: number;
  releaseTiming: number;
  competition: number;
  /** Intrinsic 0-100 audience experience. It must not include expectation response. */
  audienceExperience: number;
  campaign: TerritoryCampaignState;
  openingExpectation: number;
  weekNumber: number;
  previousWeekGross?: number;
  baseTicketPrice: number;
  imaxTicketPrice: number;
  dolbyTicketPrice: number;
  regularCapacityAdmissions: number;
  imaxAllocationAdmissions: number;
  dolbyAllocationAdmissions: number;
  imaxSuitability: number;
  dolbySuitability: number;
  demandVariance?: number;
  /** Audience admissions awarded by the shared territory market, before screens. */
  marketAllocatedAdmissions?: number;
}

export interface TerritoryWeekResult {
  gross: number;
  regularGross: number;
  imaxGross: number;
  dolbyGross: number;
  totalDemandAdmissions: number;
  unconstrainedDemandAdmissions: number;
  marketAllocatedAdmissions: number;
  regularDemandAdmissions: number;
  imaxDemandAdmissions: number;
  dolbyDemandAdmissions: number;
  regularAdmissions: number;
  imaxAdmissions: number;
  dolbyAdmissions: number;
  eventPotential: number;
  eventIntensity: number;
  phenomenonPotential: number;
  phenomenonIntensity: number;
  regularCapacityAdmissions: number;
  retention: number;
}
