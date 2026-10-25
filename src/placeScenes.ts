// The 3D places behind your squishy: the tea table, a sunny beach, a sailing
// boat and a living room. Each has spots where friends do jobs (the prop at a
// spot shows how far along the job is), spots to wander to, and its own sky.
// The basket your squishy sits in stays in front in every place.

import * as THREE from "three";
import { canvasTex } from "./scene";
import { placeById, type JobDef, type PlaceId } from "./places";

export interface JobSpot {
  job: JobDef;
  /** Where the worker stands, and which way it faces while it works. */
  at: THREE.Vector3;
  yaw: number;
  /** Shows the job: k is 0 (just started) to 1 (done); `working` while someone is at it. */
  show(k: number, working: boolean, t: number, dt: number): void;
}

export interface PlaceScene {
  id: PlaceId;
  group: THREE.Group;
  sky: THREE.Texture;
  fog: THREE.Fog;
  /** Colors for the soft fill light: sky and ground. */
  light: [string, string];
  spots: JobSpot[];
  /** Spots to wander to and rest at. */
  wander: THREE.Vector3[];
  update(dt: number, t: number): void;
  /** The view rocks gently on the boat. */
  sway(t: number): { roll: number; bob: number };
}

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const std = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts });

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

function skyTex(top: string, mid: string, bottom: string, at = 0.5): THREE.CanvasTexture {
  return canvasTex(16, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, top);
    g.addColorStop(at, mid);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 512);
  });
}

/** Turns from a spot to face a point. */
const yawTo = (from: THREE.Vector3, x: number, z: number) => Math.atan2(x - from.x, z - from.z);
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
/** Pops a thing in when k passes `at`, with a little overshoot. */
const popIn = (k: number, at: number, span = 0.12) => {
  const u = Math.min(1, Math.max(0, (k - at) / span));
  return u <= 0 ? 0.0001 : u + Math.sin(u * Math.PI) * 0.3;
};

/** Little floating bubbles, puffs or drops that rise and fade. */
class Puffs {
  readonly group = new THREE.Group();
  private items: { m: THREE.Mesh; life: number; v: THREE.Vector3 }[] = [];
  private next = 0;
  constructor(
    private make: () => THREE.Mesh,
    private every: number,
    private rise: () => THREE.Vector3,
    private lifeSpan = 1.6,
  ) {}
  step(on: boolean, dt: number): void {
    this.next -= dt;
    if (on && this.next <= 0) {
      this.next = this.every * (0.6 + Math.random() * 0.8);
      const m = this.make();
      this.group.add(m);
      this.items.push({ m, life: 0, v: this.rise() });
    }
    for (const it of this.items) {
      it.life += dt;
      it.m.position.addScaledVector(it.v, dt);
      it.v.y -= 0.0 * dt;
      const k = it.life / this.lifeSpan;
      it.m.scale.setScalar(Math.max(0.001, Math.sin(Math.min(1, k) * Math.PI) * 1.1));
    }
    for (const it of this.items.filter((i) => i.life >= this.lifeSpan)) {
      this.group.remove(it.m);
      it.m.geometry.dispose();
    }
    this.items = this.items.filter((i) => i.life < this.lifeSpan);
  }
}

function jobs(place: PlaceId): Record<string, JobDef> {
  return Object.fromEntries(placeById(place).jobs.map((j) => [j.id, j]));
}

// ---- the tea table ------------------------------------------------------

