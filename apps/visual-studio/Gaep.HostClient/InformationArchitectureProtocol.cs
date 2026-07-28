using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string InformationArchitectureProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials";
    private const string InformationArchitectureProjectionAuthorityBoundary =
        "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action";
    private const string InformationArchitectureStatusAuthorityBoundary =
        "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action";

    internal static InformationArchitectureProjection ParseInformationArchitectureResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "information-architecture-model-projection") != "information-architecture-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", InformationArchitectureProjectionPrivacyBoundary) != InformationArchitectureProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", InformationArchitectureProjectionAuthorityBoundary) != InformationArchitectureProjectionAuthorityBoundary)
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
                    "nodeCount", "rootNodeCount", "routeCount", "representedScopeCount", "unresolvedScopeCount",
                    "weakEvidenceNodeCount", "weakEvidenceRouteCount", "staleBindingCount", "staleSourceReferenceCount",
                    "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "information-architecture-model-status") != "information-architecture-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", InformationArchitectureStatusAuthorityBoundary) != InformationArchitectureStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var nodeCount = ParseBoundedNonNegativeInt(status, "nodeCount", 2_048);
        var rootNodeCount = ParseBoundedNonNegativeInt(status, "rootNodeCount", 2_048);
        var routeCount = ParseBoundedNonNegativeInt(status, "routeCount", 2_048);
        if (rootNodeCount > nodeCount) throw InvalidResponse();
        var representedScopeCount = ParseBoundedNonNegativeInt(status, "representedScopeCount", 1_024);
        var unresolvedScopeCount = ParseBoundedNonNegativeInt(status, "unresolvedScopeCount", 1_024);
        var weakEvidenceNodeCount = ParseBoundedNonNegativeInt(status, "weakEvidenceNodeCount", 2_048);
        var weakEvidenceRouteCount = ParseBoundedNonNegativeInt(status, "weakEvidenceRouteCount", 2_048);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedScopeCount + weakEvidenceNodeCount + weakEvidenceRouteCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        InformationArchitectureRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "nodeCount", "rootNodeCount",
                    "routeCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new InformationArchitectureRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "nodeCount", 2_048),
                ParseBoundedNonNegativeInt(candidateElement, "rootNodeCount", 2_048),
                ParseBoundedNonNegativeInt(candidateElement, "routeCount", 2_048),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.NodeCount ?? 0) != nodeCount ||
            (candidate?.RootNodeCount ?? 0) != rootNodeCount ||
            (candidate?.RouteCount ?? 0) != routeCount ||
            (candidate is not null && (candidate.RootNodeCount > candidate.NodeCount || candidate.ReviewState != reviewState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new InformationArchitectureProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, Array.AsReadOnly(reasons), nodeCount, rootNodeCount,
            routeCount, representedScopeCount, unresolvedScopeCount, weakEvidenceNodeCount, weakEvidenceRouteCount,
            staleBindingCount, staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
