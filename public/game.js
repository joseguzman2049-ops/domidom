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

// Audio context for Web Audio API
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

// Skins
const SKINS = [
  // Común (75%)
  { id:'hueso',     name:'Hueso Clásico',       rarity:'comun',    bg:'#f5f0e8', pip:'#1a1a1a', edge:'#ccc' },
  { id:'pizarra',   name:'Pizarra',              rarity:'comun',    bg:'#3d4451', pip:'#e8e8e8', edge:'#555' },
  { id:'pino',      name:'Madera de Pino',       rarity:'comun',    bg:'linear-gradient(135deg,#c8a87a,#a07040)', pip:'#2a1a08', edge:'#8b6040' },
  { id:'platano',   name:'Plátano Maduro',       rarity:'comun',    bg:'linear-gradient(135deg,#f5d060,#e8a020)', pip:'#3a2000', edge:'#c08000' },
  { id:'mangu',     name:'Mangú',                rarity:'comun',    bg:'linear-gradient(135deg,#8b7355,#6b5335)', pip:'#f0e8d0', edge:'#5a4025' },
  { id:'casabe',    name:'Casabe',               rarity:'comun',    bg:'#d4b896', pip:'#3a2010', edge:'#b09070' },
  { id:'coco',      name:'Coco Frío',            rarity:'comun',    bg:'linear-gradient(135deg,#f8f8f8,#e0e0e0)', pip:'#222', edge:'#bbb' },
  { id:'guira',     name:'Güira',                rarity:'comun',    bg:'#c8c090', pip:'#2a2a00', edge:'#a0a060' },
  { id:'tambora',   name:'Tambora',              rarity:'comun',    bg:'linear-gradient(135deg,#8b2020,#5a0808)', pip:'#f8d080', edge:'#6a1010' },
  { id:'conde',     name:'Conde Peatonal',       rarity:'comun',    bg:'#b8c8d8', pip:'#1a2a3a', edge:'#8090a0' },
  { id:'adoquin',   name:'Adoquín Colonial',     rarity:'comun',    bg:'#a09080', pip:'#f0e8d8', edge:'#807060' },
  { id:'pizarron',  name:'Pizarrón',             rarity:'comun',    bg:'#2d3a2d', pip:'#e8f0e8', edge:'#3a4a3a' },
  { id:'bavaro',    name:'Arena Bávaro',         rarity:'comun',    bg:'linear-gradient(135deg,#f0e0b0,#e0c880)', pip:'#4a3a10', edge:'#c0a840' },
  { id:'sal',       name:'Sal de Montecristi',   rarity:'comun',    bg:'#e8eef0', pip:'#2040a0', edge:'#c0d0d8' },
  { id:'yuca',      name:'Yuca',                 rarity:'comun',    bg:'#f0e8c8', pip:'#3a2a08', edge:'#c8b880' },
  { id:'cemento',   name:'Cemento Criollo',      rarity:'comun',    bg:'#9aa0a8', pip:'#e8ecf0', edge:'#707880' },
  // Raro (18%)
  { id:'marcaribe', name:'Mar Caribe',           rarity:'raro',     bg:'linear-gradient(135deg,#006994,#00b4d8)', pip:'#ffffff', edge:'#0090b8' },
  { id:'verdebanda',name:'Verde Bandera',        rarity:'raro',     bg:'#009a44', pip:'#ffffff', edge:'#007030' },
  { id:'cafecibao', name:'Café del Cibao',       rarity:'raro',     bg:'linear-gradient(135deg,#4a2800,#7a4810)', pip:'#f8e8c0', edge:'#3a1800' },
  { id:'bandera',   name:'Bandera Tricolor',     rarity:'raro',     bg:'linear-gradient(90deg,#002d62 33%,#ffffff 33%,#ffffff 66%,#ce1126 66%)', pip:'#000', edge:'#001840' },
  { id:'playabav',  name:'Playa Bávaro',         rarity:'raro',     bg:'linear-gradient(135deg,#00b4d8,#f0e0a0)', pip:'#002850', edge:'#00a0c0' },
  { id:'bachazul',  name:'Bachata Azul',         rarity:'raro',     bg:'linear-gradient(135deg,#1a1a6a,#3030c0)', pip:'#80d0ff', edge:'#2020a0' },
  { id:'chinola',   name:'Chinola',              rarity:'raro',     bg:'linear-gradient(135deg,#f5a623,#f8d060)', pip:'#3a1800', edge:'#d08000' },
  { id:'guandules', name:'Guandules',            rarity:'raro',     bg:'linear-gradient(135deg,#3a7a20,#70b040)', pip:'#f0f8e0', edge:'#286010' },
  { id:'tabaco',    name:'Tabaco del Cibao',     rarity:'raro',     bg:'linear-gradient(135deg,#5a3a1a,#8a6030)', pip:'#f0e0c0', edge:'#3a2008' },
  { id:'rioyaque',  name:'Río Yaque',            rarity:'raro',     bg:'linear-gradient(135deg,#4a9080,#80c0b0)', pip:'#f0fffd', edge:'#307060' },
  { id:'atardecer', name:'Atardecer Caribeño',   rarity:'raro',     bg:'linear-gradient(135deg,#ff6b35,#f7931e,#ffcd3c)', pip:'#2a0800', edge:'#d05010' },
  { id:'faro',      name:'Faro a Colón',         rarity:'raro',     bg:'linear-gradient(135deg,#e8e0d0,#c8c0a8)', pip:'#1a1000', edge:'#a09070' },
  { id:'charcos',   name:'27 Charcos',           rarity:'raro',     bg:'linear-gradient(135deg,#008060,#00c090)', pip:'#ffffff', edge:'#006040' },
  { id:'saona',     name:'Isla Saona',           rarity:'raro',     bg:'linear-gradient(135deg,#0080c0,#40e0d0,#f0f0a0)', pip:'#002040', edge:'#0060a0' },
  // Épico (5.5%)
  { id:'carnavalveg',name:'Carnaval Vegano',     rarity:'epico',    bg:'linear-gradient(135deg,#ff0080,#ff8000,#8000ff)', pip:'#ffffff', edge:'#cc0060' },
  { id:'merenguen', name:'Merengue Neón',        rarity:'epico',    bg:'linear-gradient(135deg,#ff00ff,#00ffff)', pip:'#1a0030', edge:'#cc00cc' },
  { id:'samana',    name:'Atardecer en Samaná',  rarity:'epico',    bg:'linear-gradient(135deg,#ff4500,#ff8c00,#ffd700)', pip:'#1a0000', edge:'#cc3000' },
  { id:'diablo',    name:'Diablo Cojuelo',       rarity:'epico',    bg:'linear-gradient(135deg,#cc0000,#ff6600,#ffcc00)', pip:'#1a0000', edge:'#990000' },
  { id:'carnavalstg',name:'Carnaval de Santiago',rarity:'epico',    bg:'linear-gradient(135deg,#6600cc,#cc00ff,#ff6600)', pip:'#ffffff', edge:'#4400aa' },
  { id:'mamajuana', name:'Mamajuana',            rarity:'epico',    bg:'linear-gradient(135deg,#6a1a00,#cc4400)', pip:'#f8d080', edge:'#4a0800' },
  { id:'ron',       name:'Ron Añejo',            rarity:'epico',    bg:'linear-gradient(135deg,#4a2800,#cc8800)', pip:'#fff8e0', edge:'#2a1000' },
  { id:'robagallina',name:'Roba la Gallina',     rarity:'epico',    bg:'linear-gradient(135deg,#ff0000,#ff8800,#ffff00,#00ff00,#0000ff,#8800ff)', pip:'#fff', edge:'#cc0000' },
  { id:'bachatneon',name:'Bachatón Neón',        rarity:'epico',    bg:'linear-gradient(135deg,#001a33,#0066ff,#00ffcc)', pip:'#ffffff', edge:'#0044aa' },
  { id:'quisqueyas', name:'Quisqueya Sunset',    rarity:'epico',    bg:'linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77)', pip:'#1a0020', edge:'#cc4040' },
  // Legendario (1%)
  { id:'ambar',     name:'Ámbar Dominicano',     rarity:'legendario', bg:'linear-gradient(135deg,#b8730a,#f5a623,#ffd700)', pip:'#1a0800', edge:'#8a5200' },
  { id:'larimar',   name:'Larimar Real',         rarity:'legendario', bg:'linear-gradient(135deg,#40c8e0,#80e8f8,#c0f0ff)', pip:'#002840', edge:'#20a0c0' },
  { id:'larimarprof',name:'Larimar Profundo',    rarity:'legendario', bg:'linear-gradient(135deg,#006080,#20a0c0,#40e0ff)', pip:'#ffffff', edge:'#004060' },
  { id:'ambarazul', name:'Ámbar Azul',           rarity:'legendario', bg:'linear-gradient(135deg,#0000aa,#4040ff,#8080ff,#d4aa00)', pip:'#ffffff', edge:'#000088' },
  { id:'orocotui',  name:'Oro de Cotuí',         rarity:'legendario', bg:'linear-gradient(135deg,#8a6a00,#ffd700,#fffacd)', pip:'#1a0800', edge:'#6a4a00' },
  // Mítico (0.4%)
  { id:'oropueblo', name:'Oro de Pueblo Viejo',  rarity:'mitico',   bg:'linear-gradient(135deg,#4a3000,#c8a000,#ffd700,#fffacd,#ffd700)', pip:'#1a0800', edge:'#3a2000', glow:'#ffd700' },
  { id:'quisqdiamante',name:'Quisqueya Diamante',rarity:'mitico',   bg:'linear-gradient(135deg,#c0c0c0,#e8e8e8,#ffffff,#e0f0ff,#ffffff)', pip:'#1a2a4a', edge:'#a0a0c0', glow:'#80d0ff' },
  { id:'corazon',   name:'Corazón de Quisqueya', rarity:'mitico',   bg:'linear-gradient(135deg,#cc0020,#ff2040,#ff80a0,#ff2040)', pip:'#ffffff', edge:'#880010', glow:'#ff4060' },
  // Tesoro Nacional (0.1% FOIL)
  { id:'duarte',    name:'Duarte · Tesoro Nacional', rarity:'tesoro', bg:'linear-gradient(135deg,#002d62,#ffd700,#ce1126)', pip:'#ffd700', edge:'#001840', foil:true, glow:'#ffd700', specialUnlock:'level10' },
  { id:'padres',    name:'Padres de la Patria',  rarity:'tesoro',   bg:'linear-gradient(135deg,#002d62,#009a44,#ce1126,#ffd700)', pip:'#ffffff', edge:'#001840', foil:true, glow:'#ffd700' },
];

