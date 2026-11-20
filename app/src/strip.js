// Vice Booth cover renderer: draws the whole export (procedural Vice City
// backdrop + photo-booth strip with four frames, title block and date stamp)
// onto any 2D canvas at any size. No assets, no network, no fonts to fetch:
// lettering is heavy system sans with stroke + offset shadow.

/** Deterministic PRNG so the backdrop is the same on every export. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.45) sepia(0.28) contrast(1.06) brightness(1.02)',
    tint: 'rgba(255, 110, 60, 0.20)',
    sky: ['#1b0b33', '#7a1e5e', '#e8436b', '#ff8a4c', '#ffc46b'],
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.7) hue-rotate(-18deg) contrast(1.1) brightness(0.94)',
    tint: 'rgba(255, 46, 136, 0.22)',
    sky: ['#050214', '#1c0b4a', '#4b1d8f', '#b01e7e', '#ff5e7a'],
  },
  pastel: {
    label: 'Pastel Vice',
    filter: 'saturate(0.95) brightness(1.12) contrast(0.94)',
    tint: 'rgba(255, 170, 210, 0.18)',
    sky: ['#3b2d6b', '#8a5fa8', '#e78fb3', '#ffb3c8', '#ffe3a3'],
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.22) brightness(0.96)',
    tint: 'rgba(120, 120, 140, 0.16)',
    sky: ['#0a0a12', '#23232e', '#4a4a58', '#7d7d8c', '#b9b9c4'],
  },
};

/**
 * Default per-frame crops when one photo fills all four frames.
 *
 * Frames are wide panoramic slices (frame height is ~1/3 of frame width),
 * so dy ~ 0 samples the middle band of the photo — and the subject's face
 * sits at the TOP of the sample photos (pier face y ~0.02-0.35, boulevard
 * face y ~0.10-0.30), which the old dy ~ 0 presets cut off entirely.
 * dy shifts the photo centre by dy * frame-height; a top-anchored crop
 * needs dy ~= zoom (the visible band is then y ~0.01-0.37 on the square
 * pier photo and y ~0.13-0.41 on the portrait boulevard photo, face
 * visible in every frame on all three export sizes, no edge gaps).
 * Frame 1 is the full top-anchored subject, frame 2 a closer face crop,
 * frames 3-4 varied zoom/pan on the upper body / face area.
 */
export const ONE_PHOTO_FRAMES = [
  { zoom: 1.05, dx: 0, dy: 1.05 },
  { zoom: 1.4, dx: 0.1, dy: 1.4 },
  { zoom: 1.25, dx: -0.08, dy: 1.25 },
  { zoom: 1.1, dx: 0.05, dy: 0.88 },
];

const TITLE_FONT = '"Arial Black", "Archivo Black", system-ui, sans-serif';

