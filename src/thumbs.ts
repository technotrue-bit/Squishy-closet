// Little pictures of each squishy for the closet shelf and the Squishy Book,
// drawn by a small second renderer a few at a time so the game never stutters.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { defById } from "./catalog";
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
  want(id: string, then: (url: string) => void): void {
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

  private draw(id: string): string {
    const def = defById(id);
    if (!def || !this.setup()) return "";
    if (!this.squishy) {
      this.squishy = new Squishy(def, { fx() {}, love() {}, did() {} });
      this.squishy.home.set(0, 0.45, 0);
      this.scene.add(this.squishy.group);
    } else this.squishy.setDesign(def);
    // Settle into its resting shape, facing a little to the side.
    this.squishy.update(1 / 60, 0, { minX: -3, maxX: 3, maxY: 6, floorY: 0 });
    this.squishy.group.rotation.y = -0.25;
    this.renderer!.render(this.scene, this.camera);
    return this.renderer!.domElement.toDataURL("image/png");
  }
}
