// DomiDom — Client-side game logic
'use strict';

// ── State ──────────────────────────────────────────────────────
let socket = null;
let currentUser = null;
let currentRoom = null;
let selectedTile = null;
let timerInterval = null;
let timerSeconds = 45;
let pendingRegUser = null;
let currentQueueProvince = null;
let adminUsers = [];

// ── Init ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadInitial();
  document.getElementById('loading-screen').style.display = 'none';
});

async function loadInitial() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const res = await api('GET', '/api/me', null, token);
      currentUser = { ...res, token };
      updateUIForLoggedIn();
    } catch { localStorage.removeItem('token'); }
  }
  loadProvinces();
  loadLeaderboard();
  loadOnlineCount();
  connectSocket();
}

// ── API helper ─────────────────────────────────────────────────
async function api(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token || currentUser?.token) opts.headers['x-token'] = token || currentUser.token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ── Socket ─────────────────────────────────────────────────────
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    if (currentUser?.token) socket.emit('auth', { token: currentUser.token });
  });

  socket.on('auth:ok', (data) => {
    if (currentUser) { currentUser = { ...currentUser, ...data }; updateUIForLoggedIn(); }
  });

  socket.on('coins:update', (coins) => {
    if (currentUser) { currentUser.coins = coins; updateWalletDisplay(); }
  });

  socket.on('online:count', (count) => {
    document.querySelectorAll('#online-count').forEach(el => el.textContent = count);
  });

  socket.on('leaderboard:update', renderLeaderboard);

  socket.on('room:update', (room) => {
    currentRoom = room;
    renderRoomLobby(room);
  });

  socket.on('match:start', ({ roomId }) => {
    document.getElementById('game-lobby').style.display = 'none';
    document.getElementById('game-main').style.display = 'grid';
  });

  socket.on('game:state', (state) => {
    renderGameState(state);
  });

  socket.on('timer:start', ({ seconds }) => {
    timerSeconds = seconds;
    startTimerUI(seconds);
  });

  socket.on('round:end', (result) => {
    const msg = result.type === 'capicua' ? '¡CAPICÚA! 🎯' :
                result.type === 'tranca' ? '¡TRANCA! 🔒' : '¡Ronda ganada!';
    showToast(msg, 'gold');
  });

  socket.on('match:end', (result) => {
    showWinOverlay(result);
  });

  socket.on('chat:message', (msg) => {
    appendChatMessage(msg);
  });

  socket.on('queue:joined', ({ province }) => {
    currentQueueProvince = province;
  });

  socket.on('room:created', ({ roomId }) => {
    showScreen('game');
    document.getElementById('game-room-code').textContent = roomId;
  });

  socket.on('room:error', (msg) => { showToast(msg, 'error'); });

  socket.on('friends:list', renderFriendsList);
  socket.on('friends:requests', renderFriendRequests);
  socket.on('friends:request', ({ from }) => {
    showToast(`${from} te envió una solicitud de amistad`, 'info');
  });
  socket.on('friends:request-sent', () => showToast('Solicitud enviada', 'success'));
  socket.on('friends:error', (msg) => showToast(msg, 'error'));
  socket.on('queue:error', (msg) => showToast(msg, 'error'));
}

// ── Auth ───────────────────────────────────────────────────────
async function doRegister() {
  const username = document.getElementById('reg-user').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const errEl = document.getElementById('reg-err');
  errEl.style.display = 'none';

  if (!username || !pass || !email) { showErr(errEl, 'Completa todos los campos requeridos'); return; }
  if (pass !== pass2) { showErr(errEl, 'Las contraseñas no coinciden'); return; }
  if (pass.length < 6) { showErr(errEl, 'Contraseña mínimo 6 caracteres'); return; }

  const btn = document.getElementById('btn-reg-submit');
  btn.disabled = true; btn.textContent = 'Creando cuenta…';

  try {
    const res = await api('POST', '/api/auth/register', { username, password: pass, email, phone });
    if (res.needsVerification) {
      pendingRegUser = username;
      document.getElementById('verify-email-display').textContent = email;
      showScreen('verify');
    } else {
      showToast('¡Cuenta creada! Inicia sesión.', 'success');
      showScreen('login');
    }
  } catch (e) { showErr(errEl, e.message); }
  finally { btn.disabled = false; btn.textContent = 'Crear Cuenta'; }
}

