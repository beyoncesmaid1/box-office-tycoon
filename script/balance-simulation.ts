import {
  DEFAULT_SIMULATION_CONFIG,
  SIMULATION_GENRES,
  advanceCampaignWeek,
  allocatePremiumFormat,
  applyCampaignAction,
  calculatePremiumSuitability,
  createInitialCampaignState,
  createSeededRng,
  resolveGenre,
  simulateFilmQuality,
  simulateTerritoryWeek,
  uniform,
  type DepartmentBudgets,
  type RandomSource,
  type SimulationGenre,
  type TalentLike,
} from "../server/simulation/index";
import {
  calculateAIMarketingRatio,
  createBlockbusterDecisionProfile,
  createStudioDecisionProfile,
  getBlockbusterDeployment,
  selectAIGenre,
  selectAIProductionBudget,
} from "../server/simulation/aiDecision";
import {
  BOX_OFFICE_COUNTRIES,
  GENRE_TERRITORY_FACTORS,
  getTerritoryExhibitionProfile,
} from "../shared/countries";

type CohortName =
  | "random AI"
  | "heuristic AI"
  | "skilled optimizer"
  | "average"
  | "high-budget"
  | "low-budget"
  | "high-quality / low-commercial-appeal"
  | "mediocre-quality / high-commercial-appeal"
  | "franchise event"
  | "original event"
  | "globally accessible"
  | "culturally narrow";

interface Plan {
  genre: SimulationGenre;
  productionBudget: number;
  marketingBudget: number;
  scriptQuality: number;
  cinematographyQuality: number;
  conceptFit: number;
  conceptCommerciality: number;
  productionExecution: number;
  director: TalentLike;
  writer: TalentLike;
  cast: TalentLike[];
  specialists: TalentLike[];
  departmentBudgets: DepartmentBudgets;
  releaseTiming: number;
  competition: number;
  franchiseAwareness: number;
  blockbusterDeployment?: number;
}

interface Observation {
  genre: SimulationGenre;
  productionBudget: number;
  isTentpole: boolean;
  critic: number;
  audience: number;
  audienceExperience: number;
  expectation: number;
  expectationModifier: number;
  deliveryGap: number;
  preferenceGap: number;
  structuralGap: number;
  randomGap: number;
  gross: number;
  internationalShare: number;
  opening: number;
  legs: number;
  spend: number;
  profit: number;
  badFilm: boolean;
  perfect: boolean;
  criticPerfect: boolean;
  audiencePerfect: boolean;
  imaxGross: number;
  dolbyGross: number;
  eventPotential: number;
  eventIntensity: number;
  phenomenonPotential: number;
  phenomenonIntensity: number;
  openingDemandAdmissions: number;
  openingAdmissions: number;
}

interface PreparedCampaign {
  campaigns: Map<string, ReturnType<typeof createInitialCampaignState>>;
  openingExpectations: Map<string, number>;
  marketWeightedExpectation: number;
}

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.max(minimum, Math.min(maximum, value));

const pick = <T>(rng: RandomSource, values: readonly T[]): T =>
  values[Math.floor(rng.next() * values.length)];

const talent = (
  rng: RandomSource,
  genre: SimulationGenre,
  minimum: number,
  maximum: number,
  fitMinimum = minimum,
  fitMaximum = maximum,
): TalentLike => {
  const performance = uniform(rng, minimum, maximum);
  const experience = uniform(rng, minimum, maximum);
  const fit = uniform(rng, fitMinimum, fitMaximum);
  return {
    performance,
    experience,
    fame: uniform(rng, minimum, maximum),
    popularity: uniform(rng, minimum, maximum),
    genres: { [genre]: fit },
  };
};

function departments(
  rng: RandomSource,
  productionBudget: number,
  adequacyMinimum: number,
  adequacyMaximum: number,
): DepartmentBudgets {
  const spend = () => productionBudget * 0.055 *
    uniform(rng, adequacyMinimum, adequacyMaximum);
  return {
    sets: spend(),
    costumes: spend(),
    stunts: spend(),
    makeup: spend(),
    practicalEffects: spend(),
    sound: spend(),
  };
}

function makePlan(
  rng: RandomSource,
  profile: {
    productionRatio: readonly [number, number];
    marketingRatio: readonly [number, number];
    talent: readonly [number, number];
    fit: readonly [number, number];
    script: readonly [number, number];
    concept: readonly [number, number];
    execution: readonly [number, number];
    departmentAdequacy: readonly [number, number];
    timing: readonly [number, number];
    competition: readonly [number, number];
    franchise: readonly [number, number];
  },
  forcedGenre?: SimulationGenre,
): Plan {
  const genre = forcedGenre ?? pick(rng, SIMULATION_GENRES);
  const genreBalance = resolveGenre(genre);
  const productionBudget = genreBalance.viableBudget *
    uniform(rng, profile.productionRatio[0], profile.productionRatio[1]);
  const marketingBudget = productionBudget *
    uniform(rng, profile.marketingRatio[0], profile.marketingRatio[1]);
  const makeTalent = () => talent(
    rng,
    genre,
    profile.talent[0],
    profile.talent[1],
    profile.fit[0],
    profile.fit[1],
  );
  return {
    genre,
    productionBudget,
    marketingBudget,
    scriptQuality: uniform(rng, profile.script[0], profile.script[1]),
    cinematographyQuality: uniform(rng, profile.script[0], profile.script[1]),
    conceptFit: uniform(rng, profile.fit[0], profile.fit[1]),
    conceptCommerciality: clamp(
      genreBalance.baseCommercialAppeal +
      uniform(rng, profile.concept[0], profile.concept[1]) - 50,
    ),
    productionExecution: uniform(rng, profile.execution[0], profile.execution[1]),
    director: makeTalent(),
    writer: makeTalent(),
    cast: [makeTalent(), makeTalent(), makeTalent()],
    specialists: [makeTalent(), makeTalent(), makeTalent()],
    departmentBudgets: departments(
      rng,
      productionBudget,
      profile.departmentAdequacy[0],
      profile.departmentAdequacy[1],
    ),
    releaseTiming: uniform(rng, profile.timing[0], profile.timing[1]),
    competition: uniform(rng, profile.competition[0], profile.competition[1]),
    franchiseAwareness: uniform(rng, profile.franchise[0], profile.franchise[1]),
  };
}

const randomProfile = {
  productionRatio: [0.18, 1.65],
  marketingRatio: [0.08, 1.2],
  talent: [25, 90],
  fit: [20, 90],
  script: [25, 90],
  concept: [15, 90],
  execution: [25, 90],
  departmentAdequacy: [0.1, 1.5],
  timing: [20, 90],
  competition: [10, 95],
  franchise: [0, 70],
} as const;

const heuristicProfile = {
  productionRatio: [0.5, 1.25],
  marketingRatio: [0.3, 0.9],
  talent: [38, 86],
  fit: [25, 92],
  script: [35, 86],
  concept: [35, 84],
  execution: [35, 86],
  departmentAdequacy: [0.3, 1.3],
  timing: [35, 86],
  competition: [15, 78],
  franchise: [0, 55],
} as const;

const skilledProfile = {
  productionRatio: [0.48, 1.22],
  marketingRatio: [0.3, 0.85],
  talent: [46, 91],
  fit: [43, 95],
  script: [43, 91],
  concept: [42, 90],
  execution: [44, 91],
  departmentAdequacy: [0.42, 1.3],
  timing: [52, 90],
  competition: [10, 62],
  franchise: [0, 65],
} as const;

const averageProfile = {
  productionRatio: [0.52, 1.08],
  marketingRatio: [0.32, 0.72],
  talent: [45, 75],
  fit: [42, 78],
  script: [43, 76],
  concept: [38, 75],
  execution: [42, 76],
  departmentAdequacy: [0.4, 1.05],
  timing: [35, 75],
  competition: [25, 78],
  franchise: [0, 40],
} as const;

