// Squishy Island, the title screen: a round pastel island in a calm sea, the
// squishy case in the middle (the very steamer new squishies come in) and eight
// places around it where squishies live. When the island comes up the case's
// lid pops and your own squishies jump out one by one, then hop about, in their
// hats, while the camera drifts slowly round; before you have any, little plain
// buns jump out and hop there instead. Spooky
// Hollow lights up in October, and the whole island dresses up for Halloween. The rest of fall it glows golden
// for cozy autumn.

import * as THREE from "three";
import { dressIsland, tinyWitchHat } from "./halloween";
import { dressIslandAutumn } from "./autumn";
import { dressFor } from "./season";
import { defById } from "./catalog";
import { Squishy } from "./squishy";
import { BOTTOM_Y } from "./bao";
import { steamerCase } from "./scene";

export interface Island {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fit(w: number, h: number): void;
  update(dt: number, t: number): void;
  /** Who hops about: your squishies, in order, with their hats. None brings back the plain buns. */
  setSquishies(cast: readonly IslandSquishy[]): void;
  /** Closes everyone back in the case, to jump out again one by one. */
  intro(): void;
}

export interface IslandSquishy {
  id: string;
  hat: string | null;
}

/** How many squishies hop about the island at most. */
export const ISLAND_MAX = 10;

/**
 * The jump out of the case, in seconds from when the island comes up: the lid pops open, then the squishies leap
 * out one at a time, each jump taking `jump`; once the last is out the lid flops shut.
 */
export const INTRO = { lidAt: 0.55, firstAt: 0.95, jump: 0.85, open: -1.2 } as const;

/** Time between one squishy jumping out and the next: quicker when there are lots, so nobody waits long. */
export const introGap = (n: number): number => Math.min(0.6, 4.2 / Math.max(1, n));

/** How far the `i`th of `n` is through its jump out: below 0 it's still in the case, from 1 it's out hopping. */
export function jumpProgress(i: number, n: number, t: number): number {
  return (t - (INTRO.firstAt + i * introGap(n))) / INTRO.jump;
}

/** When the lid starts to close: once the last one is well on its way. */
const lidShutAt = (n: number) => INTRO.firstAt + Math.max(0, n - 1) * introGap(n) + INTRO.jump * 0.55;

/**
 * How far the case's lid is open (radians about its back hinge, 0 shut, negative open): it pops up, gives a little
 * kick each time someone jumps out, and flops shut with a bounce after the last.
 */
export function lidAngle(n: number, t: number): number {
  if (n <= 0 || t <= INTRO.lidAt) return 0;
  const shut = lidShutAt(n);
  if (t < shut) {
    // Pops up with a little overshoot.
    const k = Math.min(1, (t - INTRO.lidAt) / 0.3);
    let a = INTRO.open * (k < 1 ? Math.sin((k * Math.PI) / 2) * (1 + 0.15 * Math.sin(k * Math.PI)) : 1);
    for (let i = 0; i < n; i++) {
      const s = (t - (INTRO.firstAt + i * introGap(n))) / 0.3;
      if (s >= 0 && s < 1) a -= 0.2 * Math.sin(s * Math.PI);
    }
    return a;
  }
  const k = (t - shut) / 0.3;
  if (k < 1) return INTRO.open * (1 - k * k);
  // A clack and a small bounce once it's down.
  const b = (k - 1) / 0.85;
  return b < 1 ? -0.14 * Math.abs(Math.sin(b * Math.PI * 2)) * (1 - b) : 0;
}

/**
 * Who is on the island: the one you hold and the friends out with it first, then
 * the newest of the rest, up to ISLAND_MAX.
 */
export function islandCast(
  owned: Readonly<Record<string, { got: number; hat?: string }>>,
  active: string | null,
  team: readonly string[],
  max = ISLAND_MAX,
): IslandSquishy[] {
  const out = [active, ...team].filter((id): id is string => !!id && !!owned[id]);
  const rest = Object.keys(owned)
    .filter((id) => !out.includes(id))
    .sort((a, b) => owned[b].got - owned[a].got);
  return [...new Set([...out, ...rest])].slice(0, max).map((id) => ({ id, hat: owned[id].hat ?? null }));
}

