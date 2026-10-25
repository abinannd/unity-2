import * as THREE from 'three';
import { ENEMY, ARENA } from '../game/GameConfig';

export type EnemyState = 'SPAWNING' | 'CHASING' | 'ATTACKING' | 'DEAD';

const SPAWN_ANIM_DURATION = 0.6;
let _nextEnemyUid = 0;

export class Enemy {
  readonly mesh: THREE.Group;
  state: EnemyState = 'SPAWNING';
  health = ENEMY.health;
  attackCooldown = 0;
  /** Unique numeric ID for per-projectile hit tracking. */
  readonly _uid = _nextEnemyUid++;
  private spawnTimer = SPAWN_ANIM_DURATION;

  private readonly body: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly glowMat: THREE.MeshStandardMaterial;
  private readonly baseEmissive: number;
  private readonly baseEmissiveIntensity: number;
  private bobTime = 0;

  private readonly scene: THREE.Scene;

  /** Called when this enemy successfully hits the player. */
  onAttackPlayer?: (damage: number) => void;

  constructor(
    scene: THREE.Scene,
    spawnPos: THREE.Vector3,
    public readonly maxHealth: number,
    public readonly isRed: boolean = false,
  ) {
    this.scene = scene;
    this.health = maxHealth;
    this.mesh = new THREE.Group();

    this.baseEmissive = isRed ? 0xff0000 : 0x440808;
    this.baseEmissiveIntensity = isRed ? 0.85 : 0.4;
    const baseColor = isRed ? 0xff1515 : 0x882020;

    // Body (capsule-ish: cylinder + sphere)
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.0, 8);
    this.glowMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: this.baseEmissive,
      emissiveIntensity: this.baseEmissiveIntensity,
      roughness: isRed ? 0.3 : 0.5,
      metalness: isRed ? 0.4 : 0.5,
    });
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

    // Red enemy distinct feature: two prominent horns on head
    if (this.isRed) {
      const hornMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff1100,
        emissiveIntensity: 1.0,
        roughness: 0.2,
      });
      [-0.18, 0.18].forEach((ox) => {
        const hornGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(ox, 1.62, 0.05);
        horn.rotation.z = ox > 0 ? -0.35 : 0.35;
        this.mesh.add(horn);
      });
    }

    // Eyes (amber for red enemy, soft white for ordinary)
    const eyeMat = new THREE.MeshBasicMaterial({ color: isRed ? 0xffdd44 : 0xcccccc });
    [-0.12, 0.12].forEach((ox) => {
      const eyeGeo = new THREE.SphereGeometry(0.07, 6, 4);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ox, 1.38, 0.27);
      this.mesh.add(eye);
    });

    this.mesh.position.copy(spawnPos);
    this.mesh.scale.set(0, 0, 0); // start invisible for spawn anim
    scene.add(this.mesh);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.state === 'DEAD') return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const targetScale = this.isRed ? 1.12 : 1.0;

    if (this.state === 'SPAWNING') {
      this.spawnTimer -= dt;
      const t = 1 - this.spawnTimer / SPAWN_ANIM_DURATION;
      const s = Math.min(1, t * 1.1) * targetScale;
      this.mesh.scale.setScalar(s);
      if (this.spawnTimer <= 0) {
        this.state = 'CHASING';
        this.mesh.scale.setScalar(targetScale);
      }
      return;
    }

    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    const dist = toPlayer.length();

    // Bob animation
    this.bobTime += dt * 3;
    this.body.position.y = 0.5 + Math.sin(this.bobTime) * 0.07;

    if (dist < ENEMY.attackRange) {
      this.state = 'ATTACKING';
      if (this.attackCooldown <= 0) {
        this.attackCooldown = ENEMY.attackCooldown;
        this.onAttackPlayer?.(ENEMY.attackDamage);
      }
    } else if (dist < ENEMY.detectionRange) {
      this.state = 'CHASING';
      toPlayer.y = 0;
      toPlayer.normalize();
      this.mesh.position.addScaledVector(toPlayer, ENEMY.moveSpeed * dt);

      // Face player
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

      // Arena clamp
      const limit = ARENA.halfSize - ARENA.wallThickness - ENEMY.colliderRadius;
      this.mesh.position.x = Math.max(-limit, Math.min(limit, this.mesh.position.x));
      this.mesh.position.z = Math.max(-limit, Math.min(limit, this.mesh.position.z));
    }
  }

  /**
   * Accurate 3D cylinder hit detection against a projectile's path.
   * Checks horizontal distance to enemy axis AND vertical extent (feet to head).
   */
  checkHit(pos: THREE.Vector3, prevPos: THREE.Vector3, radius: number): boolean {
    if (this.state === 'DEAD') return false;

    const enemyRadius = (this.isRed ? 0.45 : 0.4) + radius;
    const enemyHeight = this.isRed ? 2.0 : 1.8;
    const minY = this.mesh.position.y;
    const maxY = minY + enemyHeight;

    // Check vertical overlap
    const projMinY = Math.min(pos.y, prevPos.y) - radius;
    const projMaxY = Math.max(pos.y, prevPos.y) + radius;
    if (projMaxY < minY || projMinY > maxY) return false;

    // Check 2D distance from enemy center to projectile segment (prevPos -> pos)
    const ex = this.mesh.position.x;
    const ez = this.mesh.position.z;
    const sx = pos.x - prevPos.x;
    const sz = pos.z - prevPos.z;
    const segLenSq = sx * sx + sz * sz;

    let distSq: number;
    if (segLenSq < 0.0001) {
      const dx = pos.x - ex;
      const dz = pos.z - ez;
      distSq = dx * dx + dz * dz;
    } else {
      const t = Math.max(0, Math.min(1, ((ex - prevPos.x) * sx + (ez - prevPos.z) * sz) / segLenSq));
      const closestX = prevPos.x + t * sx;
      const closestZ = prevPos.z + t * sz;
      const dx = closestX - ex;
      const dz = closestZ - ez;
      distSq = dx * dx + dz * dz;
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
        this.glowMat.emissive.setHex(this.baseEmissive);
        this.glowMat.emissiveIntensity = this.baseEmissiveIntensity;
      }
    }, 120);
  }

  private die(): void {
    this.state = 'DEAD';
    this.mesh.visible = false;
    this.scene.remove(this.mesh);
  }

  dispose(scene?: THREE.Scene): void {
    const s = scene ?? this.scene;
    s.remove(this.mesh);
    this.mesh.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
  }

  get isDead(): boolean { return this.state === 'DEAD'; }
  get position(): THREE.Vector3 { return this.mesh.position; }
}
