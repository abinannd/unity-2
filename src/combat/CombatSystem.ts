import * as THREE from 'three';
import { COMBAT, ARENA } from '../game/GameConfig';
import { EnemySpawner } from '../enemies/EnemySpawner';

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  hitEnemyIds: Set<number>; // track enemies already hit by this projectile
}

export class CombatSystem {
  private projectiles: Projectile[] = [];
  private fireCooldown = 0;
  private firePressed = false;

  private readonly projGeo: THREE.SphereGeometry;
  private readonly projMat: THREE.MeshStandardMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly enemySpawner: EnemySpawner,
    private readonly camera: THREE.Camera,
  ) {
    this.projGeo = new THREE.SphereGeometry(COMBAT.projectileRadius, 6, 4);
    this.projMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 2,
    });

    // Left-click only (button 0) — right-click handled by GroundSlam
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this.firePressed = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.firePressed = false; });
    // Suppress right-click context menu during gameplay
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    if (this.firePressed && this.fireCooldown <= 0) {
      this.fire(playerPos);
      this.fireCooldown = COMBAT.fireCooldown;
    }

    const toRemove: Projectile[] = [];
    const limit = ARENA.halfSize - ARENA.wallThickness;

    for (const p of this.projectiles) {
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const pos = p.mesh.position;
      if (Math.abs(pos.x) > limit || Math.abs(pos.z) > limit || pos.y < 0 || pos.y > 12) {
        toRemove.push(p); continue;
      }
      if (p.life <= 0) { toRemove.push(p); continue; }

      // Enemy hit — each projectile only damages each enemy once
      const enemies = this.enemySpawner.getAliveEnemies();
      let hit = false;
      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const uid = enemy._uid;
        if (p.hitEnemyIds.has(uid)) continue;
        if (enemy.position.distanceTo(pos) <= COMBAT.projectileRadius + 0.4) {
          p.hitEnemyIds.add(uid);
          const wasAlive = !enemy.isDead;
          enemy.takeDamage(COMBAT.projectileDamage);
          if (wasAlive && enemy.isDead) {
            this.enemySpawner.notifyKill();
          }
          hit = true;
          break; // one enemy per projectile per frame
        }
      }
      if (hit) { toRemove.push(p); }
    }

    for (const p of toRemove) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = this.projectiles.filter(p => !toRemove.includes(p));
  }

  private fire(playerPos: THREE.Vector3): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const spawnPos = new THREE.Vector3().copy(playerPos);
    spawnPos.y += 1.2;
    spawnPos.addScaledVector(dir, 0.8);

    const mesh = new THREE.Mesh(this.projGeo, this.projMat);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.clone().multiplyScalar(COMBAT.projectileSpeed),
      life: COMBAT.projectileLifetime,
      hitEnemyIds: new Set(),
    });
  }

  reset(): void {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.fireCooldown = 0;
  }
}
