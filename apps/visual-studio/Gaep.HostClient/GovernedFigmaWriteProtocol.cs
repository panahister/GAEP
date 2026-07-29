using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string GovernedFigmaWriteProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-approval-actor-permission-evidence-recovery-or-personal-content-secrets-or-credentials";
    private const string GovernedFigmaWriteProjectionAuthorityBoundary =
        "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string GovernedFigmaWriteStatusAuthorityBoundary =
        "governed-figma-write-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static GovernedFigmaWriteProjection ParseGovernedFigmaWriteResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "governed-figma-write-projection") != "governed-figma-write-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", GovernedFigmaWriteProjectionPrivacyBoundary) != GovernedFigmaWriteProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", GovernedFigmaWriteProjectionAuthorityBoundary) != GovernedFigmaWriteProjectionAuthorityBoundary)
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
                    "selectedEntryCount", "unresolvedDisclosureCount", "staleBindingCount", "staleSourceReferenceCount",
                    "unresolvedQuestionCount", "previewState", "approvalState", "permissionEvidenceState",
                    "idempotencyState", "replayProtectionState", "recoveryPlanState", "writePlanState", "reviewState",
                    "writeExecutionState", "writeResultState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "governed-figma-write-status") != "governed-figma-write-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", GovernedFigmaWriteStatusAuthorityBoundary) != GovernedFigmaWriteStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var selectedEntryCount = ParseBoundedNonNegativeInt(status, "selectedEntryCount", 4_096);
        var unresolvedDisclosureCount = ParseBoundedNonNegativeInt(status, "unresolvedDisclosureCount", 1_024);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var previewState = ParseRequiredEnum(status, "previewState", "candidate-generated", "human-reviewed", "not-generated");
        var approvalState = ParseRequiredEnum(status, "approvalState", "not-requested", "pending", "granted", "declined", "expired", "revoked");
        var permissionEvidenceState = ParseRequiredEnum(status, "permissionEvidenceState", "not-assessed", "missing", "verified");
        var idempotencyState = ParseRequiredEnum(status, "idempotencyState", "defined", "not-assessed");
        var replayProtectionState = ParseRequiredEnum(status, "replayProtectionState", "defined", "not-assessed");
        var recoveryPlanState = ParseRequiredEnum(status, "recoveryPlanState", "defined", "not-assessed");
        var writePlanState = ParseRequiredEnum(status, "writePlanState", "draft", "held", "complete-for-authorization-review");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var writeExecutionState = ParseRequiredEnum(status, "writeExecutionState", "not-performed");
        var writeResultState = ParseRequiredEnum(status, "writeResultState", "not-recorded");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-authorization-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedDisclosureCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-authorization-review" &&
                (gapCount > 0 || selectedEntryCount == 0 || previewState != "human-reviewed" ||
                    permissionEvidenceState != "verified" || idempotencyState != "defined" ||
                    replayProtectionState != "defined" || recoveryPlanState != "defined" ||
                    writePlanState != "complete-for-authorization-review" || reviewState != "ready-for-human-review" ||
                    reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        GovernedFigmaWriteRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasRequiredAndAllowedProperties(
                    candidateElement,
                    [
                        "id", "revision", "digest", "membershipDigest", "state", "requestFormat", "requestDigest",
                        "effectDigest", "outboundPackage", "externalFileIdentityDigest", "expectedExternalVersionDigest",
                        "selectedEntryCount", "previewState", "approvalState", "permissionEvidenceState", "idempotencyState",
                        "recoveryPlanState", "reviewState", "writeExecutionState", "updatedAt",
                    ],
                    ["previewDigest"]) ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            var outboundPackage = candidateElement.GetProperty("outboundPackage");
            if (!HasOnlyProperties(outboundPackage, "recordId", "revision", "digest", "membershipDigest", "manifestDigest", "payloadDigest"))
            {
                throw InvalidResponse();
            }
            var packageBinding = new GovernedFigmaWritePackageBindingView(
                ParseRequiredGuid(outboundPackage, "recordId"),
                ParsePositiveLong(outboundPackage, "revision"),
                ParseRequiredDigest(outboundPackage, "digest"),
                ParseRequiredDigest(outboundPackage, "membershipDigest"),
                ParseRequiredDigest(outboundPackage, "manifestDigest"),
                ParseRequiredDigest(outboundPackage, "payloadDigest"));
            candidate = new GovernedFigmaWriteRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseRequiredEnum(candidateElement, "requestFormat", "gaep-governed-figma-write-request-v1"),
                ParseRequiredDigest(candidateElement, "requestDigest"),
                ParseRequiredDigest(candidateElement, "effectDigest"),
                packageBinding,
                ParseRequiredDigest(candidateElement, "externalFileIdentityDigest"),
                ParseRequiredDigest(candidateElement, "expectedExternalVersionDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "selectedEntryCount", 4_096),
                ParseRequiredEnum(candidateElement, "previewState", "candidate-generated", "human-reviewed", "not-generated"),
                candidateElement.TryGetProperty("previewDigest", out _) ? ParseRequiredDigest(candidateElement, "previewDigest") : null,
                ParseRequiredEnum(candidateElement, "approvalState", "not-requested", "pending", "granted", "declined", "expired", "revoked"),
                ParseRequiredEnum(candidateElement, "permissionEvidenceState", "not-assessed", "missing", "verified"),
                ParseRequiredEnum(candidateElement, "idempotencyState", "defined", "not-assessed"),
                ParseRequiredEnum(candidateElement, "recoveryPlanState", "defined", "not-assessed"),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"),
                ParseRequiredEnum(candidateElement, "writeExecutionState", "not-performed"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.SelectedEntryCount ?? 0) != selectedEntryCount ||
            (candidate is not null &&
                (candidate.PreviewState != previewState || candidate.ApprovalState != approvalState ||
                    candidate.PermissionEvidenceState != permissionEvidenceState || candidate.IdempotencyState != idempotencyState ||
                    candidate.RecoveryPlanState != recoveryPlanState || candidate.ReviewState != reviewState ||
                    candidate.WriteExecutionState != writeExecutionState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new GovernedFigmaWriteProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, writePlanState, previewState, approvalState,
            permissionEvidenceState, idempotencyState, replayProtectionState, recoveryPlanState, writeExecutionState,
            writeResultState, Array.AsReadOnly(reasons), selectedEntryCount, unresolvedDisclosureCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
