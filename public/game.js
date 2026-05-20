// DomiDom — Client v3 — Reglas dominicanas completas
'use strict';

// ── State ──────────────────────────────────────────────────────
let socket = null;
let currentUser = null;
let currentRoom = null;
let selectedTile = null;
let timerInterval = null;
let timerSeconds = 45;
let currentQueueProvince = null;
let adminUsers = [];
let soundEnabled = true;
let audioCtx = null;

// Crash state
let crashState = 'waiting';
let crashInterval = null;
let crashMult = 1.0;
let crashBetAmount = 0;
let crashCashedOut = false;
let crashHistory = [];
let crashAutoCashout = 0;
let crashCanvas, crashCtx;
let crashPoints = [];

// Mines state
let minesActive = false;
let minesBoard = [];
let minesGemsFound = 0;
let minesBetAmount = 0;
let minesMineCount = 3;
let minesCurrentMult = 1.0;

// ── Pip layouts (9-cell grid indices) ─────────────────────────
const PIP_LAYOUTS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

// ── Skins ──────────────────────────────────────────────────────
const SKINS = [
  { id:'hueso',     name:'Hueso Clásico',    rarity:'comun',    bg:'#f5f0e8', pip:'#1a1a1a', edge:'#ccc' },
  { id:'pizarra',   name:'Pizarra',          rarity:'comun',    bg:'#3d4451', pip:'#e8e8e8', edge:'#555' },
  { id:'marcaribe', name:'Mar Caribe',       rarity:'raro',     bg:'linear-gradient(135deg,#006994,#00b4d8)', pip:'#ffffff', edge:'#0090b8' },
  { id:'bandera',   name:'Bandera Tricolor', rarity:'raro',     bg:'linear-gradient(90deg,#002d62 33%,#ffffff 33%,#ffffff 66%,#ce1126 66%)', pip:'#000', edge:'#001840' },
  { id:'ambar',     name:'Ámbar Dominicano', rarity:'legendario', bg:'linear-gradient(135deg,#b8730a,#f5a623,#ffd700)', pip:'#1a0800', edge:'#8a5200' },
  { id:'duarte',    name:'Duarte · Tesoro',  rarity:'tesoro',   bg:'linear-gradient(135deg,#002d62,#ffd700,#ce1126)', pip:'#ffd700', edge:'#001840', glow:'#ffd700' },
];

let equippedSkin = SKINS[0];

// ── Pip rendering ──────────────────────────────────────────────
function makePipGrid(n, pipColor, size) {
  const layout = PIP_LAYOUTS[n] || [];
  const cells = Array(9).fill(false);
  layout.forEach(i => { cells[i] = true; });
  const ps = Math.max(4, Math.floor(size * 0.22));
  const gap = Math.max(1, Math.floor(size * 0.04));
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);width:100%;height:100%;gap:${gap}px;padding:${Math.floor(size*0.06)}px;">
    ${cells.map(has => `<span style="display:block;border-radius:50%;${has ? `background:${pipColor};box-shadow:inset 0 1px 2px rgba(0,0,0,0.35);width:${ps}px;height:${ps}px;margin:auto;` : ''}"></span>`).join('')}
  </div>`;
}

// Build a full domino tile HTML (for hand display)
function makeTileHTML(a, b, skin, widthPx, heightPx) {
  const bg = skin.bg.startsWith('linear') ? skin.bg : skin.bg;
  const glow = skin.glow ? `0 0 10px ${skin.glow},0 2px 6px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.3)';
  const halfH = Math.floor((heightPx - 3) / 2);
  return `<div style="
    width:${widthPx}px;height:${heightPx}px;
    background:${bg};
    border:2px solid ${skin.edge};
    border-radius:6px;
    box-shadow:${glow};
    display:flex;flex-direction:column;
    overflow:hidden;flex-shrink:0;
  ">
    <div style="width:100%;height:${halfH}px;display:flex;align-items:center;justify-content:center;">
      ${makePipGrid(a, skin.pip, widthPx)}
    </div>
    <div style="height:2px;background:${skin.edge};flex-shrink:0;"></div>
    <div style="width:100%;height:${halfH}px;display:flex;align-items:center;justify-content:center;">
      ${makePipGrid(b, skin.pip, widthPx)}
    </div>
  </div>`;
}

// Build a board tile (smaller, horizontal or vertical)
function makeBoardTileHTML(a, b, skin, isDouble, scale) {
  const TW = isDouble ? 22 : 44;
  const TH = isDouble ? 44 : 22;
  const w = Math.round(TW * scale);
  const h = Math.round(TH * scale);
  const bg = skin.bg.startsWith('linear') ? skin.bg : skin.bg;
  const glow = skin.glow ? `0 0 6px ${skin.glow}` : '0 1px 3px rgba(0,0,0,0.3)';
  const isV = isDouble; // vertical layout for doubles
  const halfSize = isV ? w : h;

  return `<div style="
    width:${w}px;height:${h}px;
    background:${bg};
    border:${Math.max(1,Math.round(scale))}px solid ${skin.edge};
    border-radius:${Math.max(2,Math.round(3*scale))}px;
    box-shadow:${glow};
    display:flex;flex-direction:${isV ? 'column' : 'row'};
    overflow:hidden;flex-shrink:0;position:absolute;
  ">
    <div style="${isV ? `width:100%;height:${Math.floor(h/2)}px` : `height:100%;width:${Math.floor(w/2)}px`};display:flex;align-items:center;justify-content:center;">
      ${makePipGrid(a, skin.pip, halfSize)}
    </div>
    <div style="${isV ? `height:1px;width:100%` : `width:1px;height:100%`};background:${skin.edge};flex-shrink:0;"></div>
    <div style="${isV ? `width:100%;height:${Math.floor(h/2)}px` : `height:100%;width:${Math.floor(w/2)}px`};display:flex;align-items:center;justify-content:center;">
      ${makePipGrid(b, skin.pip, halfSize)}
    </div>
  </div>`;
}

// ── Sound Engine ───────────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, vol, dur) {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}
function playSlam() {
  try {
    const ctx = getAudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.08));
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.8, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    src.start();
  } catch {}
}
function playSound(type) {
  if (!soundEnabled) return;
  switch(type) {
    case 'place':   playTone(180, 0.3, 0.08); break;
    case 'slam':    playSlam(); break;
    case 'capicua': [523,659,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.4,0.15),i*80)); break;
    case 'victory': [523,659,784,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.5,0.2),i*100)); break;
    case 'pollona': [261,329,392,523,659,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.6,0.3),i*120)); break;
    case 'myturn':  playTone(880,0.2,0.05); setTimeout(()=>playTone(1100,0.15,0.04),80); break;
    case 'coins':   [784,880,1047,1175].forEach((f,i) => setTimeout(()=>playTone(f,0.3,0.08),i*50)); break;
    case 'agua':    playTone(80,0.1,0.06); break;
  }
}

