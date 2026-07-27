using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string P0P4ReadinessGateProjectionPrivacyBoundary =
        "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials";
    private const string P0P4ReadinessGateProjectionAuthorityBoundary =
        "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority";
    private const string P0P4ReadinessGateStatusAuthorityBoundary =
        "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority";
    private const string P0P4ReadinessGateBoundary =
        "a-passing-gate-is-an-evaluation-result-not-permission";

    internal static P0P4ReadinessGateProjection ParseP0P4ReadinessGateResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["gate"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "p0-p4-readiness-gate-projection") != "p0-p4-readiness-gate-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", P0P4ReadinessGateProjectionPrivacyBoundary) != P0P4ReadinessGateProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", P0P4ReadinessGateProjectionAuthorityBoundary) != P0P4ReadinessGateProjectionAuthorityBoundary)
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
                    "outputCount", "applicableOutputCount", "notApplicableOutputCount", "unresolvedApplicabilityCount",
                    "satisfiedOutputCount", "conditionalOutputCount", "incompleteOutputCount", "failedOutputCount",
                    "blockedOutputCount", "staleOrUnknownOutputCount", "pendingOrInvalidWaiverCount",
                    "unresolvedDecisionCount", "unmetConditionCount", "unresolvedRequirementCount",
                    "adverseEvidenceCount", "staleBindingCount", "staleSourceReferenceCount", "inconsistencyCount",
                    "unresolvedQuestionCount", "result", "reasons", "assessedAt", "gateBoundary", "authorityBoundary",
                ],
                ["gate"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "p0-p4-readiness-gate-status") != "p0-p4-readiness-gate-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "gateBoundary", P0P4ReadinessGateBoundary) != P0P4ReadinessGateBoundary ||
            ParseRequiredEnum(status, "authorityBoundary", P0P4ReadinessGateStatusAuthorityBoundary) != P0P4ReadinessGateStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "gate");
        var outputCount = ParseBoundedNonNegativeInt(status, "outputCount", 25);
        var applicableOutputCount = ParseBoundedNonNegativeInt(status, "applicableOutputCount", 25);
        var notApplicableOutputCount = ParseBoundedNonNegativeInt(status, "notApplicableOutputCount", 25);
        var unresolvedApplicabilityCount = ParseBoundedNonNegativeInt(status, "unresolvedApplicabilityCount", 25);
        var satisfiedOutputCount = ParseBoundedNonNegativeInt(status, "satisfiedOutputCount", 25);
        var conditionalOutputCount = ParseBoundedNonNegativeInt(status, "conditionalOutputCount", 25);
        var incompleteOutputCount = ParseBoundedNonNegativeInt(status, "incompleteOutputCount", 25);
        var failedOutputCount = ParseBoundedNonNegativeInt(status, "failedOutputCount", 25);
        var blockedOutputCount = ParseBoundedNonNegativeInt(status, "blockedOutputCount", 25);
        var staleOrUnknownOutputCount = ParseBoundedNonNegativeInt(status, "staleOrUnknownOutputCount", 25);
        var pendingOrInvalidWaiverCount = ParseBoundedNonNegativeInt(status, "pendingOrInvalidWaiverCount", 512);
        var unresolvedDecisionCount = ParseBoundedNonNegativeInt(status, "unresolvedDecisionCount", 512);
        var unmetConditionCount = ParseBoundedNonNegativeInt(status, "unmetConditionCount", 512);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 37);
        var adverseEvidenceCount = ParseBoundedNonNegativeInt(status, "adverseEvidenceCount", 32_768);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        if (applicableOutputCount + notApplicableOutputCount + unresolvedApplicabilityCount != outputCount ||
            satisfiedOutputCount + conditionalOutputCount + incompleteOutputCount + failedOutputCount +
            blockedOutputCount + notApplicableOutputCount > outputCount)
        {
            throw InvalidResponse();
        }
        var result = ParseRequiredEnum(status, "result", "blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 1_024) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        var gapCount = unresolvedApplicabilityCount + conditionalOutputCount + incompleteOutputCount +
            failedOutputCount + blockedOutputCount + staleOrUnknownOutputCount + pendingOrInvalidWaiverCount +
            unresolvedDecisionCount + unmetConditionCount + unresolvedRequirementCount + adverseEvidenceCount +
            staleBindingCount + staleSourceReferenceCount + inconsistencyCount + unresolvedQuestionCount;
        if ((result == "passed" && (gapCount > 0 || satisfiedOutputCount != applicableOutputCount || reasons.Length > 0)) ||
            (result != "passed" && reasons.Length == 0) ||
            (result == "conditionally-passed" && (conditionalOutputCount == 0 || failedOutputCount > 0 || blockedOutputCount > 0)) ||
            (reference is null && result != "not-assessed"))
        {
            throw InvalidResponse();
        }
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        P0P4ReadinessGateRecordView? gate = null;
        if (projection.TryGetProperty("gate", out var gateElement))
        {
            if (!HasOnlyProperties(
                    gateElement,
                    "id", "revision", "digest", "membershipDigest", "state", "evaluationDefinitionDigest",
                    "outputCount", "waiverCount", "unresolvedDecisionCount", "conditionCount", "updatedAt") ||
                ParseRequiredEnum(gateElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(gateElement, "id");
            var revision = ParsePositiveLong(gateElement, "revision");
            var digest = ParseRequiredDigest(gateElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            gate = new P0P4ReadinessGateRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(gateElement, "membershipDigest"),
                ParseRequiredDigest(gateElement, "evaluationDefinitionDigest"),
                ParseBoundedNonNegativeInt(gateElement, "outputCount", 25),
                ParseBoundedNonNegativeInt(gateElement, "waiverCount", 512),
                ParseBoundedNonNegativeInt(gateElement, "unresolvedDecisionCount", 512),
                ParseBoundedNonNegativeInt(gateElement, "conditionCount", 512));
            ParseRequiredTimestamp(gateElement, "updatedAt");
        }
        if ((reference is null) != (gate is null) ||
            (gate?.OutputCount ?? 0) != outputCount ||
            (gate?.UnresolvedDecisionCount ?? 0) != unresolvedDecisionCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new P0P4ReadinessGateProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, result, Array.AsReadOnly(reasons), outputCount, applicableOutputCount,
            notApplicableOutputCount, unresolvedApplicabilityCount, satisfiedOutputCount, conditionalOutputCount,
            incompleteOutputCount, failedOutputCount, blockedOutputCount, staleOrUnknownOutputCount,
            pendingOrInvalidWaiverCount, unresolvedDecisionCount, unmetConditionCount, unresolvedRequirementCount,
            adverseEvidenceCount, staleBindingCount, staleSourceReferenceCount, inconsistencyCount,
            unresolvedQuestionCount, P0P4ReadinessGateBoundary, gate, snapshotDigest);
    }
}
