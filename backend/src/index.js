/**
 * Backend Entry Point — Express + Socket.io Server
 * Handles REST API and real-time WebSocket connections
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { initSocketHandler } from './socket/socketHandler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// REST API routes
app.use('/api', apiRouter);

// WebSocket handler (passes io to simulation engine)
initSocketHandler(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Load Balancer Simulator Backend`);
  console.log(`   → API:     http://localhost:${PORT}/api`);
  console.log(`   → Health:  http://localhost:${PORT}/health`);
  console.log(`   → Region:  ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log(`   → Table:   ${process.env.DYNAMO_TABLE || 'LoadBalancerLogs'}\n`);
});
