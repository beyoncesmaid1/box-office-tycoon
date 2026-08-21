import os from "node:os";
import path from "node:path";

const productDirectoryName = "Film Studio Simulator";

export function getLocalDataRoot(): string {
  if (process.env.LOCAL_DATA_DIR) return path.resolve(process.env.LOCAL_DATA_DIR);
  if (process.env.ELECTRON_USER_DATA_DIR) {
    return path.join(process.env.ELECTRON_USER_DATA_DIR, "game-data");
  }
  const platformRoot = process.env.LOCALAPPDATA || process.env.APPDATA ||
    path.join(os.homedir(), ".local", "share");
  return path.join(platformRoot, productDirectoryName, "game-data");
}

export function getLocalDatabaseDirectory(): string {
  return path.join(getLocalDataRoot(), "pglite");
}

export function getContentCacheDirectory(): string {
  return path.join(getLocalDataRoot(), "content-cache");
}

export function getMigrationsDirectory(): string {
  return process.env.MIGRATIONS_DIR
    ? path.resolve(process.env.MIGRATIONS_DIR)
    : path.join(process.cwd(), "migrations");
}

export function getBundledContentDirectory(): string {
  return process.env.CONTENT_DIR
    ? path.resolve(process.env.CONTENT_DIR)
    : path.join(process.cwd(), "shared", "content");
}