function buildTable(): PlaceScene {
  const g = new THREE.Group();
  const table = add(g, new THREE.CircleGeometry(16, 64), std("#ffe6ee", { roughness: 0.92 }));
  table.rotation.x = -Math.PI / 2;
  const dotGeo = new THREE.CircleGeometry(0.06, 16);
  const dotColors = ["#ffffff", "#ffd1e6", "#d8ccff", "#ffe9a8"];
  for (let i = 0; i < 70; i++) {
    const a = (i * 2.39) % (Math.PI * 2);
    const r = 1.8 + ((i * 37) % 70) / 10;
    const m = add(g, dotGeo, new THREE.MeshBasicMaterial({ color: dotColors[i % 4] }), Math.cos(a) * r, 0.003, Math.sin(a) * r - 1);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(0.6 + ((i * 13) % 9) / 10);
  }
  const J = jobs("table");
  // Big sweets in the back, like a giant tea party.
  const macColors = ["#ffb3d1", "#c9e7a6", "#c9a8f0"];
  macColors.forEach((col, i) => {
    const mac = new THREE.Group();
    add(mac, new THREE.CylinderGeometry(0.55, 0.55, 0.28, 32), std(col, { roughness: 0.5 }), 0, 0.14, 0);
    add(mac, new THREE.CylinderGeometry(0.5, 0.5, 0.12, 32), std("#fff6ea"), 0, 0.34, 0);
    add(mac, new THREE.CylinderGeometry(0.55, 0.55, 0.28, 32), std(col, { roughness: 0.5 }), 0, 0.54, 0);
    mac.position.set(-4.6 + i * 1.1, i * 0.68, -7.5);
    g.add(mac);
  });
  const cake = new THREE.Group();
  add(cake, new THREE.CylinderGeometry(1.1, 1.15, 0.9, 40), std("#fff3f8", { roughness: 0.5 }), 0, 0.45, 0);
  add(cake, new THREE.CylinderGeometry(0.8, 0.85, 0.7, 40), std("#ffc6df", { roughness: 0.5 }), 0, 1.25, 0);
  add(cake, new THREE.SphereGeometry(0.22, 16, 12), std("#ff4f6a", { roughness: 0.3 }), 0, 1.75, 0);
  cake.position.set(4.2, 0, -7.2);
  g.add(cake);

  // Pour the tea: the pot tips and the cup fills.
  const teaAt = V(-2.2, -2.6);
  const pot = new THREE.Group();
  const potBody = add(pot, new THREE.SphereGeometry(0.42, 24, 18), std("#ffffff", { roughness: 0.3 }), 0, 0.42, 0);
  potBody.scale.y = 0.85;
  add(pot, new THREE.SphereGeometry(0.16, 16, 10), std("#ff9ec4", { roughness: 0.3 }), 0, 0.8, 0);
  const spout = add(pot, new THREE.CylinderGeometry(0.05, 0.1, 0.45, 12), std("#ffffff", { roughness: 0.3 }), 0.45, 0.48, 0);
  spout.rotation.z = -0.9;
  const handle = add(pot, new THREE.TorusGeometry(0.2, 0.045, 8, 20), std("#ff9ec4"), -0.42, 0.45, 0);
  handle.rotation.y = Math.PI / 2;
  const potHolder = new THREE.Group();
  potHolder.add(pot);
  potHolder.position.set(-2.9, 0, -3.1);
  g.add(potHolder);
  const cup = new THREE.Group();
  add(cup, new THREE.CylinderGeometry(0.22, 0.16, 0.26, 20, 1, true), std("#ffffff", { side: THREE.DoubleSide }), 0, 0.13, 0);
  add(cup, new THREE.CircleGeometry(0.17, 20).rotateX(-Math.PI / 2), std("#ffffff"), 0, 0.01, 0);
  const tea = add(cup, new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2), std("#c98d58", { roughness: 0.2 }), 0, 0.02, 0);
  cup.position.set(-2.15, 0, -3.35);
  g.add(cup);
  const steam = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7 })),
    0.35,
    () => new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.5, 0),
  );
  steam.group.position.set(-2.15, 0.3, -3.35);
  g.add(steam.group);

  // Bake cookies: they pop onto the tray one by one.
  const cookAt = V(2.2, -2.8);
  const tray = new THREE.Group();
  add(tray, new THREE.BoxGeometry(1.1, 0.06, 0.8), std("#b7bec8", { metalness: 0.5, roughness: 0.4 }), 0, 0.03, 0);
  const cookies: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const c = add(tray, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18), std(i % 2 ? "#d9a265" : "#c98d58"), -0.34 + (i % 3) * 0.34, 0.09, -0.18 + Math.floor(i / 3) * 0.36);
    for (let k = 0; k < 3; k++) add(c, new THREE.SphereGeometry(0.03, 6, 5), std("#5a3a24"), Math.cos(k * 2.1) * 0.07, 0.03, Math.sin(k * 2.1) * 0.07);
    cookies.push(c);
  }
  tray.position.set(2.85, 0, -3.3);
  g.add(tray);

  // Blow bubbles: a wand, and bubbles drifting up.
  const bubAt = V(0.6, -4.6);
  const wand = new THREE.Group();
  add(wand, new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), std("#ff9ec4"), 0, 0.3, 0);
  const ring = add(wand, new THREE.TorusGeometry(0.12, 0.025, 8, 20), std("#ff9ec4"), 0, 0.68, 0);
  wand.position.set(0.95, 0, -4.9);
  wand.rotation.z = -0.4;
  g.add(wand);
  const bubbles = new Puffs(
    () =>
      new THREE.Mesh(
        new THREE.SphereGeometry(0.12 + Math.random() * 0.1, 16, 12),
        new THREE.MeshPhysicalMaterial({ color: "#e6f6ff", transparent: true, opacity: 0.35, roughness: 0, clearcoat: 1, iridescence: 1 }),
      ),
    0.3,
    () => new THREE.Vector3((Math.random() - 0.3) * 0.6, 0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3),
    2.6,
  );
  bubbles.group.position.set(1.15, 0.75, -4.9);
  g.add(bubbles.group);

  const spots: JobSpot[] = [
    {
      job: J.tea,
      at: teaAt,
      yaw: yawTo(teaAt, -2.9, -3.1),
      show: (k, working, t, dt) => {
        pot.rotation.z = working ? -0.5 - Math.sin(t * 2) * 0.12 : 0;
        pot.position.y = working ? 0.15 : 0;
        tea.position.y = 0.02 + ease(k) * 0.2;
        tea.scale.setScalar(0.75 + ease(k) * 0.3);
        steam.step(k >= 1 || working, dt);
      },
    },
    {
      job: J.cookies,
      at: cookAt,
      yaw: yawTo(cookAt, 2.85, -3.3),
      show: (k) => cookies.forEach((c, i) => c.scale.setScalar(popIn(k, i / 6))),
    },
    {
      job: J.bubbles,
      at: bubAt,
      yaw: yawTo(bubAt, 0.95, -4.9),
      show: (k, working, t, dt) => {
        ring.rotation.y = working ? t * 4 : 0;
        bubbles.step(working, dt);
        void k;
      },
    },
  ];
  return {
    id: "table",
    group: g,
    sky: skyTex("#c9b8ff", "#ffc6df", "#ffe0d0", 0.45),
    fog: new THREE.Fog("#ffd7e2", 16, 34),
    light: ["#fff4fb", "#ffcfb8"],
    spots,
    wander: [V(-1.4, -3.8), V(2.6, -4.8), V(-2.8, -5.2), V(0, -6.2), V(-0.6, -2.4)],
    update: () => {},
    sway: () => ({ roll: 0, bob: 0 }),
  };
}

// ---- the beach ----------------------------------------------------------

function waterTex(base: string, line: string, foam = false): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = line;
    c.lineWidth = 5;
    c.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      const x = (i * 71) % 256;
      const y = (i * 43) % 256;
      c.beginPath();
      c.moveTo(x - 18, y);
      c.quadraticCurveTo(x, y - 9, x + 18, y);
      c.stroke();
    }
    if (foam) {
      c.fillStyle = "rgba(255,255,255,0.25)";
      for (let i = 0; i < 40; i++) c.fillRect((i * 53) % 256, (i * 29) % 256, 6, 3);
    }
  });
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function palm(): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 2.2, 0), new THREE.Vector3(1.1, 3.8, 0.1));
  add(g, new THREE.TubeGeometry(curve, 20, 0.16, 10, false), std("#c98d58", { roughness: 0.9 }));
  const top = new THREE.Group();
  top.position.copy(curve.getPoint(1));
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2, 6, 1), std("#5cbf4a", { roughness: 0.6 }));
    leaf.scale.set(1, 1, 0.22);
    leaf.position.y = 1.05;
    const arm = new THREE.Group();
    arm.rotation.set(0, (i / 7) * Math.PI * 2, 1.15);
    arm.add(leaf);
    top.add(arm);
  }
  for (let i = 0; i < 3; i++) add(top, new THREE.SphereGeometry(0.17, 12, 10), std("#8a5a30"), Math.cos(i * 2.1) * 0.18, -0.15, Math.sin(i * 2.1) * 0.18);
  g.add(top);
  g.userData.top = top;
  return g;
}

