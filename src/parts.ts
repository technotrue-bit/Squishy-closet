// Little extras that ride on a squishy's soft body: cat ears, bat wings, a
// pumpkin stem, a witch hat, bolts, spider legs, a vampire collar and bow tie.
// Each one is pinned to a spot on the surface and follows it through every
// squish, so the ears squash down with the bun.

import * as THREE from "three";
import type { Part } from "./catalog";

/**
 * A part pinned to the body. Its local frame: +Y out of the surface, +Z along
 * the surface toward `ref` (the body's front, up or down), +X = Y cross Z.
 */
export interface PartPin {
  obj: THREE.Object3D;
  /** Rest direction from the body center to where it is pinned. */
  dir: THREE.Vector3;
  /** Lift off the surface along the normal. */
  lift: number;
  ref: "forward" | "up" | "down";
  /** Optional idle motion. */
  animate?: (obj: THREE.Object3D, t: number) => void;
}

/** Shape-space x to local +Y (out), y to +Z, z to +X: a plain rotation. */
const OUT_UP = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
/** Shape-space x to +X, y to +Z, z to -Y: a flat shape standing along Z. */
const STAND = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0));

const mat = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3, ...opts });

const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

function catEar(body: string, inner: string): THREE.Object3D {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 24, 1), mat(body));
  outer.scale.z = 0.55;
  outer.position.y = 0.11;
  const pink = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.19, 20, 1), mat(inner, { roughness: 0.7, clearcoat: 0 }));
  pink.scale.z = 0.3;
  pink.position.set(0, 0.08, 0.05);
  g.add(outer, pink);
  return g;
}

function batWing(color: string, side: number): THREE.Object3D {
  // A scalloped wing shape, made thin.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.18, 0.32, 0.5, 0.36);
  s.quadraticCurveTo(0.44, 0.22, 0.48, 0.12);
  s.quadraticCurveTo(0.36, 0.14, 0.32, 0.02);
  s.quadraticCurveTo(0.22, 0.08, 0.16, -0.06);
  s.quadraticCurveTo(0.08, 0.0, 0, -0.08);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -0.015);
  // Sticks out from the side (shape x), rises up (shape y).
  geo.applyMatrix4(OUT_UP);
  const m = new THREE.Mesh(geo, mat(color, { roughness: 0.6 }));
  const g = new THREE.Group();
  const hinge = new THREE.Group();
  hinge.add(m);
  g.add(hinge);
  g.userData.side = side;
  return g;
}

function stem(): THREE.Object3D {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(0.09, 0.24, 0));
  const s = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.055, 10, false), mat("#6f8a3a", { roughness: 0.75, clearcoat: 0 }));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), s.material);
  cap.position.set(0.09, 0.24, 0);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.12, 0.1, 0.26, 0);
  leafShape.quadraticCurveTo(0.12, -0.1, 0, 0);
  const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 8), mat("#7fc65a", { side: THREE.DoubleSide, roughness: 0.6 }));
  leaf.rotation.set(-Math.PI / 2 + 0.4, 0, 0.5);
  leaf.position.set(0.02, 0.02, 0.02);
  g.add(s, cap, leaf);
  return g;
}

export function witchHat(): THREE.Object3D {
  const g = new THREE.Group();
  const felt = mat("#3d2b5a", { roughness: 0.8, clearcoat: 0.1 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, 40), felt);
  // A cone that bends over at the tip.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(0.18 * t * t, 0.62 * t, 0));
  }
  const path = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(path, 24, 1, 24, false);
  // Taper the tube into a cone.
  const p = tube.getAttribute("position") as THREE.BufferAttribute;
  const segs = 24;
  const ring = 25;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = path.getPointAt(t);
    const r = 0.3 * (1 - t) + 0.01;
    for (let k = 0; k < ring; k++) {
      const n = i * ring + k;
      const x = p.getX(n) - c.x;
      const y = p.getY(n) - c.y;
      const z = p.getZ(n) - c.z;
      p.setXYZ(n, c.x + x * r, c.y + y * r, c.z + z * r);
    }
  }
  tube.computeVertexNormals();
  const cone = new THREE.Mesh(tube, felt);
  cone.position.y = 0.02;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 10, 40), mat("#ff9a3c"));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.07;
  g.add(brim, cone, band);
  g.rotation.z = -0.18;
  return g;
}

