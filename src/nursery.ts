// The babies you see. A baby found asleep at a place snoozes there until you
// tap it; babies you keep come everywhere with you and toddle about in front,
// beside the one you hold. They're little squishies, so they use the same body
// as everyone else, just smaller.

import * as THREE from "three";
import { Squishy, type Bounds, type Fx } from "./squishy";
import type { SquishyDef } from "./catalog";
import type { PlaceScene } from "./placeScenes";
import { moodById, type MoodId } from "./personality";
import * as sfx from "./audio";

export const BABY_SCALE = 0.44;
/** Where kept babies toddle about: in front, either side of the one you hold. */
const NEST = [new THREE.Vector3(-1.75, 0, 0.55), new THREE.Vector3(1.75, 0, 0.55), new THREE.Vector3(-0.95, 0, 1.45)];

export interface NurseryEvents {
  fx(kind: Fx, at: THREE.Vector3, count?: number): void;
}

interface Little {
  key: string;
  sq: Squishy;
  shadow: THREE.Mesh;
  nest: THREE.Vector3;
  next: number;
  appear: number;
}

export type NurseryHit = { kind: "sleeper" } | { kind: "baby"; key: string };

export class Nursery {
  private babies: Little[] = [];
  private sleeper: Little | null = null;
  private now = 0;
  private frame = 0;
  paused = false;

  constructor(
    private scene: THREE.Scene,
    private shadowMat: THREE.MeshBasicMaterial,
    private main: Squishy,
    private ev: NurseryEvents,
  ) {}

