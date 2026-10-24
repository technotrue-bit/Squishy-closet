// The cozy table: a pastel sky, a soft tabletop, a bamboo steamer basket for
// the squishy to sit in (with its lid leaning behind, like the toy) and soft lights.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const BASKET_FLOOR = 0.15;
/** Inside radius and rim height of the basket, for the squishy to bulge against. */
export const BASKET_WALL = { r: 1.1, top: 0.3 };

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bambooSide(): THREE.CanvasTexture {
  const t = canvasTex(1024, 128, (c) => {
    c.fillStyle = "#e3b27a";
    c.fillRect(0, 0, 1024, 128);
    // vertical slats
    for (let x = 0; x < 1024; x += 16) {
      c.fillStyle = x % 32 ? "rgba(255,240,215,0.22)" : "rgba(150,95,45,0.12)";
      c.fillRect(x, 0, 9, 128);
      c.fillStyle = "rgba(120,70,30,0.18)";
      c.fillRect(x + 15, 0, 1, 128);
    }
    // a woven band near the top and bottom
    for (const y of [14, 100]) {
      c.fillStyle = "rgba(160,100,45,0.35)";
      c.fillRect(0, y, 1024, 3);
      c.fillRect(0, y + 12, 1024, 3);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function bambooWeave(): THREE.CanvasTexture {
  return canvasTex(256, 256, (c) => {
    c.fillStyle = "#d9a265";
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = "rgba(130,80,35,0.35)";
    c.lineWidth = 3;
    for (let k = -256; k < 512; k += 22) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k + 256, 256);
      c.stroke();
      c.beginPath();
      c.moveTo(k + 256, 0);
      c.lineTo(k, 256);
      c.stroke();
    }
  });
}

function shadowTex(): THREE.CanvasTexture {
  return canvasTex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(120,60,90,0.42)");
    g.addColorStop(0.55, "rgba(120,60,90,0.18)");
    g.addColorStop(1, "rgba(120,60,90,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}

function skyTex(): THREE.CanvasTexture {
  return canvasTex(16, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#c9b8ff");
    g.addColorStop(0.45, "#ffc6df");
    g.addColorStop(1, "#ffe0d0");
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 512);
  });
}

export interface Stage {
  scene: THREE.Scene;
  basket: THREE.Group;
  /** Soft shadow that follows the squishy when it leaves the basket. */
  shadow: THREE.Mesh;
}

export function buildStage(renderer?: THREE.WebGLRenderer): Stage {
  const scene = new THREE.Scene();
  scene.background = skyTex();
  scene.fog = new THREE.Fog("#ffd7e2", 14, 30);
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }

  scene.add(new THREE.HemisphereLight("#fff4fb", "#ffcfb8", 1.15));
  const key = new THREE.DirectionalLight("#ffffff", 2.1);
  key.position.set(-3, 6, 4.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffd2f2", 1.1);
  rim.position.set(3.5, 2.5, -4);
  scene.add(rim);

  const table = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: "#ffe6ee", roughness: 0.92 }),
  );
  table.rotation.x = -Math.PI / 2;
  scene.add(table);

  // Little sprinkles on the table for fun.
  const dots = new THREE.Group();
  const dotGeo = new THREE.CircleGeometry(0.06, 16);
  const dotColors = ["#ffffff", "#ffd1e6", "#d8ccff", "#ffe9a8"];
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.8 + Math.random() * 7;
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: dotColors[i % dotColors.length] }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(Math.cos(a) * r, 0.003, Math.sin(a) * r - 1);
    m.scale.setScalar(0.6 + Math.random() * 0.9);
    dots.add(m);
  }
  scene.add(dots);

  const basket = new THREE.Group();
  const side = bambooSide();
  side.repeat.set(1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.75, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.12, 0.3, 72, 1, true), wallMat);
  wall.position.y = 0.15;
  const floorMat = new THREE.MeshStandardMaterial({ map: bambooWeave(), roughness: 0.85 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, BASKET_FLOOR, 72), floorMat);
  floor.position.y = BASKET_FLOOR / 2;
  const rimMat = new THREE.MeshStandardMaterial({ color: "#d39a5c", roughness: 0.6 });
  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.045, 12, 96), rimMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.3;
  const rimLow = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.035, 10, 96), rimMat);
  rimLow.rotation.x = Math.PI / 2;
  rimLow.position.y = 0.05;
  basket.add(wall, floor, rimTop, rimLow);

  // The lid, leaning on its edge behind the basket.
  const lid = new THREE.Group();
  const lidWall = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 72, 1, true), wallMat);
  const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.05, 72), floorMat);
  lidTop.position.y = 0.08;
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 10, 96), rimMat);
  lidRim.rotation.x = Math.PI / 2;
  lidRim.position.y = -0.1;
  const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 6, 12), rimMat);
  knob.rotation.z = Math.PI / 2;
  knob.position.y = 0.16;
  lid.add(lidWall, lidTop, lidRim, knob);
  lid.rotation.x = -1.2;
  lid.rotation.z = 0.12;
  lid.position.set(-0.55, 1.15, -1.55);
  basket.add(lid);

  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false });
  const basketShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), shadowMat);
  basketShadow.rotation.x = -Math.PI / 2;
  basketShadow.position.y = 0.004;
  scene.add(basketShadow);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), shadowMat.clone());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  shadow.visible = false;
  scene.add(shadow);

  scene.add(basket);
  return { scene, basket, shadow };
}
