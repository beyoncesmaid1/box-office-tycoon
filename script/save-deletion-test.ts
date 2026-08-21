import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type SeededSave = {
  playerId: string;
  aiId: string;
  filmId: string;
  showId: string;
  seasonId: string;
  ids: Record<string, string>;
};

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-tycoon-deletion-"));
  process.env.LOCAL_DATA_DIR = testRoot;
  const [databaseModule, storageModule, contentModule] = await Promise.all([
    import("../server/db"),
    import("../server/storage"),
    import("../server/content/content-service"),
  ]);
  const { runMigrations, localClient, pool } = databaseModule;
  const { DatabaseStorage } = storageModule;
  const { ensureBundledContent, initializeTalentStateForSave } = contentModule;
  const storage = new DatabaseStorage();

  const count = async (statement: string, parameters: unknown[] = []) => {
    const result = await localClient.query<{ count: string }>(statement, parameters);
    return Number(result.rows[0]?.count || 0);
  };

  try {
    await runMigrations();
    await ensureBundledContent();
    await storage.seedStreamingServices();
    await storage.seedAwardShows();
    await storage.seedMarketplaceScripts();
    const [awardShow] = await storage.getAllAwardShows();
    const [awardCategory] = await storage.getCategoriesByShow(awardShow.id);
    const [marketplaceScript] = await storage.getAllMarketplaceScripts();
    const [baseTalent] = await storage.getAllTalent();
    assert.ok(awardShow && awardCategory && marketplaceScript && baseTalent);

    const seedSave = async (label: string): Promise<SeededSave> => {
      const player = await storage.createStudio({
        id: `player-${label}`,
        deviceId: `device-${label}`,
        name: `Save ${label}`,
        isAI: false,
      } as any);
      await initializeTalentStateForSave(player.id);
      const ai = await storage.createStudio({
        id: `ai-${label}`,
        deviceId: `device-${label}`,
        name: `AI ${label}`,
        isAI: true,
        playerGameId: player.id,
      } as any);
      const film = await storage.createFilm({
        id: `film-${label}`,
        studioId: ai.id,
        title: `Film ${label}`,
        genre: "drama",
        directorId: baseTalent.id,
      } as any);
      const ids = Object.fromEntries([
        "release", "marketing", "booking", "milestone", "role", "streaming",
        "email", "nomination", "ceremony", "franchise", "episode", "tvDeal",
        "slate", "coProduction",
      ].map(name => [name, `${name}-${label}`]));
      const showId = `show-${label}`;
      const seasonId = `season-${label}`;

      await localClient.query(
        `INSERT INTO film_releases (id, film_id, territory_code, release_week, release_year)
         VALUES ($1, $2, 'NA', 1, 2025)`,
        [ids.release, film.id],
      );
      await localClient.query(
        `INSERT INTO marketing_actions (id, film_id, territory_code, action_kind, spend, week, year)
         VALUES ($1, $2, 'NA', 'trailer', 1000, 1, 2025)`,
        [ids.marketing, film.id],
      );
      await localClient.query(
        `INSERT INTO premium_bookings (id, film_id, format, territory_code, access_level, start_week, start_year)
         VALUES ($1, $2, 'imax', 'NA', 'standard', 1, 2025)`,
        [ids.booking, film.id],
      );
      await localClient.query(
        `INSERT INTO film_milestones (id, film_id, milestone_id) VALUES ($1, $2, 'concept')`,
        [ids.milestone, film.id],
      );
      await localClient.query(
        `INSERT INTO film_roles (id, film_id, role_name, actor_id, is_cast)
         VALUES ($1, $2, 'Lead', $3, true)`,
        [ids.role, film.id, baseTalent.id],
      );
      await localClient.query(
        `INSERT INTO streaming_deals (id, film_id, streaming_service_id, player_game_id, start_week, start_year)
         VALUES ($1, $2, 'streamflix', $3, 1, 2025)`,
        [ids.streaming, film.id, ai.id],
      );
      await localClient.query(
        `INSERT INTO emails (id, player_game_id, type, subject, sender, body, sent_week, sent_year)
         VALUES ($1, $2, 'general', 'Test', 'Test', 'Test', 1, 2025)`,
        [ids.email, player.id],
      );
      await localClient.query(
        `INSERT INTO award_nominations
         (id, player_game_id, award_show_id, category_id, film_id, ceremony_year, announced_week, announced_year)
         VALUES ($1, $2, $3, $4, $5, 2025, 1, 2025)`,
        [ids.nomination, player.id, awardShow.id, awardCategory.id, film.id],
      );
      await localClient.query(
        `INSERT INTO award_ceremonies (id, player_game_id, award_show_id, ceremony_year)
         VALUES ($1, $2, $3, 2025)`,
        [ids.ceremony, player.id, awardShow.id],
      );
      await localClient.query(
        `INSERT INTO franchises (id, studio_id, name, original_film_id)
         VALUES ($1, $2, $3, $4)`,
        [ids.franchise, ai.id, `Franchise ${label}`, film.id],
      );
      await localClient.query("UPDATE films SET franchise_id = $1 WHERE id = $2", [ids.franchise, film.id]);
      await localClient.query(
        `INSERT INTO marketplace_script_purchases (player_game_id, script_id, purchased_week, purchased_year)
         VALUES ($1, $2, 1, 2025)`,
        [player.id, marketplaceScript.id],
      );
      await localClient.query(
        `INSERT INTO tv_shows (id, studio_id, title, genre) VALUES ($1, $2, $3, 'drama')`,
        [showId, ai.id, `Show ${label}`],
      );
      await localClient.query(
        `INSERT INTO tv_seasons (id, tv_show_id, season_number) VALUES ($1, $2, 1)`,
        [seasonId, showId],
      );
      await localClient.query(
        `INSERT INTO tv_episodes (id, tv_season_id, tv_show_id, episode_number)
         VALUES ($1, $2, $3, 1)`,
        [ids.episode, seasonId, showId],
      );
      await localClient.query(
        `INSERT INTO tv_deals (id, tv_show_id, player_game_id, start_week, start_year)
         VALUES ($1, $2, $3, 1, 2025)`,
        [ids.tvDeal, showId, ai.id],
      );
      await localClient.query(
        `INSERT INTO slate_financing_deals
         (id, player_game_id, investor_name, investment_amount, start_week, start_year)
         VALUES ($1, $2, 'Investor', 1000, 1, 2025)`,
        [ids.slate, player.id],
      );
      await localClient.query(
        `INSERT INTO co_production_deals
         (id, player_game_id, partner_name, investment_amount, start_week, start_year, film_id)
         VALUES ($1, $2, 'Partner', 1000, 1, 2025, $3)`,
        [ids.coProduction, player.id, film.id],
      );
      return { playerId: player.id, aiId: ai.id, filmId: film.id, showId, seasonId, ids };
    };

    const saveA = await seedSave("a");
    const saveB = await seedSave("b");
    const globalBefore = {
      talent: await count("SELECT count(*)::text AS count FROM talent"),
      services: await count("SELECT count(*)::text AS count FROM streaming_services"),
      awardShows: await count("SELECT count(*)::text AS count FROM award_shows"),
      awardCategories: await count("SELECT count(*)::text AS count FROM award_categories"),
      scripts: await count("SELECT count(*)::text AS count FROM marketplace_scripts"),
      contentState: await count("SELECT count(*)::text AS count FROM content_state"),
    };

    const deletion = await storage.deleteSinglePlayerSave(saveA.playerId);
    assert.equal(deletion.deletedStudios, 2);
    assert.equal(deletion.deletedFilms, 1);
    assert.equal(deletion.deletedTVShows, 1);
    for (const tableName of [
      "studios", "films", "tv_shows", "tv_seasons", "tv_episodes", "tv_deals",
      "film_releases", "marketing_actions", "premium_bookings", "film_milestones",
      "film_roles", "streaming_deals", "emails", "award_nominations",
      "award_ceremonies", "franchises", "slate_financing_deals",
      "co_production_deals", "marketplace_script_purchases", "save_talent_state",
    ]) {
      assert.ok(tableName in deletion.deletedRows || ["tv_seasons", "tv_episodes"].includes(tableName));
    }
    assert.equal(await count("SELECT count(*)::text AS count FROM studios WHERE id = ANY($1::varchar[])", [[saveA.playerId, saveA.aiId]]), 0);
    assert.equal(await count("SELECT count(*)::text AS count FROM films WHERE id = $1", [saveA.filmId]), 0);
    assert.equal(await count("SELECT count(*)::text AS count FROM tv_shows WHERE id = $1", [saveA.showId]), 0);
    assert.equal(await count("SELECT count(*)::text AS count FROM save_talent_state WHERE player_game_id = $1", [saveA.playerId]), 0);
    assert.equal(await count("SELECT count(*)::text AS count FROM marketplace_script_purchases WHERE player_game_id = $1", [saveA.playerId]), 0);

    assert.equal(await count("SELECT count(*)::text AS count FROM studios WHERE id = ANY($1::varchar[])", [[saveB.playerId, saveB.aiId]]), 2);
    assert.equal(await count("SELECT count(*)::text AS count FROM films WHERE id = $1", [saveB.filmId]), 1);
    assert.equal(await count("SELECT count(*)::text AS count FROM tv_shows WHERE id = $1", [saveB.showId]), 1);
    assert.equal(await count("SELECT count(*)::text AS count FROM save_talent_state WHERE player_game_id = $1", [saveB.playerId]), globalBefore.talent);
    assert.deepEqual({
      talent: await count("SELECT count(*)::text AS count FROM talent"),
      services: await count("SELECT count(*)::text AS count FROM streaming_services"),
      awardShows: await count("SELECT count(*)::text AS count FROM award_shows"),
      awardCategories: await count("SELECT count(*)::text AS count FROM award_categories"),
      scripts: await count("SELECT count(*)::text AS count FROM marketplace_scripts"),
      contentState: await count("SELECT count(*)::text AS count FROM content_state"),
    }, globalBefore);
    await assert.rejects(() => storage.deleteSinglePlayerSave(saveA.playerId), /not found/);

    const saveC = await seedSave("c");
    const saveD = await seedSave("d");
    await localClient.query(
      `INSERT INTO franchises (id, studio_id, name, original_film_id)
       VALUES ('cross-save-franchise', $1, 'Cross Save', $2)`,
      [saveD.aiId, saveC.filmId],
    );
    await assert.rejects(
      () => storage.deleteSinglePlayerSave(saveC.playerId),
      /cross-save film reference/,
    );
    assert.equal(await count("SELECT count(*)::text AS count FROM studios WHERE id = $1", [saveC.playerId]), 1);
    assert.equal(await count("SELECT count(*)::text AS count FROM films WHERE id = $1", [saveC.filmId]), 1);
    assert.equal(await count("SELECT count(*)::text AS count FROM emails WHERE player_game_id = $1", [saveC.playerId]), 1);

    await localClient.query("DELETE FROM franchises WHERE id = 'cross-save-franchise'");
    for (const save of [saveB, saveC, saveD]) await storage.deleteSinglePlayerSave(save.playerId);
    console.log("Complete save deletion, isolation, verification, and rollback tests passed");
  } finally {
    await pool.end();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
