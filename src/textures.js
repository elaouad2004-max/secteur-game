// Procedural textures (zellige, plaster, stone, wood, grass, carpets, books) and photo face processing.
import * as THREE from 'three';
import { CHARACTERS } from './state.js';

function canvasTex(size, draw, repeat = [1, 1], h = size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  draw(c.getContext('2d'), size, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
const noise = (g, w, h, n, a, col = '0,0,0') => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${col},${Math.random() * a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
};

// ---------- floors ----------
export function floorTex(kind, pal, rx, ry) {
  if (kind === 'grass') return canvasTex(256, (g, s) => {
    g.fillStyle = '#1d2a14'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * s, y = Math.random() * s, l = 3 + Math.random() * 7;
      g.strokeStyle = `hsl(${85 + Math.random() * 30},${30 + Math.random() * 30}%,${10 + Math.random() * 18}%)`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 4, y - l); g.stroke();
    }
    for (let i = 0; i < 25; i++) { g.fillStyle = '#3a3a30'; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 5 + Math.random() * 8, 3 + Math.random() * 5, Math.random() * 3, 0, 7); g.fill(); }
  }, [rx, ry]);
  if (kind === 'terracotta') return canvasTex(256, (g, s) => {
    const q = s / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = `hsl(${14 + Math.random() * 8},${45 + Math.random() * 15}%,${24 + Math.random() * 8}%)`;
      g.fillRect(x * q + 2, y * q + 2, q - 4, q - 4);
    }
    g.fillStyle = '#16100b';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * q - 2, 0, 4, s); g.fillRect(0, i * q - 2, s, 4); }
    noise(g, s, s, 900, 0.25);
  }, [rx, ry]);
  if (kind === 'planks') return canvasTex(256, (g, s) => {
    const n = 6, w = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(25,${35 + Math.random() * 15}%,${15 + Math.random() * 7}%)`; g.fillRect(i * w, 0, w, s);
      for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); const x = i * w + Math.random() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 4, s / 3, x - 4, s / 2, x, s); g.stroke(); }
      g.fillStyle = '#0c0805'; g.fillRect(i * w, 0, 2, s); g.fillRect(i * w, (i * 97) % s, w, 2);
    }
  }, [rx, ry]);
  // zellige with an eight-point star, colours from the theme palette
  const [a, b] = pal;
  return canvasTex(256, (g, s) => {
    const q = s / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#2b2620' : '#211d19'; g.fillRect(x * q, y * q, q, q);
      const cx = x * q + q / 2, cy = y * q + q / 2;
      g.fillStyle = (x + y) % 2 ? a : b;
      for (const r of [0, Math.PI / 4]) { g.save(); g.translate(cx, cy); g.rotate(r); g.fillRect(-q * 0.24, -q * 0.24, q * 0.48, q * 0.48); g.restore(); }
      g.fillStyle = (x + y) % 2 ? b : a; g.beginPath(); g.arc(cx, cy, q * 0.12, 0, 7); g.fill();
      g.fillStyle = '#c9b48a';
      for (const [ox, oy] of [[0, 0], [q, 0], [0, q], [q, q]]) { g.beginPath(); g.arc(x * q + ox, y * q + oy, q * 0.07, 0, 7); g.fill(); }
    }
    g.strokeStyle = '#0e0c0a'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * q, 0); g.lineTo(i * q, s); g.moveTo(0, i * q); g.lineTo(s, i * q); g.stroke(); }
    noise(g, s, s, 600, 0.3);
  }, [rx, ry]);
}

// ---------- walls ----------
export function wallTex(kind, pal) {
  if (kind === 'stone') return canvasTex(256, (g, s) => {
    g.fillStyle = '#1a1612'; g.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -h : 0;
      while (x < s) {
        const w = h * (1.4 + Math.random());
        g.fillStyle = `hsl(30,${8 + Math.random() * 10}%,${22 + Math.random() * 12}%)`;
        g.fillRect(x + 2, r * h + 2, w - 4, h - 4); x += w;
      }
    }
    noise(g, s, s, 1500, 0.3);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(40,70,25,${Math.random() * 0.6})`; g.beginPath(); g.arc(Math.random() * s, s * 0.6 + Math.random() * s * 0.4, 3 + Math.random() * 8, 0, 7); g.fill(); }
  });
  const [a, b] = pal;
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#6a5642'; g.fillRect(0, 0, s, s);
    noise(g, s, s, 2500, 0.2);
    noise(g, s, s, 400, 0.08, '255,240,210');
    // carved frieze at the top
    g.fillStyle = '#4a3a2a'; g.fillRect(0, 0, s, 34);
    g.strokeStyle = '#a08660'; g.lineWidth = 2;
    for (let x = 0; x < s; x += 32) { g.beginPath(); g.arc(x + 16, 34, 14, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(x + 16, 6); g.lineTo(x + 24, 16); g.lineTo(x + 16, 26); g.lineTo(x + 8, 16); g.closePath(); g.stroke(); }
    g.fillStyle = '#2a1d12'; g.fillRect(0, 34, s, 4);
    // water stains & cracks
    for (let i = 0; i < 5; i++) { const x = Math.random() * s; const gr = g.createLinearGradient(0, 40, 0, 150); gr.addColorStop(0, 'rgba(20,12,5,.35)'); gr.addColorStop(1, 'rgba(20,12,5,0)'); g.fillStyle = gr; g.fillRect(x, 40, 10 + Math.random() * 20, 110); }
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(20,12,6,.6)'; g.lineWidth = 1; g.beginPath();
      let x = Math.random() * s, y = 40 + Math.random() * 80; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 24; y += Math.random() * 14; g.lineTo(x, y); }
      g.stroke();
    }
    // zellige dado at the bottom
    const top = s * 0.62, q = s / 8;
    g.fillStyle = '#2a1d12'; g.fillRect(0, top - 8, s, 8);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * q, top + y * q, q, q);
      g.fillStyle = (x + y) % 2 ? b : a; g.save(); g.translate(x * q + q / 2, top + y * q + q / 2); g.rotate(Math.PI / 4); g.fillRect(-q * 0.18, -q * 0.18, q * 0.36, q * 0.36); g.restore();
    }
    noise(g, s, s, 300, 0.3);
  });
}

