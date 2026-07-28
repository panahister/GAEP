using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string DesignPersonaRoleProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials";
    private const string DesignPersonaRoleProjectionAuthorityBoundary =
        "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action";
    private const string DesignPersonaRoleStatusAuthorityBoundary =
        "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action";

    internal static DesignPersonaRoleProjection ParseDesignPersonaRoleResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "design-persona-role-projection") != "design-persona-role-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", DesignPersonaRoleProjectionPrivacyBoundary) != DesignPersonaRoleProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", DesignPersonaRoleProjectionAuthorityBoundary) != DesignPersonaRoleProjectionAuthorityBoundary)
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
                    "personaCount", "designRoleCount", "representedParticipantCategoryCount",
                    "unresolvedParticipantCategoryCount", "representedRoleKindCount", "unresolvedRoleKindCount",
                    "weakEvidencePersonaCount", "humanReviewedPersonaCount", "staleBindingCount",
                    "staleSourceReferenceCount", "unresolvedQuestionCount", "reviewState", "state", "reasons",
                    "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "design-persona-role-status") != "design-persona-role-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", DesignPersonaRoleStatusAuthorityBoundary) != DesignPersonaRoleStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var personaCount = ParseBoundedNonNegativeInt(status, "personaCount", 256);
        var designRoleCount = ParseBoundedNonNegativeInt(status, "designRoleCount", 256);
        var representedParticipantCategoryCount = ParseBoundedNonNegativeInt(status, "representedParticipantCategoryCount", 5);
        var unresolvedParticipantCategoryCount = ParseBoundedNonNegativeInt(status, "unresolvedParticipantCategoryCount", 5);
        var representedRoleKindCount = ParseBoundedNonNegativeInt(status, "representedRoleKindCount", 4);
        var unresolvedRoleKindCount = ParseBoundedNonNegativeInt(status, "unresolvedRoleKindCount", 4);
        var weakEvidencePersonaCount = ParseBoundedNonNegativeInt(status, "weakEvidencePersonaCount", 256);
        var humanReviewedPersonaCount = ParseBoundedNonNegativeInt(status, "humanReviewedPersonaCount", 256);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (weakEvidencePersonaCount > personaCount || humanReviewedPersonaCount > personaCount) throw InvalidResponse();
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedParticipantCategoryCount + unresolvedRoleKindCount + weakEvidencePersonaCount +
            staleBindingCount + staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        DesignPersonaRoleRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "personaCount", "designRoleCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new DesignPersonaRoleRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "personaCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "designRoleCount", 256),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.PersonaCount ?? 0) != personaCount ||
            (candidate?.DesignRoleCount ?? 0) != designRoleCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new DesignPersonaRoleProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, Array.AsReadOnly(reasons), personaCount, designRoleCount,
            representedParticipantCategoryCount, unresolvedParticipantCategoryCount, representedRoleKindCount,
            unresolvedRoleKindCount, weakEvidencePersonaCount, humanReviewedPersonaCount, staleBindingCount,
            staleSourceReferenceCount, unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
