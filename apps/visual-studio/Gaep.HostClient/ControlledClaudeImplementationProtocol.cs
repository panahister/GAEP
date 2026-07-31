using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ControlledClaudeImplementationProjectionPrivacyBoundary =
        "projection-contains-record-identities-repository-relative-scopes-provider-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials";
    private const string ControlledClaudeImplementationProjectionAuthorityBoundary =
        "controlled-claude-implementation-projection-is-read-only-and-grants-no-execution-stage-approval-authorization-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority";
    private const string ControlledClaudeImplementationStatusAuthorityBoundary =
        "controlled-claude-implementation-status-is-observational-and-grants-no-execution-stage-approval-authorization-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority";

    internal static ControlledClaudeImplementationProjection ParseControlledClaudeImplementationResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "controlled-claude-implementation-projection") != "controlled-claude-implementation-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ControlledClaudeImplementationProjectionPrivacyBoundary) != ControlledClaudeImplementationProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ControlledClaudeImplementationProjectionAuthorityBoundary) != ControlledClaudeImplementationProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest"); if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest"); var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["unitCount", "pathCount", "resourceScopeCount", "toolPermissionCount", "candidateDefinedCount", "gapCount", "staleBindingCount", "providerGapCount", "scopeGapCount", "planGapCount", "prerequisiteGapCount", "recoveryGapCount", "evidenceGapCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", "proposedChangePreview", "stagingWorkspace"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "controlled-claude-implementation-status") != "controlled-claude-implementation-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ControlledClaudeImplementationStatusAuthorityBoundary) != ControlledClaudeImplementationStatusAuthorityBoundary) throw InvalidResponse();
        var values = counts.ToDictionary(name => name, name => ParseBoundedNonNegativeInt(status, name, 65_536));
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review"); var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-defined");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate");
        _ = ParseBusinessReference(status, "proposedChangePreview"); _ = ParseBusinessReference(status, "stagingWorkspace");
        ControlledClaudeImplementationRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var value)) {
            if (!HasOnlyProperties(value, "id", "revision", "digest", "state", "provider", "runtimeBoundary", "plan", "lifecycle", "resourceScopes", "permissions", "unitCount", "pathCount", "prerequisiteCount", "bindingReceiptDigest", "providerReceiptDigest", "runtimeBoundaryReceiptDigest", "scopeReceiptDigest", "planReceiptDigest", "stagedEffectReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "recoveryReceiptDigest", "assessmentReceiptDigest", "reviewState", "updatedAt") || ParseRequiredEnum(value, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(value, "id"); var revision = ParsePositiveLong(value, "revision"); var digest = ParseRequiredDigest(value, "digest"); if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var provider = value.GetProperty("provider"); if (!HasRequiredAndAllowedProperties(provider, ["adapterId", "agentId", "modelId", "capabilityDigest"], ["runtimeVersion"])) throw InvalidResponse();
            var adapterId = ParseSourceText(provider.GetProperty("adapterId"), 1, 128); var agentId = ParseSourceText(provider.GetProperty("agentId"), 1, 128); var modelId = ParseSourceText(provider.GetProperty("modelId"), 1, 1_024); var capabilityDigest = ParseRequiredDigest(provider, "capabilityDigest");
            if (adapterId != "gaep.claude-code-cli" || agentId != "claude-code-cli") throw InvalidResponse(); if (provider.TryGetProperty("runtimeVersion", out var runtime)) ParseSourceText(runtime, 1, 1_024);
            var runtimeBoundary = value.GetProperty("runtimeBoundary");
            if (!HasOnlyProperties(runtimeBoundary, "mode", "supportedRuntimeState", "authenticationState", "effectivePolicyState", "credentialAccessState", "administratorPolicyBypassState", "workspaceAccessState", "toolAccessState", "resumeCapabilityState")) throw InvalidResponse();
            string RuntimeExact(string name, string expected) { var result = ParseRequiredEnum(runtimeBoundary, name, expected); if (result != expected) throw InvalidResponse(); return result; }
            var runtimeMode = RuntimeExact("mode", "claude-context-only");
            var supportedRuntime = RuntimeExact("supportedRuntimeState", "not-established");
            var authentication = RuntimeExact("authenticationState", "not-established");
            var effectivePolicy = RuntimeExact("effectivePolicyState", "not-established");
            var credentialAccess = RuntimeExact("credentialAccessState", "not-attempted");
            var administratorPolicyBypass = RuntimeExact("administratorPolicyBypassState", "not-attempted");
            var workspaceAccess = RuntimeExact("workspaceAccessState", "not-granted");
            var toolAccess = RuntimeExact("toolAccessState", "not-granted");
            var resumeCapability = RuntimeExact("resumeCapabilityState", "not-established");
            var plan = value.GetProperty("plan"); if (!HasOnlyProperties(plan, "strategy", "planKey", "workflowPlan", "planReceiptDigest", "stagedEffectReceiptDigest") || ParseRequiredEnum(plan, "strategy", "managed-claude-context-only-candidate") != "managed-claude-context-only-candidate") throw InvalidResponse();
            var planKey = ParseSourceText(plan.GetProperty("planKey"), 1, 128); ParseRequiredDigest(plan, "planReceiptDigest"); ParseRequiredDigest(plan, "stagedEffectReceiptDigest");
            var workflow = plan.GetProperty("workflowPlan"); if (!HasOnlyProperties(workflow, "recordId", "revision", "digest")) throw InvalidResponse(); ParseRequiredGuid(workflow, "recordId"); ParsePositiveLong(workflow, "revision"); ParseRequiredDigest(workflow, "digest");
            var lifecycle = value.GetProperty("lifecycle"); if (!HasOnlyProperties(lifecycle, "planningState", "providerExecutionState", "realStageCreationState", "approvalState", "authorizationState", "sourceMutationState", "applyState", "discardState", "cancellationState", "resumeState", "recoveryState")) throw InvalidResponse();
            string Exact(string name, string expected) { var result = ParseRequiredEnum(lifecycle, name, expected); if (result != expected) throw InvalidResponse(); return result; }
            if (Exact("planningState", "candidate-defined") != "candidate-defined") throw InvalidResponse();
            var providerExecution = Exact("providerExecutionState", "not-performed"); var realStage = Exact("realStageCreationState", "not-performed"); Exact("approvalState", "not-established"); Exact("authorizationState", "not-established"); var sourceMutation = Exact("sourceMutationState", "not-performed"); var apply = Exact("applyState", "not-performed"); var discard = Exact("discardState", "not-performed"); Exact("cancellationState", "not-exercised"); Exact("resumeState", "not-exercised"); Exact("recoveryState", "not-exercised");
            var scopes = value.GetProperty("resourceScopes"); var permissions = value.GetProperty("permissions"); if (scopes.ValueKind != JsonValueKind.Array || scopes.GetArrayLength() > 65_536 || permissions.ValueKind != JsonValueKind.Array || permissions.GetArrayLength() != 1) throw InvalidResponse();
            foreach (var scope in scopes.EnumerateArray()) ParseWorkspaceRelativePath(scope); foreach (var permission in permissions.EnumerateArray()) { if (!HasOnlyProperties(permission, "capability", "mode", "scope") || ParseRequiredEnum(permission, "capability", "all-tools") != "all-tools" || ParseRequiredEnum(permission, "mode", "deny") != "deny" || permission.GetProperty("scope").ValueKind != JsonValueKind.Array || permission.GetProperty("scope").GetArrayLength() != 0) throw InvalidResponse(); }
            foreach (var name in new[] { "bindingReceiptDigest", "providerReceiptDigest", "runtimeBoundaryReceiptDigest", "scopeReceiptDigest", "planReceiptDigest", "stagedEffectReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "recoveryReceiptDigest", "assessmentReceiptDigest" }) ParseRequiredDigest(value, name);
            candidate = new(id, revision, digest, adapterId, agentId, modelId, capabilityDigest, planKey, providerExecution, realStage, sourceMutation, apply, discard, ParseBoundedNonNegativeInt(value, "unitCount", 65_536), ParseBoundedNonNegativeInt(value, "pathCount", 65_536), ParseBoundedNonNegativeInt(value, "prerequisiteCount", 4), ParseRequiredEnum(value, "reviewState", "draft", "held", "ready-for-human-review"), runtimeMode, supportedRuntime, authentication, effectivePolicy, credentialAccess, administratorPolicyBypass, workspaceAccess, toolAccess, resumeCapability);
            if (candidate.UnitCount != values["unitCount"] || candidate.PathCount != values["pathCount"] || candidate.ReviewState != reviewState) throw InvalidResponse(); ParseRequiredTimestamp(value, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        if (state == "candidate-defined" && (candidate is null || reviewState != "ready-for-human-review" || reasons.Length != 0 || counts.Where(name => name is not ("unitCount" or "pathCount" or "resourceScopeCount" or "toolPermissionCount" or "candidateDefinedCount")).Sum(name => values[name]) > 0)) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            values["unitCount"], values["pathCount"], values["resourceScopeCount"], values["toolPermissionCount"], values["candidateDefinedCount"], values["gapCount"], values["staleBindingCount"], values["providerGapCount"], values["scopeGapCount"], values["planGapCount"], values["prerequisiteGapCount"], values["recoveryGapCount"], values["evidenceGapCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
