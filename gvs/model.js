/**
 * Great Vowel Shift teaching model — eight-step legacy reconstruction.
 *
 * This is independently authored model data. The stage order follows the
 * eight-step pedagogical sequence of the surviving Furman project and was
 * confirmed against the recovered applet's compiled state tables (2026-09-09).
 * It is a visualization convention, not a claim that English changed
 * everywhere in eight clean, simultaneous, or exactly dated events.
 *
 * Since model 0.3.0 each vowel state also carries (a) the original applet's
 * sound-file name, so the site can play the 2000 recordings, and (b) a chart
 * position mapped from the applet's own pixel geometry (595×400 canvas,
 * trapezoid (210,40)-(550,40)-(550,270)-(270,270), glyph centres) onto this
 * SVG's trapezoid. The acoustic targets (f1/f2) stay separate and unchanged.
 */

export const MODEL_VERSION = "0.3.0-eight-step-original-geometry";

// Affine map from the applet canvas trapezoid box to this chart's trapezoid box.
export const APPLET_GEOMETRY = Object.freeze({
  canvas: Object.freeze({ width: 595, height: 400 }),
  trapezoid: Object.freeze([[210, 40], [550, 40], [550, 270], [270, 270]]),
  chartBox: Object.freeze({ x0: 105, x1: 785, y0: 65, y1: 465 })
});

export function appletToChart(x, y) {
  const { chartBox } = APPLET_GEOMETRY;
  return {
    x: Math.round((chartBox.x0 + ((x - 210) / (550 - 210)) * (chartBox.x1 - chartBox.x0)) * 10) / 10,
    y: Math.round((chartBox.y0 + ((y - 40) / (270 - 40)) * (chartBox.y1 - chartBox.y0)) * 10) / 10
  };
}

// Original applet default glyph placements: top-left corner and image size, from the
// recovered bytecode (research/JAVA_FORENSICS_REPORT.md §5) and the recovered GIF headers.
const APPLET_GLYPHS = Object.freeze({
  a: [390, 230, 14, 15], e: [250, 120, 14, 15], i: [240, 55, 3, 21], o: [500, 120, 14, 15],
  u: [500, 55, 12, 15], opene: [265, 160, 11, 14], openo: [500, 190, 14, 15], ae: [280, 215, 24, 15],
  ei: [360, 160, 22, 15], eu: [410, 160, 30, 15], ai: [360, 195, 22, 15], au: [410, 195, 30, 15]
});

const glyphCentre = (key) => {
  const [x, y, w, h] = APPLET_GLYPHS[key];
  return appletToChart(x + w / 2, y + h / 2);
};

