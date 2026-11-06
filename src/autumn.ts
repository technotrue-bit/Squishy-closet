// Cozy autumn in Aurora's World. All through fall (outside Halloween's October) every place glows in a warm golden-hour light: a honey and apricot
// sky with a low, soft sun, maple leaves drifting down and settling on the ground, trees gone red and gold, leaf
// piles, pumpkins and hay bales, mugs of cocoa with steam curling up, a crackling campfire on the beach, warm
// string lights and leaf garlands, and a little squirrel busy with its acorn. Warm and alive, to feel good on the
// way into the holidays. Tap a leaf pile, a tree, a pumpkin, the fire, the cocoa or the squirrel and it plays back.

import * as THREE from "three";
import type { PlaceScene } from "./placeScenes";
import type { Solid } from "./nav";
import { duskSky, lights, pumpkin } from "./halloween";

const std = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });

function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/** Shapes and pictures are made once and shared. */
const once = <T>(make: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};

const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
/** A steady "random" number in 0..1 for the i-th thing, so places look the same every time. */
const hash = (i: number, k = 0) => ((Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

/** The colors of fall leaves, from cranberry to butter yellow. */
export const LEAF_COLORS = ["#e2532d", "#f08a24", "#f6b73c", "#c8622b", "#d8432a", "#eda23a", "#b9542a", "#f4c75a"];

// ---- leaves ------------------------------------------------------------------

/** A maple leaf in white and soft grays, so each leaf can be tinted its own color. */
const mapleTex = once(() =>
  tex(128, 128, (c) => {
    c.translate(64, 62);
    c.beginPath();
    const N = 240;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // Five pointy lobes (the top one longest), a notch at the bottom for the stem, and little teeth.
      const lobe = Math.pow(Math.abs(Math.cos(a * 2.5)), 1.4);
      const r = (20 + 30 * lobe + 2.5 * Math.abs(Math.sin(a * 15))) * (1 + 0.12 * Math.cos(a));
      const x = Math.sin(a) * r;
      const y = -Math.cos(a) * r;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 56);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#d9d9d9");
    c.fillStyle = g;
    c.fill();
    // Veins out to each lobe, and the stem.
    c.strokeStyle = "rgba(90,60,40,0.28)";
    c.lineWidth = 2.5;
    c.lineCap = "round";
    for (const a of [0, 1.256, -1.256, 2.51, -2.51]) {
      c.beginPath();
      c.moveTo(0, 6);
      c.lineTo(Math.sin(a) * 40, -Math.cos(a) * 40);
      c.stroke();
    }
    c.strokeStyle = "rgba(110,70,40,0.75)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 6);
    c.lineTo(2, 60);
    c.stroke();
  }),
);

/** A round, pointed leaf (like a beech or a birch). */
const ovalTex = once(() =>
  tex(128, 128, (c) => {
    c.translate(64, 64);
    c.beginPath();
    c.moveTo(0, -54);
    c.quadraticCurveTo(46, -18, 0, 46);
    c.quadraticCurveTo(-46, -18, 0, -54);
    c.closePath();
    const g = c.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, "#e2e2e2");
    g.addColorStop(0.5, "#ffffff");
    g.addColorStop(1, "#d6d6d6");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(90,60,40,0.3)";
    c.lineWidth = 2.5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, -46);
    c.lineTo(0, 46);
    c.stroke();
    for (let k = -3; k <= 2; k++) {
      const y = k * 12;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(0, y + 8);
        c.lineTo(s * 18, y - 4);
        c.stroke();
      }
    }
    c.strokeStyle = "rgba(110,70,40,0.75)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 44);
    c.lineTo(-2, 62);
    c.stroke();
  }),
);

const leafGeo = once(() => new THREE.PlaneGeometry(1, 1));
const leafMats = once(() =>
  [mapleTex(), ovalTex()].map((map) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 })),
);

interface Leaf {
  p: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  size: number;
  /** 0 put away, 1 in the air, 2 resting on the ground. */
  mode: 0 | 1 | 2;
  rest: number;
  /** Falls from the sky again after resting (the ones a tap throws up are put away instead). */
  ambient: boolean;
  phase: number;
  /** How fast it drifts down once it stops being thrown. */
  fall: number;
}

interface FallBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * Leaves drifting down: they sway and tumble, settle flat on the ground for a while, then fade and fall again.
 * A tap can throw a handful up from a leaf pile or shake them out of a tree.
 */
class LeafFall {
  readonly group = new THREE.Group();
  private leaves: Leaf[] = [];
  private meshes: THREE.InstancedMesh[];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(
    private box: FallBox,
    ambient: number,
    private floor: (x: number, z: number) => number = () => 0,
    spare = 48,
    big = 1,
  ) {
    const n = ambient + spare;
    const per = Math.ceil(n / 2);
    this.meshes = leafMats().map((mat) => {
      const im = new THREE.InstancedMesh(leafGeo(), mat, per);
      im.frustumCulled = false;
      this.group.add(im);
      return im;
    });
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const leaf: Leaf = {
        p: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        size: (0.2 + hash(i, 4) * 0.14) * big,
        mode: 0,
        rest: 0,
        ambient: i < ambient,
        phase: hash(i, 5) * 10,
        fall: 0.45 + hash(i, 6) * 0.45,
      };
      this.leaves.push(leaf);
      this.meshes[i % 2].setColorAt(Math.floor(i / 2), c.set(LEAF_COLORS[i % LEAF_COLORS.length]));
      if (leaf.ambient) {
        this.drop(leaf);
        // Start spread through the air, so the place is never empty.
        leaf.p.y = box.y0 + hash(i, 7) * (box.y1 - box.y0);
      }
    }
    for (const im of this.meshes) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    this.draw();
  }

  /** A leaf sets off from the sky somewhere in the box. */
  private drop(l: Leaf): void {
    const b = this.box;
    l.mode = 1;
    l.p.set(b.x0 + Math.random() * (b.x1 - b.x0), b.y1 + Math.random() * 1.5, b.z0 + Math.random() * (b.z1 - b.z0));
    l.vel.set(0, -l.fall, 0);
    l.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    l.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3);
  }

  /** Throws `n` leaves up and out from `at`; `up` is how hard. */
  burst(at: THREE.Vector3, n: number, up = 3.2, out = 1.6): void {
    let k = 0;
    for (const l of this.leaves) {
      if (k >= n) break;
      if (l.ambient || l.mode !== 0) continue;
      k++;
      const a = Math.random() * Math.PI * 2;
      const o = out * (0.4 + Math.random() * 0.6);
      l.mode = 1;
      l.p.copy(at).add(new THREE.Vector3(Math.cos(a) * 0.2, Math.random() * 0.2, Math.sin(a) * 0.2));
      l.vel.set(Math.cos(a) * o, up * (0.6 + Math.random() * 0.5), Math.sin(a) * o * 0.7 + 0.4);
      l.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      l.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
    }
  }

  step(t: number, dt: number): void {
    dt = Math.min(dt, 0.05);
    for (const l of this.leaves) {
      if (l.mode === 1) {
        // Gravity, but the air holds a leaf back to a gentle drift.
        l.vel.y = Math.max(-l.fall, l.vel.y - 7 * dt);
        const drag = Math.pow(0.35, dt);
        l.vel.x *= drag;
        l.vel.z *= drag;
        l.p.addScaledVector(l.vel, dt);
        // Swaying side to side like a falling leaf does.
        l.p.x += Math.cos(t * 1.4 + l.phase) * 0.55 * dt;
        l.p.z += Math.sin(t * 0.9 + l.phase) * 0.2 * dt;
        l.rot.x += l.spin.x * dt;
        l.rot.y += l.spin.y * dt;
        l.rot.z += l.spin.z * dt;
        const g = this.floor(l.p.x, l.p.z);
        if (l.vel.y < 0 && l.p.y <= g + 0.01) {
          l.mode = 2;
          l.p.y = g + 0.008 + (l.phase % 1) * 0.006;
          l.rot.set(-Math.PI / 2, 0, l.phase * 3);
          l.rest = 5 + (l.phase % 1) * 5;
        }
      } else if (l.mode === 2) {
        l.rest -= dt;
        if (l.rest <= 0) {
          if (l.ambient) this.drop(l);
          else l.mode = 0;
        }
      }
    }
    this.draw();
  }

  private draw(): void {
    this.leaves.forEach((l, i) => {
      const im = this.meshes[i % 2];
      // Resting leaves shrink away at the end; put-away ones are drawn at no size at all.
      const k = l.mode === 0 ? 0 : l.mode === 2 ? Math.min(1, l.rest / 0.6) : 1;
      this.s.setScalar(l.size * k + 1e-4);
      im.setMatrixAt(Math.floor(i / 2), this.m.compose(l.p, this.q.setFromEuler(l.rot), this.s));
    });
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true;
  }
}

