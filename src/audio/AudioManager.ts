/**
 * AudioManager — synthesized sound effects and looping background music.
 * All sounds are generated via Web Audio API, no external audio files required.
 * A single AudioContext is shared across all sounds.
 */
export class AudioManager {
  private static _instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicStarted = false;
  private gameOverPlaying = false;

  // Volume limits to prevent excessive loudness on rapid fire
  private readonly SFX_VOL = 0.22;
  private readonly MUSIC_VOL = 0.10;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
    }
    return AudioManager._instance;
  }

  /**
   * Resume / create the AudioContext after user interaction.
   * Call this once from the first pointer-lock or click event.
   */
  resume(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.musicStarted) {
      this.musicStarted = true;
      this.buildMusicBuffer().then(buf => {
        this.musicBuffer = buf;
        this.startMusic();
      });
    }
  }

  // ── Shoot sound — short "pew" laser ──────────────────────────────────────
  playShoot(): void {
    const ctx = this._ctx(); if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.12);

    gain.gain.setValueAtTime(this.SFX_VOL, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.start(t);
    osc.stop(t + 0.14);
  }

  // ── Jump sound — quick upward chirp ──────────────────────────────────────
  playJump(): void {
    const ctx = this._ctx(); if (!ctx) return;
    const t = ctx.currentTime;

    // Two-layered spring sound
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(220, t);
    osc1.frequency.exponentialRampToValueAtTime(520, t + 0.18);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, t);
    osc2.frequency.exponentialRampToValueAtTime(880, t + 0.15);

    gain.gain.setValueAtTime(this.SFX_VOL * 0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc1.start(t); osc1.stop(t + 0.23);
    osc2.start(t); osc2.stop(t + 0.23);
  }

  // ── Game-over sound — descending losing tone ──────────────────────────────
  playGameOver(): void {
    if (this.gameOverPlaying) return;
    const ctx = this._ctx(); if (!ctx) return;
    this.gameOverPlaying = true;
    const t = ctx.currentTime;

    const steps = [440, 349, 294, 220, 165];
    const dur = 0.22;
    steps.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * dur);

      gain.gain.setValueAtTime(0.001, t + i * dur);
      gain.gain.linearRampToValueAtTime(this.SFX_VOL * 1.1, t + i * dur + 0.04);
      gain.gain.setValueAtTime(this.SFX_VOL * 1.1, t + i * dur + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * dur + dur);

      osc.start(t + i * dur);
      osc.stop(t + i * dur + dur + 0.05);
    });

    // Reset flag after the sound completes
    setTimeout(() => { this.gameOverPlaying = false; }, (steps.length * dur + 0.3) * 1000);
  }

  // ── Stop music (game over) ────────────────────────────────────────────────
  stopMusic(): void {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource = null;
    }
  }

  // ── Resume music (restart) ────────────────────────────────────────────────
  restartMusic(): void {
    this.stopMusic();
    if (this.musicBuffer) {
      this.startMusic();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private _ctx(): AudioContext | null {
    return this.ctx;
  }

  private startMusic(): void {
    const ctx = this.ctx; if (!ctx || !this.musicBuffer) return;
    if (this.musicGain) {
      this.musicGain.disconnect();
    }
    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.MUSIC_VOL, ctx.currentTime);
    this.musicGain.connect(ctx.destination);

    this.musicSource = ctx.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
  }

  /**
   * Build a simple ambient forest loop using Web Audio oscillators.
   * Renders ~8 seconds of audio offline then loops it.
   */
  private async buildMusicBuffer(): Promise<AudioBuffer> {
    const sampleRate = 22050;
    const duration = 8; // seconds
    const frames = sampleRate * duration;

    const offline = new OfflineAudioContext(1, frames, sampleRate);

    // Drone base — low mystical hum
    const addDrone = (freq: number, vol: number, type: OscillatorType) => {
      const osc = offline.createOscillator();
      const gain = offline.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(gain);
      gain.connect(offline.destination);
      osc.start(0);
      osc.stop(duration);
    };

    // Layered drones for mysterious forest atmosphere
    addDrone(55,  0.025, 'sine');       // deep bass drone
    addDrone(82,  0.015, 'sine');       // fifth above
    addDrone(110, 0.012, 'triangle');   // octave
    addDrone(165, 0.008, 'triangle');   // fifth

    // Gentle high-pitched melody notes
    const melodyNotes = [220, 247, 261, 294, 261, 247, 220, 196];
    const noteDur = duration / melodyNotes.length;
    melodyNotes.forEach((freq, i) => {
      const osc = offline.createOscillator();
      const gain = offline.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = i * noteDur;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.018, start + 0.15);
      gain.gain.setValueAtTime(0.018, start + noteDur * 0.7);
      gain.gain.linearRampToValueAtTime(0, start + noteDur);
      osc.connect(gain);
      gain.connect(offline.destination);
      osc.start(start);
      osc.stop(start + noteDur + 0.05);
    });

    // Gentle shimmer — high frequency sparkle
    for (let i = 0; i < 4; i++) {
      const osc = offline.createOscillator();
      const gain = offline.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880 + i * 220;
      const t = i * 2;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.006, t + 0.3);
      gain.gain.linearRampToValueAtTime(0, t + 1.2);
      osc.connect(gain);
      gain.connect(offline.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    }

    return await offline.startRendering();
  }
}
