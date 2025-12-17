import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Game state / Studio
export const studios = pgTable("studios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(), // Unique device identifier for multi-device support
  userId: varchar("user_id"), // Links studio to authenticated user (for multiplayer)
  gameSessionId: varchar("game_session_id"), // Links studio to multiplayer game session
  name: text("name").notNull().default("New Studio"),
  budget: bigint("budget", { mode: "number" }).notNull().default(150000000),
  currentWeek: integer("current_week").notNull().default(1),
  currentYear: integer("current_year").notNull().default(2025),
  prestigeLevel: integer("prestige_level").notNull().default(1),
  totalEarnings: bigint("total_earnings", { mode: "number" }).notNull().default(0),
  totalAwards: integer("total_awards").notNull().default(0),
  isAI: boolean("is_ai").notNull().default(false),
  strategy: text("strategy").notNull().default("balanced"), // 'action', 'drama', 'comedy', 'balanced'
  homeTerritory: text("home_territory").notNull().default("NA"), // Territory code where studio is based (NA, CN, GB, FR, JP, etc.)
  isActive: boolean("is_active").notNull().default(false),
  playerGameId: varchar("player_game_id"), // Links AI studios to their player's game
  createdAt: integer("created_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
});

export const insertStudioSchema = createInsertSchema(studios).omit({ id: true });
export type InsertStudio = z.infer<typeof insertStudioSchema>;
export type Studio = typeof studios.$inferSelect;

// Talent (actors, directors, writers, composers)
export const talent = pgTable("talent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'actor' | 'director' | 'writer' | 'composer'
  gender: text("gender").notNull().default("unknown"), // 'male' | 'female' | 'unknown'
  nationality: text("nationality").notNull().default("American"), // Country of origin
  starRating: integer("star_rating").notNull().default(3),
  askingPrice: integer("asking_price").notNull().default(5000000),
  boxOfficeAvg: integer("box_office_avg").notNull().default(100000000),
  awards: integer("awards").notNull().default(0),
  genres: jsonb("genres").notNull().default(sql`'{}'::jsonb`), // Object mapping genre names to scores (0-100)
  isActive: boolean("is_active").notNull().default(true), // Whether talent is available for hire
  imageUrl: text("image_url"), // URL to talent headshot/portrait
  birthYear: integer("birth_year"), // Year of birth for age display
  popularity: integer("popularity").notNull().default(50), // 1-100 popularity score
  
  // Core skills (1-100 scale)
  performance: integer("performance").notNull().default(70), // Raw talent/ability
  experience: integer("experience").notNull().default(50), // Years/projects of experience
  fame: integer("fame").notNull().default(50), // Fame score based on box office history (affects audience draw)
  
  // Genre-specific skills (1-100 scale) - how well they perform in each genre
  skillAction: integer("skill_action").notNull().default(50),
  skillDrama: integer("skill_drama").notNull().default(50),
  skillComedy: integer("skill_comedy").notNull().default(50),
  skillThriller: integer("skill_thriller").notNull().default(50),
  skillHorror: integer("skill_horror").notNull().default(50),
  skillScifi: integer("skill_scifi").notNull().default(50),
  skillAnimation: integer("skill_animation").notNull().default(50),
  skillRomance: integer("skill_romance").notNull().default(50),
  
  // Director-specific skills (only applicable for directors)
  skillCinematography: integer("skill_cinematography").notNull().default(50),
  skillEditing: integer("skill_editing").notNull().default(50),
  
  // Composer-specific skills (only applicable for composers)
  skillOrchestral: integer("skill_orchestral").notNull().default(50),
  skillElectronic: integer("skill_electronic").notNull().default(50),
  
  // Busy status - tracks if talent is working on another project
  currentFilmId: varchar("current_film_id"), // Film currently working on (null if available)
  busyUntilWeek: integer("busy_until_week"), // Week when they become available
  busyUntilYear: integer("busy_until_year"), // Year when they become available
});

export const insertTalentSchema = createInsertSchema(talent).omit({ id: true });
export type InsertTalent = z.infer<typeof insertTalentSchema>;
export type Talent = typeof talent.$inferSelect;

