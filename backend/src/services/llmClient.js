import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

/**
 * Shared OpenRouter-compatible LLM client.
 * Uses the OpenAI SDK against OpenRouter's OpenAI-compatible API.
 */

function resolveApiKey() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && !openRouterKey.includes('your-') && openRouterKey.trim()) {
    return openRouterKey.trim();
  }
  // Deprecated compat: fall back to OPENAI_API_KEY if it looks like a real key
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && !openAiKey.includes('your-openai-api-key') && openAiKey.trim()) {
    return openAiKey.trim();
  }
  return null;
}

export function isLlmConfigured() {
  return Boolean(resolveApiKey());
}

export function getDefaultModel() {
  return process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
}

let client;

function getClient() {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return null;
  }

  if (!client) {
    const baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const defaultHeaders = {};
    if (process.env.OPENROUTER_HTTP_REFERER) {
      defaultHeaders['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER;
    }
    if (process.env.OPENROUTER_APP_TITLE) {
      defaultHeaders['X-Title'] = process.env.OPENROUTER_APP_TITLE;
    }

    client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: Object.keys(defaultHeaders).length ? defaultHeaders : undefined
    });

    logger.info(`LLM client configured (OpenRouter-compatible) baseURL=${baseURL}`);
  }

  return client;
}

/**
 * Chat completion via OpenRouter.
 * @param {Object} options
 * @param {Array} options.messages
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {number} [options.max_tokens]
 * @returns {Promise<{ content: string, raw: object }>}
 */
export async function chatCompletion({
  messages,
  model,
  temperature = 0.3,
  max_tokens = 4000
} = {}) {
  const openai = getClient();
  if (!openai) {
    const err = new Error('LLM not configured: set OPENROUTER_API_KEY in backend/.env');
    err.code = 'LLM_NOT_CONFIGURED';
    throw err;
  }

  const selectedModel = model || getDefaultModel();

  const completion = await openai.chat.completions.create({
    model: selectedModel,
    messages,
    temperature,
    max_tokens
  });

  const content = completion.choices?.[0]?.message?.content || '';
  return { content, raw: completion, model: selectedModel };
}

export default {
  chatCompletion,
  isLlmConfigured,
  getDefaultModel
};