async function doVerify() {
  const code = document.getElementById('verify-code').value.trim().toUpperCase();
  const errEl = document.getElementById('verify-err');
  errEl.style.display = 'none';
  if (!pendingRegUser || !code) { showErr(errEl, 'Ingresa el código'); return; }

  try {
    const res = await api('POST', '/api/auth/verify', { username: pendingRegUser, code });
    currentUser = { ...res };
    localStorage.setItem('token', res.token);
    socket.emit('auth', { token: res.token });
    updateUIForLoggedIn();
    showScreen('home');
    showToast('¡Cuenta verificada! Bienvenido 🎉', 'success');
  } catch (e) { showErr(errEl, e.message); }
}

async function doResend() {
  if (!pendingRegUser) return;
  showToast('Código reenviado', 'info');
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';

  if (!username || !pass) { showErr(errEl, 'Ingresa usuario y contraseña'); return; }

  const btn = document.getElementById('btn-login-submit');
  btn.disabled = true; btn.textContent = 'Entrando…';

  try {
    const res = await api('POST', '/api/auth/login', { username, password: pass });
    currentUser = { ...res };
    localStorage.setItem('token', res.token);
    socket.emit('auth', { token: res.token });
    updateUIForLoggedIn();
    showScreen('home');
  } catch (e) {
    showErr(errEl, e.message);
    if (e.message.includes('verificada')) {
      pendingRegUser = username;
      setTimeout(() => showScreen('verify'), 1200);
    }
  }
  finally { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
}

function doLogout() {
  localStorage.removeItem('token');
  currentUser = null;
  location.reload();
}

// ── UI helpers ─────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  if (name === 'wallet') loadWallet();
  if (name === 'profile') loadProfile();
  if (name === 'friends') { loadFriends(); }
  if (name === 'admin') loadAdmin();
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', gold: '🪙' };
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function showErr(el, msg) { el.textContent = msg; el.style.display = 'flex'; }

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function updateUIForLoggedIn() {
  if (!currentUser) return;
  document.getElementById('btn-login-top').style.display = 'none';
  document.getElementById('btn-register-top').style.display = 'none';
  document.getElementById('wallet-pill-wrap').classList.remove('hidden');
  document.getElementById('btn-profile').classList.remove('hidden');
  document.getElementById('btn-logout').classList.remove('hidden');
  document.getElementById('nav-links').classList.remove('hidden');
  document.getElementById('topbar-username').textContent = currentUser.username;
  document.getElementById('hero-cta').style.display = 'none';
  document.getElementById('hero-cta-logged').style.display = 'flex';
  if (currentUser.isAdmin) {
    if (!document.getElementById('btn-admin-top')) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline btn-sm';
      btn.id = 'btn-admin-top';
      btn.textContent = '⚙️ Admin';
      btn.onclick = () => showScreen('admin');
      document.getElementById('topbar-right').insertBefore(btn, document.getElementById('btn-logout'));
    }
  }
  updateWalletDisplay();
  updateSidebarStats();
}

function updateWalletDisplay() {
  if (!currentUser) return;
  document.getElementById('topbar-balance').textContent = (currentUser.coins || 0).toLocaleString();
}

function updateSidebarStats() {
  if (!currentUser) return;
  document.getElementById('sidebar-stats-logged').style.display = 'block';
  document.getElementById('sidebar-stats-guest').style.display = 'none';
  const s = currentUser.stats || {};
  document.getElementById('stat-games').textContent = s.games || 0;
  document.getElementById('stat-wins').textContent = s.wins || 0;
  document.getElementById('stat-net').textContent = (s.earnings || 0).toLocaleString();
}

