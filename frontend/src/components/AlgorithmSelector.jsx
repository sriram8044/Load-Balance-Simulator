import { useSimulation } from '../context/SimulationContext.jsx';

const ALGORITHMS = [
  {
    id: 'roundRobin',
    label: 'Round Robin',
    shortLabel: 'RR',
    desc: 'Distributes requests sequentially across all healthy servers. Simple and fair.',
    icon: '↻',
    color: '#3b82f6',
  },
  {
    id: 'leastConnections',
    label: 'Least Connections',
    shortLabel: 'LC',
    desc: 'Routes to the server with fewest active connections. Adapts to varying load.',
    icon: '⟂',
    color: '#10b981',
  },
];

export default function AlgorithmSelector() {
  const { metrics, localAlgorithm, setAlgorithm } = useSimulation();
  const activeAlgo = metrics?.algorithm || localAlgorithm;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-white">Load Balancing Algorithm</h3>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
          Switch anytime
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {ALGORITHMS.map(algo => {
          const active = activeAlgo === algo.id;
          return (
            <button
              key={algo.id}
              onClick={() => setAlgorithm(algo.id)}
              className="flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200"
              style={{
                background: active
                  ? `rgba(${algo.color === '#3b82f6' ? '59,130,246' : algo.color === '#10b981' ? '16,185,129' : '139,92,246'},0.1)`
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active
                  ? `${algo.color}40`
                  : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                style={{
                  background: active ? `${algo.color}20` : 'rgba(255,255,255,0.05)',
                  color: active ? algo.color : '#475569',
                }}>
                {algo.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: active ? algo.color : '#94a3b8' }}>
                    {algo.label}
                  </span>
                  {active && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{ background: `${algo.color}20`, color: algo.color }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#475569' }}>
                  {algo.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
