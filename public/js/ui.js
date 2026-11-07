'use strict';

// ─── Motion preference ────────────────────────────────────────────────────
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── SVG Icons ────────────────────────────────────────────────────────────
const SVG_ICONS = {
  spade: `<svg viewBox="0 0 20 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 1C10 1 2 7.5 2 13a5 5 0 006 4.9V20H8a1 1 0 000 2h4a1 1 0 000-2h-2v-2.1A5 5 0 0018 13c0-5.5-8-12-8-12z"/>
  </svg>`,
  heart: `<svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 17.5S2 12 2 6.5a4.5 4.5 0 019-0.5 4.5 4.5 0 019 .5C20 12 10 17.5 10 17.5z"/>
  </svg>`,
  diamond: `<svg viewBox="0 0 16 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1L15 10L8 19L1 10L8 1Z"/>
  </svg>`,
  club: `<svg viewBox="0 0 20 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 1a4 4 0 00-2 7.46A4 4 0 0010 16a4 4 0 002-7.54A4 4 0 0010 1z"/>
    <circle cx="5" cy="12" r="4"/>
    <circle cx="15" cy="12" r="4"/>
    <path d="M7 20h6M10 16v4"/>
  </svg>`,
  crown: `<svg viewBox="0 0 24 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 16L5 6L9 11L12 2L15 11L19 6L22 16H2Z"/>
    <rect x="1" y="16" width="22" height="2" rx="1"/>
    <circle cx="2" cy="6" r="2"/>
    <circle cx="12" cy="2" r="2"/>
    <circle cx="22" cy="6" r="2"/>
  </svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 3H3a2 2 0 000 4c0 3 2 5 4.5 6A6 6 0 0012 19v2H9a1 1 0 000 2h6a1 1 0 000-2h-3v-2a6 6 0 004.5-6C21 12 23 10 23 7a2 2 0 00-2-4h-2V3H5zm0 2V3-2h14v4c0 2.5-1.5 4.5-3.5 5.5A4 4 0 0112 17a4 4 0 01-3.5-6.5C6.5 9.5 5 7.5 5 5z"/>
  </svg>`,
  eye: `<svg viewBox="0 0 20 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 0C5.5 0 1 7 1 7s4.5 7 9 7 9-7 9-7S14.5 0 10 0zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zM10 5a2 2 0 100 4 2 2 0 000-4z"/>
  </svg>`,
};

function getSuitIcon(suit) {
  const map = { S: 'spade', H: 'heart', D: 'diamond', C: 'club' };
  return SVG_ICONS[map[suit]] || '';
}

// ─── Card SVG Renderer ────────────────────────────────────────────────────
/**
 * Create a card DOM element.
 * @param {string} rank
 * @param {string} suit
 * @param {boolean} faceDown
 * @param {boolean} small - use smaller sizing
 * @returns HTMLElement
 */
function createCardElement(rank, suit, faceDown = false, small = false) {
  const card = document.createElement('div');
  card.className = 'card' + (faceDown ? ' face-down' : '');
  card.setAttribute('aria-label', faceDown ? 'Face-down card' : `${rank} of ${suitName(suit)}`);

  // Front face
  const front = document.createElement('div');
  front.className = 'card-front';
  front.innerHTML = buildCardFront(rank, suit, small);

  // Back face
  const back = document.createElement('div');
  back.className = 'card-back';
  back.innerHTML = buildCardBack();

  card.appendChild(front);
  card.appendChild(back);
  return card;
}

function suitName(s) {
  return { S:'Spades', H:'Hearts', D:'Diamonds', C:'Clubs' }[s] || s;
}

