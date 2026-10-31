// Aurora's World. Squishy Island is the title. Play opens your first squishy
// from its steamer box, a little tutorial teaches the five ways to play, and
// love you give earns more boxes. Up to four squishies are out at once: the
// one you hold, and friends who play, do jobs and come up to visit behind it.
// Play at the tea table, the beach, on a sailing boat or in the living room,
// dress everyone in hats, and give your squishy a bath. All October the places
// dress up for Halloween; on Halloween itself Spooky Boxes come, jack-o'-lanterns
// a Halloween squishy pops out of. Each day the one you hold would love a snack, a bath, a nap and play (care.ts);
// doing all four brings a small present. Everything stays on this device.

import * as THREE from "three";
import { Gestures, type GestureEvent } from "./gestures";
import { Squishy, type Bounds } from "./squishy";
import { buildStage, BASKET_FLOOR, BASKET_WALL, canvasTex, LID_CLOSED, LID_REST } from "./scene";
import { buildIsland } from "./island";
import { Effects } from "./fx";
import { Ui, type HandMove, type Screen, type ShelfState, type UiHandlers } from "./ui";
import { Thumbs } from "./thumbs";
import { CATALOG, defById, type SquishyDef } from "./catalog";
import { isOctober, openBox, openSpookyBox } from "./boxes";
import { isSpookySeason, sleepsToHalloween, today } from "./season";
import { PUMPKIN_LID_CLOSED, PUMPKIN_LID_OFF } from "./halloween";
import { Bath, BATH_STEPS, type BathStep } from "./bath";
import {
  addCookie,
  addHat,
  addLove,
  babyName,
  bringOut,
  cleanName,
  collect,
  growUp,
  halloweenBox,
  holdSquishy,
  keepBaby,
  loadSave,
  nameOf,
  sendIn,
  spookyFromLove,
  storeSave,
  type Save,
  TEAM_MAX,
  ZOOM_MAX,
  ZOOM_MIN,
} from "./save";
import * as sfx from "./audio";
import { BOTTOM_Y } from "./bao";
import { fitCamera, flyBounds, swayCamera, groundView } from "./view";
import { placeScene } from "./placeScenes";
import { hatsEarned, placeById, type PlaceId } from "./places";
import { boxHat, hatById, spookyHat } from "./hats";
import { Crew } from "./friends";
import { Visitors } from "./visitors";
import { Nursery } from "./nursery";
import { moodById, randomMood, type MoodId } from "./personality";
import { combineSaves, decodeSave, encodeSave, findCode, HASH, keepStorage, moveLink } from "./move";
import { decodeGift, encodeGift, findGift, makeGift, openGift, receiveGift, sentGift, type Gift } from "./gift";
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
import { careGame, doCare, doneToday, leftToday, type CareId } from "./care";
import { clearTestUnlock, FREE_PLACES, fullWhy, hasFull, locksOn, placeOpen, squishyOpen, TEST_BUILD, writeUnlock } from "./unlock";
import { shop, testShop, type BuyResult } from "./payments";
import { watchApple } from "./apple";
import { inApp } from "./native";

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
const island = buildIsland(today());
const fx = new Effects();
stage.scene.add(fx.group);
const thumbs = new Thumbs();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

let screen: Screen = "title";
/** How far the shelf has slid down, 0 to 1, as the slide goes (eased), and where it's heading. */
let trayK = save.trayDown ? 1 : 0;
let trayGoal = trayK;
/** The slide's own clock, 0 to 1, before easing. */
let trayT = trayK;
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
  ui.setCareReady(true);
  refreshSpooky();
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
  refreshCare();
}

function giveLove(n: number): void {
  const earned = addLove(save, n);
  ui.setLove(save.love);
  ui.beat();
  if (earned > 0) {
    // During the tutorial the box is announced when it ends. On Halloween every box earned is a Spooky Box.
    if (save.tutorial === "done") {
      const spooky = spookyFromLove(save, earned, today());
      if (spooky) {
        refreshSpooky();
        ui.toast(spooky === 1 ? "New Spooky Box! 🎃" : `${spooky} new Spooky Boxes! 🎃`);
        sfx.boo();
        fx.emit("bat", squishy.topPoint(), 4);
      } else ui.toast("New Squishy Box!");
      sfx.chime(true);
      fx.emit("sparkle", squishy.topPoint(), 10);
    }
    ui.setBoxes(save.boxes);
  }
  persist();
}

// ---- Halloween --------------------------------------------------------

/** After Halloween's own Spooky Box comes, point at it until it's opened. */
let pointAtSpooky = false;

function refreshSpooky(): void {
  const ready = save.tutorial === "done";
  ui.setSpooky(ready ? save.spookyBoxes : 0, ready ? sleepsToHalloween(today()) : 0);
}

/** On Halloween, once a year, a Spooky Box comes for everyone who has finished learning to play. */
function checkHalloween(): void {
  if (save.tutorial !== "done" || screen !== "closet" || !halloweenBox(save, today())) return;
  persist();
  refreshSpooky();
  pointAtSpooky = true;
  sfx.boo();
  setTimeout(() => sfx.chime(true), 600);
  fx.emit("bat", squishy.topPoint(), 6);
  ui.hint("Happy Halloween!", "A Spooky Box came for you! Tap the pumpkin");
}

