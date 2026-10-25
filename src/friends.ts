// Your friends: up to three more squishies out playing behind the one you hold.
// They hop about the place doing jobs (a sandcastle, fishing, stacking
// blocks), meet up to bounce together, and every so often one comes up front:
// to be loved, to play with the one you hold, or to cuddle up when it falls
// asleep. Tap a friend to help with its job or give it love.

import * as THREE from "three";
import { Squishy, type Bounds, type Fx } from "./squishy";
import type { SquishyDef } from "./catalog";
import type { JobDef } from "./places";
import type { JobSpot, PlaceScene } from "./placeScenes";
import * as sfx from "./audio";
import { moodById, sayLine, type MoodId } from "./personality";

export const FRIEND_SCALE = 0.8;

/** Up front, beside the basket: where friends come to visit, play and cuddle. */
export const FRONT = {
  visit: [new THREE.Vector3(-1.55, 0, -1.35), new THREE.Vector3(1.55, 0, -1.35)],
  cuddle: [new THREE.Vector3(-1.42, 0, -1.2), new THREE.Vector3(1.42, 0, -1.2)],
};

type State =
  | { kind: "idle"; until: number }
  | { kind: "move" }
  | { kind: "work"; spot: JobSpot; beat: number }
  | { kind: "cheer"; until: number }
  | { kind: "visit"; until: number; taps: number; side: number }
  | { kind: "play"; until: number; beat: number; side: number }
  | { kind: "cuddle"; side: number }
  | { kind: "chat"; with: Friend; until: number; beat: number };

export interface Friend {
  id: string;
  sq: Squishy;
  shadow: THREE.Mesh;
  bubble: THREE.Sprite;
  bubbleKey: string;
  state: State;
  /** It is busy with something you asked for (a visit, play, a cuddle). */
  front: boolean;
  appear: number;
}

export interface CrewEvents {
  fx(kind: Fx, at: THREE.Vector3, count?: number): void;
  love(n: number): void;
  jobDone(friend: Friend, job: JobDef): void;
  /** A friend came up front; show a little word. */
  said(text: string): void;
  name(id: string): string;
}

