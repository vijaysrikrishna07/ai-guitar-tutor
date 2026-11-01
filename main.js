/**
 * main.js — AppController
 * Coordinates all modules:
 *   VideoSource → HandTrackingService → FretboardMapper → ChordModel → OverlayRenderer
 * Also manages UI state, calibration, chord selection, and score display.
 */

import { VideoSource } from './VideoSource.js';
import { HandTrackingService } from './HandTrackingService.js';
import { FretboardMapper } from './FretboardMapper.js';
import { FretboardDetector } from './FretboardDetector.js';
import { ChordModel } from './ChordModel.js';
import { OverlayRenderer } from './OverlayRenderer.js';
import { TunedChordDetector, CHORD_NOTES, CHORD_DISPLAY_NAMES } from './TunedChordDetector.js';
import { PracticeSession, DEFAULT_CHORD_SEQUENCE } from './PracticeSession.js';
import { ChatbotService } from './ChatbotService.js';
import { ParticleEngine } from './ParticleEngine.js';
import { ReportCard } from './ReportCard.js';
import { ThreeGuitarVisualizer } from './ThreeGuitarVisualizer.js';
import { ChordDiagramRenderer, CHORD_DEFINITIONS } from './ChordDiagramRenderer.js';
import { PracticeCelebration } from './PracticeCelebration.js';

// ── DOM Refs ────────────────────────────────────────────────────────────────

const video = document.getElementById('webcamVideo');
const canvas = document.getElementById('overlayCanvas');
const placeholder = document.getElementById('videoPlaceholder');
const calibBox = document.getElementById('calibrationBox');
const hintText = document.getElementById('hintText');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const scoreCircle = document.getElementById('scoreCircle');
const scoreNumber = document.getElementById('scoreNumber');
const scoreLabel = document.getElementById('scoreLabel');
const fingerStatus = document.getElementById('fingerStatus');
const chordChart = document.getElementById('chordChart');
const tipsList = document.getElementById('tipsList');

const btnStart = document.getElementById('btnStartCamera');
const btnStop = document.getElementById('btnStopCamera');
const btnCalibrate = document.getElementById('btnCalibrate');
const btnConfirm = document.getElementById('btnConfirmCalibration');
const btnCancel = document.getElementById('btnCancelCalibration');
const leftHandedToggle = document.getElementById('leftHandedToggle');
const chordSelect = document.getElementById('chordSelect');

// ── Practice Session DOM refs ───────────────────────────────────────────────
const btnStartMic = document.getElementById('btnStartMic');
const btnStopMic = document.getElementById('btnStopMic');
const audioResult = document.getElementById('audioResult');
const audioResultIcon = document.getElementById('audioResultIcon');
const audioResultText = document.getElementById('audioResultText');
const detectedNotes = document.getElementById('detectedNotes');
const audioMeter = document.getElementById('audioMeter');
const durationSelect = document.getElementById('durationSelect');
// Countdown ring
const cdFill = document.getElementById('cdFill');
const cdTime = document.getElementById('cdTime');
const cdIcon = document.getElementById('cdIcon');
// Target chord
const targetCard = document.getElementById('targetCard');
const targetChordName = document.getElementById('targetChordName');
const targetChordFull = document.getElementById('targetChordFull');
// Pipeline
const chordPipeline = document.getElementById('chordPipeline');
// Detection banner
const detectBanner = document.getElementById('detectBanner');
const detectIcon = document.getElementById('detectIcon');
const detectChordName = document.getElementById('detectChordName');
const detectChordDetail = document.getElementById('detectChordDetail');
const detectBar = document.getElementById('detectBar');
// Stats
const statChords = document.getElementById('statChords');
const statTime = document.getElementById('statTime');
const statElapsed = document.getElementById('statElapsed');
const statAccuracy = document.getElementById('statAccuracy');
// Session complete
const sessionComplete = document.getElementById('sessionComplete');
const completeDetail = document.getElementById('completeDetail');

// ── Free Play DOM refs ───────────────────────────────────────────────────────
const btnStartFreePlay = document.getElementById('btnStartFreePlay');
const btnStopFreePlay = document.getElementById('btnStopFreePlay');
const freePlayCard = document.getElementById('freePlayCard');
const freePlayLabel = document.getElementById('freePlayLabel');
const freePlayChordName = document.getElementById('freePlayChordName');
const freePlayChordFull = document.getElementById('freePlayChordFull');
const freePlayNotes = document.getElementById('freePlayNotes');

// ── Gemini Chatbot DOM refs ──────────────────────────────────────────────────
const chatbotWidget = document.getElementById('chatbotWidget');
const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
const chatbotCloseBtn = document.getElementById('chatbotCloseBtn');
const chatbotMessages = document.getElementById('chatbotMessages');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotSendBtn = document.getElementById('chatbotSendBtn');

// ── Module instances ─────────────────────────────────────────────────────────

const videoSource = new VideoSource(video);
const handTracker = new HandTrackingService();
const fretDetector = new FretboardDetector();
const fretMapper = new FretboardMapper();
const chordModel = new ChordModel();
const renderer = new OverlayRenderer(canvas);
const audioDetector = new TunedChordDetector(); // Switched to DSP math engine
const chatbotService = new ChatbotService();
const particleEngine = new ParticleEngine(canvas);
const practiceCelebration = new PracticeCelebration();
let practiceSession = null;
let threeVisualizer = null;

const practiceConfettiEl = document.getElementById('practiceConfettiCanvas');
const chordMatchBadgeEl = document.getElementById('chordMatchBadge');
if (practiceConfettiEl) {
    practiceCelebration.init(practiceConfettiEl, chordMatchBadgeEl);
}

// ── State ──────────────────────────────────────────────────────────────────

let isRunning = false;
let isCalibrating = false;
let rafId = null;
let modelLoading = false;
let lastHandLandmarks = null;   // updated every render frame
let isLeftHanded = false;

// ── Drift / auto-nudge state ──────────────────────────────────────────────
let _stableDetectFrames = 0;    // consecutive frames with high-confidence detection
let _driftFrames = 0;           // consecutive frames with sustained drift
const DRIFT_STABILITY_REQ = 10; // need this many stable frames before trusting drift
const DRIFT_NUDGE_AFTER = 30;   // auto-nudge ROI after this many consecutive drift frames
const DRIFT_THRESH_X = 0.35;    // fraction of ROI width
const DRIFT_THRESH_Y = 0.45;    // fraction of ROI height
const NUDGE_ALPHA = 0.04;       // how fast to auto-nudge the calibrated ROI

// ── Finger z-depth filtering ──────────────────────────────────────────────
const FINGER_Z_THRESHOLD = -0.02; // fingers pressing strings have z more negative than this

// ── Status helpers ─────────────────────────────────────────────────────────

function setStatus(text, type = 'idle') {
    statusText.textContent = text;
    statusDot.className = 'status-dot' + (type === 'active' ? ' active' : type === 'error' ? ' error' : '');
}

function setHint(text) {
    hintText.textContent = text;
}

// ── Score UI ────────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 42; // circle r=42

