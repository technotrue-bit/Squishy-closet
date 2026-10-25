// Squishy Closet! test build: one bao squishy in its steamer basket that you can
// tap, squish, pet, tickle, toss and hug, to settle how a squishy should feel.

import * as THREE from "three";
import { Gestures, type GestureEvent } from "./gestures";
import { Squishy, type Bounds } from "./squishy";
import { buildStage, BASKET_FLOOR, BASKET_WALL } from "./scene";
import { Effects } from "./fx";
import { Hud, type ActionId } from "./hud";
import { lookById } from "./looks";
import { feelWord } from "./feel";
import { addLove, loadSave, storeSave } from "./save";
import * as sfx from "./audio";
import { BOTTOM_Y } from "./bao";
import { fitCamera, flyBounds } from "./view";

const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const save = loadSave();
sfx.setSound(save.sound);
const stage = buildStage(renderer);
const fx = new Effects();
stage.scene.add(fx.group);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

let hud: Hud;
const squishy = new Squishy(lookById(save.look), {
  fx: (kind, at, count) => fx.emit(kind, at, count),
  love: (n) => {
    const ups = addLove(save, n);
    hud.setLove(save.love, save.level);
    hud.beat();
    if (ups > 0) {
      hud.toast(`Love level ${save.level}!`);
      sfx.chime(true);
      fx.emit("heart", squishy.topPoint(), 10);
      fx.emit("sparkle", squishy.topPoint(), 8);
    }
    storeSave(save);
  },
  did: (a) => {
    if (save.tried.includes(a)) return;
    save.tried.push(a);
    hud.setTried(save.tried);
    sfx.chime(false);
    if (save.tried.length === 6) setTimeout(() => hud.toast("You did them all!"), 600);
    storeSave(save);
  },
});
squishy.home.set(0, BASKET_FLOOR - BOTTOM_Y, 0);
squishy.group.position.copy(squishy.home);
Object.assign(squishy.basket, BASKET_WALL);
stage.scene.add(squishy.group);

hud = new Hud(
  {
    pickLook: (look) => {
      sfx.unlockAudio();
      save.look = look.id;
      squishy.setLook(look);
      hud.setLook(look.id);
      sfx.pop();
      sfx.squeak(look.pitch, 0.14, 0.28);
      fx.emit("sparkle", squishy.topPoint(), 6);
      hud.toast(feelWord(look.soft));
      storeSave(save);
    },
    toggleSound: () => {
      save.sound = !save.sound;
      sfx.unlockAudio();
      sfx.setSound(save.sound);
      storeSave(save);
      return save.sound;
    },
  },
  save.sound,
);
hud.setLook(save.look);
hud.setLove(save.love, save.level);
hud.setTried(save.tried as ActionId[]);

// ---- fitting the view -------------------------------------------------

const bounds: Bounds = { minX: -3, maxX: 3, maxY: 6, floorY: 0 };
let worldPerPx = 0.01;

function fit(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  fitCamera(camera, w, h);
  worldPerPx = flyBounds(camera, h, bounds);
}
window.addEventListener("resize", fit);
fit();

// ---- touches ----------------------------------------------------------

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayHit(x: number, y: number): THREE.Intersection | null {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(squishy.mesh, false);
  return hits[0] ?? null;
}
function hitSquishy(x: number, y: number): THREE.Vector3 | null {
  return rayHit(x, y)?.point ?? null;
}
/** Touches near the bun count too, so small fingers don't miss. */
function nearSquishy(x: number, y: number): THREE.Vector3 | null {
  const direct = hitSquishy(x, y);
  if (direct) return direct;
  const c = squishy.group.position.clone();
  c.y += 0.1;
  const s = c.project(camera);
  const sx = ((s.x + 1) / 2) * window.innerWidth;
  const sy = ((1 - s.y) / 2) * window.innerHeight;
  const r = 1.25 / (worldPerPx || 0.01);
  if (Math.hypot(x - sx, y - sy) > r) return null;
  // Aim at the bun from that side.
  return hitSquishy(sx + (x - sx) * 0.6, sy + (y - sy) * 0.6) ?? squishy.group.position.clone();
}
const dirAt = (x: number, y: number) => {
  const p = nearSquishy(x, y);
  return p ? squishy.localDir(p) : new THREE.Vector3(0, 0, 1);
};

