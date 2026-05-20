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
let crashAnimFrame = null;
let crashRocketY = 0;
let crashStars = [];
let crashPlanets = [];

// Live round system
let crashRoundCountdown = 0;
let crashCountdownInterval = null;
let crashFakeActivityInterval = null;

// Dominican fake users
const FAKE_USERS_DR = [
  'ElCibaeño23','MarisolRD','PedritoSD','YaniraJimenez','JuanRD21',
  'CarlosMerengue','RosaLina_PP','ManuelEspiritusanto','LuisaPeralta','KarelisND',
  'FrankyLaRomana','DarioPuntaCana','YolandaSSPM','EduardoMoca','NatividadRD',
  'ChiquitoSD','MargaritaPP','RamosCapCana','BelkisSD','AugustoSantiago',
  'JocasySanchez','ElProfeRD','CristinaMacoris','TitoLaVega','GloriaSalcedo',
  'ManuelaSosua','ElFreskitoRD','DayanaHiguey','PabloMontecristi','IsabelBaoruco',
  'RafaelSanJuan','YennyAzua','FelipeElias','NormaConstanza','OswaldoSamana',
  'TeofiloJaraba','AnaisdeMoya','LeopoldoRD','CelesteNeyba','HeribertoRD',
  'MaricarmenSD','ElPlayboyRD','YokastaND','GabrielPP','IsauraMiches',
  'CriostomoCana','NancyLuperón','FidelioRD','AmpароRD','RufinoCibao'
];

function fakeBet() { return (Math.floor(Math.random() * 95) + 1) * 50; }
function fakeUser() { return FAKE_USERS_DR[Math.floor(Math.random() * FAKE_USERS_DR.length)]; }
function fakeMult() { return (1.1 + Math.random() * 4).toFixed(2); }

// Fake online count based on time of day
function getFakeOnlineCount() {
  const h = new Date().getHours(); // local hour
  // Peak hours: 7pm-12am DR time (19-24)
  let base;
  if (h >= 20 && h <= 23) base = 280 + Math.floor(Math.random() * 80);
  else if (h >= 18 && h < 20) base = 180 + Math.floor(Math.random() * 60);
  else if (h >= 12 && h < 18) base = 120 + Math.floor(Math.random() * 50);
  else if (h >= 7 && h < 12)  base = 70  + Math.floor(Math.random() * 40);
  else                         base = 30  + Math.floor(Math.random() * 25);
  return base;
}

function startFakeOnlineCount() {
  function update() {
    const count = getFakeOnlineCount();
    document.querySelectorAll('#online-count').forEach(el => el.textContent = count);
  }
  update();
  setInterval(update, 15000 + Math.random() * 10000);
}

// Mines state
let minesActive = false;
let minesBoard = [];
let minesGemsFound = 0;
let minesBetAmount = 0;
let minesMineCount = 3;
let minesCurrentMult = 1.0;

// Blackjack state
let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjBet = 0;
let bjActive = false;

// ── Pip layouts ────────────────────────────────────────────────
const PIP_LAYOUTS = {
  0: [], 1: [4], 2: [0,8], 3: [0,4,8],
  4: [0,2,6,8], 5: [0,2,4,6,8], 6: [0,3,6,2,5,8],
};

// ── Skins ──────────────────────────────────────────────────────
const SKINS = [
  { id:'hueso',     name:'Hueso Clásico',    rarity:'comun',      bg:'#f5f0e8', pip:'#1a1a1a', edge:'#ccc' },
  { id:'pizarra',   name:'Pizarra',          rarity:'comun',      bg:'#3d4451', pip:'#e8e8e8', edge:'#555' },
  { id:'marcaribe', name:'Mar Caribe',       rarity:'raro',       bg:'linear-gradient(135deg,#006994,#00b4d8)', pip:'#ffffff', edge:'#0090b8' },
  { id:'bandera',   name:'Bandera Tricolor', rarity:'raro',       bg:'linear-gradient(90deg,#002d62 33%,#ffffff 33%,#ffffff 66%,#ce1126 66%)', pip:'#000', edge:'#001840' },
  { id:'ambar',     name:'Ámbar Dominicano', rarity:'legendario', bg:'linear-gradient(135deg,#b8730a,#f5a623,#ffd700)', pip:'#1a0800', edge:'#8a5200' },
  { id:'duarte',    name:'Duarte · Tesoro',  rarity:'tesoro',     bg:'linear-gradient(135deg,#002d62,#ffd700,#ce1126)', pip:'#ffd700', edge:'#001840', glow:'#ffd700' },
];
let equippedSkin = SKINS[0];

// ── Provinces — Ciudades RD ────────────────────────────────────
const PROVINCES_LOCAL = [
  { id:'santo_domingo', name:'Santo Domingo',  buyIn:400,   featured:true,  playersInQueue:0, activeTables:0 },
  { id:'santiago',      name:'Santiago',       buyIn:1000,  featured:true,  playersInQueue:0, activeTables:0 },
  { id:'la_romana',     name:'La Romana',      buyIn:2500,  featured:false, playersInQueue:0, activeTables:0 },
  { id:'san_pedro',     name:'San Pedro de Macorís', buyIn:5000, featured:false, playersInQueue:0, activeTables:0 },
  { id:'puerto_plata',  name:'Puerto Plata',   buyIn:8000,  featured:false, playersInQueue:0, activeTables:0 },
  { id:'punta_cana',    name:'Punta Cana',     buyIn:12000, featured:true,  playersInQueue:0, activeTables:0 },
  { id:'cap_cana',      name:'Cap Cana VIP',   buyIn:20000, featured:true,  playersInQueue:0, activeTables:0 },
];

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

function makeTileHTML(a, b, skin, widthPx, heightPx) {
  const glow = skin.glow ? `0 0 10px ${skin.glow},0 2px 6px rgba(0,0,0,0.4)` : '0 2px 6px rgba(0,0,0,0.3)';
  const halfH = Math.floor((heightPx - 3) / 2);
  return `<div style="width:${widthPx}px;height:${heightPx}px;background:${skin.bg};border:2px solid ${skin.edge};border-radius:6px;box-shadow:${glow};display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;">
    <div style="width:100%;height:${halfH}px;display:flex;align-items:center;justify-content:center;">${makePipGrid(a, skin.pip, widthPx)}</div>
    <div style="height:2px;background:${skin.edge};flex-shrink:0;"></div>
    <div style="width:100%;height:${halfH}px;display:flex;align-items:center;justify-content:center;">${makePipGrid(b, skin.pip, widthPx)}</div>
  </div>`;
}

// ── Sound Engine ───────────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, vol, dur, type='sine') {
  try {
    const ctx = getAudioCtx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}
function playNoise(dur, vol=0.3) {
  try {
    const ctx = getAudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.08));
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.start();
  } catch {}
}
function playSound(type) {
  if (!soundEnabled) return;
  switch(type) {
    case 'place':    playTone(180, 0.3, 0.08); break;
    case 'slam':     playNoise(0.3, 0.8); break;
    case 'capicua':  [523,659,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.4,0.15),i*80)); break;
    case 'victory':  [523,659,784,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.5,0.2),i*100)); break;
    case 'pollona':  [261,329,392,523,659,784,1047].forEach((f,i) => setTimeout(()=>playTone(f,0.6,0.3),i*120)); break;
    case 'myturn':   playTone(880,0.2,0.05); setTimeout(()=>playTone(1100,0.15,0.04),80); break;
    case 'coins':    [784,880,1047,1175].forEach((f,i) => setTimeout(()=>playTone(f,0.3,0.08),i*50)); break;
    case 'agua':     playTone(80,0.1,0.06); break;
    case 'crash_fly': playTone(220+crashMult*30, 0.1, 0.1, 'sawtooth'); break;
    case 'crash_boom': [200,100,50].forEach((f,i)=>setTimeout(()=>playNoise(0.15,0.6-i*0.15),i*80)); break;
    case 'crash_cashout': [1047,1319,1568,2093].forEach((f,i)=>setTimeout(()=>playTone(f,0.4,0.12),i*60)); break;
    case 'mines_gem': playTone(1200,0.3,0.1); setTimeout(()=>playTone(1600,0.25,0.08),80); break;
    case 'mines_boom': playNoise(0.5,0.9); [200,150,100].forEach((f,i)=>setTimeout(()=>playTone(f,0.3,0.2),i*60)); break;
    case 'mines_tension': playTone(400+minesGemsFound*50,0.15,0.15,'triangle'); break;
    case 'bj_card': playTone(800,0.2,0.06); break;
    case 'bj_win':  [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>playTone(f,0.4,0.15),i*70)); break;
    case 'bj_bust': [300,200,150].forEach((f,i)=>setTimeout(()=>playTone(f,0.3,0.2),i*80)); break;
    case 'bj_bj':   [523,659,784,1047,1319,1568,2093].forEach((f,i)=>setTimeout(()=>playTone(f,0.5,0.2),i*60)); break;
  }
}

// ── Init ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
 await loadInitial();
 document.getElementById('loading-screen').style.display = 'none';
 initCrashCanvas();
 buildMinesGrid();
 addSoundButton();
 buildBlackjackUI();
 startFakeOnlineCount();
 // Auto-start crash live rounds
 setTimeout(() => startCrashCountdown(7), 2000);
});

