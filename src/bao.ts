// The bao body: a soft round bun with a flat bottom, a domed top and swirled
// pleats that pinch into a little knot. Built as a grid so the squishy can be
// deformed vertex by vertex every frame (squash, dents, jiggle waves, lean).
// Pure math, no three.js, so tests and the preview renderer can use it too.

export const SEG = 96; // columns around
export const RINGS = 64; // rows bottom to top

/** Bottom of the bun in body space. Squash is anchored here so it sits on the basket. */
export const BOTTOM_Y = -0.45;
/** Center the dents and waves are measured from. */
export const CENTER_Y = 0.08;

export interface BaoShape {
  pleats: number; // folds on top
  pleatDepth: number; // 0..0.12
  twist: number; // radians of swirl at the knot
  dome: number; // top height
  knot: number; // height of the little nub
}

export const DEFAULT_SHAPE: BaoShape = { pleats: 11, pleatDepth: 0.1, twist: 0.75, dome: 0.84, knot: 0.05 };

export interface Grid {
  /** Rest positions, xyz per vertex. */
  base: Float32Array;
  /** Unit direction from the body center to each rest vertex. */
  dir: Float32Array;
  /** u (around, 0..1) and v (bottom to top, 0..1) per vertex. */
  uv: Float32Array;
  index: Uint32Array;
  count: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Vertex id for column i (0..SEG, the seam is duplicated for clean uvs) and ring j (0..RINGS). */
export const vid = (i: number, j: number) => j * (SEG + 1) + i;

export function buildGrid(shape: BaoShape = DEFAULT_SHAPE): Grid {
  const count = (SEG + 1) * (RINGS + 1);
  const base = new Float32Array(count * 3);
  const dir = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  for (let j = 0; j <= RINGS; j++) {
    const v = j / RINGS;
    const a = v * Math.PI; // 0 bottom pole, pi top pole
    const s = Math.sin(a);
    const c = Math.cos(a);
    let r: number;
    let y: number;
    if (a < Math.PI / 2) {
      // Lower half: a squarish, flat bottom.
      r = Math.pow(s, 0.42);
      y = -0.45 * Math.pow(Math.abs(c), 0.5);
    } else {
      // Upper half: a full, slightly pointed dome.
      r = Math.pow(s, 0.85);
      y = shape.dome * Math.pow(Math.abs(c), 0.95);
    }
    const tTop = smooth(0.56, 1.0, v);
    y += shape.knot * smooth(0.9, 1.0, v);
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const th = u * Math.PI * 2;
      // Pleats: folds that deepen toward the top and swirl around the knot.
      // Narrow creases between broad, puffy ridges.
      const crease = Math.pow(1 - Math.abs(Math.sin((shape.pleats * (th + shape.twist * tTop)) / 2)), 5);
      const rr = r * (1 - shape.pleatDepth * tTop * crease * (1 - smooth(0.94, 1, v) * 0.8));
      const yy = y - 0.05 * tTop * crease * (1 - smooth(0.9, 1, v));
      const x = rr * Math.sin(th);
      const z = rr * Math.cos(th); // u = 0 faces the camera (+z)
      const k = vid(i, j);
      base[k * 3] = x;
      base[k * 3 + 1] = yy;
      base[k * 3 + 2] = z;
      const dx = x;
      const dy = yy - CENTER_Y;
      const dz = z;
      const len = Math.hypot(dx, dy, dz) || 1;
      dir[k * 3] = dx / len;
      dir[k * 3 + 1] = dy / len;
      dir[k * 3 + 2] = dz / len;
      uv[k * 2] = u;
      uv[k * 2 + 1] = v;
    }
  }
  const index = new Uint32Array(SEG * RINGS * 6);
  let n = 0;
  for (let j = 0; j < RINGS; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = vid(i, j);
      const b = vid(i + 1, j);
      const c = vid(i, j + 1);
      const d = vid(i + 1, j + 1);
      // Counter clockwise seen from outside.
      index[n++] = a;
      index[n++] = b;
      index[n++] = c;
      index[n++] = b;
      index[n++] = d;
      index[n++] = c;
    }
  }
  return { base, dir, uv, index, count };
}

export interface Dent {
  x: number; // unit direction in body space
  y: number;
  z: number;
  depth: number; // how far the surface is pushed in
  radius: number; // angular radius, radians
}

export interface Wave {
  x: number;
  y: number;
  z: number;
  age: number; // seconds
  amp: number;
}

export interface Deform {
  /** Vertical squash 0 (none) .. 0.6 (very flat). Width grows to keep the volume. */
  squash: number;
  /** Extra width with no height change (a hug melt). */
  melt: number;
  /** Lean: the top shifts by this much in x and z, the bottom stays put. */
  leanX: number;
  leanZ: number;
  dents: Dent[];
  waves: Wave[];
  /** Basket wall: inside radius and the height of its top edge (local y). 0 = no wall. */
  wallR: number;
  wallTop: number;
}

