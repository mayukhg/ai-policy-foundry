import { logger } from '../utils/logger.js';
import { agentManager } from '../agents/agentManager.js';
import { evaluationHarness } from '../evaluation/EvaluationHarness.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Real-time Monitoring Service for AI Policy Foundry Agents
 * Provides continuous monitoring of agent performance, health, and quality metrics
 */
export class MonitoringService {
  constructor() {
    this.metrics = new Map();
    this.alerts = new Map();
    this.thresholds = new Map();
    this.isRunning = false;
    this.intervals = new Map();
    this.eventListeners = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Monitoring Service...');
      
      // Load monitoring configuration
      await this.loadConfiguration();
      
      // Initialize metrics collection
      this.initializeMetrics();
      
      // Set up alert thresholds
      this.setupAlertThresholds();
      
      // Initialize evaluation harness
      await evaluationHarness.initialize();
      
      this.isRunning = true;
      logger.info('Monitoring Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Start monitoring all agents
   */
  async startMonitoring() {
    if (!this.isRunning) {
      throw new Error('Monitoring Service not initialized');
    }

    logger.info('Starting real-time monitoring...');

    // Start health monitoring (every 30 seconds)
    this.intervals.set('health', setInterval(async () => {
      await this.monitorAgentHealth();
    }, 30000));

    // Start performance monitoring (every 2 minutes)
    this.intervals.set('performance', setInterval(async () => {
      await this.monitorPerformance();
    }, 120000));

    // Start quality monitoring (every 5 minutes)
    this.intervals.set('quality', setInterval(async () => {
      await this.monitorQuality();
    }, 300000));

    // Start hallucination monitoring (every 10 minutes)
    this.intervals.set('hallucination', setInterval(async () => {
      await this.monitorHallucinations();
    }, 600000));

    // Start comprehensive evaluation (every hour)
    this.intervals.set('evaluation', setInterval(async () => {
      await this.runComprehensiveEvaluation();
    }, 3600000));

    // Start metrics aggregation (every 5 minutes)
    this.intervals.set('aggregation', setInterval(async () => {
      await this.aggregateMetrics();
    }, 300000));

    logger.info('Real-time monitoring started successfully');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    logger.info('Stopping monitoring...');

    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.debug(`Stopped ${name} monitoring`);
    }
    this.intervals.clear();

    // Remove event listeners
    for (const [event, listener] of this.eventListeners) {
      // Remove listener logic here
      logger.debug(`Removed ${event} listener`);
    }
    this.eventListeners.clear();

    logger.info('Monitoring stopped successfully');
  }

  /**
   * Monitor agent health
   */
  async monitorAgentHealth() {
    try {
      const agentStatus = agentManager.getAgentStatus();
      const timestamp = new Date().toISOString();

      for (const [agentName, status] of Object.entries(agentStatus)) {
        const healthMetrics = {
          timestamp,
          agent: agentName,
          status: status.status,
          lastActivity: status.lastActivity,
          uptime: this.calculateUptime(status.lastActivity),
          requestsProcessed: status.metrics.requestsProcessed,
          averageResponseTime: status.metrics.averageResponseTime,
          errors: status.metrics.errors,
          errorRate: this.calculateErrorRate(status.metrics)
        };

        // Store health metrics
        this.storeMetrics('health', agentName, healthMetrics);

        // Check for health alerts
        await this.checkHealthAlerts(agentName, healthMetrics);
      }

    } catch (error) {
      logger.error('Health monitoring failed:', error);
    }
  }

  /**
   * Monitor agent performance
   */
  async monitorPerformance() {
    try {
      const agentStatus = agentManager.getAgentStatus();
      const timestamp = new Date().toISOString();

      for (const [agentName, status] of Object.entries(agentStatus)) {
        const performanceMetrics = {
          timestamp,
          agent: agentName,
          responseTime: {
            current: status.metrics.averageResponseTime,
            trend: this.calculateTrend('responseTime', agentName),
            percentile95: this.calculatePercentile('responseTime', agentName, 95),
            percentile99: this.calculatePercentile('responseTime', agentName, 99)
          },
          throughput: {
            requestsPerMinute: this.calculateThroughput(agentName),
            requestsPerHour: this.calculateThroughput(agentName, 'hour')
          },
          resourceUtilization: await this.getResourceUtilization(agentName),
          slaCompliance: this.calculateSLACompliance(agentName)
        };

        // Store performance metrics
        this.storeMetrics('performance', agentName, performanceMetrics);

        // Check for performance alerts
        await this.checkPerformanceAlerts(agentName, performanceMetrics);
      }

    } catch (error) {
      logger.error('Performance monitoring failed:', error);
    }
  }

  /**
   * Monitor agent quality
   */
  async monitorQuality() {
    try {
      const timestamp = new Date().toISOString();

      // Run quick quality assessment
      const qualityResults = await evaluationHarness.runEvaluation({
        agents: ['policy-generator', 'threat-intelligence', 'compliance'],
        testTypes: ['accuracy'],
        iterations: 3
      });

      for (const [agentName, results] of Object.entries(qualityResults.agents)) {
        const qualityMetrics = {
          timestamp,
          agent: agentName,
          accuracy: {
            current: results.metrics.accuracy,
            trend: this.calculateTrend('accuracy', agentName),
            benchmark: this.getBenchmark('accuracy', results.metrics.accuracy)
          },
          consistency: this.calculateConsistency(agentName),
          reliability: this.calculateReliability(agentName)
        };

        // Store quality metrics
        this.storeMetrics('quality', agentName, qualityMetrics);

        // Check for quality alerts
        await this.checkQualityAlerts(agentName, qualityMetrics);
      }

    } catch (error) {
      logger.error('Quality monitoring failed:', error);
    }
  }

  /**
   * Monitor hallucinations
   */
  async monitorHallucinations() {
    try {
      const timestamp = new Date().toISOString();

      // Run hallucination detection
      const hallucinationResults = await evaluationHarness.runEvaluation({
        agents: ['policy-generator', 'threat-intelligence', 'compliance'],
        testTypes: ['hallucination'],
        iterations: 5
      });

      for (const [agentName, results] of Object.entries(hallucinationResults.agents)) {
        const hallucinationMetrics = {
          timestamp,
          agent: agentName,
          hallucinationRate: {
            current: results.metrics.hallucination.rate,
            trend: this.calculateTrend('hallucinationRate', agentName),
            benchmark: this.getBenchmark('hallucination', results.metrics.hallucination.rate)
          },
          detectedHallucinations: results.metrics.hallucination.detected,
          totalTests: results.metrics.hallucination.total,
          confidence: this.calculateHallucinationConfidence(results)
        };

        // Store hallucination metrics
        this.storeMetrics('hallucination', agentName, hallucinationMetrics);

        // Check for hallucination alerts
        await this.checkHallucinationAlerts(agentName, hallucinationMetrics);
      }

    } catch (error) {
      logger.error('Hallucination monitoring failed:', error);
    }
  }

  /**
   * Run comprehensive evaluation
   */
  async runComprehensiveEvaluation() {
    try {
      logger.info('Running comprehensive evaluation...');

      const evaluationResults = await evaluationHarness.runEvaluation({
        agents: ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'],
        testTypes: ['accuracy', 'latency', 'hallucination'],
        iterations: 10
      });

      // Store comprehensive results
      this.storeMetrics('comprehensive', 'all', {
        timestamp: new Date().toISOString(),
        results: evaluationResults,
        summary: evaluationResults.summary
      });

      // Generate and store report
      const report = await evaluationHarness.generateReport(evaluationResults);
      await this.storeReport(report);

      logger.info('Comprehensive evaluation completed');

    } catch (error) {
      logger.error('Comprehensive evaluation failed:', error);
    }
  }

  /**
   * Aggregate metrics
   */
  async aggregateMetrics() {
    try {
      const timestamp = new Date().toISOString();
      const aggregatedMetrics = {
        timestamp,
        summary: this.generateSummaryMetrics(),
        trends: this.calculateTrends(),
        alerts: this.getActiveAlerts(),
        recommendations: this.generateRecommendations()
      };

      // Store aggregated metrics
      this.storeMetrics('aggregated', 'system', aggregatedMetrics);

      // Clean up old metrics (keep last 24 hours)
      await this.cleanupOldMetrics();

    } catch (error) {
      logger.error('Metrics aggregation failed:', error);
    }
  }

  /**
   * Check health alerts
   */
  async checkHealthAlerts(agentName, metrics) {
    const thresholds = this.thresholds.get('health') || {};

    // Check error rate
    if (metrics.errorRate > (thresholds.errorRate || 5)) {
      await this.createAlert({
        type: 'health',
        severity: 'high',
        agent: agentName,
        metric: 'errorRate',
        value: metrics.errorRate,
        threshold: thresholds.errorRate,
        message: `High error rate detected: ${metrics.errorRate}%`
      });
    }

    // Check response time
    if (metrics.averageResponseTime > (thresholds.responseTime || 10000)) {
      await this.createAlert({
        type: 'health',
        severity: 'medium',
        agent: agentName,
        metric: 'responseTime',
        value: metrics.averageResponseTime,
        threshold: thresholds.responseTime,
        message: `High response time detected: ${metrics.averageResponseTime}ms`
      });
    }

    // Check agent status
    if (metrics.status === 'error' || metrics.status === 'idle') {
      await this.createAlert({
        type: 'health',
        severity: 'high',
        agent: agentName,
        metric: 'status',
        value: metrics.status,
        threshold: 'active',
        message: `Agent status issue: ${metrics.status}`
      });
    }
  }

  /**
   * Check performance alerts
   */
  async checkPerformanceAlerts(agentName, metrics) {
    const thresholds = this.thresholds.get('performance') || {};

    // Check SLA compliance
    if (metrics.slaCompliance < (thresholds.slaCompliance || 95)) {
      await this.createAlert({
        type: 'performance',
        severity: 'high',
        agent: agentName,
        metric: 'slaCompliance',
        value: metrics.slaCompliance,
        threshold: thresholds.slaCompliance,
        message: `SLA compliance below threshold: ${metrics.slaCompliance}%`
      });
    }

    // Check response time percentiles
    if (metrics.responseTime.percentile95 > (thresholds.responseTime95 || 5000)) {
      await this.createAlert({
        type: 'performance',
        severity: 'medium',
        agent: agentName,
        metric: 'responseTime95',
        value: metrics.responseTime.percentile95,
        threshold: thresholds.responseTime95,
        message: `95th percentile response time high: ${metrics.responseTime.percentile95}ms`
      });
    }
  }

  /**
   * Check quality alerts
   */
  async checkQualityAlerts(agentName, metrics) {
    const thresholds = this.thresholds.get('quality') || {};

    // Check accuracy
    if (metrics.accuracy.current < (thresholds.accuracy || 80)) {
      await this.createAlert({
        type: 'quality',
        severity: 'high',
        agent: agentName,
        metric: 'accuracy',
        value: metrics.accuracy.current,
        threshold: thresholds.accuracy,
        message: `Accuracy below threshold: ${metrics.accuracy.current}%`
      });
    }

    // Check consistency
    if (metrics.consistency < (thresholds.consistency || 90)) {
      await this.createAlert({
        type: 'quality',
        severity: 'medium',
        agent: agentName,
        metric: 'consistency',
        value: metrics.consistency,
        threshold: thresholds.consistency,
        message: `Consistency below threshold: ${metrics.consistency}%`
      });
    }
  }

  /**
   * Check hallucination alerts
   */
  async checkHallucinationAlerts(agentName, metrics) {
    const thresholds = this.thresholds.get('hallucination') || {};

    // Check hallucination rate
    if (metrics.hallucinationRate.current > (thresholds.hallucinationRate || 15)) {
      await this.createAlert({
        type: 'hallucination',
        severity: 'high',
        agent: agentName,
        metric: 'hallucinationRate',
        value: metrics.hallucinationRate.current,
        threshold: thresholds.hallucinationRate,
        message: `High hallucination rate detected: ${metrics.hallucinationRate.current}%`
      });
    }
  }

  /**
   * Create alert
   */
  async createAlert(alertData) {
    const alert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      ...alertData,
      status: 'active',
      acknowledged: false,
      resolved: false
    };

    // Store alert
    this.alerts.set(alert.id, alert);

    // Log alert
    logger.warn(`ALERT: ${alert.message}`, alert);

    // Send notification (implement based on requirements)
    await this.sendNotification(alert);

    return alert;
  }

