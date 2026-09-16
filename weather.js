import * as THREE from 'three';

export class WeatherSystem {
    constructor() {
        this.currentWeather = 'fine'; // 'fine', 'rain', 'storm'
        this.transitionTimer = 0.0;
        this.targetDuration = 60.0; // Seconds before considering a weather change

        // Wind vectors for each weather type
        this.windVector = new THREE.Vector3(0, 0, 0);
        this.targetWind = new THREE.Vector3(0, 0, 0);

        // Visual elements setup
        this.rainParticles = null;
        this.rainGeo = null;
        this.rainMat = null;
        
        this.setupRainSystem();
    }

    setupRainSystem() {
        const particleCount = 2000;
        this.rainGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 80;
            positions[i + 1] = Math.random() * 50;
            positions[i + 2] = (Math.random() - 0.5) * 80;
        }

        this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.rainMat = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.15,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
        });

        this.rainParticles = new THREE.Points(this.rainGeo, this.rainMat);
        this.rainParticles.visible = false;
    }

    getWeatherEffects() {
        switch (this.currentWeather) {
            case 'rain':
                return {
                    visibility: 'bad',
                    dragMultiplier: 1.15,
                    liftMultiplier: 0.95,
                    fogDensity: 0.015,
                    sunIntensity: 0.6,
                };
            case 'storm':
                return {
                    visibility: 'worse',
                    dragMultiplier: 1.35,
                    liftMultiplier: 0.85,
                    fogDensity: 0.04,
                    sunIntensity: 0.2,
                };
            case 'fine':
            default:
                return {
                    visibility: 'good',
                    dragMultiplier: 1.0,
                    liftMultiplier: 1.0,
                    fogDensity: 0.002,
                    sunIntensity: 1.2,
                };
        }
    }

    update(delta, scene, cameraPos) {
        this.transitionTimer += delta;

        // Random dynamic transition check every interval
        if (this.transitionTimer >= this.targetDuration) {
            this.transitionTimer = 0.0;
            this.targetDuration = 45.0 + Math.random() * 60.0; // 45 to 105 seconds per weather phase
            this.rollNewWeather();
        }

        // Smooth wind transitions
        this.windVector.lerp(this.targetWind, delta * 0.5);

        // Keep rain particles locked around camera position for a continuous effect
        if (this.rainParticles && this.rainParticles.visible) {
            this.rainParticles.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
            
            // Animate rain drops falling down
            const positions = this.rainGeo.attributes.position.array;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] -= delta * 35.0; // Fall speed
                if (positions[i] < 0) positions[i] = 50; // Reset to top
            }
            this.rainGeo.attributes.position.needsUpdate = true;
        }

        return {
            weatherType: this.currentWeather,
            wind: this.windVector,
            effects: this.getWeatherEffects(),
        };
    }

    rollNewWeather() {
        const rand = Math.random();
        if (rand < 0.5) {
            this.currentWeather = 'fine';
            this.targetWind.set((Math.random() - 0.5) * 2.0, 0, (Math.random() - 0.5) * 2.0);
            this.rainMat.opacity = 0.0;
            this.rainParticles.visible = false;
            console.log("Weather transition: Shifting to FINE weather (Good visibility).");
        } else if (rand < 0.8) {
            this.currentWeather = 'rain';
            this.targetWind.set((Math.random() - 0.5) * 6.0, 0, (Math.random() - 0.5) * 6.0);
            this.rainMat.color.setHex(0xaaaaaa);
            this.rainMat.size = 0.15;
            this.rainMat.opacity = 0.6;
            this.rainParticles.visible = true;
            console.log("Weather transition: Shifting to RAIN (Bad visibility, slippery aerodynamics).");
        } else {
            this.currentWeather = 'storm';
            this.targetWind.set((Math.random() - 0.5) * 16.0, (Math.random() - 0.5) * 4.0, (Math.random() - 0.5) * 16.0);
            this.rainMat.color.setHex(0xdddddd);
            this.rainMat.size = 0.25;
            this.rainMat.opacity = 0.85;
            this.rainParticles.visible = true;
            console.log("Weather transition: Shifting to STORM (Worse visibility, high turbulence & drag).");
        }
    }
}