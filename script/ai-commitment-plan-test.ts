import assert from "node:assert/strict";
import {
  createStudioDecisionProfile,
  forecastAIFilmReturn,
  planAIFilmCommitment,
  selectAffordableAIFilmCommitment,
  type AIProductionBudgetPlan,
} from "../server/simulation/aiDecision";
import { createSeededRng } from "../server/simulation";

const profile = createStudioDecisionProfile({
  id: "commitment-test-studio",
  name: "Commitment Test Studio",
  prestigeLevel: 2,
  strategy: "balanced",
});

function production(productionBudget: number, isTentpole = false): AIProductionBudgetPlan {
  return { productionBudget, isTentpole };
}

const cheapDrama = planAIFilmCommitment(
  "drama",
  production(8_000_000),
  150_000_000,
  profile,
  createSeededRng("cheap-drama").next,
);
assert.equal(cheapDrama.vfxBudgetCeiling, 0);
assert.ok(cheapDrama.plannedAllIn > 8_000_000);
assert.ok(cheapDrama.plannedAllIn < 35_000_000);

const cheapHorror = planAIFilmCommitment(
  "horror",
  production(8_000_000),
  150_000_000,
  profile,
  createSeededRng("cheap-horror").next,
);
assert.ok(cheapHorror.vfxBudgetCeiling < 5_000_000,
  "An $8M horror film must not independently budget for an $18M VFX vendor");

const tentpole = planAIFilmCommitment(
  "scifi",
  production(220_000_000, true),
  1_000_000_000,
  profile,
  createSeededRng("tentpole").next,
);
assert.ok(tentpole.departmentBudget > cheapHorror.departmentBudget * 10);
assert.ok(tentpole.talentBudgetLimit > cheapHorror.talentBudgetLimit * 3);
assert.ok(tentpole.vfxBudgetCeiling > cheapHorror.vfxBudgetCeiling * 10);
assert.ok(tentpole.marketingBudget > cheapHorror.marketingBudget * 10);
assert.ok(tentpole.contingencyReserve > 0);

const constrained = selectAffordableAIFilmCommitment(
  "action",
  95_000_000,
  profile,
  createSeededRng("constrained-action").next,
  true,
);
assert.equal(constrained.production.isTentpole, false);
assert.ok(constrained.commitment.isAffordable);
assert.ok(constrained.commitment.projectedAllIn <= constrained.commitment.commitmentLimit);

const samples = Array.from({ length: 2_000 }, (_, index) => planAIFilmCommitment(
  "action",
  production(80_000_000),
  500_000_000,
  profile,
  createSeededRng(`commitment-variation-${index}`).next,
));
const allInRatios = samples.map(plan => plan.plannedAllIn / 80_000_000);
const minimumRatio = Math.min(...allInRatios);
const maximumRatio = Math.max(...allInRatios);
assert.ok(maximumRatio - minimumRatio > 0.45,
  "Plans should retain meaningful variation and occasional spending mistakes");
assert.ok(samples.some(plan => plan.planningError < 0.9));
assert.ok(samples.some(plan => plan.planningError > 1.08));

const forecastPlan = {
  production: production(50_000_000),
  commitment: planAIFilmCommitment(
    "drama",
    production(50_000_000),
    500_000_000,
    profile,
    createSeededRng("forecast-plan").next,
  ),
};
const strongHistory = Array.from({ length: 16 }, (_, index) => ({
  genre: "drama",
  productionBudget: 45_000_000 + index * 500_000,
  totalBoxOffice: 175_000_000 + index * 2_000_000,
  ancillaryRevenue: 18_000_000,
}));
const weakHistory = strongHistory.map(item => ({
  ...item,
  totalBoxOffice: item.totalBoxOffice * 0.28,
  ancillaryRevenue: item.ancillaryRevenue * 0.28,
}));
const strongForecast = forecastAIFilmReturn(
  "drama",
  forecastPlan,
  strongHistory,
  profile,
  createSeededRng("comparable-forecast").next,
);
const weakForecast = forecastAIFilmReturn(
  "drama",
  forecastPlan,
  weakHistory,
  profile,
  createSeededRng("comparable-forecast").next,
);
assert.ok(strongForecast.expectedTheatricalGross > weakForecast.expectedTheatricalGross * 1.5);
assert.ok(strongForecast.expectedStreamingRevenue > 0);
assert.equal(strongForecast.comparableCount, 16);

const returnForecasts = Array.from({ length: 500 }, (_, index) => forecastAIFilmReturn(
  "drama",
  forecastPlan,
  weakHistory,
  profile,
  createSeededRng(`return-forecast-${index}`).next,
));
assert.ok(returnForecasts.some(result => !result.shouldGreenlight),
  "Forecasting must reject projects whose expected lifecycle return is too weak");
assert.ok(returnForecasts.some(result => result.explorationOverride && result.shouldGreenlight),
  "Studios must occasionally greenlight a rejected-looking project for exploration");
assert.ok(Math.max(...returnForecasts.map(result => result.projectedRoi)) -
  Math.min(...returnForecasts.map(result => result.projectedRoi)) > 0.35,
"Return forecasts should retain meaningful uncertainty");

console.log(
  "AI commitment planning passed: proportional categories, affordability, " +
  "contingency, imperfect lifecycle forecasting, and stochastic overruns verified.",
);
