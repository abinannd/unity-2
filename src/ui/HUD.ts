export class HUD {
  private root: HTMLElement;
  private healthBar!: HTMLElement;
  private healthFill!: HTMLElement;
  private timerEl!: HTMLElement;
  private killsEl!: HTMLElement;
  private crosshair!: HTMLElement;

  // Screens
  private introScreen!: HTMLElement;
  private gameOverScreen!: HTMLElement;
  private pauseScreen!: HTMLElement;

  private restartCallback?: () => void;
  private resumeCallback?: () => void;

  constructor(mountId = 'ui-root') {
    this.root = document.getElementById(mountId) ?? document.body;
    this.buildStyles();
    this.buildHUD();
    this.buildIntroScreen();
    this.buildGameOverScreen();
    this.buildPauseScreen();
  }

  private buildStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
      #ui-root * { box-sizing: border-box; user-select: none; }
      #hud { position: fixed; top: 0; left: 0; width: 100%; pointer-events: none; font-family: 'Orbitron', monospace; color: #00d4ff; }
      #health-bar { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); width: 280px; }
      #health-label { font-size: 11px; letter-spacing: 2px; margin-bottom: 4px; text-align: center; }
      #health-track { background: #0a1a2a; border: 1px solid #00d4ff55; height: 12px; border-radius: 6px; overflow: hidden; }
      #health-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #00d4ff, #0080ff); transition: width 0.2s; border-radius: 6px; }
      #timer { position: fixed; top: 20px; right: 24px; font-size: 22px; font-weight: 700; text-shadow: 0 0 12px #00d4ff; }
      #kills { position: fixed; top: 20px; left: 24px; font-size: 14px; letter-spacing: 1px; }
      #crosshair { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 20px; height: 20px; pointer-events: none; }
      #crosshair::before, #crosshair::after { content:''; position: absolute; background: #fff; opacity: 0.8; }
      #crosshair::before { width: 2px; height: 100%; left: 50%; transform: translateX(-50%); }
      #crosshair::after  { height: 2px; width: 100%; top: 50%; transform: translateY(-50%); }
      .screen { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.85); font-family: 'Orbitron', monospace; color: #00d4ff; z-index: 100; }
      .screen h1 { font-size: 32px; font-weight: 700; text-shadow: 0 0 20px #00d4ff; margin-bottom: 16px; letter-spacing: 2px; }
      .screen p  { font-size: 14px; color: #aaa; margin: 4px 0; line-height: 1.7; text-align: center; }
      .screen button { margin-top: 28px; padding: 14px 40px; background: #00d4ff22; border: 1px solid #00d4ff;
        color: #00d4ff; font-family: 'Orbitron', monospace; font-size: 16px; cursor: pointer; border-radius: 4px;
        transition: background 0.2s; pointer-events: all; }
      .screen button:hover { background: #00d4ff44; }
      #kills-final { font-size: 28px; margin: 12px 0; color: #fff; }
      #heal-indicator { position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
        font-size: 11px; letter-spacing: 3px; color: #00ff88; text-shadow: 0 0 10px #00ff88;
        pointer-events: none; display: none; }
      @keyframes healPulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
      #heal-indicator { animation: healPulse 0.9s ease-in-out infinite; }
      #safe-block-hud { position: fixed; top: 58px; left: 24px; font-size: 12px;
        letter-spacing: 2px; color: #00ff66; text-shadow: 0 0 8px #00ff44;
        pointer-events: none; display: none; }
    `;
    document.head.appendChild(style);
  }

  private buildHUD(): void {
    const hud = document.createElement('div');
    hud.id = 'hud';

    // Health bar
    const hb = document.createElement('div');
    hb.id = 'health-bar';
    hb.innerHTML = `<div id="health-label">HEALTH</div><div id="health-track"><div id="health-fill"></div></div>`;
    hud.appendChild(hb);

    // Timer
    const timer = document.createElement('div');
    timer.id = 'timer';
    timer.textContent = '00:00';
    hud.appendChild(timer);

    // Kills
    const kills = document.createElement('div');
    kills.id = 'kills';
    kills.textContent = 'KILLS: 0';
    hud.appendChild(kills);

    // Crosshair
    const ch = document.createElement('div');
    ch.id = 'crosshair';
    hud.appendChild(ch);

    const healInd = document.createElement('div');
    healInd.id = 'heal-indicator';
    healInd.textContent = '⊕ REGENERATING';
    hud.appendChild(healInd);

    const safeHud = document.createElement('div');
    safeHud.id = 'safe-block-hud';
    safeHud.textContent = '◈ SAFE BLOCK ACTIVE — 15s';
    hud.appendChild(safeHud);

    this.root.appendChild(hud);
    this.healthFill = document.getElementById('health-fill')!;
    this.healthBar = document.getElementById('health-bar')!;
    this.timerEl = document.getElementById('timer')!;
    this.killsEl = document.getElementById('kills')!;
    this.crosshair = ch;

    // Initially hidden until game starts
    hud.style.display = 'none';
    this.healthBar.style.display = 'none'; // re-enabled later
  }

  private buildIntroScreen(): void {
    this.introScreen = document.createElement('div');
    this.introScreen.className = 'screen';
    this.introScreen.innerHTML = `
      <h1>IMMORTAL SNAIL SURVIVAL</h1>
      <p>WASD — Move &nbsp;|&nbsp; SPACE — Jump &nbsp;|&nbsp; C — Running Slide</p>
      <p>Left Click — Fire projectile &nbsp;|&nbsp; Right Click (Air) — Ground Slam</p>
      <p>R — Grapple &nbsp;|&nbsp; Double-SHIFT — Speed Burst</p>
      <p>Survive as long as you can.</p>
      <button id="start-btn">START GAME</button>
    `;
    this.root.appendChild(this.introScreen);
    document.getElementById('start-btn')?.addEventListener('click', () => {
      this.introScreen.style.display = 'none';
      document.getElementById('hud')!.style.display = '';
      this.healthBar.style.display = '';
      this.restartCallback?.();
    });
  }

  private buildGameOverScreen(): void {
    this.gameOverScreen = document.createElement('div');
    this.gameOverScreen.className = 'screen';
    this.gameOverScreen.style.display = 'none';
    this.gameOverScreen.innerHTML = `
      <h1>YOU DIED</h1>
      <div id="kills-final">0 KILLS</div>
      <div id="time-final" style="font-size:16px;color:#aaa;">TIME: 00:00</div>
      <button id="restart-btn">PLAY AGAIN</button>
    `;
    this.root.appendChild(this.gameOverScreen);
    document.getElementById('restart-btn')?.addEventListener('click', () => {
      this.gameOverScreen.style.display = 'none';
      this.restartCallback?.();
    });
  }

  private buildPauseScreen(): void {
    this.pauseScreen = document.createElement('div');
    this.pauseScreen.className = 'screen';
    this.pauseScreen.style.display = 'none';
    this.pauseScreen.innerHTML = `<h1>PAUSED</h1><button id="resume-btn">RESUME</button>`;
    this.root.appendChild(this.pauseScreen);
    document.getElementById('resume-btn')?.addEventListener('click', () => {
      this.pauseScreen.style.display = 'none';
      this.resumeCallback?.();
    });
  }

  updateHealth(hp: number, max: number): void {
    const pct = Math.max(0, (hp / max) * 100);
    this.healthFill.style.width = pct + '%';
    const hue = pct > 50 ? 200 : pct > 25 ? 40 : 0;
    this.healthFill.style.background = `hsl(${hue},100%,55%)`;
  }

  updateTimer(seconds: number): void {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.timerEl.textContent = `${m}:${s}`;
  }

  updateKills(count: number): void {
    this.killsEl.textContent = `KILLS: ${count}`;
  }

  showGameOver(kills: number, time: number): void {
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = Math.floor(time % 60).toString().padStart(2, '0');
    (document.getElementById('kills-final') as HTMLElement).textContent = `${kills} KILLS`;
    (document.getElementById('time-final') as HTMLElement).textContent = `TIME: ${m}:${s}`;
    this.gameOverScreen.style.display = 'flex';
  }

  showPause(): void { this.pauseScreen.style.display = 'flex'; }
  hidePause(): void { this.pauseScreen.style.display = 'none'; }

  setHealingIndicator(active: boolean): void {
    const el = document.getElementById('heal-indicator');
    if (el) el.style.display = active ? 'block' : 'none';
  }

  setSafeBlockIndicator(active: boolean, remaining?: number): void {
    const el = document.getElementById('safe-block-hud');
    if (!el) return;
    if (active) {
      el.style.display = 'block';
      const secs = remaining !== undefined ? Math.ceil(remaining) : '?';
      el.textContent = `◈ SAFE BLOCK — ${secs}s`;
    } else {
      el.style.display = 'none';
    }
  }

  onRestart(cb: () => void): void { this.restartCallback = cb; }
  onResume(cb: () => void): void { this.resumeCallback = cb; }
}
