// DomiDom — Server v2
'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ─────────────────────────────────────────────────────
const ADMIN_USER = (process.env.ADMIN_USER || 'admin').toLowerCase();
const SUPPORT_USER = (process.env.SUPPORT_USER || 'soporte').toLowerCase();
const SUPPORT_PASS = process.env.SUPPORT_PASS || 'soporte123';
const BANK_NAME = process.env.BANK_NAME || 'Banco Popular Dominicano';
const BANK_ACCOUNT = process.env.BANK_ACCOUNT || '812-000000-0';
const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP || '';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'soporte@domidom.com';
const PORT = process.env.PORT || 3000;
const STARTING_COINS = 1000;

// ── Resend (optional) ─────────────────────────────────────────
let resend = null;
if (process.env.RESEND_API_KEY) {
  try { const { Resend } = require('resend'); resend = new Resend(process.env.RESEND_API_KEY); } catch {}
}

// ── Supabase (optional) ───────────────────────────────────────
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  try { const { createClient } = require('@supabase/supabase-js'); supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY); } catch {}
}

// ── In-memory state ────────────────────────────────────────────
let state = { users: {}, rooms: {}, onlineSockets: {} };

// ── Persistence ────────────────────────────────────────────────
async function loadState() {
  if (!supabase) return;
  try {
    const { data } = await supabase.from('domidom_state').select('data').eq('id', 'main').single();
    if (data?.data) state = { ...state, ...data.data };
  } catch {}
}

async function saveState() {
  if (!supabase) return;
  try {
    await supabase.from('domidom_state').upsert({ id: 'main', data: { users: state.users } });
  } catch {}
}

// ── Helpers ────────────────────────────────────────────────────
function hashPassword(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pass, stored) {
  try {
    const [salt, hash] = stored.split(':');
    return crypto.scryptSync(pass, salt, 64).toString('hex') === hash;
  } catch { return false; }
}

function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function getUserByToken(token) { return Object.values(state.users).find(u => u.token === token) || null; }

function sanitizeUser(u) {
  return {
    username: u.username, email: u.email, coins: u.coins,
    isAdmin: u.isAdmin, isSupportAgent: u.isSupportAgent,
    stats: u.stats, transactions: (u.transactions || []).slice(-50),
    token: u.token
  };
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-token'];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Token inválido' });
  if (user.banned) return res.status(403).json({ error: 'Cuenta suspendida' });
  req.user = user;
  next();
}

function adminMiddleware(req, res, next) {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'No autorizado' });
  next();
}

// ── Provinces ──────────────────────────────────────────────────
const PROVINCES = [
  { id: 'sde',      name: 'Santo Domingo', buyIn: 50,   featured: false },
  { id: 'santiago', name: 'Santiago',      buyIn: 100,  featured: false },
  { id: 'laplata',  name: 'La Plata',      buyIn: 250,  featured: false },
  { id: 'cibao',    name: 'El Cibao',      buyIn: 500,  featured: false },
  { id: 'elite',    name: 'Mesa Elite',    buyIn: 1000, featured: true  },
];

