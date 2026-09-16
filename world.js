import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';
import { HelicopterPlayer } from './player.js';

// Scene, Camera, and Renderer setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
scene.fog = new THREE.FogExp2(0x111122, 0.007);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(30, 50, 30);
scene.add(dirLight);

// --- PHOTOREALISTIC WATER SETUP ---
const waterGeometry = new THREE.PlaneGeometry(2000, 2000);

const water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20); // Controls normal map density smoothly across the large plane
    }),
    sunDirection: dirLight.position.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x00416a, // Rich deep blue-teal maritime color
    distortionScale: 3.7,
    fog: scene.fog !== undefined
});

water.rotation.x = -Math.PI / 2;
water.position.y = -2.0;
scene.add(water);
// ------------------------------------

// --- REFERENCE BUOYS ---
const buoys = [];
const buoyGeometry = new THREE.SphereGeometry(0.4, 16, 16);
const buoyMaterial = new THREE.MeshStandardMaterial({ color: 0xff3300, roughness: 0.3 });

for (let i = 0; i < 20; i++) {
    const buoy = new THREE.Mesh(buoyGeometry, buoyMaterial);
    buoy.position.set(
        (Math.random() - 0.5) * 150,
        -1.5,
        (Math.random() - 0.5) * 150
    );
    scene.add(buoy);
    buoys.push(buoy);
}
// ------------------------

// Clock & Game State
const clock = new THREE.Clock();
let helicopterPlayer = null;

// Track active keys
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (!helicopterPlayer) return;

    if (e.code === 'KeyE') {
        helicopterPlayer.toggleEngine();
    }
    if (e.code === 'KeyG') {
        helicopterPlayer.toggleLandingGear();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// --- ZOOM CONTROLS ---
let cameraDistance = 25;
const minDistance = 10;
const maxDistance = 60;

window.addEventListener('wheel', (e) => {
    cameraDistance += e.deltaY * 0.05;
    cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance));
});
// ---------------------

// Load the GLB Helicopter Model
const loader = new GLTFLoader();
loader.load(
    'helicopter.glb',
    (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        const mixer = new THREE.AnimationMixer(model);
        helicopterPlayer = new HelicopterPlayer(model, gltf.animations, mixer);

        console.log("Helicopter loaded! Controls: [E] Engine, [G] Gear, [W/S/A/D] Move, [Shift/Ctrl] Up/Down, [Scroll] Zoom");
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
    const elapsedTime = clock.getElapsedTime();

    // Animate the realistic water surface normals smoothly at half speed
    water.material.uniforms['time'].value += delta * 0.3;

    if (helicopterPlayer && helicopterPlayer.model) {
        helicopterPlayer.update(delta, keys);
        
        // Keep water plane centered smoothly on player coordinates
        water.position.x = helicopterPlayer.model.position.x;
        water.position.z = helicopterPlayer.model.position.z;

        // Static buoys anchored at water level
        buoys.forEach((buoy) => {
            buoy.position.y = -1.5;
        });

        // --- COMMAND & CONQUER / AGE OF EMPIRES RTS CAMERA POSITIONING ---
        const elevationAngle = 45 * (Math.PI / 180); 
        const cosAlpha = Math.cos(elevationAngle);
        const sinAlpha = Math.sin(elevationAngle);
        const diagFactor = 0.7071;

        const offsetX = cameraDistance * cosAlpha * diagFactor;
        const offsetY = cameraDistance * sinAlpha;
        const offsetZ = cameraDistance * cosAlpha * diagFactor;

        const targetCameraPos = helicopterPlayer.model.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
        
        camera.position.lerp(targetCameraPos, 0.1);
        camera.lookAt(helicopterPlayer.model.position);
    }

    renderer.render(scene, camera);
}

animate();