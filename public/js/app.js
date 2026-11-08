'use strict';

// ─── Shared app state ─────────────────────────────────────────────────────
window.App = {
  socket: null,
  myToken: null,
  myName: null,
  myCards: null,
  roomCode: null,
  isHost: false,
  snapshot: null,  // latest RoomSnapshot
};

// ─── Token management ──────────────────────────────────────────────────────
function getStoredToken() { return localStorage.getItem('tp_token'); }
function storeToken(t) { localStorage.setItem('tp_token', t); }

// ─── Socket connection ────────────────────────────────────────────────────
function initSocket() {
  const socket = io({ autoConnect: true, reconnectionDelay: 1000 });
  App.socket = socket;

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    UI.setConnDot('green');
    document.getElementById('server-waking')?.style && (document.getElementById('server-waking').style.display = 'none');
    const token = getStoredToken();
    const code  = localStorage.getItem('tp_room');
    const name  = localStorage.getItem('tp_name');
    if (token && code) {
      socket.emit('room:join', { code, name: name || 'Player', token });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    UI.setConnDot('amber');
  });

  socket.on('connect_error', () => {
    UI.setConnDot('red');
  });

  socket.on('error', ({ message }) => {
    UI.showToast('Error: ' + message);
    console.warn('Server error:', message);
    // Clear stale session if room not found
    if (message === 'Room not found') {
      localStorage.removeItem('tp_token');
      localStorage.removeItem('tp_room');
      App.myToken = null;
      App.roomCode = null;
      UI.showScreen('screen-lobby');
    }
  });

  // ── Room events ──────────────────────────────────────────────────────
  socket.on('room:joined', ({ token, code, isHost, isReconnect }) => {
    App.myToken = token;
    App.roomCode = code;
    App.isHost = isHost;
    storeToken(token);
    localStorage.setItem('tp_room', code);
    localStorage.setItem('tp_name', App.myName || localStorage.getItem('tp_name') || 'Player');

    if (isReconnect) {
      UI.showToast('Reconnected to room ' + code);
      // If there's an active game, show game screen; snapshot will arrive shortly
    } else {
      // Show waiting room — snapshot will update it
      UI.showScreen('screen-room');
      window.location.hash = 'room';
    }
  });

  socket.on('room:state', (snapshot) => {
    App.snapshot = snapshot;
    App.isHost = snapshot.players.some(p => p.token === App.myToken && p.isHost);

    const gameScreenActive = document.getElementById('screen-game').classList.contains('active');

    if (snapshot.status === 'playing') {
      // Game in progress — show game screen
      if (!gameScreenActive) {
        UI.showScreen('screen-game');
        window.location.hash = 'game';
        // Reset my cards display on fresh round
        App.myCards = null;
      }
      if (typeof Game !== 'undefined') Game.update(snapshot);
    } else if (snapshot.status === 'lobby' && gameScreenActive) {
      // Round ended but stay on game screen to show next-round button
      if (typeof Game !== 'undefined') Game.update(snapshot);
    } else {
      // Lobby (waiting room) or just joined
      UI.showScreen('screen-room');
      window.location.hash = 'room';
      if (typeof Room !== 'undefined') Room.update(snapshot);
    }

    // Always update scoreboard
    if (typeof Scoreboard !== 'undefined') Scoreboard.update(snapshot);
  });

  socket.on('player:cards', ({ cards }) => {
    App.myCards = cards;
    if (typeof Game !== 'undefined') Game.setMyCards(cards);
  });

  socket.on('game:event', (ev) => {
    if (typeof Game !== 'undefined') Game.handleEvent(ev);
  });

  socket.on('game:roundEnd', (result) => {
    if (typeof Game !== 'undefined') Game.handleRoundEnd(result);
    if (typeof Scoreboard !== 'undefined') Scoreboard.handleRoundEnd(result);
  });

  socket.on('game:ended', (payload) => {
    // Save to localStorage
    const record = {
      date:        new Date(payload.endedAt).toISOString(),
      rounds:      payload.totalRounds,
      code:        payload.code,
      pointMode:   payload.settings.pointMode,
      standings:   payload.standings.map(s => ({ name: s.name, chips: s.chips, netChips: s.netChips, points: s.points })),
    };
    const past = JSON.parse(localStorage.getItem('tp_past_games') || '[]');
    past.push(record);
    if (past.length > 20) past.splice(0, past.length - 20);
    localStorage.setItem('tp_past_games', JSON.stringify(past));

    // Clear session so reconnect doesn't kick back to old room
    localStorage.removeItem('tp_token');
    localStorage.removeItem('tp_room');

    // Show results screen
    if (typeof Results !== 'undefined') Results.show(payload);
    UI.showScreen('screen-results');
  });
}

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();

  // Theme toggles
  document.getElementById('theme-toggle').addEventListener('click', UI.toggleTheme);
  document.getElementById('theme-toggle-2').addEventListener('click', UI.toggleTheme);

  // Scoreboard
  document.getElementById('btn-scoreboard').addEventListener('click', () => {
    document.getElementById('scoreboard-overlay').classList.add('open');
  });
  document.getElementById('btn-close-scoreboard').addEventListener('click', () => {
    document.getElementById('scoreboard-overlay').classList.remove('open');
  });

  initSocket();

  // FIX #17: show waking notice after 3s if still not connected
  setTimeout(() => {
    const w = document.getElementById('server-waking');
    if (w && !App.socket?.connected) w.style.display = 'block';
  }, 3000);

  // Show lobby
  UI.showScreen('screen-lobby');
  window.location.hash = '';
});
