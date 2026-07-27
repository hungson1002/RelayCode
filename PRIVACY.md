# Privacy

Lối stores provider and MCP credentials in the IDE SecretStorage. Credentials are not written to chat history, diagnostics exports or Agent logs.

Prompts, selected workspace context and attachments are sent only to the provider profile selected by the user. MCP tool input is sent only to MCP servers the user has configured.

Local chat history, telemetry, pending review snapshots and preferences are stored by the IDE on the user's machine. The extension does not operate an analytics service.

When sandbox mode is active, workspace files are copied to a temporary local directory and mounted into a temporary Docker or Podman container. The container is removed after the task. Network access is disabled by default and can be enabled in settings.

Users can delete chat history and telemetry from the extension interface and can uninstall the extension to remove its local runtime data.
