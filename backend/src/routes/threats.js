import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/threats - Get all threats
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/threats - Retrieving all threats');
    
    // Get threats from threat intelligence agent
    const threats = await agentManager.executeTask('threat-intelligence', 'scan', {});
    
    res.json({
      success: true,
      data: threats,
      count: threats.length
    });
    
  } catch (error) {
    logger.error('Failed to retrieve threats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve threats',
      message: error.message
    });
  }
});

// GET /api/threats/analysis - Get threat analysis
router.get('/analysis', async (req, res) => {
  try {
    logger.info('GET /api/threats/analysis - Retrieving threat analysis');
    
    // Get threat analysis from agent system
    const analysis = await agentManager.analyzeThreats();
    
    res.json({
      success: true,
      data: analysis
    });
    
  } catch (error) {
    logger.error('Failed to retrieve threat analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve threat analysis',
      message: error.message
    });
  }
});

// GET /api/threats/:id - Get specific threat
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`GET /api/threats/${id} - Retrieving threat`);
    
    // This would typically fetch from database
    const threat = {
      id: id,
      title: 'Sample Threat',
      severity: 'high',
      description: 'This is a sample threat description',
      source: 'NIST NVD',
      publishedDate: new Date().toISOString(),
      affectedServices: ['AWS S3', 'Azure Storage'],
      cvss: 8.5,
      mitigationAvailable: true
    };
    
    res.json({
      success: true,
      data: threat
    });
    
  } catch (error) {
    logger.error(`Failed to retrieve threat ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve threat',
      message: error.message
    });
  }
});

// POST /api/threats/analyze - Analyze specific threat
router.post('/analyze', async (req, res) => {
  try {
    const { threat } = req.body;
    
    logger.info('POST /api/threats/analyze - Analyzing threat');
    
    // Analyze threat using threat intelligence agent
    const analysis = await agentManager.executeTask('threat-intelligence', 'analyze', { threat });
    
    res.json({
      success: true,
      data: analysis
    });
    
  } catch (error) {
    logger.error('Failed to analyze threat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze threat',
      message: error.message
    });
  }
});

// GET /api/threats/feeds - Get threat feed status
router.get('/feeds/status', async (req, res) => {
  try {
    logger.info('GET /api/threats/feeds/status - Retrieving threat feed status');
    
    // This would typically get from threat intelligence agent
    const feeds = [
      {
        source: 'NIST NVD',
        status: 'active',
        lastUpdate: new Date().toISOString(),
        count: 23,
        severity: 'high'
      },
      {
        source: 'MITRE ATT&CK',
        status: 'active',
        lastUpdate: new Date().toISOString(),
        count: 15,
        severity: 'medium'
      },
      {
        source: 'CISA Alerts',
        status: 'active',
        lastUpdate: new Date().toISOString(),
        count: 8,
        severity: 'critical'
      }
    ];
    
    res.json({
      success: true,
      data: feeds
    });
    
  } catch (error) {
    logger.error('Failed to retrieve threat feed status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve threat feed status',
      message: error.message
    });
  }
});

export default router; 