import assert from "node:assert/strict";
import {
  createStudioDecisionProfile,
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

console.log(
  "AI commitment planning passed: proportional categories, affordability, " +
  "contingency, forecast noise, and stochastic overruns verified.",
);
