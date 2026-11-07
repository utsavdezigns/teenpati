'use strict';

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const {
  createRoom, joinRoom, leaveRoom, getRoom,
  getRoomBySocket, updateSettings, buildSnapshot, getRoomsMap,
} = require('./roomManager');

const {
  startRound, processAction, getCurrentPlayerToken,
  setTurnTimer, clearTurnTimer, initPlayerCount, TURN_TIMEOUT_MS,
} = require('./gameEngine');

// ─────────────────────────────────────────────
// CORS origins
// ─────────────────────────────────────────────
const DEFAULT_ORIGINS = [
  'https://teenpati.utsavtripathi.com.np',
  'https://utsavtripathi.com.np',
  'http://localhost:3000',
];

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : DEFAULT_ORIGINS;

// ─────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────
const app = express();

// Trust Render's (and any CDN/proxy) X-Forwarded-* headers
app.set('trust proxy', 1);

// ── Health check (Render pings this) ──────────
app.get('/health', (_req, res) => res.status(200).send('ok'));

// ── Static frontend ───────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── SPA fallback ──────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─────────────────────────────────────────────
// HTTP server + Socket.IO
// ─────────────────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  // Allow both WebSocket and long-polling so Render's proxy
  // doesn't drop connections that can't upgrade immediately.
  transports: ['websocket', 'polling'],

  // Keep mobile connections alive on flaky networks.
  pingInterval: 25_000,   // server pings client every 25 s
  pingTimeout:  60_000,   // wait 60 s for pong before disconnect

  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function broadcastSnapshot(room) {
  io.to(room.code).emit('room:state', buildSnapshot(room));
}

function emitError(socket, message) {
  socket.emit('error', { message });
}

// ─────────────────────────────────────────────
// Turn timeout (auto-pack on inactivity)
// ─────────────────────────────────────────────
function handleTurnTimeout(room, gs) {
  if (!room.gameState || room.gameState !== gs) return;

  const token = getCurrentPlayerToken(gs);

  try {
    const result = processAction(room, token, 'pack');
    io.to(room.code).emit('game:event', { type: 'autoPack', data: { token } });

    for (const ev of result.events) {
      io.to(room.code).emit('game:event', ev);
    }

    if (result.roundEnd) {
      io.to(room.code).emit('game:roundEnd', result.roundEnd);
    }

    broadcastSnapshot(room);

    if (!result.roundEnd && room.gameState) {
      room._onTurnTimeout = handleTurnTimeout;
      setTurnTimer(room, room.gameState);
    }
  } catch (err) {
    console.error('Auto-pack error:', err.message);
  }
}

