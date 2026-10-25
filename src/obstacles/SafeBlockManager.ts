import * as THREE from 'three';
import { SAFE_BLOCK, ARENA } from '../game/GameConfig';
import { SafeBlock } from './SafeBlock';

/**
 * Manages the single optional safe block.
 * Exactly one safe block may exist at a time.
 * After it expires, a new one respawns after SAFE_BLOCK.respawnDelay seconds.
 */
export class SafeBlockManager {
  private block: SafeBlock | null = null;
  private respawnTimer = 5; // short initial delay before first spawn

  constructor(private readonly scene: THREE.Scene) {}

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.block) {
      this.block.update(dt);
      if (this.block.isDead) {
        this.block.dispose(this.scene);
        this.block = null;
        this.respawnTimer = SAFE_BLOCK.respawnDelay;
      }
    } else {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.spawn(playerPos);
      }
    }
  }

  private spawn(playerPos: THREE.Vector3): void {
    const limit = ARENA.halfSize - ARENA.wallThickness - SAFE_BLOCK.size / 2 - 1;
    let pos: THREE.Vector3;
    let attempts = 0;
    do {
      pos = new THREE.Vector3(
        (Math.random() * 2 - 1) * limit,
        0,
        (Math.random() * 2 - 1) * limit,
      );
      attempts++;
    } while (pos.distanceTo(playerPos) < 4 && attempts < 30);

    this.block = new SafeBlock(this.scene, pos);
  }

  /** Returns the active safe block (or null) for collision integration. */
  getBlock(): SafeBlock | null {
    return this.block && !this.block.isDead ? this.block : null;
  }

  reset(): void {
    if (this.block) {
      this.block.dispose(this.scene);
      this.block = null;
    }
    this.respawnTimer = 5;
  }
}
