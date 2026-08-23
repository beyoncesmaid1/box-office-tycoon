import { getGenreHolidayModifier } from "@shared/holidays";
import { getBlockbusterScale, type AIStudioDecisionProfile } from "./aiDecision";

export interface ScheduledFilmLike {
  genre: string;
  productionBudget: number;
  releaseWeek?: number | null;
  releaseYear?: number | null;
}

export interface ScheduledPremiumBookingLike {
  status: string;
  accessLevel: string;
  format: string;
  startWeek: number;
  startYear: number;
  durationWeeks: number;
}

export interface AIReleaseDateInput {
  earliestWeek: number;
  earliestYear: number;
  genre: string;
  productionBudget: number;
  calendarFilms: readonly ScheduledFilmLike[];
  profile: AIStudioDecisionProfile;
  premiumCalendar?: readonly ScheduledPremiumBookingLike[];
}

const absoluteWeek = (week: number, year: number): number => year * 52 + week;

const normalizeGenre = (genre: string): string =>
  genre.toLowerCase().replace(/[^a-z]/g, "");

const COMMERCIAL_NEIGHBORS: Record<string, ReadonlySet<string>> = {
  action: new Set(["scifi", "fantasy", "thriller"]),
  scifi: new Set(["action", "fantasy", "thriller"]),
  fantasy: new Set(["action", "scifi", "animation"]),
  animation: new Set(["fantasy", "comedy", "musicals"]),
  thriller: new Set(["action", "scifi", "horror", "drama"]),
  horror: new Set(["thriller"]),
  comedy: new Set(["animation", "romance", "musicals"]),
  romance: new Set(["comedy", "drama", "musicals"]),
  drama: new Set(["romance", "thriller"]),
  musicals: new Set(["animation", "comedy", "romance"]),
};

function releaseAudienceOverlap(leftGenre: string, rightGenre: string): number {
  const left = normalizeGenre(leftGenre);
  const right = normalizeGenre(rightGenre);
  if (left === right) return 1.25;
  if (COMMERCIAL_NEIGHBORS[left]?.has(right) || COMMERCIAL_NEIGHBORS[right]?.has(left)) {
    return 1;
  }
  return 0.65;
}

function isTentpole(film: Pick<ScheduledFilmLike, "genre" | "productionBudget">): boolean {
  return ["action", "scifi", "fantasy", "animation"].includes(
    normalizeGenre(film.genre),
  ) && (film.productionBudget >= 170_000_000 ||
    getBlockbusterScale(film.productionBudget) >= 0.55);
}

/**
 * Chooses among the first nine viable release weeks. Crowding is weighted by
 * the size and audience overlap of already scheduled films; it is not a hard
 * ban, so an unusually aggressive studio can still accept a real showdown.
 */
export function chooseAIReleaseDate(
  input: AIReleaseDateInput,
  rng: () => number = Math.random,
): { releaseWeek: number; releaseYear: number } {
  let best = {
    releaseWeek: input.earliestWeek,
    releaseYear: input.earliestYear,
    utility: -Infinity,
  };
  const incomingScale = getBlockbusterScale(input.productionBudget);
  const incomingTentpole = isTentpole(input);
  const premiumCalendar = input.premiumCalendar ?? [];

  for (let offset = 0; offset <= 8; offset += 1) {
    let releaseWeek = input.earliestWeek + offset;
    let releaseYear = input.earliestYear;
    while (releaseWeek > 52) {
      releaseWeek -= 52;
      releaseYear += 1;
    }
    const sameWeek = input.calendarFilms.filter(film =>
      film.releaseWeek === releaseWeek && film.releaseYear === releaseYear
    );
    const directCompetition = sameWeek.filter(film =>
      normalizeGenre(film.genre) === normalizeGenre(input.genre)).length;
    const tentpoleCount = sameWeek.filter(isTentpole).length;
    const weightedCompetition = sameWeek.reduce((sum, film) => {
      const rivalScale = getBlockbusterScale(film.productionBudget || 0);
      const releaseSize = 0.28 + rivalScale * 0.72;
      return sum + releaseSize * releaseAudienceOverlap(input.genre, film.genre);
    }, 0);

    const candidateAbsoluteWeek = absoluteWeek(releaseWeek, releaseYear);
    const activeExclusiveFormats = premiumCalendar.filter(booking => {
      if (booking.status !== "secured" || booking.accessLevel !== "exclusive") return false;
      const start = absoluteWeek(booking.startWeek, booking.startYear);
      return candidateAbsoluteWeek >= start &&
        candidateAbsoluteWeek < start + booking.durationWeeks;
    });
    const normalized = normalizeGenre(input.genre);
    const valuesImax = ["action", "scifi", "fantasy", "animation"].includes(normalized);
    const valuesDolby = ["horror", "action", "scifi", "thriller", "musicals"].includes(normalized);
    const imaxLockPenalty = valuesImax
      ? activeExclusiveFormats.filter(booking => booking.format === "imax").length * 0.055
      : 0;
    const dolbyLockPenalty = valuesDolby
      ? activeExclusiveFormats.filter(booking => booking.format === "dolby").length * 0.04
      : 0;

    const crowdingPenalty =
      weightedCompetition * (0.16 + incomingScale * 0.18) +
      directCompetition * 0.08 +
      Math.max(0, sameWeek.length - 2) * 0.5 +
      (incomingTentpole ? Math.max(0, tentpoleCount + 1 - 2) * 0.72 : 0) +
      (!incomingTentpole ? Math.max(0, tentpoleCount - 1) * 0.12 : 0);
    const riskAdjustedCrowding = crowdingPenalty *
      (1 - Math.max(0, Math.min(1, input.profile.riskTolerance)) * 0.16);
    const holidayFit = getGenreHolidayModifier(releaseWeek, input.genre);
    const observationNoise = (rng() - 0.5) *
      (0.24 - input.profile.decisionQuality * 0.1);
    const utility =
      (holidayFit - 1) * 0.9 -
      riskAdjustedCrowding -
      imaxLockPenalty -
      dolbyLockPenalty -
      offset * 0.014 +
      observationNoise;
    if (utility > best.utility) best = { releaseWeek, releaseYear, utility };
  }

  return { releaseWeek: best.releaseWeek, releaseYear: best.releaseYear };
}
