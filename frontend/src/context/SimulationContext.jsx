/**
 * Simulation Context
 * Provides shared simulation state (metrics, controls) to all components.
 * Avoids prop-drilling across the component tree.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';

const SimulationContext = createContext(null);

const API = '/api';

async function apiPost(path, body = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function SimulationProvider({ children }) {
  const { connected, metrics } = useSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localRate, setLocalRate] = useState(5);
  const [localAlgorithm, setLocalAlgorithm] = useState('roundRobin');

  const handleError = (err) => {
    setError(err?.message || 'Unknown error');
    setTimeout(() => setError(null), 4000);
  };

  const startSimulation = useCallback(async () => {
    setLoading(true);
    try {
      await apiPost('/start-simulation', {
        requestRate: localRate,
        algorithm: localAlgorithm,
      });
    } catch (e) { handleError(e); }
    finally { setLoading(false); }
  }, [localRate, localAlgorithm]);

  const stopSimulation = useCallback(async () => {
    setLoading(true);
    try { await apiPost('/stop-simulation'); }
    catch (e) { handleError(e); }
    finally { setLoading(false); }
  }, []);

  const setAlgorithm = useCallback(async (algorithm) => {
    setLocalAlgorithm(algorithm);
    try { await apiPost('/set-algorithm', { algorithm }); }
    catch (e) { handleError(e); }
  }, []);

  const setRate = useCallback(async (rate) => {
    setLocalRate(rate);
    try { await apiPost('/set-rate', { rate }); }
    catch (e) { handleError(e); }
  }, []);

  const triggerFailure = useCallback(async () => {
    try { return await apiPost('/trigger-failure'); }
    catch (e) { handleError(e); }
  }, []);

  const recoverServer = useCallback(async (serverId) => {
    try { await apiPost('/recover-server', { serverId }); }
    catch (e) { handleError(e); }
  }, []);

  const recoverAll = useCallback(async () => {
    try { await apiPost('/recover-all'); }
    catch (e) { handleError(e); }
  }, []);

  const addServer = useCallback(async () => {
    try { return await apiPost('/add-server'); }
    catch (e) { handleError(e); }
  }, []);

  const removeServer = useCallback(async () => {
    try { return await apiPost('/remove-server'); }
    catch (e) { handleError(e); }
  }, []);

  const resetSimulation = useCallback(async () => {
    setLoading(true);
    try {
      await apiPost('/reset');
      setLocalRate(5);
      setLocalAlgorithm('roundRobin');
    } catch (e) { handleError(e); }
    finally { setLoading(false); }
  }, []);

  return (
    <SimulationContext.Provider value={{
      // Socket state
      connected,
      metrics,

      // Local controlled state
      localRate,
      localAlgorithm,
      loading,
      error,

      // Actions
      startSimulation,
      stopSimulation,
      setAlgorithm,
      setRate,
      triggerFailure,
      recoverServer,
      recoverAll,
      addServer,
      removeServer,
      resetSimulation,
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider');
  return ctx;
}