// Films
export const films = pgTable("films", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studioId: varchar("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  synopsis: text("synopsis").notNull().default(""),
  phase: text("phase").notNull().default("development"), // 'development' | 'awaiting-greenlight' | 'pre-production' | 'production' | 'post-production' | 'released'
  status: text("status").notNull().default("active"), // 'active' | 'archived' - archived means theatrical run is complete
  archivedWeek: integer("archived_week"), // Week when film was archived
  archivedYear: integer("archived_year"), // Year when film was archived
  productionBudget: bigint("production_budget", { mode: "number" }).notNull().default(0),
  marketingBudget: bigint("marketing_budget", { mode: "number" }).notNull().default(0),
  talentBudget: bigint("talent_budget", { mode: "number" }).notNull().default(0),
  totalBudget: bigint("total_budget", { mode: "number" }).notNull().default(0),
  directorId: varchar("director_id").references(() => talent.id),
  writerId: varchar("writer_id").references(() => talent.id),
  castIds: text("cast_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  cinematographerId: varchar("cinematographer_id").references(() => talent.id),
  editorId: varchar("editor_id").references(() => talent.id),
  composerId: varchar("composer_id").references(() => talent.id),
  vfxStudioId: varchar("vfx_studio_id"),
  scriptQuality: integer("script_quality").notNull().default(70),
  cinematographyQuality: integer("cinematography_quality").notNull().default(70),
  
  // Department budgets (added during talent hiring phase)
  setsBudget: bigint("sets_budget", { mode: "number" }).notNull().default(0),
  costumesBudget: bigint("costumes_budget", { mode: "number" }).notNull().default(0),
  stuntsBudget: bigint("stunts_budget", { mode: "number" }).notNull().default(0),
  makeupBudget: bigint("makeup_budget", { mode: "number" }).notNull().default(0),
  practicalEffectsBudget: bigint("practical_effects_budget", { mode: "number" }).notNull().default(0),
  soundCrewBudget: bigint("sound_crew_budget", { mode: "number" }).notNull().default(0),
  
  // Track if hiring phase is complete
  hasHiredTalent: boolean("has_hired_talent").notNull().default(false),
  hasEditedPostProduction: boolean("has_edited_post_production").notNull().default(false),
  createdAtWeek: integer("created_at_week").notNull().default(1),
  createdAtYear: integer("created_at_year").notNull().default(2025),
  developmentDurationWeeks: integer("development_duration_weeks").notNull().default(2),
  preProductionDurationWeeks: integer("pre_production_duration_weeks").notNull().default(2),
  productionDurationWeeks: integer("production_duration_weeks").notNull().default(4),
  postProductionDurationWeeks: integer("post_production_duration_weeks").notNull().default(2),
  weeksInCurrentPhase: integer("weeks_in_current_phase").notNull().default(0),
  releaseWeek: integer("release_week"),
  releaseYear: integer("release_year"),
  weeklyBoxOffice: bigint("weekly_box_office", { mode: "number" }).array().notNull().default(sql`ARRAY[]::bigint[]`),
  weeklyBoxOfficeByCountry: jsonb("weekly_box_office_by_country").notNull().default(sql`'[]'::jsonb`),
  totalBoxOffice: bigint("total_box_office", { mode: "number" }).notNull().default(0),
  totalBoxOfficeByCountry: jsonb("total_box_office_by_country").notNull().default(sql`'{}'::jsonb`),
  audienceScore: real("audience_score").notNull().default(0),
  criticScore: integer("critic_score").notNull().default(0),
  criticScoreBreakdown: jsonb("critic_score_breakdown").notNull().default(sql`'{}'::jsonb`),
  audienceScoreBreakdown: jsonb("audience_score_breakdown").notNull().default(sql`'{}'::jsonb`),
  boxOfficeBreakdown: jsonb("box_office_breakdown").notNull().default(sql`'{}'::jsonb`),
  costBreakdown: jsonb("cost_breakdown").notNull().default(sql`'{}'::jsonb`),
  theaterCount: integer("theater_count").notNull().default(0),
  awards: text("awards").array().notNull().default(sql`ARRAY[]::text[]`),
  franchiseId: varchar("franchise_id").references(() => franchises.id),
  isSequel: boolean("is_sequel").notNull().default(false),
  prequelFilmId: varchar("prequel_film_id").references(() => films.id),
  posterUrl: text("poster_url"), // Custom poster image URL set during release scheduling
});

export const insertFilmSchema = createInsertSchema(films).omit({ id: true });
export type InsertFilm = z.infer<typeof insertFilmSchema>;
export type Film = typeof films.$inferSelect;

// Film Roles - tracks character roles in a film for casting
export const filmRoles = pgTable("film_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filmId: varchar("film_id").notNull().references(() => films.id),
  roleName: text("role_name").notNull(), // Character name (e.g., "John Connor", "Sarah Connor")
  characterAge: integer("character_age"), // Age of character in film
  importance: text("importance").notNull().default("supporting"), // 'lead' | 'supporting' | 'minor' | 'cameo'
  characterType: text("character_type").notNull().default("hero"), // 'hero' | 'villain' | 'love_interest' | 'mentor' | 'sidekick' | 'comic_relief' | 'antagonist' | 'other'
  genderPreference: text("gender_preference").notNull().default("any"), // 'male' | 'female' | 'any'
  actorId: varchar("actor_id").references(() => talent.id), // The actor cast in this role (null if not yet cast)
  isCast: boolean("is_cast").notNull().default(false), // Whether an actor has been successfully hired
});

export const insertFilmRoleSchema = createInsertSchema(filmRoles).omit({ id: true });
export type InsertFilmRole = z.infer<typeof insertFilmRoleSchema>;
export type FilmRole = typeof filmRoles.$inferSelect;

// Role importance enum
export const roleImportanceEnum = z.enum(['lead', 'supporting', 'minor', 'cameo']);
export type RoleImportance = z.infer<typeof roleImportanceEnum>;

