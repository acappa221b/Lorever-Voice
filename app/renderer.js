// The page: zones on the left, texts on the right, one recording per text.
"use strict";

const RATE = 48000;
const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  project: null,
  zone: null,
  current: null,      // id of the text that has the focus
  recording: null,    // { id, chunks: [] } while the microphone records
  player: null,
};

let audioCtx, micStream, micSource, processor;

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}

function recorded(id) {
  return !!state.project.recordings[id];
}

function linesOf(zone) {
  return zone.pages.flatMap((p) => p.lines);
}

// The same text can be on several pages; it is recorded once.
function uniqueCount(lines) {
  const ids = new Set(lines.map((l) => l.id));
  let done = 0;
  ids.forEach((id) => { if (recorded(id)) done++; });
  return { done, total: ids.size };
}

function renderTotal() {
  const all = state.data.zones.flatMap(linesOf);
  const c = uniqueCount(all);
  $("total").textContent = `${c.done} / ${c.total} recorded`;
}

function renderZones() {
  const nav = $("zones");
  nav.textContent = "";
  let group = null;
  for (const zone of state.data.zones) {
    if (zone.kind !== group) {
      group = zone.kind;
      const g = document.createElement("div");
      g.className = "group";
      g.textContent = group === "City" ? "Cities" : group === "Dungeon" ? "Dungeons" : "Zones";
      nav.append(g);
    }
    const c = uniqueCount(linesOf(zone));
    const row = document.createElement("div");
    row.className = "zone" + (state.zone === zone ? " active" : "") + (c.done === c.total ? " done" : "");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = zone.title;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = c.done === c.total ? `✓ ${c.total}` : `${c.done} / ${c.total}`;
    row.append(name, count);
    row.onclick = () => openZone(zone);
    nav.append(row);
  }
  renderTotal();
}

function button(label, cls, onclick) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = (e) => { e.stopPropagation(); onclick(); };
  return b;
}

function cardFor(line) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = line.id;

  const mark = document.createElement("div");
  mark.className = "mark";

  const content = document.createElement("div");
  content.className = "content";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = line.title || "";
  if (line.before) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "before discovery";
    title.append(tag);
  }
  const text = document.createElement("div");
  text.className = "text";
  text.textContent = line.text;
  content.append(title, text);

  const actions = document.createElement("div");
  actions.className = "actions";
  card.append(mark, content, actions);
  card.onclick = () => focus(line.id, false);
  card._line = line;
  paintCard(card);
  return card;
}

function paintCard(card) {
  const id = card.dataset.id;
  const rec = state.project.recordings[id];
  const busy = state.recording && state.recording.id === id;
  card.classList.toggle("recorded", !!rec);
  card.classList.toggle("current", state.current === id);
  card.querySelector(".mark").textContent = rec ? "✓" : "○";
  const actions = card.querySelector(".actions");
  actions.textContent = "";
  const rb = button(busy ? "■ Stop" : "● Record", "record" + (busy ? " on" : ""), () => toggleRecord(id, card._line.index));
  rb.disabled = !!state.recording && !busy;
  const pb = button("▶ Play", "", () => play(id));
  pb.disabled = !rec || !!state.recording;
  const del = button("✕ Delete", "", () => remove(id));
  del.disabled = !rec || !!state.recording;
  actions.append(rb, pb, del);
  if (rec) {
    const s = document.createElement("div");
    s.className = "seconds";
    s.textContent = `${rec.seconds.toFixed(1)} s`;
    actions.append(s);
  }
}

function paintAll(id) {
  document.querySelectorAll(".card").forEach((c) => { if (!id || c.dataset.id === id) paintCard(c); });
}

function openZone(zone) {
  state.zone = zone;
  const main = $("main");
  main.textContent = "";
  const h = document.createElement("h1");
  h.textContent = zone.title;
  main.append(h);
  for (const page of zone.pages) {
    const h2 = document.createElement("h2");
    h2.className = "page";
    h2.textContent = page.title;
    const kind = document.createElement("span");
    kind.className = "page-kind";
    kind.textContent = page.kind || "";
    h2.append(kind);
    main.append(h2);
    page.lines.forEach((line) => main.append(cardFor(line)));
  }
  main.scrollTop = 0;
  const first = linesOf(zone).find((l) => !recorded(l.id)) || linesOf(zone)[0];
  if (first) focus(first.id, true);
  renderZones();
}

