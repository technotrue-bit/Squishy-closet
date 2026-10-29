import { describe, expect, it } from "vitest";
import qrcode from "qrcode-generator";
import { CATALOG } from "./catalog";
import { HATS } from "./hats";
import { decodeGift, encodeGift, findGift, INBOX_MAX, makeGift, openGift, receiveGift, REPEAT_STARS, sentGift } from "./gift";
import { combineSaves, findCode, moveLink } from "./move";
import { freshSave, parseSave } from "./save";

const def = CATALOG[5];
const hat = HATS[3].id;

function sender() {
  const s = freshSave();
  s.owned[def.id] = { got: 1, mood: "silly", name: "Mr Bun", hat };
  s.hats = [hat];
  return s;
}

describe("squishy mail", () => {
  it("round trips a gift and carries no name", () => {
    const g = makeGift(sender(), def.id)!;
    const code = encodeGift(g);
    expect(code.startsWith("g1")).toBe(true);
    expect(decodeGift(code)).toEqual(g);
    expect(JSON.stringify(decodeGift(code))).not.toContain("Mr Bun");
    expect(atob(code.slice(2).replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("Mr Bun");
  });

  it("only gifts squishies you have", () => {
    expect(makeGift(freshSave(), def.id)).toBeNull();
  });

  it("makes a short link and a small QR code", () => {
    const link = moveLink(encodeGift(makeGift(sender(), def.id)!), { origin: "https://squishy-closet.vercel.app", pathname: "/" }, "", false);
    const qr = qrcode(0, "L");
    qr.addData(link);
    qr.make();
    expect(link.length).toBeLessThan(200);
    expect(qr.getModuleCount()).toBeLessThanOrEqual(41);
  });

  it("finds a gift in a link or pasted text, and never mixes it up with a move code", () => {
    const code = encodeGift(makeGift(sender(), def.id)!);
    expect(findGift(`https://trueaigaming.com/play.html?id=squishy-closet#move=${code}`)).toBe(code);
    expect(findGift(` ${code} `)).toBe(code);
    expect(findCode(`#move=${code}`)).toBeNull();
    expect(findGift("#move=a1abcdefghijkl")).toBeNull();
    expect(decodeGift("g1!!!!")).toBeNull();
    expect(decodeGift("g1" + btoa(JSON.stringify({ i: "nope", k: "abcdefgh" })))).toBeNull();
    expect(decodeGift("g1" + btoa(JSON.stringify({ i: def.id, k: "<script>" })))).toBeNull();
  });

  it("drops a hat or personality that isn't real", () => {
    const g = decodeGift("g1" + btoa(JSON.stringify({ i: def.id, m: "evil", h: "crown-of-doom", k: "abcdefgh" })))!;
    expect(g.hat).toBeUndefined();
    expect(g.mood).toMatch(/^[a-z]+$/);
  });

  it("puts a gift in the inbox once, and knows your own", () => {
    const from = sender();
    const g = makeGift(from, def.id)!;
    sentGift(from, g);
    expect(receiveGift(from, g)).toBe("own");
    const to = freshSave();
    expect(receiveGift(to, g)).toBe("inbox");
    expect(receiveGift(to, g)).toBe("again");
    openGift(to, 5);
    expect(receiveGift(to, g)).toBe("again");
    for (let i = 0; i < INBOX_MAX; i++) receiveGift(to, { ...g, key: `key${i}abc` });
    expect(receiveGift(to, { ...g, key: "onemoreabc" })).toBe("full");
  });

  it("opens a gift into the collection, wearing its hat", () => {
    const to = freshSave();
    receiveGift(to, makeGift(sender(), def.id)!);
    const got = openGift(to, 9)!;
    expect(got.isNew).toBe(true);
    expect(got.newHat).toBe(hat);
    expect(to.owned[def.id]).toEqual({ got: 9, mood: "silly", hat });
    expect(to.hats).toContain(hat);
    expect(to.inbox).toEqual([]);
    expect(openGift(to, 10)).toBeNull();
  });

  it("gives stars for one you have already", () => {
    const to = sender();
    receiveGift(to, { id: def.id, mood: "calm", key: "abcdefgh12" });
    const got = openGift(to, 9)!;
    expect(got.isNew).toBe(false);
    expect(to.stars).toBe(REPEAT_STARS);
    expect(to.owned[def.id].mood).toBe("silly");
  });

  it("keeps the inbox through a save, a bad save and a move", () => {
    const s = freshSave();
    receiveGift(s, makeGift(sender(), def.id)!);
    const back = parseSave(JSON.stringify(s));
    expect(back.inbox).toEqual(s.inbox);
    expect(back.giftsGot).toEqual(s.giftsGot);
    const bad = parseSave(JSON.stringify({ ...s, inbox: [{ id: "nope", key: "abcdefgh" }, "x", null] }));
    expect(bad.inbox).toEqual([]);
    expect(combineSaves(freshSave(), s).save.inbox).toEqual(s.inbox);
  });
});
