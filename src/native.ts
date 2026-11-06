// The iPhone and iPad app (Capacitor, see BUILD-IOS.md). The app plays the same game the site does, from files built
// into the app. Everything here only runs inside the app: on the web, inApp() is false and none of the app's plugins
// are even downloaded.
//
// What the app adds:
// - Taps you can feel. iPhone Safari has no vibration at all, so squishes and buttons give a light tap in the app.
// - A second copy of the save in the app's own settings store, so a squishy is never lost if iOS clears web storage.
//
// Not built yet, and needed before some App Store choices:
// - In-app purchases: the site's Ko-fi tip link sits on the site's play page around the game, never inside the game,
//   so the app has no outside payment link to hide. A tip jar or extras in the app must use Apple's in-app purchases
//   (and, in the Kids category, sit behind a grown-up check). Hook it in where canBuy() is checked.
// - Sign in with Apple and deleting an account in the app: only needed if the app ever offers the site's accounts or
//   cloud saves. Today the app has neither; the save stays on the device.

import { fill, PREFIX, watchWrites } from "./mirror";

type ImpactStyleName = "Light" | "Medium" | "Heavy";
type HapticsModule = typeof import("@capacitor/haptics");

let haptics: HapticsModule | null = null;

/** True inside the iPhone and iPad app. Capacitor puts its bridge on the page before any of the game's code runs. */
export function inApp(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** In-app purchases are not built yet. Nothing in the app may sell or link to a payment page until they are. */
export function canBuy(): boolean {
  return false;
}

/** How strong a tap feels for a buzz the game asks for in milliseconds. Short buzzes are light, longer ones firmer. */
export function impactFor(ms: number): ImpactStyleName {
  if (ms >= 25) return "Heavy";
  if (ms >= 15) return "Medium";
  return "Light";
}

/** A tap you can feel. Returns false when the app's haptics aren't there (on the web), so the caller can try another way. */
export function haptic(ms: number): boolean {
  if (!haptics) return false;
  const { Haptics, ImpactStyle } = haptics;
  void Haptics.impact({ style: ImpactStyle[impactFor(ms)] }).catch(() => {});
  return true;
}

/** Starts the app's extras before the game reads its save. Never throws: the game starts either way. */
export async function startNative(): Promise<void> {
  try {
    haptics = await import("@capacitor/haptics");
    // Every button gives a light tap as a finger lands on it.
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.target instanceof Element && e.target.closest("button")) haptic(8);
      },
      { capture: true, passive: true },
    );
  } catch {
    haptics = null;
  }
  try {
    await keepSaveInApp();
  } catch {
    // Without the app's copy the game still starts, with what the web view kept.
  }
}

/**
 * Keeps every squishycloset.* key in the app's own settings store as well as web storage. Before the game starts the
 * app's copy is put back (the save is combined, so nothing is lost either way); after that every write goes to both.
 */
async function keepSaveInApp(): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  const store = window.localStorage;
  const { keys } = await Preferences.keys();
  const copy: Record<string, string> = {};
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const { value } = await Preferences.get({ key });
    if (value !== null) copy[key] = value;
  }
  fill(store, copy);
  const send = (key: string, value: string | null) => {
    if (!key.startsWith(PREFIX)) return;
    void (value === null ? Preferences.remove({ key }) : Preferences.set({ key, value })).catch(() => {});
  };
  watchWrites(store, false, send);
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    const value = key === null ? null : store.getItem(key);
    if (key && value !== null && copy[key] !== value) send(key, value);
  }
}
