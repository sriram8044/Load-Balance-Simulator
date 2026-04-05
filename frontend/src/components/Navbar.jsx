import { Link, useLocation } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext.jsx';
import { Activity, BarChart3, Cloud, Wifi, WifiOff, Zap } from 'lucide-react';

export default function Navbar() {
  const { connected, metrics } = useSimulation();
  const location = useLocation();
  const isRunning = metrics?.isRunning;

  const navLinks = [
    { to: '/',               label: 'Dashboard',      icon: Activity },
    { to: '/comparison',     label: 'Comparison',     icon: BarChart3 },
    { to: '/infrastructure', label: 'Infrastructure', icon: Cloud },
  ];

  return (
    <nav className="navbar px-6 py-3">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Zap size={18} className="text-white" />
            </div>
            {isRunning && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-[#04080f]">
                <span className="absolute inset-0 rounded-full bg-green-400 pulse-ring" />
              </span>
            )}
          </div>
          <div>
            <span className="font-bold text-base text-white">LB Simulator</span>
            <div className="text-xs font-mono" style={{ color: '#64748b' }}>
              Strategy Comparison
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-white bg-white/10 border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4">
          {/* Live request counter */}
          {isRunning && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {metrics?.totalRequests?.toLocaleString()} reqs
            </div>
          )}

          {/* Algorithm badge */}
          {metrics?.algorithm && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
              {metrics.algorithm === 'roundRobin' && 'Round Robin'}
              {metrics.algorithm === 'leastConnections' && 'Least Conn.'}
              {metrics.algorithm === 'weightedRoundRobin' && 'Weighted RR'}
            </div>
          )}

          {/* WS connection status */}
          <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>
    </nav>
  );
}
