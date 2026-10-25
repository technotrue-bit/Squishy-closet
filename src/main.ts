// Squishy Closet! Squishy Island is the title. Play opens your first squishy
// from its steamer box, a little tutorial teaches the five ways to play, and
// love you give earns more boxes. Every squishy you find goes on the closet
// shelf and into the Squishy Book. Everything stays on this device.

import * as THREE from "three";
import { Gestures, type GestureEvent } from "./gestures";
import { Squishy, type Bounds } from "./squishy";
import { buildStage, BASKET_FLOOR, BASKET_WALL, LID_CLOSED, LID_REST } from "./scene";
import { buildIsland } from "./island";
import { Effects } from "./fx";
import { Ui, type HandMove, type Screen } from "./ui";
import { Thumbs } from "./thumbs";
import { CATALOG, defById, type SquishyDef } from "./catalog";
import { openBox } from "./boxes";
import { addLove, cleanName, collect, loadSave, nameOf, storeSave } from "./save";
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
const island = buildIsland();
const fx = new Effects();
stage.scene.add(fx.group);
const thumbs = new Thumbs();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

let screen: Screen = "title";
const persist = () => storeSave(save);
const ownedIds = () => Object.keys(save.owned).sort((a, b) => save.owned[b].got - save.owned[a].got);

// ---- the tutorial -----------------------------------------------------

const STEPS: { id: string; text: string; sub: string; move: HandMove }[] = [
  { id: "hold", text: "Squish me!", sub: "Press and hold", move: "press" },
  { id: "pet", text: "Pet me!", sub: "Slide your finger across", move: "pet" },
  { id: "tickle", text: "Tickle me!", sub: "Rub fast back and forth", move: "tickle" },
  { id: "flick", text: "Toss me!", sub: "Flick me up high", move: "toss" },
  { id: "hug", text: "Hug me!", sub: "Hold with two fingers", move: "hug" },
];
const STEP_LOVE = 20;
/** After the tutorial, point at the Open button until the next box is opened. */
let pointAtOpen = false;

const tutorialStep = () => (save.tutorial === "done" ? null : (STEPS.find((s) => !(save.tutorial as string[]).includes(s.id)) ?? null));

function showTutorial(): void {
  const step = tutorialStep();
  if (!step || screen !== "closet") {
    ui.showSkip(false);
    return;
  }
  const done = (save.tutorial as string[]).length;
  ui.hint(step.text, step.sub, { done, total: STEPS.length });
  ui.showSkip(true);
}

function finishTutorial(): void {
  save.tutorial = "done";
  // Everyone gets their second box for finishing.
  if (save.boxes === 0) {
    save.boxes = 1;
    save.love = 0;
  }
  persist();
  ui.showSkip(false);
  ui.hand(null);
  refreshMeters();
  pointAtOpen = true;
  ui.hint("You earned a box!", "Tap Open to see who's inside");
  sfx.chime(true);
}

function tutorialDid(action: string): void {
  const step = tutorialStep();
  if (!step || step.id !== action || screen !== "closet") return;
  const done = save.tutorial as string[];
  done.push(action);
  sfx.chime(false);
  fx.emit("heart", squishy.topPoint(), 6);
  ui.toast(["Yay!", "So good!", "Wow!", "Hee hee!", "Aww!"][done.length - 1] ?? "Yay!", 1100);
  giveLove(STEP_LOVE);
  persist();
  if (!tutorialStep()) setTimeout(finishTutorial, 900);
  else setTimeout(showTutorial, 900);
}

// ---- love and boxes ---------------------------------------------------

function refreshMeters(): void {
  ui.setLove(save.love);
  ui.setBoxes(save.boxes);
  ui.setStars(save.stars);
}

function giveLove(n: number): void {
  const earned = addLove(save, n);
  ui.setLove(save.love);
  ui.beat();
  if (earned > 0) {
    ui.setBoxes(save.boxes);
    // During the tutorial the box is announced when it ends.
    if (save.tutorial === "done") {
      ui.toast("New Squishy Box!");
      sfx.chime(true);
      fx.emit("sparkle", squishy.topPoint(), 10);
    }
  }
  persist();
}

