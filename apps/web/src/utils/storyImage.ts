import { TripMilestoneSummary, MilestoneCardCustomization, BACKDROP_PRESETS } from './tripMilestones';

export type StoryFormat = 'story' | 'post';

export const STORY_SIZES: Record<StoryFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Story 9:16' },
  post: { w: 1080, h: 1350, label: 'Post 4:5' },
};

export interface StoryOptions {
  format: StoryFormat;
  photo: HTMLImageElement | null;
  summary: TripMilestoneSummary;
  customization: MilestoneCardCustomization;
  /** Planned route as lat/lng points. Drawn as a line only, with no map and no coordinates. */
  route?: Array<[number, number]>;
  showRoute: boolean;
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return cut;
  }
  return lines;
}

/** Thins a long route so drawing stays quick. */
function thin(points: Array<[number, number]>, max = 400): Array<[number, number]> {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: Array<[number, number]> = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

function drawRoute(ctx: CanvasRenderingContext2D, route: Array<[number, number]>, box: { x: number; y: number; w: number; h: number }, accent: string) {
  const pts = thin(route);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [la, ln] of pts) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
  }
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180); // keep the shape true at this latitude
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min(box.w / spanX, box.h / spanY);
  const offX = box.x + (box.w - spanX * scale) / 2;
  const offY = box.y + (box.h - spanY * scale) / 2;
  const proj = ([la, ln]: [number, number]) => ({
    x: offX + (ln - minLng) * kx * scale,
    y: offY + (maxLat - la) * scale,
  });

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => { const q = proj(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
  };
  path(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 16; ctx.stroke();
  path(); ctx.strokeStyle = accent; ctx.lineWidth = 9; ctx.shadowColor = accent; ctx.shadowBlur = 24; ctx.stroke();
  ctx.shadowBlur = 0;
  const a = proj(pts[0]);
  const b = proj(pts[pts.length - 1]);
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = accent; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(a.x, a.y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#EF4444'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(b.x, b.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** Paints the finished share picture onto the canvas. */
export function drawStory(canvas: HTMLCanvasElement, o: StoryOptions) {
  const { w, h } = STORY_SIZES[o.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const backdrop = BACKDROP_PRESETS.find((b) => b.id === o.customization.backdropPreset) || BACKDROP_PRESETS[0];
  const accent = backdrop.accent;
  const pad = 64;
  const F = "Manrope, Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  // Backdrop: the rider's photo (cover fit), or the chosen theme colours when there is no photo.
  if (o.photo) {
    const ir = o.photo.width / o.photo.height;
    const cr = w / h;
    let sw = o.photo.width, sh = o.photo.height, sx = 0, sy = 0;
    if (ir > cr) { sw = o.photo.height * cr; sx = (o.photo.width - sw) / 2; } else { sh = o.photo.width / cr; sy = (o.photo.height - sh) / 2; }
    ctx.drawImage(o.photo, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    const stops = backdrop.gradient.match(/#[0-9a-fA-F]{6}/g) ?? ['#064e3b', '#022c22'];
    g.addColorStop(0, stops[0]); g.addColorStop(1, stops[stops.length - 1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  // Soft shading at the top and bottom keeps text readable on any photo.
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.28);
  top.addColorStop(0, 'rgba(0,0,0,0.65)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, w, h * 0.28);
  const bottom = ctx.createLinearGradient(0, h * 0.55, 0, h);
  bottom.addColorStop(0, 'rgba(0,0,0,0)'); bottom.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = bottom; ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // Top bar: brand and date.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 46px ${F}`;
  ctx.textAlign = 'left';
  ctx.fillText('PAYANAM', pad, pad + 46);
  ctx.font = `700 30px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(o.summary.completedAt, w - pad, pad + 44);
  ctx.textAlign = 'left';

  // Expedition pill.
  const pill = 'EXPEDITION COMPLETED';
  ctx.font = `900 28px ${F}`;
  const pw = ctx.measureText(pill).width + 56;
  roundRect(ctx, pad, pad + 86, pw, 62, 31);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillText(pill, pad + 28, pad + 86 + 42);

  // Measure the panel first so it always fits its text.
  const c = o.customization;
  const iw = w - pad * 2 - 80;
  ctx.font = `900 56px ${F}`;
  const titleLines = wrapLines(ctx, `${o.summary.fromPlace} → ${o.summary.toPlace}`, iw, 2);
  const names = o.summary.sanitizedStopsList.filter(Boolean);
  ctx.font = `600 29px ${F}`;
  const nameLines = names.length > 1 ? wrapLines(ctx, names.join(' → '), iw, 2) : [];
  const stats: Array<[string, string]> = [];
  if (c.showDistance) stats.push([String(o.summary.totalDistanceKm), 'KM']);
  if (c.showDays) stats.push([String(o.summary.daysCount), o.summary.daysCount === 1 ? 'DAY' : 'DAYS']);
  if (c.showStops) stats.push([String(o.summary.stopsClearedCount), 'STOPS']);
  if (c.showRiders && o.summary.coRidersCount > 1) stats.push([String(o.summary.coRidersCount), 'RIDERS']);
  const bikeText = c.showBikeModel && o.summary.bikeModel ? o.summary.bikeModel : '';
  ctx.font = `italic 600 30px ${F}`;
  const noteLines = c.customNote ? wrapLines(ctx, `“${c.customNote}”`, iw, 2) : [];
  const panelH = 40 + 36 + titleLines.length * 62 + (nameLines.length ? 14 + nameLines.length * 40 : 0)
    + 36 + (stats.length ? 130 : 0) + (bikeText ? 62 : 0)
    + (noteLines.length ? (bikeText ? 52 : 62) + (noteLines.length - 1) * 40 + 20 : 0) + 40;
  const panelY = h - pad - panelH;

  // Route line floats over the photo, like a map overlay.
  if (o.showRoute && o.route && o.route.length > 1) {
    const box = o.format === 'story'
      ? { x: w * 0.45, y: pad + 200, w: w * 0.48, h: panelY - pad - 240 }
      : { x: w * 0.5, y: pad + 190, w: w * 0.43, h: panelY - pad - 230 };
    drawRoute(ctx, o.route, box, accent);
  }

  // Glass panel with the route names and the numbers.
  const px = pad, pwid = w - pad * 2;
  roundRect(ctx, px, panelY, pwid, panelH, 36);
  ctx.fillStyle = 'rgba(8,10,12,0.62)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();

  const ix = px + 40;
  let y = panelY + 40;
  ctx.fillStyle = accent;
  ctx.fillRect(ix, y + 6, 44, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 56px ${F}`;
  y += 36;
  for (const l of titleLines) { y += 62; ctx.fillText(l, ix, y); }

  if (nameLines.length) {
    ctx.font = `600 29px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    y += 14;
    for (const l of nameLines) { y += 40; ctx.fillText(l, ix, y); }
  }

  y += 36;
  if (stats.length) {
    const gap = 16;
    const bw = (iw - gap * (stats.length - 1)) / stats.length;
    stats.forEach(([v, l], i) => {
      const bx = ix + i * (bw + gap);
      roundRect(ctx, bx, y, bw, 130, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = i === 0 ? accent : '#FFFFFF';
      ctx.font = `900 58px ${F}`;
      ctx.fillText(v, bx + bw / 2, y + 68);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `800 24px ${F}`;
      ctx.fillText(l, bx + bw / 2, y + 108);
    });
    ctx.textAlign = 'left';
    y += 130;
  }

  if (bikeText) {
    y += 62;
    ctx.font = `800 30px ${F}`;
    ctx.fillStyle = accent;
    ctx.fillText(bikeText, ix, y);
  }
  if (noteLines.length) {
    ctx.font = `italic 600 30px ${F}`;
    ctx.fillStyle = '#FFFFFF';
    y += bikeText ? 52 : 62;
    for (const l of noteLines) { ctx.fillText(l, ix, y); y += 40; }
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), 'image/jpeg', 0.92);
  });
}
