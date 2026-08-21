import assert from "node:assert/strict";
import { MemStorage } from "../server/mem-storage";
import { applySaveTalentAvailability, getSinglePlayerSaveStudios } from "../server/save-scope";

async function main() {
  const storage = new MemStorage();
  const saveA = await storage.createStudio({ deviceId: "device-a", name: "Save A" });
  const saveB = await storage.createStudio({ deviceId: "device-b", name: "Save B" });
  const aiA = await storage.createStudio({
    deviceId: "device-a", name: "AI A", isAI: true, playerGameId: saveA.id,
  });
  const aiB = await storage.createStudio({
    deviceId: "device-b", name: "AI B", isAI: true, playerGameId: saveB.id,
  });
  const actor = await storage.createTalent({ name: "Shared Actor", type: "actor" });
  const filmA = await storage.createFilm({
    studioId: aiA.id,
    title: "Film A",
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
    title: "Film B",
    genre: "comedy",
  });

  const allStudios = await storage.getAllStudios();
  assert.deepEqual(
    new Set(getSinglePlayerSaveStudios(saveA.id, allStudios).map(studio => studio.id)),
    new Set([saveA.id, aiA.id]),
  );
  assert.deepEqual(
    new Set(getSinglePlayerSaveStudios(saveB.id, allStudios).map(studio => studio.id)),
    new Set([saveB.id, aiB.id]),
  );

  const availabilityA = applySaveTalentAvailability([actor], [filmA], 1, 2025)[0];
  const availabilityB = applySaveTalentAvailability([actor], [filmB], 1, 2025)[0];
  assert.equal(availabilityA.currentFilmId, filmA.id);
  assert.equal(availabilityB.currentFilmId, null);

  await storage.createPremiumBooking({
    filmId: filmA.id,
    format: "imax",
    territoryCode: "NA",
    accessLevel: "exclusive",
    startWeek: 10,
    startYear: 2025,
  });
  await storage.createPremiumBooking({
    filmId: filmB.id,
    format: "imax",
    territoryCode: "NA",
    accessLevel: "exclusive",
    startWeek: 10,
    startYear: 2025,
  });
  assert.equal((await storage.getPremiumBookingsByStudioIds([saveA.id, aiA.id])).length, 1);
  assert.equal((await storage.getPremiumBookingsByStudioIds([saveB.id, aiB.id])).length, 1);

  const marketplaceScript = await storage.createMarketplaceScript({
    title: "Shared Script",
    genre: "drama",
    synopsis: "A script shared by the catalog.",
    logline: "One catalog, separate purchases.",
    quality: 75,
    price: 500_000,
    writerName: "Test Writer",
    isAvailable: true,
    estimatedBudget: 20_000_000,
    targetAudience: "general",
    roles: [],
  });
  await storage.createMarketplaceScriptPurchase({
    playerGameId: saveA.id,
    scriptId: marketplaceScript.id,
    purchasedWeek: 1,
    purchasedYear: 2025,
  });
  assert.equal((await storage.getMarketplaceScriptPurchasesByPlayer(saveA.id)).length, 1);
  assert.equal((await storage.getMarketplaceScriptPurchasesByPlayer(saveB.id)).length, 0);

  await storage.deleteSinglePlayerSave(saveA.id);
  assert.equal(await storage.getStudio(saveA.id), undefined);
  assert.equal(await storage.getFilm(filmA.id), undefined);
  assert.ok(await storage.getStudio(saveB.id));
  assert.ok(await storage.getFilm(filmB.id));
  assert.ok(await storage.getTalent(actor.id));
  assert.ok(await storage.getMarketplaceScript(marketplaceScript.id));
  assert.equal((await storage.getMarketplaceScriptPurchasesByPlayer(saveA.id)).length, 0);
  assert.equal((await storage.getPremiumBookingsByStudioIds([saveB.id, aiB.id])).length, 1);

  console.log("Save isolation test passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
