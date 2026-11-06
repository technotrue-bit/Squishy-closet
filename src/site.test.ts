import { describe, expect, it } from "vitest";
import { SITE_HOME, siteHome } from "./site";

describe("leave game", () => {
  it("goes home to the TrueAIGaming page the game is played in", () => {
    expect(siteHome("https://trueaigaming.com", "")).toBe("https://trueaigaming.com/");
    expect(siteHome("https://www.trueaigaming.com", "")).toBe("https://www.trueaigaming.com/");
  });

  it("stays on a preview build's own site", () => {
    expect(siteHome("https://trueaigaming-abc123-true-team2.vercel.app", "")).toBe("https://trueaigaming-abc123-true-team2.vercel.app/");
  });

  it("falls back to the page the game came from when the browser won't say who framed it", () => {
    expect(siteHome(undefined, "https://trueaigaming.com/play.html?id=squishy-closet")).toBe("https://trueaigaming.com/");
  });

  it("never sends a kid to any other page", () => {
    expect(siteHome("https://evil.example", "https://evil.example/x")).toBe(SITE_HOME);
    expect(siteHome(undefined, "")).toBe(SITE_HOME);
    expect(siteHome("not a url", "also not")).toBe(SITE_HOME);
  });
});