const highBudgetProfile = {
  ...averageProfile,
  productionRatio: [1.5, 3.3],
  marketingRatio: [0.65, 1.15],
  talent: [52, 86],
  departmentAdequacy: [0.75, 1.6],
} as const;

const lowBudgetProfile = {
  ...averageProfile,
  productionRatio: [0.08, 0.38],
  marketingRatio: [0.12, 0.55],
  talent: [38, 79],
  departmentAdequacy: [0.12, 0.7],
} as const;

function planUtility(plan: Plan): number {
  const talentValues = [plan.director, plan.writer, ...plan.cast].map((person) => {
    const fit = person.genres && typeof person.genres === "object"
      ? Number((person.genres as Record<string, unknown>)[plan.genre] ?? 50)
      : 50;
    return Number(person.performance ?? 50) * 0.65 + fit * 0.35;
  });
  const creative = plan.scriptQuality * 0.28 + plan.conceptFit * 0.2 +
    plan.productionExecution * 0.18 +
    talentValues.reduce((sum, value) => sum + value, 0) / talentValues.length * 0.24 +
    plan.conceptCommerciality * 0.1;
  const avoidCompetition = (100 - plan.competition) * 0.08 + plan.releaseTiming * 0.08;
  const genreBalance = resolveGenre(plan.genre);
  const overspendPenalty = Math.max(
    0,
    plan.productionBudget / genreBalance.viableBudget - 1.2,
  ) * 5;
  return creative + avoidCompetition - overspendPenalty;
}

function generatePlan(cohort: CohortName, rng: RandomSource): Plan {
  if (cohort === "random AI") return makePlan(rng, randomProfile);
  if (cohort === "heuristic AI") return makePlan(rng, heuristicProfile);
  if (cohort === "average") return makePlan(rng, averageProfile);
  if (cohort === "high-budget") return makePlan(rng, highBudgetProfile);
  if (cohort === "low-budget") return makePlan(rng, lowBudgetProfile);

  const globalGenres: SimulationGenre[] = ["action", "scifi", "fantasy", "animation"];
  const narrowGenres: SimulationGenre[] = ["comedy", "drama", "romance"];
  if (cohort === "high-quality / low-commercial-appeal") {
    const plan = makePlan(rng, averageProfile);
    plan.scriptQuality = uniform(rng, 84, 98);
    plan.cinematographyQuality = uniform(rng, 82, 98);
    plan.productionExecution = uniform(rng, 82, 97);
    plan.conceptCommerciality = uniform(rng, 28, 48);
    plan.franchiseAwareness = 0;
    return plan;
  }
  if (cohort === "mediocre-quality / high-commercial-appeal") {
    const plan = makePlan(rng, highBudgetProfile, pick(rng, globalGenres));
    plan.scriptQuality = uniform(rng, 42, 62);
    plan.cinematographyQuality = uniform(rng, 48, 68);
    plan.productionExecution = uniform(rng, 45, 66);
    plan.conceptCommerciality = uniform(rng, 88, 100);
    plan.marketingBudget *= uniform(rng, 1.05, 1.35);
    const lowerCreativeSkill = (person: TalentLike): TalentLike => ({
      ...person,
      performance: uniform(rng, 42, 64),
      experience: uniform(rng, 44, 68),
      genres: { [plan.genre]: uniform(rng, 42, 68) },
    });
    plan.director = lowerCreativeSkill(plan.director);
    plan.writer = lowerCreativeSkill(plan.writer);
    plan.cast = plan.cast.map(lowerCreativeSkill);
    plan.specialists = plan.specialists.map(lowerCreativeSkill);
    return plan;
  }
  if (cohort === "franchise event" || cohort === "original event") {
    const plan = makePlan(rng, highBudgetProfile, pick(rng, globalGenres));
    plan.productionBudget *= uniform(rng, 1.05, 1.3);
    plan.marketingBudget *= uniform(rng, 1.15, 1.55);
    plan.conceptCommerciality = uniform(rng, 86, 100);
    plan.releaseTiming = uniform(rng, 76, 100);
    plan.competition = uniform(rng, 0, 28);
    plan.franchiseAwareness = cohort === "franchise event" ? uniform(rng, 84, 100) : 0;
    plan.cast = plan.cast.map(person => ({
      ...person,
      fame: uniform(rng, 82, 100),
      popularity: uniform(rng, 80, 100),
    }));
    return plan;
  }
  if (cohort === "globally accessible") {
    return makePlan(rng, skilledProfile, pick(rng, globalGenres));
  }
  if (cohort === "culturally narrow") {
    const plan = makePlan(rng, highBudgetProfile, pick(rng, narrowGenres));
    plan.conceptCommerciality = uniform(rng, 78, 98);
    plan.releaseTiming = uniform(rng, 65, 95);
    plan.competition = uniform(rng, 5, 42);
    return plan;
  }

  // The optimizer sees plan attributes, not outcome RNG, and picks from a finite slate.
  let best = makePlan(rng, skilledProfile);
  let bestUtility = planUtility(best);
  for (let candidateIndex = 1; candidateIndex < 4; candidateIndex += 1) {
    const candidate = makePlan(rng, skilledProfile);
    const utility = planUtility(candidate);
    if (utility > bestUtility) {
      best = candidate;
      bestUtility = utility;
    }
  }
  return best;
}

function prepareCampaign(
  plan: Plan,
  rng: RandomSource,
): PreparedCampaign {
  const genreBalance = resolveGenre(plan.genre);
  const starDraw = mean(plan.cast.map(person =>
    Number(person.fame ?? 50) * 0.7 + Number(person.popularity ?? 50) * 0.3));
  const launchHook = Math.max(
    plan.franchiseAwareness,
    starDraw,
    plan.conceptCommerciality * 0.82,
  );
  const campaigns = new Map<string, ReturnType<typeof createInitialCampaignState>>();
  for (const territory of BOX_OFFICE_COUNTRIES) {
    campaigns.set(territory.code, createInitialCampaignState(
      Math.max(5, launchHook * 0.23),
      Math.max(7, launchHook * 0.18),
      Math.max(46, 48 + launchHook * 0.15),
    ));
  }

  const timedActions = [
    { week: 12, action: "teaser" as const, share: 0.14 },
    { week: 8, action: "broad-awareness" as const, share: 0.32 },
    { week: 4, action: "publicity" as const, share: 0.2 },
    { week: 1, action: "opening-blitz" as const, share: 0.34 },
  ];
  for (let weeksFromRelease = 16; weeksFromRelease >= 0; weeksFromRelease -= 1) {
    for (const scheduled of timedActions.filter(item => item.week === weeksFromRelease)) {
      for (const territory of BOX_OFFICE_COUNTRIES) {
        const state = campaigns.get(territory.code)!;
        const territoryFit = GENRE_TERRITORY_FACTORS[plan.genre]?.[territory.name] ?? 1;
        const result = applyCampaignAction({
          state,
          action: scheduled.action,
          spend: plan.marketingBudget * scheduled.share * territory.percentage,
          territoryMarketShare: territory.percentage,
          territoryFit,
          targetingFit: 0.92,
          weeksFromRelease,
          creativeStrength: (plan.scriptQuality + plan.conceptCommerciality) / 2,
        }, rng);
        campaigns.set(territory.code, result.state);
      }
    }
    if (weeksFromRelease > 0) {
      for (const territory of BOX_OFFICE_COUNTRIES) {
        campaigns.set(territory.code, advanceCampaignWeek(
          campaigns.get(territory.code)!,
          { isReleased: false },
        ));
      }
    }
  }
  const openingExpectations = new Map<string, number>();
  let weightedExpectation = 0;
  let totalMarketWeight = 0;
  for (const territory of BOX_OFFICE_COUNTRIES) {
    const expectation = campaigns.get(territory.code)!.expectation;
    openingExpectations.set(territory.code, expectation);
    weightedExpectation += expectation * territory.percentage;
    totalMarketWeight += territory.percentage;
  }
  return {
    campaigns,
    openingExpectations,
    marketWeightedExpectation: weightedExpectation / Math.max(0.001, totalMarketWeight),
  };
}

