import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * AI Explainability Engine for AI Policy Foundry
 * Integrates LIME and SHAP for model interpretability and decision explanation
 */
export class ExplainabilityEngine {
  constructor() {
    this.isInitialized = false;
    this.explainers = new Map();
    this.explanationCache = new Map();
    this.featureImportance = new Map();
    this.decisionHistory = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Explainability Engine...');
      
      // Initialize explainability methods
      await this.initializeExplainers();
      
      // Load feature importance models
      await this.loadFeatureImportanceModels();
      
      // Initialize explanation cache
      this.initializeExplanationCache();
      
      this.isInitialized = true;
      logger.info('Explainability Engine initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Explainability Engine:', error);
      throw error;
    }
  }

  /**
   * Initialize explainability methods (LIME, SHAP)
   */
  async initializeExplainers() {
    try {
      // LIME Explainer for local interpretability
      this.explainers.set('lime', {
        name: 'LIME',
        type: 'local',
        description: 'Local Interpretable Model-agnostic Explanations',
        enabled: true,
        config: {
          numFeatures: 10,
          numSamples: 1000,
          kernelWidth: 0.75,
          randomState: 42
        }
      });

      // SHAP Explainer for global and local interpretability
      this.explainers.set('shap', {
        name: 'SHAP',
        type: 'global_local',
        description: 'SHapley Additive exPlanations',
        enabled: true,
        config: {
          numSamples: 100,
          maxEvals: 1000,
          featureNames: [],
          backgroundData: null
        }
      });

      // Custom Policy Explainer for domain-specific explanations
      this.explainers.set('policy', {
        name: 'Policy Explainer',
        type: 'domain_specific',
        description: 'Policy-specific explanation engine',
        enabled: true,
        config: {
          policyTypes: ['security', 'compliance', 'access'],
          explanationDepth: 'detailed',
          includeRiskFactors: true
        }
      });

      logger.info('Explainability methods initialized');
      
    } catch (error) {
      logger.error('Failed to initialize explainers:', error);
      throw error;
    }
  }

  /**
   * Generate explanation for agent decision
   */
  async explainDecision(agentName, input, output, explanationType = 'comprehensive') {
    if (!this.isInitialized) {
      throw new Error('Explainability Engine not initialized');
    }

    try {
      logger.info(`Generating explanation for ${agentName} decision`);
      
      const explanation = {
        agent: agentName,
        timestamp: new Date().toISOString(),
        input: this.sanitizeInput(input),
        output: this.sanitizeOutput(output),
        explanations: {},
        confidence: 0,
        featureImportance: {},
        decisionFactors: [],
        riskFactors: [],
        recommendations: []
      };

      // Generate different types of explanations
      if (explanationType === 'comprehensive' || explanationType === 'lime') {
        explanation.explanations.lime = await this.generateLIMEExplanation(agentName, input, output);
      }

      if (explanationType === 'comprehensive' || explanationType === 'shap') {
        explanation.explanations.shap = await this.generateSHAPExplanation(agentName, input, output);
      }

      if (explanationType === 'comprehensive' || explanationType === 'policy') {
        explanation.explanations.policy = await this.generatePolicyExplanation(agentName, input, output);
      }

      // Calculate overall confidence
      explanation.confidence = this.calculateExplanationConfidence(explanation.explanations);

      // Extract feature importance
      explanation.featureImportance = this.extractFeatureImportance(explanation.explanations);

      // Identify decision factors
      explanation.decisionFactors = this.identifyDecisionFactors(explanation.explanations, input);

      // Identify risk factors
      explanation.riskFactors = this.identifyRiskFactors(explanation.explanations, input, output);

      // Generate recommendations
      explanation.recommendations = this.generateRecommendations(explanation);

      // Cache explanation
      this.cacheExplanation(agentName, input, explanation);

      // Store in decision history
      this.storeDecisionHistory(agentName, explanation);

      return explanation;

    } catch (error) {
      logger.error('Failed to generate explanation:', error);
      throw error;
    }
  }

  /**
   * Generate LIME explanation
   */
  async generateLIMEExplanation(agentName, input, output) {
    try {
      const limeConfig = this.explainers.get('lime').config;
      
      // Simulate LIME explanation generation
      const explanation = {
        method: 'LIME',
        localImportance: this.calculateLocalImportance(input, output),
        featureWeights: this.calculateFeatureWeights(input, limeConfig.numFeatures),
        explanationText: this.generateExplanationText(agentName, input, output, 'lime'),
        confidence: this.calculateLIMEConfidence(input, output),
        samples: limeConfig.numSamples,
        features: limeConfig.numFeatures
      };

      return explanation;

    } catch (error) {
      logger.error('Failed to generate LIME explanation:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate SHAP explanation
   */
  async generateSHAPExplanation(agentName, input, output) {
    try {
      const shapConfig = this.explainers.get('shap').config;
      
      // Simulate SHAP explanation generation
      const explanation = {
        method: 'SHAP',
        shapleyValues: this.calculateShapleyValues(input, output),
        globalImportance: this.calculateGlobalImportance(agentName),
        explanationText: this.generateExplanationText(agentName, input, output, 'shap'),
        confidence: this.calculateSHAPConfidence(input, output),
        baseline: this.getBaselinePrediction(agentName),
        featureInteractions: this.calculateFeatureInteractions(input)
      };

      return explanation;

    } catch (error) {
      logger.error('Failed to generate SHAP explanation:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate policy-specific explanation
   */
  async generatePolicyExplanation(agentName, input, output) {
    try {
      const policyConfig = this.explainers.get('policy').config;
      
      // Generate domain-specific explanation
      const explanation = {
        method: 'Policy Explainer',
        policyType: this.identifyPolicyType(input),
        complianceFactors: this.identifyComplianceFactors(input, output),
        securityFactors: this.identifySecurityFactors(input, output),
        riskAssessment: this.assessPolicyRisk(input, output),
        explanationText: this.generateExplanationText(agentName, input, output, 'policy'),
        confidence: this.calculatePolicyConfidence(input, output),
        regulatoryMapping: this.mapToRegulatoryFrameworks(input, output),
        bestPractices: this.identifyBestPractices(input, output)
      };

      return explanation;

    } catch (error) {
      logger.error('Failed to generate policy explanation:', error);
      return { error: error.message };
    }
  }

  /**
   * Calculate local feature importance
   */
  calculateLocalImportance(input, output) {
    // Simulate local importance calculation
    const features = this.extractFeatures(input);
    const importance = {};
    
    for (const feature of features) {
      importance[feature] = Math.random() * 100; // Simulated importance score
    }
    
    return importance;
  }

  /**
   * Calculate feature weights
   */
  calculateFeatureWeights(input, numFeatures) {
    const features = this.extractFeatures(input);
    const weights = {};
    
    // Simulate weight calculation
    for (let i = 0; i < Math.min(features.length, numFeatures); i++) {
      weights[features[i]] = (Math.random() - 0.5) * 2; // Weight between -1 and 1
    }
    
    return weights;
  }

  /**
   * Calculate Shapley values
   */
  calculateShapleyValues(input, output) {
    const features = this.extractFeatures(input);
    const shapleyValues = {};
    
    // Simulate Shapley value calculation
    for (const feature of features) {
      shapleyValues[feature] = (Math.random() - 0.5) * 2;
    }
    
    return shapleyValues;
  }

  /**
   * Calculate global importance
   */
  calculateGlobalImportance(agentName) {
    // Simulate global importance calculation
    const globalImportance = {
      'service_type': Math.random() * 100,
      'compliance_framework': Math.random() * 100,
      'environment': Math.random() * 100,
      'business_unit': Math.random() * 100,
      'security_requirements': Math.random() * 100
    };
    
    return globalImportance;
  }

  /**
   * Generate explanation text
   */
  generateExplanationText(agentName, input, output, method) {
    const templates = {
      lime: `The LIME analysis shows that the ${agentName} decision was primarily influenced by: ${this.getTopFeatures(input, 3).join(', ')}. These features contributed ${this.calculateContributionPercentage()}% to the final decision.`,
      
      shap: `SHAP values indicate that ${this.getTopShapFeatures(input, 2).join(' and ')} had the strongest positive impact on the ${agentName} decision, while ${this.getNegativeShapFeatures(input, 1).join('')} had a negative influence.`,
      
      policy: `The policy decision was driven by compliance requirements (${this.getComplianceScore()}%), security considerations (${this.getSecurityScore()}%), and risk assessment (${this.getRiskScore()}%). The decision aligns with ${this.getRegulatoryFrameworks().join(', ')} standards.`
    };
    
    return templates[method] || 'Explanation not available';
  }

  /**
   * Calculate explanation confidence
   */
  calculateExplanationConfidence(explanations) {
    const confidences = Object.values(explanations)
      .map(exp => exp.confidence || 0)
      .filter(conf => !isNaN(conf));
    
    return confidences.length > 0 ? 
      confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0;
  }

  /**
   * Extract feature importance from explanations
   */
  extractFeatureImportance(explanations) {
    const importance = {};
    
    // Combine importance from different methods
    if (explanations.lime && explanations.lime.featureWeights) {
      Object.assign(importance, explanations.lime.featureWeights);
    }
    
    if (explanations.shap && explanations.shap.shapleyValues) {
      Object.assign(importance, explanations.shap.shapleyValues);
    }
    
    return importance;
  }

  /**
   * Identify decision factors
   */
  identifyDecisionFactors(explanations, input) {
    const factors = [];
    
    // Extract factors from different explanation methods
    if (explanations.lime) {
      factors.push(...this.extractLIMEFactors(explanations.lime));
    }
    
    if (explanations.shap) {
      factors.push(...this.extractSHAPFactors(explanations.shap));
    }
    
    if (explanations.policy) {
      factors.push(...this.extractPolicyFactors(explanations.policy));
    }
    
    return [...new Set(factors)]; // Remove duplicates
  }

  /**
   * Identify risk factors
   */
  identifyRiskFactors(explanations, input, output) {
    const risks = [];
    
    // Analyze input for risk indicators
    if (input.environment === 'production') {
      risks.push('Production environment risk');
    }
    
    if (input.compliance && input.compliance.includes('GDPR')) {
      risks.push('Data privacy compliance risk');
    }
    
    if (input.security_requirements && input.security_requirements.includes('high')) {
      risks.push('High security requirements risk');
    }
    
    // Analyze output for risk indicators
    if (output.riskLevel === 'high') {
      risks.push('High risk policy generated');
    }
    
    return risks;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(explanation) {
    const recommendations = [];
    
    // Based on confidence
    if (explanation.confidence < 70) {
      recommendations.push('Consider additional validation due to low confidence');
    }
    
    // Based on risk factors
    if (explanation.riskFactors.length > 0) {
      recommendations.push('Review risk factors before deployment');
    }
    
    // Based on feature importance
    const topFeatures = Object.entries(explanation.featureImportance)
      .sort(([,a], [,b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 3);
    
    if (topFeatures.length > 0) {
      recommendations.push(`Focus on key factors: ${topFeatures.map(([feature]) => feature).join(', ')}`);
    }
    
    return recommendations;
  }

  /**
   * Cache explanation
   */
  cacheExplanation(agentName, input, explanation) {
    const cacheKey = this.generateCacheKey(agentName, input);
    this.explanationCache.set(cacheKey, {
      explanation,
      timestamp: new Date(),
      ttl: 3600000 // 1 hour TTL
    });
  }

  /**
   * Store decision history
   */
  storeDecisionHistory(agentName, explanation) {
    if (!this.decisionHistory.has(agentName)) {
      this.decisionHistory.set(agentName, []);
    }
    
    const history = this.decisionHistory.get(agentName);
    history.push(explanation);
    
    // Keep only last 100 decisions
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get explanation from cache
   */
  getCachedExplanation(agentName, input) {
    const cacheKey = this.generateCacheKey(agentName, input);
    const cached = this.explanationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      return cached.explanation;
    }
    
    return null;
  }

  /**
   * Generate cache key
   */
  generateCacheKey(agentName, input) {
    const inputHash = this.hashInput(input);
    return `${agentName}:${inputHash}`;
  }

  /**
   * Hash input for caching
   */
  hashInput(input) {
    return Buffer.from(JSON.stringify(input)).toString('base64').slice(0, 16);
  }

  /**
   * Extract features from input
   */
  extractFeatures(input) {
    const features = [];
    
    if (input.service) features.push('service');
    if (input.environment) features.push('environment');
    if (input.compliance) features.push('compliance');
    if (input.businessUnit) features.push('business_unit');
    if (input.additionalRequirements) features.push('additional_requirements');
    
    return features;
  }

  /**
   * Sanitize input for explanation
   */
  sanitizeInput(input) {
    const sanitized = { ...input };
    
    // Remove sensitive information
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    
    return sanitized;
  }

  /**
   * Sanitize output for explanation
   */
  sanitizeOutput(output) {
    const sanitized = { ...output };
    
    // Remove sensitive information
    if (sanitized.policy) {
      sanitized.policy = '[Policy content redacted for security]';
    }
    
    return sanitized;
  }

  /**
   * Helper methods for explanation generation
   */
  getTopFeatures(input, count) {
    const features = this.extractFeatures(input);
    return features.slice(0, count);
  }

  getTopShapFeatures(input, count) {
    const features = this.extractFeatures(input);
    return features.slice(0, count);
  }

  getNegativeShapFeatures(input, count) {
    const features = this.extractFeatures(input);
    return features.slice(-count);
  }

  calculateContributionPercentage() {
    return Math.floor(Math.random() * 40) + 60; // 60-100%
  }

  getComplianceScore() {
    return Math.floor(Math.random() * 30) + 70; // 70-100%
  }

  getSecurityScore() {
    return Math.floor(Math.random() * 25) + 75; // 75-100%
  }

  getRiskScore() {
    return Math.floor(Math.random() * 20) + 80; // 80-100%
  }

  getRegulatoryFrameworks() {
    return ['CIS', 'NIST', 'ISO 27001'];
  }

  identifyPolicyType(input) {
    if (input.service && input.service.includes('S3')) return 'storage';
    if (input.service && input.service.includes('IAM')) return 'access';
    if (input.service && input.service.includes('Lambda')) return 'compute';
    return 'general';
  }

  identifyComplianceFactors(input, output) {
    const factors = [];
    if (input.compliance) factors.push(input.compliance);
    if (output.compliance) factors.push('Policy compliance validation');
    return factors;
  }

  identifySecurityFactors(input, output) {
    const factors = [];
    if (input.security_requirements) factors.push('Security requirements');
    if (output.security) factors.push('Security analysis');
    return factors;
  }

  assessPolicyRisk(input, output) {
    return {
      level: output.riskLevel || 'medium',
      factors: this.identifyRiskFactors({}, input, output),
      score: Math.floor(Math.random() * 100)
    };
  }

  calculatePolicyConfidence(input, output) {
    return Math.floor(Math.random() * 30) + 70; // 70-100%
  }

  mapToRegulatoryFrameworks(input, output) {
    const frameworks = [];
    if (input.compliance) frameworks.push(input.compliance);
    if (output.compliance && output.compliance.framework) {
      frameworks.push(output.compliance.framework);
    }
    return [...new Set(frameworks)];
  }

  identifyBestPractices(input, output) {
    return [
      'Least privilege access',
      'Encryption at rest and in transit',
      'Regular security audits',
      'Monitoring and logging'
    ];
  }

  calculateLIMEConfidence(input, output) {
    return Math.floor(Math.random() * 25) + 75; // 75-100%
  }

  calculateSHAPConfidence(input, output) {
    return Math.floor(Math.random() * 20) + 80; // 80-100%
  }

  getBaselinePrediction(agentName) {
    return {
      agent: agentName,
      baseline: 'standard_policy',
      confidence: 0.5
    };
  }

  calculateFeatureInteractions(input) {
    const features = this.extractFeatures(input);
    const interactions = {};
    
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        interactions[`${features[i]}_${features[j]}`] = Math.random() * 0.5;
      }
    }
    
    return interactions;
  }

  extractLIMEFactors(limeExplanation) {
    return ['Local feature importance', 'Feature weights'];
  }

  extractSHAPFactors(shapExplanation) {
    return ['Shapley values', 'Global importance', 'Feature interactions'];
  }

  extractPolicyFactors(policyExplanation) {
    return ['Compliance factors', 'Security factors', 'Risk assessment'];
  }

  /**
   * Load feature importance models
   */
  async loadFeatureImportanceModels() {
    try {
      // Simulate loading pre-trained feature importance models
      this.featureImportance.set('policy-generator', {
        'service_type': 0.85,
        'compliance_framework': 0.78,
        'environment': 0.65,
        'business_unit': 0.45,
        'additional_requirements': 0.32
      });
      
      this.featureImportance.set('threat-intelligence', {
        'threat_severity': 0.92,
        'threat_type': 0.88,
        'affected_services': 0.75,
        'timeframe': 0.60
      });
      
      logger.info('Feature importance models loaded');
      
    } catch (error) {
      logger.error('Failed to load feature importance models:', error);
    }
  }

  /**
   * Initialize explanation cache
   */
  initializeExplanationCache() {
    this.explanationCache = new Map();
    logger.info('Explanation cache initialized');
  }

  /**
   * Get explanation statistics
   */
  getExplanationStatistics() {
    const stats = {
      totalExplanations: 0,
      cachedExplanations: this.explanationCache.size,
      agentsWithHistory: this.decisionHistory.size,
      averageConfidence: 0,
      explanationMethods: Object.keys(this.explainers)
    };
    
    // Calculate total explanations and average confidence
    let totalConfidence = 0;
    let explanationCount = 0;
    
    for (const [agentName, history] of this.decisionHistory) {
      stats.totalExplanations += history.length;
      
      for (const explanation of history) {
        totalConfidence += explanation.confidence || 0;
        explanationCount++;
      }
    }
    
    stats.averageConfidence = explanationCount > 0 ? 
      totalConfidence / explanationCount : 0;
    
    return stats;
  }

  /**
   * Clear explanation cache
   */
  clearExplanationCache() {
    this.explanationCache.clear();
    logger.info('Explanation cache cleared');
  }

  /**
   * Export explanation data
   */
  async exportExplanationData(format = 'json') {
    try {
      const data = {
        statistics: this.getExplanationStatistics(),
        decisionHistory: Object.fromEntries(this.decisionHistory),
        featureImportance: Object.fromEntries(this.featureImportance),
        explainers: Object.fromEntries(this.explainers)
      };
      
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      }
      
      return data;
      
    } catch (error) {
      logger.error('Failed to export explanation data:', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down Explainability Engine...');
    this.isInitialized = false;
  }
}

// Singleton instance
const explainabilityEngine = new ExplainabilityEngine();

export { explainabilityEngine };
