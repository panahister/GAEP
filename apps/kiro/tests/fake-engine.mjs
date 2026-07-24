import { createInterface } from "node:readline"

const productId = "11111111-1111-4111-8111-111111111111"
const bundleId = "22222222-2222-4222-8222-222222222222"
const runId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const charterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const handoffId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const privateRoot = "/Users/private/portable-design"
const privateCredential = "PRIVATE-OAUTH-TOKEN"
const workspacePath = process.argv[process.argv.indexOf("--workspace") + 1] ?? ""
let selectedAgent = null

if (process.env.AWS_SECRET_ACCESS_KEY || process.env.OPENAI_API_KEY || process.env.HOME || process.env.USERPROFILE) {
  process.exit(91)
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on("line", (line) => {
  const request = JSON.parse(line)
  const id = request.id
  if (!exactKeys(request, ["jsonrpc", "id", "method", "params", "protocolVersion"]) ||
    request.jsonrpc !== "2.0" || request.protocolVersion !== 2) {
    writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ENVELOPE")
    return
  }
  switch (request.method) {
    case "readProduct":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, {
        id: productId,
        name: "Example Product",
        revision: 7,
        providerState: privateCredential,
      })
    case "probeAgents":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, readinessSnapshots(workspacePath.endsWith("bad-readiness")))
    case "readAgentSelection":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      if (workspacePath.endsWith("bad-selection")) {
        return writeResult(id, {
          status: "selected",
          selection: { ...agentSelection(), runtimeExecutable: `${privateRoot}/${privateCredential}` },
        })
      }
      return writeResult(id, selectedAgent ? { status: "selected", selection: selectedAgent } : { status: "unselected" })
    case "selectAgent":
      return selectAgent(id, request.params)
    case "listRuns":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, [agentRun(workspacePath.endsWith("bad-runs"))])
    case "createHandoff":
      return createHandoff(id, request.params)
    case "productStudio.portableDesign.import":
      return importSnapshot(id, request.params)
    case "productStudio.portableDesign.list":
      return listSnapshots(id, request.params)
    case "productStudio.portableDesign.read":
      return readSnapshot(id, request.params)
    default:
      return writeError(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE METHOD")
  }
})

function selectAgent(id, params) {
  if (!exactKeys(params, ["adapterId", "modelId", "settings", "actorId"]) ||
    params.adapterId !== "openai-codex" || params.modelId !== "gpt-5.6-codex" ||
    !exactKeys(params.settings, ["reasoningEffort"]) || params.settings.reasoningEffort !== "high" ||
    params.actorId !== "founder.kiro-review") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SELECTION PARAMS")
  }
  selectedAgent = agentSelection(params.settings)
  return writeResult(id, selectedAgent)
}

function agentSelection(settings = { reasoningEffort: "high" }) {
  return {
    schemaVersion: 2,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    modelTruthClass: "observed",
    modelAlias: false,
    settings,
    selectedAt: "2026-07-24T08:05:00.000Z",
    capabilityDigest: `sha256:${"e".repeat(64)}`,
  }
}

function targetAgentSelection() {
  return {
    ...agentSelection({ reasoningEffort: "medium" }),
    modelId: "gpt-5.6-codex-next",
    selectedAt: "2026-07-24T08:10:00.000Z",
    capabilityDigest: `sha256:${"f".repeat(64)}`,
  }
}

function agentRun(includePrivatePath = false) {
  const run = {
    schemaVersion: 1,
    id: runId,
    revision: 3,
    charterId,
    charterDigest: `sha256:${"1".repeat(64)}`,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    agent: agentSelection(),
    state: "completed",
    providerSessionRef: `sha256:${"2".repeat(64)}`,
    startedAt: "2026-07-24T08:00:00.000Z",
    endedAt: "2026-07-24T08:04:00.000Z",
  }
  if (includePrivatePath) run.runtimeExecutable = `${privateRoot}/${privateCredential}`
  return run
}

