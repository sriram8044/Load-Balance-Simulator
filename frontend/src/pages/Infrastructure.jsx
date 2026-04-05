/**
 * Infrastructure.jsx — Real AWS Infrastructure Management Page
 *
 * Features:
 *  - Provision Panel: Launch 3 EC2 instances + ALB
 *  - Server Cards: Instance IDs, AZs, IPs, health status
 *  - ALB Panel: DNS name, listener info
 *  - Traffic Panel: RPS slider + Start/Stop
 *  - Teardown: "Destroy All" button
 */
import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket.js';
import {
  Server, Wifi, Play, Square, Trash2, RefreshCw, ExternalLink,
  AlertTriangle, CheckCircle, Clock, Zap, Activity, Globe,
  Cloud, Database
} from 'lucide-react';

const API = '/api';

async function apiCall(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ state, targetState }) {
  // Derive display from instance + target state
  const s = targetState === 'healthy' ? 'healthy'
    : targetState === 'unhealthy' ? 'unhealthy'
    : state === 'crashed' ? 'crashed'
    : state === 'overloaded' ? 'overloaded'
    : state === 'running' ? 'pending'
    : state === 'terminated' ? 'terminated'
    : 'starting';

  const config = {
    healthy:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Healthy',    pulse: true  },
    unhealthy:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Unhealthy',  pulse: false },
    crashed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.3)',    label: 'Crashed',    pulse: true },
    overloaded: { color: '#f59e0b', bg: 'rgba(245,158,11,0.2)',   label: 'Overloaded(Slow)', pulse: true },
    pending:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Pending',    pulse: true  },
    starting:   { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Starting',   pulse: true  },
    terminated: { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Terminated', pulse: false },
  }[s] || { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: s, pulse: false };

  return (
    <span style={{
      background: config.bg,
      color: config.color,
      border: `1px solid ${config.color}30`,
      padding: '2px 8px',
      borderRadius: '99px',
      fontSize: '11px',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: config.color,
        animation: config.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
      }} />
      {config.label}
    </span>
  );
}

function ServerInstanceCard({ server, onRemove, onSlow, onCrash, onRecover, loading }) {
  const isCrashed = server.status === 'crashed' || server.status === 'down';
  const isSlow = server.status === 'overloaded';

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: `1px solid ${isCrashed ? 'rgba(239,68,68,0.4)' : isSlow ? 'rgba(245,158,11,0.4)' : 'var(--card-border)'}`,
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      boxShadow: isCrashed ? '0 0 15px rgba(239,68,68,0.1)' : isSlow ? '0 0 15px rgba(245,158,11,0.1)' : 'none'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Server size={16} color="#6366f1" />
          </div>
          <div style={{ maxWidth: '120px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</div>
            <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
              {server.id}
            </div>
          </div>
        </div>
        <StatusBadge state={server.state || server.status} targetState={server.targetState} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
        {[
          { label: 'IP', value: server.publicIp || '—' },
          { label: 'AZ', value: server.az },
          { label: 'EC2 State', value: server.state },
          { label: 'ALB Health', value: server.targetState || 'initial' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
        {isCrashed ? (
          <button
            onClick={() => onRecover(server.id)}
            disabled={loading}
            style={{ flex: 1, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />} Recover
          </button>
        ) : (
          <>
            <button
              onClick={() => isSlow ? onRecover(server.id) : onSlow(server.id)}
              disabled={loading}
              style={{ flex: 1, background: isSlow ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${isSlow ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 8, padding: '8px', color: isSlow ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <Clock size={14} /> {isSlow ? 'Normalize' : 'Slow Down'}
            </button>
            {!isSlow && (
              <button
                onClick={() => onCrash(server.id)}
                disabled={loading}
                title="Manually Crash Instance"
                style={{ width: 36, flexShrink: 0, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 0, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              </button>
            )}
            <button
              onClick={() => onRemove(server.id)}
              disabled={loading}
              title="Terminate Instance"
              style={{ width: 36, flexShrink: 0, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 0, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = '#94a3b8', icon: Icon }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 10,
      padding: '12px 14px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={12} color={color} />}
        <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value ?? '—'}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Infrastructure() {
  useSocket(); // keep WS connection alive

  const [infraStatus, setInfraStatus] = useState({
    provisioned: false, provisioning: false, destroying: false,
    albDns: null, instanceIds: [], lastError: null,
  });
  const [realMetrics, setRealMetrics] = useState(null);
  const [rps, setRps] = useState(5);
  const [algorithm, setAlgorithm] = useState('roundRobin');
  const [actionLoading, setActionLoading] = useState(false);
  const [serverActionLoading, setServerActionLoading] = useState({}); // { [id]: boolean }
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const [log, setLog] = useState([]);

  // Fetch infra status on mount and every 5s
  const fetchStatus = useCallback(async () => {
    try {
      const status = await apiCall('/infra-status');
      const metrics = await apiCall('/real-metrics');
      if (status) setInfraStatus(status);
      if (metrics) setRealMetrics(metrics);
    } catch (e) {
      console.warn('Polling failed:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const addLog = (msg) => setLog(prev => [
    { msg, time: new Date().toLocaleTimeString() },
    ...prev.slice(0, 19),
  ]);

  const handleProvision = async () => {
    setActionLoading(true);
    addLog('⏳ Provisioning EC2 instances and ALB (3 servers)...');
    try {
      const res = await apiCall('/provision', 'POST', { count: 3 });
      if (res.success) {
        addLog('✅ Provision started — waiting for nodes to initialize...');
      } else {
        addLog(`❌ Provision failed: ${res.message}`);
        setActionLoading(false);
      }
    } catch (e) {
      setActionLoading(false);
      addLog(`❌ ${e.message}`);
    }
  };

  const handleAddServer = async () => {
    if (infraStatus.instanceIds.length >= 5) {
      addLog('⚠️ Maximum limit of 5 real servers reached.');
      return;
    }
    setActionLoading(true);
    addLog('⏳ Launching one extra server...');
    try {
      const res = await apiCall('/real-add-server', 'POST');
      if (res.success) {
        addLog(`✅ ${res.message || 'Server provision initiated...'}`);
        fetchStatus();
      } else {
        addLog(`❌ Add failed: ${res.message}`);
      }
    } catch (e) {
      addLog(`❌ ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveServer = async (id) => {
    if (infraStatus.instanceIds.length <= 1) {
      addLog('⚠️ Cannot remove the last server.');
      return;
    }
    setServerActionLoading(prev => ({ ...prev, [id]: true }));
    addLog(`⏳ Terminating server ${id}...`);
    try {
      const res = await apiCall('/real-remove-server', 'POST', { instanceId: id });
      if (res.success) {
        addLog(`✅ Server ${id} terminated.`);
        fetchStatus();
      } else {
        addLog(`❌ Remove failed: ${res.message}`);
      }
    } catch (e) {
      addLog(`❌ ${e.message}`);
    } finally {
      setServerActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSlowServer = async (id) => {
    setServerActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiCall('/real-slow-server', 'POST', { instanceId: id });
    } catch (e) {
      addLog(`❌ Slowing server failed: ${e.message}`);
    } finally {
      setServerActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCrashServer = async (id) => {
    setServerActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiCall('/real-crash-server', 'POST', { instanceId: id });
    } catch (e) {
      addLog(`❌ Crashing server failed: ${e.message}`);
    } finally {
      setServerActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleRecoverServer = async (id) => {
    setServerActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiCall('/real-recover-server', 'POST', { instanceId: id });
    } catch (e) {
      addLog(`❌ Recovering server failed: ${e.message}`);
    } finally {
      setServerActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDestroy = async () => {
    if (!confirmDestroy) { setConfirmDestroy(true); return; }
    setConfirmDestroy(false);
    setActionLoading(true);
    addLog('🗑️ Destroying all infrastructure...');
    try {
      const res = await apiCall('/destroy', 'POST');
      if (res.success) {
        addLog('✅ All resources destroyed. Billing stopped.');
        fetchStatus();
      } else {
        addLog(`❌ ${res.message}`);
      }
    } catch (e) {
      addLog(`❌ ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEmergencyDestroy = async () => {
    if (!confirmEmergency) { setConfirmEmergency(true); return; }
    setConfirmEmergency(false);
    setActionLoading(true);
    addLog('🚨 EMERGENCY STOP — destroying all AWS resources...');
    try {
      const res = await apiCall('/destroy', 'POST');
      if (res.success) {
        addLog('✅ Emergency stop complete. All EC2 + ALB resources terminated.');
      } else {
        addLog(`⚠️ Backend says: ${res.message}`);
      }
      fetchStatus();
    } catch (e) {
      addLog(`❌ ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartTraffic = async () => {
    setActionLoading(true);
    addLog(`🚦 Starting ${rps} RPS real traffic...`);
    try {
      const res = await apiCall('/real-start', 'POST', { requestRate: rps, algorithm });
      if (res.success) {
        addLog(`✅ Traffic started (session ${res.sessionId?.slice(0, 8)}...)`);
        fetchStatus();
      } else {
        addLog(`❌ ${res.message}`);
      }
    } catch (e) {
      addLog(`❌ ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopTraffic = async () => {
    setActionLoading(true);
    addLog('⏹️ Stopping traffic...');
    try {
      await apiCall('/real-stop', 'POST');
      addLog('✅ Traffic stopped. Session logged to DynamoDB.');
      fetchStatus();
    } catch (e) {
      addLog(`❌ ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetRate = async (newRate) => {
    setRps(newRate);
    if (realMetrics?.isRunning) {
      await apiCall('/real-set-rate', 'POST', { rate: newRate });
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const { provisioned, provisioning, destroying, albDns, instanceIds, lastError } = infraStatus;
  const traffic = realMetrics;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5 animate-fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cloud size={22} className="gradient-text" style={{ color: undefined }} />
            <span className="gradient-text">Real AWS Infrastructure</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#475569' }}>
            Provision real EC2 instances + Application Load Balancer and send live traffic
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={fetchStatus}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <div style={{
            padding: '6px 12px',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 600,
            background: provisioned
              ? 'rgba(16,185,129,0.1)'
              : provisioning
              ? 'rgba(245,158,11,0.1)'
              : 'rgba(100,116,139,0.1)',
            color: provisioned ? '#10b981' : provisioning ? '#f59e0b' : '#64748b',
            border: `1px solid ${provisioned ? '#10b98130' : provisioning ? '#f59e0b30' : '#64748b30'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: provisioned ? '#10b981' : provisioning ? '#f59e0b' : '#64748b',
              animation: (provisioned || provisioning) ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
            {provisioning ? 'Provisioning...' : destroying ? 'Destroying...' : provisioned ? 'Infrastructure Live' : 'Not Provisioned'}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {lastError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          color: '#ef4444',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <AlertTriangle size={15} />
          {lastError}
        </div>
      )}

      {/* Emergency Stop Panel */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(220,38,38,0.03))',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Trash2 size={16} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', marginBottom: 3 }}>
              Emergency Stop — Terminate All AWS Resources
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              Destroys all EC2 instances + ALB immediately to stop billing.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
          <button
            onClick={handleEmergencyDestroy}
            disabled={actionLoading}
            className={`btn-danger ${confirmEmergency ? 'confirm' : ''}`}
            style={{
              background: confirmEmergency ? '#ef4444' : 'rgba(239,68,68,0.15)',
              border: `2px solid ${confirmEmergency ? '#ef4444' : 'rgba(239,68,68,0.4)'}`,
              borderRadius: 10,
              padding: '10px 20px',
              color: confirmEmergency ? 'white' : '#ef4444',
              fontWeight: 700,
              fontSize: 13,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onBlur={() => setConfirmEmergency(false)}
          >
            <Trash2 size={14} />
            {confirmEmergency ? '⚠️ Click again to CONFIRM' : '🚨 Emergency Stop'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Provision / Server Panel */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 14, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Server size={14} color="#6366f1" />
                  AWS Infrastructure ({instanceIds.length}/5)
                </h2>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {provisioned ? 'Live AWS resources' : 'No servers provisioned'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {provisioned && (
                  <button
                    onClick={handleAddServer}
                    disabled={actionLoading || instanceIds.length >= 5}
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: 8,
                      padding: '8px 14px',
                      color: '#6366f1',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: (actionLoading || instanceIds.length >= 5) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <RefreshCw size={13} className={actionLoading ? 'animate-spin' : ''} />
                    Add Server
                  </button>
                )}
                {!provisioned ? (
                  <button
                    onClick={handleProvision}
                    disabled={actionLoading || provisioning}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 16px',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: (actionLoading || provisioning) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Cloud size={13} />
                    Launch Real Servers
                  </button>
                ) : (
                  <button
                    onClick={handleDestroy}
                    disabled={actionLoading || destroying}
                    style={{
                      background: confirmDestroy ? '#ef4444' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${confirmDestroy ? '#ef4444' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: 8,
                      padding: '8px 16px',
                      color: confirmDestroy ? 'white' : '#ef4444',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: actionLoading || destroying ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s',
                    }}
                    onBlur={() => setConfirmDestroy(false)}
                  >
                    <Trash2 size={13} />
                    {confirmDestroy ? 'Click to CONFIRM' : 'Destroy All'}
                  </button>
                )}
              </div>
            </div>

            {/* ALB Info */}
            {albDns && (
              <div style={{
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 2 }}>🔗 ALB Endpoint</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>http://{albDns}</div>
                </div>
                <a href={`http://${albDns}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#10b981' }}>
                  <ExternalLink size={12} /> Open
                </a>
              </div>
            )}

            {/* Server cards */}
            {instanceIds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 13 }}>
                No active servers.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {(traffic?.servers || instanceIds.map(id => ({ id, name: id, state: 'pending', targetState: 'initial', az: '—' }))).map(server => (
                  <ServerInstanceCard 
                    key={server.id} 
                    server={server} 
                    onRemove={handleRemoveServer}
                    onSlow={handleSlowServer}
                    onCrash={handleCrashServer}
                    onRecover={handleRecoverServer}
                    loading={serverActionLoading[server.id]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Traffic Stats */}
          {traffic && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <StatBox label="Requests" value={traffic.totalRequests} color="#6366f1" icon={Zap} />
                <StatBox label="Success" value={traffic.totalSucceeded} color="#10b981" icon={CheckCircle} />
                <StatBox label="Failed" value={traffic.totalFailed} color="#ef4444" icon={AlertTriangle} />
                <StatBox label="Rate" value={`${traffic.errorRate}%`} color="#f59e0b" icon={Activity} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
                <StatBox label="Avg Latency" value={`${traffic.avgResponseTimeMs}ms`} color="#3b82f6" icon={Clock} />
                <StatBox label="Current Load" value={`${traffic.requestsPerSecond} RPS`} color="#8b5cf6" icon={Wifi} />
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 className="font-bold text-white mb-4">Traffic Control</h3>
            
            {/* Algorithm Selection */}
            <div style={{ marginBottom: 20 }}>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">AWS Routing Algorithm</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'roundRobin', label: 'Round Robin' },
                  { id: 'leastConnections', label: 'Least Connections' }
                ].map(algo => (
                  <button
                    key={algo.id}
                    onClick={() => setAlgorithm(algo.id)}
                    disabled={!provisioned || traffic?.isRunning}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      background: algorithm === algo.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                      color: algorithm === algo.id ? '#818cf8' : '#94a3b8',
                      border: `1px solid ${algorithm === algo.id ? 'rgba(99,102,241,0.5)' : 'transparent'}`,
                      cursor: (!provisioned || traffic?.isRunning) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {algo.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">Target RPS</span>
                <span className="text-white font-bold">{rps}</span>
              </div>
              <input type="range" min="1" max="50" value={rps} onChange={e => handleSetRate(e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              <button 
                onClick={() => handleSetRate(50)}
                disabled={!provisioned || !traffic?.isRunning}
                style={{
                  marginTop: 12, width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  padding: '8px', borderRadius: 8, color: '#ef4444', fontSize: 13, fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: (!provisioned || !traffic?.isRunning) ? 'not-allowed' : 'pointer',
                  transition: '0.2s'
                }}
              >
                🔥 Spike Traffic (50 RPS)
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={handleStartTraffic} disabled={!provisioned || traffic?.isRunning} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${!provisioned || traffic?.isRunning ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg'}`}>
                <Play size={14} /> Start Real Traffic
              </button>
              <button onClick={handleStopTraffic} disabled={!traffic?.isRunning} className={`w-full py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${!traffic?.isRunning ? 'bg-slate-800 text-slate-500' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                <Square size={14} /> Stop Traffic
              </button>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Activity Log</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {log.map((e, i) => (
                <div key={i} className="flex gap-2 text-[10px]">
                  <span className="text-slate-600 shrink-0">{e.time}</span>
                  <span className={`${e.msg.includes('✅') ? 'text-green-400' : e.msg.includes('❌') ? 'text-red-400' : 'text-slate-400'}`}>{e.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
