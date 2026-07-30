using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DefinitionOfDoneProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths";
    private const string DefinitionOfDoneGateBoundary =
        "a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission";
    private const string DefinitionOfDoneProjectionAuthorityBoundary =
        "definition-of-done-projection-is-read-only-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority";
    private const string DefinitionOfDoneStatusAuthorityBoundary =
        "definition-of-done-status-is-observational-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority";

    internal static DefinitionOfDoneProjection ParseDefinitionOfDoneResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "gateBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "definition-of-done-projection") != "definition-of-done-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DefinitionOfDoneProjectionPrivacyBoundary) != DefinitionOfDoneProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "gateBoundary", DefinitionOfDoneGateBoundary) != DefinitionOfDoneGateBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DefinitionOfDoneProjectionAuthorityBoundary) != DefinitionOfDoneProjectionAuthorityBoundary)
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
                    "subjectCount", "policyEntryCount", "expectedEvaluationCount", "evaluationCount",
                    "candidateSatisfiedCount", "notSatisfiedCount", "notApplicableCount", "exceptionCandidateCount",
                    "notAssessedCount", "staleEvaluationCount", "invalidEvaluationCount", "missingEvaluationCount",
                    "staleBindingCount", "staleHierarchyCount", "staleMvpSliceDefinitionCount",
                    "stalePrioritizationModelCount", "staleAcceptanceCriteriaCount", "staleDefinitionOfReadyCount",
                    "expiredCount", "unresolvedQuestionCount", "reviewState", "result", "reasons", "assessedAt",
                    "gateBoundary", "authorityBoundary",
                ],
                ["candidate", "hierarchy", "mvpSliceDefinition", "prioritizationModel", "acceptanceCriteria", "definitionOfReady"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "definition-of-done-status") != "definition-of-done-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "gateBoundary", DefinitionOfDoneGateBoundary) != DefinitionOfDoneGateBoundary ||
            ParseRequiredEnum(status, "authorityBoundary", DefinitionOfDoneStatusAuthorityBoundary) != DefinitionOfDoneStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var hierarchyReference = ParseBusinessReference(status, "hierarchy");
        var mvpReference = ParseBusinessReference(status, "mvpSliceDefinition");
        var prioritizationReference = ParseBusinessReference(status, "prioritizationModel");
        var acceptanceCriteriaReference = ParseBusinessReference(status, "acceptanceCriteria");
        var definitionOfReadyReference = ParseBusinessReference(status, "definitionOfReady");
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 10_000);
        var policyEntryCount = ParseBoundedNonNegativeInt(status, "policyEntryCount", 1_024);
        var expectedEvaluationCount = ParseBoundedNonNegativeInt(status, "expectedEvaluationCount", 10_000_000);
        var evaluationCount = ParseBoundedNonNegativeInt(status, "evaluationCount", 100_000);
        var candidateSatisfiedCount = ParseBoundedNonNegativeInt(status, "candidateSatisfiedCount", 100_000);
        var notSatisfiedCount = ParseBoundedNonNegativeInt(status, "notSatisfiedCount", 100_000);
        var notApplicableCount = ParseBoundedNonNegativeInt(status, "notApplicableCount", 100_000);
        var exceptionCandidateCount = ParseBoundedNonNegativeInt(status, "exceptionCandidateCount", 100_000);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 100_000);
        var staleEvaluationCount = ParseBoundedNonNegativeInt(status, "staleEvaluationCount", 100_000);
        var invalidEvaluationCount = ParseBoundedNonNegativeInt(status, "invalidEvaluationCount", 100_000);
        var missingEvaluationCount = ParseBoundedNonNegativeInt(status, "missingEvaluationCount", 10_000_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleHierarchyCount = ParseBoundedNonNegativeInt(status, "staleHierarchyCount", 1);
        var staleMvpSliceDefinitionCount = ParseBoundedNonNegativeInt(status, "staleMvpSliceDefinitionCount", 1);
        var stalePrioritizationModelCount = ParseBoundedNonNegativeInt(status, "stalePrioritizationModelCount", 1);
        var staleAcceptanceCriteriaCount = ParseBoundedNonNegativeInt(status, "staleAcceptanceCriteriaCount", 1);
        var staleDefinitionOfReadyCount = ParseBoundedNonNegativeInt(status, "staleDefinitionOfReadyCount", 1);
        var expiredCount = ParseBoundedNonNegativeInt(status, "expiredCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (candidateSatisfiedCount + notSatisfiedCount + exceptionCandidateCount + notAssessedCount +
            staleEvaluationCount + invalidEvaluationCount != evaluationCount || notApplicableCount > candidateSatisfiedCount)
        {
            throw InvalidResponse();
        }
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var result = ParseRequiredEnum(status, "result", "attention-required", "candidate-passed");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = notSatisfiedCount + exceptionCandidateCount + notAssessedCount + staleEvaluationCount +
            invalidEvaluationCount + missingEvaluationCount + staleBindingCount + staleHierarchyCount +
            staleMvpSliceDefinitionCount + stalePrioritizationModelCount + staleAcceptanceCriteriaCount +
            staleDefinitionOfReadyCount + expiredCount + unresolvedQuestionCount;
        var allDependenciesPresent = hierarchyReference is not null && mvpReference is not null &&
            prioritizationReference is not null && acceptanceCriteriaReference is not null && definitionOfReadyReference is not null;
        if ((result == "candidate-passed" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null ||
                    !allDependenciesPresent || evaluationCount != expectedEvaluationCount)) ||
            (result == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DefinitionOfDoneRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "policyVersion", "validUntil", "subjectCatalogDigest",
                    "policyDigest", "evaluationDigest", "receiptDigest", "subjectCount", "policyEntryCount",
                    "evaluationCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DefinitionOfDoneRecordView(
                id, revision, digest, ParsePositiveLong(candidateElement, "policyVersion"),
                ParseRequiredTimestamp(candidateElement, "validUntil"),
                ParseRequiredDigest(candidateElement, "subjectCatalogDigest"),
                ParseRequiredDigest(candidateElement, "policyDigest"),
                ParseRequiredDigest(candidateElement, "evaluationDigest"),
                ParseRequiredDigest(candidateElement, "receiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "policyEntryCount", 1_024),
                ParseBoundedNonNegativeInt(candidateElement, "evaluationCount", 100_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.SubjectCount ?? 0) != subjectCount || (candidate?.PolicyEntryCount ?? 0) != policyEntryCount ||
            (candidate?.EvaluationCount ?? 0) != evaluationCount || (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DefinitionOfDoneProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, result, reviewState, Array.AsReadOnly(reasons),
            hierarchyReference?.Id, hierarchyReference?.Revision, hierarchyReference?.Digest,
            mvpReference?.Id, mvpReference?.Revision, mvpReference?.Digest,
            prioritizationReference?.Id, prioritizationReference?.Revision, prioritizationReference?.Digest,
            acceptanceCriteriaReference?.Id, acceptanceCriteriaReference?.Revision, acceptanceCriteriaReference?.Digest,
            definitionOfReadyReference?.Id, definitionOfReadyReference?.Revision, definitionOfReadyReference?.Digest,
            subjectCount, policyEntryCount, expectedEvaluationCount, evaluationCount, candidateSatisfiedCount,
            notSatisfiedCount, notApplicableCount, exceptionCandidateCount, notAssessedCount, staleEvaluationCount,
            invalidEvaluationCount, missingEvaluationCount, staleBindingCount, staleHierarchyCount,
            staleMvpSliceDefinitionCount, stalePrioritizationModelCount, staleAcceptanceCriteriaCount,
            staleDefinitionOfReadyCount, expiredCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
