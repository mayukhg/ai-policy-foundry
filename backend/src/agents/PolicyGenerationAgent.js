import { logger } from '../utils/logger.js';
import { PolicyTemplate } from '../models/PolicyTemplate.js';
import { ComplianceFramework } from '../models/ComplianceFramework.js';
import { CloudService } from '../models/CloudService.js';
import { chatCompletion, isLlmConfigured } from '../services/llmClient.js';

export class PolicyGenerationAgent {
  constructor() {
    this.isInitialized = false;
    this.templates = new Map();
    this.frameworks = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Policy Generation Agent...');
      
      // Load policy templates
      await this.loadTemplates();
      
      // Load compliance frameworks
      await this.loadFrameworks();
      
      // Load cloud service definitions
      await this.loadCloudServices();
      
      this.isInitialized = true;
      logger.info('Policy Generation Agent initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Policy Generation Agent:', error);
      throw error;
    }
  }

  async executeTask(task, data) {
    if (!this.isInitialized) {
      throw new Error('Policy Generation Agent not initialized');
    }

    switch (task) {
      case 'generate':
        return await this.generatePolicy(data.service, data.requirements, data.documentContext);
      case 'merge':
        return await this.mergePolicyResults(data);
      case 'validate':
        return await this.validatePolicy(data.policy);
      case 'optimize':
        return await this.optimizePolicy(data.policy, data.requirements);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async generatePolicy(service, requirements, documentContext = null) {
    try {
      logger.info(`Generating policy for service: ${service}${documentContext ? ' with document context' : ''}`);
      
      // Get service-specific template
      const template = this.templates.get(service) || this.templates.get('default');
      const framework = this.frameworks.get(requirements.compliance || 'CIS')
        || this.frameworks.get('CIS')
        || { name: 'CIS', version: '1.4.0', controls: [] };
      
      // Build prompt for AI (with document context if provided)
      const prompt = this.buildGenerationPrompt(service, requirements, template, framework, documentContext);

      let generatedPolicy;
      if (!isLlmConfigured()) {
        logger.warn('OPENROUTER_API_KEY not configured — returning demo policy template');
        generatedPolicy = this.buildMockPolicy(service, requirements, framework, documentContext);
      } else {
        try {
          const { content } = await chatCompletion({
            messages: [
              {
                role: 'system',
                content: 'You are an expert cloud security policy generator. Generate comprehensive, production-ready security policies that follow best practices and compliance requirements. When provided with organizational risk/control documents, use them as the primary source of truth and incorporate specific controls, risks, and requirements from those documents into the policy. Reason only over the targeted extraction package when provided — never invent unseen full-manual pages.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 4000
          });
          generatedPolicy = content;
        } catch (llmError) {
          // Keep pipeline (incl. ChangePackage extraction metadata) usable offline / on transient DNS failures
          logger.warn(
            `OpenRouter unavailable (${llmError.message}) — falling back to demo policy template`
          );
          generatedPolicy = this.buildMockPolicy(service, requirements, framework, documentContext);
        }
      }
      
      // Parse and structure the policy
      const structuredPolicy = await this.structurePolicy(generatedPolicy, service, requirements, documentContext);
      
      logger.info(`Policy generated successfully for ${service}`);
      return structuredPolicy;
      
    } catch (error) {
      logger.error(`Failed to generate policy for ${service}:`, error);
      throw error;
    }
  }

  buildMockPolicy(service, requirements, framework, documentContext = null) {
    const name = `${service.toLowerCase().replace(/\s+/g, '-')}-security-policy`;
    const docNote = documentContext
      ? `\n  # Informed by: ${documentContext.fileName}`
      : '';

    return `# ${service} Security Policy (demo)
apiVersion: v1
kind: SecurityPolicy
metadata:
  name: ${name}
  labels:
    environment: ${requirements.environment || 'production'}
    businessUnit: ${requirements.businessUnit || 'corporate'}
    compliance: ${framework?.name || requirements.compliance || 'CIS'}
    version: "1.0.0"${docNote}
spec:
  encryption:
    atRest: true
    inTransit: true
    algorithm: AES-256
  accessControl:
    authentication: required
    mfa: true
    authorization: rbac
  network:
    allowedSources: []
    blockedPorts: [22, 3389]
  monitoring:
    logging: enabled
    alerting: enabled
  compliance:
    framework: ${framework?.name || 'CIS'}
    version: ${framework?.version || '1.4.0'}
`;
  }

  formatChangePackageForPrompt(documentContext) {
    const pkg = documentContext?.changePackage;
    if (!pkg) {
      // Fallback: structured lists only — never fullText
      const controls = documentContext?.controls || [];
      const risks = documentContext?.risks || [];
      return `
TARGETED EXTRACTION CONTEXT (baseline structured inventory — no full document body):
Document: ${documentContext?.fileName || 'unknown'}
ADDED/BASELINE CONTROLS:
${controls.length ? controls.map((c, i) => `${i + 1}. [${c.id || 'n/a'}] ${c.description || ''}`).join('\n') : 'None'}
ADDED/BASELINE RISKS:
${risks.length ? risks.map((r, i) => `${i + 1}. ${r.description || ''}`).join('\n') : 'None'}
`;
    }

    const fmt = (list, label) =>
      list?.length
        ? list.map((c, i) => `${i + 1}. [${c.id || 'n/a'}] ${c.description || ''}`).join('\n')
        : `None (${label})`;

    const sections = (pkg.changedSections || [])
      .slice(0, 12)
      .map((s) => {
        const parts = [`- [${s.changeType}] ${s.heading}`];
        if (s.beforeSnippet) parts.push(`  before: ${s.beforeSnippet}`);
        if (s.afterSnippet) parts.push(`  after: ${s.afterSnippet}`);
        return parts.join('\n');
      })
      .join('\n');

    return `
TARGETED EXTRACTION PACKAGE (Phase-1 deterministic filter — reason ONLY over this package):
Document: ${documentContext.fileName}
Mode: ${pkg.mode}
Package chars: ${pkg.packageChars || 'n/a'} | Token estimate: ${pkg.stats?.tokenEstimate || 'n/a'}
${pkg.truncated ? 'NOTE: Package was truncated to fit LLM budget.\n' : ''}
ADDED CONTROLS:
${fmt(pkg.addedControls, 'added controls')}

REMOVED CONTROLS:
${fmt(pkg.removedControls, 'removed controls')}

ADDED RISKS:
${fmt(pkg.addedRisks, 'added risks')}

REMOVED RISKS:
${fmt(pkg.removedRisks, 'removed risks')}

ADDED REQUIREMENTS:
${fmt(pkg.addedRequirements, 'added requirements')}

CHANGED SECTIONS (capped snippets only):
${sections || 'None'}

STABLE INVENTORY (IDs only — do not invent unseen page content):
- Control IDs: ${(pkg.stableInventory?.controlIds || []).join(', ') || 'none'}
- Risk IDs: ${(pkg.stableInventory?.riskIds || []).join(', ') || 'none'}

CRITICAL: Do NOT assume content from pages outside this package. Do NOT request or invent full-manual text. High-reasoning focus on extracted changes only.
`;
  }

  buildGenerationPrompt(service, requirements, template, framework, documentContext = null) {
    let contextSection = '';
    let traceabilityNote = '';

    if (documentContext) {
      contextSection = this.formatChangePackageForPrompt(documentContext);

      traceabilityNote = `
TRACEABILITY REQUIREMENT:
For each major policy section, include inline comments referencing ChangePackage control/risk IDs or changed section headings that informed the decision.
`;
    }

    return `
Generate a comprehensive security policy for ${service} with the following requirements:

SERVICE CONTEXT:
- Service: ${service}
- Environment: ${requirements.environment || 'production'}
- Business Unit: ${requirements.businessUnit || 'corporate'}
- Compliance Framework: ${requirements.compliance || 'CIS'}

SECURITY REQUIREMENTS:
${requirements.additionalRequirements || 'Standard security requirements apply'}
${contextSection}
COMPLIANCE REQUIREMENTS:
- Framework: ${framework?.name || requirements.compliance || 'CIS'}
- Version: ${framework?.version || '1.0'}
- Controls: ${(framework?.controls || []).join(', ') || 'Standard controls'}

POLICY TEMPLATE STRUCTURE:
${template?.structure || 'Standard security policy structure'}
${traceabilityNote}
OUTPUT FORMAT:
Generate the policy in YAML format with the following structure:
- Metadata (name, labels, version)
- Encryption requirements (at rest, in transit)
- Access control (authentication, authorization, MFA)
- Network security (allowed sources, blocked ports)
- Monitoring and logging
- Compliance controls mapping
- Risk assessment
${documentContext ? '- Source references (which document sections informed each policy decision)' : ''}

Ensure the policy is:
1. Production-ready and immediately deployable
2. Compliant with the specified framework
3. Tailored to the specific service and environment
${documentContext ? '4. Directly incorporates risks, controls, and requirements from the uploaded organizational document' : '4. Includes proper risk assessment and mitigation strategies'}
5. Follows security best practices for cloud services
${documentContext ? '6. Includes traceability annotations showing which document sections informed policy decisions' : ''}
    `;
  }

  async structurePolicy(rawPolicy, service, requirements, documentContext = null) {
    try {
      // Parse the raw policy and structure it
      const structuredPolicy = {
        metadata: {
          name: `${service.toLowerCase().replace(/\s+/g, '-')}-security-policy`,
          service: service,
          environment: requirements.environment || 'production',
          businessUnit: requirements.businessUnit || 'corporate',
          compliance: requirements.compliance || 'CIS',
          version: '1.0.0',
          generatedBy: 'ai-policy-foundry',
          generatedAt: new Date().toISOString(),
          riskLevel: this.assessRiskLevel(service, requirements),
          ...(documentContext && {
            sourceDocument: {
              id: documentContext.documentId,
              fileName: documentContext.fileName,
              extractedAt: documentContext.extractedAt
            }
          })
        },
        policy: rawPolicy,
        compliance: {
          framework: requirements.compliance || 'CIS',
          controls: this.mapComplianceControls(service, requirements),
          status: 'draft',
          ...(documentContext && {
            documentControls: documentContext.controls.map(c => ({
              id: c.id,
              description: c.description
            }))
          })
        },
        security: {
          riskAssessment: this.performRiskAssessment(service, requirements),
          recommendations: this.generateRecommendations(service, requirements),
          ...(documentContext && {
            documentRisks: documentContext.risks.map(r => ({
              description: r.description
            }))
          })
        },
        ...(documentContext && {
          traceability: {
            sourceDocument: documentContext.fileName,
            documentId: documentContext.documentId,
            extractedElements: {
              risks: documentContext.risks.length,
              controls: documentContext.controls.length,
              requirements: documentContext.requirements.length
            }
          }
        })
      };

      return structuredPolicy;
      
    } catch (error) {
      logger.error('Failed to structure policy:', error);
      throw error;
    }
  }

  async mergePolicyResults(data) {
    try {
      const { policy, compliance, security } = data;
      
      // Merge compliance validation results
      if (compliance.validation) {
        policy.compliance.validation = compliance.validation;
        policy.compliance.status = compliance.validation.passed ? 'validated' : 'needs-review';
      }
      
      // Merge security analysis results
      if (security.analysis) {
        policy.security.analysis = security.analysis;
        policy.security.riskLevel = security.analysis.riskLevel;
      }
      
      // Add recommendations from all sources
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

      // Validate policy structure
      if (!policy.metadata || !policy.policy) {
        validation.passed = false;
        validation.issues.push('Missing required policy structure');
      }

      // Validate compliance mapping
      if (!policy.compliance || !policy.compliance.controls) {
        validation.warnings.push('Compliance controls not mapped');
      }

      // Validate security requirements
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
      // Apply optimization based on requirements
      const optimizedPolicy = { ...policy };
      
      // Optimize for performance if needed
      if (requirements.optimizeFor === 'performance') {
        optimizedPolicy.recommendations.push('Consider caching policies for better performance');
      }
      
      // Optimize for cost if needed
      if (requirements.optimizeFor === 'cost') {
        optimizedPolicy.recommendations.push('Review logging retention periods for cost optimization');
      }
      
      return optimizedPolicy;
      
    } catch (error) {
      logger.error('Failed to optimize policy:', error);
      throw error;
    }
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

  mapComplianceControls(service, requirements) {
    const framework = this.frameworks.get(requirements.compliance || 'CIS');
    if (!framework) return [];
    
    // Map relevant controls based on service type
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
    
    // Add service-specific threats
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
    
    // Add service-specific mitigations
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
    // Load policy templates from database or file system
    const templates = await PolicyTemplate.findAll();
    for (const template of templates) {
      this.templates.set(template.service, template);
    }
    
    // Add default template if not exists
    if (!this.templates.has('default')) {
      this.templates.set('default', {
        service: 'default',
        structure: 'Standard security policy structure',
        version: '1.0.0'
      });
    }
  }

  async loadFrameworks() {
    // Load compliance frameworks from database or file system
    const frameworks = await ComplianceFramework.findAll();
    for (const framework of frameworks) {
      this.frameworks.set(framework.name, framework);
    }

    // Defaults when DB has no seed data (matches ComplianceAgent keys)
    if (!this.frameworks.has('CIS')) {
      this.frameworks.set('CIS', {
        name: 'CIS',
        version: '1.4.0',
        controls: []
      });
    }
    if (!this.frameworks.has('NIST')) {
      this.frameworks.set('NIST', {
        name: 'NIST',
        version: '1.1',
        controls: []
      });
    }
    if (!this.frameworks.has('ISO')) {
      this.frameworks.set('ISO', {
        name: 'ISO',
        version: '27001:2013',
        controls: []
      });
    }
    if (!this.frameworks.has('SOC2')) {
      this.frameworks.set('SOC2', {
        name: 'SOC2',
        version: 'Type II',
        controls: []
      });
    }
    if (!this.frameworks.has('PCI')) {
      this.frameworks.set('PCI', {
        name: 'PCI',
        version: '3.2.1',
        controls: []
      });
    }
  }

  async loadCloudServices() {
    // Load cloud service definitions
    const services = await CloudService.findAll();
    for (const service of services) {
      // Store service-specific information
    }
  }

  async shutdown() {
    logger.info('Shutting down Policy Generation Agent...');
    this.isInitialized = false;
  }
} 