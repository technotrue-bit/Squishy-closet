// Little floating hearts, sparkles, dizzy stars, music notes and sleepy Zs, and
// for Halloween and bath time: fluttering bats, purple puffs, candy corn and soap
// bubbles.

import * as THREE from "three";
import type { Fx } from "./squishy";

function makeTexture(draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d")!;
  draw(c);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function heartPath(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.8);
  c.bezierCurveTo(x - s * 1.25, y - s * 0.05, x - s * 0.8, y - s, x, y - s * 0.38);
  c.bezierCurveTo(x + s * 0.8, y - s, x + s * 1.25, y - s * 0.05, x, y + s * 0.8);
  c.closePath();
}

function starPath(c: CanvasRenderingContext2D, x: number, y: number, r: number, inner: number, points: number): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

const textures: Record<Fx, () => THREE.CanvasTexture> = {
  heart: () =>
    makeTexture((c) => {
      heartPath(c, 64, 64, 50);
      c.fillStyle = "#ff5c8d";
      c.fill();
      c.lineWidth = 8;
      c.strokeStyle = "#ffffff";
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.beginPath();
      c.ellipse(44, 44, 10, 7, -0.6, 0, Math.PI * 2);
      c.fill();
    }),
  sparkle: () =>
    makeTexture((c) => {
      // A soft glow with a gentle four-point twinkle: cozy, not dazzling.
      const halo = c.createRadialGradient(64, 64, 0, 64, 64, 46);
      halo.addColorStop(0, "rgba(255,236,246,0.75)");
      halo.addColorStop(1, "rgba(255,214,236,0)");
      c.fillStyle = halo;
      c.fillRect(0, 0, 128, 128);
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 52);
      g.addColorStop(0, "rgba(255,250,240,0.9)");
      g.addColorStop(0.35, "rgba(255,225,200,0.6)");
      g.addColorStop(1, "rgba(255,200,225,0)");
      c.fillStyle = g;
      starPath(c, 64, 64, 52, 0.26, 4);
      c.fill();
    }),
  glimmer: () =>
    makeTexture((c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 60);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.3, "rgba(255,226,240,0.45)");
      g.addColorStop(1, "rgba(220,200,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }),
  splash: () =>
    makeTexture((c) => {
      const g = c.createRadialGradient(56, 56, 0, 64, 64, 58);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.45, "rgba(214,244,255,0.9)");
      g.addColorStop(1, "rgba(150,215,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }),
  star: () =>
    makeTexture((c) => {
      starPath(c, 64, 64, 54, 0.45, 5);
      c.fillStyle = "#ffd94a";
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = "#ffffff";
      c.stroke();
    }),
  zz: () =>
    makeTexture((c) => {
      c.font = "bold 90px ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineWidth = 12;
      c.strokeStyle = "#ffffff";
      c.strokeText("z", 64, 66);
      c.fillStyle = "#7a7ce0";
      c.fillText("z", 64, 66);
    }),
  note: () =>
    makeTexture((c) => {
      c.fillStyle = "#8a5cf0";
      c.strokeStyle = "#ffffff";
      c.lineWidth = 6;
      c.beginPath();
      c.ellipse(46, 92, 20, 15, -0.4, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillRect(60, 22, 9, 72);
      c.beginPath();
      c.moveTo(64, 22);
      c.quadraticCurveTo(100, 30, 96, 60);
      c.lineWidth = 9;
      c.strokeStyle = "#8a5cf0";
      c.stroke();
    }),
  bat: () =>
    makeTexture((c) => {
      // A round little bat with scalloped wings and big friendly eyes.
      c.fillStyle = "#4a3a6a";
      c.strokeStyle = "#ffffff";
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(64, 52);
      c.quadraticCurveTo(30, 26, 6, 44);
      c.quadraticCurveTo(14, 58, 10, 72);
      c.quadraticCurveTo(24, 64, 30, 78);
      c.quadraticCurveTo(40, 66, 50, 80);
      c.lineTo(78, 80);
      c.quadraticCurveTo(88, 66, 98, 78);
      c.quadraticCurveTo(104, 64, 118, 72);
      c.quadraticCurveTo(114, 58, 122, 44);
      c.quadraticCurveTo(98, 26, 64, 52);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(64, 64, 20, 0, Math.PI * 2);
      c.moveTo(50, 50);
      c.lineTo(48, 34);
      c.lineTo(60, 46);
      c.moveTo(78, 50);
      c.lineTo(80, 34);
      c.lineTo(68, 46);
      c.fill();
      c.fillStyle = "#ffffff";
      for (const x of [56, 72]) {
        c.beginPath();
        c.arc(x, 62, 6, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#1d1428";
      for (const x of [57, 73]) {
        c.beginPath();
        c.arc(x, 63, 3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#ff8fc0";
      for (const x of [50, 78]) {
        c.beginPath();
        c.ellipse(x, 72, 4, 2.5, 0, 0, Math.PI * 2);
        c.fill();
      }
    }),
  smoke: () =>
    makeTexture((c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 60);
      g.addColorStop(0, "rgba(214,190,255,0.85)");
      g.addColorStop(0.5, "rgba(186,150,240,0.45)");
      g.addColorStop(1, "rgba(170,130,230,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }),
  candy: () =>
    makeTexture((c) => {
      // Candy corn: yellow, orange, white tip.
      c.save();
      c.beginPath();
      c.moveTo(64, 10);
      c.quadraticCurveTo(100, 70, 104, 108);
      c.quadraticCurveTo(64, 120, 24, 108);
      c.quadraticCurveTo(28, 70, 64, 10);
      c.closePath();
      c.lineWidth = 8;
      c.strokeStyle = "#ffffff";
      c.stroke();
      c.clip();
      c.fillStyle = "#ffd23f";
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = "#ff8a1f";
      c.fillRect(0, 0, 128, 86);
      c.fillStyle = "#fff8ec";
      c.fillRect(0, 0, 128, 44);
      c.restore();
    }),
  bubble: () =>
    makeTexture((c) => {
      const g = c.createRadialGradient(64, 64, 34, 64, 64, 58);
      g.addColorStop(0, "rgba(255,255,255,0.06)");
      g.addColorStop(0.7, "rgba(200,235,255,0.35)");
      g.addColorStop(0.88, "rgba(255,200,240,0.75)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.ellipse(46, 42, 11, 6, -0.7, 0, Math.PI * 2);
      c.fill();
    }),
};

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  kind: Fx;
  spin: number;
}

export class Effects {
  readonly group = new THREE.Group();
  private mats = new Map<Fx, THREE.SpriteMaterial>();
  private live: Particle[] = [];

  private mat(kind: Fx): THREE.SpriteMaterial {
    let m = this.mats.get(kind);
    if (!m) {
      m = new THREE.SpriteMaterial({ map: textures[kind](), transparent: true, depthWrite: false });
      this.mats.set(kind, m);
    }
    return m;
  }

  emit(kind: Fx, at: THREE.Vector3, count = 1): void {
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(this.mat(kind).clone());
      sprite.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.2, (Math.random() - 0.5) * 0.3));
      sprite.renderOrder = 5;
      const vel =
        kind === "star"
          ? new THREE.Vector3(Math.cos((i / count) * Math.PI * 2) * 0.9, 0.6, Math.sin((i / count) * Math.PI * 2) * 0.4)
          : kind === "zz"
            ? new THREE.Vector3(0.35, 0.55, 0)
            : kind === "glimmer"
              ? new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.25 + Math.random() * 0.35, 0.1)
              : kind === "splash"
                ? new THREE.Vector3((Math.random() - 0.5) * 2.2, 2 + Math.random() * 1.4, (Math.random() - 0.5) * 1.4)
                : kind === "bat"
                  ? new THREE.Vector3(Math.cos((i / count) * Math.PI * 2 + Math.random()) * 2.2, 1.6 + Math.random() * 1.2, 0.3 + Math.random() * 0.6)
                  : kind === "candy"
                    ? new THREE.Vector3((Math.random() - 0.5) * 3, 2.4 + Math.random() * 1.4, 0.4 + Math.random() * 0.8)
                    : kind === "smoke"
                      ? new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.5, 0.15)
                      : kind === "bubble"
                        ? new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.35 + Math.random() * 0.3, 0.1)
                        : new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 0.8, 0.2);
      if (kind === "glimmer") sprite.position.add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.3) * 0.9, 0.2));
      const size =
        kind === "sparkle"
          ? 0.26 + Math.random() * 0.16
          : kind === "glimmer"
            ? 0.12 + Math.random() * 0.12
            : kind === "splash"
              ? 0.14 + Math.random() * 0.1
              : kind === "zz"
                ? 0.36
                : kind === "smoke"
                  ? 0.55 + Math.random() * 0.35
                  : kind === "bat"
                    ? 0.42 + Math.random() * 0.12
                    : kind === "bubble"
                      ? 0.16 + Math.random() * 0.16
                      : 0.32 + Math.random() * 0.12;
      const life =
        kind === "zz" ? 2.2 : kind === "star" ? 1.5 : kind === "glimmer" ? 2.4 + Math.random() * 1.4 : kind === "splash" ? 0.75 : kind === "bubble" ? 2.2 + Math.random() : kind === "smoke" ? 1.6 : 1.3;
      const still = kind === "glimmer" || kind === "splash" || kind === "bat" || kind === "smoke" || kind === "bubble";
      this.live.push({ sprite, vel, age: 0, life, size, kind, spin: still ? 0 : (Math.random() - 0.5) * 3 });
      this.group.add(sprite);
    }
  }

  update(dt: number): void {
    for (const p of this.live) {
      p.age += dt;
      const t = p.age / p.life;
      p.sprite.position.addScaledVector(p.vel, dt);
      if (p.kind === "bat") p.sprite.position.x += Math.sin(p.age * 5 + p.size * 30) * dt * 0.6;
      if (p.kind === "star") {
        p.vel.multiplyScalar(Math.pow(0.2, dt));
        p.vel.y -= dt * 0.4;
      } else if (p.kind === "splash") p.vel.y -= dt * 9;
      else if (p.kind === "candy") {
        p.vel.y -= dt * 7;
        p.vel.x *= Math.pow(0.6, dt);
      } else if (p.kind === "bat") {
        // Off they flutter, swooping up and down.
        p.vel.multiplyScalar(Math.pow(0.7, dt));
        p.sprite.position.y += Math.sin(p.age * 14 + p.size * 40) * dt * 1.2;
      } else if (p.kind === "bubble") p.sprite.position.x += Math.sin(p.age * 3 + p.size * 60) * dt * 0.25;
      else if (p.kind !== "glimmer") p.vel.multiplyScalar(Math.pow(0.5, dt));
      if (p.kind === "heart" || p.kind === "note") p.sprite.position.x += Math.sin(p.age * 7) * dt * 0.3;
      const pop = Math.min(1, p.age * 8);
      const grow = p.kind === "zz" ? 0.6 + t * 0.8 : p.kind === "smoke" ? 0.6 + t * 1.1 : 1;
      const s = p.size * (0.4 + 0.6 * pop) * grow;
      // Bats flap: their wings squash and stretch.
      p.sprite.scale.set(s, p.kind === "bat" ? s * (0.75 + 0.25 * Math.abs(Math.sin(p.age * 18))) : s, s);
      // Glimmers drift and breathe in and out instead of popping.
      (p.sprite.material as THREE.SpriteMaterial).opacity =
        p.kind === "glimmer"
          ? Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin(p.age * 3 + p.size * 50))
          : p.kind === "smoke"
            ? Math.sin(Math.PI * Math.min(1, t * 1.3)) * 0.8
            : t > 0.65
              ? Math.max(0, 1 - (t - 0.65) / 0.35)
              : 1;
      if (p.kind === "glimmer") p.sprite.position.x += Math.sin(p.age * 1.7 + p.size * 30) * dt * 0.12;
      (p.sprite.material as THREE.SpriteMaterial).rotation += p.spin * dt;
    }
    const dead = this.live.filter((p) => p.age >= p.life);
    for (const p of dead) {
      this.group.remove(p.sprite);
      (p.sprite.material as THREE.SpriteMaterial).dispose();
    }
    if (dead.length) this.live = this.live.filter((p) => p.age < p.life);
  }
}