function updateScoreUI(result) {
    if (!result || result.total === 0) {
        scoreNumber.textContent = '—';
        const hasChord = chordSelect && chordSelect.value;
        if (!hasChord) {
            scoreLabel.textContent = 'No chord selected';
        } else if (!isRunning) {
            scoreLabel.textContent = 'Start camera to detect';
        } else {
            scoreLabel.textContent = 'Hold chord in ROI';
        }
        scoreCircle.style.strokeDashoffset = CIRCUMFERENCE;
        scoreCircle.style.stroke = 'var(--text-muted)';
        fingerStatus.innerHTML = '';
        return;
    }

    const pct = result.score / result.total;
    const offset = CIRCUMFERENCE * (1 - pct);
    const color = pct >= 0.8 ? 'var(--success)' : pct >= 0.5 ? 'var(--warning)' : 'var(--danger)';

    scoreCircle.style.strokeDashoffset = offset;
    scoreCircle.style.stroke = color;
    scoreNumber.textContent = `${Math.round(pct * 100)}%`;
    scoreLabel.textContent = `${result.score} / ${result.total} fingers correct`;

    // Finger badges
    fingerStatus.innerHTML = result.details.map((d, i) =>
        `<span class="finger-badge ${d.hit ? 'correct' : 'incorrect'}">
      ${['Thumb', 'Idx', 'Mid', 'Ring', 'Pink'][i] ?? `F${i + 1}`}
    </span>`
    ).join('');
}

// ── Chord Chart panel ───────────────────────────────────────────────────────

const STRING_LABELS = ['6', '5', '4', '3', '2', '1'];

const CHORD_TIPS = {
    'Em': [
        'Middle finger → A string, fret 2',
        'Ring finger → D string, fret 2',
        'All other strings ring open cleanly',
        'Arch fingers to avoid muting open strings'
    ],
    'C': [
        'Ring finger → A string, fret 3',
        'Middle finger → D string, fret 2',
        'Index finger → B string, fret 1',
        'Mute low E string with thumb edge'
    ],
    'G': [
        'Middle finger → Low E string, fret 3',
        'Index finger → A string, fret 2',
        'Ring / Pinky → High e string, fret 3',
        'Keep wrist dropped and relaxed'
    ],
    'D': [
        'Index finger → G string, fret 2',
        'Ring finger → B string, fret 3',
        'Middle finger → High e string, fret 2',
        'Strum only top 4 strings (mute E & A)'
    ],
    'Am': [
        'Middle finger → D string, fret 2',
        'Ring finger → G string, fret 2',
        'Index finger → B string, fret 1',
        'Leave high e and A strings ringing open'
    ],
    'E': [
        'Middle finger → A string, fret 2',
        'Ring finger → D string, fret 2',
        'Index finger → G string, fret 1',
        'All 6 strings are strummed with power'
    ],
    'A': [
        'Index finger → D string, fret 2',
        'Middle finger → G string, fret 2',
        'Ring finger → B string, fret 2',
        'Cluster 3 fingers closely behind fret 2'
    ],
    'F': [
        'Index finger → Barre fret 1 across all strings',
        'Ring finger → A string, fret 3',
        'Pinky finger → D string, fret 3',
        'Middle finger → G string, fret 2'
    ],
    'Dm': [
        'Index finger → High e string, fret 1',
        'Middle finger → G string, fret 2',
        'Ring finger → B string, fret 3',
        'Strum top 4 strings from D string down'
    ]
};

function renderChordChart(chordName) {
    const shape = chordModel.getChordShape(chordName);
    if (!shape) {
        chordChart.innerHTML = '<p class="hint-text">Select a chord to see its fingering chart.</p>';
        return;
    }

    const chordDef = ChordDiagramRenderer.getChord(chordName);
    const chordImgUrl = ChordDiagramRenderer.toDataURL(chordName, { width: 220, height: 260, showTitle: false });

    // Quick chord switcher thumbnail chips
    const allChords = ChordDiagramRenderer.getAllChords();
    const quickChips = allChords.map(c => `
      <button class="quick-chord-chip ${c.name.toLowerCase() === chordName.toLowerCase() ? 'active' : ''}" data-quick-chord="${c.name}" title="${c.fullName}">
        <span>${c.name}</span>
      </button>
    `).join('');

    const rows = STRING_LABELS.map((lbl, i) => {
        const fret = shape[i];
        const indicator = fret === -1 ? '✕' : fret === 0 ? 'O' : `${fret}`;
        const cls = fret === -1 ? 'muted' : fret === 0 ? 'open' : 'fret';
        return `<div class="chart-row">
      <span class="chart-string">${lbl}</span>
      <span class="chart-fret ${cls}">${indicator}</span>
    </div>`;
    }).join('');

    chordChart.innerHTML = `
    <!-- Visual Chord Diagram Image -->
    <div class="coach-chord-diagram-wrapper">
      <img src="${chordImgUrl}" alt="${chordName} Guitar Chord Diagram" class="chord-diagram-img" id="coachChordImg" title="Click to zoom ${chordName}" />
      <div class="coach-chord-actions">
        <button class="btn btn-secondary btn-sm" id="btnCoachStrum" title="Listen to chord">🔊 Strum</button>
        <button class="btn btn-secondary btn-sm" id="btnCoachEnlarge" title="Enlarge reference card">🔍 Zoom</button>
      </div>
    </div>

    <!-- Quick Reference Strip -->
    <div class="quick-chord-strip">
      <span class="quick-strip-label">Quick Switch Chord</span>
      <div class="quick-strip-scroller">
        ${quickChips}
      </div>
    </div>

    <div class="chord-name-label">${chordDef ? chordDef.fullName : chordName}</div>
    <div class="chart-grid">${rows}</div>
    <div class="chord-frets-label">Lo ← strings (E A D G B e) → Hi</div>
  `;

    // Hook up buttons inside chordChart
    document.getElementById('coachChordImg')?.addEventListener('click', () => openChordModal(chordName));
    document.getElementById('btnCoachEnlarge')?.addEventListener('click', () => openChordModal(chordName));
    document.getElementById('btnCoachStrum')?.addEventListener('click', () => ChordDiagramRenderer.playChordSound(chordName));

    // Hook up quick chips
    chordChart.querySelectorAll('.quick-chord-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const chosen = chip.dataset.quickChord;
            if (chordSelect) chordSelect.value = chosen;
            chordModel.setCurrentChord(chosen);
            renderChordChart(chosen);
        });
    });

    const badge = document.getElementById('chartChordBadge');
    if (badge) badge.textContent = chordName;

    if (tipsList && CHORD_TIPS[chordName]) {
        tipsList.innerHTML = CHORD_TIPS[chordName].map(t => `<li>${t}</li>`).join('');
    }

    if (threeVisualizer) {
        threeVisualizer.setChord(chordName.toLowerCase());
        const hudName = document.getElementById('hudChordName');
        const hudDesc = document.getElementById('hudChordDesc');
        if (hudName) hudName.textContent = chordName;
        if (hudDesc && CHORD_TIPS[chordName]) hudDesc.textContent = CHORD_TIPS[chordName][0];
    }

    // Also update mini diagram in 3D HUD
    const hudMini = document.getElementById('hudChordDiagramMini');
    if (hudMini) {
        const miniUrl = ChordDiagramRenderer.toDataURL(chordName, { width: 220, height: 225, showTitle: false });
        hudMini.innerHTML = `<img src="${miniUrl}" alt="${chordName} Diagram" class="chord-diagram-img" />`;
    }
}

// ── Calibration UI ──────────────────────────────────────────────────────────

function startCalibration() {
    isCalibrating = true;
    calibBox.classList.remove('hidden');
    btnCalibrate.classList.add('hidden');
    btnConfirm.classList.remove('hidden');
    btnCancel.classList.remove('hidden');
    setHint('📐 Drag to align the blue box with your guitar neck, then click Confirm.');
    makeDraggableResizable(calibBox);
}

