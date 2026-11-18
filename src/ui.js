// Menus, HUD and minimap (DOM overlay). Supports EN / FR / AR (right-to-left).
import { Preview } from './preview.js';
import { P, save, resetSave, t, isRTL, hero, totalKeys, maxKeys, tasksDone, hasWeapon, isUnlocked, LEVELS, CHARACTERS, CONFIG, WEAPONS } from './state.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const BG = { mansion: 'world/mansion.jpg', hallway: 'world/hallway.jpg' };

export class UI {
  constructor() {
    this.root = $('ui'); this.hudEl = $('hud'); this.promptEl = $('prompt'); this.mapEl = $('minimap');
    this.mctx = this.mapEl.getContext('2d');
    this.preview = new Preview();
    this.vig = $('vignette'); this.scareEl = $('scare');
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled && !b.classList.contains('lock')) this.act(b.dataset.act, b.dataset.arg);
    });
  }
  bind(game) { this.game = game; }

  screen(html, bg) {
    this.hud(false);
    const dir = isRTL() ? 'rtl' : 'ltr';
    document.documentElement.lang = P.lang;
    this.root.dir = this.hudEl.dir = dir;
    this.root.classList.remove('hidden');
    this.root.style.backgroundImage = bg ? `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.65)),url("${bg}")` : 'none';
    this.root.innerHTML = `<div class="panel">${html}</div>`;
  }
  btn(label, act, arg = '', extra = '') { return `<button data-act="${act}" data-arg="${arg}" ${extra}>${esc(label)}</button>`; }

  act(a, arg) {
    const g = this.game;
    switch (a) {
      case 'lang': P.lang = arg; save(); this.showMenu(); break;
      case 'menu': g.quit(); this.showMenu(); break;
      case 'chars': this.showChars(); break;
      case 'pick': P.char = arg; save(); this.showChars(); break;
      case 'custom': this.showCustom(); break;
      case 'color': P.color = arg; save(); this.showCustom(); break;
      case 'hat': P.hat = +arg; save(); this.showCustom(); break;
      case 'levels': g.quit(); this.showLevels(); break;
      case 'story': this.showStory(+arg); break;
      case 'start': this.root.classList.add('hidden'); g.start(+arg); break;
      case 'resume': this.root.classList.add('hidden'); g.resume(); break;
      case 'reset': if (confirm(t('confirmReset'))) { resetSave(); this.showMenu(); } break;
    }
  }

  showMenu() {
    const langs = [['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']];
    this.screen(`<h1>${esc(t('title'))}</h1><p class="sub">${esc(t('sub'))}</p>
      <div class="row">${langs.map(([k, l]) => this.btn(l, 'lang', k, P.lang === k ? 'class="on"' : '')).join('')}</div>
      <div class="row">${this.btn(t('play'), 'chars')}${P.char ? this.btn(t('cont'), 'levels') : ''}</div>
      <div class="row">${this.btn(t('reset'), 'reset', '', 'class="small"')}</div>`, BG.mansion);
  }

  showChars() {
    this.screen(`<h2>${esc(t('chars'))}</h2><p>${esc(t('charsHint'))}</p><div id="pv"></div>
      <div class="grid">${CHARACTERS.map((c) => `<div class="card ${P.char === c.id ? 'sel' : ''}" data-act="pick" data-arg="${c.id}">
        <img src="${encodeURI(c.photo)}" alt=""><b>${esc(c.name)}</b><small>⚔ ${esc(t('w')[c.weapon])}</small></div>`).join('')}</div>
      ${this.btn(t('back'), 'menu')}${this.btn(t('next'), 'custom', '', P.char ? '' : 'disabled')}`, BG.mansion);
    const h = hero(); if (h) this.preview.show($('pv'), { photo: h.photo, color: P.color, hat: P.hat, name: P.nick || h.name });
  }

  showCustom() {
    const h = hero();
    this.screen(`<h2>${esc(t('custom'))}</h2>
      <div class="custom"><div id="pv"></div>
      <div>
        <div class="row">${esc(t('name'))}: <input id="nick" maxlength="14" value="${esc(P.nick)}"></div>
        <div class="row">${esc(t('outfit'))}: ${CONFIG.outfitColors.map((c) => `<span class="sw ${P.color === c ? 'sel' : ''}" style="background:${c}" data-act="color" data-arg="${c}"></span>`).join('')}</div>
        <div class="row">${esc(t('hat'))}: ${t('hats').map((n, i) => this.btn(n, 'hat', i, P.hat === i ? 'class="on"' : '')).join('')}</div>
        <p>${esc(t('wInfo').replace('{n}', WEAPONS.unlockAfterTasks))}<b>${esc(t('w')[h.weapon])}</b>, ${esc(t('wd')[h.weapon])}.</p>
      </div></div>
      ${this.btn(t('back'), 'chars')}${this.btn(t('next'), 'levels')}`, BG.mansion);
    $('nick').addEventListener('change', (e) => { P.nick = e.target.value; save(); this.showCustom(); });
    this.preview.show($('pv'), { photo: h.photo, color: P.color, hat: P.hat, name: P.nick || h.name });
  }

  showLevels() {
    this.screen(`<h2>${esc(t('levels'))}</h2><p>🔑 ${esc(t('keys'))}: ${totalKeys()} / ${maxKeys()}</p>
      <div class="grid">${LEVELS.map((l, i) => {
        const u = isUnlocked(i);
        return `<div class="card ${u ? '' : 'lock'}" data-act="story" data-arg="${i}">
          <h3>${i + 1}. ${esc(t('lv')[i].n)}</h3><div class="stars">${'🔑'.repeat(P.keys[i])}${'▫️'.repeat(3 - P.keys[i])}</div>
          <small>${u ? (P.done[i] ? '✔' : '') : `🔒 ${esc(t('need'))} ${l.keysNeeded} 🔑`}</small></div>`;
      }).join('')}</div>
      ${this.btn(t('menu'), 'menu')}${this.btn(t('hero'), 'chars')}${this.btn(t('custom'), 'custom')}`, BG.hallway);
  }

  showStory(i) {
    this.screen(`<h2>${i + 1}. ${esc(t('lv')[i].n)}</h2><p class="story">${esc(t('lv')[i].s)}</p>
      <p class="help">${esc(t('help'))}</p>${this.btn(t('back'), 'levels')}${this.btn(t('start'), 'start', i)}`, BG.hallway);
  }
  showPause() { this.screen(`<h2>${esc(t('pause'))}</h2><p class="help">${esc(t('help'))}</p>${this.btn(t('resume'), 'resume')}${this.btn(t('levels'), 'levels')}`); }
  showFail(i) { this.screen(`<h2>${esc(t('failed'))}</h2>${this.btn(t('levels'), 'levels')}${this.btn(t('retry'), 'start', i)}`, BG.hallway); }
  showResult(i, got) {
    this.screen(`<h2>${esc(t('cleared'))}</h2><p>${esc(t('earned'))}: ${'🔑'.repeat(got)}${'▫️'.repeat(3 - got)}</p>
      <p>🔑 ${totalKeys()} / ${maxKeys()}</p>${this.btn(t('retry'), 'start', i)}${this.btn(t('levels'), 'levels')}`, BG.hallway);
  }
  showEnding() {
    this.screen(`<h1>${esc(t('endT'))}</h1><img class="portrait" src="${encodeURI(hero().photo)}" alt="">
      <p class="story">${esc(t('endS'))}</p><p>🔑 ${totalKeys()} / ${maxKeys()}</p>
      ${this.btn(t('levels'), 'levels')}${this.btn(t('menu'), 'menu')}`, BG.mansion);
  }

  // ---------------- in-game ----------------
  hud(on) {
    for (const el of [this.hudEl, this.mapEl]) el.classList.toggle('hidden', !on);
    if (!on) this.danger(0);
    if (!on) this.prompt('');
  }
  updateHud(g) {
    const h = hero();
    const w = hasWeapon()
      ? `⚔ ${t('w')[h.weapon]}: ${g.cooldown > 0 ? Math.ceil(g.cooldown) + 's' : t('ready')}`
      : `⚔ ${t('weapon')} ${t('locked')} ${Math.min(tasksDone(), WEAPONS.unlockAfterTasks)}/${WEAPONS.unlockAfterTasks}`;
    const txt = `${P.nick ? P.nick + '  ·  ' : ''}${t('lv')[g.level].n}  ·  ${t('tokens')} ${g.tokens}/${g.world.tasks.length}  ·  🔑 ${g.keysGot}/${g.world.keys.length}  ·  ${'❤️'.repeat(g.lives)}  ·  ${w}`;
    if (txt !== this.lastHud) { this.hudEl.textContent = txt; this.lastHud = txt; }
  }
  danger(d) { const o = (d * 0.85).toFixed(2); if (o !== this.lastVig) { this.vig.style.opacity = o; this.lastVig = o; } }
  scare(photo) {
    if (!photo) { this.scareEl.classList.add('hidden'); return; }
    this.scareEl.querySelectorAll('.face').forEach((f) => (f.style.backgroundImage = `url("${encodeURI(photo)}")`));
    this.scareEl.classList.remove('hidden');
    this.scareEl.querySelectorAll('.face, .word').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    this.scareEl.querySelector('.word').textContent = t('caught');
  }
  prompt(s) { if (s !== this.lastPrompt) { this.promptEl.textContent = s; this.promptEl.classList.toggle('hidden', !s); this.lastPrompt = s; } }
  toast(s) {
    const el = $('toast'); el.textContent = s; el.style.opacity = 1;
    clearTimeout(this.tt); this.tt = setTimeout(() => (el.style.opacity = 0), 1800);
  }
  minimap(g) {
    const w = g.world, c = this.mctx, k = 7;
    if (this.mapEl.width !== w.W * k) { this.mapEl.width = w.W * k; this.mapEl.height = w.H * k; }
    c.fillStyle = '#1a1410'; c.fillRect(0, 0, w.W * k, w.H * k);
    for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) {
      const v = w.g[y][x]; if (v === '.') continue;
      c.fillStyle = v === '#' ? '#6b5432' : '#4a3520'; c.fillRect(x * k, y * k, k, k);
    }
    const S = CONFIG.tile, dot = (p, col, r) => { c.fillStyle = col; c.beginPath(); c.arc((p.x / S) * k, (p.z / S) * k, r, 0, 7); c.fill(); };
    for (const q of w.tasks) dot(q.pos, q.done ? '#40d080' : '#e9b44c', 3);
    dot(w.exit, g.tokens === w.tasks.length ? '#ffd060' : '#802020', 3.5);
    for (const e of g.enemies) if (!e.dead) dot(e.pos, e.stun > 0 ? '#7ab8ff' : '#ff3030', 3);
    dot(g.player.pos, '#ffffff', 3.5);
  }
}
