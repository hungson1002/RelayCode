<div align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/media/icon-128.png" alt="RelayCode" width="72" style="border-radius: 10px;">
  <h1>RelayCode</h1>
  <p><strong>A review-first AI coding workspace for VS Code-compatible editors.</strong></p>
  <p>Works with VS Code, Cursor, Antigravity, and other compatible environments.</p>
  <p>Ask, plan, edit, run checks, and review every change before you keep it.</p>
  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon">VS Code Marketplace</a> ·
    <a href="https://open-vsx.org/extension/huxon/relaycode-huxon">Open VSX</a> ·
    <a href="https://github.com/hungson1002/RelayCode/releases">Releases</a> ·
    <a href="https://github.com/hungson1002/RelayCode/issues">Issues</a> ·
    <a href="LICENSE">License</a> ·
    <a href="README.vi.md">Tiếng Việt</a>
  </p>
</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-home.png" alt="RelayCode home with model picker and composer" width="580" style="border-radius: 10px;">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-demo.gif" alt="RelayCode Agent workflow: ask, work, and review" width="580" style="border-radius: 10px;">
</p>

<p align="center"><em>Ask, let Agent work, then review the result before accepting it.</em></p>

## What is RelayCode?

RelayCode brings Chat, Agent, and Plan into the current VS Code workspace. It connects to the provider and model you choose, keeps activity visible, and makes file changes reviewable before they become part of your project.

## Why RelayCode?

- **Review-first changes** — inspect changed files and diffs before accepting or undoing them.
- **Visible activity** — follow the current step, tool activity, analyzed files, and validation results.
- **Permission controls** — choose how much autonomy Agent has for file edits and commands.
- **Multi-provider routing** — switch between provider profiles, endpoints, and models without changing the workflow.
- **MCP and workspace context** — connect configured MCP servers and let Agent work with the current project context.
- **Streaming responses** — see the answer develop while Agent works.
- **Automatic language matching** — responses follow the language of the latest user message when supported by the selected model.

## Three ways to work

### Chat

Ask for an explanation, review, or focused answer without giving the model workspace editing duties.

### Agent

Let Agent inspect the workspace, edit files, run approved commands, use configured MCP tools, and report what it did. The activity timeline and change tray keep the workflow visible.

### Plan

Turn a larger request into an implementation plan before touching files. Use it when the change needs discussion, sequencing, or a clear checkpoint first.

## Reviewable changes

Agent keeps edits in a reviewable change set. Inspect the changed files and diff, then accept the result or undo it from the change tray.

## See it in action

The real interface keeps the main workflow in one place: prompt, model, mode, activity, and review controls.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-agent.png" alt="RelayCode Agent response with workspace analysis and validation" width="580" style="border-radius: 10px;">
</p>

Agent reports analyzed files, project context, and validation results in the conversation.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-review.png" alt="RelayCode review card with changed README file and Accept and Undo controls" width="580" style="border-radius: 10px;">
</p>

The review tray shows which files changed and exposes **Review**, **Accept all**, and **Undo all** actions.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-connection.png" alt="RelayCode provider settings with multiple provider options" width="580" style="border-radius: 10px;">
</p>

Provider settings keep the active profile, endpoint configuration, model source, and connection details in one place. Credentials are not included in the interface captures.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/workflow.png" alt="RelayCode workflow: ask, work, review, decide" width="580" style="border-radius: 10px;">
</p>

## Quick start

1. Install RelayCode from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon), [Open VSX](https://open-vsx.org/extension/huxon/relaycode-huxon), or the [GitHub Releases](https://github.com/hungson1002/RelayCode/releases) page.
2. Open the RelayCode view from the Activity Bar.
3. Open **Settings**, create or select a provider profile, and configure its endpoint and API key when required.
4. Pick a model, choose **Chat**, **Agent**, or **Plan**, and send your first prompt.

For a local-first setup, run [9Router](https://github.com/hungson1002/9router) and use its default OpenAI-compatible endpoint:

```text
http://127.0.0.1:20128/v1
```

## Providers and models

RelayCode includes provider profiles for:

- 9Router
- Cockpit Tools
- OpenCode
- OpenAI
- Anthropic Claude
- OpenAI-compatible endpoints
- Ollama
- LM Studio

The model picker reflects the models available from the active provider. Profile-specific endpoints, API keys, and pricing settings stay separate so you can change providers without rewriting the workflow.

## MCP, context, and skills

RelayCode can connect to configured MCP servers over local process or HTTP transports, including OAuth or bearer-token flows where the server supports them. Agent can use those tools together with workspace files and the current conversation context.

Skills and project instructions remain part of the context you provide to the model. Keep external tools and instructions scoped to the workspaces where they are trusted.

## Permission controls

- Choose **Ask**, **Edit files**, or **Full access** according to the task and trust level.
- Use the least permissive mode that fits the work.

## Safety and privacy

- Workspace Trust and the selected permission mode apply to Agent actions.
- Review file changes before accepting them; undo is available from the change tray.
- API keys are stored with VS Code Secret Storage and are not written to project files.
- Provider requests are sent only when you use a configured provider.
- MCP authentication depends on the server and its authorization policy.

Read the full [Privacy Policy](PRIVACY.md).

## Configuration

RelayCode settings are available from the sidebar settings button and from VS Code settings. Common options include:

- Interface language: `Vietnamese` or `English`.
- Provider profile, endpoint, and API key.
- Default mode: `Chat` or `Agent`.
- Default model and model health checks.
- Input and output pricing for local usage estimates.

## FAQ

### Does RelayCode require one specific model provider?

No. Choose a built-in provider or configure an OpenAI-compatible endpoint. Available models depend on the active provider.

### Can Agent change files automatically?

Only according to the selected permission mode. Changes are shown in the review tray so you can inspect, accept, or undo them.

### Can I use RelayCode with local models?

Yes. Ollama, LM Studio, 9Router, and other compatible local endpoints can be configured through provider profiles.

### What happens if a provider is unavailable?

RelayCode reports the connection or model error in the sidebar. Switch profiles or choose another available model from the picker.

## Development

```powershell
npm install
npm run check
npm run build
```

Press `F5` to launch an Extension Development Host. See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Resources

- [Privacy Policy](PRIVACY.md)
- [Changelog](CHANGELOG.md)
- [GitHub Releases](https://github.com/hungson1002/RelayCode/releases)
- [GitHub Issues](https://github.com/hungson1002/RelayCode/issues)
- [Vietnamese README](README.vi.md)

## License

[MIT](LICENSE)
