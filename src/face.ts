// Kawaii faces drawn onto a canvas that wraps the front of the bun: tiny dot
// eyes with a shine, a little cat mouth and blush cheeks, plus one look per
// feeling. Works with any 2D canvas context, so the preview renderer can draw
// the same faces offscreen.

export type Expression =
  | "open"
  | "happy"
  | "squeeze"
  | "closed"
  | "surprised"
  | "dizzy"
  | "love"
  | "sleepy"
  | "giggle"
  /** Grumbly: little cross brows and a tiny frown. */
  | "pout"
  /** Bashful: half-shut eyes looking down and extra pink cheeks. */
  | "shy";

export const FACE_W = 1024;
export const FACE_H = 512;
// World size the canvas covers on the bun (arc length across, height up).
const SPAN_X = 1.44;
const SPAN_Y = 0.86;
/** Canvas row of the eye line (the bun's equator sits a little above center). */
const EYE_Y = 0.3 * FACE_H;

export interface FaceLook {
  expr: Expression;
  /** Where the eyes glance, -1..1 each. */
  lookX: number;
  lookY: number;
  /** 0 open .. 1 shut, for blinks. */
  blink: number;
  /** Mouth open 0..1 (squeaks and giggles). */
  talk: number;
  /** Ink and blush colors (dark buns get light ink). */
  ink: string;
  blush: string;
  /** A little extra that makes some squishies their own. */
  extra?: "fangs" | "stitch" | "boo" | "nose" | "whiskers";
}

type Ctx = Pick<
  CanvasRenderingContext2D,
  | "clearRect"
  | "beginPath"
  | "ellipse"
  | "arc"
  | "moveTo"
  | "lineTo"
  | "quadraticCurveTo"
  | "bezierCurveTo"
  | "closePath"
  | "fill"
  | "stroke"
  | "save"
  | "restore"
  | "translate"
  | "rotate"
> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
};

const px = (wx: number) => FACE_W / 2 + (wx * FACE_W) / SPAN_X;
const py = (wy: number) => EYE_Y - (wy * FACE_H) / SPAN_Y;
const sx = (w: number) => (w * FACE_W) / SPAN_X;
const sy = (w: number) => (w * FACE_H) / SPAN_Y;

const EYE_X = 0.22; // eyes sit wide apart, like the toys
const EYE_R = 0.052;
const MOUTH_Y = -0.06;

