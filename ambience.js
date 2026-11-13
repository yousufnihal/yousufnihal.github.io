/* Optional ambient sound that follows the background operation.
   Muted by default; nothing is created until the visitor turns it on.
   Everything is synthesised with Web Audio (no files), every level change is
   smoothed, a compressor caps the peak level, and audio suspends whenever the
   tab is hidden or sound is turned off.

   Follows the same scroll progress as ops-scene.js:
   - a low drone that slowly opens up as the operation progresses
   - keyboard typing in short bursts, busiest during the exploit phase
   - soft network blips, more frequent as more of the network is reached
   - a quiet interface chirp when the operation moves to a new phase
   - one gentle success chime when the operation completes */
(() => {
    'use strict';

    const button = document.getElementById('sound-toggle');
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!button) return;
    if (!AudioCtx) {
        button.hidden = true;
        return;
    }

    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const mix = (a, b, f) => a + (b - a) * f;
    const smooth = (f) => f * f * (3 - 2 * f);
    const PHASES = 5;
    const TYPING_BY_PHASE = [0.35, 0.6, 0.75, 1, 0.45]; // How busy the keyboard is

    // Same progress curve as the background scene
    const progress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const raw = max > 0 ? clamp01(window.scrollY / max) : 0;
        const p = smooth(clamp01(raw / 0.9));
        const phase = Math.min(PHASES - 1, Math.floor(p * (PHASES - 1)));
        return { p, phase, done: p > 0.995 };
    };

    let ac = null;
    let bus = null;
    let master = null;
    let pad = null;
    let padFilter = null;
    let air = null;
    let noise = null;
    let on = false;
    let timers = [];
    let lastPhase = -1;
    let successPlayed = false;

    const build = () => {
        ac = new AudioCtx();

        // sources -> bus -> compressor -> master -> speakers
        master = ac.createGain();
        master.gain.value = 0;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -26;
        comp.ratio.value = 4;
        comp.attack.value = 0.01;
        comp.release.value = 0.4;
        bus = ac.createGain();
        bus.connect(comp).connect(master).connect(ac.destination);

        // Shared noise buffer for air and keystrokes
        noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        // Drone: soft, slowly drifting low tones through a gentle low-pass
        padFilter = ac.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 320;
        padFilter.Q.value = 0.6;
        pad = ac.createGain();
        pad.gain.value = 0;
        padFilter.connect(pad).connect(bus);
        [[55, 'triangle', 0.5], [82.41, 'triangle', 0.35], [110.3, 'sine', 0.22]].forEach(([freq, type, level], i) => {
            const osc = ac.createOscillator();
            osc.type = type;
            osc.frequency.value = freq;
            const lfo = ac.createOscillator();
            lfo.frequency.value = 0.04 + i * 0.03;
            const depth = ac.createGain();
            depth.gain.value = 4;
            lfo.connect(depth).connect(osc.detune);
            const g = ac.createGain();
            g.gain.value = level;
            osc.connect(g).connect(padFilter);
            osc.start();
            lfo.start();
        });

        // Room air: very quiet band-passed noise
        const airSrc = ac.createBufferSource();
        airSrc.buffer = noise;
        airSrc.loop = true;
        const airFilter = ac.createBiquadFilter();
        airFilter.type = 'bandpass';
        airFilter.frequency.value = 700;
        airFilter.Q.value = 0.4;
        air = ac.createGain();
        air.gain.value = 0;
        airSrc.connect(airFilter).connect(air).connect(bus);
        airSrc.start();
    };

    /* ---------- One-shot sounds ---------- */

    const envelope = (gainNode, start, peak, attack, decay) => {
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(peak, start + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    };

    const keystroke = (when, level) => {
        const src = ac.createBufferSource();
        src.buffer = noise;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2200 + Math.random() * 1800;
        filter.Q.value = 1.2;
        const g = ac.createGain();
        envelope(g, when, level * (0.6 + Math.random() * 0.4), 0.002, 0.045);
        src.connect(filter).connect(g).connect(bus);
        src.start(when, Math.random() * 1.8, 0.06);
    };

    const tone = (when, freq, level, attack, decay, type = 'sine') => {
        const osc = ac.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = ac.createGain();
        envelope(g, when, level, attack, decay);
        osc.connect(g).connect(bus);
        osc.start(when);
        osc.stop(when + attack + decay + 0.05);
    };

    const BLIPS = [1318.5, 1568, 1760, 2093, 2349.3];
    const blip = (when, level) => tone(when, BLIPS[(Math.random() * BLIPS.length) | 0], level, 0.004, 0.12);

    const chirp = () => {
        const now = ac.currentTime + 0.02;
        tone(now, 880, 0.018, 0.005, 0.08);
        tone(now + 0.07, 1318.5, 0.016, 0.005, 0.12);
    };

    const success = () => {
        const now = ac.currentTime + 0.05;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            tone(now + i * 0.16, freq, 0.03, 0.02, 1.4);
            tone(now + i * 0.16, freq / 2, 0.012, 0.03, 1.6, 'triangle');
        });
    };

    /* ---------- Schedulers (only run while sound is on) ---------- */

    const later = (fn, ms) => {
        const id = setTimeout(() => {
            timers = timers.filter(x => x !== id);
            if (on && !document.hidden) fn();
            else if (on) later(fn, 1000); // Hidden tab: try again later
        }, ms);
        timers.push(id);
    };

    // Bursts of typing with natural pauses between them
    const typing = () => {
        const { p, phase, done } = progress();
        const busy = done ? 0.15 : TYPING_BY_PHASE[phase];
        const level = mix(0.035, 0.06, p);
        const count = 3 + ((Math.random() * 7 * busy) | 0);
        let at = ac.currentTime + 0.05;
        for (let i = 0; i < count; i++) {
            keystroke(at, level);
            at += 0.065 + Math.random() * 0.09;
        }
        later(typing, (count * 110) + mix(2600, 700, busy) * (0.6 + Math.random() * 0.8));
    };

    // Network chatter: single blips, sometimes a short run of them
    const network = () => {
        const { p, done } = progress();
        const now = ac.currentTime + 0.05;
        const level = done ? 0.006 : mix(0.008, 0.014, p);
        const run = Math.random() < 0.25 + p * 0.3 ? 3 : 1;
        for (let i = 0; i < run; i++) blip(now + i * 0.05, level);
        later(network, mix(3200, 1100, p) * (0.6 + Math.random() * 0.8));
    };

    // Levels, phase changes and completion follow the scroll position
    const follow = () => {
        if (!on) return;
        const { p, phase, done } = progress();
        const now = ac.currentTime;
        pad.gain.setTargetAtTime(mix(0.05, 0.085, p), now, 1.2);
        padFilter.frequency.setTargetAtTime(done ? 900 : mix(300, 620, p), now, 1.5);
        air.gain.setTargetAtTime(mix(0.006, 0.012, p), now, 1.5);

        if (lastPhase !== -1 && phase > lastPhase && !done) chirp();
        lastPhase = phase;

        if (done && !successPlayed) {
            successPlayed = true;
            success();
        } else if (p < 0.85) {
            successPlayed = false; // Re-arm once the visitor scrolls back up
        }
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!on || ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; follow(); });
    }, { passive: true });

    /* ---------- On / off ---------- */

    const setLabel = () => {
        button.setAttribute('aria-pressed', String(on));
        button.querySelector('.sound-state').textContent = on ? 'on' : 'off';
        button.querySelector('use').setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
    };

    const turnOn = () => {
        if (!ac) build();
        on = true;
        setLabel();
        ac.resume().then(() => {
            const { phase, done } = progress();
            lastPhase = phase;
            successPlayed = done; // Do not chime just because sound was turned on at the end
            master.gain.cancelScheduledValues(ac.currentTime);
            master.gain.setTargetAtTime(0.75, ac.currentTime, 0.8); // Slow fade in
            follow();
            later(typing, 1200);
            later(network, 2000);
        });
    };

    const turnOff = () => {
        on = false;
        setLabel();
        timers.forEach(clearTimeout);
        timers = [];
        if (!ac) return;
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(0, ac.currentTime, 0.35); // Fade out, then sleep
        setTimeout(() => { if (!on) ac.suspend(); }, 1800);
    };

    button.addEventListener('click', () => (on ? turnOff() : turnOn()));

    document.addEventListener('visibilitychange', () => {
        if (!ac || !on) return;
        if (document.hidden) ac.suspend();
        else ac.resume();
    });

    setLabel();
})();
