import assert from "node:assert/strict";
import { distributeWeeklyGrossAcrossDays } from
  "../client/src/components/FilmDetail";

const weeklyTotals = [120_000_000, 72_000_000, 46_000_000, 31_000_000, 22_000_000, 15_000_000];
const realizedShapes = new Set<string>();

weeklyTotals.forEach((weeklyGross, weekIndex) => {
  const days = distributeWeeklyGrossAcrossDays({
    filmId: "daily-variation-test",
    weeklyGross,
    weekIndex,
    previousWeeklyGross: weekIndex > 0 ? weeklyTotals[weekIndex - 1] : 0,
    openingWeeklyGross: weeklyTotals[0],
    profile: "general",
    audienceScore: 78,
    calendarWeek: 24 + weekIndex,
  });

  assert.equal(days.length, 7);
  assert.equal(days.reduce((sum, gross) => sum + gross, 0), weeklyGross,
    `Week ${weekIndex + 1} must retain its exact authoritative gross`);
  assert.ok(days[2] > days[3], "Sunday should normally exceed Monday");
  assert.ok(days[4] > days[3], "Tuesday should normally rebound from Monday");
  if (weekIndex > 0) {
    assert.ok(days[1] > days[0], "A holdover Saturday should normally rise from Friday");
    assert.ok(days[2] < days[1], "Sunday should normally decline from Saturday");
  }

  realizedShapes.add(days.slice(1).map((gross, dayIndex) =>
    Math.round((gross / days[dayIndex] - 1) * 100)).join(","));
});

assert.ok(realizedShapes.size >= 5,
  `Daily curves should vary materially by week; saw ${realizedShapes.size} distinct shapes`);

const weekendShare = (days: number[]): number =>
  (days[0] + days[1] + days[2]) / days.reduce((sum, gross) => sum + gross, 0);
const splitScenario = (overrides: Partial<Parameters<typeof distributeWeeklyGrossAcrossDays>[0]> = {}) =>
  distributeWeeklyGrossAcrossDays({
    filmId: "weekend-share-test",
    weeklyGross: 50_000_000,
    weekIndex: 2,
    previousWeeklyGross: 85_000_000,
    openingWeeklyGross: 120_000_000,
    profile: "general",
    audienceScore: 78,
    calendarWeek: 28,
    eventIntensity: 0,
    ...overrides,
  });

const summerFamilyOpeningShare = weekendShare(splitScenario({
  filmId: "family-opening-test",
  weeklyGross: 120_000_000,
  weekIndex: 0,
  previousWeeklyGross: 0,
  openingWeeklyGross: 120_000_000,
  profile: "family",
}));
assert.ok(summerFamilyOpeningShare >= 0.56 && summerFamilyOpeningShare <= 0.64,
  `Summer family openings should have broad weekday demand; got ${summerFamilyOpeningShare}`);

const fanEventShare = weekendShare(splitScenario({
  profile: "fan",
  eventIntensity: 0.18,
}));
assert.ok(fanEventShare >= 0.67 && fanEventShare <= 0.75,
  `Fan events should be weekend concentrated; got ${fanEventShare}`);

const highRemainingDemandShare = weekendShare(splitScenario({
  filmId: "remaining-demand-test",
  profile: "fan",
  weeklyGross: 60_000_000,
  previousWeeklyGross: 100_000_000,
  openingWeeklyGross: 120_000_000,
  weekIndex: 4,
}));
const lowRemainingDemandShare = weekendShare(splitScenario({
  filmId: "remaining-demand-test",
  profile: "fan",
  weeklyGross: 6_000_000,
  previousWeeklyGross: 10_000_000,
  openingWeeklyGross: 120_000_000,
  weekIndex: 4,
}));
assert.ok(lowRemainingDemandShare > highRemainingDemandShare + 0.02,
  "A depleted run should rely more heavily on weekend demand");

console.log({
  distinctWeeklyShapes: realizedShapes.size,
  summerFamilyOpeningShare: Math.round(summerFamilyOpeningShare * 1_000) / 10,
  fanEventShare: Math.round(fanEventShare * 1_000) / 10,
  highRemainingDemandShare: Math.round(highRemainingDemandShare * 1_000) / 10,
  lowRemainingDemandShare: Math.round(lowRemainingDemandShare * 1_000) / 10,
});
