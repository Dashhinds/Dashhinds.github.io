import {
  STAGES,
  VOWELS,
  MODEL_LIMITS,
  MODEL_VERSION,
  clampStage,
  didChangeAt,
  changedVowelsAtStage,
  chartPosition,
  glideChartPosition,
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
  audioStatusTimer: null,
  audioSource: "original",
  recordingCache: new Map(),
  dictation: null,
  dictationWanted: false,
  dictationBase: "",
  dictationFinal: "",
  playToken: null,
  memoRecorder: null,
  memoChunks: [],
  nodes: new Map(),
  moving: new Set()
};

const REDUCED_MOTION = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
// The applet moved a letter 5 px per 50 ms frame on a 595×400 canvas; this chart is about 2× that scale.
const APPLET_MS_PER_CHART_PX = 5;
const glideDuration = (dx, dy) => Math.max(450, Math.min(1800, Math.round(Math.hypot(dx, dy) * APPLET_MS_PER_CHART_PX)));

const FEEDBACK_ISSUE_URL = "https://github.com/Dashhinds/Dashhinds.github.io/issues/new";

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
    const chartPoint = chartPosition(current);
    const glidePoint = glideChartPosition(current);

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

    let node = state.nodes.get(vowel.id);
    if (!node) {
      const group = svgEl("g", { role: "button", tabindex: "0", "data-vowel-id": vowel.id });
      const circle = svgEl("circle", { cx: chartPoint.x, cy: chartPoint.y, r: 19 });
      const label = svgEl("text", { x: chartPoint.x, y: chartPoint.y + 6, "text-anchor": "middle" });
      group.append(circle, label);
      const activate = () => setSelected(vowel.id);
      group.addEventListener("click", activate);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      node = { group, circle, label, x: chartPoint.x, y: chartPoint.y };
      state.nodes.set(vowel.id, node);
    }
    node.group.setAttribute("class", `vowel-node ${vowel.colorToken}${selected ? " selected" : ""}${changed ? " changed" : " held"}${state.moving.has(vowel.id) ? " moving" : ""}`);
    node.group.setAttribute("aria-label", `${vowel.series}, ${vowel.keyword}, ${current.ipa}. ${changed ? "Changes in this step." : "Holds its prior value in this step."}`);
    node.circle.setAttribute("r", selected ? 25 : 19);
    node.label.textContent = current.ipa.replaceAll("/", "");
    placeNode(node, chartPoint.x, chartPoint.y, { animate: true });
    vowelLayer.append(node.group);
  });
}

/** Move a vowel node to a chart position; glides at the applet's pace unless motion is reduced. */
function placeNode(node, x, y, { animate = false, duration = null } = {}) {
  const dx = node.x - x;
  const dy = node.y - y;
  node.circle.setAttribute("cx", x);
  node.circle.setAttribute("cy", y);
  node.label.setAttribute("x", x);
  node.label.setAttribute("y", y + 6);
  node.x = x;
  node.y = y;
  if (!animate || REDUCED_MOTION.matches || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) || typeof node.group.animate !== "function") {
    return Promise.resolve();
  }
  const animation = node.group.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
    { duration: duration ?? glideDuration(dx, dy), easing: "linear", fill: "none" }
  );
  return animation.finished.catch(() => {});
}

