using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ScreenStateInventoryProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials";
    private const string ScreenStateInventoryProjectionAuthorityBoundary =
        "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action";
    private const string ScreenStateInventoryStatusAuthorityBoundary =
        "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action";

    internal static ScreenStateInventoryProjection ParseScreenStateInventoryResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "screen-state-inventory-projection") != "screen-state-inventory-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ScreenStateInventoryProjectionPrivacyBoundary) != ScreenStateInventoryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ScreenStateInventoryProjectionAuthorityBoundary) != ScreenStateInventoryProjectionAuthorityBoundary)
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
                    "platformCount", "targetedPlatformCount", "unresolvedPlatformCount", "screenCount", "stateCount",
                    "variantCount", "representedRouteCount", "unresolvedRouteCount", "representedScopeCount",
                    "unresolvedScopeCount", "weakEvidenceItemCount", "staleBindingCount", "staleSourceReferenceCount",
                    "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "screen-state-inventory-status") != "screen-state-inventory-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ScreenStateInventoryStatusAuthorityBoundary) != ScreenStateInventoryStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var platformCount = ParseBoundedNonNegativeInt(status, "platformCount", 128);
        var targetedPlatformCount = ParseBoundedNonNegativeInt(status, "targetedPlatformCount", 128);
        var unresolvedPlatformCount = ParseBoundedNonNegativeInt(status, "unresolvedPlatformCount", 128);
        if (targetedPlatformCount + unresolvedPlatformCount > platformCount) throw InvalidResponse();
        var screenCount = ParseBoundedNonNegativeInt(status, "screenCount", 4_096);
        var stateCount = ParseBoundedNonNegativeInt(status, "stateCount", 16_384);
        var variantCount = ParseBoundedNonNegativeInt(status, "variantCount", 8_192);
        var representedRouteCount = ParseBoundedNonNegativeInt(status, "representedRouteCount", 2_048);
        var unresolvedRouteCount = ParseBoundedNonNegativeInt(status, "unresolvedRouteCount", 2_048);
        var representedScopeCount = ParseBoundedNonNegativeInt(status, "representedScopeCount", 1_024);
        var unresolvedScopeCount = ParseBoundedNonNegativeInt(status, "unresolvedScopeCount", 1_024);
        var weakEvidenceItemCount = ParseBoundedNonNegativeInt(status, "weakEvidenceItemCount", 28_672);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedPlatformCount + unresolvedRouteCount + unresolvedScopeCount + weakEvidenceItemCount +
            staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        ScreenStateInventoryRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "platformCount", "screenCount",
                    "stateCount", "variantCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new ScreenStateInventoryRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "platformCount", 128),
                ParseBoundedNonNegativeInt(candidateElement, "screenCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "stateCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "variantCount", 8_192),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.PlatformCount ?? 0) != platformCount ||
            (candidate?.ScreenCount ?? 0) != screenCount ||
            (candidate?.StateCount ?? 0) != stateCount ||
            (candidate?.VariantCount ?? 0) != variantCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ScreenStateInventoryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, Array.AsReadOnly(reasons), platformCount,
            targetedPlatformCount, unresolvedPlatformCount, screenCount, stateCount, variantCount,
            representedRouteCount, unresolvedRouteCount, representedScopeCount, unresolvedScopeCount,
            weakEvidenceItemCount, staleBindingCount, staleSourceReferenceCount, unresolvedQuestionCount,
            candidate, snapshotDigest);
    }
}
