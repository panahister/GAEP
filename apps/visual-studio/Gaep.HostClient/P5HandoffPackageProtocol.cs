using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string P5HandoffProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations";
    private const string P5HandoffProjectionAuthorityBoundary =
        "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority";
    private const string P5HandoffStatusAuthorityBoundary =
        "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority";
    private const string P5HandoffBoundary =
        "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority";

    internal static P5HandoffPackageProjection ParseP5HandoffPackageResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["handoff"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "p5-handoff-package-projection") != "p5-handoff-package-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", P5HandoffProjectionPrivacyBoundary) != P5HandoffProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", P5HandoffProjectionAuthorityBoundary) != P5HandoffProjectionAuthorityBoundary)
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
                    "itemCount", "includedItemCount", "referenceOnlyItemCount", "omittedNotApplicableItemCount",
                    "unresolvedItemCount", "staleOrUnknownItemCount", "lossyTransformationCount",
                    "unresolvedRequirementCount", "conflictCount", "unresolvedQuestionCount", "staleBindingCount",
                    "staleSourceReferenceCount", "readinessResult", "transferState", "state", "reasons", "assessedAt",
                    "handoffBoundary", "authorityBoundary",
                ],
                ["handoff"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "p5-handoff-package-status") != "p5-handoff-package-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "handoffBoundary", P5HandoffBoundary) != P5HandoffBoundary ||
            ParseRequiredEnum(status, "authorityBoundary", P5HandoffStatusAuthorityBoundary) != P5HandoffStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "handoff");
        var itemCount = ParseBoundedNonNegativeInt(status, "itemCount", 25);
        var includedItemCount = ParseBoundedNonNegativeInt(status, "includedItemCount", 25);
        var referenceOnlyItemCount = ParseBoundedNonNegativeInt(status, "referenceOnlyItemCount", 25);
        var omittedNotApplicableItemCount = ParseBoundedNonNegativeInt(status, "omittedNotApplicableItemCount", 25);
        var unresolvedItemCount = ParseBoundedNonNegativeInt(status, "unresolvedItemCount", 25);
        var staleOrUnknownItemCount = ParseBoundedNonNegativeInt(status, "staleOrUnknownItemCount", 25);
        var lossyTransformationCount = ParseBoundedNonNegativeInt(status, "lossyTransformationCount", 25);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 66);
        var conflictCount = ParseBoundedNonNegativeInt(status, "conflictCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        if (includedItemCount + referenceOnlyItemCount + omittedNotApplicableItemCount + unresolvedItemCount != itemCount)
        {
            throw InvalidResponse();
        }
        var readinessResult = ParseRequiredEnum(
            status, "readinessResult", "blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed");
        var transferState = ParseRequiredEnum(status, "transferState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedItemCount + staleOrUnknownItemCount + unresolvedRequirementCount + conflictCount +
            unresolvedQuestionCount + staleBindingCount + staleSourceReferenceCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || readinessResult != "passed" || transferState != "ready-for-human-review" || reasons.Length > 0)) ||
            (assessmentState == "attention-required" && reasons.Length == 0) ||
            (reference is null && assessmentState != "attention-required"))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        P5HandoffPackageRecordView? handoff = null;
        if (projection.TryGetProperty("handoff", out var handoffElement))
        {
            if (!HasOnlyProperties(
                    handoffElement,
                    "id", "revision", "digest", "membershipDigest", "state", "readinessStatusDigest",
                    "itemCount", "requirementCount", "deliveryMode", "updatedAt") ||
                ParseRequiredEnum(handoffElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(handoffElement, "id");
            var revision = ParsePositiveLong(handoffElement, "revision");
            var digest = ParseRequiredDigest(handoffElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            handoff = new P5HandoffPackageRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(handoffElement, "membershipDigest"),
                ParseRequiredDigest(handoffElement, "readinessStatusDigest"),
                ParseBoundedNonNegativeInt(handoffElement, "itemCount", 25),
                ParseBoundedNonNegativeInt(handoffElement, "requirementCount", 66),
                ParseRequiredEnum(handoffElement, "deliveryMode", "disconnected", "governed-figma", "repository"));
            ParseRequiredTimestamp(handoffElement, "updatedAt");
        }
        if ((reference is null) != (handoff is null) ||
            (handoff?.ItemCount ?? 0) != itemCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new P5HandoffPackageProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, readinessResult, transferState, Array.AsReadOnly(reasons), itemCount,
            includedItemCount, referenceOnlyItemCount, omittedNotApplicableItemCount, unresolvedItemCount,
            staleOrUnknownItemCount, lossyTransformationCount, unresolvedRequirementCount, conflictCount,
            unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, P5HandoffBoundary, handoff,
            snapshotDigest);
    }
}
