using System.Collections.ObjectModel;
using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignToCodeBindingRegistryProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-subject-target-trace-binding-assessment-snapshot-digests-only-not-figma-content-design-item-mapping-unit-requirement-repository-module-path-symbol-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths";
    private const string DesignToCodeBindingRegistryProjectionAuthorityBoundary =
        "design-to-code-binding-registry-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string DesignToCodeBindingRegistryStatusAuthorityBoundary =
        "design-to-code-binding-registry-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static DesignToCodeBindingRegistryProjection ParseDesignToCodeBindingRegistryResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-to-code-binding-registry-projection") != "design-to-code-binding-registry-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignToCodeBindingRegistryProjectionPrivacyBoundary) != DesignToCodeBindingRegistryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignToCodeBindingRegistryProjectionAuthorityBoundary) != DesignToCodeBindingRegistryProjectionAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var snapshotDigest = ParseRequiredDigest(projection, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(projection, "snapshotDigest"))) throw InvalidResponse();

        var product = projection.GetProperty("product");
        if (!HasOnlyProperties(product, "id", "revision", "digest")) throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "id");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        var initiative = projection.GetProperty("initiative");
        if (!HasOnlyProperties(initiative, "id", "revision", "digest", "state")) throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "id");
        if (initiativeId != expectedInitiativeId) throw InvalidResponse();
        var initiativeRevision = ParsePositiveLong(initiative, "revision");
        var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "proposed", "active", "blocked", "completed", "cancelled");

        string[] dependencyNames =
        [
            "designBaseline", "finalizedFigmaSnapshotImport", "designToRequirementBinding",
            "figmaToBoilerplateMapping", "implementationUnitModel", "technologyProfile",
            "boilerplateSelectionBinding", "boilerplateCompatibilityValidation",
        ];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "mappingSubjectCount", "subjectCount", "boundCandidateCount", "conflictCandidateCount",
                    "unboundCandidateCount", "notAssessedCount", "missingSubjectCount", "invalidSubjectCount",
                    "targetGapCount", "traceGapCount", "evidenceGapCount", "duplicateTargetCount",
                    "staleBindingCount", "staleDependencyCount", "invalidCandidateCount", "unresolvedQuestionCount",
                    "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", .. dependencyNames]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-to-code-binding-registry-status") != "design-to-code-binding-registry-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignToCodeBindingRegistryStatusAuthorityBoundary) != DesignToCodeBindingRegistryStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var candidateReference = ParseBusinessReference(status, "candidate");
        var dependencies = new Dictionary<string, DesignToCodeBindingRegistryReference>(StringComparer.Ordinal);
        foreach (var name in dependencyNames)
        {
            var reference = ParseBusinessReference(status, name);
            if (reference is not null)
                dependencies.Add(name, new DesignToCodeBindingRegistryReference(reference.Id, reference.Revision, reference.Digest));
        }
        var mappingSubjectCount = ParseBoundedNonNegativeInt(status, "mappingSubjectCount", 32_768);
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 32_768);
        var boundCandidateCount = ParseBoundedNonNegativeInt(status, "boundCandidateCount", 32_768);
        var conflictCandidateCount = ParseBoundedNonNegativeInt(status, "conflictCandidateCount", 32_768);
        var unboundCandidateCount = ParseBoundedNonNegativeInt(status, "unboundCandidateCount", 32_768);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 32_768);
        if ((long)boundCandidateCount + conflictCandidateCount + unboundCandidateCount + notAssessedCount != subjectCount)
            throw InvalidResponse();
        var missingSubjectCount = ParseBoundedNonNegativeInt(status, "missingSubjectCount", 32_768);
        var invalidSubjectCount = ParseBoundedNonNegativeInt(status, "invalidSubjectCount", 32_768);
        var targetGapCount = ParseBoundedNonNegativeInt(status, "targetGapCount", 32_768);
        var traceGapCount = ParseBoundedNonNegativeInt(status, "traceGapCount", 32_768);
        var evidenceGapCount = ParseBoundedNonNegativeInt(status, "evidenceGapCount", 32_768);
        var duplicateTargetCount = ParseBoundedNonNegativeInt(status, "duplicateTargetCount", 32_768);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleDependencyCount = ParseBoundedNonNegativeInt(status, "staleDependencyCount", 8);
        var invalidCandidateCount = ParseBoundedNonNegativeInt(status, "invalidCandidateCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)conflictCandidateCount + unboundCandidateCount + notAssessedCount + missingSubjectCount +
            invalidSubjectCount + targetGapCount + traceGapCount + evidenceGapCount + duplicateTargetCount +
            staleBindingCount + staleDependencyCount + invalidCandidateCount + unresolvedQuestionCount;
        if ((state == "candidate-complete" &&
                (gaps > 0 || candidateReference is null || dependencies.Count != dependencyNames.Length ||
                    subjectCount != mappingSubjectCount || boundCandidateCount != subjectCount ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignToCodeBindingRegistryRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "bindingSubjectCatalogDigest", "codeTargetCatalogDigest",
                    "traceReceiptDigest", "bindingReceiptDigest", "assessmentReceiptDigest", "subjectCount",
                    "boundCandidateCount", "conflictCandidateCount", "unboundCandidateCount", "notAssessedCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignToCodeBindingRegistryRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "bindingSubjectCatalogDigest"),
                ParseRequiredDigest(candidateElement, "codeTargetCatalogDigest"),
                ParseRequiredDigest(candidateElement, "traceReceiptDigest"),
                ParseRequiredDigest(candidateElement, "bindingReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "boundCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "conflictCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "unboundCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "notAssessedCount", 32_768),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is null) == (dependencies.Count == dependencyNames.Length) ||
            (candidate?.SubjectCount ?? 0) != subjectCount || (candidate?.BoundCandidateCount ?? 0) != boundCandidateCount ||
            (candidate?.ConflictCandidateCount ?? 0) != conflictCandidateCount ||
            (candidate?.UnboundCandidateCount ?? 0) != unboundCandidateCount ||
            (candidate?.NotAssessedCount ?? 0) != notAssessedCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignToCodeBindingRegistryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            new ReadOnlyDictionary<string, DesignToCodeBindingRegistryReference>(dependencies),
            mappingSubjectCount, subjectCount, boundCandidateCount, conflictCandidateCount, unboundCandidateCount,
            notAssessedCount, missingSubjectCount, invalidSubjectCount, targetGapCount, traceGapCount,
            evidenceGapCount, duplicateTargetCount, staleBindingCount, staleDependencyCount, invalidCandidateCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
