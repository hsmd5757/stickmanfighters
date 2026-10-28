import { Fighter } from "./character/fighter.js";
import { processHitboxes, hurtboxOf } from "./character/combat.js";
import { drawStage, drawFighter, drawFx, drawText } from "./character/render.js";
import { CHARACTERS } from "./registry.js";
import { loadPrefs, savePrefs } from "./storage.js";

const $ = (sel) => document.querySelector(sel);
const canvas = $("#stage");
const ctx = canvas.getContext("2d");
const prefs = loadPrefs();

const SCREENS = {
  menu: $("#menu"),
  characters: $("#characters"),
  settings: $("#settings"),
  training: $("#training"),
};

const KEYMAP = { "1": "groundSlam", "2": "forwardBurst", "3": "rapidPunchBarrage", "4": "phantomStrike" };
const held = { left: false, right: false, block: false, run: false };
const PREVIEW_OPP = { x: 580 };

let state = null;
let pendingCharacter = prefs.character;
let clock = 0, last = performance.now(), fps = 0;
let jumpQueued = false, showHitboxes = false;
let player = null, dummy = null, preview = null;

const configOf = (id = prefs.character) => CHARACTERS[id].config;

function makeFighter(x, facing, id, isDummy = false) {
  return new Fighter({ id, x, facing, isDummy, def: configOf() });
}

// ---- State manager -------------------------------------------------------

const ENTER = {
  menu() { $("#notice").textContent = ""; },
  characters() {
    pendingCharacter = prefs.character;
    const entry = CHARACTERS[pendingCharacter];
    $("#char-name").textContent = entry.name;
    $("#char-desc").textContent = entry.description;
    const list = $("#char-abilities");
    list.innerHTML = "";
    for (const line of entry.abilities) {
      const li = document.createElement("li");
      li.textContent = line;
      list.append(li);
    }
  },
  settings() { $("#show-fps").checked = prefs.showFps; },
  training() { startTraining(); },
};

const EXIT = { training() { endTraining(); } };

function go(name) {
  if (state && EXIT[state]) EXIT[state]();
  state = name;
  for (const [key, el] of Object.entries(SCREENS)) el.hidden = key !== name;
  if (ENTER[name]) ENTER[name]();
}

// ---- Training room -------------------------------------------------------

const isTyping = (e) =>
  !!e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));

function onKeyDown(e) {
  if (isTyping(e)) return;
  if (e.key === "Escape") { if (!e.repeat) go("menu"); return; }
  const k = e.key.toLowerCase();
  held.run = e.shiftKey;
  if (k === "a" || e.key === "ArrowLeft") held.left = true;
  if (k === "d" || e.key === "ArrowRight") held.right = true;
  if (k === "f") { held.block = true; e.preventDefault(); }
  if ((k === "w" || e.key === "ArrowUp") && !e.repeat) jumpQueued = true;
  if (KEYMAP[e.key] && !e.repeat) player.tryAbility(KEYMAP[e.key], dummy, clock);
}

function onKeyUp(e) {
  const k = e.key.toLowerCase();
  held.run = e.shiftKey;
  if (k === "a" || e.key === "ArrowLeft") held.left = false;
  if (k === "d" || e.key === "ArrowRight") held.right = false;
  if (k === "f") held.block = false;
}

function onMouseDown(e) {
  if (e.button === 0) { e.preventDefault(); player.tryAbility("basicPunch", dummy, clock); }
}

function onBlur() { held.left = held.right = held.block = false; }

function startTraining() {
  player = makeFighter(300, 1, "player");
  dummy = makeFighter(640, -1, "dummy", true);
  held.left = held.right = held.block = held.run = false;
  jumpQueued = false;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("mousedown", onMouseDown);
}

function endTraining() {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", onBlur);
  canvas.removeEventListener("mousedown", onMouseDown);
  player = null;
  dummy = null;
}

function stepTraining(dt) {
  const move = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  const jump = jumpQueued;
  jumpQueued = false;

  player.update(dt, clock, dummy, { move, block: held.block, run: held.run, jump });
  dummy.update(dt, clock, player, { move: 0, block: false, run: false, jump: false });

  if (player.action) processHitboxes(player, dummy, player.action);

  for (const f of [player, dummy]) {
    const a = f.action;
    if (a && (a.interrupted || a.done || a.elapsed >= a.duration)) f.endAction();
  }
}

function drawDebug(f) {
  ctx.setLineDash([4, 4]);
  const hb = hurtboxOf(f);
  ctx.strokeStyle = "#2a6";
  ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
  ctx.strokeStyle = "#c33";
  if (f.action) {
    for (const h of f.action.def.hitboxes(f, f.action)) {
      if (h.shape === "circle") {
        ctx.beginPath(); ctx.arc(h.cx, h.cy, h.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeRect(h.x, h.y, h.w, h.h);
      }
    }
  }
  ctx.setLineDash([]);
}

function updateTrainingHud() {
  $("#hp").textContent = `DUMMY HP ${dummy.health}/${dummy.maxHealth}`;
  $("#combo").textContent = `COMBO ${player.combo.hits} HITS · ${player.combo.damage} DMG`;
}

// ---- Loop ----------------------------------------------------------------

function render() {
  drawStage(ctx);
  if (state === "training" && player) {
    for (const f of [dummy, player]) {
      drawFx(ctx, f);
      drawFighter(ctx, f, clock);
      drawText(ctx, f);
      if (showHitboxes) drawDebug(f);
    }
    updateTrainingHud();
  } else if (state === "menu" || state === "characters") {
    drawFighter(ctx, preview, clock);
  }
  if (prefs.showFps) {
    ctx.fillStyle = "#111";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`FPS ${fps.toFixed(0)}`, 944, 20);
    ctx.textAlign = "left";
  }
}

function frame(now) {
  const dt = Math.min(50, now - last);
  last = now;
  clock += dt;
  if (dt > 0) fps = fps * 0.9 + (1000 / dt) * 0.1;

  if (state === "training" && player) stepTraining(dt);
  if (state === "menu" || state === "characters") {
    preview.update(dt, clock, PREVIEW_OPP, { move: 0, block: false, run: false, jump: false });
  }
  render();
  requestAnimationFrame(frame);
}

// ---- Wiring (attached once) ----------------------------------------------

function init() {
  document.querySelectorAll("[data-go]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.dataset.go === "play") {
        $("#notice").textContent = "ONLINE PLAY IS NOT AVAILABLE IN THIS BUILD.";
        return;
      }
      go(btn.dataset.go);
    })
  );
  document.querySelectorAll("[data-back]").forEach((btn) =>
    btn.addEventListener("click", () => go("menu"))
  );

  $("#confirm-character").addEventListener("click", () => {
    prefs.character = pendingCharacter;
    savePrefs(prefs);
    preview = makeFighter(480, 1, "preview");
    preview.lockFacing = true;
    go("menu");
  });

  $("#show-fps").addEventListener("change", (e) => {
    prefs.showFps = e.target.checked;
    savePrefs(prefs);
  });

  $("#show-hitboxes").addEventListener("change", (e) => { showHitboxes = e.target.checked; });
  $("#reset-dummy").addEventListener("click", () => dummy?.reset(640));
  $("#reset-position").addEventListener("click", () => player?.reset(300));

  preview = makeFighter(480, 1, "preview");
  preview.lockFacing = true;
  go("menu");
  requestAnimationFrame(frame);
}

init();
