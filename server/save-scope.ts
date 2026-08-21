import type { Film, Studio, Talent } from "@shared/schema";

export function getSinglePlayerSaveStudios(playerStudioId: string, studios: Studio[]): Studio[] {
  return studios.filter(studio =>
    studio.id === playerStudioId || studio.playerGameId === playerStudioId
  );
}

export function getSinglePlayerSaveIdForStudio(studio: Studio): string {
  return studio.playerGameId || studio.id;
}

function absoluteWeek(week: number, year: number): number {
  return year * 52 + week;
}

export function applySaveTalentAvailability(
  talent: Talent[],
  films: Film[],
  currentWeek: number,
  currentYear: number,
): Talent[] {
  const currentAbsolute = absoluteWeek(currentWeek, currentYear);
  const assignments = new Map<string, {
    filmId: string;
    busyUntilWeek: number;
    busyUntilYear: number;
    busyUntilAbsolute: number;
  }>();

  for (const film of films) {
    if (film.status === "archived" || film.phase === "released") continue;
    const createdAbsolute = absoluteWeek(film.createdAtWeek || 1, film.createdAtYear || 2025);
    const busyUntilAbsolute = createdAbsolute +
      (film.developmentDurationWeeks || 0) + 1 +
      (film.preProductionDurationWeeks || 0) +
      (film.productionDurationWeeks || 0);
    if (busyUntilAbsolute <= currentAbsolute) continue;

    const busyUntilYear = Math.floor((busyUntilAbsolute - 1) / 52);
    const busyUntilWeek = ((busyUntilAbsolute - 1) % 52) + 1;
    const talentIds = [
      film.directorId,
      film.writerId,
      film.composerId,
      ...(film.castIds || []),
    ].filter((id): id is string => Boolean(id));

    for (const talentId of talentIds) {
      const existing = assignments.get(talentId);
      if (!existing || existing.busyUntilAbsolute < busyUntilAbsolute) {
        assignments.set(talentId, {
          filmId: film.id,
          busyUntilWeek,
          busyUntilYear,
          busyUntilAbsolute,
        });
      }
    }
  }

  return talent.map(candidate => {
    const assignment = assignments.get(candidate.id);
    return {
      ...candidate,
      currentFilmId: assignment?.filmId || null,
      busyUntilWeek: assignment?.busyUntilWeek || null,
      busyUntilYear: assignment?.busyUntilYear || null,
    };
  });
}