// ── AUTH ───────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, phone } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: 'Faltan campos' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Usuario 3-20 caracteres' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Solo letras, números y _' });
  if (password.length < 6) return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });

  const key = username.toLowerCase();
  if (state.users[key]) return res.status(400).json({ error: 'Usuario ya existe' });

  const isAdmin = key === ADMIN_USER;
  const isSupportAgent = key === SUPPORT_USER;
  const token = generateToken();

  state.users[key] = {
    username, email, phone: phone || '',
    passwordHash: hashPassword(password),
    token, coins: STARTING_COINS,
    isAdmin, isSupportAgent,
    verified: true,
    banned: false,
    friends: [], friendRequests: [],
    stats: { games: 0, wins: 0, earnings: 0 },
    transactions: [{ type: 'deposit', amount: STARTING_COINS, date: new Date().toISOString(), note: 'Bono bienvenida' }],
    createdAt: new Date().toISOString()
  };

  await saveState();
  console.log(`[REGISTER] ${username} (admin:${isAdmin})`);
  return res.json(sanitizeUser(state.users[key]));
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan campos' });
  const key = username.toLowerCase();

  // Support user auto-create
  if (key === SUPPORT_USER) {
    if (password !== SUPPORT_PASS) return res.status(401).json({ error: 'Contraseña incorrecta' });
    if (!state.users[key]) {
      state.users[key] = {
        username: SUPPORT_USER, email: SUPPORT_EMAIL, phone: '',
        passwordHash: hashPassword(SUPPORT_PASS),
        token: generateToken(), coins: 0,
        isAdmin: false, isSupportAgent: true,
        verified: true, banned: false,
        friends: [], friendRequests: [],
        stats: { games: 0, wins: 0, earnings: 0 },
        transactions: [], createdAt: new Date().toISOString()
      };
    }
    state.users[key].token = generateToken();
    await saveState();
    return res.json(sanitizeUser(state.users[key]));
  }

  const user = state.users[key];
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
  if (user.banned) return res.status(403).json({ error: 'Cuenta suspendida' });
  if (!verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: 'Contraseña incorrecta' });
  user.token = generateToken();
  await saveState();
  return res.json(sanitizeUser(user));
});

// ── USER ROUTES ────────────────────────────────────────────────
app.get('/api/me', authMiddleware, (req, res) => res.json(sanitizeUser(req.user)));

app.get('/api/provinces', (req, res) => {
  res.json(PROVINCES.map(p => ({
    ...p,
    playersInQueue: Object.values(state.rooms).filter(r => r.provinceId === p.id && !r.gameStarted).reduce((a, r) => a + r.players.length, 0),
    activeTables: Object.values(state.rooms).filter(r => r.provinceId === p.id && r.gameStarted).length,
  })));
});

app.get('/api/leaderboard', (req, res) => {
  res.json(Object.values(state.users)
    .filter(u => u.stats?.earnings > 0)
    .sort((a, b) => b.stats.earnings - a.stats.earnings)
    .slice(0, 10)
    .map(u => ({ username: u.username, earnings: u.stats.earnings })));
});

app.get('/api/online', (req, res) => res.json({ count: Object.keys(state.onlineSockets).length }));

app.get('/api/deposit-info', (req, res) => {
  res.json({ bankName: BANK_NAME, bankAccount: BANK_ACCOUNT, supportWhatsapp: SUPPORT_WHATSAPP, supportEmail: SUPPORT_EMAIL });
});

app.post('/api/withdraw-request', authMiddleware, async (req, res) => {
  const { amount, bankAccount } = req.body;
  if (!amount || amount < 1) return res.status(400).json({ error: 'Monto inválido' });
  if (req.user.coins < amount) return res.status(400).json({ error: 'Saldo insuficiente' });
  req.user.coins -= amount;
  req.user.transactions = req.user.transactions || [];
  req.user.transactions.push({ type: 'withdrawal_pending', amount: -amount, date: new Date().toISOString(), bankAccount });
  await saveState();
  console.log(`[WITHDRAW] ${req.user.username} solicitó ${amount} coins → ${bankAccount}`);
  res.json({ ok: true });
});

app.post('/api/crash/result', authMiddleware, async (req, res) => {
  const { bet, mult, won } = req.body;
  if (!bet || bet < 1) return res.status(400).json({ error: 'Bet inválido' });
  const user = req.user;
  const winAmount = won ? Math.floor(bet * mult) : 0;
  if (won) {
    user.coins += winAmount;
    user.stats.earnings = (user.stats.earnings || 0) + (winAmount - bet);
  } else {
    user.stats.earnings = (user.stats.earnings || 0) - bet;
  }
  user.transactions = user.transactions || [];
  user.transactions.push({ type: won ? 'crash_win' : 'crash_loss', amount: won ? winAmount - bet : -bet, date: new Date().toISOString() });
  await saveState();
  const sockId = Object.keys(state.onlineSockets).find(k => state.onlineSockets[k] === user.username.toLowerCase());
  if (sockId) io.to(sockId).emit('coins:update', user.coins);
  res.json({ coins: user.coins });
});

