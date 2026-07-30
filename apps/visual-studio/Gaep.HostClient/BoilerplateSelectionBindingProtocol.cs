using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BoilerplateSelectionBindingProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-unit-decision-selection-binding-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-or-profile-identities-rationale-conditions-alternatives-deviations-evidence-decision-roles-personal-data-secrets-credentials-or-machine-paths";
    private const string BoilerplateSelectionBindingProjectionAuthorityBoundary =
        "boilerplate-selection-binding-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string BoilerplateSelectionBindingStatusAuthorityBoundary =
        "boilerplate-selection-binding-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static BoilerplateSelectionBindingProjection ParseBoilerplateSelectionBindingResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "boilerplate-selection-binding-projection") != "boilerplate-selection-binding-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", BoilerplateSelectionBindingProjectionPrivacyBoundary) != BoilerplateSelectionBindingProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", BoilerplateSelectionBindingProjectionAuthorityBoundary) != BoilerplateSelectionBindingProjectionAuthorityBoundary)
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
                    "decisionCount", "selectedCandidateCount", "notApplicableCandidateCount", "deferredCandidateCount",
                    "notAssessedCount", "missingUnitDecisionCount", "invalidSelectionCount", "registryGapCount",
                    "profileMismatchCount", "unitScopeMismatchCount", "versionMismatchCount", "missingEvidenceCount",
                    "staleBindingCount", "staleImplementationUnitModelCount", "staleDependencyMappingCount",
                    "staleTechnologyProfileCount", "staleBoilerplateRegistryCount", "invalidCandidateCount",
                    "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate", "implementationUnitModel", "dependencyMapping", "technologyProfile", "boilerplateRegistry"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "boilerplate-selection-binding-status") != "boilerplate-selection-binding-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", BoilerplateSelectionBindingStatusAuthorityBoundary) != BoilerplateSelectionBindingStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var implementationUnitModelReference = ParseBusinessReference(status, "implementationUnitModel");
        var dependencyMappingReference = ParseBusinessReference(status, "dependencyMapping");
        var technologyProfileReference = ParseBusinessReference(status, "technologyProfile");
        var boilerplateRegistryReference = ParseBusinessReference(status, "boilerplateRegistry");
        var decisionCount = ParseBoundedNonNegativeInt(status, "decisionCount", 10_000);
        var selectedCandidateCount = ParseBoundedNonNegativeInt(status, "selectedCandidateCount", 10_000);
        var notApplicableCandidateCount = ParseBoundedNonNegativeInt(status, "notApplicableCandidateCount", 10_000);
        var deferredCandidateCount = ParseBoundedNonNegativeInt(status, "deferredCandidateCount", 10_000);
        var notAssessedCount = ParseBoundedNonNegativeInt(status, "notAssessedCount", 10_000);
        if ((long)selectedCandidateCount + notApplicableCandidateCount + deferredCandidateCount + notAssessedCount != decisionCount)
            throw InvalidResponse();
        var missingUnitDecisionCount = ParseBoundedNonNegativeInt(status, "missingUnitDecisionCount", 10_000);
        var invalidSelectionCount = ParseBoundedNonNegativeInt(status, "invalidSelectionCount", 10_000);
        var registryGapCount = ParseBoundedNonNegativeInt(status, "registryGapCount", 10_000);
        var profileMismatchCount = ParseBoundedNonNegativeInt(status, "profileMismatchCount", 10_000);
        var unitScopeMismatchCount = ParseBoundedNonNegativeInt(status, "unitScopeMismatchCount", 10_000);
        var versionMismatchCount = ParseBoundedNonNegativeInt(status, "versionMismatchCount", 10_000);
        var missingEvidenceCount = ParseBoundedNonNegativeInt(status, "missingEvidenceCount", 10_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleImplementationUnitModelCount = ParseBoundedNonNegativeInt(status, "staleImplementationUnitModelCount", 1);
        var staleDependencyMappingCount = ParseBoundedNonNegativeInt(status, "staleDependencyMappingCount", 1);
        var staleTechnologyProfileCount = ParseBoundedNonNegativeInt(status, "staleTechnologyProfileCount", 1);
        var staleBoilerplateRegistryCount = ParseBoundedNonNegativeInt(status, "staleBoilerplateRegistryCount", 1);
        var invalidCandidateCount = ParseBoundedNonNegativeInt(status, "invalidCandidateCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)deferredCandidateCount + notAssessedCount + missingUnitDecisionCount + invalidSelectionCount +
            registryGapCount + profileMismatchCount + unitScopeMismatchCount + versionMismatchCount + missingEvidenceCount +
            staleBindingCount + staleImplementationUnitModelCount + staleDependencyMappingCount +
            staleTechnologyProfileCount + staleBoilerplateRegistryCount + invalidCandidateCount + unresolvedQuestionCount;
        var allDependenciesPresent = implementationUnitModelReference is not null && dependencyMappingReference is not null &&
            technologyProfileReference is not null && boilerplateRegistryReference is not null;
        if ((state == "candidate-complete" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null ||
                    !allDependenciesPresent || decisionCount < 1)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        BoilerplateSelectionBindingRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "unitDecisionCatalogDigest", "selectionReceiptDigest",
                    "bindingReceiptDigest", "assessmentReceiptDigest", "decisionCount", "selectedCandidateCount",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new BoilerplateSelectionBindingRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "unitDecisionCatalogDigest"),
                ParseRequiredDigest(candidateElement, "selectionReceiptDigest"),
                ParseRequiredDigest(candidateElement, "bindingReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "decisionCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "selectedCandidateCount", 10_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.DecisionCount ?? 0) != decisionCount ||
            (candidate?.SelectedCandidateCount ?? 0) != selectedCandidateCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BoilerplateSelectionBindingProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            implementationUnitModelReference?.Id, implementationUnitModelReference?.Revision, implementationUnitModelReference?.Digest,
            dependencyMappingReference?.Id, dependencyMappingReference?.Revision, dependencyMappingReference?.Digest,
            technologyProfileReference?.Id, technologyProfileReference?.Revision, technologyProfileReference?.Digest,
            boilerplateRegistryReference?.Id, boilerplateRegistryReference?.Revision, boilerplateRegistryReference?.Digest,
            decisionCount, selectedCandidateCount, notApplicableCandidateCount, deferredCandidateCount, notAssessedCount,
            missingUnitDecisionCount, invalidSelectionCount, registryGapCount, profileMismatchCount,
            unitScopeMismatchCount, versionMismatchCount, missingEvidenceCount, staleBindingCount,
            staleImplementationUnitModelCount, staleDependencyMappingCount, staleTechnologyProfileCount,
            staleBoilerplateRegistryCount, invalidCandidateCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
