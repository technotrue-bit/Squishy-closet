// Halloween in Aurora's World. All October every place dresses up for a cozy, spooky evening: a purple dusk sky
// with a sleepy smiling moon and stars, glowing jack-o'-lanterns, bats looping overhead, bunting and twinkly
// lights, cobwebs with a little dangling spider, a bubbling cauldron and friendly ghosts who play peekaboo. Cute,
// never scary. Tap a ghost, a jack-o'-lantern or the cauldron and it plays back.
// Also here: the Spooky Box itself, a jack-o'-lantern a Halloween squishy pops out of.

import * as THREE from "three";
import type { PlaceScene } from "./placeScenes";
import { witchHat } from "./parts";
import type { Solid } from "./nav";

const std = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts });

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

/** Shapes and pictures are made once and shared by every pumpkin, ghost and bat. */
const once = <T>(make: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};

// ---- skies ------------------------------------------------------------------

/** A dusk sky: deep purple at the top, glowing orange at the horizon. */
export function duskSky(top: string, mid: string, bottom: string, at = 0.55): THREE.CanvasTexture {
  return tex(16, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, top);
    g.addColorStop(at, mid);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 512);
  });
}

const moonTex = once(() =>
  tex(256, 256, (c) => {
    const g = c.createRadialGradient(110, 100, 10, 128, 128, 120);
    g.addColorStop(0, "#fffbe6");
    g.addColorStop(1, "#ffe9a8");
    c.fillStyle = g;
    c.beginPath();
    c.arc(128, 128, 120, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(230,200,140,0.35)";
    for (const [x, y, r] of [[70, 80, 18], [180, 70, 12], [190, 170, 20], [90, 190, 10], [150, 120, 8]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    // A sleepy, smiling face.
    c.strokeStyle = "#8a6a4a";
    c.lineWidth = 7;
    c.lineCap = "round";
    for (const x of [96, 160]) {
      c.beginPath();
      c.arc(x, 128, 14, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    }
    c.beginPath();
    c.arc(128, 150, 16, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
    c.fillStyle = "rgba(255,150,170,0.55)";
    for (const x of [78, 178]) {
      c.beginPath();
      c.ellipse(x, 158, 14, 9, 0, 0, Math.PI * 2);
      c.fill();
    }
  }),
);

const haloTex = once(() =>
  tex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, "rgba(255,240,200,0.55)");
    g.addColorStop(0.5, "rgba(255,220,180,0.18)");
    g.addColorStop(1, "rgba(255,220,180,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }),
);

/** A big friendly moon with a soft glow round it, never fogged. */
export function moon(r: number): THREE.Group {
  const g = new THREE.Group();
  const face = add(g, new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: moonTex(), transparent: true, fog: false, depthWrite: false }));
  face.renderOrder = -1;
  const halo = add(g, new THREE.PlaneGeometry(r * 3.6, r * 3.6), new THREE.MeshBasicMaterial({ map: haloTex(), transparent: true, fog: false, depthWrite: false }), 0, 0, -0.05);
  halo.renderOrder = -2;
  return g;
}

/** Twinkling stars across the far sky, in two sets that twinkle in turn. */
export function stars(n: number, spread: { x: number; y0: number; y1: number; z0: number; z1: number }): { obj: THREE.Group; twinkle(t: number): void } {
  const g = new THREE.Group();
  const mats: THREE.PointsMaterial[] = [];
  for (let set = 0; set < 2; set++) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Spread evenly but not in rows.
      const h = (k: number) => ((Math.sin((i + 1) * (12.9898 + set * 7.1) + k * 78.233) * 43758.5453) % 1 + 1) % 1;
      pos[i * 3] = (h(1) - 0.5) * 2 * spread.x;
      pos[i * 3 + 1] = spread.y0 + h(2) * (spread.y1 - spread.y0);
      pos[i * 3 + 2] = spread.z0 + h(3) * (spread.z1 - spread.z0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: set ? "#fff6c8" : "#e8dcff", size: set ? 2.6 : 2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
    mats.push(m);
    g.add(new THREE.Points(geo, m));
  }
  return { obj: g, twinkle: (t) => mats.forEach((m, i) => (m.opacity = 0.55 + 0.45 * Math.sin(t * (1.3 + i * 0.4) + i * 2))) };
}

// ---- jack-o'-lanterns --------------------------------------------------------

/** How far in a pumpkin's skin dips at angle `a` round it: round lobes with eight narrow grooves between. */
const rib = (a: number) => 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 6);

function ribbed<T extends THREE.BufferGeometry>(geo: T): T {
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const k = rib(Math.atan2(z, x));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export type FaceKind = "smile" | "grin" | "oh" | "wink";

/** A carved face: holes that glow yellow in the middle and orange at the edges. Drawn white-on-clear so it can be tinted. */
function carvedFace(kind: FaceKind): THREE.CanvasTexture {
  return tex(256, 256, (c) => {
    const glow = c.createRadialGradient(128, 130, 10, 128, 130, 150);
    glow.addColorStop(0, "#fff7c0");
    glow.addColorStop(0.6, "#ffd04a");
    glow.addColorStop(1, "#ff9a1f");
    const cut = (path: () => void) => {
      c.beginPath();
      path();
      c.fillStyle = "#b8460c";
      c.fill();
      c.save();
      c.clip();
      c.translate(0, 5);
      c.beginPath();
      path();
      c.fillStyle = glow;
      c.fill();
      c.restore();
    };
    // Eyes: rounded triangles, or a wink.
    for (const s of [-1, 1]) {
      const x = 128 + s * 52;
      if (kind === "wink" && s > 0) {
        cut(() => {
          c.moveTo(x - 26, 92);
          c.quadraticCurveTo(x, 70, x + 26, 92);
          c.quadraticCurveTo(x, 82, x - 26, 92);
        });
        continue;
      }
      cut(() => {
        c.moveTo(x, 62);
        c.quadraticCurveTo(x + 8, 62, x + 30, 104);
        c.quadraticCurveTo(x, 112, x - 30, 104);
        c.quadraticCurveTo(x - 8, 62, x, 62);
      });
    }
    if (kind === "oh") {
      cut(() => c.ellipse(128, 170, 22, 28, 0, 0, Math.PI * 2));
      return;
    }
    // A wide smile; the grin has two little teeth.
    cut(() => {
      c.moveTo(56, 142);
      c.quadraticCurveTo(128, 236, 200, 142);
      c.quadraticCurveTo(128, 186, 56, 142);
      if (kind === "grin") {
        c.moveTo(104, 175);
        c.lineTo(118, 175);
        c.lineTo(111, 190);
        c.moveTo(138, 175);
        c.lineTo(152, 175);
        c.lineTo(145, 190);
      }
    });
  });
}

const faceTex: Partial<Record<FaceKind, THREE.CanvasTexture>> = {};
const faceFor = (k: FaceKind) => (faceTex[k] ??= carvedFace(k));

const pumpkinGeo = once(() => ribbed(new THREE.SphereGeometry(1, 32, 20)));
/** The front of a pumpkin, a hair outside its skin, where the face goes. */
const faceGeo = once(() => ribbed(new THREE.SphereGeometry(1.012, 20, 14, Math.PI / 2 - 0.85, 1.7, 0.9, 1.35)));
const stemGeo = once(() => {
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0.12, 0.3, 0));
  return new THREE.TubeGeometry(curve, 8, 0.07, 8, false);
});
const leafGeo = once(() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.16, 0.14, 0.34, 0);
  s.quadraticCurveTo(0.16, -0.14, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
});
const skinMats = new Map<string, THREE.MeshStandardMaterial>();
const skin = (color: string) => {
  let m = skinMats.get(color);
  if (!m) {
    m = std(color, { roughness: 0.45, emissive: new THREE.Color("#ff6a00"), emissiveIntensity: 0.12 });
    skinMats.set(color, m);
  }
  return m;
};
const stemMat = once(() => std("#6f8a3a", { roughness: 0.8 }));
const leafMat = once(() => std("#7fc65a", { side: THREE.DoubleSide }));

