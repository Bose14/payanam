import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import PlaceInput from './PlaceInput';
import { placeService, type RoutePlace } from '../services/api';

export interface WaypointDraft {
  place: string;
  item_type: string;
  description: string;
  lat?: number;
  lng?: number;
}

interface Props {
  day: number;
  draft: WaypointDraft;
  onChange: (next: WaypointDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting?: boolean;
  /** The trip's start and end, so real places on the road between them can be suggested. */
  route?: { from: string; to: string; fromLat?: number | null; fromLng?: number | null; toLat?: number | null; toLng?: number | null };
  /** Names already in the itinerary, hidden from the suggestions. */
  existing?: string[];
}

const TYPES: Array<{ value: string; label: string; icon: string }> = [
  { value: 'attraction', label: 'Scenic', icon: 'camera' },
  { value: 'meal', label: 'Food', icon: 'food' },
  { value: 'fuel_stop', label: 'Fuel', icon: 'fuel' },
  { value: 'rest', label: 'Tea / Rest', icon: 'coffee' },
  { value: 'stay', label: 'Stay', icon: 'bed' },
];

const looksLikeLink = (v: string) => /https?:\/\/|maps\.apple|goo\.gl|google\.[a-z]+\/maps/i.test(v);

const FILTERS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'all', label: 'All', types: [] },
  { key: 'scenic', label: 'Scenic', types: ['attraction'] },
  { key: 'food', label: 'Food', types: ['meal', 'rest'] },
  { key: 'fuel', label: 'Fuel', types: ['fuel_stop'] },
  { key: 'stay', label: 'Stay', types: ['stay'] },
];

// One lookup per route for the whole visit, shared by every day's form.
const routeCache = new Map<string, Promise<RoutePlace[]>>();

