<div align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/media/icon-128.png" alt="RelayCode" width="72">
  <h1>RelayCode</h1>
  <p><strong>A review-first AI coding workspace for VS Code-compatible editors.</strong></p>
  <p>Chat, plan, edit, run checks, and review changes without leaving your project.</p>
  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon">Marketplace</a> ·
    <a href="https://open-vsx.org/extension/huxon/relaycode-huxon">Open VSX</a> ·
    <a href="https://github.com/hungson1002/RelayCode/releases">Releases</a> ·
    <a href="https://github.com/hungson1002/RelayCode/issues">Issues</a> ·
    <a href="README.vi.md">Tiếng Việt</a>
  </p>
</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-home.png" alt="RelayCode workspace" width="680">
</p>

## Overview

RelayCode brings AI-assisted development into the current workspace while keeping you in control. Choose a provider and model, work in Chat, Agent, or Plan mode, and inspect file changes before accepting them.

It runs in VS Code, Antigravity, Cursor, and other compatible editors.

## Highlights

- **Review-first editing** — inspect diffs, then accept or undo changes.
- **Visible execution** — follow tool calls, commands, validation, and failures in the timeline.
- **Chat, Agent, and Plan** — use the right level of autonomy for each task.
- **Multiple providers** — keep separate profiles for cloud, local, and OpenAI-compatible endpoints.
- **MCP tools** — extend Agent with trusted local or remote services.
- **Permission controls** — decide when RelayCode may edit files or run commands.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-demo.gif" alt="RelayCode Agent and review workflow" width="680">
</p>

## Quick start

1. Install RelayCode from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon), [Open VSX](https://open-vsx.org/extension/huxon/relaycode-huxon), or [Releases](https://github.com/hungson1002/RelayCode/releases).
2. Open **RelayCode: Chat** from the Activity Bar.
3. Open **Settings** and connect a provider profile.
4. Select a model and choose **Chat**, **Agent**, or **Plan**.

For a local setup with [9Router](https://github.com/hungson1002/9router), use its OpenAI-compatible endpoint:

```text
http://127.0.0.1:20128/v1
```

## Modes

- **Chat** answers questions without editing the workspace.
- **Agent** can inspect files, edit code, run approved commands, and use MCP tools.
- **Plan** prepares a reviewable implementation plan before files are changed.

## Providers

RelayCode supports 9Router, Cockpit Tools, OpenCode, OpenAI, Anthropic Claude, Ollama, LM Studio, and custom OpenAI-compatible endpoints. Available models come directly from the active provider profile.

API keys are stored with the editor's Secret Storage and are not written to project files.

## MCP connections

MCP lets RelayCode use additional tools such as browser automation, external services, or specialized project workflows. Open **Settings → MCP**, add a local process or HTTP server, complete authentication when required, and enable only tools you trust for the current workspace.

MCP actions appear in the activity timeline and remain subject to RelayCode's permission and review flow.

### ChatGPT Web

Run `/chatgpt` or **RelayCode: Manage ChatGPT Web Bridge** to connect ChatGPT through a secure MCP tunnel. RelayCode guides you through the Tunnel ID and Runtime API key, verifies the official tunnel client, and stores the key in Secret Storage.

When ChatGPT Web uses a RelayCode tool, a dedicated **ChatGPT Web** timeline appears in chat history. File reads, searches, edits, commands, and failures are recorded there. File changes use the same **Review**, **Accept**, and **Undo** workflow as Agent changes.

MCP shares tool activity, not the full ChatGPT conversation. See OpenAI's [Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) for account and Developer mode setup.

## Safety

- Use the least permissive mode that fits the task.
- Review file changes before accepting them.
- Connect only MCP servers you trust.
- Keep Workspace Trust enabled only for trusted projects.

See the [Privacy Policy](PRIVACY.md) for details.

## Development

```powershell
npm install
npm run check
npm run build
```

Press `F5` to launch an Extension Development Host. Release notes are available in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
