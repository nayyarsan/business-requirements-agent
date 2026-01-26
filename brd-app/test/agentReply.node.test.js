import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentReplyWithRepair } from '../lib/agentReply.js';

function makeSession(responses) {
  const calls = [];
  return {
    calls,
    async sendAndWait({ prompt }, timeoutMs) {
      calls.push({ prompt, timeoutMs });
      const next = responses.shift();
      return { data: { content: next } };
    },
  };
}

test('getAgentReplyWithRepair returns normalized JSON when initial payload is valid', async () => {
  const session = makeSession([
    '{"mode":"questions","brdMarkdown":"","questions":[]}',
  ]);

  const result = await getAgentReplyWithRepair({
    prompt: 'hi',
    session,
    timeoutMs: 123,
  });

  assert.equal(result.payloadValid, true);
  assert.equal(result.payloadRepaired, false);

  const parsed = JSON.parse(result.reply);
  assert.equal(parsed.mode, 'questions');
  assert.equal(parsed.brdMarkdown, '');
  assert.deepEqual(parsed.questions, []);
  assert.equal(session.calls.length, 1);
});

test('getAgentReplyWithRepair performs one repair attempt when initial payload is invalid', async () => {
  const repairedJson = JSON.stringify({
    mode: 'brd',
    brdMarkdown:
      '# Business Requirements Document: X\n\n## 0. Document Control\n- Version: v0.1\n\n## 1. Executive Summary\n**TBD**\n',
    questions: [],
  });

  const session = makeSession([
    'Not JSON at all',
    repairedJson,
  ]);

  const result = await getAgentReplyWithRepair({
    prompt: 'hi',
    session,
    timeoutMs: 123,
  });

  assert.equal(result.payloadValid, true);
  assert.equal(result.payloadRepaired, true);
  assert.equal(session.calls.length, 2);
  assert.ok(session.calls[1].prompt.includes('Previous response (to convert):'));

  const parsed = JSON.parse(result.reply);
  assert.equal(parsed.mode, 'brd');
  assert.ok(parsed.brdMarkdown.includes('# Business Requirements Document:'));
});

test('getAgentReplyWithRepair falls back to raw reply when repair also fails', async () => {
  const session = makeSession([
    'Not JSON',
    'Still not JSON',
  ]);

  const result = await getAgentReplyWithRepair({
    prompt: 'hi',
    session,
    timeoutMs: 123,
  });

  assert.equal(result.payloadValid, false);
  assert.equal(result.payloadRepaired, false);
  assert.equal(result.reply, 'Not JSON');
  assert.ok(Array.isArray(result.payloadErrors));
  assert.equal(session.calls.length, 2);
});
