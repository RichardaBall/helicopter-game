import * as THREE from 'three';

export class LightPlacer {
    constructor(scene, camera, oilRigModel) {
        this.scene = scene;
        this.camera = camera;
        this.oilRigModel = oilRigModel;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.placedLights = [];
        this.currentColor = 'green'; // 'green' or 'red'

        this.setupUI();
        this.initListeners();
    }

    setupUI() {
        const div = document.createElement('div');
        div.id = 'light-placer-hud';
        div.style.position = 'fixed';
        div.style.top = '10px';
        div.style.left = '10px';
        div.style.background = 'rgba(0, 0, 0, 0.85)';
        div.style.color = '#fff';
        div.style.padding = '14px';
        div.style.fontFamily = 'monospace';
        div.style.fontSize = '13px';
        div.style.zIndex = '1000';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid #444';
        div.innerHTML = `
            <b>Oil Rig Light Placer</b><br>
            Active Mode: <span id="lp-color" style="color: #00ff00; font-weight: bold;">GREEN (Helipad)</span><br>
            Green Placed: <span id="lp-green-count">0</span> / 8<br>
            Red Placed: <span id="lp-red-count">0</span> / 10<br>
            <hr style="border: 0; border-top: 1px solid #555; margin: 8px 0;">
            <b>[C]</b> Toggle Color (Green/Red)<br>
            <b>[Z]</b> Undo Last Light<br>
            <b>[P]</b> Print Coordinates (Console)
        `;
        document.body.appendChild(div);
        this.hudColorEl = document.getElementById('lp-color');
        this.greenCountEl = document.getElementById('lp-green-count');
        this.redCountEl = document.getElementById('lp-red-count');
    }

    initListeners() {
        this.boundOnClick = (e) => this.onClick(e);
        this.boundOnKeyDown = (e) => this.onKeyDown(e);
        window.addEventListener('click', this.boundOnClick);
        window.addEventListener('keydown', this.boundOnKeyDown);
    }

    onKeyDown(e) {
        if (e.key.toLowerCase() === 'c') {
            this.currentColor = this.currentColor === 'green' ? 'red' : 'green';
            if (this.currentColor === 'green') {
                this.hudColorEl.innerText = 'GREEN (Helipad)';
                this.hudColorEl.style.color = '#00ff00';
            } else {
                this.hudColorEl.innerText = 'RED (Structure)';
                this.hudColorEl.style.color = '#ff0000';
            }
        } else if (e.key.toLowerCase() === 'z') {
            this.undoLast();
        } else if (e.key.toLowerCase() === 'p') {
            this.printCoordinates();
        }
    }

    onClick(event) {
        if (event.target.closest('#light-placer-hud')) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.oilRigModel, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const worldPoint = hit.point;

            const localPoint = worldPoint.clone();
            this.oilRigModel.worldToLocal(localPoint);

            const colorHex = this.currentColor === 'green' ? 0x00ff00 : 0xff0000;
            
            const geometry = new THREE.SphereGeometry(0.35, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: colorHex });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.copy(worldPoint);
            this.scene.add(marker);

            const light = new THREE.PointLight(colorHex, 1.5, 8);
            light.position.copy(worldPoint);
            this.scene.add(light);

            const record = {
                color: this.currentColor,
                position: {
                    x: Number(localPoint.x.toFixed(3)),
                    y: Number(localPoint.y.toFixed(3)),
                    z: Number(localPoint.z.toFixed(3))
                },
                mesh: marker,
                light: light
            };

            this.placedLights.push(record);
            this.updateCounts();

            console.log(`Placed ${this.currentColor} light at local coordinates:`, record.position);
        }
    }

    undoLast() {
        if (this.placedLights.length > 0) {
            const last = this.placedLights.pop();
            this.scene.remove(last.mesh);
            this.scene.remove(last.light);
            last.mesh.geometry.dispose();
            last.mesh.material.dispose();
            this.updateCounts();
            console.log("Undone last light placement.");
        }
    }

    updateCounts() {
        const greenCount = this.placedLights.filter(l => l.color === 'green').length;
        const redCount = this.placedLights.filter(l => l.color === 'red').length;
        this.greenCountEl.innerText = greenCount;
        this.redCountEl.innerText = redCount;
    }

    printCoordinates() {
        console.log("=== OIL RIG LIGHTS COORDINATES (JSON) ===");
        console.log(JSON.stringify(this.placedLights.map(l => ({ color: l.color, position: l.position })), null, 2));
        alert("Coordinates successfully printed to your browser console (F12)! Copy and paste them back here.");
    }

    dispose() {
        window.removeEventListener('click', this.boundOnClick);
        window.removeEventListener('keydown', this.boundOnKeyDown);
        const hud = document.getElementById('light-placer-hud');
        if (hud) hud.remove();
    }
}