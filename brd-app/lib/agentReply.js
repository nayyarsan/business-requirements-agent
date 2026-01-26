import {
  buildRepairPrompt,
  extractJsonObject,
  normalizeAgentPayload,
  validateAgentPayload,
} from './agentPayload.js';

/**
 * Calls the agent and ensures we return a JSON reply matching the UI contract.
 * Performs at most one repair attempt if the initial response is not valid.
 */
export async function getAgentReplyWithRepair({ prompt, session, timeoutMs }) {
  const response = await session.sendAndWait({ prompt }, timeoutMs);
  const rawReply = response?.data?.content ?? '';

  let payload = extractJsonObject(rawReply);
  let validation = validateAgentPayload(payload);
  let repaired = false;

  if (!validation.ok) {
    const repairPrompt = buildRepairPrompt(rawReply);
    const repairedResponse = await session.sendAndWait({ prompt: repairPrompt }, timeoutMs);
    const repairedRaw = repairedResponse?.data?.content ?? '';
    payload = extractJsonObject(repairedRaw);
    validation = validateAgentPayload(payload);
    repaired = validation.ok;
  }

  if (!validation.ok) {
    return {
      reply: rawReply,
      payloadValid: false,
      payloadErrors: validation.errors,
      payloadRepaired: false,
    };
  }

  const normalizedPayload = normalizeAgentPayload(payload);
  return {
    reply: JSON.stringify(normalizedPayload),
    payloadValid: true,
    payloadErrors: [],
    payloadRepaired: repaired,
  };
}
