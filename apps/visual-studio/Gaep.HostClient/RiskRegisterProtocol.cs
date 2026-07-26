using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string RiskRegisterProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials";
    private const string RiskRegisterProjectionAuthorityBoundary =
        "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority";
    private const string RiskRegisterStatusAuthorityBoundary =
        "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority";

    internal static RiskRegisterProjection ParseRiskRegisterResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["register"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "risk-register-projection") != "risk-register-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", RiskRegisterProjectionPrivacyBoundary) != RiskRegisterProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", RiskRegisterProjectionAuthorityBoundary) != RiskRegisterProjectionAuthorityBoundary)
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
                    "riskCount", "notAssessedRiskCount", "unresolvedResidualRiskCount", "proposedTreatmentCount",
                    "unassignedOwnerCount", "unverifiedControlCount", "unresolvedRequirementCount", "staleBindingCount",
                    "staleSourceReferenceCount", "inconsistencyCount", "unresolvedQuestionCount", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["register"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "risk-register-status") != "risk-register-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", RiskRegisterStatusAuthorityBoundary) != RiskRegisterStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "register");
        var riskCount = ParseBoundedNonNegativeInt(status, "riskCount", 4_096);
        var notAssessedRiskCount = ParseBoundedNonNegativeInt(status, "notAssessedRiskCount", 4_096);
        var unresolvedResidualRiskCount = ParseBoundedNonNegativeInt(status, "unresolvedResidualRiskCount", 4_096);
        var proposedTreatmentCount = ParseBoundedNonNegativeInt(status, "proposedTreatmentCount", 4_096);
        var unassignedOwnerCount = ParseBoundedNonNegativeInt(status, "unassignedOwnerCount", 4_096);
        if (notAssessedRiskCount > riskCount || unresolvedResidualRiskCount > riskCount ||
            proposedTreatmentCount > riskCount || unassignedOwnerCount > riskCount)
        {
            throw InvalidResponse();
        }
        var unverifiedControlCount = ParseBoundedNonNegativeInt(status, "unverifiedControlCount", 2_097_152);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 15);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var assessmentState = ParseRequiredEnum(status, "state", "complete-for-review", "attention-required");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        RiskRegisterRecordView? register = null;
        if (projection.TryGetProperty("register", out var registerElement))
        {
            if (!HasOnlyProperties(
                    registerElement,
                    "id", "revision", "digest", "membershipDigest", "state", "riskCount", "updatedAt") ||
                ParseRequiredEnum(registerElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(registerElement, "id");
            var revision = ParsePositiveLong(registerElement, "revision");
            var digest = ParseRequiredDigest(registerElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            register = new RiskRegisterRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(registerElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(registerElement, "riskCount", 4_096));
            ParseRequiredTimestamp(registerElement, "updatedAt");
        }
        if ((reference is null) != (register is null) ||
            (register?.RiskCount ?? 0) != riskCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new RiskRegisterProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), riskCount, notAssessedRiskCount,
            unresolvedResidualRiskCount, proposedTreatmentCount, unassignedOwnerCount, unverifiedControlCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, register, snapshotDigest);
    }
}
