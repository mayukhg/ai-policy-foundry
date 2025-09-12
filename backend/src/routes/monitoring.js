import express from 'express';
import { monitoringService } from '../monitoring/MonitoringService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Monitoring Routes
 * Provides endpoints for real-time monitoring and alerting
 */

// Initialize monitoring service
router.use(async (req, res, next) => {
  try {
    if (!monitoringService.isRunning) {
      await monitoringService.initialize();
      await monitoringService.startMonitoring();
    }
    next();
  } catch (error) {
    logger.error('Failed to initialize monitoring service:', error);
    res.status(500).json({ error: 'Monitoring system unavailable' });
  }
});

/**
 * Get current monitoring status
 * GET /api/monitoring/status
 */
router.get('/status', async (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    
    res.json({
      success: true,
      status: 'active',
      metrics: {
        isRunning: metrics.isRunning,
        totalAlerts: metrics.alerts ? Object.keys(metrics.alerts).length : 0,
        activeAlerts: Object.values(metrics.alerts || {}).filter(alert => alert.status === 'active').length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get monitoring status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get agent metrics
 * GET /api/monitoring/agents/:agent/metrics
 */
router.get('/agents/:agent/metrics', async (req, res) => {
  try {
    const { agent } = req.params;
    const { timeframe = '1h' } = req.query;
    
    const agentMetrics = monitoringService.getAgentMetrics(agent);
    
    res.json({
      success: true,
      agent,
      timeframe,
      metrics: agentMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get agent metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all agent metrics
 * GET /api/monitoring/agents/metrics
 */
router.get('/agents/metrics', async (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;
    const metrics = monitoringService.getMetrics();
    
    res.json({
      success: true,
      timeframe,
      metrics: metrics.metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get all agent metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get active alerts
 * GET /api/monitoring/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const { status = 'active', severity, agent } = req.query;
    const metrics = monitoringService.getMetrics();
    
    let alerts = Object.values(metrics.alerts || {});
    
    // Filter by status
    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }
    
    // Filter by severity
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Filter by agent
    if (agent) {
      alerts = alerts.filter(alert => alert.agent === agent);
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Acknowledge alert
 * POST /api/monitoring/alerts/:alertId/acknowledge
 */
router.post('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    monitoringService.acknowledgeAlert(alertId);
    
    res.json({
      success: true,
      message: `Alert ${alertId} acknowledged`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to acknowledge alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Resolve alert
 * POST /api/monitoring/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    monitoringService.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: `Alert ${alertId} resolved`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to resolve alert:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get monitoring dashboard data
 * GET /api/monitoring/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    
    // Generate dashboard summary
    const dashboard = {
      summary: {
        totalAgents: 5,
        activeAgents: 0,
        totalAlerts: Object.keys(metrics.alerts || {}).length,
        activeAlerts: Object.values(metrics.alerts || {}).filter(alert => alert.status === 'active').length,
        systemHealth: 'healthy'
      },
      agents: ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'].map(agent => ({
        name: agent,
        status: 'active',
        metrics: monitoringService.getAgentMetrics(agent)
      })),
      alerts: Object.values(metrics.alerts || {}).slice(0, 10), // Latest 10 alerts
      trends: {
        accuracy: 'stable',
        latency: 'stable',
        hallucination: 'stable'
      }
    };
    
    res.json({
      success: true,
      dashboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get monitoring configuration
 * GET /api/monitoring/config
 */
router.get('/config', async (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    
    res.json({
      success: true,
      config: {
        thresholds: metrics.thresholds,
        isRunning: metrics.isRunning
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get monitoring config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Start monitoring
 * POST /api/monitoring/start
 */
router.post('/start', async (req, res) => {
  try {
    if (monitoringService.isRunning) {
      return res.json({
        success: true,
        message: 'Monitoring is already running',
        timestamp: new Date().toISOString()
      });
    }
    
    await monitoringService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring started successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to start monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop monitoring
 * POST /api/monitoring/stop
 */
router.post('/stop', async (req, res) => {
  try {
    if (!monitoringService.isRunning) {
      return res.json({
        success: true,
        message: 'Monitoring is already stopped',
        timestamp: new Date().toISOString()
      });
    }
    
    await monitoringService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring stopped successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to stop monitoring:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get monitoring reports
 * GET /api/monitoring/reports
 */
router.get('/reports', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // This would typically read from a database or file system
    // For now, return a placeholder response
    res.json({
      success: true,
      reports: [],
      message: 'Reports endpoint - implementation needed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get monitoring reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate monitoring report
 * POST /api/monitoring/reports/generate
 */
router.post('/reports/generate', async (req, res) => {
  try {
    const { timeframe = '24h', agents = [] } = req.body;
    
    // This would generate a comprehensive monitoring report
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Report generation endpoint - implementation needed',
      timeframe,
      agents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate monitoring report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
