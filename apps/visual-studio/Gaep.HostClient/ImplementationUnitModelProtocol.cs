using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ImplementationUnitModelProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-membership-placement-assessment-snapshot-digests-only-not-unit-titles-boundaries-subject-or-requirement-identities-repository-keys-module-paths-owner-identities-evidence-rationales-personal-data-secrets-credentials-or-machine-paths";
    private const string ImplementationUnitModelProjectionAuthorityBoundary =
        "implementation-unit-model-projection-is-read-only-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority";
    private const string ImplementationUnitModelStatusAuthorityBoundary =
        "implementation-unit-model-status-is-observational-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority";

    internal static ImplementationUnitModelProjection ParseImplementationUnitModelResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "implementation-unit-model-projection") != "implementation-unit-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ImplementationUnitModelProjectionPrivacyBoundary) != ImplementationUnitModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ImplementationUnitModelProjectionAuthorityBoundary) != ImplementationUnitModelProjectionAuthorityBoundary)
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
                    "unitCount", "subjectCount", "requirementReferenceCount", "repositoryCandidateCount",
                    "ownerCandidateCount", "dependencyEdgeCount", "candidateAssessedBlastRadiusCount",
                    "notAssessedBlastRadiusCount", "missingSubjectCount", "invalidUnitCount", "staleBindingCount",
                    "staleHierarchyCount", "staleMvpSliceDefinitionCount", "staleAcceptanceCriteriaCount",
                    "staleDefinitionOfReadyCount", "staleDefinitionOfDoneCount", "unresolvedQuestionCount",
                    "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "hierarchy", "mvpSliceDefinition", "acceptanceCriteria", "definitionOfReady", "definitionOfDone"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "implementation-unit-model-status") != "implementation-unit-model-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ImplementationUnitModelStatusAuthorityBoundary) != ImplementationUnitModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var hierarchyReference = ParseBusinessReference(status, "hierarchy");
        var mvpReference = ParseBusinessReference(status, "mvpSliceDefinition");
        var acceptanceCriteriaReference = ParseBusinessReference(status, "acceptanceCriteria");
        var definitionOfReadyReference = ParseBusinessReference(status, "definitionOfReady");
        var definitionOfDoneReference = ParseBusinessReference(status, "definitionOfDone");
        var unitCount = ParseBoundedNonNegativeInt(status, "unitCount", 10_000);
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 10_000);
        var requirementReferenceCount = ParseBoundedNonNegativeInt(status, "requirementReferenceCount", 1_000_000);
        var repositoryCandidateCount = ParseBoundedNonNegativeInt(status, "repositoryCandidateCount", 10_000);
        var ownerCandidateCount = ParseBoundedNonNegativeInt(status, "ownerCandidateCount", 10_000);
        var dependencyEdgeCount = ParseBoundedNonNegativeInt(status, "dependencyEdgeCount", 1_000_000);
        var candidateAssessedBlastRadiusCount = ParseBoundedNonNegativeInt(status, "candidateAssessedBlastRadiusCount", 10_000);
        var notAssessedBlastRadiusCount = ParseBoundedNonNegativeInt(status, "notAssessedBlastRadiusCount", 10_000);
        var missingSubjectCount = ParseBoundedNonNegativeInt(status, "missingSubjectCount", 10_000);
        var invalidUnitCount = ParseBoundedNonNegativeInt(status, "invalidUnitCount", 10_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleHierarchyCount = ParseBoundedNonNegativeInt(status, "staleHierarchyCount", 1);
        var staleMvpSliceDefinitionCount = ParseBoundedNonNegativeInt(status, "staleMvpSliceDefinitionCount", 1);
        var staleAcceptanceCriteriaCount = ParseBoundedNonNegativeInt(status, "staleAcceptanceCriteriaCount", 1);
        var staleDefinitionOfReadyCount = ParseBoundedNonNegativeInt(status, "staleDefinitionOfReadyCount", 1);
        var staleDefinitionOfDoneCount = ParseBoundedNonNegativeInt(status, "staleDefinitionOfDoneCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (candidateAssessedBlastRadiusCount + notAssessedBlastRadiusCount != unitCount ||
            repositoryCandidateCount > unitCount || ownerCandidateCount > unitCount)
        {
            throw InvalidResponse();
        }
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = missingSubjectCount + invalidUnitCount + notAssessedBlastRadiusCount + staleBindingCount +
            staleHierarchyCount + staleMvpSliceDefinitionCount + staleAcceptanceCriteriaCount +
            staleDefinitionOfReadyCount + staleDefinitionOfDoneCount + unresolvedQuestionCount;
        var allDependenciesPresent = hierarchyReference is not null && mvpReference is not null &&
            acceptanceCriteriaReference is not null && definitionOfReadyReference is not null && definitionOfDoneReference is not null;
        if ((state == "candidate-complete" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null || !allDependenciesPresent)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        ImplementationUnitModelRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "membershipDigest", "placementDigest",
                    "assessmentReceiptDigest", "unitCount", "subjectCount", "requirementReferenceCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new ImplementationUnitModelRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseRequiredDigest(candidateElement, "placementDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "unitCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "requirementReferenceCount", 1_000_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.UnitCount ?? 0) != unitCount || (candidate?.SubjectCount ?? 0) != subjectCount ||
            (candidate?.RequirementReferenceCount ?? 0) != requirementReferenceCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ImplementationUnitModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            hierarchyReference?.Id, hierarchyReference?.Revision, hierarchyReference?.Digest,
            mvpReference?.Id, mvpReference?.Revision, mvpReference?.Digest,
            acceptanceCriteriaReference?.Id, acceptanceCriteriaReference?.Revision, acceptanceCriteriaReference?.Digest,
            definitionOfReadyReference?.Id, definitionOfReadyReference?.Revision, definitionOfReadyReference?.Digest,
            definitionOfDoneReference?.Id, definitionOfDoneReference?.Revision, definitionOfDoneReference?.Digest,
            unitCount, subjectCount, requirementReferenceCount, repositoryCandidateCount, ownerCandidateCount,
            dependencyEdgeCount, candidateAssessedBlastRadiusCount, notAssessedBlastRadiusCount,
            missingSubjectCount, invalidUnitCount, staleBindingCount, staleHierarchyCount,
            staleMvpSliceDefinitionCount, staleAcceptanceCriteriaCount, staleDefinitionOfReadyCount,
            staleDefinitionOfDoneCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