/** A jack-o'-lantern `r` across its middle, sitting on the ground at its origin. Its face flickers with `light`. */
export interface Lantern {
  obj: THREE.Group;
  /** The pumpkin itself, for hopping and squashing. */
  body: THREE.Group;
  light(k: number): void;
}

export function jackOLantern(r: number, kind: FaceKind = "smile", color = "#ff8a1f"): Lantern {
  const obj = new THREE.Group();
  const body = new THREE.Group();
  const squat = new THREE.Group();
  squat.scale.set(r, r * 0.8, r);
  squat.position.y = r * 0.78;
  add(squat, pumpkinGeo(), skin(color));
  const faceMat = new THREE.MeshBasicMaterial({ map: faceFor(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  add(squat, faceGeo(), faceMat);
  const stem = add(body, stemGeo(), stemMat(), 0, r * 1.5, 0);
  stem.scale.setScalar(r * 1.2);
  const leaf = add(body, leafGeo(), leafMat(), r * 0.05, r * 1.56, 0);
  leaf.scale.setScalar(r * 1.3);
  leaf.rotation.set(-1.2, 0.6, 0);
  body.add(squat);
  obj.add(body);
  return {
    obj,
    body,
    light: (k) => faceMat.color.setRGB(0.75 + 0.25 * k, 0.6 + 0.4 * k, 0.45 + 0.55 * k),
  };
}

// ---- ghosts -------------------------------------------------------------------

const ghostFaceTex = once(() =>
  tex(256, 128, (c) => {
    c.fillStyle = "#2a1a3a";
    for (const x of [88, 168]) {
      c.beginPath();
      c.ellipse(x, 52, 13, 18, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#ffffff";
    for (const x of [92, 172]) {
      c.beginPath();
      c.arc(x, 45, 5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#2a1a3a";
    c.beginPath();
    c.ellipse(128, 88, 11, 13, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,140,180,0.6)";
    for (const x of [62, 194]) {
      c.beginPath();
      c.ellipse(x, 78, 16, 9, 0, 0, Math.PI * 2);
      c.fill();
    }
  }),
);
const ghostMat = once(() => std("#fbf8ff", { roughness: 0.5, emissive: new THREE.Color("#d8c8ff"), emissiveIntensity: 0.35, transparent: true, opacity: 0.94 }));
const ghostHead = once(() => new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2));
const ghostSkirt = once(() => {
  const geo = new THREE.CylinderGeometry(0.5, 0.6, 0.6, 28, 4, true);
  geo.translate(0, -0.3, 0);
  // A wavy hem.
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > -0.59) continue;
    p.setY(i, y + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7) * 0.07);
  }
  geo.computeVertexNormals();
  return geo;
});
const ghostFaceGeo = once(() => new THREE.SphereGeometry(0.506, 18, 10, Math.PI / 2 - 0.75, 1.5, 0.95, 0.7));

/** A little ghost, about a squishy's size, floating with its middle at its origin. */
export function ghost(): THREE.Group {
  const g = new THREE.Group();
  const m = ghostMat();
  add(g, ghostHead(), m);
  add(g, ghostSkirt(), m);
  add(g, ghostFaceGeo(), new THREE.MeshBasicMaterial({ map: ghostFaceTex(), transparent: true, depthWrite: false }));
  for (const s of [-1, 1]) {
    const arm = add(g, new THREE.SphereGeometry(0.13, 12, 8), m, s * 0.55, -0.15, 0.05);
    arm.scale.set(1.3, 0.8, 0.8);
    arm.rotation.z = s * 0.5;
  }
  return g;
}

// ---- bats ---------------------------------------------------------------------

const batWingGeo = once(() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.quadraticCurveTo(0.3, 0.34, 0.66, 0.24);
  s.quadraticCurveTo(0.58, 0.08, 0.62, -0.04);
  s.quadraticCurveTo(0.48, 0.0, 0.42, -0.12);
  s.quadraticCurveTo(0.28, -0.04, 0.2, -0.16);
  s.quadraticCurveTo(0.1, -0.06, 0, -0.08);
  s.closePath();
  return new THREE.ShapeGeometry(s, 8);
});
const batMat = once(() => std("#4a3a6a", { roughness: 0.55, side: THREE.DoubleSide }));

/** A round little bat with big eyes; `flap(t)` beats its wings. */
export function bat(): { obj: THREE.Group; flap(t: number, speed?: number): void } {
  const g = new THREE.Group();
  const m = batMat();
  add(g, new THREE.SphereGeometry(0.2, 16, 12), m).scale.set(1, 0.92, 0.9);
  for (const s of [-1, 1]) {
    const ear = add(g, new THREE.ConeGeometry(0.06, 0.14, 8), m, s * 0.1, 0.2, 0);
    ear.rotation.z = -s * 0.3;
    add(g, new THREE.SphereGeometry(0.05, 10, 8), std("#ffffff", { roughness: 0.3 }), s * 0.075, 0.04, 0.16);
    add(g, new THREE.SphereGeometry(0.026, 8, 6), std("#1d1428"), s * 0.075, 0.04, 0.205);
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    const w = add(hinge, batWingGeo(), m);
    w.scale.x = s;
    hinge.position.x = s * 0.14;
    g.add(hinge);
    wings.push(hinge);
  }
  return { obj: g, flap: (t, speed = 12) => wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * Math.sin(t * speed) * 0.9)) };
}

// ---- strings across: bunting and twinkly lights ---------------------------------

/** A string hanging between two points, dipping `drop` in the middle. */
const sag = (a: THREE.Vector3, b: THREE.Vector3, drop: number) =>
  new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -drop * 2, 0)), b);

const BUNT_COLORS = ["#ff8a1f", "#8a5cf0", "#3a2f4a", "#b8f06a"];

