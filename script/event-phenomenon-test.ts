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

console.log({
  eventPotential: result.eventPotential,
  eventIntensity: result.eventIntensity,
  phenomenonPotential: result.phenomenonPotential,
  phenomenonIntensity: result.phenomenonIntensity,
  retention: result.retention,
});

