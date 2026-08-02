# Changelog

- Added OpenCode Console as a first-class OpenAI-compatible provider with its
  official inference endpoint and dedicated provider branding.
- MCP API-key dialogs now return to the Tool connections panel, while closing
  a toast or dialog no longer closes the Settings surface underneath it.
- Opening a dropdown now closes any other open picker or approval menu.
- Agent activity shimmer now stops as soon as a step is completed or archived.
- Preserved boolean JSON Schema values in MCP tool definitions, including
  `additionalProperties`, for provider-compatible Stitch tools.
- “Clear all” now offers Review, keep-all-and-delete, or undo-all-and-delete
  whenever any file change is still pending. Review opens the newest affected
  conversation, while legacy unbound changes remain visible for resolution.
- Delete confirmations now close the history popover before opening, and an
  active Agent run produces an explicit stop dialog instead of a hidden toast.
  History titles are derived from the conversation goal, remove greetings and
  filler, preserve common technical acronyms, and update existing entries.
- Deleting a chat with pending file changes now offers Review, keep-and-delete,
  or undo-and-delete paths instead of blocking without a next step. Opening an
  older chat and sending a new message immediately moves it to the top of the
  history list, which is always ordered by latest activity.
- Removed leaked DSML tool-call control markers from Agent output, prevented
  long prose wrapped in stray backticks from becoming oversized inline-code
  highlights, enabled wrapping when Review opens a diff with wrapping disabled,
  and instructed Agent writes to preserve paragraphs in prose files.
- Model availability checks now use the same plain chat-completion probe as
  9Router instead of inferring tool requirements from model-name prefixes.
  Slow probes are shown as inconclusive rather than falsely unavailable, and
  known provider errors follow the selected Vietnamese or English UI language.
- Connection Center now opens consistently from both the connection action and
  provider badge for every provider, not only 9Router.
- Provider API keys are preserved in SecretStorage per profile and provider.
  Switching provider or reloading keeps the saved key without exposing it back
  into the password field.
- Removed custom and stale-model injection from the picker, so the visible list
  now contains only models returned by the active provider API. Model brand
  marks are centered inside their icon frames.
- Added a state-aware scroll-to-bottom control: it keeps the animated dots
  while Agent is running, becomes a down arrow when the run is idle, and no
  longer pulls readers away from the position they deliberately scrolled to.
- Model checks now distinguish temporary rate limits from unavailable models,
  show a yellow limited state with the actual reason, and use a smaller probe
  burst to avoid producing false red failures on free providers.
- Fixed the connection event crashing on an undeclared `language` variable.
  Successful diagnostics now flow through to the provider badge and model
  picker instead of leaving the primary UI stuck on "Checking".
- Added host-driven webview initialization for Antigravity so provider status
  and models no longer depend on the webview's first bridge message. Startup
  logs now record the exact loaded version/path and any webview runtime error.
- Fixed an Antigravity startup race where the webview could emit its one-shot
  ready signal before RelayCode registered the message listener, leaving the
  status on "Checking" and the model picker empty indefinitely. The startup
  handshake now also retries until the host acknowledges it.
- Fixed Chat startup waiting on a potentially large skill/plugin scan before
  showing provider status and models. Provider synchronization now completes
  first while skill discovery continues safely in the background.
- Fixed connection-state ordering so a successful connection cannot be
  overwritten by the configuration event. The compact provider badge now
  reflects the active provider, and model loading retries once if the initial
  webview sync is incomplete.
- Anchored the running three-dot control directly above the composer, refined
  approval cards, and made each completed Agent turn retain its changed-file
  summary. Review now opens every change, including new files, in a native
  before/after diff so additions and removals are highlighted by the IDE.
- Completed turns now include the authoritative final response so Antigravity
  can recover text when incremental stream events are missed. Chat history also
  supports a confirmed “Clear all” action while protecting pending file reviews.
- Fixed OpenAI-compatible Agent streams that remained active after receiving
  `[DONE]`, and made both completed turns and Stop acknowledgements release the
  composer immediately instead of waiting on the typing animation.
- Fixed Kiro streams that end with `finish_reason` but omit `[DONE]`, and made
  the visible Stop control release the composer immediately on user input.
- Completed analysis-only activity now disappears instead of leaving a
  misleading "request analyzed" row; stopping clears all intermediate trace UI.
- Live activity is now removed unconditionally when a turn settles, including
  the render-failure fallback, and new/rapid turns stay anchored to chat bottom.
- Successful replies now release the run immediately while draining buffered
  text at a readable pace. Review opens a native IDE diff tab; the old popup
  markup and event path have been removed.
- The activity shimmer now uses a narrower five-second sweep with a pause,
  avoiding the impression that the whole status flashes at once.
- Review now opens newly created files in the normal editor instead of showing
  an empty-to-full diff whose change gutter covers the entire document.
- Turn completion is now posted before session/checkpoint persistence, with a
  fail-safe UI settlement path that always clears streaming state and Stop.

