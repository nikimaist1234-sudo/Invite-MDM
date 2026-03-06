const startBtn = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

const tdcCanvas = document.getElementById("tdcCanvas"); // puzzle canvas
const sparkCanvas = document.getElementById("sparkCanvas");
const gameHint = document.getElementById("gameHint");

let game = null;

/* ---------------- PAGE NAV ---------------- */
function showOnlyPage(pageNumber){
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById("page" + pageNumber);
  if(el) el.classList.add("active");
}

startBtn?.addEventListener("click", () => {
  showOnlyPage(1);
  music?.play().catch(()=>{});
  initPuzzleGame();
});

/* ---------------- GAME: 9-PIECE PUZZLE ---------------- */
function initPuzzleGame(){
  if(game && typeof game.destroy === "function") game.destroy();

  if(gameHint){
    gameHint.textContent = "Fix the puzzle to reveal the image.";
  }

  game = createPuzzleGame({
    canvas: tdcCanvas,
    imageSrc: "puzzle.jpg",
    onSolved: () => {
      if(gameHint){
        gameHint.textContent = "Puzzle complete!";
      }
      winGame();
    }
  });

  game.start();
}

function winGame(){
  if(game) game.stopInput();

  // Keep solved puzzle visible for 3 seconds before fireworks
  setTimeout(() => {
    playFireworksSequence({
      randomMs: 3000,
      heartMs: 1700
    });

    setTimeout(() => {
      finishGame();
    }, 3000 + 1700);
  }, 3000);
}

/* ---------------- FINISH ---------------- */
function finishGame(){
  document.body.classList.remove("locked");
  document.body.classList.add("scroll-mode");

  document.getElementById("page2")
    ?.scrollIntoView({behavior:"smooth"});
}

