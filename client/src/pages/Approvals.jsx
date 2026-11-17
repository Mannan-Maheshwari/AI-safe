import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { Empty, ErrorBox, Json, PageHeader, Pill, RiskBadge, Spinner, fmtTime } from '../components/ui';

const ST = { pending: 'text-warn border-warn/40', approved: 'text-neon border-neon/40', rejected: 'text-muted border-line', expired: 'text-muted border-line', blocked: 'text-danger border-danger/40', invalid: 'text-danger border-danger/40', executing: 'text-cyber border-cyber/40' };

function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((new Date(to) - now) / 1000));
  return <span className="font-mono">{s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'expired'}</span>;
}

export default function Approvals() {
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(() => api.get('/approvals', { params: all ? { all: 1 } : {} }).then((r) => setData(r.data)).catch((e) => setErr(errMsg(e))), [all]);
  useEffect(() => { load(); }, [load]);

  const act = async (id, kind) => {
    setBusy(id); setErr(''); setMsg('');
    try {
      const { data: r } = await api.post(`/approvals/${id}/${kind}`);
      setMsg(kind === 'approve' ? (r.ok ? 'Approved and executed in the simulated environment.' : `Approved, but the tool failed: ${r.error}`) : 'Request rejected.');
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(null); load(); }
  };
  if (!data) return err ? <ErrorBox msg={err} /> : <Spinner />;
  return (
    <>
      <PageHeader title="Approval center" sub="Restricted operations wait here. Approving authorizes only the exact tool call shown. Any change to its arguments needs a new approval.">
        <button className="btn-ghost" onClick={() => setAll(!all)}>{all ? 'Show pending only' : 'Show history'}</button>
      </PageHeader>
      <ErrorBox msg={err} />
      {msg && <div className="rounded-lg border border-neon/40 bg-neon/10 text-neon text-sm px-3 py-2 mb-4">{msg}</div>}
      <div className="space-y-4">
        {data.approvals.map((a) => (
          <div key={a._id} className="card p-4 grid md:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono">{a.toolName}</span><Pill cls={ST[a.status]}>{a.status}</Pill><RiskBadge level={a.riskLevel} score={a.riskScore} /></div>
              <p className="text-sm text-muted">{a.reason}</p>
              <Json v={a.arguments} />
              <div className="text-xs text-muted flex flex-wrap gap-x-4">
                <span>Requested by {data.requester}</span><span>{fmtTime(a.createdAt)}</span>
                {a.status === 'pending' && <span>Expires in <Countdown to={a.expiresAt} /></span>}
              </div>
              {a.resultSummary && <p className="text-xs font-mono text-muted break-words">Result: {a.resultSummary}</p>}
            </div>
            {a.status === 'pending' && (
              <div className="flex md:flex-col gap-2">
                <button className="btn-go" disabled={busy === a._id} onClick={() => act(a._id, 'approve')}><Check size={15} />Approve</button>
                <button className="btn-stop" disabled={busy === a._id} onClick={() => act(a._id, 'reject')}><X size={15} />Reject</button>
              </div>
            )}
          </div>
        ))}
        {!data.approvals.length && <Empty>Nothing is waiting for approval. Try "Transfer 500 to Alice" in the Playground.</Empty>}
      </div>
    </>
  );
}
