// One squishy: the soft body you can squash, dent, jiggle and toss, its face,
// and how it reacts to everything. Springs drive all motion, so no two touches
// look quite the same.

import * as THREE from "three";
import { BOTTOM_Y, CENTER_Y, RINGS, SEG, SHAPES, buildFacePatch, buildGrid, faceRowTop, deform, restDeform, vid, type Deform } from "./bao";
import { drawFace, FACE_H, FACE_W, type Expression } from "./face";
import type { SquishyDef } from "./catalog";
import { feelFor, type Feel } from "./feel";
import { buildParts, type PartPin } from "./parts";
import { buildHat, hatFit, type HatCtx, type HatModel } from "./hatModels";
import { drawSkin, SKIN_H, SKIN_W } from "./skin";
import * as sfx from "./audio";
import { MOODS, type Mood } from "./personality";
import { FLY_PLANE_Z } from "./view";

class Spring {
  x = 0;
  v = 0;
  target = 0;
  constructor(
    public k: number,
    public c: number,
  ) {}
  step(dt: number): void {
    const a = this.k * (this.target - this.x) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }
}

export type Fx = "heart" | "sparkle" | "star" | "zz" | "note" | "glimmer" | "splash";

export interface Bounds {
  minX: number;
  maxX: number;
  maxY: number;
  floorY: number;
}

export interface SquishyEvents {
  fx(kind: Fx, at: THREE.Vector3, count?: number): void;
  love(amount: number): void;
  /** The squishy did one of the starter actions (for the hint bar). */
  did(action: "tap" | "hold" | "pet" | "flick" | "tickle" | "hug"): void;
}

/** How high the bun's middle sits above its resting surface. */
const LIFT = -BOTTOM_Y;
const FLY_Z = FLY_PLANE_Z;
const GRAVITY = 15;
const RADIUS = 1.05;

type Mode = "home" | "fly" | "dizzy" | "return";

/** An extra (ears, wings, a hat) riding on the surface at one vertex. */
interface Pinned {
  pin: PartPin;
  holder: THREE.Object3D;
  v: number;
}

/** Extras that sit on top of the head; a hat takes their place. */
const HEAD_PARTS = new Set(["witchHat", "stem", "leaf", "catEars"]);

/** The hat: it lags and wobbles behind every hop, and pops up when tapped. */
interface HatRig {
  id: string;
  model: HatModel;
  /** Rides on the head: sits on `ring`, the row of the body where the hat's rim meets it. */
  seat: THREE.Group;
  ring: number;
  /** The ring's width now against at rest: a squashed, wider head makes the hat a little wider too. */
  restR: number;
  wide: number;
  /** Wobbles about x and z, stretch in y. */
  wob: THREE.Group;
  /** Lifts and spins when popped. */
  pop: THREE.Group;
  wx: Spring;
  wz: Spring;
  wy: Spring;
  popH: number;
  popV: number;
  spin: number;
  spinV: number;
  last: THREE.Vector3;
  lastV: THREE.Vector3;
  fresh: boolean;
}

const REF = {
  forward: new THREE.Vector3(0, 0, 1),
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0),
};

/** A finger on the squishy: the dent sits right under it and follows it. */
interface Finger {
  dir: THREE.Vector3;
  depth: Spring;
  t0: number;
  live: boolean;
  sliding: boolean;
  slow: boolean;
}

export class Squishy {
  readonly group = new THREE.Group(); // moves around the world
  private body = new THREE.Group(); // rotates about the bottom
  readonly mesh: THREE.Mesh;
  private face: THREE.Mesh;
  private grid = buildGrid();
  private patch = buildFacePatch();
  private faceRow1 = -1;
  private pos: Float32Array;
  private geo: THREE.BufferGeometry;
  private faceGeo: THREE.BufferGeometry;
  private faceCanvas: HTMLCanvasElement;
  private faceCtx: CanvasRenderingContext2D;
  private faceTex: THREE.CanvasTexture;
  private material!: THREE.MeshPhysicalMaterial;
  private time = { value: 0 };
  private skinCanvas: HTMLCanvasElement | null = null;
  private skinTex: THREE.CanvasTexture | null = null;
  private partsGroup = new THREE.Group();
  private pinned: Pinned[] = [];
  private hat: HatRig | null = null;
  private hatId: string | null = null;
  /** Falls asleep by itself after a while with nobody playing. */
  autoSleep = true;
  /**
   * How much plain squash may be shown by scaling the resting shape instead of
   * reshaping every vertex. Friends far away can take a lot; the one you hold
   * only a breath's worth, so its hat never looks stretched.
   */
  cheapSquash = 0.08;
  /** The geometry holds the plain resting shape (no dents, waves or lean). */
  private atRest = false;
  /** Who it is inside: how it fidgets, naps, hops and sounds. */
  mood: Mood = MOODS[0];
  /** Which way it faces (radians about up); friends turn to look at things. */
  yawTarget = 0;
  private yaw = 0;
  private retHops = 3;
  private retTime = 0.48;
  private retHeight = 0.55;
  private retQuiet = false;
  private retThen: (() => void) | null = null;
  private glow = false;
  def!: SquishyDef;
  private feel: Feel = feelFor(0.5);

  private d: Deform = restDeform();
  private squash = new Spring(150, 7);
  private dent = new Spring(160, 13);
  private dentDir = new THREE.Vector3(0, 0, 1);
  private leanX = new Spring(80, 7);
  private leanZ = new Spring(80, 7);
  private melt = new Spring(70, 9);
  private turn = new Spring(55, 6);
  private tilt = new Spring(45, 7);
  private hopY = 0;
  private hopV = 0;

  private mode: Mode = "home";
  readonly home = new THREE.Vector3();
  /** The basket it sits in at home: inside radius and the world height of its rim. */
  readonly basket = { r: 0, top: 0 };
  private vel = new THREE.Vector3();
  private spin = 0;
  private restTime = 0;
  private modeTime = 0;
  private returnFrom = new THREE.Vector3();
  private grounded = false;

  private pressing = false;
  private slowRise = 0;
  private hugging = false;
  private sleeping = false;
  private idleFor = 0;
  private nextFidget = 6;
  private nextBlink = 2;
  private blinkT = -1;
  private fingers = new Map<number, Finger>();
  private exprOverride: Expression | null = null;
  private exprUntil = 0;
  private talk = 0;
  private lookX = 0;
  private lookY = 0;
  private lookTX = 0;
  private lookTY = 0;
  private faceKey = "";
  private tickles: number[] = [];
  private lastPurr = 0;
  private strokeLove = 0;
  private now = 0;
  private zzAt = 0;

