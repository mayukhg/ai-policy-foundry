import { PolicyGenerationAgent } from './PolicyGenerationAgent.js';
import { ThreatIntelligenceAgent } from './ThreatIntelligenceAgent.js';
import { ComplianceAgent } from './ComplianceAgent.js';
import { SecurityAnalysisAgent } from './SecurityAnalysisAgent.js';
import { CloudProviderAgent } from './CloudProviderAgent.js';
import { logger } from '../utils/logger.js';
import { AgentState } from '../models/AgentState.js';

class AgentManager {
  constructor() {
    this.agents = new Map();
    this.io = null;
    this.isInitialized = false;
  }

  async initialize(io) {
    this.io = io;
    
    try {
      logger.info('Initializing AI Agent System...');
      
      // Initialize core agents
      const agents = [
        {
          name: 'policy-generator',
          agent: new PolicyGenerationAgent(),
          description: 'Generates security policies using AI'
        },
        {
          name: 'threat-intelligence',
          agent: new ThreatIntelligenceAgent(),
          description: 'Monitors and analyzes threat intelligence feeds'
        },
        {
          name: 'compliance',
          agent: new ComplianceAgent(),
          description: 'Ensures compliance with regulatory frameworks'
        },
        {
          name: 'security-analysis',
          agent: new SecurityAnalysisAgent(),
          description: 'Analyzes security posture and identifies risks'
        },
        {
          name: 'cloud-provider',
          agent: new CloudProviderAgent(),
          description: 'Monitors cloud provider updates and new services'
        }
      ];

      // Initialize each agent
      for (const { name, agent, description } of agents) {
        await agent.initialize();
        this.agents.set(name, {
          agent,
          description,
          status: 'active',
          lastActivity: new Date(),
          metrics: {
            requestsProcessed: 0,
            averageResponseTime: 0,
            errors: 0
          }
        });
        
        logger.info(`Agent initialized: ${name} - ${description}`);
      }

      // Start background tasks
      this.startBackgroundTasks();
      
      this.isInitialized = true;
      logger.info('AI Agent System initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize agent system:', error);
      throw error;
    }
  }

  async getAgent(agentName) {
    const agentInfo = this.agents.get(agentName);
    if (!agentInfo) {
      throw new Error(`Agent not found: ${agentName}`);
    }
    return agentInfo.agent;
  }

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
      
      // Execute task
      const result = await agentInfo.agent.executeTask(task, data);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      agentInfo.metrics.requestsProcessed++;
      agentInfo.metrics.averageResponseTime = 
        (agentInfo.metrics.averageResponseTime + responseTime) / 2;
      agentInfo.status = 'active';
      
      // Emit real-time update
      this.emitAgentUpdate(agentName, {
        status: 'completed',
        task,
        responseTime,
        timestamp: new Date()
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

  async generatePolicy(service, requirements) {
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

  async analyzeThreats() {
    const threatAgent = await this.getAgent('threat-intelligence');
    const securityAgent = await this.getAgent('security-analysis');
    
    // Get latest threats
    const threats = await threatAgent.executeTask('scan', {});
    
    // Analyze impact on existing policies
    const analysis = await securityAgent.executeTask('threat-impact', { threats });
    
    return {
      threats,
      analysis,
      recommendations: analysis.recommendations
    };
  }

  async updateCompliance() {
    const complianceAgent = await this.getAgent('compliance');
    const cloudAgent = await this.getAgent('cloud-provider');
    
    // Get latest compliance requirements
    const complianceUpdates = await complianceAgent.executeTask('check-updates', {});
    
    // Check for new cloud services that need policies
    const newServices = await cloudAgent.executeTask('scan-new-services', {});
    
    return {
      complianceUpdates,
      newServices,
      actionRequired: complianceUpdates.length > 0 || newServices.length > 0
    };
  }

  getAgentStatus() {
    const status = {};
    for (const [name, info] of this.agents) {
      status[name] = {
        status: info.status,
        description: info.description,
        lastActivity: info.lastActivity,
        metrics: info.metrics
      };
    }
    return status;
  }

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
  }

  monitorAgentHealth() {
    for (const [name, info] of this.agents) {
      const timeSinceLastActivity = Date.now() - info.lastActivity.getTime();
      
      // If agent hasn't been active for more than 10 minutes, mark as idle
      if (timeSinceLastActivity > 10 * 60 * 1000 && info.status === 'active') {
        info.status = 'idle';
        logger.warn(`Agent ${name} marked as idle due to inactivity`);
      }
    }
  }

  emitAgentUpdate(agentName, data) {
    if (this.io) {
      this.io.to('dashboard').emit('agent-update', {
        agent: agentName,
        ...data
      });
    }
  }

  async shutdown() {
    logger.info('Shutting down agent system...');
    
    for (const [name, info] of this.agents) {
      try {
        await info.agent.shutdown();
        logger.info(`Agent ${name} shut down successfully`);
      } catch (error) {
        logger.error(`Failed to shut down agent ${name}:`, error);
      }
    }
    
    this.isInitialized = false;
    logger.info('Agent system shut down successfully');
  }
}

// Singleton instance
const agentManager = new AgentManager();

export async function initializeAgents(io) {
  return await agentManager.initialize(io);
}

export { agentManager }; 