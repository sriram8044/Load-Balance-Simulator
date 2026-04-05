/**
 * Round Robin Algorithm
 * Distributes requests sequentially across all healthy servers.
 * Simple and fair when all servers have equal capacity.
 */

let currentIndex = 0;

/**
 * Select the next server using Round Robin
 * @param {Array} servers - Array of server objects
 * @returns {Object|null} Selected server or null if no healthy servers
 */
export function roundRobin(servers) {
  const healthyServers = servers.filter(s => s.status !== 'down');
  if (healthyServers.length === 0) return null;

  const server = healthyServers[currentIndex % healthyServers.length];
  currentIndex = (currentIndex + 1) % healthyServers.length;
  return server;
}

/** Reset the RR pointer (call when switching algorithms or restarting) */
export function resetRoundRobin() {
  currentIndex = 0;
}
