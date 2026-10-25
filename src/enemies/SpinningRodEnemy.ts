import * as THREE from 'three';
import { ENEMY, ARENA } from '../game/GameConfig';

/**
 * SpinningRodEnemy — red enemy body with a long rod that rotates around it.
 * Touching the rod deals damage with a cooldown. Can be dodged by sliding under
 * or double-jumping over (rod sweeps at mid-height ~0.8–1.4 units).
 */
export class SpinningRodEnemy {
  readonly mesh: THREE.Group;
  private readonly scene: THREE.Scene;

  state: 'SPAWNING' | 'CHASING' | 'ATTACKING' | 'DEAD' = 'SPAWNING';
  health: number;
  readonly maxHealth: number;

  private readonly body: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly glowMat: THREE.MeshStandardMaterial;
  private readonly rodPivot: THREE.Group;
  private readonly rod: THREE.Mesh;

  private spawnTimer = 0.6;
  private bobTime = 0;
  private rodAngle = 0;
  private damageCooldown = 0;

  /** Unique ID so projectiles can track "already hit" state */
  private static _uidCounter = 10000;
  readonly _uid: number;

  /** Called when this enemy hits the player (body contact). */
  onAttackPlayer?: (damage: number) => void;

  /** Called externally when the rod damages the player. */
  onRodDamagePlayer?: (damage: number) => void;

  // Rod parameters
  private static readonly ROD_HALF_LENGTH = 2.0; // total rod = 4 units long
  private static readonly ROD_RADIUS = 0.07;
  private static readonly ROD_Y = 0.9;           // height of rod centre — mid-torso
  private static readonly ROD_DAMAGE = 10;
  private static readonly ROD_COOLDOWN = 0.8;    // seconds between rod hits
  private static readonly ROT_SPEED = 1.8;       // rad/s

