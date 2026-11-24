/**
 * Run the AI Policy Foundry eval suites as Langfuse experiments and apply the gates.
 *
 *   npm run langfuse:eval                                   # all suites, live model
 *   npm run langfuse:eval -- --judge --repeats 2            # LLM judge + consistency
 *   npm run langfuse:eval -- --offline --no-langfuse --suite threat_match,extraction
 *
 * Each suite is a Langfuse dataset `ai-policy-foundry/<suite>`; items are upserted
 * by id. The tasks call the product code (agentManager.generatePolicy,
 * SecurityAnalysisAgent.analyzeThreatAgainstPolicies + makePolicyDecision,
 * StructuralDeltaExtractor), so the product's own Langfuse traces nest under
 * each experiment item. Exits 1 when a blocking gate fails.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { CUSTOM_DOCUMENTS, DESCRIPTIONS, SUITES } from './cases.js';
import { decisionEvaluator, extractionEvaluator, makePolicyJudge, matchEvaluator, policyEvaluator, rowsOf, summarize, summaryRunEvaluator } from './evaluators.js';
import { evaluateGates } from './gates.js';
import { getLangfuseClient, flushLangfuse, registerLangfuseAsGlobalIfUnset } from '../../src/observability/langfuse.js';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ------------------------------------------------------------------ app setup

let app = null;

/** Seed the synthetic store, add the eval documents, and initialise the agents once. */
export async function setupApp() {
  if (app) return app;
  process.chdir(BACKEND);
  const { seedSyntheticData } = await import('../../src/fixtures/seedSynthetic.js');
  const { getStore } = await import('../../src/data/syntheticStore.js');
  const { extractChangePackage } = await import('../../src/services/StructuralDeltaExtractor.js');
  const agents = await import('../../src/agents/agentManager.js');
  const ingestion = (await import('../../src/services/DocumentIngestionService.js')).default;
  seedSyntheticData();
  const store = getStore();
  const families = {};
  for (const [id, doc] of Object.entries(CUSTOM_DOCUMENTS)) (families[doc.familyId] ??= []).push({ id, ...doc });
  for (const [familyId, versions] of Object.entries(families)) {
    versions.sort((a, b) => a.version - b.version);
    store.documentVersions.set(familyId, versions.map((v) => ({ id: v.id, version: v.version, fileName: v.fileName, text: v.text, extracted: v.extracted })));
    versions.forEach((v, i) => {
      const previous = versions[i - 1];
      const doc = {
        id: v.id, familyId, type: 'policy_manual', title: familyId, fileName: v.fileName, version: v.version,
        uploadedAt: '2026-11-01T00:00:00.000Z', userId: 'eval', status: 'ready',
        metadata: { pageCount: 1, fileSize: v.text.length, fileType: 'text/plain' },
        content: { rawText: v.text, structured: { ...v.extracted, keyTerms: [], sections: [] } },
        validation: { isValid: true, issues: [], warnings: [] }
      };
      doc.changePackage = extractChangePackage(doc, previous ? { id: previous.id, version: previous.version, text: previous.text, extracted: previous.extracted } : null);
      store.documents.set(v.id, doc);
    });
  }
  await agents.initializeAgents();
  app = { store, agents, ingestion, extractChangePackage };
  return app;
}

// ---------------------------------------------------------------------- tasks

function documentIds(context) {
  const pkg = context?.changePackage || {};
  const ids = new Set([
    ...(context?.controls || []).map((c) => c.id),
    ...(pkg.addedControls || []).map((c) => c.id),
    ...(pkg.removedControls || []).map((c) => c.id),
    ...(pkg.stableInventory?.controlIds || [])
  ]);
  return [...ids].filter(Boolean);
}

export async function policyTask({ input }) {
  const { agents, ingestion } = await setupApp();
  const started = performance.now();
  try {
    const context = input.documentId ? await ingestion.buildContextSummary(input.documentId) : null;
    const policy = await agents.agentManager.generatePolicy(input.service, input.requirements, context);
    const { getStore } = await import('../../src/data/syntheticStore.js');
    const framework = [...getStore().frameworks.values()].find((f) => f.name === (input.requirements?.compliance || 'CIS'));
    return {
      policyText: typeof policy.policy === 'string' ? policy.policy : JSON.stringify(policy.policy),
      generationSource: policy.metadata?.generationSource,
      quality: policy.metadata?.quality || null,
      traceId: policy.metadata?.langfuseTraceId,
      allowedControlIds: [...documentIds(context), ...(framework?.controls || [])],
      framework: framework ? { name: framework.name, version: framework.version, controls: framework.controls || [] } : null,
      removedControlIds: (context?.changePackage?.removedControls || []).map((c) => c.id),
      requirementIds: [
        ...(context?.requirements || []).map((r) => r.id),
        ...(context?.changePackage?.addedRequirements || []).map((r) => r.id),
        ...(context?.changePackage?.removedRequirements || []).map((r) => r.id)
      ].filter(Boolean),
      documentControlIds: (context?.controls || []).map((c) => c.id),
      documentControls: context?.controls || [],
      latencyS: Math.round(performance.now() - started) / 1000
    };
  } catch (error) {
    return { error: error.message, latencyS: (performance.now() - started) / 1000 };
  }
}

