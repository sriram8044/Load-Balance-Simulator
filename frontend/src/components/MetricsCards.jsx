import { useSimulation } from '../context/SimulationContext.jsx';
import { Activity, Zap, Server, Clock } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, sub, color = '#3b82f6', glow = false }) {
  return (
    <div className="metric-card" style={{ borderColor: glow ? `${color}40` : undefined }}>
      <div className="flex items-center justify-between mb-1">
        <span className="metric-card-label">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}>
          <Icon size={13} color={color} />
        </div>
      </div>
      <div className="metric-card-value" style={{ color }}>
        {value ?? '—'}
      </div>
      {sub && <div className="text-xs" style={{ color: '#475569' }}>{sub}</div>}
    </div>
  );
}

export default function MetricsCards() {
  const { metrics } = useSimulation();

  if (!metrics) return null;

  const healthyCount   = metrics.servers?.filter(s => s.status === 'healthy').length   || 0;
  const overloadCount  = metrics.servers?.filter(s => s.status === 'overloaded').length || 0;
  const downCount      = metrics.servers?.filter(s => s.status === 'down').length       || 0;

  // Avg response time across all servers
  const avgResp = metrics.servers?.length
    ? Math.round(metrics.servers.reduce((sum, s) => sum + (s.responseTime || 0), 0) / metrics.servers.length)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        icon={Zap}
        label="Req / Second"
        value={metrics.isRunning ? metrics.requestsPerSecond : 0}
        sub={metrics.isRunning ? 'live' : 'simulation stopped'}
        color="#3b82f6"
        glow={metrics.isRunning}
      />
      <MetricCard
        icon={Activity}
        label="Total Requests"
        value={metrics.totalRequests?.toLocaleString()}
        sub="this session"
        color="#6366f1"
      />
      <MetricCard
        icon={Server}
        label="Servers"
        value={`${healthyCount}H · ${overloadCount}O · ${downCount}D`}
        sub={`${metrics.servers?.length} total`}
        color={overloadCount > 0 ? '#f59e0b' : downCount > 0 ? '#ef4444' : '#10b981'}
        glow={overloadCount > 0 || downCount > 0}
      />
      <MetricCard
        icon={Clock}
        label="Avg Resp. Time"
        value={metrics.isRunning ? `${avgResp}ms` : '—'}
        sub="all servers"
        color="#8b5cf6"
      />
    </div>
  );
}
