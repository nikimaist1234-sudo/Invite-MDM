document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const music = document.getElementById("bgMusic");

  const tdcCanvas = document.getElementById("tdcCanvas");
  const sparkCanvas = document.getElementById("sparkCanvas");
  const gameHint = document.getElementById("gameHint");

  // Quiz elements
  const openQuizBtn = document.getElementById("openQuizBtn");
  const quizBackBtn = document.getElementById("quizBackBtn");
  const quizCloseBtn = document.getElementById("quizCloseBtn");
  const quizFinishBtn = document.getElementById("quizFinishBtn");
  const quizRetryBtn = document.getElementById("quizRetryBtn");
  const quizScreen = document.getElementById("pageQuiz");
  const quizForm = document.getElementById("quizForm");
  const quizResult = document.getElementById("quizResult");
  const quizResultInner = document.getElementById("quizResultInner");
  const quizOverlay = document.getElementById("quizOverlay");
  const resultCover = document.getElementById("resultCover");
  const resultBlurb = document.getElementById("resultBlurb");
  const guestNameInput = document.getElementById("guestName");
  const resultAudio = document.getElementById("resultAudio");

  let game = null;

  // Quiz state
  let _inviteWasPlaying = false;
  let _inviteTime = 0;
  let _scrollYBeforeQuiz = 0;

  // Song data for My Dear Melancholy
  const SONG_KEYS = [
    "hurt-you",
    "i-was-never-there",
    "privilege",
    "try-me",
    "wasted-times",
  ];

  const SONG_PRETTY = {
    "hurt-you": "Hurt You",
    "i-was-never-there": "I Was Never There",
    "privilege": "Privilege",
    "try-me": "Try Me",
    "wasted-times": "Wasted Times",
  };

  const SONG_BLURB = {
    "hurt-you": "You're the guarded heart. You've been hurt before and now you protect yourself by keeping relationships at arm's length. Deep down, you just want to love without pain.",
    "i-was-never-there": "You're the elusive phantom. Present but never fully there, you leave people wondering if you were ever real. You understand love but struggle to hold onto it.",
    "privilege": "You're the self-aware rebel. You know your patterns and your flaws, and you own them unapologetically. You'll be back to your old ways, and you're okay with that.",
    "try-me": "You're the confident comeback. Smooth, seductive, and always ready for round two. You never really left their mind, and you know it.",
    "wasted-times": "You're the reluctant romantic. You try to guard your heart, but feelings creep in anyway. You catch yourself caring when you swore you wouldn't.",
  };

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
    let tabSize = 0;

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

      boardSize = Math.min(w * 0.56, h * 0.56);
      pieceSize = boardSize / COLS;
      tabSize = pieceSize * 0.20;
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

      const edgeMap = createEdgeMap(ROWS, COLS);

      for(let row = 0; row < ROWS; row++){
        for(let col = 0; col < COLS; col++){
          const id = row * COLS + col;

          pieces.push({
            id,
            correctRow: row,
            correctCol: col,
            currentX: 0,
            currentY: 0,
            placed: false,
            edges: edgeMap[row][col]
          });
        }
      }

      shuffleArray(pieces);
      window.addEventListener("resize", resize);
    }

    function createEdgeMap(rows, cols){
      const map = [];

      for(let r = 0; r < rows; r++){
        map[r] = [];
        for(let c = 0; c < cols; c++){
          map[r][c] = { top: 0, right: 0, bottom: 0, left: 0 };
        }
      }

      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          if(c < cols - 1){
            const val = Math.random() > 0.5 ? 1 : -1;
            map[r][c].right = val;
            map[r][c + 1].left = -val;
          }
          if(r < rows - 1){
            const val = Math.random() > 0.5 ? 1 : -1;
            map[r][c].bottom = val;
            map[r + 1][c].top = -val;
          }
        }
      }

      for(let c = 0; c < cols; c++){
        map[0][c].top = 0;
        map[rows - 1][c].bottom = 0;
      }
      for(let r = 0; r < rows; r++){
        map[r][0].left = 0;
        map[r][cols - 1].right = 0;
      }

      return map;
    }

    function repositionPiecesNeatly(){
      const loose = pieces.filter(p => !p.placed && p !== draggingPiece);

      const leftX = boardX - pieceSize - tabSize - 28;
      const rightX = boardX + boardSize + 28;
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
        { x: boardX, y: boardY - pieceSize - tabSize - 24 },
        { x: boardX + pieceSize, y: boardY - pieceSize - tabSize - 24 },
        { x: boardX + pieceSize / 2, y: boardY + boardSize + 24 }
      ];

      loose.forEach((piece, i) => {
        const pos = neatPositions[i % neatPositions.length];

        piece.currentX = clamp(pos.x, tabSize + 8, w - pieceSize - tabSize - 8);
        piece.currentY = clamp(pos.y, tabSize + 8, h - pieceSize - tabSize - 8);
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

      // Deep orange background tint
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(255,100,0,0.15)");
      bg.addColorStop(1, "rgba(255,80,0,0.25)");
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
      g.addColorStop(0, "rgba(255,140,0,0.25)");
      g.addColorStop(1, "rgba(255,140,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    function drawBoardSlots(){
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.strokeStyle = "rgba(255,140,0,0.3)";
      ctx.lineWidth = 1.2;

      for(let row = 0; row < ROWS; row++){
        for(let col = 0; col < COLS; col++){
          const piece = getPieceByCorrectPos(row, col);
          const x = boardX + col * pieceSize;
          const y = boardY + row * pieceSize;
          const path = buildPiecePath(x, y, piece.edges);

          ctx.fill(path);
          ctx.stroke(path);
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
      const path = buildPiecePath(piece.currentX, piece.currentY, piece.edges);

      const imgCellW = img.width / COLS;
      const imgCellH = img.height / ROWS;

      const sx = piece.correctCol * imgCellW - (piece.edges.left === 1 ? imgCellW * (tabSize / pieceSize) : 0);
      const sy = piece.correctRow * imgCellH - (piece.edges.top === 1 ? imgCellH * (tabSize / pieceSize) : 0);

      const sw =
        imgCellW +
        (piece.edges.left === 1 ? imgCellW * (tabSize / pieceSize) : 0) +
        (piece.edges.right === 1 ? imgCellW * (tabSize / pieceSize) : 0);

      const sh =
        imgCellH +
        (piece.edges.top === 1 ? imgCellH * (tabSize / pieceSize) : 0) +
        (piece.edges.bottom === 1 ? imgCellH * (tabSize / pieceSize) : 0);

      const dx = piece.currentX - (piece.edges.left === 1 ? tabSize : 0);
      const dy = piece.currentY - (piece.edges.top === 1 ? tabSize : 0);
      const dw =
        pieceSize +
        (piece.edges.left === 1 ? tabSize : 0) +
        (piece.edges.right === 1 ? tabSize : 0);
      const dh =
        pieceSize +
        (piece.edges.top === 1 ? tabSize : 0) +
        (piece.edges.bottom === 1 ? tabSize : 0);

      ctx.save();

      if (isDragging) {
        ctx.shadowColor = "rgba(255,140,0,0.6)";
        ctx.shadowBlur = 20;
      }

      ctx.save();
      ctx.clip(path);
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();

      const outline = ctx.createLinearGradient(
        piece.currentX,
        piece.currentY,
        piece.currentX + pieceSize,
        piece.currentY + pieceSize
      );
      outline.addColorStop(0, isDragging ? "rgba(255,200,100,0.95)" : "rgba(255,255,255,0.24)");
      outline.addColorStop(1, isDragging ? "rgba(255,140,0,0.9)" : "rgba(255,180,120,0.14)");

      ctx.strokeStyle = outline;
      ctx.lineWidth = isDragging ? 2.6 : 1.2;
      ctx.stroke(path);

      ctx.restore();
    }

    function drawGridLines(){
      ctx.save();
      ctx.strokeStyle = "rgba(255,140,0,0.1)";
      ctx.lineWidth = 1;

      for(let i = 1; i < COLS; i++){
        const x = boardX + i * pieceSize;
        ctx.beginPath();
        ctx.moveTo(x, boardY - tabSize * 0.15);
        ctx.lineTo(x, boardY + boardSize + tabSize * 0.15);
        ctx.stroke();
      }

      for(let i = 1; i < ROWS; i++){
        const y = boardY + i * pieceSize;
        ctx.beginPath();
        ctx.moveTo(boardX - tabSize * 0.15, y);
        ctx.lineTo(boardX + boardSize + tabSize * 0.15, y);
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
      ctx.strokeRect(boardX - 4, boardY - 4, boardSize + 8, boardSize + 8);
      ctx.restore();
    }

    function buildPiecePath(x, y, edges){
      const s = pieceSize;
      const t = tabSize;
      const neck = s * 0.22;
      const knob = s * 0.10;

      const path = new Path2D();

      path.moveTo(x, y);

      if(edges.top === 0){
        path.lineTo(x + s, y);
      } else {
        path.lineTo(x + s * 0.28, y);
        path.bezierCurveTo(
          x + s * 0.36, y,
          x + s * 0.36, y - edges.top * knob,
          x + s * 0.5 - neck, y - edges.top * t
        );
        path.bezierCurveTo(
          x + s * 0.5 - knob, y - edges.top * t,
          x + s * 0.5 + knob, y - edges.top * t,
          x + s * 0.5 + neck, y - edges.top * t
        );
        path.bezierCurveTo(
          x + s * 0.64, y - edges.top * knob,
          x + s * 0.64, y,
          x + s * 0.72, y
        );
        path.lineTo(x + s, y);
      }

      if(edges.right === 0){
        path.lineTo(x + s, y + s);
      } else {
        path.lineTo(x + s, y + s * 0.28);
        path.bezierCurveTo(
          x + s, y + s * 0.36,
          x + s + edges.right * knob, y + s * 0.36,
          x + s + edges.right * t, y + s * 0.5 - neck
        );
        path.bezierCurveTo(
          x + s + edges.right * t, y + s * 0.5 - knob,
          x + s + edges.right * t, y + s * 0.5 + knob,
          x + s + edges.right * t, y + s * 0.5 + neck
        );
        path.bezierCurveTo(
          x + s + edges.right * knob, y + s * 0.64,
          x + s, y + s * 0.64,
          x + s, y + s * 0.72
        );
        path.lineTo(x + s, y + s);
      }

      if(edges.bottom === 0){
        path.lineTo(x, y + s);
      } else {
        path.lineTo(x + s * 0.72, y + s);
        path.bezierCurveTo(
          x + s * 0.64, y + s,
          x + s * 0.64, y + s + edges.bottom * knob,
          x + s * 0.5 + neck, y + s + edges.bottom * t
        );
        path.bezierCurveTo(
          x + s * 0.5 + knob, y + s + edges.bottom * t,
          x + s * 0.5 - knob, y + s + edges.bottom * t,
          x + s * 0.5 - neck, y + s + edges.bottom * t
        );
        path.bezierCurveTo(
          x + s * 0.36, y + s + edges.bottom * knob,
          x + s * 0.36, y + s,
          x + s * 0.28, y + s
        );
        path.lineTo(x, y + s);
      }

      if(edges.left === 0){
        path.closePath();
      } else {
        path.lineTo(x, y + s * 0.72);
        path.bezierCurveTo(
          x, y + s * 0.64,
          x - edges.left * knob, y + s * 0.64,
          x - edges.left * t, y + s * 0.5 + neck
        );
        path.bezierCurveTo(
          x - edges.left * t, y + s * 0.5 + knob,
          x - edges.left * t, y + s * 0.5 - knob,
          x - edges.left * t, y + s * 0.5 - neck
        );
        path.bezierCurveTo(
          x - edges.left * knob, y + s * 0.36,
          x, y + s * 0.36,
          x, y + s * 0.28
        );
        path.closePath();
      }

      return path;
    }

    function getPieceByCorrectPos(row, col){
      return pieces.find(p => p.correctRow === row && p.correctCol === col);
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

        const path = buildPiecePath(piece.currentX, piece.currentY, piece.edges);

        if (ctx.isPointInPath(path, p.x, p.y)) {
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
      draggingPiece.currentX = clamp(
        p.x - dragOffsetX,
        tabSize + 4,
        w - pieceSize - tabSize - 4
      );
      draggingPiece.currentY = clamp(
        p.y - dragOffsetY,
        tabSize + 4,
        h - pieceSize - tabSize - 4
      );
    }

    function onUp(e){
      if (!inputEnabled || !draggingPiece || solved) return;

      const piece = draggingPiece;
      draggingPiece = null;

      const targetX = boardX + piece.correctCol * pieceSize;
      const targetY = boardY + piece.correctRow * pieceSize;

      const dist = Math.hypot(piece.currentX - targetX, piece.currentY - targetY);
      const snapThreshold = pieceSize * 0.42;

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

  /* ===========================
     QUIZ (My Dear Melancholy)
     =========================== */

  function stopResultAudio() {
    if (!resultAudio) return;
    resultAudio.pause();
    resultAudio.currentTime = 0;
    resultAudio.removeAttribute("src");
  }

  function enterQuizAudioMode() {
    stopResultAudio();

    if (!music) return;
    _inviteWasPlaying = !music.paused;
    _inviteTime = music.currentTime || 0;
    music.pause();
  }

  function exitQuizAudioMode() {
    stopResultAudio();

    if (!music) return;
    if (_inviteWasPlaying) {
      try { music.currentTime = _inviteTime || 0; } catch (e) {}
      music.play().catch(() => {});
    }
  }

  function resetQuizUI() {
    quizForm?.reset();

    if (quizResult) quizResult.style.display = "none";
    if (quizResultInner) {
      quizResultInner.classList.remove("show");
      quizResultInner.innerHTML = "";
    }
    if (resultCover) {
      resultCover.classList.remove("show");
      resultCover.removeAttribute("src");
    }
    if (resultBlurb) resultBlurb.textContent = "";
    quizOverlay?.classList.remove("on");
  }

  function openQuiz() {
    _scrollYBeforeQuiz = window.scrollY || 0;
    enterQuizAudioMode();
    resetQuizUI();

    document.body.classList.add("quiz-open");
    quizScreen?.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      if (quizScreen) quizScreen.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 0);
  }

  function closeQuiz() {
    document.body.classList.remove("quiz-open");
    quizScreen?.setAttribute("aria-hidden", "true");
    stopResultAudio();

    setTimeout(() => {
      window.scrollTo({ top: _scrollYBeforeQuiz, behavior: "auto" });
    }, 0);

    exitQuizAudioMode();
  }

  function computeQuizResult() {
    if (!quizForm) return { error: "Quiz not found." };

    const guestName = (guestNameInput?.value || "").trim();
    if (!guestName) return { error: "Enter your name first." };

    const data = new FormData(quizForm);

    for (let i = 1; i <= 6; i++) {
      if (!data.get("q" + i)) return { error: "Answer all 6 questions first." };
    }

    const scores = Object.fromEntries(SONG_KEYS.map(k => [k, 0]));

    for (const [key, value] of data.entries()) {
      if (key === "guestName") continue;
      if (scores[value] !== undefined) scores[value] += 1;
    }

    const max = Math.max(...Object.values(scores));
    const top = Object.keys(scores).filter(k => scores[k] === max);
    const chosen = top[Math.floor(Math.random() * top.length)];

    return { chosen, guestName };
  }

  function playResultSong(songKey) {
    music?.pause();

    if (resultCover) {
      resultCover.src = `${songKey}.jpg`;
      resultCover.classList.add("show");
    }

    if (resultAudio) {
      resultAudio.pause();
      resultAudio.currentTime = 0;
      resultAudio.src = `${songKey}.mp3`;
      resultAudio.load();
      resultAudio.play().catch(() => {});
    }
  }

  function revealQuizResult(songKey, guestName) {
    if (!quizResult || !quizResultInner) return;

    quizResult.style.display = "block";

    quizResultInner.classList.remove("show");
    quizResultInner.innerHTML = `
      <h2>${guestName}, you are <span>${SONG_PRETTY[songKey] || "a Mystery Track"}</span></h2>
    `;

    if (resultBlurb) resultBlurb.textContent = SONG_BLURB[songKey] || "";

    if (quizOverlay) {
      quizOverlay.classList.add("on");
      setTimeout(() => quizOverlay.classList.remove("on"), 900);
    }

    requestAnimationFrame(() => quizResultInner.classList.add("show"));

    playResultSong(songKey);

    const scrollToFullResult = () => {
      quizResult.scrollIntoView({ behavior: "smooth", block: "start" });

      setTimeout(() => {
        window.scrollBy({ top: 140, left: 0, behavior: "smooth" });
      }, 350);

      setTimeout(() => {
        window.scrollBy({ top: 80, left: 0, behavior: "smooth" });
      }, 900);
    };

    setTimeout(scrollToFullResult, 180);

    if (resultCover) {
      resultCover.onload = () => setTimeout(scrollToFullResult, 80);
    }
  }

  openQuizBtn?.addEventListener("click", openQuiz);
  quizBackBtn?.addEventListener("click", closeQuiz);
  quizCloseBtn?.addEventListener("click", closeQuiz);

  quizRetryBtn?.addEventListener("click", () => {
    resetQuizUI();
    stopResultAudio();
    if (quizScreen) quizScreen.scrollTop = 0;
  });

  quizFinishBtn?.addEventListener("click", () => {
    const res = computeQuizResult();

    if (res.error) {
      if (!quizResult || !quizResultInner) return;
      quizResult.style.display = "block";
      quizResultInner.classList.remove("show");
      quizResultInner.innerHTML = `<h2>Hold up</h2><p>${res.error}</p>`;
      if (resultBlurb) resultBlurb.textContent = "";
      requestAnimationFrame(() => quizResultInner.classList.add("show"));
      setTimeout(() => quizResult.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return;
    }

    revealQuizResult(res.chosen, res.guestName);
  });
});
