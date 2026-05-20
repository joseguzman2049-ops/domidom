'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

// ── Supabase (optional) ────────────────────────────────────────
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// ── Resend (optional) ──────────────────────────────────────────
let resend = null;
if (process.env.RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';

// ── In-memory state (persisted to Supabase) ────────────────────
let state = {
  users: {},
  rooms: {},
  queues: {},
  onlineCount: 0,
};

// ── Persistence ────────────────────────────────────────────────
async function saveState() {
  if (!supabase) return;
  await supabase.from('domidom_state').upsert({ id: 'main', data: state });
}

async function loadState() {
  if (!supabase) return;
  const { data } = await supabase.from('domidom_state').select('data').eq('id', 'main').single();
  if (data?.data) state = data.data;
}

// ── Auth helpers ───────────────────────────────────────────────
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getUserByToken(token) {
  return Object.values(state.users).find(u => u.token === token);
}

function getUserByUsername(username) {
  return state.users[username.toLowerCase()];
}

// ── Provinces config ───────────────────────────────────────────
const PROVINCES = [
  { id: 'santo-domingo', name: 'Santo Domingo', buyIn: 100, featured: false },
  { id: 'santiago',      name: 'Santiago',      buyIn: 250, featured: false },
  { id: 'la-vega',       name: 'La Vega',       buyIn: 500, featured: false },
  { id: 'san-pedro',     name: 'San Pedro',     buyIn: 1000, featured: false },
  { id: 'punta-cana',    name: 'Punta Cana',    buyIn: 2500, featured: true  },
];

// ── REST API ───────────────────────────────────────────────────

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, phone } = req.body;
  if (!username || !password || !email) return res.status(400).json({ error: 'Campos requeridos' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Usuario debe tener 3-20 caracteres' });
  if (getUserByUsername(username)) return res.status(400).json({ error: 'Usuario ya existe' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const verifyCode = generateCode();
  const key = username.toLowerCase();

  state.users[key] = {
    username,
    email,
    phone: phone || '',
    passwordHash: hash,
    salt,
    verifyCode,
    verified: false,
    token: null,
    coins: 1000,
    isAdmin: username.toLowerCase() === ADMIN_USER.toLowerCase(),
    banned: false,
    stats: { games: 0, wins: 0, earnings: 0 },
    transactions: [],
    createdAt: Date.now(),
  };

  await saveState();

  // Send verification email
  if (resend && process.env.EMAIL_FROM) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'DomiDom — Verifica tu cuenta',
      html: `<h2>¡Bienvenido a DomiDom!</h2><p>Tu código de verificación es: <strong style="font-size:24px">${verifyCode}</strong></p>`,
    }).catch(() => {});
  }

  res.json({ needsVerification: true });
});

// Verify
app.post('/api/auth/verify', async (req, res) => {
  const { username, code } = req.body;
  const user = getUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.verified) return res.status(400).json({ error: 'Ya verificado' });
  if (user.verifyCode !== code) return res.status(400).json({ error: 'Código incorrecto' });

  user.verified = true;
  user.token = generateToken();
  await saveState();
  res.json({ token: user.token, username: user.username, coins: user.coins, isAdmin: user.isAdmin, stats: user.stats });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = getUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  if (!user.verified) return res.status(403).json({ error: 'Cuenta no verificada' });
  if (user.banned) return res.status(403).json({ error: 'Cuenta suspendida' });

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  user.token = generateToken();
  await saveState();
  res.json({ token: user.token, username: user.username, coins: user.coins, isAdmin: user.isAdmin, stats: user.stats });
});

// Me
app.get('/api/me', (req, res) => {
  const user = getUserByToken(req.headers['x-token']);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  res.json({
    username: user.username,
    email: user.email,
    coins: user.coins,
    isAdmin: user.isAdmin,
    stats: user.stats,
    transactions: user.transactions || [],
  });
});

