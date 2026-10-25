import { describe, expect, it } from "vitest";
import { addLove, cleanName, collect, freshSave, nameOf, parseSave, SAVE_VERSION } from "./save";

describe("save", () => {
  it("starts fresh when there is nothing saved or it is broken", () => {
    expect(parseSave(null)).toEqual(freshSave());
    expect(parseSave("{not json")).toEqual(freshSave());
    expect(parseSave("42")).toEqual(freshSave());
    expect(parseSave("[1,2]")).toEqual(freshSave());
  });

  it("upgrades a test build save, keeping sound and love", () => {
    const s = parseSave(JSON.stringify({ v: 1, look: "gold", love: 55, level: 3, sound: false, tried: ["tap", 7] }));
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.sound).toBe(false);
    expect(s.love).toBe(55);
    expect(s.tried).toEqual(["tap"]);
    expect(s.owned).toEqual({});
    expect(s.active).toBeNull();
  });

  it("keeps squishies it knows and drops ones it doesn't", () => {
    const s = parseSave(
      JSON.stringify({
        v: 2,
        owned: { "bao-rosy-matte": { got: 5, name: "Bun<b>bun" }, "not-a-squishy": { got: 1 } },
        active: "not-a-squishy",
        boxes: 2,
        stars: 10,
        tutorial: "done",
      }),
    );
    expect(Object.keys(s.owned)).toEqual(["bao-rosy-matte"]);
    expect(s.owned["bao-rosy-matte"].name).toBe("Bunbbun");
    expect(s.active).toBe("bao-rosy-matte");
    expect(s.boxes).toBe(2);
    expect(s.tutorial).toBe("done");
  });

  it("earns a box every 100 love", () => {
    const s = freshSave();
    expect(addLove(s, 60)).toBe(0);
    expect(addLove(s, 60)).toBe(1);
    expect(s.boxes).toBe(1);
    expect(s.love).toBe(20);
  });

  it("collects new squishies and turns repeats into stars", () => {
    const s = freshSave();
    expect(collect(s, "bao-rosy-matte", 1).isNew).toBe(true);
    expect(collect(s, "bao-rosy-matte", 2)).toEqual({ isNew: false, stars: 5 });
    expect(s.stars).toBe(5);
    expect(nameOf(s, "bao-rosy-matte")).toBe("Rosy Bao");
    s.owned["bao-rosy-matte"].name = "Puff";
    expect(nameOf(s, "bao-rosy-matte")).toBe("Puff");
  });

  it("cleans names", () => {
    expect(cleanName("  Mr Squish  ")).toBe("Mr Squish");
    expect(cleanName("a".repeat(40)).length).toBe(14);
  });
});
