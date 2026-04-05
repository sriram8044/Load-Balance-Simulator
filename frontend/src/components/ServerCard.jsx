import { Cpu, Wifi, Clock, TrendingUp, Activity, Server } from 'lucide-react';

const STATUS_CONFIG = {
  healthy:   { label: 'Healthy',    color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)'  },
  overloaded:{ label: 'Overloaded', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
  down:      { label: 'Down',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)'   },
};

function ProgressBar({ value, status }) {
  const cls = status === 'down' ? 'down' : status === 'overloaded' ? 'overloaded' : 'healthy';
  return (
    <div className="progress-bar-track h-1.5 w-full">
      <div
        className={`progress-bar-fill ${cls}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, unit = '', mono = true }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-xs" style={{ color: '#64748b' }}>
        <Icon size={10} />
        {label}
      </div>
      <span className={`text-sm font-semibold text-slate-200 ${mono ? 'font-mono' : ''}`}>
        {value}<span className="text-xs font-normal ml-0.5" style={{ color: '#64748b' }}>{unit}</span>
      </span>
    </div>
  );
}

export default function ServerCard({ server, onRecover }) {
  if (!server) return null;
  const sc = STATUS_CONFIG[server.status] || STATUS_CONFIG.healthy;
  const loadPct = server.loadPercent ?? 0;

  return (
    <div
      className="glass-card p-4 flex flex-col gap-3 transition-all duration-300 animate-fade-in"
      style={{
        borderColor: server.status !== 'healthy' ? sc.border : undefined,
        boxShadow: server.status === 'overloaded'
          ? '0 0 20px rgba(245,158,11,0.1)'
          : server.status === 'down'
          ? '0 0 20px rgba(239,68,68,0.1)'
          : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${sc.bg}`, border: `1px solid ${sc.border}` }}>
            <Server size={13} color={sc.color} />
          </div>
          <div>
            <div className="font-semibold text-sm text-white">{server.name}</div>
            <div className="text-xs font-mono" style={{ color: '#475569' }}>{server.id}</div>
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}
        >
          {sc.label}
        </span>
      </div>

      {/* Load bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span style={{ color: '#64748b' }}>Load</span>
          <span className="font-mono font-semibold" style={{ color: sc.color }}>{loadPct}%</span>
        </div>
        <ProgressBar value={loadPct} status={server.status} />
        <div className="text-xs font-mono" style={{ color: '#475569' }}>
          {server.activeConnections} / {server.maxCapacity} connections
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
        <Stat icon={Cpu}      label="CPU"       value={server.cpuUsage}     unit="%" />
        <Stat icon={Activity} label="Processed" value={server.totalProcessed?.toLocaleString()} />
        <Stat icon={Clock}    label="Resp. time" value={server.responseTime}  unit="ms" />
        <Stat icon={TrendingUp} label="Weight"  value={server.weight} mono={false} />
      </div>

      {/* Weight bar */}
      <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

      {/* CPU bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span style={{ color: '#64748b' }} className="flex items-center gap-1"><Cpu size={9} /> CPU Usage</span>
          <span className="font-mono font-semibold text-slate-300">{server.cpuUsage}%</span>
        </div>
        <div className="progress-bar-track h-1">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${server.cpuUsage}%`,
              background: server.cpuUsage > 85
                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                : server.cpuUsage > 65
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            }}
          />
        </div>
      </div>

      {/* Recover button (only for down servers) */}
      {server.status === 'down' && (
        <button
          onClick={() => onRecover?.(server.id)}
          className="btn-ghost text-xs py-1.5 justify-center"
          style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
        >
          ↻ Recover Server
        </button>
      )}
    </div>
  );
}
