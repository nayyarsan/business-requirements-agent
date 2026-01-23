# BRD Creator Agent

An interactive web app that uses the GitHub Copilot SDK with a custom agent and skills to help users create comprehensive Business Requirements Documents (BRDs).

## Architecture

This project demonstrates the integration of:

1. **Custom Copilot Agent** (`.github/agents/brd-creator.agent.md`) — A specialized AI persona configured with domain expertise in business analysis and requirements gathering
2. **Agent Skills** (`.github/skills/`) — Procedural knowledge modules that extend the agent's capabilities:
   - `brd-gathering` — Structured process for collecting requirements
   - `brd-structuring` — Templates and formatting for professional BRDs
3. **GitHub Copilot SDK** (`@github/copilot-sdk`) — Programmatic access to Copilot CLI with custom agent support
4. **Web UI** — Dashboard UI that renders BRD output and collects follow-up answers

### How It Works

```
User → Web UI → HTTP Server → Copilot SDK → Copilot CLI (with custom agent + skills)
```

1. The server loads the agent configuration from `.github/agents/brd-creator.agent.md` (YAML frontmatter)
2. Creates a Copilot session with `customAgents` and `skillDirectories` config
3. The Copilot CLI automatically loads skills from `.github/skills/` and applies them
4. User messages are forwarded to the agent via the SDK
5. The agent uses its custom prompt + skills to provide expert BRD guidance

## Prerequisites

- **Bun** (JavaScript runtime): https://bun.sh
- **GitHub Copilot CLI** installed and authenticated: https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line
- Valid GitHub Copilot subscription (Pro or Enterprise)

## Quick Start
# BRD Creator Agent

An interactive web app that uses the GitHub Copilot SDK with a custom agent and skills to help users create comprehensive Business Requirements Documents (BRDs).

```powershell
```text
bun install
bun run start
```

Open http://localhost:3000 and interact with the BRD Creator agent.
 **Bun** (JavaScript runtime): [https://bun.sh](https://bun.sh)
 **GitHub Copilot CLI** installed and authenticated: [Copilot CLI setup](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line)

## Project Structure

 
Open [http://localhost:3000](http://localhost:3000) and interact with the BRD Creator agent.
```
.
├── .github/
```text
│   │   └── brd-creator.agent.md    # Custom agent config (name, prompt, etc.)
│   └── skills/
│       ├── brd-gathering/
│       │   └── SKILL.md            # Requirements gathering skill
│       └── brd-structuring/
# BRD Creator

Create comprehensive Business Requirements Documents using GitHub Copilot with a custom business analyst agent and domain skills.

This repo contains:

1. **VS Code Extension** (`vscode-extension/`) — Recommended for most users; runs locally with your own Copilot
2. **Web App** (`brd-app/`) — For personal/internal use; single-user Bun server

---

## VS Code Extension (Recommended)

**Why use this:**
- No hosting needed
- Runs locally with your Copilot subscription
- Proper SDK usage pattern
- Zero setup beyond installing the extension

**Install:**

```bash
cd vscode-extension
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

See [vscode-extension/README.md](vscode-extension/README.md) for full docs.

---

## Web App (Personal/Internal Use)

### How it works

```text
User → Web UI → Bun HTTP Server → Copilot SDK → Copilot CLI (with custom agent + skills)
```

### Prerequisites

- Bun: [https://bun.sh](https://bun.sh)
- Copilot CLI authenticated: [Copilot CLI setup](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line)
- A GitHub Copilot subscription

### Quick start (local)

```powershell
cd .\brd-app
bun install
bun run .\server.js
```

Open [http://localhost:3000](http://localhost:3000).

## Output contract (UI ↔ Agent)

The UI expects the agent to return **strict JSON** (no markdown fences, no commentary):

```json
{
  "mode": "questions" | "brd",
  "versionLabel": "v0.1",
  "changelog": ["..."],
  "brdMarkdown": "...",
  "questions": [
    {"id":"q1","question":"...","context":"...","required":true}
  ]
}
```

The UI behavior:

- Renders `brdMarkdown` into the right preview pane
- Renders `questions[]` as a form; user fills answers and clicks **Apply Answers**

## Project structure

```text
.
├── .github/
│   ├── agents/
│   │   └── brd-creator.agent.md
│   └── skills/
│       ├── brd-gathering/
│       │   └── SKILL.md
│       └── brd-structuring/
│           └── SKILL.md
└── brd-app/
    ├── public/
    │   ├── index.html
    │   └── app.js
    ├── server.js
    └── package.json
```

## Configuration

Environment variables:

- `PORT` (default: 3000)
- `COPILOT_SEND_TIMEOUT_MS` (default: 300000)
- `CORS_ORIGIN` (default: `*`)

---

## Deployment

- **VS Code Extension**: Package with `npm run package` → distribute `.vsix` or publish to Marketplace
- **Web App**: See VERCEL_DEPLOY.md (personal/internal use only; not for public hosting)
    name: 'brd-creator',