// ---- the squishy ------------------------------------------------------

const startDef: SquishyDef = (save.active && defById(save.active)) || CATALOG[0];
const squishy = new Squishy(startDef, {
  fx: (kind, at, count) => fx.emit(kind, at, count),
  love: (n) => {
    if (screen === "closet") giveLove(n);
  },
  did: (a) => {
    if (!save.tried.includes(a)) {
      save.tried.push(a);
      persist();
    }
    tutorialDid(a);
  },
});
squishy.home.set(0, BASKET_FLOOR - BOTTOM_Y, 0);
squishy.group.position.copy(squishy.home);
Object.assign(squishy.basket, BASKET_WALL);
stage.scene.add(squishy.group);

function hold(id: string): void {
  const def = defById(id);
  if (!def || !save.owned[id] || screen !== "closet") return;
  if (save.active !== id) {
    save.active = id;
    squishy.setDesign(def);
    persist();
    ui.setShelf(ownedIds(), save.active);
    fx.emit("sparkle", squishy.topPoint(), 6);
  }
  squishy.hello();
  ui.toast(nameOf(save, id), 1200);
}

// ---- opening a box ----------------------------------------------------

interface Reveal {
  def: SquishyDef;
  first: boolean;
  taps: number;
  /** Closing the lid, waiting for taps, popping open. */
  phase: "closing" | "waiting" | "popping" | "done";
  t: number;
  shake: number;
}
let reveal: Reveal | null = null;
let popScale = 1;

function startBox(first: boolean): void {
  const owned = new Set(Object.keys(save.owned));
  const { def } = openBox(owned, new Date(), Math.random, first);
  reveal = { def, first, taps: 0, phase: "closing", t: 0, shake: 0 };
  fingersUp();
  setScreen("box");
  squishy.group.visible = false;
  ui.hint(first ? "Your first squishy!" : "A new squishy!", "Tap the box 3 times");
  sfx.whoosh();
}

function tapBox(): void {
  if (!reveal || reveal.phase !== "waiting") return;
  reveal.taps++;
  reveal.shake = 0.6 + reveal.taps * 0.35;
  sfx.squeak(1 + reveal.taps * 0.15, 0.12, 0.3);
  sfx.vibrate(12 * reveal.taps);
  fx.emit("sparkle", new THREE.Vector3(0, 0.7, 0.6), 2 + reveal.taps * 2);
  if (reveal.taps >= 3) {
    reveal.phase = "popping";
    reveal.t = 0;
    ui.hint(null);
    ui.hand(null);
    setTimeout(popOut, 380);
  }
}

function popOut(): void {
  if (!reveal) return;
  const { def, first } = reveal;
  if (!first) save.boxes = Math.max(0, save.boxes - 1);
  const got = collect(save, def.id, Date.now());
  const prevActive = save.active;
  if (got.isNew) save.active = def.id;
  persist();
  squishy.setDesign(def);
  squishy.group.visible = true;
  popScale = 0.15;
  squishy.popIn();
  const at = squishy.topPoint();
  fx.emit("sparkle", at, 16);
  fx.emit("heart", at, 6);
  fx.emit("star", at, 4);
  sfx.pop();
  sfx.chime(true);
  setTimeout(async () => {
    await ui.card({ def, name: nameOf(save, def.id), isNew: got.isNew, stars: got.isNew ? undefined : got.stars });
    // A repeat goes to the star jar; you keep holding the one you had.
    if (!got.isNew && prevActive && prevActive !== def.id) {
      const back = defById(prevActive);
      if (back) squishy.setDesign(back);
    }
    reveal = null;
    pointAtOpen = false;
    setScreen("closet");
    squishy.hello();
  }, 1100);
}

// ---- screens ----------------------------------------------------------

function setScreen(s: Screen): void {
  screen = s;
  ui.show(s);
  ui.hand(null);
  if (s === "closet") {
    refreshMeters();
    ui.setShelf(ownedIds(), save.active);
    if (tutorialStep()) showTutorial();
    else if (pointAtOpen && save.boxes > 0) ui.hint("You earned a box!", "Tap Open to see who's inside");
    else ui.hint(null);
  } else {
    ui.hint(null);
    ui.showSkip(false);
  }
  fit();
}

