import assert from "node:assert/strict";
import { calculateTerritoryTheaterCount } from "../server/simulation/exhibition";

const wideOpening = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 0,
  currentGross: 95_000_000,
  awareness: 88,
  interest: 84,
  commercialAppeal: 82,
  launchHook: 78,
  competition: 35,
  blockbusterDeployment: 0.8,
  eventIntensity: 0.16,
});
assert.ok(wideOpening >= 3_500 && wideOpening <= 4_600,
  `A major opening should be wide but bounded; got ${wideOpening}`);

const modestOpening = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 0,
  currentGross: 4_000_000,
  awareness: 34,
  interest: 38,
  commercialAppeal: 45,
  launchHook: 36,
  competition: 55,
  blockbusterDeployment: 0,
});
assert.ok(modestOpening >= 40 && modestOpening < 2_000,
  `A modest film should not receive blockbuster saturation; got ${modestOpening}`);

const eventTransitionBase = {
  territoryCode: "NA",
  weekNumber: 0,
  currentGross: 42_000_000,
  awareness: 68,
  interest: 66,
  commercialAppeal: 70,
  launchHook: 65,
  competition: 25,
  blockbusterDeployment: 0.55,
} as const;
const justBelowEvent = calculateTerritoryTheaterCount({
  ...eventTransitionBase,
  eventIntensity: 0.099,
});
const justAboveEvent = calculateTerritoryTheaterCount({
  ...eventTransitionBase,
  eventIntensity: 0.101,
});
assert.ok(Math.abs(justAboveEvent - justBelowEvent) <= 100,
  `Crossing event status must not cause a theater cliff; got ` +
    `${justBelowEvent} -> ${justAboveEvent}`);

const strongHold = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 1,
  currentGross: 38_000_000,
  previousGross: 55_000_000,
  previousTheaterCount: 4_100,
  awareness: 80,
  interest: 82,
  commercialAppeal: 78,
  launchHook: 75,
  competition: 40,
  blockbusterDeployment: 0.7,
});
assert.ok(strongHold >= 4_000 && strongHold <= 4_600,
  `A strong hold should retain its footprint; got ${strongHold}`);

const secondFrame = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 1,
  currentGross: 60_000_000,
  previousGross: 95_000_000,
  previousTheaterCount: wideOpening,
  awareness: 88,
  interest: 84,
  commercialAppeal: 82,
  launchHook: 78,
  competition: 35,
  blockbusterDeployment: 0.8,
});
const thirdFrame = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 2,
  currentGross: 40_000_000,
  previousGross: 60_000_000,
  previousTheaterCount: secondFrame,
  awareness: 86,
  interest: 82,
  commercialAppeal: 82,
  launchHook: 78,
  competition: 38,
  blockbusterDeployment: 0.8,
});
const fourthFrame = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 3,
  currentGross: 27_000_000,
  previousGross: 40_000_000,
  previousTheaterCount: thirdFrame,
  awareness: 84,
  interest: 80,
  commercialAppeal: 82,
  launchHook: 78,
  competition: 42,
  blockbusterDeployment: 0.8,
});
assert.ok(secondFrame <= Math.round(wideOpening * 1.03),
  `A second frame should only expand slightly; got ${wideOpening} -> ${secondFrame}`);
assert.ok(thirdFrame <= Math.round(secondFrame * 1.02),
  `A third frame should only expand slightly; got ${secondFrame} -> ${thirdFrame}`);
assert.ok(fourthFrame < thirdFrame,
  `An ordinary fourth frame should begin contracting; got ${thirdFrame} -> ${fourthFrame}`);

const weakHold = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 4,
  currentGross: 2_000_000,
  previousGross: 8_000_000,
  previousTheaterCount: 3_600,
  awareness: 55,
  interest: 46,
  commercialAppeal: 60,
  launchHook: 55,
  competition: 65,
  blockbusterDeployment: 0.3,
});
assert.ok(weakHold < 3_600 && weakHold >= Math.round(3_600 * 0.65),
  `A weak week should contract gradually, not collapse; got ${weakHold}`);

const lateRun = calculateTerritoryTheaterCount({
  territoryCode: "NA",
  weekNumber: 12,
  currentGross: 180_000,
  previousGross: 420_000,
  previousTheaterCount: 900,
  awareness: 35,
  interest: 28,
  commercialAppeal: 50,
  launchHook: 45,
  competition: 60,
  blockbusterDeployment: 0.1,
});
assert.ok(lateRun < 600 && lateRun >= 40,
  `A late run should shed theaters meaningfully; got ${lateRun}`);

console.log({
  wideOpening,
  modestOpening,
  eventTransition: [justBelowEvent, justAboveEvent],
  strongHold,
  secondFrame,
  thirdFrame,
  fourthFrame,
  weakHold,
  lateRun,
});
