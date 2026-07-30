using System.Text.Json;

namespace Gaep.HostClient;

internal static partial class PortableDesignProtocol
{
    private const string Phase2IntegratedSourceBoundary =
        "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only";
    private const string Phase2IntegratedPrivacyBoundary =
        "dashboard-exposes-identities-digests-counts-statuses-and-times-not-design-content-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-permissions-or-machine-paths";
    private const string Phase2IntegratedAuthorityBoundary =
        "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority";

    internal static Phase2ChangeImpactAgentModelDashboard ParsePhase2ChangeImpactAgentModelDashboardResponse(
        JsonElement envelope,
        ProductBinding expectedProduct,
        InitiativeEntryRecord expectedInitiative,
        IReadOnlyList<AgentReadinessSnapshot> expectedCapabilities,
        AgentSelectionState expectedSelection)
    {
        var dashboard = ReadResult(envelope);
        if (dashboard.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                dashboard,
                "schemaVersion", "kind", "viewDefinitionVersion", "phase", "product", "initiative", "sources",
                "synchronizationChange", "impact", "agentModel", "freshness", "governance", "evidenceCues",
                "observedAt", "sourceBoundary", "privacyBoundary", "limitations", "authorityBoundary", "snapshotDigest") ||
            ParseBoundedNonNegativeInt(dashboard, "schemaVersion", 1) != 1 ||
            ParseRequiredEnum(dashboard, "kind", "phase-2-change-impact-agent-model-dashboard") !=
            "phase-2-change-impact-agent-model-dashboard" ||
            ParseRequiredEnum(dashboard, "viewDefinitionVersion", "gaep-phase-2-change-impact-agent-model-dashboard-v1") !=
            "gaep-phase-2-change-impact-agent-model-dashboard-v1" ||
            ParseRequiredEnum(dashboard, "sourceBoundary", Phase2IntegratedSourceBoundary) != Phase2IntegratedSourceBoundary ||
            ParseRequiredEnum(dashboard, "privacyBoundary", Phase2IntegratedPrivacyBoundary) != Phase2IntegratedPrivacyBoundary ||
            ParseRequiredEnum(dashboard, "authorityBoundary", Phase2IntegratedAuthorityBoundary) != Phase2IntegratedAuthorityBoundary)
        {
            throw InvalidResponse();
        }
        var phase = dashboard.GetProperty("phase");
        if (phase.ValueKind != JsonValueKind.Object || !HasOnlyProperties(phase, "id", "label") ||
            ParseRequiredEnum(phase, "id", "phase-2-design") != "phase-2-design" ||
            ParseRequiredPortableText(phase, "label") != "Phase 2 — UX and Figma Loop") throw InvalidResponse();

        var product = dashboard.GetProperty("product");
        if (product.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(product, "recordType", "recordId", "revision", "digest") ||
            ParseRequiredEnum(product, "recordType", "product") != "product") throw InvalidResponse();
        var productId = ParseRequiredGuid(product, "recordId");
        var productRevision = ParsePositiveLong(product, "revision");
        var productDigest = ParseRequiredDigest(product, "digest");
        if (productId != expectedProduct.Id || productRevision != expectedProduct.Revision ||
            productDigest != expectedProduct.Digest) throw InvalidResponse();

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

        var sources = dashboard.GetProperty("sources");
        if (sources.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(sources, "phase2UxFigmaSnapshotDigest", "phase2SourceCatalogDigest", "agentModelSnapshotDigest"))
        {
            throw InvalidResponse();
        }
        var phase2Digest = ParseRequiredDigest(sources, "phase2UxFigmaSnapshotDigest");
        var sourceCatalogDigest = ParseRequiredDigest(sources, "phase2SourceCatalogDigest");
        var agentModelDigest = ParseRequiredDigest(sources, "agentModelSnapshotDigest");

