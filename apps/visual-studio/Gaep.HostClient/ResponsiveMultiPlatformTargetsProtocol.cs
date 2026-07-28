using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ResponsiveMultiPlatformTargetsProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials";
    private const string ResponsiveMultiPlatformTargetsProjectionAuthorityBoundary =
        "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority";
    private const string ResponsiveMultiPlatformTargetsStatusAuthorityBoundary =
        "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority";

    internal static ResponsiveMultiPlatformTargetsProjection ParseResponsiveMultiPlatformTargetsResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "responsive-multi-platform-targets-projection") != "responsive-multi-platform-targets-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ResponsiveMultiPlatformTargetsProjectionPrivacyBoundary) != ResponsiveMultiPlatformTargetsProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ResponsiveMultiPlatformTargetsProjectionAuthorityBoundary) != ResponsiveMultiPlatformTargetsProjectionAuthorityBoundary)
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
                    "platformTargetCount", "breakpointCount", "behaviorCount", "checkCount", "applicableBehaviorCount",
                    "unresolvedBehaviorCount", "notAssessedCheckCount", "evidenceRecordedCheckCount",
                    "humanReviewedCheckCount", "contradictedCheckCount", "representedRequirementCount",
                    "unresolvedRequirementCount", "unresolvedOwnershipCount", "staleBindingCount",
                    "staleSourceReferenceCount", "unresolvedQuestionCount", "targetCatalogState",
                    "breakpointCatalogState", "behaviorCatalogState", "reviewState", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "responsive-multi-platform-targets-status") != "responsive-multi-platform-targets-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ResponsiveMultiPlatformTargetsStatusAuthorityBoundary) != ResponsiveMultiPlatformTargetsStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var platformTargetCount = ParseBoundedNonNegativeInt(status, "platformTargetCount", 4_096);
        var breakpointCount = ParseBoundedNonNegativeInt(status, "breakpointCount", 4_096);
        var behaviorCount = ParseBoundedNonNegativeInt(status, "behaviorCount", 8_192);
        var checkCount = ParseBoundedNonNegativeInt(status, "checkCount", 16_384);
        var applicableBehaviorCount = ParseBoundedNonNegativeInt(status, "applicableBehaviorCount", 8_192);
        var unresolvedBehaviorCount = ParseBoundedNonNegativeInt(status, "unresolvedBehaviorCount", 8_192);
        var notAssessedCheckCount = ParseBoundedNonNegativeInt(status, "notAssessedCheckCount", 16_384);
        var evidenceRecordedCheckCount = ParseBoundedNonNegativeInt(status, "evidenceRecordedCheckCount", 16_384);
        var humanReviewedCheckCount = ParseBoundedNonNegativeInt(status, "humanReviewedCheckCount", 16_384);
        var contradictedCheckCount = ParseBoundedNonNegativeInt(status, "contradictedCheckCount", 16_384);
        var representedRequirementCount = ParseBoundedNonNegativeInt(status, "representedRequirementCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 4_096);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 12_288);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var targetCatalogState = ParseRequiredEnum(status, "targetCatalogState", "candidate-complete", "not-assessed");
        var breakpointCatalogState = ParseRequiredEnum(status, "breakpointCatalogState", "candidate-complete", "not-assessed");
        var behaviorCatalogState = ParseRequiredEnum(status, "behaviorCatalogState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedBehaviorCount + notAssessedCheckCount + evidenceRecordedCheckCount +
            contradictedCheckCount + unresolvedRequirementCount + unresolvedOwnershipCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || targetCatalogState != "candidate-complete" ||
                    breakpointCatalogState != "candidate-complete" || behaviorCatalogState != "candidate-complete" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        ResponsiveMultiPlatformTargetsRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "platformTargetCount",
                    "breakpointCount", "behaviorCount", "checkCount", "representedRequirementCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new ResponsiveMultiPlatformTargetsRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "platformTargetCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "breakpointCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "behaviorCount", 8_192),
                ParseBoundedNonNegativeInt(candidateElement, "checkCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "representedRequirementCount", 4_096),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.PlatformTargetCount ?? 0) != platformTargetCount ||
            (candidate?.BreakpointCount ?? 0) != breakpointCount ||
            (candidate?.BehaviorCount ?? 0) != behaviorCount ||
            (candidate?.CheckCount ?? 0) != checkCount ||
            (candidate?.RepresentedRequirementCount ?? 0) != representedRequirementCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ResponsiveMultiPlatformTargetsProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, targetCatalogState, breakpointCatalogState,
            behaviorCatalogState, Array.AsReadOnly(reasons), platformTargetCount, breakpointCount, behaviorCount,
            checkCount, applicableBehaviorCount, unresolvedBehaviorCount, notAssessedCheckCount,
            evidenceRecordedCheckCount, humanReviewedCheckCount, contradictedCheckCount, representedRequirementCount,
            unresolvedRequirementCount, unresolvedOwnershipCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
