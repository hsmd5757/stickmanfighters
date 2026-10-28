// Central configuration. All durations are in milliseconds, distances in pixels.
export const STAGE = { width: 960, height: 540, groundY: 440, minX: 40, maxX: 920 };

export const REALSTICKMAN = {
  id: "realstickman",
  displayName: "RealStickman",
  maxHealth: 200,
  movement: { walkSpeed: 170, runSpeed: 300, jumpVelocity: 640, gravity: 2000 },
  limbs: { upperArm: 26, foreArm: 24, thigh: 34, shin: 34, torso: 56, headR: 13 },
  abilities: {
    basicPunch: {
      damage: 6, duration: 380, cooldown: 0,
      activeFrom: 110, activeTo: 190,
      reach: { x: 16, y: -50, w: 40, h: 22 },
      knockback: { x: 110, y: 0 }, hitstun: 180, blockMode: "negate",
    },
    block: { blockstun: 120, blockedKnockbackScale: 0.3 },
    groundSlam: {
      damage: 15, duration: 900, cooldown: 4000,
      impactFrom: 300, impactTo: 340, radius: 110,
      knockback: { x: 260, y: -160 }, hitstun: 350, blockMode: "reduce",
    },
    forwardBurst: {
      damage: 20, duration: 520, cooldown: 3500,
      prepEnd: 100, burstEnd: 360, distance: 220,
      activeFrom: 120, activeTo: 340,
      reach: { x: 0, y: -60, w: 80, h: 60 },
      knockback: { x: 300, y: 0 }, hitstun: 300, blockMode: "negate",
    },
    rapidPunchBarrage: {
      duration: 2000, maxDamage: 25, hitDamage: 5, cooldown: 6000,
      hitWindows: [200, 600, 1000, 1400, 1800], windowLength: 110,
      reach: { x: 14, y: -50, w: 44, h: 24 },
      knockback: { x: 60, y: 0 }, hitstun: 140,
      blockMode: "reduce", interruptOnBlock: true,
    },
    phantomStrike: {
      damage: 30, duration: 820, cooldown: 8000, failRecovery: 600,
      grabRange: 90, launchTime: 200, teleportAt: 500, behindOffset: 56,
      punchFrom: 560, punchTo: 640,
      launch: { x: 380, y: -520 },
      reach: { x: 14, y: -50, w: 44, h: 26 },
      knockback: { x: 0, y: 0 }, hitstun: 300, blockMode: "none",
    },
  },
};

// Minimal schema check so a malformed character fails loudly at startup.
export function validateCharacter(c) {
  for (const key of ["id", "displayName", "maxHealth", "movement", "limbs", "abilities"]) {
    if (c[key] === undefined) throw new Error(`Character "${c.id}" is missing "${key}"`);
  }
  return c;
}
