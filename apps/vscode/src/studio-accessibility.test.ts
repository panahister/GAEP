/// <reference lib="dom" />

import axe from "axe-core"
import { JSDOM } from "jsdom"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { installStudioClient } from "./studio-client.js"
import { createStudioDocument } from "./studio-document.js"
import {
  isStudioSnapshot,
  runStageLabels,
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
  type StudioTableSnapshot,
  type StudioToHostMessage,
} from "./studio-protocol.js"

const channelId = "accessibility_channel_1234567890"
const contextGeneration = "accessibility_context_1234567890"
const nonce = "accessibility_nonce_1234567890"

interface CapturedState {
  route?: StudioRoute
}

interface CapturedWebviewApi {
  messages: unknown[]
  state?: CapturedState
}

const captured: CapturedWebviewApi = { messages: [] }
let dom: JSDOM
const originalGlobals = new Map<string, PropertyDescriptor | undefined>()

function table(id: string): StudioTableSnapshot {
  return {
    id,
    title: id.replaceAll("-", " "),
    columns: [{ key: "name", label: "Name" }],
    rows: [{
      id: `${id}-1`,
      cells: { name: `${id} record` },
      actions: [{ label: "Open record", enabled: true, action: { kind: "open-record", recordId: `${id}-1` } }],
    }],
    actions: [],
  }
}

function baseFor<R extends StudioRoute>(route: R) {
  return {
    route,
    title: studioRouteLabels[route],
    purpose: `Review ${studioRouteLabels[route]} without leaving Product Studio.`,
    source: { provenance: "Verified local Product snapshot", sourceRevision: 2 },
    actions: [],
  }
}

const sections = () => studioRoutes.map((route) => ({ route, state: "in-progress" as const, gapCount: route === "scope" ? 1 : 0 }))

function pageFor(route: StudioRoute): StudioPageSnapshot {
  switch (route) {
    case "overview":
      return {
        ...baseFor(route),
        kind: "overview",
        product: { name: "Accessible Product", lifecycle: "active", revision: 2, readinessStatement: "One scope gap remains." },
        primaryAction: { label: "Resolve scope gap", enabled: true, emphasis: "primary", action: { kind: "navigate", route: "scope" } },
        sections: sections(),
        currentInitiative: [{ term: "Initiative", value: "Founder verification" }],
        latestRun: [{ term: "Run", value: "No run started" }],
        blockers: [],
      }
    case "direction":
    case "users-jobs":
    case "outcomes":
    case "scope":
    case "architecture":
      return {
        ...baseFor(route),
        kind: "record-form",
        recordId: `${route}-record`,
        draftId: `${route}-draft`,
        baseRevision: 2,
        fields: [
          {
            id: `${route}-summary`,
            label: "Summary",
            question: "What must reviewers understand?",
            kind: "single-line",
            value: "A bounded, attributable statement.",
            required: true,
            example: "State one testable claim.",
            provenance: "Founder draft",
            validation: { state: "valid", message: "Validated against the local schema." },
            designState: "complete",
          },
          {
            id: `${route}-items`,
            label: "Related items",
            question: "Which ordered items support this section?",
            kind: "repeatable",
            value: ["Item one"],
            required: false,
            provenance: "Founder draft",
            validation: { state: "not-validated" },
            columns: [{ key: "title", label: "Title" }],
            items: [{ id: "item-1", values: { title: "Item one" } }],
          },
        ],
        gaps: [],
        conflicts: [],
        draft: { state: "saved-locally", materialChange: true, validation: "valid" },
      }
    case "delivery":
      return {
        ...baseFor(route),
        kind: "delivery",
        initiatives: table("initiatives"),
        changes: {
          ...table("changes"),
          pagination: { offset: 0, limit: 50, total: 75, hasPrevious: false, hasNext: true },
          actions: [
            { label: "Previous Changes page", enabled: false, disabledReason: "This is the first page.", action: { kind: "domain-page", recordKind: "change", offset: 0, limit: 50 } },
            { label: "Next Changes page", enabled: true, action: { kind: "domain-page", recordKind: "change", offset: 50, limit: 50 } },
          ],
        },
        workItems: table("work-items"),
      }
    case "risks-decisions":
      return { ...baseFor(route), kind: "risks-decisions", risks: table("risks"), recommendations: table("recommendations"), decisions: table("decisions") }
    case "trace":
      return {
        ...baseFor(route),
        kind: "trace",
        relationships: table("relationships"),
        searchResults: table("search-results"),
        impact: [{ label: "Downstream work", entries: [{ term: "Work item", value: "Verification" }] }],
        caveat: "An absent link does not prove absent impact.",
      }
    case "agents-tools":
      return {
        ...baseFor(route),
        kind: "agents-tools",
        adapters: table("adapters"),
        selection: {
          agent: "Manual",
          model: "Founder",
          modelTruthClass: "declared",
          modelAlias: false,
          settings: [],
          limitationsReviewed: true,
          actions: [],
        },
        selectedAgent: [{ term: "Agent", value: "Manual" }],
        limitations: [],
        handoffs: table("handoffs"),
        contextPacks: table("context-packs"),
        instructionPrivilegeGrants: table("instruction-privilege-grants"),
        workflowPlans: table("workflow-plans"),
        toolDefinitions: table("tool-definitions"),
        runToolSelections: table("run-tool-selections"),
      }
    case "runs-evidence":
      return {
        ...baseFor(route),
        kind: "runs-evidence",
        runs: table("runs"),
        composer: {
          preparedRunId: "prepared-run-1",
          currentStage: 4,
          stages: runStageLabels.map((label, index) => ({
            stage: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
            state: index < 3 ? "complete" : index === 3 ? "in-progress" : "not-started",
            summary: label,
            issues: [],
          })),
          reviewSections: [{ label: "Policy", value: "Bounded local review", state: "pending" }],
          actions: [],
        },
        selectedRun: [{ term: "Run", value: "Prepared" }],
        events: [{ id: "event-1", time: "2026-07-21T00:00:00.000Z", kind: "prepared", summary: "Awaiting confirmation" }],
        evidence: table("evidence"),
        recoveryActions: [],
      }
    case "readiness":
      return {
        ...baseFor(route),
        kind: "readiness",
        statement: "One scope gap remains before the Product is ready.",
        sections: sections(),
        gaps: [{ id: "gap-1", message: "Resolve the bounded scope.", severity: "warning", sourceRecordId: "scope-record" }],
        conflicts: [],
        nextAction: { label: "Open scope", enabled: true, action: { kind: "navigate", route: "scope" } },
        health: [],
        designRevisions: table("design-revisions"),
        productRevisions: table("product-revisions"),
        portability: [{ term: "Export", value: "Portable and path-free" }],
      }
  }
}

