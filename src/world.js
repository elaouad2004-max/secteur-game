// Builds a level's 3D mansion from its ASCII map and answers grid queries (collision, sight, paths).
import * as THREE from 'three';
import { CONFIG } from './state.js';
import { floorTex, wallTex, woodTex } from './textures.js';

const S = CONFIG.tile, WH = CONFIG.wallHeight;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TASK_COLOR = { lantern: 0xffa040, letter: 0xffe0a0, chest: 0xffc860, mirror: 0x9fd8ff, seal: 0xc070ff };

export class World {
  constructor(scene, level) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.taskType = level.task;
    this.g = []; this.tasks = []; this.keys = []; this.spawns = [];
    this.H = level.map.length; this.W = level.map[0].length;
    level.map.forEach((row, y) => {
      this.g[y] = [];
      for (let x = 0; x < this.W; x++) {
        const ch = row[x] || '#', p = this.center(x, y);
        if (ch === 'P') this.start = p;
        else if (ch === 'X') this.exit = p;
        else if (ch === 'T') this.tasks.push({ pos: p, done: false });
        else if (ch === 'K') this.keys.push({ pos: p, got: false });
        else if (ch === 'H') this.spawns.push(p);
        this.g[y][x] = ch === '#' || ch === 'o' ? ch : '.';
      }
    });
    this.build();
  }

  center(x, y) { return new THREE.Vector3(x * S + S / 2, 0, y * S + S / 2); }
  tile(v) { return Math.floor(v / S); }
  solid(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || this.g[y][x] !== '.'; }
  hit(x, z, r) {
    for (const [a, b] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (this.solid(this.tile(x + a), this.tile(z + b))) return true;
    return false;
  }
  /** move a position by (dx,dz) with wall sliding */
  move(p, dx, dz, r) {
    p.x += dx; if (this.hit(p.x, p.z, r)) p.x -= dx;
    p.z += dz; if (this.hit(p.x, p.z, r)) p.z -= dz;
  }
  los(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
      if (this.solid(this.tile(x), this.tile(z))) return false;
    }
    return true;
  }
  /** BFS shortest path between world positions -> list of tile centres */
  path(from, to) {
    const W = this.W, sx = this.tile(from.x), sy = this.tile(from.z), tx = this.tile(to.x), ty = this.tile(to.z);
    if (this.solid(tx, ty) || this.solid(sx, sy)) return null;
    const prev = new Int16Array(W * this.H).fill(-1), s = sy * W + sx, goal = ty * W + tx, q = [s];
    prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]; if (c === goal) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [a, b] of DIRS) {
        const nx = cx + a, ny = cy + b, n = ny * W + nx;
        if (!this.solid(nx, ny) && prev[n] < 0) { prev[n] = c; q.push(n); }
      }
    }
    if (prev[goal] < 0) return null;
    const out = [];
    for (let c = goal; c !== s; c = prev[c]) out.push(this.center(c % W, (c / W) | 0));
    return out.reverse();
  }
  randomFloor() {
    for (;;) { const x = (Math.random() * this.W) | 0, y = (Math.random() * this.H) | 0; if (!this.solid(x, y)) return this.center(x, y); }
  }

  build() {
    const G = this.group, W = this.W, H = this.H;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * S, H * S),
      new THREE.MeshStandardMaterial({ map: floorTex(W / 2, H / 2), roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set((W * S) / 2, 0, (H * S) / 2); floor.receiveShadow = true;
    G.add(floor);

    const walls = [], crates = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.g[y][x] === '#') walls.push([x, y]); else if (this.g[y][x] === 'o') crates.push([x, y]);
    }
    const m = new THREE.Matrix4();
    const side = new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.95 });
    const top = new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 1 });
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S, WH, S), [side, side, top, top, side, side], walls.length);
    walls.forEach(([x, y], i) => wallMesh.setMatrixAt(i, m.makeTranslation(x * S + S / 2, WH / 2, y * S + S / 2)));
    wallMesh.castShadow = wallMesh.receiveShadow = true; G.add(wallMesh);

    const crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S * 0.85, 1.1, S * 0.85), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.8 }), crates.length);
    crates.forEach(([x, y], i) => crateMesh.setMatrixAt(i, m.makeTranslation(x * S + S / 2, 0.55, y * S + S / 2)));
    crateMesh.castShadow = crateMesh.receiveShadow = true; G.add(crateMesh);

    const col = TASK_COLOR[this.taskType];
    for (const t of this.tasks) {
      const o = this.taskObject(col);
      o.position.copy(t.pos); G.add(o);
      const light = new THREE.PointLight(col, 0, 9, 1.6); light.position.set(t.pos.x, 1.6, t.pos.z); G.add(light);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xe9b44c, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(t.pos.x, 0.03, t.pos.z); G.add(ring);
      Object.assign(t, { obj: o, light, ring });
    }

    const gold = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.9, roughness: 0.25, emissive: 0x553300 });
    for (const k of this.keys) {
      const g = new THREE.Group();
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), gold); bow.position.x = -0.22;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.07), gold); shaft.position.x = 0.08;
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), gold); bit.position.set(0.26, -0.1, 0);
      g.add(bow, shaft, bit); g.position.copy(k.pos).setY(0.9); G.add(g); k.obj = g;
    }

    // exit door
    this.doorMat = new THREE.MeshStandardMaterial({ color: 0x5a2a12, emissive: 0x200000, roughness: 0.6 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.25), this.doorMat);
    door.position.copy(this.exit).setY(1.1); G.add(door);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7 }));
    arch.position.copy(this.exit).setY(2.2); G.add(arch);
    this.exitLight = new THREE.PointLight(0xff3020, 2, 6, 1.5); this.exitLight.position.copy(this.exit).setY(2.5); G.add(this.exitLight);
  }

  taskObject(col) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: woodTex() });
    const glow = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.15 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8), wood); ped.position.y = 0.4; g.add(ped);
    let top;
    switch (this.taskType) {
      case 'lantern': top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.5, 6), glow); break;
      case 'letter': top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.36), glow); break;
      case 'chest': top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), glow); break;
      case 'mirror': top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), glow); break;
      default: top = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.05, 48, 8), glow);
    }
    top.position.y = 1.05; g.add(top); g.userData.top = top; g.userData.glow = glow;
    return g;
  }

  complete(task) {
    task.done = true;
    task.light.intensity = 6;
    task.obj.userData.glow.emissiveIntensity = 2;
    task.ring.material.color.set(0x40d080);
  }

  openExit() { this.doorMat.color.set(0xe9b44c); this.doorMat.emissive.set(0x6a4a00); this.exitLight.color.set(0xffd060); this.exitLight.intensity = 8; }

  update(time) {
    for (const k of this.keys) if (!k.got) { k.obj.rotation.y = time * 2; k.obj.position.y = 0.9 + Math.sin(time * 3) * 0.1; }
    for (const t of this.tasks) { t.obj.userData.top.rotation.y = time; if (!t.done) t.ring.material.opacity = 0.35 + Math.sin(time * 4) * 0.25; }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }
}
