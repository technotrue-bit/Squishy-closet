// Squishies get a little muddy while you're away. Each squishy remembers when it last had a bath, and every day
// since then it picks up a bit more: a couple of specks after a day, a few smudges after two, and after four days
// it's properly muddy, with a puff of dust now and then and a little fly buzzing round its head. A bath washes it
// all off. It is only ever a look: nothing is lost, nobody gets sad or sick, and no love, stars or cookies go away.
// Days are the phone's own days (so ?date=YYYY-MM-DD lets a grown-up see later ones). The sums live up top so the
// tests can check them; the little 3D bits are below, and squishy.ts wears them.

import * as THREE from "three";
import type { PartPin } from "./parts";

/** How muddy it can get. 0 is clean. */
export const DIRT_MAX = 3;

const DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days (the phone's own days) since `washed`, 0 the same day. Never less than 0. */
export function dirtDays(washed: number | undefined, d: Date): number {
  if (!washed || !Number.isFinite(washed)) return 0;
  return Math.max(0, Math.round((midnight(d) - midnight(new Date(washed))) / DAY));
}

/** How muddy after that many days: 1 day a little, 2 or 3 days more, 4 days or more as muddy as it gets. */
export function dirtLevel(days: number): number {
  if (days <= 0) return 0;
  if (days === 1) return 1;
  if (days <= 3) return 2;
  return DIRT_MAX;
}

/** How muddy a squishy is today, from when it was last washed. */
export const dirtOf = (washed: number | undefined, d: Date): number => dirtLevel(dirtDays(washed, d));

/** What to say when you come back to a muddy one. */
export function muddyWords(name: string, level: number): string {
  if (level >= DIRT_MAX) return `${name} is super muddy! Bath time? 🛁`;
  if (level === 2) return `${name} got muddy while you were away. Bath time? 🛁`;
  return `${name} got a tiny bit muddy. Bath time? 🛁`;
}

/**
 * Mud spots, kept off the face (which is on the front): direction from the middle, size, and the level it shows
 * from. Each level keeps the spots before it and adds more.
 */
export const MUD: readonly { dir: [number, number, number]; r: number; from: number }[] = [
  { dir: [-0.85, 0.15, 0.45], r: 0.13, from: 1 },
  { dir: [0.6, 0.75, -0.2], r: 0.11, from: 1 },
  { dir: [0.95, -0.1, 0.25], r: 0.16, from: 2 },
  { dir: [-0.3, 0.92, 0.25], r: 0.14, from: 2 },
  { dir: [-0.9, -0.3, -0.3], r: 0.15, from: 2 },
  { dir: [0.78, 0.42, 0.45], r: 0.12, from: 3 },
  { dir: [-0.7, 0.55, -0.45], r: 0.15, from: 3 },
  { dir: [0.35, -0.25, -0.9], r: 0.17, from: 3 },
  { dir: [0.05, 1, -0.3], r: 0.13, from: 3 },
];

/** How many mud spots show at a level. */
export const spotsAt = (level: number): number => MUD.filter((m) => m.from <= level).length;

/** Little puffs of dust float up from a squishy this muddy or more. */
export const DUST_FROM = 2;
/** The fly comes at the muddiest. */
export const FLY_FROM = DIRT_MAX;

// ---- the look --------------------------------------------------------------------

const BROWNS = ["#8a5a3a", "#6e4630", "#9a6a44"];
let mudMats: THREE.MeshStandardMaterial[] | null = null;
let blob: THREE.SphereGeometry | null = null;

/** A soft splat of mud with a few flecks round it, lying flat on the surface (+Y out). */
function splat(r: number, i: number): THREE.Group {
  mudMats ??= BROWNS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  blob ??= new THREE.SphereGeometry(1, 12, 8);
  const m = mudMats[i % mudMats.length];
  const g = new THREE.Group();
  const big = new THREE.Mesh(blob, m);
  big.scale.set(r, r * 0.3, r * 0.8);
  big.rotation.y = i * 1.3;
  g.add(big);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + i;
    const fleck = new THREE.Mesh(blob, m);
    fleck.position.set(Math.cos(a) * r * 1.45, 0, Math.sin(a) * r * 1.35);
    fleck.scale.set(r * 0.26, r * 0.1, r * 0.26);
    g.add(fleck);
  }
  return g;
}

/** The mud for a level, as extras pinned to the body (they follow every squish). */
export function mudPins(level: number): PartPin[] {
  const out: PartPin[] = [];
  MUD.forEach((m, i) => {
    if (m.from > level) return;
    out.push({ obj: splat(m.r, i), dir: new THREE.Vector3(...m.dir).normalize(), lift: 0.01, ref: "up" });
  });
  return out;
}

/** A tiny cartoon fly with big eyes and buzzing wings. Faces +Z. Each wing's hinge flaps about Z by its side. */
export function makeFly(): { obj: THREE.Group; wings: { hinge: THREE.Group; side: number }[] } {
  const obj = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: "#2a2a36", roughness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), dark);
  body.scale.set(0.9, 0.85, 1.15);
  obj.add(body);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), white);
    eye.position.set(s * 0.028, 0.025, 0.055);
    obj.add(eye);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), dark);
    dot.position.set(s * 0.028, 0.027, 0.08);
    obj.add(dot);
  }
  const wingMat = new THREE.MeshStandardMaterial({ color: "#e8f6ff", transparent: true, opacity: 0.7, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const wings: { hinge: THREE.Group; side: number }[] = [];
  for (const side of [-1, 1]) {
    const geo = new THREE.CircleGeometry(0.06, 14);
    geo.scale(1, 0.55, 1);
    geo.translate(side * 0.06, 0, 0);
    geo.rotateX(-Math.PI / 2);
    const hinge = new THREE.Group();
    hinge.position.set(side * 0.02, 0.05, -0.01);
    hinge.add(new THREE.Mesh(geo, wingMat));
    obj.add(hinge);
    wings.push({ hinge, side });
  }
  // Big enough for a kid to spot, small enough to stay cute.
  obj.scale.setScalar(1.6);
  return { obj, wings };
}

/** Where the fly is at time `t`, flying a lazy loop above the head (`top` is the head's height). */
export function flyAt(t: number, top: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = t * 1.7;
  return out.set(Math.sin(a) * 0.8, top + 0.45 + Math.sin(t * 3.1) * 0.08, Math.sin(a) * Math.cos(a) * 0.9 + 0.1);
}
