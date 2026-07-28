using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignSystemTokenContractProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials";
    private const string DesignSystemTokenContractProjectionAuthorityBoundary =
        "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority";
    private const string DesignSystemTokenContractStatusAuthorityBoundary =
        "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority";

    internal static DesignSystemTokenContractProjection ParseDesignSystemTokenContractResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-system-token-contract-projection") != "design-system-token-contract-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignSystemTokenContractProjectionPrivacyBoundary) != DesignSystemTokenContractProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignSystemTokenContractProjectionAuthorityBoundary) != DesignSystemTokenContractProjectionAuthorityBoundary)
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
                    "designSystemCount", "tokenCount", "variableCollectionCount", "variableCount", "componentCount",
                    "representedRequirementCount", "unresolvedRequirementCount", "unresolvedOwnershipCount",
                    "unresolvedCatalogItemCount", "accessibilityReviewGapCount", "staleBindingCount",
                    "stalePortableSnapshotCount", "staleSourceReferenceCount", "unresolvedQuestionCount",
                    "catalogCompletenessState", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-system-token-contract-status") != "design-system-token-contract-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignSystemTokenContractStatusAuthorityBoundary) != DesignSystemTokenContractStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var designSystemCount = ParseBoundedNonNegativeInt(status, "designSystemCount", 256);
        var tokenCount = ParseBoundedNonNegativeInt(status, "tokenCount", 5_000);
        var variableCollectionCount = ParseBoundedNonNegativeInt(status, "variableCollectionCount", 1_024);
        var variableCount = ParseBoundedNonNegativeInt(status, "variableCount", 16_384);
        var componentCount = ParseBoundedNonNegativeInt(status, "componentCount", 16_384);
        var representedRequirementCount = ParseBoundedNonNegativeInt(status, "representedRequirementCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 4_096);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 38_208);
        var unresolvedCatalogItemCount = ParseBoundedNonNegativeInt(status, "unresolvedCatalogItemCount", 38_208);
        var accessibilityReviewGapCount = ParseBoundedNonNegativeInt(status, "accessibilityReviewGapCount", 21_384);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var stalePortableSnapshotCount = ParseBoundedNonNegativeInt(status, "stalePortableSnapshotCount", 1);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var catalogCompletenessState = ParseRequiredEnum(status, "catalogCompletenessState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedRequirementCount + unresolvedOwnershipCount + unresolvedCatalogItemCount +
            accessibilityReviewGapCount + staleBindingCount + stalePortableSnapshotCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || catalogCompletenessState != "candidate-complete" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignSystemTokenContractRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "designSystemCount", "tokenCount",
                    "variableCollectionCount", "variableCount", "componentCount", "representedRequirementCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignSystemTokenContractRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "designSystemCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "tokenCount", 5_000),
                ParseBoundedNonNegativeInt(candidateElement, "variableCollectionCount", 1_024),
                ParseBoundedNonNegativeInt(candidateElement, "variableCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "componentCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "representedRequirementCount", 4_096),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.DesignSystemCount ?? 0) != designSystemCount ||
            (candidate?.TokenCount ?? 0) != tokenCount ||
            (candidate?.VariableCollectionCount ?? 0) != variableCollectionCount ||
            (candidate?.VariableCount ?? 0) != variableCount ||
            (candidate?.ComponentCount ?? 0) != componentCount ||
            (candidate?.RepresentedRequirementCount ?? 0) != representedRequirementCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignSystemTokenContractProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, catalogCompletenessState, Array.AsReadOnly(reasons),
            designSystemCount, tokenCount, variableCollectionCount, variableCount, componentCount,
            representedRequirementCount, unresolvedRequirementCount, unresolvedOwnershipCount,
            unresolvedCatalogItemCount, accessibilityReviewGapCount, staleBindingCount, stalePortableSnapshotCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
