import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  canonicalDigest,
  capabilityDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
} from "@gaep/agent-sdk"
import { initiativeApplicabilitySubjectDefinitions } from "@gaep/contracts"
import type { AdapterCapabilities, ProductExportBundle } from "@gaep/contracts"

import { EngineHost } from "./host.js"

function codexCapabilities(): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.codex-cli",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex",
    runtimeVersion: "0.135.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "stable",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: true,
    supportsToolSelection: false,
    settings: [
      {
        key: "sandbox",
        label: "Sandbox",
        description: "Safe sandbox",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "read-only",
        options: [{ value: "read-only", label: "read-only" }],
        truthClass: "provider-declared",
      },
      {
        key: "approvalPolicy",
        label: "Approvals",
        description: "Fail closed without an interactive mediator",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "fail-closed-noninteractive",
        options: [{ value: "fail-closed-noninteractive", label: "Fail closed (non-interactive)" }],
        truthClass: "configured",
      },
    ],
    models: [{
      id: "gpt-test",
      label: "Test model",
      reasoningOptions: [],
      inputModalities: ["text"],
      truthClass: "observed",
      alias: false,
    }],
    limitations: [],
    observedAt: "2026-07-21T00:00:00.000Z",
  }
}

async function probeResult(executablePath = process.execPath): Promise<AdapterProbeResult> {
  const executableFingerprint = await fingerprintExecutable(executablePath, "codex")
  return {
    capabilities: codexCapabilities(),
    runtimeBinding: {
      scope: "machine-local",
      kind: "executable",
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      executablePath: executableFingerprint.canonicalPath,
      executableFingerprint,
    },
  }
}

