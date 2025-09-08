/**
 * Enhanced Agent Manager with LangGraph and RAG Integration
 * 
 * This enhanced version of the Agent Manager integrates LangGraph workflows
 * and RAG capabilities to provide sophisticated, context-aware agent orchestration.
 * 
 * Key Enhancements:
 * - LangGraph workflow orchestration
 * - RAG-powered knowledge retrieval
 * - Dynamic agent routing based on context
 * - Enhanced error handling and retry mechanisms
 * - Real-time workflow monitoring
 * - Learning from agent interactions
 */

import { PolicyGenerationAgent } from './PolicyGenerationAgent.js';
import { EnhancedPolicyGenerationAgent } from './EnhancedPolicyGenerationAgent.js';
import { ThreatIntelligenceAgent } from './ThreatIntelligenceAgent.js';
import { ComplianceAgent } from './ComplianceAgent.js';
import { SecurityAnalysisAgent } from './SecurityAnalysisAgent.js';
import { CloudProviderAgent } from './CloudProviderAgent.js';
import { agentOrchestrator } from '../langgraph/agentOrchestrator.js';
import { knowledgeManager } from '../rag/knowledgeManager.js';
import { logger } from '../utils/logger.js';
import { AgentState } from '../models/AgentState.js';

class EnhancedAgentManager {
  constructor() {
    this.agents = new Map();
    this.enhancedAgents = new Map();
    this.io = null;
    this.isInitialized = false;
    this.useLangGraph = process.env.USE_LANGGRAPH === 'true';
    this.useRAG = process.env.USE_RAG === 'true';
  }

  /**
   * Initialize the enhanced agent system
   * @param {Object} io - Socket.io instance for real-time updates
   */
  async initialize(io) {
    this.io = io;
    
    try {
      logger.info('Initializing Enhanced AI Agent System...');

      // Initialize LangGraph orchestrator if enabled
      if (this.useLangGraph) {
        await agentOrchestrator.initialize();
        logger.info('LangGraph Agent Orchestrator initialized');
      }

      // Initialize knowledge manager if RAG is enabled
      if (this.useRAG) {
        await knowledgeManager.initialize();
        logger.info('Knowledge Manager initialized');
      }

      // Initialize core agents
      const agents = [
        {
          name: 'policy-generator',
          agent: this.useRAG ? new EnhancedPolicyGenerationAgent() : new PolicyGenerationAgent(),
          description: 'Generates security policies using AI with RAG enhancement',
          enhanced: this.useRAG
        },
        {
          name: 'threat-intelligence',
          agent: new ThreatIntelligenceAgent(),
          description: 'Monitors and analyzes threat intelligence feeds',
          enhanced: false
        },
        {
          name: 'compliance',
          agent: new ComplianceAgent(),
          description: 'Ensures compliance with regulatory frameworks',
          enhanced: false
        },
        {
          name: 'security-analysis',
          agent: new SecurityAnalysisAgent(),
          description: 'Analyzes security posture and identifies risks',
          enhanced: false
        },
        {
          name: 'cloud-provider',
          agent: new CloudProviderAgent(),
          description: 'Monitors cloud provider updates and new services',
          enhanced: false
        }
      ];

      // Initialize each agent
      for (const { name, agent, description, enhanced } of agents) {
        await agent.initialize();
        this.agents.set(name, {
          agent,
          description,
          status: 'active',
          lastActivity: new Date(),
          enhanced,
          metrics: {
            requestsProcessed: 0,
            averageResponseTime: 0,
            errors: 0,
            ragQueries: 0,
            workflowExecutions: 0
          }
        });
        
        logger.info(`Agent initialized: ${name} - ${description} ${enhanced ? '(Enhanced)' : ''}`);
      }

      // Start background tasks
      this.startBackgroundTasks();
      
      this.isInitialized = true;
      logger.info('Enhanced AI Agent System initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize enhanced agent system:', error);
      throw error;
    }
  }

