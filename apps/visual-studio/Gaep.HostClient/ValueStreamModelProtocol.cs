using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ValueStreamProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials";
    private const string ValueStreamProjectionAuthorityBoundary =
        "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action";
    private const string ValueStreamAssessmentAuthorityBoundary =
        "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action";

    internal static ValueStreamModelProjection ParseValueStreamModelResponse(
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
                ["valueStreamModel"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "value-stream-model-projection") != "value-stream-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ValueStreamProjectionPrivacyBoundary) !=
                ValueStreamProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ValueStreamProjectionAuthorityBoundary) !=
                ValueStreamProjectionAuthorityBoundary)
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
                    "valueStreamCount", "ownedValueStreamCount", "unownedValueStreamCount", "stageCount",
                    "dependencyCount", "capabilityCoverageCount", "outcomeCoverageCount", "absentFlowEvidenceCount",
                    "openBottleneckCount", "criticalBottleneckCount", "staleBindingCount",
                    "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["valueStreamModel"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "value-stream-model-assessment") !=
                "value-stream-model-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(assessment, "authorityBoundary", ValueStreamAssessmentAuthorityBoundary) !=
                ValueStreamAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "valueStreamModel");
        var valueStreamCount = ParseBoundedNonNegativeInt(assessment, "valueStreamCount", 256);
        var ownedValueStreamCount =
            ParseBoundedNonNegativeInt(assessment, "ownedValueStreamCount", valueStreamCount);
        var unownedValueStreamCount =
            ParseBoundedNonNegativeInt(assessment, "unownedValueStreamCount", valueStreamCount);
        var stageCount = ParseBoundedNonNegativeInt(assessment, "stageCount", 131_072);
        var dependencyCount = ParseBoundedNonNegativeInt(assessment, "dependencyCount", 65_536);
        var capabilityCoverageCount = ParseBoundedNonNegativeInt(assessment, "capabilityCoverageCount", 512);
        var outcomeCoverageCount = ParseBoundedNonNegativeInt(assessment, "outcomeCoverageCount", 512);
        var absentFlowEvidenceCount =
            ParseBoundedNonNegativeInt(assessment, "absentFlowEvidenceCount", stageCount);
        var openBottleneckCount = ParseBoundedNonNegativeInt(assessment, "openBottleneckCount", 131_072);
        var criticalBottleneckCount =
            ParseBoundedNonNegativeInt(assessment, "criticalBottleneckCount", openBottleneckCount);
        var staleBindingCount = ParseBoundedNonNegativeInt(assessment, "staleBindingCount", 5);
        var staleSourceReferenceCount =
            ParseBoundedNonNegativeInt(assessment, "staleSourceReferenceCount", 131_072);
        if (ownedValueStreamCount + unownedValueStreamCount != valueStreamCount) throw InvalidResponse();
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

        ValueStreamModelRecordView? model = null;
        if (projection.TryGetProperty("valueStreamModel", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "state", "valueStreamCount", "ownedValueStreamCount",
                    "stageCount", "dependencyCount", "openBottleneckCount", "criticalBottleneckCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            var modelValueStreamCount = ParseBoundedNonNegativeInt(modelElement, "valueStreamCount", 256);
            var modelOwnedCount =
                ParseBoundedNonNegativeInt(modelElement, "ownedValueStreamCount", modelValueStreamCount);
            var modelStageCount = ParseBoundedNonNegativeInt(modelElement, "stageCount", 131_072);
            var modelDependencyCount = ParseBoundedNonNegativeInt(modelElement, "dependencyCount", 65_536);
            var modelOpenCount = ParseBoundedNonNegativeInt(modelElement, "openBottleneckCount", 131_072);
            var modelCriticalCount =
                ParseBoundedNonNegativeInt(modelElement, "criticalBottleneckCount", modelOpenCount);
            ParseRequiredTimestamp(modelElement, "updatedAt");
            model = new ValueStreamModelRecordView(
                id,
                revision,
                digest,
                modelValueStreamCount,
                modelOwnedCount,
                modelStageCount,
                modelDependencyCount,
                modelOpenCount,
                modelCriticalCount);
        }
        if ((reference is null) != (model is null) ||
            (model?.ValueStreamCount ?? 0) != valueStreamCount ||
            (model?.OwnedValueStreamCount ?? 0) != ownedValueStreamCount ||
            (model?.StageCount ?? 0) != stageCount ||
            (model?.DependencyCount ?? 0) != dependencyCount ||
            (model?.OpenBottleneckCount ?? 0) != openBottleneckCount ||
            (model?.CriticalBottleneckCount ?? 0) != criticalBottleneckCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ValueStreamModelProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            valueStreamCount,
            ownedValueStreamCount,
            unownedValueStreamCount,
            stageCount,
            dependencyCount,
            capabilityCoverageCount,
            outcomeCoverageCount,
            absentFlowEvidenceCount,
            openBottleneckCount,
            criticalBottleneckCount,
            staleBindingCount,
            staleSourceReferenceCount,
            model,
            snapshotDigest);
    }
}
