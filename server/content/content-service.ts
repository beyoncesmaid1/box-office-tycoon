import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import {
  contentState,
  contentUpdateHistory,
  saveTalentState,
  studios,
  talent,
  type Talent,
} from "@shared/schema";
import { db } from "../db";
import { getBundledContentDirectory, getContentCacheDirectory } from "../local-data";
import {
  baseContentSchema,
  contentManifestSchema,
  type BaseContent,
  type ContentManifest,
} from "./content-schema";

const stateId = "base-content";
const defaultManifestUrl =
  "https://raw.githubusercontent.com/beyoncesmaid1/box-office-tycoon/recovered-filterfix/shared/content/content-manifest.json";

export type ContentStatus = {
  localContentVersion: number;
  contentSchemaVersion: number;
  contentHash: string | null;
  source: string;
  lastCheckedAt: number | null;
  lastAppliedAt: number | null;
  lastError: string | null;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asTalentRow(person: BaseContent["talent"][number]) {
  return {
    ...person,
    currentFilmId: null,
    busyUntilWeek: null,
    busyUntilYear: null,
  };
}

const talentUpdateFields = (row: ReturnType<typeof asTalentRow>) => ({
  name: row.name,
  type: row.type,
  gender: row.gender,
  nationality: row.nationality,
  starRating: row.starRating,
  askingPrice: row.askingPrice,
  boxOfficeAvg: row.boxOfficeAvg,
  awards: row.awards,
  genres: row.genres,
  genreTags: row.genreTags,
  isActive: row.isActive,
  imageUrl: row.imageUrl,
  birthYear: row.birthYear,
  popularity: row.popularity,
  performance: row.performance,
  experience: row.experience,
  fame: row.fame,
  skillAction: row.skillAction,
  skillDrama: row.skillDrama,
  skillComedy: row.skillComedy,
  skillThriller: row.skillThriller,
  skillHorror: row.skillHorror,
  skillScifi: row.skillScifi,
  skillAnimation: row.skillAnimation,
  skillRomance: row.skillRomance,
  skillFantasy: row.skillFantasy,
  skillMusicals: row.skillMusicals,
  skillCinematography: row.skillCinematography,
  skillEditing: row.skillEditing,
  skillOrchestral: row.skillOrchestral,
  skillElectronic: row.skillElectronic,
});

export async function getContentStatus(): Promise<ContentStatus> {
  const [state] = await db.select().from(contentState).where(eq(contentState.id, stateId));
  return state || {
    localContentVersion: 0,
    contentSchemaVersion: 1,
    contentHash: null,
    source: "none",
    lastCheckedAt: null,
    lastAppliedAt: null,
    lastError: null,
  };
}

export async function initializeTalentStateForSave(playerGameId: string): Promise<void> {
  const status = await getContentStatus();
  await db.execute(sql`
    INSERT INTO save_talent_state (
      player_game_id, talent_id, star_rating, asking_price, box_office_avg, awards,
      popularity, performance, experience, fame, skill_action, skill_drama,
      skill_comedy, skill_thriller, skill_horror, skill_scifi, skill_animation,
      skill_romance, skill_fantasy, skill_musicals, skill_cinematography,
      skill_editing, skill_orchestral, skill_electronic, is_active,
      initialized_content_version
    )
    SELECT ${playerGameId}, id, star_rating, asking_price, box_office_avg, awards,
      popularity, performance, experience, fame, skill_action, skill_drama,
      skill_comedy, skill_thriller, skill_horror, skill_scifi, skill_animation,
      skill_romance, skill_fantasy, skill_musicals, skill_cinematography,
      skill_editing, skill_orchestral, skill_electronic, is_active,
      ${status.localContentVersion}
    FROM talent
    ON CONFLICT (player_game_id, talent_id) DO NOTHING
  `);
}

export async function applyContentBundle(
  content: BaseContent,
  manifest: ContentManifest,
  source: string,
): Promise<{ applied: boolean; version: number; talentCount: number }> {
  if (content.contentVersion !== manifest.contentVersion ||
      content.schemaVersion !== manifest.schemaVersion ||
      content.talent.length !== manifest.talentCount) {
    throw new Error("Content manifest does not match the downloaded content");
  }
  const current = await getContentStatus();
  if (manifest.contentVersion <= current.localContentVersion) {
    return { applied: false, version: current.localContentVersion, talentCount: content.talent.length };
  }

  try {
    await db.transaction(async transaction => {
      for (let index = 0; index < content.talent.length; index += 75) {
        const rows = content.talent.slice(index, index + 75).map(asTalentRow);
        for (const row of rows) {
          await transaction.insert(talent).values(row).onConflictDoUpdate({
            target: talent.id,
            set: talentUpdateFields(row),
          });
        }
      }

      await transaction.execute(sql`
        INSERT INTO save_talent_state (
          player_game_id, talent_id, star_rating, asking_price, box_office_avg, awards,
          popularity, performance, experience, fame, skill_action, skill_drama,
          skill_comedy, skill_thriller, skill_horror, skill_scifi, skill_animation,
          skill_romance, skill_fantasy, skill_musicals, skill_cinematography,
          skill_editing, skill_orchestral, skill_electronic, is_active,
          initialized_content_version
        )
        SELECT studios.id, talent.id, talent.star_rating, talent.asking_price,
          talent.box_office_avg, talent.awards, talent.popularity, talent.performance,
          talent.experience, talent.fame, talent.skill_action, talent.skill_drama,
          talent.skill_comedy, talent.skill_thriller, talent.skill_horror,
          talent.skill_scifi, talent.skill_animation, talent.skill_romance,
          talent.skill_fantasy, talent.skill_musicals, talent.skill_cinematography,
          talent.skill_editing, talent.skill_orchestral, talent.skill_electronic,
          talent.is_active, ${manifest.contentVersion}
        FROM studios CROSS JOIN talent
        WHERE studios.is_ai = false AND studios.game_session_id IS NULL
        ON CONFLICT (player_game_id, talent_id) DO NOTHING
      `);

      const now = Math.floor(Date.now() / 1000);
      await transaction.insert(contentState).values({
        id: stateId,
        localContentVersion: manifest.contentVersion,
        contentSchemaVersion: manifest.schemaVersion,
        contentHash: manifest.sha256,
        source,
        lastCheckedAt: now,
        lastAppliedAt: now,
        lastError: null,
      }).onConflictDoUpdate({
        target: contentState.id,
        set: {
          localContentVersion: manifest.contentVersion,
          contentSchemaVersion: manifest.schemaVersion,
          contentHash: manifest.sha256,
          source,
          lastCheckedAt: now,
          lastAppliedAt: now,
          lastError: null,
        },
      });
      await transaction.insert(contentUpdateHistory).values({
        fromVersion: current.localContentVersion,
        toVersion: manifest.contentVersion,
        contentHash: manifest.sha256,
        source,
        status: "applied",
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(contentUpdateHistory).values({
      fromVersion: current.localContentVersion,
      toVersion: manifest.contentVersion,
      contentHash: manifest.sha256,
      source,
      status: "rolled-back",
      error: message,
    });
    throw error;
  }

  return { applied: true, version: manifest.contentVersion, talentCount: content.talent.length };
}

async function parseContentFiles(
  manifestText: string,
  contentText: string,
): Promise<{ manifest: ContentManifest; content: BaseContent }> {
  const manifest = contentManifestSchema.parse(JSON.parse(manifestText));
  if (sha256(contentText) !== manifest.sha256) {
    throw new Error("Content checksum validation failed");
  }
  const content = baseContentSchema.parse(JSON.parse(contentText));
  return { manifest, content };
}

export async function ensureBundledContent(): Promise<void> {
  const directory = getBundledContentDirectory();
  const manifestText = await fs.readFile(path.join(directory, "content-manifest.json"), "utf8");
  const manifest = contentManifestSchema.parse(JSON.parse(manifestText));
  const contentText = await fs.readFile(path.join(directory, manifest.contentFile), "utf8");
  const parsed = await parseContentFiles(manifestText, contentText);
  await applyContentBundle(parsed.content, parsed.manifest, "bundled");
}

async function fetchText(url: string, timeoutMs = 4_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Box-Office-Tycoon-Content-Updater" },
    });
    if (!response.ok) throw new Error(`Content server returned HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkForRemoteContentUpdates(): Promise<{
  checked: boolean;
  applied: boolean;
  version: number;
  talentCount?: number;
  error?: string;
}> {
  const manifestUrl = process.env.CONTENT_MANIFEST_URL || defaultManifestUrl;
  const current = await getContentStatus();
  try {
    const manifestText = await fetchText(manifestUrl);
    const manifest = contentManifestSchema.parse(JSON.parse(manifestText));
    const now = Math.floor(Date.now() / 1000);
    if (manifest.contentVersion <= current.localContentVersion) {
      await db.update(contentState).set({ lastCheckedAt: now, lastError: null })
        .where(eq(contentState.id, stateId));
      return { checked: true, applied: false, version: current.localContentVersion };
    }

    const contentUrl = new URL(manifest.contentFile, manifestUrl).toString();
    const contentText = await fetchText(contentUrl);
    const parsed = await parseContentFiles(manifestText, contentText);
    const result = await applyContentBundle(parsed.content, parsed.manifest, manifestUrl);

    const cacheDirectory = getContentCacheDirectory();
    await fs.mkdir(cacheDirectory, { recursive: true });
    const cachePath = path.join(cacheDirectory, `content-${manifest.contentVersion}.json`);
    const temporaryPath = `${cachePath}.tmp`;
    await fs.writeFile(temporaryPath, contentText, "utf8");
    await fs.rename(temporaryPath, cachePath);
    return { checked: true, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(contentState).set({
      lastCheckedAt: Math.floor(Date.now() / 1000),
      lastError: message,
    }).where(eq(contentState.id, stateId));
    return {
      checked: false,
      applied: false,
      version: current.localContentVersion,
      error: message,
    };
  }
}

const stateFieldNames = [
  "starRating", "askingPrice", "boxOfficeAvg", "awards", "popularity",
  "performance", "experience", "fame", "skillAction", "skillDrama",
  "skillComedy", "skillThriller", "skillHorror", "skillScifi",
  "skillAnimation", "skillRomance", "skillFantasy", "skillMusicals",
  "skillCinematography", "skillEditing", "skillOrchestral", "skillElectronic",
  "isActive",
] as const;

export function overlayTalentState(base: Talent, state: typeof saveTalentState.$inferSelect): Talent {
  const result = { ...base };
  for (const field of stateFieldNames) (result as any)[field] = state[field];
  return result;
}