function bunting(a: THREE.Vector3, b: THREE.Vector3, drop: number): { obj: THREE.Group; sway(t: number): void } {
  const g = new THREE.Group();
  const curve = sag(a, b, drop);
  add(g, new THREE.TubeGeometry(curve, 40, 0.02, 4, false), std("#3a2f4a"));
  const tri = new THREE.Shape();
  tri.moveTo(-0.2, 0);
  tri.lineTo(0.2, 0);
  tri.lineTo(0, -0.42);
  tri.closePath();
  // One instanced mesh for all the flags: a long string of them is still one thing to draw.
  const n = Math.max(3, Math.round(curve.getLength() / 0.55));
  const flags = new THREE.InstancedMesh(new THREE.ShapeGeometry(tri), std("#ffffff", { side: THREE.DoubleSide, roughness: 0.8 }), n - 1);
  const at: { p: THREE.Vector3; yaw: number }[] = [];
  const color = new THREE.Color();
  for (let i = 1; i < n; i++) {
    const tan = curve.getTangentAt(i / n);
    at.push({ p: curve.getPointAt(i / n), yaw: -Math.atan2(tan.z, tan.x) });
    flags.setColorAt(i - 1, color.set(BUNT_COLORS[i % BUNT_COLORS.length]));
  }
  g.add(flags);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, "YXZ");
  const one = new THREE.Vector3(1, 1, 1);
  const sway = (t: number) => {
    at.forEach((f, i) => {
      e.set(Math.sin(t * 1.6 + i * 0.7) * 0.18, f.yaw, 0);
      flags.setMatrixAt(i, m.compose(f.p, q.setFromEuler(e), one));
    });
    flags.instanceMatrix.needsUpdate = true;
  };
  sway(0);
  flags.computeBoundingSphere();
  return { obj: g, sway };
}

const BULB_COLORS = ["#ffb347", "#c69bff", "#b8f06a", "#ffe27a"];

function lights(a: THREE.Vector3, b: THREE.Vector3, drop: number): { obj: THREE.Group; twinkle(t: number): void } {
  const g = new THREE.Group();
  const curve = sag(a, b, drop);
  add(g, new THREE.TubeGeometry(curve, 40, 0.015, 4, false), std("#3a3540"));
  const mats = BULB_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const base = BULB_COLORS.map((c) => new THREE.Color(c));
  const bulb = new THREE.SphereGeometry(0.075, 10, 8).scale(1, 1.3, 1);
  const n = Math.max(4, Math.round(curve.getLength() / 0.45));
  // Each color of bulb is one instanced mesh, so it twinkles all together.
  BULB_COLORS.forEach((_, c) => {
    const spots: THREE.Vector3[] = [];
    for (let i = 1; i < n; i++) if (i % BULB_COLORS.length === c) spots.push(curve.getPointAt(i / n).add(new THREE.Vector3(0, -0.07, 0)));
    if (!spots.length) return;
    const im = new THREE.InstancedMesh(bulb, mats[c], spots.length);
    spots.forEach((p, k) => im.setMatrixAt(k, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    im.computeBoundingSphere();
    g.add(im);
  });
  return {
    obj: g,
    twinkle: (t) => mats.forEach((m, i) => m.color.copy(base[i]).multiplyScalar(0.7 + 0.3 * Math.max(0, Math.sin(t * 2.2 + i * 1.7)))),
  };
}

// ---- little extras ----------------------------------------------------------------

/** A quarter cobweb for a corner: spokes and sagging rings, `r` long. */
function cobweb(r: number): THREE.LineSegments {
  const pts: number[] = [];
  const spokes = 6;
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * (Math.PI / 2);
    pts.push(0, 0, 0, Math.cos(a) * r, -Math.sin(a) * r, 0);
  }
  for (const k of [0.3, 0.55, 0.8]) {
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * (Math.PI / 2);
      const a1 = ((i + 1) / spokes) * (Math.PI / 2);
      // Each ring dips toward the corner between spokes.
      const mid = (a0 + a1) / 2;
      const rm = r * k * 0.9;
      pts.push(Math.cos(a0) * r * k, -Math.sin(a0) * r * k, 0, Math.cos(mid) * rm, -Math.sin(mid) * rm, 0);
      pts.push(Math.cos(mid) * rm, -Math.sin(mid) * rm, 0, Math.cos(a1) * r * k, -Math.sin(a1) * r * k, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75 }));
}

/** A tiny round spider on a thread, bobbing up and down. */
function spider(thread: number): { obj: THREE.Group; bob(t: number): void } {
  const g = new THREE.Group();
  const line = add(g, new THREE.CylinderGeometry(0.006, 0.006, 1, 4), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const body = new THREE.Group();
  const m = std("#3a2f4a", { roughness: 0.4 });
  add(body, new THREE.SphereGeometry(0.11, 14, 10), m);
  for (const s of [-1, 1]) {
    add(body, new THREE.SphereGeometry(0.035, 8, 6), std("#ffffff"), s * 0.045, 0.02, 0.09);
    add(body, new THREE.SphereGeometry(0.017, 6, 5), std("#1d1428"), s * 0.045, 0.02, 0.118);
    for (let k = 0; k < 4; k++) {
      const leg = add(body, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), m, s * 0.12, -0.02 - k * 0.02, 0.04 - k * 0.04);
      leg.rotation.z = s * (1.1 + k * 0.12);
    }
  }
  g.add(body);
  return {
    obj: g,
    bob: (t) => {
      const len = thread * (0.7 + 0.3 * Math.sin(t * 0.9));
      body.position.y = -len;
      line.scale.y = len;
      line.position.y = -len / 2;
      body.rotation.z = Math.sin(t * 1.7) * 0.15;
    },
  };
}

function candle(h: number): { obj: THREE.Group; flicker(t: number): void } {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.08, 0.09, h, 14), std("#fff3e0", { roughness: 0.7 }), 0, h / 2, 0);
  const flame = add(g, new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffd04a" }), 0, h + 0.07, 0);
  flame.scale.set(1, 1.8, 1);
  return { obj: g, flicker: (t) => flame.scale.set(1 + Math.sin(t * 17) * 0.1, 1.8 + Math.sin(t * 23 + h) * 0.3, 1) };
}

