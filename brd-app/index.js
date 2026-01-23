import { CopilotClient } from '@github/copilot-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';
import { parse as parseYAML } from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

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

// Load agent config from .github/agents/brd-creator.agent.md
const agentMdPath = path.join(repoRoot, '.github', 'agents', 'brd-creator.agent.md');
const rawAgentMd = fs.readFileSync(agentMdPath, 'utf8');
const { frontmatter: agentFrontmatter, body: agentPrompt } = parseFrontmatterAndBody(rawAgentMd);

const agentConfig = {
  name: agentFrontmatter?.name || 'brd-creator',
  description: agentFrontmatter?.description || '',
  prompt: agentPrompt || 'You are a BRD creator agent.',
  tools: agentFrontmatter?.tools ?? [],
};

function resolveBundledCopilotCliPath() {
  const pkgName = `copilot-${process.platform}-${process.arch}`;
  const exeName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
  const candidate = path.join(__dirname, 'node_modules', '@github', pkgName, exeName);
  return fs.existsSync(candidate) ? candidate : null;
}
async function main() {
  try {
    const SEND_AND_WAIT_TIMEOUT_MS = Number(process.env.COPILOT_SEND_TIMEOUT_MS || 300000);
    const bundledCliPath = resolveBundledCopilotCliPath();
    if (!bundledCliPath) {
      console.error(
        [
          'Copilot CLI executable not found in brd-app/node_modules; cannot start the BRD CLI session.',
          'From brd-app, run: bun install',
        ].join('\n'),
      );
      process.exit(1);
    }

    const client = new CopilotClient({
      cliPath: bundledCliPath,
    });

    const session = await client.createSession({
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

    let lastSelectedAgent = null;
    session.on((event) => {
      if (event?.type === 'subagent.selected' && event?.data?.agentName) {
        lastSelectedAgent = event.data.agentName;
      }
    });

    console.log('BRD Creator Agent initialized. Type your questions or requirements to get help creating a BRD.');
    console.log('Type "exit" to quit.');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question('> ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          await session.destroy();
          rl.close();
          return;
        }

        try {
          const response = await session.sendAndWait({ prompt: input }, SEND_AND_WAIT_TIMEOUT_MS);
          if (lastSelectedAgent) {
            console.log(`(selected agent: ${lastSelectedAgent})`);
          }
          console.log('Agent:', response.data.content);
        } catch (error) {
          console.error('Error:', error.message);
        }

        askQuestion();
      });
    };

    askQuestion();

  } catch (error) {
    console.error('Failed to initialize session:', error.message);
  }
}

main();