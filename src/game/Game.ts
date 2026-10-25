import * as THREE from 'three';
import { Arena } from '../arena/Arena';
import { Player } from '../player/Player';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { EnemySpawner } from '../enemies/EnemySpawner';
import { BlockSpawner } from '../obstacles/BlockSpawner';
import { SafeBlockManager } from '../obstacles/SafeBlockManager';
import { CombatSystem } from '../combat/CombatSystem';
import { GroundSlam } from '../combat/GroundSlam';
import { GrappleSystem } from '../combat/GrappleSystem';
import { HUD } from '../ui/HUD';
import type { Block } from '../obstacles/Block';
import type { SafeBlock } from '../obstacles/SafeBlock';

type GameState = 'INTRO' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private arena!: Arena;
  private player!: Player;
  private thirdPersonCamera!: ThirdPersonCamera;
  private enemySpawner!: EnemySpawner;
  private blockSpawner!: BlockSpawner;
  private safeBlockManager!: SafeBlockManager;
  private combat!: CombatSystem;
  private groundSlam!: GroundSlam;
  private grapple!: GrappleSystem;
  private hud!: HUD;

  private healRing!: THREE.Mesh;

  private state: GameState = 'INTRO';
  private survivalTime = 0;
  private kills = 0;
  private lastTime = 0;

  async init(): Promise<void> {
    // ── Renderer ────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    document.body.prepend(this.renderer.domElement);

    // ── Scene ───────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.025);

    // ── Camera ──────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 8, 12);

    // ── Arena ───────────────────────────────────────────────────────────
    this.arena = new Arena(this.scene);

    // ── HUD ─────────────────────────────────────────────────────────────
    this.hud = new HUD();

    // ── Player — fallback mesh visible immediately ───────────────────────
    this.player = new Player(this.scene, this.arena, this.camera);

    // ── Third-person camera ──────────────────────────────────────────────
    this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.player.mesh);

    // ── Healing ring ────────────────────────────────────────────────────
    const ringGeo = new THREE.TorusGeometry(0.55, 0.06, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.5, transparent: true, opacity: 0.7,
    });
    this.healRing = new THREE.Mesh(ringGeo, ringMat);
    this.healRing.rotation.x = Math.PI / 2;
    this.healRing.visible = false;
    this.scene.add(this.healRing);

    // ── Enemy spawner ────────────────────────────────────────────────────
    this.enemySpawner = new EnemySpawner(
      this.scene,
      (dmg) => { if (this.state === 'PLAYING') this.player.health.takeDamage(dmg); },
      () => { this.kills++; this.hud.updateKills(this.kills); },
    );

    // ── Block spawners ───────────────────────────────────────────────────
    this.blockSpawner = new BlockSpawner(
      this.scene,
      (dmg) => { if (this.state === 'PLAYING') this.player.health.takeDamage(dmg); },
    );

    this.safeBlockManager = new SafeBlockManager(this.scene);

    // ── Ground slam & grapple ────────────────────────────────────────────
    this.groundSlam = new GroundSlam(this.scene, this.camera, this.enemySpawner);
    this.grapple = new GrappleSystem(this.scene, this.camera);

    // ── Combat ───────────────────────────────────────────────────────────
    this.combat = new CombatSystem(this.scene, this.enemySpawner, this.camera);

    // ── Inject systems into player controller ────────────────────────────
    this.player.controller.setGroundSlam(this.groundSlam);
    this.player.controller.setGrapple(this.grapple);

    // ── Health events ────────────────────────────────────────────────────
    this.player.health.onDamage = (hp, max) => this.hud.updateHealth(hp, max);
    this.player.health.onDeath = () => this.endGame();
    this.hud.updateHealth(this.player.health.hp, this.player.health.max);

    // ── HUD hooks ────────────────────────────────────────────────────────
    this.hud.onRestart(() => this.startGame());
    this.hud.onResume(() => {
      this.state = 'PLAYING';
      this.lastTime = performance.now();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.grapple.endGrapple();
        this.hud.showPause();
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Load FBX in background
    this.player.load().then(() => {
      this.thirdPersonCamera.setTarget(this.player.mesh);
      // Re-inject after FBX load creates a new controller
      this.player.controller.setGroundSlam(this.groundSlam);
      this.player.controller.setGrapple(this.grapple);
      console.info('[Game] FBX load complete. Using fallback:', this.player.isUsingFallback);
    }).catch(err => {
      console.error('[Game] Player FBX load failed:', err);
    });

    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private startGame(): void {
    this.state = 'PLAYING';
    this.survivalTime = 0;
    this.kills = 0;
    this.hud.updateKills(0);
    this.hud.updateTimer(0);

    this.player.mesh.position.set(0, 0, 0);
    this.player.health.reset();
    this.hud.updateHealth(this.player.health.hp, this.player.health.max);

    this.enemySpawner.reset();
    this.blockSpawner.reset();
    this.safeBlockManager.reset();
    this.combat.reset();
    this.groundSlam.reset();
    this.grapple.reset();
    this.lastTime = performance.now();
  }

  private endGame(): void {
    this.state = 'GAME_OVER';
    this.hud.showGameOver(this.kills, this.survivalTime);
    this.healRing.visible = false;
    this.hud.setSafeBlockIndicator(false);
    this.grapple.reset();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private loop(now: number): void {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
      this.survivalTime += dt;
      this.hud.updateTimer(this.survivalTime);

      // Update grapple before player so velocity is ready
      this.grapple.update(dt, this.player.position);

      this.player.update(dt);
      const playerPos = this.player.position;

      this.enemySpawner.update(dt, playerPos, this.survivalTime);
      this.blockSpawner.update(dt, playerPos);
      this.safeBlockManager.update(dt, playerPos);
      this.combat.update(dt, playerPos);

      // ── Platform collision ─────────────────────────────────────────────
      const regularBlocks = this.blockSpawner.getActiveBlocks();
      const safeBlock = this.safeBlockManager.getBlock();

      const allPlatforms: Block[] = safeBlock
        ? [...regularBlocks, safeBlock as unknown as Block]
        : regularBlocks;

      this.player.controller.updatePlatforms(allPlatforms, dt);

      // ── Platform regen ─────────────────────────────────────────────────
      const regenAmount = this.player.controller.tickPlatformRegen(
        dt, this.player.health.hp, this.player.health.max,
      );
      if (regenAmount > 0 && !this.player.health.isDead) {
        this.player.health.heal(regenAmount);
      }

      // ── Healing ring ───────────────────────────────────────────────────
      const isRegen = this.player.controller.isRegenerating;
      this.healRing.visible = isRegen;
      if (isRegen) {
        this.healRing.position.copy(playerPos);
        this.healRing.position.y = 0.05;
        this.healRing.rotation.z += dt * 3;
      }
      this.hud.setHealingIndicator(isRegen);

      // ── Safe block HUD ─────────────────────────────────────────────────
      if (safeBlock) {
        this.hud.setSafeBlockIndicator(true, safeBlock.remainingTime);
      } else {
        this.hud.setSafeBlockIndicator(false);
      }
    } else {
      this.healRing.visible = false;
      this.hud.setSafeBlockIndicator(false);
    }

    this.thirdPersonCamera.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
