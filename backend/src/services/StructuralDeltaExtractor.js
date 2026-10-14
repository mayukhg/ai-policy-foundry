/**
 * Phase 1 — Deterministic structural filter.
 * Produces a bounded ChangePackage without LLM calls.
 */

export const LLM_PACKAGE_MAX_CHARS = 6000;
export const RAW_EXCERPTS_MAX_CHARS = 4000;
const SNIPPET_MAX = 280;

function estimateTokens(text = '') {
  return Math.ceil(String(text).length / 4);
}

function entityKey(item) {
  return item?.id || item?.description || item?.text || JSON.stringify(item);
}

function entityDesc(item) {
  return item?.description || item?.text || '';
}

function normalizeEntities(list = []) {
  return list.map((item) => ({
    id: item.id || null,
    description: entityDesc(item).slice(0, 240),
    section: item.section || null
  }));
}

/**
 * Split raw text into heading-keyed sections.
 */
export function splitSections(rawText = '') {
  const lines = String(rawText).split(/\r?\n/);
  const sections = [];
  let current = { heading: 'PREAMBLE', lines: [] };

  const isHeading = (line) => {
    const t = line.trim();
    if (!t) return false;
    if (/^#{1,6}\s+\S/.test(t)) return true;
    if (/^Section\s+\d+/i.test(t)) return true;
    if (/^[A-Z0-9][A-Z0-9\s\-&/:]{8,}$/.test(t) && t.length < 80) return true;
    return false;
  };

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.lines.length || current.heading !== 'PREAMBLE') {
        sections.push({
          heading: current.heading,
          text: current.lines.join('\n').trim()
        });
      }
      current = { heading: line.trim().replace(/^#+\s*/, ''), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push({
    heading: current.heading,
    text: current.lines.join('\n').trim()
  });
  return sections.filter((s) => s.text || s.heading !== 'PREAMBLE');
}

function diffEntityLists(prevList = [], currList = []) {
  const prevMap = new Map(prevList.map((e) => [entityKey(e), e]));
  const currMap = new Map(currList.map((e) => [entityKey(e), e]));
  const added = [];
  const removed = [];

  for (const [key, item] of currMap) {
    if (!prevMap.has(key)) added.push(item);
  }
  for (const [key, item] of prevMap) {
    if (!currMap.has(key)) removed.push(item);
  }
  return { added: normalizeEntities(added), removed: normalizeEntities(removed) };
}

