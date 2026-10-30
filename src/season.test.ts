import { describe, expect, it } from "vitest";
import { dateFromQuery, isHalloween, isSpookySeason, sleepsToHalloween } from "./season";
import { freshSave, halloweenBox, parseSave, spookyFromLove } from "./save";

describe("Halloween", () => {
  const oct30 = new Date(2026, 9, 30, 18, 0);
  const oct31 = new Date(2026, 9, 31, 9, 30);
  const nov1 = new Date(2026, 10, 1, 9, 30);

  it("is spooky all October, and Halloween on the 31st", () => {
    expect(isSpookySeason(new Date(2026, 9, 1))).toBe(true);
    expect(isSpookySeason(nov1)).toBe(false);
    expect(isHalloween(oct30)).toBe(false);
    expect(isHalloween(oct31)).toBe(true);
    expect(isHalloween(nov1)).toBe(false);
  });

  it("counts the sleeps until Halloween", () => {
    expect(sleepsToHalloween(oct30)).toBe(1);
    expect(sleepsToHalloween(new Date(2026, 9, 24))).toBe(7);
    expect(sleepsToHalloween(oct31)).toBe(0);
    expect(sleepsToHalloween(new Date(2026, 8, 30))).toBe(0);
  });

  it("can be tried any day from the address", () => {
    const d = dateFromQuery("?date=2026-10-31", oct30);
    expect(d && isHalloween(d)).toBe(true);
    expect(d?.getHours()).toBe(18);
    expect(dateFromQuery("?id=x&date=2025-12-24&y=1", oct30)?.getFullYear()).toBe(2025);
    expect(dateFromQuery("?date=2026-02-31", oct30)).toBeNull();
    expect(dateFromQuery("?date=soon", oct30)).toBeNull();
    expect(dateFromQuery("", oct30)).toBeNull();
  });

  it("gives one Spooky Box on Halloween each year", () => {
    const s = freshSave();
    expect(halloweenBox(s, oct30)).toBe(false);
    expect(halloweenBox(s, oct31)).toBe(true);
    expect(halloweenBox(s, oct31)).toBe(false);
    expect(s.spookyBoxes).toBe(1);
    expect(halloweenBox(s, new Date(2027, 9, 31))).toBe(true);
    expect(s.spookyBoxes).toBe(2);
  });

  it("turns boxes earned with love into Spooky Boxes on Halloween only", () => {
    const s = freshSave();
    s.boxes = 3;
    expect(spookyFromLove(s, 1, oct30)).toBe(0);
    expect(spookyFromLove(s, 2, oct31)).toBe(2);
    expect(s.boxes).toBe(1);
    expect(s.spookyBoxes).toBe(2);
  });

  it("keeps Spooky Boxes and baths in the save", () => {
    const s = parseSave(JSON.stringify({ v: 6, spookyBoxes: 2, spookyYear: 2026, baths: 4, owned: {} }));
    expect([s.spookyBoxes, s.spookyYear, s.baths]).toEqual([2, 2026, 4]);
    expect(parseSave(JSON.stringify({ v: 5, spookyBoxes: -3, owned: {} })).spookyBoxes).toBe(0);
  });
});
