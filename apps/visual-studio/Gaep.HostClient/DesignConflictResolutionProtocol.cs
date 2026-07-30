using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignConflictResolutionProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string DesignConflictResolutionProjectionAuthorityBoundary =
        "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority";
    private const string DesignConflictResolutionStatusAuthorityBoundary =
        "design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority";

    internal static DesignConflictResolutionProjection ParseDesignConflictResolutionResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-conflict-resolution-projection") != "design-conflict-resolution-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignConflictResolutionProjectionPrivacyBoundary) != DesignConflictResolutionProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignConflictResolutionProjectionAuthorityBoundary) != DesignConflictResolutionProjectionAuthorityBoundary)
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
                    "conflictCount", "resolutionCount", "acceptSourceCount", "acceptTargetCount", "mergeCount",
                    "rejectChangeCount", "escalateCount", "humanReviewedCount", "distinctActorDeclaredCount",
                    "expiredCandidateCount", "unresolvedConflictCount", "unresolvedQuestionCount", "staleBindingCount",
                    "staleSourceReferenceCount", "coverageState", "provenanceState", "candidateResult", "reviewState",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-conflict-resolution-status") != "design-conflict-resolution-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignConflictResolutionStatusAuthorityBoundary) != DesignConflictResolutionStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var conflictCount = ParseBoundedNonNegativeInt(status, "conflictCount", 65_536);
        var resolutionCount = ParseBoundedNonNegativeInt(status, "resolutionCount", 65_536);
        var acceptSourceCount = ParseBoundedNonNegativeInt(status, "acceptSourceCount", 65_536);
        var acceptTargetCount = ParseBoundedNonNegativeInt(status, "acceptTargetCount", 65_536);
        var mergeCount = ParseBoundedNonNegativeInt(status, "mergeCount", 65_536);
        var rejectChangeCount = ParseBoundedNonNegativeInt(status, "rejectChangeCount", 65_536);
        var escalateCount = ParseBoundedNonNegativeInt(status, "escalateCount", 65_536);
        var humanReviewedCount = ParseBoundedNonNegativeInt(status, "humanReviewedCount", 65_536);
        var distinctActorDeclaredCount = ParseBoundedNonNegativeInt(status, "distinctActorDeclaredCount", 65_536);
        var expiredCandidateCount = ParseBoundedNonNegativeInt(status, "expiredCandidateCount", 65_536);
        var unresolvedConflictCount = ParseBoundedNonNegativeInt(status, "unresolvedConflictCount", 65_536);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        if (acceptSourceCount + acceptTargetCount + mergeCount + rejectChangeCount + escalateCount != resolutionCount ||
            humanReviewedCount > resolutionCount || distinctActorDeclaredCount > humanReviewedCount ||
            resolutionCount + unresolvedConflictCount > conflictCount)
        {
            throw InvalidResponse();
        }
        var coverageState = ParseRequiredEnum(status, "coverageState", "candidate-complete", "not-assessed", "partial");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "not-assessed", "partial");
        var candidateResult = ParseRequiredEnum(
            status,
            "candidateResult",
            "blocked", "conflict-plan-candidate", "escalation-plan-candidate", "incomplete", "no-conflict-candidate", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = expiredCandidateCount + unresolvedConflictCount + unresolvedQuestionCount +
            staleBindingCount + staleSourceReferenceCount;
        if ((assessmentState == "complete-for-review" &&
                (reference is null || reasons.Length > 0 || coverageState != "candidate-complete" || provenanceState != "exact" ||
                    gapCount > 0 || humanReviewedCount != resolutionCount || reviewState != "ready-for-human-review" ||
                    candidateResult is "blocked" or "incomplete" or "not-assessed")) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        static DesignConflictResolutionDeltaBindingView ParseDeltaBinding(JsonElement value)
        {
            if (!HasOnlyProperties(
                    value,
                    "recordId", "revision", "digest", "membershipDigest", "deltaCatalogDigest",
                    "comparisonReceiptDigest", "conflictingCount", "candidateResult", "reviewState"))
            {
                throw InvalidResponse();
            }
            return new DesignConflictResolutionDeltaBindingView(
                ParseRequiredGuid(value, "recordId"),
                ParsePositiveLong(value, "revision"),
                ParseRequiredDigest(value, "digest"),
                ParseRequiredDigest(value, "membershipDigest"),
                ParseRequiredDigest(value, "deltaCatalogDigest"),
                ParseRequiredDigest(value, "comparisonReceiptDigest"),
                ParseBoundedNonNegativeInt(value, "conflictingCount", 65_536),
                ParseRequiredEnum(value, "candidateResult", "blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate"),
                ParseRequiredEnum(value, "reviewState", "draft", "held", "ready-for-human-review"));
        }

        DesignConflictResolutionRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "designDelta",
                    "resolutionDefinitionDigest", "resolutionReceiptDigest", "resolutionCatalogDigest", "conflictCount",
                    "resolutionCount", "coverageState", "provenanceState", "candidateResult", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignConflictResolutionRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseDeltaBinding(candidateElement.GetProperty("designDelta")),
                ParseRequiredDigest(candidateElement, "resolutionDefinitionDigest"),
                ParseRequiredDigest(candidateElement, "resolutionReceiptDigest"),
                ParseRequiredDigest(candidateElement, "resolutionCatalogDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "conflictCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "resolutionCount", 65_536),
                ParseRequiredEnum(candidateElement, "coverageState", "candidate-complete", "not-assessed", "partial"),
                ParseRequiredEnum(candidateElement, "provenanceState", "exact", "not-assessed", "partial"),
                ParseRequiredEnum(candidateElement, "candidateResult", "blocked", "conflict-plan-candidate", "escalation-plan-candidate", "incomplete", "no-conflict-candidate"),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate is not null &&
                (candidate.ConflictCount != conflictCount || candidate.ResolutionCount != resolutionCount ||
                    candidate.CoverageState != coverageState || candidate.ProvenanceState != provenanceState ||
                    candidate.CandidateResult != candidateResult || candidate.ReviewState != reviewState ||
                    candidate.DesignDelta.ConflictingCount != conflictCount)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignConflictResolutionProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, candidateResult, reviewState, assessmentState, coverageState, provenanceState,
            Array.AsReadOnly(reasons), conflictCount, resolutionCount, acceptSourceCount, acceptTargetCount,
            mergeCount, rejectChangeCount, escalateCount, humanReviewedCount, distinctActorDeclaredCount,
            expiredCandidateCount, unresolvedConflictCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, candidate, snapshotDigest);
    }
}