  private make(def: SquishyDef, key: string, at: THREE.Vector3): Little {
    const sq = new Squishy(def, {
      fx: (kind, p, count) => this.ev.fx(kind, p, count),
      love: () => {},
      did: () => {},
    });
    sq.autoSleep = false;
    sq.cheapSquash = 0.45;
    sq.voiceMul = 1.35;
    sq.group.scale.setScalar(0.001);
    sq.placeAt(at);
    this.scene.add(sq.group);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), this.shadowMat.clone());
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);
    return { key, sq, shadow, nest: at.clone(), next: 2 + Math.random() * 4, appear: 0.001 };
  }

  private drop(l: Little): void {
    this.scene.remove(l.sq.group, l.shadow);
    l.shadow.geometry.dispose();
    (l.shadow.material as THREE.Material).dispose();
  }

  get hasSleeper(): boolean {
    return !!this.sleeper;
  }

  get sleeperKind(): string | null {
    return this.sleeper?.sq.def.id ?? null;
  }

  /** A baby fast asleep somewhere in this place, waiting to be found. */
  putSleeper(def: SquishyDef, place: PlaceScene): void {
    this.clearSleeper();
    // Off to one side of the one you hold, where it's easy to see.
    const side = Math.random() < 0.5 ? -1 : 1;
    const near = place.wander.filter((w) => Math.abs(w.x) > 1 && Math.sign(w.x) === side);
    const w = near.length ? near[Math.floor(Math.random() * near.length)] : new THREE.Vector3(side * 2, 0, -2.8);
    const spot = new THREE.Vector3(side * Math.min(Math.abs(w.x) + 0.5, 2.3), 0, Math.min(-1.9, w.z + 0.7));
    const l = this.make(def, "sleeper", spot);
    l.sq.nap();
    l.sq.faceNow(-spot.x * 0.08);
    this.sleeper = l;
    this.ev.fx("glimmer", l.sq.topPoint(), 4);
  }

  clearSleeper(): void {
    if (this.sleeper) this.drop(this.sleeper);
    this.sleeper = null;
  }

  /** The sleeper wakes up and comes over to join the babies. */
  wakeSleeper(key: string, mood: MoodId): void {
    const l = this.sleeper;
    if (!l) return;
    this.sleeper = null;
    l.key = key;
    l.sq.mood = moodById(mood);
    l.sq.wakeUp();
    l.sq.express("love", 1.4, 0.8);
    this.ev.fx("heart", l.sq.topPoint(), 5);
    this.ev.fx("sparkle", l.sq.topPoint(), 8);
    const nest = NEST[this.babies.length % NEST.length].clone();
    l.nest = nest;
    setTimeout(() => l.sq.hopTo(nest, { height: 0.45, then: () => (l.sq.yawTarget = 0) }), 900);
    this.babies.push(l);
  }

  /** Makes the babies you see match the ones you're raising. */
  setBabies(list: { key: string; def: SquishyDef; mood: MoodId; napping: boolean }[]): void {
    const keep = new Map(this.babies.map((b) => [b.key, b]));
    const next: Little[] = [];
    list.forEach((b, i) => {
      let l = keep.get(b.key);
      if (l) keep.delete(b.key);
      else l = this.make(b.def, b.key, NEST[i % NEST.length]);
      l.nest = NEST[i % NEST.length].clone();
      l.sq.mood = moodById(b.mood);
      if (b.napping) l.sq.nap();
      next.push(l);
    });
    for (const l of keep.values()) {
      this.ev.fx("sparkle", l.sq.topPoint(), 8);
      this.drop(l);
    }
    this.babies = next;
  }

  /** New place: babies pop back to their spots; any sleeper stays behind. */
  setPlace(): void {
    this.clearSleeper();
    for (const b of this.babies) {
      b.sq.placeAt(b.nest);
      b.appear = 0.001;
    }
  }

  setNapping(key: string, on: boolean): void {
    const l = this.babies.find((b) => b.key === key);
    if (!l) return;
    if (on) l.sq.nap();
    else l.sq.wakeUp();
  }

  hit(ray: THREE.Raycaster): NurseryHit | null {
    if (this.sleeper && ray.intersectObject(this.sleeper.sq.mesh, false).length) return { kind: "sleeper" };
    for (const b of this.babies) if (ray.intersectObject(b.sq.mesh, false).length) return { kind: "baby", key: b.key };
    return null;
  }

  /** Where a baby is, for effects. */
  topOf(key: string): THREE.Vector3 | null {
    const l = key === "sleeper" ? this.sleeper : this.babies.find((b) => b.key === key);
    return l ? l.sq.topPoint() : null;
  }

  /** Tapped: a happy wiggle, or a grumbly wake-up if it was napping. */
  played(key: string, woke: boolean): void {
    const l = this.babies.find((b) => b.key === key);
    if (!l) return;
    const sq = l.sq;
    sq.wakeUp();
    if (woke) {
      setTimeout(() => sq.express("pout", 1.6), 500);
      return;
    }
    sq.bounce(4.2);
    sq.express(Math.random() < 0.5 ? "giggle" : "happy", 0.9, 0.8);
    sfx.giggle(sq.pitch * 1.25);
    this.ev.fx("heart", sq.topPoint(), 2);
  }

  /** It learned something: shows a little of who it's becoming. */
  learned(key: string, lesson: MoodId, tired: boolean): void {
    const l = this.babies.find((b) => b.key === key);
    if (!l) return;
    const sq = l.sq;
    const was = sq.mood;
    sq.wakeUp();
    sq.mood = moodById(lesson);
    sq.quirk();
    sq.mood = was;
    sq.bounce(3.4);
    const fx: Fx = lesson === "musical" ? "note" : lesson === "cuddly" || lesson === "sweet" ? "heart" : lesson === "brave" || lesson === "sporty" ? "star" : "sparkle";
    this.ev.fx(fx, sq.topPoint(), 5);
    if (tired) setTimeout(() => sq.nap(), 1600);
  }

  update(dt: number, now: number, bounds: Bounds): void {
    this.now = now;
    this.frame++;
    const all = this.sleeper ? [...this.babies, this.sleeper] : this.babies;
    all.forEach((l, i) => {
      const sq = l.sq;
      if (l.appear > 0 && l.appear < 1) {
        l.appear = Math.min(1, l.appear + dt * 3);
        sq.group.scale.setScalar(BABY_SCALE * (l.appear + Math.sin(l.appear * Math.PI) * 0.25));
      }
      if (l !== this.sleeper && !this.paused && sq.isHome && !sq.isSleeping) {
        l.next -= dt;
        if (l.next <= 0) {
          l.next = 3 + Math.random() * 5;
          const r = Math.random();
          if (r < 0.45) {
            // Toddle about a little near its spot.
            const to = l.nest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.6));
            sq.hopTo(to, { height: 0.3, then: () => (sq.yawTarget = Math.atan2(this.main.group.position.x - to.x, this.main.group.position.z - to.z) * 0.5) });
          } else if (r < 0.7) {
            // Look up at the big one.
            sq.yawTarget = Math.atan2(this.main.group.position.x - sq.home.x, this.main.group.position.z - sq.home.z) * 0.7;
            sq.lookAt(0, 0.8);
          } else {
            sq.quirk();
          }
        }
      }
      sq.update(dt, now, bounds, (this.frame + i) % 2 === 0);
      const p = sq.group.position;
      l.shadow.position.set(p.x, 0.006, p.z);
      l.shadow.scale.setScalar(BABY_SCALE * 0.95);
      l.shadow.visible = sq.group.visible;
    });
  }

  setVisible(on: boolean): void {
    for (const l of this.sleeper ? [...this.babies, this.sleeper] : this.babies) {
      l.sq.group.visible = on;
      l.shadow.visible = on;
    }
  }
}
