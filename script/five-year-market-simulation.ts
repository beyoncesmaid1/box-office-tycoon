import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
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

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (child.exitCode !== null) throw new Error(`Server exited with ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for simulation server");
}

const money = (value: number) => `$${(value / 1_000_000).toFixed(1)}M`;

async function main() {
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "box-tycoon-five-year-"));
  const port = await availablePort();
  const child = spawn(process.execPath, [path.join(process.cwd(), "dist", "index.cjs")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      LOCAL_DATA_DIR: testRoot,
      CONTENT_MANIFEST_URL: "",
      DATABASE_URL: "",
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.resume();
  child.stderr?.resume();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(`${baseUrl}/api/content/status`, child);
    const createResponse = await fetch(`${baseUrl}/api/studio/new`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Five Year Market Test", deviceId: "five-year-test" }),
    });
    assert.equal(createResponse.status, 201);
    const studio = await createResponse.json() as { id: string };
    const preloadResponse = await fetch(`${baseUrl}/api/studio/${studio.id}/preload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weeks: 52 }),
    });
    assert.equal(preloadResponse.status, 200);

    const startedAt = performance.now();
    for (let week = 0; week < 260; week += 1) {
      const response = await fetch(`${baseUrl}/api/studio/${studio.id}/advance-week`, {
        method: "POST",
      });
      assert.equal(response.status, 200, `Advance Week failed at simulated week ${week + 1}`);
    }

    const films = await fetch(`${baseUrl}/api/all-films/${studio.id}`).then(response => response.json()) as any[];
    const released = films.filter(film => film.phase === "released" && Number(film.totalBoxOffice) > 0);
    const sorted = [...released].sort((left, right) =>
      Number(right.totalBoxOffice || 0) - Number(left.totalBoxOffice || 0));
    const tentpoles = films.filter(film =>
      ["action", "scifi", "fantasy", "animation"].includes(film.genre) &&
      Number(film.productionBudget) >= 170_000_000);
    const milestone = (amount: number) => released.filter(film =>
      Number(film.totalBoxOffice) >= amount).length;
    const eventFilms = released.filter(film =>
      Number(film.boxOfficeBreakdown?.peakEventIntensity || 0) >= 0.1);

    console.log(`Five-year live market completed in ${((performance.now() - startedAt) / 1000).toFixed(1)}s`);
    console.log(
      `Films: ${released.length} released; ${tentpoles.length} tentpoles created; ` +
      `${eventFilms.length} qualified events; ` +
      `max production budget ${money(Math.max(...films.map(film => Number(film.productionBudget || 0))))}`,
    );
    console.log(
      `Milestones: $100M ${milestone(100_000_000)}, $500M ${milestone(500_000_000)}, ` +
      `$1B ${milestone(1_000_000_000)}, $2B ${milestone(2_000_000_000)}`,
    );
    console.log("Top five:");
    for (const film of sorted.slice(0, 5)) {
      console.log(
        `  ${film.title} (${film.genre}) ${money(Number(film.totalBoxOffice))}; ` +
        `production ${money(Number(film.productionBudget))}; ` +
        `critic/audience ${film.criticScore ?? "-"}/${film.audienceScore ?? "-"}; ` +
        `event ${Number(film.boxOfficeBreakdown?.peakEventPotential || 0).toFixed(1)}/` +
        `${Number(film.boxOfficeBreakdown?.peakEventIntensity || 0).toFixed(3)}`,
      );
    }
    console.log("Yearly leaders:");
    const releaseYears = [...new Set(released.map(film => Number(film.releaseYear)))].sort();
    for (const releaseYear of releaseYears) {
      const yearFilms = sorted.filter(film => Number(film.releaseYear) === releaseYear);
      if (yearFilms.length === 0) continue;
      console.log(
        `  ${releaseYear}: ${yearFilms[0].title} ${money(Number(yearFilms[0].totalBoxOffice))}; ` +
        `${yearFilms.filter(film => Number(film.totalBoxOffice) >= 1_000_000_000).length} at $1B+; ` +
        `${yearFilms.filter(film => Number(film.totalBoxOffice) >= 500_000_000).length} at $500M+`,
      );
    }
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      new Promise(resolve => setTimeout(resolve, 3_000)),
    ]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
