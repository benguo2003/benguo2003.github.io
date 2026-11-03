// Theme switch animation: a glowing wave ripples out from the toggle and leaves a
// full-screen contribution graph in the new theme behind it; the page flips while
// it's covered, then a second wave breaks the graph apart to reveal it. Drawn on
// one canvas (no page snapshots), so it stays cheap at 4K.

const COVER_SPREAD = 240; // ms for the cover wave to cross the screen
const REVEAL_SPREAD = 260;
const JITTER = 60; // per-tile random delay, so the wave looks organic
const TILE_IN = 180;
const TILE_OUT = 190;
const HOLD = 70; // linger on the full-screen graph while the theme flips
const SHADES = 16; // colors are quantized so tiles can be batched per fill
const LEVEL_ODDS = [0.36, 0.3, 0.18, 0.1, 0.06]; // how often each heat level appears

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInCubic = (t) => t * t * t;

function parseColor(str) {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = str;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}

/** Read the target theme's tokens by computing them on a detached probe element. */
function themeColors(theme) {
  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.display = "none";
  document.body.append(probe);
  const css = getComputedStyle(probe);
  const read = (name) => css.getPropertyValue(name).trim();
  const colors = { page: read("--page"), heat: [0, 1, 2, 3, 4].map((l) => parseColor(read(`--heat-${l}`))) };
  probe.remove();
  return colors;
}

/** SHADES colors blending from RGB `a` to RGB `b`. */
function blend(a, b) {
  return Array.from({ length: SHADES }, (_, i) => {
    const f = i / (SHADES - 1);
    const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
    return `rgb(${c[0]} ${c[1]} ${c[2]})`;
  });
}

function pickLevel() {
  let r = Math.random();
  for (let l = 0; l < LEVEL_ODDS.length; l++) {
    if ((r -= LEVEL_ODDS[l]) < 0) return l;
  }
  return 0;
}

export function playThemeTransition({ x, y, theme, onCovered }) {
  return new Promise((resolve) => {
    const { page, heat } = themeColors(theme);
    // Per heat level: shades from the wavefront glow settling into that level.
    const settleRamps = heat.map((c) => blend(heat[4], c));

    const w = innerWidth;
    const h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: `${w}px`, height: `${h}px`, zIndex: "9999", pointerEvents: "none" });
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Grid sized to roughly 72 tiles across, whatever the resolution.
    const cell = Math.min(40, Math.max(18, w / 72));
    const inner = cell * 0.8;
    const cols = Math.ceil(w / cell) + 1;
    const rows = Math.ceil(h / cell) + 1;
    const maxDist = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * cell + cell / 2;
        const cy = r * cell + cell / 2;
        const d = Math.hypot(cx - x, cy - y) / maxDist;
        tiles.push({ cx, cy, d, jitter: Math.random() * JITTER, level: pickLevel() });
      }
    }

    const switchAt = COVER_SPREAD + JITTER + TILE_IN;
    const revealAt = switchAt + HOLD;
    const end = revealAt + REVEAL_SPREAD + JITTER + TILE_OUT;
    // Backing cells in the new page color (square, so the cover is seamless), then
    // one bucket per (heat level, shade) for the rounded graph squares on top.
    const cells = [];
    const squares = Array.from({ length: heat.length * SHADES }, () => []);
    let switched = false;
    let start = null;

    const finish = () => {
      canvas.remove();
      if (!switched) onCovered();
      resolve();
    };

    const draw = (now) => {
      start ??= now;
      const t = now - start;
      if (!switched && t >= switchAt) {
        switched = true;
        onCovered();
      }

      cells.length = 0;
      for (const b of squares) b.length = 0;
      for (const tile of tiles) {
        let cellSize;
        let squareSize;
        let shade; // 0 = full wavefront glow, 1 = settled heat level
        if (t < revealAt) {
          const p = clamp01((t - tile.d * COVER_SPREAD - tile.jitter) / TILE_IN);
          if (p <= 0) continue;
          cellSize = (cell + 1) * easeOutCubic(p); // +1px overlap hides seams
          squareSize = inner * easeOutBack(p);
          shade = clamp01((p - 0.35) / 0.65);
        } else {
          const q = clamp01((t - revealAt - tile.d * REVEAL_SPREAD - tile.jitter) / TILE_OUT);
          if (q >= 1) continue;
          const k = 1 - easeInCubic(q);
          cellSize = (cell + 1) * k;
          squareSize = inner * k;
          shade = 1 - clamp01(q / 0.4);
        }
        if (cellSize > 0.5) cells.push(tile.cx, tile.cy, cellSize);
        if (squareSize > 0.5) squares[tile.level * SHADES + Math.round(shade * (SHADES - 1))].push(tile.cx, tile.cy, squareSize);
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = page;
      ctx.beginPath();
      for (let k = 0; k < cells.length; k += 3) {
        const s = cells[k + 2];
        ctx.rect(cells[k] - s / 2, cells[k + 1] - s / 2, s, s);
      }
      ctx.fill();
      squares.forEach((list, i) => {
        if (!list.length) return;
        ctx.fillStyle = settleRamps[Math.floor(i / SHADES)][i % SHADES];
        ctx.beginPath();
        for (let k = 0; k < list.length; k += 3) {
          const s = list[k + 2];
          ctx.roundRect(list[k] - s / 2, list[k + 1] - s / 2, s, s, s * 0.2);
        }
        ctx.fill();
      });

      if (t < end) requestAnimationFrame(frame);
      else finish();
    };

    const frame = (now) => {
      try {
        draw(now);
      } catch (err) {
        // Never leave the page covered or the toggle locked.
        console.error(err);
        finish();
      }
    };
    requestAnimationFrame(frame);
  });
}