  constructor(
    def: SquishyDef,
    private ev: SquishyEvents,
  ) {
    this.pos = new Float32Array(this.grid.count * 3);
    deform(this.grid, this.d, this.pos);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(this.grid.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("uv", new THREE.BufferAttribute(this.grid.uv, 2));
    this.geo.setIndex(new THREE.BufferAttribute(this.grid.index, 1));
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshPhysicalMaterial());
    this.mesh.castShadow = false;

    this.faceCanvas = document.createElement("canvas");
    this.faceCanvas.width = FACE_W;
    this.faceCanvas.height = FACE_H;
    this.faceCtx = this.faceCanvas.getContext("2d")!;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = 4;
    this.faceGeo = new THREE.BufferGeometry();
    this.fillFaceGeo();
    this.face = new THREE.Mesh(
      this.faceGeo,
      new THREE.MeshStandardMaterial({
        map: this.faceTex,
        transparent: true,
        roughness: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    this.face.renderOrder = 2;
    this.body.add(this.mesh, this.face, this.partsGroup);
    this.body.position.y = BOTTOM_Y; // pivot at the bottom
    this.mesh.position.y = -BOTTOM_Y;
    this.face.position.y = -BOTTOM_Y;
    this.partsGroup.position.y = -BOTTOM_Y;
    this.group.add(this.body);
    this.setDesign(def);
  }

  private fillFaceGeo(): void {
    const n = this.patch.count;
    if (this.face) {
      // A new size of face: swap in fresh buffers rather than resizing live ones.
      this.faceGeo.dispose();
      this.faceGeo = new THREE.BufferGeometry();
      this.face.geometry = this.faceGeo;
    }
    this.faceGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.faceGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.faceGeo.setAttribute("uv", new THREE.BufferAttribute(this.patch.uv, 2));
    this.faceGeo.setIndex(new THREE.BufferAttribute(this.patch.index, 1));
  }

  /** Puts on a hat, or takes it off with null. */
  setHat(id: string | null): void {
    if (id === this.hatId) return;
    this.hatId = id;
    this.setDesign(this.def);
  }

  get hatOn(): string | null {
    return this.hatId;
  }

  /** Becomes another squishy: its body shape, skin, extras, face, finish and feel. */
  setDesign(def: SquishyDef, hat: string | null = this.hatId): void {
    this.hatId = hat;
    this.def = def;
    this.feel = feelFor(def.soft);
    this.grid = buildGrid(SHAPES[def.body]);
    deform(this.grid, this.d, this.pos);
    this.atRest = false;
    const row1 = faceRowTop(SHAPES[def.body]);
    if (row1 !== this.faceRow1) {
      this.faceRow1 = row1;
      this.patch = buildFacePatch(row1);
      this.fillFaceGeo();
    }

    // Skin: one color, or a painted wrap for candy corn, mummies and pudding.
    let map: THREE.Texture | null = null;
    if (def.skin.kind !== "plain") {
      if (!this.skinCanvas) {
        this.skinCanvas = document.createElement("canvas");
        this.skinCanvas.width = SKIN_W;
        this.skinCanvas.height = SKIN_H;
        this.skinTex = new THREE.CanvasTexture(this.skinCanvas);
        this.skinTex.colorSpace = THREE.SRGBColorSpace;
        this.skinTex.anisotropy = 4;
      }
      drawSkin(this.skinCanvas.getContext("2d")!, def.color, def.skin);
      this.skinTex!.needsUpdate = true;
      map = this.skinTex;
    }
    const base: THREE.MeshPhysicalMaterialParameters = {
      color: map ? new THREE.Color(0xffffff) : new THREE.Color(def.color),
      map,
      roughness: 0.5,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
    };
    const f = def.finish;
    if (f === "matte") Object.assign(base, { roughness: 0.68, clearcoat: 0.2, clearcoatRoughness: 0.5 });
    if (f === "shiny") Object.assign(base, { roughness: 0.4, clearcoat: 0.85, clearcoatRoughness: 0.14 });
    if (f === "glitter") Object.assign(base, { roughness: 0.45, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.35 });
    if (f === "gold") Object.assign(base, { roughness: 0.38, metalness: 0.7, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.2 });
    if (f === "glow") Object.assign(base, { roughness: 0.55, clearcoat: 0.4, emissive: new THREE.Color(def.glow ?? def.color), emissiveIntensity: 0.4 });
    this.glow = f === "glow";
    this.material?.dispose();
    const m = new THREE.MeshPhysicalMaterial(base);
    if (f === "glitter" || f === "gold") addGlitter(m, this.time, new THREE.Color(def.sparkle ?? "#ffffff"));
    this.material = m;
    this.mesh.material = m;

    // Extras, each pinned to the vertex nearest where it belongs.
    for (const p of this.pinned) disposeTree(p.holder);
    if (this.hat) disposeTree(this.hat.seat);
    this.partsGroup.clear();
    this.pinned = [];
    this.hat = null;
    const g = this.grid.dir;
    const model = hat ? buildHat(hat) : null;
    const pins = buildParts(model ? def.parts.filter((p) => !HEAD_PARTS.has(p)) : def.parts, def.color);
    if (model) {
      const wob = new THREE.Group();
      const pop = new THREE.Group();
      // Sized to this head: the rim sits where the body is as wide as the hat's opening.
      const fit = hatFit(hat!);
      const k = fit.r / fit.fit;
      model.obj.scale.multiply(new THREE.Vector3(k, k * (fit.sy ?? 1), k));
      pop.add(model.obj);
      wob.add(pop);
      const seat = new THREE.Group();
      seat.add(wob);
      this.partsGroup.add(seat);
      const ring = ringAt(this.grid.base, fit.r);
      this.hat = {
        id: hat!,
        model,
        seat,
        ring,
        restR: ringRadius(this.grid.base, ring),
        wide: 1,
        wob,
        pop,
        wx: new Spring(150, 8),
        wz: new Spring(150, 8),
        wy: new Spring(260, 10),
        popH: 0,
        popV: 0,
        spin: 0,
        spinV: 0,
        last: new THREE.Vector3(),
        lastV: new THREE.Vector3(),
        fresh: true,
      };
    }
    for (const pin of pins) {
      let best = 0;
      let bestDot = -2;
      for (let k = 0; k < this.grid.count; k++) {
        const dot = g[k * 3] * pin.dir.x + g[k * 3 + 1] * pin.dir.y + g[k * 3 + 2] * pin.dir.z;
        if (dot > bestDot) {
          bestDot = dot;
          best = k;
        }
      }
      const holder = new THREE.Group();
      holder.add(pin.obj);
      this.partsGroup.add(holder);
      this.pinned.push({ pin, holder, v: best });
    }
    this.faceKey = "";
  }

  /** Babies have little high voices. */
  voiceMul = 1;

  get pitch(): number {
    return this.def.pitch * this.mood.voice * this.voiceMul;
  }

  get isHome(): boolean {
    return this.mode === "home";
  }

  get isHugging(): boolean {
    return this.hugging;
  }

  get isSleeping(): boolean {
    return this.sleeping;
  }

  // ---- things friends do by themselves ------------------------------------

  /** Hops over to a spot, a few hops at a time, turning to face the way it goes. */
  hopTo(target: THREE.Vector3, opts: { height?: number; then?: () => void } = {}): void {
    if (this.mode === "fly" || this.mode === "dizzy") return;
    const from = this.mode === "home" ? this.home : this.group.position;
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const dist = Math.hypot(dx, dz);
    this.returnFrom.copy(this.group.position);
    this.home.copy(target);
    this.retHops = Math.max(1, Math.round(dist / 0.85));
    this.retTime = 0.42;
    this.retHeight = opts.height ?? 0.4;
    this.retQuiet = true;
    this.retThen = opts.then ?? null;
    if (dist > 0.2) this.yawTarget = Math.atan2(dx, dz);
    this.mode = "return";
    this.modeTime = 0;
    this.sleeping = false;
    this.idleFor = 0;
  }

  /** Turns to face a way at once. */
  faceNow(yaw: number): void {
    this.yaw = this.yawTarget = yaw;
  }

  /** Puts it straight down at a spot, standing still. */
  placeAt(at: THREE.Vector3): void {
    this.mode = "home";
    this.home.copy(at);
    this.group.position.copy(at);
    this.retThen = null;
    this.retQuiet = false;
  }

  /** A happy little bounce on the spot. */
  bounce(v = 3.4): void {
    this.hop(v);
  }

  wiggle(): void {
    this.turn.v += (Math.random() < 0.5 ? -1 : 1) * 4;
    this.squash.v += 0.8;
  }

  /** Leans toward something (x right, z forward), 0 to stand up straight. */
  lean(x: number, z: number): void {
    this.leanX.target = x;
    this.leanZ.target = z;
  }

  express(e: Expression, seconds: number, talk = 0): void {
    this.setExpr(e, seconds);
    if (talk) this.talk = talk;
  }

  /** Dozes off right now (to cuddle, or nap in the sun). */
  nap(): void {
    if (this.sleeping) return;
    this.setExpr("sleepy", 0.8);
    sfx.yawn(this.pitch);
    this.sleeping = true;
    this.zzAt = this.now + 1;
  }

  wakeUp(): void {
    if (this.sleeping) this.wake();
    this.idleFor = 0;
  }

  /** How bouncy it is right now, for hats and effects. */
  get energy(): number {
    return Math.min(1, (Math.abs(this.hopV) + Math.abs(this.squash.v) * 0.6 + this.vel.length() * 0.25 + Math.abs(this.turn.v) * 0.15) / 6);
  }

  /** True if the ray hits the hat. */
  hatHit(ray: THREE.Raycaster): boolean {
    return !!this.hat && ray.intersectObject(this.hat.wob, true).length > 0;
  }

  /** Tapped on the hat: it pops up, spins and lands back. */
  popHat(): void {
    const h = this.hat;
    if (!h || h.popH > 0.02) return;
    h.popV = 3.4;
    h.spinV = Math.PI * 2 / 0.45;
    this.squash.v += 1.2;
    this.setExpr("surprised", 0.3);
    setTimeout(() => this.setExpr("happy", 0.9), 300);
    sfx.boing(this.pitch * 1.25);
    this.ev.fx("sparkle", this.hatTop(), 4);
    this.ev.love(1);
  }

  /** World point at the top of the hat, or the head. */
  hatTop(out = new THREE.Vector3()): THREE.Vector3 {
    if (!this.hat) return this.topPoint(out);
    return this.hat.wob.getWorldPosition(out).add(new THREE.Vector3(0, 0.3 * this.group.scale.y, 0));
  }

  giveLove(n: number): void {
    this.ev.love(n);
  }

  /** World position of a point on the squishy's front, for effects. */
  topPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.group.localToWorld(out.set(0, 0.95 - this.squash.x * 0.6 + this.hopY, 0.2));
  }

  // ---- touches -------------------------------------------------------

  /**
   * The rest-shape direction of the surface spot a ray hit, from the hit triangle.
   * Dents are placed by rest direction, so this stays under the finger however squished it is.
   */
  dirAtHit(hit: THREE.Intersection): THREE.Vector3 {
    const f = hit.face;
    if (!f) return this.localDir(hit.point);
    const bc = (hit as THREE.Intersection & { barycoord?: THREE.Vector3 }).barycoord ?? new THREE.Vector3(1 / 3, 1 / 3, 1 / 3);
    const g = this.grid.dir;
    const out = new THREE.Vector3();
    for (const [i, w] of [[f.a, bc.x], [f.b, bc.y], [f.c, bc.z]] as const) {
      out.x += g[i * 3] * w;
      out.y += g[i * 3 + 1] * w;
      out.z += g[i * 3 + 2] * w;
    }
    return out.normalize();
  }

  /** A finger lands on the squishy: it pushes in right there at once. */
  fingerDown(id: number, dir: THREE.Vector3): void {
    if (this.mode !== "home") return;
    this.interacted();
    const depth = new Spring(this.feel.dentK, this.feel.dentC);
    // Land with a quick push so the dent shows at once.
    depth.v = 3.2 * (this.feel.dentStart / 0.16);
    this.fingers.set(id, { dir: dir.clone(), depth, t0: this.now, live: true, sliding: false, slow: false });
  }

  /** The finger moves: the dent slides along under it. */
  fingerMove(id: number, dir: THREE.Vector3, sliding: boolean): void {
    const f = this.fingers.get(id);
    if (!f || !f.live) return;
    f.dir.lerp(dir, 0.7).normalize();
    f.sliding = sliding;
  }

  /** The finger lifts: the dent springs back, slowly after a long squish. */
  fingerUp(id: number): void {
    const f = this.fingers.get(id);
    if (!f || !f.live) return;
    f.live = false;
    const held = this.now - f.t0;
    f.slow = held > 0.45 && !f.sliding;
    if (f.slow) {
      f.depth.k = this.feel.riseK;
      f.depth.c = this.feel.riseC;
    } else {
      this.d.waves.push({ x: f.dir.x, y: f.dir.y, z: f.dir.z, age: 0, amp: this.feel.wave });
    }
  }

  private releaseFingers(): void {
    for (const id of this.fingers.keys()) this.fingerUp(id);
  }

  private stepFingers(dt: number): void {
    for (const [id, f] of this.fingers) {
      if (f.live) {
        const k = Math.min(1, (this.now - f.t0) / 0.9);
        // A sliding finger presses lightly; a still one sinks in deeper the longer it stays.
        f.depth.target = f.sliding ? this.feel.slide : this.feel.dentStart + (this.feel.dentMax - this.feel.dentStart) * k;
      } else {
        f.depth.target = 0;
      }
      const before = f.depth.x;
      f.depth.step(dt);
      if (!f.live && f.slow && before > 0.03 && f.depth.x <= 0.03) {
        this.d.waves.push({ x: f.dir.x, y: f.dir.y, z: f.dir.z, age: 0, amp: this.feel.wave * 0.7 });
      }
      if (!f.live && Math.abs(f.depth.x) < 0.002 && Math.abs(f.depth.v) < 0.02) this.fingers.delete(id);
    }
  }

  /** Direction from the body center to a world hit point, in body space. */
  localDir(hit: THREE.Vector3): THREE.Vector3 {
    const p = this.mesh.worldToLocal(hit.clone());
    p.y -= CENTER_Y;
    return p.normalize();
  }

  private interacted(): boolean {
    this.idleFor = 0;
    if (this.sleeping) {
      this.wake();
      return true;
    }
    return false;
  }

  touch(): void {
    if (this.interacted()) return;
  }

  tap(dir: THREE.Vector3): void {
    if (this.mode !== "home") return;
    if (this.interacted()) return;
    // The spot between the mouth and eyes is the nose: boop it!
    const nose = dir.z > 0.9 && Math.abs(dir.x) < 0.2 && dir.y > -0.35 && dir.y < 0.15;
    this.d.waves.push({ x: dir.x, y: dir.y, z: dir.z, age: 0, amp: 0.07 });
    this.squash.v += 0.8;
    if (nose) {
      this.setExpr("surprised", 0.3);
      setTimeout(() => this.setExpr("happy", 0.9), 300);
      this.hop(4.2);
      sfx.boing(this.pitch);
      this.ev.love(3);
      this.ev.fx("sparkle", this.topPoint(), 5);
    } else {
      this.setExpr(Math.random() < 0.5 ? "surprised" : "squeeze", 0.25);
      setTimeout(() => this.setExpr(Math.random() < 0.4 ? this.mood.face : "happy", 0.6), 260);
      sfx.squeak(this.pitch * (0.95 + Math.random() * 0.15), 0.12, 0.3);
      this.ev.love(1);
    }
    this.talk = 0.8;
    sfx.vibrate(10);
    this.ev.did("tap");
  }

  pressStart(dir: THREE.Vector3): void {
    if (this.mode !== "home") return;
    this.interacted();
    this.pressing = true;
    this.slowRise = 0;
    this.dentDir.copy(dir);
    sfx.squeak(this.pitch * 0.8, 0.22, 0.3);
    sfx.vibrate(15);
  }

  pressHold(held: number): void {
    if (!this.pressing) return;
    const k = Math.min(1, (held - 0.15) / 0.8);
    // The dent under each finger does most of the squish; the whole bun gives a little.
    this.squash.target = 0.05 + (this.feel.squashMax - 0.05) * k;
    this.setExpr("squeeze", 0.2);
    if (held > 0.6) this.ev.did("hold");
  }

  pressEnd(held: number): void {
    if (!this.pressing) return;
    this.pressing = false;
    this.squash.target = 0;
    this.dent.target = 0;
    // A long squish rises back slowly, like a real slow-rise squishy.
    this.slowRise = held > 0.45 ? this.feel.riseTime : 0;
    if (this.slowRise > 0) sfx.sigh(this.pitch);
    else sfx.squeak(this.pitch * 1.1, 0.1, 0.25);
    this.setExpr("happy", 1.2);
    this.ev.love(held > 0.45 ? 4 : 2);
    this.ev.fx("heart", this.topPoint(), held > 0.45 ? 3 : 1);
  }

  /** A stroke across the squishy, in screen pixels. */
  stroke(dx: number, dy: number, speed: number): void {
    if (this.mode !== "home" || this.hugging) return;
    if (this.interacted()) return;
    this.leanX.target = Math.max(-0.28, Math.min(0.28, this.leanX.target + dx * 0.004));
    this.leanZ.target = Math.max(-0.15, Math.min(0.15, this.leanZ.target + dy * 0.002));
    this.turn.v += dx * 0.004;
    if (speed < 2200) {
      this.setExpr("happy", 0.5);
      if (this.now - this.lastPurr > 0.55) {
        this.lastPurr = this.now;
        sfx.purr(0.6);
      }
      this.strokeLove += Math.hypot(dx, dy);
      if (this.strokeLove > 140) {
        this.strokeLove = 0;
        this.ev.love(2);
        this.ev.fx("heart", this.topPoint(), 1);
        this.ev.did("pet");
      }
    }
  }

  dragEnd(): void {
    this.leanX.target = 0;
    this.leanZ.target = 0;
  }

  tickle(): void {
    if (this.mode !== "home") return;
    if (this.interacted()) return;
    this.tickles = this.tickles.filter((t) => this.now - t < 2.2);
    this.tickles.push(this.now);
    this.setExpr("giggle", 0.9);
    sfx.giggle(this.pitch);
    this.turn.v += (Math.random() < 0.5 ? -1 : 1) * 5;
    this.squash.v += 1.2;
    this.ev.love(3);
    this.ev.did("tickle");
    if (this.tickles.length >= 3) {
      // Too ticklish: it rolls right over.
      this.tickles = [];
      this.tilt.target -= Math.PI * 2;
      this.hop(5.2);
      this.ev.fx("note", this.topPoint(), 3);
    }
  }

  /** Toss with a velocity in world units per second (x right, y up). */
  flick(vx: number, vy: number): void {
    if (this.mode !== "home") return;
    this.interacted();
    this.pressing = false;
    this.releaseFingers();
    this.squash.target = 0;
    this.dent.target = 0;
    this.leanX.target = 0;
    this.leanZ.target = 0;
    const s = Math.min(1, 15 / Math.hypot(vx, vy));
    this.vel.set(vx * s, Math.max(6, vy * s), 0);
    this.spin = -this.vel.x * 0.9;
    this.mode = "fly";
    this.modeTime = 0;
    this.grounded = false;
    this.retQuiet = false;
    this.retHops = 3;
    this.retTime = 0.48;
    this.retHeight = 0.55;
    this.retThen = null;
    this.squash.v -= 3; // stretch as it leaves
    this.setExpr("surprised", 0.8);
    sfx.whoosh();
    sfx.squeak(this.pitch * 1.3, 0.2, 0.3);
    this.ev.did("flick");
  }

  hugStart(): void {
    if (this.mode !== "home") return;
    this.interacted();
    this.hugging = true;
    this.pressing = false;
    this.melt.target = 0.08;
    this.squash.target = 0.1;
    this.dent.target = 0;
    sfx.squeak(this.pitch * 0.9, 0.3, 0.25);
    this.ev.did("hug");
  }

  hugEnd(): void {
    if (!this.hugging) return;
    this.hugging = false;
    this.melt.target = 0;
    this.squash.target = 0;
    this.setExpr("happy", 1.2);
    this.hop(3.2);
  }

  /** Pops out of a just-opened box: a big surprised hop, then happy. */
  popIn(): void {
    this.mode = "home";
    this.sleeping = false;
    this.idleFor = 0;
    this.setExpr("surprised", 0.45);
    setTimeout(() => this.setExpr("happy", 1.4), 450);
    this.hopY = 0;
    this.hopV = 0;
    this.hop(5.5);
    this.talk = 1;
    sfx.boing(this.pitch);
    sfx.squeak(this.pitch * 1.2, 0.18, 0.32);
  }

  /** A little hello hop when picked from the shelf. */
  hello(): void {
    this.setExpr("happy", 1);
    this.hop(4);
    this.talk = 0.8;
    sfx.squeak(this.pitch * 1.1, 0.14, 0.28);
  }

  lookAt(nx: number, ny: number): void {
    this.lookTX = Math.max(-1, Math.min(1, nx));
    this.lookTY = Math.max(-1, Math.min(1, ny));
  }

  private wake(): void {
    this.sleeping = false;
    this.setExpr("surprised", 0.5);
    setTimeout(() => {
      this.setExpr("happy", 1);
      this.hop(4);
      sfx.squeak(this.pitch * 1.15, 0.14, 0.28);
    }, 450);
  }

  private hop(v: number): void {
    if (this.hopY > 0.01) return;
    this.squash.v += 2; // crouch first
    setTimeout(() => {
      this.hopV = v * (0.7 + this.mood.hop * 0.3);
      this.squash.v -= 2.5;
    }, 90);
  }

  private setExpr(e: Expression, seconds: number): void {
    this.exprOverride = e;
    this.exprUntil = this.now + seconds;
  }

  // ---- every frame ---------------------------------------------------

  /** `geometry` false skips reshaping the body this frame (for friends far away). */
  update(dt: number, now: number, bounds: Bounds, geometry = true): void {
    this.now = now;
    this.time.value = now;
    this.frameDt = dt;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) this.stepPhysics(h, bounds);
    this.stepIdle(dt);
    this.stepFace(dt);
    this.rebuild(geometry);
  }
  private frameDt = 1 / 60;

  private stepPhysics(dt: number, b: Bounds): void {
    // Slow rise: very damped until it has nearly puffed back up.
    if (this.slowRise > 0) {
      this.slowRise -= dt;
      this.squash.c = 26;
      this.dent.c = 30;
      this.squash.k = this.feel.riseK * 2.5;
      this.dent.k = 40;
      if (this.slowRise <= 0) {
        this.squash.v -= 0.6;
        this.d.waves.push({ x: this.dentDir.x, y: this.dentDir.y, z: this.dentDir.z, age: 0, amp: 0.035 });
      }
    } else {
      this.squash.c = this.feel.bodyC;
      this.dent.c = 13;
      this.squash.k = this.feel.bodyK;
      this.dent.k = 160;
    }
    const breath = this.sleeping ? Math.sin(this.now * 1.3) * 0.03 : Math.sin(this.now * 2.2) * 0.012;
    const keep = this.squash.target;
    this.squash.target = keep + (this.mode === "home" && !this.pressing ? breath : 0);
    for (const sp of [this.squash, this.dent, this.leanX, this.leanZ, this.melt, this.turn]) sp.step(dt);
    this.stepFingers(dt);
    this.squash.target = keep;
    if (this.mode !== "fly") this.tilt.step(dt);
    // Hop
    if (this.hopY > 0 || this.hopV !== 0) {
      this.hopV -= GRAVITY * dt;
      this.hopY += this.hopV * dt;
      if (this.hopY <= 0) {
        const impact = -this.hopV;
        this.hopY = 0;
        this.hopV = 0;
        this.squash.v += Math.min(5, impact * 0.9);
        if (impact > 2) sfx.thud(impact / 8);
      }
    }
    for (const w of this.d.waves) w.age += dt;
    this.d.waves = this.d.waves.filter((w) => w.age < 1.6);

    switch (this.mode) {
      case "fly":
        this.fly(dt, b);
        break;
      case "dizzy":
        this.modeTime += dt;
        if (this.modeTime > 1.8) {
          this.mode = "return";
          this.modeTime = 0;
          this.returnFrom.copy(this.group.position);
          this.setExpr("happy", 0.6);
        }
        break;
      case "return": {
        this.modeTime += dt;
        const hops = this.retHops;
        const hopTime = this.retTime;
        const total = hops * hopTime;
        const t = Math.min(1, this.modeTime / total);
        const k = Math.min(hops - 1, Math.floor(this.modeTime / hopTime));
        const local = (this.modeTime - k * hopTime) / hopTime;
        const prevK = Math.min(hops - 1, Math.floor((this.modeTime - dt) / hopTime));
        if (k !== prevK || t >= 1) {
          this.squash.v += 3.4;
          if (!this.retQuiet) sfx.squeak(this.pitch * (1 + 0.08 * k), 0.08, 0.2);
        }
        const p = this.group.position;
        p.x = THREE.MathUtils.lerp(this.returnFrom.x, this.home.x, t);
        p.z = THREE.MathUtils.lerp(this.returnFrom.z, this.home.z, t);
        const baseY = THREE.MathUtils.lerp(this.returnFrom.y, this.home.y, t);
        p.y = baseY + (t >= 1 ? 0 : Math.sin(Math.PI * local) * (this.retHeight + (this.retQuiet ? 0 : 0.35) * (k === hops - 1 ? 1 : 0)));
        if (t >= 1) {
          p.copy(this.home);
          this.mode = "home";
          if (!this.retQuiet) {
            this.setExpr("happy", 1);
            this.ev.fx("sparkle", this.topPoint(), 4);
            this.ev.love(2);
          }
          const then = this.retThen;
          this.retThen = null;
          this.retQuiet = false;
          this.retHops = 3;
          this.retTime = 0.48;
          this.retHeight = 0.55;
          then?.();
        }
        break;
      }
    }
  }

  private fly(dt: number, b: Bounds): void {
    const p = this.group.position;
    this.modeTime += dt;
    p.z += (FLY_Z - p.z) * Math.min(1, dt * 6);
    this.vel.y -= GRAVITY * dt;
    p.addScaledVector(this.vel, dt);
    this.tilt.x += this.spin * dt;
    const sideHit = (dir: number) => {
      this.vel.x = -this.vel.x * 0.62;
      this.spin = -this.spin * 0.5;
      this.leanX.v += dir * 4;
      this.d.waves.push({ x: -dir, y: 0, z: 0, age: 0, amp: 0.06 });
      sfx.squeak(this.pitch * 1.1, 0.09, 0.25);
      sfx.vibrate(12);
    };
    if (p.x - RADIUS < b.minX) {
      p.x = b.minX + RADIUS;
      if (this.vel.x < 0) sideHit(1);
    }
    if (p.x + RADIUS > b.maxX) {
      p.x = b.maxX - RADIUS;
      if (this.vel.x > 0) sideHit(-1);
    }
    if (p.y + 1.0 > b.maxY && this.vel.y > 0) {
      p.y = b.maxY - 1.0;
      this.vel.y = -this.vel.y * 0.4;
      this.squash.v += 2;
    }
    const floor = b.floorY + LIFT;
    if (p.y <= floor) {
      p.y = floor;
      const impact = -this.vel.y;
      if (impact > 1.6) {
        this.vel.y = impact * 0.48;
        this.vel.x *= 0.8;
        this.spin *= 0.45;
        this.squash.v += Math.min(7, impact * 0.75);
        this.d.waves.push({ x: 0, y: -1, z: 0, age: 0, amp: 0.05 });
        sfx.thud(impact / 9);
        sfx.squeak(this.pitch * (0.9 + Math.random() * 0.2), 0.1, Math.min(0.35, impact * 0.04));
        sfx.vibrate(18);
        this.grounded = false;
      } else {
        this.vel.y = 0;
        this.vel.x *= Math.pow(0.02, dt);
        this.spin *= Math.pow(0.02, dt);
        this.grounded = true;
      }
    }
    if (this.grounded && Math.abs(this.vel.x) < 0.25) this.restTime += dt;
    else this.restTime = 0;
    if (this.restTime > 0.35 || this.modeTime > 6) {
      this.mode = "dizzy";
      this.modeTime = 0;
      this.restTime = 0;
      this.vel.set(0, 0, 0);
      this.spin = 0;
      p.y = floor;
      // Settle upright from any roll, the short way round.
      this.tilt.target = Math.round(this.tilt.x / (Math.PI * 2)) * Math.PI * 2;
      this.setExpr("dizzy", 1.6);
      this.ev.fx("star", this.topPoint(), 5);
      sfx.boing(this.pitch * 0.8);
    }
  }

  private stepIdle(dt: number): void {
    if (this.pressing || this.hugging || this.fingers.size > 0 || this.mode !== "home") {
      this.idleFor = 0;
      return;
    }
    this.idleFor += dt;
    if (this.sleeping) {
      if (this.now > this.zzAt) {
        this.zzAt = this.now + 1.7;
        this.ev.fx("zz", this.topPoint());
      }
      return;
    }
    if (!this.autoSleep) {
      this.idleFor = Math.min(this.idleFor, 20);
    } else if (this.idleFor > this.mood.sleepAfter && this.idleFor - dt <= this.mood.sleepAfter) {
      this.setExpr("sleepy", 1.6);
      this.talk = 1;
      sfx.yawn(this.pitch);
    }
    if (this.autoSleep && this.idleFor > this.mood.sleepAfter + 2) {
      this.sleeping = true;
      this.zzAt = this.now + 0.5;
      return;
    }
    this.nextFidget -= dt;
    if (this.nextFidget <= 0) {
      this.nextFidget = this.mood.fidget * (1 + Math.random());
      const r = Math.random();
      if (r < 0.3) this.quirk();
      else if (r < 0.5) this.turn.v += (Math.random() < 0.5 ? -1 : 1) * 3.5;
      else if (r < 0.6) {
        this.hop(3.4);
        sfx.squeak(this.pitch * 1.2, 0.07, 0.15);
      } else {
        this.lookTX = Math.random() * 2 - 1;
        this.lookTY = Math.random() - 0.5;
      }
    }
  }

  /** Does the little thing that shows who it is. */
  quirk(): void {
    const m = this.mood;
    this.setExpr(m.face, 1.4);
    switch (m.quirk) {
      case "bounce":
        this.hop(4);
        setTimeout(() => this.hop(3.6), 520);
        sfx.squeak(this.pitch * 1.25, 0.07, 0.15);
        break;
      case "spin":
        this.turn.v += (Math.random() < 0.5 ? -1 : 1) * 9;
        this.hop(3.4);
        sfx.giggle(this.pitch);
        break;
      case "sing":
        this.talk = 1;
        sfx.hum(this.pitch);
        this.ev.fx("note", this.topPoint(), 2);
        break;
      case "look":
        this.lookTX = Math.random() < 0.5 ? -1 : 1;
        this.lookTY = 0.4;
        setTimeout(() => (this.lookTX = -this.lookTX), 700);
        sfx.squeak(this.pitch * 1.3, 0.06, 0.12);
        break;
      case "stretch":
        this.squash.v -= 3;
        this.talk = 1;
        sfx.yawn(this.pitch);
        break;
      case "wiggle":
        this.wiggle();
        setTimeout(() => this.wiggle(), 260);
        break;
      case "blush":
        this.lookTY = -0.6;
        this.squash.v += 1.2;
        break;
      case "pout":
        this.turn.v += (Math.random() < 0.5 ? -1 : 1) * 2.5;
        sfx.sigh(this.pitch);
        break;
      case "puff":
        this.squash.v -= 4;
        this.hop(3.8);
        break;
      case "dream":
        this.lookTY = 1;
        this.ev.fx("glimmer", this.topPoint(), 3);
        break;
    }
  }

  private stepFace(dt: number): void {
    // Blinks
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.nextBlink = 2.2 + Math.random() * 3.2;
      this.blinkT = 0;
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      blink = Math.sin(Math.min(1, this.blinkT / 0.16) * Math.PI);
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    this.lookX += (this.lookTX - this.lookX) * Math.min(1, dt * 8);
    this.lookY += (this.lookTY - this.lookY) * Math.min(1, dt * 8);
    this.talk = Math.max(0, this.talk - dt * 2.5);
    if (this.exprOverride && this.now > this.exprUntil) this.exprOverride = null;
    const expr: Expression = this.exprOverride ?? (this.sleeping ? "closed" : this.mode === "dizzy" ? "dizzy" : "open");
    const key = `${expr}|${Math.round(this.lookX * 12)}|${Math.round(this.lookY * 12)}|${Math.round(blink * 6)}|${Math.round(this.talk * 6)}`;
    if (key === this.faceKey) return;
    this.faceKey = key;
    drawFace(this.faceCtx, {
      expr,
      lookX: this.lookX,
      lookY: this.lookY,
      blink,
      talk: this.talk,
      ink: this.def.ink,
      blush: this.def.blush,
      extra: this.def.face,
    });
    this.faceTex.needsUpdate = true;
  }

  /** Moves each extra to its spot on the squished surface, standing along the surface normal. */
  private placeParts(nrm: Float32Array): void {
    for (const { pin, holder, v } of this.pinned) {
      const i = v * 3;
      _y.set(nrm[i], nrm[i + 1], nrm[i + 2]);
      const ref = REF[pin.ref];
      _z.copy(ref).addScaledVector(_y, -ref.dot(_y));
      if (_z.lengthSq() < 1e-4) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
      _z.normalize();
      _x.crossVectors(_y, _z);
      _m.makeBasis(_x, _y, _z);
      holder.quaternion.setFromRotationMatrix(_m);
      holder.position.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]).addScaledVector(_y, pin.lift);
      pin.animate?.(pin.obj, this.now);
    }
    if (this.hat) this.hat.wide = seatOnRing(this.hat.seat, this.pos, this.hat.ring) / this.hat.restR;
  }

  private rebuild(geometry: boolean): void {
    if (geometry) this.reshape();
    // Whole-body motion
    if (this.mode === "home") this.group.position.copy(this.home);
    this.body.position.y = BOTTOM_Y + this.hopY;
    this.body.rotation.set(0, this.turn.x * 0.25, this.tilt.x);
    // Roll about the middle, not the bottom, so a roll looks like a roll.
    const roll = this.tilt.x - Math.round(this.tilt.x / (Math.PI * 2)) * Math.PI * 2;
    this.body.position.x = Math.sin(roll) * 0.45;
    this.body.position.y += (1 - Math.cos(roll)) * 0.45;
    // Turn to face where it is going, the short way round.
    let dy = this.yawTarget - this.yaw;
    dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2;
    this.yaw += dy * Math.min(1, this.frameDt * 6);
    this.group.rotation.y = this.yaw;
    this.stepHat();
  }

  private stepHat(): void {
    const h = this.hat;
    if (!h) return;
    const dt = Math.max(1 / 240, this.frameDt);
    // Where the hat is in the world, roughly; its change in speed kicks the wobble.
    const p = (h.wob.parent ?? h.wob).position.clone().multiply(this.group.scale);
    p.y += this.body.position.y * this.group.scale.y;
    p.add(this.group.position);
    if (h.fresh) {
      h.fresh = false;
      h.last.copy(p);
    }
    const v = p.clone().sub(h.last).divideScalar(dt);
    const dv = v.clone().sub(h.lastV);
    h.last.copy(p);
    h.lastV.copy(v);
    if (dv.length() < 40) {
      h.wz.v += dv.x * 0.9;
      h.wx.v -= dv.z * 0.9;
      h.wy.v -= dv.y * 0.35;
    }
    for (const sp of [h.wx, h.wz, h.wy]) sp.step(dt);
    h.wx.x = THREE.MathUtils.clamp(h.wx.x, -0.55, 0.55);
    h.wz.x = THREE.MathUtils.clamp(h.wz.x, -0.55, 0.55);
    h.wy.x = THREE.MathUtils.clamp(h.wy.x, -0.35, 0.35);
    // Popped: flies up, spins round once, lands with a little squash.
    if (h.popH > 0 || h.popV !== 0) {
      h.popV -= 15 * dt;
      h.popH += h.popV * dt;
      if (h.popH <= 0) {
        h.popH = 0;
        if (h.popV < -1.2) {
          h.wy.v -= h.popV * 0.6;
          h.popV *= -0.25;
          sfx.squeak(this.pitch * 1.4, 0.06, 0.15);
        } else h.popV = 0;
      }
    }
    if (h.spinV > 0) {
      h.spin += h.spinV * dt;
      if (h.spin >= Math.PI * 2) {
        h.spin = 0;
        h.spinV = 0;
      }
    }
    h.wob.children[0].rotation.set(h.wx.x, 0, h.wz.x);
    h.wob.children[0].scale.set(1 - h.wy.x * 0.5, 1 + h.wy.x, 1 - h.wy.x * 0.5);
    h.pop.position.y = h.popH;
    h.pop.rotation.y = h.spin;
    // The hat widens with a squashed head but keeps most of its height, so it never looks pulled flat.
    // (Far friends squash by stretching the whole body; the hat then only takes a little of the stretch.)
    h.seat.scale.set(h.wide, Math.pow(this.body.scale.y, -0.75), h.wide);
    const ctx: HatCtx = { energy: this.energy, sleeping: this.sleeping, dt };
    h.model.animate?.(this.now, ctx);
  }

  private reshape(): void {
    const p = this.group.position;
    const inBasket = this.basket.r > 0 && Math.hypot(p.x - this.home.x, p.z - this.home.z) < 0.4 && p.y < this.home.y + 0.5;
    this.d.wallR = inBasket ? this.basket.r : 0;
    this.d.wallTop = this.basket.top - p.y;
    this.d.squash = this.squash.x;
    this.d.melt = this.melt.x;
    this.d.leanX = this.leanX.x;
    this.d.leanZ = this.leanZ.x;
    const dd = Math.max(0, this.dent.x);
    this.d.dents = dd > 0.001 ? [{ x: this.dentDir.x, y: this.dentDir.y, z: this.dentDir.z, depth: dd, radius: 0.42 }] : [];
    for (const f of this.fingers.values()) {
      const depth = f.depth.x;
      if (Math.abs(depth) < 0.001) continue;
      // A fingertip-sized dent that widens a little as it sinks.
      this.d.dents.push({ x: f.dir.x, y: f.dir.y, z: f.dir.z, depth, radius: this.feel.radius + 0.35 * Math.max(0, depth) });
    }
    // Most of the time nothing pokes it: then squash and melt are just a
    // stretch about the bottom, so keep the resting shape and scale it.
    const plain =
      this.d.dents.length === 0 &&
      this.d.waves.length === 0 &&
      this.d.wallR === 0 &&
      Math.abs(this.d.leanX) < 0.004 &&
      Math.abs(this.d.leanZ) < 0.004 &&
      Math.abs(this.d.squash) < this.cheapSquash &&
      Math.abs(this.d.melt) < 0.02;
    if (plain) {
      const sy = 1 - Math.min(0.75, Math.max(-0.4, this.d.squash));
      const sxz = (1 / Math.sqrt(sy)) * (1 + this.d.melt);
      this.body.scale.set(sxz, sy, sxz);
      if (this.atRest) {
        if (this.glow) this.material.emissiveIntensity = 0.32 + 0.14 * Math.sin(this.now * 2.1);
        for (const { pin } of this.pinned) pin.animate?.(pin.obj, this.now);
        return;
      }
      const keep = { ...this.d };
      Object.assign(this.d, { squash: 0, melt: 0, leanX: 0, leanZ: 0 });
      deform(this.grid, this.d, this.pos);
      Object.assign(this.d, keep);
      this.atRest = true;
    } else {
      this.body.scale.set(1, 1, 1);
      this.atRest = false;
      deform(this.grid, this.d, this.pos);
    }
    const posAttr = this.geo.getAttribute("position") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
    const nrm = (this.geo.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
    weldNormals(nrm, this.pos);
    this.geo.computeBoundingSphere();
    // Face follows the surface, a hair above it.
    const fp = (this.faceGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const fn = (this.faceGeo.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
    for (let k = 0; k < this.patch.count; k++) {
      const s = this.patch.src[k] * 3;
      fn[k * 3] = nrm[s];
      fn[k * 3 + 1] = nrm[s + 1];
      fn[k * 3 + 2] = nrm[s + 2];
      fp[k * 3] = this.pos[s] + nrm[s] * 0.004;
      fp[k * 3 + 1] = this.pos[s + 1] + nrm[s + 1] * 0.004;
      fp[k * 3 + 2] = this.pos[s + 2] + nrm[s + 2] * 0.004;
    }
    this.faceGeo.getAttribute("position").needsUpdate = true;
    this.faceGeo.getAttribute("normal").needsUpdate = true;
    this.faceGeo.computeBoundingSphere();
    this.placeParts(nrm);
    if (this.glow) this.material.emissiveIntensity = 0.32 + 0.14 * Math.sin(this.now * 2.1);
  }
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m.dispose();
  });
}

