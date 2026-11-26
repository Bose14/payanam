import { useState } from 'react';
import Icon from './Icon';
import PlaceInput from './PlaceInput';
import { placeService } from '../services/api';

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
}

const TYPES: Array<{ value: string; label: string; icon: string }> = [
  { value: 'attraction', label: 'Scenic', icon: 'camera' },
  { value: 'meal', label: 'Food', icon: 'food' },
  { value: 'fuel_stop', label: 'Fuel', icon: 'fuel' },
  { value: 'rest', label: 'Tea / Rest', icon: 'coffee' },
  { value: 'stay', label: 'Stay', icon: 'bed' },
];

const looksLikeLink = (v: string) => /https?:\/\/|maps\.apple|goo\.gl|google\.[a-z]+\/maps/i.test(v);

export default function AddWaypointForm({ day, draft, onChange, onSubmit, onCancel, submitting }: Props) {
  const [link, setLink] = useState('');
  const [resolving, setResolving] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [pinnedFrom, setPinnedFrom] = useState<'google' | 'apple' | null>(null);

  const resolve = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setResolving(true);
    setLinkError('');
    try {
      const p = await placeService.resolveLink(v);
      onChange({ ...draft, place: p.name, lat: p.lat, lng: p.lng });
      setPinnedFrom(p.source);
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
  const clearPin = () => { setPinnedFrom(null); onChange({ ...draft, place: '', lat: undefined, lng: undefined }); };

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Add a stop to Day {day}</div>
          <div style={S.sub}>Restaurants, waterfalls, viewpoints, anything on your route</div>
        </div>
        <button type="button" onClick={onCancel} style={S.closeBtn} aria-label="Close" title="Close"><Icon name="close" /></button>
      </div>

      {/* 1. Paste a map link */}
      {!hasPin && (
        <div style={S.block}>
          <label style={S.label}><span style={{ fontSize: 14 }}><Icon name="link" /></span> Paste a map link</label>
          <div style={S.row}>
            <input
              value={link}
              onChange={(e) => { setLink(e.target.value); setLinkError(''); }}
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
              Pinned{pinnedFrom ? ` from ${pinnedFrom === 'apple' ? 'Apple Maps' : 'Google Maps'}` : ''} · {draft.lat!.toFixed(4)}, {draft.lng!.toFixed(4)}
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
