<h1 align="center">Immortal Snail</h1>

<p align="center">
  A browser-based 3D survival arena game built with Three.js and TypeScript.
</p>

<p align="center">
  <a href="https://abinannd.github.io/unity-2/"><b>Play the Game</b></a>
  &nbsp;|&nbsp;
  <a href="https://github.com/abinannd/unity-2"><b>Repository</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Three.js-black?logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite" />
</p>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Controls](#controls)
- [Technologies Used](#technologies-used)
- [Character Creation Workflow](#character-creation-workflow)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Project Goals](#project-goals)
- [Development](#development)
- [Credits](#credits)
- [License](#license)

---

## About

Immortal Snail is a browser-based 3D survival arena game where movement, combat, and strategy determine how long you survive. It features a third-person player character, animated movement, enemy encounters, interactive obstacles, and combat mechanics.

The goal is to survive in the arena by moving strategically, avoiding enemies, and using the available movement and combat abilities. The project combines browser-based 3D development with AI-assisted character creation and animation workflows.

## Features

- **Browser-Based 3D Gameplay:** Play directly in a supported web browser.
- **Third-Person Movement:** Walk, run, sprint, and jump around the arena.
- **Animated Character:** Character animations using FBX motion assets.
- **Projectile Combat:** Attack enemies using projectiles.
- **Multiple Enemy Types:** Face enemies with different visual designs and durability.
- **Grappling System:** Target floating grapple points to move through the arena.
- **Ground Slam:** Perform an area-of-effect attack while descending.
- **Dynamic Obstacles:** Navigate platforms and moving obstacles.
- **Healing Platforms:** Recover health by reaching designated safe platforms.
- **Survival Gameplay:** Continue fighting, moving, and adapting as the game progresses.

> Features and gameplay mechanics may evolve as development continues.

## Controls

| Input              | Action                                           |
| ------------------ | ------------------------------------------------ |
| `W`                | Move forward                                     |
| `A`                | Move left                                        |
| `S`                | Move backward                                    |
| `D`                | Move right                                       |
| Mouse              | Look around and aim                              |
| Left Mouse Button  | Fire projectiles                                 |
| `Space`            | Jump                                             |
| `Shift`            | Sprint                                           |
| `R`                | Grapple toward a targeted grapple point          |
| Right Mouse Button | Ground slam while airborne and descending        |
| `C`                | Running slide, when enabled in the current build |
| `Esc`              | Pause the game                                   |

> Controls may change as new mechanics are implemented. Check the in-game instructions for the controls available in the current version.

## Technologies Used

**Game Development**

- **Three.js:** Real-time 3D graphics and rendering in the browser.
- **TypeScript:** Game logic, player mechanics, combat, and system architecture.
- **Vite:** Development server and production build tooling.

**3D Character and Animation**

- **Blender:** 3D model preparation, editing, and asset processing.
- **Tripo AI:** AI-assisted 3D character creation.
- **Mixamo:** Character animations and motion assets.

**AI-Assisted Development**

- **Antigravity IDE:** AI-assisted coding, implementation, debugging, and development workflow.

## Character Creation Workflow

1. **Tripo AI:** Create the 3D character model with AI assistance.
2. **Blender:** Inspect, edit, and prepare the character model and its assets.
3. **Mixamo:** Obtain character motion and animation assets.
4. **Three.js:** Load and play the character and animation assets in the browser.
5. **Antigravity IDE:** Assist with implementing and integrating the game systems.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (npm is included)
- A modern web browser

### Installation

```bash
# Clone the repository
git clone https://github.com/abinannd/unity-2.git

# Open the project directory
cd unity-2

# Install dependencies
npm install

# Start the development server
npm run dev
```

Vite will display a local development URL in the terminal, typically `http://localhost:5173/`. Open it in your browser to run the game.

### Production Build

```bash
# Compile TypeScript and create a production build
npm run build

# Preview the production build locally
npm run preview
```

## Project Structure

```text
unity-2/
├── movements/       # Character animation assets
├── public/          # Public assets
├── src/
│   ├── arena/       # Arena environment
│   ├── camera/      # Camera system
│   ├── combat/      # Combat and projectile systems
│   ├── enemies/     # Enemy logic and behavior
│   ├── game/        # Game lifecycle and coordination
│   ├── obstacles/   # Obstacles and platforms
│   ├── player/      # Player movement and controls
│   ├── ui/          # User interface
│   └── main.ts      # Application entry point
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

> This is a simplified overview of the repository structure.

## Project Goals

- Real-time 3D rendering in web browsers.
- Third-person player movement and camera control.
- Character animation integration.
- Enemy AI and combat mechanics.
- Physics-inspired movement and traversal.
- Procedural and dynamic gameplay elements.
- AI-assisted 3D asset creation.
- AI-assisted software development.

## Development

Immortal Snail is an ongoing independent game development project. It is developed using Antigravity IDE, with Blender, Mixamo, and Tripo AI supporting the character creation and animation workflow. New mechanics, gameplay improvements, visual effects, and optimizations may be introduced over time.

## Credits

| Tool            | Purpose                           |
| --------------- | --------------------------------- |
| Three.js        | 3D rendering                      |
| TypeScript      | Game programming                  |
| Vite            | Development and build tooling     |
| Blender         | 3D model preparation and editing  |
| Mixamo          | Character motion and animations   |
| Tripo AI        | AI-assisted 3D character creation |
| Antigravity IDE | AI-assisted development           |

Third-party tools and assets remain subject to their respective licenses and terms of use.

## License

This project is licensed under the [MIT License](LICENSE). Copyright (c) 2026 Haroon Muhammed Riyas.

---

<p align="center"><b>Immortal Snail</b> | Survive. Move. Fight. Keep Going.</p>
