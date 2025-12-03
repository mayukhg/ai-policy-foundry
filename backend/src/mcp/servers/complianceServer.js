/**
 * MCP Compliance Framework Server
 * 
 * Provides structured access to compliance frameworks:
 * - CIS Benchmarks
 * - NIST Cybersecurity Framework
 * - ISO 27001
 * - SOC 2
 * 
 * Enables dynamic querying of compliance controls instead of hardcoded knowledge.
 */

import { BaseMCPServer } from './baseServer.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';

export class ComplianceMCP extends BaseMCPServer {
  constructor(name, config) {
    super(name, config);
    this.type = 'compliance';
    this.capabilities = ['query', 'get-controls', 'validate', 'map'];
    this.frameworks = new Map();
  }

  async initialize() {
    await super.initialize();
    await this.loadFrameworks();
  }

  async registerTools() {
    this.registerTool('get_controls', {
      description: 'Get compliance controls for a framework and service',
      inputSchema: {
        type: 'object',
        properties: {
          framework: { type: 'string', enum: ['CIS', 'NIST', 'ISO27001', 'SOC2'] },
          service: { type: 'string', description: 'Cloud service (e.g., S3, Lambda, Kubernetes)' },
          version: { type: 'string', description: 'Framework version' },
          controlId: { type: 'string', description: 'Specific control ID' }
        },
        required: ['framework']
      }
    }, this.handleGetControls.bind(this));

    this.registerTool('query_requirements', {
      description: 'Query compliance requirements using natural language',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language query' },
          framework: { type: 'string', enum: ['CIS', 'NIST', 'ISO27001', 'SOC2'] }
        },
        required: ['query']
      }
    }, this.handleQueryRequirements.bind(this));

    this.registerTool('validate_compliance', {
      description: 'Validate policy against compliance framework',
      inputSchema: {
        type: 'object',
        properties: {
          policy: { type: 'object', description: 'Policy to validate' },
          framework: { type: 'string', enum: ['CIS', 'NIST', 'ISO27001', 'SOC2'] },
          service: { type: 'string' }
        },
        required: ['policy', 'framework']
      }
    }, this.handleValidateCompliance.bind(this));

    this.registerTool('map_controls', {
      description: 'Map policy to compliance controls',
      inputSchema: {
        type: 'object',
        properties: {
          policy: { type: 'object' },
          framework: { type: 'string' },
          service: { type: 'string' }
        },
        required: ['policy', 'framework']
      }
    }, this.handleMapControls.bind(this));

    this.registerTool('get_framework_version', {
      description: 'Get latest version of a compliance framework',
      inputSchema: {
        type: 'object',
        properties: {
          framework: { type: 'string', enum: ['CIS', 'NIST', 'ISO27001', 'SOC2'] }
        },
        required: ['framework']
      }
    }, this.handleGetFrameworkVersion.bind(this));
  }

  async loadFrameworks() {
    // Load framework definitions
    // In production, this would fetch from external APIs or databases
    
    this.frameworks.set('CIS', {
      name: 'CIS',
      version: '1.5.0',
      description: 'Center for Internet Security Benchmarks',
      controls: this.getCISControls()
    });

    this.frameworks.set('NIST', {
      name: 'NIST',
      version: '2.0',
      description: 'NIST Cybersecurity Framework',
      controls: this.getNISTControls()
    });

    this.frameworks.set('ISO27001', {
      name: 'ISO 27001',
      version: '2022',
      description: 'ISO/IEC 27001 Information Security Management',
      controls: this.getISO27001Controls()
    });

    this.frameworks.set('SOC2', {
      name: 'SOC 2',
      version: '2017',
      description: 'Service Organization Control 2',
      controls: this.getSOC2Controls()
    });
  }

  getCISControls() {
    return [
      {
        id: 'CIS-1.1',
        name: 'Maintain Inventory of Authorized and Unauthorized Devices',
        description: 'Maintain an up-to-date inventory of all devices',
        services: ['all'],
        requirement: 'Device inventory management'
      },
      {
        id: 'CIS-2.1',
        name: 'Maintain Inventory of Authorized and Unauthorized Software',
        description: 'Maintain inventory of authorized software',
        services: ['all'],
        requirement: 'Software inventory management'
      },
      {
        id: 'CIS-3.1',
        name: 'Secure Configurations for Hardware and Software',
        description: 'Establish and maintain secure configurations',
        services: ['S3', 'EC2', 'Lambda', 'Storage', 'Functions'],
        requirement: 'Secure configuration management'
      }
    ];
  }

  getNISTControls() {
    return [
      {
        id: 'NIST-PR.AC-1',
        name: 'Identity and Access Management',
        description: 'Manage identities and credentials',
        services: ['IAM', 'all'],
        requirement: 'Identity management'
      },
      {
        id: 'NIST-PR.DS-1',
        name: 'Data-at-Rest Protection',
        description: 'Protect data at rest',
        services: ['S3', 'Storage', 'Database'],
        requirement: 'Data encryption at rest'
      }
    ];
  }

  getISO27001Controls() {
    return [
      {
        id: 'ISO-A.9.2.1',
        name: 'User Registration and De-registration',
        description: 'User access management',
        services: ['IAM', 'all'],
        requirement: 'User access control'
      },
      {
        id: 'ISO-A.10.1.1',
        name: 'Cryptographic Controls',
        description: 'Use of cryptographic controls',
        services: ['all'],
        requirement: 'Encryption controls'
      }
    ];
  }

  getSOC2Controls() {
    return [
      {
        id: 'SOC2-CC6.1',
        name: 'Logical and Physical Access Controls',
        description: 'Access control requirements',
        services: ['all'],
        requirement: 'Access control'
      },
      {
        id: 'SOC2-CC7.1',
        name: 'System Operations',
        description: 'System operation controls',
        services: ['all'],
        requirement: 'System operations'
      }
    ];
  }

  async handleGetControls(args) {
    try {
      const { framework, service, version, controlId } = args;
      
      const frameworkData = this.frameworks.get(framework);
      if (!frameworkData) {
        throw new Error(`Framework not found: ${framework}`);
      }

      let controls = frameworkData.controls;

      // Filter by service if provided
      if (service) {
        controls = controls.filter(control => 
          control.services.includes('all') || 
          control.services.some(s => service.toLowerCase().includes(s.toLowerCase()))
        );
      }

      // Filter by control ID if provided
      if (controlId) {
        controls = controls.filter(control => control.id === controlId);
      }

      return {
        framework,
        version: frameworkData.version,
        service: service || 'all',
        controls,
        count: controls.length
      };
      
    } catch (error) {
      logger.error(`Error getting controls: ${error.message}`);
      throw error;
    }
  }

  async handleQueryRequirements(args) {
    try {
      const { query, framework } = args;
      
      // Parse natural language query
      const queryLower = query.toLowerCase();
      
      // Extract keywords
      const keywords = query.split(/\s+/).filter(word => word.length > 3);
      
      // Search across frameworks
      const frameworksToSearch = framework ? [framework] : Array.from(this.frameworks.keys());
      const results = [];

      for (const fwName of frameworksToSearch) {
        const fwData = this.frameworks.get(fwName);
        
        for (const control of fwData.controls) {
          // Simple keyword matching
          const controlText = `${control.name} ${control.description} ${control.requirement}`.toLowerCase();
          const matches = keywords.filter(keyword => controlText.includes(keyword.toLowerCase()));
          
          if (matches.length > 0) {
            results.push({
              framework: fwName,
              control,
              relevance: matches.length / keywords.length
            });
          }
        }
      }

      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance);

      return {
        query,
        results: results.slice(0, 10), // Top 10 results
        count: results.length
      };
      
    } catch (error) {
      logger.error(`Error querying requirements: ${error.message}`);
      throw error;
    }
  }

  async handleValidateCompliance(args) {
    try {
      const { policy, framework, service } = args;
      
      const frameworkData = this.frameworks.get(framework);
      if (!frameworkData) {
        throw new Error(`Framework not found: ${framework}`);
      }

      const relevantControls = frameworkData.controls.filter(control =>
        !service || control.services.includes('all') || 
        control.services.some(s => service.toLowerCase().includes(s.toLowerCase()))
      );

      const policyText = JSON.stringify(policy).toLowerCase();
      const validation = {
        framework,
        service: service || 'all',
        passed: true,
        score: 0,
        controls: [],
        issues: []
      };

      let passedControls = 0;

      for (const control of relevantControls) {
        const controlKeywords = [
          ...control.name.toLowerCase().split(/\s+/),
          ...control.requirement.toLowerCase().split(/\s+/)
        ].filter(word => word.length > 3);

        const matches = controlKeywords.filter(keyword => policyText.includes(keyword));
        const matchRatio = matches.length / controlKeywords.length;

        const controlValidation = {
          controlId: control.id,
          controlName: control.name,
          status: matchRatio >= 0.7 ? 'passed' : matchRatio >= 0.4 ? 'warning' : 'failed',
          matchRatio,
          requirement: control.requirement
        };

        validation.controls.push(controlValidation);

        if (controlValidation.status === 'passed') {
          passedControls++;
        } else if (controlValidation.status === 'failed') {
          validation.passed = false;
          validation.issues.push(`Missing coverage for ${control.id}: ${control.requirement}`);
        }
      }

      validation.score = relevantControls.length > 0 ? 
        (passedControls / relevantControls.length) * 100 : 100;

      return validation;
      
    } catch (error) {
      logger.error(`Error validating compliance: ${error.message}`);
      throw error;
    }
  }

  async handleMapControls(args) {
    try {
      const { policy, framework, service } = args;
      
      const frameworkData = this.frameworks.get(framework);
      if (!frameworkData) {
        throw new Error(`Framework not found: ${framework}`);
      }

      const relevantControls = frameworkData.controls.filter(control =>
        !service || control.services.includes('all') || 
        control.services.some(s => service.toLowerCase().includes(s.toLowerCase()))
      );

      const policyText = JSON.stringify(policy).toLowerCase();
      const mapping = {
        framework,
        service: service || 'all',
        mappedControls: [],
        coverage: {
          total: relevantControls.length,
          mapped: 0,
          percentage: 0
        }
      };

      for (const control of relevantControls) {
        const controlKeywords = [
          ...control.name.toLowerCase().split(/\s+/),
          ...control.requirement.toLowerCase().split(/\s+/)
        ].filter(word => word.length > 3);

        const matches = controlKeywords.filter(keyword => policyText.includes(keyword));
        const isMapped = matches.length / controlKeywords.length >= 0.7;

        mapping.mappedControls.push({
          controlId: control.id,
          controlName: control.name,
          mapped: isMapped,
          evidence: isMapped ? `Policy contains keywords: ${matches.join(', ')}` : null
        });

        if (isMapped) {
          mapping.coverage.mapped++;
        }
      }

      mapping.coverage.percentage = mapping.coverage.total > 0 ? 
        (mapping.coverage.mapped / mapping.coverage.total) * 100 : 100;

      return mapping;
      
    } catch (error) {
      logger.error(`Error mapping controls: ${error.message}`);
      throw error;
    }
  }

  async handleGetFrameworkVersion(args) {
    try {
      const { framework } = args;
      
      const frameworkData = this.frameworks.get(framework);
      if (!frameworkData) {
        throw new Error(`Framework not found: ${framework}`);
      }

      // In production, this would check external APIs for latest version
      return {
        framework,
        currentVersion: frameworkData.version,
        latestVersion: frameworkData.version, // Would fetch from API
        updateAvailable: false
      };
      
    } catch (error) {
      logger.error(`Error getting framework version: ${error.message}`);
      throw error;
    }
  }
}

