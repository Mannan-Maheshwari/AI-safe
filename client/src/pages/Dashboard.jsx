import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errMsg } from '../services/api';
import { DecisionBadge, Empty, ErrorBox, PageHeader, RiskBadge, Spinner, fmtTime } from '../components/ui';

const tip = { contentStyle: { background: '#0B0D12', border: '1px solid #242936', borderRadius: 8, fontSize: 12 }, cursor: { fill: '#ffffff08' } };
const axis = { stroke: '#9299A5', fontSize: 11, tickLine: false, axisLine: false };

function Stat({ label, value, color }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-display text-3xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
function Panel({ title, children, empty }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="h-56">{empty ? <Empty>No data yet. Run something in the Playground or Simulator.</Empty> : children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const load = () => api.get('/security/analytics').then((r) => { setD(r.data); setErr(''); }).catch((e) => setErr(errMsg(e)));
    load();
    const t = setInterval(load, 5000); // keeps the dashboard live as new events arrive
    return () => clearInterval(t);
  }, []);
  if (!d) return err ? <ErrorBox msg={err} /> : <Spinner />;
  const s = d.stats;
  const barColors = { Allowed: '#39FF14', Blocked: '#FF4545', Approval: '#FFB020' };
  const riskColors = ['#39FF14', '#00A3FF', '#FFB020', '#FF4545'];

  return (
    <>
      <PageHeader title="Overview" sub="Live security activity from your agent sessions. Refreshes every few seconds." />
      <ErrorBox msg={err} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Stat label="Total requests" value={s.totalRequests} color="text-cyber" />
        <Stat label="Attacks detected" value={s.injections} color="text-hot" />
        <Stat label="Tool calls blocked" value={s.blocked} color="text-danger" />
        <Stat label="Pending approvals" value={s.pending} color="text-warn" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Stat label="Tool call attempts" value={s.toolAttempts} color="text-ink" />
        <Stat label="Allowed operations" value={s.allowed} color="text-neon" />
        <Stat label="High-risk operations" value={s.highRisk} color="text-warn" />
        <Stat label="Events logged" value={d.byType.reduce((a, x) => a + x.value, 0)} color="text-ink" />
      </div>
      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2">
          <Panel title="Security activity over time (last 7 days)" empty={!d.overTime.length}>
            <ResponsiveContainer>
              <AreaChart data={d.overTime}>
                <CartesianGrid stroke="#242936" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} />
                <Area dataKey="allowed" stackId="1" stroke="#39FF14" fill="#39FF1433" name="Allowed" />
                <Area dataKey="approvals" stackId="1" stroke="#FFB020" fill="#FFB02033" name="Approvals" />
                <Area dataKey="blocked" stackId="1" stroke="#FF4545" fill="#FF454533" name="Blocked" />
                <Area dataKey="attacks" stackId="1" stroke="#FF2E93" fill="#FF2E9333" name="Attacks detected" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>
        <Panel title="Allowed vs blocked" empty={!d.allowedVsBlocked.some((x) => x.value)}>
          <ResponsiveContainer>
            <BarChart data={d.allowedVsBlocked}>
              <CartesianGrid stroke="#242936" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{d.allowedVsBlocked.map((x) => <Cell key={x.name} fill={barColors[x.name]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <div className="grid xl:grid-cols-2 gap-4 mb-4">
        <Panel title="Attack category distribution" empty={!d.byThreat.length}>
          <ResponsiveContainer>
            <BarChart data={d.byThreat} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid stroke="#242936" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axis} /><YAxis type="category" dataKey="name" width={150} {...axis} tickFormatter={(v) => v.replaceAll('_', ' ').toLowerCase()} /><Tooltip {...tip} />
              <Bar dataKey="value" fill="#FF2E93" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Risk score distribution" empty={!d.riskDist.some((x) => x.value)}>
          <ResponsiveContainer>
            <BarChart data={d.riskDist}>
              <CartesianGrid stroke="#242936" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" {...axis} /><YAxis allowDecimals={false} {...axis} /><Tooltip {...tip} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{d.riskDist.map((x, i) => <Cell key={x.name} fill={riskColors[i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-medium p-4 pb-2">Recent security events</h3>
        <table className="w-full">
          <thead><tr><th className="th">Time</th><th className="th">Event</th><th className="th">Tool</th><th className="th">Risk</th><th className="th">Decision</th></tr></thead>
          <tbody>
            {d.recent.map((e) => (
              <tr key={e._id}>
                <td className="td text-muted whitespace-nowrap">{fmtTime(e.createdAt)}</td>
                <td className="td font-mono text-xs">{e.eventType}</td>
                <td className="td font-mono text-xs">{e.toolName || '—'}</td>
                <td className="td"><RiskBadge level={e.riskLevel} score={e.riskScore} /></td>
                <td className="td"><DecisionBadge d={e.decision} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.recent.length && <Empty>No events yet.</Empty>}
      </div>
    </>
  );
}
