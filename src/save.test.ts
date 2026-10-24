import { describe, expect, it } from "vitest";
import { addLove, freshSave, parseSave } from "./save";

describe("save", () => {
  it("starts fresh when there is nothing saved or it is broken", () => {
    expect(parseSave(null)).toEqual(freshSave());
    expect(parseSave("{not json")).toEqual(freshSave());
    expect(parseSave("42")).toEqual(freshSave());
  });

  it("keeps good values and drops bad ones", () => {
    const s = parseSave(JSON.stringify({ look: "gold", love: 55, level: 3, sound: false, tried: ["tap", 7] }));
    expect(s).toEqual({ v: 1, look: "gold", love: 55, level: 3, sound: false, tried: ["tap"] });
    expect(parseSave(JSON.stringify({ love: 900, level: -2 })).level).toBe(1);
  });

  it("levels up every 100 love", () => {
    const s = freshSave();
    expect(addLove(s, 60)).toBe(0);
    expect(addLove(s, 60)).toBe(1);
    expect(s.level).toBe(2);
    expect(s.love).toBe(20);
  });
});
