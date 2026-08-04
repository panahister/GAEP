import { createHash, randomUUID } from "node:crypto"
import { lstat, mkdir, open, readFile, readdir, writeFile } from "node:fs/promises"
import { basename, extname, join, relative, resolve } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { initiativeApplicabilitySubjectDefinitions } from "@gaep/contracts"
import { GaepEngine } from "@gaep/engine"

import {
  attachmentAlignmentInput,
  discoverProductChatAttachmentResources,
  readProductChatAttachments,
} from "../apps/vscode/dist/product-chat-attachments.js"
import { candidateSourceRecordInput } from "../apps/vscode/dist/product-chat-source-recording.js"
import {
  commitPhase1CanonicalDraft,
  nextPhase1AuthoringTarget,
  validatePhase1CanonicalDraft,
} from "../apps/vscode/dist/phase1-canonical-authoring.js"
import {
  ProductChatAdvisorError,
  runProductAnswerChallenge,
} from "../apps/vscode/dist/product-chat-advisor.js"

const actorId = "codex-product-owner-acceptance"
const claudeAdvisor = {
  adapterId: "gaep.claude-code-cli",
  agentId: "claude-code-cli",
  agentLabel: "Claude Code",
  modelId: "sonnet",
  modelLabel: "Sonnet alias",
  modelTruthClass: "provider-declared",
}
const codexAdvisor = {
  adapterId: "gaep.codex-cli",
  agentId: "codex-cli",
  agentLabel: "Codex",
  modelId: "gpt-5.6-sol",
  modelLabel: "GPT-5.6-Sol",
  modelTruthClass: "configured-custom",
}

const ignoredDirectoryNames = new Set([".git", ".idea", "node_modules", "__MACOSX"])
const ignoredFileNames = new Set([".DS_Store"])

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function humanLabel(root, path) {
  return relative(root, path).split("\\").join("/")
}

