/**
 * MCP Document Server
 * 
 * Provides access to documents from various sources:
 * - Google Drive
 * - SharePoint
 * - Local File System
 * 
 * Replaces manual document upload with direct, real-time access.
 */

import { BaseMCPServer } from './baseServer.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

export class DocumentMCP extends BaseMCPServer {
  constructor(name, config) {
    super(name, config);
    this.type = 'document';
    this.capabilities = ['read', 'search', 'list', 'watch'];
    this.documentCache = new Map();
    this.watchers = new Map();
  }

  async initialize() {
    await super.initialize();
    
    // Initialize based on document source type
    if (this.config.type === 'filesystem') {
      await this.initializeFileSystem();
    } else if (this.config.type === 'gdrive') {
      await this.initializeGoogleDrive();
    } else if (this.config.type === 'sharepoint') {
      await this.initializeSharePoint();
    }
  }

  async registerTools() {
    // File System / Google Drive / SharePoint common tools
    this.registerTool('read_file', {
      description: 'Read a document from the document source',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the document' },
          format: { type: 'string', enum: ['text', 'json', 'raw'], default: 'text' }
        },
        required: ['path']
      }
    }, this.handleReadFile.bind(this));

    this.registerTool('search_documents', {
      description: 'Search for documents by query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', default: 10 },
          fileTypes: { type: 'array', items: { type: 'string' } }
        },
        required: ['query']
      }
    }, this.handleSearchDocuments.bind(this));

    this.registerTool('list_documents', {
      description: 'List documents in a directory/folder',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          recursive: { type: 'boolean', default: false }
        }
      }
    }, this.handleListDocuments.bind(this));

    this.registerTool('watch_document', {
      description: 'Watch a document for changes and trigger updates',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to watch' },
          callback: { type: 'string', description: 'Callback URL or function name' }
        },
        required: ['path']
      }
    }, this.handleWatchDocument.bind(this));

    this.registerTool('get_document_metadata', {
      description: 'Get metadata for a document',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the document' }
        },
        required: ['path']
      }
    }, this.handleGetMetadata.bind(this));
  }

  async initializeFileSystem() {
    const basePath = this.config.basePath || './documents';
    
    // Ensure base directory exists
    try {
      await fs.mkdir(basePath, { recursive: true });
    } catch (error) {
      logger.warn(`Base path ${basePath} already exists or cannot be created`);
    }
    
    this.basePath = basePath;
    logger.info(`File system MCP server initialized with base path: ${basePath}`);
  }

  async initializeGoogleDrive() {
    // Initialize Google Drive API client
    // This would use googleapis library
    logger.info('Google Drive MCP server initialized');
    // TODO: Implement Google Drive API initialization
  }

  async initializeSharePoint() {
    // Initialize SharePoint API client
    logger.info('SharePoint MCP server initialized');
    // TODO: Implement SharePoint API initialization
  }

  async handleReadFile(args) {
    try {
      const { path: filePath, format = 'text' } = args;
      
      if (this.config.type === 'filesystem') {
        const fullPath = path.join(this.basePath, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        if (format === 'json') {
          return JSON.parse(content);
        }
        
        return {
          path: filePath,
          content,
          format,
          size: content.length,
          lastModified: (await fs.stat(fullPath)).mtime.toISOString()
        };
      } else if (this.config.type === 'gdrive') {
        // TODO: Implement Google Drive file reading
        return { error: 'Google Drive not yet implemented' };
      } else if (this.config.type === 'sharepoint') {
        // TODO: Implement SharePoint file reading
        return { error: 'SharePoint not yet implemented' };
      }
      
    } catch (error) {
      logger.error(`Error reading file: ${error.message}`);
      throw error;
    }
  }

  async handleSearchDocuments(args) {
    try {
      const { query, limit = 10, fileTypes = [] } = args;
      
      if (this.config.type === 'filesystem') {
        const results = await this.searchFileSystem(query, limit, fileTypes);
        return {
          query,
          results,
          count: results.length
        };
      } else if (this.config.type === 'gdrive') {
        // TODO: Implement Google Drive search
        return { error: 'Google Drive search not yet implemented' };
      } else if (this.config.type === 'sharepoint') {
        // TODO: Implement SharePoint search
        return { error: 'SharePoint search not yet implemented' };
      }
      
    } catch (error) {
      logger.error(`Error searching documents: ${error.message}`);
      throw error;
    }
  }

  async searchFileSystem(query, limit, fileTypes) {
    const results = [];
    const searchTerms = query.toLowerCase().split(/\s+/);
    const basePath = this.basePath;
    
    const searchDirectory = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await searchDirectory(fullPath);
          } else if (entry.isFile()) {
            // Check file type filter
            if (fileTypes.length > 0) {
              const ext = path.extname(entry.name).slice(1);
              if (!fileTypes.includes(ext)) continue;
            }
            
            // Check if filename or content matches query
            const filename = entry.name.toLowerCase();
            const matches = searchTerms.some(term => filename.includes(term));
            
            if (matches) {
              try {
                const stats = await fs.stat(fullPath);
                results.push({
                  path: path.relative(basePath, fullPath),
                  name: entry.name,
                  size: stats.size,
                  lastModified: stats.mtime.toISOString(),
                  type: path.extname(entry.name).slice(1)
                });
                
                if (results.length >= limit) break;
              } catch (error) {
                // Skip files that can't be accessed
                continue;
              }
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be accessed
      }
    };
    
    await searchDirectory(basePath);
    return results;
  }

  async handleListDocuments(args) {
    try {
      const { path: dirPath = '', recursive = false } = args;
      
      if (this.config.type === 'filesystem') {
        const fullPath = path.join(this.basePath, dirPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        
        const documents = [];
        
        for (const entry of entries) {
          const entryPath = path.join(fullPath, entry.name);
          const relativePath = path.relative(this.basePath, entryPath);
          
          if (entry.isFile()) {
            const stats = await fs.stat(entryPath);
            documents.push({
              path: relativePath,
              name: entry.name,
              type: 'file',
              size: stats.size,
              lastModified: stats.mtime.toISOString()
            });
          } else if (entry.isDirectory() && recursive) {
            // Recursively list directory contents
            const subDocs = await this.handleListDocuments({ path: relativePath, recursive: true });
            documents.push(...subDocs);
          } else if (entry.isDirectory()) {
            documents.push({
              path: relativePath,
              name: entry.name,
              type: 'directory'
            });
          }
        }
        
        return {
          path: dirPath,
          documents,
          count: documents.length
        };
      } else if (this.config.type === 'gdrive') {
        // TODO: Implement Google Drive listing
        return { error: 'Google Drive listing not yet implemented' };
      } else if (this.config.type === 'sharepoint') {
        // TODO: Implement SharePoint listing
        return { error: 'SharePoint listing not yet implemented' };
      }
      
    } catch (error) {
      logger.error(`Error listing documents: ${error.message}`);
      throw error;
    }
  }

  async handleWatchDocument(args) {
    try {
      const { path: filePath, callback } = args;
      
      // Set up file watcher
      if (this.config.type === 'filesystem') {
        const fullPath = path.join(this.basePath, filePath);
        
        // Use fs.watch for file system watching
        const watcher = fs.watch(fullPath, async (eventType) => {
          if (eventType === 'change') {
            logger.info(`Document ${filePath} changed, triggering callback`);
            
            // Emit event for policy update
            this.emit('documentChanged', {
              path: filePath,
              timestamp: new Date().toISOString()
            });
            
            // Call callback if provided
            if (callback) {
              // TODO: Implement callback mechanism
              logger.info(`Callback requested for ${filePath}: ${callback}`);
            }
          }
        });
        
        this.watchers.set(filePath, watcher);
        
        return {
          path: filePath,
          watching: true,
          callback
        };
      } else {
        return { error: 'Document watching not yet implemented for this source type' };
      }
      
    } catch (error) {
      logger.error(`Error watching document: ${error.message}`);
      throw error;
    }
  }

  async handleGetMetadata(args) {
    try {
      const { path: filePath } = args;
      
      if (this.config.type === 'filesystem') {
        const fullPath = path.join(this.basePath, filePath);
        const stats = await fs.stat(fullPath);
        
        return {
          path: filePath,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          lastModified: stats.mtime.toISOString(),
          lastAccessed: stats.atime.toISOString(),
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory()
        };
      } else {
        return { error: 'Metadata retrieval not yet implemented for this source type' };
      }
      
    } catch (error) {
      logger.error(`Error getting metadata: ${error.message}`);
      throw error;
    }
  }

  async shutdown() {
    // Stop all watchers
    for (const [path, watcher] of this.watchers) {
      if (watcher.close) {
        watcher.close();
      }
    }
    this.watchers.clear();
    
    await super.shutdown();
  }
}

