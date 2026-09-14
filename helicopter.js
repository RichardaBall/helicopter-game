const heli = {
    x: mainland.padX, y: mainland.padY, vx: 0, vy: 0, airSpeed: 0, maxAirspeed: 6.0, 
    heading: -Math.PI / 4, altitude: 0, targetAltitude: 0, batteryOn: false, engineState: 'OFF',
    rotorRPM: 0, flightState: 'GROUNDED', fuel: 80, gearExtended: true, paxOnboard: 0,
    tunedFreq: 210, ndbTarget: null, targetPad: null, targetWaypoint: null, atFix: false,
    weightFactor: 1.0, paxAction: null
};

let currentJob = null;

// --- RADIO & UI LOGIC ---
const radioKnob = document.getElementById('radio-knob');
radioKnob.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) heli.tunedFreq = Math.min(450, heli.tunedFreq + 10);
    else heli.tunedFreq = Math.max(200, heli.tunedFreq - 10);
    document.getElementById('radio-freq-display').innerText = heli.tunedFreq + ' kHz';
    checkNDBTuning();
});

function generateRandomJob() {
    const jobTypes = ['TRANSFER_OUT', 'COLLECT_IN', 'MULTI_STOP'];
    const type = jobTypes[Math.floor(Math.random() * jobTypes.length)];
    const count = Math.floor(Math.random() * 4) + 1;

    if (type === 'TRANSFER_OUT') {
        const destRig = rigs[Math.floor(Math.random() * rigs.length)];
        currentJob = { title: `Transport ${count} Workers to ${destRig.id}`, legs: [{ type: 'DELIVER', target: destRig, count: count }], totalPaxToLoad: count };
    } else if (type === 'COLLECT_IN') {
        const srcRig = rigs[Math.floor(Math.random() * rigs.length)];
        srcRig.paxWaiting = count;
        currentJob = { title: `Pickup ${count} Workers from ${srcRig.id}`, legs: [{ type: 'PICKUP', target: srcRig, count: count }, { type: 'DELIVER', target: mainland, count: count }], totalPaxToLoad: 0 };
    } else {
        currentJob = { title: `Multi-Stop: ${rigs[0].id} & ${rigs[1].id}`, legs: [{ type: 'DELIVER', target: rigs[0], count: 2 }, { type: 'PICKUP', target: rigs[1], count: 2 }, { type: 'DELIVER', target: mainland, count: 2 }], totalPaxToLoad: 2 };
    }
}

function handlePassengerAction() {
    const atPad = getPadAtPosition(heli.x, heli.y);
    if (!atPad || heli.flightState !== 'GROUNDED' || heli.engineState !== 'OFF' || heli.paxAction) return;

    let actionType = null;
    let paxCount = 0;

    if (atPad.id === mainland.id && currentJob.totalPaxToLoad > 0) {
        actionType = 'LOAD'; paxCount = currentJob.totalPaxToLoad;
    } else if (currentJob && currentJob.legs.length > 0) {
        const leg = currentJob.legs[0];
        if (leg.target.id === atPad.id) {
            if (leg.type === 'DELIVER' && heli.paxOnboard >= leg.count) { actionType = 'UNLOAD'; paxCount = leg.count; }
            else if (leg.type === 'PICKUP') { actionType = 'LOAD'; paxCount = leg.count; }
        } else { notify(`Wrong destination! Current leg requires: ${leg.target.id}`); return; }
    }

    if (actionType && paxCount > 0) {
        heli.paxAction = { type: actionType, count: paxCount, progress: 0, timer: 0, duration: 2.5, pad: atPad };
        notify(`Passenger ${actionType === 'LOAD' ? 'boarding' : 'deboarding'} in progress...`);
    }
}

function getPadAtPosition(x, y) {
    if (Math.hypot(x - mainland.padX, y - mainland.padY) < 35) return mainland;
    for (let r of rigs) if (Math.hypot(x - r.padX, y - r.padY) < 45) return r;
    return null;
}

