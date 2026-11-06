// A phone test for AI-made models (Hi3D and the like). It only runs when the
// address has ?modeltest in it, so the normal game never loads it. It loads
// one slimmed model (public/models/mushroom-stool.glb, a stand-in for a Hi3D
// download cut from 1 million triangles to 4,000 with tools/slim-model.mjs),
// dresses it in the game's own glossy toy material, and stands 0, 1, 10 or 30
// copies round the squishy. A small meter shows the frame rate, the slowest
// frame, triangles, draw calls and sharpness, so the numbers can be read off
// a real phone.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export const MODEL_TEST_COUNTS = [0, 1, 10, 30] as const;
const MODEL_URL = `${import.meta.env.BASE_URL}models/mushroom-stool.glb`;
/** World height of one copy: a stool a little shorter than the bun. */
const COPY_HEIGHT = 0.45;

/** The number of copies asked for in the address, or null when the test is off. */
export function modelTestCount(search: string): number | null {
  const q = new URLSearchParams(search);
  if (!q.has("modeltest")) return null;
  const n = Number(q.get("modeltest") || 1);
  return (MODEL_TEST_COUNTS as readonly number[]).includes(n) ? n : 1;
}

/**
 * Where copy `i` stands on the floor. The first sits beside the bun where it
 * is easy to see; the rest fill rows behind the basket, six to a row.
 */
export function slotFor(i: number): { x: number; z: number } {
  if (i === 0) return { x: 1.05, z: 0.35 };
  const k = i - 1;
  const row = Math.floor(k / 6);
  const col = k % 6;
  return { x: -1.35 + col * 0.54 + (row % 2) * 0.27, z: -1.0 - row * 0.5 };
}

export type Verdict = "smooth" | "ok" | "slow";

/** Frame times over the last two seconds or so. */
export class FrameMeter {
  private ms: number[] = [];
  constructor(private readonly keep = 120) {}

  add(ms: number): void {
    if (ms <= 0 || ms > 250) return; // a pause, not a slow frame
    this.ms.push(ms);
    if (this.ms.length > this.keep) this.ms.shift();
  }

  /** Starts over, after the scene changes. */
  reset(): void {
    this.ms.length = 0;
  }

  get ready(): boolean {
    return this.ms.length >= 30;
  }

  get fps(): number {
    if (!this.ms.length) return 0;
    return 1000 / (this.ms.reduce((a, b) => a + b, 0) / this.ms.length);
  }

  get slowestMs(): number {
    return this.ms.length ? Math.max(...this.ms) : 0;
  }

  /** Smooth: holds 60 with no visible hitch. Ok: a little under. Slow: you'd feel it. */
  verdict(): Verdict {
    const fps = this.fps;
    if (fps >= 57 && this.slowestMs <= 34) return "smooth";
    if (fps >= 45) return "ok";
    return "slow";
  }
}

const VERDICT_TEXT: Record<Verdict, string> = {
  smooth: "Holds 60fps",
  ok: "Mostly smooth",
  slow: "Too slow",
};
const VERDICT_COLOR: Record<Verdict, string> = { smooth: "#1f9d55", ok: "#c47f00", slow: "#d23c3c" };

/** Swaps the model's realistic material for the glossy toy look the hats use. */
function toyLook(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const old = o.material as THREE.MeshStandardMaterial;
    if (!o.geometry.getAttribute("normal")) o.geometry.computeVertexNormals();
    o.material = new THREE.MeshPhysicalMaterial({
      map: old.map ?? null,
      color: old.map ? 0xffffff : old.color,
      roughness: 0.55,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    });
    old.dispose();
  });
}

export interface ModelTest {
  /** Call once a frame with the time since the last frame. */
  frame(ms: number): void;
  /** Call right after the closet scene is drawn. */
  drawn(info: THREE.WebGLInfo): void;
}