function createHandoff(id, params) {
  const expected = {
    fromRunId: runId,
    toAdapterId: "openai-codex",
    toModelId: "gpt-5.6-codex-next",
    toSettings: { reasoningEffort: "medium" },
    reason: "Switch to the reviewed model",
    completedWork: ["Selection workflow completed"],
    unresolvedMatters: ["Native Kiro acceptance remains"],
    decisions: ["Keep execution disabled"],
    evidence: ["evidence/kiro-selection.json"],
  }
  if (!exactKeys(params, ["actorId", "handoff"]) || params.actorId !== "founder.kiro-review" ||
    !params.handoff || !exactKeys(params.handoff, Object.keys(expected)) ||
    JSON.stringify(params.handoff) !== JSON.stringify(expected)) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE HANDOFF PARAMS")
  }
  selectedAgent = targetAgentSelection()
  const value = agentHandoff()
  if (workspacePath.endsWith("bad-handoff")) value.runtimeExecutable = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-handoff-binding")) value.toAgent.settings.reasoningEffort = "high"
  return writeResult(id, value)
}

function agentHandoff() {
  return {
    schemaVersion: 1,
    id: handoffId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fromRunId: runId,
    toAgent: targetAgentSelection(),
    reason: "Switch to the reviewed model",
    workspaceBaseline: {
      gitHead: "abcdef1",
      dirty: true,
      changedFiles: ["src/index.ts"],
      truthClass: "observed",
    },
    completedWork: ["Selection workflow completed"],
    unresolvedMatters: ["Native Kiro acceptance remains"],
    decisions: ["Keep execution disabled"],
    evidence: ["evidence/kiro-selection.json"],
    capabilityDifferences: ["Model changes from gpt-5.6-codex to gpt-5.6-codex-next."],
    createdAt: "2026-07-24T08:10:00.000Z",
  }
}

function importSnapshot(id, params) {
  if (!exactKeys(params, ["bundleRoot", "expectedProductId", "expectedProductRevision", "actorId"]) ||
    params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
    params.actorId !== "founder.kiro-review") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE IMPORT PARAMS")
  }
  if (params.bundleRoot.endsWith("source-error")) {
    return writeError(
      id,
      -32_030,
      "PORTABLE_DESIGN_SOURCE_INVALID",
      `Malformed bundle at ${privateRoot}; password=${privateCredential}`,
    )
  }
  return writeResult(id, snapshot())
}

function listSnapshots(id, params) {
  if (!exactKeys(params, ["offset", "limit"])) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE LIST PARAMS")
  }
  const items = params.offset === 9_999 ? Array.from({ length: 201 }, () => snapshot()) : [snapshot()]
  return writeResult(id, {
    items,
    offset: params.offset,
    limit: params.limit,
    total: params.offset === 9_999 ? 10_200 : 1,
    hasMore: params.offset === 9_999,
    governanceBoundary: "Every item remains pending human review; source review is an upstream claim only.",
    privacyBoundary: "Items contain validated metadata and digests only; local paths and source content are omitted.",
  })
}