function simulateCampaignRun(
  plan: Plan,
  audienceExperience: number,
  criticScore: number,
  prepared: PreparedCampaign,
  rng: RandomSource,
): {
  openingWeekend: number;
  totalGross: number;
  legsMultiplier: number;
  imaxGross: number;
  dolbyGross: number;
  eventPotential: number;
  eventIntensity: number;
  phenomenonPotential: number;
  phenomenonIntensity: number;
  openingDemandAdmissions: number;
  openingAdmissions: number;
  domesticGross: number;
} {
  const genreBalance = resolveGenre(plan.genre);
  const productionScale = clamp(
    100 * (1 - Math.exp(-plan.productionBudget / (
      genreBalance.viableBudget *
      DEFAULT_SIMULATION_CONFIG.exhibition.productionScaleHalfSaturation
    ))),
  );
  const starDraw = mean(plan.cast.map(person =>
    Number(person.fame ?? 50) * 0.7 + Number(person.popularity ?? 50) * 0.3));
  const launchHook = Math.max(
    plan.franchiseAwareness,
    starDraw,
    plan.conceptCommerciality * 0.82,
  );
  const formatProfile = calculatePremiumSuitability({
    genre: plan.genre,
    productionBudget: plan.productionBudget,
    viableBudget: genreBalance.viableBudget,
    cinematographyQuality: plan.cinematographyQuality,
    soundBudget: plan.departmentBudgets.sound,
    composer: plan.specialists[2],
    vfxQuality: plan.productionExecution,
    largeFormatPositioning: plan.conceptCommerciality,
  });
  const campaigns = new Map(
    Array.from(prepared.campaigns.entries())
      .map(([code, state]) => [code, { ...state }]),
  );

  const weeklyWorldwide: number[] = [];
  let imaxGross = 0;
  let dolbyGross = 0;
  let peakEventPotential = 0;
  let peakEventIntensity = 0;
  let peakPhenomenonPotential = 0;
  let peakPhenomenonIntensity = 0;
  let openingDemandAdmissions = 0;
  let openingAdmissions = 0;
  let domesticGross = 0;
  const previousGrosses = new Map<string, number>();
  for (let weekNumber = 0; weekNumber < 16; weekNumber += 1) {
    let worldwideGross = 0;
    for (const territory of BOX_OFFICE_COUNTRIES) {
      const exhibition = getTerritoryExhibitionProfile(territory.code);
      const campaign = campaigns.get(territory.code)!;
      const commonInput = {
        territoryCode: territory.code,
        territoryMarketShare: territory.percentage,
        genre: plan.genre,
        productionScale,
        blockbusterDeployment: plan.blockbusterDeployment ?? 0,
        commercialAppeal: plan.conceptCommerciality,
        launchHook,
        releaseTiming: plan.releaseTiming,
        competition: plan.competition,
        audienceExperience,
        campaign,
        openingExpectation: prepared.openingExpectations.get(territory.code) ??
          campaign.expectation,
        weekNumber,
        previousWeekGross: previousGrosses.get(territory.code) || 0,
        baseTicketPrice: exhibition.baseTicketPrice,
        imaxTicketPrice: exhibition.imaxTicketPrice,
        dolbyTicketPrice: exhibition.dolbyTicketPrice,
        regularCapacityAdmissions: exhibition.regularOpeningAdmissions,
        imaxSuitability: formatProfile.imaxSuitability,
        dolbySuitability: formatProfile.dolbySuitability,
        demandVariance: uniform(rng, 0.82, 1.18),
      };
      const preliminary = simulateTerritoryWeek({
        ...commonInput,
        imaxAllocationAdmissions: Number.MAX_SAFE_INTEGER,
        dolbyAllocationAdmissions: Number.MAX_SAFE_INTEGER,
      });
      const imaxAllocation = allocatePremiumFormat({
        format: "imax",
        territorySupply: exhibition.imaxAdmissions,
        candidates: [{
          filmId: "film",
          formatDemand: preliminary.imaxDemandAdmissions,
          suitability: formatProfile.imaxSuitability,
          accessLevel: formatProfile.imaxSuitability >= 68 ? "priority" : "standard",
          isOpeningWeek: weekNumber === 0,
        }],
      })[0]?.allocatedAdmissions || 0;
      const dolbyAllocation = allocatePremiumFormat({
        format: "dolby",
        territorySupply: exhibition.dolbyAdmissions,
        candidates: [{
          filmId: "film",
          formatDemand: preliminary.dolbyDemandAdmissions,
          suitability: formatProfile.dolbySuitability,
          accessLevel: formatProfile.dolbySuitability >= 68 ? "priority" : "standard",
          isOpeningWeek: weekNumber === 0,
        }],
      })[0]?.allocatedAdmissions || 0;
      const result = simulateTerritoryWeek({
        ...commonInput,
        imaxAllocationAdmissions: imaxAllocation,
        dolbyAllocationAdmissions: dolbyAllocation,
      });
      worldwideGross += result.gross;
      if (territory.code === "NA") domesticGross += result.gross;
      imaxGross += result.imaxGross;
      dolbyGross += result.dolbyGross;
      peakEventPotential = Math.max(peakEventPotential, result.eventPotential);
      peakEventIntensity = Math.max(peakEventIntensity, result.eventIntensity);
      peakPhenomenonPotential = Math.max(
        peakPhenomenonPotential,
        result.phenomenonPotential,
      );
      peakPhenomenonIntensity = Math.max(
        peakPhenomenonIntensity,
        result.phenomenonIntensity,
      );
      if (weekNumber === 0) {
        openingDemandAdmissions += result.totalDemandAdmissions;
        openingAdmissions += result.regularAdmissions +
          result.imaxAdmissions + result.dolbyAdmissions;
      }
      previousGrosses.set(territory.code, result.gross);
      campaigns.set(territory.code, advanceCampaignWeek(campaign, {
        isReleased: true,
        audienceExperience,
        openingExpectation: prepared.openingExpectations.get(territory.code) ??
          campaign.expectation,
        criticScore,
        earnedMediaShock: uniform(rng, -0.2, 0.2),
      }));
    }
    weeklyWorldwide.push(worldwideGross);
    if (weekNumber >= 3 && worldwideGross < 90_000) break;
  }
  const totalGross = weeklyWorldwide.reduce((sum, gross) => sum + gross, 0);
  const openingWeekend = weeklyWorldwide[0] || 0;
  return {
    openingWeekend,
    totalGross,
    legsMultiplier: openingWeekend > 0 ? totalGross / openingWeekend : 0,
    imaxGross,
    dolbyGross,
    eventPotential: peakEventPotential,
    eventIntensity: peakEventIntensity,
    phenomenonPotential: peakPhenomenonPotential,
    phenomenonIntensity: peakPhenomenonIntensity,
    openingDemandAdmissions,
    openingAdmissions,
    domesticGross,
  };
}

function qualityInputForPlan(
  plan: Plan,
  audienceExpectation: number,
) {
  return {
    genre: plan.genre,
    productionBudget: plan.productionBudget,
    scriptQuality: plan.scriptQuality,
    cinematographyQuality: plan.cinematographyQuality,
    director: plan.director,
    writer: plan.writer,
    cast: plan.cast,
    cinematographer: plan.specialists[0],
    editor: plan.specialists[1],
    composer: plan.specialists[2],
    departmentBudgets: plan.departmentBudgets,
    conceptFit: plan.conceptFit,
    productionExecution: plan.productionExecution,
    franchiseFamiliarity: plan.franchiseAwareness > 0
      ? Math.max(50, plan.franchiseAwareness)
      : 50,
    audienceExpectation,
  };
}

