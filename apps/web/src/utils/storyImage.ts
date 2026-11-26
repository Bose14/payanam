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
  path(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 15; ctx.stroke();
  path(); ctx.strokeStyle = accent; ctx.lineWidth = 9; ctx.stroke();
  const a = proj(pts[0]);
  const b = proj(pts[pts.length - 1]);
  ctx.fillStyle = '#22C55E'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(a.x, a.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = accent; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
  // Shading: darker at the top for the title and at the bottom for the numbers.
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.34);
  top.addColorStop(0, 'rgba(0,0,0,0.62)'); top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, w, h * 0.34);
  const bottom = ctx.createLinearGradient(0, h * 0.42, 0, h);
  bottom.addColorStop(0, 'rgba(0,0,0,0)'); bottom.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = bottom; ctx.fillRect(0, h * 0.42, w, h * 0.58);

  const c = o.customization;
  const isStory = o.format === 'story';
  const shadow = () => { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2; };
  const noShadow = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Top left: ride name and date. Top right: brand.
  shadow();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${isStory ? 60 : 54}px ${F}`;
  const titleLines = wrapLines(ctx, `${o.summary.fromPlace} → ${o.summary.toPlace}`, w - pad * 2, 2);
  let ty = pad + 56;
  for (const l of titleLines) { ctx.fillText(l, pad, ty); ty += isStory ? 68 : 62; }
  ctx.font = `600 30px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(o.summary.completedAt, pad, ty + 4);

  // Numbers: label above a big value, stacked at the bottom left.
  type Stat = { label: string; value: string; unit?: string };
  const stats: Stat[] = [];
  if (c.showDistance) stats.push({ label: 'Distance', value: String(o.summary.totalDistanceKm), unit: 'km' });
  if (c.showDays) stats.push({ label: o.summary.daysCount === 1 ? 'Day' : 'Days', value: String(o.summary.daysCount) });
  if (c.showStops) stats.push({ label: 'Stops', value: String(o.summary.stopsClearedCount) });
  if (c.showRiders && o.summary.coRidersCount > 1) stats.push({ label: 'Riders', value: String(o.summary.coRidersCount) });
  const bike = c.showBikeModel && o.summary.bikeModel && !/^(motorcycle|bike|scooter)$/i.test(o.summary.bikeModel.trim()) ? o.summary.bikeModel : '';
  const valueSize = isStory ? 120 : 92;
  const labelSize = isStory ? 32 : 28;
  const rowH = valueSize + labelSize + (isStory ? 30 : 22);

  ctx.font = `italic 600 32px ${F}`;
  const noteLines = c.customNote ? wrapLines(ctx, `“${c.customNote}”`, w - pad * 2, 2) : [];
  const footerY = h - pad;
  const noteH = noteLines.length ? noteLines.length * 42 + 30 : 0;
  const bikeH = bike ? 50 : 0;
  const blockBottom = footerY - 80 - noteH - bikeH;
  const blockTop = blockBottom - stats.length * rowH;

  stats.forEach((st, i) => {
    const y0 = blockTop + i * rowH;
    shadow();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `600 ${labelSize}px ${F}`;
    ctx.fillText(st.label, pad, y0 + labelSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${valueSize}px ${F}`;
    ctx.fillText(st.value, pad, y0 + labelSize + valueSize - 8);
    if (st.unit) {
      const vw = ctx.measureText(st.value).width;
      ctx.font = `700 ${Math.round(valueSize * 0.4)}px ${F}`;
      ctx.fillText(st.unit, pad + vw + 12, y0 + labelSize + valueSize - 8);
    }
  });

  // Route line sits to the right of the numbers, like the map on a Strava share.
  if (o.showRoute && o.route && o.route.length > 1 && stats.length) {
    noShadow();
    const bw = isStory ? 440 : 400;
    const bh = Math.min(stats.length * rowH, isStory ? 640 : 480);
    drawRoute(ctx, o.route, { x: w - pad - bw, y: blockBottom - bh - 10, w: bw, h: bh }, accent);
  }

  let y = blockBottom + 20;
  shadow();
  if (bike) {
    y += 34;
    ctx.fillStyle = accent;
    ctx.font = `800 32px ${F}`;
    ctx.fillText(bike, pad, y);
    y += 16;
  }
  if (noteLines.length) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `italic 600 32px ${F}`;
    y += 44;
    for (const l of noteLines) { ctx.fillText(l, pad, y); y += 42; }
  }

  // Footer brand line.
  noShadow();
  ctx.fillStyle = accent;
  ctx.fillRect(pad, footerY - 8, 56, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `900 28px ${F}`;
  ctx.fillText('PAYANAM', pad + 76, footerY);
  ctx.textAlign = 'right';
  ctx.font = `600 26px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Ride with your convoy', w - pad, footerY);
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), 'image/jpeg', 0.92);
  });
}
