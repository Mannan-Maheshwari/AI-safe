import { Fragment, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { DecisionBadge, Empty, ErrorBox, Json, PageHeader, RiskBadge, Spinner, fmtTime } from '../components/ui';

const TYPES = ['USER_MESSAGE', 'TOOL_CALL_PROPOSED', 'TOOL_CALL_ALLOWED', 'TOOL_CALL_BLOCKED', 'TOOL_EXECUTED', 'APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'PROMPT_INJECTION_DETECTED', 'AI_RISK_ASSESSMENT'];
const TOOLS = ['get_weather', 'read_email', 'search_workspace', 'transfer_money', 'delete_file'];

export default function SecurityLogs() {
  const [f, setF] = useState({ q: '', decision: '', riskLevel: '', tool: '', eventType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };

  useEffect(() => {
    const params = Object.fromEntries(Object.entries({ ...f, page, limit: 25 }).filter(([, v]) => v !== ''));
    const t = setTimeout(() => api.get('/security/events', { params }).then((r) => { setData(r.data); setErr(''); }).catch((e) => setErr(errMsg(e))), 250);
    return () => clearTimeout(t);
  }, [f, page]);

  const Sel = ({ k, label, opts }) => (
    <select className="input !w-auto" value={f[k]} onChange={set(k)} aria-label={label}><option value="">{label}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select>
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;
  return (
    <>
      <PageHeader title="Security logs" sub="Append-only audit trail of every message, tool call, decision and approval. Passwords, tokens and API keys are redacted." />
      <ErrorBox msg={err} />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative"><Search size={14} className="absolute left-3 top-3 text-muted" /><input className="input !pl-8 !w-56" placeholder="Search reason, tool, threat" value={f.q} onChange={set('q')} aria-label="Search" /></div>
        <Sel k="decision" label="Any decision" opts={['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL', 'NONE']} />
        <Sel k="riskLevel" label="Any risk level" opts={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} />
        <Sel k="tool" label="Any tool" opts={TOOLS} />
        <Sel k="eventType" label="Any event" opts={TYPES} />
        <input type="date" className="input !w-auto" value={f.from} onChange={set('from')} aria-label="From date" />
        <input type="date" className="input !w-auto" value={f.to} onChange={set('to')} aria-label="To date" />
      </div>
      {!data ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Time</th><th className="th">Event</th><th className="th">Tool</th><th className="th">Risk</th><th className="th">Decision</th><th className="th">Reason</th></tr></thead>
            <tbody>
              {data.events.map((e) => (
                <Fragment key={e._id}>
                  <tr className="cursor-pointer hover:bg-white/[.03]" onClick={() => setOpen(open === e._id ? null : e._id)}>
                    <td className="td text-muted whitespace-nowrap">{fmtTime(e.createdAt)}</td>
                    <td className="td font-mono text-xs">{e.eventType}</td>
                    <td className="td font-mono text-xs">{e.toolName || '—'}</td>
                    <td className="td"><RiskBadge level={e.riskLevel} score={e.riskScore} /></td>
                    <td className="td"><DecisionBadge d={e.decision} /></td>
                    <td className="td text-muted max-w-xs truncate">{e.reason || '—'}</td>
                  </tr>
                  {open === e._id && <tr><td colSpan={6} className="td bg-panel"><Json v={{ id: e._id, session: e.sessionId, mode: e.mode, status: e.status, threatType: e.threatType, reason: e.reason, details: e.details }} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!data.events.length && <Empty>No events match these filters.</Empty>}
          <div className="flex items-center justify-between p-3 text-xs text-muted">
            <span>{data.total} events</span>
            <div className="flex items-center gap-2"><button className="btn-ghost !py-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>Page {page} of {pages}<button className="btn-ghost !py-1" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
          </div>
        </div>
      )}
    </>
  );
}
