import assert from "node:assert/strict";
import { getBlockbusterScale, type AIStudioDecisionProfile } from "../server/simulation/aiDecision";
import {
  chooseAIReleaseDate,
  type ScheduledFilmLike,
} from "../server/simulation/release-calendar";

const profile: AIStudioDecisionProfile = {
  decisionQuality: 0.72,
  explorationRate: 0.28,
  riskTolerance: 0.68,
  valueDiscipline: 0.56,
  preferredGenres: ["action", "scifi"],
};

const projects = [
  { genre: "action", productionBudget: 263_000_000 },
  { genre: "animation", productionBudget: 201_000_000 },
  { genre: "action", productionBudget: 117_000_000 },
  { genre: "fantasy", productionBudget: 97_000_000 },
  { genre: "scifi", productionBudget: 62_000_000 },
  { genre: "musicals", productionBudget: 59_000_000 },
  { genre: "animation", productionBudget: 57_000_000 },
];

function buildCalendar(rng: () => number): ScheduledFilmLike[] {
  const result: ScheduledFilmLike[] = [];
  for (const project of projects) {
    const release = chooseAIReleaseDate({
      earliestWeek: 47,
      earliestYear: 2025,
      genre: project.genre,
      productionBudget: project.productionBudget,
      calendarFilms: result,
      profile,
    }, rng);
    result.push({ ...project, ...release });
  }
  return result;
}

const calendar = buildCalendar(() => 0.5);

const weekCounts = new Map<string, number>();
const tentpoleCounts = new Map<string, number>();
for (const film of calendar) {
  const key = `${film.releaseYear}-${film.releaseWeek}`;
  weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
  if (getBlockbusterScale(film.productionBudget) >= 0.55) {
    tentpoleCounts.set(key, (tentpoleCounts.get(key) || 0) + 1);
  }
}

assert.ok(Math.max(...weekCounts.values()) <= 3,
  `Seven films should not pile into one week: ${JSON.stringify([...weekCounts])}`);
assert.ok(Math.max(0, ...tentpoleCounts.values()) <= 2,
  `The scheduler should avoid three tentpoles sharing a week`);
assert.ok(weekCounts.size >= 3,
  `A crowded slate should spread across at least three weeks`);

let fourFilmCollisionSeeds = 0;
for (let seed = 1; seed <= 50; seed += 1) {
  let state = seed;
  const variedCalendar = buildCalendar(() => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  });
  const variedCounts = new Map<string, number>();
  for (const film of variedCalendar) {
    const key = `${film.releaseYear}-${film.releaseWeek}`;
    variedCounts.set(key, (variedCounts.get(key) || 0) + 1);
  }
  const maximumWeek = Math.max(...variedCounts.values());
  if (maximumWeek === 4) fourFilmCollisionSeeds += 1;
  assert.ok(maximumWeek <= 4,
    `Random scheduling seed ${seed} recreated an overcrowded week`);
}
assert.ok(fourFilmCollisionSeeds <= 5,
  `Four-film collisions should be unusual; occurred in ${fourFilmCollisionSeeds}/50 slates`);

console.log({
  calendar,
  weekCounts: Object.fromEntries(weekCounts),
  tentpoleCounts: Object.fromEntries(tentpoleCounts),
});