let equippedSkin = SKINS[0];

// ── Pip layout ─────────────────────────────────────────────────
// 9-cell grid: [TL, TM, TR, ML, MM, MR, BL, BM, BR]
const PIP_LAYOUTS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

function makePipHalf(n, skin) {
  const layout = PIP_LAYOUTS[n] || [];
  const cells = Array(9).fill(false);
  layout.forEach(i => { cells[i] = true; });
  return `<div class="pip-grid">${cells.map(hasPip =>
    `<span${hasPip ? ` class="pip" style="background:${skin.pip}"` : ''}></span>`
  ).join('')}</div>`;
}

function makeTileHTML(a, b, skin, opts = {}) {
  const isDouble = a === b;
  const cls = opts.cls || '';
  const style = opts.style || '';
  const dividerStyle = `background:${skin.edge};`;
  const bgStyle = typeof skin.bg === 'string' && skin.bg.startsWith('linear') ? `background:${skin.bg}` : `background:${skin.bg}`;
  const borderStyle = `border-color:${skin.edge};`;
  const glowStyle = skin.glow ? `box-shadow:0 0 12px ${skin.glow},0 2px 6px rgba(0,0,0,0.3);` : 'box-shadow:0 2px 4px rgba(0,0,0,0.25);';
  return `<div class="domino-tile ${isDouble ? 'double' : ''} ${cls}" style="${bgStyle};${borderStyle}${glowStyle}${style}">
    <div class="tile-half top">${makePipHalf(a, skin)}</div>
    <div class="tile-divider" style="${dividerStyle}"></div>
    <div class="tile-half bottom">${makePipHalf(b, skin)}</div>
  </div>`;
}

// ── Sound Engine (Web Audio API) ───────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    switch(type) {
      case 'place': playClick(ctx, 0.3, 180, 0.08); break;
      case 'slam':  playSlam(ctx); break;
      case 'capicua': playCapicua(ctx); break;
      case 'victory': playVictory(ctx); break;
      case 'pollona': playPollona(ctx); break;
      case 'myturn': playMyTurn(ctx); break;
      case 'coins': playCoins(ctx); break;
      case 'agua': playClick(ctx, 0.1, 80, 0.06); break;
    }
  } catch(e) {}
}