describe("engine host protocol", () => {
  let workspace: string
  let host: EngineHost

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-host-"))
    host = new EngineHost(workspace)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(workspace, { recursive: true, force: true })
  })

  async function mockCodex(result = probeResult()): Promise<AdapterProbeResult> {
    const resolved = await result
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockResolvedValue(resolved)
    vi.spyOn(adapter, "buildInvocation").mockImplementation((_selection, _charter, workspacePath, prompt, binding) => {
      if (binding.kind !== "executable") throw new Error("Host test requires an exact executable binding")
      return {
        executable: binding.executablePath,
        args: ["exec", "--json", "-"],
        cwd: workspacePath,
        stdin: prompt,
        inputMode: "text-once",
        environment: {},
        environmentPolicy: { inherit: "allowlist", allowedKeys: [] },
        protocol: "jsonl",
        maturity: "stable",
        warnings: [],
      }
    })
    return resolved
  }

  async function activateTestInitiative(
    initiative: { id: string; revision: number },
    reason: string,
  ): Promise<void> {
    const classified = await host.engine.classifyInitiative(initiative.id, {
      primaryType: "service",
      secondaryTypes: ["api"],
      systemState: "brownfield",
      changePosture: "modernization",
      motivations: ["technical"],
      characteristics: {
        userInterface: "non-ui",
        data: "data-bearing",
        integration: "integration-heavy",
        interactionModes: ["synchronous"],
        exposure: "internal",
      },
      regulated: false,
      policyDomains: [],
      sensitivities: ["security", "data"],
      expectedLifetime: "long-lived",
      maintenanceHorizon: "Supported through the current host contract lifetime",
      risk: { blastRadius: "multi-unit", reversibility: "partially-reversible", urgency: "normal", costOfFailure: "high" },
      dependencies: ["Engine host protocol"],
      affectedAssets: ["Host API"],
      owner: "Host engineering owner",
      accountableAuthority: "Host Product Owner",
      confidence: { level: "high", basis: "The current host contract and Product scope are exact" },
      evidence: [{ kind: "evidence", reference: "host-contract-test-fixture" }],
      unresolvedQuestions: [],
      rationale: "The fixture exercises a bounded brownfield service through the strict engine-host protocol.",
    }, initiative.revision, "gaep.host-test")
    const resolved = await host.engine.resolveInitiativeApplicability(initiative.id, {
      decisions: initiativeApplicabilitySubjectDefinitions.map((subject) => ({
        subject: { ...subject },
        status: "optional",
        rationale: "This canonical subject was explicitly evaluated for the bounded engine-host fixture.",
        sources: [{ kind: "policy", reference: "GAEP-DYNAMIC-ENGINEERING-MODEL" }],
        owner: "Host engineering owner",
        dependencies: [],
        conditions: [],
        reviewTriggers: ["The host scope, classification, policy, or evidence changes"],
        approval: { state: "not-required", conditions: [] },
        relatedRecords: [],
        relatedImplementationUnits: [],
      })),
      unresolvedSubjects: [],
    }, classified.revision!, "gaep.host-test")
    await host.engine.updateInitiativeState(resolved.id, "active", reason, "gaep.host-test")
  }

  async function createProductAndInitiative(
    activate = true,
  ): Promise<{ productId: string; productRevision: number; initiativeId: string }> {
    const product = await host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "createProduct",
      params: {
        product: {
          name: "Host test Product",
          summary: "A bounded test Product",
          problem: "Cross-host selection must not trust caller capability objects.",
          affectedUsers: "GAEP host users",
          desiredOutcome: "Only host-observed capabilities reach execution.",
          successSignals: ["Host-local runtime remains private"],
          firstWorkflow: "Probe, select, charter, and prepare a run.",
          exclusions: [],
          profile: "software",
        },
      },
    }) as { id: string; revision: number }
    const initiative = await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "createInitiative",
      params: {
        initiative: {
          title: "Host-owned capabilities",
          outcome: "Prepare one safe invocation",
          scope: ["engine-host"],
          exclusions: [],
        },
      },
    }) as { id: string; revision: number }
    if (activate) {
      await activateTestInitiative(initiative, "Activate the host integration-test Initiative")
    }
    return { productId: product.id, productRevision: product.revision, initiativeId: initiative.id }
  }

  async function selectAndConfirmCharter(initiativeId: string): Promise<string> {
    await host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })
    const charter = await host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      method: "createCharter",
      params: {
        charter: {
          initiativeId,
          objective: "Prepare a safe non-interactive Codex invocation",
          permissions: [
            { capability: "read-workspace", mode: "allow", scope: ["."] },
            { capability: "modify-workspace", mode: "deny", scope: ["."] },
            { capability: "run-local-commands", mode: "allow", scope: ["."] },
            { capability: "network-access", mode: "deny", scope: [] },
            { capability: "commit", mode: "deny", scope: ["."] },
            { capability: "push", mode: "deny", scope: [] },
            { capability: "deploy", mode: "deny", scope: [] },
            { capability: "publish", mode: "deny", scope: [] },
            { capability: "external-communication", mode: "deny", scope: [] },
            { capability: "destructive-delete", mode: "deny", scope: ["."] },
          ],
          expectedEffects: ["observe"],
          forbiddenActions: ["Do not publish"],
          stopConditions: ["Stop when scope changes"],
          requiredEvidence: ["Invocation preparation"],
        },
      },
    }) as { id: string }
    await host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "confirmCharter",
      params: { charterId: charter.id },
    })
    return charter.id
  }

  it("negotiates protocol v2 while retaining safe omitted-version v1 behavior", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "ping", params: {} })).resolves.toEqual({
      engineVersion: "0.1.0",
      protocolVersion: 2,
      negotiatedProtocolVersion: 1,
      supportedProtocolVersions: [1, 2],
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 2, protocolVersion: 2, method: "ping", params: {} })).resolves.toMatchObject({
      protocolVersion: 2,
      negotiatedProtocolVersion: 2,
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 3, protocolVersion: 3, method: "ping", params: {} })).rejects.toMatchObject({
      kind: "UNSUPPORTED_PROTOCOL_VERSION",
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 4, method: "workspaceHealth", params: {} })).rejects.toMatchObject({
      kind: "PROTOCOL_UPGRADE_REQUIRED",
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "migrateLegacySelection",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        confirmation: "reconfirm-portable-agent-selection",
      },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "readAgentSelection",
      params: {},
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
  })

  it("exposes exact revision-bound Initiative classification and applicability only through protocol v2", async () => {
    const { initiativeId } = await createProductAndInitiative(false)
    const initial = await host.dispatch({
      jsonrpc: "2.0",
      id: "initiative-read",
      protocolVersion: 2,
      method: "readInitiative",
      params: { initiativeId },
    }) as { revision: number }
    const classified = await host.dispatch({
      jsonrpc: "2.0",
      id: "initiative-classify",
      protocolVersion: 2,
      method: "classifyInitiative",
      params: {
        actorId: "gaep.host-test",
        initiativeId,
        expectedInitiativeRevision: initial.revision,
        classification: {
          primaryType: "service",
          secondaryTypes: ["api"],
          systemState: "brownfield",
          changePosture: "modernization",
          motivations: ["technical"],
          characteristics: {
            userInterface: "non-ui",
            data: "data-bearing",
            integration: "integration-heavy",
            interactionModes: ["synchronous"],
            exposure: "internal",
          },
          regulated: false,
          policyDomains: [],
          sensitivities: ["security", "data"],
          expectedLifetime: "long-lived",
          maintenanceHorizon: "Supported through the current Product lifetime",
          risk: {
            blastRadius: "multi-unit",
            reversibility: "partially-reversible",
            urgency: "normal",
            costOfFailure: "high",
          },
          dependencies: ["Identity service"],
          affectedAssets: ["Host API"],
          owner: "Host engineering owner",
          accountableAuthority: "Host Product Owner",
          confidence: { level: "high", basis: "The current host contract and Product scope are exact" },
          evidence: [{ kind: "evidence", reference: "host-contract-test" }],
          unresolvedQuestions: [],
          rationale: "The host workflow changes a brownfield service and its internal API boundary.",
        },
      },
    }) as { revision: number; classification: { classifiedBy: { id: string } } }
    expect(classified.classification.classifiedBy.id).toBe("gaep.host-test")

    const resolved = await host.dispatch({
      jsonrpc: "2.0",
      id: "initiative-applicability",
      protocolVersion: 2,
      method: "resolveInitiativeApplicability",
      params: {
        actorId: "gaep.host-test",
        initiativeId,
        expectedInitiativeRevision: classified.revision,
        applicability: {
          decisions: [{
            subject: { type: "test-level", key: "contract-tests", label: "Host contract tests" },
            status: "required",
            rationale: "The cross-process protocol requires exact compatibility and hostile-input evidence.",
            sources: [{ kind: "policy", reference: "host-protocol-v2" }],
            owner: "Host engineering owner",
            accountableApprover: "Host Product Owner",
            dependencies: ["engine-host-protocol"],
            conditions: [],
            reviewTriggers: ["Protocol or Initiative classification changes"],
            approval: { state: "pending", conditions: [] },
            relatedRecords: [],
            relatedImplementationUnits: ["engine-host"],
          }],
          unresolvedSubjects: [],
        },
      },
    }) as { applicability: { state: string; decisions: Array<{ decidedBy: { id: string } }> } }
    expect(resolved.applicability).toMatchObject({
      state: "current",
      decisions: [{ decidedBy: { id: "gaep.host-test" } }],
    })
    const assessment = await host.dispatch({
      jsonrpc: "2.0",
      id: "initiative-entry-assessment",
      protocolVersion: 2,
      method: "assessInitiativeEntry",
      params: { initiativeId },
    })
    expect(assessment).toMatchObject({
      state: "attention-required",
      classification: { status: "current" },
      applicability: { status: "current", pendingApprovalCount: 1 },
      authorityBoundary: "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
    })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "initiative-v1-block",
      method: "readInitiative",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
  })

  it("exposes exact Source intake, candidate Baseline, Provenance, and assessment through protocol v2", async () => {
    const { initiativeId } = await createProductAndInitiative(false)
    const sourceInput = {
      initiativeId,
      sourceType: "requirements" as const,
      title: "Reviewed host requirements",
      description: "The exact reviewed requirements input for the bounded engine-host Source workflow.",
      locator: { kind: "logical" as const, value: "host.requirements.reviewed" },
      revisionIdentity: { kind: "resource-revision" as const, value: "HOST-REQ-001@1" },
      contentDigest: `sha256:${"a".repeat(64)}` as const,
      digestScope: "Canonical UTF-8 requirements content",
      owner: { kind: "human" as const, id: "gaep.host-test" },
      semanticAuthority: {
        standing: "authoritative" as const,
        domain: "Host protocol requirements",
        scope: ["Source protocol v2"],
        basis: "The accountable host Product owner declared this exact revision as the governing requirements input.",
        declaredBy: { kind: "human" as const, id: "gaep.host-test" },
      },
      knowledgeDisposition: "confirmed" as const,
      trust: { sourceAuthenticity: "verified" as const, contentIntegrity: "verified" as const },
      informationClassification: "internal" as const,
      rights: { status: "verified" as const, basis: "Internal Product use is recorded." },
      freshness: {
        status: "fresh" as const,
        assessedAt: "2026-07-25T00:00:00.000Z",
        basis: "The accountable owner reviewed this exact revision.",
        validUntil: "2026-08-25T00:00:00.000Z",
      },
      availability: { status: "available" as const, basis: "The logical source resolver is available." },
      limitations: ["This record does not establish Product readiness."],
    }
    const source = await host.dispatch({
      jsonrpc: "2.0",
      id: "source-create",
      protocolVersion: 2,
      method: "source.create",
      params: { actorId: "gaep.host-test", source: sourceInput },
    }) as { id: string; revision: number; contentDigest: `sha256:${string}`; authorityBoundary: string }
    const exactSource = {
      sourceId: source.id,
      sourceRevision: source.revision,
      recordDigest: canonicalDigest(source),
      contentDigest: source.contentDigest,
    }
    const baseline = await host.dispatch({
      jsonrpc: "2.0",
      id: "baseline-create",
      protocolVersion: 2,
      method: "source.baseline.create",
      params: {
        actorId: "gaep.host-test",
        baseline: {
          initiativeId,
          title: "Host Source candidate snapshot",
          purpose: "Freeze the exact host Source revision without designating an approved Product Baseline Set.",
          scope: ["Source protocol v2"],
          members: [exactSource],
          limitations: ["Human approval and designation are not represented."],
        },
      },
    }) as { id: string; revision: number; state: string; authorityBoundary: string }
    const provenance = await host.dispatch({
      jsonrpc: "2.0",
      id: "provenance-create",
      protocolVersion: 2,
      method: "source.provenance.record",
      params: {
        actorId: "gaep.host-test",
        provenance: {
          initiativeId,
          target: {
            kind: "claim",
            lineageId: "00000000-0000-4000-8000-000000000100",
            revision: 1,
            digest: source.contentDigest,
            label: "The reviewed host requirements source is recorded",
          },
          disposition: "confirmed",
          sources: [{
            reference: exactSource,
            role: "origin",
            rationale: "The exact Source revision directly originates the bounded host claim.",
          }],
          transformations: [],
          contributors: [{ kind: "human", id: "gaep.host-test" }],
          generation: { kind: "manual", processId: "host-source-review-v1" },
          omissions: ["This lineage does not establish readiness."],
          uncertainty: [],
        },
      },
    }) as { id: string; authorityBoundary: string }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "source-assess",
      protocolVersion: 2,
      method: "source.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      sourceCount: 1,
      baselineCount: 1,
      provenanceCount: 1,
      currentBaseline: { id: baseline.id, status: "current" },
      state: "ready",
      authorityBoundary: "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action",
    })
    const projection = await host.dispatch({
      jsonrpc: "2.0",
      id: "source-snapshot",
      protocolVersion: 2,
      method: "source.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      privacyBoundary: "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials",
      authorityBoundary: "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action",
    })
    expect(JSON.stringify(projection)).not.toContain("host.requirements.reviewed")
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "source-list",
      protocolVersion: 2,
      method: "source.list",
      params: { initiativeId },
    })).resolves.toEqual([expect.objectContaining({ id: source.id })])
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "baseline-list",
      protocolVersion: 2,
      method: "source.baseline.list",
      params: { initiativeId },
    })).resolves.toEqual([expect.objectContaining({ id: baseline.id, state: "candidate" })])
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "provenance-list",
      protocolVersion: 2,
      method: "source.provenance.list",
      params: { initiativeId },
    })).resolves.toEqual([expect.objectContaining({ id: provenance.id })])
    expect(source.authorityBoundary).toContain("does-not-grant")
    expect(baseline.authorityBoundary).toContain("does-not-approve")
    expect(provenance.authorityBoundary).toContain("does-not-approve")

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "source-v1-block",
      method: "source.list",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "source-actor-substitution",
      protocolVersion: 2,
      method: "source.create",
      params: {
        actorId: "another-human",
        source: { ...sourceInput, title: "Substituted Source declaration" },
      },
    })).rejects.toMatchObject({ kind: "INTERNAL_ERROR" })
  })

  it("exposes bounded business-understanding records and projection only through protocol v2", async () => {
    const { initiativeId } = await createProductAndInitiative(false)
    const [product, initiative] = await Promise.all([
      host.engine.readProduct(),
      host.engine.readInitiative(initiativeId),
    ])
    const source = await host.engine.sourceGovernance.createSource({
      initiativeId,
      sourceType: "stakeholder-note",
      title: "Reviewed host business discovery",
      description: "The exact reviewed discovery source for the bounded engine-host business workflow.",
      locator: { kind: "logical", value: "host.business.discovery" },
      revisionIdentity: { kind: "resource-revision", value: "HOST-DISCOVERY-001@1" },
      contentDigest: `sha256:${"b".repeat(64)}`,
      digestScope: "Canonical UTF-8 discovery content",
      owner: { kind: "human", id: "gaep.host-test" },
      semanticAuthority: {
        standing: "advisory",
        domain: "Business understanding",
        scope: ["P1 candidate context"],
        basis: "The exact discovery revision is reviewed advisory evidence for this bounded host workflow.",
        declaredBy: { kind: "human", id: "gaep.host-test" },
      },
      knowledgeDisposition: "confirmed",
      trust: { sourceAuthenticity: "verified", contentIntegrity: "verified" },
      informationClassification: "internal",
      rights: { status: "verified", basis: "Internal Product analysis is recorded." },
      freshness: {
        status: "fresh",
        assessedAt: "2026-07-25T00:00:00.000Z",
        basis: "The accountable owner reviewed this exact revision.",
        validUntil: "2026-08-25T00:00:00.000Z",
      },
      availability: { status: "available", basis: "The logical source resolver is available." },
      limitations: ["The Source does not appoint a stakeholder or approve a Product decision."],
    }, "gaep.host-test")
    const exactSource = {
      sourceId: source.id,
      sourceRevision: source.revision,
      recordDigest: canonicalDigest(source),
      contentDigest: source.contentDigest,
    }
    const statement = (text: string) => ({
      text,
      disposition: "confirmed" as const,
      sources: [exactSource],
    })
    const record = await host.dispatch({
      jsonrpc: "2.0",
      id: "business-create",
      protocolVersion: 2,
      method: "business.understanding.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          context: {
            productRevision: product.revision ?? 1,
            productDigest: canonicalDigest(product),
            initiativeRevision: initiative.revision ?? 1,
            initiativeDigest: canonicalDigest(initiative),
          },
          informationClassification: "internal",
          problem: statement("Teams cannot reconstruct why the bounded host Initiative exists."),
          currentState: statement("Business context is distributed across exact Sources and participant knowledge."),
          targetState: statement("Candidate business context is versioned and independently reviewable."),
          scope: {
            included: ["Business context"],
            excluded: ["Authority appointment"],
            boundaries: ["Candidate records only"],
          },
          objectives: [{
            id: "preserve-context",
            ...statement("Preserve attributable business context across host boundaries."),
          }],
          constraints: [],
          assumptions: [],
          unresolvedQuestions: [],
          glossary: [],
          limitations: ["Human acceptance is not represented."],
        },
      },
    }) as { id: string; revision: number; state: string; authorityBoundary: string }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-read",
      protocolVersion: 2,
      method: "business.understanding.read",
      params: { initiativeId },
    })).resolves.toMatchObject({ id: record.id, revision: 1, state: "candidate" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "stakeholder-read-empty",
      protocolVersion: 2,
      method: "business.stakeholders.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-assess",
      protocolVersion: 2,
      method: "business.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      businessUnderstanding: { recordId: record.id, revision: 1 },
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    const projection = await host.dispatch({
      jsonrpc: "2.0",
      id: "business-snapshot",
      protocolVersion: 2,
      method: "business.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-business-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    expect(JSON.stringify(projection)).not.toContain("host.business.discovery")
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "capability-read-empty",
      protocolVersion: 2,
      method: "business.capabilities.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "capability-assess-empty",
      protocolVersion: 2,
      method: "business.capabilities.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      capabilityCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    const capabilityProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "capability-snapshot-empty",
      protocolVersion: 2,
      method: "business.capabilities.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: capabilitySnapshotDigest, ...capabilityProjectionBody } = capabilityProjection
    expect(capabilitySnapshotDigest).toBe(canonicalDigest(capabilityProjectionBody))
    expect(capabilityProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-capability-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "value-stream-read-empty",
      protocolVersion: 2,
      method: "business.valueStreams.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "value-stream-assess-empty",
      protocolVersion: 2,
      method: "business.valueStreams.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      valueStreamCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    const valueStreamProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "value-stream-snapshot-empty",
      protocolVersion: 2,
      method: "business.valueStreams.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: valueStreamSnapshotDigest, ...valueStreamProjectionBody } = valueStreamProjection
    expect(valueStreamSnapshotDigest).toBe(canonicalDigest(valueStreamProjectionBody))
    expect(valueStreamProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-value-stream-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "operating-model-read-empty",
      protocolVersion: 2,
      method: "business.operatingModels.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "operating-model-assess-empty",
      protocolVersion: 2,
      method: "business.operatingModels.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      roleCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-appoint"),
    })
    const operatingProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "operating-model-snapshot-empty",
      protocolVersion: 2,
      method: "business.operatingModels.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: operatingSnapshotDigest, ...operatingProjectionBody } = operatingProjection
    expect(operatingSnapshotDigest).toBe(canonicalDigest(operatingProjectionBody))
    expect(operatingProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-operating-narrative"),
      authorityBoundary: expect.stringContaining("does-not-appoint"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-rule-read-empty",
      protocolVersion: 2,
      method: "business.businessRules.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-rule-assess-empty",
      protocolVersion: 2,
      method: "business.businessRules.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      ruleCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-evaluate-policy"),
    })
    const businessRuleProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "business-rule-snapshot-empty",
      protocolVersion: 2,
      method: "business.businessRules.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: businessRuleSnapshotDigest, ...businessRuleProjectionBody } = businessRuleProjection
    expect(businessRuleSnapshotDigest).toBe(canonicalDigest(businessRuleProjectionBody))
    expect(businessRuleProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-rule-narrative"),
      authorityBoundary: expect.stringContaining("does-not-evaluate-policy"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-baseline-read-empty",
      protocolVersion: 2,
      method: "business.architectureBaselines.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-baseline-assess-empty",
      protocolVersion: 2,
      method: "business.architectureBaselines.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      coveredElementCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-designate-or-approve-a-baseline"),
    })
    const architectureBaselineProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-baseline-snapshot-empty",
      protocolVersion: 2,
      method: "business.architectureBaselines.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: architectureBaselineSnapshotDigest, ...architectureBaselineProjectionBody } =
      architectureBaselineProjection
    expect(architectureBaselineSnapshotDigest).toBe(canonicalDigest(architectureBaselineProjectionBody))
    expect(architectureBaselineProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-architecture-narrative"),
      authorityBoundary: expect.stringContaining("does-not-designate-or-approve-a-baseline"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "system-solution-read-empty",
      protocolVersion: 2,
      method: "architecture.systemSolution.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "system-solution-assess-empty",
      protocolVersion: 2,
      method: "architecture.systemSolution.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      concernCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve-baseline-readiness-conformance-technology-or-action"),
    })
    const systemSolutionProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "system-solution-snapshot-empty",
      protocolVersion: 2,
      method: "architecture.systemSolution.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: systemSolutionSnapshotDigest, ...systemSolutionProjectionBody } = systemSolutionProjection
    expect(systemSolutionSnapshotDigest).toBe(canonicalDigest(systemSolutionProjectionBody))
    expect(systemSolutionProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-architecture-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve-or-designate-an-architecture-baseline"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "bounded-context-read-empty",
      protocolVersion: 2,
      method: "architecture.boundedContexts.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "bounded-context-assess-empty",
      protocolVersion: 2,
      method: "architecture.boundedContexts.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      boundedContextCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-appoint-owners-approve-boundaries-accept-contracts"),
    })
    const boundedContextProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "bounded-context-snapshot-empty",
      protocolVersion: 2,
      method: "architecture.boundedContexts.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: boundedContextSnapshotDigest, ...boundedContextProjectionBody } = boundedContextProjection
    expect(boundedContextSnapshotDigest).toBe(canonicalDigest(boundedContextProjectionBody))
    expect(boundedContextProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-boundary-language-contract"),
      authorityBoundary: expect.stringContaining("does-not-appoint-owners-approve-boundaries-accept-contracts"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "security-privacy-read-empty",
      protocolVersion: 2,
      method: "security.privacyThreat.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "security-privacy-assess-empty",
      protocolVersion: 2,
      method: "security.privacyThreat.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      assetCount: 0,
      threatCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve-threats-attest-controls-accept-risk"),
    })
    const securityPrivacyProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "security-privacy-snapshot-empty",
      protocolVersion: 2,
      method: "security.privacyThreat.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: securityPrivacySnapshotDigest, ...securityPrivacyProjectionBody } = securityPrivacyProjection
    expect(securityPrivacySnapshotDigest).toBe(canonicalDigest(securityPrivacyProjectionBody))
    expect(securityPrivacyProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-threat-scenarios-control-content-data-content"),
      authorityBoundary: expect.stringContaining("does-not-approve-a-threat-model-attest-control-effectiveness"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "process-model-read-empty",
      protocolVersion: 2,
      method: "process.models.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "process-model-assess-empty",
      protocolVersion: 2,
      method: "process.models.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      processCount: 0,
      transitionCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve-workflows-grant-transition-or-execution-authority"),
    })
    const processModelProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "process-model-snapshot-empty",
      protocolVersion: 2,
      method: "process.models.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: processModelSnapshotDigest, ...processModelProjectionBody } = processModelProjection
    expect(processModelSnapshotDigest).toBe(canonicalDigest(processModelProjectionBody))
    expect(processModelProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-process-narrative-transition-guards-approval-content"),
      authorityBoundary: expect.stringContaining("does-not-approve-workflows-grant-transition-or-execution-authority"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "data-model-read-empty",
      protocolVersion: 2,
      method: "data.models.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "data-model-assess-empty",
      protocolVersion: 2,
      method: "data.models.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      entityCount: 0,
      relationshipCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-approve-a-data-model-or-classification"),
    })
    const dataModelProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "data-model-snapshot-empty",
      protocolVersion: 2,
      method: "data.models.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: dataModelSnapshotDigest, ...dataModelProjectionBody } = dataModelProjection
    expect(dataModelSnapshotDigest).toBe(canonicalDigest(dataModelProjectionBody))
    expect(dataModelProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-entity-attributes-relationships-lifecycle-content"),
      authorityBoundary: expect.stringContaining("does-not-approve-a-data-model-or-classification"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "authorization-model-read-empty",
      protocolVersion: 2,
      method: "authorization.models.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "authorization-model-assess-empty",
      protocolVersion: 2,
      method: "authorization.models.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      principalCount: 0,
      ruleCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-verify-identity"),
    })
    const authorizationModelProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "authorization-model-snapshot-empty",
      protocolVersion: 2,
      method: "authorization.models.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: authorizationModelSnapshotDigest, ...authorizationModelProjectionBody } = authorizationModelProjection
    expect(authorizationModelSnapshotDigest).toBe(canonicalDigest(authorizationModelProjectionBody))
    expect(authorizationModelProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-principal-identifiers-role-assignments-rules-conditions"),
      authorityBoundary: expect.stringContaining("does-not-verify-identity"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "event-integration-model-read-empty",
      protocolVersion: 2,
      method: "integration.models.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "event-integration-model-assess-empty",
      protocolVersion: 2,
      method: "integration.models.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      eventTypeCount: 0,
      commandCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-prove-event-occurrence"),
    })
    const eventIntegrationModelProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "event-integration-model-snapshot-empty",
      protocolVersion: 2,
      method: "integration.models.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const {
      snapshotDigest: eventIntegrationModelSnapshotDigest,
      ...eventIntegrationModelProjectionBody
    } = eventIntegrationModelProjection
    expect(eventIntegrationModelSnapshotDigest).toBe(canonicalDigest(eventIntegrationModelProjectionBody))
    expect(eventIntegrationModelProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-event-payloads-command-inputs-mapping-content"),
      authorityBoundary: expect.stringContaining("does-not-prove-event-occurrence"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "failure-recovery-model-read-empty",
      protocolVersion: 2,
      method: "recovery.models.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "failure-recovery-model-assess-empty",
      protocolVersion: 2,
      method: "recovery.models.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      failureModeCount: 0,
      recoveryPlanCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-prove-failure-occurrence"),
    })
    const failureRecoveryModelProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "failure-recovery-model-snapshot-empty",
      protocolVersion: 2,
      method: "recovery.models.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const {
      snapshotDigest: failureRecoveryModelSnapshotDigest,
      ...failureRecoveryModelProjectionBody
    } = failureRecoveryModelProjection
    expect(failureRecoveryModelSnapshotDigest).toBe(canonicalDigest(failureRecoveryModelProjectionBody))
    expect(failureRecoveryModelProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-failure-evidence-operational-telemetry"),
      authorityBoundary: expect.stringContaining("does-not-prove-failure-occurrence"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-challenge-read-empty",
      protocolVersion: 2,
      method: "challenge.models.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-challenge-assess-empty",
      protocolVersion: 2,
      method: "challenge.models.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      challengeSubjectCount: 0,
      findingCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-establish-independence"),
    })
    const architectureChallengeProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-challenge-snapshot-empty",
      protocolVersion: 2,
      method: "challenge.models.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: architectureChallengeSnapshotDigest, ...architectureChallengeProjectionBody } =
      architectureChallengeProjection
    expect(architectureChallengeSnapshotDigest).toBe(canonicalDigest(architectureChallengeProjectionBody))
    expect(architectureChallengeProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-challenge-content-assumptions-evidence"),
      authorityBoundary: expect.stringContaining("does-not-establish-independence"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "decision-register-read-empty",
      protocolVersion: 2,
      method: "decision.registers.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "decision-register-assess-empty",
      protocolVersion: 2,
      method: "decision.registers.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      decisionCount: 0,
      unresolvedDecisionCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-establish-decision-effectiveness"),
    })
    const decisionRegisterProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "decision-register-snapshot-empty",
      protocolVersion: 2,
      method: "decision.registers.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: decisionRegisterSnapshotDigest, ...decisionRegisterProjectionBody } =
      decisionRegisterProjection
    expect(decisionRegisterSnapshotDigest).toBe(canonicalDigest(decisionRegisterProjectionBody))
    expect(decisionRegisterProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-decision-questions-options-recommendations"),
      authorityBoundary: expect.stringContaining("does-not-establish-decision-effectiveness"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "risk-register-read-empty",
      protocolVersion: 2,
      method: "risk.registers.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "risk-register-assess-empty",
      protocolVersion: 2,
      method: "risk.registers.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      riskCount: 0,
      notAssessedRiskCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-establish-assessment-fact"),
    })
    const riskRegisterProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "risk-register-snapshot-empty",
      protocolVersion: 2,
      method: "risk.registers.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: riskRegisterSnapshotDigest, ...riskRegisterProjectionBody } = riskRegisterProjection
    expect(riskRegisterSnapshotDigest).toBe(canonicalDigest(riskRegisterProjectionBody))
    expect(riskRegisterProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-risk-statements-assessments-controls"),
      authorityBoundary: expect.stringContaining("does-not-establish-assessment-fact"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "evidence-registry-read-empty",
      protocolVersion: 2,
      method: "evidence.registries.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "evidence-registry-assess-empty",
      protocolVersion: 2,
      method: "evidence.registries.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      claimCount: 0,
      evidenceItemCount: 0,
      linkCount: 0,
      state: "attention-required",
      authorityBoundary: expect.stringContaining("does-not-establish-claim-validation-evidence-sufficiency"),
    })
    const evidenceRegistryProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "evidence-registry-snapshot-empty",
      protocolVersion: 2,
      method: "evidence.registries.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: evidenceRegistrySnapshotDigest, ...evidenceRegistryProjectionBody } = evidenceRegistryProjection
    expect(evidenceRegistrySnapshotDigest).toBe(canonicalDigest(evidenceRegistryProjectionBody))
    expect(evidenceRegistryProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-claim-statements-evidence-observations"),
      authorityBoundary: expect.stringContaining("does-not-establish-claim-validation-evidence-sufficiency"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "traceability-read-empty",
      protocolVersion: 2,
      method: "traceability.graphs.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "traceability-assess-empty",
      protocolVersion: 2,
      method: "traceability.graphs.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      nodeCount: 0,
      relationshipCount: 0,
      linkCount: 0,
      transformationCount: 0,
      state: "attention-required",
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
      authorityBoundary: expect.stringContaining("does-not-establish-relationship-truth-completeness"),
    })
    const traceabilityProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "traceability-snapshot-empty",
      protocolVersion: 2,
      method: "traceability.graphs.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: traceabilitySnapshotDigest, ...traceabilityProjectionBody } = traceabilityProjection
    expect(traceabilitySnapshotDigest).toBe(canonicalDigest(traceabilityProjectionBody))
    expect(traceabilityProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-node-content-link-rationale-transformation-detail"),
      authorityBoundary: expect.stringContaining("does-not-establish-relationship-truth-completeness"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "readiness-gate-read-empty",
      protocolVersion: 2,
      method: "readiness.gates.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "readiness-gate-assess-empty",
      protocolVersion: 2,
      method: "readiness.gates.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      outputCount: 0,
      applicableOutputCount: 0,
      result: "not-assessed",
      gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission",
      authorityBoundary: expect.stringContaining("does-not-establish-readiness-approval"),
    })
    const readinessGateProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "readiness-gate-snapshot-empty",
      protocolVersion: 2,
      method: "readiness.gates.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: readinessGateSnapshotDigest, ...readinessGateProjectionBody } = readinessGateProjection
    expect(readinessGateSnapshotDigest).toBe(canonicalDigest(readinessGateProjectionBody))
    expect(readinessGateProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-output-content-criteria-findings"),
      authorityBoundary: expect.stringContaining("does-not-establish-readiness-approval"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "p5-handoff-read-empty",
      protocolVersion: 2,
      method: "handoff.p5.read",
      params: { initiativeId },
    })).resolves.toBeNull()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "p5-handoff-assess-empty",
      protocolVersion: 2,
      method: "handoff.p5.assess",
      params: { initiativeId },
    })).resolves.toMatchObject({
      itemCount: 0,
      readinessResult: "not-assessed",
      transferState: "draft",
      state: "attention-required",
      handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
      authorityBoundary: expect.stringContaining("does-not-establish-acknowledgement-readiness-approval"),
    })
    const p5HandoffProjection = await host.dispatch({
      jsonrpc: "2.0",
      id: "p5-handoff-snapshot-empty",
      protocolVersion: 2,
      method: "handoff.p5.snapshot",
      params: { initiativeId },
    }) as { snapshotDigest: string; privacyBoundary: string; authorityBoundary: string }
    const { snapshotDigest: p5HandoffSnapshotDigest, ...p5HandoffProjectionBody } = p5HandoffProjection
    expect(p5HandoffSnapshotDigest).toBe(canonicalDigest(p5HandoffProjectionBody))
    expect(p5HandoffProjection).toMatchObject({
      privacyBoundary: expect.stringContaining("not-item-content-summaries"),
      authorityBoundary: expect.stringContaining("does-not-establish-acknowledgement-readiness-approval"),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-v1-block",
      method: "business.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "decision-register-v1-block",
      method: "decision.registers.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "risk-register-v1-block",
      method: "risk.registers.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "evidence-registry-v1-block",
      method: "evidence.registries.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "traceability-v1-block",
      method: "traceability.graphs.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "p5-handoff-v1-block",
      method: "handoff.p5.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "readiness-gate-v1-block",
      method: "readiness.gates.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "capability-v1-block",
      method: "business.capabilities.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "value-stream-v1-block",
      method: "business.valueStreams.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "operating-model-v1-block",
      method: "business.operatingModels.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-rule-v1-block",
      method: "business.businessRules.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-baseline-v1-block",
      method: "business.architectureBaselines.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "system-solution-v1-block",
      method: "architecture.systemSolution.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "bounded-context-v1-block",
      method: "architecture.boundedContexts.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "security-privacy-v1-block",
      method: "security.privacyThreat.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "process-model-v1-block",
      method: "process.models.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "data-model-v1-block",
      method: "data.models.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "authorization-model-v1-block",
      method: "authorization.models.snapshot",
      params: { initiativeId },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "capability-extra-authority",
      protocolVersion: 2,
      method: "business.capabilities.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          approval: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "failure-recovery-model-extra-authority",
      protocolVersion: 2,
      method: "recovery.models.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          failureOccurred: true,
          retrySafe: true,
          compensationRestored: true,
          recoverySucceeded: true,
          returnToServiceAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-challenge-extra-authority",
      protocolVersion: 2,
      method: "challenge.models.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          independentReviewCompleted: true,
          assuranceEstablished: true,
          riskAccepted: true,
          architectureApproved: true,
          operationallyReady: true,
          actionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "decision-register-extra-authority",
      protocolVersion: 2,
      method: "decision.registers.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          decisionEffective: true,
          approved: true,
          riskAccepted: true,
          baselinePromoted: true,
          ready: true,
          actionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "risk-register-extra-authority",
      protocolVersion: 2,
      method: "risk.registers.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          assessmentEstablished: true,
          controlEffective: true,
          ownerAssigned: true,
          riskAccepted: true,
          approved: true,
          exceptionGranted: true,
          baselinePromoted: true,
          ready: true,
          actionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "evidence-registry-extra-authority",
      protocolVersion: 2,
      method: "evidence.registries.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          claimValidated: true,
          evidenceSufficient: true,
          assuranceEstablished: true,
          approved: true,
          riskAccepted: true,
          baselinePromoted: true,
          ready: true,
          actionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "traceability-extra-authority",
      protocolVersion: 2,
      method: "traceability.graphs.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          relationshipTrue: true,
          graphComplete: true,
          approved: true,
          baselinePromoted: true,
          ready: true,
          actionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "readiness-gate-extra-authority",
      protocolVersion: 2,
      method: "readiness.gates.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          ready: true,
          approved: true,
          waiverAccepted: true,
          phaseEntryGranted: true,
          implementationAuthorized: true,
          baselinePromoted: true,
          actionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "value-stream-extra-authority",
      protocolVersion: 2,
      method: "business.valueStreams.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          approvedBaseline: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "operating-model-extra-authority",
      protocolVersion: 2,
      method: "business.operatingModels.create",
      params: {
        actorId: "gaep.host-test",
        record: { initiativeId, approvedAppointment: true },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-rule-extra-authority",
      protocolVersion: 2,
      method: "business.businessRules.create",
      params: {
        actorId: "gaep.host-test",
        record: { initiativeId, grantedException: true, enforcementEnabled: true },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "architecture-baseline-extra-authority",
      protocolVersion: 2,
      method: "business.architectureBaselines.create",
      params: {
        actorId: "gaep.host-test",
        record: { initiativeId, approvedBaseline: true, releaseReady: true },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "system-solution-extra-authority",
      protocolVersion: 2,
      method: "architecture.systemSolution.create",
      params: {
        actorId: "gaep.host-test",
        record: { initiativeId, approvedArchitecture: true, releaseReady: true },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "bounded-context-extra-authority",
      protocolVersion: 2,
      method: "architecture.boundedContexts.create",
      params: {
        actorId: "gaep.host-test",
        record: { initiativeId, approvedBoundary: true, ownershipAccepted: true, releaseReady: true },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "security-privacy-extra-authority",
      protocolVersion: 2,
      method: "security.privacyThreat.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          approvedThreatModel: true,
          controlEffective: true,
          riskAccepted: true,
          privacyApproved: true,
          securityReady: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "process-model-extra-authority",
      protocolVersion: 2,
      method: "process.models.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          workflowApproved: true,
          transitionAuthorized: true,
          operationallyReady: true,
          executionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "data-model-extra-authority",
      protocolVersion: 2,
      method: "data.models.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          dataModelApproved: true,
          classificationApproved: true,
          ownershipAccepted: true,
          migrationAuthorized: true,
          operationallyReady: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "event-integration-model-extra-authority",
      protocolVersion: 2,
      method: "integration.models.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          eventOccurred: true,
          commandDelivered: true,
          contractAccepted: true,
          adapterActivated: true,
          executionAuthorized: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "business-extra-authority",
      protocolVersion: 2,
      method: "business.understanding.create",
      params: {
        actorId: "gaep.host-test",
        record: {
          initiativeId,
          approval: true,
        },
      },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
  })

  it("rejects unknown methods, malformed params, caller capability injection, and oversized direct requests", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "eraseEverything", params: {} })).rejects.toMatchObject({
      code: -32_601,
      kind: "METHOD_NOT_FOUND",
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        capabilities: { executablePath: "/tmp/caller-controlled" },
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      method: "selectAgent",
      params: { adapterId: "gaep.codex-cli", modelId: "gpt-test", settings: { workspaceRoot: "/tmp/injected" } },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "migrateLegacySelection",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        confirmation: "reconfirm-portable-agent-selection",
        runtimeExecutable: "/tmp/caller-controlled",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "createProduct",
      params: { product: { name: "x" } },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "readProduct",
      params: { padding: "x".repeat(1024 * 1024) },
    })).rejects.toMatchObject({ code: -32_001, kind: "FRAME_TOO_LARGE" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      protocolVersion: 2,
      method: "managed.readonly.preview",
      params: {
        charterId: "11111111-1111-4111-8111-111111111111",
        workflowPlanId: "22222222-2222-4222-8222-222222222222",
        toolSelection: [],
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      protocolVersion: 2,
      method: "managed.readonly.execute",
      params: {
        charterId: "11111111-1111-4111-8111-111111111111",
        workflowPlanId: "22222222-2222-4222-8222-222222222222",
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        timeoutMs: 30_000,
        confirmation: "approve-tools-and-effects",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 9,
      method: "managed.readonly.preview",
      params: {
        charterId: "11111111-1111-4111-8111-111111111111",
        workflowPlanId: "22222222-2222-4222-8222-222222222222",
      },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 10,
      protocolVersion: 2,
      method: "managed.evidence.list",
      params: { offset: 0, limit: 201 },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 11,
      protocolVersion: 2,
      method: "managed.evidence.read",
      params: {
        managedRunId: "11111111-1111-4111-8111-111111111111",
        localStagePath: "/tmp/caller-controlled",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 12,
      protocolVersion: 2,
      method: "managed.review.read",
      params: {
        managedRunId: "11111111-1111-4111-8111-111111111111",
        localStagePath: "/tmp/caller-controlled",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 13,
      protocolVersion: 2,
      method: "managed.review.apply",
      params: {
        actorId: "gaep.host-test",
        managedRunId: "11111111-1111-4111-8111-111111111111",
        expectedManagedRunRevision: 1,
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        confirmation: "apply-whatever-is-current",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 14,
      protocolVersion: 2,
      method: "managed.review.discard",
      params: {
        actorId: "gaep.host-test",
        managedRunId: "11111111-1111-4111-8111-111111111111",
        expectedManagedRunRevision: 1,
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        confirmation: "discard-exact-managed-review",
        deleteWorkspace: "/tmp/caller-controlled",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 15,
      method: "managed.review.read",
      params: { managedRunId: "11111111-1111-4111-8111-111111111111" },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
  })

  it("exposes an audit-gated bounded empty Managed Run inventory without authority", async () => {
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      protocolVersion: 2,
      method: "managed.evidence.list",
      params: { offset: 0, limit: 200 },
    })).resolves.toEqual(expect.objectContaining({
      schemaVersion: 1,
      kind: "managed-run-summary-page",
      items: [],
      offset: 0,
      limit: 200,
      total: 0,
      omittedCount: 0,
      hasMore: false,
      authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
    }))
  })

  it("returns only path-free capability snapshots and ignores all caller runtime authority", async () => {
    await mockCodex()
    const probed = await host.dispatch({ jsonrpc: "2.0", id: 1, method: "probeAgents", params: {} })
    const serialized = JSON.stringify(probed)
    expect(serialized).not.toContain(process.execPath)
    expect(serialized).not.toContain("executablePath")
    expect(serialized).not.toContain("executableFingerprint")
    expect(serialized).not.toMatch(/sha256:[0-9a-f]{64}/u)
  })

  it("observes portable selection state without exposing runtime authority", async () => {
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      protocolVersion: 2,
      method: "readAgentSelection",
      params: {},
    })).resolves.toEqual({ status: "unselected" })

    await mockCodex()
    await createProductAndInitiative()
    await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })
    const state = await host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "readAgentSelection",
      params: {},
    })
    expect(state).toMatchObject({
      status: "selected",
      selection: {
        schemaVersion: 2,
        adapterId: "gaep.codex-cli",
        agentId: "codex-cli",
        modelId: "gpt-test",
      },
    })
    const serialized = JSON.stringify(state)
    expect(serialized).not.toContain(process.execPath)
    expect(serialized).not.toContain("runtimeExecutable")
    expect(serialized).not.toContain("executablePath")
  })

  it("blocks selection during active Runs and requires versioned handoff after prior work", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    const prepared = await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "prepareRun",
      params: { charterId },
    }) as { run: { id: string } }
    const changedSettings = {
      sandbox: "read-only",
      approvalPolicy: "fail-closed-noninteractive",
      reasoningEffort: "high",
    }
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      method: "selectAgent",
      params: { adapterId: "gaep.codex-cli", modelId: "gpt-test", settings: changedSettings },
    })).rejects.toMatchObject({ code: -32_015, kind: "AGENT_SELECTION_ACTIVE_RUN" })

    await host.engine.markRunState(prepared.run.id, "running", { kind: "system", id: "host-test" })
    await host.engine.markRunState(prepared.run.id, "completed", { kind: "system", id: "host-test" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      method: "selectAgent",
      params: { adapterId: "gaep.codex-cli", modelId: "gpt-test", settings: changedSettings },
    })).rejects.toMatchObject({ code: -32_017, kind: "AGENT_SELECTION_HANDOFF_REQUIRED" })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 9,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })).resolves.toMatchObject({ adapterId: "gaep.codex-cli", modelId: "gpt-test" })
  }, 15_000)

  it("fails closed when capabilities change between host observation and governed selection", async () => {
    const initial = await probeResult()
    const changed = {
      ...initial,
      capabilities: { ...initial.capabilities, runtimeVersion: "0.136.0" },
    } satisfies AdapterProbeResult
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockResolvedValueOnce(initial).mockResolvedValueOnce(changed)
    await createProductAndInitiative()

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })).rejects.toMatchObject({ code: -32_012, kind: "CAPABILITIES_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "readAgentSelection",
      params: {},
    })).resolves.toEqual({ status: "unselected" })
  })

  it("does not leak absolute paths from adapter failures through direct host dispatch", async () => {
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockRejectedValue(new Error("failed at /Users/alice/private/agent token=top-secret"))

    let failure: unknown
    try {
      await host.dispatch({ jsonrpc: "2.0", id: 1, method: "probeAgents", params: {} })
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({ kind: "INTERNAL_ERROR" })
    expect(JSON.stringify(failure)).not.toContain("/Users/alice")
    expect(JSON.stringify(failure)).not.toContain("top-secret")
  })

  it("keeps selection and prepared-run RPC results portable while binding execution server-side", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    const prepared = await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "prepareRun",
      params: { charterId },
    }) as { run: { agent: Record<string, unknown> }; execution: { protocol: string; promptAttached: boolean } }

    expect(prepared.run.agent).toMatchObject({ schemaVersion: 2, adapterId: "gaep.codex-cli", modelId: "gpt-test" })
    expect(prepared.run.agent).not.toHaveProperty("runtimeExecutable")
    expect(prepared.execution).toMatchObject({ protocol: "jsonl", promptAttached: true })
    const serialized = JSON.stringify(prepared)
    expect(serialized).not.toContain(workspace)
    expect(serialized).not.toContain(process.execPath)
    expect(serialized).not.toContain("executableFingerprint")
  })

  it("fails closed when the selected executable fingerprint changes before prepare-run", async () => {
    const executable = join(workspace, "fake-codex")
    await writeFile(executable, "first executable revision")
    const observed = await probeResult(executable)
    await mockCodex(Promise.resolve(observed))
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    await writeFile(executable, "second executable revision")

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      method: "prepareRun",
      params: { charterId },
    })).rejects.toMatchObject({ kind: "EXECUTABLE_CHANGED" })
  })

  it("exposes strict workspace health and Product Studio readiness/search/export/import-preview methods in v2", async () => {
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      protocolVersion: 2,
      method: "workspaceHealth",
      params: {},
    })).resolves.toMatchObject({ status: "uninitialized" })

    const { productId, productRevision } = await createProductAndInitiative()
    await host.engine.productStudio.startOrResumeDesignDraft(productRevision)
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      protocolVersion: 2,
      method: "productStudio.designReadiness",
      params: { productId },
    })).resolves.toMatchObject({ status: "incomplete", claimBoundary: "design-readiness-is-not-implementation-approval" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "productStudio.search",
      params: { query: "host test", kinds: ["product-revision"] },
    })).resolves.toEqual([expect.objectContaining({ kind: "product-revision" })])
    const bundle = await host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "productStudio.exportBuild",
      params: {},
    }) as ProductExportBundle
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      protocolVersion: 2,
      method: "productStudio.importPreview",
      params: { bundle },
    })).resolves.toMatchObject({ importMutation: "not-performed" })
  })

  it("composes a private-safe phase dashboard from an exact current Product binding", async () => {
    await createProductAndInitiative()
    const product = await host.engine.readProduct()
    const params = {
      phase: "phase-2-design",
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
    }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "dashboard.framework",
      params,
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })

    const result = await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      protocolVersion: 2,
      method: "dashboard.framework",
      params,
    }) as Record<string, unknown>
    expect(result).toMatchObject({
      phase: { id: "phase-2-design" },
      panels: [
        { id: "ux-figma", state: "attention-required" },
        { id: "change-impact", state: "active" },
        { id: "agent-model", state: "active" },
      ],
      authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
    })
    expect(JSON.stringify(result)).not.toContain(workspace)
    expect(JSON.stringify(result)).not.toContain(product.name)

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "dashboard.framework",
      params: { ...params, expectedProductDigest: `sha256:${"0".repeat(64)}` },
    })).rejects.toMatchObject({ kind: "DASHBOARD_PRODUCT_CONTEXT_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "dashboard.framework",
      params: { ...params, applicability: "applicable", ready: true },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
  })

  it("composes an exact Initiative-bound Phase 1 summary without synthesizing readiness or owners", async () => {
    const { initiativeId } = await createProductAndInitiative()
    const [product, initiative] = await Promise.all([
      host.engine.readProduct(),
      host.engine.readInitiative(initiativeId),
    ])
    const params = {
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
      expectedInitiativeId: initiative.id,
      expectedInitiativeRevision: initiative.revision ?? 1,
      expectedInitiativeDigest: canonicalDigest(initiative),
    }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "dashboard.phase1Summary",
      params,
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })

    const result = await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      protocolVersion: 2,
      method: "dashboard.phase1Summary",
      params,
    }) as Record<string, unknown>
    expect(result).toMatchObject({
      kind: "phase-1-summary-readiness-dashboard",
      product: { recordId: product.id, revision: product.revision ?? 1 },
      initiative: { recordId: initiative.id, revision: initiative.revision ?? 1 },
      phaseStatus: {
        state: "attention-required",
        productOwnerAcceptance: "not-established",
        readinessAuthority: "not-established",
        phaseEntryAuthority: "not-established",
      },
      owners: { state: "unbound", boundOwnerCount: 0 },
      authorityBoundary: "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority",
    })
    expect(JSON.stringify(result)).not.toContain(workspace)
    expect(JSON.stringify(result)).not.toContain(product.name)
    expect(JSON.stringify(result)).not.toContain(initiative.title)

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "dashboard.phase1Summary",
      params: { ...params, expectedInitiativeDigest: `sha256:${"0".repeat(64)}` },
    })).rejects.toMatchObject({ kind: "PHASE1_SUMMARY_CONTEXT_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "dashboard.phase1Summary",
      params: { ...params, ready: true, owner: "caller" },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
  })

  it("composes a bounded Change/Impact dashboard from exact current Product and Change bindings", async () => {
    const { initiativeId } = await createProductAndInitiative()
    const product = await host.engine.readProduct()
    const change = await host.engine.productStudio.createChange({
      initiativeId,
      title: "Host Change/Impact projection",
      summary: "Expose one exact bounded Change without adding approval or effect authority.",
      baseline: { kind: "genesis", declaration: "No shared host projection exists.", rationale: "First host slice." },
      effectEnvelope: ["reversible-change"],
    }, product.revision ?? 1, "gaep.host-test")
    const workItem = await host.engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Bind one changed artifact",
      objective: "Prove the host returns only current portable dashboard data.",
      dependsOn: [],
      completionCriteria: ["The exact response validates"],
      evidenceCriteria: ["Hostile request tests pass"],
      scope: {
        read: [{ kind: "workspace-relative", path: "." }],
        write: [{ kind: "workspace-relative", path: "packages/engine/src/change-impact-dashboard.ts" }],
        effects: [],
      },
      owner: { kind: "agent", id: "gaep.host-test" },
    }, product.revision ?? 1, "gaep.host-test")
    const params = {
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
      expectedChangeId: change.id,
      expectedChangeRevision: change.revision,
      expectedChangeDigest: canonicalDigest(change),
    }
    const catalogParams = {
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
    }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 50,
      protocolVersion: 1,
      method: "dashboard.changeImpact.changes",
      params: catalogParams,
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    const catalog = await host.dispatch({
      jsonrpc: "2.0",
      id: 51,
      protocolVersion: 2,
      method: "dashboard.changeImpact.changes",
      params: catalogParams,
    }) as Record<string, unknown>
    expect(catalog).toMatchObject({
      kind: "change-impact-change-catalog",
      items: [{ recordId: change.id, revision: change.revision, state: "proposed" }],
      total: 1,
      omitted: 0,
      authorityBoundary: "change-catalog-selection-does-not-approve-change-or-authorize-effects",
    })
    expect(JSON.stringify(catalog)).not.toContain(workspace)
    expect(JSON.stringify(catalog)).not.toContain(product.name)
    expect(JSON.stringify(catalog)).not.toContain(change.title)
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 52,
      protocolVersion: 2,
      method: "dashboard.changeImpact.changes",
      params: { ...catalogParams, approved: true },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      protocolVersion: 1,
      method: "dashboard.changeImpact",
      params,
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })

    const result = await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      protocolVersion: 2,
      method: "dashboard.changeImpact",
      params,
    }) as Record<string, unknown>
    expect(result).toMatchObject({
      kind: "change-impact-dashboard",
      change: { recordId: change.id, state: "proposed", effectEnvelope: ["reversible-change"] },
      workItems: [{ record: { recordId: workItem.id }, state: "proposed" }],
      changedArtifacts: [{ locator: { kind: "workspace-relative", path: "packages/engine/src/change-impact-dashboard.ts" } }],
      governance: {
        approval: { state: "not-established", basis: "current-contract-has-no-change-approval-record" },
        authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change",
      },
      freshness: { state: "current" },
      authorityBoundary: "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects",
    })
    expect(JSON.stringify(result)).not.toContain(workspace)
    expect(JSON.stringify(result)).not.toContain(product.name)
    expect(JSON.stringify(result)).not.toContain(change.title)

    const verifyAudit = vi.spyOn(host.engine.repository, "verifyAudit").mockResolvedValueOnce({
      valid: false,
      events: 0,
      error: "hostile audit detail must not cross the boundary",
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      protocolVersion: 2,
      method: "dashboard.changeImpact",
      params,
    })).rejects.toMatchObject({ kind: "CHANGE_IMPACT_AUDIT_INVALID" })
    verifyAudit.mockRestore()

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      protocolVersion: 2,
      method: "dashboard.changeImpact",
      params: { ...params, expectedChangeDigest: `sha256:${"0".repeat(64)}` },
    })).rejects.toMatchObject({ kind: "CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 9,
      protocolVersion: 2,
      method: "dashboard.changeImpact",
      params: { ...params, approved: true },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
  })

  it("composes an exact Agent/Model dashboard from cached capability and selection observations", async () => {
    await mockCodex()
    const { productId } = await createProductAndInitiative()
    const capabilities = await host.dispatch({
      jsonrpc: "2.0",
      id: 60,
      method: "probeAgents",
      params: {},
    }) as AdapterCapabilities[]
    await host.dispatch({
      jsonrpc: "2.0",
      id: 61,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })
    const product = await host.engine.readProduct()
    const selectionState = await host.engine.readSelectionState()
    if (selectionState.status !== "selected") throw new Error("Host test requires a current selection")
    const params = {
      expectedProductId: productId,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
      expectedSelection: {
        status: "selected" as const,
        selectionDigest: canonicalDigest(selectionState.selection),
      },
      expectedCapabilities: capabilities.map((entry) => ({
        adapterId: entry.adapterId,
        agentId: entry.agentId,
        capabilityDigest: capabilityDigest(entry),
      })),
    }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 62,
      protocolVersion: 1,
      method: "dashboard.agentModel",
      params,
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    const dashboard = await host.dispatch({
      jsonrpc: "2.0",
      id: 63,
      protocolVersion: 2,
      method: "dashboard.agentModel",
      params,
    }) as Record<string, unknown>
    expect(dashboard).toMatchObject({
      kind: "agent-model-dashboard",
      product: { recordId: productId, revision: product.revision },
      selection: {
        status: "selected",
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        capabilityState: "current",
      },
      providerMetrics: {
        usage: { state: "unavailable" },
        cost: { state: "unavailable" },
      },
      freshness: { state: "current", selectionCapabilityState: "current", truncated: false },
      limits: { runs: { total: 0 }, handoffs: { total: 0 }, managedRuns: { total: 0 } },
      authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
    })
    expect(JSON.stringify(dashboard)).not.toContain(workspace)
    expect(JSON.stringify(dashboard)).not.toContain(product.name)

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 64,
      protocolVersion: 2,
      method: "dashboard.agentModel",
      params: {
        ...params,
        expectedCapabilities: params.expectedCapabilities.map((entry, index) =>
          index === 0 ? { ...entry, capabilityDigest: `sha256:${"0".repeat(64)}` } : entry),
      },
    })).rejects.toMatchObject({ kind: "AGENT_MODEL_CAPABILITIES_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 65,
      protocolVersion: 2,
      method: "dashboard.agentModel",
      params: {
        ...params,
        expectedSelection: { status: "selected", selectionDigest: `sha256:${"0".repeat(64)}` },
      },
    })).rejects.toMatchObject({ kind: "AGENT_MODEL_SELECTION_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 66,
      protocolVersion: 2,
      method: "dashboard.agentModel",
      params: { ...params, expectedCapabilities: params.expectedCapabilities.slice(0, 1) },
    })).rejects.toMatchObject({ kind: "AGENT_MODEL_CAPABILITIES_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 67,
      protocolVersion: 2,
      method: "dashboard.agentModel",
      params: { ...params, authorizeLaunch: true },
    })).rejects.toMatchObject({ kind: "INVALID_PARAMS" })
  })
})
