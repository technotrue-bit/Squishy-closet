// Buying the full game. One shape for every way to pay, so hooking up a real one only means filling in a Shop:
// Apple's in-app purchase inside the iPhone and iPad app, and a web payment on the site. None is hooked up yet
// (PAYMENTS.md has the choices). Until one is, nothing can be bought: the live game shows no locks (see unlock.ts),
// and preview builds offer a test unlock instead.

import { inApp } from "./native";
import { TEST_BUILD, type UnlockHow } from "./unlock";

export type BuyResult = { ok: true; how: UnlockHow } | { ok: false; why: "cancelled" | "not-ready" | "failed" | "none" };

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

/**
 * Apple in-app purchase, for the app. To hook up: add a StoreKit plugin (PAYMENTS.md), create the non-consumable
 * product in App Store Connect, and fill these in. Kept as notReady until then.
 */
const apple: Shop = notReady;

/** A web payment, for the site. To hook up: see PAYMENTS.md. Kept as notReady until then. */
const web: Shop = notReady;

/** The shop for where the game is running. */
export function shop(): Shop {
  return inApp() ? apple : web;
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
