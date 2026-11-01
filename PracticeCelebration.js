/**
 * PracticeCelebration.js
 * High-performance, audio-visual celebration system for Practice Session.
 * Renders colorful 3D-tumbling confetti, glowing stars, floating musical notes,
 * and energetic spark particles when the user plays the target chord correctly.
 */

const CELEBRATION_COLORS = [
  '#10b981', // emerald
  '#34d399', // bright mint
  '#06b6d4', // cyan
  '#22d3ee', // electric cyan
  '#f59e0b', // amber gold
  '#fbbf24', // yellow gold
  '#ec4899', // hot pink
  '#f43f5e', // coral rose
  '#a855f7', // neon purple
  '#818cf8', // indigo
  '#ffffff', // sparkle diamond
];

class ConfettiParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = (Math.PI * 2 * Math.random());
    const speed = Math.random() * 9 + 4;
    // Fountain arc bias: spray upwards & outwards
    this.vx = Math.cos(angle) * speed;
    this.vy = -Math.abs(Math.sin(angle)) * speed - (Math.random() * 6 + 3);

    this.type = Math.random() < 0.5 ? 'ribbon' : (Math.random() < 0.7 ? 'star' : (Math.random() < 0.9 ? 'dot' : 'note'));
    this.color = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];

    // Ribbon properties
    this.w = Math.random() * 10 + 6;
    this.h = Math.random() * 6 + 4;
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.25;
    this.flip = Math.random() * Math.PI * 2;
    this.flipSpeed = Math.random() * 0.18 + 0.08;

    // Star / Dot / Note properties
    this.size = Math.random() * 6 + 3;
    this.noteSymbol = Math.random() < 0.5 ? '♪' : '♫';

    this.gravity = 0.26;
    this.drag = 0.97;
    this.life = 1.0;
    this.decay = Math.random() * 0.015 + 0.012; // ~1.2s lifespan
  }

  update() {
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;

    this.rot += this.rotSpeed;
    this.flip += this.flipSpeed;
    this.life -= this.decay;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.life * 1.2));
    ctx.translate(this.x, this.y);

    if (this.type === 'ribbon') {
      ctx.rotate(this.rot);
      const scaleY = Math.cos(this.flip); // 3D tumble flip
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.w / 2, (-this.h / 2) * scaleY, this.w, this.h * Math.abs(scaleY));
    } else if (this.type === 'star') {
      ctx.rotate(this.rot);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      drawStar(ctx, 0, 0, 4, this.size, this.size * 0.4);
      ctx.fill();
    } else if (this.type === 'note') {
      ctx.font = `bold ${Math.round(this.size * 2.8)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.noteSymbol, 0, 0);
    } else {
      // Glowing circular spark
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

export class PracticeCelebration {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.badge = null;
    this.particles = [];
    this.animId = null;
    this._dpr = window.devicePixelRatio || 1;
  }

  /**
   * Bind DOM elements for the practice canvas & match badge
   */
  init(canvasEl, badgeEl) {
    this.canvas = canvasEl;
    this.badge = badgeEl;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this._dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(100, Math.floor(rect.width * this._dpr));
    this.canvas.height = Math.max(100, Math.floor(rect.height * this._dpr));
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this._dpr, this._dpr);
    }
  }

  /**
   * Trigger a burst of colorful celebration particles & badge
   * @param {string} chord — e.g. 'Em'
   */
  trigger(chord = '') {
    if (!this.canvas || !this.ctx) return;
    this.resize();

    const rect = this.canvas.getBoundingClientRect();
    // Origin: center horizontally, slightly above middle (near chord name)
    const originX = rect.width * 0.5;
    const originY = rect.height * 0.38;

    // Spawn 70 multi-colored festive particles
    const count = 75;
    for (let i = 0; i < count; i++) {
      this.particles.push(new ConfettiParticle(originX, originY));
    }

    // Trigger floating badge animation
    if (this.badge) {
      const compliments = ['PERFECT!', 'CLEAN HIT!', 'EXCELLENT!', 'SPOT ON!'];
      const text = compliments[Math.floor(Math.random() * compliments.length)];
      this.badge.textContent = `✨ ${chord ? chord + ' ' : ''}${text} 🎸`;
      this.badge.classList.remove('animate');
      void this.badge.offsetWidth; // force CSS reflow
      this.badge.classList.add('animate');
    }

    // Start render loop if idle
    if (!this.animId) {
      this._loop = this._loop.bind(this);
      this.animId = requestAnimationFrame(this._loop);
    }
  }

  _loop() {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      p.draw(this.ctx);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(this._loop);
    } else {
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.animId = null;
    }
  }
}