/* ---------------- PUZZLE ENGINE ---------------- */
function createPuzzleGame({ canvas, imageSrc, onSolved }){
  const ctx = canvas.getContext("2d");
  const img = new Image();

  let w = 0, h = 0;
  let raf = null;
  let running = false;
  let inputEnabled = true;
  let solved = false;

  const ROWS = 3;
  const COLS = 3;

  let boardX = 0;
  let boardY = 0;
  let boardSize = 0;
  let pieceSize = 0;

  let pieces = [];
  let draggingPiece = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function resize(){
    const parent = canvas.parentElement;
    const maxW = Math.min(560, parent?.clientWidth || 560);
    const maxH = Math.min(460, Math.round(window.innerHeight * 0.5));

    canvas.width = Math.max(300, Math.floor(maxW));
    canvas.height = Math.max(360, Math.floor(maxH));

    w = canvas.width;
    h = canvas.height;

    boardSize = Math.min(w * 0.58, h * 0.58);
    pieceSize = boardSize / COLS;
    boardX = (w - boardSize) / 2;
    boardY = (h - boardSize) / 2;

    if (pieces.length) {
      repositionPiecesNeatly();
      snapPlacedPiecesToGrid();
    }
  }

  function start(){
    img.onload = () => {
      setupPieces();
      resize();
      attachInput();
      running = true;
      raf = requestAnimationFrame(tick);
    };

    img.src = imageSrc;
  }

  function stop(){
    running = false;
    if(raf){
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function stopInput(){
    inputEnabled = false;
  }

  function destroy(){
    stop();
    detachInput();
    window.removeEventListener("resize", resize);
  }

  function setupPieces(){
    solved = false;
    inputEnabled = true;
    draggingPiece = null;
    pieces = [];

    for(let row = 0; row < ROWS; row++){
      for(let col = 0; col < COLS; col++){
        const id = row * COLS + col;

        pieces.push({
          id,
          correctRow: row,
          correctCol: col,
          currentX: 0,
          currentY: 0,
          placed: false
        });
      }
    }

    shuffleArray(pieces);
    window.addEventListener("resize", resize);
  }

  function repositionPiecesNeatly(){
    const loose = pieces.filter(p => !p.placed && p !== draggingPiece);

    const leftX = boardX - pieceSize - 18;
    const rightX = boardX + boardSize + 18;

    const topY = boardY;
    const midY = boardY + pieceSize;
    const bottomY = boardY + pieceSize * 2;

    const neatPositions = [
      { x: leftX,  y: topY },
      { x: rightX, y: topY },
      { x: leftX,  y: midY },
      { x: rightX, y: midY },
      { x: leftX,  y: bottomY },
      { x: rightX, y: bottomY },
      { x: boardX, y: boardY - pieceSize - 18 },
      { x: boardX + pieceSize, y: boardY - pieceSize - 18 },
      { x: boardX + pieceSize / 2, y: boardY + boardSize + 18 }
    ];

    loose.forEach((piece, i) => {
      const pos = neatPositions[i % neatPositions.length];

      piece.currentX = clamp(pos.x, 8, w - pieceSize - 8);
      piece.currentY = clamp(pos.y, 8, h - pieceSize - 8);
    });
  }

  function snapPlacedPiecesToGrid(){
    pieces.forEach(piece => {
      if(piece.placed){
        piece.currentX = boardX + piece.correctCol * pieceSize;
        piece.currentY = boardY + piece.correctRow * pieceSize;
      }
    });
  }

  function tick(){
    drawScene();
    if(running){
      raf = requestAnimationFrame(tick);
    }
  }

  function drawScene(){
    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "rgba(0,0,0,0.72)");
    bg.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawBoardGlow();
    drawBoardSlots();
    drawPlacedPieces();
    drawLoosePieces();
    drawGridLines();

    if (solved) {
      drawSolvedGlow();
    }
  }

  function drawBoardGlow(){
    ctx.save();
    const g = ctx.createRadialGradient(
      boardX + boardSize / 2,
      boardY + boardSize / 2,
      boardSize * 0.1,
      boardX + boardSize / 2,
      boardY + boardSize / 2,
      boardSize * 0.8
    );
    g.addColorStop(0, "rgba(255,120,40,0.16)");
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawBoardSlots(){
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.2;

    for(let row = 0; row < ROWS; row++){
      for(let col = 0; col < COLS; col++){
        const x = boardX + col * pieceSize;
        const y = boardY + row * pieceSize;

        ctx.fillRect(x, y, pieceSize, pieceSize);
        ctx.strokeRect(x, y, pieceSize, pieceSize);
      }
    }

    ctx.restore();
  }

  function drawPlacedPieces(){
    pieces
      .filter(piece => piece.placed)
      .forEach(piece => drawPiece(piece, false));
  }

  function drawLoosePieces(){
    pieces
      .filter(piece => !piece.placed && piece !== draggingPiece)
      .forEach(piece => drawPiece(piece, false));

    if (draggingPiece) {
      drawPiece(draggingPiece, true);
    }
  }

  function drawPiece(piece, isDragging){
    const sx = piece.correctCol * (img.width / COLS);
    const sy = piece.correctRow * (img.height / ROWS);
    const sw = img.width / COLS;
    const sh = img.height / ROWS;

    ctx.save();

    if (isDragging) {
      ctx.shadowColor = "rgba(255,140,60,0.45)";
      ctx.shadowBlur = 18;
    }

    ctx.drawImage(
      img,
      sx, sy, sw, sh,
      piece.currentX, piece.currentY, pieceSize, pieceSize
    );

    ctx.strokeStyle = isDragging
      ? "rgba(255,190,120,0.95)"
      : "rgba(255,255,255,0.22)";
    ctx.lineWidth = isDragging ? 2.5 : 1.2;
    ctx.strokeRect(piece.currentX, piece.currentY, pieceSize, pieceSize);

    ctx.restore();
  }

  function drawGridLines(){
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;

    for(let i = 1; i < COLS; i++){
      const x = boardX + i * pieceSize;
      ctx.beginPath();
      ctx.moveTo(x, boardY);
      ctx.lineTo(x, boardY + boardSize);
      ctx.stroke();
    }

    for(let i = 1; i < ROWS; i++){
      const y = boardY + i * pieceSize;
      ctx.beginPath();
      ctx.moveTo(boardX, y);
      ctx.lineTo(boardX + boardSize, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSolvedGlow(){
    ctx.save();
    ctx.strokeStyle = "rgba(255,160,60,0.8)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,120,30,0.8)";
    ctx.shadowBlur = 22;
    ctx.strokeRect(boardX, boardY, boardSize, boardSize);
    ctx.restore();
  }

  function attachInput(){
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("touchstart", onDown, { passive: false });

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });

    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp, { passive: false });
    window.addEventListener("touchcancel", onUp, { passive: false });
  }

  function detachInput(){
    canvas.removeEventListener("mousedown", onDown);
    canvas.removeEventListener("touchstart", onDown);

    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("touchmove", onMove);

    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchend", onUp);
    window.removeEventListener("touchcancel", onUp);
  }

  function onDown(e){
    if (!inputEnabled || solved) return;

    const p = getPoint(e);

    for(let i = pieces.length - 1; i >= 0; i--){
      const piece = pieces[i];

      if (piece.placed) continue;

      if (
        p.x >= piece.currentX &&
        p.x <= piece.currentX + pieceSize &&
        p.y >= piece.currentY &&
        p.y <= piece.currentY + pieceSize
      ){
        draggingPiece = piece;
        dragOffsetX = p.x - piece.currentX;
        dragOffsetY = p.y - piece.currentY;

        pieces = pieces.filter(pc => pc !== piece);
        pieces.push(piece);
        break;
      }
    }
  }

  function onMove(e){
    if (!inputEnabled || !draggingPiece || solved) return;

    const p = getPoint(e);
    draggingPiece.currentX = clamp(p.x - dragOffsetX, 0, w - pieceSize);
    draggingPiece.currentY = clamp(p.y - dragOffsetY, 0, h - pieceSize);
  }

  function onUp(e){
    if (!inputEnabled || !draggingPiece || solved) return;

    const piece = draggingPiece;
    draggingPiece = null;

    const targetX = boardX + piece.correctCol * pieceSize;
    const targetY = boardY + piece.correctRow * pieceSize;

    const dist = Math.hypot(piece.currentX - targetX, piece.currentY - targetY);
    const snapThreshold = pieceSize * 0.45;

    if (dist <= snapThreshold && slotIsFree(piece.correctRow, piece.correctCol)) {
      piece.currentX = targetX;
      piece.currentY = targetY;
      piece.placed = true;
      checkSolved();
    }
  }

  function slotIsFree(row, col){
    return !pieces.some(p => p.placed && p.correctRow === row && p.correctCol === col);
  }

  function checkSolved(){
    const done = pieces.every(piece => piece.placed);

    if(done){
      solved = true;
      inputEnabled = false;
      onSolved?.();
    }
  }

  function getPoint(e){
    e.preventDefault?.();
    const rect = canvas.getBoundingClientRect();
    const t = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function shuffleArray(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  return { start, stop, stopInput, destroy };
}

/* ---------------- FIREWORKS SEQUENCE ---------------- */
function playFireworksSequence({ randomMs = 3000, heartMs = 1700 } = {}){
  if(!sparkCanvas) return;

  const ctx = sparkCanvas.getContext("2d");
  let w = 0, h = 0;
  let start = performance.now();
  let raf = null;

  const particles = [];
  const MAX_PARTICLES = 520;

  function resize(){
    sparkCanvas.width = window.innerWidth;
    sparkCanvas.height = window.innerHeight;
    w = sparkCanvas.width;
    h = sparkCanvas.height;
  }

  function addBurst(x, y, palette){
    const n = 22 + Math.floor(Math.random()*28);
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = 140 + Math.random()*620;

      particles.push({
        x, y,
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp - (60 + Math.random()*160),
        life: 0,
        ttl: 650 + Math.random()*750,
        r: 1.2 + Math.random()*2.8,
        hue: palette.hue,
        sat: palette.sat,
        lum: palette.lum,
        core: palette.core
      });
    }
    while(particles.length > MAX_PARTICLES) particles.shift();
  }

  function spawnRandom(){
    const x = Math.random()*w;
    const y = Math.random()*h*0.9;
    addBurst(x, y, {
      hue: 28,
      sat: 95,
      lum: 58,
      core: "rgba(255,255,255,0.7)"
    });
  }

  function spawnHeart(){
    const cx = w*0.5;
    const cy = h*0.52;
    const s = Math.min(w,h) * 0.020;

    const t = Math.random() * Math.PI * 2;
    const X = 16*Math.pow(Math.sin(t),3);
    const Y = 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t);

    const x = cx + X * (s*30);
    const y = cy - Y * (s*30);

    addBurst(x, y, {
      hue: 24,
      sat: 90,
      lum: 45,
      core: "rgba(255,230,210,0.55)"
    });
  }

  function tick(ts){
    const elapsed = ts - start;

    const inRandom = elapsed < randomMs;
    const inHeart  = elapsed >= randomMs && elapsed < (randomMs + heartMs);

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    if(inRandom){
      ctx.fillStyle = "rgba(255,140,60,0.10)";
    } else if(inHeart){
      ctx.fillStyle = "rgba(220,95,35,0.12)";
    } else {
      ctx.fillStyle = "rgba(0,0,0,0)";
    }
    ctx.fillRect(0,0,w,h);
    ctx.restore();

    if(inRandom){
      if(Math.random() < 0.85) spawnRandom();
      if(Math.random() < 0.55) spawnRandom();
    } else if(inHeart){
      if(Math.random() < 0.90) spawnHeart();
      if(Math.random() < 0.55) spawnHeart();
    }

    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.life += 16.7;
      const t = p.life / p.ttl;

      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 11.0;

      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;

      const a = Math.max(0, 1 - t);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const glowR = p.r * 10;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      g.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.lum+10}%, ${0.35*a})`);
      g.addColorStop(0.35, `hsla(${p.hue}, ${p.sat}%, ${p.lum}%, ${0.22*a})`);
      g.addColorStop(1, "rgba(255,120,50,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = p.core.replace("0.7", (0.7*a).toFixed(3)).replace("0.55", (0.55*a).toFixed(3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r*1.1, 0, Math.PI*2);
      ctx.fill();

      ctx.restore();

      if(p.life >= p.ttl) particles.splice(i, 1);
    }

    if(elapsed < (randomMs + heartMs)){
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      ctx.clearRect(0,0,w,h);
      sparkCanvas.classList.remove("active");
      window.removeEventListener("resize", resize);
    }
  }

  resize();
  window.addEventListener("resize", resize);

  sparkCanvas.classList.add("active");
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0,0,w,h);

  requestAnimationFrame(tick);
}
