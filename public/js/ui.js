'use strict';

// ─── Motion preference ────────────────────────────────────────────────────
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── SVG Icons ────────────────────────────────────────────────────────────
// All inline SVG, no emoji (FIX #19)
const SVG_ICONS = {
  spade: `<svg viewBox="0 0 20 22" fill="currentColor"><path d="M10 1C10 1 2 7.5 2 13a5 5 0 006 4.9V19H6a1 1 0 000 2h8a1 1 0 000-2h-2v-1.1A5 5 0 0018 13C18 7.5 10 1 10 1z"/></svg>`,
  heart: `<svg viewBox="0 0 20 18" fill="currentColor"><path d="M10 17S1 11 1 6a5 5 0 019-3 5 5 0 019 3c0 5-9 11-9 11z"/></svg>`,
  diamond: `<svg viewBox="0 0 14 20" fill="currentColor"><path d="M7 1L13 10L7 19L1 10Z"/></svg>`,
  club: `<svg viewBox="0 0 20 22" fill="currentColor"><path d="M10 1a4 4 0 100 8 4 4 0 100 8 4 4 0 00-3 3H6a1 1 0 000 2h8a1 1 0 000-2h-1a4 4 0 00-3-3 4 4 0 100-8A4 4 0 0010 1z"/></svg>`,
  eye_open: `<svg viewBox="0 0 20 14" fill="currentColor"><path d="M10 0C5.5 0 1 7 1 7s4.5 7 9 7 9-7 9-7S14.5 0 10 0zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zM10 5a2 2 0 100 4 2 2 0 000-4z"/></svg>`,
  eye_closed: `<svg viewBox="0 0 20 16" fill="currentColor"><path d="M2 2l16 12M4.5 4.5C2.5 6 1 8 1 8s4.5 7 9 7c1.8 0 3.4-.6 4.8-1.5M8 5.3A4.5 4.5 0 0114.7 12M7 3.2C8 2.7 9 2 10 2c4.5 0 9 5 9 7s-1.5 4-3.5 5.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  crown: `<svg viewBox="0 0 24 18" fill="currentColor"><path d="M2 16L5 6L9 11L12 2L15 11L19 6L22 16H2Z"/><rect x="1" y="16" width="22" height="2" rx="1"/><circle cx="2" cy="6" r="2"/><circle cx="12" cy="2" r="2"/><circle cx="22" cy="6" r="2"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 21h8M12 17v4M5 3H3a2 2 0 000 4c0 3.3 2 6 5 7a6 6 0 004 4 6 6 0 004-4c3-1 5-3.7 5-7a2 2 0 00-2-4h-2V3H5z"/><path d="M3 7h2M19 7h2"/></svg>`,
};

// ─── FIX #4: Card SVG with correct layout ─────────────────────────────────
//
// Standard playing card layout:
//   top-left:     rank + small suit (right-side-up)
//   centre:       large suit symbol
//   bottom-right: rank + small suit (rotated 180°)
//
// The old code rotated the bottom-left corner which mirrored it incorrectly.
// Now: only bottom-RIGHT is rotated 180° around the card centre.

