// The stage every place shares: soft lights, soft shadows, and two bamboo
// steamer baskets. The big one shows up in front only while a new box is
// opened; the little one is your squishy's own box, sitting at the back of
// whichever place you are in (with its lid leaning on it, like the toy).

import * as THREE from "three";
import type { PlaceScene } from "./placeScenes";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const BASKET_FLOOR = 0.15;
/** Inside radius and rim height of the basket, for the squishy to bulge against. */
export const BASKET_WALL = { r: 1.1, top: 0.3 };

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
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

export function shadowTex(): THREE.CanvasTexture {
  return canvasTex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(120,60,90,0.42)");
    g.addColorStop(0.55, "rgba(120,60,90,0.18)");
    g.addColorStop(1, "rgba(120,60,90,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}

export interface Stage {
  scene: THREE.Scene;
  /** The box a new squishy pops out of, in front; hidden the rest of the time. */
  basket: THREE.Group;
  /** Your squishy's own box at the back of the place. */
  homeBox: THREE.Group;
  /** Shows the opening basket (and its shadow) or hides it. */
  showBasket(on: boolean): void;
  /** Pushes the fog back to suit how far away the camera is. */
  setViewDistance(d: number): void;
  /** Soft shadow that follows the squishy when it leaves the basket. */
  shadow: THREE.Mesh;
  /** The steamer lid; it rests leaning behind and closes over a new squishy. */
  lid: THREE.Group;
  shadowMat: THREE.MeshBasicMaterial;
  /** Shows a place behind the basket. */
  setPlace(p: PlaceScene): void;
}

/** Where the lid leans at rest, and where it sits when closed on the basket. */
export const LID_REST = { pos: new THREE.Vector3(-0.55, 1.15, -1.55), rot: new THREE.Euler(-1.2, 0, 0.12) };
export const LID_CLOSED = { pos: new THREE.Vector3(0, 0.4, 0), rot: new THREE.Euler(0, 0, 0) };

export function buildStage(renderer?: THREE.WebGLRenderer): Stage {
  const scene = new THREE.Scene();
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }

  const fill = new THREE.HemisphereLight("#fff4fb", "#ffcfb8", 1.15);
  scene.add(fill);
  const key = new THREE.DirectionalLight("#ffffff", 2.1);
  key.position.set(-3, 6, 4.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ffd2f2", 1.1);
  rim.position.set(3.5, 2.5, -4);
  scene.add(rim);

  const side = bambooSide();
  side.repeat.set(1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.75, side: THREE.DoubleSide });
  const floorMat = new THREE.MeshStandardMaterial({ map: bambooWeave(), roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: "#d39a5c", roughness: 0.6 });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false });

  const { basket, lid } = steamer(wallMat, floorMat, rimMat);
  const basketShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), shadowMat);
  basketShadow.rotation.x = -Math.PI / 2;
  basketShadow.position.y = 0.004;
  scene.add(basketShadow);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), shadowMat.clone());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  scene.add(shadow);
  scene.add(basket);

  // Your squishy's own box: a smaller steamer with a pillow inside.
  const home = steamer(wallMat, floorMat, rimMat);
  const homeBox = home.basket;
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 16), new THREE.MeshStandardMaterial({ color: "#fff3f8", roughness: 0.95 }));
  pillow.scale.set(1.15, 0.32, 0.8);
  pillow.position.set(0.1, BASKET_FLOOR + 0.1, -0.25);
  const blanket = new THREE.Mesh(new THREE.SphereGeometry(0.8, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#ffc6df", roughness: 0.95 }));
  blanket.scale.set(1.15, 0.22, 0.7);
  blanket.position.set(-0.05, BASKET_FLOOR, 0.35);
  homeBox.add(pillow, blanket);
  homeBox.scale.setScalar(0.62);
  const homeShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), shadowMat);
  homeShadow.rotation.x = -Math.PI / 2;
  homeShadow.position.y = 0.006;
  homeBox.add(homeShadow);
  scene.add(homeBox);

  const showBasket = (on: boolean) => {
    basket.visible = on;
    basketShadow.visible = on;
  };
  showBasket(false);

  let place: PlaceScene | null = null;
  let viewD = 8;
  const fog = new THREE.Fog("#ffffff", 20, 40);
  const fitFog = () => {
    if (!place) return;
    // Places set their fog for a camera about 8 away; push it back to match.
    const extra = Math.max(0, viewD - 8);
    fog.color.copy(place.fog.color);
    fog.near = place.fog.near + extra;
    fog.far = place.fog.far + extra * 1.4;
  };
  const setPlace = (p: PlaceScene) => {
    if (place) scene.remove(place.group);
    place = p;
    scene.add(p.group);
    scene.background = p.sky;
    scene.fog = fog;
    fitFog();
    fill.color.set(p.light[0]);
    fill.groundColor.set(p.light[1]);
    homeBox.position.copy(p.box.at);
    homeBox.rotation.y = p.box.yaw;
  };
  const setViewDistance = (d: number) => {
    viewD = d;
    fitFog();
  };
  return { scene, basket, homeBox, showBasket, setViewDistance, shadow, lid, shadowMat, setPlace };
}

/** A bamboo steamer basket with its lid leaning on its edge behind it. */
function steamer(wallMat: THREE.Material, floorMat: THREE.Material, rimMat: THREE.Material): { basket: THREE.Group; lid: THREE.Group } {
  const basket = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.12, 0.3, 72, 1, true), wallMat);
  wall.position.y = 0.15;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, BASKET_FLOOR, 72), floorMat);
  floor.position.y = BASKET_FLOOR / 2;
  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.045, 12, 96), rimMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.3;
  const rimLow = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.035, 10, 96), rimMat);
  rimLow.rotation.x = Math.PI / 2;
  rimLow.position.y = 0.05;
  basket.add(wall, floor, rimTop, rimLow);

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
  lid.rotation.copy(LID_REST.rot);
  lid.position.copy(LID_REST.pos);
  basket.add(lid);
  return { basket, lid };
}
