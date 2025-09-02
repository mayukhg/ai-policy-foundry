import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';
import { validatePolicyRequest } from '../middleware/validation.js';

const router = express.Router();

// GET /api/policies - Get all policies
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/policies - Retrieving all policies');
    
    // This would typically fetch from database
    const policies = [
      {
        id: 'policy-001',
        name: 'aws-s3-security-policy',
        service: 'AWS S3',
        status: 'active',
        compliance: 'CIS 3.1',
        lastUpdated: new Date().toISOString(),
        risk: 'low'
      },
      {
        id: 'policy-002',
        name: 'azure-functions-security-policy',
        service: 'Azure Functions',
        status: 'pending',
        compliance: 'CIS 2.4',
        lastUpdated: new Date().toISOString(),
        risk: 'medium'
      }
    ];
    
    res.json({
      success: true,
      data: policies,
      count: policies.length
    });
    
  } catch (error) {
    logger.error('Failed to retrieve policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policies',
      message: error.message
    });
  }
});

// POST /api/policies/generate - Generate new policy
router.post('/generate', validatePolicyRequest, async (req, res) => {
  try {
    const { service, requirements } = req.body;
    
    logger.info(`POST /api/policies/generate - Generating policy for ${service}`);
    
    // Generate policy using agent system
    const policy = await agentManager.generatePolicy(service, requirements);
    
    res.json({
      success: true,
      data: policy,
      message: 'Policy generated successfully'
    });
    
  } catch (error) {
    logger.error('Failed to generate policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate policy',
      message: error.message
    });
  }
});

// GET /api/policies/:id - Get specific policy
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`GET /api/policies/${id} - Retrieving policy`);
    
    // This would typically fetch from database
    const policy = {
      id: id,
      name: `${id}-security-policy`,
      service: 'AWS S3',
      status: 'active',
      compliance: 'CIS 3.1',
      lastUpdated: new Date().toISOString(),
      risk: 'low',
      content: `# ${id} Security Policy
apiVersion: v1
kind: SecurityPolicy
metadata:
  name: ${id}-security-policy
spec:
  encryption:
    atRest: true
    inTransit: true`
    };
    
    res.json({
      success: true,
      data: policy
    });
    
  } catch (error) {
    logger.error(`Failed to retrieve policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy',
      message: error.message
    });
  }
});

// PUT /api/policies/:id - Update policy
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    logger.info(`PUT /api/policies/${id} - Updating policy`);
    
    // This would typically update in database
    const updatedPolicy = {
      id: id,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: updatedPolicy,
      message: 'Policy updated successfully'
    });
    
  } catch (error) {
    logger.error(`Failed to update policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update policy',
      message: error.message
    });
  }
});

// DELETE /api/policies/:id - Delete policy
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`DELETE /api/policies/${id} - Deleting policy`);
    
    // This would typically delete from database
    
    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });
    
  } catch (error) {
    logger.error(`Failed to delete policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete policy',
      message: error.message
    });
  }
});

// POST /api/policies/:id/validate - Validate policy
router.post('/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`POST /api/policies/${id}/validate - Validating policy`);
    
    // Validate policy using compliance agent
    const validation = await agentManager.executeTask('compliance', 'validate', {
      policy: { metadata: { name: id } },
      framework: 'CIS'
    });
    
    res.json({
      success: true,
      data: validation
    });
    
  } catch (error) {
    logger.error(`Failed to validate policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate policy',
      message: error.message
    });
  }
});

// POST /api/policies/:id/analyze - Analyze policy security
router.post('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.info(`POST /api/policies/${id}/analyze - Analyzing policy security`);
    
    // Analyze policy using security analysis agent
    const analysis = await agentManager.executeTask('security-analysis', 'analyze', {
      policy: { metadata: { name: id } },
      context: { environment: 'production' }
    });
    
    res.json({
      success: true,
      data: analysis
    });
    
  } catch (error) {
    logger.error(`Failed to analyze policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze policy',
      message: error.message
    });
  }
});

// GET /api/policies/stats - Get policy statistics
router.get('/stats/overview', async (req, res) => {
  try {
    logger.info('GET /api/policies/stats - Retrieving policy statistics');
    
    // This would typically calculate from database
    const stats = {
      total: 847,
      active: 823,
      pending: 23,
      draft: 1,
      complianceScore: 94,
      averageRisk: 'low',
      byService: {
        'AWS S3': 156,
        'AWS Lambda': 89,
        'Azure Functions': 67,
        'GCP Cloud Storage': 45
      },
      byCompliance: {
        'CIS': 456,
        'NIST': 234,
        'ISO': 157
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Failed to retrieve policy statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy statistics',
      message: error.message
    });
  }
});

export default router; 