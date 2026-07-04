// Most sound effects are synthesized with the Web Audio API (filtered noise);
// the can-shake heard on a color change is a recorded sample instead.
import shakeSampleUrl from "../assets/spray_can_shake.mp3";

interface NozzleAudioProfile {
  freq: number;
  q: number;
  gain: number;
}

const NOZZLE_AUDIO: Record<string, NozzleAudioProfile> = {
  fine: { freq: 6200, q: 1.4, gain: 0.32 },
  standard: { freq: 3400, q: 0.9, gain: 0.42 },
  fat: { freq: 1800, q: 0.5, gain: 0.5 },
  splatter: { freq: 1500, q: 0.4, gain: 0.55 },
  mist: { freq: 5200, q: 0.7, gain: 0.22 },
};

interface SprayChain {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
}

export class SprayAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private shakeBuffer: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private active: SprayChain | null = null;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.buildPinkNoiseBuffer(this.ctx);
    this.loadShakeSample();
  }

  private async loadShakeSample() {
    if (!this.ctx) return;
    try {
      const res = await fetch(shakeSampleUrl);
      const arrayBuf = await res.arrayBuffer();
      this.shakeBuffer = await this.ctx.decodeAudioData(arrayBuf);
    } catch (err) {
      console.warn("Failed to load can-shake sample, falling back to synthesized shake.", err);
    }
  }

  private ensureRunning() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  private buildPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }
    return buffer;
  }

  startSpray(nozzle: string) {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    this.ensureRunning();
    this.stopSpray();

    const profile = NOZZLE_AUDIO[nozzle] || NOZZLE_AUDIO.standard;
    const ctx = this.ctx;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.playbackRate.value = 0.92 + Math.random() * 0.16;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = profile.freq;
    filter.Q.value = profile.q;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(profile.gain, ctx.currentTime + 0.05);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 14 + Math.random() * 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = profile.gain * 0.12;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    source.start();
    lfo.start();

    this.active = { source, filter, gain, lfo, lfoGain };
  }

  stopSpray() {
    if (!this.active || !this.ctx) return;
    const { source, gain, lfo } = this.active;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.09);
    source.stop(now + 0.12);
    lfo.stop(now + 0.12);
    this.active = null;
  }

  playShakeSample() {
    if (!this.ctx || !this.master) return;
    this.ensureRunning();
    if (!this.shakeBuffer) {
      this.shake();
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = this.shakeBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  shake() {
    if (!this.ctx || !this.master) return;
    this.ensureRunning();
    const ctx = this.ctx;
    const bursts = 10 + Math.floor(Math.random() * 6);
    let t = ctx.currentTime;
    for (let i = 0; i < bursts; i++) {
      t += 0.03 + Math.random() * 0.05;
      this.metallicClick(t, 0.5 + Math.random() * 0.4);
    }
  }

  click() {
    if (!this.ctx) return;
    this.ensureRunning();
    this.metallicClick(this.ctx.currentTime, 0.18, 3200);
  }

  private metallicClick(time: number, gainScale: number, freq = 2200 + Math.random() * 2000) {
    if (!this.ctx || !this.noiseBuffer || !this.master) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 1.5 + Math.random();

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.5 * gainScale, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() - 0.5) * 1.4;

    source.connect(filter);
    if (pan) {
      filter.connect(pan);
      pan.connect(this.master);
    } else {
      filter.connect(this.master);
    }

    source.start(time);
    source.stop(time + 0.04);
  }
}
