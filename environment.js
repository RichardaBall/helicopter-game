import * as THREE from 'three';
import { Helicopter } from './helicopter.js';

// 1. Scene setup with atmospheric haze background
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061526);
scene.fog = new THREE.FogExp2(0x061526, 0.015);

// 2. Isometric Camera Setup
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// AUTO-FOCUS FIX: Make the game canvas capture keyboard inputs instantly
renderer.domElement.setAttribute('tabindex', '0');
renderer.domElement.focus();

// 3. Cinematic Lighting
const ambientLight = new THREE.AmbientLight(0x1a3a5c, 1.2);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.5);
sunLight.position.set(30, 50, 30);
sunLight.castShadow = true;
scene.add(sunLight);

// 4. Generate Procedural Satellite Water Texture
const canvasTexture = document.createElement('canvas');
canvasTexture.width = 1024;
canvasTexture.height = 1024;
const ctx = canvasTexture.getContext('2d');

ctx.fillStyle = '#0a3663';
ctx.fillRect(0, 0, 1024, 1024);

for (let i = 0; i < 400; i++) {
    let x = Math.random() * 1024;
    let y = Math.random() * 1024;
    let radius = Math.random() * 150 + 50;
    let gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(15, 80, 140, 0.15)');
    gradient.addColorStop(1, 'rgba(5, 20, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

const oceanTexture = new THREE.CanvasTexture(canvasTexture);
oceanTexture.wrapS = THREE.RepeatWrapping;
oceanTexture.wrapT = THREE.RepeatWrapping;
oceanTexture.repeat.set(10, 10);

// 5. Create Ocean Plane for Waves
const waterGeometry = new THREE.PlaneGeometry(300, 300, 40, 40);
const waterMaterial = new THREE.MeshStandardMaterial({ 
    map: oceanTexture,
    roughness: 0.25,
    metalness: 0.1
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.receiveShadow = true;
scene.add(water);

// Save original vertex positions for wave animation
const positionAttribute = waterGeometry.attributes.position;
let clock = new THREE.Clock();

// 6. Spawn the Helicopter from our separate module!
const playerChopper = new Helicopter(scene);

// 7. Main Game Loop (Waves, Helicopter Control, Camera Tracking)
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Animate waves
    for (let i = 0; i < positionAttribute.count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const waveZ = Math.sin(x * 0.05 + elapsedTime * 2) * Math.cos(y * 0.05 + elapsedTime * 1.5) * 0.6;
        positionAttribute.setZ(i, waveZ);
    }
    positionAttribute.needsUpdate = true;

    // Update helicopter movement and rotor spinning
    playerChopper.update();

    // Lock camera, ocean tile, and tracking to the helicopter's position
    camera.position.x = playerChopper.group.position.x;
    camera.position.z = playerChopper.group.position.z + 25; 
    camera.position.y = 30;
    camera.lookAt(playerChopper.group.position);
    
    water.position.x = playerChopper.group.position.x;
    water.position.z = playerChopper.group.position.z;

    renderer.render(scene, camera);
}
animate();

// Responsive window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});