/** The seam column is doubled and the poles are many points in one place: share their normals. */
function weldNormals(n: Float32Array, pos: Float32Array): void {
  for (let j = 0; j <= RINGS; j++) {
    const a = vid(0, j) * 3;
    const b = vid(SEG, j) * 3;
    for (let q = 0; q < 3; q++) {
      const s = n[a + q] + n[b + q];
      n[a + q] = s;
      n[b + q] = s;
    }
  }
  for (const j of [0, RINGS]) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i <= SEG; i++) {
      const k = vid(i, j) * 3;
      x += n[k];
      y += n[k + 1];
      z += n[k + 2];
    }
    const l = Math.hypot(x, y, z) || 1;
    for (let i = 0; i <= SEG; i++) {
      const k = vid(i, j) * 3;
      n[k] = x / l;
      n[k + 1] = y / l;
      n[k + 2] = z / l;
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
    n[k] /= l;
    n[k + 1] /= l;
    n[k + 2] /= l;
  }
  void pos;
}

/** Twinkling glitter flecks for glitter finishes. */
function addGlitter(m: THREE.MeshPhysicalMaterial, time: { value: number }, sparkle: THREE.Color): void {
  m.defines = { ...(m.defines ?? {}), USE_UV: "" };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uSparkle = { value: sparkle };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform vec3 uSparkle;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          // Soft, slow glimmers: small flecks that fade in and out gently,
          // tinted toward the body color so they never glare.
          vec2 gp = vUv * vec2(260.0, 150.0);
          vec2 cell = floor(gp);
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float h2 = fract(h * 91.7 + 0.13);
          vec2 f = fract(gp) - 0.5;
          float fleck = smoothstep(0.42, 0.0, length(f));
          vec3 facet = normalize(normal + vec3(h - 0.5, h2 - 0.5, 0.0) * 1.2);
          float glint = pow(max(0.0, dot(facet, normalize(vec3(0.35, 0.55, 0.75)))), 14.0);
          float tw = 0.5 + 0.5 * sin(uTime * 0.9 + h * 40.0);
          tw *= tw;
          diffuseColor.rgb *= 0.94 + 0.12 * h;
          vec3 soft = mix(diffuseColor.rgb, uSparkle, 0.55);
          totalEmissiveRadiance += soft * fleck * glint * tw * 0.55 * step(0.45, h2);
        }`,
      );
  };
  m.customProgramCacheKey = () => "glitter";
}

/** How wide a row of the body is at rest, on average. */
function ringRadius(base: Float32Array, j: number): number {
  let sum = 0;
  for (let i = 0; i < SEG; i++) {
    const k = vid(i, j) * 3;
    sum += Math.hypot(base[k], base[k + 2]);
  }
  return sum / SEG;
}

/** The row of the body (above the middle) whose width is closest to `r`, at rest. */
export function ringAt(base: Float32Array, r: number): number {
  let best = RINGS - 1;
  let bestErr = Infinity;
  for (let j = Math.floor(RINGS / 2); j < RINGS; j++) {
    const err = Math.abs(ringRadius(base, j) - r);
    if (err < bestErr) {
      bestErr = err;
      best = j;
    }
  }
  return best;
}

const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Puts a hat on a ring of the (squished, leaning, dented) body: at the ring's middle, standing square to it,
 * so it stays seated on the head whatever the body does. Returns how wide the ring is now.
 */
function seatOnRing(seat: THREE.Object3D, pos: Float32Array, ring: number): number {
  _c.set(0, 0, 0);
  for (let i = 0; i < SEG; i++) {
    const k = vid(i, ring) * 3;
    _c.x += pos[k];
    _c.y += pos[k + 1];
    _c.z += pos[k + 2];
  }
  _c.divideScalar(SEG);
  // The ring's plane: cross products of spokes a quarter turn apart, summed all round.
  _n.set(0, 0, 0);
  const q = SEG / 4;
  for (let i = 0; i < SEG; i += 4) {
    const ka = vid(i, ring) * 3;
    const kb = vid((i + q) % SEG, ring) * 3;
    _a.set(pos[ka] - _c.x, pos[ka + 1] - _c.y, pos[ka + 2] - _c.z);
    _b.set(pos[kb] - _c.x, pos[kb + 1] - _c.y, pos[kb + 2] - _c.z);
    _n.add(_a.cross(_b));
  }
  if (_n.lengthSq() < 1e-8 || _n.y <= 0) _n.set(0, 1, 0);
  _y.copy(_n).normalize();
  _z.set(0, 0, 1).addScaledVector(_y, -_y.z).normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  seat.quaternion.setFromRotationMatrix(_m);
  seat.position.copy(_c);
  let r = 0;
  for (let i = 0; i < SEG; i += 4) {
    const k = vid(i, ring) * 3;
    r += Math.hypot(pos[k] - _c.x, pos[k + 1] - _c.y, pos[k + 2] - _c.z);
  }
  return r / (SEG / 4);
}
