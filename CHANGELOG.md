# Changelog

## Unreleased

- Added Codex-compatible `SKILL.md` discovery with a searchable `$` picker.
- Added user, workspace and nearest-file `AGENTS.md` instructions.
- Preserved recent Agent conversation turns for reliable follow-up requests.
- Added `/skills`, `/plan`, `/review` and `/status` composer commands.
- Added provider wait heartbeats and a configurable inactivity watchdog.
- Added attachment loading feedback and text-file context outside the workspace.
- Tightened completion verification so edit requests cannot report success without a successful file mutation.
- Removed Docker/Podman sandbox controls and execution from the extension.
- Added an 8-second provider preflight, actionable stalled-9Router recovery and accurate connection timeouts.
- Moved Git checkpoints to the background immediately before the first real file mutation.

## 1.0.0

Initial public release of Lối — AI Coding Agent.

- Agent, Chat and Plan workflows with multi-provider model support.
- 9Router, OpenAI, Anthropic, OpenAI-compatible, Ollama and LM Studio providers.
- Reviewable workspace changes with per-file and per-hunk Accept or Undo.
- Git checkpoints, Workspace Trust and configurable approval policies.
- MCP connections, OAuth flows and custom local or remote MCP servers.
- Model health checks, fallback routing, profiles and usage telemetry.
- Persistent chat history, task recovery, diagnostics and context compaction.
- English and Vietnamese interface languages with bilingual repository documentation.