function confirmCalibration() {
    const wrapper = document.getElementById('videoWrapper');
    const wRect = wrapper.getBoundingClientRect();
    const bRect = calibBox.getBoundingClientRect();

    // Convert to canvas-relative coordinates
    const scaleX = canvas.width / wRect.width;
    const scaleY = canvas.height / wRect.height;

    // Because video is mirrored (scaleX(-1)), flip the x coordinate
    const x = (wRect.width - (bRect.left - wRect.left) - bRect.width) * scaleX;
    const y = (bRect.top - wRect.top) * scaleY;

    fretMapper.setROI({
        x,
        y,
        width: bRect.width * scaleX,
        height: bRect.height * scaleY,
    });
    fretMapper.saveToStorage();
    fretMapper.clearHistory();
    fretDetector.reset();
    _stableDetectFrames = 0;
    _driftFrames = 0;

    endCalibration();
    setHint('✅ Calibration saved! Now select a chord and start playing.');
}

function endCalibration() {
    isCalibrating = false;
    calibBox.classList.add('hidden');
    btnCalibrate.classList.remove('hidden');
    btnConfirm.classList.add('hidden');
    btnCancel.classList.add('hidden');
}

// ── Drag + Resize calibration box ──────────────────────────────────────────

function makeDraggableResizable(el) {
    const corners = el.querySelectorAll('.calib-corner');
    let action = null, startX, startY, startRect;

    const getRect = () => ({
        left: parseInt(el.style.left || el.offsetLeft),
        top: parseInt(el.style.top || el.offsetTop),
        width: el.offsetWidth,
        height: el.offsetHeight,
    });

    const onMove = (e) => {
        if (!action) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const { left, top, width, height } = startRect;

        if (action === 'drag') {
            el.style.left = (left + dx) + 'px';
            el.style.top = (top + dy) + 'px';
        } else if (action === 'br') {
            el.style.width = Math.max(60, width + dx) + 'px';
            el.style.height = Math.max(40, height + dy) + 'px';
        } else if (action === 'bl') {
            el.style.left = (left + dx) + 'px';
            el.style.width = Math.max(60, width - dx) + 'px';
            el.style.height = Math.max(40, height + dy) + 'px';
        } else if (action === 'tr') {
            el.style.top = (top + dy) + 'px';
            el.style.width = Math.max(60, width + dx) + 'px';
            el.style.height = Math.max(40, height - dy) + 'px';
        } else if (action === 'tl') {
            el.style.left = (left + dx) + 'px';
            el.style.top = (top + dy) + 'px';
            el.style.width = Math.max(60, width - dx) + 'px';
            el.style.height = Math.max(40, height - dy) + 'px';
        }
    };

    const onUp = () => { action = null; };

    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('calib-corner')) return;
        e.preventDefault();
        action = 'drag'; startX = e.clientX; startY = e.clientY;
        startRect = getRect();
    });

    corners.forEach(c => {
        const type = [...c.classList].find(cl => ['tl', 'tr', 'bl', 'br'].includes(cl));
        c.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            action = type; startX = e.clientX; startY = e.clientY;
            startRect = getRect();
        });
    });

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// ── Main render loop ─────────────────────────────────────────────────────────

