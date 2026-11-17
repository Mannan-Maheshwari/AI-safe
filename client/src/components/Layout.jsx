import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Swords, ScrollText, KeyRound, ClipboardCheck, FileSearch, Settings, ShieldCheck, LogOut } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const NAV = [
  ['/', 'Overview', LayoutDashboard], ['/playground', 'AI Playground', MessageSquare], ['/simulator', 'Attack Simulator', Swords],
  ['/policies', 'Security Policies', ScrollText], ['/permissions', 'Tool Permissions', KeyRound], ['/approvals', 'Approval Center', ClipboardCheck],
  ['/logs', 'Security Logs', FileSearch], ['/settings', 'Settings', Settings],
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState(null);
  useEffect(() => { api.get('/security/status').then((r) => setStatus(r.data)).catch(() => setStatus({ offline: true })); }, []);
  const online = status && !status.offline;

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 bg-panel border-r border-line flex flex-col max-md:hidden">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <ShieldCheck className="text-neon" size={26} />
          <div>
            <div className="font-display font-semibold leading-none text-lg">Agent Shield</div>
            <div className="text-[11px] text-muted mt-1">Zero-trust AI gateway</div>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-0.5">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-cyber/12 text-cyber' : 'text-muted hover:text-ink hover:bg-white/5'}`}>
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 card px-3 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-neon live-dot' : 'bg-danger'}`} />
            <span>{online ? 'Gateway online · fail-closed' : 'API unreachable'}</span>
          </div>
          {online && <div className="text-muted mt-1">AI: {status.provider.name === 'gemini' ? status.provider.model : 'offline simulator'}</div>}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-line flex items-center justify-between px-5 bg-bg">
          <nav className="md:hidden flex gap-1 overflow-x-auto">
            {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `px-2 py-1 text-xs rounded whitespace-nowrap ${isActive ? 'text-cyber' : 'text-muted'}`}>{label}</NavLink>)}
          </nav>
          <span className="max-md:hidden text-sm text-muted">Every tool call is intercepted, evaluated and logged.</span>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm">{user.name}</div>
              <div className="text-[11px] text-muted">{user.role}</div>
            </div>
            <button className="btn-ghost !px-2.5" onClick={logout} title="Log out" aria-label="Log out"><LogOut size={16} /></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  );
}
