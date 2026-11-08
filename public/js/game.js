'use strict';

window.Game = (() => {
  let _snapshot      = null;
  let _myCards       = null;   // null = blind, Card[] = seen
  let _roundEndTimer = null;

  // ── FIX #11: raise sheet state ────────────────────────────────────────
  let _raiseOptions  = [];     // [{label, multiplier, cost}]
  let _selectedRaise = null;

  // ─── FIX #1 #3 #10: Seat rendering ────────────────────────────────────
  function renderSeats(snapshot) {
    const container = document.getElementById('seats-container');
    container.innerHTML = '';
    if (!snapshot.game) return;

    const { players, game } = snapshot;
    const positions = UI.getSeatPositions(players.length);
    const n = Math.max(1, game.activePlayers.length);

    players.forEach((p, i) => {
      const { left, top } = positions[i];
      const isMyself = p.token === App.myToken;
      const isActive = game.activePlayers.includes(p.token);
      const isPacked = !isActive;
      const isTurn   = game.activePlayers[game.turnIndex % n] === p.token
                       && snapshot.status === 'playing';
      const isSeen   = !!game.seenStatus[p.token];

      // Dealer chip
      const isDealer = game.activePlayers[game.dealerIndex] === p.token;
      const dealerHtml = isDealer
        ? `<div class="dealer-chip" aria-label="Dealer">D</div>` : '';

      // FIX #10: blind/seen badge with eye icons (SVG only, no emoji)
      let badgeHtml = '';
      if (!isPacked && isActive) {
        if (isSeen) {
          badgeHtml = `<div class="seat-state-badge seen" title="${escHtml(p.name)} has seen">
            <svg width="10" height="7" viewBox="0 0 20 14" fill="currentColor">
              <path d="M10 0C5.5 0 1 7 1 7s4.5 7 9 7 9-7 9-7S14.5 0 10 0zm0 11.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9zM10 5a2 2 0 100 4 2 2 0 000-4z"/>
            </svg>
          </div>`;
        } else {
          badgeHtml = `<div class="seat-state-badge blind" title="${escHtml(p.name)} is blind">
            <svg width="10" height="8" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
              <path d="M2 2l16 12M5 5C3 6.5 1 9 1 9s4.5 6 9 6c1.5 0 3-.4 4.3-1M10 3c4.5 0 9 6 9 6s-1.5 3-3.5 4.5"/>
            </svg>
          </div>`;
        }
      }

      // FIX #10: SVG countdown ring overlay
      const sz = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--seat-sz')) || 60;
      const r  = (sz / 2) + 4;
      const c  = 2 * Math.PI * r;
      const timerSvg = `
        <svg class="seat-timer-ring" viewBox="0 0 ${sz + 8} ${sz + 8}" aria-hidden="true">
          <circle class="timer-ring-track" cx="${(sz+8)/2}" cy="${(sz+8)/2}" r="${r}"/>
          <circle class="timer-ring-bar"   cx="${(sz+8)/2}" cy="${(sz+8)/2}" r="${r}"
            style="stroke-dasharray:${c};stroke-dashoffset:0"/>
        </svg>`;

      // FIX #3: Mini card backs for opponents (not for myself — my cards are below)
      let cardHtml = '';
      if (!isMyself) {
        const cardCount = game.cardCounts[p.token] || 0;
        cardHtml = `<div class="seat-cards" aria-hidden="true">` +
          Array.from({ length: cardCount }, (_, ci) =>
            `<div class="mini-card" style="transform:rotate(${(ci-1)*8}deg) translateY(${Math.abs(ci-1)*2}px)">
              ${UI.buildMiniCardBack()}
            </div>`
          ).join('') + `</div>`;
      }

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
               aria-label="${escHtml(p.name)}${isTurn ? ', current turn' : ''}${isPacked ? ', packed' : ''}">
            ${p.name.charAt(0).toUpperCase()}
          </div>
          ${dealerHtml}
          ${badgeHtml}
          ${timerSvg}
        </div>
        <div class="seat-tag">
          <div class="seat-name">${escHtml(isMyself ? p.name + ' ★' : p.name)}</div>
        </div>
        <div class="seat-chips-badge">&#x25CF; ${p.chips}</div>
        ${cardHtml}`;

      container.appendChild(seat);
      if (isTurn) UI.startTimerRing(seat, game.turnDeadline);
    });
  }

  // ─── My card area ──────────────────────────────────────────────────────
  function showBlindCards() {
    _myCards = null;
    const area = document.getElementById('my-cards-area');
    area.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.className = 'card face-down';
      el.setAttribute('aria-label', 'Face-down card');
      el.innerHTML = `<div class="card-front"></div><div class="card-back">${UI.buildCardBack()}</div>`;
      if (!UI.REDUCED_MOTION) {
        el.classList.add('dealing-down');
        el.style.animationDelay = `${i * 0.14}s`;
      }
      area.appendChild(el);
    }
  }

  function setMyCards(cards) {
    _myCards = cards;
    const area  = document.getElementById('my-cards-area');
    const elems = area.querySelectorAll('.card');

    if (elems.length === 3) {
      cards.forEach((card, i) => {
        const newEl = UI.createCardElement(card.rank, card.suit, true);
        elems[i].replaceWith(newEl);
        setTimeout(() => UI.flipCard(newEl), 80 + i * 130);
      });
    } else {
      _renderMyCardsFaceUp(cards);
    }
  }

  function _renderMyCardsFaceUp(cards) {
    const area = document.getElementById('my-cards-area');
    area.innerHTML = '';
    cards.forEach((card, idx) => {
      const el = UI.createCardElement(card.rank, card.suit, false);
      if (!UI.REDUCED_MOTION) {
        el.classList.add('dealing-up');
        el.style.animationDelay = `${idx * 0.14}s`;
      }
      area.appendChild(el);
    });
  }

  // ─── Pot display ────────────────────────────────────────────────────────
  function updatePot(game) {
    if (!game) return;
    document.getElementById('pot-amount').textContent = game.pot;
    const sub = document.getElementById('pot-sub');
    if (sub) sub.textContent = `Boot: ${_snapshot?.settings?.bootAmount ?? '—'} · Stake: ${game.currentStake}`;
  }

  function updateRoundLabel(n) {
    const el = document.getElementById('game-round-label');
    if (el) el.textContent = `Round ${n}`;
  }

  function updatePlayerCount(snapshot) {
    const el = document.getElementById('game-player-count');
    if (!el) return;
    const active = snapshot.game ? snapshot.game.activePlayers.length : snapshot.players.filter(p => p.connected).length;
    el.textContent = `${active} player${active !== 1 ? 's' : ''}`;
  }

  // ─── FIX #7 #8 #9: Action buttons ─────────────────────────────────────
  function updateActionButtons(snapshot) {
    const game        = snapshot.game;
    const statusBar   = document.getElementById('game-status-bar');
    const statusMsg   = document.getElementById('game-status-msg');
    const nextRoundBtn= document.getElementById('btn-next-round');
    const endGameBtn  = document.getElementById('btn-end-game');
    const pill        = document.getElementById('status-pill');

    const btns = {
      see:   document.getElementById('btn-see'),
      chaal: document.getElementById('btn-chaal'),
      raise: document.getElementById('btn-raise'),
      pack:  document.getElementById('btn-pack'),
      show:  document.getElementById('btn-show'),
    };

    Object.values(btns).forEach(b => {
      b.disabled = true;
      // Reset tips
      b.setAttribute('data-tip', b.getAttribute('aria-label') || '');
    });

    if (snapshot.status === 'lobby' && !game) {
      statusBar.style.display = 'block';
      pill.className = 'status-pill waiting';
      if (App.isHost) {
        nextRoundBtn.style.display = 'block';
        endGameBtn.style.display   = 'block';
        pill.textContent = 'Round over — you can start another';
        statusMsg.textContent = '';
      } else {
        nextRoundBtn.style.display = 'none';
        endGameBtn.style.display   = 'none';
        pill.textContent = 'Waiting for host to start next round…';
        statusMsg.textContent = '';
      }
      return;
    }

    statusBar.style.display = 'none';
    nextRoundBtn.style.display = 'none';
    endGameBtn.style.display   = 'none';

    if (!game || snapshot.status !== 'playing') {
      pill.className = 'status-pill waiting';
      pill.textContent = 'Waiting…';
      return;
    }

    const myToken    = App.myToken;
    const n          = Math.max(1, game.activePlayers.length);
    const isMyTurn   = game.activePlayers[game.turnIndex % n] === myToken;
    const isActive   = game.activePlayers.includes(myToken);
    const isSeen     = !!game.seenStatus[myToken];
    const can2Player = game.activePlayers.length === 2;

    if (!isActive) {
      pill.className = 'status-pill packed';
      pill.textContent = 'You packed this round';
      return;
    }

    if (!isMyTurn) {
      const curTok = game.activePlayers[game.turnIndex % n];
      const curP   = snapshot.players.find(p => p.token === curTok);
      pill.className = 'status-pill waiting';
      pill.textContent = curP ? `${curP.name}'s turn…` : 'Waiting…';
      return;
    }

    // FIX #16: haptic on my turn
    if (!_lastMyTurn) UI.haptic(35);
    _lastMyTurn = true;

    const stake     = game.currentStake;
    const chaalCost = isSeen ? stake * 2 : stake;
    const raiseCost = chaalCost * 2;
    const myChips   = snapshot.players.find(p => p.token === myToken)?.chips ?? 0;
    const stakeLimit = (snapshot.settings?.bootAmount ?? 10) * (snapshot.settings?.stakeLimitMultiplier ?? 8);

    // FIX #8: status pill highlighted gold
    pill.className = 'status-pill my-turn';
    pill.textContent = `Your turn · ${isSeen ? 'Seen' : 'Blind'} · Stake ${stake}`;

    btns.pack.disabled  = false;
    btns.pack.setAttribute('data-tip', '');

    btns.chaal.disabled = myChips < chaalCost;
    btns.chaal.setAttribute('data-tip', myChips < chaalCost ? 'Not enough chips' : '');
    const chaalChip = document.getElementById('chaal-cost');
    if (chaalChip) chaalChip.textContent = chaalCost;

    const raiseLimited = stake * 2 > stakeLimit;
    btns.raise.disabled = myChips < raiseCost || raiseLimited;
    btns.raise.setAttribute('data-tip',
      raiseLimited ? 'Stake limit reached' :
      myChips < raiseCost ? 'Not enough chips' : '');
    const raiseChip = document.getElementById('raise-cost');
    if (raiseChip) raiseChip.textContent = raiseCost;

    if (!isSeen) {
      btns.see.disabled = false;
      btns.see.setAttribute('data-tip', '');
    } else {
      btns.see.setAttribute('data-tip', 'Already seen');
    }

    if (can2Player) {
      btns.show.disabled = false;
      btns.show.setAttribute('data-tip', '');
    } else {
      btns.show.setAttribute('data-tip', `${game.activePlayers.length} players left — need 2`);
    }

    // FIX #11: build raise options for sheet
    _buildRaiseOptions(chaalCost, stakeLimit, myChips);
  }

  let _lastMyTurn = false;

  // ─── FIX #11: Raise sheet ─────────────────────────────────────────────
  function _buildRaiseOptions(chaalCost, limit, myChips) {
    _raiseOptions = [];
    const opts = [
      { label: '2×', mult: 2,  cost: chaalCost * 2 },
      { label: '4×', mult: 4,  cost: chaalCost * 4 },
      { label: 'Max', mult: null, cost: Math.min(myChips, chaalCost * Math.floor(limit / chaalCost)) },
    ];
    opts.forEach(o => { if (o.cost > 0 && o.cost <= myChips) _raiseOptions.push(o); });

    const container = document.getElementById('raise-options');
    if (!container) return;
    container.innerHTML = '';
    _raiseOptions.forEach((o, idx) => {
      const btn = document.createElement('button');
      btn.className = 'raise-opt-btn';
      btn.innerHTML = `<span>${o.cost}</span><span class="ro-label">${o.label}</span>`;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.raise-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _selectedRaise = o;
      });
      if (idx === 0) { btn.classList.add('active'); _selectedRaise = o; }
      container.appendChild(btn);
    });
  }

  function openRaiseSheet() {
    document.getElementById('raise-sheet')?.classList.add('open');
  }
  function closeRaiseSheet() {
    document.getElementById('raise-sheet')?.classList.remove('open');
    _selectedRaise = null;
  }

  // ─── Game events ───────────────────────────────────────────────────────
  function handleEvent(ev) {
    const { type, data } = ev;
    switch (type) {
      case 'roundStart': {
        updatePot(_snapshot?.game);
        updateRoundLabel(data.roundNumber);
        _hideOverlay();
        showBlindCards();
        _lastMyTurn = false;
        UI.clearActionLog();
        break;
      }
      case 'chaal':
      case 'raise': {
        updatePot({ pot: data.pot, currentStake: data.currentStake ?? _snapshot?.game?.currentStake ?? 0 });
        UI.animateChipToPot(
          document.querySelector(`.seat[data-token="${data.token}"]`) || document.body,
          document.getElementById('pot-display') || document.body
        );
        const pName = _getPlayerName(data.token);
        const msg = `${pName} ${type === 'raise' ? 'raised' : 'chaaled'} ${data.amount}`;
        UI.showToast(msg);
        UI.addActionLog(msg);
        break;
      }
      case 'pack':
      case 'autoPack': {
        const pName = _getPlayerName(data.token);
        const msg = `${pName} packed`;
        UI.showToast(msg);
        UI.addActionLog(msg);
        _markSeatPacked(data.token);
        break;
      }
      case 'playerSeen': {
        if (data.token !== App.myToken) {
          const msg = `${_getPlayerName(data.token)} looked at cards`;
          UI.showToast(msg);
          UI.addActionLog(msg);
        }
        break;
      }
      case 'show': {
        const msg = `${_getPlayerName(data.token)} called Show!`;
        UI.showToast(msg);
        UI.addActionLog(msg);
        break;
      }
    }
  }

  // ─── FIX #13: Show result overlay ─────────────────────────────────────
  function handleRoundEnd(result) {
    const winnerPlayer = _snapshot?.players.find(p => p.token === result.winnerToken);
    const winnerName   = winnerPlayer?.name || 'Player';
    const handType     = result.handCategories?.[result.winnerToken]
      ? _formatCat(result.handCategories[result.winnerToken]) : '';

    // Reveal cards in overlay
    const handsEl = document.getElementById('reb-hands');
    if (handsEl && result.hands) {
      handsEl.innerHTML = '';
      for (const [token, cards] of Object.entries(result.hands)) {
        const p = _snapshot?.players.find(pl => pl.token === token);
        const isWinner = token === result.winnerToken;
        const group = document.createElement('div');
        group.className = 'reb-hand-group' + (isWinner ? ' winner' : '');

        const label = document.createElement('div');
        label.className = 'reb-player-label';
        label.textContent = p?.name || 'Player';
        group.appendChild(label);

        const row = document.createElement('div');
        row.className = 'reb-cards-row';
        cards.forEach((card, i) => {
          const el = UI.createCardElement(card.rank, card.suit, true);
          el.style.width = '48px'; el.style.height = '68px';
          row.appendChild(el);
          setTimeout(() => UI.flipCard(el), 200 + i * 140);
        });
        group.appendChild(row);
        handsEl.appendChild(group);
      }
    }

    // Reveal winner name + hand
    const wnEl = document.getElementById('reb-winner-name');
    if (wnEl) wnEl.textContent = winnerName + ' wins!';
    const htEl = document.getElementById('reb-hand-type');
    if (htEl) htEl.textContent = handType ? `${handType} · ${result.pot} chips` : `${result.pot} chips`;

    // Next round button in overlay (host only)
    const actEl = document.getElementById('reb-action');
    if (actEl) {
      actEl.innerHTML = '';
      if (App.isHost) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.style.cssText = 'min-width:140px;margin-top:4px';
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3l9 5-9 5V3z"/></svg> Next Round`;
        btn.addEventListener('click', () => {
          App.socket.emit('game:nextRound', { code: App.roomCode, token: App.myToken });
          _hideOverlay();
        });
        actEl.appendChild(btn);
      }
    }

    // Show overlay
    const overlay = document.getElementById('round-end-overlay');
    if (overlay) overlay.classList.add('visible');

    // Small winner banner inside table
    const wb = document.getElementById('winner-banner');
    if (wb) { wb.innerHTML = `<span>${escHtml(winnerName)}</span> won this round`; wb.classList.add('visible'); }

    // Confetti + toast
    if (result.winnerToken === App.myToken) {
      UI.fireConfetti();
      UI.showToast(`You won ${result.pot} chips!`);
    } else {
      UI.showToast(`${winnerName} wins! (${handType})`);
    }

    // Reveal MY cards in hand area too
    if (result.hands?.[App.myToken]) {
      _renderMyCardsFaceUp(result.hands[App.myToken]);
    }

    // Reveal opponents in their seats
    for (const [token, cards] of Object.entries(result.hands || {})) {
      if (token !== App.myToken) _revealOpponentCards(token, cards);
    }

    _roundEndTimer = setTimeout(() => { _myCards = null; }, 6000);
  }

  function _hideOverlay() {
    document.getElementById('round-end-overlay')?.classList.remove('visible');
    document.getElementById('winner-banner')?.classList.remove('visible');
  }

  function _revealOpponentCards(token, cards) {
    const seat = document.querySelector(`.seat[data-token="${token}"]`);
    if (!seat) return;
    const existing = seat.querySelectorAll('.mini-card');
    const row = document.createElement('div');
    row.className = 'reb-cards-row';
    row.style.cssText = 'gap:3px;margin-top:3px;justify-content:center;display:flex';
    cards.forEach((card, i) => {
      const el = UI.createCardElement(card.rank, card.suit, true);
      el.style.cssText = 'width:20px;height:30px;border-radius:3px';
      row.appendChild(el);
      setTimeout(() => UI.flipCard(el), i * 100);
    });
    existing.forEach(e => e.remove());
    seat.querySelector('.seat-cards')?.replaceWith(row);
  }

  function _renderMyCardsFaceUp(cards) {
    const area = document.getElementById('my-cards-area');
    area.innerHTML = '';
    cards.forEach((card, idx) => {
      const el = UI.createCardElement(card.rank, card.suit, false);
      if (!UI.REDUCED_MOTION) {
        el.classList.add('dealing-up');
        el.style.animationDelay = `${idx * 0.14}s`;
      }
      area.appendChild(el);
    });
  }

  function _markSeatPacked(token) {
    document.querySelector(`.seat[data-token="${token}"]`)?.classList.add('packed');
  }

  function _getPlayerName(token) {
    return _snapshot?.players.find(p => p.token === token)?.name || 'Player';
  }

  function _formatCat(cat) {
    return { TRAIL:'Trail', PURE_SEQUENCE:'Pure Sequence', SEQUENCE:'Sequence',
             COLOR:'Color', PAIR:'Pair', HIGH_CARD:'High Card' }[cat] || cat;
  }

  // ─── Main update ────────────────────────────────────────────────────────
  function update(snapshot) {
    _snapshot = snapshot;

    // Header
    const codeEl = document.getElementById('game-code-display');
    if (codeEl) codeEl.textContent = snapshot.code;

    updatePot(snapshot.game);
    updateRoundLabel(snapshot.roundNumber || 1);
    updatePlayerCount(snapshot);
    renderSeats(snapshot);
    updateActionButtons(snapshot);

    // Reconnect: restore cards
    if (snapshot.status === 'playing' && snapshot.game) {
      const area     = document.getElementById('my-cards-area');
      const isSeen   = !!snapshot.game.seenStatus[App.myToken];
      const isActive = snapshot.game.activePlayers.includes(App.myToken);
      if (area.children.length === 0 && isActive) {
        if (isSeen && _myCards) _renderMyCardsFaceUp(_myCards);
        else showBlindCards();
      }
    }

    // Hide turn state if round ended
    if (snapshot.status !== 'playing') _lastMyTurn = false;
  }

  // ─── Bindings ────────────────────────────────────────────────────────────
  function bindActions() {
    // Standard actions
    ['see','chaal','pack','show'].forEach(action => {
      document.getElementById(`btn-${action}`)?.addEventListener('click', () => {
        App.socket.emit('game:action', { code: App.roomCode, token: App.myToken, type: action });
      });
    });

    // FIX #11: Raise opens sheet
    document.getElementById('btn-raise')?.addEventListener('click', () => {
      if (!document.getElementById('btn-raise').disabled) openRaiseSheet();
    });

    // Raise sheet confirm
    document.getElementById('raise-confirm')?.addEventListener('click', () => {
      App.socket.emit('game:action', { code: App.roomCode, token: App.myToken, type: 'raise' });
      closeRaiseSheet();
    });
    document.getElementById('raise-sheet-close')?.addEventListener('click', closeRaiseSheet);

    // Next round / end game
    document.getElementById('btn-next-round')?.addEventListener('click', () => {
      App.socket.emit('game:nextRound', { code: App.roomCode, token: App.myToken });
    });
    document.getElementById('btn-end-game')?.addEventListener('click', () => {
      App.socket.emit('game:end', { code: App.roomCode, token: App.myToken });
    });

    // FIX #14: tap code to copy
    document.getElementById('topbar-code-tap')?.addEventListener('click', () => {
      const code = document.getElementById('game-code-display')?.textContent;
      if (code && code !== '——') {
        navigator.clipboard?.writeText(code).then(() => UI.showToast('Code copied!'));
      }
    });

    // FIX #15: close scoreboard by tapping backdrop
    document.getElementById('scoreboard-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget)
        document.getElementById('scoreboard-overlay').classList.remove('open');
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  document.addEventListener('DOMContentLoaded', bindActions);
  return { update, setMyCards, handleEvent, handleRoundEnd };
})();
