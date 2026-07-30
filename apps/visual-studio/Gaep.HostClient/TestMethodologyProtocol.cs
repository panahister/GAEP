using System.Collections.ObjectModel;
using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string TestMethodologyProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-methodology-scope-environment-data-ownership-trace-assessment-snapshot-digests-only-not-requirement-criterion-method-rationale-environment-address-test-data-owner-evidence-result-personal-data-secrets-credentials-or-machine-paths";
    private const string TestMethodologyProjectionAuthorityBoundary =
        "test-methodology-projection-is-read-only-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority";
    private const string TestMethodologyStatusAuthorityBoundary =
        "test-methodology-status-is-observational-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority";

    internal static TestMethodologyProjection ParseTestMethodologyResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "test-methodology-projection") != "test-methodology-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", TestMethodologyProjectionPrivacyBoundary) != TestMethodologyProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", TestMethodologyProjectionAuthorityBoundary) != TestMethodologyProjectionAuthorityBoundary)
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
            "acceptanceCriteria", "definitionOfReady", "definitionOfDone", "implementationUnitModel",
            "dependencyMapping", "securityPrivacyAssessment", "routeScreenComponentMapping",
        ];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "sourceUnitCount", "sourceRequirementCount", "sourceCriterionCount", "sourceMappingSubjectCount",
                    "scopeCount", "decisionCount", "selectedDecisionCount", "conflictDecisionCount",
                    "notApplicableDecisionCount", "deferredDecisionCount", "notAssessedDecisionCount",
                    "environmentCount", "dataPolicyCount", "evidenceExpectationCount", "entryCriterionCount",
                    "exitCriterionCount", "missingScopeCount", "extraScopeCount", "invalidDecisionCount",
                    "environmentGapCount", "dataPolicyGapCount", "ownershipGapCount", "traceGapCount",
                    "evidenceGapCount", "criterionGapCount", "staleBindingCount", "staleDependencyCount",
                    "invalidCandidateCount", "unresolvedQuestionCount", "reviewState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate", .. dependencyNames]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "test-methodology-status") != "test-methodology-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", TestMethodologyStatusAuthorityBoundary) != TestMethodologyStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var candidateReference = ParseBusinessReference(status, "candidate");
        var dependencies = new Dictionary<string, TestMethodologyReference>(StringComparer.Ordinal);
        foreach (var name in dependencyNames)
        {
            var reference = ParseBusinessReference(status, name);
            if (reference is not null) dependencies.Add(name, new TestMethodologyReference(reference.Id, reference.Revision, reference.Digest));
        }
        int Count(string name, int maximum = 65_536) => ParseBoundedNonNegativeInt(status, name, maximum);
        var sourceUnitCount = Count("sourceUnitCount");
        var sourceRequirementCount = Count("sourceRequirementCount");
        var sourceCriterionCount = Count("sourceCriterionCount");
        var sourceMappingSubjectCount = Count("sourceMappingSubjectCount");
        var scopeCount = Count("scopeCount");
        var decisionCount = Count("decisionCount");
        var selectedDecisionCount = Count("selectedDecisionCount");
        var conflictDecisionCount = Count("conflictDecisionCount");
        var notApplicableDecisionCount = Count("notApplicableDecisionCount");
        var deferredDecisionCount = Count("deferredDecisionCount");
        var notAssessedDecisionCount = Count("notAssessedDecisionCount");
        if ((long)selectedDecisionCount + conflictDecisionCount + notApplicableDecisionCount + deferredDecisionCount + notAssessedDecisionCount != decisionCount)
            throw InvalidResponse();
        var environmentCount = Count("environmentCount", 4_096);
        var dataPolicyCount = Count("dataPolicyCount", 4_096);
        var evidenceExpectationCount = Count("evidenceExpectationCount", 8_192);
        var entryCriterionCount = Count("entryCriterionCount", 8_192);
        var exitCriterionCount = Count("exitCriterionCount", 8_192);
        var missingScopeCount = Count("missingScopeCount");
        var extraScopeCount = Count("extraScopeCount");
        var invalidDecisionCount = Count("invalidDecisionCount");
        var environmentGapCount = Count("environmentGapCount", 4_096);
        var dataPolicyGapCount = Count("dataPolicyGapCount", 4_096);
        var ownershipGapCount = Count("ownershipGapCount");
        var traceGapCount = Count("traceGapCount");
        var evidenceGapCount = Count("evidenceGapCount");
        var criterionGapCount = Count("criterionGapCount", 8_192);
        var staleBindingCount = Count("staleBindingCount", 1);
        var staleDependencyCount = Count("staleDependencyCount", 7);
        var invalidCandidateCount = Count("invalidCandidateCount", 1);
        var unresolvedQuestionCount = Count("unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)conflictDecisionCount + deferredDecisionCount + notAssessedDecisionCount + missingScopeCount +
            extraScopeCount + invalidDecisionCount + environmentGapCount + dataPolicyGapCount + ownershipGapCount +
            traceGapCount + evidenceGapCount + criterionGapCount + staleBindingCount + staleDependencyCount +
            invalidCandidateCount + unresolvedQuestionCount;
        if ((state == "candidate-complete" &&
                (gaps > 0 || candidateReference is null || dependencies.Count != dependencyNames.Length ||
                    scopeCount != sourceUnitCount || selectedDecisionCount != decisionCount ||
                    reviewState != "ready-for-human-review" || entryCriterionCount == 0 || exitCriterionCount == 0 ||
                    reasons.Length > 0)) || (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        TestMethodologyRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "scopeCatalogDigest", "methodologyReceiptDigest",
                    "environmentReceiptDigest", "dataPolicyReceiptDigest", "ownershipReceiptDigest", "traceReceiptDigest",
                    "assessmentReceiptDigest", "scopeCount", "decisionCount", "selectedDecisionCount",
                    "conflictDecisionCount", "environmentCount", "dataPolicyCount", "evidenceExpectationCount",
                    "entryCriterionCount", "exitCriterionCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new TestMethodologyRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "scopeCatalogDigest"),
                ParseRequiredDigest(candidateElement, "methodologyReceiptDigest"),
                ParseRequiredDigest(candidateElement, "environmentReceiptDigest"),
                ParseRequiredDigest(candidateElement, "dataPolicyReceiptDigest"),
                ParseRequiredDigest(candidateElement, "ownershipReceiptDigest"),
                ParseRequiredDigest(candidateElement, "traceReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "scopeCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "decisionCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "selectedDecisionCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "conflictDecisionCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "environmentCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "dataPolicyCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "evidenceExpectationCount", 8_192),
                ParseBoundedNonNegativeInt(candidateElement, "entryCriterionCount", 8_192),
                ParseBoundedNonNegativeInt(candidateElement, "exitCriterionCount", 8_192),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is null) == (dependencies.Count == dependencyNames.Length) ||
            (candidate?.ScopeCount ?? 0) != scopeCount || (candidate?.DecisionCount ?? 0) != decisionCount ||
            (candidate?.SelectedDecisionCount ?? 0) != selectedDecisionCount ||
            (candidate?.ConflictDecisionCount ?? 0) != conflictDecisionCount ||
            (candidate?.EnvironmentCount ?? 0) != environmentCount || (candidate?.DataPolicyCount ?? 0) != dataPolicyCount ||
            (candidate?.EvidenceExpectationCount ?? 0) != evidenceExpectationCount ||
            (candidate?.EntryCriterionCount ?? 0) != entryCriterionCount ||
            (candidate?.ExitCriterionCount ?? 0) != exitCriterionCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new TestMethodologyProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            new ReadOnlyDictionary<string, TestMethodologyReference>(dependencies),
            sourceUnitCount, sourceRequirementCount, sourceCriterionCount, sourceMappingSubjectCount, scopeCount,
            decisionCount, selectedDecisionCount, conflictDecisionCount, notApplicableDecisionCount,
            deferredDecisionCount, notAssessedDecisionCount, environmentCount, dataPolicyCount,
            evidenceExpectationCount, entryCriterionCount, exitCriterionCount, missingScopeCount, extraScopeCount,
            invalidDecisionCount, environmentGapCount, dataPolicyGapCount, ownershipGapCount, traceGapCount,
            evidenceGapCount, criterionGapCount, staleBindingCount, staleDependencyCount, invalidCandidateCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
