import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from './utils/logger.js';
import { initializeAgents } from './agents/agentManager.js';
import { initializeEnhancedAgents } from './agents/EnhancedAgentManager.js';
import { initializeDatabase } from './database/connection.js';
import { initializeRedis } from './database/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { authMiddleware } from './middleware/auth.js';

// Import routes
import policyRoutes from './routes/policies.js';
import threatRoutes from './routes/threats.js';
import dashboardRoutes from './routes/dashboard.js';
import agentRoutes from './routes/agents.js';
import complianceRoutes from './routes/compliance.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/policies', authMiddleware, policyRoutes);
app.use('/api/threats', authMiddleware, threatRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/agents', authMiddleware, agentRoutes);
app.use('/api/compliance', authMiddleware, complianceRoutes);

// WebSocket connection for real-time updates
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-dashboard', (data) => {
    socket.join('dashboard');
    logger.info(`Client ${socket.id} joined dashboard`);
  });
  
  socket.on('join-threats', (data) => {
    socket.join('threats');
    logger.info(`Client ${socket.id} joined threats room`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing AI Policy Foundry Backend...');
    
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized successfully');
    
    // Initialize Redis
    await initializeRedis();
    logger.info('Redis initialized successfully');
    
    // Initialize AI agents (use enhanced version if enabled)
    if (process.env.USE_ENHANCED_AGENTS === 'true') {
      await initializeEnhancedAgents(io);
      logger.info('Enhanced AI agents with LangGraph and RAG initialized successfully');
    } else {
      await initializeAgents(io);
      logger.info('AI agents initialized successfully');
    }
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 AI Policy Foundry Backend running on port ${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}/health`);
      logger.info(`🔗 WebSocket: ws://localhost:${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start the application
initializeServices(); 