/** A round bubble over a friend's head: a picture and how far its job has got. */
function drawBubble(c: CanvasRenderingContext2D, icon: string, k: number, heart: boolean): void {
  c.clearRect(0, 0, 128, 128);
  c.fillStyle = "rgba(255,255,255,0.95)";
  c.beginPath();
  c.arc(64, 60, 50, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(52, 104);
  c.lineTo(64, 124);
  c.lineTo(76, 104);
  c.fill();
  if (!heart) {
    c.strokeStyle = "#ffe0ec";
    c.lineWidth = 9;
    c.beginPath();
    c.arc(64, 60, 44, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "#ff5f9c";
    c.lineCap = "round";
    c.beginPath();
    c.arc(64, 60, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, k));
    c.stroke();
  }
  c.font = "52px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#ff4f8d";
  c.fillText(icon, 64, 63);
}

export class Crew {
  readonly friends: Friend[] = [];
  private place: PlaceScene | null = null;
  private progress = new Map<JobSpot, number>();
  private nextMoment = 9;
  private sleepyFor = 0;
  private frame = 0;
  private now = 0;
  /** Set while you can't see the closet (a card or the book is open). */
  paused = false;

  constructor(
    private scene: THREE.Scene,
    private main: Squishy,
    private shadowMat: THREE.MeshBasicMaterial,
    private ev: CrewEvents,
  ) {}

  /** Makes the friends out match `team` (ids with their designs and hats). */
  setTeam(team: { id: string; def: SquishyDef; hat: string | null; mood: MoodId }[]): void {
    // Keep a friend that is still out; reuse a body for a newcomer.
    const keep = new Map(this.friends.map((f) => [f.id, f]));
    const spare = this.friends.filter((f) => !team.some((t) => t.id === f.id));
    const next: Friend[] = [];
    for (const t of team) {
      let f = keep.get(t.id);
      if (!f) {
        const reuse = spare.shift();
        if (reuse) {
          // Swapped with another: it changes right where it stands, with a sparkle.
          f = reuse;
          this.release(f);
          f.sq.setDesign(t.def, t.hat);
          f.sq.express("happy", 1);
          f.sq.bounce(4);
          this.ev.fx("sparkle", f.sq.topPoint(), 10);
        } else {
          f = this.makeFriend(t.def);
          f.sq.setDesign(t.def, t.hat);
          this.arrive(f, next.length);
        }
        f.id = t.id;
      }
      f.sq.setHat(t.hat);
      f.sq.mood = moodById(t.mood);
      next.push(f);
    }
    for (const f of spare) this.removeFriend(f);
    this.friends.length = 0;
    this.friends.push(...next);
  }

  private makeFriend(def: SquishyDef): Friend {
    const sq = new Squishy(def, {
      fx: (kind, at, count) => this.ev.fx(kind, at, count),
      love: (n) => this.ev.love(n),
      did: () => {},
    });
    sq.autoSleep = false;
    sq.cheapSquash = 0.45;
    sq.group.scale.setScalar(FRIEND_SCALE);
    this.scene.add(sq.group);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), this.shadowMat.clone());
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    bubble.renderOrder = 5;
    bubble.scale.setScalar(0.7);
    bubble.visible = false;
    this.scene.add(bubble);
    return { id: "", sq, shadow, bubble, bubbleKey: "", state: { kind: "idle", until: 0 }, front: false, appear: 0 };
  }

  private removeFriend(f: Friend): void {
    this.release(f);
    this.ev.fx("sparkle", f.sq.topPoint(), 6);
    this.scene.remove(f.sq.group, f.shadow, f.bubble);
  }

  /** Stops whatever a friend was doing. */
  private release(f: Friend): void {
    const st = f.state;
    if (st.kind === "chat") {
      const other = st.with;
      if (other.state.kind === "chat" && other.state.with === f) other.state = { kind: "idle", until: this.now + 1 };
    }
    if (st.kind === "cuddle" || st.kind === "visit" || st.kind === "play") this.main.yawTarget = 0;
    f.sq.lean(0, 0);
    f.sq.wakeUp();
    f.front = false;
    f.state = { kind: "idle", until: this.now + 1 + Math.random() * 2 };
  }

  /** A friend pops in at a free wander spot. */
  private arrive(f: Friend, i: number): void {
    const spots = this.place?.wander ?? [new THREE.Vector3(i * 1.5 - 1.5, 0, -4)];
    f.sq.placeAt(spots[(i * 2 + this.friends.length) % spots.length]);
    f.sq.yawTarget = 0;
    f.appear = 0.001;
    f.sq.express("happy", 1);
    f.sq.bounce(4);
    this.ev.fx("sparkle", f.sq.topPoint(), 8);
  }

  setPlace(p: PlaceScene): void {
    this.place = p;
    this.progress.clear();
    this.friends.forEach((f, i) => {
      this.release(f);
      f.sq.placeAt(p.wander[i % p.wander.length]);
      f.sq.yawTarget = 0;
      f.appear = 0.001;
    });
    this.nextMoment = Math.max(this.nextMoment, 8);
  }

  /** The friend under a screen ray, if any. */
  hit(ray: THREE.Raycaster): Friend | null {
    let best: Friend | null = null;
    let bestD = Infinity;
    for (const f of this.friends) {
      const h = ray.intersectObject(f.sq.mesh, false)[0] ?? ray.intersectObject(f.sq.group, true)[0];
      if (h && h.distance < bestD) {
        bestD = h.distance;
        best = f;
      }
    }
    return best;
  }

  /** You tapped a friend. */
  tap(f: Friend, at: THREE.Vector3): void {
    const st = f.state;
    const top = f.sq.topPoint();
    if (st.kind === "visit") {
      st.taps++;
      f.sq.bounce(3.6);
      f.sq.express("love", 0.8, 0.8);
      sfx.squeak(f.sq.pitch * (1.05 + st.taps * 0.06), 0.12, 0.28);
      this.ev.fx("heart", top, 3);
      this.ev.love(3);
      if (st.taps >= 3) {
        this.ev.fx("sparkle", top, 10);
        sfx.chime(false);
        this.cheerThenGo(f);
      }
      return;
    }
    if (st.kind === "work") {
      // Helping: the job goes faster.
      const k = (this.progress.get(st.spot) ?? 0) + 0.14;
      this.progress.set(st.spot, Math.min(0.999, k));
      f.sq.bounce(3);
      f.sq.express("happy", 0.8, 0.6);
      sfx.squeak(f.sq.pitch * 1.15, 0.08, 0.22);
      this.ev.fx("sparkle", top, 4);
      this.ev.love(1);
      return;
    }
    if (st.kind === "cuddle") {
      this.ev.fx("heart", top, 2);
      this.ev.love(1);
      return;
    }
    f.sq.tap(f.sq.localDir(at));
    f.sq.yawTarget = 0;
  }

  private cheerThenGo(f: Friend): void {
    f.state = { kind: "cheer", until: this.now + 1.2 };
    f.sq.express("happy", 1.2, 1);
    f.sq.bounce(4.4);
  }

  /** The one you hold sends a friend back, eg when you start tossing or open a box. */
  sendAllBack(): void {
    for (const f of this.friends) if (f.front) this.release(f);
  }

  update(dt: number, now: number, bounds: Bounds): void {
    this.now = now;
    this.frame++;
    if (!this.place) return;
    this.stepMoments(dt);
    this.friends.forEach((f, i) => {
      this.think(f, dt);
      // Friends far away reshape every other frame to save effort.
      f.sq.update(dt, now, bounds, f.front || (this.frame + i) % 2 === 0);
      if (f.appear > 0 && f.appear < 1) {
        f.appear = Math.min(1, f.appear + dt * 3);
        const k = f.appear;
        f.sq.group.scale.setScalar(FRIEND_SCALE * (k + Math.sin(k * Math.PI) * 0.25));
      }
      const p = f.sq.group.position;
      f.shadow.position.set(p.x, 0.006, p.z);
      const lift = Math.max(0, p.y - f.sq.home.y);
      const s = (FRIEND_SCALE * 0.95) / (1 + lift * 0.4);
      f.shadow.scale.setScalar(s);
      this.drawBubbleFor(f);
    });
    for (const spot of this.place.spots) {
      const worker = this.friends.find((f) => f.state.kind === "work" && f.state.spot === spot && f.sq.isHome);
      spot.show(this.progress.get(spot) ?? 0, !!worker, now, dt);
    }
  }

  private drawBubbleFor(f: Friend): void {
    const st = f.state;
    let key = "";
    let icon = "";
    let k = 0;
    let heart = false;
    if (st.kind === "work" && f.sq.isHome) {
      k = this.progress.get(st.spot) ?? 0;
      icon = st.spot.job.icon;
      key = `${icon}${Math.round(k * 40)}`;
    } else if (st.kind === "visit" && f.sq.isHome) {
      icon = "💗";
      heart = true;
      key = "heart";
    }
    f.bubble.visible = !!key && !this.paused;
    if (!key) return;
    if (key !== f.bubbleKey) {
      f.bubbleKey = key;
      const tex = (f.bubble.material as THREE.SpriteMaterial).map as THREE.CanvasTexture;
      drawBubble((tex.image as HTMLCanvasElement).getContext("2d")!, icon, k, heart);
      tex.needsUpdate = true;
    }
    const top = f.sq.topPoint();
    f.bubble.position.set(top.x, top.y + 0.55 + (heart ? Math.sin(this.now * 5) * 0.06 : 0), top.z);
    f.bubble.scale.setScalar(heart ? 0.62 + Math.sin(this.now * 5) * 0.05 : 0.62);
  }

  // ---- what each friend does next -------------------------------------------

  private think(f: Friend, dt: number): void {
    const st = f.state;
    const sq = f.sq;
    if (!sq.isHome && st.kind !== "move") return;
    switch (st.kind) {
      case "move":
        return;
      case "idle":
        if (this.now >= st.until) this.choose(f);
        return;
      case "cheer":
        if (this.now >= st.until) {
          this.release(f);
          f.state = { kind: "idle", until: 0 };
          this.choose(f);
        }
        return;
      case "work": {
        const k = (this.progress.get(st.spot) ?? 0) + dt / st.spot.job.time;
        this.progress.set(st.spot, Math.min(1, k));
        st.beat -= dt;
        this.workMove(f, st.spot.job, st);
        if (k >= 1) {
          sq.wakeUp();
          sq.lean(0, 0);
          sq.yawTarget = 0;
          this.ev.fx("star", sq.topPoint(), 5);
          this.ev.fx("sparkle", sq.topPoint(), 8);
          sfx.chime(false);
          this.ev.jobDone(f, st.spot.job);
          this.cheerThenGo(f);
        }
        return;
      }
      case "visit":
        sq.yawTarget = -Math.sign(sq.home.x) * 0.35;
        if (this.now >= st.until) {
          // Waited a while: a little wave and off it goes.
          sq.express("happy", 0.6);
          this.release(f);
          this.choose(f);
        }
        return;
      case "play": {
        st.beat -= dt;
        sq.yawTarget = -Math.sign(sq.home.x) * 1.2;
        this.main.yawTarget = Math.sign(sq.home.x) * 0.45;
        if (st.beat <= 0) {
          // Take turns bouncing, then both together.
          st.beat = 0.7;
          const turn = Math.floor(this.now / 0.7) % 3;
          if (turn !== 1) sq.bounce(3.8);
          if (turn !== 0 && this.main.isHome) this.main.bounce(3.2);
          sfx.giggle(turn === 1 ? this.main.pitch : sq.pitch);
          this.ev.fx("note", turn === 1 ? this.main.topPoint() : sq.topPoint(), 1);
          sq.express("giggle", 0.6, 0.5);
          this.main.express("giggle", 0.6, 0.5);
        }
        if (this.now >= st.until) {
          this.ev.fx("heart", sq.topPoint(), 3);
          this.ev.love(4);
          this.main.yawTarget = 0;
          this.cheerThenGo(f);
        }
        return;
      }
      case "cuddle":
        sq.yawTarget = -Math.sign(sq.home.x) * 1.0;
        sq.lean(-Math.sign(sq.home.x) * 0.16, 0);
        if (!this.main.isSleeping) {
          sq.wakeUp();
          sq.lean(0, 0);
          this.ev.fx("heart", sq.topPoint(), 3);
          this.cheerThenGo(f);
        } else if (Math.random() < dt * 0.25) this.ev.fx("heart", sq.topPoint(), 1);
        return;
      case "chat":
        st.beat -= dt;
        sq.yawTarget = Math.atan2(st.with.sq.home.x - sq.home.x, st.with.sq.home.z - sq.home.z);
        if (st.beat <= 0) {
          st.beat = 0.9 + Math.random() * 0.5;
          sq.bounce(3);
          sq.express(Math.random() < 0.5 ? "happy" : "giggle", 0.5, 0.7);
          if (Math.random() < 0.4) this.ev.fx("note", sq.topPoint(), 1);
        }
        if (this.now >= st.until) {
          sq.yawTarget = 0;
          this.release(f);
        }
        return;
    }
  }

  private workMove(f: Friend, job: JobDef, st: { beat: number }): void {
    const sq = f.sq;
    if (st.beat > 0) return;
    switch (job.move) {
      case "bob":
        st.beat = 0.6;
        sq.bounce(2.8);
        break;
      case "wiggle":
        st.beat = 0.5;
        sq.wiggle();
        break;
      case "lean":
        st.beat = 1.4;
        sq.lean(0, 0.2);
        sq.express("happy", 0.8, 0.4);
        break;
      case "nap":
        st.beat = 99;
        sq.nap();
        break;
      case "spin":
        st.beat = 1.3;
        sq.bounce(3.6);
        sq.yawTarget += Math.PI;
        break;
    }
  }

  /** Picks something to do: a job, a wander, or a chat with another friend. */
  private choose(f: Friend): void {
    const p = this.place!;
    // Personality tips the odds: hard workers pick jobs, chatty ones find a pal.
    const m = f.sq.mood;
    const work = 0.62 * m.work;
    const chat = 0.18 * m.chat;
    const r = Math.random() * Math.max(1, work + chat + 0.2);
    if (m.id === "sleepy" && Math.random() < 0.15) {
      f.sq.nap();
      f.state = { kind: "idle", until: this.now + 8 + Math.random() * 6 };
      return;
    }
    const busy = new Set(this.friends.map((o) => (o.state.kind === "work" ? o.state.spot : null)));
    const free = p.spots.filter((s) => !busy.has(s));
    if (r < work && free.length) {
      const spot = free[Math.floor(Math.random() * free.length)];
      if ((this.progress.get(spot) ?? 0) >= 1) this.progress.set(spot, 0);
      this.goTo(f, spot.at, () => {
        f.sq.yawTarget = spot.yaw;
        f.state = { kind: "work", spot, beat: 0.3 };
      });
      return;
    }
    const pal = this.friends.find((o) => o !== f && o.state.kind === "idle" && o.sq.isHome);
    if (r < work + chat && pal) {
      const mid = f.sq.home.clone().add(pal.sq.home).multiplyScalar(0.5);
      const dir = pal.sq.home.clone().sub(f.sq.home).setY(0);
      if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
      dir.normalize().multiplyScalar(0.85);
      const until = this.now + 4 + Math.random() * 2;
      const a: State = { kind: "chat", with: pal, until, beat: 0.6 };
      const b: State = { kind: "chat", with: f, until, beat: 0.2 };
      this.goTo(f, mid.clone().sub(dir), () => (f.state = a));
      this.goTo(pal, mid.clone().add(dir), () => (pal.state = b));
      return;
    }
    const spot = p.wander[Math.floor(Math.random() * p.wander.length)];
    this.goTo(f, spot, () => {
      f.sq.yawTarget = (Math.random() - 0.5) * 0.8;
      f.state = { kind: "idle", until: this.now + 2.5 + Math.random() * 3 };
    });
  }

  private goTo(f: Friend, at: THREE.Vector3, then: () => void): void {
    f.state = { kind: "move" };
    // Don't land right on top of another friend.
    const target = at.clone();
    for (const o of this.friends) {
      if (o === f) continue;
      const d = Math.hypot(o.sq.home.x - target.x, o.sq.home.z - target.z);
      if (d < 1.3) target.x += target.x > o.sq.home.x ? 1.3 - d : d - 1.3;
    }
    f.sq.hopTo(target, { then });
  }

  // ---- moments up front -----------------------------------------------------

  private stepMoments(dt: number): void {
    const main = this.main;
    if (this.paused || !main.isHome) return;
    // The one you hold fell asleep: a friend comes to cuddle up.
    // (One at a time: anyone already up front, or on the way, counts.)
    const cuddler = this.friends.find((f) => f.front);
    if (main.isSleeping) {
      this.sleepyFor += dt;
      if (!cuddler && this.sleepyFor > 2.5) {
        const f = this.pickFriend();
        if (f) this.comeUp(f, "cuddle");
      }
      return;
    }
    this.sleepyFor = 0;
    if (this.friends.some((f) => f.front)) return;
    this.nextMoment -= dt;
    if (this.nextMoment > 0) return;
    this.nextMoment = 22 + Math.random() * 20;
    const f = this.pickFriend();
    if (f) this.comeUp(f, Math.random() < 0.55 ? "visit" : "play");
  }

  /** Someone free to come up front; friendlier personalities come more often. */
  private pickFriend(): Friend | null {
    const ok = this.friends.filter((f) => !f.front && (f.state.kind === "idle" || f.state.kind === "work" || f.state.kind === "chat") && f.sq.isHome);
    let total = 0;
    for (const f of ok) total += f.sq.mood.visit;
    let r = Math.random() * total;
    for (const f of ok) {
      r -= f.sq.mood.visit;
      if (r < 0) return f;
    }
    return ok[ok.length - 1] ?? null;
  }

  private comeUp(f: Friend, what: "visit" | "play" | "cuddle"): void {
    this.release(f);
    f.front = true;
    const side = f.sq.home.x < 0 ? 0 : 1;
    const spot = (what === "cuddle" ? FRONT.cuddle : FRONT.visit)[side];
    const name = this.ev.name(f.id);
    this.goTo(f, spot, () => {
      if (!f.front) return;
      f.sq.yawTarget = 0;
      if (what === "visit") {
        f.state = { kind: "visit", until: this.now + 11, taps: 0, side };
        f.sq.express("love", 1.2, 1);
        sfx.squeak(f.sq.pitch * 1.2, 0.14, 0.3);
        this.ev.said(sayLine(f.sq.mood, name));
        setTimeout(() => f.sq.quirk(), 1300);
      } else if (what === "play") {
        f.state = { kind: "play", until: this.now + 6.5, beat: 0.4, side };
        this.ev.said(`${name} came to play!`);
      } else {
        f.state = { kind: "cuddle", side };
        f.sq.nap();
        this.ev.fx("heart", f.sq.topPoint(), 3);
      }
    });
    f.state = { kind: "move" };
  }
}
