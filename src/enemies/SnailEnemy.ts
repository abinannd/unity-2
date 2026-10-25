import * as THREE from 'three';
import { ARENA } from '../game/GameConfig';

/**
 * Snail enemy — persistent, unkillable, instant-kills on contact.
 * Bullets have zero effect. Very slow pursuit of the player.
 */
export class SnailEnemy {
  readonly mesh: THREE.Group;
  private readonly scene: THREE.Scene;
  private bobTime = 0;

  // Speed much slower than regular enemies (moveSpeed = 3.2)
  private static readonly MOVE_SPEED = 0.6;
  private static readonly COLLIDER_RADIUS = 0.55;

  constructor(scene: THREE.Scene, spawnPos: THREE.Vector3) {
    this.scene = scene;
    this.mesh = new THREE.Group();

    // ── Shell (dome + coil bands) ──────────────────────────────────────
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xa0522d,
      emissive: 0x3a1500,
      emissiveIntensity: 0.5,
      roughness: 0.6,
      metalness: 0.2,
    });
    const shellHighlightMat = new THREE.MeshStandardMaterial({
      color: 0xd2691e,
      emissive: 0x5a2500,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });

    // Main shell dome
    const shellGeo = new THREE.SphereGeometry(0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.set(0, 0.5, 0.05);
    shell.rotation.x = -0.2;
    shell.castShadow = true;
    this.mesh.add(shell);

    // Spiral coil bands on shell
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(0.28 - i * 0.07, 0.04, 5, 12, Math.PI * 1.6);
      const ring = new THREE.Mesh(ringGeo, shellHighlightMat);
      ring.position.set(0, 0.52 + i * 0.12, 0.02);
      ring.rotation.x = -0.3 + i * 0.15;
      ring.rotation.z = i * 0.6;
      this.mesh.add(ring);
    }

    // ── Body / foot (elongated blob) ──────────────────────────────────
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8fbc8f,
      emissive: 0x1a4a1a,
      emissiveIntensity: 0.4,
      roughness: 0.8,
    });

    const bodyGeo = new THREE.CapsuleGeometry(0.28, 0.55, 6, 8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.22, 0);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    this.mesh.add(body);

    // ── Head ──────────────────────────────────────────────────────────
    const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.38, 0.45);
    head.castShadow = true;
    this.mesh.add(head);

    // ── Eyestalks ─────────────────────────────────────────────────────
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x6aaa6a, roughness: 0.8 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-0.1, 0.1].forEach((ox) => {
      const stalkGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5);
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.set(ox, 0.67, 0.42);
      stalk.rotation.x = -0.3;
      this.mesh.add(stalk);

      const eyeGeo = new THREE.SphereGeometry(0.07, 6, 4);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(ox, 0.8, 0.43);
      this.mesh.add(eye);
    });

    this.mesh.position.copy(spawnPos);
    scene.add(this.mesh);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Bob slowly
    this.bobTime += dt * 1.5;
    this.mesh.position.y = Math.sin(this.bobTime) * 0.04;

    if (dist > 0.1) {
      toPlayer.normalize();
      this.mesh.position.addScaledVector(toPlayer, SnailEnemy.MOVE_SPEED * dt);
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    // Arena clamp
    const limit = ARENA.halfSize - ARENA.wallThickness - 0.6;
    this.mesh.position.x = Math.max(-limit, Math.min(limit, this.mesh.position.x));
    this.mesh.position.z = Math.max(-limit, Math.min(limit, this.mesh.position.z));
  }

  /** Returns true if the player is touching the snail. */
  checkPlayerContact(playerPos: THREE.Vector3, playerRadius = 0.4): boolean {
    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    const combined = SnailEnemy.COLLIDER_RADIUS + playerRadius;

    if (horizDist > combined) return false;

    // Vertical check — snail occupies y=0..~1.2
    const playerFeet = playerPos.y;
    const playerHead = playerPos.y + 1.8;
    return playerHead > 0 && playerFeet < 1.2;
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

  get position(): THREE.Vector3 { return this.mesh.position; }
}