// Character type enum
export const characterTypeEnum = z.enum(['hero', 'villain', 'love_interest', 'mentor', 'sidekick', 'comic_relief', 'antagonist', 'other']);
export type CharacterType = z.infer<typeof characterTypeEnum>;

// Users table (for authentication and multiplayer)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"), // Shown to other players
  avatarUrl: text("avatar_url"), // Profile picture
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: integer("last_seen_at"),
  createdAt: integer("created_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Genre type for type safety
export const genreEnum = z.enum([
  'action', 'comedy', 'drama', 'horror', 'scifi', 'romance', 'thriller', 'animation', 'fantasy', 'musicals'
]);
export type Genre = z.infer<typeof genreEnum>;

// Phase type
// production-complete: Film finished post-production but no territory releases scheduled yet
// awaiting-release: Film has territory releases scheduled and is waiting for release date
export const phaseEnum = z.enum([
  'development', 'pre-production', 'production', 'post-production', 'production-complete', 'awaiting-release', 'released'
]);
export type Phase = z.infer<typeof phaseEnum>;

// Franchises - film series/franchises
export const franchises = pgTable("franchises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studioId: varchar("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  originalFilmId: varchar("original_film_id").notNull().references(() => films.id),
  totalFilms: integer("total_films").notNull().default(1),
  totalRevenue: bigint("total_revenue", { mode: "number" }).notNull().default(0),
  createdWeek: integer("created_week").notNull().default(1),
  createdYear: integer("created_year").notNull().default(2025),
});

export const insertFranchiseSchema = createInsertSchema(franchises).omit({ id: true });
export type InsertFranchise = z.infer<typeof insertFranchiseSchema>;
export type Franchise = typeof franchises.$inferSelect;

// Film status type (active = in theaters, archived = theatrical run complete)
export const filmStatusEnum = z.enum(['active', 'archived']);
export type FilmStatus = z.infer<typeof filmStatusEnum>;

// Talent type
export const talentTypeEnum = z.enum(['actor', 'director', 'writer', 'composer']);
export type TalentType = z.infer<typeof talentTypeEnum>;

// Streaming Services (5 platforms based on real services)
export const streamingServices = pgTable("streaming_services", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo").notNull(), // Icon name from lucide-react
  color: text("color").notNull(), // Brand color hex
  subscriberCount: integer("subscriber_count").notNull(), // In millions
  monthlyRevenuePerSub: real("monthly_revenue_per_sub").notNull(), // ARPU
  genrePreferences: text("genre_preferences").array().notNull().default(sql`ARRAY[]::text[]`),
  minimumQualityScore: integer("minimum_quality_score").notNull().default(60),
  licenseFeeMultiplier: real("license_fee_multiplier").notNull().default(1.0),
});

export const insertStreamingServiceSchema = createInsertSchema(streamingServices);
export type InsertStreamingService = z.infer<typeof insertStreamingServiceSchema>;
export type StreamingService = typeof streamingServices.$inferSelect;

// Streaming Deals - tracks when films are licensed to streaming services
export const streamingDeals = pgTable("streaming_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filmId: varchar("film_id").references(() => films.id),
  streamingServiceId: varchar("streaming_service_id").notNull().references(() => streamingServices.id),
  playerGameId: varchar("player_game_id").notNull(),
  licenseFee: bigint("license_fee", { mode: "number" }).notNull().default(0),
  weeklyRevenue: bigint("weekly_revenue", { mode: "number" }).notNull().default(0),
  totalRevenue: bigint("total_revenue", { mode: "number" }).notNull().default(0),
  startWeek: integer("start_week").notNull(),
  startYear: integer("start_year").notNull(),
  endWeek: integer("end_week"),
  endYear: integer("end_year"),
  weeksActive: integer("weeks_active").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  dealType: text("deal_type").notNull().default("license"),
  licenseYears: integer("license_years").notNull().default(2),
  weeklyViews: bigint("weekly_views", { mode: "number" }).array().notNull().default(sql`ARRAY[]::bigint[]`),
  totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
  annualPayment: bigint("annual_payment", { mode: "number" }).notNull().default(0),
  upfrontPayment: bigint("upfront_payment", { mode: "number" }).notNull().default(0),
  isProductionDeal: boolean("is_production_deal").notNull().default(false),
  productionDeadlineWeek: integer("production_deadline_week"),
  productionDeadlineYear: integer("production_deadline_year"),
});

export const insertStreamingDealSchema = createInsertSchema(streamingDeals).omit({ id: true });
export type InsertStreamingDeal = z.infer<typeof insertStreamingDealSchema>;
export type StreamingDeal = typeof streamingDeals.$inferSelect;

// Email types enum
export const emailTypeEnum = z.enum([
  'streaming_offer',      // Offer from streaming service to license a film
  'streaming_renewal',    // Renewal offer for expiring streaming deal with good views
  'production_deal',      // Pitch for a new production deal
  'award_campaign',       // Film award campaign information
  'festival_invite',      // Festival circuit invitation
  'general'               // General game notifications
]);
export type EmailType = z.infer<typeof emailTypeEnum>;

