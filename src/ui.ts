// Everything drawn over the 3D view: the island title, the love meter, the
// shelf of squishies (who is out playing and who is resting), the buttons, the
// squishy cards, the Squishy Book, hats, places, settings, bath time, the
// Spooky Box button, the tutorial hand and little toasts. Big, round,
// picture-first buttons for small hands; a 4 year old can play without reading.

import { CATALOG, FAMILIES, FINISH_NAME, type SquishyDef } from "./catalog";
import { feelWord } from "./feel";
import { HATS, type HatDef } from "./hats";
import { PLACES, type PlaceId } from "./places";
import { LOVE_PER_BOX, NAME_MAX, ZOOM_MAX, ZOOM_MIN } from "./save";
import { LESSONS, moodById, type Mood, type MoodId } from "./personality";
import { wishFor, wishWords, type Wish } from "./wishes";
import { CARE_IDS, CARE_INFO, PRESENT_COOKIES, PRESENT_STARS, type CareId } from "./care";
import type { Thumbs } from "./thumbs";
import { FREE_PLACES, inFreeGame, placeOpen, squishyOpen, type FullWhy } from "./unlock";
import type { BuyResult } from "./payments";
import qrcode from "qrcode-generator";

const CSS = `
.ui { position: fixed; inset: 0; pointer-events: none; font-family: ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif; color: #5a2a4a; -webkit-user-select: none; user-select: none; }
.ui button { pointer-events: auto; font: inherit; color: inherit; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ui .layer { position: absolute; inset: 0; display: none; }
.ui .layer.on { display: block; }
.ui .round { width: 50px; height: 50px; border-radius: 25px; background: rgba(255,255,255,0.8); box-shadow: 0 3px 0 rgba(200,110,150,0.35); display: grid; place-items: center; }
.ui .round:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(200,110,150,0.35); }
.ui .gear { position: absolute; z-index: 3; top: calc(env(safe-area-inset-top) + 10px); right: calc(env(safe-area-inset-right) + 12px); }

.ui .title .logo { position: absolute; top: calc(env(safe-area-inset-top) + 9vh); left: 0; right: 0; text-align: center; font-weight: 900; font-size: min(13vw, 64px); line-height: 0.95; color: #fff; text-shadow: 0 4px 0 #e86fa3, 0 8px 22px rgba(180,60,120,0.35); transform: rotate(-3deg); }
.ui .title .logo small { display: block; font-size: 0.36em; margin-top: 10px; color: #fff; text-shadow: 0 2px 0 #b98ae8; transform: rotate(3deg); }
.ui .play { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 11vh); transform: translateX(-50%); min-width: 220px; padding: 18px 44px; border-radius: 999px; font-size: 38px; font-weight: 900; color: #fff !important; background: linear-gradient(180deg, #ff9cc8, #ff4f8d); box-shadow: 0 7px 0 #c2346c, 0 14px 30px rgba(200,50,110,0.4); animation: bob 1.6s ease-in-out infinite; }
.ui .play:active { transform: translateX(-50%) translateY(5px); box-shadow: 0 2px 0 #c2346c; }
@keyframes bob { 0%,100% { margin-bottom: 0; } 50% { margin-bottom: 8px; } }

.ui .love { position: absolute; top: calc(env(safe-area-inset-top) + 12px); left: calc(env(safe-area-inset-left) + 12px); display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.8); padding: 6px 10px 6px 6px; border-radius: 999px; box-shadow: 0 3px 0 rgba(200,110,150,0.3); }
.ui .love .heart { width: 34px; height: 34px; transition: transform 0.2s; flex: none; }
.ui .love .heart.beat { transform: scale(1.35); }
.ui .love .bar { width: min(34vw, 150px); height: 16px; border-radius: 8px; background: #ffe0ec; overflow: hidden; }
.ui .love .fill { height: 100%; width: 0%; border-radius: 8px; background: linear-gradient(90deg, #ff8fb8, #ff4f8d); transition: width 0.35s cubic-bezier(.3,1.6,.5,1); }
.ui .love .gift { width: 30px; height: 30px; flex: none; }
.ui .pills { position: absolute; top: calc(env(safe-area-inset-top) + 66px); left: calc(env(safe-area-inset-left) + 14px); display: flex; gap: 6px; }
.ui .stars { display: flex; align-items: center; gap: 4px; font-weight: 900; font-size: 16px; color: #d48a00; background: rgba(255,255,255,0.7); padding: 3px 10px 3px 5px; border-radius: 999px; }
.ui .stars svg { width: 22px; height: 22px; }

.ui .closet { --tray-h: 180px; }
.ui .tray { position: absolute; left: 0; right: 0; bottom: 0; height: calc(env(safe-area-inset-bottom) + var(--tray-h)); transition: transform 0.38s cubic-bezier(.4,0,.2,1); will-change: transform; }
.ui .closet.tray-down .tray { transform: translateY(100%); }
.ui .closet.tray-down .tray button { pointer-events: none; }
.ui .tray-tab { position: absolute; z-index: 2; left: 50%; bottom: calc(env(safe-area-inset-bottom) + var(--tray-h) - 4px); width: 92px; height: 40px; margin-left: -46px; padding: 0; background: none; display: grid; place-items: center; touch-action: none; transition: bottom 0.38s cubic-bezier(.4,0,.2,1); }
.ui .tray-tab .pill { position: relative; width: 60px; height: 24px; border-radius: 12px; background: rgba(255,255,255,0.8); box-shadow: 0 3px 0 rgba(200,110,150,0.35); display: grid; place-items: center; }
.ui .tray-tab:active .pill { transform: translateY(2px); box-shadow: 0 1px 0 rgba(200,110,150,0.35); }
.ui .tray-tab svg { width: 22px; height: 14px; transition: transform 0.38s cubic-bezier(.4,0,.2,1); }
.ui .tray-tab .dot { position: absolute; top: -5px; right: -5px; width: 14px; height: 14px; border-radius: 7px; background: #ff4f8d; border: 2px solid #fff; box-sizing: border-box; display: none; }
.ui .closet.tray-down .tray-tab { bottom: calc(env(safe-area-inset-bottom) + 4px); }
.ui .closet.tray-down .tray-tab svg { transform: rotate(180deg); }
.ui .closet.tray-down .tray-tab .dot.on { display: block; animation: bob 1.2s ease-in-out infinite; }
.ui .closet.still .tray, .ui .closet.still .tray-tab, .ui .closet.still .tray-tab svg, .ui .closet.still .float-btn { transition: none; }
@media (prefers-reduced-motion: reduce) { .ui .tray, .ui .tray-tab, .ui .tray-tab svg, .ui .float-btn { transition: none; } }
.ui .plank { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 84px); height: 12px; background: linear-gradient(180deg, #e8b98a, #c98d58); box-shadow: 0 4px 8px rgba(120,60,30,0.25); }
.ui .shelf { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 94px); height: 86px; pointer-events: auto; overflow-x: auto; overflow-y: hidden; white-space: nowrap; padding: 0 10px; scrollbar-width: none; touch-action: pan-x; }
.ui .shelf::-webkit-scrollbar { display: none; }
.ui .shelf button { display: inline-block; width: 72px; height: 74px; margin: 0 2px; padding: 0; background: none; position: relative; vertical-align: bottom; }
.ui .shelf img { width: 72px; height: 72px; display: block; }
.ui .shelf button.on::before { content: ""; position: absolute; left: 6px; right: 6px; bottom: 6px; height: 54px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0)); }
.ui .shelf button.rest img { filter: saturate(0.55) opacity(0.75); }
.ui .shelf .tag { position: absolute; left: 50%; bottom: -2px; transform: translateX(-50%); padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 900; color: #fff; white-space: nowrap; }
.ui .shelf .on .tag { background: #ff5f9c; }
.ui .shelf .out .tag { background: #4fb3f0; }
.ui .shelf .home { position: absolute; top: 2px; right: 0; width: 26px; height: 26px; border-radius: 13px; background: #fff; box-shadow: 0 2px 0 rgba(120,80,160,0.3); display: grid; place-items: center; padding: 0; }
.ui .shelf .home svg { width: 16px; height: 16px; }
.ui .cookies { display: flex; align-items: center; gap: 3px; font-weight: 900; font-size: 15px; color: #b86a2c; background: rgba(255,255,255,0.7); padding: 3px 10px 3px 6px; border-radius: 999px; transition: transform 0.2s; }
.ui .cookies.beat { transform: scale(1.25); }
.ui .cookies i { font-style: normal; font-size: 17px; line-height: 1; }
.ui .shelf button.baby img { width: 54px; height: 54px; margin: 12px auto 0; }
.ui .shelf .baby .tag { background: #ffb347; }
.ui .shelf .baby .zz { position: absolute; top: 4px; right: 4px; font-size: 16px; }
.ui .card .mood { font-weight: 800; font-size: 14px; color: #a0607f; margin: -6px 0 12px; }
.ui .card .grew { position: absolute; top: 12px; right: 14px; padding: 3px 12px; border-radius: 999px; background: #bdf0c8; color: #2d7a43; font-weight: 900; font-size: 15px; transform: rotate(6deg); }
.ui .card .note { font-weight: 800; font-size: 16px; color: #a0607f; margin: 6px 0 14px; line-height: 1.3; }
.ui .card .note b { color: #b86a2c; }
.ui .baby-top { display: flex; align-items: center; gap: 10px; margin: 0 40px 6px 0; }
.ui .baby-top img { width: 96px; height: 96px; flex: none; }
.ui .baby-top input { width: 100%; font: inherit; font-size: 22px; font-weight: 900; color: #e2508c; border: 3px dashed transparent; border-radius: 12px; background: transparent; padding: 2px 4px; outline: none; pointer-events: auto; -webkit-user-select: text; user-select: text; box-sizing: border-box; }
.ui .baby-top input:focus { border-color: #ffb3d1; background: #fff; }
.ui .baby-top .facts { font-weight: 800; font-size: 14px; color: #a0607f; line-height: 1.35; }
.ui .baby-top .facts b { color: #7350b8; }
.ui .lessons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ui .lessons button { border-radius: 18px; background: #fff; box-shadow: 0 3px 0 #f3c6da; padding: 8px 4px; font-weight: 900; font-size: 13px; color: #7350b8; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ui .lessons button i { font-style: normal; font-size: 30px; line-height: 1.1; }
.ui .lessons button:active { transform: translateY(2px); box-shadow: 0 1px 0 #f3c6da; }
.ui .lessons.napping button { filter: grayscale(0.6) opacity(0.6); }
.ui .shelf .baby .wants { position: absolute; top: 2px; right: 2px; width: 28px; height: 28px; border-radius: 14px; background: #fff; box-shadow: 0 2px 0 #ffb3d1; font-size: 17px; line-height: 28px; text-align: center; animation: bob 1.2s ease-in-out infinite; }
.ui .grow { height: 12px; border-radius: 6px; background: #f6dbe8; overflow: hidden; margin: 5px 0 2px; }
.ui .grow i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, #9ee6a8, #4fc46a); }
.ui .wish-card { display: flex; align-items: center; gap: 10px; border-radius: 22px; background: linear-gradient(180deg, #fff6c9, #ffe58a); box-shadow: 0 4px 0 #e8c24e; padding: 10px 12px; margin: 4px 0 12px; }
.ui .wish-card > i { font-style: normal; font-size: 40px; line-height: 1; animation: wiggle 1.6s ease-in-out infinite; }
.ui .wish-card .w { flex: 1; min-width: 0; font-weight: 900; font-size: 17px; color: #8a5a00; line-height: 1.2; }
.ui .wish-card .w small { display: block; font-weight: 800; font-size: 13px; color: #a8781a; }
.ui .wish-card button { flex: none; padding: 10px 16px; border-radius: 999px; font-size: 18px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #ff9cc8, #ff4f8d); box-shadow: 0 4px 0 #c2346c; }
.ui .wish-card button:active { transform: translateY(2px); box-shadow: 0 2px 0 #c2346c; }

.ui .wishplay { position: absolute; inset: 0; display: none; pointer-events: auto; background: radial-gradient(circle at 50% 70%, #fff7fb 0%, #ffd9ea 55%, #e9d4ff 100%); touch-action: none; overflow: hidden; }
.ui .wishplay.on { display: block; animation: fadeIn 0.25s ease-out; }
.ui .wishplay.won .close, .ui .wishplay.won .dots, .ui .wishplay.won .how { opacity: 0; pointer-events: none; transition: opacity 0.3s; }
.ui .wishplay.bye { animation: fadeAway 0.35s ease-in forwards; pointer-events: none; }
@keyframes fadeAway { to { opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.ui .wishplay .close { position: absolute; top: calc(env(safe-area-inset-top) + 12px); right: calc(env(safe-area-inset-right) + 12px); z-index: 3; }
.ui.framed .wishplay .close { top: calc(env(safe-area-inset-top) + 64px); }
.ui .wishplay h1 { position: absolute; left: calc(env(safe-area-inset-left) + 16px); right: 70px; top: calc(env(safe-area-inset-top) + 16px); margin: 0; font-size: 28px; font-weight: 900; color: #e2508c; line-height: 1.1; }
.ui.framed .wishplay h1 { top: calc(env(safe-area-inset-top) + 66px); }
.ui .wishplay .how { position: absolute; left: 16px; right: 16px; bottom: calc(env(safe-area-inset-bottom) + 64px); text-align: center; font-weight: 900; font-size: 20px; color: #a0607f; }
.ui .wishplay .dots { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 28px); display: flex; justify-content: center; gap: 8px; }
.ui .wishplay .dots i { width: 18px; height: 18px; border-radius: 9px; background: #fff; box-shadow: inset 0 0 0 3px #ffb3d1; transition: background 0.2s, transform 0.2s; }
.ui .wishplay .dots i.on { background: #ff6fa5; box-shadow: none; transform: scale(1.15); }
.ui .wishplay .kid { position: absolute; left: 50%; top: 58%; width: 190px; height: 190px; margin: -95px 0 0 -95px; touch-action: none; }
.ui .wishplay .kid img { width: 100%; height: 100%; display: block; pointer-events: none; -webkit-user-drag: none; }
.ui .wishplay .kid.boing { animation: boing 0.5s cubic-bezier(.3,1.6,.5,1); }
.ui .wishplay .kid.rock img { animation: rock 1.1s ease-in-out infinite; }
.ui .wishplay .kid.cheer { animation: cheer 0.8s cubic-bezier(.3,1.6,.5,1) 2; }
@keyframes boing { 0% { transform: scale(1.15, 0.85); } 40% { transform: translateY(-50px) scale(0.92, 1.1); } 100% { transform: none; } }
@keyframes rock { 0%,100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
@keyframes cheer { 0% { transform: scale(1); } 30% { transform: translateY(-40px) scale(1.12); } 60% { transform: scale(1.1, 0.9); } 100% { transform: none; } }
.ui .wishplay .ring { position: absolute; inset: -14px; width: calc(100% + 28px); height: calc(100% + 28px); pointer-events: none; transform: rotate(-90deg); }
.ui .wishplay .ring circle { fill: none; stroke-width: 10; stroke-linecap: round; }
.ui .wishplay .thing { position: absolute; width: 76px; height: 76px; margin: -38px 0 0 -38px; display: grid; place-items: center; font-size: 54px; line-height: 1; touch-action: none; cursor: pointer; }
.ui .wishplay .thing.float { animation: drift 2.4s ease-in-out infinite; }
.ui .wishplay .thing.popped { animation: popOut 0.35s ease-out forwards; pointer-events: none; }
.ui .wishplay .thing.home { transition: left 0.3s cubic-bezier(.3,1.5,.5,1), top 0.3s cubic-bezier(.3,1.5,.5,1); }
.ui .wishplay .thing.grab { transform: scale(1.25); filter: drop-shadow(0 8px 6px rgba(120,40,80,0.3)); }
@keyframes drift { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-14px) rotate(6deg); } }
@keyframes popOut { to { transform: scale(1.8); opacity: 0; } }
.ui .wishplay .puff { position: absolute; font-size: 30px; pointer-events: none; animation: puff 1.1s ease-out forwards; }
@keyframes puff { from { transform: translate(-50%, 0) scale(0.6); opacity: 1; } to { transform: translate(-50%, -110px) scale(1.2); opacity: 0; } }
.ui .wishplay .yay { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 36px; font-weight: 900; color: #e2508c; text-shadow: 0 3px 0 #fff; animation: cardIn 0.45s cubic-bezier(.3,1.6,.5,1); pointer-events: none; }
.ui .sheet .tip { text-align: center; font-weight: 800; font-size: 14px; color: #a0607f; margin: 12px 0 0; }
.ui .jobs { display: flex; align-items: center; gap: 4px; font-weight: 900; font-size: 15px; color: #2a86c4; background: rgba(255,255,255,0.7); padding: 3px 10px 3px 6px; border-radius: 999px; transition: transform 0.2s; }
.ui .jobs.beat { transform: scale(1.25); }
.ui .jobs svg { width: 20px; height: 20px; }

.ui .nav { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 16px calc(env(safe-area-inset-bottom) + 10px); display: flex; justify-content: space-around; align-items: flex-end; background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.55) 40%); }
.ui .nav button { width: 64px; display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; font-weight: 900; font-size: 12.5px; }
.ui .nav .ico { width: 52px; height: 52px; border-radius: 18px; display: grid; place-items: center; background: linear-gradient(180deg, #c9a8f0, #9a72e0); box-shadow: 0 4px 0 #7350b8; position: relative; }
.ui .nav .ico svg { width: 34px; height: 34px; }
.ui .nav .hats-btn .ico { background: linear-gradient(180deg, #ffd27a, #ffa83c); box-shadow: 0 4px 0 #d07a10; }
.ui .nav .places-btn .ico { background: linear-gradient(180deg, #8fdcff, #4fb3f0); box-shadow: 0 4px 0 #2a86c4; }
.ui .nav .open .ico { width: 64px; height: 64px; border-radius: 22px; background: linear-gradient(180deg, #ffb3d1, #ff5f9c); box-shadow: 0 5px 0 #c2346c; }
.ui .nav .dot { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 8px; background: #ff4f8d; border: 2px solid #fff; display: none; }
.ui .nav .dot.on { display: block; }
.ui .nav .open.ready .ico { animation: wiggle 1.2s ease-in-out infinite; }
.ui .nav .open.empty .ico { filter: grayscale(0.7) opacity(0.7); }
.ui .nav .badge { position: absolute; top: -6px; right: -6px; min-width: 24px; height: 24px; padding: 0 6px; box-sizing: border-box; border-radius: 12px; background: #ffd84d; color: #7a4a00; font-size: 15px; font-weight: 900; display: grid; place-items: center; box-shadow: 0 2px 0 #d4a000; }
@keyframes wiggle { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-9deg) scale(1.06); } 30% { transform: rotate(8deg) scale(1.06); } 45% { transform: rotate(0); } }

.ui .hint { position: absolute; left: 50%; top: calc(env(safe-area-inset-top) + 104px); transform: translateX(-50%); padding: 12px 22px; border-radius: 22px; background: rgba(255,255,255,0.9); box-shadow: 0 4px 0 rgba(200,110,150,0.3); font-weight: 900; font-size: 21px; line-height: 1.15; text-align: center; width: max-content; max-width: 88vw; box-sizing: border-box; text-wrap: balance; display: none; }
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

.ui .modal { position: absolute; inset: 0; z-index: 3; display: none; pointer-events: auto; background: rgba(90,40,80,0.35); align-items: center; justify-content: center; padding: 16px; }
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
.ui .card .arrived { margin: 4px 30px 0; font-weight: 900; font-size: 20px; line-height: 1.15; color: #fff; background: linear-gradient(180deg, #8fdcff, #4fb3f0); box-shadow: 0 3px 0 #2a86c4; border-radius: 16px; padding: 6px 10px; animation: wiggle 1.4s ease-in-out 2; }
.ui .card .came { font-weight: 800; font-size: 15px; color: #d07a10; margin: -6px 0 12px; }
.ui .card .btns.three { flex-wrap: wrap; gap: 8px; }
.ui .card .btns.three .big { font-size: 20px; padding: 12px 18px; display: inline-flex; align-items: center; gap: 6px; }
.ui .card .send { order: -1; flex: 1 1 100%; justify-content: center; background: linear-gradient(180deg, #8fdcff, #4fb3f0) !important; box-shadow: 0 5px 0 #2a86c4 !important; }
.ui .card .send .gift-sm { width: 24px; height: 24px; }
.ui .book .mailbox { margin: 4px 12px 0; padding: 10px 12px 8px; border-radius: 22px; background: linear-gradient(180deg, #eaf8ff, #d6f0ff); box-shadow: 0 3px 0 #a8dcf5; }
.ui .book .mtop { display: flex; align-items: center; gap: 10px; }
.ui .book .mico { position: relative; width: 48px; height: 48px; flex: none; }
.ui .book .mico svg { width: 48px; height: 48px; display: block; }
.ui .book .mico .badge { position: absolute; top: -6px; right: -8px; min-width: 22px; height: 22px; padding: 0 5px; box-sizing: border-box; border-radius: 11px; background: #ff5f9c; color: #fff; font-size: 14px; font-weight: 900; display: grid; place-items: center; }
.ui .book .mtxt { flex: 1; min-width: 0; text-align: left; line-height: 1.2; }
.ui .book .mtxt b { display: block; font-size: 18px; color: #2a86c4; }
.ui .book .mtxt small { display: block; font-size: 14px; font-weight: 800; color: #4f8fb8; }
.ui .book .mopen { flex: none; padding: 10px 18px; border-radius: 999px; font-size: 18px; font-weight: 900; color: #fff !important; background: linear-gradient(180deg, #ff9cc8, #ff4f8d); box-shadow: 0 4px 0 #c2346c; animation: wiggle 1.4s ease-in-out infinite; }
.ui .book .mpaste { display: block; margin: 8px auto 0; padding: 4px 8px; background: none; font-size: 13px; font-weight: 800; color: #4f8fb8; text-decoration: underline; }
.ui .move.gift .qr { width: min(56vw, 230px); }
.ui .move.gift .btns + .btns { margin-top: 10px; }
.ui .move.gift .off { font-size: 22px; padding: 14px 34px; }
.ui .card .repeat { font-weight: 800; font-size: 16px; color: #d48a00; margin: 8px 0 12px; }

/* Cards and sheets opened from the Book show over it (z-index 3 on .modal and .sheet). */
.ui .book { position: absolute; inset: 0; display: none; pointer-events: auto; background: linear-gradient(180deg, #fff4fa, #ffe6f1); overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.ui .book.on { display: block; }
.ui .book .head { position: sticky; top: 0; z-index: 2; padding: calc(env(safe-area-inset-top) + 12px) 70px 10px; text-align: center; background: linear-gradient(180deg, #fff4fa 80%, rgba(255,244,250,0)); }
.ui.framed .book .head { padding-top: calc(env(safe-area-inset-top) + 58px); }
.ui .book h1 { margin: 0; font-size: 28px; font-weight: 900; color: #e2508c; }
.ui .book .found { font-weight: 900; font-size: 18px; color: #9a72e0; }
.ui .book .back { position: absolute; top: calc(env(safe-area-inset-top) + 10px); left: 12px; width: 56px; height: 56px; border-radius: 28px; background: linear-gradient(180deg, #ffb3d1, #ff5f9c); box-shadow: 0 4px 0 #c2346c; }
.ui .book .back:active { transform: translateY(2px); box-shadow: 0 2px 0 #c2346c; }
.ui .book .done { display: block; margin: 22px auto 0; padding: 14px 40px; border-radius: 999px; font-size: 22px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #ffb3d1, #ff5f9c); box-shadow: 0 5px 0 #c2346c; }
.ui.book-on .gear, .ui.wish-on .gear { display: none; }
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
.ui .book .cell .lock { position: absolute; right: 6px; top: 3px; font-size: 12px; z-index: 1; }
.ui .book .pad { height: calc(env(safe-area-inset-bottom) + 30px); }

.ui .sheet { position: absolute; inset: 0; z-index: 3; display: none; pointer-events: auto; background: rgba(90,40,80,0.35); align-items: flex-end; justify-content: center; }
.ui .sheet.on { display: flex; }
.ui .sheet .panel { width: 100%; max-width: 520px; max-height: 82vh; overflow-y: auto; border-radius: 28px 28px 0 0; background: linear-gradient(180deg, #fff, #fff3f8); padding: 18px 16px calc(env(safe-area-inset-bottom) + 20px); box-sizing: border-box; animation: up 0.35s cubic-bezier(.3,1.4,.5,1); position: relative; touch-action: pan-y; }
@keyframes up { from { transform: translateY(60%); } to { transform: none; } }
.ui .sheet h1 { margin: 0 0 4px; font-size: 26px; font-weight: 900; color: #e2508c; text-align: center; }
.ui .sheet .sub { text-align: center; font-weight: 800; font-size: 15px; color: #a0607f; margin-bottom: 12px; }
.ui .sheet .close { position: absolute; top: 12px; right: 12px; }
.ui .sheet .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ui .sheet .cell { border-radius: 20px; background: #fff; box-shadow: 0 3px 0 #f3c6da; padding: 4px 4px 8px; font-weight: 900; font-size: 13px; color: #7350b8; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ui .sheet .cell img, .ui .sheet .cell .none { width: 84px; height: 84px; display: block; }
.ui .sheet .cell .none { display: grid; place-items: center; font-size: 36px; color: #e6c6da; }
.ui .sheet .cell.on { background: #ffe9f2; box-shadow: 0 0 0 3px #ff5f9c, 0 3px 0 #f3c6da; }
.ui .sheet .cell.missing img { filter: brightness(0) opacity(0.15); }
.ui .sheet .cell.missing { color: #c9b0d6; background: #f6eef7; box-shadow: 0 3px 0 #e6d6ec; }
.ui .sheet .cell.wobble { animation: wiggle 0.5s; }
.ui .places { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ui .places button { border-radius: 22px; overflow: hidden; background: #fff; box-shadow: 0 4px 0 #e6c6da; padding: 0 0 8px; font-weight: 900; font-size: 17px; color: #5a2a4a; }
.ui .places button.on { box-shadow: 0 0 0 4px #ff5f9c, 0 4px 0 #e6c6da; }
.ui .places svg { width: 100%; height: auto; display: block; margin-bottom: 6px; }
.ui .places small { display: block; font-size: 12px; font-weight: 800; color: #a0607f; }
.ui .places button.locked { position: relative; }
.ui .places button.locked svg { filter: saturate(0.35) opacity(0.7); }
.ui .places button.locked .lock { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: 15px; background: #fff; display: grid; place-items: center; font-size: 16px; box-shadow: 0 2px 0 #e6c6da; }
.ui .full ul { margin: 4px 6px 12px; padding-left: 22px; font-weight: 800; font-size: 16px; color: #5a2a4a; line-height: 1.45; }
.ui .full .tip, .ui .gate .tip { text-align: center; font-weight: 800; font-size: 13px; color: #a0607f; margin: 10px 4px 0; line-height: 1.35; }
.ui .full .btns, .ui .gate .btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
.ui .full .btns .big, .ui .gate .btns .big { font-size: 18px; padding: 12px 20px; }
.ui .full .btns .big:disabled { filter: grayscale(0.7) opacity(0.6); }
.ui .full .link { background: none; font-weight: 900; font-size: 15px; color: #9a72e0 !important; text-decoration: underline; padding: 8px; }
.ui .full .test { border: 3px dashed #c9b0d6; border-radius: 16px; padding: 8px; margin-top: 12px; text-align: center; font-weight: 800; font-size: 13px; color: #9a8aa3; }
.ui .gate .ask { text-align: center; font-weight: 900; font-size: 20px; color: #5a2a4a; margin: 6px 0 10px; }
.ui .gate input { display: block; margin: 0 auto; width: 140px; box-sizing: border-box; border-radius: 14px; border: 3px solid #f3c6da; padding: 10px; font: inherit; font-size: 24px; font-weight: 900; text-align: center; color: #5a2a4a; pointer-events: auto; -webkit-user-select: text; user-select: text; }
.ui .row { display: flex; align-items: center; gap: 12px; margin: 14px 4px; font-weight: 900; font-size: 20px; }
.ui .row .lbl { width: 72px; }
.ui .row input[type=range] { flex: 1; pointer-events: auto; accent-color: #ff5f9c; height: 34px; }
.ui .row .sm { width: 26px; text-align: center; font-size: 26px; color: #c58ab0; }
.ui .toggle { padding: 10px 22px; border-radius: 999px; font-weight: 900; font-size: 18px; background: #ffe0ec; color: #e2508c !important; }
.ui .toggle.off { background: #eee6ef; color: #9a8aa3 !important; }
.ui .row.grown .lbl { width: auto; font-size: 16px; color: #a0607f; }
.ui .row.grown .toggle { font-size: 16px; padding: 10px 16px; }
.ui .move .qr { width: min(78vw, 340px); margin: 6px auto 10px; background: #fff; border-radius: 16px; padding: 6px; box-shadow: 0 3px 0 #f3c6da; }
.ui .move .qr svg { display: block; width: 100%; height: auto; }
.ui .move .btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ui .move .btns .big { font-size: 18px; padding: 12px 20px; }
.ui .move textarea { display: block; width: 100%; height: 64px; box-sizing: border-box; border-radius: 14px; border: 3px dashed #f3c6da; padding: 8px; font: inherit; font-size: 14px; color: #5a2a4a; pointer-events: auto; -webkit-user-select: text; user-select: text; resize: none; margin-bottom: 10px; }
.ui .move hr { border: 0; border-top: 2px dashed #f3c6da; margin: 16px 0 12px; }
.ui .picks { display: flex; justify-content: center; gap: 12px; margin: 10px 0 16px; }
.ui .picks button { width: 92px; border-radius: 20px; background: #fff; box-shadow: 0 3px 0 #f3c6da; padding: 4px 4px 8px; font-weight: 900; font-size: 13px; }
.ui .picks img { width: 84px; height: 84px; display: block; }
.ui .toast { position: absolute; z-index: 4; top: calc(env(safe-area-inset-top) + 28%); left: 50%; transform: translate(-50%, -50%) scale(0.7); opacity: 0; width: max-content; max-width: min(84vw, 340px); box-sizing: border-box; padding: 8px 16px; border-radius: 18px; background: rgba(255,255,255,0.88); box-shadow: 0 3px 0 rgba(200,110,150,0.3), 0 8px 20px rgba(160,60,110,0.15); font-weight: 900; font-size: 17px; line-height: 1.2; color: #e2508c; text-align: center; text-wrap: balance; transition: opacity 0.25s, transform 0.35s cubic-bezier(.3,1.7,.5,1); }
.ui .toast.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.ui .float-btn { position: absolute; bottom: calc(env(safe-area-inset-bottom) + var(--tray-h) + 10px); width: 64px; display: none; flex-direction: column; align-items: center; gap: 2px; background: none; font-weight: 900; font-size: 12.5px; text-shadow: 0 1px 0 rgba(255,255,255,0.8); transition: bottom 0.38s cubic-bezier(.4,0,.2,1); }
.ui .closet.tray-down .float-btn { bottom: calc(env(safe-area-inset-bottom) + 10px); }
.ui .float-btn.on { display: flex; }
.ui .float-btn .ico { width: 56px; height: 56px; border-radius: 28px; display: grid; place-items: center; position: relative; }
.ui .float-btn .ico svg { width: 40px; height: 40px; }
.ui .float-btn:active .ico { transform: translateY(2px); }
.ui .care-btn { right: 8px; }
.ui .care-btn .ico { background: linear-gradient(180deg, #ffc9de, #ff86b4); box-shadow: 0 4px 0 #d9548a; }
.ui .care-btn .badge { position: absolute; top: -6px; right: -6px; min-width: 24px; height: 24px; padding: 0 6px; box-sizing: border-box; border-radius: 12px; background: #fff; color: #e2508c; font-size: 15px; font-weight: 900; display: grid; place-items: center; box-shadow: 0 2px 0 #f3b3cf; }
.ui .care-btn.all .badge { background: #bdf0c8; color: #2d7a43; box-shadow: 0 2px 0 #8fd1a0; }
.ui .sheet .care { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ui .sheet .care button { position: relative; border-radius: 24px; background: #fff; box-shadow: 0 4px 0 #f3c6da; padding: 14px 6px 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-weight: 900; font-size: 19px; color: #e2508c; }
.ui .sheet .care button > i { font-style: normal; font-size: 46px; line-height: 1.1; }
.ui .sheet .care button small { font-size: 13px; font-weight: 800; color: #a0607f; }
.ui .sheet .care button:active { transform: translateY(2px); box-shadow: 0 2px 0 #f3c6da; }
.ui .sheet .care button.done { background: #effbf1; box-shadow: 0 4px 0 #bfe6c8; color: #2d7a43; }
.ui .sheet .care button.done small { color: #4f9a63; }
.ui .sheet .care button.done::after { content: "✓"; position: absolute; top: 8px; right: 10px; width: 26px; height: 26px; border-radius: 13px; background: #5cc27a; color: #fff; font-size: 17px; display: grid; place-items: center; }
.ui .sheet .present { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 10px 14px; border-radius: 20px; background: linear-gradient(180deg, #fff6c9, #ffe58a); box-shadow: 0 3px 0 #e8c24e; font-weight: 900; font-size: 15px; color: #8a5a00; line-height: 1.25; }
.ui .sheet .present > i { font-style: normal; font-size: 32px; }
.ui .sheet .present.got { background: #effbf1; box-shadow: 0 3px 0 #bfe6c8; color: #2d7a43; }
.ui .card .big-ico { font-size: 92px; line-height: 1.1; margin: 8px 0 2px; animation: wiggle 1.4s ease-in-out 2; }
.ui .card .loot { display: flex; justify-content: center; gap: 10px; margin: 12px 0 16px; }
.ui .card .loot span { padding: 8px 14px; border-radius: 999px; background: #fff3d1; color: #9a6400; font-weight: 900; font-size: 20px; }
.ui .spooky-btn { left: 8px; }
.ui .spooky-btn .ico { background: linear-gradient(180deg, #ffc37a, #ff8a1f); box-shadow: 0 4px 0 #c25a0a; }
.ui .spooky-btn.ready .ico { animation: wiggle 1.2s ease-in-out infinite; box-shadow: 0 4px 0 #c25a0a, 0 0 18px 4px rgba(255,170,60,0.75); }
.ui .spooky-btn.soon .ico { background: linear-gradient(180deg, #d8c2ff, #8a5cf0); box-shadow: 0 4px 0 #5a3aa8; }
.ui .spooky-btn .badge { position: absolute; top: -6px; right: -6px; min-width: 24px; height: 24px; padding: 0 6px; box-sizing: border-box; border-radius: 12px; background: #8a5cf0; color: #fff; font-size: 15px; font-weight: 900; display: grid; place-items: center; box-shadow: 0 2px 0 #5a3aa8; }
.ui.framed .bath .bath-top { top: calc(env(safe-area-inset-top) + 58px); }
.ui .bath .bath-top { position: absolute; left: 50%; top: calc(env(safe-area-inset-top) + 12px); transform: translateX(-50%); width: min(80vw, 360px); box-sizing: border-box; padding: 10px 14px 12px; border-radius: 24px; background: rgba(255,255,255,0.9); box-shadow: 0 4px 0 rgba(90,170,220,0.35); text-align: center; }
.ui .bath .steps { display: flex; justify-content: center; gap: 8px; margin-bottom: 4px; }
.ui .bath .steps i { font-style: normal; width: 36px; height: 36px; border-radius: 18px; display: grid; place-items: center; font-size: 20px; background: #eef8ff; filter: grayscale(0.8) opacity(0.6); transition: transform 0.25s, filter 0.25s; }
.ui .bath .steps i.on { filter: none; background: #bff0ff; transform: scale(1.2); box-shadow: 0 0 0 3px #6fcff5; }
.ui .bath .steps i.done { filter: none; background: #d6f7dd; }
.ui .bath .bath-title { font-size: 24px; font-weight: 900; color: #2a86c4; line-height: 1.1; }
.ui .bath .bath-how { font-size: 15px; font-weight: 800; color: #4f8fb8; margin-top: 2px; }
.ui .bath .bath-bar { height: 12px; border-radius: 6px; background: #e1f3fc; overflow: hidden; margin-top: 8px; }
.ui .bath .bath-bar i { display: block; height: 100%; width: 0%; border-radius: 6px; background: linear-gradient(90deg, #8fdcff, #4fb3f0); transition: width 0.2s; }
.ui .bath .bath-x { position: absolute; top: calc(env(safe-area-inset-top) + 12px); right: 12px; }
.ui.framed .bath .bath-x { top: calc(env(safe-area-inset-top) + 64px); }
.ui.bath-on .gear { display: none; }
.ui .card .special { margin: 2px auto 0; display: inline-block; padding: 4px 12px; border-radius: 999px; background: linear-gradient(180deg, #ffc37a, #ff8a1f); color: #fff; font-weight: 900; font-size: 15px; box-shadow: 0 3px 0 #c25a0a; }
.ui .book .note { margin: -4px 16px 8px; font-weight: 800; font-size: 13px; color: #c25a0a; }
@media (max-height: 700px) { .ui .hint { font-size: 20px; padding: 8px 16px; } .ui .hint small { font-size: 13px; } .ui .skip { top: calc(env(safe-area-inset-top) + 186px); } }
@media (max-width: 350px) { .ui .nav button { width: 56px; font-size: 11px; } .ui .nav .ico { width: 46px; height: 46px; } .ui .nav .open .ico { width: 56px; height: 56px; } }
@media (max-height: 600px) { .ui .closet { --tray-h: 164px; } .ui .shelf { height: 70px; } .ui .shelf img { width: 60px; height: 60px; } .ui .shelf button { width: 60px; height: 62px; } .ui .card img { width: 140px; height: 140px; } }
`;

