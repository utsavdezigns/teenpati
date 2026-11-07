'use strict';

const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS = ['C','D','H','S']; // clubs, diamonds, hearts, spades (ascending suit order)

/**
 * Returns a fresh shuffled 52-card deck.
 * Each card: { rank: string, suit: string }
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffle(deck);
}

/** Fisher-Yates in-place shuffle, returns deck */
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Deal `count` cards from the top of the deck (mutates deck).
 * Returns the dealt cards array.
 */
function dealCards(deck, count) {
  return deck.splice(0, count);
}

/** Numeric rank value. Ace = 14. */
function rankValue(rank) {
  const map = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,
                '9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  return map[rank];
}

/** Suit value for tie-breaking (higher = better). S>H>D>C */
function suitValue(suit) {
  return { C:1, D:2, H:3, S:4 }[suit];
}

module.exports = { createDeck, shuffle, dealCards, rankValue, suitValue, RANKS, SUITS };
