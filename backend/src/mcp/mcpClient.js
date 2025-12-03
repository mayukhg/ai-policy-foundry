/**
 * Model Context Protocol (MCP) Client
 * 
 * This client provides a unified interface for interacting with MCP servers.
 * It handles tool calling, resource access, and prompt management across
 * different MCP server implementations.
 * 
 * Key Features:
 * - Unified tool calling interface
 * - Server discovery and management
 * - Request/response handling
 * - Error handling and retries
 * - Connection pooling
 */

import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

export class MCPClient extends EventEmitter {
  constructor() {
    super();
    this.servers = new Map();
    this.isInitialized = false;
    this.requestId = 0;
  }

  /**
   * Initialize the MCP client and register all available servers
   */
  async initialize() {
    try {
      logger.info('Initializing MCP Client...');

      // Register all MCP servers
      await this.registerServers();

      this.isInitialized = true;
      logger.info('MCP Client initialized successfully');
      
      this.emit('initialized');
      
    } catch (error) {
      logger.error('Failed to initialize MCP Client:', error);
      throw error;
    }
  }

  /**
   * Register all available MCP servers
   */
  async registerServers() {
    const { DocumentMCP } = await import('./servers/documentServer.js');
    const { CloudMCP } = await import('./servers/cloudServer.js');
    const { ComplianceMCP } = await import('./servers/complianceServer.js');
    const { ThreatMCP } = await import('./servers/threatServer.js');
    const { GitMCP } = await import('./servers/gitServer.js');
    const { IntegrationMCP } = await import('./servers/integrationServer.js');

    // Register document servers
    if (process.env.GOOGLE_DRIVE_ENABLED === 'true') {
      const gdriveServer = new DocumentMCP('gdrive', {
        type: 'gdrive',
        credentials: process.env.GOOGLE_DRIVE_CREDENTIALS
      });
      await gdriveServer.initialize();
      this.servers.set('gdrive', gdriveServer);
    }

    if (process.env.SHAREPOINT_ENABLED === 'true') {
      const sharepointServer = new DocumentMCP('sharepoint', {
        type: 'sharepoint',
        credentials: process.env.SHAREPOINT_CREDENTIALS
      });
      await sharepointServer.initialize();
      this.servers.set('sharepoint', sharepointServer);
    }

    // Register file system server (always available)
    const fsServer = new DocumentMCP('filesystem', {
      type: 'filesystem',
      basePath: process.env.FILESYSTEM_BASE_PATH || './documents'
    });
    await fsServer.initialize();
    this.servers.set('filesystem', fsServer);

    // Register cloud provider servers
    if (process.env.AWS_ENABLED === 'true') {
      const awsServer = new CloudMCP('aws', {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1'
        }
      });
      await awsServer.initialize();
      this.servers.set('aws', awsServer);
    }

    if (process.env.AZURE_ENABLED === 'true') {
      const azureServer = new CloudMCP('azure', {
        credentials: {
          clientId: process.env.AZURE_CLIENT_ID,
          clientSecret: process.env.AZURE_CLIENT_SECRET,
          tenantId: process.env.AZURE_TENANT_ID,
          subscriptionId: process.env.AZURE_SUBSCRIPTION_ID
        }
      });
      await azureServer.initialize();
      this.servers.set('azure', azureServer);
    }

    if (process.env.GCP_ENABLED === 'true') {
      const gcpServer = new CloudMCP('gcp', {
        credentials: {
          projectId: process.env.GCP_PROJECT_ID,
          keyFilename: process.env.GCP_KEY_FILENAME
        }
      });
      await gcpServer.initialize();
      this.servers.set('gcp', gcpServer);
    }

    // Register compliance server
    const complianceServer = new ComplianceMCP('compliance', {});
    await complianceServer.initialize();
    this.servers.set('compliance', complianceServer);

    // Register threat intelligence server
    const threatServer = new ThreatMCP('threat', {});
    await threatServer.initialize();
    this.servers.set('threat', threatServer);

