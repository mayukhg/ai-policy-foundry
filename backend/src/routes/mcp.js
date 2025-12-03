/**
 * MCP Routes
 * 
 * Provides API endpoints for MCP functionality:
 * - List available MCP servers and tools
 * - Call MCP tools
 * - Get server information
 */

import express from 'express';
import { mcpClient } from '../mcp/mcpClient.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/mcp/servers - List all MCP servers
router.get('/servers', async (req, res) => {
  try {
    const servers = mcpClient.listServers();
    const serverInfo = servers.map(name => mcpClient.getServerInfo(name));
    
    res.json({
      success: true,
      data: {
        servers: serverInfo,
        count: servers.length
      }
    });
    
  } catch (error) {
    logger.error('Failed to list MCP servers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list MCP servers',
      message: error.message
    });
  }
});

// GET /api/mcp/tools - List all available tools
router.get('/tools', async (req, res) => {
  try {
    const tools = await mcpClient.listTools();
    
    res.json({
      success: true,
      data: {
        tools,
        count: Object.values(tools).reduce((sum, serverTools) => sum + serverTools.length, 0)
      }
    });
    
  } catch (error) {
    logger.error('Failed to list MCP tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list MCP tools',
      message: error.message
    });
  }
});

// GET /api/mcp/servers/:serverName/tools - Get tools for a specific server
router.get('/servers/:serverName/tools', async (req, res) => {
  try {
    const { serverName } = req.params;
    const tools = await mcpClient.getServerTools(serverName);
    
    res.json({
      success: true,
      data: {
        server: serverName,
        tools,
        count: tools.length
      }
    });
    
  } catch (error) {
    logger.error(`Failed to get tools for server ${req.params.serverName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get server tools',
      message: error.message
    });
  }
});

// POST /api/mcp/servers/:serverName/tools/:toolName - Call an MCP tool
router.post('/servers/:serverName/tools/:toolName', async (req, res) => {
  try {
    const { serverName, toolName } = req.params;
    const arguments = req.body.arguments || req.body || {};
    
    logger.info(`Calling MCP tool ${toolName} on server ${serverName}`);
    
    const result = await mcpClient.callTool(serverName, toolName, arguments);
    
    res.json({
      success: result.success !== false,
      data: result
    });
    
  } catch (error) {
    logger.error(`Failed to call MCP tool ${req.params.toolName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to call MCP tool',
      message: error.message
    });
  }
});

// GET /api/mcp/servers/:serverName - Get server information
router.get('/servers/:serverName', async (req, res) => {
  try {
    const { serverName } = req.params;
    const info = mcpClient.getServerInfo(serverName);
    
    res.json({
      success: true,
      data: info
    });
    
  } catch (error) {
    logger.error(`Failed to get server info for ${req.params.serverName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get server information',
      message: error.message
    });
  }
});

export default router;

