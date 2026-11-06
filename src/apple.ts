// Apple in-app purchase for the full game, inside the iPhone and iPad app only. It talks to StoreKit through
// cordova-plugin-purchase (the plugin Capacitor's own guide uses), which the app's build picks up from package.json
// when `npm run ios:sync` runs. The plugin's code is only on the page inside the app, so on the web none of this runs.
//
// The full game is one non-consumable product. Its id must match the product made in App Store Connect (PAYMENTS.md).
// There is no server: StoreKit's own record on the device says who owns it, and Restore asks Apple again.

import type { BuyResult, Shop } from "./payments";

/** The product's id in App Store Connect. Change it here if you name it differently there. */
export const PRODUCT_ID = "com.trueaigaming.aurorasworld.fullgame";

/** How long to wait for Apple's answer after the buy sheet closes before calling it pending (Ask to Buy, slow network). */
const ANSWER_MS = 90_000;

// The few parts of the plugin's API this file uses (its full types are in node_modules/cordova-plugin-purchase).
interface CdvError {
  isError: true;
  code: number;
  message: string;
}
interface CdvTransaction {
  products: { id: string }[];
  finish(): Promise<void>;
}
interface CdvOffer {
  id: string;
}
interface CdvProduct {
  id: string;
  owned: boolean;
  canPurchase: boolean;
  pricing?: { price: string };
  getOffer(id?: string): CdvOffer | undefined;
}
interface CdvWhen {
  approved(cb: (t: CdvTransaction) => void): CdvWhen;
  finished(cb: (t: CdvTransaction) => void): CdvWhen;
  receiptUpdated(cb: () => void): CdvWhen;
  productUpdated(cb: (p: CdvProduct) => void): CdvWhen;
}
interface CdvStore {
  register(p: { id: string; type: string; platform: string }): void;
  initialize(platforms: string[]): Promise<CdvError[]>;
  when(): CdvWhen;
  get(id: string, platform?: string): CdvProduct | undefined;
  owned(id: string): boolean;
  order(offer: CdvOffer): Promise<CdvError | undefined>;
  restorePurchases(): Promise<CdvError | undefined>;
}
interface Cdv {
  store: CdvStore;
  Platform: { APPLE_APPSTORE: string };
  ProductType: { NON_CONSUMABLE: string };
  ErrorCode: { PAYMENT_CANCELLED: number };
}

const ours = (t: CdvTransaction): boolean => t.products.some((p) => p.id === PRODUCT_ID);

/** The plugin, once the app has loaded it (it arrives with Cordova's deviceready), or null if it never does. */
function plugin(): Promise<Cdv | null> {
  const get = () => (window as unknown as { CdvPurchase?: Cdv }).CdvPurchase ?? null;
  if (get()) return Promise.resolve(get());
  return new Promise((resolve) => {
    const done = () => resolve(get());
    document.addEventListener("deviceready", done, { once: true });
    window.setTimeout(done, 5000);
  });
}

/** Called whenever StoreKit says the full game is owned: a purchase, an approved Ask to Buy, a restore. */
const owners = new Set<() => void>();
let started: Promise<Cdv | null> | null = null;

function start(): Promise<Cdv | null> {
  started ??= (async () => {
    const cdv = await plugin();
    if (!cdv) return null;
    const { store } = cdv;
    const tell = () => {
      if (store.owned(PRODUCT_ID)) for (const f of owners) f();
    };
    store.register({ id: PRODUCT_ID, type: cdv.ProductType.NON_CONSUMABLE, platform: cdv.Platform.APPLE_APPSTORE });
    store
      .when()
      // Nothing to deliver from a server: the unlock is kept on the device as soon as Apple approves it.
      .approved((t) => {
        if (ours(t)) void t.finish();
      })
      .finished((t) => {
        if (ours(t)) for (const f of owners) f();
      })
      .receiptUpdated(tell);
    try {
      await store.initialize([cdv.Platform.APPLE_APPSTORE]);
    } catch {
      // The store didn't answer; ready() says not ready and the screen shows "Coming soon".
    }
    return cdv;
  })();
  return started;
}

/** Waits for StoreKit to say the full game is owned, up to `ms`. */
function ownedWithin(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const f = () => {
      owners.delete(f);
      window.clearTimeout(timer);
      resolve(true);
    };
    const timer = window.setTimeout(() => {
      owners.delete(f);
      resolve(false);
    }, ms);
    owners.add(f);
  });
}

export const appleShop: Shop = {
  async ready() {
    const cdv = await start();
    const p = cdv?.store.get(PRODUCT_ID, cdv.Platform.APPLE_APPSTORE);
    return !!p && (p.canPurchase || p.owned);
  },
  async price() {
    const cdv = await start();
    return cdv?.store.get(PRODUCT_ID, cdv.Platform.APPLE_APPSTORE)?.pricing?.price ?? null;
  },
  async buy(): Promise<BuyResult> {
    const cdv = await start();
    const p = cdv?.store.get(PRODUCT_ID, cdv.Platform.APPLE_APPSTORE);
    if (!cdv || !p) return { ok: false, why: "not-ready" };
    if (p.owned) return { ok: true, how: "apple" };
    const offer = p.getOffer();
    if (!offer) return { ok: false, why: "not-ready" };
    const answer = ownedWithin(ANSWER_MS);
    const err = await cdv.store.order(offer);
    if (err) return { ok: false, why: err.code === cdv.ErrorCode.PAYMENT_CANCELLED ? "cancelled" : "failed" };
    // With Ask to Buy, a parent approves on their own phone, maybe much later. watchApple() opens the game then.
    return (await answer) || cdv.store.owned(PRODUCT_ID) ? { ok: true, how: "apple" } : { ok: false, why: "pending" };
  },
  async restore(): Promise<BuyResult> {
    const cdv = await start();
    if (!cdv) return { ok: false, why: "not-ready" };
    const answer = ownedWithin(4000);
    const err = await cdv.store.restorePurchases();
    if (err) return { ok: false, why: "failed" };
    return cdv.store.owned(PRODUCT_ID) || (await answer) ? { ok: true, how: "apple" } : { ok: false, why: "none" };
  },
};

/**
 * Starts StoreKit when the app opens and calls `onOwned` whenever it says the full game is owned, so a purchase that
 * finishes later (an approved Ask to Buy, one interrupted by closing the app) still opens the game.
 */
export function watchApple(onOwned: () => void): void {
  owners.add(onOwned);
  void start();
}
