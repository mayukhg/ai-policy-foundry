import axios from 'axios';
import { logger } from '../utils/logger.js';
import { ThreatFeed } from '../models/ThreatFeed.js';
import { ThreatAlert } from '../models/ThreatAlert.js';
import { Vulnerability } from '../models/Vulnerability.js';

export class ThreatIntelligenceAgent {
  constructor() {
    this.isInitialized = false;
    this.threatFeeds = new Map();
    this.activeAlerts = new Map();
    this.vulnerabilities = new Map();
    this.lastScanTime = null;
  }

  async initialize() {
    try {
      logger.info('Initializing Threat Intelligence Agent...');
      
      // Load threat feeds configuration
      await this.loadThreatFeeds();
      
      // Initialize threat monitoring
      await this.initializeMonitoring();
      
      this.isInitialized = true;
      logger.info('Threat Intelligence Agent initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Threat Intelligence Agent:', error);
      throw error;
    }
  }

  async executeTask(task, data) {
    if (!this.isInitialized) {
      throw new Error('Threat Intelligence Agent not initialized');
    }

    switch (task) {
      case 'scan':
        return await this.scanThreatFeeds(data);
      case 'analyze':
        return await this.analyzeThreat(data.threat);
      case 'correlate':
        return await this.correlateWithPolicies(data.threats, data.policies);
      case 'alert':
        return await this.generateAlert(data.threat);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async scanThreatFeeds(options = {}) {
    try {
      logger.info('Scanning threat intelligence feeds...');
      
      const threats = [];
      const scanTime = new Date();
      
      // Scan each configured threat feed
      for (const [feedName, feedConfig] of this.threatFeeds) {
        try {
          const feedThreats = await this.scanFeed(feedName, feedConfig);
          threats.push(...feedThreats);
          
          logger.debug(`Scanned ${feedName}: ${feedThreats.length} threats found`);
          
        } catch (error) {
          logger.error(`Failed to scan feed ${feedName}:`, error);
        }
      }
      
      // Process and deduplicate threats
      const processedThreats = await this.processThreats(threats);
      
      // Update last scan time
      this.lastScanTime = scanTime;
      
      logger.info(`Threat scan completed: ${processedThreats.length} unique threats found`);
      return processedThreats;
      
    } catch (error) {
      logger.error('Failed to scan threat feeds:', error);
      throw error;
    }
  }

  async scanFeed(feedName, feedConfig) {
    const threats = [];
    
    switch (feedConfig.type) {
      case 'nist-nvd':
        threats.push(...await this.scanNISTNVD(feedConfig));
        break;
      case 'mitre-attack':
        threats.push(...await this.scanMITREAttack(feedConfig));
        break;
      case 'cisa-alerts':
        threats.push(...await this.scanCISAAlerts(feedConfig));
        break;
      case 'cloud-security-alliance':
        threats.push(...await this.scanCloudSecurityAlliance(feedConfig));
        break;
      default:
        logger.warn(`Unknown feed type: ${feedConfig.type}`);
    }
    
    return threats;
  }

  async scanNISTNVD(config) {
    try {
      const response = await axios.get('https://services.nvd.nist.gov/rest/json/cves/2.0/', {
        params: {
          resultsPerPage: 50,
          startIndex: 0,
          pubStartDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          pubEndDate: new Date().toISOString()
        },
        headers: {
          'User-Agent': 'AI-Policy-Foundry/1.0'
        }
      });

      const threats = [];
      for (const cve of response.data.vulnerabilities || []) {
        threats.push({
          id: cve.cve.id,
          title: cve.cve.descriptions?.[0]?.value || 'Unknown',
          severity: this.mapCVSSSeverity(cve.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity),
          cvss: cve.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0,
          publishedDate: cve.cve.published,
          source: 'NIST NVD',
          affectedServices: this.extractAffectedServices(cve.cve.configurations),
          description: cve.cve.descriptions?.[0]?.value || ''
        });
      }
      
      return threats;
      
    } catch (error) {
      logger.error('Failed to scan NIST NVD:', error);
      return [];
    }
  }

  async scanMITREAttack(config) {
    try {
      // MITRE ATT&CK API endpoint for recent techniques
      const response = await axios.get('https://attack.mitre.org/api/techniques/enterprise/', {
        headers: {
          'User-Agent': 'AI-Policy-Foundry/1.0'
        }
      });

      const threats = [];
      for (const technique of response.data.slice(0, 20)) { // Limit to recent 20
        threats.push({
          id: technique.attackID,
          title: technique.name,
          severity: 'medium', // MITRE doesn't provide severity
          description: technique.description,
          source: 'MITRE ATT&CK',
          technique: technique.attackID,
          tactics: technique.tactics || []
        });
      }
      
      return threats;
      
    } catch (error) {
      logger.error('Failed to scan MITRE ATT&CK:', error);
      return [];
    }
  }

  async scanCISAAlerts(config) {
    try {
      // CISA alerts RSS feed
      const response = await axios.get('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
        headers: {
          'User-Agent': 'AI-Policy-Foundry/1.0'
        }
      });

      const threats = [];
      for (const alert of response.data.vulnerabilities || []) {
        threats.push({
          id: alert.cveID,
          title: alert.vulnerabilityName,
          severity: 'high', // CISA alerts are typically high severity
          description: alert.shortDescription,
          source: 'CISA Alerts',
          publishedDate: alert.dateAdded,
          exploited: true
        });
      }
      
      return threats;
      
    } catch (error) {
      logger.error('Failed to scan CISA alerts:', error);
      return [];
    }
  }

  async scanCloudSecurityAlliance(config) {
    try {
      // Cloud Security Alliance alerts (simulated)
      const threats = [
        {
          id: 'CSA-2024-001',
          title: 'Cloud Storage Misconfiguration Risk',
          severity: 'medium',
          description: 'New attack vectors targeting cloud storage misconfigurations',
          source: 'Cloud Security Alliance',
          publishedDate: new Date().toISOString(),
          affectedServices: ['S3', 'Storage', 'Blob Storage']
        }
      ];
      
      return threats;
      
    } catch (error) {
      logger.error('Failed to scan Cloud Security Alliance:', error);
      return [];
    }
  }

  async processThreats(threats) {
    const processedThreats = [];
    const seenIds = new Set();
    
    for (const threat of threats) {
      if (!seenIds.has(threat.id)) {
        seenIds.add(threat.id);
        
        // Enrich threat data
        const enrichedThreat = await this.enrichThreat(threat);
        processedThreats.push(enrichedThreat);
      }
    }
    
    // Sort by severity and recency
    processedThreats.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      return new Date(b.publishedDate) - new Date(a.publishedDate);
    });
    
