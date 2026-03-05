const startBtn = document.getElementById("startBtn");
const music = document.getElementById("bgMusic");

const tdcCanvas = document.getElementById("tdcCanvas");    // game canvas
const sparkCanvas = document.getElementById("sparkCanvas");
const gameHint = document.getElementById("gameHint");
const fogHint = document.getElementById("fogHint");

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
  initFogHeartGame();
});

/* ---------------- GAME: FOG SWIPE + HEART TAPS ---------------- */
function initFogHeartGame(){
  if(game && typeof game.destroy === "function") game.destroy();

  if(gameHint){
    gameHint.textContent = "Swipe away the layers of fog to reveal the heart.";
  }

  // Show fog hint at the start (fog stage)
  if(fogHint){
    fogHint.style.display = "";
  }

  game = createFogHeartGame({
    canvas: tdcCanvas,
    onFogCleared: () => {
      if(gameHint){
        gameHint.textContent = "Tap the heart to revive it";
      }
      // Hide fog hint after fog is cleared
      if(fogHint){
        fogHint.style.display = "none";
      }
    },
    onRevived: () => winGame() // called AFTER 3s neon hold
  });

  game.start();
}

function winGame(){
  if(game) game.stop();

  // Your already-set fireworks sequence, then reveal
  playFireworksSequence({
    randomMs: 3000,
    heartMs: 1700
  });

  setTimeout(() => {
    finishGame();
  }, 3000 + 1700);
}

/* ---------------- FINISH ---------------- */
function finishGame(){
  document.body.classList.remove("locked");
  document.body.classList.add("scroll-mode");

  document.getElementById("page2")
    ?.scrollIntoView({behavior:"smooth"});
}

