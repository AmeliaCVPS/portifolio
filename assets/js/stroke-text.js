const SVG_NS = 'http://www.w3.org/2000/svg';
const DRAW_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

let uid = 0;

export function initStrokeText(container, options = {}) {
  const {
    lines = [],
    strokeColor = '#F0EEE8',
    fillColor = '#F0EEE8',
    strokeWidth = 1.4,
    drawDuration = 1.6,
    fillDelay = 0.2,
    stagger = 0.05,
    fillMode = 'wipe',
    fontSize = 128,
    fontWeight = 800,
    fontFamily = 'inherit',
    letterSpacing = -4,
    lineHeight = 1,
    loopPause = 3
  } = options;

  const wipeId = `stroke-text-wipe-${++uid}`;
  const dash = Math.max(fontSize * 7, 200);
  const useWipe = fillMode === 'wipe';
  const fillEnabled = fillMode !== 'none';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('stroke-text__svg');

  const defs = document.createElementNS(SVG_NS, 'defs');
  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', wipeId);
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const wipeRect = document.createElementNS(SVG_NS, 'rect');
  clip.appendChild(wipeRect);
  defs.appendChild(clip);
  svg.appendChild(defs);

  const applyFont = node => {
    node.style.fontSize = `${fontSize}px`;
    node.style.fontWeight = fontWeight;
    node.style.fontFamily = fontFamily;
    node.style.letterSpacing = `${letterSpacing}px`;
  };

  const buildLayer = kind => {
    const group = document.createElementNS(SVG_NS, 'g');
    const chars = [];

    lines.forEach((segments, lineIndex) => {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', '0');
      text.setAttribute('y', String(lineIndex * fontSize * lineHeight));
      applyFont(text);

      if (kind === 'stroke') {
        text.setAttribute('fill', 'none');
        text.setAttribute('stroke-width', String(strokeWidth));
        text.setAttribute('stroke-linejoin', 'round');
        text.setAttribute('stroke-linecap', 'round');
      } else {
        text.setAttribute('stroke', 'none');
      }

      segments.forEach(segment => {
        Array.from(segment.text).forEach(char => {
          const tspan = document.createElementNS(SVG_NS, 'tspan');
          tspan.textContent = char;
          if (kind === 'stroke') {
            tspan.setAttribute('stroke', segment.strokeColor || strokeColor);
          } else {
            tspan.setAttribute('fill', segment.fillColor || fillColor);
          }
          // Spaces carry no outline, so animating them would just add dead time.
          if (char.trim()) chars.push(tspan);
          text.appendChild(tspan);
        });
      });

      group.appendChild(text);
    });

    return { group, chars };
  };

  const strokeLayer = buildLayer('stroke');
  const fillLayer = buildLayer('fill');

  if (useWipe) fillLayer.group.setAttribute('clip-path', `url(#${wipeId})`);
  svg.append(strokeLayer.group, fillLayer.group);
  container.appendChild(svg);

  const strokes = strokeLayer.chars;
  const fills = fillLayer.chars;
  const cycleTime = drawDuration + stagger * Math.max(strokes.length - 1, 0);
  const fillDuration = Math.max(0.4, drawDuration * 0.5);
  const totalTime = cycleTime + fillDelay + fillDuration;

  let box = null;
  let animations = [];
  let loopTimer = null;
  let running = false;

  function measure() {
    let bbox;
    try {
      bbox = strokeLayer.group.getBBox();
    } catch {
      return false;
    }
    if (!bbox || !bbox.width) return false;

    const pad = Math.max(strokeWidth, fontSize * 0.1);
    box = { x: bbox.x - pad, y: bbox.y - pad, width: bbox.width + pad * 2, height: bbox.height + pad * 2 };
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    svg.style.setProperty('--stroke-text-ratio', String(box.height / box.width));

    wipeRect.setAttribute('x', String(box.x));
    wipeRect.setAttribute('y', String(box.y));
    wipeRect.setAttribute('width', String(box.width));
    wipeRect.setAttribute('height', String(box.height));
    wipeRect.style.transformOrigin = `${box.x}px ${box.y}px`;
    container.classList.add('is-measured');
    return true;
  }

  function clear() {
    animations.forEach(a => a.cancel());
    animations = [];
    clearTimeout(loopTimer);
  }

  function showEndState() {
    clear();
    strokes.forEach(el => {
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
    });
    fills.forEach(el => (el.style.opacity = fillEnabled ? '1' : '0'));
    wipeRect.style.transform = fillEnabled ? 'scaleX(1)' : 'scaleX(0)';
  }

  function playCycle() {
    clear();

    strokes.forEach((el, i) => {
      el.style.strokeDasharray = dash;
      animations.push(
        el.animate([{ strokeDashoffset: dash }, { strokeDashoffset: 0 }], {
          duration: drawDuration * 1000,
          delay: i * stagger * 1000,
          easing: DRAW_EASE,
          fill: 'both'
        })
      );
    });

    if (fillEnabled && useWipe) {
      animations.push(
        wipeRect.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          duration: fillDuration * 1000,
          delay: (cycleTime + fillDelay) * 1000,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          fill: 'both'
        })
      );
    } else if (fillEnabled) {
      fills.forEach((el, i) => {
        animations.push(
          el.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: fillDuration * 1000,
            delay: (cycleTime + fillDelay + i * stagger) * 1000,
            easing: DRAW_EASE,
            fill: 'both'
          })
        );
      });
    }

    loopTimer = setTimeout(playCycle, (totalTime + loopPause) * 1000);
  }

  function prime() {
    fills.forEach(el => (el.style.opacity = useWipe ? '1' : '0'));
    wipeRect.style.transform = 'scaleX(0)';
  }

  const ready = measure()
    ? Promise.resolve()
    : (document.fonts?.ready ?? Promise.resolve()).then(() => {
        measure();
      });

  const api = {
    ready,
    start() {
      if (running || !box) return;
      running = true;
      prime();
      playCycle();
    },
    stop() {
      if (!running) return;
      running = false;
      showEndState();
    },
    showEndState,
    destroy() {
      clear();
      svg.remove();
    }
  };

  prime();
  return api;
}
