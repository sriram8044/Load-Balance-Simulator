/**
 * RealModeEngine.js — Real AWS Infrastructure Engine
 *
 * Mirrors the SimulationEngine API but uses:
 *  - Real EC2 instances (via ec2Manager)
 *  - Real ALB routing (via ec2Manager)
 *  - Real HTTP traffic (via trafficGenerator)
 *  - CloudWatch + target health for metrics
 *  - DynamoDB for logging (via dynamoClient)
 */
import { v4 as uuidv4 } from 'uuid';
import {
  provisionServers,
  waitForRunning,
  terminateServers,
  createALB,
  deleteALB,
  getInstanceStatuses,
  getTargetHealth,
  getALBMetrics,
} from '../aws/ec2Manager.js';
import { trafficGenerator } from '../aws/trafficGenerator.js';
import { logSessionEvent, logMetricsSnapshot } from '../aws/dynamoClient.js';

const METRICS_EMIT_INTERVAL = 2000;  // Poll real infra every 2s (ALB health is slow)
const DYNAMO_LOG_INTERVAL = 30000;

class RealModeEngine {
  constructor() {
    // Infrastructure state
    this.provisioned = false;
    this.provisioning = false;
    this.destroying = false;

    this.instanceIds = [];
    this.albArn = null;
    this.targetGroupArn = null;
    this.albDns = null;

    // Session
    this.sessionId = null;
    this.isRunning = false;
    this.algorithm = 'roundRobin'; // ALB doesn't really change algorithm, but we surface it

    // Latest polled data
    this.latestInstanceStatuses = [];
    this.latestTargetHealth = [];
    this.latestCwMetrics = { requestCount: 0, avgLatencyMs: 0 };
    
    // UI tracking for Slow/Crashed nodes
    this.instanceOverrides = {};

    // Per-algorithm comparison data for real mode
    this.algorithmStats = {
      roundRobin: { totalRequests: 0, totalResponseTime: 0, avgResponseTime: 0, overloadEvents: 0, sessions: 0 },
      leastConnections: { totalRequests: 0, totalResponseTime: 0, avgResponseTime: 0, overloadEvents: 0, sessions: 0 },
      weightedRoundRobin: { totalRequests: 0, totalResponseTime: 0, avgResponseTime: 0, overloadEvents: 0, sessions: 0 },
    };

    // Timers
    this._metricsInterval = null;
    this._dynamoInterval = null;

    // Callback set by Socket.io
    this._emitCallback = null;

    // Provision error
    this.lastError = null;
  }

  setEmitCallback(cb) {
    this._emitCallback = cb;
  }

  // ─── Provision ──────────────────────────────────────────────────────────────

  /**
   * Provision 3 EC2 instances + ALB
   */
  async provision() {
    if (this.provisioned || this.provisioning) {
      return { success: false, message: 'Already provisioned or provisioning in progress' };
    }

    this.provisioning = true;
    this.lastError = null;
    this._emit('infra-status', this.getStatus());

    try {
      console.log('\n🚀 [Real Mode] Provisioning EC2 instances...');
      const { provisionServers } = await import('../aws/ec2Manager.js');
      this.instanceIds = await provisionServers(3);

      console.log('⏳ [Real Mode] Waiting for instances to reach running state...');
      this._emit('infra-status', { ...this.getStatus(), provisioningStep: 'Waiting for EC2 to start...' });
      const { waitForRunning } = await import('../aws/ec2Manager.js');
      await waitForRunning(this.instanceIds);

      console.log('🔗 [Real Mode] Creating ALB...');
      const { createALB } = await import('../aws/ec2Manager.js');
      const { albArn, targetGroupArn, albDns } = await createALB(this.instanceIds);
      this.albArn = albArn;
      this.targetGroupArn = targetGroupArn;
      this.albDns = albDns;

      this.provisioned = true;
      this.provisioning = false;

      console.log(`\n✅ [Real Mode] Infrastructure ready!`);
      console.log(`   ALB: http://${albDns}`);
      console.log(`   Instances: ${this.instanceIds.join(', ')}\n`);

      // Start polling health
      this._startMetricsPolling();

      this._emit('infra-status', this.getStatus());
      return { success: true, albDns, instanceIds: this.instanceIds };
    } catch (err) {
      this.provisioning = false;
      this.lastError = err.message;
      console.error('❌ [Real Mode] Provision failed:', err.message);
      this._emit('infra-status', this.getStatus());
      return { success: false, message: err.message };
    }
  }

