# Mixpanel Synthetic Dataset (AI Policy Foundry)

Deterministic synthetic events/users covering every Mixpanel-recommended event and metric for this product.

## Regenerate

```bash
cd backend
npm run mixpanel:seed
```

Outputs land in `datasets/`:

| File | Purpose |
|---|---|
| `events.json` / `events.jsonl` | Mixpanel `/import`-ready events (`time`, `distinct_id`, `$insert_id`) |
| `users.json` | People profiles (`plan`, persona, signup props) |
| `metric-coverage.json` | Computed KPI snapshots + adequacy checks |
| `meta.json` | Window, seed, counts |
| `mixpanel-synthetic-bundle.json` | Small sample for docs/demos |

## Design

- **120 users**, **12 weeks** ending `2026-10-14`
- Personas create realistic funnel drop-off, AI success/failure mix, and weekly retention variance
- Domain props match the product: services (AWS/Azure/GCP), compliance frameworks, export formats (PDF/Word/YAML/Rego), extraction modes (`baseline`/`delta`)
- **`AI Suggestion Shown`** is included (beyond the original Mixpanel list) so **AI Acceptance Rate** has a proper denominator

## Tracking plan

See `tracking-plan.json` for the full event catalog and metric definitions.
