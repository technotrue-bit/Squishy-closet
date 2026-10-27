import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { freshSave, parseSave, SAVE_KEY, type Save } from "./save";
import { fill } from "./mirror";
import { isSite } from "./site";

function memStore(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function withSquishies(ids: string[]): Save {
  const s = freshSave();
  for (const id of ids) s.owned[id] = { got: 1, mood: "bouncy" };
  s.active = ids[0] ?? null;
  s.tutorial = "done";
  return parseSave(JSON.stringify(s));
}

describe("the play page's copy of the save", () => {
  it("brings the save back after Safari wiped the game's storage", () => {
    const s = withSquishies([CATALOG[0].id, CATALOG[1].id]);
    const store = memStore();
    fill(store, { [SAVE_KEY]: JSON.stringify(s) });
    expect(parseSave(store.getItem(SAVE_KEY))).toEqual(s);
  });

  it("combines the two when the game still has its own save, so nothing is lost", () => {
    const store = memStore({ [SAVE_KEY]: JSON.stringify(withSquishies([CATALOG[0].id])) });
    fill(store, { [SAVE_KEY]: JSON.stringify(withSquishies([CATALOG[0].id, CATALOG[2].id])) });
    const s = parseSave(store.getItem(SAVE_KEY));
    expect(Object.keys(s.owned).sort()).toEqual([CATALOG[0].id, CATALOG[2].id].sort());
  });

  it("ignores keys that aren't the game's and anything that isn't a copy", () => {
    const store = memStore();
    fill(store, { "flagcatch.progress": "{}", [SAVE_KEY]: 5 });
    fill(store, null);
    fill(store, ["x"]);
    expect(store.data.size).toBe(0);
  });

  it("only trusts TrueAIGaming and its previews", () => {
    expect(isSite("https://trueaigaming.com")).toBe(true);
    expect(isSite("https://www.trueaigaming.com")).toBe(true);
    expect(isSite("https://trueaigaming-git-x-true-team2.vercel.app")).toBe(true);
    expect(isSite("https://trueaigaming.com.evil.example")).toBe(false);
    expect(isSite("https://evil.example")).toBe(false);
  });
});
