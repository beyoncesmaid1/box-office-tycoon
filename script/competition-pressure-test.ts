import assert from "node:assert/strict";
import { createInitialCampaignState } from "../server/simulation/campaign";
import { calculateCompetitionPressure, type CompetitionRival } from "../server/simulation/competition";
import { simulateTerritoryWeek } from "../server/simulation/exhibition";

const rival = (overrides: Partial<CompetitionRival>): CompetitionRival => ({
  genre: "action",
  isOpening: true,
  weeksInRelease: 0,
  territoryMarketShare: 0.35,
  awareness: 62,
  interest: 64,
  commercialAppeal: 70,
  launchHook: 62,
  blockbusterDeployment: 0.45,
  marketingBudget: 45_000_000,
  ...overrides,
});

const target = { genre: "action" };
const smallRelease = calculateCompetitionPressure(target, [rival({
  genre: "romance",
  awareness: 24,
  interest: 28,
  commercialAppeal: 50,
  launchHook: 35,
  blockbusterDeployment: 0,
  marketingBudget: 3_000_000,
})]);
const normalWide = calculateCompetitionPressure(target, [rival({
  genre: "comedy",
})]);
const overlappingWide = calculateCompetitionPressure(target, [rival({})]);
const overlappingTentpole = calculateCompetitionPressure(target, [rival({
  awareness: 88,
  interest: 86,
  commercialAppeal: 82,
  launchHook: 90,
  blockbusterDeployment: 1,
  marketingBudget: 180_000_000,
  eventIntensity: 0.25,
})]);
const twoTentpoles = calculateCompetitionPressure(target, [
  rival({
    awareness: 88,
    interest: 86,
    commercialAppeal: 82,
    launchHook: 90,
    blockbusterDeployment: 1,
    marketingBudget: 180_000_000,
    eventIntensity: 0.25,
  }),
  rival({
    genre: "scifi",
    awareness: 84,
    interest: 83,
    commercialAppeal: 80,
    launchHook: 86,
    blockbusterDeployment: 0.95,
    marketingBudget: 150_000_000,
    eventIntensity: 0.2,
  }),
]);
const strongHoldover = calculateCompetitionPressure(target, [rival({
  isOpening: false,
  weeksInRelease: 2,
  previousWeekGross: 72_000_000,
  awareness: 90,
  interest: 88,
  eventIntensity: 0.2,
})]);
const crowdedMinorSlate = calculateCompetitionPressure(target, Array.from(
  { length: 10 },
  () => rival({
    genre: "romance",
    awareness: 24,
    interest: 28,
    commercialAppeal: 50,
    launchHook: 35,
    blockbusterDeployment: 0,
    marketingBudget: 3_000_000,
  }),
));

assert.ok(smallRelease <= 5, `Small unrelated release pressure was ${smallRelease}`);
assert.ok(normalWide >= 6 && normalWide <= 15,
  `Normal unrelated wide release pressure was ${normalWide}`);
assert.ok(overlappingWide > normalWide,
  `Same-genre release should compete more strongly`);
assert.ok(overlappingTentpole >= 35 && overlappingTentpole <= 52,
  `Overlapping tentpole pressure was ${overlappingTentpole}`);
assert.ok(twoTentpoles > overlappingTentpole + 15,
  `A second tentpole must materially add pressure`);
assert.ok(strongHoldover >= 25,
  `A strong holdover must remain a meaningful competitor; pressure was ${strongHoldover}`);
assert.ok(crowdedMinorSlate <= 8,
  `Minor releases should not stack into tentpole pressure; got ${crowdedMinorSlate}`);

const commonInput = {
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  genre: "action",
  productionScale: 90,
  blockbusterDeployment: 0.9,
  commercialAppeal: 80,
  launchHook: 88,
  releaseTiming: 55,
  audienceExperience: 78,
  campaign: createInitialCampaignState(88, 86, 75),
  openingExpectation: 75,
  baseTicketPrice: 12,
  imaxTicketPrice: 21,
  dolbyTicketPrice: 19,
  regularCapacityAdmissions: 1_000_000_000,
  imaxAllocationAdmissions: 1_000_000_000,
  dolbyAllocationAdmissions: 1_000_000_000,
  imaxSuitability: 85,
  dolbySuitability: 80,
  demandVariance: 1,
} as const;

const openingGross = (competition: number) => simulateTerritoryWeek({
  ...commonInput,
  competition,
  weekNumber: 0,
  previousWeekGross: 0,
}).gross;
const holdoverGross = (competition: number) => simulateTerritoryWeek({
  ...commonInput,
  competition,
  weekNumber: 2,
  previousWeekGross: 100_000_000,
}).gross;

const baselineOpening = openingGross(0);
const baselineHoldover = holdoverGross(0);
const results = {
  smallRelease,
  normalWide,
  overlappingWide,
  overlappingTentpole,
  twoTentpoles,
  strongHoldover,
  crowdedMinorSlate,
  openingCompetitionDoubleCount: 1 - openingGross(twoTentpoles) / baselineOpening,
  holdoverCompetitionDoubleCount: 1 - holdoverGross(twoTentpoles) / baselineHoldover,
};

assert.equal(openingGross(twoTentpoles), baselineOpening,
  `Competition must not be subtracted again inside opening demand`);
assert.equal(holdoverGross(twoTentpoles), baselineHoldover,
  `Competition must not be subtracted again inside holdover demand`);

console.log(Object.fromEntries(Object.entries(results).map(([key, value]) => [
  key,
  typeof value === "number" ? Math.round(value * 1_000) / 1_000 : value,
])));
