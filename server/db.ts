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
  
  try {
    await pool.query(`
      ALTER TABLE films ADD COLUMN IF NOT EXISTS territory_percentages jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
    console.log('[MIGRATION] Added territory_percentages column');

    // Add skill_fantasy column if it doesn't exist
    await pool.query(`
      ALTER TABLE talent ADD COLUMN IF NOT EXISTS skill_fantasy INTEGER NOT NULL DEFAULT 50;
    `);
    console.log('[MIGRATION] Added skill_fantasy column');
    
    // Add skill_musicals column if it doesn't exist
    await pool.query(`
      ALTER TABLE talent ADD COLUMN IF NOT EXISTS skill_musicals INTEGER NOT NULL DEFAULT 50;
    `);
    console.log('[MIGRATION] Added skill_musicals column');
    
    // Create co_production_deals table if it doesn't exist
    await pool.query(`
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
    
    await pool.query(`
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
    
  } catch (error) {
    console.error('[MIGRATION] Error running migrations:', error);
    throw error;
  }
}

export { pool };
export const db = drizzleDb!;