function buildCardFront(rank, suit) {
  const isRed  = suit === 'H' || suit === 'D';
  const color  = isRed ? '#c8272d' : '#1a1a2e';
  const rankFs = rank === '10' ? 9.5 : 11;

  // Corner mini suit paths (12×14 viewBox)
  const mini = {
    S: `<path d="M6 1C6 1 1 5 1 8.5a3 3 0 003.8 3l-.3 1.8H3.5a.5.5 0 000 1h5a.5.5 0 000-1H7.2l-.3-1.8A3 3 0 0011 8.5C11 5 6 1 6 1z" fill="${color}"/>`,
    H: `<path d="M6 12S1 8 1 5a3 3 0 016-.5A3 3 0 0111 5c0 3-5 7-5 7z" fill="${color}"/>`,
    D: `<path d="M6 1L11 7L6 13L1 7Z" fill="${color}"/>`,
    C: `<path d="M6 1a2.2 2.2 0 00-1 4.2 2.2 2.2 0 000 3.8 2.2 2.2 0 00-2 2H4a.5.5 0 000 1h4a.5.5 0 000-1H6.8a2.2 2.2 0 00-2-2 2.2 2.2 0 000-3.8A2.2 2.2 0 006 1z" fill="${color}"/>`,
  };

  // Centre large suit paths (18×22 viewBox)
  const large = {
    S: `<path d="M9 1C9 1 1 7.5 1 13a5 5 0 006 4.9V19H6a1 1 0 000 2h6a1 1 0 000-2h-1v-1.1A5 5 0 0017 13C17 7.5 9 1 9 1z" fill="${color}"/>`,
    H: `<path d="M9 18S1 12 1 6.5A4.5 4.5 0 019.5 6 4.5 4.5 0 0117 6.5C17 12 9 18 9 18z" fill="${color}"/>`,
    D: `<path d="M9 1L17 10L9 19L1 10Z" fill="${color}"/>`,
    C: `<path d="M9 1a4 4 0 00-1.5 7.7 4 4 0 000 6.6 4 4 0 00-3 3.7H5a1 1 0 000 2h8a1 1 0 000-2H10.5a4 4 0 00-3-3.7 4 4 0 000-6.6A4 4 0 009 1z" fill="${color}"/>`,
  };

  // Card width=56 height=80 → centre = (28,40)
  return `<svg width="100%" height="100%" viewBox="0 0 56 80" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs>
      <linearGradient id="cfg" x1="0" y1="0" x2=".6" y2="1">
        <stop offset="0%" stop-color="#fefdf5"/>
        <stop offset="100%" stop-color="#faf6e6"/>
      </linearGradient>
    </defs>
    <rect width="56" height="80" rx="6" fill="url(#cfg)"/>

    <!-- TOP-LEFT: rank + mini suit (right-side-up) -->
    <text x="4" y="${rankFs + 2}"
          font-family="Georgia,'Times New Roman',serif"
          font-size="${rankFs}" font-weight="700" fill="${color}">${rank}</text>
    <g transform="translate(3,${rankFs + 4}) scale(0.68)">
      <svg viewBox="0 0 12 14" width="12" height="14">${mini[suit] || ''}</svg>
    </g>

    <!-- CENTRE: large suit -->
    <g transform="translate(10,22)">
      <svg viewBox="0 0 18 22" width="36" height="36">${large[suit] || ''}</svg>
    </g>

    <!-- BOTTOM-RIGHT: rotated 180° around card centre (28,40) -->
    <g transform="rotate(180,28,40)">
      <text x="4" y="${rankFs + 2}"
            font-family="Georgia,'Times New Roman',serif"
            font-size="${rankFs}" font-weight="700" fill="${color}">${rank}</text>
      <g transform="translate(3,${rankFs + 4}) scale(0.68)">
        <svg viewBox="0 0 12 14" width="12" height="14">${mini[suit] || ''}</svg>
      </g>
    </g>
  </svg>`;
}

function buildCardBack() {
  return `<svg width="100%" height="100%" viewBox="0 0 56 80" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <defs>
      <linearGradient id="cbg2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1b4a38"/>
        <stop offset="100%" stop-color="#0d2d1e"/>
      </linearGradient>
      <pattern id="diag2" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 8L8 0M-1 1L1-1M7 9L9 7" stroke="#2a6647" stroke-width="1" opacity="0.5"/>
      </pattern>
    </defs>
    <rect width="56" height="80" rx="6" fill="url(#cbg2)"/>
    <rect width="56" height="80" rx="6" fill="url(#diag2)"/>
    <rect x="3" y="3" width="50" height="74" rx="4" fill="none" stroke="#2a6647" stroke-width="1.5" opacity="0.55"/>
    <g transform="translate(28,40)">
      <path d="M0,-9 L6,0 L0,9 L-6,0 Z" fill="none" stroke="#f0c040" stroke-width="1.2" opacity="0.5"/>
      <path d="M0,-5 L3.5,0 L0,5 L-3.5,0 Z" fill="#f0c040" opacity="0.38"/>
    </g>
  </svg>`;
}

