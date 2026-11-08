'use strict';

const { v4: uuidv4 } = require('uuid');

const rooms = new Map();

const AVATAR_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c',
];

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(socketId, name, settings = {}) {
  const code  = generateCode();
  const token = uuidv4();

  const player = {
    token,
    name:        sanitizeName(name),
    socketId,
    chips:       1000,
    points:      0,
    connected:   true,
    avatarColor: AVATAR_COLORS[0],
    isHost:      true,
  };

  const room = {
    code,
    hostToken: token,
    settings: {
      bootAmount:           Number(settings.bootAmount) || 10,
      stakeLimitMultiplier: Number(settings.stakeLimitMultiplier) || 8,
      pointMode:            Boolean(settings.pointMode),
    },
    players:      new Map([[token, player]]),
    gameState:    null,
    roundHistory: [],
    roundNumber:  0,
    status:       'lobby',
  };

  rooms.set(code, room);
  return { room, player, token };
}

function joinRoom(socketId, code, name, existingToken) {
  const room = rooms.get(code.toUpperCase());
  if (!room)                throw new Error('Room not found');
  if (room.status === 'ended') throw new Error('Game has ended');

  // Reconnect
  if (existingToken && room.players.has(existingToken)) {
    const player = room.players.get(existingToken);
    player.socketId  = socketId;
    player.connected = true;
    return { room, player, token: existingToken, isReconnect: true };
  }

  if (room.status === 'playing') throw new Error('Game already in progress');
  if (room.players.size >= 6)    throw new Error('Room is full');

  const token      = uuidv4();
  const colorIndex = room.players.size % AVATAR_COLORS.length;
  const player = {
    token,
    name:        sanitizeName(name),
    socketId,
    chips:       1000,
    points:      0,
    connected:   true,
    avatarColor: AVATAR_COLORS[colorIndex],
    isHost:      false,
  };

  room.players.set(token, player);
  return { room, player, token, isReconnect: false };
}

function leaveRoom(code, token) {
  const room = rooms.get(code);
  if (!room) return;

  const player = room.players.get(token);
  if (player) { player.connected = false; player.socketId = null; }

  const anyConnected = [...room.players.values()].some(p => p.connected);
  if (!anyConnected) {
    setTimeout(() => {
      const r = rooms.get(code);
      if (r && ![...r.players.values()].some(p => p.connected)) rooms.delete(code);
    }, 60_000);
    return;
  }

  if (room.hostToken === token) {
    const next = [...room.players.values()].find(p => p.connected && p.token !== token);
    if (next) { next.isHost = true; room.hostToken = next.token; }
  }
}

function getRoom(code)          { return rooms.get(code) || null; }
function getRoomsMap()          { return rooms; }

function getRoomBySocket(socketId) {
  for (const room of rooms.values())
    for (const player of room.players.values())
      if (player.socketId === socketId) return { room, player };
  return null;
}

function updateSettings(room, settings, requesterToken) {
  if (room.hostToken !== requesterToken) throw new Error('Only host can change settings');
  if (room.status !== 'lobby')           throw new Error('Cannot change settings during a game');
  if (settings.bootAmount !== undefined)
    room.settings.bootAmount = Math.max(1, Number(settings.bootAmount));
  if (settings.stakeLimitMultiplier !== undefined)
    room.settings.stakeLimitMultiplier = Math.max(2, Number(settings.stakeLimitMultiplier));
  if (settings.pointMode !== undefined)
    room.settings.pointMode = Boolean(settings.pointMode);
}

function sanitizeName(name) {
  return String(name || 'Player').replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16).trim() || 'Player';
}

// ─────────────────────────────────────────────────────────────────────
// buildSnapshot — safe for broadcast to ALL clients.
// Card VALUES are NEVER included here. Only cardCount per player.
// ─────────────────────────────────────────────────────────────────────
function buildSnapshot(room) {
  const players = [...room.players.values()].map(p => ({
    token:       p.token,
    name:        p.name,
    chips:       p.chips,
    points:      p.points,
    connected:   p.connected,
    isHost:      p.token === room.hostToken,
    avatarColor: p.avatarColor,
  }));

  let game = null;
  if (room.gameState) {
    const gs = room.gameState;
    const seenStatus = {};
    gs.seenStatus.forEach((v, k) => { seenStatus[k] = v; });
    const cardCounts = {};
    gs.hands.forEach((cards, k) => { cardCounts[k] = cards.length; });

    game = {
      pot:           gs.pot,
      currentStake:  gs.currentStake,
      turnDeadline:  gs.turnDeadline,
      activePlayers: gs.activePlayers,
      seenStatus,        // boolean per token — safe to broadcast
      dealerIndex:   gs.dealerIndex,
      turnIndex:     gs.turnIndex,
      cardCounts,        // number per token — safe to broadcast
      // NOTE: no card values here — ever
    };
  }

  return {
    code:         room.code,
    status:       room.status,
    settings:     { ...room.settings },
    players,
    game,
    roundHistory: room.roundHistory.slice(-20),
    roundNumber:  room.roundNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────
// buildPrivateCards — send card values ONLY to a player who has SEEN.
// Returns null if the player is still blind (no card data at all).
// ─────────────────────────────────────────────────────────────────────
function buildPrivateCards(room, token) {
  const gs = room.gameState;
  if (!gs) return null;
  if (!gs.seenStatus.get(token)) return null;   // blind → send nothing
  return gs.hands.get(token) || null;
}

module.exports = {
  createRoom, joinRoom, leaveRoom, getRoom,
  getRoomBySocket, updateSettings, buildSnapshot,
  buildPrivateCards, getRoomsMap,
};