function snapshot(route: StudioRoute, revision: number): StudioSnapshot {
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration,
    snapshotRevision: revision,
    route,
    workspace: { label: "Isolated test workspace", trusted: true, connectivity: "online", health: "valid" },
    navigation: sections(),
    surface: { kind: "ready", title: "Ready", issues: [], actions: [] },
    page: pageFor(route),
    inspector: route === "trace" ? {
      title: "Trace record",
      recordId: "trace-record-1",
      entries: [{ term: "Provenance", value: "Verified local Product snapshot" }],
      relationships: [{ term: "Downstream", value: "Verification work" }],
      actions: [],
    } : undefined,
    footer: { draftState: "saved-locally", sourceRevision: 2, validationSummary: "Schema valid" },
  }
}

function exposeGlobal(name: string, value: unknown): void {
  if (!originalGlobals.has(name)) originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

function send(message: unknown): void {
  dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data: message }))
}

beforeAll(() => {
  const html = createStudioDocument({
    cspSource: "'self' https://*.vscode-cdn.net",
    clientScriptUri: "vscode-webview://studio/dist/studio-client.js",
    channelId,
    nonce,
    initialRoute: "overview",
  })
  dom = new JSDOM(html, { url: "https://studio.test/" })
  const immediateAnimationFrame = (callback: FrameRequestCallback): number => {
    callback(0)
    return 1
  }
  Object.defineProperty(dom.window, "requestAnimationFrame", { configurable: true, value: immediateAnimationFrame })
  Object.defineProperty(dom.window, "confirm", { configurable: true, value: () => true })
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MessageEvent: dom.window.MessageEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: immediateAnimationFrame,
    acquireVsCodeApi: () => ({
      postMessage: (message: unknown) => captured.messages.push(message),
      getState: () => captured.state,
      setState: (state: CapturedState) => { captured.state = state },
    }),
  })) exposeGlobal(name, value)
  installStudioClient()
})

