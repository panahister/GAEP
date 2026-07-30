using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string HumanDesignApprovalProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string HumanDesignApprovalProjectionAuthorityBoundary =
        "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority";
    private const string HumanDesignApprovalStatusAuthorityBoundary =
        "human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority";

    internal static HumanDesignApprovalProjection ParseHumanDesignApprovalResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "human-design-approval-projection") != "human-design-approval-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", HumanDesignApprovalProjectionPrivacyBoundary) != HumanDesignApprovalProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", HumanDesignApprovalProjectionAuthorityBoundary) != HumanDesignApprovalProjectionAuthorityBoundary)
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
                    "prerequisiteCount", "completePrerequisiteCount", "decisionCount", "approveCount", "rejectCount",
                    "requestChangeCount", "abstainCount", "expiredDecisionCount", "revokedDecisionCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "candidateResult",
                    "reviewState", "approverAuthorityState", "separationOfDutiesEnforcementState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "human-design-approval-status") != "human-design-approval-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", HumanDesignApprovalStatusAuthorityBoundary) != HumanDesignApprovalStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var prerequisiteCount = ParseBoundedNonNegativeInt(status, "prerequisiteCount", 5);
        var completePrerequisiteCount = ParseBoundedNonNegativeInt(status, "completePrerequisiteCount", 5);
        var decisionCount = ParseBoundedNonNegativeInt(status, "decisionCount", 1);
        var approveCount = ParseBoundedNonNegativeInt(status, "approveCount", 1);
        var rejectCount = ParseBoundedNonNegativeInt(status, "rejectCount", 1);
        var requestChangeCount = ParseBoundedNonNegativeInt(status, "requestChangeCount", 1);
        var abstainCount = ParseBoundedNonNegativeInt(status, "abstainCount", 1);
        var expiredDecisionCount = ParseBoundedNonNegativeInt(status, "expiredDecisionCount", 1);
        var revokedDecisionCount = ParseBoundedNonNegativeInt(status, "revokedDecisionCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (approveCount + rejectCount + requestChangeCount + abstainCount != decisionCount ||
            completePrerequisiteCount > prerequisiteCount)
        {
            throw InvalidResponse();
        }
        var candidateResult = ParseRequiredEnum(
            status,
            "candidateResult",
            "abstained-candidate", "approved-candidate", "blocked", "changes-requested-candidate",
            "incomplete", "not-assessed", "rejected-candidate");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "recorded-human-decision");
        var approverAuthorityState = ParseRequiredEnum(status, "approverAuthorityState", "not-established");
        var separationOfDutiesEnforcementState = ParseRequiredEnum(status, "separationOfDutiesEnforcementState", "not-established");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-recorded-decision");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = expiredDecisionCount + revokedDecisionCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-recorded-decision" &&
                (reference is null || reasons.Length > 0 || prerequisiteCount != 5 || completePrerequisiteCount != 5 ||
                    decisionCount != 1 || gapCount > 0 || reviewState != "recorded-human-decision")) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        HumanDesignApprovalRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasRequiredAndAllowedProperties(
                    candidateElement,
                    [
                        "id", "revision", "digest", "membershipDigest", "state", "prerequisiteCatalogDigest", "subject",
                        "scopeDigest", "decisionDefinitionDigest", "decisionReceiptDigest", "candidateResult", "reviewState", "updatedAt",
                    ],
                    ["decisionKind", "decisionDigest", "decisionLifecycleState"]) ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var subjectElement = candidateElement.GetProperty("subject");
            if (!HasOnlyProperties(
                    subjectElement,
                    "kind", "recordId", "revision", "digest", "membershipDigest", "externalFileIdentityDigest",
                    "returnedExternalVersionDigest", "itemCatalogDigest", "itemCount") ||
                ParseRequiredEnum(subjectElement, "kind", "finalized-figma-snapshot-import-candidate") != "finalized-figma-snapshot-import-candidate")
            {
                throw InvalidResponse();
            }
            var itemCount = ParseBoundedNonNegativeInt(subjectElement, "itemCount", 33_792);
            if (itemCount == 0) throw InvalidResponse();
            var subject = new HumanDesignApprovalSubjectView(
                ParseRequiredGuid(subjectElement, "recordId"),
                ParsePositiveLong(subjectElement, "revision"),
                ParseRequiredDigest(subjectElement, "digest"),
                ParseRequiredDigest(subjectElement, "membershipDigest"),
                ParseRequiredDigest(subjectElement, "externalFileIdentityDigest"),
                ParseRequiredDigest(subjectElement, "returnedExternalVersionDigest"),
                ParseRequiredDigest(subjectElement, "itemCatalogDigest"),
                itemCount);
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            var recordCandidateResult = ParseRequiredEnum(
                candidateElement,
                "candidateResult",
                "abstained-candidate", "approved-candidate", "blocked", "changes-requested-candidate", "incomplete", "rejected-candidate");
            var recordReviewState = ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "recorded-human-decision");
            string? decisionKind = null;
            if (candidateElement.TryGetProperty("decisionKind", out _))
            {
                decisionKind = ParseRequiredEnum(
                    candidateElement,
                    "decisionKind",
                    "abstain-candidate", "approve-candidate", "reject-candidate", "request-change-candidate");
            }
            string? decisionDigest = null;
            if (candidateElement.TryGetProperty("decisionDigest", out _))
            {
                decisionDigest = ParseRequiredDigest(candidateElement, "decisionDigest");
            }
            string? decisionLifecycleState = null;
            if (candidateElement.TryGetProperty("decisionLifecycleState", out _))
            {
                decisionLifecycleState = ParseRequiredEnum(candidateElement, "decisionLifecycleState", "active-candidate", "revoked-candidate");
            }
            candidate = new HumanDesignApprovalRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseRequiredDigest(candidateElement, "prerequisiteCatalogDigest"),
                subject,
                ParseRequiredDigest(candidateElement, "scopeDigest"),
                ParseRequiredDigest(candidateElement, "decisionDefinitionDigest"),
                ParseRequiredDigest(candidateElement, "decisionReceiptDigest"),
                decisionKind,
                decisionDigest,
                decisionLifecycleState,
                recordCandidateResult,
                recordReviewState);
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate is not null &&
                (candidate.CandidateResult != candidateResult || candidate.ReviewState != reviewState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new HumanDesignApprovalProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, candidateResult, reviewState, assessmentState, prerequisiteCount,
            completePrerequisiteCount, decisionCount, approveCount, rejectCount, requestChangeCount,
            abstainCount, expiredDecisionCount, revokedDecisionCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, approverAuthorityState,
            separationOfDutiesEnforcementState, Array.AsReadOnly(reasons), candidate, snapshotDigest);
    }
}
