import * as THREE from 'three';
import { PLAYER, WALL_JUMP, ARENA, CLIMB, SLIDE } from '../game/GameConfig';
import { Arena } from '../arena/Arena';
import { PlayerAnimationController, AnimState } from './PlayerAnimationController';
import type { Block } from '../obstacles/Block';
import type { GroundSlam } from '../combat/GroundSlam';
import type { GrappleSystem } from '../combat/GrappleSystem';

interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

type ClimbState = 'none' | 'rising' | 'vaulting';

export class PlayerController {
  // Public velocity for external queries (e.g. projectile aim)
  readonly velocity = new THREE.Vector3();

  private input: InputState = { forward: false, backward: false, left: false, right: false, jump: false };

  // Jump & gravity
  private isGrounded = true;
  private verticalVelocity = 0;
  private readonly groundY = 0;

  // Platform state
  private onPlatform = false;
  private platformBlock: Block | null = null;
  private platformDelayTimer = 0;
  private platformRegenerating = false;

  // Double-shift burst
  private lastShiftTime = 0;
  private burstActive = false;
  private burstTimer = 0;
  private burstCooldownTimer = 0;

  // Wall-jump
  private wallJumpCooldown = 0;
  private wallJumping = false;
  private wallJumpTimer = 0;

  // Climb state
  private climbState: ClimbState = 'none';
  private climbBlock: Block | null = null;
  private climbTargetTopY = 0;

  // Facing
  private facingAngle = 0;

  // Slide state
  private isSliding = false;
  private slideTimer = 0;
  private slideDuration = SLIDE.duration;
  private slideCooldownTimer = 0;
  private readonly _slideDir = new THREE.Vector3();

  // Injected systems (optional)
  private animCtrl: PlayerAnimationController | null = null;
  private groundSlam: GroundSlam | null = null;
  private grapple: GrappleSystem | null = null;

  // Blocks list updated each frame from Game.ts
  private currentBlocks: Block[] = [];

  private readonly _moveDir = new THREE.Vector3();
  private readonly _camForward = new THREE.Vector3();
  private readonly _camRight = new THREE.Vector3();

  constructor(
    private mesh: THREE.Object3D,
    private readonly arena: Arena,
    private readonly camera: THREE.Camera,
  ) {
    this.mesh.position.y = this.groundY;
    this.setupInput();
  }

  setAnimController(ctrl: PlayerAnimationController): void { this.animCtrl = ctrl; }
  setGroundSlam(gs: GroundSlam): void { this.groundSlam = gs; }
  setGrapple(gr: GrappleSystem): void { this.grapple = gr; }

  setMesh(mesh: THREE.Object3D): void {
    this.mesh = mesh;
    this.mesh.position.y = this.groundY;
  }

  // ── Platform integration ─────────────────────────────────────────────────

  updatePlatforms(blocks: Block[], dt: number): void {
    this.currentBlocks = blocks;
    let foundPlatform = false;

    for (const block of blocks) {
      if (block.isDead) continue;

      const top = block.topY;
      const half = block.halfExtents;
      const bPos = block.position;

      const px = this.mesh.position.x;
      const pz = this.mesh.position.z;

      const margin = 0.05;
      const overlapX = Math.abs(px - bPos.x) < half.x + PLAYER.colliderRadius - margin;
      const overlapZ = Math.abs(pz - bPos.z) < half.z + PLAYER.colliderRadius - margin;

      if (!overlapX || !overlapZ) continue;

      const playerFeetY = this.mesh.position.y;
      const playerPrevFeetY = playerFeetY - this.verticalVelocity * dt;

      // Landing on top
      const landingThreshold = 0.25;
      if (
        this.verticalVelocity <= 0 &&
        playerFeetY <= top + landingThreshold &&
        playerPrevFeetY >= top - landingThreshold
      ) {
        const prevSlam = this.groundSlam?.isSlamming ?? false;
        this.mesh.position.y = top;
        this.verticalVelocity = 0;
        this.isGrounded = true;
        this.wallJumping = false;

        if (prevSlam) {
          this.groundSlam!.onLanded(new THREE.Vector3(px, top, pz));
        }

        const delta = block.movementDelta;
        this.mesh.position.x += delta.x;
        this.mesh.position.z += delta.z;

        foundPlatform = true;
        if (this.platformBlock !== block) {
          this.platformBlock = block;
          this.platformDelayTimer = 0.5;
          this.platformRegenerating = false;
        }
        break;
      }

      // Side collision — push out
      if (playerFeetY < top && playerFeetY > bPos.y - half.y) {
        const dx = px - bPos.x;
        const dz = pz - bPos.z;
        const overlapXAmt = half.x + PLAYER.colliderRadius - Math.abs(dx);
        const overlapZAmt = half.z + PLAYER.colliderRadius - Math.abs(dz);
        if (overlapXAmt > 0 && overlapZAmt > 0) {
          if (overlapXAmt < overlapZAmt) {
            this.mesh.position.x += Math.sign(dx) * overlapXAmt;
          } else {
            this.mesh.position.z += Math.sign(dz) * overlapZAmt;
          }
        }
      }
    }

    if (!foundPlatform) {
      if (this.platformBlock) {
        this.platformBlock = null;
        this.platformRegenerating = false;
        this.platformDelayTimer = 0;
      }
      this.onPlatform = false;
    } else {
      this.onPlatform = true;
    }
  }

