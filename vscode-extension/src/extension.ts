import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parse as parseYAML } from 'yaml';
import { CopilotClient } from '@github/copilot-sdk';

type CustomAgentConfig = {
  name: string;
  description: string;
  prompt: string;
  tools: string[];
};

const SEND_AND_WAIT_TIMEOUT_MS = 300_000;
const MAX_AGENT_MD_BYTES = 1024 * 1024;

let client: CopilotClient | null = null;
let currentSession: any | null = null;
let lastSelectedAgent: string | null = null;
let dashboardPanel: vscode.WebviewPanel | null = null;

function parseFrontmatterAndBody(markdown: string): { frontmatter: any; body: string } {
  const trimmed = markdown.replace(/^\uFEFF/, '');
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: trimmed };

  let frontmatter: any = {};
  try {
    frontmatter = parseYAML(match[1]) ?? {};
  } catch {
    frontmatter = {};
  }
  return { frontmatter, body: String(match[2] ?? '').trim() };
}

function getRepoRoot(context: vscode.ExtensionContext): string {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (ws) return ws;
  return path.resolve(context.extensionPath, '..');
}

function resolveBundledCopilotCliPath(context: vscode.ExtensionContext): string | null {
  const pkgName = `copilot-${process.platform}-${process.arch}`;
  const exeName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
  const candidate = path.join(context.extensionPath, 'node_modules', '@github', pkgName, exeName);
  return fs.existsSync(candidate) ? candidate : null;
}

function loadCustomAgentConfig(repoRoot: string): CustomAgentConfig | null {
  try {
    const agentMdPath = path.join(repoRoot, '.github', 'agents', 'brd-creator.agent.md');
    if (!fs.existsSync(agentMdPath)) return null;

    const stats = fs.statSync(agentMdPath);
    if (stats.size > MAX_AGENT_MD_BYTES) return null;

    const raw = fs.readFileSync(agentMdPath, 'utf8');
    const { frontmatter, body } = parseFrontmatterAndBody(raw);
    const name = String(frontmatter?.name || 'brd-creator').slice(0, 50);
    const description = String(frontmatter?.description || '').slice(0, 500);
    const prompt = String(body || 'You are a BRD creator agent.').slice(0, 50_000);
    const tools = Array.isArray(frontmatter?.tools) ? frontmatter.tools.map(String) : [];
    return { name, description, prompt, tools };
  } catch {
    return null;
  }
}

async function ensureCopilotSession(context: vscode.ExtensionContext): Promise<void> {
  if (currentSession) return;

  const bundledCliPath = resolveBundledCopilotCliPath(context);
  if (!bundledCliPath) {
    throw new Error(
      'Copilot CLI executable not found in extension node_modules. Reinstall dependencies and ensure Copilot CLI is available.'
    );
  }

  if (!client) {
    client = new CopilotClient({ cliPath: bundledCliPath });
  }

  const repoRoot = getRepoRoot(context);
  const agentConfig = loadCustomAgentConfig(repoRoot);
  const skillsDir = path.join(repoRoot, '.github', 'skills');
  const skillDirectories = fs.existsSync(skillsDir) ? [skillsDir] : [];

  currentSession = await client.createSession({
    systemMessage: {
      content: [
        'You are running inside a BRD Creator VS Code extension.',
        "Prefer using the custom agent 'brd-creator' for BRD-related tasks.",
        'Be comprehensive: always cover problem, current state, desired outcome, stakeholders, in-scope/out-of-scope, benefits/value, and success metrics/acceptance criteria.',
        'Return STRICT JSON only when asked to produce JSON.',
      ].join('\n'),
    },
    customAgents: agentConfig
      ? [
          {
            name: agentConfig.name,
            description: agentConfig.description,
            prompt: agentConfig.prompt,
            tools: agentConfig.tools,
          },
        ]
      : [],
    skillDirectories,
  });

  currentSession.on((event: any) => {
    if (event?.type === 'subagent.selected' && event?.data?.agentName) {
      lastSelectedAgent = String(event.data.agentName);
      dashboardPanel?.webview.postMessage({
        type: 'meta',
        meta: {
          sessionId: currentSession?.sessionId,
          lastSelectedAgent,
        },
      });
    }
  });
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const nonce = getNonce();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  const templatePath = context.asAbsolutePath(path.join('media', 'dashboard.html'));
  const template = fs.readFileSync(templatePath, 'utf8');
  return template.replaceAll('{{CSP}}', csp).replaceAll('{{NONCE}}', nonce);
}

