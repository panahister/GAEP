using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ChangedUnitInventoryProjectionPrivacyBoundary =
        "projection-contains-record-identities-repository-relative-path-candidates-change-kinds-trace-counts-statuses-and-receipt-digests-only-not-file-content-evidence-content-owner-details-personal-data-secrets-credentials-or-machine-paths";
    private const string ChangedUnitInventoryProjectionAuthorityBoundary =
        "changed-unit-inventory-projection-is-read-only-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string ChangedUnitInventoryStatusAuthorityBoundary =
        "changed-unit-inventory-status-is-observational-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static ChangedUnitInventoryProjection ParseChangedUnitInventoryResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 || ParseRequiredEnum(projection, "kind", "changed-unit-inventory-projection") != "changed-unit-inventory-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ChangedUnitInventoryProjectionPrivacyBoundary) != ChangedUnitInventoryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ChangedUnitInventoryProjectionAuthorityBoundary) != ChangedUnitInventoryProjectionAuthorityBoundary) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product"); if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative"); if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id"); if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["dependencyCount", "presentDependencyCount", "sourceUnitCount", "inventoryUnitCount", "pathCandidateCount", "candidateScopedCount", "gapCount", "conflictCount", "staleCount", "notAssessedCount", "orphanUnitCount", "traceGapCount", "evidenceGapCount", "ownershipGapCount", "blastRadiusGapCount", "staleBindingCount", "staleDependencyCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        string[] dependencies = ["backlogHierarchy", "implementationUnitModel", "dependencyMapping", "designToCodeBindingRegistry", "routeScreenComponentMapping", "testInventory", "riskRegister", "implementationReadinessGate", "realisticExample"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", .. dependencies]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "changed-unit-inventory-status") != "changed-unit-inventory-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ChangedUnitInventoryStatusAuthorityBoundary) != ChangedUnitInventoryStatusAuthorityBoundary) throw InvalidResponse();
        int Count(string name) => ParseBoundedNonNegativeInt(status, name, 65_536);
        var values = counts.ToDictionary(name => name, Count);
        if (values["presentDependencyCount"] > values["dependencyCount"] || values["inventoryUnitCount"] > 65_536) throw InvalidResponse();
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-inventoried");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray(); if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate");
        ChangedUnitInventoryRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement)) {
            if (!HasOnlyProperties(candidateElement, "id", "revision", "digest", "state", "dependencyReceiptDigest", "inventoryReceiptDigest", "traceReceiptDigest", "blastRadiusReceiptDigest", "evidenceReceiptDigest", "ownershipReceiptDigest", "assessmentReceiptDigest", "reviewState", "updatedAt", "units") || ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(candidateElement, "id"); var revision = ParsePositiveLong(candidateElement, "revision"); var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            var units = candidateElement.GetProperty("units"); if (units.ValueKind != JsonValueKind.Array || units.GetArrayLength() > 65_536) throw InvalidResponse();
            foreach (var unit in units.EnumerateArray()) if (!HasOnlyProperties(unit, "implementationUnitId", "implementationUnitKey", "repositoryCandidate", "moduleCandidate", "outcome", "paths")) throw InvalidResponse();
            candidate = new(id, revision, digest, ParseRequiredDigest(candidateElement, "dependencyReceiptDigest"), ParseRequiredDigest(candidateElement, "inventoryReceiptDigest"), ParseRequiredDigest(candidateElement, "traceReceiptDigest"), ParseRequiredDigest(candidateElement, "blastRadiusReceiptDigest"), ParseRequiredDigest(candidateElement, "evidenceReceiptDigest"), ParseRequiredDigest(candidateElement, "ownershipReceiptDigest"), ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"), units.GetArrayLength(), ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is not null && candidate.ReviewState != reviewState) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            values["dependencyCount"], values["presentDependencyCount"], values["sourceUnitCount"], values["inventoryUnitCount"], values["pathCandidateCount"], values["candidateScopedCount"], values["gapCount"], values["conflictCount"], values["staleCount"], values["notAssessedCount"], values["orphanUnitCount"], values["traceGapCount"], values["evidenceGapCount"], values["ownershipGapCount"], values["blastRadiusGapCount"], values["staleBindingCount"], values["staleDependencyCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