export const woodTex = (base = '#6b4a2b') => canvasTex(128, (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(30,18,8,${Math.random() * 0.5})`;
    g.beginPath(); const y = Math.random() * s; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + 6, s / 2, y - 6, s, y); g.stroke();
  }
  g.strokeStyle = 'rgba(20,12,5,.8)'; g.lineWidth = 5; g.strokeRect(3, 3, s - 6, s - 6);
});

export const booksTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#2a1a0e'; g.fillRect(0, 0, s, s);
  const shelves = 4, h = s / shelves;
  for (let r = 0; r < shelves; r++) {
    let x = 6;
    while (x < s - 10) {
      const w = 6 + Math.random() * 10, bh = h * (0.6 + Math.random() * 0.3);
      g.fillStyle = `hsl(${Math.random() * 360},${25 + Math.random() * 35}%,${15 + Math.random() * 20}%)`;
      g.fillRect(x, r * h + h - bh - 6, w, bh);
      g.fillStyle = 'rgba(220,180,90,.5)'; g.fillRect(x + 1, r * h + h - bh + 4, w - 2, 2);
      x += w + 1;
    }
    g.fillStyle = '#4a2f18'; g.fillRect(0, r * h + h - 6, s, 6);
  }
});

export const carpetTex = (hue) => canvasTex(256, (g, s, h) => {
  g.fillStyle = `hsl(${hue},55%,22%)`; g.fillRect(0, 0, s, h);
  g.strokeStyle = '#c9a227'; g.lineWidth = 6; g.strokeRect(10, 10, s - 20, h - 20);
  g.strokeStyle = `hsl(${hue + 180},40%,30%)`; g.lineWidth = 10; g.strokeRect(24, 24, s - 48, h - 48);
  g.fillStyle = '#d8c8a0';
  for (let i = 0; i < 3; i++) { const cx = s / 2, cy = h * (0.25 + i * 0.25); g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillRect(-20, -20, 40, 40); g.restore(); g.fillStyle = `hsl(${hue},55%,15%)`; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill(); g.fillStyle = '#d8c8a0'; }
  for (let x = 40; x < s - 40; x += 18) for (const y of [40, h - 40]) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.fill(); }
  noise(g, s, h, 1500, 0.25);
}, [1, 1], 512);

// ---------- faces ----------
const faceCache = {};
/**
 * Crops the uploaded portrait around the face, removes the photo background
 * (flood fill from the borders) and feathers the edge into an oval, so the face
 * blends onto the 3D head. Also samples skin + hair colours for the body.
 */
export function faceData(url) {
  if (faceCache[url]) return faceCache[url];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const data = { tex, skin: new THREE.Color(0xc89070), hair: new THREE.Color(0x1b130d), loaded: false, cbs: [] };
  data.ready = (cb) => (data.loaded ? cb(data) : data.cbs.push(cb));
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    // face box per character (fractions of the photo), see characters.json 'face'
    const [fx, fy, fw, fh] = CHARACTERS.find((c) => c.photo === url)?.face || [0.27, 0.17, 0.46, 0.52];
    g.drawImage(img, w * fx, h * fy, w * fw, h * fh, 0, 0, 256, 256);
    const id = g.getImageData(0, 0, 256, 256), px = id.data;
    const at = (x, y) => (y * 256 + x) * 4;
    const avg = (pts) => { const s = [0, 0, 0]; for (const [x, y] of pts) { const i = at(x, y); s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; } return s.map((v) => v / pts.length); };
    // background colour = average of the top corners
    const bg = avg([[2, 2], [253, 2], [2, 40], [253, 40]]);
    const close = (i) => Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) < 70;
    // only cut the background when it is plain (studio-like); busy backgrounds rely on the oval mask
    const border = [];
    for (let i = 0; i < 256; i += 16) border.push(at(i, 0), at(0, i), at(255, i));
    const plain = border.filter(close).length / border.length > 0.7;
    const seen = new Uint8Array(256 * 256), q = [];
    if (plain) for (let i = 0; i < 256; i++) q.push([i, 0], [0, i], [255, i]);
    while (q.length) {
      const [x, y] = q.pop();
      if (x < 0 || y < 0 || x > 255 || y > 255 || seen[y * 256 + x]) continue;
      seen[y * 256 + x] = 1;
      if (!close(at(x, y))) continue;
      px[at(x, y) + 3] = 0;
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    // feathered oval mask
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 118, dy = (y - 128) / 128, d = Math.sqrt(dx * dx + dy * dy);
      const k = d < 0.8 ? 1 : Math.max(0, 1 - (d - 0.8) / 0.2);
      px[at(x, y) + 3] *= k;
    }
    const skin = avg([[65, 165], [190, 165], [75, 178], [180, 178]]);
    const hair = avg([[128, 22], [100, 28], [156, 28], [128, 34]]);
    g.putImageData(id, 0, 0);
    data.skin.setRGB(skin[0] / 255, skin[1] / 255, skin[2] / 255, THREE.SRGBColorSpace);
    data.hair.setRGB(hair[0] / 255, hair[1] / 255, hair[2] / 255, THREE.SRGBColorSpace);
    tex.needsUpdate = true;
    data.loaded = true; data.cbs.forEach((cb) => cb(data)); data.cbs = [];
  };
  img.src = encodeURI(url);
  return (faceCache[url] = data);
}

/** Floating name tag sprite. */
export function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(250, g.measureText(text).width + 30);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.roundRect(128 - w / 2, 8, w, 48, 20); g.fill();
  g.fillStyle = color; g.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.renderOrder = 10;
  return s;
}

let glow;
/** Soft round glow for sprites (eyes, flames, sparkles). */
export function glowTex() {
  if (glow) return glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (glow = new THREE.CanvasTexture(c));
}