function playClick(ctx, vol, freq, dur) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.start(); o.stop(ctx.currentTime + dur);
}

function playSlam(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
  }
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf; src.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0.8, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  src.start();
}

function playCapicua(ctx) {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playClick(ctx, 0.4, f, 0.15), i * 80);
  });
}

function playVictory(ctx) {
  [523, 659, 784, 784, 1047].forEach((f, i) => {
    setTimeout(() => playClick(ctx, 0.5, f, 0.2), i * 100);
  });
}

function playPollona(ctx) {
  [261, 329, 392, 523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playClick(ctx, 0.6, f, 0.3), i * 120);
  });
}

function playMyTurn(ctx) {
  playClick(ctx, 0.2, 880, 0.05);
  setTimeout(() => playClick(ctx, 0.15, 1100, 0.04), 80);
}

function playCoins(ctx) {
  [784, 880, 1047, 1175].forEach((f, i) => {
    setTimeout(() => playClick(ctx, 0.3, f, 0.08), i * 50);
  });
}

// ── Init ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadInitial();
  document.getElementById('loading-screen').style.display = 'none';
  initCrashCanvas();
  buildMinesGrid();

  // Sound toggle button
  const soundBtn = document.createElement('button');
  soundBtn.id = 'sound-btn';
  soundBtn.textContent = '🔊';
  soundBtn.title = 'Silenciar/Activar sonidos';
  soundBtn.onclick = () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
  };
  Object.assign(soundBtn.style, {
    position:'fixed', top:'62px', right:'10px', zIndex:'150',
    background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'6px',
    padding:'5px 8px', cursor:'pointer', fontSize:'1rem', color:'var(--text2)'
  });
  document.body.appendChild(soundBtn);
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

  // Load saved skin
  const savedSkin = localStorage.getItem('equippedSkin');
  if (savedSkin) equippedSkin = SKINS.find(s => s.id === savedSkin) || SKINS[0];
}

// ── API helper ─────────────────────────────────────────────────
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
    const isCapicua = result.type === 'capicua';
    const isTranca = result.type === 'tranca';
    if (isCapicua) {
      showToast('⭐ ¡CAPICÚA! +25 puntos', 'gold');
      playSound('capicua');
    } else if (isTranca) {
      showToast('🔒 ¡TRANCA! Mesa bloqueada', 'info');
    } else {
      showToast('Ronda ganada', 'success');
    }
  });
  socket.on('match:end', showWinOverlay);
  socket.on('chat:message', appendChatMessage);
  socket.on('slam', ({ username }) => {
    handleSlam(username);
  });
  socket.on('queue:joined', ({ province }) => { currentQueueProvince = province; });
  socket.on('room:created', ({ roomId }) => { showScreen('game'); document.getElementById('game-room-code').textContent = roomId; });
  socket.on('room:error', (msg) => showToast(msg, 'error'));
  socket.on('friends:list', renderFriendsList);
  socket.on('friends:requests', renderFriendRequests);
  socket.on('friends:request', ({ from }) => showToast(`${from} te envió solicitud de amistad`, 'info'));
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

  if (!username || !pass || !email) { showErr(errEl, 'Completa todos los campos'); return; }
  if (pass !== pass2) { showErr(errEl, 'Las contraseñas no coinciden'); return; }
  if (pass.length < 6) { showErr(errEl, 'Contraseña mínimo 6 caracteres'); return; }

  const btn = document.getElementById('btn-reg-submit');
  btn.disabled = true; btn.textContent = 'Creando…';

  try {
    const res = await api('POST', '/api/auth/register', { username, password: pass, email, phone });
    currentUser = { ...res };
    localStorage.setItem('token', res.token);
    socket.emit('auth', { token: res.token });
    updateUIForLoggedIn();
    showScreen('home');
    showToast('¡Cuenta creada! Bienvenido 🎉', 'success');
  } catch (e) { showErr(errEl, e.message); }
  finally { btn.disabled = false; btn.textContent = 'Crear Cuenta'; }
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
  } catch (e) { showErr(errEl, e.message); }
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
  if (name === 'friends') loadFriends();
  if (name === 'admin') loadAdmin();
  if (name === 'crash') initCrashGame();
  if (name === 'mines') initMinesGame();
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', gold: '⭐' };
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
  if (currentUser.isAdmin && !document.getElementById('btn-admin-top')) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline btn-sm';
    btn.id = 'btn-admin-top';
    btn.textContent = '⚙️ Admin';
    btn.onclick = () => showScreen('admin');
    document.getElementById('topbar-right').insertBefore(btn, document.getElementById('btn-logout'));
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

// ── Provinces ──────────────────────────────────────────────────
async function loadProvinces() {
  try { renderProvinces(await api('GET', '/api/provinces')); } catch {}
}

function renderProvinces(provinces) {
  const grid = document.getElementById('province-grid');
  if (!grid) return;
  grid.innerHTML = provinces.map(p => `
    <div class="prov-card ${p.featured ? 'featured' : ''}" onclick="joinProvince('${p.id}', ${p.buyIn})">
      <div class="prov-name">${p.name}</div>
      <div class="prov-buyin">${p.buyIn.toLocaleString()} 🪙 <small>buy-in</small></div>
      <div class="prov-players"><span class="live-dot"></span>${p.playersInQueue} en cola · ${p.activeTables} mesa${p.activeTables !== 1 ? 's' : ''}</div>
    </div>`).join('');
}

function joinProvince(provinceId, buyIn) {
  if (!currentUser) { showScreen('login'); return; }
  if (currentUser.coins < buyIn) { showToast('Saldo insuficiente', 'error'); return; }
  const prov = document.querySelector(`.prov-card[onclick*="${provinceId}"]`);
  document.getElementById('queue-province-name').textContent = prov?.querySelector('.prov-name')?.textContent || 'Cola';
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
  try { renderLeaderboard(await api('GET', '/api/leaderboard')); } catch {}
}

function renderLeaderboard(data) {
  const el = document.getElementById('leaderboard-mini');
  if (!el || !data?.length) { if (el) el.innerHTML = '<div class="empty-state">Aún no hay datos</div>'; return; }
  el.innerHTML = data.slice(0, 5).map((u, i) => `
    <div class="lb-row">
      <span class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</span>
      <div class="lb-avatar">${u.username[0].toUpperCase()}</div>
      <span class="lb-name">${u.username}</span>
      <span class="lb-amount">${u.earnings.toLocaleString()} 🪙</span>
    </div>`).join('');
}