// ── Init ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadInitial();
  document.getElementById('loading-screen').style.display = 'none';
  initCrashCanvas();
  buildMinesGrid();
  addSoundButton();
});

function addSoundButton() {
  const btn = document.createElement('button');
  btn.id = 'sound-btn';
  btn.textContent = '🔊';
  btn.title = 'Silenciar/Activar';
  btn.onclick = () => { soundEnabled = !soundEnabled; btn.textContent = soundEnabled ? '🔊' : '🔇'; };
  Object.assign(btn.style, { position:'fixed',top:'62px',right:'10px',zIndex:'150',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'6px',padding:'5px 8px',cursor:'pointer',fontSize:'1rem',color:'var(--text2)' });
  document.body.appendChild(btn);
}

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
  const savedSkin = localStorage.getItem('equippedSkin');
  if (savedSkin) equippedSkin = SKINS.find(s => s.id === savedSkin) || SKINS[0];
}

// ── API ────────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
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
  socket.on('room:update', (room) => { currentRoom = room; renderRoomLobby(room); });
  socket.on('match:start', () => {
    document.getElementById('game-lobby').style.display = 'none';
    document.getElementById('game-main').style.display = 'grid';
  });
  socket.on('game:state', renderGameState);
  socket.on('timer:start', ({ seconds }) => { timerSeconds = seconds; startTimerUI(seconds); });
  socket.on('round:end', (result) => {
    if (result.type === 'capicua') { showToast('⭐ ¡CAPICÚA! +25 pts', 'gold'); playSound('capicua'); }
    else if (result.type === 'tranca') { showToast('🔒 ¡TRANCA!', 'info'); }
    else { showToast('Ronda ganada', 'success'); }
  });
  socket.on('match:end', showWinOverlay);
  socket.on('chat:message', appendChatMessage);
  socket.on('slam', ({ username }) => { handleSlam(username); });
  socket.on('queue:joined', ({ province }) => { currentQueueProvince = province; });
  socket.on('room:created', ({ roomId }) => { showScreen('game'); document.getElementById('game-room-code').textContent = roomId; });
  socket.on('room:error', (msg) => showToast(msg, 'error'));
  socket.on('friends:list', renderFriendsList);
  socket.on('friends:requests', renderFriendRequests);
  socket.on('friends:request', ({ from }) => showToast(`${from} te envió solicitud`, 'info'));
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
  if (!username||!pass||!email) { showErr(errEl,'Completa todos los campos'); return; }
  if (pass !== pass2) { showErr(errEl,'Las contraseñas no coinciden'); return; }
  if (pass.length < 6) { showErr(errEl,'Contraseña mínimo 6 caracteres'); return; }
  const btn = document.getElementById('btn-reg-submit');
  btn.disabled = true; btn.textContent = 'Creando…';
  try {
    const res = await api('POST', '/api/auth/register', { username, password:pass, email, phone });
    currentUser = { ...res };
    localStorage.setItem('token', res.token);
    socket.emit('auth', { token: res.token });
    updateUIForLoggedIn();
    showScreen('home');
    showToast('¡Cuenta creada! Bienvenido 🎉', 'success');
  } catch(e) { showErr(errEl, e.message); }
  finally { btn.disabled = false; btn.textContent = 'Crear Cuenta'; }
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!username||!pass) { showErr(errEl,'Ingresa usuario y contraseña'); return; }
  const btn = document.getElementById('btn-login-submit');
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const res = await api('POST', '/api/auth/login', { username, password:pass });
    currentUser = { ...res };
    localStorage.setItem('token', res.token);
    socket.emit('auth', { token: res.token });
    updateUIForLoggedIn();
    showScreen('home');
  } catch(e) { showErr(errEl, e.message); }
  finally { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
}

function doLogout() { localStorage.removeItem('token'); currentUser = null; location.reload(); }

// ── UI helpers ─────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`)?.classList.add('active');
  if (name==='wallet') loadWallet();
  if (name==='profile') loadProfile();
  if (name==='friends') loadFriends();
  if (name==='admin') loadAdmin();
  if (name==='crash') initCrashGame();
  if (name==='mines') initMinesGame();
}
function showToast(msg, type='info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️', gold:'⭐' };
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
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
  if (currentUser.isAdmin && !document.getElementById('btn-admin-top')) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline btn-sm'; btn.id = 'btn-admin-top';
    btn.textContent = '⚙️ Admin'; btn.onclick = () => showScreen('admin');
    document.getElementById('topbar-right').insertBefore(btn, document.getElementById('btn-logout'));
  }
  updateWalletDisplay();
  updateSidebarStats();
}
function updateWalletDisplay() {
  if (!currentUser) return;
  document.getElementById('topbar-balance').textContent = (currentUser.coins||0).toLocaleString();
}
function updateSidebarStats() {
  if (!currentUser) return;
  document.getElementById('sidebar-stats-logged').style.display = 'block';
  document.getElementById('sidebar-stats-guest').style.display = 'none';
  const s = currentUser.stats || {};
  document.getElementById('stat-games').textContent = s.games||0;
  document.getElementById('stat-wins').textContent = s.wins||0;
  document.getElementById('stat-net').textContent = (s.earnings||0).toLocaleString();
}
function scrollToProvinces() {
  if (!currentUser) { showScreen('login'); return; }
  document.getElementById('provinces-anchor')?.scrollIntoView({ behavior:'smooth' });
}

