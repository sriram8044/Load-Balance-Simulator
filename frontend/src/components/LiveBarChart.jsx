import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useSimulation } from '../context/SimulationContext.jsx';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div style={{
        background: '#0d1729', border: '1px solid #1a2744', borderRadius: 8,
        padding: '10px 14px', fontSize: 12,
      }}>
        <div className="font-semibold text-white mb-1">{label}</div>
        <div style={{ color: payload[0].color }}>Load: {d.loadPercent}%</div>
        <div style={{ color: '#64748b' }}>Connections: {d.activeConnections} / {d.maxCapacity}</div>
        <div style={{ color: '#64748b' }}>Status: {d.status}</div>
      </div>
    );
  }
  return null;
};

function getBarColor(loadPercent, status) {
  if (status === 'down')       return '#ef4444';
  if (status === 'overloaded') return '#f59e0b';
  if (loadPercent > 60)        return '#f59e0b';
  return '#3b82f6';
}

export default function LiveBarChart({ customServers }) {
  const { metrics } = useSimulation();
  const servers = customServers || metrics?.servers || [];

  const data = servers.map(s => ({
    name: s.name,
    loadPercent: s.loadPercent,
    activeConnections: s.activeConnections,
    maxCapacity: s.maxCapacity,
    status: s.status,
  }));

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-white">Server Load Distribution</h3>
        <div className="flex items-center gap-3 text-xs" style={{ color: '#64748b' }}>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#3b82f6' }} />
            Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f59e0b' }} />
            Overloaded
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#ef4444' }} />
            Down
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => `${v}%`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="loadPercent" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={getBarColor(entry.loadPercent, entry.status)}
                opacity={entry.status === 'down' ? 0.4 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
