/**
 * PracticeSession.js
 *
 * Manages the timed multi-chord practice session:
 *   Em → C → G → D
 *
 * Emits events via callback props:
 *   onTick(remaining, elapsed)          — every second
 *   onChordChange(chord, index)         — when target chord advances
 *   onCorrect(chord, nextChord, index)  — chord matched successfully
 *   onComplete(stats)                   — session finished (includes per-chord analytics)
 */

export const DEFAULT_CHORD_SEQUENCE = ['Em', 'C', 'G', 'D'];

export class PracticeSession {
    /**
     * @param {object} opts
     * @param {number}   opts.duration         — total session seconds (default 30)
     * @param {string[]} opts.chordSequence     — ordered list of chord names
     * @param {number}   opts.minHoldMs         — ms chord must be continuously heard (default 400)
     */
    constructor({ duration = 30, chordSequence = DEFAULT_CHORD_SEQUENCE, minHoldMs = 400 } = {}) {
        this.duration = duration;
        this.chordSequence = chordSequence;
        this.minHoldMs = minHoldMs;

        // ── Event hooks ────────────────────────────────────────────────────────
        /** @type {function(number, number): void} */
        this.onTick = null;
        /** @type {function(string, number): void} */
        this.onChordChange = null;
        /** @type {function(string, string|null, number): void} */
        this.onCorrect = null;
        /** @type {function({chordsCompleted, total, elapsed, chordStats, totalDetections, correctDetections}): void} */
        this.onComplete = null;

        // ── Internal state ─────────────────────────────────────────────────────
        this._active = false;
        this._startTime = null;
        this._timerId = null;
        this._currentIndex = 0;
        this._chordsCompleted = 0;
        this._holdStart = null;   // when current match streak began
        this._lastChord = null;   // last confirmed chord from detector

        // ── Per-chord analytics ────────────────────────────────────────────────
        this._chordStats = {};
        this._chordStartTime = null;   // when the current target chord was shown
        this._totalDetections = 0;
        this._correctDetections = 0;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    get isActive() { return this._active; }
    get currentChord() { return this.chordSequence[this._currentIndex] ?? null; }
    get currentIndex() { return this._currentIndex; }
    get chordsCompleted() { return this._chordsCompleted; }
    get elapsed() { return this._startTime ? (Date.now() - this._startTime) / 1000 : 0; }
    get remaining() { return Math.max(0, this.duration - this.elapsed); }

    /** Start the session timer. */
    start() {
        if (this._active) return;
        this._active = true;
        this._startTime = Date.now();
        this._currentIndex = 0;
        this._chordsCompleted = 0;
        this._holdStart = null;
        this._lastChord = null;
        this._totalDetections = 0;
        this._correctDetections = 0;

        // Initialize per-chord stats
        this._chordStats = {};
        for (const chord of this.chordSequence) {
            this._chordStats[chord] = {
                attempts: 0,
                correctDetections: 0,
                firstCorrectMs: null,
                wrongChordHeard: {},
                completed: false,
            };
        }

        this._chordStartTime = Date.now();

        // Emit initial chord
        if (this.onChordChange) this.onChordChange(this.currentChord, 0);

        // Tick every second
        this._timerId = setInterval(() => this._tick(), 1000);
    }

    /** Stop the session early. */
    stop() {
        if (!this._active) return;
        this._finalise();
    }

    /**
     * Feed an audio detection result into the session.
     * Called by the AudioChordDetector callback in main.js.
     *
     * @param {{ status: string, chord: string|null, rawChord: string|null }} result
     */
    onDetection(result) {
        if (!this._active) return;

        const { status, chord, rawChord } = result;
        const target = this.currentChord;
        if (!target) return;

        const stats = this._chordStats[target];

        if (status === 'silent' || !chord) {
            this._holdStart = null;
            this._lastChord = null;
            return;
        }

        // Track detection analytics
        this._totalDetections++;
        if (stats) stats.attempts++;

        if (chord.toLowerCase() === target.toLowerCase()) {
            // Correct chord
            this._correctDetections++;
            if (stats) {
                stats.correctDetections++;
                // Record time-to-first-correct
                if (stats.firstCorrectMs === null && this._chordStartTime) {
                    stats.firstCorrectMs = Date.now() - this._chordStartTime;
                }
            }

            // Start or continue hold timer
            if (this._lastChord?.toLowerCase() !== chord.toLowerCase()) {
                this._holdStart = Date.now();
                this._lastChord = chord;
            }

            const heldMs = Date.now() - (this._holdStart ?? Date.now());
            if (heldMs >= this.minHoldMs) {
                this._advanceChord();
            }
        } else {
            // Wrong chord — track which chord was misheard
            if (stats && rawChord) {
                const key = rawChord;
                stats.wrongChordHeard[key] = (stats.wrongChordHeard[key] || 0) + 1;
            }
            this._holdStart = null;
            this._lastChord = chord;
        }
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    _tick() {
        if (!this._active) return;
        if (this.onTick) this.onTick(this.remaining, this.elapsed);
        if (this.remaining <= 0) this._finalise();
    }

    _advanceChord() {
        const completedChord = this.currentChord;

        // Mark this chord as completed in stats
        if (this._chordStats[completedChord]) {
            this._chordStats[completedChord].completed = true;
        }

        this._chordsCompleted++;
        this._currentIndex++;
        this._holdStart = null;
        this._lastChord = null;

        const nextChord = this.currentChord; // may be null if sequence exhausted

        if (this.onCorrect) this.onCorrect(completedChord, nextChord, this._currentIndex - 1);

        if (!nextChord) {
            // All chords done — end session
            this._finalise();
            return;
        }

        // Reset timer for next chord
        this._chordStartTime = Date.now();

        if (this.onChordChange) this.onChordChange(nextChord, this._currentIndex);
    }

    _finalise() {
        if (!this._active) return;
        this._active = false;
        clearInterval(this._timerId);
        this._timerId = null;

        if (this.onComplete) {
            this.onComplete({
                chordsCompleted: this._chordsCompleted,
                total: this.chordSequence.length,
                elapsed: this.elapsed,
                chordStats: this._chordStats,
                totalDetections: this._totalDetections,
                correctDetections: this._correctDetections,
            });
        }
    }
}

