using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignRequirementsProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials";
    private const string DesignRequirementsProjectionAuthorityBoundary =
        "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority";
    private const string DesignRequirementsStatusAuthorityBoundary =
        "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority";

    internal static DesignRequirementsProjection ParseDesignRequirementsResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-requirements-projection") != "design-requirements-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignRequirementsProjectionPrivacyBoundary) != DesignRequirementsProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignRequirementsProjectionAuthorityBoundary) != DesignRequirementsProjectionAuthorityBoundary)
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
                    "requirementCount", "mustPriorityCount", "representedOutcomeCount", "unresolvedOutcomeCount",
                    "linkedBacklogRequirementCount", "notPlannedRequirementCount", "unresolvedBacklogRequirementCount",
                    "workItemCount", "weakEvidenceRequirementCount", "staleBindingCount", "staleDomainReferenceCount",
                    "staleSourceReferenceCount", "unresolvedQuestionCount", "catalogCompletenessState", "reviewState",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-requirements-status") != "design-requirements-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignRequirementsStatusAuthorityBoundary) != DesignRequirementsStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var requirementCount = ParseBoundedNonNegativeInt(status, "requirementCount", 4_096);
        var mustPriorityCount = ParseBoundedNonNegativeInt(status, "mustPriorityCount", 4_096);
        var representedOutcomeCount = ParseBoundedNonNegativeInt(status, "representedOutcomeCount", 256);
        var unresolvedOutcomeCount = ParseBoundedNonNegativeInt(status, "unresolvedOutcomeCount", 256);
        var linkedBacklogRequirementCount = ParseBoundedNonNegativeInt(status, "linkedBacklogRequirementCount", 4_096);
        var notPlannedRequirementCount = ParseBoundedNonNegativeInt(status, "notPlannedRequirementCount", 4_096);
        var unresolvedBacklogRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedBacklogRequirementCount", 4_096);
        var workItemCount = ParseBoundedNonNegativeInt(status, "workItemCount", 1_048_576);
        var weakEvidenceRequirementCount = ParseBoundedNonNegativeInt(status, "weakEvidenceRequirementCount", 4_096);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleDomainReferenceCount = ParseBoundedNonNegativeInt(status, "staleDomainReferenceCount", 1_048_576);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (mustPriorityCount > requirementCount ||
            linkedBacklogRequirementCount + notPlannedRequirementCount + unresolvedBacklogRequirementCount > requirementCount)
        {
            throw InvalidResponse();
        }
        var catalogCompletenessState = ParseRequiredEnum(status, "catalogCompletenessState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedOutcomeCount + unresolvedBacklogRequirementCount + weakEvidenceRequirementCount +
            staleBindingCount + staleDomainReferenceCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || catalogCompletenessState != "candidate-complete" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignRequirementsRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "requirementCount",
                    "representedOutcomeCount", "workItemCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignRequirementsRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "requirementCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "representedOutcomeCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "workItemCount", 1_048_576),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.RequirementCount ?? 0) != requirementCount ||
            (candidate?.RepresentedOutcomeCount ?? 0) != representedOutcomeCount ||
            (candidate?.WorkItemCount ?? 0) != workItemCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignRequirementsProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, catalogCompletenessState, Array.AsReadOnly(reasons),
            requirementCount, mustPriorityCount, representedOutcomeCount, unresolvedOutcomeCount,
            linkedBacklogRequirementCount, notPlannedRequirementCount, unresolvedBacklogRequirementCount,
            workItemCount, weakEvidenceRequirementCount, staleBindingCount, staleDomainReferenceCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