async function renderLoop() {
    if (!isRunning) return;

    renderer.syncSize(video);
    renderer.clear();

    const cw = canvas.width;
    const ch = canvas.height;

    // Use saved ROI or set a default
    if (!fretMapper.hasROI()) {
        fretMapper.setROI(fretMapper.getDefaultROI(cw, ch));
    }

    const roi = fretMapper.roi;
    let isOutOfBounds = false;
    let outOfBoundsDirection = null;

    // Run hand detection first so FretboardDetector can use landmarks
    const landmarks = handTracker.detectForVideo(video, performance.now());
    let compareResult = null;
    let hand = null;

    if (landmarks && landmarks.length > 0) {
        hand = landmarks[0];
        lastHandLandmarks = hand;
    }

    // ── Fretboard Drift Detection (stability-gated + auto-nudge) ──────────
    if (!isCalibrating && fretMapper.hasROI() && (window.frameCounter || 0) % 3 === 0) {
        const liveBounds = fretDetector.detect(video, cw, ch, hand ? [hand] : null);
        const detConfidence = fretDetector.confidence;

        if (liveBounds && detConfidence > 0.3) {
            _stableDetectFrames++;
        } else {
            _stableDetectFrames = Math.max(0, _stableDetectFrames - 2);
        }

        // Only evaluate drift after detector has been stable for DRIFT_STABILITY_REQ frames
        if (liveBounds && _stableDetectFrames >= DRIFT_STABILITY_REQ) {
            const calCX = roi.x + roi.width / 2;
            const calCY = roi.y + roi.height / 2;
            const liveCX = liveBounds.x + liveBounds.width / 2;
            const liveCY = liveBounds.y + liveBounds.height / 2;

            const driftX = calCX - liveCX;
            const driftY = calCY - liveCY;

            if (Math.abs(driftX) > roi.width * DRIFT_THRESH_X ||
                Math.abs(driftY) > roi.height * DRIFT_THRESH_Y) {
                _driftFrames++;

                // Auto-nudge: gently shift ROI toward detected position
                if (_driftFrames >= DRIFT_NUDGE_AFTER) {
                    roi.x += NUDGE_ALPHA * (liveBounds.x - roi.x);
                    roi.y += NUDGE_ALPHA * (liveBounds.y - roi.y);
                    roi.width += NUDGE_ALPHA * (liveBounds.width - roi.width);
                    roi.height += NUDGE_ALPHA * (liveBounds.height - roi.height);
                    fretMapper.setROI(roi);
                } else {
                    // Show warning only after stability confirmed but before nudge kicks in
                    isOutOfBounds = true;
                    if (Math.abs(driftX) > Math.abs(driftY)) {
                        outOfBoundsDirection = driftX > 0 ? 'Move Guitar Left ⬅️' : 'Move Guitar Right ➡️';
                    } else {
                        outOfBoundsDirection = driftY > 0 ? 'Move Guitar Up ⬆️' : 'Move Guitar Down ⬇️';
                    }
                }
            } else {
                _driftFrames = Math.max(0, _driftFrames - 1);
            }
        }
    }
    window.frameCounter = (window.frameCounter || 0) + 1;

    // UI Update Warning
    const warningEl = document.getElementById('positionWarningOverlay');
    const warningText = document.getElementById('positionWarningText');
    if (warningEl && warningText) {
        if (isOutOfBounds) {
            warningText.textContent = outOfBoundsDirection;
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    }

    const grid = fretMapper.getGridLines();
    renderer.drawFretboardGrid(roi, grid, isOutOfBounds);
    
    // Update particle engine ROI and grid
    particleEngine.setROI(roi);
    particleEngine.setGridLines(grid);

    // Draw confidence indicator bar
    renderer.drawConfidenceBar(fretDetector.confidence, roi);

    // Draw target chord dots with labels (Only if NOT out of bounds)
    const shape = chordModel.getCurrentChordShape();
    const STRING_NAMES_MAP = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    // Build target positions for both dot rendering and guide lines
    const targetPositions = [];
    const targetLabels = [];
    const targetMeta = []; // {stringNum, fret} for each target
    if (shape && !isOutOfBounds) {
        for (let s = 0; s < 6; s++) {
            const fret = shape[s];
            if (fret > 0) {
                const stringNum = 6 - s;
                const pos = fretMapper.getFretboardPixel(stringNum, fret);
                if (pos) {
                    targetPositions.push(pos);
                    targetLabels.push(`${STRING_NAMES_MAP[s]} F${fret}`);
                    targetMeta.push({ string: stringNum, fret });
                }
            }
        }
        renderer.drawTargetDots(targetPositions);

        // Draw labels on target dots
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(-1, 1); // counter CSS mirror
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = 'rgba(45, 212, 160, 0.95)';
        ctx.textAlign = 'center';
        for (let i = 0; i < targetPositions.length; i++) {
            const pos = targetPositions[i];
            ctx.fillText(targetLabels[i], -pos.cx, pos.cy + 22);
        }
        ctx.restore();
    }

    if (hand && !isOutOfBounds) {
        // Draw skeleton
        renderer.drawHandSkeleton(hand, cw, ch);

        // Get fingertips
        const tips = handTracker.getFingertips(hand);
        const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

        // Map to fretboard coords with z-depth filtering + temporal smoothing
        const mappedFingers = tips.map((tip, i) => {
            const px = tip.x * cw;
            const py = tip.y * ch;

            // Z-depth gate: ignore fingers that are clearly hovering above the fretboard
            // (z is negative when closer to camera; pressing strings = more negative z)
            if (tip.z > FINGER_Z_THRESHOLD && i > 0) {
                // Thumb (i=0) is exempt — it usually wraps around the neck
                return fretMapper.mapFingerSmoothed(i, px, py); // still smooth but raw z not blocking
            }

            // Use temporally-smoothed mapping
            return fretMapper.mapFingerSmoothed(i, px, py);
        });

        // Debug: log mapped finger positions (throttled to once per second)
        if (!window._lastDebugLog || performance.now() - window._lastDebugLog > 1000) {
            window._lastDebugLog = performance.now();
            const debugInfo = mappedFingers.map((m, i) =>
                m ? `${FINGER_NAMES[i]}: S${m.string} F${m.fret}` : `${FINGER_NAMES[i]}: outside ROI`
            );
            console.log('[Debug]', debugInfo.join(' | '));
        }

        // Compare to chord
        if (shape) {
            compareResult = chordModel.compareFingers(mappedFingers);
            renderer.drawScoreOverlay(compareResult, roi);
            // Show first actionable hint from the dataset
            if (compareResult && compareResult.hints && compareResult.hints.length > 0) {
                setHint('💡 ' + compareResult.hints[0]);
            } else if (compareResult && compareResult.total > 0 && compareResult.score === compareResult.total) {
                setHint('✅ Perfect! All fingers in position!');
            }
        }

        // Draw fingertip dots with debug labels
        const ctx = canvas.getContext('2d');
        const guideLines = []; // for near-miss guide arrows

        const tipDots = tips.map((tip, i) => {
            const px = tip.x * cw;
            const py = tip.y * ch;
            const inROI = fretMapper.isInROI(px, py, true); // use soft boundary
            const mapped = mappedFingers[i];
            const correct = compareResult && compareResult.details.some(d =>
                mapped && Math.abs(d.target.string - mapped.string) <= 1 &&
                Math.abs(d.target.fret - mapped.fret) <= 1 && d.hit
            );

            // Build guide lines: for fingers in/near ROI that are NOT correct,
            // find the closest unmatched target and draw a guide toward it
            if (inROI && mapped && !correct && targetPositions.length > 0) {
                let closestDist = Infinity;
                let closestTarget = null;
                for (let t = 0; t < targetMeta.length; t++) {
                    const tm = targetMeta[t];
                    const dist = Math.abs(tm.string - mapped.string) + Math.abs(tm.fret - mapped.fret);
                    if (dist <= 3 && dist < closestDist) { // only guide if within 3 string+fret units
                        closestDist = dist;
                        closestTarget = targetPositions[t];
                    }
                }
                if (closestTarget) {
                    guideLines.push({
                        fingerCx: px, fingerCy: py,
                        targetCx: closestTarget.cx, targetCy: closestTarget.cy,
                    });
                }
            }

            // Draw debug label showing string/fret next to each fingertip
            if (mapped) {
                ctx.save();
                ctx.scale(-1, 1); // counter the CSS mirror
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.fillStyle = correct ? '#2dd4a0' : '#fbbf24';
                ctx.fillText(`${FINGER_NAMES[i]}: S${mapped.string} F${mapped.fret}`, -(px + 14), py - 8);
                ctx.restore();
            }

            return { cx: px, cy: py, inROI, correct };
        });

        renderer.drawFingertipDots(tipDots);
        renderer.drawGuideLines(guideLines);
    }

    updateScoreUI(compareResult);

    // Tick and draw particle system over everything else
    if (audioDetector.isRunning) {
        particleEngine.setAudioLevel(audioDetector.getVolume());
    } else {
        particleEngine.setAudioLevel(0);
    }
    particleEngine.update();

    rafId = requestAnimationFrame(renderLoop);
}

// ── Camera ───────────────────────────────────────────────────────────────────

async function startCamera() {
    btnStart.disabled = true;
    setStatus('Starting camera…');
    setHint('📷 Requesting camera access…');

    const ok = await videoSource.start();
    if (!ok) {
        setStatus('Camera error', 'error');
        setHint('❌ Camera access denied. Please allow camera permissions and try again.');
        btnStart.disabled = false;
        return;
    }

    placeholder.classList.add('hidden');
    btnStart.disabled = true;
    btnStop.disabled = false;
    btnCalibrate.disabled = false;
    isRunning = true;
    setStatus('Camera active', 'active');
    setHint('🔄 Loading hand-tracking AI model…');

    // Load model (only once)
    if (!handTracker.isReady && !modelLoading) {
        modelLoading = true;
        await handTracker.init();
        modelLoading = false;
    }

    setHint('✅ Ready! Use Manual ROI to align the box with your guitar neck, then play Em.');
    rafId = requestAnimationFrame(renderLoop);
}

function stopCamera() {
    isRunning = false;
    lastHandLandmarks = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    videoSource.stop();
    renderer.clear();
    placeholder.classList.remove('hidden');
    btnStart.disabled = false;
    btnStop.disabled = true;
    btnCalibrate.disabled = true;
    setStatus('Ready');
    setHint('📷 Click Start Camera to begin.');
    updateScoreUI(null);
}

// ── Multi-Chord Practice Session ─────────────────────────────────────────────

// Countdown ring circumference (r=58): 2π×58 ≈ 364.4
const CD_CIRCUMFERENCE = 364;

const meterBars = audioMeter ? Array.from(audioMeter.querySelectorAll('.meter-bar')) : [];
let meterRafId = null;

// Detection accuracy counters
let totalDetections = 0, correctDetections = 0;

// ── UI helpers ───────────────────────────────────────────────────────────────

function setAudioResult(state, icon, text) {
    audioResult.className = 'audio-result ' + state;
    audioResultIcon.textContent = icon;
    audioResultText.textContent = text;
}

function updateNoteChips(noteNames, targetChord) {
    const targetNotes = CHORD_NOTES[targetChord] ?? new Set();
    const unique = [...new Set(noteNames.filter(Boolean))];
    if (unique.length === 0) {
        detectedNotes.innerHTML = '<span class="note-chip muted">—</span>';
    } else {
        detectedNotes.innerHTML = unique.map(n => {
            const cls = targetNotes.has(n) ? 'em-note' : 'other-note';
            return `<span class="note-chip ${cls}">${n}</span>`;
        }).join('');
    }
}

/** Build / refresh the chord pipeline strip. */
function renderPipeline(sequence, doneIndex) {
    chordPipeline.innerHTML = sequence.map((chord, i) => {
        let state = 'pending';
        const sym = i < doneIndex ? '✓' : chord;
        if (i < doneIndex) state = 'done';
        else if (i === doneIndex) state = 'active';

        const arrow = i < sequence.length - 1
            ? '<span class="pip-arrow">›</span>'
            : '';

        return `
          <div class="chord-pip ${state}" role="listitem">
            <div class="pip-circle">${sym}</div>
            <span class="pip-label">${CHORD_DISPLAY_NAMES[chord] ?? chord}</span>
          </div>
          ${arrow}`;
    }).join('');
}

/** Update the countdown ring arc + timer text. */
function updateCountdownRing(remaining, total) {
    const fraction = total > 0 ? remaining / total : 1;
    const offset = CD_CIRCUMFERENCE * (1 - fraction);
    cdFill.style.strokeDashoffset = offset;

    // Colour changes as time runs low
    cdFill.classList.remove('warning', 'danger');
    if (fraction <= 0.25) cdFill.classList.add('danger');
    else if (fraction <= 0.5) cdFill.classList.add('warning');

    const secs = Math.round(remaining);
    cdTime.textContent = secs;
}

/** Update the live-detection banner. */
function updateDetectBanner(result, targetChord) {
    const { status, chord, rawChord, score } = result;

    if (status === 'silent' || !rawChord) {
        detectBanner.className = 'detect-banner idle';
        detectIcon.textContent = '🎤';
        detectChordName.textContent = 'Listening…';
        detectChordDetail.textContent = 'Play a chord';
        detectBar.style.width = '0%';
        return;
    }

    const pct = Math.round(Math.min(1, score) * 100);
    detectBar.style.width = pct + '%';
    detectChordDetail.textContent = `${pct}% match`;

    if (chord && targetChord && chord.toLowerCase() === targetChord.toLowerCase()) {
        detectBanner.className = 'detect-banner correct';
        detectIcon.textContent = '✅';
        detectChordName.textContent = `${CHORD_DISPLAY_NAMES[chord.toLowerCase()] ?? chord} — Correct!`;
    } else if (rawChord && targetChord && rawChord.toLowerCase() !== targetChord.toLowerCase()) {
        detectBanner.className = 'detect-banner wrong';
        detectIcon.textContent = '❌';
        detectChordName.textContent = `Hearing: ${CHORD_DISPLAY_NAMES[rawChord.toLowerCase()] ?? rawChord}`;
    } else {
        detectBanner.className = 'detect-banner hearing';
        detectIcon.textContent = '👂';
        detectChordName.textContent = `Hearing: ${rawChord ? (CHORD_DISPLAY_NAMES[rawChord.toLowerCase()] ?? rawChord) : '…'}`;
    }
}

/** Update the session stat cards. */
function updateStats(remaining, elapsed, chordsCompleted, total) {
    const rem = Math.round(remaining);
    const rm = Math.floor(rem / 60), rs = rem % 60;
    statTime.textContent = `${rm}:${rs.toString().padStart(2, '0')}`;

    const el = Math.round(elapsed);
    const em2 = Math.floor(el / 60), es = el % 60;
    statElapsed.textContent = `${em2}:${es.toString().padStart(2, '0')}`;

    statChords.textContent = `${chordsCompleted} / ${total}`;
    statAccuracy.textContent = totalDetections > 0
        ? Math.round((correctDetections / totalDetections) * 100) + '%'
        : '—';
}

/** Reset all practice UI to idle state. */
function resetPracticeUI() {
    targetChordName.textContent = '—';
    targetChordFull.textContent = 'Start the session';
    targetCard.className = 'target-card';

    cdTime.textContent = '--';
    cdIcon.textContent = '🎸';
    cdFill.style.strokeDashoffset = '0';
    cdFill.classList.remove('warning', 'danger');

    renderPipeline(DEFAULT_CHORD_SEQUENCE, 0);
    // reset pipeline to all-pending
    chordPipeline.querySelectorAll('.chord-pip').forEach((el, i) => {
        el.className = 'chord-pip pending';
        el.querySelector('.pip-circle').textContent = DEFAULT_CHORD_SEQUENCE[i];
    });

    detectBanner.className = 'detect-banner idle';
    detectIcon.textContent = '🎤';
    detectChordName.textContent = 'Listening…';
    detectChordDetail.textContent = '';
    detectBar.style.width = '0%';

    statChords.textContent = `0 / ${DEFAULT_CHORD_SEQUENCE.length}`;
    statTime.textContent = '--:--';
    statElapsed.textContent = '0:00';
    statAccuracy.textContent = '—';

    detectedNotes.innerHTML = '<span class="note-chip muted">—</span>';
    sessionComplete.classList.add('hidden');
    totalDetections = 0; correctDetections = 0;

    const targetMini = document.getElementById('targetChordDiagramMini');
    if (targetMini) {
        const firstChord = DEFAULT_CHORD_SEQUENCE[0] || 'Em';
        const miniUrl = ChordDiagramRenderer.toDataURL(firstChord, { width: 220, height: 225, showTitle: false });
        targetMini.innerHTML = `<img src="${miniUrl}" alt="${firstChord} Preview Diagram" class="chord-diagram-img" style="opacity: 0.65;" />`;
    }
}

// ── Free Play Mode ─────────────────────────────────────────────────────────────

let isFreePlayActive = false;

async function startFreePlay() {
    btnStartFreePlay.disabled = true;
    btnStartMic.disabled = true; // disable practice session

    freePlayChordName.textContent = '...';
    freePlayChordFull.textContent = 'Listening...';
    freePlayCard.className = 'target-card';

    const ok = await audioDetector.start(onFreePlayDetection);
    if (!ok) {
        freePlayChordName.textContent = 'Error';
        freePlayChordFull.textContent = 'Microphone access denied';
        btnStartFreePlay.disabled = false;
        btnStartMic.disabled = false;
        return;
    }

    isFreePlayActive = true;
    btnStartFreePlay.disabled = true;
    btnStopFreePlay.disabled = false;
}

function stopFreePlay() {
    audioDetector.stop();
    isFreePlayActive = false;

    btnStartFreePlay.disabled = false;
    btnStopFreePlay.disabled = true;
    btnStartMic.disabled = false; // re-enable practice session

    freePlayChordName.textContent = '—';
    freePlayChordFull.textContent = 'Waiting for audio...';
    freePlayCard.className = 'target-card';
    freePlayNotes.innerHTML = '<span class="note-chip muted">—</span>';
}

function onFreePlayDetection(result) {
    const { status, chord, rawChord, noteNames } = result;

    // Update notes
    const unique = [...new Set(noteNames.filter(Boolean))];
    if (unique.length === 0) {
        freePlayNotes.innerHTML = '<span class="note-chip muted">—</span>';
    } else {
        freePlayNotes.innerHTML = unique.map(n => {
            return `<span class="note-chip other-note">${n}</span>`;
        }).join('');
    }

    // Update chord display
    if (status === 'silent' || !rawChord) {
        freePlayChordName.textContent = '—';
        freePlayChordFull.textContent = 'Waiting for audio...';
        freePlayCard.className = 'target-card';
        particleEngine.setChord(null);
    } else {
        // If it's a confirmed chord, show it clearly
        if (chord) {
            freePlayChordName.textContent = chord;
            freePlayChordFull.textContent = CHORD_DISPLAY_NAMES[chord] || chord;
            freePlayCard.className = 'target-card correct';
            
            // Only trigger burst once per new chord confirmation
            if (freePlayCard.dataset.lastChord !== chord) {
                particleEngine.setChord(chord);
                particleEngine.triggerBurst(1.0);
                particleEngine.triggerGlow();
                freePlayCard.dataset.lastChord = chord;
                if (threeVisualizer) {
                    threeVisualizer.setChord(chord.toLowerCase());
                    threeVisualizer.strum('down');
                }
            }
        } else {
            // Unconfirmed but heard
            freePlayChordName.textContent = rawChord;
            freePlayChordFull.textContent = 'Detecting...';
            freePlayCard.className = 'target-card';
            particleEngine.setChord(rawChord);
            freePlayCard.dataset.lastChord = '';
        }
    }
}

// ── PracticeSession event handlers ───────────────────────────────────────────

function onSessionTick(remaining, elapsed) {
    if (!practiceSession) return;
    const total = practiceSession.duration;
    updateCountdownRing(remaining, total);
    updateStats(remaining, elapsed, practiceSession.chordsCompleted, practiceSession.chordSequence.length);
}

function onChordChange(chord, index) {
    targetChordName.textContent = chord;
    targetChordFull.textContent = CHORD_DISPLAY_NAMES[chord.toLowerCase()] ?? chord;
    targetCard.className = 'target-card';
    cdIcon.textContent = '🎵';
    renderPipeline(DEFAULT_CHORD_SEQUENCE, index);
    setAudioResult('silent', '🎤', `Play: ${CHORD_DISPLAY_NAMES[chord.toLowerCase()] ?? chord}`);
    particleEngine.setChord(chord);
    if (threeVisualizer) threeVisualizer.setChord(chord.toLowerCase());

    const targetMini = document.getElementById('targetChordDiagramMini');
    if (targetMini) {
        const miniUrl = ChordDiagramRenderer.toDataURL(chord, { width: 220, height: 225, showTitle: false });
        targetMini.innerHTML = `<img src="${miniUrl}" alt="${chord} Target Diagram" class="chord-diagram-img" />`;
    }
}

function onCorrect(chord, nextChord, index) {
    correctDetections++;

    // Flash colorful celebration aura on target card
    targetCard.classList.remove('correct');
    void targetCard.offsetWidth; // force reflow for reliable re-trigger
    targetCard.classList.add('correct');
    setTimeout(() => { targetCard.classList.remove('correct'); }, 950);

    // Trigger vibrant confetti ribbons, glowing stars, music notes, and floating badge
    practiceCelebration.trigger(chord);

    // Acoustic sound feedback
    ChordDiagramRenderer.playChordSound(chord);

    cdIcon.textContent = '✅';
    const msg = nextChord
        ? `${chord} ✅  →  Next: ${CHORD_DISPLAY_NAMES[nextChord.toLowerCase()] ?? nextChord}`
        : `${chord} ✅  All chords done!`;
    setAudioResult('correct', '⭐', msg);
    
    particleEngine.triggerBurst(1.0);
    particleEngine.triggerGlow();
    if (threeVisualizer) threeVisualizer.strum('down');
}

window.__triggerCelebration = (chord = 'Em') => onCorrect(chord, 'C', 0);

function onSessionComplete(stats) {
    cdFill.style.strokeDashoffset = CD_CIRCUMFERENCE;
    cdTime.textContent = '0';
    cdIcon.textContent = '🏆';
    targetChordName.textContent = '🏆';
    targetChordFull.textContent = 'Session complete!';

    const targetMini = document.getElementById('targetChordDiagramMini');
    if (targetMini) targetMini.innerHTML = '';

    completeDetail.textContent =
        `✅ ${stats.chordsCompleted} / ${stats.total} chords completed in ${Math.round(stats.elapsed)}s`;
    sessionComplete.classList.remove('hidden');
    setAudioResult('goal-done', '🏆', `Session complete! ${stats.chordsCompleted}/${stats.total} chords ✅`);

    stopMic(false /* already stopping from session */);
    
    // Show report card modal
    ReportCard.show(stats);
}

// ── Detection callback (fed from AudioChordDetector) ────────────────────────

function onAudioDetection(result) {
    totalDetections++;
    if (result.chord) correctDetections++;

    const target = practiceSession?.currentChord;
    updateNoteChips(result.noteNames, target);
    updateDetectBanner(result, target);

    // Forward to session state machine
    if (practiceSession?.isActive) {
        practiceSession.onDetection(result);
    }
}

// ── VU meter animation ───────────────────────────────────────────────────────

function animateMeter() {
    if (!audioDetector.isRunning) return;
    const vol = audioDetector.getVolume();
    meterBars.forEach((bar, i) => {
        const noise = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 200 + i * 0.8));
        const h = Math.max(4, vol * 44 * noise);
        bar.style.height = h + 'px';
        bar.classList.toggle('active', vol > 0.05);
    });
    meterRafId = requestAnimationFrame(animateMeter);
}