- Fixed a run-ownership race where an older request could clear a newer request's abort controller, leaving the Stop button visible but unable to cancel. Stop now also invalidates requests that are still preparing, a reloaded webview reattaches to the live run, and recovery cards can only be emitted during startup—not alongside a live or just-finished turn.
- Agent recovery state now uses versioned, serialized persistence so a late checkpoint cannot recreate a run after Stop. Duplicate recovery cards are replaced by one run-scoped card, resume is idempotent, completed stale runs are cleaned on reload, and New chat/session deletion removes related recovery state.
- Stop now cancels the active model request, terminal process, MCP call, approval prompt and tool-failure dialog through one abort path. The send control remains an unambiguous Stop button throughout a run, with regression coverage for MCP and approval waits.
- Agent progress and final responses are now bounded to a Codex-like concise rhythm even when a provider returns long internal narration. Completed messages also remove the streaming caret defensively.
- MCP OAuth completion pages now show the real service icon instead of a letter placeholder. Agent, recovery and goal resumes switch the composer to its stop state immediately, while narrow layouts preserve a clear gap between the model selector and send/stop control.
- Figma Desktop setup now distinguishes saved configuration from a live connection, explains the exact Dev Mode steps, keeps the setup dialog open after viewing the guide, and provides an in-place retry that only reports success after MCP tools load.
- The MCP OAuth result is now a responsive RelayCode-to-service handoff page with clear success and recovery states. Every label follows the interface language selected in RelayCode, including Vietnamese and English.
- First-time MCP OAuth now completes in one pass without a stale “waiting for browser” state overwriting the live connection. The loopback callback uses a shorter route, clears OAuth query details from the browser address bar, and shows a redesigned RelayCode result page.
- Completed chat turns now always remove the streaming caret. MCP authentication dialogs preserve the connection panel underneath and report persistent success, pending or failure status without returning to Chat.
- MCP connections now tolerate incomplete `$ref`/`$defs` output schemas such as Google Stitch's `ScreenInstance`, inline portable input schemas for every model provider, load paginated tool catalogs, and generate collision-safe tool names.
- Live activity now uses a smooth three-second repeating sweep, completed command traces are removed, terminal rows match Codex's compact presentation, Review can collapse during a run, and accepted/undone files remain as disabled history rows.
- Change summaries now appear only after a run finishes, terminal/activity updates preserve the reader's scroll position, and the changed-files tray keeps a fixed near-half-panel height.
- Plan trees now separate bright, semibold node names from subdued comments and connectors for faster scanning. The one-shot activity text sweep is 60% slower to reduce visual distraction.
- English mode now localizes Settings, MCP connections, chat actions and the complete Usage dashboard. Flat full-path project diagrams are automatically rebuilt into compact nested directory trees, and Plan prompts now require parent-relative node names.
- Plan file structures now use compact Codex-style fenced trees with inline comments and copy controls. Plan toolbar and Review menu icons now support the raw SVG format emitted by the production esbuild bundle as well as data URLs used by tests.
- Completed plans are now stored as persistent chat artifacts with an Open plan action, so the editor tab can be restored after it is closed or after an older chat is reopened. Agent activity shimmer speed is reduced by 50%.
- Plan documents now recognize directory trees and render them as compact, responsive project outlines with folder/file icons, connectors, wrapped descriptions, and a bounded scrollbar-free viewport instead of oversized raw code blocks.

## Unreleased

- Added a dedicated Implementation Plan editor with safe Markdown rendering, review/save/revise actions and explicit approval before handing work to Agent mode.
- Added a safe Agent web reader for HTTP(S) links, with redirect validation, HTML cleanup, request limits and localized live activity.
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
- Added an OS-aware command runtime with strict PowerShell error propagation, working-directory validation, timeouts and process-tree cancellation.
- Added an automatic test-and-repair loop: validation runs from the nearest changed project (including nested apps and monorepos), then failures return to the Agent so it can fix the cause and rerun the relevant checks.
- Added native file inspection, directory, delete, move and Git diff tools, with command-created changes included in Review and Undo.
- Replaced blind retries of failed tool calls with model-guided repair and clearer malformed-argument feedback.
- Preserved pending validation and refreshed current shell/runtime instructions when an interrupted Agent run resumes after an IDE reload or model change.
- Split the usage dashboard into quota and token-usage tabs, with persistent selection, keyboard navigation and visually distinct section headers.
- Matched Codex-style sidebar resizing: RelayCode stays responsive down to 344 CSS pixels, then collapses the host sidebar after a deliberate narrower drag on either the left or right.
- Reduced Agent activity repainting with a slow opacity-only highlight that is not restarted by status updates and never animates hidden trace rows.
- Repaired interrupted multi-tool histories so Anthropic and OpenAI-compatible providers always receive a matching result for every tool call.
- Localized live Agent activity, removed the step counter and added semantic green/red change totals.
- Rebuilt Review as an in-extension diff surface with per-hunk and per-file Accept or Undo plus an optional full VS Code diff.
- Scoped pending reviews to their originating conversation so a new or blank chat never inherits another session's Accept/Undo controls.
- Bounded large change lists with progressive rendering, an independently scrollable file area and an always-visible bulk action footer.
- Consolidated bulk conflict handling into one confirmation, protected externally edited files and serialized Review actions to prevent repeated dialogs.
- Removed the duplicate "actual changes" transcript dump and replaced it with a compact Codex-style Review card showing up to three files.
- Fixed the empty Review tray remaining visible when there are zero changed files.
- Kept the model picker open throughout model health checks and moved selected skill/slash tokens to a dedicated row above the prompt.
- Normalized function-call adjacency before every Agent request for strict Gemini-compatible gateways.
- Scoped Codex reasoning and service-tier parameters to Codex-compatible models so they cannot leak into Gemini or Claude after a model switch.
- Marked hallucinated tool names as repairable Agent errors instead of treating them as successful tool results.

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
