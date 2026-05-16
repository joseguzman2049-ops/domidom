/* ============================================================
   DOMI DOM · SERVIDOR ONLINE  (autoritativo)
   ------------------------------------------------------------
   El servidor es el ÁRBITRO: reparte fichas, valida turnos y
   jugadas, lleva el puntaje, hace matchmaking y maneja salas,
   chat, billetera y leaderboard. El cliente NUNCA decide reglas.

   Correr local:
     1) npm install
     2) npm start
     3) abrir http://localhost:3000 en varias pestañas/telefonos

   Cuentas/billetera/leaderboard viven EN MEMORIA: se reinician
   si el servidor se reinicia. El upgrade a base de datos real
   (Supabase) está explicado en el README.
   ============================================================ */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- CUENTAS (memoria) ---------------- */
const accounts = {}; // user -> { user, pass, wallet, net, games, wins }
const coinRequests = {}; // user -> { user, note, t }  (solicitudes pendientes)
function pubAcc(u){ const a=accounts[u]; return a&&{ user:a.user, wallet:a.wallet, net:a.net, games:a.games, wins:a.wins }; }
function leaderboard(){
  return Object.values(accounts)
    .sort((x,y)=>y.net-x.net).slice(0,20)
    .map(a=>({ user:a.user, net:a.net, wins:a.wins, games:a.games }));
}

