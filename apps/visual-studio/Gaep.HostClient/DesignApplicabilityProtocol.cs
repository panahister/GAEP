using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignApplicabilityProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials";
    private const string DesignApplicabilityProjectionAuthorityBoundary =
        "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action";
    private const string DesignApplicabilityStatusAuthorityBoundary =
        "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action";

    internal static DesignApplicabilityProjection ParseDesignApplicabilityResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-applicability-projection") != "design-applicability-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignApplicabilityProjectionPrivacyBoundary) != DesignApplicabilityProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignApplicabilityProjectionAuthorityBoundary) != DesignApplicabilityProjectionAuthorityBoundary)
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
                    "scopeCount", "decisionCount", "unresolvedDecisionCount", "blockedDecisionCount",
                    "pendingApprovalCount", "rejectedApprovalCount", "unresolvedDepthCount", "unresolvedSourceCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "reviewState", "state",
                    "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-applicability-status") != "design-applicability-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignApplicabilityStatusAuthorityBoundary) != DesignApplicabilityStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var scopeCount = ParseBoundedNonNegativeInt(status, "scopeCount", 256);
        var decisionCount = ParseBoundedNonNegativeInt(status, "decisionCount", 1_024);
        var unresolvedDecisionCount = ParseBoundedNonNegativeInt(status, "unresolvedDecisionCount", 1_024);
        var blockedDecisionCount = ParseBoundedNonNegativeInt(status, "blockedDecisionCount", 1_024);
        var pendingApprovalCount = ParseBoundedNonNegativeInt(status, "pendingApprovalCount", 1_024);
        var rejectedApprovalCount = ParseBoundedNonNegativeInt(status, "rejectedApprovalCount", 1_024);
        var unresolvedDepthCount = ParseBoundedNonNegativeInt(status, "unresolvedDepthCount", 256);
        var unresolvedSourceCount = ParseBoundedNonNegativeInt(status, "unresolvedSourceCount", 256);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (decisionCount != scopeCount * 4) throw InvalidResponse();
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedDecisionCount + blockedDecisionCount + pendingApprovalCount + rejectedApprovalCount +
            unresolvedDepthCount + unresolvedSourceCount + staleBindingCount + staleSourceReferenceCount +
            unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignApplicabilityRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "scopeCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignApplicabilityRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "scopeCount", 256),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.ScopeCount ?? 0) != scopeCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignApplicabilityProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, Array.AsReadOnly(reasons), scopeCount, decisionCount,
            unresolvedDecisionCount, blockedDecisionCount, pendingApprovalCount, rejectedApprovalCount,
            unresolvedDepthCount, unresolvedSourceCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
