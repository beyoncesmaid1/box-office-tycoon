import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@shared/schema";
import { getLocalDatabaseDirectory, getMigrationsDirectory } from "./local-data";

export const hasDatabase = true;
export const isLocalDatabase = true;
export const localDatabaseDirectory = getLocalDatabaseDirectory();

fs.mkdirSync(localDatabaseDirectory, { recursive: true });

export const localClient = new PGlite(localDatabaseDirectory);
export const db = drizzle({ client: localClient, schema });

type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number;
};

async function queryLocal<Row = Record<string, unknown>>(
  statement: string,
  parameters: unknown[] = [],
): Promise<QueryResult<Row>> {
  const result = await localClient.query<Row>(statement, parameters);
  return {
    rows: result.rows,
    rowCount: result.affectedRows || result.rows.length,
  };
}

// Compatibility surface for optimized raw SQL paths in DatabaseStorage. This
// is an embedded local client and never opens a network connection.
export const pool = {
  query: queryLocal,
  async connect() {
    return {
      query: queryLocal,
      release() {},
    };
  },
  async end() {
    await localClient.close();
  },
  on() {},
};

export async function withLocalTransaction<T>(
  operation: (query: typeof queryLocal) => Promise<T>,
): Promise<T> {
  return localClient.transaction(async transaction => {
    const transactionQuery = async <Row = Record<string, unknown>>(
      statement: string,
      parameters: unknown[] = [],
    ): Promise<QueryResult<Row>> => {
      const result = await transaction.query<Row>(statement, parameters);
      return {
        rows: result.rows,
        rowCount: result.affectedRows || result.rows.length,
      };
    };
    return operation(transactionQuery);
  });
}

export async function withDatabaseRetry<T>(
  _label: string,
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
    }
  }
  throw lastError;
}

let migrationPromise: Promise<void> | undefined;

export function runMigrations(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const migrationsFolder = getMigrationsDirectory();
      if (!fs.existsSync(migrationsFolder)) {
        throw new Error(`Local migrations directory was not found: ${migrationsFolder}`);
      }
      await migrate(db, { migrationsFolder });
      console.log(`[LOCAL DB] Ready at ${localDatabaseDirectory}`);
    })().catch(error => {
      migrationPromise = undefined;
      throw error;
    });
  }
  return migrationPromise;
}
