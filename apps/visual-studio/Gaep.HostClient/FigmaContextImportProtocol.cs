using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string FigmaContextImportProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-or-personal-content-secrets-credentials-or-permissions";
    private const string FigmaContextImportProjectionAuthorityBoundary =
        "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string FigmaContextImportStatusAuthorityBoundary =
        "figma-context-import-status-is-observational-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static FigmaContextImportProjection ParseFigmaContextImportResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "figma-context-import-projection") != "figma-context-import-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", FigmaContextImportProjectionPrivacyBoundary) != FigmaContextImportProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", FigmaContextImportProjectionAuthorityBoundary) != FigmaContextImportProjectionAuthorityBoundary)
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
                    "contextPackCount", "sectionCount", "contextItemCount", "targetCount",
                    "humanReviewedSectionCount", "sourceRecordedSectionCount", "notAssessedSectionCount",
                    "unresolvedRedactionCount", "representedRequirementCount", "unresolvedRequirementCount",
                    "unresolvedOwnershipCount", "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount",
                    "contextSelectionState", "provenanceState", "previewState", "reviewState", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "figma-context-import-status") != "figma-context-import-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", FigmaContextImportStatusAuthorityBoundary) != FigmaContextImportStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var contextPackCount = ParseBoundedNonNegativeInt(status, "contextPackCount", 32);
        var sectionCount = ParseBoundedNonNegativeInt(status, "sectionCount", 4_096);
        var contextItemCount = ParseBoundedNonNegativeInt(status, "contextItemCount", 16_384);
        var targetCount = ParseBoundedNonNegativeInt(status, "targetCount", 256);
        var humanReviewedSectionCount = ParseBoundedNonNegativeInt(status, "humanReviewedSectionCount", 4_096);
        var sourceRecordedSectionCount = ParseBoundedNonNegativeInt(status, "sourceRecordedSectionCount", 4_096);
        var notAssessedSectionCount = ParseBoundedNonNegativeInt(status, "notAssessedSectionCount", 4_096);
        var unresolvedRedactionCount = ParseBoundedNonNegativeInt(status, "unresolvedRedactionCount", 4_096);
        var representedRequirementCount = ParseBoundedNonNegativeInt(status, "representedRequirementCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 4_096);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 256);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var contextSelectionState = ParseRequiredEnum(status, "contextSelectionState", "candidate-selection-complete", "not-assessed", "partial");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "not-assessed", "partial");
        var previewState = ParseRequiredEnum(status, "previewState", "candidate-generated", "human-reviewed", "not-generated");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = sourceRecordedSectionCount + notAssessedSectionCount + unresolvedRedactionCount +
            unresolvedRequirementCount + unresolvedOwnershipCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || contextPackCount == 0 || sectionCount == 0 || targetCount == 0 ||
                    contextSelectionState != "candidate-selection-complete" || provenanceState != "exact" ||
                    previewState != "human-reviewed" || reviewState != "ready-for-human-review" ||
                    reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        FigmaContextImportRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "contextPackCount", "sectionCount",
                    "contextItemCount", "targetCount", "representedRequirementCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new FigmaContextImportRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "contextPackCount", 32),
                ParseBoundedNonNegativeInt(candidateElement, "sectionCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "contextItemCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "targetCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "representedRequirementCount", 4_096),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.ContextPackCount ?? 0) != contextPackCount ||
            (candidate?.SectionCount ?? 0) != sectionCount ||
            (candidate?.ContextItemCount ?? 0) != contextItemCount ||
            (candidate?.TargetCount ?? 0) != targetCount ||
            (candidate?.RepresentedRequirementCount ?? 0) != representedRequirementCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new FigmaContextImportProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, contextSelectionState, provenanceState, previewState,
            Array.AsReadOnly(reasons), contextPackCount, sectionCount, contextItemCount, targetCount,
            humanReviewedSectionCount, sourceRecordedSectionCount, notAssessedSectionCount, unresolvedRedactionCount,
            representedRequirementCount, unresolvedRequirementCount, unresolvedOwnershipCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
