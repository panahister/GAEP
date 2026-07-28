using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string UserJourneyProjectionPrivacyBoundary =
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials";
    private const string UserJourneyProjectionAuthorityBoundary =
        "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action";
    private const string UserJourneyStatusAuthorityBoundary =
        "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action";

    internal static UserJourneyProjection ParseUserJourneyResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "user-journey-model-projection") != "user-journey-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", UserJourneyProjectionPrivacyBoundary) != UserJourneyProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", UserJourneyProjectionAuthorityBoundary) != UserJourneyProjectionAuthorityBoundary)
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
                    "journeyCount", "touchpointCount", "primaryPathCount", "successPathCount", "failurePathCount",
                    "recoveryPathCount", "representedScopeCount", "unresolvedScopeCount", "weakEvidencePathCount",
                    "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "reviewState", "state",
                    "reasons", "assessedAt", "authorityBoundary",
                ],
                ["candidate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "user-journey-model-status") != "user-journey-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", UserJourneyStatusAuthorityBoundary) != UserJourneyStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "candidate");
        var journeyCount = ParseBoundedNonNegativeInt(status, "journeyCount", 256);
        var touchpointCount = ParseBoundedNonNegativeInt(status, "touchpointCount", 262_144);
        var primaryPathCount = ParseBoundedNonNegativeInt(status, "primaryPathCount", 262_144);
        var successPathCount = ParseBoundedNonNegativeInt(status, "successPathCount", 262_144);
        var failurePathCount = ParseBoundedNonNegativeInt(status, "failurePathCount", 262_144);
        var recoveryPathCount = ParseBoundedNonNegativeInt(status, "recoveryPathCount", 262_144);
        var representedScopeCount = ParseBoundedNonNegativeInt(status, "representedScopeCount", 1_024);
        var unresolvedScopeCount = ParseBoundedNonNegativeInt(status, "unresolvedScopeCount", 1_024);
        var weakEvidencePathCount = ParseBoundedNonNegativeInt(status, "weakEvidencePathCount", 262_144);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var reviewState = ParseRequiredEnum(status, "reviewState", "draft", "held", "ready-for-human-review");
        var assessmentState = ParseRequiredEnum(status, "state", "attention-required", "complete-for-review");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedScopeCount + weakEvidencePathCount + staleBindingCount +
            staleSourceReferenceCount + unresolvedQuestionCount;
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || reviewState != "ready-for-human-review" || reasons.Length > 0 || reference is null)) ||
            (assessmentState == "attention-required" && reasons.Length == 0))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        UserJourneyRecordView? candidate = null;
        if (projection.TryGetProperty("candidate", out var candidateElement))
        {
            if (!HasOnlyProperties(
                    candidateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "journeyCount", "touchpointCount", "reviewState", "updatedAt") ||
                ParseRequiredEnum(candidateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(candidateElement, "id");
            var revision = ParsePositiveLong(candidateElement, "revision");
            var digest = ParseRequiredDigest(candidateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            candidate = new UserJourneyRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(candidateElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(candidateElement, "journeyCount", 256),
                ParseBoundedNonNegativeInt(candidateElement, "touchpointCount", 262_144),
                ParseRequiredEnum(candidateElement, "reviewState", "draft", "held", "ready-for-human-review"));
            ParseRequiredTimestamp(candidateElement, "updatedAt");
        }
        if ((reference is null) != (candidate is null) ||
            (candidate?.JourneyCount ?? 0) != journeyCount ||
            (candidate?.TouchpointCount ?? 0) != touchpointCount ||
            (candidate is not null && candidate.ReviewState != reviewState) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new UserJourneyProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, Array.AsReadOnly(reasons), journeyCount, touchpointCount,
            primaryPathCount, successPathCount, failurePathCount, recoveryPathCount, representedScopeCount,
            unresolvedScopeCount, weakEvidencePathCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, candidate, snapshotDigest);
    }
}
