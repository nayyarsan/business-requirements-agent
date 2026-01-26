import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRepairPrompt,
  extractJsonObject,
  normalizeAgentPayload,
  validateAgentPayload,
} from '../lib/agentPayload.js';

test('extractJsonObject parses plain JSON object', () => {
  const obj = extractJsonObject('{"mode":"questions","brdMarkdown":"","questions":[]}');
  assert.ok(obj);
  assert.equal(obj.mode, 'questions');
});

test('extractJsonObject parses fenced JSON', () => {
  const obj = extractJsonObject('```json\n{"mode":"brd","brdMarkdown":"# x","questions":[]}\n```');
  assert.ok(obj);
  assert.equal(obj.mode, 'brd');
});

test('extractJsonObject extracts first JSON object from chatter', () => {
  const obj = extractJsonObject('Here you go!\n{"mode":"questions","brdMarkdown":"","questions":[]}\nThanks.');
  assert.ok(obj);
  assert.deepEqual(obj.questions, []);
});

test('extractJsonObject returns null on invalid JSON', () => {
  assert.equal(extractJsonObject('{nope'), null);
});

test('validateAgentPayload accepts a valid payload', () => {
  const payload = { mode: 'questions', brdMarkdown: '', questions: [] };
  const v = validateAgentPayload(payload);
  assert.equal(v.ok, true);
});

test('validateAgentPayload rejects missing mode/questions', () => {
  const v = validateAgentPayload({ brdMarkdown: '' });
  assert.equal(v.ok, false);
  assert.ok(v.errors.length > 0);
});

test('validateAgentPayload rejects invalid mode', () => {
  const v = validateAgentPayload({ mode: 'draft', brdMarkdown: '', questions: [] });
  assert.equal(v.ok, false);
});

test('normalizeAgentPayload coerces types and fills defaults', () => {
  const normalized = normalizeAgentPayload({ mode: 'brd', brdMarkdown: 123, questions: 'nope' });
  assert.equal(normalized.mode, 'brd');
  assert.equal(normalized.brdMarkdown, '123');
  assert.equal(Array.isArray(normalized.questions), true);
});

test('buildRepairPrompt includes strict JSON instruction and original text', () => {
  const p = buildRepairPrompt('not json');
  assert.ok(p.toLowerCase().includes('return strict json'));
  assert.ok(p.includes('not json'));
});