function buildBeach(): PlaceScene {
  const g = new THREE.Group();
  const sandTex = canvasTex(256, 256, (c) => {
    c.fillStyle = "#f8deaa";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = i % 3 ? "rgba(200,150,90,0.16)" : "rgba(255,255,255,0.45)";
      c.fillRect((i * 97) % 256, (i * 61) % 256, 2, 2);
    }
  });
  sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(10, 10);
  const sand = add(g, new THREE.PlaneGeometry(40, 18), std("#ffffff", { map: sandTex, roughness: 0.95 }), 0, 0, 2);
  sand.rotation.x = -Math.PI / 2;
  const seaTex = waterTex("#5cc8ec", "rgba(255,255,255,0.55)");
  seaTex.repeat.set(8, 6);
  const sea = add(g, new THREE.PlaneGeometry(80, 40), std("#ffffff", { map: seaTex, roughness: 0.25, metalness: 0.1 }), 0, -0.02, -26.5);
  sea.rotation.x = -Math.PI / 2;
  // The wet edge and foam that slides in and out.
  const wet = add(g, new THREE.PlaneGeometry(40, 1.4), std("#e9c58a", { roughness: 0.5 }), 0, 0.004, -6.4);
  wet.rotation.x = -Math.PI / 2;
  const foamTex = canvasTex(512, 64, (c) => {
    c.fillStyle = "rgba(255,255,255,0)";
    c.clearRect(0, 0, 512, 64);
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(0, 64);
    for (let x = 0; x <= 512; x += 16) c.lineTo(x, 26 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.13) * 5);
    c.lineTo(512, 64);
    c.fill();
  });
  foamTex.repeat.set(4, 1);
  const foam = add(g, new THREE.PlaneGeometry(40, 0.9), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true }), 0, 0.01, -6.9);
  foam.rotation.x = -Math.PI / 2;
  const sun = add(g, new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ color: "#fff3b0", fog: false }), 6, 9, -40);
  void sun;
  const p = palm();
  p.position.set(-4.4, 0, -5.4);
  g.add(p);
  const p2 = palm();
  p2.position.set(5.2, 0, -8.5);
  p2.scale.set(-0.9, 0.9, 0.9);
  g.add(p2);
  // A far little island.
  const isle = add(g, new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std("#8fd27a"), -10, -0.3, -30);
  isle.scale.y = 0.35;

  const J = jobs("beach");
  // Build a sandcastle: towers rise one by one, then a flag.
  const castleAt = V(-2.0, -2.7);
  const castle = new THREE.Group();
  const sandy = std("#efc98a", { roughness: 0.95 });
  const parts: THREE.Object3D[] = [];
  const base = add(castle, new THREE.CylinderGeometry(0.62, 0.7, 0.36, 24), sandy, 0, 0.18, 0);
  parts.push(base);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const tower = new THREE.Group();
    add(tower, new THREE.CylinderGeometry(0.15, 0.17, 0.5, 14), sandy, 0, 0.25, 0);
    add(tower, new THREE.ConeGeometry(0.18, 0.22, 14), sandy, 0, 0.61, 0);
    tower.position.set(Math.cos(a) * 0.48, 0.2, Math.sin(a) * 0.48);
    castle.add(tower);
    parts.push(tower);
  }
  const keep = new THREE.Group();
  add(keep, new THREE.CylinderGeometry(0.24, 0.27, 0.6, 16), sandy, 0, 0.3, 0);
  add(keep, new THREE.ConeGeometry(0.28, 0.3, 16), sandy, 0, 0.75, 0);
  keep.position.y = 0.34;
  castle.add(keep);
  parts.push(keep);
  const flag = new THREE.Group();
  add(flag, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), std("#8a5a30"), 0, 0.17, 0);
  const cloth = add(flag, new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshStandardMaterial({ color: "#ff5f9c", side: THREE.DoubleSide }), 0.1, 0.29, 0);
  flag.position.y = 1.2;
  castle.add(flag);
  parts.push(flag);
  castle.position.set(-2.75, 0, -3.25);
  g.add(castle);
  const bucket = new THREE.Group();
  add(bucket, new THREE.CylinderGeometry(0.2, 0.15, 0.3, 16), std("#ff7fb0"), 0, 0.15, 0);
  bucket.position.set(-1.45, 0, -3.5);
  bucket.rotation.z = 0.5;
  g.add(bucket);
  const dust = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), std("#efc98a")),
    0.2,
    () => new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.8, (Math.random() - 0.5) * 0.4),
    0.6,
  );
  dust.group.position.set(-2.4, 0.1, -3.0);
  g.add(dust.group);

  // Dig for shells: a mound, sand flying, then a pretty shell.
  const shellAt = V(2.3, -2.6);
  const mound = add(g, new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), sandy, 2.95, 0, -3.05);
  mound.scale.y = 0.4;
  const shell = new THREE.Group();
  const sh = add(shell, new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std("#ffb3c8", { roughness: 0.35 }));
  sh.scale.set(1, 0.4, 0.85);
  for (let i = -2; i <= 2; i++) {
    const r = add(shell, new THREE.BoxGeometry(0.02, 0.02, 0.36), std("#ff8fae"), i * 0.07, 0.07, 0);
    r.rotation.y = i * 0.25;
  }
  shell.position.set(2.95, 0.15, -3.05);
  g.add(shell);
  const digDust = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), std("#efc98a")),
    0.12,
    () => new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.1, (Math.random() - 0.5) * 0.5),
    0.55,
  );
  digDust.group.position.set(2.85, 0.15, -3.0);
  g.add(digDust.group);

  // Splash in the waves.
  const splashAt = V(0.9, -6.1);
  const drops = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: "#bfefff", transparent: true, opacity: 0.85, roughness: 0.1 })),
    0.07,
    () => new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.4 + Math.random(), (Math.random() - 0.5) * 1.2),
    0.6,
  );
  drops.group.position.set(0.9, 0.2, -6.1);
  g.add(drops.group);

  // Nap in the sun under the umbrella, on a towel.
  const napAt = V(3.0, -4.6);
  const umb = new THREE.Group();
  add(umb, new THREE.CylinderGeometry(0.035, 0.035, 2.4, 8), std("#ffffff"), 0, 1.2, 0);
  const canopyTex = canvasTex(512, 64, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#ffffff" : "#ff7fb0";
      c.fillRect(i * 64, 0, 64, 64);
    }
  });
  add(umb, new THREE.ConeGeometry(1.5, 0.6, 16, 1, true), std("#ffffff", { map: canopyTex, side: THREE.DoubleSide, roughness: 0.6 }), 0, 2.35, 0);
  umb.position.set(3.4, 0, -5.0);
  umb.rotation.z = -0.12;
  g.add(umb);
  const towelTex = canvasTex(64, 128, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#ffffff" : "#7fc8f0";
      c.fillRect(0, i * 16, 64, 16);
    }
  });
  const towel = add(g, new THREE.PlaneGeometry(1.2, 1.9), std("#ffffff", { map: towelTex }), 3.0, 0.006, -4.7);
  towel.rotation.set(-Math.PI / 2, 0, 0.3);

  // A little crab scuttling along the shore.
  const crab = new THREE.Group();
  const crabBody = add(crab, new THREE.SphereGeometry(0.2, 16, 10), std("#ff6a5a", { roughness: 0.4 }), 0, 0.14, 0);
  crabBody.scale.set(1.3, 0.7, 1);
  for (const s of [-1, 1]) {
    add(crab, new THREE.SphereGeometry(0.08, 10, 8), std("#ff6a5a"), s * 0.3, 0.17, 0.1);
    add(crab, new THREE.SphereGeometry(0.04, 8, 6), std("#ffffff"), s * 0.07, 0.28, 0.12);
    add(crab, new THREE.SphereGeometry(0.02, 6, 5), std("#1d1d28"), s * 0.07, 0.29, 0.155);
  }
  g.add(crab);

  const spots: JobSpot[] = [
    {
      job: J.castle,
      at: castleAt,
      yaw: yawTo(castleAt, -2.75, -3.25),
      show: (k, working, t, dt) => {
        parts.forEach((p, i) => p.scale.setScalar(popIn(k, (i / parts.length) * 0.95)));
        cloth.rotation.y = Math.sin(t * 5) * 0.4;
        dust.step(working, dt);
      },
    },
    {
      job: J.shells,
      at: shellAt,
      yaw: yawTo(shellAt, 2.95, -3.05),
      show: (k, working, _t, dt) => {
        shell.scale.setScalar(popIn(k, 0.85));
        shell.position.y = 0.05 + ease((k - 0.85) / 0.15) * 0.12;
        mound.scale.set(1 - k * 0.3, 0.4 - k * 0.2, 1 - k * 0.3);
        digDust.step(working, dt);
      },
    },
    { job: J.splash, at: splashAt, yaw: 0, show: (_k, working, _t, dt) => drops.step(working, dt) },
    { job: J.sunnap, at: napAt, yaw: -0.6, show: () => {} },
  ];
  return {
    id: "beach",
    group: g,
    sky: skyTex("#6cc4ff", "#bfe6ff", "#fff1d6", 0.55),
    fog: new THREE.Fog("#d8f0ff", 22, 60),
    light: ["#f4fbff", "#ffe2b0"],
    spots,
    wander: [V(-0.8, -3.6), V(1.2, -4.0), V(-2.9, -4.8), V(-1.0, -5.6), V(2.0, -5.6)],
    update: (dt, t) => {
      seaTex.offset.y = (t * 0.03) % 1;
      seaTex.offset.x = Math.sin(t * 0.3) * 0.02;
      const wave = Math.sin(t * 0.9);
      foam.position.z = -6.9 + wave * 0.35;
      foamTex.offset.x = (t * 0.02) % 1;
      wet.position.z = -6.4 + wave * 0.15;
      (p.userData.top as THREE.Group).rotation.z = Math.sin(t * 1.1) * 0.05;
      (p2.userData.top as THREE.Group).rotation.z = Math.sin(t * 1.3 + 1) * 0.05;
      // The crab walks sideways back and forth.
      const cx = Math.sin(t * 0.25) * 3.5;
      crab.position.set(cx - 1, 0, -5.9 + Math.sin(t * 0.5) * 0.15);
      crab.rotation.z = Math.sin(t * 14) * 0.08;
      void dt;
    },
    sway: () => ({ roll: 0, bob: 0 }),
  };
}

