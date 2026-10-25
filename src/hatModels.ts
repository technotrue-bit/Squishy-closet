// The 3D hats. Each one is built at its base, standing up +Y and facing +Z,
// sized for the top of a bun. Hats come alive: pompoms bob, propellers spin
// faster when the squishy hops, bunny ears flop, gems twinkle, a sleepy cap
// droops when its squishy naps. The squishy also makes the whole hat wobble
// and lag behind every hop and squish (see squishy.ts).

import * as THREE from "three";
import { witchHat } from "./parts";

export interface HatCtx {
  /** How hard the squishy is moving, 0 calm .. about 1 bouncing. */
  energy: number;
  sleeping: boolean;
  dt: number;
}

export interface HatModel {
  obj: THREE.Group;
  animate?: (t: number, c: HatCtx) => void;
}

const mat = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.3, ...opts });
const felt = (color: string) => mat(color, { roughness: 0.85, clearcoat: 0.05, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") });

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

/** A soft ball that springs about on top of a hat. */
class Bobble {
  readonly g = new THREE.Group();
  private x = 0;
  private z = 0;
  private vx = 0;
  private vz = 0;
  constructor(r: number, color: string) {
    this.g.add(mesh(new THREE.SphereGeometry(r, 18, 14), felt(color)));
  }
  step(t: number, c: HatCtx, sway = 1): void {
    const dt = Math.min(c.dt, 1 / 30);
    // Kicked by the squishy's energy, pulled home by a spring.
    this.vx += (Math.sin(t * 9.1) * c.energy * 30 - this.x * 120 - this.vx * 7) * dt;
    this.vz += (Math.cos(t * 7.3) * c.energy * 30 - this.z * 120 - this.vz * 7) * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.g.rotation.set(this.z + Math.sin(t * 1.7) * 0.06 * sway, 0, this.x + Math.sin(t * 2.1) * 0.08 * sway);
  }
}

function party(): HatModel {
  const stripes = canvasTex(256, 256, (c) => {
    c.fillStyle = "#ff8fbf";
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = "#fff2a8";
    for (let k = -256; k < 512; k += 64) {
      c.beginPath();
      c.moveTo(k, 256);
      c.lineTo(k + 26, 256);
      c.lineTo(k + 26 + 160, 0);
      c.lineTo(k + 160, 0);
      c.fill();
    }
    c.fillStyle = "#ffffff";
    for (let i = 0; i < 26; i++) {
      c.beginPath();
      c.arc((i * 97) % 256, (i * 53) % 256, 7, 0, Math.PI * 2);
      c.fill();
    }
  });
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(0.25, 0.5, 32, 1, true), mat("#ffffff", { map: stripes, side: THREE.DoubleSide }), 0, 0.25, 0));
  g.add(mesh(new THREE.TorusGeometry(0.245, 0.04, 10, 32).rotateX(Math.PI / 2), felt("#b98ae8"), 0, 0.01, 0));
  const top = new Bobble(0.075, "#fff7c2");
  top.g.position.y = 0.5;
  top.g.children[0].position.y = 0.04;
  g.add(top.g);
  g.rotation.z = -0.12;
  return { obj: g, animate: (t, c) => top.step(t, c) };
}

function bow(): HatModel {
  const g = new THREE.Group();
  const pink = mat("#ff6fa8", { sheen: 0.8, sheenColor: new THREE.Color("#ffd0e6") });
  const loops: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.13, 0.055, 12, 24), pink, s * 0.14, 0.12, 0);
    loop.scale.set(1, 0.75, 0.55);
    loop.rotation.z = s * 0.25;
    loops.push(loop);
    g.add(loop);
    const tail = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.025), pink, s * 0.06, 0.02, 0.01);
    tail.rotation.z = s * 0.5;
    g.add(tail);
  }
  g.add(mesh(new THREE.SphereGeometry(0.065, 14, 10), pink, 0, 0.12, 0.01));
  g.position.z = 0.05;
  return {
    obj: g,
    animate: (t, c) => {
      const f = Math.sin(t * 3) * 0.06 + c.energy * Math.sin(t * 14) * 0.15;
      loops.forEach((l, i) => (l.rotation.z = (i ? 1 : -1) * (0.25 + f)));
    },
  };
}

