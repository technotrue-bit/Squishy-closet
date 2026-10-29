// Moving a kid's squishies to a new phone, with nothing kept on a server. The whole save is packed into a code
// (deflated JSON in base64url) that travels inside a link's #fragment: browsers never send the fragment to any
// server, so the save goes straight from one screen to the other, by QR code, share sheet or copy and paste.
// Bringing squishies in only ever adds: nothing this phone already has is lost.

import { BABIES_MAX, COOKIES_MAX } from "./babies";
import { LOVE_PER_BOX, parseSave, type Save } from "./save";
import { isSite } from "./site";

/** Starts every code, so a pasted link or a bare code both work and nothing else is mistaken for one. */
const DEFLATED = "a1";
const PLAIN = "a0";
/** Longest code accepted, about ten times a full collection. */
const MAX_CODE = 60_000;
export const HASH = "#move=";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The save as a code. Older browsers without CompressionStream make a longer, plain one. */
export async function encodeSave(s: Save): Promise<string> {
  // Which gift links came here only matters on this phone; a waiting gift travels, so it isn't lost.
  const { giftsGot, giftsSent, inbox, ...rest } = s;
  void giftsGot;
  void giftsSent;
  const json = new TextEncoder().encode(JSON.stringify(inbox.length ? { ...rest, inbox } : rest));
  if (typeof CompressionStream === "function") return DEFLATED + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
  return PLAIN + toBase64Url(json);
}

/** Finds the code in a link or in pasted text. */
export function findCode(text: string): string | null {
  const m = /(?:^|#move=|\s)(a[01][A-Za-z0-9_-]{8,})/.exec(text.trim());
  return m && m[1].length <= MAX_CODE ? m[1] : null;
}

/** A save from a code, cleaned like any save read from this phone, or null when the code is broken. */
export async function decodeSave(code: string): Promise<Save | null> {
  try {
    const body = fromBase64Url(code.slice(2));
    let json: Uint8Array;
    if (code.startsWith(DEFLATED)) {
      if (typeof DecompressionStream !== "function") return null;
      json = await pipe(body, new DecompressionStream("deflate-raw"));
    } else if (code.startsWith(PLAIN)) json = body;
    else return null;
    if (json.length > MAX_CODE * 20) return null;
    const text = new TextDecoder().decode(json);
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("owned" in parsed)) return null;
    return parseSave(text);
  } catch {
    return null;
  }
}

const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])];

/**
 * Adds `other` to `mine`: every squishy, hat and baby either phone has, and the bigger of each count, so a
 * collection brought in twice does not double. What this phone already has stays as it is (names, hats worn,
 * where it is playing). Returns the new save and how many squishies are new to this phone.
 */
export function combineSaves(mine: Save, other: Save): { save: Save; added: number } {
  const s: Save = structuredClone(mine);
  let added = 0;
  for (const [id, o] of Object.entries(other.owned)) {
    if (s.owned[id]) continue;
    s.owned[id] = { ...o };
    added++;
  }
  s.hats = union(s.hats, other.hats);
  s.tried = union(s.tried, other.tried);
  s.seen = union(s.seen, other.seen);
  s.tutorial = s.tutorial === "done" || other.tutorial === "done" ? "done" : union(s.tutorial, other.tutorial);
  s.love = Math.min(LOVE_PER_BOX - 1, Math.max(s.love, other.love));
  s.boxes = Math.max(s.boxes, other.boxes);
  s.stars = Math.max(s.stars, other.stars);
  s.cookies = Math.min(COOKIES_MAX, Math.max(s.cookies, other.cookies));
  for (const [place, n] of Object.entries(other.jobs)) s.jobs[place] = Math.max(s.jobs[place] ?? 0, n);
  for (const g of other.inbox) if (!s.inbox.some((x) => x.key === g.key)) s.inbox.push({ ...g });
  s.giftsGot = union(s.giftsGot, other.giftsGot);
  s.giftsSent = union(s.giftsSent, other.giftsSent);
  for (const b of other.babies) if (s.babies.length < BABIES_MAX && !s.babies.some((x) => x.key === b.key)) s.babies.push(structuredClone(b));
  if (!s.active && other.active) {
    s.active = other.active;
    s.team = other.team.filter((id) => s.owned[id]);
  }
  // Run it through the same checks as a save read from this phone.
  return { save: parseSave(JSON.stringify(s)), added };
}

/**
 * The link the other phone opens. Played inside TrueAIGaming's play page, the link goes back to that page, which
 * hands the code to the game; on its own, it opens the game itself.
 */
export function moveLink(code: string, here: { origin: string; pathname: string }, referrer: string, framed: boolean): string {
  if (framed) {
    try {
      const site = new URL(referrer).origin;
      if (isSite(site)) {
        return `${site}/play.html?id=squishy-closet${HASH}${code}`;
      }
    } catch {
      // No referrer: link to the game itself.
    }
  }
  return `${here.origin}${here.pathname}${HASH}${code}`;
}

/** Asks the browser to keep this site's storage when space runs low. Never prompts in Safari or Chrome. */
export function keepStorage(): void {
  const st = navigator.storage;
  if (!st?.persist || !st.persisted) return;
  void st.persisted().then((yes) => (yes ? undefined : st.persist())).catch(() => {});
}
