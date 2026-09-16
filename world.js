import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';
import { HelicopterPlayer } from './player.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
scene.fog = new THREE.FogExp2(0x111122, 0.007);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(30, 50, 30);
scene.add(dirLight);

// Water Setup
const waterGeometry = new THREE.PlaneGeometry(2000, 2000);
const water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);
    }),
    sunDirection: dirLight.position.clone().normalize(),
    sunColor: 0xffffff,
    waterColor: 0x00416a,
    distortionScale: 3.7,
    fog: scene.fog !== undefined
});
water.rotation.x = -Math.PI / 2;
water.position.y = -2.0;
scene.add(water);

// Clock & Input Tracking
const clock = new THREE.Clock();
let helicopterPlayer = null;
let oilRigModel = null;
let landingLightOn = false;

let redLight, greenLight, strobeLight, landingLight;
let redBulb, greenBulb, strobeBulb;
let heliLightsGroup;

const keys = {};

window.addEventListener('keydown', (e) => {
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyF', 'KeyE'].includes(e.code)) {
        e.preventDefault();
    }
    keys[e.code] = true;
    if (!helicopterPlayer) return;

    if (e.code === 'KeyE') {
        helicopterPlayer.toggleEngine();
    }
    if (e.code === 'KeyG') {
        helicopterPlayer.toggleLandingGear();
    }
    if (e.code === 'KeyL') {
        landingLightOn = !landingLightOn;
        console.log("Landing Light: " + (landingLightOn ? "ON" : "OFF"));
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Camera Zoom Controls
let cameraDistance = 25;
window.addEventListener('wheel', (e) => {
    cameraDistance += e.deltaY * 0.05;
    cameraDistance = Math.max(10, Math.min(60, cameraDistance));
});

const loader = new GLTFLoader();

// Load Environment & Helicopter
loader.load('oil_rig.glb', (gltf) => {
    oilRigModel = gltf.scene;
    // Raised the oil rig model up by +0.5m on Y so the entire physical deck matches the collision boundary
    oilRigModel.position.set(30, -0.95, 0); 
    scene.add(oilRigModel);

    loader.load('helicopter.glb', (gltfHeli) => {
        const model = gltfHeli.scene;
        
        // Spawn matching the new elevated helipad height (37.85)
        model.position.set(36.80, 37.85, -65.46);
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

        const mixer = new THREE.AnimationMixer(model);
        helicopterPlayer = new HelicopterPlayer(model, gltfHeli.animations, mixer);
    });
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    water.material.uniforms['time'].value += delta * 0.3;

    if (helicopterPlayer && helicopterPlayer.model) {
        // Delegate all movement and physical state updates to player.js
        helicopterPlayer.update(delta, keys);
        
        water.position.x = helicopterPlayer.model.position.x;
        water.position.z = helicopterPlayer.model.position.z;

        // Sync lights with electrical state from player
        const electricalActive = helicopterPlayer.isElectricalOn;
        if (redLight && greenLight && strobeLight && landingLight) {
            redLight.intensity = electricalActive ? 2.5 : 0.0;
            greenLight.intensity = electricalActive ? 2.5 : 0.0;
            redBulb.visible = electricalActive;
            greenBulb.visible = electricalActive;

            const isStrobeActive = electricalActive && ((Math.floor(time * 4) % 2) === 0);
            strobeLight.intensity = isStrobeActive ? 8.0 : 0.0;
            strobeBulb.visible = isStrobeActive;

            landingLight.intensity = (electricalActive && landingLightOn) ? 18.0 : 0.0;
        }

        // Camera Follow Setup
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