export const STAGES = Object.freeze([
  Object.freeze({
    id: "middle-english",
    short: "ME",
    label: "Middle English baseline",
    date: "reference inventory before the numbered sequence",
    formula: "Seven schematic long-vowel inputs",
    note: "Start from a simplified late-Middle-English long-vowel system. The numbered steps describe structural relations, not eight calendar moments.",
    changes: Object.freeze([])
  }),
  Object.freeze({
    id: "step-1-high-diphthongization",
    short: "1",
    label: "High vowels diphthongize",
    date: "Jespersen-style pedagogical Step 1",
    formula: "/iː, uː/ → /əɪ, əʊ/",
    note: "The two highest long vowels leave their monophthongal positions and acquire glides, opening space at the top of the system.",
    changes: Object.freeze(["bite", "loud"])
  }),
  Object.freeze({
    id: "step-2-close-mid-raising",
    short: "2",
    label: "Close-mid vowels raise",
    date: "Jespersen-style pedagogical Step 2",
    formula: "/eː, oː/ → /iː, uː/",
    note: "The close-mid front and back long vowels move into the high positions vacated in the preceding schematic step.",
    changes: Object.freeze(["meet", "soon"])
  }),
  Object.freeze({
    id: "step-3-a-fronting",
    short: "3",
    label: "Low /aː/ fronts",
    date: "Jespersen-style pedagogical Step 3",
    formula: "/aː/ → /æː/",
    note: "The low long vowel is represented as moving forward before its later raising stages.",
    changes: Object.freeze(["name"])
  }),
  Object.freeze({
    id: "step-4-open-mid-raising",
    short: "4",
    label: "Open-mid vowels raise",
    date: "Jespersen-style pedagogical Step 4",
    formula: "/ɛː, ɔː/ → /eː, oː/",
    note: "The open-mid front and back long vowels rise. The newly created front /eː/ will move again in Step 6.",
    changes: Object.freeze(["meat", "holy"])
  }),
  Object.freeze({
    id: "step-5-ae-raising",
    short: "5",
    label: "Fronted /æː/ raises",
    date: "Jespersen-style pedagogical Step 5",
    formula: "/æː/ → /ɛː/",
    note: "The vowel that originated as /aː/ and fronted in Step 3 rises into the open-mid front region.",
    changes: Object.freeze(["name"])
  }),
  Object.freeze({
    id: "step-6-new-e-raising",
    short: "6",
    label: "New /eː/ raises",
    date: "Jespersen-style pedagogical Step 6",
    formula: "Step-4 /eː/ → /iː/",
    note: "The front vowel created from Middle English /ɛː/ in Step 4 rises again to /iː/ in this simplified chain.",
    changes: Object.freeze(["meat"])
  }),
  Object.freeze({
    id: "step-7-new-epsilon-raising",
    short: "7",
    label: "New /ɛː/ raises",
    date: "Jespersen-style pedagogical Step 7",
    formula: "Step-5 /ɛː/ → /eː/",
    note: "The front vowel created from Middle English /aː/ in Step 5 rises again to /eː/ in the core eight-step model.",
    changes: Object.freeze(["name"])
  }),
  Object.freeze({
    id: "step-8-diphthong-opening",
    short: "8",
    label: "Diphthongs lower and open",
    date: "Jespersen-style pedagogical Step 8",
    formula: "/əɪ, əʊ/ → /aɪ, aʊ/",
    note: "The nuclei of the two diphthongs are represented as lowering toward the familiar modern PRICE/BITE and MOUTH/HOUSE patterns.",
    changes: Object.freeze(["bite", "loud"])
  })
]);

const point = (ipa, f1, f2, glide = null, note = "", original = null) =>
  Object.freeze({
    ipa,
    f1,
    f2,
    glide: glide ? Object.freeze(glide) : null,
    note,
    // original.sound = applet sound-file base name (docs/assets/original-sounds/<sound>.wav);
    // original.glyph = applet glyph key; chart = position mapped from the applet geometry.
    original: original ? Object.freeze(original) : null,
    chart: original ? Object.freeze(glyphCentre(original.glyph)) : null
  });

const repeat = (value, count) => Array.from({ length: count }, () => value);

const I = point("/iː/", 300, 2350, null, "high front long monophthong", { sound: "i", glyph: "i" });
const E_CLOSE = point("/eː/", 460, 2150, null, "close-mid front long monophthong", { sound: "e", glyph: "e" });
const E_OPEN = point("/ɛː/", 600, 1850, null, "open-mid front long monophthong", { sound: "opene", glyph: "opene" });
const A = point("/aː/", 760, 1500, null, "low long monophthong", { sound: "a", glyph: "a" });
const AE = point("/æː/", 680, 1700, null, "fronted low long monophthong", { sound: "ae", glyph: "ae" });
const O_OPEN = point("/ɔː/", 570, 900, null, "open-mid back long monophthong", { sound: "openo", glyph: "openo" });
const O_CLOSE = point("/oː/", 450, 800, null, "close-mid back long monophthong", { sound: "o", glyph: "o" });
const U = point("/uː/", 300, 680, null, "high back long monophthong", { sound: "u", glyph: "u" });
const SCHWA_I = point(
  "/əɪ/",
  500,
  1500,
  { ipa: "/ɪ/", f1: 360, f2: 2150 },
  "schematic central-to-front diphthong",
  { sound: "schwaI", glyph: "ei" }
);
const A_I = point(
  "/aɪ/",
  700,
  1350,
  { ipa: "/ɪ/", f1: 380, f2: 2050 },
  "schematic open-to-front diphthong",
  { sound: "aI", glyph: "ai" }
);
const SCHWA_U = point(
  "/əʊ/",
  500,
  1350,
  { ipa: "/ʊ/", f1: 360, f2: 760 },
  "schematic central-to-back diphthong",
  { sound: "schwaU", glyph: "eu" }
);
const A_U = point(
  "/aʊ/",
  700,
  1350,
  { ipa: "/ʊ/", f1: 400, f2: 850 },
  "schematic open-to-back diphthong",
  { sound: "aU", glyph: "au" }
);

