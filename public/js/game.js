'use strict';

window.Game = (() => {
  let _snapshot      = null;
  let _myCards       = null;   // null = blind, Card[] = seen
  let _roundEndTimer = null;

  // ─── Seat layout ──────────────────────────────────────────────────────
  function renderSeats(snapshot) {
    const container = document.getElementById('seats-container');
    container.innerHTML = '';
    if (!snapshot.game) return;

    const { players, game } = snapshot;
    const positions = UI.getSeatPositions(players.length);

    players.forEach((p, i) => {
      const { left, top } = positions[i];
      const isMyself = p.token === App.myToken;
      const isActive = game.activePlayers.includes(p.token);
      const isPacked = !isActive;
      const isTurn   = game.activePlayers[
        game.turnIndex % Math.max(1, game.activePlayers.length)
      ] === p.token && snapshot.status === 'playing';
      const isSeen   = game.seenStatus[p.token];

      // Status label
      let statusLabel = '', statusClass = '';
      if (isPacked)       { statusLabel = 'Packed'; statusClass = 'packed'; }
      else if (isSeen)    { statusLabel = 'Seen';   statusClass = 'seen'; }
      else if (isActive)  { statusLabel = 'Blind';  statusClass = 'blind'; }

      // Dealer chip
      const isDealer = game.activePlayers[game.dealerIndex] === p.token;
      const dealerHtml = isDealer
        ? `<div class="dealer-chip" aria-label="Dealer">D</div>` : '';

      // Seen badge
      const seenBadge = isSeen && !isPacked ? `
        <div class="seat-seen-badge" title="${escHtml(p.name)} has seen">
          <svg width="10" height="7" viewBox="0 0 20 14" fill="currentColor">
            <path d="M10 0C5.5 0 1 7 1 7s4.5 7 9 7 9-7 9-7S14.5 0 10 0zm0
              11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zM10 5a2 2 0 100 4 2 2 0 000-4z"/>
          </svg>
        </div>` : '';

      // Mini fanned cards (always backs — we never show opponents' faces)
      const cardCount = game.cardCounts[p.token] || 0;
      const cardHtml  = Array.from({ length: cardCount }, (_, ci) =>
        `<div class="card face-down" aria-hidden="true"
              style="transform:rotate(${(ci-1)*8}deg) translateY(${Math.abs(ci-1)*2}px)">
          <div class="card-front"></div>
          <div class="card-back">${buildMiniCardBack()}</div>
        </div>`
      ).join('');

      const seat = document.createElement('div');
      seat.className = 'seat'
        + (isTurn       ? ' is-turn'      : '')
        + (isMyself     ? ' is-me'        : '')
        + (isPacked     ? ' packed'       : '')
        + (!p.connected ? ' disconnected' : '');
      seat.style.cssText = `left:${left}%;top:${top}%;transform:translate(-50%,-50%)`;
      seat.dataset.token = p.token;
      seat.innerHTML = `
        <div class="seat-avatar-wrap">
          <div class="seat-avatar" style="background:${p.avatarColor}"
               aria-label="${escHtml(p.name)}${isTurn ? ', current turn' : ''}">
            ${p.name.charAt(0).toUpperCase()}
          </div>
          ${dealerHtml}${seenBadge}
          <div class="turn-timer" aria-hidden="true">
            <div class="turn-timer-bar" style="width:100%"></div>
          </div>
        </div>
        <div class="seat-tag">
          <div class="seat-name">${escHtml(isMyself ? p.name + ' ★' : p.name)}</div>
          ${statusLabel ? `<div class="seat-status ${statusClass}">${statusLabel}</div>` : ''}
        </div>
        <div class="seat-cards" aria-hidden="true">${cardHtml}</div>`;

      container.appendChild(seat);
      if (isTurn) UI.startTimerBar(seat, game.turnDeadline);
    });
  }

  function buildMiniCardBack() {
    return `<svg width="100%" height="100%" viewBox="0 0 20 30">
      <rect width="20" height="30" rx="2" fill="#1a4035"/>
      <rect x="1" y="1" width="18" height="28" rx="1.5" fill="none" stroke="#22854d" stroke-width="1"/>
    </svg>`;
  }

  // ─── My card area ──────────────────────────────────────────────────────
  /**
   * Show 3 face-down placeholder cards (blind state).
   * Called on roundStart — no card data needed.
   */
  function showBlindCards() {
    _myCards = null;
    const area = document.getElementById('my-cards-area');
    area.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'card face-down';
      el.setAttribute('aria-label', 'Face-down card');
      el.innerHTML = `<div class="card-front"></div><div class="card-back">${buildFullCardBack()}</div>`;
      if (!UI.REDUCED_MOTION) {
        el.classList.add('dealing-down');
        el.style.animationDelay = `${i * 0.15}s`;
      }
      area.appendChild(el);
    }
  }

  /**
   * Called by app.js when server sends player:cards (only after See action).
   * Reveals cards with flip animation.
   */
  function setMyCards(cards) {
    _myCards = cards;
    const area  = document.getElementById('my-cards-area');
    const elems = area.querySelectorAll('.card');

    if (elems.length === 3) {
      // Replace placeholder backs in-place with real card elements, then flip
      cards.forEach((card, i) => {
        const newEl = UI.createCardElement(card.rank, card.suit, true); // start face-down
        newEl.classList.add('dealing-down');
        elems[i].replaceWith(newEl);
        // Flip after short delay per card
        setTimeout(() => UI.flipCard(newEl), 80 + i * 130);
      });
    } else {
      // Area empty or wrong count — render face-up directly (reconnect after seen)
      renderMyCardsFaceUp(cards);
    }
  }

  function renderMyCardsFaceUp(cards) {
    const area = document.getElementById('my-cards-area');
    area.innerHTML = '';
    cards.forEach((card, idx) => {
      const el = UI.createCardElement(card.rank, card.suit, false);
      if (!UI.REDUCED_MOTION) {
        el.classList.add('dealing-up');
        el.style.animationDelay = `${idx * 0.15}s`;
      }
      area.appendChild(el);
    });
  }

  function buildFullCardBack() {
    return `<svg width="100%" height="100%" viewBox="0 0 52 76" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1b4a38"/>
          <stop offset="100%" stop-color="#0d2e20"/>
        </linearGradient>
        <pattern id="cd" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8L8 0M-1 1L1-1M7 9L9 7" stroke="#2a6647" stroke-width="1" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width="52" height="76" rx="6" fill="url(#cbg)"/>
      <rect width="52" height="76" rx="6" fill="url(#cd)"/>
      <rect x="3" y="3" width="46" height="70" rx="4" fill="none" stroke="#2a6647" stroke-width="1.5" opacity="0.6"/>
      <g transform="translate(26,38)">
        <path d="M0,-10 L7,0 L0,10 L-7,0 Z" fill="none" stroke="#f5c842" stroke-width="1.2" opacity="0.55"/>
        <path d="M0,-6 L4,0 L0,6 L-4,0 Z" fill="#f5c842" opacity="0.4"/>
      </g>
    </svg>`;
  }

  // ─── Pot ──────────────────────────────────────────────────────────────
  function updatePot(amount) {
    document.getElementById('pot-amount').textContent = amount;
  }

  function updateRoundLabel(n) {
    document.getElementById('game-round-label').textContent = `Round ${n}`;
  }

  // ─── Action buttons ────────────────────────────────────────────────────
  function updateActionButtons(snapshot) {
    const game        = snapshot.game;
    const statusBar   = document.getElementById('game-status-bar');
    const statusMsg   = document.getElementById('game-status-msg');
    const nextRoundBtn= document.getElementById('btn-next-round');
    const endGameBtn  = document.getElementById('btn-end-game');
    const infoEl      = document.getElementById('action-info');

    const btns = {
      see:   document.getElementById('btn-see'),
      chaal: document.getElementById('btn-chaal'),
      raise: document.getElementById('btn-raise'),
      pack:  document.getElementById('btn-pack'),
      show:  document.getElementById('btn-show'),
    };

    Object.values(btns).forEach(b => { b.disabled = true; });
    infoEl.textContent = '';

    if (snapshot.status === 'lobby' && !game) {
      statusBar.style.display = 'block';
      if (App.isHost) {
        nextRoundBtn.style.display = 'block';
        endGameBtn.style.display   = 'block';
        statusMsg.textContent = 'Start another round or end the game.';
      } else {
        nextRoundBtn.style.display = 'none';
        endGameBtn.style.display   = 'none';
        statusMsg.textContent = 'Waiting for host to start next round…';
      }
      return;
    }

    statusBar.style.display = 'none';
    nextRoundBtn.style.display = 'none';
    endGameBtn.style.display   = 'none';

    if (!game || snapshot.status !== 'playing') return;

    const myToken    = App.myToken;
    const n          = Math.max(1, game.activePlayers.length);
    const isMyTurn   = game.activePlayers[game.turnIndex % n] === myToken;
    const isActive   = game.activePlayers.includes(myToken);
    // Derive seen from server state — the single source of truth
    const isSeen     = !!game.seenStatus[myToken];
    const can2Player = game.activePlayers.length === 2;

    if (!isActive) { infoEl.textContent = 'You have packed this round.'; return; }

    if (!isMyTurn) {
      const curTok = game.activePlayers[game.turnIndex % n];
      const curP   = snapshot.players.find(p => p.token === curTok);
      infoEl.textContent = curP ? `${curP.name}'s turn` : 'Waiting…';
      return;
    }

    const stake     = game.currentStake;
    const chaalCost = isSeen ? stake * 2 : stake;
    const raiseCost = chaalCost * 2;
    const myChips   = snapshot.players.find(p => p.token === myToken)?.chips ?? 0;

    btns.pack.disabled  = false;
    btns.chaal.disabled = myChips < chaalCost;
    btns.raise.disabled = myChips < raiseCost;
    if (!isSeen)     btns.see.disabled  = false;
    if (can2Player)  btns.show.disabled = false;

    btns.chaal.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      Chaal <span style="font-size:.75em;opacity:.8">(${chaalCost})</span>`;

    btns.raise.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
      <path d="M6.5 1l1.4 3 3.6.5-2.5 2.5.6 3.5L6.5 9 3.4 10.5l.6-3.5L1.5 4.5l3.6-.5z"/></svg>
      Raise <span style="font-size:.75em;opacity:.8">(${raiseCost})</span>`;

    infoEl.textContent = `Your turn · ${isSeen ? 'Seen' : 'Blind'} · Stake: ${stake}`;
  }

  // ─── Game events ────────────────────────────────────────────────────────
  function handleEvent(ev) {
    const { type, data } = ev;
    switch (type) {
      case 'roundStart': {
        updatePot(data.pot);
        updateRoundLabel(data.roundNumber);
        hideBanner();
        // New round: everyone is blind — show 3 face-down placeholder cards
        showBlindCards();
        break;
      }
      case 'chaal':
      case 'raise': {
        updatePot(data.pot);
        animateChipFromSeat(data.token, data.amount);
        UI.showToast(`${getPlayerName(data.token)} ${type === 'raise' ? 'raised' : 'chaaled'} ${data.amount}`);
        break;
      }
      case 'pack':
      case 'autoPack': {
        UI.showToast(`${getPlayerName(data.token)} packed`);
        markSeatPacked(data.token);
        break;
      }
      case 'playerSeen': {
        if (data.token !== App.myToken) {
          UI.showToast(`${getPlayerName(data.token)} looked at their cards`);
        }
        // My own flip is triggered by player:cards arriving (handled in app.js → setMyCards)
        break;
      }
      case 'show': {
        UI.showToast(`${getPlayerName(data.token)} called Show!`);
        break;
      }
    }
  }

  function handleRoundEnd(result) {
    const winnerPlayer = _snapshot?.players.find(p => p.token === result.winnerToken);
    const winnerName   = winnerPlayer?.name || 'Player';

    if (result.hands) {
      for (const [token, cards] of Object.entries(result.hands)) {
        if (token === App.myToken) {
          renderMyCardsFaceUp(cards);
        } else {
          revealOpponentCards(token, cards);
        }
      }
    }

    const handType = result.handCategories?.[result.winnerToken]
      ? formatCategory(result.handCategories[result.winnerToken]) : '';

    showBanner(winnerName, handType, result.pot);

    if (result.winnerToken === App.myToken) {
      UI.fireConfetti();
      UI.showToast(`You won ${result.pot} chips!`);
    } else {
      UI.showToast(`${winnerName} won! (${handType})`);
    }

    _roundEndTimer = setTimeout(() => { _myCards = null; }, 5000);
  }

  function revealOpponentCards(token, cards) {
    const seat = document.querySelector(`.seat[data-token="${token}"]`);
    if (!seat) return;
    const cardEls = seat.querySelectorAll('.card');
    cards.forEach((card, i) => {
      if (!cardEls[i]) return;
      const newCard = UI.createCardElement(card.rank, card.suit, true, true);
      cardEls[i].replaceWith(newCard);
      setTimeout(() => UI.flipCard(newCard), i * 100);
    });
  }

  function showBanner(name, handType, pot) {
    const wb = document.getElementById('winner-banner');
    if (wb) { wb.innerHTML = `<span>${escHtml(name)}</span> has won this round`; wb.classList.add('visible'); }
    const banner = document.getElementById('round-end-banner');
    document.getElementById('banner-winner-name').textContent = name + ' wins!';
    document.getElementById('banner-hand-type').textContent   =
      handType ? `${handType} · ${pot} chips` : `${pot} chips`;
    banner.classList.add('visible');
    setTimeout(hideBanner, 5000);
  }

  function hideBanner() {
    document.getElementById('round-end-banner').classList.remove('visible');
    document.getElementById('winner-banner')?.classList.remove('visible');
  }

  function formatCategory(cat) {
    return { TRAIL:'Trail', PURE_SEQUENCE:'Pure Sequence', SEQUENCE:'Sequence',
             COLOR:'Color', PAIR:'Pair', HIGH_CARD:'High Card' }[cat] || cat;
  }

  function markSeatPacked(token) {
    document.querySelector(`.seat[data-token="${token}"]`)?.classList.add('packed');
  }

  function animateChipFromSeat(token) {
    if (UI.REDUCED_MOTION) return;
    const seat  = document.querySelector(`.seat[data-token="${token}"]`);
    const potEl = document.getElementById('pot-display');
    if (seat && potEl) UI.animateChipToPot(seat, potEl);
  }

  function getPlayerName(token) {
    return _snapshot?.players.find(p => p.token === token)?.name || 'Player';
  }

  // ─── Main update (called on every room:state) ──────────────────────────
  function update(snapshot) {
    _snapshot = snapshot;
    if (snapshot.game) updatePot(snapshot.game.pot);
    updateRoundLabel(snapshot.roundNumber || 1);
    renderSeats(snapshot);
    updateActionButtons(snapshot);

    // Reconnect path: if game is playing and cards area is empty
    if (snapshot.status === 'playing' && snapshot.game) {
      const area      = document.getElementById('my-cards-area');
      const isSeen    = !!snapshot.game.seenStatus[App.myToken];
      const isActive  = snapshot.game.activePlayers.includes(App.myToken);

      if (area.children.length === 0 && isActive) {
        if (isSeen && _myCards) {
          // Reconnect after seen — server will re-send player:cards, wait for it
          // Show placeholder seen cards (face-up backs temporarily)
          renderMyCardsFaceUp(_myCards);
        } else {
          // Blind or no cards yet — show face-down placeholders
          showBlindCards();
        }
      }
    }
  }

  // ─── Action bindings ──────────────────────────────────────────────────
  function bindActions() {
    ['see','chaal','raise','pack','show'].forEach(action => {
      document.getElementById(`btn-${action}`).addEventListener('click', () => {
        App.socket.emit('game:action', { code: App.roomCode, token: App.myToken, type: action });
      });
    });
    document.getElementById('btn-next-round').addEventListener('click', () => {
      App.socket.emit('game:nextRound', { code: App.roomCode, token: App.myToken });
    });
    document.getElementById('btn-end-game').addEventListener('click', () => {
      App.socket.emit('game:end', { code: App.roomCode, token: App.myToken });
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  document.addEventListener('DOMContentLoaded', bindActions);
  return { update, setMyCards, handleEvent, handleRoundEnd };
})();
