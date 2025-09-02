import { logger } from '../utils/logger.js';
import { ComplianceFramework } from '../models/ComplianceFramework.js';
import { ComplianceControl } from '../models/ComplianceControl.js';

export class ComplianceAgent {
  constructor() {
    this.isInitialized = false;
    this.frameworks = new Map();
    this.controls = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Compliance Agent...');
      
      // Load compliance frameworks
      await this.loadFrameworks();
      
      // Load compliance controls
      await this.loadControls();
      
      this.isInitialized = true;
      logger.info('Compliance Agent initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Compliance Agent:', error);
      throw error;
    }
  }

  async executeTask(task, data) {
    if (!this.isInitialized) {
      throw new Error('Compliance Agent not initialized');
    }

    switch (task) {
      case 'validate':
        return await this.validateCompliance(data.policy, data.framework);
      case 'check-updates':
        return await this.checkFrameworkUpdates();
      case 'map-controls':
        return await this.mapComplianceControls(data.policy, data.framework);
      case 'audit':
        return await this.performComplianceAudit(data.policies);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async validateCompliance(policy, frameworkName) {
    try {
      logger.info(`Validating compliance for policy: ${policy.metadata?.name}`);
      
      const framework = this.frameworks.get(frameworkName || 'CIS');
      if (!framework) {
        throw new Error(`Compliance framework not found: ${frameworkName}`);
      }

      const validation = {
        policyId: policy.metadata?.name,
        framework: frameworkName,
        validationTime: new Date().toISOString(),
        passed: true,
        score: 0,
        issues: [],
        warnings: [],
        recommendations: [],
        controls: []
      };

      // Validate against framework controls
      const controlValidation = await this.validateControls(policy, framework);
      validation.controls = controlValidation.controls;
      validation.score = controlValidation.score;
      validation.passed = controlValidation.passed;
      validation.issues = controlValidation.issues;
      validation.warnings = controlValidation.warnings;
      validation.recommendations = controlValidation.recommendations;

      return validation;
      
    } catch (error) {
      logger.error('Failed to validate compliance:', error);
      throw error;
    }
  }

  async validateControls(policy, framework) {
    const validation = {
      controls: [],
      score: 0,
      passed: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    const relevantControls = this.getRelevantControls(policy, framework);
    let passedControls = 0;

    for (const control of relevantControls) {
      const controlValidation = await this.validateControl(policy, control);
      validation.controls.push(controlValidation);

      if (controlValidation.status === 'passed') {
        passedControls++;
      } else if (controlValidation.status === 'failed') {
        validation.passed = false;
        validation.issues.push(controlValidation.issue);
      } else if (controlValidation.status === 'warning') {
        validation.warnings.push(controlValidation.warning);
      }
    }

    // Calculate compliance score
    validation.score = relevantControls.length > 0 ? 
      (passedControls / relevantControls.length) * 100 : 100;

    // Generate recommendations
    validation.recommendations = this.generateComplianceRecommendations(validation);

    return validation;
  }

  async validateControl(policy, control) {
    const validation = {
      controlId: control.id,
      controlName: control.name,
      status: 'passed',
      description: control.description,
      requirement: control.requirement
    };

    try {
      // Check if policy addresses the control requirement
      const policyContent = JSON.stringify(policy).toLowerCase();
      const controlKeywords = control.keywords || [];
      
      let matches = 0;
      for (const keyword of controlKeywords) {
        if (policyContent.includes(keyword.toLowerCase())) {
          matches++;
        }
      }

      // Determine validation status based on keyword matches
      const matchPercentage = controlKeywords.length > 0 ? 
        matches / controlKeywords.length : 1;

      if (matchPercentage >= 0.8) {
        validation.status = 'passed';
      } else if (matchPercentage >= 0.5) {
        validation.status = 'warning';
        validation.warning = `Partial coverage for control ${control.id}`;
      } else {
        validation.status = 'failed';
        validation.issue = `Missing coverage for control ${control.id}: ${control.requirement}`;
      }

    } catch (error) {
      validation.status = 'error';
      validation.issue = `Error validating control: ${error.message}`;
    }

    return validation;
  }

  getRelevantControls(policy, framework) {
    const relevantControls = [];
    const service = policy.metadata?.service;
    const environment = policy.metadata?.environment;

    for (const control of this.controls.values()) {
      if (control.framework === framework.name) {
        // Check if control applies to this service/environment
        const appliesToService = !control.services || 
          control.services.includes('all') || 
          control.services.includes(service);
        
        const appliesToEnvironment = !control.environments || 
          control.environments.includes('all') || 
          control.environments.includes(environment);

        if (appliesToService && appliesToEnvironment) {
          relevantControls.push(control);
        }
      }
    }

    return relevantControls;
  }

  generateComplianceRecommendations(validation) {
    const recommendations = [];

    if (validation.score < 90) {
      recommendations.push('Review and update policy to improve compliance coverage');
    }

    if (validation.issues.length > 0) {
      recommendations.push('Address failed compliance controls before deployment');
    }

    if (validation.warnings.length > 0) {
      recommendations.push('Review warnings and consider additional controls');
    }

    if (validation.score >= 95) {
      recommendations.push('Policy meets compliance requirements - ready for deployment');
    }

    return recommendations;
  }

  async checkFrameworkUpdates() {
    try {
      logger.info('Checking for compliance framework updates...');
      
      const updates = [];
      
      // Check for framework version updates
      for (const [name, framework] of this.frameworks) {
        const latestVersion = await this.getLatestFrameworkVersion(name);
        
        if (latestVersion && latestVersion !== framework.version) {
          updates.push({
            framework: name,
            currentVersion: framework.version,
            latestVersion: latestVersion,
            updateRequired: true,
            impact: this.assessUpdateImpact(framework, latestVersion)
          });
        }
      }

      return updates;
      
    } catch (error) {
      logger.error('Failed to check framework updates:', error);
      throw error;
    }
  }

  async getLatestFrameworkVersion(frameworkName) {
    // This would typically call external APIs to get latest versions
    // For now, return mock data
    const versionMap = {
      'CIS': '1.5.0',
      'NIST': '2.0.0',
      'ISO': '27001:2022',
      'SOC2': '2017'
    };
    
    return versionMap[frameworkName] || null;
  }

  assessUpdateImpact(framework, newVersion) {
    // Assess the impact of a framework update
    const impact = {
      level: 'low',
      description: 'Minor updates with minimal policy changes required',
      affectedControls: 0,
      breakingChanges: false
    };

    // This would typically analyze the differences between versions
    // For now, return a conservative assessment
    return impact;
  }

  async mapComplianceControls(policy, frameworkName) {
    try {
      const framework = this.frameworks.get(frameworkName || 'CIS');
      if (!framework) {
        throw new Error(`Framework not found: ${frameworkName}`);
      }

      const relevantControls = this.getRelevantControls(policy, framework);
      const mapping = {
        framework: frameworkName,
        policyId: policy.metadata?.name,
        mappedControls: [],
        coverage: {
          total: relevantControls.length,
          mapped: 0,
          percentage: 0
        }
      };

      for (const control of relevantControls) {
        const isMapped = await this.isControlMapped(policy, control);
        mapping.mappedControls.push({
          controlId: control.id,
          controlName: control.name,
          mapped: isMapped,
          evidence: isMapped ? this.extractControlEvidence(policy, control) : null
        });

        if (isMapped) {
          mapping.coverage.mapped++;
        }
      }

      mapping.coverage.percentage = mapping.coverage.total > 0 ? 
        (mapping.coverage.mapped / mapping.coverage.total) * 100 : 100;

      return mapping;
      
    } catch (error) {
      logger.error('Failed to map compliance controls:', error);
      throw error;
    }
  }

  async isControlMapped(policy, control) {
    // Check if the policy content addresses the control
    const policyContent = JSON.stringify(policy).toLowerCase();
    const controlKeywords = control.keywords || [];
    
    let matches = 0;
    for (const keyword of controlKeywords) {
      if (policyContent.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return controlKeywords.length > 0 ? matches / controlKeywords.length >= 0.7 : false;
  }

  extractControlEvidence(policy, control) {
    // Extract specific evidence from policy that addresses the control
    const evidence = {
      controlId: control.id,
      evidenceType: 'policy-content',
      location: 'policy-body',
      description: `Policy contains controls addressing ${control.name}`
    };

    return evidence;
  }

  async performComplianceAudit(policies) {
    try {
      logger.info('Performing compliance audit...');
      
      const audit = {
        auditTime: new Date().toISOString(),
        totalPolicies: policies.length,
        frameworks: {},
        overallScore: 0,
        findings: []
      };

      // Group policies by framework
      const policiesByFramework = {};
      for (const policy of policies) {
        const framework = policy.compliance?.framework || 'CIS';
        if (!policiesByFramework[framework]) {
          policiesByFramework[framework] = [];
        }
        policiesByFramework[framework].push(policy);
      }

      // Audit each framework
      for (const [framework, frameworkPolicies] of Object.entries(policiesByFramework)) {
        const frameworkAudit = await this.auditFramework(framework, frameworkPolicies);
        audit.frameworks[framework] = frameworkAudit;
      }

      // Calculate overall score
      const frameworkScores = Object.values(audit.frameworks)
        .map(f => f.score)
        .filter(score => score !== null);
      
      audit.overallScore = frameworkScores.length > 0 ? 
        frameworkScores.reduce((sum, score) => sum + score, 0) / frameworkScores.length : 0;

      // Generate audit findings
      audit.findings = this.generateAuditFindings(audit);

      return audit;
      
    } catch (error) {
      logger.error('Failed to perform compliance audit:', error);
      throw error;
    }
  }

  async auditFramework(frameworkName, policies) {
    const framework = this.frameworks.get(frameworkName);
    if (!framework) {
      return { error: `Framework not found: ${frameworkName}` };
    }

    const audit = {
      framework: frameworkName,
      totalPolicies: policies.length,
      compliantPolicies: 0,
      score: 0,
      controls: {},
      recommendations: []
    };

    let totalScore = 0;
    const controlCoverage = {};

    for (const policy of policies) {
      const validation = await this.validateCompliance(policy, frameworkName);
      
      if (validation.passed) {
        audit.compliantPolicies++;
      }
      
      totalScore += validation.score;

      // Aggregate control coverage
      for (const control of validation.controls) {
        if (!controlCoverage[control.controlId]) {
          controlCoverage[control.controlId] = {
            total: 0,
            passed: 0,
            failed: 0,
            warnings: 0
          };
        }
        
        controlCoverage[control.controlId].total++;
        controlCoverage[control.controlId][control.status]++;
      }
    }

    audit.score = policies.length > 0 ? totalScore / policies.length : 0;
    audit.controls = controlCoverage;
    audit.recommendations = this.generateFrameworkRecommendations(audit);

    return audit;
  }

  generateFrameworkRecommendations(audit) {
    const recommendations = [];

    if (audit.score < 80) {
      recommendations.push('Implement additional controls to improve compliance score');
    }

    if (audit.compliantPolicies < audit.totalPolicies) {
      recommendations.push('Review and update non-compliant policies');
    }

    // Check for control gaps
    for (const [controlId, coverage] of Object.entries(audit.controls)) {
      if (coverage.failed > 0) {
        recommendations.push(`Address failed controls for ${controlId}`);
      }
    }

    return recommendations;
  }

  generateAuditFindings(audit) {
    const findings = [];

    if (audit.overallScore < 90) {
      findings.push({
        type: 'warning',
        severity: 'medium',
        description: 'Overall compliance score below target threshold',
        recommendation: 'Review and improve policy compliance across all frameworks'
      });
    }

    for (const [framework, frameworkAudit] of Object.entries(audit.frameworks)) {
      if (frameworkAudit.score < 80) {
        findings.push({
          type: 'issue',
          severity: 'high',
          description: `Low compliance score for ${framework} framework`,
          recommendation: `Focus on improving ${framework} compliance`
        });
      }
    }

    return findings;
  }

  async loadFrameworks() {
    try {
      // Load compliance frameworks from database
      const frameworks = await ComplianceFramework.findAll();
      
      for (const framework of frameworks) {
        this.frameworks.set(framework.name, {
          name: framework.name,
          version: framework.version,
          description: framework.description,
          controls: framework.controls || []
        });
      }

      // Add default frameworks if none configured
      if (this.frameworks.size === 0) {
        this.frameworks.set('CIS', {
          name: 'CIS',
          version: '1.4.0',
          description: 'Center for Internet Security Benchmarks',
          controls: []
        });
        
        this.frameworks.set('NIST', {
          name: 'NIST',
          version: '1.1',
          description: 'NIST Cybersecurity Framework',
          controls: []
        });
      }
      
    } catch (error) {
      logger.error('Failed to load compliance frameworks:', error);
      throw error;
    }
  }

  async loadControls() {
    try {
      // Load compliance controls from database
      const controls = await ComplianceControl.findAll();
      
      for (const control of controls) {
        this.controls.set(control.id, {
          id: control.id,
          name: control.name,
          description: control.description,
          framework: control.framework,
          requirement: control.requirement,
          keywords: control.keywords || [],
          services: control.services || ['all'],
          environments: control.environments || ['all']
        });
      }
      
    } catch (error) {
      logger.error('Failed to load compliance controls:', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down Compliance Agent...');
    this.isInitialized = false;
  }
} 