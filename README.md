# BRD Creator (Copilot Agent + Skills)

**A VS Code extension that generates comprehensive Business Requirements Documents (BRDs) using the GitHub Copilot SDK.**

This project demonstrates how to build intelligent, domain-specific tools by leveraging [GitHub Copilot SDK](https://github.com/github/copilot-sdk) — a programmable layer that enables you to plan, invoke tools, edit files, and run commands as an agentic execution loop embedded in any application.

## About the GitHub Copilot SDK

The GitHub Copilot SDK (now in technical preview) removes the burden of building agentic workflows from scratch. It provides programmatic access to the same production-tested execution loop that powers GitHub Copilot CLI, allowing you to:

- **Plan and execute** complex tasks with multi-turn conversations
- **Integrate custom tools** and domain-specific skills
- **Support multiple AI models** with GitHub authentication
- **Manage context** intelligently across sessions
- **Stream results** in real-time
- **Leverage MCP server integration** for extensibility

The BRD Creator demonstrates these capabilities by guiding users through an interactive requirements-gathering process and producing decision-ready documentation using structured prompts and a stable Markdown template.

This repo includes:

- A VS Code extension (recommended distribution model)
- A local-only web app (useful for experimentation)
- Custom agent and skills demonstrating the SDK's capabilities

## Screenshots

### VS Code extension dashboard

![VS Code extension dashboard](brd-app/public/stitch-dashboard/screen.png)

### Web app dashboard

![Web app dashboard](brd-app/public/stitch-dashboard/screen.png)

## What it does

- Guided requirements gathering (asks high-leverage clarifying questions)
- Generates a BRD using a strict, stable Markdown template
- Interactive workflow:
  - Chat on the left
  - BRD preview + versions + diff view on the right
  - Open questions form + “Apply Answers”
  - One-click download to Markdown

## Core building blocks

- Custom agent: [.github/agents/brd-creator.agent.md](.github/agents/brd-creator.agent.md)
- Skills:
  - [.github/skills/brd-gathering/SKILL.md](.github/skills/brd-gathering/SKILL.md)
  - [.github/skills/brd-structuring/SKILL.md](.github/skills/brd-structuring/SKILL.md)

## Prerequisites

- GitHub Copilot subscription (or bring your own API key)
- Copilot CLI installed + authenticated on this machine
- For the web app: Bun installed
- **Supported languages**: The SDK supports Node.js, Python, Go, and .NET

Learn more about getting started with the [GitHub Copilot SDK](https://github.com/github/copilot-sdk).

## VS Code extension (recommended)

See the extension docs: [vscode-extension/README.md](vscode-extension/README.md)

Quick dev loop:

```bash
cd vscode-extension
npm install
npm run compile
```

Then press F5 to launch the Extension Development Host.

Build a VSIX:

```bash
cd vscode-extension
npm run package
```

The packaged VSIX is copied to the root [releases](releases) folder in this repo.

## Web app (local-only)

See the web app docs: [brd-app/README.md](brd-app/README.md)

```powershell
cd .\brd-app
bun install
bun run .\server.js
```

Open http://localhost:3000

## Output contract (UI ↔ Agent)

The UI expects the agent to return strict JSON (no markdown fences, no commentary):

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

## Notes

- Public hosting/serverless deployment is not the intended model for Copilot SDK usage; the extension runs locally with the user’s Copilot authentication.
