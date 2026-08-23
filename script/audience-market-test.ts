import assert from "node:assert/strict";
import { allocateTerritoryAudienceMarket } from "../server/simulation/audience-market";
import { createInitialCampaignState } from "../server/simulation/campaign";
import {
  calculateTerritoryRegularCapacityAdmissions,
  simulateTerritoryWeek,
} from "../server/simulation/exhibition";

const quietMarket = allocateTerritoryAudienceMarket({
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  candidates: [
    {
      filmId: "quiet-a",
      genre: "drama",
      unconstrainedDemandAdmissions: 3_000_000,
      eventIntensity: 0,
      releaseTiming: 52,
      isOpeningWeek: true,
    },
    {
      filmId: "quiet-b",
      genre: "comedy",
      unconstrainedDemandAdmissions: 2_000_000,
      eventIntensity: 0,
      releaseTiming: 52,
      isOpeningWeek: false,
    },
  ],
});
assert.equal(quietMarket.allocatedAdmissions, 5_000_000,
  `An uncrowded market must not manufacture competition`);

const crowdedMarket = allocateTerritoryAudienceMarket({
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  candidates: [
    {
      filmId: "loved-holdover",
      genre: "action",
      unconstrainedDemandAdmissions: 28_000_000,
      eventIntensity: 0.2,
      releaseTiming: 58,
      isOpeningWeek: false,
    },
    {
      filmId: "new-blockbuster",
      genre: "scifi",
      unconstrainedDemandAdmissions: 18_000_000,
      eventIntensity: 0.2,
      releaseTiming: 58,
      isOpeningWeek: true,
    },
    {
      filmId: "small-romance",
      genre: "romance",
      unconstrainedDemandAdmissions: 4_000_000,
      eventIntensity: 0,
      releaseTiming: 52,
      isOpeningWeek: true,
    },
  ],
});
const loved = crowdedMarket.allocations.find(item => item.filmId === "loved-holdover")!;
const newcomer = crowdedMarket.allocations.find(item => item.filmId === "new-blockbuster")!;
assert.ok(crowdedMarket.allocatedAdmissions <= crowdedMarket.expandedPoolAdmissions + 1,
  `Territory allocations cannot exceed the weekly audience pool`);
assert.ok(loved.allocatedAdmissions > newcomer.allocatedAdmissions,
  `A stronger loved holdover must be able to beat a new blockbuster`);
assert.ok(loved.demandFulfillment > newcomer.demandFulfillment,
  `The stronger film should receive a smaller proportional haircut`);
for (const allocation of crowdedMarket.allocations) {
  assert.ok(allocation.allocatedAdmissions <= allocation.unconstrainedDemandAdmissions + 1,
    `Market allocation cannot create demand for ${allocation.filmId}`);
}

const physicalRegularCapacity = calculateTerritoryRegularCapacityAdmissions(
  "NA",
  2_300,
  9_300_000,
);
const capacityResult = simulateTerritoryWeek({
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  genre: "action",
  productionScale: 90,
  blockbusterDeployment: 0.9,
  commercialAppeal: 80,
  launchHook: 88,
  releaseTiming: 60,
  competition: 100,
  audienceExperience: 88,
  campaign: createInitialCampaignState(88, 86, 70),
  openingExpectation: 70,
  weekNumber: 1,
  previousWeekGross: 120_000_000,
  baseTicketPrice: 12,
  imaxTicketPrice: 21,
  dolbyTicketPrice: 19,
  regularCapacityAdmissions: physicalRegularCapacity,
  imaxAllocationAdmissions: 350_000,
  dolbyAllocationAdmissions: 220_000,
  imaxSuitability: 85,
  dolbySuitability: 80,
  demandVariance: 1,
  marketAllocatedAdmissions: 8_000_000,
});
assert.ok(capacityResult.totalDemandAdmissions <= 8_000_000,
  `The film cannot claim more tickets than the market awarded`);
assert.ok(capacityResult.regularAdmissions <= capacityResult.regularCapacityAdmissions + 1,
  `Regular admissions must respect booked-theater capacity`);
assert.ok(
  capacityResult.regularAdmissions + capacityResult.imaxAdmissions +
    capacityResult.dolbyAdmissions <= capacityResult.totalDemandAdmissions + 1,
  `Physical format sales cannot exceed the film's market allocation`,
);

console.log({
  quietMarket: {
    pool: quietMarket.expandedPoolAdmissions,
    demand: quietMarket.unconstrainedDemandAdmissions,
    allocated: quietMarket.allocatedAdmissions,
  },
  crowdedMarket: {
    pool: crowdedMarket.expandedPoolAdmissions,
    demand: crowdedMarket.unconstrainedDemandAdmissions,
    allocated: crowdedMarket.allocatedAdmissions,
    allocations: crowdedMarket.allocations,
  },
  physicalCapacity: {
    marketAward: capacityResult.marketAllocatedAdmissions,
    regularCapacity: capacityResult.regularCapacityAdmissions,
    sold: capacityResult.regularAdmissions + capacityResult.imaxAdmissions +
      capacityResult.dolbyAdmissions,
  },
});