app.post('/api/mines/result', authMiddleware, async (req, res) => {
  const { bet, won, gems, mult } = req.body;
  if (!bet || bet < 1) return res.status(400).json({ error: 'Bet inválido' });
  const user = req.user;
  const winAmount = won ? Math.floor(bet * (mult || 1)) : 0;
  if (won) {
    user.coins += winAmount;
    user.stats.earnings = (user.stats.earnings || 0) + (winAmount - bet);
  } else {
    user.stats.earnings = (user.stats.earnings || 0) - bet;
  }
  user.transactions = user.transactions || [];
  user.transactions.push({ type: won ? 'mines_win' : 'mines_loss', amount: won ? winAmount - bet : -bet, date: new Date().toISOString(), gems });
  await saveState();
  res.json({ coins: user.coins });
});

// ── ADMIN ──────────────────────────────────────────────────────
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  res.json(Object.values(state.users).map(u => ({
    username: u.username, email: u.email, coins: u.coins, banned: u.banned, stats: u.stats
  })));
});

app.post('/api/admin/grant', authMiddleware, adminMiddleware, async (req, res) => {
  const { username, amount, action } = req.body;
  const user = state.users[username.toLowerCase()];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (action === 'give') { user.coins += amount; user.transactions.push({ type: 'admin_credit', amount, date: new Date().toISOString() }); }
  else { user.coins = Math.max(0, user.coins - amount); user.transactions.push({ type: 'admin_debit', amount: -amount, date: new Date().toISOString() }); }
  await saveState();
  const sockId = Object.keys(state.onlineSockets).find(k => state.onlineSockets[k] === username.toLowerCase());
  if (sockId) io.to(sockId).emit('coins:update', user.coins);
  res.json({ ok: true });
});

app.post('/api/admin/ban', authMiddleware, adminMiddleware, async (req, res) => {
  const { username, banned } = req.body;
  const user = state.users[username.toLowerCase()];
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  user.banned = banned;
  await saveState();
  res.json({ ok: true });
});