// ---- the sky -----------------------------------------------------------------

const sunTex = once(() =>
  tex(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "#fffbe8");
    g.addColorStop(0.55, "#ffe6a0");
    g.addColorStop(0.62, "rgba(255,214,140,0.65)");
    g.addColorStop(0.75, "rgba(255,190,120,0.25)");
    g.addColorStop(1, "rgba(255,180,110,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }),
);

/** A low, soft autumn sun with a warm glow round it, never fogged. */
export function autumnSun(r: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 3.2, r * 3.2), new THREE.MeshBasicMaterial({ map: sunTex(), transparent: true, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}

// ---- trees, piles and the harvest ------------------------------------------------------

/** Three kinds of fall tree: red maple, golden birch and warm amber oak. */
export const TREE_COLORS = {
  maple: ["#e2532d", "#f0782a", "#d8432a", "#f39a3a"],
  gold: ["#f6c445", "#f4b23a", "#ffd76a", "#eda23a"],
  amber: ["#f08a24", "#e9a23b", "#c8622b", "#f6b73c"],
} as const;
export type TreeKind = keyof typeof TREE_COLORS;

const treeMats = new Map<string, THREE.MeshStandardMaterial>();
export const canopyMat = (color: string) => {
  let m = treeMats.get(color);
  if (!m) treeMats.set(color, (m = std(color, { roughness: 0.85 })));
  return m;
};
const barkMat = once(() => std("#8a5a3c", { roughness: 0.9 }));

/** A round fall tree, `s` big; `canopy` is the leafy top, which shakes when tapped. */
export function fallTree(s: number, kind: TreeKind): { obj: THREE.Group; canopy: THREE.Group } {
  const obj = new THREE.Group();
  const cols = TREE_COLORS[kind];
  add(obj, new THREE.CylinderGeometry(0.15, 0.24, 1.7, 10), barkMat(), 0, 0.85, 0);
  for (const sx of [-1, 1]) {
    const b = add(obj, new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6), barkMat(), sx * 0.2, 1.45, 0);
    b.rotation.z = -sx * 0.8;
  }
  const canopy = new THREE.Group();
  canopy.position.y = 2.0;
  const blobs: [number, number, number, number][] = [
    [0, 0.35, 0, 0.82],
    [0.62, 0, 0.12, 0.6],
    [-0.6, 0.04, 0, 0.62],
    [0.12, -0.12, 0.5, 0.56],
    [-0.18, 0.78, -0.1, 0.52],
    [0.3, 0.2, -0.45, 0.55],
  ];
  blobs.forEach(([x, y, z, r], i) => add(canopy, new THREE.SphereGeometry(r, 18, 14), canopyMat(cols[i % cols.length]), x, y, z));
  obj.add(canopy);
  obj.scale.setScalar(s);
  return { obj, canopy };
}

/** A soft mound of fallen leaves, `r` across. */
function leafPile(r: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const base = add(g, new THREE.SphereGeometry(r * 0.92, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std("#d8742c", { roughness: 0.9 }));
  base.scale.y = 0.45;
  const n = Math.round(40 * r * r + 18);
  const c = new THREE.Color();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  leafMats().forEach((mat, which) => {
    const k = Math.ceil(n / 2);
    const im = new THREE.InstancedMesh(leafGeo(), mat, k);
    for (let i = 0; i < k; i++) {
      const h = (j: number) => hash(seed * 31 + i * 2 + which, j);
      const th = h(1) * Math.PI * 2;
      const ph = Math.acos(1 - h(2) * 0.95);
      const nrm = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) / 0.45, Math.sin(ph) * Math.sin(th)).normalize();
      const p = new THREE.Vector3(Math.sin(ph) * Math.cos(th) * r * 0.95, Math.cos(ph) * r * 0.45 + 0.02, Math.sin(ph) * Math.sin(th) * r * 0.95);
      q.setFromUnitVectors(zAxis, nrm).multiply(spin.setFromAxisAngle(zAxis, h(3) * Math.PI * 2));
      const s = 0.26 + h(4) * 0.16;
      im.setMatrixAt(i, m.compose(p, q, new THREE.Vector3(s, s, s)));
      im.setColorAt(i, c.set(LEAF_COLORS[Math.floor(h(5) * LEAF_COLORS.length)]));
    }
    im.computeBoundingSphere();
    g.add(im);
  });
  return g;
}

const strawTex = once(() =>
  tex(128, 64, (c) => {
    c.fillStyle = "#eac46a";
    c.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 140; i++) {
      c.strokeStyle = i % 3 ? "rgba(190,140,50,0.55)" : "rgba(255,236,170,0.8)";
      c.lineWidth = 1.5;
      const x = hash(i, 1) * 128;
      const y = hash(i, 2) * 64;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 8 + hash(i, 3) * 14, y + (hash(i, 4) - 0.5) * 4);
      c.stroke();
    }
  }),
);

/** A hay bale tied with twine, sitting on the ground at its origin. */
function hayBale(): THREE.Group {
  const g = new THREE.Group();
  const straw = std("#ffffff", { map: strawTex(), roughness: 0.95 });
  add(g, new THREE.BoxGeometry(1.3, 0.62, 0.72), straw, 0, 0.31, 0);
  const twine = std("#9a6a3a", { roughness: 0.9 });
  for (const x of [-0.35, 0.35]) add(g, new THREE.BoxGeometry(0.05, 0.64, 0.74), twine, x, 0.31, 0);
  return g;
}

const wovenTex = once(() =>
  tex(64, 32, (c) => {
    c.fillStyle = "#c9955a";
    c.fillRect(0, 0, 64, 32);
    c.fillStyle = "#a8743e";
    for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 64; x += 16) c.fillRect(x, y, 8, 8);
  }),
);

