import pg from "pg";
const { Pool } = pg;
type PoolType = InstanceType<typeof Pool>;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export const hasDatabase = !!process.env.DATABASE_URL;

let pool: PoolType | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

if (hasDatabase) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  drizzleDb = drizzle({ client: pool, schema });
}

// Run manual migrations for new columns
export async function runMigrations(): Promise<void> {
  if (!pool) return;
  
  try {
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
    
  } catch (error) {
    console.error('[MIGRATION] Error running migrations:', error);
  }
}

export { pool };
export const db = drizzleDb!;
