/**
 * useSocket — Custom React hook for Socket.io connection
 * Connects to the backend WebSocket server and returns real-time metrics state.
 */
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.warn('⚠️ WebSocket disconnected:', reason);
      setConnected(false);
    });

    socket.on('metrics-update', (data) => {
      setMetrics(data);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  /** Manually request a fresh metrics snapshot */
  const requestMetrics = () => {
    socketRef.current?.emit('request-metrics');
  };

  return { connected, metrics, requestMetrics };
}
