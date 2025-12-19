import { 
  type User, type InsertUser, 
  type Studio, type InsertStudio, 
  type Film, type InsertFilm, 
  type Talent, type InsertTalent,
  type StreamingService, type InsertStreamingService,
  type StreamingDeal, type InsertStreamingDeal,
  type Email, type InsertEmail,
  type AwardShow, type InsertAwardShow,
  type AwardCategory, type InsertAwardCategory,
  type AwardNomination, type InsertAwardNomination,
  type AwardCeremony, type InsertAwardCeremony,
  type FilmRelease, type InsertFilmRelease,
  type FilmMilestone, type InsertFilmMilestone,
  type FilmRole, type InsertFilmRole,
  type Franchise, type InsertFranchise,
  type GameSession, type InsertGameSession,
  type GameSessionPlayer, type InsertGameSessionPlayer,
  type GameActivityLog, type InsertGameActivityLog,
} from "@shared/schema";
import { IStorage } from "./storage";
import * as fs from "fs";
import * as path from "path";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private studios: Map<string, Studio> = new Map();
  private films: Map<string, Film> = new Map();
  private talentMap: Map<string, Talent> = new Map();
  private streamingServices: Map<string, StreamingService> = new Map();
  private streamingDeals: Map<string, StreamingDeal> = new Map();
  private emails: Map<string, Email> = new Map();
  private awardShows: Map<string, AwardShow> = new Map();
  private awardCategories: Map<string, AwardCategory> = new Map();
  private awardNominations: Map<string, AwardNomination> = new Map();
  private awardCeremonies: Map<string, AwardCeremony> = new Map();
  private filmReleases: Map<string, FilmRelease> = new Map();
  private filmMilestones: Map<string, FilmMilestone> = new Map();
  private filmRoles: Map<string, FilmRole> = new Map();
  private franchises: Map<string, Franchise> = new Map();
  private gameSessions: Map<string, GameSession> = new Map();
  private gameSessionPlayers: Map<string, GameSessionPlayer> = new Map();
  private gameActivityLogs: Map<string, GameActivityLog> = new Map();

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
      password: insertUser.password
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

  async createStudio(insertStudio: InsertStudio): Promise<Studio> {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);
    const studio: Studio = {
      id,
      deviceId: insertStudio.deviceId,
      name: insertStudio.name ?? "New Studio",
      budget: insertStudio.budget ?? 100000000,
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
      createdAt: now,
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
      openingWeekend: insertFilm.openingWeekend ?? 0,
      domesticTotal: insertFilm.domesticTotal ?? 0,
      internationalTotal: insertFilm.internationalTotal ?? 0,
      grandTotal: insertFilm.grandTotal ?? 0,
      audienceScore: insertFilm.audienceScore ?? null,
      criticScore: insertFilm.criticScore ?? null,
      hypeScore: insertFilm.hypeScore ?? 50,
      productionQuality: insertFilm.productionQuality ?? 70,
      vfxQuality: insertFilm.vfxQuality ?? 70,
      isSequel: insertFilm.isSequel ?? false,
      sequelNumber: insertFilm.sequelNumber ?? null,
      originalFilmId: insertFilm.originalFilmId ?? null,
      franchiseId: insertFilm.franchiseId ?? null,
      distributionType: insertFilm.distributionType ?? "theatrical",
      streamingServiceId: insertFilm.streamingServiceId ?? null,
      streamingDealValue: insertFilm.streamingDealValue ?? null,
      presoldTerritories: insertFilm.presoldTerritories ?? [],
      presaleRevenue: insertFilm.presaleRevenue ?? 0,
      targetRating: insertFilm.targetRating ?? "PG-13",
      finalRating: insertFilm.finalRating ?? null,
      ratingAppealedWeek: insertFilm.ratingAppealedWeek ?? null,
      ratingAppealedYear: insertFilm.ratingAppealedYear ?? null,
      scriptWritingApproach: insertFilm.scriptWritingApproach ?? "original",
      ipLicenseCost: insertFilm.ipLicenseCost ?? null,
      ipSourceName: insertFilm.ipSourceName ?? null,
      ipSourceType: insertFilm.ipSourceType ?? null,
      weeksInRelease: insertFilm.weeksInRelease ?? 0,
      isReleased: insertFilm.isReleased ?? false,
      releaseStrategy: insertFilm.releaseStrategy ?? null,
      selectedTerritories: insertFilm.selectedTerritories ?? null,
      theaterCount: insertFilm.theaterCount ?? null,
      screenCount: insertFilm.screenCount ?? null,
    };
    this.films.set(id, film);
    return film;
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

  async getStreamingDealsByPlayer(playerGameId: string): Promise<StreamingDeal[]> {
    return Array.from(this.streamingDeals.values()).filter(d => d.playerGameId === playerGameId);
  }

  async createStreamingDeal(deal: InsertStreamingDeal): Promise<StreamingDeal> {
    const id = generateId();
    const d: StreamingDeal = {
      id,
      filmId: deal.filmId,
      streamingServiceId: deal.streamingServiceId,
      dealValue: deal.dealValue,
      dealType: deal.dealType,
      playerGameId: deal.playerGameId,
      status: deal.status ?? "pending",
      offeredWeek: deal.offeredWeek ?? null,
      offeredYear: deal.offeredYear ?? null,
      acceptedWeek: deal.acceptedWeek ?? null,
      acceptedYear: deal.acceptedYear ?? null,
      startWeek: deal.startWeek ?? null,
      startYear: deal.startYear ?? null,
      durationWeeks: deal.durationWeeks ?? null,
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
      senderName: email.senderName,
      senderTitle: email.senderTitle ?? null,
      senderCompany: email.senderCompany ?? null,
      subject: email.subject,
      body: email.body,
      emailType: email.emailType,
      relatedFilmId: email.relatedFilmId ?? null,
      dealData: email.dealData ?? null,
      isRead: email.isRead ?? false,
      isArchived: email.isArchived ?? false,
      receivedWeek: email.receivedWeek,
      receivedYear: email.receivedYear,
      expiresWeek: email.expiresWeek ?? null,
      expiresYear: email.expiresYear ?? null,
      responseStatus: email.responseStatus ?? null,
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
      announced: nomination.announced ?? false,
    };
    this.awardNominations.set(id, n);
    return n;
  }

  async updateAwardNomination(id: string, updates: Partial<InsertAwardNomination>): Promise<AwardNomination | undefined> {
    const nom = this.awardNominations.get(id);
    if (!nom) return undefined;
    const updated = { ...nom, ...updates } as AwardNomination;
    this.awardNominations.set(id, updated);
    return updated;
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
      status: ceremony.status ?? "upcoming",
      nominationsAnnounced: ceremony.nominationsAnnounced ?? false,
      ceremonyComplete: ceremony.ceremonyComplete ?? false,
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

  async getFilmReleasesByFilm(filmId: string): Promise<FilmRelease[]> {
    return Array.from(this.filmReleases.values()).filter(r => r.filmId === filmId);
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
      releaseWeek: release.releaseWeek ?? null,
      releaseYear: release.releaseYear ?? null,
      status: release.status ?? "pending",
      weeklyBoxOffice: release.weeklyBoxOffice ?? [],
      totalBoxOffice: release.totalBoxOffice ?? 0,
      theaterCount: release.theaterCount ?? null,
      screenCount: release.screenCount ?? null,
    };
    this.filmReleases.set(id, r);
    return r;
  }

  async updateFilmRelease(id: string, updates: Partial<InsertFilmRelease>): Promise<FilmRelease | undefined> {
    const rel = this.filmReleases.get(id);
    if (!rel) return undefined;
    const updated = { ...rel, ...updates } as FilmRelease;
    this.filmReleases.set(id, updated);
    return updated;
  }

  async deleteFilmRelease(id: string): Promise<void> {
    this.filmReleases.delete(id);
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

  async createFilmRole(role: InsertFilmRole): Promise<FilmRole> {
    const id = generateId();
    const r: FilmRole = {
      id,
      filmId: role.filmId,
      talentId: role.talentId ?? null,
      roleName: role.roleName,
      roleType: role.roleType,
      salary: role.salary ?? 0,
      isLead: role.isLead ?? false,
    };
    this.filmRoles.set(id, r);
    return r;
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
}
