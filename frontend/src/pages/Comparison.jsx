/**
 * Comparison Page
 * Shows side-by-side algorithm performance metrics.
 * Includes AWS cloud logs from DynamoDB session history.
 */
import { useEffect, useRef, useState } from 'react';
import { useSimulation } from '../context/SimulationContext.jsx';
import ComparisonTable from '../components/ComparisonTable.jsx';
import LiveBarChart from '../components/LiveBarChart.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import { BarChart3, Cloud, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const ALGO_LABELS = {
  roundRobin:         { label: 'Round Robin',       color: '#3b82f6', icon: '↻' },
  leastConnections:   { label: 'Least Connections', color: '#10b981', icon: '⟂' },
};

function StatHighlightCard({ algoKey, stats }) {
  const algo = ALGO_LABELS[algoKey] || { label: algoKey, color: '#94a3b8', icon: '?' };
  const s = stats[algoKey] || {};
  const fairness = s.totalRequests > 0
    ? Math.max(0, Math.round((1 - s.overloadEvents / s.totalRequests) * 100))
    : null;

  return (
    <div className="glass-card p-5 space-y-4 flex flex-col">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: `${algo.color}20`, border: `1px solid ${algo.color}30`, color: algo.color }}>
          {algo.icon}
        </div>
        <div>
          <div className="font-bold text-white text-sm">{algo.label}</div>
          <div className="text-xs" style={{ color: '#64748b' }}>Performance snapshot</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Reqs', value: s.totalRequests?.toLocaleString() || '0' },
          { label: 'Avg Resp.', value: s.avgResponseTime ? `${s.avgResponseTime}ms` : '—' },
          { label: 'Overloads', value: s.overloadEvents || 0 },
          { label: 'Fairness', value: fairness !== null ? `${fairness}%` : '—' },
        ].map(item => (
          <div key={item.label}
            className="rounded-lg p-3 space-y-1"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs" style={{ color: '#64748b' }}>{item.label}</div>
            <div className="font-mono font-bold text-white">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Simple horizontal bar for total requests share */}
      {s.totalRequests > 0 && (
        <div>
          <div className="text-xs mb-1" style={{ color: '#64748b' }}>Request share</div>
          <div className="progress-bar-track h-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (s.totalRequests / Math.max(1, Object.values(stats).reduce((a, b) => a + b.totalRequests, 0))) * 100)}%`,
                background: algo.color,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CloudLogsPanel() {
  const [logs, setLogs] = useState([]);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const { metrics } = useSimulation();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cloud-logs');
      const data = await res.json();
      setCloudConnected(data.connected);
      setLogs(data.logs || []);
    } catch (e) {
      setCloudConnected(false);
    }
    setLoading(false);
  };

  // Fetch on mount
  useEffect(() => { fetchLogs(); }, []);

  // Auto-refresh when simulation stops (isRunning flips false → new SESSION_END was just written)
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && metrics?.isRunning === false) {
      // Small delay to let the backend finish writing the SESSION_END record
      setTimeout(fetchLogs, 1500);
    }
    wasRunning.current = metrics?.isRunning ?? false;
  }, [metrics?.isRunning]);

  // Poll every 15s while connected so logs stay fresh
  useEffect(() => {
    if (!cloudConnected) return;
    const id = setInterval(fetchLogs, 15000);
    return () => clearInterval(id);
  }, [cloudConnected]);

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={16} color="#3b82f6" />
          <h3 className="font-semibold text-sm text-white">AWS DynamoDB — Session Logs</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${cloudConnected ? 'text-green-400' : 'text-red-400'}`}>
            {cloudConnected
              ? <><CheckCircle size={12} /> Connected (us-east-1)</>
              : <><XCircle size={12} /> Not connected</>
            }
          </div>
          <button onClick={fetchLogs} disabled={loading} className="btn-ghost text-xs py-1 px-2">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-2" style={{ color: '#475569' }}>
          <Cloud size={32} opacity={0.3} />
          <div className="text-sm">
            {cloudConnected
              ? 'No session logs yet — run a simulation to log data'
              : 'DynamoDB not connected — check AWS credentials in .env'}
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {logs.map((log, i) => (
            <div key={i}
              className="flex items-start gap-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="font-mono text-xs mt-0.5 flex-shrink-0" style={{ color: '#475569' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <div className="flex-1">
                <span className="font-semibold" style={{ color: '#94a3b8' }}>
                  {ALGO_LABELS[log.algorithm]?.label || log.algorithm}
                </span>
                {' · '}
                <span style={{ color: '#64748b' }}>
                  {log.totalRequests?.toLocaleString() || 0} requests over this session
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Comparison() {
  const { metrics } = useSimulation();
  const [viewMode, setViewMode] = useState('virtual'); // 'virtual' | 'real'
  const [realStats, setRealStats] = useState(null);
  const [realMetrics, setRealMetrics] = useState(null);
  const [loadingReal, setLoadingReal] = useState(false);

  // Fetch realStats if in 'real' mode
  const fetchRealStats = async () => {
    setLoadingReal(true);
    try {
      const [statsRes, metricsRes] = await Promise.all([
        fetch('/api/real-algorithm-stats'),
        fetch('/api/real-metrics')
      ]);
      const statsData = await statsRes.json();
      const metricsData = await metricsRes.json();
      
      setRealStats(statsData.stats);
      setRealMetrics(metricsData);
    } catch (e) {
      console.warn('Failed to fetch real data:', e);
    } finally {
      setLoadingReal(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'real') {
      fetchRealStats();
      const id = setInterval(fetchRealStats, 1000);
      return () => clearInterval(id);
    }
  }, [viewMode]);

  const stats = viewMode === 'virtual' 
    ? (metrics?.algorithmStats || {
        roundRobin: { totalRequests: 0, avgResponseTime: 0, overloadEvents: 0 },
        leastConnections: { totalRequests: 0, avgResponseTime: 0, overloadEvents: 0 },
      })
    : (realStats || {
        roundRobin: { totalRequests: 0, avgResponseTime: 0, overloadEvents: 0 },
        leastConnections: { totalRequests: 0, avgResponseTime: 0, overloadEvents: 0 },
      });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <BarChart3 size={22} />
            Algorithm Comparison
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#475569' }}>
            Compare performance between Virtual Simulation and Real AWS Infrastructure
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setViewMode('virtual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'virtual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Virtual Simulation
          </button>
          <button
            onClick={() => setViewMode('real')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'real' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Real AWS Infrastructure
          </button>
        </div>
      </div>

      {/* 2 algo highlight cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(ALGO_LABELS).map(key => (
          <StatHighlightCard key={key} algoKey={key} stats={stats} />
        ))}
      </div>

      {/* Full comparison table (passing stats as prop to ensure it uses correct mode) */}
      <ComparisonTable customStats={stats} />

      {/* Charts + cloud logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-4">
          <LiveBarChart customServers={viewMode === 'real' ? realMetrics?.servers : undefined} />
          <CloudLogsPanel />
        </div>
        <div>
          <DistributionPieChart customServers={viewMode === 'real' ? realMetrics?.servers : undefined} />
        </div>
      </div>
    </div>
  );
}