// --- CONTROLS & INPUT ---
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (world.kneeboardOpen) {
        const kbW = 520, kbH = 480, kbX = 40, kbY = (canvas.height - kbH) / 2;
        if (mouseY >= kbY && mouseY <= kbY + 45) {
            const tabWidth = kbW / 4;
            if (mouseX >= kbX && mouseX < kbX + tabWidth) { world.kneeboardTab = 'freq'; return; }
            else if (mouseX >= kbX + tabWidth && mouseX < kbX + tabWidth * 2) { world.kneeboardTab = 'controls'; return; }
            else if (mouseX >= kbX + tabWidth * 2 && mouseX < kbX + tabWidth * 3) { world.kneeboardTab = 'manifest'; return; }
            else if (mouseX >= kbX + tabWidth * 3 && mouseX < kbX + kbW) { world.kneeboardTab = 'refuel'; return; }
        }
        if (world.kneeboardTab === 'manifest' && mouseX >= kbX + 35 && mouseX <= kbX + kbW - 35 && mouseY >= kbY + 360 && mouseY <= kbY + 395) {
            handlePassengerAction(); return;
        }
        if (world.kneeboardTab === 'refuel' && mouseX >= kbX + 60 && mouseX <= kbX + kbW - 60 && mouseY >= kbY + 180 && mouseY <= kbY + 204) {
            heli.fuel = Math.max(0, Math.min(100, Math.round((mouseX - (kbX + 60)) / (kbW - 120) * 100)));
            notify(`Fuel load set to ${heli.fuel}% via kneeboard.`); return;
        }
        if (world.kneeboardTab === 'refuel' && mouseX >= kbX + 35 && mouseX <= kbX + kbW - 35 && mouseY >= kbY + 300 && mouseY <= kbY + 345) {
            if (heli.flightState === 'GROUNDED' && getPadAtPosition(heli.x, heli.y) === mainland) { heli.fuel = 100; notify('Topped off to 100%'); }
            return;
        }
        return;
    }

    if (heli.flightState !== 'HOVER' && heli.flightState !== 'CRUISE' && heli.flightState !== 'AUTOPILOT_WAYPOINT') return;

    const wPos = screenToWorld(mouseX, mouseY);
    const pad = getPadAtPosition(wPos.x, wPos.y);

    if (pad) {
        heli.targetPad = pad;
        heli.flightState = 'AUTOPILOT_LAND';
        heli.targetWaypoint = null;
        heli.atFix = false;
        notify(`Autopilot Route: Landing approach at ${pad.id}`);
    } else {
        heli.targetWaypoint = { x: wPos.x, y: wPos.y };
        heli.flightState = 'AUTOPILOT_WAYPOINT';
        heli.targetPad = null;
        notify(`Autopilot Route: Proceeding to coordinates [${Math.round(wPos.x)}, ${Math.round(wPos.y)}]`);
    }
});

const keys = {};
window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift', 'Control'].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
    if (e.key.toLowerCase() === 'k') world.kneeboardOpen = !world.kneeboardOpen;
    if (e.key.toLowerCase() === 'l') attemptLanding();
});
window.addEventListener('keyup', (e) => keys[e.key] = false);

// --- SWITCHES ---
function toggleBatterySwitch() {
    if (heli.flightState === 'CRASHED') return;
    heli.batteryOn = !heli.batteryOn;
    updateUIStates();
    if (!heli.batteryOn && (heli.engineState === 'RUNNING' || heli.engineState === 'STARTING')) {
        heli.engineState = 'OFF'; updateUIStates(); notify('Power cut: Engines shut down.');
    } else notify(heli.batteryOn ? 'Battery ON.' : 'Battery OFF.');
}
function toggleEngineSwitch() {
    if (heli.altitude > 0 || heli.flightState === 'CRASHED') return;
    if (!heli.batteryOn) return notify('Main battery must be ON.');
    if (heli.engineState === 'OFF') { heli.engineState = 'STARTING'; notify('Starting turbine...'); }
    else { heli.engineState = 'OFF'; notify('Engines shut down.'); }
    updateUIStates();
}
function toggleGearSwitch() {
    if (heli.flightState === 'CRASHED') return;
    heli.gearExtended = !heli.gearExtended;
    updateUIStates();
    notify(heli.gearExtended ? 'Landing gear DOWN (+Drag).' : 'Landing gear UP (Max Speed).');
}

function updateUIStates() {
    document.getElementById('battery-toggle-thumb').className = heli.batteryOn ? 'toggle-thumb up' : 'toggle-thumb down';
    document.getElementById('battery-status-hint').innerText = heli.batteryOn ? 'ON' : 'OFF';
    document.getElementById('engine-toggle-thumb').className = heli.engineState === 'RUNNING' ? 'toggle-thumb up' : (heli.engineState === 'STARTING' ? 'toggle-thumb up' : 'toggle-thumb down');
    document.getElementById('engine-status-hint').innerText = heli.engineState;
    document.getElementById('gear-toggle-thumb').className = heli.gearExtended ? 'toggle-thumb gear-down' : 'toggle-thumb gear-up';
    ['l','n','r'].forEach(id => document.getElementById(`gear-light-${id}`).className = heli.gearExtended ? 'gear-light green' : 'gear-light red');
}

function checkNDBTuning() {
    heli.ndbTarget = (mainland.freq === heli.tunedFreq) ? mainland : rigs.find(r => r.freq === heli.tunedFreq) || null;
}

function attemptLanding() {
    if (heli.flightState !== 'HOVER' && heli.flightState !== 'CRUISE' && heli.flightState !== 'AUTOPILOT_WAYPOINT') return;
    const pad = getPadAtPosition(heli.x, heli.y);
    if (!pad) { heli.flightState = 'CRASHED'; heli.altitude = 0; return notify("CRASH! Attempted landing in water."); }
    
    let diff = Math.abs(((heli.heading * 180 / Math.PI + 90) % 360 + 360) % 360 - (world.windDirDeg + 180) % 360);
    if (diff > 180) diff = 360 - diff;
    if (diff <= 30) {
        heli.flightState = 'GROUNDED'; heli.altitude = 0; heli.vx = 0; heli.vy = 0; heli.airSpeed = 0; heli.x = pad.padX; heli.y = pad.padY;
        notify(`Safe Landing at ${pad.id}!`);
    } else {
        heli.flightState = 'CRASHED'; heli.altitude = 0; notify(`CRASH! Bad wind alignment.`);
    }
}

