import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(
  url: string,
  child: ChildProcess,
  output: string[],
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Local server exited with ${child.exitCode}\n${output.join("")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for local server");
}

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-tycoon-runtime-"));
  const port = await availablePort();
  let contentRequests = 0;
  const manifest = await fs.readFile(
    path.join(process.cwd(), "shared", "content", "content-manifest.json"), "utf8",
  );
  const contentServer = http.createServer((_request, response) => {
    contentRequests += 1;
    response.setHeader("content-type", "application/json");
    response.end(manifest);
  });
  await new Promise<void>(resolve => contentServer.listen(0, "127.0.0.1", resolve));
  const contentAddress = contentServer.address();
  assert.ok(contentAddress && typeof contentAddress === "object");
  const output: string[] = [];
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist", "index.cjs")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      LOCAL_DATA_DIR: testRoot,
      CONTENT_MANIFEST_URL: `http://127.0.0.1:${contentAddress.port}/manifest.json`,
      DATABASE_URL: "postgresql://invalid.invalid:5432/must-not-be-used",
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const capture = (chunk: Buffer) => {
    const text = chunk.toString();
    output.push(text);
    if (process.env.VERBOSE_LOCAL_RUNTIME_TEST === "1") process.stdout.write(text);
    if (output.length > 300) output.shift();
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(`${baseUrl}/api/content/status`, child, output);
    await new Promise(resolve => setTimeout(resolve, 250));
    const initialSaves = await fetch(`${baseUrl}/api/saves?deviceId=local-runtime-test`).then(r => r.json());
    assert.deepEqual(initialSaves, []);
    assert.equal(contentRequests, 1, "Launch should perform only the background content manifest check");

    const createResponse = await fetch(`${baseUrl}/api/studio/new`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Local Runtime Test", deviceId: "local-runtime-test" }),
    });
    assert.equal(createResponse.status, 201);
    const studio = await createResponse.json();
    const saveTalent = await fetch(`${baseUrl}/api/talent?playerGameId=${studio.id}`).then(r => r.json());
    assert.equal(saveTalent.length, 361);

    const preloadStart = performance.now();
    const preloadResponse = await fetch(`${baseUrl}/api/studio/${studio.id}/preload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weeks: 52 }),
    });
    const preloadMs = performance.now() - preloadStart;
    assert.equal(preloadResponse.status, 200);

    const weekStart = performance.now();
    const weekResponse = await fetch(`${baseUrl}/api/studio/${studio.id}/advance-week`, { method: "POST" });
    const nextWeekMs = performance.now() - weekStart;
    assert.equal(weekResponse.status, 200);
    assert.ok(nextWeekMs < 3_000, `Next Week took ${nextWeekMs.toFixed(0)}ms`);
    assert.equal(contentRequests, 1, "Simulation must not make remote content or database requests");

    const deleteResponse = await fetch(`${baseUrl}/api/studio/${studio.id}`, { method: "DELETE" });
    assert.equal(deleteResponse.status, 200);
    const deleteResult = await deleteResponse.json();
    assert.equal(deleteResult.deletion.playerStudioId, studio.id);
    assert.equal(deleteResult.deletion.deletedStudios, 8);
    assert.ok(deleteResult.deletion.deletedFilms > 0);
    const savesAfterDelete = await fetch(`${baseUrl}/api/saves?deviceId=local-runtime-test`).then(r => r.json());
    assert.deepEqual(savesAfterDelete, []);
    const baseTalentAfterDelete = await fetch(`${baseUrl}/api/talent`).then(r => r.json());
    assert.equal(baseTalentAfterDelete.length, 361, "Deleting a save must preserve base content");
    assert.equal((await fetch(`${baseUrl}/api/studio/${studio.id}`, { method: "DELETE" })).status, 404);
    await new Promise(resolve => setTimeout(resolve, 400));

    const combinedOutput = output.join("");
    assert.ok(combinedOutput.includes("Remote DATABASE_URL is ignored"));
    assert.ok(!combinedOutput.includes("ECONNREFUSED"));
    assert.ok(!combinedOutput.includes("ECONNRESET"));
    assert.ok(!combinedOutput.includes(`[WEEK-CACHE] Could not warm ${studio.id}`));
    console.log(`Local runtime integration passed: preload ${preloadMs.toFixed(0)}ms, Next Week ${nextWeekMs.toFixed(0)}ms`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      new Promise(resolve => setTimeout(resolve, 3_000)),
    ]);
    if (child.exitCode === null && child.signalCode === null) {
      const forceExit = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGKILL");
      await forceExit;
    }
    contentServer.close();
    contentServer.closeAllConnections();
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  error => {
    console.error(error);
    process.exit(1);
  },
);
