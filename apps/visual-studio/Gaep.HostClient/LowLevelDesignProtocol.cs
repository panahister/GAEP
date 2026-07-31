using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string LowLevelDesignProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-structure-dependency-trace-coverage-ownership-assessment-snapshot-digests-only-not-design-narratives-modules-classes-components-interfaces-data-contracts-algorithms-state-error-recovery-authorization-observability-test-hooks-technologies-owners-evidence-source-content-personal-data-secrets-credentials-or-machine-paths";
    private const string LowLevelDesignProjectionAuthorityBoundary =
        "low-level-design-projection-is-read-only-and-does-not-establish-design-repository-source-runtime-or-deployment-truth-or-completeness-design-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority";
    private const string LowLevelDesignStatusAuthorityBoundary =
        "low-level-design-status-is-observational-and-does-not-establish-design-repository-source-runtime-or-deployment-truth-or-completeness-design-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority";

    internal static LowLevelDesignProjection ParseLowLevelDesignResponse(JsonElement envelope, Guid expectedInitiativeId, Guid expectedImplementationUnitId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"], ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "low-level-design-projection") != "low-level-design-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", LowLevelDesignProjectionPrivacyBoundary) != LowLevelDesignProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", LowLevelDesignProjectionAuthorityBoundary) != LowLevelDesignProjectionAuthorityBoundary)
            throw InvalidResponse();
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
        string[] countNames = [
            "dependencyCount", "presentDependencyCount", "elementCount", "definedElementCount", "relationCount",
            "definedRelationCount", "decisionCount", "selectedDecisionCount", "qualityAttributeCount", "deploymentViewCount",
            "conflictCount", "missingCount", "orphanRelationCount", "traceGapCount", "evidenceGapCount", "ownershipGapCount",
            "uncoveredUnitCount", "staleBindingCount", "staleDependencyCount", "invalidCandidateCount", "unresolvedQuestionCount",
        ];
        string[] dependencyNames = [
            "highLevelDesign", "systemSolutionArchitecture", "boundedContextModel", "technologyProfile", "dependencyMapping", "implementationUnitModel",
            "boilerplateRegistry", "boilerplateSelectionBinding", "boilerplateCompatibilityValidation", "designBaseline",
            "designToCodeBindingRegistry", "routeScreenComponentMapping", "testMethodology", "testInventory", "riskRegister", "securityPrivacyAssessment",
        ];
        var status = projection.GetProperty("status");
        if (!HasRequiredAndAllowedProperties(status,
                ["schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision", "implementationUnitId", .. countNames,
                 "reviewState", "state", "reasons", "assessedAt", "authorityBoundary"], ["candidate", .. dependencyNames]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "low-level-design-status") != "low-level-design-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredGuid(status, "implementationUnitId") != expectedImplementationUnitId ||
            ParseRequiredEnum(status, "authorityBoundary", LowLevelDesignStatusAuthorityBoundary) != LowLevelDesignStatusAuthorityBoundary)
            throw InvalidResponse();
        int Count(string name, int maximum = 65_536) => ParseBoundedNonNegativeInt(status, name, maximum);
        var dependencyCount = Count("dependencyCount", 32); var presentDependencyCount = Count("presentDependencyCount", 32);
        var elementCount = Count("elementCount"); var definedElementCount = Count("definedElementCount");
        var relationCount = Count("relationCount"); var definedRelationCount = Count("definedRelationCount");
        var decisionCount = Count("decisionCount", 4_096); var selectedDecisionCount = Count("selectedDecisionCount", 4_096);
        var qualityAttributeCount = Count("qualityAttributeCount", 4_096); var deploymentViewCount = Count("deploymentViewCount", 4_096);
        var conflictCount = Count("conflictCount"); var missingCount = Count("missingCount"); var orphanRelationCount = Count("orphanRelationCount");
        var traceGapCount = Count("traceGapCount"); var evidenceGapCount = Count("evidenceGapCount"); var ownershipGapCount = Count("ownershipGapCount");
        var uncoveredUnitCount = Count("uncoveredUnitCount"); var staleBindingCount = Count("staleBindingCount", 1);
        var staleDependencyCount = Count("staleDependencyCount", 16); var invalidCandidateCount = Count("invalidCandidateCount", 1);
        var unresolvedQuestionCount = Count("unresolvedQuestionCount", 512);
        if (presentDependencyCount > dependencyCount || definedElementCount > elementCount || definedRelationCount > relationCount || selectedDecisionCount > decisionCount)
            throw InvalidResponse();
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if (state == "attention-required" && reasons.Length == 0) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");
        var candidateReference = ParseBusinessReference(status, "candidate");
        LowLevelDesignRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(candidateElement, "id", "revision", "digest", "state", "structureReceiptDigest", "dependencyReceiptDigest",
                    "traceReceiptDigest", "coverageReceiptDigest", "ownershipReceiptDigest", "assessmentReceiptDigest", "elementCount", "relationCount",
                    "decisionCount", "reviewState", "updatedAt") || ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
                throw InvalidResponse();
            var id = ParseRequiredGuid(candidateElement, "id"); var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(candidateReference, id, revision, digest)) throw InvalidResponse();
            candidate = new LowLevelDesignRecordView(id, revision, digest,
                ParseRequiredDigest(candidateElement, "structureReceiptDigest"), ParseRequiredDigest(candidateElement, "dependencyReceiptDigest"),
                ParseRequiredDigest(candidateElement, "traceReceiptDigest"), ParseRequiredDigest(candidateElement, "coverageReceiptDigest"),
                ParseRequiredDigest(candidateElement, "ownershipReceiptDigest"), ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "elementCount", 65_536), ParseBoundedNonNegativeInt(candidateElement, "relationCount", 65_536),
                ParseBoundedNonNegativeInt(candidateElement, "decisionCount", 4_096), ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((candidateReference is null) != (candidate is null) || (candidate is not null && (candidate.ElementCount != elementCount || candidate.RelationCount != relationCount ||
            candidate.DecisionCount != decisionCount || candidate.ReviewState != reviewState)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt) throw InvalidResponse();
        return new LowLevelDesignProjection(productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, expectedImplementationUnitId, state, reviewState, Array.AsReadOnly(reasons), dependencyCount, presentDependencyCount, elementCount,
            definedElementCount, relationCount, definedRelationCount, decisionCount, selectedDecisionCount, qualityAttributeCount,
            deploymentViewCount, conflictCount, missingCount, orphanRelationCount, traceGapCount, evidenceGapCount, ownershipGapCount,
            uncoveredUnitCount, staleBindingCount, staleDependencyCount, invalidCandidateCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}