function openSpooky(): void {
  sfx.unlockAudio();
  if (screen !== "closet") return;
  if (save.spookyBoxes > 0) {
    if (squishy.isHome && !reveal && !ship && !bath.on) startBox(false, true);
    return;
  }
  const n = sleepsToHalloween(today());
  sfx.boo(1.2);
  ui.toast(n ? `${n} more sleep${n === 1 ? "" : "s"} until Halloween! Spooky Boxes come then 🎃` : "Spooky Boxes come on Halloween! 🎃", 2400);
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

/** The happy sound for each step of a little game (and a chime when it's all done). */
function wishBeat(want: MoodId, pitch: number, done: boolean, n: number): void {
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
    beat: (done, n) => wishBeat(want, pitch, done, n),
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
  const kind = pickBabyKind(new Set(Object.keys(save.owned)), save.babies.map((b) => b.kind), today(), Math.random, canFind);
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
  // A place outside this phone's game (the free game has two) goes to the first free one, Living Room.
  if (!placeOpen(id, hasFull(save.owned))) id = FREE_PLACES[0];
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

// ---- the full game ----------------------------------------------------

/** Squishies a box or a nap can bring on this phone: the free game has no sparkly ones. */
const canFind = (d: SquishyDef): boolean => squishyOpen(d, hasFull(save.owned));

// In the app, once selling has started: a purchase Apple finishes at any time (an approved Ask to Buy, a restore on
// another screen) opens the game.
if (inApp() && locksOn()) {
  watchApple(() => {
    if (fullWhy(save.owned) === null) {
      writeUnlock("apple", Date.now());
      ui.toast("The whole world is open! 🎉", 2200);
    }
  });
}

function fullHandlers(): Pick<UiHandlers, "full" | "shopInfo" | "buyFull" | "restoreFull" | "relock"> {
  const unlocked = (r: BuyResult): BuyResult => {
    if (r.ok) {
      writeUnlock(r.how, Date.now());
      sfx.chime(true);
      fx.emit("sparkle", squishy.topPoint(), 24);
    }
    return r;
  };
  return {
    full: () => {
      const why = fullWhy(save.owned);
      return { has: why !== null, why, locks: locksOn(), test: TEST_BUILD };
    },
    shopInfo: async () => {
      const s = shop();
      const ready = await s.ready();
      return { ready, price: ready ? await s.price() : null };
    },
    buyFull: async (test) => unlocked(await (test && testShop ? testShop : shop()).buy()),
    restoreFull: async () => unlocked(await shop().restore()),
    relock: () => {
      clearTestUnlock();
      goPlace(placeId, true);
    },
  };
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
  /** Squishy mail drifting down (gifts only), closing the lid (or a Spooky Box arriving), waiting for taps, popping open. */
  phase: "falling" | "closing" | "arriving" | "waiting" | "popping" | "done";
  /** Squishy mail from a friend, opened with one tap. */
  gift?: Gift;
  /** A Spooky Box: a jack-o'-lantern instead of the steamer. */
  spooky?: boolean;
  landed?: boolean;
  t: number;
  shake: number;
}
let reveal: Reveal | null = null;
let popScale = 1;
/** Seconds into tucking the opening basket away, or -1 when not. */
let basketAway = -1;

function startBox(first: boolean, spooky = false): void {
  const owned = new Set(Object.keys(save.owned));
  const { def } = spooky ? openSpookyBox(owned, Math.random, canFind) : openBox(owned, today(), Math.random, first, canFind);
  reveal = { def, first, taps: 0, phase: spooky ? "arriving" : "closing", t: 0, shake: 0, spooky };
  fingersUp();
  setScreen("box");
  // The opening basket comes out in front (or the Spooky Box drops in); the new one pops up inside it.
  basketAway = -1;
  if (spooky) {
    pointAtSpooky = false;
    stage.pumpkin.scale.setScalar(1);
    stage.pumpkin.rotation.set(0, 0, 0);
    stage.pumpkinLid.position.copy(PUMPKIN_LID_CLOSED.pos);
    stage.pumpkinLid.rotation.copy(PUMPKIN_LID_CLOSED.rot);
    liftBox(6, stage.pumpkin);
    stage.showPumpkin(true);
    sfx.boo();
  } else {
    stage.basket.scale.setScalar(1);
    stage.showBasket(true);
    sfx.whoosh();
  }
  squishy.placeAt(new THREE.Vector3(0, BASKET_FLOOR - BOTTOM_Y, 0));
  Object.assign(squishy.basket, BASKET_WALL);
  squishy.group.visible = false;
  ui.hint(spooky ? "A Spooky Box!" : first ? "Your first squishy!" : "A new squishy!", spooky ? "Tap the pumpkin 3 times" : "Tap the box 3 times");
}

function tapBox(): void {
  if (!reveal || reveal.phase !== "waiting") return;
  reveal.taps++;
  reveal.shake = 0.6 + reveal.taps * 0.35;
  sfx.squeak(1 + reveal.taps * 0.15, 0.12, 0.3);
  sfx.vibrate(12 * reveal.taps);
  fx.emit("sparkle", new THREE.Vector3(0, 0.7, 0.6), 2 + reveal.taps * 2);
  if (reveal.spooky) {
    fx.emit("smoke", new THREE.Vector3(0, 1.0, 0.5), 2);
    fx.emit("bat", new THREE.Vector3(0, 1.1, 0.6), 1);
  }
  if (reveal.taps >= (reveal.gift ? 1 : 3)) {
    reveal.phase = "popping";
    reveal.t = 0;
    ui.hint(null);
    ui.hand(null);
    setTimeout(popOut, 380);
  }
}

function popOut(): void {
  if (!reveal) return;
  if (reveal.gift) {
    popGift();
    return;
  }
  const { def, first, spooky } = reveal;
  if (spooky) save.spookyBoxes = Math.max(0, save.spookyBoxes - 1);
  else if (!first) save.boxes = Math.max(0, save.boxes - 1);
  const got = collect(save, def.id, Date.now(), randomMood(Math.random));
  const prevActive = save.active;
  // A new one is held right away; the one you held joins the friends.
  if (got.isNew) holdSquishy(save, def.id);
  // A Spooky Box always brings a spooky hat you don't have yet.
  const hat = first ? null : spooky ? spookyHat(save.hats, Math.random) : boxHat(save.hats, isOctober(today()), Math.random);
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
  if (spooky) {
    // Out of the pumpkin in a puff of purple, with bats and candy.
    fx.emit("smoke", at, 8);
    fx.emit("bat", at, 7);
    fx.emit("candy", at, 9);
    sfx.boo(1.1);
    refreshSpooky();
  }
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

// ---- squishy mail -------------------------------------------------------
// Sending: the squishy bounces into its steamer box, the lid closes, and once the link is sent the box floats up
// and away in a trail of sparkles. Your squishy stays with you; your friend gets a twin. Getting one: the box drifts
// down onto the glowing inbox pad, one tap opens it, and the squishy pops out.

/** The glowing spot squishy mail lands on. */
const mailPad = (() => {
  const tex = canvasTex(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.0)");
    g.addColorStop(0.55, "rgba(186,232,255,0.55)");
    g.addColorStop(0.78, "rgba(255,190,225,0.85)");
    g.addColorStop(1, "rgba(255,190,225,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = 128 + Math.cos(a) * 92;
      const y = 128 + Math.sin(a) * 92;
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 ? 3 : 8;
        const b = (k / 8) * Math.PI * 2;
        c.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr);
      }
      c.fill();
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.008;
  m.visible = false;
  stage.scene.add(m);
  return m;
})();
const padMat = mailPad.material as THREE.MeshBasicMaterial;
/** Seconds into fading the pad out, or -1. */
let padAway = -1;
const FALL_FROM = 8.5;
const FALL_SECONDS = 2.6;
let trailAt = 0;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Lifts or drops the opening basket (or the Spooky Box), with its shadow shrinking as it goes up. */
function liftBox(y: number, box: THREE.Object3D): void {
  box.position.y = y;
  const k = 1 / (1 + Math.max(0, y) * 0.45);
  stage.basketShadow.scale.setScalar(k);
  (stage.basketShadow.material as THREE.MeshBasicMaterial).opacity = k;
}
const liftBasket = (y: number) => liftBox(y, stage.basket);

function resetBasket(): void {
  stage.basket.position.set(0, 0, 0);
  stage.basket.rotation.set(0, 0, 0);
  stage.basket.scale.setScalar(1);
  liftBasket(0);
}

/** A sparkle trail behind a flying box. */
function trail(now: number, every = 0.08): void {
  if (now < trailAt) return;
  trailAt = now + every;
  const at = stage.basket.position.clone();
  at.y += 0.1;
  fx.emit("glimmer", at, 1);
  if (Math.random() < 0.3) fx.emit("sparkle", at, 1);
}

/** Puts the one you hold back in front, popping in. */
function bringBackHeld(): void {
  const id = save.active;
  const def = id && defById(id);
  if (def && id) showHeld(def, id);
  squishy.basket.r = 0;
  squishy.placeAt(FLOOR_HOME);
  squishy.group.visible = true;
  squishy.group.scale.setScalar(1);
  popScale = 0.15;
  squishy.popIn();
}

// Getting squishy mail

/** A gift code from a link or paste: into the inbox. Returns what to tell the kid. */
function takeGift(code: string | null, text: string): string {
  const g = code ? decodeGift(code) : null;
  if (!g) return findCode(text) ? "That's a move link. Open it from Settings, Move to a new phone." : "That squishy link didn't work. Ask for a new one.";
  const got = receiveGift(save, g);
  persist();
  ui.setMail(save.inbox.length);
  if (got === "own") return "That's your own squishy mail! Send the link to a friend.";
  if (got === "again") return "You already got this squishy mail!";
  if (got === "full") return "Your inbox is full! Open your squishy mail first.";
  mailClock = 0;
  return screen === "title" ? "Squishy mail is coming! Tap Play" : "Squishy mail is coming!";
}

let mailClock = 0;
/** Mail waits for a calm moment in the closet, after the tutorial. */
function stepMail(dt: number): void {
  if (!save.inbox.length || ui.busy || tutorialStep() || reveal || ship || !squishy.isHome || fingers.size) {
    mailClock = 0;
    return;
  }
  mailClock += dt;
  if (mailClock > 1.4) startMail();
}

function startMail(): void {
  const gift = save.inbox[0];
  const def = gift && defById(gift.id);
  if (!gift || !def || reveal || ship) return;
  mailClock = 0;
  reveal = { def, first: false, taps: 0, phase: "falling", t: 0, shake: 0, gift };
  fingersUp();
  setScreen("box");
  basketAway = -1;
  resetBasket();
  stage.showBasket(true);
  liftBasket(FALL_FROM);
  placeLid(1, 0);
  squishy.placeAt(new THREE.Vector3(0, BASKET_FLOOR - BOTTOM_Y, 0));
  Object.assign(squishy.basket, BASKET_WALL);
  squishy.group.visible = false;
  padAway = -1;
  mailPad.visible = true;
  padMat.opacity = 0;
  ui.hint("Squishy mail!", "A friend sent you a squishy");
  sfx.whoosh();
  setTimeout(() => sfx.chime(false), 500);
}

/** The box floats down, swaying like a leaf, and settles on the pad. */
function stepFalling(r: Reveal, dt: number, now: number): void {
  const k = Math.min(1, r.t / FALL_SECONDS);
  const e = easeOut(k);
  liftBasket(FALL_FROM * (1 - e));
  const calm = 1 - e;
  stage.basket.rotation.set(Math.cos(now * 1.7) * 0.1 * calm, Math.sin(now * 0.9) * 0.6 * calm, Math.sin(now * 2.2) * 0.18 * calm);
  stage.basket.position.x = Math.sin(now * 1.3) * 0.5 * calm;
  placeLid(1, 0);
  padMat.opacity = 0.35 + 0.55 * e + Math.sin(now * 5) * 0.08;
  mailPad.scale.setScalar(0.85 + 0.15 * e);
  trail(now, 0.09 + 0.1 * e);
  if (k >= 1) {
    resetBasket();
    r.phase = "waiting";
    r.shake = 1.2;
    sfx.thud(0.5);
    sfx.vibrate(15);
    fx.emit("sparkle", new THREE.Vector3(0, 0.5, 0.6), 8);
    fx.emit("glimmer", new THREE.Vector3(0, 0.4, 0.4), 10);
    ui.hint("Squishy mail!", "Tap the box to open it");
  }
  void dt;
}

/** The mail box pops open: the squishy jumps out and says hi. */
function popGift(): void {
  if (!reveal) return;
  const opened = openGift(save, Date.now());
  if (!opened) {
    reveal = null;
    setScreen("closet");
    return;
  }
  const { def } = reveal;
  const id = def.id;
  const prevActive = save.active;
  if (opened.isNew) holdSquishy(save, id);
  persist();
  ui.setMail(save.inbox.length);
  if (opened.newHat) ui.newHat(true);
  padAway = 0;
  // Show it as it came, hat and all, even if it's one you had.
  squishy.setDesign(def, opened.isNew ? hatOf(id) : (opened.gift.hat ?? null));
  squishy.mood = moodById(opened.isNew ? moodIdOf(id) : opened.gift.mood);
  squishy.group.visible = true;
  popScale = 0.15;
  squishy.popIn();
  const at = squishy.topPoint();
  fx.emit("glimmer", at, 18);
  fx.emit("sparkle", at, 12);
  fx.emit("heart", at, 8);
  fx.emit("star", at, 3);
  sfx.pop();
  sfx.chime(true);
  setTimeout(async () => {
    await ui.card({
      def,
      name: nameOf(save, id),
      isNew: opened.isNew,
      stars: opened.isNew ? undefined : opened.stars,
      mood: opened.isNew ? moodIdOf(id) : opened.gift.mood,
      arrived: true,
      cameWith: opened.newHat ? hatById(opened.newHat)?.name : undefined,
    });
    if (!opened.isNew && prevActive) {
      const back = defById(prevActive);
      if (back) showHeld(back, prevActive);
    }
    reveal = null;
    syncTeam();
    setScreen("closet");
    squishy.basket.r = 0;
    squishy.placeAt(FLOOR_HOME);
    basketAway = 0;
    squishy.hello();
  }, 1100);
}

// Sending squishy mail

interface Ship {
  id: string;
  name: string;
  link: string;
  /** Jumping into the box, the lid closing, packed while the link is shared, flying away, or unpacking. */
  phase: "jump" | "closing" | "packed" | "lift" | "unpack";
  t: number;
  /** Things done once per phase. */
  did: number;
}
let ship: Ship | null = null;
const BOX_SPOT = new THREE.Vector3(0, BASKET_FLOOR - BOTTOM_Y, 0);

function shareSquishy(id: string): void {
  const def = defById(id);
  if (!def || !save.owned[id] || screen !== "closet" || reveal || ship) return;
  if (tutorialStep()) {
    ui.toast("Finish learning to play first!", 1800);
    return;
  }
  const gift = makeGift(save, id);
  if (!gift) return;
  sentGift(save, gift);
  persist();
  const link = moveLink(encodeGift(gift), location, document.referrer, window.parent !== window);
  ship = { id, name: nameOf(save, id), link, phase: "jump", t: 0, did: 0 };
  fingersUp();
  setScreen("box");
  basketAway = -1;
  // The one being sent comes out in front, wearing its hat.
  if (id !== save.active || !squishy.isHome) {
    squishy.setDesign(def, hatOf(id));
    squishy.mood = moodById(moodIdOf(id));
  }
  squishy.basket.r = 0;
  squishy.placeAt(FLOOR_HOME);
  squishy.group.visible = true;
  squishy.group.scale.setScalar(1);
  popScale = 1;
  resetBasket();
  stage.basket.scale.setScalar(0.001);
  stage.showBasket(true);
  placeLid(0, 0);
  ui.hint(`Off you go, ${ship.name}!`, "Into the box!");
  squishy.wiggle();
}

function stepShip(dt: number, now: number): void {
  const s = ship;
  if (!s) return;
  s.t += dt;
  if (s.phase === "jump") {
    // The box pops up, the squishy bounces high and lands inside it.
    const grow = Math.min(1, Math.max(0, (s.t - 0.35) / 0.35));
    stage.basket.scale.setScalar(Math.max(0.001, grow + Math.sin(grow * Math.PI) * 0.15));
    if (s.did === 0 && s.t > 0.45) {
      s.did = 1;
      squishy.bounce(6);
      sfx.boing(squishy.pitch);
      sfx.whoosh();
    }
    if (s.did === 1 && s.t > 0.6) {
      s.did = 2;
      squishy.placeAt(BOX_SPOT);
      Object.assign(squishy.basket, BASKET_WALL);
    }
    if (s.t > 1.55) {
      s.phase = "closing";
      s.t = 0;
      s.did = 0;
      sfx.thud(0.4);
      fx.emit("sparkle", squishy.topPoint(), 6);
    }
  } else if (s.phase === "closing") {
    // It snuggles down as the lid comes over.
    const k = Math.min(1, s.t / 0.7);
    placeLid(ease(k), 0.9);
    const duck = Math.min(1, Math.max(0, (k - 0.15) / 0.6));
    squishy.group.scale.set(1 - duck * 0.35, 1 - duck * 0.7, 1 - duck * 0.35);
    if (duck >= 1) squishy.group.visible = false;
    if (k >= 1) {
      s.phase = "packed";
      s.t = 0;
      sfx.thud(0.6);
      fx.emit("glimmer", new THREE.Vector3(0, 0.6, 0.4), 12);
      fx.emit("heart", new THREE.Vector3(0, 0.8, 0.4), 3);
      ui.hint(null);
      void ui.shareSheet(s.name, s.link).then((sent) => {
        if (ship !== s) return;
        s.phase = sent ? "lift" : "unpack";
        s.t = 0;
        s.did = 0;
      });
    }
  } else if (s.phase === "packed") {
    // Waiting for the link to go: a happy little wobble.
    placeLid(1, 0);
    stage.basket.rotation.z = Math.sin(now * 3) * 0.04;
  } else if (s.phase === "lift") {
    if (s.did === 0) {
      s.did = 1;
      sfx.whoosh();
      sfx.chime(true);
      fx.emit("sparkle", new THREE.Vector3(0, 0.3, 0.5), 10);
    }
    // A little crouch, then up and away, swaying and turning, smaller and smaller.
    const crouch = Math.min(1, s.t / 0.3);
    const k = Math.max(0, (s.t - 0.3) / 2.4);
    if (k === 0) stage.basket.scale.set(1 + 0.08 * Math.sin(crouch * Math.PI), 1 - 0.12 * Math.sin(crouch * Math.PI), 1 + 0.08 * Math.sin(crouch * Math.PI));
    else {
      const e = Math.pow(Math.min(1, k), 1.5);
      liftBasket(e * 9);
      stage.basket.position.x = Math.sin(k * Math.PI * 1.6) * 0.6;
      stage.basket.rotation.set(Math.sin(now * 2) * 0.08, k * 2.4, Math.sin(now * 2.6) * 0.16);
      stage.basket.scale.setScalar(1 - 0.45 * Math.min(1, k));
      trail(now, 0.08);
    }
    placeLid(1, 0);
    if (k >= 1) {
      ship = null;
      stage.showBasket(false);
      resetBasket();
      placeLid(0, 0);
      bringBackHeld();
      setScreen("closet");
      ui.toast(`On its way! ${s.name} stays with you too.`, 2400);
    }
  } else if (s.phase === "unpack") {
    // Not now: the lid pops off and it hops back out.
    const k = Math.min(1, s.t / 0.75);
    placeLid(1 - ease(k), 2.2, Math.sin(k * Math.PI) * 1.2);
    if (s.did === 0) {
      s.did = 1;
      squishy.group.visible = true;
      squishy.group.scale.setScalar(1);
      squishy.popIn();
      fx.emit("sparkle", squishy.topPoint(), 6);
    }
    if (k >= 1) {
      ship = null;
      const held = save.active;
      squishy.basket.r = 0;
      squishy.placeAt(FLOOR_HOME);
      basketAway = 0;
      setScreen("closet");
      // If it wasn't the one you hold, that one comes back.
      if (held && held !== s.id) setTimeout(() => !ship && !reveal && bringBackHeld(), 450);
      else squishy.hello();
    }
  }
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
    refreshSpooky();
    ui.setCareReady(save.tutorial === "done");
    introCare();
    if (tutorialStep()) showTutorial();
    else if (pointAtOpen && save.boxes > 0) ui.hint("You earned a box!", "Tap Open to see who's inside");
    else if (pointAtSpooky && save.spookyBoxes > 0) ui.hint("Happy Halloween!", "Tap the pumpkin to open your Spooky Box");
    else ui.hint(null);
    checkHalloween();
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
    ...fullHandlers(),
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
    share: (id) => shareSquishy(id),
    mail: () => save.inbox.length,
    openMail: () => {
      if (screen === "closet" && save.inbox.length) startMail();
    },
    receive: (text) => takeGift(findGift(text), text),
    careInfo: () =>
      save.active ? { who: nameOf(save, save.active), done: doneToday(save.care, today()), days: save.care.days } : null,
    care: (id) => void careFor(id),
    closeBath: () => endBath(false),
    openSpooky,
    tray: (down) => {
      save.trayDown = down;
      persist();
      trayGoal = down ? 1 : 0;
      ui.hand(null);
    },
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
ui.halloween(isSpookySeason(today()));
ui.setTray(save.trayDown, false);

// ---- bath time ----------------------------------------------------------

const BATH_WORDS: Record<BathStep, [string, string]> = {
  fill: ["Fill the tub!", "Tap the tap to turn on the water"],
  scrub: ["Scrub-a-dub!", "Rub {n} to wash off the mud"],
  rinse: ["Rinse the bubbles", "Hold and drag the shower over {n}"],
  dry: ["Dry off!", "Rub {n} with the fluffy towel"],
};

const bath = new Bath(
  stage.scene,
  squishy,
  camera,
  {
    fx: (kind, at, count) => fx.emit(kind, at, count),
    step: (st, i) => {
      const who = save.active ? nameOf(save, save.active) : "your squishy";
      const [title, how] = BATH_WORDS[st];
      ui.bathStep(i, title, how.replace("{n}", who));
    },
    progress: (k) => ui.bathProgress(k),
    hint: (move, at) => {
      if (!move || !at || ui.busy) ui.hand(null);
      else {
        const p = toScreen(at);
        ui.hand(move, p.x, p.y);
      }
    },
    clean: () => {
      ui.bathStep(BATH_STEPS.length, "Squeaky clean!", "✨ All done! ✨");
      ui.bathProgress(1);
    },
    done: () => endBath(true),
  },
  isSpookySeason(today()),
);
/** After a bath the one you hold sparkles for a while. */
let freshUntil = 0;

function startBath(): void {
  sfx.unlockAudio();
  if (screen !== "closet" || reveal || ship || bath.on || !squishy.isHome || !save.active) return;
  if (tutorialStep()) {
    ui.toast("Finish learning to play first!", 1800);
    return;
  }
  fingersUp();
  squishy.wakeUp();
  setScreen("bath");
  ui.bathStep(-1, "Bath time!", `In you hop, ${nameOf(save, save.active)}!`);
  bath.start();
}

/** Out of the bath and back on the floor; a whole bath earns love (and the first one, a shower cap). */
function endBath(clean: boolean): void {
  if (screen !== "bath") return;
  bath.stop();
  squishy.basket.r = 0;
  squishy.placeAt(FLOOR_HOME);
  squishy.hello();
  setScreen("closet");
  if (!clean) return;
  save.baths++;
  giveLove(20);
  freshUntil = performance.now() / 1000 + 40;
  ui.toast(`${save.active ? nameOf(save, save.active) : "Your squishy"} is squeaky clean! ✨`, 2200);
  if (addHat(save, "showerCap")) {
    persist();
    showNewHat("showerCap");
  }
  cared("bath");
}

// ---- daily care -----------------------------------------------------------

/** What each care says when it's done. */
const CARE_YAY: Record<Exclude<CareId, "bath">, string> = {
  feed: "is all full! Yum!",
  nap: "had a cozy nap!",
  play: "had so much fun!",
};

function refreshCare(): void {
  ui.setCare(leftToday(save.care, today()));
}

/** Once, after learning to play: point out the Care button (and that the bath lives there now). */
function introCare(): void {
  if (save.tutorial !== "done" || pointAtOpen || pointAtSpooky || !save.active || save.seen.includes("care")) return;
  save.seen.push("care");
  persist();
  setTimeout(() => {
    if (screen === "closet" && !ui.busy) ui.toast("New! Tap Care for a snack, a bath, a nap and play 💗", 3200);
  }, 1200);
}

/** A snack, a nap or play with the one you hold: a little game together. The bath has its own screen. */
async function careFor(id: CareId): Promise<void> {
  sfx.unlockAudio();
  if (id === "bath") return startBath();
  if (screen !== "closet" || reveal || ship || bath.on || !save.active) return;
  if (tutorialStep()) {
    ui.toast("Finish learning to play first!", 1800);
    return;
  }
  const who = save.active;
  const def = defById(who);
  const mood = moodIdOf(who);
  const wish = careGame(id, mood);
  if (!def || !wish) return;
  // The sounds follow the game: munching, a lullaby, or the squishy's own kind of play.
  const sound: MoodId = id === "feed" ? "sweet" : id === "nap" ? "sleepy" : wish === wishFor(mood) ? mood : "sporty";
  const pitch = def.pitch;
  sfx.pop();
  const did = await ui.wish({ def, name: nameOf(save, who), want: mood, wish, beat: (done, n) => wishBeat(sound, pitch, done, n) });
  if (!did || screen !== "closet") return;
  squishy.hello();
  fx.emit("heart", squishy.topPoint(), 8);
  ui.toast(`${nameOf(save, who)} ${CARE_YAY[id]}`, 2000);
  cared(id);
}

/** One of the day's care things is done: love, and the present when it's the last of the four. */
function cared(id: CareId): void {
  const cookies = save.cookies;
  const stars = save.stars;
  const res = doCare(save, id, today());
  persist();
  refreshCare();
  if (res.love) giveLove(res.love);
  if (!res.present) return;
  const show = async () => {
    // Wait for any card or game still open (like a new hat) to close first.
    while (ui.busy) await new Promise((r) => setTimeout(r, 400));
    sfx.chime(true);
    fx.emit("sparkle", squishy.topPoint(), 12);
    await ui.presentCard(save.active ? nameOf(save, save.active) : "your squishy", save.cookies - cookies, save.stars - stars);
    ui.setCookies(save.cookies, true);
    ui.setStars(save.stars);
  };
  setTimeout(() => void show(), 900);
}

// ---- fitting the view -------------------------------------------------

const bounds: Bounds = { minX: -3, maxX: 3, maxY: 6, floorY: 0 };
const BATH_ZOOM = 1.3;
let worldPerPx = 0.01;

/** Points the camera for the screen size, the zoom and how far the shelf has slid down. */
function frameCamera(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Bath time comes in closer, so there's more squishy to scrub; it keeps its own framing whatever the shelf does.
  fitCamera(camera, w, h, save.zoom * (screen === "bath" ? BATH_ZOOM : 1), screen === "bath" ? 0 : trayK);
  const base = camera.userData.base as { pos: THREE.Vector3; target: THREE.Vector3 };
  stage.setViewDistance(base.pos.distanceTo(base.target));
  worldPerPx = flyBounds(camera, h, bounds);
}

function fit(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  frameCamera();
  island.fit(w, h);
  // On its side there's room to roam; turned back upright, anyone off the edge hops back into view.
  if (screen !== "bath") crew.reframe(groundView(camera));
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
  if (screen === "bath") {
    if (ui.busy) return;
    canvas.setPointerCapture(e.pointerId);
    bath.down(e.pointerId, e.clientX, e.clientY);
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
    // Halloween decorations play back: ghosts say boo, jack-o'-lanterns hop.
    const pk = placeScene(placeId).poke?.(ray);
    if (pk) {
      if (pk.boo) sfx.boo(0.9 + Math.random() * 0.4);
      else {
        sfx.boing(1.1);
        fx.emit("candy", pk.at, 3);
      }
      fx.emit(pk.boo ? "smoke" : "sparkle", pk.at, 4);
      giveLove(1);
      ui.toast(pk.say, 1300);
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
  if (screen === "bath") {
    bath.move(e.pointerId, e.clientX, e.clientY);
    return;
  }
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
  bath.up(e.pointerId);
  fingerEnd(e.pointerId);
  gestures.up(e.pointerId, e.clientX, e.clientY, nowMs());
});
canvas.addEventListener("pointercancel", (e) => {
  bath.up(e.pointerId);
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

const qPumpkinShut = new THREE.Quaternion().setFromEuler(PUMPKIN_LID_CLOSED.rot);
const qPumpkinOff = new THREE.Quaternion().setFromEuler(PUMPKIN_LID_OFF.rot);

/** The Spooky Box drops in with a bounce, shivers and glows brighter with each tap, then its top pops off. */
function stepSpooky(r: Reveal, dt: number, now: number): void {
  const box = stage.pumpkin;
  const lid = stage.pumpkinLid;
  const flicker = 0.12 * Math.sin(now * 9) + 0.08 * Math.sin(now * 23);
  if (r.phase === "arriving") {
    const k = Math.min(1, r.t / 0.9);
    const y = k < 0.7 ? 6 * (1 - Math.pow(k / 0.7, 2)) : Math.sin(((k - 0.7) / 0.3) * Math.PI) * 0.35;
    liftBox(y, box);
    box.rotation.y = (1 - k) * 2.2;
    stage.glowPumpkin(0.5 + flicker);
    if (!r.landed && k >= 0.7) {
      r.landed = true;
      sfx.thud(0.9);
      sfx.vibrate(18);
      fx.emit("smoke", new THREE.Vector3(0, 0.3, 0.8), 6);
      fx.emit("bat", new THREE.Vector3(0, 1.0, 0.6), 3);
    }
    if (k >= 1) {
      liftBox(0, box);
      box.rotation.y = 0;
      r.phase = "waiting";
      r.shake = 1;
    }
    return;
  }
  if (r.phase === "waiting" || (r.phase === "popping" && r.t < 0.38)) {
    r.shake = Math.max(0, r.shake - dt * 1.6);
    const s = r.shake;
    lid.position.copy(PUMPKIN_LID_CLOSED.pos);
    lid.position.y += Math.abs(Math.sin(now * 19)) * 0.1 * s;
    lid.rotation.set(Math.cos(now * 31) * 0.05 * s, 0, Math.sin(now * 38) * 0.08 * s);
    const w = Math.sin(now * 30);
    box.scale.set(1 + 0.04 * s * w, 1 - 0.05 * s * Math.abs(w), 1 + 0.04 * s * w);
    stage.glowPumpkin(Math.min(1, 0.55 + flicker + r.taps * 0.12 + s * 0.25));
    if (r.phase === "waiting") {
      const p = toScreen(new THREE.Vector3(0.35, 0.9, 1.2));
      ui.hand("tap", p.x, p.y);
    }
  } else if (r.phase === "popping") {
    // The top flies off with a spin and lands beside the pumpkin.
    const k = Math.min(1, (r.t - 0.38) / 0.8);
    const e = ease(k);
    lid.position.lerpVectors(PUMPKIN_LID_CLOSED.pos, PUMPKIN_LID_OFF.pos, e);
    lid.position.y += Math.sin(k * Math.PI) * 2.4;
    lid.quaternion.slerpQuaternions(qPumpkinShut, qPumpkinOff, e);
    lid.rotateY(Math.sin(k * Math.PI) * 2);
    box.scale.setScalar(1);
    stage.glowPumpkin(1);
    if (k >= 1) r.phase = "done";
  } else stage.glowPumpkin(0.8 + flicker);
}

function stepReveal(dt: number, now: number): void {
  const r = reveal;
  if (!r) return;
  r.t += dt;
  const lid = stage.lid;
  if (r.spooky) {
    stepSpooky(r, dt, now);
    return;
  }
  if (r.phase === "falling") {
    stepFalling(r, dt, now);
    return;
  }
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
    // With the shelf slid down, show the tab that brings the Open button back.
    const btn = ui.trayDown ? ui.trayTab.querySelector(".pill") : document.querySelector(".ui .nav .open .ico");
    if (btn) {
      const b = btn.getBoundingClientRect();
      ui.hand("tap", b.left + b.width * 0.55, b.top + b.height * 0.45);
    }
  } else if (!step && pointAtSpooky && save.spookyBoxes > 0) {
    const btn = document.querySelector(".ui .spooky-btn .ico");
    if (btn) {
      const b = btn.getBoundingClientRect();
      ui.hand("tap", b.left + b.width * 0.55, b.top + b.height * 0.45);
    }
  } else ui.hand(null);
}

const TRAY_SLIDE = 0.38;
const slideStill = window.matchMedia?.("(prefers-reduced-motion: reduce)");
/** The world grows into the room the shelf leaves (and gives it back) along with the slide. */
function stepTray(dt: number): void {
  if (trayT === trayGoal) return;
  const step = slideStill?.matches ? 1 : dt / TRAY_SLIDE;
  trayT = trayGoal > trayT ? Math.min(trayGoal, trayT + step) : Math.max(trayGoal, trayT - step);
  trayK = ease(trayT);
  if (trayT === trayGoal) fit();
  else frameCamera();
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
  // Halloween might have come while playing (and the sleeps until it go down).
  if (screen === "closet") {
    refreshSpooky();
    checkHalloween();
  }
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
  stepShip(dt, now);
  bath.update(dt, now);
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
    stepMail(dt);
  }
  stepTray(dt);
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
  // Glitter and gold squishies give off the odd soft glimmer, and so does one fresh from the bath.
  if (screen === "closet" && squishy.group.visible && (squishy.def.finish === "glitter" || squishy.def.finish === "gold" || now < freshUntil) && now > glimmerAt) {
    glimmerAt = now + 1.2 + Math.random() * 1.6;
    fx.emit("glimmer", squishy.topPoint(), 1);
  }
  fx.update(dt);
  if (basketAway >= 0) {
    basketAway += dt;
    const k = Math.min(1, basketAway / 0.35);
    const box = stage.pumpkin.visible ? stage.pumpkin : stage.basket;
    box.scale.setScalar(Math.max(0.001, 1 - ease(k)));
    if (k >= 1) {
      basketAway = -1;
      stage.showBasket(false);
      stage.showPumpkin(false);
      stage.basket.scale.setScalar(1);
      stage.pumpkin.scale.setScalar(1);
    }
  }
  if (padAway >= 0) {
    padAway += dt;
    padMat.opacity = Math.max(0, 0.9 - padAway * 0.9);
    if (padMat.opacity <= 0) {
      padAway = -1;
      mailPad.visible = false;
    }
  }
  // Soft shadow under the bun, except while it sits in the opening basket.
  const p = squishy.group.position;
  const out = !(stage.basket.visible || stage.pumpkin.visible || bath.on) || Math.hypot(p.x, p.z) > 0.3;
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
ui.setMail(save.inbox.length);
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
// Squishy mail from a friend comes in the same spot.
if (location.hash.startsWith(HASH) && findGift(location.hash)) {
  const code = findGift(location.hash);
  history.replaceState(null, "", location.pathname + location.search);
  ui.toast(takeGift(code, location.hash), 2600);
} else if (location.hash.startsWith(HASH)) {
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
  // Back the next day: four fresh care things.
  if (!document.hidden && screen === "closet") refreshCare();
});
