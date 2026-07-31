using System.Collections.ObjectModel;
using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string TestInventoryProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-test-catalog-coverage-trace-ownership-assessment-snapshot-digests-only-not-test-titles-paths-code-steps-data-owner-evidence-results-personal-data-secrets-credentials-or-machine-paths";
    private const string TestInventoryProjectionAuthorityBoundary =
        "test-inventory-projection-is-read-only-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority";
    private const string TestInventoryStatusAuthorityBoundary =
        "test-inventory-status-is-observational-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority";

    internal static TestInventoryProjection ParseTestInventoryResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "test-inventory-projection") != "test-inventory-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", TestInventoryProjectionPrivacyBoundary) != TestInventoryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", TestInventoryProjectionAuthorityBoundary) != TestInventoryProjectionAuthorityBoundary)
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

        string[] dependencyNames =
        [
            "acceptanceCriteria", "riskRegister", "implementationUnitModel",
            "routeScreenComponentMapping", "testMethodology",
        ];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "sourceCriterionCount", "sourceRiskCount", "sourceUnitCount", "sourceMappingSubjectCount",
                    "sourceMethodologyScopeCount", "assetCount", "catalogedAssetCount", "conflictAssetCount",
                    "missingAssetCount", "deferredAssetCount", "notAssessedAssetCount", "observedAssetCount",
                    "plannedAssetCount", "automatedAssetCount", "manualAssetCount", "duplicateIdentityCount",
                    "orphanAssetCount", "uncoveredCriterionCount", "uncoveredRiskCount", "uncoveredUnitCount",
                    "uncoveredMappingSubjectCount", "uncoveredMethodologyScopeCount", "ownershipGapCount",
                    "traceGapCount", "evidenceGapCount", "staleBindingCount", "staleDependencyCount",
                    "invalidCandidateCount", "unresolvedQuestionCount", "reviewState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate", .. dependencyNames]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "test-inventory-status") != "test-inventory-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", TestInventoryStatusAuthorityBoundary) != TestInventoryStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var candidateReference = ParseBusinessReference(status, "candidate");
        var dependencies = new Dictionary<string, TestInventoryReference>(StringComparer.Ordinal);
        foreach (var name in dependencyNames)
        {
            var reference = ParseBusinessReference(status, name);
            if (reference is not null) dependencies.Add(name, new TestInventoryReference(reference.Id, reference.Revision, reference.Digest));
        }
        int Count(string name, int maximum = 65_536) => ParseBoundedNonNegativeInt(status, name, maximum);
        var sourceCriterionCount = Count("sourceCriterionCount");
        var sourceRiskCount = Count("sourceRiskCount", 4_096);
        var sourceUnitCount = Count("sourceUnitCount");
        var sourceMappingSubjectCount = Count("sourceMappingSubjectCount");
        var sourceMethodologyScopeCount = Count("sourceMethodologyScopeCount");
        var assetCount = Count("assetCount");
        var catalogedAssetCount = Count("catalogedAssetCount");
        var conflictAssetCount = Count("conflictAssetCount");
        var missingAssetCount = Count("missingAssetCount");
        var deferredAssetCount = Count("deferredAssetCount");
        var notAssessedAssetCount = Count("notAssessedAssetCount");
        if ((long)catalogedAssetCount + conflictAssetCount + missingAssetCount + deferredAssetCount + notAssessedAssetCount != assetCount)
            throw InvalidResponse();
        var observedAssetCount = Count("observedAssetCount");
        var plannedAssetCount = Count("plannedAssetCount");
        var automatedAssetCount = Count("automatedAssetCount");
        var manualAssetCount = Count("manualAssetCount");
        var duplicateIdentityCount = Count("duplicateIdentityCount");
        var orphanAssetCount = Count("orphanAssetCount");
        var uncoveredCriterionCount = Count("uncoveredCriterionCount");
        var uncoveredRiskCount = Count("uncoveredRiskCount", 4_096);
        var uncoveredUnitCount = Count("uncoveredUnitCount");
        var uncoveredMappingSubjectCount = Count("uncoveredMappingSubjectCount");
        var uncoveredMethodologyScopeCount = Count("uncoveredMethodologyScopeCount");
        var ownershipGapCount = Count("ownershipGapCount");
        var traceGapCount = Count("traceGapCount");
        var evidenceGapCount = Count("evidenceGapCount");
        var staleBindingCount = Count("staleBindingCount", 1);
        var staleDependencyCount = Count("staleDependencyCount", 5);
        var invalidCandidateCount = Count("invalidCandidateCount", 1);
        var unresolvedQuestionCount = Count("unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)conflictAssetCount + missingAssetCount + deferredAssetCount + notAssessedAssetCount +
            duplicateIdentityCount + orphanAssetCount + uncoveredCriterionCount + uncoveredRiskCount + uncoveredUnitCount +
            uncoveredMappingSubjectCount + uncoveredMethodologyScopeCount + ownershipGapCount + traceGapCount +
            evidenceGapCount + staleBindingCount + staleDependencyCount + invalidCandidateCount + unresolvedQuestionCount;
        if ((state == "candidate-complete" &&
                (gaps > 0 || candidateReference is null || dependencies.Count != dependencyNames.Length ||
                    catalogedAssetCount != assetCount || reviewState != "ready-for-human-review" || reasons.Length > 0)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        TestInventoryRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "catalogReceiptDigest", "coverageReceiptDigest",
                    "traceReceiptDigest", "ownershipReceiptDigest", "assessmentReceiptDigest", "assetCount",
                    "catalogedAssetCount", "conflictAssetCount", "observedAssetCount", "plannedAssetCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new TestInventoryRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "catalogReceiptDigest"),
                ParseRequiredDigest(candidateElement, "coverageReceiptDigest"),
                ParseRequiredDigest(candidateElement, "traceReceiptDigest"),
                ParseRequiredDigest(candidateElement, "ownershipReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "assetCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "catalogedAssetCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "conflictAssetCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "observedAssetCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "plannedAssetCount", 65_536),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is null) == (dependencies.Count == dependencyNames.Length) ||
            (candidate?.AssetCount ?? 0) != assetCount || (candidate?.CatalogedAssetCount ?? 0) != catalogedAssetCount ||
            (candidate?.ConflictAssetCount ?? 0) != conflictAssetCount || (candidate?.ObservedAssetCount ?? 0) != observedAssetCount ||
            (candidate?.PlannedAssetCount ?? 0) != plannedAssetCount || (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new TestInventoryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            new ReadOnlyDictionary<string, TestInventoryReference>(dependencies),
            sourceCriterionCount, sourceRiskCount, sourceUnitCount, sourceMappingSubjectCount,
            sourceMethodologyScopeCount, assetCount, catalogedAssetCount, conflictAssetCount, missingAssetCount,
            deferredAssetCount, notAssessedAssetCount, observedAssetCount, plannedAssetCount, automatedAssetCount,
            manualAssetCount, duplicateIdentityCount, orphanAssetCount, uncoveredCriterionCount, uncoveredRiskCount,
            uncoveredUnitCount, uncoveredMappingSubjectCount, uncoveredMethodologyScopeCount, ownershipGapCount,
            traceGapCount, evidenceGapCount, staleBindingCount, staleDependencyCount, invalidCandidateCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
