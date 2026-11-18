import * as THREE from 'three';

/** On-screen controls for phones: left joystick to move, drag anywhere else to look, buttons on the right. */
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function setupTouch(game) {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div id="stick"><div id="knob"></div></div>
    <button data-b="pause" class="tb small">II</button>
    <button data-b="view" class="tb small">👁</button>
    <button data-b="run" class="tb">🏃</button>
    <button data-b="use" class="tb">E</button>
    <button data-b="weapon" class="tb">⚡</button>`;
  document.body.appendChild(root);

  const stick = root.querySelector('#stick'), knob = root.querySelector('#knob');
  const R = 50;
  let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0;
  game.touchMove = { x: 0, y: 0 };

  stick.addEventListener('touchstart', (e) => {
    const tch = e.changedTouches[0]; stickId = tch.identifier;
    const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2;
    moveStick(tch); e.preventDefault();
  }, { passive: false });

  function moveStick(tch) {
    let dx = tch.clientX - sx, dy = tch.clientY - sy;
    const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    game.touchMove.x = dx / R; game.touchMove.y = -dy / R;
    game.keys.ShiftLeft = game.touchRun || l > R * 0.95; // push to the edge = run
  }
  function endStick() {
    stickId = null; knob.style.transform = ''; game.touchMove.x = game.touchMove.y = 0;
    game.keys.ShiftLeft = !!game.touchRun;
  }

  // look: drag on the canvas
  game.canvas.addEventListener('touchstart', (e) => {
    if (lookId !== null) return;
    const tch = e.changedTouches[0]; lookId = tch.identifier; lx = tch.clientX; ly = tch.clientY;
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    for (const tch of e.changedTouches) {
      if (tch.identifier === stickId) moveStick(tch);
      else if (tch.identifier === lookId && game.state === 'play') {
        game.yaw -= (tch.clientX - lx) * 0.006;
        game.pitch = THREE.MathUtils.clamp(game.pitch + (tch.clientY - ly) * 0.005, 0.25, 1.25);
        lx = tch.clientX; ly = tch.clientY;
      }
    }
    if (game.state === 'play') e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    for (const tch of e.changedTouches) {
      if (tch.identifier === stickId) endStick();
      if (tch.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);

  root.querySelectorAll('.tb').forEach((b) => b.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (game.state !== 'play') return;
    const a = b.dataset.b;
    if (a === 'use') game.wantInteract = true;
    if (a === 'weapon') game.useWeapon();
    if (a === 'pause') game.pause();
    if (a === 'view') game.setView(game.view === 'first' ? 'third' : 'first');
    if (a === 'run') { game.touchRun = !game.touchRun; b.classList.toggle('on', game.touchRun); game.keys.ShiftLeft = game.touchRun; }
  }, { passive: false }));
}
