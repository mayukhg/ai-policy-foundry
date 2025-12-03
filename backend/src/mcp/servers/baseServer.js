/**
 * Base MCP Server Implementation
 * 
 * This is the base class for all MCP servers. It provides common functionality
 * for tool registration, error handling, and request/response management.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export class BaseMCPServer extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = config;
    this.tools = new Map();
    this.isInitialized = false;
    this.type = 'base';
    this.capabilities = [];
  }

  /**
   * Initialize the MCP server
   * Subclasses should override this method
   */
  async initialize() {
    try {
      logger.info(`Initializing MCP server: ${this.name}`);
      
      // Register tools
      await this.registerTools();
      
      this.isInitialized = true;
      logger.info(`MCP server ${this.name} initialized successfully`);
      
    } catch (error) {
      logger.error(`Failed to initialize MCP server ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Register tools for this server
   * Subclasses should override this method
   */
  async registerTools() {
    // Base implementation - subclasses should override
  }

  /**
   * Call a tool by name
   * @param {string} toolName - Name of the tool
   * @param {Object} arguments - Tool arguments
   * @returns {Promise<Object>} Tool result
   */
  async callTool(toolName, arguments = {}) {
    if (!this.isInitialized) {
      throw new Error(`MCP server ${this.name} not initialized`);
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName} on server ${this.name}`);
    }

    try {
      logger.debug(`Calling tool ${toolName} on server ${this.name}`, { arguments });
      
      const result = await tool.handler(arguments);
      
      this.emit('toolCalled', { toolName, arguments, result });
      
      return {
        success: true,
        result,
        tool: toolName,
        server: this.name
      };
      
    } catch (error) {
      logger.error(`Error calling tool ${toolName} on server ${this.name}:`, error);
      
      this.emit('toolError', { toolName, arguments, error });
      
      return {
        success: false,
        error: error.message,
        tool: toolName,
        server: this.name
      };
    }
  }

  /**
   * Register a tool
   * @param {string} name - Tool name
   * @param {Object} definition - Tool definition
   * @param {Function} handler - Tool handler function
   */
  registerTool(name, definition, handler) {
    this.tools.set(name, {
      name,
      definition,
      handler
    });
    
    logger.debug(`Registered tool ${name} on server ${this.name}`);
  }

  /**
   * List all available tools
   * @returns {Array} List of tool definitions
   */
  async listTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      ...tool.definition
    }));
  }

  /**
   * Shutdown the server
   * Subclasses should override this method for cleanup
   */
  async shutdown() {
    logger.info(`Shutting down MCP server: ${this.name}`);
    this.isInitialized = false;
    this.tools.clear();
  }
}