function strawberry(): HatModel {
  const g = new THREE.Group();
  const cap = new THREE.SphereGeometry(0.3, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const berry = mesh(cap, mat("#ff4f6a", { roughness: 0.4, clearcoat: 0.7 }));
  berry.scale.set(1, 1.15, 1);
  g.add(berry);
  const seedMat = mat("#ffe27a");
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39;
    const v = 0.25 + (i % 5) * 0.12;
    const seed = mesh(new THREE.SphereGeometry(0.018, 8, 6), seedMat);
    seed.position.set(Math.cos(a) * Math.cos(v) * 0.3, Math.sin(v) * 0.345, Math.sin(a) * Math.cos(v) * 0.3);
    seed.scale.set(1, 1.6, 1);
    g.add(seed);
  }
  const leaves = new THREE.Group();
  const leafMat = mat("#5cbf4a", { side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.06, 0.2, 8, 1), leafMat);
    leaf.rotation.set(Math.PI / 2 - 0.4, 0, 0);
    leaf.position.set(0, 0, 0.08);
    const arm = new THREE.Group();
    arm.rotation.y = (i / 6) * Math.PI * 2;
    arm.add(leaf);
    leaves.add(arm);
  }
  leaves.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 8), leafMat, 0, 0.06, 0));
  leaves.position.y = 0.33;
  g.add(leaves);
  return { obj: g, animate: (t, c) => (leaves.rotation.y = Math.sin(t * 1.5) * 0.2 + c.energy * 0.4) };
}

function chef(): HatModel {
  const g = new THREE.Group();
  const white = felt("#ffffff");
  g.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 32), white, 0, 0.08, 0));
  const puff = new THREE.Group();
  puff.add(mesh(new THREE.SphereGeometry(0.2, 18, 14), white, 0, 0.12, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    puff.add(mesh(new THREE.SphereGeometry(0.15, 16, 12), white, Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17));
  }
  puff.position.y = 0.16;
  g.add(puff);
  return {
    obj: g,
    animate: (t, c) => {
      const s = 1 + Math.sin(t * 2.4) * 0.03 + c.energy * Math.sin(t * 12) * 0.08;
      puff.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
    },
  };
}

function sunHat(): HatModel {
  const g = new THREE.Group();
  const straw = mat("#f6d58e", { roughness: 0.8, clearcoat: 0.1 });
  const brimPts = [new THREE.Vector2(0.25, 0.02), new THREE.Vector2(0.45, 0.0), new THREE.Vector2(0.62, -0.06), new THREE.Vector2(0.64, -0.08)];
  const brim = mesh(new THREE.LatheGeometry(brimPts, 48), mat("#f6d58e", { roughness: 0.8, clearcoat: 0.1, side: THREE.DoubleSide }));
  g.add(brim);
  const crown = new THREE.SphereGeometry(0.26, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const c1 = mesh(crown, straw);
  c1.scale.set(1, 0.85, 1);
  g.add(c1);
  g.add(mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.07, 32, 1, true), mat("#ff7fb0", { side: THREE.DoubleSide }), 0, 0.04, 0));
  const flower = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    flower.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), mat("#ffffff"), Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0));
  }
  flower.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), mat("#ffd84d"), 0, 0, 0.02));
  flower.position.set(0.2, 0.06, 0.16);
  flower.rotation.y = 0.8;
  g.add(flower);
  g.rotation.z = 0.1;
  return {
    obj: g,
    animate: (t, c) => {
      // The floppy brim waves.
      brim.rotation.x = Math.sin(t * 2.2) * 0.04 + Math.sin(t * 11) * c.energy * 0.12;
      brim.rotation.z = Math.cos(t * 1.8) * 0.04;
    },
  };
}

