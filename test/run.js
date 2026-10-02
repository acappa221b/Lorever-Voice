// Plain Node tests: the sound work and the pack the game reads.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const audio = require("../app/audio");
const pack = require("../app/pack");

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("ok  " + name);
}

function tone(seconds, rate = 48000) {
  const s = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < s.length; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate);
  return s;
}

(async () => {
  await test("trim cuts the silence and keeps a short pad", () => {
    const quiet = new Float32Array(48000);
    const take = new Float32Array(48000 * 3);
    take.set(quiet, 0);
    take.set(tone(1), 48000);
    const t = audio.trim(take);
    assert(Math.abs(t.length / 48000 - 1.24) < 0.01, t.length / 48000);
    assert.strictEqual(audio.trim(new Float32Array(1000)).length, 0);
  });

  await test("encode makes an MP3 and measures it", async () => {
    const { mp3, seconds } = await audio.encode(tone(2));
    assert.strictEqual(seconds, 2);
    assert(mp3.length > 10000);
    assert(mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0, "MP3 frame sync");
  });

  await test("names and Lua strings", () => {
    assert.strictEqual(pack.slug("Ana Lúcia!"), "AnaLucia");
    assert.strictEqual(pack.slug(""), "Narrator");
    const n = pack.names("enUS", "Ana Lúcia");
    assert.strictEqual(n.id, "enUS-analucia");
    assert.strictEqual(n.folder, "LoreverNarration_enUS_AnaLucia");
    assert.strictEqual(pack.luaString('a "b" \\ c\nd'), '"a \\"b\\" \\\\ c\\nd"');
  });

  await test("the export zip has the folder the game reads", async () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "data", "enUS.json"), "utf8"));
    const lines = data.zones[0].pages[0].lines.slice(0, 2);
    const recs = lines.map((l) => ({ id: l.id, index: l.index, seconds: 3.456 }));
    const mp3 = (await audio.encode(tone(0.5))).mp3;
    const out = await pack.buildZip("enUS", "Test Voice", recs, async () => mp3, "2026.10.02");
    const zip = await JSZip.loadAsync(out.buffer);
    const f = "LoreverNarration_enUS_TestVoice/";
    assert(zip.file(f + "LoreverNarration_enUS_TestVoice.toc"));
    const toc = await zip.file(f + "LoreverNarration_enUS_TestVoice.toc").async("string");
    assert(toc.includes("## Interface: 16001") && toc.includes("## RequiredDeps: Lorever"));
    const lua = await zip.file(f + "Index.lua").async("string");
    assert(lua.includes('LoreverNarrationInfo["enUS-testvoice"]'));
    assert(lua.includes("3.46 }"));
    for (const r of recs) assert(zip.file(f + "audio/" + pack.audioPath(r.id)), r.id);
    if (process.env.STUDIO_OUT) fs.writeFileSync(process.env.STUDIO_OUT, out.buffer);
  });

  console.log(`${passed} tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
