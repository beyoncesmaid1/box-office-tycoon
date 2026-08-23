import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-tycoon-content-"));
  process.env.LOCAL_DATA_DIR = testRoot;
  const { runMigrations, pool } = await import("../server/db");
  const {
    applyContentBundle,
    checkForRemoteContentUpdates,
    ensureBundledContent,
    getContentStatus,
    initializeTalentStateForSave,
  } = await import("../server/content/content-service");
  const { DatabaseStorage } = await import("../server/storage");
  const { baseContentSchema } = await import("../server/content/content-schema");
  const bundled = baseContentSchema.parse(JSON.parse(
    await fs.readFile(path.join(process.cwd(), "shared", "content", "base-content.json"), "utf8"),
  ));
  const storage = new DatabaseStorage();
  const bundledVersion = bundled.contentVersion;
  const updateVersion = bundledVersion + 1;
  const rollbackVersion = updateVersion + 1;
  let responseManifest = "";
  let responseContent = "";
  const server = http.createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(request.url === "/manifest.json" ? responseManifest : responseContent);
  });

  try {
    await runMigrations();
    await ensureBundledContent();
    assert.equal((await getContentStatus()).localContentVersion, bundledVersion);
    assert.equal((await storage.getAllTalent()).length, bundled.talent.length);
    assert.ok((await storage.getAllTalent()).every(person => person.id.startsWith("talent-")));

    const save = await storage.createStudio({ deviceId: "content-test", name: "Content Test Save" });
    await initializeTalentStateForSave(save.id);
    const original = (await storage.getAllTalentForSave(save.id))[0];
    const originalState = (await storage.getTalentStateForSave(save.id))
      .find(state => state.talentId === original.id)!;
    await storage.upsertTalentStateForSave({ ...originalState, fame: 7 });

    const addedTalent = {
      ...bundled.talent[0],
      id: "talent-actor-content-update-test",
      name: "Content Update Test Actor",
      type: "actor" as const,
      fame: 44,
    };
    const versionTwo = {
      ...bundled,
      contentVersion: updateVersion,
      talent: [
        { ...bundled.talent[0], name: `${bundled.talent[0].name} Corrected` },
        ...bundled.talent.slice(1),
        addedTalent,
      ],
    };
    responseContent = `${JSON.stringify(versionTwo, null, 2)}\n`;
    const hash = crypto.createHash("sha256").update(responseContent).digest("hex");
    responseManifest = JSON.stringify({
      contentVersion: updateVersion,
      schemaVersion: 1,
      contentFile: "content.json",
      sha256: hash,
      talentCount: versionTwo.talent.length,
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    process.env.CONTENT_MANIFEST_URL = `http://127.0.0.1:${address.port}/manifest.json`;

    const updateResult = await checkForRemoteContentUpdates();
    assert.equal(updateResult.applied, true);
    assert.equal(updateResult.version, updateVersion);
    assert.equal((await storage.getTalent(original.id))?.name, versionTwo.talent[0].name);
    assert.equal((await storage.getTalentForSave(original.id, save.id))?.fame, 7);
    assert.ok(await storage.getTalent(addedTalent.id));
    const addedState = (await storage.getTalentStateForSave(save.id))
      .find(state => state.talentId === addedTalent.id);
    assert.equal(addedState?.fame, 44);
    assert.equal((await checkForRemoteContentUpdates()).applied, false);

    const rollbackContent = structuredClone(versionTwo);
    rollbackContent.contentVersion = rollbackVersion;
    rollbackContent.talent[0].name = "This Must Roll Back";
    rollbackContent.talent[1].askingPrice = 5_000_000_000;
    await assert.rejects(() => applyContentBundle(rollbackContent, {
      contentVersion: rollbackVersion,
      schemaVersion: 1,
      contentFile: "content.json",
      sha256: "a".repeat(64),
      talentCount: rollbackContent.talent.length,
    }, "rollback-test"));
    assert.equal((await getContentStatus()).localContentVersion, updateVersion);
    assert.equal((await storage.getTalent(original.id))?.name, versionTwo.talent[0].name);

    responseContent = JSON.stringify({ corrupted: true });
    responseManifest = JSON.stringify({
      contentVersion: rollbackVersion,
      schemaVersion: 1,
      contentFile: "content.json",
      sha256: crypto.createHash("sha256").update(responseContent).digest("hex"),
      talentCount: 1,
    });
    const corruptResult = await checkForRemoteContentUpdates();
    assert.ok(corruptResult.error);
    assert.equal((await getContentStatus()).localContentVersion, updateVersion);

    await new Promise<void>(resolve => server.close(() => resolve()));
    const offlineResult = await checkForRemoteContentUpdates();
    assert.ok(offlineResult.error);
    assert.equal((await getContentStatus()).localContentVersion, updateVersion);
    console.log("Content update and offline rollback tests passed");
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
