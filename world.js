import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Water } from 'three/addons/objects/Water.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { HelicopterPlayer } from './player.js';

// Scene, Camera, and Renderer setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
scene.fog = new THREE.FogExp2(0x111122, 0.007);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- TRANSFORM CONTROLS FOR LIGHT POSITIONING ---
const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);

transformControls.addEventListener('dragging-changed', (event) => {
    // Disable camera movement while dragging gizmos if needed
});

transformControls.addEventListener('change', () => {
    if (transformControls.object) {
        const pos = transformControls.object.position;
        console.log(`Active Light Position -> x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`);
    }
});
// ----------------------------------------------

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(30, 50, 30);
scene.add(dirLight);

// --- SCREEN CORNER COORDINATE SYSTEM GIZMO ---
const axesHelper = new THREE.AxesHelper(1.2);
scene.add(axesHelper);
// ---------------------------------------------

// --- PHOTOREALISTIC WATER SETUP ---
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
// ------------------------------------

// --- STANDALONE HELIPORT APRON ---
function createHeliportApron() {
    const apronGroup = new THREE.Group();

    const apronCanvas = document.createElement('canvas');
    apronCanvas.width = 1024;
    apronCanvas.height = 1024;
    const aCtx = apronCanvas.getContext('2d');

    aCtx.fillStyle = '#787878';
    aCtx.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 6000; i++) {
        aCtx.fillStyle = Math.random() > 0.5 ? '#6e6e6e' : '#828282';
        aCtx.fillRect(Math.random() * 1024, Math.random() * 1024, 4, 4);
    }

    aCtx.strokeStyle = '#555555';
    aCtx.lineWidth = 3;
    for (let p = 0; p <= 1024; p += 128) {
        aCtx.beginPath(); aCtx.moveTo(p, 0); aCtx.lineTo(p, 1024); aCtx.stroke();
        aCtx.beginPath(); aCtx.moveTo(0, p); aCtx.lineTo(1024, p); aCtx.stroke();
    }

    aCtx.fillStyle = 'rgba(30, 30, 30, 0.4)';
    aCtx.beginPath(); aCtx.arc(220, 220, 50, 0, Math.PI * 2); aCtx.fill();
    aCtx.beginPath(); aCtx.arc(804, 220, 50, 0, Math.PI * 2); aCtx.fill();
    aCtx.beginPath(); aCtx.arc(220, 804, 50, 0, Math.PI * 2); aCtx.fill();
    aCtx.beginPath(); aCtx.arc(804, 804, 50, 0, Math.PI * 2); aCtx.fill();

    aCtx.strokeStyle = '#f1c40f';
    aCtx.lineWidth = 10;
    aCtx.strokeRect(80, 80, 864, 864);

    aCtx.beginPath();
    aCtx.arc(512, 512, 130, 0, Math.PI * 2);
    aCtx.strokeStyle = '#ffffff';
    aCtx.lineWidth = 18;
    aCtx.stroke();

    aCtx.fillStyle = '#ffffff';
    aCtx.fillRect(452, 392, 28, 240);
    aCtx.fillRect(544, 392, 28, 240);
    aCtx.fillRect(452, 498, 120, 36);

    aCtx.font = 'bold 42px sans-serif';
    aCtx.fillStyle = '#f1c40f';
    aCtx.fillText('P1', 160, 160);
    aCtx.fillText('P2', 800, 160);
    aCtx.fillText('P3', 160, 900);
    aCtx.fillText('P4', 800, 900);

    const apronTexture = new THREE.CanvasTexture(apronCanvas);

    const apronGeo = new THREE.PlaneGeometry(36, 36);
    apronGeo.rotateX(-Math.PI / 2);
    const apronMat = new THREE.MeshStandardMaterial({
        map: apronTexture,
        roughness: 0.5,
        metalness: 0.1
    });
    const apronMesh = new THREE.Mesh(apronGeo, apronMat);
    apronMesh.position.set(0, -1.48, 0); 
    apronGroup.add(apronMesh);

    scene.add(apronGroup);
}

createHeliportApron();
// -------------------------------------------------------------

