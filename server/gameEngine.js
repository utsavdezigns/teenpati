'use strict';

const { createDeck, dealCards } = require('./deck');
const { findWinner, evaluateHand, categoryName } = require('./handRanker');

const TURN_TIMEOUT_MS = 30_000;

/**
 * Start a new round in a room.
 * Mutates room.gameState and room.status.
 * Returns { hands: Map<token, Card[]> } so caller can emit private cards.
 */
function startRound(room) {
  const activePlayers = [...room.players.values()]
    .filter(p => p.connected && p.chips > 0)
    .map(p => p.token);

  if (activePlayers.length < 2) throw new Error('Need at least 2 players with chips');

  const deck = createDeck();
  const hands = new Map();
  const bootAmount = room.settings.bootAmount;
  let pot = 0;

  // Deal 3 cards to each active player, collect boot
  for (const token of activePlayers) {
    hands.set(token, dealCards(deck, 3));
    const player = room.players.get(token);
    const boot = Math.min(bootAmount, player.chips);
    player.chips -= boot;
    pot += boot;
  }

  room.roundNumber += 1;
  room.status = 'playing';

  // Advance dealer index
  const prevDealer = room.gameState ? room.gameState.dealerIndex : -1;
  const dealerIndex = (prevDealer + 1) % activePlayers.length;
  const firstTurnIndex = (dealerIndex + 1) % activePlayers.length;

  const seenStatus = new Map();
  for (const t of activePlayers) seenStatus.set(t, false);

  room.gameState = {
    deck,
    pot,
    currentStake: bootAmount,
    dealerIndex,
    turnIndex: firstTurnIndex,
    activePlayers,
    hands,
    seenStatus,
    turnTimer: null,
    turnDeadline: Date.now() + TURN_TIMEOUT_MS,
    roundNumber: room.roundNumber,
  };

  return hands;
}

/**
 * Get the token of the player whose turn it is.
 */
function getCurrentPlayerToken(gs) {
  return gs.activePlayers[gs.turnIndex % gs.activePlayers.length];
}

/**
 * Process a player action.
 * @param {Room} room
 * @param {string} token - acting player token
 * @param {string} actionType - 'chaal' | 'raise' | 'pack' | 'see' | 'show'
 * @returns {object} result with { events, roundEnd? }
 *   events: array of { type, data } to broadcast
 *   roundEnd: { winner, hands, pointDelta } if round ended
 */
function processAction(room, token, actionType) {
  const gs = room.gameState;
  if (!gs) throw new Error('No game in progress');

  const currentToken = getCurrentPlayerToken(gs);
  if (currentToken !== token) throw new Error('Not your turn');

  const player = room.players.get(token);
  const isSeen = gs.seenStatus.get(token);
  const events = [];

  clearTurnTimer(gs);

  switch (actionType) {
    case 'see': {
      if (isSeen) throw new Error('You have already seen your cards');
      gs.seenStatus.set(token, true);
      events.push({ type: 'playerSeen', data: { token } });
      // After seeing, it's still the same player's turn — don't advance
      setTurnTimer(room, gs);
      return { events };
    }

    case 'chaal': {
      const amount = isSeen ? gs.currentStake * 2 : gs.currentStake;
      if (player.chips < amount) throw new Error('Not enough chips');
      player.chips -= amount;
      gs.pot += amount;
      events.push({ type: 'chaal', data: { token, amount, pot: gs.pot } });
      break;
    }

    case 'raise': {
      // Raise = pay double what you'd pay for chaal, and double the stake
      const baseStake = isSeen ? gs.currentStake * 2 : gs.currentStake;
      const raiseAmount = baseStake * 2;
      const limit = room.settings.bootAmount * room.settings.stakeLimitMultiplier;
      if (gs.currentStake * 2 > limit) throw new Error('Stake limit reached, cannot raise');
      if (player.chips < raiseAmount) throw new Error('Not enough chips');
      player.chips -= raiseAmount;
      gs.pot += raiseAmount;
      gs.currentStake = isSeen ? gs.currentStake * 2 : gs.currentStake * 2;
      events.push({ type: 'raise', data: { token, amount: raiseAmount, currentStake: gs.currentStake, pot: gs.pot } });
      break;
    }

    case 'pack': {
      gs.activePlayers.splice(gs.turnIndex % gs.activePlayers.length, 1);
      // Adjust turnIndex so it doesn't skip
      if (gs.turnIndex >= gs.activePlayers.length) gs.turnIndex = 0;
      events.push({ type: 'pack', data: { token } });

      const roundEnd = checkRoundEnd(room, gs, events);
      if (roundEnd) return { events, roundEnd };
      setTurnTimer(room, gs);
      return { events };
    }

    case 'show': {
      if (gs.activePlayers.length !== 2) throw new Error('Show only allowed with 2 players');
      const otherToken = gs.activePlayers.find(t => t !== token);

      // Cost of show
      const showCost = isSeen ? gs.currentStake * 2 : gs.currentStake;
      if (player.chips < showCost) throw new Error('Not enough chips for show');
      player.chips -= showCost;
      gs.pot += showCost;

      const handA = { token, cards: gs.hands.get(token) };
      const handB = { token: otherToken, cards: gs.hands.get(otherToken) };
      const winnerToken = findWinner([handA, handB]);

      events.push({ type: 'show', data: { token, showCost, pot: gs.pot } });

      const roundEnd = resolveRound(room, gs, winnerToken, [handA, handB]);
      return { events, roundEnd };
    }

    default:
      throw new Error('Unknown action');
  }

  // Advance turn for chaal/raise
  advanceTurn(gs);
  setTurnTimer(room, gs);
  return { events };
}

