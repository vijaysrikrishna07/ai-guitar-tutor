/**
 * ParticleEngine.js — Audio-Reactive Particle System
 * ────────────────────────────────────────────────────
 * Renders onto the existing overlay canvas to create exhibit-worthy
 * visual effects: ambient embers, explosive bursts on correct chords,
 * fretboard glow pulses, and audio-reactive sizing.
 */

// ── Chord colour palettes ────────────────────────────────────────────────────

const CHORD_PALETTES = {
    em:  { primary: '#f59e0b', secondary: '#d97706', glow: 'rgba(245, 158, 11, 0.35)',  name: 'amber'   },
    c:   { primary: '#06b6d4', secondary: '#0284c7', glow: 'rgba(6, 182, 212, 0.35)',   name: 'cyan'    },
    g:   { primary: '#fbbf24', secondary: '#f59e0b', glow: 'rgba(251, 191, 36, 0.35)',   name: 'gold'    },
    d:   { primary: '#f97066', secondary: '#ef4444', glow: 'rgba(249, 112, 102, 0.3)',  name: 'coral'   },
    am:  { primary: '#2dd4a0', secondary: '#10b981', glow: 'rgba(45, 212, 160, 0.35)',  name: 'emerald' },
    bm:  { primary: '#38bdf8', secondary: '#0284c7', glow: 'rgba(56, 189, 248, 0.35)',  name: 'sky'     },
    dm:  { primary: '#fb923c', secondary: '#f97316', glow: 'rgba(251, 146, 60, 0.35)',  name: 'orange'  },
    e:   { primary: '#eab308', secondary: '#ca8a04', glow: 'rgba(234, 179, 8, 0.35)',   name: 'warmgold'},
    f:   { primary: '#14b8a6', secondary: '#0d9488', glow: 'rgba(20, 184, 166, 0.35)',  name: 'teal'    },
};

const DEFAULT_PALETTE = { primary: '#06b6d4', secondary: '#f59e0b', glow: 'rgba(6, 182, 212, 0.3)', name: 'default' };

// ── Particle class ───────────────────────────────────────────────────────────

class Particle {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.vx = opts.vx ?? (Math.random() - 0.5) * 2;
        this.vy = opts.vy ?? -(Math.random() * 3 + 1);
        this.size = opts.size ?? (Math.random() * 3 + 1.5);
        this.baseSize = this.size;
        this.color = opts.color ?? '#4f9cf9';
        this.alpha = opts.alpha ?? 1;
        this.decay = opts.decay ?? (0.008 + Math.random() * 0.012);
        this.gravity = opts.gravity ?? 0.02;
        this.friction = opts.friction ?? 0.99;
        this.life = 1;
    }

    update(audioLevel = 0) {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.alpha = Math.max(0, this.life);
        // Audio-reactive: boost size when loud
        this.size = this.baseSize * (1 + audioLevel * 0.8);
    }

    get isDead() { return this.life <= 0; }

    draw(ctx) {
        if (this.isDead) return;
        ctx.save();
        ctx.globalAlpha = this.alpha * 0.9;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.size * 3;
        ctx.fill();
        ctx.restore();
    }
}

// ── Main Engine ──────────────────────────────────────────────────────────────

export class ParticleEngine {
    constructor(canvas) {
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        this._particles = [];
        this._roi = null;
        this._palette = DEFAULT_PALETTE;
        this._audioLevel = 0;
        this._gridLines = null;

        // Glow state
        this._glowAlpha = 0;
        this._glowDecay = 0.025;

        // Ambient emitter timing
        this._lastAmbient = 0;
        this._ambientInterval = 120; // ms between ambient particle spawns

        // String shimmer state
        this._shimmerPhase = 0;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /** Update the fretboard region */
    setROI(roi) { this._roi = roi; }

    /** Update grid lines for string shimmer */
    setGridLines(gridLines) { this._gridLines = gridLines; }

    /** Set colour palette from chord name */
    setChord(chordName) {
        if (!chordName) { this._palette = DEFAULT_PALETTE; return; }
        const key = chordName.toLowerCase();
        this._palette = CHORD_PALETTES[key] ?? DEFAULT_PALETTE;
    }

    /** Set current audio volume (0..1) */
    setAudioLevel(vol) { this._audioLevel = Math.min(1, Math.max(0, vol)); }

    /** Explode particles from fretboard center */
    triggerBurst(intensity = 1.0) {
        if (!this._roi) return;
        const cx = this._roi.x + this._roi.width / 2;
        const cy = this._roi.y + this._roi.height / 2;
        const count = Math.round(45 * intensity);

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 3 + Math.random() * 6 * intensity;
            const color = Math.random() > 0.5 ? this._palette.primary : this._palette.secondary;

            this._particles.push(new Particle(cx, cy, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 2 + Math.random() * 4 * intensity,
                color,
                decay: 0.012 + Math.random() * 0.008,
                gravity: 0.04,
                friction: 0.97,
            }));
        }

