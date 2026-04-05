import ServerCard from './ServerCard.jsx';
import { useSimulation } from '../context/SimulationContext.jsx';

export default function ServerGrid() {
  const { metrics, recoverServer } = useSimulation();
  const servers = metrics?.servers || [];

  if (!servers.length) {
    return (
      <div className="glass-card flex items-center justify-center h-40 text-sm" style={{ color: '#475569' }}>
        No servers available
      </div>
    );
  }

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
    >
      {servers.map(server => (
        <ServerCard
          key={server.id}
          server={server}
          onRecover={recoverServer}
        />
      ))}
    </div>
  );
}
