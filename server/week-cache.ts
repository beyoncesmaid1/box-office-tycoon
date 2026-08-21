import { MemStorage } from "./mem-storage";
import { persistentStorage, setStorageMutationListener } from "./storage";
import { applySaveTalentAvailability } from "./save-scope";

export class WeekSaveCache extends MemStorage {
  readonly playerStudioId: string;
  lastAccessedAt = Date.now();
  private baseline = new Map<string, string>();

  constructor(playerStudioId: string) {
    super();
    this.playerStudioId = playerStudioId;
  }

  override hydrateCollections(collections: Record<string, any[]>): void {
    super.hydrateCollections(collections);
    this.captureBaseline();
  }

  async flush(): Promise<void> {
    const current = this.exportCollections();
    const changed = Object.fromEntries(Object.entries(current).map(([collection, rows]) => [
      collection,
      rows.filter(row => this.baseline.get(`${collection}:${row.id}`) !== JSON.stringify(row)),
    ]));
    // Talent definitions are shared reference data. Busy state is reconstructed
    // from this save's films and must never be written into the global catalog.
    changed.talent = [];
    await persistentStorage.commitWeekSnapshot(changed);
    this.captureBaseline(current);
    this.lastAccessedAt = Date.now();
  }

  private captureBaseline(collections = this.exportCollections()): void {
    this.baseline.clear();
    for (const [collection, rows] of Object.entries(collections)) {
      for (const row of rows) this.baseline.set(`${collection}:${row.id}`, JSON.stringify(row));
    }
  }
}

const saveCaches = new Map<string, Promise<WeekSaveCache>>();

async function loadWeekSaveCache(playerStudioId: string): Promise<WeekSaveCache> {
  const playerStudio = await persistentStorage.getStudio(playerStudioId);
  if (!playerStudio) throw new Error("Studio not found");

  const allStudios = await persistentStorage.getAllStudios();
  const hasLinkedAIStudios = allStudios.some(studio => studio.playerGameId === playerStudioId);
  const singlePlayerSavesOnDevice = allStudios.filter(studio =>
    !studio.isAI && !studio.gameSessionId && studio.deviceId === playerStudio.deviceId
  ).length;
  const mayUseLegacyAIStudios = !playerStudio.gameSessionId &&
    !hasLinkedAIStudios && singlePlayerSavesOnDevice === 1;
  const relevantStudios = allStudios.filter(studio => {
    if (studio.id === playerStudioId || studio.playerGameId === playerStudioId) return true;
    if (mayUseLegacyAIStudios && studio.isAI && !studio.playerGameId &&
        !studio.gameSessionId && studio.deviceId === playerStudio.deviceId) return true;
    return Boolean(playerStudio.gameSessionId && studio.gameSessionId === playerStudio.gameSessionId);
  });
  const studioIds = relevantStudios.map(studio => studio.id);
  const films = await persistentStorage.getFilmsByStudioIds(studioIds);
  const filmIds = films.map(film => film.id);

  const [
    talent,
    filmReleases,
    filmRoles,
    marketingActions,
    premiumBookings,
    streamingDeals,
    emails,
    awardShows,
    awardCategories,
    awardNominations,
    awardCeremonies,
    slateFinancingDeals,
  ] = await Promise.all([
    persistentStorage.getAllTalentForSave(playerStudioId),
    persistentStorage.getFilmReleasesByFilms(filmIds),
    persistentStorage.getFilmRolesByFilms(filmIds),
    persistentStorage.getMarketingActionsByFilms(filmIds),
    persistentStorage.getPremiumBookingsByFilms(filmIds),
    persistentStorage.getStreamingDealsByPlayers(studioIds),
    persistentStorage.getEmailsByPlayer(playerStudioId),
    persistentStorage.getAllAwardShows(),
    persistentStorage.getAllAwardCategories(),
    persistentStorage.getNominationsByPlayer(playerStudioId),
    persistentStorage.getCeremoniesByPlayer(playerStudioId),
    persistentStorage.getSlateFinancingDealsByPlayer(playerStudioId),
  ]);

  const cache = new WeekSaveCache(playerStudioId);
  const saveTalent = applySaveTalentAvailability(
    talent,
    films,
    playerStudio.currentWeek,
    playerStudio.currentYear,
  );
  cache.hydrateCollections({
    studios: relevantStudios,
    films,
    talent: saveTalent,
    filmReleases,
    filmRoles,
    marketingActions,
    premiumBookings,
    streamingDeals,
    emails,
    awardShows,
    awardCategories,
    awardNominations,
    awardCeremonies,
    slateFinancingDeals,
  });
  return cache;
}

export function getWeekSaveCache(playerStudioId: string): Promise<WeekSaveCache> {
  let cached = saveCaches.get(playerStudioId);
  if (!cached) {
    cached = loadWeekSaveCache(playerStudioId).catch(error => {
      saveCaches.delete(playerStudioId);
      throw error;
    });
    saveCaches.set(playerStudioId, cached);
  }
  return cached;
}

export function warmWeekSaveCache(playerStudioId: string): void {
  void getWeekSaveCache(playerStudioId).catch(error => {
    console.warn(`[WEEK-CACHE] Could not warm ${playerStudioId}:`, error?.message || error);
  });
}

export function invalidateWeekSaveCache(playerStudioId?: string): void {
  if (playerStudioId) {
    saveCaches.delete(playerStudioId);
    savesToRewarm.delete(playerStudioId);
  } else {
    saveCaches.clear();
    savesToRewarm.clear();
  }
  if (savesToRewarm.size === 0 && rewarmTimer) {
    clearTimeout(rewarmTimer);
    rewarmTimer = undefined;
  }
}

const savesToRewarm = new Set<string>();
let rewarmTimer: ReturnType<typeof setTimeout> | undefined;

setStorageMutationListener(() => {
  for (const saveId of Array.from(saveCaches.keys())) savesToRewarm.add(saveId);
  saveCaches.clear();
  if (rewarmTimer) clearTimeout(rewarmTimer);
  rewarmTimer = setTimeout(() => {
    rewarmTimer = undefined;
    const saveIds = Array.from(savesToRewarm);
    savesToRewarm.clear();
    for (const saveId of saveIds) warmWeekSaveCache(saveId);
  }, 250);
});
