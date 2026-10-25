import * as THREE from 'three';
import { PLAYER } from '../game/GameConfig';

export type AnimState = 'idle' | 'walk' | 'run' | 'sprint' | 'jump' | 'jumpDown' | 'wallJump' | 'slide';

export interface ClipMap {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  sprint: THREE.AnimationClip;
  jump: THREE.AnimationClip;
  jumpDown: THREE.AnimationClip;
  slide?: THREE.AnimationClip;
}

export class PlayerAnimationController {
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<AnimState, THREE.AnimationAction>> = {};
  private currentState: AnimState = 'idle';
  private currentAction: THREE.AnimationAction | null = null;

  constructor(root: THREE.Object3D, clips: ClipMap) {
    this.mixer = new THREE.AnimationMixer(root);

    for (const [key, clip] of Object.entries(clips) as [AnimState, THREE.AnimationClip][]) {
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      // Jump/landing/walljump/slide animations should NOT loop
      if (key === 'jump' || key === 'jumpDown' || key === 'wallJump' || key === 'slide') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[key] = action;
    }

    // Start with idle
    this.play('idle', 0);
  }

  /**
   * Register an optional wall-jump clip after construction
   * (loaded separately since it's not in the core ClipMap).
   */
  registerWallJumpClip(clip: THREE.AnimationClip): void {
    clip.name = 'wallJump';
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    this.actions['wallJump'] = action;
    console.info('[AnimController] Wall-jump (backflip) clip registered.');
  }

  /**
   * Register or override slide clip after construction.
   */
  registerSlideClip(clip: THREE.AnimationClip): void {
    clip.name = 'slide';
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    this.actions['slide'] = action;
    console.info('[AnimController] Slide clip registered.');
  }

  play(state: AnimState, fadeTime = 0.2): void {
    if (state === this.currentState) return;

    const next = this.actions[state];
    if (!next) {
      // wallJump and slide missing is expected when FBX not found — degrade silently
      if (state !== 'wallJump' && state !== 'slide') {
        console.warn(`[AnimController] No clip for state: ${state}`);
      }
      return;
    }

    if (this.currentAction && this.currentAction !== next) {
      this.currentAction.fadeOut(fadeTime);
    }

    next.reset().fadeIn(fadeTime).play();
    this.currentAction = next;
    this.currentState = state;
  }

  /** True if the wall-jump clip is registered and currently playing. */
  isPlayingWallJump(): boolean {
    return this.currentState === 'wallJump';
  }

  /** True if wall-jump clip was registered. */
  hasWallJump(): boolean {
    return this.actions['wallJump'] != null;
  }

  /** True if the slide clip is currently playing. */
  isPlayingSlide(): boolean {
    return this.currentState === 'slide';
  }

  /** True if slide clip was registered. */
  hasSlide(): boolean {
    return this.actions['slide'] != null;
  }

  getSlideDuration(): number {
    const act = this.actions['slide'];
    if (act) return act.getClip().duration;
    return 0.75;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  getState(): AnimState { return this.currentState; }

  /**
   * Resolve which ground state to play based on speed and burst flag.
   * Does NOT handle jump or slide — the caller is responsible.
   */
  resolveGroundState(speed: number, isBurst: boolean): AnimState {
    if (isBurst) return 'sprint';
    if (speed > PLAYER.walkSpeed + 0.5) return 'run';
    if (speed > 0.2) return 'walk';
    return 'idle';
  }
}