// ── SOCKET.IO ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('auth', ({ token }) => {
    const user = getUserByToken(token);
    if (!user || user.banned) return;
    state.onlineSockets[socket.id] = user.username.toLowerCase();
    socket.emit('auth:ok', sanitizeUser(user));
    io.emit('online:count', Object.keys(state.onlineSockets).length);
    io.emit('leaderboard:update', getLeaderboard());
  });

  socket.on('disconnect', () => {
    const username = state.onlineSockets[socket.id];
    delete state.onlineSockets[socket.id];
    io.emit('online:count', Object.keys(state.onlineSockets).length);
    if (username) {
      Object.values(state.rooms).forEach(room => {
        const idx = room.players.findIndex(p => p.username.toLowerCase() === username);
        if (idx !== -1 && !room.gameStarted) {
          room.players.splice(idx, 1);
          io.to(room.id).emit('room:update', room);
        }
      });
    }
  });

  socket.on('queue:join', ({ provinceId }) => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    if (!user) return socket.emit('queue:error', 'No autenticado');
    const province = PROVINCES.find(p => p.id === provinceId);
    if (!province) return socket.emit('queue:error', 'Provincia inválida');
    if (user.coins < province.buyIn) return socket.emit('queue:error', 'Saldo insuficiente');

    let room = Object.values(state.rooms).find(r => r.provinceId === provinceId && !r.gameStarted && r.players.length < 4);
    if (!room) {
      const roomId = `DOMI-${Math.random().toString(36).substr(2,4).toUpperCase()}`;
      room = { id: roomId, provinceId, buyIn: province.buyIn, players: [], host: username, gameStarted: false, pot: 0, scores: [0,0], isPublic: true };
      state.rooms[roomId] = room;
    }

    if (!room.players.find(p => p.username === username)) {
      room.players.push({ username, seatIndex: room.players.length, team: room.players.length < 2 ? 0 : 1, isBot: false });
      room.pot += province.buyIn;
      user.coins -= province.buyIn;
      socket.join(room.id);
      io.to(room.id).emit('room:update', room);
    }

    socket.emit('queue:joined', { province });
    if (room.players.length === 4) startGame(room);
  });

  socket.on('queue:leave', ({ provinceId }) => {
    const username = state.onlineSockets[socket.id];
    if (!username) return;
    const room = Object.values(state.rooms).find(r => r.provinceId === provinceId && !r.gameStarted && r.players.some(p => p.username === username));
    if (room) {
      const idx = room.players.findIndex(p => p.username === username);
      if (idx !== -1) {
        const user = state.users[username];
        if (user) user.coins += room.buyIn;
        room.pot -= room.buyIn;
        room.players.splice(idx, 1);
        socket.leave(room.id);
        io.to(room.id).emit('room:update', room);
      }
    }
  });

  socket.on('room:create', ({ buyIn = 0 }) => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    if (!user) return;
    const roomId = `DOMI-${Math.random().toString(36).substr(2,4).toUpperCase()}`;
    const room = { id: roomId, provinceId: null, buyIn, players: [{ username, seatIndex: 0, team: 0, isBot: false }], host: username, gameStarted: false, pot: buyIn > 0 ? buyIn : 0, scores: [0,0], isPublic: false };
    if (buyIn > 0) user.coins -= buyIn;
    state.rooms[roomId] = room;
    socket.join(roomId);
    socket.emit('room:created', { roomId });
    socket.emit('room:update', room);
  });

  socket.on('room:join', ({ roomId }) => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    if (!user) return;
    const room = state.rooms[roomId];
    if (!room) return socket.emit('room:error', 'Sala no encontrada');
    if (room.players.length >= 4) return socket.emit('room:error', 'Sala llena');
    if (room.buyIn > 0 && user.coins < room.buyIn) return socket.emit('room:error', 'Saldo insuficiente');
    if (!room.players.find(p => p.username === username)) {
      room.players.push({ username, seatIndex: room.players.length, team: room.players.length < 2 ? 0 : 1, isBot: false });
      if (room.buyIn > 0) { user.coins -= room.buyIn; room.pot += room.buyIn; }
      socket.join(roomId);
      io.to(roomId).emit('room:update', room);
    }
  });

  socket.on('room:add-bot', () => {
    const username = state.onlineSockets[socket.id];
    const room = Object.values(state.rooms).find(r => r.host === username && !r.gameStarted);
    if (!room || room.players.length >= 4) return;
    const botNames = ['Bot_Azabache','Bot_Cibaeño','Bot_Capicúa','Bot_Tranca'];
    room.players.push({ username: botNames[room.players.length - 1] || 'Bot', seatIndex: room.players.length, team: room.players.length <= 1 ? 0 : 1, isBot: true });
    if (room.buyIn > 0) room.pot += room.buyIn;
    io.to(room.id).emit('room:update', room);
  });

  socket.on('room:start', () => {
    const username = state.onlineSockets[socket.id];
    const room = Object.values(state.rooms).find(r => r.host === username && !r.gameStarted);
    if (!room || room.players.length < 2) return socket.emit('room:error', 'Necesitas al menos 2 jugadores');
    // Fill remaining seats with bots
    const botNames = ['Bot_Azabache','Bot_Cibaeño','Bot_Capicúa','Bot_Tranca'];
    while (room.players.length < 4) {
      room.players.push({ username: botNames[room.players.length - 1], seatIndex: room.players.length, team: room.players.length < 2 ? 0 : 1, isBot: true });
    }
    startGame(room);
  });

  socket.on('game:play', ({ tile, side }) => {
    const username = state.onlineSockets[socket.id];
    if (!username) return;
    const room = Object.values(state.rooms).find(r => r.gameState && r.players.some(p => p.username === username));
    if (!room) return;
    const playerIdx = room.players.findIndex(p => p.username === username);
    if (room.gameState.currentPlayer !== playerIdx) return;
    if (placeTile(room.gameState, tile, side, playerIdx)) advanceTurn(room);
  });

  socket.on('game:pass', () => {
    const username = state.onlineSockets[socket.id];
    if (!username) return;
    const room = Object.values(state.rooms).find(r => r.gameState && r.players.some(p => p.username === username));
    if (!room) return;
    const playerIdx = room.players.findIndex(p => p.username === username);
    if (room.gameState.currentPlayer !== playerIdx) return;
    advanceTurn(room);
  });

  socket.on('chat:send', ({ message }) => {
    const username = state.onlineSockets[socket.id];
    if (!username || !message?.trim()) return;
    const room = Object.values(state.rooms).find(r => r.players.some(p => p.username === username));
    if (room) io.to(room.id).emit('chat:message', { username, message: message.trim().substring(0, 120) });
  });

  socket.on('friends:list', () => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    if (!user) return;
    const friends = (user.friends || []).map(f => ({ username: f, online: !!Object.values(state.onlineSockets).find(u => u === f.toLowerCase()) }));
    socket.emit('friends:list', friends);
    socket.emit('friends:requests', user.friendRequests || []);
  });

  socket.on('friends:add', ({ targetUsername }) => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    const target = state.users[targetUsername.toLowerCase()];
    if (!user || !target) return socket.emit('friends:error', 'Usuario no encontrado');
    if (!target.friendRequests) target.friendRequests = [];
    if (!target.friendRequests.includes(username)) {
      target.friendRequests.push(username);
      const targSock = Object.keys(state.onlineSockets).find(k => state.onlineSockets[k] === targetUsername.toLowerCase());
      if (targSock) io.to(targSock).emit('friends:request', { from: username });
      socket.emit('friends:request-sent');
    }
  });

  socket.on('friends:accept', ({ fromUsername }) => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    const from = state.users[fromUsername.toLowerCase()];
    if (!user || !from) return;
    user.friendRequests = (user.friendRequests || []).filter(r => r !== fromUsername.toLowerCase());
    if (!user.friends) user.friends = [];
    if (!from.friends) from.friends = [];
    if (!user.friends.includes(fromUsername.toLowerCase())) user.friends.push(fromUsername.toLowerCase());
    if (!from.friends.includes(username)) from.friends.push(username);
    socket.emit('friends:list', (user.friends || []).map(f => ({ username: f, online: !!Object.values(state.onlineSockets).find(u => u === f) })));
  });

  socket.on('practice:start', ({ level }) => {
    const username = state.onlineSockets[socket.id];
    const user = username ? state.users[username] : null;
    if (!user) return;
    const roomId = `PRAC-${socket.id.slice(0,6)}`;
    const room = {
      id: roomId, provinceId: null, buyIn: 0, isPractice: true, botLevel: level,
      players: [
        { username, seatIndex: 0, team: 0, isBot: false },
        { username: 'Bot_Fácil',   seatIndex: 1, team: 1, isBot: true },
        { username: 'Bot_Medio',   seatIndex: 2, team: 0, isBot: true },
        { username: 'Bot_Difícil', seatIndex: 3, team: 1, isBot: true },
      ],
      host: username, gameStarted: false, pot: 0, scores: [0,0], isPublic: false
    };
    state.rooms[roomId] = room;
    socket.join(roomId);
    startGame(room);
  });
});

