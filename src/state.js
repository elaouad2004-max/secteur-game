// Persistent player progress + translations.
import CHARACTERS from './data/characters.json';
import LEVELS from './data/levels.json';
import WEAPONS from './data/weapons.json';
import CONFIG from './data/config.json';
import en from './data/i18n/en.json';
import fr from './data/i18n/fr.json';
import ar from './data/i18n/ar.json';

export { CHARACTERS, LEVELS, WEAPONS, CONFIG };
const LANGS = { en, fr, ar };
const KEY = 'darSecteur.save.v1';

const defaults = () => ({
  lang: 'en',
  char: null,
  color: CONFIG.outfitColors[0],
  hat: 2,
  nick: '',
  keys: LEVELS.map(() => 0),     // best keys per level
  done: LEVELS.map(() => false), // level cleared
  tasks: LEVELS.map(() => 0),    // best tasks done per level
});

export let P = defaults();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) P = Object.assign(P, s); } catch { /* no storage */ }

export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignore */ } };
export const resetSave = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } P = defaults(); };

export const t = (k) => LANGS[P.lang][k] ?? LANGS.en[k];
export const isRTL = () => P.lang === 'ar';

export const hero = () => CHARACTERS.find((c) => c.id === P.char);
export const totalKeys = () => P.keys.reduce((a, b) => a + b, 0);
export const maxKeys = () => LEVELS.length * 3;
export const tasksDone = () => P.tasks.reduce((a, b) => a + b, 0);
export const hasWeapon = () => tasksDone() >= WEAPONS.unlockAfterTasks;
export const isUnlocked = (i) => i === 0 || (P.done[i - 1] && totalKeys() >= LEVELS[i].keysNeeded);
