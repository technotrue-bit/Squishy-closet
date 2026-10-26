import { describe, expect, it } from "vitest";
import qrcode from "qrcode-generator";
import { CATALOG } from "./catalog";
import { HATS } from "./hats";
import { newBaby } from "./babies";
import { freshSave, parseSave, type Save } from "./save";
import { combineSaves, decodeSave, encodeSave, findCode, moveLink } from "./move";

/** Every squishy, named, every hat, three babies: the biggest save a kid can have. */
function fullSave(): Save {
  const s = freshSave();
  CATALOG.forEach((d, i) => (s.owned[d.id] = { got: 1_760_000_000_000 + i * 86_400_000, mood: "bouncy", name: `Squishy ${i}`, hat: HATS[i % HATS.length].id }));
  s.hats = HATS.map((h) => h.id);
  s.active = CATALOG[0].id;
  s.team = CATALOG.slice(1, 4).map((d) => d.id);
  s.babies = [0, 1, 2].map((i) => ({ ...newBaby(CATALOG[i].id, 1_760_000_000_000 + i), name: `Baby ${i}` }));
  s.stars = 400;
  s.boxes = 3;
  s.tutorial = "done";
  return parseSave(JSON.stringify(s));
}

describe("move to a new phone", () => {
  it("round trips a full collection through a code", async () => {
    const s = fullSave();
    const code = await encodeSave(s);
    expect(code.startsWith("a1")).toBe(true);
    expect(await decodeSave(code)).toEqual(s);
  });

  it("makes a link short enough for one QR code a phone camera can read", async () => {
    const link = moveLink(await encodeSave(fullSave()), { origin: "https://squishy-closet.vercel.app", pathname: "/" }, "", false);
    const qr = qrcode(0, "L");
    qr.addData(link);
    qr.make();
    // Version 40 is 177 modules; stay well under it so the code shows big enough on a phone screen.
    console.log(`move link ${link.length} chars, QR ${qr.getModuleCount()} modules`);
    expect(qr.getModuleCount()).toBeLessThanOrEqual(141);
  });

  it("finds the code in a link or pasted text, and refuses anything else", async () => {
    const code = await encodeSave(fullSave());
    expect(findCode(`https://trueaigaming.com/play.html?id=squishy-closet#move=${code}`)).toBe(code);
    expect(findCode(`  ${code}\n`)).toBe(code);
    expect(findCode("hello")).toBeNull();
    expect(await decodeSave("a1!!!!notbase64")).toBeNull();
    expect(await decodeSave("a0" + btoa("[1,2]"))).toBeNull();
    expect(await decodeSave("zz" + code.slice(2))).toBeNull();
  });

  it("cleans a code like any save: unknown squishies and bad names go", async () => {
    const evil = { v: 4, owned: { "not-real": { got: 1 }, [CATALOG[0].id]: { got: 2, name: "<img src=x>Bob" } } };
    const code = "a0" + btoa(JSON.stringify(evil)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const s = await decodeSave(code);
    expect(Object.keys(s!.owned)).toEqual([CATALOG[0].id]);
    expect(s!.owned[CATALOG[0].id].name).toBe("img src=xBob");
  });

  it("only adds when bringing squishies in, and twice adds nothing more", () => {
    const mine = freshSave();
    mine.owned[CATALOG[0].id] = { got: 1, mood: "shy", name: "Mine" };
    mine.active = CATALOG[0].id;
    mine.stars = 50;
    mine.hats = [HATS[0].id];
    const other = fullSave();
    const { save, added } = combineSaves(mine, other);
    expect(added).toBe(CATALOG.length - 1);
    expect(save.owned[CATALOG[0].id].name).toBe("Mine");
    expect(save.active).toBe(CATALOG[0].id);
    expect(save.stars).toBe(400);
    expect(save.hats.length).toBe(HATS.length);
    expect(save.babies.length).toBe(3);
    const again = combineSaves(save, other);
    expect(again.added).toBe(0);
    expect(again.save).toEqual(save);
  });

  it("a new phone with nothing takes the whole collection, held squishy and team", () => {
    const other = fullSave();
    const { save } = combineSaves(freshSave(), other);
    expect(save.active).toBe(other.active);
    expect(save.team).toEqual(other.team);
    expect(Object.keys(save.owned).length).toBe(CATALOG.length);
  });

  it("links back to the play page only when framed by TrueAIGaming", () => {
    const here = { origin: "https://squishy-closet.vercel.app", pathname: "/" };
    expect(moveLink("a1abc", here, "https://trueaigaming.com/", true)).toBe("https://trueaigaming.com/play.html?id=squishy-closet#move=a1abc");
    expect(moveLink("a1abc", here, "https://evil.example/", true)).toBe("https://squishy-closet.vercel.app/#move=a1abc");
    expect(moveLink("a1abc", here, "https://trueaigaming.com/", false)).toBe("https://squishy-closet.vercel.app/#move=a1abc");
  });
});