        // Spawn extra sparkle particles (tiny, fast)
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 8;
            this._particles.push(new Particle(cx, cy, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                size: 1 + Math.random() * 1.5,
                color: '#ffffff',
                decay: 0.03 + Math.random() * 0.02,
                gravity: 0.01,
                friction: 0.96,
            }));
        }
    }

    /** Flash the fretboard ROI with a glow pulse */
    triggerGlow() {
        this._glowAlpha = 1.0;
    }

    /** Tick physics + render everything */
    update() {
        if (!this._roi) return;
        const ctx = this._ctx;
        const now = performance.now();

        // ── Ambient embers ──────────────────────────────────────
        if (now - this._lastAmbient > this._ambientInterval) {
            this._lastAmbient = now;
            this._spawnAmbient();
        }

        // ── Update particles ────────────────────────────────────
        for (let i = this._particles.length - 1; i >= 0; i--) {
            this._particles[i].update(this._audioLevel);
            if (this._particles[i].isDead) {
                this._particles.splice(i, 1);
            }
        }

        // Cap particle count to prevent lag
        if (this._particles.length > 300) {
            this._particles.splice(0, this._particles.length - 300);
        }

        // ── Draw string shimmer ─────────────────────────────────
        if (this._audioLevel > 0.05 && this._gridLines) {
            this._drawStringShimmer(ctx);
        }

        // ── Draw glow ───────────────────────────────────────────
        if (this._glowAlpha > 0.01) {
            this._drawGlow(ctx);
            this._glowAlpha = Math.max(0, this._glowAlpha - this._glowDecay);
        }

        // ── Draw particles ──────────────────────────────────────
        for (const p of this._particles) {
            p.draw(ctx);
        }
    }

    /** Cleanup */
    destroy() {
        this._particles = [];
        this._glowAlpha = 0;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    _spawnAmbient() {
        if (!this._roi) return;
        const roi = this._roi;
        // Spawn 1-2 particles along the bottom edge of the ROI
        const count = this._audioLevel > 0.1 ? 2 : 1;
        for (let i = 0; i < count; i++) {
            const x = roi.x + Math.random() * roi.width;
            const y = roi.y + roi.height - Math.random() * 10;
            const color = Math.random() > 0.6 ? this._palette.primary : this._palette.secondary;

            this._particles.push(new Particle(x, y, {
                vx: (Math.random() - 0.5) * 0.5,
                vy: -(0.3 + Math.random() * 0.8),
                size: 1 + Math.random() * 2,
                color,
                alpha: 0.4 + Math.random() * 0.3,
                decay: 0.005 + Math.random() * 0.005,
                gravity: -0.01, // float upward
                friction: 0.995,
            }));
        }
    }

    _drawGlow(ctx) {
        const roi = this._roi;
        if (!roi) return;

        const cx = roi.x + roi.width / 2;
        const cy = roi.y + roi.height / 2;
        const rx = roi.width / 2;
        const ry = roi.height / 2;

        ctx.save();
        ctx.globalAlpha = this._glowAlpha * 0.5;

        // Radial gradient fill across ROI
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
        grad.addColorStop(0, this._palette.primary);
        grad.addColorStop(0.5, this._palette.glow);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fillRect(roi.x - 20, roi.y - 20, roi.width + 40, roi.height + 40);

        // Border glow
        ctx.strokeStyle = this._palette.primary;
        ctx.lineWidth = 3;
        ctx.globalAlpha = this._glowAlpha * 0.7;
        ctx.shadowColor = this._palette.primary;
        ctx.shadowBlur = 25;
        ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

        ctx.restore();
    }

    _drawStringShimmer(ctx) {
        if (!this._gridLines || !this._gridLines.strings) return;
        this._shimmerPhase += 0.05;

        ctx.save();
        for (let i = 0; i < this._gridLines.strings.length; i++) {
            const line = this._gridLines.strings[i];
            const shimmer = Math.sin(this._shimmerPhase + i * 1.2) * 0.5 + 0.5;
            const intensity = shimmer * this._audioLevel;

            if (intensity < 0.02) continue;

            ctx.beginPath();
            ctx.moveTo(line.x1, line.y1);
            ctx.lineTo(line.x2, line.y2);
            ctx.strokeStyle = this._palette.primary;
            ctx.lineWidth = 1.5 + intensity * 2;
            ctx.globalAlpha = intensity * 0.5;
            ctx.shadowColor = this._palette.primary;
            ctx.shadowBlur = 8 + intensity * 12;
            ctx.stroke();
        }
        ctx.restore();
    }
}
