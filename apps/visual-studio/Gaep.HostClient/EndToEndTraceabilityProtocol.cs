using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string EndToEndTraceabilityProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials";
    private const string EndToEndTraceabilityProjectionAuthorityBoundary =
        "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority";
    private const string EndToEndTraceabilityStatusAuthorityBoundary =
        "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority";
    private const string EndToEndTraceabilityCoverageBoundary =
        "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship";

    internal static EndToEndTraceabilityProjection ParseEndToEndTraceabilityResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["traceability"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "end-to-end-traceability-projection") != "end-to-end-traceability-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", EndToEndTraceabilityProjectionPrivacyBoundary) != EndToEndTraceabilityProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", EndToEndTraceabilityProjectionAuthorityBoundary) != EndToEndTraceabilityProjectionAuthorityBoundary)
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
                    "nodeCount", "relationshipCount", "linkCount", "transformationCount", "verifiedLinkCount",
                    "proposedLinkCount", "invalidOrHistoricalLinkCount", "unresolvedEndpointCount",
                    "notAssessedSemanticCount", "missingSpineCount", "unknownRelationshipCount",
                    "unresolvedRequirementCount", "staleBindingCount", "staleSourceReferenceCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "state", "reasons", "assessedAt",
                    "coverageBoundary", "authorityBoundary",
                ],
                ["traceability"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "end-to-end-traceability-status") != "end-to-end-traceability-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "coverageBoundary", EndToEndTraceabilityCoverageBoundary) != EndToEndTraceabilityCoverageBoundary ||
            ParseRequiredEnum(status, "authorityBoundary", EndToEndTraceabilityStatusAuthorityBoundary) != EndToEndTraceabilityStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "traceability");
        var nodeCount = ParseBoundedNonNegativeInt(status, "nodeCount", 8_192);
        var relationshipCount = ParseBoundedNonNegativeInt(status, "relationshipCount", 512);
        var linkCount = ParseBoundedNonNegativeInt(status, "linkCount", 32_768);
        var transformationCount = ParseBoundedNonNegativeInt(status, "transformationCount", 4_096);
        var verifiedLinkCount = ParseBoundedNonNegativeInt(status, "verifiedLinkCount", 32_768);
        var proposedLinkCount = ParseBoundedNonNegativeInt(status, "proposedLinkCount", 32_768);
        var invalidOrHistoricalLinkCount = ParseBoundedNonNegativeInt(status, "invalidOrHistoricalLinkCount", 32_768);
        var unresolvedEndpointCount = ParseBoundedNonNegativeInt(status, "unresolvedEndpointCount", 65_536);
        var notAssessedSemanticCount = ParseBoundedNonNegativeInt(status, "notAssessedSemanticCount", 32_768);
        if (verifiedLinkCount + proposedLinkCount + invalidOrHistoricalLinkCount > linkCount ||
            notAssessedSemanticCount > linkCount)
        {
            throw InvalidResponse();
        }
        var missingSpineCount = ParseBoundedNonNegativeInt(status, "missingSpineCount", 4_096);
        var unknownRelationshipCount = ParseBoundedNonNegativeInt(status, "unknownRelationshipCount", 512);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 21);
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

        EndToEndTraceabilityRecordView? traceability = null;
        if (projection.TryGetProperty("traceability", out var traceabilityElement))
        {
            if (!HasOnlyProperties(
                    traceabilityElement,
                    "id", "revision", "digest", "membershipDigest", "state", "nodeCount",
                    "relationshipCount", "linkCount", "transformationCount", "updatedAt") ||
                ParseRequiredEnum(traceabilityElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(traceabilityElement, "id");
            var revision = ParsePositiveLong(traceabilityElement, "revision");
            var digest = ParseRequiredDigest(traceabilityElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            traceability = new EndToEndTraceabilityRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(traceabilityElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(traceabilityElement, "nodeCount", 8_192),
                ParseBoundedNonNegativeInt(traceabilityElement, "relationshipCount", 512),
                ParseBoundedNonNegativeInt(traceabilityElement, "linkCount", 32_768),
                ParseBoundedNonNegativeInt(traceabilityElement, "transformationCount", 4_096));
            ParseRequiredTimestamp(traceabilityElement, "updatedAt");
        }
        if ((reference is null) != (traceability is null) ||
            (traceability?.NodeCount ?? 0) != nodeCount ||
            (traceability?.RelationshipCount ?? 0) != relationshipCount ||
            (traceability?.LinkCount ?? 0) != linkCount ||
            (traceability?.TransformationCount ?? 0) != transformationCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new EndToEndTraceabilityProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), nodeCount, relationshipCount, linkCount,
            transformationCount, verifiedLinkCount, proposedLinkCount, invalidOrHistoricalLinkCount,
            unresolvedEndpointCount, notAssessedSemanticCount, missingSpineCount, unknownRelationshipCount,
            unresolvedRequirementCount, staleBindingCount, staleSourceReferenceCount, inconsistencyCount,
            unresolvedQuestionCount, EndToEndTraceabilityCoverageBoundary, traceability, snapshotDigest);
    }
}
