// Builds a level's 3D mansion from its ASCII map + theme, and answers grid queries
// (collision, line of sight, pathfinding). Adds life: themed furniture, flickering wall
// lanterns, rugs, pots, candles, moonlight and floating dust / fireflies.
import * as THREE from 'three';
import { CONFIG } from './state.js';
import THEMES from './data/themes.json';
import { floorTex, wallTex, woodTex, booksTex, carpetTex, glowTex } from './textures.js';

const S = CONFIG.tile, WH = CONFIG.wallHeight;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TASK_COLOR = { lantern: 0xffa040, letter: 0xffe0a0, chest: 0xffc860, mirror: 0x9fd8ff, seal: 0xc070ff };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export class World {
  constructor(scene, level, index = 0) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.theme = THEMES[level.theme] || THEMES.hall;
    this.taskType = level.task;
    this.rand = rng(index * 977 + 13);
    this.g = []; this.tasks = []; this.keys = []; this.spawns = []; this.special = new Set();
    this.flicker = []; this.H = level.map.length; this.W = level.map[0].length;
    level.map.forEach((row, y) => {
      this.g[y] = [];
      for (let x = 0; x < this.W; x++) {
        const ch = row[x] || '#', p = this.center(x, y);
        if ('PXTKH'.includes(ch)) this.special.add(y * this.W + x);
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
  wall(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || this.g[y][x] === '#'; }
  free(x, y) { return !this.solid(x, y) && !this.special.has(y * this.W + x); }
  hit(x, z, r) {
    for (const [a, b] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (this.solid(this.tile(x + a), this.tile(z + b))) return true;
    return false;
  }
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

  // ---------------- construction ----------------
  build() {
    const G = this.group, W = this.W, H = this.H, th = this.theme;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * S, H * S), std(0xffffff, { map: floorTex(th.floor, th.palette, W / 2, H / 2), roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set((W * S) / 2, 0, (H * S) / 2); floor.receiveShadow = true;
    G.add(floor);

    // walls (instanced) with a carved top trim
    const walls = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.g[y][x] === '#') walls.push([x, y]);
    const side = std(0xffffff, { map: wallTex(th.wall, th.palette), roughness: 0.95 });
    const top = std(th.wall === 'stone' ? 0x2a2620 : 0x3a2a1c, { roughness: 1 });
    const m4 = new THREE.Matrix4();
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S, WH, S), [side, side, top, top, side, side], walls.length);
    walls.forEach(([x, y], i) => wallMesh.setMatrixAt(i, m4.makeTranslation(x * S + S / 2, WH / 2, y * S + S / 2)));
    wallMesh.castShadow = wallMesh.receiveShadow = true; G.add(wallMesh);
    const trim = new THREE.InstancedMesh(new THREE.BoxGeometry(S * 1.04, 0.14, S * 1.04), std(th.wall === 'stone' ? 0x3a352c : 0x8a7050), walls.length);
    walls.forEach(([x, y], i) => trim.setMatrixAt(i, m4.makeTranslation(x * S + S / 2, WH + 0.07, y * S + S / 2)));
    G.add(trim);
    if (th.wall === 'stone') { // crenellations for garden walls
      const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), top, walls.length);
      walls.forEach(([x, y], i) => cren.setMatrixAt(i, m4.makeTranslation(x * S + S / 2, WH + 0.3, y * S + S / 2)));
      G.add(cren);
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.g[y][x] === 'o') {
      const f = this.furniture(th.furniture, x, y); f.position.copy(this.center(x, y)); G.add(f);
    }
    this.decorate();
    this.buildTasks();
    this.buildKeys();
    this.buildExit();
    this.buildLights();
    this.buildParticles();
  }

  furniture(kind, x, y) {
    const g = new THREE.Group(), r = this.rand();
    const wood = std(0xffffff, { map: woodTex(r > 0.5 ? '#5a3a20' : '#6b4a2b') });
    switch (kind) {
      case 'bush':
        if (r < 0.4) { // tree
          g.add(mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 7), std(0x3a2615), 0, 0.9, 0));
          for (let i = 0; i < 4; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.55 + this.rand() * 0.3, 0), std(0x1c3a18, { flatShading: true }), (this.rand() - 0.5) * 0.7, 2 + this.rand() * 0.6, (this.rand() - 0.5) * 0.7));
        } else {
          for (let i = 0; i < 5; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.4 + this.rand() * 0.25, 0), std(i % 2 ? 0x22441c : 0x2c5222, { flatShading: true }), (this.rand() - 0.5) * 1.1, 0.35 + this.rand() * 0.3, (this.rand() - 0.5) * 1.1));
          for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), std(0xb03050, { emissive: 0x200008 }), (this.rand() - 0.5) * 1.2, 0.7 + this.rand() * 0.2, (this.rand() - 0.5) * 1.2));
        }
        break;
      case 'cabinet':
        g.add(mesh(new THREE.BoxGeometry(1.6, 1.3, 0.9), wood, 0, 0.65, 0));
        for (const yy of [0.35, 0.75, 1.1]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), std(0xc9a227, { metalness: 0.8 }), 0, yy, 0.47));
        g.add(this.vase(0.25, 1.3 + 0.0, 0)); g.children.at(-1).position.set(-0.4, 1.3, 0);
        g.add(this.candle(0.4, 1.3, 0.1));
        break;
      case 'table': {
        g.add(mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 20), wood, 0, 0.8, 0));
        for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), wood, a, 0.4, b));
        const clay = std(0x8a3a1a);
        g.add(mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.06, 16), clay, -0.2, 0.87, 0));
        g.add(mesh(new THREE.ConeGeometry(0.3, 0.45, 16), clay, -0.2, 1.12, 0)); // tagine
        const pot = std(0xc0c0c0, { metalness: 0.9, roughness: 0.25 });
        g.add(mesh(new THREE.SphereGeometry(0.15, 12, 10), pot, 0.35, 0.98, 0.15)); // teapot
        const sp = mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.22, 6), pot, 0.5, 1.02, 0.15); sp.rotation.z = -0.9; g.add(sp);
        for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 8), std(0x3aa070, { transparent: true, opacity: 0.7 }), 0.2 + i * 0.12, 0.89, -0.3));
        break;
      }
      case 'shelf': {
        const books = std(0xffffff, { map: booksTex() });
        g.add(mesh(new THREE.BoxGeometry(1.8, 2.3, 0.7), [wood, wood, wood, wood, books, books], 0, 1.15, 0));
        if (r > 0.5) g.add(this.candle(0, 2.3, 0));
        break;
      }
      case 'planter': {
        const tile = std(0xffffff, { map: floorTex('zellige', this.theme.palette, 1, 0.4) });
        g.add(mesh(new THREE.BoxGeometry(1.7, 0.55, 1.7), tile, 0, 0.27, 0));
        g.add(mesh(new THREE.BoxGeometry(1.5, 0.05, 1.5), std(0x2a1a0e), 0, 0.56, 0));
        if (r > 0.3) { // palm
          const trunk = mesh(new THREE.CylinderGeometry(0.07, 0.12, 2.2, 7), std(0x5a4025), 0, 1.65, 0); trunk.rotation.z = (this.rand() - 0.5) * 0.2; g.add(trunk);
          for (let i = 0; i < 7; i++) {
            const leaf = mesh(new THREE.ConeGeometry(0.15, 1.3, 4), std(0x2a5a22, { flatShading: true }), 0, 2.7, 0);
            leaf.rotation.set(1.1, (i / 7) * Math.PI * 2, 0, 'YXZ'); leaf.translateY(0.55); g.add(leaf);
          }
        } else for (let i = 0; i < 4; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.3, 0), std(0x2c5222, { flatShading: true }), (this.rand() - 0.5) * 0.9, 0.8, (this.rand() - 0.5) * 0.9));
        break;
      }
      default: { // wardrobe / bed in the master room
        const dark = std(0xffffff, { map: woodTex('#3a2010') });
        if (r > 0.5) {
          g.add(mesh(new THREE.BoxGeometry(1.5, 2.3, 0.8), dark, 0, 1.15, 0));
          for (const xx of [-0.08, 0.08]) g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0xc9a227, { metalness: 0.9 }), xx, 1.2, 0.42));
        } else {
          g.add(mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), dark, 0, 0.25, 0));
          g.add(mesh(new THREE.BoxGeometry(1.6, 0.18, 1.6), std(0x6a1020), 0, 0.58, 0));
          for (const [a, b] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), dark, a, 1, b));
          const veil = mesh(new THREE.BoxGeometry(1.7, 0.05, 1.7), std(0xd8c8b0, { transparent: true, opacity: 0.35 }), 0, 2, 0); g.add(veil);
        }
      }
    }
    g.rotation.y = Math.floor(r * 4) * (Math.PI / 2) * (kind === 'shelf' || kind === 'cabinet' || kind === 'default' ? 0 : 1);
    return g;
  }

  vase(scale, y, z) {
    const pts = [[0, 0], [0.5, 0.05], [0.8, 0.4], [0.7, 0.9], [0.35, 1.2], [0.4, 1.45], [0.5, 1.5]].map(([a, b]) => new THREE.Vector2(a * scale, b * scale));
    return mesh(new THREE.LatheGeometry(pts, 14), std(this.rand() > 0.5 ? 0x9a4a22 : 0x1d4a6a, { roughness: 0.6 }), 0, y, z);
  }

  candle(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    for (let i = 0; i < 3; i++) {
      const h = 0.15 + this.rand() * 0.15, ox = (i - 1) * 0.08;
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 8), std(0xe8dcc0), ox, h / 2, 0));
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      fl.scale.set(0.08, 0.14, 1); fl.position.set(ox, h + 0.06, 0); g.add(fl);
      this.flicker.push({ sprite: fl, base: 0.14, ph: this.rand() * 10 });
    }
    return g;
  }

  lantern() { // Moroccan hanging lantern
    const g = new THREE.Group();
    const metal = std(0x3a2a14, { metalness: 0.7, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8020, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 });
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.32, 8), glass, 0, 0, 0));
    g.add(mesh(new THREE.ConeGeometry(0.17, 0.2, 8), metal, 0, 0.26, 0));
    g.add(mesh(new THREE.SphereGeometry(0.04, 6, 6), metal, 0, 0.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8), metal, 0, -0.2, 0));
    g.userData.glass = glass;
    return g;
  }

  decorate() {
    const G = this.group, th = this.theme, W = this.W, H = this.H, R = this.rand;
    const wallSpots = [], corners = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!this.free(x, y)) continue;
      const adj = DIRS.filter(([a, b]) => this.wall(x + a, y + b));
      if (adj.length) wallSpots.push({ x, y, d: adj[(R() * adj.length) | 0] });
      if (adj.length >= 2 && adj.some(([a]) => a) && adj.some(([, b]) => b)) corners.push({ x, y });
    }
    // wall lanterns: spaced apart, the first few cast real (flickering) light
    const chosen = [];
    for (const s of wallSpots.sort(() => R() - 0.5)) {
      if (chosen.length >= 12) break;
      if (chosen.every((c) => Math.abs(c.x - s.x) + Math.abs(c.y - s.y) > 5)) chosen.push(s);
    }
    chosen.forEach((s, i) => {
      const p = this.center(s.x, s.y), [a, b] = s.d;
      const l = this.lantern(); l.position.set(p.x + a * 0.82, 1.9, p.z + b * 0.82); G.add(l);
      const arm = mesh(new THREE.BoxGeometry(0.04, 0.04, 0.25), std(0x2a1a0a), p.x + a * 0.92, 2.28, p.z + b * 0.92);
      arm.rotation.y = Math.atan2(a, b); G.add(arm);
      const light = i < 6 ? new THREE.PointLight(0xff9a40, 5, 9, 1.6) : null;
      if (light) { light.position.set(p.x + a * 0.6, 1.9, p.z + b * 0.6); G.add(light); }
      this.flicker.push({ light, glass: l.userData.glass, base: 5, ph: R() * 10 });
    });
    // pots, vases and candles in corners
    corners.sort(() => R() - 0.5).slice(0, 10).forEach((c, i) => {
      const p = this.center(c.x, c.y);
      const off = DIRS.filter(([a, b]) => this.wall(c.x + a, c.y + b)).reduce((v, [a, b]) => v.add(new THREE.Vector3(a, 0, b)), new THREE.Vector3()).multiplyScalar(0.55);
      const obj = i % 3 === 2 ? this.candle(0, 0, 0) : this.vase(0.45 + R() * 0.25, 0, 0);
      obj.position.add(p).add(off); G.add(obj);
    });
    // rugs in open areas
    if (th.rugs) {
      let n = 0;
      for (const s of [...wallSpots].sort(() => R() - 0.5)) {
        if (n >= 4) break;
        const horiz = R() > 0.5, x2 = s.x + (horiz ? 1 : 0), y2 = s.y + (horiz ? 0 : 1);
        if (!this.free(x2, y2) || this.special.has(s.y * W + s.x)) continue;
        const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.4), std(0xffffff, { map: carpetTex(R() > 0.5 ? 355 : 210), roughness: 1 }));
        rug.rotation.x = -Math.PI / 2; rug.rotation.z = horiz ? Math.PI / 2 : 0;
        const p = this.center(s.x, s.y).lerp(this.center(x2, y2), 0.5); rug.position.set(p.x, 0.015, p.z); rug.receiveShadow = true;
        G.add(rug); n++;
      }
    }
    // garden: moon in the sky
    if (th.floor === 'grass' || th.moon > 1) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdde6ff, fog: false }));
      moon.position.set(W * S * 0.8, 40, -30); G.add(moon);
    }
  }

  buildTasks() {
    const col = TASK_COLOR[this.taskType];
    for (const t of this.tasks) {
      const o = this.taskObject(col);
      o.position.copy(t.pos); this.group.add(o);
      const light = new THREE.PointLight(col, 1.2, 6, 1.6); light.position.set(t.pos.x, 1.6, t.pos.z); this.group.add(light);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xe9b44c, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(t.pos.x, 0.03, t.pos.z); this.group.add(ring);
      Object.assign(t, { obj: o, light, ring });
    }
  }

  taskObject(col) {
    const g = new THREE.Group();
    const glow = std(col, { emissive: col, emissiveIntensity: 0.25 });
    const ped = mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8), std(0xffffff, { map: woodTex() }), 0, 0.4, 0); g.add(ped);
    let top;
    switch (this.taskType) {
      case 'lantern': top = this.lantern(); top.userData.glass.emissiveIntensity = 0.1; top.scale.setScalar(1.4); break;
      case 'letter': top = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.36), glow); break;
      case 'chest': top = mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), glow); break;
      case 'mirror': top = mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), std(0x9fd8ff, { metalness: 1, roughness: 0.05, emissive: col, emissiveIntensity: 0.2 })); break;
      default: top = mesh(new THREE.TorusKnotGeometry(0.18, 0.05, 64, 8), glow);
    }
    top.position.y = 1.1; g.add(top); g.userData.top = top; g.userData.glow = top.userData.glass || top.material;
    return g;
  }

  buildKeys() {
    const gold = std(0xffd54a, { metalness: 0.9, roughness: 0.25, emissive: 0x6a4400 });
    for (const k of this.keys) {
      const g = new THREE.Group();
      g.add(mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), gold, -0.22, 0, 0));
      g.add(mesh(new THREE.BoxGeometry(0.45, 0.07, 0.07), gold, 0.08, 0, 0));
      g.add(mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), gold, 0.26, -0.1, 0));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd060, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.setScalar(1.1); g.add(sp);
      g.position.copy(k.pos).setY(0.9); this.group.add(g); k.obj = g;
    }
  }

  buildExit() {
    this.doorMat = std(0x5a2a12, { emissive: 0x200000, roughness: 0.6 });
    const e = this.exit;
    this.group.add(mesh(new THREE.BoxGeometry(1.3, 2.2, 0.25), this.doorMat, e.x, 1.1, e.z));
    const arch = mesh(new THREE.TorusGeometry(0.65, 0.09, 8, 24, Math.PI), std(0xc9a227, { metalness: 0.7 }), e.x, 2.2, e.z);
    this.group.add(arch);
    for (const sd of [-1, 1]) this.group.add(mesh(new THREE.BoxGeometry(0.18, 2.2, 0.3), std(0xc9a227, { metalness: 0.7 }), e.x + sd * 0.74, 1.1, e.z));
    this.exitLight = new THREE.PointLight(0xff3020, 3, 7, 1.5); this.exitLight.position.set(e.x, 2.5, e.z + 0.5); this.group.add(this.exitLight);
  }

  buildLights() {
    const th = this.theme, W = this.W * S, H = this.H * S;
    const moon = new THREE.DirectionalLight(0x8aa0ff, th.moon);
    moon.position.set(W * 0.3, 30, -10); moon.target.position.set(W / 2, 0, H / 2);
    moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 80 });
    moon.shadow.bias = -0.0005;
    this.group.add(moon, moon.target);
  }

  buildParticles() {
    const ff = this.theme.particles === 'fireflies', n = ff ? 70 : 350;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * this.W * S; pos[i * 3 + 1] = 0.2 + Math.random() * 2.6; pos[i * 3 + 2] = Math.random() * this.H * S; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: ff ? 0xc8ff60 : 0xffe0b0, size: ff ? 0.14 : 0.05, transparent: true, opacity: ff ? 0.9 : 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.particles.userData.base = pos.slice(); this.particles.userData.ff = ff;
    this.group.add(this.particles);
  }

  complete(task) {
    task.done = true;
    task.light.intensity = 7; task.light.distance = 10;
    const gm = task.obj.userData.glow; if (gm) gm.emissiveIntensity = 2;
    task.ring.material.color.set(0x40d080);
  }

  openExit() { this.doorMat.color.set(0xe9b44c); this.doorMat.emissive.set(0x6a4a00); this.exitLight.color.set(0xffd060); this.exitLight.intensity = 10; }

  update(time) {
    for (const k of this.keys) if (!k.got) { k.obj.rotation.y = time * 2; k.obj.position.y = 0.9 + Math.sin(time * 3) * 0.1; }
    for (const t of this.tasks) { t.obj.userData.top.rotation.y = time; if (!t.done) t.ring.material.opacity = 0.35 + Math.sin(time * 4) * 0.25; }
    for (const f of this.flicker) {
      const k = 0.8 + Math.sin(time * 11 + f.ph) * 0.1 + Math.sin(time * 23 + f.ph * 2) * 0.07 + (Math.random() < 0.01 ? -0.4 : 0);
      if (f.light) f.light.intensity = f.base * k;
      if (f.glass) f.glass.emissiveIntensity = 1.6 * k;
      if (f.sprite) f.sprite.scale.y = f.base * k;
    }
    const p = this.particles, a = p.geometry.attributes.position, b = p.userData.base, amp = p.userData.ff ? 0.8 : 0.3;
    for (let i = 0; i < a.count; i++) {
      a.array[i * 3] = b[i * 3] + Math.sin(time * 0.3 + i) * amp;
      a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(time * 0.5 + i * 1.7) * amp * 0.5;
      a.array[i * 3 + 2] = b[i * 3 + 2] + Math.cos(time * 0.25 + i * 0.7) * amp;
    }
    a.needsUpdate = true;
    if (p.userData.ff) p.material.opacity = 0.6 + Math.sin(time * 3) * 0.3;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }
}
