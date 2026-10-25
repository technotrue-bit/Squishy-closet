// Little pictures of each squishy (wearing its hat) and each hat, for the
// shelf, the Squishy Book and the hats sheet, drawn by a small second renderer
// a few at a time so the game never stutters.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { defById } from "./catalog";
import { buildHat } from "./hatModels";
import { Squishy } from "./squishy";

const SIZE = 192;

export class Thumbs {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  private squishy: Squishy | null = null;
  private done = new Map<string, string>();
  private queue: string[] = [];
  private waiting = new Map<string, ((url: string) => void)[]>();

  private setup(): boolean {
    if (this.renderer) return true;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      r.setSize(SIZE, SIZE, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.setClearColor(0x000000, 0);
      this.renderer = r;
    } catch {
      return false;
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.scene.add(new THREE.HemisphereLight("#fff4fb", "#ffcfb8", 1.15));
    const key = new THREE.DirectionalLight("#ffffff", 2.1);
    key.position.set(-3, 6, 4.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#ffd2f2", 1.1);
    rim.position.set(3.5, 2.5, -4);
    this.scene.add(rim);
    this.camera.position.set(0, 1.55, 4.6);
    this.camera.lookAt(0, 0.62, 0);
    return true;
  }

  /** The picture for a squishy, once it has been drawn. */
  get(id: string): string | undefined {
    return this.done.get(id);
  }

  /** Asks for a picture; `then` runs when it is ready (at once if it already is). */
  want(id: string, then: (url: string) => void, hat: string | null = null): void {
    this.ask(hat ? `${id}+${hat}` : id, then);
  }

  /** A picture of a hat on its own. */
  wantHat(id: string, then: (url: string) => void): void {
    this.ask(`hat:${id}`, then);
  }

  private ask(id: string, then: (url: string) => void): void {
    const url = this.done.get(id);
    if (url) {
      then(url);
      return;
    }
    const list = this.waiting.get(id);
    if (list) list.push(then);
    else {
      this.waiting.set(id, [then]);
      this.queue.push(id);
    }
  }

  /** Draws a couple of waiting pictures; call once a frame. */
  step(): void {
    for (let n = 0; n < 2 && this.queue.length; n++) {
      const id = this.queue.shift()!;
      const url = this.draw(id);
      this.done.set(id, url);
      for (const f of this.waiting.get(id) ?? []) f(url);
      this.waiting.delete(id);
    }
  }

  private draw(key: string): string {
    if (!this.setup()) return "";
    if (key.startsWith("hat:")) return this.drawHat(key.slice(4));
    const [id, hat] = key.split("+");
    const def = defById(id);
    if (!def) return "";
    if (!this.squishy) {
      this.squishy = new Squishy(def, { fx() {}, love() {}, did() {} });
      this.squishy.home.set(0, 0.45, 0);
      this.squishy.autoSleep = false;
      this.scene.add(this.squishy.group);
    }
    this.squishy.group.visible = true;
    this.squishy.setDesign(def, hat ?? null);
    // Settle into its resting shape, facing a little to the side.
    this.squishy.faceNow(-0.25);
    this.squishy.update(1 / 60, 0.4, { minX: -3, maxX: 3, maxY: 6, floorY: 0 });
    // A hat makes it taller: step back a little.
    this.camera.position.set(0, hat ? 1.75 : 1.55, hat ? 5.3 : 4.6);
    this.camera.lookAt(0, hat ? 0.78 : 0.62, 0);
    this.renderer!.render(this.scene, this.camera);
    return this.renderer!.domElement.toDataURL("image/png");
  }

  private drawHat(id: string): string {
    const model = buildHat(id);
    if (!model) return "";
    if (this.squishy) this.squishy.group.visible = false;
    model.animate?.(0.4, { energy: 0, sleeping: false, dt: 1 / 60 });
    model.obj.rotation.y += -0.35;
    this.scene.add(model.obj);
    const box = new THREE.Box3().setFromObject(model.obj);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y * 1.15, size.z) * 0.62 + 0.05;
    const d = r / Math.tan(THREE.MathUtils.degToRad(15));
    this.camera.position.set(mid.x, mid.y + d * 0.32, mid.z + d * 0.95);
    this.camera.lookAt(mid);
    this.renderer!.render(this.scene, this.camera);
    this.scene.remove(model.obj);
    model.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    return this.renderer!.domElement.toDataURL("image/png");
  }
}
