/* ============================================================
   DomiDom — Renderizador de tablero serpenteante con puntos reales
   Uso: drawSnakeBoard(boardArray, leftEnd, rightEnd, animateLastIdx)
   boardArray: [ [a,b], [b,c], ... ]  — ya orientadas
   ============================================================ */

// ───── PIP LAYOUT — posiciones de puntos en grilla 3×3 ─────
// 0 1 2
// 3 4 5
// 6 7 8
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
  return Array.from({ length: 9 }, (_, i) => map[n].includes(i));
}

// ───── CREAR UNA FICHA (SVG con puntos) ─────
function tileEl(vals, horizontal) {
  const d = document.createElement('div');
  d.className = 'domino-tile' + (horizontal ? ' h' : '');

  vals.forEach((n, halfIdx) => {
    const half = document.createElement('div');
    half.className = 'tile-half pip-half';

    const grid = document.createElement('div');
    grid.className = 'pip-grid';

    pipLayout(n).forEach(isOn => {
      const cell = document.createElement('span');
      if (isOn) cell.className = 'pip';
      grid.appendChild(cell);
    });

    half.appendChild(grid);

    // Línea divisoria entre mitades
    if (halfIdx === 0) {
      const div = document.createElement('div');
      div.className = 'tile-divider';
      d.appendChild(half);
      d.appendChild(div);
    } else {
      d.appendChild(half);
    }
  });

  return d;
}

// ───── ALGORITMO SERPENTEANTE PRINCIPAL ─────
function drawSnakeBoard(boardArr, leftEnd, rightEnd, animateLastIdx) {
  const container = document.getElementById('snake');
  if (!container) return;

  // Limpiar contenedor
  container.innerHTML = '';

  if (!boardArr || boardArr.length === 0) {
    container.innerHTML = '<div style="color:rgba(255,255,255,.5);font-style:italic;font-size:14px;padding:20px;">La mesa está vacía</div>';
    // Actualizar extremos
    updateEnds(null, null);
    return;
  }

  updateEnds(leftEnd, rightEnd);

  const L = 64;     // largo de ficha
  const S = 34;     // grosor de ficha
  const VRUN = 2;   // fichas que bajan antes de girar

  const boardEl = document.getElementById('board-container') || document.getElementById('snake').parentElement;
  const avail = ((boardEl ? boardEl.clientWidth : 600) || 600) - 70;
  const centerX = avail / 2;
  const minX = L;
  const maxX = Math.max(L * 4, avail);

  // Empezar en el CENTRO del tablero (primera ficha horizontal)
  let P = { x: centerX, y: L };
  let dir = 'R';
  let lastH = 'R';
  let vCount = 0;

  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const els = [];

  for (let i = 0; i < boardArr.length; i++) {
    const t = boardArr[i];
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

    const e = tileEl(vals, !vertical);
    e.style.position = 'absolute';
    e.style.left  = Lx + 'px';
    e.style.top   = Ty + 'px';
    e.style.width  = W + 'px';
    e.style.height = H + 'px';

    if (animateLastIdx === i) {
      e.style.animation = 'tilePlaced .4s cubic-bezier(.2,1.4,.4,1)';
    }

    els.push(e);

    x0 = Math.min(x0, Lx);
    y0 = Math.min(y0, Ty);
    x1 = Math.max(x1, Lx + W);
    y1 = Math.max(y1, Ty + H);

    // Avanzar cursor
    if (dir === 'R')      P = { x: P.x + advance, y: P.y };
    else if (dir === 'L') P = { x: P.x - advance, y: P.y };
    else                  P = { x: P.x, y: P.y + advance };

    // Girar si llegamos al borde
    if      (dir === 'R' && P.x >= maxX)  { dir = 'D'; vCount = 0; lastH = 'R'; }
    else if (dir === 'L' && P.x <= minX)  { dir = 'D'; vCount = 0; lastH = 'L'; }
    else if (dir === 'D') {
      vCount++;
      if (vCount >= VRUN) dir = (lastH === 'R') ? 'L' : 'R';
    }
  }

  // Reposicionar para que bounding box empiece en (0,0)
  els.forEach(el => {
    el.style.left = (parseFloat(el.style.left) - x0) + 'px';
    el.style.top  = (parseFloat(el.style.top)  - y0) + 'px';
    container.appendChild(el);
  });

  const totalW = x1 - x0;
  const totalH = y1 - y0;
  container.style.width  = totalW + 'px';
  container.style.height = totalH + 'px';

  // Auto-escalar para que quepa
  requestAnimationFrame(() => {
    const parent = container.parentElement;
    if (!parent) return;
    const avW = (parent.clientWidth  || 700) - 24;
    const avH = Math.max(180, (parent.clientHeight || 380) - 20);
    const scale = Math.min(1, avW / totalW, avH / totalH);
    container.style.transform = 'scale(' + Math.max(0.14, scale) + ')';
    container.style.transformOrigin = 'center top';
  });
}

function updateEnds(left, right) {
  // Actualizar el badge de extremos si existe
  const badge = document.getElementById('ends-badge');
  if (badge) {
    if (left === null || left === undefined) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'flex';
      badge.textContent = `◀ ${left}  ·  ${right} ▶`;
    }
  }
}

// Exportar para uso en game.js
window.drawSnakeBoard = drawSnakeBoard;