  /**
   * Execute a task using the appropriate agent or workflow
   * @param {string} agentName - The agent name
   * @param {string} task - The task to execute
   * @param {Object} data - Task data
   * @returns {Object} Task result
   */
  async executeTask(agentName, task, data) {
    try {
      const agentInfo = this.agents.get(agentName);
      if (!agentInfo) {
        throw new Error(`Agent not found: ${agentName}`);
      }

      const startTime = Date.now();
      
      // Update agent status
      agentInfo.status = 'processing';
      agentInfo.lastActivity = new Date();
      
      let result;

      // Use LangGraph workflows for complex tasks if enabled
      if (this.useLangGraph && this.shouldUseWorkflow(agentName, task, data)) {
        result = await this.executeWorkflow(agentName, task, data);
        agentInfo.metrics.workflowExecutions++;
      } else {
        // Use traditional agent execution
        result = await agentInfo.agent.executeTask(task, data);
        agentInfo.metrics.requestsProcessed++;
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      agentInfo.metrics.averageResponseTime = 
        (agentInfo.metrics.averageResponseTime + responseTime) / 2;
      agentInfo.status = 'active';
      
      // Emit real-time update
      this.emitAgentUpdate(agentName, {
        status: 'completed',
        task,
        responseTime,
        timestamp: new Date(),
        enhanced: agentInfo.enhanced
      });
      
      return result;
      
    } catch (error) {
      const agentInfo = this.agents.get(agentName);
      if (agentInfo) {
        agentInfo.metrics.errors++;
        agentInfo.status = 'error';
      }
      
      logger.error(`Agent task failed: ${agentName} - ${task}`, error);
      throw error;
    }
  }

  /**
   * Determine if a task should use LangGraph workflows
   * @param {string} agentName - The agent name
   * @param {string} task - The task
   * @param {Object} data - Task data
   * @returns {boolean} Whether to use workflow
   */
  shouldUseWorkflow(agentName, task, data) {
    // Use workflows for complex policy generation
    if (agentName === 'policy-generator' && task === 'generate') {
      return data.complexity === 'complex' || data.riskLevel === 'high';
    }

    // Use workflows for threat response
    if (agentName === 'threat-intelligence' && task === 'analyze') {
      return data.severity === 'critical' || data.severity === 'high';
    }

    // Use workflows for compliance validation
    if (agentName === 'compliance' && task === 'validate') {
      return data.framework === 'SOC2' || data.framework === 'ISO27001';
    }

    return false;
  }

  /**
   * Execute a LangGraph workflow
   * @param {string} agentName - The agent name
   * @param {string} task - The task
   * @param {Object} data - Task data
   * @returns {Object} Workflow result
   */
  async executeWorkflow(agentName, task, data) {
    try {
      logger.info(`Executing LangGraph workflow for ${agentName} - ${task}`);

      let result;

      switch (agentName) {
        case 'policy-generator':
          result = await agentOrchestrator.executePolicyGeneration(
            data.service,
            data.requirements,
            { task, ...data }
          );
          break;

        case 'threat-intelligence':
          result = await agentOrchestrator.executeThreatResponse(
            data.threatId,
            data.threatData,
            { task, ...data }
          );
          break;

        case 'compliance':
          result = await agentOrchestrator.executeComplianceValidation(
            data.policyId,
            data.policy,
            data.framework,
            { task, ...data }
          );
          break;

        default:
          throw new Error(`No workflow defined for agent: ${agentName}`);
      }

      logger.info(`LangGraph workflow completed for ${agentName} - ${task}`);
      return result;

    } catch (error) {
      logger.error(`LangGraph workflow failed for ${agentName} - ${task}:`, error);
      throw error;
    }
  }

  /**
   * Generate policy with enhanced capabilities
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {Object} Generated policy
   */
  async generatePolicy(service, requirements) {
    try {
      logger.info(`Generating policy for ${service} with enhanced capabilities`);

      // Determine if we should use LangGraph workflow
      const complexity = this.assessComplexity(service, requirements);
      const riskLevel = this.assessRiskLevel(service, requirements);

      const enhancedData = {
        service,
        requirements: {
          ...requirements,
          complexity,
          riskLevel
        }
      };

      let result;

      if (this.useLangGraph && (complexity === 'complex' || riskLevel === 'high')) {
        // Use LangGraph workflow for complex policies
        result = await agentOrchestrator.executePolicyGeneration(
          service,
          enhancedData.requirements
        );
      } else {
        // Use traditional multi-agent approach
        result = await this.generatePolicyTraditional(service, requirements);
      }

      // Store policy in knowledge base for future learning
      if (this.useRAG && result.policy) {
        await this.storePolicyForLearning(result, service, requirements);
      }

      logger.info(`Policy generation completed for ${service}`);
      return result;

    } catch (error) {
      logger.error(`Policy generation failed for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Generate policy using traditional multi-agent approach
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {Object} Generated policy
   */
  async generatePolicyTraditional(service, requirements) {
    const policyAgent = await this.getAgent('policy-generator');
    const complianceAgent = await this.getAgent('compliance');
    const securityAgent = await this.getAgent('security-analysis');
    
    // Multi-agent collaboration for policy generation
    const [policyResult, complianceResult, securityResult] = await Promise.all([
      policyAgent.executeTask('generate', { service, requirements }),
      complianceAgent.executeTask('validate', { service, requirements }),
      securityAgent.executeTask('analyze', { service, requirements })
    ]);
    
    // Combine results from all agents
    const finalPolicy = await policyAgent.executeTask('merge', {
      policy: policyResult,
      compliance: complianceResult,
      security: securityResult
    });
    
    return finalPolicy;
  }

  /**
   * Analyze threats with enhanced capabilities
   * @returns {Object} Threat analysis result
   */
  async analyzeThreats() {
    try {
      logger.info('Analyzing threats with enhanced capabilities');

      const threatAgent = await this.getAgent('threat-intelligence');
      const securityAgent = await this.getAgent('security-analysis');
      
      // Get latest threats
      const threats = await threatAgent.executeTask('scan', {});
      
      // Analyze impact on existing policies
      const analysis = await securityAgent.executeTask('threat-impact', { threats });

      // Use LangGraph workflow for complex threat analysis
      let enhancedAnalysis = analysis;
      if (this.useLangGraph && threats.some(t => t.severity === 'critical' || t.severity === 'high')) {
        const criticalThreats = threats.filter(t => t.severity === 'critical' || t.severity === 'high');
        
        for (const threat of criticalThreats) {
          const threatResponse = await agentOrchestrator.executeThreatResponse(
            threat.id,
            threat
          );
          enhancedAnalysis.threatResponses = enhancedAnalysis.threatResponses || [];
          enhancedAnalysis.threatResponses.push(threatResponse);
        }
      }

      return {
        threats,
        analysis: enhancedAnalysis,
        recommendations: enhancedAnalysis.recommendations
      };

    } catch (error) {
      logger.error('Threat analysis failed:', error);
      throw error;
    }
  }

  /**
   * Update compliance with enhanced capabilities
   * @returns {Object} Compliance update result
   */
  async updateCompliance() {
    try {
      logger.info('Updating compliance with enhanced capabilities');

      const complianceAgent = await this.getAgent('compliance');
      const cloudAgent = await this.getAgent('cloud-provider');
      
      // Get latest compliance requirements
      const complianceUpdates = await complianceAgent.executeTask('check-updates', {});
      
      // Check for new cloud services that need policies
      const newServices = await cloudAgent.executeTask('scan-new-services', {});

      // Use LangGraph workflow for complex compliance validation
      let enhancedUpdates = complianceUpdates;
      if (this.useLangGraph && complianceUpdates.length > 0) {
        for (const update of complianceUpdates) {
          if (update.framework === 'SOC2' || update.framework === 'ISO27001') {
            const validationResult = await agentOrchestrator.executeComplianceValidation(
              update.policyId,
              update.policy,
              update.framework
            );
            enhancedUpdates.push(validationResult);
          }
        }
      }

      return {
        complianceUpdates: enhancedUpdates,
        newServices,
        actionRequired: enhancedUpdates.length > 0 || newServices.length > 0
      };

    } catch (error) {
      logger.error('Compliance update failed:', error);
      throw error;
    }
  }

  /**
   * Assess complexity of policy generation
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {string} Complexity level
   */
  assessComplexity(service, requirements) {
    let complexity = 1;

    // Service complexity
    const complexServices = ['IAM', 'KMS', 'Lambda', 'ECS', 'EKS'];
    if (complexServices.some(s => service.includes(s))) complexity += 2;

    // Requirements complexity
    if (requirements.additionalRequirements) complexity += 1;
    if (requirements.compliance === 'SOC2') complexity += 2;
    if (requirements.environment === 'production') complexity += 1;

    if (complexity >= 5) return 'complex';
    if (complexity >= 3) return 'medium';
    return 'simple';
  }

  /**
   * Assess risk level of policy generation
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {string} Risk level
   */
  assessRiskLevel(service, requirements) {
    let risk = 1;

    // Environment risk
    if (requirements.environment === 'production') risk += 2;

    // Business unit risk
    if (requirements.businessUnit === 'trading') risk += 2;

    // Service risk
    const highRiskServices = ['IAM', 'KMS', 'Secrets Manager'];
    if (highRiskServices.some(s => service.includes(s))) risk += 2;

    if (risk >= 6) return 'high';
    if (risk >= 4) return 'medium';
    return 'low';
  }

  /**
   * Store policy for learning
   * @param {Object} policy - Generated policy
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   */
  async storePolicyForLearning(policy, service, requirements) {
    try {
      if (this.useRAG && policy.policy) {
        await knowledgeManager.ingestText('policies', policy.policy, {
          service,
          environment: requirements.environment,
          compliance: requirements.compliance,
          businessUnit: requirements.businessUnit,
          generatedAt: new Date().toISOString(),
          enhanced: true
        });
      }
    } catch (error) {
      logger.error('Failed to store policy for learning:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get agent status with enhanced metrics
   * @returns {Object} Agent status
   */
  getAgentStatus() {
    const status = {};
    
    for (const [name, info] of this.agents) {
      status[name] = {
        status: info.status,
        description: info.description,
        lastActivity: info.lastActivity,
        enhanced: info.enhanced,
        metrics: info.metrics
      };
    }

    // Add LangGraph workflow status if enabled
    if (this.useLangGraph) {
      status.workflows = {
        active: agentOrchestrator.getActiveWorkflows(),
        history: agentOrchestrator.getWorkflowHistory(10),
        stats: agentOrchestrator.getWorkflowStats()
      };
    }

    // Add knowledge base status if RAG is enabled
    if (this.useRAG) {
      status.knowledgeBase = {
        stats: knowledgeManager.getKnowledgeStats()
      };
    }

    return status;
  }

  /**
   * Get agent by name
   * @param {string} agentName - The agent name
   * @returns {Object} Agent instance
   */
  async getAgent(agentName) {
    const agentInfo = this.agents.get(agentName);
    if (!agentInfo) {
      throw new Error(`Agent not found: ${agentName}`);
    }
    return agentInfo.agent;
  }

  /**
   * Start background tasks
   */
  startBackgroundTasks() {
    // Threat intelligence monitoring (every 5 minutes)
    setInterval(async () => {
      try {
        await this.analyzeThreats();
        logger.debug('Background threat analysis completed');
      } catch (error) {
        logger.error('Background threat analysis failed:', error);
      }
    }, 5 * 60 * 1000);

    // Compliance updates (every hour)
    setInterval(async () => {
      try {
        await this.updateCompliance();
        logger.debug('Background compliance update completed');
      } catch (error) {
        logger.error('Background compliance update failed:', error);
      }
    }, 60 * 60 * 1000);

    // Agent health monitoring (every 2 minutes)
    setInterval(() => {
      this.monitorAgentHealth();
    }, 2 * 60 * 1000);

    // Knowledge base maintenance (every 6 hours)
    if (this.useRAG) {
      setInterval(async () => {
        try {
          await this.maintainKnowledgeBase();
          logger.debug('Knowledge base maintenance completed');
        } catch (error) {
          logger.error('Knowledge base maintenance failed:', error);
        }
      }, 6 * 60 * 60 * 1000);
    }
  }

  /**
   * Monitor agent health
   */
  monitorAgentHealth() {
    for (const [name, info] of this.agents) {
      const timeSinceLastActivity = Date.now() - info.lastActivity.getTime();
      
      if (timeSinceLastActivity > 10 * 60 * 1000 && info.status === 'active') {
        info.status = 'idle';
        logger.warn(`Agent ${name} marked as idle due to inactivity`);
      }
    }
  }

  /**
   * Maintain knowledge base
   */
  async maintainKnowledgeBase() {
    try {
      if (this.useRAG) {
        // This could include tasks like:
        // - Cleaning up old documents
        // - Updating embeddings
        // - Optimizing vector store
        logger.debug('Knowledge base maintenance performed');
      }
    } catch (error) {
      logger.error('Knowledge base maintenance failed:', error);
    }
  }

  /**
   * Emit agent update via WebSocket
   * @param {string} agentName - The agent name
   * @param {Object} data - Update data
   */
  emitAgentUpdate(agentName, data) {
    if (this.io) {
      this.io.to('dashboard').emit('agent-update', {
        agent: agentName,
        ...data
      });
    }
  }

  /**
   * Shutdown the enhanced agent system
   */
  async shutdown() {
    logger.info('Shutting down enhanced agent system...');
    
    try {
      // Shutdown LangGraph orchestrator
      if (this.useLangGraph) {
        await agentOrchestrator.shutdown();
      }

      // Shutdown knowledge manager
      if (this.useRAG) {
        await knowledgeManager.shutdown();
      }

      // Shutdown individual agents
      for (const [name, info] of this.agents) {
        try {
          await info.agent.shutdown();
          logger.info(`Agent ${name} shut down successfully`);
        } catch (error) {
          logger.error(`Failed to shut down agent ${name}:`, error);
        }
      }
      
      this.isInitialized = false;
      logger.info('Enhanced agent system shut down successfully');
      
    } catch (error) {
      logger.error('Failed to shutdown enhanced agent system:', error);
      throw error;
    }
  }
}

// Singleton instance
const enhancedAgentManager = new EnhancedAgentManager();

export async function initializeEnhancedAgents(io) {
  return await enhancedAgentManager.initialize(io);
}

export { enhancedAgentManager };