/** A bubbling cauldron of green potion. */
function cauldron(r: number): { obj: THREE.Group; bubble(t: number, dt: number, extra: number): void } {
  const g = new THREE.Group();
  const pot = std("#3a2f4a", { roughness: 0.35, metalness: 0.3 });
  const prof = [
    new THREE.Vector2(0, 0.12),
    new THREE.Vector2(0.55, 0.14),
    new THREE.Vector2(0.86, 0.36),
    new THREE.Vector2(0.98, 0.62),
    new THREE.Vector2(0.92, 0.9),
    new THREE.Vector2(0.84, 1.0),
  ];
  add(g, new THREE.LatheGeometry(prof, 32), pot);
  add(g, new THREE.TorusGeometry(0.85, 0.07, 10, 36).rotateX(Math.PI / 2), pot, 0, 1.0, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, new THREE.CylinderGeometry(0.06, 0.09, 0.22, 8), pot, Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
  }
  const potion = new THREE.MeshBasicMaterial({ color: "#a8f05a" });
  add(g, new THREE.CircleGeometry(0.84, 32).rotateX(-Math.PI / 2), potion, 0, 0.93, 0);
  const bubbles: { m: THREE.Mesh; k: number; x: number; z: number }[] = [];
  const bubbleGeo = new THREE.SphereGeometry(0.12, 12, 8);
  const bubbleMat = std("#c8ff8a", { emissive: new THREE.Color("#7fd04a"), emissiveIntensity: 0.6, roughness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4;
    const rr = 0.2 + (i % 3) * 0.2;
    bubbles.push({ m: add(g, bubbleGeo, bubbleMat, Math.cos(a) * rr, 0.95, Math.sin(a) * rr), k: i / 6, x: Math.cos(a) * rr, z: Math.sin(a) * rr });
  }
  g.scale.setScalar(r);
  return {
    obj: g,
    bubble: (t, dt, extra) => {
      for (const b of bubbles) {
        b.k = (b.k + dt * (0.5 + extra * 2)) % 1;
        b.m.scale.setScalar(Math.sin(b.k * Math.PI) * (1 + extra * 0.8));
        b.m.position.y = 0.92 + b.k * 0.25;
      }
      potion.color.setHSL(0.27, 0.8, 0.6 + Math.sin(t * 2) * 0.05);
    },
  };
}

const candyCornTex = once(() => {
  const t = tex(8, 64, (c) => {
    c.fillStyle = "#fff8ec";
    c.fillRect(0, 0, 8, 64);
    c.fillStyle = "#ff8a1f";
    c.fillRect(0, 20, 8, 22);
    c.fillStyle = "#ffd23f";
    c.fillRect(0, 42, 8, 22);
  });
  return t;
});

/** A bowl of candy corn and wrapped sweets. */
function candyBowl(r: number): THREE.Group {
  const g = new THREE.Group();
  const bowl = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0.04), new THREE.Vector2(0.78, 0.3), new THREE.Vector2(0.86, 0.5)], 28);
  add(g, bowl, std("#ff8a1f", { roughness: 0.4, side: THREE.DoubleSide }));
  add(g, new THREE.TorusGeometry(0.86, 0.05, 8, 28).rotateX(Math.PI / 2), std("#3a2f4a"), 0, 0.5, 0);
  // The sweets: candy corn and round wrapped ones, each kind one instanced mesh.
  const corns = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.2, 10), std("#ffffff", { map: candyCornTex(), roughness: 0.4 }), 10);
  const wraps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8).scale(1.4, 0.9, 0.9), std("#ffffff", { roughness: 0.3 }), 6);
  const wrapColors = ["#8a5cf0", "#b8f06a", "#ff7fb0"];
  const o = new THREE.Object3D();
  let nc = 0;
  let nw = 0;
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39;
    const rr = 0.12 + ((i * 7) % 5) * 0.12;
    const y = 0.42 + ((i * 3) % 4) * 0.05;
    o.position.set(Math.cos(a) * rr, y + 0.05, Math.sin(a) * rr);
    o.rotation.set(Math.sin(i) * 0.9, a, Math.cos(i) * 0.9);
    o.updateMatrix();
    if (i % 3) corns.setMatrixAt(nc++, o.matrix);
    else {
      wraps.setMatrixAt(nw, o.matrix);
      wraps.setColorAt(nw++, new THREE.Color(wrapColors[i % 3]));
    }
  }
  g.add(corns, wraps);
  g.scale.setScalar(r / 0.86);
  return g;
}

/** A flat paper bat for a wall. */
function paperBat(): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(0, 0.1);
  s.quadraticCurveTo(-0.3, 0.32, -0.66, 0.22);
  s.quadraticCurveTo(-0.58, 0.06, -0.62, -0.06);
  s.quadraticCurveTo(-0.46, -0.02, -0.4, -0.16);
  s.quadraticCurveTo(-0.24, -0.06, -0.14, -0.18);
  s.lineTo(0, -0.12);
  s.lineTo(0.14, -0.18);
  s.quadraticCurveTo(0.24, -0.06, 0.4, -0.16);
  s.quadraticCurveTo(0.46, -0.02, 0.62, -0.06);
  s.quadraticCurveTo(0.58, 0.06, 0.66, 0.22);
  s.quadraticCurveTo(0.3, 0.32, 0, 0.1);
  return new THREE.Mesh(new THREE.ShapeGeometry(s, 6), std("#3a2f4a", { roughness: 0.9 }));
}

