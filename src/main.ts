// Aurora's World. Squishy Island is the title. Play opens your first squishy
// from its steamer box, a little tutorial teaches the five ways to play, and
// love you give earns more boxes. Up to four squishies are out at once: the
// one you hold, and friends who play, do jobs and come up to visit behind it.
// Play at the tea table, the beach, on a sailing boat or in the living room,
// and dress everyone in hats. Everything stays on this device.

import * as THREE from "three";
import { Gestures, type GestureEvent } from "./gestures";
import { Squishy, type Bounds } from "./squishy";
import { buildStage, BASKET_FLOOR, BASKET_WALL, LID_CLOSED, LID_REST } from "./scene";
import { buildIsland } from "./island";
import { Effects } from "./fx";
import { Ui, type HandMove, type Screen, type ShelfState } from "./ui";
import { Thumbs } from "./thumbs";
import { CATALOG, defById, type SquishyDef } from "./catalog";
import { isOctober, openBox } from "./boxes";
import {
  addCookie,
  addHat,
  addLove,
  babyName,
  bringOut,
  cleanName,
  collect,
  growUp,
  holdSquishy,
  keepBaby,
  loadSave,
  nameOf,
  sendIn,
  storeSave,
  type Save,
  TEAM_MAX,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./save";
import * as sfx from "./audio";
import { BOTTOM_Y } from "./bao";
import { fitCamera, flyBounds, swayCamera } from "./view";
import { placeScene } from "./placeScenes";
import { hatsEarned, placeById, type PlaceId } from "./places";
import { boxHat, hatById } from "./hats";
import { Crew } from "./friends";
import { Visitors } from "./visitors";
import { Nursery } from "./nursery";
import { moodById, randomMood, type MoodId } from "./personality";
import { combineSaves, decodeSave, encodeSave, findCode, HASH, keepStorage, moveLink } from "./move";
import {
  BABIES_MAX,
  fulfil,
  growLeft,
  growth,
  growWords,
  isNapping,
  moodOf,
  newBaby,
  pickBabyKind,
  play as playBaby,
  points,
  stepWant,
  teach,
  SHY_BELOW,
  type Baby,
} from "./babies";
import { wishFor, wishWords } from "./wishes";

const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
// Sharpness adapts to the phone: start crisp, step down if frames run slow.
const MAX_DPR = Math.min(window.devicePixelRatio || 1, 2);
let dpr = MAX_DPR;
renderer.setPixelRatio(dpr);
// Neutral tone mapping keeps the pastel colors true instead of graying them.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
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
let keepAsked = false;
const persist = () => {
  storeSave(save);
  // Once there is something to lose, ask the browser to keep it.
  if (!keepAsked && Object.keys(save.owned).length) {
    keepAsked = true;
    keepStorage();
  }
};
const ownedIds = () => Object.keys(save.owned).sort((a, b) => save.owned[b].got - save.owned[a].got);
const hatOf = (id: string | null) => (id && save.owned[id]?.hat) || null;
const moodIdOf = (id: string | null): MoodId => (id && save.owned[id]?.mood) || "bouncy";

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
  // And a party hat to wear.
  if (addHat(save, "party")) ui.newHat(true);
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
  ui.setJobs(save.jobs[save.place] ?? 0);
  ui.setCookies(save.cookies);
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
/** Where the one you hold sits: on the floor in front. Its box is at the back. */
const FLOOR_HOME = new THREE.Vector3(0, -BOTTOM_Y, 0);
squishy.home.copy(FLOOR_HOME);
squishy.group.position.copy(squishy.home);
squishy.setHat(hatOf(save.active));
squishy.mood = moodById(moodIdOf(save.active));
stage.scene.add(squishy.group);

/** Shows `id` as the one you hold: its design, hat and personality. */
function showHeld(def: SquishyDef, id: string): void {
  squishy.setDesign(def, hatOf(id));
  squishy.mood = moodById(moodIdOf(id));
}

// ---- friends and places -------------------------------------------------

const crew = new Crew(stage.scene, squishy, stage.shadowMat, {
  fx: (kind, at, count) => fx.emit(kind, at, count),
  love: (n) => {
    if (screen === "closet") giveLove(n);
  },
  jobDone: (f, job) => {
    if (screen !== "closet") return;
    save.jobs[save.place] = (save.jobs[save.place] ?? 0) + 1;
    ui.setJobs(save.jobs[save.place], true);
    giveLove(6);
    // Cookies for keeping babies: baked at the tea table, or found now and then.
    const cookie = (job.id === "cookies" || Math.random() < 0.12) && addCookie(save);
    if (cookie) {
      persist();
      ui.setCookies(save.cookies, true);
    }
    if (!ui.busy && !tutorialStep()) ui.toast(`${nameOf(save, f.id)} ${job.done}!${cookie ? (job.id === "cookies" ? " +1 🍪" : " Found a 🍪") : ""}`, 1800);
    void hatsFromJobs();
  },
  said: (text) => {
    if (!ui.busy && !tutorialStep()) ui.toast(text, 1600);
  },
  name: (id) => nameOf(save, id),
});

function syncTeam(): void {
  crew.setTeam(
    save.team.filter((id) => defById(id)).map((id) => ({ id, def: defById(id)!, hat: hatOf(id), mood: moodIdOf(id) })),
  );
}

// ---- squishies passing by, and babies -------------------------------------

const visitors = new Visitors(stage.scene, stage.shadowMat, {
  fx: (kind, at, count) => fx.emit(kind, at, count),
  love: (n) => {
    if (screen === "closet") giveLove(n);
  },
  said: (text) => {
    if (!ui.busy && !tutorialStep()) ui.toast(text, 1400);
  },
  busy: () => [...(save.active ? [save.active] : []), ...save.team, ...save.babies.map((b) => b.kind)],
});

const nursery = new Nursery(stage.scene, stage.shadowMat, squishy, {
  fx: (kind, at, count) => fx.emit(kind, at, count),
});
// Friends hop around the one you hold, and around a baby asleep where they play.
crew.blockers = () => {
  const out = [{ x: squishy.home.x, z: squishy.home.z, r: 1.2 }];
  const sl = nursery.sleeperAt;
  if (sl) out.push({ x: sl.x, z: sl.z, r: 0.6 });
  return out;
};

/** The icon in a baby's thought bubble, when it wants something. */
const wantIcon = (b: Baby): string | null => (b.want ? (moodById(b.want).lesson?.icon ?? null) : null);

function syncBabies(): void {
  const now = Date.now();
  nursery.setBabies(
    save.babies
      .filter((b) => defById(b.kind))
      .map((b) => ({ key: b.key, def: defById(b.kind)!, mood: moodOf(b), napping: isNapping(b, now), want: wantIcon(b), grow: growth(b, now) })),
  );
}

/** Babies start wanting things now and then; a bubble over their head shows what. */
let wantClock = 2;
function stepWants(dt: number): void {
  wantClock -= dt;
  if (wantClock > 0) return;
  wantClock = 2;
  // Not while you're doing a wish or looking at a card: the wish you're on stays put.
  if (screen !== "closet" || ui.busy || tutorialStep()) return;
  const now = Date.now();
  let changed = false;
  for (const b of save.babies) {
    const res = stepWant(b, now, Math.random);
    if (!res) continue;
    changed = true;
    nursery.setWant(b.key, wantIcon(b));
    if (res === "new" && !ui.busy) ui.toast(`${wishWords(wishFor(b.want!).ask, babyName(b))} Tap it`, 2400);
  }
  if (changed) {
    persist();
    refreshShelf();
  }
}

/** Do what a baby wants: a little game together, then it grows a bit. */
async function doWish(key: string): Promise<void> {
  const b = save.babies.find((x) => x.key === key);
  const def = b && defById(b.kind);
  if (!b || !def || !b.want || isNapping(b, Date.now())) return;
  const want = b.want;
  const pitch = def.pitch;
  sfx.pop();
  const did = await ui.wish({
    def,
    name: babyName(b),
    want,
    beat: (done, n) => {
      if (done) return sfx.chime(true);
      if (want === "musical") sfx.hum(pitch * (1 + n * 0.12));
      else if (want === "bouncy" || want === "sporty") sfx.boing(pitch * (1.2 + n * 0.05));
      else if (want === "sleepy" || want === "calm" || want === "cuddly") sfx.purr(0.4);
      else if (want === "silly") sfx.giggle(pitch * 1.3);
      else if (want === "brave") sfx.whoosh();
      else {
        sfx.pop();
        sfx.squeak(pitch * (1.3 + n * 0.08), 0.08, 0.14);
      }
    },
  });
  // It may have grown up while you played.
  if (!did || !save.babies.includes(b)) return;
  const now = Date.now();
  b.want = want;
  fulfil(b, now, Math.random);
  persist();
  nursery.wished(key, want, growth(b, now));
  giveLove(5);
  const m = moodById(moodOf(b));
  ui.toast(points(b) >= SHY_BELOW ? `${babyName(b)} grew a little! Becoming ${m.name} ${m.icon}` : `${babyName(b)} grew a little!`, 2200);
  refreshShelf();
  checkGrowUp();
}

/** Seconds of play until a sleeping baby turns up somewhere. */
let babyClock = save.seen.includes("baby") ? 200 + Math.random() * 160 : 50;

function stepBabies(dt: number): void {
  if (screen !== "closet" || ui.busy || tutorialStep() || nursery.hasSleeper || save.babies.length >= BABIES_MAX) return;
  babyClock -= dt;
  if (babyClock > 0) return;
  babyClock = 240 + Math.random() * 180;
  const kind = pickBabyKind(new Set(Object.keys(save.owned)), save.babies.map((b) => b.kind), new Date(), Math.random);
  const def = defById(kind);
  if (!def) return;
  nursery.putSleeper(def, placeScene(placeId));
  if (!save.seen.includes("baby")) {
    save.seen.push("baby");
    persist();
    ui.toast("Shh! A baby squishy is asleep! Tap it", 2600);
  } else ui.toast("A baby squishy is napping nearby!", 2000);
}

async function foundBaby(): Promise<void> {
  const kind = nursery.sleeperKind;
  const def = kind ? defById(kind) : null;
  if (!def) return;
  sfx.squeak(def.pitch * 1.5, 0.1, 0.18);
  const keep = await ui.babyFound(def, save.cookies, save.babies.length >= BABIES_MAX);
  if (!keep) return;
  const baby = newBaby(def.id, Date.now());
  if (!keepBaby(save, baby)) return;
  persist();
  ui.setCookies(save.cookies, true);
  nursery.wakeSleeper(baby.key, moodOf(baby));
  sfx.chime(true);
  refreshShelf();
  ui.toast(`${babyName(baby)} is yours!`, 1800);
  setTimeout(() => {
    if (screen === "closet" && !ui.busy) openBaby(baby.key);
  }, 1900);
}

function babyInfo(key: string) {
  const b = save.babies.find((x) => x.key === key);
  const def = b && defById(b.kind);
  if (!b || !def) return null;
  const now = Date.now();
  return {
    key,
    def,
    name: babyName(b),
    left: growWords(growLeft(b, now)),
    becoming: points(b) >= SHY_BELOW ? moodById(moodOf(b)) : null,
    napping: isNapping(b, now),
    grow: growth(b, now),
    want: b.want ?? null,
  };
}

function openBaby(key: string): void {
  const info = babyInfo(key);
  if (!info) return;
  sfx.pop();
  ui.babySheet(info);
}

function teachBaby(key: string, mood: MoodId): void {
  const b = save.babies.find((x) => x.key === key);
  if (!b) return;
  const res = teach(b, mood, Date.now());
  persist();
  if (res === "napping") return;
  const lesson = moodById(mood).lesson;
  nursery.learned(key, mood, res === "tired");
  sfx.chime(false);
  giveLove(3);
  ui.toast(res === "tired" ? `${babyName(b)} is all tired out. Nap time!` : `${babyName(b)} loved ${lesson?.name.toLowerCase() ?? "that"}!`, 1800);
  refreshShelf();
}

function tapBaby(key: string): void {
  const b = save.babies.find((x) => x.key === key);
  if (!b) return;
  // Wanting something: tapping it is how you find out what, and do it.
  if (b.want && !isNapping(b, Date.now())) {
    void doWish(key);
    return;
  }
  const res = playBaby(b, Date.now());
  persist();
  nursery.played(key, res === "woke");
  giveLove(1);
  if (res === "woke") {
    ui.toast(`Oops! ${babyName(b)} was napping. Grumpy!`, 1600);
    refreshShelf();
  }
}

/** Babies a week old grow up, one card each. */
let growQueue = Promise.resolve();
function checkGrowUp(): void {
  const grown = growUp(save, Date.now());
  if (!grown.length) return;
  persist();
  syncBabies();
  syncTeam();
  refreshShelf();
  for (const g of grown) {
    const def = defById(g.baby.kind);
    if (!def) continue;
    growQueue = growQueue.then(async () => {
      while (screen !== "closet" || ui.busy) await new Promise((r) => setTimeout(r, 500));
      sfx.chime(true);
      fx.emit("sparkle", squishy.topPoint(), 10);
      await ui.card({ def, name: nameOf(save, def.id), mood: g.mood, grew: true, stars: g.joined ? 5 : undefined });
    });
  }
}

function refreshShelf(): void {
  const rank = (id: string): number => (id === save.active ? 0 : save.team.includes(id) ? 1 : 2);
  const ids = ownedIds().sort((a, b) => rank(a) - rank(b));
  const items: { id: string; state: ShelfState; hat: string | null; key?: string; napping?: boolean }[] = ids.map((id) => ({
    id,
    state: (id === save.active ? "held" : save.team.includes(id) ? "out" : "rest") as ShelfState,
    hat: hatOf(id),
  }));
  // Babies sit right after the ones out playing.
  const now = Date.now();
  const at = items.findIndex((it) => it.state === "rest");
  items.splice(at < 0 ? items.length : at, 0, ...save.babies.map((b) => ({ id: b.kind, state: "baby" as ShelfState, hat: null, key: b.key, napping: isNapping(b, now), want: wantIcon(b) })));
  ui.setShelf(items);
}

let hatQueue = Promise.resolve();
/** New hats from jobs at this place: show each one. */
function hatsFromJobs(): Promise<void> {
  const place = placeById(save.place);
  for (const id of hatsEarned(place, save.jobs[save.place] ?? 0, save.hats)) {
    addHat(save, id);
    persist();
    showNewHat(id);
  }
  return hatQueue;
}

function showNewHat(id: string): void {
  const hat = hatById(id);
  if (!hat) return;
  ui.newHat(true);
  hatQueue = hatQueue.then(async () => {
    while (screen !== "closet" || ui.busy) await new Promise((r) => setTimeout(r, 400));
    sfx.chime(true);
    const wear = await ui.hatCard(id, hat.name);
    if (wear) wearHat(id);
  });
}

function wearHat(id: string | null): void {
  const active = save.active;
  if (!active || !save.owned[active]) return;
  if (id) save.owned[active].hat = id;
  else delete save.owned[active].hat;
  persist();
  squishy.setHat(id);
  squishy.hello();
  fx.emit("sparkle", squishy.topPoint(), 10);
  sfx.pop();
  refreshShelf();
}

let placeId: PlaceId = save.place;
function goPlace(id: PlaceId, quiet = false): void {
  placeId = id;
  save.place = id;
  persist();
  const p = placeScene(id);
  stage.setPlace(p);
  crew.setPlace(p);
  visitors.setPlace(p);
  nursery.setPlace();
  ui.setJobs(save.jobs[id] ?? 0);
  if (!quiet) {
    sfx.whoosh();
    sfx.chime(false);
    squishy.hello();
    fx.emit("sparkle", squishy.topPoint(), 12);
    ui.toast(placeById(id).name, 1400);
  }
}

/** Makes `id` the one you hold; the one you held joins the friends if there is room. */
function hold(id: string): void {
  const def = defById(id);
  if (!def || !save.owned[id] || screen !== "closet") return;
  if (save.active !== id) {
    holdSquishy(save, id);
    showHeld(def, id);
    persist();
    syncTeam();
    refreshShelf();
    fx.emit("sparkle", squishy.topPoint(), 8);
  }
  squishy.yawTarget = 0;
  squishy.hello();
  ui.toast(nameOf(save, id), 1200);
}

async function shelfTap(id: string): Promise<void> {
  if (screen !== "closet" || !save.owned[id]) return;
  sfx.unlockAudio();
  if (id === save.active || save.team.includes(id)) {
    hold(id);
    return;
  }
  // A resting one comes out to play.
  let swapOut: string | undefined;
  if (save.team.length >= TEAM_MAX) {
    const picked = await ui.chooseRest(
      save.team.map((t) => ({ id: t, name: nameOf(save, t), hat: hatOf(t) })),
      nameOf(save, id),
    );
    if (!picked) return;
    swapOut = picked;
  }
  if (!bringOut(save, id, swapOut)) return;
  persist();
  syncTeam();
  refreshShelf();
  sfx.pop();
  ui.toast(`${nameOf(save, id)} came out to play!`, 1500);
}

function restFriend(id: string): void {
  if (!save.team.includes(id)) return;
  sendIn(save, id);
  persist();
  syncTeam();
  refreshShelf();
  sfx.squeak(1.1, 0.1, 0.2);
  ui.toast(`${nameOf(save, id)} went to rest`, 1400);
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
/** Seconds into tucking the opening basket away, or -1 when not. */
let basketAway = -1;

function startBox(first: boolean): void {
  const owned = new Set(Object.keys(save.owned));
  const { def } = openBox(owned, new Date(), Math.random, first);
  reveal = { def, first, taps: 0, phase: "closing", t: 0, shake: 0 };
  fingersUp();
  setScreen("box");
  // The opening basket comes out in front; the new one pops up inside it.
  basketAway = -1;
  stage.basket.scale.setScalar(1);
  stage.showBasket(true);
  squishy.placeAt(new THREE.Vector3(0, BASKET_FLOOR - BOTTOM_Y, 0));
  Object.assign(squishy.basket, BASKET_WALL);
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
  const got = collect(save, def.id, Date.now(), randomMood(Math.random));
  const prevActive = save.active;
  // A new one is held right away; the one you held joins the friends.
  if (got.isNew) holdSquishy(save, def.id);
  const hat = first ? null : boxHat(save.hats, isOctober(new Date()), Math.random);
  if (hat) addHat(save, hat);
  persist();
  showHeld(def, def.id);
  squishy.group.visible = true;
  popScale = 0.15;
  squishy.popIn();
  const at = squishy.topPoint();
  if (def.finish === "matte") {
    fx.emit("sparkle", at, 12);
    fx.emit("star", at, 4);
  } else {
    // Special finishes get a soft, slow shimmer instead of a burst.
    fx.emit("glimmer", at, 18);
    fx.emit("sparkle", at, 5);
  }
  fx.emit("heart", at, 6);
  sfx.pop();
  sfx.chime(true);
  setTimeout(async () => {
    await ui.card({ def, name: nameOf(save, def.id), isNew: got.isNew, stars: got.isNew ? undefined : got.stars, mood: moodIdOf(def.id) });
    // A repeat goes to the star jar; you keep holding the one you had.
    if (!got.isNew && prevActive && prevActive !== def.id) {
      const back = defById(prevActive);
      if (back) showHeld(back, prevActive);
    }
    reveal = null;
    pointAtOpen = false;
    syncTeam();
    setScreen("closet");
    // Out of the basket and onto the floor; the basket tucks itself away.
    squishy.basket.r = 0;
    squishy.placeAt(FLOOR_HOME);
    basketAway = 0;
    squishy.hello();
    if (hat) showNewHat(hat);
  }, 1100);
}

// ---- screens ----------------------------------------------------------

function setScreen(s: Screen): void {
  screen = s;
  ui.show(s);
  ui.hand(null);
  crew.paused = s !== "closet";
  visitors.paused = s !== "closet";
  nursery.paused = s !== "closet";
  for (const f of crew.friends) f.sq.group.visible = s === "closet";
  nursery.setVisible(s === "closet");
  visitors.setVisible(s === "closet");
  if (s === "closet") {
    checkGrowUp();
    refreshMeters();
    refreshShelf();
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
    shelfTap: (id) => void shelfTap(id),
    sendIn: restFriend,
    hats: () => ({ wearing: hatOf(save.active), have: save.hats, who: save.active ? nameOf(save, save.active) : "" }),
    wearHat,
    goPlace: (id) => goPlace(id),
    place: () => placeId,
    zoom: () => save.zoom,
    setZoom: (z) => {
      save.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
      persist();
      fit();
    },
    sound: () => save.sound,
    covered: (on) => {
      crew.paused = on || screen !== "closet";
      visitors.paused = crew.paused;
      nursery.paused = crew.paused;
      if (on) fingersUp();
    },
    babyTap: (key) => openBaby(key),
    teach: teachBaby,
    doWish: (key) => void doWish(key),
    renameBaby: (key, name) => {
      const b = save.babies.find((x) => x.key === key);
      if (!b) return;
      const clean = cleanName(name);
      if (clean && clean !== `Baby ${defById(b.kind)?.name}`) b.name = clean;
      else delete b.name;
      persist();
    },
    rename: (id, name) => {
      const o = save.owned[id];
      if (!o) return;
      const clean = cleanName(name);
      if (clean && clean !== defById(id)?.name) o.name = clean;
      else delete o.name;
      persist();
      if (screen === "closet") refreshShelf();
    },
    skipTutorial: () => {
      if (save.tutorial !== "done") finishTutorial();
    },
    moveLink: async () => moveLink(await encodeSave(save), location, document.referrer, window.parent !== window),
    bringIn: async (text) => {
      const code = findCode(text);
      const other = code && (await decodeSave(code));
      if (!other) return null;
      bringIn(other);
      return 0;
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
  fitCamera(camera, w, h, save.zoom);
  const base = camera.userData.base as { pos: THREE.Vector3; target: THREE.Vector3 };
  stage.setViewDistance(base.pos.distanceTo(base.target));
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
  // A tap on the hat pops it; a tap on a friend is for that friend.
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (squishy.isHome && squishy.hatHit(ray)) {
    squishy.popHat();
    return;
  }
  if (!hitSquishy(e.clientX, e.clientY)) {
    ray.setFromCamera(ndc, camera);
    // Babies first: they're small and right in front.
    const n = nursery.hit(ray);
    if (n) {
      if (n.kind === "sleeper") void foundBaby();
      else tapBaby(n.key);
      return;
    }
    const f = crew.hit(ray);
    if (f) {
      const h = ray.intersectObject(f.sq.mesh, false)[0];
      crew.tap(f, h?.point ?? f.sq.topPoint());
      return;
    }
    const v = visitors.hit(ray);
    if (v) {
      visitors.tap(v);
      return;
    }
  }
  canvas.setPointerCapture(e.pointerId);
  const onBody = squishy.isHome && nearSquishy(e.clientX, e.clientY) !== null;
  if (onBody) squishy.yawTarget = 0;
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

/** Watches how long frames take and trades a little sharpness for smoothness. */
const pace = { sum: 0, n: 0, calm: 0 };
function stepPace(ms: number): void {
  if (ms > 250) return; // a pause, not a slow frame
  pace.sum += ms;
  pace.n++;
  if (pace.n < 90) return;
  const avg = pace.sum / pace.n;
  pace.sum = 0;
  pace.n = 0;
  let next = dpr;
  if (avg > 21 && dpr > 1) next = Math.max(1, +(dpr - 0.25).toFixed(2));
  else if (avg < 15 && dpr < MAX_DPR && ++pace.calm >= 4) {
    next = Math.min(MAX_DPR, +(dpr + 0.25).toFixed(2));
    pace.calm = 0;
  }
  if (next !== dpr) {
    dpr = next;
    renderer.setPixelRatio(dpr);
    fit();
  }
}

let growClock = 30;
function stepGrowClock(dt: number): void {
  growClock -= dt;
  if (growClock > 0) return;
  growClock = 30;
  checkGrowUp();
  // Naps end by themselves.
  const now = Date.now();
  for (const b of save.babies) if (b.napUntil && !isNapping(b, now)) {
    b.napUntil = 0;
    nursery.setNapping(b.key, false);
    refreshShelf();
  }
}

let glimmerAt = 0;
let last = performance.now();
let hugHearts = 0;
function frame(): void {
  const t = performance.now();
  stepPace(t - last);
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
  const place = placeScene(placeId);
  place.update(dt, now);
  if (screen === "closet") {
    crew.update(dt, now, bounds);
    visitors.update(dt, now, bounds);
    nursery.update(dt, now, bounds);
    stepBabies(dt);
    stepWants(dt);
    stepGrowClock(dt);
  }
  const sway = place.sway(now);
  swayCamera(camera, sway.roll, sway.bob);
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
  // Glitter and gold squishies give off the odd soft glimmer.
  if (screen === "closet" && squishy.group.visible && (squishy.def.finish === "glitter" || squishy.def.finish === "gold") && now > glimmerAt) {
    glimmerAt = now + 1.2 + Math.random() * 1.6;
    fx.emit("glimmer", squishy.topPoint(), 1);
  }
  fx.update(dt);
  if (basketAway >= 0) {
    basketAway += dt;
    const k = Math.min(1, basketAway / 0.35);
    stage.basket.scale.setScalar(Math.max(0.001, 1 - ease(k)));
    if (k >= 1) {
      basketAway = -1;
      stage.showBasket(false);
      stage.basket.scale.setScalar(1);
    }
  }
  // Soft shadow under the bun, except while it sits in the opening basket.
  const p = squishy.group.position;
  const out = !stage.basket.visible || Math.hypot(p.x, p.z) > 0.3;
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

// Players from before hats came get the party hat too.
if (save.tutorial === "done" && addHat(save, "party")) {
  ui.newHat(true);
  persist();
}
goPlace(save.place, true);
syncTeam();
syncBabies();
setScreen("title");
requestAnimationFrame(frame);

// ---- squishies from another phone ---------------------------------------

/** Adds the other phone's collection to this one, then starts again so every screen shows it. */
function bringIn(other: Save): void {
  const { save: both, added } = combineSaves(save, other);
  storeSave(both);
  keepStorage();
  ui.toast(added ? `${added} new ${added === 1 ? "squishy" : "squishies"}!` : "All here!", 1400);
  window.setTimeout(() => location.replace(location.pathname + location.search), 900);
}

// A move link opened on this phone: the code is in the #fragment, which never reaches a server.
if (location.hash.startsWith(HASH)) {
  const code = findCode(location.hash);
  history.replaceState(null, "", location.pathname + location.search);
  void (async () => {
    const other = code && (await decodeSave(code));
    if (!other) {
      ui.toast("That move link didn't work. Make a new one.", 2400);
      return;
    }
    if (await ui.confirmMove(combineSaves(save, other).added)) bringIn(other);
  })();
}

document.addEventListener("visibilitychange", () => {
  last = performance.now();
});
