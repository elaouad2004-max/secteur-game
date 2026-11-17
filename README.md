# Dar Secteur

A 3D stealth game set in a haunted Moroccan mansion. Your old friends have been cursed and became the **housekeepers**. Sneak through 6 levels, complete the story tasks to earn tokens, collect keys to unlock the next level, and take your home back.

## Features
- **3D third-person view** (Three.js): the mansion is built from map data, with a flashlight, fog and lanterns
- **Character select**: you pick a hero from the uploaded photos and **every other character becomes an evil housekeeper**
- **Customization**: nickname, outfit color, hat (cap, fez, crown)
- **Housekeeper AI**: patrols, sees you inside its vision cone, chases you, then searches where it last saw you
- **6 levels unlocked by keys**: each level has 3 hidden keys, and later levels need more keys in total
- **Special weapon per character** (babouche throw, mint freeze, smoke bomb, thunder dash), unlocked after 6 tasks
- **3 languages**: English, Français, العربية (right-to-left)
- **Ending**: break the 4 seals in the master's room and every housekeeper turns to dust
- Progress is saved in the browser

## Controls
| Key | Action |
|---|---|
| Click | Lock the mouse |
| Mouse / ← → | Turn the camera |
| WASD / ZQSD / ↑ ↓ | Move |
| Shift | Run |
| E | Interact with a task |
| Space | Use your weapon |
| Esc / P | Pause |

## Run it
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Project layout
```
public/characters/     character photos (one per playable character)
public/world/          menu/story background art
src/data/levels.json   level maps (# wall, o furniture, P start, X exit, T task, K key, H housekeeper)
src/data/characters.json  roster: name, photo, weapon, color
src/data/weapons.json  weapon stats and how many tasks unlock them
src/data/config.json   player/housekeeper tuning
src/data/i18n/*.json   translations (en, fr, ar)
src/game.js            game loop, camera, player, weapons
src/world.js           builds the 3D level; collision, line of sight, pathfinding
src/housekeeper.js     enemy AI
src/character.js       3D character model with the photo as its face
src/ui.js              menus, HUD, minimap
```

### Adding a character
Put the photo in `public/characters/` and add a line to `src/data/characters.json`.

### Adding a level
Add an entry to `src/data/levels.json` (24×16 map), then add its name and story to each file in `src/data/i18n/`.