/** One palm silhouette: a curved trunk and drooping fronds. */
export function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  const topX = x + s * 0.12;
  const topY = y - s;
  ctx.lineWidth = Math.max(2, s * 0.055);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.55, topX, topY);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  for (let i = 0; i < 7; i += 1) {
    const a = (-Math.PI * (0.08 + i * 0.14)) - Math.PI / 2 + Math.PI;
    // Fronds fan out from the crown, drooping toward the ground.
    const ang = Math.PI * (0.02 + i * 0.145);
    const ex = topX + Math.cos(ang) * s * 0.62 * (i % 2 === 0 ? 1 : 0.8);
    const ey = topY + Math.sin(ang) * s * 0.3 + s * 0.42;
    const mx = topX + Math.cos(ang) * s * 0.4;
    const my = topY - s * 0.22 + Math.sin(ang) * s * 0.1;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** The procedural Vice City backdrop: sunset sky, sun, skyline, palms. */
export function drawBackdrop(ctx, w, h, gradeKey) {
  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const rnd = mulberry32(20261121);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars high in the sky.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 70; i += 1) {
    const sx = rnd() * w;
    const sy = rnd() * h * 0.3;
    const r = rnd() * 1.6 + 0.4;
    ctx.globalAlpha = 0.25 + rnd() * 0.55;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Sun with a warm glow.
  const sunX = w * 0.68;
  const sunY = h * 0.38;
  const sunR = Math.min(w, h) * 0.085;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
  glow.addColorStop(0, 'rgba(255, 214, 106, 0.85)');
  glow.addColorStop(1, 'rgba(255, 214, 106, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 3.2, sunY - sunR * 3.2, sunR * 6.4, sunR * 6.4);
  ctx.fillStyle = '#ffd66a';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Skyline silhouette with lit windows.
  const horizon = h * 0.62;
  const dark = gradeKey === 'noir' ? '#0c0c12' : '#160a26';
  let bx = -10;
  while (bx < w) {
    const bw = 34 + rnd() * 78;
    const bh = 40 + rnd() * 150;
    ctx.fillStyle = dark;
    ctx.fillRect(bx, horizon - bh, bw, bh);
    // Aerial on a few towers.
    if (rnd() > 0.7) {
      ctx.fillRect(bx + bw / 2 - 1, horizon - bh - 18, 2, 18);
    }
    ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
    const cols = Math.floor(bw / 12);
    const rows = Math.floor(bh / 16);
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if (rnd() > 0.62) ctx.fillRect(bx + 4 + cx * 12, horizon - bh + 6 + cy * 16, 4, 6);
      }
    }
    bx += bw + 4 + rnd() * 14;
  }

  // Ground band with sunset reflections.
  ctx.fillStyle = gradeKey === 'noir' ? '#101018' : '#1d0b2e';
  ctx.fillRect(0, horizon, w, h - horizon);
  for (let i = 0; i < 26; i += 1) {
    const ry = horizon + 6 + rnd() * (h - horizon - 10);
    const rw = 30 + rnd() * (w * 0.3);
    const rx = rnd() * w;
    ctx.globalAlpha = 0.08 + rnd() * 0.16;
    ctx.fillStyle = ['#ff8a4c', '#ff5e7a', '#ffd66a'][i % 3];
    ctx.fillRect(rx, ry, rw, 2 + rnd() * 2);
  }
  ctx.globalAlpha = 1;

  // Palm silhouettes framing the scene.
  drawPalm(ctx, w * 0.07, h * 0.99, h * 0.22, dark);
  drawPalm(ctx, w * 0.93, h * 0.99, h * 0.26, dark);
  drawPalm(ctx, w * 0.16, h * 0.99, h * 0.13, dark);
}

