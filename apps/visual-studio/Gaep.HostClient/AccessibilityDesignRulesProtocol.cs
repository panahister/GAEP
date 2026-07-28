using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string AccessibilityDesignRulesProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials";
    private const string AccessibilityDesignRulesProjectionAuthorityBoundary =
        "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority";
    private const string AccessibilityDesignRulesStatusAuthorityBoundary =
        "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority";

    internal static AccessibilityDesignRulesProjection ParseAccessibilityDesignRulesResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "accessibility-design-rules-projection") != "accessibility-design-rules-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", AccessibilityDesignRulesProjectionPrivacyBoundary) != AccessibilityDesignRulesProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", AccessibilityDesignRulesProjectionAuthorityBoundary) != AccessibilityDesignRulesProjectionAuthorityBoundary)
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
                    "targetCount", "ruleCount", "checkCount", "applicableRuleCount", "notApplicableRuleCount",
                    "unresolvedRuleCount", "notAssessedCheckCount", "evidenceRecordedCheckCount",
                    "humanReviewedCheckCount", "contradictedCheckCount", "representedRequirementCount",
                    "unresolvedRequirementCount", "unresolvedOwnershipCount", "staleBindingCount",
                    "staleSourceReferenceCount", "unresolvedQuestionCount", "catalogCompletenessState", "reviewState",
                    "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "accessibility-design-rules-status") != "accessibility-design-rules-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", AccessibilityDesignRulesStatusAuthorityBoundary) != AccessibilityDesignRulesStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var targetCount = ParseBoundedNonNegativeInt(status, "targetCount", 16_384);
        var ruleCount = ParseBoundedNonNegativeInt(status, "ruleCount", 4_096);
        var checkCount = ParseBoundedNonNegativeInt(status, "checkCount", 16_384);
        var applicableRuleCount = ParseBoundedNonNegativeInt(status, "applicableRuleCount", 4_096);
        var notApplicableRuleCount = ParseBoundedNonNegativeInt(status, "notApplicableRuleCount", 4_096);
        var unresolvedRuleCount = ParseBoundedNonNegativeInt(status, "unresolvedRuleCount", 4_096);
        var notAssessedCheckCount = ParseBoundedNonNegativeInt(status, "notAssessedCheckCount", 16_384);
        var evidenceRecordedCheckCount = ParseBoundedNonNegativeInt(status, "evidenceRecordedCheckCount", 16_384);
        var humanReviewedCheckCount = ParseBoundedNonNegativeInt(status, "humanReviewedCheckCount", 16_384);
        var contradictedCheckCount = ParseBoundedNonNegativeInt(status, "contradictedCheckCount", 16_384);
        var representedRequirementCount = ParseBoundedNonNegativeInt(status, "representedRequirementCount", 4_096);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 4_096);
        var unresolvedOwnershipCount = ParseBoundedNonNegativeInt(status, "unresolvedOwnershipCount", 20_480);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var catalogCompletenessState = ParseRequiredEnum(status, "catalogCompletenessState", "candidate-complete", "not-assessed");
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedRuleCount + notAssessedCheckCount + evidenceRecordedCheckCount +
            contradictedCheckCount + unresolvedRequirementCount + unresolvedOwnershipCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || catalogCompletenessState != "candidate-complete" ||
                    reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        AccessibilityDesignRulesRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "targetCount", "ruleCount",
                    "checkCount", "representedRequirementCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new AccessibilityDesignRulesRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "targetCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "ruleCount", 4_096),
                ParseBoundedNonNegativeInt(candidateElement, "checkCount", 16_384),
                ParseBoundedNonNegativeInt(candidateElement, "representedRequirementCount", 4_096),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.TargetCount ?? 0) != targetCount ||
            (candidate?.RuleCount ?? 0) != ruleCount ||
            (candidate?.CheckCount ?? 0) != checkCount ||
            (candidate?.RepresentedRequirementCount ?? 0) != representedRequirementCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new AccessibilityDesignRulesProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, catalogCompletenessState, Array.AsReadOnly(reasons),
            targetCount, ruleCount, checkCount, applicableRuleCount, notApplicableRuleCount, unresolvedRuleCount,
            notAssessedCheckCount, evidenceRecordedCheckCount, humanReviewedCheckCount, contradictedCheckCount,
            representedRequirementCount, unresolvedRequirementCount, unresolvedOwnershipCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
