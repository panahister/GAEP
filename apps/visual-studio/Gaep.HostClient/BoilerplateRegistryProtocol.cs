using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string BoilerplateRegistryProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-entry-source-compatibility-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-capabilities-limitations-evidence-rationale-technology-unit-architecture-repository-template-license-security-policy-personal-data-secrets-credentials-or-machine-paths";
    private const string BoilerplateRegistryProjectionAuthorityBoundary =
        "boilerplate-registry-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";
    private const string BoilerplateRegistryStatusAuthorityBoundary =
        "boilerplate-registry-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority";

    internal static BoilerplateRegistryProjection ParseBoilerplateRegistryResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "boilerplate-registry-projection") != "boilerplate-registry-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", BoilerplateRegistryProjectionPrivacyBoundary) != BoilerplateRegistryProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", BoilerplateRegistryProjectionAuthorityBoundary) != BoilerplateRegistryProjectionAuthorityBoundary)
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
                    "entryCount", "exactVersionCandidateCount", "rangeVersionCandidateCount", "unresolvedVersionCount",
                    "mandatoryCandidateCount", "missingEvidenceCount", "unavailableEntryCount", "integrityMismatchCount",
                    "provenanceGapCount", "unsupportedEntryCount", "lifecycleRiskCount", "technologyConflictCount",
                    "architectureConflictCount", "licenseReviewRequiredCount", "licenseProhibitedCount",
                    "securityReviewRequiredCount", "securityNonconformantCount", "exceptionCandidateCount",
                    "staleBindingCount", "staleImplementationUnitModelCount", "staleTechnologyProfileCount",
                    "invalidRegistryCount", "unresolvedQuestionCount", "reviewState", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["candidate", "implementationUnitModel", "technologyProfile"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "boilerplate-registry-status") != "boilerplate-registry-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", BoilerplateRegistryStatusAuthorityBoundary) != BoilerplateRegistryStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var implementationUnitModelReference = ParseBusinessReference(status, "implementationUnitModel");
        var technologyProfileReference = ParseBusinessReference(status, "technologyProfile");
        var entryCount = ParseBoundedNonNegativeInt(status, "entryCount", 10_000);
        var exactVersionCandidateCount = ParseBoundedNonNegativeInt(status, "exactVersionCandidateCount", 10_000);
        var rangeVersionCandidateCount = ParseBoundedNonNegativeInt(status, "rangeVersionCandidateCount", 10_000);
        var unresolvedVersionCount = ParseBoundedNonNegativeInt(status, "unresolvedVersionCount", 10_000);
        if ((long)exactVersionCandidateCount + rangeVersionCandidateCount + unresolvedVersionCount != entryCount) throw InvalidResponse();
        var mandatoryCandidateCount = ParseBoundedNonNegativeInt(status, "mandatoryCandidateCount", 10_000);
        if (mandatoryCandidateCount > entryCount) throw InvalidResponse();
        var missingEvidenceCount = ParseBoundedNonNegativeInt(status, "missingEvidenceCount", 10_000);
        var unavailableEntryCount = ParseBoundedNonNegativeInt(status, "unavailableEntryCount", 10_000);
        var integrityMismatchCount = ParseBoundedNonNegativeInt(status, "integrityMismatchCount", 10_000);
        var provenanceGapCount = ParseBoundedNonNegativeInt(status, "provenanceGapCount", 10_000);
        var unsupportedEntryCount = ParseBoundedNonNegativeInt(status, "unsupportedEntryCount", 10_000);
        var lifecycleRiskCount = ParseBoundedNonNegativeInt(status, "lifecycleRiskCount", 10_000);
        var technologyConflictCount = ParseBoundedNonNegativeInt(status, "technologyConflictCount", 10_000);
        var architectureConflictCount = ParseBoundedNonNegativeInt(status, "architectureConflictCount", 10_000);
        var licenseReviewRequiredCount = ParseBoundedNonNegativeInt(status, "licenseReviewRequiredCount", 10_000);
        var licenseProhibitedCount = ParseBoundedNonNegativeInt(status, "licenseProhibitedCount", 10_000);
        var securityReviewRequiredCount = ParseBoundedNonNegativeInt(status, "securityReviewRequiredCount", 10_000);
        var securityNonconformantCount = ParseBoundedNonNegativeInt(status, "securityNonconformantCount", 10_000);
        var exceptionCandidateCount = ParseBoundedNonNegativeInt(status, "exceptionCandidateCount", 10_000);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 1);
        var staleImplementationUnitModelCount = ParseBoundedNonNegativeInt(status, "staleImplementationUnitModelCount", 1);
        var staleTechnologyProfileCount = ParseBoundedNonNegativeInt(status, "staleTechnologyProfileCount", 1);
        var invalidRegistryCount = ParseBoundedNonNegativeInt(status, "invalidRegistryCount", 1);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var state = ParseRequiredEnum(status, "state", "attention-required", "candidate-complete");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gaps = (long)rangeVersionCandidateCount + unresolvedVersionCount + missingEvidenceCount + unavailableEntryCount +
            integrityMismatchCount + provenanceGapCount + unsupportedEntryCount + lifecycleRiskCount +
            technologyConflictCount + architectureConflictCount + licenseReviewRequiredCount + licenseProhibitedCount +
            securityReviewRequiredCount + securityNonconformantCount + exceptionCandidateCount + staleBindingCount +
            staleImplementationUnitModelCount + staleTechnologyProfileCount + invalidRegistryCount + unresolvedQuestionCount;
        var allDependenciesPresent = implementationUnitModelReference is not null && technologyProfileReference is not null;
        if ((state == "candidate-complete" &&
                (gaps > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null ||
                    !allDependenciesPresent || entryCount < 1)) ||
            (state == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        BoilerplateRegistryRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "state", "entryCatalogDigest", "sourceCatalogDigest",
                    "compatibilityAssessmentReceiptDigest", "assessmentReceiptDigest", "entryCount",
                    "mandatoryCandidateCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new BoilerplateRegistryRecordView(
                id, revision, digest, ParseRequiredDigest(candidateElement, "entryCatalogDigest"),
                ParseRequiredDigest(candidateElement, "sourceCatalogDigest"),
                ParseRequiredDigest(candidateElement, "compatibilityAssessmentReceiptDigest"),
                ParseRequiredDigest(candidateElement, "assessmentReceiptDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "entryCount", 10_000),
                ParseBoundedNonNegativeInt(candidateElement, "mandatoryCandidateCount", 10_000),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) || (candidate is null) == allDependenciesPresent ||
            (candidate?.EntryCount ?? 0) != entryCount ||
            (candidate?.MandatoryCandidateCount ?? 0) != mandatoryCandidateCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new BoilerplateRegistryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, state, reviewState, Array.AsReadOnly(reasons),
            implementationUnitModelReference?.Id, implementationUnitModelReference?.Revision, implementationUnitModelReference?.Digest,
            technologyProfileReference?.Id, technologyProfileReference?.Revision, technologyProfileReference?.Digest,
            entryCount, exactVersionCandidateCount, rangeVersionCandidateCount, unresolvedVersionCount,
            mandatoryCandidateCount, missingEvidenceCount, unavailableEntryCount, integrityMismatchCount,
            provenanceGapCount, unsupportedEntryCount, lifecycleRiskCount, technologyConflictCount,
            architectureConflictCount, licenseReviewRequiredCount, licenseProhibitedCount,
            securityReviewRequiredCount, securityNonconformantCount, exceptionCandidateCount, staleBindingCount,
            staleImplementationUnitModelCount, staleTechnologyProfileCount, invalidRegistryCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
