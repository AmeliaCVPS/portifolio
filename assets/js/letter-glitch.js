const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789';

const hexToRgb = (hex) => {
  const h = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) => r + r + g + g + b + b);
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 255, g: 255, b: 255 };
};

export function initLetterGlitch(container, options = {}) {
  const {
    glitchColors = ['#EF4444', '#ffffff', '#EAB308'],
    glitchSpeed = 50,
    smooth = true,
    centerVignette = false,
    outerVignette = false,
    characters = DEFAULT_CHARS,
    fontSize = 16,
    charWidth = 10,
    charHeight = 20
  } = options;

  if (!container) return null;

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  container.appendChild(canvas);

  const addVignette = (background) => {
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', inset: '0', pointerEvents: 'none', background });
    container.appendChild(el);
  };
  if (outerVignette) addVignette('radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,1) 100%)');
  if (centerVignette) addVignette('radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%)');

  const ctx = canvas.getContext('2d', { alpha: true });
  const palette = glitchColors.map(hexToRgb);

  let letters = [];
  let columns = 0;
  let rafId = null;
  let running = false;
  let lastGlitch = 0;
  let size = { w: 0, h: 0 };

  const randomChar = () => characters[(Math.random() * characters.length) | 0];
  const randomColor = () => palette[(Math.random() * palette.length) | 0];
  const rgbString = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;

  function build() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    // Rails are narrow, so a device-pixel canvas here is affordable and keeps the
    // glyph edges from smearing on high-DPI screens.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    size = { w, h };

    columns = Math.ceil(w / charWidth);
    const rows = Math.ceil(h / charHeight);
    letters = Array.from({ length: columns * rows }, () => {
      const color = randomColor();
      return { char: randomChar(), color, target: color, progress: 1 };
    });
    draw();
  }

  function draw() {
    if (!letters.length) return;
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.font = `${fontSize}px ${getComputedStyle(container).getPropertyValue('--font-mono') || 'monospace'}`;
    ctx.textBaseline = 'top';
    for (let i = 0; i < letters.length; i++) {
      const l = letters[i];
      ctx.fillStyle = rgbString(l.color);
      ctx.fillText(l.char, (i % columns) * charWidth, ((i / columns) | 0) * charHeight);
    }
  }

  function mutate() {
    const count = Math.max(1, (letters.length * 0.05) | 0);
    for (let i = 0; i < count; i++) {
      const l = letters[(Math.random() * letters.length) | 0];
      if (!l) continue;
      l.char = randomChar();
      l.target = randomColor();
      if (smooth) {
        l.from = l.color;
        l.progress = 0;
      } else {
        l.color = l.target;
        l.progress = 1;
      }
    }
  }

  function advanceColors() {
    let redraw = false;
    for (let i = 0; i < letters.length; i++) {
      const l = letters[i];
      if (l.progress >= 1) continue;
      l.progress = Math.min(1, l.progress + 0.05);
      const from = l.from || l.color;
      l.color = {
        r: Math.round(from.r + (l.target.r - from.r) * l.progress),
        g: Math.round(from.g + (l.target.g - from.g) * l.progress),
        b: Math.round(from.b + (l.target.b - from.b) * l.progress)
      };
      redraw = true;
    }
    return redraw;
  }

  function frame(now) {
    if (now - lastGlitch >= glitchSpeed) {
      mutate();
      draw();
      lastGlitch = now;
    } else if (smooth && advanceColors()) {
      draw();
    }
    rafId = requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 120);
  };

  const observer = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
  if (observer) observer.observe(container);
  else window.addEventListener('resize', onResize);

  build();

  return {
    start() {
      if (running) return;
      running = true;
      lastGlitch = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    /** Paints one frame without starting the loop, for reduced-motion visitors. */
    showStatic() {
      build();
    },
    destroy() {
      this.stop();
      clearTimeout(resizeTimer);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', onResize);
      canvas.remove();
    }
  };
}
