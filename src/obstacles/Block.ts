import * as THREE from 'three';
import { BLOCK, ARENA } from '../game/GameConfig';

type BlockPhase = 'warning' | 'active' | 'dead';

export class Block {
  readonly mesh: THREE.Mesh;
  private warnMesh: THREE.Mesh;
  private phase: BlockPhase = 'warning';
  private phaseTimer: number;
  private lifetime: number;
  private moveDir: THREE.Vector3;
  private moveSpeed: number;
  readonly damagesPlayer: boolean;

  /** Half-extents on each axis (x, y, z) in world space. */
  readonly halfExtents: THREE.Vector3;

  /** Previous position, used to compute movement delta for platform riding. */
  private prevPosition = new THREE.Vector3();
  /** Movement delta this frame — consumed by PlayerController. */
  private _movementDelta = new THREE.Vector3();

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    const size = BLOCK.minSize + Math.random() * (BLOCK.maxSize - BLOCK.minSize);
    this.halfExtents = new THREE.Vector3(size / 2, size / 2, size / 2);
    this.damagesPlayer = Math.random() < 0.6;

    // Warning indicator (translucent blinking disc)
    const warnGeo = new THREE.CylinderGeometry(size * 0.6, size * 0.6, 0.06, 10);
    const warnMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.55 });
    this.warnMesh = new THREE.Mesh(warnGeo, warnMat);
    this.warnMesh.position.copy(pos);
    this.warnMesh.position.y = 0.03;
    scene.add(this.warnMesh);

    // Main block — bottom sits at pos.y (we set position.y = half.y)
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: this.damagesPlayer ? 0xff4400 : 0x1155cc,
      emissive: this.damagesPlayer ? 0x440000 : 0x001155,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos);
    this.mesh.position.y = this.halfExtents.y; // centre at half height
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.prevPosition.copy(this.mesh.position);
    this.phaseTimer = BLOCK.warnDuration;
    this.lifetime = BLOCK.lifetime;

    const angle = Math.random() * Math.PI * 2;
    this.moveDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    this.moveSpeed = BLOCK.moveSpeed * (0.5 + Math.random() * 0.8);
  }

  update(dt: number): void {
    this.prevPosition.copy(this.mesh.position);
    this._movementDelta.set(0, 0, 0);

    if (this.phase === 'dead') return;

    if (this.phase === 'warning') {
      this.warnMesh.visible = (Math.floor(this.phaseTimer * 7) % 2 === 0);
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'active';
        this.phaseTimer = this.lifetime;
        this.mesh.visible = true;
        this.warnMesh.visible = false;
      }
    } else if (this.phase === 'active') {
      this.mesh.position.addScaledVector(this.moveDir, this.moveSpeed * dt);
      this.mesh.rotation.y += dt * 0.6;

      const limit = ARENA.halfSize - ARENA.wallThickness - this.halfExtents.x;
      if (Math.abs(this.mesh.position.x) > limit) {
        this.moveDir.x *= -1;
        this.mesh.position.x = Math.sign(this.mesh.position.x) * limit;
      }
      if (Math.abs(this.mesh.position.z) > limit) {
        this.moveDir.z *= -1;
        this.mesh.position.z = Math.sign(this.mesh.position.z) * limit;
      }

      this._movementDelta.subVectors(this.mesh.position, this.prevPosition);
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.phase = 'dead';
    }
  }

  /** World-space Y of the block's top surface. */
  get topY(): number {
    return this.mesh.position.y + this.halfExtents.y;
  }

  /** Movement delta since last frame (for platform riding). */
  get movementDelta(): THREE.Vector3 { return this._movementDelta; }

  get isDead(): boolean { return this.phase === 'dead'; }
  get isActive(): boolean { return this.phase === 'active'; }
  get position(): THREE.Vector3 { return this.mesh.position; }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.warnMesh);
    (this.mesh.geometry as THREE.BufferGeometry).dispose();
    (this.warnMesh.geometry as THREE.BufferGeometry).dispose();
  }
}
