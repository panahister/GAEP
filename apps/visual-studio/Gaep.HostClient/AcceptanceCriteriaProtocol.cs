using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string AcceptanceCriteriaProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-subject-criterion-method-coverage-snapshot-digests-only-not-criterion-text-requirement-identities-verification-evidence-personal-data-secrets-credentials-or-machine-paths";
    private const string AcceptanceCriteriaProjectionAuthorityBoundary =
        "acceptance-criteria-projection-is-read-only-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority";
    private const string AcceptanceCriteriaStatusAuthorityBoundary =
        "acceptance-criteria-status-is-observational-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority";

    internal static AcceptanceCriteriaProjection ParseAcceptanceCriteriaResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "acceptance-criteria-projection") != "acceptance-criteria-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", AcceptanceCriteriaProjectionPrivacyBoundary) != AcceptanceCriteriaProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", AcceptanceCriteriaProjectionAuthorityBoundary) != AcceptanceCriteriaProjectionAuthorityBoundary)
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
                    "subjectCount", "coveredSubjectCount", "uncoveredSubjectCount", "criterionCount",
                    "testableCriterionCount", "unassessedCriterionCount", "requirementTraceCount",
                    "uncoveredRequirementCount", "verificationMethodCount", "staleBindingCount", "staleHierarchyCount",
                    "staleMvpSliceDefinitionCount", "stalePrioritizationModelCount", "invalidCriterionCount",
                    "unresolvedQuestionCount", "criterionSetCompletenessState", "requirementCoverageState",
                    "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "hierarchy", "mvpSliceDefinition", "prioritizationModel"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "acceptance-criteria-status") != "acceptance-criteria-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", AcceptanceCriteriaStatusAuthorityBoundary) != AcceptanceCriteriaStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var hierarchyReference = ParseBusinessReference(status, "hierarchy");
        var mvpReference = ParseBusinessReference(status, "mvpSliceDefinition");
        var prioritizationReference = ParseBusinessReference(status, "prioritizationModel");
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 10_000);
        var coveredSubjectCount = ParseBoundedNonNegativeInt(status, "coveredSubjectCount", 10_000);
        var uncoveredSubjectCount = ParseBoundedNonNegativeInt(status, "uncoveredSubjectCount", 10_000);
        var criterionCount = ParseBoundedNonNegativeInt(status, "criterionCount", 100_000);
        var testableCriterionCount = ParseBoundedNonNegativeInt(status, "testableCriterionCount", 100_000);
        var unassessedCriterionCount = ParseBoundedNonNegativeInt(status, "unassessedCriterionCount", 100_000);
        var requirementTraceCount = ParseBoundedNonNegativeInt(status, "requirementTraceCount", 1_000_000);
        var uncoveredRequirementCount = ParseBoundedNonNegativeInt(status, "uncoveredRequirementCount", 1_000_000);
        var verificationMethodCount = ParseBoundedNonNegativeInt(status, "verificationMethodCount", 1_024);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleHierarchyCount = ParseBoundedNonNegativeInt(status, "staleHierarchyCount", 1);
        var staleMvpSliceDefinitionCount = ParseBoundedNonNegativeInt(status, "staleMvpSliceDefinitionCount", 1);
        var stalePrioritizationModelCount = ParseBoundedNonNegativeInt(status, "stalePrioritizationModelCount", 1);
        var invalidCriterionCount = ParseBoundedNonNegativeInt(status, "invalidCriterionCount", 100_000);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (subjectCount != coveredSubjectCount + uncoveredSubjectCount ||
            criterionCount != testableCriterionCount + unassessedCriterionCount)
        {
            throw InvalidResponse();
        }
        var criterionSetCompletenessState = ParseRequiredEnum(status, "criterionSetCompletenessState", "candidate-complete", "not-assessed");
        var requirementCoverageState = ParseRequiredEnum(status, "requirementCoverageState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = uncoveredSubjectCount + uncoveredRequirementCount + staleBindingCount + staleHierarchyCount +
            staleMvpSliceDefinitionCount + stalePrioritizationModelCount + invalidCriterionCount +
            unassessedCriterionCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 ||
                    criterionSetCompletenessState != "candidate-complete" || requirementCoverageState != "candidate-complete" ||
                    reference is null || hierarchyReference is null || mvpReference is null || prioritizationReference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        AcceptanceCriteriaRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "subjectCatalogDigest", "criterionCatalogDigest",
                    "verificationMethodCatalogDigest", "coverageDigest", "subjectCount", "criterionCount",
                    "testableCriterionCount", "requirementTraceCount", "verificationMethodCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new AcceptanceCriteriaRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "subjectCatalogDigest"),
                ParseRequiredDigest(candidateElement, "criterionCatalogDigest"),
                ParseRequiredDigest(candidateElement, "verificationMethodCatalogDigest"),
                ParseRequiredDigest(candidateElement, "coverageDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "criterionCount", 100_000),
                ParseBoundedNonNegativeInt(candidateElement, "testableCriterionCount", 100_000),
                ParseBoundedNonNegativeInt(candidateElement, "requirementTraceCount", 1_000_000),
                ParseBoundedNonNegativeInt(candidateElement, "verificationMethodCount", 1_024),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        var allDependenciesPresent = hierarchyReference is not null && mvpReference is not null && prioritizationReference is not null;
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.SubjectCount ?? 0) != subjectCount || (candidate?.CriterionCount ?? 0) != criterionCount ||
            (candidate?.TestableCriterionCount ?? 0) != testableCriterionCount ||
            (candidate?.RequirementTraceCount ?? 0) != requirementTraceCount ||
            (candidate?.VerificationMethodCount ?? 0) != verificationMethodCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new AcceptanceCriteriaProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, criterionSetCompletenessState, requirementCoverageState,
            Array.AsReadOnly(reasons),
            hierarchyReference?.Id, hierarchyReference?.Revision, hierarchyReference?.Digest,
            mvpReference?.Id, mvpReference?.Revision, mvpReference?.Digest,
            prioritizationReference?.Id, prioritizationReference?.Revision, prioritizationReference?.Digest,
            subjectCount, coveredSubjectCount, uncoveredSubjectCount, criterionCount, testableCriterionCount,
            unassessedCriterionCount, requirementTraceCount, uncoveredRequirementCount, verificationMethodCount,
            staleBindingCount, staleHierarchyCount, staleMvpSliceDefinitionCount, stalePrioritizationModelCount,
            invalidCriterionCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
