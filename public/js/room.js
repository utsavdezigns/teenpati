'use strict';

window.Room = (() => {
  let _snapshot = null;

  function update(snapshot) {
    _snapshot = snapshot;
    renderPlayers(snapshot);
    renderSettings(snapshot);
    updateStartButton(snapshot);
    document.getElementById('room-code-display').textContent = snapshot.code;
    document.getElementById('game-code-display').textContent = snapshot.code;
  }

  function renderPlayers(snapshot) {
    const list = document.getElementById('room-player-list');
    list.innerHTML = '';

    for (const p of snapshot.players) {
      const item = document.createElement('div');
      item.className = 'player-item';
      item.setAttribute('role', 'listitem');

      const badges = [];
      if (p.isHost) badges.push(`<span class="badge badge-host">Host</span>`);
      if (!p.connected) badges.push(`<span class="badge badge-disconnected">Away</span>`);

      item.innerHTML = `
        <div class="avatar" style="background:${p.avatarColor}" aria-hidden="true">
          ${p.name.charAt(0)}
        </div>
        <div class="player-name-row">
          <span style="font-weight:600">${escHtml(p.name)}</span>
          ${badges.join('')}
          ${p.token === App.myToken ? '<span style="font-size:0.7rem;color:var(--text-dim)">(you)</span>' : ''}
        </div>
        <div class="chip-count">&#x25CF; ${p.chips}</div>
      `;
      list.appendChild(item);
    }
  }

  function renderSettings(snapshot) {
    const panel = document.getElementById('settings-panel');
    // Only host can edit; others see read-only view
    const isHost = App.isHost;
    panel.style.display = 'block';

    const bootInput  = document.getElementById('setting-boot');
    const limitInput = document.getElementById('setting-limit');
    const pointsCb   = document.getElementById('setting-points');

    bootInput.value   = snapshot.settings.bootAmount;
    limitInput.value  = snapshot.settings.stakeLimitMultiplier;
    pointsCb.checked  = snapshot.settings.pointMode;

    bootInput.disabled  = !isHost;
    limitInput.disabled = !isHost;
    pointsCb.disabled   = !isHost;
  }

  function updateStartButton(snapshot) {
    const btn = document.getElementById('btn-start-game');
    const msg = document.getElementById('waiting-message');
    const connectedCount = snapshot.players.filter(p => p.connected).length;
    const canStart = App.isHost && connectedCount >= 2;

    btn.disabled = !canStart;

    if (!App.isHost) {
      msg.textContent = 'Waiting for the host to start…';
      btn.style.display = 'none';
    } else {
      btn.style.display = 'block';
      if (connectedCount < 2) {
        msg.textContent = `Waiting for players… (${connectedCount}/2 minimum)`;
      } else {
        msg.textContent = `${connectedCount} player${connectedCount !== 1 ? 's' : ''} ready`;
      }
    }
  }

  function bindEvents() {
    // Copy code
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('room-code-display').textContent;
      navigator.clipboard.writeText(code).then(() => UI.showToast('Room code copied!'));
    });

    // Start game
    document.getElementById('btn-start-game').addEventListener('click', () => {
      if (!_snapshot) return;
      // Apply current settings before starting
      const boot  = parseInt(document.getElementById('setting-boot').value)  || 10;
      const limit = parseInt(document.getElementById('setting-limit').value) || 8;
      const pts   = document.getElementById('setting-points').checked;
      App.socket.emit('room:settings', {
        code: App.roomCode,
        token: App.myToken,
        settings: { bootAmount: boot, stakeLimitMultiplier: limit, pointMode: pts },
      });
      App.socket.emit('game:start', { code: App.roomCode, token: App.myToken });
    });

    // Leave room
    document.getElementById('btn-leave-room').addEventListener('click', () => {
      localStorage.removeItem('tp_token');
      localStorage.removeItem('tp_room');
      App.myToken  = null;
      App.roomCode = null;
      App.snapshot = null;
      App.myCards  = null;
      App.socket.disconnect();
      App.socket.connect();
      UI.showScreen('screen-lobby');
      window.location.hash = '';
    });

    // Settings changes (live, host only)
    ['setting-boot','setting-limit'].forEach(id => {
      document.getElementById(id).addEventListener('change', sendSettings);
    });
    document.getElementById('setting-points').addEventListener('change', sendSettings);
  }

  function sendSettings() {
    if (!App.isHost) return;
    App.socket.emit('room:settings', {
      code: App.roomCode,
      token: App.myToken,
      settings: {
        bootAmount:          parseInt(document.getElementById('setting-boot').value)  || 10,
        stakeLimitMultiplier:parseInt(document.getElementById('setting-limit').value) || 8,
        pointMode:           document.getElementById('setting-points').checked,
      }
    });
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  document.addEventListener('DOMContentLoaded', bindEvents);

  return { update };
})();
