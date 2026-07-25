using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string SourceProjectionPrivacyBoundary =
        "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials";
    private const string SourceProjectionAuthorityBoundary =
        "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action";
    private const string SourceAssessmentAuthorityBoundary =
        "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action";

    internal static SourceGovernanceProjection ParseSourceGovernanceResponse(
        JsonElement envelope,
        Guid expectedInitiativeId)
    {
        var projection = ReadResult(envelope);
        if (!HasOnlyProperties(
                projection,
                "schemaVersion", "kind", "product", "initiative", "assessment", "sources", "baselines",
                "provenance", "limits", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest") ||
            ParseBoundedNonNegativeInt(projection, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(projection, "kind", "source-governance-projection") != "source-governance-projection" ||
            ParseRequiredEnum(projection, "privacyBoundary", SourceProjectionPrivacyBoundary) !=
                SourceProjectionPrivacyBoundary ||
            ParseRequiredEnum(projection, "authorityBoundary", SourceProjectionAuthorityBoundary) !=
                SourceProjectionAuthorityBoundary)
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
        var initiativeState = ParseRequiredEnum(
            initiative,
            "state",
            "proposed",
            "active",
            "blocked",
            "completed",
            "cancelled");

        var assessment = projection.GetProperty("assessment");
        if (!HasRequiredAndAllowedProperties(
                assessment,
                [
                    "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                    "sourceCount", "baselineCount", "provenanceCount", "staleSourceCount", "unknownAuthorityCount",
                    "unbaselinedSourceCount", "unprovenancedSourceCount", "state", "reasons", "assessedAt",
                    "authorityBoundary",
                ],
                ["currentBaseline"]) ||
            ParseBoundedNonNegativeInt(assessment, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(assessment, "kind", "source-governance-assessment") !=
                "source-governance-assessment" ||
            ParseRequiredGuid(assessment, "productId") != productId ||
            ParsePositiveLong(assessment, "productRevision") != productRevision ||
            ParseRequiredGuid(assessment, "initiativeId") != initiativeId ||
            ParsePositiveLong(assessment, "initiativeRevision") != initiativeRevision ||
            ParseRequiredEnum(assessment, "authorityBoundary", SourceAssessmentAuthorityBoundary) !=
                SourceAssessmentAuthorityBoundary)
        {
            throw InvalidResponse();
        }

        var sourceCount = ParseBoundedNonNegativeInt(assessment, "sourceCount", 10_000);
        var baselineCount = ParseBoundedNonNegativeInt(assessment, "baselineCount", 10_000);
        var provenanceCount = ParseBoundedNonNegativeInt(assessment, "provenanceCount", 10_000);
        var staleSourceCount = ParseBoundedNonNegativeInt(assessment, "staleSourceCount", sourceCount);
        var unknownAuthorityCount = ParseBoundedNonNegativeInt(assessment, "unknownAuthorityCount", sourceCount);
        var unbaselinedSourceCount = ParseBoundedNonNegativeInt(assessment, "unbaselinedSourceCount", sourceCount);
        var unprovenancedSourceCount = ParseBoundedNonNegativeInt(assessment, "unprovenancedSourceCount", sourceCount);
        var assessmentState = ParseRequiredEnum(assessment, "state", "ready", "attention-required");
        var reasonsElement = assessment.GetProperty("reasons");
        if (reasonsElement.ValueKind != JsonValueKind.Array || reasonsElement.GetArrayLength() > 512)
        {
            throw InvalidResponse();
        }
        var reasons = reasonsElement.EnumerateArray()
            .Select(value => ParseSourceText(value, 2, 2_000))
            .ToArray();
        if ((assessmentState == "ready") != (reasons.Length == 0)) throw InvalidResponse();
        var assessedAt = ParseRequiredTimestamp(assessment, "assessedAt");
        var currentBaseline = assessment.TryGetProperty("currentBaseline", out var current)
            ? ParseCurrentSourceBaseline(current)
            : null;
        if ((baselineCount == 0) != (currentBaseline is null)) throw InvalidResponse();

        var limits = projection.GetProperty("limits");
        if (!HasOnlyProperties(limits, "sources", "baselines", "provenance")) throw InvalidResponse();
        var sourceShown = ParseSourceLimit(limits.GetProperty("sources"), sourceCount);
        var baselineShown = ParseSourceLimit(limits.GetProperty("baselines"), baselineCount);
        var provenanceShown = ParseSourceLimit(limits.GetProperty("provenance"), provenanceCount);

        var sourcesElement = projection.GetProperty("sources");
        if (sourcesElement.ValueKind != JsonValueKind.Array || sourcesElement.GetArrayLength() != sourceShown)
        {
            throw InvalidResponse();
        }
        var sources = sourcesElement.EnumerateArray().Select(ParseSourceView).ToArray();

        var baselinesElement = projection.GetProperty("baselines");
        if (baselinesElement.ValueKind != JsonValueKind.Array || baselinesElement.GetArrayLength() != baselineShown)
        {
            throw InvalidResponse();
        }
        var baselines = baselinesElement.EnumerateArray().Select(ParseSourceBaselineView).ToArray();

        var provenanceElement = projection.GetProperty("provenance");
        if (provenanceElement.ValueKind != JsonValueKind.Array ||
            provenanceElement.GetArrayLength() != provenanceShown)
        {
            throw InvalidResponse();
        }
        var provenance = provenanceElement.EnumerateArray().Select(ParseSourceProvenanceView).ToArray();

        if (sources.Select(value => value.Id).Distinct().Count() != sources.Length ||
            baselines.Select(value => value.Id).Distinct().Count() != baselines.Length ||
            provenance.Select(value => value.Id).Distinct().Count() != provenance.Length ||
            (currentBaseline is not null &&
             (baselines.Length == 0 || baselines[0].Id != currentBaseline.Id ||
              baselines[0].Revision != currentBaseline.Revision)) ||
            ParseRequiredTimestamp(projection, "observedAt") != assessedAt)
        {
            throw InvalidResponse();
        }

        return new SourceGovernanceProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            Array.AsReadOnly(reasons),
            sourceCount,
            baselineCount,
            provenanceCount,
            staleSourceCount,
            unknownAuthorityCount,
            unbaselinedSourceCount,
            unprovenancedSourceCount,
            currentBaseline,
            Array.AsReadOnly(sources),
            Array.AsReadOnly(baselines),
            Array.AsReadOnly(provenance),
            snapshotDigest);
    }

    private static SourceGovernanceCurrentBaseline ParseCurrentSourceBaseline(JsonElement current)
    {
        if (!HasOnlyProperties(current, "id", "revision", "digest", "membershipDigest", "status", "memberCount"))
        {
            throw InvalidResponse();
        }
        var memberCount = ParseBoundedNonNegativeInt(current, "memberCount", 2_000);
        if (memberCount < 1) throw InvalidResponse();
        return new SourceGovernanceCurrentBaseline(
            ParseRequiredGuid(current, "id"),
            ParsePositiveLong(current, "revision"),
            ParseRequiredDigest(current, "digest"),
            ParseRequiredDigest(current, "membershipDigest"),
            ParseRequiredEnum(current, "status", "current", "stale", "incomplete"),
            memberCount);
    }

    private static int ParseSourceLimit(JsonElement limit, int expectedTotal)
    {
        if (!HasOnlyProperties(limit, "shown", "total", "omitted")) throw InvalidResponse();
        var shown = ParseBoundedNonNegativeInt(limit, "shown", 200);
        var total = ParseBoundedNonNegativeInt(limit, "total", 10_000);
        var omitted = ParseBoundedNonNegativeInt(limit, "omitted", 10_000);
        if (total != expectedTotal || shown + omitted != total) throw InvalidResponse();
        return shown;
    }

    private static SourceGovernanceSourceView ParseSourceView(JsonElement source)
    {
        if (!HasOnlyProperties(
                source,
                "id", "revision", "title", "sourceType", "owner", "semanticAuthority", "knowledgeDisposition",
                "informationClassification", "freshness", "availability", "contentDigest", "recordDigest", "updatedAt"))
        {
            throw InvalidResponse();
        }
        var owner = source.GetProperty("owner");
        if (!HasRequiredAndAllowedProperties(owner, ["kind"], ["id"])) throw InvalidResponse();
        var ownerKind = ParseRequiredEnum(owner, "kind", "human", "organization", "role", "system", "unassigned");
        string? ownerId = null;
        if (owner.TryGetProperty("id", out var ownerIdElement))
        {
            ownerId = ParseSourceText(ownerIdElement, 2, 2_000);
        }
        if ((ownerKind == "unassigned") != (ownerId is null)) throw InvalidResponse();

        var semantic = source.GetProperty("semanticAuthority");
        if (!HasOnlyProperties(semantic, "standing", "domain", "scope")) throw InvalidResponse();
        var standing = ParseRequiredEnum(
            semantic,
            "standing",
            "authoritative",
            "advisory",
            "non-authoritative",
            "unknown");
        var domain = ParseSourceText(semantic.GetProperty("domain"), 2, 2_000);
        ValidateInitiativeTextArray(semantic.GetProperty("scope"), 1, 128);
        ParseRequiredDigest(source, "contentDigest");
        ParseRequiredDigest(source, "recordDigest");
        ParseRequiredTimestamp(source, "updatedAt");
        return new SourceGovernanceSourceView(
            ParseRequiredGuid(source, "id"),
            ParsePositiveLong(source, "revision"),
            ParseSourceText(source.GetProperty("title"), 2, 240),
            ParseRequiredEnum(
                source,
                "sourceType",
                "stakeholder-note",
                "voice-transcript",
                "whiteboard",
                "feature-list",
                "research",
                "repository",
                "requirements",
                "design",
                "architecture",
                "production-observation",
                "policy",
                "standard",
                "boilerplate",
                "dataset",
                "external-system",
                "other"),
            $"{ownerKind}:{ownerId ?? "unassigned"}",
            $"{standing} · {domain}",
            ParseRequiredEnum(
                source,
                "knowledgeDisposition",
                "confirmed",
                "inferred",
                "assumed",
                "placeholder",
                "deferred",
                "unknown"),
            ParseRequiredEnum(source, "informationClassification", "public", "internal", "confidential", "restricted"),
            ParseRequiredEnum(source, "freshness", "fresh", "potentially-stale", "stale", "unknown"),
            ParseRequiredEnum(source, "availability", "available", "unavailable", "moved", "deleted", "unknown"));
    }

    private static SourceGovernanceBaselineView ParseSourceBaselineView(JsonElement baseline)
    {
        if (!HasOnlyProperties(
                baseline,
                "id", "revision", "title", "state", "membershipDigest", "memberCount", "assessmentStatus",
                "updatedAt") ||
            ParseRequiredEnum(baseline, "state", "candidate") != "candidate")
        {
            throw InvalidResponse();
        }
        ParseRequiredDigest(baseline, "membershipDigest");
        var memberCount = ParseBoundedNonNegativeInt(baseline, "memberCount", 2_000);
        if (memberCount < 1) throw InvalidResponse();
        ParseRequiredTimestamp(baseline, "updatedAt");
        return new SourceGovernanceBaselineView(
            ParseRequiredGuid(baseline, "id"),
            ParsePositiveLong(baseline, "revision"),
            ParseSourceText(baseline.GetProperty("title"), 2, 240),
            memberCount,
            ParseRequiredEnum(baseline, "assessmentStatus", "current", "stale", "incomplete", "not-assessed"));
    }

    private static SourceGovernanceProvenanceView ParseSourceProvenanceView(JsonElement provenance)
    {
        if (!HasRequiredAndAllowedProperties(
                provenance,
                [
                    "id", "targetKind", "targetDigest", "disposition", "sourceCount", "transformationCount",
                    "recordedAt",
                ],
                ["amendmentRecordId"]))
        {
            throw InvalidResponse();
        }
        ParseRequiredDigest(provenance, "targetDigest");
        var sourceCount = ParseBoundedNonNegativeInt(provenance, "sourceCount", 256);
        if (sourceCount < 1) throw InvalidResponse();
        var transformationCount = ParseBoundedNonNegativeInt(provenance, "transformationCount", 128);
        if (provenance.TryGetProperty("amendmentRecordId", out _))
        {
            ParseRequiredGuid(provenance, "amendmentRecordId");
        }
        ParseRequiredTimestamp(provenance, "recordedAt");
        return new SourceGovernanceProvenanceView(
            ParseRequiredGuid(provenance, "id"),
            ParseRequiredEnum(provenance, "targetKind", "governed-record", "claim", "artifact"),
            ParseRequiredEnum(
                provenance,
                "disposition",
                "confirmed",
                "inferred",
                "assumed",
                "placeholder",
                "deferred",
                "unknown"),
            sourceCount,
            transformationCount);
    }

    private static string ParseSourceText(JsonElement value, int minimum, int maximum)
    {
        if (value.ValueKind != JsonValueKind.String ||
            !ValidPortableText(value.GetString(), minimum: minimum, maximum: maximum))
        {
            throw InvalidResponse();
        }
        return value.GetString()!;
    }
}
