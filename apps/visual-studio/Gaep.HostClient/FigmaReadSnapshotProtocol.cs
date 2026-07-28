using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string FigmaReadSnapshotProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-file-component-variable-names-external-identities-values-source-content-personal-content-secrets-credentials-or-permissions";
    private const string FigmaReadSnapshotProjectionAuthorityBoundary =
        "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string FigmaReadSnapshotStatusAuthorityBoundary =
        "figma-read-snapshot-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static FigmaReadSnapshotProjection ParseFigmaReadSnapshotResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "figma-read-snapshot-projection") != "figma-read-snapshot-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", FigmaReadSnapshotProjectionPrivacyBoundary) != FigmaReadSnapshotProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", FigmaReadSnapshotProjectionAuthorityBoundary) != FigmaReadSnapshotProjectionAuthorityBoundary)
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
                    "fileCount", "componentCount", "variableCollectionCount", "variableCount",
                    "sourceRecordedItemCount", "humanReviewedItemCount", "notAssessedItemCount",
                    "staleFileCount", "unknownFreshnessFileCount", "unresolvedTypeCount", "unresolvedOwnershipCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount",
                    "snapshotCompletenessState", "provenanceState", "reviewState", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "figma-read-snapshot-status") != "figma-read-snapshot-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", FigmaReadSnapshotStatusAuthorityBoundary) != FigmaReadSnapshotStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var fileCount = ParseBoundedNonNegativeInt(status, "fileCount", 256);
        var componentCount = ParseBoundedNonNegativeInt(status, "componentCount", 16_384);
        var variableCollectionCount = ParseBoundedNonNegativeInt(status, "variableCollectionCount", 1_024);
        var variableCount = ParseBoundedNonNegativeInt(status, "variableCount", 16_384);
        var sourceRecordedItemCount = ParseBoundedNonNegativeInt(status, "sourceRecordedItemCount", 33_792);
        var humanReviewedItemCount = ParseBoundedNonNegativeInt(status, "humanReviewedItemCount", 33_792);
        var notAssessedItemCount = ParseBoundedNonNegativeInt(status, "notAssessedItemCount", 33_792);
        var staleFileCount = ParseBoundedNonNegativeInt(status, "staleFileCount", 256);
        var unknownFreshnessFileCount = ParseBoundedNonNegativeInt(status, "unknownFreshnessFileCount", 256);
        var unresolvedTypeCount = ParseBoundedNonNegativeInt(status, "unresolvedTypeCount", 16_384);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var snapshotCompletenessState = ParseRequiredEnum(status, "snapshotCompletenessState", "candidate-observation-complete", "partial", "not-assessed");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "partial", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = sourceRecordedItemCount + notAssessedItemCount + staleFileCount + unknownFreshnessFileCount +
            unresolvedTypeCount + unresolvedOwnershipCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || fileCount == 0 || componentCount == 0 || variableCollectionCount == 0 ||
                    variableCount == 0 || snapshotCompletenessState != "candidate-observation-complete" ||
                    provenanceState != "exact" || reviewState != "ready-for-human-review" ||
                    reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        FigmaReadSnapshotRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "fileCount", "componentCount",
                    "variableCollectionCount", "variableCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new FigmaReadSnapshotRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "fileCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "componentCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "variableCollectionCount", 1_024),
                ParseBoundedNonNegativeInt(candidateElement, "variableCount", 16_384),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.FileCount ?? 0) != fileCount ||
            (candidate?.ComponentCount ?? 0) != componentCount ||
            (candidate?.VariableCollectionCount ?? 0) != variableCollectionCount ||
            (candidate?.VariableCount ?? 0) != variableCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new FigmaReadSnapshotProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, snapshotCompletenessState, provenanceState,
            Array.AsReadOnly(reasons), fileCount, componentCount, variableCollectionCount, variableCount,
            sourceRecordedItemCount, humanReviewedItemCount, notAssessedItemCount, staleFileCount,
            unknownFreshnessFileCount, unresolvedTypeCount, unresolvedOwnershipCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