    return processedThreats;
  }

  async enrichThreat(threat) {
    // Add additional context and analysis
    const enriched = {
      ...threat,
      riskScore: this.calculateRiskScore(threat),
      mitigationAvailable: this.checkMitigationAvailability(threat),
      policyImpact: this.assessPolicyImpact(threat),
      lastUpdated: new Date().toISOString()
    };
    
    return enriched;
  }

  calculateRiskScore(threat) {
    let score = 0;
    
    // Base score from severity
    const severityScores = { critical: 10, high: 7, medium: 4, low: 1 };
    score += severityScores[threat.severity] || 0;
    
    // Bonus for exploited vulnerabilities
    if (threat.exploited) score += 3;
    
    // Bonus for cloud-specific threats
    if (threat.affectedServices && threat.affectedServices.length > 0) score += 2;
    
    return Math.min(score, 10);
  }

  checkMitigationAvailability(threat) {
    // Check if mitigation strategies are available
    const hasMitigation = threat.description && 
      (threat.description.includes('mitigation') || 
       threat.description.includes('patch') ||
       threat.description.includes('update'));
    
    return hasMitigation;
  }

  assessPolicyImpact(threat) {
    // Assess potential impact on existing policies
    const impact = {
      high: threat.affectedServices && threat.affectedServices.length > 3,
      medium: threat.affectedServices && threat.affectedServices.length > 0,
      low: !threat.affectedServices || threat.affectedServices.length === 0
    };
    
    return impact;
  }

  async analyzeThreat(threat) {
    try {
      const analysis = {
        threatId: threat.id,
        analysisTime: new Date().toISOString(),
        riskAssessment: {
          overallRisk: this.calculateRiskScore(threat),
          likelihood: this.assessLikelihood(threat),
          impact: this.assessImpact(threat)
        },
        affectedAssets: await this.identifyAffectedAssets(threat),
        recommendedActions: this.generateRecommendedActions(threat),
        policyUpdates: await this.suggestPolicyUpdates(threat)
      };
      
      return analysis;
      
    } catch (error) {
      logger.error('Failed to analyze threat:', error);
      throw error;
    }
  }

  assessLikelihood(threat) {
    // Assess likelihood based on various factors
    let likelihood = 'low';
    
    if (threat.exploited) likelihood = 'high';
    else if (threat.cvss && threat.cvss >= 7) likelihood = 'medium';
    else if (threat.affectedServices && threat.affectedServices.length > 0) likelihood = 'medium';
    
    return likelihood;
  }

  assessImpact(threat) {
    // Assess potential impact
    let impact = 'low';
    
    if (threat.severity === 'critical') impact = 'high';
    else if (threat.affectedServices && threat.affectedServices.includes('IAM')) impact = 'high';
    else if (threat.affectedServices && threat.affectedServices.includes('KMS')) impact = 'high';
    
    return impact;
  }

  async identifyAffectedAssets(threat) {
    // Identify potentially affected assets based on threat
    const assets = [];
    
    if (threat.affectedServices) {
      for (const service of threat.affectedServices) {
        assets.push({
          type: 'cloud-service',
          name: service,
          risk: threat.severity
        });
      }
    }
    
    return assets;
  }

  generateRecommendedActions(threat) {
    const actions = [];
    
    if (threat.severity === 'critical') {
      actions.push('Immediate investigation required');
      actions.push('Review affected services for vulnerabilities');
    }
    
    if (threat.affectedServices && threat.affectedServices.length > 0) {
      actions.push('Update policies for affected services');
      actions.push('Implement additional monitoring');
    }
    
    if (threat.exploited) {
      actions.push('Check for signs of compromise');
      actions.push('Review access logs for affected services');
    }
    
    return actions;
  }

  async suggestPolicyUpdates(threat) {
    const updates = [];
    
    if (threat.affectedServices) {
      for (const service of threat.affectedServices) {
        updates.push({
          service: service,
          type: 'security-control',
          description: `Add security controls for ${threat.id}`,
          priority: threat.severity === 'critical' ? 'high' : 'medium'
        });
      }
    }
    
    return updates;
  }

  async correlateWithPolicies(threats, policies) {
    try {
      const correlations = [];
      
      for (const threat of threats) {
        const correlation = {
          threatId: threat.id,
          affectedPolicies: [],
          coverageGaps: [],
          recommendations: []
        };
        
        // Check which policies are affected
        for (const policy of policies) {
          if (this.isPolicyAffected(threat, policy)) {
            correlation.affectedPolicies.push(policy.id);
          }
        }
        
        // Identify coverage gaps
        if (threat.affectedServices) {
          for (const service of threat.affectedServices) {
            const hasPolicy = policies.some(p => 
              p.service === service && p.status === 'active'
            );
            
            if (!hasPolicy) {
              correlation.coverageGaps.push(service);
            }
          }
        }
        
        correlations.push(correlation);
      }
      
      return correlations;
      
    } catch (error) {
      logger.error('Failed to correlate threats with policies:', error);
      throw error;
    }
  }

  isPolicyAffected(threat, policy) {
    // Check if a policy is affected by a threat
    if (threat.affectedServices && policy.service) {
      return threat.affectedServices.includes(policy.service);
    }
    
    return false;
  }

  async generateAlert(threat) {
    try {
      const alert = {
        id: `alert-${threat.id}-${Date.now()}`,
        threatId: threat.id,
        severity: threat.severity,
        title: `New ${threat.severity} severity threat detected: ${threat.title}`,
        description: threat.description,
        timestamp: new Date().toISOString(),
        source: threat.source,
        affectedServices: threat.affectedServices || [],
        recommendedActions: this.generateRecommendedActions(threat),
        status: 'new'
      };
      
      // Store alert
      this.activeAlerts.set(alert.id, alert);
      
      return alert;
      
    } catch (error) {
      logger.error('Failed to generate alert:', error);
      throw error;
    }
  }

  mapCVSSSeverity(baseSeverity) {
    const mapping = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low'
    };
    
    return mapping[baseSeverity] || 'medium';
  }

  extractAffectedServices(configurations) {
    const services = [];
    
    if (configurations && configurations.nodes) {
      for (const node of configurations.nodes) {
        if (node.cpeMatch) {
          for (const cpe of node.cpeMatch) {
            if (cpe.cpe23Uri) {
              // Extract service from CPE
              const parts = cpe.cpe23Uri.split(':');
              if (parts.length > 4) {
                const service = parts[4];
                if (service && !services.includes(service)) {
                  services.push(service);
                }
              }
            }
          }
        }
      }
    }
    
    return services;
  }

  async loadThreatFeeds() {
    try {
      // Load threat feeds from database
      const feeds = await ThreatFeed.findAll();
      
      for (const feed of feeds) {
        this.threatFeeds.set(feed.name, {
          type: feed.type,
          url: feed.url,
          apiKey: feed.apiKey,
          enabled: feed.enabled,
          lastScan: feed.lastScan
        });
      }
      
      // Add default feeds if none configured
      if (this.threatFeeds.size === 0) {
        this.threatFeeds.set('nist-nvd', {
          type: 'nist-nvd',
          url: 'https://services.nvd.nist.gov/rest/json/cves/2.0/',
          enabled: true
        });
        
        this.threatFeeds.set('mitre-attack', {
          type: 'mitre-attack',
          url: 'https://attack.mitre.org/api/techniques/enterprise/',
          enabled: true
        });
      }
      
    } catch (error) {
      logger.error('Failed to load threat feeds:', error);
      throw error;
    }
  }

  async initializeMonitoring() {
    // Set up periodic threat scanning
    setInterval(async () => {
      try {
        await this.scanThreatFeeds();
      } catch (error) {
        logger.error('Periodic threat scan failed:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async shutdown() {
    logger.info('Shutting down Threat Intelligence Agent...');
    this.isInitialized = false;
  }
} 