// ── DOMINO ENGINE ──────────────────────────────────────────────
function generateDeck() {
  const deck = [];
  for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) deck.push([i, j]);
  return shuffle(deck);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getLegalMoves(hand, leftEnd, rightEnd) {
  if (leftEnd === null) return hand;
  return hand.filter(t => t[0]===leftEnd || t[1]===leftEnd || t[0]===rightEnd || t[1]===rightEnd);
}

function placeTile(gs, tile, side, playerIdx) {
  const hand = gs.hands[playerIdx];
  const idx = hand.findIndex(t => t[0]===tile[0] && t[1]===tile[1]);
  if (idx === -1) return false;
  if (gs.board.length === 0) {
    gs.leftEnd = tile[0]; gs.rightEnd = tile[1]; gs.board.push(tile); hand.splice(idx,1); return true;
  }
  if (side === 'left') {
    if (tile[1]===gs.leftEnd) { gs.board.unshift(tile); gs.leftEnd=tile[0]; }
    else if (tile[0]===gs.leftEnd) { gs.board.unshift([tile[1],tile[0]]); gs.leftEnd=tile[1]; }
    else return false;
  } else {
    if (tile[0]===gs.rightEnd) { gs.board.push(tile); gs.rightEnd=tile[1]; }
    else if (tile[1]===gs.rightEnd) { gs.board.push([tile[1],tile[0]]); gs.rightEnd=tile[0]; }
    else return false;
  }
  hand.splice(idx,1);
  return true;
}

