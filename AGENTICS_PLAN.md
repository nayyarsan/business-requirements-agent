# Agentics Plan — business-requirements-agent

Add [GitHub Agentic Workflows](https://github.com/githubnext/agentics) to the VS Code Copilot BRD extension.

## Prerequisites

```bash
gh extension install github/gh-aw
```

## Workflows to Add

- [ ] **Grumpy Reviewer** — opinionated code review on TypeScript/VS Code extension code; catches subtle agent skill bugs
  ```bash
  gh aw add grumpy-reviewer
  ```

- [ ] **PR Nitpick Reviewer** — fine-grained review focusing on style, conventions, and subtle improvements
  ```bash
  gh aw add pr-nitpick-reviewer
  ```

- [ ] **Agentic Wiki Coder** — implements code changes described in wiki edits; dogfoods the extension's own concept
  ```bash
  gh aw add agentic-wiki-coder
  ```

- [ ] **Contribution Guidelines Checker** — enforces contribution guidelines on all PRs
  ```bash
  gh aw add contribution-guidelines-checker
  ```

- [ ] **Repo Ask** (`/repo-ask` command) — on-demand research into "how does Copilot SDK X work here?"
  ```bash
  gh aw add repo-ask
  ```

- [ ] **Daily Test Improver** — grows test coverage for BRD generation and agent skill logic
  ```bash
  gh aw add daily-test-improver
  ```

- [ ] **Issue Triage** — auto-labels incoming issues and PRs
  ```bash
  gh aw add issue-triage
  ```

- [ ] **Plan** (`/plan` command) — breaks big issues into tracked sub-tasks
  ```bash
  gh aw add plan
  ```

## Keep Workflows Updated

```bash
gh aw upgrade
gh aw update
```