// Provinces
app.get('/api/provinces', (req, res) => {
  const result = PROVINCES.map(p => ({
    ...p,
    playersInQueue: (state.queues[p.id] || []).length,
    activeTables: Object.values(state.rooms).filter(r => r.provinceId === p.id && r.started).length,
  }));
  res.json(result);
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const users = Object.values(state.users)
    .filter(u => u.verified && !u.banned)
    .sort((a, b) => (b.stats?.earnings || 0) - (a.stats?.earnings || 0))
    .slice(0, 10)
    .map(u => ({ username: u.username, earnings: u.stats?.earnings || 0, wins: u.stats?.wins || 0 }));
  res.json(users);
});

// Online count
app.get('/api/online', (req, res) => {
  res.json({ count: state.onlineCount });
});

// Admin — list users
app.get('/api/admin/users', (req, res) => {
  const caller = getUserByToken(req.headers['x-token']);
  if (!caller?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const users = Object.values(state.users).map(u => ({
    username: u.username,
    email: u.email,
    coins: u.coins,
    stats: u.stats,
    banned: u.banned,
    verified: u.verified,
  }));
  res.json(users);
});

// Admin — grant/take coins
app.post('/api/admin/grant', async (req, res) => {
  const caller = getUserByToken(req.headers['x-token']);
  if (!caller?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const { username, amount, action } = req.body;
  const user = getUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const delta = action === 'take' ? -amount : amount;
  user.coins = Math.max(0, user.coins + delta);
  user.transactions = user.transactions || [];
  user.transactions.push({ type: delta > 0 ? 'admin_credit' : 'admin_debit', amount: delta, date: Date.now() });
  await saveState();
  res.json({ ok: true });
});

// Admin — ban/unban
app.post('/api/admin/ban', async (req, res) => {
  const caller = getUserByToken(req.headers['x-token']);
  if (!caller?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const { username, banned } = req.body;
  const user = getUserByUsername(username);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  user.banned = banned;
  await saveState();
  res.json({ ok: true });
});

// Fallback → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Socket.IO ──────────────────────────────────────────────────
const socketUsers = new Map(); // socketId → username

io.on('connection', (socket) => {
  state.onlineCount = io.engine.clientsCount;
  io.emit('online:count', state.onlineCount);

  socket.on('auth', ({ token }) => {
    const user = getUserByToken(token);
    if (!user || user.banned) { socket.emit('auth:error', 'No autorizado'); return; }
    socketUsers.set(socket.id, user.username.toLowerCase());
    socket.emit('auth:ok', { username: user.username, coins: user.coins, isAdmin: user.isAdmin });
  });

  // ── Queue ──────────────────────────────────────────────────
  socket.on('queue:join', ({ provinceId }) => {
    const username = socketUsers.get(socket.id);
    if (!username) return;
    const user = getUserByUsername(username);
    if (!user) return;

    const province = PROVINCES.find(p => p.id === provinceId);
    if (!province) { socket.emit('queue:error', 'Provincia no encontrada'); return; }
    if (user.coins < province.buyIn) { socket.emit('queue:error', 'Saldo insuficiente'); return; }

    if (!state.queues[provinceId]) state.queues[provinceId] = [];
    if (!state.queues[provinceId].includes(username)) {
      state.queues[provinceId].push(username);
    }

    socket.emit('queue:joined', { province });

    // Try to start a match
    if (state.queues[provinceId].length >= 4) {
      const players = state.queues[provinceId].splice(0, 4);
      createMatch(provinceId, province.buyIn, players, false);
    }
  });

  socket.on('queue:leave', ({ provinceId }) => {
    const username = socketUsers.get(socket.id);
    if (state.queues[provinceId]) {
      state.queues[provinceId] = state.queues[provinceId].filter(u => u !== username);
    }
  });

  // ── Friend rooms ───────────────────────────────────────────
  socket.on('room:create', ({ buyIn }) => {
    const username = socketUsers.get(socket.id);
    if (!username) return;
    const roomId = 'DOMI-' + Math.random().toString(36).substr(2, 4).toUpperCase();
    state.rooms[roomId] = {
      id: roomId,
      host: username,
      players: [{ username, seatIndex: 0, team: 0, isBot: false }],
      buyIn: buyIn || 0,
      pot: 0,
      started: false,
      provinceId: null,
    };
    socket.join(roomId);
    socket.emit('room:created', { roomId });
    io.to(roomId).emit('room:update', state.rooms[roomId]);
  });

  socket.on('room:join', ({ roomId }) => {
    const username = socketUsers.get(socket.id);
    if (!username) return;
    const room = state.rooms[roomId];
    if (!room) { socket.emit('room:error', 'Sala no encontrada'); return; }
    if (room.started) { socket.emit('room:error', 'La partida ya comenzó'); return; }
    if (room.players.length >= 4) { socket.emit('room:error', 'Sala llena'); return; }

    const seatIndex = room.players.length;
    room.players.push({ username, seatIndex, team: seatIndex < 2 ? 0 : 1, isBot: false });
    socket.join(roomId);
    io.to(roomId).emit('room:update', room);
  });

  socket.on('room:add-bot', () => {
    const username = socketUsers.get(socket.id);
    const room = Object.values(state.rooms).find(r => r.host === username && !r.started);
    if (!room || room.players.length >= 4) return;
    const seatIndex = room.players.length;
    room.players.push({ username: `Bot${seatIndex}`, seatIndex, team: seatIndex < 2 ? 0 : 1, isBot: true });
    io.to(room.id).emit('room:update', room);
  });

  socket.on('room:start', () => {
    const username = socketUsers.get(socket.id);
    const room = Object.values(state.rooms).find(r => r.host === username && !r.started);
    if (!room) return;
    if (room.players.length < 4) { socket.emit('room:error', 'Necesitas 4 jugadores'); return; }
    startGameInRoom(room);
  });

  // ── Game actions ───────────────────────────────────────────
  socket.on('game:play', ({ tile, side }) => {
    const username = socketUsers.get(socket.id);
    const room = findRoomByPlayer(username);
    if (!room?.game) return;
    handlePlay(room, username, tile, side);
  });

  socket.on('game:pass', () => {
    const username = socketUsers.get(socket.id);
    const room = findRoomByPlayer(username);
    if (!room?.game) return;
    handlePass(room, username);
  });

  // ── Practice ───────────────────────────────────────────────
  socket.on('practice:start', ({ level }) => {
    const username = socketUsers.get(socket.id);
    if (!username) return;
    const practiceId = 'PRAC-' + socket.id;
    state.rooms[practiceId] = {
      id: practiceId,
      host: username,
      players: [
        { username, seatIndex: 0, team: 0, isBot: false },
        { username: 'Bot1', seatIndex: 1, team: 0, isBot: true },
        { username: 'Bot2', seatIndex: 2, team: 1, isBot: true },
        { username: 'Bot3', seatIndex: 3, team: 1, isBot: true },
      ],
      buyIn: 0,
      pot: 0,
      started: false,
      provinceId: null,
      isPractice: true,
    };
    socket.join(practiceId);
    startGameInRoom(state.rooms[practiceId]);
  });

  // ── Chat ───────────────────────────────────────────────────
  socket.on('chat:send', ({ message }) => {
    const username = socketUsers.get(socket.id);
    if (!username || !message?.trim()) return;
    const room = findRoomByPlayer(username);
    if (!room) return;
    io.to(room.id).emit('chat:message', { username, message: message.trim().slice(0, 120) });
  });

  // ── Friends ────────────────────────────────────────────────
  socket.on('friends:list', () => {
    const username = socketUsers.get(socket.id);
    const user = getUserByUsername(username);
    if (!user) return;
    const friends = (user.friends || []).map(f => {
      const fu = getUserByUsername(f);
      return { username: fu?.username || f, online: [...socketUsers.values()].includes(f) };
    });
    socket.emit('friends:list', friends);
    socket.emit('friends:requests', user.friendRequests || []);
  });

  socket.on('friends:add', ({ targetUsername }) => {
    const username = socketUsers.get(socket.id);
    const target = getUserByUsername(targetUsername);
    if (!target) { socket.emit('friends:error', 'Usuario no encontrado'); return; }
    if (target.username.toLowerCase() === username) { socket.emit('friends:error', 'No puedes agregarte a ti mismo'); return; }
    target.friendRequests = target.friendRequests || [];
    if (!target.friendRequests.includes(username)) target.friendRequests.push(username);
    // Notify target if online
    const targetSocket = findSocketByUsername(targetUsername);
    if (targetSocket) targetSocket.emit('friends:request', { from: username });
    socket.emit('friends:request-sent');
    saveState();
  });

  socket.on('friends:accept', ({ fromUsername }) => {
    const username = socketUsers.get(socket.id);
    const user = getUserByUsername(username);
    if (!user) return;
    user.friendRequests = (user.friendRequests || []).filter(f => f !== fromUsername.toLowerCase());
    user.friends = user.friends || [];
    if (!user.friends.includes(fromUsername.toLowerCase())) user.friends.push(fromUsername.toLowerCase());
    const other = getUserByUsername(fromUsername);
    if (other) {
      other.friends = other.friends || [];
      if (!other.friends.includes(username)) other.friends.push(username);
    }
    saveState();
    socket.emit('friends:list', (user.friends || []).map(f => ({ username: f, online: [...socketUsers.values()].includes(f) })));
  });

  // ── Disconnect ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    socketUsers.delete(socket.id);
    state.onlineCount = io.engine.clientsCount;
    io.emit('online:count', state.onlineCount);
  });
});

// ── Game Engine ────────────────────────────────────────────────
function generateDominoes() {
  const tiles = [];
  for (let i = 0; i <= 6; i++)
    for (let j = i; j <= 6; j++)
      tiles.push([i, j]);
  return tiles.sort(() => Math.random() - 0.5);
}

function createMatch(provinceId, buyIn, playerUsernames, isPractice) {
  const roomId = 'MATCH-' + Date.now();
  const room = {
    id: roomId,
    host: playerUsernames[0],
    players: playerUsernames.map((u, i) => ({ username: u, seatIndex: i, team: i < 2 ? 0 : 1, isBot: false })),
    buyIn,
    pot: buyIn * 4,
    started: false,
    provinceId,
    isPractice,
  };
  state.rooms[roomId] = room;

  // Charge buy-in
  if (!isPractice) {
    playerUsernames.forEach(u => {
      const user = getUserByUsername(u);
      if (user) {
        user.coins = Math.max(0, user.coins - buyIn);
        user.transactions = user.transactions || [];
        user.transactions.push({ type: 'loss', amount: -buyIn, date: Date.now() });
        const s = findSocketByUsername(u);
        if (s) { s.join(roomId); s.emit('coins:update', user.coins); }
      }
    });
  }

  startGameInRoom(room);
  saveState();
}

function startGameInRoom(room) {
  const tiles = generateDominoes();
  const hands = [tiles.slice(0, 7), tiles.slice(7, 14), tiles.slice(14, 21), tiles.slice(21, 28)];
  room.started = true;
  room.game = {
    hands,
    board: [],
    leftEnd: null,
    rightEnd: null,
    currentPlayer: 0,
    scores: [0, 0],
    passCount: 0,
    roundsPlayed: 0,
  };

  io.to(room.id).emit('match:start', { roomId: room.id });

  room.players.forEach((p, idx) => {
    if (!p.isBot) {
      const s = findSocketByUsername(p.username);
      if (s) s.emit('game:state', buildStateForPlayer(room, idx));
    }
  });

  startTimer(room);
  if (room.players[room.game.currentPlayer]?.isBot) setTimeout(() => doBotPlay(room), 1200);
}

function buildStateForPlayer(room, playerIdx) {
  const g = room.game;
  const handCounts = g.hands.map(h => h.length);
  return {
    myHand: g.hands[playerIdx],
    board: g.board,
    leftEnd: g.leftEnd,
    rightEnd: g.rightEnd,
    currentPlayer: g.currentPlayer,
    scores: g.scores,
    handCounts,
    legalMoves: getLegalMoves(g.hands[playerIdx], g),
  };
}

function getLegalMoves(hand, g) {
  if (g.board.length === 0) return hand;
  return hand.filter(t => t[0] === g.leftEnd || t[1] === g.leftEnd || t[0] === g.rightEnd || t[1] === g.rightEnd);
}

function handlePlay(room, username, tile, side) {
  const g = room.game;
  const playerIdx = room.players.findIndex(p => p.username.toLowerCase() === username);
  if (playerIdx !== g.currentPlayer) return;

  const hand = g.hands[playerIdx];
  const tileIdx = hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1]);
  if (tileIdx === -1) return;

  // Place tile
  if (g.board.length === 0) {
    g.board.push(tile);
    g.leftEnd = tile[0];
    g.rightEnd = tile[1];
  } else if (side === 'left') {
    if (tile[1] === g.leftEnd) { g.board.unshift(tile); g.leftEnd = tile[0]; }
    else if (tile[0] === g.leftEnd) { g.board.unshift([tile[1], tile[0]]); g.leftEnd = tile[1]; }
    else return;
  } else {
    if (tile[0] === g.rightEnd) { g.board.push(tile); g.rightEnd = tile[1]; }
    else if (tile[1] === g.rightEnd) { g.board.push([tile[1], tile[0]]); g.rightEnd = tile[0]; }
    else return;
  }

  hand.splice(tileIdx, 1);
  g.passCount = 0;

  // Check capicua
  const isCapicua = hand.length === 0 && g.leftEnd === g.rightEnd;

  // Check win
  if (hand.length === 0) {
    endRound(room, room.players[playerIdx].team, isCapicua ? 'capicua' : 'normal');
    return;
  }

  clearTimeout(room._timer);
  g.currentPlayer = (g.currentPlayer + 1) % 4;
  broadcastState(room);
  startTimer(room);
  if (room.players[g.currentPlayer]?.isBot) setTimeout(() => doBotPlay(room), 1000);
}