function buildCardFront(rank, suit, small) {
  const isRed = suit === 'H' || suit === 'D';
  const color  = isRed ? '#c0392b' : '#1a1a2e';
  const rankFs = small ? 6 : (rank === '10' ? 10 : 12);
  const suitFs = small ? 5 : 8;

  // Compact path for each suit at a normalised 12×14 space
  const suitPaths = {
    S: `<path d="M6 1C6 1 1 5 1 8.5a3.1 3.1 0 003.8 3l-.3 1.8H3.5a.5.5 0 000 1h5a.5.5 0 000-1H7.2l-.3-1.8A3.1 3.1 0 0011 8.5C11 5 6 1 6 1z" fill="${color}"/>`,
    H: `<path d="M6 12.5S1 8.5 1 5a3 3 0 016-.5 3 3 0 016 .5c0 3.5-5 7.5-5 7.5z" fill="${color}"/>`,
    D: `<path d="M6 1L11 7L6 13L1 7Z" fill="${color}"/>`,
    C: `<path d="M6 1a2.2 2.2 0 00-1 4.2 2.2 2.2 0 000 3.8 2.2 2.2 0 00-2 2H4a.5.5 0 000 1h4a.5.5 0 000-1H6.8a2.2 2.2 0 00-2-2 2.2 2.2 0 000-3.8A2.2 2.2 0 006 1z" fill="${color}"/>`,
  };

  // Centre large suit icon (18×22 canvas)
  const centrePaths = {
    S: `<path d="M9 1C9 1 1 7.5 1 13a5 5 0 006 4.9V19H6a1 1 0 000 2h6a1 1 0 000-2h-1v-1.1A5 5 0 0017 13C17 7.5 9 1 9 1z" fill="${color}"/>`,
    H: `<path d="M9 18S1 12 1 6.5a4.5 4.5 0 019-0.4 4.5 4.5 0 019 .4C19 12 9 18 9 18z" fill="${color}"/>`,
    D: `<path d="M9 1L17 10L9 19L1 10Z" fill="${color}"/>`,
    C: `<path d="M9 1a4 4 0 00-1.5 7.7 4 4 0 000 6.6 4 4 0 00-3 3.7H5a1 1 0 000 2h8a1 1 0 000-2H10.5a4 4 0 00-3-3.7 4 4 0 000-6.6A4 4 0 009 1z" fill="${color}"/>`,
  };

  return `<svg width="100%" height="100%" viewBox="0 0 52 76" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <!-- Card background with subtle gradient -->
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fefdf5"/>
        <stop offset="100%" stop-color="#faf6e8"/>
      </linearGradient>
    </defs>
    <rect width="52" height="76" rx="6" fill="url(#cg)"/>

    <!-- Top-left rank + mini suit -->
    <text x="4" y="${rankFs + 2}" font-family="Georgia,Times New Roman,serif"
          font-size="${rankFs}" font-weight="800" fill="${color}">${rank}</text>
    <g transform="translate(3.5,${rankFs + 5}) scale(0.72)">
      <svg viewBox="0 0 12 14" width="12" height="14">${suitPaths[suit] || ''}</svg>
    </g>

    <!-- Centre suit -->
    <g transform="translate(8, 22)">
      <svg viewBox="0 0 18 22" width="36" height="32">${centrePaths[suit] || ''}</svg>
    </g>

    <!-- Bottom-right (rotated 180°) -->
    <g transform="rotate(180,26,38)">
      <text x="4" y="${rankFs + 2}" font-family="Georgia,Times New Roman,serif"
            font-size="${rankFs}" font-weight="800" fill="${color}">${rank}</text>
      <g transform="translate(3.5,${rankFs + 5}) scale(0.72)">
        <svg viewBox="0 0 12 14" width="12" height="14">${suitPaths[suit] || ''}</svg>
      </g>
    </g>
  </svg>`;
}

function buildCardBack() {
  return `<svg width="100%" height="100%" viewBox="0 0 52 76" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1b4a38"/>
        <stop offset="100%" stop-color="#0d2e20"/>
      </linearGradient>
      <pattern id="diag" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 8L8 0M-1 1L1-1M7 9L9 7" stroke="#2a6647" stroke-width="1" opacity="0.5"/>
      </pattern>
    </defs>
    <rect width="52" height="76" rx="6" fill="url(#bg)"/>
    <rect width="52" height="76" rx="6" fill="url(#diag)"/>
    <!-- Border -->
    <rect x="3" y="3" width="46" height="70" rx="4" fill="none" stroke="#2a6647" stroke-width="1.5" opacity="0.6"/>
    <rect x="6" y="6" width="40" height="64" rx="3" fill="none" stroke="#2a6647" stroke-width="0.8" opacity="0.3"/>
    <!-- Centre diamond logo -->
    <g transform="translate(26,38)">
      <path d="M0,-10 L7,0 L0,10 L-7,0 Z" fill="none" stroke="#f5c842" stroke-width="1.2" opacity="0.55"/>
      <path d="M0,-6 L4,0 L0,6 L-4,0 Z" fill="#f5c842" opacity="0.4"/>
    </g>
    <!-- Corner suit hints -->
    <text x="5" y="14" font-family="Georgia,serif" font-size="8" fill="#2a6647" opacity="0.6">♠</text>
    <g transform="rotate(180,26,38)">
      <text x="5" y="14" font-family="Georgia,serif" font-size="8" fill="#2a6647" opacity="0.6">♠</text>
    </g>
  </svg>`;
}

