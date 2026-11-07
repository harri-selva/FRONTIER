// Playwright click-through of the built site. Saves screenshots to qa/screenshots/ and
// fails if the browser logs any error or warning.
// Usage:  (cd web && npm run build && npx vite preview --port 4173)   then   node qa/run_qa.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:4173/";
const OUT = path.join(__dirname, "screenshots");
const W = Number(process.env.W || 1280), H = Number(process.env.H || 720);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const problems = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  let n = 0;
  const shot = async (name, wait = 600) => {
    await page.waitForTimeout(wait);
    const f = path.join(OUT, `${String(++n).padStart(2, "0")}_${name}.png`);
    await page.screenshot({ path: f });
    console.log("  saved", path.basename(f));
  };

  // boot
  await page.goto(BASE);
  await shot("boot", 1800);
  await page.keyboard.press("Space");
  await shot("galaxy", 1500);

  // coming soon planet
  await page.hover(".planet-label.soon >> text=PHYSICS");
  await shot("galaxy_hover_soon", 400);
  await page.click(".planet-label.soon >> text=PHYSICS");
  await shot("coming_soon_dialog", 400);
  await page.click(".dialog .btn");

  for (const field of ["medicine", "quant"]) {
    console.log(`== ${field}`);
    await page.goto(BASE + "#/");
    await page.waitForTimeout(800);
    await page.hover(`.planet-label.live >> text=${field.toUpperCase()}`);
    await shot(`${field}_galaxy_hover_live`, 500);
    await page.click(`.planet-label.live >> text=${field.toUpperCase()}`);
    await page.waitForURL(`**#/${field}`, { timeout: 10000 });
    await shot(`${field}_planet`, 1800);
    const islands = page.locator(".island-label");
    const count = await islands.count();
    if (count < 6) problems.push(`${field}: only ${count} islands`);
    await islands.nth(1).hover();
    await shot(`${field}_island_hover`, 500);
    await islands.nth(1).click();
    await page.waitForURL(`**#/${field}/*`, { timeout: 10000 });
    await page.locator(".node-label.show >> visible=true").first().waitFor({ timeout: 15000 });
    await shot(`${field}_land`, 1500);
    // concept: the largest labelled node
    await page.locator(".node-label.show >> visible=true").first().click();
    await page.waitForSelector(".detail");
    await shot(`${field}_concept_papers`, 1200);
    for (const tab of ["GAPS", "WHY IT FITS", "PROPOSAL", "MISSIONS"]) {
      await page.click(`.tab >> text=${tab}`);
      await shot(`${field}_concept_${tab.toLowerCase().replace(/ /g, "_")}`, 900);
    }
    // a gap from the concept's gap list
    await page.click(".tab >> text=GAPS");
    await page.locator(".gap-card").first().click();
    await page.waitForURL("**/g/**");
    await shot(`${field}_gap_maths`, 1200);
    for (const tab of ["PAPERS", "WHY IT FITS", "PROPOSAL", "MISSIONS"]) {
      await page.click(`.tab >> text=${tab}`);
      await shot(`${field}_gap_${tab.toLowerCase().replace(/ /g, "_")}`, 900);
    }
    // Validation from the HUD
    await page.click(".hud-proof");
    await page.waitForURL("**#/backtest**");
    await page.click(`.seg-btn >> text=${field.toUpperCase()}`);
    await shot(`${field}_validation_top`, 1200);
    await page.locator(".page").evaluate((el) => el.scrollTo(0, 900));
    await shot(`${field}_validation_hits`, 600);
    await page.locator(".page").evaluate((el) => el.scrollTo(0, 2400));
    await shot(`${field}_validation_robustness`, 600);
  }

  // deep link reload on a gap URL + ESC path
  const board = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "public", "data", "gaps_top.json"), "utf8"));
  const lands = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "public", "data", "quant", "lands.json"), "utf8"));
  const g = board.quant[0], land = lands.find((l) => l.id === g.u_land);
  const deep = `${BASE}#/quant/${land.slug}/g/${g.id}`;
  await page.goto(deep);
  await page.reload();
  await page.waitForSelector(".detail", { timeout: 15000 });
  await shot("deeplink_gap_reload", 1500);
  for (const expect of [`#/quant/${land.slug}`, "#/quant", "#/"]) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const h = new URL(page.url()).hash;
    if (h !== expect && !(expect === "#/" && h === "")) problems.push(`ESC: expected ${expect}, got ${h}`);
  }
  await shot("after_escape_galaxy", 800);

  // leaderboard -> fly to gap
  await page.goto(BASE + "#/gaps");
  await shot("gaps_board", 1200);
  await page.locator(".arcade tr.clickable").first().click();
  await page.waitForSelector(".detail", { timeout: 15000 });
  await shot("gaps_board_fly_to_gap", 1500);
  await page.goto(BASE + "#/method");
  await shot("method", 1200);

  // CRT toggle
  await page.goto(BASE + "#/medicine");
  await page.click("text=CRT");
  await shot("medicine_planet_crt", 1500);
  await page.click("text=CRT");

  await browser.close();
  console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n` + problems.join("\n") : "\nNo console errors or warnings.");
  process.exit(problems.length ? 1 : 0);
})();
