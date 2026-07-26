using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string OperatingModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials";
    private const string OperatingModelProjectionAuthorityBoundary =
        "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action";
    private const string OperatingModelAssessmentAuthorityBoundary =
        "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action";

    internal static OperatingModelProjection ParseOperatingModelResponse(
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
                ["operatingModel"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "operating-model-projection") != "operating-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", OperatingModelProjectionPrivacyBoundary) !=
                OperatingModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", OperatingModelProjectionAuthorityBoundary) !=
                OperatingModelProjectionAuthorityBoundary)
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
                    "roleCount", "governanceSystemCount", "unassignedAppointingAuthorityCount",
                    "insufficientCapacityCount", "unfundedCapacityCount", "decisionRightCount",
                    "unassignedDecisionAuthorityCount", "forumCount", "cycleCount", "supportCapacityGapCount",
                    "emergencyAuthorityGapCount", "staleBindingCount", "staleSourceReferenceCount", "state",
                    "reasons", "assessedAt", "authorityBoundary",
                ],
                ["operatingModel"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "operating-model-assessment") != "operating-model-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(assessment, "authorityBoundary", OperatingModelAssessmentAuthorityBoundary) !=
                OperatingModelAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "operatingModel");
        var roleCount = ParseBoundedNonNegativeInt(assessment, "roleCount", 256);
        var governanceSystemCount = ParseBoundedNonNegativeInt(assessment, "governanceSystemCount", 2);
        var unassignedAppointingAuthorityCount =
            ParseBoundedNonNegativeInt(assessment, "unassignedAppointingAuthorityCount", roleCount);
        var insufficientCapacityCount =
            ParseBoundedNonNegativeInt(assessment, "insufficientCapacityCount", roleCount);
        var unfundedCapacityCount = ParseBoundedNonNegativeInt(assessment, "unfundedCapacityCount", roleCount);
        var decisionRightCount = ParseBoundedNonNegativeInt(assessment, "decisionRightCount", 512);
        var unassignedDecisionAuthorityCount =
            ParseBoundedNonNegativeInt(assessment, "unassignedDecisionAuthorityCount", decisionRightCount);
        var forumCount = ParseBoundedNonNegativeInt(assessment, "forumCount", 128);
        var cycleCount = ParseBoundedNonNegativeInt(assessment, "cycleCount", 128);
        var supportCapacityGapCount = ParseBoundedNonNegativeInt(assessment, "supportCapacityGapCount", 1);
        var emergencyAuthorityGapCount = ParseBoundedNonNegativeInt(assessment, "emergencyAuthorityGapCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(assessment, "staleBindingCount", 6);
        var staleSourceReferenceCount =
            ParseBoundedNonNegativeInt(assessment, "staleSourceReferenceCount", 131_072);
        var assessmentState = ParseRequiredEnum(assessment, "state", "complete-for-review", "attention-required");
        var reasonsElement = assessment.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512)
        {
            throw InvalidResponse();
        }
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(assessment, "assessedAt");

        OperatingModelRecordView? model = null;
        if (projection.TryGetProperty("operatingModel", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "state", "roleCount", "decisionRightCount", "forumCount",
                    "cycleCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new OperatingModelRecordView(
                id,
                revision,
                digest,
                ParseBoundedNonNegativeInt(modelElement, "roleCount", 256),
                ParseBoundedNonNegativeInt(modelElement, "decisionRightCount", 512),
                ParseBoundedNonNegativeInt(modelElement, "forumCount", 128),
                ParseBoundedNonNegativeInt(modelElement, "cycleCount", 128));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.RoleCount ?? 0) != roleCount ||
            (model?.DecisionRightCount ?? 0) != decisionRightCount ||
            (model?.ForumCount ?? 0) != forumCount ||
            (model?.CycleCount ?? 0) != cycleCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new OperatingModelProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            roleCount,
            governanceSystemCount,
            unassignedAppointingAuthorityCount,
            insufficientCapacityCount,
            unfundedCapacityCount,
            decisionRightCount,
            unassignedDecisionAuthorityCount,
            forumCount,
            cycleCount,
            supportCapacityGapCount,
            emergencyAuthorityGapCount,
            staleBindingCount,
            staleSourceReferenceCount,
            model,
            snapshotDigest);
    }
}