function observePlan(
  plan: Plan,
  rng: RandomSource,
  isTentpole = false,
): Observation {
  const prepared = prepareCampaign(plan, rng);
  const quality = simulateFilmQuality(
    qualityInputForPlan(plan, prepared.marketWeightedExpectation),
    rng,
  );
  const boxOffice = simulateCampaignRun(
    plan,
    quality.audienceExperienceScore100,
    quality.criticScore,
    prepared,
    rng,
  );
  const spend = plan.productionBudget + plan.marketingBudget;
  // Match the live game's simplified theatrical settlement.
  const profit = boxOffice.totalGross * 0.7 - spend;
  return {
    genre: plan.genre,
    productionBudget: plan.productionBudget,
    isTentpole,
    critic: quality.criticScore,
    audience: quality.audienceScore100,
    audienceExperience: quality.audienceExperienceScore100,
    expectation: quality.reception.audienceExpectation,
    expectationModifier: quality.reception.expectationModifier,
    deliveryGap: quality.reception.deliveryGap,
    preferenceGap:
      quality.reception.criticPreferenceDelta +
      quality.reception.criticGenrePrior -
      quality.reception.audiencePreferenceDelta -
      quality.reception.audienceGenrePrior,
    structuralGap: quality.expectedCriticScore - quality.expectedAudienceScore,
    randomGap: quality.uncertainty.randomGap,
    gross: boxOffice.totalGross,
    internationalShare: boxOffice.totalGross > 0
      ? 1 - boxOffice.domesticGross / boxOffice.totalGross
      : 0,
    opening: boxOffice.openingWeekend,
    legs: boxOffice.legsMultiplier,
    spend,
    profit,
    badFilm: quality.isBadFilm,
    perfect: quality.isPerfectScore,
    criticPerfect: quality.isCriticPerfect,
    audiencePerfect: quality.isAudiencePerfect,
    imaxGross: boxOffice.imaxGross,
    dolbyGross: boxOffice.dolbyGross,
    eventPotential: boxOffice.eventPotential,
    eventIntensity: boxOffice.eventIntensity,
    phenomenonPotential: boxOffice.phenomenonPotential,
    phenomenonIntensity: boxOffice.phenomenonIntensity,
    openingDemandAdmissions: boxOffice.openingDemandAdmissions,
    openingAdmissions: boxOffice.openingAdmissions,
  };
}

function runFilm(cohort: CohortName, rng: RandomSource): Observation {
  return observePlan(generatePlan(cohort, rng), rng);
}

const mean = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * fraction)))] ?? 0;
}

const rate = (items: readonly Observation[], predicate: (item: Observation) => boolean): number =>
  items.filter(predicate).length / Math.max(1, items.length);

function pearson(left: readonly number[], right: readonly number[]): number {
  const count = Math.min(left.length, right.length);
  if (count === 0) return 0;
  const leftMean = mean(left.slice(0, count));
  const rightMean = mean(right.slice(0, count));
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < count; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  return covariance / Math.max(0.000001, Math.sqrt(leftVariance * rightVariance));
}

const sameDirection = (left: number, right: number): boolean =>
  Math.abs(left) < 0.5 || Math.abs(right) < 0.5
    ? Math.abs(left - right) < 1
    : Math.sign(left) === Math.sign(right);

const money = (value: number): string => `$${(value / 1_000_000).toFixed(1)}M`;
const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
const tailPercent = (value: number): string =>
  `${(value * 100).toFixed(value < 0.001 ? 4 : 2)}%`;

function recordBreaksAfterWarmup(observations: readonly Observation[]): number {
  const warmupCount = Math.min(observations.length - 1, Math.max(100, Math.floor(observations.length * 0.2)));
  let record = Math.max(...observations.slice(0, warmupCount).map(item => item.gross));
  let breaks = 0;
  for (const observation of observations.slice(warmupCount)) {
    if (observation.gross > record) {
      record = observation.gross;
      breaks += 1;
    }
  }
  return breaks;
}

function report(cohort: string, observations: readonly Observation[]): void {
  const critics = observations.map((item) => item.critic);
  const audiences = observations.map((item) => item.audience);
  const grosses = observations.map((item) => item.gross);
  const openings = observations.map((item) => item.opening);
  const legs = observations.map((item) => item.legs);
  const profits = observations.map((item) => item.profit);
  const imaxGrosses = observations.map((item) => item.imaxGross);
  const dolbyGrosses = observations.map((item) => item.dolbyGross);
  const recordGross = observations.reduce((best, item) => item.gross > best.gross ? item : best);
  const thresholdRate = (threshold: number) =>
    percent(rate(observations, item => item.critic >= threshold));
  const gaps = observations.map(item => item.critic - item.audience);
  const absoluteGaps = gaps.map(Math.abs);
  const explainedLargeGaps = observations.filter(item =>
    Math.abs(item.critic - item.audience) >= 10);
  const eventFilms = observations.filter(item => item.eventIntensity >= 0.1);
  const phenomena = observations.filter(item =>
    item.phenomenonIntensity >= 0.1 && item.eventIntensity < 0.1);

  console.log(`\n${cohort.toUpperCase()} (${observations.length.toLocaleString()} films)`);
  console.log(
    `Scores  critic mean/median/p10/p90: ${mean(critics).toFixed(1)} / ` +
    `${percentile(critics, 0.5)} / ${percentile(critics, 0.1)} / ${percentile(critics, 0.9)}`,
  );
  console.log(
    `        audience mean: ${mean(audiences).toFixed(1)} | <40: ` +
    `${percent(rate(observations, (item) => item.critic < 40))} | ` +
    `70+: ${thresholdRate(70)} | 80+: ${thresholdRate(80)} | 90+: ${thresholdRate(90)} | ` +
    `95+: ${thresholdRate(95)} | 100: ${thresholdRate(100)}`,
  );
  console.log(
    `Relation Pearson: ${pearson(critics, audiences).toFixed(3)} | mean |gap|: ` +
    `${mean(absoluteGaps).toFixed(1)} | ≤5: ` +
    `${percent(rate(observations, item => Math.abs(item.critic - item.audience) <= 5))} | ` +
    `5–10: ${percent(rate(observations, item => {
      const gap = Math.abs(item.critic - item.audience);
      return gap > 5 && gap < 10;
    }))} | 10–20: ${percent(rate(observations, item => {
      const gap = Math.abs(item.critic - item.audience);
      return gap >= 10 && gap < 20;
    }))} | 20+: ${percent(rate(observations, item =>
      Math.abs(item.critic - item.audience) >= 20))}`,
  );
  console.log(
    `        critic +10: ${percent(rate(observations, item =>
      item.critic - item.audience >= 10))} | audience +10: ` +
    `${percent(rate(observations, item => item.audience - item.critic >= 10))} | ` +
    `joint 80+: ${percent(rate(observations, item =>
      item.critic >= 80 && item.audience >= 80))} | joint <40: ` +
    `${percent(rate(observations, item => item.critic < 40 && item.audience < 40))}`,
  );
  console.log(
    `Explain predicted/realized gap direction: ${percent(rate(observations, item =>
      sameDirection(item.structuralGap, item.critic - item.audience)))} | ` +
    `10+ gaps structure-dominant: ${percent(rate(explainedLargeGaps, item =>
      Math.abs(item.structuralGap) >= Math.abs(item.randomGap)))} | ` +
    `mean preference/expectation/random gap: ${mean(observations.map(item =>
      item.preferenceGap)).toFixed(1)} / ${mean(observations.map(item =>
      -item.expectationModifier)).toFixed(1)} / ${mean(observations.map(item =>
      item.randomGap)).toFixed(1)}`,
  );
  console.log(
    `Perfect critic/audience/joint: ${percent(rate(observations, item =>
      item.criticPerfect))} / ${percent(rate(observations, item =>
      item.audiencePerfect))} / ${percent(rate(observations, item =>
      item.criticPerfect && item.audiencePerfect))}`,
  );
  console.log(
    `Gross   mean/median/p90/p95/p99/p99.9/max: ${money(mean(grosses))} / ${money(percentile(grosses, 0.5))} / ` +
    `${money(percentile(grosses, 0.9))} / ${money(percentile(grosses, 0.95))} / ` +
    `${money(percentile(grosses, 0.99))} / ` +
    `${money(percentile(grosses, 0.999))} / ${money(Math.max(...grosses))} | opening median: ${money(percentile(openings, 0.5))}`,
  );
  console.log(
    `Records max gross: ${money(recordGross.gross)} (critic ${recordGross.critic}, ` +
    `audience ${recordGross.audience.toFixed(1)}, legs ${recordGross.legs.toFixed(2)}) | ` +
    `post-warmup new records: ${recordBreaksAfterWarmup(observations)} | ` +
    `max critic: ${Math.max(...critics)} | max opening: ${money(Math.max(...openings))}`,
  );
  console.log(
    `Economy profitable: ${percent(rate(observations, (item) => item.profit > 0))} | ` +
    `>$100M: ${percent(rate(observations, (item) => item.gross >= 100_000_000))} | ` +
    `>$500M: ${percent(rate(observations, (item) => item.gross >= 500_000_000))} | ` +
    `>$1B: ${percent(rate(observations, (item) => item.gross >= 1_000_000_000))} | ` +
    `>$1.5B: ${percent(rate(observations, (item) => item.gross >= 1_500_000_000))} | ` +
    `>$2B: ${percent(rate(observations, (item) => item.gross >= 2_000_000_000))} | ` +
    `>$2.5B: ${percent(rate(observations, (item) => item.gross >= 2_500_000_000))} | ` +
    `bad-film flag: ${percent(rate(observations, (item) => item.badFilm))} | ` +
    `median legs: ${percentile(legs, 0.5).toFixed(2)} | median net: ${money(percentile(profits, 0.5))}`,
  );
  console.log(
    `Tail    event films: ${tailPercent(eventFilms.length / observations.length)} ` +
    `(${eventFilms.length}) | cultural phenomena: ` +
    `${tailPercent(phenomena.length / observations.length)} (${phenomena.length}) | ` +
    `max event/phenomenon potential: ${Math.max(...observations.map(item =>
      item.eventPotential)).toFixed(1)}/${Math.max(...observations.map(item =>
      item.phenomenonPotential)).toFixed(1)} | ` +
    `opening demand converted: ${percent(mean(observations.map(item =>
      item.openingAdmissions / Math.max(1, item.openingDemandAdmissions))))}`,
  );
  console.log(
    `Formats mean IMAX/Dolby gross: ${money(mean(imaxGrosses))} / ${money(mean(dolbyGrosses))} | ` +
    `event potential p99/max: ${percentile(observations.map(item => item.eventPotential), 0.99).toFixed(1)} / ` +
    `${Math.max(...observations.map(item => item.eventPotential)).toFixed(1)}`,
  );
}

