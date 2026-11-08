// Builds deck/FRONTIER_pitch.pptx from the FINAL data (outputs/backtest_*.json and web/public/data).
// Every number on the slides is read from those files, so the deck always matches the website.
// Run:  cd deck && npm install && node build_deck.js
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa");
const { applyTheme } = require(process.env.PPTX_SKILL
  || "/root/.claude/skills/synced/2db0c540-cf7b-4ac4-97d3-8b82c3022833_10aa4ef7-7e1e-4740-a3ca-f8e27a474dcd/pptx/scripts/apply_theme.js");

const ROOT = path.resolve(__dirname, "..");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const fields = J("web/public/data/fields.json");
const F = Object.fromEntries(fields.map((f) => [f.id, f]));
const BT = { medicine: J("outputs/backtest_medicine.json"), quant: J("outputs/backtest_quant.json") };
const BOARD = J("web/public/data/gaps_top.json");
const LANDS = { medicine: J("web/public/data/medicine/lands.json"), quant: J("web/public/data/quant/lands.json") };
const IMG = (n) => path.join(__dirname, "img", n);
const SITE = "https://claude.ai/artifact/QsFTSLPNJFsG62W7ZAjRNr";

const fmt = (n) => n.toLocaleString("en-GB");
const p100 = (m) => Math.round(m["p@100"] * 100);
const main = (f, r) => BT[f].main.metrics[r];
const feat = (f, r) => BT[f].featured_rule.metrics[r];
const sec = (f, r) => BT[f].main.metrics_secondary[r];
const totalPapers = fields.reduce((s, f) => s + f.papers, 0);
const totalConcepts = fields.reduce((s, f) => s + f.concepts, 0);
const totalPairs = fields.reduce((s, f) => s + f.candidates, 0);

