import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Arena } from '../arena/Arena';
import { PlayerHealth } from './PlayerHealth';
import { PlayerAnimationController, ClipMap } from './PlayerAnimationController';
import { PlayerController } from './PlayerController';

const ANIM_FILES: Record<string, string> = {
  idle:     '/movements/Breathing Idle.fbx',
  walk:     '/movements/Walking.fbx',
  run:      '/movements/Standard Run.fbx',
  sprint:   '/movements/Running.fbx',
  jump:     '/movements/Jumping.fbx',
  jumpDown: '/movements/Jumping Down.fbx',
};

// ─── Fallback humanoid built from Three.js primitives ────────────────────────
function buildFallbackHumanoid(): THREE.Group {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xff7518,
    roughness: 0.55,
    metalness: 0.1,
    emissive: 0xff4400,
    emissiveIntensity: 0.12,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x662200,
    roughness: 0.7,
    metalness: 0.15,
  });

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Torso
  add(new THREE.BoxGeometry(0.46, 0.56, 0.22), mat, 0, 1.12, 0);
  // Head
  add(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat, 0, 1.65, 0);
  // Left arm
  add(new THREE.BoxGeometry(0.14, 0.48, 0.14), mat, -0.33, 1.04, 0);
  // Right arm
  add(new THREE.BoxGeometry(0.14, 0.48, 0.14), mat, 0.33, 1.04, 0);
  // Left leg
  add(new THREE.BoxGeometry(0.16, 0.54, 0.16), darkMat, -0.13, 0.52, 0);
  // Right leg
  add(new THREE.BoxGeometry(0.16, 0.54, 0.16), darkMat, 0.13, 0.52, 0);
  // Visor / eye strip
  add(new THREE.BoxGeometry(0.22, 0.06, 0.05), new THREE.MeshStandardMaterial({
    color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 1.5,
  }), 0, 1.68, 0.155);

  return group;
}

export class Player {
  readonly health: PlayerHealth;
  /** The root group added to the scene — always available immediately. */
  mesh: THREE.Group;
  controller!: PlayerController;
  animCtrl!: PlayerAnimationController;