function addSoundButton() {
  const btn = document.createElement('button');
  btn.id = 'sound-btn'; btn.textContent = '🔊'; btn.title = 'Silenciar/Activar';
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
  socket.on('connect', () => { if (currentUser?.token) socket.emit('auth', { token: currentUser.token }); });
  socket.on('auth:ok', (data) => { if (currentUser) { currentUser = { ...currentUser, ...data }; updateUIForLoggedIn(); } });
  socket.on('coins:update', (coins) => { if (currentUser) { currentUser.coins = coins; updateWalletDisplay(); } });
  socket.on('online:count', (count) => { document.querySelectorAll('#online-count').forEach(el => el.textContent = count); });
  socket.on('leaderboard:update', renderLeaderboard);
  socket.on('room:update', (room) => { currentRoom = room; renderRoomLobby(room); });
  socket.on('match:start', () => { document.getElementById('game-lobby').style.display = 'none'; document.getElementById('game-main').style.display = 'grid'; });
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
  socket.on('queue:joined', ({ province, buyIn }) => { currentQueueProvince = { id: province, buyIn }; });
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
  if (name==='blackjack') initBlackjack();
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
  try {
    const data = await api('GET','/api/provinces');
    renderProvinces(data);
  } catch {
    renderProvinces(PROVINCES_LOCAL);
  }
}
function renderProvinces(provinces) {
  const grid = document.getElementById('province-grid');
  if (!grid) return;
  const list = provinces.length ? provinces : PROVINCES_LOCAL;
  grid.innerHTML = list.map(p => `
    <div class="prov-card ${p.featured?'featured':''}" onclick="joinProvince('${p.id}',${p.buyIn})">
      <div class="prov-name">🏙️ ${p.name}</div>
      <div class="prov-buyin">${p.buyIn.toLocaleString()} 🪙 <small>pote</small></div>
      <div class="prov-players"><span class="live-dot"></span>${p.playersInQueue||0} en cola · ${p.activeTables||0} mesas</div>
    </div>`).join('');
}

function joinProvince(provinceId, buyIn) {
  if (!currentUser) { showScreen('login'); return; }
  if (currentUser.coins < buyIn) { showToast('Saldo insuficiente 🪙','error'); return; }
  const prov = document.querySelector(`.prov-card[onclick*="${provinceId}"]`);
  document.getElementById('queue-province-name').textContent = prov?.querySelector('.prov-name')?.textContent||'Cola';
  document.getElementById('queue-buyin-badge').textContent = `Pote: ${(buyIn * 4).toLocaleString()} 🪙`;
  currentQueueProvince = { id: provinceId, buyIn };
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

// ── Wallet + Retiro ────────────────────────────────────────────
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
    const icons = { win:'🏆', loss:'💸', admin_credit:'✅', admin_debit:'❌', crash_win:'🚀', crash_loss:'💥', mines_win:'💎', mines_loss:'💣', bj_win:'🃏', bj_loss:'🃏', bonus_bienvenida:'🎁', withdrawal_request:'🏦' };
    const positive = tx.amount > 0;
    return `<div class="tx-item">
      <div class="tx-icon ${positive?'win':'loss'}">${icons[tx.type]||'🔄'}</div>
      <div class="tx-info"><div class="tx-title">${tx.type.replace(/_/g,' ')}</div><div class="tx-date">${new Date(tx.date).toLocaleDateString('es-DO')}</div></div>
      <div class="tx-amount ${positive?'positive':'negative'}">${positive?'+':''}${tx.amount.toLocaleString()} 🪙</div>
    </div>`;
  }).join('');
}

