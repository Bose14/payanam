import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatConversation, ChatGroup, ChatMessage, chatService, tripService } from '../../services/api';
import { apiMessage } from '../../utils/apiMessage';
import Icon from '../../components/Icon';
import LocationBubble from '../../components/LocationBubble';
import { startLiveShare, stopLiveShare, isSharingLive, onLiveSharesChange } from '../../utils/liveShare';

type Filter = 'All' | 'Trips' | 'Groups' | 'Direct';


function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useLivePolling(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Composer({ onSend, disabled, onAttach }: { onSend: (text: string) => Promise<void>; disabled?: boolean; onAttach?: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = text.trim();
    if (!t || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(t);
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: onAttach ? 'auto 1fr auto' : '1fr auto', gap: 8, marginTop: 10 }}>
      {onAttach && (
        <button className="pz-btn" type="button" onClick={onAttach} aria-label="Share location" title="Share location"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
          <Icon name="pin" />
        </button>
      )}
      <input
        className="pz-input"
        placeholder="Write a message"
        aria-label="Write a message"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <button className="pz-btn primary" type="button" onClick={submit} disabled={disabled || busy || !text.trim()}>Send</button>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  return (
    <div className={`pz-bubble${m.mine ? ' me' : ''}`}>
      <div className="who">{m.mine ? 'You' : m.senderName} · {clock(m.createdAt)}</div>
      {m.body}
    </div>
  );
}

/* ----------------------------- thread (trip / group / DM) ----------------------------- */

function Thread({
  conv, onBack, onOpenGroup, onRenamed,
}: { conv: ChatConversation; onBack: () => void; onOpenGroup: (id: string) => void; onRenamed: () => void }) {
  const [title, setTitle] = useState(conv.title);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  useEffect(() => { setTitle(conv.title); }, [conv.title]);
  const saveName = async () => {
    const n = newName.trim();
    if (n.length < 2) { setError('Name must be at least 2 characters.'); return; }
    setRenameBusy(true);
    setError('');
    try {
      const r = await chatService.renameTrip(conv.key, n);
      setTitle(r.name);
      setRenaming(false);
      onRenamed();
    } catch (e) {
      setError(apiMessage(e, 'Could not rename the chat.'));
    } finally {
      setRenameBusy(false);
    }
  };
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [isLead, setIsLead] = useState(false);
  const [dm, setDm] = useState<{ sentUnreplied: number; blocked: boolean; limit: number } | undefined>();
  const [error, setError] = useState('');
  const [itin, setItin] = useState<Array<{ id: string; place: string; day_number: number; description?: string }>>([]);
  const [placeName, setPlaceName] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const tripId = conv.type === 'trip' ? conv.key.slice(5) : null;

  const loadItin = useCallback(async () => {
    if (!tripId) return;
    try {
      const d = await tripService.getTripById(tripId);
      setItin((d?.trip?.itinerary ?? d?.itinerary ?? []) as typeof itin);
    } catch { /* keep what we have */ }
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const d = await chatService.messages(conv.key);
      setMsgs(d.messages);
      setIsLead(d.isLead);
      setDm(d.dm);
    } catch (e) {
      setError(apiMessage(e, 'Could not load messages.'));
    }
  }, [conv.key]);

  useLivePolling(load, 5000);
  useEffect(() => { loadItin(); }, [loadItin]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  const send = async (text: string) => {
    setError('');
    try {
      await chatService.send(conv.key, { body: text });
      await load();
    } catch (e) {
      setError(apiMessage(e, 'Message not sent. Try again.'));
      throw e;
    }
  };

  const [, bump] = useState(0);
  useEffect(() => onLiveSharesChange(() => bump((n) => n + 1)), []);
  const [liveMinutes, setLiveMinutes] = useState<15 | 60 | 480>(60);
  const [mode, setMode] = useState<'menu' | 'live' | null>(null);

  const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('unsupported')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  });

  const shareLocation = async (live: boolean) => {
    setError('');
    setShareBusy(true);
    try {
      const pos = await getPosition();
      const sent = await chatService.send(conv.key, {
        kind: 'location',
        place: live ? 'Live location' : 'My location',
        note: placeName.trim() || undefined,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ...(live ? { liveMinutes } : {}),
      });
      if (live && sent.meta?.live) startLiveShare(conv.key, sent.id, new Date(sent.meta.live.until).getTime());
      setMode(null);
      setPlaceName('');
      await load();
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 1) setError('Location is blocked. Allow it in your browser settings to share where you are.');
      else if (code === 2 || code === 3 || (e as Error).message === 'unsupported') setError('Could not find your location. Move to open sky and try again.');
      else setError(apiMessage(e, 'Could not share your location.'));
    } finally {
      setShareBusy(false);
    }
  };

  const stopLive = async (id: string) => {
    stopLiveShare(id);
    try { await chatService.stopLive(conv.key, id); await load(); } catch (e) { setError(apiMessage(e, 'Could not stop sharing.')); }
  };

  const confirm = async (id: string) => {
    setError('');
    try {
      await chatService.confirmStop(conv.key, id);
      await Promise.all([load(), loadItin()]);
    } catch (e) {
      setError(apiMessage(e, 'Could not confirm the stop.'));
    }
  };

  const kind = conv.type === 'trip' ? 'Trip chat' : conv.type === 'group' ? 'Group chat' : 'Direct message';

  return (
    <>
      <div className="pz-row">
        <button className="pz-btn small" type="button" onClick={onBack} aria-label="Back to chats" title="Back to chats">←</button>
        <div className="pz-grow">
          {renaming ? (
            <input className="pz-input" autoFocus value={newName} maxLength={100} aria-label="Chat name"
              style={{ width: '100%', boxSizing: 'border-box' }}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setRenaming(false); }} />
          ) : (
            <b>{title}</b>
          )}
          <div className="pz-note">{kind}</div>
        </div>
        {conv.type === 'trip' && (renaming ? (
          <>
            <button className="pz-btn small primary" type="button" onClick={saveName} disabled={renameBusy}>{renameBusy ? 'Saving…' : 'Save'}</button>
            <button className="pz-btn small" type="button" onClick={() => setRenaming(false)} disabled={renameBusy}>Cancel</button>
          </>
        ) : (
          <button className="pz-btn small" type="button" onClick={() => { setNewName(title); setRenaming(true); }}>Rename</button>
        ))}
        {conv.type === 'group' && (
          <button className="pz-btn small" type="button" onClick={() => onOpenGroup(conv.key.slice(6))}>Group page</button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        {!msgs.length && <p className="pz-note">No messages yet.</p>}
        {msgs.map((m) =>
          m.kind === 'location' && m.meta ? (
            <LocationBubble
              key={m.id}
              m={m}
              isLead={isLead}
              sharingLive={isSharingLive(m.id)}
              onStop={() => stopLive(m.id)}
              onConfirm={() => confirm(m.id)}
            />
          ) : (
            <Bubble key={m.id} m={m} />
          ),
        )}
        <div ref={bottom} />
      </div>

      {error && <div className="pz-banner bad" role="alert">{error}</div>}

      {conv.type === 'trip' && mode && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Share location" onClick={() => !shareBusy && setMode(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 520, background: 'var(--pz-bg)', color: 'var(--pz-ink)', borderRadius: '20px 20px 0 0',
            padding: '16px 16px calc(24px + env(safe-area-inset-bottom))', borderTop: '1.5px solid var(--pz-line)',
            maxHeight: '90dvh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <b style={{ flex: 1, fontSize: 18 }}>{mode === 'live' ? 'Share live location' : 'Share location'}</b>
              <button className="pz-btn small" type="button" aria-label="Close" onClick={() => setMode(null)} disabled={shareBusy}><Icon name="close" /></button>
            </div>
            {mode === 'menu' ? (
              <>
                <label className="pz-label" htmlFor="pz-note" style={{ display: 'block', marginBottom: 6 }}>Add note (optional)</label>
                <input id="pz-note" className="pz-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
                  placeholder="e.g. Waiting at the dhaba" maxLength={200} value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
                <div style={{ display: 'grid', gap: 10 }}>
                  {([
                    { id: 'now', icon: 'pin', color: 'var(--pz-accent)', title: shareBusy ? 'Finding you…' : 'Send current location', sub: 'Posts where you are right now' },
                    { id: 'live', icon: 'compass', color: 'var(--pz-ok)', title: 'Share live location', sub: 'The group sees you move for a set time' },
                  ] as const).map((o) => (
                    <button key={o.id} type="button" disabled={shareBusy}
                      onClick={() => (o.id === 'now' ? shareLocation(false) : setMode('live'))}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 14, width: '100%', textAlign: 'left',
                        padding: '14px 16px', borderRadius: 14, cursor: 'pointer', color: 'var(--pz-ink)',
                        background: 'var(--pz-surface)', border: '1.5px solid var(--pz-line)', font: 'inherit',
                      }}>
                      <span style={{
                        width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--pz-bg)', border: '1.5px solid var(--pz-line)', color: o.color,
                      }}><Icon name={o.icon} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{o.title}</span>
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--pz-muted)', marginTop: 2 }}>{o.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <p className="pz-note" style={{ margin: 0 }}>Keep Payanam open while sharing. You can stop any time from the message.</p>
                {([[15, '15 minutes'], [60, '1 hour'], [480, '8 hours']] as const).map(([v, label]) => (
                  <button key={v} type="button" role="radio" aria-checked={liveMinutes === v}
                    onClick={() => setLiveMinutes(v)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                      padding: '14px 16px', borderRadius: 14, cursor: 'pointer', font: 'inherit', color: 'var(--pz-ink)',
                      background: 'var(--pz-surface)', fontWeight: liveMinutes === v ? 800 : 600,
                      border: `1.5px solid ${liveMinutes === v ? 'var(--pz-accent)' : 'var(--pz-line)'}`,
                    }}>
                    <span>{label}</span>
                    {liveMinutes === v && <span style={{ color: 'var(--pz-accent)', display: 'inline-flex' }}><Icon name="check" /></span>}
                  </button>
                ))}
                <button className="pz-btn primary block" type="button" disabled={shareBusy} onClick={() => shareLocation(true)}>
                  {shareBusy ? 'Finding you…' : 'Start sharing'}
                </button>
                <button className="pz-btn block" type="button" disabled={shareBusy} onClick={() => setMode('menu')}>Back</button>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {conv.type === 'dm' && dm?.blocked && (
        <div className="pz-banner warn" role="status">
          Wait for {conv.title} to reply. You can send {dm.limit} messages before a reply is needed.
        </div>
      )}
      {conv.type === 'dm' && dm && !dm.blocked && dm.sentUnreplied > 0 && (
        <div className="pz-note">{dm.limit - dm.sentUnreplied} messages left before {conv.title} needs to reply.</div>
      )}

      <Composer onSend={send} disabled={conv.type === 'dm' && !!dm?.blocked} onAttach={conv.type === 'trip' ? () => setMode('menu') : undefined} />

      {conv.type === 'trip' && (
        <>
          <div className="pz-label" style={{ marginTop: 16 }}>Itinerary</div>
          <div className="pz-card">
            {itin.length ? itin.map((i) => (
              <div className="pz-row-item" key={i.id}>
                <span className="pz-mono" style={{ width: 50, flex: 'none' }}>Day {i.day_number}</span>
                <div className="pz-grow">
                  {i.place}
                  {i.description === 'Added from trip chat' && <span className="pz-tag">from chat</span>}
                </div>
              </div>
            )) : <p className="pz-note">No stops yet.</p>}
          </div>
        </>
      )}
    </>
  );
}

/* ----------------------------------- group page ----------------------------------- */

function GroupPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [g, setG] = useState<ChatGroup | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', region: '' });
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setG(await chatService.group(id)); } catch (e) { setError(apiMessage(e, 'Could not load the group.')); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError('');
    setBusy(true);
    try { await fn(); await load(); } catch (e) { setError(apiMessage(e, fallback)); } finally { setBusy(false); }
  };

  const answer = (userId: string, action: 'accept' | 'decline') =>
    run(() => chatService.respondToGroupRequest(id, userId, action), 'Could not update the request.');

  const copy = async () => {
    if (!g) return;
    try { await navigator.clipboard.writeText(g.inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* shown on screen */ }
  };

  const startEdit = () => {
    if (!g) return;
    setForm({ name: g.name, description: g.description, region: g.region });
    setEdit(true);
  };
  const saveEdit = () => run(async () => { await chatService.updateGroup(id, form); setEdit(false); }, 'Could not save the changes.');

  const toggle = (key: 'requireApproval' | 'membersCanEdit' | 'onlyAdminsPost', value: boolean) =>
    run(() => chatService.updateGroup(id, { [key]: value }), 'Could not change the setting.');

  const leave = async () => {
    setBusy(true);
    setError('');
    try { await chatService.leaveGroup(id); window.location.assign('/chat'); }
    catch (e) { setError(apiMessage(e, 'Could not leave the group.')); setBusy(false); }
  };

  const Switch = ({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) => (
    <div className="pz-row-item" style={{ alignItems: 'center' }}>
      <div className="pz-grow">
        <b>{label}</b>
        <div className="pz-note">{hint}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}
        style={{
          width: 46, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative',
          background: on ? 'var(--pz-accent)' : 'var(--pz-line)', transition: 'background .15s',
        }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .15s' }} />
      </button>
    </div>
  );

  return (
    <>
      <div className="pz-row"><button className="pz-btn small" type="button" onClick={onBack} aria-label="Back to group chat" title="Back to group chat">←</button></div>
      {error && <div className="pz-banner bad" role="alert" style={{ marginTop: 10 }}>{error}</div>}
      {g && (
        <>
          {edit ? (
            <div className="pz-card" style={{ marginTop: 12 }}>
              <label className="pz-label" htmlFor="g-name">Group name</label>
              <input id="g-name" className="pz-input" style={{ width: '100%', boxSizing: 'border-box' }} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label className="pz-label" htmlFor="g-region" style={{ marginTop: 10, display: 'block' }}>City or region</label>
              <input id="g-region" className="pz-input" style={{ width: '100%', boxSizing: 'border-box' }} maxLength={80} placeholder="e.g. Coimbatore, Tamil Nadu" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              <label className="pz-label" htmlFor="g-desc" style={{ marginTop: 10, display: 'block' }}>About this group</label>
              <textarea id="g-desc" className="pz-input" rows={3} style={{ width: '100%', boxSizing: 'border-box', font: 'inherit' }} maxLength={500}
                placeholder="Who is it for, what rides do you do, any rules" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div className="pz-row" style={{ marginTop: 12 }}>
                <button className="pz-btn small primary" type="button" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button className="pz-btn small" type="button" onClick={() => setEdit(false)} disabled={busy}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="pz-row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
                <div className="pz-grow">
                  <h1 className="pz-h1" style={{ marginBottom: 2 }}>{g.name}</h1>
                  <div className="pz-note">
                    {g.members.length} {g.members.length === 1 ? 'member' : 'members'}{g.region ? `, ${g.region}` : ''}
                  </div>
                </div>
                {g.canEdit && <button className="pz-btn small" type="button" onClick={startEdit}>Edit</button>}
              </div>
              {g.description && <p style={{ margin: '10px 0 4px' }}>{g.description}</p>}
            </>
          )}

          <div className="pz-card" style={{ marginTop: 12 }}>
            <div className="pz-label">Invite</div>
            <div className="pz-row">
              <div className="pz-grow">
                <div className="pz-h2">{g.inviteCode}</div>
                <div className="pz-note">{g.requireApproval ? 'Members join with this code. An admin approves requests.' : 'Anyone with this code joins straight away.'}</div>
              </div>
              <button className="pz-btn small" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            {g.isAdmin && (
              <button className="pz-btn small" type="button" style={{ marginTop: 10 }} disabled={busy}
                onClick={() => run(() => chatService.resetInviteCode(id), 'Could not make a new code.')}>
                Make a new code
              </button>
            )}
          </div>

          {g.isAdmin && g.requests.length > 0 && (
            <div className="pz-card">
              <div className="pz-label">Join requests</div>
              {g.requests.map((r) => (
                <div className="pz-row-item" key={r.userId}>
                  <div className="pz-av" aria-hidden="true">{r.name.charAt(0)}</div>
                  <div className="pz-grow"><b>{r.name}</b><div className="pz-note">Wants to join</div></div>
                  <button className="pz-btn small primary" type="button" onClick={() => answer(r.userId, 'accept')} disabled={busy}>Accept</button>
                  <button className="pz-btn small" type="button" onClick={() => answer(r.userId, 'decline')} disabled={busy}>Decline</button>
                </div>
              ))}
            </div>
          )}

          {g.isAdmin && (
            <div className="pz-card">
              <div className="pz-label">Group settings</div>
              <Switch label="Approve new members" hint="Off lets anyone with the code join straight away." on={g.requireApproval} onChange={(v) => toggle('requireApproval', v)} />
              <Switch label="Members can edit group info" hint="Lets any member change the name, region and about text." on={g.membersCanEdit} onChange={(v) => toggle('membersCanEdit', v)} />
              <Switch label="Only admins can post" hint="Good for announcements. Members can still read." on={g.onlyAdminsPost} onChange={(v) => toggle('onlyAdminsPost', v)} />
            </div>
          )}

          <div className="pz-card">
            <div className="pz-label">Members</div>
            {g.members.map((m) => (
              <div className="pz-row-item" key={m.userId} style={{ flexWrap: 'wrap' }}>
                <div className="pz-av" aria-hidden="true">{m.name.charAt(0)}</div>
                <div className="pz-grow">{m.name}{m.you && <span className="pz-tag">You</span>}{m.role === 'admin' && <span className="pz-tag">Admin</span>}</div>
                {g.isAdmin && !m.you && (
                  removing === m.userId ? (
                    <>
                      <button className="pz-btn small" type="button" disabled={busy}
                        onClick={() => { setRemoving(null); run(() => chatService.removeMember(id, m.userId), 'Could not remove the member.'); }}>Remove</button>
                      <button className="pz-btn small" type="button" onClick={() => setRemoving(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button className="pz-btn small" type="button" disabled={busy}
                        onClick={() => run(() => chatService.setMemberRole(id, m.userId, m.role === 'admin' ? 'member' : 'admin'), 'Could not change the role.')}>
                        {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </button>
                      <button className="pz-btn small" type="button" onClick={() => setRemoving(m.userId)}>Remove</button>
                    </>
                  )
                )}
              </div>
            ))}
          </div>

          <div className="pz-card">
            {confirmLeave ? (
              <>
                <p style={{ margin: '0 0 10px' }}>Leave {g.name}? {g.isAdmin && g.members.filter((m) => m.role === 'admin').length <= 1 && g.members.length > 1 ? 'The longest-standing member becomes admin.' : ''}</p>
                <div className="pz-row">
                  <button className="pz-btn small primary" type="button" onClick={leave} disabled={busy}>Leave group</button>
                  <button className="pz-btn small" type="button" onClick={() => setConfirmLeave(false)} disabled={busy}>Stay</button>
                </div>
              </>
            ) : (
              <button className="pz-btn block" type="button" onClick={() => setConfirmLeave(true)} style={{ color: 'var(--pz-bad)' }}>Leave group</button>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------ list view ------------------------------------ */

export default function ChatTab() {
  const [params, setParams] = useSearchParams();
  const [convs, setConvs] = useState<ChatConversation[]>([]);
  const [contacts, setContacts] = useState<Array<{ userId: string; name: string; city: string | null; key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'menu' | 'create' | 'join' | null>(null);
  const [sheetError, setSheetError] = useState('');

  const openKey = params.get('c');
  const groupId = params.get('group');

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([chatService.conversations(), chatService.contacts().catch(() => [])]);
      setConvs(c);
      setContacts(p);
      setError('');
    } catch (e) {
      setError(apiMessage(e, 'Could not load your chats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useLivePolling(load, 10000);

  // /chat?trip=<tripId> (links from other screens) opens that trip's chat.
  const legacyTrip = params.get('trip');
  useEffect(() => {
    if (legacyTrip) setParams({ c: `trip:${legacyTrip}` }, { replace: true });
  }, [legacyTrip, setParams]);

  const closeSheet = () => { setSheet(null); setSheetError(''); setGroupName(''); setJoinCode(''); };

  const createGroup = async () => {
    setBusy(true);
    setSheetError('');
    try {
      const g = await chatService.createGroup(groupName.trim());
      closeSheet();
      setNotice(`Group "${g.name}" created. Invite code: ${g.inviteCode}`);
      await load();
      setParams({ c: `group:${g.id}` });
    } catch (e) {
      setSheetError(apiMessage(e, 'Could not create the group. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const joinGroup = async () => {
    setBusy(true);
    setSheetError('');
    try {
      const r = await chatService.joinGroup(joinCode.trim());
      closeSheet();
      setNotice(r.status === 'member' ? `You are already in ${r.name}.` : `Request sent to ${r.name}. The admin will approve you.`);
      await load();
    } catch (e) {
      setSheetError(apiMessage(e, 'Could not send the request. Check the code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (groupId) return <GroupPage id={groupId} onBack={() => setParams({ c: `group:${groupId}` })} />;

  const open = convs.find((c) => c.key === openKey) ??
    (openKey?.startsWith('dm:')
      ? (() => {
          const other = contacts.find((p) => p.key === openKey);
          return other ? { key: openKey, type: 'dm' as const, title: other.name, subtitle: 'Direct message', lastMessage: null, lastAt: null, unread: 0 } : undefined;
        })()
      : undefined);

  if (open) {
    return (
      <Thread
        conv={open}
        onBack={() => { setParams({}); load(); }}
        onOpenGroup={(id) => setParams({ group: id })}
        onRenamed={() => { load(); }}
      />
    );
  }

  const rows = convs.filter((c) =>
    filter === 'All' || (filter === 'Trips' && c.type === 'trip') || (filter === 'Groups' && c.type === 'group') || (filter === 'Direct' && c.type === 'dm'));
  const startable = contacts.filter((p) => !convs.some((c) => c.key === p.key));
  const tag = (t: ChatConversation['type']) => (t === 'trip' ? 'Trips' : t === 'group' ? 'Groups' : 'Direct');

  return (
    <>
      <h1 className="pz-h1">Chat</h1>

      <div className="pz-chips">
        {(['All', 'Trips', 'Groups', 'Direct'] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {error && <div className="pz-banner bad" role="alert">{error}</div>}
      {notice && <div className="pz-banner ok" role="status">{notice}</div>}
      {loading && <p className="pz-note">Loading…</p>}

      <div className="pz-card">
        {rows.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setParams({ c: c.key })}
            style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <div className="pz-row-item">
              <div className="pz-av" aria-hidden="true">{c.title.charAt(0).toUpperCase()}</div>
              <div className="pz-grow">
                <b>{c.title}</b>
                <div className="pz-note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.lastMessage ?? c.subtitle}
                </div>
              </div>
              {c.unread > 0 && <span className="pz-pill bad">{c.unread}</span>}
              <span className="pz-tag">{tag(c.type)}</span>
            </div>
          </button>
        ))}
        {!loading && !rows.length && <p className="pz-note">Nothing here yet.</p>}
      </div>

      {(filter === 'All' || filter === 'Direct') && startable.length > 0 && (
        <>
          <div className="pz-label">Message a rider</div>
          <div className="pz-card">
            {startable.map((p) => (
              <button
                key={p.userId}
                type="button"
                onClick={() => setParams({ c: p.key })}
                style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <div className="pz-row-item">
                  <div className="pz-av" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="pz-grow"><b>{p.name}</b>{p.city && <div className="pz-note">{p.city}</div>}</div>
                  <span className="pz-tag">Direct</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        aria-label="New chat options"
        onClick={() => setSheet('menu')}
        style={{
          position: 'fixed', right: 18, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 40,
          width: 56, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
          background: 'var(--pz-accent)', color: 'var(--pz-on-accent)', boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name="plus" size={26} />
      </button>

      {sheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={sheet === 'create' ? 'New group' : sheet === 'join' ? 'Join a group' : 'New chat options'}
          onClick={closeSheet}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--pz-surface)', color: 'var(--pz-ink)',
              borderRadius: '20px 20px 0 0', padding: '18px 18px calc(22px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
            }}
          >
            {sheet === 'menu' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <b style={{ fontSize: 16 }}>Start something new</b>
                {([
                  ['create', 'New group', 'Chat with riders you choose. You get an invite code to share.', 'users'],
                  ['join', 'Join with code', 'Enter a group invite code. The admin approves your request.', 'link'],
                ] as const).map(([key, title, hint, icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSheet(key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--pz-line)', background: 'var(--pz-bg)', color: 'var(--pz-ink)', cursor: 'pointer' }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--pz-warn-bg)', color: 'var(--pz-warn)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={icon} size={20} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{title}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--pz-muted)', marginTop: 2 }}>{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {sheet === 'create' && (
              <form onSubmit={(e) => { e.preventDefault(); if (!busy && groupName.trim().length >= 2) createGroup(); }} style={{ display: 'grid', gap: 12 }}>
                <b style={{ fontSize: 16 }}>New group</b>
                <input className="pz-input" autoFocus placeholder="Group name" aria-label="Group name" maxLength={100} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                {sheetError && <div className="pz-banner bad" role="alert">{sheetError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="pz-btn" type="button" onClick={() => { setSheet('menu'); setSheetError(''); }}>Back</button>
                  <button className="pz-btn primary" type="submit" disabled={busy || groupName.trim().length < 2}>{busy ? 'Creating...' : 'Create group'}</button>
                </div>
              </form>
            )}

            {sheet === 'join' && (
              <form onSubmit={(e) => { e.preventDefault(); if (!busy && joinCode.trim().length >= 4) joinGroup(); }} style={{ display: 'grid', gap: 12 }}>
                <b style={{ fontSize: 16 }}>Join with code</b>
                <input className="pz-input" autoFocus placeholder="Invite code, for example ABC-123" aria-label="Group invite code" maxLength={12} autoCapitalize="characters" value={joinCode} style={{ textTransform: 'uppercase' }} onChange={(e) => setJoinCode(e.target.value)} />
                {sheetError && <div className="pz-banner bad" role="alert">{sheetError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="pz-btn" type="button" onClick={() => { setSheet('menu'); setSheetError(''); }}>Back</button>
                  <button className="pz-btn primary" type="submit" disabled={busy || joinCode.trim().length < 4}>{busy ? 'Sending...' : 'Send request'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <p className="pz-note">General chat stays on your usual apps. Trip chat is for stops, status and the itinerary.</p>
    </>
  );
}
