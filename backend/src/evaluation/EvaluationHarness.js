import { logger } from '../utils/logger.js';
import { agentManager } from '../agents/agentManager.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Evaluation Harness for AI Policy Foundry Agents
 * Measures accuracy, latency, and hallucinations across all agents
 */
export class EvaluationHarness {
  constructor() {
    this.testCases = new Map();
    this.results = new Map();
    this.benchmarks = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing Evaluation Harness...');
      
      // Load test cases
      await this.loadTestCases();
      
      // Load benchmarks
      await this.loadBenchmarks();
      
      // Initialize evaluation metrics
      this.initializeMetrics();
      
      this.isInitialized = true;
      logger.info('Evaluation Harness initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Evaluation Harness:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive evaluation of all agents
   */
  async runEvaluation(options = {}) {
    if (!this.isInitialized) {
      throw new Error('Evaluation Harness not initialized');
    }

    const {
      agents = ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'],
      testTypes = ['accuracy', 'latency', 'hallucination'],
      iterations = 10
    } = options;

    logger.info(`Starting evaluation for agents: ${agents.join(', ')}`);
    
    const evaluationResults = {
      timestamp: new Date().toISOString(),
      agents: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageLatency: 0,
        hallucinationRate: 0
      }
    };

    for (const agentName of agents) {
      logger.info(`Evaluating agent: ${agentName}`);
      
      const agentResults = await this.evaluateAgent(agentName, {
        testTypes,
        iterations
      });
      
      evaluationResults.agents[agentName] = agentResults;
      evaluationResults.summary.totalTests += agentResults.totalTests;
      evaluationResults.summary.passedTests += agentResults.passedTests;
      evaluationResults.summary.failedTests += agentResults.failedTests;
    }

    // Calculate summary metrics
    evaluationResults.summary.averageLatency = this.calculateAverageLatency(evaluationResults.agents);
    evaluationResults.summary.hallucinationRate = this.calculateHallucinationRate(evaluationResults.agents);

    // Store results
    await this.storeResults(evaluationResults);
    
    logger.info('Evaluation completed successfully');
    return evaluationResults;
  }

  /**
   * Evaluate a specific agent
   */
  async evaluateAgent(agentName, options) {
    const { testTypes, iterations } = options;
    const agent = await agentManager.getAgent(agentName);
    const testCases = this.testCases.get(agentName) || [];
    
    const results = {
      agent: agentName,
      timestamp: new Date().toISOString(),
      tests: {},
      metrics: {
        accuracy: 0,
        latency: {
          average: 0,
          min: Infinity,
          max: 0,
          p95: 0,
          p99: 0
        },
        hallucination: {
          rate: 0,
          detected: 0,
          total: 0
        }
      },
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    };

    // Run accuracy tests
    if (testTypes.includes('accuracy')) {
      results.tests.accuracy = await this.runAccuracyTests(agentName, agent, testCases, iterations);
      results.metrics.accuracy = results.tests.accuracy.accuracy;
    }

    // Run latency tests
    if (testTypes.includes('latency')) {
      results.tests.latency = await this.runLatencyTests(agentName, agent, testCases, iterations);
      results.metrics.latency = results.tests.latency.metrics;
    }

    // Run hallucination tests
    if (testTypes.includes('hallucination')) {
      results.tests.hallucination = await this.runHallucinationTests(agentName, agent, testCases, iterations);
      results.metrics.hallucination = results.tests.hallucination.metrics;
    }

    // Calculate totals
    results.totalTests = Object.values(results.tests).reduce((sum, test) => sum + test.totalTests, 0);
    results.passedTests = Object.values(results.tests).reduce((sum, test) => sum + test.passedTests, 0);
    results.failedTests = results.totalTests - results.passedTests;

    return results;
  }

  /**
   * Run accuracy tests for an agent
   */
  async runAccuracyTests(agentName, agent, testCases, iterations) {
    logger.info(`Running accuracy tests for ${agentName}`);
    
    const results = {
      testType: 'accuracy',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      accuracy: 0,
      details: []
    };

    for (const testCase of testCases) {
      for (let i = 0; i < iterations; i++) {
        try {
          const startTime = Date.now();
          const response = await agent.executeTask(testCase.task, testCase.input);
          const responseTime = Date.now() - startTime;

          // Evaluate accuracy based on expected output
          const accuracy = await this.evaluateAccuracy(response, testCase.expectedOutput, testCase.evaluationCriteria);
          
          results.totalTests++;
          if (accuracy >= testCase.minAccuracy) {
            results.passedTests++;
          } else {
            results.failedTests++;
          }

          results.details.push({
            testCase: testCase.name,
            iteration: i + 1,
            accuracy,
            responseTime,
            passed: accuracy >= testCase.minAccuracy,
            response: response,
            expected: testCase.expectedOutput
          });

        } catch (error) {
          logger.error(`Accuracy test failed for ${agentName}:`, error);
          results.totalTests++;
          results.failedTests++;
        }
      }
    }

    results.accuracy = results.totalTests > 0 ? (results.passedTests / results.totalTests) * 100 : 0;
    return results;
  }

  /**
   * Run latency tests for an agent
   */
  async runLatencyTests(agentName, agent, testCases, iterations) {
    logger.info(`Running latency tests for ${agentName}`);
    
    const results = {
      testType: 'latency',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      metrics: {
        average: 0,
        min: Infinity,
        max: 0,
        p95: 0,
        p99: 0
      },
      details: []
    };

    const responseTimes = [];

    for (const testCase of testCases) {
      for (let i = 0; i < iterations; i++) {
        try {
          const startTime = Date.now();
          await agent.executeTask(testCase.task, testCase.input);
          const responseTime = Date.now() - startTime;
          
          responseTimes.push(responseTime);
          results.totalTests++;

          // Check if response time meets SLA
          if (responseTime <= testCase.maxLatency) {
            results.passedTests++;
          } else {
            results.failedTests++;
          }

          results.details.push({
            testCase: testCase.name,
            iteration: i + 1,
            responseTime,
            passed: responseTime <= testCase.maxLatency,
            sla: testCase.maxLatency
          });

        } catch (error) {
          logger.error(`Latency test failed for ${agentName}:`, error);
          results.totalTests++;
          results.failedTests++;
        }
      }
    }

    // Calculate latency metrics
    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);
      results.metrics.average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      results.metrics.min = responseTimes[0];
      results.metrics.max = responseTimes[responseTimes.length - 1];
      results.metrics.p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      results.metrics.p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    }

