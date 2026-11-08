// High-resolution screenshots of the live site for the deck (needs `npx vite preview --port 4173` in web/)
const { chromium } = require("playwright");
const OUT = __dirname + "/img/";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => sessionStorage.setItem("frontier.booted", "1"));
  const go = async (h, name, wait = 2200) => { await p.goto("http://localhost:4173/" + h); await p.waitForTimeout(wait); await p.screenshot({ path: OUT + name + ".png" }); };
  await go("#/", "galaxy", 2500);
  await go("#/medicine", "planet_medicine", 2500);
  await go("#/quant", "planet_quant", 2500);
  await go("#/quant/pricing-of-securities", "land_quant", 2500);
  await go("#/quant/pricing-of-securities/g/quant-3707-5049", "gap_maths", 3000);
  await p.click(".tab >> text=PROPOSAL"); await p.waitForTimeout(1200); await p.screenshot({ path: OUT + "gap_proposal.png" });
  await p.click(".tab >> text=MISSIONS"); await p.waitForTimeout(1200); await p.screenshot({ path: OUT + "gap_missions.png" });
  await go("#/backtest/medicine", "validation", 2500);
  await go("#/gaps", "leaderboard", 2000);
  await b.close();
})();