// ── Provinces ──────────────────────────────────────────────────
async function loadProvinces() {
  try { renderProvinces(await api('GET','/api/provinces')); } catch {}
}
function renderProvinces(provinces) {
  const grid = document.getElementById('province-grid');
  if (!grid) return;
  grid.innerHTML = provinces.map(p => `
    <div class="prov-card ${p.featured?'featured':''}" onclick="joinProvince('${p.id}',${p.buyIn})">
      <div class="prov-name">${p.name}</div>
      <div class="prov-buyin">${p.buyIn.toLocaleString()} 🪙 <small>buy-in</small></div>
      <div class="prov-players"><span class="live-dot"></span>${p.playersInQueue} en cola · ${p.activeTables} mesa${p.activeTables!==1?'s':''}</div>
    </div>`).join('');
}
function joinProvince(provinceId, buyIn) {
  if (!currentUser) { showScreen('login'); return; }
  if (currentUser.coins < buyIn) { showToast('Saldo insuficiente','error'); return; }
  const prov = document.querySelector(`.prov-card[onclick*="${provinceId}"]`);
  document.getElementById('queue-province-name').textContent = prov?.querySelector('.prov-name')?.textContent||'Cola';
  document.getElementById('queue-buyin-badge').textContent = `Pote: ${buyIn.toLocaleString()} 🪙`;
  openModal('modal-queue');
  socket.emit('queue:join', { provinceId });
}
function leaveQueue() {
  if (currentQueueProvince) socket.emit('queue:leave', { provinceId: currentQueueProvince.id });
  closeModal('modal-queue');
}

// ── Leaderboard ────────────────────────────────────────────────
async function loadLeaderboard() {
  try { renderLeaderboard(await api('GET','/api/leaderboard')); } catch {}
}
function renderLeaderboard(data) {
  const el = document.getElementById('leaderboard-mini');
  if (!el||!data?.length) { if(el) el.innerHTML='<div class="empty-state">Aún no hay datos</div>'; return; }
  el.innerHTML = data.slice(0,5).map((u,i) => `
    <div class="lb-row">
      <span class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</span>
      <div class="lb-avatar">${u.username[0].toUpperCase()}</div>
      <span class="lb-name">${u.username}</span>
      <span class="lb-amount">${u.earnings.toLocaleString()} 🪙</span>
    </div>`).join('');
}
async function loadOnlineCount() {
  try { const { count } = await api('GET','/api/online'); document.querySelectorAll('#online-count').forEach(el=>el.textContent=count); } catch {}
}

// ── Wallet ─────────────────────────────────────────────────────
async function loadWallet() {
  if (!currentUser) { showScreen('login'); return; }
  try {
    const me = await api('GET','/api/me');
    currentUser = { ...currentUser, ...me };
    document.getElementById('wallet-balance-display').textContent = `${me.coins.toLocaleString()} 🪙`;
    document.getElementById('wallet-net-display').textContent = `Net: ${(me.stats.earnings||0).toLocaleString()} | Juegos: ${me.stats.games} | Victorias: ${me.stats.wins}`;
    renderTransactions(me.transactions||[]);
  } catch {}
}
function renderTransactions(txs) {
  const el = document.getElementById('tx-list');
  if (!txs.length) { el.innerHTML='<div class="empty-state">Sin transacciones</div>'; return; }
  el.innerHTML = txs.slice().reverse().map(tx => {
    const icons = { win:'🏆', loss:'💸', admin_credit:'✅', admin_debit:'❌', crash_win:'🚀', crash_loss:'💥', mines_win:'💎', mines_loss:'💣', bonus_bienvenida:'🎁' };
    const positive = tx.amount > 0;
    return `<div class="tx-item">
      <div class="tx-icon ${positive?'win':'loss'}">${icons[tx.type]||'🔄'}</div>
      <div class="tx-info"><div class="tx-title">${tx.type.replace(/_/g,' ')}</div><div class="tx-date">${new Date(tx.date).toLocaleDateString('es-DO')}</div></div>
      <div class="tx-amount ${positive?'positive':'negative'}">${positive?'+':''}${tx.amount.toLocaleString()} 🪙</div>
    </div>`;
  }).join('');
}

// ── Profile ────────────────────────────────────────────────────
async function loadProfile() {
  if (!currentUser) return;
  try {
    const me = await api('GET','/api/me');
    document.getElementById('profile-avatar-big').textContent = me.username[0].toUpperCase();
    document.getElementById('profile-name-display').textContent = me.username;
    document.getElementById('profile-sub-display').textContent = me.email;
    document.getElementById('p-games').textContent = me.stats.games;
    document.getElementById('p-wins').textContent = me.stats.wins;
    document.getElementById('p-net').textContent = me.stats.earnings.toLocaleString();
    document.getElementById('p-wr').textContent = me.stats.games>0 ? `${Math.round((me.stats.wins/me.stats.games)*100)}%` : '0%';
    if (me.isAdmin) document.getElementById('profile-badges-row').innerHTML='<span class="badge badge-orange">⚙️ Admin</span>';
  } catch {}
}