/* ---------------- MOTOR DE DOMINÓ ---------------- */
function buildDeck(){ const d=[]; for(let a=0;a<=6;a++) for(let b=a;b<=6;b++) d.push([a,b]); return d; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pips(t){ return t[0]+t[1]; }
function handPips(h){ return h.reduce((s,t)=>s+pips(t),0); }
function teamOf(seat){ return seat%2===0?'A':'B'; }
function canPlay(t,L,R){ if(L===null) return true; return t.includes(L)||t.includes(R); }
function orient(t,val,left){ if(left) return t[1]===val?[t[0],t[1]]:[t[1],t[0]]; return t[0]===val?[t[0],t[1]]:[t[1],t[0]]; }

function newHand(g, first){
  const deck=shuffle(buildDeck());
  g.hands=[[],[],[],[]];
  for(let i=0;i<28;i++) g.hands[i%4].push(deck[i]);
  g.board=[]; g.left=null; g.right=null; g.passes=0; g.lastIdx=-1;
  g.firstHand=first;
  if(first){ for(let s=0;s<4;s++) if(g.hands[s].some(t=>t[0]===6&&t[1]===6)){ g.starter=s; break; } }
  g.turn=g.starter;
  g.phase='play';
}

function legalIdx(g,seat){
  const h=g.hands[seat], out=[];
  h.forEach((t,i)=>{
    const ok=(g.firstHand&&g.board.length===0)?(t[0]===6&&t[1]===6):canPlay(t,g.left,g.right);
    if(ok) out.push(i);
  });
  return out;
}
function seatHasMove(g,seat){ return legalIdx(g,seat).length>0; }

// IA sencilla y JUSTA para multijugador (rellenar / desconectados)
function botPick(g,seat){
  const legal=legalIdx(g,seat);
  if(!legal.length) return null;
  let best=legal[0], bs=-1;
  for(const i of legal){
    const t=g.hands[seat][i];
    let sc=pips(t)+(t[0]===t[1]?6:0);
    if(sc>bs){ bs=sc; best=i; }
  }
  const t=g.hands[seat][best];
  let side='R';
  if(g.board.length){ side=t.includes(g.right)?'R':'L'; }
  return { idx:best, side };
}

function applyPlay(g,seat,idx,side){
  const t=g.hands[seat][idx];
  const fitBoth = g.board.length>0 && t.includes(g.left) && t.includes(g.right) && g.left!==g.right;
  if(g.board.length===0){ g.board=[[t[0],t[1]]]; g.left=t[0]; g.right=t[1]; g.lastIdx=0; }
  else if(side==='L'){ const o=orient(t,g.left,true); g.board.unshift(o); g.left=o[0]; g.lastIdx=0; }
  else { const o=orient(t,g.right,false); g.board.push(o); g.right=o[1]; g.lastIdx=g.board.length-1; }
  g.hands[seat].splice(idx,1);
  g.passes=0;
  return fitBoth;
}

/* ---------------- SALAS ---------------- */
const rooms={};      // code -> room
const queue=[];      // matchmaking
const QUEUE_BOT_MS=14000; // si no se llenan humanos, completar con bots

function makeCode(){
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c='';
  for(let i=0;i<4;i++) c+=A[(Math.random()*A.length)|0];
  return 'DOMI-'+c;
}
function freshRoom(code,buyin){
  return { code, buyin:buyin||1000, pote:0,
    seats:[null,null,null,null], hostId:null,
    g:{ hands:[[],[],[],[]], board:[], left:null, right:null, turn:0, starter:0,
        passes:0, lastIdx:-1, firstHand:true, phase:'lobby', scoreA:0, scoreB:0 },
    chat:[] };
}
function roomState(code){
  const r=rooms[code]; if(!r) return null;
  return { code:r.code, buyin:r.buyin, pote:r.pote,
    seats:r.seats.map(s=>s?{ name:s.name, bot:!!s.bot, conn:!!s.conn }:null),
    full:r.seats.every(Boolean),
    phase:r.g.phase, scoreA:r.g.scoreA, scoreB:r.g.scoreB };
}
function gameView(r,seat){
  const g=r.g;
  return {
    phase:g.phase, board:g.board, left:g.left, right:g.right,
    turn:g.turn, lastIdx:g.lastIdx, firstHand:g.firstHand,
    scoreA:g.scoreA, scoreB:g.scoreB, pote:r.pote, buyin:r.buyin,
    seats:r.seats.map((s,i)=>s?{ name:s.name, bot:!!s.bot, conn:!!s.conn, count:g.hands[i].length }:null),
    yourSeat:seat, yourHand:seat!=null?g.hands[seat]:[],
    legal:seat!=null?legalIdx(g,seat):[]
  };
}
function pushGame(code){
  const r=rooms[code]; if(!r) return;
  r.seats.forEach((s,i)=>{ if(s&&s.id&&!s.bot) io.to(s.id).emit('game', gameView(r,i)); });
}
function sys(code,text){ const r=rooms[code]; if(!r) return; io.to(code).emit('chat',{sys:true,text}); }

/* ---------------- FLUJO DE PARTIDA ---------------- */
function startMatch(code){
  const r=rooms[code]; if(!r||!r.seats.every(Boolean)) return;
  r.pote=r.buyin*4;
  r.g.scoreA=0; r.g.scoreB=0; r.g.starter=0;
  r.seats.forEach(s=>{ if(s&&!s.bot&&accounts[s.user]) accounts[s.user].wallet-=r.buyin; });
  sys(code,`Partida iniciada. Pote ${r.pote} · a 200 puntos.`);
  newHand(r.g,true);
  io.to(code).emit('matchStarted');
  pushGame(code);
  io.to(code).emit('room', roomState(code));
  driveBots(code);
}
function nextTurn(code){
  const r=rooms[code]; if(!r) return; const g=r.g;
  if(g.phase!=='play') return;
  let guard=0;
  while(guard++<8){
    g.turn=(g.turn+1)%4;
    if(seatHasMove(g,g.turn)){ pushGame(code); driveBots(code); return; }
    g.passes++;
    sys(code,`${r.seats[g.turn].name} pasó.`);
    if(g.passes>=4){ return resolveTranca(code); }
  }
}
function afterPlay(code,seat,fitBoth){
  const r=rooms[code], g=r.g;
  if(g.hands[seat].length===0){ return resolveWin(code,seat,fitBoth); }
  nextTurn(code);
}
function resolveWin(code,w,cap){
  const r=rooms[code], g=r.g, wT=teamOf(w);
  let pts=0; for(let s=0;s<4;s++) if(teamOf(s)!==wT) pts+=handPips(g.hands[s]);
  if(cap) pts+=25;
  award(code,wT,pts,`${r.seats[w].name} se pegó`+(cap?' ¡CAPICÚA! (+25)':''));
}
function resolveTranca(code){
  const r=rooms[code], g=r.g;
  const a=handPips(g.hands[0])+handPips(g.hands[2]);
  const b=handPips(g.hands[1])+handPips(g.hands[3]);
  if(a===b){ sys(code,`Tranca empatada (${a}-${b}). Se repite la mano.`); g.starter=g.turn; newHand(g,false); pushGame(code); return driveBots(code); }
  const win=a<b?'A':'B';
  award(code,win,Math.max(a,b),`Tranca · Equipo ${win} con menos (${Math.min(a,b)})`);
}
function award(code,team,pts,reason){
  const r=rooms[code], g=r.g;
  if(team==='A') g.scoreA+=pts; else g.scoreB+=pts;
  sys(code,`${reason}: +${pts} Equipo ${team}. (${g.scoreA}-${g.scoreB})`);
  if(g.scoreA>=200||g.scoreB>=200){ return endMatch(code, g.scoreA>=200?'A':'B'); }
  g.starter = team==='A'?0:1;
  g.phase='handover';
  pushGame(code);
  io.to(code).emit('handOver',{ scoreA:g.scoreA, scoreB:g.scoreB });
  setTimeout(()=>{ if(!rooms[code]) return; newHand(g,false); g.phase='play'; pushGame(code); driveBots(code); }, 3200);
}
function endMatch(code,team){
  const r=rooms[code], g=r.g;
  const winners=team==='A'?[0,2]:[1,3], losers=team==='A'?[1,3]:[0,2];
  const skunk=(team==='A'?g.scoreB:g.scoreA)===0;
  const share=r.pote/2;
  winners.forEach(s=>{ const p=r.seats[s]; if(p&&!p.bot&&accounts[p.user]){ const A=accounts[p.user]; A.wallet+=share; A.net+=share-r.buyin; A.games++; A.wins++; } });
  losers.forEach(s=>{ const p=r.seats[s]; if(p&&!p.bot&&accounts[p.user]){ const A=accounts[p.user]; A.net-=r.buyin; A.games++; } });
  g.phase='over';
  sys(code,`🏆 Equipo ${team} gana ${g.scoreA}-${g.scoreB}${skunk?' ¡POLLONA!':''}.`);
  r.seats.forEach((s,i)=>{ if(s&&!s.bot&&accounts[s.user]) io.to(s.id).emit('matchOver',{ team, won:winners.includes(i), skunk, scoreA:g.scoreA, scoreB:g.scoreB, acc:pubAcc(s.user) }); });
  io.emit('leaderboard', leaderboard());
  r.pote=0;
  setTimeout(()=>{ if(rooms[code]){ rooms[code].g.phase='lobby'; io.to(code).emit('room', roomState(code)); } }, 800);
}

function driveBots(code){
  const r=rooms[code]; if(!r) return; const g=r.g;
  if(g.phase!=='play') return;
  const s=g.turn, seat=r.seats[s];
  if(!seat) return;
  if(seat.bot || !seat.conn){
    setTimeout(()=>{
      if(!rooms[code]||g.phase!=='play'||g.turn!==s) return;
      const mv=botPick(g,s);
      if(!mv){ g.passes++; sys(code,`${seat.name} pasó.`); if(g.passes>=4) return resolveTranca(code); return nextTurn(code); }
      const fb=applyPlay(g,s,mv.idx,mv.side);
      sys(code,`${seat.name} jugó una ficha.`);
      pushGame(code);
      afterPlay(code,s,fb);
    }, 900);
  }
}

/* ---------------- SOCKETS ---------------- */
io.on('connection',(socket)=>{

  socket.on('register',({user,pass},cb)=>{
    user=(user||'').trim();
    if(!user||!pass) return cb&&cb({ok:false,error:'Faltan datos'});
    if(accounts[user]) return cb&&cb({ok:false,error:'Ese usuario ya existe'});
    accounts[user]={ user, pass, wallet:0, net:0, games:0, wins:0 };
    socket.data.user=user;
    cb&&cb({ok:true, acc:pubAcc(user)});
    io.emit('leaderboard', leaderboard());
  });

  socket.on('login',({user,pass},cb)=>{
    const a=accounts[user];
    if(!a||a.pass!==pass) return cb&&cb({ok:false,error:'Usuario o clave incorrectos'});
    socket.data.user=user;
    cb&&cb({ok:true, acc:pubAcc(user)});
  });

  socket.on('getLeaderboard',()=>socket.emit('leaderboard', leaderboard()));

  // ----- SOLICITUDES DE MONEDAS -----
  socket.on('requestCoins',({note},cb)=>{
    const user=socket.data.user; if(!user) return cb&&cb({ok:false,error:'Inicia sesión'});
    coinRequests[user]={ user, note:(''+(note||'')).slice(0,160), t:Date.now() };
    console.log(`[SOLICITUD] ${user}: ${coinRequests[user].note}`);
    cb&&cb({ok:true});
  });
  socket.on('adminRequests',({key},cb)=>{
    if(!process.env.ADMIN_KEY) return cb&&cb({ok:false,error:'Falta ADMIN_KEY en Render (ver README).'});
    if(key!==process.env.ADMIN_KEY) return cb&&cb({ok:false,error:'Clave de admin incorrecta.'});
    const list=Object.values(coinRequests).sort((a,b)=>a.t-b.t);
    cb&&cb({ok:true, list});
  });

  // ----- ADMIN: regalar monedas de juego -----
  socket.on('adminGrant',({key,target,amount},cb)=>{
    if(!process.env.ADMIN_KEY) return cb&&cb({ok:false,error:'Falta configurar ADMIN_KEY en Render (ver README).'});
    if(key!==process.env.ADMIN_KEY) return cb&&cb({ok:false,error:'Clave de admin incorrecta.'});
    const a=accounts[(target||'').trim()];
    if(!a) return cb&&cb({ok:false,error:'Ese usuario no existe (debe haber entrado al menos una vez).'});
    const n=Math.round(Number(amount));
    if(!Number.isFinite(n)||n===0) return cb&&cb({ok:false,error:'Cantidad inválida.'});
    a.wallet=Math.max(0,a.wallet+n);
    delete coinRequests[a.user];
    console.log(`[ADMIN] ${n>0?'+':''}${n} monedas a ${a.user} (nuevo saldo ${a.wallet})`);
    cb&&cb({ok:true, user:a.user, wallet:a.wallet});
    // si está conectado, actualízale el saldo en pantalla
    for(const [,s] of io.sockets.sockets) if(s.data&&s.data.user===a.user) s.emit('walletUpdate',{wallet:a.wallet});
    io.emit('leaderboard', leaderboard());
  });

  // ----- MATCHMAKING -----
  socket.on('findMatch',({buyin},cb)=>{
    const user=socket.data.user; if(!user) return cb&&cb({ok:false,error:'Inicia sesión'});
    if(accounts[user].wallet<buyin) return cb&&cb({ok:false,error:'Monedas insuficientes para esa mesa'});
    if(queue.find(q=>q.id===socket.id)) return cb&&cb({ok:true});
    queue.push({ id:socket.id, user, buyin, t:Date.now() });
    cb&&cb({ok:true});
    const n=queue.filter(q=>q.buyin===buyin).length;
    socket.emit('mmStatus',{ inQueue:true, n });
    tryMatch(buyin);
  });
  socket.on('cancelMatch',()=>{
    const i=queue.findIndex(q=>q.id===socket.id); if(i>=0) queue.splice(i,1);
    socket.emit('mmStatus',{ inQueue:false });
  });

  function startRoomFrom(list,buyin){
    const code=makeCode(); rooms[code]=freshRoom(code,buyin);
    const r=rooms[code];
    list.forEach((q,seat)=>{
      r.seats[seat]={ id:q.id, name:q.user, user:q.user, bot:false, conn:true };
      const sk=io.sockets.sockets.get(q.id);
      if(sk){ sk.join(code); sk.data.code=code; sk.emit('matched',{ code, seat }); }
    });
    r.hostId=list[0].id;
    io.to(code).emit('room', roomState(code));
    startMatch(code);
  }
  function tryMatch(buyin){
    const same=queue.filter(q=>q.buyin===buyin);
    same.forEach(q=>{ const sk=io.sockets.sockets.get(q.id); sk&&sk.emit('mmStatus',{ inQueue:true, n:same.length }); });
    if(same.length>=4){
      const four=[]; for(let k=0;k<4;k++){ const idx=queue.findIndex(q=>q.buyin===buyin); four.push(queue.splice(idx,1)[0]); }
      startRoomFrom(four,buyin);
    }
  }

  // ----- SALAS POR CÓDIGO -----
  socket.on('createRoom',({buyin},cb)=>{
    const user=socket.data.user; if(!user) return cb&&cb({ok:false,error:'Inicia sesión'});
    const code=makeCode(); rooms[code]=freshRoom(code,buyin||1000);
    const r=rooms[code];
    r.seats[0]={ id:socket.id, name:user, user, bot:false, conn:true };
    r.hostId=socket.id;
    socket.join(code); socket.data.code=code;
    cb&&cb({ok:true, code, seat:0});
    io.to(code).emit('room', roomState(code));
  });
  socket.on('joinRoom',({code},cb)=>{
    const user=socket.data.user; if(!user) return cb&&cb({ok:false,error:'Inicia sesión'});
    code=(code||'').toUpperCase().trim();
    const r=rooms[code]; if(!r) return cb&&cb({ok:false,error:'Esa sala no existe'});
    if(r.g.phase!=='lobby') return cb&&cb({ok:false,error:'Esa partida ya empezó'});
    const seat=r.seats.findIndex(s=>s===null);
    if(seat===-1) return cb&&cb({ok:false,error:'La sala está llena'});
    r.seats[seat]={ id:socket.id, name:user, user, bot:false, conn:true };
    socket.join(code); socket.data.code=code;
    cb&&cb({ok:true, code, seat});
    io.to(code).emit('room', roomState(code));
  });
  socket.on('addBot',({code})=>{
    const r=rooms[code]; if(!r||socket.id!==r.hostId||r.g.phase!=='lobby') return;
    const seat=r.seats.findIndex(s=>s===null); if(seat===-1) return;
    r.seats[seat]={ id:null, name:'Bot '+(seat+1), user:null, bot:true, conn:true };
    io.to(code).emit('room', roomState(code));
  });
  socket.on('startRoom',({code})=>{
    const r=rooms[code]; if(!r||socket.id!==r.hostId) return;
    if(!r.seats.every(Boolean)) return socket.emit('err','Faltan jugadores (puedes añadir bots).');
    for(const s of r.seats) if(s&&!s.bot&&accounts[s.user]&&accounts[s.user].wallet<r.buyin)
      return socket.emit('err',`${s.user} no tiene monedas para esta mesa.`);
    startMatch(code);
  });

  // ----- CHAT -----
  socket.on('chat',({code,text})=>{
    const r=rooms[code], user=socket.data.user; if(!r||!user||!text) return;
    io.to(code).emit('chat',{ name:user, text:(''+text).slice(0,200) });
  });

  // ----- JUGAR -----
  socket.on('play',({code,idx,side,slam})=>{
    const r=rooms[code]; if(!r) return; const g=r.g;
    if(g.phase!=='play') return;
    const seat=r.seats.findIndex(s=>s&&s.id===socket.id);
    if(seat===-1||seat!==g.turn) return socket.emit('err','No es tu turno.');
    const legal=legalIdx(g,seat);
    if(!legal.includes(idx)) return socket.emit('err','Esa ficha no es legal.');
    const fb=applyPlay(g,seat,idx,side==='L'?'L':'R');
    if(slam) io.to(code).emit('slam',{ by:r.seats[seat].name });
    sys(code,`${r.seats[seat].name} jugó una ficha.`);
    pushGame(code);
    afterPlay(code,seat,fb);
  });
  socket.on('pass',({code})=>{
    const r=rooms[code]; if(!r) return; const g=r.g;
    const seat=r.seats.findIndex(s=>s&&s.id===socket.id);
    if(seat!==g.turn||seatHasMove(g,seat)) return;
    g.passes++; sys(code,`${r.seats[seat].name} pasó.`);
    if(g.passes>=4) return resolveTranca(code);
    nextTurn(code);
  });

  socket.on('leaveRoom',()=>handleLeave(socket));
  socket.on('disconnect',()=>{
    const i=queue.findIndex(q=>q.id===socket.id); if(i>=0) queue.splice(i,1);
    handleLeave(socket);
  });
});

// completar cola con bots si nadie más llega (revisa cada 3s)
setInterval(()=>{
  const now=Date.now(); const heads={};
  queue.forEach(q=>{ if(!heads[q.buyin]) heads[q.buyin]=q; });
  Object.values(heads).forEach(head=>{
    if(now-head.t>QUEUE_BOT_MS){
      const grp=queue.filter(q=>q.buyin===head.buyin).slice(0,4);
      if(grp.length>=1){
        grp.forEach(q=>{ const i=queue.findIndex(x=>x.id===q.id); if(i>=0) queue.splice(i,1); });
        const code=makeCode(); rooms[code]=freshRoom(code,head.buyin); const r=rooms[code];
        grp.forEach((q,seat)=>{ r.seats[seat]={ id:q.id,name:q.user,user:q.user,bot:false,conn:true };
          const sk=io.sockets.sockets.get(q.id); if(sk){ sk.join(code); sk.data.code=code; sk.emit('matched',{code,seat}); } });
        for(let s=grp.length;s<4;s++) r.seats[s]={ id:null,name:'Bot '+(s+1),user:null,bot:true,conn:true };
        r.hostId=grp[0]&&grp[0].id;
        io.to(code).emit('room', roomState(code));
        startMatch(code);
      }
    }
  });
}, 3000);

function handleLeave(socket){
  const code=socket.data.code; const r=code&&rooms[code]; if(!r) return;
  const i=r.seats.findIndex(s=>s&&s.id===socket.id);
  if(i===-1) return;
  if(r.g.phase==='lobby'){
    r.seats[i]=null;
    if(r.seats.every(s=>s===null||s.bot)) delete rooms[code];
    else io.to(code).emit('room', roomState(code));
  } else {
    r.seats[i].bot=true; r.seats[i].conn=true; r.seats[i].id=null;
    sys(code,`${r.seats[i].name} se desconectó — un bot lo cubre.`);
    pushGame(code);
    if(r.g.turn===i) driveBots(code);
  }
  socket.data.code=null;
}

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log('Domi Dom servidor en http://localhost:'+PORT));
