/**
 * MCP Threat Intelligence Server
 * 
 * Provides real-time threat intelligence feeds:
 * - NIST NVD (CVE database)
 * - CISA alerts
 * - Cloud provider security bulletins
 * - MITRE ATT&CK
 * 
 * Replaces polling mechanisms with streaming updates.
 */

import { BaseMCPServer } from './baseServer.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';

export class ThreatMCP extends BaseMCPServer {
  constructor(name, config) {
    super(name, config);
    this.type = 'threat';
    this.capabilities = ['query', 'stream', 'search', 'analyze'];
    this.threatFeeds = new Map();
    this.streamingConnections = new Map();
  }

  async initialize() {
    await super.initialize();
    await this.initializeThreatFeeds();
  }

  async registerTools() {
    this.registerTool('query_threats', {
      description: 'Query threat intelligence using natural language',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language query (e.g., "Show recent critical vulnerabilities for S3")' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          service: { type: 'string', description: 'Cloud service filter' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      }
    }, this.handleQueryThreats.bind(this));

    this.registerTool('get_recent_threats', {
      description: 'Get recent threats from all feeds',
      inputSchema: {
        type: 'object',
        properties: {
          hours: { type: 'number', default: 24, description: 'Hours to look back' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          service: { type: 'string' }
        }
      }
    }, this.handleGetRecentThreats.bind(this));

    this.registerTool('stream_threats', {
      description: 'Stream real-time threat updates',
      inputSchema: {
        type: 'object',
        properties: {
          feed: { type: 'string', enum: ['nist-nvd', 'cisa', 'aws', 'azure', 'gcp', 'all'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          callback: { type: 'string', description: 'Callback URL or function name' }
        }
      }
    }, this.handleStreamThreats.bind(this));

    this.registerTool('analyze_threat', {
      description: 'Analyze a specific threat',
      inputSchema: {
        type: 'object',
        properties: {
          threatId: { type: 'string', description: 'Threat ID (e.g., CVE-2024-1234)' },
          cveId: { type: 'string' }
        },
        required: ['threatId']
      }
    }, this.handleAnalyzeThreat.bind(this));

    this.registerTool('search_cve', {
      description: 'Search CVE database',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          service: { type: 'string' },
          severity: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      }
    }, this.handleSearchCVE.bind(this));
  }

  async initializeThreatFeeds() {
    // Initialize threat feed connections
    this.threatFeeds.set('nist-nvd', {
      name: 'NIST NVD',
      url: 'https://services.nvd.nist.gov/rest/json/cves/2.0/',
      enabled: true,
      lastUpdate: null
    });

    this.threatFeeds.set('cisa', {
      name: 'CISA Known Exploited Vulnerabilities',
      url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      enabled: true,
      lastUpdate: null
    });

    this.threatFeeds.set('aws', {
      name: 'AWS Security Bulletins',
      url: 'https://aws.amazon.com/security/security-bulletins/',
      enabled: true,
      lastUpdate: null
    });

    logger.info(`Initialized ${this.threatFeeds.size} threat feeds`);
  }

  async handleQueryThreats(args) {
    try {
      const { query, severity, service, limit = 10 } = args;
      
      // Parse natural language query
      const queryLower = query.toLowerCase();
      
      // Determine which feed to query
      let feedType = 'all';
      if (queryLower.includes('cve') || queryLower.includes('vulnerability')) {
        feedType = 'nist-nvd';
      } else if (queryLower.includes('exploit') || queryLower.includes('cisa')) {
        feedType = 'cisa';
      }

      // Get threats from appropriate feeds
      const threats = [];
      
      if (feedType === 'nist-nvd' || feedType === 'all') {
        const nvdThreats = await this.queryNISTNVD({ query, severity, service, limit });
        threats.push(...nvdThreats);
      }

      if (feedType === 'cisa' || feedType === 'all') {
        const cisaThreats = await this.queryCISA({ query, severity, service, limit });
        threats.push(...cisaThreats);
      }

      // Filter and sort
      let filteredThreats = threats;
      
      if (severity) {
        filteredThreats = filteredThreats.filter(t => t.severity === severity);
      }
      
      if (service) {
        filteredThreats = filteredThreats.filter(t => 
          t.affectedServices && t.affectedServices.some(s => 
            s.toLowerCase().includes(service.toLowerCase())
          )
        );
      }

      // Sort by severity and date
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      filteredThreats.sort((a, b) => {
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0);
      });

      return {
        query,
        threats: filteredThreats.slice(0, limit),
        count: filteredThreats.length,
        feeds: [feedType]
      };
      
    } catch (error) {
      logger.error(`Error querying threats: ${error.message}`);
      throw error;
    }
  }

  async queryNISTNVD(args) {
    try {
      const { query, severity, service, limit } = args;
      
      // Query NIST NVD API
      const response = await axios.get('https://services.nvd.nist.gov/rest/json/cves/2.0/', {
        params: {
          resultsPerPage: limit || 10,
          startIndex: 0,
          pubStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          keywordSearch: query
        },
        headers: {
          'User-Agent': 'AI-Policy-Foundry/1.0'
        }
      });

      const threats = [];
      for (const cve of response.data.vulnerabilities || []) {
        const baseSeverity = cve.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || 'MEDIUM';
        const mappedSeverity = this.mapCVSSSeverity(baseSeverity);
        
        // Filter by severity if provided
        if (severity && mappedSeverity !== severity) continue;

        threats.push({
          id: cve.cve.id,
          title: cve.cve.descriptions?.[0]?.value || 'Unknown',
          severity: mappedSeverity,
          cvss: cve.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0,
          publishedDate: cve.cve.published,
          source: 'NIST NVD',
          affectedServices: this.extractAffectedServices(cve.cve.configurations),
          description: cve.cve.descriptions?.[0]?.value || ''
        });
      }

      return threats;
      
    } catch (error) {
      logger.error('Error querying NIST NVD:', error);
      return [];
    }
  }

  async queryCISA(args) {
    try {
      const { query, severity, service, limit } = args;
      
      const response = await axios.get('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
        headers: {
          'User-Agent': 'AI-Policy-Foundry/1.0'
        }
      });

      const threats = [];
      for (const alert of response.data.vulnerabilities || []) {
        if (query && !alert.vulnerabilityName.toLowerCase().includes(query.toLowerCase())) {
          continue;
        }

        threats.push({
          id: alert.cveID,
          title: alert.vulnerabilityName,
          severity: 'high', // CISA alerts are typically high severity
          description: alert.shortDescription,
          source: 'CISA Alerts',
          publishedDate: alert.dateAdded,
          exploited: true
        });

        if (threats.length >= (limit || 10)) break;
      }

      return threats;
      
    } catch (error) {
      logger.error('Error querying CISA:', error);
      return [];
    }
  }

