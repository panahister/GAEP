using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BusinessRuleProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials";
    private const string BusinessRuleProjectionAuthorityBoundary =
        "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action";
    private const string BusinessRuleAssessmentAuthorityBoundary =
        "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action";

    internal static BusinessRuleCatalogProjection ParseBusinessRuleCatalogResponse(
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
                ["businessRuleCatalog"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "business-rule-catalog-projection") !=
                "business-rule-catalog-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", BusinessRuleProjectionPrivacyBoundary) !=
                BusinessRuleProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", BusinessRuleProjectionAuthorityBoundary) !=
                BusinessRuleProjectionAuthorityBoundary)
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
                    "ruleCount", "sourceBackedRuleCount", "nonExceptionableRuleCount", "enforcementTargetCount",
                    "unassignedEnforcementTargetCount", "unverifiedEnforcementTargetCount", "exceptionCount",
                    "unassignedExceptionAuthorityCount", "staleBindingCount", "staleSourceReferenceCount", "state",
                    "reasons", "assessedAt", "authorityBoundary",
                ],
                ["businessRuleCatalog"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "business-rule-catalog-assessment") !=
                "business-rule-catalog-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(assessment, "authorityBoundary", BusinessRuleAssessmentAuthorityBoundary) !=
                BusinessRuleAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(assessment, "businessRuleCatalog");
        var ruleCount = ParseBoundedNonNegativeInt(assessment, "ruleCount", 512);
        var sourceBackedRuleCount = ParseBoundedNonNegativeInt(assessment, "sourceBackedRuleCount", ruleCount);
        var nonExceptionableRuleCount = ParseBoundedNonNegativeInt(assessment, "nonExceptionableRuleCount", ruleCount);
        var enforcementTargetCount = ParseBoundedNonNegativeInt(assessment, "enforcementTargetCount", 512);
        var unassignedEnforcementTargetCount =
            ParseBoundedNonNegativeInt(assessment, "unassignedEnforcementTargetCount", enforcementTargetCount);
        var unverifiedEnforcementTargetCount =
            ParseBoundedNonNegativeInt(assessment, "unverifiedEnforcementTargetCount", enforcementTargetCount);
        var exceptionCount = ParseBoundedNonNegativeInt(assessment, "exceptionCount", 512);
        var unassignedExceptionAuthorityCount =
            ParseBoundedNonNegativeInt(assessment, "unassignedExceptionAuthorityCount", exceptionCount);
        var staleBindingCount = ParseBoundedNonNegativeInt(assessment, "staleBindingCount", 9);
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

        BusinessRuleCatalogRecordView? catalog = null;
        if (projection.TryGetProperty("businessRuleCatalog", out var catalogElement))
        {
            if (!HasOnlyProperties(
                    catalogElement,
                    "id", "revision", "digest", "state", "ruleCount", "enforcementTargetCount",
                    "exceptionCount", "nonExceptionableRuleCount", "updatedAt") ||
                ParseRequiredEnum(catalogElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(catalogElement, "id");
            var revision = ParsePositiveLong(catalogElement, "revision");
            var digest = ParseRequiredDigest(catalogElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            catalog = new BusinessRuleCatalogRecordView(
                id,
                revision,
                digest,
                ParseBoundedNonNegativeInt(catalogElement, "ruleCount", 512),
                ParseBoundedNonNegativeInt(catalogElement, "enforcementTargetCount", 512),
                ParseBoundedNonNegativeInt(catalogElement, "exceptionCount", 512),
                ParseBoundedNonNegativeInt(catalogElement, "nonExceptionableRuleCount", 512));
            ParseRequiredTimestamp(catalogElement, "updatedAt");
        }
        if ((reference is null) != (catalog is null) ||
            (catalog?.RuleCount ?? 0) != ruleCount ||
            (catalog?.EnforcementTargetCount ?? 0) != enforcementTargetCount ||
            (catalog?.ExceptionCount ?? 0) != exceptionCount ||
            (catalog?.NonExceptionableRuleCount ?? 0) != nonExceptionableRuleCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BusinessRuleCatalogProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            ruleCount,
            sourceBackedRuleCount,
            nonExceptionableRuleCount,
            enforcementTargetCount,
            unassignedEnforcementTargetCount,
            unverifiedEnforcementTargetCount,
            exceptionCount,
            unassignedExceptionAuthorityCount,
            staleBindingCount,
            staleSourceReferenceCount,
            catalog,
            snapshotDigest);
    }
}
