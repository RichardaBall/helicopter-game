import * as THREE from 'three';

export class Helicopter {
    constructor(scene) {
        this.group = new THREE.Group();

        // Material styling (Glossy rescue/offshore navy-blue & dark glass)
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x122338, metalness: 0.8, roughness: 0.2 });
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x1b365d, metalness: 0.6, roughness: 0.3 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.8 });
        const accentMat = new THREE.MeshStandardMaterial({ color: 0xd9534f, metalness: 0.4, roughness: 0.4 }); // SAR orange/red stripe
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });

        // 1. AW189 Main Cabin Body (Extended super-medium profile)
        const bodyGeo = new THREE.BoxGeometry(1.4, 1.1, 3.2);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0, 0);
        body.castShadow = true;
        this.group.add(body);

        // 2. Sleek Aerodynamic Nose Cone
        const noseGeo = new THREE.ConeGeometry(0.7, 1.4, 8);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, -0.05, 1.9);
        nose.castShadow = true;
        this.group.add(nose);

        // 3. Cockpit Windscreen (Wrapped glass style)
        const glassGeo = new THREE.BoxGeometry(1.3, 0.7, 1.2);
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(0, 0.2, 1.1);
        this.group.add(glass);

        // 4. Twin Engine Cowlings (Top-mounted characteristic of AW189)
        const engineGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8);
        const engineLeft = new THREE.Mesh(engineGeo, darkMetal);
        engineLeft.rotation.x = Math.PI / 2;
        engineLeft.position.set(0.4, 0.7, 0.2);
        this.group.add(engineLeft);

        const engineRight = engineLeft.clone();
        engineRight.position.set(-0.4, 0.7, 0.2);
        this.group.add(engineRight);

        // 5. Distinctive Accent Stripe (Offshore/SAR styling)
        const stripeGeo = new THREE.BoxGeometry(1.42, 0.15, 3.22);
        const stripe = new THREE.Mesh(stripeGeo, accentMat);
        stripe.position.set(0, -0.1, 0);
        this.group.add(stripe);

        // 6. Tapered Tail Boom
        const tailGeo = new THREE.ConeGeometry(0.3, 3.0, 6);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 0.1, -2.5);
        this.group.add(tail);

        // 7. Tail Fin & Tail Rotor
        const finGeo = new THREE.BoxGeometry(0.1, 0.8, 0.6);
        const fin = new THREE.Mesh(finGeo, bodyMat);
        fin.position.set(0.15, 0.5, -3.8);
        this.group.add(fin);

        const tailBladeGeo = new THREE.BoxGeometry(0.05, 0.9, 0.1);
        this.tailRotor = new THREE.Mesh(tailBladeGeo, darkMetal);
        this.tailRotor.position.set(0.22, 0.5, -3.8);
        this.group.add(this.tailRotor);

        // 8. Main Rotor Mast & Blades
        const mastGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
        const mast = new THREE.Mesh(mastGeo, darkMetal);
        mast.position.set(0, 0.85, 0);
        this.group.add(mast);

        const bladeGeo = new THREE.BoxGeometry(6.0, 0.04, 0.25);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5 });
        this.rotor = new THREE.Mesh(bladeGeo, bladeMat);
        this.rotor.position.set(0, 1.05, 0);
        this.group.add(this.rotor);

        // Initial placement
        this.group.position.set(0, 2.0, 0);
        scene.add(this.group);

        // Physics & Flight tracking properties
        this.keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, KeyW: false, KeyS: false, KeyA: false, KeyD: false };
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.maxSpeed = 0.35;
        this.acceleration = 0.015;
        this.friction = 0.94; // Smooth gliding drift

        window.addEventListener('keydown', (e) => { if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false; });
    }

    update() {
        // Spin rotors rapidly
        this.rotor.rotation.y += 0.8;
        this.tailRotor.rotation.x += 0.9;

        // Apply acceleration based on input (momentum-based flight)
        let targetVelocityX = 0;
        let targetVelocityZ = 0;

        if (this.keys.ArrowUp || this.keys.KeyW) targetVelocityZ -= this.maxSpeed;
        if (this.keys.ArrowDown || this.keys.KeyS) targetVelocityZ += this.maxSpeed;
        if (this.keys.ArrowLeft || this.keys.KeyA) targetVelocityX -= this.maxSpeed;
        if (this.keys.ArrowRight || this.keys.KeyD) targetVelocityX += this.maxSpeed;

        // Smooth momentum transition
        this.velocity.x += (targetVelocityX - this.velocity.x) * 0.1;
        this.velocity.z += (targetVelocityZ - this.velocity.z) * 0.1;

        // Move position
        this.group.position.x += this.velocity.x;
        this.group.position.z += this.velocity.z;

        // Realistic banking/tilting effect when steering (helo physics)
        const targetRoll = -this.velocity.x * 1.2;  // Bank sideways when turning left/right
        const targetPitch = this.velocity.z * 1.2;  // Pitch forward/backward when moving
        
        this.group.rotation.z += (targetRoll - this.group.rotation.z) * 0.1;
        this.group.rotation.x += (targetPitch - this.group.rotation.x) * 0.1;

        // Point nose slightly toward movement direction if moving
        if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
            const targetHeading = Math.atan2(this.velocity.x, this.velocity.z);
            // Smooth turn rotation
            let diff = targetHeading - this.group.rotation.y;
            // Normalize angle diff
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.group.rotation.y += diff * 0.1;
        }
    }
}