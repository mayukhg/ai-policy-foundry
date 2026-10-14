/**
 * Upload local synthetic eval JSON into Arize Phoenix Datasets UI
 * via POST /v1/datasets/upload
 */
import { logger } from '../utils/logger.js';

function phoenixBaseUrl() {
  return (process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006').replace(/\/$/, '');
}

function phoenixHeaders() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const raw = String(process.env.PHOENIX_CLIENT_HEADERS || '').trim();
  if (!raw) return headers;
  for (const part of raw.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 'api_key') {
      headers.Authorization = `Bearer ${value}`;
      headers.api_key = value;
    } else {
      headers[key] = value;
    }
  }
  return headers;
}

async function phoenixFetch(path, options = {}) {
  const url = `${phoenixBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...phoenixHeaders(), ...(options.headers || {}) }
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Phoenix ${res.status} ${path}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function listPhoenixDatasets() {
  const body = await phoenixFetch('/v1/datasets?limit=100');
  return body?.data || [];
}

export async function deletePhoenixDataset(id) {
  return phoenixFetch(`/v1/datasets/${id}`, { method: 'DELETE' });
}

/**
 * Convert a local phoenix-datasets/*.json suite into Phoenix upload payload.
 */
export function toPhoenixUploadPayload(dataset, { action = 'create' } = {}) {
  const examples = dataset.examples || [];
  return {
    action,
    name: dataset.dataset_name,
    description: dataset.description || '',
    inputs: examples.map((ex) => ({
      id: ex.id,
      agent: ex.agent,
      task: ex.task,
      ...ex.input
    })),
    outputs: examples.map((ex) => ({
      expected: ex.expected || {},
      evaluators: ex.evaluators || [],
      latencyBudgetMs: ex.latencyBudgetMs || null
    })),
    metadata: examples.map((ex) => ({
      example_id: ex.id,
      agent: ex.agent,
      task: ex.task,
      framework: dataset.framework || 'phoenix',
      dataset_version: dataset.version || '1.0.0',
      source: 'ai-policy-foundry/synthetic'
    })),
    example_ids: examples.map((ex) => ex.id)
  };
}

/**
 * Upsert one local dataset into Phoenix (delete+create if name already exists).
 */
export async function upsertPhoenixDataset(dataset) {
  const existing = await listPhoenixDatasets();
  const match = existing.find((d) => d.name === dataset.dataset_name);
  if (match?.id) {
    logger.info(`Phoenix dataset "${dataset.dataset_name}" exists (${match.id}) — replacing`);
    try {
      await deletePhoenixDataset(match.id);
    } catch (err) {
      logger.warn(`Delete existing dataset failed: ${err.message}`);
    }
  }

  const payload = toPhoenixUploadPayload(dataset, { action: 'create' });
  const body = await phoenixFetch('/v1/datasets/upload?sync=true', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return {
    name: dataset.dataset_name,
    exampleCount: dataset.examples?.length || 0,
    phoenix: body?.data || body
  };
}

/**
 * Upload all datasets from a Map or array of dataset objects.
 */
export async function syncLocalDatasetsToPhoenix(datasets) {
  const list = datasets instanceof Map ? [...datasets.values()] : [...datasets];
  const results = [];
  for (const dataset of list) {
    try {
      const uploaded = await upsertPhoenixDataset(dataset);
      results.push({ ok: true, ...uploaded });
      logger.info(
        `Uploaded Phoenix dataset "${dataset.dataset_name}" (${dataset.examples?.length || 0} examples)`
      );
    } catch (err) {
      results.push({
        ok: false,
        name: dataset.dataset_name,
        error: err.message
      });
      logger.error(`Failed uploading "${dataset.dataset_name}": ${err.message}`);
    }
  }
  return results;
}

export default {
  listPhoenixDatasets,
  upsertPhoenixDataset,
  syncLocalDatasetsToPhoenix,
  toPhoenixUploadPayload
};