function reportGenreRelationships(observations: readonly Observation[]): void {
  console.log("\nGENRE RECEPTION RELATIONSHIPS");
  for (const genre of SIMULATION_GENRES) {
    const items = observations.filter(item => item.genre === genre);
    const critics = items.map(item => item.critic);
    const audiences = items.map(item => item.audience);
    console.log(
      `${genre.padEnd(10)} n=${String(items.length).padStart(5)} ` +
      `critic/audience ${mean(critics).toFixed(1)}/${mean(audiences).toFixed(1)} ` +
      `r=${pearson(critics, audiences).toFixed(2)} ` +
      `|gap|=${mean(items.map(item =>
        Math.abs(item.critic - item.audience))).toFixed(1)} ` +
      `critic+10=${percent(rate(items, item => item.critic - item.audience >= 10))} ` +
      `audience+10=${percent(rate(items, item => item.audience - item.critic >= 10))}`,
    );
  }
}

function parseCount(): number {
  const countArgument = process.argv.find((argument) => argument.startsWith("--count="));
  const parsed = Number(countArgument?.split("=")[1] ?? 5_000);
  return Number.isFinite(parsed) ? Math.max(100, Math.floor(parsed)) : 5_000;
}

function scenarioTalent(
  genre: SimulationGenre,
  performance: number,
  fame: number,
  fit: number,
): TalentLike {
  return {
    performance,
    experience: performance,
    fame,
    popularity: fame,
    genres: { [genre]: fit },
  };
}

function scenarioInput(options: {
  genre: SimulationGenre;
  creative: number;
  performance: number;
  fame: number;
  fit: number;
  budgetRatio: number;
  execution: number;
  familiarity: number;
  expectation: number;
}) {
  const balance = resolveGenre(options.genre);
  const productionBudget = balance.viableBudget * options.budgetRatio;
  const person = () => scenarioTalent(
    options.genre,
    options.performance,
    options.fame,
    options.fit,
  );
  const departmentBudget = productionBudget * 0.055 *
    Math.max(0.15, options.execution / 62);
  return {
    genre: options.genre,
    productionBudget,
    scriptQuality: options.creative,
    cinematographyQuality: options.creative,
    director: person(),
    writer: person(),
    cast: [person(), person(), person()],
    cinematographer: person(),
    editor: person(),
    composer: person(),
    vfxQuality: options.execution,
    vfxGenreFit: options.fit,
    departmentBudgets: {
      sets: departmentBudget,
      costumes: departmentBudget,
      stunts: departmentBudget,
      makeup: departmentBudget,
      practicalEffects: departmentBudget,
      sound: departmentBudget,
    },
    conceptFit: options.fit,
    productionExecution: options.execution,
    franchiseFamiliarity: options.familiarity,
    audienceExpectation: options.expectation,
  };
}

