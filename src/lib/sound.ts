/**
 * Clean, quiet sound, made in the browser (Web Audio): no files to load,
 * nothing to buffer on a slow phone. Every sound is short and soft, a
 * confirmation rather than a jingle:
 *
 *   tap      a light tick on any button
 *   step     two soft bell notes when the guide moves on
 *   copy     a crisp high tick when a box is copied
 *   shutter  a camera click for a scan
 *   success  a rising chord when a sale is filed
 *
 * Off with one switch, remembered on the device.
 */

const KEY = "titledesk.sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function soundOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // remembered for this visit only
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    // A gentle ceiling, so nothing ever clips or startles.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
  }
  // iPhone starts audio suspended until a tap; every sound here follows one.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  {
    at = 0,
    dur = 0.12,
    gain = 0.08,
    type = "sine",
    attack = 0.004,
    glideTo,
  }: { at?: number; dur?: number; gain?: number; type?: OscillatorType; attack?: number; glideTo?: number } = {},
) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const env = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ at = 0, dur = 0.05, gain = 0.12, from = 4000, to = 1200 }: { at?: number; dur?: number; gain?: number; from?: number; to?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + at;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buffer = a.createBuffer(1, len, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = a.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
}

let lastTap = 0;

export const sfx = {
  tap() {
    const now = performance.now();
    if (now - lastTap < 40) return;
    lastTap = now;
    tone(1650, { dur: 0.045, gain: 0.05, type: "sine", glideTo: 1250 });
  },
  step() {
    tone(1318.5, { dur: 0.32, gain: 0.045, type: "sine" }); // E6
    tone(1760, { at: 0.09, dur: 0.42, gain: 0.04, type: "sine" }); // A6
    tone(3520, { at: 0.09, dur: 0.2, gain: 0.008, type: "sine" }); // a little air
  },
  copy() {
    tone(2637, { dur: 0.05, gain: 0.05, type: "triangle" });
    tone(3951, { at: 0.035, dur: 0.06, gain: 0.03, type: "triangle" });
  },
  shutter() {
    noise({ dur: 0.04, gain: 0.16, from: 5200, to: 2200 });
    noise({ at: 0.065, dur: 0.05, gain: 0.12, from: 3000, to: 900 });
    tone(140, { dur: 0.08, gain: 0.07, type: "sine", glideTo: 70 });
  },
  success() {
    // C major, rising, with a soft octave on top.
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, { at: i * 0.075, dur: 0.6 - i * 0.05, gain: 0.05, type: "triangle", attack: 0.008 }),
    );
    tone(2093, { at: 0.3, dur: 0.7, gain: 0.015, type: "sine" });
  },
};
