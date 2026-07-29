using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string FinalizedFigmaSnapshotImportProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-names-external-identities-source-content-authorization-actor-personal-content-secrets-credentials-or-permissions";
    private const string FinalizedFigmaSnapshotImportProjectionAuthorityBoundary =
        "finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string FinalizedFigmaSnapshotImportStatusAuthorityBoundary =
        "finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static FinalizedFigmaSnapshotImportProjection ParseFinalizedFigmaSnapshotImportResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "finalized-figma-snapshot-import-projection") != "finalized-figma-snapshot-import-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", FinalizedFigmaSnapshotImportProjectionPrivacyBoundary) != FinalizedFigmaSnapshotImportProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", FinalizedFigmaSnapshotImportProjectionAuthorityBoundary) != FinalizedFigmaSnapshotImportProjectionAuthorityBoundary)
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
                    "itemCount", "humanReviewedItemCount", "sourceRecordedItemCount", "notAssessedItemCount",
                    "openConflictCount", "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount",
                    "returnAuthorizationState", "reconciliationState", "provenanceState", "snapshotCompletenessState",
                    "reviewState", "importExecutionState", "importResultState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "finalized-figma-snapshot-import-status") != "finalized-figma-snapshot-import-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", FinalizedFigmaSnapshotImportStatusAuthorityBoundary) != FinalizedFigmaSnapshotImportStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var itemCount = ParseBoundedNonNegativeInt(status, "itemCount", 33_792);
        var humanReviewedItemCount = ParseBoundedNonNegativeInt(status, "humanReviewedItemCount", 33_792);
        var sourceRecordedItemCount = ParseBoundedNonNegativeInt(status, "sourceRecordedItemCount", 33_792);
        var notAssessedItemCount = ParseBoundedNonNegativeInt(status, "notAssessedItemCount", 33_792);
        if (humanReviewedItemCount + sourceRecordedItemCount + notAssessedItemCount != itemCount) throw InvalidResponse();
        var openConflictCount = ParseBoundedNonNegativeInt(status, "openConflictCount", 1_024);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var returnAuthorizationState = ParseRequiredEnum(status, "returnAuthorizationState", "not-assessed", "missing", "verified");
        var reconciliationState = ParseRequiredEnum(status, "reconciliationState", "exact", "partial", "not-assessed");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "partial", "not-assessed");
        var snapshotCompletenessState = ParseRequiredEnum(status, "snapshotCompletenessState", "candidate-complete", "partial", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var importExecutionState = ParseRequiredEnum(status, "importExecutionState", "not-performed");
        var importResultState = ParseRequiredEnum(status, "importResultState", "not-recorded");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = sourceRecordedItemCount + notAssessedItemCount + openConflictCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || itemCount == 0 || returnAuthorizationState != "verified" ||
                    reconciliationState != "exact" || provenanceState != "exact" ||
                    snapshotCompletenessState != "candidate-complete" || reviewState != "ready-for-human-review" ||
                    reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        FinalizedFigmaSnapshotImportRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "governedWrite",
                    "externalFileIdentityDigest", "returnedExternalVersionDigest", "payloadDigest", "receiptDigest",
                    "reconciliationDigest", "itemCount", "conflictCount", "returnAuthorizationState",
                    "reconciliationState", "provenanceState", "reviewState", "importExecutionState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            var governedWriteElement = candidateElement.GetProperty("governedWrite");
            if (!HasOnlyProperties(
                    governedWriteElement,
                    "recordId", "revision", "digest", "membershipDigest", "requestDigest", "effectDigest",
                    "externalFileIdentityDigest", "expectedExternalVersionDigest"))
            {
                throw InvalidResponse();
            }
            var governedWrite = new FinalizedFigmaSnapshotImportGovernedWriteBindingView(
                ParseRequiredGuid(governedWriteElement, "recordId"),
                ParsePositiveLong(governedWriteElement, "revision"),
                ParseRequiredDigest(governedWriteElement, "digest"),
                ParseRequiredDigest(governedWriteElement, "membershipDigest"),
                ParseRequiredDigest(governedWriteElement, "requestDigest"),
                ParseRequiredDigest(governedWriteElement, "effectDigest"),
                ParseRequiredDigest(governedWriteElement, "externalFileIdentityDigest"),
                ParseRequiredDigest(governedWriteElement, "expectedExternalVersionDigest"));
            candidate = new FinalizedFigmaSnapshotImportRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                governedWrite,
                ParseRequiredDigest(candidateElement, "externalFileIdentityDigest"),
                ParseRequiredDigest(candidateElement, "returnedExternalVersionDigest"),
                ParseRequiredDigest(candidateElement, "payloadDigest"),
                ParseRequiredDigest(candidateElement, "receiptDigest"),
                ParseRequiredDigest(candidateElement, "reconciliationDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "itemCount", 33_792),
                ParseBoundedNonNegativeInt(candidateElement, "conflictCount", 1_024),
                ParseRequiredEnum(candidateElement, "returnAuthorizationState", "not-assessed", "missing", "verified"),
                ParseRequiredEnum(candidateElement, "reconciliationState", "exact", "partial", "not-assessed"),
                ParseRequiredEnum(candidateElement, "provenanceState", "exact", "partial", "not-assessed"),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"),
                ParseRequiredEnum(candidateElement, "importExecutionState", "not-performed"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.ItemCount ?? 0) != itemCount ||
            (candidate is not null &&
                (candidate.ReturnAuthorizationState != returnAuthorizationState ||
                    candidate.ReconciliationState != reconciliationState || candidate.ProvenanceState != provenanceState ||
                    candidate.ReviewState != reviewState || candidate.ImportExecutionState != importExecutionState ||
                    candidate.ExternalFileIdentityDigest != candidate.GovernedWrite.ExternalFileIdentityDigest)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new FinalizedFigmaSnapshotImportProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, returnAuthorizationState, reconciliationState,
            provenanceState, snapshotCompletenessState, importExecutionState, importResultState,
            Array.AsReadOnly(reasons), itemCount, humanReviewedItemCount, sourceRecordedItemCount,
            notAssessedItemCount, openConflictCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
