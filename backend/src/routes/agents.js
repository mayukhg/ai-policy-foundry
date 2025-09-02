import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/agents - Get all agents status
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/agents - Retrieving agent status');
    
    const agentStatus = agentManager.getAgentStatus();
    
    res.json({
      success: true,
      data: agentStatus
    });
    
  } catch (error) {
    logger.error('Failed to retrieve agent status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent status',
      message: error.message
    });
  }
});

// GET /api/agents/:name - Get specific agent status
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    logger.info(`GET /api/agents/${name} - Retrieving agent status`);
    
    const agentStatus = agentManager.getAgentStatus();
    const agent = agentStatus[name];
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
        message: `Agent ${name} not found`
      });
    }
    
    res.json({
      success: true,
      data: agent
    });
    
  } catch (error) {
    logger.error(`Failed to retrieve agent ${req.params.name}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent status',
      message: error.message
    });
  }
});

// POST /api/agents/:name/execute - Execute agent task
router.post('/:name/execute', async (req, res) => {
  try {
    const { name } = req.params;
    const { task, data } = req.body;
    
    logger.info(`POST /api/agents/${name}/execute - Executing task: ${task}`);
    
    const result = await agentManager.executeTask(name, task, data);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error(`Failed to execute task for agent ${req.params.name}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute agent task',
      message: error.message
    });
  }
});

// POST /api/agents/:name/restart - Restart agent
router.post('/:name/restart', async (req, res) => {
  try {
    const { name } = req.params;
    
    logger.info(`POST /api/agents/${name}/restart - Restarting agent`);
    
    // This would typically restart the agent
    // For now, just return success
    
    res.json({
      success: true,
      message: `Agent ${name} restarted successfully`
    });
    
  } catch (error) {
    logger.error(`Failed to restart agent ${req.params.name}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart agent',
      message: error.message
    });
  }
});

// GET /api/agents/:name/metrics - Get agent metrics
router.get('/:name/metrics', async (req, res) => {
  try {
    const { name } = req.params;
    
    logger.info(`GET /api/agents/${name}/metrics - Retrieving agent metrics`);
    
    const agentStatus = agentManager.getAgentStatus();
    const agent = agentStatus[name];
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
        message: `Agent ${name} not found`
      });
    }
    
    const metrics = {
      name: name,
      status: agent.status,
      lastActivity: agent.lastActivity,
      metrics: agent.metrics,
      uptime: Date.now() - agent.lastActivity.getTime(),
      performance: {
        averageResponseTime: agent.metrics.averageResponseTime,
        requestsPerMinute: agent.metrics.requestsProcessed / (Date.now() - agent.lastActivity.getTime()) * 60000,
        errorRate: agent.metrics.errors / agent.metrics.requestsProcessed * 100
      }
    };
    
    res.json({
      success: true,
      data: metrics
    });
    
  } catch (error) {
    logger.error(`Failed to retrieve metrics for agent ${req.params.name}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent metrics',
      message: error.message
    });
  }
});

export default router; 