        var synchronizationElement = dashboard.GetProperty("synchronizationChange");
        if (synchronizationElement.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                synchronizationElement,
                "state", "designDelta", "conflictResolution", "humanDesignApproval", "designBaseline",
                "designDriftDetection", "figmaConnectionState", "figmaWriteExecutionState",
                "figmaImportExecutionState", "synchronizationEffectState")) throw InvalidResponse();
        string Availability(string name) => ParseRequiredEnum(
            synchronizationElement, name, "current", "attention-required", "unavailable");
        var synchronization = new Phase2IntegratedSynchronization(
            ParseRequiredEnum(synchronizationElement, "state", "candidate-current", "attention-required"),
            Availability("designDelta"), Availability("conflictResolution"), Availability("humanDesignApproval"),
            Availability("designBaseline"), Availability("designDriftDetection"),
            ParseRequiredEnum(synchronizationElement, "figmaConnectionState", "not-established"),
            ParseRequiredEnum(synchronizationElement, "figmaWriteExecutionState", "not-performed"),
            ParseRequiredEnum(synchronizationElement, "figmaImportExecutionState", "not-performed"),
            ParseRequiredEnum(synchronizationElement, "synchronizationEffectState", "not-applied"));
        var changeAttention = new[]
        {
            synchronization.DesignDelta, synchronization.ConflictResolution, synchronization.HumanDesignApproval,
            synchronization.DesignBaseline, synchronization.DesignDriftDetection,
        }.Any(value => value != "current");
        if ((synchronization.State == "attention-required") != changeAttention) throw InvalidResponse();

        var impactElement = dashboard.GetProperty("impact");
        if (impactElement.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                impactElement,
                "state", "coverage", "requirementCount", "designBindingCount", "unboundDesignItemCount",
                "driftObservationCount", "driftCount", "unassessedCount", "blockerCount", "highSeverityCount",
                "remediationCandidateCount", "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount",
                "impactCompleteness", "designValidity", "revalidationState") ||
            ParseRequiredEnum(impactElement, "coverage", "bounded-not-complete") != "bounded-not-complete" ||
            ParseRequiredEnum(impactElement, "impactCompleteness", "not-established") != "not-established" ||
            ParseRequiredEnum(impactElement, "designValidity", "not-established") != "not-established" ||
            ParseRequiredEnum(impactElement, "revalidationState", "not-established") != "not-established")
        {
            throw InvalidResponse();
        }
        long Count(JsonElement value, string name) => ParseBoundedNonNegativeLong(value, name, 10_000_000);
        var impact = new Phase2IntegratedImpact(
            ParseRequiredEnum(impactElement, "state", "current-bounded-observation", "attention-required"),
            Count(impactElement, "requirementCount"), Count(impactElement, "designBindingCount"),
            Count(impactElement, "unboundDesignItemCount"), Count(impactElement, "driftObservationCount"),
            Count(impactElement, "driftCount"), Count(impactElement, "unassessedCount"),
            Count(impactElement, "blockerCount"), Count(impactElement, "highSeverityCount"),
            Count(impactElement, "remediationCandidateCount"), Count(impactElement, "staleBindingCount"),
            Count(impactElement, "staleSourceReferenceCount"), Count(impactElement, "unresolvedQuestionCount"));
        var impactAttention = impact.DriftCount > 0 || impact.UnassessedCount > 0 || impact.StaleBindingCount > 0 ||
            impact.StaleSourceReferenceCount > 0 || impact.UnresolvedQuestionCount > 0;
        if (impact.DriftCount + impact.UnassessedCount > impact.DriftObservationCount ||
            (impact.State == "attention-required") != impactAttention) throw InvalidResponse();

        var agent = dashboard.GetProperty("agentModel");
        if (agent.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                agent, "selectionState", "capabilities", "runs", "managedRuns", "handoffs", "providerMetrics",
                "liveProviderQuality", "semanticOutputQuality")) throw InvalidResponse();
        var expectedSelectionState = expectedSelection.Status switch
        {
            AgentSelectionStatus.Unselected => "unselected",
            AgentSelectionStatus.Selected => "selected",
            AgentSelectionStatus.MigrationRequired => "migration-required",
            AgentSelectionStatus.Invalid => "invalid",
            _ => throw InvalidResponse(),
        };
        var selectionState = ParseRequiredEnum(agent, "selectionState", "unselected", "selected", "migration-required", "invalid");
        if (selectionState != expectedSelectionState) throw InvalidResponse();
        var capabilityElement = agent.GetProperty("capabilities");
        if (capabilityElement.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(capabilityElement, "shown", "total", "omitted", "detected", "unavailable", "selected"))
        {
            throw InvalidResponse();
        }
        var capabilities = new Phase2IntegratedCapabilityTruth(
            Count(capabilityElement, "shown"), Count(capabilityElement, "total"), Count(capabilityElement, "omitted"),
            Count(capabilityElement, "detected"), Count(capabilityElement, "unavailable"), Count(capabilityElement, "selected"));
        var expectedDetected = expectedCapabilities.LongCount(value => value.Detected);
        var expectedSelected = expectedSelection.Status == AgentSelectionStatus.Selected ? 1L : 0L;
        if (capabilities.Shown != expectedCapabilities.Count || capabilities.Total != capabilities.Shown ||
            capabilities.Omitted != 0 || capabilities.Detected != expectedDetected ||
            capabilities.Unavailable != capabilities.Shown - expectedDetected || capabilities.Selected != expectedSelected)
        {
            throw InvalidResponse();
        }
        var runElement = agent.GetProperty("runs");
        if (runElement.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                runElement, "shown", "total", "omitted", "terminal", "nonTerminal", "managedObserved",
                "resultBound", "actualEffectCount")) throw InvalidResponse();
        var runs = new Phase2IntegratedRunTruth(
            Count(runElement, "shown"), Count(runElement, "total"), Count(runElement, "omitted"),
            Count(runElement, "terminal"), Count(runElement, "nonTerminal"), Count(runElement, "managedObserved"),
            Count(runElement, "resultBound"), Count(runElement, "actualEffectCount"));
        Phase2IntegratedLimit ParseLimit(JsonElement value)
        {
            if (value.ValueKind != JsonValueKind.Object || !HasOnlyProperties(value, "shown", "total", "omitted"))
            {
                throw InvalidResponse();
            }
            return new Phase2IntegratedLimit(Count(value, "shown"), Count(value, "total"), Count(value, "omitted"));
        }
        var managedRuns = ParseLimit(agent.GetProperty("managedRuns"));
        var handoffElement = agent.GetProperty("handoffs");
        if (handoffElement.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                handoffElement, "shown", "total", "omitted", "pendingAcknowledgement", "acknowledged"))
        {
            throw InvalidResponse();
        }
        var handoffs = new Phase2IntegratedHandoffTruth(
            Count(handoffElement, "shown"), Count(handoffElement, "total"), Count(handoffElement, "omitted"),
            Count(handoffElement, "pendingAcknowledgement"), Count(handoffElement, "acknowledged"));
        if (runs.Shown + runs.Omitted != runs.Total || runs.Terminal + runs.NonTerminal != runs.Shown ||
            runs.ManagedObserved > managedRuns.Shown || runs.ResultBound > runs.ManagedObserved ||
            managedRuns.Shown + managedRuns.Omitted != managedRuns.Total ||
            handoffs.Shown + handoffs.Omitted != handoffs.Total ||
            handoffs.PendingAcknowledgement + handoffs.Acknowledged != handoffs.Shown) throw InvalidResponse();
        var metrics = agent.GetProperty("providerMetrics");
        if (metrics.ValueKind != JsonValueKind.Object || !HasOnlyProperties(metrics, "usage", "cost") ||
            ParseRequiredEnum(metrics, "usage", "unavailable") != "unavailable" ||
            ParseRequiredEnum(metrics, "cost", "unavailable") != "unavailable" ||
            ParseRequiredEnum(agent, "liveProviderQuality", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(agent, "semanticOutputQuality", "not-assessed") != "not-assessed") throw InvalidResponse();

        var freshness = dashboard.GetProperty("freshness");
        if (freshness.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                freshness, "state", "phase2State", "agentModelState", "selectionCapabilityState", "phase2ObservedAt",
                "agentModelObservedAt", "oldestCapabilityObservedAt", "newestCapabilityObservedAt", "truncated"))
        {
            throw InvalidResponse();
        }
        var freshnessState = ParseRequiredEnum(freshness, "state", "current", "attention-required");
        var phase2State = ParseRequiredEnum(freshness, "phase2State", "candidate-complete-for-human-review", "attention-required");
        var agentModelState = ParseRequiredEnum(freshness, "agentModelState", "current", "attention-required");
        var selectionCapabilityState = ParseRequiredEnum(
            freshness, "selectionCapabilityState", "current", "unselected", "stale", "migration-required", "invalid");
        var sourceTimes = new[]
        {
            ParseRequiredTimestamp(freshness, "phase2ObservedAt"),
            ParseRequiredTimestamp(freshness, "agentModelObservedAt"),
            ParseRequiredTimestamp(freshness, "oldestCapabilityObservedAt"),
            ParseRequiredTimestamp(freshness, "newestCapabilityObservedAt"),
        };
        var truncated = ParseRequiredBoolean(freshness, "truncated");
        var freshnessAttention = phase2State == "attention-required" || agentModelState == "attention-required" ||
            truncated || changeAttention || impactAttention;
        if ((freshnessState == "attention-required") != freshnessAttention || sourceTimes[2] > sourceTimes[3])
        {
            throw InvalidResponse();
        }

        var governance = dashboard.GetProperty("governance");
        if (governance.ValueKind != JsonValueKind.Object || !HasOnlyProperties(
                governance, "humanDesignApproval", "baselineDesignation", "impactAcceptance", "providerAccountReadiness",
                "providerPreference", "automaticSelectionAuthority", "runLaunchAuthority", "effectAuthority",
                "phaseReadinessAuthority", "productOwnerAcceptance")) throw InvalidResponse();
        foreach (var name in new[]
                 {
                     "humanDesignApproval", "baselineDesignation", "impactAcceptance", "providerAccountReadiness",
                     "providerPreference", "phaseReadinessAuthority", "productOwnerAcceptance",
                 })
        {
            if (ParseRequiredEnum(governance, name, "not-established") != "not-established") throw InvalidResponse();
        }
        foreach (var name in new[] { "automaticSelectionAuthority", "runLaunchAuthority", "effectAuthority" })
        {
            if (ParseRequiredEnum(governance, name, "not-granted") != "not-granted") throw InvalidResponse();
        }
        var evidence = dashboard.GetProperty("evidenceCues");
        if (evidence.ValueKind != JsonValueKind.Object || !HasOnlyProperties(evidence, "freshness", "confidence"))
        {
            throw InvalidResponse();
        }
        var evidenceFreshness = ParseRequiredEnum(evidence, "freshness", "current", "potentially-stale", "unknown");
        var confidence = evidence.GetProperty("confidence");
        if ((evidenceFreshness == "current") == freshnessAttention || confidence.ValueKind != JsonValueKind.Object ||
            !HasOnlyProperties(confidence, "state", "basis") ||
            ParseRequiredEnum(confidence, "state", "not-assessed") != "not-assessed" ||
            ParseRequiredEnum(confidence, "basis", "no-governed-confidence-evaluation-is-bound") !=
            "no-governed-confidence-evaluation-is-bound") throw InvalidResponse();
        var observedAt = ParseRequiredTimestamp(dashboard, "observedAt");
        if (sourceTimes.Any(value => value > observedAt)) throw InvalidResponse();
        var limitationsElement = dashboard.GetProperty("limitations");
        if (limitationsElement.ValueKind != JsonValueKind.Array || limitationsElement.GetArrayLength() is < 3 or > 8)
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
        return new Phase2ChangeImpactAgentModelDashboard(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            phase2Digest, sourceCatalogDigest, agentModelDigest, synchronization, impact, selectionState, capabilities,
            runs, managedRuns, handoffs, freshnessState, phase2State, agentModelState, selectionCapabilityState,
            ParseRequiredEnum(governance, "productOwnerAcceptance", "not-established"),
            ParseRequiredEnum(governance, "runLaunchAuthority", "not-granted"),
            ParseRequiredEnum(governance, "effectAuthority", "not-granted"), observedAt,
            Array.AsReadOnly(limitations), snapshotDigest);
    }
}
