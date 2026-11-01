/**
 * FretboardMapper.js
 * Manages the Region of Interest (ROI) for the guitar neck on screen,
 * and maps pixel (x, y) coordinates → {string, fret} indices.
 *
 * v2: Added soft ROI boundaries and per-finger temporal smoothing.
 *
 * Mirrors the Python guitar_mapper.py logic adapted for the web canvas.
 */

const STORAGE_KEY = 'guitarCoach_roi';

/** Number of frames to keep per-finger for median smoothing */
const SMOOTH_HISTORY_LEN = 3;

export class FretboardMapper {
    /**
     * ROI is defined in *canvas* pixel space (relative to video element).
     * @type {{ x: number, y: number, width: number, height: number }}
     */
    roi = null;

    /** Number of visible frets in the ROI */
    numFrets = 5;

    /** Whether the user is holding the guitar left-handed (neck pointing right) */
    isLeftHanded = false;

    /** Soft boundary margin as a fraction of ROI dimensions (0.10 = 10%) */
    _softMarginFrac = 0.10;

    /**
     * Per-finger position history for median smoothing.
     * Array of 5 entries (one per fingertip), each is an array of recent
     * {string, fret} values (or null).
     */
    _fingerHistory = [[], [], [], [], []];

    constructor() {
        this._loadFromStorage();
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    _loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                this.roi = data.roi;
                this.numFrets = data.numFrets ?? 5;
                this.isLeftHanded = data.isLeftHanded ?? false;
            }
        } catch {
            this.roi = null;
        }
    }

    saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            roi: this.roi,
            numFrets: this.numFrets,
            isLeftHanded: this.isLeftHanded,
        }));
    }

    clearStorage() {
        localStorage.removeItem(STORAGE_KEY);
        this.roi = null;
    }

    /** Clear per-finger smoothing history (call on chord change, calibration, etc.) */
    clearHistory() {
        this._fingerHistory = [[], [], [], [], []];
    }

    // ── ROI Helpers ──────────────────────────────────────────────────────────

    hasROI() {
        return this.roi !== null;
    }

    /**
     * Set the ROI from the calibration box dimensions.
     * All values are in canvas pixels (0..canvasWidth, 0..canvasHeight).
     */
    setROI({ x, y, width, height }) {
        this.roi = { x, y, width, height };
    }

    /**
     * Returns a default ROI given canvas dimensions (first-time / un-calibrated).
     */
    getDefaultROI(canvasW, canvasH) {
        return {
            x: canvasW * 0.1,
            y: canvasH * 0.15,
            width: canvasW * 0.8,
            height: canvasH * 0.55,
        };
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    /**
     * Check if a canvas point is inside the ROI (with optional soft margin).
     * @param {number} px
     * @param {number} py
     * @param {boolean} [useSoftMargin=false] if true, expand ROI by soft margin fraction
     */
    isInROI(px, py, useSoftMargin = false) {
        if (!this.roi) return false;
        const { x, y, width, height } = this.roi;

        if (!useSoftMargin) {
            return px >= x && px <= x + width && py >= y && py <= y + height;
        }

        // Soft margin: extend ROI by _softMarginFrac in each direction
        const mx = width * this._softMarginFrac;
        const my = height * this._softMarginFrac;
        return px >= (x - mx) && px <= (x + width + mx) &&
               py >= (y - my) && py <= (y + height + my);
    }

    /**
     * Map a canvas-space point to {string, fret}.
     * Uses soft boundaries — fingers just outside the ROI still get mapped.
     *
     * String 1 = high-e (top of fretboard in typical neck-up view),
     * Fret 1 = first fret (nearest headstock).
     *
     * @param {number} px - x in canvas pixels
     * @param {number} py - y in canvas pixels
     * @returns {{ string: number, fret: number }|null}
     */
    mapToFretboard(px, py) {
        if (!this.roi) return null;
        // Use soft boundary for acceptance
        if (!this.isInROI(px, py, true)) return null;

        const { x, y, width, height } = this.roi;

        const stringHeight = height / 6;
        const fretWidth = width / this.numFrets;

        // Clamp px/py to within ROI for mapping (even if soft-boundary admitted it)
        const clampedPx = Math.max(x, Math.min(x + width, px));
        const clampedPy = Math.max(y, Math.min(y + height, py));

        // string 6 at top → index 6..1 (6=low E, 1=high e)
        const mappedYIndex = Math.floor((clampedPy - y) / stringHeight);
        const stringIndex = Math.max(1, 6 - Math.min(5, mappedYIndex));

        // For right-handed players, headstock is on the LEFT of the screen (because of scaleX(-1)).
        // So fret 1 is at large canvas x (right side of ROI).
        // For left-handed players, headstock is on the RIGHT of the screen.
        // So fret 1 is at small canvas x (left side of ROI).
        const rawFretIdx = Math.floor((clampedPx - x) / fretWidth);

        // If left-handed, fret 1 is rawFretIdx 0 + 1 => 1. Body is at numFrets.
        // If right-handed, fret 1 is numFrets - rawFretIdx.
        const fretIndex = this.isLeftHanded
            ? Math.max(1, Math.min(this.numFrets, rawFretIdx + 1))
            : Math.max(1, this.numFrets - Math.min(this.numFrets - 1, rawFretIdx));

        return { string: stringIndex, fret: fretIndex };
    }

    /**
     * Map a fingertip to {string, fret} with per-finger temporal smoothing.
     * Call this instead of mapToFretboard() for tracked fingers.
     *
     * @param {number} fingerIdx - finger index 0-4 (thumb..pinky)
     * @param {number} px - x in canvas pixels
     * @param {number} py - y in canvas pixels
     * @returns {{ string: number, fret: number }|null}
     */
    mapFingerSmoothed(fingerIdx, px, py) {
        const raw = this.mapToFretboard(px, py);
        const hist = this._fingerHistory[fingerIdx];

        if (!raw) {
            hist.push(null);
            if (hist.length > SMOOTH_HISTORY_LEN) hist.shift();
            // If all recent frames are null, return null
            const valid = hist.filter(v => v !== null);
            return valid.length > 0 ? this._median(valid) : null;
        }

        hist.push({ string: raw.string, fret: raw.fret });
        if (hist.length > SMOOTH_HISTORY_LEN) hist.shift();

        // Return median of recent valid entries
        const valid = hist.filter(v => v !== null);
        if (valid.length === 0) return null;
        return this._median(valid);
    }

    /** Compute the median string and fret from an array of {string, fret} entries */
    _median(entries) {
        if (entries.length === 0) return null;
        if (entries.length === 1) return { ...entries[0] };

        const strings = entries.map(e => e.string).sort((a, b) => a - b);
        const frets   = entries.map(e => e.fret).sort((a, b) => a - b);
        const mid = Math.floor(entries.length / 2);

        return {
            string: strings[mid],
            fret:   frets[mid],
        };
    }

    /**
     * Get the pixel center of a given {string, fret} position inside the ROI.
     * Useful for drawing target dots.
     */
    getFretboardPixel(stringNum, fretNum) {
        if (!this.roi) return null;
        const { x, y, width, height } = this.roi;

        const stringHeight = height / 6;
        const fretWidth = width / this.numFrets;

        // fret 1 (headstock) is at the RIGHT edge of the ROI canvas region for right-handed.
        // For left-handed, fret 1 is at the LEFT edge of the ROI.
        let cx;
        if (this.isLeftHanded) {
            cx = x + (fretNum - 1) * fretWidth + fretWidth / 2;
        } else {
            cx = x + (this.numFrets - fretNum) * fretWidth + fretWidth / 2;
        }

        // Invert Y calculation: if stringNum = 6, it should be at the top (index 0)
        // If stringNum = 1, it should be at the bottom (index 5)
        const stringYIndex = 6 - stringNum;
        const cy = y + stringYIndex * stringHeight + stringHeight / 2;

        return { cx, cy };
    }

    // ── Grid lines ───────────────────────────────────────────────────────────

    /**
     * Returns arrays of line segments for the fretboard grid.
     */
    getGridLines() {
        if (!this.roi) return { strings: [], frets: [] };
        const { x, y, width, height } = this.roi;

        const strings = [];
        for (let i = 1; i < 6; i++) {
            const ly = y + i * (height / 6);
            strings.push({ x1: x, y1: ly, x2: x + width, y2: ly });
        }

        const frets = [];
        for (let i = 1; i < this.numFrets; i++) {
            const lx = x + i * (width / this.numFrets);
            frets.push({ x1: lx, y1: y, x2: lx, y2: y + height });
        }

        return { strings, frets };
    }
}