export function drawFace(ctx: Ctx, f: FaceLook): void {
  ctx.clearRect(0, 0, FACE_W, FACE_H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Blush first so the eyes sit on top.
  const shy = f.expr === "shy";
  ctx.globalAlpha = shy ? 1 : f.expr === "love" || f.expr === "giggle" || f.expr === "happy" ? 0.85 : 0.62;
  ctx.fillStyle = f.blush;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(px(s * (EYE_X + 0.035)), py(-0.075), sx(shy ? 0.075 : 0.06), sy(shy ? 0.042 : 0.034), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = f.ink;
  ctx.strokeStyle = f.ink;
  const lx = f.lookX * 0.018;
  const ly = (shy ? -0.8 : f.lookY) * 0.014;
  for (const s of [-1, 1]) drawEye(ctx, f, s, px(s * EYE_X + lx), py(ly));
  const mx = px(lx * 0.4);
  const my = py(MOUTH_Y + ly * 0.3);
  if (f.extra === "boo" && f.expr === "open" && f.talk < 0.15) {
    // A round little "ooo".
    ctx.beginPath();
    ctx.ellipse(mx, my + sy(0.01), sx(0.024), sy(0.03), 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7a2d3a";
    ctx.fill();
    ctx.fillStyle = f.ink;
  } else drawMouth(ctx, f, mx, my);
  if (f.extra) drawExtra(ctx, f, mx, my);
}

function drawExtra(ctx: Ctx, f: FaceLook, mx: number, my: number): void {
  ctx.fillStyle = f.ink;
  ctx.strokeStyle = f.ink;
  switch (f.extra) {
    case "fangs": {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = sy(0.004);
      for (const s of [-1, 1]) {
        const x = mx + s * sx(0.03);
        const y = my + sy(0.012);
        ctx.beginPath();
        ctx.moveTo(x - sx(0.012), y);
        ctx.lineTo(x + sx(0.012), y);
        ctx.lineTo(x, y + sy(0.032));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case "stitch": {
      ctx.lineWidth = sy(0.01);
      const x0 = px(-0.34);
      const y0 = py(0.13);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + sx(0.16), y0 - sy(0.05));
      ctx.stroke();
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const x = x0 + sx(0.16) * t;
        const y = y0 - sy(0.05) * t;
        ctx.beginPath();
        ctx.moveTo(x - sx(0.012), y - sy(0.03));
        ctx.lineTo(x + sx(0.012), y + sy(0.03));
        ctx.stroke();
      }
      break;
    }
    case "nose": {
      ctx.beginPath();
      const y = py(-0.015);
      ctx.moveTo(mx - sx(0.018), y - sy(0.012));
      ctx.lineTo(mx + sx(0.018), y - sy(0.012));
      ctx.lineTo(mx, y + sy(0.014));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "whiskers": {
      ctx.lineWidth = sy(0.008);
      for (const s of [-1, 1]) {
        for (const k of [-1, 0, 1]) {
          const x = px(s * (EYE_X + 0.07));
          const y = py(-0.05 + k * 0.025);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + s * sx(0.09), y + k * sy(0.02));
          ctx.stroke();
        }
      }
      break;
    }
  }
}

function drawEye(ctx: Ctx, f: FaceLook, side: number, x: number, y: number): void {
  const w = sx(EYE_R);
  const h = sy(EYE_R * 1.12);
  ctx.lineWidth = sy(0.022);
  const blink = f.expr === "open" || f.expr === "surprised" || f.expr === "pout" ? f.blink : f.expr === "shy" ? Math.max(0.42, f.blink) : 0;
  switch (f.expr) {
    case "happy":
    case "giggle": {
      // ^ ^ arcs
      ctx.beginPath();
      ctx.moveTo(x - w * 1.1, y + h * 0.35);
      ctx.quadraticCurveTo(x, y - h * 1.25, x + w * 1.1, y + h * 0.35);
      ctx.stroke();
      return;
    }
    case "squeeze": {
      // > <
      const d = side < 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x - d * w * 1.0, y - h * 0.9);
      ctx.lineTo(x + d * w * 0.9, y);
      ctx.lineTo(x - d * w * 1.0, y + h * 0.9);
      ctx.stroke();
      return;
    }
    case "closed":
    case "sleepy": {
      // little smiling lids
      ctx.beginPath();
      ctx.moveTo(x - w * 1.05, y - h * 0.1);
      ctx.quadraticCurveTo(x, y + h * 0.9, x + w * 1.05, y - h * 0.1);
      ctx.stroke();
      return;
    }
    case "dizzy": {
      ctx.lineWidth = sy(0.016);
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 4.2; t += 0.2) {
        const r = (t / (Math.PI * 4.2)) * 1.15;
        const ex = x + Math.cos(t * side) * w * r;
        const ey = y + Math.sin(t * side) * h * r;
        if (t === 0) ctx.moveTo(ex, ey);
        else ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      return;
    }
    case "love": {
      heart(ctx, x, y + h * 0.1, w * 1.35, "#ff4f7d");
      return;
    }
    default: {
      const big = f.expr === "surprised" ? 1.3 : 1;
      const open = 1 - blink;
      if (open < 0.18) {
        ctx.beginPath();
        ctx.moveTo(x - w * big, y + h * 0.2);
        ctx.quadraticCurveTo(x, y + h * 0.75, x + w * big, y + h * 0.2);
        ctx.stroke();
        return;
      }
      ctx.beginPath();
      ctx.ellipse(x, y, w * big, h * big * open, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shine: one big dot, one tiny dot.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x - w * 0.32 * big, y - h * 0.34 * big * open, w * 0.34 * big, h * 0.32 * big * open, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.38 * big, y + h * 0.36 * big * open, w * 0.14 * big, h * 0.13 * big * open, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = f.ink;
      if (f.expr === "pout") {
        // Cross little brows, tipped down toward the middle.
        ctx.lineWidth = sy(0.016);
        ctx.beginPath();
        ctx.moveTo(x - side * w * 1.2, y - h * 1.75);
        ctx.lineTo(x + side * w * 0.9, y - h * 1.3);
        ctx.stroke();
      }
    }
  }
}

function drawMouth(ctx: Ctx, f: FaceLook, x: number, y: number): void {
  const w = sx(0.05);
  const h = sy(0.035);
  ctx.lineWidth = sy(0.016);
  const open = Math.max(f.talk, f.expr === "surprised" ? 0.8 : 0, f.expr === "giggle" ? 0.9 : 0, f.expr === "happy" ? 0.55 : 0);
  if (f.expr === "squeeze" || f.expr === "dizzy") {
    // wobbly line
    ctx.beginPath();
    ctx.moveTo(x - w * 1.2, y);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x - w * 1.2 + (k * w * 2.4) / 6, y + (k % 2 ? -h * 0.35 : h * 0.35));
    ctx.stroke();
    return;
  }
  if (f.expr === "surprised") {
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.2, w * 0.45, h * 0.6 * open + h * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#7a2d3a";
    ctx.fill();
    ctx.fillStyle = f.ink;
    return;
  }
  if (open > 0.15) {
    // open smile: a little D shape with a tongue
    ctx.beginPath();
    ctx.moveTo(x - w * 0.95, y - h * 0.15);
    ctx.quadraticCurveTo(x, y - h * 0.35, x + w * 0.95, y - h * 0.15);
    ctx.quadraticCurveTo(x + w * 0.7, y + h * (0.5 + open), x, y + h * (0.6 + open));
    ctx.quadraticCurveTo(x - w * 0.7, y + h * (0.5 + open), x - w * 0.95, y - h * 0.15);
    ctx.closePath();
    ctx.fillStyle = "#7a2d3a";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + h * (0.35 + open * 0.75), w * 0.45, h * 0.3 * (0.4 + open), 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ff8fa3";
    ctx.fill();
    ctx.fillStyle = f.ink;
    return;
  }
  if (f.expr === "pout") {
    // A tiny frown.
    ctx.beginPath();
    ctx.moveTo(x - w * 0.7, y + h * 0.35);
    ctx.quadraticCurveTo(x, y - h * 0.45, x + w * 0.7, y + h * 0.35);
    ctx.stroke();
    return;
  }
  // The cat mouth: a tiny w.
  ctx.beginPath();
  ctx.moveTo(x - w, y - h * 0.15);
  ctx.quadraticCurveTo(x - w * 0.5, y + h * 0.95, x, y - h * 0.05);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.95, x + w, y - h * 0.15);
  ctx.stroke();
}

function heart(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  const k = s / 1.0;
  const kx = k;
  const ky = (k * FACE_H * SPAN_X) / (FACE_W * SPAN_Y);
  ctx.beginPath();
  ctx.moveTo(x, y + ky * 0.75);
  ctx.bezierCurveTo(x - kx * 1.2, y - ky * 0.05, x - kx * 0.75, y - ky * 0.95, x, y - ky * 0.35);
  ctx.bezierCurveTo(x + kx * 0.75, y - ky * 0.95, x + kx * 1.2, y - ky * 0.05, x, y + ky * 0.75);
  ctx.closePath();
  const keep = ctx.fillStyle;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x - kx * 0.42, y - ky * 0.42, kx * 0.18, ky * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = keep;
}
