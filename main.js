import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupScene } from './sceneSetup.js';
import { WeatherSystem } from './weather.js';
import { InputManager } from './inputManager.js';
import { HelicopterPlayer } from './player.js';
import { SoundManager } from './SoundManager.js';
import { NavRadio } from './navRadio.js';
import { NavIndicator } from './navIndicator.js';
import { Kneeboard } from './kneeboard.js';

const { scene, camera, renderer, water, sunLight, ambientLight } = setupScene();
const weatherSystem = new WeatherSystem();
const inputManager = new InputManager();
const soundManager = new SoundManager();
const kneeboard = new Kneeboard();
const clock = new THREE.Clock();

let helicopterPlayer = null;
let navRadio = null;
let navIndicator = null;

let redLight, greenLight, strobeLight, landingLight, cockpitLight;
let redBulb, greenBulb, strobeBulb;
let heliLightsGroup;
let heliShadow = null;

const loader = new GLTFLoader();

// Load Oil Rig and attach permanent, always-on lights
loader.load('oil_rig.glb', (gltfRig) => {
    const oilRig = gltfRig.scene;
    oilRig.position.set(30, -0.95, 0);
    scene.add(oilRig);
    
    const oilRigLightsGroup = new THREE.Group();

    const rigLightsData = [
        // Green Helipad Lights (8)
        { color: 'green', x: 7.009, y: 39.222, z: -78.055 },
        { color: 'green', x: 6.568, y: 39.222, z: -57.216 },
        { color: 'green', x: -2.947, y: 39.222, z: -66.970 },
        { color: 'green', x: 15.657, y: 39.222, z: -67.448 },
        { color: 'green', x: -0.368, y: 39.222, z: -74.972 },
        { color: 'green', x: 13.818, y: 39.222, z: -73.807 },
        { color: 'green', x: -0.010, y: 39.222, z: -60.168 },
        { color: 'green', x: 13.153, y: 39.222, z: -60.558 },
        // Red Structure Lights (8)
        { color: 'red', x: 25.582, y: 48.205, z: -43.798 },
        { color: 'red', x: 25.526, y: 48.352, z: 37.618 },
        { color: 'red', x: 11.589, y: 70.388, z: -27.450 },
        { color: 'red', x: -42.358, y: 149.909, z: -31.228 },
        { color: 'red', x: -38.197, y: 89.702, z: 9.911 },
        { color: 'red', x: -47.206, y: 108.221, z: 58.016 },
        { color: 'red', x: -61.006, y: 48.168, z: 37.376 },
        { color: 'red', x: -60.624, y: 48.169, z: -43.698 }
    ];

    rigLightsData.forEach(data => {
        const isGreen = data.color === 'green';
        const colorHex = isGreen ? 0x00ff00 : 0xff0000;
        
        const pointLight = new THREE.PointLight(colorHex, isGreen ? 2.0 : 2.5, 12);
        pointLight.position.set(data.x, data.y, data.z);
        oilRigLightsGroup.add(pointLight);
        
        const bulbMat = new THREE.MeshBasicMaterial({ color: colorHex });
        const bulbGeo = new THREE.SphereGeometry(isGreen ? 0.3 : 0.45, 8, 8);
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.position.set(data.x, data.y, data.z);
        oilRigLightsGroup.add(bulbMesh);
    });

    oilRig.add(oilRigLightsGroup);
}, undefined, (error) => {
    console.error("Oil rig model failed to load:", error);
});

