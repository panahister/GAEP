using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string AuthorizationModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials";
    private const string AuthorizationModelProjectionAuthorityBoundary =
        "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action";
    private const string AuthorizationModelStatusAuthorityBoundary =
        "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action";

    internal static AuthorizationModelProjection ParseAuthorizationModelResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "authorization-model-projection") != "authorization-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", AuthorizationModelProjectionPrivacyBoundary) != AuthorizationModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", AuthorizationModelProjectionAuthorityBoundary) != AuthorizationModelProjectionAuthorityBoundary)
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
                    "principalCount", "roleAssignmentCount", "resourceCount", "actionCount", "approvalBindingCount",
                    "ruleCount", "uncoveredOperatingRoleCount", "uncoveredProcessCount", "uncoveredDataEntityCount",
                    "unresolvedIdentityCount", "unresolvedRuleCount", "unresolvedRequirementCount", "inconsistencyCount",
                    "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "authorization-model-status") != "authorization-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", AuthorizationModelStatusAuthorityBoundary) != AuthorizationModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "model");
        var principalCount = ParseBoundedNonNegativeInt(status, "principalCount", 4_096);
        var roleAssignmentCount = ParseBoundedNonNegativeInt(status, "roleAssignmentCount", 8_192);
        var resourceCount = ParseBoundedNonNegativeInt(status, "resourceCount", 8_192);
        var actionCount = ParseBoundedNonNegativeInt(status, "actionCount", 4_096);
        var approvalBindingCount = ParseBoundedNonNegativeInt(status, "approvalBindingCount", 4_096);
        var ruleCount = ParseBoundedNonNegativeInt(status, "ruleCount", 16_384);
        var uncoveredOperatingRoleCount = ParseBoundedNonNegativeInt(status, "uncoveredOperatingRoleCount", 2_048);
        var uncoveredProcessCount = ParseBoundedNonNegativeInt(status, "uncoveredProcessCount", 512);
        var uncoveredDataEntityCount = ParseBoundedNonNegativeInt(status, "uncoveredDataEntityCount", 2_048);
        var unresolvedIdentityCount = ParseBoundedNonNegativeInt(status, "unresolvedIdentityCount", 4_096);
        var unresolvedRuleCount = ParseBoundedNonNegativeInt(status, "unresolvedRuleCount", 16_384);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 28);
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

        AuthorizationModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "principalCount", "actionCount",
                    "ruleCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new AuthorizationModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "principalCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "actionCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "ruleCount", 16_384));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.PrincipalCount ?? 0) != principalCount ||
            (model?.ActionCount ?? 0) != actionCount ||
            (model?.RuleCount ?? 0) != ruleCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new AuthorizationModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), principalCount, roleAssignmentCount,
            resourceCount, actionCount, approvalBindingCount, ruleCount, uncoveredOperatingRoleCount,
            uncoveredProcessCount, uncoveredDataEntityCount, unresolvedIdentityCount, unresolvedRuleCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest);
    }
}
