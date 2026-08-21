import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applySaveTalentAvailability } from "../server/save-scope";

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-tycoon-isolation-"));
  process.env.LOCAL_DATA_DIR = testRoot;
  const [{ runMigrations, pool }, { DatabaseStorage }, { ensureBundledContent }] = await Promise.all([
    import("../server/db"),
    import("../server/storage"),
    import("../server/content/content-service"),
  ]);
  await runMigrations();
  await ensureBundledContent();
  const storage = new DatabaseStorage();
  const marker = `isolation-${Date.now()}`;
  let saveAId: string | undefined;
  let saveBId: string | undefined;

  try {
    const saveA = await storage.createStudio({ deviceId: `${marker}-a`, name: "Isolation Save A" });
    const saveB = await storage.createStudio({ deviceId: `${marker}-b`, name: "Isolation Save B" });
    saveAId = saveA.id;
    saveBId = saveB.id;
    const aiA = await storage.createStudio({
      deviceId: `${marker}-a`, name: "Isolation AI A", isAI: true, playerGameId: saveA.id,
    });
    const aiB = await storage.createStudio({
      deviceId: `${marker}-b`, name: "Isolation AI B", isAI: true, playerGameId: saveB.id,
    });
    const actor = (await storage.getAllTalent())[0];
    assert.ok(actor, "The shared talent catalog must be seeded");

    const filmA = await storage.createFilm({
      studioId: aiA.id,
      title: "Isolation Film A",
      genre: "drama",
      castIds: [actor.id],
      createdAtWeek: 1,
      createdAtYear: 2025,
      developmentDurationWeeks: 2,
      preProductionDurationWeeks: 2,
      productionDurationWeeks: 8,
    });
    const filmB = await storage.createFilm({
      studioId: aiB.id,
      title: "Isolation Film B",
      genre: "comedy",
    });
    assert.equal(
      applySaveTalentAvailability([actor], [filmA], 1, 2025)[0].currentFilmId,
      filmA.id,
    );
    assert.equal(
      applySaveTalentAvailability([actor], [filmB], 1, 2025)[0].currentFilmId,
      null,
    );

    await storage.createPremiumBooking({
      filmId: filmA.id, format: "imax", territoryCode: "NA", accessLevel: "exclusive",
      startWeek: 10, startYear: 2025,
    });
    await storage.createPremiumBooking({
      filmId: filmB.id, format: "imax", territoryCode: "NA", accessLevel: "exclusive",
      startWeek: 10, startYear: 2025,
    });
    assert.equal((await storage.getPremiumBookingsByStudioIds([saveA.id, aiA.id])).length, 1);
    assert.equal((await storage.getPremiumBookingsByStudioIds([saveB.id, aiB.id])).length, 1);

    await storage.seedMarketplaceScripts();
    const script = (await storage.getAllMarketplaceScripts())[0];
    assert.ok(script, "The marketplace catalog must be seeded");
    await storage.createMarketplaceScriptPurchase({
      playerGameId: saveA.id,
      scriptId: script.id,
      purchasedWeek: 1,
      purchasedYear: 2025,
    });
    assert.equal((await storage.getMarketplaceScriptPurchasesByPlayer(saveA.id)).length, 1);
    assert.equal((await storage.getMarketplaceScriptPurchasesByPlayer(saveB.id)).length, 0);

    await storage.deleteSinglePlayerSave(saveA.id);
    saveAId = undefined;
    assert.equal(await storage.getStudio(saveA.id), undefined);
    assert.ok(await storage.getStudio(saveB.id));
    assert.ok(await storage.getFilm(filmB.id));
    assert.ok(await storage.getTalent(actor.id));
    assert.ok(await storage.getMarketplaceScript(script.id));
    assert.equal((await storage.getPremiumBookingsByStudioIds([saveB.id, aiB.id])).length, 1);

    console.log("Database save isolation test passed");
  } finally {
    for (const saveId of [saveAId, saveBId]) {
      if (!saveId) continue;
      try {
        if (await storage.getStudio(saveId)) await storage.deleteSinglePlayerSave(saveId);
      } catch (error) {
        console.error(`Failed to clean disposable save ${saveId}:`, error);
      }
    }
    await pool.end();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
