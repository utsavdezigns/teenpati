'use strict';

window.Game = (() => {
  let _snapshot = null;
  let _myCards  = null;
  let _roundEndTimer = null;

  // ─── Seat layout ─────────────────────────────────────────────────────
  function renderSeats(snapshot) {
    const container = document.getElementById('seats-container');
    container.innerHTML = '';

    if (!snapshot.game) return;

    const players  = snapshot.players;
    const game     = snapshot.game;
    const n        = players.length;
    const positions = UI.getSeatPositions(n);

    const tableArea = document.getElementById('table-area');
    const tableRect = tableArea.getBoundingClientRect();
    const refW = tableRect.width  || 400;
    const refH = tableRect.height || 400;

    players.forEach((p, i) => {
      const { left, top } = positions[i];
      const isMyself = p.token === App.myToken;
      const isActive = game.activePlayers.includes(p.token);
      const isPacked = !isActive && game.activePlayers.length < snapshot.players.length;
      const isTurn   = game.activePlayers[game.turnIndex % Math.max(1, game.activePlayers.length)] === p.token && snapshot.status === 'playing';
      const isSeen   = game.seenStatus[p.token];

      const seat = document.createElement('div');
      seat.className = 'seat' +
        (isTurn      ? ' is-turn'      : '') +
        (isMyself    ? ' is-me'        : '') +
        (isPacked    ? ' packed'       : '') +
        (!p.connected ? ' disconnected' : '');
      seat.style.left = `${left}%`;
      seat.style.top  = `${top}%`;
      seat.style.transform = 'translate(-50%, -50%)';
      seat.dataset.token = p.token;

      // Status label: Seen / Blind / Packed
      let statusLabel = '', statusClass = '';
      if (isPacked) { statusLabel = 'Packed'; statusClass = 'packed'; }
      else if (isSeen) { statusLabel = 'Seen'; statusClass = 'seen'; }
      else if (isActive) { statusLabel = 'Blind'; statusClass = 'blind'; }

      // Dealer chip
      const isDealer = game.dealerIndex < game.activePlayers.length &&
                       game.activePlayers[game.dealerIndex] === p.token;
      const dealerHtml = isDealer ? `<div class="dealer-chip" aria-label="Dealer">D</div>` : '';

      // Seen badge (eye icon)
      const seenBadge = isSeen && !isPacked ? `
        <div class="seat-seen-badge" title="${p.name} has seen cards">
          <svg width="10" height="7" viewBox="0 0 20 14" fill="currentColor">
            <path d="M10 0C5.5 0 1 7 1 7s4.5 7 9 7 9-7 9-7S14.5 0 10 0zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zM10 5a2 2 0 100 4 2 2 0 000-4z"/>
          </svg>
        </div>` : '';

      // Mini cards (fanned)
      const cardCount = game.cardCounts[p.token] || 0;
      const cardHtml = Array.from({ length: cardCount }, (_, ci) =>
        `<div class="card face-down" aria-hidden="true" style="transform:rotate(${(ci - 1) * 8}deg) translateY(${Math.abs(ci-1)*2}px)">
          <div class="card-front"></div>
          <div class="card-back">${buildMiniCardBack()}</div>
        </div>`
      ).join('');

      seat.innerHTML = `
        <div class="seat-avatar-wrap">
          <div class="seat-avatar"
               style="background:${p.avatarColor}"
               aria-label="${escHtml(p.name)}${isTurn ? ', current turn' : ''}${isPacked ? ', packed' : ''}">
            ${p.name.charAt(0).toUpperCase()}
          </div>
          ${dealerHtml}
          ${seenBadge}
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

      if (isTurn) {
        UI.startTimerBar(seat, game.turnDeadline);
      }
    });
  }

  function buildMiniCardBack() {
    return `<svg width="100%" height="100%" viewBox="0 0 20 30" xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="30" rx="2" fill="#1a4035"/>
      <rect x="1" y="1" width="18" height="28" rx="1.5" fill="none" stroke="#22854d" stroke-width="1"/>
    </svg>`;
  }

  // ─── My Cards ─────────────────────────────────────────────────────────
  function setMyCards(cards) {
    _myCards = cards;
    // Deal face-down — player must click "See" to reveal
    renderMyCards(cards, /* faceDown= */ true);
  }

  /**
   * Render my cards.
   * faceDown=true  → card backs shown (Blind state)
   * faceDown=false → card faces shown (Seen state)
   */
  function renderMyCards(cards, faceDown) {
    const area = document.getElementById('my-cards-area');
    area.innerHTML = '';
    if (!cards) return;

    cards.forEach((card, idx) => {
      const el = UI.createCardElement(card.rank, card.suit, faceDown);
      if (!UI.REDUCED_MOTION) {
        el.classList.add('dealing');
        el.style.animationDelay = `${idx * 0.15}s`;
      }
      area.appendChild(el);
    });
  }

  /** Flip my cards face-up (called when server confirms "see") */
  function revealMyCards() {
    if (!_myCards) return;
    const area = document.getElementById('my-cards-area');
    const cardEls = area.querySelectorAll('.card');
    cardEls.forEach((el, i) => {
      setTimeout(() => UI.flipCard(el), i * 120);
    });
  }

  // ─── Pot & status ─────────────────────────────────────────────────────
  function updatePot(amount) {
    document.getElementById('pot-amount').textContent = amount;
  }

  function updateRoundLabel(n) {
    document.getElementById('game-round-label').textContent = `Round ${n}`;
  }

  // ─── Action buttons ───────────────────────────────────────────────────
  function updateActionButtons(snapshot) {
    const game = snapshot.game;
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

    // Disable all first
    Object.values(btns).forEach(b => { b.disabled = true; });
    infoEl.textContent = '';

    if (snapshot.status === 'lobby' && !game) {
      // Round ended, show next round controls
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

    const myToken = App.myToken;
    const isMyTurn = game.activePlayers[game.turnIndex % Math.max(1, game.activePlayers.length)] === myToken;
    const isActive = game.activePlayers.includes(myToken);
    const isSeen   = game.seenStatus[myToken];
    const can2Player = game.activePlayers.length === 2;

    if (!isActive) {
      infoEl.textContent = 'You have packed this round.';
      return;
    }

    if (!isMyTurn) {
      const currentToken = game.activePlayers[game.turnIndex % Math.max(1, game.activePlayers.length)];
      const currentPlayer = snapshot.players.find(p => p.token === currentToken);
      infoEl.textContent = currentPlayer ? `${currentPlayer.name}'s turn` : 'Waiting…';
      return;
    }

    // It's my turn
    const stake = game.currentStake;
    const mySeen = isSeen;
    const chaalCost = mySeen ? stake * 2 : stake;
    const raiseCost = chaalCost * 2;

    btns.pack.disabled  = false;
    btns.chaal.disabled = false;
    btns.raise.disabled = false;

    if (!mySeen) btns.see.disabled = false;
    if (can2Player) btns.show.disabled = false;

    const myPlayer = snapshot.players.find(p => p.token === myToken);
    const myChips  = myPlayer ? myPlayer.chips : 0;

    if (myChips < chaalCost) btns.chaal.disabled = true;
    if (myChips < raiseCost) btns.raise.disabled = true;

    // Update button labels with amounts
    btns.chaal.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
      Chaal <span style="font-size:0.75em;opacity:0.8">(${chaalCost})</span>`;

    btns.raise.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <path d="M6.5 1l1.4 3 3.6.5-2.5 2.5.6 3.5L6.5 9 3.4 10.5l.6-3.5L1.5 4.5l3.6-.5z"/>
      </svg>
      Raise <span style="font-size:0.75em;opacity:0.8">(${raiseCost})</span>`;

    infoEl.textContent = `Your turn · ${mySeen ? 'Seen' : 'Blind'} · Stake: ${stake}`;
  }

  // ─── Event handlers ───────────────────────────────────────────────────
  function handleEvent(ev) {
    const { type, data } = ev;

    switch (type) {
      case 'roundStart': {
        updatePot(data.pot);
        updateRoundLabel(data.roundNumber);
        hideBanner();
        // New round — re-deal face-down (player is Blind again)
        if (_myCards) renderMyCards(_myCards, true);
        break;
      }
      case 'chaal':
      case 'raise': {
        updatePot(data.pot);
        animateChipFromSeat(data.token, data.amount);
        const pName = getPlayerName(data.token);
        UI.showToast(`${pName} ${type === 'raise' ? 'raised' : 'chaaled'} ${data.amount}`);
        break;
      }
      case 'pack':
      case 'autoPack': {
        const pName = getPlayerName(data.token);
        UI.showToast(`${pName} packed`);
        markSeatPacked(data.token);
        break;
      }
      case 'playerSeen': {
        const pName = getPlayerName(data.token);
        if (data.token === App.myToken) {
          // Flip MY cards face-up with animation
          revealMyCards();
        } else {
          UI.showToast(`${pName} looked at their cards`);
        }
        break;
      }
      case 'show': {
        const pName = getPlayerName(data.token);
        UI.showToast(`${pName} called Show!`);
        break;
      }
    }
  }

  function handleRoundEnd(result) {
    const winnerPlayer = _snapshot ? _snapshot.players.find(p => p.token === result.winnerToken) : null;
    const winnerName = winnerPlayer ? winnerPlayer.name : 'Player';

    // Reveal hands
    if (result.hands) {
      for (const [token, cards] of Object.entries(result.hands)) {
        if (token === App.myToken) {
          renderMyCards(cards, false);
        } else {
          revealOpponentCards(token, cards);
        }
      }
    }

    // Show banner
    const handType = result.handCategories && result.handCategories[result.winnerToken]
      ? formatCategory(result.handCategories[result.winnerToken])
      : '';
    showBanner(winnerName, handType, result.pot);

    // Confetti if I won
    if (result.winnerToken === App.myToken) {
      UI.fireConfetti();
      UI.showToast(`You won ${result.pot} chips!`);
    } else {
      UI.showToast(`${winnerName} won! (${handType})`);
    }

    // Clear my cards after delay
    _roundEndTimer = setTimeout(() => {
      _myCards = null;
    }, 5000);
  }

  function revealOpponentCards(token, cards) {
    const seat = document.querySelector(`.seat[data-token="${token}"]`);
    if (!seat) return;

    const cardEls = seat.querySelectorAll('.card');
    cards.forEach((card, i) => {
      if (cardEls[i]) {
        // Replace mini card with revealed version (still mini sized)
        const newCard = UI.createCardElement(card.rank, card.suit, true, true);
        cardEls[i].parentNode.replaceChild(newCard, cardEls[i]);
        setTimeout(() => UI.flipCard(newCard), i * 100);
      }
    });
  }

  function showBanner(name, handType, pot) {
    // Small top banner inside table
    const wb = document.getElementById('winner-banner');
    if (wb) {
      wb.innerHTML = `<span>${escHtml(name)}</span> has won this round`;
      wb.classList.add('visible');
    }

    // Full overlay banner
    const banner = document.getElementById('round-end-banner');
    document.getElementById('banner-winner-name').textContent = name + ' wins!';
    document.getElementById('banner-hand-type').textContent =
      handType ? `${handType} · ${pot} chips` : `${pot} chips`;
    banner.classList.add('visible');
    setTimeout(hideBanner, 5000);
  }

  function hideBanner() {
    document.getElementById('round-end-banner').classList.remove('visible');
    const wb = document.getElementById('winner-banner');
    if (wb) wb.classList.remove('visible');
  }

  function formatCategory(cat) {
    return {
      TRAIL: 'Trail',
      PURE_SEQUENCE: 'Pure Sequence',
      SEQUENCE: 'Sequence',
      COLOR: 'Color',
      PAIR: 'Pair',
      HIGH_CARD: 'High Card',
    }[cat] || cat;
  }

  function markSeatPacked(token) {
    const seat = document.querySelector(`.seat[data-token="${token}"]`);
    if (seat) seat.classList.add('packed');
  }

  function animateChipFromSeat(token, amount) {
    if (UI.REDUCED_MOTION) return;
    const seat = document.querySelector(`.seat[data-token="${token}"]`);
    const potEl = document.getElementById('pot-display');
    if (seat && potEl) UI.animateChipToPot(seat, potEl);
  }

  function getPlayerName(token) {
    if (!_snapshot) return 'Player';
    const p = _snapshot.players.find(p => p.token === token);
    return p ? p.name : 'Player';
  }

  // ─── Main update ──────────────────────────────────────────────────────
  function update(snapshot) {
    _snapshot = snapshot;

    if (snapshot.game) {
      updatePot(snapshot.game.pot);
    }
    updateRoundLabel(snapshot.roundNumber || 1);
    renderSeats(snapshot);
    updateActionButtons(snapshot);

    // Render my cards: face-down if Blind, face-up if already Seen
    if (snapshot.status === 'playing' && _myCards) {
      const iAlreadySeen = snapshot.game && snapshot.game.seenStatus[App.myToken];
      renderMyCards(_myCards, !iAlreadySeen);
    }
  }

  // ─── Action button wiring ─────────────────────────────────────────────
  function bindActions() {
    ['see','chaal','raise','pack','show'].forEach(action => {
      document.getElementById(`btn-${action}`).addEventListener('click', () => {
        App.socket.emit('game:action', {
          code:  App.roomCode,
          token: App.myToken,
          type:  action,
        });
      });
    });

    document.getElementById('btn-next-round').addEventListener('click', () => {
      App.socket.emit('game:nextRound', { code: App.roomCode, token: App.myToken });
    });

    document.getElementById('btn-end-game').addEventListener('click', () => {
      App.socket.emit('game:end', { code: App.roomCode, token: App.myToken });
    });
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  document.addEventListener('DOMContentLoaded', bindActions);

  return { update, setMyCards, handleEvent, handleRoundEnd };
})();
