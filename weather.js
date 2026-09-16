import * as THREE from 'three';

export class WeatherSystem {
    constructor() {
        this.windTimer = 0.0;
        this.currentWind = new THREE.Vector3(0, 0, 0);
        this.targetWind = new THREE.Vector3(0, 0, 0);
        this.windSpeed = 0.0;
        this.targetWindSpeed = 0.0;
    }

    update(delta) {
        this.windTimer += delta;
        if (this.windTimer > 6.0) {
            this.windTimer = 0.0;
            const randomAngle = Math.random() * Math.PI * 2;
            this.targetWindSpeed = 0.2 + Math.random() * 2.3; 
            this.targetWind.set(Math.cos(randomAngle), 0, Math.sin(randomAngle)).multiplyScalar(this.targetWindSpeed);
        }
        this.windSpeed += (this.targetWindSpeed - this.windSpeed) * Math.min(delta * 0.5, 1.0);
        this.currentWind.lerp(this.targetWind, Math.min(delta * 0.5, 1.0));
        
        return this.currentWind;
    }
}