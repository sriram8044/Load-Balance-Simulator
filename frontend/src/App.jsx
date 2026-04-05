import { Routes, Route } from 'react-router-dom';
import { SimulationProvider } from './context/SimulationContext.jsx';
import Navbar from './components/Navbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Comparison from './pages/Comparison.jsx';
import Infrastructure from './pages/Infrastructure.jsx';

export default function App() {
  return (
    <SimulationProvider>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        <Navbar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/comparison" element={<Comparison />} />
            <Route path="/infrastructure" element={<Infrastructure />} />
          </Routes>
        </main>
      </div>
    </SimulationProvider>
  );
}