function flowerCrown(): HatModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 40).rotateX(Math.PI / 2), mat("#6cbf4a"), 0, 0.03, 0));
  const colors = ["#ff8fbf", "#fff2a8", "#c9a8f0", "#ffffff", "#ffb38a", "#8fd0ff", "#ff8fbf"];
  const flowers: THREE.Group[] = [];
  colors.forEach((col, i) => {
    const a = (i / colors.length) * Math.PI * 2;
    const f = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const b = (k / 5) * Math.PI * 2;
      f.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(col), Math.cos(b) * 0.045, Math.sin(b) * 0.045, 0));
    }
    f.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), mat("#ffd84d"), 0, 0, 0.02));
    f.position.set(Math.sin(a) * 0.3, 0.06, Math.cos(a) * 0.3);
    f.rotation.y = a;
    f.rotation.x = -0.4;
    flowers.push(f);
    g.add(f);
  });
  return {
    obj: g,
    animate: (t, c) =>
      flowers.forEach((f, i) => {
        f.rotation.z = t * (0.6 + c.energy * 3) + i;
        f.position.y = 0.06 + Math.sin(t * 2 + i) * 0.01;
      }),
  };
}

function propeller(): HatModel {
  const g = new THREE.Group();
  const cols = ["#ff5f7a", "#ffd84d", "#4fb3ff", "#6cd36c"];
  for (let i = 0; i < 4; i++) {
    const q = new THREE.SphereGeometry(0.26, 12, 10, (i * Math.PI) / 2, Math.PI / 2, 0, Math.PI / 2);
    g.add(mesh(q, mat(cols[i])));
  }
  const visor = new THREE.CylinderGeometry(0.3, 0.3, 0.02, 32, 1, false, -Math.PI / 2.6, Math.PI / 1.3);
  g.add(mesh(visor, mat("#ff5f7a"), 0, 0.01, 0.08));
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), mat("#888888", { metalness: 0.6 }), 0, 0.29, 0));
  const prop = new THREE.Group();
  for (const s of [-1, 1]) {
    const blade = mesh(new THREE.BoxGeometry(0.28, 0.012, 0.07), mat(s > 0 ? "#4fb3ff" : "#ffd84d"), s * 0.15, 0, 0);
    blade.rotation.x = s * 0.35;
    prop.add(blade);
  }
  prop.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), mat("#ff5f7a")));
  prop.position.y = 0.35;
  g.add(prop);
  let spin = 0;
  return {
    obj: g,
    animate: (t, c) => {
      spin += c.dt * (2 + c.energy * 30);
      prop.rotation.y = spin;
    },
  };
}

function captain(): HatModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.31, 0.26, 0.18, 32), mat("#ffffff", { roughness: 0.5 }), 0, 0.12, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.07, 32), mat("#26346b"), 0, 0.035, 0));
  const visor = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 32, 1, false, -Math.PI / 2.4, Math.PI / 1.2), mat("#1d1d28", { roughness: 0.25, clearcoat: 1 }), 0, 0.01, 0.06);
  visor.rotation.x = 0.18;
  g.add(visor);
  const badge = new THREE.Group();
  const gold = mat("#e8b43c", { metalness: 0.8, roughness: 0.3 });
  badge.add(mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), gold, 0, 0.03, 0));
  badge.add(mesh(new THREE.BoxGeometry(0.018, 0.08, 0.015), gold));
  const arc = mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16, Math.PI), gold, 0, -0.02, 0);
  arc.rotation.z = Math.PI;
  badge.add(arc);
  badge.position.set(0, 0.12, 0.29);
  badge.rotation.x = -0.12;
  g.add(badge);
  return { obj: g, animate: (t) => (badge.rotation.y = Math.sin(t * 1.3) * 0.2) };
}