export const restDeform = (): Deform => ({ squash: 0, melt: 0, leanX: 0, leanZ: 0, dents: [], waves: [], wallR: 0, wallTop: 0 });

/**
 * Writes the deformed positions into `out`. Squash keeps the volume: height
 * scales by (1 - squash) and width by 1 / sqrt(1 - squash).
 */
export function deform(g: Grid, d: Deform, out: Float32Array): void {
  const sy = 1 - Math.min(0.75, Math.max(-0.4, d.squash));
  const sxz = (1 / Math.sqrt(sy)) * (1 + d.melt);
  const height = DEFAULT_SHAPE.dome + DEFAULT_SHAPE.knot - BOTTOM_Y;
  for (let k = 0; k < g.count; k++) {
    let x = g.base[k * 3];
    let y = g.base[k * 3 + 1];
    let z = g.base[k * 3 + 2];
    const nx = g.dir[k * 3];
    const ny = g.dir[k * 3 + 1];
    const nz = g.dir[k * 3 + 2];
    let push = 0;
    for (const dn of d.dents) {
      if (dn.depth === 0) continue;
      const dot = Math.max(-1, Math.min(1, nx * dn.x + ny * dn.y + nz * dn.z));
      const ang = Math.acos(dot);
      const q = ang / dn.radius;
      // Pushed in under the finger, puffed up in a ring around it.
      push -= dn.depth * Math.exp(-q * q);
      const ring = (ang - dn.radius * 1.7) / (dn.radius * 0.7);
      push += dn.depth * 0.3 * Math.exp(-ring * ring);
    }
    for (const w of d.waves) {
      const dot = Math.max(-1, Math.min(1, nx * w.x + ny * w.y + nz * w.z));
      const ang = Math.acos(dot);
      push += w.amp * Math.exp(-3.2 * w.age) * Math.sin(9 * ang - 22 * w.age) * Math.exp(-ang * 0.9) * Math.min(1, w.age * 30);
    }
    // Pushes act along the direction from the center, and less at the flat bottom.
    const footing = smooth(BOTTOM_Y - 0.01, BOTTOM_Y + 0.18, y);
    push *= 0.35 + 0.65 * footing;
    x += nx * push;
    y += ny * push;
    z += nz * push;
    // Squash anchored at the bottom.
    const h = (y - BOTTOM_Y) / height; // 0 bottom .. 1 top
    y = BOTTOM_Y + (y - BOTTOM_Y) * sy;
    x *= sxz;
    z *= sxz;
    x += d.leanX * h * h;
    z += d.leanZ * h * h;
    // Inside the basket the sides can't pass the wall, so the bun bulges up over the rim.
    if (d.wallR > 0) {
      const r = Math.hypot(x, z);
      if (r > d.wallR) {
        const low = 1 - smooth(d.wallTop - 0.1, d.wallTop + 0.05, y);
        const over = (r - d.wallR) * low;
        const f = (r - over) / r;
        x *= f;
        z *= f;
        y += over * 0.25;
      }
    }
    out[k * 3] = x;
    out[k * 3 + 1] = y;
    out[k * 3 + 2] = z;
  }
}

/** Signed volume of the closed mesh, for tests. */
export function volume(pos: Float32Array, index: Uint32Array): number {
  let v = 0;
  for (let n = 0; n < index.length; n += 3) {
    const a = index[n] * 3;
    const b = index[n + 1] * 3;
    const c = index[n + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

// The face is drawn on a patch of the body's own grid, so it bends with every squish.
/** Face patch: columns either side of the front, and the rows it covers. */
export const FACE_COLS = 22;
export const FACE_ROW0 = 17;
export const FACE_ROW1 = 42;

export interface FacePatch {
  /** Body vertex for each patch vertex. */
  src: Uint32Array;
  uv: Float32Array;
  index: Uint32Array;
  count: number;
}

export function buildFacePatch(): FacePatch {
  const cols = FACE_COLS * 2 + 1;
  const rows = FACE_ROW1 - FACE_ROW0 + 1;
  const count = cols * rows;
  const src = new Uint32Array(count);
  const uv = new Float32Array(count * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const di = c - FACE_COLS; // negative = left of the front as you look at it
      const i = (di + SEG) % SEG;
      const j = FACE_ROW0 + r;
      const k = r * cols + c;
      src[k] = vid(i, j);
      // Looking at the bun, +theta goes to the viewer's right (x = sin theta).
      uv[k * 2] = c / (cols - 1);
      uv[k * 2 + 1] = r / (rows - 1);
    }
  }
  const index = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let n = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const cc = a + cols;
      const d = cc + 1;
      index[n++] = a;
      index[n++] = b;
      index[n++] = cc;
      index[n++] = b;
      index[n++] = d;
      index[n++] = cc;
    }
  }
  return { src, uv, index, count };
}