// ── Friends ────────────────────────────────────────────────────
function loadFriends() { if (currentUser) socket.emit('friends:list'); }
function renderFriendsList(friends) {
  const el = document.getElementById('friends-list');
  if (!friends.length) { el.innerHTML='<div class="empty-state">No tienes amigos todavía.</div>'; return; }
  el.innerHTML = friends.map(f => `
    <div class="friend-item">
      <div class="friend-status-dot ${f.online?'online':'offline'}"></div>
      <div class="lb-avatar">${f.username[0].toUpperCase()}</div>
      <span style="flex:1;font-weight:600;">${f.username}</span>
      <span class="badge ${f.online?'badge-green':'badge-gray'}">${f.online?'En línea':'Offline'}</span>
    </div>`).join('');
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
    </div>`).join('');
}
function doAddFriend() {
  const username = document.getElementById('friend-search-inp').value.trim();
  if (!username) return;
  socket.emit('friends:add', { targetUsername: username });
  document.getElementById('friend-search-inp').value = '';
}
function acceptFriend(from) { socket.emit('friends:accept', { fromUsername: from }); }

// ── Friend Rooms ───────────────────────────────────────────────
function showFriendRoomModal() {
  if (!currentUser) { showScreen('login'); return; }
  openModal('modal-friend-room');
}
function switchFriendTab(tab) {
  document.getElementById('fr-create').style.display = tab==='create'?'block':'none';
  document.getElementById('fr-join').style.display = tab==='join'?'block':'none';
  document.querySelectorAll('#modal-friend-room .tab-pill').forEach((t,i) => {
    t.classList.toggle('active', (i===0&&tab==='create')||(i===1&&tab==='join'));
  });
}
function doCreateRoom() {
  const buyIn = parseInt(document.getElementById('fr-buyin').value)||0;
  closeModal('modal-friend-room'); showScreen('game');
  socket.emit('room:create', { buyIn });
}
function doJoinRoom() {
  const code = document.getElementById('fr-code').value.trim().toUpperCase();
  if (!code) return;
  closeModal('modal-friend-room'); showScreen('game');
  socket.emit('room:join', { roomId: code });
}
function leaveRoom() { showScreen('home'); currentRoom = null; }
function doAddBot() { socket.emit('room:add-bot'); }
function doStartGame() { socket.emit('room:start'); }

// ── Practice ───────────────────────────────────────────────────
function showPracticeModal() {
  if (!currentUser) { showScreen('login'); return; }
  const grid = document.getElementById('practice-levels');
  grid.innerHTML = Array.from({length:10},(_,i)=>i+1).map(lvl => `
    <button class="btn btn-outline btn-sm" style="flex-direction:column;gap:2px;padding:10px 4px;" onclick="startPractice(${lvl})">
      <span>${['😊','🙂','😐','🤔','😬','😤','😠','👿','💀','🏆'][lvl-1]}</span>
      <span style="font-size:0.7rem;">Nv ${lvl}</span>
    </button>`).join('');
  openModal('modal-practice');
}
function startPractice(level) {
  closeModal('modal-practice'); showScreen('game');
  document.getElementById('game-room-code').textContent = `PRÁCTICA Nv.${level}`;
  document.getElementById('game-pot-badge').textContent = 'Sin apuesta';
  socket.emit('practice:start', { level });
}

// ── Room lobby ─────────────────────────────────────────────────
function renderRoomLobby(room) {
  document.getElementById('game-room-code').textContent = room.id;
  document.getElementById('game-pot-badge').textContent = `Pote: ${(room.pot||0).toLocaleString()} 🪙`;
  const seats = document.getElementById('lobby-seats-display');
  seats.innerHTML = Array.from({length:4},(_,i) => {
    const p = room.players.find(pl=>pl.seatIndex===i);
    return `<div class="lobby-seat ${p?'filled':''}">
      <div class="ls-icon">${p?(p.isBot?'🤖':'👤'):'⬜'}</div>
      <div style="font-size:0.75rem;font-weight:600;">${p?p.username:`Asiento ${i+1}`}</div>
      <div class="badge ${i%2===0?'badge-blue':'badge-red'}" style="font-size:0.62rem;">Equipo ${i%2===0?'A':'B'}</div>
    </div>`;
  }).join('');
  const filled = room.players.length;
  document.getElementById('game-lobby-info').textContent = filled<4?`${4-filled} jugador${4-filled!==1?'es':''} más`:'¡Listos!';
  const isHost = room.host===currentUser?.username;
  document.getElementById('host-controls').style.display = isHost?'flex':'none';
}

// ── GAME STATE RENDER ──────────────────────────────────────────
function renderGameState(state) {
  if (!state) return;
  document.getElementById('score-a').textContent = state.scores?.[0]??0;
  document.getElementById('score-b').textContent = state.scores?.[1]??0;
  renderBoard(state.board||[], state.leftEnd, state.rightEnd);
  renderHand(state.myHand||[], state.legalMoves||[], state.currentPlayer, state.myIndex);
  renderSeats(state);
  if (state.currentPlayer===state.myIndex) playSound('myturn');
}

// ── BOARD — SERPENTINE ─────────────────────────────────────────
function renderBoard(board, leftEnd, rightEnd) {
  const snake = document.getElementById('snake');
  if (!board.length) {
    snake.innerHTML = '<div style="color:rgba(255,255,255,0.2);font-size:0.82rem;padding:20px;text-align:center;">Esperando primera ficha…</div>';
    snake.style.height = '180px';
    return;
  }

  const container = document.getElementById('board-container');
  const maxW = Math.max(200, container.clientWidth - 16);
  const maxH = Math.max(160, container.clientHeight - 16);

  // Base tile dimensions at scale=1
  const TW = 44, TH = 22, GAP = 3;

  // Calculate serpentine positions
  const positions = [];
  let cx = 8, cy = 8;
  let dir = 1; // 1=right, -1=left

  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    const isDouble = tile[0] === tile[1];
    const tw = isDouble ? TH : TW;
    const th = isDouble ? TW : TH;

    // Check overflow
    const wouldEnd = dir === 1 ? cx + tw : cx - tw;
    const overflow = dir === 1 ? wouldEnd > maxW - 8 : wouldEnd < 8;

    if (overflow && i > 0) {
      // Turn: move down and flip direction
      cy += TH + GAP + 4;
      dir *= -1;
      cx = dir === 1 ? 8 : maxW - 8;
    }

    positions.push({ x: dir === 1 ? cx : cx - tw, y: cy, isDouble, tw, th });
    cx = dir === 1 ? cx + tw + GAP : cx - tw - GAP;
  }

  // Calculate bounding box and scale
  let maxX = 0, maxY = 0;
  positions.forEach(p => { maxX = Math.max(maxX, p.x + p.tw); maxY = Math.max(maxY, p.y + p.th); });
  const scaleX = maxX > maxW ? maxW / (maxX + 8) : 1;
  const scaleY = maxY > maxH ? maxH / (maxY + 8) : 1;
  const scale = Math.min(scaleX, scaleY, 1);

  const skin = equippedSkin;
  let html = '';
  positions.forEach((p, i) => {
    const [a, b] = board[i];
    const w = Math.round(p.tw * scale);
    const h = Math.round(p.th * scale);
    const x = Math.round(p.x * scale);
    const y = Math.round(p.y * scale);
    const bg = skin.bg.startsWith('linear') ? skin.bg : skin.bg;
    const glow = skin.glow ? `0 0 6px ${skin.glow}` : '0 1px 3px rgba(0,0,0,0.3)';
    const br = Math.max(2, Math.round(3 * scale));
    const bw = Math.max(1, Math.round(scale));
    const isDouble = p.isDouble;
    const halfA = isDouble ? `width:100%;height:${Math.floor(h/2)}px` : `height:100%;width:${Math.floor(w/2)}px`;
    const halfB = halfA;
    const divider = isDouble ? `height:${bw}px;width:100%` : `width:${bw}px;height:100%`;
    const flexDir = isDouble ? 'column' : 'row';
    const pipSize = isDouble ? w : h;

    html += `<div style="
      position:absolute;left:${x}px;top:${y}px;
      width:${w}px;height:${h}px;
      background:${bg};
      border:${bw}px solid ${skin.edge};
      border-radius:${br}px;
      box-shadow:${glow};
      display:flex;flex-direction:${flexDir};
      overflow:hidden;
    ">
      <div style="${halfA};display:flex;align-items:center;justify-content:center;">
        ${makePipGrid(a, skin.pip, pipSize)}
      </div>
      <div style="${divider};background:${skin.edge};flex-shrink:0;"></div>
      <div style="${halfB};display:flex;align-items:center;justify-content:center;">
        ${makePipGrid(b, skin.pip, pipSize)}
      </div>
    </div>`;
  });

  snake.style.position = 'relative';
  snake.style.height = `${Math.round(maxY * scale) + 16}px`;
  snake.innerHTML = html;
}

// ── HAND RENDER ────────────────────────────────────────────────
function renderHand(hand, legalMoves, currentPlayer, myIndex) {
  const el = document.getElementById('my-hand');
  if (!hand.length) { el.innerHTML = ''; hideHandControls(); return; }

  const legalSet = new Set(legalMoves.map(t => `${t[0]}-${t[1]}`));
  const isMyTurn = currentPlayer === myIndex;
  const skin = equippedSkin;

  el.innerHTML = hand.map(tile => {
    const [a, b] = tile;
    const key = `${a}-${b}`;
    const isLegal = legalSet.has(key);
    const isSelected = selectedTile && selectedTile[0]===a && selectedTile[1]===b;
    const opacity = (!isMyTurn || !isLegal) ? '0.45' : '1';
    const translateY = isSelected ? '-14px' : '0px';
    const borderColor = isSelected ? '#ffd700' : (isLegal && isMyTurn ? 'rgba(0,231,1,0.8)' : skin.edge);
    const glow = isSelected
      ? '0 0 18px rgba(255,215,0,0.7),0 4px 10px rgba(0,0,0,0.4)'
      : (isLegal && isMyTurn ? '0 0 8px rgba(0,231,1,0.4),0 2px 6px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)');

    return `<div
      style="opacity:${opacity};transform:translateY(${translateY});transition:transform 0.15s,opacity 0.15s;cursor:${isMyTurn&&isLegal?'pointer':'default'};"
      onclick="${isMyTurn&&isLegal?`selectHandTile(${a},${b})`:''}"
    >
      <div style="
        width:46px;height:92px;
        background:${skin.bg.startsWith('linear')?skin.bg:skin.bg};
        border:2px solid ${borderColor};
        border-radius:6px;
        box-shadow:${glow};
        display:flex;flex-direction:column;
        overflow:hidden;
      ">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px;">
          ${makePipGrid(a, skin.pip, 42)}
        </div>
        <div style="height:2px;background:${skin.edge};flex-shrink:0;"></div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px;">
          ${makePipGrid(b, skin.pip, 42)}
        </div>
      </div>
    </div>`;
  }).join('');

  // Buttons
  const hasLegal = legalMoves.length > 0;
  const btnLeft = document.getElementById('btn-place-left');
  const btnRight = document.getElementById('btn-place-right');
  const btnSlam = document.getElementById('btn-slam');
  const btnPass = document.getElementById('btn-pass');
  if (isMyTurn) {
    if (selectedTile) {
      btnLeft.classList.remove('hidden'); btnRight.classList.remove('hidden');
      btnSlam.classList.remove('hidden'); btnPass.classList.add('hidden');
    } else if (!hasLegal) {
      btnLeft.classList.add('hidden'); btnRight.classList.add('hidden');
      btnSlam.classList.add('hidden'); btnPass.classList.remove('hidden');
    } else {
      hideHandControls();
    }
  } else { hideHandControls(); }
}

function hideHandControls() {
  ['btn-place-left','btn-place-right','btn-slam','btn-pass'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

function selectHandTile(a, b) {
  selectedTile = (selectedTile && selectedTile[0]===a && selectedTile[1]===b) ? null : [a, b];
  socket.emit('game:request-state');
}
function placeSelectedLeft() {
  if (!selectedTile) return;
  socket.emit('game:play', { tile:selectedTile, side:'left', slam:false });
  playSound('place'); selectedTile = null;
}
function placeSelectedRight() {
  if (!selectedTile) return;
  socket.emit('game:play', { tile:selectedTile, side:'right', slam:false });
  playSound('place'); selectedTile = null;
}
function doSlam() {
  if (!selectedTile) return;
  socket.emit('game:play', { tile:selectedTile, side:'auto', slam:true });
  playSound('slam'); selectedTile = null;
}
function doPass() {
  socket.emit('game:pass');
  playSound('agua');
  showToast('¡Agua! Pasando turno…','info');
}

// ── Slam ───────────────────────────────────────────────────────
function handleSlam(username) {
  playSound('slam');
  const board = document.getElementById('board-container');
  board.classList.add('shake');
  setTimeout(() => board.classList.remove('shake'), 500);
  appendChatMessage({ username:'Mesa', message:`${username} 💥 ¡TRÁNQUELE!` });
}

// ── Seats ──────────────────────────────────────────────────────
function renderSeats(state) {
  const makeOpponent = (seatIdx) => {
    if (!state.handCounts) return '';
    const count = state.handCounts[seatIdx]??0;
    const isActive = state.currentPlayer===seatIdx;
    const teamCls = seatIdx%2===0?'team-a':'team-b';
    const playerName = currentRoom?.players?.[seatIdx]?.username||`J${seatIdx+1}`;
    const isBot = currentRoom?.players?.[seatIdx]?.isBot;
    return `<div class="opponent-seat ${isActive?'active-turn':''} ${teamCls}">
      <div class="seat-avatar ${isActive?'glow':''}">${isBot?'🤖':playerName[0]?.toUpperCase()}</div>
      <div class="seat-name">${playerName}</div>
      <div class="seat-hand-count">${count} fichas</div>
    </div>`;
  };
  document.getElementById('seats-top').innerHTML = makeOpponent(2);
  document.getElementById('seats-left').innerHTML = makeOpponent(1);
  document.getElementById('seats-right').innerHTML = makeOpponent(3);
  const myActive = state.currentPlayer===state.myIndex;
  const myEl = document.getElementById('my-seat-label');
  if (myEl) {
    myEl.textContent = myActive?'⏳ TU TURNO':'Tú';
    myEl.className = myActive?'my-turn-label':'my-seat-label';
  }
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
    bar.style.width = (timerSeconds/seconds*100)+'%';
    const urgent = timerSeconds <= 10;
    bar.classList.toggle('urgent', urgent);
    timer.classList.toggle('urgent', urgent);
  }, 1000);
}

// ── Chat ───────────────────────────────────────────────────────
function appendChatMessage(msg) {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  const isSystem = msg.username==='Sistema'||msg.username==='Mesa';
  div.className = `chat-msg${isSystem?' system':''}`;
  div.innerHTML = isSystem ? msg.message : `<span class="chat-sender">${msg.username}:</span> ${msg.message}`;
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
  const myTeam = currentRoom?.players?.find(p=>p.username===currentUser?.username)?.team??0;
  const won = result.winnerTeam===myTeam;
  const isPollona = result.isPollona;
  document.getElementById('win-title-text').textContent = isPollona
    ? (won?'¡POLLONA! 🎯🎯🎯':'¡ZAPATERO! 😭💀')
    : (won?'¡VICTORIA! 🏆':'¡DERROTA! 💀');
  document.getElementById('win-title-text').className = `win-title ${won?(isPollona?'pollona':'victory'):'loss'}`;
  document.getElementById('win-coins-text').textContent = won
    ? `+${result.perPlayer?.toLocaleString()||0} 🪙`
    : `-${currentRoom?.buyIn?.toLocaleString()||0} 🪙`;
  document.getElementById('win-breakdown').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
      <span>Equipo A</span><span>${result.scores?.[0]??0} pts</span></div>
    <div style="display:flex;justify-content:space-between;padding:7px 0;">
      <span>Equipo B</span><span>${result.scores?.[1]??0} pts</span></div>`;
  document.getElementById('win-overlay').classList.add('show');
  if (won) {
    isPollona ? playSound('pollona') : playSound('victory');
    if (result.perPlayer>0) setTimeout(()=>playSound('coins'),800);
    launchConfetti();
  }
}
function closeWinOverlay() {
  document.getElementById('win-overlay').classList.remove('show');
  showScreen('home');
  loadProvinces(); loadLeaderboard();
  if (currentUser) api('GET','/api/me').then(me=>{ currentUser={...currentUser,...me}; updateWalletDisplay(); updateSidebarStats(); }).catch(()=>{});
}
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const particles = Array.from({length:120},()=>({
    x:Math.random()*canvas.width, y:-10, r:Math.random()*5+3,
    d:Math.random()*3+1,
    color:['#00e701','#ffd700','#4da2ff','#ff4444','#ffffff','#ce1126','#002d62'][Math.floor(Math.random()*7)],
    tiltAngle:0,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r,p.r/2,p.tiltAngle,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
      p.y+=p.d; p.tiltAngle+=0.1; p.x+=Math.sin(frame/10)*0.4;
      if (p.y>canvas.height) { p.y=-10; p.x=Math.random()*canvas.width; }
    });
    frame++;
    if (frame<300) requestAnimationFrame(draw);
    else { canvas.style.display='none'; ctx.clearRect(0,0,canvas.width,canvas.height); }
  }
  draw();
}

