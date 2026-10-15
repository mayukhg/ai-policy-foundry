import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';
import { validatePolicyRequest } from '../middleware/validation.js';
import { getStore, listValues } from '../data/syntheticStore.js';
import { v4 as uuidv4 } from 'uuid';
import { track as mpTrack } from '../utils/mixpanel.js';

function distinctId(req) {
  return req.user?.id || 'anonymous';
}

function policyCategoryFrom(policy, requirements) {
  const raw = (
    requirements?.policyType ||
    policy?.metadata?.policyType ||
    policy?.metadata?.name ||
    ''
  ).toLowerCase();
  if (raw.includes('privacy')) return 'data_privacy';
  if (raw.includes('access')) return 'access_control';
  if (raw.includes('bias') || raw.includes('fair')) return 'bias_fairness';
  if (raw.includes('transpar')) return 'transparency';
  if (raw.includes('retention') || raw.includes('incident')) return 'operational';
  if (raw.includes('model') || raw.includes('governance')) return 'model_governance';
  return 'security';
}

function frameworksFrom(policy, requirements) {
  const label = (
    requirements?.compliance ||
    policy?.compliance?.framework ||
    policy?.metadata?.compliance ||
    ''
  ).toLowerCase();
  if (label.includes('nist')) return ['nist_ai_rmf'];
  if (label.includes('iso')) return ['iso_42001'];
  if (label.includes('gdpr')) return ['gdpr'];
  if (label.includes('hipaa')) return ['hipaa'];
  return ['custom'];
}

const router = express.Router();

// GET /api/policies - Get all policies
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/policies - Retrieving all policies');
    const policies = listValues(getStore().policies).map((p) => {
      const complianceRaw = p.compliance ?? p.metadata?.compliance;
      const compliance =
        typeof complianceRaw === 'string'
          ? complianceRaw
          : complianceRaw?.framework || p.metadata?.compliance || '—';
      return {
        id: p.id,
        name: p.name || p.metadata?.name,
        service: p.service || p.metadata?.service,
        status: p.status || p.metadata?.status || 'draft',
        compliance,
        lastUpdated: p.lastUpdated || p.metadata?.generatedAt,
        risk: p.risk || p.metadata?.riskLevel || p.security?.riskAssessment?.riskLevel
      };
    });
    
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

// GET /api/policies/catalog - Rule catalog
router.get('/catalog', async (req, res) => {
  const catalog = listValues(getStore().ruleCatalog);
  res.json({ success: true, data: catalog, count: catalog.length });
});

