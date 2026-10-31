// Buying the full game. One shape for every way to pay: Apple's in-app purchase inside the iPhone and iPad app
// (apple.ts). The website sells nothing and locks nothing (see unlock.ts); preview builds offer a test unlock instead.

import { appleShop } from "./apple";
import { inApp } from "./native";
import { TEST_BUILD, type UnlockHow } from "./unlock";

/** "pending": Apple is waiting on a grown-up's approval (Ask to Buy); the game opens when it comes. */
export type BuyResult = { ok: true; how: UnlockHow } | { ok: false; why: "cancelled" | "not-ready" | "failed" | "none" | "pending" };

export interface Shop {
  /** Can it sell right now (the store answered and the product exists)? */
  ready(): Promise<boolean>;
  /** The price as the store shows it, in the buyer's own money ("$4.99"), or null when it doesn't know. */
  price(): Promise<string | null>;
  buy(): Promise<BuyResult>;
  /** Finds a purchase made before (another phone, a reinstall). "none" when there isn't one. */
  restore(): Promise<BuyResult>;
}

/** No payment hooked up: nothing to sell, nothing to restore. */
export const notReady: Shop = {
  ready: async () => false,
  price: async () => null,
  buy: async () => ({ ok: false, why: "not-ready" }),
  restore: async () => ({ ok: false, why: "not-ready" }),
};

/** The shop for where the game is running: Apple in the app, nothing on the website. */
export function shop(): Shop {
  return inApp() ? appleShop : notReady;
}

/** Only in preview builds: unlocks straight away, so the unlock screen can be tried end to end. */
export const testShop: Shop | null = TEST_BUILD
  ? {
      ready: async () => true,
      price: async () => null,
      buy: async () => ({ ok: true, how: "test" }),
      restore: async () => ({ ok: false, why: "none" }),
    }
  : null;
