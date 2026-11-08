'use strict';

const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const {
  createRoom, joinRoom, leaveRoom, getRoom,
  getRoomBySocket, updateSettings, buildSnapshot,
  buildPrivateCards, getRoomsMap,
} = require('./roomManager');

const {
  startRound, processAction, getCurrentPlayerToken,
  setTurnTimer, clearTurnTimer, initPlayerCount, TURN_TIMEOUT_MS,
} = require('./gameEngine');

// ── CORS ──────────────────────────────────────
const DEFAULT_ORIGINS = [
  'https://teenpati.utsavtripathi.com.np',
  'https://utsavtripathi.com.np',
  'http://localhost:3000',
];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : DEFAULT_ORIGINS;

// ── Express ────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.get('/health', (_req, res) => res.status(200).send('ok'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

// ── Socket.IO ──────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  transports:    ['websocket', 'polling'],
  pingInterval:  25_000,
  pingTimeout:   60_000,
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true },
});

// ── Helpers ────────────────────────────────────
function broadcastSnapshot(room) {
  // buildSnapshot never contains card values — safe for everyone
  io.to(room.code).emit('room:state', buildSnapshot(room));
}

function emitError(socket, msg) {
  socket.emit('error', { message: msg });
}

/**
 * After a state change, send each SEEN player their own cards privately.
 * Blind players receive nothing (buildPrivateCards returns null for them).
 * This is the only place card values leave the server.
 */
function emitPrivateCards(room) {
  if (!room.gameState) return;
  for (const [token, player] of room.players.entries()) {
    if (!player.socketId || !player.connected) continue;
    const cards = buildPrivateCards(room, token);
    if (cards) {
      io.to(player.socketId).emit('player:cards', { cards });
    }
  }
}

// ── Turn timeout ───────────────────────────────
function handleTurnTimeout(room, gs) {
  if (!room.gameState || room.gameState !== gs) return;
  const token = getCurrentPlayerToken(gs);
  try {
    const result = processAction(room, token, 'pack');
    io.to(room.code).emit('game:event', { type: 'autoPack', data: { token } });
    for (const ev of result.events) io.to(room.code).emit('game:event', ev);
    if (result.roundEnd) io.to(room.code).emit('game:roundEnd', result.roundEnd);
    broadcastSnapshot(room);
    if (!result.roundEnd && room.gameState) {
      room._onTurnTimeout = handleTurnTimeout;
      setTurnTimer(room, room.gameState);
    }
  } catch (err) { console.error('Auto-pack error:', err.message); }
}

// ── Socket events ──────────────────────────────
io.on('connection', (socket) => {

  socket.on('room:create', ({ name, settings } = {}) => {
    try {
      const { room, token } = createRoom(socket.id, name, settings);
      room._onTurnTimeout = handleTurnTimeout;
      socket.join(room.code);
      socket.emit('room:joined', { token, code: room.code, isHost: true });
      broadcastSnapshot(room);
    } catch (err) { emitError(socket, err.message); }
  });

  socket.on('room:join', ({ code, name, token: existingToken } = {}) => {
    try {
      const { room, player, token, isReconnect } = joinRoom(socket.id, code, name, existingToken);
      room._onTurnTimeout = handleTurnTimeout;
      socket.join(room.code);
      socket.emit('room:joined', {
        token, code: room.code,
        isHost:      player.token === room.hostToken,
        isReconnect,
      });

      // On reconnect: only send cards if this player has already SEEN them
      if (isReconnect && room.gameState) {
        const cards = buildPrivateCards(room, token); // null if still blind
        if (cards) socket.emit('player:cards', { cards });
      }

      broadcastSnapshot(room);
    } catch (err) { emitError(socket, err.message); }
  });

  socket.on('room:settings', ({ code, settings, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room) return emitError(socket, 'Room not found');
      updateSettings(room, settings, token);
      broadcastSnapshot(room);
    } catch (err) { emitError(socket, err.message); }
  });

  socket.on('game:start', ({ code, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)                    return emitError(socket, 'Room not found');
      if (room.hostToken !== token) return emitError(socket, 'Only host can start');
      if (room.players.size < 2)    return emitError(socket, 'Need at least 2 players');

      startRound(room);
      initPlayerCount(room.gameState);
      room._onTurnTimeout = handleTurnTimeout;

      // *** DO NOT send card values here ***
      // All players are blind at deal time — no player:cards emitted.

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

  socket.on('game:action', ({ code, token, type } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)           return emitError(socket, 'Room not found');
      if (!room.gameState) return emitError(socket, 'No game in progress');

      const result = processAction(room, token, type);

      for (const ev of result.events) {
        io.to(room.code).emit('game:event', ev);

        // When a player sees their cards, send the card values to THAT socket only
        if (ev.type === 'playerSeen' && ev.data.token === token) {
          const cards = room.gameState.hands.get(token);
          if (cards) socket.emit('player:cards', { cards });
        }
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

  socket.on('game:nextRound', ({ code, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)                    return emitError(socket, 'Room not found');
      if (room.hostToken !== token) return emitError(socket, 'Only host can start next round');
      if (room.status !== 'lobby')  return emitError(socket, 'Round still in progress');

      startRound(room);
      initPlayerCount(room.gameState);
      room._onTurnTimeout = handleTurnTimeout;

      // *** DO NOT send card values here — all players blind at start of round ***

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

  socket.on('game:end', ({ code, token } = {}) => {
    try {
      const room = getRoom(code);
      if (!room)                     return emitError(socket, 'Room not found');
      if (room.hostToken !== token)  return emitError(socket, 'Only host can end the game');
      if (room.status === 'playing') return emitError(socket, 'Finish the current round first');

      room.status = 'ended';

      const standings = [...room.players.values()]
        .map(p => ({
          token: p.token, name: p.name, avatarColor: p.avatarColor,
          chips: p.chips, points: p.points, netChips: p.chips - 1000,
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
        code, standings, roundSummary,
        totalRounds: room.roundNumber,
        settings:    room.settings,
        endedAt:     Date.now(),
      });

      setTimeout(() => { try { getRoomsMap().delete(code); } catch {} }, 5 * 60 * 1000);
    } catch (err) { emitError(socket, err.message); }
  });

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

// ── Start ──────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Teen Patti server on 0.0.0.0:${PORT}`);
  console.log(`CORS: ${ALLOWED_ORIGINS.join(', ')}`);
});