// --- INDEPENDENT WIND SYSTEM ---
const windState = {
    timer: 0.0,
    duration: 15.0,
    current: new THREE.Vector3(0.5, 0, 0.5),
    target: new THREE.Vector3(1.0, 0, 0.5)
};

function updateWind(delta) {
    windState.timer += delta;

    if (windState.timer > windState.duration) {
        windState.timer = 0.0;
        windState.duration = Math.random() * 20 + 10;

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2.3 + 0.2;
        windState.target.set(Math.cos(angle) * speed, 0, Math.sin(angle) * speed);
    }

    windState.current.lerp(windState.target, delta * 0.4);
}
// -------------------------------

// --- DYNAMIC ATMOSPHERIC WEATHER SYSTEM ---
const weatherState = {
    timer: 0.0,
    nextDuration: 30.0,
    targetType: 'CLEAR',
    turbulenceIntensity: 0.0,
    targetTurbulence: 0.0,
    targetFogDensity: 0.005,
    targetAmbientIntensity: 1.2,
    targetDirLightIntensity: 2.0,
    targetRainOpacity: 0.0,
    targetBgColor: new THREE.Color(0x111122)
};

const rainCount = 1000;
const rainGeometry = new THREE.BufferGeometry();
const rainPositions = new Float32Array(rainCount * 6);

for (let i = 0; i < rainCount * 6; i += 6) {
    const x = (Math.random() - 0.5) * 100;
    const y = Math.random() * 50;
    const z = (Math.random() - 0.5) * 100;
    const length = 1.8;

    rainPositions[i] = x;
    rainPositions[i + 1] = y;
    rainPositions[i + 2] = z;
    rainPositions[i + 3] = x;
    rainPositions[i + 4] = y - length;
    rainPositions[i + 5] = z;
}

rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

const rainMaterial = new THREE.LineBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.0
});

const rainParticles = new THREE.LineSegments(rainGeometry, rainMaterial);
rainParticles.visible = false;
scene.add(rainParticles);

function setWeatherTargets(type) {
    if (type === 'CLEAR') {
        weatherState.targetTurbulence = 0.0;
        weatherState.targetFogDensity = 0.005;
        weatherState.targetAmbientIntensity = 1.2;
        weatherState.targetDirLightIntensity = 2.0;
        weatherState.targetRainOpacity = 0.0;
        weatherState.targetBgColor.setHex(0x111122);
    } 
    else if (type === 'RAIN') {
        weatherState.targetTurbulence = 0.0;
        weatherState.targetFogDensity = 0.010;
        weatherState.targetAmbientIntensity = 0.8;
        weatherState.targetDirLightIntensity = 1.0;
        weatherState.targetRainOpacity = 0.5;
        weatherState.targetBgColor.setHex(0x0c0c18);
    } 
    else if (type === 'STORM') {
        weatherState.targetTurbulence = 0.03;
        weatherState.targetFogDensity = 0.020;
        weatherState.targetAmbientIntensity = 0.5;
        weatherState.targetDirLightIntensity = 0.5;
        weatherState.targetRainOpacity = 0.6;
        weatherState.targetBgColor.setHex(0x06060a);
    }
}

function getRandomWeatherType(currentType) {
    const types = ['CLEAR', 'RAIN', 'STORM'];
    const filteredTypes = types.filter(t => t !== currentType);
    return filteredTypes[Math.floor(Math.random() * filteredTypes.length)];
}

weatherState.nextDuration = Math.random() * 30 + 20;
setWeatherTargets('CLEAR');

