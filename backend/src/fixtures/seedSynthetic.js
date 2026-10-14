import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getStore,
  resetStore,
  upsertMap
} from '../data/syntheticStore.js';
import documentIngestionService from '../services/DocumentIngestionService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(__dirname, name), 'utf-8'));
}

/**
 * Idempotent synthetic seed for all demo flows.
 */
export function seedSyntheticData() {
  resetStore();
  const store = getStore();

  const documentsFixture = loadJson('documents.json');
  const policies = loadJson('policies.json');
  const threats = loadJson('threats.json');
  const compliance = loadJson('compliance.json');
  const dashboard = loadJson('dashboard.json');
  const reviews = loadJson('reviews.json');

  // Documents + versions
  for (const family of documentsFixture.families) {
    store.documentVersions.set(family.familyId, family.versions);
    for (const version of family.versions) {
      const doc = {
        id: version.id,
        familyId: family.familyId,
        type: family.type,
        title: family.title,
        fileName: version.fileName,
        version: version.version,
        uploadedAt: version.uploadedAt,
        userId: 'demo-user',
        status: 'ready',
        metadata: {
          pageCount: 1,
          fileSize: version.text.length,
          fileType: 'text/plain'
        },
        content: {
          rawText: version.text,
          structured: {
            risks: version.extracted.risks,
            controls: version.extracted.controls,
            requirements: version.extracted.requirements,
            keyTerms: [],
            sections: []
          }
        },
        validation: { isValid: true, issues: [], warnings: [] },
        extractedData: {
          risks: version.extracted.risks.length,
          controls: version.extracted.controls.length,
          requirements: version.extracted.requirements.length
        }
      };
      store.documents.set(doc.id, doc);

      // Also hydrate DocumentIngestionService in-memory map for generate-with-doc flows
      if (documentIngestionService?.tempStorage) {
        documentIngestionService.tempStorage.set(doc.id, {
          id: doc.id,
          userId: doc.userId,
          fileName: doc.fileName,
          uploadedAt: doc.uploadedAt,
          metadata: doc.metadata,
          content: doc.content,
          validation: doc.validation,
          status: doc.status
        });
      }
    }
  }

  upsertMap(store.policies, policies);
  upsertMap(store.threats, threats);
  upsertMap(store.frameworks, compliance.frameworks);

  for (const [policyId, events] of Object.entries(reviews)) {
    store.reviews.set(policyId, events);
  }

  // Rule catalog + conflict demo
  for (const policy of policies) {
    store.ruleCatalog.set(policy.id, {
      id: policy.id,
      name: policy.name,
      service: policy.service,
      framework: policy.compliance,
      version: policy.metadata?.version || '1.0.0',
      status: policy.status,
      controlIds: policy.controlIds || [],
      hasConflicts: Boolean(policy.complianceDetails?.conflicts?.length)
    });
  }

  store.feedback.set('synth-policy-aws-s3-approved', [
    {
      id: 'synth-feedback-001',
      policyId: 'synth-policy-aws-s3-approved',
      rating: '5',
      comments: 'Clear controls and good traceability.',
      timestamp: '2026-03-05T15:00:00.000Z'
    }
  ]);

  store.dashboard = {
    overview: dashboard.overview,
    activity: dashboard.activity,
    alerts: dashboard.alerts
  };

  store.agentSnapshots = {
    'document-ingestion': {
      status: 'active',
      description: 'Parses policy manuals and risk matrices',
      metrics: { requestsProcessed: 12, averageResponseTime: 180, errors: 0 }
    },
    analysis: {
      status: 'active',
      description: 'Identifies delta changes and context',
      metrics: { requestsProcessed: 8, averageResponseTime: 220, errors: 0 }
    },
    'policy-generator': {
      status: 'active',
      description: 'Generates security policies using AI',
      metrics: { requestsProcessed: 20, averageResponseTime: 1200, errors: 1 }
    },
    compliance: {
      status: 'active',
      description: 'Ensures compliance with regulatory frameworks',
      metrics: { requestsProcessed: 18, averageResponseTime: 340, errors: 0 }
    },
    'security-analysis': {
      status: 'active',
      description: 'Analyzes security posture and identifies risks',
      metrics: { requestsProcessed: 15, averageResponseTime: 410, errors: 0 }
    },
    'threat-intelligence': {
      status: 'active',
      description: 'Monitors and analyzes threat intelligence feeds',
      metrics: { requestsProcessed: 40, averageResponseTime: 500, errors: 2 }
    },
    'cloud-provider': {
      status: 'idle',
      description: 'Monitors cloud provider updates and new services',
      metrics: { requestsProcessed: 6, averageResponseTime: 300, errors: 0 }
    }
  };

  store.seededAt = new Date().toISOString();
  logger.info(`Synthetic data seeded at ${store.seededAt}`);
  return {
    seededAt: store.seededAt,
    counts: {
      documents: store.documents.size,
      policies: store.policies.size,
      threats: store.threats.size,
      frameworks: store.frameworks.size,
      reviews: store.reviews.size
    }
  };
}

export default seedSyntheticData;
