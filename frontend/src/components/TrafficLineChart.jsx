import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import { useSimulation } from '../context/SimulationContext.jsx';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: '#0d1729', border: '1px solid #1a2744', borderRadius: 8,
        padding: '8px 12px', fontSize: 12,
      }}>
        <div style={{ color: '#3b82f6', fontWeight: 600 }}>{payload[0].value} req/s</div>
      </div>
    );
  }
  return null;
};

export default function TrafficLineChart() {
  const { metrics } = useSimulation();
  const rawHistory = metrics?.rpsHistory || [];

  // Format time labels
  const data = rawHistory.map((point, i) => ({
    t: i,
    rps: point.rps,
    label: new Date(point.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));

  const maxRps = Math.max(...data.map(d => d.rps), 5);

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-white">Traffic Over Time</h3>
        <span className="font-mono text-xs" style={{ color: '#3b82f6' }}>
          {metrics?.requestsPerSecond || 0} req/s current
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, Math.ceil(maxRps * 1.2)]} tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(59,130,246,0.3)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="rps"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#trafficGrad)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {data.length === 0 && (
        <div className="text-center text-xs py-4" style={{ color: '#475569' }}>
          Start simulation to see traffic data
        </div>
      )}
    </div>
  );
}