// Mini card back for opponent seats
function buildMiniCardBack() {
  return `<svg width="100%" height="100%" viewBox="0 0 16 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="mp" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
        <path d="M0 4L4 0M-1 1L1-1M3 5L5 3" stroke="#2a6647" stroke-width=".8" opacity="0.5"/>
      </pattern>
    </defs>
    <rect width="16" height="24" rx="2" fill="#1a4a38"/>
    <rect width="16" height="24" rx="2" fill="url(#mp)"/>
    <rect x="1" y="1" width="14" height="22" rx="1.5" fill="none" stroke="#2a6647" stroke-width=".8" opacity="0.5"/>
  </svg>`;
}

/**
 * Create a card DOM element.
 * FIX #4: correct card layout, both sides in 3D flip structure.
 */
function createCardElement(rank, suit, faceDown = false) {
  const card = document.createElement('div');
  card.className = 'card' + (faceDown ? ' face-down' : '');
  card.setAttribute('aria-label', faceDown ? 'Face-down card' : `${rank} of ${_suitName(suit)}`);

  const front = document.createElement('div');
  front.className = 'card-front';
  front.innerHTML = buildCardFront(rank, suit);

  const back = document.createElement('div');
  back.className = 'card-back';
  back.innerHTML = buildCardBack();

  card.appendChild(front);
  card.appendChild(back);
  return card;
}

// Mini card element for opponent seats
function createMiniCardBack() {
  const el = document.createElement('div');
  el.className = 'mini-card';
  el.innerHTML = buildMiniCardBack();
  return el;
}

function _suitName(s) {
  return { S:'Spades', H:'Hearts', D:'Diamonds', C:'Clubs' }[s] || s;
}

/**
 * Flip a card from face-down to face-up with CSS 3D transition.
 */
function flipCard(cardEl) {
  if (REDUCED_MOTION) { cardEl.classList.remove('face-down'); return; }
  cardEl.style.transition = 'transform 0.42s cubic-bezier(.4,0,.2,1)';
  cardEl.classList.remove('face-down');
}

// ─── FIX #2: Toasts ───────────────────────────────────────────────────────
function showToast(message, duration = 3000) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => t.remove(), duration + 300);
}

// ─── FIX #12: Action log (last 3 events) ─────────────────────────────────
const _logEntries = [];
function addActionLog(message) {
  const log = document.getElementById('action-log');
  if (!log) return;
  _logEntries.push(message);
  if (_logEntries.length > 3) _logEntries.shift();

  log.innerHTML = '';
  _logEntries.forEach(msg => {
    const el = document.createElement('div');
    el.className = 'action-log-entry';
    el.textContent = msg;
    log.appendChild(el);
  });
}
function clearActionLog() {
  _logEntries.length = 0;
  const log = document.getElementById('action-log');
  if (log) log.innerHTML = '';
}

// ─── Screen router ────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  const t = document.getElementById(id);
  if (t) { t.classList.add('active'); t.removeAttribute('aria-hidden'); }
}

// ─── FIX #18: Chip animation ──────────────────────────────────────────────
function animateChipToPot(fromEl, potEl) {
  if (REDUCED_MOTION) return;
  const fr = fromEl.getBoundingClientRect();
  const pr = potEl.getBoundingClientRect();

  const chip = document.createElement('div');
  chip.className = 'chip-anim';
  chip.style.left = `${fr.left + fr.width / 2 - 9}px`;
  chip.style.top  = `${fr.top  + fr.height / 2 - 9}px`;
  chip.style.setProperty('--tx', `${pr.left + pr.width / 2 - fr.left - fr.width / 2}px`);
  chip.style.setProperty('--ty', `${pr.top  + pr.height / 2 - fr.top  - fr.height / 2}px`);
  document.body.appendChild(chip);
  setTimeout(() => chip.remove(), 600);
}

