import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../services/api';
import { ErrorBox } from '../components/ui';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { mode === 'login' ? await login(f.email, f.password) : await register(f.name, f.email, f.password); }
    catch (x) { setErr(errMsg(x)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-center px-16 bg-panel border-r border-line">
        <ShieldCheck className="text-neon mb-6" size={44} />
        <h1 className="font-display text-4xl font-bold leading-tight max-w-md">The model proposes. The gateway decides.</h1>
        <p className="text-muted mt-4 max-w-md">Agent Shield sits between your AI agent and its tools, checking every call against policy, ownership and risk before anything runs.</p>
        <div className="mt-8 flex gap-3 text-xs font-mono">
          <span className="text-neon">ALLOW</span><span className="text-danger">BLOCK</span><span className="text-warn">REQUIRE_APPROVAL</span>
        </div>
      </section>
      <section className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h2 className="font-display text-2xl font-semibold">{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
          <ErrorBox msg={err} />
          {mode === 'register' && <div><label className="text-xs text-muted">Name</label><input className="input mt-1" value={f.name} onChange={set('name')} required minLength={2} autoComplete="name" /></div>}
          <div><label className="text-xs text-muted">Email</label><input type="email" className="input mt-1" value={f.email} onChange={set('email')} required autoComplete="email" /></div>
          <div><label className="text-xs text-muted">Password {mode === 'register' && '(8+ characters)'}</label><input type="password" className="input mt-1" value={f.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
          <button type="button" className="text-sm text-muted hover:text-ink w-full" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
          </button>
          {mode === 'register' && <p className="text-xs text-muted">The first account registered becomes the administrator.</p>}
        </form>
      </section>
    </div>
  );
}