async function loadOnlineCount() {
  try { const { count } = await api('GET', '/api/online'); document.querySelectorAll('#online-count').forEach(el => el.textContent = count); } catch {}
}

// ── Wallet (solo monedas virtuales — sin retiros ni depósitos) ──
async function loadWallet() {
  if (!currentUser) { showScreen('login'); return; }
  try {
    const me = await api('GET', '/api/me');
    currentUser = { ...currentUser, ...me };
    document.getElementById('wallet-balance-display').textContent = `${me.coins.toLocaleString()} 🪙`;
    document.getElementById('wallet-net-display').textContent = `Net: ${(me.stats.earnings || 0).toLocaleString()} | Juegos: ${me.stats.games} | Victorias: ${me.stats.wins}`;
    renderTransactions(me.transactions || []);
  } catch {}
}

function renderTransactions(txs) {
  const el = document.getElementById('tx-list');
  if (!txs.length) { el.innerHTML = '<div class="empty-state">Sin transacciones</div>'; return; }
  el.innerHTML = txs.slice().reverse().map(tx => {
    const icons = { win: '🏆', loss: '💸', admin_credit: '✅', admin_debit: '❌', crash_win: '🚀', crash_loss: '💥', mines_win: '💎', mines_loss: '💣' };
    const positive = tx.amount > 0;
    return `<div class="tx-item">
      <div class="tx-icon ${positive?'win':'loss'}">${icons[tx.type] || '🔄'}</div>
      <div class="tx-info"><div class="tx-title">${tx.type.replace(/_/g,' ')}</div><div class="tx-date">${new Date(tx.date).toLocaleDateString('es-DO')}</div></div>
      <div class="tx-amount ${positive?'positive':'negative'}">${positive?'+':''}${tx.amount.toLocaleString()} 🪙</div>
    </div>`;
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
    document.getElementById('p-wr').textContent = me.stats.games > 0 ? `${Math.round((me.stats.wins / me.stats.games) * 100)}%` : '0%';
    if (me.isAdmin) document.getElementById('profile-badges-row').innerHTML = '<span class="badge badge-orange">⚙️ Admin</span>';
  } catch {}
}

// ── Friends ────────────────────────────────────────────────────
function loadFriends() { if (currentUser) socket.emit('friends:list'); }

function renderFriendsList(friends) {
  const el = document.getElementById('friends-list');
  if (!friends.length) { el.innerHTML = '<div class="empty-state">No tienes amigos todavía.</div>'; return; }
  el.innerHTML = friends.map(f => `
    <div class="friend-item">
      <div class="friend-status-dot ${f.online ? 'online' : 'offline'}"></div>
      <div class="lb-avatar">${f.username[0].toUpperCase()}</div>
      <span style="flex:1;font-weight:600;">${f.username}</span>
      <span class="badge ${f.online ? 'badge-green' : 'badge-gray'}">${f.online ? 'En línea' : 'Offline'}</span>
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

// ── Friend Room ────────────────────────────────────────────────
function showFriendRoomModal() {
  if (!currentUser) { showScreen('login'); return; }
  openModal('modal-friend-room');
}

function switchFriendTab(tab) {
  document.getElementById('fr-create').style.display = tab === 'create' ? 'block' : 'none';
  document.getElementById('fr-join').style.display = tab === 'join' ? 'block' : 'none';
  document.querySelectorAll('#modal-friend-room .tab-pill').forEach((t, i) => {
    t.classList.toggle('active', (i===0&&tab==='create')||(i===1&&tab==='join'));
  });
}

function doCreateRoom() {
  const buyIn = parseInt(document.getElementById('fr-buyin').value) || 0;
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

function leaveRoom() { showScreen('home'); currentRoom = null; }
function doAddBot() { socket.emit('room:add-bot'); }
function doStartGame() { socket.emit('room:start'); }

// ── Practice ───────────────────────────────────────────────────
function showPracticeModal() {
  if (!currentUser) { showScreen('login'); return; }
  const grid = document.getElementById('practice-levels');
  grid.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(lvl => `
    <button class="btn btn-outline btn-sm" style="flex-direction:column;gap:2px;padding:10px 4px;" onclick="startPractice(${lvl})">
      <span>${['😊','🙂','😐','🤔','😬','😤','😠','👿','💀','🏆'][lvl-1]}</span>
      <span style="font-size:0.7rem;">Nv ${lvl}</span>
    </button>`).join('');
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
  document.getElementById('game-room-code').textContent = room.id;
  document.getElementById('game-pot-badge').textContent = `Pote: ${(room.pot || 0).toLocaleString()} 🪙`;
  const seats = document.getElementById('lobby-seats-display');
  const filled = room.players.length;
  seats.innerHTML = Array.from({ length: 4 }, (_, i) => {
    const p = room.players.find(pl => pl.seatIndex === i);
    return `<div class="lobby-seat ${p ? 'filled' : ''}">
      <div class="ls-icon">${p ? (p.isBot ? '🤖' : '👤') : '⬜'}</div>
      <div style="font-size:0.75rem;font-weight:600;">${p ? p.username : `Asiento ${i+1}`}</div>
      <div class="badge ${i%2===0?'badge-blue':'badge-red'}" style="font-size:0.62rem;">Equipo ${i%2===0?'A':'B'}</div>
    </div>`;
  }).join('');
  document.getElementById('game-lobby-info').textContent = filled < 4 ? `${4-filled} jugador${4-filled!==1?'es':''} más` : '¡Listos para jugar!';
  const isHost = room.host === currentUser?.username;
  document.getElementById('host-controls').style.display = isHost ? 'flex' : 'none';
}

// ── GAME STATE RENDER ──────────────────────────────────────────
function renderGameState(state) {
  if (!state) return;
  document.getElementById('score-a').textContent = state.scores?.[0] ?? 0;
  document.getElementById('score-b').textContent = state.scores?.[1] ?? 0;
  renderBoard(state.board || [], state.leftEnd, state.rightEnd);
  renderHand(state.myHand || [], state.legalMoves || [], state.currentPlayer, state.myIndex);
  renderSeats(state);

  // Play my turn sound
  if (state.currentPlayer === state.myIndex) {
    playSound('myturn');
  }
}

// ── BOARD RENDERING — SERPENTINE ───────────────────────────────
function renderBoard(board, leftEnd, rightEnd) {
  const snake = document.getElementById('snake');
  if (!board.length) {
    snake.innerHTML = '<div style="color:rgba(255,255,255,0.15);font-size:0.82rem;padding:16px;">Esperando primera ficha…</div>';
    return;
  }

  const container = document.getElementById('board-container');
  const maxW = container.clientWidth - 20;
  const maxH = container.clientHeight - 20;

  // Tile dimensions at scale 1
  const TW = 40; // tile width (horizontal orientation)
  const TH = 22; // tile height
  const GAP = 3;

  // Calculate positions for all tiles in serpentine
  const positions = []; // {x, y, rotation} for each tile
  let x = 10, y = 10;
  let dir = 1; // 1=right, -1=left
  let rowStart = 10;

  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    const isDouble = tile[0] === tile[1];
    const tw = isDouble ? TH : TW;
    const th = isDouble ? TW : TH;

    // Check if fits in current direction
    const nextX = x + dir * (tw + GAP);
    const overflow = dir === 1 ? (x + tw > maxW) : (x < 10);

    if (overflow && i > 0) {
      // Turn: go down 2 tile heights
      y += th + GAP + TH + GAP;
      dir *= -1;
      x = dir === 1 ? 10 : maxW - tw;
      rowStart = y;
    }

    positions.push({ x, y, isDouble, tw, th });
    x += dir * (tw + GAP);
  }

  // Calculate scale to fit
  let maxX = 0, maxY = 0;
  positions.forEach(p => { maxX = Math.max(maxX, p.x + p.tw); maxY = Math.max(maxY, p.y + p.th); });
  const scaleX = maxX > maxW ? maxW / maxX : 1;
  const scaleY = maxY > maxH ? maxH / maxY : 1;
  const rawScale = Math.min(scaleX, scaleY, 1);
  // Snap to nice scale
  const niceScales = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const scale = niceScales.reduce((prev, curr) => Math.abs(curr - rawScale) < Math.abs(prev - rawScale) ? curr : prev);

  const skin = equippedSkin;
  const html = positions.map((p, i) => {
    const tile = board[i];
    const [a, b] = tile;
    const isDouble = p.isDouble;
    const rot = isDouble ? 'rotate(90deg)' : '';
    const bgStyle = typeof skin.bg === 'string' && skin.bg.startsWith('linear') ? `background:${skin.bg}` : `background:${skin.bg}`;
    const borderStyle = `border-color:${skin.edge};`;
    const glowStyle = skin.glow ? `box-shadow:0 0 8px ${skin.glow},0 2px 4px rgba(0,0,0,0.3);` : 'box-shadow:0 2px 4px rgba(0,0,0,0.2);';

    return `<div class="board-tile" style="
      position:absolute;
      left:${p.x * scale}px;
      top:${p.y * scale}px;
      width:${p.tw * scale}px;
      height:${p.th * scale}px;
      ${bgStyle};${borderStyle}${glowStyle}
      display:flex;flex-direction:${isDouble ? 'column' : 'row'};
      border-radius:${3 * scale}px;
      border-width:${Math.max(1, scale)}px;border-style:solid;
      overflow:hidden;
      transform:${rot};
    ">
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:${2*scale}px;">
        ${makeMiniPips(a, skin, scale)}
      </div>
      <div style="${isDouble ? 'height:1px;' : 'width:1px;'}background:${skin.edge};flex-shrink:0;"></div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:${2*scale}px;">
        ${makeMiniPips(b, skin, scale)}
      </div>
    </div>`;
  }).join('');

  snake.style.position = 'relative';
  snake.style.height = `${maxY * scale + 10}px`;
  snake.innerHTML = html;
}

function makeMiniPips(n, skin, scale) {
  const layout = PIP_LAYOUTS[n] || [];
  const cells = Array(9).fill(false);
  layout.forEach(i => { cells[i] = true; });
  const pipSize = Math.max(3, Math.floor(5 * scale));
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);width:100%;height:100%;gap:${Math.max(1,scale)}px;padding:${scale}px;">
    ${cells.map(hasPip => `<span style="display:block;${hasPip ? `background:${skin.pip};border-radius:50%;` : ''}"></span>`).join('')}
  </div>`;
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
    const isSelected = selectedTile && selectedTile[0] === a && selectedTile[1] === b;
    const bgStyle = typeof skin.bg === 'string' && skin.bg.startsWith('linear') ? `background:${skin.bg}` : `background:${skin.bg}`;
    const borderColor = isSelected ? '#ffd700' : (isLegal ? `rgba(0,231,1,0.7)` : skin.edge);
    const opacity = (!isMyTurn || !isLegal) ? '0.4' : '1';
    const translateY = isSelected ? '-16px' : '';
    const glow = isSelected ? `0 0 16px #ffd700,0 4px 12px rgba(0,0,0,0.4)` : (isLegal && isMyTurn ? `0 0 8px rgba(0,231,1,0.4),0 2px 6px rgba(0,0,0,0.3)` : '0 2px 4px rgba(0,0,0,0.2)');

    return `<div class="hand-tile-wrap ${isSelected ? 'selected' : ''} ${isLegal && isMyTurn ? 'legal' : ''}"
      style="opacity:${opacity};transform:translateY(${translateY});transition:transform 0.15s,box-shadow 0.15s;"
      onclick="${isMyTurn && isLegal ? `selectHandTile(${a},${b})` : ''}">
      <div class="hand-domino" style="
        ${bgStyle};
        border:2px solid ${borderColor};
        box-shadow:${glow};
        border-radius:6px;
        display:flex;flex-direction:column;
        width:48px;height:96px;
        overflow:hidden;cursor:${isMyTurn && isLegal ? 'pointer' : 'default'};
      ">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:4px;">
          ${makePipHalf(a, skin)}
        </div>
        <div style="height:2px;background:${skin.edge};flex-shrink:0;"></div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:4px;">
          ${makePipHalf(b, skin)}
        </div>
      </div>
    </div>`;
  }).join('');

  // Show/hide action buttons
  const hasLegal = legalMoves.length > 0;
  const btnLeft = document.getElementById('btn-place-left');
  const btnRight = document.getElementById('btn-place-right');
  const btnSlam = document.getElementById('btn-slam');
  const btnPass = document.getElementById('btn-pass');

  if (isMyTurn) {
    if (selectedTile) {
      btnLeft.classList.remove('hidden');
      btnRight.classList.remove('hidden');
      btnSlam.classList.remove('hidden');
      btnPass.classList.add('hidden');
    } else if (!hasLegal) {
      btnLeft.classList.add('hidden');
      btnRight.classList.add('hidden');
      btnSlam.classList.add('hidden');
      btnPass.classList.remove('hidden');
    } else {
      hideHandControls();
    }
  } else {
    hideHandControls();
  }
}

