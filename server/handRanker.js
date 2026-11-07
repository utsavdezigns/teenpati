'use strict';

const { rankValue, suitValue } = require('./deck');

// Hand category constants (higher = better)
const CATEGORY = {
  HIGH_CARD:      1,
  PAIR:           2,
  COLOR:          3,   // flush
  SEQUENCE:       4,   // straight
  PURE_SEQUENCE:  5,   // straight flush
  TRAIL:          6,   // three of a kind
};

/**
 * Evaluate a 3-card hand.
 * Returns { category, tiebreakers: number[] }
 * tiebreakers are compared lexicographically; higher wins.
 */
function evaluateHand(cards) {
  if (!cards || cards.length !== 3) throw new Error('Hand must have exactly 3 cards');

  const vals = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a); // desc
  const suits = cards.map(c => c.suit);
  const suitVals = cards.map(c => suitValue(c.suit)).sort((a, b) => b - a); // desc

  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  const isTrail = vals[0] === vals[1] && vals[1] === vals[2];

  // Check for sequence (straight). Special cases: A-2-3 and A-K-Q
  const seqResult = checkSequence(vals);

  if (isTrail) {
    return { category: CATEGORY.TRAIL, tiebreakers: [vals[0], ...suitVals] };
  }

  if (isFlush && seqResult.isSeq) {
    // Pure sequence — tiebreaker: top card of the sequence
    return { category: CATEGORY.PURE_SEQUENCE, tiebreakers: [seqResult.topVal, ...suitVals] };
  }

  if (seqResult.isSeq) {
    return { category: CATEGORY.SEQUENCE, tiebreakers: [seqResult.topVal, ...suitVals] };
  }

  if (isFlush) {
    // Color: compare cards in descending order
    return { category: CATEGORY.COLOR, tiebreakers: [...vals, ...suitVals] };
  }

  // Check pair
  const pairResult = checkPair(vals, suitVals);
  if (pairResult) return pairResult;

  // High card
  return { category: CATEGORY.HIGH_CARD, tiebreakers: [...vals, ...suitVals] };
}

/**
 * Check if sorted descending vals form a sequence.
 * Returns { isSeq, topVal }
 * topVal is the effective "highest card" for ranking within sequences.
 *
 * Sequence ranking (high to low):
 *   A-K-Q  → topVal = 14 (ace-high)  ← highest
 *   K-Q-J  → topVal = 13
 *   ...
 *   4-3-2  → topVal = 4
 *   A-2-3  → topVal = 3 (treated as wheel) ← second highest per rules
 *
 * Wait — per Teen Patti rules: A-K-Q is highest, A-2-3 is SECOND highest.
 * So ranking:  A-K-Q > A-2-3 > K-Q-J > ... > 4-3-2
 */
function checkSequence(sortedValsDesc) {
  const [a, b, c] = sortedValsDesc; // a >= b >= c

  // Normal consecutive sequence (e.g., K-Q-J, 5-4-3)
  if (a - b === 1 && b - c === 1) {
    return { isSeq: true, topVal: a };
  }

  // A-K-Q: vals are [14, 13, 12] — already caught above (14-13=1, 13-12=1) ✓

  // A-2-3: vals sorted desc = [14, 3, 2]
  if (a === 14 && b === 3 && c === 2) {
    // Rank it above K-Q-J but below A-K-Q.
    // Use topVal = 3.5 to slot between A-K-Q (topVal=14) and K-Q-J (topVal=13)?
    // Actually per rules A-2-3 is second best sequence.
    // We'll use topVal = 13.5 to place it between A-K-Q and K-Q-J.
    // But tiebreakers are numbers, so we use a sentinel: topVal = 13.5
    return { isSeq: true, topVal: 13.5 };
  }

  return { isSeq: false, topVal: 0 };
}

/**
 * Check for a pair in sorted-descending vals.
 * Returns a result object or null.
 */
function checkPair(vals, suitVals) {
  // Possible pair positions: [0,1], [1,2], or (not [0,2] since sorted and not trail)
  if (vals[0] === vals[1]) {
    const kicker = vals[2];
    const pairSuits = suitVals.slice(0, 2); // top 2 suits belong to pair rank... approximately
    return {
      category: CATEGORY.PAIR,
      tiebreakers: [vals[0], kicker, ...suitVals]
    };
  }
  if (vals[1] === vals[2]) {
    const kicker = vals[0];
    return {
      category: CATEGORY.PAIR,
      tiebreakers: [vals[1], kicker, ...suitVals]
    };
  }
  return null;
}

/**
 * Compare two evaluated hands.
 * Returns 1 if handA wins, -1 if handB wins, 0 for exact tie.
 */
function compareEvaluated(evalA, evalB) {
  if (evalA.category !== evalB.category) {
    return evalA.category > evalB.category ? 1 : -1;
  }
  // Same category — compare tiebreakers lexicographically
  const len = Math.max(evalA.tiebreakers.length, evalB.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const ta = evalA.tiebreakers[i] ?? 0;
    const tb = evalB.tiebreakers[i] ?? 0;
    if (ta !== tb) return ta > tb ? 1 : -1;
  }
  return 0;
}

/**
 * Compare two 3-card hands directly.
 * @param {Card[]} handA
 * @param {Card[]} handB
 * @returns 1 | -1 | 0
 */
function compareHands(handA, handB) {
  return compareEvaluated(evaluateHand(handA), evaluateHand(handB));
}

/**
 * Given an array of { token, cards } objects, return the winner token.
 * If multiple winners share the exact same hand (extremely rare), returns the first.
 */
function findWinner(playerHands) {
  let best = null;
  let bestEval = null;

  for (const { token, cards } of playerHands) {
    const ev = evaluateHand(cards);
    if (!best || compareEvaluated(ev, bestEval) > 0) {
      best = token;
      bestEval = ev;
    }
  }
  return best;
}

/** Human-readable category name */
function categoryName(cat) {
  return Object.keys(CATEGORY).find(k => CATEGORY[k] === cat) || 'UNKNOWN';
}

module.exports = { evaluateHand, compareHands, compareEvaluated, findWinner, CATEGORY, categoryName, checkSequence };