function scrollToProvinces() {
  if (!currentUser) { showScreen('login'); return; }
  document.getElementById('provinces-anchor')?.scrollIntoView({ behavior: 'smooth' });
}

function toggleSection(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── Provinces ──────────────────────────────────────────────────
async function loadProvinces() {
  try {
    const provinces = await api('GET', '/api/provinces');
    renderProvinces(provinces);
  } catch {}
}

function renderProvinces(provinces) {
  const grid = document.getElementById('province-grid');
  if (!grid) return;
  grid.innerHTML = provinces.map(p => `
    <div class="prov-card ${p.featured ? 'featured' : ''}" onclick="joinProvince('${p.id}', ${p.buyIn})">
      <div class="prov-name">${p.name}</div>
      <div class="prov-buyin">${p.buyIn.toLocaleString()} 🪙 <small>buy-in</small></div>
      <div class="prov-players">
        <span class="live-dot"></span>
        ${p.playersInQueue} en cola · ${p.activeTables} mesa${p.activeTables !== 1 ? 's' : ''}
      </div>
    </div>
  `).join('');
}

function joinProvince(provinceId, buyIn) {
  if (!currentUser) { showScreen('login'); return; }
  if (currentUser.coins < buyIn) { showToast('Saldo insuficiente', 'error'); return; }

  const prov = document.querySelector(`.prov-card[onclick*="${provinceId}"]`);
  document.getElementById('queue-province-name').textContent = prov?.querySelector('.prov-name')?.textContent || 'Cola';
  document.getElementById('queue-buyin-badge').textContent = `Buy-in: ${buyIn.toLocaleString()} 🪙`;
  openModal('modal-queue');
  socket.emit('queue:join', { provinceId });
}

function leaveQueue() {
  if (currentQueueProvince) socket.emit('queue:leave', { provinceId: currentQueueProvince.id });
  closeModal('modal-queue');
}

// ── Leaderboard ────────────────────────────────────────────────
async function loadLeaderboard() {
  try {
    const data = await api('GET', '/api/leaderboard');
    renderLeaderboard(data);
  } catch {}
}

function renderLeaderboard(data) {
  const el = document.getElementById('leaderboard-mini');
  if (!el || !data?.length) { if(el) el.innerHTML = '<div class="empty-state">Aún no hay datos</div>'; return; }
  el.innerHTML = data.slice(0, 5).map((u, i) => `
    <div class="lb-row">
      <span class="lb-rank ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}">${i + 1}</span>
      <div class="lb-avatar">${u.username[0].toUpperCase()}</div>
      <span class="lb-name">${u.username}</span>
      <span class="lb-amount">${u.earnings.toLocaleString()} 🪙</span>
    </div>
  `).join('');
}

async function loadOnlineCount() {
  try {
    const { count } = await api('GET', '/api/online');
    document.querySelectorAll('#online-count').forEach(el => el.textContent = count);
  } catch {}
}

// ── Wallet ─────────────────────────────────────────────────────
async function loadWallet() {
  if (!currentUser) { showScreen('login'); return; }
  try {
    const me = await api('GET', '/api/me');
    currentUser = { ...currentUser, ...me };
    document.getElementById('wallet-balance-display').textContent = `${me.coins.toLocaleString()} 🪙`;
    document.getElementById('wallet-net-display').textContent =
      `Net: ${(me.stats.earnings || 0).toLocaleString()} | Juegos: ${me.stats.games} | Victorias: ${me.stats.wins}`;
    renderTransactions(me.transactions || []);
  } catch {}
}

function renderTransactions(txs) {
  const el = document.getElementById('tx-list');
  if (!txs.length) { el.innerHTML = '<div class="empty-state">Sin transacciones</div>'; return; }
  el.innerHTML = txs.slice().reverse().map(tx => {
    const icons = { deposit: '💰', deposit_pending: '⏳', withdrawal_pending: '⏳', win: '🏆', loss: '💸', admin_credit: '✅', admin_debit: '❌' };
    const positive = tx.amount > 0;
    return `
      <div class="tx-item">
        <div class="tx-icon ${positive ? 'win' : 'loss'}">${icons[tx.type] || '🔄'}</div>
        <div class="tx-info">
          <div class="tx-title">${tx.type.replace(/_/g,' ')}</div>
          <div class="tx-date">${new Date(tx.date).toLocaleDateString('es-DO')}</div>
        </div>
        <div class="tx-amount ${positive ? 'positive' : 'negative'}">${positive ? '+' : ''}${tx.amount.toLocaleString()} 🪙</div>
      </div>
    `;
  }).join('');
}

// ── Profile ────────────────────────────────────────────────────
async function loadProfile() {
  if (!currentUser) return;
  try {
    const me = await api('GET', '/api/me');
    document.getElementById('profile-avatar-big').textContent = me.username[0].toUpperCase();
    document.getElementById('profile-name-display').textContent = me.username;
    document.getElementById('profile-sub-display').textContent = me.email;
    document.getElementById('p-games').textContent = me.stats.games;
    document.getElementById('p-wins').textContent = me.stats.wins;
    document.getElementById('p-net').textContent = me.stats.earnings.toLocaleString();
    document.getElementById('p-wr').textContent = me.stats.games > 0 ?
      `${Math.round((me.stats.wins / me.stats.games) * 100)}%` : '0%';
    if (me.isAdmin) {
      const row = document.getElementById('profile-badges-row');
      row.innerHTML = '<span class="badge badge-gold">⚙️ Admin</span>';
    }
  } catch {}
}

// ── Friends ────────────────────────────────────────────────────
function loadFriends() {
  if (!currentUser) return;
  socket.emit('friends:list');
}

function renderFriendsList(friends) {
  const el = document.getElementById('friends-list');
  if (!friends.length) { el.innerHTML = '<div class="empty-state">No tienes amigos todavía. ¡Busca jugadores!</div>'; return; }
  el.innerHTML = friends.map(f => `
    <div class="friend-item">
      <div class="friend-status-dot ${f.online ? 'online' : 'offline'}"></div>
      <div class="lb-avatar">${f.username[0].toUpperCase()}</div>
      <span style="flex:1;font-weight:600;">${f.username}</span>
      <span class="badge ${f.online ? 'badge-green' : 'badge-gray'}">${f.online ? 'En línea' : 'Desconectado'}</span>
    </div>
  `).join('');
}

function renderFriendRequests(requests) {
  const sec = document.getElementById('friend-req-section');
  const list = document.getElementById('friend-requests-list');
  if (!requests.length) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  list.innerHTML = requests.map(from => `
    <div class="friend-item">
      <div class="lb-avatar">${from[0].toUpperCase()}</div>
      <span style="flex:1;">${from}</span>
      <button class="btn btn-ghost-green btn-sm" onclick="acceptFriend('${from}')">✓ Aceptar</button>
    </div>
  `).join('');
}

function doAddFriend() {
  const username = document.getElementById('friend-search-inp').value.trim();
  if (!username) return;
  socket.emit('friends:add', { targetUsername: username });
  document.getElementById('friend-search-inp').value = '';
}

function acceptFriend(from) {
  socket.emit('friends:accept', { fromUsername: from });
}

// ── Friend Room ────────────────────────────────────────────────
function showFriendRoomModal() {
  if (!currentUser) { showScreen('login'); return; }
  openModal('modal-friend-room');
}

function switchFriendTab(tab) {
  document.getElementById('fr-create').style.display = tab === 'create' ? 'block' : 'none';
  document.getElementById('fr-join').style.display = tab === 'join' ? 'block' : 'none';
  document.querySelectorAll('#modal-friend-room .tab-pill').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'create') || (i === 1 && tab === 'join'));
  });
}