loader.load('helicopter.glb', (gltfHeli) => {
    const model = gltfHeli.scene;
    model.position.set(36.80, 37.85, -65.46);
    scene.add(model);

    try {
        const shadowGeo = new THREE.PlaneGeometry(4.0, 4.0);
        shadowGeo.rotateX(-Math.PI / 2);
        
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const shadowTexture = new THREE.CanvasTexture(canvas);
        const shadowMat = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            transparent: true,
            depthWrite: false,
        });

        heliShadow = new THREE.Mesh(shadowGeo, shadowMat);
        heliShadow.position.set(model.position.x, 0.05, model.position.z);
        scene.add(heliShadow);
    } catch (e) {
        console.warn("Shadow mesh creation failed:", e);
    }

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

    cockpitLight = new THREE.PointLight(0xffd27d, 3.5, 6);
    cockpitLight.position.set(-3.60, 1.90, -0.18);
    heliLightsGroup.add(cockpitLight);

    model.add(heliLightsGroup);

    window.addEventListener('keydown', (e) => {
        if (!helicopterPlayer) return;
        if (e.code === 'KeyE') helicopterPlayer.toggleEngine();
        if (e.code === 'KeyG') helicopterPlayer.toggleLandingGear();
    });

    const mixer = new THREE.AnimationMixer(model);
    helicopterPlayer = new HelicopterPlayer(model, gltfHeli.animations, mixer, soundManager);

    // Initialize NDB Nav Radio system & 3D child-locked Indicator
    const oilRigTargetPos = new THREE.Vector3(36.61, 39.22, -67.40);
    navRadio = new NavRadio(helicopterPlayer, oilRigTargetPos);
    navIndicator = new NavIndicator(helicopterPlayer, oilRigTargetPos, navRadio, scene, model);
}, undefined, (error) => {
    console.error("Helicopter model failed to load:", error);
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (water && water.material && water.material.uniforms && water.material.uniforms['time']) {
        water.material.uniforms['time'].value += delta * 0.3;
    }

    let weatherData = null;
    try {
        weatherData = weatherSystem.update(delta, scene, camera ? camera.position : null, sunLight, ambientLight);
    } catch (err) {
        console.error("Weather system update error:", err);
    }

    if (soundManager) {
        soundManager.updateRainAudio(weatherData);
    }

    if (weatherSystem && weatherSystem.rainParticles && !scene.getObjectById(weatherSystem.rainParticles.id)) {
        scene.add(weatherSystem.rainParticles);
    }

    if (helicopterPlayer && helicopterPlayer.model) {
        helicopterPlayer.update(delta, inputManager ? inputManager.keys : {}, weatherData);
        
        if (water) {
            water.position.x = helicopterPlayer.model.position.x;
            water.position.z = helicopterPlayer.model.position.z;
        }

        if (heliShadow) {
            const groundLevel = helicopterPlayer.getCurrentGroundLevel ? helicopterPlayer.getCurrentGroundLevel() : 0;
            const currentHeight = Math.max(0, helicopterPlayer.model.position.y - groundLevel);
            
            heliShadow.position.set(helicopterPlayer.model.position.x, groundLevel + 0.05, helicopterPlayer.model.position.z);
            
            const maxShadowHeight = 40.0;
            const heightFactor = Math.max(0, 1.0 - (currentHeight / maxShadowHeight));
            
            const nightFactor = weatherData && weatherData.isNight ? 0.2 : 1.0;
            if (heliShadow.material) {
                heliShadow.material.opacity = Math.max(0.02, 0.6 * heightFactor * nightFactor);
            }
            
            const scale = Math.max(0.5, 1.5 - (currentHeight * 0.02));
            heliShadow.scale.set(scale, scale, scale);
        }

        const electricalActive = helicopterPlayer.isElectricalOn;
        if (redLight && greenLight && landingLight && cockpitLight) {
            redLight.intensity = electricalActive ? 2.5 : 0.0;
            greenLight.intensity = electricalActive ? 2.5 : 0.0;
            if (redBulb) redBulb.visible = electricalActive;
            if (greenBulb) greenBulb.visible = electricalActive;

            landingLight.intensity = (electricalActive && inputManager && inputManager.landingLightOn) ? 18.0 : 0.0;
            cockpitLight.intensity = electricalActive ? 3.5 : 0.0;
        }

        if (inputManager && camera) {
            const elevationAngle = 45 * (Math.PI / 180); 
            const cosAlpha = Math.cos(elevationAngle);
            const sinAlpha = Math.sin(elevationAngle);
            const diagFactor = 0.7071;

            const dist = inputManager.cameraDistance || 30;
            const offsetX = dist * cosAlpha * diagFactor;
            const offsetY = dist * sinAlpha;
            const offsetZ = dist * cosAlpha * diagFactor;

            const targetCameraPos = helicopterPlayer.model.position.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
            camera.position.lerp(targetCameraPos, 0.1);
            camera.lookAt(helicopterPlayer.model.position);
        }
    }

    // Update NDB Nav Radio system and locked 3D arrow indicator
    if (navRadio && helicopterPlayer && helicopterPlayer.model && camera) {
        navRadio.update(camera, helicopterPlayer.model);
    }
    if (navIndicator && helicopterPlayer && helicopterPlayer.model && camera) {
        navIndicator.update(camera, helicopterPlayer.model);
    }

    // Update Pilot Kneeboard
    if (kneeboard) {
        kneeboard.update(helicopterPlayer, weatherData);
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

animate();