function handlePass(room, username) {
  const g = room.game;
  const playerIdx = room.players.findIndex(p => p.username.toLowerCase() === username);
  if (playerIdx !== g.currentPlayer) return;
  const legal = getLegalMoves(g.hands[playerIdx], g);
  if (legal.length > 0) return;

  g.passCount++;
  if (g.passCount >= 4) {
    endRound(room, -1, 'tranca');
    return;
  }
  g.currentPlayer = (g.currentPlayer + 1) % 4;
  broadcastState(room);
  startTimer(room);
  if (room.players[g.currentPlayer]?.isBot) setTimeout(() => doBotPlay(room), 1000);
}

function doBotPlay(room) {
  const g = room.game;
  if (!room.started || !g) return;
  const playerIdx = g.currentPlayer;
  if (!room.players[playerIdx]?.isBot) return;

  const hand = g.hands[playerIdx];
  const legal = getLegalMoves(hand, g);

  if (legal.length === 0) {
    handlePass(room, room.players[playerIdx].username);
    return;
  }

  const tile = legal[Math.floor(Math.random() * legal.length)];
  const side = Math.random() < 0.5 ? 'left' : 'right';
  handlePlay(room, room.players[playerIdx].username, tile, side);
}

function endRound(room, winnerTeam, type) {
  const g = room.game;
  clearTimeout(room._timer);

  if (winnerTeam >= 0) g.scores[winnerTeam]++;
  else {
    // tranca — team with fewest pips wins
    const pips = [0, 1, 2, 3].map(i => g.hands[i].reduce((s, t) => s + t[0] + t[1], 0));
    const teamPips = [pips[0] + pips[1], pips[2] + pips[3]];
    g.scores[teamPips[0] <= teamPips[1] ? 0 : 1]++;
    winnerTeam = teamPips[0] <= teamPips[1] ? 0 : 1;
  }

  io.to(room.id).emit('round:end', { type, winnerTeam });

  // Check match end (first to 6)
  const matchWinner = g.scores.findIndex(s => s >= 6);
  if (matchWinner >= 0) {
    endMatch(room, matchWinner, type);
    return;
  }

  // Next round
  setTimeout(() => {
    const tiles = generateDominoes();
    g.hands = [tiles.slice(0, 7), tiles.slice(7, 14), tiles.slice(14, 21), tiles.slice(21, 28)];
    g.board = [];
    g.leftEnd = null;
    g.rightEnd = null;
    g.passCount = 0;
    g.roundsPlayed++;
    g.currentPlayer = g.roundsPlayed % 4;
    broadcastState(room);
    startTimer(room);
    if (room.players[g.currentPlayer]?.isBot) setTimeout(() => doBotPlay(room), 1200);
  }, 3000);
}

