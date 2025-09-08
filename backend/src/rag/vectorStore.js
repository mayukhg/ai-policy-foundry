/**
 * Vector Store Manager for RAG (Retrieval Augmented Generation)
 * 
 * This module provides a unified interface for vector database operations
 * supporting multiple vector store backends (Pinecone, FAISS, etc.)
 * 
 * Key Features:
 * - Document embedding and storage
 * - Similarity search with filtering
 * - Knowledge base management
 * - Real-time updates and synchronization
 */

import { Pinecone } from 'pinecone-client';
import { FaissStore } from 'faiss-node';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';
import { logger } from '../utils/logger.js';

export class VectorStoreManager {
  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-ada-002'
    });
    
    this.stores = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize vector stores for different knowledge domains
   * Each domain has its own vector store for better organization and retrieval
   */
  async initialize() {
    try {
      logger.info('Initializing Vector Store Manager...');

      // Initialize Pinecone for production use
      if (process.env.PINECONE_API_KEY) {
        const pinecone = new Pinecone({
          apiKey: process.env.PINECONE_API_KEY,
          environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp'
        });

        // Create vector stores for different knowledge domains
        const domains = [
          'policies',
          'threats',
          'compliance',
          'best-practices',
          'incidents'
        ];

        for (const domain of domains) {
          const index = await pinecone.Index(domain);
          this.stores.set(domain, {
            type: 'pinecone',
            client: index,
            dimension: 1536 // OpenAI embedding dimension
          });
        }
      } else {
        // Fallback to FAISS for development
        logger.warn('Pinecone not configured, using FAISS for development');
        
        const domains = ['policies', 'threats', 'compliance', 'best-practices', 'incidents'];
        
        for (const domain of domains) {
          const faissStore = new FaissStore();
          await faissStore.initialize(1536); // Initialize with OpenAI embedding dimension
          
          this.stores.set(domain, {
            type: 'faiss',
            client: faissStore
          });
        }
      }

      this.isInitialized = true;
      logger.info('Vector Store Manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Vector Store Manager:', error);
      throw error;
    }
  }

  /**
   * Add documents to a specific knowledge domain
   * @param {string} domain - The knowledge domain (policies, threats, etc.)
   * @param {Array} documents - Array of documents to add
   * @param {Object} metadata - Optional metadata for the documents
   */
  async addDocuments(domain, documents, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector Store Manager not initialized');
    }

    const store = this.stores.get(domain);
    if (!store) {
      throw new Error(`Vector store not found for domain: ${domain}`);
    }

    try {
      logger.info(`Adding ${documents.length} documents to ${domain} domain`);

      // Convert documents to LangChain Document format
      const langchainDocs = documents.map(doc => {
        if (typeof doc === 'string') {
          return new Document({
            pageContent: doc,
            metadata: { ...metadata, domain, timestamp: new Date().toISOString() }
          });
        }
        return new Document({
          pageContent: doc.content || doc.text,
          metadata: { ...doc.metadata, ...metadata, domain, timestamp: new Date().toISOString() }
        });
      });

      // Generate embeddings
      const embeddings = await this.embeddings.embedDocuments(
        langchainDocs.map(doc => doc.pageContent)
      );

      // Store in vector database
      if (store.type === 'pinecone') {
        const vectors = langchainDocs.map((doc, index) => ({
          id: `${domain}_${Date.now()}_${index}`,
          values: embeddings[index],
          metadata: doc.metadata
        }));

        await store.client.upsert(vectors);
      } else if (store.type === 'faiss') {
        await store.client.add(embeddings, langchainDocs);
      }

      logger.info(`Successfully added documents to ${domain} domain`);
      
    } catch (error) {
      logger.error(`Failed to add documents to ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Search for similar documents in a specific domain
   * @param {string} domain - The knowledge domain to search
   * @param {string} query - The search query
   * @param {number} k - Number of results to return
   * @param {Object} filter - Optional metadata filter
   * @returns {Array} Array of similar documents with scores
   */
  async similaritySearch(domain, query, k = 5, filter = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector Store Manager not initialized');
    }

    const store = this.stores.get(domain);
    if (!store) {
      throw new Error(`Vector store not found for domain: ${domain}`);
    }

    try {
      logger.debug(`Searching ${domain} domain for: ${query}`);

      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(query);

      let results = [];

      if (store.type === 'pinecone') {
        const searchResponse = await store.client.query({
          vector: queryEmbedding,
          topK: k,
          includeMetadata: true,
          filter: filter
        });

        results = searchResponse.matches.map(match => ({
          content: match.metadata.content || match.metadata.text,
          score: match.score,
          metadata: match.metadata
        }));
      } else if (store.type === 'faiss') {
        const searchResults = await store.client.search(queryEmbedding, k);
        results = searchResults.map(result => ({
          content: result.document.pageContent,
          score: result.score,
          metadata: result.document.metadata
        }));
      }

      logger.debug(`Found ${results.length} similar documents in ${domain}`);
      return results;

    } catch (error) {
      logger.error(`Failed to search ${domain} domain:`, error);
      throw error;
    }
  }

  /**
   * Search across multiple domains and merge results
   * @param {Array} domains - Array of domains to search
   * @param {string} query - The search query
   * @param {number} k - Number of results per domain
   * @returns {Array} Merged and ranked results from all domains
   */
  async multiDomainSearch(domains, query, k = 5) {
    try {
      logger.info(`Performing multi-domain search across: ${domains.join(', ')}`);

      const searchPromises = domains.map(domain => 
        this.similaritySearch(domain, query, k)
      );

      const results = await Promise.all(searchPromises);
      
      // Merge and deduplicate results
      const mergedResults = [];
      const seenContent = new Set();

      results.forEach((domainResults, index) => {
        domainResults.forEach(result => {
          if (!seenContent.has(result.content)) {
            seenContent.add(result.content);
            mergedResults.push({
              ...result,
              domain: domains[index]
            });
          }
        });
      });

      // Sort by score (highest first)
      mergedResults.sort((a, b) => b.score - a.score);

      logger.info(`Multi-domain search returned ${mergedResults.length} results`);
      return mergedResults;

    } catch (error) {
      logger.error('Failed to perform multi-domain search:', error);
      throw error;
    }
  }

  /**
   * Update a specific document in the vector store
   * @param {string} domain - The knowledge domain
   * @param {string} documentId - The document ID to update
   * @param {string} content - New content
   * @param {Object} metadata - New metadata
   */
  async updateDocument(domain, documentId, content, metadata = {}) {
    if (!this.isInitialized) {
      throw new Error('Vector Store Manager not initialized');
    }

    try {
      logger.info(`Updating document ${documentId} in ${domain} domain`);

      // Generate new embedding
      const embedding = await this.embeddings.embedQuery(content);

      const store = this.stores.get(domain);
      if (store.type === 'pinecone') {
        await store.client.upsert([{
          id: documentId,
          values: embedding,
          metadata: { ...metadata, content, domain, updatedAt: new Date().toISOString() }
        }]);
      }

      logger.info(`Successfully updated document ${documentId}`);
      
    } catch (error) {
      logger.error(`Failed to update document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document from the vector store
   * @param {string} domain - The knowledge domain
   * @param {string} documentId - The document ID to delete
   */
  async deleteDocument(domain, documentId) {
    if (!this.isInitialized) {
      throw new Error('Vector Store Manager not initialized');
    }

    try {
      logger.info(`Deleting document ${documentId} from ${domain} domain`);

      const store = this.stores.get(domain);
      if (store.type === 'pinecone') {
        await store.client.deleteOne(documentId);
      }

      logger.info(`Successfully deleted document ${documentId}`);
      
    } catch (error) {
      logger.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about a specific domain
   * @param {string} domain - The knowledge domain
   * @returns {Object} Statistics about the domain
   */
  async getDomainStats(domain) {
    if (!this.isInitialized) {
      throw new Error('Vector Store Manager not initialized');
    }

    try {
      const store = this.stores.get(domain);
      if (!store) {
        throw new Error(`Vector store not found for domain: ${domain}`);
      }

      let stats = { domain, documentCount: 0 };

      if (store.type === 'pinecone') {
        const indexStats = await store.client.describeIndexStats();
        stats.documentCount = indexStats.totalVectorCount || 0;
      }

      return stats;

    } catch (error) {
      logger.error(`Failed to get stats for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics for all domains
   * @returns {Object} Statistics for all domains
   */
  async getAllStats() {
    const stats = {};
    
    for (const domain of this.stores.keys()) {
      try {
        stats[domain] = await this.getDomainStats(domain);
      } catch (error) {
        logger.error(`Failed to get stats for ${domain}:`, error);
        stats[domain] = { domain, error: error.message };
      }
    }

    return stats;
  }

  /**
   * Shutdown the vector store manager
   */
  async shutdown() {
    logger.info('Shutting down Vector Store Manager...');
    
    for (const [domain, store] of this.stores) {
      try {
        if (store.type === 'faiss') {
          await store.client.close();
        }
        logger.info(`Closed ${domain} vector store`);
      } catch (error) {
        logger.error(`Failed to close ${domain} vector store:`, error);
      }
    }

    this.isInitialized = false;
    logger.info('Vector Store Manager shut down successfully');
  }
}

// Singleton instance
export const vectorStoreManager = new VectorStoreManager();

