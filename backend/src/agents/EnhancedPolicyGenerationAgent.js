/**
 * Enhanced Policy Generation Agent with RAG Integration
 * 
 * This enhanced version of the Policy Generation Agent integrates with RAG (Retrieval Augmented Generation)
 * to provide context-aware policy generation using historical policies, threat intelligence,
 * and compliance knowledge.
 * 
 * Key Enhancements:
 * - RAG-powered context retrieval
 * - Dynamic prompt generation based on retrieved knowledge
 * - Learning from historical policy effectiveness
 * - Real-time threat and compliance context integration
 * - Improved accuracy through knowledge grounding
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { knowledgeManager } from '../rag/knowledgeManager.js';
import { PolicyTemplate } from '../models/PolicyTemplate.js';
import { ComplianceFramework } from '../models/ComplianceFramework.js';
import { CloudService } from '../models/CloudService.js';

export class EnhancedPolicyGenerationAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isInitialized = false;
    this.templates = new Map();
    this.frameworks = new Map();
    this.knowledgeManager = knowledgeManager;
  }

  /**
   * Initialize the enhanced policy generation agent
   */
  async initialize() {
    try {
      logger.info('Initializing Enhanced Policy Generation Agent...');
      
      // Initialize knowledge manager
      await this.knowledgeManager.initialize();
      
      // Load policy templates
      await this.loadTemplates();
      
      // Load compliance frameworks
      await this.loadFrameworks();
      
      // Load cloud service definitions
      await this.loadCloudServices();
      
      // Ingest initial knowledge base
      await this.initializeKnowledgeBase();
      
      this.isInitialized = true;
      logger.info('Enhanced Policy Generation Agent initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Enhanced Policy Generation Agent:', error);
      throw error;
    }
  }

  /**
   * Execute a task with enhanced RAG capabilities
   * @param {string} task - The task to execute
   * @param {Object} data - Task data
   * @returns {Object} Task result
   */
  async executeTask(task, data) {
    if (!this.isInitialized) {
      throw new Error('Enhanced Policy Generation Agent not initialized');
    }

    switch (task) {
      case 'generate':
        return await this.generatePolicyWithRAG(data.service, data.requirements);
      case 'merge':
        return await this.mergePolicyResults(data);
      case 'validate':
        return await this.validatePolicy(data.policy);
      case 'optimize':
        return await this.optimizePolicy(data.policy, data.requirements);
      case 'learn':
        return await this.learnFromFeedback(data.policyId, data.feedback);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  /**
   * Generate policy with RAG-enhanced context
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {Object} Generated policy with context
   */
  async generatePolicyWithRAG(service, requirements) {
    try {
      logger.info(`Generating RAG-enhanced policy for service: ${service}`);
      
      // Retrieve contextual knowledge using RAG
      const context = await this.knowledgeManager.getPolicyContext(service, requirements);
      
      // Get service-specific template
      const template = this.templates.get(service) || this.templates.get('default');
      const framework = this.frameworks.get(requirements.compliance || 'CIS');
      
      // Build enhanced prompt with RAG context
      const prompt = this.buildRAGEnhancedPrompt(service, requirements, template, framework, context);
      
      // Generate policy using OpenAI with enhanced context
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
      
      // Parse and structure the policy with RAG context
      const structuredPolicy = await this.structurePolicyWithContext(
        generatedPolicy, 
        service, 
        requirements, 
        context
      );
      
      // Store the generated policy in knowledge base for future learning
      await this.storePolicyForLearning(structuredPolicy, context);
      
      logger.info(`RAG-enhanced policy generated successfully for ${service}`);
      return structuredPolicy;
      
    } catch (error) {
      logger.error(`Failed to generate RAG-enhanced policy for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Build RAG-enhanced prompt with contextual knowledge
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @param {Object} template - Policy template
   * @param {Object} framework - Compliance framework
   * @param {Object} context - RAG-retrieved context
   * @returns {string} Enhanced prompt
   */
  buildRAGEnhancedPrompt(service, requirements, template, framework, context) {
    const similarPolicies = context.similarPolicies || [];
    const bestPractices = context.bestPractices || [];
    const threatContext = context.threatContext || [];
    const complianceContext = context.complianceRequirements || [];

    return `
Generate a comprehensive security policy for ${service} with the following requirements:

SERVICE CONTEXT:
- Service: ${service}
- Environment: ${requirements.environment || 'production'}
- Business Unit: ${requirements.businessUnit || 'corporate'}
- Compliance Framework: ${requirements.compliance || 'CIS'}

SECURITY REQUIREMENTS:
${requirements.additionalRequirements || 'Standard security requirements apply'}

COMPLIANCE REQUIREMENTS:
- Framework: ${framework.name}
- Version: ${framework.version}
- Controls: ${framework.controls.join(', ')}

POLICY TEMPLATE STRUCTURE:
${template.structure}

CONTEXTUAL KNOWLEDGE FROM RAG:

SIMILAR POLICIES (${similarPolicies.length} found):
${similarPolicies.map(policy => `
- Policy: ${policy.metadata?.filename || 'Unknown'}
- Score: ${policy.score}
- Content: ${policy.content.substring(0, 200)}...
`).join('\n')}

BEST PRACTICES (${bestPractices.length} found):
${bestPractices.map(practice => `
- Practice: ${practice.metadata?.title || 'Unknown'}
- Score: ${practice.score}
- Content: ${practice.content.substring(0, 200)}...
`).join('\n')}

THREAT CONTEXT (${threatContext.length} found):
${threatContext.map(threat => `
- Threat: ${threat.metadata?.title || 'Unknown'}
- Severity: ${threat.metadata?.severity || 'Unknown'}
- Content: ${threat.content.substring(0, 200)}...
`).join('\n')}

COMPLIANCE CONTEXT (${complianceContext.length} found):
${complianceContext.map(comp => `
- Requirement: ${comp.metadata?.title || 'Unknown'}
- Score: ${comp.score}
- Content: ${comp.content.substring(0, 200)}...
`).join('\n')}

OUTPUT FORMAT:
Generate the policy in YAML format with the following structure:
- Metadata (name, labels, version)
- Encryption requirements (at rest, in transit)
- Access control (authentication, authorization, MFA)
- Network security (allowed sources, blocked ports)
- Monitoring and logging
- Compliance controls mapping
- Risk assessment
- Threat-specific mitigations (based on threat context)
- Best practice implementations (based on retrieved best practices)

Ensure the policy is:
1. Production-ready and immediately deployable
2. Compliant with the specified framework
3. Tailored to the specific service and environment
4. Incorporates relevant threat mitigations from the threat context
5. Implements best practices from the retrieved knowledge
6. Includes proper risk assessment and mitigation strategies
7. Follows security best practices for cloud services
8. Addresses specific threats identified in the threat context
    `;
  }

  /**
   * Build system prompt with RAG context
   * @param {Object} context - RAG-retrieved context
   * @returns {string} System prompt
   */
  buildSystemPrompt(context) {
    const threatCount = context.threatContext?.length || 0;
    const policyCount = context.similarPolicies?.length || 0;
    const bestPracticeCount = context.bestPractices?.length || 0;

    return `You are an expert cloud security policy generator with access to a comprehensive knowledge base. 

You have access to:
- ${policyCount} similar policies for reference
- ${bestPracticeCount} best practice guidelines
- ${threatCount} relevant threat intelligence items
- Real-time compliance requirements

Use this contextual knowledge to generate policies that are:
1. Grounded in real-world examples and proven practices
2. Informed by current threat landscape
3. Compliant with up-to-date regulatory requirements
4. Tailored to specific organizational contexts

Always reference and incorporate relevant information from the provided context to ensure accuracy and relevance.`;
  }

  /**
   * Structure policy with RAG context
   * @param {string} rawPolicy - Raw policy content
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @param {Object} context - RAG context
   * @returns {Object} Structured policy with context
   */
  async structurePolicyWithContext(rawPolicy, service, requirements, context) {
    try {
      const structuredPolicy = {
        metadata: {
          name: `${service.toLowerCase().replace(/\s+/g, '-')}-security-policy`,
          service: service,
          environment: requirements.environment || 'production',
          businessUnit: requirements.businessUnit || 'corporate',
          compliance: requirements.compliance || 'CIS',
          version: '1.0.0',
          generatedBy: 'enhanced-ai-policy-foundry',
          generatedAt: new Date().toISOString(),
          riskLevel: this.assessRiskLevel(service, requirements),
          ragEnhanced: true
        },
        policy: rawPolicy,
        compliance: {
          framework: requirements.compliance || 'CIS',
          controls: this.mapComplianceControls(service, requirements),
          status: 'draft',
          contextUsed: context.complianceRequirements?.length || 0
        },
        security: {
          riskAssessment: this.performRiskAssessment(service, requirements),
          recommendations: this.generateRecommendations(service, requirements),
          threatContext: this.processThreatContext(context.threatContext || []),
          bestPractices: this.processBestPractices(context.bestPractices || [])
        },
        ragContext: {
          similarPoliciesUsed: context.similarPolicies?.length || 0,
          bestPracticesUsed: context.bestPractices?.length || 0,
          threatIntelligenceUsed: context.threatContext?.length || 0,
          complianceRequirementsUsed: context.complianceRequirements?.length || 0,
          contextRetrievedAt: context.retrievedAt,
          confidenceScore: this.calculateContextConfidence(context)
        }
      };

      return structuredPolicy;
      
    } catch (error) {
      logger.error('Failed to structure policy with context:', error);
      throw error;
    }
  }

  /**
   * Process threat context for policy integration
   * @param {Array} threatContext - Threat context from RAG
   * @returns {Object} Processed threat context
   */
  processThreatContext(threatContext) {
    const threats = threatContext.map(threat => ({
      id: threat.metadata?.id || 'unknown',
      title: threat.metadata?.title || 'Unknown Threat',
      severity: threat.metadata?.severity || 'medium',
      description: threat.content.substring(0, 300),
      score: threat.score,
      source: threat.metadata?.source || 'unknown'
    }));

    return {
      threats,
      threatCount: threats.length,
      highSeverityThreats: threats.filter(t => t.severity === 'high' || t.severity === 'critical').length,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Process best practices for policy integration
   * @param {Array} bestPractices - Best practices from RAG
   * @returns {Object} Processed best practices
   */
  processBestPractices(bestPractices) {
    const practices = bestPractices.map(practice => ({
      title: practice.metadata?.title || 'Unknown Practice',
      description: practice.content.substring(0, 200),
      score: practice.score,
      source: practice.metadata?.source || 'unknown',
      category: practice.metadata?.category || 'general'
    }));

    return {
      practices,
      practiceCount: practices.length,
      categories: [...new Set(practices.map(p => p.category))],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Calculate confidence score based on RAG context
   * @param {Object} context - RAG context
   * @returns {number} Confidence score (0-1)
   */
  calculateContextConfidence(context) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on available context
    if (context.similarPolicies?.length > 0) confidence += 0.2;
    if (context.bestPractices?.length > 0) confidence += 0.15;
    if (context.threatContext?.length > 0) confidence += 0.1;
    if (context.complianceRequirements?.length > 0) confidence += 0.05;

    // Increase confidence based on context quality (average scores)
    const avgScore = this.calculateAverageContextScore(context);
    confidence += avgScore * 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate average score of context items
   * @param {Object} context - RAG context
   * @returns {number} Average score
   */
  calculateAverageContextScore(context) {
    const allItems = [
      ...(context.similarPolicies || []),
      ...(context.bestPractices || []),
      ...(context.threatContext || []),
      ...(context.complianceRequirements || [])
    ];

    if (allItems.length === 0) return 0;

    const totalScore = allItems.reduce((sum, item) => sum + (item.score || 0), 0);
    return totalScore / allItems.length;
  }

  /**
   * Store policy for future learning
   * @param {Object} policy - Generated policy
   * @param {Object} context - RAG context used
   */
  async storePolicyForLearning(policy, context) {
    try {
      // Store the policy in the knowledge base for future reference
      await this.knowledgeManager.ingestText('policies', policy.policy, {
        policyId: policy.metadata.name,
        service: policy.metadata.service,
        environment: policy.metadata.environment,
        compliance: policy.metadata.compliance,
        generatedAt: policy.metadata.generatedAt,
        ragEnhanced: true,
        contextUsed: {
          similarPolicies: context.similarPolicies?.length || 0,
          bestPractices: context.bestPractices?.length || 0,
          threats: context.threatContext?.length || 0,
          compliance: context.complianceRequirements?.length || 0
        }
      });

      logger.debug(`Stored policy ${policy.metadata.name} for future learning`);

    } catch (error) {
      logger.error('Failed to store policy for learning:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Learn from policy feedback
   * @param {string} policyId - Policy ID
   * @param {Object} feedback - User feedback
   */
  async learnFromFeedback(policyId, feedback) {
    try {
      logger.info(`Learning from feedback for policy ${policyId}`);

      // Store feedback in knowledge base
      await this.knowledgeManager.ingestText('feedback', JSON.stringify(feedback), {
        policyId,
        feedbackType: feedback.type || 'general',
        rating: feedback.rating || 0,
        comments: feedback.comments || '',
        timestamp: new Date().toISOString()
      });

      // Update policy effectiveness metrics
      if (feedback.rating) {
        await this.updatePolicyEffectiveness(policyId, feedback.rating);
      }

      logger.info(`Successfully processed feedback for policy ${policyId}`);

    } catch (error) {
      logger.error(`Failed to learn from feedback for policy ${policyId}:`, error);
      throw error;
    }
  }

  /**
   * Update policy effectiveness metrics
   * @param {string} policyId - Policy ID
   * @param {number} rating - User rating
   */
  async updatePolicyEffectiveness(policyId, rating) {
    try {
      // This would update effectiveness metrics in the database
      // For now, we'll log the update
      logger.info(`Updated effectiveness for policy ${policyId}: rating ${rating}`);

    } catch (error) {
      logger.error(`Failed to update effectiveness for policy ${policyId}:`, error);
    }
  }

  /**
   * Initialize knowledge base with initial data
   */
  async initializeKnowledgeBase() {
    try {
      logger.info('Initializing knowledge base with initial data...');

      // Ingest sample policies if knowledge base is empty
      const stats = await this.knowledgeManager.getKnowledgeStats();
      if (stats.totalDocuments === 0) {
        await this.ingestSampleData();
      }

      logger.info('Knowledge base initialization complete');

    } catch (error) {
      logger.error('Failed to initialize knowledge base:', error);
      throw error;
    }
  }

  /**
   * Ingest sample data for initial knowledge base
   */
  async ingestSampleData() {
    try {
      // Sample best practices
      const bestPractices = [
        {
          content: "Always enable encryption at rest for sensitive data storage services like S3, RDS, and EBS volumes. Use AWS KMS or Azure Key Vault for key management.",
          metadata: { title: "Encryption at Rest", category: "data-protection", source: "aws-security-best-practices" }
        },
        {
          content: "Implement least privilege access controls. Grant only the minimum permissions necessary for users and services to perform their functions.",
          metadata: { title: "Least Privilege Access", category: "access-control", source: "security-frameworks" }
        },
        {
          content: "Enable comprehensive logging and monitoring for all cloud services. Use CloudTrail, CloudWatch, and Azure Monitor for audit trails.",
          metadata: { title: "Comprehensive Logging", category: "monitoring", source: "compliance-requirements" }
        }
      ];

      await this.knowledgeManager.ingestText('best-practices', 
        bestPractices.map(bp => bp.content).join('\n\n'), 
        { source: 'initial-data', type: 'best-practices' }
      );

      // Sample threat intelligence
      const threats = [
        {
          content: "Cloud storage misconfigurations are a leading cause of data breaches. Ensure bucket policies are properly configured and public access is disabled.",
          metadata: { title: "Storage Misconfiguration", severity: "high", source: "threat-intelligence" }
        },
        {
          content: "Privilege escalation attacks target IAM policies and role assignments. Regularly audit permissions and implement just-in-time access.",
          metadata: { title: "Privilege Escalation", severity: "high", source: "threat-intelligence" }
        }
      ];

      await this.knowledgeManager.ingestText('threats',
        threats.map(t => t.content).join('\n\n'),
        { source: 'initial-data', type: 'threat-intelligence' }
      );

      logger.info('Sample data ingested successfully');

    } catch (error) {
      logger.error('Failed to ingest sample data:', error);
    }
  }

  // Inherit other methods from the original PolicyGenerationAgent
  // (assessRiskLevel, getServiceRiskLevel, mapComplianceControls, etc.)
  // These methods remain the same as in the original implementation

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

  mapComplianceControls(service, requirements) {
    const framework = this.frameworks.get(requirements.compliance || 'CIS');
    if (!framework) return [];
    
    return framework.controls.filter(control => 
      control.services.includes(service) || control.services.includes('all')
    );
  }

  performRiskAssessment(service, requirements) {
    return {
      riskLevel: this.assessRiskLevel(service, requirements),
      threats: this.identifyThreats(service),
      mitigations: this.suggestMitigations(service, requirements),
      lastUpdated: new Date().toISOString()
    };
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

  generateRecommendations(service, requirements) {
    const recommendations = [
      'Review and test policy in staging environment before production deployment',
      'Monitor policy effectiveness and adjust based on usage patterns',
      'Regular compliance audits to ensure policy remains current'
    ];
    
    if (requirements.environment === 'production') {
      recommendations.push('Implement gradual rollout with monitoring');
    }
    
    return recommendations;
  }

  async loadTemplates() {
    const templates = await PolicyTemplate.findAll();
    for (const template of templates) {
      this.templates.set(template.service, template);
    }
    
    if (!this.templates.has('default')) {
      this.templates.set('default', {
        service: 'default',
        structure: 'Standard security policy structure',
        version: '1.0.0'
      });
    }
  }

  async loadFrameworks() {
    const frameworks = await ComplianceFramework.findAll();
    for (const framework of frameworks) {
      this.frameworks.set(framework.name, framework);
    }
  }

  async loadCloudServices() {
    const services = await CloudService.findAll();
    for (const service of services) {
      // Store service-specific information
    }
  }

  async mergePolicyResults(data) {
    try {
      const { policy, compliance, security } = data;
      
      if (compliance.validation) {
        policy.compliance.validation = compliance.validation;
        policy.compliance.status = compliance.validation.passed ? 'validated' : 'needs-review';
      }
      
      if (security.analysis) {
        policy.security.analysis = security.analysis;
        policy.security.riskLevel = security.analysis.riskLevel;
      }
      
      policy.security.recommendations = [
        ...(policy.security.recommendations || []),
        ...(compliance.recommendations || []),
        ...(security.recommendations || [])
      ];
      
      return policy;
      
    } catch (error) {
      logger.error('Failed to merge policy results:', error);
      throw error;
    }
  }

  async validatePolicy(policy) {
    try {
      const validation = {
        passed: true,
        issues: [],
        warnings: [],
        recommendations: []
      };

      if (!policy.metadata || !policy.policy) {
        validation.passed = false;
        validation.issues.push('Missing required policy structure');
      }

      if (!policy.compliance || !policy.compliance.controls) {
        validation.warnings.push('Compliance controls not mapped');
      }

      if (!policy.security || !policy.security.riskAssessment) {
        validation.warnings.push('Security risk assessment missing');
      }

      return validation;
      
    } catch (error) {
      logger.error('Failed to validate policy:', error);
      throw error;
    }
  }

  async optimizePolicy(policy, requirements) {
    try {
      const optimizedPolicy = { ...policy };
      
      if (requirements.optimizeFor === 'performance') {
        optimizedPolicy.recommendations.push('Consider caching policies for better performance');
      }
      
      if (requirements.optimizeFor === 'cost') {
        optimizedPolicy.recommendations.push('Review logging retention periods for cost optimization');
      }
      
      return optimizedPolicy;
      
    } catch (error) {
      logger.error('Failed to optimize policy:', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down Enhanced Policy Generation Agent...');
    this.isInitialized = false;
  }
}