const gestures = new Gestures((e: GestureEvent) => {
  switch (e.type) {
    case "look": {
      const c = squishy.group.position.clone();
      c.y += 0.2;
      const s = c.project(camera);
      const sx = ((s.x + 1) / 2) * window.innerWidth;
      const sy = ((1 - s.y) / 2) * window.innerHeight;
      squishy.lookAt((e.x - sx) / (window.innerWidth * 0.3), -(e.y - sy) / (window.innerHeight * 0.2));
      break;
    }
    case "touch":
      squishy.touch();
      break;
    case "tap":
      squishy.tap(dirAt(e.x, e.y));
      break;
    case "pressStart":
      squishy.pressStart(dirAt(e.x, e.y));
      break;
    case "pressHold":
      squishy.pressHold(e.held);
      break;
    case "pressEnd":
      squishy.pressEnd(e.held);
      break;
    case "stroke":
      squishy.stroke(e.dx, e.dy, e.speed);
      break;
    case "tickle":
      squishy.tickle();
      break;
    case "flick":
      squishy.flick(e.vx * worldPerPx, -e.vy * worldPerPx);
      break;
    case "dragEnd":
      squishy.dragEnd();
      break;
    case "hugStart":
      squishy.hugStart();
      break;
    case "hugEnd":
      squishy.hugEnd();
      break;
  }
});

const canvas = renderer.domElement;
const nowMs = () => performance.now();
// Every finger on the bun pushes in right where it is and follows it around,
// separately from what the gesture turns out to be.
const fingers = new Map<number, { x0: number; y0: number; sliding: boolean }>();
/** The bun's surface under a screen point, or the nearest edge when just off it. */
function fingerDir(x: number, y: number): THREE.Vector3 | null {
  const hit = rayHit(x, y);
  if (hit) return squishy.dirAtHit(hit);
  const c = squishy.group.position.clone();
  c.y += 0.1;
  const s = c.project(camera);
  const sx = ((s.x + 1) / 2) * window.innerWidth;
  const sy = ((1 - s.y) / 2) * window.innerHeight;
  // Walk in toward the middle until we land on the bun.
  for (const f of [0.85, 0.7, 0.55, 0.4]) {
    const h = rayHit(sx + (x - sx) * f, sy + (y - sy) * f);
    if (h) return squishy.dirAtHit(h);
  }
  return null;
}
function fingerEnd(id: number): void {
  if (!fingers.delete(id)) return;
  squishy.fingerUp(id);
}

canvas.addEventListener("pointerdown", (e) => {
  sfx.unlockAudio();
  canvas.setPointerCapture(e.pointerId);
  const onBody = squishy.isHome && nearSquishy(e.clientX, e.clientY) !== null;
  if (onBody) {
    const dir = fingerDir(e.clientX, e.clientY);
    if (dir) {
      fingers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, sliding: false });
      squishy.fingerDown(e.pointerId, dir);
    }
  }
  gestures.down(e.pointerId, e.clientX, e.clientY, nowMs(), onBody);
});
canvas.addEventListener("pointermove", (e) => {
  const f = fingers.get(e.pointerId);
  if (f) {
    if (!squishy.isHome) fingerEnd(e.pointerId);
    else {
      if (Math.hypot(e.clientX - f.x0, e.clientY - f.y0) > 12) f.sliding = true;
      const dir = fingerDir(e.clientX, e.clientY);
      if (dir) squishy.fingerMove(e.pointerId, dir, f.sliding);
    }
  }
  gestures.move(e.pointerId, e.clientX, e.clientY, nowMs());
});
canvas.addEventListener("pointerup", (e) => {
  fingerEnd(e.pointerId);
  gestures.up(e.pointerId, e.clientX, e.clientY, nowMs());
});
canvas.addEventListener("pointercancel", (e) => {
  fingerEnd(e.pointerId);
  gestures.cancel(e.pointerId, nowMs());
});

// ---- loop -------------------------------------------------------------

let last = performance.now();
let hugHearts = 0;
function frame(): void {
  const t = performance.now();
  const dt = Math.min(1 / 20, (t - last) / 1000);
  last = t;
  gestures.update(t);
  squishy.update(dt, t / 1000, bounds);
  // While hugging, hearts float up and love grows.
  if (squishy.isHugging) {
    hugHearts += dt;
    if (hugHearts > 0.35) {
      hugHearts = 0;
      fx.emit("heart", squishy.topPoint(), 1);
      squishy.giveLove(2);
    }
  }
  fx.update(dt);
  // Shadow under the bun when it is out of the basket.
  const p = squishy.group.position;
  const out = Math.hypot(p.x, p.z) > 0.3;
  stage.shadow.visible = out;
  if (out) {
    stage.shadow.position.set(p.x, 0.006, p.z);
    const lift = Math.max(0, p.y - (0 - BOTTOM_Y));
    const s = 1 / (1 + lift * 0.35);
    stage.shadow.scale.setScalar(s);
    (stage.shadow.material as THREE.MeshBasicMaterial).opacity = s;
  }
  renderer.render(stage.scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener("visibilitychange", () => {
  last = performance.now();
});