// ---------------------------------------------------------------------------
// Theme: the website's 16-bit space palette
// ---------------------------------------------------------------------------
const THEME = {
  name: "FRONTIER 16-bit",
  headFontFace: "Courier New",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0B0E2A", lt1: "FFF4C2", dk2: "141A3F", lt2: "B9BFDC",
    accent1: "FFC94A", accent2: "39D0E8", accent3: "F06AA8", accent4: "7B46B5",
    accent5: "4FA04A", accent6: "8A94B8", hlink: "39D0E8", folHlink: "A98BE0",
  },
};
const HEX = { bg: "0B0E2A", card: "141A3F", card2: "1E2557", line: "2B2F73", gold: "FFC94A", cyan: "39D0E8",
  pink: "F06AA8", violet: "7B46B5", grass: "4FA04A", slate: "8A94B8", cream: "FFF4C2", muted: "B9BFDC", red: "E04A3A" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "FRONTIER: predicting research gaps";
pres.subject = "Hackathon pitch";
pres.author = "FRONTIER team";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
const footer = [
  { text: { text: "FRONTIER · real arXiv papers to 29 Oct 2026", options: { x: M, y: 7.02, w: 7, h: 0.3, fontSize: 10, color: C.background2, margin: 0 } } },
];
pres.defineSlideMaster({
  title: "FRONTIER Title",
  background: { color: HEX.bg },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.0, w: 5.2, h: 1.9, fontSize: 48, bold: true, color: C.accent1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.1, w: 5.2, h: 2.4, fontSize: 20, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "FRONTIER Section",
  background: { color: HEX.bg },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.9, w: 8.2, h: 1.0, fontSize: 40, bold: true, color: C.accent1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.05, w: 8.0, h: 1.2, fontSize: 18, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.background2 },
});
pres.defineSlideMaster({
  title: "FRONTIER Content",
  background: { color: HEX.bg },
  objects: [
    ...footer,
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M, h: 1.0, fontSize: 28, bold: true, color: C.accent1, valign: "middle", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.background2 },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function icon(Comp, hex, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { size, color: "#" + hex }));
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
const shadow = () => ({ type: "outer", color: "000000", blur: 6, offset: 3, angle: 45, opacity: 0.45 });
function card(s, x, y, w, h, name, fill = HEX.card) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: HEX.line, width: 1.5 }, shadow: shadow(), objectName: name });
}
function txt(s, text, o) { s.addText(text, { isTextBox: true, margin: 0, fontFace: "Calibri", color: C.background1, ...o }); }
function shot(s, file, x, y, w, name) {
  const h = w * 0.5625;
  s.addShape(pres.shapes.RECTANGLE, { x: x - 0.04, y: y - 0.04, w: w + 0.08, h: h + 0.08, fill: { color: HEX.cyan }, line: { color: HEX.cyan, width: 0 }, shadow: shadow(), objectName: name + " frame" });
  s.addImage({ path: IMG(file), x, y, w, h, objectName: name, altText: name });
  return h;
}
function content(title, section) {
  const s = pres.addSlide({ masterName: "FRONTIER Content", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}
const chartBase = (extra = {}) => ({
  catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, valGridLine: { color: HEX.line, size: 0.75 }, catGridLine: { style: "none" },
  catAxisLineShow: false, valAxisLineShow: false,
  showLegend: true, legendPos: "b", legendColor: HEX.muted, legendFontFace: "+mn-lt", legendFontSize: 12,
  titleColor: HEX.cream, titleFontFace: "+mn-lt", titleFontSize: 14,
  dataLabelColor: HEX.cream, dataLabelFontFace: "+mn-lt", dataLabelFontSize: 11,
  ...extra,
});

(async () => {
  const I = {
    data: await icon(Fa.FaDatabase, HEX.gold), tag: await icon(Fa.FaTags, HEX.cyan), net: await icon(Fa.FaProjectDiagram, HEX.pink),
    target: await icon(Fa.FaBullseye, HEX.gold), lock: await icon(Fa.FaLock, HEX.cyan), clock: await icon(Fa.FaHistory, HEX.gold),
    flask: await icon(Fa.FaFlask, HEX.pink), branch: await icon(Fa.FaCodeBranch, HEX.cyan), warn: await icon(Fa.FaExclamationTriangle, HEX.gold),
    rocket: await icon(Fa.FaRocket, HEX.pink), check: await icon(Fa.FaCheckCircle, HEX.grass), robot: await icon(Fa.FaRobot, HEX.slate),
    search: await icon(Fa.FaSearch, HEX.cyan), users: await icon(Fa.FaUserGraduate, HEX.gold), globe: await icon(Fa.FaGlobeEurope, HEX.cyan),
  };

  // =========================================================================
  // 1. Title
  // =========================================================================
  pres.addSection({ title: "FRONTIER" });
  let s = pres.addSlide({ masterName: "FRONTIER Title", sectionTitle: "FRONTIER" });
  s.addText("FRONTIER", { placeholder: "title" });
  s.addText([
    { text: "Predicting which research ideas will meet next, and proving it with a backtest", options: { breakLine: true } },
    { text: `${fmt(totalPapers)} real arXiv papers · Medicine and Quant`, options: { fontSize: 16, color: C.accent2 } },
  ], { placeholder: "body" });
  // pixel "planets" motif on the right (shapes, no screenshots)
  [[9.6, 2.2, 1.9, HEX.cyan], [11.6, 4.3, 1.1, HEX.gold], [8.6, 4.9, 0.7, HEX.pink], [11.9, 1.4, 0.45, HEX.violet]].forEach(([x, y, d, col], i) =>
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: col }, line: { color: HEX.bg, width: 0 }, objectName: `Planet ${i + 1}` }));
  s.addShape(pres.shapes.LINE, { x: 9.0, y: 3.15, w: 3.8, h: 0.001, line: { color: HEX.gold, width: 1.5, dashType: "dash" }, rotate: -12, objectName: "Orbit" });
  s.addNotes(`FRONTIER finds pairs of research concepts that have never been studied together and predicts which will meet next. We built it on ${fmt(totalPapers)} real arXiv papers and proved it with a backtest.`);

  // =========================================================================
  // 2. The idea + numbers
  // =========================================================================
  s = content("New research often starts where two known ideas have never met", "FRONTIER");
  const stats = [
    [fmt(totalPapers), "real arXiv papers", "Medicine and Quant, 1997 to Oct 2026"],
    [fmt(totalConcepts), "research concepts", "tagged in titles and abstracts"],
    [(totalPairs / 1e6).toFixed(1) + "M", "never-studied pairs", "every pair scored, no sampling"],
  ];
  stats.forEach(([n, l, d], i) => {
    const x = M + i * 4.1;
    card(s, x, 1.9, 3.8, 2.6, `Stat ${l}`);
    txt(s, n, { x: x + 0.3, y: 2.1, w: 3.3, h: 1.1, fontSize: 54, bold: true, fontFace: "Courier New", color: C.accent2 });
    txt(s, l, { x: x + 0.3, y: 3.25, w: 3.3, h: 0.45, fontSize: 18, bold: true });
    txt(s, d, { x: x + 0.3, y: 3.7, w: 3.3, h: 0.5, fontSize: 14, color: C.background2 });
  });
  s.addImage({ data: I.search, x: M, y: 5.2, w: 0.6, h: 0.6, objectName: "Search icon" });
  txt(s, "Which of these pairs will researchers combine next?", { x: M + 0.9, y: 5.1, w: 11.2, h: 0.8, fontSize: 22, bold: true, color: C.accent1, valign: "middle" });
  s.addNotes("Most advances combine two existing ideas. Among millions of concept pairs no paper has combined, FRONTIER ranks which will be combined next.");

  // =========================================================================
  // 3. Method: pipeline + RA
  // =========================================================================
  s = content("We score every unlinked pair with Resource Allocation", "FRONTIER");
  const steps = [[I.data, "Papers", "arXiv titles, authors, categories"], [I.tag, "Concepts", "research phrases per paper"],
    [I.net, "Network", "linked once a paper has both"], [I.target, "Gap score", "every unlinked pair, same field"]];
  steps.forEach(([ic, h, b], i) => {
    const x = M + i * 3.1;
    card(s, x, 1.75, 2.85, 1.55, `Step ${i + 1}`);
    s.addImage({ data: ic, x: x + 0.25, y: 2.25, w: 0.55, h: 0.55, objectName: `Step ${i + 1} icon` });
    txt(s, [{ text: h, options: { bold: true, color: C.accent1, fontFace: "Courier New", fontSize: 18, breakLine: true } }, { text: b, options: { fontSize: 14 } }],
      { x: x + 1.0, y: 1.9, w: 1.75, h: 1.25, valign: "middle" });
    if (i < 3) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: x + 2.9, y: 2.38, w: 0.16, h: 0.3, rotate: 90, fill: { color: HEX.pink }, line: { color: HEX.pink, width: 0 }, objectName: `Arrow ${i + 1}` });
  });
  card(s, M, 3.65, W - 2 * M, 2.4, "Formula card", HEX.card2);
  txt(s, "RA(u,v) = Σ 1 / degree(w)", { x: M + 0.4, y: 3.9, w: 7.0, h: 0.7, fontSize: 30, bold: true, fontFace: "Courier New", color: C.accent1 });
  txt(s, "w = every concept already studied with both u and v. Specialised neighbours count most; hubs count little.", { x: M + 0.4, y: 4.7, w: 7.0, h: 1.0, fontSize: 16 });
  const top = BOARD.quant[0];
  txt(s, [
    { text: "TODAY'S #1 QUANT GAP", options: { bold: true, color: C.accent2, fontFace: "Courier New", fontSize: 13, breakLine: true } },
    { text: `${top.u_name.charAt(0).toUpperCase() + top.u_name.slice(1)} + ${top.v_name}`, options: { bold: true, fontSize: 20, breakLine: true } },
    { text: `${top.cn} shared neighbours · RA ${top.ra.toFixed(3)} · never studied together`, options: { fontSize: 14, color: C.background2 } },
  ], { x: 8.2, y: 3.95, w: 4.3, h: 2.4, valign: "top", paraSpaceAfter: 6 });
  s.addNotes("Concepts are linked once a paper mentions both. For each unlinked pair we add up one over the degree of every shared neighbour: specialised shared neighbours are the strongest signal. Gaps always stay inside one field.");

  // =========================================================================
  // 4. Demo
  // =========================================================================
  s = pres.addSlide({ masterName: "FRONTIER Section", sectionTitle: "FRONTIER" });
  s.addText("Live demo", { placeholder: "title" });
  s.addText("Galaxy → planet → island → gap", { placeholder: "body" });
  [[9.6, 2.2, 1.9, HEX.gold], [11.6, 4.3, 1.1, HEX.cyan], [8.6, 4.9, 0.7, HEX.violet], [11.9, 1.4, 0.45, HEX.pink]].forEach(([x, y, d, col], i) =>
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: col }, line: { color: HEX.bg, width: 0 }, objectName: `Demo planet ${i + 1}` }));
  s.addNotes("Switch to the site. Galaxy, click Quant, open Pricing of Securities, click the dashed gap 'pricing problem + vanilla option', show the RA maths and the missions. Then click VALIDATION.");

  // =========================================================================
  // 5. Backtest headline
  // =========================================================================
  s = content(`Predicted in 2018: ${p100(main("medicine", "resource_allocation"))} and ${p100(main("quant", "resource_allocation"))} of our top 100 gaps were filled`, "FRONTIER");
  [["medicine", "MEDICINE"], ["quant", "QUANT"]].forEach(([f, lab], i) => {
    const y = 1.75 + i * 2.5;
    card(s, M, y, 3.9, 2.25, `${lab} headline`);
    txt(s, lab, { x: M + 0.3, y: y + 0.2, w: 3.3, h: 0.3, fontSize: 13, bold: true, color: C.accent2, fontFace: "Courier New" });
    txt(s, `${p100(main(f, "resource_allocation"))} / 100`, { x: M + 0.3, y: y + 0.5, w: 3.3, h: 0.9, fontSize: 48, bold: true, color: C.accent1, fontFace: "Courier New" });
    txt(s, `random picks: ${p100(main(f, "random"))} / 100`, { x: M + 0.3, y: y + 1.45, w: 3.3, h: 0.5, fontSize: 14, color: C.background2 });
  });
  const rk = [["resource_allocation", "Resource Allocation (ours)"], ["lightgbm", "LightGBM model"], ["preferential_attachment", "Popularity"], ["random", "Random"]];
  s.addChart(pres.charts.BAR, rk.map(([k, n]) => ({ name: n, labels: ["Medicine", "Quant"], values: [p100(main("medicine", k)), p100(main("quant", k))] })), {
    x: 4.85, y: 1.7, w: 7.9, h: 5.0, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [HEX.gold, HEX.violet, HEX.slate, "4A5378"],
    showTitle: true, title: "Top-100 gaps filled, 2019 → Oct 2026", showValue: true, dataLabelPosition: "outEnd",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, ...chartBase(), objectName: "Headline results chart",
  });
  s.addNotes(`Data frozen at the end of 2018; every never-linked pair scored (${fmt(main("medicine", "random").n_pairs)} Medicine, ${fmt(main("quant", "random").n_pairs)} Quant). Only pre-2019 papers used, concepts needed 10 papers by 2018, settings committed before the first run. Popularity is nearly as good on all pairs: big topics meet anyway.`);

  // =========================================================================
  // 6. Specific concepts + robustness
  // =========================================================================
  s = content("For specific topics our score beats popularity, at every cutoff", "FRONTIER");
  const rk2 = [["resource_allocation", "Resource Allocation (ours)"], ["preferential_attachment", "Popularity"], ["random", "Random"]];
  s.addChart(pres.charts.BAR, rk2.map(([k, n]) => ({ name: n, labels: ["Medicine", "Quant"], values: [p100(feat("medicine", k)), p100(feat("quant", k))] })), {
    x: M, y: 1.7, w: 6.0, h: 5.0, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [HEX.gold, HEX.slate, "4A5378"],
    showTitle: true, title: "Top-100 filled, specific concepts only", showValue: true, dataLabelPosition: "outEnd",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, ...chartBase(), objectName: "Specific concepts chart",
  });
  const cut = BT.medicine.robustness.map((r) => String(r.cutoff));
  const rob = (f, k) => BT[f].robustness.map((r) => +r.metrics[k].auc.toFixed(3));
  s.addChart(pres.charts.LINE, [
    { name: "Medicine · ours", labels: cut, values: rob("medicine", "resource_allocation") },
    { name: "Medicine · popularity", labels: cut, values: rob("medicine", "preferential_attachment") },
    { name: "Quant · ours", labels: cut, values: rob("quant", "resource_allocation") },
    { name: "Quant · popularity", labels: cut, values: rob("quant", "preferential_attachment") },
  ], {
    x: 6.85, y: 1.7, w: 5.9, h: 5.0, chartColors: [HEX.gold, "B88F55", HEX.cyan, "1C8A9E"], lineSize: 3, lineDataSymbol: "square", lineDataSymbolSize: 8,
    showTitle: true, title: "Ranking quality (AUC) by cutoff year", valAxisMinVal: 0.7, valAxisMaxVal: 0.8, valAxisMajorUnit: 0.025,
    valAxisLabelFormatCode: "0.000", ...chartBase(), objectName: "Robustness chart",
  });
  s.addNotes(`Specific concepts = niche topics a researcher would act on. Medicine ${p100(feat("medicine", "resource_allocation"))} vs ${p100(feat("medicine", "preferential_attachment"))} for popularity; Quant ${p100(feat("quant", "resource_allocation"))} vs ${p100(feat("quant", "preferential_attachment"))}, a small margin on the top 100 but clear on AUC (${feat("quant", "resource_allocation").auc.toFixed(3)} vs ${feat("quant", "preferential_attachment").auc.toFixed(3)}). Our score beat popularity at all four cutoffs in both fields. A LightGBM model did not clearly beat it, so we keep the transparent formula.`);

  // =========================================================================
  // 7. Confirmed predictions
  // =========================================================================
  s = content("Real examples: flagged in 2018, published years later", "FRONTIER");
  const ex = [...BT.quant.featured_rule.examples, ...BT.medicine.featured_rule.examples];
  const pick = ["asian option", "pencil beam", "deposition"].map((k) => ex.find((e) => e.u_name === k || e.v_name === k)).filter(Boolean);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  pick.forEach((e, i) => {
    const y = 1.75 + i * 1.6;
    card(s, M, y, W - 2 * M, 1.4, `Hit ${e.u_name}`);
    s.addImage({ data: I.check, x: M + 0.3, y: y + 0.45, w: 0.5, h: 0.5, objectName: `Hit icon ${i + 1}` });
    txt(s, `${cap(e.u_name)} + ${e.v_name}`, { x: M + 1.05, y: y + 0.15, w: 4.3, h: 1.1, fontSize: 20, bold: true, valign: "middle" });
    txt(s, [{ text: `"${e.title}"`, options: { italic: true, breakLine: true } }, { text: `arXiv ${e.paper_id} · ${e.filled_date}`, options: { color: C.accent2, fontSize: 13 } }],
      { x: 5.45, y: y + 0.15, w: 5.4, h: 1.1, fontSize: 14, valign: "middle" });
    txt(s, `${e.lead_time_years.toFixed(1)} yrs`, { x: 10.95, y: y + 0.15, w: 1.5, h: 1.1, fontSize: 24, bold: true, color: C.accent1, fontFace: "Courier New", align: "right", valign: "middle" });
  });
  s.addNotes("Each was in our 2018 top list and later filled by a real paper; the number on the right is the lead time.");

  // =========================================================================
  // 8. Close
  // =========================================================================
  s = pres.addSlide({ masterName: "FRONTIER Title", sectionTitle: "FRONTIER" });
  s.addText("Explore the frontier", { placeholder: "title" });
  s.addText([
    { text: "Live site: ", options: { bold: true, color: C.accent1 } },
    { text: "FRONTIER on claude.ai", options: { hyperlink: { url: SITE }, color: C.accent2, breakLine: true } },
    { text: "Next: more planets and AI-written proposals from real abstracts", options: { fontSize: 16, color: C.background2 } },
  ], { placeholder: "body" });
  const mtop = BOARD.medicine[0];
  [["MEDICINE", mtop], ["QUANT", top]].forEach(([lab, g], i) => {
    const y = 1.7 + i * 2.35;
    card(s, 6.6, y, 6.13, 2.1, `${lab} open gap`);
    txt(s, `TOP OPEN GAP · ${lab}`, { x: 6.9, y: y + 0.2, w: 5.5, h: 0.3, fontSize: 13, bold: true, color: C.accent2, fontFace: "Courier New" });
    txt(s, `${cap(g.u_name)} + ${g.v_name}`, { x: 6.9, y: y + 0.55, w: 5.5, h: 0.85, fontSize: 20, bold: true, valign: "top" });
    txt(s, `RA ${g.ra.toFixed(3)} · ${g.cn} shared neighbours`, { x: 6.9, y: y + 1.5, w: 5.5, h: 0.4, fontSize: 14, color: C.background2 });
  });
  s.addNotes("These are the top open gaps today: never studied together, but surrounded by shared research. Thank you.");

  const out = path.join(__dirname, "FRONTIER_pitch.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
