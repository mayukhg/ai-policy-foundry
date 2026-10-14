import { PolicyGenerationAgent } from './PolicyGenerationAgent.js';
import { ThreatIntelligenceAgent } from './ThreatIntelligenceAgent.js';
import { ComplianceAgent } from './ComplianceAgent.js';
import { SecurityAnalysisAgent } from './SecurityAnalysisAgent.js';
import { CloudProviderAgent } from './CloudProviderAgent.js';
import { DocumentIngestionAgent } from './DocumentIngestionAgent.js';
import { AnalysisAgent } from './AnalysisAgent.js';
import { logger } from '../utils/logger.js';
import { getStore } from '../data/syntheticStore.js';
import policyExportService from '../services/PolicyExportService.js';
import { summarizeChangePackage } from '../services/StructuralDeltaExtractor.js';

class AgentManager {
  constructor() {
    this.agents = new Map();
    this.io = null;
    this.isInitialized = false;
    this.pipelineProgress = [];
  }

  async initialize(io) {
    this.io = io;
    
    try {
      logger.info('Initializing AI Agent System...');
      
      // Initialize core agents (slide assembly line + supporting agents)
      const agents = [
        {
          name: 'document-ingestion',
          agent: new DocumentIngestionAgent(),
          description: 'Parses policy manuals and risk matrices'
        },
        {
          name: 'analysis',
          agent: new AnalysisAgent(),
          description: 'Identifies delta changes and context'
        },
        {
          name: 'policy-generator',
          agent: new PolicyGenerationAgent(),
          description: 'Policy Writer — drafts YAML + Rego rules'
        },
        {
          name: 'threat-intelligence',
          agent: new ThreatIntelligenceAgent(),
          description: 'Monitors and analyzes threat intelligence feeds'
        },
        {
          name: 'compliance',
          agent: new ComplianceAgent(),
          description: 'Cross-references frameworks, feeds, and risk matrices'
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

  emitPipeline(stage, status, detail = {}) {
    const event = { stage, status, detail, timestamp: new Date().toISOString() };
    this.pipelineProgress.push(event);
    if (this.io) {
      this.io.to('dashboard').emit('pipeline-progress', event);
    }
  }

  getPipelineProgress() {
    return this.pipelineProgress.slice(-20);
  }

  async generatePolicy(service, requirements, documentContext = null) {
    this.pipelineProgress = [];
    const store = getStore();
    const policyAgent = await this.getAgent('policy-generator');
    const complianceAgent = await this.getAgent('compliance');
    const securityAgent = await this.getAgent('security-analysis');
    const analysisAgent = await this.getAgent('analysis');
    const llmStartedAt = Date.now();

    // Phase 1 — deterministic filter (ChangePackage); never stuff fullText
    let changePackage = documentContext?.changePackage || null;
    let delta = null;

    this.emitPipeline('deterministic-filter', 'started', {
      documentId: documentContext?.documentId,
      hasPackage: Boolean(changePackage)
    });

    if (documentContext?.documentId) {
      try {
        delta = await analysisAgent.executeTask('delta', {
          documentId: documentContext.documentId
        });
        changePackage = delta?.changePackage || changePackage;
        if (changePackage && documentContext) {
          documentContext.changePackage = changePackage;
          delete documentContext.fullText;
        }
        this.emitPipeline('deterministic-filter', 'completed', {
          mode: changePackage?.mode || (delta?.hasDelta ? 'delta' : 'baseline'),
          packageChars: changePackage?.packageChars,
          tokenEstimate: changePackage?.stats?.tokenEstimate,
          addedControls: changePackage?.addedControls?.length || 0,
          removedControls: changePackage?.removedControls?.length || 0
        });
      } catch (error) {
        logger.warn('Deterministic filter skipped:', error.message);
        this.emitPipeline('deterministic-filter', 'skipped', { reason: error.message });
      }
    } else {
      this.emitPipeline('deterministic-filter', 'completed', {
        mode: changePackage?.mode || 'none',
        packageChars: changePackage?.packageChars || 0
      });
    }

    if (documentContext?.fullText) {
      delete documentContext.fullText;
    }

    const riskMatrixDocs = [...store.documents.values()].filter((d) => d.type === 'risk_matrix');
    const riskMatrix = riskMatrixDocs[0]?.content?.structured || null;
    const operationalFeeds = [...store.threats.values()].slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      severity: t.severity,
      service: t.service
    }));

    // Phase 2 — LLM agents on ChangePackage only
    this.emitPipeline('policy-writer', 'started', {
      service,
      extractionMode: changePackage?.mode,
      tokenEstimate: changePackage?.stats?.tokenEstimate
    });
    const policyResult = await policyAgent.executeTask('generate', {
      service,
      requirements,
      documentContext
    });
    this.emitPipeline('policy-writer', 'completed', { name: policyResult?.metadata?.name });

    this.emitPipeline('compliance', 'started', { framework: requirements?.compliance || 'CIS' });
    this.emitPipeline('security', 'started', { service });
    const [complianceResult, securityResult] = await Promise.all([
      complianceAgent.executeTask('validate', {
        policy: policyResult,
        framework: requirements?.compliance || 'CIS',
        riskMatrix,
        operationalFeeds,
        delta,
        changePackage
      }),
      securityAgent.executeTask('analyze', {
        policy: policyResult,
        context: {
          service,
          requirements,
          documentContext,
          delta,
          changePackage,
          riskMatrix
        }
      })
    ]);
    this.emitPipeline('compliance', 'completed', { score: complianceResult?.score });
    this.emitPipeline('security', 'completed', {
      riskLevel: securityResult?.riskAssessment?.riskLevel
    });

    const finalPolicy = await policyAgent.executeTask('merge', {
      policy: policyResult,
      compliance: complianceResult,
      security: securityResult
    });

    const openRouterLatencyMs = Date.now() - llmStartedAt;
    const packageSummary = summarizeChangePackage(changePackage);

    logger.info('Policy generation extraction stats', {
      mode: packageSummary?.mode,
      packageChars: packageSummary?.packageChars,
      tokenEstimate: packageSummary?.tokenEstimate,
      openRouterLatencyMs
    });

    // Attach executable Rego + pipeline/extraction metadata
    finalPolicy.rego = policyExportService.exportToRego(finalPolicy);
    finalPolicy.delta = delta;
    finalPolicy.changePackage = changePackage;
    finalPolicy.extraction = {
      ...packageSummary,
      openRouterLatencyMs,
      fullTextOmitted: true
    };
    finalPolicy.pipeline = this.getPipelineProgress();
    finalPolicy.metadata = {
      ...finalPolicy.metadata,
      status: 'draft',
      extractionMode: packageSummary?.mode || null
    };

    // Persist into store + rule catalog
    const policyId = `policy-${Date.now()}`;
    store.policies.set(policyId, {
      ...finalPolicy,
      id: policyId,
      name: finalPolicy.metadata?.name,
      service,
      status: 'draft',
      complianceFramework: requirements?.compliance || 'CIS',
      complianceDetails: finalPolicy.compliance,
      compliance: requirements?.compliance || finalPolicy.metadata?.compliance || 'CIS',
      lastUpdated: new Date().toISOString(),
      risk: finalPolicy.security?.riskAssessment?.riskLevel || 'medium'
    });
    store.ruleCatalog.set(policyId, {
      id: policyId,
      name: finalPolicy.metadata?.name,
      service,
      framework: requirements?.compliance || 'CIS',
      version: finalPolicy.metadata?.version || '1.0.0',
      status: 'draft',
      controlIds: (finalPolicy.compliance?.controls || []).map((c) => c.id || c).filter(Boolean),
      hasConflicts: false
    });

    this.emitPipeline('complete', 'completed', { policyId });
    return { ...finalPolicy, id: policyId };
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

  /**
   * Analyze a threat and decide whether to create new policy or tweak existing
   * Uses Wiz policy data as context
   * 
   * @param {Object} threat - Threat object
   * @param {string} service - Optional cloud service to filter policies
   * @returns {Promise<Object>} Decision with recommendations
   */
  async decideThreatPolicyAction(threat, service = null) {
    const securityAgent = await this.getAgent('security-analysis');
    
    // Use SecurityAnalysisAgent to make decision with Wiz context
    const decision = await securityAgent.executeTask('threat-policy-decision', {
      threat,
      service
    });
    
    return decision;
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