/**
 * Records a silent PM walkthrough of the dark workflow mockup with
 * burned-in subtitle overlay (hardsubs in the video pixels — no separate SRT).
 */
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mockup = path.join(root, 'ai-policy-foundry-workflows-dark.html');
const outDir = path.join(__dirname, 'raw-recording');
const url = pathToFileURL(mockup).href;

/** Caption cues burned into the recording (seconds). */
const CUES = [
  {
    "start": 0.0,
    "end": 8.0,
    "text": "Customer pain: cloud releases ship weekly \u2014\nsecurity policies still take weeks to write."
  },
  {
    "start": 8.0,
    "end": 16.0,
    "text": "Insight: the gap isn't more templates \u2014\nit's an assembly line that keeps pace with change."
  },
  {
    "start": 16.0,
    "end": 24.0,
    "text": "Product: AI Policy Foundry \u2014\nfrom executive buy-in to threat-driven policy decisions."
  },
  {
    "start": 24.0,
    "end": 32.0,
    "text": "We start where sponsors live: the Executive Pitch \u2014\npain, value, and a clear ask for a demo."
  },
  {
    "start": 32.0,
    "end": 42.0,
    "text": "PM framing: quantify the risk \u2014\n70% time reduction, under 24h drafts, 94% compliance target."
  },
  {
    "start": 42.0,
    "end": 52.0,
    "text": "Outcome for leadership: faster coverage,\nlower cyber exposure, engineers back on strategy."
  },
  {
    "start": 52.0,
    "end": 62.0,
    "text": "Operations home: the Dashboard.\nOne view for policies, reviews, threats, and agent health."
  },
  {
    "start": 62.0,
    "end": 72.0,
    "text": "Product decision: surface pending reviews and threat\ndetections so owners know what needs action today."
  },
  {
    "start": 72.0,
    "end": 82.0,
    "text": "Quick actions encode the happy path \u2014\ngenerate, review, report, upload context."
  },
  {
    "start": 82.0,
    "end": 92.0,
    "text": "Next journey: bring the customer's own risk language\ninto the product \u2014 Document Ingest."
  },
  {
    "start": 92.0,
    "end": 102.0,
    "text": "Job-to-be-done: \"Generate policies that match\nOUR controls, not a generic CIS dump.\""
  },
  {
    "start": 102.0,
    "end": 115.0,
    "text": "Upload parses risks, controls, requirements.\nVersion 2 vs v1 \u2192 extraction mode: delta."
  },
  {
    "start": 115.0,
    "end": 128.0,
    "text": "Key PM insight: don't stuff 100-page manuals into the LLM.\nFilter first. Reason over what changed."
  },
  {
    "start": 128.0,
    "end": 140.0,
    "text": "Configure & Generate: service, environment,\nframework, and optional document context."
  },
  {
    "start": 140.0,
    "end": 152.0,
    "text": "Prioritization choice: multi-cloud + frameworks\nusers already audit against \u2014 CIS, NIST, ISO, SOC 2."
  },
  {
    "start": 152.0,
    "end": 165.0,
    "text": "Generate kicks the assembly line \u2014\ndeterministic filter, then policy, compliance, security."
  },
  {
    "start": 165.0,
    "end": 180.0,
    "text": "Targeted Extraction Pipeline: product differentiator.\nChangePackage \u2264 6k chars. Full text omitted."
  },
  {
    "start": 180.0,
    "end": 194.0,
    "text": "Observability for trust: mode, added controls,\npackage size, latency \u2014 so PMs and SecOps can audit."
  },
  {
    "start": 194.0,
    "end": 208.0,
    "text": "Baseline vs delta: first upload gets structure;\nupdates only send the diff. Lower cost, higher focus."
  },
  {
    "start": 208.0,
    "end": 222.0,
    "text": "Review & Export: YAML, JSON, Rego, Terraform \u2014\nmeet engineers where they ship controls."
  },
  {
    "start": 222.0,
    "end": 234.0,
    "text": "Inline edit + PDF/DOCX export \u2014\nhandoff to GRC without leaving the flow."
  },
  {
    "start": 234.0,
    "end": 248.0,
    "text": "Governance workflow: draft \u2192 submit \u2192 approve / reject.\nHuman-in-the-loop by design, not as an afterthought."
  },
  {
    "start": 248.0,
    "end": 260.0,
    "text": "PM requirement: audit trail of review actions \u2014\nwho decided, when, and why."
  },
  {
    "start": 260.0,
    "end": 274.0,
    "text": "Feedback & Traceability: close the learning loop\nand prove which control IDs drove each policy block."
  },
  {
    "start": 274.0,
    "end": 286.0,
    "text": "For auditors: source document + control mapping.\nFor the product: ratings that improve future drafts."
  },
  {
    "start": 286.0,
    "end": 300.0,
    "text": "Threat Intelligence: policies must react to new risks \u2014\nnot wait for the next quarterly rewrite."
  },
  {
    "start": 300.0,
    "end": 314.0,
    "text": "Feeds, severity, and open decisions \u2014\noperationalize \"what changed in the threat landscape?\""
  },
  {
    "start": 314.0,
    "end": 330.0,
    "text": "Threat \u2192 Policy Decision: create new vs tweak existing.\nRecommendation + confidence \u2014 decision support, not autopilot."
  },
  {
    "start": 330.0,
    "end": 344.0,
    "text": "Product principle: reduce duplicate policies.\nTweak when coverage is close; create when the gap is real."
  },
  {
    "start": 344.0,
    "end": 358.0,
    "text": "Compliance & Agents: frameworks, drift signals,\nand the multi-agent line that makes the promise real."
  },
  {
    "start": 358.0,
    "end": 372.0,
    "text": "Outcome: pain (policy lag) \u2192 insight (target change) \u2192\nsolution (extraction + agents) \u2192 governed delivery."
  },
  {
    "start": 372.0,
    "end": 388.0,
    "text": "AI Policy Foundry: from executive story to threat-driven\npolicy \u2014 built around the customer's control language."
  },
  {
    "start": 388.0,
    "end": 400.0,
    "text": "End of walkthrough. Ready for live Q&A on roadmap,\nmetrics, and discovery behind these bets."
  }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function go(page, screen) {
  await page.locator(`.nav-btn[data-screen="${screen}"]`).click();
  await page.waitForSelector(`#screen-${screen}.active`, { timeout: 10_000 });
}

async function installSubtitleOverlay(page, cues) {
  await page.addStyleTag({
    content: `
      #pm-sub-bar {
        position: fixed;
        left: 50%;
        bottom: 28px;
        transform: translateX(-50%);
        z-index: 99999;
        width: min(920px, calc(100vw - 48px));
        pointer-events: none;
        text-align: center;
      }
      #pm-sub-bar .box {
        display: inline-block;
        max-width: 100%;
        background: rgba(0, 0, 0, 0.82);
        border: 1px solid rgba(255,255,255,0.18);
        color: #ffffff;
        font-family: "DM Sans", Arial, sans-serif;
        font-size: 20px;
        font-weight: 650;
        line-height: 1.35;
        letter-spacing: 0.01em;
        padding: 12px 18px;
        border-radius: 12px;
        white-space: pre-line;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      }
      #pm-sub-bar.hidden-sub .box { visibility: hidden; }
    `
  });

  await page.evaluate((cueData) => {
    const bar = document.createElement('div');
    bar.id = 'pm-sub-bar';
    bar.innerHTML = '<div class="box"></div>';
    document.body.appendChild(bar);
    const box = bar.querySelector('.box');
    window.__pmCues = cueData;
    window.__pmStart = performance.now();
    window.__pmTimer = setInterval(() => {
      const t = (performance.now() - window.__pmStart) / 1000;
      const cue = window.__pmCues.find((c) => t >= c.start && t < c.end);
      if (cue) {
        bar.classList.remove('hidden-sub');
        box.textContent = cue.text;
      } else {
        bar.classList.add('hidden-sub');
        box.textContent = '';
      }
    }, 100);
  }, cues);
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: outDir,
      size: { width: 1440, height: 900 }
    }
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector('#screen-map.active');
  await installSubtitleOverlay(page, CUES);
  await page.evaluate(() => { window.__pmStart = performance.now(); });

  await sleep(24_000);
  await go(page, 'executive');
  await sleep(14_000);
  await page.getByRole('button', { name: 'Request executive demo' }).click();
  await sleep(14_000);
  await go(page, 'dashboard');
  await sleep(30_000);
  await go(page, 'upload');
  await sleep(12_000);
  await page.locator('#fake-upload').click();
  await page.waitForSelector('#upload-done:not(.hidden)');
  await sleep(34_000);
  await go(page, 'configure');
  await sleep(24_000);
  await page.locator('#run-generate').click();
  await page.waitForSelector('#screen-pipeline.active');
  await sleep(58_000);
  await page.locator('#show-baseline').click();
  await sleep(8_000);
  await page.locator('#show-delta').click();
  await sleep(10_000);
  await go(page, 'output');
  await sleep(10_000);
  await page.locator('.tab[data-tab="rego"]').click();
  await sleep(8_000);
  await page.locator('.tab[data-tab="yaml"]').click();
  await sleep(8_000);
  await go(page, 'governance');
  await sleep(10_000);
  await page.locator('[data-review="submit"]').click();
  await sleep(8_000);
  await page.locator('[data-review="approve"]').click();
  await sleep(8_000);
  await go(page, 'feedback');
  await sleep(26_000);
  await go(page, 'threats');
  await sleep(28_000);
  await go(page, 'decision');
  await sleep(30_000);
  await go(page, 'compliance');
  await sleep(28_000);
  await go(page, 'map');
  await sleep(28_000);

  await context.close();
  await browser.close();

  const videos = fs.readdirSync(outDir).filter((f) => f.endsWith('.webm'));
  if (!videos.length) throw new Error('No video recorded');
  const src = path.join(outDir, videos[0]);
  const dest = path.join(__dirname, 'walkthrough-raw.webm');
  fs.renameSync(src, dest);
  console.log(JSON.stringify({ ok: true, video: dest, cues: CUES.length, hardsubs: true }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
