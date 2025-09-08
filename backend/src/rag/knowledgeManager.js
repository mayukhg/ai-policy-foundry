/**
 * Knowledge Manager for RAG (Retrieval Augmented Generation)
 * 
 * This module handles knowledge ingestion, processing, and retrieval
 * for different types of security-related content including:
 * - Policy documents
 * - Threat intelligence
 * - Compliance frameworks
 * - Best practices
 * - Incident reports
 * 
 * Key Features:
 * - Multi-format document processing (PDF, DOCX, HTML, TXT)
 * - Automatic content chunking and preprocessing
 * - Metadata extraction and enrichment
 * - Real-time knowledge updates
 * - Context-aware retrieval
 */

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { vectorStoreManager } from './vectorStore.js';
import { logger } from '../utils/logger.js';

export class KnowledgeManager {
  constructor() {
    this.processors = new Map();
    this.isInitialized = false;
    
    // Initialize document processors for different file types
    this.initializeProcessors();
  }

  /**
   * Initialize the knowledge manager and set up document processors
   */
  async initialize() {
    try {
      logger.info('Initializing Knowledge Manager...');

      // Initialize vector store manager
      await vectorStoreManager.initialize();

      this.isInitialized = true;
      logger.info('Knowledge Manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Knowledge Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize document processors for different file types
   */
  initializeProcessors() {
    // PDF processor
    this.processors.set('pdf', async (buffer) => {
      const data = await pdfParse(buffer);
      return {
        content: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info
        }
      };
    });

    // DOCX processor
    this.processors.set('docx', async (buffer) => {
      const result = await mammoth.extractRawText({ buffer });
      return {
        content: result.value,
        metadata: {
          messages: result.messages
        }
      };
    });

    // HTML processor
    this.processors.set('html', async (buffer) => {
      const html = buffer.toString('utf-8');
      const $ = cheerio.load(html);
      
      // Remove script and style elements
      $('script, style').remove();
      
      return {
        content: $.text(),
        metadata: {
          title: $('title').text(),
          headings: $('h1, h2, h3, h4, h5, h6').map((i, el) => $(el).text()).get()
        }
      };
    });

    // Text processor
    this.processors.set('txt', async (buffer) => {
      return {
        content: buffer.toString('utf-8'),
        metadata: {}
      };
    });
  }

  /**
   * Process and ingest a document into the knowledge base
   * @param {string} domain - The knowledge domain (policies, threats, etc.)
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} filename - The original filename
   * @param {Object} metadata - Additional metadata
   */
  async ingestDocument(domain, fileBuffer, filename, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Knowledge Manager not initialized');
    }

    try {
      logger.info(`Ingesting document: ${filename} into ${domain} domain`);

      // Determine file type
      const fileExtension = path.extname(filename).toLowerCase().slice(1);
      const processor = this.processors.get(fileExtension);

      if (!processor) {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Process the document
      const processedDoc = await processor(fileBuffer);

      // Chunk the content for better retrieval
      const chunks = this.chunkContent(processedDoc.content, {
        maxChunkSize: 1000,
        overlap: 200
      });

      // Enrich metadata
      const enrichedMetadata = {
        ...metadata,
        filename,
        fileType: fileExtension,
        processedAt: new Date().toISOString(),
        chunkCount: chunks.length,
        ...processedDoc.metadata
      };

      // Create documents for each chunk
      const documents = chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          ...enrichedMetadata,
          chunkIndex: index,
          chunkId: `${filename}_chunk_${index}`
        }
      }));

      // Add to vector store
      await vectorStoreManager.addDocuments(domain, documents, enrichedMetadata);

      logger.info(`Successfully ingested ${filename} with ${chunks.length} chunks`);
      