// ── Start / Stop session ─────────────────────────────────────────────────────

async function startMic() {
    btnStartMic.disabled = true;
    btnStartFreePlay.disabled = true; // disable free play if practice started
    setAudioResult('idle', '⏳', 'Requesting microphone access…');

    const ok = await audioDetector.start(onAudioDetection);
    if (!ok) {
        setAudioResult('wrong', '🚫', 'Microphone access denied — please allow mic permissions.');
        btnStartMic.disabled = false;
        return;
    }

    const duration = parseInt(durationSelect?.value ?? '30', 10);

    practiceSession = new PracticeSession({ duration, chordSequence: DEFAULT_CHORD_SEQUENCE, minHoldMs: 400 });
    practiceSession.onTick = onSessionTick;
    practiceSession.onChordChange = onChordChange;
    practiceSession.onCorrect = onCorrect;
    practiceSession.onComplete = onSessionComplete;

    resetPracticeUI();
    if (durationSelect) durationSelect.disabled = true;

    // Initialise countdown ring to full
    updateCountdownRing(duration, duration);
    cdTime.textContent = duration;

    practiceSession.start();

    btnStartMic.disabled = true;
    btnStopMic.disabled = false;
    animateMeter();
}

function stopMic(manual = true) {
    if (practiceSession?.isActive) practiceSession.stop();
    practiceSession = null;

    audioDetector.stop();
    if (meterRafId) { cancelAnimationFrame(meterRafId); meterRafId = null; }
    meterBars.forEach(bar => { bar.style.height = '4px'; bar.classList.remove('active'); });

    btnStartMic.disabled = false;
    btnStopMic.disabled = true;
    btnStartFreePlay.disabled = false; // re-enable free play
    if (durationSelect) durationSelect.disabled = false;

    if (manual) {
        setAudioResult('idle', '🎸', 'Session ended. Press Start Practice to try again.');
        cdIcon.textContent = '🎸';
        cdTime.textContent = '--';
    }
    detectedNotes.innerHTML = '<span class="note-chip muted">—</span>';
}

