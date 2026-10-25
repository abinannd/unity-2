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

    // ── Ceiling removed — open-top arena ─────────────────────────────────

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

    // ── Grid overlay on floor — earthy root-line tones ────────────────────
    const grid = new THREE.GridHelper(size, 24, 0x1a0e06, 0x120a04);
    grid.position.y = 0.01;
    this.group.add(grid);

    // ── Lighting ──────────────────────────────────────────────────────────
    this.addLighting();
  }

  private addGlowStrips(halfSize: number, wallHeight: number): void {
    // Mossy/vine glow strips — warm amber torchlight colour
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffaa22,
      emissive: 0xff8800,
      emissiveIntensity: 1.2,
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
    // HemisphereLight — simulates open sky over a forest, main source of brightness
    const hemi = new THREE.HemisphereLight(
      0xc8d8ff,   // sky colour — bright daylight blue-white
      0x4a3820,   // ground colour — warm earth bounce
      2.2,        // intensity — strong open-sky illumination
    );
    this.group.add(hemi);

    // Ambient fill so no face is completely black
    const ambient = new THREE.AmbientLight(0xfff5e0, 1.0);
    this.group.add(ambient);

    // Main overhead sun — warm golden daylight
    const dir = new THREE.DirectionalLight(0xfff0cc, 2.0);
    dir.position.set(8, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = 100;
    dir.shadow.camera.left = -35;
    dir.shadow.camera.right = 35;
    dir.shadow.camera.top = 35;
    dir.shadow.camera.bottom = -35;
    dir.shadow.bias = -0.001;
    this.group.add(dir);

    // Opposite sky fill — keeps shadows soft and readable
    const fill = new THREE.DirectionalLight(0xb0d0ff, 0.9);
    fill.position.set(-10, 12, -8);
    this.group.add(fill);

    // Rim light from behind for depth
    const rim = new THREE.DirectionalLight(0xffd080, 0.5);
    rim.position.set(0, 6, -20);
    this.group.add(rim);

    // Warm corner torches — accent, not primary illumination
    const cornerColors = [0xff6b20, 0xff8c40, 0xff6b20, 0xff8c40];
    const half = ARENA.halfSize * 0.75;
    [[-half, -half], [-half, half], [half, -half], [half, half]].forEach(([x, z], i) => {
      const pt = new THREE.PointLight(cornerColors[i], 1.8, 20);
      pt.position.set(x, 2.5, z);
      this.group.add(pt);

      // Torch emissive mesh
      const torchMat = new THREE.MeshStandardMaterial({
        color: 0xff8c20,
        emissive: 0xff6010,
        emissiveIntensity: 2.5,
      });
      const torchGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
      const torch = new THREE.Mesh(torchGeo, torchMat);
      torch.position.set(x * 0.93, 2.8, z * 0.93);
      this.group.add(torch);
    });
  }

  /** Clamp a world position so it stays inside the arena. */
  clampPosition(pos: THREE.Vector3, radius = 0.5): void {
    const limit = ARENA.halfSize - ARENA.wallThickness - radius;
    pos.x = Math.max(-limit, Math.min(limit, pos.x));
    pos.z = Math.max(-limit, Math.min(limit, pos.z));
  }

  /**
   * Build a CanvasTexture with a rich forest floor appearance:
   * dark loamy soil with moss patches, subtle dirt trails, and root-texture details.
   */
  private buildFloorTexture(_arenaSize: number): THREE.CanvasTexture {
    const RES = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    const ctx = canvas.getContext('2d')!;

    // Base — warm earthy soil (brighter for open-sky lighting)
    ctx.fillStyle = '#4a3520';
    ctx.fillRect(0, 0, RES, RES);

    // Radial worn ground patch at center
    const cx = RES / 2, cy = RES / 2;
    const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, RES * 0.55);
    base.addColorStop(0.00, '#7a5e3a');  // bright worn dirt centre
    base.addColorStop(0.30, '#5e4520');  // mid soil
    base.addColorStop(0.65, '#3e2e12');  // darker soil
    base.addColorStop(1.00, '#2a1e0c');  // shadow at edges
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, RES, RES);

    // Moss patches — scattered organic blobs
    const mossPalette = ['#2d5c1e', '#3a7a28', '#1e4a14', '#2a6620', '#4a8c30'];
    for (let i = 0; i < 60; i++) {
      const mx = Math.random() * RES;
      const mz = Math.random() * RES;
      const mr = 15 + Math.random() * 50;
      const mc = mossPalette[Math.floor(Math.random() * mossPalette.length)];
      const mg = ctx.createRadialGradient(mx, mz, 0, mx, mz, mr);
      mg.addColorStop(0, mc + 'cc');
      mg.addColorStop(0.6, mc + '66');
      mg.addColorStop(1, mc + '00');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(mx, mz, mr, mr * (0.5 + Math.random() * 0.8), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Root/crack lines
    ctx.strokeStyle = 'rgba(12,8,4,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) {
      const sx = Math.random() * RES;
      const sy = Math.random() * RES;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      let curX = sx, curY = sy;
      for (let seg = 0; seg < 6; seg++) {
        curX += (Math.random() - 0.5) * 60;
        curY += (Math.random() - 0.5) * 60;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
    }

    // Subtle scattered pebbles (tiny circles)
    for (let i = 0; i < 80; i++) {
      const px = Math.random() * RES;
      const py = Math.random() * RES;
      const pr = 2 + Math.random() * 5;
      ctx.fillStyle = `rgba(${100 + Math.random()*60 | 0},${90 + Math.random()*50 | 0},${70 + Math.random()*40 | 0},0.6)`;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Edge vignette — dark forest shadow
    const edge = ctx.createRadialGradient(cx, cy, RES * 0.45, cx, cy, RES * 0.72);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, RES, RES);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  /**
   * Build a CanvasTexture for arena walls — mossy stone look.
   * Dark stone base with green moss streaks, horizontal mortar lines.
   */
  private buildWallTexture(): THREE.CanvasTexture {
    const W = 256;
    const H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Base stone gradient
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0.00, '#2a2218');
    grad.addColorStop(0.40, '#3e3226');
    grad.addColorStop(0.80, '#4a3c2c');
    grad.addColorStop(1.00, '#38302a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stone block pattern
    ctx.strokeStyle = 'rgba(15,12,8,0.6)';
    ctx.lineWidth = 2;
    const blockH = 40;
    for (let row = 0; row < H / blockH; row++) {
      const y = row * blockH;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      // Offset vertical lines per row
      const offset = (row % 2) * (W / 3);
      for (let col = 0; col < 3; col++) {
        const vx = ((col * W / 2) + offset) % W;
        ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx, y + blockH); ctx.stroke();
      }
    }

    // Moss streaks
    const mossPalette = ['rgba(30,70,20,0.3)', 'rgba(40,90,25,0.2)', 'rgba(20,55,15,0.25)'];
    for (let i = 0; i < 15; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H * 0.5 + H * 0.3; // mostly lower half
      const mg = ctx.createLinearGradient(sx, sy, sx + (Math.random() - 0.5) * 40, sy + 60 + Math.random() * 80);
      mg.addColorStop(0, 'transparent');
      mg.addColorStop(0.3, mossPalette[i % mossPalette.length]);
      mg.addColorStop(1, 'transparent');
      ctx.fillStyle = mg;
      ctx.fillRect(sx - 8, sy, 16 + Math.random() * 20, 80 + Math.random() * 60);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
}
