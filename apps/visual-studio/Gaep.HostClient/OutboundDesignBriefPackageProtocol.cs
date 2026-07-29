using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string OutboundDesignBriefPackageProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-transformation-disclosure-or-personal-content-secrets-credentials-or-permissions";
    private const string OutboundDesignBriefPackageProjectionAuthorityBoundary =
        "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string OutboundDesignBriefPackageStatusAuthorityBoundary =
        "outbound-design-brief-package-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static OutboundDesignBriefPackageProjection ParseOutboundDesignBriefPackageResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "outbound-design-brief-package-projection") != "outbound-design-brief-package-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", OutboundDesignBriefPackageProjectionPrivacyBoundary) != OutboundDesignBriefPackageProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", OutboundDesignBriefPackageProjectionAuthorityBoundary) != OutboundDesignBriefPackageProjectionAuthorityBoundary)
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
                    "contextPackCount", "entryCount", "contextItemCount", "recipientCount", "humanReviewedEntryCount",
                    "sourceRecordedEntryCount", "notAssessedEntryCount", "unresolvedRedactionCount",
                    "representedRequirementCount", "unresolvedRequirementCount", "unresolvedDisclosureCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "manifestState",
                    "provenanceState", "redactionReviewState", "previewState", "reviewState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "outbound-design-brief-package-status") != "outbound-design-brief-package-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", OutboundDesignBriefPackageStatusAuthorityBoundary) != OutboundDesignBriefPackageStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var contextPackCount = ParseBoundedNonNegativeInt(status, "contextPackCount", 32);
        var entryCount = ParseBoundedNonNegativeInt(status, "entryCount", 4_096);
        var contextItemCount = ParseBoundedNonNegativeInt(status, "contextItemCount", 16_384);
        var recipientCount = ParseBoundedNonNegativeInt(status, "recipientCount", 256);
        var humanReviewedEntryCount = ParseBoundedNonNegativeInt(status, "humanReviewedEntryCount", 4_096);
        var sourceRecordedEntryCount = ParseBoundedNonNegativeInt(status, "sourceRecordedEntryCount", 4_096);
        var notAssessedEntryCount = ParseBoundedNonNegativeInt(status, "notAssessedEntryCount", 4_096);
        var unresolvedRedactionCount = ParseBoundedNonNegativeInt(status, "unresolvedRedactionCount", 4_096);
        var representedRequirementCount = ParseBoundedNonNegativeInt(status, "representedRequirementCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 4_096);
        var unresolvedDisclosureCount = ParseBoundedNonNegativeInt(status, "unresolvedDisclosureCount", 4_096);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var manifestState = ParseRequiredEnum(status, "manifestState", "candidate-complete", "not-assessed", "partial");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "not-assessed", "partial");
        var redactionReviewState = ParseRequiredEnum(status, "redactionReviewState", "complete", "not-assessed", "partial");
        var previewState = ParseRequiredEnum(status, "previewState", "candidate-generated", "human-reviewed", "not-generated");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = sourceRecordedEntryCount + notAssessedEntryCount + unresolvedRedactionCount +
            unresolvedRequirementCount + unresolvedDisclosureCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || contextPackCount == 0 || entryCount == 0 || recipientCount == 0 ||
                    manifestState != "candidate-complete" || provenanceState != "exact" || redactionReviewState != "complete" ||
                    previewState != "human-reviewed" || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        OutboundDesignBriefPackageRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "manifestFormat", "manifestDigest",
                    "payloadDigest", "contextPackCount", "entryCount", "contextItemCount", "recipientCount",
                    "representedRequirementCount", "unresolvedDisclosureCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new OutboundDesignBriefPackageRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseRequiredEnum(candidateElement, "manifestFormat", "gaep-outbound-design-brief-package-v1"),
                ParseRequiredDigest(candidateElement, "manifestDigest"),
                ParseRequiredDigest(candidateElement, "payloadDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "contextPackCount", 32),
                ParseBoundedNonNegativeInt(candidateElement, "entryCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "contextItemCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "recipientCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "representedRequirementCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "unresolvedDisclosureCount", 4_096),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.ContextPackCount ?? 0) != contextPackCount || (candidate?.EntryCount ?? 0) != entryCount ||
            (candidate?.ContextItemCount ?? 0) != contextItemCount || (candidate?.RecipientCount ?? 0) != recipientCount ||
            (candidate?.RepresentedRequirementCount ?? 0) != representedRequirementCount ||
            (candidate?.UnresolvedDisclosureCount ?? 0) != unresolvedDisclosureCount ||
            (candidate is not null && candidate.ReviewState != reviewState) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new OutboundDesignBriefPackageProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, manifestState, provenanceState, redactionReviewState,
            previewState, Array.AsReadOnly(reasons), contextPackCount, entryCount, contextItemCount, recipientCount,
            humanReviewedEntryCount, sourceRecordedEntryCount, notAssessedEntryCount, unresolvedRedactionCount,
            representedRequirementCount, unresolvedRequirementCount, unresolvedDisclosureCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