// ── Event listeners ──────────────────────────────────────────────────────────

btnStart.addEventListener('click', startCamera);
btnStop.addEventListener('click', stopCamera);

if (btnStartMic) btnStartMic.addEventListener('click', startMic);
if (btnStopMic) btnStopMic.addEventListener('click', stopMic);

if (btnStartFreePlay) btnStartFreePlay.addEventListener('click', startFreePlay);
if (btnStopFreePlay) btnStopFreePlay.addEventListener('click', stopFreePlay);

btnCalibrate.addEventListener('click', startCalibration);
btnConfirm.addEventListener('click', confirmCalibration);
btnCancel.addEventListener('click', () => { endCalibration(); setHint('Calibration cancelled.'); });

leftHandedToggle?.addEventListener('change', (e) => {
    isLeftHanded = e.target.checked;
    fretMapper.isLeftHanded = isLeftHanded;
    // Auto re-render if camera is off but we have landmarks, though usually renderer just picks it up next frame
});

chordSelect?.addEventListener('change', (e) => {
    const name = e.target.value;
    chordModel.setCurrentChord(name || null);
    if (name) {
        renderChordChart(name);
        const tip = CHORD_TIPS[name] ? CHORD_TIPS[name][0] : 'Place fingers on indicated frets';
        setHint(`🎯 ${name} — ${tip}`);
        if (threeVisualizer) threeVisualizer.setChord(name.toLowerCase());
    } else {
        chordChart.innerHTML = '<p class="hint-text">Select a chord to see its fingering chart.</p>';
        setHint('🎸 Select a chord to begin tracking.');
    }
    updateScoreUI(null);
});