function hideHandControls() {
  ['btn-place-left','btn-place-right','btn-slam','btn-pass'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

function selectHandTile(a, b) {
  if (selectedTile && selectedTile[0] === a && selectedTile[1] === b) {
    selectedTile = null;
  } else {
    selectedTile = [a, b];
  }
  // Re-render hand with current state — need to request game state again
  socket.emit('game:request-state');
}

function placeSelectedLeft(slam = false) {
  if (!selectedTile) return;
  socket.emit('game:play', { tile: selectedTile, side: 'left', slam });
  if (slam) playSound('slam');
  else playSound('place');
  selectedTile = null;
}

function placeSelectedRight(slam = false) {
  if (!selectedTile) return;
  socket.emit('game:play', { tile: selectedTile, side: 'right', slam });
  if (slam) playSound('slam');
  else playSound('place');
  selectedTile = null;
}

function doSlam() {
  // Slam: try right first, then left
  if (!selectedTile) return;
  socket.emit('game:play', { tile: selectedTile, side: 'auto', slam: true });
  playSound('slam');
  selectedTile = null;
}

function doPass() {
  socket.emit('game:pass');
  playSound('agua');
  showToast('¡Agua! Pasando turno…', 'info');
}

// ── Slam animation ─────────────────────────────────────────────
function handleSlam(username) {
  playSound('slam');
  // Shake the board
  const board = document.getElementById('board-container');
  board.classList.add('shake');
  setTimeout(() => board.classList.remove('shake'), 500);
  // Show message in chat
  appendChatMessage({ username: 'Mesa', message: `${username} 💥 ¡TRÁNQUELE!` });
}

// ── Seats ──────────────────────────────────────────────────────
function renderSeats(state) {
  // Seat layout: 0=bottom(me), 1=left, 2=top(partner), 3=right
  // We show opponents above and sides, me at bottom
  const topSeat = document.getElementById('seats-top');
  const leftSeat = document.getElementById('seats-left');
  const rightSeat = document.getElementById('seats-right');

  const makeOpponentSeat = (seatIdx) => {
    if (!state.handCounts) return '';
    const count = state.handCounts[seatIdx] ?? 0;
    const isActive = state.currentPlayer === seatIdx;
    const teamClass = seatIdx % 2 === 0 ? 'team-a' : 'team-b';
    const playerName = currentRoom?.players?.[seatIdx]?.username || `J${seatIdx+1}`;
    const isBot = currentRoom?.players?.[seatIdx]?.isBot;
    return `<div class="opponent-seat ${isActive ? 'active-turn' : ''} ${teamClass}">
      <div class="seat-avatar ${isActive ? 'glow' : ''}">${isBot ? '🤖' : playerName[0]?.toUpperCase()}</div>
      <div class="seat-name">${playerName}</div>
      <div class="seat-hand-count">${count} fichas</div>
    </div>`;
  };

  if (topSeat) topSeat.innerHTML = makeOpponentSeat(2);
  if (leftSeat) leftSeat.innerHTML = makeOpponentSeat(1);
  if (rightSeat) rightSeat.innerHTML = makeOpponentSeat(3);

  // My seat indicator
  const myActive = state.currentPlayer === state.myIndex;
  const myEl = document.getElementById('my-seat-label');
  if (myEl) {
    myEl.textContent = myActive ? '⏳ TU TURNO' : 'Tú';
    myEl.className = myActive ? 'my-turn-label' : 'my-seat-label';
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
    bar.style.width = (timerSeconds / seconds * 100) + '%';
    const urgent = timerSeconds <= 10;
    bar.classList.toggle('urgent', urgent);
    timer.classList.toggle('urgent', urgent);
  }, 1000);
}

// ── Chat ───────────────────────────────────────────────────────
function appendChatMessage(msg) {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  const isSystem = msg.username === 'Sistema' || msg.username === 'Mesa';
  div.className = `chat-msg${isSystem ? ' system' : ''}`;
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
  const myTeam = currentRoom?.players?.find(p => p.username === currentUser?.username)?.team ?? 0;
  const won = result.winnerTeam === myTeam;
  const isPollona = result.isPollona;

  document.getElementById('win-title-text').textContent = isPollona
    ? (won ? '¡POLLONA! 🎯🎯🎯' : '¡ZAPATERO! 😭💀')
    : (won ? '¡VICTORIA! 🏆' : '¡DERROTA! 💀');
  document.getElementById('win-title-text').className = `win-title ${won ? (isPollona ? 'pollona' : 'victory') : 'loss'}`;
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
    if (isPollona) { playSound('pollona'); } else { playSound('victory'); }
    if (result.perPlayer > 0) setTimeout(() => playSound('coins'), 800);
    launchConfetti();
  }
}

