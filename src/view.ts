// Framing: keep the basket and a squashed bun in view across the phone, with
// room above to toss, and work out where the screen edges are for tosses.

import * as THREE from "three";
import type { Bounds } from "./squishy";

export const FLY_PLANE_Z = 2.4;

/** Screen height at the bottom kept for the shelf and buttons. */
export const bottomReserve = (h: number) => Math.round(Math.min(190, h * 0.24));

/**
 * Frames the basket in the screen above the bottom reserve; the reserve still
 * shows the tabletop, so the shelf and buttons sit on the table, not on the bun.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, w: number, fullH: number): void {
  const h = fullH - bottomReserve(fullH);
  camera.aspect = w / h;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(1.8 / (t * camera.aspect), 2.6 / t);
  const tilt = THREE.MathUtils.degToRad(20);
  const target = new THREE.Vector3(0, 0.95 + (camera.aspect < 0.7 ? 0.9 : 0), 0);
  camera.position.set(0, target.y + Math.sin(tilt) * dist, Math.cos(tilt) * dist);
  camera.lookAt(target);
  camera.setViewOffset(w, h, 0, 0, w, fullH);
  camera.updateProjectionMatrix();
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
