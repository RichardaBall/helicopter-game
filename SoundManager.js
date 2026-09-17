export class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;

        // Helicopter Synth Nodes
        this.noiseNode = null;
        this.filterNode = null;
        this.lfoNode = null;
        this.lfoGain = null;
        this.synthGain = null;

        this.isPlaying = false;
        this.currentRpm = 0.0;
    }

    init() {
        if (this.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.8, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
    }

    ensureContextRunning() {
        if (!this.audioCtx) this.init();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Synthesizes a crisp electrical breaker switch click sound
    playBatterySwitchSound(isOn) {
        this.ensureContextRunning();

        const now = this.audioCtx.currentTime;

        // 1. Transient click oscillator
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(isOn ? 1200 : 800, now);
        osc.frequency.exponentialRampToValueAtTime(isOn ? 400 : 200, now + 0.04);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.04);

        // 2. High-frequency electrical snap
        const snapOsc = this.audioCtx.createOscillator();
        const snapGain = this.audioCtx.createGain();

        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(2400, now);
        snapOsc.frequency.exponentialRampToValueAtTime(100, now + 0.02);

        snapGain.gain.setValueAtTime(0.3, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        snapOsc.connect(snapGain);
        snapGain.connect(this.masterGain);

        snapOsc.start(now);
        snapOsc.stop(now + 0.02);
    }

    // Synthesizes high-pressure fuel pump motor spooling & priming sound
    playFuelPumpPrimeSound() {
        this.ensureContextRunning();

        const now = this.audioCtx.currentTime;
        const duration = 1.2;

        // 1. High-pitched auxiliary electric motor spin-up
        const pumpOsc = this.audioCtx.createOscillator();
        const pumpGain = this.audioCtx.createGain();

        pumpOsc.type = 'sawtooth';
        pumpOsc.frequency.setValueAtTime(120, now);
        pumpOsc.frequency.exponentialRampToValueAtTime(650, now + 0.4);
        pumpOsc.frequency.setValueAtTime(650, now + 0.4);
        pumpOsc.frequency.linearRampToValueAtTime(600, now + duration);

        pumpGain.gain.setValueAtTime(0.01, now);
        pumpGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
        pumpGain.gain.setValueAtTime(0.2, now + duration - 0.2);
        pumpGain.gain.linearRampToValueAtTime(0.001, now + duration);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(3.0, now);

        pumpOsc.connect(filter);
        filter.connect(pumpGain);
        pumpGain.connect(this.masterGain);

        pumpOsc.start(now);
        pumpOsc.stop(now + duration);

        // 2. Fluid pressurization hiss (filtered noise pulse)
        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(300, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.5);

        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.01, now);
        noiseGain.gain.linearRampToValueAtTime(0.12, now + 0.3);
        noiseGain.gain.setValueAtTime(0.12, now + duration - 0.2);
        noiseGain.gain.linearRampToValueAtTime(0.001, now + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(now);
    }

    // Synthesizes hydraulic landing gear motor movement and locking thud
    playLandingGearSound(isRetracting) {
        this.ensureContextRunning();

        const now = this.audioCtx.currentTime;
        const duration = 1.8;

        const motorOsc = this.audioCtx.createOscillator();
        const motorGain = this.audioCtx.createGain();

        motorOsc.type = 'sawtooth';
        const startFreq = isRetracting ? 120 : 180;
        const endFreq = isRetracting ? 180 : 120;

        motorOsc.frequency.setValueAtTime(startFreq, now);
        motorOsc.frequency.linearRampToValueAtTime(endFreq, now + duration);

        motorGain.gain.setValueAtTime(0.01, now);
        motorGain.gain.linearRampToValueAtTime(0.15, now + 0.2);
        motorGain.gain.setValueAtTime(0.15, now + duration - 0.2);
        motorGain.gain.linearRampToValueAtTime(0.001, now + duration);

        const motorFilter = this.audioCtx.createBiquadFilter();
        motorFilter.type = 'lowpass';
        motorFilter.frequency.setValueAtTime(350, now);

        motorOsc.connect(motorFilter);
        motorFilter.connect(motorGain);
        motorGain.connect(this.masterGain);

        motorOsc.start(now);
        motorOsc.stop(now + duration);

        const lockTime = now + duration - 0.1;
        const lockOsc = this.audioCtx.createOscillator();
        const lockGain = this.audioCtx.createGain();

        lockOsc.type = 'triangle';
        lockOsc.frequency.setValueAtTime(80, lockTime);
        lockOsc.frequency.exponentialRampToValueAtTime(20, lockTime + 0.15);

        lockGain.gain.setValueAtTime(0.5, lockTime);
        lockGain.gain.exponentialRampToValueAtTime(0.001, lockTime + 0.15);

        lockOsc.connect(lockGain);
        lockGain.connect(this.masterGain);

        lockOsc.start(lockTime);
        lockOsc.stop(lockTime + 0.15);
    }

    startHelicopterEngine() {
        this.ensureContextRunning();
        if (this.isPlaying) return;

        const now = this.audioCtx.currentTime;

        const bufferSize = this.audioCtx.sampleRate * 2;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.noiseNode = this.audioCtx.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;

        this.filterNode = this.audioCtx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(150, now);

        this.lfoNode = this.audioCtx.createOscillator();
        this.lfoNode.type = 'sawtooth';
        this.lfoNode.frequency.setValueAtTime(1.5, now);

        this.lfoGain = this.audioCtx.createGain();
        this.lfoGain.gain.setValueAtTime(200, now);

        this.lfoNode.connect(this.lfoGain);
        this.lfoGain.connect(this.filterNode.frequency);

        this.synthGain = this.audioCtx.createGain();
        this.synthGain.gain.setValueAtTime(0.01, now);
        this.synthGain.gain.exponentialRampToValueAtTime(0.5, now + 1.0);

        this.noiseNode.connect(this.filterNode);
        this.filterNode.connect(this.synthGain);
        this.synthGain.connect(this.masterGain);

        this.noiseNode.start(now);
        this.lfoNode.start(now);
        this.isPlaying = true;
    }

    stopHelicopterEngine() {
        if (!this.isPlaying || !this.audioCtx) return;

        const now = this.audioCtx.currentTime;

        if (this.synthGain) {
            this.synthGain.gain.setValueAtTime(this.synthGain.gain.value, now);
            this.synthGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        }

        setTimeout(() => {
            if (this.noiseNode) {
                this.noiseNode.stop();
                this.noiseNode.disconnect();
            }
            if (this.lfoNode) {
                this.lfoNode.stop();
                this.lfoNode.disconnect();
            }
            this.isPlaying = false;
        }, 2000);
    }

    updateHelicopterAudio(enginePower, moveSpeed) {
        if (!this.isPlaying || !this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        
        const speedFactor = Math.abs(moveSpeed) / 75.0;
        const targetLfoFreq = THREEMathClamp(2.0 + (enginePower * 12.0) + (speedFactor * 6.0), 1.5, 22.0);
        const targetBaseFilterFreq = THREEMathClamp(150 + (enginePower * 350) + (speedFactor * 250), 150, 800);

        this.lfoNode.frequency.setTargetAtTime(targetLfoFreq, now, 0.1);
        this.filterNode.frequency.setTargetAtTime(targetBaseFilterFreq, now, 0.1);
    }
}

function THREEMathClamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}