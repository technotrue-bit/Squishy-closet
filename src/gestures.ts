// Turns raw touches into the things a kid does to a squishy: tap, press and
// hold, pet (a stroke), tickle (fast rubbing), flick (a toss) and a two finger
// hug. Pure logic with times passed in, so it is easy to test.

export type GestureEvent =
  | { type: "look"; x: number; y: number }
  | { type: "touch"; x: number; y: number }
  | { type: "tap"; x: number; y: number }
  | { type: "pressStart"; x: number; y: number }
  | { type: "pressHold"; held: number }
  | { type: "pressEnd"; held: number }
  | { type: "stroke"; x: number; y: number; dx: number; dy: number; speed: number }
  | { type: "tickle" }
  | { type: "flick"; vx: number; vy: number }
  | { type: "dragEnd" }
  | { type: "hugStart" }
  | { type: "hugEnd" };

export const HOLD_MS = 190;
export const MOVE_PX = 12;
export const FLICK_SPEED = 1000; // px per second at release
export const FLICK_DIST = 40;

interface Pointer {
  id: number;
  onBody: boolean;
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
  moved: number;
  pressing: boolean;
  dragging: boolean;
  trail: { x: number; y: number; t: number }[];
  lastDirX: number;
  flips: number[];
}

export class Gestures {
  private ptrs = new Map<number, Pointer>();
  private hugging = false;
  private lastTickle = -1e9;

  constructor(private emit: (e: GestureEvent) => void) {}

  down(id: number, x: number, y: number, t: number, onBody: boolean): void {
    this.ptrs.set(id, {
      id,
      onBody,
      x0: x,
      y0: y,
      t0: t,
      x,
      y,
      moved: 0,
      pressing: false,
      dragging: false,
      trail: [{ x, y, t }],
      lastDirX: 0,
      flips: [],
    });
    this.emit({ type: "look", x, y });
    if (onBody) this.emit({ type: "touch", x, y });
    const onBodyCount = [...this.ptrs.values()].filter((p) => p.onBody).length;
    if (onBodyCount >= 2 && !this.hugging) {
      this.hugging = true;
      // A hug replaces any press or stroke in progress.
      for (const p of this.ptrs.values()) {
        if (p.pressing) this.emit({ type: "pressEnd", held: (t - p.t0) / 1000 });
        p.pressing = false;
        p.dragging = false;
      }
      this.emit({ type: "hugStart" });
    }
  }

  move(id: number, x: number, y: number, t: number): void {
    const p = this.ptrs.get(id);
    this.emit({ type: "look", x, y });
    if (!p) return;
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    p.moved = Math.max(p.moved, Math.hypot(x - p.x0, y - p.y0));
    p.trail.push({ x, y, t });
    while (p.trail.length > 2 && t - p.trail[0].t > 120) p.trail.shift();
    if (!p.onBody || this.hugging || p.pressing) return;
    if (!p.dragging && p.moved > MOVE_PX) p.dragging = true;
    if (!p.dragging) return;
    const prev = p.trail[p.trail.length - 2];
    const dt = Math.max(1, t - (prev?.t ?? t - 16)) / 1000;
    const speed = Math.hypot(dx, dy) / dt;
    this.emit({ type: "stroke", x, y, dx, dy, speed });
    // Count quick left-right direction flips for tickles.
    if (Math.abs(dx) > 2) {
      const dir = Math.sign(dx);
      if (p.lastDirX !== 0 && dir !== p.lastDirX) p.flips.push(t);
      p.lastDirX = dir;
    }
    p.flips = p.flips.filter((ft) => t - ft < 700);
    if (p.flips.length >= 4 && t - this.lastTickle > 450) {
      this.lastTickle = t;
      this.emit({ type: "tickle" });
    }
  }

  up(id: number, x: number, y: number, t: number): void {
    const p = this.ptrs.get(id);
    if (!p) return;
    this.ptrs.delete(id);
    const held = (t - p.t0) / 1000;
    if (this.hugging) {
      if ([...this.ptrs.values()].filter((q) => q.onBody).length < 2) {
        this.hugging = false;
        this.emit({ type: "hugEnd" });
      }
      return;
    }
    if (!p.onBody) return;
    if (p.pressing) {
      this.emit({ type: "pressEnd", held });
      return;
    }
    if (!p.dragging && p.moved <= MOVE_PX && t - p.t0 < HOLD_MS) {
      this.emit({ type: "tap", x, y });
      return;
    }
    if (p.dragging) {
      // Release speed over the last few samples.
      const first = p.trail[0];
      const dt = Math.max(16, t - first.t) / 1000;
      const vx = (x - first.x) / dt;
      const vy = (y - first.y) / dt;
      if (Math.hypot(vx, vy) > FLICK_SPEED && p.moved > FLICK_DIST) this.emit({ type: "flick", vx, vy });
      else this.emit({ type: "dragEnd" });
    }
  }

  cancel(id: number, t: number): void {
    const p = this.ptrs.get(id);
    if (!p) return;
    this.ptrs.delete(id);
    if (p.pressing) this.emit({ type: "pressEnd", held: (t - p.t0) / 1000 });
    else if (p.dragging) this.emit({ type: "dragEnd" });
    if (this.hugging && [...this.ptrs.values()].filter((q) => q.onBody).length < 2) {
      this.hugging = false;
      this.emit({ type: "hugEnd" });
    }
  }

  /** Call every frame: starts presses and reports how long they've been held. */
  update(t: number): void {
    if (this.hugging) return;
    for (const p of this.ptrs.values()) {
      if (!p.onBody || p.dragging) continue;
      if (!p.pressing && p.moved <= MOVE_PX && t - p.t0 >= HOLD_MS) {
        p.pressing = true;
        this.emit({ type: "pressStart", x: p.x, y: p.y });
      }
      if (p.pressing) this.emit({ type: "pressHold", held: (t - p.t0) / 1000 });
    }
  }

  get touching(): boolean {
    return this.ptrs.size > 0;
  }
}
