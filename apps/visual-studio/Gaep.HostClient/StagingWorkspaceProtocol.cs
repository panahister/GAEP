using System.Text.Json;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string StagingWorkspaceProjectionPrivacyBoundary =
        "projection-contains-record-identities-repository-relative-path-candidates-staging-identity-lifecycle-capacity-exclusion-recovery-counts-statuses-and-receipt-digests-only-not-machine-stage-paths-file-or-diff-content-evidence-content-personal-data-secrets-or-credentials";
    private const string StagingWorkspaceProjectionAuthorityBoundary =
        "staging-workspace-projection-is-read-only-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string StagingWorkspaceStatusAuthorityBoundary =
        "staging-workspace-status-is-observational-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static StagingWorkspaceProjection ParseStagingWorkspaceResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "staging-workspace-projection") != "staging-workspace-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", StagingWorkspaceProjectionPrivacyBoundary) != StagingWorkspaceProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", StagingWorkspaceProjectionAuthorityBoundary) != StagingWorkspaceProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["previewUnitCount", "previewPathCount", "stagingUnitCount", "stagingPathCount", "candidateDefinedCount", "unavailableCount", "gapCount", "conflictCount", "staleCount", "notAssessedCount", "orphanUnitCount", "orphanPathCount", "inspectionGapCount", "exclusionGapCount", "capacityGapCount", "recoveryGapCount", "evidenceGapCount", "staleBindingCount", "stalePreviewCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", "proposedChangePreview"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "staging-workspace-status") != "staging-workspace-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", StagingWorkspaceStatusAuthorityBoundary) != StagingWorkspaceStatusAuthorityBoundary) throw InvalidResponse();
        int Count(string name) => ParseBoundedNonNegativeInt(status, name, 65_536);
        var values = counts.ToDictionary(name => name, Count);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-defined");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate"); var previewReference = ParseBusinessReference(status, "proposedChangePreview");
        StagingWorkspaceRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement)) {
            if (!HasOnlyProperties(candidateElement, "id", "revision", "digest", "state", "stagingIdentity", "lifecycle", "capacity", "exclusionRuleIds", "excludedPathCandidateCount", "recovery", "bindingReceiptDigest", "inventoryReceiptDigest", "lifecycleReceiptDigest", "exclusionReceiptDigest", "capacityReceiptDigest", "recoveryReceiptDigest", "inspectionReceiptDigest", "assessmentReceiptDigest", "reviewState", "updatedAt", "units") || ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(candidateElement, "id"); var revision = ParsePositiveLong(candidateElement, "revision"); var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var identity = candidateElement.GetProperty("stagingIdentity"); if (!HasOnlyProperties(identity, "namespace", "stageKey", "generation", "scopeDigest") || ParseRequiredEnum(identity, "namespace", "gaep-managed-stage") != "gaep-managed-stage") throw InvalidResponse();
            var stageKey = ParseSourceText(identity.GetProperty("stageKey"), 1, 128); if (!Regex.IsMatch(stageKey, "^[a-z0-9][a-z0-9._-]{0,127}$", RegexOptions.CultureInvariant)) throw InvalidResponse();
            var generation = ParseBoundedNonNegativeInt(identity, "generation", 1_000_000); if (generation < 1) throw InvalidResponse(); ParseRequiredDigest(identity, "scopeDigest");
            var lifecycle = candidateElement.GetProperty("lifecycle"); if (!HasOnlyProperties(lifecycle, "definitionState", "provisioningState", "actualStageExistenceState", "inspectionState", "applyState", "discardState", "disposalState") ||
                ParseRequiredEnum(lifecycle, "definitionState", "candidate-defined") != "candidate-defined" || ParseRequiredEnum(lifecycle, "provisioningState", "not-performed") != "not-performed" || ParseRequiredEnum(lifecycle, "actualStageExistenceState", "not-established") != "not-established" ||
                ParseRequiredEnum(lifecycle, "applyState", "not-performed") != "not-performed" || ParseRequiredEnum(lifecycle, "discardState", "not-performed") != "not-performed" || ParseRequiredEnum(lifecycle, "disposalState", "not-performed") != "not-performed") throw InvalidResponse();
            var inspectionState = ParseRequiredEnum(lifecycle, "inspectionState", "candidate-complete", "candidate-partial", "unavailable", "not-assessed");
            var capacity = candidateElement.GetProperty("capacity"); if (!HasOnlyProperties(capacity, "maximumFiles", "maximumBytes", "maximumSingleFileBytes", "maximumPathBytes", "maximumChanges", "candidateFileCount", "candidateByteCount")) throw InvalidResponse();
            var maximumFiles = ParseBoundedNonNegativeInt(capacity, "maximumFiles", 65_536); var candidateFileCount = ParseBoundedNonNegativeInt(capacity, "candidateFileCount", 65_536);
            var maximumBytes = ParsePositiveLong(capacity, "maximumBytes"); var candidateByteCount = capacity.GetProperty("candidateByteCount").GetInt64();
            if (maximumFiles < 1 || maximumBytes > 17_179_869_184L || candidateByteCount < 0 || candidateByteCount > maximumBytes) throw InvalidResponse();
            ParsePositiveLong(capacity, "maximumSingleFileBytes"); ParseBoundedNonNegativeInt(capacity, "maximumPathBytes", 16_384); ParseBoundedNonNegativeInt(capacity, "maximumChanges", 65_536);
            var exclusions = candidateElement.GetProperty("exclusionRuleIds"); if (exclusions.ValueKind != JsonValueKind.Array || exclusions.GetArrayLength() > 512) throw InvalidResponse();
            foreach (var rule in exclusions.EnumerateArray()) ParseSourceText(rule, 1, 128); ParseBoundedNonNegativeInt(candidateElement, "excludedPathCandidateCount", 65_536);
            var recovery = candidateElement.GetProperty("recovery"); if (!HasOnlyProperties(recovery, "strategy", "journalKey", "replayState", "checkpointDigest") || ParseRequiredEnum(recovery, "strategy", "write-ahead-journal-candidate") != "write-ahead-journal-candidate") throw InvalidResponse();
            ParseSourceText(recovery.GetProperty("journalKey"), 1, 128); var recoveryState = ParseRequiredEnum(recovery, "replayState", "candidate-defined", "unavailable", "not-assessed"); var recoveryCheckpoint = ParseRequiredDigest(recovery, "checkpointDigest");
            var units = candidateElement.GetProperty("units"); if (units.ValueKind != JsonValueKind.Array || units.GetArrayLength() > 65_536) throw InvalidResponse();
            var pathCount = 0;
            foreach (var unit in units.EnumerateArray()) {
                if (!HasOnlyProperties(unit, "implementationUnitId", "implementationUnitKey", "outcome", "paths")) throw InvalidResponse();
                ParseRequiredGuid(unit, "implementationUnitId"); ParseSourceText(unit.GetProperty("implementationUnitKey"), 1, 128); ParseRequiredEnum(unit, "outcome", "candidate-defined", "unavailable", "gap", "conflict", "stale", "not-assessed");
                var paths = unit.GetProperty("paths"); if (paths.ValueKind != JsonValueKind.Array || paths.GetArrayLength() > 65_536 - pathCount) throw InvalidResponse(); pathCount += paths.GetArrayLength();
                foreach (var path in paths.EnumerateArray()) {
                    if (!HasRequiredAndAllowedProperties(path, ["pathCandidate", "changeKind", "inspectionState", "outcome", "previewPathDigest"], ["sourcePathCandidate"])) throw InvalidResponse();
                    ParseWorkspaceRelativePath(path.GetProperty("pathCandidate")); if (path.TryGetProperty("sourcePathCandidate", out var sourcePath)) ParseWorkspaceRelativePath(sourcePath);
                    ParseRequiredEnum(path, "changeKind", "add", "delete", "modify", "move", "not-assessed"); ParseRequiredEnum(path, "inspectionState", "candidate-complete", "candidate-partial", "unavailable", "not-assessed"); ParseRequiredEnum(path, "outcome", "candidate-defined", "unavailable", "gap", "conflict", "stale", "not-assessed"); ParseRequiredDigest(path, "previewPathDigest");
                }
            }
            if (pathCount != values["stagingPathCount"] || units.GetArrayLength() != values["stagingUnitCount"]) throw InvalidResponse();
            candidate = new(id, revision, digest, stageKey, generation, ParseRequiredEnum(lifecycle, "actualStageExistenceState", "not-established"), inspectionState,
                candidateFileCount, maximumFiles, candidateByteCount, maximumBytes, recoveryState, recoveryCheckpoint, ParseRequiredDigest(candidateElement, "inspectionReceiptDigest"), units.GetArrayLength(), ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            foreach (var name in new[] { "bindingReceiptDigest", "inventoryReceiptDigest", "lifecycleReceiptDigest", "exclusionReceiptDigest", "capacityReceiptDigest", "recoveryReceiptDigest", "assessmentReceiptDigest" }) ParseRequiredDigest(candidateElement, name);
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (previewReference is null) != (candidate is null) || (candidate is not null && candidate.ReviewState != reviewState) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        if (state == "candidate-defined" && (candidate is null || reviewState != "ready-for-human-review" || reasons.Length != 0 || values["previewUnitCount"] != values["stagingUnitCount"] || values["previewPathCount"] != values["stagingPathCount"] || counts.Where(name => name is not ("previewUnitCount" or "previewPathCount" or "stagingUnitCount" or "stagingPathCount" or "candidateDefinedCount")).Sum(name => values[name]) > 0)) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            values["previewUnitCount"], values["previewPathCount"], values["stagingUnitCount"], values["stagingPathCount"], values["candidateDefinedCount"], values["unavailableCount"], values["gapCount"], values["conflictCount"], values["staleCount"], values["notAssessedCount"], values["orphanUnitCount"], values["orphanPathCount"], values["inspectionGapCount"], values["exclusionGapCount"], values["capacityGapCount"], values["recoveryGapCount"], values["evidenceGapCount"], values["staleBindingCount"], values["stalePreviewCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