function reportReceptionScenarios(seed: string): void {
  const craft = simulateFilmQuality(scenarioInput({
    genre: "drama",
    creative: 96,
    performance: 94,
    fame: 24,
    fit: 94,
    budgetRatio: 0.8,
    execution: 93,
    familiarity: 30,
    expectation: 68,
  }), createSeededRng(`${seed}:critic-craft`));
  const spectacle = simulateFilmQuality(scenarioInput({
    genre: "action",
    creative: 44,
    performance: 58,
    fame: 97,
    fit: 91,
    budgetRatio: 2.8,
    execution: 98,
    familiarity: 96,
    expectation: 78,
  }), createSeededRng(`${seed}:audience-spectacle`));
  const acclaim = simulateFilmQuality(scenarioInput({
    genre: "animation",
    creative: 97,
    performance: 96,
    fame: 88,
    fit: 97,
    budgetRatio: 1.3,
    execution: 97,
    familiarity: 88,
    expectation: 87,
  }), createSeededRng(`${seed}:universal-acclaim`));
  const rejection = simulateFilmQuality(scenarioInput({
    genre: "comedy",
    creative: 20,
    performance: 24,
    fame: 22,
    fit: 18,
    budgetRatio: 0.18,
    execution: 20,
    familiarity: 20,
    expectation: 55,
  }), createSeededRng(`${seed}:universal-rejection`));
  const expectationBase = scenarioInput({
    genre: "thriller",
    creative: 78,
    performance: 76,
    fame: 58,
    fit: 82,
    budgetRatio: 0.9,
    execution: 80,
    familiarity: 45,
    expectation: 90,
  });
  const overhype = simulateFilmQuality(
    expectationBase,
    createSeededRng(`${seed}:expectation-pair`),
  );
  const sleeper = simulateFilmQuality(
    { ...expectationBase, audienceExpectation: 45 },
    createSeededRng(`${seed}:expectation-pair`),
  );

  if (craft.reception.criticPreferenceDelta <=
      craft.reception.audiencePreferenceDelta) {
    throw new Error("Critic-oriented craft scenario did not favor the critic lens");
  }
  if (spectacle.reception.audiencePreferenceDelta <=
      spectacle.reception.criticPreferenceDelta) {
    throw new Error("Audience-oriented spectacle scenario did not favor the audience lens");
  }
  if (acclaim.criticScore < 75 || acclaim.audienceScore100 < 75) {
    throw new Error("Universal-acclaim scenario failed to produce joint approval");
  }
  if (rejection.criticScore >= 50 || rejection.audienceScore100 >= 50) {
    throw new Error("Universal-rejection scenario failed to produce joint rejection");
  }
  if (overhype.audienceExperienceScore100 !== sleeper.audienceExperienceScore100 ||
      overhype.audienceScore100 >= sleeper.audienceScore100) {
    throw new Error("Expectation response altered intrinsic experience or used the wrong direction");
  }

  const openingInput = {
    territoryCode: "NA",
    territoryMarketShare: 0.35,
    genre: "thriller",
    productionScale: 70,
    commercialAppeal: 68,
    launchHook: 60,
    releaseTiming: 65,
    competition: 35,
    audienceExperience: sleeper.audienceExperienceScore100,
    campaign: createInitialCampaignState(72, 68, 50),
    weekNumber: 0,
    baseTicketPrice: 12,
    imaxTicketPrice: 21,
    dolbyTicketPrice: 19,
    regularCapacityAdmissions: 20_000_000,
    imaxAllocationAdmissions: 1_000_000,
    dolbyAllocationAdmissions: 1_000_000,
    imaxSuitability: 55,
    dolbySuitability: 72,
    demandVariance: 1,
  };
  const sleeperOpening = simulateTerritoryWeek({
    ...openingInput,
    openingExpectation: 45,
  });
  const hypedOpening = simulateTerritoryWeek({
    ...openingInput,
    openingExpectation: 90,
  });
  if (sleeperOpening.gross !== hypedOpening.gross ||
      sleeperOpening.eventPotential !== hypedOpening.eventPotential) {
    throw new Error("Opening demand changed when only audience expectation changed");
  }
  const sleeperSecondWeek = simulateTerritoryWeek({
    ...openingInput,
    openingExpectation: 45,
    weekNumber: 1,
    previousWeekGross: sleeperOpening.gross,
  });
  const hypedSecondWeek = simulateTerritoryWeek({
    ...openingInput,
    openingExpectation: 90,
    weekNumber: 1,
    previousWeekGross: hypedOpening.gross,
  });
  if (sleeperSecondWeek.retention <= hypedSecondWeek.retention) {
    throw new Error("Expectation delivery gap did not improve sleeper retention");
  }

  const summary = (
    name: string,
    result: ReturnType<typeof simulateFilmQuality>,
  ) => `${name} C/A/experience ${result.criticScore}/` +
    `${result.audienceScore100.toFixed(1)}/` +
    `${result.audienceExperienceScore100.toFixed(1)} ` +
    `(lens Δ ${result.reception.criticPreferenceDelta.toFixed(1)}/` +
    `${result.reception.audiencePreferenceDelta.toFixed(1)}, ` +
    `expectation Δ ${result.reception.expectationModifier.toFixed(1)})`;
  console.log("\nRECEPTION SCENARIOS");
  console.log(summary("Critic craft", craft));
  console.log(summary("Audience spectacle", spectacle));
  console.log(summary("Universal acclaim", acclaim));
  console.log(summary("Universal rejection", rejection));
  console.log(summary("Overhype", overhype));
  console.log(summary("Sleeper", sleeper));
  console.log(
    `Expectation invariant opening ${money(sleeperOpening.gross)} both; ` +
    `week-two retention sleeper/hyped ` +
    `${sleeperSecondWeek.retention.toFixed(3)}/${hypedSecondWeek.retention.toFixed(3)}`,
  );
}

function reportSystemMechanics(): void {
  const actionInput = {
    territoryMarketShare: 0.35,
    territoryFit: 1,
    targetingFit: 1,
    weeksFromRelease: 8,
    creativeStrength: 70,
  };
  const first20 = applyCampaignAction({
    ...actionInput,
    state: createInitialCampaignState(),
    action: "broad-awareness",
    spend: 20_000_000,
  }, createSeededRng("marketing-efficiency"));
  const first120 = applyCampaignAction({
    ...actionInput,
    state: createInitialCampaignState(),
    action: "broad-awareness",
    spend: 120_000_000,
  }, createSeededRng("marketing-efficiency"));
  const next20 = applyCampaignAction({
    ...actionInput,
    state: first120.state,
    action: "broad-awareness",
    spend: 20_000_000,
  }, createSeededRng("marketing-efficiency"));
  const earlyLift = first20.state.awareness - 8;
  const lateLift = next20.state.awareness - first120.state.awareness;
  if (lateLift >= earlyLift) {
    throw new Error("Marketing diminishing-returns invariant failed");
  }

  const allocations = allocatePremiumFormat({
    format: "imax",
    territorySupply: 1_000_000,
    candidates: [
      {
        filmId: "exclusive",
        formatDemand: 600_000,
        suitability: 95,
        accessLevel: "exclusive",
        isOpeningWeek: true,
      },
      {
        filmId: "challenger",
        formatDemand: 1_000_000,
        suitability: 90,
        accessLevel: "priority",
        isOpeningWeek: true,
      },
    ],
    activeBookings: [{
      filmId: "exclusive",
      format: "imax",
      territoryCode: "NA",
      accessLevel: "exclusive",
      startWeek: 1,
      startYear: 2025,
      durationWeeks: 2,
      status: "secured",
    }],
  });
  const allocated = allocations.reduce((sum, item) => sum + item.allocatedAdmissions, 0);
  if (allocated > 1_000_000.01) {
    throw new Error("Premium capacity invariant failed");
  }
  const noDemand = simulateTerritoryWeek({
    territoryCode: "NA",
    territoryMarketShare: 0.35,
    genre: "scifi",
    productionScale: 100,
    commercialAppeal: 100,
    launchHook: 100,
    releaseTiming: 100,
    competition: 0,
    audienceExperience: 100,
    campaign: createInitialCampaignState(0, 0, 50),
    openingExpectation: 50,
    weekNumber: 0,
    baseTicketPrice: 12,
    imaxTicketPrice: 21,
    dolbyTicketPrice: 19,
    regularCapacityAdmissions: 20_000_000,
    imaxAllocationAdmissions: 2_000_000,
    dolbyAllocationAdmissions: 2_000_000,
    imaxSuitability: 100,
    dolbySuitability: 100,
  });
  if (noDemand.gross !== 0) {
    throw new Error("Premium formats created demand without awareness or interest");
  }
  console.log("\nSYSTEM MECHANICS");
  console.log(
    `Marketing awareness lift $0→$20M: ${earlyLift.toFixed(1)}; ` +
    `$120M→$140M: ${lateLift.toFixed(1)}`,
  );
  console.log(
    `IMAX exclusive scenario allocated ${(allocated / 1_000_000).toFixed(2)}M of 1.00M; ` +
    `unused exclusive capacity remains blocked; no-demand premium gross $0`,
  );
}