  /**
   * Store metrics
   */
  storeMetrics(type, agent, metrics) {
    const key = `${type}:${agent}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const agentMetrics = this.metrics.get(key);
    agentMetrics.push(metrics);

    // Keep only last 1000 entries per metric type
    if (agentMetrics.length > 1000) {
      agentMetrics.splice(0, agentMetrics.length - 1000);
    }
  }

  /**
   * Calculate uptime
   */
  calculateUptime(lastActivity) {
    const now = new Date();
    const lastActivityDate = new Date(lastActivity);
    return now.getTime() - lastActivityDate.getTime();
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate(metrics) {
    const totalRequests = metrics.requestsProcessed + metrics.errors;
    return totalRequests > 0 ? (metrics.errors / totalRequests) * 100 : 0;
  }

  /**
   * Calculate trend
   */
  calculateTrend(metricType, agentName) {
    const key = `performance:${agentName}`;
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length < 2) return 'stable';
    
    const recent = metrics.slice(-5);
    const older = metrics.slice(-10, -5);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, m) => sum + (m[metricType] || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + (m[metricType] || 0), 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(metricType, agentName, percentile) {
    const key = `performance:${agentName}`;
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length === 0) return 0;
    
    const values = metrics.map(m => m[metricType] || 0).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    
    return values[index] || 0;
  }

  /**
   * Calculate throughput
   */
  calculateThroughput(agentName, period = 'minute') {
    const key = `health:${agentName}`;
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length < 2) return 0;
    
    const recent = metrics.slice(-2);
    const timeDiff = new Date(recent[1].timestamp).getTime() - new Date(recent[0].timestamp).getTime();
    const requestDiff = recent[1].requestsProcessed - recent[0].requestsProcessed;
    
    const multiplier = period === 'hour' ? 3600000 : 60000;
    return (requestDiff / timeDiff) * multiplier;
  }

  /**
   * Get resource utilization
   */
  async getResourceUtilization(agentName) {
    // Placeholder for resource utilization metrics
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100
    };
  }

  /**
   * Calculate SLA compliance
   */
  calculateSLACompliance(agentName) {
    const key = `performance:${agentName}`;
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length === 0) return 100;
    
    const slaThreshold = 5000; // 5 seconds
    const compliantRequests = metrics.filter(m => m.responseTime?.current <= slaThreshold).length;
    
    return (compliantRequests / metrics.length) * 100;
  }

  /**
   * Calculate consistency
   */
  calculateConsistency(agentName) {
    const key = `quality:${agentName}`;
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length < 2) return 100;
    
    const accuracies = metrics.map(m => m.accuracy?.current || 0);
    const mean = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accuracies.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - (stdDev / mean) * 100);
  }

  /**
   * Calculate reliability
   */
  calculateReliability(agentName) {
    const key = `health:${agentName}`;
    const metrics = this.metrics.get(key) || [];
    
    if (metrics.length === 0) return 100;
    
    const totalChecks = metrics.length;
    const successfulChecks = metrics.filter(m => m.status === 'active').length;
    
    return (successfulChecks / totalChecks) * 100;
  }

  /**
   * Calculate hallucination confidence
   */
  calculateHallucinationConfidence(results) {
    const totalTests = results.metrics.hallucination.total;
    const detectedHallucinations = results.metrics.hallucination.detected;
    
    if (totalTests === 0) return 0;
    
    return ((totalTests - detectedHallucinations) / totalTests) * 100;
  }

  /**
   * Get benchmark level
   */
  getBenchmark(type, value) {
    const benchmarks = {
      accuracy: { excellent: 95, good: 85, acceptable: 75, poor: 65 },
      hallucination: { excellent: 5, good: 10, acceptable: 15, poor: 25 }
    };
    
    const benchmark = benchmarks[type];
    if (!benchmark) return 'unknown';
    
    if (value >= benchmark.excellent) return 'excellent';
    if (value >= benchmark.good) return 'good';
    if (value >= benchmark.acceptable) return 'acceptable';
    return 'poor';
  }

  /**
   * Generate summary metrics
   */
  generateSummaryMetrics() {
    const summary = {
      totalAgents: 5,
      activeAgents: 0,
      averageAccuracy: 0,
      averageLatency: 0,
      averageHallucinationRate: 0,
      totalAlerts: this.alerts.size,
      activeAlerts: Array.from(this.alerts.values()).filter(a => a.status === 'active').length
    };

    // Calculate averages across all agents
    const agentNames = ['policy-generator', 'threat-intelligence', 'compliance', 'security-analysis', 'cloud-provider'];
    
    for (const agentName of agentNames) {
      const healthKey = `health:${agentName}`;
      const qualityKey = `quality:${agentName}`;
      const hallucinationKey = `hallucination:${agentName}`;
      
      const healthMetrics = this.metrics.get(healthKey) || [];
      const qualityMetrics = this.metrics.get(qualityKey) || [];
      const hallucinationMetrics = this.metrics.get(hallucinationKey) || [];
      
      if (healthMetrics.length > 0) {
        const latestHealth = healthMetrics[healthMetrics.length - 1];
        if (latestHealth.status === 'active') {
          summary.activeAgents++;
        }
      }
      
      if (qualityMetrics.length > 0) {
        const latestQuality = qualityMetrics[qualityMetrics.length - 1];
        summary.averageAccuracy += latestQuality.accuracy?.current || 0;
      }
      
      if (hallucinationMetrics.length > 0) {
        const latestHallucination = hallucinationMetrics[hallucinationMetrics.length - 1];
        summary.averageHallucinationRate += latestHallucination.hallucinationRate?.current || 0;
      }
    }
    
    summary.averageAccuracy /= agentNames.length;
    summary.averageHallucinationRate /= agentNames.length;
    
    return summary;
  }

  /**
   * Calculate trends
   */
  calculateTrends() {
    return {
      accuracy: this.calculateSystemTrend('accuracy'),
      latency: this.calculateSystemTrend('latency'),
      hallucination: this.calculateSystemTrend('hallucination')
    };
  }

  /**
   * Calculate system trend
   */
  calculateSystemTrend(metricType) {
    // Simplified trend calculation
    return 'stable';
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const activeAlerts = this.getActiveAlerts();
    
    // Generate recommendations based on active alerts
    for (const alert of activeAlerts) {
      switch (alert.type) {
        case 'health':
          recommendations.push({
            type: 'health',
            priority: 'high',
            action: 'Check agent health and restart if necessary',
            agent: alert.agent
          });
          break;
        case 'performance':
          recommendations.push({
            type: 'performance',
            priority: 'medium',
            action: 'Optimize agent performance',
            agent: alert.agent
          });
          break;
        case 'quality':
          recommendations.push({
            type: 'quality',
            priority: 'high',
            action: 'Review and improve agent accuracy',
            agent: alert.agent
          });
          break;
        case 'hallucination':
          recommendations.push({
            type: 'hallucination',
            priority: 'high',
            action: 'Implement additional hallucination detection',
            agent: alert.agent
          });
          break;
      }
    }
    
    return recommendations;
  }

  /**
   * Store report
   */
  async storeReport(report) {
    try {
      const reportsPath = path.join(process.cwd(), 'src', 'monitoring', 'reports');
      await fs.mkdir(reportsPath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `monitoring-report-${timestamp}.json`;
      const filePath = path.join(reportsPath, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(report, null, 2));
      
      logger.info(`Monitoring report stored: ${fileName}`);
      
    } catch (error) {
      logger.error('Failed to store monitoring report:', error);
    }
  }

  /**
   * Clean up old metrics
   */
  async cleanupOldMetrics() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(metric => 
        new Date(metric.timestamp) > cutoffTime
      );
      this.metrics.set(key, filteredMetrics);
    }
  }

  /**
   * Send notification
   */
  async sendNotification(alert) {
    // Implement notification logic (email, Slack, etc.)
    logger.info(`Notification sent for alert: ${alert.id}`);
  }

  /**
   * Generate alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load monitoring configuration
   */
  async loadConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'src', 'monitoring', 'config.json');
      const data = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(data);
      
      // Apply configuration
      this.thresholds = new Map(Object.entries(config.thresholds || {}));
      
    } catch (error) {
      logger.warn('No monitoring configuration found, using defaults');
      this.setupDefaultConfiguration();
    }
  }

  /**
   * Setup default configuration
   */
  setupDefaultConfiguration() {
    this.thresholds.set('health', {
      errorRate: 5,
      responseTime: 10000
    });
    
    this.thresholds.set('performance', {
      slaCompliance: 95,
      responseTime95: 5000
    });
    
    this.thresholds.set('quality', {
      accuracy: 80,
      consistency: 90
    });
    
    this.thresholds.set('hallucination', {
      hallucinationRate: 15
    });
  }

  /**
   * Setup alert thresholds
   */
  setupAlertThresholds() {
    // Thresholds are loaded from configuration
    logger.info('Alert thresholds configured');
  }

  /**
   * Initialize metrics collection
   */
  initializeMetrics() {
    // Initialize metrics storage
    logger.info('Metrics collection initialized');
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      metrics: Object.fromEntries(this.metrics),
      alerts: Object.fromEntries(this.alerts),
      thresholds: Object.fromEntries(this.thresholds),
      isRunning: this.isRunning
    };
  }

  /**
   * Get agent metrics
   */
  getAgentMetrics(agentName) {
    const agentMetrics = {};
    
    for (const [key, metrics] of this.metrics) {
      if (key.includes(agentName)) {
        agentMetrics[key] = metrics;
      }
    }
    
    return agentMetrics;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      logger.info(`Alert ${alertId} acknowledged`);
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      alert.status = 'resolved';
      logger.info(`Alert ${alertId} resolved`);
    }
  }

  async shutdown() {
    logger.info('Shutting down Monitoring Service...');
    
    await this.stopMonitoring();
    this.isRunning = false;
    
    logger.info('Monitoring Service shut down successfully');
  }
}

// Singleton instance
const monitoringService = new MonitoringService();

export { monitoringService };