// ─────────────────────────────────────────────
// Socket.IO event handlers
// ─────────────────────────────────────────────
io.on('connection', (socket) => {

  // ── Create room ───────────────────────────────
  socket.on('room:create', ({ name, settings } = {}) => {
    try {
      const { room, token } = createRoom(socket.id, name, settings);
      room._onTurnTimeout = handleTurnTimeout;
      socket.join(room.code);
      socket.emit('room:joined', { token, code: room.code, isHost: true });
      broadcastSnapshot(room);
    } catch (err) { emitError(socket, err.message); }
  });

  // ── Join / reconnect room ─────────────────────
  socket.on('room:join', ({ code, name, token: existingToken } = {}) => {
    try {
      const { room, player, token, isReconnect } = joinRoom(socket.id, code, name, existingToken);
      room._onTurnTimeout = handleTurnTimeout;
      socket.join(room.code);
      socket.emit('room:joined', {
        token, code: room.code,
        isHost: player.token === room.hostToken,
        isReconnect,
      });

      if (isReconnect && room.gameState && room.gameState.hands.has(token)) {
        socket.emit('player:cards', { cards: room.gameState.hands.get(token) });
      }

      broadcastSnapshot(room);
    } catch (err) { emitError(socket, err.message); }
  });

  // ── Update settings ───────────────────────────
  socket.on('room:settings', ({ code, settings, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room) return emitError(socket, 'Room not found');
      updateSettings(room, settings, token);
      broadcastSnapshot(room);
    } catch (err) { emitError(socket, err.message); }
  });

  // ── Start game ────────────────────────────────
  socket.on('game:start', ({ code, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)                       return emitError(socket, 'Room not found');
      if (room.hostToken !== token)    return emitError(socket, 'Only host can start');
      if (room.players.size < 2)       return emitError(socket, 'Need at least 2 players');

      const hands = startRound(room);
      initPlayerCount(room.gameState);
      room._onTurnTimeout = handleTurnTimeout;

      for (const [pToken, cards] of hands.entries()) {
        const p = room.players.get(pToken);
        if (p?.socketId) io.to(p.socketId).emit('player:cards', { cards });
      }

      io.to(room.code).emit('game:event', {
        type: 'roundStart',
        data: {
          roundNumber:   room.gameState.roundNumber,
          activePlayers: room.gameState.activePlayers,
          pot:           room.gameState.pot,
        },
      });

      broadcastSnapshot(room);
      setTurnTimer(room, room.gameState);
    } catch (err) { emitError(socket, err.message); }
  });

  // ── End game (host) ───────────────────────────
  socket.on('game:end', ({ code, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)                       return emitError(socket, 'Room not found');
      if (room.hostToken !== token)    return emitError(socket, 'Only host can end the game');
      if (room.status === 'playing')   return emitError(socket, 'Finish the current round first');

      room.status = 'ended';

      const standings = [...room.players.values()]
        .map(p => ({
          token:       p.token,
          name:        p.name,
          avatarColor: p.avatarColor,
          chips:       p.chips,
          points:      p.points,
          netChips:    p.chips - 1000,
        }))
        .sort((a, b) => b.chips - a.chips);

      const roundSummary = room.roundHistory.slice(-50).map(r => ({
        roundNumber:    r.roundNumber,
        winnerToken:    r.winnerToken,
        winnerName:     room.players.get(r.winnerToken)?.name || 'Unknown',
        pot:            r.pot,
        handCategories: r.handCategories || {},
      }));

      io.to(room.code).emit('game:ended', {
        code,
        standings,
        roundSummary,
        totalRounds: room.roundNumber,
        settings:    room.settings,
        endedAt:     Date.now(),
      });

      setTimeout(() => { try { getRoomsMap().delete(code); } catch {} }, 5 * 60 * 1000);
    } catch (err) { emitError(socket, err.message); }
  });

  // ── Next round ────────────────────────────────
  socket.on('game:nextRound', ({ code, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)                       return emitError(socket, 'Room not found');
      if (room.hostToken !== token)    return emitError(socket, 'Only host can start next round');
      if (room.status !== 'lobby')     return emitError(socket, 'Round still in progress');

      const hands = startRound(room);
      initPlayerCount(room.gameState);
      room._onTurnTimeout = handleTurnTimeout;

      for (const [pToken, cards] of hands.entries()) {
        const p = room.players.get(pToken);
        if (p?.socketId) io.to(p.socketId).emit('player:cards', { cards });
      }

      io.to(room.code).emit('game:event', {
        type: 'roundStart',
        data: {
          roundNumber:   room.gameState.roundNumber,
          activePlayers: room.gameState.activePlayers,
          pot:           room.gameState.pot,
        },
      });

      broadcastSnapshot(room);
      setTurnTimer(room, room.gameState);
    } catch (err) { emitError(socket, err.message); }
  });

  // ── Player action ─────────────────────────────
  socket.on('game:action', ({ code, token, type } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)            return emitError(socket, 'Room not found');
      if (!room.gameState)  return emitError(socket, 'No game in progress');

      const result = processAction(room, token, type);

      for (const ev of result.events) {
        io.to(room.code).emit('game:event', ev);
      }

      if (result.roundEnd) {
        io.to(room.code).emit('game:roundEnd', result.roundEnd);
      }

      broadcastSnapshot(room);

      if (!result.roundEnd && room.gameState) {
        setTurnTimer(room, room.gameState);
      }
    } catch (err) { emitError(socket, err.message); }
  });

  // ── Disconnect ────────────────────────────────
  socket.on('disconnect', () => {
    const found = getRoomBySocket(socket.id);
    if (!found) return;

    const { room, player } = found;
    leaveRoom(room.code, player.token);

    if (room.gameState && room.status === 'playing') {
      const currentToken = getCurrentPlayerToken(room.gameState);
      if (currentToken === player.token) {
        clearTurnTimer(room.gameState);
        room.gameState.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
        room.gameState.turnTimer = setTimeout(
          () => handleTurnTimeout(room, room.gameState),
          TURN_TIMEOUT_MS,
        );
      }
    }

    broadcastSnapshot(room);
  });
});

// ─────────────────────────────────────────────
// Start — bind to 0.0.0.0 so Render can reach us
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Teen Patti server listening on 0.0.0.0:${PORT}`);
  console.log(`Allowed CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
