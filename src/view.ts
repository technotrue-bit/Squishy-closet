// Framing: keep the basket and a squashed bun in view across the phone, with
// room above to toss, and work out where the screen edges are for tosses.

import * as THREE from "three";
import type { Bounds } from "./squishy";

export const FLY_PLANE_Z = 2.4;

/** Screen height at the bottom kept for the shelf and buttons. */
export const bottomReserve = (h: number) => Math.round(Math.min(190, h * 0.24));

/** What's kept at the bottom when the shelf is slid down: just the little pull tab. */
export const TAB_RESERVE = 40;

/**
 * The bottom reserve as the shelf slides: `down` 0 is the shelf showing, 1 is
 * slid away, and in between follows the slide so the world grows smoothly.
 */
export const trayReserve = (h: number, down: number): number => {
  const k = Math.max(0, Math.min(1, down));
  const full = bottomReserve(h);
  return Math.round(full + (Math.min(full, TAB_RESERVE) - full) * k);
};

/**
 * Frames the basket and the place behind it in the screen above the bottom
 * reserve; the reserve still shows the ground, so the shelf and buttons sit on
 * it, not on the bun. `zoom` 1 is the normal view, bigger is closer.
 * `trayDown` is how far the shelf has slid away (0 to 1): the world gets that room.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, w: number, fullH: number, zoom = 1, trayDown = 0): void {
  const h = fullH - trayReserve(fullH, trayDown);
  camera.aspect = w / h;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // How much of the world to fit across and up, around the basket.
  const across = 3.1 / zoom;
  const up = 4.25 / zoom;
  const dist = Math.max(across / (t * camera.aspect), up / t);
  const tilt = THREE.MathUtils.degToRad(19);
  // Aim a little behind and above the basket so friends in the back show too.
  const target = new THREE.Vector3(0, 0.9 + (camera.aspect < 0.7 ? 1.85 / zoom : 0.3), -1.2);
  camera.position.set(0, target.y + Math.sin(tilt) * dist, target.z + Math.cos(tilt) * dist);
  camera.lookAt(target);
  camera.userData.base = { pos: camera.position.clone(), target };
  camera.setViewOffset(w, h, 0, 0, w, fullH);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** Rocks the view a little (on the boat): a roll and a bob up and down. */
export function swayCamera(camera: THREE.PerspectiveCamera, roll: number, bob: number): void {
  const base = camera.userData.base as { pos: THREE.Vector3; target: THREE.Vector3 } | undefined;
  if (!base) return;
  camera.position.copy(base.pos);
  camera.position.y += bob;
  camera.lookAt(base.target);
  camera.rotateZ(roll);
  camera.updateMatrixWorld();
}

/** Fills `out` with the toss walls; returns world units per screen pixel. */
export function flyBounds(camera: THREE.PerspectiveCamera, h: number, out: Bounds): number {
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FLY_PLANE_Z);
  const ray = new THREE.Raycaster();
  const at = (x: number, y: number) => {
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit : new THREE.Vector3();
  };
  const left = at(-1, -0.2);
  const right = at(1, -0.2);
  const top = at(0, 0.82);
  const bottom = at(0, -1);
  out.minX = left.x;
  out.maxX = right.x;
  out.maxY = top.y;
  out.floorY = 0;
  return (top.y - bottom.y) / (h * 0.91);
}

/** What part of the ground the camera shows, for keeping friends where you can see them. */
export interface GroundView {
  /** The screen is wide (a phone on its side): there's lots of ground either side to roam. */
  wide: boolean;
  /** How far in from the side of the screen a spot on the ground is: 1 in the middle, 0 at the edge, below 0 off screen. */
  inset(p: { x: number; z: number }): number;
  /** Just past the screen's left (-1) or right (1) edge, at depth `z`. */
  edgeX(z: number, side: number): number;
}

/** Reads the view from the camera as it is now; make a new one after the camera moves. */
export function groundView(camera: THREE.PerspectiveCamera): GroundView {
  const v = new THREE.Vector3();
  // About the middle of a friend's body.
  const inset = (p: { x: number; z: number }) => {
    v.set(p.x, 0.45, p.z).project(camera);
    // Behind the camera, or up past the top of the screen.
    if (v.z > 1 || v.y > 0.95) return -1;
    return 1 - Math.abs(v.x);
  };
  const edgeX = (z: number, side: number) => {
    // Out from the middle until it's just off screen.
    let lo = 0;
    let hi = 60;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inset({ x: side * mid, z }) > -0.06) lo = mid;
      else hi = mid;
    }
    return side * hi;
  };
  return { wide: inset({ x: 6, z: -4 }) > 0.1, inset, edgeX };
}
