'use strict';

/**
 * Tests: blind player security invariants.
 * Verifies that card values never leak before the See action.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

// Import server modules directly (no HTTP server needed)
const { createRoom, joinRoom, buildSnapshot, buildPrivateCards } = require('../server/roomManager');
const { startRound, processAction, initPlayerCount } = require('../server/gameEngine');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRoom(bootAmount = 10) {
  const { room, token: hostToken } = createRoom('socket-host', 'Host', { bootAmount });
  const { token: guestToken }      = joinRoom('socket-guest', room.code, 'Guest');
  return { room, hostToken, guestToken };
}

function startGame(room) {
  startRound(room);
  initPlayerCount(room.gameState);
  // Disable auto-pack timer for tests
  if (room.gameState.turnTimer) { clearTimeout(room.gameState.turnTimer); room.gameState.turnTimer = null; }
  room._onTurnTimeout = () => {};
}

function hasCardValues(obj) {
  // Recursively check if any object contains a 'rank' or 'suit' field
  if (!obj || typeof obj !== 'object') return false;
  if ('rank' in obj && 'suit' in obj)  return true;
  return Object.values(obj).some(hasCardValues);
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Blind security: buildSnapshot never contains card values', () => {
  test('snapshot after deal has no rank/suit fields for any player', () => {
    const { room } = makeRoom();
    startGame(room);
    const snap = buildSnapshot(room);
    assert.ok(!hasCardValues(snap),
      'buildSnapshot must never include rank/suit — found card values in snapshot');
  });

  test('snapshot contains only cardCounts (numbers), not card arrays', () => {
    const { room } = makeRoom();
    startGame(room);
    const snap = buildSnapshot(room);
    const { cardCounts } = snap.game;
    for (const [token, count] of Object.entries(cardCounts)) {
      assert.equal(typeof count, 'number', `cardCounts[${token}] must be a number`);
      assert.equal(count, 3, 'Each active player must have 3 cards');
    }
  });
});

describe('Blind security: buildPrivateCards returns null for blind player', () => {
  test('blind player gets null (no card data)', () => {
    const { room, hostToken, guestToken } = makeRoom();
    startGame(room);
    // Both players are blind at start
    assert.equal(buildPrivateCards(room, hostToken),  null, 'Host is blind — must get null');
    assert.equal(buildPrivateCards(room, guestToken), null, 'Guest is blind — must get null');
  });

  test('seen player gets their own cards after See action', () => {
    const { room, hostToken, guestToken } = makeRoom();
    startGame(room);

    // Advance to the host's turn (turn starts at index 1 after dealer)
    const gs = room.gameState;
    const firstToken = gs.activePlayers[gs.turnIndex % gs.activePlayers.length];

    // The first-turn player performs See
    const result = processAction(room, firstToken, 'see');
    // Clear timer
    if (gs.turnTimer) { clearTimeout(gs.turnTimer); gs.turnTimer = null; }

    assert.ok(result.events.some(e => e.type === 'playerSeen'),
      'See action must emit playerSeen event');

    // Now buildPrivateCards should return their 3 cards
    const cards = buildPrivateCards(room, firstToken);
    assert.ok(Array.isArray(cards), 'Seen player must receive card array');
    assert.equal(cards.length, 3, 'Must receive exactly 3 cards');
    for (const card of cards) {
      assert.ok('rank' in card && 'suit' in card, 'Each card must have rank and suit');
    }
  });

  test('other player (still blind) still gets null after their partner sees', () => {
    const { room, hostToken, guestToken } = makeRoom();
    startGame(room);

    const gs         = room.gameState;
    const firstToken = gs.activePlayers[gs.turnIndex % gs.activePlayers.length];
    const otherToken = gs.activePlayers.find(t => t !== firstToken);

    processAction(room, firstToken, 'see');
    if (gs.turnTimer) { clearTimeout(gs.turnTimer); gs.turnTimer = null; }

    // Other player is still blind
    assert.equal(buildPrivateCards(room, otherToken), null,
      'Blind player must still get null even after their opponent sees');
  });
});

describe('Blind security: opponents card values never appear before Show', () => {
  test('snapshot never contains opponent card values regardless of seen state', () => {
    const { room, hostToken, guestToken } = makeRoom();
    startGame(room);

    const gs         = room.gameState;
    const firstToken = gs.activePlayers[gs.turnIndex % gs.activePlayers.length];

    // First player sees, then chaals
    processAction(room, firstToken, 'see');
    if (gs.turnTimer) { clearTimeout(gs.turnTimer); gs.turnTimer = null; }
    processAction(room, firstToken, 'chaal');
    if (gs.turnTimer) { clearTimeout(gs.turnTimer); gs.turnTimer = null; }

    // After chaal, check snapshot still has no card values
    const snap = buildSnapshot(room);
    assert.ok(!hasCardValues(snap),
      'buildSnapshot must never contain rank/suit even after one player has seen');
  });

  test('game:roundEnd hands only contains cards for show participants', () => {
    const { room, hostToken, guestToken } = makeRoom();
    startGame(room);

    const gs = room.gameState;

    // Play until Show: player 1 sees, chaals; player 2 sees, then player 1 shows
    function nextTurn() {
      return gs.activePlayers[gs.turnIndex % gs.activePlayers.length];
    }
    function clearTimer() {
      if (gs.turnTimer) { clearTimeout(gs.turnTimer); gs.turnTimer = null; }
    }

    // Player 1: see (turn stays with player 1)
    processAction(room, nextTurn(), 'see'); clearTimer();
    // Player 1: chaal (turn advances to player 2)
    processAction(room, nextTurn(), 'chaal'); clearTimer();
    // Player 2: see (turn stays with player 2)
    processAction(room, nextTurn(), 'see'); clearTimer();
    // Player 2: chaal (turn advances to player 1)
    processAction(room, nextTurn(), 'chaal'); clearTimer();
    // Player 1: show (only 2 players remain, both seen)
    const result = processAction(room, nextTurn(), 'show'); clearTimer();

    assert.ok(result.roundEnd, 'Show must produce roundEnd');
    const { hands } = result.roundEnd;
    const handTokens = Object.keys(hands);

    // Only the 2 players in the show should have their hands revealed
    assert.equal(handTokens.length, 2, 'Exactly 2 hands must be revealed at Show');

    // Verify no third party's cards leaked
    for (const [token, cards] of Object.entries(hands)) {
      assert.ok(
        gs.activePlayers.includes(token) || [hostToken, guestToken].includes(token),
        'Only round participants can have cards in roundEnd.hands'
      );
      assert.equal(cards.length, 3, 'Each revealed hand must have 3 cards');
    }
  });
});

describe('Reconnect: blind player gets no cards on reconnect', () => {
  test('buildPrivateCards returns null for blind player after reconnect', () => {
    const { room, hostToken, guestToken } = makeRoom();
    startGame(room);

    // Simulate a reconnect by calling buildPrivateCards directly
    const cards = buildPrivateCards(room, guestToken);
    assert.equal(cards, null,
      'Reconnecting blind player must NOT receive card values');
  });

  test('buildPrivateCards returns cards for seen player after reconnect', () => {
    const { room } = makeRoom();
    startGame(room);

    const gs         = room.gameState;
    const firstToken = gs.activePlayers[gs.turnIndex % gs.activePlayers.length];

    processAction(room, firstToken, 'see');
    if (gs.turnTimer) { clearTimeout(gs.turnTimer); gs.turnTimer = null; }

    // Simulate reconnect
    const cards = buildPrivateCards(room, firstToken);
    assert.ok(Array.isArray(cards) && cards.length === 3,
      'Reconnecting seen player MUST receive their 3 cards');
  });
});
