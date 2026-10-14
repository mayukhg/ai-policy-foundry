import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

type Row = {
  title: string;
  file: string;
  status: string;
  durationMs: number;
  error?: string;
};

class MarkdownReport implements Reporter {
  private rows: Row[] = [];
  private startedAt = Date.now();

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startedAt = Date.now();
    this.rows = [];
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.rows.push({
      title: test.titlePath().slice(1).join(' › '),
      file: path.relative(process.cwd(), test.location.file),
      status: result.status,
      durationMs: result.duration,
      error: result.errors?.[0]?.message?.split('\n')[0],
    });
  }

  onEnd(result: FullResult) {
    const outDir = path.join(process.cwd(), 'e2e-report');
    fs.mkdirSync(outDir, { recursive: true });

    const passed = this.rows.filter((r) => r.status === 'passed').length;
    const failed = this.rows.filter((r) => r.status === 'failed').length;
    const skipped = this.rows.filter((r) => r.status === 'skipped').length;
    const timedOut = this.rows.filter((r) => r.status === 'timedOut').length;
    const total = this.rows.length;
    const elapsedSec = ((Date.now() - this.startedAt) / 1000).toFixed(1);

    const md = `# AI Policy Foundry - E2E Validation Report

**Generated:** ${new Date().toISOString()}  
**Target app:** \`${process.env.E2E_BASE_URL || 'http://localhost:8080'}\`  
**API:** \`${process.env.E2E_API_URL || 'http://localhost:3001'}\`  
**Overall status:** **${result.status.toUpperCase()}**  
**Duration:** ${elapsedSec}s  

## Summary

| Metric | Count |
|--------|------:|
| Total | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Timed out | ${timedOut} |
| Skipped | ${skipped} |
| Pass rate | ${total ? Math.round((passed / total) * 100) : 0}% |

## Results by case

| Status | Test | Duration | File | Error |
|--------|------|----------|------|-------|
${this.rows
  .map(
    (r) =>
      `| ${r.status} | ${r.title.replace(/\|/g, '\\|')} | ${(r.durationMs / 1000).toFixed(1)}s | \`${r.file}\` | ${
        r.error ? r.error.replace(/\|/g, '\\|').slice(0, 160) : ''
      } |`
  )
  .join('\n')}

## Workflow coverage

- Navigation / shell UX (header, page switch, no blank crash)
- Executive Pitch content & CTAs
- Dashboard live API stats, agents, policies, alerts
- Policy Generator form UX, generate (OpenRouter), pipeline/Rego/review controls
- Threat Intelligence list, feeds tab, policy-decision action
- Backend API regression for health, seed, policies, threats, dashboard, demo reset, review, generate

## Artifacts

- HTML report: \`e2e-report/html/index.html\`
- JSON results: \`e2e-report/results.json\`
- This file: \`e2e-report/VALIDATION_REPORT.md\`
`;

    fs.writeFileSync(path.join(outDir, 'VALIDATION_REPORT.md'), md, 'utf-8');
  }
}

export default MarkdownReport;