// --- SIMULATION LOOP ---
let lastTime = performance.now();
function gameLoop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    updateSimulation(dt);
    renderIsometricWorld();
    requestAnimationFrame(gameLoop);
}

function updateSimulation(dt) {
    world.weatherTimer += dt;
    if (world.weatherTimer > 45) {
        world.weatherTimer = 0;
        world.windDirDeg = (world.windDirDeg + (Math.floor(Math.random() * 90) - 45) + 360) % 360;
        const states = ['VFR', 'MARGINAL', 'STORM'];
        world.weather = states[Math.floor(Math.random() * states.length)];
        world.windSpeedKts = world.weather === 'VFR' ? 10 + Math.random()*10 : (world.weather === 'MARGINAL' ? 25 : 40);
    }

    if (heli.ndbTarget) {
        const deg = Math.atan2(heli.ndbTarget.y - heli.y, heli.ndbTarget.x - heli.x) * (180 / Math.PI) + 90;
        document.getElementById('adf-needle').style.transform = `rotate(${deg}deg)`;
    } else document.getElementById('adf-needle').style.transform = 'rotate(0deg)';

    if (heli.paxAction) {
        heli.paxAction.timer += dt;
        heli.paxAction.progress = Math.min(1, heli.paxAction.timer / heli.paxAction.duration);
        if (heli.paxAction.timer >= heli.paxAction.duration) {
            const action = heli.paxAction;
            if (action.type === 'LOAD') {
                heli.paxOnboard += action.count;
                if (action.pad.id === mainland.id) currentJob.totalPaxToLoad = 0;
                else { currentJob.legs.shift(); action.pad.paxWaiting = 0; }
            } else {
                heli.paxOnboard -= action.count;
                currentJob.legs.shift();
            }
            if (currentJob.legs.length === 0 && mainland.id === action.pad.id && heli.paxOnboard === 0) { notify('Mission Completed!'); generateRandomJob(); }
            heli.paxAction = null;
        }
    }

    heli.weightFactor = 1.0 + (heli.fuel / 100) * 0.28 + (heli.paxOnboard * 0.09);
    if (heli.flightState === 'CRASHED') return;

    for (let wf of windFarms) for (let t of wf.turbines) {
        if (Math.hypot(heli.x - t.x, heli.y - t.y) < 25 && heli.altitude < wf.height) {
            heli.flightState = 'CRASHED'; heli.altitude = 0; notify(`CRASH! Struck turbine at ${wf.id}!`); return;
        }
    }

    if (heli.engineState === 'STARTING' && heli.batteryOn) {
        heli.rotorRPM += 20 * dt;
        if (heli.rotorRPM >= 100) { heli.rotorRPM = 100; heli.engineState = 'RUNNING'; updateUIStates(); notify('Engines ready.'); }
    } else if (heli.engineState === 'OFF' || !heli.batteryOn) heli.rotorRPM = Math.max(0, heli.rotorRPM - 25 * dt);

    if (heli.engineState === 'RUNNING' && heli.rotorRPM >= 95) {
        if (keys['Shift']) heli.targetAltitude = Math.min(1000, heli.targetAltitude + 150 * dt);
        if (keys['Control']) heli.targetAltitude = Math.max(0, heli.targetAltitude - 150 * dt);
    } else heli.targetAltitude = 0;

    const climbRate = 90 / heli.weightFactor;
    if (heli.altitude < heli.targetAltitude) heli.altitude += climbRate * dt;
    if (heli.altitude > heli.targetAltitude) heli.altitude -= 90 * dt;

    if (heli.altitude > 2 && heli.flightState === 'GROUNDED') { heli.flightState = 'HOVER'; notify('Liftoff.'); }
    else if (heli.altitude <= 0.5 && heli.flightState !== 'GROUNDED' && !heli.targetPad) {
        const pad = getPadAtPosition(heli.x, heli.y);
        if (pad) { heli.flightState = 'GROUNDED'; heli.altitude = 0; heli.x = pad.padX; heli.y = pad.padY; notify(`Landed at ${pad.id}.`); }
        else { heli.flightState = 'CRASHED'; heli.altitude = 0; notify('CRASH! Landed in ocean.'); }
    }

    if (heli.flightState === 'AUTOPILOT_LAND' || heli.flightState === 'AUTOPILOT_WAYPOINT') {
        let targetX, targetY;
        if (heli.flightState === 'AUTOPILOT_LAND') {
            const windRad = world.windDirDeg * Math.PI / 180;
            const fixX = heli.targetPad.padX + Math.cos(windRad) * 120;
            const fixY = heli.targetPad.padY + Math.sin(windRad) * 120;
            if (Math.hypot(fixX - heli.x, fixY - heli.y) > 15 && !heli.atFix) { targetX = fixX; targetY = fixY; } 
            else { heli.atFix = true; targetX = heli.targetPad.padX; targetY = heli.targetPad.padY; }
        } else {
            targetX = heli.targetWaypoint.x; targetY = heli.targetWaypoint.y;
        }

        const dx = targetX - heli.x, dy = targetY - heli.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 3) {
            const speed = Math.min(3.5 / Math.sqrt(heli.weightFactor), dist * 1.5);
            heli.vx = (dx / dist) * speed; heli.vy = (dy / dist) * speed; heli.airSpeed = speed;
            heli.x += heli.vx * 60 * dt; heli.y += heli.vy * 60 * dt;
            
            const moveAngle = Math.atan2(heli.vy, heli.vx);
            let angleDiff = moveAngle - heli.heading;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            heli.heading += angleDiff * Math.min(1, dt * 4);
        } else {
            if (heli.flightState === 'AUTOPILOT_LAND') {
                heli.x = targetX; heli.y = targetY; heli.vx = 0; heli.vy = 0; heli.airSpeed = 0; heli.altitude = 0; heli.targetAltitude = 0;
                heli.flightState = 'GROUNDED'; heli.atFix = false; heli.heading = world.windDirDeg * Math.PI / 180;
                notify(`Landing Complete at ${heli.targetPad.id}.`);
            } else {
                heli.flightState = 'HOVER'; heli.vx = 0; heli.vy = 0; heli.targetWaypoint = null;
                notify('Arrived at Autopilot Waypoint.');
            }
        }
    } else if (heli.flightState === 'HOVER' || heli.flightState === 'CRUISE') {
        if (keys['ArrowLeft']) heli.heading -= 2.2 * dt;
        if (keys['ArrowRight']) heli.heading += 2.2 * dt;

        if (keys['ArrowUp']) heli.airSpeed += 5.0 * dt;
        else if (keys['ArrowDown']) heli.airSpeed -= 5.0 * dt;
        else heli.airSpeed *= Math.pow(0.93, dt * 60);

        const maxSpd = 6.0 / Math.sqrt(heli.weightFactor);
        heli.airSpeed = Math.max(-2.0, Math.min(maxSpd, heli.airSpeed));
        
        const windRad = world.windDirDeg * Math.PI / 180;
        heli.vx = Math.cos(heli.heading) * heli.airSpeed + Math.cos(windRad) * (world.windSpeedKts / 45);
        heli.vy = Math.sin(heli.heading) * heli.airSpeed + Math.sin(windRad) * (world.windSpeedKts / 45);

        heli.flightState = (Math.abs(heli.airSpeed) > 0.1 || keys['ArrowUp'] || keys['ArrowDown']) ? 'CRUISE' : 'HOVER';
        heli.x += heli.vx * 60 * dt; heli.y += heli.vy * 60 * dt;
        if (heli.targetWaypoint) heli.targetWaypoint = null;
    }

    if (heli.flightState !== 'GROUNDED' && heli.engineState === 'RUNNING') {
        const burnMultiplier = heli.weightFactor * (world.weather === 'STORM' ? 1.45 : 1.0);
        heli.fuel -= (100 / 1400) * burnMultiplier * dt;
        if (heli.fuel <= 0) { heli.fuel = 0; heli.flightState = 'CRASHED'; notify("CRASH: Out of fuel!"); }
    }

    document.getElementById('asi-needle').setAttribute('transform', `rotate(${Math.min(300, (Math.abs(heli.airSpeed)*20 / 140) * 260)}, 50, 50)`);
    document.getElementById('asi-val').innerText = Math.round(Math.abs(heli.airSpeed)*20);
    document.getElementById('alt-needle-100').setAttribute('transform', `rotate(${((heli.altitude % 1000) / 1000) * 360}, 50, 50)`);
    document.getElementById('alt-num').innerText = Math.round(heli.altitude);
    document.getElementById('rpm-needle').setAttribute('transform', `rotate(${Math.min(300, (heli.rotorRPM / 120) * 270)}, 50, 50)`);
    document.getElementById('rpm-text').innerText = Math.round(heli.rotorRPM);
    document.getElementById('fuel-bar-fill').style.height = `${Math.max(0, heli.fuel)}%`;
    document.getElementById('fuel-bar-val').innerText = Math.round(heli.fuel) + '%';
}

