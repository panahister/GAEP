using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string EventIntegrationModelProjectionPrivacyBoundary =
        "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials";
    private const string EventIntegrationModelProjectionAuthorityBoundary =
        "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action";
    private const string EventIntegrationModelStatusAuthorityBoundary =
        "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action";

    internal static EventIntegrationModelProjection ParseEventIntegrationModelResponse(JsonElement envelope, Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                projection,
                ["schemaVersion", "kind", "product", "initiative", "status", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest"],
                ["model"]) ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "event-integration-model-projection") != "event-integration-model-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", EventIntegrationModelProjectionPrivacyBoundary) != EventIntegrationModelProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", EventIntegrationModelProjectionAuthorityBoundary) != EventIntegrationModelProjectionAuthorityBoundary)
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
                    "eventTypeCount", "commandCount", "adapterCount", "externalContractCount", "mappingCount", "routeCount",
                    "uncoveredProcessEventCount", "uncoveredProcessCount", "uncoveredBoundedContextCount",
                    "uncoveredDataEntityCount", "uncoveredAuthorizationActionCount", "unknownMappingTruthCount",
                    "unresolvedRequirementCount", "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount",
                    "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
                ],
                ["model"]) ||
            ParseBoundedNonNegativeInt(status, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(status, "kind", "event-integration-model-status") != "event-integration-model-status" ||
            ParseRequiredGuid(status, "productId") != productId ||
            ParsePositiveLong(status, "productRevision") != productRevision ||
            ParseRequiredGuid(status, "initiativeId") != initiativeId ||
            ParsePositiveLong(status, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(status, "authorityBoundary", EventIntegrationModelStatusAuthorityBoundary) != EventIntegrationModelStatusAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var reference = ParseBusinessReference(status, "model");
        var eventTypeCount = ParseBoundedNonNegativeInt(status, "eventTypeCount", 8_192);
        var commandCount = ParseBoundedNonNegativeInt(status, "commandCount", 8_192);
        var adapterCount = ParseBoundedNonNegativeInt(status, "adapterCount", 4_096);
        var externalContractCount = ParseBoundedNonNegativeInt(status, "externalContractCount", 8_192);
        var mappingCount = ParseBoundedNonNegativeInt(status, "mappingCount", 8_192);
        var routeCount = ParseBoundedNonNegativeInt(status, "routeCount", 8_192);
        var uncoveredProcessEventCount = ParseBoundedNonNegativeInt(status, "uncoveredProcessEventCount", 65_536);
        var uncoveredProcessCount = ParseBoundedNonNegativeInt(status, "uncoveredProcessCount", 512);
        var uncoveredBoundedContextCount = ParseBoundedNonNegativeInt(status, "uncoveredBoundedContextCount", 2_048);
        var uncoveredDataEntityCount = ParseBoundedNonNegativeInt(status, "uncoveredDataEntityCount", 2_048);
        var uncoveredAuthorizationActionCount = ParseBoundedNonNegativeInt(status, "uncoveredAuthorizationActionCount", 4_096);
        var unknownMappingTruthCount = ParseBoundedNonNegativeInt(status, "unknownMappingTruthCount", 131_072);
        var unresolvedRequirementCount = ParseBoundedNonNegativeInt(status, "unresolvedRequirementCount", 71);
        var inconsistencyCount = ParseBoundedNonNegativeInt(status, "inconsistencyCount", 512);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(status, "unresolvedQuestionCount", 512);
        var staleBindingCount = ParseBoundedNonNegativeInt(status, "staleBindingCount", 131_072);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(status, "staleSourceReferenceCount", 131_072);
        var assessmentState = ParseRequiredEnum(status, "state", "complete-for-review", "attention-required");
        var reasonsElement = status.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512) throw InvalidResponse();
        var reasons = reasonsElement.EnumerateArray().Select(value => ParseSourceText(value, 2, 2_000)).ToArray();
        if ((assessmentState == "complete-for-review") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(status, "assessedAt");

        EventIntegrationModelRecordView? model = null;
        if (projection.TryGetProperty("model", out var modelElement))
        {
            if (!HasOnlyProperties(
                    modelElement,
                    "id", "revision", "digest", "membershipDigest", "state", "eventTypeCount", "commandCount",
                    "adapterCount", "externalContractCount", "mappingCount", "routeCount", "updatedAt") ||
                ParseRequiredEnum(modelElement, "state", "candidate") != "candidate")
            {
                throw InvalidResponse();
            }
            var id = ParseRequiredGuid(modelElement, "id");
            var revision = ParsePositiveLong(modelElement, "revision");
            var digest = ParseRequiredDigest(modelElement, "digest");
            if (!Matches(reference, id, revision, digest)) throw InvalidResponse();
            model = new EventIntegrationModelRecordView(
                id,
                revision,
                digest,
                ParseRequiredDigest(modelElement, "membershipDigest"),
                ParseBoundedNonNegativeInt(modelElement, "eventTypeCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "commandCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "adapterCount", 4_096),
                ParseBoundedNonNegativeInt(modelElement, "externalContractCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "mappingCount", 8_192),
                ParseBoundedNonNegativeInt(modelElement, "routeCount", 8_192));
            ParseRequiredTimestamp(modelElement, "updatedAt");
        }
        if ((reference is null) != (model is null) ||
            (model?.EventTypeCount ?? 0) != eventTypeCount ||
            (model?.CommandCount ?? 0) != commandCount ||
            (model?.AdapterCount ?? 0) != adapterCount ||
            (model?.ExternalContractCount ?? 0) != externalContractCount ||
            (model?.MappingCount ?? 0) != mappingCount ||
            (model?.RouteCount ?? 0) != routeCount ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }
        return new EventIntegrationModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, Array.AsReadOnly(reasons), eventTypeCount, commandCount, adapterCount,
            externalContractCount, mappingCount, routeCount, uncoveredProcessEventCount, uncoveredProcessCount,
            uncoveredBoundedContextCount, uncoveredDataEntityCount, uncoveredAuthorizationActionCount,
            unknownMappingTruthCount, unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount,
            staleBindingCount, staleSourceReferenceCount, model, snapshotDigest);
    }
}
