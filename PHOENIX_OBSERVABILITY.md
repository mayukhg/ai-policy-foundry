# Arize Phoenix Observability & Eval

For **why the eval framework exists, which suites/evaluators were chosen, and stakeholder benefits**, see **[EVAL_FRAMEWORK.md](./EVAL_FRAMEWORK.md)**. This page covers tracing/ops wiring.

## Stack

| Layer | Choice |
|---|---|
| App language | Node.js (ESM) — `backend/` |
| LLM SDK | OpenAI Node SDK v4 → OpenRouter |
| Instrumentation | `@arizeai/openinference-instrumentation-openai` |
| Export | OTLP/HTTP protobuf → Phoenix `/v1/traces` |
| Default collector | `http://localhost:6006` |

## What was added

- `backend/src/observability/tracer.js` — TracerProvider + OpenAI instrumentor
- Bootstrap in `backend/src/index.js` (tracing before agents)
- Synthetic eval datasets in `backend/src/evaluation/phoenix-datasets/`
- `PhoenixEvalService` + CLI scripts `phoenix:seed` / `phoenix:eval`
- API: `GET /api/evaluation/phoenix/status`, `POST /api/evaluation/phoenix/run`

## Environment

See `backend/env.example` and root `.env.example`. Required for local:

```env
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
PHOENIX_PROJECT_NAME=ai-policy-foundry
PHOENIX_CLIENT_HEADERS=
PHOENIX_TRACING_ENABLED=true
```

## Commands

```bash
cd backend
npm run phoenix:seed
npm run phoenix:eval:offline   # no live LLM
npm run phoenix:eval           # includes OpenRouter spans
```

Open the Phoenix UI at http://localhost:6006 and select project **ai-policy-foundry**.