/** The eight places, starting at the front and going round. */
export const PLACES = [
  "Steamer Bay",
  "Spooky Hollow",
  "Candy Cove",
  "Mochi Meadow",
  "Sparkle Peak",
  "Cloud Puff Hills",
  "Sweet Shore",
  "Starlight Pier",
] as const;

const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts });

function sky(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 512;
  const c = cv.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#a9dcff");
  g.addColorStop(0.55, "#ffd3ea");
  g.addColorStop(1, "#ffe9d6");
  c.fillStyle = g;
  c.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const sphere = (r: number, color: string, opts?: Partial<THREE.MeshStandardMaterialParameters>) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color, opts));

function steamer(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = mat("#e3b27a", { roughness: 0.75 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.7, 0.4, 32), wood);
  base.position.y = 0.2;
  const bun = sphere(0.55, "#f2a9cf", { roughness: 0.45 });
  bun.scale.set(1, 0.75, 1);
  bun.position.y = 0.55;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.25, 32), wood);
  lid.position.set(-0.6, 0.55, -0.6);
  lid.rotation.set(-1.1, 0, 0.3);
  g.add(base, bun, lid);
  return g;
}

function spooky(october: boolean): { obj: THREE.Object3D; glow: THREE.MeshStandardMaterial[] } {
  const g = new THREE.Group();
  const glow: THREE.MeshStandardMaterial[] = [];
  const mound = sphere(1.1, "#b9a3e3");
  mound.scale.set(1, 0.3, 1);
  g.add(mound);
  for (const [x, z, s] of [[0.15, 0.35, 1], [-0.55, -0.1, 0.7], [0.6, -0.3, 0.6]] as const) {
    const m = mat("#ff9a3c", { roughness: 0.45, emissive: new THREE.Color("#ff8a1f"), emissiveIntensity: october ? 0.55 : 0 });
    glow.push(m);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 24, 16), m);
    p.scale.set(1.15, 0.8, 1.15);
    p.position.set(x, 0.3 * s + 0.2, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.18 * s, 8), mat("#6f8a3a"));
    stem.position.set(x, 0.62 * s + 0.2, z);
    g.add(p, stem);
  }
  // A curly little tree with round purple puffs.
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.1, 8), mat("#6b4f7a"));
  trunk.position.set(-0.3, 0.75, -0.55);
  trunk.rotation.z = 0.2;
  g.add(trunk);
  for (const [x, y, z, r] of [[-0.45, 1.35, -0.55, 0.32], [-0.1, 1.25, -0.5, 0.26], [-0.6, 1.1, -0.4, 0.22]] as const) {
    const puff = sphere(r, "#8a6ac8");
    puff.position.set(x, y, z);
    g.add(puff);
  }
  if (october) {
    const light = new THREE.PointLight("#c58cff", 6, 5);
    light.position.set(0, 1.4, 0.4);
    g.add(light);
  }
  return { obj: g, glow };
}

function lollipops(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = ["#ff7fb0", "#7fd6ff", "#ffd36b"];
  colors.forEach((c, i) => {
    const a = (i / 3) * Math.PI * 2;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat("#ffffff"));
    stick.position.set(Math.cos(a) * 0.45, 0.5 + i * 0.1, Math.sin(a) * 0.45);
    const candy = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 32), mat(c, { roughness: 0.3 }));
    candy.rotation.x = Math.PI / 2;
    candy.position.set(stick.position.x, 1.05 + i * 0.1, stick.position.z);
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 24), mat("#ffffff", { roughness: 0.3 }));
    swirl.position.copy(candy.position);
    swirl.position.z += 0.055;
    g.add(stick, candy, swirl);
  });
  return g;
}

function flowers(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = ["#ffffff", "#ffb3d1", "#fff27a", "#d4b8ff"];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.25 + (i % 3) * 0.3;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), mat("#6cbf4a"));
    stem.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
    const head = sphere(0.12, colors[i % colors.length]);
    head.scale.y = 0.6;
    head.position.set(stem.position.x, 0.36, stem.position.z);
    const mid = sphere(0.05, "#ffc94d");
    mid.position.set(stem.position.x, 0.42, stem.position.z);
    g.add(stem, head, mid);
  }
  return g;
}

