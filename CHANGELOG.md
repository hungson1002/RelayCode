# Changelog

## Unreleased

- Added Cockpit Tools as a first-class provider with a secure Client Key, the default local API Service endpoint, model discovery, diagnostics and setup guidance.
- Redesigned usage analytics around the active provider, with real rate-limit bars, provider-specific records and no external icon requests.
- Floating panels now close on outside clicks or when another panel opens.
- Replaced raw HTTP 401/403 responses with actionable credential and account recovery messages.
- Added Agent-only image generation through OpenAI-compatible `/images/generations`, including model discovery, approval, Review and Undo.
- Established Huxon as the publisher and parent brand for RelayCode.
- Added Codex-compatible `SKILL.md` discovery with a searchable `$` picker.
- Added user, workspace and nearest-file `AGENTS.md` instructions.
- Preserved recent Agent conversation turns for reliable follow-up requests.
- Added persistent `/goal` tasks with pause, resume and clear controls above the composer.
- Added a follow-up queue so prompts sent during a run execute next without interrupting the current task.
- Added `/compact` and `/model` alongside `/skills`, `/plan`, `/review` and `/status`.
- Added provider wait heartbeats and a configurable inactivity watchdog.
- Added attachment loading feedback and text-file context outside the workspace.
- Tightened completion verification so edit requests cannot report success without a successful file mutation.
- Added automatic post-edit validation with project-aware commands for Node.js, Rust, Go, Python and .NET.
- Added a shared provider/model/MCP brand registry with official color icons, including Kiro `kr/*` routing and extensible matching for newly discovered models.
- Added safe provider-profile deletion with confirmation, secret-key cleanup and automatic fallback to a remaining profile.
- Removed Docker/Podman sandbox controls and execution from the extension.
- Added an 8-second provider preflight, actionable stalled-9Router recovery and accurate connection timeouts.
- Moved Git checkpoints to the background immediately before the first real file mutation.

## 1.0.0

Initial public release of RelayCode — AI Coding Agent.

- Agent, Chat and Plan workflows with multi-provider model support.
- 9Router, OpenAI, Anthropic, OpenAI-compatible, Ollama and LM Studio providers.
- Reviewable workspace changes with per-file and per-hunk Accept or Undo.
- Git checkpoints, Workspace Trust and configurable approval policies.
- MCP connections, OAuth flows and custom local or remote MCP servers.
- Model health checks, fallback routing, profiles and usage telemetry.
- Persistent chat history, task recovery, diagnostics and context compaction.
- English and Vietnamese interface languages with bilingual repository documentation.
