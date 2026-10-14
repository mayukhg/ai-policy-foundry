import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { getStore } from '../data/syntheticStore.js';

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

  hashText(text = '') {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  extractControlIds(text = '') {
    const matches = text.match(/CTRL-[A-Z]+-\d+/g) || [];
    return [...new Set(matches)];
  }

  async analyzeDelta({ documentId, familyId = null } = {}) {
    const store = getStore();
    const current = store.documents.get(documentId);
    if (!current) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const versions = store.documentVersions.get(familyId || current.familyId) || [];
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const previous = sorted.filter((v) => v.id !== documentId).pop() || null;

    if (!previous) {
      return {
        documentId,
        familyId: current.familyId,
        hasDelta: false,
        message: 'No prior version — baseline context only',
        currentHash: this.hashText(current.content?.rawText || ''),
        addedControls: (current.content?.structured?.controls || []).map((c) => c.id || c.description),
        removedControls: [],
        changedSections: [],
        contextSummary: this.summarizeDoc(current)
      };
    }

    const prevText = previous.text || '';
    const currText = current.content?.rawText || '';
    const prevControls = new Set(this.extractControlIds(prevText));
    const currControls = new Set(this.extractControlIds(currText));

    const addedControls = [...currControls].filter((c) => !prevControls.has(c));
    const removedControls = [...prevControls].filter((c) => !currControls.has(c));

    const prevLines = new Set(prevText.split('\n').map((l) => l.trim()).filter(Boolean));
    const currLines = currText.split('\n').map((l) => l.trim()).filter(Boolean);
    const changedSections = currLines.filter((l) => !prevLines.has(l)).slice(0, 20);

    return {
      documentId,
      familyId: current.familyId,
      hasDelta: true,
      previousDocumentId: previous.id,
      previousVersion: previous.version,
      currentVersion: current.version,
      previousHash: this.hashText(prevText),
      currentHash: this.hashText(currText),
      addedControls,
      removedControls,
      changedSections,
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
    return { document: doc, delta };
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
