# Project Architecture & AI Guidelines

### Project Overview
A 3D helicopter flight game built using Three.js, WebGL, and modular ES JavaScript.

### File Structure & Module Responsibilities
* **`architecture.md`**: Project documentation mapping file dependencies and system rules.
* **`index.html`**: Main HTML entry point loading the Three.js canvas and styles.
* **`main.js`**: Central application loop; handles scene orchestration, lighting, model loading, shadow positioning, and camera tracking.
* **`sceneSetup.js`**: Initializes the Three.js core environment (`Scene`, `Camera`, `WebGLRenderer`, lighting, fog, water plane).
* **`player.js`**: Controls `HelicopterPlayer` flight physics, landing gear, fuel consumption, and engine state.
* **`inputManager.js`**: Translates raw user key/mouse events into flight movement vectors.
* **`SoundManager.js`**: Manages Web Audio API, engine RPM audio pitch modulation, and rotor noise.
* **`weather.js`**: Controls `WeatherSystem` (fog density, wind forces, drag/lift multipliers, rain particles).

### Assets
* **`helicopter.glb`**: Primary 3D helicopter model with rotor animation mixers.
* **`oil_rig.glb`**: Offshore platform 3D model acting as the primary helipad.

---

### Strict AI Coding Rules
1. **Full File Outputs Only**: ALWAYS provide complete, ready-to-use updated code files. NEVER use placeholders, truncation, or partial snippets like `// ... rest of code stays the same ...`.
2. **Strict Modular Isolation**: Keep features in separate modules. Do NOT mix new, unrelated functionality into existing modules. If a requested feature does not cleanly fit into an existing file (e.g., adding a radar UI, mission system, or particle manager), instruct me to create a NEW module file (e.g., `radar.js`) and provide that code separately alongside the minimal imports needed for `main.js`.
3. **Preserve Existing Features**: Do NOT remove or refactor unmentioned game objects, lights, controls, shadow mechanics, or camera lerp systems unless explicitly instructed.
4. **Maintain Code Cleanliness**: Keep code well-organized, clean, and commented to prevent codebase degradation over time.
5. **Ask for Missing Code**: If a requested feature requires modifying an existing file and I have not provided that file in the chat, ask me to paste it before generating updated code.