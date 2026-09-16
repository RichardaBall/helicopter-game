import * as THREE from 'three';

export class HelicopterPlayer {
    constructor(model, animations, mixer) {
        this.model = model;
        this.mixer = mixer;
        this.actions = {};
        
        if (animations && Array.isArray(animations)) {
            animations.forEach((clip) => {
                const action = this.mixer.clipAction(clip);
                this.actions[clip.name] = action;
            });
        }

        this.isElectricalOn = false; // Electrical system state (Toggled with 'Q' key)
        this.qKeyWasPressed = false; // Debounce tracker for Q key

        this.isFuelPumpOn = false;   // Fuel pump state (Toggled with 'F' key)
        this.fKeyWasPressed = false; // Debounce tracker for F key
        this.fuelStarvationTimer = 0.0; // 10-second countdown for fuel starvation flameout

        this.isEngineRunning = false;
        this.enginePower = 0.0;       
        this.targetEnginePower = 0.0; 

        this.isGearUp = false; // false = deployed (down), true = retracted (up)

        // --- MASS & PAYLOAD CONFIGURATION (AW189 Specs) ---
        this.dryWeightKg = 4600;       
        this.fuelKg = 800;            // Total onboard fuel (kg) - depletes during flight
        this.passengerCount = 6;      
        this.passengerAvgKg = 85;     
        this.baselineMassKg = 6000; 

        // AW189 Performance Limits
        this.maxMoveSpeed = 22.0;       // Flight cruise speed (clean configuration)
        this.maxTaxiSpeed = 2.25;       // Controlled ground taxi speed
        this.maxTurnSpeed = 1.5;        // Flight turn rate
        this.maxTaxiTurnSpeed = 0.75;   // Ground taxi turn rate 
        this.maxAltitudeSpeed = 8.0;    // Realistic vertical climb/descent speed (~1,500 fpm)

        // Current dynamic velocities for momentum tracking
        this.currentMoveSpeed = 0.0;
        this.currentTurnSpeed = 0.0;
        this.currentAltitudeSpeed = 0.0;
    }

    getTotalMass() {
        return this.dryWeightKg + this.fuelKg + (this.passengerCount * this.passengerAvgKg);
    }

    toggleElectrical() {
        this.isElectricalOn = !this.isElectricalOn;
        console.log(`AW189: Electrical System ${this.isElectricalOn ? 'ON (Bus Powered)' : 'OFF (Instruments Unpowered)'}`);
    }

    toggleFuelPump() {
        this.isFuelPumpOn = !this.isFuelPumpOn;
        console.log(`AW189: Fuel Pump ${this.isFuelPumpOn ? 'ON (Pressure Normal - Fuel Flowing)' : 'OFF (Fuel Flow Interrupted)'}`);
        
        if (this.isFuelPumpOn) {
            this.fuelStarvationTimer = 0.0; // Reset starvation timer if pump is turned back on
        }
    }

