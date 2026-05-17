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

/* ---------------- CUENTAS ---------------- */
const accounts = {}; // user -> { user, pass(hash), wallet, net, games, wins }
const coinRequests = {}; // user -> { user, note, t }  (solicitudes pendientes)
const bugReports = []; // { user, text, t }  (reportes de bugs/problemas)
function pubAcc(u){ const a=accounts[u]; return a&&{ user:a.user, wallet:a.wallet, net:a.net, games:a.games, wins:a.wins }; }
function leaderboard(){
  return Object.values(accounts)
    .sort((x,y)=>y.net-x.net).slice(0,20)
    .map(a=>({ user:a.user, net:a.net, wins:a.wins, games:a.games }));
}

/* ---------------- CLAVES SEGURAS (encriptadas) ---------------- */
const crypto = require('crypto');
function hashPass(p){
  const salt=crypto.randomBytes(8).toString('hex');
  const h=crypto.scryptSync(String(p),salt,32).toString('hex');
  return 'h1:'+salt+':'+h;
}
function checkPass(stored,p){
  if(typeof stored!=='string') return false;
  if(stored.startsWith('h1:')){
    const parts=stored.split(':'); const salt=parts[1], h=parts[2];
    return crypto.scryptSync(String(p),salt,32).toString('hex')===h;
  }
  return stored===p; // compatibilidad con texto plano viejo
}

/* ---------------- BASE DE DATOS (Supabase, opcional) ---------------- */
let supa=null, persistTimer=null;
const SUPA_URL=process.env.SUPABASE_URL, SUPA_KEY=process.env.SUPABASE_KEY;
if(SUPA_URL && SUPA_KEY){
  try{ const { createClient }=require('@supabase/supabase-js'); supa=createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:false}}); console.log('Supabase conectado — datos permanentes.'); }
  catch(e){ console.log('No se pudo cargar supabase-js:', e.message); }
}
async function loadState(){
  if(!supa){ console.log('SIN base de datos: datos en memoria (se borran al reiniciar). Pon SUPABASE_URL y SUPABASE_KEY en Render.'); return; }
  try{
    const { data, error }=await supa.from('domidom_state').select('data').eq('id','main').maybeSingle();
    if(error){ console.log('Error leyendo DB:', error.message); return; }
    if(data && data.data){
      const s=data.data;
      Object.assign(accounts, s.accounts||{});
      Object.assign(coinRequests, s.coinRequests||{});
      if(Array.isArray(s.bugReports)){ bugReports.length=0; s.bugReports.forEach(b=>bugReports.push(b)); }
      console.log('Estado cargado de la DB. Cuentas:', Object.keys(accounts).length);
    } else {
      await supa.from('domidom_state').upsert({ id:'main', data:{accounts:{},coinRequests:{},bugReports:[]} });
      console.log('Base de datos inicializada (vacía).');
    }
  }catch(e){ console.log('loadState error:', e.message); }
}
function persist(){
  if(!supa) return;
  clearTimeout(persistTimer);
  persistTimer=setTimeout(async ()=>{
    try{ await supa.from('domidom_state').upsert({ id:'main', data:{ accounts, coinRequests, bugReports } }); }
    catch(e){ console.log('persist error:', e.message); }
  }, 1500);
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
    const ok = g.board.length===0 ? true : canPlay(t,g.left,g.right);  // mesa vacía: cualquier ficha abre
    if(ok) out.push(i);
  });
  return out;
}
function seatHasMove(g,seat){ return legalIdx(g,seat).length>0; }