/** A woven basket heaped with shiny red apples. */
function appleBasket(r: number): THREE.Group {
  const g = new THREE.Group();
  const w = wovenTex().clone();
  w.wrapS = THREE.RepeatWrapping;
  w.repeat.set(3, 1);
  w.needsUpdate = true;
  add(g, new THREE.CylinderGeometry(r, r * 0.8, r * 0.7, 24), std("#ffffff", { map: w, roughness: 0.85 }), 0, r * 0.35, 0);
  const rim = add(g, new THREE.TorusGeometry(r, r * 0.07, 8, 28), std("#a8743e"), 0, r * 0.7, 0);
  rim.rotation.x = Math.PI / 2;
  const apple = std("#d8333a", { roughness: 0.35 });
  const leaf = std("#7fb04a", { side: THREE.DoubleSide });
  const spots: [number, number, number][] = [[0, 0.82, 0], [0.42, 0.72, 0.1], [-0.4, 0.72, -0.08], [0.05, 0.72, 0.42], [-0.08, 0.7, -0.42], [0.2, 1.08, 0.12]];
  spots.forEach(([x, y, z], i) => {
    const a = add(g, new THREE.SphereGeometry(r * 0.34, 16, 12), i === 2 ? std("#f2b33d", { roughness: 0.4 }) : apple, x * r, y * r, z * r);
    a.scale.y = 0.9;
    add(g, new THREE.CylinderGeometry(0.012, 0.012, r * 0.16, 5), barkMat(), x * r, y * r + r * 0.34, z * r);
    if (i % 2 === 0) {
      const l = add(g, new THREE.CircleGeometry(r * 0.1, 8), leaf, x * r + r * 0.07, y * r + r * 0.36, z * r);
      l.scale.x = 0.5;
      l.rotation.set(-0.6, 0, -0.8);
    }
  });
  return g;
}

/** A mug of hot cocoa with marshmallows, and steam that curls up from it. */
function cocoa(): { obj: THREE.Group; steam(t: number, extra: number): void } {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.2, 0.18, 0.36, 22), std("#fff4e6", { roughness: 0.35 }), 0, 0.18, 0);
  add(g, new THREE.CylinderGeometry(0.203, 0.198, 0.08, 22), std("#e2532d", { roughness: 0.4 }), 0, 0.2, 0);
  const handle = add(g, new THREE.TorusGeometry(0.09, 0.028, 8, 16, Math.PI * 1.2), std("#fff4e6", { roughness: 0.35 }), 0.2, 0.18, 0);
  handle.rotation.z = -Math.PI * 0.6;
  const top = add(g, new THREE.CircleGeometry(0.18, 22), std("#7a4a2e", { roughness: 0.3 }), 0, 0.345, 0);
  top.rotation.x = -Math.PI / 2;
  const mallow = std("#fffaf5", { roughness: 0.8 });
  for (const [x, z, a] of [[0.05, 0.03, 0.3], [-0.07, -0.02, 1.1], [0.0, -0.09, 0.7]]) {
    const m = add(g, new THREE.BoxGeometry(0.08, 0.06, 0.08), mallow, x, 0.36, z);
    m.rotation.y = a;
  }
  const puffMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false });
  const puffs = [0, 1, 2, 3].map(() => {
    const p = add(g, new THREE.SphereGeometry(0.07, 10, 8), puffMat.clone());
    return p;
  });
  return {
    obj: g,
    steam: (t, extra) => {
      puffs.forEach((p, i) => {
        const k = ((t * (0.35 + extra * 0.5) + i / puffs.length) % 1 + 1) % 1;
        p.position.set(Math.sin(k * 6 + i) * 0.06, 0.4 + k * (0.6 + extra * 0.4), Math.cos(k * 5 + i) * 0.03);
        p.scale.setScalar(0.6 + k * (1.6 + extra));
        (p.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * (0.45 + extra * 0.3);
      });
    },
  };
}

const glowTex = once(() =>
  tex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,200,110,0.75)");
    g.addColorStop(0.4, "rgba(255,150,60,0.3)");
    g.addColorStop(1, "rgba(255,130,50,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }),
);

/** A little campfire in a ring of stones, with a marshmallow toasting on a stick. */
function campfire(): { obj: THREE.Group; flicker(t: number, dt: number, flare: number): void } {
  const g = new THREE.Group();
  const stone = std("#a89c92", { roughness: 0.9, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = add(g, new THREE.DodecahedronGeometry(0.13 + hash(i, 1) * 0.04), stone, Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5);
    s.scale.y = 0.7;
    s.rotation.y = a;
  }
  const log = std("#7a4a2e", { roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const l = add(g, new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8), log, 0, 0.16, 0);
    l.rotation.set(Math.PI / 2 - 0.45, (i / 3) * Math.PI * 2, 0);
    l.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.14, 0.17, Math.cos((i / 3) * Math.PI * 2) * 0.14);
  }
  const flames: THREE.Mesh[] = [];
  const outer = new THREE.MeshBasicMaterial({ color: "#ff8a2a" });
  const inner = new THREE.MeshBasicMaterial({ color: "#ffd25a" });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const f = add(g, new THREE.ConeGeometry(0.16, 0.55, 10), outer, Math.cos(a) * 0.1, 0.42, Math.sin(a) * 0.1);
    f.geometry.translate(0, 0.0, 0);
    flames.push(f);
  }
  const core = add(g, new THREE.ConeGeometry(0.12, 0.42, 10), inner, 0, 0.38, 0.02);
  flames.push(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.position.y = 0.45;
  glow.scale.setScalar(2.2);
  g.add(glow);
  // Sparks that float up and wink out.
  const sparkMat = new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true });
  const sparks = [0, 1, 2, 3, 4, 5].map(() => add(g, new THREE.SphereGeometry(0.025, 6, 4), sparkMat.clone()));
  // A marshmallow toasting on a stick.
  const stick = add(g, new THREE.CylinderGeometry(0.015, 0.02, 1.2, 5), std("#9a6a3a"), 0.62, 0.42, 0.3);
  stick.rotation.set(0.25, 0, 0.95);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), std("#f2d8b0", { roughness: 0.7 }), 0.13, 0.75, 0.42).rotation.z = 0.95;
  return {
    obj: g,
    flicker: (t, _dt, flare) => {
      flames.forEach((f, i) => {
        const s = 1 + 0.14 * Math.sin(t * 13 + i * 2) + 0.08 * Math.sin(t * 29 + i) + flare * 0.5;
        f.scale.set(1 + flare * 0.25, s, 1 + flare * 0.25);
        f.rotation.y = t * 0.6 + i;
      });
      glow.scale.setScalar(2.1 + Math.sin(t * 9) * 0.12 + flare * 0.8);
      sparks.forEach((sp, i) => {
        const k = ((t * (0.5 + flare * 0.8) + i / sparks.length) % 1 + 1) % 1;
        sp.position.set(Math.sin(i * 2.3 + k * 4) * 0.25, 0.5 + k * (1.3 + flare), Math.cos(i * 1.7 + k * 3) * 0.2);
        (sp.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      });
    },
  };
}

/** A small knitted beanie with a pompom, for anything that wants to stay cozy (a teapot, a crab, a duck). */
export function tinyBeanie(size: number, color = "#e2532d"): THREE.Group {
  const g = new THREE.Group();
  const rib = tex(64, 32, (c) => {
    c.fillStyle = color;
    c.fillRect(0, 0, 64, 32);
    c.fillStyle = "rgba(0,0,0,0.12)";
    for (let x = 0; x < 64; x += 8) c.fillRect(x, 0, 3, 32);
  });
  rib.wrapS = THREE.RepeatWrapping;
  rib.repeat.set(4, 1);
  const knit = std("#ffffff", { map: rib, roughness: 0.95 });
  const dome = add(g, new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), knit, 0, 0.12, 0);
  dome.scale.y = 1.15;
  add(g, new THREE.CylinderGeometry(0.52, 0.52, 0.2, 24), std("#fff1dc", { roughness: 0.95 }), 0, 0.08, 0);
  add(g, new THREE.SphereGeometry(0.17, 14, 10), std("#fff1dc", { roughness: 1 }), 0, 0.72, 0);
  g.scale.setScalar(size);
  return g;
}

