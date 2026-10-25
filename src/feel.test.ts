import { describe, expect, it } from "vitest";
import { feelFor, feelWord } from "./feel";

describe("feel", () => {
  it("softer squishies sink deeper, rise slower and wobble more", () => {
    const firm = feelFor(0);
    const soft = feelFor(1);
    expect(soft.dentMax).toBeGreaterThan(firm.dentMax * 2);
    expect(soft.riseK).toBeLessThan(firm.riseK / 5);
    expect(soft.riseTime).toBeGreaterThan(firm.riseTime * 5);
    expect(soft.bodyC).toBeLessThan(firm.bodyC);
  });

  it("blends in between and clamps outside 0..1", () => {
    const mid = feelFor(0.5);
    expect(mid.dentMax).toBeCloseTo((feelFor(0).dentMax + feelFor(1).dentMax) / 2);
    expect(feelFor(-3)).toEqual(feelFor(0));
    expect(feelFor(9)).toEqual(feelFor(1));
  });

  it("has a word for every feel", () => {
    expect(feelWord(1)).toBe("Super soft!");
    expect(feelWord(0)).toBe("Firm");
    expect(feelWord(0.55)).toBe("Squishy");
  });
});
