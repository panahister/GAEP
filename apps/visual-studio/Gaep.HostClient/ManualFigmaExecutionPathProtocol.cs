using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string ManualFigmaExecutionPathProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-handoff-content-instructions-figma-identifiers-returned-design-source-or-personal-content-secrets-or-credentials";
    private const string ManualFigmaExecutionPathProjectionAuthorityBoundary =
        "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority";
    private const string ManualFigmaExecutionPathStatusAuthorityBoundary =
        "manual-figma-execution-path-status-is-observational-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority";

    internal static ManualFigmaExecutionPathProjection ParseManualFigmaExecutionPathResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "manual-figma-execution-path-projection") != "manual-figma-execution-path-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", ManualFigmaExecutionPathProjectionPrivacyBoundary) != ManualFigmaExecutionPathProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", ManualFigmaExecutionPathProjectionAuthorityBoundary) != ManualFigmaExecutionPathProjectionAuthorityBoundary)
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
                    "scopeCount", "instructionCount", "checkCount", "notAssessedCheckCount",
                    "evidenceRecordedCheckCount", "humanReviewedCheckCount", "contradictedCheckCount",
                    "representedRequirementCount", "unresolvedRequirementCount", "unresolvedOwnershipCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "guideCatalogState",
                    "handoffCatalogState", "returnContractState", "reviewState", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "manual-figma-execution-path-status") != "manual-figma-execution-path-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", ManualFigmaExecutionPathStatusAuthorityBoundary) != ManualFigmaExecutionPathStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var scopeCount = ParseBoundedNonNegativeInt(status, "scopeCount", 4_096);
        var instructionCount = ParseBoundedNonNegativeInt(status, "instructionCount", 16_384);
        var checkCount = ParseBoundedNonNegativeInt(status, "checkCount", 16_384);
        var notAssessedCheckCount = ParseBoundedNonNegativeInt(status, "notAssessedCheckCount", 16_384);
        var evidenceRecordedCheckCount = ParseBoundedNonNegativeInt(status, "evidenceRecordedCheckCount", 16_384);
        var humanReviewedCheckCount = ParseBoundedNonNegativeInt(status, "humanReviewedCheckCount", 16_384);
        var contradictedCheckCount = ParseBoundedNonNegativeInt(status, "contradictedCheckCount", 16_384);
        var representedRequirementCount = ParseBoundedNonNegativeInt(status, "representedRequirementCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 4_096);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 4_096);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var guideCatalogState = ParseRequiredEnum(status, "guideCatalogState", "candidate-complete", "not-assessed");
        var handoffCatalogState = ParseRequiredEnum(status, "handoffCatalogState", "candidate-complete", "not-assessed");
        var returnContractState = ParseRequiredEnum(status, "returnContractState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = notAssessedCheckCount + evidenceRecordedCheckCount + contradictedCheckCount +
            unresolvedRequirementCount + unresolvedOwnershipCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || guideCatalogState != "candidate-complete" || handoffCatalogState != "candidate-complete" ||
                    returnContractState != "candidate-complete" || reviewState != "ready-for-human-review" ||
                    reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        ManualFigmaExecutionPathRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "scopeCount", "instructionCount",
                    "checkCount", "representedRequirementCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new ManualFigmaExecutionPathRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "scopeCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "instructionCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "checkCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "representedRequirementCount", 4_096),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.ScopeCount ?? 0) != scopeCount ||
            (candidate?.InstructionCount ?? 0) != instructionCount ||
            (candidate?.CheckCount ?? 0) != checkCount ||
            (candidate?.RepresentedRequirementCount ?? 0) != representedRequirementCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new ManualFigmaExecutionPathProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, guideCatalogState, handoffCatalogState,
            returnContractState, Array.AsReadOnly(reasons), scopeCount, instructionCount, checkCount,
            notAssessedCheckCount, evidenceRecordedCheckCount, humanReviewedCheckCount, contradictedCheckCount,
            representedRequirementCount, unresolvedRequirementCount, unresolvedOwnershipCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