// Resize canvas when window resizes
window.addEventListener('resize', () => {
    if (isRunning) renderer.syncSize(video);
});

// ── Gemini Chatbot Handlers ──────────────────────────────────────────────────

let isChatOpen = false;

function toggleChatbot() {
    isChatOpen = !isChatOpen;
    if (isChatOpen) {
        chatbotWidget.classList.add('open');
        chatbotToggleBtn.classList.add('hidden');
        chatbotInput.focus();

        // Initialize Gemini only when first opened to save resources
        if (!chatbotService.isReady) {
            const ok = chatbotService.init();
            if (!ok) {
                appendChatMessage("System", "Error initializing AI Coach. Have you set your VITE_GEMINI_API_KEY in .env.local?");
            }
        }
    } else {
        chatbotWidget.classList.remove('open');
        chatbotToggleBtn.classList.remove('hidden');
    }
}

function appendChatMessage(sender, text, isHTML = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender === 'User' ? 'user' : 'model'}`;

    // Convert rudimentary markdown-like output to basic HTML for bot
    let formattedText = text;
    if (sender !== 'User' && !isHTML) {
        // bold
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // bullet points
        formattedText = formattedText.replace(/^\* (.*?)$/gm, '<li>$1</li>');
        formattedText = formattedText.replace(/<li>.*<\/li>/s, match => `<ul>${match}</ul>`);
        formattedText = formattedText.replace(/\n\n/g, '</p><p>');
        msgDiv.innerHTML = `<p>${formattedText}</p>`;
    } else if (isHTML) {
        msgDiv.innerHTML = text;
    } else {
        msgDiv.textContent = text;
    }

    chatbotMessages.appendChild(msgDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return msgDiv;
}

async function sendChatMessage() {
    const text = chatbotInput.value.trim();
    if (!text) return;

    // 1. Add User message
    appendChatMessage('User', text);
    chatbotInput.value = '';
    chatbotSendBtn.disabled = true;

    // 2. Add temporary typing indicator
    const typingId = `typing-${Date.now()}`;
    appendChatMessage('System', `
        <div class="typing-indicator" id="${typingId}">
            <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
        </div>
    `, true);

    // 3. Request Gemini
    const responseText = await chatbotService.sendMessage(text);

    // 4. Remove typing indicator and add response
    const loader = document.getElementById(typingId);
    if (loader && loader.parentElement) {
        loader.parentElement.remove();
    }

    appendChatMessage('Model', responseText);
    chatbotSendBtn.disabled = false;
    chatbotInput.focus();
}

chatbotToggleBtn?.addEventListener('click', toggleChatbot);
chatbotCloseBtn?.addEventListener('click', toggleChatbot);
chatbotSendBtn?.addEventListener('click', sendChatMessage);
chatbotInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// ── Inject dynamic chart styles ───────────────────────────────────────────────

const chartStyles = document.createElement('style');
chartStyles.textContent = `
  .chart-grid { display: flex; flex-direction: column; gap: 3px; margin: 8px 0; }
  .chart-row  { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; }
  .chart-string { color: var(--text-muted); width: 14px; text-align: right; font-size: 0.7rem; }
  .chart-fret { padding: 2px 8px; border-radius: 4px; font-weight: 700; min-width: 32px; text-align: center; }
  .chart-fret.fret  { background: rgba(79,156,249,0.18); color: var(--accent); border: 1px solid rgba(79,156,249,0.3); }
  .chart-fret.open  { background: rgba(45,212,160,0.12); color: var(--success); border: 1px solid rgba(45,212,160,0.25); }
  .chart-fret.muted { background: rgba(249,112,102,0.1); color: var(--danger);  border: 1px solid rgba(249,112,102,0.2); }
