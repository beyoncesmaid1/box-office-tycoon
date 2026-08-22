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
    profile: "general",
    audienceScore: 78,
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

console.log({ distinctWeeklyShapes: realizedShapes.size });