function doCreateRoom() {
  const buyIn = parseInt(document.getElementById('fr-buyin').value) || 0;
  if (currentUser.coins < buyIn) { document.getElementById('fr-err').textContent = 'Saldo insuficiente'; document.getElementById('fr-err').style.display = 'flex'; return; }
  closeModal('modal-friend-room');
  showScreen('game');
  socket.emit('room:create', { buyIn });
}

function doJoinRoom() {
  const code = document.getElementById('fr-code').value.trim().toUpperCase();
  if (!code) return;
  closeModal('modal-friend-room');
  showScreen('game');
  socket.emit('room:join', { roomId: code });
}

function leaveRoom() {
  showScreen('home');
  currentRoom = null;
}

function doAddBot() { socket.emit('room:add-bot'); }
function doStartGame() { socket.emit('room:start'); }

// ── Practice ───────────────────────────────────────────────────
function showPracticeModal() {
  if (!currentUser) { showScreen('login'); return; }
  const grid = document.getElementById('practice-levels');
  grid.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => `
    <button class="btn btn-outline" style="flex-direction:column;gap:2px;padding:12px 6px;" onclick="startPractice(${lvl})">
      <span style="font-size:1.2rem;">${['😊','🙂','😐','🤔','😬','😤','😠','👿','💀','🏆'][lvl - 1]}</span>
      <span style="font-size:0.75rem;">Nv ${lvl}</span>
    </button>
  `).join('');
  openModal('modal-practice');
}

