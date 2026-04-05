import { AlertTriangle, X } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext.jsx';

export default function AlertBanner() {
  const { metrics, recoverAll } = useSimulation();
  const alert = metrics?.overloadAlert;
  if (!alert) return null;

  const downCount = metrics?.servers?.filter(s => s.status === 'down').length || 0;
  const overloadedCount = metrics?.servers?.filter(s => s.status === 'overloaded').length || 0;

  return (
    <div className="animate-slide-down mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
      }}>
      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(245,158,11,0.15)' }}>
        <AlertTriangle size={15} color="#f59e0b" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm" style={{ color: '#f59e0b' }}>
          ⚠ Overload Detected
        </span>
        <span className="ml-2 text-sm" style={{ color: '#94a3b8' }}>
          {overloadedCount > 0 && `${overloadedCount} server(s) overloaded`}
          {downCount > 0 && overloadedCount > 0 && ' · '}
          {downCount > 0 && `${downCount} server(s) down`}
          {' — load balancer re-routing traffic'}
        </span>
      </div>
      {downCount > 0 && (
        <button onClick={recoverAll} className="btn-ghost text-xs py-1.5 px-3 flex-shrink-0">
          Recover All
        </button>
      )}
    </div>
  );
}
