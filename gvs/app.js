import {
  STAGES,
  VOWELS,
  MODEL_LIMITS,
  MODEL_VERSION,
  clampStage,
  didChangeAt,
  changedVowelsAtStage,
  formantsToChart,
  getVowel,
  interpolatePoint,
  stagePath,
  validateModel
} from "./model.js";
import { REFERENCES } from "./content.js";

const $ = (selector) => document.querySelector(selector);
const el = (name, attributes = {}, text = "") => {
  const node = document.createElement(name);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === "class") node.className = value;
    else if (key.startsWith("data-")) node.setAttribute(key, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
  if (text) node.textContent = text;
  return node;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
};

const state = {
  stage: 0,
  selectedId: "bite",
  playingTimeline: false,
  timelineTimer: null,
  audioContext: null,
  activeAudio: [],
  audioStatusTimer: null
};

function selectedVowel() {
  return getVowel(state.selectedId) ?? VOWELS[0];
}

function setStage(value, { focus = false } = {}) {
  state.stage = clampStage(value);
  $("#stage-slider").value = String(state.stage);
  update();
  writeUrlState();
  if (focus) $("#stage-slider").focus();
}

function setSelected(id, { focus = false } = {}) {
  if (!getVowel(id)) return;
  state.selectedId = id;
  update();
  writeUrlState();
  if (focus) document.querySelector(`[data-vowel-id="${CSS.escape(id)}"]`)?.focus();
}

function writeUrlState() {
  const params = new URLSearchParams();
  params.set("stage", String(state.stage));
  params.set("vowel", state.selectedId);
  const next = `${location.pathname}${location.search}#${params.toString()}`;
  history.replaceState(null, "", next);
}

function readUrlState() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (params.has("stage")) state.stage = clampStage(params.get("stage"));
  if (getVowel(params.get("vowel"))) state.selectedId = params.get("vowel");
}

function buildTicks() {
  const wrap = $("#stage-ticks");
  wrap.replaceChildren();
  STAGES.forEach((stage, index) => {
    const button = el("button", {
      type: "button",
      class: "tick",
      "data-stage": String(index),
      title: `${stage.label}: ${stage.formula}`,
      "aria-label": `${stage.short === "ME" ? "Baseline" : `Step ${stage.short}`}: ${stage.label}. ${stage.formula}`
    });
    button.append(
      el("span", {}, stage.short),
      el("small", {}, stage.label)
    );
    button.addEventListener("click", () => setStage(index, { focus: true }));
    wrap.append(button);
  });
}

function buildKey() {
  const wrap = $("#vowel-key");
  wrap.replaceChildren();
  VOWELS.forEach((vowel) => {
    const button = el("button", {
      type: "button",
      class: `key-item ${vowel.colorToken}`,
      "data-vowel-id": vowel.id,
      "aria-pressed": String(vowel.id === state.selectedId)
    });
    button.append(
      el("span", { class: "swatch", "aria-hidden": "true" }),
      el("span", {}, vowel.series),
      el("small", {}, vowel.keyword)
    );
    button.addEventListener("click", () => setSelected(vowel.id));
    wrap.append(button);
  });
}