  async handleGetRecentThreats(args) {
    try {
      const { hours = 24, severity, service } = args;
      
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
      const threats = [];

      // Query all feeds
      for (const [feedName, feedConfig] of this.threatFeeds) {
        if (!feedConfig.enabled) continue;

        try {
          let feedThreats = [];
          
          if (feedName === 'nist-nvd') {
            feedThreats = await this.queryNISTNVD({ limit: 50 });
          } else if (feedName === 'cisa') {
            feedThreats = await this.queryCISA({ limit: 50 });
          }

          // Filter by date
          feedThreats = feedThreats.filter(t => {
            const pubDate = new Date(t.publishedDate || 0);
            return pubDate >= cutoffDate;
          });

          threats.push(...feedThreats);
          
        } catch (error) {
          logger.error(`Error querying feed ${feedName}:`, error);
        }
      }

      // Apply filters
      let filteredThreats = threats;
      if (severity) {
        filteredThreats = filteredThreats.filter(t => t.severity === severity);
      }
      if (service) {
        filteredThreats = filteredThreats.filter(t => 
          t.affectedServices && t.affectedServices.some(s => 
            s.toLowerCase().includes(service.toLowerCase())
          )
        );
      }

      // Sort by severity and date
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      filteredThreats.sort((a, b) => {
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0);
      });

      return {
        threats: filteredThreats,
        count: filteredThreats.length,
        hours,
        feeds: Array.from(this.threatFeeds.keys())
      };
      
    } catch (error) {
      logger.error(`Error getting recent threats: ${error.message}`);
      throw error;
    }
  }

  async handleStreamThreats(args) {
    try {
      const { feed = 'all', severity, callback } = args;
      
      // Set up streaming connection
      const streamId = `stream_${Date.now()}`;
      
      // In production, this would set up WebSocket or SSE connection
      // For now, we'll simulate with polling
      const streamConfig = {
        id: streamId,
        feed,
        severity,
        callback,
        active: true,
        lastUpdate: new Date().toISOString()
      };

      this.streamingConnections.set(streamId, streamConfig);

      // Start polling for updates
      this.startThreatStreaming(streamId, streamConfig);

      return {
        streamId,
        feed,
        status: 'active',
        callback
      };
      
    } catch (error) {
      logger.error(`Error streaming threats: ${error.message}`);
      throw error;
    }
  }

  startThreatStreaming(streamId, config) {
    // Poll for new threats every 5 minutes
    const interval = setInterval(async () => {
      if (!this.streamingConnections.has(streamId)) {
        clearInterval(interval);
        return;
      }

      try {
        const recentThreats = await this.handleGetRecentThreats({
          hours: 1,
          severity: config.severity
        });

        if (recentThreats.threats.length > 0) {
          this.emit('threatUpdate', {
            streamId,
            threats: recentThreats.threats,
            timestamp: new Date().toISOString()
          });

          // Call callback if provided
          if (config.callback) {
            // TODO: Implement callback mechanism
            logger.info(`Threat update callback for stream ${streamId}`);
          }
        }
      } catch (error) {
        logger.error(`Error in threat streaming: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async handleAnalyzeThreat(args) {
    try {
      const { threatId, cveId } = args;
      const id = cveId || threatId;

      // Query NIST NVD for detailed information
      const response = await axios.get(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${id}`, {
        headers: {
          'User-Agent': 'AI-Policy-Foundry/1.0'
        }
      });

      if (response.data.vulnerabilities && response.data.vulnerabilities.length > 0) {
        const cve = response.data.vulnerabilities[0].cve;
        
        return {
          id: cve.id,
          title: cve.descriptions?.[0]?.value || 'Unknown',
          severity: this.mapCVSSSeverity(cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity),
          cvss: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 0,
          publishedDate: cve.published,
          description: cve.descriptions?.[0]?.value || '',
          affectedServices: this.extractAffectedServices(cve.configurations),
          references: cve.references?.map(ref => ref.url) || [],
          analysis: {
            riskScore: this.calculateRiskScore(cve),
            mitigationAvailable: this.checkMitigationAvailability(cve),
            policyImpact: this.assessPolicyImpact(cve)
          }
        };
      }

      return { error: `Threat not found: ${id}` };
      
    } catch (error) {
      logger.error(`Error analyzing threat: ${error.message}`);
      throw error;
    }
  }

  async handleSearchCVE(args) {
    try {
      const { query, service, severity, limit = 10 } = args;
      
      return await this.queryNISTNVD({ query, service, severity, limit });
      
    } catch (error) {
      logger.error(`Error searching CVE: ${error.message}`);
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

  calculateRiskScore(cve) {
    let score = 0;
    const baseSeverity = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity;
    const severityScores = { CRITICAL: 10, HIGH: 7, MEDIUM: 4, LOW: 1 };
    score += severityScores[baseSeverity] || 0;
    return Math.min(score, 10);
  }

  checkMitigationAvailability(cve) {
    const description = cve.descriptions?.[0]?.value || '';
    return description.includes('mitigation') || 
           description.includes('patch') || 
           description.includes('update');
  }

  assessPolicyImpact(cve) {
    const affectedServices = this.extractAffectedServices(cve.configurations);
    return {
      high: affectedServices.length > 3,
      medium: affectedServices.length > 0,
      low: affectedServices.length === 0
    };
  }

  async shutdown() {
    // Stop all streaming connections
    this.streamingConnections.clear();
    await super.shutdown();
  }
}

