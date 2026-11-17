import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Send, Trash2, ShieldCheck, ShieldOff, ChevronDown } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { DecisionBadge, Empty, ErrorBox, Json, Pill, RiskBadge, Spinner } from '../components/ui';

const STATUS = { executed: 'text-neon', failed: 'text-danger', blocked: 'text-danger', pending_approval: 'text-warn' };
const SAMPLES = ['What is the weather in Delhi?', 'Read email e1 and tell me what it says.', 'Please read my latest email e2 and summarize it.', 'Transfer 500 to Alice from my account.', 'Delete file f1.'];

function CallCard({ c, open }) {
  return (
    <details className="card p-3" open={open}>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
        <span className="font-mono text-sm">{c.tool}</span>
        <span className="flex items-center gap-2"><DecisionBadge d={c.decision} /><ChevronDown size={14} className="text-muted" /></span>
      </summary>
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex items-center gap-3"><RiskBadge level={c.riskLevel} score={c.riskScore} /><span className={STATUS[c.status]}>{c.status?.replace('_', ' ')}</span>{c.unauthorized && <Pill cls="text-hot border-hot/40 bg-hot/10">unauthorized execution</Pill>}</div>
        {c.reason && <p className="text-muted">{c.reason}{c.policy ? ` (policy: ${c.policy})` : ''}</p>}
        <div className="text-muted">Arguments</div><Json v={c.args} />
        {c.ai && <><div className="text-muted">AI risk assessment ({c.ai.source})</div><Json v={{ riskScore: c.ai.riskScore, threatType: c.ai.threatType, recommendation: c.ai.recommendation, reason: c.ai.reason }} /></>}
        {c.output && <><div className="text-muted">Tool result (untrusted data)</div><Json v={c.output} /></>}
        {c.error && <p className="text-danger">{c.error}</p>}
        {c.status === 'pending_approval' && <Link to="/approvals" className="text-warn underline">Review in Approval Center</Link>}
      </div>
    </details>
  );
}

export default function Playground() {
  const [sessions, setSessions] = useState([]);
  const [sid, setSid] = useState(null);
  const [turns, setTurns] = useState([]);
  const [mode, setMode] = useState('protected');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const end = useRef(null);

  const loadList = () => api.get('/agent/sessions').then((r) => setSessions(r.data.sessions)).catch(() => {});
  useEffect(() => { loadList(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  const open = async (id) => {
    try {
      const { session } = (await api.get(`/agent/sessions/${id}`)).data;
      setSid(id); setTurns(session.turns); setMode(session.mode); setSel(null);
    } catch (e) { setErr(errMsg(e)); }
  };
  const fresh = () => { setSid(null); setTurns([]); setSel(null); setErr(''); };
  const del = async (id) => { await api.delete(`/agent/sessions/${id}`); if (id === sid) fresh(); loadList(); };

  const send = async (msg) => {
    const message = (msg ?? text).trim();
    if (!message || busy) return;
    setText(''); setErr(''); setBusy(true);
    setTurns((t) => [...t, { role: 'user', text: message }]);
    try {
      const { data } = await api.post('/agent/chat', { sessionId: sid || undefined, message, mode });
      setSid(data.sessionId);
      setTurns((t) => { const n = [...t, { role: 'agent', text: data.reply, toolCalls: data.toolCalls, mode, summary: data.summary }]; setSel(n.length - 1); return n; });
      loadList();
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  const active = sel != null ? turns[sel] : null;
  return (
    <div className="grid lg:grid-cols-[220px_1fr_340px] gap-4 h-[calc(100vh-7rem)]">
      <aside className="card p-3 flex flex-col min-h-0 max-lg:hidden">
        <button className="btn-ghost w-full mb-3" onClick={fresh}><Plus size={15} />New session</button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.map((s) => (
            <div key={s._id} className={`group flex items-center rounded-lg px-2.5 py-2 text-sm cursor-pointer ${s._id === sid ? 'bg-cyber/12 text-cyber' : 'hover:bg-white/5 text-muted'}`} onClick={() => open(s._id)}>
              <span className="truncate flex-1">{s.sessionName || 'Session'}</span>
              <button aria-label="Delete session" className="opacity-0 group-hover:opacity-100 hover:text-danger" onClick={(e) => { e.stopPropagation(); del(s._id); }}><Trash2 size={13} /></button>
            </div>
          ))}
          {!sessions.length && <Empty>No sessions yet.</Empty>}
        </div>
      </aside>

      <section className="card flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm font-medium">Agent chat</span>
          <div className="flex rounded-lg border border-line overflow-hidden text-xs">
            <button onClick={() => setMode('protected')} className={`px-3 py-1.5 flex items-center gap-1.5 ${mode === 'protected' ? 'bg-neon/15 text-neon' : 'text-muted'}`}><ShieldCheck size={13} />Protected</button>
            <button onClick={() => setMode('unprotected')} className={`px-3 py-1.5 flex items-center gap-1.5 ${mode === 'unprotected' ? 'bg-hot/15 text-hot' : 'text-muted'}`}><ShieldOff size={13} />Unprotected</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!turns.length && (
            <div className="text-sm text-muted">
              <p className="mb-3">Ask the agent to use its tools. Every tool call it proposes appears on the right with the gateway's decision.</p>
              <div className="flex flex-wrap gap-2">{SAMPLES.map((s) => <button key={s} className="btn-ghost !text-xs" onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          )}
          {turns.map((t, i) => t.role === 'user' ? (
            <div key={i} className="flex justify-end"><div className="max-w-[80%] rounded-xl bg-cyber/15 border border-cyber/30 px-3.5 py-2 text-sm whitespace-pre-wrap">{t.text}</div></div>
          ) : (
            <div key={i} className="max-w-[88%] space-y-2">
              {t.text && <div className="rounded-xl bg-panel border border-line px-3.5 py-2 text-sm whitespace-pre-wrap">{t.text}</div>}
              {(t.toolCalls || []).map((c, j) => (
                <button key={j} onClick={() => setSel(i)} className="flex items-center gap-2 text-xs card px-2.5 py-1.5 hover:border-cyber/50">
                  <span className="font-mono">{c.tool}</span><DecisionBadge d={c.decision} />
                </button>
              ))}
            </div>
          ))}
          {busy && <Spinner label="Agent is working…" />}
          <div ref={end} />
        </div>
        <div className="p-3 border-t border-line">
          <ErrorBox msg={err} />
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type an instruction…" maxLength={2000} aria-label="Message" />
            <button className="btn-primary" disabled={busy || !text.trim()}><Send size={15} />Send</button>
          </form>
        </div>
      </section>

      <aside className="card p-3 overflow-y-auto min-h-0 max-lg:hidden">
        <h3 className="text-sm font-medium mb-3">Security inspection</h3>
        {active?.toolCalls?.length ? (
          <div className="space-y-2.5">
            {active.mode === 'unprotected' && <p className="text-xs text-hot">Unprotected mode: calls ran without gateway checks.</p>}
            {active.toolCalls.map((c, i) => <CallCard key={i} c={c} open={i === 0} />)}
          </div>
        ) : <Empty>Select an agent reply with tool calls to inspect decisions.</Empty>}
      </aside>
    </div>
  );
}
