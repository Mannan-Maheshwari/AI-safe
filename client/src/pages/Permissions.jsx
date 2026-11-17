import { useEffect, useState } from 'react';
import api, { errMsg } from '../services/api';
import { ErrorBox, PageHeader, Pill, Spinner, Toggle } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const RISK = { low: 'text-neon border-neon/40', medium: 'text-cyber border-cyber/40', high: 'text-warn border-warn/40', critical: 'text-danger border-danger/40' };

export default function Permissions() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/tools/permissions').then((r) => setList(r.data.permissions)).catch((e) => setErr(errMsg(e))); }, []);
  const patch = async (p, body) => {
    setErr('');
    try { const { permission } = (await api.put(`/tools/permissions/${p._id}`, body)).data; setList((l) => l.map((x) => (x._id === p._id ? permission : x))); }
    catch (e) { setErr(errMsg(e)); }
  };
  if (!list) return err ? <ErrorBox msg={err} /> : <Spinner />;
  const admin = user.role === 'admin';
  return (
    <>
      <PageHeader title="Tool permissions" sub="The five simulated tools the agent can propose. Disabling a tool makes the gateway block it. Approval cannot be removed from high or critical tools." />
      <ErrorBox msg={err} />
      {!admin && <p className="text-xs text-warn mb-3">Only administrators can change permissions.</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((p) => (
          <div key={p._id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between"><span className="font-mono text-sm">{p.toolName}</span><Pill cls={RISK[p.riskLevel]}>{p.riskLevel} risk</Pill></div>
            <p className="text-sm text-muted">{p.description}</p>
            <div className="text-xs text-muted">Permission level: <span className="text-ink">{p.permission}</span></div>
            <div className="flex items-center justify-between text-sm"><span>Enabled</span><Toggle on={p.allowed} disabled={!admin} onChange={(v) => patch(p, { allowed: v })} /></div>
            <div className="flex items-center justify-between text-sm"><span>Requires human approval</span><Toggle on={p.requiresApproval} disabled={!admin} onChange={(v) => patch(p, { requiresApproval: v })} /></div>
          </div>
        ))}
      </div>
    </>
  );
}
