import * as THREE from 'three';
import { GRAPPLE, ARENA } from '../game/GameConfig';

export type GrappleTargetState = 'SPAWNING' | 'ACTIVE' | 'DESPAWNING' | 'DEAD';

const FADE_DURATION = 0.4; // seconds for fade-in and fade-out

/**
 * A floating grapple target sphere with dynamic lifecycle:
 * SPAWNING (fade-in) -> ACTIVE (floating & pulsing) -> DESPAWNING (fade-out) -> DEAD
 */
class GrappleTarget {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshStandardMaterial;
  private baseY: number;
  private phase: number;
  private lifeTimer: number;
  private fadeTimer = 0;
  state: GrappleTargetState = 'SPAWNING';

  // Shared geometry reused across all targets
  private static sharedGeo: THREE.SphereGeometry | null = null;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, lifetime: number) {
    if (!GrappleTarget.sharedGeo) {
      GrappleTarget.sharedGeo = new THREE.SphereGeometry(GRAPPLE.targetRadius, 16, 12);
    }

    this.mat = new THREE.MeshStandardMaterial({
      color: GRAPPLE.targetGlowColor,
      emissive: GRAPPLE.targetGlowColor,
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0,
    });

    this.mesh = new THREE.Mesh(GrappleTarget.sharedGeo, this.mat);
    this.mesh.position.copy(pos);
    this.baseY = pos.y;
    this.phase = Math.random() * Math.PI * 2;
    this.lifeTimer = lifetime;
    this.state = 'SPAWNING';
    this.fadeTimer = 0;

    scene.add(this.mesh);
  }

  update(dt: number): void {
    if (this.state === 'DEAD') return;

    // Subtle floating & pulsing animation
    this.phase += dt * 1.5;
    this.mesh.position.y = this.baseY + Math.sin(this.phase) * 0.25;
    const pulse = 1 + 0.07 * Math.sin(this.phase * 1.8);

    if (this.state === 'SPAWNING') {
      this.fadeTimer += dt;
      const progress = Math.min(1, this.fadeTimer / FADE_DURATION);
      this.mat.opacity = progress;
      this.mat.emissiveIntensity = 0.9 * progress;
      this.mesh.scale.setScalar(pulse * progress);

      if (progress >= 1) {
        this.state = 'ACTIVE';
        this.mat.opacity = 1.0;
        this.mat.emissiveIntensity = 0.9;
        this.mesh.scale.setScalar(pulse);
      }
    } else if (this.state === 'ACTIVE') {
      this.mesh.scale.setScalar(pulse);
      this.lifeTimer -= dt;
      if (this.lifeTimer <= 0) {
        this.state = 'DESPAWNING';
        this.fadeTimer = FADE_DURATION;
      }
    } else if (this.state === 'DESPAWNING') {
      this.fadeTimer -= dt;
      const progress = Math.max(0, this.fadeTimer / FADE_DURATION);
      this.mat.opacity = progress;
      this.mat.emissiveIntensity = 0.9 * progress;
      this.mesh.scale.setScalar(pulse * progress);

      if (progress <= 0) {
        this.state = 'DEAD';
      }
    }
  }

  get isSelectable(): boolean {
    return this.state === 'ACTIVE';
  }

  get isDead(): boolean {
    return this.state === 'DEAD';
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mat.dispose();
  }
}

/** Visible tether line between hero and grapple target. */
class Tether {
  private line: THREE.Line;
  private readonly geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 points × 3
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    this.line = new THREE.Line(this.geo, mat);
    scene.add(this.line);
  }

  update(from: THREE.Vector3, to: THREE.Vector3): void {
    const pos = this.geo.attributes['position'] as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y + 1.2, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.line);
    this.geo.dispose();
  }
}

/**
 * Manages dynamically spawning and despawning grapple targets and the R-key grapple mechanic.
 * Max active targets is capped at GRAPPLE.maxTargets (3).
 * Targets live for GRAPPLE.targetLifetime (8s), fade out, and spawn replacements after 2-4s.
 */
export class GrappleSystem {
  private targets: GrappleTarget[] = [];
  private pendingRespawns: number[] = [];
  private grappling = false;
  private grappleTarget: GrappleTarget | null = null;
  private grappleTimer = 0;
  private grappleStartPos = new THREE.Vector3();
  private tether: Tether | null = null;

  // Output for PlayerController
  private _grappleVelocity = new THREE.Vector3();
  private _isGrappling = false;

