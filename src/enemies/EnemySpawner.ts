import * as THREE from 'three';
import { ENEMY, ARENA, DIFFICULTY } from '../game/GameConfig';
import { Enemy } from './Enemy';
import { SpinningRodEnemy } from './SpinningRodEnemy';

export class EnemySpawner {
  private enemies: Enemy[] = [];
  private spinners: SpinningRodEnemy[] = [];
  private spawnTimer = ENEMY.spawnInterval;
  private wave = 0;
  private diffTimer = 0;
  private currentMaxHealth = ENEMY.health;
  private currentMoveSpeed = ENEMY.moveSpeed;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onEnemyAttack: (damage: number) => void,
    private readonly onEnemyKilled: () => void,
  ) {}

  update(dt: number, playerPos: THREE.Vector3, survivalTime: number): void {
    // Difficulty ramp
    this.diffTimer += dt;
    if (this.diffTimer >= DIFFICULTY.rampInterval) {
      this.diffTimer = 0;
      this.wave++;
      this.currentMaxHealth += DIFFICULTY.enemyHealthIncrement;
      this.currentMoveSpeed = Math.min(8, this.currentMoveSpeed + DIFFICULTY.enemySpeedIncrement);
      const currentInterval = Math.max(1.5, ENEMY.spawnInterval - this.wave * DIFFICULTY.spawnIntervalDecrement);
      this.spawnTimer = Math.min(this.spawnTimer, currentInterval);
    }

    // Spawn timer
    this.spawnTimer -= dt;
    const alive = this.enemies.filter(e => !e.isDead).length + this.spinners.filter(s => !s.isDead).length;
    if (this.spawnTimer <= 0 && alive < ENEMY.maxEnemies) {
      this.spawnTimer = Math.max(1.5, ENEMY.spawnInterval - this.wave * DIFFICULTY.spawnIntervalDecrement);
      this.spawnEnemy(playerPos);
    }

    // Update all enemies
    for (const enemy of this.enemies) {
      enemy.update(dt, playerPos);
    }
    for (const spinner of this.spinners) {
      spinner.update(dt, playerPos);
    }

    // Remove dead enemies and notify
    this.enemies = this.enemies.filter(e => {
      if (e.isDead) {
        e.dispose(this.scene);
        return false;
      }
      return true;
    });
    this.spinners = this.spinners.filter(s => {
      if (s.isDead) {
        s.dispose();
        return false;
      }
      return true;
    });
  }

  private spawnEnemy(playerPos: THREE.Vector3): void {
    const limit = ARENA.halfSize - 2;
    let pos: THREE.Vector3;
    let attempts = 0;
    do {
      pos = new THREE.Vector3(
        (Math.random() * 2 - 1) * limit,
        0,
        (Math.random() * 2 - 1) * limit,
      );
      attempts++;
    } while (pos.distanceTo(playerPos) < 6 && attempts < 20);

    // Decide enemy type
    const roll = Math.random();
    if (roll < ENEMY.spinningRodSpawnChance) {
      const spinner = new SpinningRodEnemy(this.scene, pos);
      spinner.onAttackPlayer = (dmg) => this.onEnemyAttack(dmg);
      spinner.onRodDamagePlayer = (dmg) => this.onEnemyAttack(dmg);
      this.spinners.push(spinner);
    } else {
      const isRed = Math.random() < ENEMY.redSpawnChance;
      const hp = isRed ? ENEMY.redHealth : ENEMY.health;
      const enemy = new Enemy(this.scene, pos, hp, isRed);
      enemy.onAttackPlayer = (dmg) => this.onEnemyAttack(dmg);
      this.enemies.push(enemy);
    }
  }

  /**
   * Apply area damage to all living enemies within radius of pos.
   * Returns the number of enemies that were hit (not necessarily killed).
   * Fires onEnemyKilled for each kill.
   */
  applyDamageToEnemiesNear(pos: THREE.Vector3, radius: number, damage: number): number {
    let hit = 0;
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.position.x - pos.x;
      const dz = enemy.position.z - pos.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      const vertDist = Math.abs(enemy.position.y - pos.y);
      if (horizDist <= radius && vertDist <= 3.5) {
        const wasAlive = !enemy.isDead;
        enemy.takeDamage(damage);
        hit++;
        if (wasAlive && enemy.isDead) {
          this.onEnemyKilled();
        }
      }
    }
    // Also apply AoE to spinning-rod enemies
    for (const spinner of this.spinners) {
      if (spinner.isDead) continue;
      const dx = spinner.position.x - pos.x;
      const dz = spinner.position.z - pos.z;
      const horizDist = Math.sqrt(dx * dx + dz * dz);
      const vertDist = Math.abs(spinner.position.y - pos.y);
      if (horizDist <= radius && vertDist <= 3.5) {
        const wasAlive = !spinner.isDead;
        spinner.takeDamage(damage);
        hit++;
        if (wasAlive && spinner.isDead) {
          this.onEnemyKilled();
        }
      }
    }
    return hit;
  }

  /** Called by CombatSystem when it handles a kill itself. */
  notifyKill(): void {
    this.onEnemyKilled();
  }

  getAliveEnemies(): Enemy[] {
    return this.enemies.filter(e => !e.isDead);
  }

  getAliveSpinners(): SpinningRodEnemy[] {
    return this.spinners.filter(s => !s.isDead);
  }

  reset(): void {
    for (const e of this.enemies) { e.dispose(this.scene); }
    for (const s of this.spinners) { s.dispose(); }
    this.enemies = [];
    this.spinners = [];
    this.spawnTimer = ENEMY.spawnInterval;
    this.wave = 0;
    this.diffTimer = 0;
    this.currentMaxHealth = ENEMY.health;
    this.currentMoveSpeed = ENEMY.moveSpeed;
  }
}
