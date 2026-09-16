import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HelicopterPlayer } from './player.js';

// Scene, Camera, and Renderer setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// Clock & Game State
const clock = new THREE.Clock();
let helicopterPlayer = null;

// Track active keys
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (!helicopterPlayer) return;

    // Toggle Engine with 'E'
    if (e.code === 'KeyE') {
        helicopterPlayer.toggleEngine();
    }
    
    // Toggle Landing Gear with 'G'
    if (e.code === 'KeyG') {
        helicopterPlayer.toggleLandingGear();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Load the GLB Helicopter Model
const loader = new GLTFLoader();
loader.load(
    'helicopter.glb',
    (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        const mixer = new THREE.AnimationMixer(model);
        helicopterPlayer = new HelicopterPlayer(model, gltf.animations, mixer);

        console.log("Helicopter loaded! Controls: [E] Engine, [G] Gear, [W/S/A/D] Move, [Shift/Ctrl] Up/Down");
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('An error occurred loading the model:', error);
    }
);

// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (helicopterPlayer) {
        helicopterPlayer.update(delta, keys);
        
        // Optional: Make camera smoothly follow the helicopter position
        // camera.position.x = helicopterPlayer.model.position.x;
        // camera.position.z = helicopterPlayer.model.position.z + 12;
    }

    renderer.render(scene, camera);
}

animate();