function startGame(room) {
  room.gameStarted = true;
  const deck = generateDeck();
  const hands = [deck.slice(0,7), deck.slice(7,14), deck.slice(14,21), deck.slice(21,28)];
  let firstPlayer = 0;
  hands.forEach((h,i) => { if (h.some(t => t[0]===6&&t[1]===6)) firstPlayer=i; });
  room.gameState = { hands, board:[], leftEnd:null, rightEnd:null, currentPlayer:firstPlayer, scores:[0,0], passCount:0 };
  io.to(room.id).emit('match:start', { roomId: room.id });
  room.players.forEach((p,i) => {
    const sockId = Object.keys(state.onlineSockets).find(k => state.onlineSockets[k]===p.username.toLowerCase());
    if (sockId) { io.to(sockId).emit('game:state', getPlayerState(room,i)); if(i===firstPlayer) io.to(sockId).emit('timer:start',{seconds:45}); }
  });
  if (room.players[firstPlayer]?.isBot) scheduleBotMove(room, firstPlayer);
}

function getPlayerState(room, playerIdx) {
  const gs = room.gameState;
  return { board:gs.board, leftEnd:gs.leftEnd, rightEnd:gs.rightEnd, myHand:gs.hands[playerIdx], handCounts:gs.hands.map(h=>h.length), currentPlayer:gs.currentPlayer, legalMoves:getLegalMoves(gs.hands[playerIdx],gs.leftEnd,gs.rightEnd), scores:room.scores };
}

function advanceTurn(room) {
  const gs = room.gameState;
  const prev = gs.currentPlayer;
  if (gs.hands[prev].length === 0) { endRound(room, prev%2===0?0:1, 'normal'); return; }
  gs.currentPlayer = (gs.currentPlayer+1)%4;
  gs.passCount = 0;
  room.players.forEach((p,i) => {
    const sockId = Object.keys(state.onlineSockets).find(k => state.onlineSockets[k]===p.username.toLowerCase());
    if (sockId) { io.to(sockId).emit('game:state', getPlayerState(room,i)); if(i===gs.currentPlayer) io.to(sockId).emit('timer:start',{seconds:45}); }
  });
  const legal = getLegalMoves(gs.hands[gs.currentPlayer], gs.leftEnd, gs.rightEnd);
  if (legal.length === 0) {
    gs.passCount++;
    if (gs.passCount >= 4) {
      const teamSums = [0,1].map(team => room.players.filter(p=>p.team===team).reduce((sum,p)=>sum+gs.hands[room.players.indexOf(p)].reduce((s,t)=>s+t[0]+t[1],0),0));
      endRound(room, teamSums[0]<=teamSums[1]?0:1, 'tranca'); return;
    }
    setTimeout(()=>advanceTurn(room), 500); return;
  }
  if (room.players[gs.currentPlayer]?.isBot) scheduleBotMove(room, gs.currentPlayer);
}

