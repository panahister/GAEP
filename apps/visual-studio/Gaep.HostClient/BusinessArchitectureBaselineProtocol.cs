using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BusinessArchitectureBaselineProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials";
    private const string BusinessArchitectureBaselineProjectionAuthorityBoundary =
        "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action";
    private const string BusinessArchitectureBaselineAssessmentAuthorityBoundary =
        "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action";

    internal static BusinessArchitectureBaselineProjection ParseBusinessArchitectureBaselineResponse(
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
                ["baseline"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "business-architecture-baseline-projection") !=
                "business-architecture-baseline-projection" ||
            ParseRequiredEnum(
                projection,
                "privacyBoundary",
                BusinessArchitectureBaselineProjectionPrivacyBoundary) !=
                BusinessArchitectureBaselineProjectionPrivacyBoundary ||
            ParseRequiredEnum(
                projection,
                "authorityBoundary",
                BusinessArchitectureBaselineProjectionAuthorityBoundary) !=
                BusinessArchitectureBaselineProjectionAuthorityBoundary)
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
                    "coveredElementCount", "includedElementCount", "excludedElementCount", "unresolvedElementCount",
                    "integrationClaimCount", "consistencyCheckCount", "consistencyGapCount", "staleBindingCount",
                    "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["baseline"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "business-architecture-baseline-assessment") !=
                "business-architecture-baseline-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(
                assessment,
                "authorityBoundary",
                BusinessArchitectureBaselineAssessmentAuthorityBoundary) !=
                BusinessArchitectureBaselineAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "baseline");
        var coveredElementCount = ParseBoundedNonNegativeInt(assessment, "coveredElementCount", 4_096);
        var includedElementCount = ParseBoundedNonNegativeInt(assessment, "includedElementCount", coveredElementCount);
        var excludedElementCount = ParseBoundedNonNegativeInt(assessment, "excludedElementCount", coveredElementCount);
        var unresolvedElementCount = ParseBoundedNonNegativeInt(assessment, "unresolvedElementCount", coveredElementCount);
        if (includedElementCount + excludedElementCount + unresolvedElementCount != coveredElementCount)
        {
            throw InvalidResponse();
        }
        var integrationClaimCount = ParseBoundedNonNegativeInt(assessment, "integrationClaimCount", 2_048);
        var consistencyCheckCount = ParseBoundedNonNegativeInt(assessment, "consistencyCheckCount", 6);
        var consistencyGapCount = ParseBoundedNonNegativeInt(
            assessment,
            "consistencyGapCount",
            consistencyCheckCount);
        var staleBindingCount = ParseBoundedNonNegativeInt(assessment, "staleBindingCount", 16);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(
            assessment,
            "staleSourceReferenceCount",
            131_072);
        var assessmentState = ParseRequiredEnum(assessment, "state", "complete-for-review", "attention-required");
        var reasonsElement = assessment.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512)
        {
            throw InvalidResponse();
        }
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(assessment, "assessedAt");

        BusinessArchitectureBaselineRecordView? baseline = null;
        if (projection.TryGetProperty("baseline", out var baselineElement))
        {
            if (!HasOnlyProperties(
                    baselineElement,
                    "id", "revision", "digest", "membershipDigest", "state", "coveredElementCount",
                    "integrationClaimCount", "consistencyGapCount", "updatedAt") ||
                ParseRequiredEnum(baselineElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(baselineElement, "id");
            var revision = ParsePositiveLong(baselineElement, "revision");
            var digest = ParseRequiredDigest(baselineElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            baseline = new BusinessArchitectureBaselineRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(baselineElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(baselineElement, "coveredElementCount", 4_096),
                ParseBoundedNonNegativeInt(baselineElement, "integrationClaimCount", 2_048),
                ParseBoundedNonNegativeInt(baselineElement, "consistencyGapCount", 6));
            ParseRequiredTimestamp(baselineElement, "updatedAt");
        }
        if ((reference is null) != (baseline is null) ||
            (baseline?.CoveredElementCount ?? 0) != coveredElementCount ||
            (baseline?.IntegrationClaimCount ?? 0) != integrationClaimCount ||
            (baseline?.ConsistencyGapCount ?? 0) != consistencyGapCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BusinessArchitectureBaselineProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            coveredElementCount,
            includedElementCount,
            excludedElementCount,
            unresolvedElementCount,
            integrationClaimCount,
            consistencyCheckCount,
            consistencyGapCount,
            staleBindingCount,
            staleSourceReferenceCount,
            baseline,
            snapshotDigest);
    }
}