/** Draws one photo into a frame rect with cover-fit, pan and zoom. */
export function drawPhotoFrame(ctx, img, rect, frame, gradeKey) {
  if (!img) return;
  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const s = base * frame.zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const cx = rect.x + rect.w / 2 + frame.dx * rect.w;
  const cy = rect.y + rect.h / 2 + frame.dy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** Bold outlined title with a neon offset shadow, centred at (cx, cy). */
export function drawTitleText(ctx, text, cx, cy, size, accent) {
  ctx.save();
  ctx.font = `900 ${size}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Chromatic offset shadows: pink down-right, cyan up-left.
  ctx.fillStyle = '#ff2e88';
  ctx.fillText(text, cx + size * 0.045, cy + size * 0.05);
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(text, cx - size * 0.04, cy - size * 0.045);
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = '#14081f';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy);
  // Neon accent bar under the title.
  const tw = ctx.measureText(text).width;
  const bar = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  bar.addColorStop(0, '#ff2e88');
  bar.addColorStop(0.5, '#ff8a4c');
  bar.addColorStop(1, '#22d3ee');
  ctx.fillStyle = bar;
  ctx.fillRect(cx - tw / 2, cy + size * 0.58, tw, Math.max(3, size * 0.09));
  ctx.restore();
}

/** The photo-booth strip itself, drawn at (x, y) with size w x h. */
export function drawStrip(ctx, x, y, w, h, state) {
  const strip = document.createElement('canvas');
  strip.width = Math.max(2, Math.round(w));
  strip.height = Math.max(2, Math.round(h));
  const c = strip.getContext('2d');
  const pad = w * 0.055;

  // Paper.
  c.fillStyle = '#fdf6ec';
  c.beginPath();
  c.roundRect(0, 0, w, h, Math.min(18, w * 0.02));
  c.fill();

  // Title block.
  const titleH = h * 0.13;
  const title = (state.title || 'VICE BOOTH').trim().toUpperCase();
  let size = w * 0.115;
  c.font = `900 ${size}px ${TITLE_FONT}`;
  while (c.measureText(title).width > w - pad * 2 && size > 10) {
    size -= 2;
    c.font = `900 ${size}px ${TITLE_FONT}`;
  }
  drawTitleText(c, title, w / 2, titleH * 0.38, size);

  // Subtitle line under the title.
  const sub = (state.subtitle || '').trim().toUpperCase();
  if (sub) {
    c.font = `700 ${Math.max(11, w * 0.032)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#5b2a6e';
    c.fillText(sub, w / 2, titleH * 0.88);
  }

  // Four photo frames.
  const framesTop = titleH + h * 0.012;
  const framesBottom = h - h * 0.05;
  const gap = h * 0.011;
  const fh = (framesBottom - framesTop - gap * 3) / 4;
  const fw = w - pad * 2;
  const frames = [];
  for (let i = 0; i < 4; i += 1) {
    const rect = { x: pad, y: framesTop + i * (fh + gap), w: fw, h: fh };
    frames.push(rect);
    const img = state.mode === 'four' ? state.photos[i] : state.onePhoto;
    const frame = state.frames[i] ?? { zoom: 1, dx: 0, dy: 0 };
    if (img) {
      drawPhotoFrame(c, img, rect, frame, state.grade);
    } else {
      // Empty frame: a warm placeholder with a frame number.
      const g = c.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, '#e8b4c8');
      g.addColorStop(1, '#f7d9a8');
      c.fillStyle = g;
      c.fillRect(rect.x, rect.y, rect.w, rect.h);
      c.font = `900 ${rect.h * 0.4}px ${TITLE_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillText(String(i + 1), rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    c.strokeStyle = 'rgba(20, 8, 31, 0.18)';
    c.lineWidth = 1;
    c.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  }

  // Date stamp.
  const stamp = (state.date || '').trim().toUpperCase() || 'VICE CITY';
  c.save();
  c.translate(w / 2, h - h * 0.026);
  c.rotate(-0.015);
  c.font = `700 ${Math.max(10, w * 0.028)}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#b03a5b';
  c.fillText(`★ ${stamp} ★`, 0, 0);
  c.restore();

  // Perforated edges: punch holes along both long sides.
  c.globalCompositeOperation = 'destination-out';
  const holeR = Math.max(3, w * 0.011);
  for (let hy = h * 0.06; hy < h * 0.96; hy += h * 0.055) {
    c.beginPath();
    c.arc(holeR * 0.9, hy, holeR, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(w - holeR * 0.9, hy, holeR, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(12, w * 0.03);
  ctx.shadowOffsetY = Math.max(6, w * 0.015);
  ctx.drawImage(strip, x, y, w, h);
  ctx.restore();
  return frames.map((r) => ({ x: x + r.x, y: y + r.y, w: r.w, h: r.h }));
}

/** Seeded film grain, tiled over the cover. */
let grainCanvas = null;
export function grainTile() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = 160;
  grainCanvas.height = 160;
  const g = grainCanvas.getContext('2d');
  const rnd = mulberry32(777);
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 28;
  }
  g.putImageData(img, 0, 0);
  return grainCanvas;
}

/**
 * Draws the full export cover at size w x h and returns the on-canvas frame
 * rects (for drag-to-pan hit testing in the editor preview).
 */
export function drawCover(canvas, w, h, state) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawBackdrop(ctx, w, h, state.grade);

  const portrait = w <= h;
  let stripW;
  let stripH;
  let stripX;
  let stripY;
  if (portrait) {
    stripH = h * 0.94;
    stripW = stripH * 0.66;
    if (stripW > w * 0.86) {
      stripW = w * 0.86;
      stripH = stripW / 0.66;
    }
    stripX = (w - stripW) / 2;
    stripY = (h - stripH) / 2;
  } else {
    stripH = h * 0.96;
    stripW = stripH * 0.66;
    stripX = w * 0.05;
    stripY = (h - stripH) / 2;
    // Side title block on the right for the wide layout.
    const tx = stripX + stripW + (w - stripX - stripW) * 0.5;
    const ty = h * 0.42;
    const title = (state.title || 'VICE BOOTH').trim().toUpperCase();
    ctx.save();
    ctx.font = `900 ${Math.min(120, (w - stripX - stripW) * 0.16)}px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#14081f';
    ctx.fillStyle = '#ffffff';
    const words = title.split(/\s+/);
    words.forEach((word, i) => {
      const wy = ty + (i - (words.length - 1) / 2) * 110;
      ctx.strokeText(word, tx, wy);
      ctx.fillText(word, tx, wy);
    });
    ctx.restore();
    const sub = (state.subtitle || '').trim().toUpperCase();
    if (sub) {
      ctx.font = `700 ${Math.max(16, h * 0.035)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#14081f';
      const subY = ty + ((words.length + 1) / 2) * 110;
      ctx.strokeText(sub, tx, subY);
      ctx.fillStyle = '#ffd66a';
      ctx.fillText(sub, tx, subY);
    }
  }

  const frames = drawStrip(ctx, stripX, stripY, stripW, stripH, state);

  if (state.grain) {
    const pat = ctx.createPattern(grainTile(), 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,4,20,0.32)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  return frames;
}

/** The three post sizes the app exports. */
export const SIZES = [
  { id: '1080x1350', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: '1080x1080', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: '1920x1080', label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];
