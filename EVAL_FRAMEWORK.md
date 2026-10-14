# AI Policy Foundry — Evaluation Framework

This document explains **why** we built an evaluation framework for AI Policy Foundry, **which evals we chose and why**, and **what benefits** those evals provide for product quality, security trust, and operational readiness. It complements the Phoenix wiring guide in [PHOENIX_OBSERVABILITY.md](./PHOENIX_OBSERVABILITY.md).

---

## 1. Why an eval framework?

### The product problem

AI Policy Foundry turns organizational risk/control documents into deployable security policies (YAML/Rego) via a multi-agent pipeline. Failures are not cosmetic:

| Failure mode | Business impact |
|---|---|
| Policy ignores customer controls | Audit gaps, false sense of compliance |
| LLM invents controls / pages not in the manual | Hallucinated “compliance” → real risk |
| Full manuals stuffed into prompts | Cost, latency, “lost in the middle,” unstable outputs |
| Wrong create-vs-tweak on threats | Policy sprawl or missed remediation |
| Slow / flaky generation | SecOps won’t adopt the tool |

Manual spot-checks do not scale across agents, cloud services, frameworks, or document versions.

### What “eval” means here

We treat evaluation as a **product quality system**, not a one-off test script:

1. **Synthetic golden datasets** — fixed inputs with expected attributes (control IDs, modes, budgets).
2. **Deterministic scorers** — fast, explainable pass/fail (grounding, package size, no `fullText`, decision validity).
3. **Optional live LLM runs** — same cases against OpenRouter when you want real generation spans.
4. **Observability hookup** — every example emits OpenTelemetry spans to **Arize Phoenix** so scores, latency, and traces live in one place.

### Design principles

| Principle | How we apply it |
|---|---|
| Eval what the customer pays for | Control grounding, delta correctness, governance-ready structure |
| Prefer measurable contracts | ChangePackage ≤ 6k chars, `baseline`/`delta` mode, no full-text leak |
| Separate offline vs online | `--no-llm` for CI/regression; live LLM for release confidence |
| Keep scores interpretable | Named evaluators with details (`missing=CTRL-…`, `chars=3194`) |
| Align with architecture | Suites map to Phase-1 extraction, Phase-2 policy write, threat decisions |

---

## 2. Architecture (how it fits)

```
Synthetic fixtures (documents v1/v2, policies, threats)
        │
        ▼
phoenix-datasets/*.json  ──►  PhoenixEvalService.run*
        │                           │
        │                           ├─► deterministic checks
        │                           └─► optional agentManager / chatCompletion
        │
        ▼
OpenTelemetry spans (eval.dataset / eval.example + scores)
        │
        ▼
Arize Phoenix UI  (project: ai-policy-foundry)
```

| Component | Role |
|---|---|
| `backend/src/evaluation/phoenix-datasets/` | Synthetic golden cases (3 suites, 9 examples) |
| `backend/src/evaluation/PhoenixEvalService.js` | Load → execute → score → span |
| `backend/src/observability/tracer.js` | OpenInference + OTLP export to Phoenix |
| `npm run phoenix:seed` / `phoenix:eval` | CLI entry points |
| `GET/POST /api/evaluation/phoenix/*` | Runtime catalog + trigger runs |
| App seed (`seedSynthetic.js`) | Same `synth-doc-manual-v*` docs the evals reference |

Related (legacy, broader agent harness): `EvaluationHarness.js` — accuracy/latency/hallucination loops. The **Phoenix eval framework** is the product-aligned, dataset-driven layer described in this doc.

---

## 3. What evals were chosen — and why

We organized evals into **three suites** that mirror the highest-risk product journeys.

### Suite A — `extraction-pipeline-eval` (Phase 1)

**Product question:** *Did we extract the right change package without stuffing the full manual?*

| Example | Focus | Why it matters |
|---|---|---|
| `ext-eval-001` | v1→v2 **delta** adds CTRL-ENC-03, CTRL-IAM-03, CTRL-MON-02, CTRL-NET-01 | Delta correctness is the core differentiator vs brute-force prompting |
| `ext-eval-002` | **baseline** on first version | First upload must still produce structured inventory, not empty context |
| `ext-eval-003` | `buildContextSummary` has `changePackage`, no `fullText` | Guards the LLM-bound context contract for Phase 2 |

