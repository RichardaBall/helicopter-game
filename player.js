import * as THREE from 'three';

export class HelicopterPlayer {
    constructor(model, animations, mixer) {
        this.model = model;
        this.mixer = mixer;
        this.actions = {};
        
        // Prevent browser tab from closing on Ctrl+W
        window.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.code === 'KeyW') {
                event.preventDefault();
            }
        });
        
        if (animations && Array.isArray(animations)) {
            animations.forEach((clip) => {
                const action = this.mixer.clipAction(clip);
                this.actions[clip.name] = action;
            });
        }

        this.isElectricalOn = false; 
        this.qKeyWasPressed = false; 

        this.isFuelPumpOn = false;   // Corrected to false so pressing 'F' turns it ON
        this.fKeyWasPressed = false; 
        this.fuelStarvationTimer = 0.0; 

        this.isEngineRunning = false;
        this.enginePower = 0.0;       
        this.targetEnginePower = 0.0; 

        this.isGearUp = false; 

        // --- AW189 Specs & Limits ---
        this.dryWeightKg = 4600;       
        this.fuelKg = 800;            
        this.passengerCount = 6;      
        this.passengerAvgKg = 85;     
        this.baselineMassKg = 6000; 

        this.maxMoveSpeed = 22.0;       
        this.maxTaxiSpeed = 2.25;       
        this.maxTurnSpeed = 1.5;        
        this.maxTaxiTurnSpeed = 0.75;   
        this.maxAltitudeSpeed = 8.0;    

        this.currentMoveSpeed = 0.0;
        this.currentTurnSpeed = 0.0;
        this.currentAltitudeSpeed = 0.0;

        // Heights
        this.helipadAltitude = 37.85;
        this.seaLevel = 0.0;
        this.landingHeightOffset = 0.9; 

        this.wasOnGround = true;
    }

    getTotalMass() {
        return this.dryWeightKg + this.fuelKg + (this.passengerCount * this.passengerAvgKg);
    }

    getCurrentGroundLevel() {
        const helipadCenter = new THREE.Vector2(36.80, -65.46);
        const currentPos2D = new THREE.Vector2(this.model.position.x, this.model.position.z);
        const distanceFromHelipad = currentPos2D.distanceTo(helipadCenter);

        if (distanceFromHelipad < 12.0) {
            return this.helipadAltitude + this.landingHeightOffset;
        }
        
        return this.seaLevel;
    }

    toggleElectrical() {
        this.isElectricalOn = !this.isElectricalOn;
        console.log(`AW189: Electrical System ${this.isElectricalOn ? 'ON' : 'OFF'}`);
    }

    toggleFuelPump() {
        this.isFuelPumpOn = !this.isFuelPumpOn;
        console.log(`AW189: Fuel Pump ${this.isFuelPumpOn ? 'ON' : 'OFF'}`);
        if (this.isFuelPumpOn) {
            this.fuelStarvationTimer = 0.0;
        }
    }

    toggleEngine() {
        if (!this.isElectricalOn && this.targetEnginePower === 0) {
            console.warn("AW189: Cannot start engines! Electrical system is OFF. Press 'Q'.");
            return;
        }

        if (this.fuelKg <= 0 && this.targetEnginePower === 0) {
            console.warn("AW189: Cannot start engines! Out of fuel.");
            return;
        }

        if (!this.isFuelPumpOn && this.targetEnginePower === 0) {
            console.warn("AW189: Cannot start engines! Fuel pump is OFF. Press 'F'.");
            return;
        }

        if (this.targetEnginePower > 0) {
            this.targetEnginePower = 0.0;
            this.isEngineRunning = false;
            console.log("AW189: Engine fuel cutoff engaged.");
        } else {
            this.targetEnginePower = 1.0;
            this.isEngineRunning = true;
            this.fuelStarvationTimer = 0.0;
            console.log("AW189: Engines igniting. Spooling up...");
            
            for (let name in this.actions) {
                if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                    const action = this.actions[name];
                    if (!action.isRunning()) action.reset().play();
                }
            }
        }
    }

    toggleLandingGear() {
        if (!this.isElectricalOn) {
            console.warn("AW189: Landing gear unpowered! Turn on electrical system ('Q').");
            return;
        }

        let gearAction = null;
        for (let name in this.actions) {
            if (name.toLowerCase().includes('gear') || name.toLowerCase().includes('landing')) {
                gearAction = this.actions[name];
                break;
            }
        }

        if (!gearAction) return;

        gearAction.paused = false;
        gearAction.timeScale = this.isGearUp ? -1 : 1;
        gearAction.setLoop(THREE.LoopOnce, 1);
        gearAction.clampWhenFinished = true;
        gearAction.play();
        
        this.isGearUp = !this.isGearUp;
        console.log(`Landing Gear ${this.isGearUp ? 'Retracting' : 'Deploying'}`);
    }

    update(delta, keys, windVector) {
        if (this.mixer) this.mixer.update(delta);

        if (keys && keys['KeyQ']) {
            if (!this.qKeyWasPressed) { this.toggleElectrical(); this.qKeyWasPressed = true; }
        } else { this.qKeyWasPressed = false; }

        if (keys && keys['KeyF']) {
            if (!this.fKeyWasPressed) { this.toggleFuelPump(); this.fKeyWasPressed = true; }
        } else { this.fKeyWasPressed = false; }

        // --- 10-Second Fuel Starvation Logic ---
        if (this.targetEnginePower > 0 && !this.isFuelPumpOn) {
            this.fuelStarvationTimer += delta;
            if (this.fuelStarvationTimer >= 10.0 && this.targetEnginePower > 0) {
                this.targetEnginePower = 0.0;
                this.isEngineRunning = false;
                console.log("AW189: Engines shutdown due to fuel starvation (10 seconds elapsed).");
            }
        }

        const activeGroundLevel = this.getCurrentGroundLevel();
        const isOnGround = this.model.position.y <= activeGroundLevel + 0.05;

        // --- Complete Stop Upon Impact ---
        if (!this.wasOnGround && isOnGround) {
            this.currentMoveSpeed = 0.0;
            this.currentTurnSpeed = 0.0;
            this.currentAltitudeSpeed = 0.0;
        }

        // Engine power interpolation (Spool up / Coast down)
        if (this.enginePower !== this.targetEnginePower) {
            const rate = 0.035; 
            const diff = this.targetEnginePower - this.enginePower;
            this.enginePower += diff * Math.min(delta * rate * 10.0, 1.0);
            if (Math.abs(this.targetEnginePower - this.enginePower) < 0.001) {
                this.enginePower = this.targetEnginePower;
            }
        }

        // Rotor animation sync
        for (let name in this.actions) {
            if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                const action = this.actions[name];
                if (isOnGround && this.targetEnginePower === 0 && this.enginePower <= 0.001) {
                    if (action.isRunning()) action.stop();
                } else {
                    const activeTimeScale = Math.max(this.enginePower * 1.2, 0.1);
                    action.timeScale = activeTimeScale;
                    if (activeTimeScale > 0 && !action.isRunning()) action.reset().play();
                }
            }
        }

        // Lock controls if engine is completely dead and resting on the ground
        if (isOnGround && this.targetEnginePower === 0 && this.enginePower <= 0.001) {
            this.currentMoveSpeed = 0.0;
            this.currentTurnSpeed = 0.0;
            this.currentAltitudeSpeed = 0.0;
            this.model.position.y = activeGroundLevel;
            this.wasOnGround = isOnGround;
            return;
        }

        const currentMass = this.getTotalMass();
        const massFactor = this.baselineMassKg / currentMass; 

        let activeSpeedLimit = (isOnGround ? this.maxTaxiSpeed : this.maxMoveSpeed) * Math.max(this.enginePower, 0.2);
        const activeTurnSpeed = (isOnGround ? this.maxTaxiTurnSpeed : this.maxTurnSpeed) * Math.min(massFactor, 1.2) * Math.max(this.enginePower, 0.2);

        // Input Mapping & Autorotation (4:1 Glide Ratio)
        let targetMove = 0;
        let targetTurn = 0;
        let targetAltitude = 0;

        if (keys['KeyA']) targetTurn += activeTurnSpeed;
        if (keys['KeyD']) targetTurn -= activeTurnSpeed;

        if (this.enginePower >= 0.45) {
            if (keys['KeyW']) targetMove -= activeSpeedLimit;
            if (keys['KeyS']) targetMove += activeSpeedLimit;

            if (keys['ShiftLeft'] || keys['ShiftRight']) {
                targetAltitude += (this.maxAltitudeSpeed * this.enginePower) * massFactor;
            }
            if (keys['ControlLeft'] || keys['ControlRight']) {
                targetAltitude -= (this.maxAltitudeSpeed * this.enginePower) * massFactor;
            }
        } else if (!isOnGround) {
            // --- AUTOROTATION MODE (4:1 Forward Glide Ratio) ---
            const sinkRate = 5.5 * massFactor;
            targetAltitude -= sinkRate;

            // 4:1 glide ratio means forward speed = sinkRate * 4.0
            targetMove -= sinkRate * 4.0;

            // Allow subtle player pitch adjustments during autorotation glide
            if (keys['KeyW']) targetMove -= activeSpeedLimit * 0.4;
            if (keys['KeyS']) targetMove += activeSpeedLimit * 0.4;
        } else {
            if (keys['KeyW']) targetMove -= activeSpeedLimit;
            if (keys['KeyS']) targetMove += activeSpeedLimit;
        }

        // Momentum application
        const translationAccelerationRate = (isOnGround ? 2.0 : 0.8) * massFactor * delta; 
        const turnAccelerationRate = 2.0 * delta;
        const altitudeAccelerationRate = 3.5 * massFactor * delta;

        this.currentMoveSpeed += (targetMove - this.currentMoveSpeed) * Math.min(translationAccelerationRate, 1.0);
        this.currentTurnSpeed += (targetTurn - this.currentTurnSpeed) * Math.min(turnAccelerationRate, 1.0);
        this.currentAltitudeSpeed += (targetAltitude - this.currentAltitudeSpeed) * Math.min(altitudeAccelerationRate, 1.0);

        // Translate updates to the model
        if (Math.abs(this.currentMoveSpeed) > 0.001) {
            this.model.translateX(this.currentMoveSpeed * delta);
        }
        if (Math.abs(this.currentTurnSpeed) > 0.001) {
            this.model.rotation.y += this.currentTurnSpeed * delta;
        }

        // Apply Dynamic Wind Drift When Airborne
        if (windVector && !isOnGround) {
            const windImpactFactor = (this.baselineMassKg / currentMass) * delta;
            this.model.position.x += windVector.x * windImpactFactor * 1.5;
            this.model.position.z += windVector.z * windImpactFactor * 1.5;
        }

        // Apply vertical position safely ensuring it doesn't drop below ground level
        let newY = this.model.position.y + (this.currentAltitudeSpeed * delta);
        if (newY <= activeGroundLevel) {
            newY = activeGroundLevel;
            this.currentAltitudeSpeed = 0;
        }
        this.model.position.y = newY;
        this.wasOnGround = isOnGround;
    }
}