const ui = new Ui(
  {
    play: () => {
      sfx.unlockAudio();
      sfx.pop();
      if (Object.keys(save.owned).length === 0) startBox(true);
      else setScreen("closet");
    },
    toggleSound: () => {
      save.sound = !save.sound;
      sfx.unlockAudio();
      sfx.setSound(save.sound);
      persist();
      return save.sound;
    },
    openBox: () => {
      sfx.unlockAudio();
      if (screen !== "closet") return;
      if (save.boxes > 0 && squishy.isHome) startBox(false);
      else if (save.boxes === 0) ui.toast("Give love to fill the heart!", 1600);
    },
    openBook: () => {
      sfx.unlockAudio();
      sfx.pop();
      ui.book(save.owned, (id) => nameOf(save, id));
    },
    goIsland: () => {
      sfx.pop();
      setScreen("title");
    },
    hold,
    rename: (id, name) => {
      const o = save.owned[id];
      if (!o) return;
      const clean = cleanName(name);
      if (clean && clean !== defById(id)?.name) o.name = clean;
      else delete o.name;
      persist();
    },
    skipTutorial: () => {
      if (save.tutorial !== "done") finishTutorial();
    },
  },
  thumbs,
  save.sound,
);

// ---- fitting the view -------------------------------------------------

const bounds: Bounds = { minX: -3, maxX: 3, maxY: 6, floorY: 0 };
let worldPerPx = 0.01;

function fit(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  fitCamera(camera, w, h);
  worldPerPx = flyBounds(camera, h, bounds);
  island.fit(w, h);
}
window.addEventListener("resize", fit);

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
/** Where a world point lands on the screen. */
function toScreen(p: THREE.Vector3): { x: number; y: number } {
  const s = p.clone().project(camera);
  return { x: ((s.x + 1) / 2) * window.innerWidth, y: ((1 - s.y) / 2) * window.innerHeight };
}
/** Touches near the bun count too, so small fingers don't miss. */
function nearSquishy(x: number, y: number): THREE.Vector3 | null {
  const direct = hitSquishy(x, y);
  if (direct) return direct;
  const c = squishy.group.position.clone();
  c.y += 0.1;
  const s = toScreen(c);
  const r = 1.25 / (worldPerPx || 0.01);
  if (Math.hypot(x - s.x, y - s.y) > r) return null;
  // Aim at the bun from that side.
  return hitSquishy(s.x + (x - s.x) * 0.6, s.y + (y - s.y) * 0.6) ?? squishy.group.position.clone();
}
const dirAt = (x: number, y: number) => {
  const p = nearSquishy(x, y);
  return p ? squishy.localDir(p) : new THREE.Vector3(0, 0, 1);
};

const playing = () => screen === "closet" && !ui.busy;

