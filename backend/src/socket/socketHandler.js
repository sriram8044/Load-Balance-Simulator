/**
 * Socket.io Handler
 * Manages real-time WebSocket connections and registers the emit callback
 * on the SimulationEngine so it can push live metrics to all connected clients.
 */
import { simulationEngine } from '../simulation/SimulationEngine.js';
import { realModeEngine } from '../simulation/RealModeEngine.js';

/**
 * Initialize Socket.io event handling
 * @param {import('socket.io').Server} io
 */
export function initSocketHandler(io) {
  // Register the simulated engine's emit callback
  simulationEngine.setEmitCallback((event, data) => {
    io.emit(event, data);
  });

  // Register the real mode engine's emit callback
  realModeEngine.setEmitCallback((event, data) => {
    io.emit(event, data);
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // On connect, immediately send current state
    socket.emit('metrics-update', simulationEngine.getMetrics());
    socket.emit('infra-status', realModeEngine.getStatus());

    // Simulated engine events
    socket.on('request-metrics', () => {
      socket.emit('metrics-update', simulationEngine.getMetrics());
    });

    // Real mode events
    socket.on('request-real-metrics', () => {
      socket.emit('real-metrics', realModeEngine.getMetrics());
      socket.emit('infra-status', realModeEngine.getStatus());
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

