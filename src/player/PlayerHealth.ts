import { PLAYER } from '../game/GameConfig';

export class PlayerHealth {
  private _hp: number;
  readonly max: number;
  isDead = false;
  onDeath?: () => void;
  onDamage?: (hp: number, max: number) => void;

  constructor() {
    this._hp = PLAYER.maxHealth;
    this.max = PLAYER.maxHealth;
  }

  get hp(): number { return this._hp; }

  takeDamage(amount: number): void {
    if (this.isDead) return;
    this._hp = Math.max(0, this._hp - amount);
    this.onDamage?.(this._hp, this.max);
    if (this._hp <= 0) {
      this.isDead = true;
      this.onDeath?.();
    }
  }

  heal(amount: number): void {
    if (this.isDead) return;
    const prev = this._hp;
    this._hp = Math.min(this.max, this._hp + amount);
    if (this._hp !== prev) this.onDamage?.(this._hp, this.max);
  }

  reset(): void {
    this._hp = this.max;
    this.isDead = false;
  }
}