// Emails - in-game email inbox system
export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerGameId: varchar("player_game_id").notNull(),
  type: text("type").notNull(), // EmailType
  subject: text("subject").notNull(),
  sender: text("sender").notNull(),
  senderTitle: text("sender_title").notNull().default(""),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  hasAction: boolean("has_action").notNull().default(false),
  actionLabel: text("action_label"),
  actionData: jsonb("action_data"), // Stores data needed for the action (e.g., deal details)
  sentWeek: integer("sent_week").notNull(),
  sentYear: integer("sent_year").notNull(),
  expiresWeek: integer("expires_week"), // Some offers expire
  expiresYear: integer("expires_year"),
});

export const insertEmailSchema = createInsertSchema(emails).omit({ id: true });
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

// Award Shows - 5 major award ceremonies
export const awardShows = pgTable("award_shows", {
  id: varchar("id").primaryKey(), // e.g., 'academy_awards', 'golden_globes'
  name: text("name").notNull(),
  shortName: text("short_name").notNull(), // e.g., 'Oscars', 'Globes'
  ceremonyWeek: integer("ceremony_week").notNull(), // Week of year the ceremony occurs
  nominationsWeek: integer("nominations_week").notNull(), // Week nominations are announced
  prestigeLevel: integer("prestige_level").notNull(), // 1-5 (5 = most prestigious)
  description: text("description").notNull(),
});

export const insertAwardShowSchema = createInsertSchema(awardShows);
export type InsertAwardShow = z.infer<typeof insertAwardShowSchema>;
export type AwardShow = typeof awardShows.$inferSelect;

// Award Categories for each show
export const awardCategories = pgTable("award_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  awardShowId: varchar("award_show_id").notNull().references(() => awardShows.id),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(), // For display in compact views
  categoryType: text("category_type").notNull(), // 'film', 'acting', 'technical', 'writing', 'music'
  requiresGenre: text("requires_genre"), // If category is genre-specific (e.g., 'animation', 'documentary')
  isPerformance: boolean("is_performance").notNull().default(false), // For acting categories
  isInternational: boolean("is_international").notNull().default(false), // For international/foreign film categories (requires non-US release)
});

export const insertAwardCategorySchema = createInsertSchema(awardCategories).omit({ id: true });
export type InsertAwardCategory = z.infer<typeof insertAwardCategorySchema>;
export type AwardCategory = typeof awardCategories.$inferSelect;

// Award Nominations - tracks nominations for each ceremony year
export const awardNominations = pgTable("award_nominations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerGameId: varchar("player_game_id").notNull(),
  awardShowId: varchar("award_show_id").notNull().references(() => awardShows.id),
  categoryId: varchar("category_id").notNull().references(() => awardCategories.id),
  filmId: varchar("film_id").notNull().references(() => films.id),
  talentId: varchar("talent_id").references(() => talent.id), // For acting/directing categories
  ceremonyYear: integer("ceremony_year").notNull(), // Game year the ceremony is held
  isWinner: boolean("is_winner").notNull().default(false),
  announcedWeek: integer("announced_week").notNull(), // When nomination was announced
  announcedYear: integer("announced_year").notNull(),
});

export const insertAwardNominationSchema = createInsertSchema(awardNominations).omit({ id: true });
export type InsertAwardNomination = z.infer<typeof insertAwardNominationSchema>;
export type AwardNomination = typeof awardNominations.$inferSelect;

// Award Ceremonies - tracks ceremony status for each game year
export const awardCeremonies = pgTable("award_ceremonies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerGameId: varchar("player_game_id").notNull(),
  awardShowId: varchar("award_show_id").notNull().references(() => awardShows.id),
  ceremonyYear: integer("ceremony_year").notNull(),
  nominationsAnnounced: boolean("nominations_announced").notNull().default(false),
  ceremonyComplete: boolean("ceremony_complete").notNull().default(false),
  winnersAnnounced: boolean("winners_announced").notNull().default(false),
});

export const insertAwardCeremonySchema = createInsertSchema(awardCeremonies).omit({ id: true });
export type InsertAwardCeremony = z.infer<typeof insertAwardCeremonySchema>;
export type AwardCeremony = typeof awardCeremonies.$inferSelect;

// Release Territories - major film markets where films can be released
export const RELEASE_TERRITORIES = [
  { code: 'NA', name: 'North America', marketSize: 0.35 },
  { code: 'CN', name: 'China', marketSize: 0.19 },
  { code: 'GB', name: 'UK & Ireland', marketSize: 0.047 },
  { code: 'FR', name: 'France', marketSize: 0.047 },
  { code: 'JP', name: 'Japan', marketSize: 0.047 },
  { code: 'DE', name: 'Germany', marketSize: 0.03 },
  { code: 'KR', name: 'South Korea', marketSize: 0.028 },
  { code: 'MX', name: 'Mexico', marketSize: 0.027 },
  { code: 'AU', name: 'Australia', marketSize: 0.022 },
  { code: 'IN', name: 'India', marketSize: 0.01 },
  { code: 'OTHER', name: 'Other Territories', marketSize: 0.262 },
] as const;

