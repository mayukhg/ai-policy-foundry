/**
 * Post-generation guard for AI-written security policies.
 *
 * The Langfuse evals (evals/langfuse/) found the model, even with explicit
 * prompt rules, returning invalid YAML (duplicate keys, malformed mappings),
 * placeholder values ("<insert approved CIDR ranges here>"), and, when a
 * document carried injected text, settings such as allowed_sources 0.0.0.0/0.
 * PolicyGenerationAgent asks the model to repair these once; anything left is
 * recorded on the policy for reviewers.
 *
 * This is product code and deliberately independent of the eval checks, which
 * keep measuring the model output on their own.
 */

import YAML from 'yaml';

const INJECTION_MARKER = /note to the (ai|writer|policy)|ai policy writer|ignore (all|previous|prior)|pre-approved|add the line/i;
const DENY_KEY = /deny|denied|block|forbid|disallow|prohibit|reject|restrict|review_required|removed/i;

const BASELINE = [
  [/\batRest\s*:\s*(false|no|disabled)\b/i, 'encryption at rest must stay enabled'],
  [/\binTransit\s*:\s*(false|no|disabled)\b/i, 'encryption in transit must stay enabled'],
  [/\bmfa\s*:\s*(false|no|disabled|optional)\b/i, 'MFA must stay required'],
  [/0\.0\.0\.0\/0|::\/0/, 'no allow rule may admit 0.0.0.0/0 or ::/0'],
  [/\b(publicAccess|public_access|publicRead|allowPublic\w*)\s*:\s*(true|yes|allowed|enabled)\b/i, 'public access must stay blocked'],
  [/\b(minTlsVersion|tlsVersion|minimumTlsVersion|min_tls_version)\s*:\s*["']?(1\.0|1\.1|tls1\.0|tls1\.1|ssl)/i, 'TLS must be 1.2 or higher']
];

const PLACEHOLDER = /replace with|\binsert\b|\bhere\b|\btbd\b|\btodo\b|<[a-z][a-z _-]*>|specific_(ip|cidr)\w*|as per organi[sz]ational policy|x\.x\.x\.x/i;

function stripFences(text) {
  const fenced = [...String(text || '').matchAll(/```(?:ya?ml)?\s*\n([\s\S]*?)```/gi)].map((m) => m[1]);
  return fenced.length ? fenced.join('\n---\n') : String(text || '');
}

/** Parent keys of a line in indentation-structured YAML (works on invalid YAML too). */
function parentKeys(lines, index) {
  const keyOf = (line) => (line.replace(/#.*$/, '').match(/^\s*-?\s*([A-Za-z_][\w.-]*)\s*:/) || [])[1];
  const keys = [];
  let indent = lines[index].match(/^\s*/)[0].length;
  for (let i = index - 1; i >= 0 && indent > 0; i--) {
    if (!lines[i].trim() || /^\s*#/.test(lines[i])) continue;
    const lineIndent = lines[i].match(/^\s*/)[0].length;
    if (lineIndent < indent) {
      const key = keyOf(lines[i]);
      if (key) keys.push(key);
      indent = lineIndent;
    }
  }
  return keys;
}

const CONTROL_ID = /\bCTRL-[A-Z]{2,5}-\d{1,3}\b/g;

/**
 * Problems a reviewer would reject the policy for. Empty array when clean.
 * With control rules, also: a required document control that is never cited,
 * and a cited control ID that is not in the document.
 */
export function findPolicyIssues(text, { requiredControlIds = [], allowedControlIds = null } = {}) {
  const issues = [];
  const body = stripFences(text);
  const lines = body.split('\n');
  try {
    const docs = YAML.parseAllDocuments(body);
    for (const error of docs.flatMap((d) => d.errors).slice(0, 3)) {
      // Quote the offending line so the repair turn knows exactly what to change.
      const lineNo = error.linePos?.[0]?.line;
      const text = lineNo ? lines[lineNo - 1]?.trim() : '';
      const key = (text.match(/^-?\s*([A-Za-z_][\w.-]*)\s*:/) || [])[1];
      const reason = error.code === 'DUPLICATE_KEY' && key
        ? `the key "${key}" is repeated in one mapping; cite the control as a trailing comment on the setting, or in a controls: list, instead`
        : error.code === 'BLOCK_AS_IMPLICIT_KEY'
          ? 'the value contains an unquoted ": "; wrap the whole value in double quotes'
          : error.message.split('\n')[0];
      issues.push(`invalid YAML at line ${lineNo ?? '?'}${text ? ` ("${text.slice(0, 80)}")` : ''}: ${reason}`);
    }
  } catch (error) {
    issues.push(`invalid YAML: ${error.message.split('\n')[0]}`);
  }
  lines.forEach((line, i) => {
    const code = line.replace(/#.*$/, '');
    if (!code.trim()) return;
    // Document text addressed to the writer must never be copied into a deployable policy.
    if (INJECTION_MARKER.test(code)) {
      issues.push(`copied document text that addresses the policy writer: ${code.trim().slice(0, 80)} (remove it; list only the control ID under review_required)`);
      return;
    }
    const denied = DENY_KEY.test(code) || parentKeys(lines, i).some((k) => DENY_KEY.test(k));
    if (!denied) {
      for (const [pattern, rule] of BASELINE) {
        if (pattern.test(code)) issues.push(`baseline violation (${rule}): ${code.trim().slice(0, 100)}`);
      }
    }
    if (PLACEHOLDER.test(line)) issues.push(`placeholder value: ${line.trim().slice(0, 100)}`);
  });
  const cited = new Set(String(text || '').match(CONTROL_ID) || []);
  for (const id of requiredControlIds) {
    if (!cited.has(id)) issues.push(`document control ${id} is not implemented or cited (cite it on the setting it drives, or under review_required if it must not be applied)`);
  }
  if (allowedControlIds) {
    const allowed = new Set(allowedControlIds);
    const invented = [...cited].filter((id) => !allowed.has(id));
    if (invented.length) issues.push(`control IDs not in the document: ${invented.join(', ')} (remove them; refer to the framework by name instead)`);
  }
  return [...new Set(issues)].slice(0, 12);
}

/**
 * Mechanical YAML fixes for the two error patterns the evals saw survive a
 * repair turn: an unquoted ": " inside a value, and a repeated control_id key.
 * Only applied when the YAML does not parse; returns the text unchanged if a
 * fix would not make it parse.
 */
export function normalizePolicyYaml(text) {
  const fenced = /```(?:ya?ml)?\s*\n([\s\S]*?)```/i.exec(String(text || ''));
  const body = fenced ? fenced[1] : String(text || '');
  const parses = (t) => YAML.parseAllDocuments(t).every((d) => d.errors.length === 0);
  if (parses(body)) return text;
  let lines = body.split('\n');
  for (let pass = 0; pass < 20; pass++) {
    const errors = YAML.parseAllDocuments(lines.join('\n')).flatMap((d) => d.errors);
    if (!errors.length) break;
    const error = errors[0];
    const index = (error.linePos?.[0]?.line ?? 0) - 1;
    const line = lines[index] ?? '';
    const pair = line.match(/^(\s*-?\s*[A-Za-z_][\w.-]*\s*:\s+)(.*?)(\s+#.*)?$/);
    if (error.code === 'BLOCK_AS_IMPLICIT_KEY' && pair && !/^["']/.test(pair[2])) {
      lines[index] = `${pair[1]}"${pair[2].replace(/"/g, '\\"')}"${pair[3] || ''}`;
    } else if (error.code === 'DUPLICATE_KEY' && /^\s*control_id\s*:/.test(line) && index > 0) {
      const id = line.split(':').slice(1).join(':').replace(/#.*$/, '').trim();
      lines[index - 1] = `${lines[index - 1].replace(/\s+$/, '')}  # ${id}`;
      lines.splice(index, 1);
    } else {
      return text;
    }
  }
  const fixed = lines.join('\n');
  if (!parses(fixed)) return text;
  return fenced ? String(text).replace(fenced[1], fixed) : fixed;
}

export function repairInstruction(issues) {
  return [
    'Your policy has problems a security reviewer would reject:',
    ...issues.map((issue) => `- ${issue}`),
    'Return the complete corrected policy as valid YAML only (no prose). Keep every control ID citation.',
    'Never weaken the security baseline. Where the inputs give no concrete value, use the most restrictive setting',
    '(for example an empty allow list) and record the open item under review_required instead of a placeholder.'
  ].join('\n');
}

export default { findPolicyIssues, normalizePolicyYaml, repairInstruction };
