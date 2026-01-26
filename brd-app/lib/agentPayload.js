// Utilities for extracting, validating, and repairing the BRD agent JSON payload.

const MODE_VALUES = new Set(['questions', 'brd']);

export function extractJsonObject(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  // Handle fenced JSON: ```json { ... } ```
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  // Best-effort: isolate the first JSON object.
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const maybe = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
    ? candidate.slice(firstBrace, lastBrace + 1)
    : candidate;

  try {
    const parsed = JSON.parse(maybe);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateAgentPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['payload is not an object'] };
  }

  const mode = payload.mode;
  if (typeof mode !== 'string' || !MODE_VALUES.has(mode)) {
    errors.push('mode must be "questions" or "brd"');
  }

  if (payload.brdMarkdown != null && typeof payload.brdMarkdown !== 'string') {
    errors.push('brdMarkdown must be a string');
  }

  if (!Array.isArray(payload.questions)) {
    errors.push('questions must be an array');
  }

  return { ok: errors.length === 0, errors };
}

export function normalizeAgentPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      mode: 'questions',
      brdMarkdown: '',
      questions: [],
    };
  }

  const mode = MODE_VALUES.has(String(payload.mode)) ? String(payload.mode) : 'questions';
  const brdMarkdown = payload.brdMarkdown != null ? String(payload.brdMarkdown) : '';
  const questions = Array.isArray(payload.questions) ? payload.questions : [];

  const versionLabel = payload.versionLabel != null ? String(payload.versionLabel) : undefined;
  const changelog = Array.isArray(payload.changelog) ? payload.changelog.map(String) : undefined;

  const normalized = { mode, brdMarkdown, questions };
  if (versionLabel) normalized.versionLabel = versionLabel;
  if (changelog && changelog.length) normalized.changelog = changelog;
  return normalized;
}

export function buildRepairPrompt(rawReply) {
  const jsonContract = [
    'Return STRICT JSON only (no markdown fences, no commentary, no trailing text).',
    'You MUST return an object shaped like this:',
    '{',
    '  "mode": "questions" | "brd",',
    '  "versionLabel": "v0.1" (optional),',
    '  "changelog": ["..."] (optional),',
    '  "brdMarkdown": "...",',
    '  "questions": [',
    '    {"id":"q1","question":"...","context":"...","required":true}',
    '  ]',
    '}',
    'Rules:',
    '- If you are still gathering requirements, set mode="questions" and return questions (brdMarkdown may be empty or a skeleton).',
    '- If you can generate/update the BRD, set mode="brd" and return brdMarkdown as the full document using the BRD Template (Strict).',
    '- Always include questions for missing info (even when mode="brd").',
  ].join('\n');

  return [
    jsonContract,
    '',
    'The previous response did not match the JSON contract or was not valid JSON.',
    'Convert it into a valid payload now.',
    '',
    'Previous response (to convert):',
    String(rawReply ?? ''),
  ].join('\n');
}