function focus(id, scroll) {
  state.current = id;
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("current", c.dataset.id === id));
  if (scroll) {
    const card = document.querySelector(`.card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function focusNext(afterId) {
  const lines = linesOf(state.zone);
  const at = lines.findIndex((l) => l.id === afterId);
  const next = lines.slice(at + 1).find((l) => !recorded(l.id));
  if (next) focus(next.id, true);
}

// ---- microphone -------------------------------------------------------------

async function listMics() {
  const select = $("mic");
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
  const saved = localStorage.getItem("mic");
  select.textContent = "";
  devices.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = d.deviceId;
    o.textContent = d.label || `Microphone ${i + 1}`;
    if (d.deviceId === saved) o.selected = true;
    select.append(o);
  });
}

async function openMic() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (!audioCtx) audioCtx = new AudioContext({ sampleRate: RATE });
  const deviceId = $("mic").value;
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  if (micSource) micSource.disconnect();
  micSource = audioCtx.createMediaStreamSource(micStream);
  if (!processor) {
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      $("level").style.width = Math.min(100, peak * 140) + "%";
      if (state.recording) state.recording.chunks.push(new Float32Array(data));
    };
    processor.connect(audioCtx.destination);
  }
  micSource.connect(processor);
}

async function toggleRecord(id, index) {
  if (state.recording) return stopRecord();
  stopPlayer();
  try {
    if (!micStream) await openMic();
    if (audioCtx.state === "suspended") await audioCtx.resume();
  } catch (err) {
    toast("No microphone. Plug one in and choose it at the top.");
    return;
  }
  focus(id, false);
  state.recording = { id, index, chunks: [] };
  paintAll();
}

async function stopRecord() {
  const rec = state.recording;
  state.recording = null;
  const length = rec.chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let at = 0;
  for (const c of rec.chunks) { samples.set(c, at); at += c.length; }
  const result = await window.studio.save(rec.id, rec.index, samples);
  if (result.ok) {
    state.project.recordings[rec.id] = { index: rec.index, seconds: result.seconds };
    toast(`Saved (${result.seconds.toFixed(1)} s)`);
    paintAll();
    renderZones();
    focusNext(rec.id);
  } else {
    toast("Nothing was heard. Check the microphone and try again.");
    paintAll();
  }
}

// ---- play and delete --------------------------------------------------------

function stopPlayer() {
  if (state.player) {
    state.player.pause();
    URL.revokeObjectURL(state.player.src);
    state.player = null;
  }
}

async function play(id) {
  stopPlayer();
  const bytes = await window.studio.audio(id);
  if (!bytes) return toast("This recording is missing.");
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
  state.player = new Audio(url);
  state.player.play();
}

async function remove(id) {
  stopPlayer();
  if (!confirm("Delete this recording?")) return;
  await window.studio.remove(id);
  delete state.project.recordings[id];
  paintAll();
  renderZones();
  focus(id, false);
}

// ---- start ------------------------------------------------------------------

async function start() {
  state.data = await window.studio.data();
  state.project = await window.studio.project();
  $("narrator").value = state.project.narrator || "";
  $("narrator").onchange = async (e) => { state.project.narrator = await window.studio.setNarrator(e.target.value); };
  $("mic").onchange = async () => {
    localStorage.setItem("mic", $("mic").value);
    try { await openMic(); } catch { toast("This microphone does not answer."); }
  };
  $("export").onclick = async () => {
    if (state.recording) return;
    if (!($("narrator").value || "").trim()) {
      $("narrator").focus();
      return toast("Write your name first. It goes on the pack.");
    }
    state.project.narrator = await window.studio.setNarrator($("narrator").value);
    toast("Making the zip...");
    const r = await window.studio.exportPack();
    if (r.ok) toast(`Done: ${r.count} recordings in ${r.folder}`);
    else if (r.reason === "empty") toast("Record something first.");
  };
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    e.preventDefault();
    if (e.repeat || !state.current || !state.zone) return;
    const line = linesOf(state.zone).find((l) => l.id === state.current);
    if (line) toggleRecord(line.id, line.index);
  });
  renderZones();
  try {
    await openMic();
  } catch {
    toast("No microphone found yet.");
  }
  await listMics();
  navigator.mediaDevices.ondevicechange = listMics;
}

start();
