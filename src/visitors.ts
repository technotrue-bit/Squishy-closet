// Squishies passing by, so every place feels lived in: swimmers in the sea at
// the beach and around the boat, walkers along the city street, hoppers across
// the tea table and the living room. Each one stops halfway to wave, shows who
// it is, then carries on. Tap one and it says hi.

import * as THREE from "three";
import { Squishy, type Bounds, type Fx } from "./squishy";
import { CATALOG, type SquishyDef } from "./catalog";
import { weightOf } from "./boxes";
import type { PlaceScene, VisitPath } from "./placeScenes";
import { moodById, randomMood } from "./personality";
import * as sfx from "./audio";

export const VISITOR_SCALE = 0.62;
const MAX_OUT = 2;
const SWIM_SPEED = 1.15;

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
    this.next = 4 + Math.random() * 5;
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
    const busy = new Set([...this.ev.busy(), ...this.list.map((v) => v.sq.def.id)]);
    const pool = CATALOG.filter((d) => !busy.has(d.id) && d.foundBy.some((f) => f.kind === "box"));
    const date = new Date();
    let total = 0;
    for (const d of pool) total += weightOf(d, date);
    let r = Math.random() * total;
    let def = pool[0] ?? CATALOG[0];
    for (const d of pool) {
      r -= weightOf(d, date);
      if (r < 0) {
        def = d;
        break;
      }
    }
    const sq = this.body(def);
    sq.group.scale.setScalar(0.001);
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
      k: 0,
      stopAt: 0.38 + Math.random() * 0.24,
      phase: "in",
      t: 0,
      leap: 0,
      nextLeap: 2 + Math.random() * 3,
      len: from.distanceTo(to),
    });
  }

  /** Where it is at `k` along: swimmers sit low in the water. */
  private spot(path: VisitPath, from: THREE.Vector3, k: number, to?: THREE.Vector3): THREE.Vector3 {
    const p = to ? from.clone().lerp(to, k) : from.clone();
    // Home is the bottom of the bun: on the ground, or under the water.
    p.y = path.how === "swim" ? (path.water ?? 0) - 0.34 : 0;
    return p;
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
        this.next = 9 + Math.random() * 14;
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
          const at = this.spot(v.path, v.from, v.k, v.to);
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
          const at = this.spot(v.path, v.from, v.k, v.to);
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
    const target = this.spot(v.path, v.from, until, v.to);
    sq.hopTo(target, { height: v.path.how === "hop" ? 0.6 : 0.3, then: () => this.arrived(v) });
  }

  private arrived(v: Visitor): void {
    if (v.phase === "go") {
      // Halfway: turn to say hello and be itself for a moment.
      v.phase = "wave";
      v.t = 0;
      v.sq.yawTarget = 0;
      v.sq.express("happy", 1.2, 0.6);
      setTimeout(() => v.sq.quirk(), 500);
      if (v.path.how !== "swim") v.sq.bounce(3.4);
    } else if (v.phase === "on") {
      v.phase = "out";
      v.t = 0;
    }
  }
}