/**
 * Flip a card element from face-down to face-up.
 */
function flipCard(cardEl) {
  if (REDUCED_MOTION) {
    cardEl.classList.remove('face-down');
    return;
  }
  cardEl.style.transition = 'transform 0.45s cubic-bezier(.4,0,.2,1)';
  cardEl.classList.remove('face-down');
}

// ─── Toasts ───────────────────────────────────────────────────────────────
function showToast(message, duration = 3100) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ─── Screen Router ────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
    target.removeAttribute('aria-hidden');
  }
}

// ─── Chip animation ───────────────────────────────────────────────────────
function animateChipToPot(fromEl, potEl) {
  if (REDUCED_MOTION) return;
  const fromRect = fromEl.getBoundingClientRect();
  const potRect = potEl.getBoundingClientRect();

  const chip = document.createElement('div');
  chip.className = 'chip-anim';
  chip.style.left = `${fromRect.left + fromRect.width / 2 - 10}px`;
  chip.style.top  = `${fromRect.top  + fromRect.height / 2 - 10}px`;
  chip.style.setProperty('--tx', `${potRect.left + potRect.width / 2 - fromRect.left - fromRect.width / 2}px`);
  chip.style.setProperty('--ty', `${potRect.top  + potRect.height / 2 - fromRect.top  - fromRect.height / 2}px`);

  document.body.appendChild(chip);
  setTimeout(() => chip.remove(), 700);
}

// ─── Confetti ─────────────────────────────────────────────────────────────
function fireConfetti() {
  if (REDUCED_MOTION) return;
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const COLORS = ['#f0c040','#e74c3c','#3498db','#2ecc71','#9b59b6','#fff'];
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 40,
    r: 4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 8,
    life: 1,
  }));

  let frame;
  const start = Date.now();

  function draw() {
    const elapsed = Date.now() - start;
    if (elapsed > 3500) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06; // gravity
      p.rot += p.rotV;
      p.life = Math.max(0, 1 - Math.max(0, elapsed - 2500) / 1000);

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
      ctx.restore();
    }
    frame = requestAnimationFrame(draw);
  }
  draw();
}

// ─── Theme ────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('tp_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tp_theme', theme);
  // Update icons
  const dark = document.getElementById('theme-icon-dark');
  const light = document.getElementById('theme-icon-light');
  if (dark) dark.style.display = theme === 'dark' ? 'block' : 'none';
  if (light) light.style.display = theme === 'light' ? 'block' : 'none';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ─── Seat position calculator ─────────────────────────────────────────────
/**
 * Calculate positions for N seats around a circle.
 * Returns array of { left, top } as percentages of container.
 */
function getSeatPositions(n) {
  const positions = [];
  // Start from top, go clockwise
  const startAngle = -Math.PI / 2;
  const radius = 38; // % of container

  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI * i) / n;
    const left = 50 + radius * Math.cos(angle);
    const top  = 50 + radius * Math.sin(angle);
    positions.push({ left, top });
  }
  return positions;
}

// ─── Timer bar ────────────────────────────────────────────────────────────
let timerInterval = null;

function startTimerBar(seatEl, deadline) {
  const bar = seatEl.querySelector('.turn-timer-bar');
  if (!bar) return;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const remaining = deadline - Date.now();
    const total = 30_000;
    const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
    bar.style.width = pct + '%';
    bar.classList.toggle('warning', pct < 30);
    if (pct <= 0) clearInterval(timerInterval);
  }, 200);
}

function stopTimerBar() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// Export for other modules
window.UI = {
  REDUCED_MOTION,
  SVG_ICONS,
  getSuitIcon,
  createCardElement,
  flipCard,
  showToast,
  showScreen,
  animateChipToPot,
  fireConfetti,
  initTheme,
  toggleTheme,
  getSeatPositions,
  startTimerBar,
  stopTimerBar,
};
