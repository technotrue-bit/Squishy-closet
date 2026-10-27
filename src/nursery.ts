// The babies you see. A baby found asleep at a place snoozes there until you
// tap it; babies you keep come everywhere with you and toddle about in front,
// beside the one you hold. They're little squishies, so they use the same body
// as everyone else, just smaller, and they get a little bigger as they grow up.
// When one wants something, a thought bubble over its head shows what.

import * as THREE from "three";
import { Squishy, type Bounds, type Fx } from "./squishy";
import type { SquishyDef } from "./catalog";
import type { PlaceScene } from "./placeScenes";
import { moodById, type MoodId } from "./personality";
import { pushOut } from "./nav";
import * as sfx from "./audio";

export const BABY_SCALE = 0.44;
/** Nearly grown up, a baby is this much bigger than when it was found. */
const GROWN_EXTRA = 0.4;
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
  /** Its size now, from how grown up it is. */
  size: number;
  /** The thought bubble showing what it wants, if it wants something. */
  bubble: THREE.Sprite | null;
  wantIcon: string | null;
}

/** One picture per thing wanted: a white thought bubble with the icon inside. */
const bubbleTex = new Map<string, THREE.CanvasTexture>();
function bubbleTexture(icon: string): THREE.CanvasTexture {
  let t = bubbleTex.get(icon);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.strokeStyle = "#ffb3d1";
  g.lineWidth = 5;
  const dot = (x: number, y: number, r: number) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  };
  dot(40, 118, 6);
  dot(52, 102, 9);
  dot(64, 54, 44);
  g.font = "52px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(icon, 64, 58);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bubbleTex.set(icon, t);
  return t;
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
    return { key, sq, shadow, nest: at.clone(), next: 2 + Math.random() * 4, appear: 0.001, size: BABY_SCALE, bubble: null, wantIcon: null };
  }

  private drop(l: Little): void {
    this.showWant(l, null);
    this.scene.remove(l.sq.group, l.shadow);
    l.shadow.geometry.dispose();
    (l.shadow.material as THREE.Material).dispose();
  }

  get hasSleeper(): boolean {
    return !!this.sleeper;
  }

  /** Where the sleeping baby lies, if there is one. */
  get sleeperAt(): THREE.Vector3 | null {
    return this.sleeper?.sq.home ?? null;
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
    // Not inside anything, nor tucked against the one you hold.
    pushOut(spot, [...place.solids, { x: 0, z: 0, r: 1.2 }], 0.6);
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
  setBabies(list: { key: string; def: SquishyDef; mood: MoodId; napping: boolean; want: string | null; grow: number }[]): void {
    const keep = new Map(this.babies.map((b) => [b.key, b]));
    const next: Little[] = [];
    list.forEach((b, i) => {
      let l = keep.get(b.key);
      if (l) keep.delete(b.key);
      else l = this.make(b.def, b.key, NEST[i % NEST.length]);
      l.nest = NEST[i % NEST.length].clone();
      l.sq.mood = moodById(b.mood);
      l.size = BABY_SCALE * (1 + GROWN_EXTRA * Math.max(0, Math.min(1, b.grow)));
      if (b.napping) l.sq.nap();
      this.showWant(l, b.napping ? null : b.want);
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

  /** Shows (or, with null, hides) the thought bubble of what a baby wants. */
  setWant(key: string, icon: string | null): void {
    const l = this.babies.find((b) => b.key === key);
    if (!l) return;
    const fresh = icon && icon !== l.wantIcon;
    this.showWant(l, icon);
    if (fresh) {
      l.sq.wakeUp();
      l.sq.bounce(3.2);
      l.sq.express("happy", 0.9, 0.7);
      l.sq.yawTarget = 0;
      sfx.squeak(l.sq.pitch * 1.4, 0.09, 0.16);
    }
  }

  private showWant(l: Little, icon: string | null): void {
    if (icon === l.wantIcon) return;
    l.wantIcon = icon;
    if (!icon) {
      if (l.bubble) {
        this.scene.remove(l.bubble);
        l.bubble.material.dispose();
        l.bubble = null;
      }
      return;
    }
    if (!l.bubble) {
      l.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      l.bubble.renderOrder = 10;
      l.bubble.scale.setScalar(0.001);
      this.scene.add(l.bubble);
    }
    l.bubble.material.map = bubbleTexture(icon);
    l.bubble.material.needsUpdate = true;
  }

  hit(ray: THREE.Raycaster): NurseryHit | null {
    if (this.sleeper && ray.intersectObject(this.sleeper.sq.mesh, false).length) return { kind: "sleeper" };
    for (const b of this.babies) {
      if (ray.intersectObject(b.sq.mesh, false).length) return { kind: "baby", key: b.key };
      if (b.bubble?.visible && ray.intersectObject(b.bubble, false).length) return { kind: "baby", key: b.key };
    }
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

  /** A wish came true: a big happy wiggle, and it grows a little right there. */
  wished(key: string, mood: MoodId, grow: number): void {
    const l = this.babies.find((b) => b.key === key);
    if (!l) return;
    this.showWant(l, null);
    l.size = BABY_SCALE * (1 + GROWN_EXTRA * Math.max(0, Math.min(1, grow)));
    l.appear = 0.35;
    this.learned(key, mood, false);
    l.sq.express("love", 1.4, 0.9);
    this.ev.fx("heart", l.sq.topPoint(), 4);
    this.ev.fx("sparkle", l.sq.topPoint(), 10);
  }

  update(dt: number, now: number, bounds: Bounds): void {
    this.now = now;
    this.frame++;
    const all = this.sleeper ? [...this.babies, this.sleeper] : this.babies;
    all.forEach((l, i) => {
      const sq = l.sq;
      if (l.appear > 0 && l.appear < 1) {
        l.appear = Math.min(1, l.appear + dt * 3);
        sq.group.scale.setScalar(l.size * (l.appear + Math.sin(l.appear * Math.PI) * 0.25));
      } else if (l.appear >= 1 && Math.abs(sq.group.scale.x - l.size) > 1e-4) {
        sq.group.scale.setScalar(sq.group.scale.x + (l.size - sq.group.scale.x) * Math.min(1, dt * 4));
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
      l.shadow.scale.setScalar(sq.group.scale.x * 0.95);
      l.shadow.visible = sq.group.visible;
      if (l.bubble) {
        // Pops in, then bobs gently over its head.
        const top = sq.topPoint();
        const want = 0.62 * (sq.isSleeping ? 0 : 1);
        const s = l.bubble.scale.x + (want - l.bubble.scale.x) * Math.min(1, dt * 8);
        l.bubble.scale.setScalar(Math.max(0.001, s));
        l.bubble.position.set(top.x + 0.22, top.y + 0.38 + Math.sin(now * 2.6 + i) * 0.05, top.z + 0.05);
        l.bubble.visible = sq.group.visible && s > 0.05;
      }
    });
  }

  setVisible(on: boolean): void {
    for (const l of this.sleeper ? [...this.babies, this.sleeper] : this.babies) {
      l.sq.group.visible = on;
      l.shadow.visible = on;
      if (l.bubble) l.bubble.visible = on;
    }
  }
}
