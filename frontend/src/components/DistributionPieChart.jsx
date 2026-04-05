import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSimulation } from '../context/SimulationContext.jsx';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a78bfa', '#fb923c', '#34d399'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div style={{
        background: '#0d1729', border: '1px solid #1a2744', borderRadius: 8,
        padding: '8px 12px', fontSize: 12,
      }}>
        <div className="font-semibold text-white">{d.name}</div>
        <div style={{ color: '#64748b' }}>{d.value.toLocaleString()} requests</div>
        <div style={{ color: '#64748b' }}>
          {d.totalProcessed > 0
            ? `${Math.round((d.value / d.totalAll) * 100)}% of total`
            : '0%'}
        </div>
      </div>
    );
  }
  return null;
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function DistributionPieChart({ customServers }) {
  const { metrics } = useSimulation();
  const servers = customServers || metrics?.servers || [];
  const total = servers.reduce((sum, s) => sum + (s.totalProcessed || 0), 0);

  const data = servers
    .filter(s => s.totalProcessed > 0)
    .map(s => ({
      name: s.name,
      value: s.totalProcessed,
      totalAll: total,
      totalProcessed: s.totalProcessed,
    }));

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-white">Request Distribution</h3>
        <span className="text-xs font-mono" style={{ color: '#64748b' }}>
          {total.toLocaleString()} total
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-xs" style={{ color: '#475569' }}>
          Start simulation to see distribution
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Custom legend */}
          <div className="grid grid-cols-2 gap-1">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{d.name}</span>
                <span className="font-mono ml-auto" style={{ color: COLORS[i % COLORS.length] }}>
                  {Math.round((d.value / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
