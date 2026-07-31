using System.Text.Json;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ProposedChangePreviewProjectionPrivacyBoundary =
        "projection-contains-record-identities-repository-relative-path-candidates-change-kinds-endpoint-and-diff-metadata-counts-statuses-and-receipt-digests-only-not-file-or-diff-content-evidence-content-personal-data-secrets-credentials-or-machine-paths";
    private const string ProposedChangePreviewProjectionAuthorityBoundary =
        "proposed-change-preview-projection-is-read-only-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string ProposedChangePreviewStatusAuthorityBoundary =
        "proposed-change-preview-status-is-observational-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static ProposedChangePreviewProjection ParseProposedChangePreviewResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "proposed-change-preview-projection") != "proposed-change-preview-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ProposedChangePreviewProjectionPrivacyBoundary) != ProposedChangePreviewProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ProposedChangePreviewProjectionAuthorityBoundary) != ProposedChangePreviewProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["inventoryUnitCount", "inventoryPathCount", "previewUnitCount", "previewPathCount", "candidatePreviewedCount", "gapCount", "conflictCount", "staleCount", "notAssessedCount", "orphanUnitCount", "orphanPathCount", "endpointGapCount", "diffGapCount", "traceGapCount", "evidenceGapCount", "staleBindingCount", "staleInventoryCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", "changedUnitInventory"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "proposed-change-preview-status") != "proposed-change-preview-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ProposedChangePreviewStatusAuthorityBoundary) != ProposedChangePreviewStatusAuthorityBoundary) throw InvalidResponse();
        int Count(string name) => ParseBoundedNonNegativeInt(status, name, 65_536);
        var values = counts.ToDictionary(name => name, Count);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-previewed");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate"); var inventoryReference = ParseBusinessReference(status, "changedUnitInventory");
        ProposedChangePreviewRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement)) {
            if (!HasOnlyProperties(candidateElement, "id", "revision", "digest", "state", "dependencyReceiptDigest", "planReceiptDigest", "diffReceiptDigest", "traceReceiptDigest", "evidenceReceiptDigest", "assessmentReceiptDigest", "reviewState", "updatedAt", "units") || ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(candidateElement, "id"); var revision = ParsePositiveLong(candidateElement, "revision"); var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var units = candidateElement.GetProperty("units"); if (units.ValueKind != JsonValueKind.Array || units.GetArrayLength() > 65_536) throw InvalidResponse();
            var pathCount = 0;
            foreach (var unit in units.EnumerateArray()) {
                if (!HasOnlyProperties(unit, "implementationUnitId", "implementationUnitKey", "outcome", "paths")) throw InvalidResponse();
                ParseRequiredGuid(unit, "implementationUnitId");
                var key = ParseSourceText(unit.GetProperty("implementationUnitKey"), 1, 128); if (!Regex.IsMatch(key, "^[a-z0-9][a-z0-9._-]{0,127}$", RegexOptions.CultureInvariant)) throw InvalidResponse();
                ParseRequiredEnum(unit, "outcome", "candidate-previewed", "gap", "conflict", "stale", "not-assessed");
                var paths = unit.GetProperty("paths"); if (paths.ValueKind != JsonValueKind.Array || paths.GetArrayLength() > 65_536 - pathCount) throw InvalidResponse(); pathCount += paths.GetArrayLength();
                foreach (var path in paths.EnumerateArray()) {
                    if (!HasRequiredAndAllowedProperties(path, ["pathCandidate", "changeKind", "sourceState", "targetState", "diffState", "diffFormat", "truncated"], ["sourcePathCandidate", "patchDigest", "addedLineCount", "removedLineCount"])) throw InvalidResponse();
                    ParseWorkspaceRelativePath(path.GetProperty("pathCandidate")); if (path.TryGetProperty("sourcePathCandidate", out var sourcePath)) ParseWorkspaceRelativePath(sourcePath);
                    ParseRequiredEnum(path, "changeKind", "add", "delete", "modify", "move", "not-assessed");
                    ParseRequiredEnum(path, "sourceState", "candidate-observed", "candidate-generated", "candidate-absent", "unavailable", "not-assessed");
                    ParseRequiredEnum(path, "targetState", "candidate-observed", "candidate-generated", "candidate-absent", "unavailable", "not-assessed");
                    ParseRequiredEnum(path, "diffState", "candidate-generated", "unavailable", "gap", "conflict", "stale", "not-assessed");
                    ParseRequiredEnum(path, "diffFormat", "unified-text-metadata", "binary-metadata", "not-assessed");
                    if (path.TryGetProperty("patchDigest", out _)) ParseRequiredDigest(path, "patchDigest");
                    if (path.TryGetProperty("addedLineCount", out _)) ParseBoundedNonNegativeInt(path, "addedLineCount", 10_000_000);
                    if (path.TryGetProperty("removedLineCount", out _)) ParseBoundedNonNegativeInt(path, "removedLineCount", 10_000_000);
                    if (path.GetProperty("truncated").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) throw InvalidResponse();
                }
            }
            if (pathCount != values["previewPathCount"] || units.GetArrayLength() != values["previewUnitCount"]) throw InvalidResponse();
            candidate = new(id, revision, digest, ParseRequiredDigest(candidateElement, "dependencyReceiptDigest"), ParseRequiredDigest(candidateElement, "planReceiptDigest"), ParseRequiredDigest(candidateElement, "diffReceiptDigest"), ParseRequiredDigest(candidateElement, "traceReceiptDigest"), ParseRequiredDigest(candidateElement, "evidenceReceiptDigest"), ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"), units.GetArrayLength(), ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (inventoryReference is null) != (candidate is null) || (candidate is not null && candidate.ReviewState != reviewState) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        if (state == "candidate-previewed" && (candidate is null || reviewState != "ready-for-human-review" || reasons.Length != 0 || values["inventoryUnitCount"] != values["previewUnitCount"] || values["inventoryPathCount"] != values["previewPathCount"] || counts.Where(name => name is not ("inventoryUnitCount" or "inventoryPathCount" or "previewUnitCount" or "previewPathCount" or "candidatePreviewedCount")).Sum(name => values[name]) > 0)) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            values["inventoryUnitCount"], values["inventoryPathCount"], values["previewUnitCount"], values["previewPathCount"], values["candidatePreviewedCount"], values["gapCount"], values["conflictCount"], values["staleCount"], values["notAssessedCount"], values["orphanUnitCount"], values["orphanPathCount"], values["endpointGapCount"], values["diffGapCount"], values["traceGapCount"], values["evidenceGapCount"], values["staleBindingCount"], values["staleInventoryCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