/** Replay one vowel's movement into the current stage: back to its previous place, then glide. */
async function glideVowel(vowel, fromStage, toStage) {
  const node = state.nodes.get(vowel.id);
  if (!node) return;
  const from = chartPosition(vowel.stages[fromStage]);
  const to = chartPosition(vowel.stages[toStage]);
  state.moving.add(vowel.id);
  node.group.classList.add("moving");
  node.label.textContent = vowel.stages[fromStage].ipa.replaceAll("/", "");
  await placeNode(node, from.x, from.y, { animate: false });
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  await placeNode(node, to.x, to.y, { animate: true });
  node.label.textContent = vowel.stages[toStage].ipa.replaceAll("/", "");
  state.moving.delete(vowel.id);
  node.group.classList.remove("moving");
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
  state.playToken = null;
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

async function loadRecording(name) {
  if (state.recordingCache.has(name)) return state.recordingCache.get(name);
  const context = ensureAudioContext();
  const pending = (async () => {
    const response = await fetch(`assets/original-sounds/${name}.wav`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${name}.wav`);
    const bytes = await response.arrayBuffer();
    return await context.decodeAudioData(bytes);
  })();
  state.recordingCache.set(name, pending);
  try {
    return await pending;
  } catch (error) {
    state.recordingCache.delete(name);
    throw error;
  }
}

function playBuffer(buffer, { delay = 0 } = {}) {
  const context = ensureAudioContext();
  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const output = context.createGain();
  output.gain.value = 0.9;
  source.connect(output);
  output.connect(context.destination);
  source.start(start);
  state.activeAudio.push(source, output);
  return start + buffer.duration;
}

/**
 * Play one vowel state. Original recordings are the default (the 2000 applet's own clips);
 * if the recording cannot be fetched or decoded, the synthesized approximation plays instead and
 * the caller is told so through the returned `fallback` flag.
 */
async function playPoint(point, { delay = 0, duration = 0.95 } = {}) {
  if (state.audioSource === "original" && point.original?.sound) {
    try {
      const buffer = await loadRecording(point.original.sound);
      return { end: playBuffer(buffer, { delay }), source: "original", fallback: false };
    } catch (error) {
      return { end: synthesize(point, { duration, delay }), source: "synth", fallback: true, reason: error.message };
    }
  }
  return { end: synthesize(point, { duration, delay }), source: "synth", fallback: false };
}

function describeSource(result) {
  if (result.fallback) return " (recording unavailable, synthesized instead)";
  return result.source === "original" ? " (original recording)" : " (synthesized)";
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * "Hear this step" follows the original applet's sequence when the selected vowel moves in this
 * step: play the sound it had before, glide the letter to its new place, then play the new sound.
 * When the vowel holds its value, only the current sound plays.
 */
async function playSelected() {
  stopAudio({ announce: false });
  try {
    const vowel = selectedVowel();
    const context = ensureAudioContext();
    const stage = state.stage;
    const token = Symbol("play");
    state.playToken = token;
    if (stage > 0 && didChangeAt(vowel, stage)) {
      const before = vowel.stages[stage - 1];
      const after = vowel.stages[stage];
      setAudioStatus(`Playing ${vowel.series}: ${before.ipa} before ${STAGES[stage].label}…`, true);
      const first = await playPoint(before, { duration: 0.8 });
      await wait(Math.max(0, (first.end - context.currentTime) * 1000) + 120);
      if (state.playToken !== token) return;
      setAudioStatus(`Moving ${vowel.series} from ${before.ipa} to ${after.ipa}…`, true);
      await glideVowel(vowel, stage - 1, stage);
      if (state.playToken !== token) return;
      const second = await playPoint(after, { duration: 0.95 });
      const ms = Math.max(400, Math.ceil((second.end - context.currentTime) * 1000) + 150);
      setAudioStatus(`Playing ${vowel.series} at ${STAGES[stage].label}${describeSource(second)}.`, true, ms);
      return;
    }
    const result = await playPoint(vowel.stages[stage]);
    const ms = Math.max(400, Math.ceil((result.end - context.currentTime) * 1000) + 150);
    setAudioStatus(`Playing ${vowel.series} at ${STAGES[stage].label}${describeSource(result)}.`, true, ms);
  } catch (error) {
    setAudioStatus(`Audio error: ${error.message}`, false);
  }
}

async function compareSelected() {
  stopAudio({ announce: false });
  try {
    const vowel = selectedVowel();
    const context = ensureAudioContext();
    const first = await playPoint(vowel.stages[0], { duration: 0.8, delay: 0 });
    const gap = Math.max(0.2, first.end - context.currentTime) + 0.25;
    const second = await playPoint(vowel.stages[state.stage], { duration: 0.8, delay: gap });
    const ms = Math.max(400, Math.ceil((second.end - context.currentTime) * 1000) + 150);
    setAudioStatus(`Comparing ${vowel.series}: start, then ${STAGES[state.stage].label}${describeSource(second)}.`, true, ms);
  } catch (error) {
    setAudioStatus(`Audio error: ${error.message}`, false);
  }
}

async function playAll() {
  stopAudio({ announce: false });
  try {
    const context = ensureAudioContext();
    let delay = 0;
    let last = null;
    for (const vowel of VOWELS) {
      last = await playPoint(vowel.stages[state.stage], { duration: 0.58, delay });
      delay = Math.max(0, last.end - context.currentTime) + 0.18;
    }
    const ms = Math.max(400, Math.ceil(delay * 1000) + 150);
    setAudioStatus(`Playing all seven series at ${STAGES[state.stage].label}${describeSource(last)}.`, true, ms);
  } catch (error) {
    setAudioStatus(`Audio error: ${error.message}`, false);
  }
}

function setAudioSource(value) {
  state.audioSource = value === "synth" ? "synth" : "original";
  stopAudio({ announce: false });
  setAudioStatus(state.audioSource === "original" ? "Sound source: original 2000 recordings." : "Sound source: browser-synthesized approximation.", false, 2200);
}

/* ---------- Feedback: dictation and a pre-filled GitHub issue ---------- */

function feedbackText() {
  return $("#feedback-text").value.trim();
}

function setFeedbackStatus(message) {
  $("#feedback-status").textContent = message;
}

function buildFeedbackIssueUrl(text) {
  const title = "GVS feedback: " + (text.split(/\s+/).slice(0, 8).join(" ") || "note").slice(0, 70);
  const body = [
    text,
    "",
    "---",
    `Page: ${location.href}`,
    `Model: ${MODEL_VERSION}`,
    `Sent from the feedback box on ${new Date().toISOString().slice(0, 10)}`
  ].join("\n");
  const params = new URLSearchParams({ title, body, labels: "gvs-feedback" });
  return `${FEEDBACK_ISSUE_URL}?${params.toString()}`;
}

function sendFeedback(event) {
  event.preventDefault();
  const text = feedbackText();
  if (!text) {
    setFeedbackStatus("Write or dictate something first.");
    $("#feedback-text").focus();
    return;
  }
  const url = buildFeedbackIssueUrl(text);
  const opened = window.open(url, "_blank", "noopener");
  setFeedbackStatus(opened
    ? "A GitHub issue form opened in a new tab with your text filled in. Press its green button to submit."
    : "Your browser blocked the new tab. Allow pop-ups for this page, or copy the text and open GitHub yourself.");
}

async function copyFeedback() {
  const text = feedbackText();
  if (!text) { setFeedbackStatus("Nothing to copy yet."); return; }
  try {
    await navigator.clipboard.writeText(text);
    setFeedbackStatus("Copied. Paste it anywhere you like, for example into a GitHub issue.");
  } catch {
    setFeedbackStatus("Copy failed; select the text and copy it by hand.");
  }
}

function isSafari() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}

function dictationButton(pressed) {
  const button = $("#feedback-dictate");
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
  button.textContent = pressed ? "■ Stop dictating" : "🎙 Dictate";
}

function renderDictation(interim = "") {
  const textarea = $("#feedback-text");
  textarea.value = (state.dictationBase + state.dictationFinal + interim).replace(/\s+$/, "");
}

/**
 * Dictation: browser speech recognition, hardened after a field report that nothing appeared.
 * - asks for the microphone explicitly first, so a denied permission is reported instead of silent;
 * - keeps final text across the engine's own restarts (Chrome ends a session after silence);
 * - shows what was heard as it arrives and names every failure in the status line;
 * - offers a recorded voice memo when recognition is unavailable or fails.
 */
async function toggleDictation() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (state.dictation || state.dictationWanted) {
    state.dictationWanted = false;
    try { state.dictation?.stop(); } catch {}
    return;
  }
  if (!window.isSecureContext) {
    setFeedbackStatus("Dictation needs a secure (https) page. Please type instead.");
    return;
  }
  if (!Recognition) {
    setFeedbackStatus("This browser has no built-in speech recognition (Firefox does not). Use \"Record voice memo\" below, or type.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    setFeedbackStatus(`Microphone access was refused (${error.name}). Allow the microphone for this site, then try again, or type.`);
    return;
  }
  const textarea = $("#feedback-text");
  state.dictationBase = textarea.value ? textarea.value.replace(/\s+$/, "") + " " : "";
  state.dictationFinal = "";
  state.dictationWanted = true;
  let heard = 0;

  const startSession = () => {
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.continuous = !isSafari();
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let sessionFinal = "";
    recognition.onstart = () => setFeedbackStatus("Listening… speak your note. Press the button again to stop.");
    recognition.onresult = (event) => {
      let interim = "";
      sessionFinal = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) sessionFinal += chunk + " ";
        else interim += chunk;
      }
      heard = (state.dictationFinal + sessionFinal + interim).trim().split(/\s+/).filter(Boolean).length;
      renderDictation(sessionFinal + interim);
      setFeedbackStatus(`Listening… heard ${heard} word${heard === 1 ? "" : "s"} so far. Press the button again to stop.`);
    };
    recognition.onerror = (event) => {
      const reasons = {
        "not-allowed": "the microphone or speech service was not allowed",
        "service-not-allowed": "speech recognition is disabled on this device (on a Mac: System Settings → Keyboard → Dictation)",
        "audio-capture": "no microphone was found",
        network: "the speech service could not be reached",
        "no-speech": "no speech was detected",
        aborted: "dictation was aborted"
      };
      if (event.error !== "no-speech" && event.error !== "aborted") state.dictationWanted = false;
      setFeedbackStatus(`Dictation problem: ${reasons[event.error] || event.error}. You can type, or use \"Record voice memo\".`);
    };
    recognition.onend = () => {
      state.dictationFinal += sessionFinal;
      sessionFinal = "";
      renderDictation("");
      state.dictation = null;
      if (state.dictationWanted) {
        // Chrome ends a session after a pause even in continuous mode; keep listening until told to stop.
        try { startSession(); return; } catch {}
        state.dictationWanted = false;
      }
      dictationButton(false);
      setFeedbackStatus(heard
        ? `Dictation finished with ${heard} word${heard === 1 ? "" : "s"}. Check the text, then send or copy it.`
        : "Dictation finished but nothing was heard. Check the microphone, speak a little louder, or type.");
    };
    state.dictation = recognition;
    dictationButton(true);
    recognition.start();
  };

  try {
    startSession();
  } catch (error) {
    state.dictation = null;
    state.dictationWanted = false;
    dictationButton(false);
    setFeedbackStatus(`Dictation could not start: ${error.message}. You can type, or use \"Record voice memo\".`);
  }
}

/** Voice-memo fallback: record in the browser, download the file, attach it to the GitHub issue. */
async function toggleMemo() {
  const button = $("#feedback-memo");
  if (state.memoRecorder) {
    state.memoRecorder.stop();
    return;
  }
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    setFeedbackStatus("This browser cannot record audio here. Please type your note.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    state.memoChunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) state.memoChunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(state.memoChunks, { type: recorder.mimeType || "audio/webm" });
      const extension = /mp4/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gvs-voice-memo-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      state.memoRecorder = null;
      button.setAttribute("aria-pressed", "false");
      button.textContent = "⏺ Record voice memo";
      const textarea = $("#feedback-text");
      if (!textarea.value.trim()) textarea.value = "Voice memo attached (see file).";
      setFeedbackStatus(`Voice memo saved to your downloads (${Math.round(blob.size / 1024)} KB). Press \"Send to GitHub\", then drag the file into the issue box to attach it.`);
    };
    recorder.start();
    state.memoRecorder = recorder;
    button.setAttribute("aria-pressed", "true");
    button.textContent = "■ Stop recording";
    setFeedbackStatus("Recording… press the button again to stop and save the memo.");
  } catch (error) {
    setFeedbackStatus(`Recording could not start (${error.name}). Allow the microphone, or type your note.`);
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
  document.querySelectorAll('input[name="audio-source"]').forEach((input) => {
    input.addEventListener("change", (event) => setAudioSource(event.target.value));
  });
  $("#feedback-form").addEventListener("submit", sendFeedback);
  $("#feedback-copy").addEventListener("click", copyFeedback);
  $("#feedback-dictate").addEventListener("click", toggleDictation);
  $("#feedback-memo").addEventListener("click", toggleMemo);
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