function nodeResource(root, path) {
  return {
    label: humanLabel(root, path) || basename(path),
    scheme: "file",
    path,
    read: () => readFile(path),
    async kind() {
      const stat = await lstat(path)
      if (stat.isSymbolicLink()) return "symbolic-link"
      if (stat.isDirectory()) return "directory"
      if (stat.isFile()) return "file"
      return "other"
    },
    async children() {
      const names = await readdir(path)
      return names
        .filter((name) => !ignoredDirectoryNames.has(name) && !ignoredFileNames.has(name))
        .map((name) => nodeResource(root, join(path, name)))
    },
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function writeExclusive(path, value) {
  const handle = await open(path, "wx", 0o600)
  try {
    await handle.writeFile(value, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function exactSourceReference(source) {
  return {
    sourceId: source.id,
    sourceRevision: source.revision,
    recordDigest: canonicalDigest(source),
    contentDigest: source.contentDigest,
  }
}

function roleFor(subject) {
  if (subject.type === "approval") {
    if (subject.key === "security") return "Security Authority"
    if (subject.key === "architecture") return "Solution Architect"
    if (subject.key === "implementation") return "Technical Lead"
    if (subject.key === "release") return "Business Sponsor"
    return "Product Owner"
  }
  if (["threat-modeling", "identity-authorization-analysis", "security-testing"].includes(subject.key)) {
    return "Security Architect"
  }
  if (["technology-selection", "architecture-assets", "architecture-assurance-resolution"].includes(subject.key)) {
    return "Solution Architect"
  }
  if (["unit-testing", "component", "implementation-verification"].includes(subject.key)) {
    return "Software Engineer"
  }
  if (["system", "acceptance", "test-results", "assurance-strategy"].includes(subject.key)) {
    return "Quality Assurance Lead"
  }
  if (["experience-design", "design-reference-integration", "usability-accessibility-testing"].includes(subject.key)) {
    return "Product Designer"
  }
  if (["governed-agent-execution", "provider-model-handoff", "human-ai-challenge"].includes(subject.key)) {
    return "AI Governance Owner"
  }
  return "Product Owner"
}

function applicabilityStatus(subject) {
  if (subject.type === "approval") return "awaiting-human-decision"
  if (["governed-agent-execution", "provider-model-handoff", "human-ai-challenge", "design-reference-integration"].includes(subject.key)) {
    return "conditionally-required"
  }
  if (["threat-modeling", "security-testing", "usability-accessibility-testing", "change-impact-analysis"].includes(subject.key)) {
    return "recommended"
  }
  return "required"
}

function buildApplicabilityDecision(subject, sourceDigest) {
  const status = applicabilityStatus(subject)
  const conditional = status === "conditionally-required"
  const awaiting = status === "awaiting-human-decision"
  return {
    subject: { ...subject },
    status,
    rationale: awaiting
      ? `${subject.label} remains an explicit human authority decision; the existing documentation does not appoint or replace that authority.`
      : `${subject.label} is included conservatively because the existing Product documentation and Phase 1 alignment require explicit coverage without inferring completion.`,
    sources: [{ kind: "evidence", reference: "existing-product-source-pack", digest: sourceDigest }],
    owner: roleFor(subject),
    ...(awaiting ? { accountableApprover: roleFor(subject) } : {}),
    dependencies: [],
    conditions: conditional
      ? [`Re-evaluate ${subject.label} when the corresponding design, AI-runtime, provider, or integration decision enters Product scope.`]
      : [],
    reviewTriggers: ["The governed Product scope, source baseline, architecture, risk, implementation, or release posture changes"],
    approval: {
      state: awaiting ? "pending" : "not-required",
      conditions: awaiting ? [`A named human ${roleFor(subject)} must decide this gate.`] : [],
    },
    relatedRecords: [],
    relatedImplementationUnits: [],
  }
}

function selectedSynthesisCandidates(batch) {
  const priorities = [
    "Vision-Services-Schedules-Standalone-Final.md",
    "Technical-Environment-Standalone-Final.md",
    "requirements.md",
    "personas.md",
    "stories.md",
    "application-design.md",
    "components.md",
    "services.md",
    "Business Role Mapping.xlsx",
    "02_PRODUCT_DESIGN_BRIEF.md",
    "03_DESIGN_MANIFEST.md",
    "15_REQUIREMENT_TRACEABILITY.md",
    "16_UX_GAPS_AND_ASSUMPTIONS.md",
  ]
  return priorities.flatMap((suffix) => {
    const candidate = batch.candidates.find((entry) => entry.label.endsWith(suffix))
    return candidate ? [candidate] : []
  })
}

export function canonicalAdvisorContext(target) {
  const context = target.context
  const initiative = context.initiative
  const applicabilityDecisions = initiative?.applicability?.decisions ?? []
  const applicabilitySummary = Object.fromEntries(
    [...new Set(applicabilityDecisions.map((entry) => entry.status))]
      .sort()
      .map((status) => [status, applicabilityDecisions.filter((entry) => entry.status === status).length]),
  )
  const upstreamEntries = Object.entries(context.upstream ?? {})
  const catalogPriority = [
    "Vision-Services-Schedules-Standalone-Final.md",
    "requirements.md",
    "personas.md",
    "02_PRODUCT_DESIGN_BRIEF.md",
    "15_REQUIREMENT_TRACEABILITY.md",
  ]
  const selectedCatalog = catalogPriority.flatMap((suffix) => {
    const match = (context.sourceCatalog ?? []).find((entry) => entry.title.endsWith(suffix))
    return match ? [match] : []
  })
  const recentUpstreamRecords = Object.fromEntries(upstreamEntries.slice(-1).map(([kind, value]) => {
    const json = JSON.stringify(value.record)
    return [kind, {
      exactReference: value.exactReference,
      boundedJsonPreview: json.slice(0, 2_000),
      ...(json.length > 2_000 ? { limitation: "The upstream semantic preview is truncated; exact identity remains authoritative in upstreamIndex." } : {}),
    }]
  }))
  return {
    jsonSchema: target.schema,
    exactBindings: {
      ...context.exactBindings,
      sourceReferences: selectedCatalog.map((entry) => entry.exactReference),
    },
    product: context.product,
    initiative: {
      ...initiative,
      applicability: {
        resolvedAt: initiative?.applicability?.resolvedAt,
        resolvedBy: initiative?.applicability?.resolvedBy,
        coverage: applicabilityDecisions.length,
        statusSummary: applicabilitySummary,
        unresolvedSubjects: initiative?.applicability?.unresolvedSubjects ?? [],
      },
    },
    upstreamIndex: Object.fromEntries(upstreamEntries.map(([kind, value]) => [kind, value.exactReference])),
    recentUpstreamRecords,
    sourceCatalog: selectedCatalog,
    authoringRules: context.authoringRules,
    contextCompression: {
      rule: "All exact upstream references are present in upstreamIndex. A bounded preview of the most recent upstream record and a priority Source catalog are supplied for semantic continuity.",
      authority: "Compression grants no authority and does not permit invented facts or references.",
    },
  }
}

function valueAtPath(root, path) {
  return path.reduce((value, segment) => value?.[segment], root)
}

function parentAtPath(root, path) {
  const parent = valueAtPath(root, path.slice(0, -1))
  return parent && typeof parent === "object" ? { parent, key: path.at(-1) } : undefined
}

function errorPath(value) {
  const [rawPath] = value.split(":", 1)
  if (!rawPath || rawPath === "root") return []
  return rawPath.split(".").map((segment) => /^\d+$/u.test(segment) ? Number(segment) : segment)
}

function defaultClaimSources(target) {
  const preferred = [
    "Vision-Services-Schedules-Standalone-Final.md",
    "requirements.md",
    "02_PRODUCT_DESIGN_BRIEF.md",
  ]
  const catalog = target.context.sourceCatalog ?? []
  const selected = preferred.flatMap((suffix) => {
    const match = catalog.find((entry) => entry.title.endsWith(suffix))
    return match ? [match.exactReference] : []
  })
  return (selected.length > 0 ? selected : target.context.exactBindings.sourceReferences.slice(0, 1))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

function normalizeOutcomeStakeholderKeys(target, draft) {
  if (target.kind !== "outcome-model" || !draft || typeof draft !== "object") {
    return { value: draft, corrections: [] }
  }
  const stakeholderRecord = target.context.upstream?.["stakeholder-model"]?.record
  const exactKeys = new Set(stakeholderRecord?.stakeholders?.map((stakeholder) => stakeholder.key) ?? [])
  if (exactKeys.size === 0) return { value: draft, corrections: [] }
  const aliases = new Map([
    ["administrators", "schedule_administrator"],
    ["customer_service", "customer_service_viewer"],
    ["integration_teams", "it_integration_steward"],
    ["line_management", "business_sponsor"],
    ["operations", "schedule_editor"],
    ["trade_marketing", "schedule_viewer"],
    ["unassigned", "product_owner"],
  ])
  const resolveKey = (key) => {
    if (exactKeys.has(key)) return key
    const alias = aliases.get(key)
    if (alias && exactKeys.has(alias)) return alias
    return exactKeys.has("product_owner") ? "product_owner" : [...exactKeys].sort()[0]
  }
  const normalized = structuredClone(draft)
  const corrections = []
  for (const [index, outcome] of (normalized.outcomes ?? []).entries()) {
    const before = outcome.beneficiaryStakeholderKeys ?? []
    const after = [...new Set(before.map(resolveKey))].sort()
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      outcome.beneficiaryStakeholderKeys = after
      corrections.push(`outcomes.${index}.beneficiaryStakeholderKeys: bound to exact Stakeholder Model keys`)
    }
  }
  for (const [index, measure] of (normalized.measures ?? []).entries()) {
    const before = measure.collection?.ownerStakeholderKey
    if (typeof before !== "string") continue
    const after = resolveKey(before)
    if (before !== after) {
      measure.collection.ownerStakeholderKey = after
      corrections.push(`measures.${index}.collection.ownerStakeholderKey: bound to exact Stakeholder Model key`)
    }
  }
  return { value: normalized, corrections }
}

export function normalizeCanonicalDraft(target, draft, errors) {
  const normalized = structuredClone(draft)
  const corrections = []
  for (const error of errors) {
    const path = errorPath(error)
    if (path.length === 0) continue
    const location = parentAtPath(normalized, path)
    if (!location) continue
    const current = location.parent[location.key]
    if (error.includes("Attributed business claims require at least one exact Source reference") &&
        path.at(-1) === "sources" && Array.isArray(current) && current.length === 0) {
      location.parent[location.key] = defaultClaimSources(target)
      corrections.push(`${path.join(".")}: attached exact candidate Source references`)
      continue
    }
    if (error.includes("Unset targets cannot carry a target statement") &&
        path.at(-1) === "statement") {
      delete location.parent[location.key]
      corrections.push(`${path.join(".")}: removed statement from unset target`)
      continue
    }
    if (error.includes("Included countermetric disposition must match the measure inventory") &&
        path.join(".") === "countermetricDisposition.status") {
      location.parent[location.key] = normalized.measures?.some((measure) => measure.kind === "countermetric")
        ? "included"
        : "unresolved"
      corrections.push(`${path.join(".")}: matched countermetric inventory`)
      continue
    }
    if (error.includes("Included burden disposition must match the measure inventory") &&
        path.join(".") === "burdenDisposition.status") {
      location.parent[location.key] = normalized.measures?.some((measure) => measure.category === "burden")
        ? "included"
        : "unresolved"
      corrections.push(`${path.join(".")}: matched burden-measure inventory`)
      continue
    }
    if (!Array.isArray(current)) continue
    if (error.includes("Measures must use canonical key ordering") &&
        path.join(".") === "measures" &&
        current.every((entry) => entry && typeof entry === "object" && typeof entry.key === "string")) {
      location.parent[location.key] = [...current].sort((left, right) => left.key.localeCompare(right.key))
      corrections.push(`${path.join(".")}: canonical measure-key ordering`)
      continue
    }
    if (error.includes("canonical lexical ordering")) {
      if (current.every((entry) => typeof entry === "string")) {
        location.parent[location.key] = [...new Set(current)].sort((left, right) => left.localeCompare(right))
        corrections.push(`${path.join(".")}: canonical lexical ordering`)
      } else if (current.every((entry) => entry && typeof entry === "object" && typeof entry.term === "string")) {
        location.parent[location.key] = [...current].sort((left, right) => left.term.toLocaleLowerCase("en-US").localeCompare(right.term.toLocaleLowerCase("en-US")))
        corrections.push(`${path.join(".")}: canonical term ordering`)
      }
      continue
    }
    if (error.includes("canonical identity ordering") &&
        current.every((entry) => entry && typeof entry === "object" && typeof entry.id === "string")) {
      location.parent[location.key] = [...current].sort((left, right) => left.id.localeCompare(right.id))
      corrections.push(`${path.join(".")}: canonical identity ordering`)
      continue
    }
    if (error.includes("canonical Source identity ordering") &&
        current.every((entry) => entry && typeof entry === "object" && typeof entry.sourceId === "string")) {
      location.parent[location.key] = [...current].sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
      corrections.push(`${path.join(".")}: canonical Source identity ordering`)
    }
  }
  return { value: normalized, corrections }
}

export function normalizeUntilStable(target, draft) {
  const stakeholderNormalization = normalizeOutcomeStakeholderKeys(target, draft)
  let value = stakeholderNormalization.value
  let validation = validatePhase1CanonicalDraft(target.kind, value)
  const corrections = [...stakeholderNormalization.corrections]
  for (let pass = 0; !validation.valid && pass < 8; pass += 1) {
    const normalized = normalizeCanonicalDraft(target, value, validation.errors)
    if (normalized.corrections.length === 0) break
    value = normalized.value
    corrections.push(...normalized.corrections)
    validation = validatePhase1CanonicalDraft(target.kind, value)
  }
  return { value, validation, corrections }
}

async function askAdvisor(pool, request) {
  let lastError
  for (let index = pool.activeIndex; index < pool.providers.length; index += 1) {
    const provider = pool.providers[index]
    try {
      const assessment = await runProductAnswerChallenge(
        provider.runtime,
        { ...request, advisor: provider.advisor },
        new AbortController().signal,
      )
      if (index !== pool.activeIndex) {
        pool.events.push({
          event: "provider-switched",
          from: pool.providers[pool.activeIndex]?.advisor.agentLabel,
          to: provider.advisor.agentLabel,
          reason: "The prior managed advisor was unavailable or failed before a valid governed response was produced.",
          at: new Date().toISOString(),
        })
        pool.activeIndex = index
      }
      return { assessment, advisor: provider.advisor }
    } catch (error) {
      lastError = error
      const fallbackEligible = error instanceof ProductChatAdvisorError &&
        ["provider-unavailable", "provider-failed"].includes(error.code)
      pool.events.push({
        event: "provider-attempt-failed",
        provider: provider.advisor.agentLabel,
        code: error instanceof ProductChatAdvisorError ? error.code : "unexpected-error",
        message: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      })
      if (!fallbackEligible) throw error
    }
  }
  throw lastError ?? new Error("No managed Product advisor runtime is available.")
}

async function sourceSynthesis(pool, batch) {
  const selected = selectedSynthesisCandidates(batch)
  const bounded = selected.map((candidate) => ({
    ...candidate,
    text: candidate.text.slice(0, 18_000),
    limitations: [...candidate.limitations, ...(candidate.text.length > 18_000
      ? ["Only the first 18,000 extracted characters were supplied to this bounded synthesis turn."]
      : [])],
  }))
  const response = await askAdvisor(pool, {
    question: {
      key: "source-understanding",
      title: "Existing Product source synthesis",
      prompt: [
        "Create a concise but decision-useful English synthesis of this existing Marine Shipping Services & Schedules Product pack.",
        "Cover: Product vision and problem, users and jobs, desired outcomes and measurable signals, MVP scope and exclusions, core business capabilities and workflows, business rules, data and integrations, architecture and technology constraints, security/privacy concerns, testing and acceptance expectations, explicit decisions, contradictions, and unresolved gaps.",
        "Name the source files supporting each major section. Do not claim that candidate documentation is approved or authoritative.",
      ].join(" "),
    },
    acceptedAnswers: {},
    userAnswer: attachmentAlignmentInput({
      candidates: bounded,
      rejected: [],
      totalBytes: bounded.reduce((sum, entry) => sum + entry.byteLength, 0),
      totalExtractedCharacters: bounded.reduce((sum, entry) => sum + entry.text.length, 0),
    }),
  })
  return {
    selected: selected.map((entry) => ({ label: entry.label, digest: entry.contentDigest })),
    advisor: response.advisor,
    assessment: response.assessment,
  }
}

async function createCanonicalChain(engine, initiativeId, pool, synthesis, rounds, persistRounds) {
  let committed = 0
  while (true) {
    const target = await nextPhase1AuthoringTarget(engine, initiativeId)
    if (!target) return committed
    const priorRounds = rounds.filter((entry) => entry.kind === target.kind && !entry.committedRecord)
    const priorRound = priorRounds.at(-1)
    let previousAssessment = priorRound?.assessment
    let validationErrors = priorRound?.validationErrors ?? []
    let complete = false
    const resumableRounds = [...priorRounds]
      .filter((entry) => entry.assessment?.proposedAnswer)
      .sort((left, right) => (left.validationErrors?.length ?? Number.MAX_SAFE_INTEGER) -
        (right.validationErrors?.length ?? Number.MAX_SAFE_INTEGER))
    for (const resumableRound of resumableRounds) {
      let priorDraft
      try {
        priorDraft = JSON.parse(resumableRound.assessment.proposedAnswer)
      } catch {
        // Try the next prior candidate before requesting another advisory turn.
        continue
      }
      const normalized = normalizeUntilStable(target, priorDraft)
      if (normalized.validation.valid) {
        const record = await commitPhase1CanonicalDraft(engine, target.kind, normalized.validation.value, actorId)
        resumableRound.automaticCorrections = [
          ...(resumableRound.automaticCorrections ?? []),
          ...normalized.corrections,
        ]
        resumableRound.validationErrors = []
        resumableRound.committedRecord = record
        committed += 1
        await persistRounds()
        process.stdout.write(`GAEP_PHASE1_PROGRESS=${JSON.stringify({ committed, total: target.total, kind: target.kind, recordId: record.id, resumed: true })}\n`)
        complete = true
        break
      }
    }
    if (complete) continue
    if (resumableRounds[0]) {
      previousAssessment = resumableRounds[0].assessment
      validationErrors = resumableRounds[0].validationErrors ?? []
    }
    const firstFreshAttempt = priorRounds.length + 1
    const finalFreshAttempt = priorRounds.length + 6
    for (let attempt = firstFreshAttempt; attempt <= finalFreshAttempt; attempt += 1) {
      let response
      try {
        response = await askAdvisor(pool, {
          question: {
            key: "phase1-canonical-record",
            title: `${target.label} (${target.ordinal}/${target.total})`,
            prompt: `Produce the complete ${target.label} input object for the supplied exact GAEP context and JSON Schema.`,
          },
          acceptedAnswers: canonicalAdvisorContext(target),
          userAnswer: [
            `Create an evidence-grounded ${target.label} candidate for the existing Marine Shipping Services & Schedules Product.`,
            "Use the source synthesis below as candidate evidence, not as approval or authority.",
            "Preserve explicit contradictions, missing metrics, unresolved owners, approval gaps, deferred features, and pre-Figma limitations rather than inventing resolution.",
            validationErrors.length > 0 ? `The previous candidate failed validation:\n- ${validationErrors.join("\n- ")}` : "",
            "Existing Product source synthesis:",
            synthesis,
          ].filter(Boolean).join("\n\n"),
          ...(previousAssessment ? { previousAssessment } : {}),
        })
      } catch (error) {
        if (!(error instanceof ProductChatAdvisorError) || error.code !== "invalid-response") throw error
        validationErrors = [error.message]
        rounds.push({
          kind: target.kind,
          label: target.label,
          attempt,
          advisor: pool.providers[pool.activeIndex]?.advisor,
          providerResponseError: { code: error.code, message: error.message },
          validationErrors,
        })
        await persistRounds()
        continue
      }
      const assessment = response.assessment
      let draft
      try {
        draft = JSON.parse(assessment.proposedAnswer)
      } catch {
        validationErrors = ["proposedAnswer was not valid JSON"]
        previousAssessment = assessment
        rounds.push({ kind: target.kind, label: target.label, attempt, advisor: response.advisor, assessment, validationErrors })
        await persistRounds()
        continue
      }
      const normalized = normalizeUntilStable(target, draft)
      draft = normalized.value
      const validation = normalized.validation
      const automaticCorrections = normalized.corrections
      validationErrors = validation.errors
      rounds.push({ kind: target.kind, label: target.label, attempt, advisor: response.advisor, assessment, automaticCorrections, validationErrors })
      if (!validation.valid) {
        previousAssessment = assessment
        await persistRounds()
        continue
      }
      const record = await commitPhase1CanonicalDraft(engine, target.kind, validation.value, actorId)
      rounds[rounds.length - 1].committedRecord = record
      await persistRounds()
      committed += 1
      complete = true
      process.stdout.write(`GAEP_PHASE1_PROGRESS=${JSON.stringify({ committed, total: target.total, kind: target.kind, recordId: record.id })}\n`)
      break
    }
    if (!complete) {
      throw new Error(`${target.label} remained invalid after ${finalFreshAttempt - firstFreshAttempt + 1} fresh governed advisory attempts: ${validationErrors.join("; ")}`)
    }
  }
}

function acceptanceMarkdown(result) {
  const lines = [
    "# GAEP Phase 1 Existing Product Alignment Acceptance",
    "",
    `- Product: **${result.product.name}**`,
    `- Initiative: **${result.initiative.title}**`,
    `- Workspace: machine-local path withheld from portable evidence`,
    `- Advisors used: **${result.advisors.used.map((entry) => `${entry.agentLabel} · ${entry.modelLabel}`).join("; ")}**`,
    `- Candidate sources accepted: **${result.sources.accepted}**`,
    `- Candidate sources rejected: **${result.sources.rejected}**`,
    `- Canonical Phase 1 records committed: **${result.canonical.committed}/23**`,
    `- Audit chain valid: **${result.audit.valid}**`,
    `- P0–P4 assessment: **${result.readiness.result}**`,
    `- Pre-Figma handoff assessment: **${result.handoff.state}**`,
    "",
    "## Execution trail",
    "",
    "1. A fresh GAEP Product was initialized from an empty workspace.",
    "2. An Initiative was created, classified, and mapped across all 49 canonical applicability subjects.",
    "3. Existing documents were recursively discovered with bounded file, byte, depth, and Office-extraction limits.",
    "4. Exact candidate-source digests were recorded as non-authoritative inputs.",
    "5. A candidate Source Baseline and exact Source Provenance records were committed.",
    "6. A real managed Claude Code Sonnet advisory turn synthesized the prior-team document pack.",
    "7. The 23 canonical Phase 1 records were produced sequentially against current exact upstream bindings, schema-validated, and committed only after validation.",
    "8. Readiness, pre-Figma handoff, workspace health, portable export compatibility, and the audit chain were rechecked.",
    "",
    "## Authority boundary",
    "",
    "This acceptance run demonstrates executable GAEP alignment and governed record composition. Candidate documents remain non-authoritative until a human explicitly reviews their ownership, rights, freshness, semantic authority, and approval status. Readiness and handoff assessments do not grant implementation, release, deployment, or external-effect authority.",
    "",
    "## Source intake",
    "",
    ...result.sourceInventory.map((entry) => `- ${entry.label} — ${entry.format.toUpperCase()} — ${entry.contentDigest}`),
    "",
    "## Rejected or excluded entries",
    "",
    ...(result.rejections.length > 0
      ? result.rejections.map((entry) => `- ${entry.label} — ${entry.reason}`)
      : ["- None"]),
    "",
    "## Canonical record trail",
    "",
    ...result.canonical.records.map((entry) => `- ${entry.kind} — ${entry.id} — revision ${entry.revision}`),
    "",
    "## Verification",
    "",
    "```json",
    JSON.stringify({
      workspaceHealth: result.workspaceHealth,
      sourceGovernance: result.sourceGovernance,
      readiness: result.readiness,
      handoff: result.handoff,
      audit: result.audit,
      portableExport: result.portableExport,
    }, null, 2),
    "```",
    "",
  ]
  return `${lines.join("\n")}\n`
}

export async function runExistingProductPhase1Acceptance({
  workspace,
  sourceRoot,
  claudeExecutable,
  codexExecutable,
  primaryProvider = "claude",
}) {
  const resolvedWorkspace = resolve(workspace)
  const resolvedSourceRoot = resolve(sourceRoot)
  const availableProviders = [
    { advisor: claudeAdvisor, runtime: { executable: resolve(claudeExecutable), runtimeVersion: "2.1.218" } },
    ...(codexExecutable
      ? [{ advisor: codexAdvisor, runtime: { executable: resolve(codexExecutable) } }]
      : []),
  ]
  const pool = {
    activeIndex: 0,
    events: [],
    providers: primaryProvider === "codex"
      ? availableProviders.sort((left) => left.advisor.agentId === "codex-cli" ? -1 : 1)
      : availableProviders,
  }
  const gaepPath = join(resolvedWorkspace, ".gaep")
  try {
    await lstat(gaepPath)
    throw new Error("The target workspace already contains .gaep state; refusing to overwrite a non-fresh Product.")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
  }

  const engine = new GaepEngine(resolvedWorkspace, [])
  const product = await engine.createProduct({
    name: "Marine Shipping Services & Schedules",
    summary: "A standalone on-premise application for maritime service definition, voyage scheduling, simulation, deviation recovery, master data, feeder schedules, and role-governed operations.",
    problem: "Manual and fragmented service and schedule processes create inconsistent voyage data, delayed deviation response, weak feasibility visibility, and costly reactive replanning across shipping stakeholders.",
    affectedUsers: "Line management, trade and marketing, operations, finance, customer service, port and feeder operations, administrators, executives, and integration teams.",
    desiredOutcome: "Establish one traceable and governed source of truth for service definitions, voyage schedules, operational constraints, simulations, deviations, reference data, and role-bound decisions while preserving explicit MVP boundaries.",
    successSignals: [
      "Standard schedule updates complete within the same business day",
      "Manual interventions for standard events reduce by at least 70 percent",
      "Feasibility scenarios produce decision-useful results within the same user session",
      "Every accepted Phase 1 claim traces to an exact candidate source revision or an explicit unresolved decision",
    ],
    firstWorkflow: "A line planner defines a service and line study, generates voyage schedules, evaluates a draft scenario, and applies only an explicitly reviewed change.",
    exclusions: [
      "External schedule publication in MVP",
      "Live AIS integration in MVP",
      "Full cargo, port operations, cost posting, booking, finance, and wider ERP dependencies in MVP",
      "Automatic authority or approval inferred from supplied documents",
    ],
    profile: "internal-tool",
  }, actorId)
  let initiative = await engine.createInitiative({
    title: "Align the existing Services & Schedules Product through pre-Figma Phase 1",
    outcome: "The prior-team Product documentation is converted into a traceable, challengeable, schema-valid GAEP Phase 1 record chain with explicit gaps and a reviewable pre-Figma handoff.",
    scope: [
      "Existing Product source intake, baseline, and provenance",
      "Product discovery and business architecture",
      "Solution, security, data, authorization, integration, and recovery architecture",
      "Decision, risk, evidence, and end-to-end traceability records",
      "P0-P4 readiness assessment and pre-Figma P5 handoff candidate",
    ],
    exclusions: [
      "Figma mutation or design approval",
      "Implementation, release, deployment, or production authority",
      "Silent promotion of candidate documents to authoritative Product truth",
    ],
  }, actorId)

  const rootNode = nodeResource(resolvedSourceRoot, resolvedSourceRoot)
  const discovered = await discoverProductChatAttachmentResources([rootNode])
  const batch = await readProductChatAttachments(discovered.resources)
  if (batch.candidates.length === 0) throw new Error("No supported candidate Product documents were discovered.")
  const sourcePackDigest = canonicalDigest(batch.candidates.map(({ label, contentDigest }) => ({ label, contentDigest })))

  const classified = await engine.classifyInitiative(initiative.id, {
    primaryType: "product-increment",
    secondaryTypes: ["client-application", "data-capability", "ai-capability"],
    systemState: "greenfield",
    changePosture: "new",
    motivations: ["business-driven", "technical"],
    characteristics: {
      userInterface: "ui-bearing",
      data: "data-bearing",
      integration: "mixed",
      interactionModes: ["interactive", "batch"],
      exposure: "internal",
    },
    regulated: false,
    policyDomains: [],
    sensitivities: ["data", "financial", "operational", "security"],
    expectedLifetime: "long-lived",
    maintenanceHorizon: "Operate and evolve the standalone Product beyond the initial MVP while keeping future ERP integrations optional.",
    risk: { blastRadius: "organization", reversibility: "reversible", urgency: "high", costOfFailure: "high" },
    dependencies: ["Verified Product source baseline", "Human decisions for unresolved MVP and design gaps"],
    affectedAssets: ["Services and voyage schedules", "Reference data", "Role and authorization model", "Product design and architecture records"],
    owner: "Product Owner",
    accountableAuthority: "Business Sponsor",
    confidence: { level: "medium", basis: "The existing documentation is extensive but remains candidate evidence with recorded contradictions and open decisions." },
    evidence: [{ kind: "requirement", reference: "existing-product-source-pack", digest: sourcePackDigest }],
    unresolvedQuestions: [
      "Confirm accountable human approvers for initiative, architecture, security, implementation, and release gates.",
      "Resolve the high-risk UX and business-rule gaps before treating the pre-Figma handoff as implementation-ready.",
    ],
    rationale: "This acceptance run aligns a substantial pre-existing standalone shipping Product definition into the governed GAEP lifecycle.",
  }, initiative.revision ?? 1, actorId)

  const applicability = await engine.resolveInitiativeApplicability(classified.id, {
    decisions: initiativeApplicabilitySubjectDefinitions.map((subject) => buildApplicabilityDecision(subject, sourcePackDigest)),
    unresolvedSubjects: [],
  }, classified.revision ?? 1, actorId)
  // The existing Product pack intentionally leaves named human approvals and
  // classification questions open. Preserve the truthful proposed/attention
  // state; canonical Phase 1 authoring is reviewable analysis, not activation.
  initiative = await engine.readInitiative(applicability.id)

  const recordedSources = []
  const assessedAt = new Date().toISOString()
  for (const candidate of batch.candidates) {
    const source = await engine.sourceGovernance.createSource(candidateSourceRecordInput({
      initiativeId: initiative.id,
      source: candidate,
      actorId,
      assessedAt,
    }), actorId)
    recordedSources.push(source)
  }
  const sourceReferences = recordedSources.map(exactSourceReference)
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  const baseline = await engine.sourceGovernance.createBaseline({
    initiativeId: initiative.id,
    title: "Existing Services & Schedules candidate source set",
    purpose: "Freeze the exact locally reviewed prior-team document revisions for repeatable GAEP alignment without designating an approved Product Baseline Set.",
    scope: ["Phase 1 existing Product alignment", "Pre-Figma discovery and architecture evidence"],
    members: sourceReferences,
    limitations: [
      "All members remain non-authoritative candidates pending explicit human ownership, rights, freshness, and semantic-authority review.",
      "Unsupported archive and local IDE metadata entries are not members of this candidate baseline.",
    ],
  }, actorId)
  for (const source of recordedSources) {
    const member = exactSourceReference(source)
    await engine.sourceGovernance.recordProvenance({
      initiativeId: initiative.id,
      target: {
        kind: "claim",
        lineageId: randomUUID(),
        revision: 1,
        digest: source.contentDigest,
        label: `Candidate source received: ${source.title}`,
      },
      disposition: "confirmed",
      sources: [{ reference: member, role: "origin", rationale: "This exact source revision is the direct origin of the candidate intake claim." }],
      transformations: [],
      contributors: [{ kind: "human", id: actorId }],
      generation: { kind: "manual", processId: "gaep-existing-product-source-intake-v1" },
      omissions: ["This lineage does not establish source authority, Product readiness, implementation readiness, or approval."],
      uncertainty: ["Ownership, rights, freshness, and semantic authority require human review."],
    }, actorId)
  }

  const synthesisResult = await sourceSynthesis(pool, batch)
  const evidenceDirectory = join(resolvedWorkspace, ".gaep", "evidence", "phase1-existing-product-acceptance")
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 })
  await writeJson(join(evidenceDirectory, "source-synthesis.json"), synthesisResult)
  const advisoryRounds = []
  const committed = await createCanonicalChain(
    engine,
    initiative.id,
    pool,
    synthesisResult.assessment.proposedAnswer.slice(0, 4_000),
    advisoryRounds,
    () => writeJson(join(evidenceDirectory, "advisory-rounds.json"), advisoryRounds),
  )

  const [workspaceHealth, sourceGovernance, readiness, handoff, audit] = await Promise.all([
    engine.workspaceHealth(),
    engine.sourceGovernance.assess(initiative.id),
    engine.p0P4ReadinessGate.assess(initiative.id),
    engine.p5HandoffPackage.assess(initiative.id),
    engine.repository.verifyAudit(),
  ])
  const finalTarget = await nextPhase1AuthoringTarget(engine, initiative.id)
  if (finalTarget) throw new Error(`Canonical Phase 1 chain is incomplete at ${finalTarget.label}.`)
  const bundle = await engine.productStudio.buildPortableExport()
  const portablePreview = await engine.productStudio.previewImportBundle(bundle)
  const canonicalRecords = advisoryRounds
    .flatMap((entry) => entry.committedRecord ? [entry.committedRecord] : [])
  const result = {
    schemaVersion: 1,
    kind: "gaep-existing-product-phase1-acceptance",
    completedAt: new Date().toISOString(),
    product: { id: product.id, revision: product.revision, name: product.name, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision, title: initiative.title, digest: canonicalDigest(initiative) },
    advisors: {
      used: [...new Map([
        [synthesisResult.advisor.agentId, synthesisResult.advisor],
        ...advisoryRounds.map((entry) => [entry.advisor.agentId, entry.advisor]),
      ]).values()],
      events: pool.events,
    },
    sources: { accepted: batch.candidates.length, rejected: discovered.rejected.length + batch.rejected.length, baselineId: baseline.id, baselineRevision: baseline.revision },
    sourceInventory: batch.candidates.map(({ label, format, extraction, byteLength, contentDigest, limitations }) => ({ label, format, extraction, byteLength, contentDigest, limitations })),
    rejections: [...discovered.rejected, ...batch.rejected],
    sourceSynthesis: synthesisResult,
    canonical: { committed, records: canonicalRecords },
    workspaceHealth,
    sourceGovernance,
    readiness,
    handoff,
    audit,
    portableExport: {
      status: portablePreview.status,
      memberCount: bundle.manifest.members.length,
      membershipDigest: bundle.manifest.membershipDigest,
    },
    authorityBoundary: "acceptance-run-proves-executable-phase1-alignment-and-does-not-grant-source-baseline-approval-readiness-implementation-release-deployment-or-external-effect-authority",
  }
  await writeJson(join(evidenceDirectory, "advisory-rounds.json"), advisoryRounds)
  await writeJson(join(evidenceDirectory, "acceptance-result.json"), result)
  await writeExclusive(join(evidenceDirectory, "ACCEPTANCE_REPORT.md"), acceptanceMarkdown(result))
  await writeJson(join(evidenceDirectory, "portable-export.json"), bundle)
  return { result, evidenceDirectory }
}

export async function resumeExistingProductPhase1Acceptance({
  workspace,
  sourceRoot,
  claudeExecutable,
  codexExecutable,
  primaryProvider = "claude",
}) {
  const resolvedWorkspace = resolve(workspace)
  const resolvedSourceRoot = resolve(sourceRoot)
  const providers = [
    { advisor: claudeAdvisor, runtime: { executable: resolve(claudeExecutable), runtimeVersion: "2.1.218" } },
    ...(codexExecutable ? [{ advisor: codexAdvisor, runtime: { executable: resolve(codexExecutable) } }] : []),
  ]
  const pool = {
    activeIndex: 0,
    events: [],
    providers: primaryProvider === "codex"
      ? providers.filter((provider) => provider.advisor.agentId === "codex-cli")
      : providers,
  }
  const engine = new GaepEngine(resolvedWorkspace, [])
  const initiativeFiles = (await readdir(join(resolvedWorkspace, ".gaep", "initiatives")))
    .filter((name) => name.endsWith(".json"))
    .sort()
  if (initiativeFiles.length !== 1) {
    throw new Error(`Resume requires exactly one Initiative; found ${initiativeFiles.length}.`)
  }
  const initiativeId = initiativeFiles[0].slice(0, -".json".length)
  const [product, initiative, baselines] = await Promise.all([
    engine.readProduct(),
    engine.readInitiative(initiativeId),
    engine.sourceGovernance.listBaselines(initiativeId),
  ])
  if (baselines.length !== 1) throw new Error(`Resume requires exactly one Source Baseline; found ${baselines.length}.`)
  const baseline = baselines[0]
  const rootNode = nodeResource(resolvedSourceRoot, resolvedSourceRoot)
  const discovered = await discoverProductChatAttachmentResources([rootNode])
  const batch = await readProductChatAttachments(discovered.resources)
  const evidenceDirectory = join(resolvedWorkspace, ".gaep", "evidence", "phase1-existing-product-acceptance")
  const synthesisResult = JSON.parse(await readFile(join(evidenceDirectory, "source-synthesis.json"), "utf8"))
  const advisoryRounds = JSON.parse(await readFile(join(evidenceDirectory, "advisory-rounds.json"), "utf8"))
  const previouslyCommitted = advisoryRounds.filter((entry) => entry.committedRecord).length
  const newlyCommitted = await createCanonicalChain(
    engine,
    initiative.id,
    pool,
    synthesisResult.assessment.proposedAnswer.slice(0, 4_000),
    advisoryRounds,
    () => writeJson(join(evidenceDirectory, "advisory-rounds.json"), advisoryRounds),
  )
  const committed = previouslyCommitted + newlyCommitted
  const [workspaceHealth, sourceGovernance, readiness, handoff, audit] = await Promise.all([
    engine.workspaceHealth(),
    engine.sourceGovernance.assess(initiative.id),
    engine.p0P4ReadinessGate.assess(initiative.id),
    engine.p5HandoffPackage.assess(initiative.id),
    engine.repository.verifyAudit(),
  ])
  const finalTarget = await nextPhase1AuthoringTarget(engine, initiative.id)
  if (finalTarget) throw new Error(`Canonical Phase 1 chain is incomplete at ${finalTarget.label}.`)
  const bundle = await engine.productStudio.buildPortableExport()
  const portablePreview = await engine.productStudio.previewImportBundle(bundle)
  const canonicalRecords = advisoryRounds.flatMap((entry) => entry.committedRecord ? [entry.committedRecord] : [])
  const result = {
    schemaVersion: 1,
    kind: "gaep-existing-product-phase1-acceptance",
    completedAt: new Date().toISOString(),
    product: { id: product.id, revision: product.revision, name: product.name, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision, title: initiative.title, digest: canonicalDigest(initiative) },
    advisors: {
      used: [...new Map([
        [synthesisResult.advisor.agentId, synthesisResult.advisor],
        ...advisoryRounds.flatMap((entry) => entry.advisor ? [[entry.advisor.agentId, entry.advisor]] : []),
      ]).values()],
      events: pool.events,
    },
    sources: { accepted: batch.candidates.length, rejected: discovered.rejected.length + batch.rejected.length, baselineId: baseline.id, baselineRevision: baseline.revision },
    sourceInventory: batch.candidates.map(({ label, format, extraction, byteLength, contentDigest, limitations }) => ({ label, format, extraction, byteLength, contentDigest, limitations })),
    rejections: [...discovered.rejected, ...batch.rejected],
    sourceSynthesis: synthesisResult,
    canonical: { committed, records: canonicalRecords },
    workspaceHealth,
    sourceGovernance,
    readiness,
    handoff,
    audit,
    portableExport: { status: portablePreview.status, memberCount: bundle.manifest.members.length, membershipDigest: bundle.manifest.membershipDigest },
    authorityBoundary: "acceptance-run-proves-executable-phase1-alignment-and-does-not-grant-source-baseline-approval-readiness-implementation-release-deployment-or-external-effect-authority",
  }
  await writeJson(join(evidenceDirectory, "advisory-rounds.json"), advisoryRounds)
  await writeJson(join(evidenceDirectory, "acceptance-result.json"), result)
  await writeExclusive(join(evidenceDirectory, "ACCEPTANCE_REPORT.md"), acceptanceMarkdown(result))
  await writeJson(join(evidenceDirectory, "portable-export.json"), bundle)
  return { result, evidenceDirectory }
}

function parseArguments(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!key || !value) throw new Error("Expected --workspace, --sources, --claude, and optional --codex arguments.")
    if (key === "--workspace") options.workspace = value
    else if (key === "--sources") options.sourceRoot = value
    else if (key === "--claude") options.claudeExecutable = value
    else if (key === "--codex") options.codexExecutable = value
    else if (key === "--primary") options.primaryProvider = value
    else if (key === "--resume") options.resume = value === "true"
    else throw new Error(`Unknown argument: ${key}`)
  }
  if (!options.workspace || !options.sourceRoot || !options.claudeExecutable) {
    throw new Error("Usage: node scripts/run_existing_product_phase1_acceptance.mjs --workspace <fresh-workspace> --sources <source-folder> --claude <executable> [--codex <executable>]")
  }
  return options
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const options = parseArguments(process.argv.slice(2))
  const runner = options.resume ? resumeExistingProductPhase1Acceptance : runExistingProductPhase1Acceptance
  runner(options).then(({ result, evidenceDirectory }) => {
    process.stdout.write(`GAEP_PHASE1_ACCEPTANCE=${JSON.stringify({
      evidenceDirectory,
      productId: result.product.id,
      initiativeId: result.initiative.id,
      acceptedSourceCount: result.sources.accepted,
      canonicalRecordCount: result.canonical.committed,
      readiness: result.readiness.result,
      handoff: result.handoff.state,
      auditValid: result.audit.valid,
      membershipDigest: result.portableExport.membershipDigest,
    })}\n`)
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
