import { CopilotClient } from '@github/copilot-sdk';
import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import { parse as parseYAML } from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const agentMdPath = path.join(repoRoot, '.github', 'agents', 'brd-creator.agent.md');
function parseFrontmatterAndBody(markdown) {
  const trimmed = markdown.replace(/^\uFEFF/, '');
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: trimmed };

  let frontmatter = {};
  try {
    frontmatter = parseYAML(match[1]) ?? {};
  } catch {
    frontmatter = {};
  }
  return { frontmatter, body: (match[2] ?? '').trim() };
}

let agentConfig = {};
try {
  if (!fs.existsSync(agentMdPath)) {
    console.warn('Agent config not found at:', agentMdPath);
  } else {
    const stats = fs.statSync(agentMdPath);
    if (stats.size > 1024 * 1024) {
      throw new Error('Agent config file too large (max 1MB)');
    }
    const rawAgentMd = fs.readFileSync(agentMdPath, 'utf8');
    const { frontmatter, body } = parseFrontmatterAndBody(rawAgentMd);
    agentConfig = {
      name: String(frontmatter?.name || 'brd-creator').slice(0, 50),
      description: String(frontmatter?.description || '').slice(0, 500),
      prompt: String(body || 'You are a BRD creator agent.').slice(0, 50000),
      tools: Array.isArray(frontmatter?.tools) ? frontmatter.tools : [],
    };
  }
} catch (e) {
  console.error('Failed to read agent file:', e.message);
}

function resolveBundledCopilotCliPath() {
  const pkgName = `copilot-${process.platform}-${process.arch}`;
  const exeName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
  const candidate = path.join(__dirname, 'node_modules', '@github', pkgName, exeName);
  return fs.existsSync(candidate) ? candidate : null;
}

const bundledCliPath = resolveBundledCopilotCliPath();
const bundledCliAvailable = Boolean(bundledCliPath);
const client = new CopilotClient(bundledCliPath ? { cliPath: bundledCliPath } : undefined);
const SEND_AND_WAIT_TIMEOUT_MS = Number(process.env.COPILOT_SEND_TIMEOUT_MS || 300000);
let session = null;
let lastSelectedAgent = null;
async function initSession() {
  try {
    if (!bundledCliPath) {
      console.warn(
        [
          'GitHub Copilot CLI executable (copilot) not found in brd-app/node_modules; starting server without an active Copilot session.',
          'From brd-app, run: bun install',
        ].join('\n'),
      );
      session = null;
      return;
    }

    session = await client.createSession({
      systemMessage: {
        content: [
          "You are running inside a BRD generator app.",
          "Prefer using the custom agent 'brd-creator' for BRD-related tasks.",
          "Be comprehensive: always cover problem, current state, desired outcome, stakeholders, in-scope/out-of-scope, benefits/value, and success metrics/acceptance criteria.",
        ].join("\n"),
      },
      customAgents: [
        {
          name: agentConfig.name,
          description: agentConfig.description,
          prompt: agentConfig.prompt,
          tools: agentConfig.tools,
        },
      ],
      skillDirectories: [path.join(repoRoot, '.github', 'skills')],
    });

    // Capture which subagent the runtime selects (useful to verify custom agent usage).
    session.on((event) => {
      if (event?.type === 'subagent.selected' && event?.data?.agentName) {
        lastSelectedAgent = event.data.agentName;
      }
    });
    console.log('Copilot session created:', session.sessionId);
  } catch (err) {
    console.error('Failed to create Copilot session. Copilot CLI may be missing or unauthenticated.' , err.message || err);
    session = null;
  }
}

initSession();

const publicDir = path.join(__dirname, 'public');

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function serveStatic(req, res) {
  setCors(res);
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, url);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/plain';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

async function handleApiMessage(req, res) {
  try {
    setCors(res);
    let body = '';
    let totalBytes = 0;
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit
    
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request too large (max 1MB)' }));
        return;
      }
      body += chunk;
    }
    
    const payload = JSON.parse(body || '{}');
    const message = payload.message;
    
    if (!message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing message' }));
      return;
    }
    
    if (typeof message !== 'string' || message.length > 50000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'message invalid or too long (max 50KB)' }));
      return;
    }

    if (!session) {
      res.writeHead(503);
      res.end(
        JSON.stringify({
          error:
              'Copilot session not available. Ensure the GitHub Copilot CLI (copilot) is available and authenticated, then restart the server.',
          meta: {
              bundledCliAvailable,
              bundledCliPath,
          },
        }),
      );
      return;
    }

    const response = await session.sendAndWait({ prompt: message }, SEND_AND_WAIT_TIMEOUT_MS);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        reply: response?.data?.content ?? null,
        meta: {
          sessionId: session.sessionId,
          lastSelectedAgent,
          customAgentConfigured: agentConfig?.name ?? null,
            bundledCliAvailable,
            bundledCliPath,
        },
      }),
    );
  } catch (err) {
    const msg = err?.message || String(err);
    const isIdleTimeout = typeof msg === 'string' && msg.includes('waiting for session.idle');
    res.writeHead(isIdleTimeout ? 504 : 500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: isIdleTimeout
          ? `The AI engine is still working and exceeded the server wait timeout (${SEND_AND_WAIT_TIMEOUT_MS}ms). Try again, or generate a BRD Brief first, or ask for a smaller chunk (e.g., only sections 1–4).`
          : msg,
        meta: {
          sessionId: session?.sessionId ?? null,
          lastSelectedAgent,
          bundledCliAvailable,
          bundledCliPath,
          timeoutMs: SEND_AND_WAIT_TIMEOUT_MS,
        },
      }),
    );
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
  } else if (req.method === 'POST' && req.url === '/api/message') {
    handleApiMessage(req, res);
  } else {
    setCors(res);
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`BRD app listening on http://localhost:${PORT}`));

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  try { if (session) await session.destroy(); } catch (e) {}
  process.exit(0);
});