  tickPlatformRegen(dt: number, currentHp: number, maxHp: number): number {
    // No regen while climbing
    if (this.climbState !== 'none') return 0;
    if (!this.onPlatform || !this.isGrounded) {
      this.platformRegenerating = false;
      return 0;
    }
    if (!this.platformRegenerating) {
      this.platformDelayTimer -= dt;
      if (this.platformDelayTimer <= 0) this.platformRegenerating = true;
      return 0;
    }
    if (currentHp >= maxHp) return 0;
    return 5 * dt;
  }

  get isOnPlatform(): boolean { return this.onPlatform; }
  get isRegenerating(): boolean { return this.platformRegenerating && this.onPlatform; }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyW': this.input.forward = true; break;
      case 'KeyS': this.input.backward = true; break;
      case 'KeyA': this.input.left = true; break;
      case 'KeyD': this.input.right = true; break;
      case 'Space':
        e.preventDefault();
        if (this.isGrounded) {
          this.input.jump = true;
          this.onPlatform = false;
          this.platformBlock = null;
          this.platformRegenerating = false;
        } else {
          this.input.jump = true;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.handleShift();
        break;
      case 'KeyC':
        this.tryTriggerSlide();
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW': this.input.forward = false; break;
      case 'KeyS': this.input.backward = false; break;
      case 'KeyA': this.input.left = false; break;
      case 'KeyD': this.input.right = false; break;
      case 'Space': this.input.jump = false; break;
    }
  }

  private handleShift(): void {
    const now = performance.now();
    const elapsed = now - this.lastShiftTime;
    if (elapsed < PLAYER.burstWindowMs && elapsed > 30 && this.burstCooldownTimer <= 0) {
      this.burstActive = true;
      this.burstTimer = PLAYER.burstDuration;
      this.burstCooldownTimer = PLAYER.burstCooldown;
    }
    this.lastShiftTime = now;
  }

  // ── Running slide ─────────────────────────────────────────────────────────

  private tryTriggerSlide(): void {
    if (this.isSliding || this.slideCooldownTimer > 0) return;
    if (!this.isGrounded || this.wallJumping) return;
    if (this.climbState !== 'none') return;
    if (this.grapple?.isGrappling || this.groundSlam?.isSlamming) return;

    // Trigger only when grounded and moving
    const hasInput = this.input.forward || this.input.backward || this.input.left || this.input.right;
    const horizSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (!hasInput && horizSpeed < 0.5) return;

    this.isSliding = true;
    this.slideDuration = this.animCtrl?.hasSlide() ? this.animCtrl.getSlideDuration() : SLIDE.duration;
    this.slideTimer = this.slideDuration;

    // Lock slide direction to current movement or facing direction
    if (this._moveDir.lengthSq() > 0.001) {
      this._slideDir.copy(this._moveDir).normalize();
    } else {
      this._slideDir.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle)).normalize();
    }

    const angle = Math.atan2(this._slideDir.x, this._slideDir.z);
    this.facingAngle = angle;
    this.mesh.rotation.y = angle;

    this.animCtrl?.play('slide', 0.1);
  }

  cancelSlide(): void {
    if (this.isSliding) {
      this.isSliding = false;
      this.slideTimer = 0;
      this.slideCooldownTimer = SLIDE.cooldown;
      if (!this.animCtrl || !this.animCtrl.hasSlide()) {
        this.mesh.rotation.x = 0;
      }
    }
  }

  // ── Wall-jump helpers ─────────────────────────────────────────────────────

  private detectWallContact(): THREE.Vector3 | null {
    const limit = ARENA.halfSize - ARENA.wallThickness;
    const tol = WALL_JUMP.wallTolerance;
    const pos = this.mesh.position;
    if (pos.z >= limit - tol) return new THREE.Vector3(0, 0, -1);
    if (pos.z <= -limit + tol) return new THREE.Vector3(0, 0,  1);
    if (pos.x >= limit - tol) return new THREE.Vector3(-1, 0,  0);
    if (pos.x <= -limit + tol) return new THREE.Vector3( 1, 0,  0);
    return null;
  }

  private tryWallJump(): void {
    if (this.isGrounded || this.wallJumpCooldown > 0 || this.wallJumping) return;
    const pushDir = this.detectWallContact();
    if (!pushDir) return;

    this.verticalVelocity = WALL_JUMP.upVelocity;
    this.velocity.x = pushDir.x * WALL_JUMP.pushSpeed;
    this.velocity.z = pushDir.z * WALL_JUMP.pushSpeed;
    this.wallJumping = true;
    this.wallJumpTimer = 0.35;
    this.wallJumpCooldown = WALL_JUMP.cooldown;

    const angle = Math.atan2(pushDir.x, pushDir.z);
    this.facingAngle = angle;
    this.mesh.rotation.y = angle;

    this.animCtrl?.play('wallJump', 0.1);
  }

  // ── Climbing helpers ──────────────────────────────────────────────────────

  private tryInitiateClimb(): boolean {
    if (this.climbState !== 'none') return false;
    if (!this.input.forward) return false;

    // Build forward vector from current camera
    this.camera.getWorldDirection(this._camForward);
    this._camForward.y = 0;
    this._camForward.normalize();

    const pos = this.mesh.position;
    const probeX = pos.x + this._camForward.x * CLIMB.detectionDepth;
    const probeZ = pos.z + this._camForward.z * CLIMB.detectionDepth;
    const feetY = pos.y;

    for (const block of this.currentBlocks) {
      if (block.isDead) continue;
      const bPos = block.position;
      const half = block.halfExtents;
      const top = block.topY;

      // Is probe point inside block XZ footprint?
      const inX = Math.abs(probeX - bPos.x) < half.x + PLAYER.colliderRadius;
      const inZ = Math.abs(probeZ - bPos.z) < half.z + PLAYER.colliderRadius;
      if (!inX || !inZ) continue;

      // Block top must be above hero's feet and within max climb height
      const heightDiff = top - feetY;
      if (heightDiff <= 0 || heightDiff > CLIMB.maxHeight) continue;

      // Must be alongside the block (feet below top)
      if (feetY >= top) continue;

      // Start climbing
      this.climbState = 'rising';
      this.climbBlock = block;
      this.climbTargetTopY = top;
      this.verticalVelocity = 0;
      this.isGrounded = false;
      this.onPlatform = false;
      return true;
    }
    return false;
  }

  private updateClimb(dt: number): void {
    // If block disappeared, abort
    if (this.climbBlock && this.climbBlock.isDead) {
      this.climbState = 'none';
      this.climbBlock = null;
      return;
    }

    // Track block if it moved
    if (this.climbBlock) {
      const delta = this.climbBlock.movementDelta;
      this.mesh.position.x += delta.x;
      this.mesh.position.z += delta.z;
      this.climbTargetTopY = this.climbBlock.topY;
    }

    if (this.climbState === 'rising') {
      this.mesh.position.y += CLIMB.upSpeed * dt;
      if (this.mesh.position.y >= this.climbTargetTopY) {
        this.mesh.position.y = this.climbTargetTopY;
        this.climbState = 'vaulting';
      }
    } else if (this.climbState === 'vaulting') {
      this.camera.getWorldDirection(this._camForward);
      this._camForward.y = 0;
      this._camForward.normalize();
      this.mesh.position.x += this._camForward.x * CLIMB.forwardSpeed * dt;
      this.mesh.position.z += this._camForward.z * CLIMB.forwardSpeed * dt;

      // Check if we're over the block — if so, land
      const bPos = this.climbBlock?.position;
      const half = this.climbBlock?.halfExtents;
      if (bPos && half) {
        const overBlock =
          Math.abs(this.mesh.position.x - bPos.x) < half.x - 0.05 &&
          Math.abs(this.mesh.position.z - bPos.z) < half.z - 0.05;
        if (overBlock) {
          this.climbState = 'none';
          this.climbBlock = null;
          this.isGrounded = true;
          this.verticalVelocity = 0;
        }
      } else {
        // Block gone
        this.climbState = 'none';
        this.climbBlock = null;
      }
    }

    // Arena boundary during climb
    this.arena.clampPosition(this.mesh.position, PLAYER.colliderRadius);
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(dt: number): void {
    this.updateBurst(dt);
    this.updateWallJumpTimers(dt);

    // Climbing overrides normal movement
    if (this.climbState !== 'none') {
      this.updateClimb(dt);
      if (this.animCtrl) this.updateAnimation();
      return;
    }

    this.updateMovement(dt);
    if (this.animCtrl) this.updateAnimation();
  }

  private updateBurst(dt: number): void {
    if (this.burstTimer > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) { this.burstActive = false; this.burstTimer = 0; }
    }
    if (this.burstCooldownTimer > 0) this.burstCooldownTimer -= dt;
  }

  private updateWallJumpTimers(dt: number): void {
    if (this.wallJumpCooldown > 0) this.wallJumpCooldown -= dt;
    if (this.wallJumping) {
      this.wallJumpTimer -= dt;
      if (this.wallJumpTimer <= 0) this.wallJumping = false;
    }
  }

  private updateMovement(dt: number): void {
    // ── Camera-relative direction ──────────────────────────────────────────
    this.camera.getWorldDirection(this._camForward);
    this._camForward.y = 0;
    if (this._camForward.lengthSq() < 0.0001) this._camForward.set(0, 0, -1);
    this._camForward.normalize();
    this._camRight.crossVectors(this._camForward, THREE.Object3D.DEFAULT_UP).normalize();

    this._moveDir.set(0, 0, 0);
    if (this.input.forward)  this._moveDir.addScaledVector(this._camForward,  1);
    if (this.input.backward) this._moveDir.addScaledVector(this._camForward, -1);
    if (this.input.right)    this._moveDir.addScaledVector(this._camRight,    1);
    if (this.input.left)     this._moveDir.addScaledVector(this._camRight,   -1);

    const hasDir = this._moveDir.lengthSq() > 0;
    if (hasDir) this._moveDir.normalize();

    // ── Grapple overrides horizontal movement ─────────────────────────────
    const grappling = this.grapple?.isGrappling ?? false;

    if (this.slideCooldownTimer > 0) this.slideCooldownTimer -= dt;

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.cancelSlide();
      }
    }

    if (grappling && this.grapple) {
      this.cancelSlide();
      const gv = this.grapple.grappleVelocity;
      this.velocity.x = gv.x;
      this.velocity.z = gv.z;
      // Allow grapple to pull upward too
      this.verticalVelocity = gv.y !== 0 ? gv.y : this.verticalVelocity;
    } else if (this.isSliding) {
      // Slide momentum: initial impulse smoothly decaying toward run speed
      const progress = Math.max(0, this.slideTimer / this.slideDuration);
      const targetEndSpeed = this.burstActive ? PLAYER.burstSpeed : PLAYER.runSpeed;
      const slideSpeed = targetEndSpeed + (SLIDE.initialSpeed - targetEndSpeed) * (progress * progress);
      this.velocity.x = this._slideDir.x * slideSpeed;
      this.velocity.z = this._slideDir.z * slideSpeed;

      // Visual tilt for fallback character
      if (!this.animCtrl || !this.animCtrl.hasSlide()) {
        this.mesh.rotation.x = 0.3;
      }
    } else if (!this.wallJumping) {
      if (!this.animCtrl || !this.animCtrl.hasSlide()) {
        this.mesh.rotation.x = 0;
      }
      const speed = this.burstActive && hasDir ? PLAYER.burstSpeed : hasDir ? PLAYER.runSpeed : 0;
      this.velocity.x = this._moveDir.x * speed;
      this.velocity.z = this._moveDir.z * speed;
    } else if (this.wallJumping && hasDir) {
      this.cancelSlide();
      this.velocity.x += this._moveDir.x * PLAYER.runSpeed * 0.4 * dt * 8;
      this.velocity.z += this._moveDir.z * PLAYER.runSpeed * 0.4 * dt * 8;
    }

    // ── Ground jump ────────────────────────────────────────────────────────
    if (this.input.jump && this.isGrounded && !grappling) {
      this.cancelSlide();
      this.verticalVelocity = PLAYER.jumpForce;
      this.isGrounded = false;
      this.input.jump = false;
      this.onPlatform = false;
    }

    // ── Wall jump ──────────────────────────────────────────────────────────
    if (this.input.jump && !this.isGrounded && !grappling) {
      this.tryWallJump();
      this.input.jump = false;
    }

    // ── Tall-block climb initiation ────────────────────────────────────────
    if (!this.isGrounded && hasDir && this.input.forward && !grappling) {
      this.tryInitiateClimb();
    }
    // Also try from ground when walking into a climbable block
    if (this.isGrounded && this.input.forward && !grappling) {
      this.tryInitiateClimb();
    }

    // ── Ground-slam vertical override ─────────────────────────────────────
    if (this.groundSlam) {
      const isDescending = this.verticalVelocity < 0;
      const override = this.groundSlam.update(dt, this.mesh.position.y, this.isGrounded, isDescending);
      if (override !== null) {
        this.verticalVelocity = override;
      }
    }

    // ── Gravity ────────────────────────────────────────────────────────────
    if (!this.onPlatform && !grappling) {
      this.verticalVelocity += PLAYER.gravity * dt;
    } else if (grappling) {
      // Allow some gravity while grappling so it feels physical
      this.verticalVelocity += PLAYER.gravity * 0.3 * dt;
    }
    this.velocity.y = this.verticalVelocity;

    this.mesh.position.addScaledVector(this.velocity, dt);

    // ── Floor ground check ─────────────────────────────────────────────────
    if (!this.onPlatform && this.mesh.position.y <= this.groundY) {
      const prevSlam = this.groundSlam?.isSlamming ?? false;
      if (prevSlam) {
        this.groundSlam!.onLanded(this.mesh.position.clone());
      }
      this.mesh.position.y = this.groundY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
      this.wallJumping = false;
    }

    // ── Arena wall clamping ────────────────────────────────────────────────
    this.arena.clampPosition(this.mesh.position, PLAYER.colliderRadius);

    // ── Facing ────────────────────────────────────────────────────────────
    if (hasDir && !this.wallJumping && !grappling && !this.isSliding) {
      const targetAngle = Math.atan2(this._moveDir.x, this._moveDir.z);
      const diff = targetAngle - this.facingAngle;
      const wrap = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facingAngle += wrap * Math.min(1, 15 * dt);
      this.mesh.rotation.y = this.facingAngle;
    }
  }

  private updateAnimation(): void {
    if (!this.animCtrl) return;

    if (this.climbState !== 'none') {
      this.cancelSlide();
      this.animCtrl.play('jump', 0.2); // use jump anim as climb placeholder
      return;
    }

    if (this.animCtrl.isPlayingWallJump()) {
      this.cancelSlide();
      return;
    }

    if (!this.isGrounded) {
      this.cancelSlide();
      const nextAir: AnimState = this.verticalVelocity > 0 ? 'jump' : 'jumpDown';
      this.animCtrl.play(nextAir, 0.15);
      return;
    }

    if (this.isSliding) {
      this.animCtrl.play('slide', 0.1);
      return;
    }

    const horizSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    this.animCtrl.play(this.animCtrl.resolveGroundState(horizSpeed, this.burstActive), 0.2);
  }

  get position(): THREE.Vector3 { return this.mesh.position; }
  get isInBurst(): boolean { return this.burstActive; }
  get grounded(): boolean { return this.isGrounded; }
  get sliding(): boolean { return this.isSliding; }
}
