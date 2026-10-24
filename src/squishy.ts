// One squishy: the soft body you can squash, dent, jiggle and toss, its face,
// and how it reacts to everything. Springs drive all motion, so no two touches
// look quite the same.

import * as THREE from "three";
import { BOTTOM_Y, CENTER_Y, RINGS, SEG, buildFacePatch, buildGrid, deform, restDeform, vid, type Deform } from "./bao";
import { drawFace, FACE_H, FACE_W, type Expression } from "./face";
import type { Look } from "./looks";
import * as sfx from "./audio";
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

export type Fx = "heart" | "sparkle" | "star" | "zz" | "note";

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

export class Squishy {
  readonly group = new THREE.Group(); // moves around the world
  private body = new THREE.Group(); // rotates about the bottom
  readonly mesh: THREE.Mesh;
  private face: THREE.Mesh;
  private grid = buildGrid();
  private patch = buildFacePatch();
  private pos: Float32Array;
  private geo: THREE.BufferGeometry;
  private faceGeo: THREE.BufferGeometry;
  private faceCanvas: HTMLCanvasElement;
  private faceCtx: CanvasRenderingContext2D;
  private faceTex: THREE.CanvasTexture;
  private material!: THREE.MeshPhysicalMaterial;
  private time = { value: 0 };
  private look!: Look;

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
    look: Look,
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
    this.faceGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.patch.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.faceGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(this.patch.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.faceGeo.setAttribute("uv", new THREE.BufferAttribute(this.patch.uv, 2));
    this.faceGeo.setIndex(new THREE.BufferAttribute(this.patch.index, 1));
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
    this.body.add(this.mesh, this.face);
    this.body.position.y = BOTTOM_Y; // pivot at the bottom
    this.mesh.position.y = -BOTTOM_Y;
    this.face.position.y = -BOTTOM_Y;
    this.group.add(this.body);
    this.setLook(look);
  }

  setLook(look: Look): void {
    this.look = look;
    const color = new THREE.Color(look.color);
    const base: THREE.MeshPhysicalMaterialParameters = {
      color,
      roughness: 0.5,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
    };
    if (look.finish === "matte") Object.assign(base, { roughness: 0.68, clearcoat: 0.2, clearcoatRoughness: 0.5 });
    if (look.finish === "shiny") Object.assign(base, { roughness: 0.4, clearcoat: 0.85, clearcoatRoughness: 0.14 });
    if (look.finish === "glitter") Object.assign(base, { roughness: 0.42, metalness: 0.5, clearcoat: 0.75, clearcoatRoughness: 0.2, sheen: 0.2 });
    this.material?.dispose();
    const m = new THREE.MeshPhysicalMaterial(base);
    if (look.finish === "glitter") addGlitter(m, this.time, new THREE.Color(look.sparkle ?? "#ffffff"));
    this.material = m;
    this.mesh.material = m;
    this.faceKey = "";
  }

  get pitch(): number {
    return this.look.pitch;
  }

  get isHome(): boolean {
    return this.mode === "home";
  }

  get isHugging(): boolean {
    return this.hugging;
  }

  giveLove(n: number): void {
    this.ev.love(n);
  }

