import { TripMilestoneSummary, MilestoneCardCustomization, BACKDROP_PRESETS } from './tripMilestones';

export type StoryFormat = 'story' | 'post';
export type StoryBackground = 'photo' | 'map';

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
  /** 'map' draws a street map behind the route; it needs mapView from buildMapBackdrop. */
  background?: StoryBackground;
  mapView?: MapBackdrop | null;
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

const TILE = 256;
const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

export interface MapBackdrop {
  canvas: HTMLCanvasElement;
  project: (lat: number, lng: number) => { x: number; y: number };
}

/** The part of the picture where the route is fitted when a map is the background. */
function mapArea(format: StoryFormat) {
  const { w, h } = STORY_SIZES[format];
  const top = format === 'story' ? 340 : 300;
  const bottom = format === 'story' ? 560 : 500;
  return { x: 64, y: top, w: w - 128, h: h - top - bottom };
}

const TILE_URLS = [
  (z: number, x: number, y: number) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
  (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
];

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement | null> {
  const attempt = (n: number): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      if (n >= TILE_URLS.length) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => { img.src = ''; resolve(attempt(n + 1)); }, 8000);
      img.onload = () => { window.clearTimeout(timer); resolve(img); };
      img.onerror = () => { window.clearTimeout(timer); resolve(attempt(n + 1)); };
      img.src = TILE_URLS[n](z, x, y);
    });
  return attempt(0);
}

/** Builds a street map picture with the route fitted inside it. Returns null if no map tiles could load. */
export async function buildMapBackdrop(route: Array<[number, number]>, format: StoryFormat): Promise<MapBackdrop | null> {
  if (route.length < 2) return null;
  const { w, h } = STORY_SIZES[format];
  const area = mapArea(format);
  const pts = thin(route);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [la, ln] of pts) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
  }
  let zf = 16;
  for (; zf > 2; zf -= 0.25) {
    const sx = lonToX(maxLng, zf) - lonToX(minLng, zf);
    const sy = latToY(minLat, zf) - latToY(maxLat, zf);
    if (sx <= area.w * 0.88 && sy <= area.h * 0.88) break;
  }
  const Z = Math.max(2, Math.min(16, Math.round(zf)));
  const T = TILE * 2 ** (zf - Z); // size a tile is drawn at
  const cx = (lonToX(minLng, zf) + lonToX(maxLng, zf)) / 2;
  const cy = (latToY(minLat, zf) + latToY(maxLat, zf)) / 2;
  const tx = area.x + area.w / 2;
  const ty = area.y + area.h / 2;
  const originX = cx - tx; // world x (at zoom zf) shown at canvas x = 0
  const originY = cy - ty;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#0F1316';
  ctx.fillRect(0, 0, w, h);

  const n = 2 ** Z;
  const i0 = Math.floor(originX / T), i1 = Math.floor((originX + w) / T);
  const j0 = Math.max(0, Math.floor(originY / T)), j1 = Math.min(n - 1, Math.floor((originY + h) / T));
  const jobs: Array<Promise<void>> = [];
  let loaded = 0;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      jobs.push(loadTile(Z, ((i % n) + n) % n, j).then((img) => {
        if (!img) return;
        loaded++;
        ctx.drawImage(img, i * T - originX, j * T - originY, T + 0.5, T + 0.5);
      }));
    }
  }
  await Promise.all(jobs);
  if (loaded === 0) return null;
  return { canvas, project: (lat, lng) => ({ x: lonToX(lng, zf) - originX, y: latToY(lat, zf) - originY }) };
}

function drawRouteOnMap(ctx: CanvasRenderingContext2D, route: Array<[number, number]>, view: MapBackdrop, accent: string) {
  const pts = thin(route).map(([la, ln]) => view.project(la, ln));
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y))); };
  path(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 22; ctx.stroke();
  path(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 16; ctx.stroke();
  path(); ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.stroke();
  const a = pts[0], b = pts[pts.length - 1];
  ctx.lineWidth = 6;
  ctx.fillStyle = '#22C55E'; ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(a.x, a.y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#EF4444';
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

  const mapMode = o.background === 'map' && !!o.mapView;
  // Backdrop: a street map, the rider's photo (cover fit), or the chosen theme colours.
  if (mapMode && o.mapView) {
    ctx.drawImage(o.mapView.canvas, 0, 0);
  } else if (o.photo) {
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

  if (mapMode) {
    // The distance column is wider because its number plus unit is the longest.
    const weights = stats.map((st) => (st.unit ? 1.6 : 1));
    const totalW = weights.reduce((a, b) => a + b, 0) || 1;
    const colX: number[] = [];
    let acc = pad;
    weights.forEach((wt) => { colX.push(acc); acc += ((w - pad * 2) * wt) / totalW; });
    const mValue = isStory ? 88 : 72;
    const mLabel = isStory ? 28 : 24;
    shadow();
    stats.forEach((st, i) => {
      const x0 = colX[i];
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `600 ${mLabel}px ${F}`;
      ctx.fillText(st.label, x0, blockBottom - mValue - 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${mValue}px ${F}`;
      ctx.fillText(st.value, x0, blockBottom - 8);
      if (st.unit) {
        const vw = ctx.measureText(st.value).width;
        ctx.font = `700 ${Math.round(mValue * 0.4)}px ${F}`;
        ctx.fillText(st.unit, x0 + vw + 8, blockBottom - 8);
      }
    });
    noShadow();
    if (o.showRoute && o.route && o.route.length > 1 && o.mapView) drawRouteOnMap(ctx, o.route, o.mapView, accent);
  } else {
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
  ctx.font = `600 ${mapMode ? 20 : 26}px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(mapMode ? '© OpenStreetMap contributors © CARTO' : 'Ride with your convoy', w - pad, footerY);
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), 'image/jpeg', 0.92);
  });
}
