import * as THREE from 'three';

export class WeatherSystem {
    constructor() {
        this.currentWeather = 'fine'; // 'fine', 'rain', 'storm'
        this.transitionTimer = 0.0;
        this.targetDuration = 60.0;

        // Wind vectors
        this.windVector = new THREE.Vector3(0, 0, 0);
        this.targetWind = new THREE.Vector3(0, 0, 0);

        // Rain particle system setup
        this.particleCount = 5000;
        this.rainParticles = null;
        this.rainGeo = null;
        this.rainMat = null;
        this.rainSpeeds = [];

        this.baseSunIntensity = 1.2;

        this.setupRainSystem();
    }

    setupRainSystem() {
        this.rainGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 6); // 2 points per raindrop segment
        this.rainSpeeds = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * 140;
            const y = Math.random() * 70;
            const z = (Math.random() - 0.5) * 140;
            const dropLength = 1.2 + Math.random() * 0.8;

            // Start point of drop
            positions[i * 6] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = z;

            // End point of drop
            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = y - dropLength;
            positions[i * 6 + 5] = z;

            this.rainSpeeds[i] = 50.0 + Math.random() * 30.0;
        }

        this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.rainMat = new THREE.LineBasicMaterial({
            color: 0xcceeff,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            linewidth: 1,
        });

        this.rainParticles = new THREE.LineSegments(this.rainGeo, this.rainMat);
        this.rainParticles.visible = false;
    }

    getWeatherEffects() {
        switch (this.currentWeather) {
            case 'rain':
                return {
                    visibility: 'moderate',
                    dragMultiplier: 1.08,
                    liftMultiplier: 0.97,
                    fogDensity: 0.0025,
                    fogColor: 0x8899aa,
                    sunIntensity: 0.7,
                    sunColor: 0x99aabb,
                };
            case 'storm':
                return {
                    visibility: 'clearer_storm',
                    dragMultiplier: 1.15,
                    liftMultiplier: 0.92,
                    fogDensity: 0.005, // Significantly reduced density (was 0.02) for clear vision
                    fogColor: 0x445566,   // Lighter slate gray (was 0x222b35)
                    sunIntensity: 0.5,    // Increased intensity (was 0.2)
                    sunColor: 0x667788,
                };
            case 'fine':
            default:
                return {
                    visibility: 'good',
                    dragMultiplier: 1.0,
                    liftMultiplier: 1.0,
                    fogDensity: 0.0012,
                    fogColor: 0xcce0ff,
                    sunIntensity: 1.2,
                    sunColor: 0xffffeb,
                };
        }
    }

    update(delta, scene, cameraPos, sunLight) {
        this.transitionTimer += delta;

        if (this.transitionTimer >= this.targetDuration) {
            this.transitionTimer = 0.0;
            this.targetDuration = 45.0 + Math.random() * 60.0;
            this.rollNewWeather();
        }

        const effects = this.getWeatherEffects();

        // Smoother, gentler wind vector transitions
        this.windVector.lerp(this.targetWind, delta * 0.2);

        // Dynamic fog updates
        if (scene.fog) {
            scene.fog.color.lerp(new THREE.Color(effects.fogColor), delta * 0.5);
            if (scene.fog.isFogExp2) {
                scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, effects.fogDensity, delta * 0.5);
            }
        }

        this.baseSunIntensity = THREE.MathUtils.lerp(this.baseSunIntensity, effects.sunIntensity, delta * 0.5);

        if (sunLight) {
            sunLight.color.lerp(new THREE.Color(effects.sunColor), delta * 0.5);
            sunLight.intensity = this.baseSunIntensity;
        }

        // Rain animation & wind-slanting physics
        if (this.rainParticles && this.rainParticles.visible) {
            this.rainParticles.position.set(cameraPos.x, cameraPos.y, cameraPos.z);

            const positions = this.rainGeo.attributes.position.array;
            const isStorm = this.currentWeather === 'storm';
            const windX = this.windVector.x * 0.08;
            const windZ = this.windVector.z * 0.08;

            for (let i = 0; i < this.particleCount; i++) {
                const speed = this.rainSpeeds[i] * (isStorm ? 1.4 : 1.0) * delta;
                const dropLength = isStorm ? 1.8 : 1.4;

                let topY = positions[i * 6 + 1] - speed;
                let botY = topY - dropLength;

                // Loop particles when reaching floor threshold
                if (topY < -25) {
                    topY = 45;
                    botY = topY - dropLength;
                    positions[i * 6] = (Math.random() - 0.5) * 140;
                    positions[i * 6 + 2] = (Math.random() - 0.5) * 140;
                }

                // Apply wind lean
                positions[i * 6 + 3] = positions[i * 6] - windX;
                positions[i * 6 + 5] = positions[i * 6 + 2] - windZ;

                positions[i * 6 + 1] = topY;
                positions[i * 6 + 4] = botY;
            }

            this.rainGeo.attributes.position.needsUpdate = true;
        }

        return {
            weatherType: this.currentWeather,
            wind: this.windVector,
            effects: effects,
        };
    }

    rollNewWeather() {
        const rand = Math.random();
        if (rand < 0.35) {
            this.setWeather('fine');
        } else if (rand < 0.75) {
            this.setWeather('rain');
        } else {
            this.setWeather('storm');
        }
    }

    setWeather(type) {
        this.currentWeather = type;
        if (type === 'fine') {
            this.targetWind.set((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5);
            this.rainMat.opacity = 0.0;
            this.rainParticles.visible = false;
        } else if (type === 'rain') {
            this.targetWind.set((Math.random() - 0.5) * 3.5, 0, (Math.random() - 0.5) * 3.5);
            this.rainMat.color.setHex(0xaaccff);
            this.rainMat.opacity = 0.5;
            this.rainParticles.visible = true;
        } else if (type === 'storm') {
            this.targetWind.set((Math.random() - 0.5) * 6.0, (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 6.0);
            this.rainMat.color.setHex(0xcceeff);
            this.rainMat.opacity = 0.50; // Lower opacity (was 0.90) so rain drops don't block vision
            this.rainParticles.visible = true;
        }
    }
}