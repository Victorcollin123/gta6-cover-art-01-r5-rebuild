// Vice Booth editor: wires the controls, drag-to-pan and scroll-to-zoom on the
// preview, and the one-click PNG exports. `?shot=` scenes live in shots.js.
import { GRADES, ONE_PHOTO_FRAMES, SIZES, drawCover } from './strip.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const status = document.getElementById('status');
const sizeSelect = document.getElementById('size');
const frameSlots = document.getElementById('frame-slots');

const state = {
  mode: 'one',
  onePhoto: null,
  photos: [null, null, null, null],
  frames: ONE_PHOTO_FRAMES.map((f) => ({ ...f })),
  grade: 'sunset',
  grain: true,
  vignette: true,
  title: 'VICE BOOTH',
  subtitle: 'SUNSET HEIST',
  date: 'NOV 21 2026',
  size: '1080x1350',
};

let frameRects = [];
let selected = 0;
let dragging = null;

function currentSize() {
  return SIZES.find((s) => s.id === state.size) ?? SIZES[0];
}

function redraw() {
  const { w, h } = currentSize();
  frameRects = drawCover(canvas, w, h, state);
  // Highlight the selected frame on the preview.
  if (frameRects[selected]) {
    const ctx = canvas.getContext('2d');
    const r = frameRects[selected];
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(3, canvas.width * 0.004);
    ctx.setLineDash([14, 8]);
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    ctx.restore();
  }
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function say(text) {
  status.textContent = text;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  frameSlots.hidden = mode !== 'four';
  redraw();
}

function applyGrade(key) {
  state.grade = key;
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === key);
  });
  redraw();
}

/** Exports the current cover at w x h and returns a PNG data URL. */
export function exportPNG(w, h) {
  const off = document.createElement('canvas');
  drawCover(off, w, h, state);
  return off.toDataURL('image/png');
}
window.__exportPNG = exportPNG;

function downloadExport() {
  const { w, h, id } = currentSize();
  const a = document.createElement('a');
  a.href = exportPNG(w, h);
  a.download = `vice-booth-${id}.png`;
  a.click();
  say(`Saved vice-booth-${id}.png (${w} x ${h}).`);
}

// --- Controls ---------------------------------------------------------------

document.getElementById('photo-one').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.onePhoto = await loadImage(URL.createObjectURL(file));
  state.frames = ONE_PHOTO_FRAMES.map((f) => ({ ...f }));
  say(`Loaded ${file.name} into all four frames. Drag a frame to pan, scroll to zoom.`);
  redraw();
});

for (let i = 0; i < 4; i += 1) {
  const input = document.getElementById(`photo-${i}`);
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    state.photos[i] = await loadImage(URL.createObjectURL(file));
    selected = i;
    say(`Frame ${i + 1} now uses ${file.name}.`);
    redraw();
  });
}

document.querySelectorAll('[data-mode]').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => applyGrade(b.dataset.grade));
});
document.getElementById('grain').addEventListener('change', (e) => {
  state.grain = e.target.checked;
  redraw();
});
document.getElementById('vignette').addEventListener('change', (e) => {
  state.vignette = e.target.checked;
  redraw();
});
titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});
sizeSelect.addEventListener('change', () => {
  state.size = sizeSelect.value;
  redraw();
});
document.getElementById('export').addEventListener('click', downloadExport);
document.getElementById('reset-crops').addEventListener('click', () => {
  state.frames = ONE_PHOTO_FRAMES.map((f) => ({ ...f }));
  say('Crops reset to the four booth presets.');
  redraw();
});

// --- Drag to pan, scroll to zoom -------------------------------------------

function frameAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  for (let i = 0; i < frameRects.length; i += 1) {
    const r = frameRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const i = frameAt(e.clientX, e.clientY);
  if (i === -1) return;
  selected = i;
  const box = canvas.getBoundingClientRect();
  dragging = { i, x: e.clientX, y: e.clientY, scaleX: canvas.width / box.width };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const f = state.frames[dragging.i];
  const r = frameRects[dragging.i];
  f.dx += ((e.clientX - dragging.x) * dragging.scaleX) / r.w;
  f.dy += ((e.clientY - dragging.y) * dragging.scaleX) / r.h;
  f.dx = Math.max(-0.6, Math.min(0.6, f.dx));
  f.dy = Math.max(-0.6, Math.min(0.6, f.dy));
  dragging.x = e.clientX;
  dragging.y = e.clientY;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  dragging = null;
});
canvas.addEventListener('wheel', (e) => {
  const i = frameAt(e.clientX, e.clientY);
  if (i === -1) return;
  e.preventDefault();
  const f = state.frames[i];
  selected = i;
  f.zoom *= e.deltaY < 0 ? 1.1 : 0.9;
  f.zoom = Math.max(0.6, Math.min(4, f.zoom));
  redraw();
}, { passive: false });

// --- Shot scenes for screenshots -------------------------------------------

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    state, applyGrade, setMode, loadImage, redraw, say,
  });
} else {
  redraw();
}