function reportEventScenarios(seed: string): void {
  const eventRng = createSeededRng(`${seed}:event-scenarios`);
  const eventPlan = makePlan(eventRng, skilledProfile, "scifi");
  Object.assign(eventPlan, {
    productionBudget: 325_000_000,
    marketingBudget: 285_000_000,
    conceptCommerciality: 96,
    productionExecution: 94,
    releaseTiming: 96,
    competition: 4,
    franchiseAwareness: 97,
    scriptQuality: 88,
    cinematographyQuality: 96,
  });
  eventPlan.cast = eventPlan.cast.map(person => ({
    ...person,
    fame: 96,
    popularity: 95,
    performance: 92,
  }));
  const eventCampaign = prepareCampaign(eventPlan, eventRng);
  const megaEvent = simulateCampaignRun(eventPlan, 98, 92, eventCampaign, eventRng);

  const phenomenonRng = createSeededRng(`${seed}:phenomenon-scenario`);
  const phenomenonPlan = makePlan(phenomenonRng, averageProfile, "horror");
  Object.assign(phenomenonPlan, {
    productionBudget: 18_000_000,
    marketingBudget: 7_000_000,
    conceptCommerciality: 68,
    productionExecution: 84,
    releaseTiming: 58,
    competition: 36,
    franchiseAwareness: 0,
  });
  const phenomenonCampaign = prepareCampaign(phenomenonPlan, phenomenonRng);
  const phenomenon = simulateCampaignRun(
    phenomenonPlan,
    98,
    84,
    phenomenonCampaign,
    phenomenonRng,
  );
  if (megaEvent.eventIntensity < 0.1 || megaEvent.totalGross < 1_000_000_000) {
    throw new Error("Elite anticipated event failed to unlock event capacity");
  }
  if (phenomenon.phenomenonIntensity < 0.1 ||
      phenomenon.openingWeekend >= 100_000_000 ||
      phenomenon.totalGross < phenomenon.openingWeekend * 8 ||
      phenomenon.totalGross > phenomenon.openingWeekend * 15) {
    throw new Error("Sleeper success failed to emerge through organic expansion");
  }
  console.log("\nEVENT SCENARIOS");
  console.log(
    `Mega-event opening/total/event potential: ${money(megaEvent.openingWeekend)} / ` +
    `${money(megaEvent.totalGross)} / ${megaEvent.eventPotential.toFixed(1)}`,
  );
  console.log(
    `Under-marketed phenomenon opening/total/legs: ${money(phenomenon.openingWeekend)} / ` +
    `${money(phenomenon.totalGross)} / ${phenomenon.legsMultiplier.toFixed(2)} ` +
    `(potential ${phenomenon.phenomenonPotential.toFixed(1)}, ` +
    `intensity ${phenomenon.phenomenonIntensity.toFixed(3)})`,
  );
}

const liveStudioProfiles = [
  { id: "universal", name: "Universal Pictures", strategy: "balanced" },
  { id: "disney", name: "The Walt Disney Company", strategy: "animation" },
  { id: "warner", name: "Warner Bros. Discovery", strategy: "action" },
  { id: "paramount", name: "Paramount Pictures", strategy: "balanced" },
  { id: "sony", name: "Sony Pictures", strategy: "comedy" },
  { id: "netflix", name: "Netflix Studios", strategy: "drama" },
  { id: "amazon", name: "Amazon Studios", strategy: "scifi" },
] as const;

interface LiveSlateState {
  projectIndex: number;
  activeTentpoleDurations: number[][];
}

function generateLiveAIPlan(
  rng: RandomSource,
  state: LiveSlateState,
): { plan: Plan; isTentpole: boolean } {
  const studioIndex = state.projectIndex % liveStudioProfiles.length;
  state.projectIndex += 1;
  const studio = liveStudioProfiles[studioIndex];
  const activeDurations = state.activeTentpoleDurations[studioIndex]
    .map(duration => duration - 1)
    .filter(duration => duration > 0);
  state.activeTentpoleDurations[studioIndex] = activeDurations;

  const profile = createStudioDecisionProfile({
    ...studio,
    prestigeLevel: 1,
  });
  const genre = selectAIGenre(
    [...SIMULATION_GENRES],
    profile,
    {},
    () => rng.next(),
  ) as SimulationGenre;
  // Mature AI studios span the cash positions seen in long-running live saves.
  // The lower tail naturally fails the affordability gate for $170M productions.
  const availableBudget = uniform(rng, 260_000_000, 1_000_000_000);
  const productionPlan = selectAIProductionBudget(
    genre,
    availableBudget,
    profile,
    () => rng.next(),
    activeDurations.length < 2,
  );
  if (productionPlan.isTentpole) {
    activeDurations.push(Math.floor(uniform(rng, 6, 9)));
  }
  const blockbusterDeployment = getBlockbusterDeployment(
    genre,
    productionPlan.productionBudget,
    profile,
  );
  const castResponse = Math.pow(blockbusterDeployment, 0.62);
  const projectProfile = createBlockbusterDecisionProfile(
    profile,
    blockbusterDeployment,
  );
  const plan = makePlan(
    rng,
    heuristicProfile,
    genre,
  );
  plan.productionBudget = productionPlan.productionBudget;
  plan.blockbusterDeployment = blockbusterDeployment;
  plan.departmentBudgets = departments(
    rng,
    plan.productionBudget,
    0.35 + 0.40 * blockbusterDeployment,
    1.15 + 0.20 * blockbusterDeployment,
  );
  const departmentSpend = Object.values(plan.departmentBudgets)
    .reduce((sum, amount) => sum + Number(amount || 0), 0);
  const approximateTalentSpend = plan.productionBudget *
    (0.14 + 0.08 * castResponse);
  plan.marketingBudget = (
    plan.productionBudget + departmentSpend + approximateTalentSpend
  ) * calculateAIMarketingRatio(
    projectProfile,
    blockbusterDeployment,
    () => rng.next(),
  );
  // Live territory simulation uses the genre's real appeal rather than a
  // synthetic premise score. Tentpoles primarily distinguish themselves via
  // scale, campaign, cast draw, timing, and premium readiness.
  plan.conceptCommerciality = resolveGenre(genre).baseCommercialAppeal;
  plan.franchiseAwareness = 0;
  plan.cast = plan.cast.map(person => ({
    ...person,
    fame: Number(person.fame ?? 50) * (1 - castResponse) +
      uniform(rng, 68, 98) * castResponse,
    popularity: Number(person.popularity ?? 50) * (1 - castResponse) +
      uniform(rng, 66, 98) * castResponse,
  }));
  const releaseResponse = blockbusterDeployment * blockbusterDeployment *
    (3 - 2 * blockbusterDeployment);
  const preferredTiming = Math.max(plan.releaseTiming, uniform(rng, 58, 94));
  const preferredCompetition = Math.min(plan.competition, uniform(rng, 5, 58));
  plan.releaseTiming += (preferredTiming - plan.releaseTiming) * releaseResponse;
  plan.competition += (preferredCompetition - plan.competition) * releaseResponse;
  return { plan, isTentpole: productionPlan.isTentpole };
}

interface NumericBucket {
  label: string;
  minimum: number;
  maximum: number;
}

function inBucket(value: number, bucket: NumericBucket): boolean {
  return value >= bucket.minimum && value < bucket.maximum;
}

