using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignDeltaProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string DesignDeltaProjectionAuthorityBoundary =
        "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority";
    private const string DesignDeltaStatusAuthorityBoundary =
        "design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority";

    internal static DesignDeltaProjection ParseDesignDeltaResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-delta-projection") != "design-delta-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignDeltaProjectionPrivacyBoundary) != DesignDeltaProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignDeltaProjectionAuthorityBoundary) != DesignDeltaProjectionAuthorityBoundary)
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
                    "sourceItemCount", "targetItemCount", "deltaCount", "addedCount", "changedCount", "conflictingCount",
                    "missingCount", "staleCount", "unmappedCount", "humanReviewedCount", "staleBindingCount",
                    "staleSourceReferenceCount", "unresolvedMappingCount", "unresolvedQuestionCount", "comparisonState",
                    "provenanceState", "candidateResult", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-delta-status") != "design-delta-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignDeltaStatusAuthorityBoundary) != DesignDeltaStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var sourceItemCount = ParseBoundedNonNegativeInt(status, "sourceItemCount", 131_072);
        var targetItemCount = ParseBoundedNonNegativeInt(status, "targetItemCount", 131_072);
        var deltaCount = ParseBoundedNonNegativeInt(status, "deltaCount", 65_536);
        var addedCount = ParseBoundedNonNegativeInt(status, "addedCount", 65_536);
        var changedCount = ParseBoundedNonNegativeInt(status, "changedCount", 65_536);
        var conflictingCount = ParseBoundedNonNegativeInt(status, "conflictingCount", 65_536);
        var missingCount = ParseBoundedNonNegativeInt(status, "missingCount", 65_536);
        var staleCount = ParseBoundedNonNegativeInt(status, "staleCount", 65_536);
        var unmappedCount = ParseBoundedNonNegativeInt(status, "unmappedCount", 65_536);
        var humanReviewedCount = ParseBoundedNonNegativeInt(status, "humanReviewedCount", 65_536);
        if (addedCount + changedCount + conflictingCount + missingCount + staleCount + unmappedCount != deltaCount ||
            humanReviewedCount > deltaCount)
        {
            throw InvalidResponse();
        }
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedMappingCount = ParseBoundedNonNegativeInt(status, "unresolvedMappingCount", 4_096);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var comparisonState = ParseRequiredEnum(status, "comparisonState", "exact", "not-assessed", "partial");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "not-assessed", "partial");
        var candidateResult = ParseRequiredEnum(
            status,
            "candidateResult",
            "blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = staleBindingCount + staleSourceReferenceCount + unresolvedMappingCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (reference is null || reasons.Length > 0 || comparisonState != "exact" || provenanceState != "exact" ||
                    gapCount > 0 || reviewState != "ready-for-human-review" ||
                    candidateResult is "blocked" or "incomplete" or "not-assessed")) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        static DesignDeltaDesignerReadyBindingView ParseDesignerReadyBinding(JsonElement value)
        {
            if (!HasOnlyProperties(
                    value,
                    "recordId", "revision", "digest", "membershipDigest", "prerequisiteCatalogDigest",
                    "assessmentReceiptDigest", "candidateResult"))
            {
                throw InvalidResponse();
            }
            return new DesignDeltaDesignerReadyBindingView(
                ParseRequiredGuid(value, "recordId"),
                ParsePositiveLong(value, "revision"),
                ParseRequiredDigest(value, "digest"),
                ParseRequiredDigest(value, "membershipDigest"),
                ParseRequiredDigest(value, "prerequisiteCatalogDigest"),
                ParseRequiredDigest(value, "assessmentReceiptDigest"),
                ParseRequiredEnum(value, "candidateResult", "blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "pass-candidate"));
        }

        static DesignDeltaDependencyBindingView ParseDependency(JsonElement value, string catalogKey)
        {
            if (!HasOnlyProperties(value, "recordId", "revision", "digest", "membershipDigest", catalogKey, "reconciliationDigest", "reviewState"))
            {
                throw InvalidResponse();
            }
            return new DesignDeltaDependencyBindingView(
                ParseRequiredGuid(value, "recordId"),
                ParsePositiveLong(value, "revision"),
                ParseRequiredDigest(value, "digest"),
                ParseRequiredDigest(value, "membershipDigest"),
                ParseRequiredDigest(value, catalogKey),
                ParseRequiredDigest(value, "reconciliationDigest"),
                ParseRequiredEnum(value, "reviewState", "draft", "held", "ready-for-human-review"));
        }

        DesignDeltaRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "designerReadyGate", "finalizedSnapshot",
                    "designBinding", "sourceSnapshotDigest", "targetSnapshotDigest", "comparisonDefinitionDigest",
                    "comparisonReceiptDigest", "deltaCatalogDigest", "deltaCount", "comparisonState", "provenanceState",
                    "candidateResult", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignDeltaRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseDesignerReadyBinding(candidateElement.GetProperty("designerReadyGate")),
                ParseDependency(candidateElement.GetProperty("finalizedSnapshot"), "itemCatalogDigest"),
                ParseDependency(candidateElement.GetProperty("designBinding"), "bindingCatalogDigest"),
                ParseRequiredDigest(candidateElement, "sourceSnapshotDigest"),
                ParseRequiredDigest(candidateElement, "targetSnapshotDigest"),
                ParseRequiredDigest(candidateElement, "comparisonDefinitionDigest"),
                ParseRequiredDigest(candidateElement, "comparisonReceiptDigest"),
                ParseRequiredDigest(candidateElement, "deltaCatalogDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "deltaCount", 65_536),
                ParseRequiredEnum(candidateElement, "comparisonState", "exact", "not-assessed", "partial"),
                ParseRequiredEnum(candidateElement, "provenanceState", "exact", "not-assessed", "partial"),
                ParseRequiredEnum(candidateElement, "candidateResult", "blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate"),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate is not null &&
                (candidate.DeltaCount != deltaCount || candidate.ComparisonState != comparisonState ||
                    candidate.ProvenanceState != provenanceState || candidate.CandidateResult != candidateResult ||
                    candidate.ReviewState != reviewState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignDeltaProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, candidateResult, reviewState, assessmentState, comparisonState, provenanceState,
            Array.AsReadOnly(reasons), sourceItemCount, targetItemCount, deltaCount, addedCount, changedCount,
            conflictingCount, missingCount, staleCount, unmappedCount, humanReviewedCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedMappingCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