async function openDashboard(context: vscode.ExtensionContext): Promise<void> {
  if (dashboardPanel) {
    dashboardPanel.reveal();
    return;
  }

  dashboardPanel = vscode.window.createWebviewPanel(
    'brdCreatorDashboard',
    'BRD Creator',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
    }
  );

  dashboardPanel.webview.html = getWebviewContent(context, dashboardPanel.webview);

  dashboardPanel.onDidDispose(() => {
    dashboardPanel = null;
  });

  dashboardPanel.webview.onDidReceiveMessage(async (message) => {
    try {
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'resetSession') {
        if (currentSession) {
          await currentSession.destroy();
        }
        currentSession = null;
        lastSelectedAgent = null;
        dashboardPanel?.webview.postMessage({
          type: 'meta',
          meta: { sessionId: null, lastSelectedAgent: null },
        });
        return;
      }

      if (message.type === 'download') {
        const content = typeof message.content === 'string' ? message.content : '';
        if (!content.trim()) return;

        const suggestedName = typeof message.suggestedName === 'string' ? message.suggestedName : 'brd.md';
        const uri = await vscode.window.showSaveDialog({
          saveLabel: 'Save BRD',
          defaultUri: vscode.Uri.file(path.join(getRepoRoot(context), suggestedName)),
          filters: { Markdown: ['md'], 'All Files': ['*'] },
        });
        if (!uri) return;

        await fs.promises.writeFile(uri.fsPath, content, 'utf8');
        vscode.window.setStatusBarMessage(`Saved: ${uri.fsPath}`, 4000);
        return;
      }

      if (message.type === 'sendPrompt') {
        const prompt = typeof message.prompt === 'string' ? message.prompt : '';
        if (!prompt.trim()) return;

        await ensureCopilotSession(context);
        dashboardPanel?.webview.postMessage({
          type: 'meta',
          meta: {
            sessionId: currentSession?.sessionId,
            lastSelectedAgent,
          },
        });

        const response = await currentSession.sendAndWait({ prompt }, SEND_AND_WAIT_TIMEOUT_MS);
        const content = response?.data?.content ?? '';
        dashboardPanel?.webview.postMessage({
          type: 'reply',
          reply: String(content),
          meta: {
            sessionId: currentSession?.sessionId,
            lastSelectedAgent,
          },
        });
        return;
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : 'Unknown error';
      dashboardPanel?.webview.postMessage({ type: 'error', error: msg });
    }
  });

  // Prime meta (even before first request)
  dashboardPanel.webview.postMessage({
    type: 'meta',
    meta: {
      sessionId: currentSession?.sessionId ?? null,
      lastSelectedAgent,
    },
  });
}

class BRDDashboardProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private context: vscode.ExtensionContext) {}

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      const start = new vscode.TreeItem('📝 Start New BRD');
      start.command = { command: 'brd-creator.start', title: 'Start New BRD' };

      const open = new vscode.TreeItem('📊 Open Dashboard');
      open.command = { command: 'brd-creator.openPanel', title: 'Open Dashboard' };

      return Promise.resolve([start, open]);
    }
    return Promise.resolve([]);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const treeProvider = new BRDDashboardProvider(context);
  vscode.window.registerTreeDataProvider('brd-creator.dashboard', treeProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('brd-creator.openPanel', async () => {
      await openDashboard(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('brd-creator.start', async () => {
      await openDashboard(context);
      dashboardPanel?.webview.postMessage({ type: 'meta', meta: { sessionId: currentSession?.sessionId, lastSelectedAgent } });
    })
  );
}

export function deactivate() {
  if (currentSession) {
    currentSession.destroy().catch(() => undefined);
  }
}