export const VOWELS = Object.freeze([
  Object.freeze({
    id: "bite",
    order: 1,
    series: "ME /iː/",
    keyword: "BITE",
    historicalExamples: Object.freeze(["thy", "child"]),
    modernReference: "/aɪ/ in many varieties (PRICE/BITE)",
    spellingHint: "often written ⟨i⟩ or ⟨y⟩ in familiar examples",
    colorToken: "v1",
    caveat: "The exact nucleus, glide, timing, and lexical incidence vary by reconstruction and dialect; the two-step path here is intentionally schematic.",
    stages: Object.freeze([
      I,
      SCHWA_I,
      ...repeat(SCHWA_I, 6),
      A_I
    ])
  }),
  Object.freeze({
    id: "meet",
    order: 2,
    series: "ME /eː/",
    keyword: "MEET",
    historicalExamples: Object.freeze(["she", "three", "me", "years"]),
    modernReference: "/iː/ is a common outcome; individual words can diverge",
    spellingHint: "one historical source of modern high-front vowels",
    colorToken: "v2",
    caveat: "Postvocalic /r/, shortening, lexical history, and dialect can interrupt the neat textbook outcome; the original site itself flags “years” as exceptional.",
    stages: Object.freeze([
      E_CLOSE,
      E_CLOSE,
      I,
      ...repeat(I, 6)
    ])
  }),
  Object.freeze({
    id: "meat",
    order: 3,
    series: "ME /ɛː/",
    keyword: "MEAT",
    historicalExamples: Object.freeze(["yea", "speke / speak"]),
    modernReference: "often /iː/ after later merger, with important exceptions",
    spellingHint: "a second historical source of modern /iː/ in many varieties",
    colorToken: "v3",
    caveat: "MEET–MEAT relations, exceptions such as break/yea-type outcomes, shortening, and dialectal mergers cannot be represented by one universal endpoint.",
    stages: Object.freeze([
      ...repeat(E_OPEN, 4),
      E_CLOSE,
      E_CLOSE,
      I,
      I,
      I
    ])
  }),
  Object.freeze({
    id: "name",
    order: 4,
    series: "ME /aː/",
    keyword: "NAME",
    historicalExamples: Object.freeze(["name", "age"]),
    modernReference: "often /eɪ/ or a related FACE vowel after later developments",
    spellingHint: "the original site's only series shown moving in three numbered steps",
    colorToken: "v4",
    caveat: "The core eight-step diagram ends this series at /eː/. Modern FACE diphthongization and regional outcomes are later or separate developments, so they are not smuggled into Step 8 here.",
    stages: Object.freeze([
      A,
      A,
      A,
      AE,
      AE,
      E_OPEN,
      E_OPEN,
      E_CLOSE,
      E_CLOSE
    ])
  }),
  Object.freeze({
    id: "holy",
    order: 5,
    series: "ME /ɔː/",
    keyword: "HOLY",
    historicalExamples: Object.freeze(["holy"]),
    modernReference: "a raised GOAT-type outcome; modern realizations vary widely",
    spellingHint: "open /ɔː/ is kept distinct from close /oː/ at the input",
    colorToken: "v5",
    caveat: "The schematic Step-4 endpoint /oː/ is not a claim that all present-day GOAT vowels are monophthongal or identical across dialects.",
    stages: Object.freeze([
      ...repeat(O_OPEN, 4),
      O_CLOSE,
      ...repeat(O_CLOSE, 4)
    ])
  }),
  Object.freeze({
    id: "soon",
    order: 6,
    series: "ME /oː/",
    keyword: "SOON",
    historicalExamples: Object.freeze(["soon", "to", "good"]),
    modernReference: "often /uː/; words such as good underwent later conditioning/laxing",
    spellingHint: "close /oː/ raises into the high-back region",
    colorToken: "v6",
    caveat: "Individual words can shorten, lax, or otherwise diverge after the raising. The original site's “good” discussion is a useful warning against one-word-one-arrow reasoning.",
    stages: Object.freeze([
      O_CLOSE,
      O_CLOSE,
      U,
      ...repeat(U, 6)
    ])
  }),
  Object.freeze({
    id: "loud",
    order: 7,
    series: "ME /uː/",
    keyword: "LOUD",
    historicalExamples: Object.freeze(["loud"]),
    modernReference: "/aʊ/ in many varieties (MOUTH/HOUSE)",
    spellingHint: "often represented by MOUTH/HOUSE-type modern words",
    colorToken: "v7",
    caveat: "Modern MOUTH vowels differ substantially across regions; the start and end formants are demonstration targets rather than historical measurements.",
    stages: Object.freeze([
      U,
      SCHWA_U,
      ...repeat(SCHWA_U, 6),
      A_U
    ])
  })
]);

