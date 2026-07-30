using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string MvpSliceDefinitionProjectionPrivacyBoundary =
        "projection-contains-record-identities-scope-and-slice-counts-statuses-and-digests-only-not-slice-titles-rationales-objectives-criteria-scope-content-requirement-content-personal-data-secrets-credentials-or-machine-paths";
    private const string MvpSliceDefinitionProjectionAuthorityBoundary =
        "mvp-slice-definition-projection-is-read-only-and-does-not-prioritize-commit-approve-scope-admit-assign-execute-or-authorize-implementation-or-action";
    private const string MvpSliceDefinitionStatusAuthorityBoundary =
        "mvp-slice-definition-status-is-observational-and-does-not-establish-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority";

    internal static MvpSliceDefinitionProjection ParseMvpSliceDefinitionResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "mvp-slice-definition-projection") != "mvp-slice-definition-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", MvpSliceDefinitionProjectionPrivacyBoundary) != MvpSliceDefinitionProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", MvpSliceDefinitionProjectionAuthorityBoundary) != MvpSliceDefinitionProjectionAuthorityBoundary)
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
                    "scopeNodeCount", "mvpNodeCount", "laterNodeCount", "excludedNodeCount", "sliceCount",
                    "storyCount", "taskCount", "dependencyCount", "unassignedMvpStoryTaskCount", "staleBindingCount",
                    "staleHierarchyCount", "invalidScopeCount", "invalidSliceCount", "unresolvedQuestionCount",
                    "scopeCompletenessState", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "hierarchy"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "mvp-slice-definition-status") != "mvp-slice-definition-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", MvpSliceDefinitionStatusAuthorityBoundary) != MvpSliceDefinitionStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var hierarchyReference = ParseBusinessReference(status, "hierarchy");
        var scopeNodeCount = ParseBoundedNonNegativeInt(status, "scopeNodeCount", 10_000);
        var mvpNodeCount = ParseBoundedNonNegativeInt(status, "mvpNodeCount", 10_000);
        var laterNodeCount = ParseBoundedNonNegativeInt(status, "laterNodeCount", 10_000);
        var excludedNodeCount = ParseBoundedNonNegativeInt(status, "excludedNodeCount", 10_000);
        var sliceCount = ParseBoundedNonNegativeInt(status, "sliceCount", 10_000);
        var storyCount = ParseBoundedNonNegativeInt(status, "storyCount", 10_000);
        var taskCount = ParseBoundedNonNegativeInt(status, "taskCount", 10_000);
        var dependencyCount = ParseBoundedNonNegativeInt(status, "dependencyCount", 1_000_000);
        var unassignedMvpStoryTaskCount = ParseBoundedNonNegativeInt(status, "unassignedMvpStoryTaskCount", 10_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleHierarchyCount = ParseBoundedNonNegativeInt(status, "staleHierarchyCount", 1);
        var invalidScopeCount = ParseBoundedNonNegativeInt(status, "invalidScopeCount", 10_000);
        var invalidSliceCount = ParseBoundedNonNegativeInt(status, "invalidSliceCount", 10_000);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (scopeNodeCount != mvpNodeCount + laterNodeCount + excludedNodeCount) throw InvalidResponse();
        var scopeCompletenessState = ParseRequiredEnum(status, "scopeCompletenessState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unassignedMvpStoryTaskCount + staleBindingCount + staleHierarchyCount + invalidScopeCount +
            invalidSliceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || scopeCompletenessState != "candidate-complete" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null || hierarchyReference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        MvpSliceDefinitionRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "hierarchyDigest", "state", "scopeNodeCount",
                    "mvpNodeCount", "laterNodeCount", "excludedNodeCount", "sliceCount", "storyCount", "taskCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new MvpSliceDefinitionRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseRequiredDigest(candidateElement, "hierarchyDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "scopeNodeCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "mvpNodeCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "laterNodeCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "excludedNodeCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "sliceCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "storyCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "taskCount", 10_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) != (hierarchyReference is null) ||
            (candidate?.ScopeNodeCount ?? 0) != scopeNodeCount || (candidate?.MvpNodeCount ?? 0) != mvpNodeCount ||
            (candidate?.LaterNodeCount ?? 0) != laterNodeCount || (candidate?.ExcludedNodeCount ?? 0) != excludedNodeCount ||
            (candidate?.SliceCount ?? 0) != sliceCount || (candidate?.StoryCount ?? 0) != storyCount ||
            (candidate?.TaskCount ?? 0) != taskCount ||
            (candidate is not null && (candidate.ReviewState != reviewState || candidate.HierarchyDigest != hierarchyReference!.Digest)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new MvpSliceDefinitionProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, scopeCompletenessState, Array.AsReadOnly(reasons),
            hierarchyReference?.Id, hierarchyReference?.Revision, hierarchyReference?.Digest,
            scopeNodeCount, mvpNodeCount, laterNodeCount, excludedNodeCount, sliceCount, storyCount, taskCount,
            dependencyCount, unassignedMvpStoryTaskCount, staleBindingCount, staleHierarchyCount,
            invalidScopeCount, invalidSliceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
