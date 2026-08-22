import assert from "node:assert/strict";
import { createInitialCampaignState } from "../server/simulation/campaign";
import { simulateTerritoryWeek } from "../server/simulation/exhibition";

const weeklyConditions = [
  { demandVariance: 0.9, releaseTiming: 52, competition: 10 },
  { demandVariance: 1.18, releaseTiming: 62, competition: 10 },
  { demandVariance: 0.78, releaseTiming: 44, competition: 52 },
  { demandVariance: 1.12, releaseTiming: 58, competition: 10 },
  { demandVariance: 0.95, releaseTiming: 50, competition: 36 },
];

let previousGross = 100_000_000;
const drops: number[] = [];
const grosses: number[] = [];

weeklyConditions.forEach((conditions, index) => {
  const result = simulateTerritoryWeek({
    territoryCode: "NA",
    territoryMarketShare: 0.35,
    genre: "drama",
    productionScale: 70,
    commercialAppeal: 50,
    launchHook: 65,
    audienceExperience: 78,
    campaign: createInitialCampaignState(75, 72, 72),
    openingExpectation: 72,
    weekNumber: index + 1,
    previousWeekGross: previousGross,
    baseTicketPrice: 12,
    imaxTicketPrice: 21,
    dolbyTicketPrice: 19,
    regularCapacityAdmissions: 1_000_000_000,
    imaxAllocationAdmissions: 1_000_000_000,
    dolbyAllocationAdmissions: 1_000_000_000,
    imaxSuitability: 40,
    dolbySuitability: 55,
    ...conditions,
  });
  drops.push(1 - result.gross / previousGross);
  grosses.push(result.gross);
  previousGross = result.gross;
});

const smallestDrop = Math.min(...drops);
const largestDrop = Math.max(...drops);
assert.ok(largestDrop - smallestDrop >= 0.2,
  `Weekly conditions should create varied holds; range was ${largestDrop - smallestDrop}`);
assert.ok(drops[1] < drops[0],
  `A film must be able to improve its hold after week two`);
assert.ok(drops[2] > drops[1] + 0.2,
  `A new competitive week should be able to cause a sharp later drop`);
assert.ok(drops[3] < drops[2],
  `Demand should be able to rebound after a bad week`);

console.log({
  grosses,
  drops: drops.map(drop => Math.round(drop * 1_000) / 10),
});