function bolt(): THREE.Object3D {
  const g = new THREE.Group();
  const metal = mat("#b7bec8", { metalness: 0.7, roughness: 0.3 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 14), metal);
  rod.position.y = 0.05;
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 6), metal);
  nut.position.y = 0.12;
  g.add(rod, nut);
  return g;
}

function spiderLeg(color: string): THREE.Object3D {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.16, 0.02),
    new THREE.Vector3(0, 0.26, 0.1),
    new THREE.Vector3(0, 0.3, 0.26),
  ]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.032, 8, false), mat(color, { roughness: 0.7 }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), m.material);
  tip.position.copy(curve.getPoint(1));
  const g = new THREE.Group();
  g.add(m, tip);
  return g;
}

function collarPoint(): THREE.Object3D {
  const s = new THREE.Shape();
  s.moveTo(-0.16, 0);
  s.quadraticCurveTo(-0.05, 0.25, 0.12, 0.42);
  s.quadraticCurveTo(0.12, 0.18, 0.16, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  // Stands up along the surface, tipped a little outward.
  geo.applyMatrix4(STAND);
  const m = new THREE.Mesh(geo, mat("#5b2a7a", { roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#c48cff") }));
  const g = new THREE.Group();
  m.rotation.x = -0.35;
  g.add(m);
  return g;
}

function bowTie(): THREE.Object3D {
  const g = new THREE.Group();
  const red = mat("#d62f4f", { roughness: 0.45 });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 4, 1), red);
    wing.rotation.z = (s * Math.PI) / 2;
    wing.position.x = s * 0.085;
    wing.scale.set(1, 1, 0.5);
    g.add(wing);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), red);
  g.add(knot);
  // Lie flat on the surface, facing out.
  const holder = new THREE.Group();
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0.03;
  holder.add(g);
  return holder;
}

function leaf(): THREE.Object3D {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.14, 0.12, 0.3, 0);
  s.quadraticCurveTo(0.14, -0.12, 0, 0);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), mat("#6cbf4a", { side: THREE.DoubleSide }));
  m.rotation.set(-Math.PI / 2 + 0.5, 0, 0.6);
  const g = new THREE.Group();
  g.add(m);
  return g;
}

/** Builds the pins for a squishy's extras. */
export function buildParts(parts: Part[], bodyColor: string): PartPin[] {
  const pins: PartPin[] = [];
  for (const p of parts) {
    switch (p) {
      case "catEars":
        for (const s of [-1, 1]) pins.push({ obj: catEar(bodyColor, "#ff9ec4"), dir: dir(s * 0.5, 0.85, 0.05), lift: -0.03, ref: "forward" });
        break;
      case "batWings":
        for (const s of [-1, 1])
          pins.push({
            obj: batWing(bodyColor, s),
            dir: dir(s * 0.98, 0.18, -0.15),
            lift: -0.02,
            ref: "up",
            animate: (o, t) => {
              o.rotation.z = s * (0.15 + Math.sin(t * 6) * 0.35);
            },
          });
        break;
      case "stem":
        pins.push({ obj: stem(), dir: dir(0, 1, 0), lift: -0.03, ref: "forward" });
        break;
      case "witchHat":
        pins.push({ obj: witchHat(), dir: dir(0.05, 1, 0), lift: -0.05, ref: "forward" });
        break;
      case "bolts":
        for (const s of [-1, 1]) pins.push({ obj: bolt(), dir: dir(s, 0.12, -0.05), lift: -0.02, ref: "up" });
        break;
      case "spiderLegs":
        for (let k = 0; k < 8; k++) {
          // Four legs each side, around the lower body, leaving the front clear.
          const side = k < 4 ? -1 : 1;
          const a = side * (0.55 + (k % 4) * 0.42);
          pins.push({
            obj: spiderLeg(bodyColor),
            dir: dir(Math.sin(a), -0.25, Math.cos(a)),
            lift: -0.03,
            ref: "down",
            animate: (o, t) => {
              o.rotation.x = Math.sin(t * 3 + k) * 0.12;
            },
          });
        }
        break;
      case "collar":
        for (const s of [-1, 1]) pins.push({ obj: collarPoint(), dir: dir(s * 0.62, 0.42, -0.62), lift: -0.04, ref: "up" });
        break;
      case "bowTie":
        pins.push({ obj: bowTie(), dir: dir(0, -0.26, 0.96), lift: -0.01, ref: "up" });
        break;
      case "leaf":
        pins.push({ obj: leaf(), dir: dir(0, 1, 0), lift: 0, ref: "forward" });
        break;
    }
  }
  return pins;
}