export const MODEL_LIMITS = Object.freeze([
  "The eight numbered stages reproduce a textbook/Jespersen-style teaching sequence, not eight exactly dated historical events.",
  "The changes overlapped, diffused through words and communities, and varied by region, age, social setting, and lexical item.",
  "Formant values are synthetic chart and audio targets, not measurements from historical speakers.",
  "The example words illustrate input series; shortening, conditioning, merger, and later changes can give individual words different outcomes.",
  "Modern reference vowels are described separately when they go beyond the core eight-step diagram."
]);

export function clampStage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(STAGES.length - 1, Math.round(n)));
}

export function getVowel(id) {
  return VOWELS.find((vowel) => vowel.id === id) ?? null;
}

export function sameState(a, b) {
  if (!a || !b) return false;
  const glideA = a.glide ?? null;
  const glideB = b.glide ?? null;
  return a.ipa === b.ipa
    && a.f1 === b.f1
    && a.f2 === b.f2
    && (glideA?.ipa ?? null) === (glideB?.ipa ?? null)
    && (glideA?.f1 ?? null) === (glideB?.f1 ?? null)
    && (glideA?.f2 ?? null) === (glideB?.f2 ?? null);
}

export function didChangeAt(vowelOrId, stageValue) {
  const vowel = typeof vowelOrId === "string" ? getVowel(vowelOrId) : vowelOrId;
  if (!vowel) throw new Error(`Unknown vowel: ${String(vowelOrId)}`);
  const stage = clampStage(stageValue);
  return stage > 0 && !sameState(vowel.stages[stage - 1], vowel.stages[stage]);
}

export function changedVowelsAtStage(stageValue) {
  const stage = clampStage(stageValue);
  return VOWELS.filter((vowel) => didChangeAt(vowel, stage));
}

export function interpolatePoint(vowelOrId, stageValue) {
  const vowel = typeof vowelOrId === "string" ? getVowel(vowelOrId) : vowelOrId;
  if (!vowel) throw new Error(`Unknown vowel: ${String(vowelOrId)}`);

  const value = Math.max(0, Math.min(STAGES.length - 1, Number(stageValue) || 0));
  const low = Math.floor(value);
  const high = Math.ceil(value);
  const fraction = value - low;
  const a = vowel.stages[low];
  const b = vowel.stages[high];

  const mix = (x, y) => x + (y - x) * fraction;
  const glideA = a.glide ?? a;
  const glideB = b.glide ?? b;

  return {
    ipa: fraction === 0 ? a.ipa : `${a.ipa} → ${b.ipa}`,
    f1: mix(a.f1, b.f1),
    f2: mix(a.f2, b.f2),
    original: fraction === 0 ? a.original : (fraction === 1 ? b.original : null),
    chart: (a.chart && b.chart) ? { x: mix(a.chart.x, b.chart.x), y: mix(a.chart.y, b.chart.y) } : null,
    glide: (a.glide || b.glide)
      ? {
          ipa: fraction === 0 ? (a.glide?.ipa ?? a.ipa) : `${glideA.ipa ?? a.ipa} → ${glideB.ipa ?? b.ipa}`,
          f1: mix(glideA.f1, glideB.f1),
          f2: mix(glideA.f2, glideB.f2)
        }
      : null
  };
}

