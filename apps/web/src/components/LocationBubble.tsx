import { useEffect, useState } from 'react';
import { ChatMessage } from '../services/api';

const Z = 16;

function tileFor(lat: number, lng: number) {
  const n = 2 ** Z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** Small map picture centred on the point, built from four OpenStreetMap tiles. */
export function MapPreview({ lat, lng, height = 120 }: { lat: number; lng: number; height?: number }) {
  const { x, y } = tileFor(lat, lng);
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const px = (x - tx) * 256;
  const py = (y - ty) * 256;
  const dx = px < 128 ? -1 : 0; // first tile column to draw
  const dy = py < 128 ? -1 : 0;
  const tiles = [0, 1].flatMap((r) => [0, 1].map((c) => ({ c, r })));
  // Position of the point inside the 2x2 block, in pixels from its top-left corner.
  const bx = px - dx * 256; // dx is -1 or 0: the block starts at tile tx+dx
  const by = py - dy * 256;
  const left = `calc(50% - ${bx}px)`;
  const top = `calc(50% - ${by}px)`;
  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', borderRadius: 10, background: 'var(--pz-line)' }} aria-hidden="true">
      <div style={{ position: 'absolute', left, top, width: 512, height: 512 }}>
        {tiles.map(({ c, r }) => (
          <img
            key={`${c}${r}`}
            alt=""
            loading="lazy"
            draggable={false}
            src={`https://tile.openstreetmap.org/${Z}/${tx + dx + c}/${ty + dy + r}.png`}
            style={{ position: 'absolute', left: c * 256, top: r * 256, width: 256, height: 256 }}
          />
        ))}
      </div>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)', color: 'var(--pz-bad)' }}>
        <svg width="28" height="34" viewBox="0 0 24 30" fill="currentColor">
          <path d="M12 0C6.5 0 2 4.3 2 9.7 2 17 12 30 12 30s10-13 10-20.3C22 4.3 17.5 0 12 0z" />
          <circle cx="12" cy="9.5" r="3.6" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

function ago(iso?: string, now = Date.now()): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 20) return 'updated just now';
  if (s < 90) return `updated ${s}s ago`;
  return `updated ${Math.round(s / 60)} min ago`;
}

export default function LocationBubble({
  m, isLead, sharingLive, onStop, onConfirm,
}: {
  m: ChatMessage;
  isLead: boolean;
  sharingLive: boolean;
  onStop: () => void;
  onConfirm: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const meta = m.meta!;
  const liveUntil = meta.live ? new Date(meta.live.until).getTime() : 0;
  const isLive = !!meta.live && liveUntil > now;
  useEffect(() => {
    if (!meta.live) return;
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, [meta.live]);

  const until = new Date(liveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={`pz-bubble${m.mine ? ' me' : ''}`} style={{ width: 'min(300px, 86%)' }}>
      <div className="who">{m.mine ? 'You' : m.senderName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <a href={`https://www.google.com/maps?q=${meta.lat},${meta.lng}`} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
        <MapPreview lat={meta.lat} lng={meta.lng} />
      </a>
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        <div className="pz-row" style={{ gap: 8 }}>
          <b className="pz-grow">{meta.place}</b>
          {meta.live && <span className={`pz-pill ${isLive ? 'ok' : 'stale'}`}>{isLive ? 'Live' : 'Ended'}</span>}
        </div>
        {meta.note && <div style={{ fontSize: 14 }}>{meta.note}</div>}
        {meta.live && (
          <div className="pz-note">
            {isLive ? `Sharing until ${until}, ${ago(meta.updatedAt, now)}` : 'Live location ended. Last known position shown.'}
          </div>
        )}
        <div className="pz-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <a className="pz-btn small" href={`https://www.google.com/maps?q=${meta.lat},${meta.lng}`} target="_blank" rel="noreferrer">Open in maps</a>
          {m.mine && isLive && (
            <button className="pz-btn small" type="button" onClick={onStop}>{sharingLive ? 'Stop sharing' : 'End'}</button>
          )}
        </div>
        {!meta.live && (
          meta.confirmed ? (
            <span className="pz-pill ok">Confirmed. Added to the itinerary for everyone.</span>
          ) : isLead ? (
            <button className="pz-btn small" type="button" onClick={onConfirm}>Confirm as stop</button>
          ) : (
            <span className="pz-pill stale">Waiting for the captain to confirm</span>
          )
        )}
      </div>
    </div>
  );
}
