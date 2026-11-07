'use strict';

window.Results = (() => {

  // ─── Main entry ────────────────────────────────────────────────────────
  function show(payload) {
    const { standings, roundSummary, totalRounds, settings } = payload;

    document.getElementById('results-subtitle').textContent =
      `${totalRounds} round${totalRounds !== 1 ? 's' : ''} played · Room ${payload.code}`;

    // Winner spotlight
    const winner = standings[0];
    if (winner) {
      const av = document.getElementById('winner-avatar');
      av.textContent    = winner.name.charAt(0).toUpperCase();
      av.style.background = winner.avatarColor;
      document.getElementById('winner-name-big').textContent = winner.name;
      document.getElementById('winner-chips-big').innerHTML =
        `<svg width="12" height="12" viewBox="0 0 20 20" fill="none" style="opacity:.7"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><text x="10" y="14" text-anchor="middle" font-size="9" font-weight="900" fill="currentColor" font-family="serif">₹</text></svg>
         ${winner.chips} chips` +
        (settings.pointMode
          ? `&nbsp;·&nbsp;<span style="font-size:.85em">${winner.points > 0 ? '+' : ''}${winner.points} pts</span>`
          : '');
    }

    renderStandings(standings, settings.pointMode);
    renderSettlement(standings, settings.pointMode);
    renderRoundSummary(roundSummary);

    if (winner && winner.token === App.myToken) {
      setTimeout(() => UI.fireConfetti(), 400);
    }
  }

  // ─── Standings ─────────────────────────────────────────────────────────
  function renderStandings(standings, pointMode) {
    const list = document.getElementById('standings-list');
    list.innerHTML = '';
    standings.forEach((s, i) => {
      const posClass = ['pos-1','pos-2','pos-3'][i] || 'pos-other';
      const netSign  = s.netChips > 0 ? '+' : '';
      const netClass = s.netChips > 0 ? 'positive' : s.netChips < 0 ? 'negative' : 'zero';
      const isMe     = s.token === App.myToken;
      const ptsHtml  = pointMode
        ? `<span class="standing-pts ${s.points < 0 ? 'neg' : ''}">${s.points > 0 ? '+' : ''}${s.points}pt</span>`
        : '';

      const item = document.createElement('div');
      item.className = 'standing-item';
      item.setAttribute('role', 'listitem');
      item.innerHTML = `
        <div class="standing-pos ${posClass}">${i + 1}</div>
        <div class="avatar avatar-sm" style="background:${s.avatarColor}" aria-hidden="true">
          ${s.name.charAt(0).toUpperCase()}
        </div>
        <div class="standing-info">
          <div class="standing-name">
            ${escHtml(s.name)}${isMe ? '<span class="standing-you">(you)</span>' : ''}
          </div>
        </div>
        ${ptsHtml}
        <div class="standing-chips-col">
          <div class="standing-chips">${s.chips}</div>
          <div class="standing-net ${netClass}">${netSign}${s.netChips}</div>
        </div>`;
      list.appendChild(item);
    });
  }

  // ─── DEBT SETTLEMENT ───────────────────────────────────────────────────
  /**
   * Minimum-transaction debt settlement.
   * Each player started with 1000 chips → netChips = chips - 1000.
   * Positive = winner (owed by others), negative = loser (owes others).
   * Algorithm: greedy — match largest debtor to largest creditor.
   */
  function renderSettlement(standings, pointMode) {
    const list = document.getElementById('settlement-list');
    list.innerHTML = '';

    // Build net array (copy so we can mutate)
    const nets = standings.map(s => ({
      token:       s.token,
      name:        s.name,
      avatarColor: s.avatarColor,
      net:         s.netChips,
    }));

    const transactions = computeSettlement(nets);

    if (transactions.length === 0) {
      list.innerHTML = `<div class="settle-empty">Everyone is even — no payments needed!</div>`;
      return;
    }

    transactions.forEach(tx => {
      const isPayerMe    = tx.payer.token    === App.myToken;
      const isReceiverMe = tx.receiver.token === App.myToken;
      const rowClass     = isPayerMe ? 'is-me-payer' : isReceiverMe ? 'is-me-receiver' : '';

      const row = document.createElement('div');
      row.className = `settle-row ${rowClass}`;
      row.innerHTML = `
        <!-- Payer -->
        <div class="settle-payer">
          <div class="avatar" style="background:${tx.payer.avatarColor};width:32px;height:32px;font-size:.8rem" aria-hidden="true">
            ${tx.payer.name.charAt(0).toUpperCase()}
          </div>
          <div class="settle-payer-name">${escHtml(tx.payer.name)}${isPayerMe ? ' <span style="font-size:.68rem;color:#f87171">(you)</span>' : ''}</div>
        </div>

        <!-- Arrow + amount -->
        <div class="settle-arrow">
          <div class="settle-arrow-line">pays</div>
          <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="settle-amount">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.5"/>
            <text x="10" y="14" text-anchor="middle" font-size="9" font-weight="900" fill="currentColor" font-family="serif">₹</text>
          </svg>
          ${tx.amount}
        </div>

        <!-- Arrow + receiver -->
        <div class="settle-arrow">
          <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true">
            <path d="M0 5h18M14 1l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="settle-arrow-line">to</div>
        </div>

        <!-- Receiver -->
        <div class="settle-receiver">
          <div class="settle-receiver-name">${escHtml(tx.receiver.name)}${isReceiverMe ? ' <span style="font-size:.68rem;color:#4ade80">(you)</span>' : ''}</div>
          <div class="avatar" style="background:${tx.receiver.avatarColor};width:32px;height:32px;font-size:.8rem" aria-hidden="true">
            ${tx.receiver.name.charAt(0).toUpperCase()}
          </div>
        </div>`;
      list.appendChild(row);
    });
  }

  /**
   * Greedy minimum-transaction settlement.
   * Returns array of { payer, receiver, amount }
   */
  function computeSettlement(players) {
    const debtors   = players.filter(p => p.net < 0).map(p => ({ ...p, bal: p.net })).sort((a,b) => a.bal - b.bal);
    const creditors = players.filter(p => p.net > 0).map(p => ({ ...p, bal: p.net })).sort((a,b) => b.bal - a.bal);

    const txns = [];
    let di = 0, ci = 0;

    while (di < debtors.length && ci < creditors.length) {
      const debtor   = debtors[di];
      const creditor = creditors[ci];
      const amount   = Math.min(-debtor.bal, creditor.bal);

      if (amount > 0) {
        txns.push({ payer: debtor, receiver: creditor, amount });
      }

      debtor.bal   += amount;
      creditor.bal -= amount;

      if (Math.abs(debtor.bal)   < 1) di++;
      if (Math.abs(creditor.bal) < 1) ci++;
    }
    return txns;
  }

  // ─── Round summary ─────────────────────────────────────────────────────
  function renderRoundSummary(rounds) {
    const list = document.getElementById('round-summary-list');
    list.innerHTML = '';

    if (!rounds || rounds.length === 0) {
      list.innerHTML = '<div style="padding:12px 14px;font-size:.78rem;color:var(--text-muted)">No round history</div>';
      return;
    }

    rounds.forEach(r => {
      const handCat = r.handCategories && r.handCategories[r.winnerToken]
        ? formatCat(r.handCategories[r.winnerToken]) : '';
      const item = document.createElement('div');
      item.className = 'round-summary-item';
      item.innerHTML = `
        <span class="rs-num">R${r.roundNumber}</span>
        <span class="rs-winner">${escHtml(r.winnerName)}</span>
        ${handCat ? `<span class="rs-hand">${handCat}</span>` : ''}
        <span class="rs-pot">+${r.pot}</span>`;
      list.appendChild(item);
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  function formatCat(c) {
    return { TRAIL:'Trail', PURE_SEQUENCE:'Pure Seq', SEQUENCE:'Sequence',
             COLOR:'Color', PAIR:'Pair', HIGH_CARD:'High Card' }[c] || c;
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Button bindings ────────────────────────────────────────────────────
  function bindActions() {
    document.getElementById('btn-play-again').addEventListener('click', () => {
      const name = localStorage.getItem('tp_name') || '';
      App.myToken = null; App.roomCode = null; App.myCards = null; App.snapshot = null;
      App.socket.disconnect();
      App.socket.connect();
      document.getElementById('lobby-name').value = name;
      UI.showScreen('screen-lobby');
    });

    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      App.myToken = null; App.roomCode = null; App.myCards = null; App.snapshot = null;
      App.socket.disconnect();
      App.socket.connect();
      UI.showScreen('screen-lobby');
    });
  }

  document.addEventListener('DOMContentLoaded', bindActions);
  return { show };
})();
