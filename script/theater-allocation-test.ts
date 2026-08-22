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

console.log({ wideOpening, modestOpening, strongHold, weakHold, lateRun });
