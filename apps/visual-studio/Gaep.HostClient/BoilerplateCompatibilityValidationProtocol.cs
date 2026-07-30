using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BoilerplateCompatibilityValidationProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-subject-dimension-evidence-validation-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-profile-entry-or-binding-identities-claims-evidence-assessors-personal-data-secrets-credentials-or-machine-paths";
    private const string BoilerplateCompatibilityValidationProjectionAuthorityBoundary =
        "boilerplate-compatibility-validation-projection-is-read-only-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string BoilerplateCompatibilityValidationStatusAuthorityBoundary =
        "boilerplate-compatibility-validation-status-is-observational-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static BoilerplateCompatibilityValidationProjection ParseBoilerplateCompatibilityValidationResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "boilerplate-compatibility-validation-projection") != "boilerplate-compatibility-validation-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", BoilerplateCompatibilityValidationProjectionPrivacyBoundary) != BoilerplateCompatibilityValidationProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", BoilerplateCompatibilityValidationProjectionAuthorityBoundary) != BoilerplateCompatibilityValidationProjectionAuthorityBoundary)
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

        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "selectedBindingCount", "subjectCount", "compatibleCandidateCount", "incompatibleCandidateCount",
                    "exceptionCandidateCount", "notAssessedCount", "dimensionAssessmentCount", "missingSubjectCount",
                    "invalidSubjectCount", "missingDimensionCount", "missingEvidenceCount", "expiredAssessmentCount",
                    "conflictingOutcomeCount", "selectionBindingGapCount", "staleBindingCount",
                    "staleImplementationUnitModelCount", "staleDependencyMappingCount", "staleTechnologyProfileCount",
                    "staleBoilerplateRegistryCount", "staleSelectionBindingCount", "invalidCandidateCount",
                    "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "implementationUnitModel", "dependencyMapping", "technologyProfile", "boilerplateRegistry", "boilerplateSelectionBinding"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "boilerplate-compatibility-validation-status") != "boilerplate-compatibility-validation-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", BoilerplateCompatibilityValidationStatusAuthorityBoundary) != BoilerplateCompatibilityValidationStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var implementationUnitModelReference = ParseBusinessReference(status, "implementationUnitModel");
        var dependencyMappingReference = ParseBusinessReference(status, "dependencyMapping");
        var technologyProfileReference = ParseBusinessReference(status, "technologyProfile");
        var boilerplateRegistryReference = ParseBusinessReference(status, "boilerplateRegistry");
        var boilerplateSelectionBindingReference = ParseBusinessReference(status, "boilerplateSelectionBinding");
        var selectedBindingCount = ParseBoundedNonNegativeInt(status, "selectedBindingCount", 10_000);
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 10_000);
        var compatibleCandidateCount = ParseBoundedNonNegativeInt(status, "compatibleCandidateCount", 10_000);
        var incompatibleCandidateCount = ParseBoundedNonNegativeInt(status, "incompatibleCandidateCount", 10_000);
        var exceptionCandidateCount = ParseBoundedNonNegativeInt(status, "exceptionCandidateCount", 10_000);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 10_000);
        if ((long)compatibleCandidateCount + incompatibleCandidateCount + exceptionCandidateCount + notAssessedCount != subjectCount)
            throw InvalidResponse();
        var dimensionAssessmentCount = ParseBoundedNonNegativeInt(status, "dimensionAssessmentCount", 140_000);
        var missingSubjectCount = ParseBoundedNonNegativeInt(status, "missingSubjectCount", 10_000);
        var invalidSubjectCount = ParseBoundedNonNegativeInt(status, "invalidSubjectCount", 10_000);
        var missingDimensionCount = ParseBoundedNonNegativeInt(status, "missingDimensionCount", 140_000);
        var missingEvidenceCount = ParseBoundedNonNegativeInt(status, "missingEvidenceCount", 140_000);
        var expiredAssessmentCount = ParseBoundedNonNegativeInt(status, "expiredAssessmentCount", 140_000);
        var conflictingOutcomeCount = ParseBoundedNonNegativeInt(status, "conflictingOutcomeCount", 10_000);
        var selectionBindingGapCount = ParseBoundedNonNegativeInt(status, "selectionBindingGapCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleImplementationUnitModelCount = ParseBoundedNonNegativeInt(status, "staleImplementationUnitModelCount", 1);
        var staleDependencyMappingCount = ParseBoundedNonNegativeInt(status, "staleDependencyMappingCount", 1);
        var staleTechnologyProfileCount = ParseBoundedNonNegativeInt(status, "staleTechnologyProfileCount", 1);
        var staleBoilerplateRegistryCount = ParseBoundedNonNegativeInt(status, "staleBoilerplateRegistryCount", 1);
        var staleSelectionBindingCount = ParseBoundedNonNegativeInt(status, "staleSelectionBindingCount", 1);
        var invalidCandidateCount = ParseBoundedNonNegativeInt(status, "invalidCandidateCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)missingSubjectCount + invalidSubjectCount + missingDimensionCount + missingEvidenceCount +
            expiredAssessmentCount + conflictingOutcomeCount + selectionBindingGapCount + notAssessedCount +
            staleBindingCount + staleImplementationUnitModelCount + staleDependencyMappingCount +
            staleTechnologyProfileCount + staleBoilerplateRegistryCount + staleSelectionBindingCount +
            invalidCandidateCount + unresolvedQuestionCount;
        var allDependenciesPresent = implementationUnitModelReference is not null && dependencyMappingReference is not null &&
            technologyProfileReference is not null && boilerplateRegistryReference is not null &&
            boilerplateSelectionBindingReference is not null;
        if ((state == "candidate-complete" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null ||
                    !allDependenciesPresent || subjectCount != selectedBindingCount ||
                    dimensionAssessmentCount != subjectCount * 14L)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        BoilerplateCompatibilityValidationRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "validationSubjectCatalogDigest", "dimensionCatalogDigest",
                    "evidenceReceiptDigest", "validationReceiptDigest", "assessmentReceiptDigest", "subjectCount",
                    "compatibleCandidateCount", "incompatibleCandidateCount", "exceptionCandidateCount", "notAssessedCount",
                    "dimensionAssessmentCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new BoilerplateCompatibilityValidationRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "validationSubjectCatalogDigest"),
                ParseRequiredDigest(candidateElement, "dimensionCatalogDigest"),
                ParseRequiredDigest(candidateElement, "evidenceReceiptDigest"),
                ParseRequiredDigest(candidateElement, "validationReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "compatibleCandidateCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "incompatibleCandidateCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "exceptionCandidateCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "notAssessedCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "dimensionAssessmentCount", 140_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.SubjectCount ?? 0) != subjectCount ||
            (candidate?.CompatibleCandidateCount ?? 0) != compatibleCandidateCount ||
            (candidate?.IncompatibleCandidateCount ?? 0) != incompatibleCandidateCount ||
            (candidate?.ExceptionCandidateCount ?? 0) != exceptionCandidateCount ||
            (candidate?.NotAssessedCount ?? 0) != notAssessedCount ||
            (candidate?.DimensionAssessmentCount ?? 0) != dimensionAssessmentCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BoilerplateCompatibilityValidationProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            implementationUnitModelReference?.Id, implementationUnitModelReference?.Revision, implementationUnitModelReference?.Digest,
            dependencyMappingReference?.Id, dependencyMappingReference?.Revision, dependencyMappingReference?.Digest,
            technologyProfileReference?.Id, technologyProfileReference?.Revision, technologyProfileReference?.Digest,
            boilerplateRegistryReference?.Id, boilerplateRegistryReference?.Revision, boilerplateRegistryReference?.Digest,
            boilerplateSelectionBindingReference?.Id, boilerplateSelectionBindingReference?.Revision, boilerplateSelectionBindingReference?.Digest,
            selectedBindingCount, subjectCount, compatibleCandidateCount, incompatibleCandidateCount,
            exceptionCandidateCount, notAssessedCount, dimensionAssessmentCount, missingSubjectCount, invalidSubjectCount,
            missingDimensionCount, missingEvidenceCount, expiredAssessmentCount, conflictingOutcomeCount,
            selectionBindingGapCount, staleBindingCount, staleImplementationUnitModelCount, staleDependencyMappingCount,
            staleTechnologyProfileCount, staleBoilerplateRegistryCount, staleSelectionBindingCount,
            invalidCandidateCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
