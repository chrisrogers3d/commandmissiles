# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Command Missiles AR — a WebXR voxel arcade game reimagining classic Missile Command. Supports desktop (mouse) and immersive AR (hand tracking / controllers / gaze). Built with vanilla JavaScript, Three.js, and Vite.

## Commands

```bash
npm run dev       # Start HTTPS dev server (https://localhost:5173, requires .cert/ SSL files)
npm run build     # Production build to dist/
npm run preview   # Preview production build
./deploy.sh       # Build + deploy to chrisrogers3d.graphics via SCP
```

No test runner or linter is configured.

## Architecture

**Monolithic single-file app** — all game logic lives in `index.js` (~977 lines). This is intentional for a tightly-integrated real-time game loop.

### Key structures in index.js

- **`AR_CONFIG`** (top of file): All tunable gameplay parameters (distances, speeds, sizes, colors). Editable at runtime via lil-gui panel.
- **`gameState`**: Score, cities, ammo, game status flags.
- **Entity arrays**: `missiles[]`, `defenseMissiles[]`, `explosions[]`, `cities[]` — updated each frame.
- **`Missile` class**: Handles movement along a path with voxel trail rendering.
- **`Explosion` class**: 40-particle Fibonacci sphere distribution with separate XY radius and Z depth.
- **Collision detection**: Manual distance checks (no physics engine). Uses 2.5D approach — XY radius + Z depth separately.

### Input pipeline

Desktop: mouse raycasts to game plane → updates crosshair → click fires defense missile.
AR/VR: controller → hand tracking → head gaze (fallback chain). Surface hit-test places the game board on first tap; subsequent taps fire.

### WebXR / AR

- Requires HTTPS (dev server uses self-signed certs in `.cert/`).
- Requests `immersive-ar` with `hit-test` (required) and `hand-tracking` (optional).
- Reticle (green ring) shows detected surfaces. First tap places game, repositions cities relative to surface.
- Living room environment (`createLivingRoom()`) only renders in desktop mode.

### Audio

Web Audio API oscillators — no audio files. Three synth sounds: playerFire (800Hz), explosion (100Hz), enemyMissile (1200Hz).

## Build & Deploy

- Vite config sets base path to `/commandmissiles/` for production.
- HTTPS dev server binds 0.0.0.0:5173 (needed for mobile AR testing on same network).
- Deploy target: `chrisrogers3d.graphics:/var/www/html/commandmissiles/`

## Three.js Skills

The `.claude/skills/` directory contains 10 Three.js reference documents (fundamentals, geometry, materials, lighting, textures, animation, loaders, shaders, postprocessing, interaction). These are auto-loaded as context when relevant Three.js work is requested.
