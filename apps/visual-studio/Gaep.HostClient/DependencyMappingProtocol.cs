using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DependencyMappingProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-graph-critical-path-assessment-snapshot-digests-only-not-unit-node-edge-evidence-rationale-estimate-owner-repository-module-requirement-architecture-risk-test-or-personal-data-secrets-credentials-or-machine-paths";
    private const string DependencyMappingProjectionAuthorityBoundary =
        "dependency-mapping-projection-is-read-only-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority";
    private const string DependencyMappingStatusAuthorityBoundary =
        "dependency-mapping-status-is-observational-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority";

    internal static DependencyMappingProjection ParseDependencyMappingResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "dependency-mapping-projection") != "dependency-mapping-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DependencyMappingProjectionPrivacyBoundary) != DependencyMappingProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DependencyMappingProjectionAuthorityBoundary) != DependencyMappingProjectionAuthorityBoundary)
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
                    "nodeCount", "edgeCount", "requiredEdgeCount", "conditionalEdgeCount", "advisoryEdgeCount",
                    "rootNodeCount", "leafNodeCount", "criticalPathUnitCount", "criticalPathCandidateEffortPoints",
                    "missingNodeCount", "missingDeclaredEdgeCount", "extraEdgeCount", "invalidNodeCount",
                    "invalidEdgeCount", "cycleCount", "staleBindingCount", "staleHierarchyCount",
                    "staleMvpSliceDefinitionCount", "staleImplementationUnitModelCount", "unresolvedQuestionCount",
                    "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "hierarchy", "mvpSliceDefinition", "implementationUnitModel"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "dependency-mapping-status") != "dependency-mapping-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DependencyMappingStatusAuthorityBoundary) != DependencyMappingStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var hierarchyReference = ParseBusinessReference(status, "hierarchy");
        var mvpReference = ParseBusinessReference(status, "mvpSliceDefinition");
        var implementationUnitModelReference = ParseBusinessReference(status, "implementationUnitModel");
        var nodeCount = ParseBoundedNonNegativeInt(status, "nodeCount", 10_000);
        var edgeCount = ParseBoundedNonNegativeInt(status, "edgeCount", 1_000_000);
        var requiredEdgeCount = ParseBoundedNonNegativeInt(status, "requiredEdgeCount", 1_000_000);
        var conditionalEdgeCount = ParseBoundedNonNegativeInt(status, "conditionalEdgeCount", 1_000_000);
        var advisoryEdgeCount = ParseBoundedNonNegativeInt(status, "advisoryEdgeCount", 1_000_000);
        if (requiredEdgeCount + conditionalEdgeCount + advisoryEdgeCount != edgeCount) throw InvalidResponse();
        var rootNodeCount = ParseBoundedNonNegativeInt(status, "rootNodeCount", 10_000);
        var leafNodeCount = ParseBoundedNonNegativeInt(status, "leafNodeCount", 10_000);
        var criticalPathUnitCount = ParseBoundedNonNegativeInt(status, "criticalPathUnitCount", 10_000);
        var criticalPathCandidateEffortPoints = ParseBoundedNonNegativeInt(status, "criticalPathCandidateEffortPoints", 1_000_000_000);
        var missingNodeCount = ParseBoundedNonNegativeInt(status, "missingNodeCount", 10_000);
        var missingDeclaredEdgeCount = ParseBoundedNonNegativeInt(status, "missingDeclaredEdgeCount", 1_000_000);
        var extraEdgeCount = ParseBoundedNonNegativeInt(status, "extraEdgeCount", 1_000_000);
        var invalidNodeCount = ParseBoundedNonNegativeInt(status, "invalidNodeCount", 10_000);
        var invalidEdgeCount = ParseBoundedNonNegativeInt(status, "invalidEdgeCount", 1_000_000);
        var cycleCount = ParseBoundedNonNegativeInt(status, "cycleCount", 1);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleHierarchyCount = ParseBoundedNonNegativeInt(status, "staleHierarchyCount", 1);
        var staleMvpSliceDefinitionCount = ParseBoundedNonNegativeInt(status, "staleMvpSliceDefinitionCount", 1);
        var staleImplementationUnitModelCount = ParseBoundedNonNegativeInt(status, "staleImplementationUnitModelCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = missingNodeCount + missingDeclaredEdgeCount + extraEdgeCount + invalidNodeCount + invalidEdgeCount +
            cycleCount + staleBindingCount + staleHierarchyCount + staleMvpSliceDefinitionCount +
            staleImplementationUnitModelCount + unresolvedQuestionCount;
        var allDependenciesPresent = hierarchyReference is not null && mvpReference is not null && implementationUnitModelReference is not null;
        if ((state == "candidate-complete" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null ||
                    !allDependenciesPresent || criticalPathUnitCount < 1)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DependencyMappingRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "graphDigest", "criticalPathDigest",
                    "assessmentReceiptDigest", "nodeCount", "edgeCount", "criticalPathUnitCount",
                    "criticalPathCandidateEffortPoints", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DependencyMappingRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "graphDigest"),
                ParseRequiredDigest(candidateElement, "criticalPathDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "nodeCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "edgeCount", 1_000_000),
                ParseBoundedNonNegativeInt(candidateElement, "criticalPathUnitCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "criticalPathCandidateEffortPoints", 1_000_000_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.NodeCount ?? 0) != nodeCount || (candidate?.EdgeCount ?? 0) != edgeCount ||
            (candidate?.CriticalPathUnitCount ?? 0) != criticalPathUnitCount ||
            (candidate?.CriticalPathCandidateEffortPoints ?? 0) != criticalPathCandidateEffortPoints ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DependencyMappingProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            hierarchyReference?.Id, hierarchyReference?.Revision, hierarchyReference?.Digest,
            mvpReference?.Id, mvpReference?.Revision, mvpReference?.Digest,
            implementationUnitModelReference?.Id, implementationUnitModelReference?.Revision, implementationUnitModelReference?.Digest,
            nodeCount, edgeCount, requiredEdgeCount, conditionalEdgeCount, advisoryEdgeCount,
            rootNodeCount, leafNodeCount, criticalPathUnitCount, criticalPathCandidateEffortPoints,
            missingNodeCount, missingDeclaredEdgeCount, extraEdgeCount, invalidNodeCount, invalidEdgeCount,
            cycleCount, staleBindingCount, staleHierarchyCount, staleMvpSliceDefinitionCount,
            staleImplementationUnitModelCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
