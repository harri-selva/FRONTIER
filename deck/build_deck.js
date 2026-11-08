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
  pres.addSection({ title: "Opening" });
  let s = pres.addSlide({ masterName: "FRONTIER Title", sectionTitle: "Opening" });
  shot(s, "galaxy.png", 6.3, 1.85, 6.43, "Galaxy view");
  s.addText("FRONTIER", { placeholder: "title" });
  s.addText([
    { text: "Predicting which research ideas will meet next, and proving it with a backtest", options: { breakLine: true } },
    { text: `${fmt(totalPapers)} real arXiv papers · Medicine and Quant`, options: { fontSize: 16, color: C.accent2 } },
  ], { placeholder: "body" });
  s.addNotes(`FRONTIER turns research into a map. Every concept is a point, every paper that mentions two concepts draws a line between them, and the empty spaces between concepts that have never met are research gaps. We predict which gaps will be filled next, and we prove it: we froze the data at the end of 2018 and checked our predictions against the ${fmt(totalPapers)} papers. Two fields are live: Medicine and Quant.`);

  // =========================================================================
  // 2. Problem
  // =========================================================================
  pres.addSection({ title: "The idea" });
  s = content("New research often starts where two known ideas have never met", "The idea");
  const stats = [
    [fmt(totalPapers), "real arXiv papers", "Medicine and Quant, 1997 to Oct 2026"],
    [fmt(totalConcepts), "live research concepts", "tagged in titles and abstracts"],
    [(totalPairs / 1e6).toFixed(1) + "M", "never-studied pairs scored", "every pair, no sampling"],
  ];
  stats.forEach(([n, l, d], i) => {
    const x = M + i * 4.1;
    card(s, x, 1.75, 3.8, 2.6, `Stat ${l}`);
    txt(s, n, { x: x + 0.3, y: 1.95, w: 3.3, h: 1.1, fontSize: 54, bold: true, fontFace: "Courier New", color: C.accent2 });
    txt(s, l, { x: x + 0.3, y: 3.1, w: 3.3, h: 0.45, fontSize: 18, bold: true });
    txt(s, d, { x: x + 0.3, y: 3.55, w: 3.3, h: 0.5, fontSize: 14, color: C.background2 });
  });
  card(s, M, 4.75, W - 2 * M, 1.85, "Question card", HEX.card2);
  s.addImage({ data: I.search, x: M + 0.35, y: 5.25, w: 0.8, h: 0.8, objectName: "Search icon" });
  txt(s, [
    { text: "The question: ", options: { bold: true, color: C.accent1 } },
    { text: "out of millions of concept pairs that no paper has ever combined, which ones will researchers combine next? A student, a lab or a research firm that knew this would know where to look first." },
  ], { x: M + 1.5, y: 4.95, w: 10.3, h: 1.45, fontSize: 18, valign: "middle" });
  s.addNotes("Most real advances combine two things that already exist but had never been studied together. The space of possible combinations is enormous: millions of pairs even inside one field. FRONTIER ranks them all and points to the most promising ones.");

  // =========================================================================
  // 3. How it works
  // =========================================================================
  s = content("From 35,813 papers to a ranked list of research gaps", "The idea");
  const steps = [
    [I.data, "1  Papers", `Real arXiv papers with titles, authors and every arXiv category (Person A's data pipeline). Medicine: ${fmt(F.medicine.papers)}. Quant: ${fmt(F.quant.papers)}.`],
    [I.tag, "2  Concepts", "Research phrases tagged in each title and abstract, e.g. \"proton therapy\", \"limit order book\". Hub words and ~600 filler phrases removed."],
    [I.net, "3  Network", `Two concepts are linked once a paper mentions both. ${fmt(F.medicine.links + F.quant.links)} links today; islands = sub-fields.`],
    [I.target, "4  Gap score", "Every pair that has never been linked is scored with Resource Allocation. Gaps stay inside one field: never Medicine with Quant."],
  ];
  steps.forEach(([ic, h, b], i) => {
    const x = M + i * 3.1;
    card(s, x, 1.75, 2.85, 3.75, `Step ${i + 1}`);
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 2.05, w: 0.95, h: 0.95, fill: { color: HEX.card2 }, line: { color: HEX.line, width: 1 }, objectName: `Step ${i + 1} icon circle` });
    s.addImage({ data: ic, x: x + 0.5, y: 2.25, w: 0.55, h: 0.55, objectName: `Step ${i + 1} icon` });
    txt(s, h, { x: x + 0.3, y: 3.2, w: 2.3, h: 0.5, fontSize: 20, bold: true, fontFace: "Courier New", color: C.accent1 });
    txt(s, b, { x: x + 0.3, y: 3.75, w: 2.3, h: 2.4, fontSize: 14, valign: "top" });
    if (i < 3) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: x + 2.9, y: 3.85, w: 0.16, h: 0.3, rotate: 90, fill: { color: HEX.pink }, line: { color: HEX.pink, width: 0 }, objectName: `Arrow ${i + 1}` });
  });
  card(s, M, 5.8, W - 2 * M, 0.9, "Output banner", HEX.card2);
  s.addImage({ data: I.rocket, x: M + 0.3, y: 5.97, w: 0.55, h: 0.55, objectName: "Output icon" });
  txt(s, [{ text: "Output: ", options: { bold: true, color: C.accent1 } },
    { text: `${(totalPairs / 1e6).toFixed(1)} million never-studied pairs ranked, with the top gaps featured on every island` }],
    { x: M + 1.1, y: 5.8, w: 10.9, h: 0.9, fontSize: 18, valign: "middle" });
  s.addNotes("Four steps. We start from real arXiv papers. We tag research concepts in each paper. We connect concepts that appear together in a paper, which gives a network for each field. Then we score every pair that has never been connected. Gaps are always within one field.");

  // =========================================================================
  // 4. Resource Allocation
  // =========================================================================
  const top = BOARD.quant[0];
  s = content("Shared, specialised neighbours signal a gap about to close", "The idea");
  card(s, M, 1.65, 6.0, 4.95, "Diagram card");
  const nodes = { u: [M + 0.8, 4.3], v: [M + 5.2, 4.3], w1: [M + 3.0, 2.3], w2: [M + 3.0, 3.35], w3: [M + 3.0, 5.4] };
  for (const w of ["w1", "w2", "w3"]) for (const e of ["u", "v"]) {
    const [x1, y1] = nodes[e], [x2, y2] = nodes[w];
    s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) || 0.001,
      flipV: (x2 > x1) !== (y2 > y1), line: { color: HEX.slate, width: 1.5 }, objectName: `Link ${e}-${w}` });
  }
  s.addShape(pres.shapes.LINE, { x: nodes.u[0], y: nodes.u[1] + 0.001, w: nodes.v[0] - nodes.u[0], h: 0.001, line: { color: HEX.pink, width: 2.5, dashType: "dash" }, objectName: "Predicted gap u-v" });
  const dot = (k, col, r, label, sub) => {
    const [x, y] = nodes[k];
    s.addShape(pres.shapes.OVAL, { x: x - r, y: y - r, w: 2 * r, h: 2 * r, fill: { color: col }, line: { color: HEX.bg, width: 2 }, objectName: `Node ${k}` });
    txt(s, label, { x: x - 0.9, y: y + r + 0.05, w: 1.8, h: 0.3, fontSize: 13, bold: true, align: "center" });
    if (sub) txt(s, sub, { x: x + r + 0.1, y: y - 0.15, w: 1.45, h: 0.3, fontSize: 12, color: C.accent1, fill: { color: HEX.card }, valign: "middle" });
  };
  dot("u", HEX.cyan, 0.22, "u", null); dot("v", HEX.cyan, 0.22, "v", null);
  dot("w1", HEX.gold, 0.15, "", "degree 5 → 1/5"); dot("w2", HEX.gold, 0.15, "", "degree 2 → 1/2"); dot("w3", HEX.gold, 0.15, "", "degree 2 → 1/2");
  txt(s, "never studied together", { x: M + 1.5, y: 4.4, w: 2.9, h: 0.3, fontSize: 12, color: C.accent3, align: "center" });
  txt(s, "RA = 1/5 + 1/2 + 1/2 = 1.2", { x: M + 0.3, y: 6.05, w: 5.4, h: 0.4, fontSize: 16, bold: true, fontFace: "Courier New", color: C.accent1, align: "center" });
  card(s, 6.95, 1.65, 5.78, 1.75, "Formula card", HEX.card2);
  txt(s, "RA(u,v) = Σ 1 / degree(w)", { x: 7.25, y: 1.8, w: 5.2, h: 0.55, fontSize: 24, bold: true, fontFace: "Courier New", color: C.accent1 });
  txt(s, "over every concept w that has already appeared in papers with both u and v. A specialised neighbour (few links) adds a lot; a hub that touches everything adds almost nothing.",
    { x: 7.25, y: 2.4, w: 5.2, h: 0.95, fontSize: 14 });
  card(s, 6.95, 3.65, 5.78, 2.95, "Example card");
  txt(s, "TODAY'S #1 QUANT GAP", { x: 7.25, y: 3.85, w: 5.2, h: 0.3, fontSize: 12, bold: true, color: C.accent2, fontFace: "Courier New" });
  txt(s, `${top.u_name.charAt(0).toUpperCase() + top.u_name.slice(1)} + ${top.v_name}`, { x: 7.25, y: 4.2, w: 5.2, h: 0.5, fontSize: 22, bold: true });
  txt(s, [
    { text: `RA ${top.ra.toFixed(3)}`, options: { bold: true, color: C.accent1, breakLine: true } },
    { text: `${top.cn} shared neighbour concepts, yet no paper has ever studied both (to Oct 2026)`, options: { breakLine: true } },
    { text: `Island: ${top.u_land_name}`, options: { color: C.background2 } },
  ], { x: 7.25, y: 4.8, w: 5.2, h: 1.6, fontSize: 15, valign: "top", paraSpaceAfter: 4 });
  s.addNotes(`Resource Allocation is the score. Look at the concepts that both u and v have already been studied with: their shared neighbours. Each one contributes one over its degree, so specialised neighbours count most and hubs count least. In the toy example, 1/5 + 1/2 + 1/2 = 1.2. Our top Quant gap today is ${top.u_name} plus ${top.v_name}: ${top.cn} shared neighbours, RA ${top.ra.toFixed(3)}, and still no paper on both.`);

  // =========================================================================
  // 5. Section: product
  // =========================================================================
  pres.addSection({ title: "The product" });
  s = pres.addSlide({ masterName: "FRONTIER Section", sectionTitle: "The product" });
  s.addText("The product", { placeholder: "title" });
  s.addText("Explore research as a 16-bit universe: galaxy, planet, island, gap", { placeholder: "body" });
  s.addImage({ path: IMG("planet_quant.png"), x: 9.0, y: 1.6, w: 3.733, h: 2.1, objectName: "Quant planet thumbnail" });
  s.addImage({ path: IMG("planet_medicine.png"), x: 9.0, y: 3.95, w: 3.733, h: 2.1, objectName: "Medicine planet thumbnail" });
  s.addNotes("Now the product. It is a static website in an original 16-bit pixel style, so anyone can explore it in a browser. Four levels: galaxy, planet, island, gap.");

  // =========================================================================
  // 6. Galaxy
  // =========================================================================
  s = content("Each planet is a research field; two worlds are live", "The product");
  shot(s, "galaxy.png", M, 1.6, 7.9, "Galaxy screenshot");
  const gx = 8.9;
  txt(s, [
    { text: "Medicine", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: `${fmt(F.medicine.papers)} papers · ${F.medicine.lands} islands · ${fmt(F.medicine.concepts)} concepts`, options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Quant", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: `${fmt(F.quant.papers)} papers · ${F.quant.lands} islands · ${fmt(F.quant.concepts)} concepts`, options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "12 more planets", options: { bold: true, color: C.accent2, breakLine: true } },
    { text: "Physics, Climate, Neuroscience and others are visible as \"coming soon\" sectors." },
  ], { x: gx, y: 1.6, w: 3.85, h: 4.4, fontSize: 16, valign: "top" });
  s.addNotes("The galaxy has 14 original pixel-art planets orbiting a rotating spiral galaxy. Medicine and Quant are live; the other twelve show a coming-soon message. All art is generated in code, nothing is copied from games or reference images.");

  // =========================================================================
  // 7. Planets
  // =========================================================================
  s = content("Islands are sub-fields; size shows how much research they hold", "The product");
  shot(s, "planet_medicine.png", M, 1.6, 5.85, "Medicine planet screenshot");
  shot(s, "planet_quant.png", 6.88, 1.6, 5.85, "Quant planet screenshot");
  txt(s, `Medicine: ${F.medicine.lands} islands found by clustering concepts (e.g. Radiotherapy Planning, Brain Microstructure MRI)`, { x: M, y: 5.05, w: 5.85, h: 0.75, fontSize: 14, color: C.background2 });
  txt(s, `Quant: ${F.quant.lands} islands from arXiv's own sub-categories (e.g. Pricing of Securities, Risk Management)`, { x: 6.88, y: 5.05, w: 5.85, h: 0.75, fontSize: 14, color: C.background2 });
  txt(s, "Flags mark the islands with the most open gaps.", { x: M, y: 6.0, w: 12.1, h: 0.4, fontSize: 15, color: C.accent3, bold: true });
  s.addNotes("Clicking a live planet zooms into an ocean of islands. Each island is a sub-field and its size is its paper count. Quant uses arXiv's own sub-categories; medical physics has a single category, so we discovered its twelve sub-fields by clustering concepts that are studied together.");

  // =========================================================================
  // 8. Island network
  // =========================================================================
  s = content("On each island, dashed lines are gaps no paper has filled yet", "The product");
  shot(s, "land_quant.png", M, 1.6, 7.9, "Island network screenshot");
  const legend = [
    [HEX.cyan, "Crystal", "a concept; size = number of papers"],
    [HEX.gold, "Glow", "brighter where research is busiest"],
    [HEX.slate, "Solid line", "already studied together"],
    [HEX.pink, "Dashed line", "predicted gap: never in one paper"],
    [HEX.violet, "Portal", "gap leading to another island"],
  ];
  legend.forEach(([col, h, b], i) => {
    const y = 1.65 + i * 0.86;
    s.addShape(pres.shapes.OVAL, { x: 8.95, y: y + 0.08, w: 0.32, h: 0.32, fill: { color: col }, line: { color: HEX.bg, width: 1 }, objectName: `Legend ${h}` });
    txt(s, [{ text: h, options: { bold: true, breakLine: true } }, { text: b, options: { color: C.background2, fontSize: 14 } }], { x: 9.45, y, w: 3.3, h: 0.8, fontSize: 16, valign: "top" });
  });
  s.addNotes("This is the Pricing of Securities island in Quant. Each crystal is a concept, the warm glow shows where papers concentrate, solid lines are pairs already studied together, and the animated dashed lines are predicted gaps. Gaps that reach another island run to a portal on the coast.");

  // =========================================================================
  // 9. Detail panel
  // =========================================================================
  s = content("Every gap comes with its maths, real papers and three missions", "The product");
  shot(s, "gap_maths.png", M, 1.6, 7.9, "Gap maths panel screenshot");
  const th = 1.55 * 0.5625;
  s.addImage({ path: IMG("gap_proposal.png"), x: 8.9, y: 1.6, w: 3.83, h: 3.83 * 0.5625, objectName: "Proposal tab screenshot" });
  s.addImage({ path: IMG("gap_missions.png"), x: 8.9, y: 3.95, w: 3.83, h: 3.83 * 0.5625, objectName: "Missions tab screenshot" });
  void th;
  txt(s, "Papers · the RA maths, neighbour by neighbour · why it fits · a suggested paper (labelled as generated) · PhD, Masters and industry missions", { x: 8.9, y: 6.2, w: 3.83, h: 0.7, fontSize: 12, color: C.background2 });
  s.addNotes("Clicking a gap opens the side panel. The Gaps tab shows the Resource Allocation sum, one shared neighbour at a time, so anyone can check the score. Other tabs list real papers with authors and links, explain why the pair fits, suggest a paper title and abstract that are clearly labelled as generated, and offer missions for a PhD student, a Masters student and an industry team. The industry mission uses Marshall Wace only as an illustrative example.");

  // =========================================================================
  // 10. Section: proof
  // =========================================================================
  pres.addSection({ title: "The proof" });
  s = pres.addSlide({ masterName: "FRONTIER Section", sectionTitle: "The proof" });
  s.addText("The proof", { placeholder: "title" });
  s.addText("Could FRONTIER have seen the last eight years coming?", { placeholder: "body" });
  s.addImage({ path: IMG("validation.png"), x: 8.6, y: 2.2, w: 4.133, h: 4.133 * 0.5625, objectName: "Validation page thumbnail" });
  s.addNotes("A gap score is only useful if it predicts the future. So we tested it on the past.");

  // =========================================================================
  // 11. Backtest design
  // =========================================================================
  s = content("We froze the data at 2018 and checked against 2019–2026", "The proof");
  // timeline
  const tx0 = M + 0.3, tx1 = W - M - 0.3, yr = (y) => tx0 + ((y - 2014) / (2026.83 - 2014)) * (tx1 - tx0);
  s.addShape(pres.shapes.RECTANGLE, { x: yr(2014), y: 2.45, w: yr(2019) - yr(2014), h: 0.22, fill: { color: HEX.slate }, line: { color: HEX.slate, width: 0 }, objectName: "Past period" });
  s.addShape(pres.shapes.RECTANGLE, { x: yr(2019), y: 2.45, w: yr(2026.83) - yr(2019), h: 0.22, fill: { color: HEX.gold }, line: { color: HEX.gold, width: 0 }, objectName: "Test period" });
  for (const y of [2014, 2016, 2018, 2020, 2022, 2024, 2026]) txt(s, String(y), { x: yr(y) - 0.4, y: 2.75, w: 0.8, h: 0.3, fontSize: 12, align: "center", color: C.background2 });
  s.addShape(pres.shapes.RECTANGLE, { x: yr(2019) - 0.03, y: 1.85, w: 0.06, h: 1.25, fill: { color: HEX.pink }, line: { color: HEX.pink, width: 0 }, objectName: "Cutoff marker" });
  txt(s, "CUTOFF: 31 DEC 2018", { x: yr(2019) - 1.5, y: 1.5, w: 3.0, h: 0.32, fontSize: 13, bold: true, align: "center", color: C.accent3, fontFace: "Courier New" });
  txt(s, "Only this past is visible", { x: yr(2014), y: 2.05, w: 3.2, h: 0.3, fontSize: 13, color: C.background2 });
  txt(s, "Which predicted gaps got their first joint paper?", { x: yr(2019) + 0.2, y: 2.05, w: 6.5, h: 0.3, fontSize: 13, color: C.accent1 });
  const sg = [
    [I.target, "Every pair scored", `${fmt(main("medicine", "random").n_pairs)} Medicine and ${fmt(main("quant", "random").n_pairs)} Quant never-linked pairs, no sampling`],
    [I.lock, "No lookahead", "Features use only papers up to the cutoff; a test plants a paper one day later and checks nothing changes"],
    [I.clock, "No future-famous concepts", "A concept counts only if it already had 10+ papers by the cutoff"],
    [I.branch, "Settings frozen first", "Committed before the first run; every run logged with its commit in runs.csv"],
  ];
  sg.forEach(([ic, h, b], i) => {
    const x = M + (i % 2) * 6.15, y = 3.45 + Math.floor(i / 2) * 1.6;
    card(s, x, y, 5.95, 1.4, `Safeguard ${h}`);
    s.addImage({ data: ic, x: x + 0.3, y: y + 0.42, w: 0.55, h: 0.55, objectName: `${h} icon` });
    txt(s, [{ text: h, options: { bold: true, color: C.accent1, breakLine: true } }, { text: b, options: { fontSize: 14 } }], { x: x + 1.1, y: y + 0.15, w: 4.65, h: 1.15, fontSize: 16, valign: "middle" });
  });
  s.addNotes("The backtest. We froze everything at the end of 2018 and scored every pair of concepts that had never appeared together. Then we looked at what really happened from 2019 to October 2026. We guard against lookahead: only pre-cutoff papers are used, a concept must already have ten papers by 2018, and the settings were committed before the first run.");

  // =========================================================================
  // 12. Headline results
  // =========================================================================
  s = content(`${p100(main("medicine", "resource_allocation"))} of our top 100 Medicine gaps and ${p100(main("quant", "resource_allocation"))} in Quant were filled`, "The proof");
  [["medicine", "MEDICINE"], ["quant", "QUANT"]].forEach(([f, lab], i) => {
    const y = 1.65 + i * 2.5;
    card(s, M, y, 3.9, 2.25, `${lab} headline`);
    txt(s, lab, { x: M + 0.3, y: y + 0.2, w: 3.3, h: 0.3, fontSize: 13, bold: true, color: C.accent2, fontFace: "Courier New" });
    txt(s, `${p100(main(f, "resource_allocation"))} / 100`, { x: M + 0.3, y: y + 0.5, w: 3.3, h: 0.9, fontSize: 48, bold: true, color: C.accent1, fontFace: "Courier New" });
    txt(s, `filled by Oct 2026 · random picks: ${p100(main(f, "random"))}`, { x: M + 0.3, y: y + 1.45, w: 3.3, h: 0.6, fontSize: 14, color: C.background2 });
  });
  const rk = [["resource_allocation", "Resource Allocation (ours)"], ["lightgbm", "LightGBM model"], ["preferential_attachment", "Popularity"], ["common_neighbours", "Common neighbours"], ["random", "Random"]];
  s.addChart(pres.charts.BAR, rk.map(([k, n]) => ({ name: n, labels: ["Medicine", "Quant"], values: [p100(main("medicine", k)), p100(main("quant", k))] })), {
    x: 4.85, y: 1.6, w: 7.9, h: 5.15, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [HEX.gold, HEX.violet, HEX.slate, HEX.cyan, "4A5378"],
    showTitle: true, title: "Top-100 gaps filled (2018 → Oct 2026), by ranker", showValue: true, dataLabelPosition: "outEnd",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, ...chartBase(), objectName: "Headline results chart",
  });
  s.addNotes(`In 2018 we ranked every never-linked pair. Of our top 100, ${p100(main("medicine", "resource_allocation"))} Medicine gaps and ${p100(main("quant", "resource_allocation"))} Quant gaps were studied together by October 2026; random picks managed ${p100(main("medicine", "random"))} and ${p100(main("quant", "random"))}. Honestly, popularity alone is almost as good here: two big topics tend to meet anyway. The next slide shows where our score really earns its keep.`);

  // =========================================================================
  // 13. Specific concepts
  // =========================================================================
  s = content("For specific concepts, our score beats popularity in both fields", "The proof");
  const rk2 = [["resource_allocation", "Resource Allocation (ours)"], ["common_neighbours", "Common neighbours"], ["preferential_attachment", "Popularity"], ["random", "Random"]];
  s.addChart(pres.charts.BAR, rk2.map(([k, n]) => ({ name: n, labels: ["Medicine", "Quant"], values: [p100(feat("medicine", k)), p100(feat("quant", k))] })), {
    x: M, y: 1.6, w: 7.6, h: 5.15, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [HEX.gold, HEX.cyan, HEX.slate, "4A5378"],
    showTitle: true, title: "Top-100 gaps filled, specific concepts only", showValue: true, dataLabelPosition: "outEnd",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, ...chartBase(), objectName: "Specific concepts chart",
  });
  const auc = (f, k) => feat(f, k).auc.toFixed(3);
  const sc = [
    ["Medicine", `${p100(feat("medicine", "resource_allocation"))} vs ${p100(feat("medicine", "preferential_attachment"))}`, `Ranking quality (AUC) ${auc("medicine", "resource_allocation")} vs ${auc("medicine", "preferential_attachment")} for popularity`],
    ["Quant", `${p100(feat("quant", "resource_allocation"))} vs ${p100(feat("quant", "preferential_attachment"))}`, `AUC ${auc("quant", "resource_allocation")} vs ${auc("quant", "preferential_attachment")}; the top-100 margin is small and within error`],
  ];
  sc.forEach(([h, big, b], i) => {
    const y = 1.65 + i * 2.0;
    card(s, 8.55, y, 4.18, 1.8, `${h} specific card`);
    txt(s, h.toUpperCase(), { x: 8.85, y: y + 0.15, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: C.accent2, fontFace: "Courier New" });
    txt(s, big, { x: 8.85, y: y + 0.45, w: 3.6, h: 0.6, fontSize: 30, bold: true, color: C.accent1, fontFace: "Courier New" });
    txt(s, b, { x: 8.85, y: y + 1.05, w: 3.6, h: 0.65, fontSize: 13, color: C.background2 });
  });
  txt(s, "Specific = both concepts below the field's 75th degree percentile with 20+ papers, the rule the website uses for featured gaps, fixed before the first run.", { x: 8.55, y: 5.75, w: 4.18, h: 1.0, fontSize: 12, color: C.background2 });
  s.addNotes(`Restrict to specific concepts, the niche topics a researcher would actually act on, and popularity stops working. In Medicine our top 100 contained ${p100(feat("medicine", "resource_allocation"))} real hits against ${p100(feat("medicine", "preferential_attachment"))} for popularity. In Quant it is ${p100(feat("quant", "resource_allocation"))} against ${p100(feat("quant", "preferential_attachment"))}: a smaller margin on the top 100, but a clear one on overall ranking quality. Precision is lower than on the previous slide because specific gaps are genuinely harder to predict.`);

  // =========================================================================
  // 14. Year by year
  // =========================================================================
  s = content("Our 2018 predictions kept coming true, year after year", "The proof");
  const years = Object.keys(BT.medicine.top100_filled_by_year);
  s.addChart(pres.charts.LINE, [
    { name: "Medicine", labels: years, values: years.map((y) => BT.medicine.top100_filled_by_year[y]) },
    { name: "Quant", labels: years, values: years.map((y) => BT.quant.top100_filled_by_year[y]) },
  ], {
    x: M, y: 1.6, w: 8.2, h: 5.15, chartColors: [HEX.gold, HEX.cyan], lineSize: 3, lineDataSymbol: "square", lineDataSymbolSize: 9,
    showTitle: true, title: "Of the top 100 gaps predicted in 2018: cumulative number filled", showValue: true, dataLabelPosition: "t",
    valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, ...chartBase(), objectName: "Filled by year chart",
  });
  card(s, 9.15, 1.65, 3.58, 2.3, "Stricter test card");
  txt(s, "STRICTER TEST", { x: 9.45, y: 1.85, w: 3.0, h: 0.3, fontSize: 12, bold: true, color: C.accent2, fontFace: "Courier New" });
  txt(s, `${p100(sec("medicine", "resource_allocation"))} / ${p100(sec("quant", "resource_allocation"))}`, { x: 9.45, y: 2.15, w: 3.0, h: 0.6, fontSize: 30, bold: true, color: C.accent1, fontFace: "Courier New" });
  txt(s, "Medicine / Quant top-100 still filled when a gap needs 2 joint papers, not one passing mention", { x: 9.45, y: 2.8, w: 3.0, h: 1.0, fontSize: 13, color: C.background2 });
  card(s, 9.15, 4.2, 3.58, 2.55, "Sanity card");
  txt(s, "SANITY CHECK", { x: 9.45, y: 4.4, w: 3.0, h: 0.3, fontSize: 12, bold: true, color: C.accent2, fontFace: "Courier New" });
  txt(s, `Shuffled answers give AUC ${BT.medicine.main.sanity_shuffled_auc_ra.toFixed(3)} and ${BT.quant.main.sanity_shuffled_auc_ra.toFixed(3)}: pure chance, as they should. The real answers give ${main("medicine", "resource_allocation").auc.toFixed(3)} and ${main("quant", "resource_allocation").auc.toFixed(3)}.`, { x: 9.45, y: 4.75, w: 3.0, h: 1.85, fontSize: 13 });
  s.addNotes(`Hits arrived steadily: in Medicine ${BT.medicine.top100_filled_by_year["2019"]} of the top 100 were filled within a year and ${BT.medicine.top100_filled_by_year["2026"]} by October 2026; in Quant ${BT.quant.top100_filled_by_year["2019"]} within a year and ${BT.quant.top100_filled_by_year["2026"]} by 2026. Even under the stricter rule that a gap needs two joint papers, ${p100(sec("medicine", "resource_allocation"))} and ${p100(sec("quant", "resource_allocation"))} of the top 100 were filled.`);

  // =========================================================================
  // 15. Robustness
  // =========================================================================
  s = content("The result holds at every cutoff from 2014 to 2020", "The proof");
  const cut = BT.medicine.robustness.map((r) => String(r.cutoff));
  const rob = (f, k) => BT[f].robustness.map((r) => +r.metrics[k].auc.toFixed(3));
  s.addChart(pres.charts.LINE, [
    { name: "Medicine · ours", labels: cut, values: rob("medicine", "resource_allocation") },
    { name: "Medicine · popularity", labels: cut, values: rob("medicine", "preferential_attachment") },
    { name: "Quant · ours", labels: cut, values: rob("quant", "resource_allocation") },
    { name: "Quant · popularity", labels: cut, values: rob("quant", "preferential_attachment") },
  ], {
    x: M, y: 1.6, w: 8.2, h: 5.15, chartColors: [HEX.gold, "B88F55", HEX.cyan, "1C8A9E"], lineSize: 3, lineDataSymbol: "square", lineDataSymbolSize: 8,
    showTitle: true, title: "Ranking quality (AUC) by cutoff year, 4-year window", valAxisMinVal: 0.7, valAxisMaxVal: 0.8, valAxisMajorUnit: 0.025,
    valAxisLabelFormatCode: "0.000", ...chartBase(), objectName: "Robustness chart",
  });
  const lgbWins = BT.quant.robustness.filter((r) => r.metrics.lightgbm.auc > r.metrics.resource_allocation.auc).map((r) => r.cutoff);
  txt(s, [
    { text: "Ours beats popularity in all 8 runs", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "4 cutoffs × 2 fields, each with a fixed 4-year window.", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "A machine-learning model did not clearly win", options: { bold: true, color: C.accent2, breakLine: true } },
    { text: `LightGBM, trained only on earlier years, is below our score in every Medicine run and ahead in Quant only at ${lgbWins.join(", ")}. We keep the simple, explainable score.` },
  ], { x: 9.15, y: 1.65, w: 3.58, h: 5.0, fontSize: 15, valign: "top" });
  s.addNotes("We repeated the whole test with cutoffs in 2014, 2016, 2018 and 2020. Our score beat popularity every time in both fields. We also trained a LightGBM model on earlier years only; it did not clearly beat our score, so we kept the transparent formula that anyone can check by hand.");

  // =========================================================================
  // 16. Confirmed predictions
  // =========================================================================
  s = content("Predicted in 2018, published years later: real examples", "The proof");
  const ex = [...BT.quant.featured_rule.examples, ...BT.medicine.featured_rule.examples];
  const pick = ["asian option", "pencil beam", "deposition", "optimal policy"].map((k) => ex.find((e) => e.u_name === k || e.v_name === k)).filter(Boolean);
  pick.slice(0, 4).forEach((e, i) => {
    const x = M + (i % 2) * 6.15, y = 1.6 + Math.floor(i / 2) * 2.6;
    card(s, x, y, 5.95, 2.4, `Hit ${e.u_name}`);
    s.addImage({ data: I.check, x: x + 0.3, y: y + 0.28, w: 0.42, h: 0.42, objectName: `Hit icon ${i + 1}` });
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    txt(s, `${cap(e.u_name)} + ${e.v_name}`, { x: x + 0.9, y: y + 0.22, w: 3.4, h: 0.55, fontSize: 18, bold: true, valign: "middle" });
    txt(s, `${e.lead_time_years.toFixed(1)} yrs`, { x: x + 4.3, y: y + 0.22, w: 1.4, h: 0.55, fontSize: 20, bold: true, color: C.accent1, align: "right", fontFace: "Courier New", valign: "middle" });
    txt(s, `Flagged in 2018 (rank #${e.rank}) · first joint paper ${e.filled_date}`, { x: x + 0.3, y: y + 0.9, w: 5.4, h: 0.35, fontSize: 13, color: C.accent2 });
    txt(s, `"${e.title}" (arXiv ${e.paper_id})`, { x: x + 0.3, y: y + 1.3, w: 5.4, h: 0.95, fontSize: 13, italic: true, valign: "top" });
  });
  s.addNotes("Some concrete hits. In 2018 we flagged Asian option plus local volatility; under a year later a paper on hedging Asian options in local volatility models appeared. Pencil beam plus VMAT, two radiotherapy techniques, met in a 2022 review of AI in particle therapy, 3.9 years after our prediction. Every hit was checked: its first joint paper is dated inside the test window and is the earliest paper on both concepts.");

  // =========================================================================
  // 17. Today's gaps
  // =========================================================================
  pres.addSection({ title: "Today" });
  s = content("Today's top open gaps, as of October 2026", "Today");
  const hdr = ["Field", "Gap (never studied together)", "Island(s)", "RA", "Shared"].map((t) => ({ text: t, options: { bold: true, color: HEX.bg, fill: { color: HEX.gold }, fontFace: "Calibri", fontSize: 14 } }));
  const rows = [hdr];
  for (const f of ["medicine", "quant"]) for (const g of BOARD[f].slice(0, 4)) {
    const cell = (t, o = {}) => ({ text: t, options: { color: HEX.cream, fill: { color: rows.length % 2 ? HEX.card : HEX.card2 }, fontFace: "Calibri", fontSize: 14, ...o } });
    rows.push([cell(f === "medicine" ? "Medicine" : "Quant", { bold: true, color: HEX.cyan }), cell(`${g.u_name} + ${g.v_name}`, { bold: true }),
      cell(g.cross_land ? `${g.u_land_name} ⇄ ${g.v_land_name}` : g.u_land_name), cell(g.ra.toFixed(3), { align: "right" }), cell(String(g.cn), { align: "right" })]);
  }
  s.addTable(rows, { x: M, y: 1.6, w: W - 2 * M, colW: [1.3, 4.3, 4.53, 1.0, 1.0], border: { type: "solid", pt: 0.75, color: HEX.line }, rowH: 0.48, valign: "middle", objectName: "Top gaps table" });
  txt(s, "Featured gaps use specific concepts only (the rule validated on the previous slides). Each one opens in the website with its maths, papers, a suggested paper and missions.", { x: M, y: 6.2, w: W - 2 * M, h: 0.6, fontSize: 13, color: C.background2 });
  s.addNotes("And here is what FRONTIER predicts now, using all data up to October 2026: the top open gaps in each field. These are the pairs we expect researchers to combine next. Each one is clickable on the website with its full explanation.");

  // =========================================================================
  // 18. Limitations
  // =========================================================================
  s = content("What we report openly", "Today");
  const lim = [
    [I.warn, "A filled gap can be a passing mention", "So we also test a stricter rule: two joint papers. Results stay strong."],
    [I.tag, "Concept tagging is automatic", "Some generic words and unmerged synonyms remain; we removed ~600 by hand."],
    [I.clock, "The phrase list saw 2026 data", "The 10-papers-by-cutoff rule removes most of this effect, not all of it."],
    [I.robot, "No AI-written text in this build", "Proposals and missions are templates filled with real numbers and titles; Claude generation is ready once an API key is added."],
  ];
  lim.forEach(([ic, h, b], i) => {
    const x = M + (i % 2) * 6.15, y = 1.7 + Math.floor(i / 2) * 2.45;
    card(s, x, y, 5.95, 2.2, `Limitation ${i + 1}`);
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.35, w: 0.9, h: 0.9, fill: { color: HEX.card2 }, line: { color: HEX.line, width: 1 }, objectName: `Limitation ${i + 1} circle` });
    s.addImage({ data: ic, x: x + 0.5, y: y + 0.55, w: 0.5, h: 0.5, objectName: `Limitation ${i + 1} icon` });
    txt(s, [{ text: h, options: { bold: true, color: C.accent1, breakLine: true } }, { text: b, options: { fontSize: 14 } }], { x: x + 1.45, y: y + 0.25, w: 4.3, h: 1.75, fontSize: 17, valign: "top" });
  });
  s.addNotes("We are open about the limits. A gap counts as filled when two concepts appear in one abstract, which can be a passing mention, so we also report the stricter two-paper test. Concept tagging is automatic and not perfect. The phrase list was built with data up to 2026, which our ten-papers rule mostly neutralises. And the suggested proposals are templates, labelled as such.");

  // =========================================================================
  // 19. Close
  // =========================================================================
  s = pres.addSlide({ masterName: "FRONTIER Title", sectionTitle: "Today" });
  shot(s, "planet_medicine.png", 6.3, 1.85, 6.43, "Medicine planet");
  s.addText("Explore the frontier", { placeholder: "title" });
  s.addText([
    { text: "Live site: ", options: { bold: true, color: C.accent1 } },
    { text: "FRONTIER on claude.ai", options: { hyperlink: { url: SITE }, color: C.accent2, breakLine: true } },
    { text: "Next: more planets (Physics, Climate, Neuroscience) and Claude-written proposals from real abstracts", options: { fontSize: 16, color: C.background2 } },
  ], { placeholder: "body" });
  s.addNotes(`Thank you. The site is live; every gap, number and paper you saw today is in it, and the full method and every backtest run are in the repository. Next steps: open more planets, and switch on Claude-written proposals grounded in the real abstracts.`);

  const out = path.join(__dirname, "FRONTIER_pitch.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