    // Register Git server
    if (process.env.GIT_ENABLED === 'true') {
      const gitServer = new GitMCP('git', {
        repositoryPath: process.env.GIT_REPOSITORY_PATH || './policies'
      });
      await gitServer.initialize();
      this.servers.set('git', gitServer);
    }

    // Register integration server
    const integrationServer = new IntegrationMCP('integration', {
      siem: {
        enabled: process.env.SIEM_ENABLED === 'true',
        type: process.env.SIEM_TYPE || 'splunk',
        config: {
          url: process.env.SIEM_URL,
          apiKey: process.env.SIEM_API_KEY
        }
      },
      ticketing: {
        enabled: process.env.TICKETING_ENABLED === 'true',
        type: process.env.TICKETING_TYPE || 'jira',
        config: {
          url: process.env.TICKETING_URL,
          apiKey: process.env.TICKETING_API_KEY
        }
      },
      communication: {
        enabled: process.env.COMMUNICATION_ENABLED === 'true',
        type: process.env.COMMUNICATION_TYPE || 'slack',
        config: {
          webhookUrl: process.env.COMMUNICATION_WEBHOOK_URL
        }
      }
    });
    await integrationServer.initialize();
    this.servers.set('integration', integrationServer);

    logger.info(`Registered ${this.servers.size} MCP servers`);
  }

  /**
   * Call a tool on a specific MCP server
   * @param {string} serverName - Name of the MCP server
   * @param {string} toolName - Name of the tool to call
   * @param {Object} arguments - Tool arguments
   * @returns {Promise<Object>} Tool result
   */
  async callTool(serverName, toolName, arguments = {}) {
    if (!this.isInitialized) {
      throw new Error('MCP Client not initialized');
    }

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    try {
      logger.debug(`Calling tool ${toolName} on server ${serverName}`, { arguments });
      
      const result = await server.callTool(toolName, arguments);
      
      this.emit('toolCalled', { serverName, toolName, arguments, result });
      
      return result;
      
    } catch (error) {
      logger.error(`Failed to call tool ${toolName} on server ${serverName}:`, error);
      this.emit('toolError', { serverName, toolName, arguments, error });
      throw error;
    }
  }

  /**
   * List all available tools across all servers
   * @returns {Object} Map of server names to their available tools
   */
  async listTools() {
    if (!this.isInitialized) {
      throw new Error('MCP Client not initialized');
    }

    const tools = {};
    
    for (const [serverName, server] of this.servers) {
      try {
        tools[serverName] = await server.listTools();
      } catch (error) {
        logger.error(`Failed to list tools for server ${serverName}:`, error);
        tools[serverName] = [];
      }
    }

    return tools;
  }

  /**
   * Get available tools for a specific server
   * @param {string} serverName - Name of the MCP server
   * @returns {Promise<Array>} List of available tools
   */
  async getServerTools(serverName) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    return await server.listTools();
  }

  /**
   * Get server information
   * @param {string} serverName - Name of the MCP server
   * @returns {Object} Server information
   */
  getServerInfo(serverName) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }

    return {
      name: serverName,
      type: server.type,
      initialized: server.isInitialized,
      capabilities: server.capabilities || []
    };
  }

  /**
   * List all registered servers
   * @returns {Array} List of server names
   */
  listServers() {
    return Array.from(this.servers.keys());
  }

  /**
   * Shutdown all MCP servers
   */
  async shutdown() {
    logger.info('Shutting down MCP Client...');

    for (const [serverName, server] of this.servers) {
      try {
        if (server.shutdown) {
          await server.shutdown();
        }
      } catch (error) {
        logger.error(`Error shutting down server ${serverName}:`, error);
      }
    }

    this.servers.clear();
    this.isInitialized = false;
    logger.info('MCP Client shut down successfully');
  }
}

// Export singleton instance
export const mcpClient = new MCPClient();

