/**
 * Simulation Engine — Core orchestrator for the Load Balancer Simulator
 *
 * Responsibilities:
 *  - Maintains virtual server pool state
 *  - Generates incoming requests at a configurable rate
 *  - Routes each request using the selected algorithm
 *  - Simulates request duration (1–5s) then releases connections
 *  - Tracks per-algorithm metrics for comparison
 *  - Syncs metrics to AWS DynamoDB periodically
 */
import { v4 as uuidv4 } from 'uuid';
import { createServerPool, createServer, updateServerStatus, recordResponseTime } from './ServerPool.js';
import { roundRobin, resetRoundRobin } from '../algorithms/roundRobin.js';
import { leastConnections } from '../algorithms/leastConnections.js';
import { weightedRoundRobin, buildWeightedList, resetWeightedRoundRobin } from '../algorithms/weightedRoundRobin.js';
import { logSessionEvent, logMetricsSnapshot } from '../aws/dynamoClient.js';

// Request lifecycle constants
const REQ_DURATION_MIN = 800;   // ms
const REQ_DURATION_MAX = 5000;  // ms
const METRICS_EMIT_INTERVAL = 500;   // ms — how often to push to frontend
const DYNAMO_LOG_INTERVAL = 30000;   // ms — how often to log to DynamoDB

class SimulationEngine {
  constructor() {
    this.servers = createServerPool(6);
    this.algorithm = 'roundRobin';
    this.isRunning = false;
    this.requestRate = 5; // requests per second

    // Timers
    this._generateInterval = null;
    this._emitInterval = null;
    this._dynamoInterval = null;

    // Session
    this.sessionId = null;

    // Global metrics
    this.totalRequests = 0;
    this.requestsPerSecond = 0;
    this.rpsHistory = []; // [{ time: timestamp, rps: number }] — last 60 points

    // Per-algorithm comparison data (persists across algorithm switches)
    this.algorithmStats = {
      roundRobin: {
        totalRequests: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        overloadEvents: 0,
        sessions: 0,
      },
      leastConnections: {
        totalRequests: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        overloadEvents: 0,
        sessions: 0,
      },
      weightedRoundRobin: {
        totalRequests: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        overloadEvents: 0,
        sessions: 0,
      },
    };

    // Callback set by Socket.io handler to emit events
    this._emitCallback = null;
  }

  /** Register the Socket.io emit callback */
  setEmitCallback(cb) {
    this._emitCallback = cb;
  }

  /** Select a server using the active algorithm */
  _selectServer() {
    switch (this.algorithm) {
      case 'leastConnections':
        return leastConnections(this.servers);
      case 'weightedRoundRobin':
        return weightedRoundRobin(this.servers);
      default:
        return roundRobin(this.servers);
    }
  }

  /** Process a single incoming request */
  _processRequest() {
    const server = this._selectServer();
    if (!server) return; // All servers down

    const startTime = Date.now();
    server.activeConnections++;
    server.totalProcessed++;
    this.totalRequests++;

    // Update status after incrementing connections
    const prevStatus = server.status;
    updateServerStatus(server);

    // Track overload events
    if (server.status === 'overloaded' && prevStatus !== 'overloaded') {
      this.algorithmStats[this.algorithm].overloadEvents++;
    }

    // Simulate randomized request duration, then release
    const duration = REQ_DURATION_MIN + Math.random() * (REQ_DURATION_MAX - REQ_DURATION_MIN);
    setTimeout(() => {
      server.activeConnections = Math.max(0, server.activeConnections - 1);

      const responseTimeMs = Date.now() - startTime;
      recordResponseTime(server, responseTimeMs);

      // Update per-algorithm running average
      const stats = this.algorithmStats[this.algorithm];
      stats.totalRequests++;
      stats.totalResponseTime += responseTimeMs;
      stats.avgResponseTime = Math.round(stats.totalResponseTime / stats.totalRequests);

      updateServerStatus(server);
    }, duration);
  }

  /**
   * Start the simulation
   * @param {number} requestRate - Requests per second (1–50)
   * @param {string} algorithm - 'roundRobin' | 'leastConnections' | 'weightedRoundRobin'
   */
  start(requestRate = 5, algorithm = 'roundRobin') {
    if (this.isRunning) return { success: false, message: 'Already running' };

    this.requestRate = Math.max(1, Math.min(50, requestRate));
    this.algorithm = algorithm;
    this.isRunning = true;
    this.sessionId = uuidv4();

    // Initialize algorithm state
    this._resetAlgorithmState();

    // Log session start to DynamoDB
    logSessionEvent(this.sessionId, 'SESSION_START', {
      algorithm,
      requestRate: this.requestRate,
    });

    // Request generation loop (fires every second, sends `requestRate` requests)
    this._generateInterval = setInterval(() => {
      for (let i = 0; i < this.requestRate; i++) {
        this._processRequest();
      }
      this.requestsPerSecond = this.requestRate;
      this.rpsHistory.push({ time: Date.now(), rps: this.requestRate });
      if (this.rpsHistory.length > 60) this.rpsHistory.shift();
    }, 1000);

    // Emit metrics to frontend via Socket.io
    this._emitInterval = setInterval(() => {
      if (this._emitCallback) {
        this._emitCallback('metrics-update', this.getMetrics());
      }
    }, METRICS_EMIT_INTERVAL);

    // Log periodic snapshot to DynamoDB
    this._dynamoInterval = setInterval(() => {
      logMetricsSnapshot(this.sessionId, this.getMetrics());
    }, DYNAMO_LOG_INTERVAL);

    return { success: true, sessionId: this.sessionId };
  }

