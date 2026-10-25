// ============================================================
// Game-wide configuration — edit values here to tune the game
// ============================================================

export const ARENA = {
  halfSize: 24,       // half-width of the square floor (total = 48 units)
  wallHeight: 10,
  wallThickness: 0.5,
};

export const PLAYER = {
  walkSpeed: 4,
  runSpeed: 7,
  burstSpeed: 14,       // double-shift speed burst
  burstDuration: 1.5,   // seconds — dash lasts this long
  burstCooldown: 1.5,   // seconds
  burstWindowMs: 300,   // ms to detect double-shift
  jumpForce: 7,
  gravity: -18,
  height: 1.8,          // capsule half-height used for feet offset
  colliderRadius: 0.4,
  maxHealth: 100,
};

export const WALL_JUMP = {
  upVelocity: 8,          // upward velocity on wall jump
  pushSpeed: 7,           // horizontal push away from wall
  wallTolerance: 0.4,     // how close to wall counts as contact
  cooldown: 0.25,         // seconds between wall jumps
};

export const SAFE_BLOCK = {
  size: 2.5,              // side length of the safe block
  lifetime: 15,           // seconds before it disappears
  respawnDelay: 20,       // seconds after expiry before a new one spawns
  regenRate: 5,           // HP per second while standing on it
  regenDelay: 0.5,        // seconds on platform before regen starts
};

export const BLOCK = {
  spawnInterval: 3,     // seconds between spawns
  lifetime: 6,          // seconds a block stays before despawning
  warnDuration: 1.2,    // warning phase before materialising
  minSize: 0.8,
  maxSize: 2.2,
  maxBlocks: 8,
  moveSpeed: 2,
  damageOnHit: 10,
};

export const ENEMY = {
  maxEnemies: 6,
  spawnInterval: 4.25,  // seconds between spawns (~17% faster than original 5s)
  health: 40,           // ordinary enemy: exactly 2 projectile hits to kill (20 dmg)
  redHealth: 60,        // red enemy: exactly 3 projectile hits to kill (20 dmg)
  redSpawnChance: 0.4,  // probability of spawning a red enemy
  moveSpeed: 3.2,
  attackRange: 1.4,
  attackDamage: 8,
  attackCooldown: 1.2,
  detectionRange: 30,
  spinningRodSpawnChance: 0.15, // probability of spawning a spinning-rod enemy
  colliderRadius: 0.4,
};

export const COMBAT = {
  projectileSpeed: 22,
  projectileDamage: 20,   // 2 hits = ordinary enemy dead (40 HP), 3 hits = red enemy dead (60 HP)
  fireCooldown: 0.35,
  projectileLifetime: 3,
  projectileRadius: 0.12,
};

export const GROUND_SLAM = {
  downVelocity: -28,        // strong downward push when slam activated
  minFallDistance: 2.5,     // minimum vertical drop before slam allowed
  aoeRadius: 5,             // damage radius on impact
  aoeDamage: 40,            // 2× projectile hits worth of damage
  shockwaveSpeed: 12,       // units/s expansion
  shockwaveDuration: 0.4,   // seconds shockwave lives
  recoveryTime: 0.35,       // brief landing lockout
  cameraShakeDuration: 0.25,
  cameraShakeMagnitude: 0.18,
};

export const GRAPPLE = {
  maxRange: 25,             // max distance to a grapple target
  maxTravelDistance: 15,    // maximum distance player can travel on one grapple pull
  aimTolerance: 0.35,       // cos(angle) threshold — ~20°
  speed: 28,                // units/s pull speed
  maxDuration: 0.9,         // seconds before auto-cancel
  targetRadius: 0.55,       // visual sphere radius
  maxTargets: 3,            // maximum number of active grappling targets (reduced from 6)
  targetLifetime: 8,        // seconds before a target despawns
  respawnDelayMin: 2,       // minimum delay (seconds) before spawning replacement
  respawnDelayMax: 4,       // maximum delay (seconds) before spawning replacement
  targetGlowColor: 0xffffff,
  reachTolerance: 1.5,      // distance to target that counts as "reached"
};

export const CLIMB = {
  maxHeight: 3.0,           // max vertical step to initiate climb
  detectionDepth: 1.0,      // how far in front to probe for climbable block
  upSpeed: 5,               // vertical climb speed
  forwardSpeed: 3,          // forward speed after clearing top
  minSideDepth: 0.2,        // min wall contact depth required
};

export const DIFFICULTY = {
  rampInterval: 30,         // every N seconds increase difficulty
  spawnIntervalDecrement: 0.3,
  enemyHealthIncrement: 0,  // keep fixed at 40 (ordinary) and 60 (red) so hit counts remain exact
  enemySpeedIncrement: 0.2,
};

export const SLIDE = {
  duration: 0.63,           // seconds slide animation and momentum lasts (~16% shorter than original 0.75s)
  initialSpeed: 13.5,       // starting slide speed burst (tapers to run speed)
  cooldown: 0.35,           // seconds before next slide can be triggered
};
