// Preferences only. Nothing authoritative (health, rooms, results) is stored here.
import { CHARACTERS, DEFAULT_CHARACTER } from "./registry.js";

const KEY = "stickfight.prefs.v1";
const DEFAULTS = { character: DEFAULT_CHARACTER, showFps: false };

export function loadPrefs() {
  try {
    const p = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    if (!CHARACTERS[p.character]) p.character = DEFAULT_CHARACTER;
    return p;
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode, quota). The game keeps running with in-memory settings.
  }
}