  constructor(scene: THREE.Scene, spawnPos: THREE.Vector3) {
    this.scene = scene;
    this._uid = SpinningRodEnemy._uidCounter++;
    this.maxHealth = ENEMY.redHealth;
    this.health = this.maxHealth;
    this.mesh = new THREE.Group();

    const baseColor = 0xff1515;
    this.glowMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: 0xff0000,
      emissiveIntensity: 0.85,
      roughness: 0.3,
      metalness: 0.4,
    });

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.0, 8);
    this.body = new THREE.Mesh(bodyGeo, this.glowMat);
    this.body.position.y = 0.5;
    this.body.castShadow = true;
    this.mesh.add(this.body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
    this.head = new THREE.Mesh(headGeo, this.glowMat);
    this.head.position.y = 1.35;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Horns (same as red enemy)
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0xff0000, emissive: 0xff1100, emissiveIntensity: 1.0, roughness: 0.2,
    });
    [-0.18, 0.18].forEach((ox) => {
      const hornGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(ox, 1.62, 0.05);
      horn.rotation.z = ox > 0 ? -0.35 : 0.35;
      this.mesh.add(horn);
    });

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    [-0.12, 0.12].forEach((ox) => {
      const eyeGeo = new THREE.SphereGeometry(0.07, 6, 4);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ox, 1.38, 0.27);
      this.mesh.add(eye);
    });

    // ── Spinning Rod ─────────────────────────────────────────────────────
    this.rodPivot = new THREE.Group();
    this.rodPivot.position.set(0, SpinningRodEnemy.ROD_Y, 0);
    this.mesh.add(this.rodPivot);

    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff6600,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8,
    });
    const rodGeo = new THREE.CylinderGeometry(
      SpinningRodEnemy.ROD_RADIUS,
      SpinningRodEnemy.ROD_RADIUS,
      SpinningRodEnemy.ROD_HALF_LENGTH * 2,
      8,
    );
    this.rod = new THREE.Mesh(rodGeo, rodMat);
    this.rod.rotation.z = Math.PI / 2; // lay horizontal
    this.rod.castShadow = true;
    this.rodPivot.add(this.rod);

    // End caps for visibility
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 2.0,
    });
    [-1, 1].forEach((side) => {
      const capGeo = new THREE.SphereGeometry(0.12, 6, 4);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(side * SpinningRodEnemy.ROD_HALF_LENGTH, 0, 0);
      this.rod.add(cap);
    });

    this.mesh.position.copy(spawnPos);
    this.mesh.scale.set(0, 0, 0);
    scene.add(this.mesh);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.state === 'DEAD') return;

    this.damageCooldown = Math.max(0, this.damageCooldown - dt);

    if (this.state === 'SPAWNING') {
      this.spawnTimer -= dt;
      const t = Math.min(1, 1 - this.spawnTimer / 0.6) * 1.1;
      this.mesh.scale.setScalar(Math.min(1.12, t));
      if (this.spawnTimer <= 0) {
        this.state = 'CHASING';
        this.mesh.scale.setScalar(1.12);
      }
      return;
    }

    // Rotate rod continuously
    this.rodAngle += SpinningRodEnemy.ROT_SPEED * dt;
    this.rodPivot.rotation.y = this.rodAngle;

    // Bob
    this.bobTime += dt * 3;
    this.body.position.y = 0.5 + Math.sin(this.bobTime) * 0.07;

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    const dist = toPlayer.length();

    if (dist < ENEMY.attackRange) {
      this.state = 'ATTACKING';
    } else if (dist < ENEMY.detectionRange) {
      this.state = 'CHASING';
      toPlayer.y = 0;
      toPlayer.normalize();
      this.mesh.position.addScaledVector(toPlayer, ENEMY.moveSpeed * dt);
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      const limit = ARENA.halfSize - ARENA.wallThickness - ENEMY.colliderRadius;
      this.mesh.position.x = Math.max(-limit, Math.min(limit, this.mesh.position.x));
      this.mesh.position.z = Math.max(-limit, Math.min(limit, this.mesh.position.z));
    }
  }

  /**
   * Check whether the spinning rod tip or body overlaps the player.
   * Rod sweeps horizontally at ROD_Y (~0.9) ±ROD_RADIUS.
   * A sliding player (~0.4 height clearance) can duck under it.
   * A jumping player clears it from above.
   *
   * playerPos = feet position, playerH = standing height (1.8), slideH when sliding (~0.5).
   */
  checkRodContact(
    playerPos: THREE.Vector3,
    playerRadius: number,
    isSliding: boolean,
  ): boolean {
    if (this.state === 'DEAD' || this.damageCooldown > 0) return false;

    // Player vertical extent
    const playerFeet = playerPos.y;
    const playerHead = isSliding ? playerFeet + 0.55 : playerFeet + 1.8;

    // Rod world Y extent
    const rodWorldY = this.mesh.position.y + SpinningRodEnemy.ROD_Y;
    const rodMinY = rodWorldY - SpinningRodEnemy.ROD_RADIUS - 0.05;
    const rodMaxY = rodWorldY + SpinningRodEnemy.ROD_RADIUS + 0.05;

    // If player is fully above or fully below rod band, no hit
    if (playerHead < rodMinY || playerFeet > rodMaxY) return false;

    // Check if any part of the rotating rod is within range of the player
    // Rod tip positions (both ends)
    const enemyPos = this.mesh.position;
    const angle = this.rodAngle;
    const halfLen = SpinningRodEnemy.ROD_HALF_LENGTH;

    // Sample multiple points along the rod
    for (let t = -1; t <= 1; t += 0.25) {
      const rx = enemyPos.x + Math.cos(angle) * halfLen * t;
      const rz = enemyPos.z + Math.sin(angle) * halfLen * t;
      const dx = playerPos.x - rx;
      const dz = playerPos.z - rz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= playerRadius + SpinningRodEnemy.ROD_RADIUS + 0.15) {
        return true;
      }
    }
    return false;
  }

  /** Marks cooldown so rod doesn't damage every frame. Game.ts handles the actual health deduction. */
  applyRodDamage(): void {
    this.damageCooldown = SpinningRodEnemy.ROD_COOLDOWN;
  }

  checkHit(pos: THREE.Vector3, prevPos: THREE.Vector3, radius: number): boolean {
    if (this.state === 'DEAD') return false;
    const enemyRadius = 0.45 + radius;
    const minY = this.mesh.position.y;
    const maxY = minY + 2.0;
    const projMinY = Math.min(pos.y, prevPos.y) - radius;
    const projMaxY = Math.max(pos.y, prevPos.y) + radius;
    if (projMaxY < minY || projMinY > maxY) return false;

    const ex = this.mesh.position.x;
    const ez = this.mesh.position.z;
    const sx = pos.x - prevPos.x;
    const sz = pos.z - prevPos.z;
    const segLenSq = sx * sx + sz * sz;
    let distSq: number;
    if (segLenSq < 0.0001) {
      distSq = (pos.x - ex) ** 2 + (pos.z - ez) ** 2;
    } else {
      const t = Math.max(0, Math.min(1, ((ex - prevPos.x) * sx + (ez - prevPos.z) * sz) / segLenSq));
      distSq = (prevPos.x + t * sx - ex) ** 2 + (prevPos.z + t * sz - ez) ** 2;
    }
    return distSq <= enemyRadius * enemyRadius;
  }

  takeDamage(amount: number): void {
    if (this.state === 'DEAD') return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return;
    }
    this.glowMat.emissive.setHex(0xffffff);
    this.glowMat.emissiveIntensity = 2.0;
    setTimeout(() => {
      if (this.state !== 'DEAD') {
        this.glowMat.emissive.setHex(0xff0000);
        this.glowMat.emissiveIntensity = 0.85;
      }
    }, 120);
  }

  private die(): void {
    this.state = 'DEAD';
    this.mesh.visible = false;
    this.scene.remove(this.mesh);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
        else m.material?.dispose();
      }
    });
  }

  get isDead(): boolean { return this.state === 'DEAD'; }
  get position(): THREE.Vector3 { return this.mesh.position; }
}