  /** World position of a point on the squishy's front, for effects. */
  topPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.group.localToWorld(out.set(0, 0.95 - this.squash.x * 0.6 + this.hopY, 0.2));
  }

  // ---- touches -------------------------------------------------------

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
    this.squash.v += 1.6;
    this.dentDir.copy(dir);
    this.dent.v += 2.2;
    if (nose) {
      this.setExpr("surprised", 0.3);
      setTimeout(() => this.setExpr("happy", 0.9), 300);
      this.hop(4.2);
      sfx.boing(this.pitch);
      this.ev.love(3);
      this.ev.fx("sparkle", this.topPoint(), 5);
    } else {
      this.setExpr(Math.random() < 0.5 ? "surprised" : "squeeze", 0.25);
      setTimeout(() => this.setExpr("happy", 0.5), 260);
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
    this.squash.target = 0.12 + 0.36 * k;
    this.dent.target = 0.1 + 0.2 * k;
    this.setExpr("squeeze", 0.2);
    if (held > 0.6) this.ev.did("hold");
  }

  pressEnd(held: number): void {
    if (!this.pressing) return;
    this.pressing = false;
    this.squash.target = 0;
    this.dent.target = 0;
    // A long squish rises back slowly, like a real slow-rise squishy.
    this.slowRise = held > 0.45 ? 1.1 : 0;
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
    this.melt.target = 0.12;
    this.squash.target = 0.22;
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
      this.hopV = v;
      this.squash.v -= 2.5;
    }, 90);
  }

  private setExpr(e: Expression, seconds: number): void {
    this.exprOverride = e;
    this.exprUntil = this.now + seconds;
  }

  // ---- every frame ---------------------------------------------------

  update(dt: number, now: number, bounds: Bounds): void {
    this.now = now;
    this.time.value = now;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) this.stepPhysics(h, bounds);
    this.stepIdle(dt);
    this.stepFace(dt);
    this.rebuild();
  }

  private stepPhysics(dt: number, b: Bounds): void {
    // Slow rise: very damped until it has nearly puffed back up.
    if (this.slowRise > 0) {
      this.slowRise -= dt;
      this.squash.c = 26;
      this.dent.c = 30;
      this.squash.k = 40;
      this.dent.k = 40;
      if (this.slowRise <= 0) {
        this.squash.v -= 0.6;
        this.d.waves.push({ x: this.dentDir.x, y: this.dentDir.y, z: this.dentDir.z, age: 0, amp: 0.035 });
      }
    } else {
      this.squash.c = 7;
      this.dent.c = 13;
      this.squash.k = 150;
      this.dent.k = 160;
    }
    const breath = this.sleeping ? Math.sin(this.now * 1.3) * 0.03 : Math.sin(this.now * 2.2) * 0.012;
    const keep = this.squash.target;
    this.squash.target = keep + (this.mode === "home" && !this.pressing ? breath : 0);
    for (const sp of [this.squash, this.dent, this.leanX, this.leanZ, this.melt, this.turn]) sp.step(dt);
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
        const hops = 3;
        const hopTime = 0.48;
        const total = hops * hopTime;
        const t = Math.min(1, this.modeTime / total);
        const k = Math.min(hops - 1, Math.floor(this.modeTime / hopTime));
        const local = (this.modeTime - k * hopTime) / hopTime;
        const prevK = Math.min(hops - 1, Math.floor((this.modeTime - dt) / hopTime));
        if (k !== prevK || t >= 1) {
          this.squash.v += 3.4;
          sfx.squeak(this.pitch * (1 + 0.08 * k), 0.08, 0.2);
        }
        const p = this.group.position;
        p.x = THREE.MathUtils.lerp(this.returnFrom.x, this.home.x, t);
        p.z = THREE.MathUtils.lerp(this.returnFrom.z, this.home.z, t);
        const baseY = THREE.MathUtils.lerp(this.returnFrom.y, this.home.y, t);
        p.y = baseY + (t >= 1 ? 0 : Math.sin(Math.PI * local) * (0.55 + 0.35 * (k === hops - 1 ? 1 : 0)));
        if (t >= 1) {
          p.copy(this.home);
          this.mode = "home";
          this.setExpr("happy", 1);
          this.ev.fx("sparkle", this.topPoint(), 4);
          this.ev.love(2);
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
    if (this.pressing || this.hugging || this.mode !== "home") {
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
    if (this.idleFor > 24 && this.idleFor - dt <= 24) {
      this.setExpr("sleepy", 1.6);
      this.talk = 1;
      sfx.yawn(this.pitch);
    }
    if (this.idleFor > 26) {
      this.sleeping = true;
      this.zzAt = this.now + 0.5;
      return;
    }
    this.nextFidget -= dt;
    if (this.nextFidget <= 0) {
      this.nextFidget = 5 + Math.random() * 5;
      const r = Math.random();
      if (r < 0.35) this.turn.v += (Math.random() < 0.5 ? -1 : 1) * 3.5;
      else if (r < 0.6) {
        this.hop(3.4);
        sfx.squeak(this.pitch * 1.2, 0.07, 0.15);
      } else {
        this.lookTX = Math.random() * 2 - 1;
        this.lookTY = Math.random() - 0.5;
      }
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
      ink: this.look.ink,
      blush: this.look.blush,
    });
    this.faceTex.needsUpdate = true;
  }

  private rebuild(): void {
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
    deform(this.grid, this.d, this.pos);
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
    // Whole-body motion
    if (this.mode === "home") this.group.position.copy(this.home);
    this.body.position.y = BOTTOM_Y + this.hopY + (this.mode === "home" ? 0 : 0);
    this.body.rotation.set(0, this.turn.x * 0.25, this.tilt.x);
    // Roll about the middle, not the bottom, so a roll looks like a roll.
    const roll = this.tilt.x - Math.round(this.tilt.x / (Math.PI * 2)) * Math.PI * 2;
    this.body.position.x = Math.sin(roll) * 0.45;
    this.body.position.y += (1 - Math.cos(roll)) * 0.45;
  }
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
          vec2 gp = vUv * vec2(300.0, 170.0);
          vec2 cell = floor(gp);
          float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
          float h2 = fract(h * 91.7 + 0.13);
          vec2 f = fract(gp) - 0.5;
          float fleck = smoothstep(0.45, 0.05, length(f));
          vec3 facet = normalize(normal + vec3(h - 0.5, h2 - 0.5, 0.0) * 1.4);
          float glint = pow(max(0.0, dot(facet, normalize(vec3(0.35, 0.55, 0.75)))), 28.0);
          float tw = 0.55 + 0.45 * sin(uTime * 2.6 + h * 40.0);
          diffuseColor.rgb *= 0.85 + 0.3 * h;
          totalEmissiveRadiance += uSparkle * fleck * glint * tw * 2.2 * step(0.3, h2);
        }`,
      );
  };
  m.customProgramCacheKey = () => "glitter";
}
