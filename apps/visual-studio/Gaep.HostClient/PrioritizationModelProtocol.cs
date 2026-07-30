using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string PrioritizationModelProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-method-membership-ranking-and-snapshot-digests-only-not-dimension-estimates-evidence-identities-uncertainty-slice-content-personal-data-secrets-credentials-or-machine-paths";
    private const string PrioritizationModelProjectionAuthorityBoundary =
        "prioritization-model-projection-is-read-only-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority";
    private const string PrioritizationModelStatusAuthorityBoundary =
        "prioritization-model-status-is-observational-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority";

    internal static PrioritizationModelProjection ParsePrioritizationModelResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "prioritization-model-projection") != "prioritization-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", PrioritizationModelProjectionPrivacyBoundary) != PrioritizationModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", PrioritizationModelProjectionAuthorityBoundary) != PrioritizationModelProjectionAuthorityBoundary)
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
                    "subjectCount", "scoredSubjectCount", "unassessedSubjectCount", "evidenceReferenceCount", "tieCount",
                    "staleBindingCount", "staleMvpSliceDefinitionCount", "invalidSubjectCount", "invalidScoreCount",
                    "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "mvpSliceDefinition"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "prioritization-model-status") != "prioritization-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", PrioritizationModelStatusAuthorityBoundary) != PrioritizationModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var mvpReference = ParseBusinessReference(status, "mvpSliceDefinition");
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 10_000);
        var scoredSubjectCount = ParseBoundedNonNegativeInt(status, "scoredSubjectCount", 10_000);
        var unassessedSubjectCount = ParseBoundedNonNegativeInt(status, "unassessedSubjectCount", 10_000);
        var evidenceReferenceCount = ParseBoundedNonNegativeInt(status, "evidenceReferenceCount", 10_000_000);
        var tieCount = ParseBoundedNonNegativeInt(status, "tieCount", 10_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleMvpSliceDefinitionCount = ParseBoundedNonNegativeInt(status, "staleMvpSliceDefinitionCount", 1);
        var invalidSubjectCount = ParseBoundedNonNegativeInt(status, "invalidSubjectCount", 10_000);
        var invalidScoreCount = ParseBoundedNonNegativeInt(status, "invalidScoreCount", 10_000);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (subjectCount != scoredSubjectCount + unassessedSubjectCount) throw InvalidResponse();
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = unassessedSubjectCount + staleBindingCount + staleMvpSliceDefinitionCount + invalidSubjectCount +
            invalidScoreCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 ||
                    reference is null || mvpReference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        PrioritizationModelRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "methodDigest", "rankingDigest", "state",
                    "subjectCount", "scoredSubjectCount", "evidenceReferenceCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new PrioritizationModelRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseRequiredDigest(candidateElement, "methodDigest"), ParseRequiredDigest(candidateElement, "rankingDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "scoredSubjectCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "evidenceReferenceCount", 10_000_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) != (mvpReference is null) ||
            (candidate?.SubjectCount ?? 0) != subjectCount || (candidate?.ScoredSubjectCount ?? 0) != scoredSubjectCount ||
            (candidate?.EvidenceReferenceCount ?? 0) != evidenceReferenceCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new PrioritizationModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, Array.AsReadOnly(reasons),
            mvpReference?.Id, mvpReference?.Revision, mvpReference?.Digest,
            subjectCount, scoredSubjectCount, unassessedSubjectCount, evidenceReferenceCount, tieCount,
            staleBindingCount, staleMvpSliceDefinitionCount, invalidSubjectCount, invalidScoreCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