function sailor(): HatModel {
  const g = new THREE.Group();
  const white = mat("#ffffff", { roughness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.17, 32), white, 0, 0.085, 0));
  g.add(mesh(new THREE.TorusGeometry(0.29, 0.05, 10, 36).rotateX(Math.PI / 2), white, 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.04, 32, 1, true), mat("#3d6fd8", { side: THREE.DoubleSide }), 0, 0.1, 0));
  const tails: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const tail = new THREE.Group();
    tail.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 0.012), mat("#3d6fd8"), 0, -0.1, 0));
    tail.position.set(s * 0.06, 0.1, -0.27);
    tail.rotation.z = s * 0.2;
    tails.push(tail);
    g.add(tail);
  }
  return {
    obj: g,
    animate: (t, c) =>
      tails.forEach((tail, i) => {
        tail.rotation.x = -0.3 - Math.sin(t * 4 + i) * 0.15 - c.energy * 0.6;
      }),
  };
}

function pirate(): HatModel {
  const g = new THREE.Group();
  const black = mat("#2b2433", { roughness: 0.75, clearcoat: 0.1 });
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.2, 32), black, 0, 0.1, 0));
  // Three turned-up sides.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const side = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 24, 1, true, -0.75, 1.5), mat("#2b2433", { roughness: 0.75, side: THREE.DoubleSide }));
    side.position.y = 0.12;
    side.rotation.y = a;
    side.scale.set(1, 1, 0.75);
    g.add(side);
  }
  g.add(mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 36).rotateX(Math.PI / 2), mat("#e8b43c", { metalness: 0.7, roughness: 0.3 }), 0, 0.02, 0));
  // A friendly heart badge.
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.05);
  heart.bezierCurveTo(-0.07, 0, -0.05, 0.05, 0, 0.025);
  heart.bezierCurveTo(0.05, 0.05, 0.07, 0, 0, -0.05);
  const hm = mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.012, bevelEnabled: false }), mat("#ffffff"), 0, 0.13, 0.33);
  g.add(hm);
  const plume = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.22, -0.05), new THREE.Vector3(0.22, 0.3, -0.12));
  plume.add(mesh(new THREE.TubeGeometry(curve, 16, 0.035, 8), mat("#ff7fb0", { roughness: 0.9, clearcoat: 0 })));
  plume.position.set(0.12, 0.16, -0.08);
  g.add(plume);
  return { obj: g, animate: (t, c) => (plume.rotation.z = -0.1 + Math.sin(t * 3) * 0.12 + Math.sin(t * 13) * c.energy * 0.25) };
}

function nightcap(): HatModel {
  const g = new THREE.Group();
  const blue = felt("#9fb8ff");
  g.add(mesh(new THREE.TorusGeometry(0.27, 0.05, 10, 36).rotateX(Math.PI / 2), felt("#ffffff"), 0, 0.02, 0));
  // A floppy cone made of links that bend one after another.
  const links: THREE.Group[] = [];
  let parent: THREE.Object3D = g;
  const radii = [0.26, 0.2, 0.15, 0.1, 0.06];
  for (let i = 0; i < radii.length - 1; i++) {
    const link = new THREE.Group();
    link.position.y = i === 0 ? 0.03 : 0.13;
    link.add(mesh(new THREE.CylinderGeometry(radii[i + 1], radii[i], 0.14, 24), blue, 0, 0.065, 0));
    parent.add(link);
    links.push(link);
    parent = link;
  }
  const tip = new Bobble(0.07, "#ffffff");
  tip.g.position.y = 0.14;
  parent.add(tip.g);
  let droop = 0;
  return {
    obj: g,
    animate: (t, c) => {
      droop += ((c.sleeping ? 1 : 0.35) - droop) * Math.min(1, c.dt * 2);
      links.forEach((l, i) => {
        l.rotation.z = -(0.18 + droop * 0.32) * (i ? 1 : 0.4) + Math.sin(t * 1.6 - i * 0.7) * 0.05 + Math.sin(t * 9 - i) * c.energy * 0.12;
        l.rotation.x = Math.cos(t * 1.3 - i * 0.6) * 0.04;
      });
      tip.step(t, c, 0.5);
    },
  };
}

