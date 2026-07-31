using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ModelSwitchImplementationProjectionPrivacyBoundary =
        "projection-contains-record-identities-provider-model-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials";
    private const string ModelSwitchImplementationProjectionAuthorityBoundary =
        "model-switch-implementation-projection-is-read-only-and-grants-no-model-transition-context-transfer-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority";
    private const string ModelSwitchImplementationStatusAuthorityBoundary =
        "model-switch-implementation-status-is-observational-and-grants-no-model-transition-context-transfer-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority";

    internal static ModelSwitchImplementationProjection ParseModelSwitchImplementationResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "model-switch-implementation-projection") != "model-switch-implementation-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ModelSwitchImplementationProjectionPrivacyBoundary) != ModelSwitchImplementationProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ModelSwitchImplementationProjectionAuthorityBoundary) != ModelSwitchImplementationProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest"); if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest"); var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["unitCount", "pathCount", "staleBindingCount", "providerGapCount", "modelGapCount", "continuityGapCount", "transitionGapCount", "prerequisiteGapCount", "evidenceGapCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", "providerSwitchImplementation", "controlledCodexImplementation", "controlledClaudeImplementation"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "model-switch-implementation-status") != "model-switch-implementation-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ModelSwitchImplementationStatusAuthorityBoundary) != ModelSwitchImplementationStatusAuthorityBoundary) throw InvalidResponse();
        var values = counts.ToDictionary(name => name, name => ParseBoundedNonNegativeInt(status, name, 65_536));
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review"); var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-defined");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate");
        _ = ParseBusinessReference(status, "providerSwitchImplementation"); _ = ParseBusinessReference(status, "controlledCodexImplementation"); _ = ParseBusinessReference(status, "controlledClaudeImplementation");
        ModelSwitchImplementationRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var value)) {
            if (!HasOnlyProperties(value, "id", "revision", "digest", "state", "provider", "providerSwitchRole", "sourceSelection", "targetSelection", "sourceProvider", "targetProvider", "transition", "lifecycle", "unitCount", "pathCount", "prerequisiteCount", "bindingReceiptDigest", "modelReceiptDigest", "continuityReceiptDigest", "transitionReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "assessmentReceiptDigest", "reviewState", "updatedAt") || ParseRequiredEnum(value, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(value, "id"); var revision = ParsePositiveLong(value, "revision"); var digest = ParseRequiredDigest(value, "digest"); if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var providerName = ParseRequiredEnum(value, "provider", "codex", "claude"); var role = ParseRequiredEnum(value, "providerSwitchRole", "provider-switch-source-candidate", "provider-switch-target-candidate");
            (string Adapter, string Agent, string Model, string Capability) Selection(JsonElement selection) {
                if (!HasOnlyProperties(selection, "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings", "selectedAt", "capabilityDigest") || ParseBoundedNonNegativeInt(selection, "schemaVersion", 2) != 2 || selection.GetProperty("settings").ValueKind != JsonValueKind.Object) throw InvalidResponse();
                ParseRequiredTimestamp(selection, "selectedAt"); return (ParseSourceText(selection.GetProperty("adapterId"), 1, 128), ParseSourceText(selection.GetProperty("agentId"), 1, 128), ParseSourceText(selection.GetProperty("modelId"), 1, 1_024), ParseRequiredDigest(selection, "capabilityDigest"));
            }
            (string Adapter, string Agent, string Model, string Capability) Provider(JsonElement provider) {
                if (!HasRequiredAndAllowedProperties(provider, ["adapterId", "agentId", "modelId", "capabilityDigest"], ["runtimeVersion"])) throw InvalidResponse();
                if (provider.TryGetProperty("runtimeVersion", out var runtime)) ParseSourceText(runtime, 1, 1_024); return (ParseSourceText(provider.GetProperty("adapterId"), 1, 128), ParseSourceText(provider.GetProperty("agentId"), 1, 128), ParseSourceText(provider.GetProperty("modelId"), 1, 1_024), ParseRequiredDigest(provider, "capabilityDigest"));
            }
            var source = Selection(value.GetProperty("sourceSelection")); var target = Selection(value.GetProperty("targetSelection")); var sourceProvider = Provider(value.GetProperty("sourceProvider")); var targetProvider = Provider(value.GetProperty("targetProvider"));
            if (source.Adapter != target.Adapter || source.Agent != target.Agent || source.Model == target.Model || source.Capability != target.Capability || source != sourceProvider || target != targetProvider) throw InvalidResponse();
            var transition = value.GetProperty("transition"); if (!HasOnlyProperties(transition, "state", "transitionKey", "sourceModelState", "targetModelAvailabilityState", "capabilityRefreshState", "contextTransferState", "handoffState", "resumeState", "transitionReceiptDigest") || ParseRequiredEnum(transition, "state", "candidate-not-recorded") != "candidate-not-recorded" || ParseRequiredEnum(transition, "sourceModelState", "candidate-bound") != "candidate-bound" || ParseRequiredEnum(transition, "targetModelAvailabilityState", "not-established") != "not-established" || ParseRequiredEnum(transition, "capabilityRefreshState", "not-performed") != "not-performed" || ParseRequiredEnum(transition, "contextTransferState", "not-performed") != "not-performed" || ParseRequiredEnum(transition, "handoffState", "not-recorded") != "not-recorded" || ParseRequiredEnum(transition, "resumeState", "not-performed") != "not-performed") throw InvalidResponse();
            ParseSourceText(transition.GetProperty("transitionKey"), 1, 128); ParseRequiredDigest(transition, "transitionReceiptDigest");
            var lifecycle = value.GetProperty("lifecycle"); if (!HasOnlyProperties(lifecycle, "planningState", "modelTransitionState", "providerExecutionState", "capabilityRefreshState", "contextTransferState", "handoffState", "stageOwnershipState", "resumeState", "approvalState", "authorizationState", "sourceMutationState", "applyState", "discardState", "recoveryState")) throw InvalidResponse();
            string Exact(string name, string expected) { var result = ParseRequiredEnum(lifecycle, name, expected); if (result != expected) throw InvalidResponse(); return result; }
            Exact("planningState", "candidate-defined"); var modelTransition = Exact("modelTransitionState", "not-performed"); var providerExecution = Exact("providerExecutionState", "not-performed"); var capabilityRefresh = Exact("capabilityRefreshState", "not-performed"); var contextTransfer = Exact("contextTransferState", "not-performed"); var handoff = Exact("handoffState", "not-recorded"); var stageOwnership = Exact("stageOwnershipState", "unchanged"); var resume = Exact("resumeState", "not-performed"); Exact("approvalState", "not-established"); Exact("authorizationState", "not-established"); var sourceMutation = Exact("sourceMutationState", "not-performed"); var apply = Exact("applyState", "not-performed"); var discard = Exact("discardState", "not-performed"); var recovery = Exact("recoveryState", "not-exercised");
            foreach (var name in new[] { "bindingReceiptDigest", "modelReceiptDigest", "continuityReceiptDigest", "transitionReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "assessmentReceiptDigest" }) ParseRequiredDigest(value, name);
            candidate = new(id, revision, digest, providerName, role, source.Adapter, source.Agent, source.Model, target.Model, source.Capability, "candidate-not-recorded", "not-established", capabilityRefresh, contextTransfer, modelTransition, providerExecution, handoff, stageOwnership, resume, sourceMutation, apply, discard, recovery, ParseBoundedNonNegativeInt(value, "unitCount", 65_536), ParseBoundedNonNegativeInt(value, "pathCount", 65_536), ParseBoundedNonNegativeInt(value, "prerequisiteCount", 5), ParseRequiredEnum(value, "reviewState", "draft", "held", "ready-for-human-review"));
            if (candidate.UnitCount != values["unitCount"] || candidate.PathCount != values["pathCount"] || candidate.ReviewState != reviewState) throw InvalidResponse(); ParseRequiredTimestamp(value, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        if (state == "candidate-defined" && (candidate is null || reviewState != "ready-for-human-review" || reasons.Length != 0 || counts.Where(name => name is not ("unitCount" or "pathCount")).Sum(name => values[name]) > 0)) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons), values["unitCount"], values["pathCount"], values["staleBindingCount"], values["providerGapCount"], values["modelGapCount"], values["continuityGapCount"], values["transitionGapCount"], values["prerequisiteGapCount"], values["evidenceGapCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