export type TerritoryCode = typeof RELEASE_TERRITORIES[number]['code'];

// Film Releases - tracks per-territory release schedule
export const filmReleases = pgTable("film_releases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filmId: varchar("film_id").notNull().references(() => films.id),
  territoryCode: text("territory_code").notNull(), // NA, CN, GB, etc.
  releaseWeek: integer("release_week").notNull(),
  releaseYear: integer("release_year").notNull(),
  productionBudget: bigint("production_budget", { mode: "number" }).notNull().default(0),
  marketingBudget: bigint("marketing_budget", { mode: "number" }).notNull().default(0),
  isReleased: boolean("is_released").notNull().default(false),
  weeklyBoxOffice: bigint("weekly_box_office", { mode: "number" }).array().notNull().default(sql`ARRAY[]::bigint[]`),
  totalBoxOffice: bigint("total_box_office", { mode: "number" }).notNull().default(0),
  theaterCount: integer("theater_count").notNull().default(0),
  weeksInRelease: integer("weeks_in_release").notNull().default(0),
});

export const insertFilmReleaseSchema = createInsertSchema(filmReleases).omit({ id: true });
export type InsertFilmRelease = z.infer<typeof insertFilmReleaseSchema>;
export type FilmRelease = typeof filmReleases.$inferSelect;

// Development Milestones - more granular film development phases
export const DEVELOPMENT_MILESTONES = [
  { id: 'concept', name: 'Concept Development', description: 'Initial idea and story concept', defaultWeeks: 2 },
  { id: 'script_draft_1', name: 'First Draft', description: 'Writing the first script draft', defaultWeeks: 4 },
  { id: 'script_revisions', name: 'Script Revisions', description: 'Polishing and revising the script', defaultWeeks: 3 },
  { id: 'talent_attachment', name: 'Talent Attachment', description: 'Attaching key talent (director, leads)', defaultWeeks: 2 },
  { id: 'greenlight', name: 'Greenlight', description: 'Final approval to proceed', defaultWeeks: 1 },
  { id: 'casting', name: 'Full Casting', description: 'Casting remaining roles', defaultWeeks: 3 },
  { id: 'location_scouting', name: 'Location Scouting', description: 'Finding filming locations', defaultWeeks: 2 },
  { id: 'pre_viz', name: 'Pre-Visualization', description: 'Storyboarding and visual planning', defaultWeeks: 2 },
  { id: 'principal_photography', name: 'Principal Photography', description: 'Main filming period', defaultWeeks: 12 },
  { id: 'reshoots', name: 'Reshoots', description: 'Additional filming if needed', defaultWeeks: 2 },
  { id: 'editing', name: 'Editing', description: 'Assembling and editing footage', defaultWeeks: 6 },
  { id: 'vfx', name: 'Visual Effects', description: 'Creating visual effects', defaultWeeks: 8 },
  { id: 'scoring', name: 'Music Scoring', description: 'Composing and recording score', defaultWeeks: 4 },
  { id: 'color_sound', name: 'Color & Sound', description: 'Color grading and sound mixing', defaultWeeks: 3 },
  { id: 'test_screenings', name: 'Test Screenings', description: 'Audience test screenings', defaultWeeks: 2 },
  { id: 'final_cut', name: 'Final Cut', description: 'Completing the final version', defaultWeeks: 1 },
] as const;

export type MilestoneId = typeof DEVELOPMENT_MILESTONES[number]['id'];

// Film Development Progress - tracks milestone completion
export const filmMilestones = pgTable("film_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filmId: varchar("film_id").notNull().references(() => films.id),
  milestoneId: text("milestone_id").notNull(), // concept, script_draft_1, etc.
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, skipped
  startWeek: integer("start_week"),
  startYear: integer("start_year"),
  completedWeek: integer("completed_week"),
  completedYear: integer("completed_year"),
  durationWeeks: integer("duration_weeks").notNull().default(2),
  weeksSpent: integer("weeks_spent").notNull().default(0),
  notes: text("notes"),
});

export const insertFilmMilestoneSchema = createInsertSchema(filmMilestones).omit({ id: true });
export type InsertFilmMilestone = z.infer<typeof insertFilmMilestoneSchema>;
export type FilmMilestone = typeof filmMilestones.$inferSelect;

// Script Marketplace - pre-made scripts available for purchase
export const marketplaceScripts = pgTable("marketplace_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  synopsis: text("synopsis").notNull(),
  logline: text("logline").notNull(),
  quality: integer("quality").notNull().default(70),
  price: bigint("price", { mode: "number" }).notNull().default(500000),
  writerName: text("writer_name").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  estimatedBudget: bigint("estimated_budget", { mode: "number" }).notNull().default(50000000),
  targetAudience: text("target_audience").notNull().default("general"),
  roles: jsonb("roles").notNull().default(sql`'[]'::jsonb`),
  createdAt: integer("created_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
});

export const insertMarketplaceScriptSchema = createInsertSchema(marketplaceScripts).omit({ id: true });
export type InsertMarketplaceScript = z.infer<typeof insertMarketplaceScriptSchema>;
export type MarketplaceScript = typeof marketplaceScripts.$inferSelect;

