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
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
  });
  drizzleDb = drizzle({ client: pool, schema });
  
  // Log pool errors
  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err);
  });
  
  console.log('[DB] PostgreSQL connection pool initialized');
}

export { pool };
export const db = drizzleDb!;
