/**
 * Langfuse tracing and scores for AI Policy Foundry's two LLM outputs:
 *   policy.generate          PolicyGenerationAgent.generatePolicy (YAML policy)
 *   threat.policy_decision   SecurityAnalysisAgent.makePolicyDecision (create vs tweak)
 *
 * Runs next to the Phoenix tracer (tracer.js) on its own OpenTelemetry
 * provider, so Phoenix is unchanged. Off unless LANGFUSE_PUBLIC_KEY and
 * LANGFUSE_SECRET_KEY are set; every helper is then a pass-through.
 *
 * Langfuse v4 is observations-first: trace-wide context (trace name, user,
 * tags, version, metadata) is propagated to every observation, including the
 * cost-bearing generation, and overall input/output sits on the root.
 */

import { context, trace, ProxyTracerProvider } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { LangfuseSpanProcessor, isLangfuseSpan } from '@langfuse/otel';
import { propagateAttributes, setLangfuseTracerProvider, startActiveObservation } from '@langfuse/tracing';
import { LangfuseClient } from '@langfuse/client';
import { LANGFUSE_SDK_NAME, LANGFUSE_SDK_VERSION } from '@langfuse/core';

let provider = null;
let processor = null;
let client = null;
let initialized = false;

/** USD per million tokens. Override with OPENROUTER_PRICE_INPUT / _OUTPUT. */
const PRICES = {
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'openai/gpt-4.1': { input: 2.0, output: 8.0 },
  'openai/gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'anthropic/claude-sonnet-5': { input: 2.0, output: 10.0 }
};

export function langfuseEnabled() {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY?.trim() && process.env.LANGFUSE_SECRET_KEY?.trim());
}

function baseUrl() {
  return (process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com').trim();
}

/**
 * The default OTLP exporter builds its own HTTPS agent, which ignores
 * HTTPS_PROXY. Behind a proxy, export through one that honours it (Node >= 22.21
 * `proxyEnv`) with the same headers as Langfuse's own exporter.
 */
function proxiedExporter() {
  if (!(process.env.HTTPS_PROXY || process.env.https_proxy)) return undefined;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY || '';
  const secretKey = process.env.LANGFUSE_SECRET_KEY || '';
  return new OTLPTraceExporter({
    url: `${baseUrl().replace(/\/$/, '')}/api/public/otel/v1/traces`,
    headers: {
      Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`,
      'x-langfuse-sdk-name': LANGFUSE_SDK_NAME,
      'x-langfuse-sdk-version': LANGFUSE_SDK_VERSION,
      'x-langfuse-public-key': publicKey,
      'x-langfuse-ingestion-version': '4'
    },
    httpAgentOptions: { keepAlive: true, proxyEnv: process.env }
  });
}

export function initLangfuse() {
  if (initialized) return provider;
  initialized = true;
  if (!langfuseEnabled()) return null;
  // Phoenix registers a global context manager in the app; scripts without it need one.
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  processor = new LangfuseSpanProcessor({
    baseUrl: baseUrl(),
    exporter: proxiedExporter(),
    environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || undefined,
    release: process.env.LANGFUSE_RELEASE || undefined,
    shouldExportSpan: ({ otelSpan }) => isLangfuseSpan(otelSpan)
  });
  provider = new NodeTracerProvider({ spanProcessors: [processor] });
  setLangfuseTracerProvider(provider);
  return provider;
}

/** Langfuse's experiment runner links traces only when a global provider exists. */
export function registerLangfuseAsGlobalIfUnset() {
  if (!initLangfuse()) return false;
  let current = trace.getTracerProvider();
  if (current instanceof ProxyTracerProvider) current = current.getDelegate();
  if (current.constructor.name !== 'NoopTracerProvider') return false;
  return trace.setGlobalTracerProvider(provider);
}

export function getLangfuseClient() {
  if (!langfuseEnabled()) return null;
  initLangfuse();
  if (!client) client = new LangfuseClient({ baseUrl: baseUrl() });
  return client;
}

export function costUsd(model, usage) {
  const envIn = Number(process.env.OPENROUTER_PRICE_INPUT);
  const envOut = Number(process.env.OPENROUTER_PRICE_OUTPUT);
  const price = envIn > 0 && envOut >= 0 ? { input: envIn, output: envOut } : PRICES[model];
  if (!price || !usage) return undefined;
  const input = ((usage.prompt_tokens || 0) * price.input) / 1_000_000;
  const output = ((usage.completion_tokens || 0) * price.output) / 1_000_000;
  return { input, output, total: input + output };
}

/**
 * Run `fn` as the root observation of a trace, with trace-wide attributes
 * propagated to it and every child. `fn` receives the root observation (or a
 * no-op stand-in when Langfuse is off) and returns { output, result }.
 */
export async function withRootTrace(name, { input, propagate = {} }, fn) {
  if (!langfuseEnabled()) return (await fn(NULL_OBSERVATION)).result;
  initLangfuse();
  const attrs = { traceName: name, ...propagate };
  return propagateAttributes(attrs, () =>
    startActiveObservation(
      name,
      async (root) => {
        root.update({ input });
        const { output, result, metadata } = await fn(root);
        root.update({ output, metadata });
        return result;
      },
      { asType: 'chain' }
    )
  );
}

/** Wrap one model call as a generation (child of the active root when there is one). */
export async function withGeneration(name, { model, input, modelParameters }, call) {
  if (!langfuseEnabled()) return call();
  initLangfuse();
  return startActiveObservation(
    name,
    async (generation) => {
      generation.update({ model, input, modelParameters });
      try {
        const result = await call();
        const usage = result.raw?.usage;
        const cost = costUsd(result.model || model, usage);
        generation.update({
          model: result.model || model,
          output: result.content,
          usageDetails: usage ? { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 } : undefined,
          costDetails: cost ? { input: cost.input, output: cost.output } : undefined
        });
        return result;
      } catch (error) {
        generation.update({ level: 'ERROR', statusMessage: error.message });
        throw error;
      }
    },
    { asType: 'generation' }
  );
}

const NULL_OBSERVATION = { traceId: undefined, update() { return this; } };

export const REVIEW_REASONS = [
  'missing_control',
  'invented_control',
  'insecure_setting',
  'invalid_yaml',
  'wrong_framework',
  'wrong_decision',
  'other'
];

/** Attach a reviewer's approve/reject to the trace that produced a policy. */
export async function recordPolicyReview(traceId, approved, reason, comment) {
  const langfuse = getLangfuseClient();
  if (!langfuse || !traceId) return false;
  langfuse.score.create({ traceId, name: 'policy_approved', value: approved ? 1 : 0, dataType: 'NUMERIC', comment });
  if (!approved) {
    langfuse.score.create({
      traceId,
      name: 'policy_review_reason',
      value: REVIEW_REASONS.includes(reason) ? reason : 'other',
      dataType: 'CATEGORICAL',
      comment
    });
  }
  await langfuse.score.flush();
  return true;
}

export async function flushLangfuse() {
  await Promise.all([processor?.forceFlush(), client?.flush()]);
}

export async function shutdownLangfuse() {
  await Promise.all([processor?.shutdown(), client?.shutdown()]);
}