/** A fluffy little squirrel, facing +z, standing on the ground at its origin. */
function squirrel(): { obj: THREE.Group; body: THREE.Group; tail: THREE.Group; acorn: THREE.Group } {
  const obj = new THREE.Group();
  const body = new THREE.Group();
  obj.add(body);
  const fur = std("#c8743a", { roughness: 0.85 });
  const belly = std("#f6dcb8", { roughness: 0.9 });
  const dark = std("#2e1f18", { roughness: 0.3 });
  add(body, new THREE.SphereGeometry(0.2, 18, 14), fur, 0, 0.22, 0).scale.set(1, 0.95, 1.2);
  add(body, new THREE.SphereGeometry(0.15, 14, 10), belly, 0, 0.2, 0.1).scale.set(0.9, 0.95, 0.9);
  const head = new THREE.Group();
  head.position.set(0, 0.43, 0.17);
  body.add(head);
  add(head, new THREE.SphereGeometry(0.15, 18, 14), fur);
  add(head, new THREE.SphereGeometry(0.09, 12, 10), belly, 0, -0.04, 0.08).scale.set(1.1, 0.8, 0.9);
  for (const s of [-1, 1]) {
    const ear = add(head, new THREE.ConeGeometry(0.05, 0.12, 8), fur, s * 0.08, 0.15, -0.02);
    ear.rotation.z = -s * 0.25;
    add(head, new THREE.SphereGeometry(0.025, 8, 6), dark, s * 0.065, 0.03, 0.125);
    add(head, new THREE.SphereGeometry(0.03, 8, 6), std("#ff9aa8", { roughness: 0.8 }), s * 0.1, -0.03, 0.1).scale.set(1, 0.6, 0.4);
  }
  add(head, new THREE.SphereGeometry(0.022, 8, 6), std("#5a3328"), 0, -0.01, 0.15);
  // A big curly tail made of fluffy puffs.
  const tail = new THREE.Group();
  tail.position.set(0, 0.16, -0.2);
  body.add(tail);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.18, -0.16), V(0, 0.45, -0.18), V(0, 0.62, -0.04), V(0, 0.6, 0.08)]);
  for (let i = 0; i < 8; i++) {
    const k = i / 7;
    const r = 0.08 + Math.sin(k * Math.PI) * 0.07;
    const p = curve.getPoint(k);
    add(tail, new THREE.SphereGeometry(r, 12, 10), i === 7 ? belly : fur, p.x, p.y, p.z);
  }
  // An acorn it nibbles when it sits up.
  const acorn = new THREE.Group();
  acorn.position.set(0, 0.32, 0.25);
  add(acorn, new THREE.SphereGeometry(0.05, 10, 8), std("#c88a4a", { roughness: 0.5 }), 0, 0, 0).scale.y = 1.2;
  add(acorn, new THREE.SphereGeometry(0.052, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std("#7a5230", { roughness: 0.9 }), 0, 0.02, 0);
  body.add(acorn);
  return { obj, body, tail, acorn };
}

function V(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/** A string between two points, dipping `drop` in the middle. */
const sag = (a: THREE.Vector3, b: THREE.Vector3, drop: number) =>
  new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -drop * 2, 0)), b);

/** A garland of fall leaves on a twine string, swaying a little. */
function garland(a: THREE.Vector3, b: THREE.Vector3, drop: number): { obj: THREE.Group; sway(t: number): void } {
  const g = new THREE.Group();
  const curve = sag(a, b, drop);
  add(g, new THREE.TubeGeometry(curve, 40, 0.018, 4, false), std("#8a5a3c"));
  const n = Math.max(4, Math.round(curve.getLength() / 0.32));
  const at: { p: THREE.Vector3; yaw: number; tilt: number; mesh: number; idx: number }[] = [];
  const counts = [0, 0];
  for (let i = 1; i < n; i++) {
    const tan = curve.getTangentAt(i / n);
    const which = i % 3 === 0 ? 1 : 0;
    at.push({ p: curve.getPointAt(i / n).add(new THREE.Vector3(0, -0.13, 0)), yaw: -Math.atan2(tan.z, tan.x), tilt: (hash(i, 2) - 0.5) * 0.9, mesh: which, idx: counts[which]++ });
  }
  const meshes = leafMats().map((mat, k) => new THREE.InstancedMesh(leafGeo(), mat, Math.max(1, counts[k])));
  const c = new THREE.Color();
  at.forEach((f, i) => meshes[f.mesh].setColorAt(f.idx, c.set(LEAF_COLORS[(i * 3) % LEAF_COLORS.length])));
  for (const m of meshes) g.add(m);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, "YXZ");
  const s = new THREE.Vector3(0.34, 0.34, 0.34);
  const sway = (t: number) => {
    for (const [i, f] of at.entries()) {
      e.set(Math.sin(t * 1.5 + i * 0.8) * 0.25, f.yaw, Math.PI + f.tilt + Math.sin(t * 1.1 + i) * 0.12);
      meshes[f.mesh].setMatrixAt(f.idx, m.compose(f.p, q.setFromEuler(e), s));
    }
    for (const mm of meshes) mm.instanceMatrix.needsUpdate = true;
  };
  sway(0);
  for (const mm of meshes) mm.computeBoundingSphere();
  return { obj: g, sway };
}

