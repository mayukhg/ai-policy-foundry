/**
 * In-memory synthetic + runtime data store shared by API routes and seed script.
 * Stable synth-* IDs allow idempotent re-seeding.
 */

const store = {
  documents: new Map(),
  documentVersions: new Map(), // key: documentFamilyId -> [versions]
  policies: new Map(),
  threats: new Map(),
  reviews: new Map(), // policyId -> [review events]
  feedback: new Map(), // policyId -> [feedback]
  frameworks: new Map(),
  ruleCatalog: new Map(),
  dashboard: {
    overview: null,
    activity: [],
    alerts: []
  },
  agentSnapshots: {},
  seededAt: null
};

export function getStore() {
  return store;
}

export function resetStore() {
  store.documents.clear();
  store.documentVersions.clear();
  store.policies.clear();
  store.threats.clear();
  store.reviews.clear();
  store.feedback.clear();
  store.frameworks.clear();
  store.ruleCatalog.clear();
  store.dashboard = { overview: null, activity: [], alerts: [] };
  store.agentSnapshots = {};
  store.seededAt = null;
}

export function upsertMap(map, items, idKey = 'id') {
  for (const item of items) {
    map.set(item[idKey], item);
  }
}

export function listValues(map) {
  return Array.from(map.values());
}

export default store;