export default function AddWaypointForm({ day, draft, onChange, onSubmit, onCancel, submitting, route, existing }: Props) {
  const [onRoute, setOnRoute] = useState<RoutePlace[] | null>(null);
  const [routeFailed, setRouteFailed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!route?.from || !route?.to) return;
    const key = [route.from, route.to, route.fromLat, route.toLat].join('|');
    let p = routeCache.get(key);
    if (!p) { p = placeService.alongRoute(route).then((r) => r.places); routeCache.set(key, p); }
    let live = true;
    p.then((places) => { if (live) setOnRoute(places); })
      .catch(() => { routeCache.delete(key); if (live) setRouteFailed(true); });
    return () => { live = false; };
  }, [route?.from, route?.to, route?.fromLat, route?.toLat]);

  const visible = useMemo(() => {
    const have = new Set((existing ?? []).map((n) => n.toLowerCase().split(',')[0].trim()));
    const types = FILTERS.find((f) => f.key === filter)?.types ?? [];
    return (onRoute ?? []).filter((p) => !have.has(p.name.toLowerCase()) && (types.length === 0 || types.includes(p.type)));
  }, [onRoute, existing, filter]);
  const [link, setLink] = useState('');
  const [resolving, setResolving] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [pinnedFrom, setPinnedFrom] = useState<'google' | 'apple' | null>(null);
  const [approx, setApprox] = useState(false);

  const resolve = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setResolving(true);
    setLinkError('');
    try {
      const p = await placeService.resolveLink(v);
      onChange({ ...draft, place: p.name, lat: p.lat, lng: p.lng });
      setPinnedFrom(p.source);
      setApprox(!!p.approximate);
      setLink('');
    } catch (e) {
      setLinkError((e as Error).message);
    } finally {
      setResolving(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setLinkError('Your clipboard is empty. Copy a link from Maps first.'); return; }
      setLink(text);
      resolve(text);
    } catch {
      setLinkError('Could not read the clipboard. Long-press the box and choose Paste.');
    }
  };

  const hasPin = draft.lat !== undefined && draft.lng !== undefined;
  const clearPin = () => { setPinnedFrom(null); setApprox(false); onChange({ ...draft, place: '', lat: undefined, lng: undefined }); };

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Add a stop to Day {day}</div>
          <div style={S.sub}>Restaurants, waterfalls, viewpoints, anything on your route</div>
        </div>
        <button type="button" onClick={onCancel} style={S.closeBtn} aria-label="Close" title="Close"><Icon name="close" /></button>
      </div>

      {/* 0. Real places on the road between the start and the destination */}
      {!hasPin && route && !routeFailed && (
        <div style={S.block}>
          <div style={S.label}><span style={{ fontSize: 14 }}><Icon name="road" /></span> On your route</div>
          {onRoute === null && <div style={S.hint}>Finding places along the road…</div>}
          {onRoute !== null && (
            <>
              <div style={S.chips} role="tablist" aria-label="Filter places">
                {FILTERS.map((f) => (
                  <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
                    onClick={() => { setFilter(f.key); setShowAll(false); }}
                    style={{ ...S.chip, minHeight: 34, padding: '0 12px', ...(filter === f.key ? S.chipOn : null) }}>{f.label}</button>
                ))}
              </div>
              {visible.length === 0 && <div style={S.hint}>No mapped places of this kind on the road. Search by name or paste a link below.</div>}
              <div style={S.list}>
                {(showAll ? visible : visible.slice(0, 6)).map((p) => (
                  <button key={p.id} type="button" style={S.item}
                    onClick={() => onChange({ ...draft, place: p.name, lat: p.lat, lng: p.lng, item_type: p.type })}>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span style={S.itemName}>{p.name}</span>
                      <span style={S.itemSub}>{p.label} · {Math.round(p.km)} km from start · {p.offKm <= 0.5 ? 'on the road' : `${p.offKm.toFixed(1)} km off`}</span>
                    </span>
                    <span style={{ fontSize: 18, display: 'inline-flex', color: 'var(--pz-accent)' }}><Icon name="plus" /></span>
                  </button>
                ))}
              </div>
              {visible.length > 6 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} style={S.more}>
                  {showAll ? 'Show fewer' : `Show all ${visible.length}`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 1. Paste a map link */}
      {!hasPin && (
        <div style={S.block}>
          <label style={S.label}><span style={{ fontSize: 14 }}><Icon name="link" /></span> Paste a map link</label>
          <div style={S.row}>
            <input
              value={link}
              onChange={(e) => {
                const v = e.target.value;
                setLink(v);
                setLinkError('');
                // A link dropped in all at once (long-press Paste, autofill) is read straight away.
                if (looksLikeLink(v) && v.length - link.length > 12 && !resolving) resolve(v);
              }}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text');
                if (looksLikeLink(t)) { e.preventDefault(); setLink(t); resolve(t); }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolve(link); } }}
              placeholder="Google Maps or Apple Maps link"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              style={S.input}
              aria-label="Map link"
            />
            <button
              type="button"
              onClick={link.trim() ? () => resolve(link) : pasteFromClipboard}
              disabled={resolving}
              style={{ ...S.iconBtn, ...S.iconBtnAccent }}
              aria-label={link.trim() ? 'Use this link' : 'Paste from clipboard'}
              title={link.trim() ? 'Use this link' : 'Paste from clipboard'}
            >
              {resolving ? <span style={S.spin} /> : <Icon name={link.trim() ? 'check' : 'clipboard'} />}
            </button>
          </div>
          {linkError && <div style={S.error} role="alert">{linkError}</div>}
          <div style={S.hint}>In Google Maps or Apple Maps open the place, tap Share, copy the link and paste it here. Links from either app work for everyone in the convoy.</div>
        </div>
      )}

      {/* Pinned result (editable name) */}
      {hasPin && (
        <div style={S.pinned}>
          <span style={S.pinBadge}><Icon name="pin" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={draft.place}
              onChange={(e) => onChange({ ...draft, place: e.target.value })}
              style={{ ...S.input, minHeight: 40, fontWeight: 800 }}
              aria-label="Stop name"
            />
            <div style={S.pinnedSub}>
              {approx
                ? 'Approximate spot found from the name. Check it on the map.'
                : `Pinned${pinnedFrom ? ` from ${pinnedFrom === 'apple' ? 'Apple Maps' : 'Google Maps'}` : ''} · ${draft.lat!.toFixed(4)}, ${draft.lng!.toFixed(4)}`}
            </div>
          </div>
          <button type="button" onClick={clearPin} style={S.iconBtn} aria-label="Remove pin and choose another" title="Choose another"><Icon name="close" /></button>
        </div>
      )}

      {/* 2. Or search */}
      {!hasPin && (
        <div style={S.block}>
          <div style={S.or}><span style={S.orLine} /><span>or search by name</span><span style={S.orLine} /></div>
          <PlaceInput
            value={draft.place}
            onChange={(v) => onChange({ ...draft, place: v, lat: undefined, lng: undefined })}
            onSelect={(loc) => onChange({ ...draft, place: loc.name, lat: loc.lat, lng: loc.lng })}
            placeholder="Search a town or landmark"
            bias={route?.fromLat != null && route?.fromLng != null ? { lat: route.fromLat, lng: route.fromLng } : undefined}
          />
        </div>
      )}

      {/* 3. Type */}
      <div style={S.block}>
        <div style={S.label}>Type of stop</div>
        <div style={S.chips} role="radiogroup" aria-label="Type of stop">
          {TYPES.map((t) => {
            const on = draft.item_type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...draft, item_type: t.value })}
                style={{ ...S.chip, ...(on ? S.chipOn : null) }}
              >
                <span style={{ fontSize: 16, display: 'inline-flex' }}><Icon name={t.icon} /></span> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Note */}
      <input
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Note (optional), e.g. best masala dosa, park early"
        style={S.input}
        aria-label="Note"
      />

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !draft.place.trim()}
        style={{ ...S.submit, opacity: submitting || !draft.place.trim() ? 0.55 : 1 }}
      >
        {submitting ? 'Adding…' : hasPin ? `Add to Day ${day}` : draft.place.trim() ? `Add “${draft.place.trim().slice(0, 24)}” to Day ${day}` : `Add to Day ${day}`}
      </button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box', width: '100%', minWidth: 0, padding: 16, borderRadius: 16, background: 'var(--pz-bg)', border: '1px solid var(--pz-line)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 16, fontWeight: 900, color: 'var(--pz-ink)', letterSpacing: -0.2 },
  sub: { fontSize: 12, color: 'var(--pz-muted)', marginTop: 2, lineHeight: 1.35 },
  closeBtn: { width: 36, height: 36, flexShrink: 0, borderRadius: 999, border: '1px solid var(--pz-line)', background: 'var(--pz-surface)', color: 'var(--pz-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  item: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 52, borderRadius: 12, border: '1px solid var(--pz-line)', background: 'var(--pz-surface)', color: 'var(--pz-ink)', cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' },
  itemName: { display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--pz-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemSub: { display: 'block', fontSize: 11, color: 'var(--pz-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  more: { alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--pz-accent)', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '4px 2px', fontFamily: 'inherit' },
  block: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  label: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: 'var(--pz-muted)', textTransform: 'uppercase' },
  row: { display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 },
  input: { flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--pz-line)', background: 'var(--pz-surface)', color: 'var(--pz-ink)', fontSize: 16, fontFamily: 'inherit', outline: 'none' },
  iconBtn: { width: 46, height: 46, flexShrink: 0, borderRadius: 12, border: '1px solid var(--pz-line)', background: 'var(--pz-surface)', color: 'var(--pz-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', touchAction: 'manipulation' },
  iconBtnAccent: { background: 'var(--pz-accent)', borderColor: 'var(--pz-accent)', color: 'var(--pz-on-accent)' },
  spin: { width: 18, height: 18, borderRadius: '50%', border: '2.5px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'pz-spin 0.7s linear infinite' },
  error: { fontSize: 13, color: 'var(--pz-bad)', fontWeight: 600, lineHeight: 1.35 },
  hint: { fontSize: 12, color: 'var(--pz-muted)', lineHeight: 1.45 },
  pinned: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, background: 'var(--pz-ok-bg)', border: '1px solid var(--pz-ok)' },
  pinBadge: { width: 38, height: 38, flexShrink: 0, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pz-ok)', color: 'var(--pz-on-ok)', fontSize: 18 },
  pinnedSub: { fontSize: 12, color: 'var(--pz-muted)', marginTop: 4, fontWeight: 600 },
  or: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--pz-muted)', fontWeight: 700 },
  orLine: { flex: 1, height: 1, background: 'var(--pz-line)' },
  chips: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
  chip: { flexShrink: 0, minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid var(--pz-line)', background: 'var(--pz-surface)', color: 'var(--pz-ink)', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', touchAction: 'manipulation' },
  chipOn: { background: 'var(--pz-accent)', borderColor: 'var(--pz-accent)', color: 'var(--pz-on-accent)' },
  submit: { minHeight: 50, borderRadius: 14, border: 'none', background: 'var(--pz-accent)', color: 'var(--pz-on-accent)', fontSize: 15, fontWeight: 900, cursor: 'pointer', touchAction: 'manipulation', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 16px' },
};