function startPractice(level) {
  closeModal('modal-practice');
  showScreen('game');
  document.getElementById('game-room-code').textContent = `PRÁCTICA Nv.${level}`;
  document.getElementById('game-pot-badge').textContent = 'Sin apuesta';
  socket.emit('practice:start', { level });
}

// ── Room lobby render ──────────────────────────────────────────
function renderRoomLobby(room) {
  const seats = document.getElementById('lobby-seats-display');
  const info = document.getElementById('game-lobby-info');
  document.getElementById('game-room-code').textContent = room.id;
  document.getElementById('game-pot-badge').textContent = `Pote: ${(room.pot || 0).toLocaleString()} 🪙`;

  const filled = room.players.length;
  seats.innerHTML = Array.from({ length: 4 }, (_, i) => {
    const p = room.players.find(pl => pl.seatIndex === i);
    return `<div class="lobby-seat ${p ? 'filled' : ''}">
      <div class="ls-icon">${p ? (p.isBot ? '🤖' : '👤') : '⬜'}</div>
      <div style="font-size:0.8rem;font-weight:600;">${p ? p.username : `Asiento ${i + 1}`}</div>
      <div class="badge ${i < 2 ? 'badge-blue' : 'badge-red'}" style="font-size:0.65rem;">Team ${i < 2 ? 'A' : 'B'}</div>
    </div>`;
  }).join('');

  info.textContent = filled < 4 ? `${4 - filled} jugador${4 - filled !== 1 ? 'es' : ''} más necesario${4 - filled !== 1 ? 's' : ''}` : '¡Listos para jugar!';

  const isHost = room.players.find(p => p.username === currentUser?.username && room.host === p.username) ||
                 (room.host === currentUser?.username);
  const hostControls = document.getElementById('host-controls');
  hostControls.style.display = isHost ? 'flex' : 'none';
}

// ── Game state render ──────────────────────────────────────────
function renderGameState(state) {
  if (!state) return;

  // Scores
  document.getElementById('score-a').textContent = state.scores?.[0] ?? 0;
  document.getElementById('score-b').textContent = state.scores?.[1] ?? 0;

  // Board
  renderBoard(state.board || [], state.leftEnd, state.rightEnd);

  // My hand
  renderHand(state.myHand || [], state.legalMoves || [], state.currentPlayer);

  // Seats
  renderSeats(state);
}

