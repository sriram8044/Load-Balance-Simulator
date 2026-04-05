/**
 * Dashboard Page — Main simulation view
 * Layout:
 *  - Alert banner (conditional)
 *  - 4 metric cards
 *  - Left col: Server grid
 *  - Right col: Algorithm selector + Controls + Charts (stacked)
 */
import AlertBanner from '../components/AlertBanner.jsx';
import MetricsCards from '../components/MetricsCards.jsx';
import ServerGrid from '../components/ServerGrid.jsx';
import AlgorithmSelector from '../components/AlgorithmSelector.jsx';
import SimulationControls from '../components/SimulationControls.jsx';
import LiveBarChart from '../components/LiveBarChart.jsx';
import TrafficLineChart from '../components/TrafficLineChart.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import { useSimulation } from '../context/SimulationContext.jsx';
import { Layers } from 'lucide-react';

export default function Dashboard() {
  const { connected } = useSimulation();

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers size={22} className="gradient-text" style={{ color: undefined }} />
            <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#475569' }}>
            Real-time load balancer simulation with live WebSocket updates
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
          connected
            ? 'text-green-400'
            : 'text-red-400'
        }`}
          style={{
            background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: connected ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)',
          }}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? 'WebSocket Live' : 'Connecting...'}
        </div>
      </div>

      {/* Alert banner (overload) */}
      <AlertBanner />

      {/* Metric cards row */}
      <MetricsCards />

      {/* Main 2-col layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left — Server grid */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-white">Virtual Servers</h2>
          </div>
          <ServerGrid />

          {/* Bar chart */}
          <LiveBarChart />
        </div>

        {/* Right — Controls + charts */}
        <div className="space-y-4">
          <AlgorithmSelector />
          <SimulationControls />
          <TrafficLineChart />
          <DistributionPieChart />
        </div>
      </div>
    </div>
  );
}
