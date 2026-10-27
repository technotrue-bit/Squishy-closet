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

function clear(a: Pt, b: Pt, solids: readonly Solid[], pad: number, skip: ReadonlySet<Solid>): boolean {
  for (const s of solids) {
    if (skip.has(s)) continue;
    if (segDist(a, b, s) < s.r + pad - 1e-4) return false;
  }
  return true;
}

const inside = (p: Pt, s: Solid, pad: number) => Math.hypot(p.x - s.x, p.z - s.z) < s.r + pad - 1e-4;

/**
 * The way from `from` to `to` around the solids: the corners to hop to, ending at `to` (not including
 * `from`). A thing the squishy is already standing in is ignored, so it can always step out.
 */
export function route(from: Pt, to: Pt, solids: readonly Solid[], pad: number): Pt[] {
  const skip = new Set(solids.filter((s) => inside(from, s, pad) || inside(to, s, pad)));
  if (clear(from, to, solids, pad, skip)) return [{ x: to.x, z: to.z }];
  // Corners: a ring of points just outside each solid, leaving out any inside another one.
  const nodes: Pt[] = [{ x: from.x, z: from.z }, { x: to.x, z: to.z }];
  const live = solids.filter((s) => !skip.has(s));
  for (const s of live) {
    const rr = (s.r + pad) * 1.09 + 0.04;
    const n = Math.max(8, Math.min(16, Math.ceil((Math.PI * 2 * rr) / 0.8)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const p = { x: s.x + Math.cos(a) * rr, z: s.z + Math.sin(a) * rr };
      if (!live.some((o) => inside(p, o, pad))) nodes.push(p);
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
      if (d < dist[v] && clear(nodes[u], nodes[v], solids, pad, skip)) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[1] < 0) return [{ x: to.x, z: to.z }];
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
