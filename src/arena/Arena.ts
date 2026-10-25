import * as THREE from 'three';
import { ARENA } from '../game/GameConfig';

/** Returns the AABB inner bounds the player/enemies must stay within. */
export function getArenaBounds() {
  const r = ARENA.halfSize - ARENA.wallThickness;
  return { minX: -r, maxX: r, minZ: -r, maxZ: r };
}

export class Arena {
  readonly group: THREE.Group;
  private floorMesh!: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.build();
    scene.add(this.group);
  }

  private build(): void {
    const { halfSize, wallHeight, wallThickness } = ARENA;
    const size = halfSize * 2;

    const wallMat = new THREE.MeshStandardMaterial({
      map: this.buildWallTexture(),
      roughness: 0.75,
      metalness: 0.15,
    });

    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d1a,
      roughness: 1,
    });

    // ── Floor ──────────────────────────────────────────────────────────────
    const floorGeo = new THREE.BoxGeometry(size, wallThickness, size);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.buildFloorTexture(size),
      roughness: 0.82,
      metalness: 0.05,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.receiveShadow = true;
    this.floorMesh.position.y = -wallThickness / 2;
    this.group.add(this.floorMesh);

    // ── Ceiling ────────────────────────────────────────────────────────────
    const ceilGeo = new THREE.BoxGeometry(size, wallThickness, size);
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.position.y = wallHeight + wallThickness / 2;
    this.group.add(ceil);

    // ── Four walls ─────────────────────────────────────────────────────────
    const wallDefs: [number, number, number, number][] = [
      // x, y, z, rotY
      [0, wallHeight / 2, -halfSize, 0],           // back
      [0, wallHeight / 2,  halfSize, Math.PI],      // front
      [-halfSize, wallHeight / 2, 0, Math.PI / 2],  // left
      [ halfSize, wallHeight / 2, 0, -Math.PI / 2], // right
    ];

    wallDefs.forEach(([x, y, z, rotY]) => {
      const wallGeo = new THREE.BoxGeometry(size + wallThickness * 2, wallHeight, wallThickness);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, y, z);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      wall.castShadow = false;
      this.group.add(wall);
    });

    // ── Edge glow strips ──────────────────────────────────────────────────
    this.addGlowStrips(halfSize, wallHeight);

    // ── Grid overlay on floor — green tones ──────────────────────────────
    const grid = new THREE.GridHelper(size, 24, 0x1a6b30, 0x0e4020);
    grid.position.y = 0.01;
    this.group.add(grid);

    // ── Lighting ──────────────────────────────────────────────────────────
    this.addLighting();
  }

  private addGlowStrips(halfSize: number, wallHeight: number): void {
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 1.5,
    });
    const stripHeight = 0.08;
    const size = halfSize * 2;

    const positions: [number, number, number, number][] = [
      [0, 0.05,  halfSize - 0.01, 0],
      [0, 0.05, -halfSize + 0.01, 0],
      [ halfSize - 0.01, 0.05, 0, Math.PI / 2],
      [-halfSize + 0.01, 0.05, 0, Math.PI / 2],
    ];

    positions.forEach(([x, y, z, rotY]) => {
      const geo = new THREE.BoxGeometry(size, stripHeight, 0.05);
      const mesh = new THREE.Mesh(geo, stripMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      this.group.add(mesh);
    });

    // Vertical corner pillars
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
      const pillarGeo = new THREE.BoxGeometry(0.15, wallHeight, 0.15);
      const pillar = new THREE.Mesh(pillarGeo, stripMat);
      pillar.position.set(sx * (halfSize - 0.1), wallHeight / 2, sz * (halfSize - 0.1));
      this.group.add(pillar);
    });
  }

  private addLighting(): void {
    // Ambient
    const ambient = new THREE.AmbientLight(0x2a4a2a, 1.4);
    this.group.add(ambient);

    // Main overhead directional
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0, 15, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = 80;
    dir.shadow.camera.left = -30;
    dir.shadow.camera.right = 30;
    dir.shadow.camera.top = 30;
    dir.shadow.camera.bottom = -30;
    this.group.add(dir);

    // Coloured point lights at corners for sci-fi feel
    const colors = [0x0080ff, 0xff4040, 0x00ff80, 0xff8000];
    const half = ARENA.halfSize * 0.7;
    [[-half, -half], [-half, half], [half, -half], [half, half]].forEach(([x, z], i) => {
      const pt = new THREE.PointLight(colors[i], 1.5, 25);
      pt.position.set(x, 4, z);
      this.group.add(pt);
    });
  }

  /** Clamp a world position so it stays inside the arena. */
  clampPosition(pos: THREE.Vector3, radius = 0.5): void {
    const limit = ARENA.halfSize - ARENA.wallThickness - radius;
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));
  }

  /**
   * Build a CanvasTexture with a radial green gradient.
   * Centre: vivid green (#39E75F) — Perimeter: deep green (#087F23)
   * Light grid lines baked in for spatial readability.
   */
  private buildFloorTexture(_arenaSize: number): THREE.CanvasTexture {
    const RES = 512;
    const canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    const ctx = canvas.getContext('2d')!;

    // Radial gradient: bright centre → dark edge
    const cx = RES / 2;
    const cy = RES / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, RES * 0.68);
    grad.addColorStop(0.00, '#A7FF83');  // highlight centre
    grad.addColorStop(0.18, '#39E75F');  // vivid green mid-centre
    grad.addColorStop(0.55, '#1AAD45');  // mid tone
    grad.addColorStop(0.82, '#0C7A2A');  // darkening toward edge
    grad.addColorStop(1.00, '#087F23');  // deep green at perimeter
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, RES, RES);

    // Subtle darker grid lines baked into the texture
    ctx.strokeStyle = 'rgba(4,50,15,0.35)';
    ctx.lineWidth = 1;
    const cells = 16;
    const step = RES / cells;
    for (let i = 0; i <= cells; i++) {
      const p = i * step;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, RES); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(RES, p); ctx.stroke();
    }

    // Soft vignette ring at the very edge
    const edge = ctx.createRadialGradient(cx, cy, RES * 0.6, cx, cy, RES * 0.72);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, RES, RES);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  /**
   * Build a CanvasTexture with a vertical grey gradient for the arena walls.
   * Bottom: dark grey (#30343B) → mid: medium grey (#686F78) → top: light (#B8BEC6)
   */
  private buildWallTexture(): THREE.CanvasTexture {
    const W = 256;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Vertical gradient: dark at the bottom, light at the top
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0.00, '#30343B');
    grad.addColorStop(0.45, '#686F78');
    grad.addColorStop(0.80, '#9AA0A8');
    grad.addColorStop(1.00, '#B8BEC6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle horizontal panel lines
    ctx.strokeStyle = 'rgba(30,34,40,0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const y = Math.round((i / 8) * H);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Faint vertical centre highlight
    const hl = ctx.createLinearGradient(0, 0, W, 0);
    hl.addColorStop(0.0,  'rgba(255,255,255,0)');
    hl.addColorStop(0.45, 'rgba(255,255,255,0.055)');
    hl.addColorStop(0.55, 'rgba(255,255,255,0.055)');
    hl.addColorStop(1.0,  'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, W, H);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
}
