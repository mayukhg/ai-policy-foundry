import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/compliance/frameworks - Get compliance frameworks
router.get('/frameworks', async (req, res) => {
  try {
    logger.info('GET /api/compliance/frameworks - Retrieving compliance frameworks');
    
    // This would typically fetch from database
    const frameworks = [
      {
        name: 'CIS',
        version: '1.4.0',
        description: 'Center for Internet Security Benchmarks',
        controls: 153,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'NIST',
        version: '1.1',
        description: 'NIST Cybersecurity Framework',
        controls: 108,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'ISO',
        version: '27001:2013',
        description: 'ISO 27001 Information Security Management',
        controls: 114,
        lastUpdated: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: frameworks
    });
    
  } catch (error) {
    logger.error('Failed to retrieve compliance frameworks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance frameworks',
      message: error.message
    });
  }
});

// GET /api/compliance/audit - Get compliance audit results
router.get('/audit', async (req, res) => {
  try {
    logger.info('GET /api/compliance/audit - Retrieving compliance audit results');
    
    // This would typically fetch from database
    const audit = {
      auditTime: new Date().toISOString(),
      overallScore: 94,
      frameworks: {
        'CIS': {
          score: 96,
          compliantPolicies: 456,
          totalPolicies: 475,
          issues: 19
        },
        'NIST': {
          score: 92,
          compliantPolicies: 234,
          totalPolicies: 254,
          issues: 20
        },
        'ISO': {
          score: 94,
          compliantPolicies: 157,
          totalPolicies: 167,
          issues: 10
        }
      },
      findings: [
        {
          type: 'warning',
          severity: 'medium',
          description: '3 policies need compliance review',
          framework: 'CIS',
          affectedPolicies: ['policy-001', 'policy-002', 'policy-003']
        }
      ]
    };
    
    res.json({
      success: true,
      data: audit
    });
    
  } catch (error) {
    logger.error('Failed to retrieve compliance audit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance audit',
      message: error.message
    });
  }
});

// POST /api/compliance/validate - Validate policy compliance
router.post('/validate', async (req, res) => {
  try {
    const { policy, framework } = req.body;
    
    logger.info('POST /api/compliance/validate - Validating policy compliance');
    
    // Validate policy using compliance agent
    const validation = await agentManager.executeTask('compliance', 'validate', {
      policy: policy,
      framework: framework
    });
    
    res.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    logger.error('Failed to validate compliance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate compliance',
      message: error.message
    });
  }
});

// GET /api/compliance/updates - Get compliance framework updates
router.get('/updates', async (req, res) => {
  try {
    logger.info('GET /api/compliance/updates - Retrieving compliance updates');
    
    // Get updates from compliance agent
    const updates = await agentManager.executeTask('compliance', 'check-updates', {});
    
    res.json({
      success: true,
      data: updates
    });
    
  } catch (error) {
    logger.error('Failed to retrieve compliance updates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance updates',
      message: error.message
    });
  }
});

// GET /api/compliance/controls - Get compliance controls
router.get('/controls', async (req, res) => {
  try {
    const { framework } = req.query;
    
    logger.info(`GET /api/compliance/controls - Retrieving controls for ${framework}`);
    
    // This would typically fetch from database
    const controls = [
      {
        id: 'CIS-3.1',
        name: 'Ensure encryption in transit',
        description: 'Ensure that all data in transit is encrypted',
        framework: 'CIS',
        category: 'Data Protection',
        severity: 'high'
      },
      {
        id: 'CIS-3.2',
        name: 'Ensure encryption at rest',
        description: 'Ensure that all data at rest is encrypted',
        framework: 'CIS',
        category: 'Data Protection',
        severity: 'high'
      },
      {
        id: 'NIST-ID.AM-1',
        name: 'Physical devices and systems',
        description: 'Physical devices and systems within the organization are inventoried',
        framework: 'NIST',
        category: 'Asset Management',
        severity: 'medium'
      }
    ];
    
    const filteredControls = framework ? 
      controls.filter(control => control.framework === framework) : 
      controls;
    
    res.json({
      success: true,
      data: filteredControls
    });
    
  } catch (error) {
    logger.error('Failed to retrieve compliance controls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve compliance controls',
      message: error.message
    });
  }
});

export default router; 