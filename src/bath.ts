// Bath time! A little clawfoot tub pops up in front, your squishy hops in, and you give it a bath in four steps:
// tap the tap to fill the tub, rub to scrub off the mud in lots of foam, drag the shower over it to rinse the bubbles
// away, then rub it dry with a fluffy towel while the water drains. The rubber duck squeaks when you tap it, and soap
// bubbles float up for popping. It all happens right there in the place, so the squishy squishes under your finger
// the whole time. At Halloween the tub is lilac, the towel is striped orange and purple and the duck is a witch.

import * as THREE from "three";
import type { Fx, Squishy } from "./squishy";
import { BOTTOM_Y, CENTER_Y } from "./bao";
import { tinyWitchHat } from "./halloween";
import * as sfx from "./audio";

export type BathStep = "fill" | "scrub" | "rinse" | "dry";
export const BATH_STEPS: readonly BathStep[] = ["fill", "scrub", "rinse", "dry"];

/** The tub's inside floor (where the squishy sits) and its rim. */
export const TUB_FLOOR = 0.22;
export const TUB_RIM = 0.75;
/** The water when the tub is full: over the squishy's bottom, under its face. */
export const WATER_TOP = 0.52;
/** How much bigger the tub is than its round profile, side to side and front to back (a squishy is 2 across). */
const TUB_X = 1.8;
const TUB_Z = 1.18;
const FILL_SECONDS = 2.4;
const DRAIN_SECONDS = 1.8;

// ---- the sums (no 3D), so tests can check them ------------------------------------

/** A mud spot on the squishy, in its own space, and how much of it is left (1 all, 0 gone). */
export interface Spot {
  x: number;
  y: number;
  z: number;
  left: number;
}

/** Rubs at `p`: mud within `reach` comes off, the most right under the finger. Returns how much came off. */
export function rub(spots: Spot[], p: { x: number; y: number; z: number }, amount: number, reach = 0.5): number {
  let off = 0;
  for (const s of spots) {
    if (s.left <= 0) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z);
    if (d >= reach) continue;
    const take = Math.min(s.left, amount * (1 - d / reach));
    s.left -= take;
    off += take;
  }
  return off;
}

/** How clean, 0 (all the mud) to 1 (none left). Spots nearly gone count as gone. */
export function cleanness(spots: readonly Spot[]): number {
  if (!spots.length) return 1;
  const left = spots.reduce((n, s) => n + (s.left > 0.03 ? s.left : 0), 0);
  return 1 - left / spots.length;
}

/** How much a shower at `showerX` washes foam at `foamX`: all of it right under, none past `width`. */
export const washes = (foamX: number, showerX: number, width = 0.55): number => Math.max(0, 1 - Math.abs(foamX - showerX) / width);

/** The inside of the tub across, at a height: it narrows toward the floor. */
export function tubInside(y: number): number {
  const prof: [number, number][] = [
    [TUB_FLOOR, 0.72],
    [0.28, 0.86],
    [0.36, 0.92],
    [0.52, 0.95],
    [TUB_RIM, 0.97],
  ];
  if (y <= prof[0][0]) return prof[0][1];
  for (let i = 1; i < prof.length; i++) {
    const [y1, r1] = prof[i];
    const [y0, r0] = prof[i - 1];
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return prof[prof.length - 1][1];
}

// ---- the tub and its things ----------------------------------------------------------

const phys = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, ...opts });

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