**Evaluators used:** `mode_match`, `control_adds`, `package_budget`, `no_fulltext_leak`

**Why these evaluators (not BLEU/ROUGE on prose):**  
Extraction quality is a **structural contract**. Matching control IDs and package size is more reliable and more actionable for SecOps than fuzzy text similarity.

---

### Suite B — `policy-generation-eval` (Phase 2)

**Product question:** *Does the generated policy ground in the customer’s controls and cover required sections within latency?*

| Example | Cloud / mode | Expected grounding |
|---|---|---|
| `pg-eval-001` | AWS S3 · delta (v2) | CTRL-IAM-03, CTRL-ENC-03 · encryption + access |
| `pg-eval-002` | Azure Storage · baseline (v1) | CTRL-MON-01, CTRL-ENC-01 · monitoring + encryption |
| `pg-eval-003` | GCP Cloud Storage · delta | CTRL-NET-01 · network · no fullText leak |

**Evaluators used:** `control_grounding`, `structure_presence`, `latency_budget`, `no_fulltext_leak`

**Why these evaluators:**

| Evaluator | Why chosen |
|---|---|
| **control_grounding** | Direct proxy for “uses OUR risk language,” the #1 customer JTBD |
| **structure_presence** | Policies must be shippable artifacts (encryption/access/network…), not free-form essays |
| **latency_budget** | Adoption constraint for interactive SecOps workflows (~45s budget in fixtures) |
| **no_fulltext_leak** | Regression guard for the targeted-extraction architecture |

We **did not** start with LLM-as-judge as the primary scorer: it is slower, non-deterministic, and harder to explain in audits. Grounding + structure give a clearer release gate; LLM-as-judge can be layered later for nuance.

---

### Suite C — `threat-policy-decision-eval` (Threat → policy)

**Product question:** *Given a threat and existing policies, do we recommend create-new vs tweak-existing appropriately?*

| Example | Scenario | Preferred action |
|---|---|---|
| `tpd-eval-001` | Public bucket · existing S3 policy missing CTRL-IAM-03 | **tweak_existing** |
| `tpd-eval-002` | Unrestricted egress · **no** existing policy | **create_new** |
| `tpd-eval-003` | SIEM lag · existing policy has MON-01 only | **tweak_existing** (add MON-02) |

**Evaluators used:** `decision_validity`, `confidence_floor`, `control_grounding`, `latency_budget`

**Why these evaluators:**  
This flow is a **decision product**. Scoring action validity and confidence floors prevents silent wrong automation. Preferring tweak when coverage is close encodes the PM principle of reducing policy sprawl.

---

## 4. Evaluator catalog (benefits)

| Evaluator | What it checks | Primary benefit |
|---|---|---|
| `mode_match` | `baseline` vs `delta` | Protects versioning semantics |
| `control_adds` | Expected control IDs appear in addedControls | Catches broken delta extraction |
| `package_budget` | `packageChars` ≤ 6000 | Enforces cost/latency/attention budget |
| `no_fulltext_leak` | No `fullText` in LLM-bound payloads | Prevents regression to prompt stuffing |
| `control_grounding` | Output mentions required control IDs | Customer-fidelity / auditability |
| `structure_presence` | Required policy sections present | Production-readiness of artifacts |
| `latency_budget` | Wall-clock under threshold | UX / SLOs for interactive use |
| `decision_validity` | Action ∈ allowed set / preferred | Correct remediation routing |
| `confidence_floor` | Confidence ≥ minimum | Filters low-trust recommendations |
| `has_change_package` | `changePackage` present on context | Pipeline integrity |

### Benefits by stakeholder

| Stakeholder | Benefit |
|---|---|
| **Product / PM** | Measurable gates for “does this release still solve the pain?” |
| **Security / GRC** | Evidence that outputs ground in control IDs, not vibes |
| **Engineering** | Fast offline suite for PRs; Phoenix traces for live LLM debugging |
| **Customers / demos** | Credible story: we evaluate grounding, deltas, and decisions continuously |

---

