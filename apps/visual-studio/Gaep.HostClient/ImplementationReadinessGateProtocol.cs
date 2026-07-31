using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ImplementationReadinessProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-dependency-coverage-evidence-ownership-assessment-digests-only-not-readiness-rationales-evidence-content-review-content-owner-details-personal-data-secrets-credentials-or-machine-paths";
    private const string ImplementationReadinessProjectionAuthorityBoundary =
        "implementation-readiness-gate-projection-is-read-only-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority";
    private const string ImplementationReadinessStatusAuthorityBoundary =
        "implementation-readiness-gate-status-is-observational-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority";

    internal static ImplementationReadinessGateProjection ParseImplementationReadinessGateResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection, ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "implementation-readiness-gate-projection") != "implementation-readiness-gate-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ImplementationReadinessProjectionPrivacyBoundary) != ImplementationReadinessProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ImplementationReadinessProjectionAuthorityBoundary) != ImplementationReadinessProjectionAuthorityBoundary)
            throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();
        var product = projection.GetProperty("product");
        if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id"); var productRevision = ParsePositiveLong(product, "revision"); var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative");
        if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id");
        if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision"); var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");
        string[] counts = ["dependencyCount", "presentDependencyCount", "subjectCount", "satisfiedCount", "gapCount", "conflictCount", "staleCount", "waivedCandidateCount", "notAssessedCount", "evidenceGapCount", "ownershipGapCount", "coverageGapCount", "staleBindingCount", "staleDependencyCount", "invalidCandidateCount", "unresolvedQuestionCount"];
        string[] dependencies = ["backlogHierarchy", "mvpSliceDefinition", "prioritizationModel", "acceptanceCriteria", "definitionOfReady", "definitionOfDone", "implementationUnitModel", "dependencyMapping", "technologyProfile", "boilerplateRegistry", "boilerplateSelectionBinding", "boilerplateCompatibilityValidation", "designBaseline", "designToCodeBindingRegistry", "routeScreenComponentMapping", "testMethodology", "testInventory", "highLevelDesign", "riskRegister", "securityPrivacyAssessment"];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status, ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", "lowLevelDesigns", .. counts, "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", .. dependencies]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 || ParseRequiredEnum(status, "kind", "implementation-readiness-gate-status") != "implementation-readiness-gate-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision || ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ImplementationReadinessStatusAuthorityBoundary) != ImplementationReadinessStatusAuthorityBoundary) throw InvalidResponse();
        int Count(string name) => ParseBoundedNonNegativeInt(status, name, 65_536);
        var values = counts.ToDictionary(name => name, Count);
        if (values["presentDependencyCount"] > values["dependencyCount"] || values["satisfiedCount"] > values["subjectCount"]) throw InvalidResponse();
        var lowLevels = status.GetProperty("lowLevelDesigns");
        if (lowLevels.ValueKind != JsonValueKind.Array || lowLevels.GetArrayLength() > 65_536) throw InvalidResponse();
        foreach (var binding in lowLevels.EnumerateArray()) {
            if (!HasOnlyProperties(binding, "implementationUnitId", "reference")) throw InvalidResponse(); ParseRequiredGuid(binding, "implementationUnitId");
            var reference = binding.GetProperty("reference"); if (!HasOnlyProperties(reference, "recordId", "revision", "digest")) throw InvalidResponse(); ParseRequiredGuid(reference, "recordId"); ParsePositiveLong(reference, "revision"); ParseRequiredDigest(reference, "digest");
        }
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-assessed");
        var reasonsElement = status.GetProperty("reasons"); if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 2_048) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt"); var candidateReference = ParseBusinessReference(status, "candidate");
        ImplementationReadinessGateRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement)) {
            if (!HasOnlyProperties(candidateElement, "id", "revision", "digest", "state", "dependencyReceiptDigest", "coverageReceiptDigest", "evidenceReceiptDigest", "ownershipReceiptDigest", "assessmentReceiptDigest", "subjectCount", "reviewState", "updatedAt") || ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate") throw InvalidResponse();
            var id = ParseRequiredGuid(candidateElement, "id"); var revision = ParsePositiveLong(candidateElement, "revision"); var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new(id, revision, digest, ParseRequiredDigest(candidateElement, "dependencyReceiptDigest"), ParseRequiredDigest(candidateElement, "coverageReceiptDigest"), ParseRequiredDigest(candidateElement, "evidenceReceiptDigest"), ParseRequiredDigest(candidateElement, "ownershipReceiptDigest"), ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"), ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 65_536), ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review")); ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is not null && (candidate.SubjectCount != values["subjectCount"] || candidate.ReviewState != reviewState)) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        return new(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            values["dependencyCount"], values["presentDependencyCount"], values["subjectCount"], values["satisfiedCount"], values["gapCount"], values["conflictCount"], values["staleCount"], values["waivedCandidateCount"], values["notAssessedCount"], values["evidenceGapCount"], values["ownershipGapCount"], values["coverageGapCount"], values["staleBindingCount"], values["staleDependencyCount"], values["invalidCandidateCount"], values["unresolvedQuestionCount"], candidate, snapshotDigest);
    }
}
