/**
 * ReportCard.js — Instant Performance Report Card
 * ─────────────────────────────────────────────────
 * Generates a beautiful full-screen modal with session analytics:
 *   - Overall grade + score
 *   - Per-chord accuracy heatmap rings
 *   - Best / worst chord highlights
 *   - Time-to-correct bar chart
 *   - Session stats summary
 *   - Shareable screenshot download
 */

const CHORD_COLORS = {
    em: '#f59e0b', c: '#06b6d4', g: '#fbbf24', d: '#f97066',
    am: '#2dd4a0', bm: '#38bdf8', dm: '#fb923c', e: '#eab308', f: '#14b8a6',
};

const CHORD_FULL_NAMES = {
    em: 'E Minor', c: 'C Major', g: 'G Major', d: 'D Major',
    am: 'A Minor', bm: 'B Minor', dm: 'D Minor', e: 'E Major', f: 'F Major',
};

function getGrade(accuracy) {
    if (accuracy >= 90) return { letter: 'A', label: 'Outstanding!', cls: 'grade-a' };
    if (accuracy >= 75) return { letter: 'B', label: 'Great Work!', cls: 'grade-b' };
    if (accuracy >= 60) return { letter: 'C', label: 'Good Effort!', cls: 'grade-c' };
    if (accuracy >= 40) return { letter: 'D', label: 'Keep Practicing', cls: 'grade-d' };
    return { letter: 'F', label: 'Keep Going!', cls: 'grade-f' };
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export class ReportCard {
    static _modal = null;

    /**
     * Show the report card modal.
     * @param {object} stats — from PracticeSession.onComplete
     * @param {number} stats.chordsCompleted
     * @param {number} stats.total
     * @param {number} stats.elapsed
     * @param {object} stats.chordStats — per-chord analytics map
     * @param {number} stats.totalDetections
     * @param {number} stats.correctDetections
     */
    static show(stats) {
        // Remove existing modal if any
        if (ReportCard._modal) {
            ReportCard._modal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'reportCardModal';
        modal.className = 'report-modal';
        modal.innerHTML = ReportCard._buildHTML(stats);
        document.body.appendChild(modal);
        ReportCard._modal = modal;

        // Entrance animation
        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });

        // Bind events
        modal.querySelector('.report-close-btn')?.addEventListener('click', () => ReportCard.hide());
        modal.querySelector('.report-share-btn')?.addEventListener('click', () => ReportCard._downloadScreenshot());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) ReportCard.hide();
        });
    }

    static hide() {
        if (!ReportCard._modal) return;
        ReportCard._modal.classList.remove('visible');
        setTimeout(() => {
            ReportCard._modal?.remove();
            ReportCard._modal = null;
        }, 350);
    }

    static _buildHTML(stats) {
        const chordStats = stats.chordStats || {};
        const elapsed = Math.round(stats.elapsed || 0);
        const totalDet = stats.totalDetections || 0;
        const correctDet = stats.correctDetections || 0;
        const overallAccuracy = totalDet > 0 ? Math.round((correctDet / totalDet) * 100) : 0;
        const grade = getGrade(overallAccuracy);

        const chordKeys = Object.keys(chordStats);

        // Find best/worst
        let bestChord = null, worstChord = null, bestAcc = -1, worstAcc = 101;
        for (const [chord, data] of Object.entries(chordStats)) {
            const acc = data.attempts > 0 ? (data.correctDetections / data.attempts) * 100 : 0;
            if (acc > bestAcc) { bestAcc = acc; bestChord = chord; }
            if (acc < worstAcc) { worstAcc = acc; worstChord = chord; }
        }

        // Chord heatmap cards
        const heatmapCards = chordKeys.map(chord => {
            const data = chordStats[chord];
            const acc = data.attempts > 0 ? Math.round((data.correctDetections / data.attempts) * 100) : 0;
            const color = CHORD_COLORS[chord.toLowerCase()] || '#4f9cf9';
            const completed = data.completed;
            const ttc = data.firstCorrectMs ? (data.firstCorrectMs / 1000).toFixed(1) : '—';
            const circumference = 2 * Math.PI * 28;
            const offset = circumference * (1 - acc / 100);
            const statusIcon = completed ? '✅' : '❌';

            return `
                <div class="heatmap-card">
                    <div class="heatmap-ring-wrap">
                        <svg viewBox="0 0 70 70" class="heatmap-ring-svg">
                            <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5"/>
                            <circle cx="35" cy="35" r="28" fill="none"
                                stroke="${color}" stroke-width="5" stroke-linecap="round"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}"
                                style="transform: rotate(-90deg); transform-origin: center;
                                       filter: drop-shadow(0 0 6px ${color}40);
                                       transition: stroke-dashoffset 1s ease 0.3s;"/>
                        </svg>
                        <span class="heatmap-ring-pct">${acc}%</span>
                    </div>
                    <span class="heatmap-chord-name" style="color:${color}">${chord}</span>
                    <span class="heatmap-chord-full">${CHORD_FULL_NAMES[chord.toLowerCase()] || chord}</span>
                    <span class="heatmap-status">${statusIcon}</span>
                    <span class="heatmap-ttc">⏱ ${ttc}s</span>
                </div>`;
        }).join('');

        // Time-to-correct bars
        const maxTTC = Math.max(1, ...chordKeys.map(c => chordStats[c].firstCorrectMs || 0)) / 1000;
        const ttcBars = chordKeys.map(chord => {
            const data = chordStats[chord];
            const ttcSec = data.firstCorrectMs ? data.firstCorrectMs / 1000 : 0;
            const pct = maxTTC > 0 ? (ttcSec / maxTTC) * 100 : 0;
            const color = CHORD_COLORS[chord.toLowerCase()] || '#4f9cf9';
            const label = data.firstCorrectMs ? `${ttcSec.toFixed(1)}s` : 'N/A';

            return `
                <div class="ttc-row">
                    <span class="ttc-label" style="color:${color}">${chord}</span>
                    <div class="ttc-bar-track">
                        <div class="ttc-bar-fill" style="width:${pct}%; background:${color}; box-shadow: 0 0 8px ${color}60;"></div>
                    </div>
                    <span class="ttc-value">${label}</span>
                </div>`;
        }).join('');

        // Misheard chords summary
        let misheardHTML = '';
        for (const [chord, data] of Object.entries(chordStats)) {
            if (data.wrongChordHeard && Object.keys(data.wrongChordHeard).length > 0) {
                const wrongEntries = Object.entries(data.wrongChordHeard)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([w, count]) => `<span class="misheard-chip">${w} ×${count}</span>`)
                    .join('');
                misheardHTML += `
                    <div class="misheard-row">
                        <span class="misheard-target">When playing ${chord}:</span>
                        ${wrongEntries}
                    </div>`;
            }
        }

        const bestColor = CHORD_COLORS[bestChord?.toLowerCase()] || '#2dd4a0';
        const worstColor = CHORD_COLORS[worstChord?.toLowerCase()] || '#f97066';

        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="report-card" id="reportCardContent">
                <!-- Close -->
                <button class="report-close-btn" aria-label="Close report">✕</button>

                <!-- Header -->
                <div class="report-header">
                    <div class="report-header-left">
                        <h2 class="report-title">🏆 Session Report</h2>
                        <p class="report-date">${dateStr} at ${timeStr} • ${formatTime(elapsed)}</p>
                    </div>
                    <div class="report-grade-wrap">
                        <div class="report-grade ${grade.cls}">${grade.letter}</div>
                        <span class="report-grade-label">${grade.label}</span>
                    </div>
                </div>

                <!-- Overall Stats Row -->
                <div class="report-stats-row">
                    <div class="report-stat">
                        <span class="report-stat-value">${stats.chordsCompleted}/${stats.total}</span>
                        <span class="report-stat-label">Chords Done</span>
                    </div>
                    <div class="report-stat">
                        <span class="report-stat-value">${overallAccuracy}%</span>
                        <span class="report-stat-label">Accuracy</span>
                    </div>
                    <div class="report-stat">
                        <span class="report-stat-value">${formatTime(elapsed)}</span>
                        <span class="report-stat-label">Duration</span>
                    </div>
                    <div class="report-stat">
                        <span class="report-stat-value">${totalDet}</span>
                        <span class="report-stat-label">Detections</span>
                    </div>
                </div>

                <!-- Chord Accuracy Heatmap -->
                <div class="report-section">
                    <h3 class="report-section-title">🎯 Chord Accuracy</h3>
                    <div class="chord-heatmap">${heatmapCards}</div>
                </div>

                <!-- Best / Worst -->
                ${bestChord && worstChord && bestChord !== worstChord ? `
                <div class="report-best-worst">
                    <div class="bw-card best">
                        <span class="bw-icon">⭐</span>
                        <span class="bw-label">Best Chord</span>
                        <span class="bw-chord" style="color:${bestColor}">${bestChord}</span>
                        <span class="bw-acc">${Math.round(bestAcc)}% accuracy</span>
                    </div>
                    <div class="bw-card worst">
                        <span class="bw-icon">🎯</span>
                        <span class="bw-label">Needs Work</span>
                        <span class="bw-chord" style="color:${worstColor}">${worstChord}</span>
                        <span class="bw-acc">${Math.round(worstAcc)}% accuracy</span>
                    </div>
                </div>` : ''}

                <!-- Time to Correct -->
                <div class="report-section">
                    <h3 class="report-section-title">⏱ Time to Correct</h3>
                    <p class="report-section-desc">How quickly you nailed each chord from when it appeared</p>
                    <div class="ttc-chart">${ttcBars}</div>
                </div>

                <!-- Misheard Chords -->
                ${misheardHTML ? `
                <div class="report-section">
                    <h3 class="report-section-title">👂 Common Confusions</h3>
                    <div class="misheard-wrap">${misheardHTML}</div>
                </div>` : ''}

                <!-- Share -->
                <div class="report-footer">
                    <button class="report-share-btn">
                        <span>📸</span> Save Report Card
                    </button>
                    <span class="report-footer-note">Guitar Chord Coach • AI-Powered Practice</span>
                </div>
            </div>`;
    }

    static async _downloadScreenshot() {
        const card = document.getElementById('reportCardContent');
        if (!card) return;

        const btn = card.querySelector('.report-share-btn');
        const originalText = btn?.innerHTML;
        if (btn) btn.innerHTML = '<span>⏳</span> Generating...';

        try {
            // Dynamically load html2canvas from CDN
            if (!window.html2canvas) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const canvas = await window.html2canvas(card, {
                backgroundColor: '#0a0e1a',
                scale: 2,
                useCORS: true,
                logging: false,
            });

            const link = document.createElement('a');
            link.download = `guitar-report-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            if (btn) btn.innerHTML = '<span>✅</span> Saved!';
            setTimeout(() => { if (btn) btn.innerHTML = originalText; }, 2000);
        } catch (err) {
            console.error('[ReportCard] Screenshot failed:', err);
            if (btn) btn.innerHTML = '<span>❌</span> Failed';
            setTimeout(() => { if (btn) btn.innerHTML = originalText; }, 2000);
        }
    }
}
