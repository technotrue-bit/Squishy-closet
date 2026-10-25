// Everything drawn over the 3D view: the island title, the closet's love meter,
// shelf and buttons, the squishy cards, the Squishy Book, the tutorial hand and
// little toasts. Big, round, picture-first buttons for small hands; a 4 year
// old can play without reading.

import { CATALOG, FAMILIES, FINISH_NAME, type SquishyDef } from "./catalog";
import { feelWord } from "./feel";
import { LOVE_PER_BOX, NAME_MAX } from "./save";
import type { Thumbs } from "./thumbs";

const CSS = `
.ui { position: fixed; inset: 0; pointer-events: none; font-family: ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif; color: #5a2a4a; -webkit-user-select: none; user-select: none; }
.ui button { pointer-events: auto; font: inherit; color: inherit; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ui .layer { position: absolute; inset: 0; display: none; }
.ui .layer.on { display: block; }
.ui .round { width: 50px; height: 50px; border-radius: 25px; background: rgba(255,255,255,0.8); box-shadow: 0 3px 0 rgba(200,110,150,0.35); display: grid; place-items: center; }
.ui .round:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(200,110,150,0.35); }
.ui .sound { position: absolute; top: calc(env(safe-area-inset-top) + 10px); right: 12px; }

.ui .title .logo { position: absolute; top: calc(env(safe-area-inset-top) + 9vh); left: 0; right: 0; text-align: center; font-weight: 900; font-size: min(13vw, 64px); line-height: 0.95; color: #fff; text-shadow: 0 4px 0 #e86fa3, 0 8px 22px rgba(180,60,120,0.35); transform: rotate(-3deg); }
.ui .title .logo small { display: block; font-size: 0.36em; margin-top: 10px; color: #fff; text-shadow: 0 2px 0 #b98ae8; transform: rotate(3deg); }
.ui .play { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 11vh); transform: translateX(-50%); min-width: 220px; padding: 18px 44px; border-radius: 999px; font-size: 38px; font-weight: 900; color: #fff !important; background: linear-gradient(180deg, #ff9cc8, #ff4f8d); box-shadow: 0 7px 0 #c2346c, 0 14px 30px rgba(200,50,110,0.4); animation: bob 1.6s ease-in-out infinite; }
.ui .play:active { transform: translateX(-50%) translateY(5px); box-shadow: 0 2px 0 #c2346c; }
@keyframes bob { 0%,100% { margin-bottom: 0; } 50% { margin-bottom: 8px; } }

.ui .love { position: absolute; top: calc(env(safe-area-inset-top) + 12px); left: 12px; display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.8); padding: 6px 10px 6px 6px; border-radius: 999px; box-shadow: 0 3px 0 rgba(200,110,150,0.3); }
.ui .love .heart { width: 34px; height: 34px; transition: transform 0.2s; flex: none; }
.ui .love .heart.beat { transform: scale(1.35); }
.ui .love .bar { width: min(34vw, 150px); height: 16px; border-radius: 8px; background: #ffe0ec; overflow: hidden; }
.ui .love .fill { height: 100%; width: 0%; border-radius: 8px; background: linear-gradient(90deg, #ff8fb8, #ff4f8d); transition: width 0.35s cubic-bezier(.3,1.6,.5,1); }
.ui .love .gift { width: 30px; height: 30px; flex: none; }
.ui .stars { position: absolute; top: calc(env(safe-area-inset-top) + 66px); left: 14px; display: flex; align-items: center; gap: 4px; font-weight: 900; font-size: 16px; color: #d48a00; background: rgba(255,255,255,0.7); padding: 3px 10px 3px 5px; border-radius: 999px; }
.ui .stars svg { width: 22px; height: 22px; }

.ui .plank { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 84px); height: 12px; background: linear-gradient(180deg, #e8b98a, #c98d58); box-shadow: 0 4px 8px rgba(120,60,30,0.25); }
.ui .shelf { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 94px); height: 86px; pointer-events: auto; overflow-x: auto; overflow-y: hidden; white-space: nowrap; padding: 0 10px; scrollbar-width: none; touch-action: pan-x; }
.ui .shelf::-webkit-scrollbar { display: none; }
.ui .shelf button { display: inline-block; width: 72px; height: 74px; margin: 0 2px; padding: 0; background: none; position: relative; vertical-align: bottom; }
.ui .shelf img { width: 72px; height: 72px; display: block; }
.ui .shelf button.on::before { content: ""; position: absolute; left: 6px; right: 6px; bottom: 6px; height: 54px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0)); }

.ui .nav { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 16px calc(env(safe-area-inset-bottom) + 10px); display: flex; justify-content: space-around; align-items: flex-end; background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.55) 40%); }
.ui .nav button { width: 76px; display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; font-weight: 900; font-size: 13px; }
.ui .nav .ico { width: 58px; height: 58px; border-radius: 20px; display: grid; place-items: center; background: linear-gradient(180deg, #c9a8f0, #9a72e0); box-shadow: 0 4px 0 #7350b8; position: relative; }
.ui .nav .ico svg { width: 36px; height: 36px; }
.ui .nav .open .ico { width: 68px; height: 68px; border-radius: 24px; background: linear-gradient(180deg, #ffb3d1, #ff5f9c); box-shadow: 0 5px 0 #c2346c; }
.ui .nav .open.ready .ico { animation: wiggle 1.2s ease-in-out infinite; }
.ui .nav .open.empty .ico { filter: grayscale(0.7) opacity(0.7); }
.ui .nav .badge { position: absolute; top: -6px; right: -6px; min-width: 24px; height: 24px; padding: 0 6px; box-sizing: border-box; border-radius: 12px; background: #ffd84d; color: #7a4a00; font-size: 15px; font-weight: 900; display: grid; place-items: center; box-shadow: 0 2px 0 #d4a000; }
@keyframes wiggle { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-9deg) scale(1.06); } 30% { transform: rotate(8deg) scale(1.06); } 45% { transform: rotate(0); } }

.ui .hint { position: absolute; left: 50%; top: calc(env(safe-area-inset-top) + 104px); transform: translateX(-50%); padding: 12px 22px; border-radius: 22px; background: rgba(255,255,255,0.9); box-shadow: 0 4px 0 rgba(200,110,150,0.3); font-weight: 900; font-size: 24px; text-align: center; white-space: nowrap; display: none; }
.ui .hint.on { display: block; animation: pop 0.35s cubic-bezier(.3,1.7,.5,1); }
.ui .hint small { display: block; font-size: 15px; font-weight: 800; color: #a0607f; margin-top: 2px; }
.ui .dots { display: flex; gap: 6px; justify-content: center; margin-top: 8px; }
.ui .dots i { width: 12px; height: 12px; border-radius: 6px; background: #ffd6e6; }
.ui .dots i.on { background: #ff5f9c; }
.ui .skip { position: absolute; top: calc(env(safe-area-inset-top) + 214px); left: 50%; transform: translateX(-50%); padding: 6px 16px; border-radius: 999px; background: rgba(255,255,255,0.6); font-size: 14px; font-weight: 800; color: #a0607f; display: none; }
.ui .skip.on { display: block; }
@keyframes pop { from { transform: translateX(-50%) scale(0.6); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }

.ui .hand { position: absolute; width: 74px; height: 74px; margin: -8px 0 0 -22px; display: none; filter: drop-shadow(0 4px 6px rgba(120,40,80,0.35)); }
.ui .hand.two { margin-left: -60px; }
.ui .hand.on { display: block; }
.ui .hand svg { width: 100%; height: 100%; }
.ui .hand.press { animation: press 1.4s ease-in-out infinite; }
.ui .hand.pet { animation: pet 1.4s ease-in-out infinite; }
.ui .hand.tickle { animation: tickle 0.5s linear infinite; }
.ui .hand.toss { animation: toss 1.3s ease-in infinite; }
.ui .hand.tap { animation: tap 0.9s ease-in-out infinite; }
@keyframes press { 0%,15% { transform: translateY(-14px); } 35%,80% { transform: translateY(8px) scale(0.92); } 100% { transform: translateY(-14px); } }
@keyframes pet { 0% { transform: translate(-50px, 0); } 50% { transform: translate(50px, 6px); } 100% { transform: translate(-50px, 0); } }
@keyframes tickle { 0% { transform: translate(-14px, 0) rotate(-10deg); } 25% { transform: translate(0, -8px); } 50% { transform: translate(14px, 0) rotate(10deg); } 75% { transform: translate(0, 8px); } 100% { transform: translate(-14px, 0) rotate(-10deg); } }
@keyframes toss { 0% { transform: translate(0, 20px); opacity: 1; } 60% { transform: translate(30px, -90px); opacity: 1; } 100% { transform: translate(40px, -120px); opacity: 0; } }
@keyframes tap { 0%,100% { transform: translateY(-12px); } 45% { transform: translateY(6px) scale(0.92); } }

.ui .modal { position: absolute; inset: 0; display: none; pointer-events: auto; background: rgba(90,40,80,0.35); align-items: center; justify-content: center; padding: 16px; }
.ui .modal.on { display: flex; }
.ui .card { width: min(340px, 92vw); border-radius: 30px; background: linear-gradient(180deg, #fff, #fff3f8); box-shadow: 0 8px 0 #f3b3cf, 0 20px 40px rgba(120,40,80,0.3); padding: 18px 18px 20px; text-align: center; position: relative; animation: cardIn 0.45s cubic-bezier(.3,1.6,.5,1); }
@keyframes cardIn { from { transform: scale(0.5) rotate(-6deg); opacity: 0; } to { transform: none; opacity: 1; } }
.ui .card .no { position: absolute; top: 14px; left: 18px; font-weight: 900; font-size: 18px; color: #c58ab0; }
.ui .card .new { position: absolute; top: 12px; right: 14px; padding: 3px 12px; border-radius: 999px; background: #ffd84d; color: #7a4a00; font-weight: 900; font-size: 15px; transform: rotate(6deg); }
.ui .card img { width: 190px; height: 190px; display: block; margin: 0 auto -6px; }
.ui .card .name { display: flex; align-items: center; justify-content: center; gap: 6px; }
.ui .card input { width: 210px; font: inherit; font-size: 28px; font-weight: 900; text-align: center; color: #e2508c; border: 3px dashed transparent; border-radius: 14px; background: transparent; padding: 2px 6px; outline: none; pointer-events: auto; -webkit-user-select: text; user-select: text; }
.ui .card input:focus { border-color: #ffb3d1; background: #fff; }
.ui .card .pen { width: 34px; height: 34px; border-radius: 17px; background: #ffe0ec; display: grid; place-items: center; flex: none; }
.ui .card .kind { font-weight: 800; font-size: 15px; color: #a0607f; margin-top: 2px; }
.ui .card .chips { display: flex; justify-content: center; gap: 8px; margin: 12px 0 14px; flex-wrap: wrap; }
.ui .card .chips span { padding: 6px 12px; border-radius: 999px; background: #f3e8ff; color: #7350b8; font-weight: 900; font-size: 15px; }
.ui .card .chips span.feel { background: #ffe9f2; color: #e2508c; }
.ui .card .btns { display: flex; justify-content: center; gap: 10px; }
.ui .big { padding: 14px 34px; border-radius: 999px; font-size: 26px; font-weight: 900; color: #fff !important; background: linear-gradient(180deg, #ff9cc8, #ff4f8d); box-shadow: 0 5px 0 #c2346c; }
.ui .big.alt { background: linear-gradient(180deg, #d8c2ff, #9a72e0); box-shadow: 0 5px 0 #7350b8; }
.ui .big:active { transform: translateY(3px); box-shadow: 0 2px 0 #c2346c; }
.ui .card .repeat { font-weight: 800; font-size: 16px; color: #d48a00; margin: 8px 0 12px; }

.ui .book { position: absolute; inset: 0; display: none; pointer-events: auto; background: linear-gradient(180deg, #fff4fa, #ffe6f1); overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.ui .book.on { display: block; }
.ui .book .head { position: sticky; top: 0; z-index: 2; padding: calc(env(safe-area-inset-top) + 12px) 70px 10px; text-align: center; background: linear-gradient(180deg, #fff4fa 80%, rgba(255,244,250,0)); }
.ui .book h1 { margin: 0; font-size: 28px; font-weight: 900; color: #e2508c; }
.ui .book .found { font-weight: 900; font-size: 18px; color: #9a72e0; }
.ui .book .close { position: absolute; top: calc(env(safe-area-inset-top) + 10px); right: 12px; }
.ui .book h2 { margin: 18px 16px 8px; font-size: 20px; font-weight: 900; color: #7350b8; display: flex; justify-content: space-between; }
.ui .book h2 span { color: #c58ab0; font-size: 16px; }
.ui .book .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 0 12px; }
.ui .book .cell { aspect-ratio: 1 / 1.1; border-radius: 18px; background: #fff; box-shadow: 0 3px 0 #f3c6da; position: relative; padding: 0; overflow: hidden; }
.ui .book .cell img { width: 100%; height: auto; display: block; margin-top: 4%; }
.ui .book .cell.missing { background: #f6eef7; box-shadow: 0 3px 0 #e6d6ec; }
.ui .book .cell.missing img { filter: brightness(0) opacity(0.16); }
.ui .book .cell b { position: absolute; left: 7px; top: 4px; font-size: 12px; font-weight: 900; color: #c58ab0; }
.ui .book .cell.missing::after { content: "?"; position: absolute; inset: 0; display: grid; place-items: center; font-size: 28px; font-weight: 900; color: #c9b0d6; }
.ui .book .cell.wobble { animation: wiggle 0.5s; }
.ui .book .pad { height: calc(env(safe-area-inset-bottom) + 30px); }

.ui .toast { position: absolute; top: 36%; left: 50%; transform: translate(-50%, -50%) scale(0.6); opacity: 0; font-weight: 900; font-size: 32px; color: #fff; text-align: center; text-shadow: 0 3px 0 #e2508c, 0 6px 18px rgba(200,60,120,0.5); transition: opacity 0.25s, transform 0.35s cubic-bezier(.3,1.7,.5,1); white-space: nowrap; }
.ui .toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
@media (max-height: 700px) { .ui .hint { font-size: 20px; padding: 8px 16px; } .ui .hint small { font-size: 13px; } .ui .skip { top: calc(env(safe-area-inset-top) + 186px); } }
@media (max-height: 600px) { .ui .shelf { height: 70px; } .ui .shelf img { width: 60px; height: 60px; } .ui .shelf button { width: 60px; height: 62px; } .ui .card img { width: 140px; height: 140px; } }
`;

