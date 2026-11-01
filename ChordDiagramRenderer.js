/**
 * ChordDiagramRenderer.js
 * 
 * High-definition SVG Guitar Chord Chart Image Generator & Reference Engine.
 * Generates vector chord box diagrams with exact fretboard geometry,
 * finger numbers (1-4), open (O) and muted (X) indicators, barre capsules,
 * and string gauges.
 * 
 * Can be rendered directly into DOM or converted to SVG Data URL images for <img> elements.
 */

export const CHORD_DEFINITIONS = [
  {
    id: 'em',
    name: 'Em',
    fullName: 'E Minor',
    type: 'minor',
    difficulty: 'beginner',
    category: 'Minor Chords',
    baseFret: 1,
    frets: [0, 2, 2, 0, 0, 0],
    fingers: [0, 2, 3, 0, 0, 0],
    barre: null,
    notes: ['E', 'B', 'E', 'G', 'B', 'E'],
    formula: 'Root - 5th - Root - b3rd - 5th - Root',
    description: 'One of the first chords every guitarist learns. Rich, resonant, and easy to play with just two fingers.',
    fingerGuide: [
      { finger: 'Middle (2)', string: '5th String (A)', fret: 2 },
      { finger: 'Ring (3)', string: '4th String (D)', fret: 2 },
      { finger: 'Open', string: '6th (E), 3rd (G), 2nd (B), 1st (e)', fret: 0 }
    ],
    proTips: [
      'Arch fingers high on their tips so you do not accidentally touch the open G string.',
      'Place your fingers close behind the 2nd fret wire for the cleanest tone without buzzing.',
      'Strum all 6 strings with confidence — every single string belongs in this chord.'
    ],
    popularSongs: ['Treat You Better (Shawn Mendes)', 'Nothing Else Matters (Metallica)', 'Wish You Were Here (Pink Floyd)']
  },
  {
    id: 'c',
    name: 'C',
    fullName: 'C Major',
    type: 'major',
    difficulty: 'beginner',
    category: 'Major Chords',
    baseFret: 1,
    frets: [-1, 3, 2, 0, 1, 0],
    fingers: [0, 3, 2, 0, 1, 0],
    barre: null,
    notes: ['✕', 'C', 'E', 'G', 'C', 'E'],
    formula: 'Root - 3rd - 5th - Root - 3rd',
    description: 'The foundation of pop and acoustic music. Features a diagonal finger stair-step pattern across the fretboard.',
    fingerGuide: [
      { finger: 'Ring (3)', string: '5th String (A)', fret: 3 },
      { finger: 'Middle (2)', string: '4th String (D)', fret: 2 },
      { finger: 'Index (1)', string: '2nd String (B)', fret: 1 },
      { finger: 'Mute', string: '6th String (Low E)', fret: -1 }
    ],
    proTips: [
      'Gently lean the tip of your Ring finger against the low E string to keep it silently muted.',
      'Curl your Index finger so the high e string rings out loud and crisp.',
      'Strum cleanly from the 5th string (A) downwards.'
    ],
    popularSongs: ['Stitches (Shawn Mendes)', 'Imagine (John Lennon)', 'Let It Be (The Beatles)']
  },
  {
    id: 'g',
    name: 'G',
    fullName: 'G Major',
    type: 'major',
    difficulty: 'beginner',
    category: 'Major Chords',
    baseFret: 1,
    frets: [3, 2, 0, 0, 0, 3],
    fingers: [2, 1, 0, 0, 0, 3],
    barre: null,
    notes: ['G', 'B', 'D', 'G', 'B', 'G'],
    formula: 'Root - 3rd - 5th - Root - 3rd - Root',
    description: 'A massive, bright, ringing open chord utilizing all 6 strings with root notes anchored on both outer strings.',
    fingerGuide: [
      { finger: 'Middle (2)', string: '6th String (Low E)', fret: 3 },
      { finger: 'Index (1)', string: '5th String (A)', fret: 2 },
      { finger: 'Ring (3)', string: '1st String (High e)', fret: 3 },
      { finger: 'Open', string: '4th (D), 3rd (G), 2nd (B)', fret: 0 }
    ],
    proTips: [
      'Reach your Middle finger right to the edge of fret 3 on the low E string.',
      'Keep your wrist dropped slightly forward to allow the open D, G, and B strings to ring without dampening.',
      'Transitioning to C? Practice pivoting your Middle and Ring fingers in tandem.'
    ],
    popularSongs: ["There's Nothing Holdin' Me Back (Shawn Mendes)", 'Perfect (Ed Sheeran)', 'Good Riddance (Green Day)']
  },
  {
    id: 'd',
    name: 'D',
    fullName: 'D Major',
    type: 'major',
    difficulty: 'beginner',
    category: 'Major Chords',
    baseFret: 1,
    frets: [-1, -1, 0, 2, 3, 2],
    fingers: [0, 0, 0, 1, 3, 2],
    barre: null,
    notes: ['✕', '✕', 'D', 'A', 'D', 'F#'],
    formula: 'Root - 5th - Root - 3rd',
    description: 'A compact triangular chord played on the top four strings. Clear, upbeat, and bright.',
    fingerGuide: [
      { finger: 'Index (1)', string: '3rd String (G)', fret: 2 },
      { finger: 'Ring (3)', string: '2nd String (B)', fret: 3 },
      { finger: 'Middle (2)', string: '1st String (High e)', fret: 2 },
      { finger: 'Mute', string: '6th (Low E) & 5th (A)', fret: -1 }
    ],
    proTips: [
      'Strum only the top 4 strings starting from the open 4th (D) string.',
      'Wrap your thumb slightly over the neck top to touch and dampen the low E string.',
      'Your fingers form a triangle — keep the Ring finger in the pocket on fret 3.'
    ],
    popularSongs: ['In My Blood (Shawn Mendes)', 'Hotel California (Eagles)', 'Free Fallin (Tom Petty)']
  },
  {
    id: 'am',
    name: 'Am',
    fullName: 'A Minor',
    type: 'minor',
    difficulty: 'beginner',
    category: 'Minor Chords',
    baseFret: 1,
    frets: [-1, 0, 2, 2, 1, 0],
    fingers: [0, 0, 2, 3, 1, 0],
    barre: null,
    notes: ['✕', 'A', 'E', 'A', 'C', 'E'],
    formula: 'Root - 5th - Root - b3rd - 5th',
    description: 'Identical shape to E Major, shifted down by exactly one string. Soulful, melancholic, and smooth.',
    fingerGuide: [
      { finger: 'Middle (2)', string: '4th String (D)', fret: 2 },
      { finger: 'Ring (3)', string: '3rd String (G)', fret: 2 },
      { finger: 'Index (1)', string: '2nd String (B)', fret: 1 },
      { finger: 'Mute / Open', string: 'Low E muted, A string open', fret: 0 }
    ],
    proTips: [
      'Stack Middle (2) above Ring (3) tightly on the 2nd fret.',
      'Begin your downward strum from the open 5th string (A).',
      'The shape is identical to E Major — notice how you can hop between them with one fluid shift!'
    ],
    popularSongs: ['Mercy (Shawn Mendes)', 'Losing My Religion (R.E.M.)', 'Stairway to Heaven (Led Zeppelin)']
  },
  {
    id: 'e',
    name: 'E',
    fullName: 'E Major',
    type: 'major',
    difficulty: 'beginner',
    category: 'Major Chords',
    baseFret: 1,
    frets: [0, 2, 2, 1, 0, 0],
    fingers: [0, 2, 3, 1, 0, 0],
    barre: null,
    notes: ['E', 'B', 'E', 'G#', 'B', 'E'],
    formula: 'Root - 5th - Root - 3rd - 5th - Root',
    description: 'The powerhouse of guitar chords. Full 6-string rumble with a bright major 3rd on the G string.',
    fingerGuide: [
      { finger: 'Middle (2)', string: '5th String (A)', fret: 2 },
      { finger: 'Ring (3)', string: '4th String (D)', fret: 2 },
      { finger: 'Index (1)', string: '3rd String (G)', fret: 1 },
      { finger: 'Open', string: '6th (E), 2nd (B), 1st (e)', fret: 0 }
    ],
    proTips: [
      'Start with your Index finger on fret 1 to anchor the hand before placing fingers 2 and 3.',
      'Check that your Index finger is arched so the open B and high e strings ring freely.',
      'Strum across all 6 strings for maximum acoustic warmth.'
    ],
    popularSongs: ['Lost in Japan (Shawn Mendes)', 'Hey Joe (Jimi Hendrix)', 'Day Tripper (The Beatles)']
  },
  {
    id: 'a',
    name: 'A',
    fullName: 'A Major',
    type: 'major',
    difficulty: 'beginner',
    category: 'Major Chords',
    baseFret: 1,
    frets: [-1, 0, 2, 2, 2, 0],
    fingers: [0, 0, 1, 2, 3, 0],
    barre: null,
    notes: ['✕', 'A', 'E', 'A', 'C#', 'E'],
    formula: 'Root - 5th - Root - 3rd - 5th',
    description: 'Three fingers clustered together inside a single fret (fret 2). Crisp, punchy, and triumphant.',
    fingerGuide: [
      { finger: 'Index (1)', string: '4th String (D)', fret: 2 },
      { finger: 'Middle (2)', string: '3rd String (G)', fret: 2 },
      { finger: 'Ring (3)', string: '2nd String (B)', fret: 2 },
      { finger: 'Open', string: '5th String (A) & 1st String (e)', fret: 0 }
    ],
    proTips: [
      'Stagger your fingertips slightly diagonal across the fret wire so all 3 fit snugly.',
      'Keep your Ring finger arched so it does not touch or deaden the high e string.',
      'Strum downwards starting from the open 5th string (A).'
    ],
    popularSongs: ['Never Be Alone (Shawn Mendes)', 'Back in Black (AC/DC)', 'Wild Thing (The Troggs)']
  },
  {
    id: 'f',
    name: 'F',
    fullName: 'F Major (Barre)',
    type: 'major',
    difficulty: 'intermediate',
    category: 'Barre Chords',
    baseFret: 1,
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barre: 1,
    notes: ['F', 'C', 'F', 'A', 'C', 'F'],
    formula: 'Root - 5th - Root - 3rd - 5th - Root',
    description: 'The legendary beginner milestone. Your Index finger forms a complete barre capo across fret 1.',
    fingerGuide: [
      { finger: 'Index (1) Barre', string: 'Strings 1 to 6 (Flat)', fret: 1 },
      { finger: 'Ring (3)', string: '5th String (A)', fret: 3 },
      { finger: 'Pinky (4)', string: '4th String (D)', fret: 3 },
      { finger: 'Middle (2)', string: '3rd String (G)', fret: 2 }
    ],
    proTips: [
      'Roll your Index finger slightly onto its bony side rather than the soft fleshy pad.',
      'Pull back gently from your shoulder and arm rather than only squeezing your thumb.',
      'Place your fingers 3, 4, and 2 first, then lay down the barre across fret 1.'
    ],
    popularSongs: ["If I Can't Have You (Shawn Mendes)", 'House of the Rising Sun (The Animals)', 'Californication (RHCP)']
  },
  {
    id: 'dm',
    name: 'Dm',
    fullName: 'D Minor',
    type: 'minor',
    difficulty: 'beginner',
    category: 'Minor Chords',
    baseFret: 1,
    frets: [-1, -1, 0, 2, 3, 1],
    fingers: [0, 0, 0, 2, 3, 1],
    barre: null,
    notes: ['✕', '✕', 'D', 'A', 'D', 'F'],
    formula: 'Root - 5th - Root - b3rd',
    description: 'Dramatic, haunting, and beautiful. Often called the saddest and most evocative sounding open chord.',
    fingerGuide: [
      { finger: 'Index (1)', string: '1st String (High e)', fret: 1 },
      { finger: 'Middle (2)', string: '3rd String (G)', fret: 2 },
      { finger: 'Ring (3)', string: '2nd String (B)', fret: 3 },
      { finger: 'Mute', string: '6th (Low E) & 5th (A)', fret: -1 }
    ],
    proTips: [
      'Make sure your Index finger on fret 1 stands tall on its tip to avoid dampening the open D or G strings.',
      'Strum the top 4 strings only, starting from the open 4th (D) string.',
      'Notice the stretch between fret 1 (Index) and fret 3 (Ring) — keep your wrist relaxed.'
    ],
    popularSongs: ['Black Magic Woman (Santana)', 'Set Fire to the Rain (Adele)', 'Losing Grip (Avril Lavigne)']
  }
];