`;
document.head.appendChild(chartStyles);

// ── Init ──────────────────────────────────────────────────────────────────────

// Populate chord dropdown with all available chords
if (chordSelect) {
    const chords = chordModel.availableChords;
    if (chords.length > 0) {
        chordSelect.innerHTML = chords.map(c => 
            `<option value="${c}" ${c === 'Em' ? 'selected' : ''}>${c === 'Em' ? 'E Minor (Em)' : c === 'C' ? 'C Major (C)' : c === 'G' ? 'G Major (G)' : c === 'D' ? 'D Major (D)' : c === 'Am' ? 'A Minor (Am)' : c === 'E' ? 'E Major (E)' : c === 'A' ? 'A Major (A)' : c === 'F' ? 'F Major (F)' : c === 'Dm' ? 'D Minor (Dm)' : c}</option>`
        ).join('');
    }
    chordSelect.value = 'Em';
}

chordModel.setCurrentChord('Em');
renderChordChart('Em');

setStatus('Ready');
setHint('🎸 Position your guitar in frame or explore the 3D Fretboard to begin!');

// Render initial chord pipeline
renderPipeline(DEFAULT_CHORD_SEQUENCE, 0);
chordPipeline.querySelectorAll('.chord-pip').forEach(el => {
    el.classList.remove('active');
    el.classList.add('pending');
});

// ── 3D Interactive Fretboard Visualizer ───────────────────────────────────────
const threeContainer = document.getElementById('threeViewport');
if (threeContainer) {
    try {
        threeVisualizer = new ThreeGuitarVisualizer(threeContainer);
        threeVisualizer.setChord('em');
    } catch (err) {
        console.warn('3D Fretboard initialization error:', err);
    }
}

// ── Studio Navigation Tabs ───────────────────────────────────────────────────
export function switchTab(targetId) {
    const studioNav = document.getElementById('studioNav');
    if (studioNav) {
        studioNav.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === targetId);
        });
    }
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === targetId);
    });
    if (targetId === 'tab-3d' && threeVisualizer) {
        setTimeout(() => threeVisualizer.resize(), 60);
    }
    if (targetId === 'tab-practice' && practiceCelebration) {
        setTimeout(() => practiceCelebration.resize(), 60);
    }
}

const studioNav = document.getElementById('studioNav');
if (studioNav) {
    studioNav.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
}

// ── 3D Viewport Controls ─────────────────────────────────────────────────────
document.getElementById('btn3dStrum')?.addEventListener('click', () => {
    threeVisualizer?.strum('down');
});

const viewButtons = [
    { id: 'btn3dViewPlayer', preset: 'player' },
    { id: 'btn3dViewFront', preset: 'front' },
    { id: 'btn3dViewAngle', preset: 'angle' },
];
viewButtons.forEach(({ id, preset }) => {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => {
        viewButtons.forEach(b => document.getElementById(b.id)?.classList.remove('active'));
        btn.classList.add('active');
        threeVisualizer?.setCameraPreset(preset);
    });
});

const btnSound = document.getElementById('btn3dSoundToggle');
btnSound?.addEventListener('click', () => {
    if (!threeVisualizer) return;
    threeVisualizer.soundEnabled = !threeVisualizer.soundEnabled;
    btnSound.textContent = threeVisualizer.soundEnabled ? '🔊' : '🔇';
    btnSound.classList.toggle('active', threeVisualizer.soundEnabled);
});

// 3D Chord Pills
document.querySelectorAll('.chord-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.chord-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const chordKey = pill.dataset.chord;
        if (threeVisualizer) {
            threeVisualizer.setChord(chordKey);
            threeVisualizer.strum('down');
        }
        const chordName = pill.textContent.trim();
        const hudName = document.getElementById('hudChordName');
        const hudDesc = document.getElementById('hudChordDesc');
        if (hudName) hudName.textContent = chordName;
        if (hudDesc && CHORD_TIPS[chordName]) hudDesc.textContent = CHORD_TIPS[chordName][0];

        if (chordSelect) {
            chordSelect.value = chordName;
            renderChordChart(chordName);
        }
    });
});

// ── Interactive 3D Card Tilt ─────────────────────────────────────────────────
document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(1000px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-2px)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ── Chord Reference Library & Detail Modal ───────────────────────────────────
function initChordLibrary() {
    const grid = document.getElementById('chordCardsGrid');
    if (!grid) return;

    const chords = ChordDiagramRenderer.getAllChords();
    grid.innerHTML = chords.map(c => ChordDiagramRenderer.renderReferenceCardHTML(c)).join('');

    // Filter Chips
    const filterGroup = document.getElementById('chordFilterGroup');
    if (filterGroup) {
        filterGroup.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                filterGroup.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const filter = chip.dataset.filter;

                grid.querySelectorAll('.chord-ref-card').forEach(card => {
                    const cat = card.dataset.category;
                    const diff = card.dataset.difficulty;
                    let show = false;
                    if (filter === 'all') show = true;
                    else if (filter === 'beginner' && diff === 'beginner') show = true;
                    else if (filter === 'intermediate' && diff === 'intermediate') show = true;
                    else if (filter === 'major' && cat === 'major') show = true;
                    else if (filter === 'minor' && cat === 'minor') show = true;

                    card.style.display = show ? 'flex' : 'none';
                });
            });
        });
    }

    // Interactive button delegation on card grid
    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        const frame = e.target.closest('.chord-img-frame');

        if (btn) {
            const action = btn.dataset.action;
            const chordId = btn.dataset.chordId;
            const chord = ChordDiagramRenderer.getChord(chordId);
            if (!chord) return;

            if (action === 'sound') {
                ChordDiagramRenderer.playChordSound(chord);
            } else if (action === 'coach') {
                switchTab('tab-coach');
                if (chordSelect) chordSelect.value = chord.name;
                chordModel.setCurrentChord(chord.name);
                renderChordChart(chord.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (action === 'three') {
                switchTab('tab-3d');
                if (threeVisualizer) {
                    threeVisualizer.setChord(chord.id);
                    threeVisualizer.strum('down');
                }
                const pill = document.querySelector(`.chord-pill[data-chord="${chord.id}"]`);
                if (pill) {
                    document.querySelectorAll('.chord-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (action === 'enlarge') {
                openChordModal(chordId);
            }
        } else if (frame) {
            const card = frame.closest('.chord-ref-card');
            if (card) {
                openChordModal(card.dataset.chordId);
            }
        }
    });
}

function openChordModal(chordNameOrId) {
    const chord = ChordDiagramRenderer.getChord(chordNameOrId);
    if (!chord) return;

    const modal = document.getElementById('chordModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;

    const bigImgUrl = ChordDiagramRenderer.toDataURL(chord, { width: 250, height: 290, showTitle: false });
    const notesJoined = chord.notes.filter(n => n !== '✕').join(' · ');
    const songTags = chord.popularSongs.map(s => `<span class="song-tag">🎵 ${s}</span>`).join('');
    const fingerTable = chord.fingerGuide.map(fg => `
        <tr>
            <td style="color:var(--amber); font-weight:700; width:130px;">${fg.finger}</td>
            <td style="color:var(--text-secondary);">${fg.string}</td>
            <td style="color:var(--accent); font-family:var(--font-mono); font-weight:600;">${fg.fret === -1 ? 'Mute' : fg.fret === 0 ? 'Open' : `Fret ${fg.fret}`}</td>
        </tr>
    `).join('');

    const proTipsList = chord.proTips.map(pt => `<li>${pt}</li>`).join('');

    content.innerHTML = `
        <div class="modal-chord-layout">
            <div class="modal-chord-img-box">
                <img src="${bigImgUrl}" alt="${chord.fullName} Chord Diagram" class="chord-diagram-img" />
                <button class="btn btn-secondary btn-sm" id="modalBtnStrum" style="margin-top:14px; width:100%;">
                    🔊 Strum Acoustic
                </button>
            </div>

            <div class="modal-chord-details">
                <div class="modal-chord-title-row">
                    <span class="modal-chord-name">${chord.name}</span>
                    <span class="modal-chord-full">${chord.fullName}</span>
                    <span class="badge-tag ${chord.difficulty === 'intermediate' ? 'amber' : 'emerald'}">${chord.difficulty}</span>
                </div>

                <p class="modal-desc">${chord.description}</p>

                <div>
                    <h4 class="modal-section-h4">Fingering Position Guide</h4>
                    <table class="modal-finger-table">
                        <tbody>
                            ${fingerTable}
                        </tbody>
                    </table>
                </div>

                <div>
                    <h4 class="modal-section-h4">Musical Formula & Notes</h4>
                    <div style="font-family:var(--font-mono); font-size:0.85rem; color:var(--accent); margin-bottom:4px;">
                        ${chord.formula}
                    </div>
                    <div style="font-size:0.82rem; color:var(--text-secondary);">
                        Notes played: <strong style="color:#fff;">${notesJoined}</strong>
                    </div>
                </div>

                <div>
                    <h4 class="modal-section-h4">Pro Technique Tips</h4>
                    <ul class="tips-list" style="font-size:0.84rem;">
                        ${proTipsList}
                    </ul>
                </div>

                <div>
                    <h4 class="modal-section-h4">Featured in Popular Songs</h4>
                    <div class="modal-songs-tags">
                        ${songTags}
                    </div>
                </div>

                <div class="modal-actions-bar">
                    <button class="btn btn-primary" id="modalBtnCoach">
                        🎯 Practice in Visual Coach
                    </button>
                    <button class="btn btn-secondary" id="modalBtn3D">
                        🪐 Inspect in 3D Fretboard
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalBtnStrum')?.addEventListener('click', () => {
        ChordDiagramRenderer.playChordSound(chord);
    });

    document.getElementById('modalBtnCoach')?.addEventListener('click', () => {
        closeChordModal();
        switchTab('tab-coach');
        if (chordSelect) chordSelect.value = chord.name;
        chordModel.setCurrentChord(chord.name);
        renderChordChart(chord.name);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('modalBtn3D')?.addEventListener('click', () => {
        closeChordModal();
        switchTab('tab-3d');
        if (threeVisualizer) {
            threeVisualizer.setChord(chord.id);
            threeVisualizer.strum('down');
        }
        const pill = document.querySelector(`.chord-pill[data-chord="${chord.id}"]`);
        if (pill) {
            document.querySelectorAll('.chord-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeChordModal() {
    const modal = document.getElementById('chordModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function initChordModal() {
    const closeBtn = document.getElementById('modalCloseBtn');
    const backdrop = document.getElementById('modalBackdrop');

    closeBtn?.addEventListener('click', closeChordModal);
    backdrop?.addEventListener('click', closeChordModal);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeChordModal();
    });
}

// Initialise Chord Reference Library & Modal
initChordLibrary();
initChordModal();



