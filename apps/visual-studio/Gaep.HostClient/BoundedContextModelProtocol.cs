using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BoundedContextModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials";
    private const string BoundedContextModelProjectionAuthorityBoundary =
        "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action";
    private const string BoundedContextModelAssessmentAuthorityBoundary =
        "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action";

    internal static BoundedContextModelProjection ParseBoundedContextModelResponse(
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
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "bounded-context-ownership-projection") !=
                "bounded-context-ownership-projection" ||
            ParseRequiredEnum(
                projection,
                "privacyBoundary",
                BoundedContextModelProjectionPrivacyBoundary) !=
                BoundedContextModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(
                projection,
                "authorityBoundary",
                BoundedContextModelProjectionAuthorityBoundary) !=
                BoundedContextModelProjectionAuthorityBoundary)
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
                    "boundedContextCount", "coreContextCount", "languageTermCount", "contractCount",
                    "unresolvedContractCount", "relationshipCount", "unresolvedRelationshipCount",
                    "unassignedArchitectureElementCount", "unownedDataAssetCount", "unmappedCrossContextRelationCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "bounded-context-ownership-assessment") !=
                "bounded-context-ownership-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(
                assessment,
                "authorityBoundary",
                BoundedContextModelAssessmentAuthorityBoundary) !=
                BoundedContextModelAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "model");
        var boundedContextCount = ParseBoundedNonNegativeInt(assessment, "boundedContextCount", 1_024);
        var coreContextCount = ParseBoundedNonNegativeInt(assessment, "coreContextCount", boundedContextCount);
        var languageTermCount = ParseBoundedNonNegativeInt(assessment, "languageTermCount", 1_048_576);
        var contractCount = ParseBoundedNonNegativeInt(assessment, "contractCount", 4_096);
        var unresolvedContractCount = ParseBoundedNonNegativeInt(
            assessment,
            "unresolvedContractCount",
            contractCount);
        var relationshipCount = ParseBoundedNonNegativeInt(assessment, "relationshipCount", 4_096);
        var unresolvedRelationshipCount = ParseBoundedNonNegativeInt(
            assessment,
            "unresolvedRelationshipCount",
            relationshipCount);
        var unassignedArchitectureElementCount = ParseBoundedNonNegativeInt(
            assessment,
            "unassignedArchitectureElementCount",
            2_048);
        var unownedDataAssetCount = ParseBoundedNonNegativeInt(assessment, "unownedDataAssetCount", 2_048);
        var unmappedCrossContextRelationCount = ParseBoundedNonNegativeInt(
            assessment,
            "unmappedCrossContextRelationCount",
            4_096);
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

        BoundedContextModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "boundedContextCount",
                    "contractCount", "relationshipCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new BoundedContextModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "boundedContextCount", 1_024),
                ParseBoundedNonNegativeInt(modelElement, "contractCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "relationshipCount", 4_096));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.BoundedContextCount ?? 0) != boundedContextCount ||
            (model?.ContractCount ?? 0) != contractCount ||
            (model?.RelationshipCount ?? 0) != relationshipCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BoundedContextModelProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            boundedContextCount,
            coreContextCount,
            languageTermCount,
            contractCount,
            unresolvedContractCount,
            relationshipCount,
            unresolvedRelationshipCount,
            unassignedArchitectureElementCount,
            unownedDataAssetCount,
            unmappedCrossContextRelationCount,
            inconsistencyCount,
            unresolvedQuestionCount,
            staleBindingCount,
            staleSourceReferenceCount,
            model,
            snapshotDigest);
    }
}
