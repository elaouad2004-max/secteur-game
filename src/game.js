// Core 3D game: renderer, camera, input, player, weapons and level flow.
import * as THREE from 'three';
import { P, save, t, hero, hasWeapon, LEVELS, CHARACTERS, CONFIG, WEAPONS } from './state.js';
import { World } from './world.js';
import { Housekeeper } from './housekeeper.js';
import { makeCharacter } from './character.js';
import { sfx } from './audio.js';

const PL = CONFIG.player;

export class Game {
  constructor(canvas, ui) {
    this.ui = ui;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07060a);
    this.scene.fog = new THREE.FogExp2(0x07060a, 0.03);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

    this.hemi = new THREE.HemisphereLight(0x8090c0, 0x3a2a18, 1.1);
    this.scene.add(this.hemi);
    this.flash = new THREE.SpotLight(0xffe2b0, 90, 24, 0.75, 0.5, 1.3);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.flash, this.flash.target);
    this.aura = new THREE.PointLight(0xffc890, 10, 9, 1.4);
    this.scene.add(this.aura);

    this.keys = {};
    this.yaw = Math.PI; this.pitch = 0.75;
    this.state = 'idle';
    this.clock = new THREE.Clock();
    this.fx = [];

    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => (this.keys = {}));
    canvas.addEventListener('click', () => { if (this.state === 'play') canvas.requestPointerLock?.(); });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas || this.state !== 'play') return;
      this.yaw -= e.movementX * 0.0035;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.003, 0.25, 1.25);
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'play' && this.lockedOnce) this.pause();
      if (document.pointerLockElement) this.lockedOnce = true;
    });

    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onKey(e, down) {
    this.keys[e.code] = down;
    if (!down || this.state !== 'play') return;
    if (e.code.startsWith('Arrow')) e.preventDefault();
    if (e.code === 'KeyE') this.wantInteract = true;
    if (e.code === 'Space') { e.preventDefault(); this.useWeapon(); }
    if (e.code === 'Escape' || e.code === 'KeyP') this.pause();
  }

  // ---------------- level lifecycle ----------------
  start(index) {
    this.clear();
    this.level = index;
    this.def = LEVELS[index];
    this.world = new World(this.scene, this.def, index);
    const th = this.world.theme;
    this.scene.fog.color.set(th.fog); this.scene.background.set(th.fog);
    const me = hero();
    this.player = {
      pos: this.world.start.clone(), yaw: 0, invisible: 0, dash: 0, grace: 1.5,
      model: makeCharacter({ photo: me.photo, color: P.color, hat: P.hat, name: P.nick }),
    };
    this.scene.add(this.player.model.root);
    const evil = CHARACTERS.filter((c) => c.id !== P.char);
    this.enemies = this.world.spawns.map((s, i) => new Housekeeper(this.scene, this.world, s, evil[(i + index * 2) % evil.length], index));
    this.tokens = 0; this.keysGot = 0; this.lives = PL.lives; this.cooldown = 0; this.cleared = false;
    this.projectiles = [];
    this.yaw = -Math.PI * 0.75; // camera behind the start corner, looking into the map
    this.hemi.intensity = 0.7; this.scene.fog.density = 0.03; this.danger = 0;
    sfx.levelStart();
    this.state = 'play';
    this.keys = {};
    this.lockedOnce = false;
    this.snap = true;
    this.ui.hud(true);
  }

  clear() {
    if (!this.world) return;
    this.world.dispose();
    this.enemies.forEach((e) => e.dispose(this.scene));
    this.scene.remove(this.player.model.root); this.player.model.dispose();
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.fx.forEach((f) => this.scene.remove(f.mesh));
    this.fx = []; this.world = null;
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; this.keys = {};
    document.exitPointerLock?.();
    this.ui.showPause();
  }
  resume() { this.state = 'play'; this.keys = {}; this.lockedOnce = false; this.ui.hud(true); }
  quit() { this.clear(); this.state = 'idle'; document.exitPointerLock?.(); sfx.setDanger(0); this.ui.scare(null); }

  // ---------------- gameplay ----------------
  /** Jumpscare: camera snaps to the housekeeper's face, then a full-screen scare, then respawn. */
  caught(enemy) {
    this.lives--; sfx.caught();
    this.state = 'scare'; this.scareT = 0; this.scareEnemy = enemy; this.scareShown = false;
    enemy.yaw = Math.atan2(this.player.pos.x - enemy.pos.x, this.player.pos.z - enemy.pos.z);
    enemy.sync(0, 0);
    this.ui.hud(false); this.ui.danger(1);
  }

  updateScare(dt) {
    this.scareT += dt;
    if (this.scareT > 0.35 && !this.scareShown) { this.scareShown = true; this.ui.scare(this.scareEnemy.char.photo); }
    if (this.scareT < 1.7) return;
    this.ui.scare(null);
    if (this.lives <= 0) { this.state = 'over'; document.exitPointerLock?.(); this.ui.showFail(this.level); return; }
    this.state = 'play'; this.ui.hud(true);
    this.ui.toast(t('caught'));
    this.player.pos.copy(this.world.start); this.player.grace = 2.5; this.player.dash = 0;
    this.enemies.forEach((e) => e.reset());
    this.snap = true;
  }

  useWeapon() {
    if (!hasWeapon() || this.cooldown > 0) return;
    const type = hero().weapon, cfg = WEAPONS.types[type], p = this.player;
    this.cooldown = cfg.cooldown; sfx.weapon();
    const dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    if (type === 'shot') {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0xe3b340, emissive: 0x443000 }));
      mesh.position.copy(p.pos).setY(1.2); this.scene.add(mesh);
      this.projectiles.push({ mesh, vel: dir.multiplyScalar(cfg.speed), life: cfg.range, stun: cfg.stun });
    } else if (type === 'freeze') {
      this.addFx('ring', p.pos, 0x8fe3ff, cfg.radius);
      this.enemies.forEach((e) => { if (!e.dead && e.pos.distanceTo(p.pos) < cfg.radius) e.stunFor(cfg.stun); });
    } else if (type === 'smoke') {
      p.invisible = cfg.invisible; this.addFx('smoke', p.pos, 0x888888, 2.5);
    } else {
      p.dash = cfg.duration;
    }
  }

  addFx(kind, pos, color, size) {
    const geo = kind === 'ring' ? new THREE.RingGeometry(0.8, 1, 48) : new THREE.SphereGeometry(1, 12, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    if (kind === 'ring') mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(pos).setY(kind === 'ring' ? 0.2 : 1);
    this.scene.add(mesh);
    this.fx.push({ mesh, t: 0, size });
  }

  update(dt, time) {
    const p = this.player, w = this.world, k = this.keys;
    this.cooldown = Math.max(0, this.cooldown - dt);
    p.invisible = Math.max(0, p.invisible - dt); p.dash = Math.max(0, p.dash - dt); p.grace = Math.max(0, p.grace - dt);

    // camera-relative movement
    // movement on the arrow keys (camera follows the mouse)
    const f = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0);
    const s = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
    let speed = 0;
    if (f || s) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // forward = away from camera
      let mx = fx * f - fz * s, mz = fz * f + fx * s;
      const l = Math.hypot(mx, mz); mx /= l; mz /= l;
      speed = PL.speed * (k.ShiftLeft || k.ShiftRight ? 1.45 : 1) * (p.dash > 0 ? WEAPONS.types.dash.speedMul : 1);
      w.move(p.pos, mx * speed * dt, mz * speed * dt, PL.radius);
      p.yaw += Math.atan2(Math.sin(Math.atan2(mx, mz) - p.yaw), Math.cos(Math.atan2(mx, mz) - p.yaw)) * Math.min(1, dt * 12);
    }
    const m = p.model;
    m.root.position.copy(p.pos); m.root.rotation.y = p.yaw; m.animate(dt, speed);
    m.root.visible = !(p.grace > 0 && Math.floor(time * 8) % 2);
    m.setOpacity(p.invisible > 0 ? 0.3 : 1);

    // keys
    for (const key of w.keys) if (!key.got && key.pos.distanceTo(p.pos) < 0.9) {
      key.got = true; key.obj.visible = false; this.keysGot++; sfx.key(); this.ui.toast(t('key'));
    }
    // tasks
    const near = w.tasks.find((q) => !q.done && q.pos.distanceTo(p.pos) < 1.6);
    this.ui.prompt(near ? '[E] ' + t('task')[w.taskType] : '');
    if (this.wantInteract) {
      this.wantInteract = false;
      if (near) this.completeTask(near);
    }
    // exit
    if (this.tokens === w.tasks.length && p.pos.distanceTo(w.exit) < 1.1) return this.finish();

    // projectiles
    this.projectiles = this.projectiles.filter((b) => {
      b.mesh.position.addScaledVector(b.vel, dt); b.mesh.rotation.y += dt * 15; b.life -= dt;
      const bp = b.mesh.position;
      const hitE = this.enemies.find((e) => !e.dead && Math.hypot(e.pos.x - bp.x, e.pos.z - bp.z) < 0.7);
      if (hitE) { hitE.stunFor(b.stun); sfx.hit(); }
      if (hitE || b.life < 0 || w.solid(w.tile(bp.x), w.tile(bp.z))) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); return false; }
      return true;
    });
    // effects
    this.fx = this.fx.filter((e) => {
      e.t += dt; const sc = 0.3 + e.t * e.size; e.mesh.scale.setScalar(sc); e.mesh.material.opacity = 0.8 * (1 - e.t);
      if (e.t >= 1) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); return false; }
      return true;
    });

    // housekeepers
    let danger = 0;
    for (const e of this.enemies) {
      const close = e.update(dt, p);
      if (e.spotted) sfx.spotted();
      if (close && p.grace <= 0) {
        if (p.dash > 0) e.stunFor(WEAPONS.types.dash.stun);
        else if (p.invisible <= 0) { this.caught(e); return; }
      }
      if (!e.dead && e.stun <= 0) danger = Math.max(danger, e.state === 'chase' ? 1 : Math.max(0, 1 - e.pos.distanceTo(p.pos) / 9) * 0.55);
    }
    this.danger += (danger - this.danger) * Math.min(1, dt * 3);
    sfx.setDanger(this.danger); this.ui.danger(this.danger);
    w.update(time);
    this.ui.updateHud(this);
    this.ui.minimap(this);
  }

  completeTask(task) {
    const had = hasWeapon(), w = this.world;
    w.complete(task); this.tokens++;
    P.tasks[this.level] = Math.max(P.tasks[this.level], this.tokens); save();
    sfx.task(); this.ui.toast(t('task')[w.taskType] + '  ' + t('taskDone'));
    if (!had && hasWeapon()) setTimeout(() => this.ui.toast(t('unlockW') + t('w')[hero().weapon]), 1800);
    if (this.tokens === w.tasks.length) {
      w.openExit();
      if (this.def.final) {
        this.cleared = true;
        this.enemies.forEach((e) => e.kill());
        this.hemi.intensity = 2.5; this.scene.fog.density = 0.012;
        sfx.ending();
        setTimeout(() => this.ui.toast(t('dead')), 400);
      } else setTimeout(() => this.ui.toast(t('exitOpen')), 1800);
    }
  }

  finish() {
    this.state = 'done';
    document.exitPointerLock?.();
    P.done[this.level] = true;
    P.keys[this.level] = Math.max(P.keys[this.level], this.keysGot);
    save(); sfx.win(); sfx.setDanger(0);
    this.ui.hud(false);
    if (this.def.final) this.ui.showEnding(); else this.ui.showResult(this.level, this.keysGot);
  }

  // ---------------- render loop ----------------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), time = this.clock.elapsedTime;
    if (this.world) {
      if (this.state === 'play') this.update(dt, time);
      if (this.state === 'scare') {
        this.world.update(time);
        const e = this.scareEnemy, head = e.model.head.getWorldPosition(new THREE.Vector3());
        const fwd = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
        const shake = () => (Math.random() - 0.5) * 0.12;
        this.camera.position.copy(head).addScaledVector(fwd, 1.5).add(new THREE.Vector3(shake(), shake() - 0.1, shake()));
        this.camera.lookAt(head);
        // red under-lighting, horror style
        this.flash.color.set(0xff2a10); this.flash.intensity = 14;
        this.flash.position.copy(head).addScaledVector(fwd, 0.9).add(new THREE.Vector3(0, -1, 0)); this.flash.target.position.copy(head);
        this.aura.intensity = 0;
        this.camera.fov = 60 - Math.min(1, this.scareT * 4) * 15; this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);
        this.updateScare(dt);
        if (this.state !== 'scare') {
          this.camera.fov = 60; this.camera.updateProjectionMatrix();
          this.flash.color.set(0xffe2b0); this.flash.intensity = 90; this.aura.intensity = 10;
        }
        return;
      }
      const p = this.player.pos, w = this.world;
      const target = new THREE.Vector3(p.x, 1.4, p.z);
      // camera collision: if a wall blocks the view, raise the camera over it
      const dist = 8, dir = new THREE.Vector3();
      for (let pitch = this.pitch; pitch <= 1.5; pitch += 0.05) {
        dir.set(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
        let blocked = false;
        for (let d = 0.5; d <= dist && !blocked; d += 0.25) {
          const q = target.clone().addScaledVector(dir, d);
          blocked = q.y < CONFIG.wallHeight + 1.0 && w.solid(w.tile(q.x), w.tile(q.z));
        }
        if (!blocked) break;
      }
      const want = target.clone().addScaledVector(dir, dist);
      if (this.snap) { this.camera.position.copy(want); this.snap = false; }
      else this.camera.position.lerp(want, Math.min(1, dt * 6));
      this.camera.lookAt(target);
      const py = this.player.yaw;
      this.flash.position.set(p.x, 1.7, p.z);
      this.flash.target.position.set(p.x + Math.sin(py) * 6, 0.3, p.z + Math.cos(py) * 6);
      this.aura.position.set(p.x, 2.2, p.z);
    } else {
      // idle: slow orbit nowhere (menus cover the screen)
      this.camera.position.set(0, 5, 10); this.camera.lookAt(0, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