export function startModelTest(scene: THREE.Scene, first: number, sharpness: () => number, maxSharpness: number): ModelTest {
  const meter = new FrameMeter();
  const group = new THREE.Group();
  group.name = "modelTest";
  scene.add(group);
  let model: THREE.Object3D | null = null;
  let count = first;
  let loadNote = "Loading model…";
  let tris = 0;
  let calls = 0;

  const panel = document.createElement("div");
  panel.style.cssText = [
    "position:fixed",
    "left:8px",
    "top:calc(env(safe-area-inset-top, 0px) + 8px)",
    "z-index:50",
    "padding:8px 10px",
    "border-radius:12px",
    "background:rgba(255,255,255,0.92)",
    "color:#2a1a24",
    "font:13px/1.35 -apple-system, system-ui, sans-serif",
    "box-shadow:0 2px 10px rgba(0,0,0,0.15)",
    "pointer-events:auto",
    "touch-action:manipulation",
    "max-width:210px",
  ].join(";");
  const head = document.createElement("div");
  head.style.cssText = "font-weight:700;font-size:15px";
  const body = document.createElement("div");
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:6px;margin-top:6px";
  const buttons = MODEL_TEST_COUNTS.map((n) => {
    const b = document.createElement("button");
    b.textContent = String(n);
    b.style.cssText = "flex:1;padding:6px 0;border:0;border-radius:8px;font:600 14px system-ui;color:#2a1a24";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      setCount(n);
    });
    row.appendChild(b);
    return { n, b };
  });
  const note = document.createElement("div");
  note.style.cssText = "margin-top:4px;font-size:11px;color:#6b5560";
  note.textContent = "Copies of the model. Wait 3 seconds after each tap.";
  panel.append(head, body, row, note);
  document.body.appendChild(panel);

  function setCount(n: number): void {
    count = n;
    for (const { n: k, b } of buttons) b.style.background = k === n ? "#ffc6df" : "#f1e9ee";
    if (!model) return;
    group.clear();
    for (let i = 0; i < n; i++) {
      const c = model.clone(); // shares geometry and material, like real props would
      const s = slotFor(i);
      c.position.set(s.x, 0, s.z);
      c.rotation.y = i * 1.7;
      group.add(c);
    }
    meter.reset();
  }

  const started = performance.now();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader
    .loadAsync(MODEL_URL)
    .then((gltf) => {
      const root = gltf.scene;
      toyLook(root);
      // Stand it on the floor at a set height, whatever size it came in.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      root.scale.setScalar(COPY_HEIGHT / (size.y || 1));
      root.position.y = -box.min.y * root.scale.y;
      const holder = new THREE.Group();
      holder.add(root);
      model = holder;
      const entry = performance.getEntriesByName(new URL(MODEL_URL, location.href).href)[0] as PerformanceResourceTiming | undefined;
      const kb = entry?.encodedBodySize ? `${Math.round(entry.encodedBodySize / 1024)} KB, ` : "";
      loadNote = `Model: ${kb}loaded in ${Math.round(performance.now() - started)} ms`;
      setCount(count);
    })
    .catch(() => {
      loadNote = "The model didn't load.";
    });
  setCount(count);

  let paintIn = 0;
  function paint(): void {
    const v = meter.verdict();
    const dpr = sharpness();
    head.textContent = meter.ready ? VERDICT_TEXT[v] : "Measuring…";
    head.style.color = meter.ready ? VERDICT_COLOR[v] : "#2a1a24";
    body.innerHTML = "";
    const lines = [
      `${meter.fps.toFixed(0)} fps, slowest frame ${meter.slowestMs.toFixed(0)} ms`,
      `${count} ${count === 1 ? "copy" : "copies"}, ${Math.round(tris / 1000)}k triangles, ${calls} draws`,
      `Sharpness ${dpr.toFixed(2)}x of ${maxSharpness.toFixed(2)}x${dpr < maxSharpness ? " (lowered to keep up)" : ""}`,
      loadNote,
    ];
    for (const l of lines) {
      const d = document.createElement("div");
      d.textContent = l;
      body.appendChild(d);
    }
  }

  return {
    frame(ms: number): void {
      meter.add(ms);
      paintIn -= ms;
      if (paintIn <= 0) {
        paintIn = 500;
        paint();
      }
    },
    drawn(info: THREE.WebGLInfo): void {
      tris = info.render.triangles;
      calls = info.render.calls;
    },
  };
}