function bunny(): HatModel {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 36).rotateX(Math.PI / 2), mat("#ffb3d1"), 0, 0.03, 0));
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    const outer = mesh(new THREE.CapsuleGeometry(0.07, 0.32, 6, 14), felt("#ffffff"), 0, 0.22, 0);
    outer.scale.z = 0.45;
    const inner = mesh(new THREE.CapsuleGeometry(0.04, 0.26, 6, 12), felt("#ffb3d1"), 0, 0.22, 0.03);
    inner.scale.z = 0.3;
    ear.add(outer, inner);
    ear.position.set(s * 0.13, 0.08, 0);
    ear.rotation.z = -s * 0.18;
    ears.push(ear);
    g.add(ear);
  }
  let twitch = 0;
  return {
    obj: g,
    animate: (t, c) => {
      twitch = Math.max(0, twitch - c.dt);
      if (twitch === 0 && Math.random() < c.dt * 0.25) twitch = 0.35;
      ears.forEach((ear, i) => {
        const s = i ? 1 : -1;
        const flop = c.sleeping ? 0.9 : 0;
        ear.rotation.z = -s * (0.18 + flop * 0.6 + Math.sin(t * 2 + i) * 0.04 + Math.sin(t * 12 + i) * c.energy * 0.25);
        ear.rotation.x = (i === 1 && twitch > 0 ? Math.sin(twitch * 30) * 0.3 : 0) - flop * 0.4;
      });
    },
  };
}

function beanie(): HatModel {
  const knit = canvasTex(256, 64, (c) => {
    c.fillStyle = "#7fd0c2";
    c.fillRect(0, 0, 256, 64);
    c.fillStyle = "rgba(255,255,255,0.18)";
    for (let x = 0; x < 256; x += 16) c.fillRect(x, 0, 7, 64);
    c.fillStyle = "#ffffff";
    c.fillRect(0, 26, 256, 10);
  });
  knit.repeat.set(2, 1);
  const g = new THREE.Group();
  const dome = mesh(new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat("#ffffff", { map: knit, roughness: 0.9, clearcoat: 0, sheen: 0.6 }));
  dome.scale.set(1, 1.1, 1);
  g.add(dome);
  g.add(mesh(new THREE.TorusGeometry(0.28, 0.06, 10, 36).rotateX(Math.PI / 2), felt("#5fb8aa"), 0, 0.03, 0));
  const pom = new Bobble(0.09, "#fff2a8");
  pom.g.position.y = 0.3;
  pom.g.children[0].position.y = 0.05;
  g.add(pom.g);
  return { obj: g, animate: (t, c) => pom.step(t, c) };
}

function crown(): HatModel {
  const g = new THREE.Group();
  const gold = mat("#f2c14e", { metalness: 0.85, roughness: 0.25, clearcoat: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.12, 40, 1, true), mat("#f2c14e", { metalness: 0.85, roughness: 0.25, clearcoat: 1, side: THREE.DoubleSide }), 0, 0.06, 0));
  const gems: THREE.MeshPhysicalMaterial[] = [];
  const gemCols = ["#ff4f8d", "#4fb3ff", "#6cd36c", "#c48cff", "#ffd84d"];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.15, 12), gold, Math.sin(a) * 0.25, 0.18, Math.cos(a) * 0.25));
    g.add(mesh(new THREE.SphereGeometry(0.025, 10, 8), gold, Math.sin(a) * 0.25, 0.27, Math.cos(a) * 0.25));
    const gm = mat(gemCols[i], { roughness: 0.1, clearcoat: 1, emissive: new THREE.Color(gemCols[i]), emissiveIntensity: 0.3 });
    gems.push(gm);
    g.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), gm, Math.sin(a) * 0.255, 0.065, Math.cos(a) * 0.255));
  }
  g.rotation.z = 0.1;
  return { obj: g, animate: (t) => gems.forEach((m, i) => (m.emissiveIntensity = 0.25 + 0.5 * Math.max(0, Math.sin(t * 3 + i * 1.3)) ** 4)) };
}