/** A painted sign hung on two ropes. */
function banner(text: string, w: number, h: number): THREE.Mesh {
  const t = tex(512, 128, (c) => {
    c.fillStyle = "#fff3e0";
    c.beginPath();
    c.roundRect(6, 6, 500, 116, 26);
    c.fill();
    c.lineWidth = 10;
    c.strokeStyle = "#e2532d";
    c.stroke();
    // A little leaf at each end.
    for (const [x, col] of [[56, "#f08a24"], [456, "#d8432a"]] as const) {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(x, 64, 16, 26, 0.6, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#a8462a";
    c.font = "900 62px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 256, 68);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
}

/** A plaid blanket picture, for throws and picnic rugs. */
const plaidTex = once(() =>
  tex(128, 128, (c) => {
    c.fillStyle = "#d8573a";
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = "rgba(255,240,215,0.55)";
    for (let i = 0; i < 128; i += 32) {
      c.fillRect(i + 4, 0, 8, 128);
      c.fillRect(0, i + 4, 128, 8);
    }
    c.fillStyle = "rgba(120,40,30,0.35)";
    for (let i = 0; i < 128; i += 32) {
      c.fillRect(i + 18, 0, 4, 128);
      c.fillRect(0, i + 18, 128, 4);
    }
  }),
);

// ---- a place's harvest: decorations that move, and the ones you can tap --------------

interface Pokeable {
  obj: THREE.Object3D;
  poke(): string;
}

const CRUNCH = ["Crunch crunch!", "Wheee, leaves!", "Leaf pile jump!", "Crinkle crinkle!"];
const RUSTLE = ["Rustle rustle!", "Leaves everywhere!", "Happy Fall!", "So many colors!"];
const PUMPKIN_SAYS = ["Happy Fall!", "Pumpkin hop!", "Boing!", "Harvest time!"];
const COCOA = ["Mmm, cocoa!", "Warm and cozy!", "Marshmallows!", "Sip sip!"];
const FIRE = ["Crackle crackle!", "So warm and cozy!", "Toasty!", "S'mores time!"];
const SQUIRREL = ["Chitter chitter!", "I found an acorn!", "Nuts for fall!", "Hop hop!"];

class Harvest {
  readonly group = new THREE.Group();
  readonly solids: Solid[] = [];
  private anims: ((t: number, dt: number) => void)[] = [];
  private pokes: Pokeable[] = [];
  private fall: LeafFall | null = null;

  constructor(private floor: (x: number, z: number) => number = () => 0) {}

  on(fn: (t: number, dt: number) => void): void {
    this.anims.push(fn);
  }

  update(dt: number, t: number): void {
    for (const a of this.anims) a(t, dt);
  }

  poke(ray: THREE.Raycaster): { at: THREE.Vector3; say: string; boo: boolean; leaves: boolean } | null {
    let best: { p: Pokeable; d: number; at: THREE.Vector3 } | null = null;
    for (const p of this.pokes) {
      const hit = ray.intersectObject(p.obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { p, d: hit.distance, at: hit.point };
    }
    if (!best) return null;
    return { at: best.at, say: best.p.poke(), boo: false, leaves: true };
  }

  private tap(obj: THREE.Object3D, poke: () => string): void {
    this.pokes.push({ obj, poke });
  }

  /** The leaves in the air: ambient ones drifting through `box`, and spares for taps to throw. */
  leaves(box: FallBox, n: number, big = 1): void {
    this.fall = new LeafFall(box, n, this.floor, 48, big);
    this.group.add(this.fall.group);
    const f = this.fall;
    this.on((t, dt) => f.step(t, dt));
  }

  private burst(at: THREE.Vector3, n: number, up?: number, out?: number): void {
    if (!this.fall) this.leaves({ x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 }, 0);
    this.fall!.burst(at, n, up, out);
  }

  sky(p: PlaceScene, colors: [string, string, string, number], fog: string, near: number, far: number, light: [string, string]): void {
    p.sky = duskSky(colors[0], colors[1], colors[2], colors[3]);
    p.fog = new THREE.Fog(fog, near, far);
    p.light = light;
    p.golden = true;
  }

  sunAt(x: number, y: number, z: number, r: number): void {
    const s = autumnSun(r);
    s.position.set(x, y, z);
    this.group.add(s);
    this.on((t) => s.scale.setScalar(1 + Math.sin(t * 0.8) * 0.02));
  }

  /** A fall tree; tap it and it shakes, and leaves shower down. */
  tree(x: number, z: number, s: number, kind: TreeKind, opts: { y?: number; yaw?: number; parent?: THREE.Object3D } = {}): THREE.Group {
    const tr = fallTree(s, kind);
    tr.obj.position.set(x, opts.y ?? this.floor(x, z), z);
    tr.obj.rotation.y = opts.yaw ?? hash(x * 7 + z) * Math.PI * 2;
    (opts.parent ?? this.group).add(tr.obj);
    if (opts.y === undefined) this.solids.push({ x, z, r: 0.3 * s });
    this.shakeable(tr.obj, tr.canopy, s);
    return tr.obj;
  }

  /** Makes a tree already in a place shake and drop leaves when tapped. */
  shakeable(obj: THREE.Object3D, canopy: THREE.Object3D, s: number): void {
    let shake = -1;
    const phase = obj.position.x * 1.3 + obj.position.z;
    const rest = canopy.rotation.clone();
    this.on((t, dt) => {
      let wob = Math.sin(t * 0.9 + phase) * 0.025;
      if (shake >= 0) {
        shake += dt;
        wob += Math.sin(shake * 22) * 0.12 * Math.max(0, 1 - shake / 0.9);
        if (shake > 0.9) shake = -1;
      }
      canopy.rotation.set(rest.x + wob * 0.5, rest.y, rest.z + wob);
    });
    this.tap(obj, () => {
      shake = 0;
      const at = new THREE.Vector3();
      canopy.getWorldPosition(at);
      this.group.worldToLocal(at);
      this.burst(at.add(new THREE.Vector3(0, -0.3 * s, 0)), 16, 0.8, 1.4 * s);
      return pick(RUSTLE);
    });
  }

  /** A pile of fallen leaves; tap it and the leaves fly up. */
  pile(x: number, z: number, r: number): void {
    const pl = leafPile(r, Math.round(x * 13 + z * 7));
    pl.position.set(x, this.floor(x, z), z);
    this.group.add(pl);
    let jump = -1;
    this.on((_t, dt) => {
      if (jump < 0) return;
      jump += dt;
      const k = Math.min(1, jump / 0.5);
      const sq = 1 - Math.sin(k * Math.PI) * 0.35;
      pl.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
      if (k >= 1) {
        jump = -1;
        pl.scale.setScalar(1);
      }
    });
    this.tap(pl, () => {
      jump = 0;
      this.burst(new THREE.Vector3(x, pl.position.y + r * 0.4, z), 18, 3.4, 1.8);
      return pick(CRUNCH);
    });
  }

  /** A pumpkin on the ground (or on something, at `y`); tap it and it hops. */
  pumpkin(x: number, z: number, r: number, color = "#ff9a3c", opts: { y?: number; yaw?: number; squat?: number; parent?: THREE.Object3D } = {}): void {
    const p = pumpkin(r, color, opts.squat ?? 0.8);
    p.obj.position.set(x, opts.y ?? this.floor(x, z), z);
    p.obj.rotation.y = opts.yaw ?? hash(x * 3 + z) * 6;
    (opts.parent ?? this.group).add(p.obj);
    if (opts.y === undefined && !opts.parent) this.solids.push({ x, z, r: r * 1.02 });
    let hop = -1;
    this.on((_t, dt) => {
      if (hop < 0) return;
      hop += dt;
      const k = hop / 0.6;
      p.body.position.y = Math.sin(Math.min(1, k) * Math.PI) * r * 0.6;
      const sq = k < 0.15 ? 1 - k * 1.5 : 1;
      p.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      if (k >= 1) {
        hop = -1;
        p.body.position.y = 0;
        p.body.scale.setScalar(1);
      }
    });
    this.tap(p.obj, () => {
      hop = 0;
      return pick(PUMPKIN_SAYS);
    });
  }

  hay(x: number, z: number, yaw = 0, opts: { y?: number; parent?: THREE.Object3D } = {}): THREE.Group {
    const h = hayBale();
    h.position.set(x, opts.y ?? this.floor(x, z), z);
    h.rotation.y = yaw;
    (opts.parent ?? this.group).add(h);
    if (opts.y === undefined && !opts.parent) this.solids.push({ x, z, r: 0.66 });
    return h;
  }

  apples(x: number, z: number, r: number): void {
    const b = appleBasket(r);
    b.position.set(x, this.floor(x, z), z);
    this.group.add(b);
    this.solids.push({ x, z, r: r * 1.05 });
  }

  /** A mug of cocoa; tap it and the steam puffs up. */
  cocoa(x: number, z: number, s = 1, y?: number): void {
    const c = cocoa();
    c.obj.position.set(x, y ?? this.floor(x, z), z);
    c.obj.scale.setScalar(s);
    c.obj.rotation.y = -0.6;
    this.group.add(c.obj);
    if (y === undefined) this.solids.push({ x, z, r: 0.22 * s });
    let puff = 0;
    this.on((t, dt) => {
      puff = Math.max(0, puff - dt * 0.6);
      c.steam(t, puff);
    });
    this.tap(c.obj, () => {
      puff = 1;
      return pick(COCOA);
    });
  }

  /** A crackling campfire; tap it and it flares up and sparks fly. */
  campfire(x: number, z: number, s = 1): void {
    const f = campfire();
    f.obj.position.set(x, this.floor(x, z), z);
    f.obj.scale.setScalar(s);
    this.group.add(f.obj);
    this.solids.push({ x, z, r: 0.62 * s });
    let flare = 0;
    this.on((t, dt) => {
      flare = Math.max(0, flare - dt * 0.8);
      f.flicker(t, dt, flare);
    });
    this.tap(f.obj, () => {
      flare = 1;
      return pick(FIRE);
    });
  }

  /** A squirrel scampering back and forth from x0 to x1, stopping to sit up and nibble its acorn. */
  squirrel(x0: number, x1: number, z: number, s = 1): void {
    const sq = squirrel();
    sq.obj.scale.setScalar(s);
    this.group.add(sq.obj);
    let jump = -1;
    const T = 16;
    this.on((t, dt) => {
      const c = (t % T) / T;
      // Run right, sit, run left, sit.
      const run = c < 0.25 ? c / 0.25 : c < 0.5 ? -1 : c < 0.75 ? (c - 0.5) / 0.25 : -1;
      const right = c < 0.5;
      const k = run >= 0 ? run * run * (3 - 2 * run) : right ? 1 : 0;
      const along = right ? k : 1 - k;
      const x = x0 + (x1 - x0) * (c < 0.25 ? along : c < 0.5 ? 1 : c < 0.75 ? along : 0);
      let y = this.floor(x, z);
      let yaw: number;
      if (run >= 0) {
        // Bounding along in little hops.
        y += Math.abs(Math.sin(t * 11)) * 0.18 * s;
        yaw = (x1 > x0) === right ? Math.PI / 2 : -Math.PI / 2;
        sq.body.rotation.x = Math.sin(t * 11) * 0.15;
        sq.acorn.visible = false;
        sq.tail.rotation.x = Math.sin(t * 11) * 0.2;
      } else {
        // Sitting up facing you, nibbling.
        yaw = 0.15 * Math.sin(t * 0.7);
        sq.body.rotation.x = -0.25;
        sq.acorn.visible = true;
        sq.acorn.position.y = 0.32 + Math.abs(Math.sin(t * 8)) * 0.02;
        sq.tail.rotation.x = Math.sin(t * 2) * 0.1;
      }
      if (jump >= 0) {
        jump += dt;
        const j = Math.min(1, jump / 0.8);
        y += Math.sin(j * Math.PI) * 0.9 * s;
        yaw += j * Math.PI * 2;
        if (j >= 1) jump = -1;
      }
      sq.obj.position.set(x, y, z);
      sq.obj.rotation.y = yaw;
    });
    this.tap(sq.obj, () => {
      jump = 0;
      return pick(SQUIRREL);
    });
  }

  garland(a: THREE.Vector3, b: THREE.Vector3, drop: number): void {
    const s = garland(a, b, drop);
    this.group.add(s.obj);
    this.on((t) => s.sway(t));
  }

  /** Warm, softly glowing string lights. */
  lights(a: THREE.Vector3, b: THREE.Vector3, drop: number): void {
    const s = lights(a, b, drop, ["#ffd27a", "#ffb347", "#ffe9b0", "#ff9a5a"], "#6a4a3a");
    this.group.add(s.obj);
    this.on((t) => s.twinkle(t * 0.6));
  }

  /** A wooden post with an acorn on top, for hanging garlands from. */
  post(x: number, z: number, h: number): void {
    add(this.group, new THREE.CylinderGeometry(0.1, 0.12, h, 10), std("#8a5a3c", { roughness: 0.8 }), x, h / 2, z);
    add(this.group, new THREE.SphereGeometry(0.17, 12, 10), std("#c88a4a", { roughness: 0.5 }), x, h + 0.08, z).scale.y = 1.15;
    add(this.group, new THREE.SphereGeometry(0.18, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std("#7a5230", { roughness: 0.9 }), x, h + 0.12, z);
    this.solids.push({ x, z, r: 0.15 });
  }

  banner(text: string, a: THREE.Vector3, b: THREE.Vector3): void {
    const w = a.distanceTo(b);
    const m = banner(text, w * 0.86, 0.9);
    m.position.copy(a).lerp(b, 0.5).add(new THREE.Vector3(0, -0.6, 0));
    this.group.add(m);
    for (const end of [a, b]) {
      const from = end.clone();
      const to = m.position.clone().add(new THREE.Vector3(Math.sign(end.x - m.position.x) * w * 0.43, 0.45, 0));
      const rope = add(this.group, new THREE.CylinderGeometry(0.015, 0.015, from.distanceTo(to), 4), std("#6a4a3a"));
      rope.position.copy(from).lerp(to, 0.5);
      rope.lookAt(to);
      rope.rotateX(Math.PI / 2);
    }
    this.on((t) => (m.rotation.x = Math.sin(t * 0.9) * 0.05));
  }

  /** A cozy plaid blanket laid flat, w by d. */
  blanket(x: number, z: number, w: number, d: number, yaw = 0, y = 0.01): THREE.Mesh {
    const b = add(this.group, new THREE.PlaneGeometry(w, d), std("#ffffff", { map: plaidTex(), roughness: 0.95, side: THREE.DoubleSide }), x, y, z);
    b.rotation.set(-Math.PI / 2, 0, yaw);
    return b;
  }
}

// ---- dressing each place ------------------------------------------------------------

/** Tints a named thing's material (keeping its picture). */
function tint(p: PlaceScene, name: string, color: string): void {
  p.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (o.name === name && m?.color) m.color.set(color);
  });
}

/** The low sun's golden shimmer on the sea. */
function seaShimmer(h: Harvest, x: number, z: number, len: number): void {
  const shine = tex(32, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,220,150,0)");
    g.addColorStop(0.5, "rgba(255,220,150,0.6)");
    g.addColorStop(1, "rgba(255,220,150,0)");
    c.fillStyle = g;
    for (let y = 0; y < 256; y += 10) c.fillRect(6 + ((y * 7) % 9), y, 20 - ((y * 5) % 8), 6);
  });
  const streak = add(h.group, new THREE.PlaneGeometry(2, len), new THREE.MeshBasicMaterial({ map: shine, transparent: true, depthWrite: false, fog: false }), x, 0.01, z);
  streak.rotation.x = -Math.PI / 2;
  h.on((t) => ((streak.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 1.5) * 0.25));
}

function dressTable(p: PlaceScene, h: Harvest): void {
  h.sky(p, ["#f2a27e", "#ffd49c", "#fff0d6", 0.5], "#ffe0c0", 16, 34, ["#fff3e2", "#ffc890"]);
  tint(p, "ground", "#fbe8d4");
  h.sunAt(-3.6, 2.4, -30, 2.4);
  // A little grove of fall trees round the back of the table.
  h.tree(-6.8, -8.6, 1.25, "maple");
  h.tree(6.9, -8.9, 1.35, "gold");
  h.tree(-2.8, -11.8, 1.1, "amber");
  h.tree(3.4, -12.2, 1.2, "maple");
  h.tree(0.3, -14.6, 1.05, "gold");
  h.pile(-5.0, -6.1, 0.7);
  h.pile(5.7, -6.5, 0.6);
  // The harvest: a hay bale with a pumpkin on top, and more pumpkins round it.
  h.hay(0.4, -8.3, 0.1);
  h.pumpkin(0.2, -8.3, 0.34, "#ff9a3c", { y: 0.62 });
  h.pumpkin(2.1, -7.6, 0.5, "#ff8a2a");
  h.pumpkin(1.35, -7.95, 0.3, "#f6c453");
  h.pumpkin(-1.3, -7.5, 0.36, "#f3ead8");
  h.cocoa(3.9, -5.7, 1.2);
  h.apples(2.9, -1.5, 0.42);
  // A leaf garland and warm lights between two posts at the back.
  for (const x of [-6.2, 6.2]) h.post(x, -10.4, 4.8);
  h.garland(V(-6.2, 4.5, -10.4), V(6.2, 4.5, -10.4), 0.7);
  h.lights(V(-6.2, 4.7, -10.35), V(6.2, 4.7, -10.35), 0.95);
  h.squirrel(-3.6, 3.0, -9.6);
  h.leaves({ x0: -9, x1: 9, y0: 0, y1: 8, z0: -12, z1: -1 }, 46);
  // The teapot keeps warm in a knitted beanie.
  const pot = p.group.getObjectByName("teapot");
  if (pot) {
    const b = tinyBeanie(0.38);
    b.position.set(0, 0.78, 0);
    pot.add(b);
  }
}

function dressBeach(p: PlaceScene, h: Harvest): void {
  h.sky(p, ["#eea07e", "#ffc98e", "#ffedcf", 0.58], "#ffd9b6", 22, 60, ["#fff2e0", "#ffd2a0"]);
  tint(p, "ground", "#fbe3c4");
  tint(p, "sea", "#86bcc8");
  tint(p, "isle", "#d98a4a");
  tint(p, "canopy", "#ffb070");
  const sun = p.group.getObjectByName("sun");
  if (sun) sun.visible = false;
  h.sunAt(4.6, 1.3, -38, 1.9);
  seaShimmer(h, 4.0, -22, 18);
  // A cozy campfire on the sand, with cocoa warming beside it.
  h.campfire(-3.3, -4.5);
  h.cocoa(-4.1, -3.7, 1.0);
  h.blanket(-4.5, -6.2, 1.5, 1.1, 0.35);
  h.pumpkin(-5.6, -3.2, 0.48, "#ff8a2a");
  h.pumpkin(-4.9, -3.6, 0.3, "#f6c453");
  h.pumpkin(6.0, -3.0, 0.42, "#ff9a3c");
  h.tree(-6.6, -7.2, 1.2, "amber");
  h.pile(-5.8, -5.6, 0.55);
  // Warm lights from the palm tree to the umbrella.
  const palm = p.group.getObjectByName("palm");
  const top = palm ? new THREE.Vector3(1.0, 3.6, 0.1).add(palm.position) : V(-3.4, 3.6, -5.3);
  h.lights(top, V(3.15, 2.5, -5.0), 0.5);
  h.leaves({ x0: -9, x1: 9, y0: 0, y1: 7, z0: -10, z1: -1 }, 26);
  const crab = p.group.getObjectByName("crab");
  if (crab) {
    const b = tinyBeanie(0.26, "#f08a24");
    b.position.set(0, 0.2, 0);
    crab.add(b);
  }
}

function dressBoat(p: PlaceScene, h: Harvest): void {
  h.sky(p, ["#eea07e", "#ffcf96", "#fff0d6", 0.62], "#ffdcb8", 24, 70, ["#fff2e0", "#ffe0c0"]);
  tint(p, "sea", "#86bcc8");
  tint(p, "isle", "#d98a4a");
  const sail = p.group.getObjectByName("sail") as THREE.Mesh | undefined;
  if (sail) {
    const m = sail.material as THREE.MeshStandardMaterial;
    m.map = tex(256, 256, (c) => {
      c.fillStyle = "#fff6ec";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#f6b73c";
      c.fillRect(0, 150, 256, 14);
      c.fillStyle = "#e2532d";
      c.fillRect(0, 168, 256, 14);
      // A big maple leaf on the sail.
      c.save();
      c.translate(128, 88);
      c.fillStyle = "#e2702d";
      c.beginPath();
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * Math.PI * 2;
        const r = (16 + 26 * Math.pow(Math.abs(Math.cos(a * 2.5)), 1.4) + 2 * Math.abs(Math.sin(a * 15))) * (1 + 0.12 * Math.cos(a));
        if (i) c.lineTo(Math.sin(a) * r, -Math.cos(a) * r);
        else c.moveTo(Math.sin(a) * r, -Math.cos(a) * r);
      }
      c.fill();
      c.strokeStyle = "#a8462a";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(2, 50);
      c.stroke();
      c.restore();
    });
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
  }
  const flag = p.group.getObjectByName("flag") as THREE.Mesh | undefined;
  if (flag) (flag.material as THREE.MeshStandardMaterial).color.set("#e2532d");
  h.sunAt(3.6, 1.4, -36, 2.0);
  seaShimmer(h, 3.2, -24, 18);
  // Warm lights from the top of the mast down to the bow and both sides.
  for (const to of [V(0, 1.1, -11), V(-4.9, 1.0, -2.6), V(4.9, 1.0, -2.6)]) h.lights(V(0, 8.6, -5.6), to, 0.35);
  h.pumpkin(-1.5, -8.6, 0.4, "#ff8a2a");
  h.pumpkin(-0.8, -8.9, 0.26, "#f6c453");
  h.pumpkin(1.9, -8.8, 0.3, "#f3ead8");
  h.pumpkin(-4.0, -0.6, 0.4, "#ff9a3c");
  h.cocoa(4.0, -1.0, 1.1);
  h.leaves({ x0: -6, x1: 6, y0: 0, y1: 8, z0: -12, z1: 0 }, 24);
}

function dressRoom(p: PlaceScene, h: Harvest): void {
  h.sky(p, ["#f8dcc8", "#f8dcc8", "#f8dcc8", 0.5], "#f8dcc8", 20, 40, ["#fff0dc", "#e9b27a"]);
  tint(p, "wall", "#ffe4cf");
  tint(p, "lampShade", "#ffd08a");
  const shade = p.group.getObjectByName("lampShade") as THREE.Mesh | undefined;
  if (shade) {
    const m = shade.material as THREE.MeshStandardMaterial;
    m.emissive.set("#ffa64a");
    m.emissiveIntensity = 0.75;
  }
  // Outside the window: a golden afternoon, hills and fall trees.
  const win = p.group.getObjectByName("windowSky") as THREE.Mesh | undefined;
  if (win) {
    const m = win.material as THREE.MeshBasicMaterial;
    m.map = tex(256, 204, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 204);
      g.addColorStop(0, "#f5a77e");
      g.addColorStop(0.6, "#ffd8a0");
      g.addColorStop(1, "#fff0d6");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 204);
      const sun = c.createRadialGradient(70, 120, 0, 70, 120, 46);
      sun.addColorStop(0, "#fffbe8");
      sun.addColorStop(0.5, "#ffe6a0");
      sun.addColorStop(1, "rgba(255,214,140,0)");
      c.fillStyle = sun;
      c.fillRect(0, 60, 160, 120);
      c.fillStyle = "#e7b070";
      c.beginPath();
      c.ellipse(60, 214, 150, 60, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#d9965a";
      c.beginPath();
      c.ellipse(220, 220, 140, 66, 0, 0, Math.PI * 2);
      c.fill();
      for (const [x, y, r, col] of [[30, 150, 26, "#e2532d"], [92, 158, 20, "#f6b73c"], [170, 148, 30, "#f08a24"], [228, 156, 22, "#d8432a"], [130, 166, 16, "#eda23a"]] as const) {
        c.fillStyle = "#8a5a3c";
        c.fillRect(x - 3, y, 6, 30);
        c.fillStyle = col;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    });
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
  }
  tint(p, "windowCloud", "#fff2de");
  // Leaves drifting past the window.
  const winLeaves = leafMats().map((mat) => new THREE.InstancedMesh(leafGeo(), mat, 4));
  const c = new THREE.Color();
  winLeaves.forEach((im, k) => {
    for (let i = 0; i < 4; i++) im.setColorAt(i, c.set(LEAF_COLORS[(i * 2 + k * 3) % LEAF_COLORS.length]));
    im.frustumCulled = false;
    h.group.add(im);
  });
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  h.on((t) => {
    for (let i = 0; i < 8; i++) {
      const k = ((t * (0.07 + hash(i, 1) * 0.05) + hash(i, 2)) % 1 + 1) % 1;
      pos.set(-2.55 + hash(i, 3) * 2.7 + Math.sin(t * 1.3 + i) * 0.18, 4.45 - k * 2.1, -7.895);
      e.set(0, Math.sin(t * 2 + i) * 0.9, t * (1 + hash(i, 4)) + i);
      // Only inside the window: tiny at the top and bottom edges.
      sc.setScalar(0.17 * Math.min(1, k * 8, (1 - k) * 8) + 1e-4);
      winLeaves[i % 2].setMatrixAt(Math.floor(i / 2), mm.compose(pos, q.setFromEuler(e), sc));
    }
    for (const im of winLeaves) im.instanceMatrix.needsUpdate = true;
  });
  h.garland(V(-5.0, 5.6, -7.85), V(3.8, 5.6, -7.85), 0.45);
  h.lights(V(-5.0, 6.1, -7.82), V(3.8, 6.1, -7.82), 0.6);
  // A plaid throw over the couch, pumpkins on the shelf, the TV and the floor, and cocoa to sip.
  const throwMat = std("#ffffff", { map: plaidTex(), roughness: 0.95 });
  add(h.group, new THREE.BoxGeometry(1.25, 0.04, 1.05), throwMat, -2.05, 1.05, -7.05);
  add(h.group, new THREE.BoxGeometry(1.25, 0.6, 0.04), throwMat, -2.05, 0.76, -6.52);
  h.pumpkin(-4.4, -7.35, 0.3, "#ff8a2a", { y: 3.2 });
  h.pumpkin(-4.0, -7.3, 0.2, "#f6c453", { y: 3.2 });
  h.pumpkin(1.9, -6.65, 0.22, "#f3ead8", { y: 1.68 });
  h.pumpkin(4.7, -7.0, 0.45, "#ff9a3c");
  h.pumpkin(5.3, -6.5, 0.28, "#f6c453");
  h.pile(-5.5, -5.2, 0.5);
  h.cocoa(-3.3, -1.5, 1.3);
}

