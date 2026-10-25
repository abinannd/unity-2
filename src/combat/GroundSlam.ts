import * as THREE from 'three';
import { GROUND_SLAM } from '../game/GameConfig';
import { EnemySpawner } from '../enemies/EnemySpawner';

type SlamState = 'idle' | 'slamming' | 'recovery';

interface Shockwave {
  mesh: THREE.Mesh;
  timer: number;
}

/**
 * Handles ground-slam activation (right mouse button), downward velocity injection,
 * impact detection, AoE damage, shockwave VFX, and camera shake.
 *
 * Integrates with PlayerController via an update() call each frame.
 * The PlayerController must call getDownVelocity() to get the slam-injected
 * vertical velocity, and call onLanded() when it detects ground contact.
 */
export class GroundSlam {
  private state: SlamState = 'idle';
  private recoveryTimer = 0;
  private apexY = 0;           // highest Y reached since leaving ground
  private currentY = 0;        // updated each frame
  private rightClickPending = false;
  private alreadyImpacted = false;

  // VFX
  private shockwaves: Shockwave[] = [];
  private readonly shockGeo: THREE.RingGeometry;
  private readonly shockMat: THREE.MeshBasicMaterial;

  // Camera shake
  private shakeTimer = 0;
  private readonly shakeOffset = new THREE.Vector3();
  private cameraOriginalPos = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly enemySpawner: EnemySpawner,
  ) {
    this.shockGeo = new THREE.RingGeometry(0, 0.5, 32);
    this.shockMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.rightClickPending = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rightClickPending = false;
    });
  }

  /** Call every frame before position is integrated. Returns override vertical velocity or null. */
  update(dt: number, playerY: number, isGrounded: boolean, isDescending: boolean): number | null {
    // Track apex
    if (!isGrounded) {
      if (playerY > this.apexY) this.apexY = playerY;
    } else {
      this.apexY = playerY;
      this.alreadyImpacted = false;
      if (this.state === 'recovery') {
        this.recoveryTimer -= dt;
        if (this.recoveryTimer <= 0) this.state = 'idle';
      }
    }
    this.currentY = playerY;

    // Shockwave VFX update
    this.updateShockwaves(dt);

    // Camera shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const mag = GROUND_SLAM.cameraShakeMagnitude * (this.shakeTimer / GROUND_SLAM.cameraShakeDuration);
      this.camera.position.x += (Math.random() - 0.5) * mag;
      this.camera.position.y += (Math.random() - 0.5) * mag;
    }

    // Recovery lock — no new slam
    if (this.state === 'recovery') return null;

    // Activation conditions
    if (
      this.rightClickPending &&
      this.state === 'idle' &&
      !isGrounded &&
      isDescending &&
      (this.apexY - playerY) >= GROUND_SLAM.minFallDistance
    ) {
      this.state = 'slamming';
      this.rightClickPending = false;
      return GROUND_SLAM.downVelocity;
    }

    // While slamming, keep the downward velocity override
    if (this.state === 'slamming') {
      return GROUND_SLAM.downVelocity;
    }

    return null;
  }

  /** Call when the player makes contact with a surface (floor or block top). */
  onLanded(impactPos: THREE.Vector3): void {
    if (this.state !== 'slamming' || this.alreadyImpacted) return;
    this.alreadyImpacted = true;
    this.state = 'recovery';
    this.recoveryTimer = GROUND_SLAM.recoveryTime;

    // AoE damage
    this.enemySpawner.applyDamageToEnemiesNear(impactPos, GROUND_SLAM.aoeRadius, GROUND_SLAM.aoeDamage);

    // Shockwave VFX
    this.spawnShockwave(impactPos);

    // Camera shake
    this.shakeTimer = GROUND_SLAM.cameraShakeDuration;
  }

  get isSlamming(): boolean { return this.state === 'slamming'; }
  get isInRecovery(): boolean { return this.state === 'recovery'; }

  private spawnShockwave(pos: THREE.Vector3): void {
    const mat = this.shockMat.clone();
    const mesh = new THREE.Mesh(this.shockGeo.clone(), mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.05;
    mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, timer: GROUND_SLAM.shockwaveDuration });
  }

  private updateShockwaves(dt: number): void {
    const toRemove: Shockwave[] = [];
    for (const sw of this.shockwaves) {
      sw.timer -= dt;
      const progress = 1 - sw.timer / GROUND_SLAM.shockwaveDuration;
      const radius = progress * GROUND_SLAM.aoeRadius;
      sw.mesh.scale.setScalar(radius * 2);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - progress);
      if (sw.timer <= 0) {
        this.scene.remove(sw.mesh);
        toRemove.push(sw);
      }
    }
    this.shockwaves = this.shockwaves.filter(s => !toRemove.includes(s));
  }

  reset(): void {
    this.state = 'idle';
    this.recoveryTimer = 0;
    this.apexY = 0;
    this.alreadyImpacted = false;
    for (const sw of this.shockwaves) this.scene.remove(sw.mesh);
    this.shockwaves = [];
  }
}
