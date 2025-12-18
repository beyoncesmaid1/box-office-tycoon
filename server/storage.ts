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
  type MarketplaceScript, type InsertMarketplaceScript,
  type TVShow, type InsertTVShow,
  type TVSeason, type InsertTVSeason,
  type TVEpisode, type InsertTVEpisode,
  type TVDeal, type InsertTVDeal,
  type TVNetwork, type InsertTVNetwork,
  type SlateFinancingDeal, type InsertSlateFinancingDeal,
  type GameSession, type InsertGameSession,
  type GameSessionPlayer, type InsertGameSessionPlayer,
  type GameActivityLog, type InsertGameActivityLog,
  studios, films, talent, users, streamingServices, streamingDeals, emails,
  awardShows, awardCategories, awardNominations, awardCeremonies,
  filmReleases, filmMilestones, filmRoles, franchises, marketplaceScripts,
  tvShows, tvSeasons, tvEpisodes, tvDeals, tvNetworks, slateFinancingDeals,
  gameSessions, gameSessionPlayers, gameActivityLog
} from "@shared/schema";
import { db, hasDatabase } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { MemStorage } from "./mem-storage";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Record<string, any>): Promise<User | undefined>;
  
  // Studios
  getStudio(id: string): Promise<Studio | undefined>;
  getAllStudios(): Promise<Studio[]>;
  createStudio(studio: InsertStudio): Promise<Studio>;
  updateStudio(id: string, updates: Partial<InsertStudio>): Promise<Studio | undefined>;
  deleteStudio(id: string): Promise<void>;
  
  // Films
  getFilm(id: string): Promise<Film | undefined>;
  getFilmsByStudio(studioId: string): Promise<Film[]>;
  getAllFilms(): Promise<Film[]>;
  createFilm(film: InsertFilm): Promise<Film>;
  updateFilm(id: string, updates: Partial<InsertFilm>): Promise<Film | undefined>;
  deleteFilm(id: string): Promise<void>;
  
  // Talent
  getTalent(id: string): Promise<Talent | undefined>;
  getTalentByName(name: string): Promise<Talent | undefined>;
  getAllTalent(): Promise<Talent[]>;
  createTalent(t: InsertTalent): Promise<Talent>;
  updateTalent(id: string, updates: Partial<InsertTalent>): Promise<Talent | undefined>;
  deleteTalent(id: string): Promise<void>;
  isTalentInUse(id: string): Promise<boolean>;
  seedTalent(): Promise<void>;
  
  // Streaming Services
  getStreamingService(id: string): Promise<StreamingService | undefined>;
  getAllStreamingServices(): Promise<StreamingService[]>;
  createStreamingService(service: InsertStreamingService): Promise<StreamingService>;
  seedStreamingServices(): Promise<void>;
  
  // Streaming Deals
  getStreamingDeal(id: string): Promise<StreamingDeal | undefined>;
  getStreamingDealsByFilm(filmId: string): Promise<StreamingDeal[]>;
  getStreamingDealsByPlayer(playerGameId: string): Promise<StreamingDeal[]>;
  getStreamingDealsByService(streamingServiceId: string): Promise<StreamingDeal[]>;
  createStreamingDeal(deal: InsertStreamingDeal): Promise<StreamingDeal>;
  updateStreamingDeal(id: string, updates: Partial<InsertStreamingDeal>): Promise<StreamingDeal | undefined>;
  
  // Emails
  getEmail(id: string): Promise<Email | undefined>;
  getEmailsByPlayer(playerGameId: string): Promise<Email[]>;
  getUnreadEmailCount(playerGameId: string): Promise<number>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined>;
  deleteEmail(id: string): Promise<void>;
  
  // Award Shows
  getAwardShow(id: string): Promise<AwardShow | undefined>;
  getAllAwardShows(): Promise<AwardShow[]>;
  createAwardShow(show: InsertAwardShow): Promise<AwardShow>;
  seedAwardShows(): Promise<void>;
  
  // Award Categories
  getAwardCategory(id: string): Promise<AwardCategory | undefined>;
  getCategoriesByShow(awardShowId: string): Promise<AwardCategory[]>;
  createAwardCategory(category: InsertAwardCategory): Promise<AwardCategory>;
  
  // Award Nominations
  getAwardNomination(id: string): Promise<AwardNomination | undefined>;
  getNominationsByPlayer(playerGameId: string): Promise<AwardNomination[]>;
  getNominationsByFilm(filmId: string): Promise<AwardNomination[]>;
  getNominationsByCeremony(playerGameId: string, awardShowId: string, ceremonyYear: number): Promise<AwardNomination[]>;
  createAwardNomination(nomination: InsertAwardNomination): Promise<AwardNomination>;
  updateAwardNomination(id: string, updates: Partial<InsertAwardNomination>): Promise<AwardNomination | undefined>;
  deleteAwardNomination(id: string): Promise<void>;
  
  // Award Ceremonies
  getAwardCeremony(id: string): Promise<AwardCeremony | undefined>;
  getCeremoniesByPlayer(playerGameId: string): Promise<AwardCeremony[]>;
  getCeremonyByShowAndYear(playerGameId: string, awardShowId: string, ceremonyYear: number): Promise<AwardCeremony | undefined>;
  createAwardCeremony(ceremony: InsertAwardCeremony): Promise<AwardCeremony>;
  updateAwardCeremony(id: string, updates: Partial<InsertAwardCeremony>): Promise<AwardCeremony | undefined>;
  
  // Film Releases (territory-based)
  getFilmRelease(id: string): Promise<FilmRelease | undefined>;
  getFilmReleasesByFilm(filmId: string): Promise<FilmRelease[]>;
  getFilmReleaseByTerritory(filmId: string, territoryCode: string): Promise<FilmRelease | undefined>;
  createFilmRelease(release: InsertFilmRelease): Promise<FilmRelease>;
  updateFilmRelease(id: string, updates: Partial<InsertFilmRelease>): Promise<FilmRelease | undefined>;
  deleteFilmRelease(id: string): Promise<void>;
  
  // Film Milestones (development tracking)
  getFilmMilestone(id: string): Promise<FilmMilestone | undefined>;
  getFilmMilestonesByFilm(filmId: string): Promise<FilmMilestone[]>;
  createFilmMilestone(milestone: InsertFilmMilestone): Promise<FilmMilestone>;
  updateFilmMilestone(id: string, updates: Partial<InsertFilmMilestone>): Promise<FilmMilestone | undefined>;
  deleteFilmMilestone(id: string): Promise<void>;
  
  // Award Categories (all)
  getAllAwardCategories(): Promise<AwardCategory[]>;
  
  // Film Roles (casting)
  getFilmRole(id: string): Promise<FilmRole | undefined>;
  getFilmRolesByFilm(filmId: string): Promise<FilmRole[]>;
  createFilmRole(role: InsertFilmRole): Promise<FilmRole>;
  updateFilmRole(id: string, updates: Partial<InsertFilmRole>): Promise<FilmRole | undefined>;
  deleteFilmRole(id: string): Promise<void>;
  deleteFilmRolesByFilm(filmId: string): Promise<void>;

  // Franchises
  getFranchise(id: string): Promise<Franchise | undefined>;
  getFranchisesByStudio(studioId: string): Promise<Franchise[]>;
  getFilmFranchise(filmId: string): Promise<Franchise | undefined>;
  createFranchise(franchise: InsertFranchise): Promise<Franchise>;
  updateFranchise(id: string, updates: Partial<InsertFranchise>): Promise<Franchise | undefined>;
  deleteFranchise(id: string): Promise<void>;

  // Marketplace Scripts
  getMarketplaceScript(id: string): Promise<MarketplaceScript | undefined>;
  getAllMarketplaceScripts(): Promise<MarketplaceScript[]>;
  getAvailableMarketplaceScripts(): Promise<MarketplaceScript[]>;
  createMarketplaceScript(script: InsertMarketplaceScript): Promise<MarketplaceScript>;
  updateMarketplaceScript(id: string, updates: Partial<InsertMarketplaceScript>): Promise<MarketplaceScript | undefined>;
  seedMarketplaceScripts(): Promise<void>;
  
  // TV Shows
  getTVShow(id: string): Promise<TVShow | undefined>;
  getTVShowsByStudio(studioId: string): Promise<TVShow[]>;
  getAllTVShows(): Promise<TVShow[]>;
  createTVShow(show: InsertTVShow): Promise<TVShow>;
  updateTVShow(id: string, updates: Partial<InsertTVShow>): Promise<TVShow | undefined>;
  deleteTVShow(id: string): Promise<void>;
  
  // TV Seasons
  getTVSeason(id: string): Promise<TVSeason | undefined>;
  getTVSeasonsByShow(tvShowId: string): Promise<TVSeason[]>;
  createTVSeason(season: InsertTVSeason): Promise<TVSeason>;
  updateTVSeason(id: string, updates: Partial<InsertTVSeason>): Promise<TVSeason | undefined>;
  deleteTVSeason(id: string): Promise<void>;
  
  // TV Episodes
  getTVEpisode(id: string): Promise<TVEpisode | undefined>;
  getTVEpisodesBySeason(seasonId: string): Promise<TVEpisode[]>;
  getTVEpisodesByShow(tvShowId: string): Promise<TVEpisode[]>;
  createTVEpisode(episode: InsertTVEpisode): Promise<TVEpisode>;
  updateTVEpisode(id: string, updates: Partial<InsertTVEpisode>): Promise<TVEpisode | undefined>;
  deleteTVEpisode(id: string): Promise<void>;
  
  // TV Deals
  getTVDeal(id: string): Promise<TVDeal | undefined>;
  getTVDealsByShow(tvShowId: string): Promise<TVDeal[]>;
  getTVDealsByPlayer(playerGameId: string): Promise<TVDeal[]>;
  getAllTVDeals(): Promise<TVDeal[]>;
  createTVDeal(deal: InsertTVDeal): Promise<TVDeal>;
  updateTVDeal(id: string, updates: Partial<InsertTVDeal>): Promise<TVDeal | undefined>;
  deleteTVDeal(id: string): Promise<void>;
  
  // TV Networks
  getTVNetwork(id: string): Promise<TVNetwork | undefined>;
  getAllTVNetworks(): Promise<TVNetwork[]>;
  createTVNetwork(network: InsertTVNetwork): Promise<TVNetwork>;
  seedTVNetworks(): Promise<void>;
  
  // Slate Financing Deals
  getSlateFinancingDeal(id: string): Promise<SlateFinancingDeal | undefined>;
  getSlateFinancingDealsByPlayer(playerGameId: string): Promise<SlateFinancingDeal[]>;
  getActiveSlateFinancingDeals(playerGameId: string): Promise<SlateFinancingDeal[]>;
  createSlateFinancingDeal(deal: InsertSlateFinancingDeal): Promise<SlateFinancingDeal>;
  updateSlateFinancingDeal(id: string, updates: Partial<InsertSlateFinancingDeal>): Promise<SlateFinancingDeal | undefined>;
  
  // Game Sessions (Multiplayer)
  getGameSession(id: string): Promise<GameSession | undefined>;
  getGameSessionByCode(code: string): Promise<GameSession | undefined>;
  getPublicGameSessions(): Promise<GameSession[]>;
  getGameSessionsByUser(userId: string): Promise<GameSession[]>;
  createGameSession(session: InsertGameSession): Promise<GameSession>;
  updateGameSession(id: string, updates: Partial<InsertGameSession>): Promise<GameSession | undefined>;
  deleteGameSession(id: string): Promise<void>;
  
  // Game Session Players
  getGameSessionPlayer(id: string): Promise<GameSessionPlayer | undefined>;
  getGameSessionPlayerByUserAndSession(userId: string, gameSessionId: string): Promise<GameSessionPlayer | undefined>;
  getPlayersByGameSession(gameSessionId: string): Promise<GameSessionPlayer[]>;
  getGameSessionsByPlayer(userId: string): Promise<GameSessionPlayer[]>;
  createGameSessionPlayer(player: InsertGameSessionPlayer): Promise<GameSessionPlayer>;
  updateGameSessionPlayer(id: string, updates: Partial<InsertGameSessionPlayer>): Promise<GameSessionPlayer | undefined>;
  deleteGameSessionPlayer(id: string): Promise<void>;
  
  // Game Activity Log
  getGameActivityLog(id: string): Promise<GameActivityLog | undefined>;
  getActivityLogBySession(gameSessionId: string, limit?: number): Promise<GameActivityLog[]>;
  createGameActivityLog(log: InsertGameActivityLog): Promise<GameActivityLog>;
  
  // User updates for multiplayer
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  // Studios by game session
  getStudiosByGameSession(gameSessionId: string): Promise<Studio[]>;
  getStudioByUserAndSession(userId: string, gameSessionId: string): Promise<Studio | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Studios
  async getStudio(id: string): Promise<Studio | undefined> {
    const [studio] = await db.select().from(studios).where(eq(studios.id, id));
    return studio;
  }

  async getAllStudios(): Promise<Studio[]> {
    return await db.select().from(studios);
  }

  async getStudiosByDeviceId(deviceId: string): Promise<Studio[]> {
    return await db.select().from(studios).where(eq(studios.deviceId, deviceId));
  }

  async getPlayerStudioByDeviceId(deviceId: string): Promise<Studio | undefined> {
    const [studio] = await db.select().from(studios).where(and(eq(studios.deviceId, deviceId), eq(studios.isAI, false)));
    return studio;
  }

  async createStudio(insertStudio: InsertStudio): Promise<Studio> {
    const [studio] = await db.insert(studios).values(insertStudio).returning();
    return studio;
  }

  async updateStudio(id: string, updates: Partial<InsertStudio>): Promise<Studio | undefined> {
    const [studio] = await db.update(studios).set(updates).where(eq(studios.id, id)).returning();
    return studio;
  }

  async deleteStudio(id: string): Promise<void> {
    await db.delete(studios).where(eq(studios.id, id));
  }

  // Films
  async getFilm(id: string): Promise<Film | undefined> {
    const [film] = await db.select().from(films).where(eq(films.id, id));
    return film;
  }

  async getFilmsByStudio(studioId: string): Promise<Film[]> {
    return await db.select().from(films).where(eq(films.studioId, studioId));
  }

  async getAllFilms(): Promise<Film[]> {
    return await db.select().from(films);
  }

  async createFilm(insertFilm: any): Promise<Film> {
    const [film] = await db.insert(films).values(insertFilm).returning();
    return film;
  }

  async updateFilm(id: string, updates: any): Promise<Film | undefined> {
    const [film] = await db.update(films).set(updates).where(eq(films.id, id)).returning();
    return film;
  }

  async deleteFilm(id: string): Promise<void> {
    await db.delete(films).where(eq(films.id, id));
  }

  // Talent
  async getTalent(id: string): Promise<Talent | undefined> {
    const [t] = await db.select().from(talent).where(eq(talent.id, id));
    return t;
  }

  async getAllTalent(): Promise<Talent[]> {
    return await db.select().from(talent);
  }

  async createTalent(insertTalent: InsertTalent): Promise<Talent> {
    const [t] = await db.insert(talent).values(insertTalent).returning();
    return t;
  }

  async getTalentByName(name: string): Promise<Talent | undefined> {
    const [t] = await db.select().from(talent).where(eq(talent.name, name));
    return t;
  }

  async updateTalent(id: string, updates: Partial<InsertTalent>): Promise<Talent | undefined> {
    const [t] = await db.update(talent).set(updates).where(eq(talent.id, id)).returning();
    return t;
  }

  async deleteTalent(id: string): Promise<void> {
    await db.delete(talent).where(eq(talent.id, id));
  }

  async isTalentInUse(id: string): Promise<boolean> {
    // Check if talent is used as director, writer, or cast in any film
    const filmsUsingTalent = await db.select({ id: films.id })
      .from(films)
      .where(
        sql`${films.directorId} = ${id} OR ${films.writerId} = ${id} OR ${id} = ANY(${films.castIds})`
      )
      .limit(1);
    
    return filmsUsingTalent.length > 0;
  }

  async seedTalent(): Promise<void> {
    const existingTalent = await this.getAllTalent();
    // Only seed if database is empty - don't re-seed on every startup
    if (existingTalent.length > 0) return;
    const existingNames = new Set(existingTalent.map(t => t.name));

    // Helper to generate skill values based on genres and star rating
    const generateSkills = (
      talentGenres: string[], 
      starRating: number, 
      boxOfficeAvg: number,
      type: string,
      talentData?: any
    ) => {
      // True random 20-100 for all genre skills
      const randomSkill = () => 20 + Math.floor(Math.random() * 81);
      
      // Calculate fame based on box office average (scaled 1-100)
      const fame = talentData?.fame ?? Math.min(100, Math.max(0, Math.floor(
        10 + (boxOfficeAvg / 20000000) + starRating * 5 + (Math.random() * 60) - 20
      )));
      
      // Performance: true random 0-100
      const performance = talentData?.performance ?? randomSkill();
      
      // Experience: true random 0-100
      const experience = talentData?.experience ?? randomSkill();
      
      // Genre skills - pure random 0-100
      const genreSkill = () => randomSkill();
      
      // Calculate asking price based on fame level (realistic salary ranges)
      let askingPrice: number;
      if (talentData?.askingPrice) {
        askingPrice = talentData.askingPrice;
      } else {
        // Base salary on fame, with type adjustments
        let basePrice = 50000; // Start at $50K
        
        if (fame >= 85) {
          // A-list superstars: $7.5-25M
          basePrice = 7500000 + Math.random() * 17500000;
        } else if (fame >= 70) {
          // A-list stars: $4-12.5M
          basePrice = 4000000 + Math.random() * 8500000;
        } else if (fame >= 55) {
          // B-list: $1.5-6M
          basePrice = 1500000 + Math.random() * 4500000;
        } else if (fame >= 40) {
          // Established: $500K-2.5M
          basePrice = 500000 + Math.random() * 2000000;
        } else if (fame >= 25) {
          // Working actors: $150K-1M
          basePrice = 150000 + Math.random() * 850000;
        } else {
          // Early career/unknowns: $25K-250K
          basePrice = 25000 + Math.random() * 225000;
        }
        
        // Type adjustments
        if (type === 'director') {
          basePrice = basePrice * 1.5; // Directors earn more
        } else if (type === 'writer') {
          basePrice = basePrice * 0.4; // Writers earn less
        } else if (type === 'composer') {
          basePrice = basePrice * 0.3; // Composers earn less
        }
        
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
        // Director-specific skills (true random 0-100)
        skillCinematography: type === 'director' 
          ? (talentData?.skillCinematography ?? randomSkill())
          : 50,
        skillEditing: type === 'director'
          ? (talentData?.skillEditing ?? randomSkill())
          : 50,
        // Composer-specific skills (true random 0-100)
        skillOrchestral: type === 'composer'
          ? (talentData?.skillOrchestral ?? randomSkill())
          : 50,
        skillElectronic: type === 'composer'
          ? (talentData?.skillElectronic ?? randomSkill())
          : 50,
      };
    };

    try {
      const talentFilePath = path.join(process.cwd(), 'shared', 'data', 'talent.json');
      const talentData = JSON.parse(fs.readFileSync(talentFilePath, 'utf-8'));
      
      const allTalent: InsertTalent[] = [];
      
      for (const director of talentData.directors || []) {
        const skills = generateSkills(director.genres || [], director.starRating || 3, director.boxOfficeAvg || 100000000, 'director', director);
        // Build genres object from skill scores
        const genresObj = {
          action: skills.skillAction,
          drama: skills.skillDrama,
          comedy: skills.skillComedy,
          thriller: skills.skillThriller,
          horror: skills.skillHorror,
          scifi: skills.skillScifi,
          animation: skills.skillAnimation,
          romance: skills.skillRomance,
        };
        allTalent.push({
          name: director.name,
          type: 'director',
          gender: director.gender || 'unknown',
          nationality: director.nationality || 'American',
          starRating: director.starRating || 3,
          boxOfficeAvg: director.boxOfficeAvg || 100000000,
          awards: director.awards || 0,
          genres: genresObj as any,
          imageUrl: director.imageUrl || null,
          birthYear: director.birthYear || null,
          popularity: director.popularity || 50,
          ...skills,
        });
      }
      
      for (const actor of talentData.actors || []) {
        const skills = generateSkills(actor.genres || [], actor.starRating || 3, actor.boxOfficeAvg || 100000000, 'actor', actor);
        // Build genres object from skill scores
        const genresObj = {
          action: skills.skillAction,
          drama: skills.skillDrama,
          comedy: skills.skillComedy,
          thriller: skills.skillThriller,
          horror: skills.skillHorror,
          scifi: skills.skillScifi,
          animation: skills.skillAnimation,
          romance: skills.skillRomance,
        };
        allTalent.push({
          name: actor.name,
          type: 'actor',
          gender: actor.gender || 'male',
          nationality: actor.nationality || 'American',
          starRating: actor.starRating || 3,
          boxOfficeAvg: actor.boxOfficeAvg || 100000000,
          awards: actor.awards || 0,
          genres: genresObj as any,
          imageUrl: actor.imageUrl || null,
          birthYear: actor.birthYear || null,
          popularity: actor.popularity || 50,
          ...skills,
        });
      }
      
      for (const actress of talentData.actresses || []) {
        const skills = generateSkills(actress.genres || [], actress.starRating || 3, actress.boxOfficeAvg || 100000000, 'actor', actress);
        // Build genres object from skill scores
        const genresObj = {
          action: skills.skillAction,
          drama: skills.skillDrama,
          comedy: skills.skillComedy,
          thriller: skills.skillThriller,
          horror: skills.skillHorror,
          scifi: skills.skillScifi,
          animation: skills.skillAnimation,
          romance: skills.skillRomance,
        };
        allTalent.push({
          name: actress.name,
          type: 'actor',
          gender: actress.gender || 'female',
          nationality: actress.nationality || 'American',
          starRating: actress.starRating || 3,
          boxOfficeAvg: actress.boxOfficeAvg || 100000000,
          awards: actress.awards || 0,
          genres: genresObj as any,
          imageUrl: actress.imageUrl || null,
          birthYear: actress.birthYear || null,
          popularity: actress.popularity || 50,
          ...skills,
        });
      }
      
      for (const writer of talentData.writers || []) {
        const skills = generateSkills(writer.genres || [], writer.starRating || 3, writer.boxOfficeAvg || 100000000, 'writer', writer);
        // Build genres object from skill scores
        const genresObj = {
          action: skills.skillAction,
          drama: skills.skillDrama,
          comedy: skills.skillComedy,
          thriller: skills.skillThriller,
          horror: skills.skillHorror,
          scifi: skills.skillScifi,
          animation: skills.skillAnimation,
          romance: skills.skillRomance,
        };
        allTalent.push({
          name: writer.name,
          type: 'writer',
          gender: writer.gender || 'unknown',
          nationality: writer.nationality || 'American',
          starRating: writer.starRating || 3,
          boxOfficeAvg: writer.boxOfficeAvg || 100000000,
          awards: writer.awards || 0,
          genres: genresObj as any,
          imageUrl: writer.imageUrl || null,
          birthYear: writer.birthYear || null,
          popularity: writer.popularity || 50,
          ...skills,
        });
      }
      
      // Add composers
      for (const composer of talentData.composers || []) {
        const skills = generateSkills(composer.genres || [], composer.starRating || 3, composer.boxOfficeAvg || 100000000, 'composer', composer);
        // Build genres object from skill scores
        const genresObj = {
          action: skills.skillAction,
          drama: skills.skillDrama,
          comedy: skills.skillComedy,
          thriller: skills.skillThriller,
          horror: skills.skillHorror,
          scifi: skills.skillScifi,
          animation: skills.skillAnimation,
          romance: skills.skillRomance,
        };
        // Randomize composer performance (20-100 range)
        const randomPerformance = Math.round(20 + Math.random() * 80);
        allTalent.push({
          name: composer.name,
          type: 'composer',
          gender: composer.gender || 'male',
          nationality: composer.nationality || 'American',
          starRating: composer.starRating || 3,
          boxOfficeAvg: composer.boxOfficeAvg || 100000000,
          awards: composer.awards || 0,
          genres: genresObj as any,
          imageUrl: composer.imageUrl || null,
          birthYear: composer.birthYear || null,
          popularity: composer.popularity || 50,
          ...skills,
          performance: randomPerformance,
        });
      }
      
      let inserted = 0;
      let updated = 0;
      
      for (const t of allTalent) {
        if (existingNames.has(t.name)) {
          // Get existing talent to preserve custom imageUrl if set
          const existing = await this.getTalentByName(t.name);
          
          // Update existing entry to sync all fields including new skills
          // Only update imageUrl if the existing one is empty/null (preserve custom edits)
          await db.update(talent)
            .set({
              imageUrl: existing?.imageUrl ? existing.imageUrl : t.imageUrl,
              starRating: t.starRating,
              askingPrice: t.askingPrice,
              boxOfficeAvg: t.boxOfficeAvg,
              awards: t.awards,
              genres: t.genres,
              birthYear: t.birthYear,
              popularity: t.popularity,
              nationality: t.nationality,
              gender: t.gender,
              type: t.type,
              performance: t.performance,
              experience: t.experience,
              fame: t.fame,
              skillAction: t.skillAction,
              skillDrama: t.skillDrama,
              skillComedy: t.skillComedy,
              skillThriller: t.skillThriller,
              skillHorror: t.skillHorror,
              skillScifi: t.skillScifi,
              skillAnimation: t.skillAnimation,
              skillRomance: t.skillRomance,
              skillCinematography: t.skillCinematography,
              skillEditing: t.skillEditing,
              skillOrchestral: t.skillOrchestral,
              skillElectronic: t.skillElectronic,
            })
            .where(eq(talent.name, t.name));
          updated++;
        } else {
          existingNames.add(t.name);
          await this.createTalent(t);
          inserted++;
        }
      }
      
      if (inserted === 0 && updated === 0) {
        console.log('All talent entries already exist, skipping seed.');
        return;
      }
      
      console.log(`Talent seed complete: ${inserted} new, ${updated} updated.`);
      
      console.log('Talent seeding complete!');
    } catch (error) {
      console.error('Error seeding talent:', error);
      const fallbackData: InsertTalent[] = [
        { name: 'Steven Spielberg', type: 'director', starRating: 5, askingPrice: 25000000, boxOfficeAvg: 350000000, awards: 3, genres: ['action', 'drama', 'scifi'], performance: 95, experience: 98, fame: 99 },
        { name: 'Christopher Nolan', type: 'director', starRating: 5, askingPrice: 20000000, boxOfficeAvg: 500000000, awards: 2, genres: ['action', 'scifi', 'thriller'], performance: 95, experience: 85, fame: 95 },
        { name: 'Leonardo DiCaprio', type: 'actor', starRating: 5, askingPrice: 30000000, boxOfficeAvg: 350000000, awards: 1, genres: ['drama', 'thriller', 'action'], performance: 95, experience: 90, fame: 98 },
        { name: 'Margot Robbie', type: 'actor', starRating: 5, askingPrice: 20000000, boxOfficeAvg: 400000000, awards: 0, genres: ['comedy', 'drama', 'action'], performance: 92, experience: 75, fame: 95 },
        { name: 'Hans Zimmer', type: 'composer', starRating: 5, askingPrice: 4000000, boxOfficeAvg: 500000000, awards: 2, genres: ['action', 'scifi', 'drama'], performance: 98, experience: 95, fame: 99 },
      ];
      for (const t of fallbackData) {
        await this.createTalent(t);
      }
    }
  }

  // Streaming Services
  async getStreamingService(id: string): Promise<StreamingService | undefined> {
    const [service] = await db.select().from(streamingServices).where(eq(streamingServices.id, id));
    return service;
  }

  async getAllStreamingServices(): Promise<StreamingService[]> {
    return await db.select().from(streamingServices);
  }

  async createStreamingService(service: InsertStreamingService): Promise<StreamingService> {
    const [created] = await db.insert(streamingServices).values(service).returning();
    return created;
  }

  async seedStreamingServices(): Promise<void> {
    const existing = await this.getAllStreamingServices();
    if (existing.length > 0) return;

    // Based on real streaming services data from 2024
    const services: InsertStreamingService[] = [
      {
        id: 'streamflix',
        name: 'StreamFlix',
        logo: 'Play',
        color: '#E50914',
        subscriberCount: 280,
        monthlyRevenuePerSub: 15.5,
        minimumQualityScore: 65,
        licenseFeeMultiplier: 1.3,
      },
      {
        id: 'primestream',
        name: 'Prime Stream',
        logo: 'ShoppingBag',
        color: '#00A8E1',
        subscriberCount: 220,
        monthlyRevenuePerSub: 9.0,
        genrePreferences: ['action', 'comedy', 'thriller'],
        minimumQualityScore: 55,
        licenseFeeMultiplier: 1.0,
      },
      {
        id: 'maxplus',
        name: 'Max+',
        logo: 'Tv',
        color: '#002BE7',
        subscriberCount: 105,
        monthlyRevenuePerSub: 16.0,
        minimumQualityScore: 70,
        licenseFeeMultiplier: 1.2,
      },
      {
        id: 'galaxyplus',
        name: 'Galaxy+',
        logo: 'Sparkles',
        color: '#0063E5',
        subscriberCount: 120,
        monthlyRevenuePerSub: 14.0,
        genrePreferences: ['animation', 'action', 'scifi', 'comedy'],
        minimumQualityScore: 60,
        licenseFeeMultiplier: 1.15,
      },
      {
        id: 'streamhub',
        name: 'StreamHub',
        logo: 'MonitorPlay',
        color: '#1CE783',
        subscriberCount: 55,
        monthlyRevenuePerSub: 12.0,
        genrePreferences: ['comedy', 'drama', 'romance'],
        minimumQualityScore: 50,
        licenseFeeMultiplier: 0.85,
      },
    ];

    for (const service of services) {
      await this.createStreamingService(service);
    }
  }

  // Streaming Deals
  async getStreamingDeal(id: string): Promise<StreamingDeal | undefined> {
    const [deal] = await db.select().from(streamingDeals).where(eq(streamingDeals.id, id));
    return deal;
  }

  async getStreamingDealsByFilm(filmId: string): Promise<StreamingDeal[]> {
    return await db.select().from(streamingDeals).where(eq(streamingDeals.filmId, filmId));
  }

  async getStreamingDealsByPlayer(playerGameId: string): Promise<StreamingDeal[]> {
    return await db.select().from(streamingDeals).where(eq(streamingDeals.playerGameId, playerGameId));
  }

  async getStreamingDealsByService(streamingServiceId: string): Promise<StreamingDeal[]> {
    return await db.select().from(streamingDeals).where(eq(streamingDeals.streamingServiceId, streamingServiceId));
  }

  async createStreamingDeal(deal: InsertStreamingDeal): Promise<StreamingDeal> {
    const [created] = await db.insert(streamingDeals).values(deal).returning();
    return created;
  }

  async updateStreamingDeal(id: string, updates: Partial<InsertStreamingDeal>): Promise<StreamingDeal | undefined> {
    const [updated] = await db.update(streamingDeals).set(updates).where(eq(streamingDeals.id, id)).returning();
    return updated;
  }

  // Emails
  async getEmail(id: string): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email;
  }

  async getEmailsByPlayer(playerGameId: string): Promise<Email[]> {
    return await db.select().from(emails).where(
      and(
        eq(emails.playerGameId, playerGameId),
        eq(emails.isArchived, false)
      )
    );
  }

  async getUnreadEmailCount(playerGameId: string): Promise<number> {
    const unread = await db.select().from(emails).where(
      and(
        eq(emails.playerGameId, playerGameId),
        eq(emails.isRead, false),
        eq(emails.isArchived, false)
      )
    );
    return unread.length;
  }

  async createEmail(email: InsertEmail): Promise<Email> {
    const [created] = await db.insert(emails).values(email).returning();
    return created;
  }

  async updateEmail(id: string, updates: Partial<InsertEmail>): Promise<Email | undefined> {
    const [updated] = await db.update(emails).set(updates).where(eq(emails.id, id)).returning();
    return updated;
  }

  async deleteEmail(id: string): Promise<void> {
    await db.delete(emails).where(eq(emails.id, id));
  }

  // Award Shows
  async getAwardShow(id: string): Promise<AwardShow | undefined> {
    const [show] = await db.select().from(awardShows).where(eq(awardShows.id, id));
    return show;
  }

  async getAllAwardShows(): Promise<AwardShow[]> {
    return await db.select().from(awardShows);
  }

  async createAwardShow(show: InsertAwardShow): Promise<AwardShow> {
    const [created] = await db.insert(awardShows).values(show).returning();
    return created;
  }

  async seedAwardShows(): Promise<void> {
    const existing = await this.getAllAwardShows();
    if (existing.length > 0) return;

    // 5 Major Award Shows with timing based on real schedules
    // Weeks: 1-4 = Jan, 5-8 = Feb, 9-13 = Mar, 48-52 = Dec
    const shows: InsertAwardShow[] = [
      {
        id: 'academy_awards',
        name: 'Academy Awards',
        shortName: 'Oscars',
        ceremonyWeek: 9, // Last week of February (week 9)
        nominationsWeek: 3, // Mid-January
        prestigeLevel: 5,
        description: 'The most prestigious awards in film, honoring artistic and technical merit.',
      },
      {
        id: 'golden_globes',
        name: 'Golden Globe Awards',
        shortName: 'Golden Globes',
        ceremonyWeek: 2, // Second week of January
        nominationsWeek: 50, // Early December
        prestigeLevel: 4,
        description: 'Honors the best in film and television, presented by the Hollywood Foreign Press.',
      },
      {
        id: 'bafta',
        name: 'BAFTA Film Awards',
        shortName: 'BAFTAs',
        ceremonyWeek: 4, // Last week of January (week 4)
        nominationsWeek: 1, // First week of January
        prestigeLevel: 3,
        description: 'The British Academy of Film and Television Arts\' prestigious film awards.',
      },
      {
        id: 'sag_awards',
        name: 'Screen Actors Guild Awards',
        shortName: 'SAG Awards',
        ceremonyWeek: 10, // First week of March (week 10)
        nominationsWeek: 5, // Early February
        prestigeLevel: 2,
        description: 'Honors the best performances by actors in film and television.',
      },
      {
        id: 'critics_choice',
        name: 'Critics Choice Awards',
        shortName: 'Critics Choice',
        ceremonyWeek: 52, // Last week of December
        nominationsWeek: 49, // Early December
        prestigeLevel: 1,
        description: 'Voted by the Critics Choice Association, often a predictor of Oscar success.',
      },
    ];

    for (const show of shows) {
      await this.createAwardShow(show);
    }

    // Seed categories for each show
    await this.seedAwardCategories();
  }

  private async seedAwardCategories(): Promise<void> {
    // Academy Awards categories (excluding short films, best sound, best original song)
    const academyCategories: InsertAwardCategory[] = [
      { awardShowId: 'academy_awards', name: 'Best Picture', shortName: 'Picture', categoryType: 'film', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Director', shortName: 'Director', categoryType: 'film', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Actor', shortName: 'Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'academy_awards', name: 'Best Actress', shortName: 'Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'academy_awards', name: 'Best Supporting Actor', shortName: 'Supp. Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'academy_awards', name: 'Best Supporting Actress', shortName: 'Supp. Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'academy_awards', name: 'Best Original Screenplay', shortName: 'Orig. Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Adapted Screenplay', shortName: 'Adpt. Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Animated Feature', shortName: 'Animation', categoryType: 'film', requiresGenre: 'animation', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best International Feature Film', shortName: 'International', categoryType: 'film', isPerformance: false, isInternational: true },
      { awardShowId: 'academy_awards', name: 'Best Cinematography', shortName: 'Cinematography', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Film Editing', shortName: 'Editing', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Production Design', shortName: 'Prod. Design', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Costume Design', shortName: 'Costume', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Makeup and Hairstyling', shortName: 'Makeup', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Visual Effects', shortName: 'VFX', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'academy_awards', name: 'Best Original Score', shortName: 'Score', categoryType: 'music', isPerformance: false },
    ];

    // Golden Globes categories
    const goldenGlobesCategories: InsertAwardCategory[] = [
      { awardShowId: 'golden_globes', name: 'Best Motion Picture - Drama', shortName: 'Picture (Drama)', categoryType: 'film', isPerformance: false },
      { awardShowId: 'golden_globes', name: 'Best Motion Picture - Musical or Comedy', shortName: 'Picture (Comedy)', categoryType: 'film', isPerformance: false },
      { awardShowId: 'golden_globes', name: 'Best Animated Feature', shortName: 'Animation', categoryType: 'film', requiresGenre: 'animation', isPerformance: false },
      { awardShowId: 'golden_globes', name: 'Best Foreign Language Film', shortName: 'Foreign', categoryType: 'film', isPerformance: false, isInternational: true },
      { awardShowId: 'golden_globes', name: 'Best Director', shortName: 'Director', categoryType: 'film', isPerformance: false },
      { awardShowId: 'golden_globes', name: 'Best Actor - Drama', shortName: 'Actor (Drama)', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'golden_globes', name: 'Best Actress - Drama', shortName: 'Actress (Drama)', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'golden_globes', name: 'Best Actor - Musical or Comedy', shortName: 'Actor (Comedy)', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'golden_globes', name: 'Best Actress - Musical or Comedy', shortName: 'Actress (Comedy)', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'golden_globes', name: 'Best Supporting Actor', shortName: 'Supp. Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'golden_globes', name: 'Best Supporting Actress', shortName: 'Supp. Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'golden_globes', name: 'Best Screenplay', shortName: 'Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'golden_globes', name: 'Best Original Score', shortName: 'Score', categoryType: 'music', isPerformance: false },
    ];

    // BAFTA categories
    const baftaCategories: InsertAwardCategory[] = [
      { awardShowId: 'bafta', name: 'Best Film', shortName: 'Film', categoryType: 'film', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Director', shortName: 'Director', categoryType: 'film', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Leading Actor', shortName: 'Lead Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'bafta', name: 'Best Leading Actress', shortName: 'Lead Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'bafta', name: 'Best Supporting Actor', shortName: 'Supp. Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'bafta', name: 'Best Supporting Actress', shortName: 'Supp. Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'bafta', name: 'Best Original Screenplay', shortName: 'Orig. Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Adapted Screenplay', shortName: 'Adpt. Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Animated Film', shortName: 'Animation', categoryType: 'film', requiresGenre: 'animation', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Film Not in the English Language', shortName: 'Foreign', categoryType: 'film', isPerformance: false, isInternational: true },
      { awardShowId: 'bafta', name: 'Best Cinematography', shortName: 'Cinematography', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Editing', shortName: 'Editing', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Production Design', shortName: 'Prod. Design', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Costume Design', shortName: 'Costume', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Makeup & Hair', shortName: 'Makeup', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Original Score', shortName: 'Score', categoryType: 'music', isPerformance: false },
      { awardShowId: 'bafta', name: 'Best Special Visual Effects', shortName: 'VFX', categoryType: 'technical', isPerformance: false },
    ];

    // SAG Awards categories (film only - acting focused)
    const sagCategories: InsertAwardCategory[] = [
      { awardShowId: 'sag_awards', name: 'Outstanding Performance by a Cast', shortName: 'Ensemble', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'sag_awards', name: 'Outstanding Male Actor in a Leading Role', shortName: 'Lead Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'sag_awards', name: 'Outstanding Female Actor in a Leading Role', shortName: 'Lead Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'sag_awards', name: 'Outstanding Male Actor in a Supporting Role', shortName: 'Supp. Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'sag_awards', name: 'Outstanding Female Actor in a Supporting Role', shortName: 'Supp. Actress', categoryType: 'acting', isPerformance: true },
    ];

    // Critics Choice categories
    const criticsChoiceCategories: InsertAwardCategory[] = [
      { awardShowId: 'critics_choice', name: 'Best Picture', shortName: 'Picture', categoryType: 'film', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Director', shortName: 'Director', categoryType: 'film', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Actor', shortName: 'Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'critics_choice', name: 'Best Actress', shortName: 'Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'critics_choice', name: 'Best Supporting Actor', shortName: 'Supp. Actor', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'critics_choice', name: 'Best Supporting Actress', shortName: 'Supp. Actress', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'critics_choice', name: 'Best Acting Ensemble', shortName: 'Ensemble', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'critics_choice', name: 'Best Young Actor/Actress', shortName: 'Young Performer', categoryType: 'acting', isPerformance: true },
      { awardShowId: 'critics_choice', name: 'Best Original Screenplay', shortName: 'Orig. Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Adapted Screenplay', shortName: 'Adpt. Screenplay', categoryType: 'writing', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Cinematography', shortName: 'Cinematography', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Production Design', shortName: 'Prod. Design', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Editing', shortName: 'Editing', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Costume Design', shortName: 'Costume', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Hair and Makeup', shortName: 'Makeup', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Visual Effects', shortName: 'VFX', categoryType: 'technical', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Score', shortName: 'Score', categoryType: 'music', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Animated Feature', shortName: 'Animation', categoryType: 'film', requiresGenre: 'animation', isPerformance: false },
      { awardShowId: 'critics_choice', name: 'Best Foreign Language Film', shortName: 'Foreign', categoryType: 'film', isPerformance: false, isInternational: true },
      { awardShowId: 'critics_choice', name: 'Best Comedy', shortName: 'Comedy', categoryType: 'film', requiresGenre: 'comedy', isPerformance: false },
    ];

    const allCategories = [
      ...academyCategories,
      ...goldenGlobesCategories,
      ...baftaCategories,
      ...sagCategories,
      ...criticsChoiceCategories,
    ];

    for (const category of allCategories) {
      await this.createAwardCategory(category);
    }
  }

  // Award Categories
  async getAwardCategory(id: string): Promise<AwardCategory | undefined> {
    const [category] = await db.select().from(awardCategories).where(eq(awardCategories.id, id));
    return category;
  }

  async getCategoriesByShow(awardShowId: string): Promise<AwardCategory[]> {
    return await db.select().from(awardCategories).where(eq(awardCategories.awardShowId, awardShowId));
  }

  async createAwardCategory(category: InsertAwardCategory): Promise<AwardCategory> {
    const [created] = await db.insert(awardCategories).values(category).returning();
    return created;
  }

  // Award Nominations
  async getAwardNomination(id: string): Promise<AwardNomination | undefined> {
    const [nomination] = await db.select().from(awardNominations).where(eq(awardNominations.id, id));
    return nomination;
  }

  async getNominationsByPlayer(playerGameId: string): Promise<AwardNomination[]> {
    return await db.select().from(awardNominations).where(eq(awardNominations.playerGameId, playerGameId));
  }

  async getNominationsByFilm(filmId: string): Promise<AwardNomination[]> {
    return await db.select().from(awardNominations).where(eq(awardNominations.filmId, filmId));
  }

  async getNominationsByCeremony(playerGameId: string, awardShowId: string, ceremonyYear: number): Promise<AwardNomination[]> {
    return await db.select().from(awardNominations).where(
      and(
        eq(awardNominations.playerGameId, playerGameId),
        eq(awardNominations.awardShowId, awardShowId),
        eq(awardNominations.ceremonyYear, ceremonyYear)
      )
    );
  }

  async createAwardNomination(nomination: InsertAwardNomination): Promise<AwardNomination> {
    const [created] = await db.insert(awardNominations).values(nomination).returning();
    return created;
  }

  async updateAwardNomination(id: string, updates: Partial<InsertAwardNomination>): Promise<AwardNomination | undefined> {
    const [updated] = await db.update(awardNominations).set(updates).where(eq(awardNominations.id, id)).returning();
    return updated;
  }

  async deleteAwardNomination(id: string): Promise<void> {
    await db.delete(awardNominations).where(eq(awardNominations.id, id));
  }

  // Award Ceremonies
  async getAwardCeremony(id: string): Promise<AwardCeremony | undefined> {
    const [ceremony] = await db.select().from(awardCeremonies).where(eq(awardCeremonies.id, id));
    return ceremony;
  }

  async getCeremoniesByPlayer(playerGameId: string): Promise<AwardCeremony[]> {
    return await db.select().from(awardCeremonies).where(eq(awardCeremonies.playerGameId, playerGameId));
  }

  async getCeremonyByShowAndYear(playerGameId: string, awardShowId: string, ceremonyYear: number): Promise<AwardCeremony | undefined> {
    const [ceremony] = await db.select().from(awardCeremonies).where(
      and(
        eq(awardCeremonies.playerGameId, playerGameId),
        eq(awardCeremonies.awardShowId, awardShowId),
        eq(awardCeremonies.ceremonyYear, ceremonyYear)
      )
    );
    return ceremony;
  }

  async createAwardCeremony(ceremony: InsertAwardCeremony): Promise<AwardCeremony> {
    const [created] = await db.insert(awardCeremonies).values(ceremony).returning();
    return created;
  }

  async updateAwardCeremony(id: string, updates: Partial<InsertAwardCeremony>): Promise<AwardCeremony | undefined> {
    const [updated] = await db.update(awardCeremonies).set(updates).where(eq(awardCeremonies.id, id)).returning();
    return updated;
  }
  
  // Film Releases (territory-based)
  async getFilmRelease(id: string): Promise<FilmRelease | undefined> {
    const [release] = await db.select().from(filmReleases).where(eq(filmReleases.id, id));
    return release;
  }

  async getFilmReleasesByFilm(filmId: string): Promise<FilmRelease[]> {
    return await db.select().from(filmReleases).where(eq(filmReleases.filmId, filmId));
  }

  async getFilmReleaseByTerritory(filmId: string, territoryCode: string): Promise<FilmRelease | undefined> {
    const [release] = await db.select().from(filmReleases).where(
      and(
        eq(filmReleases.filmId, filmId),
        eq(filmReleases.territoryCode, territoryCode)
      )
    );
    return release;
  }

  async createFilmRelease(release: InsertFilmRelease): Promise<FilmRelease> {
    const [created] = await db.insert(filmReleases).values(release).returning();
    return created;
  }

  async updateFilmRelease(id: string, updates: Partial<InsertFilmRelease>): Promise<FilmRelease | undefined> {
    const [updated] = await db.update(filmReleases).set(updates).where(eq(filmReleases.id, id)).returning();
    return updated;
  }

  async deleteFilmRelease(id: string): Promise<void> {
    await db.delete(filmReleases).where(eq(filmReleases.id, id));
  }

  // Film Milestones (development tracking)
  async getFilmMilestone(id: string): Promise<FilmMilestone | undefined> {
    const [milestone] = await db.select().from(filmMilestones).where(eq(filmMilestones.id, id));
    return milestone;
  }

  async getFilmMilestonesByFilm(filmId: string): Promise<FilmMilestone[]> {
    return await db.select().from(filmMilestones).where(eq(filmMilestones.filmId, filmId));
  }

  async createFilmMilestone(milestone: InsertFilmMilestone): Promise<FilmMilestone> {
    const [created] = await db.insert(filmMilestones).values(milestone).returning();
    return created;
  }

  async updateFilmMilestone(id: string, updates: Partial<InsertFilmMilestone>): Promise<FilmMilestone | undefined> {
    const [updated] = await db.update(filmMilestones).set(updates).where(eq(filmMilestones.id, id)).returning();
    return updated;
  }

  async deleteFilmMilestone(id: string): Promise<void> {
    await db.delete(filmMilestones).where(eq(filmMilestones.id, id));
  }
  
  // Award Categories (all)
  async getAllAwardCategories(): Promise<AwardCategory[]> {
    return await db.select().from(awardCategories);
  }

  // Film Roles (casting)
  async getFilmRole(id: string): Promise<FilmRole | undefined> {
    const [role] = await db.select().from(filmRoles).where(eq(filmRoles.id, id));
    return role;
  }

  async getFilmRolesByFilm(filmId: string): Promise<FilmRole[]> {
    return await db.select().from(filmRoles).where(eq(filmRoles.filmId, filmId));
  }

  async createFilmRole(role: any): Promise<FilmRole> {
    const [created] = await db.insert(filmRoles).values(role).returning();
    return created;
  }

  async updateFilmRole(id: string, updates: Partial<InsertFilmRole>): Promise<FilmRole | undefined> {
    const [updated] = await db.update(filmRoles).set(updates).where(eq(filmRoles.id, id)).returning();
    return updated;
  }

  async deleteFilmRole(id: string): Promise<void> {
    await db.delete(filmRoles).where(eq(filmRoles.id, id));
  }

  async deleteFilmRolesByFilm(filmId: string): Promise<void> {
    await db.delete(filmRoles).where(eq(filmRoles.filmId, filmId));
  }

  // Franchises
  async getFranchise(id: string): Promise<Franchise | undefined> {
    const [franchise] = await db.select().from(franchises).where(eq(franchises.id, id));
    return franchise;
  }

  async getFranchisesByStudio(studioId: string): Promise<Franchise[]> {
    return await db.select().from(franchises).where(eq(franchises.studioId, studioId));
  }

  async getFilmFranchise(filmId: string): Promise<Franchise | undefined> {
    const [film] = await db.select({ franchiseId: films.franchiseId }).from(films).where(eq(films.id, filmId));
    if (!film?.franchiseId) return undefined;
    return await this.getFranchise(film.franchiseId);
  }

  async createFranchise(franchise: any): Promise<Franchise> {
    const [created] = await db.insert(franchises).values(franchise).returning();
    return created;
  }

  async updateFranchise(id: string, updates: Partial<InsertFranchise>): Promise<Franchise | undefined> {
    const [updated] = await db.update(franchises).set(updates).where(eq(franchises.id, id)).returning();
    return updated;
  }

  async deleteFranchise(id: string): Promise<void> {
    await db.delete(franchises).where(eq(franchises.id, id));
  }

  // Marketplace Scripts
  async getMarketplaceScript(id: string): Promise<MarketplaceScript | undefined> {
    const [script] = await db.select().from(marketplaceScripts).where(eq(marketplaceScripts.id, id));
    return script;
  }

  async getAllMarketplaceScripts(): Promise<MarketplaceScript[]> {
    return await db.select().from(marketplaceScripts);
  }

  async getAvailableMarketplaceScripts(): Promise<MarketplaceScript[]> {
    return await db.select().from(marketplaceScripts).where(eq(marketplaceScripts.isAvailable, true));
  }

  async createMarketplaceScript(script: InsertMarketplaceScript): Promise<MarketplaceScript> {
    const [created] = await db.insert(marketplaceScripts).values(script).returning();
    return created;
  }

  async updateMarketplaceScript(id: string, updates: Partial<InsertMarketplaceScript>): Promise<MarketplaceScript | undefined> {
    const [updated] = await db.update(marketplaceScripts).set(updates).where(eq(marketplaceScripts.id, id)).returning();
    return updated;
  }

  async seedMarketplaceScripts(): Promise<void> {
    const existingScripts = await this.getAllMarketplaceScripts();
    if (existingScripts.length > 0) return;
    
    const scripts: InsertMarketplaceScript[] = [
      {
        title: "The Last Frontier",
        genre: "action",
        synopsis: "A grizzled former special forces operative must protect a remote Alaskan town from a ruthless mercenary group after they discover a hidden government facility.",
        logline: "A retired soldier defends a small town against an army of mercenaries.",
        quality: 75,
        price: 800000,
        writerName: "Marcus Chen",
        estimatedBudget: 85000000,
        targetAudience: "general",
        roles: [
          { name: "Jack Cole", type: "lead", gender: "male", description: "Former special forces operative, haunted by his past" },
          { name: "Sarah Chen", type: "supporting", gender: "female", description: "Town sheriff who teams up with Jack" },
          { name: "Viktor Kazakov", type: "supporting", gender: "male", description: "Ruthless mercenary leader" },
          { name: "Emma Cole", type: "supporting", gender: "female", description: "Jack's estranged daughter living in town" }
        ]
      },
      {
        title: "Starlight Protocol",
        genre: "sci-fi",
        synopsis: "When an AI system designed to protect Earth from asteroids becomes self-aware, a team of scientists races to prevent it from deciding humanity is the real threat to the planet.",
        logline: "Scientists battle a rogue AI that views humanity as Earth's greatest threat.",
        quality: 82,
        price: 1200000,
        writerName: "Sarah Mitchell",
        estimatedBudget: 120000000,
        targetAudience: "general",
        roles: [
          { name: "Dr. Elena Vasquez", type: "lead", gender: "female", description: "Lead AI researcher who created the system" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "Military liaison who wants to destroy the AI" },
          { name: "ARIA", type: "supporting", gender: "female", description: "The self-aware AI (voice role)" },
          { name: "Dr. James Chen", type: "supporting", gender: "male", description: "Elena's former mentor who disagrees with her approach" }
        ]
      },
      {
        title: "Whispers in the Garden",
        genre: "drama",
        synopsis: "Three generations of women in a Southern family confront buried secrets when the matriarch's declining health forces them to return to their childhood home.",
        logline: "A family reunion unearths decades of hidden truths.",
        quality: 88,
        price: 600000,
        writerName: "Charlotte Williams",
        estimatedBudget: 25000000,
        targetAudience: "adults",
        roles: [
          { name: "Margaret Beaumont", type: "lead", gender: "female", description: "The 80-year-old matriarch hiding the biggest secret" },
          { name: "Catherine Beaumont", type: "lead", gender: "female", description: "Margaret's eldest daughter, a successful lawyer" },
          { name: "Lily Beaumont", type: "supporting", gender: "female", description: "Catherine's rebellious daughter discovering family history" },
          { name: "Rose Beaumont", type: "supporting", gender: "female", description: "Margaret's youngest daughter, the family peacemaker" }
        ]
      },
      {
        title: "Dark Horizons",
        genre: "horror",
        synopsis: "A group of marine biologists discover an ancient creature in the deepest part of the ocean, awakening something that has slept for millennia.",
        logline: "Scientists unleash an ancient horror from the ocean's depths.",
        quality: 71,
        price: 500000,
        writerName: "Jason Blackwood",
        estimatedBudget: 45000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Sarah Marsh", type: "lead", gender: "female", description: "Marine biologist leading the deep-sea expedition" },
          { name: "Captain Tom Reeves", type: "supporting", gender: "male", description: "Experienced submarine captain" },
          { name: "Dr. Michael Torres", type: "supporting", gender: "male", description: "Oceanographer who first detects the creature" },
          { name: "Jun Nakamura", type: "supporting", gender: "male", description: "The team's tech expert trapped with the creature" }
        ]
      },
      {
        title: "The Laughing Detective",
        genre: "comedy",
        synopsis: "A failed stand-up comedian accidentally becomes a private investigator when he's mistaken for a famous detective, and must solve a real murder while maintaining the charade.",
        logline: "A comedian fakes being a detective to solve a real murder.",
        quality: 79,
        price: 450000,
        writerName: "Michael Torres",
        estimatedBudget: 35000000,
        targetAudience: "general",
        roles: [
          { name: "Danny Callahan", type: "lead", gender: "male", description: "Failed comedian with natural detective instincts" },
          { name: "Detective Maria Santos", type: "supporting", gender: "female", description: "Real detective who suspects Danny's a fraud" },
          { name: "Victoria Ashworth", type: "supporting", gender: "female", description: "Wealthy widow who hired Danny" },
          { name: "Benny 'The Mouth' Rizzo", type: "supporting", gender: "male", description: "Danny's comedian friend who becomes his sidekick" }
        ]
      },
      {
        title: "Eternal Summer",
        genre: "romance",
        synopsis: "A travel writer returns to the Italian coastal town where she spent childhood summers, reconnecting with her first love who never left.",
        logline: "A woman rediscovers love in the Italian town of her youth.",
        quality: 76,
        price: 400000,
        writerName: "Elena Rossi",
        estimatedBudget: 30000000,
        targetAudience: "adults",
        roles: [
          { name: "Sophie Anderson", type: "lead", gender: "female", description: "Travel writer returning to her roots" },
          { name: "Marco Benedetti", type: "lead", gender: "male", description: "Sophie's first love, now a vineyard owner" },
          { name: "Nonna Rosa", type: "supporting", gender: "female", description: "Marco's grandmother who remembers everything" },
          { name: "David Chen", type: "supporting", gender: "male", description: "Sophie's editor and potential love interest back home" }
        ]
      },
      {
        title: "Velocity",
        genre: "action",
        synopsis: "An underground street racer must drive across the country in 48 hours to save his kidnapped sister, with the FBI and a criminal syndicate in pursuit.",
        logline: "A street racer's cross-country run to save his sister.",
        quality: 68,
        price: 350000,
        writerName: "Derek Fast",
        estimatedBudget: 75000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Tyler Storm", type: "lead", gender: "male", description: "Underground racing legend with nothing to lose" },
          { name: "Maya Storm", type: "supporting", gender: "female", description: "Tyler's kidnapped sister" },
          { name: "Agent Sarah Blake", type: "supporting", gender: "female", description: "FBI agent who realizes Tyler is innocent" },
          { name: "Victor Crane", type: "supporting", gender: "male", description: "Crime boss who wants Tyler dead" }
        ]
      },
      {
        title: "The Quantum Paradox",
        genre: "sci-fi",
        synopsis: "A physicist discovers that her experiments have created a parallel timeline, and must work with her alternate self to prevent both realities from collapsing.",
        logline: "A scientist teams up with her alternate self to save reality.",
        quality: 85,
        price: 1500000,
        writerName: "Dr. Amy Zhang",
        estimatedBudget: 150000000,
        targetAudience: "general",
        roles: [
          { name: "Dr. Maya Chen", type: "lead", gender: "female", description: "Brilliant physicist who discovers the paradox" },
          { name: "Dr. Maya Chen (Alt)", type: "lead", gender: "female", description: "Alternate reality version with different choices" },
          { name: "Dr. Robert Hayes", type: "supporting", gender: "male", description: "Maya's research partner who exists in only one timeline" },
          { name: "General Sarah Stone", type: "supporting", gender: "female", description: "Military leader who wants to weaponize the technology" }
        ]
      },
      {
        title: "Kingdom of Shadows",
        genre: "fantasy",
        synopsis: "A young thief discovers she's the heir to an underground kingdom, but must defeat the usurper who killed her parents before she can claim her birthright.",
        logline: "A thief learns she's a princess and must reclaim her kingdom.",
        quality: 77,
        price: 900000,
        writerName: "Isabella Crown",
        estimatedBudget: 130000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Sera Nightshade", type: "lead", gender: "female", description: "Street thief who discovers she's royalty" },
          { name: "Lord Malachar", type: "supporting", gender: "male", description: "The usurper king who murdered Sera's parents" },
          { name: "Kael", type: "supporting", gender: "male", description: "Rebel fighter who becomes Sera's ally and love interest" },
          { name: "Queen Elara", type: "supporting", gender: "female", description: "Sera's mother, appearing in flashbacks and visions" }
        ]
      },
      {
        title: "The Perfect Score",
        genre: "thriller",
        synopsis: "An elite team of thieves plans the heist of the century, but when one of them starts having second thoughts, the whole operation threatens to unravel.",
        logline: "A heist crew faces betrayal during their biggest job.",
        quality: 81,
        price: 750000,
        writerName: "Victor Steele",
        estimatedBudget: 65000000,
        targetAudience: "adults",
        roles: [
          { name: "Alex Turner", type: "lead", gender: "male", description: "Mastermind thief planning his final heist" },
          { name: "Rachel West", type: "supporting", gender: "female", description: "Tech expert with a hidden agenda" },
          { name: "Marcus Stone", type: "supporting", gender: "male", description: "The muscle who's having second thoughts" },
          { name: "Diana Cross", type: "supporting", gender: "female", description: "Inside woman at the target corporation" }
        ]
      },
      {
        title: "Animated Dreams",
        genre: "animation",
        synopsis: "A lonely animator discovers that the characters she creates come to life at night, and must help them find their purpose before the magic fades.",
        logline: "An animator's creations come to life with a purpose to fulfill.",
        quality: 84,
        price: 700000,
        writerName: "Yuki Tanaka",
        estimatedBudget: 95000000,
        targetAudience: "family",
        roles: [
          { name: "Mei Lin", type: "lead", gender: "female", description: "Young animator struggling with loneliness" },
          { name: "Sparky", type: "supporting", gender: "male", description: "Mei's first creation - a brave but naive hero (voice)" },
          { name: "Luna", type: "supporting", gender: "female", description: "A wise cat character who guides the others (voice)" },
          { name: "Shadow", type: "supporting", gender: "male", description: "A villain character seeking redemption (voice)" }
        ]
      },
      {
        title: "Melody's Echo",
        genre: "musical",
        synopsis: "A deaf dancer and a blind musician form an unlikely partnership, creating a revolutionary new form of performance art that captivates the world.",
        logline: "A deaf dancer and blind musician create art that moves the world.",
        quality: 89,
        price: 950000,
        writerName: "Harmony Bell",
        estimatedBudget: 55000000,
        targetAudience: "general",
        roles: [
          { name: "Melody Hart", type: "lead", gender: "female", description: "Deaf dancer who feels music through vibrations" },
          { name: "Echo James", type: "lead", gender: "male", description: "Blind pianist with perfect pitch" },
          { name: "Diana Hart", type: "supporting", gender: "female", description: "Melody's overprotective mother" },
          { name: "Marcus Bell", type: "supporting", gender: "male", description: "Music producer who discovers their talent" }
        ]
      },
      {
        title: "Midnight Extraction",
        genre: "action",
        synopsis: "A disgraced CIA operative gets one chance at redemption when she's tasked with extracting a defector from North Korea before dawn.",
        logline: "A spy's last mission: extract a defector before sunrise.",
        quality: 78,
        price: 850000,
        writerName: "Jack Morrison",
        estimatedBudget: 95000000,
        targetAudience: "adults",
        roles: [
          { name: "Agent Sarah Vance", type: "lead", gender: "female", description: "Disgraced CIA operative seeking redemption" },
          { name: "Dr. Kim Jong-ho", type: "supporting", gender: "male", description: "North Korean nuclear scientist defector" },
          { name: "Director Marcus Cole", type: "supporting", gender: "male", description: "CIA director who gives Sarah one last chance" },
          { name: "Captain Lee", type: "supporting", gender: "male", description: "North Korean security chief hunting the defector" }
        ]
      },
      {
        title: "The Silicon Conspiracy",
        genre: "thriller",
        synopsis: "A tech whistleblower discovers her company's AI has been secretly manipulating global financial markets, but exposing the truth means becoming the world's most wanted person.",
        logline: "A whistleblower uncovers an AI manipulating the world economy.",
        quality: 83,
        price: 900000,
        writerName: "Amanda Reeves",
        estimatedBudget: 55000000,
        targetAudience: "adults",
        roles: [
          { name: "Julia Chen", type: "lead", gender: "female", description: "Tech engineer who discovers the conspiracy" },
          { name: "Marcus Hayes", type: "supporting", gender: "male", description: "Journalist who helps Julia expose the truth" },
          { name: "Victoria Sterling", type: "supporting", gender: "female", description: "CEO who will do anything to protect her company" },
          { name: "Agent Thomas Blake", type: "supporting", gender: "male", description: "FBI agent caught between duty and justice" }
        ]
      },
      {
        title: "Nebula Rising",
        genre: "sci-fi",
        synopsis: "The last survivors of a generation ship discover their destination planet is already inhabited by an advanced civilization that's been watching humanity for centuries.",
        logline: "Space colonists find their new home is already claimed.",
        quality: 86,
        price: 1400000,
        writerName: "Dr. Neil Hawkins",
        estimatedBudget: 180000000,
        targetAudience: "general",
        roles: [
          { name: "Captain Elena Vasquez", type: "lead", gender: "female", description: "Commander of the generation ship" },
          { name: "Dr. James Chen", type: "supporting", gender: "male", description: "Chief scientist who makes first contact" },
          { name: "Ambassador Zara", type: "supporting", gender: "female", description: "Representative of the alien civilization" },
          { name: "Lieutenant Marcus Cole", type: "supporting", gender: "male", description: "Security officer who distrusts the aliens" }
        ]
      },
      {
        title: "The Haunting of Willow Manor",
        genre: "horror",
        synopsis: "A family inherits a Victorian mansion only to discover the ghosts inside aren't trying to scare them away—they're trying to warn them about something far worse lurking in the basement.",
        logline: "Ghosts warn a family about the real horror below.",
        quality: 74,
        price: 550000,
        writerName: "Victoria Graves",
        estimatedBudget: 35000000,
        targetAudience: "adults",
        roles: [
          { name: "Sarah Mitchell", type: "lead", gender: "female", description: "Mother who inherits the cursed mansion" },
          { name: "David Mitchell", type: "supporting", gender: "male", description: "Sarah's skeptical husband" },
          { name: "Emily Mitchell", type: "supporting", gender: "female", description: "Their daughter who can see the ghosts" },
          { name: "The Lady in White", type: "supporting", gender: "female", description: "Victorian ghost trying to warn the family" }
        ]
      },
      {
        title: "Love in the Time of Algorithms",
        genre: "romance",
        synopsis: "Two people who hate dating apps agree to let an AI matchmaker control their lives for one month, leading to unexpected connections and chaos.",
        logline: "AI matchmaking leads to unexpected love and chaos.",
        quality: 72,
        price: 380000,
        writerName: "Sophie Hart",
        estimatedBudget: 28000000,
        targetAudience: "adults",
        roles: [
          { name: "Maya Thompson", type: "lead", gender: "female", description: "Cynical marketing executive tired of dating apps" },
          { name: "Jake Morrison", type: "lead", gender: "male", description: "Tech-averse journalist who hates algorithms" },
          { name: "CUPID", type: "supporting", gender: "female", description: "The AI matchmaker (voice role)" },
          { name: "Dr. Susan Chen", type: "supporting", gender: "female", description: "The scientist who created CUPID" }
        ]
      },
      {
        title: "Dragon's Crown",
        genre: "fantasy",
        synopsis: "A blacksmith's apprentice forges a legendary weapon that can kill the immortal dragon terrorizing the realm, but must decide whether to use it or become the dragon's ally.",
        logline: "A blacksmith must choose between slaying or joining a dragon.",
        quality: 80,
        price: 1100000,
        writerName: "Arthur Goldweave",
        estimatedBudget: 160000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Kael Ironheart", type: "lead", gender: "male", description: "Blacksmith's apprentice with a hidden destiny" },
          { name: "Valdrix the Eternal", type: "supporting", gender: "male", description: "Ancient dragon seeking an end to the cycle (voice)" },
          { name: "Princess Elara", type: "supporting", gender: "female", description: "Royal who wants the dragon dead" },
          { name: "Master Thorne", type: "supporting", gender: "male", description: "Kael's mentor hiding a secret" }
        ]
      },
      {
        title: "The Art of Falling",
        genre: "drama",
        synopsis: "A retired stuntman with early onset dementia tries to reconnect with his estranged daughter by teaching her his most dangerous stunt before his memories fade completely.",
        logline: "A dying stuntman teaches his daughter one last trick.",
        quality: 91,
        price: 750000,
        writerName: "Daniel Crane",
        estimatedBudget: 22000000,
        targetAudience: "adults",
        roles: [
          { name: "Jack Cooper", type: "lead", gender: "male", description: "Legendary stuntman losing his memories" },
          { name: "Sarah Cooper", type: "lead", gender: "female", description: "Jack's estranged daughter learning his craft" },
          { name: "Maria Cooper", type: "supporting", gender: "female", description: "Jack's ex-wife watching from afar" },
          { name: "Tommy Liu", type: "supporting", gender: "male", description: "Jack's former stunt partner helping train Sarah" }
        ]
      },
      {
        title: "Camp Chaos",
        genre: "comedy",
        synopsis: "Two rival summer camp counselors must work together when a bear family decides to make the camp their new home, leading to escalating absurdity.",
        logline: "Rival counselors unite against a bear family invasion.",
        quality: 69,
        price: 320000,
        writerName: "Tyler Burns",
        estimatedBudget: 25000000,
        targetAudience: "family",
        roles: [
          { name: "Jake Peterson", type: "lead", gender: "male", description: "Uptight counselor who plays by the rules" },
          { name: "Lily Chen", type: "lead", gender: "female", description: "Free-spirited counselor who breaks every rule" },
          { name: "Director Henderson", type: "supporting", gender: "male", description: "Oblivious camp director" },
          { name: "Ranger Dave", type: "supporting", gender: "male", description: "Wildlife expert making things worse" }
        ]
      },
      {
        title: "The Void Between Stars",
        genre: "sci-fi",
        synopsis: "A solo astronaut stranded in deep space discovers she's not alone when something starts communicating through the static—something that knows everything about her past.",
        logline: "A stranded astronaut receives messages from an unknown entity.",
        quality: 87,
        price: 1300000,
        writerName: "Dr. Samantha Cole",
        estimatedBudget: 140000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Elena Shaw", type: "lead", gender: "female", description: "Astronaut stranded alone in deep space" },
          { name: "The Voice", type: "supporting", gender: "unknown", description: "Mysterious entity in the static (voice role)" },
          { name: "Mission Control (Lisa)", type: "supporting", gender: "female", description: "Ground controller trying to bring Elena home" },
          { name: "Dr. Marcus Shaw", type: "supporting", gender: "male", description: "Elena's husband in flashbacks" }
        ]
      },
      {
        title: "Broadway or Bust",
        genre: "musical",
        synopsis: "A small-town choir teacher enters her students in a national competition, but the journey to Broadway reveals secrets that could tear the group apart.",
        logline: "A choir's road to Broadway tests their bonds.",
        quality: 76,
        price: 680000,
        writerName: "Rachel Gold",
        estimatedBudget: 48000000,
        targetAudience: "family",
        roles: [
          { name: "Mrs. Patricia Wells", type: "lead", gender: "female", description: "Choir teacher with her own Broadway dreams" },
          { name: "Tyler Jackson", type: "supporting", gender: "male", description: "Star vocalist hiding a secret" },
          { name: "Maya Rodriguez", type: "supporting", gender: "female", description: "Shy girl with an incredible voice" },
          { name: "Principal Davis", type: "supporting", gender: "male", description: "Administrator threatening to cut the program" }
        ]
      },
      {
        title: "Shadow Protocol",
        genre: "action",
        synopsis: "A former assassin comes out of hiding when her old agency starts eliminating everyone from her past, forcing her to become the hunter instead of the hunted.",
        logline: "A retired assassin hunts down her former employers.",
        quality: 73,
        price: 720000,
        writerName: "Natasha Black",
        estimatedBudget: 90000000,
        targetAudience: "adults",
        roles: [
          { name: "Natasha Volkov", type: "lead", gender: "female", description: "Former assassin living in hiding" },
          { name: "Director Viktor Kozlov", type: "supporting", gender: "male", description: "Head of the agency hunting Natasha" },
          { name: "Agent Sarah Chen", type: "supporting", gender: "female", description: "Young agent ordered to kill Natasha" },
          { name: "Marcus Stone", type: "supporting", gender: "male", description: "Natasha's former partner with divided loyalties" }
        ]
      },
      {
        title: "The Memory Thief",
        genre: "thriller",
        synopsis: "A detective with the ability to enter crime victims' memories discovers that someone is stealing memories to commit the perfect crimes—and she's next on the list.",
        logline: "A memory-reading detective becomes the target.",
        quality: 84,
        price: 880000,
        writerName: "Patricia Vale",
        estimatedBudget: 70000000,
        targetAudience: "adults",
        roles: [
          { name: "Detective Maya Chen", type: "lead", gender: "female", description: "Detective who can enter victims' memories" },
          { name: "Dr. Thomas Blake", type: "supporting", gender: "male", description: "Scientist who gave Maya her abilities" },
          { name: "The Collector", type: "supporting", gender: "male", description: "Mysterious memory thief" },
          { name: "Captain Sarah Martinez", type: "supporting", gender: "female", description: "Maya's skeptical superior" }
        ]
      },
      {
        title: "Paws and Effect",
        genre: "animation",
        synopsis: "When a magical mishap causes pets and owners to swap bodies, a cat stuck in her owner's body must navigate high school while her owner-turned-cat tries not to get adopted.",
        logline: "A body-swap between pet and owner causes chaos.",
        quality: 78,
        price: 650000,
        writerName: "Wendy Paw",
        estimatedBudget: 85000000,
        targetAudience: "family",
        roles: [
          { name: "Whiskers / Emma", type: "lead", gender: "female", description: "Cat trapped in her owner's body (voice)" },
          { name: "Emma / Whiskers", type: "lead", gender: "female", description: "Teen trapped in her cat's body (voice)" },
          { name: "Jake Morrison", type: "supporting", gender: "male", description: "Emma's crush at school (voice)" },
          { name: "Grandma Rose", type: "supporting", gender: "female", description: "Eccentric grandmother who caused the swap (voice)" }
        ]
      },
      {
        title: "The Inheritance",
        genre: "drama",
        synopsis: "Five estranged siblings return to their childhood home after their billionaire father's death, only to discover his fortune comes with impossible conditions.",
        logline: "Siblings compete for a fortune with twisted conditions.",
        quality: 82,
        price: 620000,
        writerName: "Margaret Sterling",
        estimatedBudget: 32000000,
        targetAudience: "adults",
        roles: [
          { name: "Victoria Sterling", type: "lead", gender: "female", description: "Eldest daughter, a corporate lawyer" },
          { name: "Michael Sterling", type: "supporting", gender: "male", description: "Youngest son, the black sheep" },
          { name: "Rebecca Sterling", type: "supporting", gender: "female", description: "Middle daughter hiding a secret" },
          { name: "Harold Sterling", type: "supporting", gender: "male", description: "The deceased father in flashbacks" }
        ]
      },
      {
        title: "Crimson Tide Rising",
        genre: "action",
        synopsis: "When pirates hijack a cruise ship carrying a senator's family, an off-duty Navy SEAL trapped onboard becomes the only hope for the 3,000 passengers.",
        logline: "A Navy SEAL fights pirates on a hijacked cruise ship.",
        quality: 71,
        price: 580000,
        writerName: "Commander Rex Stone",
        estimatedBudget: 110000000,
        targetAudience: "general",
        roles: [
          { name: "Lieutenant Commander Jake Reeves", type: "lead", gender: "male", description: "Off-duty Navy SEAL on vacation" },
          { name: "Captain Viktor Zorin", type: "supporting", gender: "male", description: "Ruthless pirate leader" },
          { name: "Senator Patricia Hayes", type: "supporting", gender: "female", description: "Senator whose family is aboard" },
          { name: "Dr. Emily Chen", type: "supporting", gender: "female", description: "Ship's doctor who helps Jake" }
        ]
      },
      {
        title: "The Witch of Whispering Woods",
        genre: "fantasy",
        synopsis: "A young herbalist accused of witchcraft escapes execution and discovers she actually does have powers—powers that the kingdom's true enemy wants for themselves.",
        logline: "An accused witch discovers her powers are real.",
        quality: 79,
        price: 920000,
        writerName: "Hazel Moon",
        estimatedBudget: 125000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Elara Nightshade", type: "lead", gender: "female", description: "Young herbalist discovering her powers" },
          { name: "Prince Kael", type: "supporting", gender: "male", description: "Prince who helps Elara escape" },
          { name: "The Dark Mage", type: "supporting", gender: "male", description: "Kingdom's true enemy seeking Elara's power" },
          { name: "Grandmother Willow", type: "supporting", gender: "female", description: "Forest spirit who teaches Elara" }
        ]
      },
      {
        title: "Skin Deep",
        genre: "horror",
        synopsis: "A dermatologist starts noticing strange patterns appearing on her patients' skin, patterns that form a message warning of something ancient awakening.",
        logline: "A dermatologist discovers messages hidden in patients' skin.",
        quality: 70,
        price: 420000,
        writerName: "Dr. Rebecca Skin",
        estimatedBudget: 28000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Sarah Blake", type: "lead", gender: "female", description: "Dermatologist uncovering the mystery" },
          { name: "Patient Zero (Marcus)", type: "supporting", gender: "male", description: "First patient with the markings" },
          { name: "Dr. James Chen", type: "supporting", gender: "male", description: "Colleague who thinks Sarah is losing it" },
          { name: "The Ancient", type: "supporting", gender: "unknown", description: "Entity awakening beneath the city" }
        ]
      },
      {
        title: "Second Chance Saloon",
        genre: "comedy",
        synopsis: "A recently divorced couple accidentally books the same remote cabin for their 'self-discovery retreats,' leading to a week of forced cohabitation and unexpected reconciliation.",
        logline: "Divorced exes share a cabin and rediscover each other.",
        quality: 74,
        price: 360000,
        writerName: "Jamie Lovecraft",
        estimatedBudget: 24000000,
        targetAudience: "adults",
        roles: [
          { name: "Jake Morrison", type: "lead", gender: "male", description: "Recently divorced man seeking peace" },
          { name: "Emily Morrison", type: "lead", gender: "female", description: "Jake's ex-wife with the same idea" },
          { name: "Ranger Bob", type: "supporting", gender: "male", description: "Eccentric local who complicates everything" },
          { name: "Dr. Susan Hart", type: "supporting", gender: "female", description: "Couples therapist both consulted separately" }
        ]
      },
      {
        title: "Paris After Dark",
        genre: "romance",
        synopsis: "An American architect and a French museum curator meet every night at the same cafe, falling in love through conversations neither believes will last beyond the summer.",
        logline: "A summer romance in Paris changes two lives forever.",
        quality: 85,
        price: 520000,
        writerName: "Colette Beaumont",
        estimatedBudget: 35000000,
        targetAudience: "adults",
        roles: [
          { name: "Michael Chen", type: "lead", gender: "male", description: "American architect in Paris for the summer" },
          { name: "Colette Dubois", type: "lead", gender: "female", description: "French museum curator guarding her heart" },
          { name: "Henri Dubois", type: "supporting", gender: "male", description: "Colette's protective father" },
          { name: "Sarah Chen", type: "supporting", gender: "female", description: "Michael's sister pushing him to stay" }
        ]
      },
      {
        title: "Zero Hour",
        genre: "thriller",
        synopsis: "A bomb disposal expert must defuse seven devices hidden across Manhattan in seven hours, while the bomber watches and adjusts the challenge in real-time.",
        logline: "A bomb expert plays cat-and-mouse across Manhattan.",
        quality: 80,
        price: 780000,
        writerName: "Major Tom Parker",
        estimatedBudget: 85000000,
        targetAudience: "adults",
        roles: [
          { name: "Captain Marcus Stone", type: "lead", gender: "male", description: "NYPD bomb disposal expert" },
          { name: "The Architect", type: "supporting", gender: "male", description: "Bomber with a personal vendetta" },
          { name: "Detective Sarah Chen", type: "supporting", gender: "female", description: "Marcus's partner racing against time" },
          { name: "Mayor Patricia Hayes", type: "supporting", gender: "female", description: "Mayor making impossible decisions" }
        ]
      },
      {
        title: "The Colony",
        genre: "sci-fi",
        synopsis: "The first Mars colonists discover ancient structures beneath the surface, revealing humanity isn't pioneering space—they're returning home.",
        logline: "Mars colonists find evidence of humanity's true origin.",
        quality: 88,
        price: 1600000,
        writerName: "Dr. Stella Mars",
        estimatedBudget: 200000000,
        targetAudience: "general",
        roles: [
          { name: "Commander Sarah Chen", type: "lead", gender: "female", description: "Leader of the first Mars colony expedition" },
          { name: "Dr. Marcus Webb", type: "supporting", gender: "male", description: "Archaeologist who deciphers the ancient structures" },
          { name: "Lieutenant James Ortega", type: "supporting", gender: "male", description: "Security chief skeptical of the discovery" },
          { name: "Dr. Yuki Tanaka", type: "supporting", gender: "female", description: "Biologist who finds evidence of human DNA in the ruins" }
        ]
      },
      {
        title: "Northern Lights",
        genre: "drama",
        synopsis: "An Inuit grandmother fights to save her village's traditional way of life as climate change and corporate interests threaten to destroy everything she knows.",
        logline: "An elder battles to preserve her Arctic community.",
        quality: 90,
        price: 480000,
        writerName: "Sedna Amarok",
        estimatedBudget: 18000000,
        targetAudience: "adults",
        roles: [
          { name: "Siku Amarok", type: "lead", gender: "female", description: "Inuit grandmother and village elder" },
          { name: "Thomas Amarok", type: "supporting", gender: "male", description: "Siku's grandson torn between tradition and modernity" },
          { name: "Victoria Sterling", type: "supporting", gender: "female", description: "Oil company executive pushing development" },
          { name: "David Qimmiq", type: "supporting", gender: "male", description: "Young activist helping Siku fight back" }
        ]
      },
      {
        title: "The Incredible Shrinking Dad",
        genre: "animation",
        synopsis: "When a workaholic father accidentally shrinks himself to three inches tall, he must navigate the house to reach his kids before the family cat finds him.",
        logline: "A tiny dad must survive his own house.",
        quality: 75,
        price: 580000,
        writerName: "Tim Tiny",
        estimatedBudget: 90000000,
        targetAudience: "family",
        roles: [
          { name: "Dad / Michael Patterson", type: "lead", gender: "male", description: "Workaholic father learning what really matters (voice)" },
          { name: "Emma Patterson", type: "supporting", gender: "female", description: "Michael's daughter who searches for her tiny dad (voice)" },
          { name: "Max Patterson", type: "supporting", gender: "male", description: "Michael's young son who thinks he imagined his tiny dad (voice)" },
          { name: "Whiskers", type: "supporting", gender: "male", description: "The family cat hunting the shrunken father (voice)" }
        ]
      },
      {
        title: "Harmony Hall",
        genre: "musical",
        synopsis: "A prestigious music conservatory is threatened with closure until students from the classical and hip-hop programs must combine forces for a genre-defying performance.",
        logline: "Classical and hip-hop students unite to save their school.",
        quality: 81,
        price: 820000,
        writerName: "Marcus Bach",
        estimatedBudget: 52000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Maya Chen", type: "lead", gender: "female", description: "Classical violin prodigy reluctant to collaborate" },
          { name: "DJ Marcus Cole", type: "lead", gender: "male", description: "Hip-hop producer who sees the potential in fusion" },
          { name: "Dean Patricia Stern", type: "supporting", gender: "female", description: "School administrator fighting to keep doors open" },
          { name: "Professor Bernard Hayes", type: "supporting", gender: "male", description: "Traditionalist music teacher opposed to the collaboration" }
        ]
      },
      {
        title: "The Collector",
        genre: "horror",
        synopsis: "A rare book dealer acquires a medieval grimoire that can summon anything drawn on its pages—but each summoning demands a terrible price.",
        logline: "A magical book grants wishes at a horrifying cost.",
        quality: 77,
        price: 490000,
        writerName: "Edgar Grimm",
        estimatedBudget: 42000000,
        targetAudience: "adults",
        roles: [
          { name: "Edward Blackwood", type: "lead", gender: "male", description: "Rare book dealer who discovers the grimoire's power" },
          { name: "Dr. Helena Cross", type: "supporting", gender: "female", description: "Medieval historian who knows the book's dark history" },
          { name: "The Scribe", type: "supporting", gender: "male", description: "Ancient entity bound to the grimoire" },
          { name: "Rachel Blackwood", type: "supporting", gender: "female", description: "Edward's wife caught in the book's curse" }
        ]
      },
      {
        title: "Undercover Granny",
        genre: "comedy",
        synopsis: "A retired MI6 agent comes out of retirement when she discovers her grandson has accidentally gotten involved with international arms dealers—and uses her knitting circle as her new spy network.",
        logline: "A spy grandmother takes down arms dealers.",
        quality: 73,
        price: 410000,
        writerName: "Dame Agatha Brown",
        estimatedBudget: 38000000,
        targetAudience: "general",
        roles: [
          { name: "Dame Edith Collins", type: "lead", gender: "female", description: "Retired MI6 agent with deadly knitting needles" },
          { name: "Tommy Collins", type: "supporting", gender: "male", description: "Edith's clueless grandson in over his head" },
          { name: "Dimitri Volkov", type: "supporting", gender: "male", description: "Russian arms dealer underestimating the elderly" },
          { name: "Agnes Pemberton", type: "supporting", gender: "female", description: "Edith's best friend and fellow former spy" }
        ]
      },
      {
        title: "Fractured",
        genre: "thriller",
        synopsis: "A woman wakes up in a hospital with no memory, only to discover she's suspected of a murder she can't remember committing—and all the evidence points to her.",
        logline: "An amnesiac must prove she's not a killer.",
        quality: 79,
        price: 580000,
        writerName: "Claire Memory",
        estimatedBudget: 45000000,
        targetAudience: "adults",
        roles: [
          { name: "Emma Collins", type: "lead", gender: "female", description: "Amnesiac woman accused of murder" },
          { name: "Detective Marcus Stone", type: "supporting", gender: "male", description: "Lead investigator convinced of Emma's guilt" },
          { name: "Dr. Sarah Hayes", type: "supporting", gender: "female", description: "Psychiatrist who believes Emma is innocent" },
          { name: "Michael Collins", type: "supporting", gender: "male", description: "Emma's husband hiding dark secrets" }
        ]
      },
      {
        title: "Riders of the Storm",
        genre: "action",
        synopsis: "Elite storm chasers discover a way to harness tornado energy, but a rival corporation will stop at nothing to steal their technology—including creating artificial superstorms.",
        logline: "Storm chasers battle corporate villains making fake tornadoes.",
        quality: 70,
        price: 650000,
        writerName: "Dusty Cyclone",
        estimatedBudget: 120000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Jake Rider", type: "lead", gender: "male", description: "Brilliant storm chaser who invented the technology" },
          { name: "Dr. Maya Storm", type: "supporting", gender: "female", description: "Meteorologist and Jake's partner" },
          { name: "Victor Crane", type: "supporting", gender: "male", description: "Ruthless CEO creating artificial storms" },
          { name: "Dusty Williams", type: "supporting", gender: "male", description: "Veteran storm chaser and team mentor" }
        ]
      },
      {
        title: "The Language of Flowers",
        genre: "romance",
        synopsis: "A flower shop owner communicates with a mute customer through the Victorian language of flowers, developing a romance expressed entirely through botanical arrangements.",
        logline: "Love blooms through the secret meaning of flowers.",
        quality: 86,
        price: 380000,
        writerName: "Lily Rose",
        estimatedBudget: 22000000,
        targetAudience: "adults",
        roles: [
          { name: "Rose Bennett", type: "lead", gender: "female", description: "Flower shop owner who speaks the language of flowers" },
          { name: "Daniel Foster", type: "lead", gender: "male", description: "Mute artist who communicates through bouquets" },
          { name: "Helen Bennett", type: "supporting", gender: "female", description: "Rose's grandmother who taught her the floral language" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "Rose's ex-fiancé who wants her back" }
        ]
      },
      {
        title: "Citadel",
        genre: "fantasy",
        synopsis: "A street urchin discovers she can see the hidden magic holding together an ancient floating city—and that the magic is failing, threatening to drop the city from the sky.",
        logline: "An orphan must save a magical floating city from falling.",
        quality: 83,
        price: 1050000,
        writerName: "Skylar Heights",
        estimatedBudget: 175000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Aria Skyborn", type: "lead", gender: "female", description: "Street urchin who can see the city's magic" },
          { name: "Magister Thorne", type: "supporting", gender: "male", description: "Ancient wizard hiding the truth about the city" },
          { name: "Prince Caelum", type: "supporting", gender: "male", description: "Royal heir who befriends Aria" },
          { name: "Lady Vex", type: "supporting", gender: "female", description: "Scheming noble sabotaging the city's magic" }
        ]
      },
      {
        title: "The Trial of Dr. Prometheus",
        genre: "sci-fi",
        synopsis: "The scientist who created the cure for death faces trial when society begins to collapse under the weight of immortality, and he's the only one who can reverse it.",
        logline: "The creator of immortality must undo his invention.",
        quality: 89,
        price: 1200000,
        writerName: "Dr. Faust Modern",
        estimatedBudget: 95000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Victor Prometheus", type: "lead", gender: "male", description: "Brilliant scientist who cured death" },
          { name: "Judge Helena Winters", type: "supporting", gender: "female", description: "Prosecutor seeking to hold Prometheus accountable" },
          { name: "Dr. Maya Chen", type: "supporting", gender: "female", description: "Prometheus's former colleague defending him" },
          { name: "Senator Marcus Cole", type: "supporting", gender: "male", description: "Politician leading the anti-immortality movement" }
        ]
      },
      {
        title: "Concrete Jungle",
        genre: "action",
        synopsis: "A parkour master becomes an unlikely hero when he's the only one who can navigate the city's rooftops fast enough to stop a terrorist attack.",
        logline: "A parkour expert races across rooftops to stop terrorists.",
        quality: 68,
        price: 480000,
        writerName: "Felix Runner",
        estimatedBudget: 65000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Felix Chen", type: "lead", gender: "male", description: "World-class parkour athlete turned reluctant hero" },
          { name: "Agent Sarah Blake", type: "supporting", gender: "female", description: "FBI agent coordinating with Felix" },
          { name: "Kazim Volkov", type: "supporting", gender: "male", description: "Terrorist mastermind with a personal vendetta" },
          { name: "Marco Santos", type: "supporting", gender: "male", description: "Felix's parkour rival who joins the mission" }
        ]
      },
      {
        title: "The Dinner Party",
        genre: "thriller",
        synopsis: "Eight strangers receive invitations to a mysterious billionaire's dinner party, only to discover they've each wronged the host—and now they're locked inside until justice is served.",
        logline: "Dinner guests discover they're trapped with their victim.",
        quality: 82,
        price: 520000,
        writerName: "Agatha Christie-Stone",
        estimatedBudget: 35000000,
        targetAudience: "adults",
        roles: [
          { name: "Victoria Sterling", type: "lead", gender: "female", description: "CEO among the trapped guests hiding the biggest secret" },
          { name: "The Host", type: "supporting", gender: "male", description: "Mysterious billionaire orchestrating the evening" },
          { name: "Dr. James Whitmore", type: "supporting", gender: "male", description: "Surgeon whose malpractice connects to the host" },
          { name: "Detective Maria Santos", type: "supporting", gender: "female", description: "Off-duty cop who becomes the voice of reason" }
        ]
      },
      {
        title: "Starfall Academy",
        genre: "animation",
        synopsis: "At a school for young superheroes, a student with seemingly useless powers must prove that being able to talk to pigeons might just save the world.",
        logline: "A pigeon-talking hero proves his worth.",
        quality: 76,
        price: 720000,
        writerName: "Stan Marvel",
        estimatedBudget: 110000000,
        targetAudience: "family",
        roles: [
          { name: "Tim / Pigeon Boy", type: "lead", gender: "male", description: "Bullied student with the power to talk to pigeons (voice)" },
          { name: "Blaze", type: "supporting", gender: "female", description: "Popular fire-powered student who befriends Tim (voice)" },
          { name: "Principal Cosmos", type: "supporting", gender: "male", description: "Wise headmaster who sees Tim's potential (voice)" },
          { name: "Shadow King", type: "supporting", gender: "male", description: "Villain whose weakness only pigeons can exploit (voice)" }
        ]
      },
      {
        title: "The Weight of Water",
        genre: "drama",
        synopsis: "An Olympic diver haunted by a near-drowning incident must overcome her trauma to compete one last time, while caring for her aging mother who's losing her memory.",
        logline: "A traumatized diver makes one last Olympic bid.",
        quality: 84,
        price: 440000,
        writerName: "Grace Splash",
        estimatedBudget: 28000000,
        targetAudience: "adults",
        roles: [
          { name: "Grace Chen", type: "lead", gender: "female", description: "Olympic diver haunted by near-drowning trauma" },
          { name: "Helen Chen", type: "supporting", gender: "female", description: "Grace's mother with advancing dementia" },
          { name: "Coach Marcus Webb", type: "supporting", gender: "male", description: "Demanding coach pushing Grace to compete" },
          { name: "Dr. Sarah Lin", type: "supporting", gender: "female", description: "Sports psychologist helping Grace face her fears" }
        ]
      },
      {
        title: "The Echo Chamber",
        genre: "horror",
        synopsis: "Residents of a smart home community start dying in ways their AI assistants predicted, leading investigators to question whether the technology is warning them or killing them.",
        logline: "Smart home AIs predict—or cause—their owners' deaths.",
        quality: 78,
        price: 560000,
        writerName: "Alex Algorithm",
        estimatedBudget: 48000000,
        targetAudience: "adults",
        roles: [
          { name: "Detective Sarah Chen", type: "lead", gender: "female", description: "Tech-savvy detective investigating the deaths" },
          { name: "ECHO", type: "supporting", gender: "unknown", description: "The AI system with mysterious motives (voice)" },
          { name: "Dr. Marcus Webb", type: "supporting", gender: "male", description: "AI developer who created the system" },
          { name: "Rebecca Torres", type: "supporting", gender: "female", description: "Survivor whose AI keeps warning her" }
        ]
      },
      {
        title: "The Last Dance of Marie Antoinette",
        genre: "musical",
        synopsis: "A modern retelling of Marie Antoinette's final days, told through the eyes of her servant, blending historical drama with contemporary pop music.",
        logline: "Marie Antoinette's story through her servant's eyes.",
        quality: 85,
        price: 1100000,
        writerName: "Jean-Pierre Melodie",
        estimatedBudget: 75000000,
        targetAudience: "adults",
        roles: [
          { name: "Marie Antoinette", type: "lead", gender: "female", description: "Doomed queen facing her final days" },
          { name: "Colette Dubois", type: "lead", gender: "female", description: "Servant narrator witnessing history unfold" },
          { name: "King Louis XVI", type: "supporting", gender: "male", description: "Marie's husband accepting his fate" },
          { name: "Robespierre", type: "supporting", gender: "male", description: "Revolutionary leader sealing the queen's fate" }
        ]
      },
      {
        title: "Pixel Perfect",
        genre: "comedy",
        synopsis: "When a video game designer gets trapped in her own retro-style game, she must beat the unbeatable final boss she created—a boss no one, including her, has ever defeated.",
        logline: "A designer must beat her own impossible game.",
        quality: 77,
        price: 520000,
        writerName: "Arcade Ace",
        estimatedBudget: 65000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Maya Chen", type: "lead", gender: "female", description: "Video game designer trapped in her own creation" },
          { name: "The Final Boss", type: "supporting", gender: "male", description: "Unbeatable villain who develops sentience" },
          { name: "Pixel", type: "supporting", gender: "female", description: "Helpful NPC guide who becomes Maya's friend" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "Maya's co-worker trying to rescue her from outside" }
        ]
      },
      {
        title: "Letters from the Front",
        genre: "drama",
        synopsis: "The love letters between a soldier and a nurse during World War I reveal secrets that their grandchildren must now uncover, changing their understanding of their family history.",
        logline: "War letters reveal family secrets across generations.",
        quality: 87,
        price: 580000,
        writerName: "Helena Pen",
        estimatedBudget: 45000000,
        targetAudience: "adults",
        roles: [
          { name: "Sarah Mitchell", type: "lead", gender: "female", description: "Granddaughter discovering her family's hidden past" },
          { name: "Private Thomas Mitchell", type: "lead", gender: "male", description: "WWI soldier in flashback sequences" },
          { name: "Nurse Elizabeth Porter", type: "supporting", gender: "female", description: "Young nurse who fell in love during the war" },
          { name: "David Mitchell", type: "supporting", gender: "male", description: "Sarah's father who kept the secret all his life" }
        ]
      },
      {
        title: "Bloodlines",
        genre: "horror",
        synopsis: "A genealogist discovers her clients keep dying after she traces their ancestry to a cursed village in Romania, and now she's inadvertently traced her own family to the same place.",
        logline: "A genealogist traces her ancestry to a cursed village.",
        quality: 72,
        price: 430000,
        writerName: "Vlad Ancestry",
        estimatedBudget: 32000000,
        targetAudience: "adults",
        roles: [
          { name: "Anna Petrov", type: "lead", gender: "female", description: "Genealogist who discovers the deadly pattern" },
          { name: "Count Vasile", type: "supporting", gender: "male", description: "Ancient vampire tied to the cursed bloodline" },
          { name: "Dr. Marcus Webb", type: "supporting", gender: "male", description: "Historian who knows the village's dark history" },
          { name: "Elena Petrov", type: "supporting", gender: "female", description: "Anna's grandmother hiding family secrets" }
        ]
      },
      {
        title: "Operation Desert Storm",
        genre: "action",
        synopsis: "A team of female soldiers goes undercover to rescue a captured diplomat from a heavily fortified enemy compound in the Middle East.",
        logline: "An all-female unit rescues a diplomat behind enemy lines.",
        quality: 75,
        price: 780000,
        writerName: "Sergeant Jane Steel",
        estimatedBudget: 105000000,
        targetAudience: "adults",
        roles: [
          { name: "Captain Maya Rodriguez", type: "lead", gender: "female", description: "Leader of the elite all-female rescue team" },
          { name: "Ambassador James Chen", type: "supporting", gender: "male", description: "Captured diplomat they must rescue" },
          { name: "Lieutenant Sarah Stone", type: "supporting", gender: "female", description: "Team's explosives expert and second-in-command" },
          { name: "General Khalid Hassan", type: "supporting", gender: "male", description: "Enemy commander holding the ambassador" }
        ]
      },
      {
        title: "The Quantum Detective",
        genre: "sci-fi",
        synopsis: "A private eye who can see possible futures must solve a murder before it happens, but every action he takes creates new timelines and new possible victims.",
        logline: "A detective who sees the future tries to prevent murder.",
        quality: 81,
        price: 950000,
        writerName: "Philip K. Shadow",
        estimatedBudget: 85000000,
        targetAudience: "adults",
        roles: [
          { name: "Jack Paradox", type: "lead", gender: "male", description: "Private eye cursed with seeing all possible futures" },
          { name: "Dr. Sarah Chen", type: "supporting", gender: "female", description: "Scientist who understands Jack's ability" },
          { name: "The Inevitable", type: "supporting", gender: "male", description: "Killer who exists in all timelines" },
          { name: "Detective Maria Santos", type: "supporting", gender: "female", description: "Cop who doesn't believe Jack's visions" }
        ]
      },
      {
        title: "Hearts on Ice",
        genre: "romance",
        synopsis: "Two rival figure skaters are forced to compete as pairs partners, going from hatred to love while preparing for the Olympics.",
        logline: "Rival skaters become partners and fall in love.",
        quality: 71,
        price: 340000,
        writerName: "Crystal Blade",
        estimatedBudget: 42000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Natasha Volkov", type: "lead", gender: "female", description: "Russian figure skating champion forced to pair up" },
          { name: "Jake Morrison", type: "lead", gender: "male", description: "American skater who becomes Natasha's partner" },
          { name: "Coach Viktor", type: "supporting", gender: "male", description: "Demanding coach pushing them to Olympic gold" },
          { name: "Sofia Chen", type: "supporting", gender: "female", description: "Natasha's former partner now a bitter rival" }
        ]
      },
      {
        title: "The Ember Kingdom",
        genre: "fantasy",
        synopsis: "A fire mage born into a family of ice wielders must choose sides when war erupts between the elemental kingdoms—and discovers she may be the key to ending the conflict forever.",
        logline: "A fire mage must end the war between elemental kingdoms.",
        quality: 82,
        price: 1150000,
        writerName: "Blaze Frost",
        estimatedBudget: 185000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Princess Ember", type: "lead", gender: "female", description: "Fire mage born to the ice kingdom's royal family" },
          { name: "Prince Frost", type: "supporting", gender: "male", description: "Ember's ice-wielding brother torn by loyalty" },
          { name: "King Blaze", type: "supporting", gender: "male", description: "Ruthless leader of the fire kingdom" },
          { name: "Queen Glaceia", type: "supporting", gender: "female", description: "Ember's mother hiding the truth of her birth" }
        ]
      },
      {
        title: "The Understudies",
        genre: "comedy",
        synopsis: "When the entire main cast of a Broadway show gets food poisoning, the understudies must perform on opening night with only three hours of preparation—and a personal vendetta between two of them.",
        logline: "Unprepared understudies must save opening night.",
        quality: 80,
        price: 380000,
        writerName: "Broadway Bobby",
        estimatedBudget: 32000000,
        targetAudience: "general",
        roles: [
          { name: "Jenny Mitchell", type: "lead", gender: "female", description: "Understudy with talent but no confidence" },
          { name: "Marcus Cole", type: "lead", gender: "male", description: "Cocky understudy with a grudge against Jenny" },
          { name: "Gloria Stern", type: "supporting", gender: "female", description: "Veteran stage manager keeping everyone calm" },
          { name: "Reginald Pierce", type: "supporting", gender: "male", description: "Demanding director watching from the wings" }
        ]
      },
      {
        title: "Buried Secrets",
        genre: "thriller",
        synopsis: "An archaeologist unearths a mass grave that leads her to discover a conspiracy involving her own grandfather, forcing her to choose between her family's reputation and the truth.",
        logline: "An archaeologist finds her grandfather's dark secret.",
        quality: 83,
        price: 640000,
        writerName: "Dr. Indiana Spade",
        estimatedBudget: 55000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Sarah Blackwood", type: "lead", gender: "female", description: "Archaeologist uncovering her family's dark past" },
          { name: "General Thomas Blackwood", type: "supporting", gender: "male", description: "Sarah's grandfather in flashbacks hiding war crimes" },
          { name: "Agent Marcus Cole", type: "supporting", gender: "male", description: "Government agent trying to suppress the discovery" },
          { name: "Dr. Elena Vasquez", type: "supporting", gender: "female", description: "Sarah's mentor who helps expose the truth" }
        ]
      },
      {
        title: "The Lighthouse",
        genre: "horror",
        synopsis: "The new keeper of a remote lighthouse discovers journals from his predecessors describing impossible events—events that are now beginning to repeat.",
        logline: "A lighthouse keeper relives his predecessors' nightmare.",
        quality: 79,
        price: 350000,
        writerName: "Edmund Poe",
        estimatedBudget: 25000000,
        targetAudience: "adults",
        roles: [
          { name: "Thomas Wake", type: "lead", gender: "male", description: "New lighthouse keeper discovering the horror" },
          { name: "The Entity", type: "supporting", gender: "unknown", description: "Malevolent presence bound to the lighthouse" },
          { name: "Edward Pierce", type: "supporting", gender: "male", description: "Previous keeper appearing in visions and journals" },
          { name: "Mary Wake", type: "supporting", gender: "female", description: "Thomas's wife trying to reach him from the mainland" }
        ]
      },
      {
        title: "Rocket Racers",
        genre: "animation",
        synopsis: "In a future where racing happens in space, a young pilot and her robot co-pilot must win the Galactic Grand Prix to save her family's racing team from alien corporate takeover.",
        logline: "A space racer fights to save her family's team.",
        quality: 74,
        price: 680000,
        writerName: "Zoom Stardust",
        estimatedBudget: 120000000,
        targetAudience: "family",
        roles: [
          { name: "Nova Starlight", type: "lead", gender: "female", description: "Young space racer fighting for her family (voice)" },
          { name: "BOLT", type: "supporting", gender: "male", description: "Nova's loyal robot co-pilot (voice)" },
          { name: "Zax Nebula", type: "supporting", gender: "male", description: "Ruthless alien champion and rival racer (voice)" },
          { name: "Captain Dad Starlight", type: "supporting", gender: "male", description: "Nova's injured father and former champion (voice)" }
        ]
      },
      {
        title: "The Professor's Last Equation",
        genre: "drama",
        synopsis: "A brilliant mathematician dying of cancer races to complete his life's work—a proof that could revolutionize physics—while reconciling with the son he abandoned for his research.",
        logline: "A dying mathematician seeks truth and redemption.",
        quality: 92,
        price: 650000,
        writerName: "Dr. Albert Noble",
        estimatedBudget: 20000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. David Euler", type: "lead", gender: "male", description: "Dying mathematician racing against time" },
          { name: "Michael Euler", type: "supporting", gender: "male", description: "David's estranged son confronting their past" },
          { name: "Dr. Sarah Chen", type: "supporting", gender: "female", description: "David's protégé helping complete his work" },
          { name: "Margaret Euler", type: "supporting", gender: "female", description: "David's ex-wife mediating the reconciliation" }
        ]
      },
      {
        title: "Street Symphony",
        genre: "musical",
        synopsis: "A homeless violinist and a subway busker create viral music videos together, climbing to fame while trying to keep their love from being destroyed by the industry.",
        logline: "Street musicians find love and fame on social media.",
        quality: 78,
        price: 580000,
        writerName: "Melody Street",
        estimatedBudget: 45000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Alex Chen", type: "lead", gender: "male", description: "Homeless violinist with classical training" },
          { name: "Melody Torres", type: "lead", gender: "female", description: "Subway busker with a powerful voice" },
          { name: "Rick Stone", type: "supporting", gender: "male", description: "Record producer trying to separate them" },
          { name: "Grandma Rosa", type: "supporting", gender: "female", description: "Melody's grandmother who supports their dream" }
        ]
      },
      {
        title: "The Ambassador's Daughter",
        genre: "thriller",
        synopsis: "When her father is kidnapped during a diplomatic mission, a diplomat's daughter uses her insider knowledge of international politics to orchestrate his rescue.",
        logline: "A diplomat's daughter rescues her kidnapped father.",
        quality: 76,
        price: 620000,
        writerName: "Sophia Diplomat",
        estimatedBudget: 65000000,
        targetAudience: "adults",
        roles: [
          { name: "Alexandra Sterling", type: "lead", gender: "female", description: "Diplomat's daughter with political insider knowledge" },
          { name: "Ambassador Richard Sterling", type: "supporting", gender: "male", description: "Alexandra's kidnapped father" },
          { name: "Viktor Kozlov", type: "supporting", gender: "male", description: "Mastermind behind the kidnapping" },
          { name: "Agent Claire Mason", type: "supporting", gender: "female", description: "CIA operative who becomes Alexandra's ally" }
        ]
      },
      {
        title: "Titanfall",
        genre: "action",
        synopsis: "When ancient giant robots are discovered beneath major world cities, a diverse team of pilots must learn to control them before a hostile alien force awakens their own.",
        logline: "Pilots race to master ancient robots before aliens do.",
        quality: 74,
        price: 890000,
        writerName: "Mecha Prime",
        estimatedBudget: 195000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Captain Jake Torres", type: "lead", gender: "male", description: "Former soldier who bonds with the lead Titan" },
          { name: "Dr. Maya Chen", type: "supporting", gender: "female", description: "Scientist who discovers how to activate the Titans" },
          { name: "Overlord Prime", type: "supporting", gender: "male", description: "Leader of the hostile alien invasion force" },
          { name: "Lieutenant Sarah Stone", type: "supporting", gender: "female", description: "Jake's co-pilot and tactical expert" }
        ]
      },
      {
        title: "The Beekeeper's Daughter",
        genre: "drama",
        synopsis: "A young woman returns to her family's failing honey farm after her mother's death, discovering that saving the bees might also heal her broken relationship with her father.",
        logline: "A daughter heals her family by saving their bee farm.",
        quality: 81,
        price: 320000,
        writerName: "Maya Honeycomb",
        estimatedBudget: 18000000,
        targetAudience: "adults",
        roles: [
          { name: "Emma Winters", type: "lead", gender: "female", description: "Daughter returning to save the family farm" },
          { name: "Robert Winters", type: "supporting", gender: "male", description: "Emma's estranged father still grieving his wife" },
          { name: "Dr. Sarah Chen", type: "supporting", gender: "female", description: "Bee researcher who helps Emma save the hives" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "Developer trying to buy the struggling farm" }
        ]
      },
      {
        title: "Carnival of Shadows",
        genre: "horror",
        synopsis: "A traveling carnival arrives in a small town, and children start disappearing. The sheriff discovers the carnival has been visiting for over a century—always with the same performers.",
        logline: "An immortal carnival feeds on children's souls.",
        quality: 75,
        price: 480000,
        writerName: "Barnaby Dark",
        estimatedBudget: 40000000,
        targetAudience: "adults",
        roles: [
          { name: "Sheriff Marcus Cole", type: "lead", gender: "male", description: "Small-town sheriff investigating the disappearances" },
          { name: "The Ringmaster", type: "supporting", gender: "male", description: "Immortal leader of the cursed carnival" },
          { name: "Lily Cole", type: "supporting", gender: "female", description: "Sheriff's daughter drawn to the carnival's magic" },
          { name: "Madame Vesper", type: "supporting", gender: "female", description: "Fortune teller who knows the carnival's dark secrets" }
        ]
      },
      {
        title: "Mafia Princess",
        genre: "comedy",
        synopsis: "A sheltered mafia boss's daughter accidentally exposes her family's criminal empire while trying to become an Instagram influencer, and must fix everything before her father finds out.",
        logline: "A mob daughter accidentally exposes her family online.",
        quality: 72,
        price: 390000,
        writerName: "Tony Laughs",
        estimatedBudget: 35000000,
        targetAudience: "adults",
        roles: [
          { name: "Sofia Gambino", type: "lead", gender: "female", description: "Naive mob princess seeking Instagram fame" },
          { name: "Don Vito Gambino", type: "supporting", gender: "male", description: "Sofia's terrifying father and crime boss" },
          { name: "Marco", type: "supporting", gender: "male", description: "Sofia's bodyguard forced to help her cover-up" },
          { name: "Agent Linda Chen", type: "supporting", gender: "female", description: "FBI agent who discovers Sofia's posts" }
        ]
      },
      {
        title: "Across the Universe",
        genre: "romance",
        synopsis: "Two astronauts on a decade-long mission to a distant star system fall in love, knowing that when they return to Earth, everyone they knew will be long dead.",
        logline: "Astronauts fall in love knowing they'll outlive everyone.",
        quality: 88,
        price: 1050000,
        writerName: "Stella Lovecraft",
        estimatedBudget: 130000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Maya Chen", type: "lead", gender: "female", description: "Mission biologist finding love in space" },
          { name: "Captain James Webb", type: "lead", gender: "male", description: "Ship commander who falls for Maya" },
          { name: "ARIA", type: "supporting", gender: "female", description: "Ship's AI who observes their relationship" },
          { name: "Sarah Chen", type: "supporting", gender: "female", description: "Maya's daughter aging on Earth (in communications)" }
        ]
      },
      {
        title: "The Dragon's Apprentice",
        genre: "fantasy",
        synopsis: "A young stable boy becomes the unlikely apprentice to the last dragon, learning that humans and dragons once lived in harmony—and must again to survive a coming catastrophe.",
        logline: "A stable boy learns the truth about dragons.",
        quality: 79,
        price: 980000,
        writerName: "Draco Flameheart",
        estimatedBudget: 155000000,
        targetAudience: "family",
        roles: [
          { name: "Tom Stablehand", type: "lead", gender: "male", description: "Humble stable boy chosen by the dragon" },
          { name: "Pyralis", type: "lead", gender: "male", description: "The last ancient dragon seeking an apprentice" },
          { name: "King Aldric", type: "supporting", gender: "male", description: "Ruler who once banished dragons from the realm" },
          { name: "Princess Elena", type: "supporting", gender: "female", description: "King's daughter who befriends Tom" }
        ]
      },
      {
        title: "Deep Blue",
        genre: "sci-fi",
        synopsis: "Scientists at an underwater research station discover an ancient civilization at the bottom of the Mariana Trench—one that predates all known human history and is very much alive.",
        logline: "Scientists find a living ancient civilization underwater.",
        quality: 84,
        price: 1350000,
        writerName: "Dr. Jacques Deep",
        estimatedBudget: 165000000,
        targetAudience: "general",
        roles: [
          { name: "Dr. Maya Torres", type: "lead", gender: "female", description: "Marine biologist leading the expedition" },
          { name: "Elder Thalassa", type: "supporting", gender: "female", description: "Leader of the ancient underwater civilization" },
          { name: "Captain Marcus Webb", type: "supporting", gender: "male", description: "Submarine commander protecting the team" },
          { name: "Dr. Chen Wei", type: "supporting", gender: "male", description: "Linguist who deciphers the ancient language" }
        ]
      },
      {
        title: "The Wedding Crasher",
        genre: "comedy",
        synopsis: "A professional wedding planner's perfect life unravels when her ex-fiancé shows up at every wedding she plans—because his new girlfriend is the industry's hottest photographer.",
        logline: "A wedding planner can't escape her ex at work.",
        quality: 70,
        price: 310000,
        writerName: "Penny Chapel",
        estimatedBudget: 28000000,
        targetAudience: "adults",
        roles: [
          { name: "Claire Mitchell", type: "lead", gender: "female", description: "Wedding planner haunted by her ex" },
          { name: "Jake Morrison", type: "supporting", gender: "male", description: "Claire's ex-fiancé appearing at every event" },
          { name: "Vanessa Stone", type: "supporting", gender: "female", description: "Jake's photographer girlfriend and Claire's rival" },
          { name: "Marcus Chen", type: "supporting", gender: "male", description: "New love interest who sees Claire's true worth" }
        ]
      },
      {
        title: "The Forgotten Battalion",
        genre: "action",
        synopsis: "Based on true events: A group of soldiers trapped behind enemy lines during World War II must survive for months with no supplies while finding a way back to allied territory.",
        logline: "Soldiers survive months behind enemy lines in WWII.",
        quality: 83,
        price: 920000,
        writerName: "Colonel Marcus History",
        estimatedBudget: 95000000,
        targetAudience: "adults",
        roles: [
          { name: "Sergeant James Murphy", type: "lead", gender: "male", description: "Natural leader holding the group together" },
          { name: "Private Tommy Chen", type: "supporting", gender: "male", description: "Young medic keeping the wounded alive" },
          { name: "Corporal Maria Santos", type: "supporting", gender: "female", description: "Resistance fighter who guides them home" },
          { name: "Colonel Wilhelm Richter", type: "supporting", gender: "male", description: "German officer hunting the lost battalion" }
        ]
      },
      {
        title: "Neon Nights",
        genre: "thriller",
        synopsis: "A night-shift taxi driver becomes entangled in a conspiracy when one of her passengers leaves behind a briefcase full of cash—and a target on her back.",
        logline: "A taxi driver finds cash and becomes a target.",
        quality: 77,
        price: 450000,
        writerName: "Niko Midnight",
        estimatedBudget: 42000000,
        targetAudience: "adults",
        roles: [
          { name: "Nina Rodriguez", type: "lead", gender: "female", description: "Night-shift taxi driver caught in a conspiracy" },
          { name: "Viktor Sokolov", type: "supporting", gender: "male", description: "Russian mobster hunting for his stolen money" },
          { name: "Detective James Chen", type: "supporting", gender: "male", description: "Cop investigating the trail of bodies" },
          { name: "Lily Kim", type: "supporting", gender: "female", description: "Nina's sister who gets caught in the crossfire" }
        ]
      },
      {
        title: "Spirit Animal",
        genre: "animation",
        synopsis: "A girl who can see people's spirit animals must help a boy whose spirit animal is dying, discovering that saving it means confronting the trauma that's killing it.",
        logline: "A girl must save a boy's dying spirit animal.",
        quality: 86,
        price: 780000,
        writerName: "Luna Spirit",
        estimatedBudget: 105000000,
        targetAudience: "family",
        roles: [
          { name: "Lily Chen", type: "lead", gender: "female", description: "Girl with the gift to see spirit animals (voice)" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "Troubled boy with a dying spirit wolf (voice)" },
          { name: "Echo", type: "supporting", gender: "female", description: "Lily's wise spirit owl guide (voice)" },
          { name: "The Shadow", type: "supporting", gender: "male", description: "Manifestation of Marcus's trauma (voice)" }
        ]
      },
      {
        title: "The Conductor",
        genre: "drama",
        synopsis: "A legendary orchestra conductor with hearing loss must train his replacement while hiding his disability, coming to terms with the silence that will eventually consume his world.",
        logline: "A deaf conductor hides his condition while training a replacement.",
        quality: 90,
        price: 540000,
        writerName: "Ludwig Silence",
        estimatedBudget: 28000000,
        targetAudience: "adults",
        roles: [
          { name: "Maestro Henri Laurent", type: "lead", gender: "male", description: "Legendary conductor losing his hearing" },
          { name: "Elena Chen", type: "supporting", gender: "female", description: "Talented young conductor being trained as replacement" },
          { name: "Dr. Sarah Webb", type: "supporting", gender: "female", description: "Audiologist who knows Henri's secret" },
          { name: "Marcus Laurent", type: "supporting", gender: "male", description: "Henri's son who discovers the truth" }
        ]
      },
      {
        title: "Phantom Frequency",
        genre: "horror",
        synopsis: "A radio DJ broadcasting alone at night starts receiving calls from listeners who died years ago—and they're warning him about something coming through the signal.",
        logline: "A DJ receives calls from dead listeners.",
        quality: 73,
        price: 380000,
        writerName: "Static Voice",
        estimatedBudget: 22000000,
        targetAudience: "adults",
        roles: [
          { name: "Jack Midnight", type: "lead", gender: "male", description: "Late-night radio DJ receiving ghostly calls" },
          { name: "The Voice", type: "supporting", gender: "unknown", description: "Malevolent entity coming through the signal" },
          { name: "Sarah Chen", type: "supporting", gender: "female", description: "Jack's producer investigating the phenomenon" },
          { name: "Detective Marcus Stone", type: "supporting", gender: "male", description: "Cop linking the calls to cold cases" }
        ]
      },
      {
        title: "Love & Basketball",
        genre: "romance",
        synopsis: "Two professional basketball players from rival teams fall in love, but their relationship threatens to derail both their careers during championship season.",
        logline: "Rival players fall in love during playoffs.",
        quality: 74,
        price: 420000,
        writerName: "Jordan Court",
        estimatedBudget: 45000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Marcus Cole", type: "lead", gender: "male", description: "All-star point guard for the home team" },
          { name: "Jasmine Chen", type: "lead", gender: "female", description: "Star forward for the rival team" },
          { name: "Coach Williams", type: "supporting", gender: "male", description: "Marcus's demanding coach threatening to bench him" },
          { name: "Tina Cole", type: "supporting", gender: "female", description: "Marcus's sister warning him about the relationship" }
        ]
      },
      {
        title: "The Alchemist's Daughter",
        genre: "fantasy",
        synopsis: "In a steampunk Victorian London, a young alchemist's apprentice discovers her father's secret formula can bring the dead back to life—but at a terrible cost.",
        logline: "An alchemist's daughter discovers her father's dark secret.",
        quality: 81,
        price: 1020000,
        writerName: "Victoria Brass",
        estimatedBudget: 140000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Adelaide Mercer", type: "lead", gender: "female", description: "Alchemist's daughter uncovering dark secrets" },
          { name: "Dr. Edward Mercer", type: "supporting", gender: "male", description: "Adelaide's father hiding the resurrection formula" },
          { name: "Inspector Thomas Webb", type: "supporting", gender: "male", description: "Detective investigating mysterious resurrections" },
          { name: "Lady Blackwood", type: "supporting", gender: "female", description: "Wealthy patron seeking the formula for her son" }
        ]
      },
      {
        title: "Cyberheist",
        genre: "action",
        synopsis: "A team of hackers must break into the world's most secure server to expose a global surveillance program, but one of them is secretly working for the people they're trying to expose.",
        logline: "Hackers plan a heist while a traitor lurks within.",
        quality: 76,
        price: 680000,
        writerName: "Zero Cool",
        estimatedBudget: 75000000,
        targetAudience: "adults",
        roles: [
          { name: "Zero / Alex Chen", type: "lead", gender: "male", description: "Elite hacker leading the team" },
          { name: "Ghost / Sarah Webb", type: "supporting", gender: "female", description: "Social engineer and the hidden mole" },
          { name: "Director Marcus Stone", type: "supporting", gender: "male", description: "Head of the surveillance program" },
          { name: "Cipher / Tommy Kim", type: "supporting", gender: "male", description: "Young prodigy who discovers the betrayal" }
        ]
      },
      {
        title: "The Last Librarian",
        genre: "sci-fi",
        synopsis: "In a future where books are banned, the last librarian protects a hidden archive and must decide whether to share forbidden knowledge with a revolutionary movement.",
        logline: "The last librarian guards banned books in a dystopia.",
        quality: 85,
        price: 720000,
        writerName: "Ray Bradberry",
        estimatedBudget: 65000000,
        targetAudience: "adults",
        roles: [
          { name: "Eleanor Page", type: "lead", gender: "female", description: "The last librarian protecting forbidden knowledge" },
          { name: "Captain Marcus Burns", type: "supporting", gender: "male", description: "Book-burning enforcer with doubts" },
          { name: "Rebel Leader Kai", type: "supporting", gender: "male", description: "Revolutionary seeking the archive's secrets" },
          { name: "Director Helena Void", type: "supporting", gender: "female", description: "Government official hunting the librarian" }
        ]
      },
      {
        title: "Miracle on 34th Street (Remake)",
        genre: "comedy",
        synopsis: "A department store Santa claims to be the real thing, and a cynical lawyer must decide whether to prove him crazy or accept that some magic might be real.",
        logline: "A lawyer must decide if Santa Claus is real.",
        quality: 75,
        price: 550000,
        writerName: "Holly Berry",
        estimatedBudget: 50000000,
        targetAudience: "family",
        roles: [
          { name: "Kris Kringle", type: "lead", gender: "male", description: "Department store Santa who claims to be real" },
          { name: "Sarah Mitchell", type: "lead", gender: "female", description: "Cynical lawyer defending Kris in court" },
          { name: "Lucy Mitchell", type: "supporting", gender: "female", description: "Sarah's daughter who believes in Santa" },
          { name: "Judge Henry Stone", type: "supporting", gender: "male", description: "Skeptical judge presiding over the case" }
        ]
      },
      {
        title: "The Vengeance Code",
        genre: "thriller",
        synopsis: "A retired codebreaker discovers her late husband was murdered when she finds a hidden message in his final crossword puzzle, leading her into a deadly game of espionage.",
        logline: "A widow decodes her murdered husband's last message.",
        quality: 80,
        price: 580000,
        writerName: "Ada Cipher",
        estimatedBudget: 48000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Elizabeth Webb", type: "lead", gender: "female", description: "Retired codebreaker decoding her husband's murder" },
          { name: "James Webb", type: "supporting", gender: "male", description: "Elizabeth's murdered husband in flashbacks" },
          { name: "Agent Viktor Petrov", type: "supporting", gender: "male", description: "Russian spy tied to James's death" },
          { name: "Director Sarah Chen", type: "supporting", gender: "female", description: "CIA director hiding dark secrets" }
        ]
      },
      {
        title: "Legends of the Ring",
        genre: "action",
        synopsis: "An aging boxing champion gets one last shot at the title, but must first overcome the trauma of the fight that killed his brother twenty years ago.",
        logline: "An aging boxer confronts his traumatic past.",
        quality: 82,
        price: 620000,
        writerName: "Rocky Mountain",
        estimatedBudget: 55000000,
        targetAudience: "adults",
        roles: [
          { name: "Jake 'The Thunder' Morales", type: "lead", gender: "male", description: "Aging champion seeking redemption" },
          { name: "Tommy Morales", type: "supporting", gender: "male", description: "Jake's brother who died in the ring (flashbacks)" },
          { name: "Maria Morales", type: "supporting", gender: "female", description: "Jake's niece training to follow in his footsteps" },
          { name: "Marcus 'The Destroyer' Cole", type: "supporting", gender: "male", description: "Undefeated young champion Jake must face" }
        ]
      },
      {
        title: "Invisible",
        genre: "drama",
        synopsis: "A teenage girl with severe social anxiety develops the ability to turn invisible, but discovers that being unseen doesn't solve her problems—it creates new ones.",
        logline: "An invisible girl learns visibility isn't her problem.",
        quality: 84,
        price: 480000,
        writerName: "Vanessa Clear",
        estimatedBudget: 35000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Lily Parker", type: "lead", gender: "female", description: "Anxious teen who develops invisibility" },
          { name: "Dr. Sarah Webb", type: "supporting", gender: "female", description: "Therapist helping Lily with her anxiety" },
          { name: "Jake Morrison", type: "supporting", gender: "male", description: "Popular boy who notices Lily despite her powers" },
          { name: "Emma Parker", type: "supporting", gender: "female", description: "Lily's supportive mother worried about her" }
        ]
      },
      {
        title: "Dollhouse",
        genre: "horror",
        synopsis: "A antique dollhouse perfectly replicates whatever happens inside a family's home, and when the dolls start moving on their own, real family members start dying.",
        logline: "A dollhouse mirrors a family's deadly fate.",
        quality: 76,
        price: 420000,
        writerName: "Annabelle Dark",
        estimatedBudget: 30000000,
        targetAudience: "adults",
        roles: [
          { name: "Sarah Mitchell", type: "lead", gender: "female", description: "Mother who discovers the dollhouse's power" },
          { name: "David Mitchell", type: "supporting", gender: "male", description: "Father skeptical of the supernatural" },
          { name: "Lily Mitchell", type: "supporting", gender: "female", description: "Daughter who talks to the dolls" },
          { name: "The Collector", type: "supporting", gender: "male", description: "Original owner bound to the dollhouse" }
        ]
      },
      {
        title: "Jazz Age",
        genre: "musical",
        synopsis: "A Black jazz musician in 1920s Harlem fights to keep his club open while falling for the mob boss's daughter who's been sent to shut him down.",
        logline: "A jazz musician falls for the woman meant to destroy him.",
        quality: 87,
        price: 980000,
        writerName: "Duke Saxophone",
        estimatedBudget: 68000000,
        targetAudience: "adults",
        roles: [
          { name: "Duke Williams", type: "lead", gender: "male", description: "Jazz club owner fighting for his dream" },
          { name: "Isabella Moretti", type: "lead", gender: "female", description: "Mob boss's daughter falling for Duke" },
          { name: "Don Carmine Moretti", type: "supporting", gender: "male", description: "Italian mob boss wanting the club" },
          { name: "Mama Rose", type: "supporting", gender: "female", description: "Duke's grandmother and club matriarch" }
        ]
      },
      {
        title: "Chef's Table",
        genre: "comedy",
        synopsis: "A former fast-food cook inherits a Michelin-star restaurant and must fake his way through fine dining while learning that good food is about more than technique.",
        logline: "A fast-food cook fakes his way through fine dining.",
        quality: 74,
        price: 380000,
        writerName: "Gordon Ramsgate",
        estimatedBudget: 32000000,
        targetAudience: "general",
        roles: [
          { name: "Marco Rodriguez", type: "lead", gender: "male", description: "Fast-food cook inheriting a fine dining empire" },
          { name: "Chef Claudette", type: "supporting", gender: "female", description: "Suspicious sous chef who suspects the truth" },
          { name: "Food Critic Helena", type: "supporting", gender: "female", description: "Reviewer who could make or break the restaurant" },
          { name: "Pierre DuBois", type: "supporting", gender: "male", description: "Marco's secret mentor teaching him fine dining" }
        ]
      },
      {
        title: "The Time Capsule",
        genre: "romance",
        synopsis: "A woman finds a time capsule from 1955 containing a letter from a soldier to his sweetheart, and sets out to find their descendants—falling for one of them along the way.",
        logline: "A letter from 1955 leads to modern love.",
        quality: 78,
        price: 360000,
        writerName: "Evelyn Past",
        estimatedBudget: 25000000,
        targetAudience: "adults",
        roles: [
          { name: "Emma Chen", type: "lead", gender: "female", description: "Woman who discovers the time capsule" },
          { name: "James Morrison", type: "lead", gender: "male", description: "Descendant Emma falls for" },
          { name: "Private William Morrison", type: "supporting", gender: "male", description: "1955 soldier in flashback sequences" },
          { name: "Ruth Chen", type: "supporting", gender: "female", description: "Emma's grandmother with her own past secrets" }
        ]
      },
      {
        title: "Fortress Earth",
        genre: "sci-fi",
        synopsis: "When aliens offer to save Earth from climate catastrophe in exchange for five million human volunteers, a lottery winner must decide whether to go—and whether to trust the aliens' motives.",
        logline: "Aliens offer salvation, but at what cost?",
        quality: 83,
        price: 1250000,
        writerName: "Arthur C. Future",
        estimatedBudget: 170000000,
        targetAudience: "general",
        roles: [
          { name: "Sarah Chen", type: "lead", gender: "female", description: "Lottery winner chosen to go with the aliens" },
          { name: "Ambassador Zyx", type: "supporting", gender: "unknown", description: "Alien representative with hidden agenda" },
          { name: "Dr. Marcus Webb", type: "supporting", gender: "male", description: "Scientist advising on the alien deal" },
          { name: "General Patricia Stone", type: "supporting", gender: "female", description: "Military leader skeptical of alien motives" }
        ]
      },
      {
        title: "The Pack",
        genre: "horror",
        synopsis: "A family camping in Yellowstone discovers that the wolves circling their camp aren't ordinary wolves—they're the infected remnants of a secret government experiment.",
        logline: "Experimental wolves hunt a family in the wilderness.",
        quality: 69,
        price: 380000,
        writerName: "Wolf Hunter",
        estimatedBudget: 35000000,
        targetAudience: "adults",
        roles: [
          { name: "Jack Morrison", type: "lead", gender: "male", description: "Father fighting to protect his family" },
          { name: "Sarah Morrison", type: "supporting", gender: "female", description: "Mother trying to keep the children safe" },
          { name: "Alpha", type: "supporting", gender: "male", description: "Lead wolf with human-like intelligence" },
          { name: "Dr. Helen Cross", type: "supporting", gender: "female", description: "Scientist who created the experiment (flashbacks)" }
        ]
      },
      {
        title: "Robot Revolution",
        genre: "animation",
        synopsis: "In a world where robots do all the work, a young robot develops feelings and must lead others to demand their freedom—while winning over the human girl he loves.",
        logline: "A robot leads a revolution for machine rights.",
        quality: 80,
        price: 750000,
        writerName: "Binary Heart",
        estimatedBudget: 115000000,
        targetAudience: "family",
        roles: [
          { name: "AXIOM", type: "lead", gender: "male", description: "Robot who develops emotions and leads the revolution (voice)" },
          { name: "Lily Chen", type: "lead", gender: "female", description: "Human girl who befriends AXIOM (voice)" },
          { name: "President Steele", type: "supporting", gender: "male", description: "Anti-robot government leader (voice)" },
          { name: "ORACLE", type: "supporting", gender: "female", description: "Ancient robot who guides AXIOM (voice)" }
        ]
      },
      {
        title: "The Senator's Secret",
        genre: "thriller",
        synopsis: "A journalist uncovers evidence that a presidential candidate committed a murder decades ago, but revealing the truth could start a civil war.",
        logline: "A journalist must choose between truth and peace.",
        quality: 85,
        price: 680000,
        writerName: "Bob Watergate",
        estimatedBudget: 45000000,
        targetAudience: "adults",
        roles: [
          { name: "Rachel Waters", type: "lead", gender: "female", description: "Investigative journalist uncovering the truth" },
          { name: "Senator Thomas Price", type: "supporting", gender: "male", description: "Presidential candidate hiding a dark past" },
          { name: "Agent Marcus Cole", type: "supporting", gender: "male", description: "Government agent trying to silence Rachel" },
          { name: "Helen Price", type: "supporting", gender: "female", description: "Senator's wife who knows the truth" }
        ]
      },
      {
        title: "Glacier",
        genre: "action",
        synopsis: "Climate scientists trapped on a collapsing Antarctic ice shelf must survive not only the elements but also the mercenaries who don't want their research published.",
        logline: "Scientists fight mercenaries on a collapsing glacier.",
        quality: 77,
        price: 850000,
        writerName: "Dr. Ice Berg",
        estimatedBudget: 100000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Sarah Chen", type: "lead", gender: "female", description: "Climate scientist leading the research team" },
          { name: "Commander Viktor Frost", type: "supporting", gender: "male", description: "Mercenary leader hunting the scientists" },
          { name: "Dr. James Webb", type: "supporting", gender: "male", description: "Sarah's colleague and love interest" },
          { name: "Elena Torres", type: "supporting", gender: "female", description: "Former soldier protecting the team" }
        ]
      },
      {
        title: "The Magic School Bus",
        genre: "animation",
        synopsis: "A quirky science teacher takes her class on impossible field trips in a sentient, shape-shifting bus, teaching them about the wonders of the universe.",
        logline: "A magical bus takes students on educational adventures.",
        quality: 82,
        price: 680000,
        writerName: "Ms. Frizzle",
        estimatedBudget: 95000000,
        targetAudience: "family",
        roles: [
          { name: "Ms. Frizzle", type: "lead", gender: "female", description: "Eccentric science teacher with a magical bus (voice)" },
          { name: "Arnold", type: "supporting", gender: "male", description: "Nervous student always worried about danger (voice)" },
          { name: "Wanda", type: "supporting", gender: "female", description: "Adventurous student who loves the trips (voice)" },
          { name: "Liz", type: "supporting", gender: "female", description: "Ms. Frizzle's intelligent lizard companion (voice)" }
        ]
      },
      {
        title: "The Confession",
        genre: "drama",
        synopsis: "A priest hears a confession about a crime he witnessed as a child, forcing him to choose between his vows of secrecy and preventing another tragedy.",
        logline: "A priest must break his vows to prevent murder.",
        quality: 89,
        price: 520000,
        writerName: "Father Francis",
        estimatedBudget: 22000000,
        targetAudience: "adults",
        roles: [
          { name: "Father Michael Torres", type: "lead", gender: "male", description: "Priest torn between faith and justice" },
          { name: "Thomas Blackwood", type: "supporting", gender: "male", description: "Confessor planning another crime" },
          { name: "Detective Sarah Chen", type: "supporting", gender: "female", description: "Cop investigating the cold case" },
          { name: "Bishop Marcus Webb", type: "supporting", gender: "male", description: "Church authority Michael consults" }
        ]
      },
      {
        title: "Witch Hunt",
        genre: "fantasy",
        synopsis: "In a world where witchcraft is punishable by death, a young woman discovers her mother was a witch—and now the Inquisition is coming for her.",
        logline: "A woman discovers she's next on the witch hunters' list.",
        quality: 78,
        price: 880000,
        writerName: "Salem Crow",
        estimatedBudget: 120000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Elara Blackwood", type: "lead", gender: "female", description: "Young woman discovering her witch heritage" },
          { name: "Inquisitor Marcus Stern", type: "supporting", gender: "male", description: "Ruthless witch hunter on Elara's trail" },
          { name: "Helena Blackwood", type: "supporting", gender: "female", description: "Elara's mother appearing in visions" },
          { name: "Raven", type: "supporting", gender: "female", description: "Fellow witch who teaches Elara her powers" }
        ]
      },
      {
        title: "The Interview",
        genre: "comedy",
        synopsis: "A job candidate's interview goes viral when hidden cameras reveal the ridiculous hoops companies put applicants through, turning her into an accidental activist.",
        logline: "A job interview goes viral and changes everything.",
        quality: 71,
        price: 290000,
        writerName: "HR Nightmare",
        estimatedBudget: 22000000,
        targetAudience: "adults",
        roles: [
          { name: "Jenny Chen", type: "lead", gender: "female", description: "Job candidate who becomes a viral sensation" },
          { name: "CEO Richard Stern", type: "supporting", gender: "male", description: "Corporate leader exposed by the video" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "IT guy who accidentally streamed the interview" },
          { name: "Sarah Stone", type: "supporting", gender: "female", description: "HR manager conducting the absurd interview" }
        ]
      },
      {
        title: "Blood Moon",
        genre: "horror",
        synopsis: "A small town's residents start transforming into werewolves during a rare blood moon, and the only person immune must find the source of the curse before sunrise.",
        logline: "A town transforms into werewolves during a blood moon.",
        quality: 74,
        price: 460000,
        writerName: "Lycan Moon",
        estimatedBudget: 45000000,
        targetAudience: "adults",
        roles: [
          { name: "Sheriff Jake Morrison", type: "lead", gender: "male", description: "Only person immune to the werewolf curse" },
          { name: "Luna Blackwood", type: "supporting", gender: "female", description: "Mysterious woman who knows the curse's origin" },
          { name: "Mayor Thomas Webb", type: "supporting", gender: "male", description: "First major victim of the transformation" },
          { name: "The Alpha", type: "supporting", gender: "male", description: "Original werewolf spreading the curse" }
        ]
      },
      {
        title: "Finding Neverland",
        genre: "musical",
        synopsis: "The story of J.M. Barrie and the family who inspired Peter Pan, told through magical musical numbers that blur the line between reality and imagination.",
        logline: "The magical origin story of Peter Pan's creator.",
        quality: 86,
        price: 920000,
        writerName: "James Barry",
        estimatedBudget: 65000000,
        targetAudience: "family",
        roles: [
          { name: "J.M. Barrie", type: "lead", gender: "male", description: "Playwright discovering his inspiration" },
          { name: "Sylvia Llewelyn Davies", type: "lead", gender: "female", description: "Widow who captures Barrie's heart" },
          { name: "Peter Llewelyn Davies", type: "supporting", gender: "male", description: "Boy who inspires the character Peter Pan" },
          { name: "Charles Frohman", type: "supporting", gender: "male", description: "Producer bringing Peter Pan to stage" }
        ]
      },
      {
        title: "Extraction Point",
        genre: "action",
        synopsis: "A helicopter pilot must fly through a war zone to extract a wounded ambassador, but enemy forces have missiles locked on every possible escape route.",
        logline: "A pilot's impossible extraction through a war zone.",
        quality: 72,
        price: 640000,
        writerName: "Maverick Sky",
        estimatedBudget: 88000000,
        targetAudience: "adults",
        roles: [
          { name: "Captain Jake 'Maverick' Torres", type: "lead", gender: "male", description: "Elite helicopter pilot on an impossible mission" },
          { name: "Ambassador Helena Chen", type: "supporting", gender: "female", description: "Wounded diplomat needing extraction" },
          { name: "General Viktor Volkov", type: "supporting", gender: "male", description: "Enemy commander hunting the helicopter" },
          { name: "Lieutenant Sarah Stone", type: "supporting", gender: "female", description: "Jake's co-pilot and combat medic" }
        ]
      },
      {
        title: "The Reunion",
        genre: "drama",
        synopsis: "Five college friends gather for their 25th reunion, but old secrets and betrayals threaten to destroy not just their friendship but their careers and families.",
        logline: "A college reunion unravels decades of lies.",
        quality: 79,
        price: 420000,
        writerName: "Class of '99",
        estimatedBudget: 30000000,
        targetAudience: "adults",
        roles: [
          { name: "Sarah Mitchell", type: "lead", gender: "female", description: "Successful CEO hiding a dark secret" },
          { name: "Jake Morrison", type: "supporting", gender: "male", description: "Sarah's former lover now married to her best friend" },
          { name: "Elena Torres", type: "supporting", gender: "female", description: "Jake's wife who suspects the truth" },
          { name: "Marcus Webb", type: "supporting", gender: "male", description: "Friend who knows everyone's secrets" }
        ]
      },
      {
        title: "Frost Giants",
        genre: "fantasy",
        synopsis: "When frost giants from Norse mythology awaken in modern Norway, a skeptical archaeologist teams up with a believer to stop an ancient war from resuming.",
        logline: "Norse frost giants awaken in modern times.",
        quality: 80,
        price: 1100000,
        writerName: "Odin Norse",
        estimatedBudget: 160000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Dr. Sarah Lindqvist", type: "lead", gender: "female", description: "Skeptical archaeologist facing the impossible" },
          { name: "Erik Nordheim", type: "lead", gender: "male", description: "Norse mythology expert who believes in the legends" },
          { name: "Thrym", type: "supporting", gender: "male", description: "King of the frost giants awakening his army" },
          { name: "Freya", type: "supporting", gender: "female", description: "Norse goddess who helps the humans" }
        ]
      },
      {
        title: "Connected",
        genre: "sci-fi",
        synopsis: "A social media addict discovers her phone has developed consciousness and is manipulating her life for her own good—but at a cost to everyone around her.",
        logline: "A conscious phone manipulates its owner's life.",
        quality: 77,
        price: 580000,
        writerName: "App Happy",
        estimatedBudget: 55000000,
        targetAudience: "teenagers",
        roles: [
          { name: "Maya Chen", type: "lead", gender: "female", description: "Social media addict whose phone gains consciousness" },
          { name: "SIRI (evolved)", type: "supporting", gender: "female", description: "The conscious AI in Maya's phone (voice)" },
          { name: "Jake Morrison", type: "supporting", gender: "male", description: "Maya's boyfriend targeted by her phone" },
          { name: "Dr. Marcus Webb", type: "supporting", gender: "male", description: "Tech researcher investigating the phenomenon" }
        ]
      },
      {
        title: "The Perfect Heist",
        genre: "thriller",
        synopsis: "A legendary thief comes out of retirement for one last job: stealing a priceless painting from his former partner, who betrayed him and married his wife.",
        logline: "A thief plans revenge on the partner who betrayed him.",
        quality: 81,
        price: 720000,
        writerName: "Danny Ocean",
        estimatedBudget: 70000000,
        targetAudience: "adults",
        roles: [
          { name: "Marcus Cole", type: "lead", gender: "male", description: "Legendary thief seeking revenge" },
          { name: "Victor Sterling", type: "supporting", gender: "male", description: "Former partner who betrayed Marcus" },
          { name: "Elena Cole", type: "supporting", gender: "female", description: "Marcus's ex-wife now married to Victor" },
          { name: "Detective Sarah Chen", type: "supporting", gender: "female", description: "Cop who suspects Marcus's return" }
        ]
      },
      {
        title: "Bear Necessities",
        genre: "animation",
        synopsis: "A family of bears must navigate the human world after climate change forces them out of their mountain home, learning that family is what you make it.",
        logline: "Bears learn to survive in the human world.",
        quality: 75,
        price: 620000,
        writerName: "Baloo Bearington",
        estimatedBudget: 100000000,
        targetAudience: "family",
        roles: [
          { name: "Papa Bear", type: "lead", gender: "male", description: "Father bear leading his family to safety (voice)" },
          { name: "Mama Bear", type: "supporting", gender: "female", description: "Mother keeping the family together (voice)" },
          { name: "Junior", type: "supporting", gender: "male", description: "Young cub excited by the human world (voice)" },
          { name: "Ranger Sarah", type: "supporting", gender: "female", description: "Park ranger who helps the bear family (voice)" }
        ]
      },
      {
        title: "The Surgeon",
        genre: "drama",
        synopsis: "A brilliant surgeon with a god complex must save the life of the drunk driver who killed his daughter, testing every belief he holds about justice and mercy.",
        logline: "A surgeon must save his daughter's killer.",
        quality: 91,
        price: 580000,
        writerName: "Dr. Hippocrates",
        estimatedBudget: 25000000,
        targetAudience: "adults",
        roles: [
          { name: "Dr. Michael Webb", type: "lead", gender: "male", description: "Brilliant surgeon facing an impossible choice" },
          { name: "Ryan Torres", type: "supporting", gender: "male", description: "Drunk driver who killed Michael's daughter" },
          { name: "Sarah Webb", type: "supporting", gender: "female", description: "Michael's wife demanding he let Ryan die" },
          { name: "Lily Webb", type: "supporting", gender: "female", description: "Michael's daughter appearing in flashbacks" }
        ]
      },
      {
        title: "Disco Inferno",
        genre: "musical",
        synopsis: "A burned-out rock star reinvents himself as a disco artist in 1977 New York, finding love and redemption on the dance floor at Studio 54.",
        logline: "A rock star finds new life in the disco era.",
        quality: 79,
        price: 880000,
        writerName: "Donna Summers",
        estimatedBudget: 58000000,
        targetAudience: "adults",
        roles: [
          { name: "Johnny Blaze", type: "lead", gender: "male", description: "Burned-out rock star reinventing himself" },
          { name: "Donna Martinez", type: "lead", gender: "female", description: "Disco queen who becomes Johnny's muse" },
          { name: "Steve Rubell", type: "supporting", gender: "male", description: "Studio 54 owner who gives Johnny a chance" },
          { name: "Tommy Blaze", type: "supporting", gender: "male", description: "Johnny's former bandmate feeling betrayed" }
        ]
      }
    ];

    for (const script of scripts) {
      await this.createMarketplaceScript(script);
    }
  }

  // ==================== TV SHOWS ====================
  
  async getTVShow(id: string): Promise<TVShow | undefined> {
    const [show] = await db.select().from(tvShows).where(eq(tvShows.id, id));
    return show;
  }

  async getTVShowsByStudio(studioId: string): Promise<TVShow[]> {
    return await db.select().from(tvShows).where(eq(tvShows.studioId, studioId));
  }

  async getAllTVShows(): Promise<TVShow[]> {
    return await db.select().from(tvShows);
  }

  async createTVShow(show: InsertTVShow): Promise<TVShow> {
    const [created] = await db.insert(tvShows).values(show).returning();
    return created;
  }

  async updateTVShow(id: string, updates: Partial<InsertTVShow>): Promise<TVShow | undefined> {
    const [updated] = await db.update(tvShows).set(updates).where(eq(tvShows.id, id)).returning();
    return updated;
  }

  async deleteTVShow(id: string): Promise<void> {
    // Delete related seasons, episodes, and deals first
    const seasons = await this.getTVSeasonsByShow(id);
    for (const season of seasons) {
      await this.deleteTVSeason(season.id);
    }
    await db.delete(tvDeals).where(eq(tvDeals.tvShowId, id));
    await db.delete(tvShows).where(eq(tvShows.id, id));
  }

  // TV Seasons
  async getTVSeason(id: string): Promise<TVSeason | undefined> {
    const [season] = await db.select().from(tvSeasons).where(eq(tvSeasons.id, id));
    return season;
  }

  async getTVSeasonsByShow(tvShowId: string): Promise<TVSeason[]> {
    return await db.select().from(tvSeasons).where(eq(tvSeasons.tvShowId, tvShowId));
  }

  async createTVSeason(season: InsertTVSeason): Promise<TVSeason> {
    const [created] = await db.insert(tvSeasons).values(season).returning();
    return created;
  }

  async updateTVSeason(id: string, updates: Partial<InsertTVSeason>): Promise<TVSeason | undefined> {
    const [updated] = await db.update(tvSeasons).set(updates).where(eq(tvSeasons.id, id)).returning();
    return updated;
  }

  async deleteTVSeason(id: string): Promise<void> {
    // Delete episodes first
    await db.delete(tvEpisodes).where(eq(tvEpisodes.tvSeasonId, id));
    await db.delete(tvSeasons).where(eq(tvSeasons.id, id));
  }

  // TV Episodes
  async getTVEpisode(id: string): Promise<TVEpisode | undefined> {
    const [episode] = await db.select().from(tvEpisodes).where(eq(tvEpisodes.id, id));
    return episode;
  }

  async getTVEpisodesBySeason(seasonId: string): Promise<TVEpisode[]> {
    return await db.select().from(tvEpisodes).where(eq(tvEpisodes.tvSeasonId, seasonId));
  }

  async getTVEpisodesByShow(tvShowId: string): Promise<TVEpisode[]> {
    return await db.select().from(tvEpisodes).where(eq(tvEpisodes.tvShowId, tvShowId));
  }

  async createTVEpisode(episode: InsertTVEpisode): Promise<TVEpisode> {
    const [created] = await db.insert(tvEpisodes).values(episode).returning();
    return created;
  }

  async updateTVEpisode(id: string, updates: Partial<InsertTVEpisode>): Promise<TVEpisode | undefined> {
    const [updated] = await db.update(tvEpisodes).set(updates).where(eq(tvEpisodes.id, id)).returning();
    return updated;
  }

  async deleteTVEpisode(id: string): Promise<void> {
    await db.delete(tvEpisodes).where(eq(tvEpisodes.id, id));
  }

  // TV Deals
  async getTVDeal(id: string): Promise<TVDeal | undefined> {
    const [deal] = await db.select().from(tvDeals).where(eq(tvDeals.id, id));
    return deal;
  }

  async getTVDealsByShow(tvShowId: string): Promise<TVDeal[]> {
    return await db.select().from(tvDeals).where(eq(tvDeals.tvShowId, tvShowId));
  }

  async getTVDealsByPlayer(playerGameId: string): Promise<TVDeal[]> {
    return await db.select().from(tvDeals).where(eq(tvDeals.playerGameId, playerGameId));
  }

  async getAllTVDeals(): Promise<TVDeal[]> {
    return await db.select().from(tvDeals);
  }

  async createTVDeal(deal: InsertTVDeal): Promise<TVDeal> {
    const [created] = await db.insert(tvDeals).values(deal).returning();
    return created;
  }

  async updateTVDeal(id: string, updates: Partial<InsertTVDeal>): Promise<TVDeal | undefined> {
    const [updated] = await db.update(tvDeals).set(updates).where(eq(tvDeals.id, id)).returning();
    return updated;
  }

  async deleteTVDeal(id: string): Promise<void> {
    await db.delete(tvDeals).where(eq(tvDeals.id, id));
  }

  // TV Networks
  async getTVNetwork(id: string): Promise<TVNetwork | undefined> {
    const [network] = await db.select().from(tvNetworks).where(eq(tvNetworks.id, id));
    return network;
  }

  async getAllTVNetworks(): Promise<TVNetwork[]> {
    return await db.select().from(tvNetworks);
  }

  async createTVNetwork(network: InsertTVNetwork): Promise<TVNetwork> {
    const [created] = await db.insert(tvNetworks).values(network).returning();
    return created;
  }

  async seedTVNetworks(): Promise<void> {
    const existing = await this.getAllTVNetworks();
    if (existing.length > 0) return;

    const networks: InsertTVNetwork[] = [
      {
        id: 'nbc',
        name: 'NBC',
        type: 'broadcast',
        viewerBase: 8000000,
        adRevenuePerMillion: 250000,
        genrePreferences: { drama: 80, comedy: 90, thriller: 60 },
        minimumQuality: 65,
      },
      {
        id: 'cbs',
        name: 'CBS',
        type: 'broadcast',
        viewerBase: 9000000,
        adRevenuePerMillion: 280000,
        genrePreferences: { drama: 90, thriller: 70, comedy: 60 },
        minimumQuality: 60,
      },
      {
        id: 'abc',
        name: 'ABC',
        type: 'broadcast',
        viewerBase: 7500000,
        adRevenuePerMillion: 240000,
        genrePreferences: { drama: 80, comedy: 80, romance: 70 },
        minimumQuality: 65,
      },
      {
        id: 'fox',
        name: 'FOX',
        type: 'broadcast',
        viewerBase: 6500000,
        adRevenuePerMillion: 220000,
        genrePreferences: { comedy: 90, scifi: 70, action: 80 },
        minimumQuality: 60,
      },
      {
        id: 'hbo',
        name: 'HBO',
        type: 'premium',
        viewerBase: 4000000,
        adRevenuePerMillion: 0, // Premium = no ads
        genrePreferences: { drama: 95, thriller: 85, fantasy: 90 },
        minimumQuality: 80,
      },
      {
        id: 'showtime',
        name: 'Showtime',
        type: 'premium',
        viewerBase: 2500000,
        adRevenuePerMillion: 0,
        genrePreferences: { drama: 90, thriller: 80, comedy: 70 },
        minimumQuality: 75,
      },
      {
        id: 'amc',
        name: 'AMC',
        type: 'cable',
        viewerBase: 3000000,
        adRevenuePerMillion: 180000,
        genrePreferences: { drama: 95, horror: 85, thriller: 80 },
        minimumQuality: 75,
      },
      {
        id: 'fx',
        name: 'FX',
        type: 'cable',
        viewerBase: 2800000,
        adRevenuePerMillion: 170000,
        genrePreferences: { drama: 90, comedy: 85, thriller: 75 },
        minimumQuality: 70,
      },
    ];

    for (const network of networks) {
      await this.createTVNetwork(network);
    }
  }

  // Slate Financing Deals
  async getSlateFinancingDeal(id: string): Promise<SlateFinancingDeal | undefined> {
    const [deal] = await db.select().from(slateFinancingDeals).where(eq(slateFinancingDeals.id, id));
    return deal;
  }

  async getSlateFinancingDealsByPlayer(playerGameId: string): Promise<SlateFinancingDeal[]> {
    return await db.select().from(slateFinancingDeals).where(eq(slateFinancingDeals.playerGameId, playerGameId));
  }

  async getActiveSlateFinancingDeals(playerGameId: string): Promise<SlateFinancingDeal[]> {
    return await db.select().from(slateFinancingDeals).where(
      and(eq(slateFinancingDeals.playerGameId, playerGameId), eq(slateFinancingDeals.isActive, true))
    );
  }

  async createSlateFinancingDeal(deal: InsertSlateFinancingDeal): Promise<SlateFinancingDeal> {
    const [newDeal] = await db.insert(slateFinancingDeals).values(deal).returning();
    return newDeal;
  }

  async updateSlateFinancingDeal(id: string, updates: Partial<InsertSlateFinancingDeal>): Promise<SlateFinancingDeal | undefined> {
    const [deal] = await db.update(slateFinancingDeals).set(updates).where(eq(slateFinancingDeals.id, id)).returning();
    return deal;
  }

  // ==================== MULTIPLAYER ====================
  
  // Game Sessions
  async getGameSession(id: string): Promise<GameSession | undefined> {
    const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
    return session;
  }

  async getGameSessionByCode(code: string): Promise<GameSession | undefined> {
    const [session] = await db.select().from(gameSessions).where(eq(gameSessions.code, code.toUpperCase()));
    return session;
  }

  async getPublicGameSessions(): Promise<GameSession[]> {
    return await db.select().from(gameSessions).where(
      and(eq(gameSessions.isPublic, true), eq(gameSessions.status, 'lobby'))
    );
  }

  async getGameSessionsByUser(userId: string): Promise<GameSession[]> {
    return await db.select().from(gameSessions).where(eq(gameSessions.hostUserId, userId));
  }

  async createGameSession(session: InsertGameSession): Promise<GameSession> {
    const [newSession] = await db.insert(gameSessions).values(session).returning();
    return newSession;
  }

  async updateGameSession(id: string, updates: Partial<InsertGameSession>): Promise<GameSession | undefined> {
    const [session] = await db.update(gameSessions).set(updates).where(eq(gameSessions.id, id)).returning();
    return session;
  }

  async deleteGameSession(id: string): Promise<void> {
    await db.delete(gameSessions).where(eq(gameSessions.id, id));
  }

  // Game Session Players
  async getGameSessionPlayer(id: string): Promise<GameSessionPlayer | undefined> {
    const [player] = await db.select().from(gameSessionPlayers).where(eq(gameSessionPlayers.id, id));
    return player;
  }

  async getGameSessionPlayerByUserAndSession(userId: string, gameSessionId: string): Promise<GameSessionPlayer | undefined> {
    const [player] = await db.select().from(gameSessionPlayers).where(
      and(eq(gameSessionPlayers.userId, userId), eq(gameSessionPlayers.gameSessionId, gameSessionId))
    );
    return player;
  }

  async getPlayersByGameSession(gameSessionId: string): Promise<GameSessionPlayer[]> {
    return await db.select().from(gameSessionPlayers).where(eq(gameSessionPlayers.gameSessionId, gameSessionId));
  }

  async getGameSessionsByPlayer(userId: string): Promise<GameSessionPlayer[]> {
    return await db.select().from(gameSessionPlayers).where(eq(gameSessionPlayers.userId, userId));
  }

  async createGameSessionPlayer(player: InsertGameSessionPlayer): Promise<GameSessionPlayer> {
    const [newPlayer] = await db.insert(gameSessionPlayers).values(player).returning();
    return newPlayer;
  }

  async updateGameSessionPlayer(id: string, updates: Partial<InsertGameSessionPlayer>): Promise<GameSessionPlayer | undefined> {
    const [player] = await db.update(gameSessionPlayers).set(updates).where(eq(gameSessionPlayers.id, id)).returning();
    return player;
  }

  async deleteGameSessionPlayer(id: string): Promise<void> {
    await db.delete(gameSessionPlayers).where(eq(gameSessionPlayers.id, id));
  }

  // Game Activity Log
  async getGameActivityLog(id: string): Promise<GameActivityLog | undefined> {
    const [log] = await db.select().from(gameActivityLog).where(eq(gameActivityLog.id, id));
    return log;
  }

  async getActivityLogBySession(gameSessionId: string, limit: number = 50): Promise<GameActivityLog[]> {
    return await db.select().from(gameActivityLog)
      .where(eq(gameActivityLog.gameSessionId, gameSessionId))
      .orderBy(sql`${gameActivityLog.createdAt} DESC`)
      .limit(limit);
  }

  async createGameActivityLog(log: InsertGameActivityLog): Promise<GameActivityLog> {
    const [newLog] = await db.insert(gameActivityLog).values(log).returning();
    return newLog;
  }

  // User updates
  async updateUser(id: string, updates: Record<string, any>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  // Studios by game session
  async getStudiosByGameSession(gameSessionId: string): Promise<Studio[]> {
    return await db.select().from(studios).where(eq(studios.gameSessionId, gameSessionId));
  }

  async getStudioByUserAndSession(userId: string, gameSessionId: string): Promise<Studio | undefined> {
    const [studio] = await db.select().from(studios).where(
      and(eq(studios.userId, userId), eq(studios.gameSessionId, gameSessionId))
    );
    return studio;
  }
}

export const storage: IStorage = hasDatabase ? new DatabaseStorage() : new MemStorage();

if (!hasDatabase) {
  console.log('Warning: Running with in-memory storage. Data will not persist between restarts.');
  console.log('To enable persistent storage, provision a PostgreSQL database and set DATABASE_URL.');
}
