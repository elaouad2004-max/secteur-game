// 3D character: round head with the cut-out photo face, skin/hair colours sampled from the photo,
// articulated arms and legs. Housekeepers get a maid uniform, glowing eyes and a broom.
import * as THREE from 'three';
import { faceData, labelSprite, glowTex } from './textures.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

// face decal region on the head sphere
const HR = 0.4, PHIL = 1.45, PHI0 = Math.PI / 2 - PHIL / 2, TH0 = 0.38, THL = 1.85;
const onHead = (u, v, r) => {
  const phi = PHI0 + u * PHIL, th = TH0 + v * THL;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(phi) * Math.sin(th) * r);
};

export function makeCharacter({ photo, color, hat = 0, evil = false, name = '' }) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const face = faceData(photo);
  const skin = std(0xc89070), hair = std(0x1b130d, { roughness: 1 });
  const cloth = std(evil ? 0x14141a : color);
  const pants = std(evil ? 0x0c0c10 : 0x2b2b3a);
  const shoe = std(evil ? 0x050505 : 0xd4a017, { roughness: 0.5 });
  const white = std(0xe8e4dc);
  face.ready((f) => { skin.color.copy(f.skin); hair.color.copy(f.hair); });

  // legs (pivot at hip)
  const legs = [-0.13, 0.13].map((x) => {
    const g = new THREE.Group(); g.position.set(x, 0.74, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), pants, 0, -0.33, 0));
    g.add(mesh(new THREE.BoxGeometry(0.19, 0.1, 0.32), shoe, 0, -0.69, 0.05));
    body.add(g); return g;
  });
  // torso
  const torso = mesh(new THREE.CapsuleGeometry(0.27, 0.34, 6, 14), cloth, 0, 1.08, 0);
  torso.scale.z = 0.72; body.add(torso);
  if (evil) {
    body.add(mesh(new THREE.CylinderGeometry(0.27, 0.46, 0.62, 16), cloth, 0, 0.78, 0)); // dress
    const apron = mesh(new THREE.CylinderGeometry(0.28, 0.44, 0.85, 16, 1, true, -0.7, 1.4), white, 0, 0.92, 0.012);
    body.add(apron);
    const collar = mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 16), white, 0, 1.4, 0);
    collar.rotation.x = Math.PI / 2; body.add(collar);
  } else {
    const belt = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.07, 16), std(0x2a1a0e), 0, 0.86, 0); belt.scale.z = 0.75; body.add(belt);
    body.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), std(0xd4a017, { metalness: 0.8 }), 0, 0.86, 0.21));
    const collar = mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), cloth, 0, 1.39, 0); collar.rotation.x = Math.PI / 2; body.add(collar);
  }
  // arms (pivot at shoulder)
  const arms = [-1, 1].map((sd) => {
    const g = new THREE.Group(); g.position.set(sd * 0.36, 1.33, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.085, 0.4, 4, 10), cloth, 0, -0.26, 0));
    g.add(mesh(new THREE.SphereGeometry(0.085, 10, 8), skin, 0, -0.53, 0));
    g.rotation.z = sd * 0.08; body.add(g); return g;
  });
  if (evil) { // broom in the right hand
    const broom = new THREE.Group();
    broom.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), std(0x5a3a1a), 0, 0, 0));
    broom.add(mesh(new THREE.ConeGeometry(0.16, 0.38, 10), std(0x9c8240, { roughness: 1 }), 0, -0.85, 0));
    broom.position.set(0, -0.55, 0.08); broom.rotation.x = 0.25; arms[1].add(broom);
  }
  // neck + head
  body.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 10), skin, 0, 1.47, 0));
  const head = new THREE.Group(); head.position.y = 1.86; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(HR, 32, 24), skin));
  const faceMat = new THREE.MeshStandardMaterial({
    map: face.tex, transparent: true, alphaTest: 0.04, roughness: 0.75,
    emissive: 0xffffff, emissiveMap: face.tex, emissiveIntensity: evil ? 0.18 : 0.28, // keeps faces readable in the dark
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  if (evil) faceMat.color.set(0xd8b8b0);
  head.add(mesh(new THREE.SphereGeometry(HR * 1.012, 40, 30, PHI0, PHIL, TH0, THL), faceMat));
  // hair shell over the back and top of the head (the photo provides the front hairline)
  head.add(mesh(new THREE.SphereGeometry(HR * 1.05, 28, 20, PHI0 + PHIL + 0.45, Math.PI * 2 - PHIL - 0.9, 0, 1.9), hair));
  head.add(mesh(new THREE.SphereGeometry(HR * 1.05, 28, 10, 0, Math.PI * 2, 0, 0.5), hair));
  for (const sd of [-1, 1]) { const ear = mesh(new THREE.SphereGeometry(0.075, 10, 8), skin, sd * HR * 0.98, -0.02, -0.02); ear.scale.z = 0.6; head.add(ear); }

  if (evil) {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
    for (const u of [0.33, 0.67]) {
      const e = mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat); e.position.copy(onHead(u, 0.5, HR * 1.03)); head.add(e);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff2020, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(0.22); glow.position.copy(e.position); head.add(glow);
    }
    const bonnet = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 16), white, 0, HR * 0.88, -0.05); bonnet.rotation.x = -0.25; head.add(bonnet);
  }
  const hatY = HR * 0.82;
  if (hat === 1) {
    const m = std(color);
    head.add(mesh(new THREE.SphereGeometry(HR * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.3), m, 0, 0.04, 0));
    head.add(mesh(new THREE.BoxGeometry(0.46, 0.04, 0.32), m, 0, hatY - 0.08, 0.4));
  } else if (hat === 2) {
    head.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.34, 18), std(0xa3121e), 0, hatY + 0.12, 0));
    const tassel = mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.28, 6), std(0x111111), 0.17, hatY + 0.14, 0); tassel.rotation.z = 0.3; head.add(tassel);
  } else if (hat === 3) {
    const gold = std(0xf1c40f, { metalness: 0.85, roughness: 0.3, emissive: 0x332200 });
    head.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.13, 18, 1, true), gold, 0, hatY + 0.05, 0));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      head.add(mesh(new THREE.ConeGeometry(0.06, 0.17, 4), gold, Math.cos(a) * 0.26, hatY + 0.19, Math.sin(a) * 0.26));
      head.add(mesh(new THREE.SphereGeometry(0.03, 6, 6), std(i % 2 ? 0xe02040 : 0x2080e0, { emissive: 0x220000 }), Math.cos(a) * 0.29, hatY + 0.05, Math.sin(a) * 0.29));
    }
  }
  if (name) { const l = labelSprite(name, evil ? '#ff6060' : '#e9b44c'); l.position.y = 2.75; root.add(l); }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let phase = 0;
  return {
    root, head,
    animate(dt, speed) {
      phase += dt * speed * 2.6;
      const k = Math.min(1, speed / 3), s = Math.sin(phase) * k * 0.75;
      legs[0].rotation.x = s; legs[1].rotation.x = -s;
      arms[0].rotation.x = -s * 0.9; arms[1].rotation.x = s * 0.9 * (evil ? 0.4 : 1);
      body.position.y = Math.abs(Math.sin(phase)) * 0.06 * k;
      head.rotation.y = Math.sin(phase * 0.5) * 0.06 * k;
      if (!speed) { head.rotation.z = Math.sin(performance.now() / 900) * 0.04; } // idle breathing
    },
    setOpacity(a) {
      root.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) { m.userData.t ??= m.transparent; m.transparent = m.userData.t || a < 1; m.opacity = a; }
      });
    },
    dispose() {
      root.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { if (m.map && m.map !== face.tex) m.map.dispose(); m.dispose(); } });
    },
  };
}
