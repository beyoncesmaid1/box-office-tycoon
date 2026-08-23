import assert from "node:assert/strict";
import { createInitialCampaignState } from "../server/simulation/campaign";
import { simulateTerritoryWeek } from "../server/simulation/exhibition";

const result = simulateTerritoryWeek({
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  genre: "action",
  productionScale: 98,
  blockbusterDeployment: 1,
  commercialAppeal: 82,
  launchHook: 92,
  releaseTiming: 76,
  competition: 18,
  audienceExperience: 92,
  campaign: {
    ...createInitialCampaignState(92, 90, 62),
    buzz: 15,
  },
  openingExpectation: 62,
  weekNumber: 2,
  previousWeekGross: 100_000_000,
  baseTicketPrice: 12,
  imaxTicketPrice: 21,
  dolbyTicketPrice: 19,
  regularCapacityAdmissions: 1_000_000_000,
  imaxAllocationAdmissions: 1_000_000_000,
  dolbyAllocationAdmissions: 1_000_000_000,
  imaxSuitability: 92,
  dolbySuitability: 88,
  demandVariance: 1,
});

assert.ok(result.eventIntensity >= 0.1,
  `Scenario must qualify as an anticipated event`);
assert.ok(result.phenomenonPotential >= 80,
  `Elite audience delivery should create phenomenon potential`);
assert.ok(result.phenomenonIntensity >= 0.2,
  `An acclaimed event must retain a bounded phenomenon boost; got ${result.phenomenonIntensity}`);
assert.ok(result.retention >= 0.65,
  `An acclaimed event should hold strongly before weekly market effects`);

const sleeperBase = {
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  genre: "horror",
  productionScale: 52,
  blockbusterDeployment: 0.1,
  commercialAppeal: 68,
  launchHook: 58,
  releaseTiming: 58,
  competition: 20,
  audienceExperience: 98,
  campaign: {
    ...createInitialCampaignState(48, 44, 52),
    buzz: 16,
  },
  openingExpectation: 52,
  previousWeekGross: 20_000_000,
  baseTicketPrice: 12,
  imaxTicketPrice: 21,
  dolbyTicketPrice: 19,
  regularCapacityAdmissions: 1_000_000_000,
  imaxAllocationAdmissions: 1_000_000_000,
  dolbyAllocationAdmissions: 1_000_000_000,
  imaxSuitability: 48,
  dolbySuitability: 54,
  demandVariance: 1,
} as const;
const sleeperWeeks = [1, 2, 3, 5, 8, 12].map(weekNumber =>
  simulateTerritoryWeek({ ...sleeperBase, weekNumber }));
assert.ok(sleeperWeeks[2].phenomenonIntensity > sleeperWeeks[0].phenomenonIntensity,
  `A sleeper phenomenon should build into its fourth frame`);
assert.ok(sleeperWeeks[3].phenomenonIntensity < sleeperWeeks[2].phenomenonIntensity,
  `A sleeper phenomenon must decline after its peak`);
assert.ok(sleeperWeeks[5].phenomenonIntensity < sleeperWeeks[4].phenomenonIntensity,
  `Phenomenon strength cannot remain permanent late in the run`);

console.log({
  eventPotential: result.eventPotential,
  eventIntensity: result.eventIntensity,
  phenomenonPotential: result.phenomenonPotential,
  phenomenonIntensity: result.phenomenonIntensity,
  retention: result.retention,
  sleeperLifecycle: sleeperWeeks.map((week, index) => ({
    week: [2, 3, 4, 6, 9, 13][index],
    intensity: Math.round(week.phenomenonIntensity * 1000) / 1000,
  })),
});
