import * as THREE from 'three';
import { BLOCK, ARENA } from '../game/GameConfig';
import { Block } from './Block';

export class BlockSpawner {
  private blocks: Block[] = [];
  private spawnTimer = BLOCK.spawnInterval;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly onPlayerHit: (damage: number) => void,
  ) {}

  update(dt: number, playerPos: THREE.Vector3): void {
    // Spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.blocks.length < BLOCK.maxBlocks) {
      this.spawnTimer = BLOCK.spawnInterval;
      this.spawnBlock(playerPos);
    }

    // Update existing blocks + side-collision damage
    for (const block of this.blocks) {
      block.update(dt);
      // Only apply damage if player is NOT landing on top (i.e. side collision)
      if (!block.isDead && block.damagesPlayer) {
        const dx = Math.abs(block.position.x - playerPos.x);
        const dz = Math.abs(block.position.z - playerPos.z);
        const sideHitX = dx < block.halfExtents.x + 0.45;
        const sideHitZ = dz < block.halfExtents.z + 0.45;
        const vertHit = playerPos.y < block.topY && playerPos.y > block.position.y - block.halfExtents.y;
        if (sideHitX && sideHitZ && vertHit) {
          this.onPlayerHit(BLOCK.damageOnHit);
        }
      }
    }

    // Clean dead blocks
    const dead = this.blocks.filter(b => b.isDead);
    for (const b of dead) b.dispose(this.scene);
    this.blocks = this.blocks.filter(b => !b.isDead);
  }

  private spawnBlock(playerPos: THREE.Vector3): void {
    const limit = ARENA.halfSize - ARENA.wallThickness - 1;
    let pos: THREE.Vector3;
    let attempts = 0;
    do {
      pos = new THREE.Vector3(
        (Math.random() * 2 - 1) * limit,
        0,
        (Math.random() * 2 - 1) * limit,
      );
      attempts++;
    } while (pos.distanceTo(playerPos) < 3 && attempts < 20);

    this.blocks.push(new Block(this.scene, pos));
  }

  /** Returns all active blocks for projectile collision. */
  getActiveBlocks(): Block[] {
    return this.blocks.filter(b => !b.isDead);
  }

  reset(): void {
    for (const b of this.blocks) b.dispose(this.scene);
    this.blocks = [];
    this.spawnTimer = BLOCK.spawnInterval;
  }
}
