using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string SecurityPrivacyAssessmentProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials";
    private const string SecurityPrivacyAssessmentProjectionAuthorityBoundary =
        "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action";
    private const string SecurityPrivacyAssessmentStatusAuthorityBoundary =
        "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action";

    internal static SecurityPrivacyAssessmentProjection ParseSecurityPrivacyAssessmentResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                [
                    "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                    "privacyBoundary", "authorityBoundary", "snapshotDigest",
                ],
                ["assessment"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "security-privacy-threat-assessment-projection") !=
                "security-privacy-threat-assessment-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", SecurityPrivacyAssessmentProjectionPrivacyBoundary) !=
                SecurityPrivacyAssessmentProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", SecurityPrivacyAssessmentProjectionAuthorityBoundary) !=
                SecurityPrivacyAssessmentProjectionAuthorityBoundary)
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

        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "assetCount", "actorCount", "trustBoundaryCount", "dataClassCount", "dataFlowCount",
                    "controlCount", "threatCount", "unresolvedThreatCount", "unverifiedControlCount",
                    "unresolvedProcessingAuthorityCount", "uncoveredArchitectureElementCount",
                    "unmappedArchitectureRelationCount", "unresolvedRequirementCount", "inconsistencyCount",
                    "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["assessment"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "security-privacy-threat-assessment-status") !=
                "security-privacy-threat-assessment-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", SecurityPrivacyAssessmentStatusAuthorityBoundary) !=
                SecurityPrivacyAssessmentStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "assessment");
        var assetCount = ParseBoundedNonNegativeInt(status, "assetCount", 2_048);
        var actorCount = ParseBoundedNonNegativeInt(status, "actorCount", 1_024);
        var trustBoundaryCount = ParseBoundedNonNegativeInt(status, "trustBoundaryCount", 2_048);
        var dataClassCount = ParseBoundedNonNegativeInt(status, "dataClassCount", 2_048);
        var dataFlowCount = ParseBoundedNonNegativeInt(status, "dataFlowCount", 4_096);
        var controlCount = ParseBoundedNonNegativeInt(status, "controlCount", 4_096);
        var threatCount = ParseBoundedNonNegativeInt(status, "threatCount", 4_096);
        var unresolvedThreatCount = ParseBoundedNonNegativeInt(status, "unresolvedThreatCount", threatCount);
        var unverifiedControlCount = ParseBoundedNonNegativeInt(status, "unverifiedControlCount", controlCount);
        var unresolvedProcessingAuthorityCount = ParseBoundedNonNegativeInt(
            status,
            "unresolvedProcessingAuthorityCount",
            dataClassCount);
        var uncoveredArchitectureElementCount = ParseBoundedNonNegativeInt(
            status,
            "uncoveredArchitectureElementCount",
            2_048);
        var unmappedArchitectureRelationCount = ParseBoundedNonNegativeInt(
            status,
            "unmappedArchitectureRelationCount",
            4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 28);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 16);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var assessmentState = ParseRequiredEnum(status, "state", "complete-for-review", "attention-required");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512)
        {
            throw InvalidResponse();
        }
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        SecurityPrivacyAssessmentRecordView? assessment = null;
        if (projection.TryGetProperty("assessment", out var assessmentElement))
        {
            if (!HasOnlyProperties(
                    assessmentElement,
                    "id", "revision", "digest", "membershipDigest", "state", "assetCount", "trustBoundaryCount",
                    "dataClassCount", "controlCount", "threatCount", "updatedAt") ||
                ParseRequiredEnum(assessmentElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(assessmentElement, "id");
            var revision = ParsePositiveLong(assessmentElement, "revision");
            var digest = ParseRequiredDigest(assessmentElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            assessment = new SecurityPrivacyAssessmentRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(assessmentElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(assessmentElement, "assetCount", 2_048),
                ParseBoundedNonNegativeInt(assessmentElement, "trustBoundaryCount", 2_048),
                ParseBoundedNonNegativeInt(assessmentElement, "dataClassCount", 2_048),
                ParseBoundedNonNegativeInt(assessmentElement, "controlCount", 4_096),
                ParseBoundedNonNegativeInt(assessmentElement, "threatCount", 4_096));
            ParseRequiredTimestamp(assessmentElement, "updatedAt");
        }
        if ((reference is null) != (assessment is null) ||
            (assessment?.AssetCount ?? 0) != assetCount ||
            (assessment?.TrustBoundaryCount ?? 0) != trustBoundaryCount ||
            (assessment?.DataClassCount ?? 0) != dataClassCount ||
            (assessment?.ControlCount ?? 0) != controlCount ||
            (assessment?.ThreatCount ?? 0) != threatCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new SecurityPrivacyAssessmentProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            assetCount,
            actorCount,
            trustBoundaryCount,
            dataClassCount,
            dataFlowCount,
            controlCount,
            threatCount,
            unresolvedThreatCount,
            unverifiedControlCount,
            unresolvedProcessingAuthorityCount,
            uncoveredArchitectureElementCount,
            unmappedArchitectureRelationCount,
            unresolvedRequirementCount,
            inconsistencyCount,
            unresolvedQuestionCount,
            staleBindingCount,
            staleSourceReferenceCount,
            assessment,
            snapshotDigest);
    }
}
