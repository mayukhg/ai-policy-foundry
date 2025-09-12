import express from 'express';
import { evaluationHarness } from '../evaluation/EvaluationHarness.js';
import { monitoringService } from '../monitoring/MonitoringService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Evaluation Routes
 * Provides endpoints for running evaluations and accessing results
 */

// Initialize evaluation harness
router.use(async (req, res, next) => {
  try {
    if (!evaluationHarness.isInitialized) {
      await evaluationHarness.initialize();
    }
    next();
  } catch (error) {
    logger.error('Failed to initialize evaluation harness:', error);
    res.status(500).json({ error: 'Evaluation system unavailable' });
  }
});

/**
 * Run comprehensive evaluation
 * POST /api/evaluation/run
 */
router.post('/run', async (req, res) => {
  try {
    const {
      agents = ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'],
      testTypes = ['accuracy', 'latency', 'hallucination'],
      iterations = 10
    } = req.body;

    logger.info(`Starting evaluation: agents=${agents.join(',')}, types=${testTypes.join(',')}, iterations=${iterations}`);

    const results = await evaluationHarness.runEvaluation({
      agents,
      testTypes,
      iterations
    });

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Evaluation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Run quick evaluation
 * POST /api/evaluation/quick
 */
router.post('/quick', async (req, res) => {
  try {
    const {
      agents = ['policy-generator'],
      testTypes = ['accuracy'],
      iterations = 3
    } = req.body;

    logger.info(`Starting quick evaluation: agents=${agents.join(',')}`);

    const results = await evaluationHarness.runEvaluation({
      agents,
      testTypes,
      iterations
    });

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Quick evaluation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get evaluation metrics
 * GET /api/evaluation/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = evaluationHarness.getMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get evaluation metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get evaluation results history
 * GET /api/evaluation/results
 */
router.get('/results', async (req, res) => {
  try {
    const { limit = 10, agent } = req.query;
    
    // This would typically read from a database or file system
    // For now, return a placeholder response
    res.json({
      success: true,
      results: [],
      message: 'Results history endpoint - implementation needed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get evaluation results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate evaluation report
 * POST /api/evaluation/report
 */
router.post('/report', async (req, res) => {
  try {
    const { evaluationResults } = req.body;
    
    if (!evaluationResults) {
      return res.status(400).json({
        success: false,
        error: 'evaluationResults is required'
      });
    }

    const report = await evaluationHarness.generateReport(evaluationResults);
    
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate evaluation report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get test cases for an agent
 * GET /api/evaluation/test-cases/:agent
 */
router.get('/test-cases/:agent', async (req, res) => {
  try {
    const { agent } = req.params;
    
    // This would typically read from the test cases files
    // For now, return a placeholder response
    res.json({
      success: true,
      agent,
      testCases: [],
      message: 'Test cases endpoint - implementation needed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get test cases:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get benchmarks
 * GET /api/evaluation/benchmarks
 */
router.get('/benchmarks', async (req, res) => {
  try {
    const metrics = evaluationHarness.getMetrics();
    const benchmarks = metrics.benchmarks || {};
    
    res.json({
      success: true,
      benchmarks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get benchmarks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