export class ChordDiagramRenderer {
  /**
   * Look up chord definition by name (case-insensitive) or id
   */
  static getChord(nameOrId) {
    if (!nameOrId) return null;
    const clean = String(nameOrId).trim().toLowerCase();
    return CHORD_DEFINITIONS.find(c => 
      c.id.toLowerCase() === clean || 
      c.name.toLowerCase() === clean || 
      c.fullName.toLowerCase() === clean
    ) || null;
  }

  /**
   * Return all chords in library
   */
  static getAllChords() {
    return [...CHORD_DEFINITIONS];
  }

  /**
   * Generate vector SVG string of the guitar chord chart image
   * @param {Object|string} chordData - Chord object or chord name
   * @param {Object} options - Render configuration options
   */
  static renderSVG(chordData, options = {}) {
    const chord = typeof chordData === 'string' ? this.getChord(chordData) : chordData;
    if (!chord) return '';

    const {
      width,
      height,
      showTitle = true,
      theme = 'dark', // 'dark' | 'light' | 'compact'
      interactive = false,
      badgeText = null
    } = options;

    const baseFret = chord.baseFret || 1;
    const numFrets = 4;
    const stringNames = ['E', 'A', 'D', 'G', 'B', 'e'];
    const stringGauges = [2.8, 2.3, 1.8, 1.4, 1.1, 0.85];

    // Canonical internal coordinates layout (canonical 220 width)
    const V_WIDTH = 220;
    const V_HEIGHT = showTitle ? 260 : 225;

    const outWidth = width || V_WIDTH;
    const outHeight = height || (width ? Math.round(width * (V_HEIGHT / V_WIDTH)) : V_HEIGHT);

    // Coordinates layout
    const xStart = 42;
    const stringSpacing = 27; // x: 42, 69, 96, 123, 150, 177 (fretboard width = 135)
    const xEnd = xStart + 5 * stringSpacing; // 177

    const yNut = showTitle ? 66 : 40;
    const fretSpacing = 34; // 4 frets = 136px
    const yEnd = yNut + numFrets * fretSpacing; // 66 + 136 = 202; 40 + 136 = 176

    const isNut = baseFret === 1;

    // Build defs (gradients and filters)
    const svgId = `cd-${chord.id}-${Math.random().toString(36).substring(2, 7)}`;
    const defs = `
      <defs>
        <!-- Glow Filter for active dots -->
        <filter id="${svgId}-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#06b6d4" flood-opacity="0.45"/>
        </filter>
        <!-- Amber Glow Filter -->
        <filter id="${svgId}-glow-amber" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#f59e0b" flood-opacity="0.45"/>
        </filter>
        <!-- Finger dot gradient -->
        <radialGradient id="${svgId}-dot-cyan" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#22d3ee" />
          <stop offset="70%" stop-color="#06b6d4" />
          <stop offset="100%" stop-color="#0891b2" />
        </radialGradient>
        <radialGradient id="${svgId}-dot-amber" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fde047" />
          <stop offset="65%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#d97706" />
        </radialGradient>
        <!-- Nut gradient -->
        <linearGradient id="${svgId}-nut" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#94a3b8" />
          <stop offset="50%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
        <!-- Barre pill gradient -->
        <linearGradient id="${svgId}-barre" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0891b2" />
          <stop offset="50%" stop-color="#06b6d4" />
          <stop offset="100%" stop-color="#0891b2" />
        </linearGradient>
      </defs>
    `;

    // Background card
    const bgRect = theme === 'dark' 
      ? `<rect width="${V_WIDTH}" height="${V_HEIGHT}" rx="14" fill="#0d1424" stroke="rgba(255,255,255,0.08)" stroke-width="1.2" />
         <rect x="${xStart - 8}" y="${yNut - 2}" width="${xEnd - xStart + 16}" height="${yEnd - yNut + 6}" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.04)" />`
      : `<rect width="${V_WIDTH}" height="${V_HEIGHT}" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.2" />`;

    // Title / Header
    let titleMarkup = '';
    if (showTitle) {
      const badge = badgeText || (chord.difficulty === 'intermediate' ? 'Barre' : 'Open');
      titleMarkup = `
        <g class="chord-svg-header">
          <text x="20" y="32" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="22" fill="#f59e0b" letter-spacing="-0.5">${chord.name}</text>
          <text x="64" y="31" font-family="'Plus Jakarta Sans', sans-serif" font-weight="500" font-size="12" fill="#94a3b8">${chord.fullName}</text>
          <rect x="${V_WIDTH - 66}" y="18" width="48" height="18" rx="9" fill="rgba(6, 182, 212, 0.14)" stroke="rgba(6, 182, 212, 0.3)" stroke-width="1" />
          <text x="${V_WIDTH - 42}" y="30.5" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="9" fill="#22d3ee" text-anchor="middle">${badge}</text>
        </g>
      `;
    }

    // Top Nut or Fret Position Indicator
    let nutMarkup = '';
    if (isNut) {
      nutMarkup = `<line x1="${xStart - 4}" y1="${yNut}" x2="${xEnd + 4}" y2="${yNut}" stroke="url(#${svgId}-nut)" stroke-width="5" stroke-linecap="round" />`;
    } else {
      nutMarkup = `
        <line x1="${xStart}" y1="${yNut}" x2="${xEnd}" y2="${yNut}" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
        <text x="${xStart - 12}" y="${yNut + 20}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="11" fill="#f59e0b" text-anchor="end">${baseFret}fr</text>
      `;
    }

    // Frets (horizontal lines)
    let fretsMarkup = '';
    for (let f = 1; f <= numFrets; f++) {
      const yFret = yNut + f * fretSpacing;
      fretsMarkup += `<line x1="${xStart}" y1="${yFret}" x2="${xEnd}" y2="${yFret}" stroke="rgba(255,255,255,0.22)" stroke-width="1.4" />`;
    }

    // Side fret numbers (1, 2, 3, 4)
    let fretNumsMarkup = '';
    for (let f = 1; f <= numFrets; f++) {
      const yCenter = yNut + (f - 0.5) * fretSpacing + 4;
      const fretVal = baseFret + f - 1;
      fretNumsMarkup += `<text x="${xStart - 12}" y="${yCenter}" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="500" fill="rgba(148,163,184,0.45)" text-anchor="end">${fretVal}</text>`;
    }

    // Fret inlays (e.g. 3rd fret dot)
    let inlaysMarkup = '';
    const thirdFret = 3 - baseFret + 1;
    if (thirdFret >= 1 && thirdFret <= numFrets) {
      const yMarker = yNut + (thirdFret - 0.5) * fretSpacing;
      const xMarker = (xStart + xEnd) / 2;
      inlaysMarkup = `<circle cx="${xMarker}" cy="${yMarker}" r="3" fill="rgba(255,255,255,0.12)" />`;
    }

    // Strings (vertical lines)
    let stringsMarkup = '';
    for (let s = 0; s < 6; s++) {
      const xStr = xStart + s * stringSpacing;
      const gauge = stringGauges[s];
      stringsMarkup += `<line x1="${xStr}" y1="${yNut}" x2="${xStr}" y2="${yEnd}" stroke="#94a3b8" stroke-width="${gauge}" stroke-opacity="0.75" />`;
    }

    // Top Indicators (Open 'O' or Muted 'X')
    let topIndicatorsMarkup = '';
    const yTopIndicator = yNut - 14;
    chord.frets.forEach((fretVal, s) => {
      const xStr = xStart + s * stringSpacing;
      if (fretVal === -1) {
        // Muted X
        const d = 5;
        topIndicatorsMarkup += `
          <g class="chord-mute-x" stroke="#f87171" stroke-width="2" stroke-linecap="round">
            <line x1="${xStr - d}" y1="${yTopIndicator - d}" x2="${xStr + d}" y2="${yTopIndicator + d}" />
            <line x1="${xStr + d}" y1="${yTopIndicator - d}" x2="${xStr - d}" y2="${yTopIndicator + d}" />
          </g>
        `;
      } else if (fretVal === 0) {
        // Open O
        topIndicatorsMarkup += `
          <circle cx="${xStr}" cy="${yTopIndicator}" r="5.5" fill="none" stroke="#10b981" stroke-width="2" />
        `;
      }
    });

    // Barre chord capsule (if any)
    let barreMarkup = '';
    if (chord.barre) {
      const barreFretIndex = chord.barre - baseFret + 1;
      if (barreFretIndex >= 1 && barreFretIndex <= numFrets) {
        const yBarreCenter = yNut + (barreFretIndex - 0.5) * fretSpacing;
        // Find min and max string for the barre
        let minStr = 0;
        let maxStr = 5;
        for (let s = 0; s < 6; s++) {
          if (chord.fingers[s] === 1 && chord.frets[s] === chord.barre) {
            minStr = s;
            break;
          }
        }
        for (let s = 5; s >= 0; s--) {
          if (chord.fingers[s] === 1 && chord.frets[s] === chord.barre) {
            maxStr = s;
            break;
          }
        }
        const x1 = xStart + minStr * stringSpacing;
        const x2 = xStart + maxStr * stringSpacing;
        const pillWidth = (x2 - x1) + 22;

        barreMarkup = `
          <g class="chord-barre" filter="url(#${svgId}-glow)">
            <rect x="${x1 - 11}" y="${yBarreCenter - 9}" width="${pillWidth}" height="18" rx="9" fill="url(#${svgId}-barre)" />
            <text x="${(x1 + x2) / 2}" y="${yBarreCenter + 3.8}" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="10.5" fill="#ffffff" text-anchor="middle">1 (Barre)</text>
          </g>
        `;
      }
    }

    // Finger Placement Dots
    let dotsMarkup = '';
    chord.frets.forEach((fretVal, s) => {
      if (fretVal > 0) {
        // Skip rendering individual dot if covered by barre and finger is 1 (except end anchors)
        const isBarreNote = chord.barre && fretVal === chord.barre && chord.fingers[s] === 1;
        if (isBarreNote) return;

        const fretRel = fretVal - baseFret + 1;
        if (fretRel >= 1 && fretRel <= numFrets) {
          const xPos = xStart + s * stringSpacing;
          const yPos = yNut + (fretRel - 0.5) * fretSpacing;
          const fingerNum = chord.fingers[s] || '';
          const isRoot = s === chord.frets.findIndex(f => f > 0); // first fretted string often root
          const dotGrad = isRoot ? `url(#${svgId}-dot-amber)` : `url(#${svgId}-dot-cyan)`;
          const glow = isRoot ? `url(#${svgId}-glow-amber)` : `url(#${svgId}-glow)`;

          dotsMarkup += `
            <g class="chord-dot" filter="${glow}">
              <circle cx="${xPos}" cy="${yPos}" r="10.5" fill="${dotGrad}" />
              <text x="${xPos}" y="${yPos + 3.8}" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="11.5" fill="#ffffff" text-anchor="middle">${fingerNum}</text>
            </g>
          `;
        }
      }
    });

    // Bottom String Names (E A D G B e)
    let bottomLabelsMarkup = '';
    const yLabels = yEnd + 20;
    stringNames.forEach((name, s) => {
      const xPos = xStart + s * stringSpacing;
      bottomLabelsMarkup += `<text x="${xPos}" y="${yLabels}" font-family="'JetBrains Mono', monospace" font-weight="600" font-size="11" fill="#64748b" text-anchor="middle">${name}</text>`;
    });

    // Assemble complete standalone SVG
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${V_WIDTH} ${V_HEIGHT}" width="${outWidth}" height="${outHeight}" class="chord-diagram-svg ${chord.id}">
        ${defs}
        ${bgRect}
        ${titleMarkup}
        <g class="chord-fretboard">
          ${nutMarkup}
          ${fretsMarkup}
          ${fretNumsMarkup}
          ${inlaysMarkup}
          ${stringsMarkup}
          ${topIndicatorsMarkup}
          ${barreMarkup}
          ${dotsMarkup}
          ${bottomLabelsMarkup}
        </g>
      </svg>
    `.trim();
  }

  /**
   * Convert SVG markup to a Data URL suitable for <img src="...">
   */
  static toDataURL(chordData, options = {}) {
    const svg = this.renderSVG(chordData, options);
    const encoded = encodeURIComponent(svg)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  }

  /**
   * Play realistic acoustic strum sound for the chord using Web Audio API
   */
  static playChordSound(chordData) {
    const chord = typeof chordData === 'string' ? this.getChord(chordData) : chordData;
    if (!chord) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this._audioCtx) {
        this._audioCtx = new AudioCtx();
      }
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }

      const ctx = this._audioCtx;
      const baseFreqs = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63]; // E2..E4
      const startTime = ctx.currentTime + 0.05;

      chord.frets.forEach((fret, stringIdx) => {
        if (fret === -1) return; // muted string

        // Strum stagger: downwards strum ~24ms between strings
        const stringTime = startTime + stringIdx * 0.024;
        const freq = baseFreqs[stringIdx] * Math.pow(2, Math.max(0, fret) / 12);

        const gain = ctx.createGain();
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.001, stringTime);
        gain.gain.exponentialRampToValueAtTime(0.28, stringTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, stringTime + 1.8);

        // Fundamental
        const osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, stringTime);

        // Harmonics
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, stringTime);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.18, stringTime);
        g2.gain.exponentialRampToValueAtTime(0.001, stringTime + 0.7);
        osc2.connect(g2);
        g2.connect(gain);

        // Acoustic filter body
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3400, stringTime);
        filter.frequency.exponentialRampToValueAtTime(700, stringTime + 1.4);

        osc1.connect(filter);
        filter.connect(gain);

        osc1.start(stringTime);
        osc2.start(stringTime);
        osc1.stop(stringTime + 1.9);
        osc2.stop(stringTime + 1.9);
      });
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  /**
   * Build complete HTML card for the chord reference library
   */
  static renderReferenceCardHTML(chord) {
    const dataUrl = this.toDataURL(chord, { width: 220, height: 260, showTitle: false });
    const notesJoined = chord.notes.filter(n => n !== '✕').join(' · ');

    const fingerGuideList = chord.fingerGuide.map(fg => `
      <div class="card-finger-row">
        <span class="cfg-finger">${fg.finger}</span>
        <span class="cfg-arrow">→</span>
        <span class="cfg-string">${fg.string}</span>
      </div>
    `).join('');

    return `
      <div class="chord-ref-card glass tilt-card" data-chord-id="${chord.id}" data-category="${chord.type}" data-difficulty="${chord.difficulty}">
        <!-- Top Badges -->
        <div class="card-top-bar">
          <div class="chord-badge-group">
            <span class="chord-main-sym">${chord.name}</span>
            <span class="chord-sub-name">${chord.fullName}</span>
          </div>
          <div class="card-pill-tags">
            <span class="badge-tag ${chord.difficulty === 'intermediate' ? 'amber' : 'emerald'}">${chord.difficulty}</span>
          </div>
        </div>

        <!-- Chord Image Viewport -->
        <div class="chord-img-frame" title="Click to enlarge ${chord.fullName}">
          <img src="${dataUrl}" alt="${chord.fullName} Guitar Chord Diagram" class="chord-diagram-img" loading="lazy" />
          <button class="btn-enlarge-overlay" data-action="enlarge" data-chord-id="${chord.id}" aria-label="Enlarge diagram">
            🔍 Zoom
          </button>
        </div>

        <!-- Musical Formula & Notes -->
        <div class="card-notes-bar">
          <span class="cnb-label">Notes:</span>
          <span class="cnb-notes">${notesJoined}</span>
        </div>

        <!-- Fingering Summary -->
        <div class="card-finger-guide">
          ${fingerGuideList}
        </div>

        <!-- Card Actions -->
        <div class="card-actions-row">
          <button class="btn-sound-preview btn btn-secondary btn-sm" data-action="sound" data-chord-id="${chord.id}" title="Listen to acoustic chord">
            🔊 Strum
          </button>
          <button class="btn-practice-coach btn btn-primary btn-sm" data-action="coach" data-chord-id="${chord.id}" title="Practice in Visual Coach">
            🎯 Coach
          </button>
          <button class="btn-view-3d btn btn-secondary btn-sm" data-action="three" data-chord-id="${chord.id}" title="Inspect in 3D Fretboard">
            🪐 3D
          </button>
        </div>
      </div>
    `;
  }
}
