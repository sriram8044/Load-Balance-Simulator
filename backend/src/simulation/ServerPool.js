/**
 * Server Pool — Creates and manages virtual server instances
 * These are simulated servers representing cloud infrastructure nodes
 */
import { v4 as uuidv4 } from 'uuid';

// Pre-defined server configs (name, weight, maxCapacity)
const SERVER_CONFIGS = [
  { name: 'Alpha',   weight: 3, maxCapacity: 60 },
  { name: 'Beta',    weight: 2, maxCapacity: 50 },
  { name: 'Gamma',   weight: 2, maxCapacity: 50 },
  { name: 'Delta',   weight: 1, maxCapacity: 40 },
  { name: 'Epsilon', weight: 1, maxCapacity: 40 },
  { name: 'Zeta',    weight: 3, maxCapacity: 60 },
];

const EXTRA_NAMES = ['Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi'];

/**
 * Create a single virtual server object
 * @param {number} index - Position index for naming
 * @returns {Object} Server object
 */
export function createServer(index = 0) {
  const config = SERVER_CONFIGS[index] || {
    name: EXTRA_NAMES[(index - SERVER_CONFIGS.length) % EXTRA_NAMES.length] || `Node-${index + 1}`,
    weight: 1,
    maxCapacity: 45,
  };
  return {
    id: `srv-${uuidv4().slice(0, 8)}`,
    name: config.name,
    activeConnections: 0,
    totalProcessed: 0,
    cpuUsage: Math.floor(Math.random() * 15) + 5, // Baseline 5–20%
    maxCapacity: config.maxCapacity,
    weight: config.weight,
    status: 'healthy',      // 'healthy' | 'overloaded' | 'down'
    responseTime: 0,        // Rolling avg response time (ms)
    avgResponseTime: 0,     // Lifetime avg for comparison stats
    responseSamples: 0,     // Count for avg calculation
    requestHistory: [],     // Last 10 request timestamps (for rate calculation)
  };
}

/**
 * Create the initial server pool
 * @param {number} count - Number of servers to create (default: 6)
 * @returns {Array} Array of server objects
 */
export function createServerPool(count = 6) {
  return Array.from({ length: count }, (_, i) => createServer(i));
}

/**
 * Update a server's status based on its current load
 * Called after every connection increment/decrement
 * @param {Object} server - Server object to update
 * @returns {Object} Updated server
 */
export function updateServerStatus(server) {
  if (server.status === 'down') return server; // Don't auto-recover downed servers

  const loadPercent = (server.activeConnections / server.maxCapacity) * 100;

  if (loadPercent >= 90) {
    server.status = 'overloaded';
  } else if (loadPercent >= 75) {
    server.status = 'overloaded';
  } else {
    server.status = 'healthy';
  }

  // Simulate CPU correlated with connection load + noise
  const baseCpu = loadPercent * 0.85;
  const noise = Math.floor(Math.random() * 8) - 4;
  server.cpuUsage = Math.min(99, Math.max(3, Math.round(baseCpu + noise)));

  return server;
}

/**
 * Record a completed request's response time into server stats
 * @param {Object} server
 * @param {number} responseTimeMs
 */
export function recordResponseTime(server, responseTimeMs) {
  server.responseSamples += 1;
  // Cumulative moving average
  server.avgResponseTime = Math.round(
    server.avgResponseTime + (responseTimeMs - server.avgResponseTime) / server.responseSamples
  );
  // Short-term rolling (last 10 requests)
  server.responseTime = Math.round(
    (server.responseTime * 0.8) + (responseTimeMs * 0.2)
  );
}
