// Ability definitions. Each ability is data plus small hooks:
//   start(f, opp, action, now) -> false cancels before any state change
//   update(f, action, opp, dt) -> per-frame movement and effects
//   hitboxes(f, action)        -> active hit regions for this frame
//   end(f, action)             -> cleanup on finish, cancel or interruption
import { STAGE, REALSTICKMAN as C } from "./config.js";
import { hitboxRect } from "./combat.js";

const A = C.abilities;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inWindow = (e, from, to) => e >= from && e < to;

const box = (key, rect, cfg, extra = {}) => ({
  key, shape: "rect", ...rect,
  damage: cfg.damage, knockback: cfg.knockback, hitstun: cfg.hitstun, blockMode: cfg.blockMode,
  ...extra,
});

export const ABILITIES = {
  basicPunch: {
    start: () => true,
    hitboxes(f, a) {
      const c = A.basicPunch;
      return inWindow(a.elapsed, c.activeFrom, c.activeTo)
        ? [box("punch", hitboxRect(f, c.reach), c)] : [];
    },
  },

  groundSlam: {
    start: () => true,
    update(f, a) {
      const c = A.groundSlam;
      if (!a.fxSpawned && a.elapsed >= c.impactFrom) {
        a.fxSpawned = true;
        f.spawnFx({ type: "ring", x: f.x, y: f.y - 40, r: c.radius, life: 320 });
      }
    },
    hitboxes(f, a) {
      const c = A.groundSlam;
      return inWindow(a.elapsed, c.impactFrom, c.impactTo)
        ? [{ key: "slam", shape: "circle", cx: f.x, cy: f.y - 40, r: c.radius,
             damage: c.damage, knockback: c.knockback, hitstun: c.hitstun, blockMode: c.blockMode }]
        : [];
    },
  },

  forwardBurst: {
    start(f) { f.lockFacing = true; return true; },
    update(f, a) {
      const c = A.forwardBurst, e = a.elapsed;
      if (inWindow(e, c.prepEnd, c.burstEnd)) {
        const dur = (c.burstEnd - c.prepEnd) / 1000;
        const atWall = (f.facing > 0 && f.x >= STAGE.maxX - 1) || (f.facing < 0 && f.x <= STAGE.minX + 1);
        f.vx = atWall ? 0 : (f.facing * c.distance) / dur;
        f.spawnFx({ type: "trail", x: f.x, y: f.y - 50, dir: f.facing, life: 180 });
      } else {
        f.vx = 0;
      }
    },
    hitboxes(f, a) {
      const c = A.forwardBurst;
      return inWindow(a.elapsed, c.activeFrom, c.activeTo)
        ? [box("burst", hitboxRect(f, c.reach), c)] : [];
    },
  },

  rapidPunchBarrage: {
    start: () => true,
    update(f) { f.vx = 0; },
    hitboxes(f, a) {
      const c = A.rapidPunchBarrage, out = [];
      c.hitWindows.forEach((t, i) => {
        if (inWindow(a.elapsed, t, t + c.windowLength)) {
          out.push(box(`barrage${i}`, hitboxRect(f, c.reach),
            { ...c, damage: c.hitDamage }, { interruptOnBlock: c.interruptOnBlock }));
        }
      });
      return out;
    },
  },

  phantomStrike: {
    start(f, opp, a) {
      const c = A.phantomStrike, dx = opp.x - f.x;
      if (Math.abs(dx) > c.grabRange) { f.say("OUT OF RANGE"); return false; }
      if (Math.sign(dx) !== f.facing || Math.abs(opp.y - f.y) > 60 || !f.grounded || opp.noGrab) {
        f.say("INVALID TARGET");
        return false;
      }
      a.dir = f.facing;
      a.launched = false; a.teleported = false; a.cancelled = false;
      f.lockFacing = true;
      opp.state = "grabbed"; opp.vx = 0; opp.vy = 0;
      return true;
    },
    update(f, a, opp) {
      const c = A.phantomStrike, e = a.elapsed;

      if (!a.launched) {
        if (opp.state !== "grabbed") {
          a.cancelled = true; a.done = true; f.say("GRAB BROKEN");
          return;
        }
        f.vx = 0;
        if (e >= c.launchTime) {
          a.launched = true;
          opp.state = "airborne"; opp.grounded = false;
          opp.vx = a.dir * c.launch.x; opp.vy = c.launch.y;
          opp.facing = a.dir; opp.lockFacing = true;
        }
        return;
      }

      if (!a.teleported && e >= c.teleportAt) {
        // Teleport behind the target's current travel direction, using its real airborne position.
        a.teleported = true;
        const travel = Math.sign(opp.vx) || a.dir;
        let bx = clamp(opp.x - travel * c.behindOffset, STAGE.minX, STAGE.maxX);
        if (Math.abs(bx - opp.x) < 36) {
          bx = clamp(opp.x + (opp.x > STAGE.width / 2 ? -36 : 36), STAGE.minX, STAGE.maxX);
        }
        f.x = bx; f.vx = 0; f.vy = 0; f.hover = true;
        f.facing = Math.sign(opp.x - f.x) || a.dir;
        f.spawnFx({ type: "flash", x: f.x, y: f.y - 50, life: 160 });
      }

      if (a.teleported) { f.y = opp.y; f.grounded = opp.grounded; }
    },
    hitboxes(f, a) {
      const c = A.phantomStrike;
      return a.teleported && !a.cancelled && inWindow(a.elapsed, c.punchFrom, c.punchTo)
        ? [box("finish", hitboxRect(f, c.reach), c)] : [];
    },
    end(f, a) {
      // Release the target if the grab never completed.
      if (a.target && a.target.state === "grabbed") a.target.state = "idle";
    },
  },
};
