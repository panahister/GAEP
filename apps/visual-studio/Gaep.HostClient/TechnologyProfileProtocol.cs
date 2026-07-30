using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string TechnologyProfileProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-profile-selection-compatibility-assessment-snapshot-digests-only-not-technology-names-versions-constraints-evidence-rationale-unit-architecture-repository-toolchain-license-security-policy-personal-data-secrets-credentials-or-machine-paths";
    private const string TechnologyProfileProjectionAuthorityBoundary =
        "technology-profile-projection-is-read-only-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority";
    private const string TechnologyProfileStatusAuthorityBoundary =
        "technology-profile-status-is-observational-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority";

    internal static TechnologyProfileProjection ParseTechnologyProfileResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "technology-profile-projection") != "technology-profile-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", TechnologyProfileProjectionPrivacyBoundary) != TechnologyProfileProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", TechnologyProfileProjectionAuthorityBoundary) != TechnologyProfileProjectionAuthorityBoundary)
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
                    "unitProfileCount", "technologyChoiceCount", "exactVersionCandidateCount",
                    "rangeVersionCandidateCount", "unresolvedVersionCount", "constraintCount", "missingProfileCount",
                    "invalidProfileCount", "missingEvidenceCount", "unsupportedChoiceCount", "lifecycleRiskCount",
                    "compatibilityConflictCount", "licenseReviewRequiredCount", "licenseProhibitedCount",
                    "securityReviewRequiredCount", "securityNonconformantCount", "exceptionCandidateCount",
                    "constraintConflictCount", "staleBindingCount", "staleImplementationUnitModelCount",
                    "staleDependencyMappingCount", "unresolvedQuestionCount", "reviewState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate", "implementationUnitModel", "dependencyMapping"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "technology-profile-status") != "technology-profile-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", TechnologyProfileStatusAuthorityBoundary) != TechnologyProfileStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var implementationUnitModelReference = ParseBusinessReference(status, "implementationUnitModel");
        var dependencyMappingReference = ParseBusinessReference(status, "dependencyMapping");
        var unitProfileCount = ParseBoundedNonNegativeInt(status, "unitProfileCount", 10_000);
        var technologyChoiceCount = ParseBoundedNonNegativeInt(status, "technologyChoiceCount", 100_000_000);
        var exactVersionCandidateCount = ParseBoundedNonNegativeInt(status, "exactVersionCandidateCount", 100_000_000);
        var rangeVersionCandidateCount = ParseBoundedNonNegativeInt(status, "rangeVersionCandidateCount", 100_000_000);
        var unresolvedVersionCount = ParseBoundedNonNegativeInt(status, "unresolvedVersionCount", 100_000_000);
        if ((long)exactVersionCandidateCount + rangeVersionCandidateCount + unresolvedVersionCount != technologyChoiceCount) throw InvalidResponse();
        var constraintCount = ParseBoundedNonNegativeInt(status, "constraintCount", 100_000_000);
        var missingProfileCount = ParseBoundedNonNegativeInt(status, "missingProfileCount", 10_000);
        var invalidProfileCount = ParseBoundedNonNegativeInt(status, "invalidProfileCount", 10_000);
        var missingEvidenceCount = ParseBoundedNonNegativeInt(status, "missingEvidenceCount", 100_000_000);
        var unsupportedChoiceCount = ParseBoundedNonNegativeInt(status, "unsupportedChoiceCount", 100_000_000);
        var lifecycleRiskCount = ParseBoundedNonNegativeInt(status, "lifecycleRiskCount", 100_000_000);
        var compatibilityConflictCount = ParseBoundedNonNegativeInt(status, "compatibilityConflictCount", 100_000_000);
        var licenseReviewRequiredCount = ParseBoundedNonNegativeInt(status, "licenseReviewRequiredCount", 100_000_000);
        var licenseProhibitedCount = ParseBoundedNonNegativeInt(status, "licenseProhibitedCount", 100_000_000);
        var securityReviewRequiredCount = ParseBoundedNonNegativeInt(status, "securityReviewRequiredCount", 100_000_000);
        var securityNonconformantCount = ParseBoundedNonNegativeInt(status, "securityNonconformantCount", 100_000_000);
        var exceptionCandidateCount = ParseBoundedNonNegativeInt(status, "exceptionCandidateCount", 100_000_000);
        var constraintConflictCount = ParseBoundedNonNegativeInt(status, "constraintConflictCount", 100_000_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleImplementationUnitModelCount = ParseBoundedNonNegativeInt(status, "staleImplementationUnitModelCount", 1);
        var staleDependencyMappingCount = ParseBoundedNonNegativeInt(status, "staleDependencyMappingCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)rangeVersionCandidateCount + unresolvedVersionCount + missingProfileCount + invalidProfileCount +
            missingEvidenceCount + unsupportedChoiceCount + lifecycleRiskCount + compatibilityConflictCount +
            licenseReviewRequiredCount + licenseProhibitedCount + securityReviewRequiredCount + securityNonconformantCount +
            exceptionCandidateCount + constraintConflictCount + staleBindingCount + staleImplementationUnitModelCount +
            staleDependencyMappingCount + unresolvedQuestionCount;
        var allDependenciesPresent = implementationUnitModelReference is not null && dependencyMappingReference is not null;
        if ((state == "candidate-complete" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null ||
                    !allDependenciesPresent || unitProfileCount < 1 || technologyChoiceCount < 1)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        TechnologyProfileRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "profileCatalogDigest", "selectionCatalogDigest",
                    "compatibilityAssessmentReceiptDigest", "assessmentReceiptDigest", "unitProfileCount",
                    "technologyChoiceCount", "constraintCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new TechnologyProfileRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "profileCatalogDigest"),
                ParseRequiredDigest(candidateElement, "selectionCatalogDigest"),
                ParseRequiredDigest(candidateElement, "compatibilityAssessmentReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "unitProfileCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "technologyChoiceCount", 100_000_000),
                ParseBoundedNonNegativeInt(candidateElement, "constraintCount", 100_000_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.UnitProfileCount ?? 0) != unitProfileCount ||
            (candidate?.TechnologyChoiceCount ?? 0) != technologyChoiceCount ||
            (candidate?.ConstraintCount ?? 0) != constraintCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new TechnologyProfileProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            implementationUnitModelReference?.Id, implementationUnitModelReference?.Revision, implementationUnitModelReference?.Digest,
            dependencyMappingReference?.Id, dependencyMappingReference?.Revision, dependencyMappingReference?.Digest,
            unitProfileCount, technologyChoiceCount, exactVersionCandidateCount, rangeVersionCandidateCount,
            unresolvedVersionCount, constraintCount, missingProfileCount, invalidProfileCount, missingEvidenceCount,
            unsupportedChoiceCount, lifecycleRiskCount, compatibilityConflictCount, licenseReviewRequiredCount,
            licenseProhibitedCount, securityReviewRequiredCount, securityNonconformantCount, exceptionCandidateCount,
            constraintConflictCount, staleBindingCount, staleImplementationUnitModelCount, staleDependencyMappingCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
