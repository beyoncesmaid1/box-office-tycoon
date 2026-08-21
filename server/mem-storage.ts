import { 
  type User, type InsertUser, 
  type Studio, type InsertStudio, 
  type Film, type InsertFilm, 
  type Talent, type InsertTalent,
  type SaveTalentState, type InsertSaveTalentState,
  type StreamingService, type InsertStreamingService,
  type StreamingDeal, type InsertStreamingDeal,
  type Email, type InsertEmail,
  type AwardShow, type InsertAwardShow,
  type AwardCategory, type InsertAwardCategory,
  type AwardNomination, type InsertAwardNomination,
  type AwardCeremony, type InsertAwardCeremony,
  type FilmRelease, type InsertFilmRelease,
  type MarketingAction, type InsertMarketingAction,
  type PremiumBooking, type InsertPremiumBooking,
  type FilmMilestone, type InsertFilmMilestone,
  type FilmRole, type InsertFilmRole,
  type Franchise, type InsertFranchise,
  type GameSession, type InsertGameSession,
  type GameSessionPlayer, type InsertGameSessionPlayer,
  type GameActivityLog, type InsertGameActivityLog,
  type SlateFinancingDeal, type InsertSlateFinancingDeal,
  type TVShow, type InsertTVShow,
  type TVSeason, type InsertTVSeason,
  type TVEpisode, type InsertTVEpisode,
  type TVDeal, type InsertTVDeal,
  type TVNetwork, type InsertTVNetwork,
  type MarketplaceScript, type InsertMarketplaceScript,
  type MarketplaceScriptPurchase, type InsertMarketplaceScriptPurchase,
  type CoProductionDeal, type InsertCoProductionDeal,
} from "@shared/schema";
import { IStorage } from "./storage";
import * as fs from "fs";
import * as path from "path";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class MemStorage implements IStorage {
  async commitWeekSnapshot(collections: Record<string, any[]>): Promise<void> {
    this.hydrateCollections(collections);
  }

  async deleteSinglePlayerSave(playerStudioId: string): Promise<void> {
    const player = this.studios.get(playerStudioId);
    if (!player) throw new Error("Studio not found");
    if (player.gameSessionId) throw new Error("Multiplayer saves use their own deletion flow");
    const studioIds = new Set(Array.from(this.studios.values())
      .filter(studio => studio.id === playerStudioId || studio.playerGameId === playerStudioId)
      .map(studio => studio.id));
    const filmIds = new Set(Array.from(this.films.values())
      .filter(film => studioIds.has(film.studioId)).map(film => film.id));
    const showIds = new Set(Array.from(this.tvShows.values())
      .filter(show => studioIds.has(show.studioId)).map(show => show.id));
    const deleteMatching = (map: Map<string, any>, predicate: (row: any) => boolean) => {
      for (const [rowId, row] of Array.from(map.entries())) if (predicate(row)) map.delete(rowId);
    };
    for (const map of [this.filmReleases, this.marketingActions, this.premiumBookings,
      this.filmMilestones, this.filmRoles]) {
      deleteMatching(map, row => filmIds.has(row.filmId));
    }
    deleteMatching(this.streamingDeals, row => filmIds.has(row.filmId) || studioIds.has(row.playerGameId));
    deleteMatching(this.awardNominations, row => filmIds.has(row.filmId) || row.playerGameId === playerStudioId);
    deleteMatching(this.awardCeremonies, row => row.playerGameId === playerStudioId);
    deleteMatching(this.emails, row => row.playerGameId === playerStudioId);
    deleteMatching(this.slateFinancingDeals, row => row.playerGameId === playerStudioId);
    deleteMatching(this.coProductionDeals, row => filmIds.has(row.filmId) || row.playerGameId === playerStudioId);
    deleteMatching(this.marketplaceScriptPurchases, row => row.playerGameId === playerStudioId);
    deleteMatching(this.tvDeals, row => showIds.has(row.tvShowId) || row.playerGameId === playerStudioId);
    deleteMatching(this.tvEpisodes, row => showIds.has(row.tvShowId));
    deleteMatching(this.tvSeasons, row => showIds.has(row.tvShowId));
    deleteMatching(this.tvShows, row => showIds.has(row.id));
    deleteMatching(this.franchises, row => studioIds.has(row.studioId));
    deleteMatching(this.films, row => filmIds.has(row.id));
    deleteMatching(this.studios, row => studioIds.has(row.id));
  }
  protected users: Map<string, User> = new Map();
  protected studios: Map<string, Studio> = new Map();
  protected films: Map<string, Film> = new Map();
  protected talentMap: Map<string, Talent> = new Map();
  protected streamingServices: Map<string, StreamingService> = new Map();
  protected streamingDeals: Map<string, StreamingDeal> = new Map();
  protected emails: Map<string, Email> = new Map();
  protected awardShows: Map<string, AwardShow> = new Map();
  protected awardCategories: Map<string, AwardCategory> = new Map();
  protected awardNominations: Map<string, AwardNomination> = new Map();
  protected awardCeremonies: Map<string, AwardCeremony> = new Map();
  protected filmReleases: Map<string, FilmRelease> = new Map();
  protected marketingActions: Map<string, MarketingAction> = new Map();
  protected premiumBookings: Map<string, PremiumBooking> = new Map();
  protected filmMilestones: Map<string, FilmMilestone> = new Map();
  protected filmRoles: Map<string, FilmRole> = new Map();
  protected franchises: Map<string, Franchise> = new Map();
  protected gameSessions: Map<string, GameSession> = new Map();
  protected gameSessionPlayers: Map<string, GameSessionPlayer> = new Map();
  protected gameActivityLogs: Map<string, GameActivityLog> = new Map();
  protected tvShows: Map<string, TVShow> = new Map();
  protected tvSeasons: Map<string, TVSeason> = new Map();
  protected tvEpisodes: Map<string, TVEpisode> = new Map();
  protected tvDeals: Map<string, TVDeal> = new Map();
  protected tvNetworks: Map<string, TVNetwork> = new Map();
  protected marketplaceScripts: Map<string, MarketplaceScript> = new Map();
  protected marketplaceScriptPurchases: Map<string, MarketplaceScriptPurchase> = new Map();
  protected coProductionDeals: Map<string, CoProductionDeal> = new Map();
  protected slateFinancingDeals: Map<string, SlateFinancingDeal> = new Map();

  hydrateCollections(collections: Record<string, any[]>): void {
    const targets: Record<string, Map<string, any>> = {
      studios: this.studios,
      films: this.films,
      talent: this.talentMap,
      streamingServices: this.streamingServices,
      streamingDeals: this.streamingDeals,
      emails: this.emails,
      awardShows: this.awardShows,
      awardCategories: this.awardCategories,
      awardNominations: this.awardNominations,
      awardCeremonies: this.awardCeremonies,
      filmReleases: this.filmReleases,
      marketingActions: this.marketingActions,
      premiumBookings: this.premiumBookings,
      filmMilestones: this.filmMilestones,
      filmRoles: this.filmRoles,
      franchises: this.franchises,
      tvShows: this.tvShows,
      tvSeasons: this.tvSeasons,
      tvEpisodes: this.tvEpisodes,
      tvDeals: this.tvDeals,
      tvNetworks: this.tvNetworks,
      marketplaceScripts: this.marketplaceScripts,
      coProductionDeals: this.coProductionDeals,
      slateFinancingDeals: this.slateFinancingDeals,
    };
    for (const [name, rows] of Object.entries(collections)) {
      const target = targets[name];
      if (!target) continue;
      for (const row of rows) target.set(row.id, structuredClone(row));
    }
  }

  exportCollections(): Record<string, any[]> {
    return {
      studios: Array.from(this.studios.values()),
      films: Array.from(this.films.values()),
      talent: Array.from(this.talentMap.values()),
      streamingDeals: Array.from(this.streamingDeals.values()),
      emails: Array.from(this.emails.values()),
      awardNominations: Array.from(this.awardNominations.values()),
      awardCeremonies: Array.from(this.awardCeremonies.values()),
      filmReleases: Array.from(this.filmReleases.values()),
      marketingActions: Array.from(this.marketingActions.values()),
      premiumBookings: Array.from(this.premiumBookings.values()),
      filmRoles: Array.from(this.filmRoles.values()),
      slateFinancingDeals: Array.from(this.slateFinancingDeals.values()),
    };
  }

  containsEntity(collection: string, id: string): boolean {
    const collections = this.exportCollections();
    return (collections[collection] || []).some(row => row.id === id);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = generateId();
    const user: User = { 
      id, 
      username: insertUser.username,
      password: insertUser.password,
      displayName: insertUser.displayName ?? null,
      avatarUrl: null,
      isOnline: false,
      lastSeenAt: null,
      createdAt: Math.floor(Date.now() / 1000),
    };
    this.users.set(id, user);
    return user;
  }

  async getStudio(id: string): Promise<Studio | undefined> {
    return this.studios.get(id);
  }

  async getAllStudios(): Promise<Studio[]> {
    return Array.from(this.studios.values());
  }

  async getStudiosByDeviceId(deviceId: string): Promise<Studio[]> {
    return Array.from(this.studios.values()).filter(studio => studio.deviceId === deviceId);
  }

  async getPlayerStudioByDeviceId(deviceId: string): Promise<Studio | undefined> {
    return Array.from(this.studios.values()).find(
      studio => studio.deviceId === deviceId && !studio.isAI,
    );
  }

  async createStudio(insertStudio: InsertStudio): Promise<Studio> {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    const studio: Studio = {
      id,
      deviceId: insertStudio.deviceId,
      userId: insertStudio.userId ?? null,
      gameSessionId: insertStudio.gameSessionId ?? null,
      name: insertStudio.name ?? "New Studio",
      budget: insertStudio.budget ?? 150000000,
      currentWeek: insertStudio.currentWeek ?? 1,
      currentYear: insertStudio.currentYear ?? 2025,
      prestigeLevel: insertStudio.prestigeLevel ?? 1,
      totalEarnings: insertStudio.totalEarnings ?? 0,
      totalAwards: insertStudio.totalAwards ?? 0,
      isAI: insertStudio.isAI ?? false,
      strategy: insertStudio.strategy ?? "balanced",
      homeTerritory: insertStudio.homeTerritory ?? "NA",
      isActive: insertStudio.isActive ?? false,
      playerGameId: insertStudio.playerGameId ?? null,
      createdAt: insertStudio.createdAt ?? now,
    };
    this.studios.set(id, studio);
    return studio;
  }

  async updateStudio(id: string, updates: Partial<InsertStudio>): Promise<Studio | undefined> {
    const studio = this.studios.get(id);
    if (!studio) return undefined;
    const updated = { ...studio, ...updates };
    this.studios.set(id, updated);
    return updated;
  }

  async deleteStudio(id: string): Promise<void> {
    this.studios.delete(id);
  }

  async getFilm(id: string): Promise<Film | undefined> {
    return this.films.get(id);
  }

  async getFilmsByStudio(studioId: string): Promise<Film[]> {
    return Array.from(this.films.values()).filter(f => f.studioId === studioId);
  }

  async getFilmsByStudioIds(studioIds: string[]): Promise<Film[]> {
    const ids = new Set(studioIds);
    return Array.from(this.films.values()).filter(film => ids.has(film.studioId));
  }

  async getAllFilms(): Promise<Film[]> {
    return Array.from(this.films.values());
  }

  async createFilm(insertFilm: InsertFilm): Promise<Film> {
    const id = generateId();
    const film: Film = {
      id,
      studioId: insertFilm.studioId,
      title: insertFilm.title,
      genre: insertFilm.genre,
      synopsis: insertFilm.synopsis ?? "",
      phase: insertFilm.phase ?? "development",
      status: insertFilm.status ?? "active",
      archivedWeek: insertFilm.archivedWeek ?? null,
      archivedYear: insertFilm.archivedYear ?? null,
      productionBudget: insertFilm.productionBudget ?? 0,
      marketingBudget: insertFilm.marketingBudget ?? 0,
      campaignLimit: insertFilm.campaignLimit ?? 0,
      campaignSpent: insertFilm.campaignSpent ?? 0,
      campaignStrategy: insertFilm.campaignStrategy ?? "balanced",
      autoManageMarketing: insertFilm.autoManageMarketing ?? false,
      talentBudget: insertFilm.talentBudget ?? 0,
      totalBudget: insertFilm.totalBudget ?? 0,
      directorId: insertFilm.directorId ?? null,
      writerId: insertFilm.writerId ?? null,
      castIds: insertFilm.castIds ?? [],
      cinematographerId: insertFilm.cinematographerId ?? null,
      editorId: insertFilm.editorId ?? null,
      composerId: insertFilm.composerId ?? null,
      vfxStudioId: insertFilm.vfxStudioId ?? null,
      scriptQuality: insertFilm.scriptQuality ?? 70,
      cinematographyQuality: insertFilm.cinematographyQuality ?? 70,
      setsBudget: insertFilm.setsBudget ?? 0,
      costumesBudget: insertFilm.costumesBudget ?? 0,
      stuntsBudget: insertFilm.stuntsBudget ?? 0,
      makeupBudget: insertFilm.makeupBudget ?? 0,
      practicalEffectsBudget: insertFilm.practicalEffectsBudget ?? 0,
      soundCrewBudget: insertFilm.soundCrewBudget ?? 0,
      hasHiredTalent: insertFilm.hasHiredTalent ?? false,
      hasEditedPostProduction: insertFilm.hasEditedPostProduction ?? false,
      createdAtWeek: insertFilm.createdAtWeek ?? 1,
      createdAtYear: insertFilm.createdAtYear ?? 2025,
      developmentDurationWeeks: insertFilm.developmentDurationWeeks ?? 2,
      preProductionDurationWeeks: insertFilm.preProductionDurationWeeks ?? 2,
      productionDurationWeeks: insertFilm.productionDurationWeeks ?? 4,
      postProductionDurationWeeks: insertFilm.postProductionDurationWeeks ?? 2,
      weeksInCurrentPhase: insertFilm.weeksInCurrentPhase ?? 0,
      releaseWeek: insertFilm.releaseWeek ?? null,
      releaseYear: insertFilm.releaseYear ?? null,
      weeklyBoxOffice: insertFilm.weeklyBoxOffice ?? [],
      weeklyBoxOfficeByCountry: insertFilm.weeklyBoxOfficeByCountry ?? [],
      totalBoxOffice: insertFilm.totalBoxOffice ?? 0,
      totalBoxOfficeByCountry: insertFilm.totalBoxOfficeByCountry ?? {},
      territoryPercentages: insertFilm.territoryPercentages ?? {},
      audienceScore: insertFilm.audienceScore ?? 0,
      criticScore: insertFilm.criticScore ?? 0,
      criticScoreBreakdown: insertFilm.criticScoreBreakdown ?? {},
      audienceScoreBreakdown: insertFilm.audienceScoreBreakdown ?? {},
      boxOfficeBreakdown: insertFilm.boxOfficeBreakdown ?? {},
      costBreakdown: insertFilm.costBreakdown ?? {},
      awards: insertFilm.awards ?? [],
      isSequel: insertFilm.isSequel ?? false,
      prequelFilmId: insertFilm.prequelFilmId ?? null,
      franchiseId: insertFilm.franchiseId ?? null,
      posterUrl: insertFilm.posterUrl ?? null,
      theaterCount: insertFilm.theaterCount ?? 0,
      imaxSuitability: insertFilm.imaxSuitability ?? 0,
      dolbySuitability: insertFilm.dolbySuitability ?? 0,
      boxOfficeModelVersion: insertFilm.boxOfficeModelVersion ?? 2,
    };
    this.films.set(id, film);
    return film;
  }

  async createFilms(filmRows: InsertFilm[]): Promise<Film[]> {
    return Promise.all(filmRows.map(film => this.createFilm(film)));
  }

  async updateFilm(id: string, updates: Partial<InsertFilm>): Promise<Film | undefined> {
    const film = this.films.get(id);
    if (!film) return undefined;
    const updated = { ...film, ...updates } as Film;
    this.films.set(id, updated);
    return updated;
  }

  async deleteFilm(id: string): Promise<void> {
    this.films.delete(id);
    for (const [actionId, action] of Array.from(this.marketingActions.entries())) {
      if (action.filmId === id) this.marketingActions.delete(actionId);
    }
    for (const [bookingId, booking] of Array.from(this.premiumBookings.entries())) {
      if (booking.filmId === id) this.premiumBookings.delete(bookingId);
    }
  }

  async getTalent(id: string): Promise<Talent | undefined> {
    return this.talentMap.get(id);
  }

  async getTalentByName(name: string): Promise<Talent | undefined> {
    return Array.from(this.talentMap.values()).find(t => t.name === name);
  }

  async getAllTalent(): Promise<Talent[]> {
    return Array.from(this.talentMap.values());
  }

  async getTalentByIds(talentIds: string[]): Promise<Talent[]> {
    const ids = new Set(talentIds);
    return Array.from(this.talentMap.values()).filter(candidate => ids.has(candidate.id));
  }

  async getTalentForSave(id: string, _playerGameId: string): Promise<Talent | undefined> {
    return this.getTalent(id);
  }

  async getAllTalentForSave(_playerGameId: string): Promise<Talent[]> {
    return this.getAllTalent();
  }

  async getTalentStateForSave(_playerGameId: string): Promise<SaveTalentState[]> {
    return [];
  }

  async upsertTalentStateForSave(state: InsertSaveTalentState): Promise<SaveTalentState> {
    return state as SaveTalentState;
  }

  async createTalent(insertTalent: InsertTalent): Promise<Talent> {
    const id = generateId();
    const t: Talent = {
      id,
      name: insertTalent.name,
      type: insertTalent.type,
      gender: insertTalent.gender ?? "unknown",
      nationality: insertTalent.nationality ?? "American",
      starRating: insertTalent.starRating ?? 3,
      askingPrice: insertTalent.askingPrice ?? 5000000,
      boxOfficeAvg: insertTalent.boxOfficeAvg ?? 100000000,
      awards: insertTalent.awards ?? 0,
      genres: insertTalent.genres ?? {},
      genreTags: insertTalent.genreTags ?? [],
      isActive: insertTalent.isActive ?? true,
      imageUrl: insertTalent.imageUrl ?? null,
      birthYear: insertTalent.birthYear ?? null,
      popularity: insertTalent.popularity ?? 50,
      performance: insertTalent.performance ?? 70,
      experience: insertTalent.experience ?? 50,
      fame: insertTalent.fame ?? 50,
      skillAction: insertTalent.skillAction ?? 50,
      skillDrama: insertTalent.skillDrama ?? 50,
      skillComedy: insertTalent.skillComedy ?? 50,
      skillThriller: insertTalent.skillThriller ?? 50,
      skillHorror: insertTalent.skillHorror ?? 50,
      skillScifi: insertTalent.skillScifi ?? 50,
      skillAnimation: insertTalent.skillAnimation ?? 50,
      skillRomance: insertTalent.skillRomance ?? 50,
      skillFantasy: insertTalent.skillFantasy ?? 50,
      skillMusicals: insertTalent.skillMusicals ?? 50,
      skillCinematography: insertTalent.skillCinematography ?? 50,
      skillEditing: insertTalent.skillEditing ?? 50,
      skillOrchestral: insertTalent.skillOrchestral ?? 50,
      skillElectronic: insertTalent.skillElectronic ?? 50,
      currentFilmId: insertTalent.currentFilmId ?? null,
      busyUntilWeek: insertTalent.busyUntilWeek ?? null,
      busyUntilYear: insertTalent.busyUntilYear ?? null,
    };
    this.talentMap.set(id, t);
    return t;
  }

  async updateTalent(id: string, updates: Partial<InsertTalent>): Promise<Talent | undefined> {
    const t = this.talentMap.get(id);
    if (!t) return undefined;
    const updated = { ...t, ...updates } as Talent;
    this.talentMap.set(id, updated);
    return updated;
  }

  async updateTalentSkillsDirect(id: string, skillFantasy: number, skillMusicals: number): Promise<void> {
    const t = this.talentMap.get(id);
    if (t) {
      t.skillFantasy = skillFantasy;
      t.skillMusicals = skillMusicals;
      this.talentMap.set(id, t);
    }
  }

  async deleteTalent(id: string): Promise<void> {
    this.talentMap.delete(id);
  }

  async isTalentInUse(id: string): Promise<boolean> {
    for (const film of this.films.values()) {
      if (film.directorId === id || film.writerId === id || film.castIds?.includes(id)) {
        return true;
      }
    }
    return false;
  }

  async seedTalent(): Promise<void> {
    const existingTalent = await this.getAllTalent();
    if (existingTalent.length > 0) return;

    const generateSkills = (
      talentGenres: string[], 
      starRating: number, 
      boxOfficeAvg: number,
      type: string,
      talentData?: any
    ) => {
      const randomSkill = () => 20 + Math.floor(Math.random() * 81);
      const fame = talentData?.fame ?? Math.min(100, Math.max(0, Math.floor(
        10 + (boxOfficeAvg / 20000000) + starRating * 5 + (Math.random() * 60) - 20
      )));
      const performance = talentData?.performance ?? randomSkill();
      const experience = talentData?.experience ?? randomSkill();
      const genreSkill = () => randomSkill();

      let askingPrice: number;
      if (talentData?.askingPrice) {
        askingPrice = talentData.askingPrice;
      } else {
        let basePrice = 50000;
        if (fame >= 85) basePrice = 7500000 + Math.random() * 17500000;
        else if (fame >= 70) basePrice = 4000000 + Math.random() * 8500000;
        else if (fame >= 55) basePrice = 1500000 + Math.random() * 4500000;
        else if (fame >= 40) basePrice = 500000 + Math.random() * 2000000;
        else if (fame >= 25) basePrice = 150000 + Math.random() * 850000;
        else basePrice = 25000 + Math.random() * 225000;

        if (type === 'director') basePrice *= 1.5;
        else if (type === 'writer') basePrice *= 0.4;
        else if (type === 'composer') basePrice *= 0.3;
        
        askingPrice = Math.floor(basePrice);
      }

      return {
        askingPrice,
        performance,
        experience,
        fame,
        skillAction: talentData?.skillAction ?? genreSkill(),
        skillDrama: talentData?.skillDrama ?? genreSkill(),
        skillComedy: talentData?.skillComedy ?? genreSkill(),
        skillThriller: talentData?.skillThriller ?? genreSkill(),
        skillHorror: talentData?.skillHorror ?? genreSkill(),
        skillScifi: talentData?.skillScifi ?? genreSkill(),
        skillAnimation: talentData?.skillAnimation ?? genreSkill(),
        skillRomance: talentData?.skillRomance ?? genreSkill(),
        skillCinematography: type === 'director' ? (talentData?.skillCinematography ?? randomSkill()) : 50,
        skillEditing: type === 'director' ? (talentData?.skillEditing ?? randomSkill()) : 50,
        skillOrchestral: type === 'composer' ? (talentData?.skillOrchestral ?? randomSkill()) : 50,
        skillElectronic: type === 'composer' ? (talentData?.skillElectronic ?? randomSkill()) : 50,
      };
    };

    try {
      const talentFilePath = path.join(process.cwd(), 'shared', 'data', 'talent.json');
      const talentData = JSON.parse(fs.readFileSync(talentFilePath, 'utf-8'));
      
      const processTalent = async (items: any[], type: string, gender?: string) => {
        for (const item of items || []) {
          const skills = generateSkills(item.genres || [], item.starRating || 3, item.boxOfficeAvg || 100000000, type, item);
          const genresObj = {
            action: skills.skillAction, drama: skills.skillDrama, comedy: skills.skillComedy,
            thriller: skills.skillThriller, horror: skills.skillHorror, scifi: skills.skillScifi,
            animation: skills.skillAnimation, romance: skills.skillRomance,
          };
          await this.createTalent({
            name: item.name,
            type: type === 'actress' ? 'actor' : type,
            gender: item.gender || gender || 'unknown',
            nationality: item.nationality || 'American',
            starRating: item.starRating || 3,
            boxOfficeAvg: item.boxOfficeAvg || 100000000,
            awards: item.awards || 0,
            genres: genresObj as any,
            imageUrl: item.imageUrl || null,
            birthYear: item.birthYear || null,
            popularity: item.popularity || 50,
            ...skills,
          });
        }
      };

      await processTalent(talentData.directors, 'director', 'unknown');
      await processTalent(talentData.actors, 'actor', 'male');
      await processTalent(talentData.actresses, 'actor', 'female');
      await processTalent(talentData.writers, 'writer', 'unknown');
      await processTalent(talentData.composers, 'composer', 'male');

      console.log('Talent seeding complete (in-memory)!');
    } catch (error) {
      console.error('Error seeding talent:', error);
      const fallbackData: InsertTalent[] = [
        { name: 'Steven Spielberg', type: 'director', starRating: 5, askingPrice: 25000000, boxOfficeAvg: 350000000, awards: 3, genres: {action: 80, drama: 90, scifi: 85} as any, performance: 95, experience: 98, fame: 99 },
        { name: 'Christopher Nolan', type: 'director', starRating: 5, askingPrice: 20000000, boxOfficeAvg: 500000000, awards: 2, genres: {action: 85, scifi: 95, thriller: 90} as any, performance: 95, experience: 85, fame: 95 },
        { name: 'Tom Hanks', type: 'actor', starRating: 5, askingPrice: 25000000, boxOfficeAvg: 200000000, awards: 2, genres: {drama: 95, comedy: 80} as any, performance: 95, experience: 95, fame: 98 },
      ];
      for (const t of fallbackData) {
        await this.createTalent(t);
      }
    }
  }

  async getStreamingService(id: string): Promise<StreamingService | undefined> {
    return this.streamingServices.get(id);
  }

  async getAllStreamingServices(): Promise<StreamingService[]> {
    return Array.from(this.streamingServices.values());
  }

  async createStreamingService(service: InsertStreamingService): Promise<StreamingService> {
    const id = service.id || generateId();
    const s: StreamingService = {
      id,
      name: service.name,
      color: service.color ?? "#000000",
      description: service.description ?? null,
      subscriberCount: service.subscriberCount ?? 0,
      budget: service.budget ?? 1000000000,
      preferredGenres: service.preferredGenres ?? [],
      minQualityScore: service.minQualityScore ?? 60,
      maxDealsPerYear: service.maxDealsPerYear ?? 20,
    };
    this.streamingServices.set(id, s);
    return s;
  }

  async seedStreamingServices(): Promise<void> {
    const existing = await this.getAllStreamingServices();
    if (existing.length > 0) return;

    const services = [
      { id: 'streamflix', name: 'StreamFlix', color: '#E50914', description: 'Global entertainment leader', subscriberCount: 200000000, budget: 15000000000 },
      { id: 'prime-stream', name: 'Prime Stream', color: '#00A8E1', description: 'Premium streaming destination', subscriberCount: 150000000, budget: 12000000000 },
      { id: 'max-plus', name: 'Max Plus', color: '#5822B4', description: 'Quality content curator', subscriberCount: 80000000, budget: 8000000000 },
      { id: 'hulu-plus', name: 'Hulu+', color: '#1CE783', description: 'Fresh entertainment daily', subscriberCount: 50000000, budget: 5000000000 },
      { id: 'galaxy-plus', name: 'Galaxy+', color: '#113CCF', description: 'Family entertainment hub', subscriberCount: 100000000, budget: 10000000000 },
    ];
    for (const s of services) {
      await this.createStreamingService(s);
    }
  }

  async getStreamingDeal(id: string): Promise<StreamingDeal | undefined> {
    return this.streamingDeals.get(id);
  }

  async getStreamingDealsByFilm(filmId: string): Promise<StreamingDeal[]> {
    return Array.from(this.streamingDeals.values()).filter(d => d.filmId === filmId);
  }

  async getStreamingDealsByFilms(filmIds: string[]): Promise<StreamingDeal[]> {
    const ids = new Set(filmIds);
    return Array.from(this.streamingDeals.values()).filter(deal => deal.filmId && ids.has(deal.filmId));
  }

  async getStreamingDealsByPlayer(playerGameId: string): Promise<StreamingDeal[]> {
    return Array.from(this.streamingDeals.values()).filter(d => d.playerGameId === playerGameId);
  }

  async getStreamingDealsByPlayers(playerGameIds: string[]): Promise<StreamingDeal[]> {
    const ids = new Set(playerGameIds);
    return Array.from(this.streamingDeals.values()).filter(deal => ids.has(deal.playerGameId));
  }

  async getStreamingDealsByService(streamingServiceId: string): Promise<StreamingDeal[]> {
    return Array.from(this.streamingDeals.values()).filter(d => d.streamingServiceId === streamingServiceId);
  }

  async createStreamingDeal(deal: InsertStreamingDeal): Promise<StreamingDeal> {
    const id = generateId();
    const d: StreamingDeal = {
      id,
      filmId: deal.filmId ?? null,
      streamingServiceId: deal.streamingServiceId,
      playerGameId: deal.playerGameId,
      licenseFee: deal.licenseFee ?? 0,
      weeklyRevenue: deal.weeklyRevenue ?? 0,
      totalRevenue: deal.totalRevenue ?? 0,
      startWeek: deal.startWeek,
      startYear: deal.startYear,
      endWeek: deal.endWeek ?? null,
      endYear: deal.endYear ?? null,
      weeksActive: deal.weeksActive ?? 0,
      isActive: deal.isActive ?? true,
      dealType: deal.dealType ?? "license",
      licenseYears: deal.licenseYears ?? 2,
      weeklyViews: deal.weeklyViews ?? [],
      totalViews: deal.totalViews ?? 0,
      annualPayment: deal.annualPayment ?? 0,
      upfrontPayment: deal.upfrontPayment ?? 0,
      isProductionDeal: deal.isProductionDeal ?? false,
      productionDeadlineWeek: deal.productionDeadlineWeek ?? null,
      productionDeadlineYear: deal.productionDeadlineYear ?? null,
    };
    this.streamingDeals.set(id, d);
    return d;
  }

  async updateStreamingDeal(id: string, updates: Partial<InsertStreamingDeal>): Promise<StreamingDeal | undefined> {
    const deal = this.streamingDeals.get(id);
    if (!deal) return undefined;
    const updated = { ...deal, ...updates } as StreamingDeal;
    this.streamingDeals.set(id, updated);
    return updated;
  }

  async deleteStreamingDeal(id: string): Promise<void> {
    this.streamingDeals.delete(id);
  }

  async deleteStreamingDealsByFilm(filmId: string): Promise<void> {
    for (const [id, deal] of this.streamingDeals.entries()) {
      if (deal.filmId === filmId) this.streamingDeals.delete(id);
    }
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmailsByPlayer(playerGameId: string): Promise<Email[]> {
    return Array.from(this.emails.values()).filter(e => e.playerGameId === playerGameId);
  }

  async getUnreadEmailCount(playerGameId: string): Promise<number> {
    return Array.from(this.emails.values()).filter(e => e.playerGameId === playerGameId && !e.isRead).length;
  }

  async createEmail(email: InsertEmail): Promise<Email> {
    const id = generateId();
    const e: Email = {
      id,
      playerGameId: email.playerGameId,
      type: email.type,
      subject: email.subject,
      sender: email.sender,
      senderTitle: email.senderTitle ?? "",
      body: email.body,
      isRead: email.isRead ?? false,
      isArchived: email.isArchived ?? false,
      hasAction: email.hasAction ?? false,
      actionLabel: email.actionLabel ?? null,
      actionData: email.actionData ?? null,
      sentWeek: email.sentWeek,
      sentYear: email.sentYear,
      expiresWeek: email.expiresWeek ?? null,
      expiresYear: email.expiresYear ?? null,
    };
    this.emails.set(id, e);
    return e;
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;
    const updated = { ...email, ...updates } as Email;
    this.emails.set(id, updated);
    return updated;
  }

  async deleteEmail(id: string): Promise<void> {
    this.emails.delete(id);
  }

  async getAwardShow(id: string): Promise<AwardShow | undefined> {
    return this.awardShows.get(id);
  }

  async getAllAwardShows(): Promise<AwardShow[]> {
    return Array.from(this.awardShows.values());
  }

  async createAwardShow(show: InsertAwardShow): Promise<AwardShow> {
    const id = show.id || generateId();
    const s: AwardShow = {
      id,
      name: show.name,
      description: show.description ?? null,
      prestige: show.prestige ?? 3,
      ceremonyWeek: show.ceremonyWeek ?? 1,
      nominationWeek: show.nominationWeek ?? 48,
      votingStartWeek: show.votingStartWeek ?? 50,
    };
    this.awardShows.set(id, s);
    return s;
  }

  async seedAwardShows(): Promise<void> {
    const existing = await this.getAllAwardShows();
    if (existing.length > 0) return;

    const shows = [
      { id: 'oscars', name: 'Academy Awards', description: 'The most prestigious film awards', prestige: 5, ceremonyWeek: 9, nominationWeek: 3, votingStartWeek: 1 },
      { id: 'golden-globes', name: 'Golden Globes', description: 'Hollywood Foreign Press Association awards', prestige: 4, ceremonyWeek: 2, nominationWeek: 50, votingStartWeek: 48 },
      { id: 'bafta', name: 'BAFTA Awards', description: 'British Academy Film Awards', prestige: 4, ceremonyWeek: 8, nominationWeek: 2, votingStartWeek: 52 },
    ];
    for (const s of shows) {
      await this.createAwardShow(s);
    }
  }

  async getAwardCategory(id: string): Promise<AwardCategory | undefined> {
    return this.awardCategories.get(id);
  }

  async getCategoriesByShow(awardShowId: string): Promise<AwardCategory[]> {
    return Array.from(this.awardCategories.values()).filter(c => c.awardShowId === awardShowId);
  }

  async createAwardCategory(category: InsertAwardCategory): Promise<AwardCategory> {
    const id = generateId();
    const c: AwardCategory = {
      id,
      awardShowId: category.awardShowId,
      name: category.name,
      description: category.description ?? null,
      categoryType: category.categoryType,
    };
    this.awardCategories.set(id, c);
    return c;
  }

  async getAllAwardCategories(): Promise<AwardCategory[]> {
    return Array.from(this.awardCategories.values());
  }

  async getAwardNomination(id: string): Promise<AwardNomination | undefined> {
    return this.awardNominations.get(id);
  }

  async getNominationsByPlayer(playerGameId: string): Promise<AwardNomination[]> {
    return Array.from(this.awardNominations.values()).filter(n => n.playerGameId === playerGameId);
  }

  async getNominationsByFilm(filmId: string): Promise<AwardNomination[]> {
    return Array.from(this.awardNominations.values()).filter(n => n.filmId === filmId);
  }

  async getNominationsByCeremony(playerGameId: string, awardShowId: string, ceremonyYear: number): Promise<AwardNomination[]> {
    return Array.from(this.awardNominations.values()).filter(n => 
      n.playerGameId === playerGameId && n.awardShowId === awardShowId && n.ceremonyYear === ceremonyYear
    );
  }

  async createAwardNomination(nomination: InsertAwardNomination): Promise<AwardNomination> {
    const id = generateId();
    const n: AwardNomination = {
      id,
      playerGameId: nomination.playerGameId,
      awardShowId: nomination.awardShowId,
      categoryId: nomination.categoryId,
      filmId: nomination.filmId,
      talentId: nomination.talentId ?? null,
      ceremonyYear: nomination.ceremonyYear,
      isWinner: nomination.isWinner ?? false,
      announcedWeek: nomination.announcedWeek,
      announcedYear: nomination.announcedYear,
    };
    this.awardNominations.set(id, n);
    return n;
  }

  async createAwardNominations(nominations: InsertAwardNomination[]): Promise<AwardNomination[]> {
    return Promise.all(nominations.map(nomination => this.createAwardNomination(nomination)));
  }

  async updateAwardNomination(id: string, updates: Partial<InsertAwardNomination>): Promise<AwardNomination | undefined> {
    const nom = this.awardNominations.get(id);
    if (!nom) return undefined;
    const updated = { ...nom, ...updates } as AwardNomination;
    this.awardNominations.set(id, updated);
    return updated;
  }

  async markAwardNominationsWinners(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => this.updateAwardNomination(id, { isWinner: true })));
  }

  async deleteAwardNomination(id: string): Promise<void> {
    this.awardNominations.delete(id);
  }

  async getAwardCeremony(id: string): Promise<AwardCeremony | undefined> {
    return this.awardCeremonies.get(id);
  }

  async getCeremoniesByPlayer(playerGameId: string): Promise<AwardCeremony[]> {
    return Array.from(this.awardCeremonies.values()).filter(c => c.playerGameId === playerGameId);
  }

  async getCeremonyByShowAndYear(playerGameId: string, awardShowId: string, ceremonyYear: number): Promise<AwardCeremony | undefined> {
    return Array.from(this.awardCeremonies.values()).find(c => 
      c.playerGameId === playerGameId && c.awardShowId === awardShowId && c.ceremonyYear === ceremonyYear
    );
  }

  async createAwardCeremony(ceremony: InsertAwardCeremony): Promise<AwardCeremony> {
    const id = generateId();
    const c: AwardCeremony = {
      id,
      playerGameId: ceremony.playerGameId,
      awardShowId: ceremony.awardShowId,
      ceremonyYear: ceremony.ceremonyYear,
      nominationsAnnounced: ceremony.nominationsAnnounced ?? false,
      ceremonyComplete: ceremony.ceremonyComplete ?? false,
      winnersAnnounced: ceremony.winnersAnnounced ?? false,
    };
    this.awardCeremonies.set(id, c);
    return c;
  }

  async updateAwardCeremony(id: string, updates: Partial<InsertAwardCeremony>): Promise<AwardCeremony | undefined> {
    const cer = this.awardCeremonies.get(id);
    if (!cer) return undefined;
    const updated = { ...cer, ...updates } as AwardCeremony;
    this.awardCeremonies.set(id, updated);
    return updated;
  }

  async getFilmRelease(id: string): Promise<FilmRelease | undefined> {
    return this.filmReleases.get(id);
  }

  async getAllFilmReleases(): Promise<FilmRelease[]> {
    return Array.from(this.filmReleases.values());
  }

  async getFilmReleasesByFilm(filmId: string): Promise<FilmRelease[]> {
    return Array.from(this.filmReleases.values()).filter(r => r.filmId === filmId);
  }

  async getFilmReleasesByFilms(filmIds: string[]): Promise<FilmRelease[]> {
    const ids = new Set(filmIds);
    return Array.from(this.filmReleases.values()).filter(release => ids.has(release.filmId));
  }

  async getFilmReleasesByStudioIds(studioIds: string[]): Promise<FilmRelease[]> {
    const ids = new Set(studioIds);
    const filmIds = new Set(Array.from(this.films.values())
      .filter(film => ids.has(film.studioId)).map(film => film.id));
    return Array.from(this.filmReleases.values()).filter(release => filmIds.has(release.filmId));
  }

  async getFilmReleaseByTerritory(filmId: string, territoryCode: string): Promise<FilmRelease | undefined> {
    return Array.from(this.filmReleases.values()).find(r => r.filmId === filmId && r.territoryCode === territoryCode);
  }

  async createFilmRelease(release: InsertFilmRelease): Promise<FilmRelease> {
    const id = generateId();
    const r: FilmRelease = {
      id,
      filmId: release.filmId,
      territoryCode: release.territoryCode,
      releaseWeek: release.releaseWeek,
      releaseYear: release.releaseYear,
      productionBudget: release.productionBudget ?? 0,
      marketingBudget: release.marketingBudget ?? 0,
      awareness: release.awareness ?? 8,
      interest: release.interest ?? 10,
      expectation: release.expectation ?? 52,
      buzz: release.buzz ?? 0,
      paidReach: release.paidReach ?? 0,
      openingExpectation: release.openingExpectation ?? null,
      isReleased: release.isReleased ?? false,
      weeklyBoxOffice: release.weeklyBoxOffice ?? [],
      weeklyCapacityBreakdown: release.weeklyCapacityBreakdown ?? [],
      totalBoxOffice: release.totalBoxOffice ?? 0,
      theaterCount: release.theaterCount ?? 0,
      weeksInRelease: release.weeksInRelease ?? 0,
    };
    this.filmReleases.set(id, r);
    return r;
  }

  async createFilmReleases(releases: InsertFilmRelease[]): Promise<FilmRelease[]> {
    return Promise.all(releases.map(release => this.createFilmRelease(release)));
  }

  async updateFilmRelease(id: string, updates: Partial<InsertFilmRelease>): Promise<FilmRelease | undefined> {
    const rel = this.filmReleases.get(id);
    if (!rel) return undefined;
    const updated = { ...rel, ...updates } as FilmRelease;
    this.filmReleases.set(id, updated);
    return updated;
  }

  async updateFilmReleaseWeeks(releases: FilmRelease[]): Promise<void> {
    for (const release of releases) this.filmReleases.set(release.id, release);
  }

  async deleteFilmRelease(id: string): Promise<void> {
    this.filmReleases.delete(id);
  }

  async getMarketingActionsByFilm(filmId: string): Promise<MarketingAction[]> {
    return Array.from(this.marketingActions.values()).filter(action => action.filmId === filmId);
  }

  async getMarketingActionsByFilms(filmIds: string[]): Promise<MarketingAction[]> {
    const ids = new Set(filmIds);
    return Array.from(this.marketingActions.values()).filter(action => ids.has(action.filmId));
  }

  async createMarketingAction(action: InsertMarketingAction): Promise<MarketingAction> {
    const created: MarketingAction = { id: generateId(), ...action } as MarketingAction;
    this.marketingActions.set(created.id, created);
    return created;
  }

  async createMarketingActions(actions: InsertMarketingAction[]): Promise<MarketingAction[]> {
    return Promise.all(actions.map(action => this.createMarketingAction(action)));
  }

  async getPremiumBooking(id: string): Promise<PremiumBooking | undefined> {
    return this.premiumBookings.get(id);
  }

  async getPremiumBookingsByFilm(filmId: string): Promise<PremiumBooking[]> {
    return Array.from(this.premiumBookings.values()).filter(booking => booking.filmId === filmId);
  }

  async getPremiumBookingsByFilms(filmIds: string[]): Promise<PremiumBooking[]> {
    const ids = new Set(filmIds);
    return Array.from(this.premiumBookings.values()).filter(booking => ids.has(booking.filmId));
  }

  async getPremiumBookingsByStudioIds(studioIds: string[]): Promise<PremiumBooking[]> {
    const ids = new Set(studioIds);
    const filmIds = new Set(Array.from(this.films.values())
      .filter(film => ids.has(film.studioId)).map(film => film.id));
    return Array.from(this.premiumBookings.values()).filter(booking => filmIds.has(booking.filmId));
  }

  async getAllPremiumBookings(): Promise<PremiumBooking[]> {
    return Array.from(this.premiumBookings.values());
  }

  async createPremiumBooking(booking: InsertPremiumBooking): Promise<PremiumBooking> {
    const created: PremiumBooking = { id: generateId(), ...booking } as PremiumBooking;
    this.premiumBookings.set(created.id, created);
    return created;
  }

  async createPremiumBookings(bookings: InsertPremiumBooking[]): Promise<PremiumBooking[]> {
    return Promise.all(bookings.map(booking => this.createPremiumBooking(booking)));
  }

  async updatePremiumBooking(
    id: string,
    updates: Partial<InsertPremiumBooking>,
  ): Promise<PremiumBooking | undefined> {
    const booking = this.premiumBookings.get(id);
    if (!booking) return undefined;
    const updated = { ...booking, ...updates } as PremiumBooking;
    this.premiumBookings.set(id, updated);
    return updated;
  }

  async deletePremiumBooking(id: string): Promise<void> {
    this.premiumBookings.delete(id);
  }

  async getFilmMilestone(id: string): Promise<FilmMilestone | undefined> {
    return this.filmMilestones.get(id);
  }

  async getFilmMilestonesByFilm(filmId: string): Promise<FilmMilestone[]> {
    return Array.from(this.filmMilestones.values()).filter(m => m.filmId === filmId);
  }

  async createFilmMilestone(milestone: InsertFilmMilestone): Promise<FilmMilestone> {
    const id = generateId();
    const m: FilmMilestone = {
      id,
      filmId: milestone.filmId,
      milestoneType: milestone.milestoneType,
      week: milestone.week,
      year: milestone.year,
      details: milestone.details ?? null,
    };
    this.filmMilestones.set(id, m);
    return m;
  }

  async updateFilmMilestone(id: string, updates: Partial<InsertFilmMilestone>): Promise<FilmMilestone | undefined> {
    const ms = this.filmMilestones.get(id);
    if (!ms) return undefined;
    const updated = { ...ms, ...updates } as FilmMilestone;
    this.filmMilestones.set(id, updated);
    return updated;
  }

  async deleteFilmMilestone(id: string): Promise<void> {
    this.filmMilestones.delete(id);
  }

  async getFilmRole(id: string): Promise<FilmRole | undefined> {
    return this.filmRoles.get(id);
  }

  async getFilmRolesByFilm(filmId: string): Promise<FilmRole[]> {
    return Array.from(this.filmRoles.values()).filter(r => r.filmId === filmId);
  }

  async getFilmRolesByFilms(filmIds: string[]): Promise<FilmRole[]> {
    const ids = new Set(filmIds);
    return Array.from(this.filmRoles.values()).filter(role => ids.has(role.filmId));
  }

  async createFilmRole(role: InsertFilmRole): Promise<FilmRole> {
    const id = generateId();
    const r: FilmRole = {
      id,
      filmId: role.filmId,
      roleName: role.roleName,
      characterAge: role.characterAge ?? null,
      importance: role.importance ?? "supporting",
      characterType: role.characterType ?? "hero",
      genderPreference: role.genderPreference ?? "any",
      actorId: role.actorId ?? null,
      isCast: role.isCast ?? false,
    };
    this.filmRoles.set(id, r);
    return r;
  }

  async createFilmRoles(roles: InsertFilmRole[]): Promise<FilmRole[]> {
    return Promise.all(roles.map(role => this.createFilmRole(role)));
  }

  async updateFilmRole(id: string, updates: Partial<InsertFilmRole>): Promise<FilmRole | undefined> {
    const role = this.filmRoles.get(id);
    if (!role) return undefined;
    const updated = { ...role, ...updates } as FilmRole;
    this.filmRoles.set(id, updated);
    return updated;
  }

  async deleteFilmRole(id: string): Promise<void> {
    this.filmRoles.delete(id);
  }

  async deleteFilmRolesByFilm(filmId: string): Promise<void> {
    for (const [id, role] of this.filmRoles) {
      if (role.filmId === filmId) {
        this.filmRoles.delete(id);
      }
    }
  }

  async getFranchise(id: string): Promise<Franchise | undefined> {
    return this.franchises.get(id);
  }

  async getFranchisesByStudio(studioId: string): Promise<Franchise[]> {
    return Array.from(this.franchises.values()).filter(f => f.studioId === studioId);
  }

  async getFilmFranchise(filmId: string): Promise<Franchise | undefined> {
    const film = this.films.get(filmId);
    if (!film?.franchiseId) return undefined;
    return this.franchises.get(film.franchiseId);
  }

  async createFranchise(franchise: InsertFranchise): Promise<Franchise> {
    const id = generateId();
    const f: Franchise = {
      id,
      studioId: franchise.studioId,
      name: franchise.name,
      description: franchise.description ?? null,
      genre: franchise.genre ?? null,
      totalFilms: franchise.totalFilms ?? 0,
      totalBoxOffice: franchise.totalBoxOffice ?? 0,
      averageRating: franchise.averageRating ?? null,
      createdWeek: franchise.createdWeek ?? 1,
      createdYear: franchise.createdYear ?? 2025,
    };
    this.franchises.set(id, f);
    return f;
  }

  async deleteFranchise(id: string): Promise<void> {
    this.franchises.delete(id);
  }

  async updateFranchise(id: string, updates: Partial<InsertFranchise>): Promise<Franchise | undefined> {
    const f = this.franchises.get(id);
    if (!f) return undefined;
    const updated = { ...f, ...updates } as Franchise;
    this.franchises.set(id, updated);
    return updated;
  }

  // ==================== MULTIPLAYER METHODS ====================

  async updateUser(id: string, updates: Record<string, any>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates } as User;
    this.users.set(id, updated);
    return updated;
  }

  // Game Sessions
  async getGameSession(id: string): Promise<GameSession | undefined> {
    return this.gameSessions.get(id);
  }

  async getGameSessionByCode(code: string): Promise<GameSession | undefined> {
    return Array.from(this.gameSessions.values()).find(s => s.code === code.toUpperCase());
  }

  async getPublicGameSessions(): Promise<GameSession[]> {
    return Array.from(this.gameSessions.values()).filter(s => s.isPublic && s.status === 'lobby');
  }

  async getGameSessionsByUser(userId: string): Promise<GameSession[]> {
    return Array.from(this.gameSessions.values()).filter(s => s.hostUserId === userId);
  }

  async createGameSession(session: InsertGameSession): Promise<GameSession> {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    const newSession: GameSession = {
      id,
      name: session.name,
      code: session.code,
      hostUserId: session.hostUserId,
      currentWeek: session.currentWeek ?? 1,
      currentYear: session.currentYear ?? 2025,
      maxPlayers: session.maxPlayers ?? 4,
      isPublic: session.isPublic ?? false,
      weekAdvanceMode: session.weekAdvanceMode ?? 'ready',
      timerMinutes: session.timerMinutes ?? 5,
      status: session.status ?? 'lobby',
      createdAt: now,
      startedAt: session.startedAt ?? null,
      lastActivityAt: now,
    };
    this.gameSessions.set(id, newSession);
    return newSession;
  }

  async updateGameSession(id: string, updates: Partial<InsertGameSession>): Promise<GameSession | undefined> {
    const session = this.gameSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates } as GameSession;
    this.gameSessions.set(id, updated);
    return updated;
  }

  async deleteGameSession(id: string): Promise<void> {
    this.gameSessions.delete(id);
  }

  // Game Session Players
  async getGameSessionPlayer(id: string): Promise<GameSessionPlayer | undefined> {
    return this.gameSessionPlayers.get(id);
  }

  async getGameSessionPlayerByUserAndSession(userId: string, gameSessionId: string): Promise<GameSessionPlayer | undefined> {
    return Array.from(this.gameSessionPlayers.values()).find(
      p => p.userId === userId && p.gameSessionId === gameSessionId
    );
  }

  async getPlayersByGameSession(gameSessionId: string): Promise<GameSessionPlayer[]> {
    return Array.from(this.gameSessionPlayers.values()).filter(p => p.gameSessionId === gameSessionId);
  }

  async getGameSessionsByPlayer(userId: string): Promise<GameSessionPlayer[]> {
    return Array.from(this.gameSessionPlayers.values()).filter(p => p.userId === userId);
  }

  async createGameSessionPlayer(player: InsertGameSessionPlayer): Promise<GameSessionPlayer> {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    const newPlayer: GameSessionPlayer = {
      id,
      gameSessionId: player.gameSessionId,
      userId: player.userId,
      studioId: player.studioId ?? null,
      isReady: player.isReady ?? false,
      isConnected: player.isConnected ?? false,
      isHost: player.isHost ?? false,
      joinedAt: now,
      lastSeenAt: now,
    };
    this.gameSessionPlayers.set(id, newPlayer);
    return newPlayer;
  }

  async updateGameSessionPlayer(id: string, updates: Partial<InsertGameSessionPlayer>): Promise<GameSessionPlayer | undefined> {
    const player = this.gameSessionPlayers.get(id);
    if (!player) return undefined;
    const updated = { ...player, ...updates } as GameSessionPlayer;
    this.gameSessionPlayers.set(id, updated);
    return updated;
  }

  async deleteGameSessionPlayer(id: string): Promise<void> {
    this.gameSessionPlayers.delete(id);
  }

  // Game Activity Log
  async getGameActivityLog(id: string): Promise<GameActivityLog | undefined> {
    return this.gameActivityLogs.get(id);
  }

  async getActivityLogBySession(gameSessionId: string, limit: number = 50): Promise<GameActivityLog[]> {
    return Array.from(this.gameActivityLogs.values())
      .filter(l => l.gameSessionId === gameSessionId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  async createGameActivityLog(log: InsertGameActivityLog): Promise<GameActivityLog> {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    const newLog: GameActivityLog = {
      id,
      gameSessionId: log.gameSessionId,
      userId: log.userId ?? null,
      studioId: log.studioId ?? null,
      eventType: log.eventType,
      eventData: log.eventData ?? {},
      message: log.message,
      gameWeek: log.gameWeek,
      gameYear: log.gameYear,
      createdAt: now,
    };
    this.gameActivityLogs.set(id, newLog);
    return newLog;
  }

  // Studios by game session
  async getStudiosByGameSession(gameSessionId: string): Promise<Studio[]> {
    return Array.from(this.studios.values()).filter(s => (s as any).gameSessionId === gameSessionId);
  }

  async getStudioByUserAndSession(userId: string, gameSessionId: string): Promise<Studio | undefined> {
    return Array.from(this.studios.values()).find(
      s => (s as any).userId === userId && (s as any).gameSessionId === gameSessionId
    );
  }

  // Financing is optional in memory-only development games. These no-op
  // implementations keep the weekly simulation usable without PostgreSQL.
  async getActiveSlateFinancingDeals(playerGameId: string): Promise<SlateFinancingDeal[]> {
    return Array.from(this.slateFinancingDeals.values())
      .filter(deal => deal.playerGameId === playerGameId && deal.isActive);
  }

  async updateSlateFinancingDeal(
    id: string,
    updates: Partial<InsertSlateFinancingDeal>,
  ): Promise<SlateFinancingDeal | undefined> {
    const deal = this.slateFinancingDeals.get(id);
    if (!deal) return undefined;
    const updated = { ...deal, ...updates } as SlateFinancingDeal;
    this.slateFinancingDeals.set(id, updated);
    return updated;
  }

  async getSlateFinancingDeal(id: string): Promise<SlateFinancingDeal | undefined> {
    return this.slateFinancingDeals.get(id);
  }

  async getSlateFinancingDealsByPlayer(playerGameId: string): Promise<SlateFinancingDeal[]> {
    return Array.from(this.slateFinancingDeals.values())
      .filter(deal => deal.playerGameId === playerGameId);
  }

  async createSlateFinancingDeal(deal: InsertSlateFinancingDeal): Promise<SlateFinancingDeal> {
    const created = { id: generateId(), ...deal } as SlateFinancingDeal;
    this.slateFinancingDeals.set(created.id, created);
    return created;
  }

  async getTVShow(id: string): Promise<TVShow | undefined> {
    return this.tvShows.get(id);
  }

  async getTVShowsByStudio(studioId: string): Promise<TVShow[]> {
    return Array.from(this.tvShows.values()).filter(show => show.studioId === studioId);
  }

  async getAllTVShows(): Promise<TVShow[]> {
    return Array.from(this.tvShows.values());
  }

  async createTVShow(show: InsertTVShow): Promise<TVShow> {
    const id = generateId();
    const created = { id, ...show } as TVShow;
    this.tvShows.set(id, created);
    return created;
  }

  async updateTVShow(id: string, updates: Partial<InsertTVShow>): Promise<TVShow | undefined> {
    const show = this.tvShows.get(id);
    if (!show) return undefined;
    const updated = { ...show, ...updates } as TVShow;
    this.tvShows.set(id, updated);
    return updated;
  }

  async deleteTVShow(id: string): Promise<void> {
    this.tvShows.delete(id);
  }

  async getTVSeason(id: string): Promise<TVSeason | undefined> {
    return this.tvSeasons.get(id);
  }

  async getTVSeasonsByShow(tvShowId: string): Promise<TVSeason[]> {
    return Array.from(this.tvSeasons.values()).filter(season => season.tvShowId === tvShowId);
  }

  async createTVSeason(season: InsertTVSeason): Promise<TVSeason> {
    const id = generateId();
    const created = { id, ...season } as TVSeason;
    this.tvSeasons.set(id, created);
    return created;
  }

  async updateTVSeason(id: string, updates: Partial<InsertTVSeason>): Promise<TVSeason | undefined> {
    const season = this.tvSeasons.get(id);
    if (!season) return undefined;
    const updated = { ...season, ...updates } as TVSeason;
    this.tvSeasons.set(id, updated);
    return updated;
  }

  async deleteTVSeason(id: string): Promise<void> {
    this.tvSeasons.delete(id);
  }

  async getTVEpisode(id: string): Promise<TVEpisode | undefined> {
    return this.tvEpisodes.get(id);
  }

  async getTVEpisodesBySeason(seasonId: string): Promise<TVEpisode[]> {
    return Array.from(this.tvEpisodes.values()).filter(episode => episode.seasonId === seasonId);
  }

  async getTVEpisodesByShow(tvShowId: string): Promise<TVEpisode[]> {
    return Array.from(this.tvEpisodes.values()).filter(episode => (episode as any).tvShowId === tvShowId);
  }

  async createTVEpisode(episode: InsertTVEpisode): Promise<TVEpisode> {
    const id = generateId();
    const created = { id, ...episode } as TVEpisode;
    this.tvEpisodes.set(id, created);
    return created;
  }

  async updateTVEpisode(id: string, updates: Partial<InsertTVEpisode>): Promise<TVEpisode | undefined> {
    const episode = this.tvEpisodes.get(id);
    if (!episode) return undefined;
    const updated = { ...episode, ...updates } as TVEpisode;
    this.tvEpisodes.set(id, updated);
    return updated;
  }

  async deleteTVEpisode(id: string): Promise<void> {
    this.tvEpisodes.delete(id);
  }

  async getTVDeal(id: string): Promise<TVDeal | undefined> {
    return this.tvDeals.get(id);
  }

  async getTVDealsByShow(tvShowId: string): Promise<TVDeal[]> {
    return Array.from(this.tvDeals.values()).filter(deal => deal.tvShowId === tvShowId);
  }

  async getTVDealsByPlayer(playerGameId: string): Promise<TVDeal[]> {
    return Array.from(this.tvDeals.values()).filter(deal => (deal as any).playerGameId === playerGameId);
  }

  async getAllTVDeals(): Promise<TVDeal[]> {
    return Array.from(this.tvDeals.values());
  }

  async createTVDeal(deal: InsertTVDeal): Promise<TVDeal> {
    const id = generateId();
    const created = { id, ...deal } as TVDeal;
    this.tvDeals.set(id, created);
    return created;
  }

  async updateTVDeal(id: string, updates: Partial<InsertTVDeal>): Promise<TVDeal | undefined> {
    const deal = this.tvDeals.get(id);
    if (!deal) return undefined;
    const updated = { ...deal, ...updates } as TVDeal;
    this.tvDeals.set(id, updated);
    return updated;
  }

  async deleteTVDeal(id: string): Promise<void> {
    this.tvDeals.delete(id);
  }

  async deleteTVDealsByShow(tvShowId: string): Promise<void> {
    for (const [id, deal] of this.tvDeals.entries()) {
      if (deal.tvShowId === tvShowId) this.tvDeals.delete(id);
    }
  }

  async deleteTVDealsByPlayer(playerGameId: string): Promise<void> {
    for (const [id, deal] of this.tvDeals.entries()) {
      if ((deal as any).playerGameId === playerGameId) this.tvDeals.delete(id);
    }
  }

  async getTVNetwork(id: string): Promise<TVNetwork | undefined> {
    return this.tvNetworks.get(id);
  }

  async getAllTVNetworks(): Promise<TVNetwork[]> {
    return Array.from(this.tvNetworks.values());
  }

  async createTVNetwork(network: InsertTVNetwork): Promise<TVNetwork> {
    const id = generateId();
    const created = { id, ...network } as TVNetwork;
    this.tvNetworks.set(id, created);
    return created;
  }

  async seedTVNetworks(): Promise<void> {}

  async getMarketplaceScript(id: string): Promise<MarketplaceScript | undefined> {
    return this.marketplaceScripts.get(id);
  }

  async getAllMarketplaceScripts(): Promise<MarketplaceScript[]> {
    return Array.from(this.marketplaceScripts.values());
  }

  async getAvailableMarketplaceScripts(): Promise<MarketplaceScript[]> {
    return Array.from(this.marketplaceScripts.values()).filter(script => (script as any).isAvailable !== false);
  }

  async createMarketplaceScript(script: InsertMarketplaceScript): Promise<MarketplaceScript> {
    const id = generateId();
    const created = { id, ...script } as MarketplaceScript;
    this.marketplaceScripts.set(id, created);
    return created;
  }

  async updateMarketplaceScript(id: string, updates: Partial<InsertMarketplaceScript>): Promise<MarketplaceScript | undefined> {
    const script = this.marketplaceScripts.get(id);
    if (!script) return undefined;
    const updated = { ...script, ...updates } as MarketplaceScript;
    this.marketplaceScripts.set(id, updated);
    return updated;
  }

  async getMarketplaceScriptPurchasesByPlayer(playerGameId: string): Promise<MarketplaceScriptPurchase[]> {
    return Array.from(this.marketplaceScriptPurchases.values())
      .filter(purchase => purchase.playerGameId === playerGameId);
  }

  async createMarketplaceScriptPurchase(
    purchase: InsertMarketplaceScriptPurchase,
  ): Promise<MarketplaceScriptPurchase> {
    const created = { ...purchase } as MarketplaceScriptPurchase;
    this.marketplaceScriptPurchases.set(`${purchase.playerGameId}:${purchase.scriptId}`, created);
    return created;
  }

  async seedMarketplaceScripts(): Promise<void> {}

  async getCoProductionDeal(_id: string): Promise<CoProductionDeal | undefined> {
    return undefined;
  }

  async getCoProductionDealsByPlayer(_playerGameId: string): Promise<CoProductionDeal[]> {
    return [];
  }

  async getActiveCoProductionDeals(_playerGameId: string): Promise<CoProductionDeal[]> {
    return [];
  }

  async createCoProductionDeal(deal: InsertCoProductionDeal): Promise<CoProductionDeal> {
    return { id: generateId(), ...deal } as CoProductionDeal;
  }

  async updateCoProductionDeal(
    _id: string,
    _updates: Partial<InsertCoProductionDeal>,
  ): Promise<CoProductionDeal | undefined> {
    return undefined;
  }
}
