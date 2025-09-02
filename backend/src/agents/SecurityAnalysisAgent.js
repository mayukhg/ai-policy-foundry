import { logger } from '../utils/logger.js';
import { SecurityPolicy } from '../models/SecurityPolicy.js';
import { SecurityRisk } from '../models/SecurityRisk.js';

export class SecurityAnalysisAgent {
  constructor() {
    this.isInitialized = false;
    this.riskModels = new Map();
    this.securityPatterns = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Security Analysis Agent...');
      
      // Load risk models
      await this.loadRiskModels();
      
      // Load security patterns
      await this.loadSecurityPatterns();
      
      this.isInitialized = true;
      logger.info('Security Analysis Agent initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Security Analysis Agent:', error);
      throw error;
    }
  }

  async executeTask(task, data) {
    if (!this.isInitialized) {
      throw new Error('Security Analysis Agent not initialized');
    }

    switch (task) {
      case 'analyze':
        return await this.analyzeSecurityPosture(data.policy, data.context);
      case 'threat-impact':
        return await this.analyzeThreatImpact(data.threats, data.policies);
      case 'risk-assessment':
        return await this.performRiskAssessment(data.policy, data.environment);
      case 'gap-analysis':
        return await this.performGapAnalysis(data.policies, data.requirements);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async analyzeSecurityPosture(policy, context = {}) {
    try {
      logger.info(`Analyzing security posture for policy: ${policy.metadata?.name}`);
      
      const analysis = {
        policyId: policy.metadata?.name,
        analysisTime: new Date().toISOString(),
        overallScore: 0,
        riskLevel: 'low',
        strengths: [],
        weaknesses: [],
        recommendations: [],
        securityControls: {},
        complianceGaps: [],
        threatExposure: {}
      };

      // Analyze security controls
      const controlAnalysis = await this.analyzeSecurityControls(policy);
      analysis.securityControls = controlAnalysis;
      analysis.overallScore = controlAnalysis.score;

      // Identify strengths and weaknesses
      analysis.strengths = this.identifyStrengths(controlAnalysis);
      analysis.weaknesses = this.identifyWeaknesses(controlAnalysis);

      // Assess risk level
      analysis.riskLevel = this.calculateRiskLevel(analysis.overallScore, context);

      // Generate recommendations
      analysis.recommendations = this.generateSecurityRecommendations(analysis);

      // Assess threat exposure
      analysis.threatExposure = await this.assessThreatExposure(policy, context);

      return analysis;
      
    } catch (error) {
      logger.error('Failed to analyze security posture:', error);
      throw error;
    }
  }

  async analyzeSecurityControls(policy) {
    const controls = {
      encryption: this.analyzeEncryptionControls(policy),
      accessControl: this.analyzeAccessControls(policy),
      networkSecurity: this.analyzeNetworkSecurity(policy),
      monitoring: this.analyzeMonitoringControls(policy),
      logging: this.analyzeLoggingControls(policy),
      backup: this.analyzeBackupControls(policy),
      incidentResponse: this.analyzeIncidentResponseControls(policy)
    };

    // Calculate overall score
    const scores = Object.values(controls).map(c => c.score);
    const overallScore = scores.length > 0 ? 
      scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

    return {
      ...controls,
      score: overallScore,
      totalControls: Object.keys(controls).length,
      implementedControls: Object.values(controls).filter(c => c.implemented).length
    };
  }

  analyzeEncryptionControls(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for encryption at rest
    if (policyContent.includes('encryption') && policyContent.includes('rest')) {
      analysis.implemented = true;
      analysis.score += 30;
      analysis.details.push('Encryption at rest configured');
    } else {
      analysis.recommendations.push('Implement encryption at rest');
    }

    // Check for encryption in transit
    if (policyContent.includes('encryption') && policyContent.includes('transit')) {
      analysis.score += 30;
      analysis.details.push('Encryption in transit configured');
    } else {
      analysis.recommendations.push('Implement encryption in transit');
    }

    // Check for key management
    if (policyContent.includes('kms') || policyContent.includes('key management')) {
      analysis.score += 20;
      analysis.details.push('Key management system configured');
    } else {
      analysis.recommendations.push('Implement proper key management');
    }

    // Check for algorithm strength
    if (policyContent.includes('aes-256') || policyContent.includes('strong encryption')) {
      analysis.score += 20;
      analysis.details.push('Strong encryption algorithms configured');
    } else {
      analysis.recommendations.push('Use strong encryption algorithms (AES-256)');
    }

    return analysis;
  }

  analyzeAccessControls(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for authentication
    if (policyContent.includes('authentication') || policyContent.includes('auth')) {
      analysis.implemented = true;
      analysis.score += 25;
      analysis.details.push('Authentication configured');
    } else {
      analysis.recommendations.push('Implement authentication controls');
    }

    // Check for authorization
    if (policyContent.includes('authorization') || policyContent.includes('rbac')) {
      analysis.score += 25;
      analysis.details.push('Authorization/RBAC configured');
    } else {
      analysis.recommendations.push('Implement authorization controls');
    }

    // Check for MFA
    if (policyContent.includes('mfa') || policyContent.includes('multi-factor')) {
      analysis.score += 25;
      analysis.details.push('Multi-factor authentication configured');
    } else {
      analysis.recommendations.push('Implement multi-factor authentication');
    }

    // Check for least privilege
    if (policyContent.includes('least privilege') || policyContent.includes('minimal access')) {
      analysis.score += 25;
      analysis.details.push('Least privilege principle implemented');
    } else {
      analysis.recommendations.push('Implement least privilege access controls');
    }

    return analysis;
  }

  analyzeNetworkSecurity(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for network segmentation
    if (policyContent.includes('vpc') || policyContent.includes('subnet') || policyContent.includes('network segmentation')) {
      analysis.implemented = true;
      analysis.score += 30;
      analysis.details.push('Network segmentation configured');
    } else {
      analysis.recommendations.push('Implement network segmentation');
    }

    // Check for firewall rules
    if (policyContent.includes('firewall') || policyContent.includes('security group')) {
      analysis.score += 25;
      analysis.details.push('Firewall/security groups configured');
    } else {
      analysis.recommendations.push('Configure firewall rules');
    }

    // Check for allowed sources
    if (policyContent.includes('allowed sources') || policyContent.includes('whitelist')) {
      analysis.score += 25;
      analysis.details.push('Allowed sources configured');
    } else {
      analysis.recommendations.push('Configure allowed source IPs');
    }

    // Check for blocked ports
    if (policyContent.includes('blocked ports') || policyContent.includes('port restrictions')) {
      analysis.score += 20;
      analysis.details.push('Port restrictions configured');
    } else {
      analysis.recommendations.push('Configure port restrictions');
    }

    return analysis;
  }

  analyzeMonitoringControls(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for monitoring
    if (policyContent.includes('monitoring') || policyContent.includes('alerting')) {
      analysis.implemented = true;
      analysis.score += 40;
      analysis.details.push('Monitoring and alerting configured');
    } else {
      analysis.recommendations.push('Implement monitoring and alerting');
    }

    // Check for real-time monitoring
    if (policyContent.includes('real-time') || policyContent.includes('continuous monitoring')) {
      analysis.score += 30;
      analysis.details.push('Real-time monitoring configured');
    } else {
      analysis.recommendations.push('Implement real-time monitoring');
    }

    // Check for anomaly detection
    if (policyContent.includes('anomaly') || policyContent.includes('behavioral analysis')) {
      analysis.score += 30;
      analysis.details.push('Anomaly detection configured');
    } else {
      analysis.recommendations.push('Implement anomaly detection');
    }

    return analysis;
  }

  analyzeLoggingControls(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for logging
    if (policyContent.includes('logging') || policyContent.includes('audit')) {
      analysis.implemented = true;
      analysis.score += 30;
      analysis.details.push('Logging configured');
    } else {
      analysis.recommendations.push('Implement comprehensive logging');
    }

    // Check for log retention
    if (policyContent.includes('retention') || policyContent.includes('90d')) {
      analysis.score += 25;
      analysis.details.push('Log retention configured');
    } else {
      analysis.recommendations.push('Configure log retention policies');
    }

    // Check for log analysis
    if (policyContent.includes('log analysis') || policyContent.includes('siem')) {
      analysis.score += 25;
      analysis.details.push('Log analysis configured');
    } else {
      analysis.recommendations.push('Implement log analysis');
    }

    // Check for secure logging
    if (policyContent.includes('secure logging') || policyContent.includes('log integrity')) {
      analysis.score += 20;
      analysis.details.push('Secure logging configured');
    } else {
      analysis.recommendations.push('Implement secure logging');
    }

    return analysis;
  }

  analyzeBackupControls(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for backup
    if (policyContent.includes('backup') || policyContent.includes('recovery')) {
      analysis.implemented = true;
      analysis.score += 50;
      analysis.details.push('Backup and recovery configured');
    } else {
      analysis.recommendations.push('Implement backup and recovery');
    }

    // Check for automated backup
    if (policyContent.includes('automated backup') || policyContent.includes('scheduled backup')) {
      analysis.score += 50;
      analysis.details.push('Automated backup configured');
    } else {
      analysis.recommendations.push('Implement automated backup');
    }

    return analysis;
  }

  analyzeIncidentResponseControls(policy) {
    const analysis = {
      implemented: false,
      score: 0,
      details: [],
      recommendations: []
    };

    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Check for incident response
    if (policyContent.includes('incident response') || policyContent.includes('ir plan')) {
      analysis.implemented = true;
      analysis.score += 50;
      analysis.details.push('Incident response plan configured');
    } else {
      analysis.recommendations.push('Implement incident response plan');
    }

    // Check for automated response
    if (policyContent.includes('automated response') || policyContent.includes('auto-remediation')) {
      analysis.score += 50;
      analysis.details.push('Automated incident response configured');
    } else {
      analysis.recommendations.push('Implement automated incident response');
    }

    return analysis;
  }

  identifyStrengths(controlAnalysis) {
    const strengths = [];
    
    for (const [control, analysis] of Object.entries(controlAnalysis)) {
      if (control === 'score' || control === 'totalControls' || control === 'implementedControls') {
        continue;
      }
      
      if (analysis.score >= 80) {
        strengths.push(`${control}: ${analysis.details.join(', ')}`);
      }
    }
    
    return strengths;
  }

  identifyWeaknesses(controlAnalysis) {
    const weaknesses = [];
    
    for (const [control, analysis] of Object.entries(controlAnalysis)) {
      if (control === 'score' || control === 'totalControls' || control === 'implementedControls') {
        continue;
      }
      
      if (analysis.score < 50) {
        weaknesses.push(`${control}: ${analysis.recommendations.join(', ')}`);
      }
    }
    
    return weaknesses;
  }

  calculateRiskLevel(score, context) {
    let riskLevel = 'low';
    
    if (score < 30) riskLevel = 'critical';
    else if (score < 50) riskLevel = 'high';
    else if (score < 70) riskLevel = 'medium';
    else if (score < 90) riskLevel = 'low';
    else riskLevel = 'minimal';
    
    // Adjust based on context
    if (context.environment === 'production' && riskLevel === 'medium') {
      riskLevel = 'high';
    }
    
    return riskLevel;
  }

  generateSecurityRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.overallScore < 70) {
      recommendations.push('Implement comprehensive security controls to improve overall posture');
    }
    
    if (analysis.weaknesses.length > 0) {
      recommendations.push('Address identified security weaknesses as priority');
    }
    
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      recommendations.push('Immediate action required to reduce security risk');
    }
    
    // Add specific recommendations from control analysis
    for (const [control, controlAnalysis] of Object.entries(analysis.securityControls)) {
      if (control === 'score' || control === 'totalControls' || control === 'implementedControls') {
        continue;
      }
      
      if (controlAnalysis.recommendations.length > 0) {
        recommendations.push(...controlAnalysis.recommendations);
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  async assessThreatExposure(policy, context) {
    const exposure = {
      threatVectors: [],
      exposureLevel: 'low',
      vulnerableServices: [],
      mitigationStatus: {}
    };
    
    // Identify potential threat vectors based on policy content
    const policyContent = JSON.stringify(policy).toLowerCase();
    
    if (policyContent.includes('public') || policyContent.includes('internet')) {
      exposure.threatVectors.push('Internet exposure');
      exposure.exposureLevel = 'medium';
    }
    
    if (policyContent.includes('api') || policyContent.includes('endpoint')) {
      exposure.threatVectors.push('API exposure');
    }
    
    if (policyContent.includes('database') || policyContent.includes('storage')) {
      exposure.threatVectors.push('Data exposure');
    }
    
    // Assess mitigation status
    exposure.mitigationStatus = {
      encryption: policyContent.includes('encryption'),
      accessControl: policyContent.includes('authentication'),
      monitoring: policyContent.includes('monitoring'),
      logging: policyContent.includes('logging')
    };
    
    return exposure;
  }

  async analyzeThreatImpact(threats, policies) {
    try {
      const impact = {
        analysisTime: new Date().toISOString(),
        affectedPolicies: [],
        riskAssessment: {},
        recommendations: []
      };
      
      for (const threat of threats) {
        const threatImpact = await this.assessSingleThreatImpact(threat, policies);
        impact.affectedPolicies.push(...threatImpact.affectedPolicies);
        impact.riskAssessment[threat.id] = threatImpact.riskLevel;
      }
      
      // Generate recommendations
      impact.recommendations = this.generateThreatRecommendations(impact);
      
      return impact;
      
    } catch (error) {
      logger.error('Failed to analyze threat impact:', error);
      throw error;
    }
  }

  async assessSingleThreatImpact(threat, policies) {
    const impact = {
      threatId: threat.id,
      affectedPolicies: [],
      riskLevel: 'low'
    };
    
    for (const policy of policies) {
      if (this.isPolicyVulnerableToThreat(policy, threat)) {
        impact.affectedPolicies.push({
          policyId: policy.metadata?.name,
          service: policy.metadata?.service,
          vulnerability: threat.title
        });
      }
    }
    
    // Assess risk level based on number of affected policies
    if (impact.affectedPolicies.length > 5) {
      impact.riskLevel = 'high';
    } else if (impact.affectedPolicies.length > 2) {
      impact.riskLevel = 'medium';
    }
    
    return impact;
  }

  isPolicyVulnerableToThreat(policy, threat) {
    // Check if policy is vulnerable to the specific threat
    const policyContent = JSON.stringify(policy).toLowerCase();
    const threatKeywords = threat.title.toLowerCase().split(' ');
    
    for (const keyword of threatKeywords) {
      if (policyContent.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  generateThreatRecommendations(impact) {
    const recommendations = [];
    
    if (impact.affectedPolicies.length > 0) {
      recommendations.push('Review and update affected policies to address identified threats');
    }
    
    const highRiskThreats = Object.entries(impact.riskAssessment)
      .filter(([_, risk]) => risk === 'high')
      .map(([threatId, _]) => threatId);
    
    if (highRiskThreats.length > 0) {
      recommendations.push('Prioritize addressing high-risk threats');
    }
    
    return recommendations;
  }

  async performRiskAssessment(policy, environment) {
    try {
      const assessment = {
        policyId: policy.metadata?.name,
        assessmentTime: new Date().toISOString(),
        environment: environment,
        riskFactors: [],
        overallRisk: 'low',
        riskScore: 0,
        mitigations: []
      };
      
      // Identify risk factors
      assessment.riskFactors = this.identifyRiskFactors(policy, environment);
      
      // Calculate risk score
      assessment.riskScore = this.calculateRiskScore(assessment.riskFactors);
      
      // Determine overall risk level
      assessment.overallRisk = this.determineRiskLevel(assessment.riskScore);
      
      // Suggest mitigations
      assessment.mitigations = this.suggestRiskMitigations(assessment.riskFactors);
      
      return assessment;
      
    } catch (error) {
      logger.error('Failed to perform risk assessment:', error);
      throw error;
    }
  }

  identifyRiskFactors(policy, environment) {
    const factors = [];
    const policyContent = JSON.stringify(policy).toLowerCase();
    
    // Environment-based risks
    if (environment === 'production') {
      factors.push({ type: 'environment', risk: 'high', description: 'Production environment' });
    }
    
    // Service-based risks
    if (policyContent.includes('iam') || policyContent.includes('kms')) {
      factors.push({ type: 'service', risk: 'high', description: 'Critical security service' });
    }
    
    if (policyContent.includes('database') || policyContent.includes('storage')) {
      factors.push({ type: 'service', risk: 'medium', description: 'Data storage service' });
    }
    
    // Configuration-based risks
    if (policyContent.includes('public') || policyContent.includes('internet')) {
      factors.push({ type: 'configuration', risk: 'high', description: 'Public internet exposure' });
    }
    
    return factors;
  }

  calculateRiskScore(riskFactors) {
    let score = 0;
    
    for (const factor of riskFactors) {
      switch (factor.risk) {
        case 'high': score += 3; break;
        case 'medium': score += 2; break;
        case 'low': score += 1; break;
      }
    }
    
    return Math.min(score, 10);
  }

  determineRiskLevel(score) {
    if (score >= 8) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'low';
    return 'minimal';
  }

  suggestRiskMitigations(riskFactors) {
    const mitigations = [];
    
    for (const factor of riskFactors) {
      switch (factor.type) {
        case 'environment':
          if (factor.risk === 'high') {
            mitigations.push('Implement additional monitoring and controls for production environment');
          }
          break;
        case 'service':
          if (factor.risk === 'high') {
            mitigations.push('Implement strict access controls and monitoring for critical services');
          }
          break;
        case 'configuration':
          if (factor.risk === 'high') {
            mitigations.push('Review and restrict public access where possible');
          }
          break;
      }
    }
    
    return mitigations;
  }

  async performGapAnalysis(policies, requirements) {
    try {
      const analysis = {
        analysisTime: new Date().toISOString(),
        coverage: {},
        gaps: [],
        recommendations: []
      };
      
      // Analyze coverage by requirement
      for (const requirement of requirements) {
        const coverage = this.analyzeRequirementCoverage(policies, requirement);
        analysis.coverage[requirement] = coverage;
        
        if (coverage.percentage < 80) {
          analysis.gaps.push({
            requirement: requirement,
            coverage: coverage.percentage,
            missingPolicies: coverage.missingPolicies
          });
        }
      }
      
      // Generate recommendations
      analysis.recommendations = this.generateGapRecommendations(analysis.gaps);
      
      return analysis;
      
    } catch (error) {
      logger.error('Failed to perform gap analysis:', error);
      throw error;
    }
  }

  analyzeRequirementCoverage(policies, requirement) {
    const coverage = {
      requirement: requirement,
      totalPolicies: policies.length,
      coveredPolicies: 0,
      percentage: 0,
      missingPolicies: []
    };
    
    for (const policy of policies) {
      if (this.policyCoversRequirement(policy, requirement)) {
        coverage.coveredPolicies++;
      } else {
        coverage.missingPolicies.push(policy.metadata?.name);
      }
    }
    
    coverage.percentage = coverage.totalPolicies > 0 ? 
      (coverage.coveredPolicies / coverage.totalPolicies) * 100 : 0;
    
    return coverage;
  }

  policyCoversRequirement(policy, requirement) {
    const policyContent = JSON.stringify(policy).toLowerCase();
    const requirementKeywords = requirement.toLowerCase().split(' ');
    
    for (const keyword of requirementKeywords) {
      if (policyContent.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  generateGapRecommendations(gaps) {
    const recommendations = [];
    
    for (const gap of gaps) {
      recommendations.push(`Improve coverage for ${gap.requirement} (currently ${gap.coverage}%)`);
    }
    
    if (gaps.length > 0) {
      recommendations.push('Develop additional policies to address identified gaps');
    }
    
    return recommendations;
  }

  async loadRiskModels() {
    // Load risk assessment models
    this.riskModels.set('default', {
      name: 'Default Risk Model',
      factors: ['environment', 'service', 'configuration', 'exposure'],
      weights: { environment: 0.3, service: 0.3, configuration: 0.2, exposure: 0.2 }
    });
  }

  async loadSecurityPatterns() {
    // Load security patterns for analysis
    this.securityPatterns.set('encryption', {
      name: 'Encryption Pattern',
      keywords: ['encryption', 'aes', 'tls', 'ssl'],
      score: 30
    });
    
    this.securityPatterns.set('access-control', {
      name: 'Access Control Pattern',
      keywords: ['authentication', 'authorization', 'rbac', 'mfa'],
      score: 25
    });
    
    this.securityPatterns.set('monitoring', {
      name: 'Monitoring Pattern',
      keywords: ['monitoring', 'alerting', 'logging', 'audit'],
      score: 20
    });
  }

  async shutdown() {
    logger.info('Shutting down Security Analysis Agent...');
    this.isInitialized = false;
  }
} 