function reportUpperTailDiagnostics(observations: readonly Observation[]): void {
  const grossBuckets: NumericBucket[] = [
    { label: "<$100M", minimum: 0, maximum: 100_000_000 },
    { label: "$100–250M", minimum: 100_000_000, maximum: 250_000_000 },
    { label: "$250–500M", minimum: 250_000_000, maximum: 500_000_000 },
    { label: "$500–750M", minimum: 500_000_000, maximum: 750_000_000 },
    { label: "$750M–$1B", minimum: 750_000_000, maximum: 1_000_000_000 },
    { label: "$1–1.25B", minimum: 1_000_000_000, maximum: 1_250_000_000 },
    { label: "$1.25–1.5B", minimum: 1_250_000_000, maximum: 1_500_000_000 },
    { label: "$1.5–2B", minimum: 1_500_000_000, maximum: 2_000_000_000 },
    { label: "$2–2.5B", minimum: 2_000_000_000, maximum: 2_500_000_000 },
    { label: "$2.5B+", minimum: 2_500_000_000, maximum: Infinity },
  ];
  console.log(`\nLIVE AI UPPER-TAIL DIAGNOSTICS (${observations.length.toLocaleString()} films)`);
  console.log("Gross bucket       n       share   event>0  event≥.10 tentpole  intensity med/p90  opening med/p90  intl  legs med/p90");
  for (const bucket of grossBuckets) {
    const items = observations.filter(item => inBucket(item.gross, bucket));
    const eventTransition = rate(items, item => item.eventIntensity > 0);
    const qualifiedEvents = rate(items, item => item.eventIntensity >= 0.1);
    console.log(
      `${bucket.label.padEnd(16)} ${String(items.length).padStart(7)} ` +
      `${percent(items.length / observations.length).padStart(8)} ` +
      `${percent(eventTransition).padStart(8)} ${percent(qualifiedEvents).padStart(9)} ` +
      `${percent(rate(items, item => item.isTentpole)).padStart(8)} ` +
      `${percentile(items.map(item => item.eventIntensity), 0.5).toFixed(3)}/` +
      `${percentile(items.map(item => item.eventIntensity), 0.9).toFixed(3)} ` +
      `${money(percentile(items.map(item => item.opening), 0.5))}/` +
      `${money(percentile(items.map(item => item.opening), 0.9))} ` +
      `${percent(percentile(items.map(item => item.internationalShare), 0.5))} ` +
      `${percentile(items.map(item => item.legs), 0.5).toFixed(2)}/` +
      `${percentile(items.map(item => item.legs), 0.9).toFixed(2)}`,
    );
  }

  const intensityBuckets: NumericBucket[] = [
    { label: "0", minimum: 0, maximum: Number.EPSILON },
    { label: "0–.025", minimum: Number.EPSILON, maximum: 0.025 },
    { label: ".025–.05", minimum: 0.025, maximum: 0.05 },
    { label: ".05–.10", minimum: 0.05, maximum: 0.1 },
    { label: ".10–.15", minimum: 0.1, maximum: 0.15 },
    { label: ".15–.20", minimum: 0.15, maximum: 0.2 },
    { label: ".20–.25", minimum: 0.2, maximum: 0.25 },
    { label: ".25–.30", minimum: 0.25, maximum: 0.3 },
    { label: ".30 cap", minimum: 0.3, maximum: Infinity },
  ];
  console.log("\nEvent transition by intensity");
  console.log("Intensity       n      potential med/p90  gross med/p90     opening med  intl   legs  $500M+  $1B+");
  for (const bucket of intensityBuckets) {
    const items = observations.filter(item => inBucket(item.eventIntensity, bucket));
    console.log(
      `${bucket.label.padEnd(12)} ${String(items.length).padStart(7)} ` +
      `${percentile(items.map(item => item.eventPotential), 0.5).toFixed(1)}/` +
      `${percentile(items.map(item => item.eventPotential), 0.9).toFixed(1)} ` +
      `${money(percentile(items.map(item => item.gross), 0.5))}/` +
      `${money(percentile(items.map(item => item.gross), 0.9))} ` +
      `${money(percentile(items.map(item => item.opening), 0.5))} ` +
      `${percent(percentile(items.map(item => item.internationalShare), 0.5))} ` +
      `${percentile(items.map(item => item.legs), 0.5).toFixed(2)} ` +
      `${percent(rate(items, item => item.gross >= 500_000_000))} ` +
      `${percent(rate(items, item => item.gross >= 1_000_000_000))}`,
    );
  }

  const openingBuckets: NumericBucket[] = [
    { label: "<$25M", minimum: 0, maximum: 25_000_000 },
    { label: "$25–50M", minimum: 25_000_000, maximum: 50_000_000 },
    { label: "$50–100M", minimum: 50_000_000, maximum: 100_000_000 },
    { label: "$100–200M", minimum: 100_000_000, maximum: 200_000_000 },
    { label: "$200–300M", minimum: 200_000_000, maximum: 300_000_000 },
    { label: "$300–500M", minimum: 300_000_000, maximum: 500_000_000 },
    { label: "$500M+", minimum: 500_000_000, maximum: Infinity },
  ];
  console.log("\nOpening-weekend distribution");
  for (const bucket of openingBuckets) {
    const items = observations.filter(item => inBucket(item.opening, bucket));
    console.log(
      `${bucket.label.padEnd(12)} ${String(items.length).padStart(7)} ` +
      `${percent(items.length / observations.length).padStart(8)} | ` +
      `event≥.10 ${percent(rate(items, item => item.eventIntensity >= 0.1))} | ` +
      `gross median ${money(percentile(items.map(item => item.gross), 0.5))}`,
    );
  }

  console.log("\nUpper-tail continuity ($100M slices)");
  for (let minimum = 400_000_000; minimum < 2_000_000_000; minimum += 100_000_000) {
    const maximum = minimum + 100_000_000;
    const items = observations.filter(item => item.gross >= minimum && item.gross < maximum);
    console.log(
      `${money(minimum).padStart(9)}–${money(maximum).padEnd(9)} ` +
      `${String(items.length).padStart(6)} ${percent(items.length / observations.length).padStart(8)} ` +
      `event>0 ${percent(rate(items, item => item.eventIntensity > 0)).padStart(8)} ` +
      `event≥.10 ${percent(rate(items, item => item.eventIntensity >= 0.1)).padStart(8)}`,
    );
  }
}

function main(): void {
  const count = parseCount();
  const seedArgument = process.argv.find((argument) => argument.startsWith("--seed="));
  const seed = seedArgument?.slice("--seed=".length) ?? "balance-v1";
  const cohorts: CohortName[] = [
    "random AI", "heuristic AI", "skilled optimizer",
    "average", "high-budget", "low-budget",
    "high-quality / low-commercial-appeal",
    "mediocre-quality / high-commercial-appeal",
    "franchise event", "original event",
    "globally accessible", "culturally narrow",
  ];

  console.log(`Seed: ${seed}; films per cohort: ${count.toLocaleString()}`);
  console.log("Targets:", DEFAULT_SIMULATION_CONFIG.targets);
  reportSystemMechanics();
  reportReceptionScenarios(seed);
  reportEventScenarios(seed);
  const cohortMeans = new Map<CohortName, { critic: number; gross: number }>();
  const allObservations: Observation[] = [];
  const coreObservations: Observation[] = [];
  const coreCohorts = new Set<CohortName>([
    "random AI", "heuristic AI", "skilled optimizer",
    "average", "high-budget", "low-budget",
  ]);
  for (const cohort of cohorts) {
    const rng = createSeededRng(`${seed}:${cohort}`);
    const observations = Array.from({ length: count }, () => runFilm(cohort, rng));
    allObservations.push(...observations);
    if (coreCohorts.has(cohort)) coreObservations.push(...observations);
    report(cohort, observations);
    cohortMeans.set(cohort, {
      critic: mean(observations.map(item => item.critic)),
      gross: mean(observations.map(item => item.gross)),
    });
  }
  report("core six equal-weight mix", coreObservations);
  reportGenreRelationships(allObservations);
  const heuristic = cohortMeans.get("heuristic AI");
  const skilled = cohortMeans.get("skilled optimizer");
  const random = cohortMeans.get("random AI");
  if (heuristic && skilled && random) {
    console.log("\nCOMPETITIVE GAPS");
    console.log(
      `Heuristic AI vs random AI: ${(heuristic.critic - random.critic).toFixed(1)} critic points, ` +
      `${money(heuristic.gross - random.gross)} average gross`,
    );
    console.log(
      `Skilled optimizer vs heuristic AI: ${(skilled.critic - heuristic.critic).toFixed(1)} critic points, ` +
      `${money(skilled.gross - heuristic.gross)} average gross`,
    );
  }
  const liveSlateArgument = process.argv.find(argument =>
    argument.startsWith("--live-slate-count="));
  const liveSlateCount = Math.max(0, Math.floor(Number(
    liveSlateArgument?.slice("--live-slate-count=".length) || 0,
  )));
  if (liveSlateCount > 0) {
    const rng = createSeededRng(`${seed}:live-ai-upper-tail`);
    const state: LiveSlateState = {
      projectIndex: 0,
      activeTentpoleDurations: liveStudioProfiles.map(() => []),
    };
    const observations: Observation[] = [];
    for (let index = 0; index < liveSlateCount; index += 1) {
      const generated = generateLiveAIPlan(rng, state);
      observations.push(observePlan(generated.plan, rng, generated.isTentpole));
    }
    reportUpperTailDiagnostics(observations);
  }
}

main();
