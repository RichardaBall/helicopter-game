import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupScene } from './sceneSetup.js';
import { WeatherSystem } from './weather.js';
import { InputManager } from './inputManager.js';
import { HelicopterPlayer } from './player.js';

// Initialize core modules
const { scene, camera, renderer, water } = setupScene();
const weatherSystem = new WeatherSystem();
const inputManager = new InputManager();
const clock = new THREE.Clock();

let helicopterPlayer = null;

// Helicopter Lights Setup Group
let redLight, greenLight, strobeLight, landingLight;
let redBulb, greenBulb, strobeBulb;
let heliLightsGroup;

const loader = new GLTFLoader();

// Load Helicopter Model
loader.load('helicopter.glb', (gltfHeli) => {
    const model = gltfHeli.scene;
    model.position.set(36.80, 37.85, -65.46); // Helipad spawn
    scene.add(model);

    heliLightsGroup = new THREE.Group();

    redLight = new THREE.PointLight(0xff0000, 2.5, 8);
    redLight.position.set(4.55, 1.50, 2.92);
    heliLightsGroup.add(redLight);
    redBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redBulb.position.copy(redLight.position);
    heliLightsGroup.add(redBulb);

    greenLight = new THREE.PointLight(0x00ff00, 2.5, 8);
    greenLight.position.set(5.09, 1.44, -1.00);
    heliLightsGroup.add(greenLight);
    greenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    greenBulb.position.copy(greenLight.position);
    heliLightsGroup.add(greenBulb);

    strobeLight = new THREE.PointLight(0xffffff, 8.0, 15);
    strobeLight.position.set(7.24, 4.39, 1.30);
    heliLightsGroup.add(strobeLight);
    strobeBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobeBulb.position.copy(strobeLight.position);
    heliLightsGroup.add(strobeBulb);

    landingLight = new THREE.SpotLight(0xffffee, 18.0, 60, Math.PI / 6, 0.4, 1);
    landingLight.position.set(-4.66, -0.04, -0.35);
    const landingTarget = new THREE.Object3D();
    landingTarget.position.set(-25, -6, 0);
    model.add(landingTarget);
    landingLight.target = landingTarget;
    heliLightsGroup.add(landingLight);

    model.add(heliLightsGroup);

    // Listen to custom engine and gear toggle keys in main loop context
    window.addEventListener('keydown', (e) => {
        if (!helicopterPlayer) return;
        if (e.code === 'KeyE') helicopterPlayer.toggleEngine();
        if (e.code === 'KeyG') helicopterPlayer.toggleLandingGear();
    });

    const mixer = new THREE.AnimationMixer(model);
    helicopterPlayer = new HelicopterPlayer(model, gltfHeli.animations, mixer);
});

// Main Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    water.material.uniforms['time'].value += delta * 0.3;

    // Update dynamic weather wind vector
    const currentWind = weatherSystem.update(delta);

    if (helicopterPlayer && helicopterPlayer.model) {
        // Update physics, controls, and wind drift
        helicopterPlayer.update(delta, inputManager.keys, currentWind);
        
        water.position.x = helicopterPlayer.model.position.x;
        water.position.z = helicopterPlayer.model.position.z;

        // Sync lights with electrical state
        const electricalActive = helicopterPlayer.isElectricalOn;
        if (redLight && greenLight && strobeLight && landingLight) {
            redLight.intensity = electricalActive ? 2.5 : 0.0;
            greenLight.intensity = electricalActive ? 2.5 : 0.0;
            redBulb.visible = electricalActive;
            greenBulb.visible = electricalActive;

            const isStrobeActive = electricalActive && ((Math.floor(time * 4) % 2) === 0);
            strobeLight.intensity = isStrobeActive ? 8.0 : 0.0;
            strobeBulb.visible = isStrobeActive;

            landingLight.intensity = (electricalActive && inputManager.landingLightOn) ? 18.0 : 0.0;
        }

        // Camera Follow Setup
        const elevationAngle = 45 * (Math.PI / 180); 
        const cosAlpha = Math.cos(elevationAngle);
        const sinAlpha = Math.sin(elevationAngle);
        const diagFactor = 0.7071;

        const offsetX = inputManager.cameraDistance * cosAlpha * diagFactor;
        const offsetY = inputManager.cameraDistance * sinAlpha;
        const offsetZ = inputManager.cameraDistance * cosAlpha * diagFactor;

        const targetCameraPos = helicopterPlayer.model.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
        camera.position.lerp(targetCameraPos, 0.1);
        camera.lookAt(helicopterPlayer.model.position);
    }

    renderer.render(scene, camera);
}

animate();