function closeWinOverlay() {
  document.getElementById('win-overlay').classList.remove('show');
  showScreen('home');
  loadProvinces(); loadLeaderboard();
  if (currentUser) api('GET', '/api/me').then(me => { currentUser = { ...currentUser, ...me }; updateWalletDisplay(); updateSidebarStats(); }).catch(() => {});
}

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width, y: -10, r: Math.random() * 5 + 3,
    d: Math.random() * 3 + 1, color: ['#00e701','#ffd700','#4da2ff','#ff4444','#ffffff','#ce1126','#002d62'][Math.floor(Math.random() * 7)],
    tiltAngle: 0,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r/2, p.tiltAngle, 0, Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();
      p.y += p.d; p.tiltAngle += 0.1; p.x += Math.sin(frame/10) * 0.4;
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
    });
    frame++;
    if (frame < 300) requestAnimationFrame(draw);
    else { canvas.style.display = 'none'; ctx.clearRect(0, 0, canvas.width, canvas.height); }
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
  if (crashState !== 'waiting') { showToast('Espera la próxima ronda', 'info'); return; }
  const bet = parseInt(document.getElementById('crash-bet').value) || 0;
  const auto = parseFloat(document.getElementById('crash-auto').value) || 0;
  if (bet < 1) { showToast('Apuesta mínima: 1 🪙', 'error'); return; }
  if (currentUser.coins < bet) { showToast('Saldo insuficiente', 'error'); return; }

  crashBetAmount = bet;
  crashAutoCashout = auto;
  crashCashedOut = false;
  currentUser.coins -= bet;
  updateWalletDisplay();

  document.getElementById('crash-my-bet').textContent = `${bet} 🪙`;
  document.getElementById('crash-btn').style.display = 'none';
  document.getElementById('crash-cashout-btn').style.display = 'block';

  startCrashRound();
}

