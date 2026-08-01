/// <reference lib="dom" />

import { performance as nodePerformance } from "node:perf_hooks"

import { JSDOM } from "jsdom"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { installStudioClient } from "./studio-client.js"
import { createStudioDocument } from "./studio-document.js"
import { isStudioSnapshot, studioProtocolVersion, type StudioSnapshot } from "./studio-protocol.js"
import { createStudioVisualFixture } from "./studio-visual-fixtures.js"

const channelId = "performance_channel_1234567890"
const nonce = "performance_nonce_1234567890"
const largeTableRows = 1_000
const protocolTableRowLimit = 10_000
const maximumOperationMs = 10_000
const maximumExportMs = 2_000
const maximumHeapDeltaBytes = 256 * 1024 * 1024
const maximumCsvBytes = 4 * 1024 * 1024

interface CapturedWebviewApi {
  messages: unknown[]
  clipboardText: string
  state?: { route?: string }
}

const captured: CapturedWebviewApi = { messages: [], clipboardText: "" }
const originalGlobals = new Map<string, PropertyDescriptor | undefined>()
let dom: JSDOM

function exposeGlobal(name: string, value: unknown): void {
  if (!originalGlobals.has(name)) originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `performance-row-${String(index).padStart(5, "0")}`,
    cells: {
      name: `Performance record ${String(count - index).padStart(5, "0")}`,
      state: index % 2 === 0 ? "candidate-local" : "pending-review",
      evidence: "Bounded deterministic metadata only",
    },
    actions: [],
  }))
}

function deliveryFixture(rowCount: number): StudioSnapshot {
  const snapshot = structuredClone(createStudioVisualFixture("delivery-tables-wide"))
  if (snapshot.page.kind !== "delivery") throw new Error("Expected Delivery visual fixture")
  snapshot.page.initiatives.rows = rows(rowCount)
  return snapshot
}

function send(snapshot: StudioSnapshot): void {
  dom.window.dispatchEvent(new dom.window.MessageEvent("message", {
    data: { protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot },
  }))
}

function buttonWithin(tableId: string, label: string): HTMLButtonElement {
  const table = dom.window.document.querySelector<HTMLElement>(`[data-studio-table="${tableId}"]`)
  const button = Array.from(table?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    .find((candidate) => candidate.textContent === label)
  if (!button) throw new Error(`Missing ${label} button in ${tableId}`)
  return button
}

beforeAll(() => {
  dom = new JSDOM(createStudioDocument({
    cspSource: "'self' https://*.vscode-cdn.net",
    clientScriptUri: "vscode-webview://studio/dist/studio-client.js",
    channelId,
    nonce,
    initialRoute: "delivery",
  }), { url: "https://performance.studio.test/" })
  const immediateAnimationFrame = (callback: FrameRequestCallback): number => {
    callback(0)
    return 1
  }
  Object.defineProperty(dom.window, "requestAnimationFrame", { configurable: true, value: immediateAnimationFrame })
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value: string) => { captured.clipboardText = value } },
  })
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MessageEvent: dom.window.MessageEvent,
    requestAnimationFrame: immediateAnimationFrame,
    acquireVsCodeApi: () => ({
      postMessage: (message: unknown) => captured.messages.push(message),
      getState: () => captured.state,
      setState: (state: { route?: string }) => { captured.state = state },
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

describe("Product Studio bounded performance and reliability", () => {
  it("renders, sorts, exports, and filters a large table within local safety budgets", () => {
    const maximum = deliveryFixture(protocolTableRowLimit)
    expect(isStudioSnapshot(maximum)).toBe(true)
    if (maximum.page.kind !== "delivery") throw new Error("Expected Delivery page")
    maximum.page.initiatives.rows.push(...rows(1).map((row) => ({ ...row, id: "over-limit-row" })))
    expect(isStudioSnapshot(maximum)).toBe(false)

    const snapshot = deliveryFixture(largeTableRows)
    expect(isStudioSnapshot(snapshot)).toBe(true)
    const heapBefore = process.memoryUsage().heapUsed
    const renderStarted = nodePerformance.now()
    send(snapshot)
    const renderMs = nodePerformance.now() - renderStarted
    const renderedRows = dom.window.document.querySelectorAll('[data-studio-table="initiatives"] tbody tr').length
    expect(renderedRows).toBe(largeTableRows)

    const sortStarted = nodePerformance.now()
    buttonWithin("initiatives", "Name").click()
    const sortMs = nodePerformance.now() - sortStarted
    expect(dom.window.document.querySelector('[data-studio-table="initiatives"] th[aria-sort="ascending"]')).not.toBeNull()

    const exportStarted = nodePerformance.now()
    buttonWithin("initiatives", "Copy visible rows as CSV").click()
    const exportMs = nodePerformance.now() - exportStarted
    const csvBytes = Buffer.byteLength(captured.clipboardText)
    expect(captured.clipboardText.split("\r\n")).toHaveLength(largeTableRows + 1)

    const filter = dom.window.document.querySelector<HTMLInputElement>(
      '[data-studio-table="initiatives"] input[type="search"]',
    )
    if (!filter) throw new Error("Missing Initiatives filter")
    filter.value = "Performance record 00999"
    const filterStarted = nodePerformance.now()
    filter.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    const filterMs = nodePerformance.now() - filterStarted
    expect(dom.window.document.querySelectorAll('[data-studio-table="initiatives"] tbody tr')).toHaveLength(1)

    const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore)
    const metrics = {
      largeTableRows,
      protocolTableRowLimit,
      renderMs: Math.ceil(renderMs),
      sortMs: Math.ceil(sortMs),
      exportMs: Math.ceil(exportMs),
      filterMs: Math.ceil(filterMs),
      heapDeltaBytes,
      csvBytes,
    }
    process.stdout.write(`GAEP_PERFORMANCE_METRICS ${JSON.stringify(metrics)}\n`)

    expect(metrics.renderMs).toBeLessThanOrEqual(maximumOperationMs)
    expect(metrics.sortMs).toBeLessThanOrEqual(maximumOperationMs)
    expect(metrics.filterMs).toBeLessThanOrEqual(maximumOperationMs)
    expect(metrics.exportMs).toBeLessThanOrEqual(maximumExportMs)
    expect(metrics.heapDeltaBytes).toBeLessThanOrEqual(maximumHeapDeltaBytes)
    expect(metrics.csvBytes).toBeLessThanOrEqual(maximumCsvBytes)
  })
})
