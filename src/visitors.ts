// Squishies passing by, so every place feels lived in: swimmers in the sea at
// the beach and around the boat, walkers along the city street, hoppers across
// the tea table and the living room. Each one stops halfway to wave, shows who
// it is, then carries on. Tap one and it says hi.

import * as THREE from "three";
import { Squishy, type Bounds, type Fx } from "./squishy";
import { CATALOG, type SquishyDef } from "./catalog";
import { isOctober } from "./boxes";
import type { PlaceScene, VisitPath } from "./placeScenes";
import { moodById, randomMood } from "./personality";
import { pushOut, route } from "./nav";
import * as sfx from "./audio";

export const VISITOR_SCALE = 0.62;
const MAX_OUT = 2;

/**
 * How often each squishy passes by. Plain (matte) ones are common; shiny and glitter buns are uncommon;
 * glittery and glowing Spooky ones are rare; the gold buns are super rare. Spooky squishies are one step
 * rarer outside October. With one passer-by every minute or two, a common one turns up about twice an
 * hour, an uncommon one every couple of hours, a rare one every eight or so, and a super rare one about
 * once a day of play.
 */
export type Tier = "common" | "uncommon" | "rare" | "superRare";
export const TIER_WEIGHT: Record<Tier, number> = { common: 12, uncommon: 3, rare: 0.8, superRare: 0.25 };
const TIERS: Tier[] = ["common", "uncommon", "rare", "superRare"];

export function visitorTier(def: SquishyDef, date: Date): Tier {
  let t: number = def.finish === "matte" ? 0 : def.finish === "gold" ? 3 : def.family === "spooky" ? 2 : 1;
  if (def.family === "spooky" && !isOctober(date)) t = Math.min(3, t + 1);
  return TIERS[t];
}

/** Seconds until the next passer-by: one every minute or two. */
export const nextVisitorIn = (rand: () => number): number => 50 + rand() * 70;

/** Picks who passes by next, by tier, from those not already out. */
export function pickVisitor(pool: readonly SquishyDef[], date: Date, rand: () => number): SquishyDef | null {
  let total = 0;
  for (const d of pool) total += TIER_WEIGHT[visitorTier(d, date)];
  let r = rand() * total;
  for (const d of pool) {
    r -= TIER_WEIGHT[visitorTier(d, date)];
    if (r < 0) return d;
  }
  return pool[pool.length - 1] ?? null;
}
const SWIM_SPEED = 1.15;
/** How far a passer-by's body reaches out along the ground. */
/** A passer-by's body along the ground (they are smaller than friends), with a little room to spare. */
const VISITOR_PAD = 0.8;

export interface VisitorEvents {
  fx(kind: Fx, at: THREE.Vector3, count?: number): void;
  love(n: number): void;
  said(text: string): void;
  /** Squishies out with you, so a visitor isn't one of them. */
  busy(): string[];
}

interface Visitor {
  sq: Squishy;
  shadow: THREE.Mesh;
  path: VisitPath;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** The way it goes, from one end to the other, round anything in between. */
  pts: THREE.Vector3[];
  /** 0..1 along the way; it pauses once at `stopAt`. */
  k: number;
  stopAt: number;
  phase: "in" | "go" | "wave" | "on" | "out";
  t: number;
  /** For swimmers: a little leap now and then. */
  leap: number;
  nextLeap: number;
  len: number;
}

export class Visitors {
  private list: Visitor[] = [];
  private spare: Squishy[] = [];
  private place: PlaceScene | null = null;
  private next = 6;
  private now = 0;
  private frame = 0;
  paused = false;

  constructor(
    private scene: THREE.Scene,
    private shadowMat: THREE.MeshBasicMaterial,
    private ev: VisitorEvents,
  ) {}

  setPlace(p: PlaceScene): void {
    for (const v of this.list) this.remove(v);
    this.list = [];
    this.place = p;
    this.next = 20 + Math.random() * 25;
  }

  setVisible(on: boolean): void {
    for (const v of this.list) {
      v.sq.group.visible = on;
      v.shadow.visible = on && v.path.how !== "swim";
    }
  }

  /** The visitor under a screen ray, if any. */
  hit(ray: THREE.Raycaster): Squishy | null {
    for (const v of this.list) if (v.sq.group.visible && ray.intersectObject(v.sq.mesh, false).length) return v.sq;
    return null;
  }

  tap(sq: Squishy): void {
    const v = this.list.find((x) => x.sq === sq);
    if (!v) return;
    sq.express("happy", 1, 0.8);
    sq.quirk();
    if (v.path.how !== "swim") sq.bounce(3.6);
    else v.leap = 0.001;
    sfx.squeak(sq.pitch * 1.15, 0.12, 0.26);
    this.ev.fx("heart", sq.topPoint(), 2);
    this.ev.love(1);
    this.ev.said(`${sq.def.name} says hi!`);
  }

