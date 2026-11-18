// Rotating 3D preview of a character, used on the hero select / customize screens.
import * as THREE from 'three';
import { makeCharacter } from './character.js';

export class Preview {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'preview3d';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(260, 320, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 260 / 320, 0.1, 50);
    this.camera.position.set(0, 1.8, 5.8); this.camera.lookAt(0, 1.4, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff0dd, 0x302010, 1.4));
    const key = new THREE.DirectionalLight(0xffd8a0, 2.2); key.position.set(2, 3, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6080ff, 1.5); rim.position.set(-3, 2, -3); this.scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color: 0xe9b44c, transparent: true, opacity: 0.25 }));
    disc.rotation.x = -Math.PI / 2; this.scene.add(disc);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Show `opts` (makeCharacter options) and mount the canvas inside `parent`. */
  show(parent, opts) {
    if (this.model) { this.scene.remove(this.model.root); this.model.dispose(); }
    this.model = makeCharacter(opts);
    this.scene.add(this.model.root);
    parent.appendChild(this.canvas);
  }

  frame() {
    if (!this.model || !this.canvas.isConnected) return;
    const dt = this.clock.getDelta();
    this.model.root.rotation.y += dt * 0.8;
    this.model.animate(dt, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
