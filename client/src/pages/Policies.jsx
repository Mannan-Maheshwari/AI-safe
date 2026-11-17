import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { DecisionBadge, ErrorBox, PageHeader, Pill, Spinner, Toggle } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Policies() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/security/policies').then((r) => setList(r.data.policies)).catch((e) => setErr(errMsg(e))); }, []);
  const toggle = async (p, enabled) => {
    setErr('');
    try { const { policy } = (await api.put(`/security/policies/${p._id}`, { enabled })).data; setList((l) => l.map((x) => (x._id === p._id ? policy : x))); }
    catch (e) { setErr(errMsg(e)); }
  };
  if (!list) return err ? <ErrorBox msg={err} /> : <Spinner />;
  return (
    <>
      <PageHeader title="Security policies" sub="Deterministic rules enforced by the gateway, independent of any AI model. Baseline rules are locked and cannot be switched off." />
      <ErrorBox msg={err} />
      {user.role !== 'admin' && <p className="text-xs text-warn mb-3">Only administrators can change policies.</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {list.map((p) => (
          <div key={p._id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium flex items-center gap-2">{p.name}{p.mandatory && <Lock size={13} className="text-muted" aria-label="Mandatory baseline rule" />}</div>
                <p className="text-sm text-muted mt-1">{p.description}</p>
              </div>
              <Toggle on={p.enabled} disabled={p.mandatory || user.role !== 'admin'} onChange={(v) => toggle(p, v)} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="font-mono text-muted">{p.tool}</span>
              {p.action === 'ESCALATE' ? <Pill cls="text-cyber border-cyber/40">ESCALATE ONLY</Pill> : <DecisionBadge d={p.action} />}
              {p.mandatory && <Pill cls="text-muted border-line">baseline</Pill>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