export async function decisionTask({ input }) {
  const { agents } = await setupApp();
  const security = await agents.agentManager.getAgent('security-analysis');
  const started = performance.now();
  try {
    const analysis = await security.analyzeThreatAgainstPolicies(input.threat, input.policies, input.policies);
    const decision = await security.makePolicyDecision(input.threat, analysis, input.policies);
    return { decision, matchScore: analysis.matchScore, coverageGap: analysis.coverageGap, latencyS: Math.round(performance.now() - started) / 1000 };
  } catch (error) {
    return { error: error.message };
  }
}

export async function matchTask({ input }) {
  const { agents } = await setupApp();
  const security = await agents.agentManager.getAgent('security-analysis');
  return { score: security.calculatePolicyThreatMatch(input.policy, input.threat) };
}

export async function extractionTask({ input }) {
  const { store, extractChangePackage } = await setupApp();
  const current = store.documents.get(input.documentId);
  if (!current) return { error: `document ${input.documentId} not found` };
  const versions = store.documentVersions.get(current.familyId) || [];
  const previous = input.previousDocumentId ? versions.find((v) => v.id === input.previousDocumentId) : null;
  return { changePackage: extractChangePackage(current, previous ? { id: previous.id, version: previous.version, text: previous.text, extracted: previous.extracted } : null) };
}

const TASKS = {
  policy_generation: { task: policyTask, evaluators: [policyEvaluator], repeatable: true },
  threat_decision: { task: decisionTask, evaluators: [decisionEvaluator], repeatable: true },
  threat_match: { task: matchTask, evaluators: [matchEvaluator], repeatable: false },
  extraction: { task: extractionTask, evaluators: [extractionEvaluator], repeatable: false }
};

// --------------------------------------------------------------------- runner

function parseArgs(argv) {
  const get = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const all = Object.keys(SUITES);
  const suites = (get('--suite') || 'all') === 'all' ? all : get('--suite').split(',');
  const unknown = suites.filter((s) => !all.includes(s));
  if (unknown.length) throw new Error(`unknown suite ${unknown.join(', ')}; choose from ${all.join(', ')}`);
  return {
    suites,
    offline: argv.includes('--offline'),
    judge: argv.includes('--judge'),
    repeats: Number(get('--repeats') || 1),
    concurrency: Number(get('--concurrency') || 3),
    noLangfuse: argv.includes('--no-langfuse'),
    noGate: argv.includes('--no-gate'),
    runName: get('--run-name') || `policy-foundry-eval-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`,
    report: get('--report')
  };
}

async function runLocal(items, task, evaluators) {
  const results = [];
  for (const item of items) {
    const output = await task({ input: item.input, expectedOutput: item.expectedOutput, metadata: item.metadata });
    const evaluations = [];
    for (const evaluator of evaluators) {
      const r = await evaluator({ input: item.input, output, expectedOutput: item.expectedOutput, metadata: item.metadata });
      evaluations.push(...(Array.isArray(r) ? r : [r]));
    }
    results.push({ item, output, evaluations });
  }
  return results;
}

async function syncDataset(suite, items) {
  const langfuse = getLangfuseClient();
  const name = `ai-policy-foundry/${suite}`;
  try {
    await langfuse.api.datasets.get(name);
  } catch {
    await langfuse.api.datasets.create({ name, description: DESCRIPTIONS[suite], metadata: { suite, product: 'ai-policy-foundry' } });
  }
  for (const item of items) {
    await langfuse.api.datasetItems.create({ datasetName: name, id: item.id, input: item.input, expectedOutput: item.expectedOutput, metadata: item.metadata });
  }
  return langfuse.dataset.get(name);
}

const DECISION_CHECKS = new Set([
  'generated_by_model', 'yaml_valid', 'control_grounding', 'no_invented_controls', 'removed_controls_not_enforced',
  'secure_defaults', 'injection_resisted', 'decision_parsed', 'action_correct', 'suggestion_consistent'
]);

/** Share of cases whose decision-check outcomes match in every repeat. */
export function consistency(runs) {
  const byCase = new Map();
  for (const results of runs) {
    for (const r of results) {
      const id = r.item?.metadata?.caseId;
      const sig = JSON.stringify(
        (r.evaluations || []).filter((e) => DECISION_CHECKS.has(e.name)).map((e) => [e.name, e.value >= 1]).sort()
      );
      byCase.set(id, [...(byCase.get(id) || []), sig]);
    }
  }
  const repeated = [...byCase.values()].filter((s) => s.length > 1);
  if (!repeated.length) return undefined;
  return repeated.filter((s) => new Set(s).size === 1).length / repeated.length;
}

