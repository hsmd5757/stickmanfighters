// Canvas skeletal rendering. Poses are angle sets (radians, 0 = straight down,
// PI/2 = forward). Ability poses are keyframed so anticipation, impact and
// recovery read clearly.
import { STAGE, REALSTICKMAN as C } from "./config.js";

const L = C.limbs;
const IDLE = { lean: 0.04, bodyY: 0, fA: [0.9, 2.1], bA: [0.6, 1.5], fL: [0.08, 0.02], bL: [-0.12, -0.08] };
const pose = (o) => ({ ...IDLE, ...o });

const POSES = {
  block: pose({ lean: 0.12, fA: [1.9, 2.6], bA: [1.9, 2.6], fL: [0.25, 0.1], bL: [-0.2, -0.1] }),
  land: pose({ lean: 0.2, bodyY: 14, fL: [0.9, 0.5], bL: [0.9, 0.5] }),
  jump: pose({ lean: -0.1, bodyY: -4, fA: [2.5, 2.9], bA: [2.4, 2.8], fL: [1.1, -0.9], bL: [0.7, -1.2] }),
  air: pose({ lean: -0.7, fA: [2.8, 3.0], bA: [2.5, 2.9], fL: [0.9, 0.4], bL: [0.5, 0.3] }),
  hurt: pose({ lean: -0.35, fA: [2.2, 2.6], bA: [1.6, 2.2], fL: [0.1, 0.05] }),
};
const KO = pose({ lean: 1.45, bodyY: 50, fA: [2.0, 2.6], bA: [2.2, 2.8], fL: [1.5, 1.6], bL: [1.4, 1.6] });

const PUNCH_WIND = pose({ lean: -0.15, fA: [-0.9, 0.2] });
const PUNCH_EXT = pose({ lean: 0.25, fA: [1.55, 1.57] });
const CROUCH = pose({ bodyY: 18, lean: 0.25, fA: [2.9, 3.0], bA: [2.9, 3.0], fL: [0.9, 0.6], bL: [0.9, 0.6] });
const SLAM = pose({ bodyY: 24, lean: 0.7, fA: [0.2, 0.1], bA: [0.3, 0.2], fL: [0.9, 0.6], bL: [0.9, 0.6] });
const BURST_PREP = pose({ bodyY: 14, lean: 0.5, fA: [-0.6, 1.0], bA: [-0.9, 0.6], fL: [0.7, -0.6], bL: [0.4, -0.4] });
const BURST = pose({ lean: 0.8, bodyY: 4, fA: [1.5, 1.5], bA: [1.2, 1.3], fL: [0.3, -0.2], bL: [-0.4, -0.6] });
const REACH = pose({ lean: 0.2, fA: [1.5, 1.5], bA: [1.2, 1.2] });
const THROW = pose({ lean: -0.2, fA: [1.9, 2.0], bA: [2.2, 2.5] });
const SPIN = pose({ lean: 0.1, fA: [2.0, 2.3], bA: [2.0, 2.3] });
const FINISH = pose({ lean: 0.45, fA: [1.57, 1.57], bA: [1.0, 1.2], fL: [0.3, 0.1], bL: [-0.3, -0.2] });

const KF = {
  basicPunch: [[0, IDLE], [90, PUNCH_WIND], [115, PUNCH_EXT], [200, PUNCH_EXT], [380, IDLE]],
  groundSlam: [[0, IDLE], [220, CROUCH], [300, SLAM], [420, SLAM], [600, IDLE]],
  forwardBurst: [[0, IDLE], [100, BURST_PREP], [140, BURST], [340, BURST], [520, IDLE]],
  phantomStrike: [[0, IDLE], [120, REACH], [200, THROW], [500, SPIN], [560, FINISH], [640, FINISH], [820, IDLE]],
};

// Linear blend with smoothstep easing; every pose shares the same keys.
function mix(a, b, k) {
  const o = {};
  for (const key in a) {
    const x = a[key], y = b[key];
    o[key] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * k) : x + (y - x) * k;
  }
  return o;
}

function sample(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, p1] = frames[i];
    if (t <= t1) {
      const [t0, p0] = frames[i - 1];
      const k = (t - t0) / (t1 - t0);
      return mix(p0, p1, k * k * (3 - 2 * k));
    }
  }
  return frames[frames.length - 1][1];
}

