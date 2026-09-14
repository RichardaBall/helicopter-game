import * as THREE from 'three';

export class Helicopter {
    constructor(scene) {
        // Create a group to hold all parts of the helicopter together
        this.group = new THREE.Group();

        // 1. Helicopter Main Body
        const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 2.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.7, roughness: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        this.group.add(body);

        // 2. Cockpit Glass
        const cockpitGeo = new THREE.BoxGeometry(1.0, 0.6, 1.2);
        const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.set(0, 0.1, 0.7);
        this.group.add(cockpit);

        // 3. Spinning Main Rotor Blades
        const bladeGeo = new THREE.BoxGeometry(4.5, 0.05, 0.3);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        this.rotor = new THREE.Mesh(bladeGeo, bladeMat);
        this.rotor.position.set(0, 0.5, 0);
        this.group.add(this.rotor);

        // 4. Tail Boom
        const tailGeo = new THREE.BoxGeometry(0.2, 0.2, 2.0);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(0, 0.2, -2.0);
        this.group.add(tail);

        // Initial position in the world
        this.group.position.set(0, 1.5, 0);
        scene.add(this.group);

        // Controls tracking
        this.keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, KeyW: false, KeyS: false, KeyA: false, KeyD: false };
        this.speed = 0.25;

        window.addEventListener('keydown', (e) => { if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false; });
    }

    update() {
        // Continuously spin the helicopter rotor blades
        this.rotor.rotation.y += 0.6;

        // Handle movement via keyboard inputs
        if (this.keys.ArrowUp || this.keys.KeyW) { this.group.position.z -= this.speed; this.group.rotation.y = 0; }
        if (this.keys.ArrowDown || this.keys.KeyS) { this.group.position.z += this.speed; this.group.rotation.y = Math.PI; }
        if (this.keys.ArrowLeft || this.keys.KeyA) { this.group.position.x -= this.speed; this.group.rotation.y = Math.PI / 2; }
        if (this.keys.ArrowRight || this.keys.KeyD) { this.group.position.x += this.speed; this.group.rotation.y = -Math.PI / 2; }
    }
}