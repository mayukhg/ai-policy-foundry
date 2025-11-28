import { logger } from '../utils/logger.js';
import documentParser from './DocumentParser.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const context = this.tempStorage.get(documentId);
    
    if (!context) {
      throw new Error('Document not found');
    }

    if (context.userId !== userId) {
      throw new Error('Unauthorized access to document');
    }

    return context;
  }

  /**
   * Build context summary for policy generation
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Context summary optimized for AI generation
   */
  async buildContextSummary(documentId) {
    const context = this.tempStorage.get(documentId);
    
    if (!context) {
      throw new Error('Document not found');
    }

    const structured = context.content.structured;
    
    // Build comprehensive context summary
    const summary = {
      documentId: documentId,
      fileName: context.fileName,
      extractedAt: context.uploadedAt,
      
      // Key information extracted
      risks: structured.risks.map(r => ({
        description: r.text,
        context: r.context
      })),
      
      controls: structured.controls.map(c => ({
        id: c.id,
        description: c.text,
        context: c.context
      })),
      
      requirements: structured.requirements.map(r => ({
        description: r.text,
        context: r.context
      })),
      
      keyTerms: structured.keyTerms,
      sections: structured.sections,
      
      // Full text for comprehensive analysis
      fullText: context.content.rawText.substring(0, 10000), // Limit to first 10k chars for prompt
      
      // Metadata
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

