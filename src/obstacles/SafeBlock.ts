import * as THREE from 'three';
import { SAFE_BLOCK, ARENA } from '../game/GameConfig';

/**
 * A stationary green safe platform that persists for SAFE_BLOCK.lifetime seconds.
 * Implements the same halfExtents / topY / movementDelta interface used by
 * PlayerController.updatePlatforms() so it slots into the existing collision system.
 */
export class SafeBlock {
  readonly mesh: THREE.Mesh;
  private glowMesh: THREE.Mesh;     // slightly larger transparent shell for glow effect
  private lifetime: number;
  private _isDead = false;

  /** Half-extents on each axis (x, y, z) in world space — matches Block interface. */
  readonly halfExtents: THREE.Vector3;

  /** Zero delta — safe block never moves. */
  readonly movementDelta = new THREE.Vector3(0, 0, 0);

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    const s = SAFE_BLOCK.size;
    this.halfExtents = new THREE.Vector3(s / 2, s / 2, s / 2);
    this.lifetime = SAFE_BLOCK.lifetime;

    // ── Main body ────────────────────────────────────────────────────────
    const geo = new THREE.BoxGeometry(s, s, s);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00cc44,
      emissive: 0x005522,
      emissiveIntensity: 0.55,
      roughness: 0.45,
      metalness: 0.2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(pos.x, s / 2, pos.z); // centre at half-height above floor
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    // ── Outer glow shell (slightly larger, transparent) ───────────────────
    const glowGeo = new THREE.BoxGeometry(s + 0.18, s + 0.18, s + 0.18);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00ff66,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.glowMesh.position.copy(this.mesh.position);
    scene.add(this.glowMesh);
  }

  update(dt: number): void {
    if (this._isDead) return;
    this.lifetime -= dt;

    // Pulse glow
    const pulse = 0.08 + 0.05 * Math.sin(performance.now() * 0.004);
    (this.glowMesh.material as THREE.MeshStandardMaterial).opacity = pulse;

    if (this.lifetime <= 0) this._isDead = true;
  }

  /** World-space Y of the top surface. */
  get topY(): number {
    return this.mesh.position.y + this.halfExtents.y;
  }

  get isDead(): boolean { return this._isDead; }
  get isActive(): boolean { return !this._isDead; }
  get position(): THREE.Vector3 { return this.mesh.position; }
  get remainingTime(): number { return Math.max(0, this.lifetime); }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.glowMesh);
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.glowMesh.geometry as THREE.BufferGeometry).dispose();
  }
}