/** Chart position for a vowel state: the applet-derived position when the state has one, else the formant projection. */
export function chartPosition(point) {
  if (point && point.chart) return { x: point.chart.x, y: point.chart.y };
  return formantsToChart(point.f1, point.f2);
}

/** Glide endpoint anchored at the chart position, keeping the schematic glide direction from formant space. */
export function glideChartPosition(point) {
  if (!point || !point.glide) return null;
  const nucleus = chartPosition(point);
  const nucleusFormant = formantsToChart(point.f1, point.f2);
  const glideFormant = formantsToChart(point.glide.f1, point.glide.f2);
  return {
    x: Math.round((nucleus.x + (glideFormant.x - nucleusFormant.x) * 0.6) * 10) / 10,
    y: Math.round((nucleus.y + (glideFormant.y - nucleusFormant.y) * 0.6) * 10) / 10
  };
}

export function formantsToChart(f1, f2) {
  // Conventional orientation: front vowels left, back vowels right; high vowels top.
  const x = 95 + ((2450 - f2) / (2450 - 600)) * 650;
  const y = 62 + ((f1 - 250) / (800 - 250)) * 390;
  return {
    x: Math.max(70, Math.min(770, x)),
    y: Math.max(45, Math.min(475, y))
  };
}

export function stagePath(vowelOrId, throughStage = STAGES.length - 1, { includeHolds = false } = {}) {
  const vowel = typeof vowelOrId === "string" ? getVowel(vowelOrId) : vowelOrId;
  if (!vowel) throw new Error(`Unknown vowel: ${String(vowelOrId)}`);
  const end = clampStage(throughStage);
  const points = vowel.stages.slice(0, end + 1).map((stage, index) => ({
    stage: index,
    ...stage,
    ...chartPosition(stage)
  }));
  if (includeHolds) return points;
  return points.filter((point, index) => index === 0 || !sameState(vowel.stages[index - 1], vowel.stages[index]));
}

export function validateModel() {
  const errors = [];
  const ids = new Set();
  if (STAGES.length !== 9) errors.push(`Expected baseline plus eight steps; received ${STAGES.length} stages.`);

  for (const vowel of VOWELS) {
    if (!vowel.id || ids.has(vowel.id)) errors.push(`Duplicate or missing id: ${vowel.id}`);
    ids.add(vowel.id);
    if (vowel.stages.length !== STAGES.length) {
      errors.push(`${vowel.id}: expected ${STAGES.length} stages, received ${vowel.stages.length}`);
    }
    if (!Array.isArray(vowel.historicalExamples) || !vowel.historicalExamples.length) {
      errors.push(`${vowel.id}: historicalExamples must be nonempty.`);
    }
    vowel.stages.forEach((stage, index) => {
      if (!(stage.f1 >= 200 && stage.f1 <= 1000)) errors.push(`${vowel.id}[${index}]: F1 outside reference range`);
      if (!(stage.f2 >= 500 && stage.f2 <= 3000)) errors.push(`${vowel.id}[${index}]: F2 outside reference range`);
      if (stage.glide) {
        if (!(stage.glide.f1 >= 200 && stage.glide.f1 <= 1000)) errors.push(`${vowel.id}[${index}]: glide F1 outside reference range`);
        if (!(stage.glide.f2 >= 500 && stage.glide.f2 <= 3000)) errors.push(`${vowel.id}[${index}]: glide F2 outside reference range`);
      }
    });
  }

  STAGES.forEach((stage, index) => {
    const expected = [...stage.changes].sort();
    const observed = changedVowelsAtStage(index).map((vowel) => vowel.id).sort();
    if (expected.join("|") !== observed.join("|")) {
      errors.push(`${stage.id}: declared changes ${expected.join(",")} do not match model changes ${observed.join(",")}`);
    }
  });

  return errors;
}