  /** Stop the simulation */
  stop() {
    if (!this.isRunning) return { success: false, message: 'Not running' };

    this.isRunning = false;
    clearInterval(this._generateInterval);
    clearInterval(this._emitInterval);
    clearInterval(this._dynamoInterval);

    // Log session end
    if (this.sessionId) {
      logSessionEvent(this.sessionId, 'SESSION_END', {
        algorithm: this.algorithm,
        totalRequests: this.totalRequests,
        serverCount: this.servers.length,
        algorithmStats: this.algorithmStats,
      });
      this.sessionId = null;
    }

    // Final emit so UI shows stopped state
    if (this._emitCallback) {
      this._emitCallback('metrics-update', this.getMetrics());
    }

    return { success: true };
  }

  /**
   * Switch algorithm (works mid-simulation)
   * @param {string} algorithm
   */
  setAlgorithm(algorithm) {
    if (!['roundRobin', 'leastConnections', 'weightedRoundRobin'].includes(algorithm)) {
      return { success: false, message: 'Unknown algorithm' };
    }
    this.algorithm = algorithm;
    this._resetAlgorithmState();
    return { success: true, algorithm };
  }

  /** Adjust request rate (works mid-simulation) */
  setRequestRate(rate) {
    this.requestRate = Math.max(1, Math.min(50, rate));
    return { success: true, requestRate: this.requestRate };
  }

  /** Trigger a random server failure */
  triggerFailure() {
    const healthyServers = this.servers.filter(s => s.status === 'healthy');
    if (healthyServers.length <= 1) {
      return { success: false, message: 'Cannot take down last healthy server' };
    }
    const target = healthyServers[Math.floor(Math.random() * healthyServers.length)];
    target.status = 'down';
    target.activeConnections = 0;
    target.cpuUsage = 0;
    return { success: true, serverId: target.id, serverName: target.name };
  }

  /** Recover a specific downed server */
  recoverServer(serverId) {
    const server = this.servers.find(s => s.id === serverId);
    if (!server) return { success: false, message: 'Server not found' };
    server.status = 'healthy';
    server.cpuUsage = 10;
    return { success: true, serverId };
  }

  /** Add a new auto-scaled server */
  addServer() {
    if (this.servers.length >= 12) {
      return { success: false, message: 'Maximum server limit reached (12)' };
    }
    const newServer = createServer(this.servers.length);
    this.servers.push(newServer);
    // Rebuild WRR list if active
    if (this.algorithm === 'weightedRoundRobin') {
      buildWeightedList(this.servers);
    }
    return { success: true, server: newServer };
  }

  /** Remove the last server (auto-scaling down) */
  removeServer() {
    if (this.servers.length <= 1) {
      return { success: false, message: 'Cannot remove last server' };
    }
    const removed = this.servers.pop();
    return { success: true, serverId: removed.id };
  }

  /** Recover all downed servers */
  recoverAll() {
    this.servers.forEach(s => {
      if (s.status === 'down') {
        s.status = 'healthy';
        s.cpuUsage = 10;
      }
    });
    return { success: true };
  }

  /** Full simulation reset */
  reset() {
    this.stop();
    this.servers = createServerPool(6);
    this.totalRequests = 0;
    this.requestsPerSecond = 0;
    this.rpsHistory = [];
    this.algorithm = 'roundRobin';
    this._resetAlgorithmState();

    if (this._emitCallback) {
      this._emitCallback('metrics-update', this.getMetrics());
    }
    return { success: true };
  }

  /** Get the full metrics snapshot for frontend consumption */
  getMetrics() {
    const overloadedServers = this.servers.filter(s => s.status === 'overloaded');

    return {
      isRunning: this.isRunning,
      algorithm: this.algorithm,
      requestRate: this.requestRate,
      totalRequests: this.totalRequests,
      requestsPerSecond: this.requestsPerSecond,
      rpsHistory: this.rpsHistory.slice(-30),
      timestamp: Date.now(),
      overloadAlert: overloadedServers.length > 0
        ? `${overloadedServers.length} server(s) overloaded: ${overloadedServers.map(s => s.name).join(', ')}`
        : null,
      servers: this.servers.map(s => ({
        id: s.id,
        name: s.name,
        activeConnections: s.activeConnections,
        totalProcessed: s.totalProcessed,
        cpuUsage: s.cpuUsage,
        maxCapacity: s.maxCapacity,
        weight: s.weight,
        status: s.status,
        responseTime: s.responseTime,
        avgResponseTime: s.avgResponseTime,
        loadPercent: Math.min(100, Math.round((s.activeConnections / s.maxCapacity) * 100)),
      })),
      algorithmStats: this.algorithmStats,
    };
  }

  /** Internal: reset algorithm pointers on switch/start */
  _resetAlgorithmState() {
    resetRoundRobin();
    resetWeightedRoundRobin();
    if (this.algorithm === 'weightedRoundRobin') {
      buildWeightedList(this.servers);
    }
  }
}

// Singleton — one engine shared across the whole application
export const simulationEngine = new SimulationEngine();
