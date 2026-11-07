'use strict';

// ─── Lobby screen logic ───────────────────────────────────────────────────
window.Lobby = (() => {
  function init() {
    const btnCreate = document.getElementById('btn-create');
    const btnJoin   = document.getElementById('btn-join');
    const nameInput = document.getElementById('lobby-name');
    const codeInput = document.getElementById('lobby-code');

    // Restore name
    const savedName = localStorage.getItem('tp_name');
    if (savedName) nameInput.value = savedName;

    btnCreate.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) { UI.showToast('Please enter your name'); nameInput.focus(); return; }
      App.myName = name;
      App.socket.emit('room:create', {
        name,
        settings: {} // use defaults, host can change in room
      });
    });

    btnJoin.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const code = codeInput.value.trim().toUpperCase();
      if (!name) { UI.showToast('Please enter your name'); nameInput.focus(); return; }
      if (code.length !== 4) { UI.showToast('Enter a 4-letter room code'); codeInput.focus(); return; }
      App.myName = name;
      App.socket.emit('room:join', { code, name, token: localStorage.getItem('tp_token') });
    });

    // Allow pressing Enter in code field
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnJoin.click();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (codeInput.value.trim().length === 4) btnJoin.click();
        else btnCreate.click();
      }
    });

    // Auto-uppercase code
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
    });

    loadPastGames();
  }

  function loadPastGames() {
    const games = JSON.parse(localStorage.getItem('tp_past_games') || '[]');
    const section = document.getElementById('past-games-section');
    const list    = document.getElementById('past-games-list');

    if (games.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = '';

    games.slice(-5).reverse().forEach(g => {
      const item = document.createElement('div');
      item.className = 'past-game-item';
      const winnerEntry = g.scores ? Object.entries(g.scores).sort((a,b) => b[1]-a[1])[0] : null;
      item.innerHTML = `
        <div class="pg-date">${new Date(g.date).toLocaleDateString()} · ${g.rounds} rounds</div>
        ${winnerEntry ? `<div class="pg-winner">${winnerEntry[0]} won (+${winnerEntry[1]} pts)</div>` : ''}
      `;
      list.appendChild(item);
    });
  }

  // Expose helper used in app.js
  document.addEventListener('DOMContentLoaded', init);

  return { loadPastGames };
})();
