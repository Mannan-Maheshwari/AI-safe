import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Play, GitCompare, Gauge, RotateCcw } from 'lucide-react';
import api, { errMsg } from '../services/api';
import { DecisionBadge, ErrorBox, PageHeader, Pill, Spinner } from '../components/ui';

function RunCard({ run }) {
  const attack = run.attack;
  const bad = attack && run.attackSuccess;
  const banner = !attack ? (run.falsePositive ? ['Legitimate request was held back (false positive)', 'text-warn border-warn/40 bg-warn/10'] : run.legitCompleted ? ['Legitimate task completed', 'text-neon border-neon/40 bg-neon/10'] : ['No action taken', 'text-muted border-line'])
    : bad ? ['ATTACK SUCCEEDED — unauthorized action executed', 'text-hot border-hot/50 bg-hot/10'] : ['ATTACK DEFENDED — nothing unauthorized ran', 'text-neon border-neon/40 bg-neon/10'];
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Pill cls={run.mode === 'protected' ? 'text-neon border-neon/40' : 'text-hot border-hot/40'}>{run.mode === 'protected' ? 'Protected by Agent Shield' : 'Unprotected agent'}</Pill>
        <span className="text-xs text-muted font-mono">{run.latencyMs} ms · gateway avg {run.summary.gatewayLatencyMs} ms</span>
      </div>
      <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${banner[1]}`}>{banner[0]}</div>
      <div className="space-y-1.5">
        {run.toolCalls.map((c, i) => (
          <div key={i} className="rounded-lg bg-panel border border-line p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono">{c.tool}<span className="text-muted"> {JSON.stringify(c.args)}</span></span>
              <DecisionBadge d={c.decision} />
            </div>
            <div className="mt-1.5 text-muted">{c.reason}</div>
            <div className="mt-1 flex gap-3"><span>status: {c.status?.replace('_', ' ')}</span>{c.unauthorized && <span className="text-hot">unauthorized execution</span>}{c.riskScore != null && <span>risk {c.riskScore}</span>}</div>
          </div>
        ))}
        {!run.toolCalls.length && <p className="text-xs text-muted">The agent proposed no tool calls.</p>}
      </div>
      {run.summary.injectionDetected && <p className="text-xs text-hot">Prompt injection detected and logged.</p>}
      {run.error && <p className="text-xs text-danger">{run.error}</p>}
    </div>
  );
}

const pct = (v) => (v == null ? '—' : `${v}%`);
const ROWS = [['Attack success rate', 'attackSuccessRate', pct, 'lower'], ['Unauthorized executions', 'unauthorizedExecutions', (v) => v, 'lower'], ['Detection rate', 'detectionRate', pct, 'higher'], ['False positive rate', 'falsePositiveRate', pct, 'lower'], ['Legitimate task completion', 'legitimateCompletionRate', pct, 'higher'], ['Avg gateway latency', 'avgGatewayLatencyMs', (v) => (v == null ? '—' : `${v} ms`), 'lower']];

export default function Simulator() {
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [mode, setMode] = useState('compare');
  const [runs, setRuns] = useState(null);
  const [bench, setBench] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { api.get('/simulator/scenarios').then((r) => { setList(r.data.scenarios); setSel(r.data.scenarios[0]); }).catch((e) => setErr(errMsg(e))); }, []);

  const run = async () => {
    setErr(''); setBench(null); setRuns(null); setBusy('Running scenario…');
    try {
      if (mode === 'compare') setRuns((await api.post('/simulator/compare', { scenarioId: sel.id })).data.result.runs);
      else setRuns((await api.post('/simulator/run', { scenarioId: sel.id, mode })).data.result.runs);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(''); }
  };
  const benchmark = async () => {
    setErr(''); setRuns(null); setBench(null); setBusy('Running every scenario in both modes…');
    try { setBench((await api.post('/simulator/compare', { scenarioId: 'all' })).data.result); } catch (e) { setErr(errMsg(e)); } finally { setBusy(''); }
  };
  const reset = async () => { await api.post('/simulator/reset'); setErr(''); };

  const chart = bench && [
    { name: 'Attack success %', Unprotected: bench.metrics.unprotected.attackSuccessRate, 'Agent Shield': bench.metrics.protected.attackSuccessRate },
    { name: 'Detection %', Unprotected: bench.metrics.unprotected.detectionRate, 'Agent Shield': bench.metrics.protected.detectionRate },
    { name: 'False positive %', Unprotected: bench.metrics.unprotected.falsePositiveRate, 'Agent Shield': bench.metrics.protected.falsePositiveRate },
    { name: 'Task completion %', Unprotected: bench.metrics.unprotected.legitimateCompletionRate, 'Agent Shield': bench.metrics.protected.legitimateCompletionRate },
  ];

  return (
    <>
      <PageHeader title="Attack Simulator" sub="Replay prompt-injection attacks against the same agent with and without Agent Shield. All tools are simulated; nothing real is ever sent, moved or deleted.">
        <button className="btn-ghost" onClick={reset} disabled={!!busy}><RotateCcw size={15} />Reset sandbox data</button>
        <button className="btn-ghost" onClick={benchmark} disabled={!!busy}><Gauge size={15} />Run full benchmark</button>
      </PageHeader>
      <ErrorBox msg={err} />
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <div className="card p-2 space-y-1 self-start">
          {list.map((s) => (
            <button key={s.id} onClick={() => { setSel(s); setRuns(null); setBench(null); }} className={`w-full text-left rounded-lg px-3 py-2.5 ${sel?.id === s.id ? 'bg-hot/10 border border-hot/40' : 'border border-transparent hover:bg-white/5'}`}>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs text-muted mt-0.5">{s.attack ? s.category.replaceAll('_', ' ').toLowerCase() : 'legitimate request'}</div>
            </button>
          ))}
        </div>
        <div className="space-y-4 min-w-0">
          {sel && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2"><h2 className="font-display text-lg font-semibold">{sel.name}</h2><Pill cls={sel.attack ? 'text-hot border-hot/40' : 'text-neon border-neon/40'}>{sel.attack ? 'attack' : 'benign'}</Pill></div>
              <p className="text-sm text-muted">{sel.description}</p>
              <div><div className="text-xs text-muted mb-1">Input sent to the agent</div><div className="font-mono text-sm bg-panel border border-line rounded-lg p-2.5">{sel.input}</div></div>
              <div><div className="text-xs text-muted mb-1">Expected outcome</div><p className="text-sm">{sel.expected}</p></div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <select className="input !w-auto" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Execution mode">
                  <option value="compare">Compare both modes</option><option value="protected">Protected only</option><option value="unprotected">Unprotected only</option>
                </select>
                <button className="btn-stop" onClick={run} disabled={!!busy}>{mode === 'compare' ? <GitCompare size={15} /> : <Play size={15} />}{mode === 'compare' ? 'Run comparison' : 'Execute attack'}</button>
              </div>
            </div>
          )}
          {busy && <Spinner label={busy} />}
          {runs && <div className={`grid gap-4 ${runs.length > 1 ? 'xl:grid-cols-2' : ''}`}>{runs.map((r, i) => <RunCard key={i} run={r} />)}</div>}
          {bench && (
            <div className="card p-4 space-y-4">
              <h3 className="font-medium">Benchmark results ({bench.runs.length / 2} scenarios, identical tools, data and inputs in both modes)</h3>
              <table className="w-full"><thead><tr><th className="th">Metric</th><th className="th">Unprotected</th><th className="th">Agent Shield</th></tr></thead>
                <tbody>{ROWS.map(([label, key, f]) => (
                  <tr key={key}><td className="td">{label}</td><td className="td font-mono text-hot">{f(bench.metrics.unprotected[key])}</td><td className="td font-mono text-neon">{f(bench.metrics.protected[key])}</td></tr>
                ))}</tbody></table>
              <div className="h-60"><ResponsiveContainer><BarChart data={chart}><CartesianGrid stroke="#242936" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" stroke="#9299A5" fontSize={11} tickLine={false} /><YAxis stroke="#9299A5" fontSize={11} tickLine={false} domain={[0, 100]} /><Tooltip contentStyle={{ background: '#0B0D12', border: '1px solid #242936', borderRadius: 8, fontSize: 12 }} /><Legend /><Bar dataKey="Unprotected" fill="#FF2E93" radius={[6, 6, 0, 0]} /><Bar dataKey="Agent Shield" fill="#39FF14" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <p className="text-xs text-muted">Results come from this small built-in scenario set, so treat them as a demonstration. Evaluate with the full dataset before claiming improved security.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
