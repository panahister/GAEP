using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DataModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials";
    private const string DataModelProjectionAuthorityBoundary =
        "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action";
    private const string DataModelStatusAuthorityBoundary =
        "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action";

    internal static DataModelProjection ParseDataModelResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "data-model-projection") != "data-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DataModelProjectionPrivacyBoundary) != DataModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DataModelProjectionAuthorityBoundary) != DataModelProjectionAuthorityBoundary)
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
                    "entityCount", "attributeCount", "relationshipCount", "lifecycleCount", "transformationCount",
                    "uncoveredBoundedContextCount", "uncoveredSecurityDataClassCount", "uncoveredProcessCount",
                    "unresolvedSystemOfRecordCount", "unresolvedTransformationCount", "unresolvedRequirementCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "data-model-status") != "data-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DataModelStatusAuthorityBoundary) != DataModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "model");
        var entityCount = ParseBoundedNonNegativeInt(status, "entityCount", 2_048);
        var attributeCount = ParseBoundedNonNegativeInt(status, "attributeCount", 131_072);
        var relationshipCount = ParseBoundedNonNegativeInt(status, "relationshipCount", 8_192);
        var lifecycleCount = ParseBoundedNonNegativeInt(status, "lifecycleCount", 2_048);
        var transformationCount = ParseBoundedNonNegativeInt(status, "transformationCount", 4_096);
        var uncoveredBoundedContextCount = ParseBoundedNonNegativeInt(status, "uncoveredBoundedContextCount", 2_048);
        var uncoveredSecurityDataClassCount = ParseBoundedNonNegativeInt(status, "uncoveredSecurityDataClassCount", 2_048);
        var uncoveredProcessCount = ParseBoundedNonNegativeInt(status, "uncoveredProcessCount", 512);
        var unresolvedSystemOfRecordCount = ParseBoundedNonNegativeInt(status, "unresolvedSystemOfRecordCount", 2_048);
        var unresolvedTransformationCount = ParseBoundedNonNegativeInt(status, "unresolvedTransformationCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 14);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 16);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var assessmentState = ParseRequiredEnum(status, "state", "complete-for-review", "attention-required");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DataModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "entityCount", "relationshipCount",
                    "lifecycleCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new DataModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "entityCount", 2_048),
                ParseBoundedNonNegativeInt(modelElement, "relationshipCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "lifecycleCount", 2_048));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.EntityCount ?? 0) != entityCount ||
            (model?.RelationshipCount ?? 0) != relationshipCount ||
            (model?.LifecycleCount ?? 0) != lifecycleCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DataModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), entityCount, attributeCount,
            relationshipCount, lifecycleCount, transformationCount, uncoveredBoundedContextCount,
            uncoveredSecurityDataClassCount, uncoveredProcessCount, unresolvedSystemOfRecordCount,
            unresolvedTransformationCount, unresolvedRequirementCount, inconsistencyCount,
            unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, model, snapshotDigest);
    }
}