function checkRoundEnd(room, gs, events) {
  if (gs.activePlayers.length === 1) {
    const winnerToken = gs.activePlayers[0];
    return resolveRound(room, gs, winnerToken, null);
  }
  return null;
}

function resolveRound(room, gs, winnerToken, revealedHands) {
  clearTurnTimer(gs);

  const winner = room.players.get(winnerToken);
  winner.chips += gs.pot;

  const pointDelta = {};
  // N = number of players who started the round
  const N = gs.initialPlayerCount || gs.activePlayers.length;

  for (const [token, player] of room.players.entries()) {
    if (token === winnerToken) {
      pointDelta[token] = N - 1;
      player.points += N - 1;
    } else if (gs.seenStatus.has(token)) {
      // participated in this round
      pointDelta[token] = -1;
      player.points -= 1;
    }
  }

  const handsRevealed = {};
  if (revealedHands) {
    for (const { token, cards } of revealedHands) {
      handsRevealed[token] = cards;
    }
  } else {
    // Last player standing — reveal their hand
    handsRevealed[winnerToken] = gs.hands.get(winnerToken);
  }

  const roundResult = {
    roundNumber: gs.roundNumber,
    winnerToken,
    pot: gs.pot,
    hands: handsRevealed,
    pointDelta,
    handCategories: {},
  };

  for (const [tok, cards] of Object.entries(handsRevealed)) {
    try {
      const ev = evaluateHand(cards);
      roundResult.handCategories[tok] = categoryName(ev.category);
    } catch {}
  }

  room.roundHistory.push(roundResult);
  room.gameState = null;
  room.status = 'lobby';

  return roundResult;
}

function advanceTurn(gs) {
  gs.turnIndex = (gs.turnIndex + 1) % gs.activePlayers.length;
  gs.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
}

function setTurnTimer(room, gs, onExpire) {
  clearTurnTimer(gs);
  gs.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  gs.turnTimer = setTimeout(() => {
    // Auto-pack: will be called by the socket handler
    if (room._onTurnTimeout) room._onTurnTimeout(room, gs);
  }, TURN_TIMEOUT_MS);
}

function clearTurnTimer(gs) {
  if (gs && gs.turnTimer) {
    clearTimeout(gs.turnTimer);
    gs.turnTimer = null;
  }
}

/**
 * Set the initial player count on game state (called right after startRound).
 */
function initPlayerCount(gs) {
  gs.initialPlayerCount = gs.activePlayers.length;
}

module.exports = {
  startRound,
  processAction,
  getCurrentPlayerToken,
  advanceTurn,
  setTurnTimer,
  clearTurnTimer,
  initPlayerCount,
  TURN_TIMEOUT_MS,
};
