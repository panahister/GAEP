using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ProviderSwitchImplementationProjectionPrivacyBoundary =
        "projection-contains-record-identities-repository-relative-path-candidates-provider-model-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials";
    private const string ProviderSwitchImplementationProjectionAuthorityBoundary =
        "provider-switch-implementation-projection-is-read-only-and-grants-no-provider-transition-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority";
    private const string ProviderSwitchImplementationStatusAuthorityBoundary =
        "provider-switch-implementation-status-is-observational-and-grants-no-provider-transition-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority";

    internal static ProviderSwitchImplementationProjection ParseProviderSwitchImplementationResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "provider-switch-implementation-projection") != "provider-switch-implementation-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ProviderSwitchImplementationProjectionPrivacyBoundary) != ProviderSwitchImplementationProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ProviderSwitchImplementationProjectionAuthorityBoundary) != ProviderSwitchImplementationProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest"); if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest"); var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["unitCount", "pathCount", "candidateDefinedCount", "gapCount", "staleBindingCount", "providerGapCount", "continuityGapCount", "handoffGapCount", "prerequisiteGapCount", "evidenceGapCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", "proposedChangePreview", "stagingWorkspace", "controlledCodexImplementation", "controlledClaudeImplementation"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "provider-switch-implementation-status") != "provider-switch-implementation-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ProviderSwitchImplementationStatusAuthorityBoundary) != ProviderSwitchImplementationStatusAuthorityBoundary) throw InvalidResponse();
        var values = counts.ToDictionary(name => name, name => ParseBoundedNonNegativeInt(status, name, 65_536));
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review"); var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-defined");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate");
        _ = ParseBusinessReference(status, "proposedChangePreview"); _ = ParseBusinessReference(status, "stagingWorkspace"); _ = ParseBusinessReference(status, "controlledCodexImplementation"); _ = ParseBusinessReference(status, "controlledClaudeImplementation");
        ProviderSwitchImplementationRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var value)) {
            if (!HasOnlyProperties(value, "id", "revision", "digest", "state", "direction", "sourceProvider", "targetProvider", "sourceSelection", "targetSelection", "handoff", "lifecycle", "unitCount", "pathCount", "prerequisiteCount", "bindingReceiptDigest", "providerReceiptDigest", "continuityReceiptDigest", "handoffReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "assessmentReceiptDigest", "reviewState", "updatedAt") || ParseRequiredEnum(value, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(value, "id"); var revision = ParsePositiveLong(value, "revision"); var digest = ParseRequiredDigest(value, "digest"); if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var direction = ParseRequiredEnum(value, "direction", "codex-to-claude", "claude-to-codex");
            (string Adapter, string Agent, string Model) Provider(JsonElement provider) {
                if (!HasRequiredAndAllowedProperties(provider, ["adapterId", "agentId", "modelId", "capabilityDigest"], ["runtimeVersion"])) throw InvalidResponse();
                var adapter = ParseSourceText(provider.GetProperty("adapterId"), 1, 128); var agent = ParseSourceText(provider.GetProperty("agentId"), 1, 128); var model = ParseSourceText(provider.GetProperty("modelId"), 1, 1_024); ParseRequiredDigest(provider, "capabilityDigest");
                if (provider.TryGetProperty("runtimeVersion", out var runtime)) ParseSourceText(runtime, 1, 1_024); return (adapter, agent, model);
            }
            var source = Provider(value.GetProperty("sourceProvider")); var target = Provider(value.GetProperty("targetProvider"));
            if (source.Adapter == target.Adapter || direction == "codex-to-claude" && (source.Adapter != "gaep.codex-cli" || target.Adapter != "gaep.claude-code-cli") || direction == "claude-to-codex" && (source.Adapter != "gaep.claude-code-cli" || target.Adapter != "gaep.codex-cli")) throw InvalidResponse();
            foreach (var selectionName in new[] { "sourceSelection", "targetSelection" }) {
                var selection = value.GetProperty(selectionName); if (!HasOnlyProperties(selection, "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings", "selectedAt", "capabilityDigest") || ParseBoundedNonNegativeInt(selection, "schemaVersion", 2) != 2) throw InvalidResponse();
                ParseSourceText(selection.GetProperty("adapterId"), 1, 128); ParseSourceText(selection.GetProperty("agentId"), 1, 128); ParseSourceText(selection.GetProperty("modelId"), 1, 1_024); ParseRequiredDigest(selection, "capabilityDigest"); ParseRequiredTimestamp(selection, "selectedAt"); if (selection.GetProperty("settings").ValueKind != JsonValueKind.Object) throw InvalidResponse();
            }
            var handoff = value.GetProperty("handoff"); if (!HasOnlyProperties(handoff, "state", "handoffKey", "sourceTerminalRunState", "targetRuntimeReadinessState", "stageOwnershipTransferState", "resumeState", "handoffReceiptDigest") || ParseRequiredEnum(handoff, "state", "candidate-not-recorded") != "candidate-not-recorded" || ParseRequiredEnum(handoff, "sourceTerminalRunState", "not-established") != "not-established" || ParseRequiredEnum(handoff, "targetRuntimeReadinessState", "not-established") != "not-established" || ParseRequiredEnum(handoff, "stageOwnershipTransferState", "not-performed") != "not-performed" || ParseRequiredEnum(handoff, "resumeState", "not-performed") != "not-performed") throw InvalidResponse();
            ParseSourceText(handoff.GetProperty("handoffKey"), 1, 128); ParseRequiredDigest(handoff, "handoffReceiptDigest");
            var lifecycle = value.GetProperty("lifecycle"); if (!HasOnlyProperties(lifecycle, "planningState", "providerTransitionState", "handoffState", "stageOwnershipState", "resumeState", "approvalState", "authorizationState", "sourceMutationState", "applyState", "discardState", "recoveryState")) throw InvalidResponse();
            string Exact(string name, string expected) { var result = ParseRequiredEnum(lifecycle, name, expected); if (result != expected) throw InvalidResponse(); return result; }
            Exact("planningState", "candidate-defined"); var providerTransition = Exact("providerTransitionState", "not-performed"); var handoffState = Exact("handoffState", "not-recorded"); var stageOwnership = Exact("stageOwnershipState", "unchanged"); var resume = Exact("resumeState", "not-performed"); Exact("approvalState", "not-established"); Exact("authorizationState", "not-established"); var sourceMutation = Exact("sourceMutationState", "not-performed"); var apply = Exact("applyState", "not-performed"); var discard = Exact("discardState", "not-performed"); var recovery = Exact("recoveryState", "not-exercised");
            foreach (var name in new[] { "bindingReceiptDigest", "providerReceiptDigest", "continuityReceiptDigest", "handoffReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "assessmentReceiptDigest" }) ParseRequiredDigest(value, name);
            candidate = new(id, revision, digest, direction, source.Adapter, source.Agent, source.Model, target.Adapter, target.Agent, target.Model, handoffState, providerTransition, stageOwnership, resume, sourceMutation, apply, discard, recovery, ParseBoundedNonNegativeInt(value, "unitCount", 65_536), ParseBoundedNonNegativeInt(value, "pathCount", 65_536), ParseBoundedNonNegativeInt(value, "prerequisiteCount", 5), ParseRequiredEnum(value, "reviewState", "draft", "held", "ready-for-human-review"));
            if (candidate.UnitCount != values["unitCount"] || candidate.PathCount != values["pathCount"] || candidate.ReviewState != reviewState) throw InvalidResponse(); ParseRequiredTimestamp(value, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        if (state == "candidate-defined" && (candidate is null || reviewState != "ready-for-human-review" || reasons.Length != 0 || counts.Where(name => name is not ("unitCount" or "pathCount" or "candidateDefinedCount")).Sum(name => values[name]) > 0)) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            values["unitCount"], values["pathCount"], values["candidateDefinedCount"], values["gapCount"], values["staleBindingCount"], values["providerGapCount"], values["continuityGapCount"], values["handoffGapCount"], values["prerequisiteGapCount"], values["evidenceGapCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