/* ---------------- FOG + HEART ENGINE ---------------- */
function createFogHeartGame({ canvas, onFogCleared, onRevived }){
  const ctx = canvas.getContext("2d");

  let w = 0, h = 0;
  let raf = null;

  // Fog / swipe
  const TOTAL_LAYERS = 5;
  let layersLeft = TOTAL_LAYERS;

  // Tap-to-revive
  const TAP_TARGET = 15;
  let taps = 0;

  // State
  let stage = "fog"; // "fog" -> "tap" -> "revived"
  let inputLocked = false;

  // Swipe detection
  let pointerDown = false;
  let lastPt = null;
  let swipeDist = 0;

  // Heart animation
  let heartBeat = 0;   // 0..1 intensity based on taps
  let glow = 0;        // 0..1 neon glow after revive
  let revivedAt = 0;   // timestamp when revived
  let revivedCallbackFired = false;

  function resize(){
    const parent = canvas.parentElement;
    const maxW = Math.min(560, (parent?.clientWidth || 560));
    const maxH = Math.min(420, Math.round(window.innerHeight * 0.42));

    canvas.width  = Math.max(280, Math.floor(maxW));
    canvas.height = Math.max(320, Math.floor(maxH));

    w = canvas.width;
    h = canvas.height;
  }

  function start(){
    stage = "fog";
    layersLeft = TOTAL_LAYERS;
    taps = 0;

    inputLocked = false;
    pointerDown = false;
    lastPt = null;
    swipeDist = 0;

    heartBeat = 0;
    glow = 0;
    revivedAt = 0;
    revivedCallbackFired = false;

    resize();
    window.addEventListener("resize", resize);
    attachInput();

    raf = requestAnimationFrame(tick);
  }

  function stop(){
    if(raf){
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function destroy(){
    stop();
    window.removeEventListener("resize", resize);
    detachInput();
  }

  function tick(ts){
    const targetBeat = Math.min(1, taps / TAP_TARGET);
    heartBeat += (targetBeat - heartBeat) * 0.10;

    if(stage === "revived"){
      glow = Math.min(1, glow + 0.12);

      if(!revivedCallbackFired && (ts - revivedAt) >= 3000){
        revivedCallbackFired = true;
        onRevived?.();
      }
    } else {
      glow = Math.max(0, glow - 0.04);
    }

    drawScene(ts);
    raf = requestAnimationFrame(tick);
  }

  function drawScene(ts){
    ctx.clearRect(0,0,w,h);

    const bg = ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0, "rgba(0,0,0,0.72)");
    bg.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);

    drawHeart(ts);

    if(stage === "fog"){
      drawFogLayers(ts);
    } else if(stage === "tap"){
      drawVignette(0.22);
    } else {
      drawVignette(0.35);
    }
  }

  function drawHeart(ts){
    const cx = w*0.5;
    const cy = h*0.56;
    const base = Math.min(w,h) * 0.215;

    const speed = (2.0 + 4.0*heartBeat);
    const amp   = (0.03 + 0.11*heartBeat);
    const pulse = 1 + amp * Math.sin((ts/1000) * speed * Math.PI);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    const neon = glow;

    ctx.globalCompositeOperation = "screen";
    const halo = ctx.createRadialGradient(0,0,0,0,0,base*3.4);
    halo.addColorStop(0, `rgba(255,120,20,${0.10 + 0.85*neon})`);
    halo.addColorStop(0.25, `rgba(255,160,40,${0.08 + 0.55*neon})`);
    halo.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0,0,base*3.4,0,Math.PI*2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    for(let t=0; t<=Math.PI*2 + 0.01; t += 0.035){
      const x = 16*Math.pow(Math.sin(t),3);
      const y = 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t);
      ctx.lineTo((x/18)*base, (-y/18)*base);
    }
    ctx.closePath();

    const lum = 40 + Math.round(18 * heartBeat) + Math.round(18 * neon);
    const g2 = ctx.createLinearGradient(-base, -base, base, base);
    g2.addColorStop(0, `hsla(22, 100%, ${Math.min(65, lum)}%, 0.98)`);
    g2.addColorStop(1, `hsla(30, 100%, ${Math.max(40, lum-10)}%, 0.98)`);
    ctx.fillStyle = g2;
    ctx.fill();

    ctx.globalCompositeOperation = "screen";
    const coreA = 0.18 + 0.45*heartBeat + 0.40*neon;
    const g3 = ctx.createRadialGradient(-base*0.25,-base*0.20,0,-base*0.25,-base*0.20,base*1.3);
    g3.addColorStop(0, `rgba(255,255,255,${Math.min(0.85, coreA)})`);
    g3.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g3;
    ctx.fill();

    ctx.globalCompositeOperation = "screen";
    ctx.lineWidth = 3.5 + 2.0*neon;
    ctx.strokeStyle = `rgba(255,140,40,${0.35 + 0.70*neon})`;
    ctx.stroke();

    ctx.lineWidth = 8 + 10*neon;
    ctx.strokeStyle = `rgba(255,120,20,${0.05 + 0.30*neon})`;
    ctx.stroke();

    ctx.restore();
  }

  function drawVignette(alpha){
    ctx.save();
    const vg = ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.18,w/2,h/2,Math.max(w,h)*0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  function drawFogLayers(ts){
    const remaining = layersLeft;

    for(let i=0;i<remaining;i++){
      const darknessStep = (remaining - i) / TOTAL_LAYERS;
      const a = Math.min(0.92, 0.55 + 0.35*darknessStep);

      const t = ts/1000;
      const drift = (t * (6 + i*4));

      const gx = (Math.sin(drift*0.35 + i*1.3) * w*0.22);
      const gy = (Math.cos(drift*0.28 + i*1.1) * h*0.16);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = "source-over";

      const grad = ctx.createLinearGradient(0+gx, 0+gy, w-gx, h-gy);
      grad.addColorStop(0, `rgba(8,8,10,0.98)`);
      grad.addColorStop(0.45, `rgba(18,18,20,0.98)`);
      grad.addColorStop(1, `rgba(30,30,32,0.98)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,w,h);

      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = a * 0.85;

      const blobs = 14;
      for(let b=0;b<blobs;b++){
        const x = (w*0.05) + ((b*197 + drift*28) % (w*1.15));
        const y = (h*0.10) + (Math.sin(drift*0.55 + b*1.25) * h*0.16) + (b%7)*h*0.12;

        const r = Math.min(w,h) * (0.18 + (b%4)*0.06);

        const g = ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0, "rgba(70,70,75,0.10)");
        g.addColorStop(0.55, "rgba(35,35,40,0.06)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0,0,w,h);

      ctx.restore();
    }

    drawVignette(0.55);
  }

  /* --------- Input handling --------- */
  function attachInput(){
    const onDown = (e) => {
      if(inputLocked) return;
      const p = getPoint(e);
      pointerDown = true;
      lastPt = p;
      swipeDist = 0;
    };

    const onMove = (e) => {
      if(inputLocked) return;
      if(!pointerDown) return;

      const p = getPoint(e);
      if(!lastPt){ lastPt = p; return; }

      const d = Math.hypot(p.x - lastPt.x, p.y - lastPt.y);
      swipeDist += d;
      lastPt = p;

      if(stage === "fog" && layersLeft > 0 && swipeDist >= 260){
        layersLeft -= 1;
        swipeDist = 0;

        if(layersLeft <= 0){
          stage = "tap";
          onFogCleared?.();
        }
      }
    };

    const onUp = () => {
      pointerDown = false;
      lastPt = null;
      swipeDist = 0;
    };

    const onClickOrTap = (e) => {
      if(inputLocked) return;
      if(stage !== "tap") return;

      const p = getPoint(e);
      if(isInsideHeart(p.x, p.y)){
        taps += 1;

        if(taps >= TAP_TARGET){
          taps = TAP_TARGET;
          stage = "revived";
          inputLocked = true;
          revivedAt = performance.now();
        }
      }
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    canvas.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp, { passive: false });
    window.addEventListener("touchcancel", onUp, { passive: false });

    canvas.addEventListener("click", onClickOrTap);
    canvas.addEventListener("touchend", (e) => {
      if(stage === "tap") onClickOrTap(e);
    }, { passive: false });

    canvas._fhHandlers = { onDown, onMove, onUp, onClickOrTap };
  }

  function detachInput(){
    const hnd = canvas?._fhHandlers;
    if(!hnd) return;

    canvas.removeEventListener("mousedown", hnd.onDown);
    window.removeEventListener("mousemove", hnd.onMove);
    window.removeEventListener("mouseup", hnd.onUp);

    canvas.removeEventListener("touchstart", hnd.onDown);
    window.removeEventListener("touchmove", hnd.onMove);
    window.removeEventListener("touchend", hnd.onUp);
    window.removeEventListener("touchcancel", hnd.onUp);

    canvas.removeEventListener("click", hnd.onClickOrTap);

    canvas._fhHandlers = null;
  }

  function isInsideHeart(x, y){
    const cx = w*0.5;
    const cy = h*0.56;
    const r = Math.min(w,h) * 0.235;
    return Math.hypot(x - cx, y - cy) <= r;
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

  return { start, stop, destroy };
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