  private _ready = false;
  /** true when using the procedural fallback instead of the FBX model */
  private usingFallback = true;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly arena: Arena,
    private readonly camera: THREE.Camera,
  ) {
    this.health = new PlayerHealth();

    // ── Create the fallback character immediately so the hero is ALWAYS visible ──
    this.mesh = buildFallbackHumanoid();
    // Position: feet at y=0, so root at y=0 (the group's children are already offset above 0)
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    // Wire up controllers immediately with the fallback mesh so the game is playable
    // at once (no animation controller yet — that comes after FBX load)
    this.controller = new PlayerController(this.mesh, this.arena, this.camera);
    this._ready = true;
  }

  async load(): Promise<void> {
    const loader = new FBXLoader();
    const clips: Record<string, THREE.AnimationClip> = {};

    let baseGroup: THREE.Group | null = null;

    // ── Step 1: Load base model (Breathing Idle.fbx has mesh + skeleton + clip) ──
    try {
      baseGroup = await loader.loadAsync(ANIM_FILES.idle) as unknown as THREE.Group;
    } catch (err) {
      console.error('[Player] Failed to load base FBX (Breathing Idle.fbx):', err);
    }

    if (baseGroup) {
      // Validate it has actual skinned mesh children
      let hasMesh = false;
      baseGroup.traverse(child => {
        if ((child as THREE.SkinnedMesh).isSkinnedMesh || (child as THREE.Mesh).isMesh) hasMesh = true;
      });

      if (hasMesh) {
        // Mixamo FBX: root object is huge (100 units = 1 real metre) — scale to 0.01
        baseGroup.scale.setScalar(0.01);
        baseGroup.traverse(child => {
          child.castShadow = true;
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).receiveShadow = true;
            // Make sure materials are visible
            const m = (child as THREE.Mesh).material;
            const materials = Array.isArray(m) ? m : [m];
            materials.forEach(mat => {
              if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
                const std = mat as THREE.MeshStandardMaterial;
                if (std.color.getHex() === 0x000000) std.color.setHex(0xddccaa);
                std.roughness = Math.min(std.roughness + 0.1, 1);
              }
            });
          }
        });

        // Grab idle clip
        if (baseGroup.animations.length > 0) {
          clips['idle'] = baseGroup.animations[0];
          clips['idle'].name = 'idle';
        }

        // ── Replace fallback with real FBX mesh ──────────────────────────
        this.scene.remove(this.mesh);

        // Reposition: Mixamo root origin is at feet, so y=0 is correct
        baseGroup.position.set(0, 0, 0);
        this.mesh = baseGroup;
        this.scene.add(this.mesh);
        this.usingFallback = false;

        // Rewire controller to the new mesh
        this.controller = new PlayerController(this.mesh, this.arena, this.camera);

        console.info('[Player] FBX model loaded successfully');
      } else {
        console.warn('[Player] Breathing Idle.fbx has no mesh — keeping fallback character');
      }
    }

    // ── Step 2: Load remaining animation clips ───────────────────────────
    for (const [key, path] of Object.entries(ANIM_FILES)) {
      if (key === 'idle' && clips['idle']) continue;
      try {
        const fbx = await loader.loadAsync(path) as unknown as THREE.Group;
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0];
          clip.name = key;
          clips[key] = clip;
        } else {
          console.warn(`[Player] No animation clip in ${path}`);
        }
      } catch (err) {
        console.error(`[Player] Failed to load ${path}:`, err);
      }
    }

    // ── Step 3: Build animation controller if we have clips and a valid skeleton ──
    if (!this.usingFallback && Object.keys(clips).length >= 1) {
      const required = ['idle', 'walk', 'run', 'sprint', 'jump', 'jumpDown'] as const;
      for (const key of required) {
        if (!clips[key]) console.error(`[Player] MISSING animation clip: ${key}`);
      }

      try {
        this.animCtrl = new PlayerAnimationController(
          this.mesh,
          clips as unknown as ClipMap,
        );
        // Inject into controller
        this.controller.setAnimController(this.animCtrl);
        this.controller.setMesh(this.mesh);
        console.info('[Player] AnimationController ready. Clips:', Object.keys(clips));

        // ── Attempt to load optional backflip (wall-jump) animation ──────
        this.loadBackflip(loader);
      } catch (err) {
        console.error('[Player] AnimationController init failed:', err);
      }
    } else if (this.usingFallback) {
      console.warn('[Player] Using fallback character — FBX animations skipped');
    }
  }

  /**
   * Attempt to load the backflip animation clip from the movements folder.
   * Tries several common Mixamo filenames. Registers the first one found.
   * Does NOT throw — wall-jump physics work regardless.
   */
  private async loadBackflip(loader: import('three/examples/jsm/loaders/FBXLoader.js').FBXLoader): Promise<void> {
    const candidates = [
      '/movements/Backflip.fbx',
      '/movements/Back Flip.fbx',
      '/movements/Standing Back Flip.fbx',
    ];
    for (const path of candidates) {
      try {
        const fbx = await loader.loadAsync(path) as unknown as { animations: THREE.AnimationClip[] };
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0];
          this.animCtrl.registerWallJumpClip(clip);
          console.info(`[Player] Backflip loaded from: ${path}`);
          return;
        }
      } catch {
        // Not found at this path — try next
      }
    }
    console.warn('[Player] Backflip FBX not found in movements/. Wall-jump physics still active. Add Backflip.fbx to public/movements/ to enable the animation.');
  }

  update(dt: number): void {
    if (!this._ready) return;
    this.controller.update(dt);
    this.animCtrl?.update(dt);
  }

  get position(): THREE.Vector3 { return this.mesh.position; }
  get ready(): boolean { return this._ready; }
  get isUsingFallback(): boolean { return this.usingFallback; }
}