function updateWeather(delta, playerPos) {
    weatherState.timer += delta;

    if (weatherState.timer > weatherState.nextDuration) {
        weatherState.timer = 0.0;
        weatherState.nextDuration = Math.random() * 30 + 20;
        weatherState.targetType = getRandomWeatherType(weatherState.targetType);
        setWeatherTargets(weatherState.targetType);
    }

    const lerpSpeed = delta * 0.3; 
    weatherState.turbulenceIntensity += (weatherState.targetTurbulence - weatherState.turbulenceIntensity) * lerpSpeed;
    scene.fog.density += (weatherState.targetFogDensity - scene.fog.density) * lerpSpeed;
    ambientLight.intensity += (weatherState.targetAmbientIntensity - ambientLight.intensity) * lerpSpeed;
    dirLight.intensity += (weatherState.targetDirLightIntensity - dirLight.intensity) * lerpSpeed;
    rainMaterial.opacity += (weatherState.targetRainOpacity - rainMaterial.opacity) * lerpSpeed;
    scene.background.lerp(weatherState.targetBgColor, lerpSpeed);

    rainParticles.visible = rainMaterial.opacity > 0.01;

    if (rainParticles.visible && playerPos) {
        rainParticles.position.copy(playerPos);
        const positions = rainGeometry.attributes.position.array;
        for (let i = 0; i < rainCount * 6; i += 6) {
            const fallSpeed = 3.5;
            positions[i + 1] -= fallSpeed;
            positions[i + 4] -= fallSpeed;

            if (positions[i + 1] < -5) {
                positions[i] = playerPos.x + (Math.random() - 0.5) * 100;
                positions[i + 1] = 40 + Math.random() * 10;
                positions[i + 2] = playerPos.z + (Math.random() - 0.5) * 100;
                positions[i + 3] = positions[i];
                positions[i + 4] = positions[i + 1] - 1.8;
                positions[i + 5] = positions[i + 2];
            }
        }
        rainGeometry.attributes.position.needsUpdate = true;
    }
}
// -----------------------------

// Clock & Game State
const clock = new THREE.Clock();
let helicopterPlayer = null;

let electricalOn = false;   // Toggled with [Q] (Starts OFF)
let fuelOn = false;         // Toggled with [F] (Starts OFF)
let landingLightOn = false; // Toggled with [L] (Starts OFF)
let gearDeployed = true;    // Toggled with [G] (Starts DOWN)

let redLight, greenLight, strobeLight, landingLight;
let redBulb, greenBulb, strobeBulb;
let heliLightsGroup;

