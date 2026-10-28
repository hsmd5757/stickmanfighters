// Shared combat resolution. Game-rule logic only; no rendering or input.
// For multiplayer, this module is intended to run on the server, which
// decides every hit. The client may predict visuals but never resolves hits.

export const hurtboxOf = (f) => ({ x: f.x - 16, y: f.y - f.height, w: 32, h: f.height });

// Converts an ability's local reach (facing-relative) into a world rectangle.
export function hitboxRect(f, r) {
  return { x: f.facing > 0 ? f.x + r.x : f.x - r.x - r.w, y: f.y + r.y, w: r.w, h: r.h };
}

function overlaps(hb, box) {
  if (hb.shape === "circle") {
    const nx = Math.max(box.x, Math.min(hb.cx, box.x + box.w));
    const ny = Math.max(box.y, Math.min(hb.cy, box.y + box.h));
    return (hb.cx - nx) ** 2 + (hb.cy - ny) ** 2 <= hb.r * hb.r;
  }
  return hb.x < box.x + box.w && hb.x + hb.w > box.x &&
         hb.y < box.y + box.h && hb.y + hb.h > box.y;
}

// Checks the attacker's active hitboxes against the defender's hurtbox.
// Each (hitbox key, defender) pair can connect at most once per activation.
export function processHitboxes(attacker, defender, action) {
  const results = [];
  if (defender.state === "ko") return results;
  for (const hb of action.def.hitboxes(attacker, action)) {
    const id = `${hb.key}:${defender.id}`;
    if (action.hit.has(id) || !overlaps(hb, hurtboxOf(defender))) continue;
    action.hit.add(id);
    results.push(resolveHit(attacker, defender, hb, action));
  }
  return results;
}

export function resolveHit(attacker, defender, hb, action) {
  // Frontal means the attacker is on the side the defender is facing.
  // Hits from behind (or from a locked-facing defender) bypass the block.
  const frontal = defender.facing === Math.sign(attacker.x - defender.x);

  let base = hb.damage;
  if (action.cap != null) {
    const used = action.dealt.get(defender.id) || 0;
    base = Math.max(0, Math.min(base, action.cap - used));
    action.dealt.set(defender.id, used + base);
  }

  let dmg = base;
  let blocked = false;
  if (defender.blocking && defender.canBlock() && frontal && hb.blockMode !== "none") {
    blocked = true;
    dmg = hb.blockMode === "negate" ? 0 : Math.round(base * 0.5);
  }

  defender.health = Math.max(0, defender.health - dmg);
  const dir = Math.sign(defender.x - attacker.x) || attacker.facing;

  if (blocked) {
    defender.enterBlockstun(120);
    defender.say("BLOCKED");
    defender.push(dir * hb.knockback.x * 0.3, 0);
    if (hb.interruptOnBlock) action.interrupted = true;
  } else {
    defender.enterHitstun(hb.hitstun);
    defender.push(dir * hb.knockback.x, hb.knockback.y);
    defender.say(`-${dmg}`);
  }

  attacker.registerHit(dmg);
  if (defender.health <= 0) defender.knockout();
  return { defenderId: defender.id, base, damage: dmg, blocked };
}