function stripes(a: string, b: string): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 128;
  const c = cv.getContext("2d")!;
  c.fillStyle = a;
  c.fillRect(0, 0, 64, 128);
  c.fillStyle = b;
  for (let y = 10; y < 128; y += 36) c.fillRect(0, y, 64, 14);
  // Fluffy flecks.
  c.fillStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < 120; i++) c.fillRect((i * 37) % 64, (i * 53) % 128, 2, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function duck(spooky: boolean): THREE.Group {
  const g = new THREE.Group();
  const yellow = phys("#ffd84d", { clearcoat: 1, roughness: 0.25 });
  mesh(g, new THREE.SphereGeometry(0.17, 20, 14), yellow).scale.set(1.25, 0.8, 1);
  mesh(g, new THREE.SphereGeometry(0.11, 18, 12), yellow, 0.12, 0.16, 0);
  const beak = mesh(g, new THREE.SphereGeometry(0.06, 14, 10), phys("#ff8a3c"), 0.22, 0.14, 0);
  beak.scale.set(1.3, 0.5, 0.9);
  for (const s of [-1, 1]) mesh(g, new THREE.SphereGeometry(0.018, 8, 6), phys("#1d1d28"), 0.19, 0.2, s * 0.055);
  const tail = mesh(g, new THREE.ConeGeometry(0.07, 0.12, 10), yellow, -0.2, 0.06, 0);
  tail.rotation.z = 0.9;
  if (spooky) {
    const h = tinyWitchHat(0.2);
    h.position.set(0.11, 0.25, 0);
    g.add(h);
  }
  return g;
}

function faucet(): { obj: THREE.Group; handles: THREE.Group[]; tip: THREE.Vector3 } {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: "#e8eef6", metalness: 0.9, roughness: 0.15 });
  const pipe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.98, 0.5, 0),
    new THREE.Vector3(1.98, 0.98, 0),
    new THREE.Vector3(1.92, 1.12, 0),
    new THREE.Vector3(1.76, 1.13, 0),
    new THREE.Vector3(1.66, 1.04, 0),
  ]);
  mesh(g, new THREE.TubeGeometry(pipe, 30, 0.05, 12, false), chrome);
  mesh(g, new THREE.SphereGeometry(0.055, 12, 8), chrome, 1.66, 1.03, 0);
  const handles: THREE.Group[] = [];
  for (const [z, cap] of [[-0.2, "#ff7fb0"], [0.2, "#7fc8f0"]] as const) {
    const h = new THREE.Group();
    mesh(h, new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8), chrome, 0, 0.05, 0);
    // A little cross to turn.
    for (let k = 0; k < 4; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * Math.PI) / 2;
      mesh(pivot, new THREE.CapsuleGeometry(0.022, 0.1, 4, 8), chrome, 0.07, 0.11, 0).rotation.z = Math.PI / 2;
      h.add(pivot);
    }
    mesh(h, new THREE.SphereGeometry(0.05, 12, 8), phys(cap), 0, 0.14, 0);
    h.position.set(1.98, 0.86, z);
    g.add(h);
    handles.push(h);
  }
  return { obj: g, handles, tip: new THREE.Vector3(1.66, 1.0, 0) };
}

function shower(): THREE.Group {
  const g = new THREE.Group();
  const blue = phys("#8fdcff", { clearcoat: 1 });
  const head = new THREE.Group();
  mesh(head, new THREE.CylinderGeometry(0.22, 0.17, 0.12, 24), blue);
  const face = new THREE.CanvasTexture(
    (() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const c = cv.getContext("2d")!;
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#7fbfe0";
      for (let r = 0; r < 3; r++)
        for (let k = 0; k < 6 + r * 6; k++) {
          const a = (k / (6 + r * 6)) * Math.PI * 2;
          c.beginPath();
          c.arc(32 + Math.cos(a) * r * 9, 32 + Math.sin(a) * r * 9, 2.2, 0, Math.PI * 2);
          c.fill();
        }
      return cv;
    })(),
  );
  face.colorSpace = THREE.SRGBColorSpace;
  mesh(head, new THREE.CircleGeometry(0.165, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: face }), 0, -0.061, 0);
  g.add(head);
  const handle = mesh(g, new THREE.CapsuleGeometry(0.055, 0.45, 6, 12), blue, 0.28, 0.2, 0);
  handle.rotation.z = -1.0;
  return g;
}

function towel(spooky: boolean): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ map: spooky ? stripes("#ff9a3c", "#8a5cf0") : stripes("#ffd6e6", "#ffffff"), roughness: 0.95, sheen: 1, sheenColor: new THREE.Color("#ffffff") });
  const body = mesh(g, new THREE.CapsuleGeometry(0.07, 0.5, 6, 12), m);
  body.scale.set(5, 1, 1);
  body.rotation.x = Math.PI / 2;
  body.rotation.z = Math.PI / 2;
  return g;
}

interface Foam {
  obj: THREE.Group;
  amount: number;
}

interface Bubble {
  m: THREE.Mesh;
  v: THREE.Vector3;
  age: number;
  life: number;
}

export interface BathEvents {
  fx(kind: Fx, at: THREE.Vector3, count?: number): void;
  /** A new step starts: which one, and its number from 0. */
  step(s: BathStep, i: number): void;
  /** How far along this step is, 0..1. */
  progress(k: number): void;
  /** Where the helping hand should show a move, or null to hide it. */
  hint(move: "tap" | "pet" | null, at?: THREE.Vector3): void;
  /** Every step is done: it's squeaky clean, and cheers. */
  clean(): void;
  /** All clean! */
  done(): void;
}

type Phase = "off" | "in" | BathStep | "cheer" | "out";

const UP = new THREE.Vector3(0, 1, 0);

