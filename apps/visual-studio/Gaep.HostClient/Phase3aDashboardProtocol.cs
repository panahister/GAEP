using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string Phase3aSourceBoundary =
        "current-governed-product-initiative-p3a-projections-and-explicit-sealed-local-workflow-evidence-only";
    private const string Phase3aPrivacyBoundary =
        "dashboard-exposes-identities-counts-states-times-and-digests-not-product-design-source-code-provider-output-personal-content-secrets-credentials-permissions-or-private-paths";
    private const string Phase3aAuthorityBoundary =
        "phase-3a-dashboard-is-a-derived-read-only-view-not-completeness-priority-readiness-waiver-ownership-implementation-acceptance-release-deployment-or-action-authority";

    private static readonly (string Id, string Title, string Group, string ProjectionKind)[] Phase3aSources =
    [
        ("backlog-hierarchy", "Backlog hierarchy", "backlog-slice", "backlog-hierarchy-projection"),
        ("mvp-slice-definition", "MVP and slice definition", "backlog-slice", "mvp-slice-definition-projection"),
        ("prioritization-model", "Prioritization model", "backlog-slice", "prioritization-model-projection"),
        ("acceptance-criteria", "Acceptance criteria", "readiness-gap", "acceptance-criteria-projection"),
        ("definition-of-ready", "Definition of Ready", "readiness-gap", "definition-of-ready-projection"),
        ("definition-of-done", "Definition of Done", "readiness-gap", "definition-of-done-projection"),
        ("implementation-unit-model", "Implementation Unit model", "readiness-gap", "implementation-unit-model-projection"),
        ("dependency-mapping", "Dependency mapping", "readiness-gap", "dependency-mapping-projection"),
        ("technology-profile", "Technology profile", "boilerplate-design-code", "technology-profile-projection"),
        ("boilerplate-registry", "Boilerplate registry", "boilerplate-design-code", "boilerplate-registry-projection"),
        ("boilerplate-selection-binding", "Boilerplate selection and binding", "boilerplate-design-code", "boilerplate-selection-binding-projection"),
        ("boilerplate-compatibility-validation", "Boilerplate compatibility validation", "boilerplate-design-code", "boilerplate-compatibility-validation-projection"),
        ("figma-to-boilerplate-mapping", "Figma-to-boilerplate mapping", "boilerplate-design-code", "figma-to-boilerplate-mapping-projection"),
        ("design-to-code-binding-registry", "Design-to-code binding registry", "boilerplate-design-code", "design-to-code-binding-registry-projection"),
        ("route-screen-component-mapping", "Route, screen, and component mapping", "boilerplate-design-code", "route-screen-component-mapping-projection"),
        ("test-methodology", "Test methodology", "readiness-gap", "test-methodology-projection"),
        ("test-inventory", "Test inventory", "readiness-gap", "test-inventory-projection"),
        ("high-level-design", "High-Level Design", "readiness-gap", "high-level-design-projection"),
        ("low-level-design", "Low-Level Design", "readiness-gap", "low-level-design-projection"),
        ("implementation-readiness-gate", "Implementation Readiness Gate", "readiness-gap", "implementation-readiness-gate-projection"),
    ];

    private static readonly (string Id, string Title, string[] SourceIds)[] Phase3aViews =
    [
        ("backlog-slice", "Backlog and slice", ["backlog-hierarchy", "mvp-slice-definition", "prioritization-model"]),
        ("readiness-gap", "Readiness and gaps", ["acceptance-criteria", "definition-of-ready", "definition-of-done", "implementation-unit-model", "dependency-mapping", "boilerplate-compatibility-validation", "test-methodology", "test-inventory", "high-level-design", "low-level-design", "implementation-readiness-gate"]),
        ("boilerplate-design-code", "Boilerplate and design-to-code", ["technology-profile", "boilerplate-registry", "boilerplate-selection-binding", "boilerplate-compatibility-validation", "figma-to-boilerplate-mapping", "design-to-code-binding-registry", "route-screen-component-mapping"]),
        ("change-impact", "Change and impact", ["dependency-mapping", "design-to-code-binding-registry", "route-screen-component-mapping", "high-level-design", "low-level-design", "implementation-readiness-gate"]),
        ("agent-model", "Agent and model", ["implementation-readiness-gate"]),
    ];

    internal static Phase3aDashboard ParsePhase3aDashboardResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        InitiativeEntryRecord expectedInitiative)
    {
        var dashboard = ReadResult(envelope);
        if (dashboard.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                dashboard,
                "schemaVersion", "kind", "viewDefinitionVersion", "phase", "product", "initiative", "sources",
                "views", "workflows", "freshness", "phaseStatus", "pagination", "export", "evidenceCues",
                "observedAt", "sourceBoundary", "privacyBoundary", "limitations", "authorityBoundary", "snapshotDigest") ||
            ParseBoundedNonNegativeInt(dashboard, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(dashboard, "kind", "phase-3a-dashboard") != "phase-3a-dashboard" ||
            ParseRequiredEnum(dashboard, "viewDefinitionVersion", "gaep-phase-3a-dashboard-v1") != "gaep-phase-3a-dashboard-v1" ||
            ParseRequiredEnum(dashboard, "sourceBoundary", Phase3aSourceBoundary) != Phase3aSourceBoundary ||
            ParseRequiredEnum(dashboard, "privacyBoundary", Phase3aPrivacyBoundary) != Phase3aPrivacyBoundary ||
            ParseRequiredEnum(dashboard, "authorityBoundary", Phase3aAuthorityBoundary) != Phase3aAuthorityBoundary)
        {
            throw InvalidResponse();
        }

        var phase = dashboard.GetProperty("phase");
        if (phase.ValueKind != JsonValueKind.Object || !HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredEnum(phase, "id", "phase-3a-readiness") != "phase-3a-readiness" ||
            ParseRequiredPortableText(phase, "label") != "Phase 3A — Backlog and Implementation Readiness") throw InvalidResponse();

        var product = dashboard.GetProperty("product");
        if (product.ValueKind != JsonValueKind.Object || !HasOnlyProperties(product, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(product, "recordType", "product") != "product") throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "recordId");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        if (productId != expectedProduct.Id || productRevision != expectedProduct.Revision || productDigest != expectedProduct.Digest)
            throw InvalidResponse();

        var initiative = dashboard.GetProperty("initiative");
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

        var sourceElements = dashboard.GetProperty("sources");
        if (sourceElements.ValueKind != JsonValueKind.Array || sourceElements.GetArrayLength() != Phase3aSources.Length)
            throw InvalidResponse();
        var sources = new List<Phase3aDashboardSource>(Phase3aSources.Length);
        for (var index = 0; index < Phase3aSources.Length; index++)
        {
            var source = sourceElements[index];
            if (source.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                    source, ["id", "title", "group", "projectionKind", "availability"], ["binding", "assessment"]))
                throw InvalidResponse();
            var definition = Phase3aSources[index];
            var id = ParseRequiredPortableText(source, "id");
            var title = ParseRequiredPortableText(source, "title");
            var group = ParseRequiredPortableText(source, "group");
            var projectionKind = ParseRequiredPortableText(source, "projectionKind");
            var availability = ParseRequiredEnum(source, "availability", "current", "attention-required", "unavailable");
            if (id != definition.Id || title != definition.Title || group != definition.Group || projectionKind != definition.ProjectionKind)
                throw InvalidResponse();
            string? assessmentState = null;
            var gapCount = 0;
            var conflictCount = 0;
            var staleCount = 0;
            var unresolvedCount = 0;
            var hasBinding = source.TryGetProperty("binding", out var binding);
            var hasAssessment = source.TryGetProperty("assessment", out var assessment);
            if (availability == "unavailable")
            {
                if (hasBinding || hasAssessment) throw InvalidResponse();
            }
            else
            {
                if (!hasBinding || !hasAssessment || binding.ValueKind != JsonValueKind.Object ||
                    !HasRequiredAndAllowedProperties(binding, ["snapshotDigest", "observedAt"], ["candidate"])) throw InvalidResponse();
                ParseRequiredDigest(binding, "snapshotDigest");
                ParseRequiredTimestamp(binding, "observedAt");
                if (binding.TryGetProperty("candidate", out var candidate))
                {
                    if (candidate.ValueKind != JsonValueKind.Object || !HasOnlyProperties(candidate, "recordId", "revision", "digest"))
                        throw InvalidResponse();
                    ParseRequiredGuid(candidate, "recordId");
                    ParsePositiveLong(candidate, "revision");
                    ParseRequiredDigest(candidate, "digest");
                }
                if (assessment.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                        assessment,
                        ["state", "reasonCount", "candidateCount", "evidenceReferenceCount", "gapCount", "conflictCount", "staleCount", "unresolvedCount", "attentionRequired"],
                        ["reviewState"])) throw InvalidResponse();
                assessmentState = ParseRequiredPortableText(assessment, "state");
                if (assessment.TryGetProperty("reviewState", out _)) ParseRequiredPortableText(assessment, "reviewState");
                ParseBoundedNonNegativeInt(assessment, "reasonCount", 10_000_000);
                ParseBoundedNonNegativeInt(assessment, "candidateCount", 1);
                ParseBoundedNonNegativeInt(assessment, "evidenceReferenceCount", 10_000_000);
                gapCount = ParseBoundedNonNegativeInt(assessment, "gapCount", 10_000_000);
                conflictCount = ParseBoundedNonNegativeInt(assessment, "conflictCount", 10_000_000);
                staleCount = ParseBoundedNonNegativeInt(assessment, "staleCount", 10_000_000);
                unresolvedCount = ParseBoundedNonNegativeInt(assessment, "unresolvedCount", 10_000_000);
                if (!assessment.TryGetProperty("attentionRequired", out var attention) ||
                    attention.ValueKind is not (JsonValueKind.True or JsonValueKind.False) ||
                    attention.GetBoolean() != (availability == "attention-required")) throw InvalidResponse();
            }
            sources.Add(new Phase3aDashboardSource(
                id, title, group, projectionKind, availability, assessmentState, gapCount, conflictCount, staleCount, unresolvedCount));
        }

        var viewElements = dashboard.GetProperty("views");
        if (viewElements.ValueKind != JsonValueKind.Array || viewElements.GetArrayLength() != Phase3aViews.Length)
            throw InvalidResponse();
        var views = new List<Phase3aDashboardView>(Phase3aViews.Length);
        for (var index = 0; index < Phase3aViews.Length; index++)
        {
            var view = viewElements[index];
            if (view.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                    view, "id", "title", "sourceIds", "state", "currentSourceCount", "attentionRequiredSourceCount",
                    "unavailableSourceCount", "candidateCount", "evidenceReferenceCount", "gapCount", "conflictCount",
                    "staleCount", "unresolvedCount", "workflowEvidenceCount")) throw InvalidResponse();
            var definition = Phase3aViews[index];
            var sourceIds = view.GetProperty("sourceIds");
            if (sourceIds.ValueKind != JsonValueKind.Array ||
                !sourceIds.EnumerateArray().Select(value => value.ValueKind == JsonValueKind.String ? value.GetString() : null)
                    .SequenceEqual(definition.SourceIds)) throw InvalidResponse();
            var id = ParseRequiredPortableText(view, "id");
            var title = ParseRequiredPortableText(view, "title");
            var state = ParseRequiredEnum(view, "state", "current", "attention-required", "unavailable");
            if (id != definition.Id || title != definition.Title) throw InvalidResponse();
            var members = definition.SourceIds.Select(sourceId => sources.Single(source => source.Id == sourceId)).ToArray();
            var current = ParseBoundedNonNegativeInt(view, "currentSourceCount", 20);
            var attention = ParseBoundedNonNegativeInt(view, "attentionRequiredSourceCount", 20);
            var unavailable = ParseBoundedNonNegativeInt(view, "unavailableSourceCount", 20);
            var expectedState = unavailable == members.Length ? "unavailable" : attention > 0 || unavailable > 0 ? "attention-required" : "current";
            if (current != members.Count(source => source.Availability == "current") ||
                attention != members.Count(source => source.Availability == "attention-required") ||
                unavailable != members.Count(source => source.Availability == "unavailable") || state != expectedState) throw InvalidResponse();
            views.Add(new Phase3aDashboardView(
                id, title, state, current, attention, unavailable,
                ParseBoundedNonNegativeInt(view, "candidateCount", 10_000_000),
                ParseBoundedNonNegativeInt(view, "evidenceReferenceCount", 10_000_000),
                ParseBoundedNonNegativeInt(view, "gapCount", 10_000_000),
                ParseBoundedNonNegativeInt(view, "conflictCount", 10_000_000),
                ParseBoundedNonNegativeInt(view, "staleCount", 10_000_000),
                ParseBoundedNonNegativeInt(view, "unresolvedCount", 10_000_000),
                ParseBoundedNonNegativeInt(view, "workflowEvidenceCount", 2)));
        }

        var workflowElements = dashboard.GetProperty("workflows");
        if (workflowElements.ValueKind != JsonValueKind.Array || workflowElements.GetArrayLength() != 2) throw InvalidResponse();
        var workflows = new List<Phase3aDashboardWorkflow>(2);
        string[] providerOrder = ["codex", "claude"];
        for (var index = 0; index < providerOrder.Length; index++)
        {
            var workflow = workflowElements[index];
            if (workflow.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                    workflow, ["provider", "availability", "executionMode", "liveAcceptance", "semanticQuality", "authority"], ["binding"]))
                throw InvalidResponse();
            var provider = ParseRequiredEnum(workflow, "provider", "codex", "claude");
            var availability = ParseRequiredEnum(workflow, "availability", "sealed-local-deterministic", "unavailable");
            if (provider != providerOrder[index] || workflow.TryGetProperty("binding", out _) != (availability == "sealed-local-deterministic") ||
                ParseRequiredEnum(workflow, "executionMode", "offline-deterministic") != "offline-deterministic" ||
                ParseRequiredEnum(workflow, "liveAcceptance", "not-established") != "not-established" ||
                ParseRequiredEnum(workflow, "semanticQuality", "not-assessed") != "not-assessed" ||
                ParseRequiredEnum(workflow, "authority", "not-granted") != "not-granted") throw InvalidResponse();
            if (workflow.TryGetProperty("binding", out var workflowBinding))
            {
                if (workflowBinding.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                        workflowBinding, "product", "initiative", "scenarioId", "receiptDigest", "sourceDigest", "observedAt")) throw InvalidResponse();
                ValidateWorkflowBinding(workflowBinding.GetProperty("product"), productId, productRevision, productDigest);
                ValidateWorkflowBinding(workflowBinding.GetProperty("initiative"), initiativeId, initiativeRevision, initiativeDigest);
                ParseRequiredPortableText(workflowBinding, "scenarioId");
                ParseRequiredDigest(workflowBinding, "receiptDigest");
                ParseRequiredDigest(workflowBinding, "sourceDigest");
                ParseRequiredTimestamp(workflowBinding, "observedAt");
            }
            workflows.Add(new Phase3aDashboardWorkflow(
                provider, availability, "offline-deterministic", "not-established", "not-assessed", "not-granted"));
        }

        var freshness = dashboard.GetProperty("freshness");
        if (freshness.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                freshness, ["state", "staleCount", "unresolvedCount"], ["oldestSourceObservedAt", "newestSourceObservedAt"]))
            throw InvalidResponse();
        var freshnessState = ParseRequiredEnum(freshness, "state", "current", "attention-required", "unknown");
        var staleCountTotal = ParseBoundedNonNegativeInt(freshness, "staleCount", 10_000_000);
        var unresolvedCountTotal = ParseBoundedNonNegativeInt(freshness, "unresolvedCount", 10_000_000);
        if (freshness.TryGetProperty("oldestSourceObservedAt", out _)) ParseRequiredTimestamp(freshness, "oldestSourceObservedAt");
        if (freshness.TryGetProperty("newestSourceObservedAt", out _)) ParseRequiredTimestamp(freshness, "newestSourceObservedAt");

        var phaseStatus = dashboard.GetProperty("phaseStatus");
        if (phaseStatus.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                phaseStatus, "state", "expectedSourceCount", "currentSourceCount", "attentionRequiredSourceCount",
                "unavailableSourceCount", "sourceCatalogDigest", "providerWorkflowEvidenceCount",
                "liveProviderAcceptanceCount", "nativeHostAcceptanceCount", "readinessAuthority", "waiverAuthority",
                "ownershipAuthority", "productOwnerAcceptance")) throw InvalidResponse();
        var phaseState = ParseRequiredEnum(phaseStatus, "state", "candidate-complete-for-human-review", "attention-required");
        var currentSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "currentSourceCount", 20);
        var attentionRequiredSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "attentionRequiredSourceCount", 20);
        var unavailableSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "unavailableSourceCount", 20);
        var providerWorkflowEvidenceCount = ParseBoundedNonNegativeInt(phaseStatus, "providerWorkflowEvidenceCount", 2);
        var requiresAttention = attentionRequiredSourceCount > 0 || unavailableSourceCount > 0 || staleCountTotal > 0 || unresolvedCountTotal > 0;
        if (ParseBoundedNonNegativeInt(phaseStatus, "expectedSourceCount", 20) != 20 ||
            currentSourceCount != sources.Count(source => source.Availability == "current") ||
            attentionRequiredSourceCount != sources.Count(source => source.Availability == "attention-required") ||
            unavailableSourceCount != sources.Count(source => source.Availability == "unavailable") ||
            ParseRequiredDigest(phaseStatus, "sourceCatalogDigest") != CanonicalDigest(sourceElements) ||
            providerWorkflowEvidenceCount != workflows.Count(workflow => workflow.Availability == "sealed-local-deterministic") ||
            ParseBoundedNonNegativeInt(phaseStatus, "liveProviderAcceptanceCount", 0) != 0 ||
            ParseBoundedNonNegativeInt(phaseStatus, "nativeHostAcceptanceCount", 0) != 0 ||
            ParseRequiredEnum(phaseStatus, "readinessAuthority", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "waiverAuthority", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "ownershipAuthority", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "productOwnerAcceptance", "not-established") != "not-established" ||
            (phaseState == "attention-required") != requiresAttention) throw InvalidResponse();

        var pagination = dashboard.GetProperty("pagination");
        if (pagination.ValueKind != JsonValueKind.Object || !HasOnlyProperties(pagination, "offset", "limit", "total", "truncated") ||
            ParseBoundedNonNegativeInt(pagination, "offset", 0) != 0 || ParseBoundedNonNegativeInt(pagination, "limit", 20) != 20 ||
            ParseBoundedNonNegativeInt(pagination, "total", 20) != 20 || !pagination.TryGetProperty("truncated", out var truncated) ||
            truncated.ValueKind != JsonValueKind.False) throw InvalidResponse();
        var export = dashboard.GetProperty("export");
        if (export.ValueKind != JsonValueKind.Object || !HasOnlyProperties(export, "format", "formulaPrefixesNeutralized", "hiddenContentExcluded") ||
            ParseRequiredEnum(export, "format", "csv-visible-metadata-only") != "csv-visible-metadata-only" ||
            !export.TryGetProperty("formulaPrefixesNeutralized", out var neutralized) || neutralized.ValueKind != JsonValueKind.True ||
            !export.TryGetProperty("hiddenContentExcluded", out var hiddenExcluded) || hiddenExcluded.ValueKind != JsonValueKind.True) throw InvalidResponse();
        var evidenceCues = dashboard.GetProperty("evidenceCues");
        if (evidenceCues.ValueKind != JsonValueKind.Object || !HasOnlyProperties(evidenceCues, "freshness", "confidence"))
            throw InvalidResponse();
        ParseRequiredEnum(evidenceCues, "freshness", "current", "potentially-stale", "unknown");
        var confidence = evidenceCues.GetProperty("confidence");
        if (confidence.ValueKind != JsonValueKind.Object || !HasOnlyProperties(confidence, "state", "basis") ||
            ParseRequiredEnum(confidence, "state", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(confidence, "basis", "no-governed-confidence-or-semantic-quality-evaluation-is-bound") !=
            "no-governed-confidence-or-semantic-quality-evaluation-is-bound") throw InvalidResponse();

        var observedAt = ParseRequiredTimestamp(dashboard, "observedAt");
        var limitationElements = dashboard.GetProperty("limitations");
        if (limitationElements.ValueKind != JsonValueKind.Array || limitationElements.GetArrayLength() is < 3 or > 8)
            throw InvalidResponse();
        var limitations = limitationElements.EnumerateArray().Select(value =>
        {
            if (value.ValueKind != JsonValueKind.String) throw InvalidResponse();
            var text = value.GetString()!;
            if (text.Length is < 4 or > 1_000 || text != text.Trim() || text.Any(char.IsControl)) throw InvalidResponse();
            return text;
        }).ToArray();
        var snapshotDigest = ParseRequiredDigest(dashboard, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(dashboard, "snapshotDigest"))) throw InvalidResponse();
        return new Phase3aDashboard(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            phaseState, currentSourceCount, attentionRequiredSourceCount, unavailableSourceCount,
            providerWorkflowEvidenceCount, freshnessState, staleCountTotal, unresolvedCountTotal,
            Array.AsReadOnly(sources.ToArray()), Array.AsReadOnly(views.ToArray()), Array.AsReadOnly(workflows.ToArray()),
            Array.AsReadOnly(limitations), observedAt, snapshotDigest);
    }

    private static void ValidateWorkflowBinding(JsonElement binding, Guid expectedId, long expectedRevision, string expectedDigest)
    {
        if (binding.ValueKind != JsonValueKind.Object || !HasOnlyProperties(binding, "recordId", "revision", "digest") ||
            ParseRequiredGuid(binding, "recordId") != expectedId || ParsePositiveLong(binding, "revision") != expectedRevision ||
            ParseRequiredDigest(binding, "digest") != expectedDigest) throw InvalidResponse();
    }
}
