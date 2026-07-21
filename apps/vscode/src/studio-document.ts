import { randomBytes } from "node:crypto"

import { isStudioRoute, type StudioRoute } from "./studio-protocol.js"
import { studioStyles } from "./studio-styles.js"

export interface StudioDocumentOptions {
  cspSource: string
  clientScriptUri: string
  codiconStylesUri?: string
  channelId: string
  nonce: string
  initialRoute?: StudioRoute
}

export function createStudioNonce(): string {
  return randomBytes(24).toString("base64url")
}

const hostCreatedUriPattern = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s'";\\]+$/

function requireCspToken(value: string, label: string): string {
  if (!hostCreatedUriPattern.test(value)) {
    throw new Error(`${label} must be a host-created URI without CSP delimiters`)
  }
  return value
}

function requireCspSourceList(value: string, label: string): string {
  if (
    value.length > 2_048 ||
    value.trim() !== value ||
    value.includes("  ") ||
    /[\u0000-\u001f\u007f;"\\]/u.test(value)
  ) {
    throw new Error(`${label} must be a bounded host-created CSP source list`)
  }
  const tokens = value.split(" ")
  if (tokens.length < 1 || tokens.length > 4 || new Set(tokens).size !== tokens.length) {
    throw new Error(`${label} must contain one to four unique CSP sources`)
  }
  let uriCount = 0
  for (const [index, token] of tokens.entries()) {
    if (token === "'self'") {
      if (index !== 0) throw new Error(`${label} permits 'self' only as the first source`)
      continue
    }
    if (!hostCreatedUriPattern.test(token)) {
      throw new Error(`${label} contains a non-host URI or unsupported CSP keyword`)
    }
    uriCount += 1
  }
  if (uriCount === 0) throw new Error(`${label} requires at least one host-created URI source`)
  return tokens.join(" ")
}

function requireOpaqueToken(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(value)) throw new Error(`${label} must be an opaque base64url token`)
  return value
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export function createStudioDocument(options: StudioDocumentOptions): string {
  const cspSource = requireCspSourceList(options.cspSource, "CSP source")
  const clientScriptUri = requireCspToken(options.clientScriptUri, "Client script URI")
  const codiconStylesUri = options.codiconStylesUri
    ? requireCspToken(options.codiconStylesUri, "Codicon stylesheet URI")
    : undefined
  const nonce = requireOpaqueToken(options.nonce, "CSP nonce")
  const channelId = requireOpaqueToken(options.channelId, "Studio channel ID")
  const route = options.initialRoute ?? "overview"
  if (!isStudioRoute(route)) throw new Error("Unknown initial Product Studio route")
  const csp = [
    "default-src 'none'",
    `font-src ${cspSource}`,
    `img-src ${cspSource} data:`,
    `style-src ${cspSource} 'nonce-${nonce}'`,
    `script-src ${cspSource} 'nonce-${nonce}'`,
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(csp)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAEP Product Studio</title>
  ${codiconStylesUri ? `<link nonce="${nonce}" rel="stylesheet" href="${escapeAttribute(codiconStylesUri)}">` : ""}
  <style nonce="${nonce}">${studioStyles}</style>
</head>
<body data-studio-channel="${channelId}" data-studio-route="${escapeAttribute(route)}">
  <div id="studio-root" aria-busy="true">
    <main class="studio-workspace">
      <section class="state-panel" aria-labelledby="studio-loading-title">
        <h1 id="studio-loading-title" class="studio-name">GAEP Product Studio</h1>
        <progress aria-label="Loading Product Studio snapshot"></progress>
      </section>
    </main>
  </div>
  <div id="studio-live-polite" class="live-region" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="studio-live-assertive" class="live-region" role="alert" aria-live="assertive" aria-atomic="true"></div>
  <script nonce="${nonce}" src="${escapeAttribute(clientScriptUri)}"></script>
</body>
</html>`
}
