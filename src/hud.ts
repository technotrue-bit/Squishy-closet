// Everything drawn on top of the 3D view: the title, the Love heart, the
// things-to-try chips, the color swatches and the sound button. Big, round,
// picture-first buttons for small hands.

import { LOOKS, type Look } from "./looks";

export const ACTIONS = [
  { id: "tap", word: "Tap" },
  { id: "hold", word: "Squish" },
  { id: "pet", word: "Pet" },
  { id: "tickle", word: "Tickle" },
  { id: "flick", word: "Toss" },
  { id: "hug", word: "Hug" },
] as const;
export type ActionId = (typeof ACTIONS)[number]["id"];

const ICONS: Record<ActionId, string> = {
  // A fingertip with a little burst.
  tap: `<circle cx="20" cy="24" r="7" fill="#fff"/><path d="M20 9v4M10 13l3 3M30 13l-3 3" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  // A finger pressing a squashed bun.
  hold: `<ellipse cx="20" cy="27" rx="13" ry="6" fill="#fff"/><path d="M20 6v12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M15 14l5 5 5-5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // A stroke line with a heart.
  pet: `<path d="M6 26c6-8 22-8 28 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M20 19c-3-4-9-2-7 3 1 2 4 4 7 6 3-2 6-4 7-6 2-5-4-7-7-3z" fill="#fff"/>`,
  // Zig zag rub.
  tickle: `<path d="M6 22l6-8 6 8 6-8 6 8 6-8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Up arrow arc.
  flick: `<path d="M8 32C10 18 20 10 30 9" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M24 5l7 4-4 7" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Two hands round a heart.
  hug: `<path d="M20 30c-6-5-11-8-11-13 0-5 7-7 11-2 4-5 11-3 11 2 0 5-5 8-11 13z" fill="#fff"/><path d="M4 16c0 8 4 14 9 16M36 16c0 8-4 14-9 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};

const CSS = `
.hud { position: fixed; inset: 0; pointer-events: none; font-family: ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif; color: #5a2a4a; -webkit-user-select: none; user-select: none; }
.hud button { pointer-events: auto; font: inherit; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.hud .top { position: absolute; top: calc(env(safe-area-inset-top) + 10px); left: 12px; right: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hud .logo { font-weight: 800; font-size: 22px; letter-spacing: 0.3px; color: #fff; text-shadow: 0 2px 0 #e86fa3, 0 4px 10px rgba(180,60,120,0.35); white-space: nowrap; }
.hud .sound { width: 46px; height: 46px; border-radius: 23px; background: rgba(255,255,255,0.75); box-shadow: 0 3px 0 rgba(200,110,150,0.35); display: grid; place-items: center; }
.hud .love { position: absolute; top: calc(env(safe-area-inset-top) + 64px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.72); padding: 6px 14px 6px 8px; border-radius: 999px; box-shadow: 0 3px 0 rgba(200,110,150,0.3); }
.hud .love .lvl { font-weight: 800; font-size: 18px; color: #e2508c; min-width: 26px; text-align: center; }
.hud .love .bar { width: 120px; height: 14px; border-radius: 7px; background: #ffe0ec; overflow: hidden; }
.hud .love .fill { height: 100%; width: 0%; border-radius: 7px; background: linear-gradient(90deg, #ff8fb8, #ff4f8d); transition: width 0.35s cubic-bezier(.3,1.6,.5,1); }
.hud .love .heart { width: 30px; height: 30px; transition: transform 0.2s; }
.hud .love .heart.beat { transform: scale(1.35); }
.hud .try { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 92px); display: flex; justify-content: center; gap: 6px; padding: 0 8px; flex-wrap: wrap; }
.hud .chip { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 54px; padding: 6px 0 4px; border-radius: 16px; background: rgba(180,120,200,0.55); font-weight: 800; font-size: 11px; color: #fff; transition: background 0.3s, transform 0.3s; }
.hud .chip svg { width: 30px; height: 30px; }
.hud .chip.done { background: linear-gradient(180deg, #ff8fc0, #ff5f9c); transform: scale(1.04); }
.hud .chip.pulse { animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.hud .swatches { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 18px); display: flex; justify-content: center; gap: 10px; }
.hud .sw { width: 50px; height: 50px; border-radius: 25px; box-shadow: inset -5px -7px 10px rgba(0,0,0,0.18), inset 5px 6px 10px rgba(255,255,255,0.55), 0 3px 0 rgba(160,80,120,0.25); transition: transform 0.2s; }
.hud .sw.on { transform: scale(1.18); outline: 4px solid #fff; outline-offset: 2px; }
.hud .sw.glitter { background-image: radial-gradient(circle at 30% 30%, #fff8 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, #fff9 1.5px, transparent 2px), radial-gradient(circle at 45% 75%, #fff8 1px, transparent 2px); }
.hud .toast { position: absolute; top: 34%; left: 50%; transform: translate(-50%, -50%) scale(0.6); opacity: 0; font-weight: 900; font-size: 34px; color: #fff; text-shadow: 0 3px 0 #e2508c, 0 6px 18px rgba(200,60,120,0.5); transition: opacity 0.25s, transform 0.35s cubic-bezier(.3,1.7,.5,1); white-space: nowrap; }
.hud .toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
@media (max-height: 560px) { .hud .try { bottom: 80px; } .hud .sw { width: 42px; height: 42px; } .hud .love { top: 58px; } }
`;

const HEART = `<svg class="heart" viewBox="0 0 32 32"><path d="M16 28C7 21 3 17 3 11c0-5 4-8 8-8 2.5 0 4 1.2 5 3 1-1.8 2.5-3 5-3 4 0 8 3 8 8 0 6-4 10-13 17z" fill="#ff4f8d" stroke="#fff" stroke-width="2.5"/><ellipse cx="10" cy="10" rx="2.6" ry="1.8" fill="#fff" opacity=".8" transform="rotate(-35 10 10)"/></svg>`;
const SPEAKER_ON = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 10h4l6-5v16l-6-5H4z" fill="#e2508c"/><path d="M18 9c2 2 2 6 0 8M21 6c4 4 4 10 0 14" stroke="#e2508c" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 10h4l6-5v16l-6-5H4z" fill="#b48aa3"/><path d="M18 10l6 6M24 10l-6 6" stroke="#b48aa3" stroke-width="2.4" stroke-linecap="round"/></svg>`;

export interface HudHandlers {
  pickLook(look: Look): void;
  toggleSound(): boolean;
}

export class Hud {
  private root: HTMLDivElement;
  private fill: HTMLDivElement;
  private lvl: HTMLDivElement;
  private heart: SVGElement;
  private chips = new Map<string, HTMLElement>();
  private swatches = new Map<string, HTMLButtonElement>();
  private toastEl: HTMLDivElement;
  private toastTimer = 0;

  constructor(h: HudHandlers, sound: boolean) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="top"><div class="logo">Squishy Closet!</div><button class="sound" aria-label="Sound"></button></div>
      <div class="love" aria-label="Love">${HEART}<div class="bar"><div class="fill"></div></div><div class="lvl">1</div></div>
      <div class="try"></div>
      <div class="swatches"></div>
      <div class="toast"></div>`;
    document.body.appendChild(this.root);
    this.fill = this.root.querySelector(".fill")!;
    this.lvl = this.root.querySelector(".lvl")!;
    this.heart = this.root.querySelector(".heart")!;
    this.toastEl = this.root.querySelector(".toast")!;
    const soundBtn = this.root.querySelector<HTMLButtonElement>(".sound")!;
    soundBtn.innerHTML = sound ? SPEAKER_ON : SPEAKER_OFF;
    soundBtn.addEventListener("click", () => {
      soundBtn.innerHTML = h.toggleSound() ? SPEAKER_ON : SPEAKER_OFF;
    });
    const tryRow = this.root.querySelector(".try")!;
    for (const a of ACTIONS) {
      const el = document.createElement("div");
      el.className = "chip";
      el.innerHTML = `<svg viewBox="0 0 40 40">${ICONS[a.id]}</svg><span>${a.word}</span>`;
      tryRow.appendChild(el);
      this.chips.set(a.id, el);
    }
    const sw = this.root.querySelector(".swatches")!;
    for (const look of LOOKS) {
      const b = document.createElement("button");
      b.className = "sw" + (look.finish === "glitter" ? " glitter" : "");
      b.style.backgroundColor = look.color;
      b.setAttribute("aria-label", look.name);
      b.addEventListener("click", () => h.pickLook(look));
      sw.appendChild(b);
      this.swatches.set(look.id, b);
    }
  }

  setLook(id: string): void {
    for (const [k, b] of this.swatches) b.classList.toggle("on", k === id);
  }

  setLove(love: number, level: number): void {
    this.fill.style.width = `${Math.round(love)}%`;
    this.lvl.textContent = String(level);
  }

  beat(): void {
    this.heart.classList.add("beat");
    setTimeout(() => this.heart.classList.remove("beat"), 180);
  }

  setTried(tried: string[]): void {
    const next = ACTIONS.find((a) => !tried.includes(a.id));
    for (const a of ACTIONS) {
      const el = this.chips.get(a.id)!;
      el.classList.toggle("done", tried.includes(a.id));
      el.classList.toggle("pulse", next?.id === a.id);
    }
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("show"), 1800);
  }
}
