/**
 * LangGraph Agent Orchestrator
 * 
 * This module provides a sophisticated agent orchestration system using LangGraph
 * to manage complex, multi-step workflows with dynamic routing and state management.
 * 
 * Key Features:
 * - Dynamic workflow execution based on context
 * - State management across agent interactions
 * - Error handling and retry mechanisms
 * - Real-time workflow monitoring
 * - Integration with existing agent system
 */

import { 
  policyGenerationWorkflow, 
  threatResponseWorkflow, 
  complianceValidationWorkflow,
  PolicyGenerationState,
  ThreatResponseState,
  ComplianceValidationState
} from './workflows.js';
import { knowledgeManager } from '../rag/knowledgeManager.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class LangGraphAgentOrchestrator {
  constructor() {
    this.workflows = {
      policyGeneration: policyGenerationWorkflow,
      threatResponse: threatResponseWorkflow,
      complianceValidation: complianceValidationWorkflow
    };
    
    this.activeWorkflows = new Map();
    this.workflowHistory = [];
    this.isInitialized = false;
  }

  /**
   * Initialize the orchestrator
   */
  async initialize() {
    try {
      logger.info('Initializing LangGraph Agent Orchestrator...');

      // Initialize knowledge manager
      await knowledgeManager.initialize();

      this.isInitialized = true;
      logger.info('LangGraph Agent Orchestrator initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize LangGraph Agent Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Execute a policy generation workflow
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @param {Object} options - Execution options
   * @returns {Object} Workflow execution result
   */
  async executePolicyGeneration(service, requirements, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LangGraph Agent Orchestrator not initialized');
    }

    try {
      logger.info(`Starting policy generation workflow for ${service}`);

      const workflowId = uuidv4();
      const state = new PolicyGenerationState();
      
      // Initialize state
      state.service = service;
      state.requirements = requirements;
      state.metadata.workflowId = workflowId;
      state.metadata.startTime = new Date().toISOString();

      // Track active workflow
      this.activeWorkflows.set(workflowId, {
        type: 'policyGeneration',
        state,
        startTime: new Date(),
        status: 'running'
      });

      // Execute workflow
      const result = await this.workflows.policyGeneration.invoke(state, {
        configurable: {
          thread_id: workflowId
        }
      });

      // Update workflow status
      const workflow = this.activeWorkflows.get(workflowId);
      workflow.status = 'completed';
      workflow.endTime = new Date();
      workflow.result = result;

      // Move to history
      this.workflowHistory.push(workflow);
      this.activeWorkflows.delete(workflowId);

      logger.info(`Policy generation workflow completed for ${service}`);
      
      return {
        workflowId,
        status: 'completed',
        result: result.policyDraft,
        metadata: result.metadata,
        confidence: result.confidenceScore,
        iterations: result.iterationCount
      };

    } catch (error) {
      logger.error(`Policy generation workflow failed for ${service}:`, error);
      
      // Update workflow status
      if (this.activeWorkflows.has(workflowId)) {
        const workflow = this.activeWorkflows.get(workflowId);
        workflow.status = 'failed';
        workflow.error = error.message;
        workflow.endTime = new Date();
        
        this.workflowHistory.push(workflow);
        this.activeWorkflows.delete(workflowId);
      }

      throw error;
    }
  }

  /**
   * Execute a threat response workflow
   * @param {string} threatId - The threat identifier
   * @param {Object} threatData - The threat data
   * @param {Object} options - Execution options
   * @returns {Object} Workflow execution result
   */
  async executeThreatResponse(threatId, threatData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LangGraph Agent Orchestrator not initialized');
    }

    try {
      logger.info(`Starting threat response workflow for ${threatId}`);

      const workflowId = uuidv4();
      const state = new ThreatResponseState();
      
      // Initialize state
      state.threatId = threatId;
      state.threatData = threatData;
      state.metadata.workflowId = workflowId;
      state.metadata.startTime = new Date().toISOString();

      // Track active workflow
      this.activeWorkflows.set(workflowId, {
        type: 'threatResponse',
        state,
        startTime: new Date(),
        status: 'running'
      });

      // Execute workflow
      const result = await this.workflows.threatResponse.invoke(state, {
        configurable: {
          thread_id: workflowId
        }
      });

      // Update workflow status
      const workflow = this.activeWorkflows.get(workflowId);
      workflow.status = 'completed';
      workflow.endTime = new Date();
      workflow.result = result;

      // Move to history
      this.workflowHistory.push(workflow);
      this.activeWorkflows.delete(workflowId);

      logger.info(`Threat response workflow completed for ${threatId}`);
      
      return {
        workflowId,
        status: 'completed',
        severity: result.severity,
        recommendations: result.recommendations,
        actions: result.actions,
        metadata: result.metadata
      };

    } catch (error) {
      logger.error(`Threat response workflow failed for ${threatId}:`, error);
      
      // Update workflow status
      if (this.activeWorkflows.has(workflowId)) {
        const workflow = this.activeWorkflows.get(workflowId);
        workflow.status = 'failed';
        workflow.error = error.message;
        workflow.endTime = new Date();
        
        this.workflowHistory.push(workflow);
        this.activeWorkflows.delete(workflowId);
      }

      throw error;
    }
  }

  /**
   * Execute a compliance validation workflow
   * @param {string} policyId - The policy identifier
   * @param {Object} policy - The policy to validate
   * @param {string} framework - The compliance framework
   * @param {Object} options - Execution options
   * @returns {Object} Workflow execution result
   */
  async executeComplianceValidation(policyId, policy, framework, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LangGraph Agent Orchestrator not initialized');
    }

    try {
      logger.info(`Starting compliance validation workflow for ${policyId}`);

      const workflowId = uuidv4();
      const state = new ComplianceValidationState();
      
      // Initialize state
      state.policyId = policyId;
      state.policy = policy;
      state.framework = framework;
      state.metadata.workflowId = workflowId;
      state.metadata.startTime = new Date().toISOString();

      // Track active workflow
      this.activeWorkflows.set(workflowId, {
        type: 'complianceValidation',
        state,
        startTime: new Date(),
        status: 'running'
      });

      // Execute workflow
      const result = await this.workflows.complianceValidation.invoke(state, {
        configurable: {
          thread_id: workflowId
        }
      });

      // Update workflow status
      const workflow = this.activeWorkflows.get(workflowId);
      workflow.status = 'completed';
      workflow.endTime = new Date();
      workflow.result = result;

      // Move to history
      this.workflowHistory.push(workflow);
      this.activeWorkflows.delete(workflowId);

      logger.info(`Compliance validation workflow completed for ${policyId}`);
      
      return {
        workflowId,
        status: 'completed',
        framework: result.framework,
        validationResults: result.validationResults,
        gaps: result.gaps,
        recommendations: result.recommendations,
        metadata: result.metadata
      };

    } catch (error) {
      logger.error(`Compliance validation workflow failed for ${policyId}:`, error);
      
      // Update workflow status
      if (this.activeWorkflows.has(workflowId)) {
        const workflow = this.activeWorkflows.get(workflowId);
        workflow.status = 'failed';
        workflow.error = error.message;
        workflow.endTime = new Date();
        
        this.workflowHistory.push(workflow);
        this.activeWorkflows.delete(workflowId);
      }

      throw error;
    }
  }

  /**
   * Execute a custom workflow with dynamic routing
   * @param {string} workflowType - The type of workflow
   * @param {Object} input - Input data
   * @param {Object} options - Execution options
   * @returns {Object} Workflow execution result
   */
  async executeCustomWorkflow(workflowType, input, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LangGraph Agent Orchestrator not initialized');
    }

    const workflow = this.workflows[workflowType];
    if (!workflow) {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }

    try {
      logger.info(`Starting custom workflow: ${workflowType}`);

      const workflowId = uuidv4();
      
      // Track active workflow
      this.activeWorkflows.set(workflowId, {
        type: workflowType,
        input,
        startTime: new Date(),
        status: 'running'
      });

      // Execute workflow
      const result = await workflow.invoke(input, {
        configurable: {
          thread_id: workflowId
        }
      });

      // Update workflow status
      const workflowInfo = this.activeWorkflows.get(workflowId);
      workflowInfo.status = 'completed';
      workflowInfo.endTime = new Date();
      workflowInfo.result = result;

      // Move to history
      this.workflowHistory.push(workflowInfo);
      this.activeWorkflows.delete(workflowId);

      logger.info(`Custom workflow completed: ${workflowType}`);
      
      return {
        workflowId,
        status: 'completed',
        result,
        metadata: {
          workflowType,
          startTime: workflowInfo.startTime,
          endTime: workflowInfo.endTime
        }
      };

    } catch (error) {
      logger.error(`Custom workflow failed: ${workflowType}`, error);
      
      // Update workflow status
      if (this.activeWorkflows.has(workflowId)) {
        const workflowInfo = this.activeWorkflows.get(workflowId);
        workflowInfo.status = 'failed';
        workflowInfo.error = error.message;
        workflowInfo.endTime = new Date();
        
        this.workflowHistory.push(workflowInfo);
        this.activeWorkflows.delete(workflowId);
      }

      throw error;
    }
  }

  /**
   * Get the status of active workflows
   * @returns {Object} Status of all active workflows
   */
  getActiveWorkflows() {
    const active = {};
    
    for (const [workflowId, workflow] of this.activeWorkflows) {
      active[workflowId] = {
        type: workflow.type,
        status: workflow.status,
        startTime: workflow.startTime,
        duration: Date.now() - workflow.startTime.getTime()
      };
    }

    return active;
  }

  /**
   * Get workflow history
   * @param {number} limit - Maximum number of workflows to return
   * @returns {Array} Workflow history
   */
  getWorkflowHistory(limit = 50) {
    return this.workflowHistory
      .slice(-limit)
      .map(workflow => ({
        workflowId: workflow.metadata?.workflowId || 'unknown',
        type: workflow.type,
        status: workflow.status,
        startTime: workflow.startTime,
        endTime: workflow.endTime,
        duration: workflow.endTime ? 
          workflow.endTime.getTime() - workflow.startTime.getTime() : 
          Date.now() - workflow.startTime.getTime(),
        error: workflow.error
      }));
  }

  /**
   * Get workflow statistics
   * @returns {Object} Workflow statistics
   */
  getWorkflowStats() {
    const total = this.workflowHistory.length;
    const completed = this.workflowHistory.filter(w => w.status === 'completed').length;
    const failed = this.workflowHistory.filter(w => w.status === 'failed').length;
    const running = this.activeWorkflows.size;

    const avgDuration = this.workflowHistory
      .filter(w => w.endTime)
      .reduce((sum, w) => sum + (w.endTime.getTime() - w.startTime.getTime()), 0) / 
      Math.max(completed, 1);

    return {
      total,
      completed,
      failed,
      running,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      averageDuration: avgDuration,
      byType: this.getWorkflowStatsByType()
    };
  }

  /**
   * Get workflow statistics by type
   * @returns {Object} Statistics by workflow type
   */
  getWorkflowStatsByType() {
    const stats = {};
    
    for (const workflow of this.workflowHistory) {
      if (!stats[workflow.type]) {
        stats[workflow.type] = {
          total: 0,
          completed: 0,
          failed: 0,
          avgDuration: 0
        };
      }
      
      stats[workflow.type].total++;
      if (workflow.status === 'completed') stats[workflow.type].completed++;
      if (workflow.status === 'failed') stats[workflow.type].failed++;
    }

    // Calculate average duration for each type
    for (const type in stats) {
      const typeWorkflows = this.workflowHistory.filter(w => w.type === type && w.endTime);
      if (typeWorkflows.length > 0) {
        stats[type].avgDuration = typeWorkflows.reduce(
          (sum, w) => sum + (w.endTime.getTime() - w.startTime.getTime()), 0
        ) / typeWorkflows.length;
      }
    }

    return stats;
  }

  /**
   * Cancel a running workflow
   * @param {string} workflowId - The workflow ID to cancel
   * @returns {boolean} Whether the workflow was cancelled
   */
  async cancelWorkflow(workflowId) {
    if (!this.activeWorkflows.has(workflowId)) {
      return false;
    }

    try {
      const workflow = this.activeWorkflows.get(workflowId);
      workflow.status = 'cancelled';
      workflow.endTime = new Date();
      
      this.workflowHistory.push(workflow);
      this.activeWorkflows.delete(workflowId);

      logger.info(`Workflow ${workflowId} cancelled`);
      return true;

    } catch (error) {
      logger.error(`Failed to cancel workflow ${workflowId}:`, error);
      return false;
    }
  }

  /**
   * Get detailed information about a specific workflow
   * @param {string} workflowId - The workflow ID
   * @returns {Object} Detailed workflow information
   */
  getWorkflowDetails(workflowId) {
    // Check active workflows first
    if (this.activeWorkflows.has(workflowId)) {
      return this.activeWorkflows.get(workflowId);
    }

    // Check history
    const workflow = this.workflowHistory.find(w => 
      w.metadata?.workflowId === workflowId
    );

    return workflow || null;
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown() {
    logger.info('Shutting down LangGraph Agent Orchestrator...');
    
    try {
      // Cancel all active workflows
      for (const workflowId of this.activeWorkflows.keys()) {
        await this.cancelWorkflow(workflowId);
      }

      // Shutdown knowledge manager
      await knowledgeManager.shutdown();

      this.isInitialized = false;
      logger.info('LangGraph Agent Orchestrator shut down successfully');

    } catch (error) {
      logger.error('Failed to shutdown LangGraph Agent Orchestrator:', error);
      throw error;
    }
  }
}

// Singleton instance
export const agentOrchestrator = new LangGraphAgentOrchestrator();

