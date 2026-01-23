# BRD Creator - VS Code Extension

Create comprehensive Business Requirements Documents using GitHub Copilot as your AI business analyst.

## Features

- **AI-Powered BRD Generation**: Uses GitHub Copilot with a custom business analyst agent
- **Structured Templates**: Follows industry-standard BRD format
- **Interactive Q&A**: Agent asks clarifying questions to ensure completeness
- **Skills Integration**: Loads domain-specific skills for requirements gathering and structuring
- **Local & Private**: Runs entirely in your VS Code with your own Copilot subscription

## Prerequisites

- Visual Studio Code 1.85.0 or higher
- GitHub Copilot subscription (Individual, Business, or Enterprise)
- GitHub Copilot CLI authenticated on your machine

## Installation

### From VSIX (recommended for testing)

1. Download the `.vsix` file
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
4. Click "..." → "Install from VSIX..."
5. Select the downloaded file

### From source

```bash
cd vscode-extension
npm install
npm run compile
```

Then press F5 in VS Code to launch the Extension Development Host.

## Usage

### Quick Start

1. Open a workspace folder in VS Code
2. Copy the `.github/` folder (with agents and skills) to your workspace root
3. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
4. Run: **BRD Creator: Start New BRD**
5. Answer the prompts
6. Your BRD will be generated in a new Markdown document

### Commands

- `BRD Creator: Start New BRD` - Create a new BRD from scratch
- `BRD Creator: Open Dashboard` - Open interactive dashboard panel

### Using Custom Agent & Skills

The extension automatically loads:
- Agent configuration from `.github/agents/brd-creator.agent.md`
- Skills from `.github/skills/*/SKILL.md`

Place these files in your workspace root. The extension will use them to customize the BRD generation behavior.

## Architecture

```
Your Workspace
├── .github/
│   ├── agents/
│   │   └── brd-creator.agent.md    # Custom agent
│   └── skills/
│       ├── brd-gathering/          # Requirements skill
│       └── brd-structuring/        # Structuring skill
└── (your project files)
```

The extension:
1. Loads your custom agent and skills from `.github/`
2. Creates a local Copilot session with your authenticated CLI
3. Uses the agent to generate BRDs in Markdown format
4. Saves output directly to your workspace

## Configuration

No settings required! The extension uses your existing Copilot authentication.

## Requirements

- An active GitHub Copilot subscription
- Copilot CLI authenticated (`gh copilot auth login` or similar)

## Known Issues

- Requires Copilot CLI to be installed and authenticated
- Long BRD generation may take 30-60 seconds

## Release Notes

### 0.1.0

- Initial release
- Basic BRD generation
- Custom agent and skills support
- Interactive Q&A

## Contributing

This extension uses the GitHub Copilot SDK. See [extension source](https://github.com/your-org/brd-creator-extension) for details.

## License

MIT