// POST /api/policies/generate - Generate new policy
router.post('/generate', validatePolicyRequest, async (req, res) => {
  try {
    const { service, requirements, documentId } = req.body;
    
    logger.info(`POST /api/policies/generate - Generating policy for ${service}${documentId ? ` with document ${documentId}` : ''}`);
    
    // Get document context if documentId is provided
    let documentContext = null;
    if (documentId) {
      try {
        const documentIngestionService = (await import('../services/DocumentIngestionService.js')).default;
        const userId = req.user?.id || 'anonymous';
        documentContext = await documentIngestionService.buildContextSummary(documentId);
      } catch (error) {
        logger.warn(`Failed to load document context ${documentId}:`, error);
        // Continue without document context if it fails
      }
    }
    
    // Generate policy using agent system
    const policy = await agentManager.generatePolicy(service, requirements, documentContext);

    const category = policyCategoryFrom(policy, requirements);
    const frameworks = frameworksFrom(policy, requirements);
    const policyId = policy?.id || uuidv4();

    mpTrack(distinctId(req), 'policy_drafted', {
      policy_id: policyId,
      policy_name: policy?.metadata?.name || `${service} policy`,
      policy_category: category,
      frameworks,
      scope: requirements?.businessUnit ? 'department' : 'global',
      author_role: req.user?.role || 'policy_author',
    });
    mpTrack(distinctId(req), 'framework_mapped', {
      policy_id: policyId,
      framework: frameworks[0],
      control_count: policy?.compliance?.controls?.length || 0,
      mapping_completeness: policy?.compliance?.controls?.length ? 85 : 60,
    });
    
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
    const policy = getStore().policies.get(id);
    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    logger.error(`Failed to retrieve policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy',
      message: error.message
    });
  }
});

// POST /api/policies/:id/review - submit/approve/reject
router.post('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body;
    const store = getStore();
    const policy = store.policies.get(id);
    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    const statusMap = {
      submit: 'pending_review',
      approve: 'approved',
      reject: 'rejected'
    };
    if (!statusMap[action]) {
      return res.status(400).json({ success: false, error: 'action must be submit|approve|reject' });
    }

    policy.status = statusMap[action];
    policy.lastUpdated = new Date().toISOString();
    store.policies.set(id, policy);

    const event = {
      id: uuidv4(),
      policyId: id,
      action,
      status: policy.status,
      comment: comment || '',
      actor: req.user?.id || 'demo-user',
      timestamp: new Date().toISOString()
    };
    const events = store.reviews.get(id) || [];
    events.push(event);
    store.reviews.set(id, events);

    if (store.ruleCatalog.has(id)) {
      const entry = store.ruleCatalog.get(id);
      entry.status = policy.status;
      store.ruleCatalog.set(id, entry);
    }

    const category = policyCategoryFrom(policy);
    const frameworks = frameworksFrom(policy);
    const role = req.user?.role || 'policy_reviewer';

    if (action === 'submit') {
      mpTrack(distinctId(req), 'policy_submitted_for_review', {
        policy_id: id,
        policy_category: category,
        frameworks,
        reviewer_count: 1,
        draft_duration_hours: 1,
      });
      mpTrack(distinctId(req), 'policy_review_requested', {
        policy_id: id,
        reviewer_role: 'compliance',
        urgency: 'standard',
      });
      if (comment) {
        mpTrack(distinctId(req), 'policy_comment_added', {
          policy_id: id,
          comment_type: 'approval_note',
          author_role: role,
        });
      }
    } else if (action === 'approve') {
      mpTrack(distinctId(req), 'policy_approved', {
        policy_id: id,
        policy_category: category,
        frameworks,
        review_duration_hours: 1,
        reviewer_role: role,
        revision_count: 0,
      });
      mpTrack(distinctId(req), 'policy_published', {
        policy_id: id,
        policy_category: category,
        frameworks,
        scope: 'global',
        asset_types_covered: ['api_endpoint'],
        total_lifecycle_hours: 2,
      });
      mpTrack(distinctId(req), 'policy_enforced', {
        policy_id: id,
        policy_category: category,
        enforcement_mode: 'soft_warn',
        assets_in_scope: 1,
      });
    } else if (action === 'reject') {
      mpTrack(distinctId(req), 'policy_rejected', {
        policy_id: id,
        policy_category: category,
        rejection_reason: comment ? 'other' : 'incomplete',
        reviewer_role: role,
      });
    }

    res.json({ success: true, data: { policy, review: event } });
  } catch (error) {
    logger.error('Review failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/reviews', async (req, res) => {
  const events = getStore().reviews.get(req.params.id) || [];
  res.json({ success: true, data: events });
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

    const changedFields = Object.keys(updates || {}).filter((k) => k !== 'lastUpdated');
    mpTrack(distinctId(req), 'policy_updated', {
      policy_id: id,
      policy_category: policyCategoryFrom(updatedPolicy),
      change_type: changedFields.length > 2 ? 'major' : 'minor',
      fields_changed: changedFields,
    });
    
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

    mpTrack(distinctId(req), 'policy_deprecated', {
      policy_id: id,
      policy_category: 'security',
      reason: 'business_change',
      replaced_by_policy_id: null,
    });
    
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

// POST /api/policies/:id/export - Export policy
router.post('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body; // 'pdf', 'docx', 'text', 'yaml', 'rego'
    
    logger.info(`POST /api/policies/${id}/export - Exporting policy as ${format}`);
    
    const stored = getStore().policies.get(id);
    const policy = stored || {
      id,
      metadata: { name: `${id}-security-policy`, service: 'AWS S3', compliance: 'CIS' },
      policy: `# ${id} Security Policy\napiVersion: v1\nkind: SecurityPolicy`,
      compliance: { framework: 'CIS' }
    };
    
    const exportService = (await import('../services/PolicyExportService.js')).default;
    const result = await exportService.exportPolicy(policy, format || 'yaml');

    const exportFormat = ['pdf', 'csv', 'json'].includes(format) ? format : 'json';
    mpTrack(distinctId(req), 'audit_report_generated', {
      report_id: uuidv4(),
      report_type: 'framework_specific',
      frameworks_included: frameworksFrom(policy),
      format: exportFormat,
      time_range_days: 30,
      triggered_by: 'manual',
    });
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
    
  } catch (error) {
    logger.error(`Failed to export policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to export policy',
      message: error.message
    });
  }
});

// POST /api/policies/:id/feedback - Submit feedback on policy
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments, accuracy, suggestions } = req.body;
    const userId = req.user?.id || 'anonymous';
    
    logger.info(`POST /api/policies/${id}/feedback - User feedback submitted`);
    
    // In production, store feedback in database
    const feedback = {
      policyId: id,
      userId: userId,
      rating: rating,
      comments: comments,
      accuracy: accuracy,
      suggestions: suggestions,
      submittedAt: new Date().toISOString()
    };
    
    // Log feedback (in production, save to database)
    logger.info('Policy feedback received:', feedback);
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback
    });
    
  } catch (error) {
    logger.error(`Failed to submit feedback for policy ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
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