function readSnapshot(id, params) {
  if (!exactKeys(params, ["bundleId"])) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE READ PARAMS")
  }
  switch (params.bundleId) {
    case "33333333-3333-4333-8333-333333333333":
      return writeError(id, -32_035, "PORTABLE_DESIGN_NOT_FOUND", `Missing ${privateRoot}; token=${privateCredential}`)
    case "44444444-4444-4444-8444-444444444444":
      process.stdout.write(`{"jsonrpc":"2.0","id":${id},"id":${id},"result":{}}\n`)
      return
    case "55555555-5555-4555-8555-555555555555":
      process.stdout.write(Buffer.from([0xc3, 0x28, 0x0a]))
      return
    case "66666666-6666-4666-8666-666666666666":
      process.stdout.write(`{"jsonrpc":"2.0","id":${id},"result":{"padding":"${"x".repeat(1024 * 1024 + 1)}"}}\n`)
      return
    case "77777777-7777-4777-8777-777777777777": {
      const value = snapshot(params.bundleId)
      value.bundleRoot = `${privateRoot}/${privateCredential}`
      return writeResult(id, value)
    }
    case "88888888-8888-4888-8888-888888888888": {
      const value = snapshot(params.bundleId)
      value.governance.state = "approved"
      return writeResult(id, value)
    }
    case "99999999-9999-4999-8999-999999999999":
      return writeError(id, -32_030, "PORTABLE_DESIGN_NOT_FOUND", `Wrong code ${privateRoot} ${privateCredential}`)
    default:
      return writeResult(id, snapshot(params.bundleId))
  }
}

function snapshot(id = bundleId) {
  return {
    schemaVersion: 1,
    kind: "portable-design-snapshot-summary",
    bundleId: id,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Imported Product Design",
    classification: "confidential",
    governance: {
      state: "pending-human-review",
      humanReviewRequired: true,
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
      nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness",
    },
    sourceReview: {
      status: "approved",
      claimLabel: "approved upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness",
      gaepApproval: false,
    },
    source: { tool: "figma", exportMethod: "manual-export" },
    counts: { artifacts: 2, normalizedDesignTokens: 1, validationChecks: 6, recordedLimitations: 5 },
    digests: {
      snapshot: `sha256:${"a".repeat(64)}`,
      evidence: `sha256:${"b".repeat(64)}`,
      manifest: `sha256:${"c".repeat(64)}`,
      artifactInventory: `sha256:${"d".repeat(64)}`,
    },
    timestamps: {
      sourceExportedAt: "2026-07-24T00:00:00.000Z",
      importedAt: "2026-07-24T00:01:00.000Z",
    },
    privacyBoundary: "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.",
  }
}

function readinessSnapshots(includePrivatePath) {
  const codex = {
    schemaVersion: 1,
    adapterId: "openai-codex",
    adapterVersion: "0.1.0",
    agentId: "codex",
    agentLabel: "OpenAI Codex",
    runtimeVersion: "0.42.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "beta",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: true,
    supportsModelDiscovery: true,
    supportsToolSelection: true,
    settings: [{
      key: "reasoningEffort",
      label: "Reasoning effort",
      description: "Provider-declared reasoning effort for a future governed run.",
      kind: "select",
      required: false,
      sensitive: false,
      options: [{ value: "high", label: "High" }],
      truthClass: "provider-declared",
    }],
    models: [{
      id: "gpt-5.6-codex",
      label: "GPT-5.6 Codex",
      description: "Observed local Codex model metadata.",
      reasoningOptions: ["high"],
      contextWindow: 200000,
      inputModalities: ["text", "image"],
      truthClass: "observed",
      alias: false,
    }],
    limitations: ["Capability observation does not authorize execution."],
    observedAt: "2026-07-24T08:00:00.000Z",
  }
  if (includePrivatePath) codex.runtimeExecutable = `${privateRoot}/${privateCredential}`
  return [codex, {
    schemaVersion: 1,
    adapterId: "anthropic-claude-code",
    adapterVersion: "0.1.0",
    agentId: "claude-code",
    agentLabel: "Anthropic Claude Code",
    detected: false,
    executionInterface: "unavailable",
    interfaceMaturity: "unknown",
    supportsResume: false,
    supportsCancel: false,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [],
    models: [],
    limitations: ["The local Claude Code runtime was not observed."],
    observedAt: "2026-07-24T08:00:00.000Z",
  }]
}

function writeResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

function writeError(id, code, kind, rawMessage) {
  process.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message: rawMessage,
      data: { kind, detail: { bundleRoot: privateRoot, credential: privateCredential } },
    },
  })}\n`)
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}
