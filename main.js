import { REALSTICKMAN, validateCharacter } from "./config.js";
import { Fighter } from "./fighter.js";
import { processHitboxes } from "./combat.js";
import { drawStage, drawFighter, drawFx, drawText } from "./render.js";

validateCharacter(REALSTICKMAN);

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const player = new Fighter({ id: "player", x: 300, facing: 1 });
const dummy = new Fighter({ id: "dummy", x: 640, facing: -1, isDummy: true });

const KEYMAP = { "1": "groundSlam", "2": "forwardBurst", "3": "rapidPunchBarrage", "4": "phantomStrike" };
const held = { left: false, right: false, block: false, run: false };
let jumpQueued = false, paused = false, clock = 0, last = performance.now();

const isActive = () => !paused && !document.hidden;
const dummyBlocks = () => document.getElementById("dummyBlock").checked;
const isTyping = (e) => !!e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));

function useAbility(name) {
  if (isActive()) player.tryAbility(name, dummy, clock);
}

// Keyboard: held keys never re-trigger abilities (e.repeat is ignored for ability keys).
addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  const k = e.key.toLowerCase();
  if (k === "escape" && !e.repeat) { paused = !paused; return; }
  held.run = e.shiftKey;
  if (k === "a" || e.key === "ArrowLeft") held.left = true;
  if (k === "d" || e.key === "ArrowRight") held.right = true;
  if (k === "f") { held.block = true; e.preventDefault(); }
  if ((k === "w" || e.key === "ArrowUp") && !e.repeat) jumpQueued = true;
  if (KEYMAP[e.key] && !e.repeat) useAbility(KEYMAP[e.key]);
});

addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  held.run = e.shiftKey;
  if (k === "a" || e.key === "ArrowLeft") held.left = false;
  if (k === "d" || e.key === "ArrowRight") held.right = false;
  if (k === "f") held.block = false;
});

addEventListener("blur", () => { held.left = held.right = held.block = false; });

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) { e.preventDefault(); useAbility("basicPunch"); }
});

function step(dt) {
  const move = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  const jump = jumpQueued; jumpQueued = false;

  player.update(dt, clock, dummy, { move, block: held.block, run: held.run, jump });
  dummy.update(dt, clock, player, { move: 0, block: dummyBlocks(), run: false, jump: false });

  for (const [atk, def] of [[player, dummy], [dummy, player]]) {
    if (atk.action) processHitboxes(atk, def, atk.action);
  }

  for (const f of [player, dummy]) {
    const a = f.action;
    if (a && (a.interrupted || a.done || a.elapsed >= a.duration)) f.endAction();
  }
}

// HUD: M1 plus the four numbered abilities with cooldown overlays.
const HUD = [
  ["basicPunch", "M1", "BASIC PUNCH"],
  ["groundSlam", "1", "GROUND SLAM"],
  ["forwardBurst", "2", "FORWARD BURST"],
  ["rapidPunchBarrage", "3", "RAPID PUNCH BARRAGE"],
  ["phantomStrike", "4", "PHANTOM STRIKE"],
];
const bar = document.getElementById("abilities");
const cards = HUD.map(([name, key, label]) => {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `<b>${key}</b> ${label}<div class="ov"></div><span class="cd"></span>`;
  bar.append(el);
  return { name, el, ov: el.querySelector(".ov"), cd: el.querySelector(".cd") };
});

function updateHud() {
  for (const c of cards) {
    const cfg = player.def.abilities[c.name];
    const left = (player.cooldownUntil[c.name] || 0) - clock;
    const total = cfg.cooldown || 0;
    const ready = left <= 0 || total === 0;
    c.ov.style.height = ready ? "0%" : `${Math.min(100, (left / total) * 100)}%`;
    c.cd.textContent = ready ? "" : (left / 1000).toFixed(1);
    c.el.classList.toggle("ready", ready);
  }
  document.getElementById("combo").textContent =
    `Player combo: ${player.combo.hits} hits, ${player.combo.damage} dmg`;
  document.getElementById("hp").textContent =
    `Dummy HP ${dummy.health}/${dummy.maxHealth}`;
}

document.getElementById("reset").addEventListener("click", () => {
  dummy.reset(640); player.reset(300);
});

function render() {
  drawStage(ctx);
  for (const f of [dummy, player]) {
    drawFx(ctx, f);
    drawFighter(ctx, f, clock);
    drawText(ctx, f);
  }
}

function frame(now) {
  const dt = Math.min(50, now - last);
  last = now;
  if (isActive()) { clock += dt; step(dt); }
  render();
  updateHud();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
