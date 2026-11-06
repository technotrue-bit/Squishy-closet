import { beforeAll, describe, expect, it } from "vitest";

// A stand-in for cordova-plugin-purchase as the app would have it, so the purchase steps can be checked off a phone.
const CANCELLED = 6777006;
const fake = {
  owned: false,
  next: "ok" as "ok" | "cancel" | "fail" | "ask",
  restoreHas: false,
  approved: [] as ((t: unknown) => void)[],
  finished: [] as ((t: unknown) => void)[],
  receipt: [] as (() => void)[],
  finishedCount: 0,
};
const tx = {
  products: [{ id: "com.trueaigaming.aurorasworld.fullgame" }],
  finish: async () => {
    fake.finishedCount++;
    fake.owned = true;
    for (const f of fake.finished) f(tx);
  },
};
const product = {
  id: "com.trueaigaming.aurorasworld.fullgame",
  get owned() {
    return fake.owned;
  },
  canPurchase: true,
  pricing: { price: "$4.99" },
  getOffer: () => ({ id: "o" }),
};
const store = {
  register: () => {},
  initialize: async () => [],
  when() {
    const w = {
      approved: (cb: (t: unknown) => void) => (fake.approved.push(cb), w),
      finished: (cb: (t: unknown) => void) => (fake.finished.push(cb), w),
      receiptUpdated: (cb: () => void) => (fake.receipt.push(cb), w),
      productUpdated: () => w,
    };
    return w;
  },
  get: (id: string) => (id === product.id ? product : undefined),
  owned: () => fake.owned,
  async order() {
    if (fake.next === "cancel") return { isError: true, code: CANCELLED, message: "cancelled" };
    if (fake.next === "fail") return { isError: true, code: 1, message: "nope" };
    if (fake.next === "ok") setTimeout(() => fake.approved.forEach((f) => f(tx)), 5);
    return undefined;
  },
  async restorePurchases() {
    if (fake.restoreHas) setTimeout(() => fake.approved.forEach((f) => f(tx)), 5);
    return undefined;
  },
};

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { CdvPurchase: { store, Platform: { APPLE_APPSTORE: "ios-appstore" }, ProductType: { NON_CONSUMABLE: "non consumable" }, ErrorCode: { PAYMENT_CANCELLED: CANCELLED } }, setTimeout, clearTimeout };
  g.document = { addEventListener: () => {} };
});

describe("Apple in-app purchase", () => {
  it("shows Apple's price once the store has the product", async () => {
    const { appleShop } = await import("./apple");
    expect(await appleShop.ready()).toBe(true);
    expect(await appleShop.price()).toBe("$4.99");
  });

  it("says when the buyer closes Apple's sheet, and when it fails", async () => {
    const { appleShop } = await import("./apple");
    fake.next = "cancel";
    expect(await appleShop.buy()).toEqual({ ok: false, why: "cancelled" });
    fake.next = "fail";
    expect(await appleShop.buy()).toEqual({ ok: false, why: "failed" });
  });

  it("finds no earlier purchase when there isn't one", async () => {
    const { appleShop } = await import("./apple");
    expect(await appleShop.restore()).toEqual({ ok: false, why: "none" });
  });

  it("unlocks once Apple approves, finishing the transaction, and tells the game", async () => {
    const { appleShop, watchApple } = await import("./apple");
    let told = 0;
    watchApple(() => told++);
    fake.next = "ok";
    expect(await appleShop.buy()).toEqual({ ok: true, how: "apple" });
    expect(fake.finishedCount).toBe(1);
    expect(told).toBeGreaterThan(0);
    expect(await appleShop.buy()).toEqual({ ok: true, how: "apple" });
  });

  it("restores a purchase made before", async () => {
    const { appleShop } = await import("./apple");
    fake.owned = false;
    fake.restoreHas = true;
    expect(await appleShop.restore()).toEqual({ ok: true, how: "apple" });
  });
});
