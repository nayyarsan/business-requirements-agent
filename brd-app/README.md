# BRD Creator - Web App (Local-Only)

A local dashboard app that uses the GitHub Copilot SDK (via Copilot CLI) plus a custom agent + skills to help you create a Business Requirements Document (BRD).

## Screenshot

![Web app dashboard](public/stitch-dashboard/screen.png)

## Prerequisites

- Bun installed
- GitHub Copilot CLI installed and authenticated
- GitHub Copilot subscription

## Run locally

```powershell
cd .\brd-app
bun install
bun run .\server.js
```

Open http://localhost:3000

## Tests

Run regression tests (does not require Bun):

```powershell
cd .\brd-app
npm run test:node
```

If you have Bun installed:

```powershell
cd .\brd-app
bun test
```

## How it works

```text
User → Web UI → Bun HTTP Server → Copilot SDK → Copilot CLI (custom agent + skills)
```

- Agent config is loaded from `.github/agents/brd-creator.agent.md`
- Skills are loaded from `.github/skills/*/SKILL.md`

## Notes

- This web app is intended for personal/internal use on a machine with Copilot CLI auth.
- For distribution to others, use the VS Code extension.