  private body(def: SquishyDef): Squishy {
    const sq =
      this.spare.pop() ??
      new Squishy(def, {
        fx: (kind, at, count) => this.ev.fx(kind, at, count),
        love: () => {},
        did: () => {},
      });
    sq.setDesign(def, null);
    sq.autoSleep = false;
    sq.cheapSquash = 0.5;
    sq.mood = moodById(randomMood(Math.random));
    sq.group.visible = true;
    return sq;
  }

  private spawn(): void {
    const p = this.place;
    if (!p || !p.paths.length) return;
    const free = p.paths.filter((path) => !this.list.some((v) => v.path === path));
    if (!free.length) return;
    const path = free[Math.floor(Math.random() * free.length)];
    const flip = Math.random() < 0.5;
    const from = (flip ? path.to : path.from).clone();
    const to = (flip ? path.from : path.to).clone();
    if (path.how !== "swim") {
      pushOut(from, p.solids, VISITOR_PAD);
      pushOut(to, p.solids, VISITOR_PAD);
    }
    const way = path.how === "swim" ? [to] : route(from, to, p.solids, VISITOR_PAD).map((q) => new THREE.Vector3(q.x, 0, q.z));
    // No way through without bumping into something: nobody passes by this time.
    if (!way.length) return;
    const busy = new Set([...this.ev.busy(), ...this.list.map((v) => v.sq.def.id)]);
    const pool = CATALOG.filter((d) => !busy.has(d.id) && d.foundBy.some((f) => f.kind === "box"));
    const def = pickVisitor(pool, new Date(), Math.random) ?? CATALOG[0];
    const sq = this.body(def);
    sq.group.scale.setScalar(0.001);
    const pts = [from, ...way];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    sq.placeAt(this.spot(path, from, 0));
    sq.faceNow(Math.atan2(to.x - from.x, to.z - from.z));
    this.scene.add(sq.group);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), this.shadowMat.clone());
    shadow.rotation.x = -Math.PI / 2;
    shadow.visible = path.how !== "swim";
    this.scene.add(shadow);
    this.list.push({
      sq,
      shadow,
      path,
      from,
      to,
      pts,
      k: 0,
      stopAt: 0.38 + Math.random() * 0.24,
      phase: "in",
      t: 0,
      leap: 0,
      nextLeap: 2 + Math.random() * 3,
      len,
    });
  }

  /** Where it is at `k` along its way: swimmers sit low in the water. */
  private spot(path: VisitPath, from: THREE.Vector3, k: number, v?: Visitor): THREE.Vector3 {
    const p = v ? this.along(v, k) : from.clone();
    // Home is the bottom of the bun: on the ground, or under the water.
    p.y = path.how === "swim" ? (path.water ?? 0) - 0.34 : 0;
    return p;
  }

  /** The point `k` (0..1) of the way along a visitor's path. */
  private along(v: Visitor, k: number): THREE.Vector3 {
    let left = Math.max(0, Math.min(1, k)) * v.len;
    for (let i = 1; i < v.pts.length; i++) {
      const seg = v.pts[i].distanceTo(v.pts[i - 1]);
      if (left <= seg || i === v.pts.length - 1) return v.pts[i - 1].clone().lerp(v.pts[i], seg > 0 ? Math.min(1, left / seg) : 1);
      left -= seg;
    }
    return v.pts[v.pts.length - 1].clone();
  }

  /** The corners of its way between `k0` and `k1`, in order. */
  private cornersBetween(v: Visitor, k0: number, k1: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    let at = 0;
    for (let i = 1; i < v.pts.length - 1; i++) {
      at += v.pts[i].distanceTo(v.pts[i - 1]);
      const k = at / v.len;
      if (k > k0 + 1e-4 && k < k1 - 1e-4) out.push(v.pts[i].clone());
    }
    return out;
  }

  private remove(v: Visitor): void {
    this.scene.remove(v.sq.group, v.shadow);
    v.shadow.geometry.dispose();
    (v.shadow.material as THREE.Material).dispose();
    if (this.spare.length < MAX_OUT) this.spare.push(v.sq);
  }

  update(dt: number, now: number, bounds: Bounds): void {
    this.now = now;
    this.frame++;
    if (!this.place) return;
    if (!this.paused) {
      this.next -= dt;
      if (this.next <= 0) {
        this.next = nextVisitorIn(Math.random);
        if (this.list.length < MAX_OUT) this.spawn();
      }
    }
    for (const v of this.list) this.step(v, dt, bounds);
    const gone = this.list.filter((v) => v.phase === "out" && v.t > 0.4);
    for (const v of gone) this.remove(v);
    if (gone.length) this.list = this.list.filter((v) => !gone.includes(v));
  }

  private step(v: Visitor, dt: number, bounds: Bounds): void {
    const sq = v.sq;
    v.t += dt;
    const swim = v.path.how === "swim";
    switch (v.phase) {
      case "in": {
        const k = Math.min(1, v.t / 0.4);
        sq.group.scale.setScalar(VISITOR_SCALE * Math.max(0.001, k));
        if (k >= 1) this.go(v, v.stopAt, "go");
        break;
      }
      case "go":
      case "on": {
        if (swim) {
          v.k = Math.min(v.phase === "go" ? v.stopAt : 1, v.k + (dt * SWIM_SPEED) / v.len);
          const at = this.spot(v.path, v.from, v.k, v);
          at.y += Math.sin(this.now * 3 + v.len) * 0.05 + this.stepLeap(v, dt);
          sq.placeAt(at);
          sq.yawTarget = Math.atan2(v.to.x - v.from.x, v.to.z - v.from.z);
          const end = v.phase === "go" ? v.stopAt : 1;
          if (v.k >= end) this.arrived(v);
        }
        // Walkers and hoppers move by hopping (see go); they call arrived() when there.
        break;
      }
      case "wave": {
        if (swim) {
          const at = this.spot(v.path, v.from, v.k, v);
          at.y += Math.sin(this.now * 3 + v.len) * 0.05 + this.stepLeap(v, dt);
          sq.placeAt(at);
        }
        if (v.t > 2.6) this.go(v, 1, "on");
        break;
      }
      case "out": {
        sq.group.scale.setScalar(VISITOR_SCALE * Math.max(0.001, 1 - v.t / 0.4));
        break;
      }
    }
    // Far away and small: reshaping every other frame is plenty.
    sq.update(dt, this.now, bounds, (this.frame + this.list.indexOf(v)) % 2 === 0);
    const p = sq.group.position;
    v.shadow.position.set(p.x, 0.006, p.z);
    v.shadow.scale.setScalar(VISITOR_SCALE * 0.95 * Math.min(1, sq.group.scale.x / VISITOR_SCALE));
  }

  /** A swimmer's little leap out of the water and back in. */
  private stepLeap(v: Visitor, dt: number): number {
    if (v.leap > 0) {
      v.leap += dt;
      const k = v.leap / 0.7;
      if (k >= 1) {
        v.leap = 0;
        this.ev.fx("splash", v.sq.group.position.clone().setY((v.path.water ?? 0) + 0.05), 6);
        return 0;
      }
      return Math.sin(k * Math.PI) * 0.75;
    }
    v.nextLeap -= dt;
    if (v.nextLeap <= 0) {
      v.nextLeap = 3 + Math.random() * 4;
      v.leap = 0.001;
      this.ev.fx("splash", v.sq.group.position.clone().setY((v.path.water ?? 0) + 0.05), 5);
    }
    return 0;
  }

  private go(v: Visitor, until: number, phase: "go" | "on"): void {
    v.phase = phase;
    v.t = 0;
    const sq = v.sq;
    sq.yawTarget = Math.atan2(v.to.x - v.from.x, v.to.z - v.from.z);
    if (v.path.how === "swim") return;
    // Hop corner to corner round anything in the way, then on to the stop.
    const stops = [...this.cornersBetween(v, v.k, until), this.spot(v.path, v.from, until, v)];
    v.k = until;
    const height = v.path.how === "hop" ? 0.6 : 0.3;
    const next = (i: number) =>
      sq.hopTo(stops[i], {
        height,
        then: () => {
          if (i < stops.length - 1) next(i + 1);
          else this.arrived(v);
        },
      });
    next(0);
  }

  private arrived(v: Visitor): void {
    if (v.phase === "go") {
      // Halfway: turn to say hello and be itself for a moment.
      v.phase = "wave";
      v.t = 0;
      v.sq.yawTarget = 0;
      v.sq.express("happy", 1.2, 0.6);
      setTimeout(() => v.sq.quirk(), 500);
      // A rare one is worth a shout.
      const tier = visitorTier(v.sq.def, new Date());
      if (tier === "rare" || tier === "superRare") {
        this.ev.fx("glimmer", v.sq.topPoint(), tier === "superRare" ? 10 : 6);
        this.ev.said(`${tier === "superRare" ? "Super rare!" : "Wow, a rare one!"} ${v.sq.def.name} is passing by!`);
      }
      if (v.path.how !== "swim") v.sq.bounce(3.4);
    } else if (v.phase === "on") {
      v.phase = "out";
      v.t = 0;
    }
  }
}
