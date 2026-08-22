const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const smoothstep = (value: number): number => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

const normalizeGenre = (genre: string): string =>
  genre.toLowerCase().replace(/[^a-z]/g, "");

const RELATED_GENRES: Record<string, ReadonlySet<string>> = {
  action: new Set(["scifi", "fantasy", "thriller"]),
  scifi: new Set(["action", "fantasy", "thriller"]),
  fantasy: new Set(["action", "scifi", "animation"]),
  thriller: new Set(["action", "scifi", "horror", "drama"]),
  horror: new Set(["thriller"]),
  animation: new Set(["fantasy", "comedy", "musicals"]),
  comedy: new Set(["animation", "romance", "musicals"]),
  romance: new Set(["comedy", "drama", "musicals"]),
  drama: new Set(["romance", "thriller"]),
  musicals: new Set(["animation", "comedy", "romance"]),
};

export interface CompetitionTarget {
  genre: string;
}

export interface CompetitionRival {
  genre: string;
  isOpening: boolean;
  weeksInRelease: number;
  previousWeekGross?: number;
  territoryMarketShare: number;
  awareness: number;
  interest: number;
  commercialAppeal: number;
  launchHook: number;
  blockbusterDeployment: number;
  marketingBudget: number;
  eventIntensity?: number;
}

function audienceOverlap(targetGenre: string, rivalGenre: string): number {
  const target = normalizeGenre(targetGenre);
  const rival = normalizeGenre(rivalGenre);
  if (target === rival) return 1.25;
  if (RELATED_GENRES[target]?.has(rival) || RELATED_GENRES[rival]?.has(target)) {
    return 0.98;
  }
  return 0.65;
}

function marketingStrength(marketingBudget: number): number {
  const logarithmicBudget = Math.log10(Math.max(1_000_000, marketingBudget));
  return smoothstep((logarithmicBudget - 6.2) / 2);
}

function plannedStrength(rival: CompetitionRival): number {
  const eventStrength = clamp01((rival.eventIntensity ?? 0) / 0.3);
  return clamp01(
    clamp01(rival.awareness / 100) * 0.27 +
    clamp01(rival.interest / 100) * 0.22 +
    clamp01(rival.commercialAppeal / 100) * 0.13 +
    clamp01(rival.launchHook / 100) * 0.13 +
    clamp01(rival.blockbusterDeployment) * 0.13 +
    marketingStrength(rival.marketingBudget) * 0.08 +
    eventStrength * 0.04,
  );
}

function grossStrength(rival: CompetitionRival): number | null {
  if (!rival.previousWeekGross || rival.previousWeekGross <= 0) return null;
  const marketScale = Math.max(0.03, rival.territoryMarketShare / 0.35);
  const domesticEquivalentGross = rival.previousWeekGross / marketScale;
  const logarithmicGross = Math.log10(Math.max(500_000, domesticEquivalentGross));
  return smoothstep((logarithmicGross - 6) / 2.1);
}

function rivalContribution(rival: CompetitionRival): number {
  const plan = plannedStrength(rival);
  let strength = plan;
  if (!rival.isOpening) {
    const actualGrossStrength = grossStrength(rival);
    strength = actualGrossStrength == null
      ? plan * Math.exp(-Math.max(0, rival.weeksInRelease - 1) * 0.22)
      : actualGrossStrength * 0.76 + plan * 0.24;
  }

  const eventStrength = clamp01((rival.eventIntensity ?? 0) / 0.3);
  const baseContribution = 2 + 30 * smoothstep((strength - 0.18) / 0.72);
  const eventContribution = 7 * eventStrength;
  const ageMultiplier = rival.isOpening
    ? 1
    : Math.max(0.72, 1 - Math.max(0, rival.weeksInRelease - 1) * 0.025);
  return Math.min(52, (baseContribution + eventContribution) * ageMultiplier);
}

/**
 * Converts the actual films competing in a territory this week into one
 * bounded pressure score. Individual rivals combine with diminishing returns,
 * so two tentpoles can seriously crowd each other without making demand zero.
 */
export function calculateCompetitionPressure(
  target: CompetitionTarget,
  rivals: CompetitionRival[],
): number {
  let remainingOpportunity = 1;
  for (const rival of rivals) {
    const contribution = Math.min(
      0.55,
      rivalContribution(rival) * audienceOverlap(target.genre, rival.genre) / 100,
    );
    remainingOpportunity *= 1 - contribution;
  }
  return Math.round(Math.min(85, (1 - remainingOpportunity) * 100) * 10) / 10;
}