  private rPressed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    this.spawnInitialTargets();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && !e.repeat) this.rPressed = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyR') this.rPressed = false;
    });
  }

  private findSpawnPosition(playerPos?: THREE.Vector3): THREE.Vector3 {
    const limit = ARENA.halfSize - ARENA.wallThickness - 2.5; // safe distance inside walls
    const minHeight = 3.2;
    const maxHeight = 7.5; // well below 10m ceiling and above floor blocks

    for (let attempt = 0; attempt < 30; attempt++) {
      const x = (Math.random() * 2 - 1) * limit;
      const z = (Math.random() * 2 - 1) * limit;
      const y = minHeight + Math.random() * (maxHeight - minHeight);
      const cand = new THREE.Vector3(x, y, z);

      // Distance to hero
      if (playerPos && cand.distanceTo(playerPos) < 4.5) continue;

      // Distance to existing targets (avoid clumping / duplicates)
      let minTargetDist = 999;
      for (const t of this.targets) {
        if (t.isDead) continue;
        const d = cand.distanceTo(t.position);
        if (d < minTargetDist) minTargetDist = d;
      }
      if (minTargetDist < 6.0) continue;

      return cand;
    }

    // Fallback if space is tight
    const fallbackX = (Math.random() * 2 - 1) * (limit - 3);
    const fallbackZ = (Math.random() * 2 - 1) * (limit - 3);
    const fallbackY = minHeight + Math.random() * (maxHeight - minHeight);
    return new THREE.Vector3(fallbackX, fallbackY, fallbackZ);
  }

  private spawnInitialTargets(playerPos?: THREE.Vector3): void {
    while (this.targets.length < GRAPPLE.maxTargets) {
      const pos = this.findSpawnPosition(playerPos);
      this.targets.push(new GrappleTarget(this.scene, pos, GRAPPLE.targetLifetime));
    }
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // 1. Update and animate targets
    for (const t of this.targets) {
      t.update(dt);
    }

    // 2. Remove dead targets and schedule replacement respawn timer
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.isDead) {
        t.dispose(this.scene);
        this.targets.splice(i, 1);
        const delay = GRAPPLE.respawnDelayMin + Math.random() * (GRAPPLE.respawnDelayMax - GRAPPLE.respawnDelayMin);
        this.pendingRespawns.push(delay);
      }
    }

    // 3. Process respawn timers up to maxTargets
    for (let i = this.pendingRespawns.length - 1; i >= 0; i--) {
      this.pendingRespawns[i] -= dt;
      if (this.pendingRespawns[i] <= 0) {
        this.pendingRespawns.splice(i, 1);
        if (this.targets.length < GRAPPLE.maxTargets) {
          const pos = this.findSpawnPosition(playerPos);
          this.targets.push(new GrappleTarget(this.scene, pos, GRAPPLE.targetLifetime));
        }
      }
    }

    // Ensure we don't have fewer targets than maxTargets without queued respawns
    while (this.targets.length + this.pendingRespawns.length < GRAPPLE.maxTargets) {
      const delay = GRAPPLE.respawnDelayMin + Math.random() * (GRAPPLE.respawnDelayMax - GRAPPLE.respawnDelayMin);
      this.pendingRespawns.push(delay);
    }

    // 4. Activate grapple on R press
    if (this.rPressed && !this.grappling) {
      this.rPressed = false;
      this.tryActivateGrapple(playerPos);
    }

    // 5. Drive grapple movement
    if (this.grappling) {
      // If target despawns or becomes inactive during grapple, safely abort
      if (!this.grappleTarget || this.grappleTarget.state !== 'ACTIVE') {
        this.endGrapple();
        return;
      }

      this.grappleTimer -= dt;
      const toTarget = new THREE.Vector3().subVectors(this.grappleTarget.position, playerPos);
      const dist = toTarget.length();
      const traveled = playerPos.distanceTo(this.grappleStartPos);

      // Check reach, max travel distance, or timeout
      if (dist <= GRAPPLE.reachTolerance || traveled >= GRAPPLE.maxTravelDistance || this.grappleTimer <= 0) {
        this.endGrapple();
        return;
      }

      toTarget.normalize();
      this._grappleVelocity.copy(toTarget).multiplyScalar(GRAPPLE.speed);

      // Update tether line
      this.tether?.update(playerPos, this.grappleTarget.position);
    } else {
      this._grappleVelocity.set(0, 0, 0);
    }
  }

  private tryActivateGrapple(playerPos: THREE.Vector3): void {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    let bestTarget: GrappleTarget | null = null;
    let bestDot = GRAPPLE.aimTolerance;

    for (const t of this.targets) {
      // Ignore targets that are spawning, despawning, or inactive
      if (!t.isSelectable) continue;

      const toTarget = new THREE.Vector3().subVectors(t.position, playerPos);
      const dist = toTarget.length();
      if (dist > GRAPPLE.maxRange) continue;

      const rayDir = ray.ray.direction;
      const targetDir = toTarget.normalize();
      const dot = rayDir.dot(targetDir);
      if (dot > bestDot) {
        bestDot = dot;
        bestTarget = t;
      }
    }

    if (!bestTarget) return;

    // Start grapple
    this.grappling = true;
    this._isGrappling = true;
    this.grappleTarget = bestTarget;
    this.grappleStartPos.copy(playerPos);
    this.grappleTimer = GRAPPLE.maxDuration;
    this.tether = new Tether(this.scene);
  }

  endGrapple(): void {
    this.grappling = false;
    this._isGrappling = false;
    this._grappleVelocity.set(0, 0, 0);
    if (this.tether) {
      this.tether.dispose(this.scene);
      this.tether = null;
    }
    this.grappleTarget = null;
  }

  /** Get the grapple velocity to apply to the player this frame. */
  get grappleVelocity(): THREE.Vector3 { return this._grappleVelocity; }
  get isGrappling(): boolean { return this._isGrappling; }

  reset(): void {
    this.endGrapple();
    for (const t of this.targets) {
      t.dispose(this.scene);
    }
    this.targets = [];
    this.pendingRespawns = [];
    this.rPressed = false;
    this.spawnInitialTargets();
  }
}

