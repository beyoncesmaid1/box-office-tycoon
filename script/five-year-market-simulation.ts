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

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const percentile = (values: number[], quantile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.min(1, quantile)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

const rate = <T>(values: T[], predicate: (value: T) => boolean): number =>
  values.length > 0 ? values.filter(predicate).length / values.length : 0;

interface StudioSnapshot {
  id: string;
  name: string;
  isAI: boolean;
  budget: number;
}

interface FilmEconomics {
  film: any;
  productionBudget: number;
  departmentSpend: number;
  talentSpend: number;
  vfxSpend: number;
  productionInvestment: number;
  marketingSpend: number;
  totalInvestment: number;
  breakEvenGross: number;
  studioRevenue: number;
  profit: number;
  roi: number;
}

function calculateFilmEconomics(
  film: any,
  vfxCosts: ReadonlyMap<string, number>,
): FilmEconomics {
  const productionBudget = Number(film.productionBudget || 0);
  const departmentSpend = [
    film.setsBudget,
    film.costumesBudget,
    film.stuntsBudget,
    film.makeupBudget,
    film.practicalEffectsBudget,
    film.soundCrewBudget,
  ].reduce((sum, amount) => sum + Number(amount || 0), 0);
  const talentSpend = Number(film.talentBudget || 0);
  const vfxSpend = film.vfxStudioId ? Number(vfxCosts.get(film.vfxStudioId) || 0) : 0;
  const marketingSpend = Number(film.campaignSpent || 0);
  const productionInvestment = productionBudget + departmentSpend + talentSpend + vfxSpend;
  const totalInvestment = productionInvestment + marketingSpend;
  const studioRevenue = Number(film.totalBoxOffice || 0) * 0.7;
  const profit = studioRevenue - totalInvestment;
  return {
    film,
    productionBudget,
    departmentSpend,
    talentSpend,
    vfxSpend,
    productionInvestment,
    marketingSpend,
    totalInvestment,
    breakEvenGross: totalInvestment / 0.7,
    studioRevenue,
    profit,
    roi: totalInvestment > 0 ? profit / totalInvestment : 0,
  };
}

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
    const preloadBody = await preloadResponse.text();
    assert.equal(preloadResponse.status, 200, preloadBody);

    const initialStudios = await fetch(
      `${baseUrl}/api/all-studios?deviceId=five-year-test`,
    ).then(response => response.json()) as StudioSnapshot[];
    const aiBudgetHistory = new Map<string, number[]>(
      initialStudios.filter(candidate => candidate.isAI).map(candidate => [
        candidate.id,
        [Number(candidate.budget || 0)],
      ]),
    );

    const startedAt = performance.now();
    for (let week = 0; week < 260; week += 1) {
      const response = await fetch(`${baseUrl}/api/studio/${studio.id}/advance-week`, {
        method: "POST",
      });
      assert.equal(response.status, 200, `Advance Week failed at simulated week ${week + 1}`);
      const weeklyStudios = await fetch(
        `${baseUrl}/api/all-studios?deviceId=five-year-test`,
      ).then(studioResponse => studioResponse.json()) as StudioSnapshot[];
      for (const candidate of weeklyStudios.filter(value => value.isAI)) {
        const history = aiBudgetHistory.get(candidate.id) || [];
        history.push(Number(candidate.budget || 0));
        aiBudgetHistory.set(candidate.id, history);
      }
    }

    const films = await fetch(`${baseUrl}/api/all-films/${studio.id}`).then(response => response.json()) as any[];
    const finalStudios = await fetch(
      `${baseUrl}/api/all-studios?deviceId=five-year-test`,
    ).then(response => response.json()) as StudioSnapshot[];
    const vfxStudios = await fetch(`${baseUrl}/api/vfx-studios`).then(response => response.json()) as any[];
    const vfxCosts = new Map(vfxStudios.map(candidate => [
      String(candidate.id),
      Number(candidate.cost || 0),
    ]));
    const released = films.filter(film => film.phase === "released" && Number(film.totalBoxOffice) > 0);
    const economics = released.map(film => calculateFilmEconomics(film, vfxCosts));
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

    const budgetTiers = [
      { label: "Micro (<$15M)", minimum: 0, maximum: 15_000_000 },
      { label: "Low ($15–40M)", minimum: 15_000_000, maximum: 40_000_000 },
      { label: "Mid ($40–100M)", minimum: 40_000_000, maximum: 100_000_000 },
      { label: "High ($100–170M)", minimum: 100_000_000, maximum: 170_000_000 },
      { label: "Tentpole ($170M+)", minimum: 170_000_000, maximum: Infinity },
    ];
    console.log("\nEconomics by production-budget tier (break-even gross = all-in cost / 0.70):");
    console.log("Tier                 n  prod med  all-in med  break-even  gross med  profitable  bomb(<-25%)  ROI med");
    for (const tier of budgetTiers) {
      const tierFilms = economics.filter(item =>
        item.productionBudget >= tier.minimum && item.productionBudget < tier.maximum);
      console.log(
        `${tier.label.padEnd(20)} ${String(tierFilms.length).padStart(3)} ` +
        `${money(median(tierFilms.map(item => item.productionBudget))).padStart(9)} ` +
        `${money(median(tierFilms.map(item => item.totalInvestment))).padStart(11)} ` +
        `${money(median(tierFilms.map(item => item.breakEvenGross))).padStart(11)} ` +
        `${money(median(tierFilms.map(item => Number(item.film.totalBoxOffice)))).padStart(10)} ` +
        `${percent(rate(tierFilms, item => item.profit >= 0)).padStart(10)} ` +
        `${percent(rate(tierFilms, item => item.roi <= -0.25)).padStart(11)} ` +
        `${percent(median(tierFilms.map(item => item.roi))).padStart(8)}`,
      );
    }

    console.log("\nROI distribution by production-budget tier:");
    console.log("Tier                    p10      p25   median      p75      p90   50%+ ROI  200%+ ROI");
    for (const tier of budgetTiers) {
      const tierFilms = economics.filter(item =>
        item.productionBudget >= tier.minimum && item.productionBudget < tier.maximum);
      const rois = tierFilms.map(item => item.roi);
      console.log(
        `${tier.label.padEnd(22)} ` +
        `${percent(percentile(rois, 0.10)).padStart(8)} ` +
        `${percent(percentile(rois, 0.25)).padStart(8)} ` +
        `${percent(percentile(rois, 0.50)).padStart(8)} ` +
        `${percent(percentile(rois, 0.75)).padStart(8)} ` +
        `${percent(percentile(rois, 0.90)).padStart(8)} ` +
        `${percent(rate(tierFilms, item => item.roi >= 0.5)).padStart(9)} ` +
        `${percent(rate(tierFilms, item => item.roi >= 2)).padStart(9)}`,
      );
    }
    console.log("\nMedian spending components by tier:");
    console.log("Tier                   departments    talent       VFX  marketing  cast  critic/aud");
    for (const tier of budgetTiers) {
      const tierFilms = economics.filter(item =>
        item.productionBudget >= tier.minimum && item.productionBudget < tier.maximum);
      console.log(
        `${tier.label.padEnd(22)} ` +
        `${money(median(tierFilms.map(item => item.departmentSpend))).padStart(11)} ` +
        `${money(median(tierFilms.map(item => item.talentSpend))).padStart(9)} ` +
        `${money(median(tierFilms.map(item => item.vfxSpend))).padStart(9)} ` +
        `${money(median(tierFilms.map(item => item.marketingSpend))).padStart(10)} ` +
        `${median(tierFilms.map(item => Array.isArray(item.film.castIds) ? item.film.castIds.length : 0)).toFixed(1).padStart(5)} ` +
        `${median(tierFilms.map(item => Number(item.film.criticScore || 0))).toFixed(0).padStart(6)}/` +
        `${median(tierFilms.map(item => Number(item.film.audienceScore || 0))).toFixed(1)}`,
      );
    }

    const outcomeBands = [
      { label: "Major hit (ROI 200%+)", test: (item: FilmEconomics) => item.roi >= 2 },
      { label: "Hit (ROI 50–199%)", test: (item: FilmEconomics) => item.roi >= 0.5 && item.roi < 2 },
      { label: "Modest profit (ROI 0–49%)", test: (item: FilmEconomics) => item.roi >= 0 && item.roi < 0.5 },
      { label: "Loss (ROI 0 to -25%)", test: (item: FilmEconomics) => item.roi < 0 && item.roi > -0.25 },
      { label: "Bomb (ROI -25% or worse)", test: (item: FilmEconomics) => item.roi <= -0.25 },
    ];
    console.log("\nMarket outcomes:");
    for (const band of outcomeBands) {
      const count = economics.filter(band.test).length;
      console.log(`  ${band.label.padEnd(28)} ${String(count).padStart(3)} (${percent(count / economics.length)})`);
    }

    const cheapBreakouts = economics
      .filter(item => item.productionBudget < 25_000_000 && item.roi >= 2)
      .sort((left, right) => right.roi - left.roi);
    const expensiveBombs = economics
      .filter(item => item.productionBudget >= 150_000_000 && item.profit < 0)
      .sort((left, right) => left.profit - right.profit);
    const costlyFiveHundred = economics
      .filter(item => Number(item.film.totalBoxOffice) >= 500_000_000 && item.roi < 0.25)
      .sort((left, right) => left.roi - right.roi);
    console.log(
      `\nStress cases: cheap major breakouts ${cheapBreakouts.length}; ` +
      `expensive bombs ${expensiveBombs.length}; $500M+ disappointments (ROI <25%) ${costlyFiveHundred.length}`,
    );
    for (const [label, items] of [
      ["Best cheap breakouts", cheapBreakouts],
      ["Worst expensive bombs", expensiveBombs],
      ["$500M+ disappointments", costlyFiveHundred],
    ] as Array<[string, FilmEconomics[]]>) {
      console.log(`${label}:`);
      if (items.length === 0) console.log("  none");
      for (const item of items.slice(0, 5)) {
        console.log(
          `  ${item.film.title}: production ${money(item.productionBudget)}, ` +
          `all-in ${money(item.totalInvestment)}, gross ${money(Number(item.film.totalBoxOffice))}, ` +
          `profit ${money(item.profit)}, ROI ${percent(item.roi)}`,
        );
      }
    }

    console.log("\nAI studio economics and cash pressure:");
    for (const candidate of finalStudios.filter(value => value.isAI)) {
      const history = aiBudgetHistory.get(candidate.id) || [Number(candidate.budget || 0)];
      const studioFilms = economics.filter(item => item.film.studioId === candidate.id);
      const start = history[0] || 0;
      const trough = Math.min(...history);
      const ending = history[history.length - 1] || 0;
      const pressureWeeks = history.filter(budget => budget < 100_000_000).length;
      console.log(
        `  ${candidate.name}: ${studioFilms.length} films, ` +
        `${percent(rate(studioFilms, item => item.profit >= 0))} profitable, ` +
        `slate profit ${money(studioFilms.reduce((sum, item) => sum + item.profit, 0))}; ` +
        `cash ${money(start)} → trough ${money(trough)} → ${money(ending)}, ` +
        `${pressureWeeks}/${history.length - 1} weeks under $100M`,
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
