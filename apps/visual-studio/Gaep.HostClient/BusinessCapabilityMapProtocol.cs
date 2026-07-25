using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string CapabilityMapProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials";
    private const string CapabilityMapProjectionAuthorityBoundary =
        "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action";
    private const string CapabilityMapAssessmentAuthorityBoundary =
        "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action";

    internal static BusinessCapabilityMapProjection ParseBusinessCapabilityMapResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                [
                    "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                    "privacyBoundary", "authorityBoundary", "snapshotDigest",
                ],
                ["capabilityMap"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "business-capability-map-projection") !=
                "business-capability-map-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", CapabilityMapProjectionPrivacyBoundary) !=
                CapabilityMapProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", CapabilityMapProjectionAuthorityBoundary) !=
                CapabilityMapProjectionAuthorityBoundary)
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
        var initiativeState = ParseRequiredEnum(
            initiative,
            "state",
            "proposed",
            "active",
            "blocked",
            "completed",
            "cancelled");

        var assessment = projection.GetProperty("assessment");
        if (!HasRequiredAndAllowedProperties(
                assessment,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "capabilityCount", "ownedCapabilityCount", "unownedCapabilityCount", "objectiveCoverageCount",
                    "outcomeCoverageCount", "openGapCount", "criticalGapCount", "unknownCurrentMaturityCount",
                    "unassessedPriorityCount", "staleBindingCount", "staleSourceReferenceCount", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["capabilityMap"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "business-capability-map-assessment") !=
                "business-capability-map-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(assessment, "authorityBoundary", CapabilityMapAssessmentAuthorityBoundary) !=
                CapabilityMapAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "capabilityMap");
        var capabilityCount = ParseBoundedNonNegativeInt(assessment, "capabilityCount", 512);
        var ownedCapabilityCount = ParseBoundedNonNegativeInt(assessment, "ownedCapabilityCount", capabilityCount);
        var unownedCapabilityCount = ParseBoundedNonNegativeInt(assessment, "unownedCapabilityCount", capabilityCount);
        var objectiveCoverageCount = ParseBoundedNonNegativeInt(assessment, "objectiveCoverageCount", 256);
        var outcomeCoverageCount = ParseBoundedNonNegativeInt(assessment, "outcomeCoverageCount", 256);
        var openGapCount = ParseBoundedNonNegativeInt(assessment, "openGapCount", 131_072);
        var criticalGapCount = ParseBoundedNonNegativeInt(assessment, "criticalGapCount", openGapCount);
        var unknownCurrentMaturityCount =
            ParseBoundedNonNegativeInt(assessment, "unknownCurrentMaturityCount", capabilityCount);
        var unassessedPriorityCount =
            ParseBoundedNonNegativeInt(assessment, "unassessedPriorityCount", capabilityCount);
        var staleBindingCount = ParseBoundedNonNegativeInt(assessment, "staleBindingCount", 4);
        var staleSourceReferenceCount =
            ParseBoundedNonNegativeInt(assessment, "staleSourceReferenceCount", 131_072);
        if (ownedCapabilityCount + unownedCapabilityCount != capabilityCount) throw InvalidResponse();
        var assessmentState = ParseRequiredEnum(
            assessment,
            "state",
            "complete-for-review",
            "attention-required");
        var reasonsElement = assessment.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512)
        {
            throw InvalidResponse();
        }
        var reasons = reasonsElement.EnumerateArray()
            .Select(value => ParseSourceText(value, 2, 2_000))
            .ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(assessment, "assessedAt");

        BusinessCapabilityMapRecordView? map = null;
        if (projection.TryGetProperty("capabilityMap", out var mapElement))
        {
            if (!HasOnlyProperties(
                    mapElement,
                    "id", "revision", "digest", "state", "capabilityCount", "ownedCapabilityCount",
                    "openGapCount", "criticalGapCount", "candidatePriorityCount", "updatedAt") ||
                ParseRequiredEnum(mapElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(mapElement, "id");
            var revision = ParsePositiveLong(mapElement, "revision");
            var digest = ParseRequiredDigest(mapElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            var mapCapabilityCount = ParseBoundedNonNegativeInt(mapElement, "capabilityCount", 512);
            var mapOwnedCount = ParseBoundedNonNegativeInt(mapElement, "ownedCapabilityCount", mapCapabilityCount);
            var mapOpenGapCount = ParseBoundedNonNegativeInt(mapElement, "openGapCount", 131_072);
            var mapCriticalGapCount = ParseBoundedNonNegativeInt(mapElement, "criticalGapCount", mapOpenGapCount);
            var candidatePriorityCount =
                ParseBoundedNonNegativeInt(mapElement, "candidatePriorityCount", mapCapabilityCount);
            ParseRequiredTimestamp(mapElement, "updatedAt");
            map = new BusinessCapabilityMapRecordView(
                id,
                revision,
                digest,
                mapCapabilityCount,
                mapOwnedCount,
                mapOpenGapCount,
                mapCriticalGapCount,
                candidatePriorityCount);
        }
        if ((reference is null) != (map is null) ||
            (map?.CapabilityCount ?? 0) != capabilityCount ||
            (map?.OwnedCapabilityCount ?? 0) != ownedCapabilityCount ||
            (map?.OpenGapCount ?? 0) != openGapCount ||
            (map?.CriticalGapCount ?? 0) != criticalGapCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BusinessCapabilityMapProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            capabilityCount,
            ownedCapabilityCount,
            unownedCapabilityCount,
            objectiveCoverageCount,
            outcomeCoverageCount,
            openGapCount,
            criticalGapCount,
            unknownCurrentMaturityCount,
            unassessedPriorityCount,
            staleBindingCount,
            staleSourceReferenceCount,
            map,
            snapshotDigest);
    }
}