function pathData(points) {
  if (!points.length) return "";
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function renderChart() {
  const pathLayer = $("#paths-layer");
  const vowelLayer = $("#vowels-layer");
  pathLayer.replaceChildren();
  vowelLayer.replaceChildren();

  const showPaths = $("#show-paths").checked;

  VOWELS.forEach((vowel) => {
    const selected = vowel.id === state.selectedId;
    const changed = didChangeAt(vowel, state.stage);
    const current = interpolatePoint(vowel, state.stage);
    const chartPoint = formantsToChart(current.f1, current.f2);
    const glidePoint = current.glide
      ? formantsToChart(current.glide.f1, current.glide.f2)
      : null;

    if (showPaths) {
      const points = stagePath(vowel, state.stage);
      if (points.length > 1) {
        const path = svgEl("path", {
          d: pathData(points),
          class: `trajectory ${vowel.colorToken}${selected ? " selected" : ""}`,
          "marker-end": `url(#arrow-${vowel.colorToken})`
        });
        pathLayer.append(path);
      }

      points.slice(0, -1).forEach((point) => {
        pathLayer.append(svgEl("circle", {
          cx: point.x,
          cy: point.y,
          r: selected ? 4.5 : 3,
          class: `history-point ${vowel.colorToken}`
        }));
      });
    }

    if (glidePoint) {
      vowelLayer.append(svgEl("line", {
        x1: chartPoint.x,
        y1: chartPoint.y,
        x2: glidePoint.x,
        y2: glidePoint.y,
        class: `glide-line ${vowel.colorToken}${selected ? " selected" : ""}`,
        "marker-end": `url(#arrow-${vowel.colorToken})`
      }));
    }

    const group = svgEl("g", {
      class: `vowel-node ${vowel.colorToken}${selected ? " selected" : ""}${changed ? " changed" : " held"}`,
      role: "button",
      tabindex: "0",
      "aria-label": `${vowel.series}, ${vowel.keyword}, ${current.ipa}. ${changed ? "Changes in this step." : "Holds its prior value in this step."}`,
      "data-vowel-id": vowel.id
    });
    const circle = svgEl("circle", {
      cx: chartPoint.x,
      cy: chartPoint.y,
      r: selected ? 25 : 19
    });
    const label = svgEl("text", {
      x: chartPoint.x,
      y: chartPoint.y + 6,
      "text-anchor": "middle"
    });
    label.textContent = current.ipa.replaceAll("/", "");
    group.append(circle, label);

    const activate = () => setSelected(vowel.id);
    group.addEventListener("click", activate);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
    vowelLayer.append(group);
  });
}

function renderStage() {
  const stage = STAGES[state.stage];
  const changed = changedVowelsAtStage(state.stage);
  $("#stage-date").textContent = stage.date;
  $("#stage-label").textContent = stage.label;
  $("#stage-formula").textContent = stage.formula;
  $("#stage-note").textContent = stage.note;
  $("#stage-moves").textContent = state.stage === 0
    ? "Select a numbered step to isolate the series that move there."
    : `Moves in this step: ${changed.map((vowel) => `${vowel.series} (${vowel.keyword})`).join(", ")}.`;
  $("#stage-slider").setAttribute(
    "aria-valuetext",
    `${stage.short === "ME" ? "Baseline" : `Step ${stage.short}`}: ${stage.label}`
  );
  $("#previous-stage").disabled = state.stage === 0;
  $("#next-stage").disabled = state.stage === STAGES.length - 1;

  document.querySelectorAll("[data-stage]").forEach((button) => {
    const active = Number(button.dataset.stage) === state.stage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "step" : "false");
  });
}

function renderDetails() {
  const vowel = selectedVowel();
  const point = vowel.stages[state.stage];
  const previous = state.stage > 0 ? vowel.stages[state.stage - 1] : null;
  const changed = didChangeAt(vowel, state.stage);
  $("#selected-series").textContent = vowel.series;
  $("#selected-ipa").textContent = point.ipa;
  $("#selected-transition").textContent = state.stage === 0
    ? `Starting value · ${STAGES[0].label}`
    : changed
      ? `This step: ${previous.ipa} → ${point.ipa} · Cumulative: ${vowel.stages[0].ipa} → ${point.ipa}`
      : `No move for this series in Step ${state.stage} · Cumulative: ${vowel.stages[0].ipa} → ${point.ipa}`;
  $("#selected-transition").classList.toggle("changed", changed);
  $("#selected-keyword").textContent = vowel.keyword;
  $("#selected-example").textContent = vowel.historicalExamples.join(", ");
  $("#selected-modern").textContent = vowel.modernReference;
  $("#selected-spelling").textContent = vowel.spellingHint;
  $("#selected-caveat").textContent = vowel.caveat;

  document.querySelectorAll("[data-vowel-id]").forEach((node) => {
    const active = node.dataset.vowelId === state.selectedId;
    node.classList.toggle("selected", active);
    if (node.matches("button")) node.setAttribute("aria-pressed", String(active));
  });
}

