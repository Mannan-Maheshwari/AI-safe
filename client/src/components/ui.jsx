import { Loader2 } from 'lucide-react';

const DECISION = {
  ALLOW: ['ALLOWED', 'text-neon border-neon/40 bg-neon/10'],
  BLOCK: ['BLOCKED', 'text-danger border-danger/40 bg-danger/10'],
  REQUIRE_APPROVAL: ['APPROVAL REQUIRED', 'text-warn border-warn/40 bg-warn/10'],
  ANALYZING: ['ANALYZING', 'text-cyber border-cyber/40 bg-cyber/10'],
  NONE: ['UNGUARDED', 'text-hot border-hot/40 bg-hot/10'],
};
const RISK = { LOW: 'text-neon', MEDIUM: 'text-cyber', HIGH: 'text-warn', CRITICAL: 'text-danger' };

export const Pill = ({ cls = '', children }) => (
  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{children}</span>
);
export const DecisionBadge = ({ d }) => {
  if (!d) return <span className="text-muted text-xs">—</span>;
  const [label, cls] = DECISION[d] || [d, 'text-muted border-line'];
  return <Pill cls={cls}>{label}</Pill>;
};
export const RiskBadge = ({ level, score }) =>
  level ? <span className={`text-xs font-mono ${RISK[level] || 'text-muted'}`}>{level}{score != null ? ` · ${score}` : ''}</span> : <span className="text-muted text-xs">—</span>;

export const PageHeader = ({ title, sub, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {sub && <p className="text-sm text-muted mt-1 max-w-2xl">{sub}</p>}
    </div>
    <div className="flex gap-2">{children}</div>
  </div>
);
export const Spinner = ({ label }) => (
  <div className="flex items-center gap-2 text-muted text-sm py-8 justify-center"><Loader2 className="animate-spin" size={16} />{label || 'Loading…'}</div>
);
export const Empty = ({ children }) => <div className="text-sm text-muted text-center py-10">{children}</div>;
export const ErrorBox = ({ msg }) => msg ? <div className="rounded-lg border border-danger/40 bg-danger/10 text-danger text-sm px-3 py-2 mb-4">{msg}</div> : null;
export const Toggle = ({ on, onChange, disabled }) => (
  <button role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
    className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-neon' : 'bg-line'}`}>
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all ${on ? 'left-[18px]' : 'left-0.5 bg-muted'}`} />
  </button>
);
export const fmtTime = (d) => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const Json = ({ v }) => <pre className="font-mono text-xs bg-panel border border-line rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(v, null, 2)}</pre>;
