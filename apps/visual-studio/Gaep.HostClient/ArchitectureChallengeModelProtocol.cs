using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ArchitectureChallengeProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials";
    private const string ArchitectureChallengeProjectionAuthorityBoundary =
        "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action";
    private const string ArchitectureChallengeStatusAuthorityBoundary =
        "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action";

    internal static ArchitectureChallengeModelProjection ParseArchitectureChallengeModelResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "architecture-challenge-model-projection") != "architecture-challenge-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ArchitectureChallengeProjectionPrivacyBoundary) != ArchitectureChallengeProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ArchitectureChallengeProjectionAuthorityBoundary) != ArchitectureChallengeProjectionAuthorityBoundary)
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
                    "challengeSubjectCount", "assumptionCount", "alternativeCount", "findingCount", "responseCount",
                    "unrespondedFindingCount", "unresolvedAssumptionCount", "unresolvedRequirementCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "architecture-challenge-model-status") != "architecture-challenge-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ArchitectureChallengeStatusAuthorityBoundary) != ArchitectureChallengeStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "model");
        var challengeSubjectCount = ParseBoundedNonNegativeInt(status, "challengeSubjectCount", 4_096);
        var assumptionCount = ParseBoundedNonNegativeInt(status, "assumptionCount", 4_096);
        var alternativeCount = ParseBoundedNonNegativeInt(status, "alternativeCount", 4_096);
        var findingCount = ParseBoundedNonNegativeInt(status, "findingCount", 8_192);
        var responseCount = ParseBoundedNonNegativeInt(status, "responseCount", 8_192);
        var unrespondedFindingCount = ParseBoundedNonNegativeInt(status, "unrespondedFindingCount", 8_192);
        var unresolvedAssumptionCount = ParseBoundedNonNegativeInt(status, "unresolvedAssumptionCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 36);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var assessmentState = ParseRequiredEnum(status, "state", "complete-for-review", "attention-required");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        ArchitectureChallengeModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "challengeSubjectCount",
                    "assumptionCount", "alternativeCount", "findingCount", "responseCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new ArchitectureChallengeModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "challengeSubjectCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "assumptionCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "alternativeCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "findingCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "responseCount", 8_192));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.ChallengeSubjectCount ?? 0) != challengeSubjectCount ||
            (model?.AssumptionCount ?? 0) != assumptionCount ||
            (model?.AlternativeCount ?? 0) != alternativeCount ||
            (model?.FindingCount ?? 0) != findingCount ||
            (model?.ResponseCount ?? 0) != responseCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ArchitectureChallengeModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), challengeSubjectCount, assumptionCount,
            alternativeCount, findingCount, responseCount, unrespondedFindingCount, unresolvedAssumptionCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest);
    }
}
