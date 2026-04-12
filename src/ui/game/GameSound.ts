/**
 * Programmatic game sound effects using the Web Audio API — no audio files required.
 * Direct port of Android's GameSound.kt: all sounds are synthesized on the fly.
 */

const SAMPLE_RATE = 22050;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

function playBuffer(samples: Float32Array): void {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const buffer = audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) channel[i] = samples[i];
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}

function msToSamples(ms: number): number {
  return Math.floor(SAMPLE_RATE * ms / 1000);
}

// ── Sound builders (matching Android's GameSound.kt) ─────────────────────────

function buildExplosion(): Float32Array {
  const len = msToSamples(350);
  const buf = new Float32Array(len);
  let seed = 0xDEADBEEF;
  const nextRand = () => {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
    return (seed & 0xFFFF) / 0x8000 - 1;
  };
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-5.0 * i / len);
    const noise = nextRand();
    const rumble = Math.sin(2 * Math.PI * 80 * i / SAMPLE_RATE);
    buf[i] = (noise * 0.65 + rumble * 0.35) * env * 0.75;
  }
  return buf;
}

function buildSplash(): Float32Array {
  const len = msToSamples(420);
  const buf = new Float32Array(len);
  let seed = 0xC0FFEE;
  const nextRand = () => {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
    return (seed & 0xFFFF) / 0x8000 - 1;
  };
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / len;
    const freq = 700 * Math.exp(-3.5 * progress) + 120;
    const env = Math.exp(-4.0 * progress);
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.6;
    const noise = nextRand() * 0.4;
    buf[i] = (tone + noise) * env * 0.55;
  }
  return buf;
}

function buildClick(): Float32Array {
  const len = msToSamples(90);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-28.0 * i / len);
    const tone = Math.sin(2 * Math.PI * 1100 * t);
    buf[i] = tone * env * 0.45;
  }
  return buf;
}

function buildThud(): Float32Array {
  const len = msToSamples(160);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-14.0 * i / len);
    const body = Math.sin(2 * Math.PI * 170 * t) * 0.7;
    const click = Math.sin(2 * Math.PI * 900 * t) * Math.exp(-45.0 * i / len) * 0.3;
    buf[i] = (body + click) * env * 0.6;
  }
  return buf;
}

function buildSecurityAlarm(): Float32Array {
  const segLen = msToSamples(270);
  const pairs = 6;
  const total = segLen * 2 * pairs;
  const buf = new Float32Array(total);
  const fHigh = 960, fLow = 600;
  let pos = 0;
  for (let p = 0; p < pairs; p++) {
    for (const freq of [fHigh, fLow]) {
      const denom = Math.max(1, segLen - 1);
      for (let i = 0; i < segLen; i++) {
        const tGlobal = (pos + i) / SAMPLE_RATE;
        const segEnv = 0.5 * (1 - Math.cos(2 * Math.PI * i / denom));
        const fundamental = Math.sin(2 * Math.PI * freq * tGlobal) * 0.78;
        const harsh = Math.sin(2 * Math.PI * freq * 2.2 * tGlobal) * 0.22;
        buf[pos + i] = (fundamental + harsh) * segEnv * 0.40;
      }
      pos += segLen;
    }
  }
  return buf;
}

function buildBigExplosion(): Float32Array {
  const len = msToSamples(900);
  const buf = new Float32Array(len);
  let seed = 0xBADB00B5;
  const nextRand = () => {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
    return (seed & 0xFFFF) / 0x8000 - 1;
  };
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / len;
    const env = Math.exp(-2.5 * progress);
    const noise = nextRand();
    const rumble = Math.sin(2 * Math.PI * 45 * t) * 0.5;
    const midBoom = Math.sin(2 * Math.PI * 90 * t) * Math.exp(-4.0 * progress) * 0.3;
    const crackle = nextRand() * Math.exp(-8.0 * progress) * 0.2;
    buf[i] = (noise * 0.55 + rumble + midBoom + crackle) * env * 0.85;
  }
  return buf;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Short explosion burst — Battleship hit. */
export function explosion(): void {
  playBuffer(buildExplosion());
}

/** Big bomb explosion — Battleship ship sunk. */
export function bigExplosion(): void {
  playBuffer(buildBigExplosion());
}

/** Water splash descending sweep — Battleship miss. */
export function splash(): void {
  playBuffer(buildSplash());
}

/** Soft wooden click — Chess / Halma piece move. */
export function pieceMove(): void {
  playBuffer(buildClick());
}

/** Low thud with click transient — Domino tile placed. */
export function tilePlace(): void {
  playBuffer(buildThud());
}

/** Security-style dual-tone alarm — timeout warning. */
export function turnTimeoutWarning(): void {
  playBuffer(buildSecurityAlarm());
}

const GameSound = { explosion, bigExplosion, splash, pieceMove, tilePlace, turnTimeoutWarning };
export default GameSound;