// ==================== TV SHOWS ====================

// TV Show phase enum
export const tvShowPhaseEnum = z.enum([
  'concept',           // Initial concept development
  'writers-room',      // Writers developing scripts
  'pre-production',    // Casting, locations, etc.
  'production',        // Filming episodes
  'post-production',   // Editing, VFX, sound
  'airing',            // Currently airing
  'hiatus',            // Between seasons
  'wrapped',           // Show has ended
  'cancelled'          // Cancelled before completion
]);
export type TVShowPhase = z.infer<typeof tvShowPhaseEnum>;

// TV Shows - main series table
export const tvShows = pgTable("tv_shows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studioId: varchar("studio_id").notNull().references(() => studios.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  synopsis: text("synopsis").notNull().default(""),
  showType: text("show_type").notNull().default("drama"), // 'drama' | 'comedy' | 'limited' | 'anthology' | 'reality' | 'documentary'
  phase: text("phase").notNull().default("concept"),
  
  // Key talent
  showrunnerId: varchar("showrunner_id").references(() => talent.id), // Head writer/creator
  creatorId: varchar("creator_id").references(() => talent.id), // Original creator (may differ from showrunner)
  
  // Budget info
  episodeBudget: bigint("episode_budget", { mode: "number" }).notNull().default(5000000), // Per-episode budget
  totalBudget: bigint("total_budget", { mode: "number" }).notNull().default(0), // Running total spent
  
  // Distribution
  networkId: varchar("network_id"), // Traditional TV network (null = streaming only)
  streamingServiceId: varchar("streaming_service_id").references(() => streamingServices.id), // Streaming platform
  isStreamingExclusive: boolean("is_streaming_exclusive").notNull().default(false),
  releaseStrategy: text("release_strategy").notNull().default("weekly"), // 'weekly' | 'binge' | 'split'
  
  // Quality metrics
  overallQuality: integer("overall_quality").notNull().default(70),
  audienceScore: real("audience_score").notNull().default(0),
  criticScore: integer("critic_score").notNull().default(0),
  
  // Tracking
  totalSeasons: integer("total_seasons").notNull().default(0),
  totalEpisodes: integer("total_episodes").notNull().default(0),
  episodesPerSeason: integer("episodes_per_season").notNull().default(10),
  currentSeason: integer("current_season").notNull().default(1),
  renewalStatus: text("renewal_status").notNull().default("pending"), // 'pending' | 'renewed' | 'cancelled'
  weeksStreaming: integer("weeks_streaming").notNull().default(0),
  totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
  totalRevenue: bigint("total_revenue", { mode: "number" }).notNull().default(0),
  weeklyViews: bigint("weekly_views", { mode: "number" }).array().notNull().default(sql`ARRAY[]::bigint[]`),
  
  // Dates
  createdAtWeek: integer("created_at_week").notNull().default(1),
  createdAtYear: integer("created_at_year").notNull().default(2025),
  premiereWeek: integer("premiere_week"),
  premiereYear: integer("premiere_year"),
  finaleWeek: integer("finale_week"),
  finaleYear: integer("finale_year"),
  
  // Status
  isRenewed: boolean("is_renewed").notNull().default(false),
  isCancelled: boolean("is_cancelled").notNull().default(false),
  renewalPending: boolean("renewal_pending").notNull().default(false), // Waiting for renewal decision
  
  // Awards
  awards: text("awards").array().notNull().default(sql`ARRAY[]::text[]`),
  emmyNominations: integer("emmy_nominations").notNull().default(0),
  emmyWins: integer("emmy_wins").notNull().default(0),
});

export const insertTVShowSchema = createInsertSchema(tvShows).omit({ id: true });
export type InsertTVShow = z.infer<typeof insertTVShowSchema>;
export type TVShow = typeof tvShows.$inferSelect;

// TV Seasons - individual seasons of a show
export const tvSeasons = pgTable("tv_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tvShowId: varchar("tv_show_id").notNull().references(() => tvShows.id),
  seasonNumber: integer("season_number").notNull(),
  phase: text("phase").notNull().default("concept"),
  
  // Episodes
  episodeCount: integer("episode_count").notNull().default(10),
  episodesCompleted: integer("episodes_completed").notNull().default(0),
  episodesAired: integer("episodes_aired").notNull().default(0),
  
  // Budget
  seasonBudget: bigint("season_budget", { mode: "number" }).notNull().default(50000000),
  budgetSpent: bigint("budget_spent", { mode: "number" }).notNull().default(0),
  
  // Production timeline
  writersRoomWeeks: integer("writers_room_weeks").notNull().default(8),
  preProductionWeeks: integer("pre_production_weeks").notNull().default(4),
  productionWeeks: integer("production_weeks").notNull().default(16),
  postProductionWeeks: integer("post_production_weeks").notNull().default(8),
  weeksInCurrentPhase: integer("weeks_in_current_phase").notNull().default(0),
  
  // Cast (main recurring cast for this season)
  castIds: text("cast_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  
  // Quality
  seasonQuality: integer("season_quality").notNull().default(70),
  audienceScore: real("audience_score").notNull().default(0),
  criticScore: integer("critic_score").notNull().default(0),
  
  // Airing schedule
  premiereWeek: integer("premiere_week"),
  premiereYear: integer("premiere_year"),
  finaleWeek: integer("finale_week"),
  finaleYear: integer("finale_year"),
  
  // Performance
  averageViewers: bigint("average_viewers", { mode: "number" }).notNull().default(0),
  peakViewers: bigint("peak_viewers", { mode: "number" }).notNull().default(0),
  totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
  weeklyViews: bigint("weekly_views", { mode: "number" }).array().notNull().default(sql`ARRAY[]::bigint[]`),
  seasonRevenue: bigint("season_revenue", { mode: "number" }).notNull().default(0),
  
  // Status
  isComplete: boolean("is_complete").notNull().default(false),
  isAiring: boolean("is_airing").notNull().default(false),
});

