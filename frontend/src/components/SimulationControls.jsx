import { useSimulation } from '../context/SimulationContext.jsx';
import { Play, Square, Zap, AlertTriangle, Plus, Minus, RotateCcw } from 'lucide-react';

export default function SimulationControls() {
  const {
    metrics, localRate, loading,
    startSimulation, stopSimulation, setRate,
    triggerFailure, addServer, removeServer, resetSimulation,
  } = useSimulation();

  const isRunning = metrics?.isRunning;
  const serverCount = metrics?.servers?.length || 0;

  return (
    <div className="glass-card p-4 space-y-5">
      <h3 className="font-semibold text-sm text-white">Simulation Controls</h3>

      {/* Start / Stop */}
      <div className="flex gap-2">
        <button
          onClick={isRunning ? stopSimulation : startSimulation}
          disabled={loading}
          className={isRunning ? 'btn-danger flex-1 justify-center' : 'btn-primary flex-1 justify-center'}
        >
          {isRunning
            ? <><Square size={14} /> Stop Simulation</>
            : <><Play size={14} /> Start Simulation</>
          }
        </button>
        <button onClick={resetSimulation} className="btn-ghost px-3" title="Reset everything">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Request rate slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
            Request Rate
          </label>
          <span className="font-mono font-bold text-sm" style={{ color: '#3b82f6' }}>
            {localRate} <span style={{ color: '#64748b', fontSize: '11px' }}>req/s</span>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={localRate}
          onChange={e => setRate(Number(e.target.value))}
        />
        <div className="flex justify-between text-xs" style={{ color: '#475569' }}>
          <span>1 req/s</span>
          <span className="font-medium" style={{ color: localRate > 35 ? '#f59e0b' : '#64748b' }}>
            {localRate > 35 ? '⚠ High traffic' : localRate > 20 ? 'Medium traffic' : 'Low traffic'}
          </span>
          <span>50 req/s</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

      {/* Failure simulation */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
          Chaos Engineering
        </div>
        <button
          onClick={triggerFailure}
          className="btn-ghost w-full justify-center gap-2 text-sm"
          style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
        >
          <AlertTriangle size={13} />
          Trigger Random Failure
        </button>
      </div>

      {/* Auto-scaling */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
            Auto-Scaling
          </div>
          <span className="font-mono text-xs" style={{ color: '#94a3b8' }}>{serverCount} / 12 servers</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addServer}
            disabled={serverCount >= 12}
            className="btn-ghost flex-1 justify-center text-xs py-2"
            style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
          >
            <Plus size={12} /> Add Server
          </button>
          <button
            onClick={removeServer}
            disabled={serverCount <= 1}
            className="btn-ghost flex-1 justify-center text-xs py-2"
            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <Minus size={12} /> Remove
          </button>
        </div>
      </div>

      {/* Live status strip */}
      {isRunning && (
        <div className="rounded-xl px-3 py-2 flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs" style={{ color: '#34d399' }}>
            Simulation running · {metrics?.totalRequests?.toLocaleString()} total requests
          </span>
        </div>
      )}
    </div>
  );
}