function dressCity(p: PlaceScene, h: Harvest): void {
  h.sky(p, ["#eea482", "#ffd4a0", "#fff0dc", 0.55], "#f8dcc6", 18, 44, ["#fff3e2", "#ffd8b8"]);
  tint(p, "ground", "#f3e4d2");
  // Every tree on the street turns red and gold, and shakes its leaves down when tapped.
  const trees = new Set<THREE.Object3D>();
  let n = 0;
  p.group.traverse((o) => {
    if (o.name !== "leaves") return;
    const kind = (["maple", "gold", "amber"] as const)[Math.floor(n / 3) % 3];
    (o as THREE.Mesh).material = canopyMat(TREE_COLORS[kind][n % 4]);
    n++;
    if (o.parent) trees.add(o.parent);
  });
  for (const t of trees) {
    // Gather the leafy top of each tree so it can shake on its own.
    const canopy = new THREE.Group();
    canopy.position.set(0, 1.9, 0);
    t.add(canopy);
    for (const leaf of t.children.filter((c) => c.name === "leaves")) {
      canopy.add(leaf);
      leaf.position.y -= 1.9;
    }
    h.shakeable(t, canopy, 0.8);
  }
  p.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m) return;
    if (o.name === "streetLamp") {
      m.color.set("#ffe2a0");
      m.emissive.set("#ffa64a");
      m.emissiveIntensity = 0.85;
    }
    if (o.name === "houseWindows" && m.map) {
      m.emissive.set("#ffc070");
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0.35;
      m.needsUpdate = true;
    }
  });
  tint(p, "cartUmbrella", "#ff9a3c");
  h.sunAt(-5.5, 9.0, -36, 2.2);
  h.banner("Happy Fall!", V(-3.4, 3.4, -11.05), V(3.1, 3.4, -11.05));
  h.lights(V(-8, 3.2, -5.0), V(8, 3.2, -5.0), 0.8);
  // Pumpkins and hay on the doorsteps across the street, and leaf piles under the trees.
  h.hay(-4.6, -12.5, 0);
  h.pumpkin(-4.6, -12.5, 0.3, "#ff8a2a", { y: 0.62 });
  h.pumpkin(-1.4, -12.3, 0.42, "#ff9a3c");
  h.pumpkin(-0.8, -12.6, 0.26, "#f6c453");
  h.pumpkin(1.9, -12.4, 0.32, "#f3ead8");
  h.pumpkin(5.0, -12.3, 0.4, "#ff8a2a");
  h.pile(-5.5, -3.7, 0.55);
  h.pile(6.6, -3.6, 0.5);
  h.squirrel(-5.5, 5.5, -10.2);
  h.leaves({ x0: -11, x1: 11, y0: 0, y1: 8, z0: -13, z1: -1 }, 50);
  const cart = p.group.getObjectByName("cart");
  if (cart) h.pumpkin(-0.38, 0.12, 0.17, "#ff9a3c", { y: 1.05, parent: cart });
}