function scheduleBotMove(room, botIdx, delay = 800) {
  setTimeout(() => {
    const gs = room.gameState;
    if (!gs || gs.currentPlayer!==botIdx) return;
    const legal = getLegalMoves(gs.hands[botIdx], gs.leftEnd, gs.rightEnd);
    if (legal.length===0) { advanceTurn(room); return; }
    const tile = legal[Math.floor(Math.random()*legal.length)];
    placeTile(gs, tile, Math.random()<0.5?'left':'right', botIdx);
    advanceTurn(room);
  }, delay + Math.random()*700);
}

function endRound(room, winnerTeam, type) {
  room.scores[winnerTeam]++;
  io.to(room.id).emit('round:end', { winnerTeam, type, scores:room.scores });
  if (room.scores[winnerTeam]>=6) { endMatch(room, winnerTeam, false); return; }
  setTimeout(()=>{ room.gameState=null; startGame(room); }, 2000);
}

function endMatch(room, winnerTeam, isPollona) {
  const pot = room.pot || 0;
  const winners = room.players.filter(p=>p.team===winnerTeam&&!p.isBot);
  const perPlayer = winners.length>0 ? Math.floor(pot/winners.length) : 0;
  winners.forEach(p => {
    const user = state.users[p.username.toLowerCase()];
    if (user&&!room.isPractice) {
      user.coins+=perPlayer; user.stats.wins=(user.stats.wins||0)+1;
      user.stats.earnings=(user.stats.earnings||0)+(perPlayer-room.buyIn);
      user.stats.games=(user.stats.games||0)+1;
      user.transactions.push({type:'win',amount:perPlayer-room.buyIn,date:new Date().toISOString()});
      const sockId=Object.keys(state.onlineSockets).find(k=>state.onlineSockets[k]===p.username.toLowerCase());
      if(sockId) io.to(sockId).emit('coins:update',user.coins);
    }
  });
  room.players.filter(p=>p.team!==winnerTeam&&!p.isBot).forEach(p=>{
    const user=state.users[p.username.toLowerCase()];
    if(user&&!room.isPractice){user.stats.games=(user.stats.games||0)+1;user.stats.earnings=(user.stats.earnings||0)-room.buyIn;user.transactions.push({type:'loss',amount:-room.buyIn,date:new Date().toISOString()});}
  });
  io.to(room.id).emit('match:end',{winnerTeam,isPollona,perPlayer,scores:room.scores});
  io.emit('leaderboard:update',getLeaderboard());
  saveState();
  setTimeout(()=>{ delete state.rooms[room.id]; },10000);
}

function getLeaderboard() {
  return Object.values(state.users).filter(u=>u.stats?.earnings>0).sort((a,b)=>b.stats.earnings-a.stats.earnings).slice(0,10).map(u=>({username:u.username,earnings:u.stats.earnings}));
}

// ── START ──────────────────────────────────────────────────────
loadState().then(() => {
  // Ensure support user exists
  if (!state.users[SUPPORT_USER]) {
    state.users[SUPPORT_USER] = {
      username: SUPPORT_USER, email: SUPPORT_EMAIL, phone: '',
      passwordHash: hashPassword(SUPPORT_PASS), token: generateToken(),
      coins: 0, isAdmin: false, isSupportAgent: true, verified: true, banned: false,
      friends: [], friendRequests: [], stats: {games:0,wins:0,earnings:0},
      transactions: [], createdAt: new Date().toISOString()
    };
    saveState();
  }
  server.listen(PORT, () => {
    console.log(`✅ DomiDom corriendo en puerto ${PORT}`);
    console.log(`   Admin: ${ADMIN_USER} | Soporte: ${SUPPORT_USER} / ${SUPPORT_PASS}`);
  });
});
