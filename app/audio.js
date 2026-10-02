// Sound work, with plain Node (no Electron): trim the silence at both ends of a
// take, measure it, and write it as MP3, a format World of Warcraft plays.

// LAME, the MP3 encoder (LGPL-3.0), as a JavaScript module.
let lame;
async function encoder() {
  if (!lame) lame = await import("@breezystack/lamejs");
  return lame;
}

const SAMPLE_RATE = 48000;
const KBPS = 96;

// Cuts the quiet start and end of a take (keeps a short breath of air).
function trim(samples, rate = SAMPLE_RATE, threshold = 0.012, padSeconds = 0.12) {
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > threshold) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return new Float32Array(0);
  const pad = Math.floor(padSeconds * rate);
  return samples.slice(Math.max(0, first - pad), Math.min(samples.length, last + pad + 1));
}

function toInt16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// Float32 samples (mono) -> { mp3: Buffer, seconds }
async function encode(samples, rate = SAMPLE_RATE) {
  const pcm = toInt16(samples);
  const { Mp3Encoder } = await encoder();
  const enc = new Mp3Encoder(1, rate, KBPS);
  const parts = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + block));
    if (out.length) parts.push(Buffer.from(out));
  }
  const end = enc.flush();
  if (end.length) parts.push(Buffer.from(end));
  return { mp3: Buffer.concat(parts), seconds: samples.length / rate };
}

module.exports = { SAMPLE_RATE, trim, encode, toInt16 };
