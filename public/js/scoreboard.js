'use strict';

window.Scoreboard = (() => {
  let _lastOrder = [];

  function update(snapshot) {
    const list = document.getElementById('scoreboard-list');
    const historyList = document.getElementById('round-history-list');
    if (!list) return;

    // Sort by points descending
    const sorted = [...snapshot.players].sort((a, b) => b.points - a.points);

    // Animate reordering if order changed
    const newOrder = sorted.map(p => p.token);
    const orderChanged = newOrder.join() !== _lastOrder.join();
    _lastOrder = newOrder;

    list.innerHTML = '';
    sorted.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'scoreboard-item';
      item.setAttribute('role', 'listitem');
      item.dataset.token = p.token;

      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';

      const trophyHtml = i === 0 ? `
        <span style="margin-left:4px;color:var(--gold)" aria-label="Leader">
          ${UI.SVG_ICONS.trophy.replace('viewBox', 'width="14" height="14" viewBox')}
        </span>` : '';

      item.innerHTML = `
        <div class="rank-badge ${rankClass}">${i + 1}</div>
        <div class="avatar avatar-sm" style="background:${p.avatarColor}" aria-hidden="true">
          ${p.name.charAt(0)}
        </div>
        <div class="score-name">
          ${escHtml(p.name)}
          ${p.token === App.myToken ? '<small style="color:var(--text-muted)">(you)</small>' : ''}
          ${trophyHtml}
        </div>
        <div class="score-pts ${p.points < 0 ? 'negative' : ''}" aria-label="${p.points} points">
          ${p.points > 0 ? '+' : ''}${p.points}
        </div>
      `;

      // Animate if order changed
      if (orderChanged && !UI.REDUCED_MOTION) {
        item.style.transform = 'translateY(20px)';
        item.style.opacity = '0';
        requestAnimationFrame(() => {
          item.style.transition = `transform 0.4s cubic-bezier(.4,0,.2,1) ${i * 0.05}s, opacity 0.3s ${i * 0.05}s`;
          item.style.transform = '';
          item.style.opacity = '';
        });
      }

      list.appendChild(item);
    });

    // Round history
    if (snapshot.roundHistory && snapshot.roundHistory.length > 0) {
      historyList.innerHTML = '';
      [...snapshot.roundHistory].reverse().slice(0, 10).forEach(r => {
        const winnerPlayer = snapshot.players.find(p => p.token === r.winnerToken);
        const winnerName = winnerPlayer ? winnerPlayer.name : 'Unknown';
        const item = document.createElement('div');
        item.className = 'round-item';
        item.innerHTML = `<span>R${r.roundNumber}: <strong>${escHtml(winnerName)}</strong> wins</span><span class="round-pot">+${r.pot} chips</span>`;
        historyList.appendChild(item);
      });
    }
  }

  function handleRoundEnd(result) {
    // Save to localStorage if we have point mode data
    if (!App.snapshot || !App.snapshot.settings.pointMode) return;

    // Update scoreboard immediately
    if (App.snapshot) update(App.snapshot);
  }

  function savePastGame(snapshot) {
    if (!snapshot.settings.pointMode) return;

    const scores = {};
    for (const p of snapshot.players) {
      scores[p.name] = p.points;
    }

    const record = {
      date: new Date().toISOString(),
      rounds: snapshot.roundNumber,
      scores,
      code: snapshot.code,
    };

    const existing = JSON.parse(localStorage.getItem('tp_past_games') || '[]');
    existing.push(record);
    // Keep last 20 games
    if (existing.length > 20) existing.splice(0, existing.length - 20);
    localStorage.setItem('tp_past_games', JSON.stringify(existing));
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { update, handleRoundEnd, savePastGame };
})();
