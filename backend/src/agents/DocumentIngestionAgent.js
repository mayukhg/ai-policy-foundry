import { logger } from '../utils/logger.js';
import documentIngestionService from '../services/DocumentIngestionService.js';
import { getStore } from '../data/syntheticStore.js';
import {
  extractChangePackage,
  summarizeChangePackage
} from '../services/StructuralDeltaExtractor.js';

export class DocumentIngestionAgent {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    logger.info('Initializing Document Ingestion Agent...');
    this.isInitialized = true;
    logger.info('Document Ingestion Agent initialized successfully');
  }

  async executeTask(task, data = {}) {
    if (!this.isInitialized) {
      throw new Error('Document Ingestion Agent not initialized');
    }

    switch (task) {
      case 'ingest':
        return await this.ingest(data);
      case 'get':
        return await this.getDocument(data.documentId, data.userId);
      case 'list':
        return await this.listDocuments();
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  async ingest({ fileBuffer, fileName, userId = 'anonymous', type = 'policy_manual', familyId = null }) {
    const result = await documentIngestionService.ingestDocument(fileBuffer, fileName, userId);
    const store = getStore();

    const doc = {
      id: result.documentId,
      familyId: familyId || `family-${result.documentId}`,
      type,
      title: fileName,
      fileName,
      version: 1,
      uploadedAt: result.context.uploadedAt,
      userId,
      status: result.context.status,
      metadata: result.context.metadata,
      content: result.context.content,
      validation: result.context.validation,
      extractedData: {
        risks: result.context.content.structured.risks.length,
        controls: result.context.content.structured.controls.length,
        requirements: result.context.content.structured.requirements.length
      }
    };

    // Bump version if family exists; prior version is last entry before this upload
    const existingVersions = [...(store.documentVersions.get(doc.familyId) || [])];
    const previous = existingVersions.length
      ? existingVersions[existingVersions.length - 1]
      : null;
    if (existingVersions.length) {
      doc.version = existingVersions.length + 1;
    }

    // Phase 1 — deterministic ChangePackage (no LLM)
    const changePackage = extractChangePackage(doc, previous);
    doc.changePackage = changePackage;

    existingVersions.push({
      id: doc.id,
      version: doc.version,
      fileName,
      uploadedAt: doc.uploadedAt,
      text: result.context.content.rawText,
      extracted: result.context.content.structured
    });
    store.documentVersions.set(doc.familyId, existingVersions);
    store.documents.set(doc.id, doc);

    // Mirror package onto temp storage for buildContextSummary
    if (documentIngestionService?.tempStorage?.has(doc.id)) {
      const ctx = documentIngestionService.tempStorage.get(doc.id);
      ctx.changePackage = changePackage;
      documentIngestionService.tempStorage.set(doc.id, ctx);
    }

    logger.info(
      `Phase-1 extraction complete for ${doc.id}: mode=${changePackage.mode} chars=${changePackage.packageChars}`
    );

    return {
      documentId: doc.id,
      familyId: doc.familyId,
      version: doc.version,
      type: doc.type,
      fileName: doc.fileName,
      extractedData: doc.extractedData,
      validation: doc.validation,
      status: doc.status,
      changePackage: summarizeChangePackage(changePackage)
    };
  }

  async getDocument(documentId, userId = 'anonymous') {
    const store = getStore();
    if (store.documents.has(documentId)) {
      return store.documents.get(documentId);
    }
    return documentIngestionService.getDocumentContext(documentId, userId);
  }

  async listDocuments() {
    return Array.from(getStore().documents.values());
  }

  async shutdown() {
    this.isInitialized = false;
  }
}