// ---- the sailing boat -----------------------------------------------------

function buildBoat(): PlaceScene {
  const g = new THREE.Group();
  const seaTex = waterTex("#3fa9e0", "rgba(255,255,255,0.6)", true);
  seaTex.repeat.set(14, 14);
  const sea = add(g, new THREE.PlaneGeometry(120, 120), std("#ffffff", { map: seaTex, roughness: 0.2, metalness: 0.15 }), 0, -0.9, -20);
  sea.rotation.x = -Math.PI / 2;
  // The deck: wide at the back, pointed at the bow far away.
  const hull = new THREE.Shape();
  hull.moveTo(-5.2, 5);
  hull.lineTo(5.2, 5);
  hull.quadraticCurveTo(5.6, -2, 3.2, -7.5);
  hull.quadraticCurveTo(1.6, -10.5, 0, -11.5);
  hull.quadraticCurveTo(-1.6, -10.5, -3.2, -7.5);
  hull.quadraticCurveTo(-5.6, -2, -5.2, 5);
  const plankTex = canvasTex(256, 256, (c) => {
    c.fillStyle = "#e8b98a";
    c.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 32) {
      c.fillStyle = x % 64 ? "rgba(255,240,215,0.3)" : "rgba(150,95,45,0.12)";
      c.fillRect(x, 0, 30, 256);
      c.fillStyle = "rgba(120,70,30,0.35)";
      c.fillRect(x + 30, 0, 2, 256);
    }
    for (let i = 0; i < 12; i++) {
      c.fillStyle = "rgba(120,70,30,0.3)";
      c.fillRect(((i * 3) % 8) * 32, (i * 61) % 256, 30, 2);
    }
  });
  plankTex.wrapT = THREE.RepeatWrapping;
  plankTex.repeat.set(0.45, 0.45);
  const deckGeo = new THREE.ShapeGeometry(hull, 24);
  deckGeo.rotateX(Math.PI / 2);
  const deck = add(g, deckGeo, std("#ffffff", { map: plankTex, roughness: 0.8, side: THREE.DoubleSide }));
  deck.position.y = 0;
  // Hull sides and the rail around the edge.
  const edge = hull.getSpacedPoints(80).map((p) => new THREE.Vector3(p.x, 0, -p.y));
  const hullPath = new THREE.CatmullRomCurve3(edge.slice(0, -1), true);
  const side = add(g, new THREE.TubeGeometry(hullPath, 120, 0.12, 8, true), std("#ffffff", { roughness: 0.4 }), 0, 0.35, 0);
  void side;
  const rail = add(g, new THREE.TubeGeometry(hullPath, 120, 0.06, 6, true), std("#c98d58", { roughness: 0.5 }), 0, 0.85, 0);
  void rail;
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
  const postMat = std("#c98d58");
  for (let i = 0; i < 40; i++) {
    const p = hullPath.getPoint(i / 40);
    if (p.z > 4.5) continue;
    add(g, postGeo, postMat, p.x, 0.6, p.z);
  }
  const hullSide = add(g, new THREE.CylinderGeometry(1, 1, 1, 8), std("#ff7fb0"));
  hullSide.visible = false;
  // A far island and a lighthouse.
  const isle = add(g, new THREE.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std("#8fd27a"), 14, -0.9, -40);
  isle.scale.y = 0.4;
  const isle2 = add(g, new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std("#a6dd8a"), -18, -0.9, -46);
  isle2.scale.y = 0.45;

  // The mast and the big sail.
  const mast = add(g, new THREE.CylinderGeometry(0.13, 0.16, 9, 12), std("#c98d58"), 0, 4.5, -5.6);
  void mast;
  add(g, new THREE.CylinderGeometry(0.08, 0.08, 4.4, 10).rotateZ(Math.PI / 2), std("#c98d58"), 2.2, 1.6, -5.6);
  const sailGeo = new THREE.PlaneGeometry(4.2, 6.6, 12, 16);
  sailGeo.translate(2.1, 3.3 + 1.7, 0);
  const sailTex = canvasTex(64, 256, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 64, 256);
    c.fillStyle = "#ffc6df";
    c.fillRect(0, 150, 64, 30);
  });
  const sail = add(g, sailGeo, std("#ffffff", { map: sailTex, side: THREE.DoubleSide, roughness: 0.8 }), 0, 0, -5.55);
  const sailBase = (sailGeo.getAttribute("position").array as Float32Array).slice();
  const flagM = add(g, new THREE.PlaneGeometry(0.9, 0.5, 6, 2), new THREE.MeshStandardMaterial({ color: "#ff5f9c", side: THREE.DoubleSide }), 0.45, 8.8, -5.6);
  const flagBase = (flagM.geometry.getAttribute("position").array as Float32Array).slice();
  // A life ring on the rail.
  const ringM = add(g, new THREE.TorusGeometry(0.4, 0.12, 10, 24), std("#ff6a5a", { roughness: 0.4 }), -4.6, 0.6, 0.6);
  ringM.rotation.y = Math.PI / 2;
  // Seagull going round.
  const gull = new THREE.Group();
  for (const s of [-1, 1]) {
    const w = add(gull, new THREE.BoxGeometry(0.7, 0.04, 0.22), std("#ffffff"), s * 0.35, 0, 0);
    w.userData.s = s;
  }
  add(gull, new THREE.SphereGeometry(0.12, 10, 8), std("#ffffff"));
  g.add(gull);

  const J = jobs("boat");
  // Steer: the wheel turns this way and that.
  const steerAt = V(-2.4, -2.5);
  const wheel = new THREE.Group();
  const wood = std("#a8703c", { roughness: 0.6 });
  add(wheel, new THREE.TorusGeometry(0.42, 0.05, 8, 24), wood);
  for (let i = 0; i < 8; i++) {
    const sp = add(wheel, new THREE.CylinderGeometry(0.025, 0.025, 1.05, 6), wood);
    sp.rotation.z = (i / 8) * Math.PI;
  }
  add(wheel, new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10).rotateX(Math.PI / 2), wood);
  const wheelStand = new THREE.Group();
  add(wheelStand, new THREE.BoxGeometry(0.3, 0.9, 0.3), wood, 0, 0.45, 0);
  wheel.position.y = 1.0;
  wheel.position.z = 0.18;
  wheelStand.add(wheel);
  wheelStand.position.set(-2.95, 0, -3.1);
  wheelStand.rotation.y = 0.5;
  g.add(wheelStand);

  // Fish: a rod over the rail, the float bobs, then a fish jumps out.
  const fishAt = V(2.6, -2.6);
  const rod = new THREE.Group();
  const rodStick = add(rod, new THREE.CylinderGeometry(0.02, 0.03, 2.2, 6), std("#5a3a24"), 0, 1.1, 0);
  rodStick.position.set(0, 1.1, 0);
  rod.position.set(3.2, 0.2, -3.0);
  rod.rotation.z = -0.85;
  g.add(rod);
  const float = add(g, new THREE.SphereGeometry(0.08, 10, 8), std("#ff5f5f"), 5.6, -0.8, -3.0);
  const fish = new THREE.Group();
  const fb = add(fish, new THREE.SphereGeometry(0.2, 14, 10), std("#ffae3c", { roughness: 0.3 }));
  fb.scale.set(1.5, 0.8, 0.5);
  const tail = add(fish, new THREE.ConeGeometry(0.14, 0.24, 4), std("#ff8f2c"), -0.36, 0, 0);
  tail.rotation.z = Math.PI / 2;
  add(fish, new THREE.SphereGeometry(0.03, 6, 5), std("#1d1d28"), 0.17, 0.05, 0.08);
  g.add(fish);

  // Look out: a telescope at the bow.
  const lookAt = V(0.7, -7.4);
  const scope = new THREE.Group();
  add(scope, new THREE.CylinderGeometry(0.06, 0.1, 0.8, 10).rotateX(Math.PI / 2), std("#c9a24a", { metalness: 0.7, roughness: 0.3 }), 0, 0, 0);
  scope.position.set(0.7, 1.0, -8.0);
  g.add(scope);
  const whale = new THREE.Group();
  const wb = add(whale, new THREE.SphereGeometry(1, 20, 12), std("#7aa6e8", { roughness: 0.4 }));
  wb.scale.set(2, 0.8, 1);
  const spray = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: "#e6f8ff", transparent: true, opacity: 0.8 })),
    0.08,
    () => new THREE.Vector3((Math.random() - 0.5) * 1, 2.5, 0),
    0.8,
  );
  spray.group.position.set(0.5, 0.8, 0);
  whale.add(spray.group);
  whale.position.set(-6, -1.6, -22);
  g.add(whale);

  // Mop the deck: a bucket and a mop that swishes.
  const mopAt = V(-1.6, -5.2);
  const bucket = new THREE.Group();
  add(bucket, new THREE.CylinderGeometry(0.26, 0.2, 0.4, 16), std("#7fb8ff"), 0, 0.2, 0);
  add(bucket, new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), std("#bfe6ff", { roughness: 0.1 }), 0, 0.36, 0);
  bucket.position.set(-2.3, 0, -5.6);
  g.add(bucket);
  const mop = new THREE.Group();
  add(mop, new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), std("#c98d58"), 0, 0.75, 0);
  add(mop, new THREE.SphereGeometry(0.2, 10, 8), std("#f2f0ea", { roughness: 1 }), 0, 0.08, 0).scale.set(1.3, 0.5, 1);
  mop.position.set(-1.0, 0, -5.6);
  mop.rotation.z = 0.35;
  g.add(mop);
  const suds = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 })),
    0.15,
    () => new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5),
    1,
  );
  suds.group.position.set(-1.0, 0.05, -5.6);
  g.add(suds.group);

  let fishJump = -1;
  let whaleUp = -1;
  const spots: JobSpot[] = [
    {
      job: J.steer,
      at: steerAt,
      yaw: yawTo(steerAt, -2.95, -3.1),
      show: (_k, working, t) => {
        wheel.rotation.z = working ? Math.sin(t * 1.8) * 1.4 : wheel.rotation.z * 0.98;
      },
    },
    {
      job: J.fish,
      at: fishAt,
      yaw: yawTo(fishAt, 4, -3),
      show: (k, working, t, dt) => {
        float.position.y = -0.8 + (working ? Math.abs(Math.sin(t * 3)) * 0.08 - (k > 0.8 ? 0.1 : 0) : 0);
        if (k >= 1 && fishJump < 0) fishJump = 0;
        if (k < 1) fishJump = -1;
        if (fishJump >= 0 && fishJump < 1.2) {
          fishJump += dt;
          const u = fishJump / 1.2;
          fish.visible = true;
          fish.position.set(5.6 - u * 1.4, -0.8 + Math.sin(u * Math.PI) * 2.2, -3.0);
          fish.rotation.z = (0.5 - u) * 2.4;
          tail.rotation.y = Math.sin(t * 30) * 0.6;
        } else fish.visible = false;
      },
    },
    {
      job: J.lookout,
      at: lookAt,
      yaw: Math.PI,
      show: (k, working, t, dt) => {
        scope.rotation.y = working ? Math.sin(t * 0.8) * 0.5 : 0;
        if (k >= 1 && whaleUp < 0) whaleUp = 0;
        if (k < 1) whaleUp = -1;
        if (whaleUp >= 0 && whaleUp < 3) {
          whaleUp += dt;
          whale.visible = true;
          whale.position.y = -1.6 + Math.sin((whaleUp / 3) * Math.PI) * 1.4;
          spray.step(whaleUp > 0.6 && whaleUp < 2.2, dt);
        } else whale.visible = false;
      },
    },
    {
      job: J.mop,
      at: mopAt,
      yaw: yawTo(mopAt, -1.0, -5.6),
      show: (_k, working, t, dt) => {
        mop.position.x = -1.0 + (working ? Math.sin(t * 4) * 0.35 : 0);
        mop.rotation.z = 0.35 + (working ? Math.sin(t * 4) * 0.2 : 0);
        suds.group.position.x = mop.position.x;
        suds.step(working, dt);
      },
    },
  ];
  fish.visible = false;
  whale.visible = false;
  return {
    id: "boat",
    group: g,
    sky: skyTex("#7ac6ff", "#c6e8ff", "#fff0e0", 0.6),
    fog: new THREE.Fog("#d6eeff", 24, 70),
    light: ["#f2faff", "#d8f0ff"],
    spots,
    wander: [V(-0.6, -3.4), V(1.4, -4.4), V(-2.6, -6.8), V(2.0, -6.6), V(0.4, -9.0)],
    update: (dt, t) => {
      // The sea slides past as we sail.
      seaTex.offset.x = (t * 0.05) % 1;
      seaTex.offset.y = Math.sin(t * 0.4) * 0.03;
      // The sail fills and ripples; the flag flaps.
      const sp = sailGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < sp.count; i++) {
        const x = sailBase[i * 3];
        const y = sailBase[i * 3 + 1];
        const u = x / 4.2;
        const v = (y - 1.7) / 6.6;
        sp.setZ(i, Math.sin(u * Math.PI) * (0.9 + Math.sin(t * 1.3) * 0.1) * (0.6 + v * 0.4) + Math.sin(t * 4 + u * 6 + v * 3) * 0.04 * u);
      }
      sp.needsUpdate = true;
      sailGeo.computeVertexNormals();
      const fp = flagM.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < fp.count; i++) {
        const x = flagBase[i * 3] + 0.45;
        fp.setZ(i, Math.sin(t * 9 - x * 7) * 0.08 * x);
      }
      fp.needsUpdate = true;
      const a = t * 0.35;
      gull.position.set(Math.cos(a) * 7, 7 + Math.sin(t * 0.7) * 0.5, -10 + Math.sin(a) * 4);
      gull.rotation.y = -a;
      for (const w of gull.children) if (w.userData.s) w.rotation.z = w.userData.s * Math.sin(t * 6) * 0.4;
      void dt;
    },
    sway: (t) => ({ roll: Math.sin(t * 0.7) * 0.025, bob: Math.sin(t * 0.9) * 0.08 }),
  };
}