function renderInventory() {
  const body = $("#inventory-body");
  body.replaceChildren();
  VOWELS.forEach((vowel) => {
    const point = vowel.stages[state.stage];
    const changed = didChangeAt(vowel, state.stage);
    const row = el("tr");
    if (vowel.id === state.selectedId) row.classList.add("selected-row");
    if (changed) row.classList.add("changed-row");
    const heading = el("th", { scope: "row" });
    const selectButton = el("button", {
      type: "button",
      "data-table-vowel": vowel.id
    });
    selectButton.append(
      el("span", { class: `table-swatch ${vowel.colorToken}`, "aria-hidden": "true" }),
      document.createTextNode(vowel.series)
    );
    selectButton.addEventListener("click", () => setSelected(vowel.id));
    heading.append(selectButton);

    const examples = el("td", {}, vowel.historicalExamples.join(", "));
    const movement = el("td");
    movement.append(el(
      "span",
      { class: `movement-pill ${changed ? "moves" : "holds"}` },
      state.stage === 0 ? "Input" : changed ? "Moves" : "Holds"
    ));
    const currentIpa = el("td");
    currentIpa.append(el("strong", {}, point.ipa));
    const modern = el("td", {}, vowel.modernReference);
    row.append(heading, examples, movement, currentIpa, modern);
    body.append(row);
  });
}

function update() {
  renderStage();
  renderChart();
  renderDetails();
  renderInventory();
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is not supported by this browser.");
  if (!state.audioContext) state.audioContext = new AudioContextClass();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
  return state.audioContext;
}

function setAudioStatus(message, active = false, clearAfterMs = 0) {
  clearTimeout(state.audioStatusTimer);
  $("#audio-status").textContent = message;
  $("#stop-audio").disabled = !active;
  if (clearAfterMs) {
    state.audioStatusTimer = setTimeout(() => {
      $("#audio-status").textContent = "Sound is idle.";
      $("#stop-audio").disabled = true;
    }, clearAfterMs);
  }
}

function stopAudio({ announce = true } = {}) {
  clearTimeout(state.audioStatusTimer);
  state.activeAudio.forEach((node) => {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  });
  state.activeAudio = [];
  if (announce) setAudioStatus("Sound stopped.", false, 1200);
  else setAudioStatus("Sound is idle.", false);
}

function synthesize(point, { duration = 0.95, delay = 0 } = {}) {
  const context = ensureAudioContext();
  const start = context.currentTime + delay;
  const end = start + duration;
  const source = context.createOscillator();
  source.type = "sawtooth";
  source.frequency.setValueAtTime(118, start);
  source.frequency.linearRampToValueAtTime(112, end);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(0.22, start + 0.035);
  envelope.gain.setValueAtTime(0.22, Math.max(start + 0.04, end - 0.08));
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);

  const output = context.createGain();
  output.gain.value = 0.72;
  output.connect(context.destination);

  const targets = [
    { frequency: point.f1, gain: 0.95, q: 11 },
    { frequency: point.f2, gain: 0.42, q: 13 },
    { frequency: 2850, gain: 0.13, q: 10 }
  ];

  source.connect(envelope);
  targets.forEach((target, index) => {
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = target.q;
    filter.frequency.setValueAtTime(target.frequency, start);
    if (point.glide && index < 2) {
      filter.frequency.linearRampToValueAtTime(index === 0 ? point.glide.f1 : point.glide.f2, end);
    }
    const gain = context.createGain();
    gain.gain.value = target.gain;
    envelope.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    state.activeAudio.push(filter, gain);
  });

  source.start(start);
  source.stop(end + 0.02);
  state.activeAudio.push(source, envelope, output);
  return end;
}

async function playSelected() {
  stopAudio({ announce: false });
  try {
    const vowel = selectedVowel();
    synthesize(vowel.stages[state.stage]);
    setAudioStatus(`Playing ${vowel.series} at ${STAGES[state.stage].label}.`, true, 1150);
  } catch (error) {
    setAudioStatus(`Audio error: ${error.message}`, false);
  }
}

async function compareSelected() {
  stopAudio({ announce: false });
  try {
    const vowel = selectedVowel();
    synthesize(vowel.stages[0], { duration: 0.8, delay: 0 });
    synthesize(vowel.stages[state.stage], { duration: 0.8, delay: 1.0 });
    setAudioStatus(`Comparing ${vowel.series}: start, then ${STAGES[state.stage].label}.`, true, 2050);
  } catch (error) {
    setAudioStatus(`Audio error: ${error.message}`, false);
  }
}

