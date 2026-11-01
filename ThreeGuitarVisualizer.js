/**
 * ThreeGuitarVisualizer.js
 * 
 * Interactive 3D Guitar Fretboard & String Vibration Visualizer
 * Powered by Three.js & Web Audio API
 *
 * Features:
 * - 3D Rosewood fretboard with authentic pearloid dot inlays and metallic nickel frets
 * - 6 physical 3D guitar strings with real-time sinusoidal vibration physics simulation
 * - 3D glowing finger placement spheres for chord positions with finger numbers
 * - Web Audio API Karplus-Strong / physical harmonic acoustic guitar synthesizer for plucking
 * - Interactive OrbitControls (drag to rotate, scroll to zoom, inspect from player's POV)
 * - Strum button & quick camera angle presets
 */

import * as THREE from 'three';

// Standard guitar string frequencies (Hz) for strings 6 to 1 [E2, A2, D3, G3, B3, E4]
const BASE_FREQUENCIES = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

// Finger labels
const FINGER_LABELS = ['', '1 (Idx)', '2 (Mid)', '3 (Ring)', '4 (Pinky)'];

// Common chord fingering library: strings [lowE, A, D, G, B, highE], fingers [lowE..highE]
// -1 = muted (x), 0 = open, 1-N = fret number
const CHORD_LIBRARY = {
    'em': {
        name: 'Em',
        fullName: 'E Minor',
        frets: [0, 2, 2, 0, 0, 0],
        fingers: [0, 2, 3, 0, 0, 0],
        description: 'Standard open E minor — Middle on A (2), Ring on D (2)'
    },
    'c': {
        name: 'C',
        fullName: 'C Major',
        frets: [-1, 3, 2, 0, 1, 0],
        fingers: [0, 3, 2, 0, 1, 0],
        description: 'Open C major — Ring on A (3), Middle on D (2), Index on B (1)'
    },
    'g': {
        name: 'G',
        fullName: 'G Major',
        frets: [3, 2, 0, 0, 0, 3],
        fingers: [2, 1, 0, 0, 0, 3],
        description: 'Open G major — Middle on low E (3), Index on A (2), Ring on high e (3)'
    },
    'd': {
        name: 'D',
        fullName: 'D Major',
        frets: [-1, -1, 0, 2, 3, 2],
        fingers: [0, 0, 0, 1, 3, 2],
        description: 'Open D major — Index on G (2), Ring on B (3), Middle on high e (2)'
    },
    'am': {
        name: 'Am',
        fullName: 'A Minor',
        frets: [-1, 0, 2, 2, 1, 0],
        fingers: [0, 0, 2, 3, 1, 0],
        description: 'Open A minor — Middle on D (2), Ring on G (2), Index on B (1)'
    },
    'e': {
        name: 'E',
        fullName: 'E Major',
        frets: [0, 2, 2, 1, 0, 0],
        fingers: [0, 2, 3, 1, 0, 0],
        description: 'Open E major — Middle on A (2), Ring on D (2), Index on G (1)'
    },
    'a': {
        name: 'A',
        fullName: 'A Major',
        frets: [-1, 0, 2, 2, 2, 0],
        fingers: [0, 0, 1, 2, 3, 0],
        description: 'Open A major — Index on D (2), Middle on G (2), Ring on B (2)'
    },
    'f': {
        name: 'F',
        fullName: 'F Major',
        frets: [1, 3, 3, 2, 1, 1],
        fingers: [1, 3, 4, 2, 1, 1],
        description: 'Barre F major — Index across fret 1, Ring on A (3), Pinky on D (3), Middle on G (2)'
    },
    'dm': {
        name: 'Dm',
        fullName: 'D Minor',
        frets: [-1, -1, 0, 2, 3, 1],
        fingers: [0, 0, 0, 2, 3, 1],
        description: 'Open D minor — Index on high e (1), Middle on G (2), Ring on B (3)'
    }
};

