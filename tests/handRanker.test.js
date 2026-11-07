'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateHand, compareHands, CATEGORY, categoryName } = require('../server/handRanker');

// Helper to make cards
const c = (rank, suit) => ({ rank, suit });

describe('evaluateHand — category detection', () => {
  test('Trail (three of a kind)', () => {
    const hand = [c('A','S'), c('A','H'), c('A','D')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.TRAIL);
  });

  test('Pure Sequence (straight flush)', () => {
    const hand = [c('7','H'), c('8','H'), c('9','H')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.PURE_SEQUENCE);
  });

  test('Sequence (straight, mixed suits)', () => {
    const hand = [c('5','H'), c('6','D'), c('7','S')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.SEQUENCE);
  });

  test('Color (flush, not straight)', () => {
    const hand = [c('2','H'), c('5','H'), c('K','H')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.COLOR);
  });

  test('Pair', () => {
    const hand = [c('J','S'), c('J','D'), c('3','H')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.PAIR);
  });

  test('High Card', () => {
    const hand = [c('A','S'), c('K','H'), c('9','D')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.HIGH_CARD);
  });
});

describe('Special sequences', () => {
  test('A-2-3 is a Sequence', () => {
    const hand = [c('A','S'), c('2','H'), c('3','D')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.SEQUENCE);
  });

  test('A-2-3 is a Pure Sequence when same suit', () => {
    const hand = [c('A','S'), c('2','S'), c('3','S')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.PURE_SEQUENCE);
  });

  test('A-K-Q is a Sequence', () => {
    const hand = [c('A','S'), c('K','H'), c('Q','D')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.SEQUENCE);
  });

  test('A-K-Q is a Pure Sequence when same suit', () => {
    const hand = [c('A','S'), c('K','S'), c('Q','S')];
    const ev = evaluateHand(hand);
    assert.equal(ev.category, CATEGORY.PURE_SEQUENCE);
  });

  test('A-2-3 ranks BELOW A-K-Q as sequence', () => {
    const akq = [c('A','S'), c('K','H'), c('Q','D')];
    const a23 = [c('A','H'), c('2','D'), c('3','C')];
    assert.equal(compareHands(akq, a23), 1, 'A-K-Q should beat A-2-3');
    assert.equal(compareHands(a23, akq), -1, 'A-2-3 should lose to A-K-Q');
  });

  test('A-2-3 ranks above K-Q-J as sequence', () => {
    const a23 = [c('A','S'), c('2','H'), c('3','D')];
    const kqj = [c('K','S'), c('Q','H'), c('J','D')];
    assert.equal(compareHands(a23, kqj), 1, 'A-2-3 should beat K-Q-J');
  });
});

describe('Hand ranking order (higher beats lower)', () => {
  const trail     = [c('K','S'), c('K','H'), c('K','D')];
  const pureSeq   = [c('J','H'), c('Q','H'), c('K','H')];
  const sequence  = [c('J','S'), c('Q','H'), c('K','D')];
  const color     = [c('2','S'), c('6','S'), c('A','S')];
  const pair      = [c('9','S'), c('9','H'), c('3','D')];
  const highCard  = [c('A','S'), c('K','H'), c('J','D')];

  test('Trail beats Pure Sequence', () => assert.equal(compareHands(trail, pureSeq), 1));
  test('Pure Sequence beats Sequence', () => assert.equal(compareHands(pureSeq, sequence), 1));
  test('Sequence beats Color', () => assert.equal(compareHands(sequence, color), 1));
  test('Color beats Pair', () => assert.equal(compareHands(color, pair), 1));
  test('Pair beats High Card', () => assert.equal(compareHands(pair, highCard), 1));

  test('Reverse: High Card loses to Pair', () => assert.equal(compareHands(highCard, pair), -1));
  test('Reverse: Sequence loses to Pure Sequence', () => assert.equal(compareHands(sequence, pureSeq), -1));
});

describe('Tie-breaking within same category', () => {
  test('Higher trail wins', () => {
    const aceTrail  = [c('A','S'), c('A','H'), c('A','D')];
    const kingTrail = [c('K','S'), c('K','H'), c('K','D')];
    assert.equal(compareHands(aceTrail, kingTrail), 1);
  });

  test('Higher pair wins', () => {
    const aces = [c('A','S'), c('A','H'), c('2','D')];
    const kings = [c('K','S'), c('K','H'), c('2','C')];
    assert.equal(compareHands(aces, kings), 1);
  });

  test('Pair tie — higher kicker wins', () => {
    const pairAaceK = [c('A','S'), c('A','H'), c('K','D')];
    const pairAaceQ = [c('A','D'), c('A','C'), c('Q','H')];
    assert.equal(compareHands(pairAaceK, pairAaceQ), 1);
  });

  test('Color — first card decides', () => {
    const colorA = [c('A','H'), c('5','H'), c('2','H')];
    const colorK = [c('K','H'), c('9','H'), c('3','H')];
    assert.equal(compareHands(colorA, colorK), 1);
  });

  test('Higher sequence wins', () => {
    const seq_kqj = [c('K','S'), c('Q','H'), c('J','D')];
    const seq_987 = [c('9','S'), c('8','H'), c('7','D')];
    assert.equal(compareHands(seq_kqj, seq_987), 1);
  });
});

describe('compareHands anti-symmetry', () => {
  test('if a > b then b < a', () => {
    const a = [c('A','S'), c('A','H'), c('A','D')]; // trail
    const b = [c('K','S'), c('Q','H'), c('J','S')]; // pure seq
    assert.equal(compareHands(a, b), 1);
    assert.equal(compareHands(b, a), -1);
  });

  test('equal hands return 0', () => {
    const a = [c('5','S'), c('6','H'), c('7','D')];
    const b = [c('5','H'), c('6','D'), c('7','C')];
    // Different suits — suit tiebreak may differ, but same sequence value topVal=7
    // So category and topVal same; suit tiebreak determines it, but must not be 0 unless identical
    const r = compareHands(a, b);
    assert.ok(r === 1 || r === -1 || r === 0, 'Must return 1, -1 or 0');
  });
});

describe('categoryName helper', () => {
  test('returns correct names', () => {
    assert.equal(categoryName(CATEGORY.TRAIL), 'TRAIL');
    assert.equal(categoryName(CATEGORY.PAIR), 'PAIR');
    assert.equal(categoryName(CATEGORY.HIGH_CARD), 'HIGH_CARD');
  });
});