function startCrashRound() {
  crashState = 'flying';
  crashMult = 1.0;
  crashPoints = [];

  const rand = Math.random();
  let crashPoint;
  if (rand < 0.70) {
    crashPoint = 1.0 + Math.random() * 0.8;
  } else {
    crashPoint = 1.5 + Math.pow(Math.random(), 0.5) * 8.5;
  }

  const startTime = Date.now();

  crashInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    crashMult = Math.pow(Math.E, elapsed * 0.12);
    crashMult = Math.round(crashMult * 100) / 100;

    crashPoints.push({ t: elapsed, m: crashMult });
    drawCrashCanvas(crashMult, false);

    document.getElementById('crash-multiplier').textContent = crashMult.toFixed(2) + 'x';
    document.getElementById('crash-live-mult').textContent = crashMult.toFixed(2) + 'x';
    document.getElementById('crash-potential').textContent = Math.floor(crashBetAmount * crashMult) + ' 🪙';
    document.getElementById('crash-cashout-val').textContent = `(${Math.floor(crashBetAmount * crashMult)} 🪙)`;

    if (crashAutoCashout > 1 && crashMult >= crashAutoCashout && !crashCashedOut) {
      crashCashout(); return;
    }

    if (crashMult >= crashPoint) { doCrash(); }
  }, 80);
}

function crashCashout() {
  if (crashCashedOut || crashState !== 'flying') return;
  crashCashedOut = true;
  clearInterval(crashInterval);
  const winAmount = Math.floor(crashBetAmount * crashMult);
  currentUser.coins += winAmount;
  updateWalletDisplay();
  crashHistory.unshift({ mult: crashMult, won: true });
  renderCrashHistory();
  showToast(`✅ Retiraste a ${crashMult.toFixed(2)}x — +${winAmount} 🪙`, 'success');
  playSound('coins');
  endCrashRound(true);
  api('POST', '/api/crash/result', { bet: crashBetAmount, mult: crashMult, won: true }).catch(() => {});
}

function doCrash() {
  clearInterval(crashInterval);
  crashState = 'crashed';
  drawCrashCanvas(crashMult, true);
  const multEl = document.getElementById('crash-multiplier');
  multEl.textContent = crashMult.toFixed(2) + 'x';
  multEl.classList.add('crashed');
  if (!crashCashedOut) {
    showToast(`💥 Crashed en ${crashMult.toFixed(2)}x`, 'error');
    crashHistory.unshift({ mult: crashMult, won: false });
    renderCrashHistory();
    api('POST', '/api/crash/result', { bet: crashBetAmount, mult: crashMult, won: false }).catch(() => {});
  }
  endCrashRound(false);
}

