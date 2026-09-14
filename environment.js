const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function notify(msg) {
    document.getElementById('notification-banner').innerText = msg;
}

// --- WORLD DATA ---
const world = {
    weather: 'VFR',
    windDirDeg: 220,
    windSpeedKts: 18,
    rainParticles: [],
    weatherTimer: 0,
    kneeboardOpen: false,
    kneeboardTab: 'freq'
};

for (let i = 0; i < 150; i++) {
    world.rainParticles.push({
        x: Math.random() * canvas.width * 2,
        y: Math.random() * canvas.height * 2
    });
}

const mainland = { id: 'Island Base', freq: 210, x: 400, y: 3000, radius: 110, padX: 425, padY: 3000 };
const randomIslands = [
    { x: 1500, y: 1200, radius: 120 }, { x: 4200, y: 1800, radius: 105 }, 
    { x: 2800, y: 3800, radius: 140 }, { x: 1200, y: 4500, radius: 90 }, { x: 4800, y: 5200, radius: 150 }
];

const rigs = [
    { id: 'Alpha Rig', freq: 310, x: 3200, y: 1000, padX: 3200, padY: 1000, paxWaiting: 0 },
    { id: 'Bravo Platform', freq: 350, x: 5000, y: 3500, padX: 5000, padY: 3500, paxWaiting: 0 },
    { id: 'Charlie Deep', freq: 410, x: 2200, y: 5000, padX: 2200, padY: 5000, paxWaiting: 0 },
    { id: 'Delta Rig', freq: 430, x: 1200, y: 2000, padX: 1200, padY: 2000, paxWaiting: 0 },
    { id: 'Echo Complex', freq: 440, x: 4000, y: 800, padX: 4000, padY: 800, paxWaiting: 0 }
];

const windFarms = [
    { id: 'Neptune Offshore Wind Farm', height: 180, turbines: [{ x: 2200, y: 1800 }, { x: 2280, y: 1800 }, { x: 2360, y: 1800 }, { x: 2200, y: 1880 }, { x: 2280, y: 1880 }] },
    { id: 'Triton Shoals Wind Array', height: 180, turbines: [{ x: 3800, y: 4200 }, { x: 3890, y: 4200 }, { x: 3800, y: 4290 }] }
];

// --- RTS ISOMETRIC MATH ---
function worldToScreen(wx, wy, wz = 0) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const rx = wx - heli.x;
    const ry = wy - heli.y;
    const sx = (rx - ry);
    const sy = (rx + ry) / 2;
    return { x: cx + sx, y: cy + sy - wz };
}

function screenToWorld(sx, sy) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const wx = (dx / 2) + dy + heli.x;
    const wy = dy - (dx / 2) + heli.y;
    return { x: wx, y: wy };
}

// --- ISOMETRIC RENDERING HELPERS ---
function drawIsoBox(wx, wy, wz, w, d, h, cTop, cLeft, cRight) {
    const p1 = worldToScreen(wx + w/2, wy - d/2, wz);
    const p2 = worldToScreen(wx + w/2, wy + d/2, wz);
    const p3 = worldToScreen(wx - w/2, wy + d/2, wz);
    
    const t0 = worldToScreen(wx - w/2, wy - d/2, wz + h);
    const t1 = worldToScreen(wx + w/2, wy - d/2, wz + h);
    const t2 = worldToScreen(wx + w/2, wy + d/2, wz + h);
    const t3 = worldToScreen(wx - w/2, wy + d/2, wz + h);

    ctx.fillStyle = cLeft; ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.fill();
    ctx.fillStyle = cRight; ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.fill();
    ctx.fillStyle = cTop; ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.fill();
}

function drawWindsock(wx, wy, wz) {
    const pt = worldToScreen(wx, wy, wz);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - 25); ctx.stroke();
    
    const windRad = world.windDirDeg * Math.PI / 180;
    const endX = wx + Math.cos(windRad) * 20;
    const endY = wy + Math.sin(windRad) * 20;
    const endPt = worldToScreen(endX, endY, wz + 22);
    
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pt.x, pt.y - 22); ctx.lineTo(endPt.x, endPt.y); ctx.stroke();
    ctx.lineCap = 'butt';
}

function draw3DIsland(wx, wy, radius) {
    const steps = 5;
    const heightSteps = [0, 8, 16, 24, 30];
    const colorsTop = ['#0891b2', '#ca8a04', '#15803d', '#166534', '#14532d'];
    const colorsCliff = ['#0e7490', '#a16207', '#3f3f46', '#27272a', '#18181b'];

    for (let i = steps - 1; i >= 0; i--) {
        const currentRadius = radius * (1.0 - (i * 0.15));
        const currentHeight = heightSteps[i];
        const pt = worldToScreen(wx, wy, currentHeight);
        const rx = currentRadius * 1.5;
        const ry = currentRadius * 0.75;

        if (i > 0) {
            const prevHeight = heightSteps[i-1];
            const ptBase = worldToScreen(wx, wy, prevHeight);
            ctx.fillStyle = colorsCliff[i];
            ctx.beginPath();
            ctx.ellipse(pt.x, pt.y, rx, ry, 0, 0, Math.PI);
            ctx.ellipse(ptBase.x, ptBase.y, rx, ry, 0, Math.PI, 0, true);
            ctx.fill();
        }

        ctx.fillStyle = colorsTop[i];
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        if (i >= 2) {
            ctx.fillStyle = '#14381f';
            for (let t = 0; t < 3; t++) {
                const angle = t * ((Math.PI * 2) / 3) + (i * 0.5);
                const tx = pt.x + Math.cos(angle) * (rx * 0.45);
                const ty = pt.y + Math.sin(angle) * (ry * 0.45);
                ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}