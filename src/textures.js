// Procedural textures (Moroccan zellige / plaster / wood) and photo face textures.
import * as THREE from 'three';

function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

const noise = (g, s, n, a) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * a})`;
    g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
};

export const floorTex = (rx, ry) => canvasTex(256, (g, s) => {
  // zellige: 4x4 tiles with an eight-point star motif
  const q = s / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? '#2b2620' : '#211d19';
    g.fillRect(x * q, y * q, q, q);
    const cx = x * q + q / 2, cy = y * q + q / 2;
    g.fillStyle = (x + y) % 2 ? '#1d3b55' : '#17402f';
    for (const r of [0, Math.PI / 4]) {
      g.save(); g.translate(cx, cy); g.rotate(r); g.fillRect(-q * 0.22, -q * 0.22, q * 0.44, q * 0.44); g.restore();
    }
    g.fillStyle = '#c9b48a'; g.beginPath(); g.arc(cx, cy, q * 0.08, 0, 7); g.fill();
  }
  g.strokeStyle = '#0e0c0a'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * q, 0); g.lineTo(i * q, s); g.moveTo(0, i * q); g.lineTo(s, i * q); g.stroke(); }
  noise(g, s, 400, 0.25);
}, [rx, ry]);

export const wallTex = () => canvasTex(256, (g, s) => {
  g.fillStyle = '#5b4a3a'; g.fillRect(0, 0, s, s);           // plaster
  noise(g, s, 1500, 0.18);
  for (let i = 0; i < 6; i++) {                             // cracks
    g.strokeStyle = 'rgba(20,12,6,.5)'; g.beginPath();
    let x = Math.random() * s, y = Math.random() * s * 0.6; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 20; g.lineTo(x, y); }
    g.stroke();
  }
  const b = s * 0.62, q = s / 8;                            // zellige band at the bottom
  for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? '#1c3d5a' : '#d8cdb4';
    g.fillRect(x * q, b + y * q, q, q);
  }
  g.fillStyle = '#3a2a1b'; g.fillRect(0, b - 8, s, 8);
});

export const woodTex = () => canvasTex(128, (g, s) => {
  g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(40,25,10,${Math.random() * 0.5})`;
    g.beginPath(); const y = Math.random() * s; g.moveTo(0, y); g.bezierCurveTo(s / 3, y + 6, s / 2, y - 6, s, y); g.stroke();
  }
  g.strokeStyle = '#3d2a17'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6);
});

const faceCache = {};
/** Square crop of the uploaded portrait, centred on the face. */
export function faceTex(url) {
  if (faceCache[url]) return faceCache[url];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9a066'; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight, side = w * 0.62;
    g.drawImage(img, w * 0.19, h * 0.14, side, side, 0, 0, 256, 256);
    tex.needsUpdate = true;
  };
  img.src = url;
  return (faceCache[url] = tex);
}