function renderBoard(board, leftEnd, rightEnd) {
  const snake = document.getElementById('snake');
  if (!board.length) { snake.innerHTML = '<div style="color:rgba(255,255,255,0.2);font-size:0.9rem;padding:20px;">Esperando primera ficha…</div>'; return; }

  // Simplified linear render
  snake.innerHTML = board.map((tile, idx) => {
    const isDouble = tile[0] === tile[1];
    return `<div class="tile played" style="
      width:${isDouble ? 24 : 44}px;height:${isDouble ? 44 : 24}px;
      display:inline-flex;align-items:center;justify-content:center;
      background:linear-gradient(145deg,#fafafa,#e8e8e8);
      border:1px solid #bbb;border-radius:4px;
      font-size:0.65rem;font-weight:700;color:#333;
      margin:1px;flex-direction:${isDouble ? 'column' : 'row'};gap:1px;
    ">
      <span>${tile[0]}</span>
      <span style="width:${isDouble?'80%':'1px'};height:${isDouble?'1px':'80%'};background:#999;flex-shrink:0;"></span>
      <span>${tile[1]}</span>
    </div>`;
  }).join('');
}

function renderHand(hand, legalMoves, currentPlayerIdx) {
  const el = document.getElementById('my-hand');
  if (!hand.length) { el.innerHTML = ''; return; }

  const legalSet = new Set(legalMoves.map(t => `${t[0]}-${t[1]}`));

  el.innerHTML = hand.map((tile, i) => {
    const key = `${tile[0]}-${tile[1]}`;
    const isLegal = legalSet.has(key);
    const isSelected = selectedTile && selectedTile[0] === tile[0] && selectedTile[1] === tile[1];
    const isDouble = tile[0] === tile[1];

    return `<div class="hand-tile ${isLegal ? 'legal' : 'disabled'} ${isSelected ? 'selected' : ''}"
      style="width:${isDouble ? 28 : 50}px;height:${isDouble ? 50 : 28}px;flex-direction:${isDouble ? 'column' : 'row'};gap:2px;"
      onclick="selectTile(${tile[0]}, ${tile[1]})">
      <span style="font-size:0.8rem;font-weight:800;color:#333;">${tile[0]}</span>
      <span style="width:${isDouble?'80%':'1px'};height:${isDouble?'1px':'80%'};background:#999;flex-shrink:0;"></span>
      <span style="font-size:0.8rem;font-weight:800;color:#333;">${tile[1]}</span>
    </div>`;
  }).join('');

  // Show/hide action buttons
  const btnLeft = document.getElementById('btn-place-left');
  const btnRight = document.getElementById('btn-place-right');
  const btnPass = document.getElementById('btn-pass');

  if (selectedTile) {
    btnLeft.classList.remove('hidden');
    btnRight.classList.remove('hidden');
    btnPass.classList.add('hidden');
  } else if (legalMoves.length === 0) {
    btnLeft.classList.add('hidden');
    btnRight.classList.add('hidden');
    btnPass.classList.remove('hidden');
  } else {
    btnLeft.classList.add('hidden');
    btnRight.classList.add('hidden');
    btnPass.classList.add('hidden');
  }
}

function selectTile(a, b) {
  const key = `${a}-${b}`;
  if (selectedTile && selectedTile[0] === a && selectedTile[1] === b) {
    selectedTile = null;
  } else {
    selectedTile = [a, b];
  }
  // Re-render just the hand selection state
  const tiles = document.querySelectorAll('.hand-tile');
  tiles.forEach(t => t.classList.remove('selected'));
  if (selectedTile) {
    tiles.forEach(t => {
      const spans = t.querySelectorAll('span');
      if (spans[0]?.textContent == a && spans[2]?.textContent == b) t.classList.add('selected');
    });
  }
  document.getElementById('btn-place-left').classList.toggle('hidden', !selectedTile);
  document.getElementById('btn-place-right').classList.toggle('hidden', !selectedTile);
}

function placeSelectedLeft() {
  if (!selectedTile) return;
  socket.emit('game:play', { tile: selectedTile, side: 'left' });
  selectedTile = null;
}

function placeSelectedRight() {
  if (!selectedTile) return;
  socket.emit('game:play', { tile: selectedTile, side: 'right' });
  selectedTile = null;
}

function doPass() { socket.emit('game:pass'); }