function endMatch(room, winnerTeam, type) {
  const isPollona = room.game.scores[winnerTeam] === 6 && room.game.scores[1 - winnerTeam] === 0;
  const pot = room.pot || 0;
  const perPlayer = Math.floor(pot / 2);

  if (!room.isPractice) {
    room.players.forEach((p, idx) => {
      if (p.isBot) return;
      const user = getUserByUsername(p.username);
      if (!user) return;
      if (p.team === winnerTeam) {
        user.coins += perPlayer;
        user.stats.wins++;
        user.stats.earnings += perPlayer;
        user.transactions.push({ type: 'win', amount: perPlayer, date: Date.now() });
        const s = findSocketByUsername(p.username);
        if (s) s.emit('coins:update', user.coins);
      }
      user.stats.games++;
    });
    saveState();
  }

  io.to(room.id).emit('match:end', {
    winnerTeam,
    scores: room.game.scores,
    perPlayer,
    isPollona,
    type,
  });

  io.emit('leaderboard:update', Object.values(state.users)
    .filter(u => u.verified)
    .sort((a, b) => (b.stats?.earnings || 0) - (a.stats?.earnings || 0))
    .slice(0, 10)
    .map(u => ({ username: u.username, earnings: u.stats?.earnings || 0 })));

  setTimeout(() => { delete state.rooms[room.id]; }, 30000);
}

