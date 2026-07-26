using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string FailureRecoveryModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials";
    private const string FailureRecoveryModelProjectionAuthorityBoundary =
        "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action";
    private const string FailureRecoveryModelStatusAuthorityBoundary =
        "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action";

    internal static FailureRecoveryModelProjection ParseFailureRecoveryModelResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "failure-recovery-model-projection") != "failure-recovery-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", FailureRecoveryModelProjectionPrivacyBoundary) != FailureRecoveryModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", FailureRecoveryModelProjectionAuthorityBoundary) != FailureRecoveryModelProjectionAuthorityBoundary)
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
                    "failureModeCount", "retryPolicyCount", "compensationPlanCount", "recoveryPlanCount",
                    "recoveryEvidenceDefinitionCount", "uncoveredProcessCount", "uncoveredCommandCount",
                    "uncoveredRouteCount", "uncoveredAuthorizationActionCount", "unresolvedRecoveryEvidenceCount",
                    "unresolvedRequirementCount", "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount",
                    "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "failure-recovery-model-status") != "failure-recovery-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", FailureRecoveryModelStatusAuthorityBoundary) != FailureRecoveryModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "model");
        var failureModeCount = ParseBoundedNonNegativeInt(status, "failureModeCount", 8_192);
        var retryPolicyCount = ParseBoundedNonNegativeInt(status, "retryPolicyCount", 8_192);
        var compensationPlanCount = ParseBoundedNonNegativeInt(status, "compensationPlanCount", 8_192);
        var recoveryPlanCount = ParseBoundedNonNegativeInt(status, "recoveryPlanCount", 8_192);
        var recoveryEvidenceDefinitionCount = ParseBoundedNonNegativeInt(status, "recoveryEvidenceDefinitionCount", 8_192);
        var uncoveredProcessCount = ParseBoundedNonNegativeInt(status, "uncoveredProcessCount", 512);
        var uncoveredCommandCount = ParseBoundedNonNegativeInt(status, "uncoveredCommandCount", 8_192);
        var uncoveredRouteCount = ParseBoundedNonNegativeInt(status, "uncoveredRouteCount", 8_192);
        var uncoveredAuthorizationActionCount = ParseBoundedNonNegativeInt(status, "uncoveredAuthorizationActionCount", 4_096);
        var unresolvedRecoveryEvidenceCount = ParseBoundedNonNegativeInt(status, "unresolvedRecoveryEvidenceCount", 8_192);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 47);
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

        FailureRecoveryModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "failureModeCount", "retryPolicyCount",
                    "compensationPlanCount", "recoveryPlanCount", "recoveryEvidenceDefinitionCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new FailureRecoveryModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "failureModeCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "retryPolicyCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "compensationPlanCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "recoveryPlanCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "recoveryEvidenceDefinitionCount", 8_192));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.FailureModeCount ?? 0) != failureModeCount ||
            (model?.RetryPolicyCount ?? 0) != retryPolicyCount ||
            (model?.CompensationPlanCount ?? 0) != compensationPlanCount ||
            (model?.RecoveryPlanCount ?? 0) != recoveryPlanCount ||
            (model?.RecoveryEvidenceDefinitionCount ?? 0) != recoveryEvidenceDefinitionCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new FailureRecoveryModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), failureModeCount, retryPolicyCount,
            compensationPlanCount, recoveryPlanCount, recoveryEvidenceDefinitionCount, uncoveredProcessCount,
            uncoveredCommandCount, uncoveredRouteCount, uncoveredAuthorizationActionCount,
            unresolvedRecoveryEvidenceCount, unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount,
            staleBindingCount, staleSourceReferenceCount, model, snapshotDigest);
    }
}
