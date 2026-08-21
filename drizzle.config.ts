import { defineConfig } from "drizzle-kit";
import path from "node:path";

const localDatabasePath = process.env.LOCAL_DATA_DIR
  ? path.join(process.env.LOCAL_DATA_DIR, "pglite")
  : "./.local-data/pglite";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: localDatabasePath,
  },
});
