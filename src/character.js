// Blocky 3D character with the uploaded photo as the face.
import * as THREE from 'three';
import { faceTex } from './textures.js';

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

export function makeCharacter({ photo, color, hat = 0, evil = false }) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // animated part
  root.add(body);

  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1b130d, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex(photo), roughness: 0.9 });

  const torso = box(0.7, 0.8, 0.4, cloth); torso.position.y = 1.05; body.add(torso);
  const legL = box(0.28, 0.65, 0.3, dark); legL.position.set(-0.17, 0.33, 0); body.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; body.add(legR);
  const armL = box(0.2, 0.7, 0.24, cloth); armL.position.set(-0.47, 1.05, 0); body.add(armL);
  const armR = armL.clone(); armR.position.x = 0.47; body.add(armR);
  // head: photo on the front (+z) face
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), [skin, skin, hair, skin, faceMat, hair]);
  head.position.y = 1.78; body.add(head);

  if (evil) {
    const apron = box(0.6, 0.7, 0.02, new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    apron.position.set(0, 0.95, 0.21); body.add(apron);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      eye.position.set(x, 1.84, 0.315); body.add(eye);
    }
    faceMat.color.set(0xff9a9a);
  }

  if (hat === 1) { // cap
    const m = new THREE.MeshStandardMaterial({ color });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
    top.position.y = 2.06; body.add(top);
    const brim = box(0.5, 0.04, 0.3, m); brim.position.set(0, 2.08, 0.38); body.add(brim);
  } else if (hat === 2) { // fez
    const fez = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.36, 16), new THREE.MeshStandardMaterial({ color: 0xa3121e }));
    fez.position.y = 2.27; body.add(fez);
    const tassel = box(0.03, 0.25, 0.03, dark); tassel.position.set(0.18, 2.3, 0); body.add(tassel);
  } else if (hat === 3) { // crown
    const gold = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8, roughness: 0.3, emissive: 0x332200 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 16, 1, true), gold);
    ring.position.y = 2.16; body.add(ring);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), gold);
      const a = (i / 6) * Math.PI * 2; s.position.set(Math.cos(a) * 0.27, 2.3, Math.sin(a) * 0.27); body.add(s);
    }
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let phase = 0;
  return {
    root,
    materials: [cloth, skin, hair, dark, faceMat],
    /** speed: units/s, used to swing limbs */
    animate(dt, speed) {
      phase += dt * speed * 3;
      const s = Math.sin(phase) * Math.min(1, speed / 3) * 0.7;
      legL.rotation.x = s; legR.rotation.x = -s; armL.rotation.x = -s; armR.rotation.x = s;
      body.position.y = Math.abs(Math.sin(phase)) * 0.05 * Math.min(1, speed);
    },
    setOpacity(a) {
      root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { m.transparent = a < 1; m.opacity = a; } });
    },
  };
}
