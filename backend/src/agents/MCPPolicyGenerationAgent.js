/**
 * MCP-Enhanced Policy Generation Agent
 * 
 * This agent uses MCP (Model Context Protocol) to retrieve context from:
 * - Document servers (Google Drive, SharePoint, File System)
 * - Cloud providers (AWS, Azure, GCP) for live infrastructure state
 * - Compliance frameworks (CIS, NIST, ISO, SOC 2)
 * - Threat intelligence feeds
 * 
 * This replaces manual uploads and static knowledge with real-time, context-aware policy generation.
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { mcpClient } from '../mcp/mcpClient.js';
import { knowledgeManager } from '../rag/knowledgeManager.js';

export class MCPPolicyGenerationAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isInitialized = false;
    this.knowledgeManager = knowledgeManager;
  }

  /**
   * Initialize the MCP-enhanced policy generation agent
   */
  async initialize() {
    try {
      logger.info('Initializing MCP-Enhanced Policy Generation Agent...');
      
      // Initialize MCP client
      if (!mcpClient.isInitialized) {
        await mcpClient.initialize();
      }
      
      // Initialize knowledge manager
      await this.knowledgeManager.initialize();
      
      this.isInitialized = true;
      logger.info('MCP-Enhanced Policy Generation Agent initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize MCP-Enhanced Policy Generation Agent:', error);
      throw error;
    }
  }

  /**
   * Generate policy with MCP-enhanced context
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {Object} Generated policy with context
   */
  async generatePolicy(service, requirements) {
    if (!this.isInitialized) {
      throw new Error('MCP-Enhanced Policy Generation Agent not initialized');
    }

    try {
      logger.info(`Generating MCP-enhanced policy for service: ${service}`);
      
      // 1. Get Context via MCP (No manual upload)
      const riskMatrix = await this.getRiskMatrixViaMCP(requirements);
      
      // 2. Query Live Infrastructure
      const cloudConfig = await this.getCloudConfigViaMCP(service, requirements);
      
      // 3. Fetch Exact Compliance Controls
      const complianceControls = await this.getComplianceControlsViaMCP(
        requirements.compliance || 'CIS',
        service
      );
      
      // 4. Get Real-Time Threat Intelligence
      const threatContext = await this.getThreatContextViaMCP(service);
      
      // 5. Generate Grounded Policy
      const policy = await this.generateGroundedPolicy({
        service,
        requirements,
        riskMatrix,
        cloudConfig,
        complianceControls,
        threatContext
      });
      
      // 6. Commit to Git for audit trail
      await this.commitPolicyToGit(policy);
      
      logger.info(`MCP-enhanced policy generated successfully for ${service}`);
      return policy;
      
    } catch (error) {
      logger.error(`Failed to generate MCP-enhanced policy for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Get risk matrix from document sources via MCP
   */
  async getRiskMatrixViaMCP(requirements) {
    try {
      // Search for risk matrix documents
      const searchResults = await mcpClient.callTool('filesystem', 'search_documents', {
        query: requirements.riskMatrixQuery || 'risk matrix',
        fileTypes: ['pdf', 'docx', 'xlsx'],
        limit: 5
      });

      if (searchResults.results && searchResults.results.length > 0) {
        // Read the first matching document
        const doc = searchResults.results[0];
        const content = await mcpClient.callTool('filesystem', 'read_file', {
          path: doc.path,
          format: 'text'
        });

        return {
          source: doc.path,
          content: content.content,
          lastModified: doc.lastModified
        };
      }

      // Fallback: try Google Drive if enabled
      if (mcpClient.servers.has('gdrive')) {
        const gdriveResults = await mcpClient.callTool('gdrive', 'search_documents', {
          query: 'risk matrix',
          limit: 1
        });

        if (gdriveResults.results && gdriveResults.results.length > 0) {
          const doc = gdriveResults.results[0];
          const content = await mcpClient.callTool('gdrive', 'read_file', {
            path: doc.path
          });

          return {
            source: 'gdrive',
            content: content.content,
            lastModified: doc.lastModified
          };
        }
      }

      return null;
      
    } catch (error) {
      logger.warn(`Could not retrieve risk matrix via MCP: ${error.message}`);
      return null;
    }
  }

  /**
   * Get live cloud infrastructure configuration via MCP
   */
  async getCloudConfigViaMCP(service, requirements) {
    try {
      // Determine cloud provider from service
      let provider = 'aws';
      if (service.toLowerCase().includes('azure')) provider = 'azure';
      else if (service.toLowerCase().includes('gcp') || service.toLowerCase().includes('google')) provider = 'gcp';

      if (!mcpClient.servers.has(provider)) {
        logger.warn(`Cloud provider ${provider} not available via MCP`);
        return null;
      }

      // Extract service type (e.g., 'S3' from 'AWS S3')
      const serviceType = service.split(' ').pop().toLowerCase();
      
      // Query cloud resources
      const resources = await mcpClient.callTool(provider, 'describe_resources', {
        resourceType: this.mapServiceToResourceType(serviceType),
        tags: requirements.tags || {},
        filters: requirements.filters || {}
      });

      // Get IAM policies
      const iamPolicies = await mcpClient.callTool(provider, 'get_iam_policies', {
        resourceType: 'role',
        resourceName: requirements.roleName
      });

      // Get network configuration
      const networkConfig = await mcpClient.callTool(provider, 'get_network_config', {
        vpcId: requirements.vpcId
      });

      return {
        provider,
        resources,
        iamPolicies,
        networkConfig,
        retrievedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.warn(`Could not retrieve cloud config via MCP: ${error.message}`);
      return null;
    }
  }

  /**
   * Get compliance controls via MCP
   */
  async getComplianceControlsViaMCP(framework, service) {
    try {
      const controls = await mcpClient.callTool('compliance', 'get_controls', {
        framework,
        service,
        version: undefined // Use latest
      });

      return controls;
      
    } catch (error) {
      logger.warn(`Could not retrieve compliance controls via MCP: ${error.message}`);
      return null;
    }
  }

  /**
   * Get threat intelligence context via MCP
   */
  async getThreatContextViaMCP(service) {
    try {
      const threats = await mcpClient.callTool('threat', 'query_threats', {
        query: `recent critical vulnerabilities for ${service}`,
        severity: 'critical',
        service,
        limit: 10
      });

      return threats;
      
    } catch (error) {
      logger.warn(`Could not retrieve threat context via MCP: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate grounded policy using all MCP-retrieved context
   */
  async generateGroundedPolicy(context) {
    const {
      service,
      requirements,
      riskMatrix,
      cloudConfig,
      complianceControls,
      threatContext
    } = context;

    // Build comprehensive prompt with MCP context
    const prompt = this.buildMCPEnhancedPrompt(context);

    // Generate policy using OpenAI
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: this.buildSystemPrompt(context)
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const generatedPolicy = completion.choices[0].message.content;

    // Structure the policy
    const structuredPolicy = {
      metadata: {
        name: `${service.toLowerCase().replace(/\s+/g, '-')}-security-policy`,
        service,
        environment: requirements.environment || 'production',
        businessUnit: requirements.businessUnit || 'corporate',
        compliance: requirements.compliance || 'CIS',
        version: '1.0.0',
        generatedBy: 'mcp-enhanced-ai-policy-foundry',
        generatedAt: new Date().toISOString(),
        mcpEnhanced: true
      },
      policy: generatedPolicy,
      context: {
        riskMatrix: riskMatrix ? { source: riskMatrix.source, retrieved: true } : null,
        cloudConfig: cloudConfig ? { provider: cloudConfig.provider, retrieved: true } : null,
        complianceControls: complianceControls ? { count: complianceControls.count } : null,
        threatContext: threatContext ? { threatCount: threatContext.count } : null
      },
      compliance: {
        framework: requirements.compliance || 'CIS',
        controls: complianceControls?.controls || [],
        status: 'draft'
      },
      security: {
        riskAssessment: this.performRiskAssessment(service, requirements),
        recommendations: this.generateRecommendations(service, requirements, context)
      }
    };

    return structuredPolicy;
  }

  /**
   * Build MCP-enhanced prompt
   */
  buildMCPEnhancedPrompt(context) {
    const {
      service,
      requirements,
      riskMatrix,
      cloudConfig,
      complianceControls,
      threatContext
    } = context;

    let prompt = `Generate a comprehensive security policy for ${service} with the following requirements:

SERVICE CONTEXT:
- Service: ${service}
- Environment: ${requirements.environment || 'production'}
- Business Unit: ${requirements.businessUnit || 'corporate'}
- Compliance Framework: ${requirements.compliance || 'CIS'}

`;

    // Add risk matrix context
    if (riskMatrix) {
      prompt += `RISK MATRIX CONTEXT (from ${riskMatrix.source}):
${riskMatrix.content.substring(0, 500)}...

`;
    }

    // Add cloud infrastructure context
    if (cloudConfig) {
      prompt += `LIVE CLOUD INFRASTRUCTURE (${cloudConfig.provider}):
- Resources: ${JSON.stringify(cloudConfig.resources, null, 2)}
- IAM Policies: ${JSON.stringify(cloudConfig.iamPolicies, null, 2)}
- Network Config: ${JSON.stringify(cloudConfig.networkConfig, null, 2)}

`;
    }

    // Add compliance controls
    if (complianceControls) {
      prompt += `COMPLIANCE CONTROLS (${complianceControls.framework}):
${complianceControls.controls.map(c => `- ${c.id}: ${c.name} - ${c.requirement}`).join('\n')}

`;
    }

    // Add threat context
    if (threatContext && threatContext.threats) {
      prompt += `REAL-TIME THREAT INTELLIGENCE:
${threatContext.threats.map(t => `- ${t.id}: ${t.title} (${t.severity})`).join('\n')}

`;
    }

    prompt += `OUTPUT FORMAT:
Generate the policy in YAML format with the following structure:
- Metadata (name, labels, version)
- Encryption requirements (at rest, in transit)
- Access control (authentication, authorization, MFA)
- Network security (allowed sources, blocked ports)
- Monitoring and logging
- Compliance controls mapping
- Risk assessment
- Threat-specific mitigations
- Best practice implementations

Ensure the policy is:
1. Production-ready and immediately deployable
2. Compliant with the specified framework
3. Tailored to the actual deployed infrastructure (not theoretical)
4. Incorporates relevant threat mitigations
5. Addresses specific risks from the risk matrix
6. Follows security best practices for cloud services`;

    return prompt;
  }

  /**
   * Build system prompt
   */
  buildSystemPrompt(context) {
    const hasRiskMatrix = !!context.riskMatrix;
    const hasCloudConfig = !!context.cloudConfig;
    const hasComplianceControls = !!context.complianceControls;
    const hasThreatContext = !!context.threatContext;

    return `You are an expert cloud security policy generator with access to real-time, context-aware information via Model Context Protocol (MCP).

You have access to:
${hasRiskMatrix ? '- Risk matrix from organizational documents\n' : ''}
${hasCloudConfig ? `- Live cloud infrastructure configuration from ${context.cloudConfig.provider}\n` : ''}
${hasComplianceControls ? `- Structured compliance controls from ${context.complianceControls.framework}\n` : ''}
${hasThreatContext ? '- Real-time threat intelligence\n' : ''}

Use this contextual knowledge to generate policies that are:
1. Grounded in actual deployed infrastructure (not theoretical)
2. Informed by current threat landscape
3. Compliant with up-to-date regulatory requirements
4. Tailored to specific organizational contexts from risk matrices
5. Based on real cloud configurations, not assumptions

Always reference and incorporate relevant information from the provided context to ensure accuracy and relevance.`;
  }

  /**
   * Commit policy to Git for audit trail
   */
  async commitPolicyToGit(policy) {
    try {
      if (!mcpClient.servers.has('git')) {
        logger.debug('Git server not available, skipping commit');
        return;
      }

      const result = await mcpClient.callTool('git', 'commit_policy', {
        policyId: policy.metadata.name,
        policyContent: policy.policy,
        message: `Generated policy for ${policy.metadata.service} - ${policy.metadata.compliance}`,
        author: 'MCP-Enhanced Policy Agent'
      });

      logger.info(`Policy committed to Git: ${result.commitHash}`);
      
    } catch (error) {
      logger.warn(`Could not commit policy to Git: ${error.message}`);
    }
  }

  /**
   * Map service name to resource type
   */
  mapServiceToResourceType(serviceType) {
    const mapping = {
      's3': 's3_bucket',
      'lambda': 'lambda_function',
      'ec2': 'ec2_instance',
      'rds': 'rds_instance',
      'iam': 'iam_role',
      'storage': 'storage_account',
      'functions': 'function_app',
      'blob': 'blob_storage'
    };

    return mapping[serviceType] || serviceType;
  }

  /**
   * Perform risk assessment
   */
  performRiskAssessment(service, requirements) {
    return {
      riskLevel: this.assessRiskLevel(service, requirements),
      threats: this.identifyThreats(service),
      mitigations: this.suggestMitigations(service, requirements),
      lastUpdated: new Date().toISOString()
    };
  }

  assessRiskLevel(service, requirements) {
    const riskFactors = {
      environment: requirements.environment === 'production' ? 3 : 1,
      businessUnit: requirements.businessUnit === 'trading' ? 3 : 1,
      serviceType: this.getServiceRiskLevel(service)
    };
    
    const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0);
    
    if (totalRisk >= 8) return 'high';
    if (totalRisk >= 5) return 'medium';
    return 'low';
  }

  getServiceRiskLevel(service) {
    const highRiskServices = ['IAM', 'KMS', 'Secrets Manager', 'Key Vault'];
    const mediumRiskServices = ['Lambda', 'Functions', 'EC2', 'VM', 'S3', 'Storage'];
    
    if (highRiskServices.some(s => service.includes(s))) return 3;
    if (mediumRiskServices.some(s => service.includes(s))) return 2;
    return 1;
  }

  identifyThreats(service) {
    const commonThreats = [
      'data-exfiltration',
      'privilege-escalation',
      'unauthorized-access',
      'data-loss',
      'service-disruption'
    ];
    
    if (service.includes('S3') || service.includes('Storage')) {
      commonThreats.push('bucket-policy-bypass', 'data-exposure');
    }
    
    if (service.includes('IAM') || service.includes('KMS')) {
      commonThreats.push('credential-compromise', 'key-misuse');
    }
    
    return commonThreats;
  }

  suggestMitigations(service, requirements) {
    const mitigations = [
      'encryption-at-rest',
      'encryption-in-transit',
      'access-control',
      'monitoring',
      'logging'
    ];
    
    if (service.includes('S3') || service.includes('Storage')) {
      mitigations.push('bucket-encryption', 'versioning', 'lifecycle-policies');
    }
    
    if (service.includes('IAM') || service.includes('KMS')) {
      mitigations.push('least-privilege', 'rotation', 'audit-logging');
    }
    
    return mitigations;
  }

  generateRecommendations(service, requirements, context) {
    const recommendations = [
      'Review and test policy in staging environment before production deployment',
      'Monitor policy effectiveness and adjust based on usage patterns',
      'Regular compliance audits to ensure policy remains current'
    ];
    
    if (requirements.environment === 'production') {
      recommendations.push('Implement gradual rollout with monitoring');
    }

    if (context.cloudConfig) {
      recommendations.push('Policy generated based on live infrastructure - verify against actual resources');
    }

    if (context.threatContext && context.threatContext.threats.length > 0) {
      recommendations.push(`Address ${context.threatContext.threats.length} identified threats in policy`);
    }
    
    return recommendations;
  }

  async shutdown() {
    logger.info('Shutting down MCP-Enhanced Policy Generation Agent...');
    this.isInitialized = false;
  }
}

