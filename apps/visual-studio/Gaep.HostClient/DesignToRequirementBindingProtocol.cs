using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignToRequirementBindingProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-external-identities-requirement-text-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string DesignToRequirementBindingProjectionAuthorityBoundary =
        "design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority";
    private const string DesignToRequirementBindingStatusAuthorityBoundary =
        "design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority";

    internal static DesignToRequirementBindingProjection ParseDesignToRequirementBindingResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-to-requirement-binding-projection") != "design-to-requirement-binding-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignToRequirementBindingProjectionPrivacyBoundary) != DesignToRequirementBindingProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignToRequirementBindingProjectionAuthorityBoundary) != DesignToRequirementBindingProjectionAuthorityBoundary)
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
                    "bindingCount", "humanReviewedBindingCount", "designItemCount", "boundDesignItemCount",
                    "unboundDesignItemCount", "requirementCount", "boundRequirementCount", "unboundRequirementCount",
                    "decisionCount", "boundDecisionCount", "unboundDecisionCount", "openConflictCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "reconciliationState",
                    "candidateCoverageState", "provenanceState", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-to-requirement-binding-status") != "design-to-requirement-binding-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignToRequirementBindingStatusAuthorityBoundary) != DesignToRequirementBindingStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var bindingCount = ParseBoundedNonNegativeInt(status, "bindingCount", 131_072);
        var humanReviewedBindingCount = ParseBoundedNonNegativeInt(status, "humanReviewedBindingCount", 131_072);
        var designItemCount = ParseBoundedNonNegativeInt(status, "designItemCount", 131_072);
        var boundDesignItemCount = ParseBoundedNonNegativeInt(status, "boundDesignItemCount", 131_072);
        var unboundDesignItemCount = ParseBoundedNonNegativeInt(status, "unboundDesignItemCount", 131_072);
        var requirementCount = ParseBoundedNonNegativeInt(status, "requirementCount", 131_072);
        var boundRequirementCount = ParseBoundedNonNegativeInt(status, "boundRequirementCount", 131_072);
        var unboundRequirementCount = ParseBoundedNonNegativeInt(status, "unboundRequirementCount", 131_072);
        var decisionCount = ParseBoundedNonNegativeInt(status, "decisionCount", 131_072);
        var boundDecisionCount = ParseBoundedNonNegativeInt(status, "boundDecisionCount", 131_072);
        var unboundDecisionCount = ParseBoundedNonNegativeInt(status, "unboundDecisionCount", 131_072);
        if (humanReviewedBindingCount > bindingCount || boundDesignItemCount + unboundDesignItemCount != designItemCount ||
            boundRequirementCount + unboundRequirementCount != requirementCount ||
            boundDecisionCount + unboundDecisionCount != decisionCount)
        {
            throw InvalidResponse();
        }
        var openConflictCount = ParseBoundedNonNegativeInt(status, "openConflictCount", 1_024);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reconciliationState = ParseRequiredEnum(status, "reconciliationState", "exact", "partial", "not-assessed");
        var candidateCoverageState = ParseRequiredEnum(status, "candidateCoverageState", "candidate-complete", "partial", "not-assessed");
        var provenanceState = ParseRequiredEnum(status, "provenanceState", "exact", "partial", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = bindingCount - humanReviewedBindingCount + unboundDesignItemCount + unboundRequirementCount +
            unboundDecisionCount + openConflictCount + staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || bindingCount == 0 || reconciliationState != "exact" ||
                    candidateCoverageState != "candidate-complete" || provenanceState != "exact" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignToRequirementBindingRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "finalizedSnapshot",
                    "designRequirements", "decisionRegister", "reconciliationDigest", "bindingCount",
                    "designItemCoverageCount", "subjectCoverageCount", "conflictCount", "reconciliationState",
                    "candidateCoverageState", "provenanceState", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignToRequirementBindingRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseDesignToRequirementDependency(candidateElement.GetProperty("finalizedSnapshot"), "itemCatalogDigest"),
                ParseDesignToRequirementDependency(candidateElement.GetProperty("designRequirements"), "requirementCatalogDigest"),
                ParseDesignToRequirementDependency(candidateElement.GetProperty("decisionRegister"), "decisionCatalogDigest"),
                ParseRequiredDigest(candidateElement, "reconciliationDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "bindingCount", 131_072),
                ParseBoundedNonNegativeInt(candidateElement, "designItemCoverageCount", 131_072),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCoverageCount", 262_144),
                ParseBoundedNonNegativeInt(candidateElement, "conflictCount", 1_024),
                ParseRequiredEnum(candidateElement, "reconciliationState", "exact", "partial", "not-assessed"),
                ParseRequiredEnum(candidateElement, "candidateCoverageState", "candidate-complete", "partial", "not-assessed"),
                ParseRequiredEnum(candidateElement, "provenanceState", "exact", "partial", "not-assessed"),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate is not null &&
                (candidate.BindingCount != bindingCount || candidate.DesignItemCoverageCount != designItemCount ||
                    candidate.SubjectCoverageCount != requirementCount + decisionCount ||
                    candidate.ReconciliationState != reconciliationState || candidate.CandidateCoverageState != candidateCoverageState ||
                    candidate.ProvenanceState != provenanceState || candidate.ReviewState != reviewState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignToRequirementBindingProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, reconciliationState, candidateCoverageState,
            provenanceState, Array.AsReadOnly(reasons), bindingCount, humanReviewedBindingCount, designItemCount,
            boundDesignItemCount, unboundDesignItemCount, requirementCount, boundRequirementCount,
            unboundRequirementCount, decisionCount, boundDecisionCount, unboundDecisionCount,
            openConflictCount, staleBindingCount, staleSourceReferenceCount, unresolvedQuestionCount,
            candidate, snapshotDigest);
    }

    private static DesignToRequirementDependencyBindingView ParseDesignToRequirementDependency(
        JsonElement value,
        string catalogProperty)
    {
        if (!HasOnlyProperties(value, "recordId", "revision", "digest", "membershipDigest", catalogProperty))
        {
            throw InvalidResponse();
        }
        return new DesignToRequirementDependencyBindingView(
            ParseRequiredGuid(value, "recordId"),
            ParsePositiveLong(value, "revision"),
            ParseRequiredDigest(value, "digest"),
            ParseRequiredDigest(value, "membershipDigest"),
            ParseRequiredDigest(value, catalogProperty));
    }
}
