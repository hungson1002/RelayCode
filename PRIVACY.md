# Privacy

RelayCode stores provider and MCP credentials in the IDE SecretStorage. Credentials are not written to chat history, diagnostics exports or Agent logs.

Prompts, selected workspace context and attachments are sent only to the provider profile selected by the user. MCP tool input is sent only to MCP servers the user has configured.

Local chat history, telemetry, pending review snapshots and preferences are stored by the IDE on the user's machine. The extension does not operate an analytics service.

Agent mode can read and modify files in the selected workspace and can run commands under the permission policy chosen by the user. RelayCode does not copy the workspace into a Docker or Podman container. File contents and command output are sent to the selected model provider only when they are needed to complete the user's request.

Users can delete chat history and telemetry from the extension interface. Provider profiles and MCP connections can also be removed from RelayCode, including credentials stored for those connections.
