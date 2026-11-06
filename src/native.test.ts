import { describe, expect, it } from "vitest";
import { canBuy, haptic, impactFor, inApp } from "./native";

describe("the iPhone app's extras", () => {
  it("stay off outside the app", () => {
    expect(inApp()).toBe(false);
    // No haptics plugin on the web, so the game falls back to the browser's own vibration.
    expect(haptic(12)).toBe(false);
  });

  it("turns a buzz length into a tap strength", () => {
    expect(impactFor(8)).toBe("Light");
    expect(impactFor(12)).toBe("Light");
    expect(impactFor(15)).toBe("Medium");
    expect(impactFor(18)).toBe("Medium");
    expect(impactFor(30)).toBe("Heavy");
  });

  it("sells nothing until in-app purchases are built", () => {
    expect(canBuy()).toBe(false);
  });
});
