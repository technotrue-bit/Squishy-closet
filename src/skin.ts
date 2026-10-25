// The color all over a squishy's body, drawn on a canvas that wraps it: u goes
// around (0 = the front), v goes from the bottom up. Most are one color; a few
// Spooky ones get candy corn bands, mummy wraps or a dripping pudding top.

import type { Skin } from "./catalog";

export const SKIN_W = 512;
export const SKIN_H = 256;

type Ctx = Pick<CanvasRenderingContext2D, "fillRect" | "beginPath" | "moveTo" | "lineTo" | "closePath" | "fill" | "stroke" | "quadraticCurveTo" | "ellipse"> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  globalAlpha: number;
};

/** Canvas y for a body height v (0 bottom .. 1 top). */
const Y = (v: number) => (1 - v) * SKIN_H;

export function drawSkin(c: Ctx, color: string, skin: Skin): void {
  c.globalAlpha = 1;
  c.fillStyle = color;
  c.fillRect(0, 0, SKIN_W, SKIN_H);
  switch (skin.kind) {
    case "plain":
      return;
    case "bands": {
      // Wavy edges so the stripes look hand-made, like candy.
      const edges = [0.5, 0.8];
      for (let b = 0; b < 2; b++) {
        c.fillStyle = skin.colors[b + 1];
        c.beginPath();
        c.moveTo(0, 0);
        for (let x = 0; x <= SKIN_W; x += 8) c.lineTo(x, Y(edges[b] + 0.015 * Math.sin((x / SKIN_W) * Math.PI * 12)));
        c.lineTo(SKIN_W, 0);
        c.closePath();
        c.fill();
      }
      return;
    }
    case "wraps": {
      c.lineCap = "round";
      // Leave a gap across the front at eye height so the face peeks out.
      const gapLo = 0.3;
      const gapHi = 0.66;
      for (let k = 0; k < 13; k++) {
        const v0 = 0.04 + k * 0.075;
        const tilt = (k % 2 ? 1 : -1) * 0.05;
        c.strokeStyle = skin.color;
        c.lineWidth = 11;
        c.globalAlpha = 0.95;
        c.beginPath();
        let drawing = false;
        for (let x = 0; x <= SKIN_W; x += 6) {
          const u = x / SKIN_W;
          const v = v0 + tilt * Math.sin(u * Math.PI * 2);
          const front = u < 0.17 || u > 0.83;
          const hide = front && v > gapLo && v < gapHi;
          if (hide) {
            drawing = false;
            continue;
          }
          if (!drawing) c.moveTo(x, Y(v));
          else c.lineTo(x, Y(v));
          drawing = true;
        }
        c.stroke();
        // A soft shadow line under each wrap.
        c.strokeStyle = "rgba(120, 90, 60, 0.32)";
        c.lineWidth = 3;
        c.globalAlpha = 1;
        c.beginPath();
        drawing = false;
        for (let x = 0; x <= SKIN_W; x += 6) {
          const u = x / SKIN_W;
          const v = v0 + tilt * Math.sin(u * Math.PI * 2) - 0.022;
          const front = u < 0.17 || u > 0.83;
          if (front && v > gapLo - 0.03 && v < gapHi) {
            drawing = false;
            continue;
          }
          if (!drawing) c.moveTo(x, Y(v));
          else c.lineTo(x, Y(v));
          drawing = true;
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      return;
    }
    case "top": {
      // The cauldron rim, then the pudding on top dripping down over it.
      c.fillStyle = skin.rim;
      c.fillRect(0, Y(0.69), SKIN_W, SKIN_H * 0.06);
      c.fillStyle = skin.color;
      c.beginPath();
      c.moveTo(0, 0);
      for (let x = 0; x <= SKIN_W; x += 4) {
        const u = x / SKIN_W;
        // Drips everywhere but the face.
        const front = u < 0.16 || u > 0.84;
        const drip = front ? 0 : Math.pow(Math.max(0, Math.sin(u * Math.PI * 14)), 6) * 0.12;
        c.lineTo(x, Y(0.7 - drip + 0.01 * Math.sin(u * Math.PI * 30)));
      }
      c.lineTo(SKIN_W, 0);
      c.closePath();
      c.fill();
      // Bubbles
      c.fillStyle = "rgba(255,255,255,0.35)";
      for (const [u, v, r] of [[0.3, 0.86, 9], [0.45, 0.8, 6], [0.62, 0.9, 7], [0.75, 0.82, 5], [0.08, 0.92, 6]] as const) {
        c.beginPath();
        c.ellipse(u * SKIN_W, Y(v), r, r * 0.8, 0, 0, Math.PI * 2);
        c.fill();
      }
      return;
    }
    case "bones": {
      // Cartoon bones scattered around, none on the face.
      const spots: [number, number, number][] = [
        [0.06, 0.87, 0.3], [0.94, 0.87, -0.3], [0.2, 0.78, 1.1], [0.8, 0.78, -1.1], [0.24, 0.48, 0.4],
        [0.76, 0.48, -0.4], [0.36, 0.62, -0.6], [0.64, 0.62, 0.6], [0.5, 0.82, 0.1], [0.5, 0.45, -0.2],
      ];
      c.fillStyle = skin.color;
      for (const [u, v, rot] of spots) bone(c, u * SKIN_W, Y(v), rot);
      return;
    }
  }
}

function bone(c: Ctx, x: number, y: number, rot: number): void {
  const half = 30;
  const dx = Math.cos(rot) * half;
  const dy = Math.sin(rot) * half * 0.5;
  // The shaft as a fat stroke, then two round knobs at each end.
  c.strokeStyle = c.fillStyle as string;
  c.lineWidth = 13;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x - dx, y - dy);
  c.lineTo(x + dx, y + dy);
  c.stroke();
  const nx = -Math.sin(rot) * 8;
  const ny = Math.cos(rot) * 4;
  for (const e of [-1, 1]) {
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(x + e * dx + s * nx, y + e * dy + s * ny, 10, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
}
