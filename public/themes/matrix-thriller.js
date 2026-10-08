(function () {
  const ID = "matrix-thriller";
  const GLYPHS = (() => {
    let g = "";
    for (let c = 0xff66; c <= 0xff9d; c++) g += String.fromCharCode(c);
    return g + "0123456789:.=*+-<>|";
  })();
  const FRAME_MS = 1000 / 30;
  const MAX_DPR = 2;

  let canvas = null, ctx = null, raf = 0, resizeTimer = 0, last = 0;
  let cols = [], size = 18, motionQuery = null, reduced = false;

  const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  const dpr = () => Math.min(window.devicePixelRatio || 1, MAX_DPR);

  function setup() {
    const ratio = dpr();
    canvas.width = Math.ceil(window.innerWidth * ratio);
    canvas.height = Math.ceil(window.innerHeight * ratio);
    size = Math.round(18 * ratio);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const n = Math.ceil(canvas.width / size);
    const rows = Math.ceil(canvas.height / size);
    cols = Array.from({ length: n }, () => ({
      y: Math.floor(Math.random() * -rows),
      speed: 0.5 + Math.random() * 0.8,
      acc: 0
    }));
    if (reduced) drawStatic();
  }

  function drawStatic() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = size + "px monospace";
    ctx.textBaseline = "top";
    const rows = Math.ceil(canvas.height / size);
    for (let i = 0; i < cols.length; i += 4) {
      const len = 4 + Math.floor(Math.random() * 10);
      const top = Math.floor(Math.random() * rows);
      for (let j = 0; j < len; j++) {
        ctx.fillStyle = "rgba(0,255,102," + (0.15 + 0.5 * (j / len)) + ")";
        ctx.fillText(glyph(), i * size, (top + j) * size);
      }
    }
  }

  function frame(now) {
    raf = 0;
    if (!canvas || !canvas.isConnected) { stop(); return; }
    raf = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = size + "px monospace";
    ctx.textBaseline = "top";
    const rows = Math.ceil(canvas.height / size);
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      c.acc += c.speed;
      if (c.acc < 1) continue;
      c.acc -= 1;
      c.y++;
      if (c.y < 0) continue;
      const x = i * size;
      const prev = (c.y - 1) * size;
      if (c.y > 0) {
        ctx.fillStyle = "#00ff41";
        ctx.fillText(glyph(), x, prev);
      }
      ctx.fillStyle = "#e8fff0";
      ctx.fillText(glyph(), x, c.y * size);
      if (c.y > rows && Math.random() > 0.975) {
        c.y = Math.floor(Math.random() * -20);
        c.speed = 0.5 + Math.random() * 0.8;
      }
    }
  }

  function play() {
    if (!raf && !reduced && !document.hidden && canvas) raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onVisibility() { document.hidden ? pause() : play(); }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (canvas) { setup(); play(); } }, 150);
  }

  function onMotionChange() {
    reduced = motionQuery.matches;
    pause();
    setup();
    play();
  }

  function start() {
    stop();
    canvas = document.createElement("canvas");
    canvas.setAttribute("data-theme-decor", "");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0.28;";
    document.body.prepend(canvas);
    ctx = canvas.getContext("2d");
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = motionQuery.matches;
    setup();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
    else motionQuery.addListener(onMotionChange);
    play();
  }

  function stop() {
    pause();
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    if (motionQuery) {
      if (motionQuery.removeEventListener) motionQuery.removeEventListener("change", onMotionChange);
      else motionQuery.removeListener(onMotionChange);
      motionQuery = null;
    }
    if (canvas) canvas.remove();
    canvas = ctx = null;
  }

  window.ThemeDecor = window.ThemeDecor || {};
  window.ThemeDecor[ID] = { start, stop };
})();
