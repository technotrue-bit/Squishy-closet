// Squishy Island, the title screen: a round pastel island in a calm sea, the
// Squishy Closet in the middle and eight places around it where squishies
// live. Little buns hop about while the camera drifts slowly round. Spooky
// Hollow lights up in October, and the whole island dresses up for Halloween.

import * as THREE from "three";
import { dressIsland, tinyWitchHat } from "./halloween";

export interface Island {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fit(w: number, h: number): void;
  update(dt: number, t: number): void;
}

/** The eight places, starting at the front and going round. */
export const PLACES = [
  "Steamer Bay",
  "Spooky Hollow",
  "Candy Cove",
  "Mochi Meadow",
  "Sparkle Peak",
  "Cloud Puff Hills",
  "Sweet Shore",
  "Starlight Pier",
] as const;

const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts });

function sky(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 512;
  const c = cv.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#a9dcff");
  g.addColorStop(0.55, "#ffd3ea");
  g.addColorStop(1, "#ffe9d6");
  c.fillStyle = g;
  c.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const sphere = (r: number, color: string, opts?: Partial<THREE.MeshStandardMaterialParameters>) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color, opts));

function steamer(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = mat("#e3b27a", { roughness: 0.75 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.7, 0.4, 32), wood);
  base.position.y = 0.2;
  const bun = sphere(0.55, "#f2a9cf", { roughness: 0.45 });
  bun.scale.set(1, 0.75, 1);
  bun.position.y = 0.55;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.25, 32), wood);
  lid.position.set(-0.6, 0.55, -0.6);
  lid.rotation.set(-1.1, 0, 0.3);
  g.add(base, bun, lid);
  return g;
}

function spooky(october: boolean): { obj: THREE.Object3D; glow: THREE.MeshStandardMaterial[] } {
  const g = new THREE.Group();
  const glow: THREE.MeshStandardMaterial[] = [];
  const mound = sphere(1.1, "#b9a3e3");
  mound.scale.set(1, 0.3, 1);
  g.add(mound);
  for (const [x, z, s] of [[0.15, 0.35, 1], [-0.55, -0.1, 0.7], [0.6, -0.3, 0.6]] as const) {
    const m = mat("#ff9a3c", { roughness: 0.45, emissive: new THREE.Color("#ff8a1f"), emissiveIntensity: october ? 0.55 : 0 });
    glow.push(m);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 24, 16), m);
    p.scale.set(1.15, 0.8, 1.15);
    p.position.set(x, 0.3 * s + 0.2, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.18 * s, 8), mat("#6f8a3a"));
    stem.position.set(x, 0.62 * s + 0.2, z);
    g.add(p, stem);
  }
  // A curly little tree with round purple puffs.
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.1, 8), mat("#6b4f7a"));
  trunk.position.set(-0.3, 0.75, -0.55);
  trunk.rotation.z = 0.2;
  g.add(trunk);
  for (const [x, y, z, r] of [[-0.45, 1.35, -0.55, 0.32], [-0.1, 1.25, -0.5, 0.26], [-0.6, 1.1, -0.4, 0.22]] as const) {
    const puff = sphere(r, "#8a6ac8");
    puff.position.set(x, y, z);
    g.add(puff);
  }
  if (october) {
    const light = new THREE.PointLight("#c58cff", 6, 5);
    light.position.set(0, 1.4, 0.4);
    g.add(light);
  }
  return { obj: g, glow };
}

function lollipops(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = ["#ff7fb0", "#7fd6ff", "#ffd36b"];
  colors.forEach((c, i) => {
    const a = (i / 3) * Math.PI * 2;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mat("#ffffff"));
    stick.position.set(Math.cos(a) * 0.45, 0.5 + i * 0.1, Math.sin(a) * 0.45);
    const candy = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 32), mat(c, { roughness: 0.3 }));
    candy.rotation.x = Math.PI / 2;
    candy.position.set(stick.position.x, 1.05 + i * 0.1, stick.position.z);
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 24), mat("#ffffff", { roughness: 0.3 }));
    swirl.position.copy(candy.position);
    swirl.position.z += 0.055;
    g.add(stick, candy, swirl);
  });
  return g;
}

function flowers(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = ["#ffffff", "#ffb3d1", "#fff27a", "#d4b8ff"];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.25 + (i % 3) * 0.3;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), mat("#6cbf4a"));
    stem.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
    const head = sphere(0.12, colors[i % colors.length]);
    head.scale.y = 0.6;
    head.position.set(stem.position.x, 0.36, stem.position.z);
    const mid = sphere(0.05, "#ffc94d");
    mid.position.set(stem.position.x, 0.42, stem.position.z);
    g.add(stem, head, mid);
  }
  return g;
}

