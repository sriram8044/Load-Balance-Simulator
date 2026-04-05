/**
 * Weighted Round Robin Algorithm
 * Servers with higher weights receive proportionally more requests.
 * Ideal for heterogeneous server pools where capacity varies.
 */

let weightedList = []; // Expanded list of server IDs based on weights
let weightedIndex = 0;

/**
 * Build the weighted server list from current server weights
 * @param {Array} servers - Array of server objects with { id, weight }
 */
export function buildWeightedList(servers) {
  weightedList = [];
  weightedIndex = 0;
  servers
    .filter(s => s.status !== 'down')
    .forEach(server => {
      for (let i = 0; i < server.weight; i++) {
        weightedList.push(server.id);
      }
    });
}

/**
 * Select next server using Weighted Round Robin
 * @param {Array} servers - Array of server objects
 * @returns {Object|null} Selected server or null if no healthy servers
 */
export function weightedRoundRobin(servers) {
  const healthyServers = servers.filter(s => s.status !== 'down');
  if (healthyServers.length === 0) return null;

  // Rebuild list if empty or stale
  if (weightedList.length === 0) buildWeightedList(servers);

  const serverId = weightedList[weightedIndex % weightedList.length];
  weightedIndex = (weightedIndex + 1) % weightedList.length;

  // Find server by ID; fallback to first healthy if not found
  return servers.find(s => s.id === serverId) || healthyServers[0];
}

/** Reset WRR state (call when switching algorithms) */
export function resetWeightedRoundRobin() {
  weightedList = [];
  weightedIndex = 0;
}