const HEART = `<svg class="heart" viewBox="0 0 32 32"><path d="M16 28C7 21 3 17 3 11c0-5 4-8 8-8 2.5 0 4 1.2 5 3 1-1.8 2.5-3 5-3 4 0 8 3 8 8 0 6-4 10-13 17z" fill="#ff4f8d" stroke="#fff" stroke-width="2.5"/><ellipse cx="10" cy="10" rx="2.6" ry="1.8" fill="#fff" opacity=".8" transform="rotate(-35 10 10)"/></svg>`;
/** A little steamer basket with a bow: a squishy box. */
const GIFT = `<svg viewBox="0 0 40 40"><rect x="5" y="17" width="30" height="17" rx="5" fill="#ffe6c4" stroke="#fff" stroke-width="2"/><path d="M5 23h30" stroke="#e3b27a" stroke-width="2"/><rect x="3" y="11" width="34" height="8" rx="4" fill="#fff6e8" stroke="#fff" stroke-width="2"/><path d="M20 11v23" stroke="#ff7fb0" stroke-width="4"/><path d="M20 11c-4-7-11-6-9-1 1 2 5 2 9 1zM20 11c4-7 11-6 9-1-1 2-5 2-9 1z" fill="#ff7fb0"/></svg>`;
const GIFT_SM = `<svg class="gift-sm" viewBox="0 0 40 40"><rect x="7" y="17" width="26" height="16" rx="4" fill="#fff"/><rect x="5" y="11" width="30" height="8" rx="4" fill="#fff"/><path d="M20 11v22" stroke="#9a72e0" stroke-width="4"/><path d="M20 11c-4-7-11-6-9-1 1 2 5 2 9 1zM20 11c4-7 11-6 9-1-1 2-5 2-9 1z" fill="#fff"/></svg>`;
const MAILBOX = `<svg viewBox="0 0 48 48"><path d="M8 20a10 10 0 0 1 20 0v18H8z" fill="#8fdcff"/><path d="M18 10h12a10 10 0 0 1 10 10v18H28V20a10 10 0 0 0-10-10z" fill="#4fb3f0"/><rect x="21" y="38" width="6" height="8" rx="2" fill="#c98d58"/><rect x="11" y="24" width="14" height="4" rx="2" fill="#fff"/><path d="M40 16v-8h-7v5h4v3z" fill="#ff5f9c"/><circle cx="18" cy="32" r="3.2" fill="#ffd84d"/></svg>`;
const BOOK = `<svg viewBox="0 0 40 40"><path d="M7 7c5-2 9-1 13 2v24c-4-3-8-4-13-2z" fill="#fff"/><path d="M33 7c-5-2-9-1-13 2v24c4-3 8-4 13-2z" fill="#fff4fb"/><path d="M12 15c1.5-1 3.5-1 5 0M12 20c1.5-1 3.5-1 5 0" stroke="#c9a8f0" stroke-width="2" stroke-linecap="round"/><circle cx="26.5" cy="17" r="4" fill="#ffb3d1"/></svg>`;
const ISLAND = `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="30" rx="16" ry="5" fill="#8fd8f0"/><ellipse cx="20" cy="27" rx="12" ry="5" fill="#ffe2b0"/><ellipse cx="20" cy="25" rx="9" ry="3.5" fill="#bfeaa0"/><path d="M19 25c0-6 1-11 3-14" stroke="#c98d58" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M22 11c-4-2-8-1-9 2 3-1 6 0 9-2zM22 11c3-3 8-3 9 0-3-1-6 0-9 0zM22 11c1 3 0 6-3 8 1-3 1-6 3-8z" fill="#7fc65a"/></svg>`;
const HAT = `<svg viewBox="0 0 40 40"><path d="M8 29c0-8 5-17 12-17s12 9 12 17z" fill="#fff"/><path d="M5 29h30c0 3-6 4-15 4S5 32 5 29z" fill="#fff6e0"/><path d="M9 24h22" stroke="#ff7fb0" stroke-width="4"/><circle cx="20" cy="10" r="4" fill="#ff7fb0"/></svg>`;
const PLACE = `<svg viewBox="0 0 40 40"><path d="M4 27c5-3 9 3 16 0s11 3 16 0v7H4z" fill="#fff"/><path d="M20 6v18" stroke="#fff6e0" stroke-width="2.5"/><path d="M21 7l10 15H21z" fill="#fff"/><path d="M19 10l-8 12h8z" fill="#ffe0ec"/><path d="M10 24h20l-3 4H13z" fill="#ffd27a"/></svg>`;
const GEAR = `<svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 4l2 .3.7 2.4 2 1 2.3-1 1.6 1.6-1 2.3 1 2 2.4.7v2.3l-2.4.7-1 2 1 2.3-1.6 1.6-2.3-1-2 1-.7 2.4h-2.3l-.7-2.4-2-1-2.3 1L6.4 21l1-2.3-1-2L4 16v-2.3l2.4-.7 1-2-1-2.3L8 7.1l2.3 1 2-1L13 4.3z" fill="#e2508c"/><circle cx="14" cy="14.8" r="4" fill="#fff"/></svg>`;
const JOBS = `<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="19" rx="4" fill="#8fdcff"/><rect x="8" y="1.5" width="8" height="4" rx="2" fill="#2a86c4"/><path d="M8 13l3 3 5-6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CARE = `<svg viewBox="0 0 40 40"><path d="M20 34C9 26 5 21 5 14.5 5 9 9.5 6 13.5 6c3 0 5 1.5 6.5 3.6C21.5 7.5 23.5 6 26.5 6 30.5 6 35 9 35 14.5 35 21 31 26 20 34z" fill="#fff"/><path d="M31 3l1.2 3 3 1.2-3 1.2L31 11.4l-1.2-3-3-1.2 3-1.2z" fill="#fff6a8"/><ellipse cx="13" cy="13" rx="3" ry="2" fill="#ffd6e6" transform="rotate(-35 13 13)"/></svg>`;
const PUMPKIN = `<svg viewBox="0 0 40 40"><path d="M20 9c1-4 3-5 6-5" stroke="#4f7a2a" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="13" cy="23" rx="9" ry="12" fill="#ffb347"/><ellipse cx="27" cy="23" rx="9" ry="12" fill="#ffb347"/><ellipse cx="20" cy="23" rx="9" ry="12.5" fill="#ffc870"/><path d="M12 19l4-5 4 5zM20 19l4-5 4 5z" fill="#7a3a0a"/><path d="M11 25q9 9 18 0q-9 4-18 0z" fill="#7a3a0a"/></svg>`;
/** The pull tab's arrow: points down to slide the shelf away (turned up when it's away). */
const CHEVRON = `<svg viewBox="0 0 22 14"><path d="M3 3l8 8 8-8" fill="none" stroke="#e2508c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const HOUSE = `<svg viewBox="0 0 20 20"><path d="M3 10l7-6 7 6v7H3z" fill="#9a72e0"/><rect x="8" y="12" width="4" height="5" rx="1" fill="#fff"/></svg>`;
/** Little pictures of each place for the place picker. */
const PLACE_PICS: Record<PlaceId, string> = {
  table: `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#ffd3ea"/><ellipse cx="80" cy="92" rx="90" ry="30" fill="#ffe6ee"/><rect x="104" y="44" width="34" height="26" rx="6" fill="#fff3f8"/><rect x="109" y="30" width="24" height="16" rx="5" fill="#ffc6df"/><circle cx="121" cy="27" r="4" fill="#ff4f6a"/><ellipse cx="48" cy="70" rx="17" ry="13" fill="#fff"/><circle cx="48" cy="55" r="4" fill="#ff9ec4"/><path d="M64 66l12-8" stroke="#fff" stroke-width="5" stroke-linecap="round"/><ellipse cx="80" cy="84" rx="16" ry="7" fill="#e3b27a"/><ellipse cx="80" cy="78" rx="12" ry="9" fill="#f2a9cf"/></svg>`,
  beach: `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#9fdcff"/><circle cx="128" cy="22" r="13" fill="#fff3b0"/><rect y="46" width="160" height="16" fill="#5cc8ec"/><path d="M0 60c20-4 40 4 60 0s40 4 60 0 30 2 40 0v40H0z" fill="#f8deaa"/><path d="M28 70c2-14 4-24 12-34" stroke="#c98d58" stroke-width="5" fill="none"/><path d="M40 36c-10-6-22-2-24 4 8-3 16-2 24-4zM40 36c6-9 18-8 22-2-8-2-15 0-22 2zM40 36c0 9-4 15-10 18 2-8 5-13 10-18z" fill="#5cbf4a"/><path d="M100 78l18-22 18 22z" fill="#ff7fb0"/><path d="M118 56v26" stroke="#fff" stroke-width="2.5"/><rect x="66" y="74" width="20" height="12" rx="2" fill="#efc98a"/><rect x="69" y="66" width="5" height="9" fill="#efc98a"/><rect x="78" y="66" width="5" height="9" fill="#efc98a"/></svg>`,
  boat: `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#bfe6ff"/><rect y="62" width="160" height="38" fill="#3fa9e0"/><path d="M10 72c10 2 20-2 30 0s20 2 30 0" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/><path d="M30 66h100l-14 22H44z" fill="#e8b98a"/><path d="M28 64h104" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M80 12v52" stroke="#c98d58" stroke-width="4"/><path d="M82 14c22 10 30 26 28 44H82z" fill="#fff"/><path d="M82 40h28v6H82z" fill="#ffc6df"/><path d="M80 12l14 4-14 4z" fill="#ff5f9c"/></svg>`,
  city: `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#cfe8ff"/><rect x="6" y="22" width="30" height="50" fill="#ffc6df"/><rect x="38" y="34" width="28" height="38" fill="#c9e7a6"/><rect x="68" y="14" width="30" height="58" fill="#c9b8ff"/><rect x="100" y="30" width="26" height="42" fill="#ffe0a8"/><rect x="128" y="20" width="30" height="52" fill="#a8e0ff"/><g fill="#fff"><rect x="12" y="30" width="7" height="9"/><rect x="24" y="30" width="7" height="9"/><rect x="12" y="46" width="7" height="9"/><rect x="24" y="46" width="7" height="9"/><rect x="74" y="22" width="7" height="9"/><rect x="86" y="22" width="7" height="9"/><rect x="74" y="38" width="7" height="9"/><rect x="86" y="38" width="7" height="9"/><rect x="134" y="28" width="7" height="9"/><rect x="146" y="28" width="7" height="9"/></g><rect y="72" width="160" height="12" fill="#b9b3cc"/><path d="M8 78h14M34 78h14M60 78h14M86 78h14M112 78h14M138 78h14" stroke="#fff3a8" stroke-width="2"/><rect y="84" width="160" height="16" fill="#f6e6ee"/><rect x="96" y="68" width="34" height="12" rx="6" fill="#ff8fbf"/><circle cx="104" cy="81" r="3.5" fill="#4a4458"/><circle cx="122" cy="81" r="3.5" fill="#4a4458"/><circle cx="30" cy="62" r="9" fill="#8fd27a"/><rect x="29" y="68" width="2.5" height="10" fill="#c98d58"/></svg>`,
  room: `<svg viewBox="0 0 160 100"><rect width="160" height="100" fill="#fde3ee"/><rect y="70" width="160" height="30" fill="#e9c49a"/><rect x="58" y="14" width="44" height="30" rx="3" fill="#bfe6ff" stroke="#fff" stroke-width="4"/><rect x="34" y="46" width="64" height="26" rx="8" fill="#9fc4ff"/><rect x="34" y="56" width="64" height="12" rx="4" fill="#b8d4ff"/><rect x="112" y="20" width="22" height="50" rx="3" fill="#e8b98a"/><rect x="116" y="26" width="4" height="12" fill="#ff7fb0"/><rect x="122" y="28" width="4" height="10" fill="#7fc8f0"/><rect x="116" y="46" width="4" height="12" fill="#ffd84d"/><ellipse cx="78" cy="88" rx="40" ry="8" fill="#ffc6df"/></svg>`,
};
const STAR = `<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z" fill="#ffd84d" stroke="#fff" stroke-width="1.5"/></svg>`;
const PEN = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ff7fb0"/><path d="M4 20l1-5 4 4z" fill="#ffd6e6"/></svg>`;
const BACK = `<svg width="30" height="30" viewBox="0 0 30 30"><path d="M18 6l-9 9 9 9" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CLOSE = `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#e2508c" stroke-width="3.5" stroke-linecap="round"/></svg>`;
/** A pointing hand, finger tip at the top left. */
const HAND = `<svg viewBox="0 0 64 64"><path d="M22 6c3 0 5 2 5 5v17l3-1c2-1 5 0 6 2 2-1 5 0 6 2 2-1 6 0 6 3v12c0 9-6 15-15 15h-3c-6 0-10-3-13-8l-8-13c-1-2 0-5 3-5 2 0 3 1 4 2l2 3V11c0-3 2-5 4-5z" fill="#fff" stroke="#5a2a4a" stroke-width="3" stroke-linejoin="round"/><path d="M30 29v8M36 31v7M42 33v6" stroke="#5a2a4a" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export type Screen = "title" | "closet" | "box" | "bath";
export type ShelfState = "held" | "out" | "rest" | "baby";
export type HandMove = "press" | "pet" | "tickle" | "toss" | "tap" | "hug";

export interface UiHandlers {
  play(): void;
  toggleSound(): boolean;
  openBox(): void;
  openBook(): void;
  goIsland(): void;
  /** Tapped a squishy on the shelf. */
  shelfTap(id: string): void;
  /** Sent a friend in to rest from the shelf. */
  sendIn(id: string): void;
  hold(id: string): void;
  rename(id: string, name: string): void;
  skipTutorial(): void;
  /** The hats sheet: which hat the held squishy wears, and every hat. */
  hats(): { wearing: string | null; have: string[]; who: string };
  wearHat(id: string | null): void;
  goPlace(id: PlaceId): void;
  place(): PlaceId;
  zoom(): number;
  setZoom(z: number): void;
  sound(): boolean;
  /** Something opened or closed over the game. */
  covered(on: boolean): void;
  /** A baby on the shelf was tapped. */
  babyTap(key: string): void;
  teach(key: string, mood: MoodId): void;
  renameBaby(key: string, name: string): void;
  /** Do what a baby wants (from its card). */
  doWish(key: string): void;
  /** A link that carries the whole collection to another phone. */
  moveLink(): Promise<string>;
  /** Squishies from another phone's link or code: how many were new, or null when it isn't a good code. */
  bringIn(text: string): Promise<number | null>;
  /** Send a friend a twin of `id` (from its card in the Book). */
  share(id: string): void;
  /** Gifts waiting in the squishy inbox. */
  mail(): number;
  /** Open the next gift in the inbox. */
  openMail(): void;
  /** A squishy link pasted into the Book: what to tell the kid. */
  receive(text: string): string;
  /** Today's care for the one you hold, or null when there is nobody to hold. */
  careInfo(): { who: string; done: CareId[]; days: number } | null;
  /** Do one of the day's care things (the bath starts bath time). */
  care(id: CareId): void;
  /** Closed the bath before it was done. */
  closeBath(): void;
  /** The Spooky Box button. */
  openSpooky(): void;
  /** The shelf and buttons were slid down (true) or brought back up (false). */
  tray(down: boolean): void;
  /** The full game: does this phone have it and why, is anything locked in this build, is it a preview build. */
  full(): { has: boolean; why: FullWhy | null; locks: boolean; test: boolean };
  /** Can the full game be bought right now, and its price as the store shows it. */
  shopInfo(): Promise<{ ready: boolean; price: string | null }>;
  /** Buy the full game (or, in a preview build, a test unlock). */
  buyFull(test: boolean): Promise<BuyResult>;
  /** Find a purchase made before. */
  restoreFull(): Promise<BuyResult>;
  /** Preview builds only: back to the free game. */
  relock(): void;
}

export interface BabyInfo {
  key: string;
  def: SquishyDef;
  name: string;
  /** "6 days" until it grows up. */
  left: string;
  /** Who it's becoming, or null while it's too early to tell. */
  becoming: Mood | null;
  napping: boolean;
  /** How grown up, 0 to 1. */
  grow: number;
  /** What it wants to do right now. */
  want: MoodId | null;
}

export interface WishGame {
  def: SquishyDef;
  name: string;
  want: MoodId;
  /** A game of its own (daily care), instead of the one for `want`. */
  wish?: Wish;
  /** A happy sound: each step, and when it's all done. */
  beat(done: boolean, step: number): void;
}

export interface CardInfo {
  def: SquishyDef;
  name: string;
  isNew?: boolean;
  /** Stars given for a squishy you already had. */
  stars?: number;
  /** Shown from the Book: offer to hold it. */
  fromBook?: boolean;
  mood?: MoodId;
  /** It just grew up from a baby. */
  grew?: boolean;
  /** It came in the mail from a friend. */
  arrived?: boolean;
  /** The hat it came wearing, when that hat is new to you. */
  cameWith?: string;
}

/** Where a new hat came from, on its card. */
const HAT_FROM: Record<HatDef["from"], string> = {
  gift: "A present for you!",
  place: "Your friends found it!",
  box: "It came in the box!",
  spooky: "It came in the Spooky Box!",
  bath: "For bath time!",
};

/** A few words under each care tile. */
const CARE_HOW: Record<CareId, string> = { feed: "A yummy snack", bath: "Scrub-a-dub", nap: "Rock to sleep", play: "A fun game" };

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
  private sheetEl: HTMLElement;
  private wishEl: HTMLElement;
  private wishDone: ((did: boolean) => void) | null = null;
  /** The wish was done and it's cheering: closing it now still counts. */
  private wishWon = false;
  private jobsEl: HTMLElement;
  private cookiesEl: HTMLElement;
  private hatsDot: HTMLElement;
  private mailDot: HTMLElement;
  private tabEl: HTMLElement;
  private tabDot: HTMLElement;
  private down = false;
  /** A finger that may be swiping the shelf down or the tab up. */
  private swipe: { id: number; x: number; y: number } | null = null;
  /** When a swipe moved the shelf, so the tap it ends on doesn't count too. */
  private swipedAt = -1;

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
    // Played inside TrueAIGaming's page, its own buttons float over the top middle: keep titles below them.
    if (window.parent !== window) this.root.classList.add("framed");
    this.root.innerHTML = `
      <div class="layer title">
        <div class="logo">Aurora's<br>World<small>Squishy Island</small></div>
        <button class="play">Play!</button>
      </div>
      <div class="layer closet">
        <div class="love">${HEART}<div class="bar"><div class="fill"></div></div><span class="gift">${GIFT}</span></div>
        <div class="pills"><div class="stars">${STAR}<span>0</span></div><div class="jobs">${JOBS}<span>0</span></div><div class="cookies"><i>🍪</i><span>0</span></div></div>
        <div class="tray">
        <div class="plank"></div>
        <div class="shelf"></div>
        <div class="nav">
          <button class="book-btn"><span class="ico">${BOOK}<i class="dot"></i></span>Book</button>
          <button class="hats-btn"><span class="ico">${HAT}<i class="dot"></i></span>Hats</button>
          <button class="open"><span class="ico">${GIFT}<span class="badge">0</span></span>Open</button>
          <button class="places-btn"><span class="ico">${PLACE}</span>Places</button>
          <button class="island-btn"><span class="ico">${ISLAND}</span>Island</button>
        </div>
        </div>
        <button class="tray-tab" aria-label="Hide the shelf"><span class="pill">${CHEVRON}<i class="dot"></i></span></button>
        <button class="float-btn spooky-btn"><span class="ico">${PUMPKIN}<span class="badge">0</span></span><span class="lbl">Spooky</span></button>
        <button class="float-btn care-btn"><span class="ico">${CARE}<span class="badge">4</span></span>Care</button>
      </div>
      <div class="layer box"></div>
      <div class="layer bath">
        <button class="round bath-x" aria-label="Close">${CLOSE}</button>
        <div class="bath-top">
          <div class="steps"><i>🛁</i><i>🧼</i><i>🚿</i><i>💨</i></div>
          <div class="bath-title"></div>
          <div class="bath-how"></div>
          <div class="bath-bar"><i></i></div>
        </div>
      </div>
      <div class="hint"></div>
      <button class="skip">Skip</button>
      <div class="hand">${HAND}</div>
      <div class="modal"></div>
      <div class="sheet"></div>
      <div class="book"></div>
      <div class="wishplay"></div>
      <div class="toast"></div>`;
    document.body.appendChild(this.root);
    const q = <T extends Element = HTMLElement>(sel: string) => this.root.querySelector(sel) as unknown as T;
    this.layers = { title: q(".title"), closet: q(".closet"), box: q(".layer.box"), bath: q(".layer.bath") };
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
    this.sheetEl = q(".sheet");
    this.wishEl = q(".wishplay");
    this.jobsEl = q(".jobs");
    this.cookiesEl = q(".cookies");
    this.hatsDot = q(".hats-btn .dot");
    this.mailDot = q(".book-btn .dot");
    this.tabEl = q(".tray-tab");
    this.tabDot = q(".tray-tab .dot");
    this.wireTray(q(".tray"));
    q(".hats-btn").addEventListener("click", () => this.hatsSheet());
    q(".care-btn").addEventListener("click", () => this.careSheet());
    q(".spooky-btn").addEventListener("click", () => h.openSpooky());
    q(".bath-x").addEventListener("click", () => h.closeBath());
    q(".places-btn").addEventListener("click", () => this.placesSheet());
    this.sheetEl.addEventListener("click", (e) => {
      if (e.target === this.sheetEl) this.closeSheet();
    });
    q(".play").addEventListener("click", () => h.play());
    this.openBtn.addEventListener("click", () => h.openBox());
    q(".book-btn").addEventListener("click", () => h.openBook());
    q(".island-btn").addEventListener("click", () => h.goIsland());
    this.skipEl.addEventListener("click", () => h.skipTutorial());
    // One settings button, on every screen: sound and zoom.
    const gear = document.createElement("button");
    gear.className = "round gear";
    gear.setAttribute("aria-label", "Settings");
    gear.innerHTML = GEAR;
    gear.addEventListener("click", () => this.settingsSheet());
    this.root.appendChild(gear);
    void sound;
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.closeCard();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.wishEl.classList.contains("on")) this.endWish(false);
      else if (this.sheetEl.classList.contains("on")) this.closeSheet();
      else if (this.bookEl.classList.contains("on") && !this.modal.classList.contains("on")) this.closeBook();
    });
  }

  show(screen: Screen): void {
    for (const [k, el] of Object.entries(this.layers)) el.classList.toggle("on", k === screen);
    this.root.classList.toggle("bath-on", screen === "bath");
  }

  /** The title says Happy Halloween all October. */
  halloween(on: boolean): void {
    this.root.querySelector(".title .logo small")!.textContent = on ? "Happy Halloween!" : "Squishy Island";
  }

  /** Care (and the bath inside it) can start once the tutorial is done. */
  setCareReady(on: boolean): void {
    this.root.querySelector(".care-btn")!.classList.toggle("on", on);
  }

  /** The Care button's little count of what's left today, or a check when it's all done. */
  setCare(left: number): void {
    const b = this.root.querySelector(".care-btn")!;
    b.classList.toggle("all", left === 0);
    b.querySelector(".badge")!.textContent = left === 0 ? "✓" : String(left);
  }

  /** Today's care for the one you hold: four big tiles, and the present for doing them all. */
  careSheet(): void {
    const info = this.h.careInfo();
    if (!info) return;
    const left = CARE_IDS.length - info.done.length;
    const tile = (id: CareId) => {
      const done = info.done.includes(id);
      return `<button class="${done ? "done" : ""}" data-id="${id}"><i>${CARE_INFO[id].icon}</i>${esc(CARE_INFO[id].name)}<small>${done ? "Done today!" : CARE_HOW[id]}</small></button>`;
    };
    const present =
      left === 0
        ? `<div class="present got"><i>💖</i><div>All cared for today! See you tomorrow for more.${info.days > 1 ? `<br>${info.days} happy days so far` : ""}</div></div>`
        : `<div class="present"><i>🎁</i><div>Do all four today for a present!<br>🍪 +${PRESENT_COOKIES} &nbsp;⭐ +${PRESENT_STARS}</div></div>`;
    const panel = this.openSheet(
      `<h1>Care for ${esc(info.who)}</h1><div class="sub">${left === 0 ? "Everything done today" : `${info.done.length} of ${CARE_IDS.length} done today`}</div>
       <div class="care">${CARE_IDS.map(tile).join("")}</div>${present}`,
    );
    for (const b of panel.querySelectorAll<HTMLButtonElement>(".care button")) {
      b.addEventListener("click", () => {
        this.closeSheet();
        this.h.care(b.dataset.id as CareId);
      });
    }
  }

  /** The present for caring all day. */
  presentCard(who: string, cookies: number, stars: number): Promise<void> {
    this.modal.innerHTML = `
      <div class="card">
        <div class="new">Yay!</div>
        <div class="big-ico">🎁</div>
        <div class="kind" style="font-size:20px;color:#e2508c">A present for you!</div>
        <div class="note">You looked after ${esc(who)} all day. Thank you!</div>
        <div class="loot">${cookies ? `<span>🍪 +${cookies}</span>` : ""}<span>⭐ +${stars}</span></div>
        <div class="btns"><button class="big ok">Yay!</button></div>
      </div>`;
    this.modal.classList.add("on");
    this.coverChanged();
    return new Promise((resolve) => {
      this.cardDone = () => resolve();
      this.modal.querySelector(".ok")!.addEventListener("click", () => this.closeCard());
    });
  }

  /**
   * The Spooky Box button: glowing with a count while there are Spooky Boxes to open, a purple countdown in the
   * sleeps before Halloween, and hidden otherwise.
   */
  setSpooky(boxes: number, sleeps: number): void {
    const b = this.root.querySelector(".spooky-btn")!;
    b.classList.toggle("on", boxes > 0 || sleeps > 0);
    b.classList.toggle("ready", boxes > 0);
    b.classList.toggle("soon", boxes === 0 && sleeps > 0);
    const badge = b.querySelector<HTMLElement>(".badge")!;
    badge.textContent = String(boxes);
    badge.style.display = boxes > 0 ? "grid" : "none";
    b.querySelector(".lbl")!.textContent = boxes > 0 ? "Spooky" : `${sleeps} sleep${sleeps === 1 ? "" : "s"}`;
  }

  /** Bath time: which step (from 0), with big words and a few small ones. */
  bathStep(i: number, title: string, how: string): void {
    const el = this.layers.bath;
    el.querySelectorAll(".steps i").forEach((d, k) => {
      d.classList.toggle("on", k === i);
      d.classList.toggle("done", k < i);
    });
    el.querySelector(".bath-title")!.textContent = title;
    el.querySelector(".bath-how")!.textContent = how;
    this.bathProgress(0);
  }

  bathProgress(k: number): void {
    (this.layers.bath.querySelector(".bath-bar i") as HTMLElement).style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`;
  }

  get busy(): boolean {
    return (
      this.modal.classList.contains("on") ||
      this.bookEl.classList.contains("on") ||
      this.sheetEl.classList.contains("on") ||
      this.wishEl.classList.contains("on")
    );
  }

  private coverChanged(): void {
    this.h.covered(this.busy);
  }

  setJobs(n: number, beat = false): void {
    this.jobsEl.querySelector("span")!.textContent = String(n);
    if (beat) {
      this.jobsEl.classList.add("beat");
      setTimeout(() => this.jobsEl.classList.remove("beat"), 220);
    }
  }

  setCookies(n: number, beat = false): void {
    this.cookiesEl.querySelector("span")!.textContent = String(n);
    if (beat) {
      this.cookiesEl.classList.add("beat");
      setTimeout(() => this.cookiesEl.classList.remove("beat"), 220);
    }
  }

  /** A red dot on Hats when there is a new hat to try. */
  newHat(on: boolean): void {
    this.hatsDot.classList.toggle("on", on);
    this.refreshTabDot();
  }

  /** The shelf and buttons are slid down out of the way. */
  get trayDown(): boolean {
    return this.down;
  }

  /** Slides the shelf and buttons down out of the way, or back up. `animate` false jumps straight there (on start). */
  setTray(down: boolean, animate = true): void {
    this.down = down;
    const closet = this.layers.closet;
    if (!animate) closet.classList.add("still");
    closet.classList.toggle("tray-down", down);
    this.tabEl.setAttribute("aria-label", down ? "Show the shelf" : "Hide the shelf");
    this.tabEl.setAttribute("aria-expanded", String(!down));
    this.refreshTabDot();
    if (!animate) {
      // Let the jump land before slides come back on.
      void closet.offsetHeight;
      requestAnimationFrame(() => closet.classList.remove("still"));
    }
  }

  /** The pull tab, for the helping hand to point at while the shelf is down. */
  get trayTab(): HTMLElement {
    return this.tabEl;
  }

  private toggleTray(down: boolean): void {
    if (down === this.down) return;
    this.setTray(down);
    this.h.tray(down);
  }

  /** While the shelf is down, the tab gets a dot when something new waits on a button. */
  private refreshTabDot(): void {
    const news =
      this.hatsDot.classList.contains("on") || this.mailDot.classList.contains("on") || this.openBtn.classList.contains("ready");
    this.tabDot.classList.toggle("on", news);
  }

  /**
   * Tap the tab to slide the shelf down or up; or swipe the shelf, the buttons
   * or the tab down to tuck them away, and swipe the tab up to bring them back.
   */
  private wireTray(tray: HTMLElement): void {
    const start = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    tray.addEventListener("pointerdown", start);
    this.tabEl.addEventListener("pointerdown", start);
    window.addEventListener("pointermove", (e) => {
      const sw = this.swipe;
      if (!sw || sw.id !== e.pointerId) return;
      const dx = e.clientX - sw.x;
      const dy = e.clientY - sw.y;
      // Mostly up or down, and far enough to mean it; sideways is scrolling the shelf.
      if (Math.abs(dy) < 34 || Math.abs(dy) < Math.abs(dx) * 1.4) return;
      this.swipe = null;
      this.swipedAt = performance.now();
      this.toggleTray(dy > 0);
    });
    const end = (e: PointerEvent) => {
      if (this.swipe?.id === e.pointerId) this.swipe = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    // The tap a swipe ends on isn't a press of whatever is under the finger.
    this.root.addEventListener(
      "click",
      (e) => {
        if (this.swipedAt >= 0 && performance.now() - this.swipedAt < 450) {
          e.stopPropagation();
          e.preventDefault();
        }
        this.swipedAt = -1;
      },
      true,
    );
    this.tabEl.addEventListener("click", () => this.toggleTray(!this.down));
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
    this.refreshTabDot();
  }

  setStars(n: number): void {
    this.starCount.textContent = String(n);
  }

  /**
   * The closet shelf: every squishy you have. The one you hold and the friends
   * out playing come first; tap a friend to hold it, tap a resting one to bring
   * it out, tap the little house to send a friend in to rest.
   */
  setShelf(items: { id: string; state: ShelfState; hat: string | null; key?: string; napping?: boolean; want?: string | null }[]): void {
    const left = this.shelf.scrollLeft;
    this.shelf.innerHTML = "";
    for (const it of items) {
      const b = document.createElement("button");
      b.className = it.state === "held" ? "on" : it.state;
      const img = document.createElement("img");
      img.alt = "";
      b.appendChild(img);
      this.thumbs.want(it.id, (url) => (img.src = url), it.hat);
      if (it.state !== "rest") {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = it.state === "held" ? "Holding" : it.state === "baby" ? "Baby" : "Playing";
        b.appendChild(tag);
      }
      if (it.napping) {
        const zz = document.createElement("span");
        zz.className = "zz";
        zz.textContent = "💤";
        b.appendChild(zz);
      } else if (it.want) {
        const w = document.createElement("span");
        w.className = "wants";
        w.textContent = it.want;
        b.appendChild(w);
      }
      const key = it.key;
      b.addEventListener("click", () => (key ? this.h.babyTap(key) : this.h.shelfTap(it.id)));
      this.shelf.appendChild(b);
      if (it.state === "out") {
        const home = document.createElement("span");
        home.className = "home";
        home.setAttribute("role", "button");
        home.setAttribute("aria-label", "Rest");
        home.innerHTML = HOUSE;
        home.addEventListener("click", (e) => {
          e.stopPropagation();
          this.h.sendIn(it.id);
        });
        b.appendChild(home);
      }
    }
    this.shelf.scrollLeft = left;
  }

  // ---- sheets that slide up ---------------------------------------------------

  private openSheet(html: string): HTMLElement {
    this.sheetEl.innerHTML = `<div class="panel"><button class="round close" aria-label="Close">${CLOSE}</button>${html}</div>`;
    this.sheetEl.classList.add("on");
    this.sheetEl.querySelector(".close")!.addEventListener("click", () => this.closeSheet());
    this.coverChanged();
    return this.sheetEl.querySelector(".panel") as HTMLElement;
  }

  closeSheet(): void {
    if (!this.sheetEl.classList.contains("on")) return;
    this.sheetEl.classList.remove("on");
    this.sheetEl.innerHTML = "";
    this.coverChanged();
  }

  /** Every hat; tap one you have to put it on the one you hold. */
  hatsSheet(): void {
    this.newHat(false);
    const info = this.h.hats();
    const cell = (h: HatDef | null) => {
      const have = !h || info.have.includes(h.id);
      const on = (h?.id ?? null) === info.wearing;
      return `<button class="cell${on ? " on" : ""}${have ? "" : " missing"}" data-id="${h?.id ?? ""}">${h ? `<img alt="">` : `<span class="none">✕</span>`}${h ? (have ? esc(h.name) : "?") : "No hat"}</button>`;
    };
    const panel = this.openSheet(
      `<h1>Hats</h1><div class="sub">For ${esc(info.who)} · You have ${info.have.length} of ${HATS.length}</div>
       <div class="grid">${cell(null)}${HATS.map(cell).join("")}</div>`,
    );
    for (const b of panel.querySelectorAll<HTMLButtonElement>(".cell")) {
      const id = b.dataset.id || null;
      const img = b.querySelector("img");
      if (id && img) this.thumbs.wantHat(id, (url) => (img.src = url));
      b.addEventListener("click", () => {
        if (id && !info.have.includes(id)) {
          b.classList.remove("wobble");
          void b.offsetWidth;
          b.classList.add("wobble");
          const h = HATS.find((x) => x.id === id)!;
          this.toast(
            h.from === "box" ? "Find it in a box!" : h.from === "spooky" ? "Find it in a Spooky Box on Halloween! 🎃" : h.from === "bath" ? "Give a squishy a bath!" : "Friends find it doing jobs!",
            1700,
          );
          return;
        }
        this.h.wearHat(id);
        this.closeSheet();
      });
    }
  }

  placesSheet(): void {
    const here = this.h.place();
    const { has } = this.h.full();
    const panel = this.openSheet(
      `<h1>Places</h1><div class="sub">Where do you want to play?</div>
       <div class="places">${PLACES.map((p) => {
         const open = placeOpen(p.id, has);
         return `<button class="${p.id === here ? "on" : ""}${open ? "" : " locked"}" data-id="${p.id}">${PLACE_PICS[p.id]}${open ? "" : `<span class="lock" aria-hidden="true">🔒</span>`}${esc(p.name)}<small>${open ? `${p.jobs.length} jobs to do` : "Full game"}</small></button>`;
       }).join("")}</div>`,
    );
    for (const b of panel.querySelectorAll<HTMLButtonElement>(".places button")) {
      b.addEventListener("click", () => {
        const id = b.dataset.id as PlaceId;
        if (!placeOpen(id, this.h.full().has)) {
          // Locked places lead to the grown-ups' screen, behind the grown-up check, and nowhere else.
          this.grownUpCheck(() => void this.fullSheet());
          return;
        }
        this.closeSheet();
        this.h.goPlace(id);
      });
    }
  }

  /**
   * A check only a grown-up can pass before anything about buying: a times question written in words, answered by
   * typing the number. Wrong answers just close it, with no hint.
   */
  grownUpCheck(pass: () => void): void {
    const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    const a = 3 + Math.floor(Math.random() * 7);
    const b = 3 + Math.floor(Math.random() * 7);
    const panel = this.openSheet(
      `<div class="gate"><h1>For grown-ups</h1>
       <div class="sub">Please ask a grown-up to answer.</div>
       <div class="ask">What is ${WORDS[a]} times ${WORDS[b]}?</div>
       <input inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="Answer">
       <div class="btns"><button class="big alt back">Back</button><button class="big go">Go on</button></div></div>`,
    );
    const input = panel.querySelector("input") as HTMLInputElement;
    const go = () => {
      if (Number(input.value.trim()) === a * b) pass();
      else {
        this.closeSheet();
        this.toast("That's not it. Ask a grown-up!", 1600);
      }
    };
    panel.querySelector(".go")!.addEventListener("click", go);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
    panel.querySelector(".back")!.addEventListener("click", () => this.closeSheet());
  }

  /** For grown-ups (after the check): what the full game adds, buying it once, and restoring a purchase. */
  async fullSheet(): Promise<void> {
    const info = this.h.full();
    const more = PLACES.filter((p) => !FREE_PLACES.includes(p.id)).map((p) => esc(p.name));
    const sparkly = CATALOG.filter((d) => !inFreeGame(d)).length;
    const whyWords: Record<FullWhy, string> = {
      open: "Every place and squishy is open.",
      early: "You played before the full game came out, so it's yours to keep. Thank you!",
      apple: "Bought on this Apple account. Thank you!",
      web: "Bought on TrueAIGaming. Thank you!",
      test: "Test unlock (preview builds only).",
    };
    if (info.has) {
      const panel = this.openSheet(
        `<div class="full"><h1>The full game</h1>
         <div class="sub">${esc(whyWords[info.why ?? "open"])}</div>
         <ul><li>Every place: ${more.join(", ")}</li><li>All ${sparkly} sparkly squishies to find (glitter, glow and gold)</li><li>The hats friends find in every place</li></ul>
         ${info.test && info.why === "test" ? `<div class="test">Preview build only<br><button class="link relock">Lock it again</button></div>` : ""}</div>`,
      );
      panel.querySelector(".relock")?.addEventListener("click", () => {
        this.h.relock();
        this.closeSheet();
        this.toast("Back to the free game (preview)", 1600);
      });
      return;
    }
    const panel = this.openSheet(
      `<div class="full"><h1>The full game</h1>
       <div class="sub">One purchase opens all of Aurora's World.</div>
       <ul><li>${more.length} more places: ${more.join(", ")}</li><li>${sparkly} sparkly squishies to find (glitter, glow and gold)</li><li>The hats friends find in those places</li></ul>
       <div class="btns"><button class="big buy" disabled>Checking…</button></div>
       <div class="btns"><button class="link restore">Restore purchase</button></div>
       <div class="tip">One payment, no subscription, no ads, nothing else to buy. Squishies, hats and babies you already have always stay.</div>
       ${info.test ? `<div class="test">Preview build only: no payment is hooked up yet.<br><button class="link testbuy">Test unlock</button></div>` : ""}</div>`,
    );
    const buy = panel.querySelector<HTMLButtonElement>(".buy")!;
    const done = (r: BuyResult) => {
      if (!panel.isConnected) return;
      if (r.ok) {
        this.closeSheet();
        this.toast("The whole world is open! 🎉", 2200);
        return;
      }
      if (r.why === "cancelled") return;
      this.toast(r.why === "none" ? "No earlier purchase found." : r.why === "not-ready" ? "Buying isn't set up yet." : "That didn't go through. Try again later.", 2000);
    };
    panel.querySelector(".testbuy")?.addEventListener("click", async () => done(await this.h.buyFull(true)));
    panel.querySelector(".restore")!.addEventListener("click", async () => done(await this.h.restoreFull()));
    buy.addEventListener("click", async () => {
      buy.disabled = true;
      done(await this.h.buyFull(false));
      if (buy.isConnected) buy.disabled = false;
    });
    let shop = { ready: false, price: null as string | null };
    try {
      shop = await this.h.shopInfo();
    } catch {
      // Shown as not ready.
    }
    if (!buy.isConnected) return;
    buy.disabled = !shop.ready;
    buy.textContent = !shop.ready ? "Coming soon" : shop.price ? `Unlock for ${shop.price}` : "Unlock the full game";
  }

  settingsSheet(): void {
    const on = this.h.sound();
    const z = this.h.zoom();
    const panel = this.openSheet(
      `<h1>Settings</h1>
       <div class="row"><span class="lbl">Sound</span><button class="toggle${on ? "" : " off"}">${on ? "On" : "Off"}</button></div>
       <div class="row"><span class="lbl">Zoom</span><span class="sm">−</span><input type="range" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.01" value="${z}" aria-label="Zoom"><span class="sm">+</span></div>
       <div class="row grown"><span class="lbl">Grown-ups</span><button class="toggle move-btn">Move to a new phone</button></div>
       ${this.h.full().locks ? `<div class="row grown"><span class="lbl">Grown-ups</span><button class="toggle full-btn">Full game</button></div>` : ""}`,
    );
    panel.querySelector(".move-btn")!.addEventListener("click", () => void this.moveSheet());
    panel.querySelector(".full-btn")?.addEventListener("click", () => this.grownUpCheck(() => void this.fullSheet()));
    const t = panel.querySelector(".toggle") as HTMLButtonElement;
    t.addEventListener("click", () => {
      const now = this.h.toggleSound();
      t.textContent = now ? "On" : "Off";
      t.classList.toggle("off", !now);
    });
    const r = panel.querySelector("input") as HTMLInputElement;
    r.addEventListener("input", () => this.h.setZoom(Number(r.value)));
  }

  /**
   * For a grown-up: a QR code and link that carry the collection to another phone, and a box to bring one in.
   * The code goes from screen to screen; nothing is kept online.
   */
  async moveSheet(): Promise<void> {
    const panel = this.openSheet(`<div class="move"><h1>Move to a new phone</h1><div class="sub">Making your code…</div></div>`);
    const box = panel.querySelector(".move") as HTMLElement;
    let link = "";
    try {
      link = await this.h.moveLink();
    } catch {
      // Shown below as a code that couldn't be made.
    }
    if (!box.isConnected) return;
    let qr = "";
    try {
      const q = qrcode(0, "L");
      q.addData(link);
      q.make();
      qr = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch {
      qr = "";
    }
    box.innerHTML = `<h1>Move to a new phone</h1>
      <div class="sub">For grown-ups. On the new phone, point the camera at this code and open the link. Or share or copy the link.</div>
      ${link && qr ? `<div class="qr" role="img" aria-label="QR code for the move link">${qr}</div>` : `<div class="sub">This browser can't make a code. Try another browser.</div>`}
      <div class="btns">${link && "share" in navigator ? `<button class="big alt share">Share link</button>` : ""}${link ? `<button class="big copy">Copy link</button>` : ""}</div>
      <div class="tip">The code holds the whole collection and goes straight to the other phone. Nothing is kept online. Squishies stay here too.</div>
      <hr>
      <div class="sub">Got a link from another phone? Paste it here.</div>
      <textarea aria-label="Link from another phone" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="btns"><button class="big in">Bring them in</button></div>`;
    box.querySelector(".share")?.addEventListener("click", () => {
      void navigator.share({ title: "Aurora's World squishies", url: link }).catch(() => {});
    });
    const copy = box.querySelector<HTMLButtonElement>(".copy");
    copy?.addEventListener("click", () => {
      void navigator.clipboard
        ?.writeText(link)
        .then(() => (copy.textContent = "Copied!"))
        .catch(() => this.toast("Couldn't copy. Use Share instead.", 1800));
    });
    const input = box.querySelector("textarea") as HTMLTextAreaElement;
    box.querySelector(".in")!.addEventListener("click", async () => {
      const added = await this.h.bringIn(input.value);
      if (added === null) this.toast("That link didn't work. Copy it again.", 2000);
    });
  }

  /** Squishies arrived from another phone. Resolves true to bring them in. */
  confirmMove(added: number): Promise<boolean> {
    return new Promise((resolve) => {
      const panel = this.openSheet(
        `<h1>Squishies from another phone!</h1>
         <div class="sub">${added > 0 ? `Bring in ${added} new ${added === 1 ? "squishy" : "squishies"}?` : "Bring in hats and stars from the other phone?"} Nothing here is lost.</div>
         <div class="btns" style="display:flex;gap:10px;justify-content:center"><button class="big alt no">Not now</button><button class="big yes">Bring them in</button></div>`,
      );
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        this.closeSheet();
        resolve(v);
      };
      panel.querySelector(".yes")!.addEventListener("click", () => finish(true));
      panel.querySelector(".no")!.addEventListener("click", () => finish(false));
      panel.querySelector(".close")!.addEventListener("click", () => finish(false));
    });
  }

  /** Four are out already: pick a friend to go in and rest. Resolves with it, or null. */
  chooseRest(friends: { id: string; name: string; hat: string | null }[], incoming: string): Promise<string | null> {
    return new Promise((resolve) => {
      const panel = this.openSheet(
        `<h1>Who goes to rest?</h1><div class="sub">Only 4 can play at once. Tap one to rest so ${esc(incoming)} can come out.</div>
         <div class="picks">${friends.map((f) => `<button data-id="${f.id}"><img alt="">${esc(f.name)}</button>`).join("")}</div>`,
      );
      let done = false;
      const finish = (v: string | null) => {
        if (done) return;
        done = true;
        this.closeSheet();
        resolve(v);
      };
      for (const b of panel.querySelectorAll<HTMLButtonElement>(".picks button")) {
        const f = friends.find((x) => x.id === b.dataset.id)!;
        this.thumbs.want(f.id, (url) => (b.querySelector("img")!.src = url), f.hat);
        b.addEventListener("click", () => finish(f.id));
      }
      panel.querySelector(".close")!.addEventListener("click", () => finish(null));
      const off = () => {
        if (!this.sheetEl.classList.contains("on")) finish(null);
        else requestAnimationFrame(off);
      };
      requestAnimationFrame(off);
    });
  }

  /** A dot on the Book button while squishy mail waits. */
  setMail(n: number): void {
    this.mailDot.classList.toggle("on", n > 0);
    this.refreshTabDot();
  }

  /**
   * The squishy is packed in its box: a QR code and a link for the friend. Resolves true once it is sent off
   * (shared, or "Send it off!"), false to unpack it.
   */
  shareSheet(name: string, link: string): Promise<boolean> {
    let qr = "";
    try {
      const q = qrcode(0, "M");
      q.addData(link);
      q.make();
      qr = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch {
      qr = "";
    }
    const panel = this.openSheet(
      `<div class="move gift"><h1>Send ${esc(name)} to a friend</h1>
       <div class="sub">Your friend gets a twin. ${esc(name)} stays with you too!</div>
       ${qr ? `<div class="qr" role="img" aria-label="QR code for the squishy link">${qr}</div>` : ""}
       <div class="tip">Let your friend scan this with their phone's camera, or ask a grown-up to send them the link.</div>
       <div class="btns">${"share" in navigator ? `<button class="big alt share">Share link</button>` : ""}<button class="big alt copy">Copy link</button></div>
       <div class="btns"><button class="big off">Send it off!</button></div></div>`,
    );
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        if (this.sheetEl.classList.contains("on")) this.closeSheet();
        resolve(v);
      };
      panel.querySelector(".share")?.addEventListener("click", () => {
        void navigator
          .share({ title: "A squishy for you!", text: `A squishy is coming to you in Aurora's World!`, url: link })
          .then(() => finish(true))
          .catch(() => {});
      });
      const copy = panel.querySelector<HTMLButtonElement>(".copy")!;
      copy.addEventListener("click", () => {
        void navigator.clipboard
          ?.writeText(link)
          .then(() => (copy.textContent = "Copied!"))
          .catch(() => this.toast("Couldn't copy. Use Share instead.", 1800));
      });
      panel.querySelector(".off")!.addEventListener("click", () => finish(true));
      panel.querySelector(".close")!.addEventListener("click", () => finish(false));
      // Closed any other way (a tap outside, Escape): unpack it.
      const off = () => {
        if (!this.sheetEl.classList.contains("on")) finish(false);
        else if (!done) requestAnimationFrame(off);
      };
      requestAnimationFrame(off);
    });
  }

  /** For a squishy link that opened somewhere else: paste it in. */
  pasteSheet(): void {
    const panel = this.openSheet(
      `<div class="move"><h1>Got a squishy link?</h1>
       <div class="sub">Paste the link a friend sent you.</div>
       <textarea aria-label="Squishy link" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
       <div class="btns"><button class="big in">Get my squishy</button></div></div>`,
    );
    const input = panel.querySelector("textarea") as HTMLTextAreaElement;
    panel.querySelector(".in")!.addEventListener("click", () => {
      const said = this.h.receive(input.value);
      this.closeSheet();
      this.closeBook();
      this.toast(said, 2400);
    });
  }

  /** A new hat! Resolves true to put it on now. */
  hatCard(id: string, name: string): Promise<boolean> {
    this.modal.innerHTML = `
      <div class="card">
        <div class="new">New hat!</div>
        <img alt="">
        <div class="name"><input readonly value="${esc(name)}" aria-label="Hat"></div>
        <div class="kind">${HAT_FROM[HATS.find((h) => h.id === id)?.from ?? "place"]}</div>
        <div class="btns" style="margin-top:14px"><button class="big alt later">Later</button><button class="big wear">Wear it!</button></div>
      </div>`;
    this.thumbs.wantHat(id, (url) => (this.modal.querySelector("img")!.src = url));
    this.modal.classList.add("on");
    this.coverChanged();
    return new Promise((resolve) => {
      let wear = false;
      this.cardDone = () => resolve(wear);
      this.modal.querySelector(".later")!.addEventListener("click", () => this.closeCard());
      this.modal.querySelector(".wear")!.addEventListener("click", () => {
        wear = true;
        this.closeCard();
      });
    });
  }

  /** A baby asleep! Resolves true to keep it with a cookie. */
  babyFound(def: SquishyDef, cookies: number, full: boolean): Promise<boolean> {
    const can = cookies > 0 && !full;
    const why = full
      ? "You're looking after 3 babies already. Let one grow up first!"
      : cookies > 0
        ? `Keep it for <b>1 cookie</b>? It grows up in a week. How you play and what you teach it makes it who it is!`
        : `You need a <b>cookie</b> to keep it. Friends bake cookies at the Tea Table, and sometimes find them doing jobs.`;
    this.modal.innerHTML = `
      <div class="card">
        <div class="new">Shh!</div>
        <img alt="">
        <div class="name"><input readonly value="Baby ${esc(def.name)}" aria-label="Baby"></div>
        <div class="kind">is fast asleep</div>
        <div class="note">${why}</div>
        <div class="btns">${can ? `<button class="big alt later">Let it sleep</button><button class="big keep">🍪 Keep it!</button>` : `<button class="big later">OK</button>`}</div>
      </div>`;
    this.thumbs.want(def.id, (url) => (this.modal.querySelector("img")!.src = url));
    this.modal.classList.add("on");
    this.coverChanged();
    return new Promise((resolve) => {
      let keep = false;
      this.cardDone = () => resolve(keep);
      this.modal.querySelector(".later")!.addEventListener("click", () => this.closeCard());
      this.modal.querySelector(".keep")?.addEventListener("click", () => {
        keep = true;
        this.closeCard();
      });
    });
  }

  /** A baby you're raising: what it wants, how long until it grows up, who it's becoming, and lessons. */
  babySheet(b: BabyInfo): void {
    const becoming = b.becoming ? `${b.becoming.icon} <b>${esc(b.becoming.name)}</b>` : "<b>Shy</b> so far. Teach me things!";
    const want = b.want && !b.napping ? LESSONS.find((l) => l.mood === b.want) : null;
    const wishCard = want
      ? `<div class="wish-card"><i>${want.icon}</i><div class="w">${esc(wishWords(wishFor(want.mood).title, b.name))}<small>Do it to help me grow up!</small></div><button class="go">Let's go!</button></div>`
      : "";
    const panel = this.openSheet(
      `<div class="baby-top"><img alt=""><div style="flex:1;min-width:0"><input maxlength="${NAME_MAX}" enterkeyhint="done" aria-label="Name">
        <div class="facts">Grows up in <b>${esc(b.left)}</b><div class="grow"><i style="width:${Math.round(Math.max(0.04, Math.min(1, b.grow)) * 100)}%"></i></div>Becoming: ${becoming}</div></div></div>
       ${wishCard}
       <div class="sub">${b.napping ? "Shh, napping! Come back soon." : want ? "Or learn something else:" : "What should we learn today?"}</div>
       <div class="lessons${b.napping ? " napping" : ""}">${LESSONS.map((l) => `<button data-mood="${l.mood}"><i>${l.icon}</i>${esc(l.name)}</button>`).join("")}</div>
       <div class="tip">${want ? "When a baby wants something, doing it with them helps them grow up sooner!" : "Play with your baby by tapping it. Waking it from a nap makes it grumpy!"}</div>`,
    );
    const img = panel.querySelector("img")!;
    this.thumbs.want(b.def.id, (url) => (img.src = url));
    const input = panel.querySelector("input")!;
    input.value = b.name;
    const commit = () => this.h.renameBaby(b.key, input.value);
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
    panel.querySelector(".wish-card .go")?.addEventListener("click", () => {
      commit();
      this.closeSheet();
      this.h.doWish(b.key);
    });
    for (const btn of panel.querySelectorAll<HTMLButtonElement>(".lessons button")) {
      btn.addEventListener("click", () => {
        if (b.napping) {
          this.toast("Shh! Let it nap", 1300);
          return;
        }
        commit();
        this.closeSheet();
        this.h.teach(b.key, btn.dataset.mood as MoodId);
      });
    }
  }

  // ---- doing what a baby wants -------------------------------------------------

  /**
   * A little game with the baby: tap the notes to sing, drag treats over to share,
   * hold it for a hug. Resolves true when it's done, false if you closed it.
   */
  wish(g: WishGame): Promise<boolean> {
    this.endWish(false);
    const w = g.wish ?? wishFor(g.want);
    const el = this.wishEl;
    const total = w.need;
    el.innerHTML = `
      <button class="round close" aria-label="Close">${CLOSE}</button>
      <h1>${esc(wishWords(w.title, g.name))}</h1>
      <div class="kid"><img alt=""></div>
      <div class="how">${esc(wishWords(w.how, g.name))}</div>
      <div class="dots">${w.play === "hold" ? "" : Array.from({ length: total }, () => "<i></i>").join("")}</div>`;
    el.classList.add("on");
    this.root.classList.add("wish-on");
    this.coverChanged();
    const kid = el.querySelector<HTMLElement>(".kid")!;
    const img = kid.querySelector("img")!;
    this.thumbs.want(g.def.id, (url) => (img.src = url));
    let done = 0;
    let over = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const box = () => el.getBoundingClientRect();
    const kidMid = () => {
      const r = kid.getBoundingClientRect();
      const o = box();
      return { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top, r: r.width / 2 };
    };
    const puff = (x: number, y: number, icon: string) => {
      const p = document.createElement("div");
      p.className = "puff";
      p.textContent = icon;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      el.appendChild(p);
      later(() => p.remove(), 1200);
    };
    const boing = () => {
      kid.classList.remove("boing");
      void kid.offsetWidth;
      kid.classList.add("boing");
    };
    const finish = () => {
      if (over) return;
      over = true;
      this.wishWon = true;
      el.classList.add("won");
      kid.classList.remove("boing", "rock");
      void kid.offsetWidth;
      kid.classList.add("cheer");
      for (const t of el.querySelectorAll(".thing")) t.remove();
      const yay = document.createElement("div");
      yay.className = "yay";
      yay.textContent = w.yay;
      el.appendChild(yay);
      const m = kidMid();
      for (let i = 0; i < 8; i++) later(() => puff(m.x + rnd(-m.r, m.r), m.y - m.r * 0.6, i % 2 ? "💖" : "✨"), i * 90);
      g.beat(true, total);
      // A moment to cheer, then the screen fades away back to play.
      later(() => el.classList.add("bye"), 1500);
      later(() => this.endWish(true), 1850);
    };
    const step = () => {
      if (over) return;
      done++;
      const dots = el.querySelectorAll(".dots i");
      dots[done - 1]?.classList.add("on");
      g.beat(false, done);
      if (done >= total) later(finish, 350);
    };

    // A spot in the open, away from the baby and the words.
    const openSpot = () => {
      const o = box();
      const m = kidMid();
      for (let tries = 0; ; tries++) {
        const x = rnd(50, o.width - 50);
        const y = rnd(o.height * 0.2, o.height * 0.78);
        if (Math.hypot(x - m.x, y - m.y) > m.r + 60 || tries > 30) return { x, y };
      }
    };

    if (w.play === "pop") {
      const one = w.things.length === 1 && w.things[0] === "⚽";
      const spawn = () => {
        if (over) return;
        const t = document.createElement("div");
        t.className = "thing float";
        t.textContent = w.things[Math.floor(Math.random() * w.things.length)];
        const p = openSpot();
        t.style.left = `${p.x}px`;
        t.style.top = `${p.y}px`;
        t.style.animationDelay = `${-rnd(0, 2)}s`;
        t.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (over || t.classList.contains("popped")) return;
          t.classList.add("popped");
          puff(p.x, p.y - 20, w.things[0] === "👻" ? "💨" : "✨");
          boing();
          step();
          later(() => t.remove(), 400);
          if (done < total) later(spawn, one ? 250 : 500);
        });
        el.appendChild(t);
      };
      for (let i = 0; i < (one ? 1 : Math.min(3, total)); i++) later(spawn, 200 + i * 250);
    } else if (w.play === "bounce") {
      kid.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (over) return;
        boing();
        const m = kidMid();
        puff(m.x + rnd(-40, 40), m.y - m.r, w.things[0]);
        step();
      });
    } else if (w.play === "feed") {
      const o = box();
      w.things.slice(0, total).forEach((icon, i) => {
        const t = document.createElement("div");
        t.className = "thing home";
        t.textContent = icon;
        const hx = (o.width / (total + 1)) * (i + 1);
        const hy = Math.max(150, o.height * 0.26);
        const place = (x: number, y: number) => {
          t.style.left = `${x}px`;
          t.style.top = `${y}px`;
        };
        place(hx, hy);
        let grab: { dx: number; dy: number } | null = null;
        t.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (over) return;
          const b = box();
          grab = { dx: e.clientX - b.left - parseFloat(t.style.left), dy: e.clientY - b.top - parseFloat(t.style.top) };
          t.classList.remove("home");
          t.classList.add("grab");
          try {
            t.setPointerCapture(e.pointerId);
          } catch {
            /* keeps working without it */
          }
        });
        t.addEventListener("pointermove", (e) => {
          if (!grab) return;
          const b = box();
          place(e.clientX - b.left - grab.dx, e.clientY - b.top - grab.dy);
        });
        const drop = () => {
          if (!grab) return;
          grab = null;
          t.classList.remove("grab");
          const m = kidMid();
          const x = parseFloat(t.style.left);
          const y = parseFloat(t.style.top);
          if (Math.hypot(x - m.x, y - m.y) < m.r + 30) {
            t.classList.add("popped");
            puff(m.x, m.y - m.r * 0.5, "💖");
            boing();
            step();
            later(() => t.remove(), 400);
          } else {
            // Not quite: it springs back to try again.
            t.classList.add("home");
            place(hx, hy);
          }
        };
        t.addEventListener("pointerup", drop);
        t.addEventListener("pointercancel", drop);
        el.appendChild(t);
      });
    } else {
      // Hold: a ring fills while you keep holding; let go and it waits for you (it only slips back a little).
      const R = 104;
      const C = 2 * Math.PI * R;
      kid.insertAdjacentHTML(
        "beforeend",
        `<svg class="ring" viewBox="0 0 228 228"><circle cx="114" cy="114" r="${R}" stroke="#fff"/><circle class="fillring" cx="114" cy="114" r="${R}" stroke="#ff6fa5" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>`,
      );
      const fillRing = kid.querySelector<SVGCircleElement>(".fillring")!;
      // Time held counts by the clock, not by frames, so a slow phone fills it just as fast.
      let banked = 0;
      let since = 0;
      let holding = false;
      let lastBeat = 0;
      let lastPuff = 0;
      let prev = performance.now();
      const heldNow = (t: number) => banked + (holding ? (t - since) / 1000 : 0);
      const check = () => {
        if (!over && heldNow(performance.now()) >= total) finish();
      };
      const tick = (t: number) => {
        if (over || !this.wishEl.classList.contains("on")) return;
        const dt = Math.min(0.1, (t - prev) / 1000);
        prev = t;
        if (!holding) banked = Math.max(0, banked - dt * 0.3);
        const held = heldNow(t);
        fillRing.setAttribute("stroke-dashoffset", String(C * (1 - Math.min(1, held / total))));
        if (holding && t - lastPuff > 380) {
          lastPuff = t;
          const m = kidMid();
          puff(m.x + rnd(-m.r, m.r), m.y - m.r * 0.4, w.things[Math.floor(Math.random() * w.things.length)]);
        }
        if (holding && Math.floor(held) > lastBeat) {
          lastBeat = Math.floor(held);
          g.beat(false, lastBeat);
        }
        if (held >= total) {
          finish();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        if (over || holding) return;
        holding = true;
        since = performance.now();
        kid.classList.add("rock");
        try {
          kid.setPointerCapture(e.pointerId);
        } catch {
          /* keeps working without it */
        }
        later(check, (total - banked) * 1000 + 30);
      };
      const up = () => {
        if (!holding) return;
        banked = heldNow(performance.now());
        holding = false;
        kid.classList.remove("rock");
        check();
      };
      kid.addEventListener("pointerdown", down);
      kid.addEventListener("pointerup", up);
      kid.addEventListener("pointercancel", up);
    }

    el.querySelector(".close")!.addEventListener("click", () => this.endWish(false));
    return new Promise((resolve) => {
      this.wishDone = (did) => {
        for (const t of timers) clearTimeout(t);
        resolve(did);
      };
    });
  }

  private endWish(did: boolean): void {
    if (!this.wishEl.classList.contains("on")) return;
    this.wishEl.classList.remove("on", "won", "bye");
    this.root.classList.remove("wish-on");
    this.wishEl.innerHTML = "";
    const won = this.wishWon;
    this.wishWon = false;
    const done = this.wishDone;
    this.wishDone = null;
    done?.(did || won);
    this.coverChanged();
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
    const mood = moodById(info.mood);
    this.modal.innerHTML = `
      <div class="card">
        <div class="no">#${def.no}</div>
        ${info.grew ? `<div class="grew">All grown up!</div>` : info.isNew ? `<div class="new">New!</div>` : ""}
        ${info.arrived ? `<div class="arrived">Your squishy has arrived!</div>` : ""}
        ${def.family === "halloween" ? `<div class="special">🎃 Halloween Special</div>` : ""}
        <img alt="">
        <div class="name"><input maxlength="${NAME_MAX}" enterkeyhint="done" aria-label="Name"><span class="pen">${PEN}</span></div>
        <div class="kind">${esc(def.design)} · ${esc(kind)}</div>
        <div class="chips"><span>${mood.icon} ${esc(mood.name)}</span><span class="feel">${esc(feelWord(def.soft))}</span></div>
        <div class="mood">${esc(mood.about)}</div>
        ${info.cameWith ? `<div class="came">It came wearing a ${esc(info.cameWith)}!</div>` : ""}
        ${info.stars ? `<div class="repeat">You have this one! +${info.stars} stars</div>` : ""}
        <div class="btns${info.fromBook ? " three" : ""}">${info.fromBook ? `<button class="big alt hold">Hold</button><button class="big send">${GIFT_SM}Share</button>` : ""}<button class="big yay">${info.fromBook ? "Close" : "Yay!"}</button></div>
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
    this.coverChanged();
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
      this.modal.querySelector(".send")?.addEventListener("click", () => {
        this.closeCard();
        this.closeBook();
        this.h.share(def.id);
      });
    });
  }

  private closeCard(): void {
    if (!this.modal.classList.contains("on")) return;
    this.modal.classList.remove("on");
    const done = this.cardDone;
    this.cardDone = null;
    done?.();
    this.coverChanged();
  }

  /** The Squishy Book: every squishy, with shadows for ones not found yet. */
  book(owned: Record<string, { mood?: MoodId }>, nameOf: (id: string) => string): void {
    const found = CATALOG.filter((d) => owned[d.id]).length;
    const full = this.h.full().has;
    // The way out sits in the sticky header, so it is there however far down you scroll.
    let html = `<div class="head"><button class="back" aria-label="Back">${BACK}</button><h1>Squishy Book</h1><div class="found">You found ${found} of ${CATALOG.length}!</div></div>`;
    const mail = this.h.mail();
    html += `<div class="mailbox">
      <div class="mtop"><span class="mico">${MAILBOX}${mail ? `<span class="badge">${mail}</span>` : ""}</span>
        <div class="mtxt"><b>Squishy mail</b><small>${mail ? `${mail === 1 ? "A squishy is" : `${mail} squishies are`} waiting for you!` : found ? "Tap a squishy, then Share to send a friend a twin." : "Find a squishy to share it with a friend."}</small></div>
        ${mail ? `<button class="mopen">Open</button>` : ""}</div>
      <button class="mpaste">Got a squishy link? Paste it here</button></div>`;
    for (const fam of FAMILIES) {
      const defs = CATALOG.filter((d) => d.family === fam.id);
      const got = defs.filter((d) => owned[d.id]).length;
      html += `<h2>${esc(fam.name)} <span>${got}/${defs.length}</span></h2>`;
      if (fam.id === "halloween") html += `<div class="note">🎃 Only in Spooky Boxes, which come on Halloween!</div>`;
      html += `<div class="grid">`;
      for (const d of defs) {
        const locked = !owned[d.id] && !squishyOpen(d, full);
        html += `<button class="cell${owned[d.id] ? "" : " missing"}${locked ? " locked" : ""}" data-id="${d.id}"><b>${d.no}</b>${locked ? `<span class="lock" aria-label="Full game">✨</span>` : ""}<img alt=""></button>`;
      }
      html += `</div>`;
    }
    html += `<button class="done">Done</button><div class="pad"></div>`;
    this.bookEl.innerHTML = html;
    this.bookEl.scrollTop = 0;
    this.bookEl.classList.add("on");
    this.root.classList.add("book-on");
    this.coverChanged();
    this.bookEl.querySelector(".back")!.addEventListener("click", () => this.closeBook());
    this.bookEl.querySelector(".done")!.addEventListener("click", () => this.closeBook());
    this.bookEl.querySelector(".mopen")?.addEventListener("click", () => {
      this.closeBook();
      this.h.openMail();
    });
    this.bookEl.querySelector(".mpaste")!.addEventListener("click", () => this.pasteSheet());
    for (const cell of this.bookEl.querySelectorAll<HTMLButtonElement>(".cell")) {
      const id = cell.dataset.id!;
      const img = cell.querySelector("img")!;
      this.thumbs.want(id, (url) => (img.src = url));
      cell.addEventListener("click", () => {
        const def = CATALOG.find((d) => d.id === id)!;
        if (owned[id]) void this.card({ def, name: nameOf(id), fromBook: true, mood: owned[id].mood });
        else {
          cell.classList.remove("wobble");
          void cell.offsetWidth;
          cell.classList.add("wobble");
          if (cell.classList.contains("locked")) this.toast("This one is in the full game ✨", 1600);
        }
      });
    }
  }

  closeBook(): void {
    this.bookEl.classList.remove("on");
    this.root.classList.remove("book-on");
    this.coverChanged();
  }
}
