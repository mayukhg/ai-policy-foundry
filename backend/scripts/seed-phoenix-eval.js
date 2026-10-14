#!/usr/bin/env node
/**
 * Seed synthetic Phoenix eval datasets into memory + write a catalog snapshot.
 * Also ensures document changePackages exist for extraction evals.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.PHOENIX_SPAN_PROCESSOR) {
  process.env.PHOENIX_SPAN_PROCESSOR = 'simple';
}

// Tracing first so any LLM warm-up is captured
import { initTracing, shutdownTracing } from '../src/observability/tracer.js';
initTracing();

import { seedSyntheticData } from '../src/fixtures/seedSynthetic.js';
import { phoenixEvalService } from '../src/evaluation/PhoenixEvalService.js';
import { syncLocalDatasetsToPhoenix, listPhoenixDatasets } from '../src/evaluation/phoenixDatasetClient.js';
import { getStore } from '../src/data/syntheticStore.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const seed = seedSyntheticData();
  const names = await phoenixEvalService.loadDatasets();
  const catalog = phoenixEvalService.listDatasets();

  // Push local JSON suites into Phoenix Datasets UI (what you see at /datasets)
  let phoenixUploads = [];
  let phoenixListed = [];
  try {
    phoenixUploads = await syncLocalDatasetsToPhoenix(phoenixEvalService.datasets);
    phoenixListed = await listPhoenixDatasets();
  } catch (err) {
    logger.error(`Phoenix dataset sync failed (is Phoenix running on :6006?): ${err.message}`);
    phoenixUploads = [{ ok: false, error: err.message }];
  }

  const store = getStore();
  const docs = [...store.documents.values()].map((d) => ({
    id: d.id,
    familyId: d.familyId,
    version: d.version,
    extractionMode: d.changePackage?.mode || null,
    packageChars: d.changePackage?.packageChars || null,
    addedControls: d.changePackage?.addedControls?.length || 0
  }));

  const outDir = path.join(__dirname, '../evaluation-results/phoenix');
  await mkdir(outDir, { recursive: true });
  const snapshot = {
    seededAt: new Date().toISOString(),
    phoenixProject: process.env.PHOENIX_PROJECT_NAME || 'ai-policy-foundry',
    collector: process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006',
    syntheticCounts: seed.counts,
    datasets: catalog,
    phoenixUploads,
    phoenixDatasetsVisible: phoenixListed.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      exampleCount: d.example_count ?? d.metadata?.example_count
    })),
    documents: docs
  };
  const outPath = path.join(outDir, 'dataset-catalog.json');
  await writeFile(outPath, JSON.stringify(snapshot, null, 2));

  logger.info(`Phoenix eval datasets loaded: ${names.join(', ')}`);
  console.log(JSON.stringify({
    ok: phoenixUploads.every((u) => u.ok !== false),
    catalogPath: outPath,
    localDatasets: catalog,
    phoenixUploads,
    phoenixUi: `${process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006'}/datasets`,
    phoenixDatasetsVisible: snapshot.phoenixDatasetsVisible,
    documents: docs
  }, null, 2));
  await shutdownTracing();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try { await shutdownTracing(); } catch { /* ignore */ }
  process.exit(1);
});
