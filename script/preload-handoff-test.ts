import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-tycoon-handoff-"));
  process.env.LOCAL_DATA_DIR = testRoot;
  const [{ runMigrations, pool }, { DatabaseStorage }, content, routes] = await Promise.all([
    import("../server/db"),
    import("../server/storage"),
    import("../server/content/content-service"),
    import("../server/routes"),
  ]);
  const storage = new DatabaseStorage();

  try {
    await runMigrations();
    await content.ensureBundledContent();
    const player = await storage.createStudio({
      id: "handoff-player",
      deviceId: "handoff-device",
      name: "Handoff Test",
      isAI: false,
      currentWeek: 2,
      currentYear: 2026,
    } as any);
    const ai = await storage.createStudio({
      id: "handoff-ai",
      deviceId: "handoff-device",
      name: "Handoff AI",
      isAI: true,
      playerGameId: player.id,
    } as any);
    const originalHistory = [100_000_000, 50_000_000, 25_000_000, 140_000_000];
    const film = await storage.createFilm({
      id: "handoff-film",
      studioId: ai.id,
      title: "Duplicate Opening",
      genre: "drama",
      phase: "released",
      audienceScore: 8.5,
      weeklyBoxOffice: originalHistory,
      totalBoxOffice: originalHistory.reduce((sum, gross) => sum + gross, 0),
      releaseWeek: 50,
      releaseYear: 2025,
    } as any);
    await storage.createFilmReleases([
      {
        filmId: film.id,
        territoryCode: "NA",
        releaseWeek: 50,
        releaseYear: 2025,
        isReleased: true,
        weeklyBoxOffice: [75_000_000],
        totalBoxOffice: 75_000_000,
        weeksInRelease: 1,
      },
      {
        filmId: film.id,
        territoryCode: "CN",
        releaseWeek: 50,
        releaseYear: 2025,
        isReleased: true,
        weeklyBoxOffice: [65_000_000],
        totalBoxOffice: 65_000_000,
        weeksInRelease: 1,
      },
    ]);

    await routes.repairPreloadBoxOfficeHandoffs();
    const repaired = await storage.getFilm(film.id);
    assert.ok(repaired);
    assert.equal(repaired.weeklyBoxOffice.length, originalHistory.length);
    assert.ok(repaired.weeklyBoxOffice[3] < repaired.weeklyBoxOffice[2]);
    assert.equal(
      repaired.totalBoxOffice,
      repaired.weeklyBoxOffice.reduce((sum, gross) => sum + gross, 0),
    );
    const releases = await storage.getFilmReleasesByFilm(film.id);
    assert.ok(releases.every(release =>
      release.weeklyBoxOffice.length === repaired.weeklyBoxOffice.length &&
      release.weeksInRelease === repaired.weeklyBoxOffice.length
    ));
    for (let week = 0; week < repaired.weeklyBoxOffice.length; week += 1) {
      assert.equal(
        releases.reduce((sum, release) => sum + release.weeklyBoxOffice[week], 0),
        repaired.weeklyBoxOffice[week],
      );
    }

    const firstRepair = JSON.stringify(repaired.weeklyBoxOffice);
    await routes.repairPreloadBoxOfficeHandoffs();
    assert.equal(JSON.stringify((await storage.getFilm(film.id))?.weeklyBoxOffice), firstRepair);
    console.log("Preload handoff repair and idempotency tests passed");
  } finally {
    await pool.end();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
