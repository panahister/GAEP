using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BusinessProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials";
    private const string BusinessProjectionAuthorityBoundary =
        "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action";
    private const string BusinessAssessmentAuthorityBoundary =
        "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action";

    private sealed record BusinessReference(Guid Id, long Revision, string Digest);

    internal static BusinessUnderstandingProjection ParseBusinessUnderstandingResponse(
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
                ["businessUnderstanding", "stakeholderModel", "outcomeModel"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "business-understanding-projection") !=
                "business-understanding-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", BusinessProjectionPrivacyBoundary) !=
                BusinessProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", BusinessProjectionAuthorityBoundary) !=
                BusinessProjectionAuthorityBoundary)
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
                    "stakeholderCount", "representedStakeholderCategoryCount", "unresolvedStakeholderCategoryCount",
                    "verifiedAuthorityCount", "unverifiedAuthorityCount", "outcomeCount", "measureCount",
                    "observedBaselineCount", "unresolvedQuestionCount", "blockingQuestionCount", "staleBindingCount",
                    "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["businessUnderstanding", "stakeholderModel", "outcomeModel"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "business-understanding-assessment") !=
                "business-understanding-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(assessment, "authorityBoundary", BusinessAssessmentAuthorityBoundary) !=
                BusinessAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var businessReference = ParseBusinessReference(assessment, "businessUnderstanding");
        var stakeholderReference = ParseBusinessReference(assessment, "stakeholderModel");
        var outcomeReference = ParseBusinessReference(assessment, "outcomeModel");
        var stakeholderCount = ParseBoundedNonNegativeInt(assessment, "stakeholderCount", 256);
        var representedCategoryCount =
            ParseBoundedNonNegativeInt(assessment, "representedStakeholderCategoryCount", 8);
        var unresolvedCategoryCount =
            ParseBoundedNonNegativeInt(assessment, "unresolvedStakeholderCategoryCount", 8);
        var verifiedAuthorityCount = ParseBoundedNonNegativeInt(assessment, "verifiedAuthorityCount", 256);
        var unverifiedAuthorityCount = ParseBoundedNonNegativeInt(assessment, "unverifiedAuthorityCount", 256);
        var outcomeCount = ParseBoundedNonNegativeInt(assessment, "outcomeCount", 256);
        var measureCount = ParseBoundedNonNegativeInt(assessment, "measureCount", 512);
        var observedBaselineCount = ParseBoundedNonNegativeInt(assessment, "observedBaselineCount", measureCount);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(assessment, "unresolvedQuestionCount", 256);
        var blockingQuestionCount =
            ParseBoundedNonNegativeInt(assessment, "blockingQuestionCount", unresolvedQuestionCount);
        var staleBindingCount = ParseBoundedNonNegativeInt(assessment, "staleBindingCount", 3);
        var staleSourceReferenceCount =
            ParseBoundedNonNegativeInt(assessment, "staleSourceReferenceCount", 10_000);
        if (representedCategoryCount + unresolvedCategoryCount > 8 ||
            verifiedAuthorityCount + unverifiedAuthorityCount > stakeholderCount)
        {
            throw InvalidResponse();
        }
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

        var business = projection.TryGetProperty("businessUnderstanding", out var businessElement)
            ? ParseBusinessUnderstandingRecord(businessElement, businessReference)
            : null;
        var stakeholders = projection.TryGetProperty("stakeholderModel", out var stakeholderElement)
            ? ParseStakeholderModelRecord(stakeholderElement, stakeholderReference)
            : null;
        var outcomes = projection.TryGetProperty("outcomeModel", out var outcomeElement)
            ? ParseOutcomeModelRecord(outcomeElement, outcomeReference)
            : null;
        if ((businessReference is null) != (business is null) ||
            (stakeholderReference is null) != (stakeholders is null) ||
            (outcomeReference is null) != (outcomes is null) ||
            (business?.UnresolvedQuestionCount ?? 0) != unresolvedQuestionCount ||
            (stakeholders?.StakeholderCount ?? 0) != stakeholderCount ||
            (stakeholders?.RepresentedCategoryCount ?? 0) != representedCategoryCount ||
            (stakeholders?.UnresolvedCategoryCount ?? 0) != unresolvedCategoryCount ||
            (stakeholders?.VerifiedAuthorityCount ?? 0) != verifiedAuthorityCount ||
            (outcomes?.OutcomeCount ?? 0) != outcomeCount ||
            (outcomes?.MeasureCount ?? 0) != measureCount ||
            (outcomes?.ObservedBaselineCount ?? 0) != observedBaselineCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }

        return new BusinessUnderstandingProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            unresolvedQuestionCount,
            blockingQuestionCount,
            staleBindingCount,
            staleSourceReferenceCount,
            business,
            stakeholders,
            outcomes,
            snapshotDigest);
    }

    private static BusinessReference? ParseBusinessReference(JsonElement container, string property)
    {
        if (!container.TryGetProperty(property, out var reference)) return null;
        if (!HasOnlyProperties(reference, "recordId", "revision", "digest")) throw InvalidResponse();
        return new BusinessReference(
            ParseRequiredGuid(reference, "recordId"),
            ParsePositiveLong(reference, "revision"),
            ParseRequiredDigest(reference, "digest"));
    }

    private static bool Matches(BusinessReference? reference, Guid id, long revision, string digest) =>
        reference is not null && reference.Id == id && reference.Revision == revision && reference.Digest == digest;

    private static BusinessUnderstandingRecordView ParseBusinessUnderstandingRecord(
        JsonElement record,
        BusinessReference? reference)
    {
        if (!HasOnlyProperties(
                record,
                "id", "revision", "digest", "state", "objectiveCount", "constraintCount", "assumptionCount",
                "unresolvedQuestionCount", "glossaryTermCount", "updatedAt") ||
            ParseRequiredEnum(record, "state", "candidate") != "candidate")
        {
            throw InvalidResponse();
        }
        var id = ParseRequiredGuid(record, "id");
        var revision = ParsePositiveLong(record, "revision");
        var digest = ParseRequiredDigest(record, "digest");
        if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
        ParseRequiredTimestamp(record, "updatedAt");
        return new BusinessUnderstandingRecordView(
            id,
            revision,
            digest,
            ParseBoundedNonNegativeInt(record, "objectiveCount", 256),
            ParseBoundedNonNegativeInt(record, "constraintCount", 256),
            ParseBoundedNonNegativeInt(record, "assumptionCount", 256),
            ParseBoundedNonNegativeInt(record, "unresolvedQuestionCount", 256),
            ParseBoundedNonNegativeInt(record, "glossaryTermCount", 512));
    }

    private static StakeholderModelRecordView ParseStakeholderModelRecord(
        JsonElement record,
        BusinessReference? reference)
    {
        if (!HasOnlyProperties(
                record,
                "id", "revision", "digest", "state", "stakeholderCount", "representedCategoryCount",
                "unresolvedCategoryCount", "verifiedAuthorityCount", "updatedAt") ||
            ParseRequiredEnum(record, "state", "candidate") != "candidate")
        {
            throw InvalidResponse();
        }
        var id = ParseRequiredGuid(record, "id");
        var revision = ParsePositiveLong(record, "revision");
        var digest = ParseRequiredDigest(record, "digest");
        if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
        var stakeholderCount = ParseBoundedNonNegativeInt(record, "stakeholderCount", 256);
        var represented = ParseBoundedNonNegativeInt(record, "representedCategoryCount", 8);
        var unresolved = ParseBoundedNonNegativeInt(record, "unresolvedCategoryCount", 8);
        var verified = ParseBoundedNonNegativeInt(record, "verifiedAuthorityCount", 256);
        if (represented + unresolved > 8 || verified > stakeholderCount) throw InvalidResponse();
        ParseRequiredTimestamp(record, "updatedAt");
        return new StakeholderModelRecordView(
            id,
            revision,
            digest,
            stakeholderCount,
            represented,
            unresolved,
            verified);
    }

    private static OutcomeModelRecordView ParseOutcomeModelRecord(
        JsonElement record,
        BusinessReference? reference)
    {
        if (!HasOnlyProperties(
                record,
                "id", "revision", "digest", "state", "outcomeCount", "measureCount", "countermetricCount",
                "burdenMeasureCount", "observedBaselineCount", "updatedAt") ||
            ParseRequiredEnum(record, "state", "candidate") != "candidate")
        {
            throw InvalidResponse();
        }
        var id = ParseRequiredGuid(record, "id");
        var revision = ParsePositiveLong(record, "revision");
        var digest = ParseRequiredDigest(record, "digest");
        if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
        var measureCount = ParseBoundedNonNegativeInt(record, "measureCount", 512);
        ParseRequiredTimestamp(record, "updatedAt");
        return new OutcomeModelRecordView(
            id,
            revision,
            digest,
            ParseBoundedNonNegativeInt(record, "outcomeCount", 256),
            measureCount,
            ParseBoundedNonNegativeInt(record, "countermetricCount", measureCount),
            ParseBoundedNonNegativeInt(record, "burdenMeasureCount", measureCount),
            ParseBoundedNonNegativeInt(record, "observedBaselineCount", measureCount));
    }
}
