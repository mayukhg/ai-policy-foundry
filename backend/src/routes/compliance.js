import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { track as mpTrack } from '../utils/mixpanel.js';

const router = express.Router();

function distinctId(req) {
  return req.user?.id || 'anonymous';
}

function mapFramework(name) {
  const t = (name || '').toLowerCase();
  if (t.includes('nist')) return 'nist_ai_rmf';
  if (t.includes('iso')) return 'iso_42001';
  if (t.includes('gdpr')) return 'gdpr';
  if (t.includes('hipaa')) return 'hipaa';
  if (t.includes('sox')) return 'sox';
  return 'custom';
}

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

    mpTrack(distinctId(req), 'foundry_dashboard_viewed', {
      section: 'compliance',
      platform: 'ai_policy_foundry',
    });
    mpTrack(distinctId(req), 'audit_report_generated', {
      report_id: uuidv4(),
      report_type: 'full_audit',
      frameworks_included: ['custom', 'nist_ai_rmf', 'iso_42001'],
      format: 'json',
      time_range_days: 90,
      triggered_by: 'manual',
    });
    
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

    const checkId = uuidv4();
    const policyId = policy?.id || policy?.metadata?.name || 'unknown';
    const fw = mapFramework(framework);
    const assetId = policy?.metadata?.service || 'unknown-asset';
    const controlsChecked = validation?.controlsChecked || validation?.controls?.length || 5;
    const score = typeof validation?.score === 'number' ? validation.score : 80;
    const passed = validation?.compliant !== false && score >= 70;

    mpTrack(distinctId(req), 'compliance_check_run', {
      check_id: checkId,
      policy_id: policyId,
      framework: fw,
      asset_id: assetId,
      asset_type: 'api_endpoint',
      triggered_by: 'manual',
    });

    if (passed) {
      mpTrack(distinctId(req), 'compliance_check_passed', {
        check_id: checkId,
        policy_id: policyId,
        framework: fw,
        asset_id: assetId,
        controls_checked: controlsChecked,
        score,
      });
    } else {
      const controlsFailed = Math.max(1, Math.floor(controlsChecked / 3));
      const severity = score < 40 ? 'critical' : score < 60 ? 'high' : 'medium';
      mpTrack(distinctId(req), 'compliance_check_failed', {
        check_id: checkId,
        policy_id: policyId,
        framework: fw,
        asset_id: assetId,
        controls_checked: controlsChecked,
        controls_failed: controlsFailed,
        severity,
        score,
      });
      mpTrack(distinctId(req), 'policy_violation_reported', {
        violation_id: uuidv4(),
        policy_id: policyId,
        asset_id: assetId,
        severity,
        detection_source: 'compliance_check',
        auto_remediated: false,
      });
      mpTrack(distinctId(req), 'policy_coverage_gap_detected', {
        asset_id: assetId,
        asset_type: 'api_endpoint',
        missing_frameworks: [fw],
        risk_level: severity,
      });
    }
    
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