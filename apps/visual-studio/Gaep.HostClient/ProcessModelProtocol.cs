using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ProcessModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials";
    private const string ProcessModelProjectionAuthorityBoundary =
        "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action";
    private const string ProcessModelStatusAuthorityBoundary =
        "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action";

    internal static ProcessModelProjection ParseProcessModelResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "process-model-projection") != "process-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ProcessModelProjectionPrivacyBoundary) != ProcessModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ProcessModelProjectionAuthorityBoundary) != ProcessModelProjectionAuthorityBoundary)
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
                    "processCount", "stepCount", "stateDimensionCount", "stateValueCount", "transitionCount",
                    "eventDefinitionCount", "approvalRequirementCount", "uncoveredValueStreamCount",
                    "uncoveredBoundedContextCount", "uncoveredBusinessRuleCount", "unresolvedRequirementCount",
                    "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "process-model-status") != "process-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ProcessModelStatusAuthorityBoundary) != ProcessModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "model");
        var processCount = ParseBoundedNonNegativeInt(status, "processCount", 512);
        var stepCount = ParseBoundedNonNegativeInt(status, "stepCount", 65_536);
        var stateDimensionCount = ParseBoundedNonNegativeInt(status, "stateDimensionCount", 32_768);
        var stateValueCount = ParseBoundedNonNegativeInt(status, "stateValueCount", 65_536);
        var transitionCount = ParseBoundedNonNegativeInt(status, "transitionCount", 65_536);
        var eventDefinitionCount = ParseBoundedNonNegativeInt(status, "eventDefinitionCount", 65_536);
        var approvalRequirementCount = ParseBoundedNonNegativeInt(status, "approvalRequirementCount", 32_768);
        var uncoveredValueStreamCount = ParseBoundedNonNegativeInt(status, "uncoveredValueStreamCount", 2_048);
        var uncoveredBoundedContextCount = ParseBoundedNonNegativeInt(status, "uncoveredBoundedContextCount", 2_048);
        var uncoveredBusinessRuleCount = ParseBoundedNonNegativeInt(status, "uncoveredBusinessRuleCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 70);
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

        ProcessModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "processCount", "transitionCount",
                    "approvalRequirementCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new ProcessModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "processCount", 512),
                ParseBoundedNonNegativeInt(modelElement, "transitionCount", 65_536),
                ParseBoundedNonNegativeInt(modelElement, "approvalRequirementCount", 32_768));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.ProcessCount ?? 0) != processCount ||
            (model?.TransitionCount ?? 0) != transitionCount ||
            (model?.ApprovalRequirementCount ?? 0) != approvalRequirementCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ProcessModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), processCount, stepCount,
            stateDimensionCount, stateValueCount, transitionCount, eventDefinitionCount, approvalRequirementCount,
            uncoveredValueStreamCount, uncoveredBoundedContextCount, uncoveredBusinessRuleCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest);
    }
}