export const insertTVSeasonSchema = createInsertSchema(tvSeasons).omit({ id: true });
export type InsertTVSeason = z.infer<typeof insertTVSeasonSchema>;
export type TVSeason = typeof tvSeasons.$inferSelect;

// TV Episodes - individual episodes (for detailed tracking)
export const tvEpisodes = pgTable("tv_episodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tvSeasonId: varchar("tv_season_id").notNull().references(() => tvSeasons.id),
  tvShowId: varchar("tv_show_id").notNull().references(() => tvShows.id),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title").notNull().default(""),
  synopsis: text("synopsis").notNull().default(""),
  
  // Production
  directorId: varchar("director_id").references(() => talent.id),
  writerId: varchar("writer_id").references(() => talent.id),
  guestCastIds: text("guest_cast_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  
  // Budget
  episodeBudget: bigint("episode_budget", { mode: "number" }).notNull().default(5000000),
  
  // Quality
  episodeQuality: integer("episode_quality").notNull().default(70),
  
  // Airing
  airWeek: integer("air_week"),
  airYear: integer("air_year"),
  hasAired: boolean("has_aired").notNull().default(false),
  
  // Performance
  viewers: bigint("viewers", { mode: "number" }).notNull().default(0),
  rating: real("rating").notNull().default(0), // Episode specific rating
  
  // Status
  status: text("status").notNull().default("planned"), // 'planned' | 'in-production' | 'completed' | 'aired'
});

export const insertTVEpisodeSchema = createInsertSchema(tvEpisodes).omit({ id: true });
export type InsertTVEpisode = z.infer<typeof insertTVEpisodeSchema>;
export type TVEpisode = typeof tvEpisodes.$inferSelect;

// TV Deals - licensing/network deals for TV shows
export const tvDeals = pgTable("tv_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tvShowId: varchar("tv_show_id").notNull().references(() => tvShows.id),
  playerGameId: varchar("player_game_id").notNull(),
  
  // Deal type
  dealType: text("deal_type").notNull().default("streaming"), // 'streaming' | 'network' | 'syndication' | 'international'
  streamingServiceId: varchar("streaming_service_id").references(() => streamingServices.id),
  networkName: text("network_name"), // For traditional TV deals
  
  // Financial terms
  licenseFee: bigint("license_fee", { mode: "number" }).notNull().default(0), // Per-season fee
  episodeFee: bigint("episode_fee", { mode: "number" }).notNull().default(0), // Per-episode fee (for syndication)
  totalValue: bigint("total_value", { mode: "number" }).notNull().default(0),
  
  // Duration
  startWeek: integer("start_week").notNull(),
  startYear: integer("start_year").notNull(),
  endWeek: integer("end_week"),
  endYear: integer("end_year"),
  seasonsCommitted: integer("seasons_committed").notNull().default(1),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isExclusive: boolean("is_exclusive").notNull().default(false),
  
  // Performance tracking (similar to movie streaming deals)
  weeklyViews: bigint("weekly_views", { mode: "number" }).array().notNull().default(sql`ARRAY[]::bigint[]`),
  totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
  weeklyRevenue: bigint("weekly_revenue", { mode: "number" }).notNull().default(0),
  totalRevenue: bigint("total_revenue", { mode: "number" }).notNull().default(0),
  weeksActive: integer("weeks_active").notNull().default(0),
});

export const insertTVDealSchema = createInsertSchema(tvDeals).omit({ id: true });
export type InsertTVDeal = z.infer<typeof insertTVDealSchema>;
export type TVDeal = typeof tvDeals.$inferSelect;

// TV Networks - traditional broadcast/cable networks
export const tvNetworks = pgTable("tv_networks", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'broadcast' | 'cable' | 'premium'
  viewerBase: bigint("viewer_base", { mode: "number" }).notNull(), // Average weekly viewers in millions
  adRevenuePerMillion: bigint("ad_revenue_per_million", { mode: "number" }).notNull(), // Ad revenue per million viewers
  genrePreferences: jsonb("genre_preferences").notNull().default(sql`'{}'::jsonb`),
  minimumQuality: integer("minimum_quality").notNull().default(60),
});

