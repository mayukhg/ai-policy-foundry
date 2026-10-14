import { logger } from '../utils/logger.js';
import { getStore } from '../data/syntheticStore.js';
import {
  extractChangePackage,
  summarizeChangePackage
} from '../services/StructuralDeltaExtractor.js';

export class AnalysisAgent {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    logger.info('Initializing Analysis Agent...');
    this.isInitialized = true;
    logger.info('Analysis Agent initialized successfully');
  }

  async executeTask(task, data = {}) {
    if (!this.isInitialized) {
      throw new Error('Analysis Agent not initialized');
    }

    switch (task) {
      case 'delta':
        return await this.analyzeDelta(data);
      case 'context':
        return await this.buildContext(data);
      case 'framework-delta':
        return await this.frameworkDelta(data);
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  resolvePreviousVersion(current, familyId) {
    const store = getStore();
    const versions = store.documentVersions.get(familyId || current.familyId) || [];
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    return sorted.filter((v) => v.id !== current.id).pop() || null;
  }

  async analyzeDelta({ documentId, familyId = null } = {}) {
    const store = getStore();
    const current = store.documents.get(documentId);
    if (!current) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Prefer cached package from Phase-1 ingest
    if (current.changePackage) {
      return {
        ...current.changePackage,
        changePackage: current.changePackage,
        hasDelta: current.changePackage.mode === 'delta',
        packageSummary: summarizeChangePackage(current.changePackage),
        contextSummary: this.summarizeDoc(current)
      };
    }

    const previous = this.resolvePreviousVersion(current, familyId);
    const changePackage = extractChangePackage(current, previous);
    current.changePackage = changePackage;
    store.documents.set(documentId, current);

    return {
      ...changePackage,
      changePackage,
      hasDelta: changePackage.mode === 'delta',
      packageSummary: summarizeChangePackage(changePackage),
      contextSummary: this.summarizeDoc(current)
    };
  }

  summarizeDoc(doc) {
    const structured = doc.content?.structured || {};
    return {
      fileName: doc.fileName,
      type: doc.type,
      risks: (structured.risks || []).length,
      controls: (structured.controls || []).length,
      requirements: (structured.requirements || []).length
    };
  }

  async buildContext({ documentId }) {
    const store = getStore();
    const doc = store.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }
    const delta = await this.analyzeDelta({ documentId, familyId: doc.familyId });
    return { document: doc, delta, changePackage: delta };
  }

  async frameworkDelta({ frameworkName = 'CIS' } = {}) {
    const store = getStore();
    const framework = [...store.frameworks.values()].find((f) => f.name === frameworkName);
    if (!framework) {
      return { frameworkName, driftDetected: false };
    }
    return {
      frameworkName: framework.name,
      version: framework.version,
      driftDetected: Boolean(framework.driftDetected),
      previousFingerprint: framework.previousFingerprint,
      fingerprint: framework.fingerprint,
      summary: framework.driftSummary,
      suggestedTweaks: framework.driftDetected
        ? [
            'Review object storage public access controls',
            'Tighten key rotation interval to match updated framework',
            'Re-validate approved policies against new control set'
          ]
        : []
    };
  }

  async shutdown() {
    this.isInitialized = false;
  }
}
