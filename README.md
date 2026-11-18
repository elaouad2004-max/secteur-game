# Dar Secteur

A 3D stealth game set in a haunted Moroccan mansion. Your old friends have been cursed and became the **housekeepers**. Sneak through 6 levels, complete the story tasks to earn tokens, collect keys to unlock the next level, and take your home back.

## Features
- **3D third-person view** (Three.js): 6 themed areas (garden, hallway, kitchen, library, riad courtyard, master room) with furniture, flickering lanterns, candles, rugs, moonlight shadows, dust and fireflies
- **Horror audio** (synthesized live): drone and wind, creaks, whispers, a broken music box, a heartbeat that speeds up when housekeepers get close
- **Jumpscare** when caught: the camera snaps to the housekeeper's face, then a full-screen glitch scare
- **Character select**: you pick a hero from the uploaded photos (rotating 3D preview) and **every other character becomes an evil housekeeper** with a maid uniform, broom and glowing eyes
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
| Mouse | Turn the camera |
| Right click / mouse wheel | Switch between first person (your eyes) and third person (behind your back) |
| Arrow keys ↑ ↓ ← → | Move |
| Shift | Run |
| E | Interact with a task |
| Space | Use your weapon |
| Esc / P | Pause |

**On a phone** (turn it sideways): left joystick to move (push it to the edge to run), drag the screen to look around, **E** to interact, ⚡ weapon, 🏃 run toggle, 👁 switch view, **II** pause.

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
src/data/characters.json  roster: name, photo, weapon, color, face crop box
src/data/themes.json   per-level look: floor, walls, palette, furniture, fog, moonlight, particles
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
Put the photo in `public/characters/` and add a line to `src/data/characters.json`. `face` is the face box in the photo as fractions `[x, y, width, height]`.

### Adding a level
Add an entry to `src/data/levels.json` (24×16 map), then add its name and story to each file in `src/data/i18n/`.
