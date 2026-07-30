using System.Collections.ObjectModel;
using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string FigmaToBoilerplateMappingProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-subject-target-trace-mapping-assessment-snapshot-digests-only-not-figma-content-design-item-binding-unit-profile-registry-entry-validation-subject-requirement-target-locator-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths";
    private const string FigmaToBoilerplateMappingProjectionAuthorityBoundary =
        "figma-to-boilerplate-mapping-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string FigmaToBoilerplateMappingStatusAuthorityBoundary =
        "figma-to-boilerplate-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static FigmaToBoilerplateMappingProjection ParseFigmaToBoilerplateMappingResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "figma-to-boilerplate-mapping-projection") != "figma-to-boilerplate-mapping-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", FigmaToBoilerplateMappingProjectionPrivacyBoundary) != FigmaToBoilerplateMappingProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", FigmaToBoilerplateMappingProjectionAuthorityBoundary) != FigmaToBoilerplateMappingProjectionAuthorityBoundary)
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
            "designApplicability", "designSystemTokenContract", "responsiveMultiPlatformTargets",
            "finalizedFigmaSnapshotImport", "designToRequirementBinding", "designBaseline",
            "implementationUnitModel", "technologyProfile", "boilerplateRegistry",
            "boilerplateSelectionBinding", "boilerplateCompatibilityValidation",
        ];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "designBindingCount", "subjectCount", "mappedCandidateCount", "conflictCandidateCount",
                    "unmappedCandidateCount", "notAssessedCount", "componentMappingCount", "tokenMappingCount",
                    "layoutMappingCount", "responsiveBehaviorMappingCount", "platformTargetMappingCount",
                    "missingSubjectCount", "invalidSubjectCount", "targetGapCount", "traceGapCount", "evidenceGapCount",
                    "staleBindingCount", "staleDependencyCount", "invalidCandidateCount", "unresolvedQuestionCount",
                    "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", .. dependencyNames]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "figma-to-boilerplate-mapping-status") != "figma-to-boilerplate-mapping-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", FigmaToBoilerplateMappingStatusAuthorityBoundary) != FigmaToBoilerplateMappingStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var candidateReference = ParseBusinessReference(status, "candidate");
        var dependencies = new Dictionary<string, FigmaToBoilerplateMappingReference>(StringComparer.Ordinal);
        foreach (var name in dependencyNames)
        {
            var reference = ParseBusinessReference(status, name);
            if (reference is not null)
                dependencies.Add(name, new FigmaToBoilerplateMappingReference(reference.Id, reference.Revision, reference.Digest));
        }
        var designBindingCount = ParseBoundedNonNegativeInt(status, "designBindingCount", 32_768);
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 32_768);
        var mappedCandidateCount = ParseBoundedNonNegativeInt(status, "mappedCandidateCount", 32_768);
        var conflictCandidateCount = ParseBoundedNonNegativeInt(status, "conflictCandidateCount", 32_768);
        var unmappedCandidateCount = ParseBoundedNonNegativeInt(status, "unmappedCandidateCount", 32_768);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 32_768);
        if ((long)mappedCandidateCount + conflictCandidateCount + unmappedCandidateCount + notAssessedCount != subjectCount)
            throw InvalidResponse();
        var componentMappingCount = ParseBoundedNonNegativeInt(status, "componentMappingCount", 32_768);
        var tokenMappingCount = ParseBoundedNonNegativeInt(status, "tokenMappingCount", 32_768);
        var layoutMappingCount = ParseBoundedNonNegativeInt(status, "layoutMappingCount", 32_768);
        var responsiveBehaviorMappingCount = ParseBoundedNonNegativeInt(status, "responsiveBehaviorMappingCount", 32_768);
        var platformTargetMappingCount = ParseBoundedNonNegativeInt(status, "platformTargetMappingCount", 32_768);
        if ((long)componentMappingCount + tokenMappingCount + layoutMappingCount + responsiveBehaviorMappingCount +
            platformTargetMappingCount != subjectCount) throw InvalidResponse();
        var missingSubjectCount = ParseBoundedNonNegativeInt(status, "missingSubjectCount", 32_768);
        var invalidSubjectCount = ParseBoundedNonNegativeInt(status, "invalidSubjectCount", 32_768);
        var targetGapCount = ParseBoundedNonNegativeInt(status, "targetGapCount", 32_768);
        var traceGapCount = ParseBoundedNonNegativeInt(status, "traceGapCount", 32_768);
        var evidenceGapCount = ParseBoundedNonNegativeInt(status, "evidenceGapCount", 32_768);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleDependencyCount = ParseBoundedNonNegativeInt(status, "staleDependencyCount", 11);
        var invalidCandidateCount = ParseBoundedNonNegativeInt(status, "invalidCandidateCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)conflictCandidateCount + unmappedCandidateCount + notAssessedCount + missingSubjectCount +
            invalidSubjectCount + targetGapCount + traceGapCount + evidenceGapCount + staleBindingCount +
            staleDependencyCount + invalidCandidateCount + unresolvedQuestionCount;
        if ((state == "candidate-complete" &&
                (gaps > 0 || candidateReference is null || dependencies.Count != dependencyNames.Length ||
                    subjectCount != designBindingCount || mappedCandidateCount != subjectCount ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        FigmaToBoilerplateMappingRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "mappingSubjectCatalogDigest", "targetCatalogDigest",
                    "traceReceiptDigest", "mappingReceiptDigest", "assessmentReceiptDigest", "subjectCount",
                    "mappedCandidateCount", "conflictCandidateCount", "unmappedCandidateCount", "notAssessedCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new FigmaToBoilerplateMappingRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "mappingSubjectCatalogDigest"),
                ParseRequiredDigest(candidateElement, "targetCatalogDigest"),
                ParseRequiredDigest(candidateElement, "traceReceiptDigest"),
                ParseRequiredDigest(candidateElement, "mappingReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "mappedCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "conflictCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "unmappedCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "notAssessedCount", 32_768),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is null) == (dependencies.Count == dependencyNames.Length) ||
            (candidate?.SubjectCount ?? 0) != subjectCount || (candidate?.MappedCandidateCount ?? 0) != mappedCandidateCount ||
            (candidate?.ConflictCandidateCount ?? 0) != conflictCandidateCount ||
            (candidate?.UnmappedCandidateCount ?? 0) != unmappedCandidateCount ||
            (candidate?.NotAssessedCount ?? 0) != notAssessedCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new FigmaToBoilerplateMappingProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            new ReadOnlyDictionary<string, FigmaToBoilerplateMappingReference>(dependencies),
            designBindingCount, subjectCount, mappedCandidateCount, conflictCandidateCount, unmappedCandidateCount,
            notAssessedCount, componentMappingCount, tokenMappingCount, layoutMappingCount,
            responsiveBehaviorMappingCount, platformTargetMappingCount, missingSubjectCount, invalidSubjectCount,
            targetGapCount, traceGapCount, evidenceGapCount, staleBindingCount, staleDependencyCount,
            invalidCandidateCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
