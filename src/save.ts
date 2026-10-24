// Progress lives only on this device. The version number lets later updates
// carry every kid's squishies forward.

export const SAVE_KEY = "squishycloset.save";
export const SAVE_VERSION = 1;

export interface Save {
  v: number;
  look: string;
  love: number; // 0..100 toward the next level
  level: number;
  sound: boolean;
  tried: string[]; // starter actions done at least once
}

export const freshSave = (): Save => ({ v: SAVE_VERSION, look: "rosy", love: 0, level: 1, sound: true, tried: [] });

export function parseSave(raw: string | null): Save {
  const base = freshSave();
  if (!raw) return base;
  try {
    const s = JSON.parse(raw) as Partial<Save>;
    if (typeof s !== "object" || s === null) return base;
    return {
      v: SAVE_VERSION,
      look: typeof s.look === "string" ? s.look : base.look,
      love: typeof s.love === "number" && s.love >= 0 && s.love < 100 ? s.love : 0,
      level: typeof s.level === "number" && s.level >= 1 ? Math.floor(s.level) : 1,
      sound: typeof s.sound === "boolean" ? s.sound : true,
      tried: Array.isArray(s.tried) ? s.tried.filter((t): t is string => typeof t === "string") : [],
    };
  } catch {
    return base;
  }
}

export function loadSave(): Save {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return freshSave();
  }
}

export function storeSave(s: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // private mode or storage full: play on without saving
  }
}

/** Adds love; returns how many levels were gained. */
export function addLove(s: Save, amount: number): number {
  s.love += amount;
  let ups = 0;
  while (s.love >= 100) {
    s.love -= 100;
    s.level += 1;
    ups++;
  }
  return ups;
}
