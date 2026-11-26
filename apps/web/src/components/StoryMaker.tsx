import { useEffect, useRef, useState } from 'react';
import { TripMilestoneSummary, MilestoneCardCustomization } from '../utils/tripMilestones';
import { StoryFormat, StoryBackground, MapBackdrop, STORY_SIZES, drawStory, loadImageFile, canvasToBlob, buildMapBackdrop } from '../utils/storyImage';
import Icon from './Icon';

interface Props {
  summary: TripMilestoneSummary;
  customization: MilestoneCardCustomization;
  route?: Array<[number, number]>;
}

export default function StoryMaker({ summary, customization, route }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [format, setFormat] = useState<StoryFormat>('story');
  const [showRoute, setShowRoute] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const hasRoute = !!route && route.length > 1;
  const [background, setBackground] = useState<StoryBackground>(hasRoute ? 'map' : 'photo');
  const [mapView, setMapView] = useState<MapBackdrop | null>(null);
  const [mapState, setMapState] = useState<'idle' | 'loading' | 'failed'>('idle');

  // Fetch the street map when it is the chosen background.
  useEffect(() => {
    if (background !== 'map' || !route || route.length < 2) { setMapView(null); setMapState('idle'); return; }
    let alive = true;
    setMapState('loading');
    buildMapBackdrop(route, format).then((m) => {
      if (!alive) return;
      setMapView(m);
      setMapState(m ? 'idle' : 'failed');
    }).catch(() => { if (alive) { setMapView(null); setMapState('failed'); } });
    return () => { alive = false; };
  }, [background, route, format]);

  useEffect(() => {
    let alive = true;
    const paint = () => {
      if (alive && canvas.current) drawStory(canvas.current, { format, photo, summary, customization, route, showRoute: hasRoute && (background === 'map' || showRoute), background, mapView });
    };
    paint();
    // Draw again once fonts are ready so the text uses the app font.
    document.fonts?.ready.then(paint).catch(() => undefined);
    return () => { alive = false; };
  }, [format, photo, summary, customization, route, showRoute, hasRoute, background, mapView]);

  const pick = async (f?: File) => {
    if (!f) return;
    setError('');
    if (!f.type.startsWith('image/')) { setError('Choose a photo file.'); return; }
    try { setPhoto(await loadImageFile(f)); } catch { setError('Could not open that photo. Try another one.'); }
  };

  const makeFile = async () => {
    if (!canvas.current) throw new Error('not ready');
    const blob = await canvasToBlob(canvas.current);
    const name = `payanam-${summary.fromPlace}-${summary.toPlace}-${format}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  };

  const download = async () => {
    setBusy(true); setError(''); setDone('');
    try {
      const f = await makeFile();
      const url = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = url; a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setDone('Saved to your downloads.');
    } catch { setError('Could not save the picture. Try again.'); } finally { setBusy(false); }
  };

  const share = async () => {
    setBusy(true); setError(''); setDone('');
    try {
      const f = await makeFile();
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: 'My Payanam ride', text: `${summary.fromPlace} to ${summary.toPlace} on Payanam` });
      } else {
        await download();
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError('Could not open sharing. Use Save instead.');
    } finally { setBusy(false); }
  };

  const seg = (on: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', font: 'inherit', fontSize: 13, fontWeight: 800,
    color: 'var(--pz-ink)', background: on ? 'var(--pz-warn-bg)' : 'var(--pz-bg)',
    border: `1.5px solid ${on ? 'var(--pz-accent)' : 'var(--pz-line)'}`,
  });
  const { w, h } = STORY_SIZES[format];

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: 'var(--pz-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
        POST WITH YOUR PHOTO
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--pz-muted)', lineHeight: 1.45 }}>
        Add a photo from your ride. We place your route and numbers on it so you can post it as a story or a feed post.
      </p>

      {hasRoute && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button type="button" style={seg(background === 'map')} aria-pressed={background === 'map'} onClick={() => setBackground('map')}>Map background</button>
          <button type="button" style={seg(background === 'photo')} aria-pressed={background === 'photo'} onClick={() => setBackground('photo')}>Photo background</button>
        </div>
      )}
      {background === 'map' && mapState === 'loading' && <div className="pz-banner" role="status" style={{ marginBottom: 10 }}>Loading the map…</div>}
      {background === 'map' && mapState === 'failed' && (
        <div className="pz-banner bad" role="alert" style={{ marginBottom: 10 }}>The map could not load. Check your connection, or use a photo background.</div>
      )}

      <input ref={file} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <div style={{ display: background === 'photo' ? 'flex' : 'none', gap: 8, marginBottom: 10 }}>
        <button type="button" style={seg(false)} onClick={() => file.current?.click()}>{photo ? 'Change photo' : 'Choose photo'}</button>
        {photo && <button type="button" style={seg(false)} onClick={() => setPhoto(null)}>Remove photo</button>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {(['story', 'post'] as StoryFormat[]).map((f) => (
          <button key={f} type="button" style={seg(format === f)} aria-pressed={format === f} onClick={() => setFormat(f)}>{STORY_SIZES[f].label}</button>
        ))}
        {hasRoute && background === 'photo' && (
          <button type="button" style={seg(showRoute)} aria-pressed={showRoute} onClick={() => setShowRoute((v) => !v)}>
            {showRoute ? 'Route on' : 'Route off'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--pz-bg)', border: '1px solid var(--pz-line)', borderRadius: 14, padding: 10 }}>
        <canvas ref={canvas} aria-label="Preview of your share picture"
          style={{ width: '100%', maxWidth: format === 'story' ? 260 : 320, aspectRatio: `${w} / ${h}`, borderRadius: 10, display: 'block' }} />
      </div>

      {error && <div className="pz-banner bad" role="alert" style={{ marginTop: 10 }}>{error}</div>}
      {done && <div className="pz-banner ok" role="status" style={{ marginTop: 10 }}>{done}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" className="pz-btn primary" style={{ flex: 1 }} onClick={share} disabled={busy}>
          <Icon name="arrowRight" /> {busy ? 'Working…' : 'Share'}
        </button>
        <button type="button" className="pz-btn" style={{ flex: 1 }} onClick={download} disabled={busy}>Save picture</button>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--pz-muted)' }}>
        Your photo stays on your phone. Only the finished picture is made, and nothing is uploaded.
      </p>
    </div>
  );
}
