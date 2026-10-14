/**
 * Generate Mixpanel-ready synthetic analytics dataset + coverage report.
 *
 * Usage:
 *   node scripts/seed-mixpanel-synthetic.js
 *   npm run mixpanel:seed
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMixpanelDataset } from '../src/analytics/mixpanel/generateMixpanelDataset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '../src/analytics/mixpanel/datasets');

mkdirSync(outDir, { recursive: true });

const dataset = generateMixpanelDataset();

writeFileSync(
  path.join(outDir, 'events.json'),
  JSON.stringify(dataset.events, null, 2)
);
writeFileSync(
  path.join(outDir, 'events.jsonl'),
  dataset.events.map((e) => JSON.stringify(e)).join('\n') + '\n'
);
writeFileSync(
  path.join(outDir, 'users.json'),
  JSON.stringify(dataset.users, null, 2)
);
writeFileSync(
  path.join(outDir, 'meta.json'),
  JSON.stringify(dataset.meta, null, 2)
);
writeFileSync(
  path.join(outDir, 'metric-coverage.json'),
  JSON.stringify(dataset.coverage, null, 2)
);

// Compact bundle for demos / API fixtures
writeFileSync(
  path.join(outDir, 'mixpanel-synthetic-bundle.json'),
  JSON.stringify(
    {
      meta: dataset.meta,
      coverage: dataset.coverage,
      sample_events: dataset.events.slice(0, 25),
      users_sample: dataset.users.slice(0, 10)
    },
    null,
    2
  )
);

const { coverage, meta } = dataset;
console.log('Mixpanel synthetic dataset written to', outDir);
console.log(
  JSON.stringify(
    {
      users: meta.user_count,
      events: meta.event_count,
      window: `${meta.dataset_start} → ${meta.dataset_end}`,
      all_metrics_adequate: coverage.all_metrics_adequate,
      event_counts: coverage.event_counts,
      metric_snapshots: coverage.adequacy.map((a) => ({
        metric: a.name,
        adequate: a.adequate,
        snapshot: a.snapshot
      }))
    },
    null,
    2
  )
);

if (!coverage.all_metrics_adequate) {
  console.error('WARNING: one or more metrics lack adequate coverage');
  process.exitCode = 1;
}