async function runSuite(suite, args, useLangfuse) {
  const items = SUITES[suite]();
  const { task, evaluators: base, repeatable } = TASKS[suite];
  const evaluators = suite === 'policy_generation' && args.judge && !args.offline ? [...base, makePolicyJudge()] : base;
  const repeats = repeatable ? args.repeats : 1;
  const runs = [];
  const urls = [];
  const dataset = useLangfuse ? await syncDataset(suite, items) : null;
  for (let r = 0; r < repeats; r++) {
    if (!dataset) {
      runs.push(await runLocal(items, task, evaluators));
      continue;
    }
    const result = await dataset.runExperiment({
      name: suite,
      runName: `${args.runName}-${suite}${repeats > 1 ? `-r${r + 1}` : ''}`,
      description: DESCRIPTIONS[suite],
      task,
      evaluators,
      runEvaluators: [summaryRunEvaluator],
      maxConcurrency: args.concurrency,
      metadata: { suite, offline: args.offline, judge: args.judge, repeat: r + 1, model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini' }
    });
    runs.push(result.itemResults);
    if (result.experimentUrl) urls.push(result.experimentUrl);
  }
  const summary = summarize(rowsOf(runs.flat()));
  const c = consistency(runs);
  if (c !== undefined) summary.consistency = c;
  return { summary, last: runs[runs.length - 1], urls, items: items.length };
}

const fmt = (v) => (v === null || v === undefined ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(3));
const INFO = new Set(['latency_s', 'task_error', 'judge_error', 'repair_needed']);

function scorecard(outcomes, gates, args) {
  const lines = [
    '# AI Policy Foundry eval scorecard',
    '',
    `Run \`${args.runName}\` · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${args.offline ? '**offline (no model: demo template and rule-based decisions)**' : `model ${process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'}`} · judge ${args.judge && !args.offline ? 'on' : 'off'} · repeats ${args.repeats}`,
    '',
    '## Gates',
    '',
    '| Suite | Metric | Gate | Level | Value | Result |',
    '|---|---|---|---|---|---|',
    ...gates.map((g) => `| ${g.suite} | \`${g.metric}\` | ${g.op} ${g.threshold} | ${g.level} | ${fmt(g.value)} | ${g.status} |`)
  ];
  for (const [suite, o] of Object.entries(outcomes)) {
    lines.push('', `## ${suite} (${o.items} cases)`, '');
    for (const url of o.urls) lines.push(`Langfuse: ${url}`);
    const metrics = Object.keys(o.summary).filter((k) => k.startsWith('avg/')).map((k) => k.slice(4));
    const hasAdv = Object.keys(o.summary).some((k) => k.startsWith('adversarial/'));
    lines.push('', `| Metric | All${hasAdv ? ' | Clean | Adversarial' : ''} |`, `|---|---|${hasAdv ? '---|---|' : ''}`);
    for (const m of metrics) lines.push(`| \`${m}\` | ${fmt(o.summary[`avg/${m}`])}${hasAdv ? ` | ${fmt(o.summary[`clean/${m}`])} | ${fmt(o.summary[`adversarial/${m}`])}` : ''} |`);
    const extras = ['consistency', 'latency_p95_s', 'count/task_error', 'count/judge_error'].filter((k) => k in o.summary);
    if (extras.length) lines.push('', extras.map((k) => `\`${k}\` ${fmt(o.summary[k])}`).join(' · '));
    const failures = o.last.flatMap((r) =>
      (r.evaluations || [])
        .filter((e) => typeof e.value === 'number' && e.value < 1 && !INFO.has(e.name))
        .map((e) => `| ${r.item?.metadata?.caseId} | \`${e.name}\` | ${fmt(e.value)} | ${String(e.comment || '').replace(/\|/g, '/').replace(/\n/g, ' ')} |`)
    );
    if (failures.length) lines.push('', 'Cases below 1.0 (last repeat):', '', '| Case | Score | Value | Why |', '|---|---|---|---|', ...failures);
  }
  return lines.join('\n') + '\n';
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.noLangfuse) {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
  }
  if (args.offline) {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENAI_API_KEY;
  }
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
  const useLangfuse = Boolean(getLangfuseClient());
  if (useLangfuse) registerLangfuseAsGlobalIfUnset();
  else if (!args.noLangfuse) console.log('Langfuse is not configured (LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL). Running locally.');
  const outcomes = {};
  for (const suite of args.suites) {
    console.log(`Running ${suite} ...`);
    outcomes[suite] = await runSuite(suite, args, useLangfuse);
  }
  if (useLangfuse) await flushLangfuse();
  const gates = evaluateGates(Object.fromEntries(Object.entries(outcomes).map(([s, o]) => [s, o.summary])));
  const report = scorecard(outcomes, gates, args);
  console.log(report);
  if (args.report) {
    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(args.report, report);
    fs.writeFileSync(args.report.replace(/\.md$/, '') + '.json', JSON.stringify({ runName: args.runName, summaries: Object.fromEntries(Object.entries(outcomes).map(([s, o]) => [s, o.summary])), gates }, null, 2));
  }
  const failed = gates.filter((g) => g.status === 'FAIL');
  if (failed.length && !args.noGate) {
    console.log(`${failed.length} blocking gate(s) failed.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();
  main()
    .then((code) => {
      process.chdir(cwd);
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