function broadcastState(room) {
  room.players.forEach((p, idx) => {
    if (!p.isBot) {
      const s = findSocketByUsername(p.username);
      if (s) s.emit('game:state', buildStateForPlayer(room, idx));
    }
  });
}

let roomTimers = {};
function startTimer(room) {
  clearTimeout(room._timer);
  const seconds = 45;
  io.to(room.id).emit('timer:start', { seconds });
  room._timer = setTimeout(() => {
    const g = room.game;
    if (!g) return;
    const p = room.players[g.currentPlayer];
    if (p?.isBot) { doBotPlay(room); return; }
    // Auto-pass or auto-play first legal
    const legal = getLegalMoves(g.hands[g.currentPlayer], g);
    if (legal.length > 0) {
      handlePlay(room, p.username, legal[0], 'right');
    } else {
      handlePass(room, p.username);
    }
  }, seconds * 1000);
}

function findRoomByPlayer(username) {
  return Object.values(state.rooms).find(r => r.players?.some(p => p.username.toLowerCase() === username));
}

function findSocketByUsername(username) {
  for (const [sid, uname] of socketUsers.entries()) {
    if (uname === username.toLowerCase()) {
      return io.sockets.sockets.get(sid);
    }
  }
  return null;
}

// ── Start ──────────────────────────────────────────────────────
loadState().then(() => {
  server.listen(PORT, () => console.log(`DomiDom server running on port ${PORT}`));
});