function topHat(): HatModel {
  const g = new THREE.Group();
  const black = mat("#2b2433", { roughness: 0.45, clearcoat: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.025, 40), black, 0, 0.012, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.42, 32), black, 0, 0.22, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 32, 1, true), mat("#ff7fb0", { side: THREE.DoubleSide }), 0, 0.07, 0));
  g.rotation.z = -0.12;
  return { obj: g };
}

function frog(): HatModel {
  const g = new THREE.Group();
  const green = felt("#7fd36a");
  const hood = mesh(new THREE.SphereGeometry(0.3, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), green);
  hood.scale.set(1, 0.8, 1);
  g.add(hood);
  const lids: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.add(mesh(new THREE.SphereGeometry(0.09, 16, 12), green));
    eye.add(mesh(new THREE.SphereGeometry(0.065, 16, 12), mat("#ffffff", { roughness: 0.3 }), 0, 0.01, 0.04));
    const pupil = mesh(new THREE.SphereGeometry(0.035, 12, 10), mat("#1d1d28", { roughness: 0.2, clearcoat: 1 }), 0, 0.01, 0.095);
    pupils.push(pupil);
    eye.add(pupil);
    const lid = mesh(new THREE.SphereGeometry(0.095, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), green, 0, 0, 0);
    lid.rotation.x = -0.2;
    lids.push(lid);
    eye.add(lid);
    eye.position.set(s * 0.12, 0.22, 0.06);
    g.add(eye);
  }
  let blink = 0;
  return {
    obj: g,
    animate: (t, c) => {
      blink = Math.max(0, blink - c.dt);
      if (blink === 0 && Math.random() < c.dt * 0.4) blink = 0.18;
      const shut = c.sleeping ? 1 : blink > 0 ? Math.sin((blink / 0.18) * Math.PI) : 0;
      lids.forEach((l) => (l.rotation.x = -0.2 + shut * 1.6));
      pupils.forEach((p, i) => (p.position.x = Math.sin(t * 0.7 + i * 0.2) * 0.02));
    },
  };
}

function witch(): HatModel {
  const inner = witchHat();
  const g = new THREE.Group();
  inner.scale.setScalar(0.8);
  g.add(inner);
  return { obj: g, animate: (t, c) => (inner.rotation.z = -0.18 + Math.sin(t * 1.4) * 0.05 + Math.sin(t * 10) * c.energy * 0.15) };
}

function pumpkin(): HatModel {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 0.5);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const cap = mesh(geo, mat("#ff9a3c", { roughness: 0.5 }));
  cap.scale.set(1, 0.9, 1);
  g.add(cap);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 10), mat("#6f8a3a"), 0, 0.29, 0));
  const leaf = mesh(new THREE.ConeGeometry(0.06, 0.18, 8), mat("#7fc65a"), 0.07, 0.27, 0);
  leaf.rotation.z = -1.1;
  g.add(leaf);
  return { obj: g, animate: (t, c) => (leaf.rotation.z = -1.1 + Math.sin(t * 2) * 0.15 + c.energy * 0.3) };
}

const BUILDERS: Record<string, () => HatModel> = {
  party,
  bow,
  strawberry,
  chef,
  sunHat,
  flowerCrown,
  propeller,
  captain,
  sailor,
  pirate,
  nightcap,
  bunny,
  beanie,
  crown,
  topHat,
  frog,
  witch,
  pumpkin,
};

export function buildHat(id: string): HatModel | null {
  const b = BUILDERS[id];
  return b ? b() : null;
}

export const HAT_MODEL_IDS = Object.keys(BUILDERS);
