import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * Wiz Integration Service
 * 
 * Integrates with Wiz API to fetch policy data and security configurations.
 * Wiz is a cloud security platform that provides CSPM (Cloud Security Posture Management).
 * 
 * API Documentation: https://docs.wiz.io/
 */
export class WizIntegrationService {
  constructor() {
    this.apiUrl = process.env.WIZ_API_URL || 'https://api.wiz.io';
    this.apiToken = process.env.WIZ_API_TOKEN;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!this.apiToken) {
        logger.warn('Wiz API token not configured. Wiz integration will use mock data.');
        this.isInitialized = true;
        return;
      }

      // Test connection
      await this.testConnection();
      this.isInitialized = true;
      logger.info('Wiz Integration Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Wiz Integration Service:', error);
      // Continue with mock data if initialization fails
      this.isInitialized = true;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        }
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Wiz API connection test failed, using mock data');
      return false;
    }
  }

  /**
   * Fetch all policies from Wiz
   * @returns {Promise<Array>} Array of Wiz policies
   */
  async fetchPolicies() {
    try {
      if (!this.apiToken) {
        return this.getMockPolicies();
      }

      const response = await axios.get(`${this.apiUrl}/v1/policies`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 100,
          orderBy: 'UPDATED_AT',
          orderDirection: 'DESC'
        }
      });

      return this.normalizeWizPolicies(response.data?.policies || []);
      
    } catch (error) {
      logger.error('Failed to fetch Wiz policies:', error);
      // Fallback to mock data
      return this.getMockPolicies();
    }
  }

  /**
   * Fetch policies by service/resource type
   * @param {string} serviceType - Cloud service type (e.g., 'AWS S3', 'Azure Storage')
   * @returns {Promise<Array>} Filtered policies
   */
  async fetchPoliciesByService(serviceType) {
    try {
      const allPolicies = await this.fetchPolicies();
      
      // Filter policies that match the service type
      const serviceKeywords = this.extractServiceKeywords(serviceType);
      
      return allPolicies.filter(policy => {
        const policyText = JSON.stringify(policy).toLowerCase();
        return serviceKeywords.some(keyword => 
          policyText.includes(keyword.toLowerCase())
        );
      });
      
    } catch (error) {
      logger.error(`Failed to fetch Wiz policies for service ${serviceType}:`, error);
      return [];
    }
  }

  /**
   * Fetch policies by threat category
   * @param {Object} threat - Threat object with category/type information
   * @returns {Promise<Array>} Relevant policies
   */
  async fetchPoliciesByThreat(threat) {
    try {
      const allPolicies = await this.fetchPolicies();
      
      // Extract threat keywords
      const threatKeywords = this.extractThreatKeywords(threat);
      
      return allPolicies.filter(policy => {
        const policyText = JSON.stringify(policy).toLowerCase();
        const policyTitle = (policy.name || '').toLowerCase();
        const policyDescription = (policy.description || '').toLowerCase();
        
        // Check if policy addresses the threat
        return threatKeywords.some(keyword => 
          policyText.includes(keyword.toLowerCase()) ||
          policyTitle.includes(keyword.toLowerCase()) ||
          policyDescription.includes(keyword.toLowerCase())
        );
      });
      
    } catch (error) {
      logger.error(`Failed to fetch Wiz policies for threat:`, error);
      return [];
    }
  }

  /**
   * Get policy details by ID
   * @param {string} policyId - Wiz policy ID
   * @returns {Promise<Object>} Policy details
   */
  async getPolicyById(policyId) {
    try {
      if (!this.apiToken) {
        return this.getMockPolicyById(policyId);
      }

      const response = await axios.get(`${this.apiUrl}/v1/policies/${policyId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      return this.normalizeWizPolicy(response.data);
      
    } catch (error) {
      logger.error(`Failed to fetch Wiz policy ${policyId}:`, error);
      return null;
    }
  }

  /**
   * Normalize Wiz policy format to internal format
   */
  normalizeWizPolicies(wizPolicies) {
    return wizPolicies.map(policy => this.normalizeWizPolicy(policy));
  }

  normalizeWizPolicy(wizPolicy) {
    return {
      id: wizPolicy.id || wizPolicy.policyId,
      name: wizPolicy.name || wizPolicy.title,
      description: wizPolicy.description || wizPolicy.summary,
      severity: wizPolicy.severity || wizPolicy.riskLevel || 'medium',
      service: wizPolicy.service || wizPolicy.resourceType,
      category: wizPolicy.category || wizPolicy.type,
      controls: wizPolicy.controls || wizPolicy.securityControls || [],
      rules: wizPolicy.rules || wizPolicy.conditions || [],
      status: wizPolicy.status || 'active',
      lastUpdated: wizPolicy.updatedAt || wizPolicy.lastModified,
      compliance: wizPolicy.compliance || [],
      tags: wizPolicy.tags || []
    };
  }

  /**
   * Extract service keywords for matching
   */
  extractServiceKeywords(serviceType) {
    const serviceMap = {
      'AWS S3': ['s3', 'bucket', 'storage', 'aws'],
      'AWS Lambda': ['lambda', 'function', 'serverless', 'aws'],
      'AWS EC2': ['ec2', 'instance', 'compute', 'aws'],
      'Azure Storage': ['azure', 'storage', 'blob', 'container'],
      'Azure Functions': ['azure', 'function', 'serverless'],
      'Azure VM': ['azure', 'vm', 'virtual machine'],
      'GCP Cloud Storage': ['gcp', 'storage', 'bucket', 'cloud storage'],
      'GCP Cloud Functions': ['gcp', 'function', 'cloud function'],
      'GCP Compute Engine': ['gcp', 'compute', 'instance']
    };

    const keywords = serviceMap[serviceType] || [];
    // Add generic keywords
    keywords.push(serviceType.toLowerCase());
    return keywords;
  }

  /**
   * Extract threat keywords for matching
   */
  extractThreatKeywords(threat) {
    const keywords = [];
    
    // Add threat title words
    if (threat.title) {
      keywords.push(...threat.title.toLowerCase().split(/\s+/));
    }
    
    // Add threat description keywords
    if (threat.description) {
      const descWords = threat.description.toLowerCase().split(/\s+/);
      keywords.push(...descWords.filter(word => word.length > 4));
    }
    
    // Add threat category/type
    if (threat.category) keywords.push(threat.category.toLowerCase());
    if (threat.type) keywords.push(threat.type.toLowerCase());
    if (threat.cve) keywords.push(threat.cve.toLowerCase());
    
    // Add common security keywords
    const securityKeywords = [
      'encryption', 'access', 'authentication', 'authorization',
      'vulnerability', 'exploit', 'breach', 'attack', 'malware',
      'ransomware', 'phishing', 'ddos', 'injection', 'xss',
      'misconfiguration', 'exposure', 'leak', 'unauthorized'
    ];
    
    keywords.push(...securityKeywords);
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Mock policies for development/testing
   */
  getMockPolicies() {
    return [
      {
        id: 'wiz-policy-001',
        name: 'S3 Bucket Public Access Block',
        description: 'Ensures S3 buckets have public access blocked',
        severity: 'high',
        service: 'AWS S3',
        category: 'access-control',
        controls: ['public-access-block', 'bucket-policy'],
        status: 'active',
        lastUpdated: new Date().toISOString(),
        compliance: ['CIS 2.1.1', 'NIST AC-3']
      },
      {
        id: 'wiz-policy-002',
        name: 'Encryption at Rest for Storage',
        description: 'Requires encryption at rest for all storage services',
        severity: 'high',
        service: 'AWS S3',
        category: 'encryption',
        controls: ['encryption-at-rest', 'kms'],
        status: 'active',
        lastUpdated: new Date().toISOString(),
        compliance: ['CIS 3.1', 'NIST SC-28']
      },
      {
        id: 'wiz-policy-003',
        name: 'Lambda Function Environment Variables Encryption',
        description: 'Ensures Lambda environment variables are encrypted',
        severity: 'medium',
        service: 'AWS Lambda',
        category: 'encryption',
        controls: ['kms-encryption', 'environment-variables'],
        status: 'active',
        lastUpdated: new Date().toISOString(),
        compliance: ['CIS 3.2']
      },
      {
        id: 'wiz-policy-004',
        name: 'EC2 Instance Public IP Restriction',
        description: 'Restricts public IP assignment on EC2 instances',
        severity: 'medium',
        service: 'AWS EC2',
        category: 'network-security',
        controls: ['public-ip-restriction', 'security-groups'],
        status: 'active',
        lastUpdated: new Date().toISOString(),
        compliance: ['CIS 4.1']
      },
      {
        id: 'wiz-policy-005',
        name: 'Multi-Factor Authentication for IAM',
        description: 'Requires MFA for all IAM users',
        severity: 'critical',
        service: 'AWS IAM',
        category: 'access-control',
        controls: ['mfa', 'iam-policy'],
        status: 'active',
        lastUpdated: new Date().toISOString(),
        compliance: ['CIS 1.3', 'NIST AC-2']
      }
    ];
  }

  getMockPolicyById(policyId) {
    const policies = this.getMockPolicies();
    return policies.find(p => p.id === policyId) || null;
  }
}

export default new WizIntegrationService();