function renderSeats(state) {
  // Simplified seat display — top shows opponents, bottom shows partners
  const seatsTop = document.getElementById('seats-top');
  const seatsBottom = document.getElementById('seats-bottom');
  seatsTop.innerHTML = `<div class="seat"><div class="seat-avatar ${state.currentPlayer === 2 ? 'active-turn' : ''}">?</div><div class="seat-tiles">${state.handCounts?.[2] ?? 0} fichas</div></div>`;
  seatsBottom.innerHTML = `<div class="seat"><div class="seat-avatar my-seat ${state.currentPlayer === 0 ? 'active-turn' : ''}">Tú</div><div class="seat-tiles">${state.myHand?.length ?? 0} fichas</div></div>`;
}

// ── Timer ──────────────────────────────────────────────────────
function startTimerUI(seconds) {
  clearInterval(timerInterval);
  timerSeconds = seconds;
  const bar = document.getElementById('timer-bar');
  const val = document.getElementById('timer-val');
  const timer = document.getElementById('turn-timer');

  timerInterval = setInterval(() => {
    timerSeconds--;
    if (timerSeconds <= 0) { clearInterval(timerInterval); timerSeconds = 0; }
    val.textContent = timerSeconds;
    const pct = (timerSeconds / seconds) * 100;
    bar.style.width = pct + '%';
    const urgent = timerSeconds <= 10;
    bar.classList.toggle('urgent', urgent);
    timer.classList.toggle('urgent', urgent);
    bar.style.background = urgent ? 'var(--red)' : 'var(--gold)';
  }, 1000);
}

// ── Chat ───────────────────────────────────────────────────────
function appendChatMessage(msg) {
  const el = document.getElementById('chat-msgs');
  const isSystem = msg.username === 'Sistema';
  const div = document.createElement('div');
  div.className = `chat-msg${isSystem ? ' system' : ''}`;
  div.innerHTML = isSystem ? msg.message :
    `<span class="chat-sender">${msg.username}:</span> ${msg.message}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function sendChat() {
  const inp = document.getElementById('chat-inp');
  const msg = inp.value.trim();
  if (!msg) return;
  socket.emit('chat:send', { message: msg });
  inp.value = '';
}

// ── Win overlay ────────────────────────────────────────────────
function showWinOverlay(result) {
  const overlay = document.getElementById('win-overlay');
  const title = document.getElementById('win-title-text');
  const coins = document.getElementById('win-coins-text');
  const breakdown = document.getElementById('win-breakdown');

  const myTeam = currentRoom?.players?.find(p => p.username === currentUser?.username)?.team ?? 0;
  const won = result.winnerTeam === myTeam;

  title.textContent = result.isPollona ? (won ? '¡POLLONA! 🎯' : '¡POLLONA! 😭') : (won ? '¡VICTORIA! 🏆' : '¡DERROTA! 💀');
  title.className = `win-title ${won ? (result.isPollona ? 'pollona' : 'victory') : 'loss'}`;
  coins.textContent = won ? `+${result.perPlayer?.toLocaleString() || 0} 🪙` : `-${currentRoom?.buyIn?.toLocaleString() || 0} 🪙`;
  breakdown.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
      <span>Team A</span><span>${result.scores?.[0] ?? 0} rondas</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;">
      <span>Team B</span><span>${result.scores?.[1] ?? 0} rondas</span>
    </div>
    ${result.type === 'capicua' ? '<div style="color:var(--gold);text-align:center;padding:8px 0;">¡Ganado por Capicúa! 🎯</div>' : ''}
  `;

  overlay.classList.add('show');
  if (won) launchConfetti();
}