export class ThreeGuitarVisualizer {
    constructor(container) {
        this.container = container;
        this.audioCtx = null;
        this.soundEnabled = true;

        // Visualizer dimensions
        this.totalFrets = 15;
        this.neckLength = 22;
        this.neckWidthNut = 3.6;
        this.neckWidthEnd = 4.4;
        this.neckDepth = 0.5;

        // State
        this.currentChordKey = 'em';
        this.isStrumming = false;

        // String physical vibration simulation
        this.stringVibrations = [0, 0, 0, 0, 0, 0];
        this.stringDecays = [0.94, 0.94, 0.94, 0.95, 0.95, 0.96];
        this.stringPhases = [0, 0, 0, 0, 0, 0];

        // Three.js instances
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Object references
        this.stringsGroup = null;
        this.stringMeshes = [];
        this.chordMarkersGroup = null;
        this.nutGroup = null;
        this.fretPositions = [];
        this.stringXCoords = [];

        // Interactive mouse rotation / orbit
        this.isDragging = false;
        this.prevMousePos = { x: 0, y: 0 };
        this.cameraDistance = 16;
        this.cameraTheta = -Math.PI / 2.3; // Azimuth
        this.cameraPhi = Math.PI / 3.2;   // Elevation
        this.targetLookAt = new THREE.Vector3(0, 0, 4);

        this.init();
    }

    init() {
        // 1. Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e17);
        this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.015);

        // 2. Camera Setup
        const aspect = (this.container.clientWidth || 800) / (this.container.clientHeight || 400);
        this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
        this.updateCameraTransform();

        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(this.container.clientWidth || 800, this.container.clientHeight || 400);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        // Append canvas
        this.renderer.domElement.className = 'three-fretboard-canvas';
        this.container.appendChild(this.renderer.domElement);

        // 4. Studio Lighting
        this.setupLighting();

        // 5. Build 3D Guitar Neck & Components
        this.buildGuitarNeck();
        this.buildFrets();
        this.buildInlayDots();
        this.buildStrings();
        this.chordMarkersGroup = new THREE.Group();
        this.scene.add(this.chordMarkersGroup);

        // 6. Set initial chord markers
        this.setChord('em');

        // 7. Event Listeners
        this.setupEvents();

