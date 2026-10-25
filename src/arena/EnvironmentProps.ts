import * as THREE from 'three';
import { ARENA } from '../game/GameConfig';

export interface PropCollider {
  cx: number;
  cz: number;
  radius: number;
}

/**
 * Static environment props: rocks, trees, stumps.
 * Provides collision data for player / snail avoidance.
 */
export class EnvironmentProps {
  readonly colliders: PropCollider[] = [];
  private readonly group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildProps();
  }

  private buildProps(): void {
    const safe = ARENA.halfSize - ARENA.wallThickness - 1.8;

    // Predefined layout — avoids centre (player spawn) and initial grapple dot area
    const propDefs: Array<{ type: 'rock' | 'tree' | 'stump'; x: number; z: number; scale: number }> = [
      // Rocks — scattered in quadrants
      { type: 'rock', x: -14, z: -10, scale: 1.0 },
      { type: 'rock', x:  12, z: -14, scale: 0.75 },
      { type: 'rock', x:  16, z:   8, scale: 1.2 },
      { type: 'rock', x: -10, z:  15, scale: 0.9 },
      { type: 'rock', x:  -5, z: -17, scale: 0.65 },
      { type: 'rock', x:  18, z: -6,  scale: 0.8 },
      { type: 'rock', x:  -18, z: 12, scale: 1.1 },
      { type: 'rock', x:   8, z:  18, scale: 0.7 },
      { type: 'rock', x:  -8, z: -8, scale: 0.55 },
      { type: 'rock', x:  14, z: -18, scale: 0.8 },

      // Trees — corners and mid-zones
      { type: 'tree', x: -18, z: -18, scale: 1.0 },
      { type: 'tree', x:  17, z: -17, scale: 1.1 },
      { type: 'tree', x: -17, z:  17, scale: 0.9 },
      { type: 'tree', x:  19, z:  16, scale: 1.05 },
      { type: 'tree', x:  -6, z:  12, scale: 0.85 },
      { type: 'tree', x:  10, z: -8,  scale: 0.9 },
      { type: 'tree', x: -14, z:   2, scale: 1.0 },

      // Stumps — low-profile, spread around
      { type: 'stump', x:  6, z: -12, scale: 1.0 },
      { type: 'stump', x: -10, z:  5, scale: 0.9 },
      { type: 'stump', x:  14, z:  4, scale: 1.1 },
      { type: 'stump', x:  -3, z: -14, scale: 0.85 },
      { type: 'stump', x:  -18, z: -4, scale: 0.95 },
    ];

    for (const def of propDefs) {
      // Safety clamp inside arena
      const cx = Math.max(-safe, Math.min(safe, def.x));
      const cz = Math.max(-safe, Math.min(safe, def.z));

      if (def.type === 'rock') {
        const radius = this.addRock(cx, cz, def.scale);
        this.colliders.push({ cx, cz, radius });
      } else if (def.type === 'tree') {
        const radius = this.addTree(cx, cz, def.scale);
        this.colliders.push({ cx, cz, radius });
      } else {
        const radius = this.addStump(cx, cz, def.scale);
        this.colliders.push({ cx, cz, radius });
      }
    }
  }

  private addRock(x: number, z: number, scale: number): number {
    // Irregular rock shape using several overlapping spheres
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x7a7060,
      roughness: 0.95,
      metalness: 0.05,
    });
    const darkRockMat = new THREE.MeshStandardMaterial({
      color: 0x4a4438,
      roughness: 1,
      metalness: 0,
    });

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const sizes = [0.55, 0.42, 0.38, 0.3];
    const offsets: [number, number, number][] = [
      [0, 0.35, 0],
      [0.3, 0.2, 0.15],
      [-0.25, 0.18, -0.1],
      [0.1, 0.1, -0.3],
    ];
    const mats = [rockMat, darkRockMat, rockMat, darkRockMat];

    for (let i = 0; i < sizes.length; i++) {
      const geo = new THREE.SphereGeometry(sizes[i] * scale, 7, 5);
      const mesh = new THREE.Mesh(geo, mats[i]);
      mesh.position.set(offsets[i][0] * scale, offsets[i][1] * scale, offsets[i][2] * scale);
      // Squash a bit
      mesh.scale.y = 0.7;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Slight random tilt for naturalness
    group.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(group);

    return 0.65 * scale; // collision radius
  }

  private addTree(x: number, z: number, scale: number): number {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a1e,
      roughness: 0.95,
      metalness: 0,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2d7a3a,
      emissive: 0x0a2010,
      emissiveIntensity: 0.3,
      roughness: 0.9,
      metalness: 0,
    });
    const leafMat2 = new THREE.MeshStandardMaterial({
      color: 0x1e5c2a,
      emissive: 0x051008,
      emissiveIntensity: 0.3,
      roughness: 0.9,
      metalness: 0,
    });

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15 * scale, 0.22 * scale, 1.8 * scale, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.9 * scale;
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage — layered cones
    const layers = [
      { r: 0.9, h: 1.2, y: 2.0 },
      { r: 0.7, h: 1.0, y: 2.9 },
      { r: 0.5, h: 0.8, y: 3.6 },
    ];
    layers.forEach((l, i) => {
      const coneGeo = new THREE.ConeGeometry(l.r * scale, l.h * scale, 8);
      const cone = new THREE.Mesh(coneGeo, i % 2 === 0 ? leafMat : leafMat2);
      cone.position.y = l.y * scale;
      cone.castShadow = true;
      group.add(cone);
    });

    this.group.add(group);
    return 0.35 * scale; // collision radius — just the trunk
  }

  private addStump(x: number, z: number, scale: number): number {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.95,
      metalness: 0,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x8b5e3c,
      roughness: 1,
      metalness: 0,
    });
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x3a6b3a,
      emissive: 0x0a1a0a,
      emissiveIntensity: 0.4,
      roughness: 1,
      metalness: 0,
    });

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const stumpGeo = new THREE.CylinderGeometry(0.28 * scale, 0.35 * scale, 0.55 * scale, 8);
    const stump = new THREE.Mesh(stumpGeo, trunkMat);
    stump.position.y = 0.275 * scale;
    stump.castShadow = true;
    group.add(stump);

    // Top ring
    const topGeo = new THREE.CylinderGeometry(0.26 * scale, 0.26 * scale, 0.05 * scale, 8);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.575 * scale;
    group.add(top);

    // Moss blob on top
    const mossGeo = new THREE.SphereGeometry(0.2 * scale, 6, 4);
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(0.05 * scale, 0.65 * scale, 0.05 * scale);
    moss.scale.set(1.1, 0.5, 1.0);
    group.add(moss);

    this.group.add(group);
    return 0.3 * scale;
  }

  /**
   * Check if a movement from curPos toward nextPos is blocked by any prop collider.
   * Returns the adjusted position that slides along the obstacle.
   */
  resolveCollision(pos: THREE.Vector3, radius: number): void {
    for (const col of this.colliders) {
      const dx = pos.x - col.cx;
      const dz = pos.z - col.cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = col.radius + radius;
      if (dist < minDist && dist > 0.001) {
        // Push out
        const push = (minDist - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
        else m.material?.dispose();
      }
    });
  }
}