function crystals(): THREE.Object3D {
  const g = new THREE.Group();
  for (const [x, z, h, c] of [[0, 0, 1.6, "#cbb5ff"], [0.45, 0.25, 1.0, "#a8e6ff"], [-0.4, 0.3, 1.15, "#ffc2e2"], [0.1, -0.45, 0.9, "#d8ccff"]] as const) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, h, 5), mat(c, { roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(c), emissiveIntensity: 0.15 }));
    m.position.set(x, h / 2, z);
    g.add(m);
  }
  return g;
}

function clouds(): THREE.Object3D {
  const g = new THREE.Group();
  for (const [x, y, z] of [[0, 1.4, 0], [0.7, 1.9, -0.3]] as const) {
    const c = new THREE.Group();
    for (const [dx, dy, r] of [[0, 0, 0.42], [0.38, -0.05, 0.32], [-0.38, -0.05, 0.32], [0.15, 0.2, 0.3]] as const) {
      const s = sphere(r, "#ffffff", { roughness: 0.9 });
      s.position.set(dx, dy, 0);
      c.add(s);
    }
    c.position.set(x, y, z);
    g.add(c);
  }
  const hill = sphere(0.9, "#d9f2c4");
  hill.scale.y = 0.45;
  g.add(hill);
  return g;
}

function iceCream(): THREE.Object3D {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 20), mat("#e9b46a", { roughness: 0.8 }));
  cone.rotation.x = Math.PI;
  cone.position.y = 0.45;
  const scoop = sphere(0.36, "#ffb3d1", { roughness: 0.4 });
  scoop.position.y = 1.0;
  const scoop2 = sphere(0.3, "#bfefff", { roughness: 0.4 });
  scoop2.position.y = 1.4;
  const cherry = sphere(0.09, "#ff4f6d", { roughness: 0.3 });
  cherry.position.y = 1.72;
  g.add(cone, scoop, scoop2, cherry);
  return g;
}

function pier(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = mat("#d9a265", { roughness: 0.8 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.6), wood);
  deck.position.set(0, 0.25, 0.4);
  g.add(deck);
  for (const [x, z] of [[-0.3, 1.1], [0.3, 1.1], [-0.3, -0.2], [0.3, -0.2]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), wood);
    post.position.set(x, 0.1, z);
    g.add(post);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), mat("#ffffff"));
  pole.position.set(0, 0.95, -0.2);
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.14 : 0.32;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }),
    mat("#ffd84d", { roughness: 0.3, emissive: new THREE.Color("#ffd84d"), emissiveIntensity: 0.3 }),
  );
  star.position.set(0, 1.75, -0.24);
  star.name = "star";
  g.add(pole, star);
  return g;
}

/** The case sits in the middle a little bigger than the steamer new squishies come in. */
const CASE_SCALE = 1.05;
const CASE_Y = 1.12;
/** How high the squishies leap on their way out of the case. */
const JUMP_ARC = 1.9;

/** Squishies on the island, a little bigger than the plain buns so you can tell who is who. */
const SQUISHY_SIZE = 0.4;

interface MiniBun {
  obj: THREE.Object3D;
  /** Its size standing still; hops squash and stretch from this. */
  size: number;
  center: THREE.Vector2;
  radius: number;
  speed: number;
  phase: number;
}

function miniBun(color: string, hat = false): THREE.Object3D {
  const g = new THREE.Group();
  if (hat) {
    const h = tinyWitchHat(0.32);
    h.position.y = 0.38;
    g.add(h);
  }
  const b = sphere(0.26, color, { roughness: 0.45 });
  b.scale.set(1, 0.78, 1);
  b.position.y = 0.2;
  g.add(b);
  for (const s of [-1, 1]) {
    const eye = sphere(0.035, "#2a1a24", { roughness: 0.3 });
    eye.position.set(s * 0.09, 0.22, 0.24);
    g.add(eye);
  }
  return g;
}