const gestures = new Gestures((e: GestureEvent) => {
  if (!playing()) return;
  switch (e.type) {
    case "look": {
      const c = squishy.group.position.clone();
      c.y += 0.2;
      const s = toScreen(c);
      squishy.lookAt((e.x - s.x) / (window.innerWidth * 0.3), -(e.y - s.y) / (window.innerHeight * 0.2));
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
  const s = toScreen(c);
  // Walk in toward the middle until we land on the bun.
  for (const f of [0.85, 0.7, 0.55, 0.4]) {
    const h = rayHit(s.x + (x - s.x) * f, s.y + (y - s.y) * f);
    if (h) return squishy.dirAtHit(h);
  }
  return null;
}
function fingerEnd(id: number): void {
  if (!fingers.delete(id)) return;
  squishy.fingerUp(id);
}
function fingersUp(): void {
  for (const id of [...fingers.keys()]) fingerEnd(id);
}

canvas.addEventListener("pointerdown", (e) => {
  sfx.unlockAudio();
  if (screen === "box") {
    tapBox();
    return;
  }
  if (!playing()) return;
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

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const qRest = new THREE.Quaternion().setFromEuler(LID_REST.rot);
const qClosed = new THREE.Quaternion().setFromEuler(LID_CLOSED.rot);

/** Moves the lid between resting (0) and closed (1), hopping up in between. */
function placeLid(k: number, arc: number, spin = 0): void {
  const lid = stage.lid;
  lid.position.lerpVectors(LID_REST.pos, LID_CLOSED.pos, k);
  lid.position.y += Math.sin(k * Math.PI) * arc;
  lid.quaternion.slerpQuaternions(qRest, qClosed, k);
  if (spin) lid.rotateY(spin);
}

function stepReveal(dt: number, now: number): void {
  const r = reveal;
  if (!r) return;
  r.t += dt;
  const lid = stage.lid;
  if (r.phase === "closing") {
    const k = Math.min(1, r.t / 0.6);
    placeLid(ease(k), 0.9);
    if (k >= 1) {
      r.phase = "waiting";
      sfx.thud(0.6);
    }
  } else if (r.phase === "waiting" || (r.phase === "popping" && r.t < 0.38)) {
    placeLid(1, 0);
    r.shake = Math.max(0, r.shake - dt * 1.6);
    const s = r.shake;
    lid.rotation.z = Math.sin(now * 38) * 0.06 * s;
    lid.rotation.x = Math.cos(now * 31) * 0.04 * s;
    lid.position.y += Math.abs(Math.sin(now * 19)) * 0.08 * s;
    const w = Math.sin(now * 30);
    stage.basket.scale.set(1 + 0.04 * s * w, 1 - 0.05 * s * Math.abs(w), 1 + 0.04 * s * w);
    if (r.phase === "waiting") {
      const p = toScreen(new THREE.Vector3(0.3, 0.55, 0.9));
      ui.hand("tap", p.x, p.y);
    }
  } else if (r.phase === "popping") {
    // The lid flies off, flips and lands back where it rests.
    const k = Math.min(1, (r.t - 0.38) / 0.75);
    placeLid(1 - ease(k), 2.6, Math.sin(k * Math.PI) * 1.4);
    stage.basket.scale.set(1, 1, 1);
    if (k >= 1) r.phase = "done";
  }
}

function stepHints(): void {
  if (screen !== "closet") return;
  if (ui.busy) {
    ui.hand(null);
    return;
  }
  const step = tutorialStep();
  if (step && fingers.size === 0 && squishy.isHome) {
    const p = toScreen(squishy.group.position.clone().add(new THREE.Vector3(0.15, 0.55, 0.9)));
    ui.hand(step.move, p.x, p.y);
  } else if (!step && pointAtOpen && save.boxes > 0) {
    const btn = document.querySelector(".ui .nav .open .ico");
    if (btn) {
      const b = btn.getBoundingClientRect();
      ui.hand("tap", b.left + b.width * 0.55, b.top + b.height * 0.45);
    }
  } else ui.hand(null);
}

let last = performance.now();
let hugHearts = 0;
function frame(): void {
  const t = performance.now();
  const dt = Math.min(1 / 20, (t - last) / 1000);
  last = t;
  const now = t / 1000;
  thumbs.step();
  if (screen === "title") {
    island.update(dt, now);
    renderer.render(island.scene, island.camera);
    requestAnimationFrame(frame);
    return;
  }
  gestures.update(t);
  stepReveal(dt, now);
  squishy.update(dt, now, bounds);
  if (popScale < 1) {
    popScale = Math.min(1, popScale + dt * 2.4);
    const k = popScale;
    // Grow with a little overshoot.
    squishy.group.scale.setScalar(k + Math.sin(k * Math.PI) * 0.25);
  }
  // While hugging, hearts float up and love grows.
  if (squishy.isHugging) {
    hugHearts += dt;
    if (hugHearts > 0.35) {
      hugHearts = 0;
      fx.emit("heart", squishy.topPoint(), 1);
      squishy.giveLove(2);
    }
  }
  stepHints();
  fx.update(dt);
  // Shadow under the bun when it is out of the basket.
  const p = squishy.group.position;
  const out = Math.hypot(p.x, p.z) > 0.3;
  stage.shadow.visible = out && squishy.group.visible;
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

setScreen("title");
requestAnimationFrame(frame);

document.addEventListener("visibilitychange", () => {
  last = performance.now();
});