// --- RENDERING PIPELINE ---
function renderIsometricWorld() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = world.weather === 'STORM' ? '#040b16' : '#0a192f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderQueue = [];

    ctx.strokeStyle = world.weather === 'STORM' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 58, 138, 0.3)';
    ctx.lineWidth = 1;
    const gSize = 250, limit = 2000;
    const startX = Math.floor((heli.x - limit) / gSize) * gSize, endX = Math.ceil((heli.x + limit) / gSize) * gSize;
    const startY = Math.floor((heli.y - limit) / gSize) * gSize, endY = Math.ceil((heli.y + limit) / gSize) * gSize;
    
    for (let x = startX; x <= endX; x += gSize) {
        const p1 = worldToScreen(x, startY, 0), p2 = worldToScreen(x, endY, 0);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gSize) {
        const p1 = worldToScreen(startX, y, 0), p2 = worldToScreen(endX, y, 0);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }

    randomIslands.forEach(isl => renderQueue.push({
        depth: isl.x + isl.y, draw: () => {
            draw3DIsland(isl.x, isl.y, isl.radius);
        }
    }));
    
    renderQueue.push({
        depth: mainland.x + mainland.y, draw: () => {
            draw3DIsland(mainland.x, mainland.y, mainland.radius);
            drawIsoBox(mainland.x - 40, mainland.y - 40, 30, 45, 50, 30, '#475569', '#334155', '#1e293b');
            
            const padPt = worldToScreen(mainland.padX, mainland.padY, 31);
            ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.ellipse(padPt.x, padPt.y, 35, 17.5, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(padPt.x, padPt.y, 30, 15, 0, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', padPt.x, padPt.y);
            drawWindsock(mainland.padX + 40, mainland.padY - 40, 30);
        }
    });

    rigs.forEach(rig => renderQueue.push({
        depth: rig.x + rig.y, draw: () => {
            const hw = 30, hd = 30, lh = 50;
            drawIsoBox(rig.x - hw, rig.y - hd, 0, 8, 8, lh, '#475569', '#334155', '#1e293b');
            drawIsoBox(rig.x + hw, rig.y - hd, 0, 8, 8, lh, '#475569', '#334155', '#1e293b');
            drawIsoBox(rig.x + hw, rig.y + hd, 0, 8, 8, lh, '#475569', '#334155', '#1e293b');
            drawIsoBox(rig.x - hw, rig.y + hd, 0, 8, 8, lh, '#475569', '#334155', '#1e293b');
            drawIsoBox(rig.x, rig.y, lh, 85, 85, 10, '#1e293b', '#0f172a', '#020617');
            
            const padPt = worldToScreen(rig.padX, rig.padY, lh + 11);
            ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(padPt.x, padPt.y, 22, 11, 0, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('H', padPt.x, padPt.y);
            
            ctx.fillStyle = '#cbd5e1'; ctx.font = '11px monospace'; const labelPt = worldToScreen(rig.x, rig.y, lh + 25);
            ctx.fillText(rig.id, labelPt.x, labelPt.y - 30);
            
            drawWindsock(rig.padX + 35, rig.padY - 35, lh + 10);
        }
    }));

    windFarms.forEach(wf => wf.turbines.forEach(t => renderQueue.push({
        depth: t.x + t.y, draw: () => {
            const bot = worldToScreen(t.x, t.y, 0), top = worldToScreen(t.x, t.y, wf.height);
            ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke();
            const bAng = performance.now() * 0.003;
            ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 3;
            for(let i=0; i<3; i++) {
                const a = bAng + (i * Math.PI * 2 / 3);
                const bx = top.x + Math.cos(a) * 25, by = top.y + Math.sin(a) * 25;
                ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bx, by); ctx.stroke();
            }
        }
    })));

    if (heli.targetWaypoint) renderQueue.push({
        depth: heli.targetWaypoint.x + heli.targetWaypoint.y, draw: () => {
            const wp = worldToScreen(heli.targetWaypoint.x, heli.targetWaypoint.y, 0);
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(wp.x, wp.y, 14, 7, 0, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(wp.x, wp.y); ctx.lineTo(wp.x, wp.y - 25); ctx.stroke();
            ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(wp.x, wp.y - 25, 4, 0, Math.PI*2); ctx.fill();
        }
    });

    renderQueue.push({
        depth: heli.x + heli.y, draw: () => {
            const shadow = worldToScreen(heli.x, heli.y, 0);
            ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
            ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 34, 17, 0, 0, Math.PI*2); ctx.fill();

            const locToScrn = (lx, ly, lz) => worldToScreen(heli.x + lx, heli.y + ly, heli.altitude + lz);

            const hx = Math.cos(heli.heading);
            const hy = Math.sin(heli.heading);
            const rx = -hy; 
            const ry = hx;

            const nose = locToScrn(hx * 34, hy * 34, 2);
            const noseBelly = locToScrn(hx * 28, hy * 28, -4);
            const roofFront = locToScrn(hx * 18, hy * 18, 12);
            const roofRear = locToScrn(-hx * 12, -hy * 12, 13);
            const tailRoot = locToScrn(-hx * 22, -hy * 22, 6);
            const tailTip = locToScrn(-hx * 60, -hy * 60, 15);
            const finTop = locToScrn(-hx * 64, -hy * 64, 34);

            const skidOffset = 13;
            const skidLenFront = 22;
            const skidLenRear = -24;
            const skidHeight = -10;

            const leftSkidFront = locToScrn(hx * skidLenFront - rx * skidOffset, hy * skidLenFront - ry * skidOffset, skidHeight);
            const leftSkidRear = locToScrn(hx * skidLenRear - rx * skidOffset, hy * skidLenRear - ry * skidOffset, skidHeight);
            const rightSkidFront = locToScrn(hx * skidLenFront + rx * skidOffset, hy * skidLenFront + ry * skidOffset, skidHeight);
            const rightSkidRear = locToScrn(hx * skidLenRear + rx * skidOffset, hy * skidLenRear + ry * skidOffset, skidHeight);

            const leftStrutFront = locToScrn(hx * 12 - rx * 11, hy * 12 - ry * 11, -3);
            const leftStrutRear = locToScrn(-hx * 10 - rx * 11, -hy * 10 - ry * 11, -3);
            const rightStrutFront = locToScrn(hx * 12 + rx * 11, hy * 12 + ry * 11, -3);
            const rightStrutRear = locToScrn(-hx * 10 + rx * 11, -hy * 10 + ry * 11, -3);

            ctx.strokeStyle = '#334155'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(leftSkidRear.x, leftSkidRear.y); ctx.lineTo(leftSkidFront.x, leftSkidFront.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rightSkidRear.x, rightSkidRear.y); ctx.lineTo(rightSkidFront.x, rightSkidFront.y); ctx.stroke();

            ctx.strokeStyle = '#475569'; ctx.lineWidth = 2.5;
            const leftSkidMidF = locToScrn(hx * 12 - rx * skidOffset, hy * 12 - ry * skidOffset, skidHeight);
            const leftSkidMidR = locToScrn(-hx * 10 - rx * skidOffset, -hy * 10 - ry * skidOffset, skidHeight);
            const rightSkidMidF = locToScrn(hx * 12 + rx * skidOffset, hy * 12 + ry * skidOffset, skidHeight);
            const rightSkidMidR = locToScrn(-hx * 10 + rx * skidOffset, -hy * 10 + ry * skidOffset, skidHeight);

            ctx.beginPath(); ctx.moveTo(leftStrutFront.x, leftStrutFront.y); ctx.lineTo(leftSkidMidF.x, leftSkidMidF.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(leftStrutRear.x, leftStrutRear.y); ctx.lineTo(leftSkidMidR.x, leftSkidMidR.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rightStrutFront.x, rightStrutFront.y); ctx.lineTo(rightSkidMidF.x, rightSkidMidF.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rightStrutRear.x, rightStrutRear.y); ctx.lineTo(rightSkidMidR.x, rightSkidMidR.y); ctx.stroke();

            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(noseBelly.x, noseBelly.y);
            ctx.lineTo(leftStrutFront.x, leftStrutFront.y);
            ctx.lineTo(tailRoot.x - rx * 4, tailRoot.y - ry * 4);
            ctx.lineTo(rightStrutFront.x, rightStrutFront.y);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            ctx.moveTo(nose.x, nose.y);
            ctx.lineTo(roofFront.x - rx * 7, roofFront.y - ry * 3.5);
            ctx.lineTo(roofRear.x - rx * 7, roofRear.y - ry * 3.5);
            ctx.lineTo(tailRoot.x, tailRoot.y);
            ctx.lineTo(roofRear.x + rx * 7, roofRear.y + ry * 3.5);
            ctx.lineTo(roofFront.x + rx * 7, roofFront.y + ry * 3.5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(nose.x, nose.y);
            ctx.lineTo(roofFront.x, roofFront.y);
            ctx.lineTo(noseBelly.x, noseBelly.y);
            ctx.closePath();
            ctx.fill();

            const windShieldLeft = locToScrn(hx * 24 - rx * 5.5, hy * 24 - ry * 5.5, 5);
            const windShieldRight = locToScrn(hx * 24 + rx * 5.5, hy * 24 + ry * 5.5, 5);
            const windShieldTop = locToScrn(hx * 17, hy * 17, 10.5);

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(nose.x, nose.y);
            ctx.lineTo(windShieldLeft.x, windShieldLeft.y);
            ctx.lineTo(windShieldTop.x, windShieldTop.y);
            ctx.lineTo(windShieldRight.x, windShieldRight.y);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#1e293b';
            for (let w = 0; w < 3; w++) {
                const wPos = locToScrn(hx * (8 - w * 8) + rx * 6.5, hy * (8 - w * 8) + ry * 6.5, 5);
                ctx.beginPath(); ctx.ellipse(wPos.x, wPos.y, 3, 4.5, 0, 0, Math.PI * 2); ctx.fill();
            }

            const boomMid = locToScrn(-hx * 42, -hy * 42, 11);
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.moveTo(tailRoot.x, tailRoot.y); ctx.lineTo(boomMid.x, boomMid.y); ctx.stroke();

            ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(boomMid.x, boomMid.y); ctx.lineTo(tailTip.x, tailTip.y); ctx.stroke();

            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(tailTip.x, tailTip.y);
            ctx.lineTo(finTop.x, finTop.y);
            ctx.lineTo(finTop.x + hx * 9, finTop.y + hy * 9);
            ctx.lineTo(tailTip.x + hx * 7, tailTip.y + hy * 7);
            ctx.closePath();
            ctx.fill();

            const tRotorHub = locToScrn(-hx * 62 + rx * 2, -hy * 62 + ry * 2, 30);
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath(); ctx.arc(tRotorHub.x, tRotorHub.y, 2.5, 0, Math.PI * 2); ctx.fill();
            if (heli.rotorRPM > 0) {
                const tAng = performance.now() * 0.04 * (heli.rotorRPM / 100);
                ctx.strokeStyle = 'rgba(249, 115, 22, 0.9)'; ctx.lineWidth = 2;
                for (let tb = 0; tb < 4; tb++) {
                    const ta = tAng + (tb * Math.PI / 2);
                    ctx.beginPath();
                    ctx.moveTo(tRotorHub.x, tRotorHub.y);
                    ctx.lineTo(tRotorHub.x + Math.cos(ta) * 12, tRotorHub.y + Math.sin(ta) * 12);
                    ctx.stroke();
                }
            }

            const mastBase = locToScrn(hx * 3, hy * 3, 11);
            const mastTop = locToScrn(hx * 3, hy * 3, 17);
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(mastBase.x, mastBase.y); ctx.lineTo(mastTop.x, mastTop.y); ctx.stroke();

            ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(mastTop.x, mastTop.y, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            if (heli.rotorRPM > 0) {
                const bladeCount = 4;
                const rAngle = performance.now() * 0.02 * (heli.rotorRPM / 100);
                const bladeLength = 65;
                const speedAlpha = 0.25 + (heli.rotorRPM / 100) * 0.7;

                if (heli.rotorRPM > 50) {
                    ctx.fillStyle = 'rgba(71, 85, 105, 0.12)';
                    ctx.beginPath(); ctx.ellipse(mastTop.x, mastTop.y, bladeLength, bladeLength * 0.5, 0, 0, Math.PI * 2); ctx.fill();
                }

                for (let i = 0; i < bladeCount; i++) {
                    const bAngle = rAngle + (i * Math.PI * 2 / bladeCount);
                    const cosA = Math.cos(bAngle);
                    const sinA = Math.sin(bAngle);

                    const pStart = locToScrn(cosA * 5, sinA * 5, 17);
                    const pEnd = locToScrn(cosA * bladeLength, sinA * bladeLength, 17);

                    ctx.strokeStyle = `rgba(30, 41, 59, ${speedAlpha})`;
                    ctx.lineWidth = 3.5;
                    ctx.beginPath(); ctx.moveTo(pStart.x, pStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();

                    const pTipStart = locToScrn(cosA * (bladeLength - 8), sinA * (bladeLength - 8), 17);
                    ctx.strokeStyle = `rgba(241, 245, 249, ${speedAlpha})`;
                    ctx.lineWidth = 3.5;
                    ctx.beginPath(); ctx.moveTo(pTipStart.x, pTipStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    const bAngle = (i * Math.PI * 2 / 4);
                    const pStart = locToScrn(Math.cos(bAngle) * 5, Math.sin(bAngle) * 5, 17);
                    const pEnd = locToScrn(Math.cos(bAngle) * 62, Math.sin(bAngle) * 62, 17);
                    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(pStart.x, pStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();
                }
            }
        }
    });

    if (heli.paxAction) renderQueue.push({
        depth: heli.x + heli.y + 100, draw: () => {
            const pX = canvas.width/2, pY = canvas.height/2 - 60;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; ctx.fillRect(pX-30, pY, 60, 10);
            ctx.strokeStyle = '#ef4444'; ctx.strokeRect(pX-30, pY, 60, 10);
            ctx.fillStyle = '#10b981'; ctx.fillRect(pX-29, pY+1, 58 * heli.paxAction.progress, 8);
            ctx.fillStyle = '#ffffff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(heli.paxAction.type === 'LOAD' ? 'BOARDING' : 'DEBOARDING', pX, pY-5);
        }
    });

    renderQueue.sort((a,b) => a.depth - b.depth).forEach(item => item.draw());

    if (world.weather !== 'VFR') {
        ctx.strokeStyle = world.weather === 'STORM' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;
        const wX = Math.cos(world.windDirDeg * Math.PI/180) * 12;
        world.rainParticles.forEach(p => {
            p.x += wX; p.y += 20;
            if(p.x > canvas.width) p.x -= canvas.width; if(p.x < 0) p.x += canvas.width;
            if(p.y > canvas.height) p.y -= canvas.height;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - wX*0.5, p.y - 10); ctx.stroke();
        });
    }

    if (world.kneeboardOpen) renderKneeboard();
}

function renderKneeboard() {
    const kbW = 520, kbH = 480, kbX = 40, kbY = (canvas.height - kbH) / 2;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(kbX, kbY, kbW, kbH);
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.strokeRect(kbX, kbY, kbW, kbH);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(kbX, kbY, kbW, 45);

    const tabs = [{ id: 'freq', label: 'FREQUENCIES' }, { id: 'controls', label: 'CONTROLS' }, { id: 'manifest', label: 'MANIFEST' }, { id: 'refuel', label: 'REFUELING' }];
    tabs.forEach((t, i) => {
        const x = kbX + (kbW/4)*i, active = world.kneeboardTab === t.id;
        ctx.fillStyle = active ? '#1e293b' : '#090d16'; ctx.fillRect(x, kbY + 8, kbW/4, 30);
        ctx.strokeStyle = active ? '#f97316' : '#334155'; ctx.lineWidth = active ? 2 : 1; ctx.strokeRect(x, kbY + 8, kbW/4, 30);
        ctx.fillStyle = active ? '#f97316' : '#94a3b8'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(t.label, x + kbW/8, kbY + 27);
    });
    ctx.textAlign = 'left';

    if (world.kneeboardTab === 'freq') {
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px monospace'; ctx.fillText(`WEATHER: ${world.weather}  |  WIND: ${world.windDirDeg}° / ${world.windSpeedKts} kts`, kbX+25, kbY+75);
        ctx.fillStyle = '#38bdf8'; ctx.fillText('FACILITY NAME', kbX+25, kbY+110); ctx.fillText('FREQ', kbX+420, kbY+110);
        [mainland, ...rigs].forEach((st, i) => {
            ctx.fillStyle = st.freq === heli.tunedFreq ? '#10b981' : '#e2e8f0';
            ctx.fillText(st.id, kbX+25, kbY+145 + i*28); ctx.fillText(st.freq + ' kHz', kbX+420, kbY+145 + i*28);
        });
    } else if (world.kneeboardTab === 'controls') {
        ctx.fillStyle = '#f97316'; ctx.font = 'bold 12px monospace'; ctx.fillText('OFFSHORE HELICOPTER CONTROLS', kbX+25, kbY+75);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '11px monospace';
        const rows = [`Weight: ${heli.weightFactor.toFixed(2)}x`, `Gear: ${heli.gearExtended ? 'DOWN' : 'UP'}`, `State: ${heli.flightState}`];
        rows.forEach((r, i) => ctx.fillText(r, kbX+25, kbY+105 + i*18));
        
        const binds = [['Left/Right Click Map', 'RTS Move Order / Autopilot Route'], ['Shift / Ctrl', 'Climb / Descend'], ['Arrows', 'Manual Pitch / Yaw'], ['[ L ]', 'Manual Land']];
        binds.forEach(([k, d], i) => { ctx.fillStyle = '#f59e0b'; ctx.fillText(k, kbX+25, kbY+200+i*20); ctx.fillStyle = '#cbd5e1'; ctx.fillText(d, kbX+170, kbY+200+i*20); });
    } else if (world.kneeboardTab === 'manifest') {
        if (currentJob) {
            ctx.fillStyle = '#e2e8f0'; ctx.font = '12px monospace';
            ctx.fillText(`Mission: ${currentJob.title}`, kbX+25, kbY+115);
            ctx.fillText(`Pax Onboard: ${heli.paxOnboard}`, kbX+25, kbY+145);
            currentJob.legs.forEach((leg, i) => ctx.fillText(`${i+1}. ${leg.type} -> ${leg.target.id}`, kbX+35, kbY+240 + i*24));
            
            const canAction = heli.flightState === 'GROUNDED' && heli.engineState === 'OFF' && getPadAtPosition(heli.x, heli.y);
            ctx.fillStyle = canAction ? '#2563eb' : '#475569'; ctx.fillRect(kbX+35, kbY+360, kbW-70, 35);
            ctx.fillStyle = '#ffffff'; ctx.textAlign='center'; ctx.fillText('LOAD / OFFLOAD', kbX+kbW/2, kbY+382); ctx.textAlign='left';
        }
    } else if (world.kneeboardTab === 'refuel') {
        ctx.fillStyle = '#e2e8f0'; ctx.font = '12px monospace'; ctx.fillText(`Current Fuel Level: ${Math.round(heli.fuel)}%`, kbX+25, kbY+115);
        ctx.fillStyle = '#020617'; ctx.fillRect(kbX+60, kbY+180, kbW-120, 24);
        ctx.fillStyle = '#2563eb'; ctx.fillRect(kbX+60, kbY+180, (kbW-120)*(heli.fuel/100), 24);
        const canFuel = heli.flightState === 'GROUNDED' && getPadAtPosition(heli.x, heli.y) === mainland;
        ctx.fillStyle = canFuel ? '#2563eb' : '#475569'; ctx.fillRect(kbX+35, kbY+300, kbW-70, 45);
        ctx.fillStyle = '#ffffff'; ctx.textAlign='center'; ctx.fillText('TOP OFF FUEL TO 100%', kbX+kbW/2, kbY+328); ctx.textAlign='left';
    }
}

checkNDBTuning(); updateUIStates(); generateRandomJob();
requestAnimationFrame(gameLoop);