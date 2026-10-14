/**
 * Unit fixture test: StructuralDeltaExtractor on synth manual v1 → v2.
 * Run: node --test src/services/StructuralDeltaExtractor.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractChangePackage,
  summarizeChangePackage,
  LLM_PACKAGE_MAX_CHARS
} from './StructuralDeltaExtractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/documents.json'), 'utf8')
);

const family = fixtures.families.find((f) => f.familyId === 'synth-doc-family-cloud-manual');
const v1 = family.versions.find((v) => v.id === 'synth-doc-manual-v1');
const v2 = family.versions.find((v) => v.id === 'synth-doc-manual-v2');

function toDoc(version) {
  return {
    id: version.id,
    familyId: family.familyId,
    version: version.version,
    content: {
      rawText: version.text,
      structured: {
        risks: version.extracted.risks,
        controls: version.extracted.controls,
        requirements: version.extracted.requirements
      }
    }
  };
}

function toPrevious(version) {
  return {
    id: version.id,
    version: version.version,
    text: version.text,
    extracted: version.extracted
  };
}

describe('StructuralDeltaExtractor', () => {
  it('baseline mode for first version (no prior)', () => {
    const pkg = extractChangePackage(toDoc(v1), null);
    assert.equal(pkg.mode, 'baseline');
    assert.equal(pkg.hasDelta, false);
    assert.ok(pkg.addedControls.some((c) => c.id === 'CTRL-ENC-01'));
    assert.ok(pkg.packageChars <= LLM_PACKAGE_MAX_CHARS);
  });

  it('delta mode v1→v2 adds CTRL-ENC-03, CTRL-IAM-03, CTRL-MON-02, CTRL-NET-01', () => {
    const pkg = extractChangePackage(toDoc(v2), toPrevious(v1));
    assert.equal(pkg.mode, 'delta');
    assert.equal(pkg.hasDelta, true);
    assert.equal(pkg.previousDocumentId, 'synth-doc-manual-v1');

    const addedIds = pkg.addedControls.map((c) => c.id);
    assert.ok(addedIds.includes('CTRL-ENC-03'), `missing CTRL-ENC-03 in ${addedIds}`);
    assert.ok(addedIds.includes('CTRL-IAM-03'), `missing CTRL-IAM-03 in ${addedIds}`);
    assert.ok(addedIds.includes('CTRL-MON-02'), `missing CTRL-MON-02 in ${addedIds}`);
    assert.ok(addedIds.includes('CTRL-NET-01'), `missing CTRL-NET-01 in ${addedIds}`);

    const addedRiskIds = pkg.addedRisks.map((r) => r.id);
    assert.ok(addedRiskIds.includes('R4'));

    assert.ok(pkg.packageChars <= LLM_PACKAGE_MAX_CHARS);
    assert.ok((pkg.stats?.tokenEstimate || 0) > 0);

    const summary = summarizeChangePackage(pkg);
    assert.equal(summary.mode, 'delta');
    assert.ok(summary.addedControls >= 4);
  });

  it('stable inventory keeps shared control IDs without prose dump', () => {
    const pkg = extractChangePackage(toDoc(v2), toPrevious(v1));
    assert.ok(pkg.stableInventory?.controlIds?.includes('CTRL-ENC-01'));
    assert.ok(pkg.stableInventory?.controlIds?.includes('CTRL-IAM-01'));
    const serialized = JSON.stringify(pkg);
    assert.equal(serialized.includes('fullText'), false);
    assert.ok(serialized.length <= LLM_PACKAGE_MAX_CHARS + 50);
  });
});
