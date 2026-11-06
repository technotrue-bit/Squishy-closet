// Getting about without bumping into things. Every place lists the ground footprint of its solid things
// (the cake, the sandcastle, the couch, trees, the bus stop) as circles; a longer thing is a row of circles.
// Squishies hop around them, never through: a straight hop when the way is clear, otherwise the shortest way
// round, by corners just outside each thing. Pure math on the ground plane (x and z), so tests can use it.

export interface Solid {
  x: number;
  z: number;
  r: number;
}

export interface Pt {
  x: number;
  z: number;
}

/** A row of circles covering a box `w` wide (along x) and `d` deep (along z), turned `yaw` about its middle. */
export function boxSolids(x: number, z: number, w: number, d: number, yaw = 0): Solid[] {
  const long = Math.max(w, d);
  const short = Math.min(w, d);
  const r = short / 2;
  const n = Math.max(1, Math.ceil(long / short));
  const step = n > 1 ? (long - short) / (n - 1) : 0;
  // Along the long side, before turning.
  const ax = w >= d ? 1 : 0;
  const az = w >= d ? 0 : 1;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const out: Solid[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? -(long - short) / 2 + i * step : 0;
    const lx = ax * t;
    const lz = az * t;
    // Same turn as three.js rotation.y.
    out.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, r: Math.hypot(r, step / 2) });
  }
  return out;
}

/** Moves a point out of every solid, `pad` clear of its edge. */
export function pushOut<T extends Pt>(p: T, solids: readonly Solid[], pad: number): T {
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const s of solids) {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const need = s.r + pad;
      const d = Math.hypot(dx, dz);
      if (d >= need - 1e-6) continue;
      // Straight out from its middle (toward the camera when dead centre).
      const ux = d > 1e-6 ? dx / d : 0;
      const uz = d > 1e-6 ? dz / d : 1;
      p.x = s.x + ux * (need + 0.01);
      p.z = s.z + uz * (need + 0.01);
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}

/** How close the segment a→b comes to the point c. */
function segDist(a: Pt, b: Pt, c: Pt): number {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const len2 = vx * vx + vz * vz;
  let t = len2 > 0 ? ((c.x - a.x) * vx + (c.z - a.z) * vz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + vx * t - c.x, a.z + vz * t - c.z);
}

/** A solid with how close a way may come to its middle. */
interface Keep {
  s: Solid;
  need: number;
}

function clear(a: Pt, b: Pt, keeps: readonly Keep[]): boolean {
  for (const k of keeps) if (segDist(a, b, k.s) < k.need - 1e-4) return false;
  return true;
}

const inside = (p: Pt, k: Keep) => Math.hypot(p.x - k.s.x, p.z - k.s.z) < k.need - 1e-4;

/**
 * The way from `from` to `to` around the solids: the corners to hop to, ending at `to` (not including
 * `from`). A squishy already standing too close to a thing (or heading for a spot too close) may step
 * away from it, but never in any deeper, so it never hops through it on the way out.
 * Empty when there is no way round at all (it never goes through).
 */
export function route(from: Pt, to: Pt, solids: readonly Solid[], pad: number): Pt[] {
  const keeps: Keep[] = solids.map((s) => {
    const full = s.r + pad;
    const df = Math.hypot(from.x - s.x, from.z - s.z);
    const dt = Math.hypot(to.x - s.x, to.z - s.z);
    // Too close already: keep at least as far as it is now (a hair less, so it can set off).
    return { s, need: Math.min(full, df - 1e-3, dt - 1e-3) };
  });
  if (clear(from, to, keeps)) return [{ x: to.x, z: to.z }];
  // Corners: a ring of points just outside each solid, leaving out any inside another one.
  const nodes: Pt[] = [{ x: from.x, z: from.z }, { x: to.x, z: to.z }];
  for (const k of keeps) {
    const rr = (k.s.r + pad) * 1.09 + 0.04;
    const n = Math.max(8, Math.min(16, Math.ceil((Math.PI * 2 * rr) / 0.8)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = { x: k.s.x + Math.cos(a) * rr, z: k.s.z + Math.sin(a) * rr };
      if (!keeps.some((o) => inside(p, o))) nodes.push(p);
    }
  }
  // Shortest way through the corners (Dijkstra; there are only a few dozen of them).
  const n = nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = 1;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
      if (d < dist[v] && clear(nodes[u], nodes[v], keeps)) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[1] < 0) return [];
  const path: Pt[] = [];
  for (let v = 1; v > 0; v = prev[v]) path.push(nodes[v]);
  return path.reverse();
}

/** Total length of a way, starting at `from`. */
export function routeLength(from: Pt, way: readonly Pt[]): number {
  let len = 0;
  let a = from;
  for (const b of way) {
    len += Math.hypot(b.x - a.x, b.z - a.z);
    a = b;
  }
  return len;
}

/** Something round standing on the ground: `r` is how far its body reaches; a `still` one isn't moved. */
export interface Body extends Pt {
  r: number;
  still?: boolean;
}

/**
 * Eases apart any bodies sinking into each other, each moving at most `step`, so nobody stands
 * inside anybody. Returns the bodies it moved.
 */
export function spread<T extends Body>(bodies: readonly T[], step: number): Set<T> {
  const moved = new Set<T>();
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.still && b.still) continue;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      const over = a.r + b.r - d;
      if (over <= 1e-4) continue;
      // Right on top of each other: apart sideways.
      if (d < 1e-6) {
        dx = 1;
        dz = 0;
        d = 1;
      }
      const ux = dx / d;
      const uz = dz / d;
      const share = a.still || b.still ? over : over / 2;
      const k = Math.min(share, step);
      if (!a.still) {
        a.x -= ux * k;
        a.z -= uz * k;
        moved.add(a);
      }
      if (!b.still) {
        b.x += ux * k;
        b.z += uz * k;
        moved.add(b);
      }
    }
  }
  return moved;
}
