using System.Collections.ObjectModel;
using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string RouteScreenComponentMappingProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-subject-relationship-trace-mapping-assessment-snapshot-digests-only-not-route-pattern-screen-state-component-design-requirement-criterion-unit-repository-module-path-symbol-test-hook-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths";
    private const string RouteScreenComponentMappingProjectionAuthorityBoundary =
        "route-screen-component-mapping-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string RouteScreenComponentMappingStatusAuthorityBoundary =
        "route-screen-component-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static RouteScreenComponentMappingProjection ParseRouteScreenComponentMappingResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "route-screen-component-mapping-projection") != "route-screen-component-mapping-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", RouteScreenComponentMappingProjectionPrivacyBoundary) != RouteScreenComponentMappingProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", RouteScreenComponentMappingProjectionAuthorityBoundary) != RouteScreenComponentMappingProjectionAuthorityBoundary)
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
            "informationArchitecture", "screenStateInventory", "designRequirements", "designBaseline",
            "designToRequirementBinding", "figmaToBoilerplateMapping", "designToCodeBindingRegistry",
            "implementationUnitModel", "acceptanceCriteria",
        ];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(
                status,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "sourceRouteCount", "sourceScreenCount", "sourceStateCount", "sourceComponentCount",
                    "subjectCount", "routeSubjectCount", "screenSubjectCount", "stateSubjectCount", "componentSubjectCount",
                    "mappedCandidateCount", "conflictCandidateCount", "unmappedCandidateCount", "notAssessedCount",
                    "relationshipCount", "definedRelationshipCount", "conflictRelationshipCount", "notAssessedRelationshipCount",
                    "missingSubjectCount", "extraSubjectCount", "invalidSubjectCount", "missingRelationshipCount",
                    "invalidRelationshipCount", "traceGapCount", "evidenceGapCount", "componentPlacementGapCount",
                    "testHookGapCount", "staleBindingCount", "staleDependencyCount", "invalidCandidateCount",
                    "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", .. dependencyNames]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "route-screen-component-mapping-status") != "route-screen-component-mapping-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", RouteScreenComponentMappingStatusAuthorityBoundary) != RouteScreenComponentMappingStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var candidateReference = ParseBusinessReference(status, "candidate");
        var dependencies = new Dictionary<string, RouteScreenComponentMappingReference>(StringComparer.Ordinal);
        foreach (var name in dependencyNames)
        {
            var reference = ParseBusinessReference(status, name);
            if (reference is not null)
                dependencies.Add(name, new RouteScreenComponentMappingReference(reference.Id, reference.Revision, reference.Digest));
        }

        var sourceRouteCount = ParseBoundedNonNegativeInt(status, "sourceRouteCount", 32_768);
        var sourceScreenCount = ParseBoundedNonNegativeInt(status, "sourceScreenCount", 32_768);
        var sourceStateCount = ParseBoundedNonNegativeInt(status, "sourceStateCount", 32_768);
        var sourceComponentCount = ParseBoundedNonNegativeInt(status, "sourceComponentCount", 32_768);
        var subjectCount = ParseBoundedNonNegativeInt(status, "subjectCount", 32_768);
        var routeSubjectCount = ParseBoundedNonNegativeInt(status, "routeSubjectCount", 32_768);
        var screenSubjectCount = ParseBoundedNonNegativeInt(status, "screenSubjectCount", 32_768);
        var stateSubjectCount = ParseBoundedNonNegativeInt(status, "stateSubjectCount", 32_768);
        var componentSubjectCount = ParseBoundedNonNegativeInt(status, "componentSubjectCount", 32_768);
        if ((long)routeSubjectCount + screenSubjectCount + stateSubjectCount + componentSubjectCount != subjectCount)
            throw InvalidResponse();
        var mappedCandidateCount = ParseBoundedNonNegativeInt(status, "mappedCandidateCount", 32_768);
        var conflictCandidateCount = ParseBoundedNonNegativeInt(status, "conflictCandidateCount", 32_768);
        var unmappedCandidateCount = ParseBoundedNonNegativeInt(status, "unmappedCandidateCount", 32_768);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 32_768);
        if ((long)mappedCandidateCount + conflictCandidateCount + unmappedCandidateCount + notAssessedCount != subjectCount)
            throw InvalidResponse();
        var relationshipCount = ParseBoundedNonNegativeInt(status, "relationshipCount", 131_072);
        var definedRelationshipCount = ParseBoundedNonNegativeInt(status, "definedRelationshipCount", 131_072);
        var conflictRelationshipCount = ParseBoundedNonNegativeInt(status, "conflictRelationshipCount", 131_072);
        var notAssessedRelationshipCount = ParseBoundedNonNegativeInt(status, "notAssessedRelationshipCount", 131_072);
        if ((long)definedRelationshipCount + conflictRelationshipCount + notAssessedRelationshipCount != relationshipCount)
            throw InvalidResponse();
        var missingSubjectCount = ParseBoundedNonNegativeInt(status, "missingSubjectCount", 32_768);
        var extraSubjectCount = ParseBoundedNonNegativeInt(status, "extraSubjectCount", 32_768);
        var invalidSubjectCount = ParseBoundedNonNegativeInt(status, "invalidSubjectCount", 32_768);
        var missingRelationshipCount = ParseBoundedNonNegativeInt(status, "missingRelationshipCount", 131_072);
        var invalidRelationshipCount = ParseBoundedNonNegativeInt(status, "invalidRelationshipCount", 131_072);
        var traceGapCount = ParseBoundedNonNegativeInt(status, "traceGapCount", 32_768);
        var evidenceGapCount = ParseBoundedNonNegativeInt(status, "evidenceGapCount", 32_768);
        var componentPlacementGapCount = ParseBoundedNonNegativeInt(status, "componentPlacementGapCount", 32_768);
        var testHookGapCount = ParseBoundedNonNegativeInt(status, "testHookGapCount", 32_768);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleDependencyCount = ParseBoundedNonNegativeInt(status, "staleDependencyCount", 9);
        var invalidCandidateCount = ParseBoundedNonNegativeInt(status, "invalidCandidateCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)conflictCandidateCount + unmappedCandidateCount + notAssessedCount + conflictRelationshipCount +
            notAssessedRelationshipCount + missingSubjectCount + extraSubjectCount + invalidSubjectCount +
            missingRelationshipCount + invalidRelationshipCount + traceGapCount + evidenceGapCount +
            componentPlacementGapCount + testHookGapCount + staleBindingCount + staleDependencyCount +
            invalidCandidateCount + unresolvedQuestionCount;
        if ((state == "candidate-complete" &&
                (gaps > 0 || candidateReference is null || dependencies.Count != dependencyNames.Length ||
                    sourceRouteCount != routeSubjectCount || sourceScreenCount != screenSubjectCount ||
                    sourceStateCount != stateSubjectCount || sourceComponentCount != componentSubjectCount ||
                    mappedCandidateCount != subjectCount || definedRelationshipCount != relationshipCount ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        RouteScreenComponentMappingRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "subjectCatalogDigest", "relationshipCatalogDigest",
                    "traceReceiptDigest", "mappingReceiptDigest", "assessmentReceiptDigest", "subjectCount",
                    "routeSubjectCount", "screenSubjectCount", "stateSubjectCount", "componentSubjectCount",
                    "mappedCandidateCount", "conflictCandidateCount", "unmappedCandidateCount", "notAssessedCount",
                    "relationshipCount", "definedRelationshipCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new RouteScreenComponentMappingRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "subjectCatalogDigest"),
                ParseRequiredDigest(candidateElement, "relationshipCatalogDigest"),
                ParseRequiredDigest(candidateElement, "traceReceiptDigest"),
                ParseRequiredDigest(candidateElement, "mappingReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "subjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "routeSubjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "screenSubjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "stateSubjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "componentSubjectCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "mappedCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "conflictCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "unmappedCandidateCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "notAssessedCount", 32_768),
                ParseBoundedNonNegativeInt(candidateElement, "relationshipCount", 131_072),
                ParseBoundedNonNegativeInt(candidateElement, "definedRelationshipCount", 131_072),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is null) == (dependencies.Count == dependencyNames.Length) ||
            (candidate?.SubjectCount ?? 0) != subjectCount || (candidate?.RouteSubjectCount ?? 0) != routeSubjectCount ||
            (candidate?.ScreenSubjectCount ?? 0) != screenSubjectCount || (candidate?.StateSubjectCount ?? 0) != stateSubjectCount ||
            (candidate?.ComponentSubjectCount ?? 0) != componentSubjectCount ||
            (candidate?.MappedCandidateCount ?? 0) != mappedCandidateCount ||
            (candidate?.ConflictCandidateCount ?? 0) != conflictCandidateCount ||
            (candidate?.UnmappedCandidateCount ?? 0) != unmappedCandidateCount ||
            (candidate?.NotAssessedCount ?? 0) != notAssessedCount ||
            (candidate?.RelationshipCount ?? 0) != relationshipCount ||
            (candidate?.DefinedRelationshipCount ?? 0) != definedRelationshipCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new RouteScreenComponentMappingProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            new ReadOnlyDictionary<string, RouteScreenComponentMappingReference>(dependencies),
            sourceRouteCount, sourceScreenCount, sourceStateCount, sourceComponentCount, subjectCount,
            routeSubjectCount, screenSubjectCount, stateSubjectCount, componentSubjectCount, mappedCandidateCount,
            conflictCandidateCount, unmappedCandidateCount, notAssessedCount, relationshipCount,
            definedRelationshipCount, conflictRelationshipCount, notAssessedRelationshipCount, missingSubjectCount,
            extraSubjectCount, invalidSubjectCount, missingRelationshipCount, invalidRelationshipCount, traceGapCount,
            evidenceGapCount, componentPlacementGapCount, testHookGapCount, staleBindingCount, staleDependencyCount,
            invalidCandidateCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