afterAll(() => {
  dom.window.close()
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

describe("Product Studio rendered accessibility", () => {
  it("starts through the typed VS Code bridge and exposes both live regions", () => {
    expect(captured.messages[0]).toMatchObject({
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.ready",
      restoredRoute: "overview",
    })
    expect(dom.window.document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull()
    expect(dom.window.document.querySelector('[role="alert"][aria-live="assertive"]')).not.toBeNull()

    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.announce", message: "Draft saved locally", priority: "polite" })
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.announce", message: "Execution blocked", priority: "assertive" })
    expect(dom.window.document.getElementById("studio-live-polite")?.textContent).toBe("Draft saved locally")
    expect(dom.window.document.getElementById("studio-live-assertive")?.textContent).toBe("Execution blocked")
  })

  it("renders all twelve approved surfaces without detectable axe violations", async () => {
    let revision = 1
    for (const route of studioRoutes) {
      const candidate = snapshot(route, revision++)
      expect(isStudioSnapshot(candidate), route).toBe(true)
      send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
      expect(dom.window.document.getElementById("studio-page-title")?.textContent, route).toBeTruthy()
      expect(dom.window.document.querySelectorAll(".studio-nav button"), route).toHaveLength(studioRoutes.length)
      expect(dom.window.document.querySelectorAll("#studio-route-select option"), route).toHaveLength(studioRoutes.length)
      for (const element of dom.window.document.querySelectorAll<HTMLElement>("[tabindex]")) {
        expect(Number(element.getAttribute("tabindex")), `${route}: ${element.outerHTML}`).toBeLessThanOrEqual(0)
      }

      const result = await axe.run(dom.window.document.documentElement, {
        rules: {
          // jsdom has no layout or theme color resolution; native-theme contrast is verified in the host lane.
          "color-contrast": { enabled: false },
        },
      })
      expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) })), route).toEqual([])
    }
  }, 30_000)

  it("keeps names, focus order, and icon semantics explicit", () => {
    const document = dom.window.document
    for (const control of document.querySelectorAll<HTMLElement>("button, input, select, textarea")) {
      const id = control.id
      const labelled = control.getAttribute("aria-label")?.trim() || control.textContent?.trim() ||
        (id ? Array.from(document.querySelectorAll("label")).find((label) => label.htmlFor === id)?.textContent?.trim() : undefined)
      expect(labelled, control.outerHTML).toBeTruthy()
    }
    for (const element of document.querySelectorAll<HTMLElement>("[tabindex]")) {
      expect(Number(element.getAttribute("tabindex")), element.outerHTML).toBeLessThanOrEqual(0)
    }
    for (const icon of document.querySelectorAll(".codicon")) expect(icon.getAttribute("aria-hidden")).toBe("true")
  })

  it("announces exact paged ranges and restores keyboard focus after navigation", async () => {
    const candidate = snapshot("delivery", 99)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
    const status = Array.from(dom.window.document.querySelectorAll<HTMLElement>(".table-pagination-status"))
      .find((element) => element.textContent?.includes("Showing records 1–1 of 75"))
    expect(status).toMatchObject({ role: "status" })
    expect(status?.getAttribute("aria-live")).toBe("polite")
    const next = Array.from(dom.window.document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Next Changes page")
    expect(next?.disabled).toBe(false)
    expect(next?.tabIndex).toBeGreaterThanOrEqual(0)
    next?.click()
    const request = captured.messages.at(-1) as Extract<StudioToHostMessage, { type: "studio.action" }> | undefined
    if (!request || request.type !== "studio.action") throw new Error("Expected a page action")
    send({
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.action-result",
      requestId: request.requestId,
      result: { status: "accepted", announcement: "Loaded the next Changes page." },
      snapshot: snapshot("delivery", 100),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dom.window.document.activeElement?.textContent).toBe("Next Changes page")
  })

  it("enforces the deny-by-default CSP and excludes forbidden decorative UI", () => {
    const document = dom.window.document
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? ""
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).not.toContain("unsafe-inline")
    expect(csp).not.toContain("unsafe-eval")
    for (const executable of document.querySelectorAll("script, style")) expect(executable.getAttribute("nonce")).toBe(nonce)

    const css = document.querySelector("style")?.textContent ?? ""
    expect(css).not.toMatch(/(?:linear|radial|conic)-gradient|@font-face|background-image|filter:\s*(?:drop-shadow|blur)/i)
    expect(document.querySelectorAll("img, svg, canvas")).toHaveLength(0)
    expect(document.querySelectorAll('[class*="hero"], [class*="bento"], [class*="chat-bubble"], [class*="metric-tile"]')).toHaveLength(0)
  })

  it("contains executable 720px and 480px narrow-layout rules", () => {
    const sheet = dom.window.document.querySelector("style")?.sheet
    expect(sheet).not.toBeNull()
    const mediaRules = Array.from(sheet?.cssRules ?? []).filter((rule): rule is CSSMediaRule => "conditionText" in rule)
    const tablet = mediaRules.find((rule) => rule.conditionText === "(max-width: 719px)")
    const narrow = mediaRules.find((rule) => rule.conditionText === "(max-width: 479px)")
    expect(tablet?.cssText).toMatch(/\.studio-rail\s*{[^}]*display:\s*none/i)
    expect(tablet?.cssText).toMatch(/\.studio-mobile-nav\s*{[^}]*display:\s*block/i)
    expect(tablet?.cssText).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/i)
    expect(narrow?.cssText).toMatch(/\.record-field[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/i)
    expect(narrow?.cssText).toMatch(/\.action-row button\s*{[^}]*width:\s*100%/i)
  })
})