const HEART = `<svg class="heart" viewBox="0 0 32 32"><path d="M16 28C7 21 3 17 3 11c0-5 4-8 8-8 2.5 0 4 1.2 5 3 1-1.8 2.5-3 5-3 4 0 8 3 8 8 0 6-4 10-13 17z" fill="#ff4f8d" stroke="#fff" stroke-width="2.5"/><ellipse cx="10" cy="10" rx="2.6" ry="1.8" fill="#fff" opacity=".8" transform="rotate(-35 10 10)"/></svg>`;
/** A little steamer basket with a bow: a squishy box. */
const GIFT = `<svg viewBox="0 0 40 40"><rect x="5" y="17" width="30" height="17" rx="5" fill="#ffe6c4" stroke="#fff" stroke-width="2"/><path d="M5 23h30" stroke="#e3b27a" stroke-width="2"/><rect x="3" y="11" width="34" height="8" rx="4" fill="#fff6e8" stroke="#fff" stroke-width="2"/><path d="M20 11v23" stroke="#ff7fb0" stroke-width="4"/><path d="M20 11c-4-7-11-6-9-1 1 2 5 2 9 1zM20 11c4-7 11-6 9-1-1 2-5 2-9 1z" fill="#ff7fb0"/></svg>`;
const BOOK = `<svg viewBox="0 0 40 40"><path d="M7 7c5-2 9-1 13 2v24c-4-3-8-4-13-2z" fill="#fff"/><path d="M33 7c-5-2-9-1-13 2v24c4-3 8-4 13-2z" fill="#fff4fb"/><path d="M12 15c1.5-1 3.5-1 5 0M12 20c1.5-1 3.5-1 5 0" stroke="#c9a8f0" stroke-width="2" stroke-linecap="round"/><circle cx="26.5" cy="17" r="4" fill="#ffb3d1"/></svg>`;
const ISLAND = `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="30" rx="16" ry="5" fill="#8fd8f0"/><ellipse cx="20" cy="27" rx="12" ry="5" fill="#ffe2b0"/><ellipse cx="20" cy="25" rx="9" ry="3.5" fill="#bfeaa0"/><path d="M19 25c0-6 1-11 3-14" stroke="#c98d58" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M22 11c-4-2-8-1-9 2 3-1 6 0 9-2zM22 11c3-3 8-3 9 0-3-1-6 0-9 0zM22 11c1 3 0 6-3 8 1-3 1-6 3-8z" fill="#7fc65a"/></svg>`;
const STAR = `<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z" fill="#ffd84d" stroke="#fff" stroke-width="1.5"/></svg>`;
const PEN = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ff7fb0"/><path d="M4 20l1-5 4 4z" fill="#ffd6e6"/></svg>`;
const CLOSE = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#e2508c" stroke-width="3.5" stroke-linecap="round"/></svg>`;
const SPEAKER_ON = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 10h4l6-5v16l-6-5H4z" fill="#e2508c"/><path d="M18 9c2 2 2 6 0 8M21 6c4 4 4 10 0 14" stroke="#e2508c" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 10h4l6-5v16l-6-5H4z" fill="#b48aa3"/><path d="M18 10l6 6M24 10l-6 6" stroke="#b48aa3" stroke-width="2.4" stroke-linecap="round"/></svg>`;
/** A pointing hand, finger tip at the top left. */
const HAND = `<svg viewBox="0 0 64 64"><path d="M22 6c3 0 5 2 5 5v17l3-1c2-1 5 0 6 2 2-1 5 0 6 2 2-1 6 0 6 3v12c0 9-6 15-15 15h-3c-6 0-10-3-13-8l-8-13c-1-2 0-5 3-5 2 0 3 1 4 2l2 3V11c0-3 2-5 4-5z" fill="#fff" stroke="#5a2a4a" stroke-width="3" stroke-linejoin="round"/><path d="M30 29v8M36 31v7M42 33v6" stroke="#5a2a4a" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export type Screen = "title" | "closet" | "box";
export type HandMove = "press" | "pet" | "tickle" | "toss" | "tap" | "hug";

export interface UiHandlers {
  play(): void;
  toggleSound(): boolean;
  openBox(): void;
  openBook(): void;
  goIsland(): void;
  hold(id: string): void;
  rename(id: string, name: string): void;
  skipTutorial(): void;
}

export interface CardInfo {
  def: SquishyDef;
  name: string;
  isNew?: boolean;
  /** Stars given for a squishy you already had. */
  stars?: number;
  /** Shown from the Book: offer to hold it. */
  fromBook?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class Ui {
  private root: HTMLDivElement;
  private layers: Record<Screen, HTMLElement>;
  private fill!: HTMLElement;
  private heart!: Element;
  private starCount!: HTMLElement;
  private shelf!: HTMLElement;
  private openBtn!: HTMLElement;
  private badge!: HTMLElement;
  private hintEl: HTMLElement;
  private skipEl: HTMLElement;
  private handEl: HTMLElement;
  private modal: HTMLElement;
  private bookEl: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  private cardDone: (() => void) | null = null;
  private soundBtns: HTMLButtonElement[] = [];

  constructor(
    private h: UiHandlers,
    private thumbs: Thumbs,
    sound: boolean,
  ) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement("div");
    this.root.className = "ui";
    this.root.innerHTML = `
      <div class="layer title">
        <div class="logo">Squishy<br>Closet!<small>Squishy Island</small></div>
        <button class="play">Play!</button>
      </div>
      <div class="layer closet">
        <div class="love">${HEART}<div class="bar"><div class="fill"></div></div><span class="gift">${GIFT}</span></div>
        <div class="stars">${STAR}<span>0</span></div>
        <div class="plank"></div>
        <div class="shelf"></div>
        <div class="nav">
          <button class="book-btn"><span class="ico">${BOOK}</span>Book</button>
          <button class="open"><span class="ico">${GIFT}<span class="badge">0</span></span>Open</button>
          <button class="island-btn"><span class="ico">${ISLAND}</span>Island</button>
        </div>
      </div>
      <div class="layer box"></div>
      <div class="hint"></div>
      <button class="skip">Skip</button>
      <div class="hand">${HAND}</div>
      <div class="modal"></div>
      <div class="book"></div>
      <div class="toast"></div>`;
    document.body.appendChild(this.root);
    const q = <T extends Element = HTMLElement>(sel: string) => this.root.querySelector(sel) as unknown as T;
    this.layers = { title: q(".title"), closet: q(".closet"), box: q(".layer.box") };
    this.fill = q(".fill");
    this.heart = q(".heart");
    this.starCount = q(".stars span");
    this.shelf = q(".shelf");
    this.openBtn = q(".open");
    this.badge = q(".badge");
    this.hintEl = q(".hint");
    this.skipEl = q(".skip");
    this.handEl = q(".hand");
    this.modal = q(".modal");
    this.bookEl = q(".book");
    this.toastEl = q(".toast");
    q(".play").addEventListener("click", () => h.play());
    this.openBtn.addEventListener("click", () => h.openBox());
    q(".book-btn").addEventListener("click", () => h.openBook());
    q(".island-btn").addEventListener("click", () => h.goIsland());
    this.skipEl.addEventListener("click", () => h.skipTutorial());
    // One sound button, on every screen.
    const soundBtn = document.createElement("button");
    soundBtn.className = "round sound";
    soundBtn.setAttribute("aria-label", "Sound");
    soundBtn.innerHTML = sound ? SPEAKER_ON : SPEAKER_OFF;
    soundBtn.addEventListener("click", () => {
      soundBtn.innerHTML = h.toggleSound() ? SPEAKER_ON : SPEAKER_OFF;
    });
    this.root.appendChild(soundBtn);
    this.soundBtns.push(soundBtn);
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.closeCard();
    });
  }

  show(screen: Screen): void {
    for (const [k, el] of Object.entries(this.layers)) el.classList.toggle("on", k === screen);
  }

  get busy(): boolean {
    return this.modal.classList.contains("on") || this.bookEl.classList.contains("on");
  }

  setLove(love: number): void {
    this.fill.style.width = `${Math.round((love / LOVE_PER_BOX) * 100)}%`;
  }

  beat(): void {
    this.heart.classList.add("beat");
    setTimeout(() => this.heart.classList.remove("beat"), 180);
  }

  setBoxes(n: number): void {
    this.badge.textContent = String(n);
    this.badge.style.display = n > 0 ? "grid" : "none";
    this.openBtn.classList.toggle("ready", n > 0);
    this.openBtn.classList.toggle("empty", n === 0);
  }

  setStars(n: number): void {
    this.starCount.textContent = String(n);
  }

  /** The closet shelf: every squishy you have, newest first. Tap one to hold it. */
  setShelf(ids: string[], active: string | null): void {
    this.shelf.innerHTML = "";
    for (const id of ids) {
      const b = document.createElement("button");
      b.className = id === active ? "on" : "";
      const img = document.createElement("img");
      img.alt = "";
      b.appendChild(img);
      this.thumbs.want(id, (url) => (img.src = url));
      b.addEventListener("click", () => this.h.hold(id));
      this.shelf.appendChild(b);
    }
  }

  hint(text: string | null, sub?: string, dots?: { done: number; total: number }): void {
    if (!text) {
      this.hintEl.classList.remove("on");
      return;
    }
    const d = dots ? `<div class="dots">${Array.from({ length: dots.total }, (_, i) => `<i class="${i < dots.done ? "on" : ""}"></i>`).join("")}</div>` : "";
    this.hintEl.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}${d}`;
    this.hintEl.classList.remove("on");
    void this.hintEl.offsetWidth;
    this.hintEl.classList.add("on");
  }

  showSkip(on: boolean): void {
    this.skipEl.classList.toggle("on", on);
  }

  /** The pointing hand, showing a move at a screen spot. */
  hand(move: HandMove | null, x = 0, y = 0): void {
    const el = this.handEl;
    if (!move) {
      el.className = "hand";
      return;
    }
    const cls = `hand on ${move === "hug" ? "press two" : move}`;
    if (el.className !== cls) el.className = cls;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  toast(text: string, ms = 1800): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("show"), ms);
  }

  /** A squishy's card. Resolves when it is closed. */
  card(info: CardInfo): Promise<void> {
    const { def } = info;
    const kind = `${FAMILIES.find((f) => f.id === def.family)?.name ?? ""} · ${FINISH_NAME[def.finish]}`;
    this.modal.innerHTML = `
      <div class="card">
        <div class="no">#${def.no}</div>
        ${info.isNew ? `<div class="new">New!</div>` : ""}
        <img alt="">
        <div class="name"><input maxlength="${NAME_MAX}" enterkeyhint="done" aria-label="Name"><span class="pen">${PEN}</span></div>
        <div class="kind">${esc(def.design)} · ${esc(kind)}</div>
        <div class="chips"><span>${esc(def.personality)}</span><span class="feel">${esc(feelWord(def.soft))}</span></div>
        ${info.stars ? `<div class="repeat">You have this one! +${info.stars} stars</div>` : ""}
        <div class="btns">${info.fromBook ? `<button class="big alt hold">Hold</button>` : ""}<button class="big yay">${info.fromBook ? "Close" : "Yay!"}</button></div>
      </div>`;
    const img = this.modal.querySelector("img")!;
    this.thumbs.want(def.id, (url) => (img.src = url));
    const input = this.modal.querySelector("input")!;
    input.value = info.name;
    input.readOnly = !!info.stars;
    const commit = () => {
      if (!info.stars) this.h.rename(def.id, input.value);
    };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
    this.modal.querySelector(".pen")!.addEventListener("click", () => {
      if (!info.stars) input.focus();
    });
    this.modal.classList.add("on");
    return new Promise((resolve) => {
      this.cardDone = () => {
        commit();
        resolve();
      };
      this.modal.querySelector(".yay")!.addEventListener("click", () => this.closeCard());
      this.modal.querySelector(".hold")?.addEventListener("click", () => {
        this.closeCard();
        this.closeBook();
        this.h.hold(def.id);
      });
    });
  }

  private closeCard(): void {
    if (!this.modal.classList.contains("on")) return;
    this.modal.classList.remove("on");
    const done = this.cardDone;
    this.cardDone = null;
    done?.();
  }

  /** The Squishy Book: every squishy, with shadows for ones not found yet. */
  book(owned: Record<string, unknown>, nameOf: (id: string) => string): void {
    const found = CATALOG.filter((d) => owned[d.id]).length;
    let html = `<div class="head"><h1>Squishy Book</h1><div class="found">You found ${found} of ${CATALOG.length}!</div></div>
      <button class="round close" aria-label="Close">${CLOSE}</button>`;
    for (const fam of FAMILIES) {
      const defs = CATALOG.filter((d) => d.family === fam.id);
      const got = defs.filter((d) => owned[d.id]).length;
      html += `<h2>${esc(fam.name)} <span>${got}/${defs.length}</span></h2><div class="grid">`;
      for (const d of defs) html += `<button class="cell${owned[d.id] ? "" : " missing"}" data-id="${d.id}"><b>${d.no}</b><img alt=""></button>`;
      html += `</div>`;
    }
    html += `<div class="pad"></div>`;
    this.bookEl.innerHTML = html;
    this.bookEl.scrollTop = 0;
    this.bookEl.classList.add("on");
    this.bookEl.querySelector(".close")!.addEventListener("click", () => this.closeBook());
    for (const cell of this.bookEl.querySelectorAll<HTMLButtonElement>(".cell")) {
      const id = cell.dataset.id!;
      const img = cell.querySelector("img")!;
      this.thumbs.want(id, (url) => (img.src = url));
      cell.addEventListener("click", () => {
        const def = CATALOG.find((d) => d.id === id)!;
        if (owned[id]) void this.card({ def, name: nameOf(id), fromBook: true });
        else {
          cell.classList.remove("wobble");
          void cell.offsetWidth;
          cell.classList.add("wobble");
        }
      });
    }
  }

  closeBook(): void {
    this.bookEl.classList.remove("on");
  }
}
