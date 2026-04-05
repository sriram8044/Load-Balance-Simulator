/**
 * Least Connections Algorithm
 * Routes each new request to the server with the fewest active connections.
 * More intelligent than Round Robin — adapts to varying request durations.
 */

/**
 * Select the server with the fewest active connections
 * @param {Array} servers - Array of server objects
 * @returns {Object|null} Selected server or null if no healthy servers
 */
export function leastConnections(servers) {
  const healthyServers = servers.filter(s => s.status !== 'down');
  if (healthyServers.length === 0) return null;

  return healthyServers.reduce((minServer, server) =>
    server.activeConnections < minServer.activeConnections ? server : minServer
  );
}