function snippet(text = '', max = SNIPPET_MAX) {
  const t = String(text).trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function trimPackage(pkg) {
  let serialized = JSON.stringify(pkg);
  if (serialized.length <= LLM_PACKAGE_MAX_CHARS) {
    return { ...pkg, packageChars: serialized.length };
  }

  // Progressive trim: shorten snippets, then drop oldest changed sections
  const trimmed = { ...pkg, changedSections: [...(pkg.changedSections || [])] };
  while (JSON.stringify(trimmed).length > LLM_PACKAGE_MAX_CHARS && trimmed.changedSections.length) {
    const last = trimmed.changedSections[trimmed.changedSections.length - 1];
    if ((last.afterSnippet || '').length > 80) {
      last.afterSnippet = snippet(last.afterSnippet, 80);
      if (last.beforeSnippet) last.beforeSnippet = snippet(last.beforeSnippet, 80);
    } else {
      trimmed.changedSections.pop();
    }
  }

  const lists = ['addedControls', 'removedControls', 'addedRisks', 'removedRisks', 'addedRequirements'];
  for (const key of lists) {
    while (JSON.stringify(trimmed).length > LLM_PACKAGE_MAX_CHARS && (trimmed[key] || []).length > 3) {
      trimmed[key] = trimmed[key].slice(0, -1);
    }
  }

  serialized = JSON.stringify(trimmed);
  return {
    ...trimmed,
    packageChars: serialized.length,
    truncated: serialized.length > LLM_PACKAGE_MAX_CHARS || pkg.changedSections?.length !== trimmed.changedSections?.length
  };
}

/**
 * Build a baseline ChangePackage (first version — structured only, no body dump).
 */
export function buildBaselinePackage({ documentId, familyId, structured = {}, rawText = '' }) {
  const sections = splitSections(rawText).map((s) => ({
    heading: s.heading,
    afterSnippet: snippet(s.text, 120),
    changeType: 'baseline'
  }));

  const controls = normalizeEntities(structured.controls || []);
  const risks = normalizeEntities(structured.risks || []);
  const requirements = normalizeEntities(structured.requirements || []);

  const pkg = {
    documentId,
    familyId,
    mode: 'baseline',
    hasDelta: false,
    stats: {
      prevChars: 0,
      currChars: rawText.length,
      addedLines: rawText.split(/\n/).filter(Boolean).length,
      removedLines: 0,
      tokenEstimate: estimateTokens(JSON.stringify({ controls, risks, requirements, sections }))
    },
    addedControls: controls,
    removedControls: [],
    addedRisks: risks,
    removedRisks: [],
    addedRequirements: requirements,
    changedSections: sections.slice(0, 12),
    stableInventory: {
      controlIds: controls.map((c) => c.id).filter(Boolean),
      riskIds: risks.map((r) => r.id).filter(Boolean)
    },
    rawExcerptsMaxChars: RAW_EXCERPTS_MAX_CHARS
  };

  const capped = trimPackage(pkg);
  capped.stats.tokenEstimate = estimateTokens(JSON.stringify(capped));
  return capped;
}

/**
 * Build a delta ChangePackage between previous and current document versions.
 */
export function buildDeltaPackage({
  documentId,
  familyId,
  previousDocumentId,
  previousVersion,
  currentVersion,
  prevText = '',
  currText = '',
  prevStructured = {},
  currStructured = {}
}) {
  const controlDiff = diffEntityLists(prevStructured.controls || [], currStructured.controls || []);
  const riskDiff = diffEntityLists(prevStructured.risks || [], currStructured.risks || []);
  const reqDiff = diffEntityLists(prevStructured.requirements || [], currStructured.requirements || []);

  const prevSections = splitSections(prevText);
  const currSections = splitSections(currText);
  const prevByHeading = new Map(prevSections.map((s) => [s.heading, s]));
  const currByHeading = new Map(currSections.map((s) => [s.heading, s]));

  const changedSections = [];
  for (const [heading, curr] of currByHeading) {
    const prev = prevByHeading.get(heading);
    if (!prev) {
      changedSections.push({
        heading,
        afterSnippet: snippet(curr.text),
        changeType: 'added'
      });
    } else if (prev.text.trim() !== curr.text.trim()) {
      changedSections.push({
        heading,
        beforeSnippet: snippet(prev.text),
        afterSnippet: snippet(curr.text),
        changeType: 'modified'
      });
    }
  }
  for (const [heading, prev] of prevByHeading) {
    if (!currByHeading.has(heading)) {
      changedSections.push({
        heading,
        beforeSnippet: snippet(prev.text),
        changeType: 'removed'
      });
    }
  }

  const prevLines = prevText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const currLines = currText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const prevSet = new Set(prevLines);
  const currSet = new Set(currLines);
  const addedLineCount = currLines.filter((l) => !prevSet.has(l)).length;
  const removedLineCount = prevLines.filter((l) => !currSet.has(l)).length;

  const stableControls = normalizeEntities(currStructured.controls || []);
  const stableRisks = normalizeEntities(currStructured.risks || []);

  const pkg = {
    documentId,
    familyId,
    previousDocumentId,
    previousVersion,
    currentVersion,
    mode: 'delta',
    hasDelta: true,
    stats: {
      prevChars: prevText.length,
      currChars: currText.length,
      addedLines: addedLineCount,
      removedLines: removedLineCount,
      tokenEstimate: 0
    },
    addedControls: controlDiff.added,
    removedControls: controlDiff.removed,
    addedRisks: riskDiff.added,
    removedRisks: riskDiff.removed,
    addedRequirements: reqDiff.added,
    changedSections: changedSections.slice(0, 20),
    stableInventory: {
      controlIds: stableControls.map((c) => c.id).filter(Boolean),
      riskIds: stableRisks.map((r) => r.id).filter(Boolean)
    },
    rawExcerptsMaxChars: RAW_EXCERPTS_MAX_CHARS
  };

  const capped = trimPackage(pkg);
  capped.stats.tokenEstimate = estimateTokens(JSON.stringify(capped));
  return capped;
}

/**
 * Compute ChangePackage for a store document vs its prior family version.
 */
export function extractChangePackage(currentDoc, previousVersion = null) {
  const structured = currentDoc.content?.structured || {};
  const rawText = currentDoc.content?.rawText || '';

  if (!previousVersion) {
    return buildBaselinePackage({
      documentId: currentDoc.id,
      familyId: currentDoc.familyId,
      structured,
      rawText
    });
  }

  return buildDeltaPackage({
    documentId: currentDoc.id,
    familyId: currentDoc.familyId,
    previousDocumentId: previousVersion.id,
    previousVersion: previousVersion.version,
    currentVersion: currentDoc.version,
    prevText: previousVersion.text || '',
    currText: rawText,
    prevStructured: previousVersion.extracted || {},
    currStructured: structured
  });
}

/**
 * Compact summary for API/UI (no large snippets).
 */
export function summarizeChangePackage(pkg) {
  if (!pkg) return null;
  return {
    mode: pkg.mode,
    hasDelta: Boolean(pkg.hasDelta),
    stats: pkg.stats,
    packageChars: pkg.packageChars,
    truncated: Boolean(pkg.truncated),
    addedControls: pkg.addedControls?.length || 0,
    removedControls: pkg.removedControls?.length || 0,
    addedRisks: pkg.addedRisks?.length || 0,
    removedRisks: pkg.removedRisks?.length || 0,
    changedSections: pkg.changedSections?.length || 0,
    stableControlCount: pkg.stableInventory?.controlIds?.length || 0
  };
}

export default {
  splitSections,
  buildBaselinePackage,
  buildDeltaPackage,
  extractChangePackage,
  summarizeChangePackage,
  LLM_PACKAGE_MAX_CHARS,
  RAW_EXCERPTS_MAX_CHARS
};
