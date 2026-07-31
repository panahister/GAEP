using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ControlledDesignToCodeGenerationProjectionPrivacyBoundary =
        "projection-contains-record-identities-provider-model-identifiers-target-counts-states-and-receipt-digests-only-not-design-content-prompts-provider-output-source-diffs-machine-paths-personal-data-secrets-credentials-or-permissions";
    private const string ControlledDesignToCodeGenerationProjectionAuthorityBoundary =
        "controlled-design-to-code-generation-projection-is-read-only-and-grants-no-figma-or-provider-access-context-transfer-generation-output-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority";
    private const string ControlledDesignToCodeGenerationStatusAuthorityBoundary =
        "controlled-design-to-code-generation-status-is-observational-and-grants-no-figma-or-provider-access-context-transfer-generation-output-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority";

    internal static ControlledDesignToCodeGenerationProjection ParseControlledDesignToCodeGenerationResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "controlled-design-to-code-generation-projection") != "controlled-design-to-code-generation-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ControlledDesignToCodeGenerationProjectionPrivacyBoundary) != ControlledDesignToCodeGenerationProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ControlledDesignToCodeGenerationProjectionAuthorityBoundary) != ControlledDesignToCodeGenerationProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest"); if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest"); var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["targetCount", "implementationUnitCount", "pathCount", "expectedTraceCount", "expectedTestOutputCount", "staleBindingCount", "targetGapCount", "providerGapCount", "contextGapCount", "lifecycleGapCount", "prerequisiteGapCount", "evidenceGapCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", "dependencies", "selectedProvider"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "controlled-design-to-code-generation-status") != "controlled-design-to-code-generation-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ControlledDesignToCodeGenerationStatusAuthorityBoundary) != ControlledDesignToCodeGenerationStatusAuthorityBoundary) throw InvalidResponse();
        var values = counts.ToDictionary(name => name, name => ParseBoundedNonNegativeInt(status, name, 65_536));
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review"); var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-defined");
        string? selectedProvider = status.TryGetProperty("selectedProvider", out var selected) ? ParseRequiredEnum(status, "selectedProvider", "codex", "claude") : null;
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate");
        if (status.TryGetProperty("dependencies", out var dependencies)) {
            if (!HasOnlyProperties(dependencies, "approvedFigmaContextRetrieval", "designBaseline", "designToRequirementBinding", "figmaToBoilerplateMapping", "designToCodeBindingRegistry", "routeScreenComponentMapping", "implementationUnitModel", "technologyProfile", "boilerplateSelectionBinding", "boilerplateCompatibilityValidation", "proposedChangePreview", "stagingWorkspace", "controlledCodexImplementation", "controlledClaudeImplementation", "providerSwitchImplementation", "modelSwitchImplementation")) throw InvalidResponse();
            foreach (var property in dependencies.EnumerateObject()) { var reference = property.Value; if (!HasOnlyProperties(reference, "recordId", "revision", "digest")) throw InvalidResponse(); ParseRequiredGuid(reference, "recordId"); ParsePositiveLong(reference, "revision"); ParseRequiredDigest(reference, "digest"); }
        }
        ControlledDesignToCodeGenerationRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var value)) {
            if (!HasOnlyProperties(value, "id", "revision", "digest", "state", "selectedProvider", "selection", "provider", "designContext", "planKey", "targetCount", "implementationUnitCount", "pathCount", "dependencyReceiptDigest", "providerReceiptDigest", "designContextReceiptDigest", "targetCatalogDigest", "expectedOutputReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "assessmentReceiptDigest", "lifecycle", "reviewState", "updatedAt") || ParseRequiredEnum(value, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(value, "id"); var revision = ParsePositiveLong(value, "revision"); var digest = ParseRequiredDigest(value, "digest"); if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var providerName = ParseRequiredEnum(value, "selectedProvider", "codex", "claude");
            var selection = value.GetProperty("selection"); if (!HasOnlyProperties(selection, "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings", "selectedAt", "capabilityDigest") || ParseBoundedNonNegativeInt(selection, "schemaVersion", 2) != 2) throw InvalidResponse();
            var adapterId = ParseSourceText(selection.GetProperty("adapterId"), 1, 128); var agentId = ParseSourceText(selection.GetProperty("agentId"), 1, 128); var modelId = ParseSourceText(selection.GetProperty("modelId"), 1, 1_024); var capabilityDigest = ParseRequiredDigest(selection, "capabilityDigest"); ParseRequiredTimestamp(selection, "selectedAt");
            var provider = value.GetProperty("provider"); if (!HasRequiredAndAllowedProperties(provider, ["adapterId", "agentId", "modelId", "capabilityDigest"], ["runtimeVersion"]) || ParseSourceText(provider.GetProperty("adapterId"), 1, 128) != adapterId || ParseSourceText(provider.GetProperty("agentId"), 1, 128) != agentId || ParseSourceText(provider.GetProperty("modelId"), 1, 1_024) != modelId || ParseRequiredDigest(provider, "capabilityDigest") != capabilityDigest) throw InvalidResponse();
            if (provider.TryGetProperty("runtimeVersion", out var runtimeVersion)) ParseSourceText(runtimeVersion, 1, 1_024);
            var design = value.GetProperty("designContext"); if (!HasOnlyProperties(design, "approvedSnapshotReceiptDigest", "approvedGenerationContextReceiptDigest", "baselineMembershipDigest", "baselineSemanticVersion", "designBindingCatalogDigest", "routeSubjectCatalogDigest", "contentBoundary", "materializationState", "transferState")) throw InvalidResponse();
            foreach (var name in new[] { "approvedSnapshotReceiptDigest", "approvedGenerationContextReceiptDigest", "baselineMembershipDigest", "designBindingCatalogDigest", "routeSubjectCatalogDigest" }) ParseRequiredDigest(design, name);
            var baselineVersion = ParseSourceText(design.GetProperty("baselineSemanticVersion"), 1, 128); var contentBoundary = ParseRequiredEnum(design, "contentBoundary", "metadata-and-digests-only"); var materialization = ParseRequiredEnum(design, "materializationState", "not-performed"); var transfer = ParseRequiredEnum(design, "transferState", "not-performed"); ParseSourceText(value.GetProperty("planKey"), 1, 128);
            var lifecycle = value.GetProperty("lifecycle"); if (!HasOnlyProperties(lifecycle, "planningState", "figmaAccessState", "contextMaterializationState", "contextTransferState", "providerExecutionState", "generatedOutputState", "outputInspectionState", "realStageCreationState", "sourceMutationState", "approvalState", "authorizationState", "acceptanceState")) throw InvalidResponse();
            string Exact(string name, string expected) { var result = ParseRequiredEnum(lifecycle, name, expected); if (result != expected) throw InvalidResponse(); return result; }
            Exact("planningState", "candidate-defined"); var figma = Exact("figmaAccessState", "not-performed"); Exact("contextMaterializationState", "not-performed"); Exact("contextTransferState", "not-performed"); var execution = Exact("providerExecutionState", "not-performed"); var output = Exact("generatedOutputState", "not-created"); var inspection = Exact("outputInspectionState", "not-performed"); var stage = Exact("realStageCreationState", "not-performed"); var mutation = Exact("sourceMutationState", "not-performed"); Exact("approvalState", "not-established"); Exact("authorizationState", "not-established"); Exact("acceptanceState", "not-established");
            var targetCount = ParseBoundedNonNegativeInt(value, "targetCount", 65_536); var unitCount = ParseBoundedNonNegativeInt(value, "implementationUnitCount", 65_536); var pathCount = ParseBoundedNonNegativeInt(value, "pathCount", 65_536);
            foreach (var name in new[] { "dependencyReceiptDigest", "providerReceiptDigest", "designContextReceiptDigest", "targetCatalogDigest", "expectedOutputReceiptDigest", "lifecycleReceiptDigest", "prerequisiteReceiptDigest", "assessmentReceiptDigest" }) ParseRequiredDigest(value, name);
            candidate = new(id, revision, digest, providerName, adapterId, agentId, modelId, baselineVersion, contentBoundary, materialization, transfer, targetCount, unitCount, pathCount, figma, execution, output, inspection, stage, mutation, ParseRequiredEnum(value, "reviewState", "draft", "held", "ready-for-human-review"));
            if (candidate.ReviewState != reviewState || providerName != selectedProvider || targetCount != values["targetCount"] || unitCount != values["implementationUnitCount"] || pathCount != values["pathCount"]) throw InvalidResponse(); ParseRequiredTimestamp(value, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        if (state == "candidate-defined" && (candidate is null || reviewState != "ready-for-human-review" || reasons.Length != 0 || counts.Where(name => name is not ("targetCount" or "implementationUnitCount" or "pathCount" or "expectedTraceCount" or "expectedTestOutputCount")).Sum(name => values[name]) > 0)) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons), selectedProvider,
            values["targetCount"], values["implementationUnitCount"], values["pathCount"], values["expectedTraceCount"], values["expectedTestOutputCount"], values["staleBindingCount"], values["targetGapCount"], values["providerGapCount"], values["contextGapCount"], values["lifecycleGapCount"], values["prerequisiteGapCount"], values["evidenceGapCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
