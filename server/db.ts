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

export { pool };
export const db = drizzleDb!;