// ---- the living room ------------------------------------------------------

function buildRoom(): PlaceScene {
  const g = new THREE.Group();
  const floorTex = canvasTex(256, 256, (c) => {
    c.fillStyle = "#e9c49a";
    c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      c.fillStyle = (y / 32) % 2 ? "rgba(255,240,220,0.25)" : "rgba(160,100,50,0.1)";
      c.fillRect(0, y, 256, 30);
      c.fillStyle = "rgba(120,70,30,0.3)";
      c.fillRect(0, y + 30, 256, 2);
      c.fillRect(((y * 7) % 200) + 20, y, 2, 30);
    }
  });
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(6, 6);
  const floor = add(g, new THREE.PlaneGeometry(30, 20), std("#ffffff", { map: floorTex, roughness: 0.75 }), 0, 0, 1);
  floor.rotation.x = -Math.PI / 2;
  const rug = add(g, new THREE.CircleGeometry(2.6, 48), std("#ffc6df", { roughness: 0.95 }), 0, 0.004, -0.6);
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.3, 1, 1);
  const rug2 = add(g, new THREE.RingGeometry(2.2, 2.4, 48), std("#ffffff", { roughness: 0.95 }), 0, 0.006, -0.6);
  rug2.rotation.x = -Math.PI / 2;
  rug2.scale.set(1.3, 1, 1);
  const wallTex = canvasTex(128, 128, (c) => {
    c.fillStyle = "#fde3ee";
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = "#ffffff";
    for (const [x, y] of [[20, 20], [84, 52], [36, 96], [100, 116], [64, 4]]) {
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fill();
    }
  });
  wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(10, 4);
  add(g, new THREE.PlaneGeometry(30, 12), std("#ffffff", { map: wallTex, roughness: 0.9 }), 0, 6, -8);
  add(g, new THREE.BoxGeometry(30, 0.4, 0.15), std("#ffffff"), 0, 0.2, -7.92);
  // A window with sky and curtains.
  const win = new THREE.Group();
  add(win, new THREE.PlaneGeometry(3, 2.4), new THREE.MeshBasicMaterial({ map: skyTex("#8fd3ff", "#c9eaff", "#fff1e0"), fog: false }));
  const frameMat = std("#ffffff");
  add(win, new THREE.BoxGeometry(3.2, 0.12, 0.1), frameMat, 0, 1.2, 0.02);
  add(win, new THREE.BoxGeometry(3.2, 0.12, 0.1), frameMat, 0, -1.2, 0.02);
  add(win, new THREE.BoxGeometry(0.12, 2.5, 0.1), frameMat, 0, 0, 0.02);
  add(win, new THREE.BoxGeometry(3.2, 0.06, 0.08), frameMat, 0, 0, 0.02);
  for (const s of [-1, 1]) add(win, new THREE.BoxGeometry(0.7, 2.9, 0.08), std("#c9a8f0", { roughness: 0.9 }), s * 1.85, 0, 0.06);
  const cloud = add(win, new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffffff", fog: false }), -0.5, 0.4, 0.01);
  cloud.scale.set(1.6, 0.6, 0.1);
  win.position.set(-1.2, 3.4, -7.9);
  g.add(win);
  // The couch.
  const couch = new THREE.Group();
  const fabric = std("#9fc4ff", { roughness: 0.95 });
  add(couch, new THREE.BoxGeometry(3.6, 0.6, 1.2), fabric, 0, 0.5, 0);
  add(couch, new THREE.BoxGeometry(3.6, 1.1, 0.35), fabric, 0, 1.2, -0.45);
  for (const s of [-1, 1]) add(couch, new THREE.CapsuleGeometry(0.28, 0.9, 6, 12).rotateX(Math.PI / 2), fabric, s * 1.85, 0.95, 0);
  for (const s of [-1, 1]) add(couch, new THREE.BoxGeometry(1.6, 0.25, 1.0), std("#b8d4ff", { roughness: 0.95 }), s * 0.85, 0.9, 0.05);
  add(couch, new THREE.SphereGeometry(0.3, 14, 10), std("#ffd84d", { roughness: 0.9 }), 1.1, 1.25, -0.15).scale.set(1, 1, 0.5);
  couch.position.set(-1.2, 0, -7.1);
  g.add(couch);
  // A bookshelf.
  const shelf = new THREE.Group();
  const woodS = std("#e8b98a");
  add(shelf, new THREE.BoxGeometry(1.6, 3.2, 0.5), woodS, 0, 1.6, 0);
  const bookCols = ["#ff7fb0", "#7fc8f0", "#ffd84d", "#9fe08a", "#c9a8f0", "#ff9a5a"];
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) add(shelf, new THREE.BoxGeometry(0.18, 0.62 - (i % 2) * 0.1, 0.36), std(bookCols[(i + r * 2) % 6]), -0.55 + i * 0.26, 0.55 + r * 1.0, 0.1);
  shelf.position.set(-4.4, 0, -7.4);
  g.add(shelf);
  // A lamp.
  const lamp = new THREE.Group();
  add(lamp, new THREE.CylinderGeometry(0.3, 0.35, 0.08, 16), std("#ffffff"), 0, 0.04, 0);
  add(lamp, new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), std("#ffffff"), 0, 1.24, 0);
  add(lamp, new THREE.CylinderGeometry(0.35, 0.55, 0.6, 20, 1, true), std("#fff3b0", { emissive: new THREE.Color("#ffe9a0"), emissiveIntensity: 0.5, side: THREE.DoubleSide }), 0, 2.6, 0);
  lamp.position.set(2.0, 0, -7.2);
  g.add(lamp);

  const J = jobs("room");
  // Stack the blocks: one lands on top of the other.
  const blocksAt = V(-2.3, -2.8);
  const blocks: THREE.Mesh[] = [];
  const bc = ["#ff7fb0", "#7fc8f0", "#ffd84d", "#9fe08a", "#c9a8f0"];
  for (let i = 0; i < 5; i++) {
    const b = add(g, new THREE.BoxGeometry(0.42, 0.42, 0.42), std(bc[i], { roughness: 0.5 }), -2.9 + (i % 2) * 0.06, 0.21 + i * 0.42, -3.4);
    b.rotation.y = i * 0.35;
    blocks.push(b);
  }
  // Read a story: a book lying open.
  const readAt = V(2.4, -2.7);
  const book = new THREE.Group();
  const pages: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const pg = add(book, new THREE.BoxGeometry(0.42, 0.03, 0.56), std("#ffffff"), s * 0.22, 0.04, 0);
    pg.rotation.z = s * 0.12;
    pages.push(pg);
  }
  add(book, new THREE.BoxGeometry(0.9, 0.02, 0.6), std("#ff7fb0"), 0, 0.01, 0);
  const flip = add(book, new THREE.BoxGeometry(0.42, 0.012, 0.54), std("#fff6ea"), 0.21, 0.07, 0);
  flip.geometry.translate(0, 0, 0);
  const flipper = new THREE.Group();
  flipper.add(flip);
  flipper.position.set(0, 0.0, 0);
  flip.position.set(0.21, 0.07, 0);
  book.add(flipper);
  book.position.set(3.05, 0, -3.15);
  g.add(book);
  // Water the plant: it grows and a flower opens.
  const plantAt = V(3.0, -5.4);
  const plant = new THREE.Group();
  add(plant, new THREE.CylinderGeometry(0.35, 0.26, 0.55, 18), std("#ff9a5a", { roughness: 0.6 }), 0, 0.28, 0);
  const stalk = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const leafM = add(stalk, new THREE.SphereGeometry(0.18, 10, 8), std("#6cbf4a"), Math.cos(i * 2.4) * 0.15, 0.2 + i * 0.16, Math.sin(i * 2.4) * 0.15);
    leafM.scale.set(1, 0.45, 0.7);
    leafM.rotation.y = i * 2.4;
  }
  const bloom = new THREE.Group();
  for (let i = 0; i < 6; i++) add(bloom, new THREE.SphereGeometry(0.09, 10, 8), std("#ff8fbf"), Math.cos(i) * 0.1, 0, Math.sin(i) * 0.1);
  add(bloom, new THREE.SphereGeometry(0.07, 10, 8), std("#ffd84d"), 0, 0.03, 0);
  bloom.position.y = 1.05;
  stalk.add(bloom);
  stalk.position.y = 0.45;
  plant.add(stalk);
  plant.position.set(3.6, 0, -6.0);
  g.add(plant);
  const can = new THREE.Group();
  add(can, new THREE.CylinderGeometry(0.2, 0.22, 0.32, 14), std("#7fc8f0"), 0, 0.16, 0);
  add(can, new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8), std("#7fc8f0"), 0.25, 0.3, 0).rotation.z = -0.9;
  can.position.set(3.05, 0, -6.05);
  g.add(can);
  const water = new Puffs(
    () => new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: "#8fd8ff" })),
    0.06,
    () => new THREE.Vector3(0.3, -0.6, 0),
    0.6,
  );
  water.group.position.set(3.8, 0.55, -6.05);
  g.add(water.group);
  // Cartoons on the TV.
  const tvAt = V(1.1, -4.4);
  const tv = new THREE.Group();
  add(tv, new THREE.BoxGeometry(1.8, 0.6, 0.7), std("#e8b98a"), 0, 0.3, 0);
  add(tv, new THREE.BoxGeometry(1.7, 1.05, 0.12), std("#3a3540", { roughness: 0.3 }), 0, 1.15, 0);
  const screenMat = new THREE.MeshBasicMaterial({ color: "#20202a" });
  add(tv, new THREE.PlaneGeometry(1.5, 0.86), screenMat, 0, 1.15, 0.065);
  tv.position.set(1.3, 0, -6.6);
  g.add(tv);
  const tvCols = ["#ff8fbf", "#8fd8ff", "#ffe27a", "#9fe08a", "#c9a8f0"];

  const spots: JobSpot[] = [
    {
      job: J.blocks,
      at: blocksAt,
      yaw: yawTo(blocksAt, -2.9, -3.4),
      show: (k) => blocks.forEach((b, i) => b.scale.setScalar(popIn(k, (i / 5) * 0.9))),
    },
    {
      job: J.read,
      at: readAt,
      yaw: yawTo(readAt, 3.05, -3.15),
      show: (_k, working, t) => {
        flipper.rotation.z = working ? -((t * 0.7) % 1) * Math.PI : 0;
      },
    },
    {
      job: J.plant,
      at: plantAt,
      yaw: yawTo(plantAt, 3.6, -6.0),
      show: (k, working, _t, dt) => {
        stalk.scale.setScalar(0.5 + ease(k) * 0.6);
        bloom.scale.setScalar(popIn(k, 0.85));
        can.rotation.z = working ? -0.6 : 0;
        can.position.y = working ? 0.4 : 0;
        water.step(working, dt);
      },
    },
    {
      job: J.tv,
      at: tvAt,
      yaw: yawTo(tvAt, 1.3, -6.6),
      show: (_k, working, t) => {
        screenMat.color.set(working ? tvCols[Math.floor(t * 1.5) % tvCols.length] : "#20202a");
      },
    },
  ];
  return {
    id: "room",
    group: g,
    sky: skyTex("#fde3ee", "#fde3ee", "#fde3ee"),
    fog: new THREE.Fog("#fde3ee", 20, 40),
    light: ["#fff6ee", "#e9c49a"],
    spots,
    wander: [V(-0.4, -3.4), V(-1.6, -5.4), V(0.6, -5.6), V(-2.9, -4.6), V(2.0, -3.6)],
    update: (_dt, t) => {
      cloud.position.x = -0.5 + Math.sin(t * 0.1) * 0.8;
    },
    sway: () => ({ roll: 0, bob: 0 }),
  };
}

const BUILD: Record<PlaceId, () => PlaceScene> = { table: buildTable, beach: buildBeach, boat: buildBoat, room: buildRoom };

/** Places are built the first time you go there, then kept. */
const cache = new Map<PlaceId, PlaceScene>();
export function placeScene(id: PlaceId): PlaceScene {
  let p = cache.get(id);
  if (!p) {
    p = BUILD[id]();
    for (const s of p.spots) s.show(0, false, 0, 0);
    cache.set(id, p);
  }
  return p;
}