async function playAll() {
  stopAudio({ announce: false });
  try {
    let delay = 0;
    VOWELS.forEach((vowel) => {
      synthesize(vowel.stages[state.stage], { duration: 0.58, delay });
      delay += 0.72;
    });
    setAudioStatus(`Playing all seven series at ${STAGES[state.stage].label}.`, true, Math.ceil(delay * 1000));
  } catch (error) {
    setAudioStatus(`Audio error: ${error.message}`, false);
  }
}

function stopTimeline() {
  state.playingTimeline = false;
  clearInterval(state.timelineTimer);
  state.timelineTimer = null;
  $("#play-timeline").textContent = "Play timeline";
  $("#play-timeline").setAttribute("aria-pressed", "false");
}

function toggleTimeline() {
  if (state.playingTimeline) {
    stopTimeline();
    return;
  }
  state.playingTimeline = true;
  $("#play-timeline").textContent = "Pause timeline";
  $("#play-timeline").setAttribute("aria-pressed", "true");
  if (state.stage >= STAGES.length - 1) setStage(0);
  state.timelineTimer = setInterval(() => {
    if (state.stage >= STAGES.length - 1) {
      stopTimeline();
      return;
    }
    setStage(state.stage + 1);
  }, 1250);
}

function buildReferences() {
  const list = $("#reference-list");
  REFERENCES.forEach((reference) => {
    const item = el("li");
    const link = el("a", {
      href: reference.url,
      target: "_blank",
      rel: "noreferrer"
    }, reference.title);
    item.append(link, document.createTextNode(` — ${reference.kind}`));
    list.append(item);
  });
}

function buildModelLimits() {
  const list = $("#model-limits");
  MODEL_LIMITS.forEach((limit) => list.append(el("li", {}, limit)));
}

function bindEvents() {
  $("#stage-slider").addEventListener("input", (event) => setStage(event.target.value));
  $("#previous-stage").addEventListener("click", () => setStage(state.stage - 1, { focus: true }));
  $("#next-stage").addEventListener("click", () => setStage(state.stage + 1, { focus: true }));
  $("#play-timeline").addEventListener("click", toggleTimeline);
  $("#show-paths").addEventListener("change", renderChart);
  $("#play-vowel").addEventListener("click", playSelected);
  $("#compare-vowel").addEventListener("click", compareSelected);
  $("#play-all").addEventListener("click", playAll);
  $("#stop-audio").addEventListener("click", () => stopAudio());
  $("#open-method").addEventListener("click", () => {
    const dialog = $("#model-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else location.hash = "method";
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, button, a, summary")) return;
    if (event.key === "ArrowLeft") setStage(state.stage - 1);
    if (event.key === "ArrowRight") setStage(state.stage + 1);
    if (event.key === " ") {
      event.preventDefault();
      playSelected();
    }
  });

  addEventListener("hashchange", () => {
    readUrlState();
    $("#stage-slider").value = String(state.stage);
    update();
  });
}

function selfTest() {
  const errors = validateModel();
  const required = [
    "#vowel-chart", "#stage-slider", "#vowels-layer", "#inventory-body",
    "#play-vowel", "#model-dialog"
  ];
  required.push("#stage-formula", "#stage-moves", "#selected-modern");
  required.forEach((selector) => {
    if (!document.querySelector(selector)) errors.push(`Missing DOM node: ${selector}`);
  });
  if (document.querySelectorAll("#inventory-body tr").length !== VOWELS.length) {
    errors.push("Inventory row count does not match the model.");
  }
  if (document.querySelectorAll("#stage-ticks [data-stage]").length !== STAGES.length) {
    errors.push("Stage-tick count does not match the model.");
  }
  const marker = $("#self-test");
  marker.textContent = errors.length
    ? `GVS_SELF_TEST:FAIL:${errors.join("|")}`
    : "GVS_SELF_TEST:PASS";
  document.documentElement.dataset.selfTest = errors.length ? "fail" : "pass";
  window.__GVS_SELF_TEST__ = { pass: !errors.length, errors };
}

function init() {
  readUrlState();
  buildTicks();
  buildKey();
  buildReferences();
  buildModelLimits();
  bindEvents();
  $("#stage-slider").min = "0";
  $("#stage-slider").max = String(STAGES.length - 1);
  $("#stage-slider").value = String(state.stage);
  document.documentElement.dataset.modelVersion = MODEL_VERSION;
  $("#model-version").textContent = MODEL_VERSION;
  update();
  selfTest();
  window.__GVS_READY__ = true;
}

init();
