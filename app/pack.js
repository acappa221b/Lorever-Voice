// Builds a Lorever voice pack from recordings: the folder the game reads.
// No Electron here, so the tests can run it with plain Node.
//
//   LoreverNarration_enUS_<Name>/
//     LoreverNarration_enUS_<Name>.toc
//     Index.lua        which recording reads which section, and how long it lasts
//     audio/ab/abcdef0123456789.mp3
//
// The add-on (Lorever 1.8.0 or newer) reads the pack through
// LoreverNarrationInfo[id] and LoreverNarration[id][section key].

const JSZip = require("jszip");

// "Ana Lúcia!" -> "AnaLucia" (letters and digits only, for folder names).
function slug(name) {
  const plain = String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "");
  return plain.slice(0, 24) || "Narrator";
}

function luaString(s) {
  return '"' + String(s)
    .replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    .replace(/\r/g, "").replace(/\n/g, "\\n") + '"';
}

function names(language, narrator) {
  const s = slug(narrator);
  return {
    id: `${language}-${s.toLowerCase()}`,
    folder: `LoreverNarration_${language}_${s}`,
    title: `${String(narrator || "Narrator").trim() || "Narrator"}'s narration`,
  };
}

function audioPath(sectionId) {
  return `${sectionId.slice(0, 2)}/${sectionId}.mp3`;
}

// recordings: [{ index: "#section:...", id: "abcdef0123456789", seconds: 12.3 }]
function indexLua(language, narrator, recordings) {
  const n = names(language, narrator);
  const lines = [
    `-- ${n.folder}: a narration of Lorever recorded by ${String(narrator).replace(/\n/g, " ")} with Lorever Voice Studio.`,
    "-- Which recording reads each section of the Lorever narrator, and how long it lasts.",
    "LoreverNarration = LoreverNarration or {}",
    "LoreverNarrationInfo = LoreverNarrationInfo or {}",
    `LoreverNarrationInfo[${luaString(n.id)}] = { lang = ${luaString(language)}, title = ${luaString(n.title)}, folder = ${luaString(n.folder)}, custom = true }`,
    `LoreverNarration[${luaString(n.id)}] = {`,
  ];
  const sorted = [...recordings].sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0));
  for (const r of sorted) {
    lines.push(`\t[${luaString(r.index)}] = { ${luaString(audioPath(r.id))}, ${Number(r.seconds).toFixed(2)} },`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

function toc(language, narrator, version) {
  const n = names(language, narrator);
  return [
    "## Interface: 16001",
    `## Title: Lorever Narration (${n.title})`,
    `## Notes: ${n.title} for the Lorever narrator, recorded with Lorever Voice Studio. Needs Lorever 1.8.0 or newer.`,
    `## Author: ${String(narrator).replace(/\n/g, " ")}`,
    `## Version: ${version}`,
    "## RequiredDeps: Lorever",
    "",
    "Index.lua",
    "",
  ].join("\n");
}

// readAudio(id) -> Buffer of the mp3. Returns { buffer, folder, count }.
async function buildZip(language, narrator, recordings, readAudio, version) {
  const n = names(language, narrator);
  const zip = new JSZip();
  const root = zip.folder(n.folder);
  root.file(`${n.folder}.toc`, toc(language, narrator, version));
  root.file("Index.lua", indexLua(language, narrator, recordings));
  for (const r of recordings) {
    root.file(`audio/${audioPath(r.id)}`, await readAudio(r.id), { compression: "STORE" });
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, folder: n.folder, count: recordings.length };
}

module.exports = { slug, names, luaString, indexLua, toc, buildZip, audioPath };