const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!helicopterPlayer) return;

    if (e.code === 'KeyQ') {
        electricalOn = !electricalOn;
        console.log("Electrical System: " + (electricalOn ? "ON" : "OFF"));
    }
    if (e.code === 'KeyF') {
        fuelOn = !fuelOn;
        // Pass fuel state to player if player handles it internally, or manage it here
        if (helicopterPlayer.setFuelSystem) {
            helicopterPlayer.setFuelSystem(fuelOn);
        }
        console.log("Fuel System: " + (fuelOn ? "ON" : "OFF"));
    }
    if (e.code === 'KeyE') {
        helicopterPlayer.toggleEngine();
    }
    if (e.code === 'KeyG') {
        helicopterPlayer.toggleLandingGear();
        gearDeployed = !gearDeployed;
    }
    if (e.code === 'KeyL') {
        landingLightOn = !landingLightOn;
        console.log("Landing Light: " + (landingLightOn ? "ON" : "OFF"));
    }

    // --- CONTROLS TO SELECT LIGHTS FOR GIZMO ---
    if (e.code === 'Digit1' && redLight) {
        transformControls.attach(redLight);
        console.log("Attached TransformControls to: RED LIGHT [1]");
    }
    if (e.code === 'Digit2' && greenLight) {
        transformControls.attach(greenLight);
        console.log("Attached TransformControls to: GREEN LIGHT [2]");
    }
    if (e.code === 'Digit3' && strobeLight) {
        transformControls.attach(strobeLight);
        console.log("Attached TransformControls to: STROBE LIGHT [3]");
    }
    if (e.code === 'Digit4' && landingLight) {
        transformControls.attach(landingLight);
        console.log("Attached TransformControls to: LANDING LIGHT [4]");
    }
    if (e.code === 'Escape') {
        transformControls.detach();
        console.log("Detached TransformControls");
    }
    // ------------------------------------------
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
        model.position.set(0, -1.45, 0);
        scene.add(model);

        heliLightsGroup = new THREE.Group();

        // 1. Red Navigation Light (Port / Left Side)
        redLight = new THREE.PointLight(0xff0000, 2.5, 8);
        redLight.position.set(4.55, 1.50, 2.92);
        heliLightsGroup.add(redLight);
        redBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        redBulb.position.copy(redLight.position);
        heliLightsGroup.add(redBulb);

        // 2. Green Navigation Light (Starboard / Right Side)
        greenLight = new THREE.PointLight(0x00ff00, 2.5, 8);
        greenLight.position.set(5.09, 1.44, -1.00);
        heliLightsGroup.add(greenLight);
        greenBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        greenBulb.position.copy(greenLight.position);
        heliLightsGroup.add(greenBulb);

        // 3. Anti-Collision Strobe Light
        strobeLight = new THREE.PointLight(0xffffff, 8.0, 15);
        strobeLight.position.set(7.24, 4.39, 1.30);
        heliLightsGroup.add(strobeLight);
        strobeBulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        strobeBulb.position.copy(strobeLight.position);
        heliLightsGroup.add(strobeBulb);

        // 4. Landing Light (Spotlight) - Controlled by [L]
        landingLight = new THREE.SpotLight(0xffffee, 18.0, 60, Math.PI / 6, 0.4, 1);
        landingLight.position.set(-4.66, -0.04, -0.35);
        
        const landingTarget = new THREE.Object3D();
        landingTarget.position.set(-25, -6, 0);
        model.add(landingTarget);
        landingLight.target = landingTarget;
        
        heliLightsGroup.add(landingLight);

        model.add(heliLightsGroup);

        const mixer = new THREE.AnimationMixer(model);
        helicopterPlayer = new HelicopterPlayer(model, gltf.animations, mixer);

        console.log("Helicopter loaded in COLD STATE. Startup sequence: [Q] Electrical -> [F] Fuel -> [E] Engine -> [L] Landing Light.");
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
        console.error('An error occurred loading the model:', error);
    }
);

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
    updateWind(delta);

    if (helicopterPlayer && helicopterPlayer.model) {
        updateWeather(delta, helicopterPlayer.model.position);

        const prevPos = helicopterPlayer.model.position.clone();

        helicopterPlayer.update(delta, keys);

        const isGrounded = helicopterPlayer.model.position.y <= -1.40;
        if (isGrounded) {
            helicopterPlayer.model.position.x = prevPos.x;
            helicopterPlayer.model.position.z = prevPos.z;
            
            if (helicopterPlayer.velocity) helicopterPlayer.velocity.set(0, 0, 0);
            if (helicopterPlayer.speed) helicopterPlayer.speed = 0;
        }
        
        water.position.x = helicopterPlayer.model.position.x;
        water.position.z = helicopterPlayer.model.position.z;

        // Sync visual bulb positions with point light positions if dragged
        if (redLight && redBulb) redBulb.position.copy(redLight.position);
        if (greenLight && greenBulb) greenBulb.position.copy(greenLight.position);
        if (strobeLight && strobeBulb) strobeBulb.position.copy(strobeLight.position);

        // --- UPDATE HELICOPTER LIGHTS ---
        if (redLight && greenLight && strobeLight && landingLight) {
            // Nav lights and strobe come on automatically when electrical system [Q] is active
            redLight.intensity = electricalOn ? 2.5 : 0.0;
            greenLight.intensity = electricalOn ? 2.5 : 0.0;
            redBulb.visible = electricalOn;
            greenBulb.visible = electricalOn;

            const isStrobeActive = electricalOn && ((Math.floor(time * 4) % 2) === 0);
            strobeLight.intensity = isStrobeActive ? 8.0 : 0.0;
            strobeBulb.visible = isStrobeActive;

            // Landing light controlled separately by [L], dependent on electrical system and gear
            landingLight.intensity = (electricalOn && landingLightOn) ? 18.0 : 0.0;
        }
        // ---------------------------------

        // RTS Camera Positioning
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

    // --- LOCK AXES GIZMO TO BOTTOM-LEFT OF CAMERA VIEW ---
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    axesHelper.position.copy(camera.position)
        .addScaledVector(camDir, 3.5)
        .addScaledVector(camRight, -1.1)
        .addScaledVector(camUp, -0.8);
    // ---------------------------------------------------

    renderer.render(scene, camera);
}

animate();