function closeWinOverlay() {
  document.getElementById('win-overlay').classList.remove('show');
  showScreen('home');
  loadProvinces();
  loadLeaderboard();
  if (currentUser) {
    api('GET', '/api/me').then(me => { currentUser = { ...currentUser, ...me }; updateWalletDisplay(); updateSidebarStats(); }).catch(() => {});
  }
}

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width, y: -10,
    r: Math.random() * 6 + 3, d: Math.random() * 4 + 1,
    color: ['#f5c542','#00c853','#1e90ff','#ce1126','#ffffff'][Math.floor(Math.random() * 5)],
    tilt: Math.random() * 10 - 5, tiltAngle: 0,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r / 2, p.tiltAngle, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      p.y += p.d;
      p.tiltAngle += 0.1;
      p.x += Math.sin(frame / 10) * 0.5;
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
    });
    frame++;
    if (frame < 300) requestAnimationFrame(draw);
    else { canvas.style.display = 'none'; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  draw();
}

// ── Admin ──────────────────────────────────────────────────────
async function loadAdmin() {
  if (!currentUser?.isAdmin) return;
  try {
    adminUsers = await api('GET', '/api/admin/users');
    renderAdminUsers(adminUsers);
  } catch {}
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td><strong>${u.username}</strong></td>
      <td style="color:var(--text2);font-size:0.8rem;">${u.email}</td>
      <td style="color:var(--gold);font-weight:700;">${(u.coins || 0).toLocaleString()} 🪙</td>
      <td>${(u.stats?.earnings || 0).toLocaleString()}</td>
      <td>${u.stats?.games || 0}</td>
      <td><span class="badge ${u.banned ? 'badge-red' : 'badge-green'}">${u.banned ? 'Suspendido' : 'Activo'}</span></td>
      <td class="action-cell">
        <button class="btn btn-outline btn-sm" onclick="openGrantModal('${u.username}')">💰</button>
        <button class="btn btn-${u.banned ? 'ghost-green' : 'red'} btn-sm" onclick="toggleBan('${u.username}', ${!u.banned})">${u.banned ? '✓ Activar' : '🚫 Suspender'}</button>
      </td>
    </tr>
  `).join('');
}

function filterAdminUsers() {
  const q = document.getElementById('admin-user-search').value.toLowerCase();
  renderAdminUsers(adminUsers.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
}

let grantTarget = null;
function openGrantModal(username) {
  grantTarget = username;
  document.getElementById('grant-modal-title').textContent = `Modificar saldo — ${username}`;
  document.getElementById('grant-preview').textContent = '';
  document.getElementById('grant-amount').value = '';
  openModal('modal-admin-grant');
}

function updateGrantPreview() {
  const amount = parseInt(document.getElementById('grant-amount').value) || 0;
  document.getElementById('grant-preview').textContent = `${grantTarget}: ${amount.toLocaleString()} 🪙`;
}

async function confirmGrant(action) {
  const amount = parseInt(document.getElementById('grant-amount').value);
  if (!amount || amount < 1) return;
  try {
    await api('POST', '/api/admin/grant', { username: grantTarget, amount, action });
    showToast(`Saldo actualizado para ${grantTarget}`, 'success');
    closeModal('modal-admin-grant');
    loadAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

async function toggleBan(username, banned) {
  try {
    await api('POST', '/api/admin/ban', { username, banned });
    showToast(banned ? `${username} suspendido` : `${username} reactivado`, 'success');
    loadAdmin();
  } catch (e) { showToast(e.message, 'error'); }
}

function switchAdminTab(tab) {
  ['users', 'reports'].forEach(t => {
    document.getElementById(`admin-tab-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#admin-tabs .tab-pill').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && tab === 'users') || (i === 1 && tab === 'reports'));
  });
}

// ── Support ────────────────────────────────────────────────────
async function doSendSupport() {
  const type = document.getElementById('support-type').value;
  const msg = document.getElementById('support-msg').value.trim();
  const errEl = document.getElementById('support-err');
  if (!msg) { showErr(errEl, 'Escribe tu mensaje'); return; }
  showToast('Mensaje enviado. Te responderemos por email.', 'success');
  closeModal('modal-support');
  document.getElementById('support-msg').value = '';
}

// ── Misc ───────────────────────────────────────────────────────
function copyText(id) {
  const el = document.getElementById(id);
  if (el) { navigator.clipboard.writeText(el.textContent); showToast('Copiado al portapapeles', 'success'); }
}