      return {
        filename,
        chunks: chunks.length,
        domain,
        metadata: enrichedMetadata
      };

    } catch (error) {
      logger.error(`Failed to ingest document ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Ingest text content directly into the knowledge base
   * @param {string} domain - The knowledge domain
   * @param {string} content - The text content
   * @param {Object} metadata - Additional metadata
   */
  async ingestText(domain, content, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Knowledge Manager not initialized');
    }

    try {
      logger.info(`Ingesting text content into ${domain} domain`);

      // Chunk the content
      const chunks = this.chunkContent(content, {
        maxChunkSize: 1000,
        overlap: 200
      });

      // Enrich metadata
      const enrichedMetadata = {
        ...metadata,
        processedAt: new Date().toISOString(),
        chunkCount: chunks.length,
        source: 'text_ingestion'
      };

      // Create documents for each chunk
      const documents = chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          ...enrichedMetadata,
          chunkIndex: index,
          chunkId: `text_${Date.now()}_chunk_${index}`
        }
      }));

      // Add to vector store
      await vectorStoreManager.addDocuments(domain, documents, enrichedMetadata);

      logger.info(`Successfully ingested text content with ${chunks.length} chunks`);
      
      return {
        chunks: chunks.length,
        domain,
        metadata: enrichedMetadata
      };

    } catch (error) {
      logger.error('Failed to ingest text content:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant knowledge for a given query
   * @param {string} domain - The knowledge domain to search
   * @param {string} query - The search query
   * @param {number} k - Number of results to return
   * @param {Object} filter - Optional metadata filter
   * @returns {Array} Array of relevant knowledge chunks
   */
  async retrieveKnowledge(domain, query, k = 5, filter = {}) {
    if (!this.isInitialized) {
      throw new Error('Knowledge Manager not initialized');
    }

    try {
      logger.debug(`Retrieving knowledge from ${domain} domain for: ${query}`);

      const results = await vectorStoreManager.similaritySearch(domain, query, k, filter);

      // Format results for easier consumption
      const formattedResults = results.map(result => ({
        content: result.content,
        score: result.score,
        metadata: result.metadata,
        domain
      }));

      logger.debug(`Retrieved ${formattedResults.length} knowledge chunks from ${domain}`);
      return formattedResults;

    } catch (error) {
      logger.error(`Failed to retrieve knowledge from ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve knowledge from multiple domains
   * @param {Array} domains - Array of domains to search
   * @param {string} query - The search query
   * @param {number} k - Number of results per domain
   * @returns {Array} Merged and ranked results from all domains
   */
  async retrieveMultiDomainKnowledge(domains, query, k = 5) {
    if (!this.isInitialized) {
      throw new Error('Knowledge Manager not initialized');
    }

    try {
      logger.info(`Retrieving knowledge from multiple domains: ${domains.join(', ')}`);

      const results = await vectorStoreManager.multiDomainSearch(domains, query, k);

      // Format results
      const formattedResults = results.map(result => ({
        content: result.content,
        score: result.score,
        metadata: result.metadata,
        domain: result.domain
      }));

      logger.info(`Retrieved ${formattedResults.length} knowledge chunks from ${domains.length} domains`);
      return formattedResults;

    } catch (error) {
      logger.error('Failed to retrieve multi-domain knowledge:', error);
      throw error;
    }
  }

  /**
   * Get context-aware knowledge for policy generation
   * @param {string} service - The cloud service
   * @param {Object} requirements - Policy requirements
   * @returns {Object} Contextual knowledge for policy generation
   */
  async getPolicyContext(service, requirements) {
    try {
      logger.info(`Getting policy context for ${service}`);

      const query = `${service} security policy ${requirements.environment || 'production'} ${requirements.compliance || 'CIS'}`;
      
      // Search across relevant domains
      const domains = ['policies', 'best-practices', 'compliance'];
      const knowledge = await this.retrieveMultiDomainKnowledge(domains, query, 3);

      // Get threat context if available
      const threatQuery = `${service} threats vulnerabilities security risks`;
      const threatKnowledge = await this.retrieveKnowledge('threats', threatQuery, 2);

      // Organize context by type
      const context = {
        similarPolicies: knowledge.filter(k => k.domain === 'policies'),
        bestPractices: knowledge.filter(k => k.domain === 'best-practices'),
        complianceRequirements: knowledge.filter(k => k.domain === 'compliance'),
        threatContext: threatKnowledge,
        service: service,
        requirements: requirements,
        retrievedAt: new Date().toISOString()
      };

      logger.info(`Retrieved policy context with ${knowledge.length + threatKnowledge.length} knowledge chunks`);
      return context;

    } catch (error) {
      logger.error(`Failed to get policy context for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Get threat intelligence context
   * @param {string} threatId - The threat identifier
   * @param {Object} threatData - The threat data
   * @returns {Object} Contextual threat intelligence
   */
  async getThreatContext(threatId, threatData) {
    try {
      logger.info(`Getting threat context for ${threatId}`);

      const query = `${threatData.title} ${threatData.description} ${threatData.affectedServices?.join(' ') || ''}`;
      
      // Search for similar threats and mitigation strategies
      const similarThreats = await this.retrieveKnowledge('threats', query, 5);
      const mitigationStrategies = await this.retrieveKnowledge('best-practices', `mitigation ${query}`, 3);
      const policyImpact = await this.retrieveKnowledge('policies', query, 3);

      const context = {
        similarThreats,
        mitigationStrategies,
        policyImpact,
        threatId,
        threatData,
        retrievedAt: new Date().toISOString()
      };

      logger.info(`Retrieved threat context with ${similarThreats.length + mitigationStrategies.length + policyImpact.length} knowledge chunks`);
      return context;

    } catch (error) {
      logger.error(`Failed to get threat context for ${threatId}:`, error);
      throw error;
    }
  }

  /**
   * Chunk content into smaller pieces for better retrieval
   * @param {string} content - The content to chunk
   * @param {Object} options - Chunking options
   * @returns {Array} Array of content chunks
   */
  chunkContent(content, options = {}) {
    const {
      maxChunkSize = 1000,
      overlap = 200,
      preserveSentences = true
    } = options;

    if (content.length <= maxChunkSize) {
      return [content];
    }

    const chunks = [];
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + maxChunkSize, content.length);

      if (preserveSentences && end < content.length) {
        // Try to break at sentence boundary
        const lastSentenceEnd = content.lastIndexOf('.', end);
        const lastNewline = content.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastSentenceEnd, lastNewline);

        if (breakPoint > start + maxChunkSize * 0.5) {
          end = breakPoint + 1;
        }
      }

      const chunk = content.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = end - overlap;
    }

    return chunks;
  }

  /**
   * Update knowledge base with new information
   * @param {string} domain - The knowledge domain
   * @param {string} query - Query to find documents to update
   * @param {string} newContent - New content
   * @param {Object} newMetadata - New metadata
   */
  async updateKnowledge(domain, query, newContent, newMetadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Knowledge Manager not initialized');
    }

    try {
      logger.info(`Updating knowledge in ${domain} domain`);

      // Find existing documents to update
      const existingDocs = await this.retrieveKnowledge(domain, query, 10);
      
      if (existingDocs.length === 0) {
        // No existing documents found, create new ones
        await this.ingestText(domain, newContent, newMetadata);
      } else {
        // Update existing documents
        for (const doc of existingDocs) {
          if (doc.metadata.chunkId) {
            await vectorStoreManager.updateDocument(
              domain,
              doc.metadata.chunkId,
              newContent,
              { ...doc.metadata, ...newMetadata, updatedAt: new Date().toISOString() }
            );
          }
        }
      }

      logger.info(`Successfully updated knowledge in ${domain} domain`);

    } catch (error) {
      logger.error(`Failed to update knowledge in ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about the knowledge base
   * @returns {Object} Knowledge base statistics
   */
  async getKnowledgeStats() {
    if (!this.isInitialized) {
      throw new Error('Knowledge Manager not initialized');
    }

    try {
      const stats = await vectorStoreManager.getAllStats();
      
      const totalDocuments = Object.values(stats).reduce(
        (sum, domainStats) => sum + (domainStats.documentCount || 0), 0
      );

      return {
        totalDocuments,
        domains: stats,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get knowledge stats:', error);
      throw error;
    }
  }

  /**
   * Shutdown the knowledge manager
   */
  async shutdown() {
    logger.info('Shutting down Knowledge Manager...');
    
    try {
      await vectorStoreManager.shutdown();
      this.isInitialized = false;
      logger.info('Knowledge Manager shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown Knowledge Manager:', error);
      throw error;
    }
  }
}

// Singleton instance
export const knowledgeManager = new KnowledgeManager();

