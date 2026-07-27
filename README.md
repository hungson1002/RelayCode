<div align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/Loi-Code/main/docs/assets/hero.png" alt="Lối — AI Coding Agent" width="100%">
  <br><br>
  <strong>An AI coding workspace for VS Code and Antigravity — built around your models, your tools and your approval.</strong>
  <br><br>
  <a href="https://github.com/hungson1002/Loi-Code/blob/main/README.md">English</a> · <a href="https://github.com/hungson1002/Loi-Code/blob/main/README.vi.md">Tiếng Việt</a>
</div>

---

## What is Lối?

Lối brings **Agent**, **Chat** and **Plan** workflows into one focused sidebar. Connect a cloud API, a local model or 9Router; give the Agent a task; watch its terminal and tool activity; then review every file before accepting it.

It is designed for developers who want a model-agnostic coding agent without giving up visibility or control.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/Loi-Code/main/docs/assets/workflow.png" alt="Ask, work, review, accept or undo workflow" width="100%">
</p>

## Highlights

| Area | What you get |
| --- | --- |
| **Agent, Chat & Plan** | Use Agent for workspace tasks, Chat for direct questions and Plan for a review-first approach. |
| **Any model source** | 9Router, OpenAI, Anthropic Claude, OpenAI-compatible APIs, Ollama and LM Studio. |
| **Visible execution** | Follow commands, terminal output, tool calls and task progress directly in the conversation. |
| **Reviewable edits** | Inspect changed files and individual hunks, then Accept or Undo per file, task or change set. |
| **Approval policies** | Ask for approval, allow edits or enable Full access with an explicit confirmation. |
| **Safer runs** | Workspace Trust, command policies, Git checkpoints and optional Docker/Podman isolation. |
| **MCP tools** | Connect supported services through OAuth, API keys, HTTP or local stdio MCP servers. |
| **Model health** | Check which models respond, keep favorites and configure confirmed fallback routing. |
| **Usage visibility** | Inspect tokens, estimated cost, latency and available rate-limit headers. |
| **Persistent workspace** | Chat history, pending reviews, task recovery, profiles and diagnostics survive reloads. |
| **English & Vietnamese** | Change the interface language from the extension settings panel. |

## Supported providers

| Provider | Authentication | Default endpoint |
| --- | --- | --- |
| 9Router | API key | `http://localhost:20128/v1` |
| OpenAI | API key | Official OpenAI API |
| Anthropic Claude | API key | Anthropic Messages API |
| OpenAI-compatible | Depends on the provider | Your custom endpoint |
| Ollama | None by default | `http://localhost:11434/v1` |
| LM Studio | None by default | `http://localhost:1234/v1` |

Local providers do not normally require an API key, but their local server must be running and a model must be downloaded.

## Install

### From a release

1. Download `loi-agent-1.0.0.vsix` from the [Lối releases page](https://github.com/hungson1002/Loi-Code/releases).
2. Open VS Code or Antigravity.
3. Run **Extensions: Install from VSIX…** from the Command Palette.
4. Select the downloaded file and reload the IDE.

### From source

```powershell
git clone https://github.com/hungson1002/Loi-Code.git
cd Loi-Code
npm install
npm run check
```

Press `F5` to open an Extension Development Host.

## First connection

1. Open the **Lối** icon in the Activity Bar.
2. Select **Settings**.
3. Choose a provider or create a provider profile.
4. Enter the endpoint and API key when required.
5. Save, select a model and send a small test prompt.

For 9Router, Lối can detect the local service, offer to install it, start it without a separate terminal and open its management page in your browser.

## Working with the Agent

The composer supports files, pasted images and quick workspace context:

```text
@selection
@file:path/to/file.ts
@folder:path/to/folder
@terminal
@git-diff
@problems
```

Useful slash commands:

```text
/new
/models
/diagnostics
/mcp
/settings
/logs
/export
```

After a task, Lối shows the number of changed files and total additions/removals. Use **Review** for the full diff or individual hunks, then choose **Accept** or **Undo**. Undoing a newly created file removes that file.

## Permissions and safety

Lối offers three approval levels:

- **Ask for approval** — confirm actions before the Agent performs them.
- **Allow edits** — permit workspace edits while retaining safeguards for riskier operations.
- **Full access** — allow file edits and commands without repeated prompts. Enabling it always requires confirmation.

Important safeguards:

- VS Code Workspace Trust is required for Agent, terminal and MCP execution.
- A deny list blocks configured destructive command fragments even in Full access.
- Git repositories receive a checkpoint before Agent tasks when possible.
- Pending changes stay reviewable and can be recovered after an IDE reload.
- Provider and MCP credentials are stored in VS Code `SecretStorage`.

## Sandbox execution

Lối can stage the workspace in a temporary directory and run commands inside Docker or Podman:

- **Sandbox required** — refuse to run if no container runtime is available.
- **Sandbox preferred** — use isolation when available and ask before falling back.
- **Direct** — work in the real workspace under the selected approval policy.

The container drops Linux capabilities, applies CPU/RAM/PID limits and disables network access by default. Sandbox changes are copied to the real workspace only after you accept them.

> Docker or Podman is optional. Direct mode works without either runtime.

## MCP

MCP lets the Agent work with external tools such as design systems, issue trackers, documentation, browsers and databases.

Lối supports:

- Browser OAuth when the MCP server allows dynamic client registration.
- API-key and bearer-token authentication.
- Streamable HTTP MCP servers.
- Local stdio MCP servers with separately stored environment secrets.

Some providers restrict OAuth to approved applications. In those cases, use the provider's desktop MCP server, API-key flow or a manually registered OAuth application.

## Privacy

- Lối does not operate an analytics service.
- Prompts and selected context are sent only to the active provider.
- MCP input is sent only to MCP servers you configured.
- Credentials are kept in `SecretStorage` and excluded from diagnostics.
- Chat history, telemetry and pending reviews remain on the local machine.

Read the complete policy in <a href="https://github.com/hungson1002/Loi-Code/blob/main/PRIVACY.md">PRIVACY.md</a>.

## Current limitations

- Cloud cost estimates require input/output prices in the provider profile.
- Model checks make a minimal request and may consume quota.
- A network-disabled sandbox cannot download missing dependencies.
- OAuth availability depends on each MCP provider's authorization policy.
- Agent quality and tool support vary by model.

## Development

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package
```

The project currently requires Node.js 20+ and VS Code 1.100+.

## License

<a href="https://github.com/hungson1002/Loi-Code/blob/main/LICENSE">MIT</a>