const DRESS: Record<PlaceScene["id"], (p: PlaceScene, h: Harvest) => void> = {
  table: dressTable,
  beach: dressBeach,
  boat: dressBoat,
  room: dressRoom,
  city: dressCity,
};

/**
 * Dresses a place for cozy autumn: its sky, light and colors, decorations that move, and things to tap. Call it
 * before the place's solids are used: the solid decorations join them.
 */
export function dressAutumn(p: PlaceScene): void {
  const h = new Harvest();
  DRESS[p.id](p, h);
  p.group.add(h.group);
  p.solids.push(...h.solids);
  const base = p.update;
  p.update = (dt, t) => {
    base(dt, t);
    h.update(dt, t);
  };
  p.poke = (ray) => h.poke(ray);
}

// ---- the island ------------------------------------------------------------------------

/**
 * Squishy Island in autumn: a golden sky, fall trees between the places, pumpkins round the shore, leaves drifting
 * down over everything, and the Closet keeping warm in a big knitted beanie.
 */
export function dressIslandAutumn(scene: THREE.Scene, groundAt: (r: number) => number): (dt: number, t: number) => void {
  const h = new Harvest((x, z) => groundAt(Math.hypot(x, z)));
  scene.background = duskSky("#eea07e", "#ffd09a", "#fff0d6", 0.6);
  scene.fog = new THREE.Fog("#ffd8b4", 30, 70);
  const kinds: TreeKind[] = ["maple", "gold", "amber"];
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const r = i % 2 ? 4.9 : 5.15;
    h.tree(Math.sin(a) * r, Math.cos(a) * r, 0.42 + (i % 3) * 0.05, kinds[i % 3]);
  }
  const colors = ["#ff8a2a", "#f6c453", "#ff9a3c", "#f3ead8"];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.22;
    h.pumpkin(Math.sin(a) * 5.45, Math.cos(a) * 5.45, 0.2 + (i % 3) * 0.05, colors[i % 4], { yaw: a });
  }
  for (const [a, r] of [[0.9, 2.2], [2.6, 2.4], [4.4, 2.1]] as const) h.pile(Math.sin(a) * r, Math.cos(a) * r, 0.38);
  h.leaves({ x0: -6.5, x1: 6.5, y0: 0.5, y1: 7, z0: -6.5, z1: 6.5 }, 50, 1.8);
  const hat = tinyBeanie(1.55, "#e2532d");
  hat.position.set(0.1, 3.05, 0);
  scene.add(hat, h.group);
  return (dt, t) => h.update(dt, t);
}
