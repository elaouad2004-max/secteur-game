// Housekeeper AI: patrol -> chase on sight -> search last seen spot -> patrol.
import * as THREE from 'three';
import { CONFIG } from './state.js';
import { makeCharacter } from './character.js';

const HK = CONFIG.housekeeper;
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Housekeeper {
  constructor(scene, world, spawn, char, levelIndex) {
    this.world = world;
    this.spawn = spawn.clone();
    this.pos = spawn.clone();
    this.yaw = 0;
    this.state = 'patrol';
    this.path = null; this.repath = 0; this.lost = 0; this.stun = 0;
    this.dead = false; this.deadT = 0;
    this.speedMul = 1 + levelIndex * HK.levelSpeedBonus;
    this.model = makeCharacter({ photo: char.photo, color: char.color, evil: true });
    scene.add(this.model.root);

    // visible vision cone on the floor
    const geo = new THREE.CircleGeometry(HK.viewRange, 24, -Math.PI / 2 - HK.viewAngle, HK.viewAngle * 2);
    geo.rotateX(-Math.PI / 2);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.12, depthWrite: false });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.position.y = 0.04;
    this.model.root.add(this.cone);
    this.alert = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    this.alert.rotation.x = Math.PI; this.alert.position.y = 2.6; this.alert.visible = false;
    this.model.root.add(this.alert);
    this.stars = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 16), new THREE.MeshBasicMaterial({ color: 0x9ad0ff }));
    this.stars.rotation.x = Math.PI / 2; this.stars.position.y = 2.3; this.stars.visible = false;
    this.model.root.add(this.stars);
    this.sync(0, 0);
  }

  reset() { this.pos.copy(this.spawn); this.state = 'patrol'; this.path = null; this.stun = 1; }
  stunFor(s) { this.stun = s; this.state = 'patrol'; this.path = null; }
  kill() { this.dead = true; this.cone.visible = false; this.alert.visible = false; }

  /** returns true if the player got caught */
  update(dt, player) {
    if (this.dead) {
      this.deadT += dt;
      const k = Math.max(0, 1 - this.deadT / 1.6);
      this.model.root.scale.setScalar(Math.max(0.01, k));
      this.model.root.rotation.y += dt * 10;
      this.model.setOpacity(k);
      this.model.root.visible = k > 0;
      return false;
    }
    this.stars.visible = this.stun > 0;
    if (this.stun > 0) { this.stun -= dt; this.stars.rotation.z += dt * 5; this.cone.visible = false; this.sync(0, dt); return false; }
    this.cone.visible = true;

    const p = player.pos, w = this.world;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    const ang = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    const sees = player.invisible <= 0 && d < HK.viewRange &&
      (d < 1.6 || Math.abs(norm(ang - this.yaw)) < HK.viewAngle) && w.los(this.pos, p);

    let spotted = false;
    if (sees) { if (this.state !== 'chase') spotted = true; this.state = 'chase'; this.last = p.clone(); this.lost = 0; }
    this.repath -= dt;
    if (this.state === 'chase') {
      if (!sees && (this.lost += dt) > HK.loseSightAfter) { this.state = 'patrol'; this.path = null; }
      if (this.repath <= 0) { this.repath = 0.3; this.path = w.path(this.pos, this.last); }
    } else if (!this.path || !this.path.length) {
      this.path = w.path(this.pos, w.randomFloor());
    }

    const speed = (this.state === 'chase' ? HK.chaseSpeed : HK.patrolSpeed) * this.speedMul;
    let moved = 0;
    if (this.path && this.path.length) {
      const n = this.path[0], ax = n.x - this.pos.x, az = n.z - this.pos.z, l = Math.hypot(ax, az);
      if (l < 0.1) this.path.shift();
      else {
        const s = Math.min(l, speed * dt);
        this.pos.x += (ax / l) * s; this.pos.z += (az / l) * s; moved = speed;
        this.yaw += norm(Math.atan2(ax, az) - this.yaw) * Math.min(1, dt * 7);
      }
    } else if (sees && d > 0.01) {
      w.move(this.pos, ((p.x - this.pos.x) / d) * speed * dt, ((p.z - this.pos.z) / d) * speed * dt, 0.35);
      this.yaw = ang; moved = speed;
    }
    this.alert.visible = this.state === 'chase';
    this.coneMat.opacity = this.state === 'chase' ? 0.25 : 0.12;
    this.sync(moved, dt);
    this.spotted = spotted;
    return d < HK.catchDistance;
  }

  sync(speed, dt) {
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.yaw;
    this.model.animate(dt, speed);
  }

  dispose(scene) {
    scene.remove(this.model.root);
    this.model.root.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); });
  }
}
