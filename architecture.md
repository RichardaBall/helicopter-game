# Project Architecture & AI Guidelines

### Project Overview
A 3D offshore helicopter flight simulation game built using Three.js, WebGL, and modular ES JavaScript. The simulation features an AW189 helicopter operating around an offshore oil rig environment with dynamic weather systems, custom flight physics, procedural Web Audio sound synthesis, real-time HUD instrumentation, and a 3D tactical NDB bearing indicator.

### File Structure & Module Responsibilities
* **`architecture.md`**: Project documentation mapping file dependencies, system rules, and gameplay specifications.
* **`index.html`**: Main HTML entry point loading the Three.js canvas, HUD overlay elements, fuel test slider, fullscreen controls, and styles.
* **`main.js`**: Central application loop; handles scene orchestration, lighting, model loading, shadow positioning, camera tracking, and game state updates.
* **`sceneSetup.js`**: Initializes the Three.js core environment (`Scene`, `Camera`, `WebGLRenderer`, directional/ambient lighting, fog, and the dynamic ocean water plane).
* **`player.js`**: Controls `HelicopterPlayer` flight physics, mass calculations, rotor rotation, autorotation mechanics, landing gear drag, fuel consumption rates, strobe low-fuel warnings, and engine state.
* **`inputManager.js`**: Translates raw user input into flight movement vectors, prioritizing keyboard arrow keys and managing camera distance via mouse scroll.
* **`SoundManager.js`**: Procedural Web Audio API sound generator for electrical clicks, fuel pump prime, landing gear servos, turbine pitch modulation, rotor blade slap ("whop-whop"), and cockpit rain audio.
* **`weather.js`**: Controls `WeatherSystem` (day/night celestial cycle, fog density, wind forces, drag/lift multipliers, and rain particle systems).
* **`navRadio.js`**: NDB Navigation Radio module rendering a compact bottom-right avionics tuning panel (`[N]`) tracking frequency tuning and signal lock to the 210 kHz oil rig.
* **`navIndicator.js`**: 3D tactical NDB bearing indicator module; attaches a transparent ring bezel and a neon-glowing amber pointer needle directly to the helicopter rotor hub to display relative bearing to the NDB target.
* **`lightPlacer.js`**: Utility development tool for placing, undoing, and exporting oil rig light coordinates (`[C]`, `[Z]`, `[P]`).

### Core Controls & Key Bindings
* **`[Q]`**: Toggle Electrical System (Battery)
* **`[F]`**: Toggle Fuel Pump
* **`[E]`**: Toggle Engine Ignition / Fuel Cutoff
* **`[G]`**: Toggle Landing Gear
* **`[L]`**: Toggle Landing Light
* **`[N]`**: Toggle NDB Navigation Radio Panel
* **`[K]`**: Toggle HUD Display Visibility
* **`Arrow Keys`**: Pitch / Roll / Turn movement
* **`Shift / Ctrl`**: Collective Up / Down (Altitude)
* **`Mouse Wheel`**: Adjust camera follow distance

### Key Gameplay & Simulation Features
* **Aircraft Model**: AW189 helicopter with animated rotor blades and aerodynamic properties.
* **Environment & Lighting**: Offshore oil rig platform equipped with **8 green helipad lights** and **10 red structure lights** set against dynamic ocean waves and day/night weather cycles.
* **Flight Systems**: Modeled autorotation, landing gear drag penalties, dynamic fuel consumption based on mass and weather, and strobe lighting fuel warnings ($\le 500\text{kg}$ orange, $\le 100\text{kg}$ red rapid flash).
* **Instrumentation & Navigation**: Real-time HUD, NDB avionics tuning panel, and a 3D cockpit-attached bearing indicator needle pointing toward the oil rig beacon.

### Assets
* **`helicopter.glb`**: Primary 3D AW189 helicopter model with rotor animation mixers.
* **`oil_rig.glb`**: Offshore platform 3D model serving as the primary helipad and NDB beacon target.

---

### Strict AI Coding Rules
1. **Full File Outputs Only**: ALWAYS provide complete, ready-to-use updated code files. NEVER use placeholders, truncation, or partial snippets like `// ... rest of code stays the same ...`.
2. **Strict Modular Isolation**: Keep features in separate modules. Do NOT mix new, unrelated functionality into existing modules. If a requested feature does not cleanly fit into an existing file, instruct me to create a NEW module file and provide that code separately alongside minimal imports.
3. **Preserve Existing Features**: Do NOT remove or refactor unmentioned game objects, lights, controls, shadow mechanics, or camera lerp systems unless explicitly instructed.
4. **Maintain Code Cleanliness**: Keep code well-organized, clean, and commented to prevent codebase degradation over time.
5. **Ask for Missing Code**: If a requested feature requires modifying an existing file and I have not provided that file in the chat, ask me to paste it before generating updated code.
6. **Scope Isolation & Zero Unrequested Changes**: Strictly no unprompted edits to working code, key bindings, or core flight mechanics. If a change impacts outside systems, you must explicitly notify me of the side effects before generating code.