export function buildIsland(date = new Date()): Island {
  const october = date.getMonth() === 9;
  const autumn = dressFor(date) === "autumn";
  const scene = new THREE.Scene();
  scene.background = sky();
  scene.fog = new THREE.Fog("#ffd9ea", 30, 70);
  // At Halloween: a dusky evening, with a low warm sun and a purple sea.
  // In autumn: a golden afternoon, with warm sunlight and grass going gold.
  scene.add(
    october
      ? new THREE.HemisphereLight("#e2d4ff", "#ffb88a", 1.35)
      : autumn
        ? new THREE.HemisphereLight("#fff0dc", "#ffc890", 1.45)
        : new THREE.HemisphereLight("#ffffff", "#bfe6ff", 1.5),
  );
  const sun = new THREE.DirectionalLight(october ? "#ffd9b8" : autumn ? "#ffe6c0" : "#fff6e8", october ? 1.9 : autumn ? 2.1 : 2.2);
  sun.position.set(-6, 12, 8);
  scene.add(sun);

  const sea = new THREE.Mesh(new THREE.CircleGeometry(60, 64), mat(october ? "#7f86d8" : autumn ? "#9fd6e0" : "#8fd8f0", { roughness: 0.35 }));
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);
  const foams: THREE.Mesh[] = [];
  for (const r of [7.1, 8.0]) {
    const foam = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 96), mat("#ffffff", { roughness: 0.8 }));
    foam.rotation.x = Math.PI / 2;
    foam.position.y = 0.04;
    scene.add(foam);
    foams.push(foam);
  }

  const sand = sphere(6.6, "#ffe2b0", { roughness: 0.9 });
  sand.scale.set(1, 0.14, 1);
  const grass = sphere(5.9, autumn ? "#d6dc8c" : "#bfeaa0", { roughness: 0.85 });
  grass.scale.set(1, 0.16, 1);
  grass.position.y = 0.22;
  scene.add(sand, grass);
  const top = 0.95; // height of the grass near the places

  const box = steamerCase();
  box.obj.scale.setScalar(CASE_SCALE);
  box.obj.position.y = CASE_Y;
  scene.add(box.obj);
  // Where everyone waits inside, and leaps from.
  const inside = new THREE.Vector3(0, CASE_Y + box.floor * CASE_SCALE, 0);

  const sp = spooky(october);
  const builders = [steamer, () => sp.obj, lollipops, flowers, crystals, clouds, iceCream, pier];
  let star: THREE.Object3D | undefined;
  builders.forEach((make, k) => {
    const o = make();
    const a = (k / builders.length) * Math.PI * 2;
    o.position.set(Math.sin(a) * 3.9, top - (k === 7 ? 0.35 : 0), Math.cos(a) * 3.9);
    o.rotation.y = a;
    scene.add(o);
    if (k === 7) star = o.getObjectByName("star");
  });

  const colors = ["#f2a9cf", "#f8c3c6", "#ffffff", "#c9a8f0", "#a9d18e", "#ffc94d", "#ff9a3c", "#7fd6ff", "#d9573f", "#2f63d8"];
  // Each hopper has its own little loop on the grass, spread round the case.
  const hopper = (obj: THREE.Object3D, i: number, size = 1): MiniBun => {
    const a = (i / ISLAND_MAX) * Math.PI * 2 + 0.3;
    const r = 2.2 + (i % 3) * 0.5;
    return { obj, size, center: new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r), radius: 0.35 + (i % 2) * 0.25, speed: (i % 2 ? 1 : -1) * (0.4 + (i % 4) * 0.1), phase: i * 1.3 };
  };
  const plain: MiniBun[] = colors.map((c, i) => {
    const obj = miniBun(c, october && i % 3 === 0);
    scene.add(obj);
    return hopper(obj, i);
  });
  let buns = plain;

  // Your own squishies, built once and dressed again when the cast changes.
  const pool: { sq: Squishy; holder: THREE.Group }[] = [];
  let castKey = "";
  const setSquishies = (cast: readonly IslandSquishy[]) => {
    const list = cast.filter((c) => defById(c.id)).slice(0, ISLAND_MAX);
    const key = list.map((c) => `${c.id}+${c.hat ?? ""}`).join(",");
    if (key === castKey) return;
    castKey = key;
    for (const b of plain) b.obj.visible = list.length === 0;
    buns = list.length ? [] : plain;
    list.forEach((c, i) => {
      const def = defById(c.id)!;
      // At Halloween, some without a hat go trick-or-treating in a witch hat, like the buns.
      const hat = c.hat ?? (october && i % 3 === 0 ? "witch" : null);
      let slot = pool[i];
      if (!slot) {
        const sq = new Squishy(def, { fx() {}, love() {}, did() {} });
        sq.autoSleep = false;
        // Stand it on the holder's floor, so squashing keeps its bottom on the grass.
        sq.home.set(0, -BOTTOM_Y, 0);
        const holder = new THREE.Group();
        holder.add(sq.group);
        scene.add(holder);
        slot = pool[i] = { sq, holder };
      }
      slot.sq.setDesign(def, hat);
      // Settle once into its resting shape, facing the way it hops; after that only the holder moves.
      slot.sq.faceNow(0);
      slot.sq.placeAt(slot.sq.home);
      slot.sq.update(1 / 60, 0.4, { minX: -3, maxX: 3, maxY: 6, floorY: 0 });
      slot.holder.visible = true;
      buns.push(hopper(slot.holder, i, SQUISHY_SIZE));
    });
    for (const slot of pool.slice(list.length)) slot.holder.visible = false;
  };

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  // Grass height at a distance from the middle.
  const groundAt = (r: number) => 0.22 + 0.16 * Math.sqrt(Math.max(0, 5.9 * 5.9 - r * r));
  const party = october ? dressIsland(scene, groundAt, box.cap) : autumn ? dressIslandAutumn(scene, groundAt, box.cap) : null;
  let dist = 20;
  const look = new THREE.Vector3(0, 1.1, 0);
  /** Seconds since everyone was last closed in the case. */
  let introT = 0;
  const pose = new THREE.Vector3();

  return {
    scene,
    camera,
    fit(w, h) {
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // Fit most of the island across a tall phone; the edges can drift off.
      dist = Math.min(27, Math.max(15, 6.0 / (t * camera.aspect)));
      camera.updateProjectionMatrix();
    },
    update(dt, t) {
      const a = t * 0.07;
      camera.position.set(Math.sin(a) * dist, dist * 0.62, Math.cos(a) * dist);
      // Leave the bottom of the screen for the Play button.
      look.y = 1.1 - dist * 0.08;
      camera.lookAt(look);
      introT += dt;
      buns.forEach((b, i) => {
        const ang = b.phase + t * b.speed;
        const hopT = (t * 2.2 + b.phase) % 1;
        const hop = Math.sin(hopT * Math.PI);
        pose.set(b.center.x + Math.cos(ang) * b.radius, top - 0.05 + hop * 0.35, b.center.y + Math.sin(ang) * b.radius);
        const turn = -ang + (b.speed > 0 ? 0 : Math.PI);
        const squash = hopT < 0.08 || hopT > 0.92 ? 0.8 : 1;
        const k = jumpProgress(i, buns.length, introT);
        b.obj.visible = k >= 0;
        if (k < 0) return;
        if (k >= 1) {
          b.obj.position.copy(pose);
          b.obj.rotation.y = turn;
          b.obj.scale.set(b.size / Math.sqrt(squash), b.size * squash, b.size / Math.sqrt(squash));
          return;
        }
        // Leaping out of the case: up over the rim in an arc, with a twirl, stretched on the way up and squashed
        // as it comes down, landing just where its hopping picks up.
        b.obj.position.lerpVectors(inside, pose, k);
        b.obj.position.y += Math.sin(k * Math.PI) * JUMP_ARC;
        const away = Math.atan2(pose.x - inside.x, pose.z - inside.z);
        const settle = THREE.MathUtils.euclideanModulo(turn - away + Math.PI, Math.PI * 2) - Math.PI;
        b.obj.rotation.y = away + (1 - k) * Math.PI * 2 + settle * k * k;
        const grow = b.size * (0.7 + 0.3 * Math.min(1, k / 0.35));
        const stretch = 1 + 0.22 * Math.cos(k * Math.PI) * (1 - k * 0.3);
        b.obj.scale.set(grow / Math.sqrt(stretch), grow * stretch, grow / Math.sqrt(stretch));
      });
      box.hinge.rotation.x = lidAngle(buns.length, introT);
      for (const [i, f] of foams.entries()) f.scale.setScalar(1 + Math.sin(t * 0.9 + i) * 0.015);
      if (star) star.rotation.y = t * 0.8;
      if (october) for (const [i, m] of sp.glow.entries()) m.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2 + i);
      party?.(dt, t);
    },
    setSquishies,
    intro() {
      introT = 0;
    },
  };
}
