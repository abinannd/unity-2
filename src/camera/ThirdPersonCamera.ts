import * as THREE from 'three';


export class ThirdPersonCamera {
  private phi = 0.4;         // vertical angle (radians)
  private theta = 0;         // horizontal angle (radians)
  private readonly minPhi = 0.1;
  private readonly maxPhi = Math.PI / 2 - 0.05;
  private distance = 7;
  private locked = false;

  private readonly _offset = new THREE.Vector3();
  private readonly _ideal = new THREE.Vector3();

  private target: THREE.Object3D;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    target: THREE.Object3D,
  ) {
    this.target = target;
    this.setupPointerLock();
  }

  /** Swap the follow target (called after FBX model replaces fallback). */
  setTarget(target: THREE.Object3D): void {
    this.target = target;
  }

  private setupPointerLock(): void {
    document.addEventListener('click', () => {
      if (!this.locked) document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.body;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const sens = 0.002;
      this.theta -= e.movementX * sens;
      this.phi -= e.movementY * sens;
      this.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.phi));
    });

    document.addEventListener('wheel', (e) => {
      this.distance = Math.max(3, Math.min(14, this.distance + e.deltaY * 0.01));
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.locked) {
        document.exitPointerLock();
      }
    });
  }

  update(_dt: number): void {
    const targetPos = this.target.position;

    // Spherical offset
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    this._offset.set(
      this.distance * sinTheta * sinPhi,
      this.distance * cosPhi,
      this.distance * cosTheta * sinPhi,
    );

    this._ideal.copy(targetPos).add(this._offset);

    // Clamp camera above floor
    this._ideal.y = Math.max(0.5, this._ideal.y);

    this.camera.position.lerp(this._ideal, 0.12);
    this.camera.lookAt(targetPos.x, targetPos.y + 1.2, targetPos.z);
  }

  /** Returns the horizontal yaw angle — used by PlayerController for relative movement. */
  get yaw(): number { return this.theta; }
}
