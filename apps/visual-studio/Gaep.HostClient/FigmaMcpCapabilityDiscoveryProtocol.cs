using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string FigmaMcpCapabilityDiscoveryProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-tool-names-schemas-permissions-limits-versions-source-content-personal-content-secrets-credentials-or-figma-content";
    private const string FigmaMcpCapabilityDiscoveryProjectionAuthorityBoundary =
        "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string FigmaMcpCapabilityDiscoveryStatusAuthorityBoundary =
        "figma-mcp-capability-discovery-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static FigmaMcpCapabilityDiscoveryProjection ParseFigmaMcpCapabilityDiscoveryResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "figma-mcp-capability-discovery-projection") != "figma-mcp-capability-discovery-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", FigmaMcpCapabilityDiscoveryProjectionPrivacyBoundary) != FigmaMcpCapabilityDiscoveryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", FigmaMcpCapabilityDiscoveryProjectionAuthorityBoundary) != FigmaMcpCapabilityDiscoveryProjectionAuthorityBoundary)
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
                    "toolCount", "advertisedToolCount", "unavailableToolCount", "unknownAvailabilityCount",
                    "readToolCount", "writeToolCount", "unknownEffectCount", "notAssessedToolCount",
                    "sourceRecordedToolCount", "humanReviewedToolCount", "unresolvedPermissionCount",
                    "unresolvedLimitCount", "unresolvedVersionCount", "unresolvedOwnershipCount", "staleBindingCount",
                    "staleSourceReferenceCount", "unresolvedQuestionCount", "catalogState", "permissionModelState",
                    "limitCatalogState", "versionCatalogState", "reviewState", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "figma-mcp-capability-discovery-status") != "figma-mcp-capability-discovery-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", FigmaMcpCapabilityDiscoveryStatusAuthorityBoundary) != FigmaMcpCapabilityDiscoveryStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var toolCount = ParseBoundedNonNegativeInt(status, "toolCount", 16_384);
        var advertisedToolCount = ParseBoundedNonNegativeInt(status, "advertisedToolCount", 16_384);
        var unavailableToolCount = ParseBoundedNonNegativeInt(status, "unavailableToolCount", 16_384);
        var unknownAvailabilityCount = ParseBoundedNonNegativeInt(status, "unknownAvailabilityCount", 16_384);
        var readToolCount = ParseBoundedNonNegativeInt(status, "readToolCount", 16_384);
        var writeToolCount = ParseBoundedNonNegativeInt(status, "writeToolCount", 16_384);
        var unknownEffectCount = ParseBoundedNonNegativeInt(status, "unknownEffectCount", 16_384);
        var notAssessedToolCount = ParseBoundedNonNegativeInt(status, "notAssessedToolCount", 16_384);
        var sourceRecordedToolCount = ParseBoundedNonNegativeInt(status, "sourceRecordedToolCount", 16_384);
        var humanReviewedToolCount = ParseBoundedNonNegativeInt(status, "humanReviewedToolCount", 16_384);
        var unresolvedPermissionCount = ParseBoundedNonNegativeInt(status, "unresolvedPermissionCount", 65_536);
        var unresolvedLimitCount = ParseBoundedNonNegativeInt(status, "unresolvedLimitCount", 65_536);
        var unresolvedVersionCount = ParseBoundedNonNegativeInt(status, "unresolvedVersionCount", 16_386);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var catalogState = ParseRequiredEnum(status, "catalogState", "candidate-observation-complete", "not-assessed");
        var permissionModelState = ParseRequiredEnum(status, "permissionModelState", "candidate-separated", "contradicted", "not-assessed");
        var limitCatalogState = ParseRequiredEnum(status, "limitCatalogState", "candidate-complete", "not-assessed");
        var versionCatalogState = ParseRequiredEnum(status, "versionCatalogState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unknownAvailabilityCount + unknownEffectCount + notAssessedToolCount + sourceRecordedToolCount +
            unresolvedPermissionCount + unresolvedLimitCount + unresolvedVersionCount + unresolvedOwnershipCount +
            staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || toolCount == 0 || catalogState != "candidate-observation-complete" ||
                    permissionModelState != "candidate-separated" || limitCatalogState != "candidate-complete" ||
                    versionCatalogState != "candidate-complete" || reviewState != "ready-for-human-review" ||
                    reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        FigmaMcpCapabilityDiscoveryRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "toolCount", "advertisedToolCount",
                    "readToolCount", "writeToolCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new FigmaMcpCapabilityDiscoveryRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "toolCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "advertisedToolCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "readToolCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "writeToolCount", 16_384),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.ToolCount ?? 0) != toolCount ||
            (candidate?.AdvertisedToolCount ?? 0) != advertisedToolCount ||
            (candidate?.ReadToolCount ?? 0) != readToolCount ||
            (candidate?.WriteToolCount ?? 0) != writeToolCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new FigmaMcpCapabilityDiscoveryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, catalogState, permissionModelState, limitCatalogState,
            versionCatalogState, Array.AsReadOnly(reasons), toolCount, advertisedToolCount, unavailableToolCount,
            unknownAvailabilityCount, readToolCount, writeToolCount, unknownEffectCount, notAssessedToolCount,
            sourceRecordedToolCount, humanReviewedToolCount, unresolvedPermissionCount, unresolvedLimitCount,
            unresolvedVersionCount, unresolvedOwnershipCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
