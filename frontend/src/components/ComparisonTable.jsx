import { useSimulation } from '../context/SimulationContext.jsx';
import { Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ALGO_LABELS = {
  roundRobin:          { label: 'Round Robin',       color: '#3b82f6', short: 'RR'  },
  leastConnections:    { label: 'Least Connections', color: '#10b981', short: 'LC'  },
};

function Trend({ value, field }) {
  if (!value || value === 0) return <Minus size={12} color="#475569" />;
  return value > 50 ? <TrendingUp size={12} color="#10b981" /> : <TrendingDown size={12} color="#f59e0b" />;
}

function fairnessScore(stats) {
  // Simple inverse of overload rate as fairness proxy
  if (!stats.totalRequests) return '—';
  const overloadRate = stats.overloadEvents / stats.totalRequests;
  const score = Math.max(0, Math.round((1 - overloadRate) * 100));
  return `${score}%`;
}

export default function ComparisonTable({ customStats }) {
  const { metrics } = useSimulation();
  const stats = customStats || metrics?.algorithmStats;
  const activeAlgo = metrics?.algorithm;

  if (!stats) return null;

  const exportCsv = () => {
    const header = 'Algorithm,Total Requests,Avg Response Time (ms),Overload Events,Fairness Score\n';
    const rows = Object.entries(stats).map(([key, s]) => {
      const label = ALGO_LABELS[key]?.label || key;
      return `${label},${s.totalRequests},${s.avgResponseTime},${s.overloadEvents},${fairnessScore(s)}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lb-comparison-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-3">
        <div>
          <h3 className="font-semibold text-sm text-white">Algorithm Performance Comparison</h3>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
            Metrics accumulate as you switch between algorithms
          </p>
        </div>
        <button onClick={exportCsv} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
          <Download size={12} />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Total Requests</th>
              <th>Avg Response Time</th>
              <th>Overload Events</th>
              <th>Fairness Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats).map(([key, s]) => {
              const algo = ALGO_LABELS[key] || { label: key, color: '#94a3b8', short: '?' };
              const isActive = activeAlgo === key;
              return (
                <tr key={key}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: algo.color }} />
                      <span className="font-semibold text-white">{algo.label}</span>
                      {isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${algo.color}20`, color: algo.color }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="font-mono font-semibold text-white">
                      {s.totalRequests.toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono" style={{ color: s.avgResponseTime > 3000 ? '#f59e0b' : '#e2e8f0' }}>
                      {s.avgResponseTime > 0 ? `${s.avgResponseTime} ms` : '—'}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono" style={{ color: s.overloadEvents > 0 ? '#f59e0b' : '#10b981' }}>
                      {s.overloadEvents}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono font-semibold" style={{ color: algo.color }}>
                      {fairnessScore(s)}
                    </span>
                  </td>
                  <td>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: isActive ? `${algo.color}20` : 'rgba(255,255,255,0.04)',
                        color: isActive ? algo.color : '#475569',
                        border: `1px solid ${isActive ? `${algo.color}40` : 'transparent'}`,
                      }}>
                      {isActive ? '● Active' : s.totalRequests > 0 ? 'Tested' : 'Not tested'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