        // 8. Animation Loop
        this.clock = new THREE.Clock();
        this.animate = this.animate.bind(this);
        this.animate();
    }

    setupLighting() {
        // Ambient fill light (cool dark studio tone)
        const ambient = new THREE.AmbientLight(0x1e293b, 1.4);
        this.scene.add(ambient);

        // Key light: Warm studio amber top-down spotlight
        const keyLight = new THREE.DirectionalLight(0xfffaed, 2.8);
        keyLight.position.set(6, 12, 10);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        this.scene.add(keyLight);

        // Rim / Back light: Crisp electric cyan edge light
        const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.8);
        rimLight.position.set(-8, -4, -6);
        this.scene.add(rimLight);

        // Warm underside bounce light for guitar wood depth
        const woodGlow = new THREE.PointLight(0xd97706, 1.5, 25);
        woodGlow.position.set(0, -3, 8);
        this.scene.add(woodGlow);
    }

    // Procedural rosewood wood grain texture
    createWoodTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Base dark rosewood
        ctx.fillStyle = '#251610';
        ctx.fillRect(0, 0, 512, 1024);

        // Longitudinal wood grain stripes
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * 512;
            const width = Math.random() * 3 + 1;
            const alpha = Math.random() * 0.18 + 0.04;
            const dark = Math.random() > 0.4;
            ctx.fillStyle = dark ? `rgba(18, 9, 6, ${alpha})` : `rgba(62, 38, 25, ${alpha})`;
            ctx.fillRect(x, 0, width, 1024);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 2);
        return texture;
    }

    buildGuitarNeck() {
        const woodTex = this.createWoodTexture();

        // 3D Fretboard Top Board
        // Neck widens slightly from nut to 15th fret (perspective authentic)
        const neckGeom = new THREE.BoxGeometry(this.neckWidthEnd, this.neckDepth, this.neckLength);
        const fretboardMat = new THREE.MeshStandardMaterial({
            color: 0x2d1b14,
            roughness: 0.55,
            metalness: 0.1,
            map: woodTex
        });
        const fretboard = new THREE.Mesh(neckGeom, fretboardMat);
        fretboard.position.set(0, -this.neckDepth / 2, this.neckLength / 2);
        fretboard.receiveShadow = true;
        this.scene.add(fretboard);


        // Bone Nut at fret 0
        const nutGeom = new THREE.BoxGeometry(this.neckWidthNut + 0.1, 0.28, 0.35);
        const nutMat = new THREE.MeshStandardMaterial({
            color: 0xf5eedb,
            roughness: 0.35,
            metalness: 0.1
        });
        const nut = new THREE.Mesh(nutGeom, nutMat);
        nut.position.set(0, 0.12, 0);
        nut.castShadow = true;
        this.scene.add(nut);

        // Headstock Stub
        const headstockGeom = new THREE.BoxGeometry(this.neckWidthNut * 1.15, 0.35, 4.5);
        const headstockMat = new THREE.MeshStandardMaterial({
            color: 0x140d0a,
            roughness: 0.4
        });
        const headstock = new THREE.Mesh(headstockGeom, headstockMat);
        headstock.position.set(0, -0.15, -2.4);
        headstock.rotation.x = -0.12; // tilted headstock
        this.scene.add(headstock);
    }

    buildFrets() {
        const fretWireMat = new THREE.MeshStandardMaterial({
            color: 0xd6d9e0,
            metalness: 0.9,
            roughness: 0.25
        });

        // 12th fret rule: fret distance from nut = L * (1 - (1/2)^(fret/12))
        // Scale to fit this.neckLength across 15 frets
        const scaleLength = 32;
        this.fretPositions = [0]; // fret 0 is nut

        for (let f = 1; f <= this.totalFrets; f++) {
            const z = scaleLength * (1 - Math.pow(2, -f / 12));
            this.fretPositions.push(z);

            // Neck width at this z
            const t = z / this.neckLength;
            const currentWidth = THREE.MathUtils.lerp(this.neckWidthNut, this.neckWidthEnd, t);

            // Nickel fret wire
            const fretGeom = new THREE.CylinderGeometry(0.045, 0.045, currentWidth + 0.05, 12);
            const fretMesh = new THREE.Mesh(fretGeom, fretWireMat);
            fretMesh.rotation.z = Math.PI / 2;
            fretMesh.position.set(0, 0.035, z);
            fretMesh.castShadow = true;
            this.scene.add(fretMesh);
        }
    }

    buildInlayDots() {
        const pearlMat = new THREE.MeshStandardMaterial({
            color: 0xf3f4f6,
            roughness: 0.2,
            metalness: 0.35
        });

        // Standard dot frets: 3, 5, 7, 9, 12 (double), 15
        const singleDots = [3, 5, 7, 9, 15];
        const dotRadius = 0.16;

        singleDots.forEach(f => {
            if (f > this.totalFrets) return;
            const z = (this.fretPositions[f - 1] + this.fretPositions[f]) / 2;
            const dotGeom = new THREE.CylinderGeometry(dotRadius, dotRadius, 0.02, 16);
            const dot = new THREE.Mesh(dotGeom, pearlMat);
            dot.position.set(0, 0.005, z);
            this.scene.add(dot);
        });

        // 12th fret double dot
        if (this.totalFrets >= 12) {
            const z12 = (this.fretPositions[11] + this.fretPositions[12]) / 2;
            [-0.7, 0.7].forEach(offsetX => {
                const dotGeom = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16);
                const dot = new THREE.Mesh(dotGeom, pearlMat);
                dot.position.set(offsetX, 0.005, z12);
                this.scene.add(dot);
            });
        }
    }

    buildStrings() {
        this.stringsGroup = new THREE.Group();
        this.stringMeshes = [];

        // String thicknesses from Low E (6) to High e (1)
        const stringRadii = [0.075, 0.062, 0.05, 0.04, 0.032, 0.024];

        // String materials: Wound bronze for strings 0, 1, 2; Steel nickel for 3, 4, 5
        const bronzeMat = new THREE.MeshStandardMaterial({
            color: 0xc9944a,
            metalness: 0.85,
            roughness: 0.3
        });
        const steelMat = new THREE.MeshStandardMaterial({
            color: 0xd8dde6,
            metalness: 0.95,
            roughness: 0.2
        });

        const stringSpanNut = this.neckWidthNut * 0.75;
        const stringSpanEnd = this.neckWidthEnd * 0.78;

        for (let s = 0; s < 6; s++) {
            // String x position from Low E (left, s=0) to High e (right, s=5)
            const factor = s / 5; // 0 to 1
            const xNut = THREE.MathUtils.lerp(-stringSpanNut / 2, stringSpanNut / 2, factor);
            const xEnd = THREE.MathUtils.lerp(-stringSpanEnd / 2, stringSpanEnd / 2, factor);
            this.stringXCoords.push({ xNut, xEnd });

            // Create curved / multi-segment string for realistic vibration
            const segments = 40;
            const points = [];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const z = t * this.neckLength;
                const x = THREE.MathUtils.lerp(xNut, xEnd, t);
                const y = 0.16 + (s < 3 ? 0.02 : 0); // slightly higher off frets
                points.push(new THREE.Vector3(x, y, z));
            }

            const curve = new THREE.CatmullRomCurve3(points);
            const geom = new THREE.TubeGeometry(curve, segments, stringRadii[s], 8, false);
            const mat = s < 3 ? bronzeMat : steelMat;
            const mesh = new THREE.Mesh(geom, mat.clone());
            mesh.castShadow = true;
            mesh.userData = { stringIndex: s, basePoints: points, radius: stringRadii[s] };

            this.stringMeshes.push(mesh);
            this.stringsGroup.add(mesh);
        }

        this.scene.add(this.stringsGroup);
    }

    // Set and display 3D chord finger placement markers
    setChord(chordKey) {
        const key = (chordKey || 'em').toLowerCase();
        const chord = CHORD_LIBRARY[key] || CHORD_LIBRARY['em'];
        this.currentChordKey = key;

        // Clear existing markers
        while (this.chordMarkersGroup.children.length > 0) {
            const obj = this.chordMarkersGroup.children[0];
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            this.chordMarkersGroup.remove(obj);
        }

        // Add 3D markers for frets
        chord.frets.forEach((fret, stringIdx) => {
            if (fret === -1) {
                // Muted (X) at nut
                this.createMutedMarker(stringIdx);
            } else if (fret === 0) {
                // Open string (O) at nut
                this.createOpenMarker(stringIdx);
            } else if (fret > 0 && fret <= this.totalFrets) {
                // Finger marker on fretboard
                const fingerNum = chord.fingers[stringIdx] || 1;
                this.createFingerMarker(stringIdx, fret, fingerNum);
            }
        });
    }

    createFingerMarker(stringIdx, fret, fingerNum) {
        const markerGroup = new THREE.Group();

        // Calculate 3D position
        const zFretPrev = this.fretPositions[fret - 1];
        const zFretCur = this.fretPositions[fret];
        // Guitarists place finger slightly behind the fret wire (sweet spot)
        const z = zFretCur - (zFretCur - zFretPrev) * 0.32;

        const t = z / this.neckLength;
        const coords = this.stringXCoords[stringIdx];
        const x = THREE.MathUtils.lerp(coords.xNut, coords.xEnd, t);
        const y = 0.28;

        // Glowing 3D Sphere Marker
        const sphereGeom = new THREE.SphereGeometry(0.24, 20, 20);
        const sphereMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4, // Electric cyan
            emissive: 0x0284c7,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.6
        });
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        sphere.castShadow = true;
        markerGroup.add(sphere);

        // Golden Outer Pulsing Ring
        const ringGeom = new THREE.RingGeometry(0.28, 0.36, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b, // Warm gold
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.06;
        markerGroup.add(ring);

        // 3D Text / Number Badge Sprite
        const sprite = this.createNumberSprite(fingerNum);
        sprite.position.set(0, 0.42, 0);
        sprite.scale.set(0.65, 0.65, 1);
        markerGroup.add(sprite);

        markerGroup.position.set(x, y, z);
        markerGroup.userData = { isFingerMarker: true, stringIndex: stringIdx, fret };
        this.chordMarkersGroup.add(markerGroup);
    }

    createOpenMarker(stringIdx) {
        const coords = this.stringXCoords[stringIdx];
        const ringGeom = new THREE.TorusGeometry(0.16, 0.04, 12, 24);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x10b981, // Precision emerald
            emissive: 0x059669,
            emissiveIntensity: 0.6,
            roughness: 0.3
        });
        const marker = new THREE.Mesh(ringGeom, ringMat);
        marker.rotation.x = Math.PI / 2;
        marker.position.set(coords.xNut, 0.28, -0.4);
        this.chordMarkersGroup.add(marker);
    }

    createMutedMarker(stringIdx) {
        const coords = this.stringXCoords[stringIdx];
        const barGeom = new THREE.BoxGeometry(0.28, 0.05, 0.05);
        const barMat = new THREE.MeshStandardMaterial({
            color: 0xef4444, // Clean muted red
            emissive: 0xb91c1c,
            emissiveIntensity: 0.5
        });

        const bar1 = new THREE.Mesh(barGeom, barMat);
        bar1.rotation.y = Math.PI / 4;
        const bar2 = new THREE.Mesh(barGeom, barMat);
        bar2.rotation.y = -Math.PI / 4;

        const xGroup = new THREE.Group();
        xGroup.add(bar1);
        xGroup.add(bar2);
        xGroup.rotation.x = Math.PI / 2;
        xGroup.position.set(coords.xNut, 0.28, -0.4);
        this.chordMarkersGroup.add(xGroup);
    }

    createNumberSprite(num) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Draw pill badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(64, 64, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 64px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${num}`, 64, 66);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        return new THREE.Sprite(spriteMat);
    }

    // Web Audio Synthesizer: Realistic Acoustic Guitar Pluck
    pluckSound(stringIdx, fret = 0) {
        if (!this.soundEnabled) return;

        try {
            if (!this.audioCtx) {
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioCtxClass();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const now = this.audioCtx.currentTime;
            const baseFreq = BASE_FREQUENCIES[stringIdx] || 196.0;
            // Pitch increases by semitone 2^(fret/12)
            const frequency = baseFreq * Math.pow(2, Math.max(0, fret) / 12);

            // Rich acoustic synthesis using 3 harmonic oscillators + subtle pluck noise
            const gainNode = this.audioCtx.createGain();
            gainNode.connect(this.audioCtx.destination);

            // Amplitude envelope
            gainNode.gain.setValueAtTime(0.001, now);
            gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.008);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

            // Fundamental tone (Triangle/Sine)
            const osc1 = this.audioCtx.createOscillator();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(frequency, now);

            // 2nd Harmonic (Warm overtone)
            const osc2 = this.audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(frequency * 2, now);
            const osc2Gain = this.audioCtx.createGain();
            osc2Gain.gain.setValueAtTime(0.2, now);
            osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc2.connect(osc2Gain);
            osc2Gain.connect(gainNode);

            // 3rd Harmonic (Metallic brilliance)
            const osc3 = this.audioCtx.createOscillator();
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(frequency * 3, now);
            const osc3Gain = this.audioCtx.createGain();
            osc3Gain.gain.setValueAtTime(0.12, now);
            osc3Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc3.connect(osc3Gain);
            osc3Gain.connect(gainNode);

            // Lowpass filter simulating guitar body resonance
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3200, now);
            filter.frequency.exponentialRampToValueAtTime(600, now + 1.2);

            osc1.connect(filter);
            filter.connect(gainNode);

            osc1.start(now);
            osc2.start(now);
            osc3.start(now);
            osc1.stop(now + 1.8);
            osc2.stop(now + 1.8);
            osc3.stop(now + 1.8);
        } catch (e) {
            console.warn('Audio pluck error:', e);
        }
    }

    // Trigger physical 3D string vibration
    vibrateString(stringIdx, amplitude = 0.25) {
        if (stringIdx >= 0 && stringIdx < 6) {
            this.stringVibrations[stringIdx] = amplitude;
        }
    }

    // Interactive Strum: strum the entire chord from low string to high
    strum(direction = 'down') {
        const chord = CHORD_LIBRARY[this.currentChordKey] || CHORD_LIBRARY['em'];
        this.isStrumming = true;

        const strings = direction === 'down' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
        strings.forEach((sIdx, i) => {
            const fret = chord.frets[sIdx];
            if (fret === -1) return; // muted string not strummed

            setTimeout(() => {
                this.vibrateString(sIdx, 0.28);
                this.pluckSound(sIdx, fret);
            }, i * 38); // 38ms stagger between strings creates natural acoustic strum
        });

        setTimeout(() => {
            this.isStrumming = false;
        }, 300);
    }

    // Setup User Interaction & Events
    setupEvents() {
        const dom = this.renderer.domElement;

        // Mouse Drag to Rotate Fretboard in 3D
        dom.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.prevMousePos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        dom.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.prevMousePos.x;
                const deltaY = e.clientY - this.prevMousePos.y;

                this.cameraTheta -= deltaX * 0.008;
                this.cameraPhi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this.cameraPhi - deltaY * 0.008));

                this.prevMousePos = { x: e.clientX, y: e.clientY };
                this.updateCameraTransform();
            }
        });

        // Zoom with wheel
        dom.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + e.deltaY * 0.015, 6, 28);
            this.updateCameraTransform();
        }, { passive: false });

        // Click to pluck string or interactive marker
        dom.addEventListener('click', (e) => {
            const rect = dom.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.stringsGroup.children, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const sIdx = hit.object.userData.stringIndex;
                if (sIdx !== undefined) {
                    const chord = CHORD_LIBRARY[this.currentChordKey] || CHORD_LIBRARY['em'];
                    const fret = chord.frets[sIdx];
                    this.vibrateString(sIdx, 0.35);
                    this.pluckSound(sIdx, Math.max(0, fret));
                }
            }
        });

        // Resize handler
        window.addEventListener('resize', () => {
            this.resize();
        });
    }

    updateCameraTransform() {
        const x = this.targetLookAt.x + this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        const y = this.targetLookAt.y + this.cameraDistance * Math.cos(this.cameraPhi);
        const z = this.targetLookAt.z + this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.targetLookAt);
    }

    // Camera Presets
    setCameraPreset(preset) {
        if (preset === 'player') {
            // Looking down the fretboard as the player
            this.cameraDistance = 14;
            this.cameraTheta = -Math.PI / 2 + 0.15;
            this.cameraPhi = Math.PI / 4.5;
            this.targetLookAt.set(0, 0, 7);
        } else if (preset === 'front') {
            // Straight-on studio fretboard view
            this.cameraDistance = 15;
            this.cameraTheta = -Math.PI / 2;
            this.cameraPhi = Math.PI / 2.3;
            this.targetLookAt.set(0, 0.2, 5);
        } else {
            // Default angled showcase
            this.cameraDistance = 16;
            this.cameraTheta = -Math.PI / 2.3;
            this.cameraPhi = Math.PI / 3.2;
            this.targetLookAt.set(0, 0, 4);
        }
        this.updateCameraTransform();
    }

    resize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // Animation Loop
    animate() {
        this.animFrameId = requestAnimationFrame(this.animate);

        const time = this.clock.getElapsedTime();

        // 1. Animate String Vibrations
        this.stringMeshes.forEach((mesh, s) => {
            let vib = this.stringVibrations[s];
            if (vib > 0.001) {
                this.stringPhases[s] += 0.8;
                vib *= this.stringDecays[s];
                this.stringVibrations[s] = vib;

                // Modulate string curve vertices using sine standing wave
                const basePoints = mesh.userData.basePoints;
                const segments = basePoints.length - 1;
                const dynamicPoints = [];

                for (let i = 0; i <= segments; i++) {
                    const p = basePoints[i].clone();
                    // Standing wave nodes at nut (0) and bridge (1)
                    const normalizedZ = i / segments;
                    const standingWave = Math.sin(normalizedZ * Math.PI);
                    const displacement = Math.sin(this.stringPhases[s] * 8 + normalizedZ * 12) * vib * standingWave;

                    p.x += displacement * 0.15;
                    p.y += displacement * 0.25;
                    dynamicPoints.push(p);
                }

                const newCurve = new THREE.CatmullRomCurve3(dynamicPoints);
                mesh.geometry.dispose();
                mesh.geometry = new THREE.TubeGeometry(newCurve, segments, mesh.userData.radius, 8, false);
            }
        });

        // 2. Pulse 3D Chord Markers
        if (this.chordMarkersGroup) {
            this.chordMarkersGroup.children.forEach(group => {
                if (group.userData?.isFingerMarker) {
                    const pulse = 1 + Math.sin(time * 3.5) * 0.08;
                    group.scale.set(pulse, pulse, pulse);
                }
            });
        }

        // 3. Gentle ambient floating sway when not dragging
        if (!this.isDragging) {
            const ambientSway = Math.sin(time * 0.4) * 0.001;
            this.cameraTheta += ambientSway;
            this.updateCameraTransform();
        }

        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.renderer && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        if (this.audioCtx) {
            this.audioCtx.close();
        }
    }
}
