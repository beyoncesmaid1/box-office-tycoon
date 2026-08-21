import {
  DEFAULT_SIMULATION_CONFIG,
  type SimulationBalanceConfig,
  type SimulationGenre,
  resolveGenre,
} from "./balance-config";
import { chance, normal, systemRng, type RandomSource } from "./rng";
import type {
  FilmQualityInput,
  FilmQualityResult,
  TalentLike,
} from "./types";

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.max(minimum, Math.min(maximum, value));

const finite = (value: number | null | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function diminishingReception(value: number): number {
  const bounded = clamp(value);
  if (bounded <= 70) return bounded;
  const eliteProgress = (bounded - 70) / 30;
  return 70 + 30 * Math.pow(eliteProgress, 1.5);
}

function talentGenreSkill(talent: TalentLike | null | undefined, genre: string): number {
  if (!talent) return 45;
  const normalized = genre.toLowerCase().replace(/[\s-]/g, "");
  const skillByGenre: Record<string, number | null | undefined> = {
    action: talent.skillAction,
    drama: talent.skillDrama,
    comedy: talent.skillComedy,
    thriller: talent.skillThriller,
    horror: talent.skillHorror,
    scifi: talent.skillScifi,
    sciencefiction: talent.skillScifi,
    animation: talent.skillAnimation,
    romance: talent.skillRomance,
    fantasy: talent.skillFantasy,
    musicals: talent.skillMusicals,
  };
  const direct = skillByGenre[normalized];
  if (typeof direct === "number" && Number.isFinite(direct)) return clamp(direct);

  if (talent.genres && typeof talent.genres === "object") {
    const genres = talent.genres as Record<string, unknown>;
    const fromMap = genres[genre] ?? genres[normalized];
    if (typeof fromMap === "number" && Number.isFinite(fromMap)) return clamp(fromMap);
  }
  return 50;
}

function talentAbility(talent: TalentLike | null | undefined): number {
  if (!talent) return 45;
  const performance = clamp(finite(talent.performance, 55));
  const experience = clamp(finite(talent.experience, 45));
  return performance * 0.78 + experience * 0.22;
}

function fittedTalentScore(talent: TalentLike | null | undefined, genre: string): number {
  return talentAbility(talent) * 0.72 + talentGenreSkill(talent, genre) * 0.28;
}

function average(values: readonly number[], fallback = 50): number {
  return values.length === 0
    ? fallback
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function genreKey(value: string): SimulationGenre {
  const normalized = value.toLowerCase().replace(/[\s-]/g, "");
  if (normalized === "sciencefiction") return "scifi";
  const known: readonly SimulationGenre[] = [
    "action", "comedy", "drama", "horror", "scifi",
    "romance", "thriller", "animation", "fantasy", "musicals",
  ];
  return known.includes(normalized as SimulationGenre)
    ? normalized as SimulationGenre
    : "drama";
}

function talentAppeal(talent: TalentLike): number {
  const fame = clamp(finite(talent.fame, 45));
  const popularity = clamp(finite(talent.popularity, fame));
  return fame * 0.68 + popularity * 0.32;
}

function aggregateCastAppeal(cast: readonly TalentLike[]): number {
  const draws = cast.map(talentAppeal).sort((left, right) => right - left);
  if (draws.length === 0) return 42;
  return clamp(
    draws[0] * 0.58 +
    (draws[1] ?? draws[0] * 0.55) * 0.27 +
    (draws[2] ?? 0) * 0.15,
  );
}

function weightedScore(
  values: Record<string, number>,
  weights: Record<string, number>,
): number {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return average(Object.values(values));
  return entries.reduce(
    (sum, [key, weight]) => sum + finite(values[key], 50) * weight,
    0,
  ) / totalWeight;
}

function departmentSupport(input: FilmQualityInput, needs: ReturnType<typeof resolveGenre>["departmentNeeds"]): number {
  const budgets = input.departmentBudgets ?? {};
  const entries = (Object.keys(needs) as Array<keyof typeof needs>)
    .filter((key) => needs[key] > 0)
    .map((key) => {
      const target = Math.max(250_000, input.productionBudget * 0.055 * needs[key]);
      const spend = Math.max(0, finite(budgets[key], target * 0.45));
      return 100 * (1 - Math.exp(-spend / target));
    });
  return average(entries, 50);
}

/**
 * Resolves release scores from hidden production quality.
 * All randomness is supplied by the caller, making saves and balance tests reproducible.
 */
export function simulateFilmQuality(
  input: FilmQualityInput,
  rng: RandomSource = systemRng,
  config: SimulationBalanceConfig = DEFAULT_SIMULATION_CONFIG,
): FilmQualityResult {
  const balance = config.quality;
  const genre = resolveGenre(input.genre, config);
  const writerAbility = fittedTalentScore(input.writer, input.genre);
  const script = clamp(finite(input.scriptQuality, 58) * 0.72 + writerAbility * 0.28);
  const direction = clamp(fittedTalentScore(input.director, input.genre));
  const castScores = (input.cast ?? []).map((member) => fittedTalentScore(member, input.genre));
  const cast = clamp(average(castScores, 48));
  const specialistScores = [
    fittedTalentScore(input.cinematographer, input.genre),
    fittedTalentScore(input.editor, input.genre),
    fittedTalentScore(input.composer, input.genre),
  ];
  const departments = departmentSupport(input, genre.departmentNeeds);
  const vfxSupport = input.vfxQuality == null
    ? 50
    : clamp(finite(input.vfxQuality, 50) * 0.72 + finite(input.vfxGenreFit, 50) * 0.28);
  const craft = clamp(
    finite(input.cinematographyQuality, 55) * 0.3 +
    average(specialistScores, 48) * 0.28 +
    departments * 0.27 +
    vfxSupport * 0.15,
  );

  const participants = [
    input.writer, input.director, ...(input.cast ?? []),
    input.cinematographer, input.editor, input.composer,
  ].filter((value): value is TalentLike => Boolean(value));
  const talentFit = clamp(average(
    participants.map((talent) => talentGenreSkill(talent, input.genre)),
    finite(input.conceptFit, 50),
  ));
  const componentValues = [script, direction, cast, craft];
  const componentMean = average(componentValues);
  const variance = average(componentValues.map((value) => (value - componentMean) ** 2), 0);
  const execution = clamp(finite(input.productionExecution, 55));
  const collaboration = clamp(78 - Math.sqrt(variance) * 1.25 + (execution - 50) * 0.35);

  const budgetRatio = Math.max(0, input.productionBudget) / genre.productionScale;
  const budgetSupport = clamp(
    100 * (1 - Math.exp(-Math.pow(budgetRatio, balance.budgetCurveExponent))),
  );
  const weightedComponents =
    script * balance.componentWeights.script +
    direction * balance.componentWeights.direction +
    cast * balance.componentWeights.cast +
    craft * balance.componentWeights.craft;
  const interactionRaw =
    ((script - 50) * (direction - 50) + (cast - 50) * (craft - 50)) / 400;
  const interaction = clamp(
    interactionRaw,
    -balance.interactionLimit,
    balance.interactionLimit,
  );

  const poorFoundation = Math.min(script, direction, cast, craft, talentFit);
  const badFilmSeverity = clamp(
    (balance.badFilmThreshold - poorFoundation) / Math.max(1, balance.badFilmThreshold),
    0,
    1,
  );
  const badFilmPenalty = badFilmSeverity * balance.badFilmMaximumPenalty;
  const isBadFilm = badFilmPenalty > 0;
  const latentBeforeNoise =
    weightedComponents +
    (talentFit - 50) * balance.talentFitWeight +
    (collaboration - 50) * balance.collaborationWeight +
    ((budgetSupport - 50) / 50) * balance.budgetContribution +
    interaction -
    badFilmPenalty;
  const latentNoise = normal(rng, 0, balance.latentNoiseSd);
  const latentQuality = clamp(latentBeforeNoise + latentNoise);

  const receptionQuality = diminishingReception(latentQuality);
  const lens = balance.genreReceptionLenses[genreKey(input.genre)];
  const conceptFit = clamp(finite(input.conceptFit, talentFit));
  const cinematography = clamp(finite(input.cinematographyQuality, craft));
  const starAppeal = aggregateCastAppeal(input.cast ?? []);
  const familiarity = clamp(finite(input.franchiseFamiliarity, 50));
  const ambitionScale = clamp(
    budgetSupport * 0.31 +
    vfxSupport * 0.23 +
    cinematography * 0.2 +
    departments * 0.16 +
    craft * 0.1,
  );
  const executedAmbition = clamp(Math.sqrt(
    ambitionScale *
    clamp(direction * 0.28 + craft * 0.28 + collaboration * 0.24 + talentFit * 0.2),
  ));
  const criticDimensions = {
    script,
    direction,
    craft,
    cast,
    collaboration,
    ambition: executedAmbition,
  };
  const audienceDimensions = {
    castExperience: cast,
    genreSatisfaction: clamp(
      talentFit * 0.4 + conceptFit * 0.2 + direction * 0.15 +
      cast * 0.12 + craft * 0.13,
    ),
    spectacle: clamp(
      budgetSupport * 0.27 + vfxSupport * 0.24 + cinematography * 0.2 +
      departments * 0.15 + executedAmbition * 0.14,
    ),
    entertainment: clamp(
      cast * 0.25 + direction * 0.2 + craft * 0.18 +
      collaboration * 0.2 + conceptFit * 0.17,
    ),
    starAppeal,
    familiarity,
  };
  const criticLensScore = clamp(weightedScore(
    criticDimensions,
    lens.critic as unknown as Record<string, number>,
  ));
  const audienceLensScore = clamp(weightedScore(
    audienceDimensions,
    lens.audience as unknown as Record<string, number>,
  ));
  const criticPreferenceDelta = clamp(
    (criticLensScore - weightedComponents) * balance.criticLensStrength,
    -balance.criticLensMaximumAdjustment,
    balance.criticLensMaximumAdjustment,
  );
  const audiencePreferenceDelta = clamp(
    (audienceLensScore - weightedComponents) * balance.audienceLensStrength,
    -balance.audienceLensMaximumAdjustment,
    balance.audienceLensMaximumAdjustment,
  );
  // Genre affects what each group values above. Keep only a tiny centered prior
  // so genres are not mechanically praised or punished regardless of execution.
  const criticGenrePrior = clamp(genre.criticBias * 0.15, -0.75, 0.75);
  const audienceGenrePrior = clamp(genre.audienceBias * 0.15, -0.75, 0.75);
  const expectedCriticScore = clamp(
    receptionQuality + criticPreferenceDelta + criticGenrePrior,
  );
  const expectedAudienceExperience = clamp(
    receptionQuality + audiencePreferenceDelta + audienceGenrePrior,
  );
  const correlation = clamp(balance.criticAudienceCorrelation, 0, 0.99);
  const sharedShock = normal(rng);
  const criticIndependent = normal(rng);
  const audienceIndependent = normal(rng);
  const sharedWeight = Math.sqrt(correlation);
  const independentWeight = Math.sqrt(1 - correlation);
  const criticShock = balance.criticNoiseSd *
    (sharedWeight * sharedShock + independentWeight * criticIndependent);
  const audienceShock = balance.audienceNoiseSd *
    (sharedWeight * sharedShock + independentWeight * audienceIndependent);

  const expectation = clamp(finite(
    input.audienceExpectation,
    expectedAudienceExperience + audienceShock,
  ));
  const audienceExperienceScore100 = clamp(expectedAudienceExperience + audienceShock);
  const deliveryGap = audienceExperienceScore100 - expectation;
  const expectationModifier = balance.expectationModifierMaximum *
    Math.tanh(deliveryGap / Math.max(1, balance.expectationResponseScale));
  const expectedDeliveryGap = expectedAudienceExperience - expectation;
  const expectedExpectationModifier = balance.expectationModifierMaximum *
    Math.tanh(expectedDeliveryGap / Math.max(1, balance.expectationResponseScale));
  const expectedAudienceScore = clamp(
    expectedAudienceExperience + expectedExpectationModifier,
  );

  const latentEliteFactor = Math.pow(clamp((latentQuality - 82) / 18, 0, 1), 3);
  const criticEliteFactor = Math.pow(clamp((expectedCriticScore - 86) / 14, 0, 1), 2);
  const audienceEliteFactor = Math.pow(
    clamp((expectedAudienceExperience - 86) / 14, 0, 1),
    2,
  );
  const criticPerfectChance = balance.perfectScoreBaseChance *
    latentEliteFactor * criticEliteFactor * balance.perfectScoreEliteMultiplier;
  const audiencePerfectChance = balance.perfectScoreBaseChance *
    latentEliteFactor * audienceEliteFactor * balance.perfectScoreEliteMultiplier;
  const isCriticPerfect = chance(rng, criticPerfectChance);
  const isAudiencePerfect = chance(rng, audiencePerfectChance);
  const isPerfectScore = isCriticPerfect || isAudiencePerfect;
  const criticScore = isCriticPerfect
    ? 100
    : Math.round(clamp(expectedCriticScore + criticShock, 0, 99));
  const audienceScore100 = isAudiencePerfect
    ? 100
    : Math.round(clamp(
      audienceExperienceScore100 + expectationModifier,
      0,
      99.4,
    ) * 10) / 10;

  return {
    criticScore,
    audienceScore: Math.round(audienceScore100) / 10,
    audienceScore100,
    audienceExperienceScore100: Math.round(audienceExperienceScore100 * 10) / 10,
    latentQuality: Math.round(latentQuality * 10) / 10,
    expectedCriticScore: Math.round(expectedCriticScore * 10) / 10,
    expectedAudienceExperience: Math.round(expectedAudienceExperience * 10) / 10,
    expectedAudienceScore: Math.round(expectedAudienceScore * 10) / 10,
    isBadFilm,
    isPerfectScore,
    isCriticPerfect,
    isAudiencePerfect,
    uncertainty: {
      sharedShock: Math.round(sharedShock * 1000) / 1000,
      criticShock: Math.round(criticShock * 10) / 10,
      audienceShock: Math.round(audienceShock * 10) / 10,
      randomGap: Math.round((criticShock - audienceShock) * 10) / 10,
    },
    reception: {
      sharedReception: Math.round(receptionQuality * 10) / 10,
      criticLensScore: Math.round(criticLensScore * 10) / 10,
      audienceLensScore: Math.round(audienceLensScore * 10) / 10,
      criticPreferenceDelta: Math.round(criticPreferenceDelta * 10) / 10,
      audiencePreferenceDelta: Math.round(audiencePreferenceDelta * 10) / 10,
      criticGenrePrior: Math.round(criticGenrePrior * 10) / 10,
      audienceGenrePrior: Math.round(audienceGenrePrior * 10) / 10,
      audienceExpectation: Math.round(expectation * 10) / 10,
      expectationModifier: Math.round(expectationModifier * 10) / 10,
      deliveryGap: Math.round(deliveryGap * 10) / 10,
      criticDimensions: Object.fromEntries(
        Object.entries(criticDimensions)
          .map(([key, value]) => [key, Math.round(value * 10) / 10]),
      ) as FilmQualityResult["reception"]["criticDimensions"],
      audienceDimensions: Object.fromEntries(
        Object.entries(audienceDimensions)
          .map(([key, value]) => [key, Math.round(value * 10) / 10]),
      ) as FilmQualityResult["reception"]["audienceDimensions"],
    },
    breakdown: {
      script: Math.round(script * 10) / 10,
      direction: Math.round(direction * 10) / 10,
      cast: Math.round(cast * 10) / 10,
      craft: Math.round(craft * 10) / 10,
      talentFit: Math.round(talentFit * 10) / 10,
      collaboration: Math.round(collaboration * 10) / 10,
      budgetSupport: Math.round(budgetSupport * 10) / 10,
      interaction: Math.round(interaction * 10) / 10,
      badFilmPenalty: Math.round(badFilmPenalty * 10) / 10,
    },
  };
}
