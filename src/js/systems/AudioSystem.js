var RealmKit = RealmKit || {};

/**
 * RealmKit.AudioSystem
 * Procedural Web Audio API sound effects — no audio files required.
 *
 * Sounds are synthesised on the fly using OscillatorNodes, BufferSourceNodes
 * (white/brown noise), and GainNodes with ADSR-style envelopes.
 *
 * Usage:
 *   engine.audio = new RealmKit.AudioSystem();
 *   engine.audio.playHit(false);     // normal hit
 *   engine.audio.playHit(true);      // critical hit
 *   engine.audio.playFootstep();     // footstep tick
 *   engine.audio.startAmbient();     // looping wind ambience
 *   engine.audio.stopAmbient();
 *   engine.audio.setMasterVolume(0.5);
 */
RealmKit.AudioSystem = class AudioSystem {
    constructor(config) {
        this.config = config || {};
        this._ctx = null;          // AudioContext, lazy-created on first sound
        this._master = null;       // GainNode (master volume)
        this._ambientNode = null;  // current ambient BufferSourceNode
        this._ambientGain = null;
        this.masterVolume = this.config.masterVolume !== undefined ? this.config.masterVolume : 0.35;
        this.muted = false;

        // Footstep throttle
        this._footstepTimer = 0;
        this._footstepInterval = 380;  // ms between footstep ticks

        console.log('[AudioSystem] Initialized (lazy AudioContext)');
    }

    // ── Context bootstrap (call inside a user-gesture handler) ────────────────
    _ensureCtx() {
        if (this._ctx) return true;
        try {
            var CtxClass = window.AudioContext || window.webkitAudioContext;
            if (!CtxClass) {
                console.warn('[AudioSystem] Web Audio API not supported');
                return false;
            }
            this._ctx = new CtxClass();
            this._master = this._ctx.createGain();
            this._master.gain.value = this.muted ? 0 : this.masterVolume;
            this._master.connect(this._ctx.destination);
            console.log('[AudioSystem] AudioContext created, sample rate:', this._ctx.sampleRate);
        } catch (e) {
            console.warn('[AudioSystem] Failed to create AudioContext:', e);
            return false;
        }
        return true;
    }

    // ── White-noise buffer (reused for all noise bursts) ─────────────────────
    _makeNoiseBuffer(durationSec, type) {
        var ctx = this._ctx;
        var sampleCount = Math.ceil(ctx.sampleRate * durationSec);
        var buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        if (type === 'brown') {
            // Brown noise: integrate white noise
            var last = 0;
            for (var i = 0; i < sampleCount; i++) {
                var white = (Math.random() * 2 - 1) * 0.02;
                last = (last + white) * 0.99;
                data[i] = last * 3.5;  // normalise roughly to [-1,1]
            }
        } else {
            // White noise
            for (var i = 0; i < sampleCount; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        return buffer;
    }

    // ── Gain envelope helper ──────────────────────────────────────────────────
    _ramp(gainNode, now, attack, hold, decay, peakVal, sustainVal) {
        var g = gainNode.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
        g.linearRampToValueAtTime(peakVal, now + attack);
        g.setValueAtTime(peakVal, now + attack + hold);
        g.exponentialRampToValueAtTime(Math.max(0.0001, sustainVal), now + attack + hold + decay);
    }

    // ── HIT sound ─────────────────────────────────────────────────────────────
    // Normal hit: short metallic thunk (sine chirp + filtered noise)
    // Critical hit: brighter, louder, longer ring
    playHit(isCrit) {
        if (!this._ensureCtx()) return;
        var ctx = this._ctx;
        var now = ctx.currentTime;

        var peak   = isCrit ? 0.55 : 0.35;
        var freq1  = isCrit ? 280  : 200;   // start freq
        var freq2  = isCrit ? 60   : 80;    // end freq (drop = metallic thunk)
        var dur    = isCrit ? 0.28 : 0.18;

        // ── Tone component (sine chirp, pitch falls) ──
        var osc = ctx.createOscillator();
        osc.type = isCrit ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq1, now);
        osc.frequency.exponentialRampToValueAtTime(freq2, now + dur * 0.8);

        var oscGain = ctx.createGain();
        this._ramp(oscGain, now, 0.003, 0.005, dur * 0.85, peak * 0.6, 0.0001);

        // ── Noise transient component ──
        var noiseLen = isCrit ? 0.12 : 0.07;
        var noiseBuffer = this._makeNoiseBuffer(noiseLen, 'white');
        var noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;

        var noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = isCrit ? 1800 : 1200;
        noiseFilter.Q.value = 1.5;

        var noiseGain = ctx.createGain();
        this._ramp(noiseGain, now, 0.001, 0.002, noiseLen * 0.9, peak * 0.5, 0.0001);

        // ── Sub-thump (very low sine, gives weight) ──
        var sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(isCrit ? 90 : 60, now);
        sub.frequency.exponentialRampToValueAtTime(20, now + dur * 0.6);
        var subGain = ctx.createGain();
        this._ramp(subGain, now, 0.001, 0.002, dur * 0.5, peak * 0.7, 0.0001);

        // Wire
        osc.connect(oscGain);        oscGain.connect(this._master);
        noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(this._master);
        sub.connect(subGain);        subGain.connect(this._master);

        osc.start(now);     osc.stop(now + dur);
        noiseSrc.start(now); noiseSrc.stop(now + noiseLen);
        sub.start(now);     sub.stop(now + dur * 0.7);

        // Extra crit sparkle: short high-pitched ring
        if (isCrit) {
            var sparkle = ctx.createOscillator();
            sparkle.type = 'sine';
            sparkle.frequency.setValueAtTime(2200, now + 0.03);
            sparkle.frequency.exponentialRampToValueAtTime(800, now + 0.22);
            var sparkleGain = ctx.createGain();
            this._ramp(sparkleGain, now + 0.03, 0.002, 0.005, 0.18, peak * 0.4, 0.0001);
            sparkle.connect(sparkleGain); sparkleGain.connect(this._master);
            sparkle.start(now + 0.03); sparkle.stop(now + 0.25);
        }
    }

    // ── FOOTSTEP sound ────────────────────────────────────────────────────────
    // Very soft brown-noise pulse with a low-pass filter — subdued, not distracting
    playFootstep() {
        if (!this._ensureCtx()) return;
        var ctx = this._ctx;
        var now = ctx.currentTime;

        var noiseBuffer = this._makeNoiseBuffer(0.06, 'brown');
        var src = ctx.createBufferSource();
        src.buffer = noiseBuffer;

        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 280 + Math.random() * 80;  // slight pitch variation

        var gain = ctx.createGain();
        this._ramp(gain, now, 0.002, 0.005, 0.045, 0.10, 0.0001);

        src.connect(filter); filter.connect(gain); gain.connect(this._master);
        src.start(now); src.stop(now + 0.06);
    }

    // Throttled footstep called every frame when player is moving
    tickFootstep(deltaTime) {
        this._footstepTimer += deltaTime;
        if (this._footstepTimer >= this._footstepInterval) {
            this._footstepTimer = 0;
            this.playFootstep();
        }
    }

    // ── AMBIENT wind ─────────────────────────────────────────────────────────
    // Looping brown noise shaped through a slow LFO on a bandpass filter.
    startAmbient() {
        if (!this._ensureCtx()) return;
        if (this._ambientNode) return;  // already running
        var ctx = this._ctx;

        // Long brown-noise buffer (8 seconds, looped)
        var buffer = this._makeNoiseBuffer(8, 'brown');

        this._ambientNode = ctx.createBufferSource();
        this._ambientNode.buffer = buffer;
        this._ambientNode.loop = true;

        // Bandpass shaped like wind
        var windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 300;
        windFilter.Q.value = 0.6;

        // High-pass to remove rumble
        var hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = 80;

        this._ambientGain = ctx.createGain();
        this._ambientGain.gain.setValueAtTime(0, ctx.currentTime);
        this._ambientGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2.5);

        this._ambientNode.connect(windFilter);
        windFilter.connect(hpFilter);
        hpFilter.connect(this._ambientGain);
        this._ambientGain.connect(this._master);

        this._ambientNode.start();

        // Slowly modulate the filter frequency with a 12s LFO to give gusts
        this._windLFOInterval = setInterval(function() {
            if (!this._ambientNode) { clearInterval(this._windLFOInterval); return; }
            var target = 200 + Math.random() * 400;
            windFilter.frequency.linearRampToValueAtTime(target, ctx.currentTime + 4);
            var volTarget = 0.12 + Math.random() * 0.10;
            this._ambientGain.gain.linearRampToValueAtTime(volTarget, ctx.currentTime + 3);
        }.bind(this), 5000);

        console.log('[AudioSystem] Ambient wind started');
    }

    stopAmbient() {
        if (!this._ambientNode) return;
        var ctx = this._ctx;
        if (this._ambientGain) {
            this._ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        }
        var node = this._ambientNode;
        this._ambientNode = null;
        setTimeout(function() { try { node.stop(); } catch(e) {} }, 1600);
        if (this._windLFOInterval) { clearInterval(this._windLFOInterval); this._windLFOInterval = null; }
        console.log('[AudioSystem] Ambient wind stopping');
    }

    // ── DEATH sound (deep falling tone) ──────────────────────────────────────
    playDeath() {
        if (!this._ensureCtx()) return;
        var ctx = this._ctx;
        var now = ctx.currentTime;

        // Low falling tone
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.9);

        var gain = ctx.createGain();
        this._ramp(gain, now, 0.005, 0.02, 0.85, 0.50, 0.0001);

        // Noise body
        var noiseBuffer = this._makeNoiseBuffer(0.4, 'brown');
        var noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        var noiseFilt = ctx.createBiquadFilter();
        noiseFilt.type = 'lowpass';
        noiseFilt.frequency.value = 250;
        var noiseGain = ctx.createGain();
        this._ramp(noiseGain, now, 0.003, 0.01, 0.35, 0.35, 0.0001);

        osc.connect(gain); gain.connect(this._master);
        noiseSrc.connect(noiseFilt); noiseFilt.connect(noiseGain); noiseGain.connect(this._master);
        osc.start(now); osc.stop(now + 0.95);
        noiseSrc.start(now); noiseSrc.stop(now + 0.4);
    }

    // ── Volume controls ────────────────────────────────────────────────────────
    setMasterVolume(v) {
        this.masterVolume = Math.max(0, Math.min(1, v));
        if (this._master) {
            this._master.gain.linearRampToValueAtTime(
                this.muted ? 0 : this.masterVolume,
                this._ctx.currentTime + 0.05
            );
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this._master) {
            this._master.gain.linearRampToValueAtTime(
                this.muted ? 0 : this.masterVolume,
                this._ctx.currentTime + 0.05
            );
        }
        return this.muted;
    }

    // ── BACKGROUND MUSIC ─────────────────────────────────────────────────────────
    // SNES-style RPG town theme — A minor, 112 BPM, 4-bar loop
    // Voices: square melody, triangle bass, soft chord stabs, kick+rim percussion
    // Ambient wind is automatically dimmed when music plays so it doesn't compete.
    _musicNodes            = null;
    _musicGain             = null;
    _musicPlaying          = false;
    _musicVolume           = 0.28;
    _musicSchedulerTimeout = null;

    playMusic(trackName) {
        if (!this._ensureCtx()) return;
        if (this._musicPlaying) this.stopMusic();

        // Dim the ambient wind so music is clearly audible
        if (this._ambientGain && this._ctx) {
            this._ambientGain.gain.cancelScheduledValues(this._ctx.currentTime);
            this._ambientGain.gain.linearRampToValueAtTime(0.03, this._ctx.currentTime + 1.5);
        }

        var ctx  = this._ctx;
        var self = this;

        this._musicPlaying          = true;
        this._musicNodes            = [];
        this._musicSchedulerTimeout = null;

        // Master music gain — 1.5 second fade-in
        this._musicGain = ctx.createGain();
        this._musicGain.gain.setValueAtTime(0, ctx.currentTime);
        this._musicGain.gain.linearRampToValueAtTime(this._musicVolume, ctx.currentTime + 1.5);
        this._musicGain.connect(this._master);

        // ── Timing ─────────────────────────────────────────────────────────────
        // A minor town theme: 112 BPM, 4-bar loop
        // Chord progression: Am | F | G | Am
        // MIDI: A4=69 B4=71 C5=72 D5=74 E5=76 F5=77 G5=79
        //       A2=45 C3=48 E3=52 F2=41 G2=43 D3=50
        var BPM  = 112;
        var BEAT = 60 / BPM;    // ≈ 0.536 s
        var BAR  = BEAT * 4;
        var LOOP = BAR  * 4;    // 4-bar loop ≈ 8.57 s

        var m2f = function(n) { return 440 * Math.pow(2, (n - 69) / 12); };

        // note(midi, startTime, beats, vol, waveType, lpFreq)
        // Notes play at 68% of their beat duration for a crisp, staccato SNES feel.
        var note = function(midi, t, beats, vol, wave, lp) {
            if (midi <= 0) return;   // 0 = rest
            var dur  = beats * BEAT * 0.68;
            var att  = 0.008;
            var osc  = ctx.createOscillator();
            var filt = ctx.createBiquadFilter();
            var env  = ctx.createGain();

            osc.type             = wave || 'square';
            osc.frequency.value  = m2f(midi);
            filt.type            = 'lowpass';
            filt.frequency.value = lp || 1800;
            filt.Q.value         = 0.5;

            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vol, t + att);
            env.gain.setValueAtTime(vol, t + dur - 0.02);
            env.gain.linearRampToValueAtTime(0.0001, t + dur);

            osc.connect(filt);
            filt.connect(env);
            env.connect(self._musicGain);
            osc.start(t);
            osc.stop(t + dur + 0.04);
            self._musicNodes.push(osc);
        };

        // Soft kick drum (sine pitch-drop)
        var kick = function(t) {
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(80, t);
            o.frequency.exponentialRampToValueAtTime(28, t + 0.09);
            g.gain.setValueAtTime(0.22, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
            o.connect(g); g.connect(self._musicGain);
            o.start(t); o.stop(t + 0.12);
            self._musicNodes.push(o);
        };

        // Rim shot — short filtered click (more SNES-like than a snare)
        var rim = function(t) {
            var src = ctx.createBufferSource();
            src.buffer = self._makeNoiseBuffer(0.06, 'white');
            var bp  = ctx.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2.0;
            var env = ctx.createGain();
            env.gain.setValueAtTime(0.10, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            src.connect(bp); bp.connect(env); env.connect(self._musicGain);
            src.start(t); src.stop(t + 0.07);
        };

        // ── Sequences ──────────────────────────────────────────────────────────
        // Lead melody — [midi, beats], rests = [0, beats]
        // A minor: phrase 1 (bars 1-2), phrase 2 (bars 3-4)
        var MELODY = [
            // Bar 1 — Am: quick ascending figure, held peak
            [72,0.5],[74,0.5],[76,0.5],[74,0.5], [72,1.5],[0,0.5],
            // Bar 2 — F: stepwise descent with breath
            [77,1.0],[76,0.5],[74,0.5],           [72,1.0],[0,1.0],
            // Bar 3 — G: climb through the G chord
            [71,0.5],[72,0.5],[74,1.0],            [76,1.0],[79,1.0],
            // Bar 4 — Am: resolve down, held final note
            [76,0.5],[74,0.5],[72,1.0],            [69,2.0]
        ];

        // Bass — triangle wave, root + fifth half-note pulse per bar
        var BASS = [
            [45,2.0],[52,2.0],   // Bar 1: A2 · E3  (Am)
            [41,2.0],[48,2.0],   // Bar 2: F2 · C3  (F)
            [43,2.0],[50,2.0],   // Bar 3: G2 · D3  (G)
            [45,4.0]             // Bar 4: A2 whole  (Am)
        ];

        // Chord stabs — one quiet stab on beat 1 of each bar (root+3rd+5th)
        // Played as fast rolled arpeggio (each note offset by 1 tick) for warmth
        var CHORDS = [
            { beat: 0,        notes: [57,60,64] },  // Am
            { beat: BAR,      notes: [53,57,60] },  // F
            { beat: BAR*2,    notes: [55,59,62] },  // G
            { beat: BAR*3,    notes: [57,60,64] }   // Am
        ];

        // ── Loop scheduler ────────────────────────────────────────────────────
        var schedule = function(loopStart) {
            if (!self._musicPlaying) return;
            self._musicNodes = [];

            // Melody — square wave, lowpass 1800 Hz
            var t = loopStart;
            for (var i = 0; i < MELODY.length; i++) {
                note(MELODY[i][0], t, MELODY[i][1], 0.32, 'square', 1800);
                t += MELODY[i][1] * BEAT;
            }

            // Bass — triangle wave, lowpass 600 Hz, slightly legato (85% duration)
            t = loopStart;
            for (var j = 0; j < BASS.length; j++) {
                var bdur = BASS[j][1];
                var blen = bdur * BEAT * 0.85;
                var att2 = 0.015;
                var bo   = ctx.createOscillator();
                var benv = ctx.createGain();
                var bflt = ctx.createBiquadFilter();
                bo.type = 'triangle';
                bo.frequency.value = m2f(BASS[j][0]);
                bflt.type = 'lowpass'; bflt.frequency.value = 580;
                benv.gain.setValueAtTime(0, t);
                benv.gain.linearRampToValueAtTime(0.38, t + att2);
                benv.gain.setValueAtTime(0.38, t + blen - 0.025);
                benv.gain.linearRampToValueAtTime(0.0001, t + blen);
                bo.connect(bflt); bflt.connect(benv); benv.connect(self._musicGain);
                bo.start(t); bo.stop(t + blen + 0.04);
                self._musicNodes.push(bo);
                t += bdur * BEAT;
            }

            // Chord stabs — very quiet, rolled quickly so they read as chords not unison
            for (var k = 0; k < CHORDS.length; k++) {
                var chord = CHORDS[k];
                for (var n = 0; n < chord.notes.length; n++) {
                    note(chord.notes[n], loopStart + chord.beat + n * 0.018,
                         0.35, 0.045, 'square', 2800);
                }
            }

            // Percussion: kick on beats 1 & 3, rim on beats 2 & 4
            t = loopStart;
            for (var b = 0; b < 4; b++) {
                kick(t);
                rim(t  + BEAT);
                kick(t + BEAT * 2);
                rim(t  + BEAT * 3);
                t += BAR;
            }

            // Queue next loop 200 ms before end
            self._musicSchedulerTimeout = setTimeout(function() {
                schedule(loopStart + LOOP);
            }, (LOOP - 0.2) * 1000);
        };

        schedule(ctx.currentTime + 0.05);
        console.log('[AudioSystem] SNES RPG music started:', trackName || 'town_theme');
    }

    stopMusic(fadeTime) {
        if (!this._musicPlaying) return;

        if (this._musicSchedulerTimeout) {
            clearTimeout(this._musicSchedulerTimeout);
            this._musicSchedulerTimeout = null;
        }

        var ctx  = this._ctx;
        var fade = (fadeTime !== undefined) ? fadeTime : 1.5;

        if (this._musicGain && ctx) {
            this._musicGain.gain.cancelScheduledValues(ctx.currentTime);
            this._musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
        }

        // Restore ambient to normal level as music fades
        if (this._ambientGain && ctx) {
            this._ambientGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + fade + 0.5);
        }

        var nodes = this._musicNodes || [];
        setTimeout(function() {
            nodes.forEach(function(n) { try { n.stop(); } catch(e) {} });
        }, (fade + 0.1) * 1000);

        this._musicNodes   = null;
        this._musicPlaying = false;
        console.log('[AudioSystem] Music stopped');
    }

    setMusicVolume(v) {
        this._musicVolume = Math.max(0, Math.min(1, v));
        if (this._musicGain && this._ctx) {
            this._musicGain.gain.linearRampToValueAtTime(
                this._musicVolume,
                this._ctx.currentTime + 0.1
            );
        }
    }

    isMusicPlaying() {
        return this._musicPlaying;
    }

    // ── CONVENIENCE: one-shot procedural sound ───────────────────────────────────
    playTone(frequency, duration, type, volume) {
        if (!this._ensureCtx()) return;
        
        var ctx = this._ctx;
        var now = ctx.currentTime;
        
        var osc = ctx.createOscillator();
        osc.type = type || 'sine';
        osc.frequency.value = frequency || 440;
        
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume || 0.3, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (duration || 0.2));
        
        osc.connect(gain);
        gain.connect(this._master);
        
        osc.start(now);
        osc.stop(now + (duration || 0.2) + 0.1);
    }
};

console.log('[AudioSystem] Class loaded');
