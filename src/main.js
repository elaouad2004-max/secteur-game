import './style.css';
import { Game } from './game.js';
import { UI } from './ui.js';

const ui = new UI();
const game = new Game(document.getElementById('game'), ui);
ui.bind(game);
ui.showMenu();
window.game = game; // handy for debugging in the console
import { sfx } from './audio.js';
// browsers only allow audio after a user gesture
addEventListener('pointerdown', () => sfx.start(), { once: true });
addEventListener('keydown', () => sfx.start(), { once: true });