export class Bath {
  readonly group = new THREE.Group();
  private tubBody = new THREE.Group();
  private phase: Phase = "off";
  private t = 0;
  private did = 0;
  private water: THREE.Mesh;
  private waterMat: THREE.MeshStandardMaterial;
  private level = TUB_FLOOR;
  private filling = false;
  private stream: THREE.Mesh;
  private tap: { obj: THREE.Group; handles: THREE.Group[]; tip: THREE.Vector3 };
  private suds: THREE.Mesh[] = [];
  private duck: THREE.Group;
  private duckHop = -1;
  private showerHead: THREE.Group;
  private towel: THREE.Group;
  private spots: Spot[] = [];
  private mud: THREE.Group[] = [];
  private foams: Foam[] = [];
  private foamStart = 0;
  private dry = 0;
  private bubbles: Bubble[] = [];
  private nextBubble = 0;
  private drops: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
  private dropGeo = new THREE.SphereGeometry(0.03, 6, 5);
  private dropMat = new THREE.MeshBasicMaterial({ color: "#bfefff", transparent: true, opacity: 0.85 });
  private bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
  private bubbleMat = new THREE.MeshPhysicalMaterial({ color: "#e6f6ff", transparent: true, opacity: 0.35, roughness: 0, clearcoat: 1, iridescence: 1, depthWrite: false });
  private foamGeo = new THREE.SphereGeometry(1, 12, 8);
  private foamMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, emissive: new THREE.Color("#e8f4ff"), emissiveIntensity: 0.25 });
  /** The finger that is scrubbing, rinsing or drying, and where it was. */
  private finger: { id: number; x: number; y: number; on: boolean } | null = null;
  private spraying = false;
  private toolAt = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private nextSqueak = 0;
  private nextGiggle = 0;
  private nextSpray = 0;
  private now = 0;
  private lastProgress = -1;

  constructor(
    scene: THREE.Scene,
    private squishy: Squishy,
    private camera: THREE.Camera,
    private ev: BathEvents,
    spooky: boolean,
  ) {
    const shell = new THREE.LatheGeometry(
      [
        [0, 0.15],
        [0.84, 0.15],
        [0.97, 0.2],
        [1.04, 0.32],
        [1.07, 0.5],
        [1.06, 0.66],
        [1.03, 0.73],
        [0.99, TUB_RIM],
        [0.97, 0.72],
        [0.95, 0.52],
        [0.92, 0.36],
        [0.86, 0.28],
        [0.72, TUB_FLOOR],
        [0, TUB_FLOOR],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    const tubMat = phys(spooky ? "#d8c2ff" : "#ffc6df", { side: THREE.DoubleSide, clearcoat: 1, roughness: 0.25 });
    const tub = mesh(this.tubBody, shell, tubMat);
    tub.scale.set(TUB_X, 1, TUB_Z);
    // Golden claw feet.
    const gold = new THREE.MeshStandardMaterial({ color: "#ffd27a", metalness: 0.8, roughness: 0.3 });
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const foot = mesh(this.tubBody, new THREE.SphereGeometry(0.11, 14, 10), gold, x * 1.5, 0.08, z * 0.72);
        foot.scale.set(1, 0.8, 1.2);
        mesh(this.tubBody, new THREE.ConeGeometry(0.08, 0.12, 10), gold, x * 1.5, 0.17, z * 0.72).rotation.x = Math.PI;
      }
    this.tap = faucet();
    this.tubBody.add(this.tap.obj);
    this.stream = mesh(this.tubBody, new THREE.CylinderGeometry(0.035, 0.05, 1, 10, 1, true), new THREE.MeshStandardMaterial({ color: "#bfefff", transparent: true, opacity: 0.6, roughness: 0.05 }));
    this.stream.visible = false;
    this.waterMat = new THREE.MeshStandardMaterial({ color: "#9fe0ff", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false });
    this.water = mesh(this.tubBody, new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.waterMat);
    this.water.renderOrder = 1;
    // Suds round the edge of the water.
    const sudsMat = new THREE.MeshStandardMaterial({ color: spooky ? "#f3ecff" : "#ffffff", roughness: 0.4, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.15 });
    for (let i = 0; i < 22; i++) {
      const s = mesh(this.tubBody, this.foamGeo, sudsMat);
      s.userData.a = (i / 22) * Math.PI * 2 + Math.sin(i * 3) * 0.1;
      s.userData.r = 0.08 + ((i * 7) % 5) * 0.022;
      this.suds.push(s);
    }
    this.duck = duck(spooky);
    this.tubBody.add(this.duck);
    this.showerHead = shower();
    this.towel = towel(spooky);
    this.group.add(this.tubBody, this.showerHead, this.towel);
    this.group.visible = false;
    scene.add(this.group);
  }

  get on(): boolean {
    return this.phase !== "off";
  }

  /** Out comes the tub, and in hops the squishy. */
  start(): void {
    this.clearSquishy();
    this.phase = "in";
    this.t = 0;
    this.did = 0;
    this.level = TUB_FLOOR;
    this.filling = false;
    this.dry = 0;
    this.finger = null;
    this.spraying = false;
    this.lastProgress = -1;
    this.group.visible = true;
    this.tubBody.scale.setScalar(0.001);
    this.showerHead.visible = false;
    this.towel.visible = false;
    this.stream.visible = false;
    for (const h of this.tap.handles) h.rotation.y = 0;
    this.squishy.yawTarget = 0;
    this.squishy.wiggle();
    sfx.whoosh();
  }

  /** Puts everything away (the bath is over, or closed early). The tub shrinks away by itself. */
  stop(): void {
    if (this.phase === "off" || this.phase === "out") return;
    this.clearSquishy();
    if (this.finger) this.squishy.fingerUp(this.finger.id);
    this.finger = null;
    this.phase = "out";
    this.t = 0;
    this.showerHead.visible = false;
    this.towel.visible = false;
    this.stream.visible = false;
    for (const b of this.bubbles) this.group.remove(b.m);
    this.bubbles = [];
    for (const d of this.drops) this.group.remove(d.m);
    this.drops = [];
    this.ev.hint(null);
  }

  private clearSquishy(): void {
    for (const m of this.mud) this.squishy.mesh.remove(m);
    for (const f of this.foams) this.squishy.mesh.remove(f.obj);
    this.mud = [];
    this.foams = [];
    this.spots = [];
  }

  private go(p: BathStep): void {
    this.phase = p;
    this.t = 0;
    this.did = 0;
    this.lastProgress = -1;
    this.ev.step(p, BATH_STEPS.indexOf(p));
    this.progress(0);
  }

  private progress(k: number): void {
    const r = Math.round(k * 50) / 50;
    if (r === this.lastProgress) return;
    this.lastProgress = r;
    this.ev.progress(r);
  }

  // ---- touches ----------------------------------------------------------------

  private rayAt(x: number, y: number): THREE.Raycaster {
    this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray;
  }

  /** Where a screen point lands on the squishy, or just inside its edge when a finger is a little off it. */
  private hitSquishy(x: number, y: number): THREE.Intersection | null {
    const direct = this.rayAt(x, y).intersectObject(this.squishy.mesh, false)[0];
    if (direct) return direct;
    const c = this.squishy.group.position.clone().add(new THREE.Vector3(0, 0.1, 0)).project(this.camera);
    const sx = ((c.x + 1) / 2) * window.innerWidth;
    const sy = ((1 - c.y) / 2) * window.innerHeight;
    for (const f of [0.85, 0.7]) {
      const h = this.rayAt(sx + (x - sx) * f, sy + (y - sy) * f).intersectObject(this.squishy.mesh, false)[0];
      if (h) return h;
    }
    return null;
  }

  /** Where a screen point is on an upright sheet `z` toward the camera from the middle of the tub. */
  private onSheet(x: number, y: number, z: number): THREE.Vector3 | null {
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
    return this.rayAt(x, y).ray.intersectPlane(plane, new THREE.Vector3());
  }

  down(id: number, x: number, y: number): void {
    if (this.phase === "off" || this.phase === "out" || this.phase === "in") return;
    const ray = this.rayAt(x, y);
    // Bubbles pop, the duck squeaks: any time.
    const bub = this.bubbles.find((b) => ray.intersectObject(b.m, false).length);
    if (bub) {
      bub.age = bub.life;
      this.ev.fx("sparkle", bub.m.position.clone(), 2);
      sfx.pop();
      return;
    }
    if (ray.intersectObject(this.duck, true).length) {
      this.duckHop = 0;
      sfx.squeak(1.7, 0.14, 0.3);
      setTimeout(() => sfx.squeak(1.9, 0.1, 0.25), 140);
      this.ev.fx("heart", this.duck.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)), 1);
      return;
    }
    if (this.phase === "fill") {
      if (!this.filling && (ray.intersectObject(this.tap.obj, true).length || this.nearTap(x, y))) this.turnOn();
      return;
    }
    if (this.finger) return;
    this.finger = { id, x, y, on: false };
    if (this.phase === "scrub") {
      const hit = this.hitSquishy(x, y);
      if (hit) {
        this.finger.on = true;
        this.squishy.fingerDown(id, this.squishy.dirAtHit(hit));
        this.scrubAt(hit, 0);
      }
    } else if (this.phase === "rinse") {
      this.spraying = true;
      this.moveTool(x, y);
    } else if (this.phase === "dry") this.moveTool(x, y);
    this.ev.hint(null);
  }

  move(id: number, x: number, y: number): void {
    const f = this.finger;
    if (!f || f.id !== id) return;
    const dist = Math.hypot(x - f.x, y - f.y);
    f.x = x;
    f.y = y;
    if (this.phase === "scrub") {
      const hit = this.hitSquishy(x, y);
      if (hit) {
        if (!f.on) this.squishy.fingerDown(id, this.squishy.dirAtHit(hit));
        else this.squishy.fingerMove(id, this.squishy.dirAtHit(hit), true);
        f.on = true;
        this.scrubAt(hit, dist);
      } else if (f.on) {
        this.squishy.fingerUp(id);
        f.on = false;
      }
    } else if (this.phase === "rinse" || this.phase === "dry") {
      this.moveTool(x, y);
      if (this.phase === "dry" && this.nearSquishy(this.toolAt)) this.rubDry(dist);
    }
  }

  up(id: number): void {
    const f = this.finger;
    if (!f || f.id !== id) return;
    if (f.on) this.squishy.fingerUp(id);
    this.finger = null;
    this.spraying = false;
  }

  private nearTap(x: number, y: number): boolean {
    const p = this.tap.handles[0].getWorldPosition(new THREE.Vector3()).project(this.camera);
    const sx = ((p.x + 1) / 2) * window.innerWidth;
    const sy = ((1 - p.y) / 2) * window.innerHeight;
    return Math.hypot(x - sx, y - sy) < 70;
  }

  private nearSquishy(p: THREE.Vector3): boolean {
    const c = this.squishy.group.position;
    return Math.abs(p.x - c.x) < 1.3 && p.y > c.y - 0.6 && p.y < c.y + 1.2;
  }

  /** The shower or the towel follows the finger, in front of the squishy. */
  private moveTool(x: number, y: number): void {
    const rinse = this.phase === "rinse";
    const p = this.onSheet(x, y, rinse ? 0.6 : 1.25);
    if (!p) return;
    const top = this.squishy.group.position.y + 0.95;
    p.x = Math.max(-1.9, Math.min(1.9, p.x));
    // The shower stays above the squishy's head; the towel stays on it.
    p.y = rinse ? Math.max(top + 0.45, Math.min(top + 1.6, p.y)) : Math.max(WATER_TOP + 0.1, Math.min(top + 0.2, p.y));
    this.toolAt.copy(p);
  }

  // ---- the steps ---------------------------------------------------------------------

  private turnOn(): void {
    this.filling = true;
    this.t = 0;
    sfx.squeak(1.4, 0.1, 0.2);
    sfx.pour(FILL_SECONDS);
    this.ev.hint(null);
  }

  /** Mud spots dotted about the squishy's front, sides and top, just off its face. */
  private makeMud(): void {
    const sq = this.squishy;
    const center = sq.mesh.localToWorld(new THREE.Vector3(0, CENTER_Y, 0));
    const q = sq.mesh.getWorldQuaternion(new THREE.Quaternion());
    const browns = ["#8a5a3a", "#6e4630", "#9a6a44"];
    // Azimuth (from the front) and height, in degrees, and size.
    const at: [number, number, number][] = [
      [-60, 8, 0.17],
      [62, 12, 0.15],
      [-34, 46, 0.15],
      [36, 40, 0.16],
      [2, 70, 0.18],
      [30, -6, 0.11],
      [-46, -8, 0.12],
    ];
    const ray = new THREE.Raycaster();
    for (const [az, el, r] of at) {
      const a = THREE.MathUtils.degToRad(az);
      const e = THREE.MathUtils.degToRad(el);
      const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).applyQuaternion(q);
      ray.set(center.clone().addScaledVector(dir, 3), dir.clone().negate());
      const hit = ray.intersectObject(sq.mesh, false)[0];
      if (!hit || !hit.face) continue;
      const local = sq.mesh.worldToLocal(hit.point.clone());
      const n = hit.face.normal.clone().normalize();
      const splat = new THREE.Group();
      splat.position.copy(local).addScaledVector(n, 0.005);
      splat.quaternion.setFromUnitVectors(UP, n);
      const mat = new THREE.MeshStandardMaterial({ color: browns[this.mud.length % browns.length], roughness: 1, transparent: true });
      mesh(splat, this.foamGeo, mat).scale.set(r, r * 0.28, r * 0.85);
      // A few little flecks round it.
      for (let k = 0; k < 3; k++) {
        const b = k * 2.1 + az;
        mesh(splat, this.foamGeo, mat, Math.cos(b) * r * 1.5, 0, Math.sin(b) * r * 1.4).scale.set(r * 0.28, r * 0.12, r * 0.28);
      }
      sq.mesh.add(splat);
      this.mud.push(splat);
      this.spots.push({ x: local.x, y: local.y, z: local.z, left: 1 });
    }
  }

  /** Where the most mud is left, in the world. */
  private muddiest(): THREE.Vector3 | null {
    let best = -1;
    this.spots.forEach((s, i) => {
      if (s.left > 0.03 && (best < 0 || s.left > this.spots[best].left)) best = i;
    });
    return best < 0 || !this.mud[best] ? null : this.mud[best].getWorldPosition(new THREE.Vector3());
  }

  private scrubAt(hit: THREE.Intersection, dist: number): void {
    const sq = this.squishy;
    const local = sq.mesh.worldToLocal(hit.point.clone());
    rub(this.spots, local, dist * 0.0025 + 0.015);
    // Foam builds up where you rub.
    const n = (hit.face?.normal ?? UP).clone().normalize();
    let near: Foam | null = null;
    for (const f of this.foams) if (f.obj.position.distanceTo(local) < 0.16) near = f;
    if (near) near.amount = Math.min(1, near.amount + dist * 0.004);
    else if (this.foams.length < 48 && (dist > 4 || !this.foams.length)) {
      const g = new THREE.Group();
      g.position.copy(local).addScaledVector(n, 0.02);
      g.quaternion.setFromUnitVectors(UP, n);
      for (let k = 0; k < 4; k++) {
        const b = k * 1.7 + this.foams.length;
        const s = mesh(g, this.foamGeo, this.foamMat, Math.cos(b) * 0.5, k * 0.15, Math.sin(b) * 0.5);
        s.scale.setScalar(0.55 + (k % 2) * 0.3);
      }
      sq.mesh.add(g);
      this.foams.push({ obj: g, amount: 0.35 });
    }
    if (dist > 0 && this.now > this.nextSqueak) {
      this.nextSqueak = this.now + 0.22;
      sfx.squeak(sq.pitch * (1.4 + Math.random() * 0.3), 0.06, 0.12);
      if (Math.random() < 0.35) this.ev.fx("bubble", hit.point.clone(), 1);
    }
    if (dist > 0 && this.now > this.nextGiggle) {
      this.nextGiggle = this.now + 1.6;
      sfx.giggle(sq.pitch);
      sq.express("giggle", 0.8, 0.5);
    }
  }

  private rubDry(dist: number): void {
    const sq = this.squishy;
    this.dry = Math.min(1, this.dry + dist * 0.0008);
    if (this.now > this.nextSqueak) {
      this.nextSqueak = this.now + 0.3;
      sfx.whoosh();
      this.ev.fx("splash", sq.topPoint().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.4, 0.2)), 2);
      if (Math.random() < 0.4) sq.wiggle();
    }
    if (this.now > this.nextGiggle) {
      this.nextGiggle = this.now + 1.4;
      sq.express("happy", 0.8, 0.4);
    }
  }

  // ---- every frame -----------------------------------------------------------------------

  update(dt: number, now: number): void {
    this.now = now;
    if (this.phase === "off") return;
    this.t += dt;
    const sq = this.squishy;
    switch (this.phase) {
      case "in": {
        const grow = Math.min(1, this.t / 0.35);
        this.tubBody.scale.setScalar(Math.max(0.001, grow + Math.sin(grow * Math.PI) * 0.12));
        if (this.did === 0 && this.t > 0.3) {
          this.did = 1;
          sq.bounce(6);
          sfx.boing(sq.pitch);
        }
        if (this.did === 1 && this.t > 0.5) {
          this.did = 2;
          sq.placeAt(new THREE.Vector3(0, TUB_FLOOR - BOTTOM_Y, 0));
          sq.basket.r = 1.08;
          sq.basket.top = TUB_RIM;
        }
        if (this.t > 1.4) this.go("fill");
        break;
      }
      case "fill": {
        if (this.filling) {
          const k = Math.min(1, this.t / FILL_SECONDS);
          this.level = TUB_FLOOR + (WATER_TOP - TUB_FLOOR) * k;
          for (const h of this.tap.handles) h.rotation.y = Math.min(1, this.t * 4) * 1.6;
          this.progress(k);
          if (k >= 1) {
            this.filling = false;
            this.stream.visible = false;
            for (const h of this.tap.handles) h.rotation.y = 0;
            sfx.splash();
            sq.express("happy", 1.2, 0.6);
            sq.bounce(2.4);
            this.ev.fx("bubble", sq.topPoint(), 4);
            this.go("scrub");
            this.makeMud();
            this.ev.fx("splash", sq.topPoint(), 4);
          }
        } else this.ev.hint("tap", this.tap.handles[0].getWorldPosition(new THREE.Vector3()));
        break;
      }
      case "scrub": {
        this.progress(cleanness(this.spots));
        // The hand points at the muddiest spot left, so none gets missed.
        if (!this.finger) this.ev.hint("pet", this.muddiest() ?? sq.group.position.clone().add(new THREE.Vector3(0.1, 0.45, 0.85)));
        if (cleanness(this.spots) >= 0.999) {
          this.progress(1);
          sfx.chime(false);
          this.ev.fx("sparkle", sq.topPoint(), 8);
          sq.express("love", 1, 0.5);
          if (this.finger?.on) sq.fingerUp(this.finger.id);
          this.finger = null;
          this.foamStart = this.foams.reduce((n, f) => n + f.amount, 0);
          this.go("rinse");
          this.showerHead.visible = true;
          this.toolAt.set(1.2, sq.group.position.y + 1.7, 0.6);
          this.showerHead.position.copy(this.toolAt);
        }
        break;
      }
      case "rinse": {
        if (this.spraying) {
          for (const f of this.foams) {
            const w = washes(f.obj.getWorldPosition(new THREE.Vector3()).x, this.toolAt.x);
            f.amount = Math.max(0, f.amount - dt * 1.6 * w);
          }
          this.spray(dt);
          if (now > this.nextSpray) {
            this.nextSpray = now + 0.45;
            sfx.spray();
          }
        } else this.ev.hint("pet", sq.group.position.clone().add(new THREE.Vector3(-0.6, 1.3, 0.8)));
        const left = this.foams.reduce((n, f) => n + f.amount, 0);
        const k = this.foamStart > 0 ? 1 - left / this.foamStart : 1;
        this.progress(k);
        if (left < 0.02 || this.foamStart <= 0) {
          this.progress(1);
          this.clearSquishy();
          sfx.chime(false);
          sq.wiggle();
          this.finger = null;
          this.spraying = false;
          this.showerHead.visible = false;
          this.go("dry");
          sfx.drain();
          this.towel.visible = true;
          this.toolAt.set(-1.6, sq.group.position.y + 0.55, 1.25);
        }
        break;
      }
      case "dry": {
        this.level = Math.max(TUB_FLOOR, WATER_TOP - ((WATER_TOP - TUB_FLOOR) * this.t) / DRAIN_SECONDS);
        this.progress(this.dry);
        if (!this.finger) this.ev.hint("pet", sq.group.position.clone().add(new THREE.Vector3(-0.3, 0.5, 1.0)));
        if (this.dry >= 1) {
          this.phase = "cheer";
          this.t = 0;
          this.towel.visible = false;
          this.finger = null;
          this.ev.hint(null);
          this.ev.clean();
          sq.express("love", 1.8, 0.8);
          sq.bounce(4.5);
          sfx.chime(true);
          this.ev.fx("sparkle", sq.topPoint(), 14);
          this.ev.fx("heart", sq.topPoint(), 6);
          this.ev.fx("glimmer", sq.topPoint(), 16);
        }
        break;
      }
      case "cheer": {
        if (this.t > 0.4 && this.did === 0) {
          this.did = 1;
          sq.wiggle();
        }
        if (this.t > 1.7) {
          this.ev.done();
          return;
        }
        break;
      }
      case "out": {
        const k = Math.min(1, this.t / 0.35);
        this.tubBody.scale.setScalar(Math.max(0.001, 1 - k * k));
        if (k >= 1) {
          this.phase = "off";
          this.group.visible = false;
          this.level = TUB_FLOOR;
        }
        break;
      }
    }
    this.stepWater(dt, now);
    this.stepTools(dt, now);
    this.stepFoam(now);
    this.stepBubbles(dt, now);
  }

  private stepWater(dt: number, now: number): void {
    const r = tubInside(this.level);
    const wet = this.level > TUB_FLOOR + 0.01;
    this.water.visible = wet;
    this.water.position.y = this.level;
    this.water.scale.set(r * TUB_X, 1, r * TUB_Z);
    this.waterMat.color.setHSL(0.54, 0.85, 0.78 + Math.sin(now * 2) * 0.02);
    const full = (this.level - TUB_FLOOR) / (WATER_TOP - TUB_FLOOR);
    for (const s of this.suds) {
      const a = s.userData.a as number;
      const rr = r * 0.9;
      s.visible = wet;
      s.position.set(Math.cos(a) * rr * TUB_X, this.level + 0.02, Math.sin(a) * rr * TUB_Z);
      s.scale.setScalar((s.userData.r as number) * Math.min(1, full * 1.4) * (1 + Math.sin(now * 2 + a * 3) * 0.08));
    }
    // The tap pours while filling.
    if (this.filling) {
      const tip = this.tap.tip;
      const len = Math.max(0.05, tip.y - this.level);
      this.stream.visible = true;
      this.stream.scale.set(1 + Math.sin(now * 40) * 0.1, len, 1 + Math.cos(now * 37) * 0.1);
      this.stream.position.set(tip.x, tip.y - len / 2, tip.z);
      if (Math.random() < dt * 8) this.ev.fx("splash", new THREE.Vector3(tip.x, this.level + 0.05, 0), 1);
    }
    // The duck bobs about on the water, or sits on the floor of an empty tub.
    const d = this.duck;
    const a = now * 0.25;
    d.position.set(-1.4 + Math.cos(a) * 0.1, Math.max(TUB_FLOOR, this.level - 0.07) + (wet ? Math.sin(now * 2.2) * 0.015 : 0), 0.42 + Math.sin(a) * 0.1);
    d.rotation.set(wet ? Math.sin(now * 1.7) * 0.06 : 0, -0.7 + Math.sin(a) * 0.3, wet ? Math.sin(now * 2.2) * 0.05 : 0);
    if (this.duckHop >= 0) {
      this.duckHop += dt;
      const k = Math.min(1, this.duckHop / 0.5);
      d.position.y += Math.sin(k * Math.PI) * 0.3;
      d.rotation.y += k * Math.PI * 2;
      if (k >= 1) {
        this.duckHop = -1;
        if (wet) this.ev.fx("splash", d.position.clone(), 4);
      }
    }
  }

  private stepTools(dt: number, now: number): void {
    const sh = this.showerHead;
    if (sh.visible) {
      const target = this.toolAt.clone();
      if (!this.spraying) target.y += Math.sin(now * 2) * 0.06;
      sh.position.lerp(target, Math.min(1, dt * 14));
      sh.rotation.z = Math.sin(now * 1.5) * 0.05 + (this.spraying ? 0 : 0.15);
    }
    const tw = this.towel;
    if (tw.visible) {
      const prev = tw.position.x;
      tw.position.lerp(this.toolAt, Math.min(1, dt * 16));
      tw.rotation.z = THREE.MathUtils.clamp((tw.position.x - prev) * 6, -0.5, 0.5);
      tw.rotation.y = Math.sin(now * 3) * 0.1;
    }
    // Drops from the shower fall, and splash where they land.
    for (const d of this.drops) {
      d.v.y -= dt * 9;
      d.m.position.addScaledVector(d.v, dt);
    }
    const landed = this.drops.filter((d) => d.m.position.y < Math.max(this.level, TUB_FLOOR));
    for (const d of landed) {
      this.group.remove(d.m);
      if (Math.random() < 0.15) this.ev.fx("splash", d.m.position.clone().setY(this.level + 0.02), 1);
    }
    if (landed.length) this.drops = this.drops.filter((d) => !landed.includes(d));
  }

  private spray(dt: number): void {
    const n = Math.min(4, Math.ceil(dt * 90));
    for (let i = 0; i < n && this.drops.length < 70; i++) {
      const m = new THREE.Mesh(this.dropGeo, this.dropMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.15;
      m.position.copy(this.showerHead.position).add(new THREE.Vector3(Math.cos(a) * r, -0.08, Math.sin(a) * r));
      this.group.add(m);
      this.drops.push({ m, v: new THREE.Vector3(Math.cos(a) * 0.5, -2.2 - Math.random(), Math.sin(a) * 0.5) });
    }
  }

  private stepFoam(now: number): void {
    for (const f of this.foams) f.obj.scale.setScalar(Math.max(0.0001, (0.05 + f.amount * 0.1) * (1 + Math.sin(now * 3 + f.obj.position.x * 20) * 0.06)));
    const gone = this.foams.filter((f) => f.amount <= 0);
    for (const f of gone) this.squishy.mesh.remove(f.obj);
    if (gone.length) this.foams = this.foams.filter((f) => f.amount > 0);
    this.spots.forEach((s, i) => {
      const m = this.mud[i];
      if (!m) return;
      const k = Math.max(0, s.left);
      m.scale.setScalar(Math.max(0.0001, 0.4 + 0.6 * k));
      for (const c of m.children) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.min(1, k * 1.6);
      m.visible = k > 0.03;
    });
  }

  /** Soap bubbles drift up while you scrub and rinse; tap them to pop. */
  private stepBubbles(dt: number, now: number): void {
    const busy = this.phase === "scrub" || this.phase === "rinse";
    if (busy && now > this.nextBubble && this.bubbles.length < 8) {
      this.nextBubble = now + 0.7 + Math.random() * 0.8;
      const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
      const s = 0.09 + Math.random() * 0.08;
      m.scale.setScalar(s);
      const side = Math.random() < 0.5 ? -1 : 1;
      m.position.set(side * (1.15 + Math.random() * 0.4), this.level + 0.1, 0.2 + Math.random() * 0.5);
      this.group.add(m);
      this.bubbles.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.35 + Math.random() * 0.2, 0.08), age: 0, life: 4 + Math.random() * 2 });
    }
    for (const b of this.bubbles) {
      b.age += dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.position.x += Math.sin(b.age * 2.5 + b.life) * dt * 0.15;
    }
    const gone = this.bubbles.filter((b) => b.age >= b.life);
    for (const b of gone) this.group.remove(b.m);
    if (gone.length) this.bubbles = this.bubbles.filter((b) => b.age < b.life);
  }
}