    toggleEngine() {
        // Enforce electrical system prerequisite ONLY for starting
        if (!this.isElectricalOn && this.targetEnginePower === 0) {
            console.warn("AW189: Cannot start engines! Electrical system is OFF. Press 'Q' to turn on electrical power.");
            return;
        }

        // Enforce fuel availability prerequisite for starting
        if (this.fuelKg <= 0 && this.targetEnginePower === 0) {
            console.warn("AW189: Cannot start engines! Tanks are completely empty (0 kg fuel).");
            return;
        }

        if (this.targetEnginePower > 0) {
            this.targetEnginePower = 0.0;
            this.isEngineRunning = false;
            console.log("AW189: Engine fuel cutoff engaged! Entering Autorotation (4:1 glide ratio active)...");
        } else {
            this.targetEnginePower = 1.0;
            this.isEngineRunning = true;
            console.log(`AW189: Engines igniting. Gross Weight: ${this.getTotalMass()} kg. Spooling up...`);
            
            for (let name in this.actions) {
                if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                    const action = this.actions[name];
                    if (!action.isRunning()) {
                        action.reset().play();
                    }
                }
            }
        }
    }

    toggleLandingGear() {
        // Landing gear requires electrical power
        if (!this.isElectricalOn) {
            console.warn("AW189: Landing gear hydraulic pump unpowered! Turn on electrical system ('Q').");
            return;
        }

        let gearAction = null;
        for (let name in this.actions) {
            if (name.toLowerCase().includes('gear') || name.toLowerCase().includes('landing')) {
                gearAction = this.actions[name];
                break;
            }
        }

        if (!gearAction) {
            console.warn("Landing gear animation clip not found.");
            return;
        }

        gearAction.paused = false;
        gearAction.timeScale = this.isGearUp ? -1 : 1;
        gearAction.setLoop(THREE.LoopOnce, 1);
        gearAction.clampWhenFinished = true;
        gearAction.play();
        
        this.isGearUp = !this.isGearUp;
        console.log(`Landing Gear ${this.isGearUp ? 'Retracting (Clean Aero)' : 'Deploying (Drag & Increased Fuel Burn Active)'}`);
    }

    update(delta, keys) {
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // --- Q KEY ELECTRICAL TOGGLE LISTENER ---
        if (keys && keys['KeyQ']) {
            if (!this.qKeyWasPressed) {
                this.toggleElectrical();
                this.qKeyWasPressed = true;
            }
        } else {
            this.qKeyWasPressed = false;
        }

        // --- F KEY FUEL PUMP TOGGLE LISTENER ---
        if (keys && keys['KeyF']) {
            if (!this.fKeyWasPressed) {
                this.toggleFuelPump();
                this.fKeyWasPressed = true;
            }
        } else {
            this.fKeyWasPressed = false;
        }

        // Check if helicopter is currently resting on the ground
        const isOnGround = this.model.position.y <= 0.01;

        // --- FUEL CONSUMPTION & STARVATION SYSTEM ---
        if (this.targetEnginePower > 0) {
            if (!this.isFuelPumpOn) {
                // Fuel pump off: 10-second countdown to starvation flameout
                this.fuelStarvationTimer += delta;
                if (this.fuelStarvationTimer >= 10.0) {
                    this.targetEnginePower = 0.0;
                    this.isEngineRunning = false;
                    this.fuelStarvationTimer = 0.0;
                    console.log("AW189: FUEL STARVATION! Engines flamed out due to lack of fuel pressure. Entering Autorotation...");
                }
            } else {
                // Fuel pump is on: burn fuel based on engine power and landing gear aerodynamic drag penalty
                if (this.fuelKg > 0) {
                    const baseBurnRate = 0.6; // kg per second at full power
                    // Landing gear extended in flight increases drag and negatively affects fuel consumption (~35% higher burn rate)
                    const gearDragMultiplier = (!isOnGround && !this.isGearUp) ? 1.35 : 1.0;
                    
                    const fuelBurn = baseBurnRate * this.enginePower * gearDragMultiplier * delta;
                    this.fuelKg = Math.max(0, this.fuelKg - fuelBurn);

                    if (this.fuelKg <= 0) {
                        this.targetEnginePower = 0.0;
                        this.isEngineRunning = false;
                        console.log("AW189: OUT OF FUEL! Tanks empty. Engines flamed out. Entering Autorotation...");
                    }
                } else {
                    this.targetEnginePower = 0.0;
                    this.isEngineRunning = false;
                }
            }
        } else if (this.isFuelPumpOn && this.fuelStarvationTimer > 0) {
            this.fuelStarvationTimer = Math.max(0, this.fuelStarvationTimer - (delta * 2.0));
        }

        const isAutorotating = (this.targetEnginePower === 0 && !isOnGround && this.fuelKg > 0);

        // Turbine spool curve (coast-down inertia when engine is off)
        if (this.enginePower !== this.targetEnginePower) {
            const rate = 0.065; 
            const diff = this.targetEnginePower - this.enginePower;
            this.enginePower += diff * Math.min(delta * rate * 10.0, 1.0);

            if (Math.abs(this.targetEnginePower - this.enginePower) < 0.001) {
                this.enginePower = this.targetEnginePower;
            }
        }

        // Update rotor animations with gradual coast-down support
        for (let name in this.actions) {
            if (name.toLowerCase().includes('rotor') || name.toLowerCase().includes('armature') || name.includes('Арматура')) {
                const action = this.actions[name];
                
                // Once on the ground with engine off and fully spooled down, stop action
                if (isOnGround && this.targetEnginePower === 0 && this.enginePower <= 0.001) {
                    if (action.isRunning()) {
                        action.stop(); 
                    }
                } else {
                    const minRpmSpin = (isAutorotating) ? 0.35 : 0.0;
                    const activeTimeScale = Math.max(this.enginePower, minRpmSpin) * 1.2;
                    action.timeScale = activeTimeScale;
                    if (activeTimeScale > 0 && !action.isRunning()) {
                        action.reset().play();
                    }
                }
            }
        }

        // If engine is dead and rotors have fully spooled down on the ground, lock controls completely
        if (isOnGround && this.targetEnginePower === 0 && this.enginePower <= 0.001) {
            this.currentMoveSpeed = 0.0;
            this.currentTurnSpeed = 0.0;
            this.currentAltitudeSpeed = 0.0;
            this.model.position.y = 0;
            return;
        }

        // If landed from autorotation/fuel starv, zero out movement immediately but let rotors coast down smoothly
        if (isOnGround && this.targetEnginePower === 0) {
            this.currentMoveSpeed = 0.0;
            this.currentTurnSpeed = 0.0;
            this.currentAltitudeSpeed = 0.0;
            this.model.position.y = 0;
        }

        if (this.enginePower < 0.45 && !isAutorotating) return;

        const effectivePower = isAutorotating ? 1.0 : this.enginePower;

        // --- MASS-AFFECTED PHYSICS CALCULATIONS ---
        const currentMass = this.getTotalMass();
        const massFactor = this.baselineMassKg / currentMass; 

        // Determine speed limit based on ground status and landing gear drag
        let activeSpeedLimit;
        if (isOnGround) {
            activeSpeedLimit = this.maxTaxiSpeed;
        } else {
            const gearDragMultiplier = this.isGearUp ? 1.0 : 0.5;
            activeSpeedLimit = this.maxMoveSpeed * gearDragMultiplier;
        }

        const activeTurnSpeed = (isOnGround ? this.maxTaxiTurnSpeed : this.maxTurnSpeed) * Math.min(massFactor, 1.2);

        // 1. Target inputs
        let targetMove = 0;
        if (keys['KeyW']) targetMove -= activeSpeedLimit * effectivePower;
        if (keys['KeyS']) targetMove += activeSpeedLimit * effectivePower;
        
        // When autorotating, enforce forward glide to maintain rotor RPM
        if (isAutorotating && targetMove >= 0) {
            targetMove = - (activeSpeedLimit * 0.6); 
        }

        let targetTurn = 0;
        if (keys['KeyA']) targetTurn += activeTurnSpeed;
        if (keys['KeyD']) targetTurn -= activeTurnSpeed;

        let targetAltitude = 0;
        if (!isAutorotating) {
            if (keys['ShiftLeft'] || keys['ShiftRight']) {
                targetAltitude += (this.maxAltitudeSpeed * effectivePower) * massFactor;
            }
            if (keys['ControlLeft'] || keys['ControlRight']) {
                targetAltitude -= (this.maxAltitudeSpeed * effectivePower) * massFactor;
            }
        }

        // 2. Momentum curves
        const translationAccelerationRate = (isOnGround ? 2.0 : 0.8) * massFactor * delta; 
        const turnAccelerationRate = 2.0 * delta;

        const currentHeight = this.model.position.y;

        // --- REALISTIC TAKEOFF WEIGHT INERTIA ---
        if (currentHeight < 1.0 && targetAltitude > 0) {
            const takeoffInertia = Math.max(0.4, currentHeight / 1.0);
            targetAltitude *= takeoffInertia;
        }

        const altitudeAccelerationRate = 3.5 * massFactor * delta;
        this.currentMoveSpeed += (targetMove - this.currentMoveSpeed) * Math.min(translationAccelerationRate, 1.0);
        this.currentTurnSpeed += (targetTurn - this.currentTurnSpeed) * Math.min(turnAccelerationRate, 1.0);

        if (isAutorotating) {
            // --- 4:1 AUTOROTATION GLIDE PHYSICS (No flare/slowdown near ground) ---
            const forwardSpeedMagnitude = Math.abs(this.currentMoveSpeed);
            const targetDescentRate = - (forwardSpeedMagnitude / 4.0); 
            this.currentAltitudeSpeed += (targetDescentRate - this.currentAltitudeSpeed) * Math.min(2.0 * delta, 1.0);
        } else {
            this.currentAltitudeSpeed += (targetAltitude - this.currentAltitudeSpeed) * Math.min(altitudeAccelerationRate, 1.0);

            // --- REALISTIC LANDING FLARE & TOUCHDOWN (Only for normal powered landings) ---
            if (currentHeight < 0.8 && this.currentAltitudeSpeed < 0) {
                const landingFlare = Math.max(0.7, currentHeight / 0.8);
                this.currentAltitudeSpeed *= landingFlare;
            }
        }

        // 3. Apply physics translations
        if (Math.abs(this.currentMoveSpeed) > 0.001) {
            this.model.translateX(this.currentMoveSpeed * delta);
        }

        if (Math.abs(this.currentTurnSpeed) > 0.001) {
            this.model.rotation.y += this.currentTurnSpeed * delta;
        }

        if (Math.abs(this.currentAltitudeSpeed) > 0.001 || this.model.position.y > 0) {
            this.model.position.y = Math.max(0, this.model.position.y + this.currentAltitudeSpeed * delta);
        }
    }
}