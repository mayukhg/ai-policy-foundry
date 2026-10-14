#!/usr/bin/env node
/**
 * Run Phoenix eval datasets and export spans to the local Phoenix collector.
 *
 * Usage:
 *   node scripts/run-phoenix-eval.js
 *   node scripts/run-phoenix-eval.js --no-llm
 *   node scripts/run-phoenix-eval.js --dataset extraction-pipeline-eval
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// Prefer simple processor for CLI so spans flush on shutdown without hanging
if (!process.env.PHOENIX_SPAN_PROCESSOR) {
  process.env.PHOENIX_SPAN_PROCESSOR = 'simple';
}

import { initTracing, shutdownTracing } from '../src/observability/tracer.js';
initTracing();

import { seedSyntheticData } from '../src/fixtures/seedSynthetic.js';
import { phoenixEvalService } from '../src/evaluation/PhoenixEvalService.js';
import { initializeAgents } from '../src/agents/agentManager.js';
import { logger } from '../src/utils/logger.js';

const args = process.argv.slice(2);
const noLlm = args.includes('--no-llm');
const datasetIdx = args.indexOf('--dataset');
const onlyDataset = datasetIdx >= 0 ? args[datasetIdx + 1] : null;

async function main() {
  seedSyntheticData();
  // Agents needed for generate / threat decision paths
  try {
    await initializeAgents(null);
  } catch (err) {
    logger.warn(`Agent init partial: ${err.message}`);
  }

  await phoenixEvalService.loadDatasets();

  let results;
  if (onlyDataset) {
    const dataset = phoenixEvalService.datasets.get(onlyDataset);
    if (!dataset) {
      throw new Error(`Unknown dataset: ${onlyDataset}. Available: ${[...phoenixEvalService.datasets.keys()].join(', ')}`);
    }
    const datasetResult = await phoenixEvalService.runDataset(dataset, { includeLlm: !noLlm });
    results = {
      timestamp: new Date().toISOString(),
      datasets: { [onlyDataset]: datasetResult },
      summary: {
        total: datasetResult.total,
        passed: datasetResult.passed,
        failed: datasetResult.failed,
        averageScore: datasetResult.averageScore
      }
    };
  } else {
    results = await phoenixEvalService.runAll({ includeLlm: !noLlm });
  }

  console.log(JSON.stringify({
    ok: true,
    phoenixUi: process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006',
    project: process.env.PHOENIX_PROJECT_NAME || 'ai-policy-foundry',
    summary: results.summary,
    resultsPath: results.resultsPath || null,
    datasets: Object.fromEntries(
      Object.entries(results.datasets).map(([k, v]) => [
        k,
        { total: v.total, passed: v.passed, failed: v.failed, averageScore: v.averageScore }
      ])
    )
  }, null, 2));

  // Flush exporters then exit (avoid hanging open handles from agent timers)
  await shutdownTracing();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try { await shutdownTracing(); } catch { /* ignore */ }
  process.exit(1);
});