function crystals(): THREE.Object3D {
  const g = new THREE.Group();
  for (const [x, z, h, c] of [[0, 0, 1.6, "#cbb5ff"], [0.45, 0.25, 1.0, "#a8e6ff"], [-0.4, 0.3, 1.15, "#ffc2e2"], [0.1, -0.45, 0.9, "#d8ccff"]] as const) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, h, 5), mat(c, { roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(c), emissiveIntensity: 0.15 }));
    m.position.set(x, h / 2, z);
    g.add(m);
  }
  return g;
}

function clouds(): THREE.Object3D {
  const g = new THREE.Group();
  for (const [x, y, z] of [[0, 1.4, 0], [0.7, 1.9, -0.3]] as const) {
    const c = new THREE.Group();
    for (const [dx, dy, r] of [[0, 0, 0.42], [0.38, -0.05, 0.32], [-0.38, -0.05, 0.32], [0.15, 0.2, 0.3]] as const) {
      const s = sphere(r, "#ffffff", { roughness: 0.9 });
      s.position.set(dx, dy, 0);
      c.add(s);
    }
    c.position.set(x, y, z);
    g.add(c);
  }
  const hill = sphere(0.9, "#d9f2c4");
  hill.scale.y = 0.45;
  g.add(hill);
  return g;
}

function iceCream(): THREE.Object3D {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 20), mat("#e9b46a", { roughness: 0.8 }));
  cone.rotation.x = Math.PI;
  cone.position.y = 0.45;
  const scoop = sphere(0.36, "#ffb3d1", { roughness: 0.4 });
  scoop.position.y = 1.0;
  const scoop2 = sphere(0.3, "#bfefff", { roughness: 0.4 });
  scoop2.position.y = 1.4;
  const cherry = sphere(0.09, "#ff4f6d", { roughness: 0.3 });
  cherry.position.y = 1.72;
  g.add(cone, scoop, scoop2, cherry);
  return g;
}

function pier(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = mat("#d9a265", { roughness: 0.8 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.6), wood);
  deck.position.set(0, 0.25, 0.4);
  g.add(deck);
  for (const [x, z] of [[-0.3, 1.1], [0.3, 1.1], [-0.3, -0.2], [0.3, -0.2]] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), wood);
    post.position.set(x, 0.1, z);
    g.add(post);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), mat("#ffffff"));
  pole.position.set(0, 0.95, -0.2);
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.14 : 0.32;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }),
    mat("#ffd84d", { roughness: 0.3, emissive: new THREE.Color("#ffd84d"), emissiveIntensity: 0.3 }),
  );
  star.position.set(0, 1.75, -0.24);
  star.name = "star";
  g.add(pole, star);
  return g;
}

function closetHouse(): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.1), mat("#ffc0dc", { roughness: 0.5 }));
  body.position.y = 0.85;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 32, 1, false, 0, Math.PI), mat("#ff8fbf", { roughness: 0.45 }));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 1.7;
  const doorMat = mat("#fff2f8", { roughness: 0.5 });
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.3, 0.06), doorMat);
    door.position.set(s * 0.34, 0.8, 0.56);
    const knob = sphere(0.05, "#ffc94d", { metalness: 0.6, roughness: 0.3 });
    knob.position.set(s * 0.09, 0.8, 0.6);
    g.add(door, knob);
  }
  // A heart over the doors.
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.15);
  hs.bezierCurveTo(-0.22, 0, -0.16, 0.18, 0, 0.08);
  hs.bezierCurveTo(0.16, 0.18, 0.22, 0, 0, -0.15);
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.05, bevelEnabled: false }), mat("#ff4f8d", { roughness: 0.35 }));
  heart.position.set(0, 1.85, 0.62);
  heart.scale.setScalar(1.3);
  g.add(body, roof, heart);
  return g;
}

interface MiniBun {
  obj: THREE.Object3D;
  center: THREE.Vector2;
  radius: number;
  speed: number;
  phase: number;
}

function miniBun(color: string, hat = false): THREE.Object3D {
  const g = new THREE.Group();
  if (hat) {
    const h = tinyWitchHat(0.32);
    h.position.y = 0.38;
    g.add(h);
  }
  const b = sphere(0.26, color, { roughness: 0.45 });
  b.scale.set(1, 0.78, 1);
  b.position.y = 0.2;
  g.add(b);
  for (const s of [-1, 1]) {
    const eye = sphere(0.035, "#2a1a24", { roughness: 0.3 });
    eye.position.set(s * 0.09, 0.22, 0.24);
    g.add(eye);
  }
  return g;
}