function barragePose(e) {
  // Alternating punches: one arm extends per 200 ms cycle.
  const arm = Math.floor(e / 200) % 2;
  const k = Math.sin(Math.PI * ((e % 200) / 200));
  return pose({
    lean: 0.12 + 0.08 * k,
    bodyY: 3 * k,
    fA: arm === 0 ? [0.9 + 0.7 * k, 2.1 - 0.6 * k] : [0.9, 2.1],
    bA: arm === 1 ? [0.9 + 0.7 * k, 2.1 - 0.6 * k] : [0.6, 1.5],
  });
}

function walkPose(running, now) {
  const s = Math.sin(now * (running ? 0.022 : 0.014));
  return pose({
    lean: running ? 0.2 : 0.06,
    fL: [0.6 * s, 0.3 + 0.2 * Math.max(0, -s)],
    bL: [-0.6 * s, 0.3 + 0.2 * Math.max(0, s)],
    fA: [0.9 - 0.4 * s, 2.0],
    bA: [0.6 + 0.4 * s, 1.5],
  });
}

export function poseFor(f, now) {
  const a = f.action;
  if (a) {
    if (a.name === "rapidPunchBarrage") return barragePose(a.elapsed);
    const frames = KF[a.name];
    return frames ? sample(frames, a.elapsed) : IDLE;
  }
  if (f.state === "ko") return KO;
  if (f.state === "block" || f.state === "blockstun") return POSES.block;
  if (f.state === "hitstun" || f.state === "grabbed") return POSES.hurt;
  if (f.state === "airborne") return f.vy < 0 ? POSES.jump : POSES.air;
  if (now < f.landingUntil) return POSES.land;
  if (f.state === "walk" || f.state === "run") return walkPose(f.state === "run", now);
  return pose({ lean: 0.04 + 0.02 * Math.sin(now / 250) });
}

const limb = (from, ang, len) => [from[0] + Math.sin(ang) * len, from[1] + Math.cos(ang) * len];
const chain = (start, a1, l1, a2, l2) => { const j = limb(start, a1, l1); return [start, j, limb(j, a2, l2)]; };

export function drawStage(ctx) {
  ctx.fillStyle = "#f4f4f1";
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, STAGE.groundY); ctx.lineTo(STAGE.width, STAGE.groundY); ctx.stroke();
}

export function drawFighter(ctx, f, now) {
  const p = poseFor(f, now);
  const to = ([x, y]) => [f.x + x * f.facing, f.y + y];
  const hip = [0, -(L.thigh + L.shin) + p.bodyY];
  const neck = [hip[0] + Math.sin(p.lean) * L.torso, hip[1] - Math.cos(p.lean) * L.torso];
  const hc = [neck[0] + Math.sin(p.lean) * (L.headR + 3), neck[1] - Math.cos(p.lean) * (L.headR + 3)];

  const fArm = chain(neck, p.fA[0], L.upperArm, p.fA[1], L.foreArm);
  const bArm = chain(neck, p.bA[0], L.upperArm, p.bA[1], L.foreArm);
  const fLeg = chain(hip, p.fL[0], L.thigh, p.fL[1], L.shin);
  const bLeg = chain(hip, p.bL[0], L.thigh, p.bL[1], L.shin);

  const path = (pts, w, color) => {
    ctx.beginPath();
    pts.map(to).forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  };

  ctx.lineCap = "round"; ctx.lineJoin = "round";
  path(bArm, 6, "#3a3a3a");
  path(bLeg, 7, "#3a3a3a");
  path([hip, neck], 9, "#000");
  path(fLeg, 7, "#000");
  path(fArm, 6, "#000");

  const [hx, hy] = to(hc);
  ctx.beginPath(); ctx.arc(hx, hy, L.headR, 0, Math.PI * 2); ctx.fillStyle = "#000"; ctx.fill();

  for (const j of [fArm[1], fLeg[1]]) {
    const [jx, jy] = to(j);
    ctx.beginPath(); ctx.arc(jx, jy, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  }
}

export function drawFx(ctx, f) {
  for (const e of f.fx) {
    const k = e.age / e.life;
    ctx.globalAlpha = 1 - k;
    if (e.type === "ring") {
      ctx.strokeStyle = "#222"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.2 + 0.8 * k), 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === "trail") {
      ctx.strokeStyle = "#777"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - e.dir * 40, e.y); ctx.stroke();
    } else if (e.type === "flash") {
      ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const an = (i * Math.PI) / 3;
        ctx.moveTo(e.x + Math.cos(an) * 8, e.y + Math.sin(an) * 8);
        ctx.lineTo(e.x + Math.cos(an) * 22, e.y + Math.sin(an) * 22);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawText(ctx, f) {
  if (!f.text) return;
  ctx.fillStyle = "#111";
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(f.text.msg, f.x, f.y - 130);
}