// IA sencilla y JUSTA para multijugador (rellenar / desconectados)
function botPick(g,seat,level){
  const legal=legalIdx(g,seat);
  if(!legal.length) return null;
  level = Math.max(1, Math.min(10, level||7));
  // jugada "inteligente": soltar fichas pesadas y dobles, conservar variedad
  let smart=legal[0], bs=-1;
  for(const i of legal){
    const t=g.hands[seat][i];
    let sc=pips(t)+(t[0]===t[1]?5:0);
    if(g.board.length && (t[0]===g.left||t[1]===g.left) && (t[0]===g.right||t[1]===g.right)) sc+=3;
    if(sc>bs){ bs=sc; smart=i; }
  }
  // probabilidad de jugar óptimo según nivel: N1≈.10 (fácil) ... N10≈.99 (casi imposible)
  const pSmart = 0.10 + (level-1)*(0.89/9);
  const idx = (Math.random()<pSmart) ? smart : legal[Math.floor(Math.random()*legal.length)];
  const t=g.hands[seat][idx];
  let side='R';
  if(g.board.length){ side=t.includes(g.right)?'R':'L'; }
  return { idx, side };
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
  return { code, buyin:(buyin==null?1000:buyin), pote:0, practice:false, botLevel:7,
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
    turnEnds:r.turnEnds||0,
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

/* ---------------- TIMER DE TURNO ---------------- */
const TURN_MS=45000;
function clearTimer(r){ if(r&&r.timer){ clearTimeout(r.timer); r.timer=null; } if(r) r.turnEnds=0; }
function armTimer(code){
  const r=rooms[code]; if(!r) return; clearTimer(r);
  const g=r.g; if(g.phase!=='play') return;
  const seat=r.seats[g.turn];
  if(!seat||seat.bot||!seat.conn) return;          // bots/desconectados los maneja driveBots
  r.turnEnds=Date.now()+TURN_MS;
  r.timer=setTimeout(()=>{
    const rr=rooms[code]; if(!rr||rr.g.phase!=='play') return;
    const ss=rr.g.turn, mv=botPick(rr.g,ss,rr.botLevel);
    sys(code,`${rr.seats[ss].name} se quedó sin tiempo — juega automático.`);
    if(!mv){ rr.g.passes++; if(rr.g.passes>=4) return resolveTranca(code); return nextTurn(code); }
    const fb=applyPlay(rr.g,ss,mv.idx,mv.side);
    pushGame(code); afterPlay(code,ss,fb);
  }, TURN_MS);
}

/* ---------------- FLUJO DE PARTIDA ---------------- */
function startMatch(code){
  const r=rooms[code]; if(!r||!r.seats.every(Boolean)) return;
  r.pote=r.buyin*4;
  r.g.scoreA=0; r.g.scoreB=0; r.g.starter=0;
  r.seats.forEach(s=>{ if(s&&!s.bot&&accounts[s.user]) accounts[s.user].wallet-=r.buyin; }); persist();
  sys(code,`Partida iniciada. Pote ${r.pote} · entrada ${r.buyin} · a 200 puntos.`);
  r.seats.forEach(s=>{ if(s&&!s.bot&&s.id&&accounts[s.user]) io.to(s.id).emit('walletUpdate',{wallet:accounts[s.user].wallet}); });
  newHand(r.g,true);
  io.to(code).emit('matchStarted');
  pushGame(code);
  io.to(code).emit('room', roomState(code));
  armTimer(code);
  driveBots(code);
}
function nextTurn(code){
  const r=rooms[code]; if(!r) return; const g=r.g;
  if(g.phase!=='play') return;
  let guard=0;
  while(guard++<8){
    g.turn=(g.turn+1)%4;
    if(seatHasMove(g,g.turn)){ pushGame(code); armTimer(code); driveBots(code); return; }
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
  if(a===b){ sys(code,`Tranca empatada (${a}-${b}). Se repite la mano.`); g.starter=g.turn; newHand(g,false); pushGame(code); armTimer(code); return driveBots(code); }
  const win=a<b?'A':'B';
  award(code,win,Math.max(a,b),`Tranca · Equipo ${win} con menos (${Math.min(a,b)})`);
}
function award(code,team,pts,reason){
  const r=rooms[code], g=r.g;
  clearTimer(r);
  if(team==='A') g.scoreA+=pts; else g.scoreB+=pts;
  sys(code,`${reason}: +${pts} Equipo ${team}. (${g.scoreA}-${g.scoreB})`);
  if(g.scoreA>=200||g.scoreB>=200){ return endMatch(code, g.scoreA>=200?'A':'B'); }
  g.starter = team==='A'?0:1;
  g.phase='handover';
  pushGame(code);
  io.to(code).emit('handOver',{ scoreA:g.scoreA, scoreB:g.scoreB });
  setTimeout(()=>{ if(!rooms[code]) return; newHand(g,false); g.phase='play'; pushGame(code); armTimer(code); driveBots(code); }, 3200);
}
function endMatch(code,team){
  const r=rooms[code], g=r.g;
  clearTimer(r);
  const winners=team==='A'?[0,2]:[1,3], losers=team==='A'?[1,3]:[0,2];
  const skunk=(team==='A'?g.scoreB:g.scoreA)===0;
  const share=r.pote/2;
  if(!r.practice){
    winners.forEach(s=>{ const p=r.seats[s]; if(p&&!p.bot&&accounts[p.user]){ const A=accounts[p.user]; A.wallet+=share; A.net+=share-r.buyin; A.games++; A.wins++; } }); persist();
    losers.forEach(s=>{ const p=r.seats[s]; if(p&&!p.bot&&accounts[p.user]){ const A=accounts[p.user]; A.net-=r.buyin; A.games++; } });
  }
  g.phase='over';
  sys(code,`🏆 Equipo ${team} gana ${g.scoreA}-${g.scoreB}${skunk?' ¡POLLONA!':''}.`);
  r.seats.forEach((s,i)=>{ if(s&&!s.bot&&accounts[s.user]){
    const won=winners.includes(i);
    const extra = r.practice ? { practice:true, level:r.practiceLevel, skinUnlocked:(won && r.practiceLevel>=10) } : {};
    io.to(s.id).emit('matchOver', Object.assign({ team, won, skunk, scoreA:g.scoreA, scoreB:g.scoreB, acc:pubAcc(s.user) }, extra));
  }});
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
    const think = 1600 + Math.floor(Math.random()*1900); // 1.6s – 3.5s, como si pensara
    setTimeout(()=>{
      if(!rooms[code]||g.phase!=='play'||g.turn!==s) return;
      const mv=botPick(g,s,r.botLevel);
      if(!mv){ g.passes++; sys(code,`${seat.name} pasó.`); if(g.passes>=4) return resolveTranca(code); return nextTurn(code); }
      const fb=applyPlay(g,s,mv.idx,mv.side);
      sys(code,`${seat.name} jugó una ficha.`);
      pushGame(code);
      afterPlay(code,s,fb);
    }, think);
  }
}

/* ---------------- SOCKETS ---------------- */
/* ---------------- SEGURIDAD / VALIDACIÓN ---------------- */
const ADMIN_USER = process.env.ADMIN_USER || '';
// admin = la cuenta cuyo nombre está en ADMIN_USER (Render). Si no se
// configuró, cae a la clave ADMIN_KEY vieja (compatibilidad).
function adminOK(socket,key){
  if(ADMIN_USER) return socket && socket.data && socket.data.user===ADMIN_USER;
  return process.env.ADMIN_KEY && key===process.env.ADMIN_KEY;
}
const ADMIN_DENY = { ok:false, error:'Solo el administrador puede hacer esto.' };

// límite de intentos (anti fuerza bruta / spam) — por socket+acción
const _rl={};
function rateOK(socket,bucket,max,windowMs){
  const id=(socket.id||'?')+':'+bucket, now=Date.now();
  const arr=(_rl[id]||[]).filter(t=>now-t<windowMs);
  arr.push(now); _rl[id]=arr;
  return arr.length<=max;
}
setInterval(()=>{ const now=Date.now(); for(const k in _rl){ _rl[k]=_rl[k].filter(t=>now-t<120000); if(!_rl[k].length) delete _rl[k]; } }, 60000);

const reUser  = /^[A-Za-z0-9_]{3,20}$/;
const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function digits(s){ return (''+(s||'')).replace(/[^\d]/g,''); }
function emailTaken(email,exceptUser){
  email=email.toLowerCase();
  return Object.values(accounts).some(a=>a.user!==exceptUser && (a.email||'').toLowerCase()===email);
}
function phoneTaken(ph,exceptUser){
  return ph && Object.values(accounts).some(a=>a.user!==exceptUser && a.phone===ph);
}

/* Verificación de correo: real solo si hay servicio de email configurado
   (RESEND_API_KEY). Sin servicio, se guarda el correo pero no se puede
   enviar código (honesto: no inventamos un envío que no ocurre). */
const EMAIL_ON = !!process.env.RESEND_API_KEY;
function genCode(){ return ''+Math.floor(100000+Math.random()*900000); }
async function sendCode(to,code){
  if(!EMAIL_ON){ console.log('[EMAIL NO CONFIGURADO] código para',to,'=',code); return false; }
  try{
    await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{ 'Authorization':'Bearer '+process.env.RESEND_API_KEY, 'Content-Type':'application/json' },
      body:JSON.stringify({
        from: process.env.EMAIL_FROM || 'Domi Dom <onboarding@resend.dev>',
        to, subject:'Tu código de verificación · Domi Dom',
        text:`Tu código de verificación de Domi Dom es: ${code}\n\nSi no fuiste tú, ignora este correo.`
      })
    });
    return true;
  }catch(e){ console.log('sendCode error:', e.message); return false; }
}

