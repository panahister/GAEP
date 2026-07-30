using System.Text.Json;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignDriftDetectionProjectionPrivacyBoundary =
        "projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions";
    private const string DesignDriftDetectionProjectionAuthorityBoundary =
        "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority";
    private const string DesignDriftDetectionStatusAuthorityBoundary =
        "design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority";

    internal static DesignDriftDetectionProjection ParseDesignDriftDetectionResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-drift-detection-projection") != "design-drift-detection-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignDriftDetectionProjectionPrivacyBoundary) != DesignDriftDetectionProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignDriftDetectionProjectionAuthorityBoundary) != DesignDriftDetectionProjectionAuthorityBoundary)
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
                    "implementationTargetCount", "humanReviewedImplementationTargetCount", "observationCount",
                    "humanReviewedObservationCount", "requirementToDesignCount", "designToImplementationCount",
                    "conformantCount", "driftCount", "unassessedCount", "blockerCount", "highSeverityCount",
                    "remediationCandidateCount", "expiredRemediationCandidateCount", "staleBindingCount",
                    "staleSourceReferenceCount", "unresolvedQuestionCount", "candidateResult", "reviewState", "state",
                    "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-drift-detection-status") != "design-drift-detection-status" ||
            ParseRequiredGuid(status, "productId") != productId || ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId || ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignDriftDetectionStatusAuthorityBoundary) != DesignDriftDetectionStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var implementationTargetCount = ParseBoundedNonNegativeInt(status, "implementationTargetCount", 33_792);
        var humanReviewedImplementationTargetCount = ParseBoundedNonNegativeInt(status, "humanReviewedImplementationTargetCount", 33_792);
        var observationCount = ParseBoundedNonNegativeInt(status, "observationCount", 67_584);
        var humanReviewedObservationCount = ParseBoundedNonNegativeInt(status, "humanReviewedObservationCount", 67_584);
        var requirementToDesignCount = ParseBoundedNonNegativeInt(status, "requirementToDesignCount", 67_584);
        var designToImplementationCount = ParseBoundedNonNegativeInt(status, "designToImplementationCount", 67_584);
        var conformantCount = ParseBoundedNonNegativeInt(status, "conformantCount", 67_584);
        var driftCount = ParseBoundedNonNegativeInt(status, "driftCount", 67_584);
        var unassessedCount = ParseBoundedNonNegativeInt(status, "unassessedCount", 67_584);
        var blockerCount = ParseBoundedNonNegativeInt(status, "blockerCount", 67_584);
        var highSeverityCount = ParseBoundedNonNegativeInt(status, "highSeverityCount", 67_584);
        var remediationCandidateCount = ParseBoundedNonNegativeInt(status, "remediationCandidateCount", 16_384);
        var expiredRemediationCandidateCount = ParseBoundedNonNegativeInt(status, "expiredRemediationCandidateCount", 16_384);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (humanReviewedImplementationTargetCount > implementationTargetCount ||
            humanReviewedObservationCount > observationCount ||
            requirementToDesignCount + designToImplementationCount != observationCount ||
            conformantCount + driftCount + unassessedCount != observationCount ||
            blockerCount + highSeverityCount > driftCount || expiredRemediationCandidateCount > remediationCandidateCount)
        {
            throw InvalidResponse();
        }
        var candidateResult = ParseRequiredEnum(
            status,
            "candidateResult",
            "blocked", "drift-detected-candidate", "incomplete", "no-drift-observed-candidate", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-human-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = implementationTargetCount - humanReviewedImplementationTargetCount +
            observationCount - humanReviewedObservationCount + unassessedCount + expiredRemediationCandidateCount +
            staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-human-review" &&
                (reference is null || observationCount == 0 || reasons.Length > 0 || gapCount > 0 ||
                    reviewState != "ready-for-human-review")) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignDriftDetectionRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "designBaseline",
                    "returnedFigmaSnapshot", "designRequirements", "designTrace", "implementationTargetCatalogRevision",
                    "implementationTargetCatalogDigest", "comparisonPolicyDigest", "comparisonDigest",
                    "implementationTargetCount", "observationCount", "remediationCandidateCount", "candidateResult",
                    "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();

            var baselineElement = candidateElement.GetProperty("designBaseline");
            if (!HasOnlyProperties(
                    baselineElement,
                    "recordId", "revision", "digest", "membershipDigest", "baselineLineageId", "candidateSetId",
                    "candidateSetRevision", "semanticVersion", "designationReceiptDigest", "baselineDesignationState") ||
                ParseRequiredEnum(baselineElement, "baselineDesignationState", "not-established") != "not-established")
            {
                throw InvalidResponse();
            }
            var semanticVersion = ParseSourceText(baselineElement.GetProperty("semanticVersion"), 1, 256);
            if (!Regex.IsMatch(
                    semanticVersion,
                    @"^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$",
                    RegexOptions.CultureInvariant))
            {
                throw InvalidResponse();
            }
            var baseline = new DesignDriftBaselineView(
                ParseRequiredGuid(baselineElement, "recordId"),
                ParsePositiveLong(baselineElement, "revision"),
                ParseRequiredDigest(baselineElement, "digest"),
                ParseRequiredDigest(baselineElement, "membershipDigest"),
                ParseRequiredGuid(baselineElement, "baselineLineageId"),
                ParseRequiredGuid(baselineElement, "candidateSetId"),
                ParsePositiveLong(baselineElement, "candidateSetRevision"),
                semanticVersion,
                ParseRequiredDigest(baselineElement, "designationReceiptDigest"),
                "not-established");

            var snapshotElement = candidateElement.GetProperty("returnedFigmaSnapshot");
            if (!HasOnlyProperties(
                    snapshotElement,
                    "recordId", "revision", "digest", "membershipDigest", "externalFileIdentityDigest",
                    "returnedExternalVersionDigest", "itemCatalogDigest"))
            {
                throw InvalidResponse();
            }
            var snapshot = new DesignDriftSnapshotView(
                ParseRequiredGuid(snapshotElement, "recordId"),
                ParsePositiveLong(snapshotElement, "revision"),
                ParseRequiredDigest(snapshotElement, "digest"),
                ParseRequiredDigest(snapshotElement, "membershipDigest"),
                ParseRequiredDigest(snapshotElement, "externalFileIdentityDigest"),
                ParseRequiredDigest(snapshotElement, "returnedExternalVersionDigest"),
                ParseRequiredDigest(snapshotElement, "itemCatalogDigest"));

            var requirementsElement = candidateElement.GetProperty("designRequirements");
            if (!HasOnlyProperties(requirementsElement, "recordId", "revision", "digest", "membershipDigest", "requirementCatalogDigest"))
            {
                throw InvalidResponse();
            }
            var requirements = new DesignDriftCatalogView(
                ParseRequiredGuid(requirementsElement, "recordId"),
                ParsePositiveLong(requirementsElement, "revision"),
                ParseRequiredDigest(requirementsElement, "digest"),
                ParseRequiredDigest(requirementsElement, "membershipDigest"),
                ParseRequiredDigest(requirementsElement, "requirementCatalogDigest"));

            var traceElement = candidateElement.GetProperty("designTrace");
            if (!HasOnlyProperties(traceElement, "recordId", "revision", "digest", "membershipDigest", "reconciliationDigest"))
            {
                throw InvalidResponse();
            }
            var trace = new DesignDriftTraceView(
                ParseRequiredGuid(traceElement, "recordId"),
                ParsePositiveLong(traceElement, "revision"),
                ParseRequiredDigest(traceElement, "digest"),
                ParseRequiredDigest(traceElement, "membershipDigest"),
                ParseRequiredDigest(traceElement, "reconciliationDigest"));

            var targetCatalogRevision = ParsePositiveLong(candidateElement, "implementationTargetCatalogRevision");
            var recordTargetCount = ParseBoundedNonNegativeInt(candidateElement, "implementationTargetCount", 33_792);
            var recordObservationCount = ParseBoundedNonNegativeInt(candidateElement, "observationCount", 67_584);
            var recordRemediationCount = ParseBoundedNonNegativeInt(candidateElement, "remediationCandidateCount", 16_384);
            var recordCandidateResult = ParseRequiredEnum(
                candidateElement,
                "candidateResult",
                "blocked", "drift-detected-candidate", "incomplete", "no-drift-observed-candidate");
            var recordReviewState = ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review");
            if (recordTargetCount != implementationTargetCount || recordObservationCount != observationCount ||
                recordRemediationCount != remediationCandidateCount || recordCandidateResult != candidateResult ||
                recordReviewState != reviewState)
            {
                throw InvalidResponse();
            }
            ParseRequiredTimestamp(candidateElement, "updatedAt");
            candidate = new DesignDriftDetectionRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                baseline,
                snapshot,
                requirements,
                trace,
                targetCatalogRevision,
                ParseRequiredDigest(candidateElement, "implementationTargetCatalogDigest"),
                ParseRequiredDigest(candidateElement, "comparisonPolicyDigest"),
                ParseRequiredDigest(candidateElement, "comparisonDigest"),
                recordTargetCount,
                recordObservationCount,
                recordRemediationCount,
                recordCandidateResult,
                recordReviewState);
        }
        if ((reference is null) != (candidate is null) || ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignDriftDetectionProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, candidateResult, reviewState, assessmentState, implementationTargetCount,
            humanReviewedImplementationTargetCount, observationCount, humanReviewedObservationCount,
            requirementToDesignCount, designToImplementationCount, conformantCount, driftCount, unassessedCount,
            blockerCount, highSeverityCount, remediationCandidateCount, expiredRemediationCandidateCount,
            staleBindingCount, staleSourceReferenceCount, unresolvedQuestionCount,
            Array.AsReadOnly(reasons), candidate, snapshotDigest);
    }
}
