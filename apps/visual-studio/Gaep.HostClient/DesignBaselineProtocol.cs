using System.Text.Json;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignBaselineProjectionPrivacyBoundary =
        "projection-contains-record-identities-version-axes-counts-results-and-digests-only-not-design-content-rationale-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string DesignBaselineProjectionAuthorityBoundary =
        "design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority";
    private const string DesignBaselineStatusAuthorityBoundary =
        "design-baseline-status-is-observational-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority";

    internal static DesignBaselineProjection ParseDesignBaselineResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-baseline-projection") != "design-baseline-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignBaselineProjectionPrivacyBoundary) != DesignBaselineProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignBaselineProjectionAuthorityBoundary) != DesignBaselineProjectionAuthorityBoundary)
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
                    "candidateSetCount", "designationCandidateCount", "supersessionCandidateCount",
                    "withdrawalCandidateCount", "restorationCandidateCount", "expiredDesignationCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "candidateResult",
                    "reviewState", "approvalDeterminationState", "baselineDesignationState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-baseline-status") != "design-baseline-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignBaselineStatusAuthorityBoundary) != DesignBaselineStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var candidateSetCount = ParseBoundedNonNegativeInt(status, "candidateSetCount", 1);
        var designationCandidateCount = ParseBoundedNonNegativeInt(status, "designationCandidateCount", 1);
        var supersessionCandidateCount = ParseBoundedNonNegativeInt(status, "supersessionCandidateCount", 1);
        var withdrawalCandidateCount = ParseBoundedNonNegativeInt(status, "withdrawalCandidateCount", 1);
        var restorationCandidateCount = ParseBoundedNonNegativeInt(status, "restorationCandidateCount", 1);
        var expiredDesignationCount = ParseBoundedNonNegativeInt(status, "expiredDesignationCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (supersessionCandidateCount + withdrawalCandidateCount + restorationCandidateCount > designationCandidateCount)
        {
            throw InvalidResponse();
        }
        var candidateResult = ParseRequiredEnum(
            status,
            "candidateResult",
            "baseline-proposal-candidate", "blocked", "incomplete", "not-assessed", "restoration-candidate",
            "supersession-candidate", "withdrawal-candidate");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var approvalDeterminationState = ParseRequiredEnum(status, "approvalDeterminationState", "not-established");
        var baselineDesignationState = ParseRequiredEnum(status, "baselineDesignationState", "not-established");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-baseline-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = expiredDesignationCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-baseline-review" &&
                (reference is null || reasons.Length > 0 || candidateSetCount != 1 || designationCandidateCount != 1 ||
                    gapCount > 0 || reviewState != "ready-for-human-review")) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignBaselineRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasRequiredAndAllowedProperties(
                    candidateElement,
                    [
                        "id", "revision", "digest", "membershipDigest", "state", "humanDesignApproval", "subject",
                        "scopeDigest", "baselineLineageId", "candidateSetId", "candidateSetRevision", "semanticVersion",
                        "versionPolicyDigest", "designationDefinitionDigest", "designationReceiptDigest", "candidateResult",
                        "reviewState", "updatedAt",
                    ],
                    ["designationKind", "designationDigest", "supersedes"]) ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var approvalElement = candidateElement.GetProperty("humanDesignApproval");
            if (!HasOnlyProperties(
                    approvalElement,
                    "kind", "recordId", "revision", "digest", "membershipDigest", "decisionReceiptDigest",
                    "subjectDigest", "scopeDigest", "candidateResult", "reviewState", "assessmentDigest", "assessmentState") ||
                ParseRequiredEnum(approvalElement, "kind", "human-design-approval-candidate") != "human-design-approval-candidate" ||
                ParseRequiredEnum(approvalElement, "candidateResult", "approved-candidate") != "approved-candidate" ||
                ParseRequiredEnum(approvalElement, "reviewState", "recorded-human-decision") != "recorded-human-decision")
            {
                throw InvalidResponse();
            }
            var approval = new DesignBaselineApprovalView(
                ParseRequiredGuid(approvalElement, "recordId"),
                ParsePositiveLong(approvalElement, "revision"),
                ParseRequiredDigest(approvalElement, "digest"),
                ParseRequiredDigest(approvalElement, "membershipDigest"),
                ParseRequiredDigest(approvalElement, "decisionReceiptDigest"),
                ParseRequiredDigest(approvalElement, "subjectDigest"),
                ParseRequiredDigest(approvalElement, "scopeDigest"),
                ParseRequiredDigest(approvalElement, "assessmentDigest"),
                ParseRequiredEnum(approvalElement, "assessmentState", "attention-required", "complete-for-recorded-decision"));
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
            var scopeDigest = ParseRequiredDigest(candidateElement, "scopeDigest");
            if (approval.SubjectDigest != subject.Digest || approval.ScopeDigest != scopeDigest) throw InvalidResponse();
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            var recordCandidateResult = ParseRequiredEnum(
                candidateElement,
                "candidateResult",
                "baseline-proposal-candidate", "blocked", "incomplete", "restoration-candidate",
                "supersession-candidate", "withdrawal-candidate");
            var recordReviewState = ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review");
            string? designationKind = null;
            if (candidateElement.TryGetProperty("designationKind", out _))
            {
                designationKind = ParseRequiredEnum(
                    candidateElement,
                    "designationKind",
                    "propose-baseline-candidate", "restore-baseline-candidate",
                    "supersede-baseline-candidate", "withdraw-baseline-candidate");
            }
            string? designationDigest = null;
            if (candidateElement.TryGetProperty("designationDigest", out _))
            {
                designationDigest = ParseRequiredDigest(candidateElement, "designationDigest");
            }
            if ((designationKind is null) != (designationDigest is null)) throw InvalidResponse();
            DesignBaselinePredecessorView? supersedes = null;
            if (candidateElement.TryGetProperty("supersedes", out var predecessorElement))
            {
                if (!HasOnlyProperties(
                        predecessorElement,
                        "recordId", "revision", "digest", "membershipDigest", "baselineLineageId", "semanticVersion"))
                {
                    throw InvalidResponse();
                }
                supersedes = new DesignBaselinePredecessorView(
                    ParseRequiredGuid(predecessorElement, "recordId"),
                    ParsePositiveLong(predecessorElement, "revision"),
                    ParseRequiredDigest(predecessorElement, "digest"),
                    ParseRequiredDigest(predecessorElement, "membershipDigest"),
                    ParseRequiredGuid(predecessorElement, "baselineLineageId"),
                    ParseSemanticVersion(predecessorElement, "semanticVersion"));
            }
            candidate = new DesignBaselineRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                approval,
                subject,
                scopeDigest,
                ParseRequiredGuid(candidateElement, "baselineLineageId"),
                ParseRequiredGuid(candidateElement, "candidateSetId"),
                ParsePositiveLong(candidateElement, "candidateSetRevision"),
                ParseSemanticVersion(candidateElement, "semanticVersion"),
                ParseRequiredDigest(candidateElement, "versionPolicyDigest"),
                ParseRequiredDigest(candidateElement, "designationDefinitionDigest"),
                ParseRequiredDigest(candidateElement, "designationReceiptDigest"),
                designationKind,
                designationDigest,
                supersedes,
                recordCandidateResult,
                recordReviewState);
            if (candidate.CandidateResult != candidateResult || candidate.ReviewState != reviewState ||
                (designationKind == "propose-baseline-candidate" && supersedes is not null) ||
                (designationKind is not null && designationKind != "propose-baseline-candidate" && supersedes is null))
            {
                throw InvalidResponse();
            }
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignBaselineProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, candidateResult, reviewState, assessmentState, candidateSetCount,
            designationCandidateCount, supersessionCandidateCount, withdrawalCandidateCount,
            restorationCandidateCount, expiredDesignationCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, approvalDeterminationState, baselineDesignationState,
            Array.AsReadOnly(reasons), candidate, snapshotDigest);
    }

    private static string ParseSemanticVersion(JsonElement element, string property)
    {
        var value = ParseSourceText(element.GetProperty(property), 1, 256);
        return Regex.IsMatch(value, @"^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$",
            RegexOptions.CultureInvariant) ? value : throw InvalidResponse();
    }
}