// ─── FIX #18: Confetti ────────────────────────────────────────────────────
function fireConfetti() {
  if (REDUCED_MOTION) return;
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const COLORS = ['#f0c040','#e74c3c','#3498db','#2ecc71','#9b59b6','#fff'];
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 40,
    r: 4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - .5) * 4.5,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    rotV: (Math.random() - .5) * 9,
    life: 1,
  }));

  const start = Date.now();
  function draw() {
    const elapsed = Date.now() - start;
    if (elapsed > 3600) { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; return; }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += .06; p.rot += p.rotV;
      p.life = Math.max(0, 1 - Math.max(0, elapsed - 2600) / 1000);
      ctx.save(); ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*.55);
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ─── FIX #16: Haptic ─────────────────────────────────────────────────────
function haptic(ms = 40) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
}

// ─── Theme ────────────────────────────────────────────────────────────────
function initTheme() { applyTheme(localStorage.getItem('tp_theme') || 'dark'); }

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tp_theme', theme);
  const d = document.getElementById('theme-icon-dark');
  const l = document.getElementById('theme-icon-light');
  if (d) d.style.display = theme === 'dark'  ? 'block' : 'none';
  if (l) l.style.display = theme === 'light' ? 'block' : 'none';
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ─── Seat positions ────────────────────────────────────────────────────────
function getSeatPositions(n) {
  const positions = [];
  const startAngle = -Math.PI / 2;
  const radius = 38;
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI * i) / n;
    positions.push({
      left: 50 + radius * Math.cos(angle),
      top:  50 + radius * Math.sin(angle),
    });
  }
  return positions;
}

// ─── SVG timer ring ────────────────────────────────────────────────────────
let _timerInterval = null;

function startTimerRing(seatEl, deadline) {
  const bar = seatEl.querySelector('.timer-ring-bar');
  if (!bar) return;
  if (_timerInterval) clearInterval(_timerInterval);

  const sz = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--seat-sz')) || 60;
  const r  = (sz / 2) + 4;                  // radius of the ring
  const c  = 2 * Math.PI * r;
  bar.style.strokeDasharray = c;

  _timerInterval = setInterval(() => {
    const remaining = deadline - Date.now();
    const pct = Math.max(0, Math.min(1, remaining / 30_000));
    bar.style.strokeDashoffset = c * (1 - pct);
    bar.classList.toggle('warn', pct < 0.30);
    if (pct <= 0) clearInterval(_timerInterval);
  }, 250);
}

function stopTimerRing() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

// Legacy alias used by older code paths
function startTimerBar(seatEl, deadline) { startTimerRing(seatEl, deadline); }
function stopTimerBar() { stopTimerRing(); }

// ─── FIX #17: Connection dot ──────────────────────────────────────────────
function setConnDot(state) {
  // state: 'green' | 'amber' | 'red'
  const d = document.getElementById('conn-dot');
  if (!d) return;
  d.className = 'conn-dot' + (state !== 'green' ? ' ' + state : '');
}

// Export
window.UI = {
  REDUCED_MOTION,
  SVG_ICONS,
  buildCardFront,
  buildCardBack,
  buildMiniCardBack,
  createCardElement,
  createMiniCardBack,
  flipCard,
  showToast,
  addActionLog,
  clearActionLog,
  showScreen,
  animateChipToPot,
  fireConfetti,
  haptic,
  initTheme,
  applyTheme,
  toggleTheme,
  getSeatPositions,
  startTimerBar,
  stopTimerBar,
  startTimerRing,
  stopTimerRing,
  setConnDot,
};
