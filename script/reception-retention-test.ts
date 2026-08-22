import assert from "node:assert/strict";
import { createInitialCampaignState } from "../server/simulation/campaign";
import { simulateTerritoryWeek } from "../server/simulation/exhibition";

function retentionFor(audienceExperience: number, openingExpectation: number) {
  return simulateTerritoryWeek({
    territoryCode: "NA",
    territoryMarketShare: 0.35,
    genre: "action",
    productionScale: 85,
    commercialAppeal: 72,
    launchHook: 84,
    releaseTiming: 70,
    competition: 25,
    audienceExperience,
    campaign: createInitialCampaignState(88, 84, openingExpectation),
    openingExpectation,
    weekNumber: 1,
    previousWeekGross: 100_000_000,
    baseTicketPrice: 12,
    imaxTicketPrice: 21,
    dolbyTicketPrice: 19,
    regularCapacityAdmissions: 20_000_000,
    imaxAllocationAdmissions: 1_000_000,
    dolbyAllocationAdmissions: 1_000_000,
    imaxSuitability: 80,
    dolbySuitability: 75,
    demandVariance: 1,
  }).retention;
}

const disliked = retentionFor(55, 55);
const average = retentionFor(70, 70);
const loved = retentionFor(85, 85);

assert.ok(disliked >= 0.28 && disliked <= 0.35,
  `A 55 audience experience should produce a 65-72% drop; retention was ${disliked}`);
assert.ok(average > disliked + 0.15,
  `Average reception should retain materially better than disliked reception`);
assert.ok(loved > average,
  `Loved reception should retain better than average reception`);

const overhypedLoved = retentionFor(85, 95);
const sleeperLoved = retentionFor(85, 70);
assert.ok(sleeperLoved > overhypedLoved,
  `Expectation delivery must still distinguish sleepers from overhyped films`);

const openingInput = {
  territoryCode: "NA",
  territoryMarketShare: 0.35,
  genre: "action",
  productionScale: 85,
  commercialAppeal: 72,
  launchHook: 84,
  releaseTiming: 70,
  competition: 25,
  campaign: createInitialCampaignState(88, 84, 70),
  openingExpectation: 70,
  weekNumber: 0,
  previousWeekGross: 0,
  baseTicketPrice: 12,
  imaxTicketPrice: 21,
  dolbyTicketPrice: 19,
  regularCapacityAdmissions: 20_000_000,
  imaxAllocationAdmissions: 1_000_000,
  dolbyAllocationAdmissions: 1_000_000,
  imaxSuitability: 80,
  dolbySuitability: 75,
  demandVariance: 1,
} as const;
const dislikedOpening = simulateTerritoryWeek({
  ...openingInput,
  audienceExperience: 55,
});
const lovedOpening = simulateTerritoryWeek({
  ...openingInput,
  audienceExperience: 85,
});
assert.equal(dislikedOpening.gross, lovedOpening.gross,
  `Audience reception must not alter pre-release opening demand`);

console.log({
  dislikedRetention: disliked,
  dislikedDrop: 1 - disliked,
  averageRetention: average,
  lovedRetention: loved,
  overhypedLovedRetention: overhypedLoved,
  sleeperLovedRetention: sleeperLoved,
});

function lateRunRetention(weekNumber: number): number {
  return simulateTerritoryWeek({
    ...openingInput,
    audienceExperience: 92,
    openingExpectation: 78,
    campaign: createInitialCampaignState(92, 90, 78),
    weekNumber,
    previousWeekGross: 20_000_000,
  }).retention;
}

const earlyAcclaimRetention = lateRunRetention(4);
const middleAcclaimRetention = lateRunRetention(12);
const lateAcclaimRetention = lateRunRetention(20);
assert.ok(middleAcclaimRetention < earlyAcclaimRetention - 0.05,
  `Run age should weaken retention by the middle of a run`);
assert.ok(lateAcclaimRetention < middleAcclaimRetention - 0.08,
  `A film should continue aging instead of stabilizing forever`);
assert.ok(lateAcclaimRetention <= 0.55,
  `Even an acclaimed film should shed demand late in its run; got ${lateAcclaimRetention}`);

console.log({
  earlyAcclaimRetention,
  middleAcclaimRetention,
  lateAcclaimRetention,
});
