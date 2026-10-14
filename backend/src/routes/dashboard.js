import express from 'express';
import { agentManager } from '../agents/agentManager.js';
import { logger } from '../utils/logger.js';
import { getStore } from '../data/syntheticStore.js';

const router = express.Router();

// GET /api/dashboard/overview - Get dashboard overview
router.get('/overview', async (req, res) => {
  try {
    logger.info('GET /api/dashboard/overview - Retrieving dashboard overview');
    
    const agentStatus = agentManager.getAgentStatus();
    const seeded = getStore().dashboard.overview || {};
    const stats = {
      activePolicies: seeded.activePolicies ?? 0,
      pendingReviews: seeded.pendingReviews ?? 0,
      complianceScore: seeded.complianceScore ?? 0,
      threatDetections: seeded.threatDetections ?? 0,
      draftPolicies: seeded.draftPolicies ?? 0,
      rejectedPolicies: seeded.rejectedPolicies ?? 0,
      frameworkDrift: seeded.frameworkDrift ?? 0,
      agentStatus,
      pipeline: agentManager.getPipelineProgress(),
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Failed to retrieve dashboard overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard overview',
      message: error.message
    });
  }
});

// GET /api/dashboard/recent-activity - Get recent activity
router.get('/recent-activity', async (req, res) => {
  try {
    logger.info('GET /api/dashboard/recent-activity - Retrieving recent activity');
    const activities = getStore().dashboard.activity || [];
    res.json({
      success: true,
      data: activities
    });
    
  } catch (error) {
    logger.error('Failed to retrieve recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent activity',
      message: error.message
    });
  }
});

// GET /api/dashboard/alerts - Get active alerts
router.get('/alerts', async (req, res) => {
  try {
    logger.info('GET /api/dashboard/alerts - Retrieving active alerts');
    const seededAlerts = getStore().dashboard.alerts;
    if (seededAlerts?.length) {
      return res.json({ success: true, data: seededAlerts });
    }
    const alerts = [
      {
        id: 'alert-001',
        severity: 'high',
        title: 'New Critical Vulnerability Detected',
        description: 'CVE-2024-8472 affects Kubernetes API Server',
        timestamp: new Date().toISOString(),
        status: 'investigating',
        affectedServices: ['Kubernetes', 'Container Registry']
      },
      {
        id: 'alert-002',
        severity: 'medium',
        title: 'Policy Compliance Warning',
        description: '3 policies need compliance review',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        affectedServices: ['AWS S3', 'Azure Storage']
      }
    ];
    
    res.json({
      success: true,
      data: alerts
    });
    
  } catch (error) {
    logger.error('Failed to retrieve alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
});

// GET /api/dashboard/performance - Get performance metrics
router.get('/performance', async (req, res) => {
  try {
    logger.info('GET /api/dashboard/performance - Retrieving performance metrics');
    
    // Get performance metrics from agent system
    const performance = {
      policyGenerationTime: {
        average: 2.3, // minutes
        trend: 'decreasing',
        lastWeek: 3.1,
        thisWeek: 2.3
      },
      threatResponseTime: {
        average: 15, // minutes
        trend: 'stable',
        lastWeek: 16,
        thisWeek: 15
      },
      complianceScore: {
        current: 94,
        trend: 'increasing',
        lastWeek: 92,
        thisWeek: 94
      },
      systemUptime: {
        current: 99.9,
        trend: 'stable',
        lastWeek: 99.8,
        thisWeek: 99.9
      }
    };
    
    res.json({
      success: true,
      data: performance
    });
    
  } catch (error) {
    logger.error('Failed to retrieve performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
      message: error.message
    });
  }
});

// GET /api/dashboard/agents - Get agent status
router.get('/agents', async (req, res) => {
  try {
    logger.info('GET /api/dashboard/agents - Retrieving agent status');
    
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

export default router; 