## 5. Synthetic data strategy

We reuse the same synthetic universe as the app demo seed so evals and UX stay aligned:

| Asset | Role in eval |
|---|---|
| `synth-doc-manual-v1` | Baseline extraction + Azure policy case |
| `synth-doc-manual-v2` | Delta extraction + AWS/GCP policy cases |
| Control IDs (CTRL-ENC-03, CTRL-IAM-03, …) | Golden labels for grounding / adds |
| Threat scenarios (public bucket, egress, SIEM) | Decision-suite inputs |

Datasets are versioned JSON under:

`backend/src/evaluation/phoenix-datasets/`

Seeding writes a catalog snapshot to:

`backend/evaluation-results/phoenix/dataset-catalog.json`

---

## 6. How to run

```bash
cd backend

# Load catalog, confirm ChangePackages, AND upload suites into Phoenix Datasets UI
npm run phoenix:seed

# Offline: deterministic extraction + mocked LLM outputs (CI-friendly)
npm run phoenix:eval:offline

# Online: real OpenRouter calls (LLM spans appear in Phoenix)
npm run phoenix:eval
```

After `phoenix:seed`, refresh **http://localhost:6006/datasets** — you should see:

- `extraction-pipeline-eval` (3 examples)
- `policy-generation-eval` (3 examples)
- `threat-policy-decision-eval` (3 examples)

Local JSON alone does **not** appear in that UI until uploaded via `/v1/datasets/upload` (what `phoenix:seed` now does).

API (auth: `Bearer demo-token` in local demo mode):

- `GET /api/evaluation/phoenix/status` — tracing status + dataset catalog  
- `POST /api/evaluation/phoenix/run` — `{ "includeLlm": false, "dataset": "extraction-pipeline-eval" }`

Phoenix UI: http://localhost:6006 → project **`ai-policy-foundry`**.

---

## 7. Interpreting results

Each example returns:

- `passed` — all attached evaluators passed  
- `score` — mean of evaluator scores (0–1)  
- `evaluations[]` — per-check `name`, `passed`, `score`, `detail`  
- OTEL attributes — `eval.score`, `eval.*.label`, latency, truncated input/output  

Release heuristic we recommend:

1. **Must pass offline** `extraction-pipeline-eval` (100%) before merging extraction changes.  
2. **Must pass offline** full suite before demo day.  
3. Run **online** `policy-generation-eval` before claiming LLM quality improvements.

---

## 8. Out of scope (today) / next layers

| Not primary today | Possible next step |
|---|---|
| LLM-as-judge as sole gate | Add as secondary scorer for reasoning quality |
| Full RAG retrieval evals | Only if vector retrieval is introduced |
| Human preference collection UI | Wire feedback ratings into Phoenix annotations |
| Multi-lingual / multi-industry corpora | Expand synthetic families beyond cloud manual |

---

## 9. File map

| Path | Purpose |
|---|---|
| `backend/src/evaluation/phoenix-datasets/*.json` | Synthetic golden datasets |
| `backend/src/evaluation/PhoenixEvalService.js` | Runner + scorers + spans |
| `backend/scripts/seed-phoenix-eval.js` | Seed / catalog |
| `backend/scripts/run-phoenix-eval.js` | CLI eval runner |
| `backend/src/routes/evaluation.js` | Phoenix HTTP endpoints |
| `backend/src/observability/tracer.js` | Phoenix OTLP tracing |
| [PHOENIX_OBSERVABILITY.md](./PHOENIX_OBSERVABILITY.md) | Install / env / tracing ops |
| [TARGETED_EXTRACTION_PIPELINE.md](./TARGETED_EXTRACTION_PIPELINE.md) | Architecture under test |

---

## 10. Summary

We built this eval framework because **policy AI that cannot prove control grounding and delta discipline is a liability**.  

We chose **extraction**, **policy grounding/structure/latency**, and **threat create-vs-tweak** suites because they map directly to customer pain and to our Phase-1/Phase-2 architecture.  

The benefits are **auditable quality gates**, **regression protection against full-text stuffing**, **faster engineering feedback**, and **Phoenix-visible traces** that make LLM behavior debuggable for product and security stakeholders alike.
