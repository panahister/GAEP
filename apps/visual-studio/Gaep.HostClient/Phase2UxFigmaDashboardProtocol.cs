using System.Text.Json;
using System.Text.RegularExpressions;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string Phase2UxFigmaSourceBoundary =
        "current-governed-product-initiative-and-phase-2-projections-only";
    private const string Phase2UxFigmaPrivacyBoundary =
        "dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions";
    private const string Phase2UxFigmaAuthorityBoundary =
        "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority";
    private static readonly Regex Phase2DashboardState = new(
        "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.CultureInvariant,
        TimeSpan.FromMilliseconds(100));

    private static readonly (string Id, string Title, string Group, string ProjectionKind)[] Phase2DashboardSources =
    [
        ("design-applicability", "Design applicability", "experience", "design-applicability-projection"),
        ("design-personas-roles", "Design personas and roles", "experience", "design-persona-role-projection"),
        ("user-journeys", "User journeys", "experience", "user-journey-model-projection"),
        ("information-architecture", "Information architecture", "experience", "information-architecture-model-projection"),
        ("screen-state-inventory", "Screen and state inventory", "experience", "screen-state-inventory-projection"),
        ("design-requirements", "Design requirements", "design-system", "design-requirements-projection"),
        ("design-system-token-contract", "Design system and token contract", "design-system", "design-system-token-contract-projection"),
        ("accessibility-design-rules", "Accessibility design rules", "design-system", "accessibility-design-rules-projection"),
        ("responsive-multi-platform-targets", "Responsive and multi-platform targets", "design-system", "responsive-multi-platform-targets-projection"),
        ("manual-figma-execution-path", "Manual Figma execution path", "figma-exchange", "manual-figma-execution-path-projection"),
        ("figma-mcp-capability-discovery", "Figma MCP capability discovery", "figma-exchange", "figma-mcp-capability-discovery-projection"),
        ("figma-read-snapshot", "Figma read snapshot", "figma-exchange", "figma-read-snapshot-projection"),
        ("figma-context-import", "Figma context import", "figma-exchange", "figma-context-import-projection"),
        ("outbound-design-brief-package", "Outbound design brief package", "figma-exchange", "outbound-design-brief-package-projection"),
        ("governed-figma-write", "Governed Figma write", "figma-exchange", "governed-figma-write-projection"),
        ("finalized-figma-snapshot-import", "Finalized Figma snapshot import", "figma-exchange", "finalized-figma-snapshot-import-projection"),
        ("design-to-requirement-binding", "Design-to-requirement binding", "governance-assurance", "design-to-requirement-binding-projection"),
        ("designer-ready-gate", "Designer-ready gate", "governance-assurance", "designer-ready-gate-projection"),
        ("design-delta", "Design delta", "governance-assurance", "design-delta-projection"),
        ("design-conflict-resolution", "Design conflict resolution", "governance-assurance", "design-conflict-resolution-projection"),
        ("human-design-approval", "Human design approval", "governance-assurance", "human-design-approval-projection"),
        ("design-baseline", "Design baseline", "governance-assurance", "design-baseline-projection"),
        ("design-drift-detection", "Design drift detection", "governance-assurance", "design-drift-detection-projection"),
    ];

    internal static Phase2UxFigmaDashboard ParsePhase2UxFigmaDashboardResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        InitiativeEntryRecord expectedInitiative)
    {
        var dashboard = ReadResult(envelope);
        if (dashboard.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                dashboard,
                "schemaVersion", "kind", "viewDefinitionVersion", "phase", "product", "initiative", "sources",
                "experience", "designSystem", "figma", "governance", "drift", "freshness", "phaseStatus",
                "evidenceCues", "observedAt", "sourceBoundary", "privacyBoundary", "limitations",
                "authorityBoundary", "snapshotDigest") ||
            ParseBoundedNonNegativeInt(dashboard, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(dashboard, "kind", "phase-2-ux-figma-dashboard") != "phase-2-ux-figma-dashboard" ||
            ParseRequiredEnum(dashboard, "viewDefinitionVersion", "gaep-phase-2-ux-figma-dashboard-v1") !=
            "gaep-phase-2-ux-figma-dashboard-v1" ||
            ParseRequiredEnum(dashboard, "sourceBoundary", Phase2UxFigmaSourceBoundary) != Phase2UxFigmaSourceBoundary ||
            ParseRequiredEnum(dashboard, "privacyBoundary", Phase2UxFigmaPrivacyBoundary) != Phase2UxFigmaPrivacyBoundary ||
            ParseRequiredEnum(dashboard, "authorityBoundary", Phase2UxFigmaAuthorityBoundary) != Phase2UxFigmaAuthorityBoundary)
        {
            throw InvalidResponse();
        }

        var phase = dashboard.GetProperty("phase");
        if (phase.ValueKind != JsonValueKind.Object || !HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredEnum(phase, "id", "phase-2-design") != "phase-2-design" ||
            ParseRequiredPortableText(phase, "label") != "Phase 2 — UX and Figma Loop") throw InvalidResponse();

        var product = dashboard.GetProperty("product");
        if (product.ValueKind != JsonValueKind.Object || !HasOnlyProperties(product, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(product, "recordType", "product") != "product") throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "recordId");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        if (productId != expectedProduct.Id || productRevision != expectedProduct.Revision || productDigest != expectedProduct.Digest)
        {
            throw InvalidResponse();
        }

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
        if (sourceElements.ValueKind != JsonValueKind.Array || sourceElements.GetArrayLength() != Phase2DashboardSources.Length)
        {
            throw InvalidResponse();
        }
        var sources = new List<Phase2UxFigmaDashboardSource>(Phase2DashboardSources.Length);
        for (var index = 0; index < Phase2DashboardSources.Length; index++)
        {
            var source = sourceElements[index];
            if (source.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                    source,
                    ["id", "title", "group", "projectionKind", "availability"],
                    ["binding", "assessment"])) throw InvalidResponse();
            var definition = Phase2DashboardSources[index];
            var id = ParseRequiredPortableText(source, "id");
            var title = ParseRequiredPortableText(source, "title");
            var group = ParseRequiredPortableText(source, "group");
            var projectionKind = ParseRequiredPortableText(source, "projectionKind");
            var availability = ParseRequiredEnum(source, "availability", "current", "attention-required", "unavailable");
            if (id != definition.Id || title != definition.Title || group != definition.Group ||
                projectionKind != definition.ProjectionKind || !Phase2DashboardState.IsMatch(projectionKind)) throw InvalidResponse();

            string? assessmentState = null;
            var hasBinding = source.TryGetProperty("binding", out var binding);
            var hasAssessment = source.TryGetProperty("assessment", out var assessment);
            if (availability == "unavailable")
            {
                if (hasBinding || hasAssessment) throw InvalidResponse();
            }
            else
            {
                if (!hasBinding || !hasAssessment || binding.ValueKind != JsonValueKind.Object ||
                    !HasRequiredAndAllowedProperties(binding, ["snapshotDigest", "observedAt", "assessedAt"], ["candidate"]))
                {
                    throw InvalidResponse();
                }
                ParseRequiredDigest(binding, "snapshotDigest");
                ParseRequiredTimestamp(binding, "observedAt");
                ParseRequiredTimestamp(binding, "assessedAt");
                if (binding.TryGetProperty("candidate", out var candidate))
                {
                    if (candidate.ValueKind != JsonValueKind.Object || !HasOnlyProperties(candidate, "recordId", "revision", "digest"))
                    {
                        throw InvalidResponse();
                    }
                    ParseRequiredGuid(candidate, "recordId");
                    ParsePositiveLong(candidate, "revision");
                    ParseRequiredDigest(candidate, "digest");
                }
                if (assessment.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                        assessment,
                        ["state", "reasonCount", "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "attentionRequired"],
                        ["reviewState", "candidateResult"])) throw InvalidResponse();
                assessmentState = ParseRequiredPortableText(assessment, "state");
                if (!Phase2DashboardState.IsMatch(assessmentState)) throw InvalidResponse();
                foreach (var optionalState in new[] { "reviewState", "candidateResult" })
                {
                    if (assessment.TryGetProperty(optionalState, out var stateValue) &&
                        (stateValue.ValueKind != JsonValueKind.String || !Phase2DashboardState.IsMatch(stateValue.GetString()!)))
                    {
                        throw InvalidResponse();
                    }
                }
                ParseBoundedNonNegativeInt(assessment, "reasonCount", 4_096);
                ParseBoundedNonNegativeInt(assessment, "staleBindingCount", int.MaxValue);
                ParseBoundedNonNegativeInt(assessment, "staleSourceReferenceCount", int.MaxValue);
                ParseBoundedNonNegativeInt(assessment, "unresolvedQuestionCount", 4_096);
                if (!assessment.TryGetProperty("attentionRequired", out var attention) ||
                    attention.ValueKind is not (JsonValueKind.True or JsonValueKind.False) ||
                    (availability == "attention-required") != attention.GetBoolean()) throw InvalidResponse();
            }
            sources.Add(new Phase2UxFigmaDashboardSource(id, title, group, projectionKind, availability, assessmentState));
        }

        static IReadOnlyDictionary<string, int> Counts(JsonElement dashboard, string name, params string[] keys)
        {
            var value = dashboard.GetProperty(name);
            if (value.ValueKind != JsonValueKind.Object || !HasOnlyProperties(value, keys)) throw InvalidResponse();
            return keys.ToDictionary(key => key, key => ParseBoundedNonNegativeInt(value, key, 10_000_000), StringComparer.Ordinal);
        }
        var experience = Counts(
            dashboard, "experience", "personaCount", "designRoleCount", "journeyCount", "touchpointCount",
            "informationArchitectureNodeCount", "routeCount", "screenCount", "stateCount", "variantCount");
        var designSystem = Counts(
            dashboard, "designSystem", "requirementCount", "designSystemCount", "tokenCount", "componentCount",
            "accessibilityRuleCount", "accessibilityCheckCount", "platformTargetCount", "breakpointCount");
        var figma = dashboard.GetProperty("figma");
        if (figma.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                figma, "fileCount", "componentCount", "variableCount", "designBindingCount", "humanReviewedBindingCount",
                "unboundDesignItemCount", "connectionState", "writeExecutionState", "importExecutionState")) throw InvalidResponse();
        foreach (var key in new[] { "fileCount", "componentCount", "variableCount", "designBindingCount", "humanReviewedBindingCount", "unboundDesignItemCount" })
        {
            ParseBoundedNonNegativeInt(figma, key, 10_000_000);
        }
        var figmaConnectionState = ParseRequiredEnum(figma, "connectionState", "not-established");
        var figmaWriteExecutionState = ParseRequiredEnum(figma, "writeExecutionState", "not-performed");
        var figmaImportExecutionState = ParseRequiredEnum(figma, "importExecutionState", "not-performed");

        var governance = dashboard.GetProperty("governance");
        if (governance.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                governance, "designerReadyCandidateResult", "humanApprovalCandidateResult", "baselineCandidateResult",
                "baselineDesignationState", "driftCandidateResult", "approvalState", "readinessState", "remediationEffectState"))
        {
            throw InvalidResponse();
        }
        foreach (var key in new[] { "designerReadyCandidateResult", "humanApprovalCandidateResult", "baselineCandidateResult", "driftCandidateResult" })
        {
            if (!Phase2DashboardState.IsMatch(ParseRequiredPortableText(governance, key))) throw InvalidResponse();
        }
        if (ParseRequiredEnum(governance, "baselineDesignationState", "not-established") != "not-established" ||
            ParseRequiredEnum(governance, "approvalState", "not-established") != "not-established" ||
            ParseRequiredEnum(governance, "readinessState", "not-established") != "not-established" ||
            ParseRequiredEnum(governance, "remediationEffectState", "not-applied") != "not-applied") throw InvalidResponse();

        var drift = Counts(
            dashboard, "drift", "observationCount", "requirementToDesignCount", "designToImplementationCount",
            "conformantCount", "driftCount", "unassessedCount", "blockerCount", "highSeverityCount", "remediationCandidateCount");
        var freshness = dashboard.GetProperty("freshness");
        if (freshness.ValueKind != JsonValueKind.Object || !HasRequiredAndAllowedProperties(
                freshness,
                ["state", "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount"],
                ["oldestSourceObservedAt", "newestSourceObservedAt"])) throw InvalidResponse();
        var freshnessState = ParseRequiredEnum(freshness, "state", "current", "attention-required");
        var staleBindingCount = ParseBoundedNonNegativeInt(freshness, "staleBindingCount", 10_000_000);
        var staleSourceReferenceCount = ParseBoundedNonNegativeInt(freshness, "staleSourceReferenceCount", 10_000_000);
        var unresolvedQuestionCount = ParseBoundedNonNegativeInt(freshness, "unresolvedQuestionCount", 10_000_000);
        if (freshness.TryGetProperty("oldestSourceObservedAt", out _)) ParseRequiredTimestamp(freshness, "oldestSourceObservedAt");
        if (freshness.TryGetProperty("newestSourceObservedAt", out _)) ParseRequiredTimestamp(freshness, "newestSourceObservedAt");
        if ((freshnessState == "attention-required") != (staleBindingCount > 0 || staleSourceReferenceCount > 0))
        {
            throw InvalidResponse();
        }

        var phaseStatus = dashboard.GetProperty("phaseStatus");
        if (phaseStatus.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                phaseStatus, "state", "expectedSourceCount", "currentSourceCount", "attentionRequiredSourceCount",
                "unavailableSourceCount", "sourceCatalogDigest", "productOwnerAcceptance", "readinessAuthority",
                "phaseEntryAuthority")) throw InvalidResponse();
        var phaseState = ParseRequiredEnum(phaseStatus, "state", "candidate-complete-for-human-review", "attention-required");
        var expectedSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "expectedSourceCount", 10_000_000);
        var currentSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "currentSourceCount", 10_000_000);
        var attentionRequiredSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "attentionRequiredSourceCount", 10_000_000);
        var unavailableSourceCount = ParseBoundedNonNegativeInt(phaseStatus, "unavailableSourceCount", 10_000_000);
        if (expectedSourceCount != Phase2DashboardSources.Length || currentSourceCount != sources.Count(value => value.Availability == "current") ||
            attentionRequiredSourceCount != sources.Count(value => value.Availability == "attention-required") ||
            unavailableSourceCount != sources.Count(value => value.Availability == "unavailable") ||
            currentSourceCount + attentionRequiredSourceCount + unavailableSourceCount != Phase2DashboardSources.Length ||
            ParseRequiredDigest(phaseStatus, "sourceCatalogDigest") != CanonicalDigest(sourceElements) ||
            ParseRequiredEnum(phaseStatus, "productOwnerAcceptance", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "readinessAuthority", "not-established") != "not-established" ||
            ParseRequiredEnum(phaseStatus, "phaseEntryAuthority", "not-established") != "not-established" ||
            (phaseState == "attention-required") !=
            (attentionRequiredSourceCount > 0 || unavailableSourceCount > 0 || freshnessState == "attention-required"))
        {
            throw InvalidResponse();
        }

        var evidenceCues = dashboard.GetProperty("evidenceCues");
        if (evidenceCues.ValueKind != JsonValueKind.Object || !HasOnlyProperties(evidenceCues, "freshness", "confidence"))
        {
            throw InvalidResponse();
        }
        var expectedEvidenceFreshness = unavailableSourceCount > 0
            ? "unknown"
            : freshnessState == "attention-required" ? "potentially-stale" : "current";
        if (ParseRequiredEnum(evidenceCues, "freshness", "current", "potentially-stale", "unknown") != expectedEvidenceFreshness)
        {
            throw InvalidResponse();
        }
        var confidence = evidenceCues.GetProperty("confidence");
        if (confidence.ValueKind != JsonValueKind.Object || !HasOnlyProperties(confidence, "state", "basis") ||
            ParseRequiredEnum(confidence, "state", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(confidence, "basis", "no-governed-confidence-evaluation-is-bound") !=
            "no-governed-confidence-evaluation-is-bound") throw InvalidResponse();

        ParseRequiredTimestamp(dashboard, "observedAt");
        var limitationsElement = dashboard.GetProperty("limitations");
        if (limitationsElement.ValueKind != JsonValueKind.Array || limitationsElement.GetArrayLength() is < 2 or > 8)
        {
            throw InvalidResponse();
        }
        var limitations = limitationsElement.EnumerateArray().Select(value =>
        {
            if (value.ValueKind != JsonValueKind.String) throw InvalidResponse();
            var text = value.GetString()!;
            if (text.Length is < 4 or > 1_000 || text != text.Trim() || text.Any(char.IsControl)) throw InvalidResponse();
            return text;
        }).ToArray();
        var snapshotDigest = ParseRequiredDigest(dashboard, "snapshotDigest");
        if (snapshotDigest != CanonicalDigest(WithoutProperty(dashboard, "snapshotDigest"))) throw InvalidResponse();

        return new Phase2UxFigmaDashboard(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            phaseState, currentSourceCount, attentionRequiredSourceCount, unavailableSourceCount,
            experience["personaCount"], experience["designRoleCount"], experience["journeyCount"],
            experience["screenCount"], experience["stateCount"], designSystem["requirementCount"],
            designSystem["tokenCount"], designSystem["componentCount"], designSystem["accessibilityRuleCount"],
            ParseBoundedNonNegativeInt(figma, "fileCount", 10_000_000),
            ParseBoundedNonNegativeInt(figma, "designBindingCount", 10_000_000),
            figmaConnectionState, figmaWriteExecutionState, figmaImportExecutionState,
            drift["observationCount"], drift["driftCount"], drift["unassessedCount"], drift["remediationCandidateCount"],
            freshnessState, staleBindingCount, staleSourceReferenceCount, unresolvedQuestionCount,
            Array.AsReadOnly(sources.ToArray()), Array.AsReadOnly(limitations), snapshotDigest);
    }
}
