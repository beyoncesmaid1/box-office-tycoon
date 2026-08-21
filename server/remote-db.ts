import pg from "pg";

// Retained for future multiplayer work. Single-player startup and simulation
// never call this module.
export function createRemoteMultiplayerPool(): InstanceType<typeof pg.Pool> {
  const connectionString = process.env.MULTIPLAYER_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("MULTIPLAYER_DATABASE_URL is not configured");
  }
  return new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    max: 10,
  });
}