function endCrashRound(won) {
  document.getElementById('crash-cashout-btn').style.display = 'none';
  setTimeout(() => {
    crashState = 'waiting';
    crashMult = 1.0; crashPoints = [];
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
  if (!crashCtx || !crashCanvas) return;
  const w = crashCanvas.width, h = crashCanvas.height;
  crashCtx.clearRect(0, 0, w, h);
  crashCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  crashCtx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    crashCtx.beginPath(); crashCtx.moveTo(0, h * i / 5); crashCtx.lineTo(w, h * i / 5); crashCtx.stroke();
    crashCtx.beginPath(); crashCtx.moveTo(w * i / 5, 0); crashCtx.lineTo(w * i / 5, h); crashCtx.stroke();
  }
  if (crashPoints.length < 2) return;
  const maxT = Math.max(crashPoints[crashPoints.length - 1].t, 2);
  const maxM = Math.max(mult + 0.5, 2);
  const toX = t => (t / maxT) * (w * 0.9) + w * 0.05;
  const toY = m => h - ((m - 1) / (maxM - 1)) * (h * 0.85) - h * 0.05;
  const grad = crashCtx.createLinearGradient(0, h, w, 0);
  grad.addColorStop(0, crashed ? 'rgba(255,68,68,0.6)' : 'rgba(0,231,1,0.6)');
  grad.addColorStop(1, crashed ? 'rgba(255,68,68,0.1)' : 'rgba(0,231,1,0.1)');
  crashCtx.beginPath();
  crashCtx.moveTo(toX(0), toY(1));
  crashPoints.forEach(p => crashCtx.lineTo(toX(p.t), toY(p.m)));
  const lastX = toX(crashPoints[crashPoints.length - 1].t);
  crashCtx.lineTo(lastX, h); crashCtx.lineTo(toX(0), h); crashCtx.closePath();
  crashCtx.fillStyle = grad; crashCtx.fill();
  crashCtx.beginPath();
  crashCtx.moveTo(toX(0), toY(1));
  crashPoints.forEach(p => crashCtx.lineTo(toX(p.t), toY(p.m)));
  crashCtx.strokeStyle = crashed ? '#ff4444' : '#00e701';
  crashCtx.lineWidth = 2.5; crashCtx.stroke();
  const rocket = document.getElementById('crash-rocket');
  const lp = crashPoints[crashPoints.length - 1];
  if (rocket && lp) {
    rocket.style.left = toX(lp.t) + 'px';
    rocket.style.bottom = (h - toY(lp.m)) + 'px';
    rocket.style.display = crashed ? 'none' : 'block';
  }
}

function renderCrashHistory() {
  const el = document.getElementById('crash-history');
  if (!el) return;
  el.innerHTML = crashHistory.slice(0, 10).map(h => {
    const cls = h.mult < 1.5 ? 'low' : h.mult < 3 ? 'mid' : 'high';
    return `<span class="crash-hist-item ${cls}">${h.mult.toFixed(2)}x</span>`;
  }).join('');
}

// ══════════════════════════════════════════════════
// ── MINES GAME ────────────────────────────────────
// ══════════════════════════════════════════════════
function initMinesGame() {
  if (!currentUser) return;
  buildMinesGrid();
  minesActive = false; minesGemsFound = 0;
  document.getElementById('mines-start-btn').style.display = 'block';
  document.getElementById('mines-cashout-btn').style.display = 'none';
  document.getElementById('mines-mult').textContent = '1.00x';
  document.getElementById('mines-status').textContent = 'Configura tu apuesta';
  document.getElementById('mines-gem-count').textContent = 'Gemas encontradas: 0';
}

function buildMinesGrid() {
  const grid = document.getElementById('mines-grid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 25 }, (_, i) =>
    `<div class="mine-cell" id="mine-${i}" onclick="minesReveal(${i})">🎲</div>`
  ).join('');
}

function minesStart() {
  if (!currentUser) { showScreen('login'); return; }
  const bet = parseInt(document.getElementById('mines-bet').value) || 0;
  const mines = parseInt(document.getElementById('mines-count').value) || 3;
  if (bet < 1) { showToast('Apuesta mínima: 1 🪙', 'error'); return; }
  if (mines < 1 || mines > 24) { showToast('Minas: entre 1 y 24', 'error'); return; }
  if (currentUser.coins < bet) { showToast('Saldo insuficiente', 'error'); return; }

  minesBetAmount = bet; minesMineCount = mines; minesGemsFound = 0;
  minesActive = true; minesCurrentMult = 1.0;
  currentUser.coins -= bet; updateWalletDisplay();

  minesBoard = Array(25).fill('gem');
  const minePositions = shuffleArray([...Array(25).keys()]).slice(0, mines);
  minePositions.forEach(i => { minesBoard[i] = 'mine'; });

  buildMinesGrid();
  document.querySelectorAll('.mine-cell').forEach(c => c.classList.remove('disabled'));
  document.getElementById('mines-start-btn').style.display = 'none';
  document.getElementById('mines-cashout-btn').style.display = 'block';
  document.getElementById('mines-status').textContent = '¡Encuentra las gemas!';
  document.getElementById('mines-gem-count').textContent = 'Gemas encontradas: 0';
  updateMinesMultiplier();
}

function minesReveal(index) {
  if (!minesActive) return;
  const cell = document.getElementById(`mine-${index}`);
  if (!cell || cell.classList.contains('safe') || cell.classList.contains('mine')) return;

  if (minesBoard[index] === 'mine') {
    cell.classList.add('mine'); cell.innerHTML = '💣';
    minesBoard.forEach((v, i) => {
      if (v === 'mine') { document.getElementById(`mine-${i}`).classList.add('mine'); document.getElementById(`mine-${i}`).innerHTML = '💣'; }
    });
    minesActive = false;
    document.getElementById('mines-start-btn').style.display = 'block';
    document.getElementById('mines-cashout-btn').style.display = 'none';
    document.getElementById('mines-status').textContent = '💥 ¡Mine! Perdiste.';
    document.querySelectorAll('.mine-cell').forEach(c => c.classList.add('disabled'));
    showToast(`💣 Mine! Perdiste ${minesBetAmount} 🪙`, 'error');
    api('POST', '/api/mines/result', { bet: minesBetAmount, won: false, gems: minesGemsFound }).catch(() => {});
  } else {
    minesGemsFound++;
    cell.classList.add('safe'); cell.innerHTML = '💎';
    updateMinesMultiplier();
    document.getElementById('mines-gem-count').textContent = `Gemas encontradas: ${minesGemsFound}`;
    document.getElementById('mines-cashout-val').textContent = `(${Math.floor(minesBetAmount * minesCurrentMult)} 🪙)`;
    const totalGems = 25 - minesMineCount;
    if (minesGemsFound >= totalGems) { minesCashout(); }
  }
}

function updateMinesMultiplier() {
  if (minesGemsFound === 0) { minesCurrentMult = 1.0; }
  else {
    let mult = 1.0;
    for (let i = 0; i < minesGemsFound; i++) {
      const remaining = 25 - i;
      const safeRemaining = remaining - minesMineCount;
      mult *= (remaining / safeRemaining) * 0.97;
    }
    minesCurrentMult = Math.round(mult * 100) / 100;
  }
  document.getElementById('mines-mult').textContent = minesCurrentMult.toFixed(2) + 'x';
  document.getElementById('mines-cashout-val').textContent = `(${Math.floor(minesBetAmount * minesCurrentMult)} 🪙)`;
}

function minesCashout() {
  if (!minesActive) return;
  minesActive = false;
  const winAmount = Math.floor(minesBetAmount * minesCurrentMult);
  currentUser.coins += winAmount; updateWalletDisplay();
  document.getElementById('mines-start-btn').style.display = 'block';
  document.getElementById('mines-cashout-btn').style.display = 'none';
  document.getElementById('mines-status').textContent = `✅ Retiraste ${winAmount} 🪙`;
  document.querySelectorAll('.mine-cell').forEach(c => c.classList.add('disabled'));
  showToast(`💎 +${winAmount} 🪙 (${minesCurrentMult.toFixed(2)}x)`, 'success');
  playSound('coins');
  api('POST', '/api/mines/result', { bet: minesBetAmount, won: true, gems: minesGemsFound, mult: minesCurrentMult }).catch(() => {});
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Admin ──────────────────────────────────────────────────────
async function loadAdmin() {
  if (!currentUser?.isAdmin) return;
  try { adminUsers = await api('GET', '/api/admin/users'); renderAdminUsers(adminUsers); } catch {}
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = users.map(u => `
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
  ['users','reports'].forEach(t => { document.getElementById(`admin-tab-${t}`).style.display = t===tab?'block':'none'; });
  document.querySelectorAll('#admin-tabs .tab-pill').forEach((el, i) => {
    el.classList.toggle('active', (i===0&&tab==='users')||(i===1&&tab==='reports'));
  });
}

// ── Support ────────────────────────────────────────────────────
async function doSendSupport() {
  const msg = document.getElementById('support-msg').value.trim();
  const errEl = document.getElementById('support-err');
  if (!msg) { showErr(errEl, 'Escribe tu mensaje'); return; }
  showToast('Mensaje enviado. Te responderemos pronto.', 'success');
  closeModal('modal-support');
  document.getElementById('support-msg').value = '';
}

// ── Misc ───────────────────────────────────────────────────────
function copyText(id) {
  const el = document.getElementById(id);
  if (el) { navigator.clipboard.writeText(el.textContent); showToast('Copiado', 'success'); }
}
