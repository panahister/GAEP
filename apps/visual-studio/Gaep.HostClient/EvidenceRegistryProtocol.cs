using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string EvidenceRegistryProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials";
    private const string EvidenceRegistryProjectionAuthorityBoundary =
        "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority";
    private const string EvidenceRegistryStatusAuthorityBoundary =
        "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority";

    internal static EvidenceRegistryProjection ParseEvidenceRegistryResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["registry"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "evidence-registry-projection") != "evidence-registry-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", EvidenceRegistryProjectionPrivacyBoundary) != EvidenceRegistryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", EvidenceRegistryProjectionAuthorityBoundary) != EvidenceRegistryProjectionAuthorityBoundary)
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
                    "claimCount", "evidenceItemCount", "linkCount", "notAssessedClaimCount", "notAssessedEvidenceCount",
                    "adverseEvidencePendingDispositionCount", "staleOrUnknownEvidenceCount", "invalidatedEvidenceCount",
                    "unresolvedLinkCount", "unresolvedRequirementCount", "staleBindingCount", "staleSourceReferenceCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["registry"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "evidence-registry-status") != "evidence-registry-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", EvidenceRegistryStatusAuthorityBoundary) != EvidenceRegistryStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "registry");
        var claimCount = ParseBoundedNonNegativeInt(status, "claimCount", 4_096);
        var evidenceItemCount = ParseBoundedNonNegativeInt(status, "evidenceItemCount", 8_192);
        var linkCount = ParseBoundedNonNegativeInt(status, "linkCount", 32_768);
        var notAssessedClaimCount = ParseBoundedNonNegativeInt(status, "notAssessedClaimCount", 4_096);
        var notAssessedEvidenceCount = ParseBoundedNonNegativeInt(status, "notAssessedEvidenceCount", 8_192);
        var adverseEvidencePendingDispositionCount = ParseBoundedNonNegativeInt(status, "adverseEvidencePendingDispositionCount", 8_192);
        var staleOrUnknownEvidenceCount = ParseBoundedNonNegativeInt(status, "staleOrUnknownEvidenceCount", 8_192);
        var invalidatedEvidenceCount = ParseBoundedNonNegativeInt(status, "invalidatedEvidenceCount", 8_192);
        var unresolvedLinkCount = ParseBoundedNonNegativeInt(status, "unresolvedLinkCount", 32_768);
        if (notAssessedClaimCount > claimCount || notAssessedEvidenceCount > evidenceItemCount ||
            adverseEvidencePendingDispositionCount > evidenceItemCount || staleOrUnknownEvidenceCount > evidenceItemCount ||
            invalidatedEvidenceCount > evidenceItemCount || unresolvedLinkCount > linkCount)
        {
            throw InvalidResponse();
        }
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 23);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var assessmentState = ParseRequiredEnum(status, "state", "complete-for-review", "attention-required");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        EvidenceRegistryRecordView? registry = null;
        if (projection.TryGetProperty("registry", out var registryElement))
        {
            if (!HasOnlyProperties(
                    registryElement,
                    "id", "revision", "digest", "membershipDigest", "state", "claimCount", "evidenceItemCount", "linkCount", "updatedAt") ||
                ParseRequiredEnum(registryElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(registryElement, "id");
            var revision = ParsePositiveLong(registryElement, "revision");
            var digest = ParseRequiredDigest(registryElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            registry = new EvidenceRegistryRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(registryElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(registryElement, "claimCount", 4_096),
                ParseBoundedNonNegativeInt(registryElement, "evidenceItemCount", 8_192),
                ParseBoundedNonNegativeInt(registryElement, "linkCount", 32_768));
            ParseRequiredTimestamp(registryElement, "updatedAt");
        }
        if ((reference is null) != (registry is null) ||
            (registry?.ClaimCount ?? 0) != claimCount ||
            (registry?.EvidenceItemCount ?? 0) != evidenceItemCount ||
            (registry?.LinkCount ?? 0) != linkCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new EvidenceRegistryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), claimCount, evidenceItemCount, linkCount,
            notAssessedClaimCount, notAssessedEvidenceCount, adverseEvidencePendingDispositionCount,
            staleOrUnknownEvidenceCount, invalidatedEvidenceCount, unresolvedLinkCount, unresolvedRequirementCount,
            inconsistencyCount, unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, registry,
            snapshotDigest);
    }
}