// ══════════════════════════════════════════════════
// ── CRASH GAME ────────────────────────────────────
// ══════════════════════════════════════════════════
function initCrashCanvas() {
  crashCanvas = document.getElementById('crash-canvas');
  if (!crashCanvas) return;
  crashCtx = crashCanvas.getContext('2d');
  resizeCrashCanvas();
  window.addEventListener('resize', resizeCrashCanvas);
}
function resizeCrashCanvas() {
  if (!crashCanvas) return;
  const container = document.getElementById('crash-chart');
  if (!container) return;
  crashCanvas.width = container.clientWidth;
  crashCanvas.height = container.clientHeight;
}
function initCrashGame() {
  if (!currentUser) return;
  renderCrashHistory();
  drawCrashCanvas(1.0, false);
}
function crashBet() {
  if (!currentUser) { showScreen('login'); return; }
  if (crashState!=='waiting') { showToast('Espera la próxima ronda','info'); return; }
  const bet = parseInt(document.getElementById('crash-bet').value)||0;
  const auto = parseFloat(document.getElementById('crash-auto').value)||0;
  if (bet<1) { showToast('Apuesta mínima: 1 🪙','error'); return; }
  if (currentUser.coins<bet) { showToast('Saldo insuficiente','error'); return; }
  crashBetAmount = bet; crashAutoCashout = auto; crashCashedOut = false;
  currentUser.coins -= bet; updateWalletDisplay();
  document.getElementById('crash-my-bet').textContent = `${bet} 🪙`;
  document.getElementById('crash-btn').style.display = 'none';
  document.getElementById('crash-cashout-btn').style.display = 'block';
  startCrashRound();
}
function startCrashRound() {
  crashState = 'flying'; crashMult = 1.0; crashPoints = [];
  const rand = Math.random();
  const crashPoint = rand<0.70 ? 1.0+Math.random()*0.8 : 1.5+Math.pow(Math.random(),0.5)*8.5;
  const startTime = Date.now();
  crashInterval = setInterval(() => {
    const elapsed = (Date.now()-startTime)/1000;
    crashMult = Math.round(Math.pow(Math.E,elapsed*0.12)*100)/100;
    crashPoints.push({ t:elapsed, m:crashMult });
    drawCrashCanvas(crashMult, false);
    document.getElementById('crash-multiplier').textContent = crashMult.toFixed(2)+'x';
    document.getElementById('crash-live-mult').textContent = crashMult.toFixed(2)+'x';
    document.getElementById('crash-potential').textContent = Math.floor(crashBetAmount*crashMult)+' 🪙';
    document.getElementById('crash-cashout-val').textContent = `(${Math.floor(crashBetAmount*crashMult)} 🪙)`;
    if (crashAutoCashout>1 && crashMult>=crashAutoCashout && !crashCashedOut) { crashCashout(); return; }
    if (crashMult>=crashPoint) { doCrash(); }
  }, 80);
}
function crashCashout() {
  if (crashCashedOut||crashState!=='flying') return;
  crashCashedOut = true; clearInterval(crashInterval);
  const winAmount = Math.floor(crashBetAmount*crashMult);
  currentUser.coins += winAmount; updateWalletDisplay();
  crashHistory.unshift({ mult:crashMult, won:true });
  renderCrashHistory();
  showToast(`✅ Retiraste a ${crashMult.toFixed(2)}x — +${winAmount} 🪙`,'success');
  playSound('coins');
  endCrashRound(true);
  api('POST','/api/crash/result',{ bet:crashBetAmount, mult:crashMult, won:true }).catch(()=>{});
}
function doCrash() {
  clearInterval(crashInterval); crashState = 'crashed';
  drawCrashCanvas(crashMult, true);
  const multEl = document.getElementById('crash-multiplier');
  multEl.textContent = crashMult.toFixed(2)+'x'; multEl.classList.add('crashed');
  if (!crashCashedOut) {
    showToast(`💥 Crashed en ${crashMult.toFixed(2)}x`,'error');
    crashHistory.unshift({ mult:crashMult, won:false });
    renderCrashHistory();
    api('POST','/api/crash/result',{ bet:crashBetAmount, mult:crashMult, won:false }).catch(()=>{});
  }
  endCrashRound(false);
}
function endCrashRound(won) {
  document.getElementById('crash-cashout-btn').style.display = 'none';
  setTimeout(() => {
    crashState = 'waiting'; crashMult = 1.0; crashPoints = [];
    document.getElementById('crash-multiplier').classList.remove('crashed');
    document.getElementById('crash-multiplier').textContent = '1.00x';
    document.getElementById('crash-btn').style.display = 'block';
    document.getElementById('crash-my-bet').textContent = '—';
    document.getElementById('crash-live-mult').textContent = '—';
    document.getElementById('crash-potential').textContent = '—';
    drawCrashCanvas(1.0, false);
  }, 3000);
}
function drawCrashCanvas(mult, crashed) {
  if (!crashCtx||!crashCanvas) return;
  const w=crashCanvas.width, h=crashCanvas.height;
  crashCtx.clearRect(0,0,w,h);
  // Grid
  crashCtx.strokeStyle='rgba(255,255,255,0.04)'; crashCtx.lineWidth=1;
  for (let i=1;i<5;i++) {
    crashCtx.beginPath(); crashCtx.moveTo(0,h*i/5); crashCtx.lineTo(w,h*i/5); crashCtx.stroke();
    crashCtx.beginPath(); crashCtx.moveTo(w*i/5,0); crashCtx.lineTo(w*i/5,h); crashCtx.stroke();
  }
  if (crashPoints.length<2) return;
  const maxT=Math.max(crashPoints[crashPoints.length-1].t,2);
  const maxM=Math.max(mult+0.5,2);
  const toX=t=>(t/maxT)*(w*0.9)+w*0.05;
  const toY=m=>h-((m-1)/(maxM-1))*(h*0.85)-h*0.05;
  const grad=crashCtx.createLinearGradient(0,h,w,0);
  grad.addColorStop(0, crashed?'rgba(255,68,68,0.6)':'rgba(0,231,1,0.6)');
  grad.addColorStop(1, crashed?'rgba(255,68,68,0.1)':'rgba(0,231,1,0.1)');
  crashCtx.beginPath();
  crashCtx.moveTo(toX(0),toY(1));
  crashPoints.forEach(p=>crashCtx.lineTo(toX(p.t),toY(p.m)));
  const lastX=toX(crashPoints[crashPoints.length-1].t);
  crashCtx.lineTo(lastX,h); crashCtx.lineTo(toX(0),h); crashCtx.closePath();
  crashCtx.fillStyle=grad; crashCtx.fill();
  crashCtx.beginPath();
  crashCtx.moveTo(toX(0),toY(1));
  crashPoints.forEach(p=>crashCtx.lineTo(toX(p.t),toY(p.m)));
  crashCtx.strokeStyle=crashed?'#ff4444':'#00e701'; crashCtx.lineWidth=2.5; crashCtx.stroke();
  const rocket=document.getElementById('crash-rocket');
  const lp=crashPoints[crashPoints.length-1];
  if (rocket&&lp) {
    rocket.style.left=toX(lp.t)+'px';
    rocket.style.bottom=(h-toY(lp.m))+'px';
    rocket.style.display=crashed?'none':'block';
  }
}
function renderCrashHistory() {
  const el=document.getElementById('crash-history');
  if (!el) return;
  el.innerHTML=crashHistory.slice(0,10).map(h=>{
    const cls=h.mult<1.5?'low':h.mult<3?'mid':'high';
    return `<span class="crash-hist-item ${cls}">${h.mult.toFixed(2)}x</span>`;
  }).join('');
}

