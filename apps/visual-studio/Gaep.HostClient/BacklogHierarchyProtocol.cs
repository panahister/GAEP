using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BacklogHierarchyProjectionPrivacyBoundary =
        "projection-contains-record-identities-level-counts-statuses-and-digests-only-not-backlog-objectives-criteria-scope-owner-requirement-content-personal-data-secrets-credentials-or-machine-paths";
    private const string BacklogHierarchyProjectionAuthorityBoundary =
        "backlog-hierarchy-projection-is-read-only-and-does-not-prioritize-commit-assign-admit-execute-or-authorize-implementation-or-action";
    private const string BacklogHierarchyStatusAuthorityBoundary =
        "backlog-hierarchy-status-is-observational-and-does-not-establish-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority";

    internal static BacklogHierarchyProjection ParseBacklogHierarchyResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "backlog-hierarchy-projection") != "backlog-hierarchy-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", BacklogHierarchyProjectionPrivacyBoundary) != BacklogHierarchyProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", BacklogHierarchyProjectionAuthorityBoundary) != BacklogHierarchyProjectionAuthorityBoundary)
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
                    "nodeCount", "epicCount", "featureCount", "storyCount", "taskCount", "rootCount", "leafCount",
                    "requirementTraceCount", "untracedStoryTaskCount", "staleBindingCount", "staleWorkItemCount",
                    "staleChangeCount", "staleRequirementCount", "unresolvedQuestionCount", "hierarchyCompletenessState",
                    "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "backlog-hierarchy-status") != "backlog-hierarchy-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", BacklogHierarchyStatusAuthorityBoundary) != BacklogHierarchyStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var nodeCount = ParseBoundedNonNegativeInt(status, "nodeCount", 10_000);
        var epicCount = ParseBoundedNonNegativeInt(status, "epicCount", 10_000);
        var featureCount = ParseBoundedNonNegativeInt(status, "featureCount", 10_000);
        var storyCount = ParseBoundedNonNegativeInt(status, "storyCount", 10_000);
        var taskCount = ParseBoundedNonNegativeInt(status, "taskCount", 10_000);
        var rootCount = ParseBoundedNonNegativeInt(status, "rootCount", 10_000);
        var leafCount = ParseBoundedNonNegativeInt(status, "leafCount", 10_000);
        var requirementTraceCount = ParseBoundedNonNegativeInt(status, "requirementTraceCount", 1_000_000);
        var untracedStoryTaskCount = ParseBoundedNonNegativeInt(status, "untracedStoryTaskCount", 10_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleWorkItemCount = ParseBoundedNonNegativeInt(status, "staleWorkItemCount", 10_000);
        var staleChangeCount = ParseBoundedNonNegativeInt(status, "staleChangeCount", 10_000);
        var staleRequirementCount = ParseBoundedNonNegativeInt(status, "staleRequirementCount", 1_000_000);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (nodeCount != epicCount + featureCount + storyCount + taskCount || rootCount > epicCount ||
            leafCount > nodeCount || untracedStoryTaskCount > storyCount + taskCount)
        {
            throw InvalidResponse();
        }
        var hierarchyCompletenessState = ParseRequiredEnum(status, "hierarchyCompletenessState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = untracedStoryTaskCount + staleBindingCount + staleWorkItemCount + staleChangeCount +
            staleRequirementCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || hierarchyCompletenessState != "candidate-complete" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        BacklogHierarchyRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "nodeCount", "epicCount",
                    "featureCount", "storyCount", "taskCount", "requirementTraceCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new BacklogHierarchyRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "nodeCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "epicCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "featureCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "storyCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "taskCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "requirementTraceCount", 1_000_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.NodeCount ?? 0) != nodeCount || (candidate?.EpicCount ?? 0) != epicCount ||
            (candidate?.FeatureCount ?? 0) != featureCount || (candidate?.StoryCount ?? 0) != storyCount ||
            (candidate?.TaskCount ?? 0) != taskCount ||
            (candidate?.RequirementTraceCount ?? 0) != requirementTraceCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BacklogHierarchyProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, hierarchyCompletenessState, Array.AsReadOnly(reasons),
            nodeCount, epicCount, featureCount, storyCount, taskCount, rootCount, leafCount,
            requirementTraceCount, untracedStoryTaskCount, staleBindingCount, staleWorkItemCount,
            staleChangeCount, staleRequirementCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
