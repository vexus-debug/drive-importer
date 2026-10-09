const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export const STATIONS = ["EKO FM 92.3 · Afrobeats", "SYNTH LAGOS 88.8 · Retro"];

export class GameAudio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  noise!: AudioBuffer;
  eng!: OscillatorNode;
  engF!: BiquadFilterNode;
  engG!: GainNode;
  sirG!: GainNode;
  radioG!: GainNode;
  radioOn = false;
  station = 0;
  step = 0;
  next = 0;
  timer: ReturnType<typeof setInterval> | null = null;

  get stationName() {
    return STATIONS[this.station];
  }

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.eng = ctx.createOscillator();
    this.eng.type = "sawtooth";
    this.engF = ctx.createBiquadFilter();
    this.engF.type = "lowpass";
    this.engG = ctx.createGain();
    this.engG.gain.value = 0;
    this.eng.connect(this.engF).connect(this.engG).connect(this.master);
    this.eng.start();

    const sir = ctx.createOscillator();
    sir.type = "square";
    sir.frequency.value = 850;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lg = ctx.createGain();
    lg.gain.value = 300;
    lfo.connect(lg).connect(sir.frequency);
    const sf = ctx.createBiquadFilter();
    sf.frequency.value = 1800;
    this.sirG = ctx.createGain();
    this.sirG.gain.value = 0;
    sir.connect(sf).connect(this.sirG).connect(this.master);
    sir.start();
    lfo.start();

    this.radioG = ctx.createGain();
    this.radioG.gain.value = 0.4;
    this.radioG.connect(this.master);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setEngine(on: boolean, r: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engG.gain.setTargetAtTime(on ? 0.035 + r * 0.04 : 0, t, 0.1);
    this.eng.frequency.setTargetAtTime(38 + r * 120, t, 0.05);
    this.engF.frequency.setTargetAtTime(280 + r * 1500, t, 0.05);
  }

  setSiren(level: number) {
    if (!this.ctx) return;
    this.sirG.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, 0.2);
  }

  private tone(f: number, t: number, dur: number, type: OscillatorType, g: number, cut = 8000, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const fl = ctx.createBiquadFilter();
    fl.frequency.value = cut;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(gn).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(t: number, dur: number, g: number, type: BiquadFilterType, freq: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(gn).connect(dest ?? this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.radioG);
    o.start(t);
    o.stop(t + 0.32);
  }

  horn(vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(415, t, 0.45, "square", 0.07 * vol, 2200);
    this.tone(523, t, 0.45, "square", 0.07 * vol, 2200);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 0.35, 0.6, "lowpass", 900);
    this.tone(70, t, 0.25, "sine", 0.5);
  }

  thud() {
    if (!this.ctx) return;
    this.tone(90, this.ctx.currentTime, 0.2, "sine", 0.5);
  }

  cash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => this.tone(mtof(m), t + i * 0.07, 0.25, "triangle", 0.15));
  }

  toggleRadio() {
    if (!this.ctx) return;
    this.radioOn = !this.radioOn;
    this.next = this.ctx.currentTime + 0.05;
    this.step = 0;
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    if (!this.radioOn) this.toggleRadio();
    this.step = 0;
  }

  private schedule() {
    if (!this.ctx || !this.radioOn) return;
    const bpm = this.station === 0 ? 106 : 118;
    const spb = 60 / bpm / 4;
    while (this.next < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.next, spb);
      this.next += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, spb: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const out = this.radioG;
    if (this.station === 0) {
      const roots = [45, 41, 48, 43];
      const qual = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
      const root = roots[bar]!;
      if ([0, 7, 8, 13].includes(s)) this.kick(t);
      if (s === 4 || s === 12) this.burst(t, 0.18, 0.45, "bandpass", 1500, out);
      this.burst(t, 0.04, s % 2 ? 0.12 : 0.06, "highpass", 7000, out);
      if ([3, 10, 14].includes(s)) this.tone(s === 10 ? 330 : 260, t, 0.12, "sine", 0.3, 4000, out);
      if ([0, 3, 6, 8, 11, 14].includes(s)) this.tone(mtof(root + (s === 6 ? 12 : 0)), t, spb * 2, "triangle", 0.45, 700, out);
      if ([2, 5, 10, 13].includes(s)) qual[bar]!.forEach((iv) => this.tone(mtof(root + 24 + iv), t, 0.14, "square", 0.05, 2600, out));
      const mel = [0, -1, 7, -1, 10, 7, -1, 12, -1, 10, 7, -1, 5, -1, 3, -1];
      if (mel[s]! >= 0 && bar % 2 === 1) this.tone(mtof(57 + 12 + mel[s]!), t, 0.18, "triangle", 0.12, 5000, out);
    } else {
      const roots = [40, 36, 43, 38];
      const root = roots[bar]!;
      if (s % 4 === 0) this.kick(t);
      if (s === 4 || s === 12) this.burst(t, 0.2, 0.4, "highpass", 1200, out);
      if (s % 2 === 1) this.burst(t, 0.03, 0.1, "highpass", 8000, out);
      if (s % 2 === 0) this.tone(mtof(root + (s % 4 === 2 ? 12 : 0)), t, spb * 1.8, "sawtooth", 0.18, 600, out);
      const arp = [0, 7, 12, 15, 19, 15, 12, 7];
      this.tone(mtof(root + 36 + arp[s % 8]! - 12), t, 0.12, "square", 0.045, 3000, out);
      const lead = [12, -1, -1, 15, -1, -1, 19, -1, 17, -1, 15, -1, 12, -1, 10, -1];
      if (bar >= 2 && lead[s]! >= 0) this.tone(mtof(root + 36 + lead[s]!), t, 0.3, "sawtooth", 0.06, 2500, out);
    }
  }
}