io.on('connection',(socket)=>{

  socket.on('register',({user,pass,email,phone},cb)=>{
    if(!rateOK(socket,'reg',5,60000)) return cb&&cb({ok:false,error:'Demasiados intentos. Espera un momento.'});
    user=(user||'').trim(); email=(''+(email||'')).trim().toLowerCase();
    const ph=digits(phone);
    if(!reUser.test(user)) return cb&&cb({ok:false,error:'Usuario: 3–20 letras, números o _ (sin espacios ni símbolos).'});
    if(!pass||(''+pass).length<6) return cb&&cb({ok:false,error:'La clave debe tener al menos 6 caracteres.'});
    if(!reEmail.test(email)) return cb&&cb({ok:false,error:'Correo inválido.'});
    if(ph.length<7||ph.length>15) return cb&&cb({ok:false,error:'Teléfono inválido (7–15 dígitos).'});
    if(accounts[user]) return cb&&cb({ok:false,error:'Ese usuario ya existe.'});
    if(emailTaken(email)) return cb&&cb({ok:false,error:'Ese correo ya está registrado.'});
    if(phoneTaken(ph)) return cb&&cb({ok:false,error:'Ese teléfono ya está registrado.'});

    const acc={ user, pass:hashPass(pass), email, phone:ph,
      emailVerified: !EMAIL_ON, wallet:0, net:0, games:0, wins:0 };
    if(EMAIL_ON){ acc.code=genCode(); acc.codeT=Date.now(); }
    accounts[user]=acc; persist();

    if(EMAIL_ON){
      sendCode(email, acc.code);
      return cb&&cb({ ok:true, needVerify:true });   // NO inicia sesión hasta verificar
    }
    socket.data.user=user;
    cb&&cb({ ok:true, acc:pubAcc(user), admin:(!!ADMIN_USER && user===ADMIN_USER) });
    io.emit('leaderboard', leaderboard());
  });

  socket.on('verifyEmail',({user,code},cb)=>{
    if(!rateOK(socket,'vf',8,60000)) return cb&&cb({ok:false,error:'Demasiados intentos. Espera.'});
    const a=accounts[(user||'').trim()];
    if(!a) return cb&&cb({ok:false,error:'Cuenta no encontrada.'});
    if(a.emailVerified) { socket.data.user=a.user; return cb&&cb({ok:true, acc:pubAcc(a.user), admin:(!!ADMIN_USER && a.user===ADMIN_USER)}); }
    if(!a.code || (''+code).trim()!==a.code) return cb&&cb({ok:false,error:'Código incorrecto.'});
    if(Date.now()-(a.codeT||0) > 15*60000) return cb&&cb({ok:false,error:'El código expiró. Pide otro.'});
    a.emailVerified=true; delete a.code; delete a.codeT; persist();
    socket.data.user=a.user;
    cb&&cb({ok:true, acc:pubAcc(a.user), admin:(!!ADMIN_USER && a.user===ADMIN_USER)});
    io.emit('leaderboard', leaderboard());
  });

  socket.on('resendCode',({user},cb)=>{
    if(!rateOK(socket,'rc',3,120000)) return cb&&cb({ok:false,error:'Espera antes de pedir otro código.'});
    const a=accounts[(user||'').trim()];
    if(!a||a.emailVerified) return cb&&cb({ok:false,error:'No aplica.'});
    a.code=genCode(); a.codeT=Date.now(); persist();
    sendCode(a.email,a.code);
    cb&&cb({ok:true});
  });

  socket.on('login',({user,pass},cb)=>{
    if(!rateOK(socket,'login',8,60000)) return cb&&cb({ok:false,error:'Demasiados intentos. Espera un minuto.'});
    const a=accounts[(user||'').trim()];
    if(!a||!checkPass(a.pass,pass)) return cb&&cb({ok:false,error:'Usuario o clave incorrectos'});
    if(a.banned) return cb&&cb({ok:false,error:'Esta cuenta está suspendida.'});
    if(EMAIL_ON && a.emailVerified===false) return cb&&cb({ok:false,error:'Verifica tu correo primero.',needVerify:true});
    socket.data.user=a.user;
    cb&&cb({ok:true, acc:pubAcc(a.user), admin:(!!ADMIN_USER && a.user===ADMIN_USER)});
  });

  socket.on('getLeaderboard',()=>socket.emit('leaderboard', leaderboard()));

  // ----- SOLICITUDES DE MONEDAS -----
  socket.on('requestCoins',({note},cb)=>{
    const user=socket.data.user; if(!user) return cb&&cb({ok:false,error:'Inicia sesión'});
    if(!rateOK(socket,'req',4,60000)) return cb&&cb({ok:false,error:'Espera antes de pedir de nuevo.'});
    coinRequests[user]={ user, note:(''+(note||'')).slice(0,160), t:Date.now() }; persist();
    console.log(`[SOLICITUD] ${user}: ${coinRequests[user].note}`);
    cb&&cb({ok:true});
  });
  socket.on('adminRequests',({key},cb)=>{
    if(!adminOK(socket,key)) return cb&&cb(ADMIN_DENY);
    cb&&cb({ok:true, list:Object.values(coinRequests).sort((a,b)=>a.t-b.t)});
  });
  socket.on('adminUsers',({key},cb)=>{
    if(!adminOK(socket,key)) return cb&&cb(ADMIN_DENY);
    const list=Object.values(accounts).map(a=>({user:a.user,wallet:a.wallet,net:a.net,games:a.games,wins:a.wins,
      email:a.email||'',phone:a.phone||'',verified:a.emailVerified!==false,banned:!!a.banned})).sort((x,y)=>y.wallet-x.wallet);
    cb&&cb({ok:true, list});
  });
  socket.on('adminBan',({key,target,ban},cb)=>{
    if(!adminOK(socket,key)) return cb&&cb(ADMIN_DENY);
    const a=accounts[(target||'').trim()];
    if(!a) return cb&&cb({ok:false,error:'Usuario no existe.'});
    if(ADMIN_USER && a.user===ADMIN_USER) return cb&&cb({ok:false,error:'No puedes banear la cuenta admin.'});
    a.banned=!!ban; persist();
    if(a.banned){ for(const [,s] of io.sockets.sockets) if(s.data&&s.data.user===a.user){ s.emit('banned'); s.disconnect(true); } }
    console.log(`[ADMIN] ${a.banned?'BAN':'UNBAN'} ${a.user}`);
    cb&&cb({ok:true, user:a.user, banned:a.banned});
  });

  // ----- REPORTES DE BUGS / PROBLEMAS -----
  socket.on('reportBug',({text},cb)=>{
    const user=socket.data.user||'(invitado)';
    if(!rateOK(socket,'bug',5,60000)) return cb&&cb({ok:false,error:'Espera antes de enviar otro.'});
    const t=(''+(text||'')).slice(0,500).trim();
    if(!t) return cb&&cb({ok:false,error:'Escribe el problema.'});
    bugReports.unshift({ user, text:t, t:Date.now() });
    if(bugReports.length>200) bugReports.pop();
    persist();
    console.log(`[BUG] ${user}: ${t}`);
    cb&&cb({ok:true});
  });
  socket.on('adminBugs',({key},cb)=>{
    if(!adminOK(socket,key)) return cb&&cb(ADMIN_DENY);
    cb&&cb({ok:true, list:bugReports.slice(0,50)});
  });
  socket.on('adminClearBugs',({key},cb)=>{
    if(!adminOK(socket,key)) return cb&&cb(ADMIN_DENY);
    bugReports.length=0; persist(); cb&&cb({ok:true});
  });

  // ----- ADMIN: regalar monedas de juego -----
  socket.on('adminGrant',({key,target,amount},cb)=>{
    if(!adminOK(socket,key)) return cb&&cb(ADMIN_DENY);
    const a=accounts[(target||'').trim()];
    if(!a) return cb&&cb({ok:false,error:'Ese usuario no existe.'});
    let n=Math.round(Number(amount));
    if(!Number.isFinite(n)||n===0) return cb&&cb({ok:false,error:'Cantidad inválida.'});
    if(Math.abs(n)>100000000) return cb&&cb({ok:false,error:'Cantidad fuera de rango.'});
    a.wallet=Math.max(0,a.wallet+n); persist();
    delete coinRequests[a.user];
    console.log(`[ADMIN] ${n>0?'+':''}${n} a ${a.user} (saldo ${a.wallet})`);
    cb&&cb({ok:true, user:a.user, wallet:a.wallet});
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

  // ----- PRÁCTICA GRATIS CONTRA BOTS (sin costo, no afecta monedas) -----
  socket.on('practiceBots',({level},cb)=>{
    const user=socket.data.user; if(!user) return cb&&cb({ok:false,error:'Inicia sesión'});
    const lvl=Math.max(1,Math.min(10, parseInt(level)||1));
    const code=makeCode(); rooms[code]=freshRoom(code,0); const r=rooms[code];
    r.practice=true; r.botLevel=lvl; r.practiceLevel=lvl;
    r.seats[0]={ id:socket.id, name:user, user, bot:false, conn:true };
    for(let s=1;s<4;s++) r.seats[s]={ id:null, name:'Bot '+s, user:null, bot:true, conn:true };
    r.hostId=socket.id;
    socket.join(code); socket.data.code=code;
    cb&&cb({ok:true, level:lvl});
    socket.emit('matched',{ code, seat:0 });
    io.to(code).emit('room', roomState(code));
    startMatch(code);
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

// MATCHMAKING SOLO HUMANOS: ya no se completan mesas con bots.
// (Para jugar con bots existe el modo Práctica GRATIS, evento 'practiceBots'.)


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
loadState().then(()=>{
  server.listen(PORT,()=>console.log('Domi Dom servidor en http://localhost:'+PORT));
});
