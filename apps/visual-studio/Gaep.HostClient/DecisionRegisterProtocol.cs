using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DecisionRegisterProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials";
    private const string DecisionRegisterProjectionAuthorityBoundary =
        "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority";
    private const string DecisionRegisterStatusAuthorityBoundary =
        "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority";

    internal static DecisionRegisterProjection ParseDecisionRegisterResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["register"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "decision-register-projection") != "decision-register-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DecisionRegisterProjectionPrivacyBoundary) != DecisionRegisterProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DecisionRegisterProjectionAuthorityBoundary) != DecisionRegisterProjectionAuthorityBoundary)
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
                    "decisionCount", "unresolvedDecisionCount", "selectedPendingDecisionCount", "deferredDecisionCount",
                    "unresolvedRequirementCount", "staleBindingCount", "staleSourceReferenceCount", "inconsistencyCount",
                    "unresolvedQuestionCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["register"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "decision-register-status") != "decision-register-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DecisionRegisterStatusAuthorityBoundary) != DecisionRegisterStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "register");
        var decisionCount = ParseBoundedNonNegativeInt(status, "decisionCount", 4_096);
        var unresolvedDecisionCount = ParseBoundedNonNegativeInt(status, "unresolvedDecisionCount", 4_096);
        var selectedPendingDecisionCount = ParseBoundedNonNegativeInt(status, "selectedPendingDecisionCount", 4_096);
        var deferredDecisionCount = ParseBoundedNonNegativeInt(status, "deferredDecisionCount", 4_096);
        if (unresolvedDecisionCount + selectedPendingDecisionCount + deferredDecisionCount > decisionCount) throw InvalidResponse();
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 12);
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

        DecisionRegisterRecordView? register = null;
        if (projection.TryGetProperty("register", out var registerElement))
        {
            if (!HasOnlyProperties(
                    registerElement,
                    "id", "revision", "digest", "membershipDigest", "state", "decisionCount", "updatedAt") ||
                ParseRequiredEnum(registerElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(registerElement, "id");
            var revision = ParsePositiveLong(registerElement, "revision");
            var digest = ParseRequiredDigest(registerElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            register = new DecisionRegisterRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(registerElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(registerElement, "decisionCount", 4_096));
            ParseRequiredTimestamp(registerElement, "updatedAt");
        }
        if ((reference is null) != (register is null) ||
            (register?.DecisionCount ?? 0) != decisionCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DecisionRegisterProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), decisionCount, unresolvedDecisionCount,
            selectedPendingDecisionCount, deferredDecisionCount, unresolvedRequirementCount, inconsistencyCount,
            unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, register, snapshotDigest);
    }
}
