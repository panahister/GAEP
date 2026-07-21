import { describe, expect, it } from "vitest"

import { createStudioDocument, createStudioNonce } from "./studio-document.js"

describe("Product Studio webview document", () => {
  it("emits a nonce-bound deny-by-default CSP and native responsive shell", () => {
    const html = createStudioDocument({
      cspSource: "https://*.vscode-cdn.net",
      clientScriptUri: "vscode-webview://studio/client.js",
      codiconStylesUri: "vscode-webview://studio/codicon.css",
      channelId: "channel_token_1234567890",
      nonce: "nonce_token_123456789012",
      initialRoute: "overview",
    })
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("connect-src 'none'")
    expect(html).toContain("object-src 'none'")
    expect(html).toContain("base-uri 'none'")
    expect(html).toContain("'nonce-nonce_token_123456789012'")
    expect(html).toContain('nonce="nonce_token_123456789012"')
    expect(html).not.toContain("unsafe-inline")
    expect(html).not.toContain("unsafe-eval")
    expect(html).toContain("grid-template-columns: 208px minmax(0, 1fr)")
    expect(html).toContain("@media (max-width: 719px)")
    expect(html).toContain("@media (max-width: 479px)")
    expect(html).toContain("var(--vscode-editor-background)")
    expect(html).toContain("prefers-reduced-motion: reduce")
    expect(html).toContain("aria-live=\"polite\"")
    expect(html).toContain("aria-live=\"assertive\"")
  })

  it("rejects CSP delimiter injection and creates base64url nonces", () => {
    expect(() => createStudioDocument({
      cspSource: "https://safe.example; script-src *",
      clientScriptUri: "vscode-webview://studio/client.js",
      codiconStylesUri: "vscode-webview://studio/codicon.css",
      channelId: "channel_token_1234567890",
      nonce: "nonce_token_123456789012",
    })).toThrow(/CSP source/)
    expect(createStudioNonce()).toMatch(/^[A-Za-z0-9_-]{32}$/)
  })

  it("accepts the strict host-created CSP source list emitted by current VS Code", () => {
    const html = createStudioDocument({
      cspSource: "'self' https://*.vscode-cdn.net",
      clientScriptUri: "vscode-webview://studio/client.js",
      channelId: "channel_token_1234567890",
      nonce: "nonce_token_123456789012",
    })
    expect(html).toContain("font-src 'self' https://*.vscode-cdn.net")
    expect(html).toContain("script-src 'self' https://*.vscode-cdn.net 'nonce-nonce_token_123456789012'")
    for (const unsafeSource of [
      "'self' https://*.vscode-cdn.net; script-src *",
      "'self' 'unsafe-inline' https://*.vscode-cdn.net",
      "'self' https://*.vscode-cdn.net\nscript-src *",
      "'none' https://*.vscode-cdn.net",
    ]) {
      expect(() => createStudioDocument({
        cspSource: unsafeSource,
        clientScriptUri: "vscode-webview://studio/client.js",
        channelId: "channel_token_1234567890",
        nonce: "nonce_token_123456789012",
      }), unsafeSource).toThrow(/CSP source/)
    }
  })
})
