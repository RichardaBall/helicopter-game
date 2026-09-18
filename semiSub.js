import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SemiSub {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.group = new THREE.Group();
        this.basePosition = new THREE.Vector3(30, -0.95, 200);
        this.group.position.copy(this.basePosition);
        this.scene.add(this.group);

        this.elapsedTime = 0;

        const loader = new GLTFLoader();
        loader.load('semisub.glb', (gltf) => {
            const model = gltf.scene;
            this.group.add(model);
        }, undefined, (error) => {
            console.error("Semi-submersible model failed to load:", error);
        });
    }

    update(delta) {
        this.elapsedTime += delta;

        // Simulate ocean swell physics (Heave, Roll, Pitch)
        const heave = Math.sin(this.elapsedTime * 1.2) * 0.45; // Vertical bobbing magnitude
        const roll = Math.sin(this.elapsedTime * 0.7) * 0.006;  // Subtle side-to-side tilt
        const pitch = Math.cos(this.elapsedTime * 0.5) * 0.006; // Subtle front-to-back tilt

        // Apply to the platform group
        this.group.position.y = this.basePosition.y + heave;
        this.group.rotation.x = pitch;
        this.group.rotation.z = roll;
    }
}