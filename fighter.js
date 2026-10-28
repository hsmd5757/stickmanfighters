import { STAGE, REALSTICKMAN as C } from "./config.js";
import { ABILITIES } from "./abilities.js";

const BUSY = new Set(["hitstun", "blockstun", "grabbed", "ko"]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Fighter {
  constructor({ id, x, facing = 1, isDummy = false, def = C }) {
    this.id = id; this.def = def; this.isDummy = isDummy;
    this.x = x; this.y = STAGE.groundY; this.vx = 0; this.vy = 0;
    this.facing = facing; this.height = 100;
    this.health = def.maxHealth; this.maxHealth = def.maxHealth;
    this.state = "idle"; this.grounded = true; this.blocking = false;
    this.action = null; this.lockFacing = false; this.hover = false;
    this.stateEnd = 0; this.landingUntil = 0; this.cooldownUntil = {};
    this.combo = { hits: 0, damage: 0, timer: 0 };
    this.text = null; this.fx = []; this.clock = 0;
  }

  get noGrab() { return ["ko", "grabbed", "airborne", "hitstun"].includes(this.state); }
  canAct() { return !this.action && !BUSY.has(this.state) && this.state !== "airborne"; }
  canBlock() { return this.canAct(); }
  canTurn() { return !this.lockFacing && !["hitstun", "grabbed", "ko", "airborne"].includes(this.state); }

  say(msg) { this.text = { msg, until: this.clock + 900 }; }
  spawnFx(o) { this.fx.push({ age: 0, life: 300, ...o }); }

  // Single entry point for all four numbered abilities and M1.
  tryAbility(name, opp, now) {
    const cfg = this.def.abilities[name], def = ABILITIES[name];
    if (this.state === "ko" || !cfg || !def) return false;
    if (now < (this.cooldownUntil[name] || 0) || !this.canAct()) return false;

    const action = {
      name, def, cfg, elapsed: 0, duration: cfg.duration,
      hit: new Set(), dealt: new Map(), cap: cfg.maxDamage ?? null,
      target: opp, interrupted: false, done: false,
    };
    if (def.start(this, opp, action, now) === false) {
      this.cooldownUntil[name] = now + (cfg.failRecovery || 0);
      return false;
    }
    this.action = action;
    this.state = "attack";
    this.cooldownUntil[name] = now + (cfg.cooldown || 0);
    return true;
  }

  endAction() {
    const a = this.action;
    if (!a) return;
    a.def.end?.(this, a);
    this.action = null; this.hover = false; this.lockFacing = false;
    this.state = this.grounded ? "idle" : "airborne";
  }

  enterHitstun(dur) {
    this.endAction();
    this.state = "hitstun"; this.stateEnd = this.clock + dur; this.blocking = false;
  }

  enterBlockstun(dur) { this.state = "blockstun"; this.stateEnd = this.clock + dur; }

  knockout() {
    this.endAction();
    this.state = "ko"; this.blocking = false; this.vx = 0;
    this.say("KO");
  }

  push(vx, vy = 0) {
    this.vx = vx;
    if (vy) { this.vy = vy; this.grounded = false; }
  }

  registerHit(dmg) {
    this.combo.hits++; this.combo.damage += dmg; this.combo.timer = 1500;
  }

  reset(x) {
    Object.assign(this, {
      x, y: STAGE.groundY, vx: 0, vy: 0, health: this.maxHealth, state: "idle",
      grounded: true, blocking: false, lockFacing: false, hover: false,
      action: null, landingUntil: 0, cooldownUntil: {},
      combo: { hits: 0, damage: 0, timer: 0 }, text: null, fx: [],
    });
  }

  land(now) {
    this.landingUntil = now + 150;
    if (!this.action) this.lockFacing = false;
    if (this.state === "airborne") this.state = "idle";
  }

  update(dt, now, opp, input) {
    this.clock = now;
    const s = dt / 1000;

    if (this.text && now > this.text.until) this.text = null;
    if (this.combo.timer > 0 && (this.combo.timer -= dt) <= 0) {
      this.combo = { hits: 0, damage: 0, timer: 0 };
    }
    this.fx = this.fx.filter((e) => (e.age += dt) < e.life);

    if (this.canTurn() && opp.x !== this.x) this.facing = Math.sign(opp.x - this.x);

    if (this.action) {
      this.action.elapsed += dt;
      this.action.def.update?.(this, this.action, opp, dt);
    }

    if ((this.state === "hitstun" || this.state === "blockstun") && now >= this.stateEnd) {
      this.state = this.grounded ? "idle" : "airborne";
    }

    // Grounded free control: blocking, walking, running, jumping.
    let controlled = false;
    if (this.canAct() && this.grounded) {
      controlled = true;
      if (input.block) {
        this.blocking = true; this.state = "block"; this.vx = 0;
      } else {
        this.blocking = false;
        const sp = input.run ? C.movement.runSpeed : C.movement.walkSpeed;
        this.vx = input.move * sp;
        this.state = input.move ? (input.run ? "run" : "walk") : "idle";
        if (input.jump) {
          this.vy = -C.movement.jumpVelocity; this.grounded = false; this.state = "airborne";
        }
      }
    }

    if (!controlled && !this.action) {
      this.vx *= Math.pow(this.state === "airborne" ? 0.998 : 0.9, dt / 16.7);
    }

    if (!this.hover && !this.grounded) this.vy += C.movement.gravity * s;
    this.x = clamp(this.x + this.vx * s, STAGE.minX, STAGE.maxX);
    this.y += this.vy * s;

    if (this.y >= STAGE.groundY) {
      this.y = STAGE.groundY;
      if (!this.grounded) this.land(now);
      this.grounded = true; this.vy = 0;
    } else {
      this.grounded = false;
    }
  }
}