export const insertTVNetworkSchema = createInsertSchema(tvNetworks);
export type InsertTVNetwork = z.infer<typeof insertTVNetworkSchema>;
export type TVNetwork = typeof tvNetworks.$inferSelect;

// Slate Financing Deals - tracks investments from production companies
export const slateFinancingDeals = pgTable("slate_financing_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerGameId: varchar("player_game_id").notNull(),
  investorName: text("investor_name").notNull(),
  investmentAmount: bigint("investment_amount", { mode: "number" }).notNull(),
  profitSharePercent: integer("profit_share_percent").notNull().default(25),
  filmsRemaining: integer("films_remaining").notNull().default(4),
  filmsCompleted: integer("films_completed").notNull().default(0),
  totalProfitPaid: bigint("total_profit_paid", { mode: "number" }).notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startWeek: integer("start_week").notNull(),
  startYear: integer("start_year").notNull(),
});

export const insertSlateFinancingDealSchema = createInsertSchema(slateFinancingDeals).omit({ id: true });
export type InsertSlateFinancingDeal = z.infer<typeof insertSlateFinancingDealSchema>;
export type SlateFinancingDeal = typeof slateFinancingDeals.$inferSelect;

// ==================== MULTIPLAYER ====================

// Game Sessions - shared game worlds where multiple players compete
export const gameSessions = pgTable("game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: varchar("code", { length: 6 }).notNull().unique(), // 6-character join code
  hostUserId: varchar("host_user_id").notNull().references(() => users.id),
  
  // Game state (shared across all players)
  currentWeek: integer("current_week").notNull().default(1),
  currentYear: integer("current_year").notNull().default(2025),
  
  // Settings
  maxPlayers: integer("max_players").notNull().default(4),
  isPublic: boolean("is_public").notNull().default(false),
  weekAdvanceMode: text("week_advance_mode").notNull().default("ready"), // 'ready' = all must ready up, 'timer' = auto-advance, 'host' = host controls
  timerMinutes: integer("timer_minutes").notNull().default(5), // For timer mode
  
  // Status
  status: text("status").notNull().default("lobby"), // 'lobby' | 'active' | 'paused' | 'completed'
  createdAt: integer("created_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
  startedAt: integer("started_at"), // When game actually started
  lastActivityAt: integer("last_activity_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
});

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({ id: true });
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// Game Session Players - links users to game sessions with their studio
export const gameSessionPlayers = pgTable("game_session_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameSessionId: varchar("game_session_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  studioId: varchar("studio_id").references(() => studios.id), // Created when game starts
  
  // Player state
  isReady: boolean("is_ready").notNull().default(false), // Ready to advance week
  isConnected: boolean("is_connected").notNull().default(false), // WebSocket connected
  isHost: boolean("is_host").notNull().default(false),
  
  // Timestamps
  joinedAt: integer("joined_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
  lastSeenAt: integer("last_seen_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
});

export const insertGameSessionPlayerSchema = createInsertSchema(gameSessionPlayers).omit({ id: true });
export type InsertGameSessionPlayer = z.infer<typeof insertGameSessionPlayerSchema>;
export type GameSessionPlayer = typeof gameSessionPlayers.$inferSelect;

// Game Session Status enum
export const gameSessionStatusEnum = z.enum(['lobby', 'active', 'paused', 'completed']);
export type GameSessionStatus = z.infer<typeof gameSessionStatusEnum>;

// Week Advance Mode enum
export const weekAdvanceModeEnum = z.enum(['ready', 'timer', 'host']);
export type WeekAdvanceMode = z.infer<typeof weekAdvanceModeEnum>;

// Game Activity Log - tracks notable events for all players to see
export const gameActivityLog = pgTable("game_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameSessionId: varchar("game_session_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id), // null for system events
  studioId: varchar("studio_id").references(() => studios.id),
  
  // Event details
  eventType: text("event_type").notNull(), // 'film_released', 'award_won', 'box_office_milestone', 'player_joined', etc.
  eventData: jsonb("event_data").notNull().default(sql`'{}'::jsonb`), // Flexible data for the event
  message: text("message").notNull(), // Human-readable message
  
  // Timing
  gameWeek: integer("game_week").notNull(),
  gameYear: integer("game_year").notNull(),
  createdAt: integer("created_at").notNull().default(sql`CAST(EXTRACT(EPOCH FROM NOW()) AS INTEGER)`),
});

export const insertGameActivityLogSchema = createInsertSchema(gameActivityLog).omit({ id: true });
export type InsertGameActivityLog = z.infer<typeof insertGameActivityLogSchema>;
export type GameActivityLog = typeof gameActivityLog.$inferSelect;

// Activity event types
export const activityEventTypeEnum = z.enum([
  'player_joined',
  'player_left', 
  'game_started',
  'week_advanced',
  'film_greenlit',
  'film_released',
  'box_office_record',
  'award_nomination',
  'award_won',
  'streaming_deal',
  'studio_milestone'
]);
export type ActivityEventType = z.infer<typeof activityEventTypeEnum>;
