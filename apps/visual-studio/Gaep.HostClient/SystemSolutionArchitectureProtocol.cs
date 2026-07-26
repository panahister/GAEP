using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string SystemSolutionArchitectureProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials";
    private const string SystemSolutionArchitectureProjectionAuthorityBoundary =
        "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action";
    private const string SystemSolutionArchitectureAssessmentAuthorityBoundary =
        "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action";

    internal static SystemSolutionArchitectureProjection ParseSystemSolutionArchitectureResponse(
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
                ["architecture"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "system-solution-architecture-projection") !=
                "system-solution-architecture-projection" ||
            ParseRequiredEnum(
                projection,
                "privacyBoundary",
                SystemSolutionArchitectureProjectionPrivacyBoundary) !=
                SystemSolutionArchitectureProjectionPrivacyBoundary ||
            ParseRequiredEnum(
                projection,
                "authorityBoundary",
                SystemSolutionArchitectureProjectionAuthorityBoundary) !=
                SystemSolutionArchitectureProjectionAuthorityBoundary)
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
                    "concernCount", "viewCount", "elementCount", "relationCount", "qualityAttributeCount",
                    "unresolvedQualityAttributeCount", "decisionCount", "unresolvedDecisionCount",
                    "conformanceCriterionCount", "unresolvedConformanceCriterionCount", "lifecycleGapCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["architecture"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "system-solution-architecture-assessment") !=
                "system-solution-architecture-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(
                assessment,
                "authorityBoundary",
                SystemSolutionArchitectureAssessmentAuthorityBoundary) !=
                SystemSolutionArchitectureAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "architecture");
        var concernCount = ParseBoundedNonNegativeInt(assessment, "concernCount", 1_024);
        var viewCount = ParseBoundedNonNegativeInt(assessment, "viewCount", 1_024);
        var elementCount = ParseBoundedNonNegativeInt(assessment, "elementCount", 2_048);
        var relationCount = ParseBoundedNonNegativeInt(assessment, "relationCount", 4_096);
        var qualityAttributeCount = ParseBoundedNonNegativeInt(assessment, "qualityAttributeCount", 1_024);
        var unresolvedQualityAttributeCount = ParseBoundedNonNegativeInt(
            assessment,
            "unresolvedQualityAttributeCount",
            qualityAttributeCount);
        var decisionCount = ParseBoundedNonNegativeInt(assessment, "decisionCount", 1_024);
        var unresolvedDecisionCount = ParseBoundedNonNegativeInt(
            assessment,
            "unresolvedDecisionCount",
            decisionCount);
        var conformanceCriterionCount = ParseBoundedNonNegativeInt(
            assessment,
            "conformanceCriterionCount",
            2_048);
        var unresolvedConformanceCriterionCount = ParseBoundedNonNegativeInt(
            assessment,
            "unresolvedConformanceCriterionCount",
            conformanceCriterionCount);
        var lifecycleGapCount = ParseBoundedNonNegativeInt(assessment, "lifecycleGapCount", 5);
        var inconsistencyCount = ParseBoundedNonNegativeInt(assessment, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(assessment, "unresolvedQuestionCount", 512);
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

        SystemSolutionArchitectureRecordView? architecture = null;
        if (projection.TryGetProperty("architecture", out var architectureElement))
        {
            if (!HasOnlyProperties(
                    architectureElement,
                    "id", "revision", "digest", "membershipDigest", "state", "concernCount", "viewCount",
                    "elementCount", "qualityAttributeCount", "decisionCount", "updatedAt") ||
                ParseRequiredEnum(architectureElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(architectureElement, "id");
            var revision = ParsePositiveLong(architectureElement, "revision");
            var digest = ParseRequiredDigest(architectureElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            architecture = new SystemSolutionArchitectureRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(architectureElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(architectureElement, "concernCount", 1_024),
                ParseBoundedNonNegativeInt(architectureElement, "viewCount", 1_024),
                ParseBoundedNonNegativeInt(architectureElement, "elementCount", 2_048),
                ParseBoundedNonNegativeInt(architectureElement, "qualityAttributeCount", 1_024),
                ParseBoundedNonNegativeInt(architectureElement, "decisionCount", 1_024));
            ParseRequiredTimestamp(architectureElement, "updatedAt");
        }
        if ((reference is null) != (architecture is null) ||
            (architecture?.ConcernCount ?? 0) != concernCount ||
            (architecture?.ViewCount ?? 0) != viewCount ||
            (architecture?.ElementCount ?? 0) != elementCount ||
            (architecture?.QualityAttributeCount ?? 0) != qualityAttributeCount ||
            (architecture?.DecisionCount ?? 0) != decisionCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new SystemSolutionArchitectureProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            concernCount,
            viewCount,
            elementCount,
            relationCount,
            qualityAttributeCount,
            unresolvedQualityAttributeCount,
            decisionCount,
            unresolvedDecisionCount,
            conformanceCriterionCount,
            unresolvedConformanceCriterionCount,
            lifecycleGapCount,
            inconsistencyCount,
            unresolvedQuestionCount,
            staleBindingCount,
            staleSourceReferenceCount,
            architecture,
            snapshotDigest);
    }
}
