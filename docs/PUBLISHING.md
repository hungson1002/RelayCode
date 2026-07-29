# Publishing RelayCode

> Maintainer guide. This file is not included in the published VSIX.

RelayCode can be published to both extension registries from the same VSIX:

- **Visual Studio Marketplace** for Microsoft VS Code.
- **Open VSX** for Antigravity and other Open VSX-compatible editors.

The extension identifier is:

```text
huxon.relaycode
```

Source repository: `https://github.com/hungson1002/RelayCode`.
RelayCode is a product by **Huxon**.

## One-time setup

### Visual Studio Marketplace

1. Create a publisher whose ID is exactly `huxon`.
2. Create a Marketplace publishing token.
3. Add it to the GitHub repository as the Actions secret `VSCE_PAT`.

### Open VSX

1. Sign in to Open VSX with GitHub.
2. Claim or create the namespace `huxon`.
3. Create an access token.
4. Add it to the GitHub repository as the Actions secret `OVSX_PAT`.

The publisher ID and Open VSX namespace must match the `publisher` field in
`package.json`. If `huxon` is unavailable in either registry, change the
manifest to a namespace owned in both registries before the first release.

## Automated release

The workflow at `.github/workflows/publish-extension.yml` runs whenever a GitHub
Release is published. It verifies, packages and publishes the same version to
every registry whose token is configured.

Before publishing a release:

1. Update `version` in `package.json`.
2. Run `npm install` so `package-lock.json` carries the same version.
3. Commit and push the release changes.
4. Create a matching Git tag such as `v1.0.1`.
5. Publish the GitHub Release.

## Manual publishing

```powershell
$env:VSCE_PAT = "your-marketplace-token"
npm run publish:vscode

$env:OVSX_PAT = "your-open-vsx-token"
npm run publish:openvsx
```

Never commit either token to the repository.