export function buildIsland(date = new Date()): Island {
  const october = date.getMonth() === 9;
  const scene = new THREE.Scene();
  scene.background = sky();
  scene.fog = new THREE.Fog("#ffd9ea", 30, 70);
  // At Halloween: a dusky evening, with a low warm sun and a purple sea.
  scene.add(october ? new THREE.HemisphereLight("#e2d4ff", "#ffb88a", 1.35) : new THREE.HemisphereLight("#ffffff", "#bfe6ff", 1.5));
  const sun = new THREE.DirectionalLight(october ? "#ffd9b8" : "#fff6e8", october ? 1.9 : 2.2);
  sun.position.set(-6, 12, 8);
  scene.add(sun);

  const sea = new THREE.Mesh(new THREE.CircleGeometry(60, 64), mat(october ? "#7f86d8" : "#8fd8f0", { roughness: 0.35 }));
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);
  const foams: THREE.Mesh[] = [];
  for (const r of [7.1, 8.0]) {
    const foam = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 96), mat("#ffffff", { roughness: 0.8 }));
    foam.rotation.x = Math.PI / 2;
    foam.position.y = 0.04;
    scene.add(foam);
    foams.push(foam);
  }

  const sand = sphere(6.6, "#ffe2b0", { roughness: 0.9 });
  sand.scale.set(1, 0.14, 1);
  const grass = sphere(5.9, "#bfeaa0", { roughness: 0.85 });
  grass.scale.set(1, 0.16, 1);
  grass.position.y = 0.22;
  scene.add(sand, grass);
  const top = 0.95; // height of the grass near the places

  const house = closetHouse();
  house.position.y = 1.1;
  scene.add(house);

  const sp = spooky(october);
  const builders = [steamer, () => sp.obj, lollipops, flowers, crystals, clouds, iceCream, pier];
  let star: THREE.Object3D | undefined;
  builders.forEach((make, k) => {
    const o = make();
    const a = (k / builders.length) * Math.PI * 2;
    o.position.set(Math.sin(a) * 3.9, top - (k === 7 ? 0.35 : 0), Math.cos(a) * 3.9);
    o.rotation.y = a;
    scene.add(o);
    if (k === 7) star = o.getObjectByName("star");
  });

  const colors = ["#f2a9cf", "#f8c3c6", "#ffffff", "#c9a8f0", "#a9d18e", "#ffc94d", "#ff9a3c", "#7fd6ff", "#d9573f", "#2f63d8"];
  const buns: MiniBun[] = colors.map((c, i) => {
    const obj = miniBun(c, october && i % 3 === 0);
    scene.add(obj);
    const a = (i / colors.length) * Math.PI * 2 + 0.3;
    const r = 2.0 + (i % 3) * 0.6;
    return { obj, center: new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r), radius: 0.35 + (i % 2) * 0.25, speed: (i % 2 ? 1 : -1) * (0.4 + (i % 4) * 0.1), phase: i * 1.3 };
  });

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  // Grass height at a distance from the middle.
  const groundAt = (r: number) => 0.22 + 0.16 * Math.sqrt(Math.max(0, 5.9 * 5.9 - r * r));
  const party = october ? dressIsland(scene, groundAt) : null;
  let dist = 20;
  const look = new THREE.Vector3(0, 1.1, 0);

  return {
    scene,
    camera,
    fit(w, h) {
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // Fit most of the island across a tall phone; the edges can drift off.
      dist = Math.min(27, Math.max(15, 6.0 / (t * camera.aspect)));
      camera.updateProjectionMatrix();
    },
    update(dt, t) {
      const a = t * 0.07;
      camera.position.set(Math.sin(a) * dist, dist * 0.62, Math.cos(a) * dist);
      // Leave the bottom of the screen for the Play button.
      look.y = 1.1 - dist * 0.08;
      camera.lookAt(look);
      for (const b of buns) {
        const ang = b.phase + t * b.speed;
        const hopT = (t * 2.2 + b.phase) % 1;
        const hop = Math.sin(hopT * Math.PI);
        b.obj.position.set(b.center.x + Math.cos(ang) * b.radius, top - 0.05 + hop * 0.35, b.center.y + Math.sin(ang) * b.radius);
        b.obj.rotation.y = -ang + (b.speed > 0 ? 0 : Math.PI);
        const squash = hopT < 0.08 || hopT > 0.92 ? 0.8 : 1;
        b.obj.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      }
      for (const [i, f] of foams.entries()) f.scale.setScalar(1 + Math.sin(t * 0.9 + i) * 0.015);
      if (star) star.rotation.y = t * 0.8;
      if (october) for (const [i, m] of sp.glow.entries()) m.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2 + i);
      party?.(dt, t);
    },
  };
}
