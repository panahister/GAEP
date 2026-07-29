using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignerReadyGateProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string DesignerReadyGateProjectionAuthorityBoundary =
        "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority";
    private const string DesignerReadyGateStatusAuthorityBoundary =
        "designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority";
    private const string DesignerReadyGateBoundary =
        "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness";

    internal static DesignerReadyGateProjection ParseDesignerReadyGateResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "designer-ready-gate-projection") != "designer-ready-gate-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignerReadyGateProjectionPrivacyBoundary) != DesignerReadyGateProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignerReadyGateProjectionAuthorityBoundary) != DesignerReadyGateProjectionAuthorityBoundary)
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
                    "prerequisiteCount", "satisfiedCount", "notApplicableCount", "unsatisfiedCount", "notAssessedCount",
                    "staleOrUnknownCount", "humanReviewedCount", "pendingExceptionCount", "grantedExceptionCandidateCount",
                    "invalidExceptionCount", "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount",
                    "candidateResult", "reviewState", "state", "reasons", "assessedAt", "gateBoundary", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "designer-ready-gate-status") != "designer-ready-gate-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "gateBoundary", DesignerReadyGateBoundary) != DesignerReadyGateBoundary ||
            ParseRequiredEnum(status, "authorityBoundary", DesignerReadyGateStatusAuthorityBoundary) != DesignerReadyGateStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var prerequisiteCount = ParseBoundedNonNegativeInt(status, "prerequisiteCount", 12);
        var satisfiedCount = ParseBoundedNonNegativeInt(status, "satisfiedCount", 12);
        var notApplicableCount = ParseBoundedNonNegativeInt(status, "notApplicableCount", 12);
        var unsatisfiedCount = ParseBoundedNonNegativeInt(status, "unsatisfiedCount", 12);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 12);
        var staleOrUnknownCount = ParseBoundedNonNegativeInt(status, "staleOrUnknownCount", 12);
        var humanReviewedCount = ParseBoundedNonNegativeInt(status, "humanReviewedCount", 12);
        var pendingExceptionCount = ParseBoundedNonNegativeInt(status, "pendingExceptionCount", 512);
        var grantedExceptionCandidateCount = ParseBoundedNonNegativeInt(status, "grantedExceptionCandidateCount", 512);
        var invalidExceptionCount = ParseBoundedNonNegativeInt(status, "invalidExceptionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (satisfiedCount + notApplicableCount + unsatisfiedCount + notAssessedCount != prerequisiteCount ||
            humanReviewedCount > prerequisiteCount)
        {
            throw InvalidResponse();
        }
        var candidateResult = ParseRequiredEnum(
            status,
            "candidateResult",
            "blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "not-assessed", "pass-candidate");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-decision");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-human-decision");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var passLike = candidateResult is "conditional-pass-candidate" or "not-applicable-candidate" or "pass-candidate";
        var gapCount = unsatisfiedCount + notAssessedCount + staleOrUnknownCount + pendingExceptionCount +
            invalidExceptionCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-human-decision" &&
                (!passLike || reference is null || prerequisiteCount != 12 || satisfiedCount + notApplicableCount != 12 ||
                    humanReviewedCount != 12 || gapCount > 0 || reviewState != "ready-for-human-decision" || reasons.Length > 0)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignerReadyGateRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "prerequisiteCount",
                    "prerequisiteCatalogDigest", "evaluationCatalogDigest", "exceptionCatalogDigest",
                    "assessmentDefinitionDigest", "assessmentReceiptDigest", "candidateResult", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignerReadyGateRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "prerequisiteCount", 12),
                ParseRequiredDigest(candidateElement, "prerequisiteCatalogDigest"),
                ParseRequiredDigest(candidateElement, "evaluationCatalogDigest"),
                ParseRequiredDigest(candidateElement, "exceptionCatalogDigest"),
                ParseRequiredDigest(candidateElement, "assessmentDefinitionDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseRequiredEnum(candidateElement, "candidateResult", "blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "pass-candidate"),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-decision"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate is not null &&
                (candidate.PrerequisiteCount != 12 || candidate.PrerequisiteCount != prerequisiteCount ||
                    candidate.CandidateResult != candidateResult || candidate.ReviewState != reviewState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignerReadyGateProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, candidateResult, reviewState, assessmentState, Array.AsReadOnly(reasons), prerequisiteCount,
            satisfiedCount, notApplicableCount, unsatisfiedCount, notAssessedCount, staleOrUnknownCount,
            humanReviewedCount, pendingExceptionCount, grantedExceptionCandidateCount, invalidExceptionCount,
            staleBindingCount, staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
