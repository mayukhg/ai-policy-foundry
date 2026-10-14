import { logger } from '../utils/logger.js';
import documentParser from './DocumentParser.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStore } from '../data/syntheticStore.js';
import {
  extractChangePackage,
  summarizeChangePackage
} from './StructuralDeltaExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentIngestionService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.tempStorage = new Map(); // In-memory storage for document contexts
    this.initializeUploadDir();
  }

  /**
   * Initialize upload directory
   */
  async initializeUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info('Upload directory initialized');
    } catch (error) {
      logger.error('Failed to initialize upload directory:', error);
    }
  }

  /**
   * Ingest a document and extract context
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} fileName - Original filename
   * @param {string} userId - User ID who uploaded the document
   * @returns {Promise<Object>} Ingested document with context
   */
  async ingestDocument(fileBuffer, fileName, userId) {
    try {
      logger.info(`Ingesting document: ${fileName} for user: ${userId}`);

      // Parse the document
      const parsedData = await documentParser.parseDocument(fileBuffer, fileName);

      // Validate completeness
      const validation = documentParser.validateDocumentCompleteness(parsedData);

      // Generate document ID
      const documentId = uuidv4();

      // Store document context (in production, this would be in a database)
      const documentContext = {
        id: documentId,
        userId: userId,
        fileName: fileName,
        uploadedAt: new Date().toISOString(),
        metadata: parsedData.metadata,
        content: parsedData.content,
        validation: validation,
        status: validation.isValid ? 'ready' : 'needs-review'
      };

      // Store in temporary storage (in production, use database)
      this.tempStorage.set(documentId, documentContext);

      // Schedule cleanup after 24 hours (in production, implement proper cleanup)
      setTimeout(() => {
        this.tempStorage.delete(documentId);
      }, 24 * 60 * 60 * 1000);

      logger.info(`Document ingested successfully: ${documentId}`);

      return {
        success: true,
        documentId: documentId,
        context: documentContext,
        message: validation.isValid 
          ? 'Document ingested successfully' 
          : 'Document ingested with warnings. Please review the extracted content.'
      };

    } catch (error) {
      logger.error('Document ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Get document context by ID
   * @param {string} documentId - Document ID
   * @param {string} userId - User ID for authorization
   * @returns {Promise<Object>} Document context
   */
  async getDocumentContext(documentId, userId) {
    let context = this.tempStorage.get(documentId);

    if (!context) {
      const storeDoc = getStore().documents.get(documentId);
      if (storeDoc) {
        context = {
          id: storeDoc.id,
          userId: storeDoc.userId || 'demo-user',
          fileName: storeDoc.fileName,
          uploadedAt: storeDoc.uploadedAt,
          metadata: storeDoc.metadata,
          content: storeDoc.content,
          validation: storeDoc.validation,
          status: storeDoc.status,
          changePackage: storeDoc.changePackage || null,
          familyId: storeDoc.familyId
        };
        this.tempStorage.set(documentId, context);
      }
    }
    
    if (!context) {
      throw new Error('Document not found');
    }

    // Allow demo / anonymous access for synthetic and local flows
    const privileged = ['anonymous', 'demo-user', 'demo-user-id', context.userId];
    if (userId && !privileged.includes(userId) && context.userId !== userId) {
      throw new Error('Unauthorized access to document');
    }

    return context;
  }

  /**
   * Build context summary for policy generation (Phase 2 — ChangePackage only, no fullText stuffing).
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Context summary optimized for AI generation
   */
  async buildContextSummary(documentId) {
    const context = await this.getDocumentContext(documentId, 'anonymous');
    const store = getStore();
    const storeDoc = store.documents.get(documentId);

    let changePackage = context.changePackage || storeDoc?.changePackage || null;
    if (!changePackage && storeDoc) {
      const versions = store.documentVersions.get(storeDoc.familyId) || [];
      const previous = [...versions]
        .sort((a, b) => a.version - b.version)
        .filter((v) => v.id !== documentId)
        .pop();
      changePackage = extractChangePackage(storeDoc, previous || null);
      storeDoc.changePackage = changePackage;
      store.documents.set(documentId, storeDoc);
      context.changePackage = changePackage;
      this.tempStorage.set(documentId, context);
    }

    const structured = context.content.structured;
    const packageSummary = summarizeChangePackage(changePackage);

    // Targeted extraction context — never include raw fullText for LLM
    const summary = {
      documentId,
      fileName: context.fileName,
      extractedAt: context.uploadedAt,
      familyId: context.familyId || storeDoc?.familyId,
      changePackage,
      extraction: packageSummary,
      risks: (changePackage?.mode === 'delta'
        ? (changePackage.addedRisks || [])
        : (structured.risks || [])
      ).map((r) => ({
        id: r.id,
        description: r.description || r.text
      })),
      controls: (changePackage?.mode === 'delta'
        ? [
            ...(changePackage.addedControls || []),
            // include stable IDs only as inventory references (no prose dump)
          ]
        : (structured.controls || [])
      ).map((c) => ({
        id: c.id,
        description: c.description || c.text
      })),
      requirements: (changePackage?.mode === 'delta'
        ? (changePackage.addedRequirements || [])
        : (structured.requirements || [])
      ).map((r) => ({
        description: r.description || r.text
      })),
      stableInventory: changePackage?.stableInventory || {
        controlIds: (structured.controls || []).map((c) => c.id).filter(Boolean),
        riskIds: (structured.risks || []).map((r) => r.id).filter(Boolean)
      },
      keyTerms: structured.keyTerms || [],
      sections: (changePackage?.changedSections || []).map((s) => s.heading),
      metadata: {
        pageCount: context.metadata.pageCount,
        fileSize: context.metadata.fileSize,
        fileType: context.metadata.fileType
      }
    };

    return summary;
  }

  /**
   * Delete document context
   * @param {string} documentId - Document ID
   * @param {string} userId - User ID for authorization
   */
  async deleteDocument(documentId, userId) {
    const context = this.tempStorage.get(documentId);
    
    if (!context) {
      throw new Error('Document not found');
    }

    if (context.userId !== userId) {
      throw new Error('Unauthorized access to document');
    }

    this.tempStorage.delete(documentId);
    logger.info(`Document deleted: ${documentId}`);
    
    return { success: true, message: 'Document deleted successfully' };
  }

  /**
   * List all documents for a user
   * @param {string} userId - User ID
   * @returns {Array} List of document summaries
   */
  listUserDocuments(userId) {
    const userDocuments = [];
    
    for (const [id, context] of this.tempStorage) {
      if (context.userId === userId) {
        userDocuments.push({
          id: id,
          fileName: context.fileName,
          uploadedAt: context.uploadedAt,
          status: context.status,
          metadata: {
            pageCount: context.metadata.pageCount,
            fileSize: context.metadata.fileSize,
            fileType: context.metadata.fileType
          },
          extractedCounts: {
            risks: context.content.structured.risks.length,
            controls: context.content.structured.controls.length,
            requirements: context.content.structured.requirements.length
          }
        });
      }
    }

    return userDocuments.sort((a, b) => 
      new Date(b.uploadedAt) - new Date(a.uploadedAt)
    );
  }
}

export default new DocumentIngestionService();

