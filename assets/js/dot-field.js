const TWO_PI = Math.PI * 2;

export function initDotField(container, options = {}) {
  const {
    dotRadius = 1.5,
    dotSpacing = 14,
    cursorRadius = 420,
    bulgeStrength = 105,
    glowRadius = 210,
    sparkle = true,
    gradientFrom = 'rgba(200, 185, 122, 0.30)',
    gradientTo = 'rgba(166, 61, 64, 0.22)',
    glowColor = 'rgba(200, 185, 122, 0.10)'
  } = options;

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  container.appendChild(canvas);

  const glow = document.createElement('div');
  Object.assign(glow.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${glowRadius * 2}px`,
    height: `${glowRadius * 2}px`,
    marginLeft: `${-glowRadius}px`,
    marginTop: `${-glowRadius}px`,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
    pointerEvents: 'none',
    opacity: '0',
    willChange: 'transform, opacity'
  });
  container.appendChild(glow);

  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let dots = [];
  let size = { w: 0, h: 0 };
  const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };
  let engagement = 0;
  let glowOpacity = 0;
  let frameCount = 0;
  let rafId = null;
  let running = false;
  let resizeTimer;

  function buildDots(w, h) {
    const step = dotRadius + dotSpacing;
    const cols = Math.floor(w / step);
    const rows = Math.floor(h / step);
    const padX = (w % step) / 2;
    const padY = (h % step) / 2;
    const next = new Array(rows * cols);
    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ax = padX + col * step + step / 2;
        const ay = padY + row * step + step / 2;
        next[idx++] = { ax, ay, sx: ax, sy: ay };
      }
    }
    dots = next;
  }

  function doResize() {
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = { w, h };
    buildDots(w, h);
    if (!running) draw();
  }

  function draw() {
    const { w, h } = size;
    const rad = dotRadius / 2;
    const crSq = cursorRadius * cursorRadius;

    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, gradientFrom);
    grad.addColorStop(1, gradientTo);
    ctx.fillStyle = grad;
    ctx.beginPath();

    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const dx = mouse.x - d.ax;
      const dy = mouse.y - d.ay;
      const distSq = dx * dx + dy * dy;

      if (distSq < crSq && engagement > 0.01) {
        const dist = Math.sqrt(distSq);
        const falloff = 1 - dist / cursorRadius;
        const push = falloff * falloff * bulgeStrength * engagement;
        const angle = Math.atan2(dy, dx);
        d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
        d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
      } else {
        d.sx += (d.ax - d.sx) * 0.1;
        d.sy += (d.ay - d.sy) * 0.1;
      }

      let r = rad;
      if (sparkle) {
        const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
        if (hash % 100 < 3) r = rad * 1.8;
      }
      ctx.moveTo(d.sx + r, d.sy);
      ctx.arc(d.sx, d.sy, r, 0, TWO_PI);
    }

    ctx.fill();
  }

  function tick() {
    frameCount++;
    const target = Math.min(mouse.speed / 5, 1);
    engagement += (target - engagement) * 0.06;
    if (engagement < 0.001) engagement = 0;
    glowOpacity += (engagement - glowOpacity) * 0.08;

    glow.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;
    glow.style.opacity = glowOpacity;

    draw();
    rafId = requestAnimationFrame(tick);
  }

  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  function updateMouseSpeed() {
    const dx = mouse.prevX - mouse.x;
    const dy = mouse.prevY - mouse.y;
    mouse.speed += (Math.sqrt(dx * dx + dy * dy) - mouse.speed) * 0.5;
    if (mouse.speed < 0.001) mouse.speed = 0;
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(doResize, 100);
  }

  let speedInterval = null;
  doResize();
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(doResize);
  ro.observe(container);

  return {
    start() {
      if (running) return;
      running = true;
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      speedInterval = setInterval(updateMouseSpeed, 20);
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      window.removeEventListener('mousemove', onMouseMove);
      clearInterval(speedInterval);
      cancelAnimationFrame(rafId);
      glow.style.opacity = '0';
    },
    destroy() {
      this.stop();
      clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      canvas.remove();
      glow.remove();
    }
  };
}
