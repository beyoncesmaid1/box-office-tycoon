import pg from "pg";
const { Pool } = pg;
type PoolType = InstanceType<typeof Pool>;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export const hasDatabase = !!process.env.DATABASE_URL;

let pool: PoolType | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

if (hasDatabase) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    max: 10,
  });
  pool.on("error", (error) => {
    console.error("[DATABASE] Idle connection was dropped; the pool will reconnect:", error.message);
  });
  drizzleDb = drizzle({ client: pool, schema });
}

const transientDatabaseCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08003",
  "08006",
]);

export async function withDatabaseRetry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 6,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const code = String(error?.code || error?.cause?.code || "");
      if (!transientDatabaseCodes.has(code) || attempt === maxAttempts) throw error;
      const delayMs = Math.min(4_000, 500 * 2 ** (attempt - 1));
      console.warn(`[DATABASE] ${label} lost its connection (${code}); retrying ${attempt}/${maxAttempts} in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

// Run manual migrations for new columns
export async function runMigrations(): Promise<void> {
  if (!pool) return;
  const migrationQuery = (statement: string) =>
    withDatabaseRetry("migration", () => pool!.query(statement));
  
  try {
    await migrationQuery(`
      ALTER TABLE films ADD COLUMN IF NOT EXISTS territory_percentages jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    console.log('[MIGRATION] Added territory_percentages column');

    // Add skill_fantasy column if it doesn't exist
    await migrationQuery(`
      ALTER TABLE talent ADD COLUMN IF NOT EXISTS skill_fantasy INTEGER NOT NULL DEFAULT 50;
    `);
    console.log('[MIGRATION] Added skill_fantasy column');
    
    // Add skill_musicals column if it doesn't exist
    await migrationQuery(`
      ALTER TABLE talent ADD COLUMN IF NOT EXISTS skill_musicals INTEGER NOT NULL DEFAULT 50;
    `);
    console.log('[MIGRATION] Added skill_musicals column');
    
    // Create co_production_deals table if it doesn't exist
    await migrationQuery(`
      CREATE TABLE IF NOT EXISTS co_production_deals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        player_game_id VARCHAR NOT NULL,
        partner_name TEXT NOT NULL,
        investment_amount BIGINT NOT NULL,
        international_rights_percent INTEGER NOT NULL DEFAULT 100,
        start_week INTEGER NOT NULL,
        start_year INTEGER NOT NULL,
        film_id VARCHAR REFERENCES films(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_used BOOLEAN NOT NULL DEFAULT false
      );
    `);
    console.log('[MIGRATION] Created co_production_deals table');
    
    await migrationQuery(`
      ALTER TABLE films ADD COLUMN IF NOT EXISTS campaign_limit BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE films ADD COLUMN IF NOT EXISTS campaign_spent BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE films ADD COLUMN IF NOT EXISTS campaign_strategy TEXT NOT NULL DEFAULT 'balanced';
      ALTER TABLE films ADD COLUMN IF NOT EXISTS auto_manage_marketing BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE films ADD COLUMN IF NOT EXISTS imax_suitability INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE films ADD COLUMN IF NOT EXISTS dolby_suitability INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE films ADD COLUMN IF NOT EXISTS box_office_model_version INTEGER NOT NULL DEFAULT 2;

      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS awareness REAL NOT NULL DEFAULT 8;
      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS interest REAL NOT NULL DEFAULT 10;
      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS expectation REAL NOT NULL DEFAULT 52;
      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS buzz REAL NOT NULL DEFAULT 0;
      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS paid_reach REAL NOT NULL DEFAULT 0;
      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS opening_expectation REAL;
      ALTER TABLE film_releases ADD COLUMN IF NOT EXISTS weekly_capacity_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

      CREATE TABLE IF NOT EXISTS marketing_actions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        film_id VARCHAR NOT NULL REFERENCES films(id) ON DELETE CASCADE,
        territory_code TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        spend BIGINT NOT NULL,
        response REAL NOT NULL DEFAULT 1,
        reach_gain REAL NOT NULL DEFAULT 0,
        week INTEGER NOT NULL,
        year INTEGER NOT NULL,
        state_after JSONB NOT NULL DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS premium_bookings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        film_id VARCHAR NOT NULL REFERENCES films(id) ON DELETE CASCADE,
        format TEXT NOT NULL,
        territory_code TEXT NOT NULL,
        access_level TEXT NOT NULL,
        start_week INTEGER NOT NULL,
        start_year INTEGER NOT NULL,
        duration_weeks INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'requested',
        fee BIGINT NOT NULL DEFAULT 0
      );
    `);
    console.log('[MIGRATION] Added campaign and premium exhibition tables');

    await migrationQuery(`
      CREATE TABLE IF NOT EXISTS marketplace_script_purchases (
        player_game_id VARCHAR NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
        script_id VARCHAR NOT NULL REFERENCES marketplace_scripts(id) ON DELETE CASCADE,
        purchased_week INTEGER NOT NULL,
        purchased_year INTEGER NOT NULL,
        PRIMARY KEY (player_game_id, script_id)
      );

      UPDATE marketplace_scripts SET is_available = true WHERE is_available = false;
    `);
    console.log('[MIGRATION] Added save-specific marketplace purchases');

    // Talent is a shared catalog, but availability is now derived from each
    // save's own film assignments. Remove historical global busy pointers.
    await migrationQuery(`
      UPDATE talent
      SET current_film_id = NULL, busy_until_week = NULL, busy_until_year = NULL
      WHERE current_film_id IS NOT NULL OR busy_until_week IS NOT NULL OR busy_until_year IS NOT NULL;

      UPDATE studios AS ai
      SET player_game_id = ownership.player_id
      FROM (
        SELECT ai_candidate.id AS ai_id, MIN(player.id) AS player_id
        FROM studios AS ai_candidate
        JOIN studios AS player
          ON player.device_id = ai_candidate.device_id
         AND player.is_ai = false
         AND player.game_session_id IS NULL
        WHERE ai_candidate.is_ai = true
          AND ai_candidate.player_game_id IS NULL
          AND ai_candidate.game_session_id IS NULL
        GROUP BY ai_candidate.id
        HAVING COUNT(player.id) = 1
      ) AS ownership
      WHERE ai.id = ownership.ai_id;

      DELETE FROM award_nominations AS nomination
      USING films AS film, studios AS film_studio, studios AS save_owner
      WHERE nomination.film_id = film.id
        AND film.studio_id = film_studio.id
        AND save_owner.id = COALESCE(film_studio.player_game_id, film_studio.id)
        AND save_owner.game_session_id IS NULL
        AND nomination.player_game_id <> save_owner.id;

      DELETE FROM emails AS record
      WHERE NOT EXISTS (SELECT 1 FROM studios WHERE studios.id = record.player_game_id);
      DELETE FROM award_ceremonies AS record
      WHERE NOT EXISTS (SELECT 1 FROM studios WHERE studios.id = record.player_game_id);
      DELETE FROM slate_financing_deals AS record
      WHERE NOT EXISTS (SELECT 1 FROM studios WHERE studios.id = record.player_game_id);
      DELETE FROM co_production_deals AS record
      WHERE NOT EXISTS (SELECT 1 FROM studios WHERE studios.id = record.player_game_id);
    `);
    console.log('[MIGRATION] Repaired single-player save ownership');
    
  } catch (error) {
    console.error('[MIGRATION] Error running migrations:', error);
    throw error;
  }
}

export { pool };
export const db = drizzleDb!;