// ══════════════════════════════════════════════════
// ── MINES GAME ────────────────────────────────────
// ══════════════════════════════════════════════════
function initMinesGame() {
  if (!currentUser) return;
  buildMinesGrid();
  minesActive=false; minesGemsFound=0;
  document.getElementById('mines-start-btn').style.display='block';
  document.getElementById('mines-cashout-btn').style.display='none';
  document.getElementById('mines-mult').textContent='1.00x';
  document.getElementById('mines-status').textContent='Configura tu apuesta';
  document.getElementById('mines-gem-count').textContent='Gemas encontradas: 0';
}
function buildMinesGrid() {
  const grid=document.getElementById('mines-grid');
  if (!grid) return;
  grid.innerHTML=Array.from({length:25},(_,i)=>`<div class="mine-cell" id="mine-${i}" onclick="minesReveal(${i})">🎲</div>`).join('');
}
function minesStart() {
  if (!currentUser) { showScreen('login'); return; }
  const bet=parseInt(document.getElementById('mines-bet').value)||0;
  const mines=parseInt(document.getElementById('mines-count').value)||3;
  if (bet<1) { showToast('Apuesta mínima: 1 🪙','error'); return; }
  if (mines<1||mines>24) { showToast('Minas: entre 1 y 24','error'); return; }
  if (currentUser.coins<bet) { showToast('Saldo insuficiente','error'); return; }
  minesBetAmount=bet; minesMineCount=mines; minesGemsFound=0; minesActive=true; minesCurrentMult=1.0;
  currentUser.coins-=bet; updateWalletDisplay();
  minesBoard=Array(25).fill('gem');
  const minePositions=shuffleArray([...Array(25).keys()]).slice(0,mines);
  minePositions.forEach(i=>{minesBoard[i]='mine';});
  buildMinesGrid();
  document.querySelectorAll('.mine-cell').forEach(c=>c.classList.remove('disabled'));
  document.getElementById('mines-start-btn').style.display='none';
  document.getElementById('mines-cashout-btn').style.display='block';
  document.getElementById('mines-status').textContent='¡Encuentra las gemas!';
  document.getElementById('mines-gem-count').textContent='Gemas encontradas: 0';
  updateMinesMultiplier();
}
function minesReveal(index) {
  if (!minesActive) return;
  const cell=document.getElementById(`mine-${index}`);
  if (!cell||cell.classList.contains('safe')||cell.classList.contains('mine')) return;
  if (minesBoard[index]==='mine') {
    cell.classList.add('mine'); cell.innerHTML='💣';
    minesBoard.forEach((_,i)=>{ if(minesBoard[i]==='mine'){document.getElementById(`mine-${i}`).classList.add('mine');document.getElementById(`mine-${i}`).innerHTML='💣';} });
    minesActive=false;
    document.getElementById('mines-start-btn').style.display='block';
    document.getElementById('mines-cashout-btn').style.display='none';
    document.getElementById('mines-status').textContent='💥 ¡Mine! Perdiste.';
    document.querySelectorAll('.mine-cell').forEach(c=>c.classList.add('disabled'));
    showToast(`💣 Mine! Perdiste ${minesBetAmount} 🪙`,'error');
    api('POST','/api/mines/result',{bet:minesBetAmount,won:false,gems:minesGemsFound}).catch(()=>{});
  } else {
    minesGemsFound++;
    cell.classList.add('safe'); cell.innerHTML='💎';
    updateMinesMultiplier();
    document.getElementById('mines-gem-count').textContent=`Gemas encontradas: ${minesGemsFound}`;
    document.getElementById('mines-cashout-val').textContent=`(${Math.floor(minesBetAmount*minesCurrentMult)} 🪙)`;
    if (minesGemsFound>=(25-minesMineCount)) { minesCashout(); }
  }
}
function updateMinesMultiplier() {
  if (minesGemsFound===0) { minesCurrentMult=1.0; }
  else {
    let mult=1.0;
    for (let i=0;i<minesGemsFound;i++) {
      const remaining=25-i;
      const safeRemaining=remaining-minesMineCount;
      if (safeRemaining<=0) break;
      mult*=(remaining/safeRemaining)*0.97;
    }
    minesCurrentMult=Math.round(mult*100)/100;
  }
  document.getElementById('mines-mult').textContent=minesCurrentMult.toFixed(2)+'x';
  document.getElementById('mines-cashout-val').textContent=`(${Math.floor(minesBetAmount*minesCurrentMult)} 🪙)`;
}
function minesCashout() {
  if (!minesActive) return;
  minesActive=false;
  const winAmount=Math.floor(minesBetAmount*minesCurrentMult);
  currentUser.coins+=winAmount; updateWalletDisplay();
  document.getElementById('mines-start-btn').style.display='block';
  document.getElementById('mines-cashout-btn').style.display='none';
  document.getElementById('mines-status').textContent=`✅ Retiraste ${winAmount} 🪙`;
  document.querySelectorAll('.mine-cell').forEach(c=>c.classList.add('disabled'));
  showToast(`💎 +${winAmount} 🪙 (${minesCurrentMult.toFixed(2)}x)`,'success');
  playSound('coins');
  api('POST','/api/mines/result',{bet:minesBetAmount,won:true,gems:minesGemsFound,mult:minesCurrentMult}).catch(()=>{});
}
function shuffleArray(arr) {
  for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

// ── Admin ──────────────────────────────────────────────────────
async function loadAdmin() {
  if (!currentUser?.isAdmin) return;
  try { adminUsers=await api('GET','/api/admin/users'); renderAdminUsers(adminUsers); } catch {}
}
function renderAdminUsers(users) {
  const tbody=document.getElementById('admin-users-tbody');
  tbody.innerHTML=users.map(u=>`
    <tr>
      <td><strong>${u.username}</strong></td>
      <td style="color:var(--text2);font-size:0.76rem;">${u.email}</td>
      <td style="color:var(--accent);font-weight:700;">${(u.coins||0).toLocaleString()} 🪙</td>
      <td>${(u.stats?.earnings||0).toLocaleString()}</td>
      <td>${u.stats?.games||0}</td>
      <td><span class="badge ${u.banned?'badge-red':'badge-green'}">${u.banned?'Suspendido':'Activo'}</span></td>
      <td class="action-cell">
        <button class="btn btn-outline btn-sm" onclick="openGrantModal('${u.username}')">💰 Monedas</button>
        <button class="btn btn-${u.banned?'ghost-green':'red'} btn-sm" onclick="toggleBan('${u.username}',${!u.banned})">${u.banned?'✓ Activar':'🚫 Suspender'}</button>
      </td>
    </tr>`).join('');
}
function filterAdminUsers() {
  const q=document.getElementById('admin-user-search').value.toLowerCase();
  renderAdminUsers(adminUsers.filter(u=>u.username.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)));
}
let grantTarget=null;
function openGrantModal(username) {
  grantTarget=username;
  document.getElementById('grant-modal-title').textContent=`Modificar saldo — ${username}`;
  document.getElementById('grant-preview').textContent='';
  document.getElementById('grant-amount').value='';
  openModal('modal-admin-grant');
}
function updateGrantPreview() {
  const amount=parseInt(document.getElementById('grant-amount').value)||0;
  document.getElementById('grant-preview').textContent=`${grantTarget}: ${amount.toLocaleString()} 🪙`;
}
async function confirmGrant(action) {
  const amount=parseInt(document.getElementById('grant-amount').value);
  if (!amount||amount<1) return;
  try {
    await api('POST','/api/admin/grant',{username:grantTarget,amount,action});
    showToast(`Saldo actualizado para ${grantTarget}`,'success');
    closeModal('modal-admin-grant'); loadAdmin();
  } catch(e) { showToast(e.message,'error'); }
}
async function toggleBan(username,banned) {
  try {
    await api('POST','/api/admin/ban',{username,banned});
    showToast(banned?`${username} suspendido`:`${username} reactivado`,'success');
    loadAdmin();
  } catch(e) { showToast(e.message,'error'); }
}
function switchAdminTab(tab) {
  ['users','reports'].forEach(t=>{document.getElementById(`admin-tab-${t}`).style.display=t===tab?'block':'none';});
  document.querySelectorAll('#admin-tabs .tab-pill').forEach((el,i)=>{
    el.classList.toggle('active',(i===0&&tab==='users')||(i===1&&tab==='reports'));
  });
}
async function doSendSupport() {
  const msg=document.getElementById('support-msg').value.trim();
  const errEl=document.getElementById('support-err');
  if (!msg) { showErr(errEl,'Escribe tu mensaje'); return; }
  showToast('Mensaje enviado. Te responderemos pronto.','success');
  closeModal('modal-support');
  document.getElementById('support-msg').value='';
}
