/**
 * Arize Phoenix / OpenTelemetry tracing bootstrap.
 * Must be initialized before any OpenAI client is constructed.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { OpenAIInstrumentation } from '@arizeai/openinference-instrumentation-openai';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

let initialized = false;
let provider = null;

function parseClientHeaders(raw = '') {
  const headers = {};
  const trimmed = String(raw || '').trim();
  if (!trimmed) return headers;

  // Supports: api_key=xxx  OR  Authorization=Bearer xxx  OR  comma-separated pairs
  for (const part of trimmed.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    if (key === 'api_key') {
      headers.Authorization = `Bearer ${value}`;
      headers.api_key = value;
    } else {
      headers[key] = value;
    }
  }
  return headers;
}

function resolveCollectorTracesUrl() {
  const endpoint =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:6006';
  const base = endpoint.replace(/\/$/, '');
  if (base.endsWith('/v1/traces')) return base;
  return `${base}/v1/traces`;
}

/**
 * Initialize OpenTelemetry + OpenInference OpenAI instrumentation for Phoenix.
 * Safe to call multiple times (no-ops after first success).
 */
export function initTracing({ force = false } = {}) {
  if (initialized && !force) {
    return { initialized: true, projectName: process.env.PHOENIX_PROJECT_NAME };
  }

  if (process.env.PHOENIX_TRACING_ENABLED === 'false') {
    logger.info('Phoenix tracing disabled (PHOENIX_TRACING_ENABLED=false)');
    return { initialized: false, disabled: true };
  }

  const projectName = process.env.PHOENIX_PROJECT_NAME || 'ai-policy-foundry';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'ai-policy-foundry-backend';
  const tracesUrl = resolveCollectorTracesUrl();
  const headers = parseClientHeaders(process.env.PHOENIX_CLIENT_HEADERS);

  if (process.env.PHOENIX_OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const exporter = new OTLPTraceExporter({
    url: tracesUrl,
    headers: Object.keys(headers).length ? headers : undefined
  });

  const useBatch = process.env.PHOENIX_SPAN_PROCESSOR !== 'simple';
  const processor = useBatch
    ? new BatchSpanProcessor(exporter)
    : new SimpleSpanProcessor(exporter);

  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_PROJECT_NAME]: projectName,
      'deployment.environment': process.env.NODE_ENV || 'development'
    }),
    spanProcessors: [processor]
  });

  provider.register();

  const openaiInstrumentation = new OpenAIInstrumentation();
  // Ensure the OpenAI module used by llmClient is patched even with ESM dual instances
  openaiInstrumentation.manuallyInstrument(OpenAI);

  registerInstrumentations({
    instrumentations: [openaiInstrumentation]
  });

  initialized = true;
  logger.info(
    `Phoenix tracing initialized project=${projectName} exporter=${tracesUrl}`
  );

  return { initialized: true, projectName, tracesUrl, serviceName };
}

export async function shutdownTracing() {
  if (provider) {
    await provider.shutdown();
    provider = null;
    initialized = false;
  }
}

export function isTracingInitialized() {
  return initialized;
}

export default { initTracing, shutdownTracing, isTracingInitialized };