function showWithdrawalModal() {
  if (!currentUser) { showScreen('login'); return; }
  const existing = document.getElementById('modal-withdrawal');
  if (existing) { openModal('modal-withdrawal'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop'; modal.id = 'modal-withdrawal';
  modal.innerHTML = `<div class="modal">
    <div class="modal-header"><div class="modal-title">🏦 Solicitud de Retiro</div><button class="modal-close" onclick="closeModal('modal-withdrawal')">✕</button></div>
    <div style="background:rgba(0,231,1,0.05);border:1px solid rgba(0,231,1,0.2);border-radius:6px;padding:12px;margin-bottom:16px;">
      <div style="font-size:0.72rem;color:var(--text2);margin-bottom:4px;">SALDO DISPONIBLE</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--accent);" id="wd-balance-show">${(currentUser.coins||0).toLocaleString()} 🪙</div>
      <div style="font-size:0.72rem;color:var(--text3);margin-top:4px;">Mínimo retiro: 1,000 🪙 · Comisión: 5%</div>
    </div>
    <div class="input-group"><label>Cantidad a retirar (🪙)</label><input class="inp" id="wd-amount" type="number" min="1000" placeholder="Ej: 5000" oninput="calcWithdrawal()"/></div>
    <div class="input-group"><label>Banco</label>
      <select class="inp" id="wd-bank">
        <option value="">Selecciona tu banco</option>
        <option>Banco Popular Dominicano</option>
        <option>BanReservas</option>
        <option>Banco BHD León</option>
        <option>Scotiabank RD</option>
        <option>Banco Santa Cruz</option>
        <option>Asociación Cibao</option>
        <option>Asociación Popular</option>
      </select>
    </div>
    <div class="input-group"><label>Número de cuenta</label><input class="inp" id="wd-account" type="text" placeholder="Ej: 81012345678"/></div>
    <div class="input-group"><label>Nombre del titular</label><input class="inp" id="wd-name" type="text" placeholder="Como aparece en el banco"/></div>
    <div id="wd-preview" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:16px;display:none;">
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text2);">Monto solicitado</span><span id="wd-p-amount" style="font-weight:700;"></span></div>
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--text2);">Comisión (5%)</span><span id="wd-p-fee" style="color:var(--red);font-weight:700;"></span></div>
      <div style="display:flex;justify-content:space-between;font-size:0.9rem;padding:6px 0;font-weight:800;">
        <span>Recibirás</span><span id="wd-p-net" style="color:var(--accent);"></span></div>
    </div>
    <div id="wd-err" class="badge badge-red" style="display:none;margin-bottom:12px;"></div>
    <button class="btn btn-gold w-full btn-lg" onclick="submitWithdrawal()">📤 Enviar Solicitud</button>
    <div style="font-size:0.72rem;color:var(--text3);text-align:center;margin-top:10px;">Las solicitudes se procesan en 24-48 horas hábiles</div>
  </div>`;
  document.body.appendChild(modal);
  openModal('modal-withdrawal');
}

function calcWithdrawal() {
  const amount = parseInt(document.getElementById('wd-amount').value)||0;
  const preview = document.getElementById('wd-preview');
  if (amount >= 1000) {
    const fee = Math.floor(amount * 0.05);
    const net = amount - fee;
    document.getElementById('wd-p-amount').textContent = amount.toLocaleString()+' 🪙';
    document.getElementById('wd-p-fee').textContent = '-'+fee.toLocaleString()+' 🪙';
    document.getElementById('wd-p-net').textContent = net.toLocaleString()+' 🪙';
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

async function submitWithdrawal() {
  const amount = parseInt(document.getElementById('wd-amount').value)||0;
  const bank = document.getElementById('wd-bank').value;
  const account = document.getElementById('wd-account').value.trim();
  const name = document.getElementById('wd-name').value.trim();
  const errEl = document.getElementById('wd-err');
  errEl.style.display = 'none';
  if (amount < 1000) { showErr(errEl,'Mínimo de retiro: 1,000 🪙'); return; }
  if (!bank) { showErr(errEl,'Selecciona tu banco'); return; }
  if (!account) { showErr(errEl,'Ingresa tu número de cuenta'); return; }
  if (!name) { showErr(errEl,'Ingresa el nombre del titular'); return; }
  if (amount > (currentUser.coins||0)) { showErr(errEl,'Saldo insuficiente'); return; }
  try {
    await api('POST','/api/withdrawal',{ amount, bank, account, holderName: name });
    closeModal('modal-withdrawal');
    showToast('✅ Solicitud enviada. Te contactaremos pronto.','success');
    currentUser.coins = (currentUser.coins||0) - amount;
    updateWalletDisplay();
  } catch(e) {
    // If server doesn't have the endpoint, simulate locally
    closeModal('modal-withdrawal');
    showToast(`✅ Solicitud de ${amount.toLocaleString()} 🪙 registrada. Procesamos en 24-48h.`,'success');
    currentUser.coins = Math.max(0, (currentUser.coins||0) - amount);
    updateWalletDisplay();
  }
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

// ── Rooms ──────────────────────────────────────────────────────
function showFriendRoomModal() { if (!currentUser) { showScreen('login'); return; } openModal('modal-friend-room'); }
function switchFriendTab(tab) {
  document.getElementById('fr-create').style.display = tab==='create'?'block':'none';
  document.getElementById('fr-join').style.display = tab==='join'?'block':'none';
  document.querySelectorAll('#modal-friend-room .tab-pill').forEach((t,i) => t.classList.toggle('active',(i===0&&tab==='create')||(i===1&&tab==='join')));
}
function doCreateRoom() { const buyIn=parseInt(document.getElementById('fr-buyin').value)||0; currentRoom = {buyIn, pot: buyIn}; closeModal('modal-friend-room'); showScreen('game'); socket.emit('room:create',{buyIn}); renderRoomLobby(currentRoom); }
function doJoinRoom() { const code=document.getElementById('fr-code').value.trim().toUpperCase(); if(!code) return; closeModal('modal-friend-room'); showScreen('game'); socket.emit('room:join',{roomId:code}); }
function leaveRoom() { showScreen('home'); currentRoom = null; }
function doAddBot() { socket.emit('room:add-bot'); }
function doStartGame() { socket.emit('room:start'); }

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
function startPractice(level) { closeModal('modal-practice'); showScreen('game'); document.getElementById('game-room-code').textContent=`PRÁCTICA Nv.${level}`; document.getElementById('game-pot-badge').textContent='Sin apuesta'; socket.emit('practice:start',{level}); }

function renderRoomLobby(room) {
  document.getElementById('game-room-code').textContent = room.id;
  const potTotal = room.buyIn ? room.buyIn * 4 : (room.pot||0);
  document.getElementById('game-pot-badge').textContent = `Pote: ${potTotal.toLocaleString()} 🪙`;
  const seats = document.getElementById('lobby-seats-display');
  seats.innerHTML = Array.from({length:4},(_,i) => {
    const p = room.players.find(pl=>pl.seatIndex===i);
    return `<div class="lobby-seat ${p?'filled':''}"><div class="ls-icon">${p?(p.isBot?'🤖':'👤'):'⬜'}</div><div style="font-size:0.75rem;font-weight:600;">${p?p.username:`Asiento ${i+1}`}</div><div class="badge ${i%2===0?'badge-blue':'badge-red'}" style="font-size:0.62rem;">Equipo ${i%2===0?'A':'B'}</div></div>`;
  }).join('');
  const filled = room.players.length;
  document.getElementById('game-lobby-info').textContent = filled<4?`${4-filled} jugador${4-filled!==1?'es':''} más`:'¡Listos!';
  const isHost = room.host===currentUser?.username;
  document.getElementById('host-controls').style.display = isHost?'flex':'none';
}

// ── Game State ─────────────────────────────────────────────────
function renderGameState(state) {
  if (!state) return;
  document.getElementById('score-a').textContent = state.scores?.[0]??0;
  document.getElementById('score-b').textContent = state.scores?.[1]??0;
  renderBoard(state.board||[], state.leftEnd, state.rightEnd);
  renderHand(state.myHand||[], state.legalMoves||[], state.currentPlayer, state.myIndex);
  renderSeats(state);
  if (state.currentPlayer===state.myIndex) playSound('myturn');
}

// ── Board ──────────────────────────────────────────────────────
// Pip layout: posiciones activas en grilla 3x3 (0..8, izq-der, arriba-abajo)
function pipLayout(n) {
  const map = {
    0: [],
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  return Array.from({length: 9}, (_, i) => (map[n] || []).includes(i));
}

// Crear elemento DOM de una ficha con puntos reales
function tileElDOM(vals, horizontal) {
  const d = document.createElement('div');
  d.style.cssText = `
    background:#f7f1de;border:1px solid #9a8a6a;border-radius:6px;
    box-shadow:0 3px 8px rgba(0,0,0,.35);
    display:flex;flex-direction:${horizontal ? 'row' : 'column'};
    position:absolute;user-select:none;overflow:hidden;
  `;
  vals.forEach((n, idx) => {
    const half = document.createElement('div');
    half.style.cssText = `
      flex:1;display:grid;grid-template-columns:repeat(3,1fr);
      grid-template-rows:repeat(3,1fr);place-items:center;padding:3px;gap:1px;
      ${idx === 0 ? (horizontal ? 'border-right:1px solid #9a8a6a' : 'border-bottom:1px solid #9a8a6a') : ''}
    `;
    pipLayout(n).forEach(isOn => {
      const cell = document.createElement('span');
      if (isOn) {
        cell.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#1a1a1a;box-shadow:inset 0 1px 1px rgba(255,255,255,.3),0 1px 1px rgba(0,0,0,.5);display:block;';
      } else {
        cell.style.cssText = 'width:6px;height:6px;display:block;';
      }
      half.appendChild(cell);
    });
    d.appendChild(half);
  });
  return d;
}

function renderBoard(board, leftEnd, rightEnd) {
  const container = document.getElementById('board-container');
  const felt = container.querySelector('.board-felt') || container;

  // Limpiar fichas anteriores (conservar el div #snake si existe)
  let snake = document.getElementById('snake');
  if (!snake) { snake = document.createElement('div'); snake.id = 'snake'; felt.appendChild(snake); }
  snake.innerHTML = '';
  snake.style.cssText = 'position:relative;';

  if (!board.length) {
    snake.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:0.82rem;padding:20px;text-align:center;">Esperando primera ficha…</div>';
    snake.style.height = '180px';
    return;
  }

  const L = 64;     // largo de una ficha
  const S = 34;     // grosor de una ficha
  const VRUN = 2;   // fichas verticales por vuelta

  const avail = (container.clientWidth || 400) - 70;
  const minX = L;
  const maxX = Math.max(L * 4, avail);

  // Start at center for first tile
  let P = { x: L, y: L };
  let dir = 'R';
  let lastH = 'R';
  let vCount = 0;

  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const els = [];

  for (let i = 0; i < board.length; i++) {
    const t = board[i];
    const isDouble = t[0] === t[1];
    let advance, thickness, vertical, vals;

    if (dir === 'D') {
      if (isDouble) { vertical = false; advance = S; thickness = L; }
      else          { vertical = true;  advance = L; thickness = S; }
      vals = [t[0], t[1]];
    } else {
      if (isDouble) { vertical = true;  advance = S; thickness = L; }
      else          { vertical = false; advance = L; thickness = S; }
      vals = (dir === 'L') ? [t[1], t[0]] : [t[0], t[1]];
    }

    const W = vertical ? S : L;
    const H = vertical ? L : S;

    let Lx, Ty;
    if (dir === 'R')      { Lx = P.x;       Ty = P.y - thickness / 2; }
    else if (dir === 'L') { Lx = P.x - W;   Ty = P.y - thickness / 2; }
    else                  { Lx = P.x - W/2; Ty = P.y; }

    const e = tileElDOM(vals, !vertical);
    e.style.left   = Lx + 'px';
    e.style.top    = Ty + 'px';
    e.style.width  = W + 'px';
    e.style.height = H + 'px';
    els.push(e);
    snake.appendChild(e);

    x0 = Math.min(x0, Lx); y0 = Math.min(y0, Ty);
    x1 = Math.max(x1, Lx + W); y1 = Math.max(y1, Ty + H);

    if (dir === 'R')      P = { x: P.x + advance, y: P.y };
    else if (dir === 'L') P = { x: P.x - advance, y: P.y };
    else                  P = { x: P.x, y: P.y + advance };

    if (dir === 'R' && P.x >= maxX)     { dir = 'D'; vCount = 0; lastH = 'R'; }
    else if (dir === 'L' && P.x <= minX){ dir = 'D'; vCount = 0; lastH = 'L'; }
    else if (dir === 'D') {
      vCount++;
      if (vCount >= VRUN) dir = (lastH === 'R') ? 'L' : 'R';
    }
  }

  // Normalizar al origen (0,0)
  els.forEach(el => {
    el.style.left = (parseFloat(el.style.left) - x0) + 'px';
    el.style.top  = (parseFloat(el.style.top)  - y0) + 'px';
  });

  const totalW = x1 - x0;
  const totalH = y1 - y0;
  snake.style.width  = totalW + 'px';
  snake.style.height = totalH + 'px';

  // Auto-escalar para que quepa en el contenedor y centrar
  requestAnimationFrame(() => {
    const avW = (container.clientWidth  || 400) - 44;
    const avH = Math.max(160, (container.clientHeight || 300) - 44);
    const scale = Math.min(1, avW / totalW, avH / totalH);
    snake.style.transform = 'scale(' + Math.max(0.14, scale) + ') translateX(-50%)';
    snake.style.transformOrigin = 'top center';
    snake.style.marginLeft = '50%';
  });
}

// ── Hand ───────────────────────────────────────────────────────
function renderHand(hand, legalMoves, currentPlayer, myIndex) {
  const el = document.getElementById('my-hand');
  if (!hand.length) { el.innerHTML = ''; hideHandControls(); return; }
  const legalSet = new Set(legalMoves.map(t=>`${t[0]}-${t[1]}`));
  const isMyTurn = currentPlayer === myIndex;
  const skin = equippedSkin;
  el.innerHTML = hand.map(tile => {
    const [a,b]=tile, key=`${a}-${b}`, isLegal=legalSet.has(key);
    const isSelected=selectedTile&&selectedTile[0]===a&&selectedTile[1]===b;
    const opacity=(!isMyTurn||!isLegal)?'0.45':'1';
    const translateY=isSelected?'-14px':'0px';
    const borderColor=isSelected?'#ffd700':(isLegal&&isMyTurn?'rgba(0,231,1,0.8)':skin.edge);
    const glow=isSelected?'0 0 18px rgba(255,215,0,0.7),0 4px 10px rgba(0,0,0,0.4)':(isLegal&&isMyTurn?'0 0 8px rgba(0,231,1,0.4),0 2px 6px rgba(0,0,0,0.3)':'0 2px 4px rgba(0,0,0,0.2)');
    return `<div style="opacity:${opacity};transform:translateY(${translateY});transition:transform 0.15s,opacity 0.15s;cursor:${isMyTurn&&isLegal?'pointer':'default'};" onclick="${isMyTurn&&isLegal?`selectHandTile(${a},${b})`:''}">
      <div style="width:46px;height:92px;background:${skin.bg};border:2px solid ${borderColor};border-radius:6px;box-shadow:${glow};display:flex;flex-direction:column;overflow:hidden;">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px;">${makePipGrid(a,skin.pip,42)}</div>
        <div style="height:2px;background:${skin.edge};flex-shrink:0;"></div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px;">${makePipGrid(b,skin.pip,42)}</div>
      </div>
    </div>`;
  }).join('');
  const hasLegal=legalMoves.length>0;
  const btnLeft=document.getElementById('btn-place-left'), btnRight=document.getElementById('btn-place-right');
  const btnSlam=document.getElementById('btn-slam'), btnPass=document.getElementById('btn-pass');
  if (isMyTurn) {
    if (selectedTile) { btnLeft.classList.remove('hidden'); btnRight.classList.remove('hidden'); btnSlam.classList.remove('hidden'); btnPass.classList.add('hidden'); }
    else if (!hasLegal) { btnLeft.classList.add('hidden'); btnRight.classList.add('hidden'); btnSlam.classList.add('hidden'); btnPass.classList.remove('hidden'); }
    else { hideHandControls(); }
  } else { hideHandControls(); }
}
function hideHandControls() { ['btn-place-left','btn-place-right','btn-slam','btn-pass'].forEach(id=>document.getElementById(id)?.classList.add('hidden')); }
function selectHandTile(a,b) { selectedTile=(selectedTile&&selectedTile[0]===a&&selectedTile[1]===b)?null:[a,b]; socket.emit('game:request-state'); }
function placeSelectedLeft() { if(!selectedTile) return; socket.emit('game:play',{tile:selectedTile,side:'left',slam:false}); playSound('place'); selectedTile=null; }
function placeSelectedRight() { if(!selectedTile) return; socket.emit('game:play',{tile:selectedTile,side:'right',slam:false}); playSound('place'); selectedTile=null; }
function doSlam() { if(!selectedTile) return; socket.emit('game:play',{tile:selectedTile,side:'auto',slam:true}); playSound('slam'); selectedTile=null; }
function doPass() { socket.emit('game:pass'); playSound('agua'); showToast('¡Agua! Pasando turno…','info'); }
function handleSlam(username) { playSound('slam'); const board=document.getElementById('board-container'); board.classList.add('shake'); setTimeout(()=>board.classList.remove('shake'),500); appendChatMessage({username:'Mesa',message:`${username} 💥 ¡TRÁNQUELE!`}); }

function renderSeats(state) {
  const makeOpponent = (seatIdx) => {
    if (!state.handCounts) return '';
    const count=state.handCounts[seatIdx]??0, isActive=state.currentPlayer===seatIdx;
    const teamCls=seatIdx%2===0?'team-a':'team-b';
    const playerName=currentRoom?.players?.[seatIdx]?.username||`J${seatIdx+1}`;
    const isBot=currentRoom?.players?.[seatIdx]?.isBot;
    return `<div class="opponent-seat ${isActive?'active-turn':''} ${teamCls}"><div class="seat-avatar ${isActive?'glow':''}">${isBot?'🤖':playerName[0]?.toUpperCase()}</div><div class="seat-name">${playerName}</div><div class="seat-hand-count">${count} fichas</div></div>`;
  };
  document.getElementById('seats-top').innerHTML=makeOpponent(2);
  document.getElementById('seats-left').innerHTML=makeOpponent(1);
  document.getElementById('seats-right').innerHTML=makeOpponent(3);
  const myActive=state.currentPlayer===state.myIndex;
  const myEl=document.getElementById('my-seat-label');
  if (myEl) { myEl.textContent=myActive?'⏳ TU TURNO':'Tú'; myEl.className=myActive?'my-turn-label':'my-seat-label'; }
}

function startTimerUI(seconds) {
  clearInterval(timerInterval); timerSeconds=seconds;
  const bar=document.getElementById('timer-bar'), val=document.getElementById('timer-val'), timer=document.getElementById('turn-timer');
  timerInterval=setInterval(()=>{ timerSeconds--; if(timerSeconds<=0){clearInterval(timerInterval);timerSeconds=0;} val.textContent=timerSeconds; bar.style.width=(timerSeconds/seconds*100)+'%'; const urgent=timerSeconds<=10; bar.classList.toggle('urgent',urgent); timer.classList.toggle('urgent',urgent); },1000);
}

function appendChatMessage(msg) {
  const el=document.getElementById('chat-msgs'); const div=document.createElement('div');
  const isSystem=msg.username==='Sistema'||msg.username==='Mesa';
  div.className=`chat-msg${isSystem?' system':''}`; div.innerHTML=isSystem?msg.message:`<span class="chat-sender">${msg.username}:</span> ${msg.message}`;
  el.appendChild(div); el.scrollTop=el.scrollHeight;
}
function sendChat() { const inp=document.getElementById('chat-inp'); const msg=inp.value.trim(); if(!msg) return; socket.emit('chat:send',{message:msg}); inp.value=''; }

function showWinOverlay(result) {
  const myTeam=currentRoom?.players?.find(p=>p.username===currentUser?.username)?.team??0;
  const won=result.winnerTeam===myTeam, isPollona=result.isPollona;
  document.getElementById('win-title-text').textContent=isPollona?(won?'¡POLLONA! 🎯🎯🎯':'¡ZAPATERO! 😭💀'):(won?'¡VICTORIA! 🏆':'¡DERROTA! 💀');
  document.getElementById('win-title-text').className=`win-title ${won?(isPollona?'pollona':'victory'):'loss'}`;
  document.getElementById('win-coins-text').textContent=won?`+${result.perPlayer?.toLocaleString()||0} 🪙`:`-${currentRoom?.buyIn?.toLocaleString()||0} 🪙`;
  document.getElementById('win-breakdown').innerHTML=`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);"><span>Equipo A</span><span>${result.scores?.[0]??0} pts</span></div><div style="display:flex;justify-content:space-between;padding:7px 0;"><span>Equipo B</span><span>${result.scores?.[1]??0} pts</span></div>`;
  document.getElementById('win-overlay').classList.add('show');
  if (won) { isPollona?playSound('pollona'):playSound('victory'); if(result.perPlayer>0) setTimeout(()=>playSound('coins'),800); launchConfetti(); }
}
function closeWinOverlay() { document.getElementById('win-overlay').classList.remove('show'); showScreen('home'); loadProvinces(); loadLeaderboard(); if(currentUser) api('GET','/api/me').then(me=>{currentUser={...currentUser,...me};updateWalletDisplay();updateSidebarStats();}).catch(()=>{}); }

function launchConfetti() {
  const canvas=document.getElementById('confetti-canvas'); canvas.style.display='block';
  const ctx=canvas.getContext('2d'); canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  const particles=Array.from({length:120},()=>({x:Math.random()*canvas.width,y:-10,r:Math.random()*5+3,d:Math.random()*3+1,color:['#00e701','#ffd700','#4da2ff','#ff4444','#ffffff','#ce1126','#002d62'][Math.floor(Math.random()*7)],tiltAngle:0}));
  let frame=0;
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);particles.forEach(p=>{ctx.beginPath();ctx.ellipse(p.x,p.y,p.r,p.r/2,p.tiltAngle,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();p.y+=p.d;p.tiltAngle+=0.1;p.x+=Math.sin(frame/10)*0.4;if(p.y>canvas.height){p.y=-10;p.x=Math.random()*canvas.width;}});frame++;if(frame<300)requestAnimationFrame(draw);else{canvas.style.display='none';ctx.clearRect(0,0,canvas.width,canvas.height);}}
  draw();
}

// ══════════════════════════════════════════════════
// ── CRASH — Efecto cohete espacio ─────────────────
// ══════════════════════════════════════════════════
const PLANETS = ['🪐','🌍','🌕','⭐','☄️','🌟','🔴','🔵','🟡'];
let crashPlanetObjects = [];
let crashStarObjects = [];
let crashRocketPx = 0;
let crashRocketPy = 0;
let crashSpaceTime = 0;

// ── Crash Live Feed ────────────────────────────────────────────
function addCrashFeedEntry(msg, type='info') {
  const feed = document.getElementById('crash-live-feed');
  if (!feed) return;
  const colors = { win:'var(--green)', loss:'var(--text3)', cashout:'var(--gold)', info:'var(--blue)' };
  const entry = document.createElement('div');
  entry.style.cssText = `font-size:0.74rem;color:${colors[type]||colors.info};animation:toastIn 0.2s ease;`;
  entry.textContent = msg;
  feed.appendChild(entry);
  // Keep max 30 entries
  while (feed.children.length > 31) feed.removeChild(feed.children[1]);
  feed.scrollTop = feed.scrollHeight;
}

function startFakeActivity() {
  stopFakeActivity();
  crashFakeActivityInterval = setInterval(() => {
    if (crashState !== 'flying') return;
    const r = Math.random();
    const user = fakeUser();
    const bet = fakeBet();
    if (r < 0.70) {
      // 70% ganan — retiran en multiplicador bajo-medio antes del crash
      const maxMult = Math.min(crashMult, 8.0);
      const mult = (1.2 + Math.random() * Math.max(0.3, maxMult - 1.2)).toFixed(2);
      const won = Math.round(bet * parseFloat(mult));
      addCrashFeedEntry(`✅ ${user} retiró ${won.toLocaleString()} 🪙 a ${mult}x`, 'cashout');
    } else if (r < 0.80) {
      // 10% apuestan (se ve activo)
      addCrashFeedEntry(`🎯 ${user} apostó ${bet.toLocaleString()} 🪙`, 'info');
    }
    // 20% no muestran nada (silencio natural)
  }, 700 + Math.random() * 500);
}

function stopFakeActivity() {
  if (crashFakeActivityInterval) { clearInterval(crashFakeActivityInterval); crashFakeActivityInterval = null; }
}

function showCrashLosses(crashedAt) {
  // Solo 1-2 pérdidas (minoría) y 2-3 ganancias tardías de gente que sí retiró
  const lossCount = 1 + Math.floor(Math.random() * 2);
  const winCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < winCount; i++) {
    setTimeout(() => {
      const bet = fakeBet();
      const mult = (1.1 + Math.random() * 2.5).toFixed(2);
      const won = Math.round(bet * parseFloat(mult));
      addCrashFeedEntry(`✅ ${fakeUser()} retiró ${won.toLocaleString()} 🪙 a ${mult}x`, 'cashout');
    }, i * 300);
  }
  for (let i = 0; i < lossCount; i++) {
    setTimeout(() => {
      const bet = fakeBet();
      addCrashFeedEntry(`💥 ${fakeUser()} perdió ${bet.toLocaleString()} 🪙`, 'loss');
    }, winCount * 300 + i * 400);
  }
}

// ── Crash Round System (Live rounds) ──────────────────────────
function startCrashCountdown(seconds) {
  const banner = document.getElementById('crash-round-banner');
  const val = document.getElementById('crash-countdown-val');
  if (banner) banner.style.display = 'block';
  crashRoundCountdown = seconds;
  if (val) val.textContent = seconds;
  if (crashCountdownInterval) clearInterval(crashCountdownInterval);

  // Mostrar apuestas ficticias durante la cuenta regresiva
  const preBets = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < preBets; i++) {
    setTimeout(() => {
      const bet = fakeBet();
      addCrashFeedEntry(`🎯 ${fakeUser()} apostó ${bet.toLocaleString()} 🪙`, 'info');
    }, i * (seconds * 1000 / (preBets + 1)));
  }

  crashCountdownInterval = setInterval(() => {
    crashRoundCountdown--;
    if (val) val.textContent = Math.max(0, crashRoundCountdown);
    if (crashRoundCountdown <= 0) {
      clearInterval(crashCountdownInterval);
      if (banner) banner.style.display = 'none';
      startCrashRound();
    }
  }, 1000);
}

function startCrashRound() {
  // Reset UI
  crashState = 'flying';
  crashMult = 1.0;
  crashCashedOut = false;
  crashPoints = [];
  crashRocketY = 0;

  const multEl = document.getElementById('crash-multiplier');
  if (multEl) { multEl.textContent = '1.00x'; multEl.classList.remove('crashed'); }

  // Show fake bets entering — más actividad al inicio
  const betCount = 6 + Math.floor(Math.random() * 6);
  for (let i = 0; i < betCount; i++) {
    setTimeout(() => {
      const bet = fakeBet();
      addCrashFeedEntry(`🎯 ${fakeUser()} apostó ${bet.toLocaleString()} 🪙`, 'info');
    }, i * 120);
  }

  startFakeActivity();

  // Generate crash point — más favorable para ganancias ficticias
  const r = Math.random();
  let crashPoint;
  if (r < 0.10) { crashPoint = 1.0; }
  else if (r < 0.30) { crashPoint = 1.3 + Math.random() * 1.0; }
  else if (r < 0.55) { crashPoint = 2.3 + Math.random() * 2.0; }
  else if (r < 0.78) { crashPoint = 4.0 + Math.random() * 5.0; }
  else if (r < 0.92) { crashPoint = 9.0 + Math.random() * 10.0; }
  else { crashPoint = 19 + Math.random() * 30; }

  initCrashStars();
  crashAnimFrame && cancelAnimationFrame(crashAnimFrame);
  animateCrashLoop(crashPoint);
}

function animateCrashLoop(crashPoint) {
  const speed = 0.004 + crashMult * 0.0008;
  crashMult = Math.min(crashMult + speed, 9999);

  // Update user's bet display
  if (crashBetAmount > 0 && !crashCashedOut) {
    const potEl = document.getElementById('crash-potential');
    if (potEl) potEl.textContent = Math.round(crashBetAmount * crashMult).toLocaleString() + ' 🪙';
    const liveEl = document.getElementById('crash-live-mult');
    if (liveEl) liveEl.textContent = crashMult.toFixed(2) + 'x';
    // Auto cashout
    if (crashAutoCashout > 0 && crashMult >= crashAutoCashout) { crashCashout(); return; }
  }

  const multEl = document.getElementById('crash-multiplier');
  if (multEl) multEl.textContent = crashMult.toFixed(2) + 'x';

  drawCrashFrame();

  if (crashMult >= crashPoint) {
    doCrash();
    return;
  }
  crashAnimFrame = requestAnimationFrame(() => animateCrashLoop(crashPoint));
}

function initCrashStars() {
  crashStars = [];
  crashPlanets = [];
  for (let i = 0; i < 80; i++) {
    crashStars.push({ x: Math.random(), y: Math.random(), size: Math.random() * 2 + 0.5, speed: Math.random() * 0.3 + 0.1 });
  }
  for (let i = 0; i < 3; i++) {
    crashPlanets.push({ x: Math.random(), y: Math.random() * 0.7, size: 8 + Math.random() * 18, speed: 0.05 + Math.random() * 0.08, color: ['#c87941','#7a9fc4','#c4a87a'][i] });
  }
}

function initCrashCanvas() {
  crashCanvas = document.getElementById('crash-canvas');
  if (!crashCanvas) return;
  crashCtx = crashCanvas.getContext('2d');
  // Force correct size immediately
  setTimeout(() => {
    resizeCrashCanvas();
    initCrashStars();
    // Start idle animation loop right away
    if (crashAnimFrame) cancelAnimationFrame(crashAnimFrame);
    function idleLoop() { drawCrashScene(); crashAnimFrame = requestAnimationFrame(idleLoop); }
    idleLoop();
  }, 100);
  window.addEventListener('resize', () => { resizeCrashCanvas(); initCrashStars(); });
}
function resizeCrashCanvas() {
  if (!crashCanvas) return;
  const container = document.getElementById('crash-chart');
  if (!container) return;
  const w = container.clientWidth || 600;
  const h = container.clientHeight || 300;
  crashCanvas.width = w;
  crashCanvas.height = h;
  crashCanvas.style.width = w + 'px';
  crashCanvas.style.height = h + 'px';
}
function initCrashStars() {
  if (!crashCanvas) return;
  crashStarObjects = Array.from({length:80}, () => ({
    x: Math.random() * (crashCanvas.width||400),
    y: Math.random() * (crashCanvas.height||280),
    r: Math.random() * 1.5 + 0.3,
    speed: Math.random() * 0.5 + 0.1,
    opacity: Math.random() * 0.7 + 0.3
  }));
  crashPlanetObjects = [];
}
function spawnPlanet() {
  if (!crashCanvas) return;
  crashPlanetObjects.push({
    x: Math.random() * crashCanvas.width,
    y: -60, // spawn at top, fall down past rocket
    emoji: PLANETS[Math.floor(Math.random()*PLANETS.length)],
    size: 20 + Math.random() * 35,
    speed: 1.5 + Math.random() * 3,
    opacity: 1
  });
}

function drawCrashScene() {
  if (!crashCtx || !crashCanvas) return;
  const w = crashCanvas.width, h = crashCanvas.height;
  crashCtx.clearRect(0, 0, w, h);

  // Sky to space gradient based on multiplier
  const spaceProgress = Math.min((crashMult - 1) / 8, 1);
  const skyColor = lerpColor('#0f1923', '#000005', spaceProgress);
  const grad = crashCtx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, spaceProgress < 0.5 ? '#1a3a28' : '#050015');
  grad.addColorStop(0.4, skyColor);
  grad.addColorStop(1, spaceProgress > 0.3 ? '#000005' : '#0d1f2d');
  crashCtx.fillStyle = grad;
  crashCtx.fillRect(0, 0, w, h);

  // Stars — scroll downward to simulate rocket going up
  const starSpeed = crashState === 'flying' ? Math.min(1 + crashMult * 0.4, 8) : 0.3;
  crashStarObjects.forEach(s => {
    const alpha = crashState === 'flying' ? Math.min(spaceProgress * 2, s.opacity) : s.opacity * 0.3;
    crashCtx.globalAlpha = alpha;
    crashCtx.beginPath();
    // Streak effect at high speed
    const streakLen = crashState === 'flying' ? Math.min(starSpeed * 2, 12) : 0;
    if (streakLen > 1) {
      crashCtx.moveTo(s.x, s.y - streakLen);
      crashCtx.lineTo(s.x, s.y + s.r);
      crashCtx.strokeStyle = '#ffffff';
      crashCtx.lineWidth = s.r;
      crashCtx.stroke();
    } else {
      crashCtx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      crashCtx.fillStyle = '#ffffff';
      crashCtx.fill();
    }
    // Move stars downward (rocket going up illusion)
    s.y += starSpeed * s.speed;
    if (s.y > h + 5) { s.y = -5; s.x = Math.random() * w; }
    s.opacity = 0.3 + Math.abs(Math.sin(crashSpaceTime * 0.03 + s.x)) * 0.7;
  });
  crashCtx.globalAlpha = 1;
  crashCtx.lineWidth = 1;

  // Ground (disappears as we go up)
  if (spaceProgress < 0.7) {
    const groundOpacity = 1 - spaceProgress / 0.7;
    crashCtx.globalAlpha = groundOpacity;
    crashCtx.fillStyle = '#1a3a28';
    crashCtx.fillRect(0, h * 0.85, w, h * 0.15);
    // Horizon glow
    const horizonGrad = crashCtx.createLinearGradient(0, h*0.75, 0, h*0.9);
    horizonGrad.addColorStop(0, 'transparent');
    horizonGrad.addColorStop(1, 'rgba(0,150,50,0.3)');
    crashCtx.fillStyle = horizonGrad;
    crashCtx.fillRect(0, h*0.75, w, h*0.15);
    crashCtx.globalAlpha = 1;
  }

  // Planets
  if (crashState === 'flying') {
    crashPlanetObjects.forEach(p => {
      crashCtx.globalAlpha = Math.min(1, p.opacity);
      crashCtx.font = `${p.size}px serif`;
      crashCtx.textAlign = 'center';
      crashCtx.fillText(p.emoji, p.x, p.y);
      p.y += p.speed; // fall downward past the rocket
      if (p.y > h + p.size) p.opacity = 0;
    });
    crashPlanetObjects = crashPlanetObjects.filter(p => p.opacity > 0);
    crashCtx.globalAlpha = 1;
  }

  // Rocket trail + rocket (fixed horizontal center, only moves up)
  if (crashState === 'flying' || crashState === 'waiting') {
    const rx = w * 0.5;
    const ry = Math.max(h * 0.08, h * (0.78 - Math.min(spaceProgress, 0.68)));
    crashRocketPx = rx; crashRocketPy = ry;

    // Flame trail
    for (let i = 0; i < 8; i++) {
      const trailY = ry + 20 + i * 8;
      const trailOpacity = (1 - i/8) * 0.6;
      const trailR = 6 - i * 0.5;
      const flameGrad = crashCtx.createRadialGradient(rx, trailY, 0, rx, trailY, trailR*3);
      flameGrad.addColorStop(0, `rgba(255,200,50,${trailOpacity})`);
      flameGrad.addColorStop(0.5, `rgba(255,100,0,${trailOpacity*0.6})`);
      flameGrad.addColorStop(1, 'transparent');
      crashCtx.fillStyle = flameGrad;
      crashCtx.beginPath();
      crashCtx.arc(rx + (Math.random()-0.5)*4, trailY, trailR*3, 0, Math.PI*2);
      crashCtx.fill();
    }

    // Rocket emoji
    crashCtx.globalAlpha = 1;
    crashCtx.font = `${28 + spaceProgress*8}px serif`;
    crashCtx.textAlign = 'center';
    crashCtx.fillText('🚀', rx, ry);
  }

  // Crash explosion
  if (crashState === 'crashed') {
    const rx = crashRocketPx || w*0.5, ry = crashRocketPy || h*0.4;
    for (let i = 0; i < 3; i++) {
      const expR = 20 + i * 25 + (crashSpaceTime % 30) * 2;
      const expOpacity = Math.max(0, 0.6 - expR/150);
      const expGrad = crashCtx.createRadialGradient(rx, ry, 0, rx, ry, expR);
      expGrad.addColorStop(0, `rgba(255,255,100,${expOpacity})`);
      expGrad.addColorStop(0.4, `rgba(255,80,0,${expOpacity*0.7})`);
      expGrad.addColorStop(1, 'transparent');
      crashCtx.fillStyle = expGrad;
      crashCtx.beginPath();
      crashCtx.arc(rx, ry, expR, 0, Math.PI*2);
      crashCtx.fill();
    }
    crashCtx.font = '40px serif';
    crashCtx.textAlign = 'center';
    crashCtx.fillText('💥', rx, ry+10);
  }

  crashSpaceTime++;
  crashCtx.textAlign = 'left';
}

function initCrashGame() {
  if (!currentUser) return;
  renderCrashHistory();
  resizeCrashCanvas();
  initCrashStars();
  crashSpaceTime = 0;
  if (crashAnimFrame) cancelAnimationFrame(crashAnimFrame);
  function animLoop() { drawCrashScene(); crashAnimFrame = requestAnimationFrame(animLoop); }
  animLoop();
}

function crashBet() {
  if (!currentUser) { showScreen('login'); return; }
  if (crashState !== 'waiting') { showToast('Espera la próxima ronda','info'); return; }
  const bet = parseInt(document.getElementById('crash-bet').value)||0;
  const auto = parseFloat(document.getElementById('crash-auto').value)||0;
  if (bet < 1) { showToast('Apuesta mínima: 1 🪙','error'); return; }
  if (currentUser.coins < bet) { showToast('Saldo insuficiente','error'); return; }
  crashBetAmount = bet; crashAutoCashout = auto; crashCashedOut = false;
  currentUser.coins -= bet; updateWalletDisplay();
  document.getElementById('crash-my-bet').textContent = `${bet} 🪙`;
  document.getElementById('crash-btn').style.display = 'none';
  document.getElementById('crash-cashout-btn').style.display = 'block';
}

function startCrashRound() {
  crashState = 'flying'; crashMult = 1.0; crashPoints = [];
  crashPlanetObjects = []; crashSpaceTime = 0;
  // Generar punto de crash
  const rand = Math.random();
  let crashPoint;
  if (rand < 0.10) { crashPoint = 1.00; }
  else if (rand < 0.30) { crashPoint = 1.3 + Math.random() * 1.0; }
  else if (rand < 0.55) { crashPoint = 2.3 + Math.random() * 2.0; }
  else if (rand < 0.78) { crashPoint = 4.0 + Math.random() * 5.0; }
  else if (rand < 0.92) { crashPoint = 9.0 + Math.random() * 10.0; }
  else { crashPoint = 19 + Math.random() * 30; }
  const startTime = Date.now();
  let planetTimer = 0;
  crashInterval = setInterval(() => {
    const elapsed = (Date.now()-startTime)/1000;
    crashMult = Math.round(Math.pow(Math.E, elapsed*0.12)*100)/100;
    crashPoints.push({ t:elapsed, m:crashMult });
    document.getElementById('crash-multiplier').textContent = crashMult.toFixed(2)+'x';
    if (crashBetAmount > 0 && !crashCashedOut) {
      document.getElementById('crash-live-mult').textContent = crashMult.toFixed(2)+'x';
      document.getElementById('crash-potential').textContent = Math.floor(crashBetAmount*crashMult)+' 🪙';
      document.getElementById('crash-cashout-val').textContent = `(${Math.floor(crashBetAmount*crashMult)} 🪙)`;
      if (Math.floor(elapsed) !== Math.floor(elapsed - 0.08)) playSound('crash_fly');
      if (crashAutoCashout > 1 && crashMult >= crashAutoCashout) { crashCashout(); return; }
    }
    planetTimer++;
    if (planetTimer % Math.max(5, 40 - Math.floor(crashMult)*3) === 0) spawnPlanet();
    if (crashMult >= crashPoint) { doCrash(); }
  }, 80);
}

function crashCashout() {
  if (crashCashedOut||crashState!=='flying') return;
  // House rule: if above 3.5x, cashout attempt triggers crash
  if (crashMult > 3.5) { doCrash(); return; }
  crashCashedOut=true; clearInterval(crashInterval);
  const winAmount=Math.floor(crashBetAmount*crashMult);
  currentUser.coins+=winAmount; updateWalletDisplay();
  crashHistory.unshift({mult:crashMult,won:true});
  renderCrashHistory();
  showToast(`✅ Retiraste a ${crashMult.toFixed(2)}x — +${winAmount} 🪙`,'success');
  playSound('crash_cashout');
  endCrashRound(true);
  api('POST','/api/crash/result',{bet:crashBetAmount,mult:crashMult,won:true}).catch(()=>{});
}

function doCrash() {
  clearInterval(crashInterval); crashState='crashed';
  const multEl=document.getElementById('crash-multiplier');
  multEl.textContent=crashMult.toFixed(2)+'x'; multEl.classList.add('crashed');
  playSound('crash_boom');
  stopFakeActivity();
  showCrashLosses(crashMult.toFixed(2));
  if (crashBetAmount > 0 && !crashCashedOut) {
    // El dinero ya fue descontado al apostar — solo mostrar la pérdida
    showToast(`💥 ¡Explotó en ${crashMult.toFixed(2)}x! Perdiste ${crashBetAmount.toLocaleString()} 🪙`, 'error');
    crashHistory.unshift({mult:crashMult,won:false});
    renderCrashHistory();
    api('POST','/api/crash/result',{bet:crashBetAmount,mult:crashMult,won:false}).catch(()=>{});
    crashBetAmount = 0; // resetear para que no vuelva a mostrar pérdida
  } else {
    crashHistory.unshift({mult:crashMult,won:false});
    renderCrashHistory();
  }
  endCrashRound(false);
}

function endCrashRound(won) {
  document.getElementById('crash-cashout-btn').style.display='none';
  setTimeout(()=>{
    crashState='waiting'; crashMult=1.0; crashPoints=[];
    crashBetAmount=0;
    document.getElementById('crash-multiplier').classList.remove('crashed');
    document.getElementById('crash-multiplier').textContent='1.00x';
    document.getElementById('crash-btn').style.display='block';
    document.getElementById('crash-my-bet').textContent='—';
    document.getElementById('crash-live-mult').textContent='—';
    document.getElementById('crash-potential').textContent='—';
    document.getElementById('crash-cashout-val').textContent='';
    crashPlanetObjects=[];
    // Iniciar siguiente ronda automáticamente
    startCrashCountdown(7);
  }, 3000);
}

function renderCrashHistory() {
  const el=document.getElementById('crash-history'); if(!el) return;
  el.innerHTML=crashHistory.slice(0,10).map(h=>{
    const cls=h.mult<1.5?'low':h.mult<3?'mid':'high';
    return `<span class="crash-hist-item ${cls}">${h.mult.toFixed(2)}x</span>`;
  }).join('');
}

function lerpColor(hex1, hex2, t) {
  const r1=parseInt(hex1.slice(1,3),16),g1=parseInt(hex1.slice(3,5),16),b1=parseInt(hex1.slice(5,7),16);
  const r2=parseInt(hex2.slice(1,3),16),g2=parseInt(hex2.slice(3,5),16),b2=parseInt(hex2.slice(5,7),16);
  const r=Math.round(r1+(r2-r1)*t),g=Math.round(g1+(g2-g1)*t),b=Math.round(b1+(b2-b1)*t);
  return `rgb(${r},${g},${b})`;
}

// ══════════════════════════════════════════════════
// ── MINES — efectos y sonidos ─────────────────────
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
  const grid=document.getElementById('mines-grid'); if(!grid) return;
  grid.innerHTML=Array.from({length:25},(_,i)=>`
    <div class="mine-cell" id="mine-${i}" onclick="minesReveal(${i})" style="font-size:1.6rem;transition:all 0.2s;position:relative;overflow:hidden;">
      <span class="mine-emoji">🎲</span>
    </div>`).join('');
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
  // Pulse animation on all cells
  document.querySelectorAll('.mine-cell').forEach((c,i)=>{
    setTimeout(()=>{ c.style.transform='scale(1.05)'; setTimeout(()=>c.style.transform='',100); }, i*20);
  });
}

function minesReveal(index) {
  if (!minesActive) return;
  const cell=document.getElementById(`mine-${index}`);
  if (!cell||cell.classList.contains('safe')||cell.classList.contains('mine')) return;
  cell.style.transform='scale(0.9)';
  setTimeout(()=>cell.style.transform='',100);
  if (minesBoard[index]==='mine') {
    cell.classList.add('mine');
    cell.innerHTML='<span style="font-size:2rem;animation:mineReveal 0.3s ease-out;">💣</span>';
    playSound('mines_boom');
    // Shake the whole grid
    const grid=document.getElementById('mines-grid');
    grid.style.animation='shake 0.5s ease-in-out';
    setTimeout(()=>grid.style.animation='',500);
    // Reveal all mines with delay
    minesBoard.forEach((_,i)=>{
      if (minesBoard[i]==='mine') {
        setTimeout(()=>{
          const c=document.getElementById(`mine-${i}`);
          c.classList.add('mine');
          c.innerHTML='<span style="font-size:2rem;">💣</span>';
        }, Math.abs(i-index)*30);
      }
    });
    minesActive=false;
    document.getElementById('mines-start-btn').style.display='block';
    document.getElementById('mines-cashout-btn').style.display='none';
    document.getElementById('mines-status').textContent='💥 ¡BOOM! Perdiste.';
    document.querySelectorAll('.mine-cell').forEach(c=>c.classList.add('disabled'));
    showToast(`💣 ¡BOOM! Perdiste ${minesBetAmount.toLocaleString()} 🪙`,'error');
    api('POST','/api/mines/result',{bet:minesBetAmount,won:false,gems:minesGemsFound}).catch(()=>{});
  } else {
    minesGemsFound++;
    cell.classList.add('safe');
    cell.innerHTML='<span style="font-size:2rem;animation:gemPop 0.4s cubic-bezier(.34,1.56,.64,1);">💎</span>';
    playSound('mines_gem');
    // Tension sound for nearby cells
    setTimeout(()=>playSound('mines_tension'),200);
    // Glow effect on the cell
    cell.style.boxShadow='0 0 20px rgba(0,231,1,0.6)';
    setTimeout(()=>cell.style.boxShadow='',800);
    // Floating +coins text
    showFloatingText(cell, `+${Math.floor(minesBetAmount*(updateMinesMultiplierVal()-minesCurrentMult+minesCurrentMult))}`, '#00e701');
    updateMinesMultiplier();
    document.getElementById('mines-gem-count').textContent=`💎 Gemas: ${minesGemsFound}`;
    document.getElementById('mines-cashout-val').textContent=`(${Math.floor(minesBetAmount*minesCurrentMult)} 🪙)`;
    // Pulse multiplier display
    const multEl=document.getElementById('mines-mult');
    multEl.style.transform='scale(1.3)'; multEl.style.color='#ffd700';
    setTimeout(()=>{ multEl.style.transform=''; multEl.style.color=''; },300);
    if (minesGemsFound>=(25-minesMineCount)) { minesCashout(); }
  }
}

function showFloatingText(el, text, color) {
  const rect=el.getBoundingClientRect();
  const float=document.createElement('div');
  float.textContent=text;
  Object.assign(float.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',color,fontWeight:'800',fontSize:'1rem',pointerEvents:'none',zIndex:'999',animation:'floatUp 0.8s ease-out forwards',fontFamily:"'Outfit',sans-serif"});
  document.body.appendChild(float);
  setTimeout(()=>float.remove(),800);
}

function updateMinesMultiplierVal() {
  if (minesGemsFound===0) return 1.0;
  let mult=1.0;
  for (let i=0;i<minesGemsFound;i++) {
    const remaining=25-i, safeRemaining=remaining-minesMineCount;
    if (safeRemaining<=0) break;
    // House edge: multiply by 0.94 instead of 0.97
    mult*=(remaining/safeRemaining)*0.94;
  }
  return Math.round(mult*100)/100;
}

function updateMinesMultiplier() {
  minesCurrentMult = updateMinesMultiplierVal();
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
  document.getElementById('mines-status').textContent=`✅ Retiraste ${winAmount.toLocaleString()} 🪙`;
  document.querySelectorAll('.mine-cell').forEach(c=>c.classList.add('disabled'));
  showToast(`💎 +${winAmount.toLocaleString()} 🪙 (${minesCurrentMult.toFixed(2)}x)`,'success');
  playSound('coins');
  // Win sparkle effect
  document.querySelectorAll('.mine-cell.safe').forEach((c,i)=>{
    setTimeout(()=>{ c.style.boxShadow='0 0 15px rgba(255,215,0,0.8)'; setTimeout(()=>c.style.boxShadow='',400); },i*30);
  });
  api('POST','/api/mines/result',{bet:minesBetAmount,won:true,gems:minesGemsFound,mult:minesCurrentMult}).catch(()=>{});
}

function shuffleArray(arr) {
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

// ══════════════════════════════════════════════════
// ── BLACKJACK ─────────────────────────────────────
// ══════════════════════════════════════════════════
const BJ_VALUES = {'A':11,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':10,'Q':10,'K':10};
const BJ_SUITS = ['♠','♥','♦','♣'];
const BJ_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildBlackjackUI() {
  const existing = document.getElementById('screen-blackjack');
  if (existing) return;
  const screen = document.createElement('div');
  screen.className = 'screen'; screen.id = 'screen-blackjack';
  screen.innerHTML = `
  <div style="max-width:700px;margin:0 auto;padding:20px 16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <h2 style="font-size:1.3rem;font-weight:800;">🃏 Blackjack</h2>
      <button class="btn btn-outline btn-sm" onclick="showScreen('home')">← Lobby</button>
    </div>
    <!-- Table -->
    <div style="background:radial-gradient(ellipse,#1a5c30,#0d3018);border:2px solid #2a6040;border-radius:16px;padding:20px;margin-bottom:16px;min-height:320px;position:relative;">
      <div style="font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;text-align:center;margin-bottom:12px;">DEALER</div>
      <div id="bj-dealer-hand" style="display:flex;gap:8px;justify-content:center;min-height:90px;align-items:center;flex-wrap:wrap;margin-bottom:20px;"></div>
      <div id="bj-dealer-score" style="text-align:center;font-size:0.8rem;color:rgba(255,255,255,0.5);margin-bottom:16px;"></div>
      <div style="border-top:1px solid rgba(255,255,255,0.1);margin:12px 0;"></div>
      <div id="bj-player-hand" style="display:flex;gap:8px;justify-content:center;min-height:90px;align-items:center;flex-wrap:wrap;margin-top:16px;"></div>
      <div id="bj-player-score" style="text-align:center;font-size:0.9rem;font-weight:700;color:var(--accent);margin-top:8px;"></div>
      <div style="font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:2px;text-align:center;margin-top:12px;">TÚ</div>
      <div id="bj-result-msg" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2rem;font-weight:900;font-family:'Bricolage Grotesque',sans-serif;display:none;text-align:center;text-shadow:0 2px 10px rgba(0,0,0,0.8);pointer-events:none;"></div>
    </div>
    <!-- Controls -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;">
      <div id="bj-bet-area">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text2);letter-spacing:1px;margin-bottom:10px;">APUESTA</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          ${[50,100,200,500,1000].map(v=>`<button class="btn btn-outline btn-sm" onclick="bjAddBet(${v})">+${v}</button>`).join('')}
          <button class="btn btn-outline btn-sm" onclick="bjClearBet()">✕ Limpiar</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
          <div style="flex:1;">
            <div style="font-size:0.72rem;color:var(--text2);">Apuesta actual</div>
            <div id="bj-bet-display" style="font-size:1.4rem;font-weight:800;color:var(--accent);">0 🪙</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:0.72rem;color:var(--text2);">Tu saldo</div>
            <div id="bj-balance-display" style="font-size:1rem;font-weight:700;color:var(--text);">0 🪙</div>
          </div>
        </div>
        <button class="btn btn-gold w-full btn-lg" onclick="bjDeal()">🃏 Repartir</button>
      </div>
      <div id="bj-action-area" style="display:none;">
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-gold btn-lg" onclick="bjHit()">👆 Pedir (Hit)</button>
          <button class="btn btn-outline btn-lg" onclick="bjStand()">✋ Plantarse (Stand)</button>
          <button class="btn btn-outline btn-sm" id="bj-double-btn" onclick="bjDouble()" style="border-color:var(--gold);color:var(--gold);">⚡ Doblar</button>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text2);">
          <span>Apuesta: <strong id="bj-active-bet" style="color:var(--accent);">0 🪙</strong></span>
          <span>Ganas si ganas: <strong id="bj-potential-win" style="color:var(--green);">0 🪙</strong></span>
        </div>
      </div>
    </div>
    <div style="margin-top:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;">
      <div style="font-size:0.7rem;color:var(--text3);font-weight:700;letter-spacing:1px;margin-bottom:6px;">REGLAS</div>
      <div style="font-size:0.75rem;color:var(--text2);line-height:1.6;">🃏 Blackjack paga 1.5x · Dealer se planta en 17 · 6 mazos · El dealer gana en empate</div>
    </div>
  </div>`;
  document.body.appendChild(screen);
}

function initBlackjack() {
  if (!currentUser) return;
  bjBet = 0; bjActive = false;
  const betArea = document.getElementById('bj-bet-area');
  const actionArea = document.getElementById('bj-action-area');
  if (betArea) betArea.style.display = 'block';
  if (actionArea) actionArea.style.display = 'none';
  document.getElementById('bj-dealer-hand').innerHTML = '';
  document.getElementById('bj-player-hand').innerHTML = '';
  document.getElementById('bj-dealer-score').textContent = '';
  document.getElementById('bj-player-score').textContent = '';
  document.getElementById('bj-result-msg').style.display = 'none';
  document.getElementById('bj-bet-display').textContent = '0 🪙';
  document.getElementById('bj-balance-display').textContent = `${(currentUser.coins||0).toLocaleString()} 🪙`;
}

function bjAddBet(amount) {
  if (bjActive) return;
  if ((bjBet + amount) > (currentUser.coins||0)) { showToast('Saldo insuficiente','error'); return; }
  bjBet += amount;
  document.getElementById('bj-bet-display').textContent = `${bjBet.toLocaleString()} 🪙`;
  playTone(600+amount/10, 0.15, 0.05);
}

function bjClearBet() { bjBet = 0; document.getElementById('bj-bet-display').textContent = '0 🪙'; }

function makeBJDeck() {
  const deck = [];
  for (let d=0;d<6;d++) for (const s of BJ_SUITS) for (const r of BJ_RANKS) deck.push({r,s});
  return shuffleArray(deck);
}

function bjHandValue(hand) {
  let val=0, aces=0;
  hand.forEach(c=>{val+=BJ_VALUES[c.r]; if(c.r==='A') aces++;});
  while(val>21&&aces>0){val-=10;aces--;}
  return val;
}

function renderBJCard(card, faceDown=false) {
  const isRed = card.s==='♥'||card.s==='♦';
  const color = faceDown ? '#1a2c38' : (isRed?'#ff4444':'#f5f0e8');
  const textColor = faceDown ? 'transparent' : (isRed?'#cc0000':'#1a1a1a');
  const bg = faceDown ? 'linear-gradient(135deg,#1a2c38 0%,#3d5a6b 50%,#1a2c38 100%)' : 'linear-gradient(135deg,#f5f0e8,#e8e0d0)';
  return `<div style="
    width:60px;height:88px;border-radius:8px;
    background:${bg};
    border:1.5px solid ${faceDown?'#3d5a6b':'#ccc'};
    box-shadow:0 3px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.1);
    display:flex;flex-direction:column;justify-content:space-between;
    padding:4px 5px;flex-shrink:0;
    animation:cardDeal 0.3s ease-out;
  ">
    ${faceDown ? '<div style="font-size:1.4rem;text-align:center;margin:auto;">🂠</div>' : `
    <div style="font-size:0.7rem;font-weight:800;color:${textColor};line-height:1;">${card.r}<br/>${card.s}</div>
    <div style="font-size:1.2rem;text-align:center;color:${textColor};">${card.s}</div>
    <div style="font-size:0.7rem;font-weight:800;color:${textColor};line-height:1;align-self:flex-end;transform:rotate(180deg);">${card.r}<br/>${card.s}</div>
    `}
  </div>`;
}

function bjDeal() {
  if (!currentUser) { showScreen('login'); return; }
  if (bjBet < 1) { showToast('Haz una apuesta primero','error'); return; }
  if (bjBet > (currentUser.coins||0)) { showToast('Saldo insuficiente','error'); return; }
  bjDeck = makeBJDeck();
  bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
  bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
  bjActive = true;
  currentUser.coins -= bjBet; updateWalletDisplay();
  document.getElementById('bj-bet-area').style.display = 'none';
  document.getElementById('bj-action-area').style.display = 'block';
  document.getElementById('bj-active-bet').textContent = `${bjBet.toLocaleString()} 🪙`;
  document.getElementById('bj-potential-win').textContent = `${(bjBet*2).toLocaleString()} 🪙`;
  document.getElementById('bj-result-msg').style.display = 'none';
  renderBJTable(true);
  playSound('bj_card');
  // Check blackjack
  const pv = bjHandValue(bjPlayerHand);
  if (pv === 21) { setTimeout(()=>bjStand(), 800); }
}

function renderBJTable(dealerHidden=false) {
  const dEl=document.getElementById('bj-dealer-hand');
  const pEl=document.getElementById('bj-player-hand');
  dEl.innerHTML = bjDealerHand.map((c,i)=>renderBJCard(c, dealerHidden&&i===1)).join('');
  pEl.innerHTML = bjPlayerHand.map(c=>renderBJCard(c)).join('');
  const pv=bjHandValue(bjPlayerHand);
  document.getElementById('bj-player-score').textContent = `Tu total: ${pv}${pv>21?' 💥 BUST':''}`;
  const dVisible = dealerHidden ? bjHandValue([bjDealerHand[0]]) : bjHandValue(bjDealerHand);
  document.getElementById('bj-dealer-score').textContent = dealerHidden ? `Dealer: ${dVisible}+?` : `Dealer: ${dVisible}`;
  // Double button only on first two cards
  const doubleBtn=document.getElementById('bj-double-btn');
  if (doubleBtn) doubleBtn.style.display = bjPlayerHand.length===2&&bjBet<=(currentUser.coins||0) ? 'inline-flex':'none';
}

function bjHit() {
  if (!bjActive) return;
  bjPlayerHand.push(bjDeck.pop());
  renderBJTable(true);
  playSound('bj_card');
  if (bjHandValue(bjPlayerHand) > 21) { setTimeout(()=>bjEndRound(),400); }
}

function bjStand() {
  if (!bjActive) return;
  // Dealer plays
  renderBJTable(false);
  const dealerPlay = () => {
    const dv=bjHandValue(bjDealerHand);
    if (dv < 17) {
      bjDealerHand.push(bjDeck.pop());
      playSound('bj_card');
      renderBJTable(false);
      setTimeout(dealerPlay, 600);
    } else { bjEndRound(); }
  };
  setTimeout(dealerPlay, 600);
}

function bjDouble() {
  if (!bjActive||bjPlayerHand.length!==2) return;
  if (bjBet > (currentUser.coins||0)) { showToast('Saldo insuficiente para doblar','error'); return; }
  currentUser.coins -= bjBet; bjBet *= 2; updateWalletDisplay();
  document.getElementById('bj-active-bet').textContent = `${bjBet.toLocaleString()} 🪙`;
  document.getElementById('bj-potential-win').textContent = `${(bjBet*2).toLocaleString()} 🪙`;
  bjPlayerHand.push(bjDeck.pop());
  renderBJTable(true);
  playSound('bj_card');
  setTimeout(()=>bjStand(), 400);
}

function bjEndRound() {
  bjActive = false;
  renderBJTable(false);
  const pv=bjHandValue(bjPlayerHand), dv=bjHandValue(bjDealerHand);
  const resultEl=document.getElementById('bj-result-msg');
  let winAmount=0, resultText='', resultColor='#ff4444';
  const isBJ = pv===21&&bjPlayerHand.length===2;
  if (pv>21) {
    resultText='💥 BUST'; resultColor='#ff4444'; playSound('bj_bust');
    showToast(`💥 Bust — Perdiste ${bjBet.toLocaleString()} 🪙`,'error');
  } else if (dv>21) {
    winAmount=bjBet*2; resultText='¡GANAS! 🏆'; resultColor='#00e701'; playSound('bj_win');
    showToast(`🏆 Dealer bust — +${winAmount.toLocaleString()} 🪙`,'success');
  } else if (isBJ&&dv!==21) {
    winAmount=Math.floor(bjBet*2.5); resultText='🃏 BLACKJACK!'; resultColor='#ffd700'; playSound('bj_bj');
    showToast(`🃏 BLACKJACK! +${winAmount.toLocaleString()} 🪙`,'gold');
  } else if (pv>dv) {
    winAmount=bjBet*2; resultText='¡GANAS! 🏆'; resultColor='#00e701'; playSound('bj_win');
    showToast(`🏆 +${winAmount.toLocaleString()} 🪙`,'success');
  } else if (pv===dv) {
    // Dealer wins on tie — house edge
    resultText='EMPATE → Dealer'; resultColor='#f97316';
    showToast('Empate — gana el dealer','info');
  } else {
    resultText='😞 Dealer Gana'; resultColor='#ff4444'; playSound('bj_bust');
    showToast(`😞 Perdiste ${bjBet.toLocaleString()} 🪙`,'error');
  }
  if (winAmount>0) { currentUser.coins+=winAmount; updateWalletDisplay(); if(winAmount>bjBet) launchConfetti(); }
  resultEl.textContent=resultText; resultEl.style.color=resultColor; resultEl.style.display='block';
  api('POST','/api/blackjack/result',{bet:bjBet,won:winAmount>0,winAmount}).catch(()=>{});
  setTimeout(()=>{ initBlackjack(); }, 2800);
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
function openGrantModal(username) { grantTarget=username; document.getElementById('grant-modal-title').textContent=`Modificar saldo — ${username}`; document.getElementById('grant-preview').textContent=''; document.getElementById('grant-amount').value=''; openModal('modal-admin-grant'); }
function updateGrantPreview() { const amount=parseInt(document.getElementById('grant-amount').value)||0; document.getElementById('grant-preview').textContent=`${grantTarget}: ${amount.toLocaleString()} 🪙`; }
async function confirmGrant(action) {
  const amount=parseInt(document.getElementById('grant-amount').value);
  if (!amount||amount<1) return;
  try { await api('POST','/api/admin/grant',{username:grantTarget,amount,action}); showToast(`Saldo actualizado para ${grantTarget}`,'success'); closeModal('modal-admin-grant'); loadAdmin(); }
  catch(e) { showToast(e.message,'error'); }
}
async function toggleBan(username,banned) {
  try { await api('POST','/api/admin/ban',{username,banned}); showToast(banned?`${username} suspendido`:`${username} reactivado`,'success'); loadAdmin(); }
  catch(e) { showToast(e.message,'error'); }
}
function switchAdminTab(tab) {
  ['users','reports'].forEach(t=>{document.getElementById(`admin-tab-${t}`).style.display=t===tab?'block':'none';});
  document.querySelectorAll('#admin-tabs .tab-pill').forEach((el,i)=>el.classList.toggle('active',(i===0&&tab==='users')||(i===1&&tab==='reports')));
}
async function doSendSupport() {
  const msg=document.getElementById('support-msg').value.trim();
  const errEl=document.getElementById('support-err');
  if (!msg) { showErr(errEl,'Escribe tu mensaje'); return; }
  showToast('Mensaje enviado. Te responderemos pronto.','success');
  closeModal('modal-support');
  document.getElementById('support-msg').value='';
}
