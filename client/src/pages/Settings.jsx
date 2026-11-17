import { useEffect, useState } from 'react';
import api, { errMsg } from '../services/api';
import { ErrorBox, PageHeader, Pill } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/security/status').then((r) => setSt(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  const reset = async () => { try { await api.post('/simulator/reset'); setMsg('Sandbox data restored to its original state.'); } catch (e) { setErr(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Settings" />
      <ErrorBox msg={err} />
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <div className="card p-4 space-y-2 text-sm">
          <h3 className="font-medium mb-1">Account</h3>
          <div className="flex justify-between"><span className="text-muted">Name</span>{user.name}</div>
          <div className="flex justify-between"><span className="text-muted">Email</span>{user.email}</div>
          <div className="flex justify-between"><span className="text-muted">Role</span><Pill cls="text-cyber border-cyber/40">{user.role}</Pill></div>
        </div>
        <div className="card p-4 space-y-2 text-sm">
          <h3 className="font-medium mb-1">Agent Shield engine</h3>
          <div className="flex justify-between"><span className="text-muted">AI provider</span>{st ? (st.provider.name === 'gemini' ? `Gemini (${st.provider.model})` : 'Offline simulator (no API key)') : '…'}</div>
          <div className="flex justify-between"><span className="text-muted">Failure behaviour</span><span className="text-neon">Fail closed</span></div>
          <div className="flex justify-between"><span className="text-muted">Risk thresholds</span><span className="font-mono text-xs">{st ? `med ${st.thresholds.medium} · high ${st.thresholds.high} · crit ${st.thresholds.critical}` : '…'}</span></div>
        </div>
        <div className="card p-4 md:col-span-2 space-y-3">
          <h3 className="font-medium">Sandbox data</h3>
          <p className="text-sm text-muted">Restores the mock mailbox, documents and accounts that the simulated tools work on, in both protected and unprotected sandboxes.</p>
          {msg && <p className="text-sm text-neon">{msg}</p>}
          <button className="btn-ghost" onClick={reset}>Reset sandbox data</button>
        </div>
      </div>
    </>
  );
}
