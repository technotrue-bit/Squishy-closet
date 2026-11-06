import { describe, expect, it } from "vitest";
import { CARE_AGAIN_LOVE, CARE_IDS, CARE_LOVE, careGame, cleanCare, combineCare, dayKey, doCare, doneToday, leftToday, PRESENT_STARS, playFor } from "./care";
import { freshSave, parseSave } from "./save";
import { COOKIES_MAX } from "./babies";

const day1 = new Date(2026, 10, 3, 9, 0);
const day1late = new Date(2026, 10, 3, 23, 59);
const day2 = new Date(2026, 10, 4, 0, 1);

describe("daily care", () => {
  it("starts with all four to do", () => {
    const s = freshSave();
    expect(doneToday(s.care, day1)).toEqual([]);
    expect(leftToday(s.care, day1)).toBe(4);
  });

  it("counts each one once a day and gives love", () => {
    const s = freshSave();
    expect(doCare(s, "feed", day1)).toEqual({ first: true, love: CARE_LOVE, present: false });
    expect(leftToday(s.care, day1late)).toBe(3);
    expect(doCare(s, "feed", day1late)).toEqual({ first: false, love: CARE_AGAIN_LOVE, present: false });
    expect(leftToday(s.care, day1late)).toBe(3);
  });

  it("the bath gives its own love, not more", () => {
    const s = freshSave();
    expect(doCare(s, "bath", day1).love).toBe(0);
    expect(doCare(s, "bath", day1).love).toBe(0);
  });

  it("gives the present once, for all four in a day", () => {
    const s = freshSave();
    const cookies = s.cookies;
    for (const id of ["feed", "bath", "nap"] as const) expect(doCare(s, id, day1).present).toBe(false);
    expect(doCare(s, "play", day1).present).toBe(true);
    expect(s.cookies).toBe(cookies + 1);
    expect(s.stars).toBe(PRESENT_STARS);
    expect(s.care.days).toBe(1);
    expect(leftToday(s.care, day1)).toBe(0);
    // Doing them again the same day gives no second present.
    for (const id of CARE_IDS) expect(doCare(s, id, day1late).present).toBe(false);
    expect(s.care.days).toBe(1);
    expect(s.stars).toBe(PRESENT_STARS);
  });

  it("a new day brings four fresh ones and takes nothing away", () => {
    const s = freshSave();
    for (const id of CARE_IDS) doCare(s, id, day1);
    expect(leftToday(s.care, day2)).toBe(4);
    expect(doCare(s, "nap", day2).first).toBe(true);
    expect(s.care.days).toBe(1);
    // Skipping days is fine: the count never goes down.
    const later = new Date(2026, 10, 20, 12);
    for (const id of CARE_IDS) doCare(s, id, later);
    expect(s.care.days).toBe(2);
  });

  it("never goes past the cookie jar", () => {
    const s = freshSave();
    s.cookies = COOKIES_MAX;
    for (const id of CARE_IDS) doCare(s, id, day1);
    expect(s.cookies).toBe(COOKIES_MAX);
    expect(s.stars).toBe(PRESENT_STARS);
  });

  it("uses the phone's own day", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("care saves", () => {
  it("old saves get fresh care", () => {
    const old = { ...freshSave() } as Record<string, unknown>;
    delete old.care;
    expect(parseSave(JSON.stringify(old)).care).toEqual({ day: "", done: [], days: 0 });
  });

  it("keeps care across a save and load", () => {
    const s = freshSave();
    doCare(s, "feed", day1);
    doCare(s, "nap", day1);
    const back = parseSave(JSON.stringify(s));
    expect(doneToday(back.care, day1)).toEqual(["feed", "nap"]);
  });

  it("cleans up bad care", () => {
    expect(cleanCare({ day: "nope", done: ["feed"], days: 3 })).toEqual({ day: "", done: [], days: 3 });
    expect(cleanCare({ day: "2026-11-03", done: ["feed", "feed", "dance", 4], days: -1 })).toEqual({ day: "2026-11-03", done: ["feed"], days: 0 });
    expect(cleanCare("x")).toEqual({ day: "", done: [], days: 0 });
  });

  it("puts two phones together", () => {
    const a = { day: "2026-11-03", done: ["feed" as const], days: 4 };
    const b = { day: "2026-11-03", done: ["nap" as const], days: 2 };
    expect(combineCare(a, b)).toEqual({ day: "2026-11-03", done: ["feed", "nap"], days: 4 });
    const c = { day: "2026-11-04", done: ["play" as const], days: 1 };
    expect(combineCare(a, c)).toEqual({ day: "2026-11-04", done: ["play"], days: 4 });
  });
});

describe("care games", () => {
  it("feeding drags snacks and naps are rocked", () => {
    expect(careGame("feed", "bouncy")?.play).toBe("feed");
    expect(careGame("nap", "bouncy")?.play).toBe("hold");
    expect(careGame("bath", "bouncy")).toBeNull();
  });

  it("play is its own favorite game, or a ball game", () => {
    expect(playFor("musical").title).toContain("Sing");
    expect(playFor("bouncy").play).toBe("bounce");
    for (const m of ["sweet", "sleepy", "cuddly", "curious", "sassy", "calm"] as const) expect(["pop", "bounce"]).toContain(playFor(m).play);
  });
});
