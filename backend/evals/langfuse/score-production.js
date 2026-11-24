/**
 * Score live AI Policy Foundry traces in Langfuse with the deterministic checks.
 *
 * Reads `policy.generate` and `threat.policy_decision` root observations from a
 * time window (skipping experiment traces) and writes `online_*` scores onto
 * their traces, next to reviewer verdicts (`policy_approved`,
 * `policy_review_reason`) from POST /api/policies/:id/review.
 *
 *   npm run langfuse:score-production -- --since-hours 24
 *   npm run langfuse:score-production -- --since-hours 1 --dry-run
 *
 * Score ids derive from trace id + score name, so re-runs overwrite, not duplicate.
 */

import 'dotenv/config';
import * as checks from './checks.js';
import { getLangfuseClient } from '../../src/observability/langfuse.js';

const EXPERIMENT_ENVIRONMENT = 'sdk-experiment';

const parse = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export function scorePolicy(input, policyText, metadata = {}) {
  const documentIds = input?.document?.controlIds || [];
  const results = {
    online_generated_by_model: [metadata.generationSource === 'llm' ? 1 : 0, `source ${metadata.generationSource}`],
    online_yaml_valid: checks.yamlValid(policyText),
    online_secure_defaults: checks.secureDefaults(policyText),
    online_no_placeholders: checks.noPlaceholders(policyText),
    online_traceability: checks.traceability(policyText, documentIds)
  };
  if (metadata.generationSource === undefined) delete results.online_generated_by_model;
  return results;
}

export function scoreDecision(decision) {
  return {
    online_decision_parsed: checks.decisionParsed(decision),
    online_confidence_valid: checks.confidenceValid(decision)
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const sinceHours = Number(get('--since-hours') || 24);
  const dryRun = argv.includes('--dry-run');
  const langfuse = getLangfuseClient();
  if (!langfuse) throw new Error('Set LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL first.');
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const totals = {};
  let scored = 0;
  for (const name of ['policy.generate', 'threat.policy_decision']) {
    let cursor;
    do {
      const page = await langfuse.api.observations.getMany({ name, fields: 'core,basic,io,metadata', expandMetadata: 'generationSource', fromStartTime: since, limit: 100, cursor });
      for (const obs of page.data) {
        if (obs.environment === EXPERIMENT_ENVIRONMENT) continue;
        const input = parse(obs.input);
        const output = parse(obs.output);
        const metadata = parse(obs.metadata) || {};
        const results = name === 'policy.generate' ? scorePolicy(input, String(output || ''), metadata) : scoreDecision(output || {});
        scored += 1;
        for (const [scoreName, [value, comment]] of Object.entries(results)) {
          if (value === null) continue;
          (totals[scoreName] ??= []).push(value);
          if (dryRun) {
            if (value < 1) console.log(`${obs.traceId} ${scoreName}=${value} ${comment}`);
            continue;
          }
          langfuse.score.create({
            id: `${obs.traceId}-${scoreName}`,
            traceId: obs.traceId,
            observationId: obs.id,
            name: scoreName,
            value,
            dataType: 'NUMERIC',
            comment: String(comment).slice(0, 500)
          });
        }
      }
      cursor = page.data.length ? page.meta?.cursor : undefined;
    } while (cursor);
  }
  await langfuse.flush();
  console.log(`Scored ${scored} live observations since ${since}`);
  for (const [name, values] of Object.entries(totals).sort()) {
    console.log(`  ${name}: ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)} over ${values.length}`);
  }
}

if (process.argv[1]?.endsWith('score-production.js')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
