using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    internal const int ProtocolVersion = 2;
    internal const int MaxOffset = 10_000;
    internal const int MaxPageSize = 200;
    internal const int DefaultPageSize = 100;
    internal const long MaxSafeProductRevision = 9_007_199_254_740_991;
    private const string SummaryKind = "portable-design-snapshot-summary";
    private const string GovernanceState = "pending-human-review";
    private const string ClaimBoundary = "import-validation-is-not-design-approval-or-baseline";
    private const string NonEscalation = "not-gaep-approval-design-baseline-implementation-or-release-readiness";
    private const string SummaryPrivacyBoundary = "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.";
    private const string PageGovernanceBoundary = "Every item remains pending human review; source review is an upstream claim only.";
    private const string PagePrivacyBoundary = "Items contain validated metadata and digests only; local paths and source content are omitted.";
    private const string ManagedPreviewBoundary = "managed-readonly-preview-does-not-grant-execution-or-effect-authority";
    private const string ManagedReceiptBoundary = "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority";
    private const string ManagedInventoryBoundary = "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority";
    private const string ManagedEvidenceBoundary = "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority";
    private const string ManagedEvidencePrivacyBoundary = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.";
    private const string ManagedReviewBoundary = "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision";
    private const string ManagedReviewPrivacyBoundary = "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted.";
    private const string ManagedReviewTransitionBoundary = "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup";
    private const string ManagedReviewCleanupBoundary = "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.";
    private const string PhaseDashboardAuthorityBoundary =
        "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence";
    private const string Phase1SummaryAuthorityBoundary =
        "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority";
    private const string Phase1SummarySourceBoundary =
        "current-governed-product-initiative-readiness-and-handoff-projections-only";
    private const string Phase1SummaryPrivacyBoundary =
        "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials";
    private const string ChangeCatalogAuthorityBoundary =
        "change-catalog-selection-does-not-approve-change-or-authorize-effects";
    private const string ChangeDashboardAuthorityBoundary =
        "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects";
    private const string AgentModelAuthorityBoundary =
        "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects";
    private static readonly HashSet<string> ChangeImpactEffects = new(StringComparer.Ordinal)
    {
        "observe", "provisional", "reversible-change", "external-effect", "destructive-or-irreversible",
    };
    private static readonly HashSet<string> ChangeImpactStates = new(StringComparer.Ordinal)
    {
        "proposed", "planned", "active", "blocked", "completed", "cancelled",
    };
    private static readonly (string OutputKind, string RecordKind)[] Phase1ImpactOutputRecordKinds =
    [
        ("architecture-challenge-model", "architecture-challenge-model"),
        ("authorization-model", "authorization-model"),
        ("bounded-context-ownership", "bounded-context-model"),
        ("business-architecture-baseline", "business-architecture-baseline"),
        ("business-capability-map", "business-capability-map"),
        ("business-rule-catalog", "business-rule-catalog"),
        ("business-understanding", "business-understanding"),
        ("candidate-source-baseline", "source-baseline"),
        ("data-model", "data-model"),
        ("decision-register", "decision-register"),
        ("end-to-end-traceability", "end-to-end-traceability-candidate"),
        ("event-integration-model", "event-integration-model"),
        ("evidence-registry", "evidence-registry"),
        ("failure-recovery-model", "failure-recovery-model"),
        ("initiative-entry", "initiative"),
        ("operating-model", "operating-model"),
        ("outcome-success-model", "outcome-model"),
        ("process-model", "process-model"),
        ("risk-register", "risk-register"),
        ("security-privacy-threat-assessment", "security-privacy-threat-assessment"),
        ("source-intake", "source-record"),
        ("source-provenance", "source-provenance"),
        ("stakeholder-role-model", "stakeholder-model"),
        ("system-solution-architecture", "system-solution-architecture"),
        ("value-stream-model", "value-stream-model"),
    ];
    private static readonly HashSet<string> ChangeImpactWorkItemStates = new(ChangeImpactStates, StringComparer.Ordinal)
    {
        "ready", "in-progress",
    };
    private static readonly HashSet<string> ChangeImpactRelationships = new(StringComparer.Ordinal)
    {
        "targets", "derives-from", "contributes-to", "depends-on", "implements", "satisfies", "validates",
        "mitigates", "decides", "affects", "supersedes", "related-to",
    };
    private static readonly HashSet<string> ChangeImpactRecordTypes = new(StringComparer.Ordinal)
    {
        "product", "design-revision", "initiative", "change", "work-item", "requirement", "decision", "risk",
        "architecture", "evidence", "context-pack", "workflow-plan", "tool-definition",
        "instruction-privilege-grant", "run-tool-selection", "run", "external",
    };
    private static readonly IReadOnlyDictionary<DeliveryPhaseId, (string WireValue, string Label, string PanelId)>
        DeliveryPhaseCatalog = new Dictionary<DeliveryPhaseId, (string WireValue, string Label, string PanelId)>
        {
            [DeliveryPhaseId.Phase0Foundation] =
                ("phase-0-1a-foundation", "Phase 0 / 1A — Four-IDE Platform Foundation", "foundation-summary"),
            [DeliveryPhaseId.Phase1Product] =
                ("phase-1b-product", "Phase 1B — Product P0–P4", "product-architecture"),
            [DeliveryPhaseId.Phase1Acceptance] =
                ("phase-1c-acceptance", "Phase 1C — Four-IDE Phase 1 Release", "phase-release-readiness"),
            [DeliveryPhaseId.Phase2Design] =
                ("phase-2-design", "Phase 2 — UX and Figma Loop", "ux-figma"),
            [DeliveryPhaseId.Phase3Readiness] =
                ("phase-3a-readiness", "Phase 3A — Backlog and Implementation Readiness", "backlog-readiness"),
            [DeliveryPhaseId.Phase3Implementation] =
                ("phase-3b-implementation", "Phase 3B — Controlled Implementation and QA", "implementation-qa"),
            [DeliveryPhaseId.Phase4ReleaseLearning] =
                ("phase-4-release-learning", "Phase 4 — Release, Publish, and Learning", "release-learning"),
        };
    private static readonly IReadOnlyDictionary<string, (string Role, string Title)> PhaseDashboardPanelCatalog =
        new Dictionary<string, (string Role, string Title)>(StringComparer.Ordinal)
        {
            ["foundation-summary"] = ("phase", "Foundation summary and readiness"),
            ["product-architecture"] = ("phase", "Product and architecture"),
            ["phase-release-readiness"] = ("phase", "Phase release readiness"),
            ["ux-figma"] = ("phase", "UX and Figma"),
            ["backlog-readiness"] = ("phase", "Backlog and implementation readiness"),
            ["implementation-qa"] = ("phase", "Controlled implementation and QA"),
            ["release-learning"] = ("phase", "Release and learning"),
            ["change-impact"] = ("change-impact", "Change and impact"),
            ["agent-model"] = ("agent-model", "Agent and model"),
        };
    private static readonly JsonSerializerOptions StrictJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };
    private static readonly IReadOnlyDictionary<string, (int Code, string Message)> StableHostErrors =
        new Dictionary<string, (int Code, string Message)>(StringComparer.Ordinal)
        {
            ["PORTABLE_DESIGN_SOURCE_INVALID"] = (-32_030, "The local portable design bundle did not pass bounded validation."),
            ["PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED"] = (-32_031, "The portable design request no longer matches the exact Product revision."),
            ["PORTABLE_DESIGN_AUDIT_INVALID"] = (-32_032, "GAEP could not verify the governed audit boundary for this portable design request."),
            ["PORTABLE_DESIGN_INTEGRITY_INVALID"] = (-32_033, "GAEP could not verify the portable design snapshot inventory and metadata."),
            ["PORTABLE_DESIGN_CONFLICT"] = (-32_034, "The portable design snapshot identity conflicts with governed inventory."),
            ["PORTABLE_DESIGN_NOT_FOUND"] = (-32_035, "The requested portable design snapshot does not exist in the current Product."),
            ["INVALID_CAPABILITY_SNAPSHOT"] = (-32_010, "The GAEP engine could not verify the agent capability snapshot."),
            ["CAPABILITIES_NOT_AVAILABLE"] = (-32_011, "The GAEP engine could not observe agent capabilities."),
            ["EXECUTABLE_UNAVAILABLE"] = (-32_013, "The configured agent executable is unavailable."),
            ["EXECUTABLE_CHANGED"] = (-32_014, "The configured agent executable changed during capability discovery."),
            ["CAPABILITIES_CHANGED"] = (-32_012, "Agent capabilities changed during selection; probe again."),
            ["AGENT_SELECTION_ACTIVE_RUN"] = (-32_015, "Agent selection cannot change while a Run is non-terminal."),
            ["AGENT_SELECTION_MIGRATION_REQUIRED"] = (-32_016, "The legacy Agent Selection requires explicit re-probe and reconfirmation."),
            ["AGENT_SELECTION_HANDOFF_REQUIRED"] = (-32_017, "A versioned handoff is required before changing agent, model, or settings after a Run."),
            ["AGENT_SELECTION_INVALID"] = (-32_018, "The persisted Agent Selection is invalid and cannot be replaced implicitly."),
            ["MANAGED_READ_ONLY_PREVIEW_CHANGED"] = (-32_022, "The managed read-only preview changed before execution; review the current preview."),
            ["MANAGED_READ_ONLY_RECEIPT_INVALID"] = (-32_023, "GAEP could not verify the managed read-only terminal evidence."),
            ["MANAGED_EVIDENCE_AUDIT_INVALID"] = (-32_024, "Managed Run evidence is unavailable because the governed audit chain is invalid."),
            ["MANAGED_EVIDENCE_SNAPSHOT_CHANGED"] = (-32_025, "Managed Run inventory changed during pagination; reload the first page."),
            ["MANAGED_EVIDENCE_INVENTORY_INVALID"] = (-32_026, "GAEP could not verify the bounded Managed Run inventory."),
            ["MANAGED_EVIDENCE_DETAIL_INVALID"] = (-32_027, "GAEP could not verify the exact Managed Run evidence detail."),
            ["MANAGED_REVIEW_AUDIT_INVALID"] = (-32_028, "Managed Run review is unavailable because the governed audit chain is invalid."),
            ["MANAGED_REVIEW_CHANGED"] = (-32_029, "The Managed Run review changed before the decision; open and review the current exact inventory."),
            ["MANAGED_REVIEW_INVALID"] = (-32_036, "GAEP could not verify an exact pending Managed Run review."),
            ["MANAGED_REVIEW_APPLY_FAILED"] = (-32_037, "The exact Managed Run apply transition could not be verified; reload the review before any retry."),
            ["MANAGED_REVIEW_DISCARD_FAILED"] = (-32_038, "The exact Managed Run discard transition could not be verified; reload the review before any retry."),
            ["DASHBOARD_PRODUCT_CONTEXT_CHANGED"] = (-32_039, "The Product changed before the phase dashboard was composed; reload the current Product."),
            ["CHANGE_IMPACT_PRODUCT_CONTEXT_CHANGED"] = (-32_040, "The Product changed before the Change/Impact projection was composed; reload the current Product."),
            ["CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED"] = (-32_041, "The Change changed before the Change/Impact projection was composed; select the current Change again."),
            ["CHANGE_IMPACT_AUDIT_INVALID"] = (-32_042, "The Change/Impact projection is unavailable because the governed audit chain is invalid."),
            ["CHANGE_IMPACT_CATALOG_INVALID"] = (-32_043, "The current Change catalog could not be verified."),
            ["PHASE1_CHANGE_IMPACT_AUDIT_INVALID"] = (-32_048, "The Phase 1 Change/Impact projection is unavailable because the governed audit chain is invalid."),
            ["PHASE1_CHANGE_IMPACT_CONTEXT_CHANGED"] = (-32_049, "The Phase 1 Change/Impact context changed; reload the exact Product, Initiative, Change, readiness, handoff, and trace records."),
            ["INVALID_PARAMS"] = (-32_602, "The GAEP engine rejected the local request parameters."),
            ["PROTOCOL_UPGRADE_REQUIRED"] = (-32_021, "The GAEP engine requires protocol version 2 for portable design requests."),
            ["UNSUPPORTED_PROTOCOL_VERSION"] = (-32_020, "The GAEP engine does not support the requested portable design protocol version."),
            ["FRAME_TOO_LARGE"] = (-32_001, "The GAEP engine rejected a frame that exceeded the protocol boundary."),
            ["RESPONSE_TOO_LARGE"] = (-32_002, "The GAEP engine response exceeded the protocol boundary."),
            ["INVALID_UTF8"] = (-32_700, "The GAEP engine response was not valid UTF-8."),
        };

    internal static string NormalizeBundleRoot(string bundleRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(bundleRoot);
        if (bundleRoot.Length > 32_768 || bundleRoot.Contains('\0') ||
            !Path.IsPathFullyQualified(bundleRoot) || IsNetworkPath(bundleRoot))
        {
            throw new ArgumentException("Portable design bundle root must be an absolute local folder.", nameof(bundleRoot));
        }
        var normalized = Path.GetFullPath(bundleRoot);
        if (!Directory.Exists(normalized))
        {
            throw new ArgumentException("Portable design bundle root must be an existing local folder.", nameof(bundleRoot));
        }
        return normalized;
    }

    internal static void ValidateProductRevision(long revision)
    {
        if (revision is < 1 or > MaxSafeProductRevision)
        {
            throw new ArgumentOutOfRangeException(nameof(revision), "Product revision must be a positive protocol-safe integer.");
        }
    }

    internal static string ValidateProductDigest(string digest)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(digest);
        if (!DigestPattern().IsMatch(digest))
        {
            throw new ArgumentException("Product digest must be a canonical SHA-256 digest.", nameof(digest));
        }
        return digest;
    }

    internal static string SerializeDeliveryPhase(DeliveryPhaseId phase) =>
        DeliveryPhaseCatalog.TryGetValue(phase, out var definition)
            ? definition.WireValue
            : throw new ArgumentOutOfRangeException(nameof(phase), "Delivery phase is outside the canonical catalog.");

    internal static string ValidateActorId(string actorId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actorId);
        var normalized = actorId.Trim();
        if (normalized.Length > 256 || !ActorIdPattern().IsMatch(normalized))
        {
            throw new ArgumentException("Actor ID must be a portable human principal.", nameof(actorId));
        }
        return normalized;
    }

    internal static string ValidateSelectionIdentifier(string value, string label)
    {
        if (!ValidPortableText(value, minimum: 1))
        {
            throw new ArgumentException($"{label} must be verified portable capability text.", nameof(value));
        }
        return value;
    }

    internal static string ValidatePortableSettingInput(string value, string label, int minimum = 0)
    {
        if (!ValidPortableSettingText(value, minimum))
        {
            throw new ArgumentException(
                $"{label} must be portable text without paths, controls, or secret-shaped values.",
                nameof(value));
        }
        return value;
    }

    internal static string ValidateHandoffText(string value, string label, int minimum, int maximum)
    {
        ArgumentNullException.ThrowIfNull(value);
        var normalized = value.Trim();
        if (normalized.Length < minimum || normalized.Length > maximum || normalized.Any(char.IsControl) ||
            HandoffPathPattern().IsMatch(normalized) || SecretPattern().IsMatch(normalized))
        {
            throw new ArgumentException(
                $"{label} must be portable text without paths, controls, or secret-shaped values.",
                nameof(value));
        }
        return normalized;
    }

    internal static IReadOnlyList<string> ValidateHandoffTextList(
        IReadOnlyList<string> values,
        string label)
    {
        ArgumentNullException.ThrowIfNull(values);
        if (values.Count > 256) throw new ArgumentException($"{label} may contain at most 256 entries.", nameof(values));
        return Array.AsReadOnly(values.Select(value => ValidateHandoffText(value, label, 1, 2_000)).ToArray());
    }

    internal static bool PortableSettingsEqual(
        IReadOnlyDictionary<string, PortableAgentSettingValue> left,
        IReadOnlyDictionary<string, PortableAgentSettingValue> right)
    {
        if (left.Count != right.Count) return false;
        foreach (var (key, value) in left)
        {
            if (!right.TryGetValue(key, out var candidate) || !PortableSettingValuesEqual(value, candidate)) return false;
        }
        return true;
    }

    internal static IReadOnlyDictionary<string, object?> SerializePortableAgentSettings(
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        if (settings.Count > 128) throw new ArgumentException("Agent settings may contain at most 128 portable values.", nameof(settings));
        var serialized = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var (key, value) in settings)
        {
            if (!ValidPortableSettingKey(key))
            {
                throw new ArgumentException("Agent settings must use portable non-secret keys.", nameof(settings));
            }
            serialized[key] = SerializePortableAgentSettingValue(value);
        }
        return serialized;
    }

    internal static void ValidatePage(int offset, int limit)
    {
        if (offset is < 0 or > MaxOffset) throw new ArgumentOutOfRangeException(nameof(offset));
        if (limit is < 1 or > MaxPageSize) throw new ArgumentOutOfRangeException(nameof(limit));
    }

    internal static void ValidateManagedEvidencePage(
        int offset,
        int limit,
        string? snapshotDigest,
        int? expectedTotal = null)
    {
        if (offset is < 0 or > 2_000) throw new ArgumentOutOfRangeException(nameof(offset));
        if (limit is < 1 or > 200) throw new ArgumentOutOfRangeException(nameof(limit));
        if (snapshotDigest is not null && !DigestPattern().IsMatch(snapshotDigest))
        {
            throw new ArgumentException("Managed Run snapshot digest must be SHA-256.", nameof(snapshotDigest));
        }
        if (expectedTotal is < 0 or > 2_000) throw new ArgumentOutOfRangeException(nameof(expectedTotal));
    }

    internal static PortableDesignSnapshotSummary ParseSnapshotResponse(
        JsonElement envelope,
        Guid? expectedBundleId = null,
        Guid? expectedProductId = null)
    {
        var result = ReadResult(envelope);
        SnapshotWire wire;
        try
        {
            wire = result.Deserialize<SnapshotWire>(StrictJson)
                ?? throw new InvalidDataException("Portable design snapshot response is empty.");
        }
        catch (JsonException)
        {
            throw InvalidResponse();
        }
        var summary = ParseSnapshot(wire);
        if ((expectedBundleId.HasValue && summary.BundleId != expectedBundleId.Value) ||
            (expectedProductId.HasValue && summary.ProductId != expectedProductId.Value))
        {
            throw InvalidResponse();
        }
        return summary;
    }

    internal static ProductBinding ParseProductBindingResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        var properties = result.EnumerateObject().Select(property => property.Name).ToArray();
        if (properties.Distinct(StringComparer.Ordinal).Count() != properties.Length ||
            !result.TryGetProperty("id", out var idElement) || idElement.ValueKind != JsonValueKind.String ||
            !Guid.TryParseExact(idElement.GetString(), "D", out var id) || id == Guid.Empty ||
            !result.TryGetProperty("name", out var nameElement) || nameElement.ValueKind != JsonValueKind.String)
        {
            throw InvalidResponse();
        }
        var name = nameElement.GetString();
        var revision = 1L;
        if (result.TryGetProperty("revision", out var revisionElement) && !revisionElement.TryGetInt64(out revision))
        {
            throw InvalidResponse();
        }
        if (name is null || name.Length is < 1 or > 240 || name != name.Trim() || name.Any(char.IsControl) ||
            revision is < 1 or > MaxSafeProductRevision)
        {
            throw InvalidResponse();
        }
        return new ProductBinding(id, name, revision, CanonicalDigest(result));
    }

    internal static PhaseDashboardFramework ParsePhaseDashboardResponse(
        JsonElement envelope,
        DeliveryPhaseId expectedPhase,
        ProductBinding expectedProduct)
    {
        if (!DeliveryPhaseCatalog.TryGetValue(expectedPhase, out var phaseDefinition)) throw InvalidResponse();
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "catalogVersion", "product", "phase", "panels", "evidenceCues", "observedAt",
                "sourceBoundary", "limitations", "authorityBoundary", "compositionDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) ||
            schema != 1 || ParseRequiredEnum(result, "kind", "phase-dashboard-framework") != "phase-dashboard-framework" ||
            ParseRequiredEnum(result, "catalogVersion", "gaep-phase-dashboards-v1") != "gaep-phase-dashboards-v1" ||
            ParseRequiredEnum(result, "sourceBoundary", "governed-repository-and-engine-only") !=
                "governed-repository-and-engine-only" ||
            ParseRequiredEnum(result, "authorityBoundary", PhaseDashboardAuthorityBoundary) !=
                PhaseDashboardAuthorityBoundary)
        {
            throw InvalidResponse();
        }

        var product = result.GetProperty("product");
        if (product.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(product, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(product, "recordType", "product") != "product")
        {
            throw InvalidResponse();
        }
        var productId = ParseRequiredGuid(product, "recordId");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        if (productId != expectedProduct.Id || productRevision != expectedProduct.Revision ||
            productDigest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }

        var phase = result.GetProperty("phase");
        if (phase.ValueKind != JsonValueKind.Object || !HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredPortableText(phase, "id") != phaseDefinition.WireValue ||
            ParseRequiredPortableText(phase, "label") != phaseDefinition.Label)
        {
            throw InvalidResponse();
        }

        var panelsElement = result.GetProperty("panels");
        if (panelsElement.ValueKind != JsonValueKind.Array || panelsElement.GetArrayLength() != 3)
        {
            throw InvalidResponse();
        }
        var expectedPanelIds = new[] { phaseDefinition.PanelId, "change-impact", "agent-model" };
        var panels = panelsElement.EnumerateArray()
            .Select((panel, index) => ParsePhaseDashboardPanel(panel, expectedPanelIds[index]))
            .ToArray();

        var limitationsElement = result.GetProperty("limitations");
        if (limitationsElement.ValueKind != JsonValueKind.Array || limitationsElement.GetArrayLength() is < 1 or > 8)
        {
            throw InvalidResponse();
        }
        var limitations = new List<string>();
        foreach (var limitation in limitationsElement.EnumerateArray())
        {
            if (limitation.ValueKind != JsonValueKind.String ||
                !ValidPortableText(limitation.GetString(), minimum: 4, maximum: 1_000))
            {
                throw InvalidResponse();
            }
            limitations.Add(limitation.GetString()!);
        }

        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        var compositionDigest = ParseRequiredDigest(result, "compositionDigest");
        var compositionBody = JsonSerializer.SerializeToElement(
            result.EnumerateObject()
                .Where(property => property.Name != "compositionDigest")
                .ToDictionary(property => property.Name, property => property.Value.Clone(), StringComparer.Ordinal));
        if (compositionDigest != CanonicalDigest(compositionBody)) throw InvalidResponse();

        return new PhaseDashboardFramework(
            productId,
            productRevision,
            productDigest,
            expectedPhase,
            phaseDefinition.Label,
            Array.AsReadOnly(panels),
            ParseDashboardEvidenceCues(result.GetProperty("evidenceCues"), "current"),
            observedAt,
            "governed-repository-and-engine-only",
            Array.AsReadOnly(limitations.ToArray()),
            compositionDigest);
    }

    internal static Phase1SummaryDashboard ParsePhase1SummaryResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        InitiativeEntryRecord expectedInitiative)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "phase", "product", "initiative", "readiness", "handoff", "phaseStatus",
                "owners", "freshness", "evidenceCues", "observedAt", "sourceBoundary", "privacyBoundary", "limitations",
                "authorityBoundary", "snapshotDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) || schema != 1 ||
            ParseRequiredEnum(result, "kind", "phase-1-summary-readiness-dashboard") != "phase-1-summary-readiness-dashboard" ||
            ParseRequiredEnum(result, "sourceBoundary", Phase1SummarySourceBoundary) != Phase1SummarySourceBoundary ||
            ParseRequiredEnum(result, "privacyBoundary", Phase1SummaryPrivacyBoundary) != Phase1SummaryPrivacyBoundary ||
            ParseRequiredEnum(result, "authorityBoundary", Phase1SummaryAuthorityBoundary) != Phase1SummaryAuthorityBoundary)
        {
            throw InvalidResponse();
        }

        var phase = result.GetProperty("phase");
        if (phase.ValueKind != JsonValueKind.Object || !HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredEnum(phase, "id", "phase-1b-product") != "phase-1b-product" ||
            ParseRequiredPortableText(phase, "label") != "Phase 1B — Product P0–P4") throw InvalidResponse();

        var product = result.GetProperty("product");
        if (product.ValueKind != JsonValueKind.Object || !HasOnlyProperties(product, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(product, "recordType", "product") != "product") throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "recordId");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        if (productId != expectedProduct.Id || productRevision != expectedProduct.Revision || productDigest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }

        var initiative = result.GetProperty("initiative");
        if (initiative.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(initiative, "recordType", "recordId", "revision", "digest", "state") ||
            ParseRequiredEnum(initiative, "recordType", "initiative") != "initiative") throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "recordId");
        var initiativeRevision = ParsePositiveLong(initiative, "revision");
        var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "active", "blocked", "cancelled", "completed", "proposed");
        if (initiativeId != expectedInitiative.Id || initiativeRevision != expectedInitiative.Revision ||
            initiativeDigest != expectedInitiative.Digest || initiativeState != expectedInitiative.State ||
            expectedInitiative.ProductId != expectedProduct.Id) throw InvalidResponse();

        static long NonNegative(JsonElement element, string name, long maximum = long.MaxValue)
        {
            if (!element.TryGetProperty(name, out var value) || !value.TryGetInt64(out var parsed) || parsed < 0 || parsed > maximum)
            {
                throw InvalidResponse();
            }
            return parsed;
        }

        static bool ValidateOptionalReference(JsonElement container, string name)
        {
            if (!container.TryGetProperty(name, out var reference)) return false;
            if (reference.ValueKind != JsonValueKind.Object || !HasOnlyProperties(reference, "recordId", "revision", "digest"))
            {
                throw InvalidResponse();
            }
            ParseRequiredGuid(reference, "recordId");
            ParsePositiveLong(reference, "revision");
            ParseRequiredDigest(reference, "digest");
            return true;
        }

        static long ReconciledGapTotal(JsonElement gaps, params string[] fields)
        {
            if (gaps.ValueKind != JsonValueKind.Object || !HasOnlyProperties(gaps, fields.Append("total").ToArray()))
            {
                throw InvalidResponse();
            }
            var expected = fields.Aggregate(0L, (sum, field) => checked(sum + NonNegative(gaps, field)));
            var declared = NonNegative(gaps, "total");
            if (declared != expected) throw InvalidResponse();
            return declared;
        }

        var readiness = result.GetProperty("readiness");
        if (readiness.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                readiness,
                ["snapshotDigest", "result", "assessedAt", "outputs", "gaps", "reasonCount", "attentionRequired", "authorityBoundary"],
                ["gate"]) ||
            ParseRequiredEnum(readiness, "authorityBoundary", "readiness-result-is-evaluation-only-not-permission-or-product-readiness") !=
            "readiness-result-is-evaluation-only-not-permission-or-product-readiness") throw InvalidResponse();
        ParseRequiredDigest(readiness, "snapshotDigest");
        var readinessResult = ParseRequiredEnum(
            readiness, "result", "blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed");
        var hasGate = ValidateOptionalReference(readiness, "gate");
        var readinessAssessedAt = ParseRequiredTimestamp(readiness, "assessedAt");
        var outputs = readiness.GetProperty("outputs");
        if (outputs.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(outputs, "total", "applicable", "notApplicable", "unresolvedApplicability", "satisfied"))
        {
            throw InvalidResponse();
        }
        var readinessTotal = NonNegative(outputs, "total", 25);
        var readinessApplicable = NonNegative(outputs, "applicable", 25);
        var readinessNotApplicable = NonNegative(outputs, "notApplicable", 25);
        var readinessUnresolved = NonNegative(outputs, "unresolvedApplicability", 25);
        var readinessSatisfied = NonNegative(outputs, "satisfied", 25);
        if (readinessApplicable + readinessNotApplicable + readinessUnresolved != readinessTotal ||
            readinessSatisfied > readinessApplicable) throw InvalidResponse();
        var readinessGapCount = ReconciledGapTotal(
            readiness.GetProperty("gaps"),
            "applicability", "conditional", "incomplete", "failed", "blocked", "staleOrUnknown", "waivers",
            "decisions", "conditions", "requirements", "adverseEvidence", "bindings", "sourceReferences",
            "inconsistencies", "questions");
        NonNegative(readiness, "reasonCount");
        var readinessAttention = readinessResult != "passed" || readinessGapCount > 0 || !hasGate;
        if (ParseRequiredBoolean(readiness, "attentionRequired") != readinessAttention) throw InvalidResponse();

        var handoff = result.GetProperty("handoff");
        if (handoff.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                handoff,
                ["snapshotDigest", "state", "transferState", "assessedAt", "items", "gaps", "reasonCount", "attentionRequired", "authorityBoundary"],
                ["package"]) ||
            ParseRequiredEnum(handoff, "authorityBoundary", "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority") !=
            "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority") throw InvalidResponse();
        ParseRequiredDigest(handoff, "snapshotDigest");
        var handoffState = ParseRequiredEnum(handoff, "state", "attention-required", "complete-for-review");
        var handoffTransferState = ParseRequiredEnum(handoff, "transferState", "draft", "held", "ready-for-human-review");
        var hasHandoff = ValidateOptionalReference(handoff, "package");
        var handoffAssessedAt = ParseRequiredTimestamp(handoff, "assessedAt");
        var items = handoff.GetProperty("items");
        if (items.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(items, "total", "included", "referenceOnly", "omittedNotApplicable", "unresolved"))
        {
            throw InvalidResponse();
        }
        var handoffTotal = NonNegative(items, "total", 25);
        var handoffIncluded = NonNegative(items, "included", 25);
        var handoffReferenceOnly = NonNegative(items, "referenceOnly", 25);
        var handoffOmitted = NonNegative(items, "omittedNotApplicable", 25);
        var handoffUnresolved = NonNegative(items, "unresolved", 25);
        if (handoffIncluded + handoffReferenceOnly + handoffOmitted + handoffUnresolved != handoffTotal) throw InvalidResponse();
        var handoffGapCount = ReconciledGapTotal(
            handoff.GetProperty("gaps"),
            "unresolvedItems", "staleOrUnknownItems", "requirements", "conflicts", "questions", "bindings", "sourceReferences");
        NonNegative(handoff, "reasonCount");
        var handoffAttention = handoffState != "complete-for-review" || handoffGapCount > 0 || !hasHandoff;
        if (ParseRequiredBoolean(handoff, "attentionRequired") != handoffAttention) throw InvalidResponse();

        var freshness = result.GetProperty("freshness");
        if (freshness.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                freshness,
                "state", "readinessObservedAt", "handoffObservedAt", "staleBindingCount", "staleSourceReferenceCount", "basis") ||
            ParseRequiredEnum(freshness, "basis", "exact-current-projections-and-declared-binding-freshness") !=
            "exact-current-projections-and-declared-binding-freshness") throw InvalidResponse();
        var staleBindingCount = NonNegative(freshness, "staleBindingCount");
        var staleSourceReferenceCount = NonNegative(freshness, "staleSourceReferenceCount");
        var freshnessAttention = staleBindingCount > 0 || staleSourceReferenceCount > 0;
        var freshnessState = ParseRequiredEnum(freshness, "state", "current", "attention-required");
        if ((freshnessState == "attention-required") != freshnessAttention) throw InvalidResponse();
        var readinessObservedAt = ParseRequiredTimestamp(freshness, "readinessObservedAt");
        var handoffObservedAt = ParseRequiredTimestamp(freshness, "handoffObservedAt");

        var phaseStatus = result.GetProperty("phaseStatus");
        if (phaseStatus.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                phaseStatus,
                "state", "declaredGapCount", "attentionSignalCount", "productOwnerAcceptance", "readinessAuthority",
                "phaseEntryAuthority")) throw InvalidResponse();
        var declaredGapCount = NonNegative(phaseStatus, "declaredGapCount");
        var attentionSignalCount = checked((int)NonNegative(phaseStatus, "attentionSignalCount", 3));
        var expectedAttentionSignals = new[] { readinessAttention, handoffAttention, freshnessAttention }.Count(value => value);
        var expectedPhaseState = expectedAttentionSignals == 0 ? "candidate-complete-for-human-review" : "attention-required";
        var phaseState = ParseRequiredEnum(phaseStatus, "state", "attention-required", "candidate-complete-for-human-review");
        if (declaredGapCount != readinessGapCount + handoffGapCount || attentionSignalCount != expectedAttentionSignals ||
            phaseState != expectedPhaseState || ParseRequiredEnum(phaseStatus, "productOwnerAcceptance", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "readinessAuthority", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "phaseEntryAuthority", "not-established") != "not-established") throw InvalidResponse();

        var owners = result.GetProperty("owners");
        if (owners.ValueKind != JsonValueKind.Object || !HasOnlyProperties(owners, "state", "boundOwnerCount", "basis") ||
            ParseRequiredEnum(owners, "state", "unbound") != "unbound" || NonNegative(owners, "boundOwnerCount", 0) != 0 ||
            ParseRequiredEnum(owners, "basis", "no-governed-phase-owner-assignment-is-bound") !=
            "no-governed-phase-owner-assignment-is-bound") throw InvalidResponse();
        ParseDashboardEvidenceCues(result.GetProperty("evidenceCues"), freshnessAttention ? "potentially-stale" : "current");

        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        if (readinessAssessedAt > observedAt || handoffAssessedAt > observedAt ||
            readinessObservedAt > observedAt || handoffObservedAt > observedAt) throw InvalidResponse();
        var limitationsElement = result.GetProperty("limitations");
        if (limitationsElement.ValueKind != JsonValueKind.Array || limitationsElement.GetArrayLength() is < 1 or > 8)
        {
            throw InvalidResponse();
        }
        var limitations = limitationsElement.EnumerateArray().Select(value =>
        {
            if (value.ValueKind != JsonValueKind.String || !ValidPortableText(value.GetString(), minimum: 4, maximum: 1_000))
            {
                throw InvalidResponse();
            }
            return value.GetString()!;
        }).ToArray();
        var snapshotDigest = ParseRequiredDigest(result, "snapshotDigest");
        var digestBody = JsonSerializer.SerializeToElement(
            result.EnumerateObject()
                .Where(property => property.Name != "snapshotDigest")
                .ToDictionary(property => property.Name, property => property.Value.Clone(), StringComparer.Ordinal));
        if (snapshotDigest != CanonicalDigest(digestBody)) throw InvalidResponse();

        return new Phase1SummaryDashboard(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            phaseState, declaredGapCount, attentionSignalCount, readinessResult, readinessSatisfied, readinessApplicable,
            readinessTotal, readinessGapCount, handoffState, handoffTransferState, handoffIncluded, handoffTotal,
            handoffGapCount, freshnessState, staleBindingCount, staleSourceReferenceCount, observedAt,
            Phase1SummarySourceBoundary, Phase1SummaryPrivacyBoundary, Array.AsReadOnly(limitations), snapshotDigest);
    }

    internal static Phase1ChangeImpactDashboard ParsePhase1ChangeImpactResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        InitiativeEntryRecord expectedInitiative,
        ChangeImpactChangeReference expectedChange)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "phase", "product", "initiative", "change", "sources", "changeScope",
                "outputs", "coverage", "owners", "governance", "freshness", "evidenceCues", "observedAt",
                "sourceBoundary", "privacyBoundary", "limitations", "authorityBoundary", "snapshotDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) || schema != 1 ||
            ParseRequiredEnum(result, "kind", "phase-1-change-impact-dashboard") != "phase-1-change-impact-dashboard" ||
            ParseRequiredEnum(
                result,
                "sourceBoundary",
                "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only") !=
            "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only" ||
            ParseRequiredEnum(
                result,
                "privacyBoundary",
                "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials") !=
            "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials" ||
            ParseRequiredEnum(
                result,
                "authorityBoundary",
                "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority") !=
            "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority")
        {
            throw InvalidResponse();
        }
        static long NonNegative(JsonElement element, string name, long maximum = 1_000_000)
        {
            if (!element.TryGetProperty(name, out var value) || !value.TryGetInt64(out var parsed) || parsed < 0 || parsed > maximum)
            {
                throw InvalidResponse();
            }
            return parsed;
        }
        static void ValidateReference(JsonElement reference)
        {
            if (reference.ValueKind != JsonValueKind.Object || !HasOnlyProperties(reference, "recordId", "revision", "digest"))
            {
                throw InvalidResponse();
            }
            ParseRequiredGuid(reference, "recordId");
            ParsePositiveLong(reference, "revision");
            ParseRequiredDigest(reference, "digest");
        }

        var phase = result.GetProperty("phase");
        if (phase.ValueKind != JsonValueKind.Object || !HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredEnum(phase, "id", "phase-1b-product") != "phase-1b-product" ||
            ParseRequiredPortableText(phase, "label") != "Phase 1B — Product P0–P4") throw InvalidResponse();
        var product = result.GetProperty("product");
        if (product.ValueKind != JsonValueKind.Object || !HasOnlyProperties(product, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(product, "recordType", "product") != "product") throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "recordId");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        if (productId != expectedProduct.Id || productRevision != expectedProduct.Revision || productDigest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }
        var initiative = result.GetProperty("initiative");
        if (initiative.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(initiative, "recordType", "recordId", "revision", "digest", "state") ||
            ParseRequiredEnum(initiative, "recordType", "initiative") != "initiative") throw InvalidResponse();
        var initiativeId = ParseRequiredGuid(initiative, "recordId");
        var initiativeRevision = ParsePositiveLong(initiative, "revision");
        var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "active", "blocked", "cancelled", "completed", "proposed");
        if (initiativeId != expectedInitiative.Id || initiativeRevision != expectedInitiative.Revision ||
            initiativeDigest != expectedInitiative.Digest || initiativeState != expectedInitiative.State ||
            expectedInitiative.ProductId != expectedProduct.Id) throw InvalidResponse();
        var change = ParseChangeImpactChangeReference(result.GetProperty("change"));
        if (change.RecordId != expectedChange.RecordId || change.Revision != expectedChange.Revision ||
            change.Digest != expectedChange.Digest || change.State != expectedChange.State ||
            !change.EffectEnvelope.SequenceEqual(expectedChange.EffectEnvelope, StringComparer.Ordinal)) throw InvalidResponse();

        var sources = result.GetProperty("sources");
        if (!HasRequiredAndAllowedProperties(
                sources,
                ["changeImpactSnapshotDigest", "readinessSnapshotDigest", "handoffSnapshotDigest"],
                ["readinessGate", "handoffPackage"])) throw InvalidResponse();
        ParseRequiredDigest(sources, "changeImpactSnapshotDigest");
        ParseRequiredDigest(sources, "readinessSnapshotDigest");
        ParseRequiredDigest(sources, "handoffSnapshotDigest");
        if (sources.TryGetProperty("readinessGate", out var readinessGate)) ValidateReference(readinessGate);
        if (sources.TryGetProperty("handoffPackage", out var handoffPackage)) ValidateReference(handoffPackage);

        var scope = result.GetProperty("changeScope");
        if (!HasOnlyProperties(
                scope,
                "workItemCount", "changedArtifactCount", "effectTargetCount", "affectedUnitCount", "decisionCount",
                "riskCount", "unresolvedTraceLinkCount", "staleTraceLinkCount", "invalidTraceLinkCount", "traceAnalysisTruncated"))
        {
            throw InvalidResponse();
        }
        NonNegative(scope, "workItemCount");
        var changedArtifactCount = NonNegative(scope, "changedArtifactCount");
        var effectTargetCount = NonNegative(scope, "effectTargetCount");
        var affectedUnitCount = NonNegative(scope, "affectedUnitCount");
        NonNegative(scope, "decisionCount");
        NonNegative(scope, "riskCount");
        var unresolvedTraceLinkCount = NonNegative(scope, "unresolvedTraceLinkCount");
        var staleTraceLinkCount = NonNegative(scope, "staleTraceLinkCount");
        var invalidTraceLinkCount = NonNegative(scope, "invalidTraceLinkCount");
        var traceAnalysisTruncated = ParseRequiredBoolean(scope, "traceAnalysisTruncated");

        var outputArray = result.GetProperty("outputs");
        if (outputArray.ValueKind != JsonValueKind.Array || outputArray.GetArrayLength() != Phase1ImpactOutputRecordKinds.Length)
        {
            throw InvalidResponse();
        }
        var parsedOutputs = new List<Phase1ChangeImpactOutput>(Phase1ImpactOutputRecordKinds.Length);
        var index = 0;
        foreach (var output in outputArray.EnumerateArray())
        {
            var expectedKind = Phase1ImpactOutputRecordKinds[index++];
            if (output.ValueKind != JsonValueKind.Object || !HasOnlyProperties(output, "outputKind", "recordKind", "readiness", "impact", "handoff") ||
                ParseRequiredPortableText(output, "outputKind") != expectedKind.OutputKind ||
                ParseRequiredPortableText(output, "recordKind") != expectedKind.RecordKind) throw InvalidResponse();
            var readiness = output.GetProperty("readiness");
            if (!HasOnlyProperties(readiness, "applicability", "evaluationState", "freshness", "subjectCount")) throw InvalidResponse();
            var applicability = ParseRequiredEnum(readiness, "applicability", "applicable", "not-applicable-candidate", "unresolved", "not-assessed");
            var evaluationState = ParseRequiredEnum(
                readiness,
                "evaluationState",
                "blocked", "conditionally-satisfied", "failed", "incomplete", "not-applicable-candidate", "not-assessed", "satisfied");
            var readinessFreshness = ParseRequiredEnum(readiness, "freshness", "current", "stale", "unknown");
            var subjectCount = NonNegative(readiness, "subjectCount", 512);
            if (applicability == "not-assessed" &&
                (evaluationState != "not-assessed" || readinessFreshness != "unknown" || subjectCount != 0)) throw InvalidResponse();

            var impact = output.GetProperty("impact");
            if (!HasOnlyProperties(
                    impact,
                    "state", "exactMatchedSubjectCount", "staleSubjectBindingCount", "traceReferenceCount",
                    "validTraceCount", "unresolvedTraceCount", "staleTraceCount", "invalidTraceCount",
                    "upstreamTraceCount", "downstreamTraceCount", "revalidationState", "coverageBoundary")) throw InvalidResponse();
            var exactMatches = NonNegative(impact, "exactMatchedSubjectCount", 512);
            var staleBindings = NonNegative(impact, "staleSubjectBindingCount", 512);
            var traceCount = NonNegative(impact, "traceReferenceCount", 512);
            var validTraces = NonNegative(impact, "validTraceCount", 512);
            var unresolvedTraces = NonNegative(impact, "unresolvedTraceCount", 512);
            var staleTraces = NonNegative(impact, "staleTraceCount", 512);
            var invalidTraces = NonNegative(impact, "invalidTraceCount", 512);
            var upstreamTraces = NonNegative(impact, "upstreamTraceCount", 512);
            var downstreamTraces = NonNegative(impact, "downstreamTraceCount", 512);
            var expectedImpactState = staleBindings + unresolvedTraces + staleTraces + invalidTraces > 0
                ? "attention-required"
                : exactMatches > 0 ? "current-trace-observed" : "not-established";
            var impactState = ParseRequiredEnum(impact, "state", "current-trace-observed", "attention-required", "not-established");
            if (exactMatches > subjectCount || traceCount != validTraces + unresolvedTraces + staleTraces + invalidTraces ||
                traceCount != upstreamTraces + downstreamTraces || impactState != expectedImpactState ||
                ParseRequiredEnum(impact, "revalidationState", "not-established") != "not-established" ||
                ParseRequiredEnum(
                    impact,
                    "coverageBoundary",
                    "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact") !=
                "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact") throw InvalidResponse();

            var handoff = output.GetProperty("handoff");
            if (!HasOnlyProperties(handoff, "disposition", "freshness", "subjectCount")) throw InvalidResponse();
            var handoffDisposition = ParseRequiredEnum(
                handoff,
                "disposition",
                "included", "omitted-not-applicable", "reference-only", "unresolved", "not-established");
            var handoffFreshness = ParseRequiredEnum(handoff, "freshness", "current", "stale", "unknown");
            var handoffSubjectCount = NonNegative(handoff, "subjectCount", 512);
            if (handoffDisposition == "not-established" && (handoffFreshness != "unknown" || handoffSubjectCount != 0))
            {
                throw InvalidResponse();
            }
            parsedOutputs.Add(new Phase1ChangeImpactOutput(
                expectedKind.OutputKind,
                expectedKind.RecordKind,
                applicability,
                evaluationState,
                readinessFreshness,
                subjectCount,
                impactState,
                exactMatches,
                traceCount,
                handoffDisposition,
                handoffFreshness,
                "not-established"));
        }

        var coverage = result.GetProperty("coverage");
        if (!HasOnlyProperties(
                coverage,
                "state", "outputCount", "applicableOutputCount", "currentTraceObservedOutputCount",
                "attentionRequiredOutputCount", "impactNotEstablishedOutputCount", "revalidationNotEstablishedOutputCount",
                "basis", "coverageBoundary")) throw InvalidResponse();
        var currentCount = parsedOutputs.Count(item => item.ImpactState == "current-trace-observed");
        var attentionCount = parsedOutputs.Count(item => item.ImpactState == "attention-required");
        var unknownCount = parsedOutputs.Count(item => item.ImpactState == "not-established");
        var applicableCount = parsedOutputs.Count(item => item.ReadinessApplicability == "applicable");
        if (ParseRequiredEnum(coverage, "state", "bounded-not-complete") != "bounded-not-complete" ||
            NonNegative(coverage, "outputCount", 25) != 25 || NonNegative(coverage, "applicableOutputCount", 25) != applicableCount ||
            NonNegative(coverage, "currentTraceObservedOutputCount", 25) != currentCount ||
            NonNegative(coverage, "attentionRequiredOutputCount", 25) != attentionCount ||
            NonNegative(coverage, "impactNotEstablishedOutputCount", 25) != unknownCount ||
            NonNegative(coverage, "revalidationNotEstablishedOutputCount", 25) != 25 ||
            ParseRequiredEnum(
                coverage,
                "basis",
                "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results") !=
            "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results" ||
            ParseRequiredEnum(
                coverage,
                "coverageBoundary",
                "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact") !=
            "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact") throw InvalidResponse();

        var owners = result.GetProperty("owners");
        if (!HasOnlyProperties(owners, "state", "boundOutputOwnerCount", "basis") ||
            ParseRequiredEnum(owners, "state", "unbound") != "unbound" || NonNegative(owners, "boundOutputOwnerCount", 0) != 0 ||
            ParseRequiredEnum(owners, "basis", "no-governed-phase-output-owner-assignment-is-bound") !=
            "no-governed-phase-output-owner-assignment-is-bound") throw InvalidResponse();
        var governance = result.GetProperty("governance");
        if (!HasOnlyProperties(
                governance,
                "changeApproval", "riskAcceptanceAuthority", "revalidationAuthority", "productOwnerAcceptance", "effectAuthority"))
        {
            throw InvalidResponse();
        }
        foreach (var field in new[] { "changeApproval", "riskAcceptanceAuthority", "revalidationAuthority", "productOwnerAcceptance", "effectAuthority" })
        {
            if (ParseRequiredEnum(governance, field, "not-established") != "not-established") throw InvalidResponse();
        }

        var freshness = result.GetProperty("freshness");
        if (!HasOnlyProperties(
                freshness,
                "state", "changeImpactEvaluatedAt", "readinessObservedAt", "handoffObservedAt", "staleBindingCount",
                "staleSourceReferenceCount", "traceAttentionLinkCount", "traceAnalysisTruncated", "basis")) throw InvalidResponse();
        var freshnessState = ParseRequiredEnum(freshness, "state", "current", "attention-required");
        var changeImpactEvaluatedAt = ParseRequiredTimestamp(freshness, "changeImpactEvaluatedAt");
        var readinessObservedAt = ParseRequiredTimestamp(freshness, "readinessObservedAt");
        var handoffObservedAt = ParseRequiredTimestamp(freshness, "handoffObservedAt");
        var staleBindingCount = NonNegative(freshness, "staleBindingCount");
        var staleSourceCount = NonNegative(freshness, "staleSourceReferenceCount");
        var traceAttentionCount = NonNegative(freshness, "traceAttentionLinkCount");
        var freshnessTruncated = ParseRequiredBoolean(freshness, "traceAnalysisTruncated");
        var expectedFreshnessAttention = staleBindingCount > 0 || staleSourceCount > 0 || traceAttentionCount > 0 ||
            freshnessTruncated || attentionCount > 0;
        if (traceAttentionCount != unresolvedTraceLinkCount + staleTraceLinkCount + invalidTraceLinkCount ||
            freshnessTruncated != traceAnalysisTruncated || (freshnessState == "attention-required") != expectedFreshnessAttention ||
            ParseRequiredEnum(
                freshness,
                "basis",
                "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness") !=
            "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness") throw InvalidResponse();
        var cues = result.GetProperty("evidenceCues");
        if (!HasOnlyProperties(cues, "freshness", "confidence") ||
            ParseRequiredEnum(cues, "freshness", "current", "potentially-stale") !=
            (expectedFreshnessAttention ? "potentially-stale" : "current")) throw InvalidResponse();
        var confidence = cues.GetProperty("confidence");
        if (!HasOnlyProperties(confidence, "state", "basis") ||
            ParseRequiredEnum(confidence, "state", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(
                confidence,
                "basis",
                "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness") !=
            "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness") throw InvalidResponse();

        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        if (changeImpactEvaluatedAt > observedAt || readinessObservedAt > observedAt || handoffObservedAt > observedAt)
        {
            throw InvalidResponse();
        }
        var limitationsElement = result.GetProperty("limitations");
        if (limitationsElement.ValueKind != JsonValueKind.Array || limitationsElement.GetArrayLength() is < 1 or > 8)
        {
            throw InvalidResponse();
        }
        var limitations = limitationsElement.EnumerateArray().Select(value =>
        {
            if (value.ValueKind != JsonValueKind.String || !ValidPortableText(value.GetString(), minimum: 4, maximum: 1_000))
            {
                throw InvalidResponse();
            }
            return value.GetString()!;
        }).ToArray();
        var snapshotDigest = ParseRequiredDigest(result, "snapshotDigest");
        var digestBody = JsonSerializer.SerializeToElement(
            result.EnumerateObject()
                .Where(property => property.Name != "snapshotDigest")
                .ToDictionary(property => property.Name, property => property.Value.Clone(), StringComparer.Ordinal));
        if (snapshotDigest != CanonicalDigest(digestBody)) throw InvalidResponse();
        return new Phase1ChangeImpactDashboard(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            change,
            changedArtifactCount,
            effectTargetCount,
            affectedUnitCount,
            Array.AsReadOnly(parsedOutputs.ToArray()),
            currentCount,
            attentionCount,
            unknownCount,
            freshnessState,
            traceAttentionCount,
            staleBindingCount,
            observedAt,
            Array.AsReadOnly(limitations),
            snapshotDigest);
    }

    private static PhaseDashboardPanel ParsePhaseDashboardPanel(JsonElement panel, string expectedId)
    {
        if (!PhaseDashboardPanelCatalog.TryGetValue(expectedId, out var definition) ||
            panel.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(panel, "id", "role", "title", "applicability", "state") ||
            ParseRequiredPortableText(panel, "id") != expectedId ||
            ParseRequiredPortableText(panel, "role") != definition.Role ||
            ParseRequiredPortableText(panel, "title") != definition.Title)
        {
            throw InvalidResponse();
        }

        var applicability = panel.GetProperty("applicability");
        if (!HasRequiredAndAllowedProperties(applicability, ["status", "basis"], ["decision"]))
        {
            throw InvalidResponse();
        }
        var status = ParseRequiredEnum(applicability, "status", "applicable", "not-applicable", "unknown");
        var basis = ParseRequiredEnum(applicability, "basis", "phase-contract", "governed-decision", "not-evaluated");
        var decision = applicability.TryGetProperty("decision", out var decisionElement)
            ? ParsePhaseDashboardDecision(decisionElement)
            : null;
        if ((basis == "phase-contract" && (status != "applicable" || decision is not null)) ||
            (basis == "not-evaluated" && (status != "unknown" || decision is not null)) ||
            (basis == "governed-decision" && (status == "unknown" || decision is null)))
        {
            throw InvalidResponse();
        }

        var state = ParseRequiredEnum(panel, "state", "active", "not-applicable", "attention-required");
        var expectedState = status switch
        {
            "applicable" => "active",
            "not-applicable" => "not-applicable",
            _ => "attention-required",
        };
        if (state != expectedState) throw InvalidResponse();
        return new PhaseDashboardPanel(
            expectedId,
            definition.Role,
            definition.Title,
            new PhaseDashboardApplicability(status, basis, decision),
            state);
    }

    private static PhaseDashboardDecision ParsePhaseDashboardDecision(JsonElement decision)
    {
        if (decision.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(decision, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(decision, "recordType", "decision") != "decision")
        {
            throw InvalidResponse();
        }
        return new PhaseDashboardDecision(
            ParseRequiredGuid(decision, "recordId"),
            ParsePositiveLong(decision, "revision"),
            ParseRequiredDigest(decision, "digest"));
    }

    internal static ChangeImpactChangeCatalog ParseChangeImpactChangeCatalogResponse(
        JsonElement envelope,
        ProductBinding expectedProduct)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "product", "items", "total", "omitted", "observedAt",
                "sourceBoundary", "limitations", "authorityBoundary", "snapshotDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) ||
            schema != 1 || ParseRequiredEnum(result, "kind", "change-impact-change-catalog") !=
                "change-impact-change-catalog" ||
            ParseRequiredEnum(result, "sourceBoundary", "current-governed-change-metadata-only") !=
                "current-governed-change-metadata-only" ||
            ParseRequiredEnum(result, "authorityBoundary", ChangeCatalogAuthorityBoundary) !=
                ChangeCatalogAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var product = ParseChangeImpactExactReference(result.GetProperty("product"), "product");
        if (product.RecordId != expectedProduct.Id || product.Revision != expectedProduct.Revision ||
            product.Digest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }
        var itemsElement = result.GetProperty("items");
        if (itemsElement.ValueKind != JsonValueKind.Array || itemsElement.GetArrayLength() > 256) throw InvalidResponse();
        var items = itemsElement.EnumerateArray().Select(ParseChangeImpactChangeReference).ToArray();
        if (items.Select(item => item.RecordId).Distinct().Count() != items.Length ||
            items.Zip(items.Skip(1)).Any(pair =>
                StringComparer.Ordinal.Compare(pair.First.RecordId.ToString("D"), pair.Second.RecordId.ToString("D")) >= 0))
        {
            throw InvalidResponse();
        }
        var total = ParseBoundedNonNegativeLong(result, "total", 1_000_000);
        var omitted = ParseBoundedNonNegativeLong(result, "omitted", 1_000_000);
        if (items.LongLength + omitted != total) throw InvalidResponse();
        var limitations = ParseChangeImpactLimitations(result.GetProperty("limitations"));
        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        var snapshotDigest = ParseRequiredDigest(result, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(result, "snapshotDigest"))) throw InvalidResponse();
        return new ChangeImpactChangeCatalog(
            product.RecordId,
            product.Revision,
            product.Digest,
            Array.AsReadOnly(items),
            total,
            omitted,
            observedAt,
            limitations,
            snapshotDigest);
    }

    internal static ChangeImpactDashboard ParseChangeImpactDashboardResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        ChangeImpactChangeReference expectedChange)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "product", "change", "workItems", "changedArtifacts", "effectTargets",
                "affectedUnits", "governance", "freshness", "evidenceCues", "limits", "observedAt", "sourceBoundary", "limitations",
                "authorityBoundary", "snapshotDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) ||
            schema != 1 || ParseRequiredEnum(result, "kind", "change-impact-dashboard") != "change-impact-dashboard" ||
            ParseRequiredEnum(result, "sourceBoundary", "current-governed-records-and-bounded-trace-analysis") !=
                "current-governed-records-and-bounded-trace-analysis" ||
            ParseRequiredEnum(result, "authorityBoundary", ChangeDashboardAuthorityBoundary) !=
                ChangeDashboardAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var product = ParseChangeImpactExactReference(result.GetProperty("product"), "product");
        if (product.RecordId != expectedProduct.Id || product.Revision != expectedProduct.Revision ||
            product.Digest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }
        var change = ParseChangeImpactChangeReference(result.GetProperty("change"));
        if (change.RecordId != expectedChange.RecordId || change.Revision != expectedChange.Revision ||
            change.Digest != expectedChange.Digest || change.State != expectedChange.State ||
            !change.EffectEnvelope.SequenceEqual(expectedChange.EffectEnvelope, StringComparer.Ordinal))
        {
            throw InvalidResponse();
        }

        var workItems = ParseChangeImpactArray(result.GetProperty("workItems"), 256, row =>
        {
            if (!HasOnlyProperties(row, "record", "state")) throw InvalidResponse();
            return new ChangeImpactWorkItem(
                ParseChangeImpactExactReference(row.GetProperty("record"), "work-item"),
                ParseRequiredEnum(row, "state", [.. ChangeImpactWorkItemStates]));
        });
        ChangeImpactArtifact ParseArtifact(JsonElement row)
        {
            if (!HasOnlyProperties(row, "sourceWorkItem", "locator")) throw InvalidResponse();
            return new ChangeImpactArtifact(
                ParseChangeImpactExactReference(row.GetProperty("sourceWorkItem"), "work-item"),
                ParseChangeImpactLocator(row.GetProperty("locator")));
        }
        var changedArtifacts = ParseChangeImpactArray(result.GetProperty("changedArtifacts"), 512, ParseArtifact);
        var effectTargets = ParseChangeImpactArray(result.GetProperty("effectTargets"), 512, ParseArtifact);
        var affectedUnits = ParseChangeImpactArray(
            result.GetProperty("affectedUnits"),
            512,
            ParseChangeImpactAffectedUnit);

        var governance = result.GetProperty("governance");
        if (!HasOnlyProperties(governance, "approval", "decisions", "risks", "authorityBoundary"))
        {
            throw InvalidResponse();
        }
        var approval = governance.GetProperty("approval");
        if (!HasOnlyProperties(approval, "state", "basis") ||
            ParseRequiredEnum(approval, "state", "not-established") != "not-established" ||
            ParseRequiredEnum(approval, "basis", "current-contract-has-no-change-approval-record") !=
                "current-contract-has-no-change-approval-record" ||
            ParseRequiredEnum(
                governance,
                "authorityBoundary",
                "decisions-and-risk-acceptance-do-not-approve-the-change") !=
                "decisions-and-risk-acceptance-do-not-approve-the-change")
        {
            throw InvalidResponse();
        }
        var decisions = ParseChangeImpactArray(governance.GetProperty("decisions"), 256, row =>
        {
            if (!HasOnlyProperties(row, "record", "state", "outcome")) throw InvalidResponse();
            var state = ParseRequiredEnum(row, "state", "open", "decided", "deferred", "superseded");
            var outcome = ParseRequiredEnum(row, "outcome", "human-selected", "not-selected");
            if ((state == "decided") != (outcome == "human-selected")) throw InvalidResponse();
            return new ChangeImpactDecision(
                ParseChangeImpactExactReference(row.GetProperty("record"), "decision"),
                state,
                outcome);
        });
        var risks = ParseChangeImpactArray(governance.GetProperty("risks"), 256, row =>
        {
            if (!HasOnlyProperties(row, "record", "state", "likelihood", "impact", "acceptance"))
            {
                throw InvalidResponse();
            }
            var state = ParseRequiredEnum(row, "state", "open", "treated", "accepted", "closed");
            var acceptance = ParseRequiredEnum(row, "acceptance", "human-accepted", "not-accepted");
            if ((state == "accepted") != (acceptance == "human-accepted")) throw InvalidResponse();
            return new ChangeImpactRisk(
                ParseChangeImpactExactReference(row.GetProperty("record"), "risk"),
                state,
                ParseRequiredEnum(row, "likelihood", "rare", "unlikely", "possible", "likely", "almost-certain", "unknown"),
                ParseRequiredEnum(row, "impact", "negligible", "minor", "moderate", "major", "critical", "unknown"),
                acceptance);
        });

        var freshnessElement = result.GetProperty("freshness");
        if (!HasOnlyProperties(
                freshnessElement,
                "state", "evaluatedAt", "unresolvedTraceLinks", "invalidTraceLinks", "staleTraceLinks",
                "staleGovernanceReferences", "traceAnalysisTruncated", "coverageBoundary") ||
            ParseRequiredEnum(
                freshnessElement,
                "coverageBoundary",
                "absence-of-a-trace-link-does-not-prove-absence-of-impact") !=
                "absence-of-a-trace-link-does-not-prove-absence-of-impact")
        {
            throw InvalidResponse();
        }
        var freshness = new ChangeImpactFreshness(
            ParseRequiredEnum(freshnessElement, "state", "current", "attention-required"),
            ParseRequiredTimestamp(freshnessElement, "evaluatedAt"),
            ParseBoundedNonNegativeLong(freshnessElement, "unresolvedTraceLinks", 1_000_000),
            ParseBoundedNonNegativeLong(freshnessElement, "invalidTraceLinks", 1_000_000),
            ParseBoundedNonNegativeLong(freshnessElement, "staleTraceLinks", 1_000_000),
            ParseBoundedNonNegativeLong(freshnessElement, "staleGovernanceReferences", 1_000_000),
            ParseRequiredBoolean(freshnessElement, "traceAnalysisTruncated"));

        var limitsElement = result.GetProperty("limits");
        if (!HasOnlyProperties(
                limitsElement,
                "workItems", "changedArtifacts", "effectTargets", "affectedUnits", "decisions", "risks", "truncated"))
        {
            throw InvalidResponse();
        }
        var limits = new ChangeImpactLimits(
            ParseChangeImpactLimit(limitsElement.GetProperty("workItems")),
            ParseChangeImpactLimit(limitsElement.GetProperty("changedArtifacts")),
            ParseChangeImpactLimit(limitsElement.GetProperty("effectTargets")),
            ParseChangeImpactLimit(limitsElement.GetProperty("affectedUnits")),
            ParseChangeImpactLimit(limitsElement.GetProperty("decisions")),
            ParseChangeImpactLimit(limitsElement.GetProperty("risks")),
            ParseRequiredBoolean(limitsElement, "truncated"));
        var categories = new (long Count, ChangeImpactLimit Limit)[]
        {
            (workItems.LongLength, limits.WorkItems),
            (changedArtifacts.LongLength, limits.ChangedArtifacts),
            (effectTargets.LongLength, limits.EffectTargets),
            (affectedUnits.LongLength, limits.AffectedUnits),
            (decisions.LongLength, limits.Decisions),
            (risks.LongLength, limits.Risks),
        };
        if (categories.Any(category => category.Count != category.Limit.Shown)) throw InvalidResponse();
        var truncated = freshness.TraceAnalysisTruncated || categories.Any(category => category.Limit.Omitted > 0);
        var attentionRequired = truncated || freshness.UnresolvedTraceLinks > 0 || freshness.InvalidTraceLinks > 0 ||
            freshness.StaleTraceLinks > 0 || freshness.StaleGovernanceReferences > 0;
        var evidenceFreshness = freshness.StaleTraceLinks > 0 || freshness.StaleGovernanceReferences > 0
            ? "stale"
            : freshness.UnresolvedTraceLinks > 0 || freshness.InvalidTraceLinks > 0 || truncated
                ? "potentially-stale"
                : "current";
        var evidenceCues = ParseDashboardEvidenceCues(result.GetProperty("evidenceCues"), evidenceFreshness);
        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        if (limits.Truncated != truncated || (freshness.State == "attention-required") != attentionRequired ||
            freshness.EvaluatedAt > observedAt)
        {
            throw InvalidResponse();
        }
        EnsureUniqueChangeImpactRows(workItems, changedArtifacts, effectTargets, affectedUnits, decisions, risks);
        var limitations = ParseChangeImpactLimitations(result.GetProperty("limitations"));
        var snapshotDigest = ParseRequiredDigest(result, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(result, "snapshotDigest"))) throw InvalidResponse();
        return new ChangeImpactDashboard(
            product.RecordId,
            product.Revision,
            product.Digest,
            change,
            Array.AsReadOnly(workItems),
            Array.AsReadOnly(changedArtifacts),
            Array.AsReadOnly(effectTargets),
            Array.AsReadOnly(affectedUnits),
            Array.AsReadOnly(decisions),
            Array.AsReadOnly(risks),
            freshness,
            evidenceCues,
            limits,
            observedAt,
            "current-governed-records-and-bounded-trace-analysis",
            limitations,
            snapshotDigest);
    }

    private static T[] ParseChangeImpactArray<T>(JsonElement value, int maximum, Func<JsonElement, T> parse)
    {
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() > maximum) throw InvalidResponse();
        return value.EnumerateArray().Select(parse).ToArray();
    }

    private static ChangeImpactExactReference ParseChangeImpactExactReference(
        JsonElement reference,
        string expectedType)
    {
        if (!HasOnlyProperties(reference, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(reference, "recordType", expectedType) != expectedType)
        {
            throw InvalidResponse();
        }
        return new ChangeImpactExactReference(
            expectedType,
            ParseRequiredGuid(reference, "recordId"),
            ParsePositiveLong(reference, "revision"),
            ParseRequiredDigest(reference, "digest"));
    }

    private static ChangeImpactChangeReference ParseChangeImpactChangeReference(JsonElement change)
    {
        if (!HasOnlyProperties(change, "recordType", "recordId", "revision", "digest", "state", "effectEnvelope") ||
            ParseRequiredEnum(change, "recordType", "change") != "change")
        {
            throw InvalidResponse();
        }
        var effectsElement = change.GetProperty("effectEnvelope");
        if (effectsElement.ValueKind != JsonValueKind.Array ||
            effectsElement.GetArrayLength() is < 1 or > 5)
        {
            throw InvalidResponse();
        }
        var effects = effectsElement.EnumerateArray().Select(effect =>
        {
            if (effect.ValueKind != JsonValueKind.String || effect.GetString() is not { } value ||
                !ChangeImpactEffects.Contains(value))
            {
                throw InvalidResponse();
            }
            return value;
        }).ToArray();
        if (effects.Distinct(StringComparer.Ordinal).Count() != effects.Length) throw InvalidResponse();
        return new ChangeImpactChangeReference(
            ParseRequiredGuid(change, "recordId"),
            ParsePositiveLong(change, "revision"),
            ParseRequiredDigest(change, "digest"),
            ParseRequiredEnum(change, "state", [.. ChangeImpactStates]),
            Array.AsReadOnly(effects));
    }

    private static ChangeImpactLocator ParseChangeImpactLocator(JsonElement locator)
    {
        var kind = ParseRequiredPortableText(locator, "kind");
        if (kind == "workspace-relative")
        {
            if (!HasOnlyProperties(locator, "kind", "path")) throw InvalidResponse();
            return new ChangeImpactLocator(kind, ParseWorkspaceRelativeScope(locator.GetProperty("path")));
        }
        if (kind == "logical")
        {
            if (!HasOnlyProperties(locator, "kind", "value")) throw InvalidResponse();
            var value = ParseRequiredPortableText(locator, "value");
            if (!ToolPattern().IsMatch(value)) throw InvalidResponse();
            return new ChangeImpactLocator(kind, value);
        }
        if (kind != "external-uri" || !HasOnlyProperties(locator, "kind", "uri")) throw InvalidResponse();
        var raw = ParseRequiredPortableText(locator, "uri");
        if (raw.Length > 8_192 || !Uri.TryCreate(raw, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("http" or "https" or "urn") || !string.IsNullOrEmpty(uri.UserInfo) ||
            (uri.Scheme is "http" or "https" && string.IsNullOrWhiteSpace(uri.Host)))
        {
            throw InvalidResponse();
        }
        var queryKeys = Uri.UnescapeDataString(uri.Query.TrimStart('?'))
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(value => value.Split('=', 2)[0]);
        var fragment = Uri.UnescapeDataString(uri.Fragment.TrimStart('#'));
        if (queryKeys.Any(key => SensitiveUriComponentPattern().IsMatch(key)) ||
            (!string.IsNullOrEmpty(fragment) && SensitiveUriComponentPattern().IsMatch(fragment)))
        {
            throw InvalidResponse();
        }
        return new ChangeImpactLocator(kind, raw);
    }

    private static ChangeImpactTraceEndpoint ParseChangeImpactTraceEndpoint(JsonElement endpoint)
    {
        if (!HasRequiredAndAllowedProperties(endpoint, ["recordType", "recordId"], ["revision", "digest"]))
        {
            throw InvalidResponse();
        }
        var recordType = ParseRequiredEnum(endpoint, "recordType", [.. ChangeImpactRecordTypes]);
        if (recordType == "external")
        {
            if (endpoint.TryGetProperty("revision", out _) || endpoint.TryGetProperty("digest", out _) ||
                !endpoint.TryGetProperty("recordId", out var recordIdElement) ||
                recordIdElement.ValueKind != JsonValueKind.String ||
                !ValidPortableText(recordIdElement.GetString(), minimum: 1, maximum: 500))
            {
                throw InvalidResponse();
            }
            return new ChangeImpactTraceEndpoint(recordType, recordIdElement.GetString()!, null, null);
        }
        if (!endpoint.TryGetProperty("revision", out _) || !endpoint.TryGetProperty("digest", out _))
        {
            throw InvalidResponse();
        }
        return new ChangeImpactTraceEndpoint(
            recordType,
            ParseRequiredGuid(endpoint, "recordId").ToString("D"),
            ParsePositiveLong(endpoint, "revision"),
            ParseRequiredDigest(endpoint, "digest"));
    }

    private static ChangeImpactAffectedUnit ParseChangeImpactAffectedUnit(JsonElement unit)
    {
        if (!HasOnlyProperties(unit, "direction", "relationship", "endpoint", "trace")) throw InvalidResponse();
        var trace = unit.GetProperty("trace");
        if (!HasOnlyProperties(trace, "recordId", "revision", "assessmentDigest", "assessedState"))
        {
            throw InvalidResponse();
        }
        return new ChangeImpactAffectedUnit(
            ParseRequiredEnum(unit, "direction", "upstream", "downstream"),
            ParseRequiredEnum(unit, "relationship", [.. ChangeImpactRelationships]),
            ParseChangeImpactTraceEndpoint(unit.GetProperty("endpoint")),
            new ChangeImpactTraceAssessment(
                ParseRequiredGuid(trace, "recordId"),
                ParsePositiveLong(trace, "revision"),
                ParseRequiredDigest(trace, "assessmentDigest"),
                ParseRequiredEnum(trace, "assessedState", "valid", "unresolved", "stale", "invalid")));
    }

    private static ChangeImpactLimit ParseChangeImpactLimit(JsonElement limit)
    {
        if (!HasOnlyProperties(limit, "shown", "total", "omitted")) throw InvalidResponse();
        var shown = ParseBoundedNonNegativeLong(limit, "shown", 1_000_000);
        var total = ParseBoundedNonNegativeLong(limit, "total", 1_000_000);
        var omitted = ParseBoundedNonNegativeLong(limit, "omitted", 1_000_000);
        if (shown + omitted != total) throw InvalidResponse();
        return new ChangeImpactLimit(shown, total, omitted);
    }

    private static IReadOnlyList<string> ParseChangeImpactLimitations(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() is < 1 or > 8) throw InvalidResponse();
        var limitations = value.EnumerateArray().Select(limitation =>
        {
            if (limitation.ValueKind != JsonValueKind.String ||
                !ValidPortableText(limitation.GetString(), minimum: 4, maximum: 1_000))
            {
                throw InvalidResponse();
            }
            return limitation.GetString()!;
        }).ToArray();
        return Array.AsReadOnly(limitations);
    }

    private static void EnsureUniqueChangeImpactRows(
        IReadOnlyCollection<ChangeImpactWorkItem> workItems,
        IReadOnlyCollection<ChangeImpactArtifact> changedArtifacts,
        IReadOnlyCollection<ChangeImpactArtifact> effectTargets,
        IReadOnlyCollection<ChangeImpactAffectedUnit> affectedUnits,
        IReadOnlyCollection<ChangeImpactDecision> decisions,
        IReadOnlyCollection<ChangeImpactRisk> risks)
    {
        static bool Unique(IEnumerable<string> values)
        {
            var rows = values.ToArray();
            return rows.Distinct(StringComparer.Ordinal).Count() == rows.Length;
        }
        static string ArtifactKey(ChangeImpactArtifact value) =>
            $"{value.SourceWorkItem.RecordId:D}:{value.Locator.Kind}:{value.Locator.Value}";
        if (!Unique(workItems.Select(row => row.Record.RecordId.ToString("D"))) ||
            !Unique(changedArtifacts.Select(ArtifactKey)) || !Unique(effectTargets.Select(ArtifactKey)) ||
            !Unique(affectedUnits.Select(row =>
                $"{row.Direction}:{row.Endpoint.RecordType}:{row.Endpoint.RecordId}:{row.Trace.RecordId:D}")) ||
            !Unique(decisions.Select(row => row.Record.RecordId.ToString("D"))) ||
            !Unique(risks.Select(row => row.Record.RecordId.ToString("D"))))
        {
            throw InvalidResponse();
        }
    }

    private static JsonElement WithoutProperty(JsonElement value, string propertyName) =>
        JsonSerializer.SerializeToElement(
            value.EnumerateObject()
                .Where(property => property.Name != propertyName)
                .ToDictionary(property => property.Name, property => property.Value.Clone(), StringComparer.Ordinal));

    internal static AgentModelDashboard ParseAgentModelDashboardResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        IReadOnlyList<AgentReadinessSnapshot> expectedCapabilities,
        AgentSelectionState expectedSelection)
    {
        return ParseAgentModelDashboard(ReadResult(envelope), expectedProduct, expectedCapabilities, expectedSelection);
    }

    private static AgentModelDashboard ParseAgentModelDashboard(
        JsonElement result,
        ProductBinding expectedProduct,
        IReadOnlyList<AgentReadinessSnapshot> expectedCapabilities,
        AgentSelectionState expectedSelection)
    {
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "product", "capabilities", "selection", "runs", "handoffs",
                "providerMetrics", "freshness", "evidenceCues", "limits", "observedAt", "sourceBoundary", "limitations",
                "authorityBoundary", "snapshotDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) ||
            schema != 1 || ParseRequiredEnum(result, "kind", "agent-model-dashboard") != "agent-model-dashboard" ||
            ParseRequiredEnum(
                result,
                "sourceBoundary",
                "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata") !=
                "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" ||
            ParseRequiredEnum(result, "authorityBoundary", AgentModelAuthorityBoundary) != AgentModelAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var product = ParseAgentModelReference(result.GetProperty("product"), "product");
        if (product.RecordId != expectedProduct.Id || product.Revision != expectedProduct.Revision ||
            product.Digest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }
        var capabilityElement = result.GetProperty("capabilities");
        if (capabilityElement.ValueKind != JsonValueKind.Array || capabilityElement.GetArrayLength() is < 1 or > 16 ||
            capabilityElement.GetArrayLength() != expectedCapabilities.Count ||
            expectedCapabilities.Select(value => $"{value.AdapterId}:{value.AgentId}")
                .Distinct(StringComparer.Ordinal).Count() != expectedCapabilities.Count)
        {
            throw InvalidResponse();
        }
        var expectedByKey = expectedCapabilities.ToDictionary(
            value => $"{value.AdapterId}:{value.AgentId}",
            StringComparer.Ordinal);
        var capabilities = capabilityElement.EnumerateArray().Select(row =>
        {
            var key = $"{ParseRequiredPortableText(row, "adapterId")}:{ParseRequiredPortableText(row, "agentId")}";
            return ParseAgentModelCapability(
                row,
                expectedByKey.TryGetValue(key, out var expected) ? expected : throw InvalidResponse());
        }).ToArray();
        var capabilityKeys = capabilities.Select(value => $"{value.AdapterId}:{value.AgentId}").ToArray();
        if (capabilityKeys.Distinct(StringComparer.Ordinal).Count() != capabilityKeys.Length ||
            capabilityKeys.Zip(capabilityKeys.Skip(1)).Any(pair =>
                StringComparer.Ordinal.Compare(pair.First, pair.Second) >= 0))
        {
            throw InvalidResponse();
        }
        var selection = ParseAgentModelSelection(result.GetProperty("selection"), expectedSelection, capabilities);
        var runElement = result.GetProperty("runs");
        var handoffElement = result.GetProperty("handoffs");
        if (runElement.ValueKind != JsonValueKind.Array || runElement.GetArrayLength() > 256 ||
            handoffElement.ValueKind != JsonValueKind.Array || handoffElement.GetArrayLength() > 256)
        {
            throw InvalidResponse();
        }
        var runs = runElement.EnumerateArray().Select(ParseAgentModelRun).ToArray();
        var handoffs = handoffElement.EnumerateArray().Select(ParseAgentModelHandoff).ToArray();
        if (runs.Select(value => value.RecordId).Distinct().Count() != runs.Length ||
            handoffs.Select(value => value.RecordId).Distinct().Count() != handoffs.Length ||
            runs.Where(value => value.Managed.RecordId.HasValue).Select(value => value.Managed.RecordId!.Value)
                .Distinct().Count() != runs.Count(value => value.Managed.RecordId.HasValue))
        {
            throw InvalidResponse();
        }
        ValidateAgentModelMetrics(result.GetProperty("providerMetrics"));
        var freshness = ParseAgentModelFreshness(result.GetProperty("freshness"));
        var limitsElement = result.GetProperty("limits");
        if (!HasOnlyProperties(limitsElement, "capabilities", "runs", "handoffs", "managedRuns", "truncated"))
        {
            throw InvalidResponse();
        }
        var capabilityLimit = ParseAgentModelLimit(limitsElement.GetProperty("capabilities"));
        var runLimit = ParseAgentModelLimit(limitsElement.GetProperty("runs"));
        var handoffLimit = ParseAgentModelLimit(limitsElement.GetProperty("handoffs"));
        var managedRunLimit = ParseAgentModelLimit(limitsElement.GetProperty("managedRuns"));
        var limitsTruncated = ParseRequiredBoolean(limitsElement, "truncated");
        if (capabilityLimit.Shown != capabilities.LongLength || runLimit.Shown != runs.LongLength ||
            handoffLimit.Shown != handoffs.LongLength ||
            managedRunLimit.Shown != runs.LongCount(value => value.Managed.Status == "observed"))
        {
            throw InvalidResponse();
        }
        var truncated = new[] { capabilityLimit, runLimit, handoffLimit, managedRunLimit }
            .Any(limit => limit.Omitted > 0);
        var selectionCapabilityState = selection.Status == "selected"
            ? selection.CapabilityState ?? throw InvalidResponse()
            : selection.Status;
        var attentionRequired = truncated || selectionCapabilityState is "stale" or "migration-required" or "invalid";
        var evidenceFreshness = selectionCapabilityState switch
        {
            "stale" => "stale",
            "invalid" => "unknown",
            "migration-required" => "potentially-stale",
            _ when truncated => "potentially-stale",
            _ => "current",
        };
        var evidenceCues = ParseDashboardEvidenceCues(result.GetProperty("evidenceCues"), evidenceFreshness);
        var selectedCapabilities = capabilities.Where(value => value.Selected).ToArray();
        if (freshness.SelectionCapabilityState != selectionCapabilityState || freshness.Truncated != truncated ||
            limitsTruncated != truncated || (freshness.State == "attention-required") != attentionRequired)
        {
            throw InvalidResponse();
        }
        if (selection.Status == "selected")
        {
            if (selectedCapabilities.Length != 1 || selectedCapabilities[0].AdapterId != selection.AdapterId ||
                selectedCapabilities[0].AgentId != selection.AgentId ||
                ((selectedCapabilities[0].CapabilityDigest == selection.CapabilityDigest) !=
                    (selection.CapabilityState == "current")))
            {
                throw InvalidResponse();
            }
        }
        else if (selectedCapabilities.Length != 0)
        {
            throw InvalidResponse();
        }
        if (runLimit.Omitted == 0 && handoffs.Any(handoff => runs.All(run => run.RecordId != handoff.FromRunId)))
        {
            throw InvalidResponse();
        }
        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        if (freshness.OldestCapabilityObservedAt > freshness.NewestCapabilityObservedAt ||
            freshness.NewestCapabilityObservedAt > observedAt)
        {
            throw InvalidResponse();
        }
        var limitations = ParseChangeImpactLimitations(result.GetProperty("limitations"));
        var snapshotDigest = ParseRequiredDigest(result, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(result, "snapshotDigest"))) throw InvalidResponse();
        return new AgentModelDashboard(
            product.RecordId,
            product.Revision,
            product.Digest,
            Array.AsReadOnly(capabilities),
            selection,
            Array.AsReadOnly(runs),
            Array.AsReadOnly(handoffs),
            freshness,
            evidenceCues,
            capabilityLimit,
            runLimit,
            handoffLimit,
            managedRunLimit,
            truncated,
            observedAt,
            "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
            limitations,
            snapshotDigest);
    }

    internal static Phase1AgentModelDashboard ParsePhase1AgentModelResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        InitiativeEntryRecord expectedInitiative,
        IReadOnlyList<AgentReadinessSnapshot> expectedCapabilities,
        AgentSelectionState expectedSelection)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                result,
                "schemaVersion", "kind", "phase", "product", "initiative", "source", "agentModel",
                "executionTruth", "freshness", "governance", "observedAt", "sourceBoundary", "privacyBoundary",
                "limitations", "authorityBoundary", "snapshotDigest") ||
            !result.TryGetProperty("schemaVersion", out var schemaVersion) || !schemaVersion.TryGetInt32(out var schema) ||
            schema != 1 || ParseRequiredEnum(result, "kind", "phase-1-agent-model-dashboard") !=
            "phase-1-agent-model-dashboard" ||
            ParseRequiredEnum(
                result,
                "sourceBoundary",
                "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only") !=
            "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only" ||
            ParseRequiredEnum(
                result,
                "privacyBoundary",
                "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths") !=
            "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths" ||
            ParseRequiredEnum(
                result,
                "authorityBoundary",
                "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority") !=
            "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority")
        {
            throw InvalidResponse();
        }
        var phase = result.GetProperty("phase");
        if (!HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredEnum(phase, "id", "phase-1b-product") != "phase-1b-product" ||
            ParseRequiredEnum(phase, "label", "Phase 1B — Product P0–P4") != "Phase 1B — Product P0–P4")
        {
            throw InvalidResponse();
        }
        var product = ParseAgentModelReference(result.GetProperty("product"), "product");
        if (product.RecordId != expectedProduct.Id || product.Revision != expectedProduct.Revision ||
            product.Digest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }
        var initiative = result.GetProperty("initiative");
        if (!HasOnlyProperties(initiative, "recordType", "recordId", "revision", "digest", "state") ||
            ParseRequiredEnum(initiative, "recordType", "initiative") != "initiative")
        {
            throw InvalidResponse();
        }
        var initiativeId = ParseRequiredGuid(initiative, "recordId");
        var initiativeRevision = ParsePositiveLong(initiative, "revision");
        var initiativeDigest = ParseRequiredDigest(initiative, "digest");
        var initiativeState = ParseRequiredEnum(initiative, "state", "active", "blocked", "cancelled", "completed", "proposed");
        if (initiativeId != expectedInitiative.Id || initiativeRevision != expectedInitiative.Revision ||
            initiativeDigest != expectedInitiative.Digest || initiativeState != expectedInitiative.State ||
            expectedInitiative.ProductId != expectedProduct.Id)
        {
            throw InvalidResponse();
        }
        var agentModelElement = result.GetProperty("agentModel");
        var agentModel = ParseAgentModelDashboard(
            agentModelElement,
            expectedProduct,
            expectedCapabilities,
            expectedSelection);
        if (agentModel.Runs.Any(run => run.InitiativeId != initiativeId)) throw InvalidResponse();
        var runIds = agentModel.Runs.Select(run => run.RecordId).ToHashSet();
        if (agentModel.Handoffs.Any(handoff => !runIds.Contains(handoff.FromRunId))) throw InvalidResponse();
        var source = result.GetProperty("source");
        if (!HasOnlyProperties(source, "agentModelSnapshotDigest", "scope") ||
            ParseRequiredDigest(source, "agentModelSnapshotDigest") != agentModel.SnapshotDigest ||
            ParseRequiredEnum(source, "scope", "exact-current-initiative") != "exact-current-initiative")
        {
            throw InvalidResponse();
        }

        var truth = result.GetProperty("executionTruth");
        if (!HasOnlyProperties(
                truth,
                "capabilities", "runs", "managedRuns", "handoffs", "providerMetrics",
                "liveProviderQuality", "semanticOutputQuality"))
        {
            throw InvalidResponse();
        }
        var capabilityElement = truth.GetProperty("capabilities");
        if (!HasOnlyProperties(capabilityElement, "shown", "total", "omitted", "detected", "unavailable", "selected"))
        {
            throw InvalidResponse();
        }
        var capabilityTruth = new Phase1AgentModelCapabilityTruth(
            ParseBoundedNonNegativeLong(capabilityElement, "shown", 1_000_000),
            ParseBoundedNonNegativeLong(capabilityElement, "total", 1_000_000),
            ParseBoundedNonNegativeLong(capabilityElement, "omitted", 1_000_000),
            ParseBoundedNonNegativeLong(capabilityElement, "detected", 1_000_000),
            ParseBoundedNonNegativeLong(capabilityElement, "unavailable", 1_000_000),
            ParseBoundedNonNegativeLong(capabilityElement, "selected", 1));
        var detected = agentModel.Capabilities.LongCount(capability => capability.Detected);
        if (capabilityTruth.Shown != agentModel.CapabilityLimit.Shown ||
            capabilityTruth.Total != agentModel.CapabilityLimit.Total ||
            capabilityTruth.Omitted != agentModel.CapabilityLimit.Omitted ||
            capabilityTruth.Detected != detected ||
            capabilityTruth.Unavailable != agentModel.Capabilities.Count - detected ||
            capabilityTruth.Selected != agentModel.Capabilities.LongCount(capability => capability.Selected) ||
            capabilityTruth.Shown + capabilityTruth.Omitted != capabilityTruth.Total)
        {
            throw InvalidResponse();
        }

        var runElement = truth.GetProperty("runs");
        if (!HasOnlyProperties(
                runElement,
                "shown", "total", "omitted", "terminal", "nonTerminal", "managedObserved", "resultBound",
                "actualEffectCount", "outcomes"))
        {
            throw InvalidResponse();
        }
        var outcomeElement = runElement.GetProperty("outcomes");
        if (!HasOnlyProperties(outcomeElement, "satisfied", "failed", "notAssessed", "indeterminate"))
        {
            throw InvalidResponse();
        }
        var outcomes = new Phase1AgentModelOutcomeTruth(
            ParseBoundedNonNegativeLong(outcomeElement, "satisfied", 1_000_000),
            ParseBoundedNonNegativeLong(outcomeElement, "failed", 1_000_000),
            ParseBoundedNonNegativeLong(outcomeElement, "notAssessed", 1_000_000),
            ParseBoundedNonNegativeLong(outcomeElement, "indeterminate", 1_000_000));
        var runTruth = new Phase1AgentModelRunTruth(
            ParseBoundedNonNegativeLong(runElement, "shown", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "total", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "omitted", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "terminal", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "nonTerminal", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "managedObserved", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "resultBound", 1_000_000),
            ParseBoundedNonNegativeLong(runElement, "actualEffectCount", 1_000_000),
            outcomes);
        var terminalStates = new HashSet<string>(new[] { "completed", "failed", "cancelled" }, StringComparer.Ordinal);
        var managed = agentModel.Runs.Select(run => run.Managed).Where(value => value.Status == "observed").ToArray();
        var bound = managed.Where(value => value.ResultStatus == "bound").ToArray();
        if (runTruth.Shown != agentModel.RunLimit.Shown || runTruth.Total != agentModel.RunLimit.Total ||
            runTruth.Omitted != agentModel.RunLimit.Omitted ||
            runTruth.Terminal != agentModel.Runs.LongCount(run => terminalStates.Contains(run.State)) ||
            runTruth.NonTerminal != agentModel.Runs.LongCount(run => !terminalStates.Contains(run.State)) ||
            runTruth.ManagedObserved != managed.LongLength || runTruth.ResultBound != bound.LongLength ||
            runTruth.ActualEffectCount != bound.Sum(value => value.ActualEffectCount ?? 0) ||
            outcomes.Satisfied != bound.LongCount(value => value.OutcomeStatus == "satisfied") ||
            outcomes.Failed != bound.LongCount(value => value.OutcomeStatus == "failed") ||
            outcomes.NotAssessed != bound.LongCount(value => value.OutcomeStatus == "not-assessed") ||
            outcomes.Indeterminate != bound.LongCount(value => value.OutcomeStatus == "indeterminate") ||
            runTruth.Shown + runTruth.Omitted != runTruth.Total)
        {
            throw InvalidResponse();
        }
        var managedRuns = ParseAgentModelLimit(truth.GetProperty("managedRuns"));
        if (managedRuns != agentModel.ManagedRunLimit) throw InvalidResponse();
        var handoffElement = truth.GetProperty("handoffs");
        if (!HasOnlyProperties(handoffElement, "shown", "total", "omitted", "pendingAcknowledgement", "acknowledged"))
        {
            throw InvalidResponse();
        }
        var handoffs = new Phase1AgentModelHandoffTruth(
            ParseBoundedNonNegativeLong(handoffElement, "shown", 1_000_000),
            ParseBoundedNonNegativeLong(handoffElement, "total", 1_000_000),
            ParseBoundedNonNegativeLong(handoffElement, "omitted", 1_000_000),
            ParseBoundedNonNegativeLong(handoffElement, "pendingAcknowledgement", 1_000_000),
            ParseBoundedNonNegativeLong(handoffElement, "acknowledged", 1_000_000));
        var acknowledged = agentModel.Handoffs.LongCount(handoff => handoff.State == "acknowledged");
        if (handoffs.Shown != agentModel.HandoffLimit.Shown || handoffs.Total != agentModel.HandoffLimit.Total ||
            handoffs.Omitted != agentModel.HandoffLimit.Omitted || handoffs.Acknowledged != acknowledged ||
            handoffs.PendingAcknowledgement != agentModel.Handoffs.Count - acknowledged ||
            handoffs.Shown + handoffs.Omitted != handoffs.Total)
        {
            throw InvalidResponse();
        }
        var metrics = truth.GetProperty("providerMetrics");
        if (!HasOnlyProperties(metrics, "usage", "cost") ||
            ParseRequiredEnum(metrics, "usage", "unavailable") != "unavailable" ||
            ParseRequiredEnum(metrics, "cost", "unavailable") != "unavailable" ||
            ParseRequiredEnum(truth, "liveProviderQuality", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(truth, "semanticOutputQuality", "not-assessed") != "not-assessed")
        {
            throw InvalidResponse();
        }

        var freshness = result.GetProperty("freshness");
        if (!HasOnlyProperties(
                freshness,
                "state", "selectionCapabilityState", "oldestCapabilityObservedAt", "newestCapabilityObservedAt",
                "agentModelObservedAt", "truncated", "basis"))
        {
            throw InvalidResponse();
        }
        var freshnessState = ParseRequiredEnum(freshness, "state", "current", "attention-required");
        var selectionCapabilityState = ParseRequiredEnum(
            freshness,
            "selectionCapabilityState",
            "current", "unselected", "stale", "migration-required", "invalid");
        if (freshnessState != agentModel.Freshness.State ||
            selectionCapabilityState != agentModel.Freshness.SelectionCapabilityState ||
            ParseRequiredTimestamp(freshness, "oldestCapabilityObservedAt") !=
            agentModel.Freshness.OldestCapabilityObservedAt ||
            ParseRequiredTimestamp(freshness, "newestCapabilityObservedAt") !=
            agentModel.Freshness.NewestCapabilityObservedAt ||
            ParseRequiredTimestamp(freshness, "agentModelObservedAt") != agentModel.ObservedAt ||
            ParseRequiredBoolean(freshness, "truncated") != agentModel.Truncated ||
            ParseRequiredEnum(
                freshness,
                "basis",
                "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage") !=
            "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage")
        {
            throw InvalidResponse();
        }
        var governance = result.GetProperty("governance");
        if (!HasOnlyProperties(
                governance,
                "providerAccountReadiness", "providerPreference", "automaticSelectionAuthority",
                "handoffAcknowledgementAuthority", "runLaunchAuthority", "effectAuthority",
                "phaseReadinessAuthority", "productOwnerAcceptance") ||
            ParseRequiredEnum(governance, "providerAccountReadiness", "not-established") != "not-established" ||
            ParseRequiredEnum(governance, "providerPreference", "not-established") != "not-established" ||
            ParseRequiredEnum(governance, "automaticSelectionAuthority", "not-granted") != "not-granted" ||
            ParseRequiredEnum(governance, "handoffAcknowledgementAuthority", "not-granted") != "not-granted" ||
            ParseRequiredEnum(governance, "runLaunchAuthority", "not-granted") != "not-granted" ||
            ParseRequiredEnum(governance, "effectAuthority", "not-granted") != "not-granted" ||
            ParseRequiredEnum(governance, "phaseReadinessAuthority", "not-established") != "not-established" ||
            ParseRequiredEnum(governance, "productOwnerAcceptance", "not-established") != "not-established")
        {
            throw InvalidResponse();
        }
        var observedAt = ParseRequiredTimestamp(result, "observedAt");
        if (observedAt < agentModel.ObservedAt) throw InvalidResponse();
        var limitations = ParseChangeImpactLimitations(result.GetProperty("limitations"));
        var snapshotDigest = ParseRequiredDigest(result, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(result, "snapshotDigest"))) throw InvalidResponse();
        return new Phase1AgentModelDashboard(
            product.RecordId,
            product.Revision,
            product.Digest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            agentModel,
            capabilityTruth,
            runTruth,
            managedRuns,
            handoffs,
            freshnessState,
            selectionCapabilityState,
            "not-assessed",
            "not-assessed",
            "not-established",
            observedAt,
            "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only",
            "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths",
            limitations,
            snapshotDigest);
    }

    private static DashboardEvidenceCues ParseDashboardEvidenceCues(JsonElement value, string expectedFreshness)
    {
        if (value.ValueKind != JsonValueKind.Object || !HasOnlyProperties(value, "freshness", "confidence"))
        {
            throw InvalidResponse();
        }
        var freshness = ParseRequiredEnum(value, "freshness", "current", "potentially-stale", "stale", "unknown");
        var confidence = value.GetProperty("confidence");
        if (freshness != expectedFreshness || confidence.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(confidence, "state", "basis") ||
            ParseRequiredEnum(confidence, "state", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(confidence, "basis", "no-governed-confidence-evaluation-is-bound") !=
                "no-governed-confidence-evaluation-is-bound")
        {
            throw InvalidResponse();
        }
        return new DashboardEvidenceCues(
            freshness,
            "not-assessed",
            "no-governed-confidence-evaluation-is-bound");
    }

    private static ChangeImpactExactReference ParseAgentModelReference(JsonElement reference, string expectedType)
    {
        if (reference.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(reference, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(reference, "recordType", expectedType) != expectedType)
        {
            throw InvalidResponse();
        }
        return new ChangeImpactExactReference(
            expectedType,
            ParseRequiredGuid(reference, "recordId"),
            ParsePositiveLong(reference, "revision"),
            ParseRequiredDigest(reference, "digest"));
    }

    private static AgentModelCapability ParseAgentModelCapability(
        JsonElement row,
        AgentReadinessSnapshot expected)
    {
        if (row.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                row,
                "adapterId", "adapterVersion", "agentId", "agentLabel", "runtimeVersion", "capabilityDigest",
                "detected", "executionInterface", "interfaceMaturity", "support", "modelCount", "limitations",
                "observedAt", "selected"))
        {
            throw InvalidResponse();
        }
        var runtimeElement = row.GetProperty("runtimeVersion");
        string? runtimeVersion = runtimeElement.ValueKind switch
        {
            JsonValueKind.Null => null,
            JsonValueKind.String when ValidPortableText(runtimeElement.GetString(), minimum: 1) => runtimeElement.GetString(),
            _ => throw InvalidResponse(),
        };
        var support = row.GetProperty("support");
        if (!HasOnlyProperties(support, "resume", "cancel", "checkpoints", "modelDiscovery", "toolSelection"))
        {
            throw InvalidResponse();
        }
        var limitationElement = row.GetProperty("limitations");
        if (!HasOnlyProperties(limitationElement, "values", "shown", "total", "omitted") ||
            limitationElement.GetProperty("values").ValueKind != JsonValueKind.Array ||
            limitationElement.GetProperty("values").GetArrayLength() > 64)
        {
            throw InvalidResponse();
        }
        var limitationValues = limitationElement.GetProperty("values").EnumerateArray().Select(value =>
        {
            if (value.ValueKind != JsonValueKind.String || !ValidPortableText(value.GetString(), minimum: 1))
            {
                throw InvalidResponse();
            }
            return value.GetString()!;
        }).ToArray();
        var limitationShown = ParseBoundedNonNegativeLong(limitationElement, "shown", 64);
        var limitationTotal = ParseBoundedNonNegativeLong(limitationElement, "total", 512);
        var limitationOmitted = ParseBoundedNonNegativeLong(limitationElement, "omitted", 512);
        if (limitationShown != limitationValues.LongLength || limitationShown + limitationOmitted != limitationTotal)
        {
            throw InvalidResponse();
        }
        var parsed = new AgentModelCapability(
            ParseRequiredPortableText(row, "adapterId"),
            ParseRequiredPortableText(row, "adapterVersion"),
            ParseRequiredPortableText(row, "agentId"),
            ParseRequiredPortableText(row, "agentLabel"),
            runtimeVersion,
            ParseRequiredDigest(row, "capabilityDigest"),
            ParseRequiredBoolean(row, "detected"),
            ParseRequiredEnum(
                row,
                "executionInterface",
                "cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"),
            ParseRequiredEnum(row, "interfaceMaturity", "stable", "beta", "experimental", "unknown"),
            ParseBoundedNonNegativeLong(row, "modelCount", 512),
            limitationShown,
            limitationTotal,
            ParseRequiredTimestamp(row, "observedAt"),
            ParseRequiredBoolean(row, "selected"));
        if (parsed.AdapterId != expected.AdapterId || parsed.AdapterVersion != expected.AdapterVersion ||
            parsed.AgentId != expected.AgentId || parsed.AgentLabel != expected.AgentLabel ||
            parsed.RuntimeVersion != expected.RuntimeVersion || parsed.CapabilityDigest != expected.CapabilityDigest ||
            parsed.Detected != expected.Detected || parsed.ExecutionInterface != expected.ExecutionInterface ||
            parsed.InterfaceMaturity != expected.InterfaceMaturity || parsed.ModelCount != expected.Models.Count ||
            parsed.LimitationTotal != expected.Limitations.Count ||
            !limitationValues.SequenceEqual(expected.Limitations.Take(64), StringComparer.Ordinal) ||
            parsed.ObservedAt != expected.ObservedAt ||
            ParseRequiredBoolean(support, "resume") != expected.SupportsResume ||
            ParseRequiredBoolean(support, "cancel") != expected.SupportsCancel ||
            ParseRequiredBoolean(support, "checkpoints") != expected.SupportsCheckpoints ||
            ParseRequiredBoolean(support, "modelDiscovery") != expected.SupportsModelDiscovery ||
            ParseRequiredBoolean(support, "toolSelection") != expected.SupportsToolSelection)
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    private static AgentModelSelectionProjection ParseAgentModelSelection(
        JsonElement selection,
        AgentSelectionState expected,
        IReadOnlyList<AgentModelCapability> capabilities)
    {
        if (selection.ValueKind != JsonValueKind.Object) throw InvalidResponse();
        var status = ParseRequiredEnum(selection, "status", "unselected", "selected", "migration-required", "invalid");
        var expectedStatus = expected.Status switch
        {
            AgentSelectionStatus.Unselected => "unselected",
            AgentSelectionStatus.Selected => "selected",
            AgentSelectionStatus.MigrationRequired => "migration-required",
            AgentSelectionStatus.Invalid => "invalid",
            _ => throw InvalidResponse(),
        };
        if (status != expectedStatus) throw InvalidResponse();
        if (status is "unselected" or "invalid")
        {
            if (!HasOnlyProperties(selection, "status")) throw InvalidResponse();
            return new AgentModelSelectionProjection(
                status,
                null,
                null,
                null,
                null,
                null,
                null,
                new System.Collections.ObjectModel.ReadOnlyDictionary<string, PortableAgentSettingValue>(
                    new Dictionary<string, PortableAgentSettingValue>(StringComparer.Ordinal)),
                null,
                null,
                null);
        }
        if (!HasOnlyProperties(
                selection,
                "status", "selectionDigest", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias",
                "settings", "selectedAt", "capabilityDigest", "capabilityState"))
        {
            throw InvalidResponse();
        }
        var current = status == "selected" ? expected.Selection : expected.PortableCandidate;
        if (current is null) throw InvalidResponse();
        var aliasElement = selection.GetProperty("modelAlias");
        if (aliasElement.ValueKind is not (JsonValueKind.True or JsonValueKind.False or JsonValueKind.Null))
        {
            throw InvalidResponse();
        }
        var capabilityState = status == "selected"
            ? ParseRequiredEnum(selection, "capabilityState", "current", "stale")
            : ParseRequiredEnum(selection, "capabilityState", "migration-required");
        var parsed = new AgentModelSelectionProjection(
            status,
            ParseRequiredDigest(selection, "selectionDigest"),
            ParseRequiredPortableText(selection, "adapterId"),
            ParseRequiredPortableText(selection, "agentId"),
            ParseRequiredPortableText(selection, "modelId"),
            ParseRequiredEnum(
                selection,
                "modelTruthClass",
                "observed", "provider-declared", "configured", "inferred", "unknown"),
            aliasElement.ValueKind == JsonValueKind.Null ? null : aliasElement.GetBoolean(),
            ParsePortableAgentSettings(selection.GetProperty("settings")),
            ParseRequiredTimestamp(selection, "selectedAt"),
            ParseRequiredDigest(selection, "capabilityDigest"),
            capabilityState);
        if (parsed.SelectionDigest != current.SelectionDigest || parsed.AdapterId != current.AdapterId ||
            parsed.AgentId != current.AgentId || parsed.ModelId != current.ModelId ||
            parsed.ModelTruthClass != current.ModelTruthClass || parsed.ModelAlias != current.ModelAlias ||
            parsed.SelectedAt != current.SelectedAt || parsed.CapabilityDigest != current.CapabilityDigest)
        {
            throw InvalidResponse();
        }
        if (status == "selected")
        {
            var capability = capabilities.SingleOrDefault(value =>
                value.AdapterId == parsed.AdapterId && value.AgentId == parsed.AgentId) ?? throw InvalidResponse();
            if ((capability.CapabilityDigest == parsed.CapabilityDigest) != (capabilityState == "current"))
            {
                throw InvalidResponse();
            }
        }
        return parsed;
    }

    private static IReadOnlyDictionary<string, PortableAgentSettingValue> ParsePortableAgentSettings(JsonElement settings)
    {
        if (settings.ValueKind != JsonValueKind.Object || settings.EnumerateObject().Take(129).Count() > 128)
        {
            throw InvalidResponse();
        }
        var parsed = new Dictionary<string, PortableAgentSettingValue>(StringComparer.Ordinal);
        foreach (var property in settings.EnumerateObject())
        {
            if (!ValidPortableSettingKey(property.Name) ||
                !parsed.TryAdd(property.Name, ParsePortableSettingValue(property.Value)))
            {
                throw InvalidResponse();
            }
        }
        return new System.Collections.ObjectModel.ReadOnlyDictionary<string, PortableAgentSettingValue>(parsed);
    }

    private static AgentModelRunProjection ParseAgentModelRun(JsonElement row)
    {
        if (row.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(row, "record", "initiativeId", "state", "agent", "startedAt", "endedAt", "managed"))
        {
            throw InvalidResponse();
        }
        var record = ParseAgentModelReference(row.GetProperty("record"), "run");
        var initiativeId = ParseRequiredGuid(row, "initiativeId");
        var agent = row.GetProperty("agent");
        if (!HasOnlyProperties(agent, "adapterId", "agentId", "modelId", "selectionDigest")) throw InvalidResponse();
        var startedAt = ParseNullableTimestamp(row.GetProperty("startedAt"));
        var endedAt = ParseNullableTimestamp(row.GetProperty("endedAt"));
        if (startedAt.HasValue && endedAt.HasValue && endedAt.Value < startedAt.Value) throw InvalidResponse();
        _ = ParseRequiredDigest(agent, "selectionDigest");
        return new AgentModelRunProjection(
            record.RecordId,
            record.Revision,
            initiativeId,
            ParseRequiredEnum(row, "state", "prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"),
            ParseRequiredPortableText(agent, "adapterId"),
            ParseRequiredPortableText(agent, "agentId"),
            ParseRequiredPortableText(agent, "modelId"),
            ParseAgentModelManaged(row.GetProperty("managed")));
    }

    private static AgentModelManagedProjection ParseAgentModelManaged(JsonElement managed)
    {
        if (managed.ValueKind != JsonValueKind.Object) throw InvalidResponse();
        var status = ParseRequiredEnum(managed, "status", "not-observed-in-bounded-window", "observed");
        if (status == "not-observed-in-bounded-window")
        {
            if (!HasOnlyProperties(managed, "status")) throw InvalidResponse();
            return new AgentModelManagedProjection(status, null, null, null, null, null, null, null, null, null);
        }
        if (!HasOnlyProperties(
                managed,
                "status", "record", "mode", "state", "attemptNumber", "bindingsDigest", "provider", "result"))
        {
            throw InvalidResponse();
        }
        var record = ParseAgentModelReference(managed.GetProperty("record"), "managed-run");
        _ = ParseRequiredEnum(managed, "mode", "codex-staged", "manual-offline", "claude-context-only");
        var state = ParseRequiredEnum(
            managed,
            "state",
            "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled", "timed-out",
            "unknown", "conflict", "discarded");
        var attempt = ParsePositiveLong(managed, "attemptNumber");
        if (attempt > 1_000_000) throw InvalidResponse();
        _ = ParseRequiredDigest(managed, "bindingsDigest");
        var provider = managed.GetProperty("provider");
        if (!HasOnlyProperties(provider, "adapterId", "agentId", "modelId", "capabilityDigest")) throw InvalidResponse();
        _ = ParseRequiredPortableText(provider, "adapterId");
        _ = ParseRequiredPortableText(provider, "agentId");
        _ = ParseRequiredPortableText(provider, "modelId");
        _ = ParseRequiredDigest(provider, "capabilityDigest");
        var result = managed.GetProperty("result");
        var resultStatus = ParseRequiredEnum(result, "status", "not-bound", "bound");
        if (resultStatus == "not-bound")
        {
            if (!HasOnlyProperties(result, "status")) throw InvalidResponse();
            return new AgentModelManagedProjection(
                status, record.RecordId, state, attempt, resultStatus, null, null, null, null, null);
        }
        if (!HasOnlyProperties(
                result,
                "status", "recordId", "digest", "providerDisposition", "outcomeStatus", "evidence"))
        {
            throw InvalidResponse();
        }
        _ = ParseRequiredGuid(result, "recordId");
        _ = ParseRequiredDigest(result, "digest");
        var providerDisposition = ParseRequiredEnum(
            result,
            "providerDisposition",
            "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown");
        var outcomeStatus = ParseRequiredEnum(result, "outcomeStatus", "satisfied", "failed", "not-assessed", "indeterminate");
        var evidence = result.GetProperty("evidence");
        if (!HasOnlyProperties(
                evidence,
                "recordId", "digest", "eventCount", "eventsDigest", "actualEffectCount", "capturedAt"))
        {
            throw InvalidResponse();
        }
        var evidenceId = ParseRequiredGuid(evidence, "recordId");
        _ = ParseRequiredDigest(evidence, "digest");
        var eventCount = ParseBoundedNonNegativeLong(evidence, "eventCount", 4_096);
        _ = ParseRequiredDigest(evidence, "eventsDigest");
        var actualEffectCount = ParseBoundedNonNegativeLong(evidence, "actualEffectCount", 32);
        _ = ParseRequiredTimestamp(evidence, "capturedAt");
        return new AgentModelManagedProjection(
            status,
            record.RecordId,
            state,
            attempt,
            resultStatus,
            providerDisposition,
            outcomeStatus,
            evidenceId,
            eventCount,
            actualEffectCount);
    }

    private static AgentModelHandoffProjection ParseAgentModelHandoff(JsonElement row)
    {
        if (row.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(row, "record", "fromRun", "toSelection", "state", "createdAt", "acknowledgedAt"))
        {
            throw InvalidResponse();
        }
        var record = ParseAgentModelReference(row.GetProperty("record"), "handoff");
        if (record.Revision != 1) throw InvalidResponse();
        var fromRun = ParseAgentModelReference(row.GetProperty("fromRun"), "run");
        var toSelection = row.GetProperty("toSelection");
        if (!HasOnlyProperties(toSelection, "adapterId", "agentId", "modelId", "selectionDigest"))
        {
            throw InvalidResponse();
        }
        _ = ParseRequiredDigest(toSelection, "selectionDigest");
        var state = ParseRequiredEnum(row, "state", "pending-acknowledgement", "acknowledged");
        var createdAt = ParseRequiredTimestamp(row, "createdAt");
        var acknowledgedAt = ParseNullableTimestamp(row.GetProperty("acknowledgedAt"));
        if ((state == "acknowledged") != acknowledgedAt.HasValue ||
            (acknowledgedAt.HasValue && acknowledgedAt.Value < createdAt))
        {
            throw InvalidResponse();
        }
        return new AgentModelHandoffProjection(
            record.RecordId,
            fromRun.RecordId,
            ParseRequiredPortableText(toSelection, "adapterId"),
            ParseRequiredPortableText(toSelection, "agentId"),
            ParseRequiredPortableText(toSelection, "modelId"),
            state,
            createdAt);
    }

    private static void ValidateAgentModelMetrics(JsonElement metrics)
    {
        if (!HasOnlyProperties(metrics, "usage", "cost")) throw InvalidResponse();
        foreach (var name in new[] { "usage", "cost" })
        {
            var metric = metrics.GetProperty(name);
            if (!HasOnlyProperties(metric, "state", "basis") ||
                ParseRequiredEnum(metric, "state", "unavailable") != "unavailable" ||
                ParseRequiredEnum(
                    metric,
                    "basis",
                    "current-managed-records-have-no-provider-usage-or-cost-contract") !=
                    "current-managed-records-have-no-provider-usage-or-cost-contract")
            {
                throw InvalidResponse();
            }
        }
    }

    private static AgentModelFreshness ParseAgentModelFreshness(JsonElement freshness)
    {
        if (!HasOnlyProperties(
                freshness,
                "state", "selectionCapabilityState", "oldestCapabilityObservedAt", "newestCapabilityObservedAt",
                "truncated", "coverageBoundary") ||
            ParseRequiredEnum(
                freshness,
                "coverageBoundary",
                "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness") !=
                "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness")
        {
            throw InvalidResponse();
        }
        return new AgentModelFreshness(
            ParseRequiredEnum(freshness, "state", "current", "attention-required"),
            ParseRequiredEnum(
                freshness,
                "selectionCapabilityState",
                "current", "unselected", "stale", "migration-required", "invalid"),
            ParseRequiredTimestamp(freshness, "oldestCapabilityObservedAt"),
            ParseRequiredTimestamp(freshness, "newestCapabilityObservedAt"),
            ParseRequiredBoolean(freshness, "truncated"));
    }

    private static AgentModelLimit ParseAgentModelLimit(JsonElement limit)
    {
        if (!HasOnlyProperties(limit, "shown", "total", "omitted")) throw InvalidResponse();
        var shown = ParseBoundedNonNegativeLong(limit, "shown", 1_000_000);
        var total = ParseBoundedNonNegativeLong(limit, "total", 1_000_000);
        var omitted = ParseBoundedNonNegativeLong(limit, "omitted", 1_000_000);
        if (shown + omitted != total) throw InvalidResponse();
        return new AgentModelLimit(shown, total, omitted);
    }

    private static DateTimeOffset? ParseNullableTimestamp(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Null) return null;
        if (value.ValueKind != JsonValueKind.String || !TryParseTimestamp(value.GetString(), out var parsed))
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    internal static IReadOnlyList<AgentReadinessSnapshot> ParseAgentReadinessResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Array || result.GetArrayLength() is < 1 or > 16) throw InvalidResponse();
        foreach (var snapshot in result.EnumerateArray()) ValidateAgentSnapshotShape(snapshot);
        List<AgentSnapshotWire> wires;
        try
        {
            wires = result.Deserialize<List<AgentSnapshotWire>>(StrictJson) ?? throw InvalidResponse();
        }
        catch (JsonException)
        {
            throw InvalidResponse();
        }
        var rawSnapshots = result.EnumerateArray().ToArray();
        var snapshots = wires.Select((wire, index) => ParseAgentSnapshot(wire, CanonicalDigest(rawSnapshots[index])))
            .OrderBy(snapshot => snapshot.AgentLabel, StringComparer.Ordinal).ToArray();
        if (snapshots.Select(snapshot => snapshot.AdapterId).Distinct(StringComparer.Ordinal).Count() != snapshots.Length ||
            snapshots.Select(snapshot => snapshot.AgentId).Distinct(StringComparer.Ordinal).Count() != snapshots.Length)
        {
            throw InvalidResponse();
        }
        return Array.AsReadOnly(snapshots);
    }

    internal static AgentSelectionState ParseAgentSelectionStateResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Object ||
            !result.TryGetProperty("status", out var statusElement) || statusElement.ValueKind != JsonValueKind.String)
        {
            throw InvalidResponse();
        }
        return statusElement.GetString() switch
        {
            "unselected" when HasOnlyProperties(result, "status") =>
                new AgentSelectionState(AgentSelectionStatus.Unselected, null, null),
            "selected" when HasOnlyProperties(result, "status", "selection") =>
                new AgentSelectionState(
                    AgentSelectionStatus.Selected,
                    ParseAgentSelection(result.GetProperty("selection")),
                    null),
            "migration-required" when HasOnlyProperties(result, "status", "portableCandidate") =>
                new AgentSelectionState(
                    AgentSelectionStatus.MigrationRequired,
                    null,
                    ParseAgentSelection(result.GetProperty("portableCandidate"))),
            "invalid" when HasOnlyProperties(result, "status") =>
                new AgentSelectionState(AgentSelectionStatus.Invalid, null, null),
            _ => throw InvalidResponse(),
        };
    }

    internal static AgentSelection ParseAgentSelectionResponse(JsonElement envelope) => ParseAgentSelection(ReadResult(envelope));

    internal static IReadOnlyList<AgentRun> ParseAgentRunsResponse(JsonElement envelope)
    {
        var result = ReadResult(envelope);
        if (result.ValueKind != JsonValueKind.Array || result.GetArrayLength() > 512) throw InvalidResponse();
        var runs = result.EnumerateArray().Select(ParseAgentRun).ToArray();
        if (runs.Select(run => run.Id).Distinct().Count() != runs.Length) throw InvalidResponse();
        return Array.AsReadOnly(runs);
    }

    internal static AgentHandoff ParseAgentHandoffResponse(
        JsonElement envelope,
        Guid expectedFromRunId,
        Guid expectedProductId,
        Guid expectedInitiativeId,
        string expectedAdapterId,
        string expectedAgentId,
        string expectedModelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> expectedSettings,
        string expectedReason,
        IReadOnlyList<string> expectedCompletedWork,
        IReadOnlyList<string> expectedUnresolvedMatters,
        IReadOnlyList<string> expectedDecisions,
        IReadOnlyList<string> expectedEvidence)
    {
        var handoff = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                handoff,
                [
                    "schemaVersion", "id", "productId", "initiativeId", "fromRunId", "toAgent", "reason",
                    "workspaceBaseline", "completedWork", "unresolvedMatters", "decisions", "evidence",
                    "capabilityDifferences", "createdAt",
                ],
                ["acknowledgedAt"]) ||
            handoff.GetProperty("schemaVersion").GetInt32() != 1)
        {
            throw InvalidResponse();
        }
        var id = ParseRequiredGuid(handoff, "id");
        var productId = ParseRequiredGuid(handoff, "productId");
        var initiativeId = ParseRequiredGuid(handoff, "initiativeId");
        var fromRunId = ParseRequiredGuid(handoff, "fromRunId");
        if (fromRunId != expectedFromRunId || productId != expectedProductId || initiativeId != expectedInitiativeId)
        {
            throw InvalidResponse();
        }
        var toAgent = ParseAgentSelection(handoff.GetProperty("toAgent"));
        if (toAgent.AdapterId != expectedAdapterId || toAgent.AgentId != expectedAgentId ||
            toAgent.ModelId != expectedModelId || !PortableSettingsEqual(toAgent.Settings, expectedSettings))
        {
            throw InvalidResponse();
        }
        var reason = ParseHandoffText(handoff.GetProperty("reason"), 2);
        var completedWork = ParseHandoffTextArray(handoff.GetProperty("completedWork"));
        var unresolvedMatters = ParseHandoffTextArray(handoff.GetProperty("unresolvedMatters"));
        var decisions = ParseHandoffTextArray(handoff.GetProperty("decisions"));
        var evidence = ParseHandoffTextArray(handoff.GetProperty("evidence"));
        if (reason != expectedReason || !completedWork.SequenceEqual(expectedCompletedWork, StringComparer.Ordinal) ||
            !unresolvedMatters.SequenceEqual(expectedUnresolvedMatters, StringComparer.Ordinal) ||
            !decisions.SequenceEqual(expectedDecisions, StringComparer.Ordinal) ||
            !evidence.SequenceEqual(expectedEvidence, StringComparer.Ordinal))
        {
            throw InvalidResponse();
        }
        if (!handoff.TryGetProperty("createdAt", out var createdElement) || createdElement.ValueKind != JsonValueKind.String ||
            !TryParseTimestamp(createdElement.GetString(), out var createdAt))
        {
            throw InvalidResponse();
        }
        DateTimeOffset? acknowledgedAt = null;
        if (handoff.TryGetProperty("acknowledgedAt", out var acknowledgedElement))
        {
            if (acknowledgedElement.ValueKind != JsonValueKind.String ||
                !TryParseTimestamp(acknowledgedElement.GetString(), out var parsedAcknowledged))
            {
                throw InvalidResponse();
            }
            acknowledgedAt = parsedAcknowledged;
        }
        return new AgentHandoff(
            1,
            id,
            productId,
            initiativeId,
            fromRunId,
            toAgent,
            reason,
            ParseHandoffWorkspaceBaseline(handoff.GetProperty("workspaceBaseline")),
            completedWork,
            unresolvedMatters,
            decisions,
            evidence,
            ParseHandoffTextArray(handoff.GetProperty("capabilityDifferences")),
            createdAt,
            acknowledgedAt);
    }

    internal static ManagedReadOnlyPreview ParseManagedReadOnlyPreviewResponse(
        JsonElement envelope,
        Guid expectedCharterId,
        Guid expectedWorkflowPlanId)
    {
        var preview = ReadResult(envelope);
        if (!HasOnlyProperties(
                preview,
                "schemaVersion", "kind", "productId", "initiativeId", "charterId", "charterDigest",
                "workflowPlanId", "workflowPlanDigest", "adapterId", "agentId", "modelId", "selectionDigest",
                "strategy", "stepIds", "contextPackCount", "readScopeCount", "gates", "authorityBoundary",
                "previewDigest") ||
            preview.GetProperty("schemaVersion").GetInt32() != 1 ||
            preview.GetProperty("kind").GetString() != "managed-readonly-preview" ||
            preview.GetProperty("authorityBoundary").GetString() != ManagedPreviewBoundary)
        {
            throw InvalidResponse();
        }
        var charterId = ParseRequiredGuid(preview, "charterId");
        var workflowPlanId = ParseRequiredGuid(preview, "workflowPlanId");
        if (expectedCharterId == Guid.Empty || expectedWorkflowPlanId == Guid.Empty ||
            charterId != expectedCharterId || workflowPlanId != expectedWorkflowPlanId)
        {
            throw InvalidResponse();
        }
        if (!preview.TryGetProperty("stepIds", out var stepIdsElement) ||
            stepIdsElement.ValueKind != JsonValueKind.Array || stepIdsElement.GetArrayLength() is < 1 or > 512 ||
            !preview.TryGetProperty("gates", out var gatesElement) ||
            gatesElement.ValueKind != JsonValueKind.Array || gatesElement.GetArrayLength() is < 2 or > 2_050)
        {
            throw InvalidResponse();
        }
        var stepIds = stepIdsElement.EnumerateArray().Select(ParseRequiredGuidValue).ToArray();
        if (stepIds.Distinct().Count() != stepIds.Length) throw InvalidResponse();
        var stepIdSet = stepIds.ToHashSet();
        var gates = gatesElement.EnumerateArray().Select(gate => ParseManagedReadOnlyGate(gate, stepIdSet)).ToArray();
        if (gates.Select(gate => gate.Key).Distinct(StringComparer.Ordinal).Count() != gates.Length)
        {
            throw InvalidResponse();
        }
        var contextPackCount = ParseBoundedNonNegativeInt(preview, "contextPackCount", 512);
        var readScopeCount = ParseBoundedNonNegativeInt(preview, "readScopeCount", 100_000);
        var parsed = new ManagedReadOnlyPreview(
            1,
            "managed-readonly-preview",
            ParseRequiredGuid(preview, "productId"),
            ParseRequiredGuid(preview, "initiativeId"),
            charterId,
            ParseRequiredDigest(preview, "charterDigest"),
            workflowPlanId,
            ParseRequiredDigest(preview, "workflowPlanDigest"),
            ParseRequiredPortableText(preview, "adapterId"),
            ParseRequiredPortableText(preview, "agentId"),
            ParseRequiredPortableText(preview, "modelId"),
            ParseRequiredDigest(preview, "selectionDigest"),
            ParseRequiredEnum(preview, "strategy", "sequential", "parallel-readonly"),
            Array.AsReadOnly(stepIds),
            contextPackCount,
            readScopeCount,
            Array.AsReadOnly(gates),
            ManagedPreviewBoundary,
            ParseRequiredDigest(preview, "previewDigest"));
        ValidateManagedReadOnlyPreview(parsed);
        return parsed;
    }

    internal static ManagedReadOnlyReceipt ParseManagedReadOnlyReceiptResponse(
        JsonElement envelope,
        ManagedReadOnlyPreview preview)
    {
        ValidateManagedReadOnlyPreview(preview);
        var receipt = ReadResult(envelope);
        if (!HasOnlyProperties(
                receipt,
                "schemaVersion", "kind", "previewDigest", "runId", "managedRunId", "productId", "initiativeId",
                "adapterId", "agentId", "modelId", "mode", "state", "providerDisposition", "outcomeStatus",
                "outcomeBasis", "eventCount", "completedStepCount", "totalStepCount", "resultDigest",
                "evidenceDigest", "warnings", "startedAt", "endedAt", "authorityBoundary") ||
            receipt.GetProperty("schemaVersion").GetInt32() != 1 ||
            receipt.GetProperty("kind").GetString() != "managed-readonly-receipt" ||
            receipt.GetProperty("authorityBoundary").GetString() != ManagedReceiptBoundary)
        {
            throw InvalidResponse();
        }
        var previewDigest = ParseRequiredDigest(receipt, "previewDigest");
        var productId = ParseRequiredGuid(receipt, "productId");
        var initiativeId = ParseRequiredGuid(receipt, "initiativeId");
        var adapterId = ParseRequiredPortableText(receipt, "adapterId");
        var agentId = ParseRequiredPortableText(receipt, "agentId");
        var modelId = ParseRequiredPortableText(receipt, "modelId");
        if (previewDigest != preview.PreviewDigest || productId != preview.ProductId ||
            initiativeId != preview.InitiativeId || adapterId != preview.AdapterId ||
            agentId != preview.AgentId || modelId != preview.ModelId)
        {
            throw InvalidResponse();
        }
        var mode = ParseRequiredEnum(receipt, "mode", "codex-staged", "manual-offline", "claude-context-only");
        var state = ParseRequiredEnum(
            receipt,
            "state",
            "review-required", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded");
        var providerDisposition = ParseRequiredEnum(
            receipt,
            "providerDisposition",
            "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown");
        var outcomeStatus = ParseRequiredEnum(receipt, "outcomeStatus", "satisfied", "failed", "not-assessed", "indeterminate");
        var outcomeBasis = ParseRequiredEnum(
            receipt,
            "outcomeBasis",
            "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure");
        var eventCount = ParseBoundedNonNegativeInt(receipt, "eventCount", 4_096);
        var completedStepCount = ParseBoundedNonNegativeInt(receipt, "completedStepCount", 512);
        var totalStepCount = ParseBoundedNonNegativeInt(receipt, "totalStepCount", 512);
        if (totalStepCount != preview.StepIds.Count || completedStepCount > totalStepCount ||
            (state == "completed" && (providerDisposition != "completed" || outcomeStatus != "satisfied")))
        {
            throw InvalidResponse();
        }
        if (!receipt.TryGetProperty("warnings", out var warningsElement) ||
            warningsElement.ValueKind != JsonValueKind.Array || warningsElement.GetArrayLength() > 128)
        {
            throw InvalidResponse();
        }
        string[] warningValues =
        [
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        ];
        var warnings = warningsElement.EnumerateArray().Select(warning =>
        {
            var value = warning.ValueKind == JsonValueKind.String ? warning.GetString() : null;
            return value is not null && warningValues.Contains(value, StringComparer.Ordinal)
                ? value
                : throw InvalidResponse();
        }).ToArray();
        var startedAt = ParseRequiredTimestamp(receipt, "startedAt");
        var endedAt = ParseRequiredTimestamp(receipt, "endedAt");
        if (endedAt < startedAt) throw InvalidResponse();
        return new ManagedReadOnlyReceipt(
            1,
            "managed-readonly-receipt",
            previewDigest,
            ParseRequiredGuid(receipt, "runId"),
            ParseRequiredGuid(receipt, "managedRunId"),
            productId,
            initiativeId,
            adapterId,
            agentId,
            modelId,
            mode,
            state,
            providerDisposition,
            outcomeStatus,
            outcomeBasis,
            eventCount,
            completedStepCount,
            totalStepCount,
            ParseRequiredDigest(receipt, "resultDigest"),
            ParseRequiredDigest(receipt, "evidenceDigest"),
            Array.AsReadOnly(warnings),
            startedAt,
            endedAt,
            ManagedReceiptBoundary);
    }

    internal static ManagedRunSummaryPage ParseManagedRunSummaryPageResponse(
        JsonElement envelope,
        int expectedOffset,
        int expectedLimit,
        string? expectedSnapshotDigest = null,
        int? expectedTotal = null)
    {
        var page = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                page,
                [
                    "schemaVersion", "kind", "items", "offset", "limit", "total", "omittedCount",
                    "snapshotDigest", "hasMore", "authorityBoundary", "privacyBoundary",
                ],
                []) ||
            page.GetProperty("schemaVersion").GetInt32() != 1 ||
            page.GetProperty("kind").GetString() != "managed-run-summary-page" ||
            page.GetProperty("authorityBoundary").GetString() != ManagedInventoryBoundary ||
            page.GetProperty("privacyBoundary").GetString() != ManagedEvidencePrivacyBoundary)
        {
            throw InvalidResponse();
        }
        var offset = ParseBoundedNonNegativeInt(page, "offset", 2_000);
        var limit = ParseBoundedNonNegativeInt(page, "limit", 200);
        var total = ParseBoundedNonNegativeInt(page, "total", 2_000);
        var omittedCount = ParseBoundedNonNegativeInt(page, "omittedCount", 2_000);
        if (!page.TryGetProperty("items", out var itemsElement) || itemsElement.ValueKind != JsonValueKind.Array ||
            limit < 1 || offset != expectedOffset || limit != expectedLimit ||
            (expectedTotal is not null && total != expectedTotal) || itemsElement.GetArrayLength() > limit ||
            (long)offset + itemsElement.GetArrayLength() > total || omittedCount != total - itemsElement.GetArrayLength())
        {
            throw InvalidResponse();
        }
        var items = itemsElement.EnumerateArray().Select(ParseManagedRunSummary).ToArray();
        if (items.Select(item => item.ManagedRunId).Distinct().Count() != items.Length) throw InvalidResponse();
        var snapshotDigest = ParseRequiredDigest(page, "snapshotDigest");
        if (expectedSnapshotDigest is not null && snapshotDigest != expectedSnapshotDigest) throw InvalidResponse();
        var hasMore = ParseRequiredBoolean(page, "hasMore");
        if (hasMore != ((long)offset + items.Length < total) || (hasMore && items.Length == 0)) throw InvalidResponse();
        return new ManagedRunSummaryPage(
            1,
            "managed-run-summary-page",
            Array.AsReadOnly(items),
            offset,
            limit,
            total,
            omittedCount,
            snapshotDigest,
            hasMore,
            ManagedInventoryBoundary,
            ManagedEvidencePrivacyBoundary);
    }

    internal static ManagedEvidenceDetail ParseManagedEvidenceDetailResponse(
        JsonElement envelope,
        Guid expectedManagedRunId) =>
        ParseManagedEvidenceDetail(ReadResult(envelope), expectedManagedRunId);

    private static ManagedEvidenceDetail ParseManagedEvidenceDetail(
        JsonElement detail,
        Guid expectedManagedRunId)
    {
        if (!HasRequiredAndAllowedProperties(
                detail,
                ["schemaVersion", "kind", "summary", "artifactStatus", "authorityBoundary", "privacyBoundary"],
                ["result", "evidence", "applyDecision"]) ||
            detail.GetProperty("schemaVersion").GetInt32() != 1 ||
            detail.GetProperty("kind").GetString() != "managed-evidence-detail" ||
            detail.GetProperty("authorityBoundary").GetString() != ManagedEvidenceBoundary ||
            detail.GetProperty("privacyBoundary").GetString() != ManagedEvidencePrivacyBoundary)
        {
            throw InvalidResponse();
        }
        var summary = ParseManagedRunSummary(detail.GetProperty("summary"));
        if (expectedManagedRunId == Guid.Empty || summary.ManagedRunId != expectedManagedRunId) throw InvalidResponse();
        var artifactStatus = ParseRequiredEnum(
            detail,
            "artifactStatus",
            "record-only",
            "verified-result-and-evidence");
        var hasResult = detail.TryGetProperty("result", out var resultElement);
        var hasEvidence = detail.TryGetProperty("evidence", out var evidenceElement);
        var hasApplyDecision = detail.TryGetProperty("applyDecision", out var applyDecisionElement);
        if (hasResult != hasEvidence || hasResult != summary.HasResult ||
            hasApplyDecision != summary.HasApplyDecision || (artifactStatus == "record-only") != !hasResult)
        {
            throw InvalidResponse();
        }
        var result = hasResult ? ParseManagedEvidenceResult(resultElement, summary) : null;
        var evidence = hasEvidence
            ? ParseManagedEvidenceProjection(evidenceElement, result ?? throw InvalidResponse())
            : null;
        var applyDecision = hasApplyDecision
            ? ParseManagedApplyDecisionProjection(applyDecisionElement, summary)
            : null;
        return new ManagedEvidenceDetail(
            1,
            "managed-evidence-detail",
            summary,
            artifactStatus,
            result,
            evidence,
            applyDecision,
            ManagedEvidenceBoundary,
            ManagedEvidencePrivacyBoundary);
    }

    internal static ManagedReviewPreview ParseManagedReviewPreviewResponse(
        JsonElement envelope,
        Guid expectedManagedRunId)
    {
        var preview = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                preview,
                [
                    "schemaVersion", "kind", "managedRunId", "managedRunRevision", "runId", "productId",
                    "initiativeId", "mode", "state", "canApply", "canDiscard", "hasLocalJournal", "bindingsDigest",
                    "result", "staging", "postApplyGatePolicy", "authorityBoundary", "privacyBoundary",
                    "cleanupBoundary", "previewDigest",
                ],
                ["applyConfirmation"]) ||
            preview.GetProperty("schemaVersion").GetInt32() != 1 ||
            preview.GetProperty("kind").GetString() != "managed-review-preview" ||
            preview.GetProperty("mode").GetString() != "codex-staged" ||
            preview.GetProperty("postApplyGatePolicy").GetString() != "record-not-assessed" ||
            preview.GetProperty("authorityBoundary").GetString() != ManagedReviewBoundary ||
            preview.GetProperty("privacyBoundary").GetString() != ManagedReviewPrivacyBoundary ||
            preview.GetProperty("cleanupBoundary").GetString() != ManagedReviewCleanupBoundary)
        {
            throw InvalidResponse();
        }
        var managedRunId = ParseRequiredGuid(preview, "managedRunId");
        var managedRunRevision = ParsePositiveLong(preview, "managedRunRevision");
        if (expectedManagedRunId == Guid.Empty || managedRunId != expectedManagedRunId) throw InvalidResponse();
        var state = ParseRequiredEnum(preview, "state", "review-required", "conflict");
        var canApply = ParseRequiredBoolean(preview, "canApply");
        var canDiscard = ParseRequiredBoolean(preview, "canDiscard");
        var hasApplyConfirmation = preview.TryGetProperty("applyConfirmation", out var confirmationElement);
        if (!canDiscard || canApply != hasApplyConfirmation || (state == "conflict" && canApply))
        {
            throw InvalidResponse();
        }
        var result = ParseManagedReviewResult(preview.GetProperty("result"), state);
        var staging = ParseManagedReviewStaging(preview.GetProperty("staging"), state);
        if (result.EvidenceId != staging.EvidenceId || result.EvidenceDigest != staging.EvidenceDigest)
        {
            throw InvalidResponse();
        }
        var confirmation = hasApplyConfirmation
            ? ParseManagedReviewApplyConfirmation(confirmationElement, staging)
            : null;
        var parsed = new ManagedReviewPreview(
            1,
            "managed-review-preview",
            managedRunId,
            managedRunRevision,
            ParseRequiredGuid(preview, "runId"),
            ParseRequiredGuid(preview, "productId"),
            ParseRequiredGuid(preview, "initiativeId"),
            "codex-staged",
            state,
            canApply,
            true,
            ParseRequiredBoolean(preview, "hasLocalJournal"),
            ParseRequiredDigest(preview, "bindingsDigest"),
            result,
            staging,
            confirmation,
            "record-not-assessed",
            ManagedReviewBoundary,
            ManagedReviewPrivacyBoundary,
            ManagedReviewCleanupBoundary,
            ParseRequiredDigest(preview, "previewDigest"));
        ValidateManagedReviewPreview(parsed);
        return parsed;
    }

    internal static ManagedReviewTransition ParseManagedReviewTransitionResponse(
        JsonElement envelope,
        ManagedReviewPreview preview,
        string expectedDecision)
    {
        if (expectedDecision is not ("apply-exact-managed-review" or "discard-exact-managed-review"))
        {
            throw new ArgumentException("Managed review decision is invalid.", nameof(expectedDecision));
        }
        ValidateManagedReviewPreview(preview);
        var transition = ReadResult(envelope);
        if (!HasRequiredAndAllowedProperties(
                transition,
                [
                    "schemaVersion", "kind", "decision", "sourcePreviewDigest", "sourceManagedRunRevision",
                    "managedRunId", "managedRunRevision", "state", "canApply", "canDiscard", "hasLocalJournal",
                    "detail", "authorityBoundary", "cleanupBoundary", "transitionDigest",
                ],
                []) ||
            transition.GetProperty("schemaVersion").GetInt32() != 1 ||
            transition.GetProperty("kind").GetString() != "managed-review-transition" ||
            transition.GetProperty("decision").GetString() != expectedDecision ||
            transition.GetProperty("authorityBoundary").GetString() != ManagedReviewTransitionBoundary ||
            transition.GetProperty("cleanupBoundary").GetString() != ManagedReviewCleanupBoundary ||
            ParseRequiredDigest(transition, "sourcePreviewDigest") != preview.PreviewDigest ||
            ParsePositiveLong(transition, "sourceManagedRunRevision") != preview.ManagedRunRevision)
        {
            throw InvalidResponse();
        }
        var managedRunId = ParseRequiredGuid(transition, "managedRunId");
        var managedRunRevision = ParsePositiveLong(transition, "managedRunRevision");
        if (managedRunId != preview.ManagedRunId || managedRunRevision <= preview.ManagedRunRevision)
        {
            throw InvalidResponse();
        }
        var state = ParseRequiredEnum(
            transition,
            "state",
            "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled",
            "timed-out", "unknown", "conflict", "discarded");
        var canApply = ParseRequiredBoolean(transition, "canApply");
        var canDiscard = ParseRequiredBoolean(transition, "canDiscard");
        if (expectedDecision == "discard-exact-managed-review")
        {
            if (state != "discarded" || canApply || canDiscard) throw InvalidResponse();
        }
        else if (state is not ("completed" or "failed" or "unknown" or "conflict") || canApply ||
                 canDiscard != (state == "conflict"))
        {
            throw InvalidResponse();
        }
        var detailElement = transition.GetProperty("detail");
        var detail = ParseManagedEvidenceDetail(detailElement, managedRunId);
        if (detail.Summary.State != state || detail.ArtifactStatus != "verified-result-and-evidence" ||
            (expectedDecision == "apply-exact-managed-review" && detail.ApplyDecision is null))
        {
            throw InvalidResponse();
        }
        var body = JsonSerializer.SerializeToElement(new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-review-transition",
            ["decision"] = expectedDecision,
            ["sourcePreviewDigest"] = preview.PreviewDigest,
            ["sourceManagedRunRevision"] = preview.ManagedRunRevision,
            ["managedRunId"] = managedRunId,
            ["managedRunRevision"] = managedRunRevision,
            ["state"] = state,
            ["canApply"] = canApply,
            ["canDiscard"] = canDiscard,
            ["hasLocalJournal"] = ParseRequiredBoolean(transition, "hasLocalJournal"),
            ["detail"] = detailElement.Clone(),
            ["authorityBoundary"] = ManagedReviewTransitionBoundary,
            ["cleanupBoundary"] = ManagedReviewCleanupBoundary,
        });
        var transitionDigest = ParseRequiredDigest(transition, "transitionDigest");
        if (transitionDigest != CanonicalDigest(body)) throw InvalidResponse();
        return new ManagedReviewTransition(
            1,
            "managed-review-transition",
            expectedDecision,
            preview.PreviewDigest,
            preview.ManagedRunRevision,
            managedRunId,
            managedRunRevision,
            state,
            canApply,
            canDiscard,
            ParseRequiredBoolean(transition, "hasLocalJournal"),
            detail,
            ManagedReviewTransitionBoundary,
            ManagedReviewCleanupBoundary,
            transitionDigest);
    }

    private static ManagedReviewResult ParseManagedReviewResult(JsonElement result, string expectedState)
    {
        if (!HasRequiredAndAllowedProperties(
                result,
                [
                    "resultId", "resultDigest", "terminalState", "providerDisposition", "outcomeStatus",
                    "outcomeBasis", "warningCodes", "evidenceId", "evidenceDigest",
                ],
                []) || !result.TryGetProperty("warningCodes", out var warningsElement) ||
            warningsElement.ValueKind != JsonValueKind.Array || warningsElement.GetArrayLength() > 128)
        {
            throw InvalidResponse();
        }
        var allowedWarnings = new HashSet<string>(StringComparer.Ordinal)
        {
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        };
        var warnings = warningsElement.EnumerateArray().Select(warning =>
        {
            if (warning.ValueKind != JsonValueKind.String || warning.GetString() is not { } value ||
                !allowedWarnings.Contains(value))
            {
                throw InvalidResponse();
            }
            return value;
        }).ToArray();
        return new ManagedReviewResult(
            ParseRequiredGuid(result, "resultId"),
            ParseRequiredDigest(result, "resultDigest"),
            ParseRequiredEnum(result, "terminalState", expectedState),
            ParseRequiredEnum(
                result,
                "providerDisposition",
                "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"),
            ParseRequiredEnum(result, "outcomeStatus", "satisfied", "failed", "not-assessed", "indeterminate"),
            ParseRequiredEnum(
                result,
                "outcomeBasis",
                "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure"),
            Array.AsReadOnly(warnings),
            ParseRequiredGuid(result, "evidenceId"),
            ParseRequiredDigest(result, "evidenceDigest"));
    }

    private static ManagedReviewStaging ParseManagedReviewStaging(JsonElement staging, string state)
    {
        if (!HasRequiredAndAllowedProperties(
                staging,
                [
                    "evidenceId", "evidenceDigest", "baselineDigest", "finalDigest", "applyState", "changeCount",
                    "changedInventoryLimit", "omittedCount", "changedInventory", "changedInventoryDigest",
                    "excludedPathCount", "excludedPathSetDigest",
                ],
                []) || !staging.TryGetProperty("changedInventory", out var inventoryElement) ||
            inventoryElement.ValueKind != JsonValueKind.Array || inventoryElement.GetArrayLength() > 512 ||
            ParseBoundedNonNegativeInt(staging, "changedInventoryLimit", 512) != 512 ||
            ParseBoundedNonNegativeInt(staging, "omittedCount", 0) != 0)
        {
            throw InvalidResponse();
        }
        var applyState = ParseRequiredEnum(staging, "applyState", "pending", "conflict");
        if (applyState != (state == "review-required" ? "pending" : "conflict")) throw InvalidResponse();
        var inventory = inventoryElement.EnumerateArray().Select(ParseManagedChangedFile).ToArray();
        if (ParseBoundedNonNegativeInt(staging, "changeCount", 512) != inventory.Length ||
            inventory.Select(change => change.Path).Distinct(StringComparer.Ordinal).Count() != inventory.Length ||
            inventory.Zip(inventory.Skip(1), (left, right) => StringComparer.Ordinal.Compare(left.Path, right.Path) >= 0).Any(invalid => invalid))
        {
            throw InvalidResponse();
        }
        var inventoryDigest = ParseRequiredDigest(staging, "changedInventoryDigest");
        if (inventoryDigest != CanonicalDigest(inventoryElement)) throw InvalidResponse();
        return new ManagedReviewStaging(
            ParseRequiredGuid(staging, "evidenceId"),
            ParseRequiredDigest(staging, "evidenceDigest"),
            ParseRequiredDigest(staging, "baselineDigest"),
            ParseRequiredDigest(staging, "finalDigest"),
            applyState,
            inventory.Length,
            512,
            0,
            Array.AsReadOnly(inventory),
            inventoryDigest,
            ParseBoundedNonNegativeInt(staging, "excludedPathCount", 20_000),
            ParseRequiredDigest(staging, "excludedPathSetDigest"));
    }

    private static ManagedChangedFile ParseManagedChangedFile(JsonElement change)
    {
        if (!HasRequiredAndAllowedProperties(
                change,
                ["path", "kind"],
                ["beforeDigest", "afterDigest", "beforeSize", "afterSize", "beforeMode", "afterMode"]))
        {
            throw InvalidResponse();
        }
        var kind = ParseRequiredEnum(change, "kind", "added", "modified", "deleted");
        var before = change.TryGetProperty("beforeDigest", out _) || change.TryGetProperty("beforeSize", out _) ||
                     change.TryGetProperty("beforeMode", out _);
        var after = change.TryGetProperty("afterDigest", out _) || change.TryGetProperty("afterSize", out _) ||
                    change.TryGetProperty("afterMode", out _);
        var completeBefore = change.TryGetProperty("beforeDigest", out _) && change.TryGetProperty("beforeSize", out _) &&
                             change.TryGetProperty("beforeMode", out _);
        var completeAfter = change.TryGetProperty("afterDigest", out _) && change.TryGetProperty("afterSize", out _) &&
                            change.TryGetProperty("afterMode", out _);
        if (before != completeBefore || after != completeAfter ||
            (kind == "added" && (before || !after)) || (kind == "deleted" && (!before || after)) ||
            (kind == "modified" && (!before || !after)))
        {
            throw InvalidResponse();
        }
        return new ManagedChangedFile(
            ParseWorkspaceRelativePath(change.GetProperty("path")),
            kind,
            completeBefore ? ParseRequiredDigest(change, "beforeDigest") : null,
            completeAfter ? ParseRequiredDigest(change, "afterDigest") : null,
            completeBefore ? ParseBoundedNonNegativeLong(change, "beforeSize", MaxSafeProductRevision) : null,
            completeAfter ? ParseBoundedNonNegativeLong(change, "afterSize", MaxSafeProductRevision) : null,
            completeBefore ? ParseBoundedNonNegativeInt(change, "beforeMode", 0x1ff) : null,
            completeAfter ? ParseBoundedNonNegativeInt(change, "afterMode", 0x1ff) : null);
    }

    private static ManagedReviewApplyConfirmation ParseManagedReviewApplyConfirmation(
        JsonElement confirmation,
        ManagedReviewStaging staging)
    {
        if (!HasRequiredAndAllowedProperties(
                confirmation,
                [
                    "decision", "reviewEvidenceId", "reviewEvidenceDigest", "changedInventoryDigest", "writeEnvelope",
                    "writeEnvelopeDigest",
                ],
                []) || confirmation.GetProperty("decision").GetString() != "apply-exact-reviewed-inventory" ||
            ParseRequiredGuid(confirmation, "reviewEvidenceId") != staging.EvidenceId ||
            ParseRequiredDigest(confirmation, "reviewEvidenceDigest") != staging.EvidenceDigest ||
            ParseRequiredDigest(confirmation, "changedInventoryDigest") != staging.ChangedInventoryDigest ||
            !confirmation.TryGetProperty("writeEnvelope", out var envelopeElement) ||
            envelopeElement.ValueKind != JsonValueKind.Array || envelopeElement.GetArrayLength() > 256)
        {
            throw InvalidResponse();
        }
        var envelope = envelopeElement.EnumerateArray().Select(ParseWorkspaceRelativeScope).ToArray();
        if (envelope.Distinct(StringComparer.Ordinal).Count() != envelope.Length ||
            envelope.Zip(envelope.Skip(1), (left, right) => StringComparer.Ordinal.Compare(left, right) >= 0).Any(invalid => invalid))
        {
            throw InvalidResponse();
        }
        var envelopeDigest = ParseRequiredDigest(confirmation, "writeEnvelopeDigest");
        if (envelopeDigest != CanonicalDigest(JsonSerializer.SerializeToElement(envelope))) throw InvalidResponse();
        return new ManagedReviewApplyConfirmation(
            "apply-exact-reviewed-inventory",
            staging.EvidenceId,
            staging.EvidenceDigest,
            staging.ChangedInventoryDigest,
            Array.AsReadOnly(envelope),
            envelopeDigest);
    }

    private static ManagedRunSummary ParseManagedRunSummary(JsonElement summary)
    {
        if (!HasRequiredAndAllowedProperties(
                summary,
                [
                    "schemaVersion", "kind", "managedRunId", "runId", "productId", "initiativeId", "mode", "state",
                    "adapterId", "agentId", "modelId", "attemptNumber", "recoveryStatus", "workflowCheckpointCount",
                    "hasResult", "hasApplyDecision", "bindingsDigest", "createdAt", "updatedAt", "authorityBoundary",
                ],
                ["resultDigest", "applyDecisionDigest", "startedAt", "endedAt"]) ||
            summary.GetProperty("schemaVersion").GetInt32() != 1 ||
            summary.GetProperty("kind").GetString() != "managed-run-summary" ||
            summary.GetProperty("authorityBoundary").GetString() != ManagedInventoryBoundary)
        {
            throw InvalidResponse();
        }
        var state = ParseRequiredEnum(
            summary,
            "state",
            "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled",
            "timed-out", "unknown", "conflict", "discarded");
        var hasResult = ParseRequiredBoolean(summary, "hasResult");
        var hasApplyDecision = ParseRequiredBoolean(summary, "hasApplyDecision");
        var resultDigest = ParseOptionalDigest(summary, "resultDigest");
        var applyDecisionDigest = ParseOptionalDigest(summary, "applyDecisionDigest");
        if (hasResult != (resultDigest is not null) || hasApplyDecision != (applyDecisionDigest is not null))
        {
            throw InvalidResponse();
        }
        var createdAt = ParseRequiredTimestamp(summary, "createdAt");
        var startedAt = ParseOptionalTimestamp(summary, "startedAt");
        var updatedAt = ParseRequiredTimestamp(summary, "updatedAt");
        var endedAt = ParseOptionalTimestamp(summary, "endedAt");
        var terminal = state is "completed" or "failed" or "cancelled" or "timed-out" or "unknown" or "conflict" or "discarded";
        if (terminal != endedAt.HasValue || updatedAt < createdAt ||
            (startedAt.HasValue && startedAt.Value < createdAt) ||
            (startedAt.HasValue && endedAt.HasValue && endedAt.Value < startedAt.Value))
        {
            throw InvalidResponse();
        }
        var attemptNumber = ParseBoundedNonNegativeInt(summary, "attemptNumber", 1_000_000);
        if (attemptNumber < 1) throw InvalidResponse();
        return new ManagedRunSummary(
            1,
            "managed-run-summary",
            ParseRequiredGuid(summary, "managedRunId"),
            ParseRequiredGuid(summary, "runId"),
            ParseRequiredGuid(summary, "productId"),
            ParseRequiredGuid(summary, "initiativeId"),
            ParseRequiredEnum(summary, "mode", "codex-staged", "manual-offline", "claude-context-only"),
            state,
            ParseRequiredPortableText(summary, "adapterId"),
            ParseRequiredPortableText(summary, "agentId"),
            ParseRequiredPortableText(summary, "modelId"),
            attemptNumber,
            ParseRequiredEnum(summary, "recoveryStatus", "not-required", "required", "recovered", "resume-unavailable"),
            ParseBoundedNonNegativeInt(summary, "workflowCheckpointCount", 511),
            hasResult,
            hasApplyDecision,
            ParseRequiredDigest(summary, "bindingsDigest"),
            resultDigest,
            applyDecisionDigest,
            createdAt,
            startedAt,
            updatedAt,
            endedAt,
            ManagedInventoryBoundary);
    }

    private static ManagedEvidenceResult ParseManagedEvidenceResult(
        JsonElement result,
        ManagedRunSummary summary)
    {
        if (!HasRequiredAndAllowedProperties(
                result,
                [
                    "resultId", "resultDigest", "providerDisposition", "terminationCause", "outcomeStatus", "outcomeBasis",
                    "terminalState", "evidenceId", "evidenceDigest", "warningCodes", "startedAt", "endedAt",
                ],
                []))
        {
            throw InvalidResponse();
        }
        var terminalState = ParseRequiredEnum(
            result,
            "terminalState",
            "review-required", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded");
        var providerDisposition = ParseRequiredEnum(
            result,
            "providerDisposition",
            "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown");
        var outcomeStatus = ParseRequiredEnum(result, "outcomeStatus", "satisfied", "failed", "not-assessed", "indeterminate");
        var resultDigest = ParseRequiredDigest(result, "resultDigest");
        if (terminalState != summary.State || resultDigest != summary.ResultDigest ||
            (terminalState == "completed" && (providerDisposition != "completed" || outcomeStatus != "satisfied")))
        {
            throw InvalidResponse();
        }
        if (!result.TryGetProperty("warningCodes", out var warningsElement) ||
            warningsElement.ValueKind != JsonValueKind.Array || warningsElement.GetArrayLength() > 128)
        {
            throw InvalidResponse();
        }
        string[] allowedWarnings =
        [
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        ];
        var warningCodes = warningsElement.EnumerateArray().Select(warning =>
        {
            var value = warning.ValueKind == JsonValueKind.String ? warning.GetString() : null;
            return value is not null && allowedWarnings.Contains(value, StringComparer.Ordinal)
                ? value
                : throw InvalidResponse();
        }).ToArray();
        var startedAt = ParseRequiredTimestamp(result, "startedAt");
        var endedAt = ParseRequiredTimestamp(result, "endedAt");
        if (endedAt < startedAt) throw InvalidResponse();
        return new ManagedEvidenceResult(
            ParseRequiredGuid(result, "resultId"),
            resultDigest,
            providerDisposition,
            ParseRequiredEnum(
                result,
                "terminationCause",
                "normal", "cancel-request", "timeout", "provider-failure", "process-loss", "protocol-error"),
            outcomeStatus,
            ParseRequiredEnum(
                result,
                "outcomeBasis",
                "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure"),
            terminalState,
            ParseRequiredGuid(result, "evidenceId"),
            ParseRequiredDigest(result, "evidenceDigest"),
            Array.AsReadOnly(warningCodes),
            startedAt,
            endedAt);
    }

    private static ManagedEvidenceProjection ParseManagedEvidenceProjection(
        JsonElement evidence,
        ManagedEvidenceResult result)
    {
        if (!HasRequiredAndAllowedProperties(
                evidence,
                [
                    "evidenceId", "evidenceDigest", "eventCount", "eventTypeCounts", "eventsDigest", "workflowStrategy",
                    "workflowStepCount", "workflowAttemptCount", "completedStepCount", "charterEvidenceStatus",
                    "charterStopStatus", "terminalReasonCode", "actualEffectCounts", "capturedAt",
                ],
                ["staging"]))
        {
            throw InvalidResponse();
        }
        var evidenceId = ParseRequiredGuid(evidence, "evidenceId");
        var evidenceDigest = ParseRequiredDigest(evidence, "evidenceDigest");
        if (evidenceId != result.EvidenceId || evidenceDigest != result.EvidenceDigest) throw InvalidResponse();
        var eventCount = ParseBoundedNonNegativeInt(evidence, "eventCount", 4_096);
        var eventTypeCounts = ParseExactCountMap(
            evidence.GetProperty("eventTypeCounts"),
            ["lifecycle", "output", "item", "approval", "warning", "error"],
            4_096);
        if (eventTypeCounts.Values.Sum() != eventCount) throw InvalidResponse();
        var workflowStepCount = ParseBoundedNonNegativeInt(evidence, "workflowStepCount", 512);
        var completedStepCount = ParseBoundedNonNegativeInt(evidence, "completedStepCount", 512);
        if (workflowStepCount < 1 || completedStepCount > workflowStepCount) throw InvalidResponse();
        var actualEffectCounts = ParseExactCountMap(
            evidence.GetProperty("actualEffectCounts"),
            ["not-observed", "observed-provisional", "applied", "blocked", "unknown"],
            32);
        if (actualEffectCounts.Values.Sum() > 32) throw InvalidResponse();
        var terminalReasonCode = ParseRequiredPortableText(evidence, "terminalReasonCode");
        if (terminalReasonCode.Length > 128 ||
            ValidateHandoffText(terminalReasonCode, "Terminal reason code", 1, 128) != terminalReasonCode)
        {
            throw InvalidResponse();
        }
        return new ManagedEvidenceProjection(
            evidenceId,
            evidenceDigest,
            eventCount,
            eventTypeCounts,
            ParseRequiredDigest(evidence, "eventsDigest"),
            ParseRequiredEnum(evidence, "workflowStrategy", "sequential", "parallel-readonly"),
            workflowStepCount,
            ParseBoundedNonNegativeInt(evidence, "workflowAttemptCount", 5_120),
            completedStepCount,
            ParseRequiredEnum(evidence, "charterEvidenceStatus", "satisfied", "failed", "not-assessed"),
            ParseRequiredEnum(evidence, "charterStopStatus", "satisfied", "failed", "not-assessed"),
            terminalReasonCode,
            evidence.TryGetProperty("staging", out var staging) ? ParseManagedStagingProjection(staging) : null,
            actualEffectCounts,
            ParseRequiredTimestamp(evidence, "capturedAt"));
    }

    private static ManagedStagingProjection ParseManagedStagingProjection(JsonElement staging)
    {
        if (!HasRequiredAndAllowedProperties(
                staging,
                [
                    "changeCount", "excludedPathCount", "applyState", "baselineDigest", "finalDigest",
                    "changedInventoryDigest", "excludedPathSetDigest",
                ],
                []))
        {
            throw InvalidResponse();
        }
        return new ManagedStagingProjection(
            ParseBoundedNonNegativeInt(staging, "changeCount", 20_000),
            ParseBoundedNonNegativeInt(staging, "excludedPathCount", 20_000),
            ParseRequiredEnum(staging, "applyState", "pending", "applied", "conflict", "discarded", "not-applied"),
            ParseRequiredDigest(staging, "baselineDigest"),
            ParseRequiredDigest(staging, "finalDigest"),
            ParseRequiredDigest(staging, "changedInventoryDigest"),
            ParseRequiredDigest(staging, "excludedPathSetDigest"));
    }

    private static ManagedApplyDecisionProjection ParseManagedApplyDecisionProjection(
        JsonElement decision,
        ManagedRunSummary summary)
    {
        if (!HasRequiredAndAllowedProperties(
                decision,
                [
                    "receiptId", "receiptDigest", "managedRunRevision", "changedInventoryCount", "writeEnvelopeCount",
                    "changedInventoryDigest", "writeEnvelopeDigest", "decidedAt",
                ],
                []))
        {
            throw InvalidResponse();
        }
        var receiptDigest = ParseRequiredDigest(decision, "receiptDigest");
        var managedRunRevision = ParseBoundedNonNegativeInt(decision, "managedRunRevision", int.MaxValue);
        if (receiptDigest != summary.ApplyDecisionDigest || managedRunRevision < 1) throw InvalidResponse();
        return new ManagedApplyDecisionProjection(
            ParseRequiredGuid(decision, "receiptId"),
            receiptDigest,
            managedRunRevision,
            ParseBoundedNonNegativeInt(decision, "changedInventoryCount", 20_000),
            ParseBoundedNonNegativeInt(decision, "writeEnvelopeCount", 256),
            ParseRequiredDigest(decision, "changedInventoryDigest"),
            ParseRequiredDigest(decision, "writeEnvelopeDigest"),
            ParseRequiredTimestamp(decision, "decidedAt"));
    }

    private static IReadOnlyDictionary<string, int> ParseExactCountMap(
        JsonElement value,
        IReadOnlyCollection<string> keys,
        int maximum)
    {
        if (!HasRequiredAndAllowedProperties(value, keys, [])) throw InvalidResponse();
        return new System.Collections.ObjectModel.ReadOnlyDictionary<string, int>(
            keys.ToDictionary(key => key, key => ParseBoundedNonNegativeInt(value, key, maximum), StringComparer.Ordinal));
    }

    internal static void ValidateManagedReadOnlyPreview(ManagedReadOnlyPreview preview)
    {
        ArgumentNullException.ThrowIfNull(preview);
        var body = BuildManagedReadOnlyPreviewBody(preview);
        if (preview.PreviewDigest != CanonicalDigest(body))
        {
            throw new ArgumentException("Managed read-only preview digest is invalid.", nameof(preview));
        }
    }

    internal static void ValidateManagedReviewPreview(ManagedReviewPreview preview)
    {
        ArgumentNullException.ThrowIfNull(preview);
        var body = BuildManagedReviewPreviewBody(preview);
        if (preview.PreviewDigest != CanonicalDigest(body))
        {
            throw new ArgumentException("Managed review preview digest is invalid.", nameof(preview));
        }
    }

    private static JsonElement BuildManagedReviewPreviewBody(ManagedReviewPreview preview)
    {
        if (preview.SchemaVersion != 1 || preview.Kind != "managed-review-preview" ||
            preview.ManagedRunId == Guid.Empty || preview.ManagedRunRevision < 1 || preview.RunId == Guid.Empty ||
            preview.ProductId == Guid.Empty || preview.InitiativeId == Guid.Empty || preview.Mode != "codex-staged" ||
            preview.State is not ("review-required" or "conflict") || !preview.CanDiscard ||
            preview.CanApply != (preview.ApplyConfirmation is not null) ||
            (preview.State == "conflict" && preview.CanApply) || !DigestPattern().IsMatch(preview.BindingsDigest) ||
            !DigestPattern().IsMatch(preview.PreviewDigest) || preview.PostApplyGatePolicy != "record-not-assessed" ||
            preview.AuthorityBoundary != ManagedReviewBoundary ||
            preview.PrivacyBoundary != ManagedReviewPrivacyBoundary ||
            preview.CleanupBoundary != ManagedReviewCleanupBoundary)
        {
            throw new ArgumentException("Managed review preview identity or boundary is invalid.", nameof(preview));
        }
        var allowedWarnings = new HashSet<string>(StringComparer.Ordinal)
        {
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        };
        var result = preview.Result;
        if (result.ResultId == Guid.Empty || result.EvidenceId == Guid.Empty ||
            !DigestPattern().IsMatch(result.ResultDigest) || !DigestPattern().IsMatch(result.EvidenceDigest) ||
            result.TerminalState != preview.State ||
            result.ProviderDisposition is not ("completed" or "failed" or "cancelled" or "interrupted" or "crashed" or
                "protocol-error" or "unknown") ||
            result.OutcomeStatus is not ("satisfied" or "failed" or "not-assessed" or "indeterminate") ||
            result.OutcomeBasis is not ("postcondition-evaluator" or "deterministic-offline-runtime" or "not-evaluated" or
                "provider-failure") || result.WarningCodes.Count > 128 ||
            result.WarningCodes.Any(warning => !allowedWarnings.Contains(warning)))
        {
            throw new ArgumentException("Managed review result is invalid.", nameof(preview));
        }
        var staging = preview.Staging;
        if (staging.EvidenceId != result.EvidenceId || staging.EvidenceDigest != result.EvidenceDigest ||
            !DigestPattern().IsMatch(staging.BaselineDigest) || !DigestPattern().IsMatch(staging.FinalDigest) ||
            staging.ApplyState != (preview.State == "review-required" ? "pending" : "conflict") ||
            staging.ChangeCount != staging.ChangedInventory.Count || staging.ChangedInventoryLimit != 512 ||
            staging.OmittedCount != 0 || staging.ChangedInventory.Count > 512 ||
            staging.ChangedInventory.Select(change => change.Path).Distinct(StringComparer.Ordinal).Count() !=
                staging.ChangedInventory.Count ||
            staging.ChangedInventory.Zip(
                    staging.ChangedInventory.Skip(1),
                    (left, right) => StringComparer.Ordinal.Compare(left.Path, right.Path) >= 0)
                .Any(invalid => invalid) || staging.ExcludedPathCount is < 0 or > 20_000 ||
            !DigestPattern().IsMatch(staging.ExcludedPathSetDigest))
        {
            throw new ArgumentException("Managed review staging is invalid.", nameof(preview));
        }
        var inventory = staging.ChangedInventory.Select(change =>
        {
            var path = ParseWorkspaceRelativePath(JsonSerializer.SerializeToElement(change.Path));
            if (change.Kind is not ("added" or "modified" or "deleted"))
            {
                throw new ArgumentException("Managed changed-file identity is invalid.", nameof(preview));
            }
            var before = change.BeforeDigest is not null || change.BeforeSize.HasValue || change.BeforeMode.HasValue;
            var after = change.AfterDigest is not null || change.AfterSize.HasValue || change.AfterMode.HasValue;
            var completeBefore = change.BeforeDigest is not null && change.BeforeSize.HasValue && change.BeforeMode.HasValue;
            var completeAfter = change.AfterDigest is not null && change.AfterSize.HasValue && change.AfterMode.HasValue;
            if (before != completeBefore || after != completeAfter ||
                (change.Kind == "added" && (before || !after)) ||
                (change.Kind == "deleted" && (!before || after)) ||
                (change.Kind == "modified" && (!before || !after)) ||
                (completeBefore && (!DigestPattern().IsMatch(change.BeforeDigest!) ||
                    change.BeforeSize is < 0 or > MaxSafeProductRevision || change.BeforeMode is < 0 or > 0x1ff)) ||
                (completeAfter && (!DigestPattern().IsMatch(change.AfterDigest!) ||
                    change.AfterSize is < 0 or > MaxSafeProductRevision || change.AfterMode is < 0 or > 0x1ff)))
            {
                throw new ArgumentException("Managed changed-file metadata is invalid.", nameof(preview));
            }
            var body = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["path"] = path,
                ["kind"] = change.Kind,
            };
            if (completeBefore)
            {
                body["beforeDigest"] = change.BeforeDigest;
                body["beforeSize"] = change.BeforeSize;
                body["beforeMode"] = change.BeforeMode;
            }
            if (completeAfter)
            {
                body["afterDigest"] = change.AfterDigest;
                body["afterSize"] = change.AfterSize;
                body["afterMode"] = change.AfterMode;
            }
            return body;
        }).ToArray();
        var inventoryElement = JsonSerializer.SerializeToElement(inventory, StrictJson);
        if (staging.ChangedInventoryDigest != CanonicalDigest(inventoryElement))
        {
            throw new ArgumentException("Managed review changed inventory digest is invalid.", nameof(preview));
        }
        Dictionary<string, object?>? confirmationBody = null;
        if (preview.ApplyConfirmation is { } confirmation)
        {
            if (confirmation.Decision != "apply-exact-reviewed-inventory" ||
                confirmation.ReviewEvidenceId != staging.EvidenceId ||
                confirmation.ReviewEvidenceDigest != staging.EvidenceDigest ||
                confirmation.ChangedInventoryDigest != staging.ChangedInventoryDigest ||
                confirmation.WriteEnvelope.Count > 256 ||
                confirmation.WriteEnvelope.Distinct(StringComparer.Ordinal).Count() != confirmation.WriteEnvelope.Count ||
                confirmation.WriteEnvelope.Zip(
                        confirmation.WriteEnvelope.Skip(1),
                        (left, right) => StringComparer.Ordinal.Compare(left, right) >= 0)
                    .Any(invalid => invalid))
            {
                throw new ArgumentException("Managed review apply confirmation is invalid.", nameof(preview));
            }
            var envelope = confirmation.WriteEnvelope.Select(scope =>
                ParseWorkspaceRelativeScope(JsonSerializer.SerializeToElement(scope))).ToArray();
            var envelopeElement = JsonSerializer.SerializeToElement(envelope);
            if (confirmation.WriteEnvelopeDigest != CanonicalDigest(envelopeElement))
            {
                throw new ArgumentException("Managed review write envelope digest is invalid.", nameof(preview));
            }
            confirmationBody = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["decision"] = "apply-exact-reviewed-inventory",
                ["reviewEvidenceId"] = confirmation.ReviewEvidenceId,
                ["reviewEvidenceDigest"] = confirmation.ReviewEvidenceDigest,
                ["changedInventoryDigest"] = confirmation.ChangedInventoryDigest,
                ["writeEnvelope"] = envelope,
                ["writeEnvelopeDigest"] = confirmation.WriteEnvelopeDigest,
            };
        }
        var body = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-review-preview",
            ["managedRunId"] = preview.ManagedRunId,
            ["managedRunRevision"] = preview.ManagedRunRevision,
            ["runId"] = preview.RunId,
            ["productId"] = preview.ProductId,
            ["initiativeId"] = preview.InitiativeId,
            ["mode"] = "codex-staged",
            ["state"] = preview.State,
            ["canApply"] = preview.CanApply,
            ["canDiscard"] = true,
            ["hasLocalJournal"] = preview.HasLocalJournal,
            ["bindingsDigest"] = preview.BindingsDigest,
            ["result"] = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["resultId"] = result.ResultId,
                ["resultDigest"] = result.ResultDigest,
                ["terminalState"] = result.TerminalState,
                ["providerDisposition"] = result.ProviderDisposition,
                ["outcomeStatus"] = result.OutcomeStatus,
                ["outcomeBasis"] = result.OutcomeBasis,
                ["warningCodes"] = result.WarningCodes,
                ["evidenceId"] = result.EvidenceId,
                ["evidenceDigest"] = result.EvidenceDigest,
            },
            ["staging"] = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["evidenceId"] = staging.EvidenceId,
                ["evidenceDigest"] = staging.EvidenceDigest,
                ["baselineDigest"] = staging.BaselineDigest,
                ["finalDigest"] = staging.FinalDigest,
                ["applyState"] = staging.ApplyState,
                ["changeCount"] = staging.ChangeCount,
                ["changedInventoryLimit"] = 512,
                ["omittedCount"] = 0,
                ["changedInventory"] = inventory,
                ["changedInventoryDigest"] = staging.ChangedInventoryDigest,
                ["excludedPathCount"] = staging.ExcludedPathCount,
                ["excludedPathSetDigest"] = staging.ExcludedPathSetDigest,
            },
            ["postApplyGatePolicy"] = "record-not-assessed",
            ["authorityBoundary"] = ManagedReviewBoundary,
            ["privacyBoundary"] = ManagedReviewPrivacyBoundary,
            ["cleanupBoundary"] = ManagedReviewCleanupBoundary,
        };
        if (confirmationBody is not null) body["applyConfirmation"] = confirmationBody;
        return JsonSerializer.SerializeToElement(body, StrictJson);
    }

    internal static PortableDesignSnapshotPage ParsePageResponse(JsonElement envelope, int expectedOffset, int expectedLimit)
    {
        var result = ReadResult(envelope);
        PageWire wire;
        try
        {
            wire = result.Deserialize<PageWire>(StrictJson)
                ?? throw new InvalidDataException("Portable design page response is empty.");
        }
        catch (JsonException)
        {
            throw InvalidResponse();
        }
        if (wire.Offset != expectedOffset || wire.Limit != expectedLimit || wire.Offset is < 0 or > MaxOffset ||
            wire.Limit is < 1 or > MaxPageSize || wire.Total < 0 || wire.Items is null ||
            wire.Items.Count > wire.Limit || wire.Items.Count > MaxPageSize ||
            (wire.Items.Count > 0 && (long)wire.Offset + wire.Items.Count > wire.Total) ||
            wire.HasMore != ((long)wire.Offset + wire.Items.Count < wire.Total) ||
            wire.GovernanceBoundary != PageGovernanceBoundary || wire.PrivacyBoundary != PagePrivacyBoundary)
        {
            throw InvalidResponse();
        }
        var items = wire.Items.Select(ParseSnapshot).ToArray();
        if (items.Select(item => item.BundleId).Distinct().Count() != items.Length) throw InvalidResponse();
        return new PortableDesignSnapshotPage(
            Array.AsReadOnly(items),
            wire.Offset,
            wire.Limit,
            wire.Total,
            wire.HasMore,
            PageGovernanceBoundary,
            PagePrivacyBoundary);
    }

    internal static EngineHostException HostUnavailable() => new(
        -32_603,
        "HOST_UNAVAILABLE",
        "The GAEP engine host could not complete the request.");

    internal static EngineHostException InvalidResponse() => new(
        -32_603,
        "HOST_RESPONSE_INVALID",
        "The GAEP engine returned a local response that could not be verified.");

    internal static EngineHostException ProductContextChanged() => new(
        -32_031,
        "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
        "The portable design request no longer matches the exact Product revision.");

    private static JsonElement ReadResult(JsonElement envelope)
    {
        if (envelope.ValueKind != JsonValueKind.Object ||
            !envelope.TryGetProperty("jsonrpc", out var jsonRpc) || jsonRpc.GetString() != "2.0")
        {
            throw InvalidResponse();
        }
        if (envelope.TryGetProperty("error", out var error))
        {
            if (!HasOnlyProperties(envelope, "jsonrpc", "id", "error")) throw InvalidResponse();
            throw ParseHostError(error);
        }
        if (!HasOnlyProperties(envelope, "jsonrpc", "id", "result") ||
            !envelope.TryGetProperty("result", out var result))
        {
            throw InvalidResponse();
        }
        return result;
    }

    private static EngineHostException ParseHostError(JsonElement error)
    {
        if (error.ValueKind != JsonValueKind.Object || !HasOnlyProperties(error, "code", "message", "data") ||
            !error.TryGetProperty("code", out var codeElement) || !codeElement.TryGetInt32(out var code) ||
            !error.TryGetProperty("message", out var messageElement) || messageElement.ValueKind != JsonValueKind.String ||
            !error.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object ||
            !HasOnlyAllowedProperties(data, "kind", "detail") ||
            !data.TryGetProperty("kind", out var kindElement) || kindElement.ValueKind != JsonValueKind.String)
        {
            return InvalidResponse();
        }
        var rawKind = kindElement.GetString();
        if (rawKind is null || !StableHostErrors.TryGetValue(rawKind, out var stable))
        {
            return new EngineHostException(-32_603, "HOST_ERROR", "The GAEP engine could not complete the request.");
        }
        if (code != stable.Code)
        {
            return InvalidResponse();
        }
        return new EngineHostException(stable.Code, rawKind, stable.Message);
    }

    private static PortableDesignSnapshotSummary ParseSnapshot(SnapshotWire wire)
    {
        if (wire.SchemaVersion != 1 || wire.Kind != SummaryKind ||
            !Guid.TryParseExact(wire.BundleId, "D", out var bundleId) ||
            !Guid.TryParseExact(wire.ProductId, "D", out var productId) || bundleId == Guid.Empty || productId == Guid.Empty ||
            (wire.InitiativeId is not null &&
                (!Guid.TryParseExact(wire.InitiativeId, "D", out var parsedInitiativeId) || parsedInitiativeId == Guid.Empty)) ||
            !ValidTitle(wire.Title) || wire.Governance is null || wire.SourceReview is null || wire.Source is null ||
            wire.Counts is null || wire.Digests is null || wire.Timestamps is null ||
            wire.Governance.State != GovernanceState || !wire.Governance.HumanReviewRequired ||
            wire.Governance.ClaimBoundary != ClaimBoundary || wire.Governance.NonEscalation != NonEscalation ||
            wire.SourceReview.GaepApproval || wire.PrivacyBoundary != SummaryPrivacyBoundary)
        {
            throw InvalidResponse();
        }
        var classification = ParseClassification(wire.Classification);
        var reviewStatus = ParseReviewStatus(wire.SourceReview.Status);
        var expectedClaim = $"{wire.SourceReview.Status} upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness";
        if (wire.SourceReview.ClaimLabel != expectedClaim || wire.Source.Tool is null ||
            wire.Source.Tool.Length is < 1 or > 80 || !ToolPattern().IsMatch(wire.Source.Tool) ||
            wire.Counts.Artifacts is < 1 or > 512 || wire.Counts.NormalizedDesignTokens is < 0 or > 5_000 ||
            wire.Counts.ValidationChecks != 6 || wire.Counts.RecordedLimitations is < 1 or > 32 ||
            !DigestPattern().IsMatch(wire.Digests.Snapshot ?? "") || !DigestPattern().IsMatch(wire.Digests.Evidence ?? "") ||
            !DigestPattern().IsMatch(wire.Digests.Manifest ?? "") || !DigestPattern().IsMatch(wire.Digests.ArtifactInventory ?? "") ||
            !TryParseTimestamp(wire.Timestamps.SourceExportedAt, out var exportedAt) ||
            !TryParseTimestamp(wire.Timestamps.ImportedAt, out var importedAt))
        {
            throw InvalidResponse();
        }
        var exportMethod = ParseExportMethod(wire.Source.ExportMethod);
        Guid? initiativeId = wire.InitiativeId is null ? null : Guid.ParseExact(wire.InitiativeId, "D");
        return new PortableDesignSnapshotSummary(
            1,
            SummaryKind,
            bundleId,
            productId,
            initiativeId,
            wire.Title!,
            classification,
            new PortableDesignGovernanceMetadata(GovernanceState, true, ClaimBoundary, NonEscalation),
            new PortableDesignSourceReviewMetadata(reviewStatus, expectedClaim, false),
            new PortableDesignSourceMetadata(wire.Source.Tool, exportMethod),
            new PortableDesignCounts(
                wire.Counts.Artifacts,
                wire.Counts.NormalizedDesignTokens,
                wire.Counts.ValidationChecks,
                wire.Counts.RecordedLimitations),
            new PortableDesignDigests(
                wire.Digests.Snapshot!,
                wire.Digests.Evidence!,
                wire.Digests.Manifest!,
                wire.Digests.ArtifactInventory!),
            new PortableDesignTimestamps(exportedAt, importedAt),
            SummaryPrivacyBoundary);
    }

    private static AgentReadinessSnapshot ParseAgentSnapshot(AgentSnapshotWire wire, string capabilityDigest)
    {
        if (wire.SchemaVersion != 1 || !ValidPortableText(wire.AdapterId, minimum: 1) ||
            !ValidPortableText(wire.AdapterVersion, minimum: 1) || !ValidPortableText(wire.AgentId, minimum: 1) ||
            !ValidPortableText(wire.AgentLabel, minimum: 1) ||
            (wire.RuntimeVersion is not null && !ValidPortableText(wire.RuntimeVersion)) ||
            wire.ExecutionInterface is not ("cli-jsonl" or "cli-stream-json" or "stdio-rpc" or "managed-in-process" or "unavailable") ||
            wire.InterfaceMaturity is not ("stable" or "beta" or "experimental" or "unknown") ||
            wire.Settings is null || wire.Settings.Count > 256 || wire.Models is null || wire.Models.Count > 512 ||
            wire.Limitations is null || wire.Limitations.Count > 512 || !TryParseTimestamp(wire.ObservedAt, out var observedAt))
        {
            throw InvalidResponse();
        }
        var settings = wire.Settings.Select(ParseAgentSetting).ToArray();
        var models = wire.Models.Select(ParseAgentModel).ToArray();
        if (settings.Select(setting => setting.Key).Distinct(StringComparer.Ordinal).Count() != settings.Length ||
            models.Select(model => model.Id).Distinct(StringComparer.Ordinal).Count() != models.Length ||
            wire.Limitations.Any(limitation => !ValidPortableText(limitation)))
        {
            throw InvalidResponse();
        }
        return new AgentReadinessSnapshot(
            1,
            wire.AdapterId!,
            wire.AdapterVersion!,
            wire.AgentId!,
            wire.AgentLabel!,
            wire.RuntimeVersion,
            wire.Detected,
            wire.ExecutionInterface!,
            wire.InterfaceMaturity!,
            wire.SupportsResume,
            wire.SupportsCancel,
            wire.SupportsCheckpoints,
            wire.SupportsModelDiscovery,
            wire.SupportsToolSelection,
            wire.Settings.Count,
            Array.AsReadOnly(settings),
            Array.AsReadOnly(models),
            Array.AsReadOnly(wire.Limitations.ToArray()!),
            observedAt,
            capabilityDigest);
    }

    private static AgentModelReadiness ParseAgentModel(AgentModelWire wire)
    {
        if (!ValidPortableText(wire.Id, minimum: 1) || !ValidPortableText(wire.Label, minimum: 1) ||
            (wire.Description is not null && !ValidPortableText(wire.Description)) ||
            wire.ContextWindow is <= 0 || wire.ReasoningOptions is null || wire.ReasoningOptions.Count > 64 ||
            wire.InputModalities is null || wire.InputModalities.Count > 32 || !ValidTruthClass(wire.TruthClass) ||
            wire.ReasoningOptions.Any(value => !ValidPortableText(value)) ||
            wire.InputModalities.Any(value => !ValidPortableText(value)))
        {
            throw InvalidResponse();
        }
        return new AgentModelReadiness(wire.Id!, wire.Label!, wire.TruthClass!, wire.Alias);
    }

    private static AgentSelectionSetting ParseAgentSetting(AgentSettingWire wire)
    {
        if (wire.Key is null || !SettingKeyPattern().IsMatch(wire.Key) || !ValidPortableText(wire.Label, minimum: 1) ||
            !ValidPortableText(wire.Description, minimum: 1) ||
            wire.Kind is not ("select" or "boolean" or "number" or "string" or "string-list") ||
            !ValidTruthClass(wire.TruthClass) || (wire.Sensitive && wire.DefaultValue.ValueKind != JsonValueKind.Undefined) ||
            (wire.DefaultValue.ValueKind != JsonValueKind.Undefined && !ValidPortableSettingValue(wire.DefaultValue)) ||
            (wire.Minimum.ValueKind != JsonValueKind.Undefined && wire.Minimum.ValueKind != JsonValueKind.Number) ||
            (wire.Maximum.ValueKind != JsonValueKind.Undefined && wire.Maximum.ValueKind != JsonValueKind.Number) ||
            (wire.Options is not null && (wire.Options.Count > 256 || wire.Options.Any(option =>
                !ValidPortableText(option.Value) || !ValidPortableText(option.Label) ||
                (option.Description is not null && !ValidPortableText(option.Description))))))
        {
            throw InvalidResponse();
        }
        var defaultValue = wire.DefaultValue.ValueKind == JsonValueKind.Undefined
            ? null
            : ParsePortableSettingValue(wire.DefaultValue);
        var options = wire.Options?.Select(option => new AgentSettingOption(
            option.Value!,
            option.Label!,
            option.Description)).ToArray();
        double? minimum = wire.Minimum.ValueKind == JsonValueKind.Undefined ? null : wire.Minimum.GetDouble();
        double? maximum = wire.Maximum.ValueKind == JsonValueKind.Undefined ? null : wire.Maximum.GetDouble();
        if ((minimum.HasValue && !double.IsFinite(minimum.Value)) ||
            (maximum.HasValue && !double.IsFinite(maximum.Value)) ||
            (minimum.HasValue && maximum.HasValue && minimum.Value > maximum.Value))
        {
            throw InvalidResponse();
        }
        return new AgentSelectionSetting(
            wire.Key,
            wire.Label!,
            wire.Description!,
            wire.Kind!,
            wire.Required,
            wire.Sensitive,
            defaultValue,
            options is null ? null : Array.AsReadOnly(options),
            minimum,
            maximum,
            wire.TruthClass!);
    }

    private static bool ValidPortableSettingValue(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.String) return ValidPortableSettingText(value.GetString());
        if (value.ValueKind == JsonValueKind.Number) return value.TryGetDouble(out var number) && double.IsFinite(number);
        if (value.ValueKind is JsonValueKind.True or JsonValueKind.False) return true;
        return value.ValueKind == JsonValueKind.Array && value.GetArrayLength() <= 256 &&
            value.EnumerateArray().All(item => item.ValueKind == JsonValueKind.String &&
                ValidPortableSettingText(item.GetString()));
    }

    private static PortableAgentSettingValue ParsePortableSettingValue(JsonElement value)
    {
        if (!ValidPortableSettingValue(value)) throw InvalidResponse();
        return value.ValueKind switch
        {
            JsonValueKind.String => new PortableAgentText(value.GetString()!),
            JsonValueKind.Number => new PortableAgentNumber(value.GetDouble()),
            JsonValueKind.True => new PortableAgentBoolean(true),
            JsonValueKind.False => new PortableAgentBoolean(false),
            JsonValueKind.Array => new PortableAgentTextList(
                Array.AsReadOnly(value.EnumerateArray().Select(item => item.GetString()!).ToArray())),
            _ => throw InvalidResponse(),
        };
    }

    private static AgentSelection ParseAgentSelection(JsonElement selection)
    {
        if (selection.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                selection,
                "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
                "selectedAt", "capabilityDigest") ||
            !selection.TryGetProperty("schemaVersion", out var schemaVersion) || schemaVersion.GetInt32() != 2 ||
            !TryGetPortableText(selection, "adapterId", out var adapterId) ||
            !TryGetPortableText(selection, "agentId", out var agentId) ||
            !TryGetPortableText(selection, "modelId", out var modelId) ||
            !selection.TryGetProperty("modelTruthClass", out var truthElement) || truthElement.ValueKind != JsonValueKind.String ||
            !ValidTruthClass(truthElement.GetString()) ||
            !selection.TryGetProperty("modelAlias", out var aliasElement) ||
            aliasElement.ValueKind is not (JsonValueKind.True or JsonValueKind.False or JsonValueKind.Null) ||
            !selection.TryGetProperty("settings", out var settingsElement) || settingsElement.ValueKind != JsonValueKind.Object ||
            settingsElement.EnumerateObject().Take(129).Count() > 128 ||
            !selection.TryGetProperty("selectedAt", out var selectedElement) || selectedElement.ValueKind != JsonValueKind.String ||
            !TryParseTimestamp(selectedElement.GetString(), out var selectedAt) ||
            !selection.TryGetProperty("capabilityDigest", out var digestElement) || digestElement.ValueKind != JsonValueKind.String ||
            !DigestPattern().IsMatch(digestElement.GetString() ?? string.Empty))
        {
            throw InvalidResponse();
        }
        var settings = new Dictionary<string, PortableAgentSettingValue>(StringComparer.Ordinal);
        foreach (var property in settingsElement.EnumerateObject())
        {
            if (!ValidPortableSettingKey(property.Name) || !settings.TryAdd(property.Name, ParsePortableSettingValue(property.Value)))
            {
                throw InvalidResponse();
            }
        }
        return new AgentSelection(
            2,
            adapterId!,
            agentId!,
            modelId!,
            truthElement.GetString()!,
            aliasElement.ValueKind == JsonValueKind.Null ? null : aliasElement.GetBoolean(),
            new System.Collections.ObjectModel.ReadOnlyDictionary<string, PortableAgentSettingValue>(settings),
            selectedAt,
            digestElement.GetString()!,
            CanonicalDigest(selection));
    }

    private static AgentRun ParseAgentRun(JsonElement run)
    {
        if (!HasRequiredAndAllowedProperties(
                run,
                ["schemaVersion", "id", "charterId", "productId", "initiativeId", "agent", "state"],
                ["revision", "charterDigest", "providerSessionRef", "startedAt", "endedAt", "previousRunId"]) ||
            run.GetProperty("schemaVersion").GetInt32() != 1)
        {
            throw InvalidResponse();
        }
        long? revision = null;
        if (run.TryGetProperty("revision", out var revisionElement))
        {
            if (!revisionElement.TryGetInt64(out var parsedRevision) || parsedRevision < 1) throw InvalidResponse();
            revision = parsedRevision;
        }
        var state = run.GetProperty("state").GetString() switch
        {
            "prepared" => AgentRunState.Prepared,
            "running" => AgentRunState.Running,
            "paused" => AgentRunState.Paused,
            "completed" => AgentRunState.Completed,
            "failed" => AgentRunState.Failed,
            "cancelled" => AgentRunState.Cancelled,
            "unknown" => AgentRunState.Unknown,
            _ => throw InvalidResponse(),
        };
        return new AgentRun(
            1,
            ParseRequiredGuid(run, "id"),
            revision,
            ParseRequiredGuid(run, "charterId"),
            ParseOptionalDigest(run, "charterDigest"),
            ParseRequiredGuid(run, "productId"),
            ParseRequiredGuid(run, "initiativeId"),
            ParseAgentSelection(run.GetProperty("agent")),
            state,
            ParseOptionalDigest(run, "providerSessionRef"),
            ParseOptionalTimestamp(run, "startedAt"),
            ParseOptionalTimestamp(run, "endedAt"),
            ParseOptionalGuid(run, "previousRunId"));
    }

    private static ManagedReadOnlyGatePreview ParseManagedReadOnlyGate(
        JsonElement gate,
        IReadOnlySet<Guid> stepIds)
    {
        if (!HasRequiredAndAllowedProperties(
                gate,
                ["key", "phase", "criteria", "criteriaDigest"],
                ["stepId"]))
        {
            throw InvalidResponse();
        }
        var phase = ParseRequiredEnum(
            gate,
            "phase",
            "preconditions", "outputs", "evidence", "stop-conditions", "charter-evidence", "charter-stop-conditions");
        Guid? stepId = gate.TryGetProperty("stepId", out var stepElement)
            ? ParseRequiredGuidValue(stepElement)
            : null;
        var charterGate = phase is "charter-evidence" or "charter-stop-conditions";
        if ((charterGate && stepId.HasValue) || (!charterGate && !stepId.HasValue) ||
            (stepId.HasValue && !stepIds.Contains(stepId.Value)) ||
            !gate.TryGetProperty("criteria", out var criteriaElement) ||
            criteriaElement.ValueKind != JsonValueKind.Array || criteriaElement.GetArrayLength() > 256)
        {
            throw InvalidResponse();
        }
        var criteria = criteriaElement.EnumerateArray().Select(item => ParseHandoffText(item, 1, 2_000)).ToArray();
        var criteriaDigest = ParseRequiredDigest(gate, "criteriaDigest");
        if (criteriaDigest != CanonicalDigest(criteriaElement)) throw InvalidResponse();
        return new ManagedReadOnlyGatePreview(
            ParseHandoffText(gate.GetProperty("key"), 1, 500),
            stepId,
            phase,
            Array.AsReadOnly(criteria),
            criteriaDigest);
    }

    private static JsonElement BuildManagedReadOnlyPreviewBody(ManagedReadOnlyPreview preview)
    {
        if (preview.SchemaVersion != 1 || preview.Kind != "managed-readonly-preview" ||
            preview.AuthorityBoundary != ManagedPreviewBoundary || preview.ProductId == Guid.Empty ||
            preview.InitiativeId == Guid.Empty || preview.CharterId == Guid.Empty ||
            preview.WorkflowPlanId == Guid.Empty || !DigestPattern().IsMatch(preview.CharterDigest) ||
            !DigestPattern().IsMatch(preview.WorkflowPlanDigest) || !DigestPattern().IsMatch(preview.SelectionDigest) ||
            !DigestPattern().IsMatch(preview.PreviewDigest) || !ValidPortableText(preview.AdapterId, minimum: 1) ||
            !ValidPortableText(preview.AgentId, minimum: 1) || !ValidPortableText(preview.ModelId, minimum: 1) ||
            preview.Strategy is not ("sequential" or "parallel-readonly") || preview.StepIds.Count is < 1 or > 512 ||
            preview.StepIds.Any(stepId => stepId == Guid.Empty) || preview.StepIds.Distinct().Count() != preview.StepIds.Count ||
            preview.ContextPackCount is < 0 or > 512 || preview.ReadScopeCount is < 0 or > 100_000 ||
            preview.Gates.Count is < 2 or > 2_050 ||
            preview.Gates.Select(gate => gate.Key).Distinct(StringComparer.Ordinal).Count() != preview.Gates.Count)
        {
            throw new ArgumentException("Managed read-only preview is invalid.", nameof(preview));
        }
        var stepIds = preview.StepIds.ToHashSet();
        var gates = preview.Gates.Select(gate =>
        {
            var charterGate = gate.Phase is "charter-evidence" or "charter-stop-conditions";
            if (gate.Phase is not ("preconditions" or "outputs" or "evidence" or "stop-conditions" or
                    "charter-evidence" or "charter-stop-conditions") ||
                (charterGate && gate.StepId.HasValue) || (!charterGate && !gate.StepId.HasValue) ||
                (gate.StepId.HasValue && (gate.StepId == Guid.Empty || !stepIds.Contains(gate.StepId.Value))) ||
                gate.Criteria.Count > 256)
            {
                throw new ArgumentException("Managed read-only preview gate binding is invalid.", nameof(preview));
            }
            var key = ValidateHandoffText(gate.Key, "Managed gate key", 1, 500);
            var criteria = gate.Criteria.Select(criterion =>
                ValidateHandoffText(criterion, "Managed gate criterion", 1, 2_000)).ToArray();
            var criteriaElement = JsonSerializer.SerializeToElement(criteria);
            if (!DigestPattern().IsMatch(gate.CriteriaDigest) || gate.CriteriaDigest != CanonicalDigest(criteriaElement))
            {
                throw new ArgumentException("Managed read-only preview gate digest is invalid.", nameof(preview));
            }
            var body = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["key"] = key,
                ["phase"] = gate.Phase,
                ["criteria"] = criteria,
                ["criteriaDigest"] = gate.CriteriaDigest,
            };
            if (gate.StepId.HasValue) body["stepId"] = gate.StepId.Value;
            return body;
        }).ToArray();
        var body = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-readonly-preview",
            ["productId"] = preview.ProductId,
            ["initiativeId"] = preview.InitiativeId,
            ["charterId"] = preview.CharterId,
            ["charterDigest"] = preview.CharterDigest,
            ["workflowPlanId"] = preview.WorkflowPlanId,
            ["workflowPlanDigest"] = preview.WorkflowPlanDigest,
            ["adapterId"] = preview.AdapterId,
            ["agentId"] = preview.AgentId,
            ["modelId"] = preview.ModelId,
            ["selectionDigest"] = preview.SelectionDigest,
            ["strategy"] = preview.Strategy,
            ["stepIds"] = preview.StepIds,
            ["contextPackCount"] = preview.ContextPackCount,
            ["readScopeCount"] = preview.ReadScopeCount,
            ["gates"] = gates,
            ["authorityBoundary"] = ManagedPreviewBoundary,
        };
        return JsonSerializer.SerializeToElement(body);
    }

    private static string CanonicalDigest(JsonElement value)
    {
        using var output = new MemoryStream();
        using (var writer = new Utf8JsonWriter(
                   output,
                   new JsonWriterOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping }))
        {
            WriteCanonicalJson(writer, value);
        }
        return $"sha256:{Convert.ToHexString(SHA256.HashData(output.ToArray())).ToLowerInvariant()}";
    }

    private static void WriteCanonicalJson(Utf8JsonWriter writer, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var property in value.EnumerateObject().OrderBy(property => property.Name, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(property.Name);
                    WriteCanonicalJson(writer, property.Value);
                }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in value.EnumerateArray()) WriteCanonicalJson(writer, item);
                writer.WriteEndArray();
                break;
            default:
                value.WriteTo(writer);
                break;
        }
    }

    private static HandoffWorkspaceBaseline ParseHandoffWorkspaceBaseline(JsonElement baseline)
    {
        if (!HasRequiredAndAllowedProperties(
                baseline,
                ["dirty", "changedFiles"],
                ["gitHead", "truthClass", "observationError"]) ||
            !baseline.TryGetProperty("dirty", out var dirtyElement) ||
            dirtyElement.ValueKind is not (JsonValueKind.True or JsonValueKind.False or JsonValueKind.Null) ||
            !baseline.TryGetProperty("changedFiles", out var changedElement) ||
            changedElement.ValueKind != JsonValueKind.Array || changedElement.GetArrayLength() > 20_000)
        {
            throw InvalidResponse();
        }
        string? gitHead = null;
        if (baseline.TryGetProperty("gitHead", out var headElement))
        {
            gitHead = headElement.ValueKind == JsonValueKind.String ? headElement.GetString() : null;
            if (gitHead is null || !GitHeadPattern().IsMatch(gitHead)) throw InvalidResponse();
        }
        string? truthClass = null;
        if (baseline.TryGetProperty("truthClass", out var truthElement))
        {
            truthClass = truthElement.ValueKind == JsonValueKind.String ? truthElement.GetString() : null;
            if (!ValidTruthClass(truthClass)) throw InvalidResponse();
        }
        string? observationError = null;
        if (baseline.TryGetProperty("observationError", out var errorElement))
        {
            observationError = ParseHandoffText(errorElement, 1, 500);
        }
        var changedFiles = changedElement.EnumerateArray().Select(ParseWorkspaceRelativePath).ToArray();
        if (changedFiles.Distinct(StringComparer.Ordinal).Count() != changedFiles.Length) throw InvalidResponse();
        return new HandoffWorkspaceBaseline(
            gitHead,
            dirtyElement.ValueKind == JsonValueKind.Null ? null : dirtyElement.GetBoolean(),
            Array.AsReadOnly(changedFiles),
            truthClass,
            observationError);
    }

    private static IReadOnlyList<string> ParseHandoffTextArray(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() > 512) throw InvalidResponse();
        return Array.AsReadOnly(value.EnumerateArray().Select(item => ParseHandoffText(item, 1)).ToArray());
    }

    private static string ParseHandoffText(JsonElement value, int minimum, int maximum = 5_000)
    {
        if (value.ValueKind != JsonValueKind.String) throw InvalidResponse();
        var text = value.GetString();
        if (text is null || text != text.Trim() || text.Length < minimum || text.Length > maximum ||
            text.Any(char.IsControl) || HandoffPathPattern().IsMatch(text) || SecretPattern().IsMatch(text))
        {
            throw InvalidResponse();
        }
        return text;
    }

    private static string ParseWorkspaceRelativePath(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.String) throw InvalidResponse();
        var path = value.GetString();
        if (path is null || path.Length is < 1 or > 4_096 || path == "." || path.StartsWith("/", StringComparison.Ordinal) ||
            DrivePrefixPattern().IsMatch(path) || path.StartsWith('~') || path.Contains('\\') || path.Contains('\0') ||
            EncodedDotPattern().IsMatch(path))
        {
            throw InvalidResponse();
        }
        var segments = path.Split('/');
        if (segments.Any(segment => segment is "" or "." or "..")) throw InvalidResponse();
        return path;
    }

    private static string ParseWorkspaceRelativeScope(JsonElement value) =>
        value.ValueKind == JsonValueKind.String && value.GetString() == "."
            ? "."
            : ParseWorkspaceRelativePath(value);

    private static Guid ParseRequiredGuid(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String ||
            !Guid.TryParseExact(value.GetString(), "D", out var parsed) || parsed == Guid.Empty)
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    private static Guid ParseRequiredGuidValue(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.String ||
            !Guid.TryParseExact(value.GetString(), "D", out var parsed) || parsed == Guid.Empty)
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    private static string ParseRequiredDigest(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String ||
            !DigestPattern().IsMatch(value.GetString() ?? string.Empty))
        {
            throw InvalidResponse();
        }
        return value.GetString()!;
    }

    private static string ParseRequiredPortableText(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String ||
            !ValidPortableText(value.GetString(), minimum: 1))
        {
            throw InvalidResponse();
        }
        return value.GetString()!;
    }

    private static string ParseRequiredEnum(JsonElement element, string name, params string[] values)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String ||
            value.GetString() is not { } parsed || !values.Contains(parsed, StringComparer.Ordinal))
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    private static int ParseBoundedNonNegativeInt(JsonElement element, string name, int maximum)
    {
        if (!element.TryGetProperty(name, out var value) || !value.TryGetInt32(out var parsed) ||
            parsed < 0 || parsed > maximum)
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    private static long ParseBoundedNonNegativeLong(JsonElement element, string name, long maximum)
    {
        if (!element.TryGetProperty(name, out var value) || !value.TryGetInt64(out var parsed) ||
            parsed < 0 || parsed > maximum)
        {
            throw InvalidResponse();
        }
        return parsed;
    }

    private static long ParsePositiveLong(JsonElement element, string name)
    {
        var value = ParseBoundedNonNegativeLong(element, name, MaxSafeProductRevision);
        return value < 1 ? throw InvalidResponse() : value;
    }

    private static bool ParseRequiredBoolean(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) ||
            value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            throw InvalidResponse();
        }
        return value.GetBoolean();
    }

    private static DateTimeOffset ParseRequiredTimestamp(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String ||
            !TryParseTimestamp(value.GetString(), out var timestamp))
        {
            throw InvalidResponse();
        }
        return timestamp;
    }

    private static Guid? ParseOptionalGuid(JsonElement element, string name) =>
        element.TryGetProperty(name, out _) ? ParseRequiredGuid(element, name) : null;

    private static string? ParseOptionalDigest(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind != JsonValueKind.String || !DigestPattern().IsMatch(value.GetString() ?? string.Empty))
        {
            throw InvalidResponse();
        }
        return value.GetString();
    }

    private static DateTimeOffset? ParseOptionalTimestamp(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind != JsonValueKind.String || !TryParseTimestamp(value.GetString(), out var timestamp))
        {
            throw InvalidResponse();
        }
        return timestamp;
    }

    private static bool PortableSettingValuesEqual(PortableAgentSettingValue left, PortableAgentSettingValue right) =>
        (left, right) switch
        {
            (PortableAgentText leftText, PortableAgentText rightText) => leftText.Value == rightText.Value,
            (PortableAgentNumber leftNumber, PortableAgentNumber rightNumber) => leftNumber.Value.Equals(rightNumber.Value),
            (PortableAgentBoolean leftBoolean, PortableAgentBoolean rightBoolean) => leftBoolean.Value == rightBoolean.Value,
            (PortableAgentTextList leftList, PortableAgentTextList rightList) =>
                leftList.Value.SequenceEqual(rightList.Value, StringComparer.Ordinal),
            _ => false,
        };

    private static bool ValidTruthClass(string? value) =>
        value is "observed" or "provider-declared" or "configured" or "inferred" or "unknown";

    private static bool ValidPortableText(string? value, int minimum = 0, int maximum = 20_000) =>
        value is not null && value.Length >= minimum && value.Length <= maximum && !value.Any(char.IsControl) &&
        !AbsolutePathPattern().IsMatch(value.Trim()) && !PrivatePathPattern().IsMatch(value) && !SecretPattern().IsMatch(value);

    private static bool ValidPortableSettingText(string? value, int minimum = 0) =>
        value is not null && value.Length >= minimum && value.Length <= 10_000 && !value.Any(char.IsControl) &&
        !PortableSettingPathPattern().IsMatch(value) && !SecretPattern().IsMatch(value) &&
        !SecretEnvironmentSettingPattern().IsMatch(value);

    private static bool ValidPortableSettingKey(string key) =>
        SettingKeyPattern().IsMatch(key) && !SecretSettingKeyPattern().IsMatch(key) &&
        !key.Equals("secret", StringComparison.OrdinalIgnoreCase) && !key.Equals("token", StringComparison.OrdinalIgnoreCase);

    private static bool TryGetPortableText(JsonElement element, string propertyName, out string? value)
    {
        value = null;
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String) return false;
        value = property.GetString();
        return ValidPortableText(value, minimum: 1);
    }

    private static object SerializePortableAgentSettingValue(PortableAgentSettingValue value) => value switch
    {
        PortableAgentText text when ValidPortableSettingText(text.Value) => text.Value,
        PortableAgentNumber number when double.IsFinite(number.Value) => number.Value,
        PortableAgentBoolean boolean => boolean.Value,
        PortableAgentTextList list when list.Value.Count <= 256 && list.Value.All(item => ValidPortableSettingText(item)) =>
            list.Value.ToArray(),
        _ => throw new ArgumentException(
            "Agent settings must contain only verified portable, non-secret values.",
            nameof(value)),
    };

    private static void ValidateAgentSnapshotShape(JsonElement snapshot)
    {
        if (snapshot.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                snapshot,
                [
                    "schemaVersion", "adapterId", "adapterVersion", "agentId", "agentLabel", "detected",
                    "executionInterface", "interfaceMaturity", "supportsResume", "supportsCancel", "supportsCheckpoints",
                    "supportsModelDiscovery", "supportsToolSelection", "settings", "models", "limitations", "observedAt",
                ],
                ["runtimeVersion"]))
        {
            throw InvalidResponse();
        }
        if (!snapshot.TryGetProperty("settings", out var settings) || settings.ValueKind != JsonValueKind.Array ||
            !snapshot.TryGetProperty("models", out var models) || models.ValueKind != JsonValueKind.Array ||
            !snapshot.TryGetProperty("limitations", out var limitations) || limitations.ValueKind != JsonValueKind.Array)
        {
            throw InvalidResponse();
        }
        foreach (var setting in settings.EnumerateArray())
        {
            if (!HasRequiredAndAllowedProperties(
                    setting,
                    ["key", "label", "description", "kind", "required", "sensitive", "truthClass"],
                    ["defaultValue", "options", "minimum", "maximum"])) throw InvalidResponse();
            if (setting.TryGetProperty("options", out var options))
            {
                if (options.ValueKind != JsonValueKind.Array) throw InvalidResponse();
                foreach (var option in options.EnumerateArray())
                {
                    if (!HasRequiredAndAllowedProperties(option, ["value", "label"], ["description"])) throw InvalidResponse();
                }
            }
        }
        foreach (var model in models.EnumerateArray())
        {
            if (!HasRequiredAndAllowedProperties(
                    model,
                    ["id", "label", "reasoningOptions", "inputModalities", "truthClass", "alias"],
                    ["description", "contextWindow"])) throw InvalidResponse();
        }
    }

    private static PortableDesignClassification ParseClassification(string? value) => value switch
    {
        "public" => PortableDesignClassification.Public,
        "internal" => PortableDesignClassification.Internal,
        "confidential" => PortableDesignClassification.Confidential,
        "restricted" => PortableDesignClassification.Restricted,
        _ => throw InvalidResponse(),
    };

    private static PortableDesignSourceReviewStatus ParseReviewStatus(string? value) => value switch
    {
        "unreviewed" => PortableDesignSourceReviewStatus.Unreviewed,
        "reviewed" => PortableDesignSourceReviewStatus.Reviewed,
        "approved" => PortableDesignSourceReviewStatus.Approved,
        _ => throw InvalidResponse(),
    };

    private static PortableDesignExportMethod ParseExportMethod(string? value) => value switch
    {
        "manual-export" => PortableDesignExportMethod.ManualExport,
        "design-tool-export" => PortableDesignExportMethod.DesignToolExport,
        "plugin-export" => PortableDesignExportMethod.PluginExport,
        _ => throw InvalidResponse(),
    };

    private static bool ValidTitle(string? value) => value is not null && value.Length is >= 2 and <= 240 &&
        value == value.Trim() && !value.Any(char.IsControl);

    private static bool TryParseTimestamp(string? value, out DateTimeOffset timestamp) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out timestamp);

    private static bool HasOnlyProperties(JsonElement element, params string[] names)
    {
        var allowed = names.ToHashSet(StringComparer.Ordinal);
        var count = 0;
        foreach (var property in element.EnumerateObject())
        {
            count++;
            if (!allowed.Contains(property.Name)) return false;
        }
        return count == allowed.Count;
    }

    private static bool HasOnlyAllowedProperties(JsonElement element, params string[] names)
    {
        var allowed = names.ToHashSet(StringComparer.Ordinal);
        var actual = element.EnumerateObject().Select(property => property.Name).ToArray();
        return actual.Distinct(StringComparer.Ordinal).Count() == actual.Length && actual.All(allowed.Contains);
    }

    private static bool HasRequiredAndAllowedProperties(
        JsonElement element,
        IReadOnlyCollection<string> required,
        IReadOnlyCollection<string> optional)
    {
        if (element.ValueKind != JsonValueKind.Object) return false;
        var allowed = required.Concat(optional).ToHashSet(StringComparer.Ordinal);
        var actual = element.EnumerateObject().Select(property => property.Name).ToArray();
        return actual.Distinct(StringComparer.Ordinal).Count() == actual.Length &&
            required.All(name => actual.Contains(name, StringComparer.Ordinal)) && actual.All(allowed.Contains);
    }

    private static bool IsNetworkPath(string path)
    {
        if (path.StartsWith("//", StringComparison.Ordinal) || path.StartsWith("\\\\", StringComparison.Ordinal)) return true;
        return Uri.TryCreate(path, UriKind.Absolute, out var uri) && !uri.IsFile;
    }

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:@+-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex ActorIdPattern();

    [GeneratedRegex("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex ToolPattern();

    [GeneratedRegex("^sha256:[0-9a-f]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex DigestPattern();

    [GeneratedRegex("^[a-z][a-zA-Z0-9]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex SettingKeyPattern();

    [GeneratedRegex(@"^(?:/[^\s]*|[A-Za-z]:[\\/][^\s]*|\\\\[^\s]*|file://[^\s]*)$", RegexOptions.CultureInvariant)]
    private static partial Regex AbsolutePathPattern();

    [GeneratedRegex(@"^(?:/|[A-Za-z]:[\\/]|\\\\|file://|~[\\/])", RegexOptions.CultureInvariant)]
    private static partial Regex PortableSettingPathPattern();

    [GeneratedRegex(@"(?:^|[\s(=""'])(?:/(?:Users|home|tmp|private|Volumes)/[^\s""'<>)]*|[A-Za-z]:\\[^\s""'<>)]*|\\\\[^\s""'<>)]*)", RegexOptions.CultureInvariant)]
    private static partial Regex PrivatePathPattern();

    [GeneratedRegex(@"(?:^|[\s(=""'])(?:~[\\/]|/(?!/)[^\s""'<>)]*|[A-Za-z]:[\\/][^\s""'<>)]*|\\\\[^\s""'<>)]*|file://[^\s""'<>)]*)", RegexOptions.CultureInvariant)]
    private static partial Regex HandoffPathPattern();

    [GeneratedRegex("^[0-9a-fA-F]{7,64}$", RegexOptions.CultureInvariant)]
    private static partial Regex GitHeadPattern();

    [GeneratedRegex("^[A-Za-z]:", RegexOptions.CultureInvariant)]
    private static partial Regex DrivePrefixPattern();

    [GeneratedRegex("%2e", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex EncodedDotPattern();

    [GeneratedRegex("token|password|passwd|secret|signature|credential|api.?key|access.?key|auth", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SensitiveUriComponentPattern();

    [GeneratedRegex(@"\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SecretPattern();

    [GeneratedRegex("(?:apiKey|accessToken|refreshToken|authToken|bearerToken|password|passwd|clientSecret|privateKey|credential)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SecretSettingKeyPattern();

    [GeneratedRegex(@"^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex SecretEnvironmentSettingPattern();

    private sealed class SnapshotWire
    {
        [JsonRequired] public int SchemaVersion { get; init; }
        [JsonRequired] public string? Kind { get; init; }
        [JsonRequired] public string? BundleId { get; init; }
        [JsonRequired] public string? ProductId { get; init; }
        public string? InitiativeId { get; init; }
        [JsonRequired] public string? Title { get; init; }
        [JsonRequired] public string? Classification { get; init; }
        [JsonRequired] public GovernanceWire? Governance { get; init; }
        [JsonRequired] public SourceReviewWire? SourceReview { get; init; }
        [JsonRequired] public SourceWire? Source { get; init; }
        [JsonRequired] public CountsWire? Counts { get; init; }
        [JsonRequired] public DigestsWire? Digests { get; init; }
        [JsonRequired] public TimestampsWire? Timestamps { get; init; }
        [JsonRequired] public string? PrivacyBoundary { get; init; }
    }

    private sealed class AgentSnapshotWire
    {
        [JsonRequired] public int SchemaVersion { get; init; }
        [JsonRequired] public string? AdapterId { get; init; }
        [JsonRequired] public string? AdapterVersion { get; init; }
        [JsonRequired] public string? AgentId { get; init; }
        [JsonRequired] public string? AgentLabel { get; init; }
        public string? RuntimeVersion { get; init; }
        [JsonRequired] public bool Detected { get; init; }
        [JsonRequired] public string? ExecutionInterface { get; init; }
        [JsonRequired] public string? InterfaceMaturity { get; init; }
        [JsonRequired] public bool SupportsResume { get; init; }
        [JsonRequired] public bool SupportsCancel { get; init; }
        [JsonRequired] public bool SupportsCheckpoints { get; init; }
        [JsonRequired] public bool SupportsModelDiscovery { get; init; }
        [JsonRequired] public bool SupportsToolSelection { get; init; }
        [JsonRequired] public List<AgentSettingWire>? Settings { get; init; }
        [JsonRequired] public List<AgentModelWire>? Models { get; init; }
        [JsonRequired] public List<string>? Limitations { get; init; }
        [JsonRequired] public string? ObservedAt { get; init; }
    }

    private sealed class AgentModelWire
    {
        [JsonRequired] public string? Id { get; init; }
        [JsonRequired] public string? Label { get; init; }
        public string? Description { get; init; }
        [JsonRequired] public List<string>? ReasoningOptions { get; init; }
        public long? ContextWindow { get; init; }
        [JsonRequired] public List<string>? InputModalities { get; init; }
        [JsonRequired] public string? TruthClass { get; init; }
        [JsonRequired] public bool Alias { get; init; }
    }

    private sealed class AgentSettingWire
    {
        [JsonRequired] public string? Key { get; init; }
        [JsonRequired] public string? Label { get; init; }
        [JsonRequired] public string? Description { get; init; }
        [JsonRequired] public string? Kind { get; init; }
        [JsonRequired] public bool Required { get; init; }
        [JsonRequired] public bool Sensitive { get; init; }
        public JsonElement DefaultValue { get; init; }
        public List<AgentSettingOptionWire>? Options { get; init; }
        public JsonElement Minimum { get; init; }
        public JsonElement Maximum { get; init; }
        [JsonRequired] public string? TruthClass { get; init; }
    }

    private sealed class AgentSettingOptionWire
    {
        [JsonRequired] public string? Value { get; init; }
        [JsonRequired] public string? Label { get; init; }
        public string? Description { get; init; }
    }

    private sealed class GovernanceWire
    {
        [JsonRequired] public string? State { get; init; }
        [JsonRequired] public bool HumanReviewRequired { get; init; }
        [JsonRequired] public string? ClaimBoundary { get; init; }
        [JsonRequired] public string? NonEscalation { get; init; }
    }

    private sealed class SourceReviewWire
    {
        [JsonRequired] public string? Status { get; init; }
        [JsonRequired] public string? ClaimLabel { get; init; }
        [JsonRequired] public bool GaepApproval { get; init; }
    }

    private sealed class SourceWire
    {
        [JsonRequired] public string? Tool { get; init; }
        [JsonRequired] public string? ExportMethod { get; init; }
    }

    private sealed class CountsWire
    {
        [JsonRequired] public int Artifacts { get; init; }
        [JsonRequired] public int NormalizedDesignTokens { get; init; }
        [JsonRequired] public int ValidationChecks { get; init; }
        [JsonRequired] public int RecordedLimitations { get; init; }
    }

    private sealed class DigestsWire
    {
        [JsonRequired] public string? Snapshot { get; init; }
        [JsonRequired] public string? Evidence { get; init; }
        [JsonRequired] public string? Manifest { get; init; }
        [JsonRequired] public string? ArtifactInventory { get; init; }
    }

    private sealed class TimestampsWire
    {
        [JsonRequired] public string? SourceExportedAt { get; init; }
        [JsonRequired] public string? ImportedAt { get; init; }
    }

    private sealed class PageWire
    {
        [JsonRequired] public List<SnapshotWire>? Items { get; init; }
        [JsonRequired] public int Offset { get; init; }
        [JsonRequired] public int Limit { get; init; }
        [JsonRequired] public int Total { get; init; }
        [JsonRequired] public bool HasMore { get; init; }
        [JsonRequired] public string? GovernanceBoundary { get; init; }
        [JsonRequired] public string? PrivacyBoundary { get; init; }
    }
}