  async addServer() {
    if (!this.provisioned) return { success: false, message: 'Infra not provisioned' };
    if (this.instanceIds.length >= 5) return { success: false, message: 'Max 5 real servers allowed' };

    // Fire and forget so we don't block the API and cause a 504 timeout
    import('../aws/ec2Manager.js').then(({ addSingleInstance }) => {
      return addSingleInstance(this.targetGroupArn);
    }).then(id => {
      this.instanceIds.push(id);
      this._emit('infra-status', this.getStatus());
    }).catch(err => {
      console.error('Add server async failed:', err.message);
    });

    return { success: true, message: 'Server provisioning started' };
  }

  async removeServer(instanceId) {
    if (!this.instanceIds.includes(instanceId)) return { success: false, message: 'Instance not in pool' };

    import('../aws/ec2Manager.js').then(({ removeSingleInstance }) => {
      return removeSingleInstance(instanceId, this.targetGroupArn);
    }).then(() => {
      this.instanceIds = this.instanceIds.filter(id => id !== instanceId);
      this._emit('infra-status', this.getStatus());
    }).catch(err => {
      console.error('Remove server async failed:', err.message);
    });

    return { success: true, message: 'Server termination started' };
  }

  /**
   * Apply direct commands (slow/crash/recover) to an instance bypassing ALB
   */
  async applyInstanceCommand(id, command) {
    if (!this.instanceIds.includes(id)) return { success: false, message: 'Instance not found' };
    const instance = this.latestInstanceStatuses.find(i => i.id === id);
    if (!instance || !instance.publicIp) return { success: false, message: 'No public IP known yet' };
    
    try {
      const { sendNodeCommand } = await import('../aws/ec2Manager.js');
      console.log(`[Real Mode] Sending /${command} to ${id} (${instance.publicIp})`);
      const ok = await sendNodeCommand(instance.publicIp, command);
      if (ok) {
        if (command === 'recover') delete this.instanceOverrides[id];
        else this.instanceOverrides[id] = command;
        this._emit('infra-status', this.getStatus());
        return { success: true };
      }
      return { success: false, message: 'Node did not respond correctly' };
    } catch(e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Terminate all infrastructure
   */
  async destroy() {
    if (!this.provisioned && !this.instanceIds.length) {
      return { success: false, message: 'Nothing to destroy' };
    }

    this.destroying = true;
    this._stopMetricsPolling();
    this.stop();

    try {
      console.log('\n🗑️  [Real Mode] Destroying infrastructure...');
      const { deleteALB, terminateServers } = await import('../aws/ec2Manager.js');
      await deleteALB(this.albArn, this.targetGroupArn);
      await terminateServers(this.instanceIds);

      this.provisioned = false;
      this.destroying = false;
      this.instanceIds = [];
      this.albArn = null;
      this.targetGroupArn = null;
      this.albDns = null;
      this.latestInstanceStatuses = [];
      this.latestTargetHealth = [];

      console.log('✅ [Real Mode] All infrastructure destroyed.');
      this._emit('infra-status', this.getStatus());
      return { success: true };
    } catch (err) {
      this.destroying = false;
      console.error('❌ [Real Mode] Destroy failed:', err.message);
      return { success: false, message: err.message };
    }
  }

  // ─── Traffic ─────────────────────────────────────────────────────────────────

  /**
   * Start sending real traffic to the ALB
   */
  start(requestRate = 5, algorithm = 'roundRobin') {
    if (!this.provisioned) {
      return { success: false, message: 'Infrastructure not provisioned' };
    }
    if (this.isRunning) {
      return { success: false, message: 'Already running' };
    }

    // Apply the algorithm selection to the actual AWS ALB Target Group
    import('../aws/ec2Manager.js').then(({ setTargetGroupAlgorithm }) => {
      setTargetGroupAlgorithm(this.targetGroupArn, algorithm);
    }).catch(e => console.warn('Failed to load setTargetGroupAlgorithm module:', e));

    this.isRunning = true;
    this.algorithm = algorithm;
    this.sessionId = uuidv4();

    trafficGenerator.start(this.albDns, requestRate);

    logSessionEvent(this.sessionId, 'SESSION_START', {
      algorithm,
      requestRate,
      mode: 'real',
      albDns: this.albDns,
      instanceIds: this.instanceIds,
    });

    // Sessions count toward stats
    this.algorithmStats[this.algorithm].sessions++;

    // DynamoDB snapshots
    this._dynamoInterval = setInterval(() => {
      logMetricsSnapshot(this.sessionId, {
        algorithm: this.algorithm,
        ...trafficGenerator.getStats(),
        servers: this.latestTargetHealth.map(t => ({
          name: t.instanceId,
          status: t.state === 'healthy' ? 'healthy' : 'down',
        })),
      });
    }, DYNAMO_LOG_INTERVAL);

    this._emit('infra-status', this.getStatus());
    return { success: true, sessionId: this.sessionId };
  }

  /**
   * Stop traffic (but keep infrastructure)
   */
  stop() {
    if (!this.isRunning) return { success: false, message: 'Not running' };

    trafficGenerator.stop();
    this.isRunning = false;

    if (this._dynamoInterval) {
      clearInterval(this._dynamoInterval);
      this._dynamoInterval = null;
    }

    if (this.sessionId) {
      logSessionEvent(this.sessionId, 'SESSION_END', {
        algorithm: this.algorithm,
        mode: 'real',
        ...trafficGenerator.getStats(),
      });
      this.sessionId = null;
    }

    this._emit('infra-status', this.getStatus());
    return { success: true };
  }

  setRequestRate(rate) {
    trafficGenerator.setRps(rate);
    return { success: true, requestRate: rate };
  }

  // ─── Metrics polling ────────────────────────────────────────────────────────

  _startMetricsPolling() {
    this._metricsInterval = setInterval(async () => {
      await this._pollMetrics();
      this._emit('real-metrics', this.getMetrics());
    }, METRICS_EMIT_INTERVAL);
  }

  _stopMetricsPolling() {
    if (this._metricsInterval) {
      clearInterval(this._metricsInterval);
      this._metricsInterval = null;
    }
  }

  async _pollMetrics() {
    try {
      const { getInstanceStatuses, getTargetHealth, getALBMetrics } = await import('../aws/ec2Manager.js');
      const [instances, health, cw] = await Promise.all([
        getInstanceStatuses(this.instanceIds),
        getTargetHealth(this.targetGroupArn),
        getALBMetrics(this.albArn),
      ]);
      this.latestInstanceStatuses = instances;
      this.latestTargetHealth = health;
      this.latestCwMetrics = cw;

      // Accumulate algorithm stats while traffic is running
      if (this.isRunning) {
        const stats = this.algorithmStats[this.algorithm];
        const newReqs = cw.requestCount; // This is a rough estimation from CloudWatch
        // Actually, better to use trafficGenerator stats as they are live-tracked
        const currentTraffic = trafficGenerator.getStats();
        
        stats.totalRequests = currentTraffic.totalRequests;
        if (currentTraffic.avgResponseTimeMs > 0) {
          stats.totalResponseTime += currentTraffic.avgResponseTimeMs;
          // Weighted average or just average across the whole session
          stats.avgResponseTime = currentTraffic.avgResponseTimeMs;
        }
        stats.overloadEvents = currentTraffic.totalFailed; // Simplified mapping
        
        // --- AUTO CRASH MECHANIC ---
        // Capacity per node is ~15-20 RPS. If traffic is way over, start randomly crashing them!
        const healthyNodes = health.filter(t => t.state === 'healthy').map(t => t.instanceId);
        const capacityBoundary = Math.max(1, healthyNodes.length) * 15;
        
        if (currentTraffic.currentRps > capacityBoundary + 10 && healthyNodes.length > 0) {
           const targetToCrash = healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
           console.log(`🧨 AUTO-CRASH TRIGGERED! Traffic ${currentTraffic.currentRps}RPS exceeds capacity. Crashing ${targetToCrash}`);
           this.applyInstanceCommand(targetToCrash, 'crash');
        }
      }
    } catch (err) {
      console.warn('Metrics poll error:', err.message);
    }
  }

  // ─── State getters ───────────────────────────────────────────────────────────

  getStatus() {
    return {
      provisioned: this.provisioned,
      provisioning: this.provisioning,
      destroying: this.destroying,
      isRunning: this.isRunning,
      albDns: this.albDns,
      albArn: this.albArn,
      instanceIds: this.instanceIds,
      lastError: this.lastError,
    };
  }

  getMetrics() {
    const trafficStats = trafficGenerator.getStats();

    const servers = this.instanceIds.map((id, idx) => {
      const instance = this.latestInstanceStatuses.find(i => i.id === id) || {};
      const health = this.latestTargetHealth.find(h => h.instanceId === id) || {};
      const serverName = instance.name || `Server-${idx}`;
      const shortName = serverName.startsWith('lb-simulator-') 
        ? serverName.charAt(13).toUpperCase() + serverName.slice(14) 
        : serverName;
      
      const isUp = health.state === 'healthy';
      const processed = trafficStats.serverCounts[serverName] || trafficStats.serverCounts[shortName] || 0;
      
      // Calculate the LIVE share of traffic this node is processing right now (last ~200 requests)
      const liveCount = (trafficStats.recentTargets || []).filter(t => t === serverName || t === shortName).length;
      const liveTotal = (trafficStats.recentTargets || []).length || 1; 
      const share = (liveCount / liveTotal) * 100;
      
      // Calculate how many requests per second are theoretically hitting this node right now
      const allocatedRps = (share / 100) * trafficStats.currentRps;
      
      // Assuming a t2.micro soft limit of 15 RPS, calculate the capacity utilization
      const capacityPercent = isUp ? Math.min(100, Math.round((allocatedRps / 15) * 100)) : 0;

      return {
        id,
        name: serverName,
        state: instance.state || 'pending',
        publicIp: instance.publicIp || null,
        az: instance.az || 'unknown',
        targetState: health.state || 'initial',
        targetReason: health.reason || '',
        
        // Detailed Visual Status Mapping
        status: this.instanceOverrides[id] === 'slow' ? 'overloaded' : (
                  this.instanceOverrides[id] === 'crash' ? 'crashed' : (
                    isUp ? 'healthy' : instance.state === 'running' ? 'pending' : 'down'
                  )
                ),
        
        // Extended attributes for charts (mocked/inferred)
        totalProcessed: processed,
        loadPercent: capacityPercent,
        activeConnections: trafficStats.isRunning ? Math.round(trafficStats.currentRps / Math.max(1, this.instanceIds.length)) : 0, 
        maxCapacity: 50,
      };
    });

    return {
      mode: 'real',
      isRunning: this.isRunning,
      algorithm: this.algorithm,
      albDns: this.albDns,
      servers,

      // Traffic generator stats
      totalRequests: trafficStats.totalRequests,
      totalSucceeded: trafficStats.totalSucceeded,
      totalFailed: trafficStats.totalFailed,
      errorRate: trafficStats.errorRate,
      requestsPerSecond: trafficStats.currentRps,
      avgResponseTimeMs: trafficStats.avgResponseTimeMs,
      maxResponseTimeMs: trafficStats.maxResponseTimeMs,
      rpsHistory: trafficStats.rpsHistory,

      // CloudWatch
      cwRequestCount: this.latestCwMetrics.requestCount,
      cwAvgLatencyMs: this.latestCwMetrics.avgLatencyMs,

      algorithmStats: this.algorithmStats,
      timestamp: Date.now(),
    };
  }

  _emit(event, data) {
    if (this._emitCallback) this._emitCallback(event, data);
  }
}

// Singleton
export const realModeEngine = new RealModeEngine();