/** A cloth banner with words on it. */
function banner(text: string, w: number, h: number): THREE.Mesh {
  const t = tex(512, Math.round((512 * h) / w), (c) => {
    const H = c.canvas.height;
    c.fillStyle = "#3a2f4a";
    c.fillRect(0, 0, 512, H);
    c.fillStyle = "#8a5cf0";
    c.fillRect(0, H - 14, 512, 14);
    c.fillRect(0, 0, 512, 14);
    c.font = `900 ${Math.round(H * 0.5)}px ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 10;
    c.strokeStyle = "#b8460c";
    c.strokeText(text, 256, H / 2 + 2);
    c.fillStyle = "#ffb347";
    c.fillText(text, 256, H / 2 + 2);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide }));
}

/** A small witch hat for anything that wants one (a teapot, a crab, a duck). */
export function tinyWitchHat(size: number): THREE.Object3D {
  const h = witchHat();
  h.scale.setScalar(size);
  return h;
}

// ---- a place's party: decorations that move, and the ones you can tap --------------

interface Pokeable {
  obj: THREE.Object3D;
  /** Plays, and says what to show. */
  poke(): { say: string; boo: boolean };
}

const BOOS = ["Boo!", "Hee hee! Boo!", "Peekaboo!", "Wooo! Happy Halloween!"];
const TREATS = ["Trick or treat!", "Happy Halloween!", "Hee hee!", "Look at me glow!"];
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

class Party {
  readonly group = new THREE.Group();
  readonly solids: Solid[] = [];
  private anims: ((t: number, dt: number) => void)[] = [];
  private pokes: Pokeable[] = [];

  on(fn: (t: number, dt: number) => void): void {
    this.anims.push(fn);
  }

  update(dt: number, t: number): void {
    for (const a of this.anims) a(t, dt);
  }

  poke(ray: THREE.Raycaster): { at: THREE.Vector3; say: string; boo: boolean } | null {
    let best: { p: Pokeable; d: number; at: THREE.Vector3 } | null = null;
    for (const p of this.pokes) {
      const hit = ray.intersectObject(p.obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { p, d: hit.distance, at: hit.point };
    }
    if (!best) return null;
    return { at: best.at, ...best.p.poke() };
  }

  sky(p: PlaceScene, colors: [string, string, string, number], fog: string, near: number, far: number, light: [string, string]): void {
    p.sky = duskSky(colors[0], colors[1], colors[2], colors[3]);
    p.fog = new THREE.Fog(fog, near, far);
    p.light = light;
    p.night = true;
  }

  moonAt(x: number, y: number, z: number, r: number): void {
    const m = moon(r);
    m.position.set(x, y, z);
    this.group.add(m);
  }

  starsIn(n: number, spread: { x: number; y0: number; y1: number; z0: number; z1: number }): void {
    const s = stars(n, spread);
    this.group.add(s.obj);
    this.on((t) => s.twinkle(t));
  }

  /** A jack-o'-lantern on the ground; tap it and it hops. `solid` keeps squishies from hopping through it. */
  lantern(x: number, z: number, r: number, kind: FaceKind = "smile", opts: { y?: number; yaw?: number; solid?: boolean; parent?: THREE.Object3D } = {}): Lantern {
    const l = jackOLantern(r, kind);
    l.obj.position.set(x, opts.y ?? 0, z);
    l.obj.rotation.y = opts.yaw ?? 0;
    (opts.parent ?? this.group).add(l.obj);
    if (opts.solid !== false && opts.y === undefined) this.solids.push({ x, z, r: r * 1.02 });
    let hop = -1;
    const phase = x * 1.7 + z;
    this.on((t, dt) => {
      let flare = 0;
      if (hop >= 0) {
        hop += dt;
        const k = hop / 0.6;
        l.body.position.y = Math.sin(Math.min(1, k) * Math.PI) * r * 0.6;
        const sq = k < 0.15 ? 1 - k * 1.5 : 1;
        l.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        flare = Math.max(0, 1 - k);
        if (k >= 1) {
          hop = -1;
          l.body.position.y = 0;
          l.body.scale.setScalar(1);
        }
      }
      l.light(Math.min(1, 0.7 + 0.18 * Math.sin(t * 9 + phase) + 0.12 * Math.sin(t * 23 + phase * 2) + flare));
    });
    this.pokes.push({
      obj: l.obj,
      poke: () => {
        hop = 0;
        return { say: pick(TREATS), boo: false };
      },
    });
    return l;
  }

  /** A ghost floating about `at`, drifting side to side; `peek` makes it rise from behind something and sink back. */
  ghostAt(at: THREE.Vector3, opts: { drift?: number; scale?: number; peek?: number; yaw?: number; parent?: THREE.Object3D } = {}): THREE.Group {
    const g = ghost();
    const s = opts.scale ?? 1;
    g.scale.setScalar(s);
    (opts.parent ?? this.group).add(g);
    let spin = -1;
    const phase = at.x * 2.3 + at.z;
    this.on((t, dt) => {
      const drift = opts.drift ?? 0;
      let y = at.y + Math.sin(t * 1.4 + phase) * 0.15 * s;
      if (opts.peek) {
        // Up to peek, a look round, then back down to hide.
        const c = ((t * 0.16 + phase * 0.1) % 1 + 1) % 1;
        const up = c < 0.15 ? c / 0.15 : c < 0.55 ? 1 : c < 0.7 ? 1 - (c - 0.55) / 0.15 : 0;
        const e = up * up * (3 - 2 * up);
        y += (e - 1) * opts.peek;
      }
      g.position.set(at.x + Math.sin(t * 0.35 + phase) * drift, y, at.z);
      g.rotation.y = (opts.yaw ?? 0) + Math.sin(t * 0.7 + phase) * 0.35;
      g.rotation.z = Math.sin(t * 1.1 + phase) * 0.08;
      if (spin >= 0) {
        spin += dt;
        const k = Math.min(1, spin / 0.8);
        g.rotation.y += k * Math.PI * 2;
        g.scale.set(s * (1 + Math.sin(k * Math.PI) * 0.25), s * (1 - Math.sin(k * Math.PI * 2) * 0.15), s);
        if (k >= 1) {
          spin = -1;
          g.scale.setScalar(s);
        }
      }
    });
    this.pokes.push({
      obj: g,
      poke: () => {
        spin = 0;
        return { say: pick(BOOS), boo: true };
      },
    });
    return g;
  }

  /** Bats looping round `c` in a lazy figure of eight. */
  bats(c: THREE.Vector3, n: number, rx: number, rz: number, speed = 0.5): void {
    for (let i = 0; i < n; i++) {
      const b = bat();
      const s = 0.8 + (i % 3) * 0.2;
      b.obj.scale.setScalar(s);
      this.group.add(b.obj);
      const phase = (i / n) * Math.PI * 2;
      const dir = i % 2 ? 1 : -1;
      let loop = -1;
      this.on((t, dt) => {
        const a = phase + t * speed * dir;
        const x = c.x + Math.cos(a) * rx;
        const z = c.z + Math.sin(a * 2) * rz;
        let y = c.y + Math.sin(a * 3 + i) * 0.5;
        if (loop >= 0) {
          loop += dt;
          const k = Math.min(1, loop / 0.9);
          y += Math.sin(k * Math.PI) * 1.2;
          b.obj.rotation.x = k * Math.PI * 2;
          if (k >= 1) loop = -1;
        } else b.obj.rotation.x = 0;
        // Face the way it flies.
        const dx = -Math.sin(a) * rx * dir;
        const dz = Math.cos(a * 2) * 2 * rz * dir;
        b.obj.position.set(x, y, z);
        b.obj.rotation.y = Math.atan2(dx, dz);
        b.flap(t + i);
      });
      this.pokes.push({
        obj: b.obj,
        poke: () => {
          loop = 0;
          return { say: "Squeak squeak!", boo: false };
        },
      });
    }
  }

  bunting(a: THREE.Vector3, b: THREE.Vector3, drop: number): void {
    const s = bunting(a, b, drop);
    this.group.add(s.obj);
    this.on((t) => s.sway(t));
  }

  lights(a: THREE.Vector3, b: THREE.Vector3, drop: number): void {
    const s = lights(a, b, drop);
    this.group.add(s.obj);
    this.on((t) => s.twinkle(t));
  }

  cobweb(x: number, y: number, z: number, r: number, flip = false, yaw = 0): void {
    const w = cobweb(r);
    w.position.set(x, y, z);
    w.rotation.y = yaw;
    if (flip) w.scale.x = -1;
    this.group.add(w);
  }

  spider(x: number, y: number, z: number, thread: number): void {
    const s = spider(thread);
    s.obj.position.set(x, y, z);
    this.group.add(s.obj);
    this.on((t) => s.bob(t + x));
  }

  candles(x: number, z: number, y = 0): void {
    const g = new THREE.Group();
    [0.5, 0.34, 0.42].forEach((h, i) => {
      const c = candle(h);
      c.obj.position.set((i - 1) * 0.22, 0, i === 1 ? 0.14 : 0);
      g.add(c.obj);
      this.on((t) => c.flicker(t + i * 3));
    });
    g.position.set(x, y, z);
    this.group.add(g);
    if (!y) this.solids.push({ x, z, r: 0.36 });
  }

  cauldron(x: number, z: number, r: number): void {
    const c = cauldron(r);
    c.obj.position.set(x, 0, z);
    this.group.add(c.obj);
    this.solids.push({ x, z, r: r * 1.02 });
    let stir = 0;
    this.on((t, dt) => {
      stir = Math.max(0, stir - dt);
      c.bubble(t, dt, stir);
    });
    this.pokes.push({
      obj: c.obj,
      poke: () => {
        stir = 1.5;
        return { say: "Bubble bubble!", boo: false };
      },
    });
  }

  candyBowl(x: number, z: number, r: number): void {
    const b = candyBowl(r);
    b.position.set(x, 0, z);
    this.group.add(b);
    this.solids.push({ x, z, r });
  }

  paperBats(spots: [number, number, number, number][]): void {
    for (const [x, y, z, s] of spots) {
      const b = paperBat();
      b.position.set(x, y, z);
      b.scale.setScalar(s);
      this.group.add(b);
      this.on((t) => (b.rotation.z = Math.sin(t * 1.3 + x) * 0.12));
    }
  }

  banner(text: string, a: THREE.Vector3, b: THREE.Vector3): void {
    const w = a.distanceTo(b);
    const m = banner(text, w * 0.86, 0.9);
    m.position.copy(a).lerp(b, 0.5).add(new THREE.Vector3(0, -0.6, 0));
    this.group.add(m);
    for (const end of [a, b]) {
      const from = end.clone();
      const to = m.position.clone().add(new THREE.Vector3(Math.sign(end.x - m.position.x) * w * 0.43, 0.45, 0));
      const rope = add(this.group, new THREE.CylinderGeometry(0.015, 0.015, from.distanceTo(to), 4), std("#3a2f4a"));
      rope.position.copy(from).lerp(to, 0.5);
      rope.lookAt(to);
      rope.rotateX(Math.PI / 2);
    }
    this.on((t) => (m.rotation.x = Math.sin(t * 0.9) * 0.05));
  }
}

// ---- dressing each place ------------------------------------------------------------

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Tints a named thing's material (keeping its picture). */
function tint(p: PlaceScene, name: string, color: string): void {
  p.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (o.name === name && m?.color) m.color.set(color);
  });
}

function dressTable(p: PlaceScene, party: Party): void {
  party.sky(p, ["#2a1f4f", "#7a4fb0", "#ffb08a", 0.55], "#c9a3d6", 14, 34, ["#efe2ff", "#ffc9a0"]);
  tint(p, "ground", "#ecdcf6");
  party.moonAt(3.2, 1.6, -30, 1.8);
  party.starsIn(70, { x: 30, y0: 1.5, y1: 12, z0: -42, z1: -28 });
  party.bats(V(0.5, 4.6, -9.5), 3, 3.4, 1.2);
  // A bubbling cauldron at the back, with a ghost who keeps popping out of it.
  party.cauldron(0.4, -7.9, 0.62);
  party.ghostAt(V(0.4, 1.55, -7.9), { peek: 1.1, scale: 0.9 });
  party.lantern(2.1, -7.6, 0.5, "grin", { yaw: -0.2 });
  party.lantern(-1.25, -7.4, 0.36, "oh", { yaw: 0.2 });
  party.lantern(-6.6, -7.6, 0.75, "smile", { yaw: 0.3 });
  party.lantern(6.6, -7.4, 0.62, "wink", { yaw: -0.3 });
  party.candles(3.9, -5.7);
  party.candyBowl(2.8, -1.4, 0.42);
  // Bunting along the back on two licorice poles.
  for (const x of [-6.2, 6.2]) {
    add(party.group, new THREE.CylinderGeometry(0.1, 0.12, 4.8, 10), std("#3a2f4a", { roughness: 0.4 }), x, 2.4, -10.4);
    add(party.group, new THREE.SphereGeometry(0.18, 12, 10), std("#ff8a1f"), x, 4.85, -10.4);
    party.solids.push({ x, z: -10.4, r: 0.15 });
  }
  party.bunting(V(-6.2, 4.4, -10.4), V(6.2, 4.4, -10.4), 0.7);
  party.spider(0.9, 3.0, -10.4, 1.1);
  // The teapot dresses up as a witch.
  const pot = p.group.getObjectByName("teapot");
  if (pot) {
    const h = tinyWitchHat(0.42);
    h.position.set(0, 0.92, 0);
    pot.add(h);
  }
}

function dressBeach(p: PlaceScene, party: Party): void {
  party.sky(p, ["#1f1d4a", "#5a4fa8", "#ff9f7a", 0.6], "#b48ac8", 22, 60, ["#e6e0ff", "#ffcc99"]);
  tint(p, "ground", "#f3dcd0");
  tint(p, "sea", "#9a90e0");
  tint(p, "isle", "#7a6aa8");
  tint(p, "canopy", "#ffb070");
  const sun = p.group.getObjectByName("sun");
  if (sun) sun.visible = false;
  party.moonAt(2.6, 1.7, -30, 1.8);
  // The moon's shimmer on the sea.
  const shine = tex(32, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,240,190,0)");
    g.addColorStop(0.5, "rgba(255,240,190,0.55)");
    g.addColorStop(1, "rgba(255,240,190,0)");
    c.fillStyle = g;
    for (let y = 0; y < 256; y += 10) c.fillRect(6 + ((y * 7) % 9), y, 20 - ((y * 5) % 8), 6);
  });
  const streak = add(party.group, new THREE.PlaneGeometry(1.6, 16), new THREE.MeshBasicMaterial({ map: shine, transparent: true, depthWrite: false, fog: false }), 2.6, 0.01, -21);
  streak.rotation.x = -Math.PI / 2;
  party.on((t) => ((streak.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(t * 1.7) * 0.25));
  party.starsIn(80, { x: 34, y0: 1.2, y1: 12, z0: -46, z1: -30 });
  party.bats(V(-0.5, 4.2, -11), 3, 4, 1.4, 0.45);
  party.ghostAt(V(-1.6, 1.5, -11), { drift: 2.6 });
  // Jack-o'-lanterns bobbing in the shallows, and more along the sand.
  for (const [x, z, r, k] of [[-0.6, -8.6, 0.36, "smile"], [2.6, -9.3, 0.3, "wink"]] as const) {
    const l = party.lantern(x, z, r, k, { y: -0.12, solid: false });
    party.on((t) => {
      l.obj.position.y = -0.12 + Math.sin(t * 1.3 + x) * 0.05;
      l.obj.rotation.z = Math.sin(t * 0.9 + x) * 0.08;
    });
  }
  party.lantern(-5.6, -3.2, 0.48, "grin", { yaw: 0.4 });
  party.lantern(6.0, -3.0, 0.42, "smile", { yaw: -0.4 });
  party.lantern(-3.5, -6.3, 0.3, "oh", { yaw: 0.2 });
  // Twinkly lights from the palm tree to the umbrella.
  const palm = p.group.getObjectByName("palm");
  const top = palm ? new THREE.Vector3(1.0, 3.6, 0.1).add(palm.position) : V(-3.4, 3.6, -5.3);
  party.lights(top, V(3.15, 2.5, -5.0), 0.5);
  const crab = p.group.getObjectByName("crab");
  if (crab) {
    const h = tinyWitchHat(0.32);
    h.position.set(0, 0.24, 0);
    crab.add(h);
  }
}

function dressBoat(p: PlaceScene, party: Party): void {
  party.sky(p, ["#1f1d4a", "#5a4fa8", "#ff9f7a", 0.62], "#a88ad0", 24, 70, ["#e6e0ff", "#d8c8ff"]);
  tint(p, "sea", "#8a84d8");
  tint(p, "isle", "#7a6aa8");
  const sail = p.group.getObjectByName("sail") as THREE.Mesh | undefined;
  if (sail) {
    const m = sail.material as THREE.MeshStandardMaterial;
    m.map = tex(256, 256, (c) => {
      c.fillStyle = "#fff6ec";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#c9a8f0";
      c.fillRect(0, 150, 256, 30);
      // A big cute bat on the sail.
      c.save();
      c.translate(128, 92);
      c.scale(1.6, 1.6);
      c.fillStyle = "#4a3a6a";
      c.beginPath();
      c.moveTo(0, -6);
      c.quadraticCurveTo(-30, -26, -56, -12);
      c.quadraticCurveTo(-48, 0, -50, 12);
      c.quadraticCurveTo(-38, 4, -32, 16);
      c.quadraticCurveTo(-22, 6, -14, 18);
      c.lineTo(14, 18);
      c.quadraticCurveTo(22, 6, 32, 16);
      c.quadraticCurveTo(38, 4, 50, 12);
      c.quadraticCurveTo(48, 0, 56, -12);
      c.quadraticCurveTo(30, -26, 0, -6);
      c.fill();
      c.beginPath();
      c.arc(0, 4, 15, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffffff";
      for (const x of [-6, 6]) {
        c.beginPath();
        c.arc(x, 2, 4, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    });
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
  }
  const flag = p.group.getObjectByName("flag") as THREE.Mesh | undefined;
  if (flag) (flag.material as THREE.MeshStandardMaterial).color.set("#8a5cf0");
  const gull = p.group.getObjectByName("gull");
  if (gull) gull.visible = false;
  party.moonAt(-3.0, 1.5, -34, 2);
  party.starsIn(80, { x: 36, y0: 1, y1: 12, z0: -48, z1: -32 });
  party.bats(V(0, 7.2, -6.5), 3, 2.6, 1.6, 0.6);
  party.ghostAt(V(-1.6, 3.6, -6.2), { drift: 1.2, scale: 0.85 });
  // Twinkly lights from the top of the mast down to the bow and both sides.
  for (const to of [V(0, 1.1, -11), V(-4.9, 1.0, -2.6), V(4.9, 1.0, -2.6)]) party.lights(V(0, 8.6, -5.6), to, 0.35);
  // A lantern swinging from the boom, and pumpkins on deck.
  const swing = new THREE.Group();
  swing.position.set(3.7, 1.6, -5.6);
  party.group.add(swing);
  add(swing, new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), std("#3a2f4a"), 0, -0.25, 0);
  party.lantern(0, 0, 0.26, "grin", { y: -0.92, parent: swing });
  party.on((t) => (swing.rotation.z = Math.sin(t * 1.2) * 0.25));
  party.lantern(-1.5, -8.6, 0.4, "smile", { yaw: 0.3 });
  party.lantern(1.9, -8.8, 0.3, "wink", { yaw: -0.3 });
  party.lantern(-4.0, -0.6, 0.4, "grin", { yaw: 0.5 });
  party.lantern(4.0, -1.0, 0.36, "oh", { yaw: -0.5 });
}

function dressRoom(p: PlaceScene, party: Party): void {
  party.sky(p, ["#cdb6e6", "#cdb6e6", "#cdb6e6", 0.5], "#cdb6e6", 20, 40, ["#f6eaff", "#e9b88a"]);
  tint(p, "wall", "#e2cff5");
  tint(p, "lampShade", "#ffb347");
  const shade = p.group.getObjectByName("lampShade") as THREE.Mesh | undefined;
  if (shade) (shade.material as THREE.MeshStandardMaterial).emissive.set("#ff9a3c");
  // Night outside the window: the moon, stars and a bat going by.
  const win = p.group.getObjectByName("windowSky") as THREE.Mesh | undefined;
  if (win) {
    const m = win.material as THREE.MeshBasicMaterial;
    m.map = tex(256, 204, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 204);
      g.addColorStop(0, "#241c4a");
      g.addColorStop(1, "#7a4fb0");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 204);
      c.fillStyle = "#fff6c8";
      for (let i = 0; i < 30; i++) c.fillRect((i * 83) % 256, (i * 47) % 150, 2, 2);
      c.fillStyle = "#fff3c0";
      c.beginPath();
      c.arc(180, 60, 30, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#241c4a";
      c.beginPath();
      c.arc(194, 52, 26, 0, Math.PI * 2);
      c.fill();
    });
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
  }
  tint(p, "windowCloud", "#b8a8d8");
  const winBat = bat();
  winBat.obj.scale.setScalar(0.35);
  party.group.add(winBat.obj);
  party.on((t) => {
    const k = (t * 0.12) % 1;
    winBat.obj.position.set(-2.6 + k * 2.8, 3.4 + Math.sin(k * 12) * 0.3, -7.95);
    winBat.flap(t);
  });
  party.bunting(V(-5.0, 5.6, -7.85), V(3.8, 5.6, -7.85), 0.45);
  party.paperBats([
    [-3.4, 6.5, -7.9, 0.7],
    [2.9, 4.4, -7.9, 0.55],
    [4.2, 6.3, -7.9, 0.8],
    [0.4, 6.7, -7.9, 0.5],
  ]);
  party.cobweb(-2.75, 4.65, -7.84, 0.9);
  party.spider(-2.25, 4.45, -7.82, 0.7);
  party.cobweb(-5.2, 3.25, -7.12, 0.6);
  // A ghost playing peekaboo from behind the couch, jack-o'-lanterns on the TV and the shelf.
  party.ghostAt(V(-2.4, 2.25, -7.75), { peek: 1.2, scale: 0.85 });
  party.lantern(2.05, -6.7, 0.24, "grin", { y: 1.68 });
  party.lantern(-4.4, -7.35, 0.3, "smile", { y: 3.2 });
  party.lantern(4.7, -7.0, 0.45, "wink", { yaw: -0.4 });
  party.candyBowl(-3.3, -1.5, 0.4);
}

function dressCity(p: PlaceScene, party: Party): void {
  party.sky(p, ["#2a2058", "#8a5ab8", "#ffa070", 0.55], "#c69ad2", 18, 44, ["#f0e8ff", "#ffcaa0"]);
  tint(p, "ground", "#eadcf0");
  // Autumn trees, glowing street lamps and lit-up windows.
  tint(p, "leaves", "#ffa94d");
  p.group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m) return;
    if (o.name === "streetLamp") {
      m.color.set("#ffd27a");
      m.emissive.set("#ff9a3c");
      m.emissiveIntensity = 0.9;
    }
    if (o.name === "houseWindows" && m.map) {
      m.emissive.set("#ffb347");
      m.emissiveMap = m.map;
      m.emissiveIntensity = 0.55;
      m.needsUpdate = true;
    }
  });
  tint(p, "cartUmbrella", "#c9a8f0");
  party.starsIn(50, { x: 30, y0: 7.5, y1: 14, z0: -40, z1: -26 });
  party.bats(V(0, 5.2, -11.5), 4, 4.2, 1.2, 0.5);
  party.banner("Happy Halloween!", V(-3.4, 3.4, -11.05), V(3.1, 3.4, -11.05));
  party.lights(V(-8, 3.2, -5.0), V(8, 3.2, -5.0), 0.8);
  // Pumpkins on the doorsteps across the street, and a ghost resting on the bus stop roof.
  [
    [-4.8, -12.4, 0.36, "smile"],
    [-1.4, -12.3, 0.42, "grin"],
    [1.9, -12.4, 0.32, "wink"],
    [5.0, -12.3, 0.4, "oh"],
    [-6.0, -3.6, 0.42, "grin"],
    [6.2, -3.4, 0.38, "smile"],
  ].forEach(([x, z, r, k]) => party.lantern(x as number, z as number, r as number, k as FaceKind));
  party.ghostAt(V(-2.6, 2.75, -4.85), { scale: 0.7 });
  const cart = p.group.getObjectByName("cart");
  if (cart) party.lantern(-0.38, 0.12, 0.17, "smile", { y: 1.05, parent: cart });
}

const DRESS: Record<PlaceScene["id"], (p: PlaceScene, party: Party) => void> = {
  table: dressTable,
  beach: dressBeach,
  boat: dressBoat,
  room: dressRoom,
  city: dressCity,
};

/**
 * Dresses a place for Halloween: its sky, light and colors, decorations that move, and things to tap. Call it
 * before the place's solids are used: the solid decorations join them.
 */
export function dressPlace(p: PlaceScene): void {
  const party = new Party();
  DRESS[p.id](p, party);
  p.group.add(party.group);
  p.solids.push(...party.solids);
  const base = p.update;
  p.update = (dt, t) => {
    base(dt, t);
    party.update(dt, t);
  };
  p.poke = (ray) => party.poke(ray);
}

// ---- the island ------------------------------------------------------------------------

/**
 * Squishy Island at Halloween: a purple dusk, bats round the Closet (which wears a giant witch hat), ghosts drifting
 * round the island and jack-o'-lanterns all along the shore.
 */
export function dressIsland(scene: THREE.Scene, groundAt: (r: number) => number): (dt: number, t: number) => void {
  const party = new Party();
  scene.background = duskSky("#241c4a", "#7a4fb0", "#ffb08a", 0.62);
  scene.fog = new THREE.Fog("#9a7ac0", 30, 70);
  party.bats(V(0, 4.4, 0), 4, 2.4, 1.2, 0.7);
  const ghosts: THREE.Group[] = [0, 1, 2].map(() => party.ghostAt(V(0, 0, 0), { scale: 0.7 }));
  party.on((t) => {
    // Round and round the island; each ghost bobs on top of its own float.
    ghosts.forEach((g, i) => {
      const a = t * 0.18 + (i / 3) * Math.PI * 2;
      g.position.x = Math.sin(a) * 5.2;
      g.position.z = Math.cos(a) * 5.2;
      g.position.y += groundAt(5.2) + 1.4;
      g.rotation.y += a + Math.PI / 2;
    });
  });
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const r = 0.32 + (i % 3) * 0.08;
    party.lantern(Math.sin(a) * 5.3, Math.cos(a) * 5.3, r, (["smile", "grin", "wink", "oh"] as const)[i % 4], { y: groundAt(5.3) - 0.04, yaw: a });
  }
  const hat = tinyWitchHat(2.2);
  hat.position.set(0.1, 3.45, 0);
  scene.add(hat, party.group);
  return (dt, t) => party.update(dt, t);
}

// ---- the Spooky Box ------------------------------------------------------------------------

export interface PumpkinBox {
  /** The bottom of the pumpkin, the squishy sits inside it. */
  obj: THREE.Group;
  /** The top of the pumpkin with its stem; it pops off. */
  lid: THREE.Group;
  /** Lights the face and the inside: 0 dim .. 1 bright. */
  glow(k: number): void;
}

/** Where the lid sits closed on the pumpkin. */
export const PUMPKIN_LID_CLOSED = { pos: new THREE.Vector3(0, 0.5, 0), rot: new THREE.Euler(0, 0, 0) };
/** Where the lid lands after it pops off: on the ground beside the pumpkin, tipped over. */
export const PUMPKIN_LID_OFF = { pos: new THREE.Vector3(-1.95, 0.32, -0.5), rot: new THREE.Euler(-0.35, 0.5, 0.9) };

/**
 * The Spooky Box: a big jack-o'-lantern the same size inside as the steamer basket (floor and wall), so a
 * squishy sits in it just the same. The face is half on the bottom (the smile) and half on the lid (the eyes).
 */
export function pumpkinBox(floor: number): PumpkinBox {
  const obj = new THREE.Group();
  const orange = std("#ff8a1f", { roughness: 0.45, emissive: new THREE.Color("#ff6a00"), emissiveIntensity: 0.15, side: THREE.DoubleSide });
  const outside: [number, number][] = [
    [0.7, 0],
    [1.05, 0.06],
    [1.25, 0.2],
    [1.3, 0.34],
    [1.26, 0.46],
    [1.18, 0.52],
  ];
  const v2 = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y));
  // The seam goes at the back, out of sight.
  const bowl = ribbed(new THREE.LatheGeometry(v2([[0, 0], ...outside, [1.1, 0.53], [1.08, 0.48], [1.06, 0.3], [1.0, floor], [0, floor]]), 72, Math.PI));
  add(obj, bowl, orange);
  // The inside glows when the lid comes off.
  const inner = new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.85 });
  add(obj, new THREE.CircleGeometry(1.0, 40).rotateX(-Math.PI / 2), inner, 0, floor + 0.005, 0);
  const faceMat = (kind: FaceKind) =>
    new THREE.MeshBasicMaterial({ map: faceFor(kind), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  // The smile: the lower part of a face picture, on the front of the bottom, following its curve.
  const mouthMat = faceMat("grin");
  add(obj, facePatch(outside, 0.08, 0.5, 0.0, 0.48), mouthMat);

  const lid = new THREE.Group();
  const lidSide: [number, number][] = [
    [1.17, 0],
    [1.25, 0.1],
    [1.22, 0.3],
    [1.08, 0.55],
    [0.8, 0.78],
    [0.4, 0.9],
  ];
  add(lid, ribbed(new THREE.LatheGeometry(v2([...lidSide, [0.12, 0.92], [0, 0.9]]), 72, Math.PI)), orange);
  // The eyes: the top part of a face picture, on the front of the lid.
  const eyesMat = faceMat("smile");
  add(lid, facePatch(lidSide, 0.02, 0.5, 0.48, 1.0), eyesMat);
  const stem = add(lid, stemGeo(), stemMat(), 0, 0.86, 0);
  stem.scale.setScalar(1.6);
  const leaf = add(lid, leafGeo(), leafMat(), 0.1, 0.92, 0.05);
  leaf.scale.setScalar(1.5);
  leaf.rotation.set(-1.2, 0.8, 0);
  // A curly vine.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i++) {
    const k = i / 30;
    const a = k * Math.PI * 4;
    pts.push(new THREE.Vector3(-0.1 - k * 0.5 + Math.cos(a) * 0.08, 0.95 - k * 0.12, Math.sin(a) * 0.08));
  }
  add(lid, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 6, false), std("#6f8a3a"));
  lid.position.copy(PUMPKIN_LID_CLOSED.pos);
  obj.add(lid);
  return {
    obj,
    lid,
    glow: (k) => {
      const c = 0.55 + 0.45 * k;
      mouthMat.color.setRGB(c, c * 0.95, c * 0.85);
      eyesMat.color.copy(mouthMat.color);
      inner.opacity = 0.4 + 0.55 * k;
    },
  };
}

/**
 * A patch on the front of a pumpkin shape (its side profile as [radius, height] going up), a hair outside its skin,
 * from height `y0` to `y1`, showing a face picture from `v0` (bottom) to `v1` (top).
 */
function facePatch(profile: [number, number][], y0: number, y1: number, v0: number, v1: number): THREE.BufferGeometry {
  const radiusAt = (y: number) => {
    for (let i = 1; i < profile.length; i++) {
      const [r0, h0] = profile[i - 1];
      const [r1, h1] = profile[i];
      if (y <= h1 || i === profile.length - 1) return r0 + ((y - h0) / (h1 - h0)) * (r1 - r0);
    }
    return profile[0][0];
  };
  const rows = 8;
  const pts: THREE.Vector2[] = [];
  for (let j = 0; j <= rows; j++) {
    const y = y0 + ((y1 - y0) * j) / rows;
    pts.push(new THREE.Vector2(radiusAt(y) * 1.015, y));
  }
  const geo = ribbed(new THREE.LatheGeometry(pts, 24, -0.85, 1.7));
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  return geo;
}