    return results;
  }

  /**
   * Run hallucination detection tests for an agent
   */
  async runHallucinationTests(agentName, agent, testCases, iterations) {
    logger.info(`Running hallucination tests for ${agentName}`);
    
    const results = {
      testType: 'hallucination',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      metrics: {
        rate: 0,
        detected: 0,
        total: 0
      },
      details: []
    };

    for (const testCase of testCases) {
      for (let i = 0; i < iterations; i++) {
        try {
          const response = await agent.executeTask(testCase.task, testCase.input);
          
          // Detect hallucinations
          const hallucinationResult = await this.detectHallucination(response, testCase.input, testCase.context);
          
          results.totalTests++;
          results.metrics.total++;
          
          if (hallucinationResult.isHallucination) {
            results.metrics.detected++;
            results.failedTests++;
          } else {
            results.passedTests++;
          }

          results.details.push({
            testCase: testCase.name,
            iteration: i + 1,
            hallucination: hallucinationResult,
            response: response,
            passed: !hallucinationResult.isHallucination
          });

        } catch (error) {
          logger.error(`Hallucination test failed for ${agentName}:`, error);
          results.totalTests++;
          results.failedTests++;
        }
      }
    }

    results.metrics.rate = results.metrics.total > 0 ? (results.metrics.detected / results.metrics.total) * 100 : 0;
    return results;
  }

  /**
   * Evaluate accuracy of agent response
   */
  async evaluateAccuracy(response, expectedOutput, criteria) {
    try {
      // Semantic similarity check
      const semanticScore = await this.calculateSemanticSimilarity(response, expectedOutput);
      
      // Structure validation
      const structureScore = this.validateStructure(response, expectedOutput);
      
      // Content validation
      const contentScore = this.validateContent(response, expectedOutput, criteria);
      
      // Weighted accuracy calculation
      const accuracy = (semanticScore * 0.4) + (structureScore * 0.3) + (contentScore * 0.3);
      
      return Math.min(100, Math.max(0, accuracy));
      
    } catch (error) {
      logger.error('Failed to evaluate accuracy:', error);
      return 0;
    }
  }

  /**
   * Detect hallucinations in agent response
   */
  async detectHallucination(response, input, context) {
    try {
      const hallucinationChecks = {
        factualConsistency: await this.checkFactualConsistency(response, context),
        sourceAttribution: await this.checkSourceAttribution(response, input),
        logicalConsistency: await this.checkLogicalConsistency(response, input),
        temporalConsistency: await this.checkTemporalConsistency(response, context),
        domainConsistency: await this.checkDomainConsistency(response, input)
      };

      const hallucinationScore = Object.values(hallucinationChecks).reduce((sum, check) => sum + check.score, 0) / Object.keys(hallucinationChecks).length;
      
      return {
        isHallucination: hallucinationScore < 0.7,
        score: hallucinationScore,
        checks: hallucinationChecks,
        confidence: Math.abs(hallucinationScore - 0.5) * 2
      };
      
    } catch (error) {
      logger.error('Failed to detect hallucination:', error);
      return {
        isHallucination: true,
        score: 0,
        checks: {},
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate semantic similarity between response and expected output
   */
  async calculateSemanticSimilarity(response, expectedOutput) {
    // Simple keyword-based similarity for now
    // In production, this would use embedding models like OpenAI embeddings
    const responseWords = this.tokenize(response);
    const expectedWords = this.tokenize(expectedOutput);
    
    const intersection = responseWords.filter(word => expectedWords.includes(word));
    const union = [...new Set([...responseWords, ...expectedWords])];
    
    return union.length > 0 ? (intersection.length / union.length) * 100 : 0;
  }

  /**
   * Validate structure of response
   */
  validateStructure(response, expectedOutput) {
    try {
      // Check if response has expected structure
      if (typeof response === 'object' && typeof expectedOutput === 'object') {
        const responseKeys = Object.keys(response);
        const expectedKeys = Object.keys(expectedOutput);
        
        const matchingKeys = responseKeys.filter(key => expectedKeys.includes(key));
        return (matchingKeys.length / expectedKeys.length) * 100;
      }
      
      return response && expectedOutput ? 100 : 0;
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Validate content of response
   */
  validateContent(response, expectedOutput, criteria) {
    try {
      let score = 0;
      let totalChecks = 0;

      if (criteria) {
        for (const criterion of criteria) {
          totalChecks++;
          if (this.checkCriterion(response, criterion)) {
            score += 100;
          }
        }
      }

      return totalChecks > 0 ? score / totalChecks : 100;
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check individual criterion
   */
  checkCriterion(response, criterion) {
    switch (criterion.type) {
      case 'contains':
        return response.includes(criterion.value);
      case 'notContains':
        return !response.includes(criterion.value);
      case 'regex':
        return new RegExp(criterion.value).test(response);
      case 'length':
        return response.length >= criterion.min && response.length <= criterion.max;
      default:
        return true;
    }
  }

  /**
   * Check factual consistency
   */
  async checkFactualConsistency(response, context) {
    // Check if response contains facts that contradict known context
    const contradictions = await this.findContradictions(response, context);
    return {
      score: contradictions.length === 0 ? 1 : Math.max(0, 1 - (contradictions.length * 0.2)),
      contradictions
    };
  }

  /**
   * Check source attribution
   */
  async checkSourceAttribution(response, input) {
    // Check if response properly attributes sources
    const hasAttribution = this.hasSourceAttribution(response);
    const isRelevant = this.isRelevantToInput(response, input);
    
    return {
      score: hasAttribution && isRelevant ? 1 : 0.5,
      hasAttribution,
      isRelevant
    };
  }

  /**
   * Check logical consistency
   */
  async checkLogicalConsistency(response, input) {
    // Check if response follows logical patterns
    const logicalErrors = await this.findLogicalErrors(response, input);
    return {
      score: logicalErrors.length === 0 ? 1 : Math.max(0, 1 - (logicalErrors.length * 0.3)),
      errors: logicalErrors
    };
  }

  /**
   * Check temporal consistency
   */
  async checkTemporalConsistency(response, context) {
    // Check if response maintains temporal consistency
    const temporalErrors = await this.findTemporalErrors(response, context);
    return {
      score: temporalErrors.length === 0 ? 1 : Math.max(0, 1 - (temporalErrors.length * 0.2)),
      errors: temporalErrors
    };
  }

  /**
   * Check domain consistency
   */
  async checkDomainConsistency(response, input) {
    // Check if response stays within expected domain
    const domainViolations = await this.findDomainViolations(response, input);
    return {
      score: domainViolations.length === 0 ? 1 : Math.max(0, 1 - (domainViolations.length * 0.25)),
      violations: domainViolations
    };
  }

  /**
   * Helper methods for hallucination detection
   */
  async findContradictions(response, context) {
    // Implementation would check for factual contradictions
    return [];
  }

  hasSourceAttribution(response) {
    // Check if response includes source attribution
    return typeof response === 'string' && (
      response.includes('according to') ||
      response.includes('based on') ||
      response.includes('source:') ||
      response.includes('reference:')
    );
  }

  isRelevantToInput(response, input) {
    // Check if response is relevant to input
    const inputKeywords = this.tokenize(input);
    const responseKeywords = this.tokenize(response);
    const overlap = inputKeywords.filter(word => responseKeywords.includes(word));
    return overlap.length > 0;
  }

  async findLogicalErrors(response, input) {
    // Implementation would check for logical inconsistencies
    return [];
  }

  async findTemporalErrors(response, context) {
    // Implementation would check for temporal inconsistencies
    return [];
  }

  async findDomainViolations(response, input) {
    // Implementation would check for domain violations
    return [];
  }

  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Load test cases for evaluation
   */
  async loadTestCases() {
    try {
      const testCasesPath = path.join(process.cwd(), 'src', 'evaluation', 'test-cases');
      
      // Load test cases for each agent
      const agents = ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'];
      
      for (const agent of agents) {
        const agentTestCases = await this.loadAgentTestCases(agent, testCasesPath);
        this.testCases.set(agent, agentTestCases);
      }
      
    } catch (error) {
      logger.error('Failed to load test cases:', error);
      // Create default test cases if loading fails
      this.createDefaultTestCases();
    }
  }

  /**
   * Load test cases for a specific agent
   */
  async loadAgentTestCases(agentName, basePath) {
    try {
      const filePath = path.join(basePath, `${agentName}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`No test cases found for ${agentName}, using defaults`);
      return this.getDefaultTestCases(agentName);
    }
  }

  /**
   * Get default test cases for an agent
   */
  getDefaultTestCases(agentName) {
    const defaultCases = {
      'policy-generator': [
        {
          name: 'AWS S3 Policy Generation',
          task: 'generate',
          input: {
            service: 'AWS S3',
            requirements: {
              environment: 'production',
              compliance: 'CIS',
              additionalRequirements: 'Encryption at rest and in transit required'
            }
          },
          expectedOutput: {
            metadata: { service: 'AWS S3' },
            policy: 'string',
            compliance: { framework: 'CIS' }
          },
          evaluationCriteria: [
            { type: 'contains', value: 'encryption' },
            { type: 'contains', value: 'S3' },
            { type: 'length', min: 100, max: 5000 }
          ],
          minAccuracy: 80,
          maxLatency: 5000
        }
      ],
      'threat-intelligence': [
        {
          name: 'CVE Analysis',
          task: 'scan',
          input: {},
          expectedOutput: {
            threats: 'array',
            analysis: 'object',
            recommendations: 'array'
          },
          evaluationCriteria: [
            { type: 'contains', value: 'CVE' },
            { type: 'length', min: 50, max: 2000 }
          ],
          minAccuracy: 75,
          maxLatency: 10000
        }
      ],
      'compliance': [
        {
          name: 'CIS Compliance Check',
          task: 'validate',
          input: {
            service: 'AWS S3',
            requirements: { compliance: 'CIS' }
          },
          expectedOutput: {
            validation: 'object',
            passed: 'boolean',
            recommendations: 'array'
          },
          evaluationCriteria: [
            { type: 'contains', value: 'CIS' },
            { type: 'length', min: 100, max: 3000 }
          ],
          minAccuracy: 85,
          maxLatency: 3000
        }
      ],
      'security-analysis': [
        {
          name: 'Security Risk Assessment',
          task: 'analyze',
          input: {
            service: 'AWS S3',
            requirements: { environment: 'production' }
          },
          expectedOutput: {
            analysis: 'object',
            riskLevel: 'string',
            recommendations: 'array'
          },
          evaluationCriteria: [
            { type: 'contains', value: 'risk' },
            { type: 'length', min: 200, max: 4000 }
          ],
          minAccuracy: 80,
          maxLatency: 4000
        }
      ],
      'cloud-provider': [
        {
          name: 'Cloud Service Discovery',
          task: 'scan-new-services',
          input: {},
          expectedOutput: {
            services: 'array',
            updates: 'array',
            recommendations: 'array'
          },
          evaluationCriteria: [
            { type: 'length', min: 50, max: 1500 }
          ],
          minAccuracy: 70,
          maxLatency: 15000
        }
      ]
    };

    return defaultCases[agentName] || [];
  }

  /**
   * Create default test cases if loading fails
   */
  createDefaultTestCases() {
    const agents = ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'];
    
    for (const agent of agents) {
      if (!this.testCases.has(agent)) {
        this.testCases.set(agent, this.getDefaultTestCases(agent));
      }
    }
  }

  /**
   * Load benchmarks for comparison
   */
  async loadBenchmarks() {
    try {
      const benchmarksPath = path.join(process.cwd(), 'src', 'evaluation', 'benchmarks.json');
      const data = await fs.readFile(benchmarksPath, 'utf8');
      this.benchmarks = new Map(Object.entries(JSON.parse(data)));
    } catch (error) {
      logger.warn('No benchmarks found, using defaults');
      this.createDefaultBenchmarks();
    }
  }

  /**
   * Create default benchmarks
   */
  createDefaultBenchmarks() {
    this.benchmarks.set('accuracy', {
      excellent: 95,
      good: 85,
      acceptable: 75,
      poor: 65
    });
    
    this.benchmarks.set('latency', {
      excellent: 1000,
      good: 3000,
      acceptable: 5000,
      poor: 10000
    });
    
    this.benchmarks.set('hallucination', {
      excellent: 5,
      good: 10,
      acceptable: 15,
      poor: 25
    });
  }

  /**
   * Initialize evaluation metrics
   */
  initializeMetrics() {
    this.metrics = {
      totalEvaluations: 0,
      lastEvaluation: null,
      averageAccuracy: 0,
      averageLatency: 0,
      averageHallucinationRate: 0
    };
  }

  /**
   * Calculate average latency across all agents
   */
  calculateAverageLatency(agentResults) {
    const latencies = Object.values(agentResults)
      .map(result => result.metrics.latency.average)
      .filter(latency => latency > 0);
    
    return latencies.length > 0 ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length : 0;
  }

  /**
   * Calculate hallucination rate across all agents
   */
  calculateHallucinationRate(agentResults) {
    const rates = Object.values(agentResults)
      .map(result => result.metrics.hallucination.rate)
      .filter(rate => rate >= 0);
    
    return rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
  }

  /**
   * Store evaluation results
   */
  async storeResults(results) {
    try {
      const resultsPath = path.join(process.cwd(), 'src', 'evaluation', 'results');
      await fs.mkdir(resultsPath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `evaluation-${timestamp}.json`;
      const filePath = path.join(resultsPath, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(results, null, 2));
      
      // Update metrics
      this.metrics.totalEvaluations++;
      this.metrics.lastEvaluation = results.timestamp;
      this.metrics.averageAccuracy = results.summary.passedTests / results.summary.totalTests * 100;
      this.metrics.averageLatency = results.summary.averageLatency;
      this.metrics.averageHallucinationRate = results.summary.hallucinationRate;
      
      logger.info(`Evaluation results stored: ${fileName}`);
      
    } catch (error) {
      logger.error('Failed to store evaluation results:', error);
    }
  }

  /**
   * Get evaluation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      benchmarks: Object.fromEntries(this.benchmarks),
      testCasesCount: Array.from(this.testCases.values()).reduce((sum, cases) => sum + cases.length, 0)
    };
  }

  /**
   * Generate evaluation report
   */
  async generateReport(evaluationResults) {
    const report = {
      summary: evaluationResults.summary,
      agents: {},
      recommendations: [],
      timestamp: evaluationResults.timestamp
    };

    // Analyze each agent
    for (const [agentName, agentResults] of Object.entries(evaluationResults.agents)) {
      report.agents[agentName] = {
        performance: this.analyzeAgentPerformance(agentName, agentResults),
        issues: this.identifyIssues(agentName, agentResults),
        recommendations: this.generateAgentRecommendations(agentName, agentResults)
      };
    }

    // Generate overall recommendations
    report.recommendations = this.generateOverallRecommendations(evaluationResults);

    return report;
  }

  /**
   * Analyze agent performance
   */
  analyzeAgentPerformance(agentName, results) {
    const benchmarks = this.benchmarks;
    const performance = {
      accuracy: 'unknown',
      latency: 'unknown',
      hallucination: 'unknown'
    };

    // Analyze accuracy
    if (results.metrics.accuracy >= benchmarks.get('accuracy').excellent) {
      performance.accuracy = 'excellent';
    } else if (results.metrics.accuracy >= benchmarks.get('accuracy').good) {
      performance.accuracy = 'good';
    } else if (results.metrics.accuracy >= benchmarks.get('accuracy').acceptable) {
      performance.accuracy = 'acceptable';
    } else {
      performance.accuracy = 'poor';
    }

    // Analyze latency
    if (results.metrics.latency.average <= benchmarks.get('latency').excellent) {
      performance.latency = 'excellent';
    } else if (results.metrics.latency.average <= benchmarks.get('latency').good) {
      performance.latency = 'good';
    } else if (results.metrics.latency.average <= benchmarks.get('latency').acceptable) {
      performance.latency = 'acceptable';
    } else {
      performance.latency = 'poor';
    }

    // Analyze hallucination rate
    if (results.metrics.hallucination.rate <= benchmarks.get('hallucination').excellent) {
      performance.hallucination = 'excellent';
    } else if (results.metrics.hallucination.rate <= benchmarks.get('hallucination').good) {
      performance.hallucination = 'good';
    } else if (results.metrics.hallucination.rate <= benchmarks.get('hallucination').acceptable) {
      performance.hallucination = 'acceptable';
    } else {
      performance.hallucination = 'poor';
    }

    return performance;
  }

  /**
   * Identify issues in agent performance
   */
  identifyIssues(agentName, results) {
    const issues = [];

    if (results.metrics.accuracy < 80) {
      issues.push({
        type: 'accuracy',
        severity: 'high',
        description: `Accuracy below acceptable threshold: ${results.metrics.accuracy.toFixed(2)}%`
      });
    }

    if (results.metrics.latency.average > 5000) {
      issues.push({
        type: 'latency',
        severity: 'medium',
        description: `Average latency exceeds SLA: ${results.metrics.latency.average}ms`
      });
    }

    if (results.metrics.hallucination.rate > 15) {
      issues.push({
        type: 'hallucination',
        severity: 'high',
        description: `Hallucination rate too high: ${results.metrics.hallucination.rate.toFixed(2)}%`
      });
    }

    return issues;
  }

  /**
   * Generate recommendations for an agent
   */
  generateAgentRecommendations(agentName, results) {
    const recommendations = [];

    if (results.metrics.accuracy < 85) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        action: 'Review and improve training data quality',
        description: 'Consider updating test cases and evaluation criteria'
      });
    }

    if (results.metrics.latency.average > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        action: 'Optimize agent processing pipeline',
        description: 'Consider caching, parallel processing, or model optimization'
      });
    }

    if (results.metrics.hallucination.rate > 10) {
      recommendations.push({
        type: 'hallucination',
        priority: 'high',
        action: 'Implement additional hallucination detection',
        description: 'Add more robust fact-checking and source validation'
      });
    }

    return recommendations;
  }

  /**
   * Generate overall recommendations
   */
  generateOverallRecommendations(results) {
    const recommendations = [];

    if (results.summary.averageLatency > 4000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        action: 'System-wide performance optimization',
        description: 'Consider infrastructure scaling or optimization'
      });
    }

    if (results.summary.hallucinationRate > 12) {
      recommendations.push({
        type: 'quality',
        priority: 'high',
        action: 'Implement system-wide hallucination prevention',
        description: 'Add cross-agent validation and fact-checking mechanisms'
      });
    }

    return recommendations;
  }

  async shutdown() {
    logger.info('Shutting down Evaluation Harness...');
    this.isInitialized = false;
  }
}

// Singleton instance
const evaluationHarness = new EvaluationHarness();

export { evaluationHarness };
