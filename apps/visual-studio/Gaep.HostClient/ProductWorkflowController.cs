using System.Globalization;
using System.Text;

namespace Gaep.HostClient;

public sealed record AgentSelectionContext(
    AgentSelectionState Current,
    IReadOnlyList<AgentReadinessSnapshot> Available);

public sealed record AgentHandoffContext(
    AgentSelection Current,
    AgentRun SourceRun,
    IReadOnlyList<AgentReadinessSnapshot> Available);

public sealed record ChangeImpactContext(
    ProductBinding Product,
    ChangeImpactChangeCatalog Catalog);

public sealed class ProductWorkflowController(EngineClient client)
{
    public async Task<string> ReadProductAsync(CancellationToken cancellationToken = default) =>
        RenderProduct(await client.ReadProductBindingAsync(cancellationToken));

    public async Task<InitiativeEntryContext> ReadInitiativeEntryContextAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var assessment = await client.AssessInitiativeEntryAsync(initiativeId, cancellationToken);
        if (assessment.InitiativeRevision != initiative.Revision || assessment.ProductId != initiative.ProductId ||
            assessment.ProductId != product.Id || assessment.ProductRevision != product.Revision ||
            assessment.ProductDigest != product.Digest)
        {
            throw new ArgumentException("The Initiative changed while its entry assessment was read. Refresh the exact record.");
        }
        var completeness = assessment.Classification.Completeness;
        var classificationValid = assessment.Classification.Status switch
        {
            "missing" => initiative.Classification is null && assessment.Classification.Digest is null,
            "current" => initiative.Classification is not null &&
                assessment.Classification.Digest == initiative.Classification.Digest &&
                initiative.Classification.ProductRevision == assessment.ProductRevision &&
                initiative.Classification.ProductDigest == assessment.ProductDigest &&
                initiative.Classification.CompletenessPolicyVersion == completeness.PolicyVersion &&
                initiative.Classification.CompletenessPolicyDigest == completeness.PolicyDigest,
            "stale" => initiative.Classification is not null &&
                assessment.Classification.Digest == initiative.Classification.Digest &&
                (initiative.Classification.ProductRevision != assessment.ProductRevision ||
                 initiative.Classification.ProductDigest != assessment.ProductDigest ||
                 initiative.Classification.CompletenessPolicyVersion != completeness.PolicyVersion ||
                 initiative.Classification.CompletenessPolicyDigest != completeness.PolicyDigest),
            _ => false,
        };
        if (!classificationValid)
        {
            throw new ArgumentException("The Initiative classification assessment is not bound to the exact current record.");
        }
        var coverage = assessment.Applicability.Coverage;
        var applicabilityValid = assessment.Applicability.Status switch
        {
            "missing" => initiative.Applicability is null && assessment.Applicability.MatrixRevision is null &&
                assessment.Applicability.Digest is null,
            "current" => initiative.Applicability is not null && initiative.Applicability.State == "current" &&
                assessment.Applicability.MatrixRevision == initiative.Applicability.Revision &&
                assessment.Applicability.Digest == initiative.Applicability.Digest &&
                assessment.Applicability.DecisionCount == initiative.Applicability.DecisionCount &&
                assessment.Applicability.UnresolvedSubjectCount == initiative.Applicability.UnresolvedSubjectCount &&
                initiative.Applicability.SubjectCatalog?.CatalogVersion == coverage.CatalogVersion &&
                initiative.Applicability.SubjectCatalog?.Digest == coverage.CatalogDigest &&
                initiative.Applicability.SubjectCatalog?.SubjectCount == coverage.SubjectCount,
            "stale" => initiative.Applicability is not null &&
                assessment.Applicability.MatrixRevision == initiative.Applicability.Revision &&
                assessment.Applicability.Digest == initiative.Applicability.Digest &&
                assessment.Applicability.DecisionCount == initiative.Applicability.DecisionCount &&
                assessment.Applicability.UnresolvedSubjectCount == initiative.Applicability.UnresolvedSubjectCount,
            _ => false,
        };
        if (!applicabilityValid)
        {
            throw new ArgumentException("The Initiative applicability assessment is not bound to the exact current record.");
        }
        var coverageValid = coverage.Status switch
        {
            "unavailable" => coverage.CatalogVersion is null && coverage.CatalogDigest is null &&
                coverage.SubjectCount == 0 && assessment.Classification.Status == "missing",
            "missing" => initiative.Applicability is null &&
                coverage.CatalogVersion is not null && coverage.CatalogDigest is not null,
            "complete" or "incomplete" => assessment.Applicability.Status == "current" &&
                coverage.CatalogVersion is not null && coverage.CatalogDigest is not null,
            "stale" => assessment.Applicability.Status == "stale" &&
                coverage.CatalogVersion is not null && coverage.CatalogDigest is not null,
            _ => false,
        };
        if (!coverageValid)
        {
            throw new ArgumentException(
                "The Initiative applicability coverage is not bound to the exact current catalog.");
        }
        return new InitiativeEntryContext(initiative, assessment);
    }

    public async Task<string> ReadInitiativeEntryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default) =>
        RenderInitiativeEntry(await ReadInitiativeEntryContextAsync(initiativeId, cancellationToken));

    public async Task<string> ReadSourceGovernanceAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadSourceGovernanceAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while Source governance was read. Refresh the exact records.");
        }
        return RenderSourceGovernance(projection);
    }

    public static string RenderSourceGovernance(SourceGovernanceProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Source governance")
            .AppendLine()
            .AppendLine(
                $"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · " +
                projection.InitiativeState)
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Records: {projection.SourceCount} Sources · {projection.BaselineCount} candidate Baselines · " +
                $"{projection.ProvenanceCount} Provenance records")
            .AppendLine(
                $"Gaps: {projection.StaleSourceCount} stale · {projection.UnknownAuthorityCount} unknown authority · " +
                $"{projection.UnbaselinedSourceCount} unbaselined · " +
                $"{projection.UnprovenancedSourceCount} unprovenanced")
            .AppendLine(
                "Current candidate Baseline: " +
                (projection.CurrentBaseline is null
                    ? "not recorded"
                    : $"{projection.CurrentBaseline.Id:D}@{projection.CurrentBaseline.Revision} · " +
                      projection.CurrentBaseline.Status));
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine().AppendLine("Governed Sources");
        foreach (var source in projection.Sources.Take(50))
        {
            output.AppendLine(
                $"  - {source.Title} · {source.Id:D}@{source.Revision} · owner {source.Owner} · " +
                $"authority {source.SemanticAuthority} · {source.KnowledgeDisposition} · " +
                $"{source.Freshness}/{source.Availability}");
        }
        if (projection.Sources.Count > 50)
        {
            output.AppendLine($"  - {projection.Sources.Count - 50} more withheld from this compact view");
        }
        output.AppendLine().AppendLine("Candidate Source Baselines");
        foreach (var baseline in projection.Baselines.Take(50))
        {
            output.AppendLine(
                $"  - {baseline.Title} · {baseline.Id:D}@{baseline.Revision} · " +
                $"{baseline.MemberCount} exact Source(s) · {baseline.AssessmentStatus}");
        }
        if (projection.Baselines.Count > 50)
        {
            output.AppendLine($"  - {projection.Baselines.Count - 50} more withheld from this compact view");
        }
        output.AppendLine().AppendLine("Source Provenance");
        foreach (var provenance in projection.Provenance.Take(50))
        {
            output.AppendLine(
                $"  - {provenance.Id:D} · {provenance.TargetKind} · {provenance.Disposition} · " +
                $"{provenance.SourceCount} Source(s) · {provenance.TransformationCount} transformation(s)");
        }
        if (projection.Provenance.Count > 50)
        {
            output.AppendLine($"  - {projection.Provenance.Count - 50} more withheld from this compact view");
        }
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this is a bounded metadata projection. It contains no Source bytes, locators, local paths, " +
                "or credentials and grants no Baseline designation, approval, readiness, authority transfer, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBusinessUnderstandingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBusinessUnderstandingAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while Business Understanding was read. Refresh the exact records.");
        }
        return RenderBusinessUnderstanding(projection);
    }

    public static string RenderBusinessUnderstanding(BusinessUnderstandingProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Business Understanding")
            .AppendLine()
            .AppendLine(
                $"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · " +
                projection.InitiativeState)
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Assessment gaps: {projection.UnresolvedQuestionCount} unresolved questions · " +
                $"{projection.BlockingQuestionCount} blocking questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.BusinessUnderstanding is { } business)
        {
            output.AppendLine(
                    $"Business Understanding: {business.Id:D}@{business.Revision} · candidate · {business.Digest}")
                .AppendLine(
                    $"Business counts: {business.ObjectiveCount} objectives · {business.ConstraintCount} constraints · " +
                    $"{business.AssumptionCount} assumptions · {business.UnresolvedQuestionCount} unresolved questions · " +
                    $"{business.GlossaryTermCount} glossary terms");
        }
        else output.AppendLine("Business Understanding: not recorded");
        output.AppendLine();
        if (projection.StakeholderModel is { } stakeholders)
        {
            output.AppendLine(
                    $"Stakeholder Model: {stakeholders.Id:D}@{stakeholders.Revision} · candidate · {stakeholders.Digest}")
                .AppendLine(
                    $"Stakeholder counts: {stakeholders.StakeholderCount} stakeholders · " +
                    $"{stakeholders.RepresentedCategoryCount} represented categories · " +
                    $"{stakeholders.UnresolvedCategoryCount} unresolved categories · " +
                    $"{stakeholders.VerifiedAuthorityCount} verified authority claims");
        }
        else output.AppendLine("Stakeholder Model: not recorded");
        output.AppendLine();
        if (projection.OutcomeModel is { } outcomes)
        {
            output.AppendLine($"Outcome Model: {outcomes.Id:D}@{outcomes.Revision} · candidate · {outcomes.Digest}")
                .AppendLine(
                    $"Outcome counts: {outcomes.OutcomeCount} outcomes · {outcomes.MeasureCount} measures · " +
                    $"{outcomes.CountermetricCount} countermetrics · {outcomes.BurdenMeasureCount} burden measures · " +
                    $"{outcomes.ObservedBaselineCount} observed baselines");
        }
        else output.AppendLine("Outcome Model: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view contains record identities, revisions, digests, states, counts, and " +
                "assessment status only. It exposes no business narrative, personal assignments, Source content, locators, " +
                "local paths, or credentials and grants no approval, appointment, decision, readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBusinessCapabilityMapAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBusinessCapabilityMapAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Business Capability Map was read. Refresh the exact records.");
        }
        return RenderBusinessCapabilityMap(projection);
    }

    public static string RenderBusinessCapabilityMap(BusinessCapabilityMapProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Business Capability Map")
            .AppendLine()
            .AppendLine(
                $"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · " +
                projection.InitiativeState)
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Assessment counts: {projection.CapabilityCount} capabilities · {projection.OwnedCapabilityCount} owned · " +
                $"{projection.UnownedCapabilityCount} unowned · {projection.ObjectiveCoverageCount} objectives covered · " +
                $"{projection.OutcomeCoverageCount} outcomes covered")
            .AppendLine(
                $"Gaps and uncertainty: {projection.OpenGapCount} open gaps · {projection.CriticalGapCount} critical gaps · " +
                $"{projection.UnknownCurrentMaturityCount} unknown current maturity · " +
                $"{projection.UnassessedPriorityCount} unassessed priority · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.CapabilityMap is { } map)
        {
            output.AppendLine($"Business Capability Map: {map.Id:D}@{map.Revision} · candidate · {map.Digest}")
                .AppendLine(
                    $"Map counts: {map.CapabilityCount} capabilities · {map.OwnedCapabilityCount} owned · " +
                    $"{map.OpenGapCount} open gaps · {map.CriticalGapCount} critical gaps · " +
                    $"{map.CandidatePriorityCount} candidate priorities");
        }
        else output.AppendLine("Business Capability Map: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view contains record identities, revisions, digests, states, counts, and " +
                "assessment status only. It exposes no capability narrative, personal assignments, Source content, locators, " +
                "local paths, or credentials and grants no priority approval, baseline, readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadValueStreamModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadValueStreamModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Value Stream Model was read. Refresh the exact records.");
        }
        return RenderValueStreamModel(projection);
    }

    public static string RenderValueStreamModel(ValueStreamModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Value Stream Model")
            .AppendLine()
            .AppendLine(
                $"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · " +
                projection.InitiativeState)
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Assessment counts: {projection.ValueStreamCount} value streams · {projection.OwnedValueStreamCount} owned · " +
                $"{projection.UnownedValueStreamCount} unowned · {projection.StageCount} stages · " +
                $"{projection.DependencyCount} dependencies · {projection.CapabilityCoverageCount} capabilities covered · " +
                $"{projection.OutcomeCoverageCount} outcomes covered")
            .AppendLine(
                $"Flow gaps: {projection.AbsentFlowEvidenceCount} stages without evidence · " +
                $"{projection.OpenBottleneckCount} open bottlenecks · {projection.CriticalBottleneckCount} critical bottlenecks · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.ValueStreamModel is { } model)
        {
            output.AppendLine($"Value Stream Model: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine(
                    $"Model counts: {model.ValueStreamCount} value streams · {model.OwnedValueStreamCount} owned · " +
                    $"{model.StageCount} stages · {model.DependencyCount} dependencies · " +
                    $"{model.OpenBottleneckCount} open bottlenecks · {model.CriticalBottleneckCount} critical bottlenecks");
        }
        else output.AppendLine("Value Stream Model: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view contains record identities, revisions, digests, states, counts, and " +
                "assessment status only. It exposes no value-stream narrative, personal assignments, Source content, locators, " +
                "local paths, or credentials and grants no baseline, priority, readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadOperatingModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadOperatingModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Operating Model was read. Refresh the exact records.");
        }
        return RenderOperatingModel(projection);
    }

    public static string RenderOperatingModel(OperatingModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Operating Model")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Structural counts: {projection.RoleCount} roles · {projection.GovernanceSystemCount} governance systems · " +
                $"{projection.DecisionRightCount} decision rights · {projection.ForumCount} forums · {projection.CycleCount} cycles")
            .AppendLine(
                $"Candidate gaps: {projection.UnassignedAppointingAuthorityCount} appointing authorities · " +
                $"{projection.InsufficientCapacityCount} capacity · {projection.UnfundedCapacityCount} funding · " +
                $"{projection.UnassignedDecisionAuthorityCount} decision authorities · {projection.SupportCapacityGapCount} support capacity · " +
                $"{projection.EmergencyAuthorityGapCount} emergency authority · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.OperatingModel is { } model)
        {
            output.AppendLine($"Operating Model: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine(
                    $"Model counts: {model.RoleCount} roles · {model.DecisionRightCount} decision rights · " +
                    $"{model.ForumCount} forums · {model.CycleCount} cycles");
        }
        else output.AppendLine("Operating Model: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no operating narrative, personal assignments, Source content, " +
                "locators, local paths, or credentials and grants no appointment, funding, baseline, readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBusinessRuleCatalogAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBusinessRuleCatalogAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Business Rule Catalog was read. Refresh the exact records.");
        }
        return RenderBusinessRuleCatalog(projection);
    }

    public static string RenderBusinessRuleCatalog(BusinessRuleCatalogProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Business Rule Catalog")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Rule counts: {projection.RuleCount} rules · {projection.SourceBackedRuleCount} source-backed · " +
                $"{projection.NonExceptionableRuleCount} non-exceptionable · {projection.EnforcementTargetCount} enforcement targets · " +
                $"{projection.ExceptionCount} exceptions")
            .AppendLine(
                $"Candidate gaps: {projection.UnassignedEnforcementTargetCount} unassigned targets · " +
                $"{projection.UnverifiedEnforcementTargetCount} unverified targets · " +
                $"{projection.UnassignedExceptionAuthorityCount} unassigned exception authorities · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.BusinessRuleCatalog is { } catalog)
        {
            output.AppendLine($"Business Rule Catalog: {catalog.Id:D}@{catalog.Revision} · candidate · {catalog.Digest}")
                .AppendLine(
                    $"Catalog counts: {catalog.RuleCount} rules · {catalog.EnforcementTargetCount} enforcement targets · " +
                    $"{catalog.ExceptionCount} exceptions · {catalog.NonExceptionableRuleCount} non-exceptionable");
        }
        else output.AppendLine("Business Rule Catalog: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no rule narrative, Source content, personal data, locators, local paths, " +
                "or credentials and does not evaluate policy, grant exceptions, deploy enforcement, approve a baseline, " +
                "establish readiness, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadBusinessArchitectureBaselineAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBusinessArchitectureBaselineAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Business Architecture Baseline was read. Refresh the exact records.");
        }
        return RenderBusinessArchitectureBaseline(projection);
    }

    public static string RenderBusinessArchitectureBaseline(BusinessArchitectureBaselineProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Business Architecture Baseline candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage counts: {projection.CoveredElementCount} covered · {projection.IncludedElementCount} included · " +
                $"{projection.ExcludedElementCount} excluded · {projection.UnresolvedElementCount} unresolved")
            .AppendLine(
                $"Coherence: {projection.IntegrationClaimCount} integration claims · {projection.ConsistencyCheckCount} consistency checks · " +
                $"{projection.ConsistencyGapCount} gaps · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Baseline is { } baseline)
        {
            output.AppendLine($"Baseline candidate: {baseline.Id:D}@{baseline.Revision} · candidate · {baseline.Digest}")
                .AppendLine($"Membership digest: {baseline.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {baseline.CoveredElementCount} elements · {baseline.IntegrationClaimCount} integration claims · " +
                    $"{baseline.ConsistencyGapCount} consistency gaps");
        }
        else output.AppendLine("Baseline candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no architecture narrative, Source content, personal data, locators, " +
                "local paths, or credentials and does not designate or approve a baseline, establish readiness, grant " +
                "exceptions, deploy enforcement, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadSystemSolutionArchitectureAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadSystemSolutionArchitectureAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the System/Solution Architecture was read. Refresh the exact records.");
        }
        return RenderSystemSolutionArchitecture(projection);
    }

    public static string RenderSystemSolutionArchitecture(SystemSolutionArchitectureProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed System/Solution Architecture candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.ConcernCount} concerns · {projection.ViewCount} views · " +
                $"{projection.ElementCount} elements · {projection.RelationCount} relations · " +
                $"{projection.QualityAttributeCount} quality scenarios · {projection.DecisionCount} decisions · " +
                $"{projection.ConformanceCriterionCount} conformance criteria")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQualityAttributeCount} quality scenarios · " +
                $"{projection.UnresolvedDecisionCount} decisions · {projection.UnresolvedConformanceCriterionCount} conformance criteria · " +
                $"{projection.LifecycleGapCount} lifecycle consequences · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Architecture is { } architecture)
        {
            output.AppendLine($"Architecture candidate: {architecture.Id:D}@{architecture.Revision} · candidate · {architecture.Digest}")
                .AppendLine($"Membership digest: {architecture.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {architecture.ConcernCount} concerns · {architecture.ViewCount} views · " +
                    $"{architecture.ElementCount} elements · {architecture.QualityAttributeCount} quality scenarios · " +
                    $"{architecture.DecisionCount} decisions");
        }
        else output.AppendLine("Architecture candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no architecture narrative, Source content, personal data, locators, " +
                "local paths, or credentials and does not designate or approve an architecture baseline, establish readiness, " +
                "prove conformance, mandate technology, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadBoundedContextModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBoundedContextModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Bounded Context Model was read. Refresh the exact records.");
        }
        return RenderBoundedContextModel(projection);
    }

    public static string RenderBoundedContextModel(BoundedContextModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Bounded Context and Ownership candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.BoundedContextCount} contexts · {projection.CoreContextCount} core contexts · " +
                $"{projection.LanguageTermCount} language terms · {projection.ContractCount} contracts · " +
                $"{projection.RelationshipCount} relationships")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedContractCount} contracts · {projection.UnresolvedRelationshipCount} relationships · " +
                $"{projection.UnassignedArchitectureElementCount} unassigned elements · {projection.UnownedDataAssetCount} unowned data assets · " +
                $"{projection.UnmappedCrossContextRelationCount} unmapped relations · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Boundary candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.BoundedContextCount} contexts · {model.ContractCount} contracts · " +
                    $"{model.RelationshipCount} relationships");
        }
        else output.AppendLine("Boundary candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no boundary language, contract narrative, Source content, " +
                "personal data, locators, local paths, or credentials and does not appoint owners, accept ownership, " +
                "approve boundaries or contracts, establish readiness, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadSecurityPrivacyAssessmentAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadSecurityPrivacyAssessmentAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException(
                "The Product or Initiative changed while the Security, Privacy, and Threat Assessment was read. Refresh the exact records.");
        }
        return RenderSecurityPrivacyAssessment(projection);
    }

    public static string RenderSecurityPrivacyAssessment(SecurityPrivacyAssessmentProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Security, Privacy, and Threat Assessment candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.AssetCount} assets · {projection.ActorCount} actors · " +
                $"{projection.TrustBoundaryCount} trust boundaries · {projection.DataClassCount} data classes · " +
                $"{projection.DataFlowCount} data flows · {projection.ControlCount} controls · {projection.ThreatCount} threats")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedThreatCount} threats · {projection.UnverifiedControlCount} controls · " +
                $"{projection.UnresolvedProcessingAuthorityCount} processing authorities · " +
                $"{projection.UncoveredArchitectureElementCount} uncovered elements · " +
                $"{projection.UnmappedArchitectureRelationCount} unmapped relations · " +
                $"{projection.UnresolvedRequirementCount} profile requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Assessment is { } assessment)
        {
            output.AppendLine($"Assessment candidate: {assessment.Id:D}@{assessment.Revision} · candidate · {assessment.Digest}")
                .AppendLine($"Membership digest: {assessment.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {assessment.AssetCount} assets · {assessment.TrustBoundaryCount} trust boundaries · " +
                    $"{assessment.DataClassCount} data classes · {assessment.ControlCount} controls · {assessment.ThreatCount} threats");
        }
        else output.AppendLine("Assessment candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no threat scenarios, control content, data content, Source content, " +
                "personal data, locators, local paths, secrets, or credentials and does not approve a threat model, attest " +
                "control effectiveness, accept risk, approve processing, establish security readiness, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadProcessModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadProcessModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Process Model was read. Refresh the exact records.");
        }
        return RenderProcessModel(projection);
    }

    public static string RenderProcessModel(ProcessModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Process Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.ProcessCount} processes · {projection.StepCount} steps · " +
                $"{projection.StateDimensionCount} state dimensions · {projection.StateValueCount} state values · " +
                $"{projection.TransitionCount} transitions · {projection.EventDefinitionCount} events · " +
                $"{projection.ApprovalRequirementCount} approval requirements")
            .AppendLine(
                $"Candidate gaps: {projection.UncoveredValueStreamCount} value streams · " +
                $"{projection.UncoveredBoundedContextCount} bounded contexts · {projection.UncoveredBusinessRuleCount} business rules · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Process candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.ProcessCount} processes · {model.TransitionCount} transitions · " +
                    $"{model.ApprovalRequirementCount} approval requirements");
        }
        else output.AppendLine("Process candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no process narrative, transition guards, approval content, " +
                "Source content, personal data, locators, local paths, secrets, or credentials and does not approve " +
                "workflows, grant transition or execution authority, establish operational readiness, promote a baseline, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadDataModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDataModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Data Model was read. Refresh the exact records.");
        }
        return RenderDataModel(projection);
    }

    public static string RenderDataModel(DataModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Data Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.EntityCount} entities · {projection.AttributeCount} attributes · " +
                $"{projection.RelationshipCount} relationships · {projection.LifecycleCount} lifecycles · " +
                $"{projection.TransformationCount} transformations")
            .AppendLine(
                $"Candidate gaps: {projection.UncoveredBoundedContextCount} bounded contexts · " +
                $"{projection.UncoveredSecurityDataClassCount} security data classes · {projection.UncoveredProcessCount} processes · " +
                $"{projection.UnresolvedSystemOfRecordCount} systems of record · {projection.UnresolvedTransformationCount} transformations · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Data candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.EntityCount} entities · {model.RelationshipCount} relationships · " +
                    $"{model.LifecycleCount} lifecycles");
        }
        else output.AppendLine("Data candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no entity attributes, relationships, lifecycle content, " +
                "Source content, personal data, locators, local paths, secrets, or credentials and does not approve " +
                "a data model or classification, appoint ownership, grant migration authority, establish operational " +
                "readiness, promote a baseline, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadAuthorizationModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadAuthorizationModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Authorization Model was read. Refresh the exact records.");
        }
        return RenderAuthorizationModel(projection);
    }

    public static string RenderAuthorizationModel(AuthorizationModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Authorization Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.PrincipalCount} principals · {projection.RoleAssignmentCount} role assignments · " +
                $"{projection.ResourceCount} resources · {projection.ActionCount} actions · " +
                $"{projection.ApprovalBindingCount} approval bindings · {projection.RuleCount} rules")
            .AppendLine(
                $"Candidate gaps: {projection.UncoveredOperatingRoleCount} operating roles · " +
                $"{projection.UncoveredProcessCount} processes · {projection.UncoveredDataEntityCount} data entities · " +
                $"{projection.UnresolvedIdentityCount} identities · {projection.UnresolvedRuleCount} rules · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Authorization candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.PrincipalCount} principals · {model.ActionCount} actions · " +
                    $"{model.RuleCount} rules");
        }
        else output.AppendLine("Authorization candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no principal identifiers, role-assignment content, rules, " +
                "conditions, approval content, Source content, personal data, locators, local paths, secrets, or " +
                "credentials and does not verify identity, approve role assignments or standing authority, create " +
                "an authorization grant, enforce policy, establish operational readiness, promote a baseline, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadEventIntegrationModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadEventIntegrationModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Event and Integration Model was read. Refresh the exact records.");
        }
        return RenderEventIntegrationModel(projection);
    }

    public static string RenderEventIntegrationModel(EventIntegrationModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Event and Integration Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.EventTypeCount} event types · {projection.CommandCount} commands · " +
                $"{projection.AdapterCount} adapters · {projection.ExternalContractCount} external contracts · " +
                $"{projection.MappingCount} mappings · {projection.RouteCount} routes")
            .AppendLine(
                $"Candidate gaps: {projection.UncoveredProcessEventCount} process events · " +
                $"{projection.UncoveredProcessCount} processes · {projection.UncoveredBoundedContextCount} bounded contexts · " +
                $"{projection.UncoveredDataEntityCount} data entities · " +
                $"{projection.UncoveredAuthorizationActionCount} authorization actions · " +
                $"{projection.UnknownMappingTruthCount} mapping truths · {projection.UnresolvedRequirementCount} requirements · " +
                $"{projection.InconsistencyCount} inconsistencies · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Event and integration candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.EventTypeCount} event types · {model.CommandCount} commands · " +
                    $"{model.AdapterCount} adapters · {model.ExternalContractCount} external contracts · " +
                    $"{model.MappingCount} mappings · {model.RouteCount} routes");
        }
        else output.AppendLine("Event and integration candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no event payloads, command inputs, mapping content, external " +
                "locators, Source content, personal data, local paths, secrets, or credentials and does not prove event " +
                "occurrence, send or deliver commands, accept external contracts, activate adapters, create authorization " +
                "grants, execute effects, establish operational readiness, promote a baseline, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadFailureRecoveryModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadFailureRecoveryModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Failure and Recovery Model was read. Refresh the exact records.");
        }
        return RenderFailureRecoveryModel(projection);
    }

    public static string RenderFailureRecoveryModel(FailureRecoveryModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Failure and Recovery Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.FailureModeCount} failure modes · {projection.RetryPolicyCount} retry policies · " +
                $"{projection.CompensationPlanCount} compensation plans · {projection.RecoveryPlanCount} recovery plans · " +
                $"{projection.RecoveryEvidenceDefinitionCount} recovery evidence definitions")
            .AppendLine(
                $"Candidate gaps: {projection.UncoveredProcessCount} processes · {projection.UncoveredCommandCount} commands · " +
                $"{projection.UncoveredRouteCount} routes · {projection.UncoveredAuthorizationActionCount} authorization actions · " +
                $"{projection.UnresolvedRecoveryEvidenceCount} recovery evidence definitions · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Failure and recovery candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.FailureModeCount} failure modes · {model.RetryPolicyCount} retry policies · " +
                    $"{model.CompensationPlanCount} compensation plans · {model.RecoveryPlanCount} recovery plans · " +
                    $"{model.RecoveryEvidenceDefinitionCount} recovery evidence definitions");
        }
        else output.AppendLine("Failure and recovery candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no failure evidence, operational telemetry, retry keys, " +
                "compensation content, recovery steps, Source content, personal data, local paths, secrets, or credentials " +
                "and does not prove failure occurrence, establish retry safety, execute compensation or restoration, " +
                "establish recovery success, authorize return to service, establish operational readiness, promote a baseline, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadArchitectureChallengeModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadArchitectureChallengeModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Architecture Challenge was read. Refresh the exact records.");
        }
        return RenderArchitectureChallengeModel(projection);
    }

    public static string RenderArchitectureChallengeModel(ArchitectureChallengeModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Architecture Challenge candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.ChallengeSubjectCount} challenge subjects · {projection.AssumptionCount} assumptions · " +
                $"{projection.AlternativeCount} alternatives · {projection.FindingCount} findings · {projection.ResponseCount} responses")
            .AppendLine(
                $"Candidate gaps: {projection.UnrespondedFindingCount} unresponded findings · " +
                $"{projection.UnresolvedAssumptionCount} unresolved assumptions · {projection.UnresolvedRequirementCount} requirements · " +
                $"{projection.InconsistencyCount} inconsistencies · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Model is { } model)
        {
            output.AppendLine($"Architecture challenge candidate: {model.Id:D}@{model.Revision} · candidate · {model.Digest}")
                .AppendLine($"Membership digest: {model.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {model.ChallengeSubjectCount} challenge subjects · {model.AssumptionCount} assumptions · " +
                    $"{model.AlternativeCount} alternatives · {model.FindingCount} findings · {model.ResponseCount} responses");
        }
        else output.AppendLine("Architecture challenge candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no challenge content, assumptions, evidence, findings, responses, " +
                "Source content, personal data, local paths, secrets, or credentials and does not complete independent review, " +
                "establish assurance, accept risk, approve architecture, establish operational readiness, promote a baseline, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadDecisionRegisterAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDecisionRegisterAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Decision Register was read. Refresh the exact records.");
        }
        return RenderDecisionRegister(projection);
    }

    public static string RenderDecisionRegister(DecisionRegisterProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Decision Register candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine($"Coverage: {projection.DecisionCount} decisions")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedDecisionCount} unresolved decisions · " +
                $"{projection.SelectedPendingDecisionCount} selected pending decisions · {projection.DeferredDecisionCount} deferred decisions · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Register is { } register)
        {
            output.AppendLine($"Decision Register candidate: {register.Id:D}@{register.Revision} · candidate · {register.Digest}")
                .AppendLine($"Membership digest: {register.MembershipDigest}")
                .AppendLine($"Candidate counts: {register.DecisionCount} decisions");
        }
        else output.AppendLine("Decision Register candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no decision questions, options, recommendations, outcomes, rationale, " +
                "evidence, subject content, personal data, local paths, secrets, or credentials and does not establish decision " +
                "effectiveness, approval, risk acceptance, baseline promotion, operational readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadRiskRegisterAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadRiskRegisterAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Risk Register was read. Refresh the exact records.");
        }
        return RenderRiskRegister(projection);
    }

    public static string RenderRiskRegister(RiskRegisterProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Risk Register candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.RiskCount} risks · {projection.ProposedTreatmentCount} proposed treatments · " +
                $"{projection.UnassignedOwnerCount} owner assignments not established")
            .AppendLine(
                $"Candidate gaps: {projection.NotAssessedRiskCount} not assessed · " +
                $"{projection.UnresolvedResidualRiskCount} residual risks · {projection.UnverifiedControlCount} control effectiveness gaps · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Register is { } register)
        {
            output.AppendLine($"Risk Register candidate: {register.Id:D}@{register.Revision} · candidate · {register.Digest}")
                .AppendLine($"Membership digest: {register.MembershipDigest}")
                .AppendLine($"Candidate counts: {register.RiskCount} risks");
        }
        else output.AppendLine("Risk Register candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no risk statements, assessments, controls, treatments, residual risk, " +
                "evidence, related-record content, personal data, local paths, secrets, or credentials and does not establish " +
                "assessment fact, owner assignment, control effectiveness, risk acceptance, approval, exception, baseline promotion, " +
                "operational readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadEvidenceRegistryAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadEvidenceRegistryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the Evidence Registry was read. Refresh the exact records.");
        }
        return RenderEvidenceRegistry(projection);
    }

    public static string RenderEvidenceRegistry(EvidenceRegistryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Evidence Registry candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.ClaimCount} claims · {projection.EvidenceItemCount} evidence items · " +
                $"{projection.LinkCount} claim/evidence links")
            .AppendLine(
                $"Candidate gaps: {projection.NotAssessedClaimCount} claims not assessed · " +
                $"{projection.NotAssessedEvidenceCount} evidence items not assessed · " +
                $"{projection.AdverseEvidencePendingDispositionCount} adverse dispositions pending · " +
                $"{projection.StaleOrUnknownEvidenceCount} stale or unknown · {projection.InvalidatedEvidenceCount} invalidated · " +
                $"{projection.UnresolvedLinkCount} unresolved links · {projection.UnresolvedRequirementCount} requirements · " +
                $"{projection.InconsistencyCount} inconsistencies · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Registry is { } registry)
        {
            output.AppendLine($"Evidence Registry candidate: {registry.Id:D}@{registry.Revision} · candidate · {registry.Digest}")
                .AppendLine($"Membership digest: {registry.MembershipDigest}")
                .AppendLine($"Candidate counts: {registry.ClaimCount} claims · {registry.EvidenceItemCount} evidence items · {registry.LinkCount} links");
        }
        else output.AppendLine("Evidence Registry candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no claim statements, evidence observations, methods, warrants, " +
                "quality details, Source content, personal data, local paths, secrets, or credentials and does not establish " +
                "claim validation, evidence sufficiency, assurance, review, approval, risk acceptance, operational readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadEndToEndTraceabilityAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadEndToEndTraceabilityAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while End-to-End Traceability was read. Refresh the exact records.");
        }
        return RenderEndToEndTraceability(projection);
    }

    public static string RenderEndToEndTraceability(EndToEndTraceabilityProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed End-to-End Traceability candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Assessment: {projection.AssessmentState}")
            .AppendLine(
                $"Coverage: {projection.NodeCount} nodes · {projection.RelationshipCount} relationship types · " +
                $"{projection.LinkCount} links · {projection.TransformationCount} transformations")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedEndpointCount} unresolved endpoints · " +
                $"{projection.NotAssessedSemanticCount} semantic reviews pending · " +
                $"{projection.MissingSpineCount} missing spine segments · " +
                $"{projection.UnknownRelationshipCount} unknown relationships · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.InconsistencyCount} inconsistencies · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Traceability is { } traceability)
        {
            output.AppendLine($"End-to-End Traceability candidate: {traceability.Id:D}@{traceability.Revision} · candidate · {traceability.Digest}")
                .AppendLine($"Membership digest: {traceability.MembershipDigest}")
                .AppendLine(
                    $"Candidate counts: {traceability.NodeCount} nodes · {traceability.RelationshipCount} relationship types · " +
                    $"{traceability.LinkCount} links · {traceability.TransformationCount} transformations");
        }
        else output.AppendLine("End-to-End Traceability candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Coverage boundary: {projection.CoverageBoundary}")
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Boundary: this privacy-safe view exposes no node content, link rationale, transformation detail, Source content, " +
                "personal data, local paths, secrets, or credentials; absence does not prove no impact or relationship, and " +
                "presence does not establish relationship truth, completeness, approval, baseline promotion, operational " +
                "readiness, or action authority.")
            .ToString();
    }

    public async Task<string> ReadP0P4ReadinessGateAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadP0P4ReadinessGateAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the P0-P4 Readiness Gate was read. Refresh the exact records.");
        }
        return RenderP0P4ReadinessGate(projection);
    }

    public static string RenderP0P4ReadinessGate(P0P4ReadinessGateProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed P0-P4 Readiness Gate candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Evaluation result: {projection.Result}")
            .AppendLine(
                $"Outputs: {projection.SatisfiedOutputCount}/{projection.ApplicableOutputCount} applicable satisfied · " +
                $"{projection.NotApplicableOutputCount} candidate not applicable · " +
                $"{projection.UnresolvedApplicabilityCount} unresolved applicability")
            .AppendLine(
                $"Candidate gaps: {projection.BlockedOutputCount} blocked · {projection.FailedOutputCount} failed · " +
                $"{projection.IncompleteOutputCount} incomplete · {projection.ConditionalOutputCount} conditional · " +
                $"{projection.StaleOrUnknownOutputCount} stale or unknown · {projection.PendingOrInvalidWaiverCount} waiver gaps · " +
                $"{projection.UnresolvedDecisionCount} open decisions · {projection.UnmetConditionCount} unmet conditions · " +
                $"{projection.UnresolvedRequirementCount} requirements · {projection.AdverseEvidenceCount} adverse evidence · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Gate is { } gate)
        {
            output.AppendLine($"P0-P4 Readiness Gate candidate: {gate.Id:D}@{gate.Revision} · candidate · {gate.Digest}")
                .AppendLine($"Membership digest: {gate.MembershipDigest}")
                .AppendLine($"Evaluation definition digest: {gate.EvaluationDefinitionDigest}")
                .AppendLine(
                    $"Candidate inventory: {gate.OutputCount} outputs · {gate.WaiverCount} waivers · " +
                    $"{gate.UnresolvedDecisionCount} open decisions · {gate.ConditionCount} conditions");
        }
        else output.AppendLine("P0-P4 Readiness Gate candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Gate boundary: {projection.GateBoundary}")
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: a readiness result does not grant approval, accept a waiver, authorize phase entry or " +
                "implementation, promote a baseline, establish Product readiness, or authorize action.")
            .ToString();
    }

    public async Task<string> ReadP5HandoffPackageAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadP5HandoffPackageAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while the P5 Handoff Package was read. Refresh the exact records.");
        }
        return RenderP5HandoffPackage(projection);
    }

    public static string RenderP5HandoffPackage(P5HandoffPackageProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed P5 Handoff Package candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState}")
            .AppendLine($"Readiness result: {projection.ReadinessResult} · transfer state: {projection.TransferState}")
            .AppendLine(
                $"Items: {projection.IncludedItemCount} included · {projection.ReferenceOnlyItemCount} exact references · " +
                $"{projection.OmittedNotApplicableItemCount} candidate not applicable · {projection.UnresolvedItemCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.StaleOrUnknownItemCount} stale or unknown applicable items · " +
                $"{projection.LossyTransformationCount} lossy transformations · {projection.UnresolvedRequirementCount} requirements · " +
                $"{projection.ConflictCount} conflicts · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Handoff is { } handoff)
        {
            output.AppendLine($"P5 Handoff Package candidate: {handoff.Id:D}@{handoff.Revision} · candidate · {handoff.Digest}")
                .AppendLine($"Membership digest: {handoff.MembershipDigest}")
                .AppendLine($"Readiness assessment digest: {handoff.ReadinessStatusDigest}")
                .AppendLine(
                    $"Candidate inventory: {handoff.ItemCount} items · {handoff.RequirementCount} requirements · " +
                    $"{handoff.DeliveryMode} delivery");
        }
        else output.AppendLine("P5 Handoff Package candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Handoff boundary: {projection.HandoffBoundary}")
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: source ownership remains retained; complete for review is not acknowledgement, readiness " +
                "approval, design approval, a Design Baseline, P5 entry, transfer authority, write authority, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignApplicabilityAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignApplicabilityAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Applicability was read. Refresh the exact records.");
        }
        return RenderDesignApplicability(projection);
    }

    public static string RenderDesignApplicability(DesignApplicabilityProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Design Applicability candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Coverage: {projection.ScopeCount} scopes · {projection.DecisionCount} explicit UX, UI, design-work, and Figma decisions")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedDecisionCount} unresolved decisions · {projection.BlockedDecisionCount} blocked decisions · " +
                $"{projection.PendingApprovalCount} pending approvals · {projection.RejectedApprovalCount} rejected approvals · " +
                $"{projection.UnresolvedDepthCount} unresolved depths · {projection.UnresolvedSourceCount} unresolved sources · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Design Applicability candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Candidate inventory: {candidate.ScopeCount} scopes · {candidate.ReviewState}");
        }
        else output.AppendLine("Design Applicability candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: silence is never not applicable; this candidate does not approve design, establish a Design " +
                "Baseline, grant readiness, authorize implementation, write, or action.")
            .ToString();
    }

    public async Task<string> ReadDesignPersonaRoleModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignPersonaRoleModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Personas and Roles were read. Refresh the exact records.");
        }
        return RenderDesignPersonaRoleModel(projection);
    }

    public static string RenderDesignPersonaRoleModel(DesignPersonaRoleProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Design Personas and Roles candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Coverage: {projection.PersonaCount} personas · {projection.DesignRoleCount} design roles · " +
                $"{projection.RepresentedParticipantCategoryCount}/5 participant categories · {projection.RepresentedRoleKindCount}/4 role kinds")
            .AppendLine(
                $"Persona evidence: {projection.HumanReviewedPersonaCount} human-reviewed · " +
                $"{projection.WeakEvidencePersonaCount} weak-evidence")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedParticipantCategoryCount} unresolved participant categories · " +
                $"{projection.UnresolvedRoleKindCount} unresolved role kinds · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Design Personas and Roles candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Candidate inventory: {candidate.PersonaCount} personas · {candidate.DesignRoleCount} design roles · {candidate.ReviewState}");
        }
        else output.AppendLine("Design Personas and Roles candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: purpose-limited candidate persona hypotheses and responsibilities only; no persona validation, " +
                "role appointment, competence verification, design approval, readiness, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadUserJourneyModelAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadUserJourneyModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while User Journeys were read. Refresh the exact records.");
        }
        return RenderUserJourneyModel(projection);
    }

    public static string RenderUserJourneyModel(UserJourneyProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed User Journeys candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Inventory: {projection.JourneyCount} journeys · {projection.TouchpointCount} touchpoints")
            .AppendLine(
                $"Paths: {projection.PrimaryPathCount} primary · {projection.SuccessPathCount} success · " +
                $"{projection.FailurePathCount} failure · {projection.RecoveryPathCount} recovery")
            .AppendLine($"Scope coverage: {projection.RepresentedScopeCount} represented · {projection.UnresolvedScopeCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.WeakEvidencePathCount} weak-evidence paths · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"User Journeys candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Candidate inventory: {candidate.JourneyCount} journeys · {candidate.TouchpointCount} touchpoints · {candidate.ReviewState}");
        }
        else output.AppendLine("User Journeys candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate journey structure and coverage metadata only; no observed-behavior proof, " +
                "journey validation, design approval, readiness, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadInformationArchitectureModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadInformationArchitectureModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Information Architecture was read. Refresh the exact records.");
        }
        return RenderInformationArchitectureModel(projection);
    }

    public static string RenderInformationArchitectureModel(InformationArchitectureProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Information Architecture candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Inventory: {projection.NodeCount} nodes · {projection.RootNodeCount} roots · {projection.RouteCount} routes")
            .AppendLine($"Scope coverage: {projection.RepresentedScopeCount} represented · {projection.UnresolvedScopeCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.WeakEvidenceNodeCount} weak-evidence nodes · " +
                $"{projection.WeakEvidenceRouteCount} weak-evidence routes · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Information Architecture candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.NodeCount} nodes · {candidate.RootNodeCount} roots · " +
                    $"{candidate.RouteCount} routes · {candidate.ReviewState}");
        }
        else output.AppendLine("Information Architecture candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate hierarchy, content-model, and route metadata only; no findability, " +
                "comprehension, accessibility, or content validation, design approval, readiness, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadScreenStateInventoryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadScreenStateInventoryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Screen and State Inventory was read. Refresh the exact records.");
        }
        return RenderScreenStateInventory(projection);
    }

    public static string RenderScreenStateInventory(ScreenStateInventoryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Screen and State Inventory candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Platforms: {projection.PlatformCount} total · {projection.TargetedPlatformCount} targeted · {projection.UnresolvedPlatformCount} unresolved")
            .AppendLine($"Inventory: {projection.ScreenCount} screens · {projection.StateCount} states · {projection.VariantCount} variants")
            .AppendLine($"Route coverage: {projection.RepresentedRouteCount} represented · {projection.UnresolvedRouteCount} unresolved")
            .AppendLine($"Scope coverage: {projection.RepresentedScopeCount} represented · {projection.UnresolvedScopeCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.WeakEvidenceItemCount} weak-evidence items · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Screen and State Inventory candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.PlatformCount} platforms · {candidate.ScreenCount} screens · " +
                    $"{candidate.StateCount} states · {candidate.VariantCount} variants · {candidate.ReviewState}");
        }
        else output.AppendLine("Screen and State Inventory candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate platform, screen, state, variant, and coverage metadata only; no UI " +
                "completeness, platform parity, state reachability, interaction quality, accessibility proof, design " +
                "approval, readiness, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignRequirementsAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignRequirementsAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Requirements were read. Refresh the exact records.");
        }
        return RenderDesignRequirements(projection);
    }

    public static string RenderDesignRequirements(DesignRequirementsProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Design Requirements candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine(
                $"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · " +
                $"catalog: {projection.CatalogCompletenessState}")
            .AppendLine(
                $"Inventory: {projection.RequirementCount} requirements · {projection.MustPriorityCount} must-priority · " +
                $"{projection.WorkItemCount} Work Items")
            .AppendLine($"Outcome coverage: {projection.RepresentedOutcomeCount} represented · {projection.UnresolvedOutcomeCount} unresolved")
            .AppendLine(
                $"Backlog disposition: {projection.LinkedBacklogRequirementCount} linked · " +
                $"{projection.NotPlannedRequirementCount} not planned · {projection.UnresolvedBacklogRequirementCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.WeakEvidenceRequirementCount} weak-evidence requirements · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleDomainReferenceCount} stale domain references · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Design Requirements candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.RequirementCount} requirements · " +
                    $"{candidate.RepresentedOutcomeCount} represented outcomes · {candidate.WorkItemCount} Work Items · " +
                    candidate.ReviewState);
        }
        else output.AppendLine("Design Requirements candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no requirement validity, " +
                "completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, " +
                "implementation, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBacklogHierarchyAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Backlog Hierarchy was read. Refresh the exact records.");
        }
        return RenderBacklogHierarchy(projection);
    }

    public static string RenderBacklogHierarchy(BacklogHierarchyProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Backlog Hierarchy candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine(
                $"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · " +
                $"hierarchy: {projection.HierarchyCompletenessState}")
            .AppendLine(
                $"Hierarchy: {projection.EpicCount} Epics · {projection.FeatureCount} Features · " +
                $"{projection.StoryCount} Stories · {projection.TaskCount} Tasks")
            .AppendLine(
                $"Topology and trace: {projection.RootCount} roots · {projection.LeafCount} leaves · " +
                $"{projection.RequirementTraceCount} Requirement traces")
            .AppendLine(
                $"Candidate gaps: {projection.UntracedStoryTaskCount} untraced delivery nodes · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleWorkItemCount} stale Work Items · {projection.StaleChangeCount} stale Changes · " +
                $"{projection.StaleRequirementCount} stale Requirements");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Backlog Hierarchy candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate hierarchy: {candidate.EpicCount} Epics · {candidate.FeatureCount} Features · " +
                    $"{candidate.StoryCount} Stories · {candidate.TaskCount} Tasks · " +
                    $"{candidate.RequirementTraceCount} Requirement traces · {candidate.ReviewState}");
        }
        else output.AppendLine("Backlog Hierarchy candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, level counts, statuses, and digests only; no backlog " +
                "objectives, criteria, scope, owners, Requirement content, personal data, priority, commitment, " +
                "ready or done, implementation readiness, assignment, execution, implementation authority, or action authority.")
            .ToString();
    }

    public async Task<string> ReadMvpSliceDefinitionAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var hierarchy = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        var projection = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while MVP and Vertical Slice Definition was read. Refresh the exact records.");
        }
        if (projection.Candidate is { } candidate &&
            (hierarchy.Candidate is not { } currentHierarchy || projection.HierarchyRecordId != currentHierarchy.Id ||
                projection.HierarchyRevision != currentHierarchy.Revision || projection.HierarchyDigest != currentHierarchy.Digest ||
                candidate.HierarchyDigest != currentHierarchy.Digest))
        {
            throw new ArgumentException("The Backlog Hierarchy changed while MVP and Vertical Slice Definition was read. Refresh the exact records.");
        }
        return RenderMvpSliceDefinition(projection);
    }

    public static string RenderMvpSliceDefinition(MvpSliceDefinitionProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed MVP and Vertical Slice candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · scope: {projection.ScopeCompletenessState}")
            .AppendLine($"Scope: {projection.ScopeNodeCount} nodes · {projection.MvpNodeCount} MVP · {projection.LaterNodeCount} later · {projection.ExcludedNodeCount} excluded")
            .AppendLine($"Vertical Slices: {projection.SliceCount} slices · {projection.StoryCount} Stories · {projection.TaskCount} Tasks · {projection.DependencyCount} dependencies")
            .AppendLine(
                $"Candidate gaps: {projection.UnassignedMvpStoryTaskCount} unassigned MVP Stories or Tasks · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleHierarchyCount} stale hierarchies · {projection.InvalidScopeCount} invalid scope entries · " +
                $"{projection.InvalidSliceCount} invalid slices");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"MVP and Vertical Slice candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Exact Backlog Hierarchy digest: {candidate.HierarchyDigest}")
                .AppendLine($"Candidate scope: {candidate.ScopeNodeCount} nodes · {candidate.MvpNodeCount} MVP · {candidate.LaterNodeCount} later · {candidate.ExcludedNodeCount} excluded")
                .AppendLine($"Candidate slices: {candidate.SliceCount} slices · {candidate.StoryCount} Stories · {candidate.TaskCount} Tasks · {candidate.ReviewState}");
        }
        else output.AppendLine("MVP and Vertical Slice candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, scope and slice counts, statuses, and digests only; no slice " +
                "titles, rationales, objectives, criteria, scope content, Requirement content, personal data, priority, " +
                "commitment, scope approval, acceptance-criteria validity, ready or done, implementation readiness, " +
                "assignment, execution, implementation authority, or action authority.")
            .ToString();
    }

    public async Task<string> ReadPrioritizationModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var mvp = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        var projection = await client.ReadPrioritizationModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Prioritization Model was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (mvp.Candidate is not { } currentMvp || projection.MvpSliceDefinitionRecordId != currentMvp.Id ||
                projection.MvpSliceDefinitionRevision != currentMvp.Revision || projection.MvpSliceDefinitionDigest != currentMvp.Digest))
        {
            throw new ArgumentException("The MVP and Vertical Slice Definition changed while Prioritization Model was read. Refresh the exact records.");
        }
        return RenderPrioritizationModel(projection);
    }

    public static string RenderPrioritizationModel(PrioritizationModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Prioritization Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Coverage: {projection.SubjectCount} slices · {projection.ScoredSubjectCount} scored · {projection.UnassessedSubjectCount} unassessed · {projection.EvidenceReferenceCount} evidence references · {projection.TieCount} score ties")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleMvpSliceDefinitionCount} stale MVP definitions · {projection.InvalidSubjectCount} invalid subjects · " +
                $"{projection.InvalidScoreCount} invalid scores");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Prioritization Model candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Method digest: {candidate.MethodDigest}")
                .AppendLine($"Candidate ranking digest: {candidate.RankingDigest}")
                .AppendLine($"Candidate coverage: {candidate.SubjectCount} slices · {candidate.ScoredSubjectCount} scored · {candidate.EvidenceReferenceCount} evidence references · {candidate.ReviewState}");
        }
        else output.AppendLine("Prioritization Model candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, method, membership, ranking, and snapshot digests only; " +
                "no dimension estimates, evidence identities, uncertainty, slice content, personal data, evidence validity, priority, " +
                "commitment, scope decisions, approval, acceptance-criteria validity, ready or done, implementation readiness, " +
                "assignment, execution, implementation authority, or action authority.")
            .ToString();
    }

    public async Task<string> ReadAcceptanceCriteriaAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var hierarchy = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        var mvp = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        var prioritization = await client.ReadPrioritizationModelAsync(initiativeId, cancellationToken);
        var projection = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Acceptance Criteria was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (hierarchy.Candidate is not { } currentHierarchy || projection.HierarchyRecordId != currentHierarchy.Id ||
                projection.HierarchyRevision != currentHierarchy.Revision || projection.HierarchyDigest != currentHierarchy.Digest))
        {
            throw new ArgumentException("The Backlog Hierarchy changed while Acceptance Criteria was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (mvp.Candidate is not { } currentMvp || projection.MvpSliceDefinitionRecordId != currentMvp.Id ||
                projection.MvpSliceDefinitionRevision != currentMvp.Revision || projection.MvpSliceDefinitionDigest != currentMvp.Digest))
        {
            throw new ArgumentException("The MVP and Vertical Slice Definition changed while Acceptance Criteria was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (prioritization.Candidate is not { } currentPrioritization ||
                projection.PrioritizationModelRecordId != currentPrioritization.Id ||
                projection.PrioritizationModelRevision != currentPrioritization.Revision ||
                projection.PrioritizationModelDigest != currentPrioritization.Digest))
        {
            throw new ArgumentException("The Prioritization Model changed while Acceptance Criteria was read. Refresh the exact records.");
        }
        return RenderAcceptanceCriteria(projection);
    }

    public static string RenderAcceptanceCriteria(AcceptanceCriteriaProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Acceptance Criteria candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine(
                $"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · " +
                $"criterion set: {projection.CriterionSetCompletenessState} · Requirement coverage: {projection.RequirementCoverageState}")
            .AppendLine(
                $"Coverage: {projection.SubjectCount} Story/Task subjects · {projection.CoveredSubjectCount} covered · " +
                $"{projection.UncoveredSubjectCount} uncovered · {projection.CriterionCount} criteria · " +
                $"{projection.TestableCriterionCount} testable · {projection.UnassessedCriterionCount} unassessed")
            .AppendLine(
                $"Traces and methods: {projection.RequirementTraceCount} Requirement traces · " +
                $"{projection.UncoveredRequirementCount} uncovered Requirements · {projection.VerificationMethodCount} methods")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleHierarchyCount} stale hierarchies · {projection.StaleMvpSliceDefinitionCount} stale MVP definitions · " +
                $"{projection.StalePrioritizationModelCount} stale prioritization models · {projection.InvalidCriterionCount} invalid criteria");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Acceptance Criteria candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Subject catalog digest: {candidate.SubjectCatalogDigest}")
                .AppendLine($"Criterion catalog digest: {candidate.CriterionCatalogDigest}")
                .AppendLine($"Verification-method catalog digest: {candidate.VerificationMethodCatalogDigest}")
                .AppendLine($"Coverage digest: {candidate.CoverageDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.CriterionCount} criteria · " +
                    $"{candidate.TestableCriterionCount} testable · {candidate.RequirementTraceCount} Requirement traces · " +
                    $"{candidate.VerificationMethodCount} methods · {candidate.ReviewState}");
        }
        else output.AppendLine("Acceptance Criteria candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and subject, criterion, method, coverage, and " +
                "snapshot digests only; no criterion text, Requirement identities, verification evidence, personal data, " +
                "criterion validity, completeness, Requirement satisfaction, priority, commitment, approval, ready or done, " +
                "implementation readiness, assignment, execution, acceptance, implementation authority, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDefinitionOfReadyAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var hierarchy = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        var mvp = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        var prioritization = await client.ReadPrioritizationModelAsync(initiativeId, cancellationToken);
        var criteria = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDefinitionOfReadyAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Definition of Ready was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (hierarchy.Candidate is not { } currentHierarchy || projection.HierarchyRecordId != currentHierarchy.Id ||
                projection.HierarchyRevision != currentHierarchy.Revision || projection.HierarchyDigest != currentHierarchy.Digest))
        {
            throw new ArgumentException("The Backlog Hierarchy changed while Definition of Ready was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (mvp.Candidate is not { } currentMvp || projection.MvpSliceDefinitionRecordId != currentMvp.Id ||
                projection.MvpSliceDefinitionRevision != currentMvp.Revision || projection.MvpSliceDefinitionDigest != currentMvp.Digest))
        {
            throw new ArgumentException("The MVP and Vertical Slice Definition changed while Definition of Ready was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (prioritization.Candidate is not { } currentPrioritization ||
                projection.PrioritizationModelRecordId != currentPrioritization.Id ||
                projection.PrioritizationModelRevision != currentPrioritization.Revision ||
                projection.PrioritizationModelDigest != currentPrioritization.Digest))
        {
            throw new ArgumentException("The Prioritization Model changed while Definition of Ready was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (criteria.Candidate is not { } currentCriteria || projection.AcceptanceCriteriaRecordId != currentCriteria.Id ||
                projection.AcceptanceCriteriaRevision != currentCriteria.Revision || projection.AcceptanceCriteriaDigest != currentCriteria.Digest))
        {
            throw new ArgumentException("Acceptance Criteria changed while Definition of Ready was read. Refresh the exact records.");
        }
        return RenderDefinitionOfReady(projection);
    }

    public static string RenderDefinitionOfReady(DefinitionOfReadyProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Definition of Ready candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.Result} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Coverage: {projection.SubjectCount} Story/Task subjects · {projection.PolicyEntryCount} prerequisites · " +
                $"{projection.EvaluationCount}/{projection.ExpectedEvaluationCount} evaluations · {projection.MissingEvaluationCount} missing")
            .AppendLine(
                $"Evaluation states: {projection.CandidateSatisfiedCount} candidate-satisfied · {projection.NotApplicableCount} not-applicable candidates · " +
                $"{projection.NotSatisfiedCount} not satisfied · {projection.ExceptionCandidateCount} exception candidates · " +
                $"{projection.NotAssessedCount} unassessed · {projection.StaleEvaluationCount} stale · {projection.InvalidEvaluationCount} invalid")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.ExpiredCount} expired · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleHierarchyCount} stale hierarchies · " +
                $"{projection.StaleMvpSliceDefinitionCount} stale MVP definitions · " +
                $"{projection.StalePrioritizationModelCount} stale prioritization models · " +
                $"{projection.StaleAcceptanceCriteriaCount} stale Acceptance Criteria");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Definition of Ready candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Policy version: {candidate.PolicyVersion} · valid until {candidate.ValidUntil:O}")
                .AppendLine($"Subject catalog digest: {candidate.SubjectCatalogDigest}")
                .AppendLine($"Policy digest: {candidate.PolicyDigest}")
                .AppendLine($"Evaluation digest: {candidate.EvaluationDigest}")
                .AppendLine($"Receipt digest: {candidate.ReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.PolicyEntryCount} prerequisites · " +
                    $"{candidate.EvaluationCount} evaluations · {candidate.ReviewState}");
        }
        else output.AppendLine("Definition of Ready candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, validity time, and subject, policy, evaluation, receipt, " +
                "and snapshot digests only; no rules, rationales, evidence identities, assessor identities, or personal data. " +
                "A candidate pass is an evaluation result, not admission, readiness, assignment, execution, implementation " +
                "permission, exception or waiver authority, phase entry, acceptance, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDefinitionOfDoneAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var hierarchy = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        var mvp = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        var prioritization = await client.ReadPrioritizationModelAsync(initiativeId, cancellationToken);
        var criteria = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        var ready = await client.ReadDefinitionOfReadyAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDefinitionOfDoneAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Definition of Done was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (hierarchy.Candidate is not { } currentHierarchy || projection.HierarchyRecordId != currentHierarchy.Id ||
                projection.HierarchyRevision != currentHierarchy.Revision || projection.HierarchyDigest != currentHierarchy.Digest))
        {
            throw new ArgumentException("The Backlog Hierarchy changed while Definition of Done was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (mvp.Candidate is not { } currentMvp || projection.MvpSliceDefinitionRecordId != currentMvp.Id ||
                projection.MvpSliceDefinitionRevision != currentMvp.Revision || projection.MvpSliceDefinitionDigest != currentMvp.Digest))
        {
            throw new ArgumentException("The MVP and Vertical Slice Definition changed while Definition of Done was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (prioritization.Candidate is not { } currentPrioritization ||
                projection.PrioritizationModelRecordId != currentPrioritization.Id ||
                projection.PrioritizationModelRevision != currentPrioritization.Revision ||
                projection.PrioritizationModelDigest != currentPrioritization.Digest))
        {
            throw new ArgumentException("The Prioritization Model changed while Definition of Done was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (criteria.Candidate is not { } currentCriteria || projection.AcceptanceCriteriaRecordId != currentCriteria.Id ||
                projection.AcceptanceCriteriaRevision != currentCriteria.Revision || projection.AcceptanceCriteriaDigest != currentCriteria.Digest))
        {
            throw new ArgumentException("Acceptance Criteria changed while Definition of Done was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (ready.Candidate is not { } currentReady || projection.DefinitionOfReadyRecordId != currentReady.Id ||
                projection.DefinitionOfReadyRevision != currentReady.Revision || projection.DefinitionOfReadyDigest != currentReady.Digest))
        {
            throw new ArgumentException("Definition of Ready changed while Definition of Done was read. Refresh the exact records.");
        }
        return RenderDefinitionOfDone(projection);
    }

    public static string RenderDefinitionOfDone(DefinitionOfDoneProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Definition of Done candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.Result} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Coverage: {projection.SubjectCount} Story/Task subjects · {projection.PolicyEntryCount} completion prerequisites · " +
                $"{projection.EvaluationCount}/{projection.ExpectedEvaluationCount} evaluations · {projection.MissingEvaluationCount} missing")
            .AppendLine(
                $"Evaluation states: {projection.CandidateSatisfiedCount} candidate-satisfied · {projection.NotApplicableCount} not-applicable candidates · " +
                $"{projection.NotSatisfiedCount} not satisfied · {projection.ExceptionCandidateCount} exception candidates · " +
                $"{projection.NotAssessedCount} unassessed · {projection.StaleEvaluationCount} stale · {projection.InvalidEvaluationCount} invalid")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.ExpiredCount} expired · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleHierarchyCount} stale hierarchies · " +
                $"{projection.StaleMvpSliceDefinitionCount} stale MVP definitions · " +
                $"{projection.StalePrioritizationModelCount} stale prioritization models · " +
                $"{projection.StaleAcceptanceCriteriaCount} stale Acceptance Criteria · " +
                $"{projection.StaleDefinitionOfReadyCount} stale Definitions of Ready");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Definition of Done candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Policy version: {candidate.PolicyVersion} · valid until {candidate.ValidUntil:O}")
                .AppendLine($"Subject catalog digest: {candidate.SubjectCatalogDigest}")
                .AppendLine($"Policy digest: {candidate.PolicyDigest}")
                .AppendLine($"Evaluation digest: {candidate.EvaluationDigest}")
                .AppendLine($"Receipt digest: {candidate.ReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.PolicyEntryCount} completion prerequisites · " +
                    $"{candidate.EvaluationCount} evaluations · {candidate.ReviewState}");
        }
        else output.AppendLine("Definition of Done candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, validity time, and subject, policy, evaluation, receipt, " +
                "and snapshot digests only; no rules, rationales, evidence identities, assessor identities, or personal data. " +
                "A candidate pass is an evaluation result, not completion, acceptance, approval, merge, release, deployment, " +
                "implementation completeness, exception or waiver authority, assignment, execution, or action permission.")
            .ToString();
    }

    public async Task<string> ReadImplementationUnitModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var hierarchy = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        var mvp = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        var criteria = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        var ready = await client.ReadDefinitionOfReadyAsync(initiativeId, cancellationToken);
        var done = await client.ReadDefinitionOfDoneAsync(initiativeId, cancellationToken);
        var projection = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Implementation Unit Model was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (hierarchy.Candidate is not { } currentHierarchy || projection.HierarchyRecordId != currentHierarchy.Id ||
                projection.HierarchyRevision != currentHierarchy.Revision || projection.HierarchyDigest != currentHierarchy.Digest))
        {
            throw new ArgumentException("The Backlog Hierarchy changed while Implementation Unit Model was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (mvp.Candidate is not { } currentMvp || projection.MvpSliceDefinitionRecordId != currentMvp.Id ||
                projection.MvpSliceDefinitionRevision != currentMvp.Revision || projection.MvpSliceDefinitionDigest != currentMvp.Digest))
        {
            throw new ArgumentException("The MVP and Vertical Slice Definition changed while Implementation Unit Model was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (criteria.Candidate is not { } currentCriteria || projection.AcceptanceCriteriaRecordId != currentCriteria.Id ||
                projection.AcceptanceCriteriaRevision != currentCriteria.Revision || projection.AcceptanceCriteriaDigest != currentCriteria.Digest))
        {
            throw new ArgumentException("Acceptance Criteria changed while Implementation Unit Model was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (ready.Candidate is not { } currentReady || projection.DefinitionOfReadyRecordId != currentReady.Id ||
                projection.DefinitionOfReadyRevision != currentReady.Revision || projection.DefinitionOfReadyDigest != currentReady.Digest))
        {
            throw new ArgumentException("Definition of Ready changed while Implementation Unit Model was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (done.Candidate is not { } currentDone || projection.DefinitionOfDoneRecordId != currentDone.Id ||
                projection.DefinitionOfDoneRevision != currentDone.Revision || projection.DefinitionOfDoneDigest != currentDone.Digest))
        {
            throw new ArgumentException("Definition of Done changed while Implementation Unit Model was read. Refresh the exact records.");
        }
        return RenderImplementationUnitModel(projection);
    }

    public static string RenderImplementationUnitModel(ImplementationUnitModelProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Implementation Unit Model candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Coverage: {projection.UnitCount} units · {projection.SubjectCount} Story/Task subjects · " +
                $"{projection.RequirementReferenceCount} Requirement references · {projection.RepositoryCandidateCount} repository candidates · " +
                $"{projection.OwnerCandidateCount} owner candidates")
            .AppendLine(
                $"Dependencies and impact: {projection.DependencyEdgeCount} dependency edges · " +
                $"{projection.CandidateAssessedBlastRadiusCount} blast radii candidate-assessed · " +
                $"{projection.NotAssessedBlastRadiusCount} not assessed")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.MissingSubjectCount} missing subjects · " +
                $"{projection.InvalidUnitCount} invalid units · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleHierarchyCount} stale hierarchies · {projection.StaleMvpSliceDefinitionCount} stale MVP definitions · " +
                $"{projection.StaleAcceptanceCriteriaCount} stale Acceptance Criteria · " +
                $"{projection.StaleDefinitionOfReadyCount} stale Definitions of Ready · " +
                $"{projection.StaleDefinitionOfDoneCount} stale Definitions of Done");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Implementation Unit Model candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Placement digest: {candidate.PlacementDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.UnitCount} units · {candidate.SubjectCount} subjects · " +
                    $"{candidate.RequirementReferenceCount} Requirement references · {candidate.ReviewState}");
        }
        else output.AppendLine("Implementation Unit Model candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and membership, placement, assessment-receipt, and " +
                "snapshot digests only; no unit titles, boundaries, Story, Task, or Requirement identities, repository keys, " +
                "module paths, owner identities, evidence, rationales, or personal data. Candidate completeness does not " +
                "establish repository truth, owner appointment, dependency or impact completeness, implementation readiness " +
                "or completeness, assignment, execution, approval, acceptance, merge, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDependencyMappingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var hierarchy = await client.ReadBacklogHierarchyAsync(initiativeId, cancellationToken);
        var mvp = await client.ReadMvpSliceDefinitionAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDependencyMappingAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Dependency Mapping was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (hierarchy.Candidate is not { } currentHierarchy || projection.HierarchyRecordId != currentHierarchy.Id ||
                projection.HierarchyRevision != currentHierarchy.Revision || projection.HierarchyDigest != currentHierarchy.Digest))
        {
            throw new ArgumentException("The Backlog Hierarchy changed while Dependency Mapping was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (mvp.Candidate is not { } currentMvp || projection.MvpSliceDefinitionRecordId != currentMvp.Id ||
                projection.MvpSliceDefinitionRevision != currentMvp.Revision || projection.MvpSliceDefinitionDigest != currentMvp.Digest))
        {
            throw new ArgumentException("The MVP and Vertical Slice Definition changed while Dependency Mapping was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (units.Candidate is not { } currentUnits || projection.ImplementationUnitModelRecordId != currentUnits.Id ||
                projection.ImplementationUnitModelRevision != currentUnits.Revision ||
                projection.ImplementationUnitModelDigest != currentUnits.Digest))
        {
            throw new ArgumentException("The Implementation Unit Model changed while Dependency Mapping was read. Refresh the exact records.");
        }
        return RenderDependencyMapping(projection);
    }

    public static string RenderDependencyMapping(DependencyMappingProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Dependency Mapping candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Graph coverage: {projection.NodeCount} nodes · {projection.EdgeCount} edges · " +
                $"{projection.RequiredEdgeCount} required · {projection.ConditionalEdgeCount} conditional · {projection.AdvisoryEdgeCount} advisory")
            .AppendLine(
                $"Candidate critical path: {projection.CriticalPathUnitCount} units · " +
                $"{projection.CriticalPathCandidateEffortPoints} candidate effort points · " +
                $"{projection.RootNodeCount} roots · {projection.LeafNodeCount} leaves")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.MissingNodeCount} missing nodes · " +
                $"{projection.MissingDeclaredEdgeCount} missing declared edges · {projection.ExtraEdgeCount} extra edges · " +
                $"{projection.InvalidNodeCount} invalid nodes · {projection.InvalidEdgeCount} invalid edges · " +
                $"{projection.CycleCount} cycles · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleHierarchyCount} stale hierarchies · {projection.StaleMvpSliceDefinitionCount} stale MVP definitions · " +
                $"{projection.StaleImplementationUnitModelCount} stale Implementation Unit Models");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Dependency Mapping candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Graph digest: {candidate.GraphDigest}")
                .AppendLine($"Critical-path digest: {candidate.CriticalPathDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.NodeCount} nodes · {candidate.EdgeCount} edges · " +
                    $"{candidate.CriticalPathUnitCount} critical-path units · " +
                    $"{candidate.CriticalPathCandidateEffortPoints} candidate effort points · {candidate.ReviewState}");
        }
        else output.AppendLine("Dependency Mapping candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and graph, critical-path, assessment-receipt, and " +
                "snapshot digests only; no unit, node, edge, evidence, rationale, estimate, owner, repository, module, " +
                "Requirement, architecture, risk, test, or personal data. Candidate completeness does not establish " +
                "dependency truth or completeness, critical-path authority, sequencing commitment, ownership appointment, " +
                "implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, " +
                "deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadTechnologyProfileAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var dependencyMapping = await client.ReadDependencyMappingAsync(initiativeId, cancellationToken);
        var projection = await client.ReadTechnologyProfileAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Technology Profile was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (units.Candidate is not { } currentUnits || projection.ImplementationUnitModelRecordId != currentUnits.Id ||
                projection.ImplementationUnitModelRevision != currentUnits.Revision ||
                projection.ImplementationUnitModelDigest != currentUnits.Digest))
        {
            throw new ArgumentException("The Implementation Unit Model changed while Technology Profile was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (dependencyMapping.Candidate is not { } currentDependencyMapping ||
                projection.DependencyMappingRecordId != currentDependencyMapping.Id ||
                projection.DependencyMappingRevision != currentDependencyMapping.Revision ||
                projection.DependencyMappingDigest != currentDependencyMapping.Digest))
        {
            throw new ArgumentException("The Dependency Mapping changed while Technology Profile was read. Refresh the exact records.");
        }
        return RenderTechnologyProfile(projection);
    }

    public static string RenderTechnologyProfile(TechnologyProfileProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Technology Profile candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Candidate coverage: {projection.UnitProfileCount} unit profiles · {projection.TechnologyChoiceCount} choices · " +
                $"{projection.ExactVersionCandidateCount} exact versions · {projection.RangeVersionCandidateCount} ranges · " +
                $"{projection.UnresolvedVersionCount} unresolved versions · {projection.ConstraintCount} constraints")
            .AppendLine(
                $"Candidate policy gaps: {projection.UnsupportedChoiceCount} unsupported · " +
                $"{projection.LifecycleRiskCount} lifecycle risks · {projection.CompatibilityConflictCount} compatibility conflicts · " +
                $"{projection.LicenseReviewRequiredCount} license reviews · {projection.LicenseProhibitedCount} license-prohibited · " +
                $"{projection.SecurityReviewRequiredCount} security reviews · {projection.SecurityNonconformantCount} security-nonconformant · " +
                $"{projection.ExceptionCandidateCount} exception candidates · {projection.ConstraintConflictCount} constraint conflicts")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.MissingProfileCount} missing profiles · " +
                $"{projection.InvalidProfileCount} invalid profiles · {projection.MissingEvidenceCount} missing evidence · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleImplementationUnitModelCount} stale Implementation Unit Models · " +
                $"{projection.StaleDependencyMappingCount} stale Dependency Mappings");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Technology Profile candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Profile catalog digest: {candidate.ProfileCatalogDigest}")
                .AppendLine($"Selection catalog digest: {candidate.SelectionCatalogDigest}")
                .AppendLine($"Compatibility assessment receipt digest: {candidate.CompatibilityAssessmentReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.UnitProfileCount} unit profiles · {candidate.TechnologyChoiceCount} choices · " +
                    $"{candidate.ConstraintCount} constraints · {candidate.ReviewState}");
        }
        else output.AppendLine("Technology Profile candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and profile, selection, compatibility, assessment, " +
                "and snapshot digests only; no technology names, versions, constraints, evidence, rationale, unit, architecture, " +
                "repository, toolchain, license, security-policy, or personal data. Candidate completeness does not establish " +
                "technology approval, support commitment, compatibility truth or completeness, licensing or security approval, " +
                "exception or waiver authority, architecture-baseline designation, implementation readiness or completeness, " +
                "assignment, execution, approval, acceptance, merge, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBoilerplateRegistryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var technologyProfile = await client.ReadTechnologyProfileAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBoilerplateRegistryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Boilerplate Registry was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (units.Candidate is not { } currentUnits || projection.ImplementationUnitModelRecordId != currentUnits.Id ||
                projection.ImplementationUnitModelRevision != currentUnits.Revision ||
                projection.ImplementationUnitModelDigest != currentUnits.Digest))
        {
            throw new ArgumentException("The Implementation Unit Model changed while Boilerplate Registry was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (technologyProfile.Candidate is not { } currentTechnologyProfile ||
                projection.TechnologyProfileRecordId != currentTechnologyProfile.Id ||
                projection.TechnologyProfileRevision != currentTechnologyProfile.Revision ||
                projection.TechnologyProfileDigest != currentTechnologyProfile.Digest))
        {
            throw new ArgumentException("The Technology Profile changed while Boilerplate Registry was read. Refresh the exact records.");
        }
        return RenderBoilerplateRegistry(projection);
    }

    public static string RenderBoilerplateRegistry(BoilerplateRegistryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Boilerplate Registry candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Candidate coverage: {projection.EntryCount} entries · {projection.ExactVersionCandidateCount} exact versions · " +
                $"{projection.RangeVersionCandidateCount} ranges · {projection.UnresolvedVersionCount} unresolved versions · " +
                $"{projection.MandatoryCandidateCount} mandatory candidates")
            .AppendLine(
                $"Candidate asset gaps: {projection.UnavailableEntryCount} unavailable · {projection.IntegrityMismatchCount} integrity gaps · " +
                $"{projection.ProvenanceGapCount} provenance gaps · {projection.MissingEvidenceCount} missing evidence")
            .AppendLine(
                $"Candidate policy gaps: {projection.UnsupportedEntryCount} unsupported · {projection.LifecycleRiskCount} lifecycle risks · " +
                $"{projection.TechnologyConflictCount} technology conflicts · {projection.ArchitectureConflictCount} architecture conflicts · " +
                $"{projection.LicenseReviewRequiredCount} license reviews · {projection.LicenseProhibitedCount} license-prohibited · " +
                $"{projection.SecurityReviewRequiredCount} security reviews · {projection.SecurityNonconformantCount} security-nonconformant · " +
                $"{projection.ExceptionCandidateCount} exception candidates")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.InvalidRegistryCount} invalid registries · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleImplementationUnitModelCount} stale Implementation Unit Models · " +
                $"{projection.StaleTechnologyProfileCount} stale Technology Profiles");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Boilerplate Registry candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Entry catalog digest: {candidate.EntryCatalogDigest}")
                .AppendLine($"Source catalog digest: {candidate.SourceCatalogDigest}")
                .AppendLine($"Compatibility assessment receipt digest: {candidate.CompatibilityAssessmentReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.EntryCount} entries · {candidate.MandatoryCandidateCount} mandatory candidates · " +
                    $"{candidate.ReviewState}");
        }
        else output.AppendLine("Boilerplate Registry candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and entry, source, compatibility, assessment, " +
                "and snapshot digests only; no boilerplate names, locators, versions, capabilities, limitations, evidence, " +
                "rationale, technology, unit, architecture, repository, template, license, security-policy, or personal data. " +
                "Candidate completeness does not establish organizational designation, endorsement, approval, support " +
                "commitment, compatibility truth or completeness, licensing or security approval, exception or waiver, " +
                "selection or binding, architecture baseline, implementation readiness or completeness, assignment, execution, " +
                "acceptance, merge, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBoilerplateSelectionBindingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var dependencyMapping = await client.ReadDependencyMappingAsync(initiativeId, cancellationToken);
        var technologyProfile = await client.ReadTechnologyProfileAsync(initiativeId, cancellationToken);
        var boilerplateRegistry = await client.ReadBoilerplateRegistryAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBoilerplateSelectionBindingAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Boilerplate Selection and Binding was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (units.Candidate is not { } currentUnits || projection.ImplementationUnitModelRecordId != currentUnits.Id ||
                projection.ImplementationUnitModelRevision != currentUnits.Revision ||
                projection.ImplementationUnitModelDigest != currentUnits.Digest))
        {
            throw new ArgumentException("The Implementation Unit Model changed while Boilerplate Selection and Binding was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (dependencyMapping.Candidate is not { } currentDependencyMapping ||
                projection.DependencyMappingRecordId != currentDependencyMapping.Id ||
                projection.DependencyMappingRevision != currentDependencyMapping.Revision ||
                projection.DependencyMappingDigest != currentDependencyMapping.Digest))
        {
            throw new ArgumentException("The Dependency Mapping changed while Boilerplate Selection and Binding was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (technologyProfile.Candidate is not { } currentTechnologyProfile ||
                projection.TechnologyProfileRecordId != currentTechnologyProfile.Id ||
                projection.TechnologyProfileRevision != currentTechnologyProfile.Revision ||
                projection.TechnologyProfileDigest != currentTechnologyProfile.Digest))
        {
            throw new ArgumentException("The Technology Profile changed while Boilerplate Selection and Binding was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (boilerplateRegistry.Candidate is not { } currentBoilerplateRegistry ||
                projection.BoilerplateRegistryRecordId != currentBoilerplateRegistry.Id ||
                projection.BoilerplateRegistryRevision != currentBoilerplateRegistry.Revision ||
                projection.BoilerplateRegistryDigest != currentBoilerplateRegistry.Digest))
        {
            throw new ArgumentException("The Boilerplate Registry changed while Boilerplate Selection and Binding was read. Refresh the exact records.");
        }
        return RenderBoilerplateSelectionBinding(projection);
    }

    public static string RenderBoilerplateSelectionBinding(BoilerplateSelectionBindingProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Boilerplate Selection and Binding candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Candidate coverage: {projection.DecisionCount} decisions · {projection.SelectedCandidateCount} selected · " +
                $"{projection.NotApplicableCandidateCount} not applicable · {projection.DeferredCandidateCount} deferred · " +
                $"{projection.NotAssessedCount} not assessed")
            .AppendLine(
                $"Candidate decision gaps: {projection.MissingUnitDecisionCount} missing unit decisions · " +
                $"{projection.InvalidSelectionCount} invalid selections · {projection.RegistryGapCount} registry gaps · " +
                $"{projection.ProfileMismatchCount} profile mismatches · {projection.UnitScopeMismatchCount} unit-scope mismatches · " +
                $"{projection.VersionMismatchCount} version mismatches · {projection.MissingEvidenceCount} missing evidence")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleImplementationUnitModelCount} stale Implementation Unit Models · " +
                $"{projection.StaleDependencyMappingCount} stale Dependency Mappings · " +
                $"{projection.StaleTechnologyProfileCount} stale Technology Profiles · " +
                $"{projection.StaleBoilerplateRegistryCount} stale Boilerplate Registries · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Boilerplate Selection and Binding candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Unit decision catalog digest: {candidate.UnitDecisionCatalogDigest}")
                .AppendLine($"Selection receipt digest: {candidate.SelectionReceiptDigest}")
                .AppendLine($"Binding receipt digest: {candidate.BindingReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine($"Candidate coverage: {candidate.DecisionCount} decisions · {candidate.SelectedCandidateCount} selected · {candidate.ReviewState}");
        }
        else output.AppendLine("Boilerplate Selection and Binding candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and unit-decision, selection, binding, assessment, " +
                "and snapshot digests only; no boilerplate names, locators, versions, unit or profile identities, rationale, " +
                "conditions, alternatives, deviations, evidence, decision roles, or personal data. Candidate completeness does " +
                "not establish organizational designation, endorsement, approval, support commitment, effective selection or " +
                "binding, compatibility truth, completeness, or validation, licensing or security approval, exception or waiver, " +
                "source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, " +
                "assignment, execution, acceptance, merge, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadBoilerplateCompatibilityValidationAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var dependencyMapping = await client.ReadDependencyMappingAsync(initiativeId, cancellationToken);
        var technologyProfile = await client.ReadTechnologyProfileAsync(initiativeId, cancellationToken);
        var boilerplateRegistry = await client.ReadBoilerplateRegistryAsync(initiativeId, cancellationToken);
        var selectionBinding = await client.ReadBoilerplateSelectionBindingAsync(initiativeId, cancellationToken);
        var projection = await client.ReadBoilerplateCompatibilityValidationAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Boilerplate Compatibility Validation was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (units.Candidate is not { } currentUnits || projection.ImplementationUnitModelRecordId != currentUnits.Id ||
                projection.ImplementationUnitModelRevision != currentUnits.Revision ||
                projection.ImplementationUnitModelDigest != currentUnits.Digest))
        {
            throw new ArgumentException("The Implementation Unit Model changed while Boilerplate Compatibility Validation was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (dependencyMapping.Candidate is not { } currentDependencyMapping ||
                projection.DependencyMappingRecordId != currentDependencyMapping.Id ||
                projection.DependencyMappingRevision != currentDependencyMapping.Revision ||
                projection.DependencyMappingDigest != currentDependencyMapping.Digest))
        {
            throw new ArgumentException("The Dependency Mapping changed while Boilerplate Compatibility Validation was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (technologyProfile.Candidate is not { } currentTechnologyProfile ||
                projection.TechnologyProfileRecordId != currentTechnologyProfile.Id ||
                projection.TechnologyProfileRevision != currentTechnologyProfile.Revision ||
                projection.TechnologyProfileDigest != currentTechnologyProfile.Digest))
        {
            throw new ArgumentException("The Technology Profile changed while Boilerplate Compatibility Validation was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (boilerplateRegistry.Candidate is not { } currentBoilerplateRegistry ||
                projection.BoilerplateRegistryRecordId != currentBoilerplateRegistry.Id ||
                projection.BoilerplateRegistryRevision != currentBoilerplateRegistry.Revision ||
                projection.BoilerplateRegistryDigest != currentBoilerplateRegistry.Digest))
        {
            throw new ArgumentException("The Boilerplate Registry changed while Boilerplate Compatibility Validation was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null &&
            (selectionBinding.Candidate is not { } currentSelectionBinding ||
                projection.BoilerplateSelectionBindingRecordId != currentSelectionBinding.Id ||
                projection.BoilerplateSelectionBindingRevision != currentSelectionBinding.Revision ||
                projection.BoilerplateSelectionBindingDigest != currentSelectionBinding.Digest))
        {
            throw new ArgumentException("The Boilerplate Selection and Binding changed while Boilerplate Compatibility Validation was read. Refresh the exact records.");
        }
        return RenderBoilerplateCompatibilityValidation(projection);
    }

    public static string RenderBoilerplateCompatibilityValidation(BoilerplateCompatibilityValidationProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Boilerplate Compatibility Validation candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Candidate coverage: {projection.SelectedBindingCount} selected bindings · {projection.SubjectCount} subjects · " +
                $"{projection.DimensionAssessmentCount} dimension assessments")
            .AppendLine(
                $"Candidate outcomes: {projection.CompatibleCandidateCount} compatible · " +
                $"{projection.IncompatibleCandidateCount} incompatible · {projection.ExceptionCandidateCount} exception candidates · " +
                $"{projection.NotAssessedCount} not assessed")
            .AppendLine(
                $"Candidate validation gaps: {projection.MissingSubjectCount} missing subjects · " +
                $"{projection.InvalidSubjectCount} invalid subjects · {projection.MissingDimensionCount} missing dimensions · " +
                $"{projection.MissingEvidenceCount} missing evidence · {projection.ExpiredAssessmentCount} expired assessments · " +
                $"{projection.ConflictingOutcomeCount} conflicting outcomes · {projection.SelectionBindingGapCount} selection-binding gaps")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleImplementationUnitModelCount} stale Implementation Unit Models · " +
                $"{projection.StaleDependencyMappingCount} stale Dependency Mappings · " +
                $"{projection.StaleTechnologyProfileCount} stale Technology Profiles · " +
                $"{projection.StaleBoilerplateRegistryCount} stale Boilerplate Registries · " +
                $"{projection.StaleSelectionBindingCount} stale Selection Bindings · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Boilerplate Compatibility Validation candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Validation subject catalog digest: {candidate.ValidationSubjectCatalogDigest}")
                .AppendLine($"Dimension catalog digest: {candidate.DimensionCatalogDigest}")
                .AppendLine($"Evidence receipt digest: {candidate.EvidenceReceiptDigest}")
                .AppendLine($"Validation receipt digest: {candidate.ValidationReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.CompatibleCandidateCount} compatible · " +
                    $"{candidate.IncompatibleCandidateCount} incompatible · {candidate.ExceptionCandidateCount} exception candidates · " +
                    $"{candidate.NotAssessedCount} not assessed · {candidate.DimensionAssessmentCount} dimensions · {candidate.ReviewState}");
        }
        else output.AppendLine("Boilerplate Compatibility Validation candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and subject, dimension, evidence, validation, " +
                "assessment, and snapshot digests only; no boilerplate names, locators, versions, unit, profile, entry, or " +
                "binding identities, claims, evidence, assessors, or personal data. Candidate completeness does not establish " +
                "compatibility truth or completeness, a validation decision, actual asset behavior, test execution, design " +
                "validity, security, privacy, or licensing approval, exception or waiver, effective selection or binding, " +
                "source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, " +
                "assignment, execution, acceptance, merge, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadFigmaToBoilerplateMappingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var designApplicability = await client.ReadDesignApplicabilityAsync(initiativeId, cancellationToken);
        var designSystem = await client.ReadDesignSystemTokenContractAsync(initiativeId, cancellationToken);
        var responsiveTargets = await client.ReadResponsiveMultiPlatformTargetsAsync(initiativeId, cancellationToken);
        var finalizedSnapshot = await client.ReadFinalizedFigmaSnapshotImportAsync(initiativeId, cancellationToken);
        var designBinding = await client.ReadDesignToRequirementBindingAsync(initiativeId, cancellationToken);
        var designBaseline = await client.ReadDesignBaselineAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var technologyProfile = await client.ReadTechnologyProfileAsync(initiativeId, cancellationToken);
        var registry = await client.ReadBoilerplateRegistryAsync(initiativeId, cancellationToken);
        var selectionBinding = await client.ReadBoilerplateSelectionBindingAsync(initiativeId, cancellationToken);
        var compatibilityValidation = await client.ReadBoilerplateCompatibilityValidationAsync(initiativeId, cancellationToken);
        var projection = await client.ReadFigmaToBoilerplateMappingAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Figma-to-Boilerplate Mapping was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null)
        {
            void RequireDependency(string name, Guid id, long revision, string digest)
            {
                if (!projection.Dependencies.TryGetValue(name, out var reference) || reference.RecordId != id ||
                    reference.Revision != revision || reference.Digest != digest)
                {
                    throw new ArgumentException($"The {name} candidate changed while Figma-to-Boilerplate Mapping was read. Refresh the exact records.");
                }
            }
            if (designApplicability.Candidate is not { } designApplicabilityCandidate ||
                designSystem.Candidate is not { } designSystemCandidate ||
                responsiveTargets.Candidate is not { } responsiveTargetsCandidate ||
                finalizedSnapshot.Candidate is not { } finalizedSnapshotCandidate ||
                designBinding.Candidate is not { } designBindingCandidate ||
                designBaseline.Candidate is not { } designBaselineCandidate ||
                units.Candidate is not { } unitsCandidate ||
                technologyProfile.Candidate is not { } technologyProfileCandidate ||
                registry.Candidate is not { } registryCandidate ||
                selectionBinding.Candidate is not { } selectionBindingCandidate ||
                compatibilityValidation.Candidate is not { } compatibilityValidationCandidate)
            {
                throw new ArgumentException("One or more exact current dependency candidates are unavailable. Refresh the exact records.");
            }
            RequireDependency("designApplicability", designApplicabilityCandidate.Id, designApplicabilityCandidate.Revision, designApplicabilityCandidate.Digest);
            RequireDependency("designSystemTokenContract", designSystemCandidate.Id, designSystemCandidate.Revision, designSystemCandidate.Digest);
            RequireDependency("responsiveMultiPlatformTargets", responsiveTargetsCandidate.Id, responsiveTargetsCandidate.Revision, responsiveTargetsCandidate.Digest);
            RequireDependency("finalizedFigmaSnapshotImport", finalizedSnapshotCandidate.Id, finalizedSnapshotCandidate.Revision, finalizedSnapshotCandidate.Digest);
            RequireDependency("designToRequirementBinding", designBindingCandidate.Id, designBindingCandidate.Revision, designBindingCandidate.Digest);
            RequireDependency("designBaseline", designBaselineCandidate.Id, designBaselineCandidate.Revision, designBaselineCandidate.Digest);
            RequireDependency("implementationUnitModel", unitsCandidate.Id, unitsCandidate.Revision, unitsCandidate.Digest);
            RequireDependency("technologyProfile", technologyProfileCandidate.Id, technologyProfileCandidate.Revision, technologyProfileCandidate.Digest);
            RequireDependency("boilerplateRegistry", registryCandidate.Id, registryCandidate.Revision, registryCandidate.Digest);
            RequireDependency("boilerplateSelectionBinding", selectionBindingCandidate.Id, selectionBindingCandidate.Revision, selectionBindingCandidate.Digest);
            RequireDependency("boilerplateCompatibilityValidation", compatibilityValidationCandidate.Id, compatibilityValidationCandidate.Revision, compatibilityValidationCandidate.Digest);
        }
        return RenderFigmaToBoilerplateMapping(projection);
    }

    public static string RenderFigmaToBoilerplateMapping(FigmaToBoilerplateMappingProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Figma-to-Boilerplate Mapping candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Candidate coverage: {projection.DesignBindingCount} design bindings · {projection.SubjectCount} mapping subjects")
            .AppendLine(
                $"Candidate outcomes: {projection.MappedCandidateCount} mapped · {projection.ConflictCandidateCount} conflicts · " +
                $"{projection.UnmappedCandidateCount} unmapped · {projection.NotAssessedCount} not assessed")
            .AppendLine(
                $"Candidate kinds: {projection.ComponentMappingCount} component · {projection.TokenMappingCount} token · " +
                $"{projection.LayoutMappingCount} layout · {projection.ResponsiveBehaviorMappingCount} responsive · " +
                $"{projection.PlatformTargetMappingCount} platform-target")
            .AppendLine(
                $"Candidate mapping gaps: {projection.MissingSubjectCount} missing subjects · {projection.InvalidSubjectCount} invalid subjects · " +
                $"{projection.TargetGapCount} target gaps · {projection.TraceGapCount} trace gaps · {projection.EvidenceGapCount} evidence gaps")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Figma-to-Boilerplate Mapping candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Mapping subject catalog digest: {candidate.MappingSubjectCatalogDigest}")
                .AppendLine($"Target catalog digest: {candidate.TargetCatalogDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Mapping receipt digest: {candidate.MappingReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.MappedCandidateCount} mapped · " +
                    $"{candidate.ConflictCandidateCount} conflicts · {candidate.UnmappedCandidateCount} unmapped · " +
                    $"{candidate.NotAssessedCount} not assessed · {candidate.ReviewState}");
        }
        else output.AppendLine("Figma-to-Boilerplate Mapping candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and subject, target, trace, mapping, assessment, " +
                "and snapshot digests only; no Figma content, design-item, binding, unit, profile, registry-entry, " +
                "validation-subject, requirement, target-locator, evidence, reviewer, or personal data. This inspection " +
                "does not connect to or call Figma, establish returned Figma content, design validity, approval or baseline, " +
                "mapping truth or completeness, effective selection or compatibility truth, retrieve, import, instantiate, " +
                "generate or execute assets, establish implementation readiness or completeness, assign, execute, accept, " +
                "merge, release, deploy, or grant action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignToCodeBindingRegistryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var designBaseline = await client.ReadDesignBaselineAsync(initiativeId, cancellationToken);
        var finalizedSnapshot = await client.ReadFinalizedFigmaSnapshotImportAsync(initiativeId, cancellationToken);
        var designBinding = await client.ReadDesignToRequirementBindingAsync(initiativeId, cancellationToken);
        var figmaMapping = await client.ReadFigmaToBoilerplateMappingAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var technologyProfile = await client.ReadTechnologyProfileAsync(initiativeId, cancellationToken);
        var selectionBinding = await client.ReadBoilerplateSelectionBindingAsync(initiativeId, cancellationToken);
        var compatibilityValidation = await client.ReadBoilerplateCompatibilityValidationAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignToCodeBindingRegistryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design-to-Code Binding Registry was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null)
        {
            void RequireDependency(string name, Guid id, long revision, string digest)
            {
                if (!projection.Dependencies.TryGetValue(name, out var reference) || reference.RecordId != id ||
                    reference.Revision != revision || reference.Digest != digest)
                {
                    throw new ArgumentException($"The {name} candidate changed while Design-to-Code Binding Registry was read. Refresh the exact records.");
                }
            }
            if (designBaseline.Candidate is not { } designBaselineCandidate ||
                finalizedSnapshot.Candidate is not { } finalizedSnapshotCandidate ||
                designBinding.Candidate is not { } designBindingCandidate ||
                figmaMapping.Candidate is not { } figmaMappingCandidate ||
                units.Candidate is not { } unitsCandidate ||
                technologyProfile.Candidate is not { } technologyProfileCandidate ||
                selectionBinding.Candidate is not { } selectionBindingCandidate ||
                compatibilityValidation.Candidate is not { } compatibilityValidationCandidate)
            {
                throw new ArgumentException("One or more exact current dependency candidates are unavailable. Refresh the exact records.");
            }
            RequireDependency("designBaseline", designBaselineCandidate.Id, designBaselineCandidate.Revision, designBaselineCandidate.Digest);
            RequireDependency("finalizedFigmaSnapshotImport", finalizedSnapshotCandidate.Id, finalizedSnapshotCandidate.Revision, finalizedSnapshotCandidate.Digest);
            RequireDependency("designToRequirementBinding", designBindingCandidate.Id, designBindingCandidate.Revision, designBindingCandidate.Digest);
            RequireDependency("figmaToBoilerplateMapping", figmaMappingCandidate.Id, figmaMappingCandidate.Revision, figmaMappingCandidate.Digest);
            RequireDependency("implementationUnitModel", unitsCandidate.Id, unitsCandidate.Revision, unitsCandidate.Digest);
            RequireDependency("technologyProfile", technologyProfileCandidate.Id, technologyProfileCandidate.Revision, technologyProfileCandidate.Digest);
            RequireDependency("boilerplateSelectionBinding", selectionBindingCandidate.Id, selectionBindingCandidate.Revision, selectionBindingCandidate.Digest);
            RequireDependency("boilerplateCompatibilityValidation", compatibilityValidationCandidate.Id, compatibilityValidationCandidate.Revision, compatibilityValidationCandidate.Digest);
        }
        return RenderDesignToCodeBindingRegistry(projection);
    }

    public static string RenderDesignToCodeBindingRegistry(DesignToCodeBindingRegistryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Design-to-Code Binding Registry candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Candidate coverage: {projection.MappingSubjectCount} mapping subjects · {projection.SubjectCount} binding subjects")
            .AppendLine(
                $"Candidate outcomes: {projection.BoundCandidateCount} bound · {projection.ConflictCandidateCount} conflicts · " +
                $"{projection.UnboundCandidateCount} unbound · {projection.NotAssessedCount} not assessed")
            .AppendLine(
                $"Candidate binding gaps: {projection.MissingSubjectCount} missing subjects · {projection.InvalidSubjectCount} invalid subjects · " +
                $"{projection.TargetGapCount} target gaps · {projection.TraceGapCount} trace gaps · " +
                $"{projection.EvidenceGapCount} evidence gaps · {projection.DuplicateTargetCount} duplicate targets")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Design-to-Code Binding Registry candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Binding subject catalog digest: {candidate.BindingSubjectCatalogDigest}")
                .AppendLine($"Code target catalog digest: {candidate.CodeTargetCatalogDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Binding receipt digest: {candidate.BindingReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.BoundCandidateCount} bound · " +
                    $"{candidate.ConflictCandidateCount} conflicts · {candidate.UnboundCandidateCount} unbound · " +
                    $"{candidate.NotAssessedCount} not assessed · {candidate.ReviewState}");
        }
        else output.AppendLine("Design-to-Code Binding Registry candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and subject, target, trace, binding, assessment, " +
                "and snapshot digests only; no Figma content, design-item, mapping, unit, requirement, repository, module, " +
                "path, symbol, evidence, reviewer, or personal data. This inspection does not connect to or call Figma, " +
                "establish returned Figma content, design validity, approval or baseline, mapping or binding truth or " +
                "completeness, repository, path, or symbol truth, create or change code targets, retrieve, import, " +
                "instantiate, generate or execute assets, establish implementation readiness or completeness, assign, " +
                "execute, accept, merge, release, deploy, or grant action authority.")
            .ToString();
    }

    public async Task<string> ReadRouteScreenComponentMappingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var informationArchitecture = await client.ReadInformationArchitectureModelAsync(initiativeId, cancellationToken);
        var screenInventory = await client.ReadScreenStateInventoryAsync(initiativeId, cancellationToken);
        var designRequirements = await client.ReadDesignRequirementsAsync(initiativeId, cancellationToken);
        var designBaseline = await client.ReadDesignBaselineAsync(initiativeId, cancellationToken);
        var designBinding = await client.ReadDesignToRequirementBindingAsync(initiativeId, cancellationToken);
        var figmaMapping = await client.ReadFigmaToBoilerplateMappingAsync(initiativeId, cancellationToken);
        var designCodeBinding = await client.ReadDesignToCodeBindingRegistryAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var acceptance = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        var projection = await client.ReadRouteScreenComponentMappingAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Route, Screen, and Component Mapping was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null)
        {
            void RequireDependency(string name, Guid id, long revision, string digest)
            {
                if (!projection.Dependencies.TryGetValue(name, out var reference) || reference.RecordId != id ||
                    reference.Revision != revision || reference.Digest != digest)
                {
                    throw new ArgumentException($"The {name} candidate changed while Route, Screen, and Component Mapping was read. Refresh the exact records.");
                }
            }
            if (informationArchitecture.Candidate is not { } informationArchitectureCandidate ||
                screenInventory.Candidate is not { } screenInventoryCandidate ||
                designRequirements.Candidate is not { } designRequirementsCandidate ||
                designBaseline.Candidate is not { } designBaselineCandidate ||
                designBinding.Candidate is not { } designBindingCandidate ||
                figmaMapping.Candidate is not { } figmaMappingCandidate ||
                designCodeBinding.Candidate is not { } designCodeBindingCandidate ||
                units.Candidate is not { } unitsCandidate ||
                acceptance.Candidate is not { } acceptanceCandidate)
            {
                throw new ArgumentException("One or more exact current dependency candidates are unavailable. Refresh the exact records.");
            }
            RequireDependency("informationArchitecture", informationArchitectureCandidate.Id, informationArchitectureCandidate.Revision, informationArchitectureCandidate.Digest);
            RequireDependency("screenStateInventory", screenInventoryCandidate.Id, screenInventoryCandidate.Revision, screenInventoryCandidate.Digest);
            RequireDependency("designRequirements", designRequirementsCandidate.Id, designRequirementsCandidate.Revision, designRequirementsCandidate.Digest);
            RequireDependency("designBaseline", designBaselineCandidate.Id, designBaselineCandidate.Revision, designBaselineCandidate.Digest);
            RequireDependency("designToRequirementBinding", designBindingCandidate.Id, designBindingCandidate.Revision, designBindingCandidate.Digest);
            RequireDependency("figmaToBoilerplateMapping", figmaMappingCandidate.Id, figmaMappingCandidate.Revision, figmaMappingCandidate.Digest);
            RequireDependency("designToCodeBindingRegistry", designCodeBindingCandidate.Id, designCodeBindingCandidate.Revision, designCodeBindingCandidate.Digest);
            RequireDependency("implementationUnitModel", unitsCandidate.Id, unitsCandidate.Revision, unitsCandidate.Digest);
            RequireDependency("acceptanceCriteria", acceptanceCandidate.Id, acceptanceCandidate.Revision, acceptanceCandidate.Digest);
        }
        return RenderRouteScreenComponentMapping(projection);
    }

    public static string RenderRouteScreenComponentMapping(RouteScreenComponentMappingProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Route, Screen, and Component Mapping candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Source coverage: {projection.SourceRouteCount} routes · {projection.SourceScreenCount} screens · " +
                $"{projection.SourceStateCount} states · {projection.SourceComponentCount} components")
            .AppendLine(
                $"Candidate coverage: {projection.SubjectCount} subjects · {projection.RouteSubjectCount} routes · " +
                $"{projection.ScreenSubjectCount} screens · {projection.StateSubjectCount} states · " +
                $"{projection.ComponentSubjectCount} components")
            .AppendLine(
                $"Candidate outcomes: {projection.MappedCandidateCount} mapped · {projection.ConflictCandidateCount} conflicts · " +
                $"{projection.UnmappedCandidateCount} unmapped · {projection.NotAssessedCount} not assessed")
            .AppendLine(
                $"Candidate relationships: {projection.RelationshipCount} total · {projection.DefinedRelationshipCount} defined · " +
                $"{projection.ConflictRelationshipCount} conflicts · {projection.NotAssessedRelationshipCount} not assessed")
            .AppendLine(
                $"Candidate mapping gaps: {projection.MissingSubjectCount} missing subjects · {projection.ExtraSubjectCount} extra subjects · " +
                $"{projection.InvalidSubjectCount} invalid subjects · {projection.MissingRelationshipCount} missing relationships · " +
                $"{projection.InvalidRelationshipCount} invalid relationships · {projection.TraceGapCount} trace gaps · " +
                $"{projection.EvidenceGapCount} evidence gaps · {projection.ComponentPlacementGapCount} component placement gaps · " +
                $"{projection.TestHookGapCount} test-hook gaps")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Route, Screen, and Component Mapping candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Subject catalog digest: {candidate.SubjectCatalogDigest}")
                .AppendLine($"Relationship catalog digest: {candidate.RelationshipCatalogDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Mapping receipt digest: {candidate.MappingReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.SubjectCount} subjects · {candidate.RelationshipCount} relationships · " +
                    $"{candidate.MappedCandidateCount} mapped · {candidate.ConflictCandidateCount} conflicts · " +
                    $"{candidate.UnmappedCandidateCount} unmapped · {candidate.NotAssessedCount} not assessed · {candidate.ReviewState}");
        }
        else output.AppendLine("Route, Screen, and Component Mapping candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and subject, relationship, trace, mapping, " +
                "assessment, and snapshot digests only; no route patterns, screen, state, component, design, Requirement, " +
                "Acceptance Criteria, Implementation Unit, repository, module, path, symbol, test-hook, evidence, reviewer, " +
                "or personal data. This inspection does not connect to or call Figma, establish returned Figma content, " +
                "navigation or mapping truth, UI or design validity, repository or test truth, create or change code or " +
                "design targets, establish implementation readiness or completeness, assign, execute, accept, merge, " +
                "release, deploy, or grant action authority.")
            .ToString();
    }

    public async Task<string> ReadTestMethodologyAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var acceptance = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        var ready = await client.ReadDefinitionOfReadyAsync(initiativeId, cancellationToken);
        var done = await client.ReadDefinitionOfDoneAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var dependencies = await client.ReadDependencyMappingAsync(initiativeId, cancellationToken);
        var securityPrivacy = await client.ReadSecurityPrivacyAssessmentAsync(initiativeId, cancellationToken);
        var routeMapping = await client.ReadRouteScreenComponentMappingAsync(initiativeId, cancellationToken);
        var projection = await client.ReadTestMethodologyAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Test Methodology was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null)
        {
            void RequireDependency(string name, Guid id, long revision, string digest)
            {
                if (!projection.Dependencies.TryGetValue(name, out var reference) || reference.RecordId != id ||
                    reference.Revision != revision || reference.Digest != digest)
                {
                    throw new ArgumentException($"The {name} candidate changed while Test Methodology was read. Refresh the exact records.");
                }
            }
            if (acceptance.Candidate is not { } acceptanceCandidate || ready.Candidate is not { } readyCandidate ||
                done.Candidate is not { } doneCandidate || units.Candidate is not { } unitsCandidate ||
                dependencies.Candidate is not { } dependenciesCandidate || securityPrivacy.Assessment is not { } securityCandidate ||
                routeMapping.Candidate is not { } routeCandidate)
            {
                throw new ArgumentException("One or more exact current dependency candidates are unavailable. Refresh the exact records.");
            }
            RequireDependency("acceptanceCriteria", acceptanceCandidate.Id, acceptanceCandidate.Revision, acceptanceCandidate.Digest);
            RequireDependency("definitionOfReady", readyCandidate.Id, readyCandidate.Revision, readyCandidate.Digest);
            RequireDependency("definitionOfDone", doneCandidate.Id, doneCandidate.Revision, doneCandidate.Digest);
            RequireDependency("implementationUnitModel", unitsCandidate.Id, unitsCandidate.Revision, unitsCandidate.Digest);
            RequireDependency("dependencyMapping", dependenciesCandidate.Id, dependenciesCandidate.Revision, dependenciesCandidate.Digest);
            RequireDependency("securityPrivacyAssessment", securityCandidate.Id, securityCandidate.Revision, securityCandidate.Digest);
            RequireDependency("routeScreenComponentMapping", routeCandidate.Id, routeCandidate.Revision, routeCandidate.Digest);
        }
        return RenderTestMethodology(projection);
    }

    public static string RenderTestMethodology(TestMethodologyProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Test Methodology candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Source coverage: {projection.SourceUnitCount} units · {projection.SourceRequirementCount} Requirements · " +
                $"{projection.SourceCriterionCount} Acceptance Criteria · {projection.SourceMappingSubjectCount} mapping subjects")
            .AppendLine(
                $"Candidate coverage: {projection.ScopeCount} scopes · {projection.DecisionCount} decisions · " +
                $"{projection.EnvironmentCount} environments · {projection.DataPolicyCount} data policies · " +
                $"{projection.EvidenceExpectationCount} evidence expectations")
            .AppendLine(
                $"Candidate outcomes: {projection.SelectedDecisionCount} selected · {projection.ConflictDecisionCount} conflicts · " +
                $"{projection.NotApplicableDecisionCount} not applicable · {projection.DeferredDecisionCount} deferred · " +
                $"{projection.NotAssessedDecisionCount} not assessed")
            .AppendLine($"Candidate criteria: {projection.EntryCriterionCount} entry · {projection.ExitCriterionCount} exit")
            .AppendLine(
                $"Candidate methodology gaps: {projection.MissingScopeCount} missing scopes · {projection.ExtraScopeCount} extra scopes · " +
                $"{projection.InvalidDecisionCount} invalid decisions · {projection.EnvironmentGapCount} environment gaps · " +
                $"{projection.DataPolicyGapCount} data-policy gaps · {projection.OwnershipGapCount} ownership gaps · " +
                $"{projection.TraceGapCount} trace gaps · {projection.EvidenceGapCount} evidence gaps · " +
                $"{projection.CriterionGapCount} criterion gaps")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Test Methodology candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Scope catalog digest: {candidate.ScopeCatalogDigest}")
                .AppendLine($"Methodology receipt digest: {candidate.MethodologyReceiptDigest}")
                .AppendLine($"Environment receipt digest: {candidate.EnvironmentReceiptDigest}")
                .AppendLine($"Data-policy receipt digest: {candidate.DataPolicyReceiptDigest}")
                .AppendLine($"Ownership receipt digest: {candidate.OwnershipReceiptDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.ScopeCount} scopes · {candidate.DecisionCount} decisions · " +
                    $"{candidate.SelectedDecisionCount} selected · {candidate.ConflictDecisionCount} conflicts · " +
                    $"{candidate.EnvironmentCount} environments · {candidate.DataPolicyCount} data policies · " +
                    $"{candidate.EntryCriterionCount} entry criteria · {candidate.ExitCriterionCount} exit criteria · {candidate.ReviewState}");
        }
        else output.AppendLine("Test Methodology candidate: not recorded");
        return output.AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and methodology scope, environment, data, ownership, " +
                "trace, assessment, and snapshot digests only; no Requirement, criterion, method rationale, environment address, " +
                "test data, owner, evidence, result, personal data, secret, credential, or machine path. This inspection does not " +
                "establish methodology validity or completeness, environment availability, data fitness, privacy or security approval, " +
                "owner appointment, test execution or results, evidence or coverage truth, quality, implementation readiness, " +
                "acceptance, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadTestInventoryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var acceptance = await client.ReadAcceptanceCriteriaAsync(initiativeId, cancellationToken);
        var risks = await client.ReadRiskRegisterAsync(initiativeId, cancellationToken);
        var units = await client.ReadImplementationUnitModelAsync(initiativeId, cancellationToken);
        var routeMapping = await client.ReadRouteScreenComponentMappingAsync(initiativeId, cancellationToken);
        var methodology = await client.ReadTestMethodologyAsync(initiativeId, cancellationToken);
        var projection = await client.ReadTestInventoryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Test Inventory was read. Refresh the exact records.");
        }
        if (projection.Candidate is not null)
        {
            void RequireDependency(string name, Guid id, long revision, string digest)
            {
                if (!projection.Dependencies.TryGetValue(name, out var reference) || reference.RecordId != id ||
                    reference.Revision != revision || reference.Digest != digest)
                {
                    throw new ArgumentException($"The {name} candidate changed while Test Inventory was read. Refresh the exact records.");
                }
            }
            if (acceptance.Candidate is not { } acceptanceCandidate || risks.Register is not { } riskCandidate ||
                units.Candidate is not { } unitsCandidate || routeMapping.Candidate is not { } routeCandidate ||
                methodology.Candidate is not { } methodologyCandidate)
            {
                throw new ArgumentException("One or more exact current dependency candidates are unavailable. Refresh the exact records.");
            }
            RequireDependency("acceptanceCriteria", acceptanceCandidate.Id, acceptanceCandidate.Revision, acceptanceCandidate.Digest);
            RequireDependency("riskRegister", riskCandidate.Id, riskCandidate.Revision, riskCandidate.Digest);
            RequireDependency("implementationUnitModel", unitsCandidate.Id, unitsCandidate.Revision, unitsCandidate.Digest);
            RequireDependency("routeScreenComponentMapping", routeCandidate.Id, routeCandidate.Revision, routeCandidate.Digest);
            RequireDependency("testMethodology", methodologyCandidate.Id, methodologyCandidate.Revision, methodologyCandidate.Digest);
        }
        return RenderTestInventory(projection);
    }

    public static string RenderTestInventory(TestInventoryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Test Inventory candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Source coverage: {projection.SourceCriterionCount} Acceptance Criteria · {projection.SourceRiskCount} Risks · " +
                $"{projection.SourceUnitCount} Implementation Units · {projection.SourceMappingSubjectCount} mapping subjects · " +
                $"{projection.SourceMethodologyScopeCount} methodology scopes")
            .AppendLine(
                $"Candidate inventory: {projection.AssetCount} tests · {projection.CatalogedAssetCount} cataloged · " +
                $"{projection.ConflictAssetCount} conflicts · {projection.MissingAssetCount} missing · " +
                $"{projection.DeferredAssetCount} deferred · {projection.NotAssessedAssetCount} not assessed")
            .AppendLine(
                $"Candidate asset states: {projection.ObservedAssetCount} observed · {projection.PlannedAssetCount} planned · " +
                $"{projection.AutomatedAssetCount} automated · {projection.ManualAssetCount} manual")
            .AppendLine(
                $"Candidate coverage gaps: {projection.UncoveredCriterionCount} criteria · {projection.UncoveredRiskCount} risks · " +
                $"{projection.UncoveredUnitCount} units · {projection.UncoveredMappingSubjectCount} mapping subjects · " +
                $"{projection.UncoveredMethodologyScopeCount} methodology scopes")
            .AppendLine(
                $"Candidate integrity gaps: {projection.DuplicateIdentityCount} duplicates · {projection.OrphanAssetCount} orphans · " +
                $"{projection.OwnershipGapCount} ownership · {projection.TraceGapCount} trace · {projection.EvidenceGapCount} evidence")
            .AppendLine(
                $"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · " +
                $"{projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Test Inventory candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Catalog receipt digest: {candidate.CatalogReceiptDigest}")
                .AppendLine($"Coverage receipt digest: {candidate.CoverageReceiptDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Ownership receipt digest: {candidate.OwnershipReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
                .AppendLine(
                    $"Candidate coverage: {candidate.AssetCount} tests · {candidate.CatalogedAssetCount} cataloged · " +
                    $"{candidate.ConflictAssetCount} conflicts · {candidate.ObservedAssetCount} observed · " +
                    $"{candidate.PlannedAssetCount} planned · {candidate.ReviewState}");
        }
        else output.AppendLine("Test Inventory candidate: not recorded");
        return output.AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and test catalog, coverage, trace, ownership, " +
                "assessment, and snapshot digests only; no test title, path, code, steps, data, owner, evidence, result, " +
                "personal data, secret, credential, or machine path. This inspection does not establish test existence, " +
                "inventory validity or completeness, environment availability, privacy or security approval, owner appointment, " +
                "test execution or results, evidence or coverage truth, quality, implementation readiness, acceptance, release, " +
                "deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadHighLevelDesignAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadHighLevelDesignAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision || projection.ProductDigest != product.Digest ||
            projection.InitiativeId != initiative.Id || projection.InitiativeRevision != initiative.Revision ||
            projection.InitiativeDigest != initiative.Digest || projection.InitiativeState != initiative.State)
            throw new ArgumentException("The Product or Initiative changed while High-Level Design was read. Refresh the exact records.");
        return RenderHighLevelDesign(projection);
    }

    public static string RenderHighLevelDesign(HighLevelDesignProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed High-Level Design candidate").AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Exact dependencies: {projection.PresentDependencyCount}/{projection.DependencyCount}")
            .AppendLine($"Candidate structure: {projection.DefinedElementCount}/{projection.ElementCount} elements · {projection.DefinedRelationCount}/{projection.RelationCount} relations · {projection.SelectedDecisionCount}/{projection.DecisionCount} decisions")
            .AppendLine($"Candidate views: {projection.QualityAttributeCount} quality attributes · {projection.DeploymentViewCount} deployment views")
            .AppendLine($"Candidate structural gaps: {projection.ConflictCount} conflicts · {projection.MissingCount} missing · {projection.OrphanRelationCount} orphan relations")
            .AppendLine($"Candidate integrity gaps: {projection.TraceGapCount} trace · {projection.EvidenceGapCount} evidence · {projection.OwnershipGapCount} ownership · {projection.UncoveredUnitCount} uncovered units")
            .AppendLine($"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · {projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
            output.AppendLine($"High-Level Design candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Structure receipt digest: {candidate.StructureReceiptDigest}")
                .AppendLine($"Dependency receipt digest: {candidate.DependencyReceiptDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Coverage receipt digest: {candidate.CoverageReceiptDigest}")
                .AppendLine($"Ownership receipt digest: {candidate.OwnershipReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}");
        else output.AppendLine("High-Level Design candidate: not recorded");
        return output.AppendLine().AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append("Authority boundary: candidate identities, counts, statuses, and structure, dependency, trace, coverage, ownership, assessment, and snapshot digests only; no design narrative, diagram, interface, data flow, technology, owner, evidence source content, personal data, secret, credential, or machine path. This inspection does not establish architecture, repository, runtime, or deployment truth or completeness, architecture approval, privacy or security approval, owner appointment, implementation readiness, acceptance, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadLowLevelDesignAsync(Guid initiativeId, Guid implementationUnitId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        if (implementationUnitId == Guid.Empty) throw new ArgumentException("Implementation Unit ID must not be empty.", nameof(implementationUnitId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadLowLevelDesignAsync(initiativeId, implementationUnitId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision || projection.ProductDigest != product.Digest ||
            projection.InitiativeId != initiative.Id || projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State || projection.ImplementationUnitId != implementationUnitId)
            throw new ArgumentException("The Product, Initiative, or Implementation Unit changed while Low-Level Design was read. Refresh the exact records.");
        return RenderLowLevelDesign(projection);
    }

    public static string RenderLowLevelDesign(LowLevelDesignProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Low-Level Design candidate").AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Implementation Unit: {projection.ImplementationUnitId:D}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Exact dependencies: {projection.PresentDependencyCount}/{projection.DependencyCount}")
            .AppendLine($"Candidate structure: {projection.DefinedElementCount}/{projection.ElementCount} elements · {projection.DefinedRelationCount}/{projection.RelationCount} relations · {projection.SelectedDecisionCount}/{projection.DecisionCount} decisions")
            .AppendLine($"Candidate views: {projection.QualityAttributeCount} quality attributes · {projection.DeploymentViewCount} deployment views")
            .AppendLine($"Candidate structural gaps: {projection.ConflictCount} conflicts · {projection.MissingCount} missing · {projection.OrphanRelationCount} orphan relations")
            .AppendLine($"Candidate integrity gaps: {projection.TraceGapCount} trace · {projection.EvidenceGapCount} evidence · {projection.OwnershipGapCount} ownership · {projection.UncoveredUnitCount} uncovered units")
            .AppendLine($"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · {projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
            output.AppendLine($"Low-Level Design candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Structure receipt digest: {candidate.StructureReceiptDigest}")
                .AppendLine($"Dependency receipt digest: {candidate.DependencyReceiptDigest}")
                .AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
                .AppendLine($"Coverage receipt digest: {candidate.CoverageReceiptDigest}")
                .AppendLine($"Ownership receipt digest: {candidate.OwnershipReceiptDigest}")
                .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}");
        else output.AppendLine("Low-Level Design candidate: not recorded");
        return output.AppendLine().AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append("Authority boundary: candidate identities, counts, statuses, and structure, dependency, trace, coverage, ownership, assessment, and snapshot digests only; no design narrative, module, class, component, interface, data contract, algorithm, state, error recovery, authorization, observability, test hook, technology, owner, evidence source content, personal data, secret, credential, or machine path. This inspection does not establish design, repository, source, runtime, or deployment truth or completeness, design approval, privacy or security approval, owner appointment, implementation readiness, acceptance, release, deployment, or action authority.")
            .ToString();
    }

    public async Task<string> ReadImplementationReadinessGateAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken); var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadImplementationReadinessGateAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision || projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id || projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest || projection.InitiativeState != initiative.State)
            throw new ArgumentException("The Product or Initiative changed while Implementation Readiness Gate was read. Refresh the exact records.");
        return RenderImplementationReadinessGate(projection);
    }

    public static string RenderImplementationReadinessGate(ImplementationReadinessGateProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder().AppendLine("GAEP governed Implementation Readiness Gate candidate").AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Exact dependencies: {projection.PresentDependencyCount}/{projection.DependencyCount}")
            .AppendLine($"Per-unit subjects: {projection.SubjectCount} · {projection.SatisfiedCount} satisfied · {projection.GapCount} gaps · {projection.ConflictCount} conflicts")
            .AppendLine($"Candidate exceptions: {projection.WaivedCandidateCount} waiver candidates · {projection.NotAssessedCount} not assessed · {projection.StaleCount} stale")
            .AppendLine($"Candidate integrity gaps: {projection.EvidenceGapCount} evidence · {projection.OwnershipGapCount} ownership · {projection.CoverageGapCount} coverage")
            .AppendLine($"Candidate freshness gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleDependencyCount} stale dependencies · {projection.InvalidCandidateCount} invalid candidates · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate) output.AppendLine($"Implementation Readiness Gate candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
            .AppendLine($"Dependency receipt digest: {candidate.DependencyReceiptDigest}").AppendLine($"Coverage receipt digest: {candidate.CoverageReceiptDigest}")
            .AppendLine($"Evidence receipt digest: {candidate.EvidenceReceiptDigest}").AppendLine($"Ownership receipt digest: {candidate.OwnershipReceiptDigest}")
            .AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}");
        else output.AppendLine("Implementation Readiness Gate candidate: not recorded");
        return output.AppendLine().AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append("Authority boundary: candidate identities, counts, statuses, and receipt digests only; no readiness rationale, evidence or review content, owner details, personal data, secret, credential, or machine path. Automated assessment does not establish artifact or evidence truth, completeness, approval, waiver, owner appointment, implementation readiness, assignment, execution, acceptance, release, deployment, or action authority.").ToString();
    }

    public async Task<string> ReadChangedUnitInventoryAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken); var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadChangedUnitInventoryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision || projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id || projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest || projection.InitiativeState != initiative.State)
            throw new ArgumentException("The Product or Initiative changed while Changed Unit Inventory was read. Refresh the exact records.");
        return RenderChangedUnitInventory(projection);
    }

    public static string RenderChangedUnitInventory(ChangedUnitInventoryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder().AppendLine("GAEP governed Changed Unit Inventory candidate").AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Exact dependencies: {projection.PresentDependencyCount}/{projection.DependencyCount}")
            .AppendLine($"Inventory coverage: {projection.InventoryUnitCount}/{projection.SourceUnitCount} units · {projection.PathCandidateCount} repository-relative paths")
            .AppendLine($"Candidate outcomes: {projection.CandidateScopedCount} scoped · {projection.GapCount} gaps · {projection.ConflictCount} conflicts · {projection.StaleCount} stale · {projection.NotAssessedCount} not assessed")
            .AppendLine($"Trace and integrity gaps: {projection.TraceGapCount} trace · {projection.EvidenceGapCount} evidence · {projection.OwnershipGapCount} ownership · {projection.BlastRadiusGapCount} blast radius")
            .AppendLine($"Freshness gaps: {projection.StaleBindingCount} bindings · {projection.StaleDependencyCount} dependencies · {projection.InvalidCandidateCount} invalid · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate) output.AppendLine($"Changed Unit Inventory candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
            .AppendLine($"Inventory receipt digest: {candidate.InventoryReceiptDigest}").AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
            .AppendLine($"Blast-radius receipt digest: {candidate.BlastRadiusReceiptDigest}").AppendLine($"Candidate units: {candidate.UnitCount}");
        else output.AppendLine("Changed Unit Inventory candidate: not recorded");
        return output.AppendLine().AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append("Authority boundary: repository-relative candidates, counts, statuses, and receipt digests only. This inspection does not establish repository or path truth, approved scope, code mutation, staging, assignment, acceptance, merge, release, deployment, or action authority.").ToString();
    }

    public async Task<string> ReadProposedChangePreviewAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken); var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadProposedChangePreviewAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision || projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id || projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest || projection.InitiativeState != initiative.State)
            throw new ArgumentException("The Product or Initiative changed while Proposed Change Preview was read. Refresh the exact records.");
        return RenderProposedChangePreview(projection);
    }

    public static string RenderProposedChangePreview(ProposedChangePreviewProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder().AppendLine("GAEP governed Proposed Change Preview candidate").AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Inventory coverage: {projection.PreviewUnitCount}/{projection.InventoryUnitCount} units · {projection.PreviewPathCount}/{projection.InventoryPathCount} paths")
            .AppendLine($"Candidate outcomes: {projection.CandidatePreviewedCount} previewed · {projection.GapCount} gaps · {projection.ConflictCount} conflicts · {projection.StaleCount} stale · {projection.NotAssessedCount} not assessed")
            .AppendLine($"Coverage gaps: {projection.OrphanUnitCount} orphan units · {projection.OrphanPathCount} orphan paths · {projection.EndpointGapCount} endpoints · {projection.DiffGapCount} diffs")
            .AppendLine($"Integrity gaps: {projection.TraceGapCount} trace · {projection.EvidenceGapCount} evidence · {projection.StaleBindingCount} stale bindings · {projection.StaleInventoryCount} stale inventory · {projection.InvalidCandidateCount} invalid · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate) output.AppendLine($"Proposed Change Preview candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
            .AppendLine($"Dependency receipt digest: {candidate.DependencyReceiptDigest}").AppendLine($"Plan receipt digest: {candidate.PlanReceiptDigest}")
            .AppendLine($"Diff receipt digest: {candidate.DiffReceiptDigest}").AppendLine($"Trace receipt digest: {candidate.TraceReceiptDigest}")
            .AppendLine($"Evidence receipt digest: {candidate.EvidenceReceiptDigest}").AppendLine($"Assessment receipt digest: {candidate.AssessmentReceiptDigest}")
            .AppendLine($"Candidate units: {candidate.UnitCount}");
        else output.AppendLine("Proposed Change Preview candidate: not recorded");
        return output.AppendLine().AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append("Authority boundary: repository-relative plan and source/target/diff metadata only; no file or diff content. This inspection does not establish repository truth, approved scope, mutation, staging, apply/discard, assignment, acceptance, merge, release, deployment, or action authority.").ToString();
    }

    public async Task<string> ReadStagingWorkspaceAsync(Guid initiativeId, CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken); var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadStagingWorkspaceAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision || projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id || projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest || projection.InitiativeState != initiative.State)
            throw new ArgumentException("The Product or Initiative changed while Staging Workspace was read. Refresh the exact records.");
        return RenderStagingWorkspace(projection);
    }

    public static string RenderStagingWorkspace(StagingWorkspaceProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder().AppendLine("GAEP governed Isolated Staging Workspace candidate").AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.State} · review state: {projection.ReviewState}")
            .AppendLine($"Preview coverage: {projection.StagingUnitCount}/{projection.PreviewUnitCount} units · {projection.StagingPathCount}/{projection.PreviewPathCount} paths")
            .AppendLine($"Candidate outcomes: {projection.CandidateDefinedCount} defined · {projection.UnavailableCount} unavailable · {projection.GapCount} gaps · {projection.ConflictCount} conflicts · {projection.StaleCount} stale · {projection.NotAssessedCount} not assessed")
            .AppendLine($"Safeguard gaps: {projection.InspectionGapCount} inspection · {projection.ExclusionGapCount} exclusion · {projection.CapacityGapCount} capacity · {projection.RecoveryGapCount} recovery · {projection.EvidenceGapCount} evidence")
            .AppendLine($"Freshness gaps: {projection.StaleBindingCount} bindings · {projection.StalePreviewCount} previews · {projection.InvalidCandidateCount} invalid · {projection.UnresolvedQuestionCount} questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate) output.AppendLine($"Staging Workspace candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
            .AppendLine($"Portable identity: gaep-managed-stage/{candidate.StageKey} · generation {candidate.Generation}")
            .AppendLine($"Lifecycle: actual stage {candidate.ActualStageExistenceState} · inspection {candidate.InspectionState}")
            .AppendLine($"Capacity: {candidate.CandidateFileCount}/{candidate.MaximumFiles} files · {candidate.CandidateByteCount}/{candidate.MaximumBytes} bytes")
            .AppendLine($"Recovery: {candidate.RecoveryState} · {candidate.RecoveryCheckpointDigest}")
            .AppendLine($"Inspection receipt digest: {candidate.InspectionReceiptDigest}").AppendLine($"Candidate units: {candidate.UnitCount}");
        else output.AppendLine("Staging Workspace candidate: not recorded");
        return output.AppendLine().AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append("Authority boundary: portable staging identity, repository-relative candidates, lifecycle, exclusion, capacity, inspection and recovery metadata only; no machine stage paths or file/diff content. This inspection does not establish real stage existence, repository truth, approved scope, mutation, apply/discard, assignment, acceptance, merge, release, deployment, or action authority.").ToString();
    }

    public async Task<string> ReadDesignSystemTokenContractAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignSystemTokenContractAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design System and Token Contract was read. Refresh the exact records.");
        }
        return RenderDesignSystemTokenContract(projection);
    }

    public static string RenderDesignSystemTokenContract(DesignSystemTokenContractProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Design System and Token Contract candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine(
                $"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · " +
                $"catalog: {projection.CatalogCompletenessState}")
            .AppendLine(
                $"Inventory: {projection.DesignSystemCount} systems · {projection.TokenCount} tokens · " +
                $"{projection.VariableCollectionCount} collections · {projection.VariableCount} variables · " +
                $"{projection.ComponentCount} components")
            .AppendLine(
                $"Requirement coverage: {projection.RepresentedRequirementCount} represented · " +
                $"{projection.UnresolvedRequirementCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedOwnershipCount} ownership · " +
                $"{projection.UnresolvedCatalogItemCount} catalog · " +
                $"{projection.AccessibilityReviewGapCount} accessibility review · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StalePortableSnapshotCount} stale portable snapshots · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Design System and Token Contract candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.DesignSystemCount} systems · {candidate.TokenCount} tokens · " +
                    $"{candidate.VariableCollectionCount} collections · {candidate.VariableCount} variables · " +
                    $"{candidate.ComponentCount} components · {candidate.RepresentedRequirementCount} represented requirements · " +
                    candidate.ReviewState);
        }
        else output.AppendLine("Design System and Token Contract candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no system, token, variable, " +
                "or component validity, ownership authority, accessibility validation, design approval, baseline, " +
                "readiness, implementation, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadAccessibilityDesignRulesAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadAccessibilityDesignRulesAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Accessibility Design Rules were read. Refresh the exact records.");
        }
        return RenderAccessibilityDesignRules(projection);
    }

    public static string RenderAccessibilityDesignRules(AccessibilityDesignRulesProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Accessibility Design Rules candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine(
                $"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · " +
                $"catalog: {projection.CatalogCompletenessState}")
            .AppendLine($"Inventory: {projection.TargetCount} targets · {projection.RuleCount} rules · {projection.CheckCount} checks")
            .AppendLine(
                $"Rule applicability: {projection.ApplicableRuleCount} applicable · {projection.NotApplicableRuleCount} not applicable · " +
                $"{projection.UnresolvedRuleCount} unresolved")
            .AppendLine(
                $"Check evidence: {projection.HumanReviewedCheckCount} human-reviewed · " +
                $"{projection.EvidenceRecordedCheckCount} evidence-recorded · {projection.NotAssessedCheckCount} not assessed · " +
                $"{projection.ContradictedCheckCount} contradicted")
            .AppendLine(
                $"Requirement coverage: {projection.RepresentedRequirementCount} represented · " +
                $"{projection.UnresolvedRequirementCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedOwnershipCount} ownership · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Accessibility Design Rules candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.TargetCount} targets · {candidate.RuleCount} rules · " +
                    $"{candidate.CheckCount} checks · {candidate.RepresentedRequirementCount} represented requirements · " +
                    candidate.ReviewState);
        }
        else output.AppendLine("Accessibility Design Rules candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no accessibility conformance, " +
                "rule or check validity, legal compliance, ownership authority, design approval, baseline, readiness, " +
                "implementation, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadResponsiveMultiPlatformTargetsAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadResponsiveMultiPlatformTargetsAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Responsive and Multi-Platform Targets were read. Refresh the exact records.");
        }
        return RenderResponsiveMultiPlatformTargets(projection);
    }

    public static string RenderResponsiveMultiPlatformTargets(ResponsiveMultiPlatformTargetsProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Responsive and Multi-Platform Targets candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Catalogs: targets {projection.TargetCatalogState} · breakpoints {projection.BreakpointCatalogState} · " +
                $"behaviors {projection.BehaviorCatalogState}")
            .AppendLine(
                $"Inventory: {projection.PlatformTargetCount} platform targets · {projection.BreakpointCount} breakpoints · " +
                $"{projection.BehaviorCount} behaviors · {projection.CheckCount} checks")
            .AppendLine(
                $"Behavior applicability: {projection.ApplicableBehaviorCount} applicable · " +
                $"{projection.UnresolvedBehaviorCount} unresolved")
            .AppendLine(
                $"Check evidence: {projection.HumanReviewedCheckCount} human-reviewed · " +
                $"{projection.EvidenceRecordedCheckCount} evidence-recorded · {projection.NotAssessedCheckCount} not assessed · " +
                $"{projection.ContradictedCheckCount} contradicted")
            .AppendLine(
                $"Requirement coverage: {projection.RepresentedRequirementCount} represented · " +
                $"{projection.UnresolvedRequirementCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedOwnershipCount} ownership · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Responsive and Multi-Platform Targets candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.PlatformTargetCount} platform targets · {candidate.BreakpointCount} breakpoints · " +
                    $"{candidate.BehaviorCount} behaviors · {candidate.CheckCount} checks · " +
                    $"{candidate.RepresentedRequirementCount} represented requirements · {candidate.ReviewState}");
        }
        else output.AppendLine("Responsive and Multi-Platform Targets candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no responsive completeness, " +
                "platform parity, breakpoint or behavior validity, accessibility conformance, ownership authority, " +
                "design approval, baseline, readiness, implementation, write, or action authority.")
            .ToString();
    }

    public async Task<string> ReadManualFigmaExecutionPathAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadManualFigmaExecutionPathAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Manual Figma Execution Path was read. Refresh the exact records.");
        }
        return RenderManualFigmaExecutionPath(projection);
    }

    public static string RenderManualFigmaExecutionPath(ManualFigmaExecutionPathProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Manual Figma Execution Path candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Catalogs: guide {projection.GuideCatalogState} · handoff {projection.HandoffCatalogState} · " +
                $"return {projection.ReturnContractState}")
            .AppendLine(
                $"Inventory: {projection.ScopeCount} scopes · {projection.InstructionCount} instruction stages · " +
                $"{projection.CheckCount} checks")
            .AppendLine(
                $"Check evidence: {projection.HumanReviewedCheckCount} human-reviewed · " +
                $"{projection.EvidenceRecordedCheckCount} evidence-recorded · {projection.NotAssessedCheckCount} not assessed · " +
                $"{projection.ContradictedCheckCount} contradicted")
            .AppendLine(
                $"Requirement coverage: {projection.RepresentedRequirementCount} represented · " +
                $"{projection.UnresolvedRequirementCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedOwnershipCount} ownership · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Manual Figma Execution Path candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.ScopeCount} scopes · {candidate.InstructionCount} instruction stages · " +
                    $"{candidate.CheckCount} checks · {candidate.RepresentedRequirementCount} represented requirements · " +
                    candidate.ReviewState);
        }
        else output.AppendLine("Manual Figma Execution Path candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no Figma connection, " +
                "execution or returned-design completeness, write authority, design approval, baseline, readiness, " +
                "implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadFigmaMcpCapabilityDiscoveryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadFigmaMcpCapabilityDiscoveryAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Figma MCP Capability Discovery was read. Refresh the exact records.");
        }
        return RenderFigmaMcpCapabilityDiscovery(projection);
    }

    public static string RenderFigmaMcpCapabilityDiscovery(FigmaMcpCapabilityDiscoveryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Figma MCP Capability Discovery candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Catalogs: tools {projection.CatalogState} · permissions {projection.PermissionModelState} · " +
                $"limits {projection.LimitCatalogState} · versions {projection.VersionCatalogState}")
            .AppendLine(
                $"Inventory: {projection.ToolCount} tool observations · {projection.AdvertisedToolCount} advertised · " +
                $"{projection.UnavailableToolCount} not advertised · {projection.UnknownAvailabilityCount} unknown")
            .AppendLine(
                $"Effects: {projection.ReadToolCount} read · {projection.WriteToolCount} write · " +
                $"{projection.UnknownEffectCount} unknown")
            .AppendLine(
                $"Evidence: {projection.HumanReviewedToolCount} human-reviewed · " +
                $"{projection.SourceRecordedToolCount} source-recorded · {projection.NotAssessedToolCount} not assessed")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedPermissionCount} permissions · {projection.UnresolvedLimitCount} limits · " +
                $"{projection.UnresolvedVersionCount} versions · {projection.UnresolvedOwnershipCount} ownership · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Figma MCP Capability Discovery candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.ToolCount} tools · {candidate.AdvertisedToolCount} advertised · " +
                    $"{candidate.ReadToolCount} read · {candidate.WriteToolCount} write · {candidate.ReviewState}");
        }
        else output.AppendLine("Figma MCP Capability Discovery candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no Figma connection or call, " +
                "credential request, permission grant, live availability or compatibility claim, write authority, design approval, " +
                "baseline, readiness, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadFigmaReadSnapshotAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadFigmaReadSnapshotAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Figma Read Snapshot was read. Refresh the exact records.");
        }
        return RenderFigmaReadSnapshot(projection);
    }

    public static string RenderFigmaReadSnapshot(FigmaReadSnapshotProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Figma Read Snapshot candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Catalogs: snapshot {projection.SnapshotCompletenessState} · provenance {projection.ProvenanceState}")
            .AppendLine(
                $"Inventory: {projection.FileCount} files · {projection.ComponentCount} components · " +
                $"{projection.VariableCollectionCount} variable collections · {projection.VariableCount} variables")
            .AppendLine(
                $"Evidence: {projection.HumanReviewedItemCount} human-reviewed · " +
                $"{projection.SourceRecordedItemCount} source-recorded · {projection.NotAssessedItemCount} not assessed")
            .AppendLine(
                $"Freshness and type gaps: {projection.StaleFileCount} stale at capture · " +
                $"{projection.UnknownFreshnessFileCount} unknown freshness · {projection.UnresolvedTypeCount} unresolved variable types")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedOwnershipCount} ownership · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Figma Read Snapshot candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.FileCount} files · {candidate.ComponentCount} components · " +
                    $"{candidate.VariableCollectionCount} variable collections · {candidate.VariableCount} variables · {candidate.ReviewState}");
        }
        else output.AppendLine("Figma Read Snapshot candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no Figma connection or call, " +
                "credential request, permission grant, external completeness claim, write authority, design validation or approval, " +
                "baseline, readiness, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadFigmaContextImportAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadFigmaContextImportAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Figma Context Import was read. Refresh the exact records.");
        }
        return RenderFigmaContextImport(projection);
    }

    public static string RenderFigmaContextImport(FigmaContextImportProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Figma Context Import candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Selection: {projection.ContextSelectionState} · provenance {projection.ProvenanceState} · " +
                $"preview {projection.PreviewState}")
            .AppendLine(
                $"Inventory: {projection.ContextPackCount} Context Packs · {projection.SectionCount} sections · " +
                $"{projection.ContextItemCount} Context Items · {projection.TargetCount} Figma targets")
            .AppendLine(
                $"Evidence: {projection.HumanReviewedSectionCount} human-reviewed · " +
                $"{projection.SourceRecordedSectionCount} source-recorded · {projection.NotAssessedSectionCount} not assessed · " +
                $"{projection.UnresolvedRedactionCount} redaction gaps")
            .AppendLine(
                $"Requirement coverage: {projection.RepresentedRequirementCount} represented · " +
                $"{projection.UnresolvedRequirementCount} unresolved")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedOwnershipCount} ownership · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Figma Context Import candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.ContextPackCount} Context Packs · {candidate.SectionCount} sections · " +
                    $"{candidate.ContextItemCount} Context Items · {candidate.TargetCount} Figma targets · " +
                    $"{candidate.RepresentedRequirementCount} represented Requirements · {candidate.ReviewState}");
        }
        else output.AppendLine("Figma Context Import candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no context packaging or transfer, " +
                "Figma connection or call, credential request, permission grant, write, target or design validation, design approval, " +
                "baseline, readiness, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadOutboundDesignBriefPackageAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadOutboundDesignBriefPackageAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Outbound Design Brief Package was read. Refresh the exact records.");
        }
        return RenderOutboundDesignBriefPackage(projection);
    }

    public static string RenderOutboundDesignBriefPackage(OutboundDesignBriefPackageProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Outbound Design Brief Package candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Manifest: {projection.ManifestState} · provenance {projection.ProvenanceState} · " +
                $"redaction {projection.RedactionReviewState} · preview {projection.PreviewState}")
            .AppendLine(
                $"Inventory: {projection.ContextPackCount} Context Packs · {projection.EntryCount} entries · " +
                $"{projection.ContextItemCount} Context Items · {projection.RecipientCount} recipients")
            .AppendLine(
                $"Evidence: {projection.HumanReviewedEntryCount} human-reviewed · " +
                $"{projection.SourceRecordedEntryCount} source-recorded · {projection.NotAssessedEntryCount} not assessed · " +
                $"{projection.UnresolvedRedactionCount} redaction gaps")
            .AppendLine(
                $"Requirement coverage: {projection.RepresentedRequirementCount} represented · " +
                $"{projection.UnresolvedRequirementCount} unresolved · {projection.UnresolvedDisclosureCount} unresolved disclosures")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Outbound Design Brief Package candidate: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Manifest receipt: {candidate.ManifestFormat} · {candidate.ManifestDigest}")
                .AppendLine($"Payload receipt: {candidate.PayloadDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.ContextPackCount} Context Packs · {candidate.EntryCount} entries · " +
                    $"{candidate.ContextItemCount} Context Items · {candidate.RecipientCount} recipients · " +
                    $"{candidate.RepresentedRequirementCount} represented Requirements · " +
                    $"{candidate.UnresolvedDisclosureCount} unresolved disclosures · {candidate.ReviewState}");
        }
        else output.AppendLine("Outbound Design Brief Package candidate: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no package materialization or context transfer, " +
                "Figma connection or call, credential request, permission grant, write, target or design validation, design approval, " +
                "baseline, readiness, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadGovernedFigmaWriteAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadGovernedFigmaWriteAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Governed Figma Write was read. Refresh the exact records.");
        }
        return RenderGovernedFigmaWrite(projection);
    }

    public static string RenderGovernedFigmaWrite(GovernedFigmaWriteProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP governed Figma Write authorization-review candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine(
                $"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState} · " +
                $"plan {projection.WritePlanState}")
            .AppendLine(
                $"Governance: preview {projection.PreviewState} · approval {projection.ApprovalState} · " +
                $"permission evidence {projection.PermissionEvidenceState}")
            .AppendLine(
                $"Safety: idempotency {projection.IdempotencyState} · replay {projection.ReplayProtectionState} · " +
                $"recovery {projection.RecoveryPlanState}")
            .AppendLine($"Execution: {projection.WriteExecutionState} · result {projection.WriteResultState}")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedDisclosureCount} disclosures · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Request receipt: {candidate.RequestFormat} · {candidate.RequestDigest}")
                .AppendLine($"Effect receipt: {candidate.EffectDigest}")
                .AppendLine($"Preview receipt: {candidate.PreviewDigest ?? "not-generated"}")
                .AppendLine(
                    $"Package receipt: {candidate.OutboundPackage.RecordId:D}@{candidate.OutboundPackage.Revision} · " +
                    $"manifest {candidate.OutboundPackage.ManifestDigest} · payload {candidate.OutboundPackage.PayloadDigest}")
                .AppendLine(
                    $"Target receipts: file {candidate.ExternalFileIdentityDigest} · expected version " +
                    $"{candidate.ExpectedExternalVersionDigest} · {candidate.SelectedEntryCount} selected entries")
                .AppendLine(
                    $"Candidate states: preview {candidate.PreviewState} · approval {candidate.ApprovalState} · " +
                    $"permission evidence {candidate.PermissionEvidenceState} · idempotency {candidate.IdempotencyState} · " +
                    $"recovery {candidate.RecoveryPlanState} · review {candidate.ReviewState} · execution {candidate.WriteExecutionState}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no package materialization or context transfer, " +
                "Figma connection or call, credential request, permission grant, write authorization or execution, target or design validation, " +
                "design approval, baseline, readiness, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadFinalizedFigmaSnapshotImportAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadFinalizedFigmaSnapshotImportAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Finalized Figma Snapshot Import was read. Refresh the exact records.");
        }
        return RenderFinalizedFigmaSnapshotImport(projection);
    }

    public static string RenderFinalizedFigmaSnapshotImport(FinalizedFigmaSnapshotImportProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP finalized Figma Snapshot Import review candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Reconciliation: {projection.ReconciliationState} · provenance {projection.ProvenanceState} · " +
                $"completeness {projection.SnapshotCompletenessState}")
            .AppendLine($"Return authorization: {projection.ReturnAuthorizationState}")
            .AppendLine(
                $"Inventory: {projection.ItemCount} items · {projection.HumanReviewedItemCount} human-reviewed · " +
                $"{projection.SourceRecordedItemCount} source-recorded · {projection.NotAssessedItemCount} not assessed")
            .AppendLine($"Execution: {projection.ImportExecutionState} · result {projection.ImportResultState}")
            .AppendLine(
                $"Candidate gaps: {projection.OpenConflictCount} open conflicts · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Governed write: {candidate.GovernedWrite.RecordId:D}@{candidate.GovernedWrite.Revision} · " +
                    $"request {candidate.GovernedWrite.RequestDigest} · effect {candidate.GovernedWrite.EffectDigest}")
                .AppendLine(
                    $"Return receipts: file {candidate.ExternalFileIdentityDigest} · returned version " +
                    $"{candidate.ReturnedExternalVersionDigest} · payload {candidate.PayloadDigest} · receipt {candidate.ReceiptDigest}")
                .AppendLine($"Reconciliation receipt: {candidate.ReconciliationDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.ItemCount} items · {candidate.ConflictCount} conflicts · " +
                    $"return authorization {candidate.ReturnAuthorizationState} · reconciliation {candidate.ReconciliationState} · " +
                    $"provenance {candidate.ProvenanceState} · review {candidate.ReviewState} · execution {candidate.ImportExecutionState}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, counts, statuses, and digests only; no content transfer or import, " +
                "Figma connection or call, credential request, permission grant, external-completeness proof, target or design validation, " +
                "design approval, baseline, readiness, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignToRequirementBindingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignToRequirementBindingAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design-to-Requirement Binding was read. Refresh the exact records.");
        }
        return RenderDesignToRequirementBinding(projection);
    }

    public static string RenderDesignToRequirementBinding(DesignToRequirementBindingProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Design-to-Requirement Binding review candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate assessment: {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Governance: reconciliation {projection.ReconciliationState} · candidate coverage " +
                $"{projection.CandidateCoverageState} · provenance {projection.ProvenanceState}")
            .AppendLine($"Bindings: {projection.BindingCount} total · {projection.HumanReviewedBindingCount} human-reviewed")
            .AppendLine(
                $"Coverage: {projection.BoundDesignItemCount}/{projection.DesignItemCount} design items · " +
                $"{projection.BoundRequirementCount}/{projection.RequirementCount} Requirements · " +
                $"{projection.BoundDecisionCount}/{projection.DecisionCount} Decisions")
            .AppendLine(
                $"Candidate gaps: {projection.UnboundDesignItemCount} unbound design items · " +
                $"{projection.UnboundRequirementCount} unbound Requirements · {projection.UnboundDecisionCount} unbound Decisions · " +
                $"{projection.OpenConflictCount} open conflicts · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Finalized snapshot: {candidate.FinalizedSnapshot.RecordId:D}@{candidate.FinalizedSnapshot.Revision} · " +
                    $"catalog {candidate.FinalizedSnapshot.CatalogDigest}")
                .AppendLine(
                    $"Design Requirements: {candidate.DesignRequirements.RecordId:D}@{candidate.DesignRequirements.Revision} · " +
                    $"catalog {candidate.DesignRequirements.CatalogDigest}")
                .AppendLine(
                    $"Decision Register: {candidate.DecisionRegister.RecordId:D}@{candidate.DecisionRegister.Revision} · " +
                    $"catalog {candidate.DecisionRegister.CatalogDigest}")
                .AppendLine($"Reconciliation receipt: {candidate.ReconciliationDigest}")
                .AppendLine(
                    $"Candidate inventory: {candidate.BindingCount} bindings · {candidate.DesignItemCoverageCount} design items · " +
                    $"{candidate.SubjectCoverageCount} governed subjects · {candidate.ConflictCount} conflicts");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, exact dependency and catalog digests, counts, and statuses only; " +
                "no relationship-truth or coverage-completeness proof, Requirement satisfaction, Decision effectiveness, " +
                "external-completeness proof, design validation or approval, baseline, readiness, Figma connection or call, " +
                "credential request, permission grant, import or write execution, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignerReadyGateAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignerReadyGateAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Designer-Ready Gate was read. Refresh the exact records.");
        }
        return RenderDesignerReadyGate(projection);
    }

    public static string RenderDesignerReadyGate(DesignerReadyGateProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Designer-Ready Gate candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate result: {projection.CandidateResult} · {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Coverage: {projection.SatisfiedCount} satisfied · {projection.NotApplicableCount} not-applicable candidates · " +
                $"{projection.HumanReviewedCount}/{projection.PrerequisiteCount} human-reviewed")
            .AppendLine(
                $"Candidate gaps: {projection.UnsatisfiedCount} unsatisfied · {projection.NotAssessedCount} not assessed · " +
                $"{projection.StaleOrUnknownCount} stale/unknown · {projection.PendingExceptionCount} pending exceptions · " +
                $"{projection.InvalidExceptionCount} invalid exceptions · {projection.UnresolvedQuestionCount} questions · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Prerequisites: {candidate.PrerequisiteCount} exact · {candidate.PrerequisiteCatalogDigest}")
                .AppendLine(
                    $"Assessment: definition {candidate.AssessmentDefinitionDigest} · receipt {candidate.AssessmentReceiptDigest} · " +
                    $"evaluations {candidate.EvaluationCatalogDigest}")
                .AppendLine($"Exception catalog: {candidate.ExceptionCatalogDigest}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, exact digests, counts, and results only; a passing candidate is an " +
                "evaluation result, not permission or readiness, and grants no completeness, validity, approval, baseline, " +
                "exception, waiver, acceptance, phase-entry, Figma connection, credential, permission, import, write, " +
                "implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignDeltaAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignDeltaAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Delta was read. Refresh the exact records.");
        }
        return RenderDesignDelta(projection);
    }

    public static string RenderDesignDelta(DesignDeltaProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Design Delta candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate result: {projection.CandidateResult} · {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Compared inventory: {projection.SourceItemCount} source items · {projection.TargetItemCount} target items · {projection.DeltaCount} deltas")
            .AppendLine(
                $"Deltas: {projection.AddedCount} added · {projection.ChangedCount} changed · " +
                $"{projection.ConflictingCount} conflicting · {projection.MissingCount} missing · " +
                $"{projection.StaleCount} stale · {projection.UnmappedCount} unmapped · " +
                $"{projection.HumanReviewedCount}/{projection.DeltaCount} human-reviewed")
            .AppendLine($"Comparison governance: comparison {projection.ComparisonState} · provenance {projection.ProvenanceState}")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedMappingCount} unresolved mappings · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Dependencies: Designer-Ready {candidate.DesignerReadyGate.RecordId:D}@{candidate.DesignerReadyGate.Revision} · " +
                    $"finalized snapshot {candidate.FinalizedSnapshot.RecordId:D}@{candidate.FinalizedSnapshot.Revision} · " +
                    $"design binding {candidate.DesignBinding.RecordId:D}@{candidate.DesignBinding.Revision}")
                .AppendLine($"Snapshots: source {candidate.SourceSnapshotDigest} · target {candidate.TargetSnapshotDigest}")
                .AppendLine(
                    $"Comparison: definition {candidate.ComparisonDefinitionDigest} · receipt {candidate.ComparisonReceiptDigest} · " +
                    $"catalog {candidate.DeltaCatalogDigest}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, exact dependency, snapshot, comparison, receipt, catalog, counts, " +
                "and results only; this comparison is observational and establishes no delta or external completeness, " +
                "design validity, approval, baseline, readiness, conflict-resolution or synchronization authority, Figma " +
                "connection, credential, permission, import, write, implementation, or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignConflictResolutionAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignConflictResolutionAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Conflict Resolution was read. Refresh the exact records.");
        }
        return RenderDesignConflictResolution(projection);
    }

    public static string RenderDesignConflictResolution(DesignConflictResolutionProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Design Conflict Resolution candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate result: {projection.CandidateResult} · {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Conflict inventory: {projection.ConflictCount} conflicts · {projection.ResolutionCount} resolution candidates")
            .AppendLine(
                $"Candidate actions: {projection.AcceptSourceCount} accept source · {projection.AcceptTargetCount} accept target · " +
                $"{projection.MergeCount} merge · {projection.RejectChangeCount} reject change · {projection.EscalateCount} escalate")
            .AppendLine(
                $"Recorded review: {projection.HumanReviewedCount}/{projection.ResolutionCount} human-reviewed · " +
                $"{projection.DistinctActorDeclaredCount} distinct-actor declarations · {projection.ExpiredCandidateCount} expired")
            .AppendLine(
                $"Candidate governance: coverage {projection.CoverageState} · provenance {projection.ProvenanceState} · " +
                "separation of duties not enforced")
            .AppendLine(
                $"Candidate gaps: {projection.UnresolvedConflictCount} unresolved conflicts · " +
                $"{projection.UnresolvedQuestionCount} questions · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Design Delta: {candidate.DesignDelta.RecordId:D}@{candidate.DesignDelta.Revision} · " +
                    $"{candidate.DesignDelta.ConflictingCount} conflicts · catalog {candidate.DesignDelta.DeltaCatalogDigest}")
                .AppendLine(
                    $"Resolution evidence: definition {candidate.ResolutionDefinitionDigest} · " +
                    $"receipt {candidate.ResolutionReceiptDigest} · catalog {candidate.ResolutionCatalogDigest}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, exact Design Delta binding, receipts, catalog digests, counts, " +
                "results, and recorded review states only; this view does not enforce separation of duties, resolve or " +
                "apply conflicts, synchronize design, establish validity, approval, baseline, or readiness, call Figma, " +
                "request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.")
            .ToString();
    }

    public async Task<string> ReadHumanDesignApprovalAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadHumanDesignApprovalAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Human Design Approval was read. Refresh the exact records.");
        }
        return RenderHumanDesignApproval(projection);
    }

    public static string RenderHumanDesignApproval(HumanDesignApprovalProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Human Design Approval decision candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate result: {projection.CandidateResult} · {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Prerequisites: {projection.CompletePrerequisiteCount}/{projection.PrerequisiteCount} complete · {projection.DecisionCount} recorded decision candidate")
            .AppendLine(
                $"Decision candidates: {projection.ApproveCount} approve · {projection.RejectCount} reject · " +
                $"{projection.RequestChangeCount} request change · {projection.AbstainCount} abstain")
            .AppendLine(
                $"Candidate gaps: {projection.ExpiredDecisionCount} expired · {projection.RevokedDecisionCount} revoked · " +
                $"{projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references · " +
                $"{projection.UnresolvedQuestionCount} unresolved questions")
            .AppendLine(
                $"Authority: approver {projection.ApproverAuthorityState} · separation of duties " +
                projection.SeparationOfDutiesEnforcementState);
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Prerequisite catalog: {candidate.PrerequisiteCatalogDigest}")
                .AppendLine(
                    $"Exact finalized snapshot: {candidate.Subject.RecordId:D}@{candidate.Subject.Revision} · " +
                    $"{candidate.Subject.ItemCount} items · catalog {candidate.Subject.ItemCatalogDigest}")
                .AppendLine(
                    $"External identity/version digests: {candidate.Subject.ExternalFileIdentityDigest} · " +
                    candidate.Subject.ReturnedExternalVersionDigest)
                .AppendLine(
                    $"Decision evidence: definition {candidate.DecisionDefinitionDigest} · receipt {candidate.DecisionReceiptDigest} · " +
                    $"scope {candidate.ScopeDigest}")
                .AppendLine(
                    $"Recorded candidate: {candidate.DecisionKind ?? "not recorded"} · " +
                    $"{candidate.DecisionLifecycleState ?? "not recorded"} · {candidate.DecisionDigest ?? "not recorded"}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, exact finalized-snapshot subject, prerequisite, scope, decision " +
                "receipt digests, counts, and recorded results only; this view does not verify approver authority, enforce " +
                "separation of duties, establish design approval, baseline, readiness, or phase entry, call Figma, request " +
                "credentials, grant permissions, execute imports or writes, or grant implementation or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignBaselineAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignBaselineAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Baseline was read. Refresh the exact records.");
        }
        return RenderDesignBaseline(projection);
    }

    public static string RenderDesignBaseline(DesignBaselineProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Design Baseline version candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate result: {projection.CandidateResult} · {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine(
                $"Candidate inventory: {projection.CandidateSetCount} set · {projection.DesignationCandidateCount} designation · " +
                $"{projection.SupersessionCandidateCount} supersession · {projection.WithdrawalCandidateCount} withdrawal · " +
                $"{projection.RestorationCandidateCount} restoration")
            .AppendLine(
                $"Candidate gaps: {projection.ExpiredDesignationCount} expired · {projection.StaleBindingCount} stale bindings · " +
                $"{projection.StaleSourceReferenceCount} stale Source references · {projection.UnresolvedQuestionCount} unresolved questions")
            .AppendLine(
                $"Authority: approval determination {projection.ApprovalDeterminationState} · baseline designation " +
                projection.BaselineDesignationState);
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine(
                    $"Exact approval candidate: {candidate.Approval.RecordId:D}@{candidate.Approval.Revision} · " +
                    candidate.Approval.AssessmentState)
                .AppendLine(
                    $"Exact finalized snapshot: {candidate.Subject.RecordId:D}@{candidate.Subject.Revision} · " +
                    $"{candidate.Subject.ItemCount} items · catalog {candidate.Subject.ItemCatalogDigest}")
                .AppendLine($"Scope digest: {candidate.ScopeDigest}")
                .AppendLine(
                    $"Lineage: {candidate.BaselineLineageId:D} · candidate set " +
                    $"{candidate.CandidateSetId:D}@{candidate.CandidateSetRevision}")
                .AppendLine($"Version: {candidate.SemanticVersion} · policy {candidate.VersionPolicyDigest}")
                .AppendLine(
                    $"Designation evidence: definition {candidate.DesignationDefinitionDigest} · receipt {candidate.DesignationReceiptDigest}")
                .AppendLine(
                    $"Designation candidate: {candidate.DesignationKind ?? "not proposed"} · " +
                    (candidate.DesignationDigest ?? "not recorded"))
                .AppendLine(
                    "Exact predecessor: " + (candidate.Supersedes is { } predecessor
                        ? $"{predecessor.RecordId:D}@{predecessor.Revision} · {predecessor.SemanticVersion}"
                        : "initial candidate"));
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: candidate identities, exact Human Design Approval and finalized-snapshot bindings, " +
                "version axes, lineage, scope and receipt digests, designation kind, predecessor, counts, and recorded " +
                "states only; this view does not convert an approval candidate into approval, verify approver authority, " +
                "enforce separation of duties, establish a Baseline Set designation, readiness, or phase entry, call " +
                "Figma, request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.")
            .ToString();
    }

    public async Task<string> ReadDesignDriftDetectionAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        var projection = await client.ReadDesignDriftDetectionAsync(initiativeId, cancellationToken);
        if (projection.ProductId != product.Id || projection.ProductRevision != product.Revision ||
            projection.ProductDigest != product.Digest || projection.InitiativeId != initiative.Id ||
            projection.InitiativeRevision != initiative.Revision || projection.InitiativeDigest != initiative.Digest ||
            projection.InitiativeState != initiative.State)
        {
            throw new ArgumentException("The Product or Initiative changed while Design Drift Detection was read. Refresh the exact records.");
        }
        return RenderDesignDriftDetection(projection);
    }

    public static string RenderDesignDriftDetection(DesignDriftDetectionProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);
        var output = new StringBuilder()
            .AppendLine("GAEP Design Drift Detection candidate")
            .AppendLine()
            .AppendLine($"Initiative: {projection.InitiativeId:D} · revision {projection.InitiativeRevision} · {projection.InitiativeState}")
            .AppendLine($"Candidate result: {projection.CandidateResult} · {projection.AssessmentState} · review state: {projection.ReviewState}")
            .AppendLine($"Implementation targets: {projection.HumanReviewedImplementationTargetCount}/{projection.ImplementationTargetCount} human-reviewed")
            .AppendLine($"Comparison paths: {projection.RequirementToDesignCount} requirement-to-design · {projection.DesignToImplementationCount} design-to-implementation")
            .AppendLine($"Classifications: {projection.ConformantCount} conformant · {projection.DriftCount} drift · {projection.UnassessedCount} unassessed")
            .AppendLine($"Severity: {projection.BlockerCount} blocker · {projection.HighSeverityCount} high")
            .AppendLine($"Remediation candidates: {projection.RemediationCandidateCount} recorded · {projection.ExpiredRemediationCandidateCount} expired · effects not applied")
            .AppendLine($"Candidate gaps: {projection.StaleBindingCount} stale bindings · {projection.StaleSourceReferenceCount} stale Source references · {projection.UnresolvedQuestionCount} unresolved questions");
        foreach (var reason in projection.Reasons) output.AppendLine($"  - {reason}");
        output.AppendLine();
        if (projection.Candidate is { } candidate)
        {
            output.AppendLine($"Candidate record: {candidate.Id:D}@{candidate.Revision} · candidate · {candidate.Digest}")
                .AppendLine($"Membership digest: {candidate.MembershipDigest}")
                .AppendLine($"Baseline candidate: {candidate.DesignBaseline.RecordId:D}@{candidate.DesignBaseline.Revision} · {candidate.DesignBaseline.SemanticVersion} · designation {candidate.DesignBaseline.BaselineDesignationState}")
                .AppendLine($"Returned design: {candidate.ReturnedFigmaSnapshot.RecordId:D}@{candidate.ReturnedFigmaSnapshot.Revision} · returned version {candidate.ReturnedFigmaSnapshot.ReturnedExternalVersionDigest}")
                .AppendLine($"Design Requirements: {candidate.DesignRequirements.RecordId:D}@{candidate.DesignRequirements.Revision} · {candidate.DesignRequirements.CatalogDigest}")
                .AppendLine($"Design trace: {candidate.DesignTrace.RecordId:D}@{candidate.DesignTrace.Revision} · {candidate.DesignTrace.ReconciliationDigest}")
                .AppendLine($"Implementation target catalog: revision {candidate.ImplementationTargetCatalogRevision} · {candidate.ImplementationTargetCatalogDigest}")
                .AppendLine($"Comparison: policy {candidate.ComparisonPolicyDigest} · receipt {candidate.ComparisonDigest}");
        }
        else output.AppendLine("Candidate record: not recorded");
        return output
            .AppendLine()
            .AppendLine($"Snapshot digest: {projection.SnapshotDigest}")
            .Append(
                "Authority boundary: exact candidate identities, version axes, catalog and comparison digests, counts, " +
                "classifications, severities, review state, and non-effect status only; this view " +
                "does not establish an actual Baseline Set, drift completeness, external completeness, design or implementation validity, " +
                "approval, readiness, remediation effect, call Figma, import or write content, change implementation, " +
                "or grant action authority.")
            .ToString();
    }

    public async Task<string> ClassifyInitiativeAsync(
        InitiativeEntryContext context,
        InitiativeClassificationInput input,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Initiative.State is "completed" or "cancelled")
        {
            throw new ArgumentException($"Terminal Initiative {context.Initiative.State} entry records are immutable.");
        }
        var fresh = await ReadInitiativeEntryContextAsync(context.Initiative.Id, cancellationToken);
        if (!SameInitiativeEntryBinding(fresh, context))
        {
            throw new ArgumentException(
                "The Initiative changed while the classification form was open. Refresh and review the exact revision.");
        }
        var updated = await client.ClassifyInitiativeAsync(
            context.Initiative.Id,
            context.Initiative.Revision,
            input,
            actorId,
            cancellationToken);
        return RenderInitiativeEntry(await ReadInitiativeEntryContextAsync(updated.Id, cancellationToken));
    }

    public async Task<string> ResolveInitiativeApplicabilityAsync(
        InitiativeEntryContext context,
        InitiativeApplicabilityMatrixInput input,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.Initiative.State is "completed" or "cancelled")
        {
            throw new ArgumentException($"Terminal Initiative {context.Initiative.State} entry records are immutable.");
        }
        if (context.Assessment.Classification.Status != "current")
        {
            throw new ArgumentException(
                "Record a classification bound to the current Product revision before resolving applicability.");
        }
        var fresh = await ReadInitiativeEntryContextAsync(context.Initiative.Id, cancellationToken);
        if (!SameInitiativeEntryBinding(fresh, context))
        {
            throw new ArgumentException(
                "The Initiative changed while the applicability form was open. Refresh and review the exact revision.");
        }
        var coverage = context.Assessment.Applicability.Coverage;
        if (coverage.CatalogVersion is null || coverage.CatalogDigest is null || coverage.SubjectCount < 1)
        {
            throw new ArgumentException("The canonical applicability subject catalog is unavailable.");
        }
        var subjectCatalog = new InitiativeApplicabilitySubjectCatalogBinding(
            coverage.CatalogVersion,
            coverage.CatalogDigest,
            coverage.SubjectCount);
        if (input.SubjectCatalog is not null && input.SubjectCatalog != subjectCatalog)
        {
            throw new ArgumentException(
                "The applicability form targets a stale subject catalog. Refresh and review the exact catalog.");
        }
        var updated = await client.ResolveInitiativeApplicabilityAsync(
            context.Initiative.Id,
            context.Initiative.Revision,
            input with { SubjectCatalog = subjectCatalog },
            actorId,
            cancellationToken);
        return RenderInitiativeEntry(await ReadInitiativeEntryContextAsync(updated.Id, cancellationToken));
    }

    public static string RenderInitiativeEntry(InitiativeEntryContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var initiative = context.Initiative;
        var assessment = context.Assessment;
        var output = new StringBuilder()
            .AppendLine("GAEP Initiative entry assessment")
            .AppendLine()
            .AppendLine($"Initiative ID: {initiative.Id:D}")
            .AppendLine($"Initiative revision: {initiative.Revision}")
            .AppendLine($"Lifecycle state: {initiative.State}")
            .AppendLine(
                $"Classification: {assessment.Classification.Status}" +
                (initiative.Classification is null
                    ? string.Empty
                    : $" · {initiative.Classification.PrimaryType} / {initiative.Classification.ProductProfile}"))
            .AppendLine($"Classification completeness: {assessment.Classification.Completeness.Status}")
            .AppendLine($"Completeness policy: {assessment.Classification.Completeness.PolicyVersion}")
            .AppendLine(
                $"Classification gaps: {assessment.Classification.Completeness.UnknownDimensionCount} unknown · " +
                $"{assessment.Classification.Completeness.UnresolvedQuestionCount} unresolved question(s) · " +
                $"{assessment.Classification.Completeness.MissingConditionalDimensionCount} missing conditional dimension(s)")
            .AppendLine(
                $"Classification confidence sufficient: {assessment.Classification.Completeness.ConfidenceSufficient}")
            .AppendLine(
                $"Applicability: {assessment.Applicability.Status} · matrix revision " +
                (assessment.Applicability.MatrixRevision?.ToString(CultureInfo.InvariantCulture) ?? "not recorded"))
            .AppendLine($"Applicability coverage: {assessment.Applicability.Coverage.Status}")
            .AppendLine(
                $"Canonical subject coverage: {assessment.Applicability.Coverage.CoveredSubjectCount}/" +
                assessment.Applicability.Coverage.SubjectCount)
            .AppendLine(
                $"Coverage gaps: {assessment.Applicability.Coverage.MissingSubjectCount} missing · " +
                $"{assessment.Applicability.Coverage.UnexpectedSubjectCount} unexpected · " +
                $"{assessment.Applicability.Coverage.MismatchedSubjectCount} mismatched")
            .AppendLine($"Decisions: {assessment.Applicability.DecisionCount}")
            .AppendLine($"Unresolved subjects: {assessment.Applicability.UnresolvedSubjectCount}")
            .AppendLine($"Awaiting human decisions: {assessment.Applicability.PendingHumanDecisionCount}")
            .AppendLine($"Blocked decisions: {assessment.Applicability.BlockedDecisionCount}")
            .AppendLine($"Pending approvals: {assessment.Applicability.PendingApprovalCount}")
            .AppendLine($"Rejected approvals: {assessment.Applicability.RejectedApprovalCount}")
            .AppendLine($"Assessment: {assessment.State}");
        foreach (var reason in assessment.Reasons) output.AppendLine($"  - {reason}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: entry assessment is read-only and grants no approval, readiness, not-applicable inference, " +
                "or action authority.")
            .Append(
                "Product and Initiative narrative, evidence content, owners, local paths, credentials, and raw engine " +
                "output are withheld from this compact view.")
            .ToString();
    }

    public static InitiativeClassificationInput ValidateInitiativeClassificationInput(
        InitiativeClassificationInput input)
    {
        PortableDesignProtocol.SerializeInitiativeClassificationInput(input);
        return input;
    }

    public static InitiativeApplicabilityMatrixInput ValidateInitiativeApplicabilityInput(
        InitiativeApplicabilityMatrixInput input)
    {
        PortableDesignProtocol.SerializeInitiativeApplicabilityInput(input);
        return input;
    }

    public static InitiativeApplicabilityMatrixInput CompleteInitiativeApplicabilityInput(
        InitiativeApplicabilityMatrixInput input,
        string unresolvedOwner) =>
        PortableDesignProtocol.CompleteInitiativeApplicabilityCoverage(
            input,
            PortableDesignProtocol.ValidateActorId(unresolvedOwner));

    public async Task<string> ReadPhaseDashboardAsync(CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return RenderPhaseDashboard(await client.ReadPhaseDashboardAsync(
            product,
            DeliveryPhaseId.Phase0Foundation,
            cancellationToken));
    }

    public async Task<string> ReadPhase2UxFigmaDashboardAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return RenderPhase2UxFigmaDashboard(await client.ReadPhase2UxFigmaDashboardAsync(product, initiative, cancellationToken));
    }

    public async Task<string> ReadPhase2ChangeImpactAgentModelDashboardAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return RenderPhase2ChangeImpactAgentModelDashboard(
            await client.ReadPhase2ChangeImpactAgentModelDashboardAsync(product, initiative, cancellationToken));
    }

    public async Task<string> ReadPhase3aDashboardAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return RenderPhase3aDashboard(await client.ReadPhase3aDashboardAsync(product, initiative, cancellationToken));
    }

    public async Task<string> ReadPhase1SummaryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return RenderPhase1Summary(await client.ReadPhase1SummaryAsync(product, initiative, cancellationToken));
    }

    public async Task<string> ReadPhase1ChangeImpactAsync(
        Guid initiativeId,
        ChangeImpactContext context,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(change);
        if (!context.Catalog.Items.Contains(change))
        {
            throw new ArgumentException("The selected Change is not part of the verified current catalog.", nameof(change));
        }
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != context.Product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact Product bound to the Change catalog.");
        }
        return RenderPhase1ChangeImpact(await client.ReadPhase1ChangeImpactAsync(
            context.Product,
            initiative,
            change,
            cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadPhaseDashboardTablesAsync(
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return AccessibleDashboardTables.Phase(await client.ReadPhaseDashboardAsync(
            product,
            DeliveryPhaseId.Phase0Foundation,
            cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadPhase2UxFigmaDashboardTablesAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return AccessibleDashboardTables.Phase2UxFigma(
            await client.ReadPhase2UxFigmaDashboardAsync(product, initiative, cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadPhase3aDashboardTablesAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return AccessibleDashboardTables.Phase3a(
            await client.ReadPhase3aDashboardAsync(product, initiative, cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadPhase2ChangeImpactAgentModelDashboardTablesAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        if (initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative does not target the exact current Product. Reload the Product and Initiative.");
        }
        return AccessibleDashboardTables.Phase2ChangeImpactAgentModel(
            await client.ReadPhase2ChangeImpactAgentModelDashboardAsync(product, initiative, cancellationToken));
    }

    public async Task<ChangeImpactContext> ReadChangeImpactContextAsync(
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return new ChangeImpactContext(product, await client.ListChangeImpactChangesAsync(product, cancellationToken));
    }

    public async Task<string> ReadChangeImpactAsync(
        ChangeImpactContext context,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(change);
        if (!context.Catalog.Items.Contains(change))
        {
            throw new ArgumentException(
                "The selected Change is not part of the verified current catalog. Reload and select the Change again.",
                nameof(change));
        }
        return RenderChangeImpactDashboard(
            await client.ReadChangeImpactAsync(context.Product, change, cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadChangeImpactTablesAsync(
        ChangeImpactContext context,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(change);
        if (!context.Catalog.Items.Contains(change))
        {
            throw new ArgumentException(
                "The selected Change is not part of the verified current catalog. Reload and select the Change again.",
                nameof(change));
        }
        return AccessibleDashboardTables.ChangeImpact(
            await client.ReadChangeImpactAsync(context.Product, change, cancellationToken));
    }

    public async Task<string> ReadAgentModelAsync(CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return RenderAgentModelDashboard(await client.ReadAgentModelAsync(product, cancellationToken));
    }

    public async Task<string> ReadPhase1AgentModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        var initiative = await client.ReadInitiativeAsync(initiativeId, cancellationToken);
        return RenderPhase1AgentModelDashboard(
            await client.ReadPhase1AgentModelAsync(product, initiative, cancellationToken));
    }

    public async Task<IReadOnlyList<AccessibleMetadataTable>> ReadAgentModelTablesAsync(
        CancellationToken cancellationToken = default)
    {
        var product = await client.ReadProductBindingAsync(cancellationToken);
        return AccessibleDashboardTables.AgentModel(await client.ReadAgentModelAsync(product, cancellationToken));
    }

    public async Task<string> ReadAgentReadinessAsync(CancellationToken cancellationToken = default)
    {
        var snapshots = await client.ProbeAgentReadinessAsync(cancellationToken);
        var output = new StringBuilder()
            .AppendLine("GAEP Codex and Claude readiness")
            .AppendLine()
            .AppendLine("Observation only: this view cannot select a model, change settings, start an agent, resume work, or grant execution authority.")
            .AppendLine("Only verified, path-free capability metadata is shown. Executable paths, provider credentials, and raw engine output are withheld.");
        foreach (var snapshot in snapshots)
        {
            output.AppendLine().Append(RenderAgentReadiness(snapshot));
        }
        return output.ToString();
    }

    public async Task<AgentSelectionContext> ReadAgentSelectionContextAsync(
        CancellationToken cancellationToken = default)
    {
        var current = await client.ReadAgentSelectionAsync(cancellationToken);
        if (current.Status == AgentSelectionStatus.MigrationRequired)
        {
            throw new ArgumentException(
                "The existing legacy Agent Selection requires explicit migration review. Visual Studio will not overwrite it implicitly.");
        }
        if (current.Status == AgentSelectionStatus.Invalid)
        {
            throw new ArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before selecting another agent.");
        }
        var available = (await client.ProbeAgentReadinessAsync(cancellationToken))
            .Where(snapshot => snapshot.Detected && snapshot.ExecutionInterface != "unavailable")
            .ToArray();
        if (available.Length == 0)
        {
            throw new ArgumentException("No verified local Codex or Claude adapter is currently available for selection.");
        }
        return new AgentSelectionContext(current, Array.AsReadOnly(available));
    }

    public async Task<string> SelectAgentAsync(
        string adapterId,
        string modelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings,
        string actorId,
        CancellationToken cancellationToken = default) =>
        RenderAgentSelection(await client.SelectAgentAsync(
            adapterId,
            modelId,
            settings,
            actorId,
            cancellationToken));

    public async Task<AgentHandoffContext> ReadAgentHandoffContextAsync(
        CancellationToken cancellationToken = default)
    {
        var state = await client.ReadAgentSelectionAsync(cancellationToken);
        var current = state.Status switch
        {
            AgentSelectionStatus.Selected when state.Selection is not null => state.Selection,
            AgentSelectionStatus.Unselected => throw new ArgumentException(
                "No prior Agent Selection exists. Use guarded selection before creating Runs or handoffs."),
            AgentSelectionStatus.MigrationRequired => throw new ArgumentException(
                "The existing legacy Agent Selection requires explicit migration review before a versioned handoff."),
            _ => throw new ArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before creating a handoff."),
        };
        var runs = await client.ListRunsAsync(cancellationToken);
        var active = runs.Where(run => !IsTerminalRun(run)).ToArray();
        if (active.Length > 0)
        {
            throw new ArgumentException(
                $"A versioned handoff cannot be created while {active.Length} Run(s) are non-terminal. Stop, cancel, or reconcile the Run first.");
        }
        var sourceRun = runs.FirstOrDefault()
            ?? throw new ArgumentException("No prior terminal Run exists to bind as the source of a versioned handoff.");
        if (!SamePortableBinding(sourceRun.Agent, current))
        {
            throw new ArgumentException(
                "The latest terminal Run is not bound to the current Agent Selection. Refresh or reconcile governed state before handing off.");
        }
        var available = (await client.ProbeAgentReadinessAsync(cancellationToken))
            .Where(snapshot => snapshot.Detected && snapshot.ExecutionInterface != "unavailable")
            .ToArray();
        if (available.Length == 0)
        {
            throw new ArgumentException("No verified local Codex or Claude adapter is currently available for handoff.");
        }
        return new AgentHandoffContext(current, sourceRun, Array.AsReadOnly(available));
    }

    public async Task<string> CreateAgentHandoffAsync(
        AgentHandoffContext context,
        string toAdapterId,
        string toModelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> toSettings,
        string reason,
        IReadOnlyList<string> completedWork,
        IReadOnlyList<string> unresolvedMatters,
        IReadOnlyList<string> decisions,
        IReadOnlyList<string> evidence,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (SamePortableBinding(context.Current, toAdapterId, toModelId, toSettings))
        {
            throw new ArgumentException(
                "The handoff target is identical to the current portable Agent Selection. Choose a different adapter, model, or setting.");
        }
        if (completedWork.Count == 0 && unresolvedMatters.Count == 0 && decisions.Count == 0 && evidence.Count == 0)
        {
            throw new ArgumentException(
                "Record at least one completed-work, unresolved-matter, decision, or portable evidence entry before creating a handoff.");
        }
        var freshSelection = await client.ReadAgentSelectionAsync(cancellationToken);
        var freshRuns = await client.ListRunsAsync(cancellationToken);
        var freshSource = freshRuns.FirstOrDefault();
        if (freshSelection.Status != AgentSelectionStatus.Selected || freshSelection.Selection is null ||
            !SameExactSelection(freshSelection.Selection, context.Current) || freshRuns.Any(run => !IsTerminalRun(run)) ||
            freshSource is null || !SameExactRun(freshSource, context.SourceRun) ||
            !SamePortableBinding(freshSource.Agent, context.Current))
        {
            throw new ArgumentException(
                "Agent Selection or Run history changed while the handoff form was open. No handoff was requested; reopen the flow and review fresh state.");
        }
        var target = context.Available.SingleOrDefault(snapshot => snapshot.AdapterId == toAdapterId)
            ?? throw new ArgumentException("Select one verified adapter from the loaded handoff capability snapshot.");
        var handoff = await client.CreateHandoffAsync(
            context.SourceRun.Id,
            context.SourceRun.ProductId,
            context.SourceRun.InitiativeId,
            toAdapterId,
            target.AgentId,
            toModelId,
            toSettings,
            reason,
            completedWork,
            unresolvedMatters,
            decisions,
            evidence,
            actorId,
            cancellationToken);
        return RenderAgentHandoff(handoff);
    }

    public Task<ManagedReadOnlyPreview> PreviewManagedReadOnlyAsync(
        string charterId,
        string workflowPlanId,
        CancellationToken cancellationToken = default) =>
        client.PreviewManagedReadOnlyAsync(
            ParseRequiredId(charterId, "Charter ID"),
            ParseRequiredId(workflowPlanId, "Workflow Plan ID"),
            cancellationToken);

    public static string RenderManagedReadOnlyPreview(ManagedReadOnlyPreview preview)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP managed read-only execution preview")
            .AppendLine()
            .AppendLine($"Exact preview digest: {preview.PreviewDigest}")
            .AppendLine($"Product: {preview.ProductId:D}")
            .AppendLine($"Initiative: {preview.InitiativeId:D}")
            .AppendLine($"Charter: {preview.CharterId:D}")
            .AppendLine($"Charter digest: {preview.CharterDigest}")
            .AppendLine($"Workflow Plan: {preview.WorkflowPlanId:D}")
            .AppendLine($"Workflow Plan digest: {preview.WorkflowPlanDigest}")
            .AppendLine($"Provider binding: {preview.AgentId} / {preview.ModelId} ({preview.AdapterId})")
            .AppendLine($"Selection digest: {preview.SelectionDigest}")
            .AppendLine($"Strategy: {preview.Strategy}")
            .AppendLine($"Steps: {preview.StepIds.Count}")
            .AppendLine($"Context packs: {preview.ContextPackCount}")
            .AppendLine($"Declared reads: {preview.ReadScopeCount}")
            .AppendLine($"Evidence and stop gates: {preview.Gates.Count}");
        foreach (var gate in preview.Gates)
        {
            output.AppendLine($"  - {gate.Key} [{gate.Phase}]{(gate.StepId.HasValue ? $"; step={gate.StepId.Value:D}" : string.Empty)}")
                .AppendLine($"    Criteria digest: {gate.CriteriaDigest}");
            if (gate.Criteria.Count == 0) output.AppendLine("    Criteria: none declared");
            foreach (var criterion in gate.Criteria) output.AppendLine($"    - {criterion}");
        }
        return output.AppendLine()
            .AppendLine($"Authority boundary: {preview.AuthorityBoundary}")
            .AppendLine("Every Tool permission is denied. No tool definitions, write scopes, or non-observation effects are granted.")
            .Append("This preview does not execute work; the exact digest must be attested separately.")
            .ToString();
    }

    public async Task<string> ExecuteManagedReadOnlyAsync(
        ManagedReadOnlyPreview preview,
        string actorId,
        int timeoutMs = 120_000,
        CancellationToken cancellationToken = default) =>
        RenderManagedReadOnlyReceipt(await client.ExecuteManagedReadOnlyAsync(
            preview,
            timeoutMs,
            actorId,
            cancellationToken));

    public Task<ManagedRunSummaryPage> ListManagedEvidencePageAsync(
        int offset = 0,
        int limit = 100,
        string? snapshotDigest = null,
        int? expectedTotal = null,
        CancellationToken cancellationToken = default) =>
        client.ListManagedEvidenceAsync(offset, limit, snapshotDigest, expectedTotal, cancellationToken);

    public async Task<string> ListManagedEvidenceAsync(CancellationToken cancellationToken = default) =>
        RenderManagedEvidencePage(await ListManagedEvidencePageAsync(cancellationToken: cancellationToken));

    public static string RenderManagedEvidencePage(ManagedRunSummaryPage page)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP bounded Managed Run evidence")
            .AppendLine()
            .AppendLine($"Snapshot: {page.SnapshotDigest}")
            .AppendLine($"Offset / limit: {page.Offset} / {page.Limit}")
            .AppendLine($"Displayed: {page.Items.Count} of {page.Total}")
            .AppendLine($"Omitted from this page: {page.OmittedCount}")
            .AppendLine($"More pages available: {YesNo(page.HasMore)}");
        if (page.Items.Count == 0) output.AppendLine("No Managed Runs exist in the verified bounded inventory.");
        foreach (var item in page.Items)
        {
            output.AppendLine()
                .AppendLine($"{item.ManagedRunId:D} · {item.State} · {item.Mode}")
                .AppendLine($"  Provider: {item.AdapterId} / {item.AgentId} / {item.ModelId}")
                .AppendLine(
                    $"  Updated: {item.UpdatedAt.ToString("O", CultureInfo.InvariantCulture)}; " +
                    $"recovery={item.RecoveryStatus}; result={(item.HasResult ? "bound" : "not bound")}; " +
                    $"apply decision={(item.HasApplyDecision ? "bound" : "not bound")}");
        }
        return output.AppendLine()
            .AppendLine(
                "Boundary: this audit-gated observation cannot start, resume, cancel, apply, discard, approve, or grant " +
                "Run, Tool, write, effect, outcome, implementation-readiness, or release authority.")
            .Append(
                "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, " +
                "workspace paths, and credentials are withheld.")
            .ToString();
    }

    public async Task<string> ReadManagedEvidenceAsync(
        string managedRunId,
        CancellationToken cancellationToken = default) =>
        RenderManagedEvidenceDetail(await client.ReadManagedEvidenceAsync(
            ParseRequiredId(managedRunId, "Managed Run ID"),
            cancellationToken));

    public Task<ManagedReviewPreview> ReadManagedReviewAsync(
        string managedRunId,
        CancellationToken cancellationToken = default) =>
        client.ReadManagedReviewAsync(ParseRequiredId(managedRunId, "Managed Run ID"), cancellationToken);

    public Task<ManagedReviewTransition> ApplyManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        CancellationToken cancellationToken = default) =>
        client.ApplyManagedReviewAsync(preview, actorId, cancellationToken);

    public Task<ManagedReviewTransition> DiscardManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        CancellationToken cancellationToken = default) =>
        client.DiscardManagedReviewAsync(preview, actorId, cancellationToken);

    public static string RenderManagedReviewPreview(ManagedReviewPreview preview)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact staged Managed Run review")
            .AppendLine()
            .AppendLine($"Managed Run: {preview.ManagedRunId:D}")
            .AppendLine($"Governed Run: {preview.RunId:D}")
            .AppendLine($"Revision / state: {preview.ManagedRunRevision} / {preview.State}")
            .AppendLine($"Product / Initiative: {preview.ProductId:D} / {preview.InitiativeId:D}")
            .AppendLine($"Bindings digest: {preview.BindingsDigest}")
            .AppendLine($"Result: {preview.Result.ResultId:D} ({preview.Result.ResultDigest})")
            .AppendLine($"Provider disposition: {preview.Result.ProviderDisposition}")
            .AppendLine($"Governed outcome before decision: {preview.Result.OutcomeStatus} ({preview.Result.OutcomeBasis})")
            .AppendLine($"Evidence: {preview.Staging.EvidenceId:D} ({preview.Staging.EvidenceDigest})")
            .AppendLine($"Stage: {preview.Staging.ApplyState}; baseline={preview.Staging.BaselineDigest}; final={preview.Staging.FinalDigest}")
            .AppendLine(
                $"Complete bounded inventory: {preview.Staging.ChangeCount}/{preview.Staging.ChangedInventoryLimit}; " +
                $"omitted={preview.Staging.OmittedCount}; digest={preview.Staging.ChangedInventoryDigest}")
            .AppendLine(
                $"Excluded staged paths: {preview.Staging.ExcludedPathCount}; set digest={preview.Staging.ExcludedPathSetDigest}")
            .AppendLine(
                $"Apply available: {YesNo(preview.CanApply)}; discard available: {YesNo(preview.CanDiscard)}; " +
                $"local journal observed: {YesNo(preview.HasLocalJournal)}")
            .AppendLine(
                $"Exact write envelope: {(preview.ApplyConfirmation is null ? "not available" : string.Join(", ", preview.ApplyConfirmation.WriteEnvelope))}")
            .AppendLine($"Preview digest: {preview.PreviewDigest}")
            .AppendLine($"Warnings: {(preview.Result.WarningCodes.Count == 0 ? "none" : string.Join(", ", preview.Result.WarningCodes))}")
            .AppendLine()
            .AppendLine("Exact changed-file inventory")
            .AppendLine();
        if (preview.Staging.ChangedInventory.Count == 0) output.AppendLine("No staged workspace file changes were recorded.");
        for (var index = 0; index < preview.Staging.ChangedInventory.Count; index++)
        {
            var change = preview.Staging.ChangedInventory[index];
            output.AppendLine($"{index + 1}. {change.Kind.ToUpperInvariant()} {change.Path}")
                .AppendLine(
                    $"   Before: {change.BeforeDigest ?? "absent"}; {change.BeforeSize ?? 0} byte(s); " +
                    $"mode {(change.BeforeMode.HasValue ? Convert.ToString(change.BeforeMode.Value, 8) : "absent")}")
                .AppendLine(
                    $"   After: {change.AfterDigest ?? "absent"}; {change.AfterSize ?? 0} byte(s); " +
                    $"mode {(change.AfterMode.HasValue ? Convert.ToString(change.AfterMode.Value, 8) : "absent")}");
        }
        return output.AppendLine()
            .AppendLine(
                "Boundary: this view authorizes no mutation. Apply or discard requires a separate exact " +
                "revision-and-preview-digest-bound human decision and a second cancel-default confirmation.")
            .AppendLine(
                "Apply is limited to this exact changed inventory and write envelope. The host records post-apply " +
                "Workflow gates not assessed, so it cannot claim governed outcome satisfaction.")
            .Append(
                "Provider output, prompts, context content, staged source bytes, absolute paths, executable paths, " +
                "process state, workspace paths and credentials are withheld.")
            .ToString();
    }

    public static string RenderManagedReviewTransition(ManagedReviewTransition transition)
    {
        var detail = transition.Detail;
        return new StringBuilder()
            .AppendLine("GAEP managed staged-review transition")
            .AppendLine()
            .AppendLine($"Decision: {transition.Decision}")
            .AppendLine($"Managed Run: {transition.ManagedRunId:D}")
            .AppendLine($"Revision: {transition.SourceManagedRunRevision} -> {transition.ManagedRunRevision}")
            .AppendLine($"Persisted state: {transition.State}")
            .AppendLine($"Source preview: {transition.SourcePreviewDigest}")
            .AppendLine($"Transition digest: {transition.TransitionDigest}")
            .AppendLine($"Apply available: {YesNo(transition.CanApply)}; discard available: {YesNo(transition.CanDiscard)}")
            .AppendLine($"Local journal observed: {YesNo(transition.HasLocalJournal)}")
            .AppendLine($"Result digest: {detail.Summary.ResultDigest ?? "not bound"}")
            .AppendLine($"Apply-decision digest: {detail.Summary.ApplyDecisionDigest ?? "not bound"}")
            .AppendLine($"Provider disposition: {detail.Result?.ProviderDisposition ?? "not available"}")
            .AppendLine(
                $"Governed outcome: {(detail.Result is null ? "not available" : $"{detail.Result.OutcomeStatus} ({detail.Result.OutcomeBasis})")}")
            .AppendLine()
            .Append(
                "Boundary: this receipt proves only the verified persisted transition. Provider completion, governed " +
                "outcome satisfaction, machine-local stage cleanup and recovery-journal cleanup remain separate claims.")
            .ToString();
    }

    public static string NormalizeHandoffReason(string value) =>
        PortableDesignProtocol.ValidateHandoffText(value, "Handoff reason", 2, 5_000);

    public static IReadOnlyList<string> BuildHandoffTextList(string value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) return Array.Empty<string>();
        return PortableDesignProtocol.ValidateHandoffTextList(
            value.Split(',', StringSplitOptions.TrimEntries),
            label);
    }

    public static IReadOnlyDictionary<string, PortableAgentSettingValue> BuildAgentSelectionSettings(
        AgentReadinessSnapshot snapshot,
        IReadOnlyDictionary<string, string> inputs)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(inputs);
        var declarations = snapshot.Settings.ToDictionary(setting => setting.Key, StringComparer.Ordinal);
        if (inputs.Keys.Any(key => !declarations.ContainsKey(key)))
        {
            throw new ArgumentException("Agent settings include an undeclared key.", nameof(inputs));
        }
        var values = new Dictionary<string, PortableAgentSettingValue>(StringComparer.Ordinal);
        foreach (var setting in snapshot.Settings)
        {
            if (setting.Sensitive)
            {
                throw new ArgumentException(
                    $"{setting.Label} requires a machine-local credential binding, which this portable Visual Studio selection flow does not collect or store.");
            }
            var raw = inputs.TryGetValue(setting.Key, out var supplied) ? supplied : string.Empty;
            if (string.IsNullOrWhiteSpace(raw) && (!setting.Required || setting.DefaultValue is not null)) continue;
            if (string.IsNullOrWhiteSpace(raw)) throw new ArgumentException($"{setting.Label} is required.");
            values[setting.Key] = setting.Kind switch
            {
                "select" => ParseSelectSetting(setting, raw),
                "boolean" => bool.TryParse(raw, out var boolean)
                    ? new PortableAgentBoolean(boolean)
                    : throw new ArgumentException($"{setting.Label} must be true or false."),
                "number" => ParseNumberSetting(setting, raw),
                "string" => new PortableAgentText(
                    PortableDesignProtocol.ValidatePortableSettingInput(raw, setting.Label, minimum: 1)),
                "string-list" => ParseStringListSetting(setting, raw),
                _ => throw new ArgumentException($"{setting.Label} has an unsupported portable setting kind."),
            };
        }
        return new System.Collections.ObjectModel.ReadOnlyDictionary<string, PortableAgentSettingValue>(values);
    }

    public async Task<string> ListPortableDesignSnapshotsAsync(CancellationToken cancellationToken = default)
    {
        var page = await client.ListPortableDesignSnapshotsAsync(cancellationToken: cancellationToken);
        var output = new StringBuilder()
            .AppendLine($"Portable design metadata: {page.Items.Count} of {page.Total}")
            .AppendLine($"Governance: {page.GovernanceBoundary}")
            .Append($"Privacy: {page.PrivacyBoundary}");
        if (page.Items.Count == 0)
        {
            output.AppendLine().AppendLine().Append("No snapshots were found on this page.");
        }
        for (var index = 0; index < page.Items.Count; index++)
        {
            output.AppendLine().AppendLine().AppendLine($"{index + 1}. {page.Items[index].Title}");
            output.Append(RenderSummary(page.Items[index]));
        }
        return output.ToString();
    }

    public async Task<string> ReadPortableDesignSnapshotAsync(
        string bundleId,
        CancellationToken cancellationToken = default)
    {
        var normalized = ParseBundleId(bundleId);
        return RenderSummary(await client.ReadPortableDesignSnapshotAsync(normalized, cancellationToken));
    }

    public async Task<string> ImportPortableDesignSnapshotAsync(
        string bundleRoot,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var normalizedBundleRoot = PortableDesignProtocol.NormalizeBundleRoot(bundleRoot);
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        var initial = await client.ReadProductBindingAsync(cancellationToken);
        var current = await client.ReadProductBindingAsync(cancellationToken);
        if (current.Id != initial.Id || current.Revision != initial.Revision)
        {
            throw PortableDesignProtocol.ProductContextChanged();
        }
        var imported = await client.ImportPortableDesignSnapshotAsync(
            normalizedBundleRoot,
            initial.Id,
            initial.Revision,
            normalizedActorId,
            cancellationToken);
        return new StringBuilder()
            .AppendLine($"Imported into {initial.Name} at exact Product revision {initial.Revision}.")
            .AppendLine("The result remains pending human review; import validation is not approval or a baseline.")
            .Append(RenderSummary(imported))
            .ToString();
    }

    public static string NormalizeWorkspacePath(string workspacePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workspacePath);
        if (workspacePath.Length > 32_768 || workspacePath.Contains('\0') ||
            !Path.IsPathFullyQualified(workspacePath) || IsNetworkPath(workspacePath))
        {
            throw new ArgumentException("Workspace must be an absolute local folder.", nameof(workspacePath));
        }
        var normalized = Path.GetFullPath(workspacePath);
        if (!Directory.Exists(normalized))
        {
            throw new ArgumentException("Workspace must be an existing local folder.", nameof(workspacePath));
        }
        return normalized;
    }

    public static string SafeError(Exception error) => error switch
    {
        OperationCanceledException => "The GAEP request was cancelled.",
        EngineHostException hostError => hostError.Message,
        ArgumentException argumentError => argumentError.Message,
        _ => "The configured local GAEP engine is unavailable. Verify the executable and digest settings, then retry.",
    };

    private static string RenderProduct(ProductBinding product) => new StringBuilder()
        .AppendLine($"Product: {product.Name}")
        .AppendLine($"Product ID: {product.Id:D}")
        .Append($"Revision: {product.Revision}")
        .ToString();

    private static string RenderPhaseDashboard(PhaseDashboardFramework dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP phase-scoped dashboard framework")
            .AppendLine()
            .AppendLine($"Delivery phase: {dashboard.PhaseLabel}")
            .AppendLine($"Exact Product revision: {dashboard.ProductRevision}")
            .AppendLine($"Product digest: {dashboard.ProductDigest}")
            .AppendLine($"Composition digest: {dashboard.CompositionDigest}")
            .AppendLine($"Observed: {dashboard.ObservedAt:O}")
            .AppendLine($"Source: {dashboard.SourceBoundary}")
            .AppendLine($"Evidence freshness: {dashboard.EvidenceCues.Freshness}")
            .AppendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
            .AppendLine();
        foreach (var panel in dashboard.Panels)
        {
            output.AppendLine(
                $"{panel.Title} · {panel.Role} · applicability={panel.Applicability.Status} " +
                $"({panel.Applicability.Basis}) · state={panel.State}");
            if (panel.Applicability.Decision is { } decision)
            {
                output.AppendLine(
                    $"  Decision: {decision.RecordId:D} revision {decision.Revision}; digest={decision.Digest}");
            }
        }
        output.AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .AppendLine(
                "Boundary: this is a read-only governed-state projection. It grants no mutation, applicability, " +
                "phase-entry, approval, readiness, acceptance, release, Run, Tool, or effect authority.")
            .Append(
                "Product text, source bytes, local paths, provider output, prompts, executable state, and credentials are withheld.")
            .ToString();
    }

    private static string RenderPhase2UxFigmaDashboard(Phase2UxFigmaDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Phase 2 UX and Figma dashboard")
            .AppendLine()
            .AppendLine($"Initiative: {dashboard.InitiativeId:D} · revision {dashboard.InitiativeRevision} · {dashboard.InitiativeState}")
            .AppendLine($"Phase state: {dashboard.PhaseState}")
            .AppendLine(
                $"Sources: {dashboard.CurrentSourceCount} current · {dashboard.AttentionRequiredSourceCount} attention-required · " +
                $"{dashboard.UnavailableSourceCount} unavailable · 23 expected")
            .AppendLine(
                $"Experience: {dashboard.PersonaCount} personas · {dashboard.DesignRoleCount} design roles · " +
                $"{dashboard.JourneyCount} journeys · {dashboard.ScreenCount} screens · {dashboard.StateCount} states")
            .AppendLine(
                $"Design system: {dashboard.RequirementCount} requirements · {dashboard.TokenCount} tokens · " +
                $"{dashboard.ComponentCount} components · {dashboard.AccessibilityRuleCount} accessibility rules")
            .AppendLine(
                $"Figma and trace: {dashboard.FigmaFileCount} files · {dashboard.DesignBindingCount} bindings · " +
                $"connection {dashboard.FigmaConnectionState} · write {dashboard.FigmaWriteExecutionState} · " +
                $"import {dashboard.FigmaImportExecutionState}")
            .AppendLine(
                $"Drift: {dashboard.DriftObservationCount} observations · {dashboard.DriftCount} drift · " +
                $"{dashboard.UnassessedDriftCount} unassessed · {dashboard.RemediationCandidateCount} remediation candidates")
            .AppendLine(
                $"Freshness: {dashboard.FreshnessState} · {dashboard.StaleBindingCount} stale bindings · " +
                $"{dashboard.StaleSourceReferenceCount} stale sources · {dashboard.UnresolvedQuestionCount} questions")
            .AppendLine(
                "Product Owner acceptance: not established · approval: not established · Baseline Set designation: " +
                "not established · readiness and phase-entry authority: not established")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine();
        foreach (var source in dashboard.Sources)
        {
            output.AppendLine($"{source.Title} · {source.Group} · {source.Availability} · {source.AssessmentState ?? "no state inferred"}");
        }
        output.AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .Append(
                "Boundary: this derived read-only view is not a second source of truth and grants no completeness, " +
                "validity, approval, baseline, readiness, phase-entry, Figma, remediation, implementation, release, or action authority.")
            .ToString();
    }

    private static string RenderPhase3aDashboard(Phase3aDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Phase 3A backlog and implementation readiness dashboard")
            .AppendLine()
            .AppendLine($"Initiative: {dashboard.InitiativeId:D}@{dashboard.InitiativeRevision} · {dashboard.InitiativeState}")
            .AppendLine($"Phase state: {dashboard.PhaseState}")
            .AppendLine(
                $"Sources: {dashboard.CurrentSourceCount} current · {dashboard.AttentionRequiredSourceCount} attention-required · " +
                $"{dashboard.UnavailableSourceCount} unavailable · 20 expected")
            .AppendLine(
                $"Provider workflow evidence: {dashboard.ProviderWorkflowEvidenceCount}/2 sealed local deterministic · " +
                "live acceptance 0 · native-host acceptance 0")
            .AppendLine($"Freshness: {dashboard.FreshnessState} · {dashboard.StaleCount} stale · {dashboard.UnresolvedCount} unresolved")
            .AppendLine("Pagination: 1-20 of 20 · truncated false")
            .AppendLine("Export: csv-visible-metadata-only · formula prefixes neutralized true · hidden content excluded true")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine()
            .AppendLine("Views");
        foreach (var view in dashboard.Views)
        {
            output.AppendLine(
                $"{view.Title} · {view.State} · {view.CurrentSourceCount} current/{view.AttentionRequiredSourceCount} attention/" +
                $"{view.UnavailableSourceCount} unavailable · {view.CandidateCount} candidates · " +
                $"{view.EvidenceReferenceCount} evidence · {view.GapCount} gaps · {view.ConflictCount} conflicts · " +
                $"{view.StaleCount} stale · {view.UnresolvedCount} unresolved · {view.WorkflowEvidenceCount} workflows");
        }
        output.AppendLine().AppendLine("Governed sources");
        foreach (var source in dashboard.Sources)
        {
            output.AppendLine(
                $"{source.Title} · {source.Group} · {source.Availability} · {source.AssessmentState ?? "no state inferred"} · " +
                $"{source.GapCount} gaps · {source.ConflictCount} conflicts · {source.StaleCount} stale · {source.UnresolvedCount} unresolved");
        }
        output.AppendLine().AppendLine("Bounded provider workflow evidence");
        foreach (var workflow in dashboard.Workflows)
        {
            output.AppendLine(
                $"{workflow.Provider} · {workflow.Availability} · {workflow.ExecutionMode} · live {workflow.LiveAcceptance} · " +
                $"semantic quality {workflow.SemanticQuality} · authority {workflow.Authority}");
        }
        output.AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .Append(
                "Boundary: this derived read-only view grants no completeness, priority, readiness, waiver, ownership, " +
                "implementation, acceptance, release, deployment, or action authority.")
            .ToString();
    }

    private static string RenderPhase2ChangeImpactAgentModelDashboard(
        Phase2ChangeImpactAgentModelDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Phase 2 Change, Impact, Agent and Model dashboard")
            .AppendLine()
            .AppendLine($"Initiative: {dashboard.InitiativeId:D}@{dashboard.InitiativeRevision} · {dashboard.InitiativeState}")
            .AppendLine(
                $"Synchronization: {dashboard.Synchronization.State} · design delta {dashboard.Synchronization.DesignDelta} · " +
                $"conflicts {dashboard.Synchronization.ConflictResolution} · human approval {dashboard.Synchronization.HumanDesignApproval} · " +
                $"baseline {dashboard.Synchronization.DesignBaseline} · drift {dashboard.Synchronization.DesignDriftDetection}")
            .AppendLine(
                $"Synchronization effects: {dashboard.Synchronization.SynchronizationEffectState} · " +
                $"Figma connection {dashboard.Synchronization.FigmaConnectionState} · " +
                $"write {dashboard.Synchronization.FigmaWriteExecutionState} · import {dashboard.Synchronization.FigmaImportExecutionState}")
            .AppendLine(
                $"Bounded impact: {dashboard.Impact.State} · {dashboard.Impact.RequirementCount} requirements · " +
                $"{dashboard.Impact.DesignBindingCount} bindings · {dashboard.Impact.UnboundDesignItemCount} unbound items · " +
                $"{dashboard.Impact.DriftCount} drift · {dashboard.Impact.UnassessedCount} unassessed")
            .AppendLine("Impact boundary: bounded-not-complete · completeness not-established · design validity not-established · revalidation not-established")
            .AppendLine(
                $"Capabilities: {dashboard.Capabilities.Shown}/{dashboard.Capabilities.Total} shown · " +
                $"{dashboard.Capabilities.Detected} detected · {dashboard.Capabilities.Selected} selected · " +
                $"selection {dashboard.SelectionState}")
            .AppendLine(
                $"Runs: {dashboard.Runs.Shown}/{dashboard.Runs.Total} shown · {dashboard.Runs.Terminal} terminal · " +
                $"{dashboard.Runs.NonTerminal} non-terminal · {dashboard.Runs.ResultBound} results bound · " +
                $"{dashboard.Runs.ActualEffectCount} recorded actual effects")
            .AppendLine(
                $"Handoffs: {dashboard.Handoffs.Shown}/{dashboard.Handoffs.Total} shown · " +
                $"{dashboard.Handoffs.PendingAcknowledgement} pending acknowledgement · {dashboard.Handoffs.Acknowledged} acknowledged")
            .AppendLine("Provider usage and cost: unavailable/unavailable · live provider quality not-assessed · semantic output quality not-assessed")
            .AppendLine($"Freshness: {dashboard.FreshnessState} · Phase 2 {dashboard.Phase2State} · Agent/Model {dashboard.AgentModelState}")
            .AppendLine(
                $"Product Owner acceptance: {dashboard.ProductOwnerAcceptance} · Run launch authority: " +
                $"{dashboard.RunLaunchAuthority} · effect authority: {dashboard.EffectAuthority}")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine($"Phase 2 source digest: {dashboard.Phase2UxFigmaSnapshotDigest}")
            .AppendLine($"Agent/Model source digest: {dashboard.AgentModelSnapshotDigest}")
            .AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .AppendLine(
                "Boundary: these derived read-only views are not a second source of truth and grant no impact completeness, " +
                "design validity, provider quality, selection, Run launch, approval, baseline, readiness, remediation, " +
                "Figma, implementation, effect, release, or action authority.")
            .Append(
                "Design content, Product text, Run narrative, provider output, prompts, source bytes, machine paths, " +
                "credentials, permissions, and sensitive setting values are withheld.")
            .ToString();
    }

    private static string RenderPhase1Summary(Phase1SummaryDashboard summary)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Phase 1 summary and readiness dashboard")
            .AppendLine()
            .AppendLine($"Initiative: {summary.InitiativeId:D} · revision {summary.InitiativeRevision} · {summary.InitiativeState}")
            .AppendLine($"Phase state: {summary.PhaseState}")
            .AppendLine($"Declared gap indicators: {summary.DeclaredGapCount} · attention signals: {summary.AttentionSignalCount}")
            .AppendLine(
                $"P0-P4 readiness: {summary.ReadinessResult} · {summary.ReadinessSatisfiedOutputs}/" +
                $"{summary.ReadinessApplicableOutputs} applicable outputs satisfied · {summary.ReadinessGapCount} declared gaps")
            .AppendLine(
                $"P5 handoff: {summary.HandoffState} · {summary.HandoffTransferState} · {summary.HandoffIncludedItems}/" +
                $"{summary.HandoffTotalItems} items included · {summary.HandoffGapCount} declared gaps")
            .AppendLine(
                $"Freshness: {summary.FreshnessState} · {summary.StaleBindingCount} stale bindings · " +
                $"{summary.StaleSourceReferenceCount} stale Source references")
            .AppendLine("Owners: unbound; no governed phase-owner assignment is bound.")
            .AppendLine("Product Owner acceptance: not established · readiness authority: not established · phase-entry authority: not established")
            .AppendLine($"Snapshot digest: {summary.SnapshotDigest}")
            .AppendLine($"Source: {summary.SourceBoundary}")
            .AppendLine($"Privacy: {summary.PrivacyBoundary}")
            .AppendLine();
        foreach (var limitation in summary.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .Append(
                "Boundary: this read-only candidate summary grants no readiness, approval, acceptance, phase-entry, " +
                "release, Run, Tool, write, or action authority.")
            .ToString();
    }

    private static string RenderPhase1ChangeImpact(Phase1ChangeImpactDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Phase 1 Change and impact dashboard")
            .AppendLine()
            .AppendLine($"Initiative: {dashboard.InitiativeId:D}@{dashboard.InitiativeRevision} · {dashboard.InitiativeState}")
            .AppendLine($"Change: {dashboard.Change.RecordId:D}@{dashboard.Change.Revision} · {dashboard.Change.State}")
            .AppendLine(
                $"Coverage: {dashboard.CurrentTraceObservedOutputCount} current trace-observed · " +
                $"{dashboard.AttentionRequiredOutputCount} attention · " +
                $"{dashboard.ImpactNotEstablishedOutputCount} impact not established")
            .AppendLine(
                $"Change scope: {dashboard.ChangedArtifactCount} changed artifacts · {dashboard.EffectTargetCount} effect targets · " +
                $"{dashboard.AffectedUnitCount} affected trace units")
            .AppendLine(
                $"Freshness: {dashboard.FreshnessState} · {dashboard.TraceAttentionLinkCount} trace-attention links · " +
                $"{dashboard.StaleBindingCount} stale bindings")
            .AppendLine("Owners: unbound · revalidation: not established · Change approval: not established")
            .AppendLine("Risk-acceptance authority, Product Owner acceptance, and effect authority: not established")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine()
            .AppendLine("P0-P4 governed output impact coverage:");
        foreach (var item in dashboard.Outputs)
        {
            output.AppendLine(
                $"  {item.OutputKind} · readiness={item.ReadinessApplicability}/{item.ReadinessEvaluationState}/" +
                $"{item.ReadinessFreshness} · impact={item.ImpactState} · exact={item.ExactMatchedSubjectCount}/" +
                $"{item.ReadinessSubjectCount} · traces={item.TraceReferenceCount} · " +
                $"handoff={item.HandoffDisposition}/{item.HandoffFreshness} · revalidation={item.RevalidationState}");
        }
        output.AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output
            .AppendLine()
            .Append(
                "Boundary: trace presence proves only recorded links; absence does not prove no impact. This read-only " +
                "projection grants no impact-completeness, revalidation, approval, risk-acceptance, readiness, " +
                "effect, release, write, or action authority.")
            .ToString();
    }

    private static string RenderChangeImpactDashboard(ChangeImpactDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Change and impact dashboard")
            .AppendLine()
            .AppendLine($"Change: {dashboard.Change.RecordId:D}")
            .AppendLine($"Change revision / state: {dashboard.Change.Revision} / {dashboard.Change.State}")
            .AppendLine($"Change digest: {dashboard.Change.Digest}")
            .AppendLine($"Product revision: {dashboard.ProductRevision}")
            .AppendLine($"Product digest: {dashboard.ProductDigest}")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine($"Effects: {string.Join(", ", dashboard.Change.EffectEnvelope)}")
            .AppendLine(
                $"Freshness: {dashboard.Freshness.State}; observed {dashboard.ObservedAt:O}; " +
                $"trace evaluated {dashboard.Freshness.EvaluatedAt:O}")
            .AppendLine($"Source: {dashboard.SourceBoundary}")
            .AppendLine($"Evidence freshness: {dashboard.EvidenceCues.Freshness}")
            .AppendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
            .AppendLine("Approval: not established. The current contract has no general Change approval record.")
            .AppendLine()
            .AppendLine($"Work Items ({dashboard.Limits.WorkItems.Shown}/{dashboard.Limits.WorkItems.Total}):");
        foreach (var entry in dashboard.WorkItems)
        {
            output.AppendLine(
                $"  {entry.Record.RecordId:D}@{entry.Record.Revision} · {entry.State} · {entry.Record.Digest}");
        }
        output.AppendLine()
            .AppendLine(
                $"Changed artifacts ({dashboard.Limits.ChangedArtifacts.Shown}/{dashboard.Limits.ChangedArtifacts.Total}):");
        foreach (var entry in dashboard.ChangedArtifacts)
        {
            output.AppendLine(
                $"  {entry.Locator.Value} · {entry.Locator.Kind} · Work Item {entry.SourceWorkItem.RecordId:D}");
        }
        output.AppendLine()
            .AppendLine($"Effect targets ({dashboard.Limits.EffectTargets.Shown}/{dashboard.Limits.EffectTargets.Total}):");
        foreach (var entry in dashboard.EffectTargets)
        {
            output.AppendLine(
                $"  {entry.Locator.Value} · {entry.Locator.Kind} · Work Item {entry.SourceWorkItem.RecordId:D}");
        }
        output.AppendLine()
            .AppendLine($"Affected units ({dashboard.Limits.AffectedUnits.Shown}/{dashboard.Limits.AffectedUnits.Total}):");
        foreach (var entry in dashboard.AffectedUnits)
        {
            output.AppendLine(
                $"  {entry.Direction} · {entry.Endpoint.RecordType}:{entry.Endpoint.RecordId} · " +
                $"{entry.Relationship} · {entry.Trace.AssessedState}");
        }
        output.AppendLine()
            .AppendLine($"Related Decisions ({dashboard.Limits.Decisions.Shown}/{dashboard.Limits.Decisions.Total}):");
        foreach (var entry in dashboard.Decisions)
        {
            output.AppendLine(
                $"  {entry.Record.RecordId:D}@{entry.Record.Revision} · {entry.State} · {entry.Outcome}");
        }
        output.AppendLine()
            .AppendLine($"Related Risks ({dashboard.Limits.Risks.Shown}/{dashboard.Limits.Risks.Total}):");
        foreach (var entry in dashboard.Risks)
        {
            output.AppendLine(
                $"  {entry.Record.RecordId:D}@{entry.Record.Revision} · {entry.State} · " +
                $"{entry.Likelihood}/{entry.Impact} · {entry.Acceptance}");
        }
        output.AppendLine()
            .AppendLine(
                $"Trace attention: unresolved={dashboard.Freshness.UnresolvedTraceLinks}; " +
                $"invalid={dashboard.Freshness.InvalidTraceLinks}; stale={dashboard.Freshness.StaleTraceLinks}; " +
                $"stale governance={dashboard.Freshness.StaleGovernanceReferences}")
            .AppendLine(
                $"Omissions: {(dashboard.Limits.Truncated ? "one or more bounded categories are truncated" : "none in bounded categories")}")
            .AppendLine("Coverage: absence of a trace link does not prove absence of impact.");
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: this read-only projection grants no Change approval, risk acceptance, mutation, Run, Tool, " +
                "write, effect, phase-entry, readiness, release, or outcome authority.")
            .Append(
                "Product text, Change text, Work Item text, source bytes, absolute paths, provider output, prompts, " +
                "executable state, and credentials are withheld.")
            .ToString();
    }

    private static string RenderPhase1AgentModelDashboard(Phase1AgentModelDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Phase 1 Agent and Model execution truth")
            .AppendLine()
            .AppendLine($"Initiative: {dashboard.InitiativeId:D}@{dashboard.InitiativeRevision}; {dashboard.InitiativeState}")
            .AppendLine($"Product revision: {dashboard.ProductRevision}")
            .AppendLine(
                $"Capabilities: {dashboard.Capabilities.Shown}/{dashboard.Capabilities.Total} shown; " +
                $"{dashboard.Capabilities.Detected} detected; {dashboard.Capabilities.Unavailable} unavailable; " +
                $"{dashboard.Capabilities.Selected} selected")
            .AppendLine(
                $"Runs: {dashboard.Runs.Shown}/{dashboard.Runs.Total} shown; {dashboard.Runs.Terminal} terminal; " +
                $"{dashboard.Runs.NonTerminal} non-terminal")
            .AppendLine(
                $"Managed results: {dashboard.Runs.ResultBound} bound; " +
                $"{dashboard.Runs.ActualEffectCount} recorded actual effects")
            .AppendLine(
                $"Outcomes: {dashboard.Runs.Outcomes.Satisfied} satisfied; " +
                $"{dashboard.Runs.Outcomes.Failed} failed; {dashboard.Runs.Outcomes.NotAssessed} not assessed; " +
                $"{dashboard.Runs.Outcomes.Indeterminate} indeterminate")
            .AppendLine(
                $"Handoffs: {dashboard.Handoffs.Shown}/{dashboard.Handoffs.Total} shown; " +
                $"{dashboard.Handoffs.PendingAcknowledgement} pending acknowledgement; " +
                $"{dashboard.Handoffs.Acknowledged} acknowledged")
            .AppendLine("Provider usage and cost: unavailable")
            .AppendLine($"Live provider quality: {dashboard.LiveProviderQuality}")
            .AppendLine($"Semantic output quality: {dashboard.SemanticOutputQuality}")
            .AppendLine(
                $"Freshness: {dashboard.FreshnessState}; selection capability {dashboard.SelectionCapabilityState}")
            .AppendLine($"Product Owner acceptance: {dashboard.ProductOwnerAcceptance}")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine();
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: this read-only Initiative-scoped projection does not establish provider readiness or " +
                "quality, choose a provider, acknowledge a handoff, launch a Run, authorize effects, approve " +
                "Phase 1, record Product Owner acceptance, or grant release authority.")
            .AppendLine(
                "Product text, Run narrative, provider output, prompts, source bytes, machine paths, credentials, " +
                "and sensitive setting values are withheld.")
            .AppendLine()
            .Append(RenderAgentModelDashboard(dashboard.AgentModel))
            .ToString();
    }

    private static string RenderAgentModelDashboard(AgentModelDashboard dashboard)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP exact Agent and Model dashboard")
            .AppendLine()
            .AppendLine($"Product revision: {dashboard.ProductRevision}")
            .AppendLine($"Product digest: {dashboard.ProductDigest}")
            .AppendLine($"Snapshot digest: {dashboard.SnapshotDigest}")
            .AppendLine(
                $"Freshness: {dashboard.Freshness.State}; selection capability " +
                dashboard.Freshness.SelectionCapabilityState)
            .AppendLine($"Source: {dashboard.SourceBoundary}")
            .AppendLine($"Evidence freshness: {dashboard.EvidenceCues.Freshness}")
            .AppendLine("Confidence: not assessed; no governed confidence evaluation is bound.")
            .AppendLine(
                $"Capability observation range: {dashboard.Freshness.OldestCapabilityObservedAt:O} to " +
                $"{dashboard.Freshness.NewestCapabilityObservedAt:O}")
            .AppendLine("Provider usage: unavailable; current Managed Run records have no provider usage contract.")
            .AppendLine("Provider cost: unavailable; current Managed Run records have no provider cost contract.")
            .AppendLine();
        var selection = dashboard.Selection;
        if (selection.Status is "selected" or "migration-required")
        {
            output.AppendLine($"Selection: {selection.Status}; {selection.AdapterId}/{selection.AgentId}; {selection.ModelId}")
                .AppendLine($"Selection digest: {selection.SelectionDigest}")
                .AppendLine($"Selection capability: {selection.CapabilityState}; {selection.CapabilityDigest}");
            foreach (var (key, value) in selection.Settings)
            {
                output.AppendLine($"  setting {key}={RenderSettingValue(value)}");
            }
        }
        else
        {
            output.AppendLine($"Selection: {selection.Status}");
        }
        output.AppendLine()
            .AppendLine($"Observed capabilities ({dashboard.CapabilityLimit.Shown}/{dashboard.CapabilityLimit.Total}):");
        foreach (var capability in dashboard.Capabilities)
        {
            output.AppendLine(
                $"  {capability.AdapterId}/{capability.AgentId}; {capability.AgentLabel}; " +
                $"{capability.ExecutionInterface}/{capability.InterfaceMaturity}; models={capability.ModelCount}; " +
                $"selected={capability.Selected.ToString().ToLowerInvariant()}; {capability.CapabilityDigest}");
        }
        output.AppendLine().AppendLine($"Runs ({dashboard.RunLimit.Shown}/{dashboard.RunLimit.Total}):");
        foreach (var run in dashboard.Runs)
        {
            var managed = run.Managed.Status == "observed"
                ? $"{run.Managed.State}/attempt-{run.Managed.AttemptNumber}/{run.Managed.ResultStatus}"
                : run.Managed.Status;
            output.AppendLine(
                $"  {run.RecordId:D}@{run.Revision}; {run.State}; " +
                $"{run.AdapterId}/{run.AgentId}/{run.ModelId}; managed={managed}");
        }
        output.AppendLine()
            .AppendLine($"Agent/model handoffs ({dashboard.HandoffLimit.Shown}/{dashboard.HandoffLimit.Total}):");
        foreach (var handoff in dashboard.Handoffs)
        {
            output.AppendLine(
                $"  {handoff.RecordId:D}; Run {handoff.FromRunId:D} -> " +
                $"{handoff.ToAdapterId}/{handoff.ToAgentId}/{handoff.ToModelId}; {handoff.State}");
        }
        output.AppendLine()
            .AppendLine($"Managed Run observations: {dashboard.ManagedRunLimit.Shown}/{dashboard.ManagedRunLimit.Total}")
            .AppendLine(
                $"Omissions: {(dashboard.Truncated ? "one or more bounded categories are truncated" : "none in reported categories")}")
            .AppendLine("Coverage: bounded current records do not prove provider-account or native-host readiness.");
        foreach (var limitation in dashboard.Limitations) output.AppendLine($"Limit: {limitation}");
        return output.AppendLine()
            .AppendLine(
                "Boundary: this read-only projection cannot select or switch an agent, create a handoff, launch a Run, " +
                "authorize a Tool/write/effect, approve an outcome, establish readiness, or grant release authority.")
            .Append(
                "Product text, Run narrative, source bytes, absolute paths, provider output, prompts, executable state, " +
                "credentials, and sensitive setting values are withheld.")
            .ToString();
    }

    private static string RenderAgentReadiness(AgentReadinessSnapshot snapshot)
    {
        var output = new StringBuilder()
            .AppendLine(snapshot.AgentLabel)
            .AppendLine($"  Adapter: {snapshot.AdapterId} {snapshot.AdapterVersion}")
            .AppendLine($"  Detected: {YesNo(snapshot.Detected)}")
            .AppendLine($"  Runtime version: {snapshot.RuntimeVersion ?? "not observed"}")
            .AppendLine($"  Interface: {snapshot.ExecutionInterface} ({snapshot.InterfaceMaturity})")
            .AppendLine($"  Capabilities: resume={YesNo(snapshot.SupportsResume)}, cancel={YesNo(snapshot.SupportsCancel)}, checkpoints={YesNo(snapshot.SupportsCheckpoints)}, model discovery={YesNo(snapshot.SupportsModelDiscovery)}, tool selection={YesNo(snapshot.SupportsToolSelection)}")
            .AppendLine($"  Declared settings: {snapshot.SettingsCount}")
            .AppendLine($"  Models observed: {snapshot.Models.Count}");
        var models = snapshot.Models.Take(20).ToArray();
        if (models.Length == 0) output.AppendLine("  - none observed");
        foreach (var model in models)
        {
            output.AppendLine($"  - {model.Label} ({model.Id}; {model.TruthClass}{(model.Alias ? "; alias" : "")})");
        }
        if (snapshot.Models.Count > models.Length)
        {
            output.AppendLine($"  - {snapshot.Models.Count - models.Length} more withheld from this compact view");
        }
        output.AppendLine($"  Limitations: {snapshot.Limitations.Count}");
        var limitations = snapshot.Limitations.Take(20).ToArray();
        if (limitations.Length == 0) output.AppendLine("  - none declared");
        foreach (var limitation in limitations) output.AppendLine($"  - {limitation}");
        if (snapshot.Limitations.Count > limitations.Length)
        {
            output.AppendLine($"  - {snapshot.Limitations.Count - limitations.Length} more withheld from this compact view");
        }
        return output.Append($"  Observed at: {snapshot.ObservedAt.ToString("O", CultureInfo.InvariantCulture)}").ToString();
    }

    private static string RenderAgentSelection(AgentSelection selection)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP guarded Agent Selection")
            .AppendLine()
            .AppendLine($"Agent: {selection.AgentId}")
            .AppendLine($"Adapter: {selection.AdapterId}")
            .AppendLine($"Model: {selection.ModelId}")
            .AppendLine($"Model evidence: {selection.ModelTruthClass}{(selection.ModelAlias == true ? " (alias)" : "")}")
            .AppendLine($"Selected at: {selection.SelectedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine($"Portable settings: {selection.Settings.Count}");
        foreach (var (key, value) in selection.Settings) output.AppendLine($"  - {key}: {RenderSettingValue(value)}");
        return output.AppendLine()
            .AppendLine("Boundary: this record does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority.")
            .Append("Machine-local executable paths, credentials, and raw provider output are not included.")
            .ToString();
    }

    private static string RenderAgentHandoff(AgentHandoff handoff)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP versioned Agent Handoff")
            .AppendLine()
            .AppendLine($"Handoff: {handoff.Id:D}")
            .AppendLine($"Source Run: {handoff.FromRunId:D}")
            .AppendLine($"Target: {handoff.ToAgent.AgentId} / {handoff.ToAgent.ModelId}")
            .AppendLine($"Created at: {handoff.CreatedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine($"Workspace observation: dirty={(handoff.WorkspaceBaseline.Dirty.HasValue ? handoff.WorkspaceBaseline.Dirty.Value.ToString().ToLowerInvariant() : "unknown")}; changed files={handoff.WorkspaceBaseline.ChangedFiles.Count}; truth={handoff.WorkspaceBaseline.TruthClass ?? "not recorded"}")
            .AppendLine($"Preserved entries: completed={handoff.CompletedWork.Count}; unresolved={handoff.UnresolvedMatters.Count}; decisions={handoff.Decisions.Count}; evidence={handoff.Evidence.Count}")
            .AppendLine("Capability differences:");
        foreach (var difference in handoff.CapabilityDifferences) output.AppendLine($"  - {difference}");
        return output.AppendLine()
            .AppendLine("Boundary: the handoff atomically replaced portable Agent Selection, but did not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.")
            .Append("Machine-local paths, credentials, provider sessions, and raw provider output are not included.")
            .ToString();
    }

    private static string RenderManagedReadOnlyReceipt(ManagedReadOnlyReceipt receipt)
    {
        var output = new StringBuilder()
            .AppendLine("GAEP managed read-only execution receipt")
            .AppendLine()
            .AppendLine($"Governed Run: {receipt.RunId:D}")
            .AppendLine($"Managed Run: {receipt.ManagedRunId:D}")
            .AppendLine($"Exact preview digest: {receipt.PreviewDigest}")
            .AppendLine($"Product: {receipt.ProductId:D}")
            .AppendLine($"Initiative: {receipt.InitiativeId:D}")
            .AppendLine($"Provider binding: {receipt.AgentId} / {receipt.ModelId} ({receipt.AdapterId})")
            .AppendLine($"Mode: {receipt.Mode}")
            .AppendLine($"Governed state: {receipt.State}")
            .AppendLine($"Provider disposition: {receipt.ProviderDisposition}")
            .AppendLine($"Governed outcome: {receipt.OutcomeStatus}")
            .AppendLine($"Outcome basis: {receipt.OutcomeBasis}")
            .AppendLine($"Completed steps: {receipt.CompletedStepCount} of {receipt.TotalStepCount}")
            .AppendLine($"Verified event count: {receipt.EventCount}")
            .AppendLine($"Result digest: {receipt.ResultDigest}")
            .AppendLine($"Evidence digest: {receipt.EvidenceDigest}")
            .AppendLine($"Warnings: {receipt.Warnings.Count}");
        if (receipt.Warnings.Count == 0) output.AppendLine("  - none");
        foreach (var warning in receipt.Warnings) output.AppendLine($"  - {warning}");
        return output.AppendLine($"Started: {receipt.StartedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine($"Ended: {receipt.EndedAt.ToString("O", CultureInfo.InvariantCulture)}")
            .AppendLine()
            .AppendLine("Provider completion and governed outcome are separate claims; one never substitutes for the other.")
            .AppendLine($"Authority boundary: {receipt.AuthorityBoundary}")
            .Append("No local paths, credentials, provider sessions, raw provider output, or source bytes are included.")
            .ToString();
    }

    private static string RenderManagedEvidenceDetail(ManagedEvidenceDetail detail)
    {
        var summary = detail.Summary;
        var output = new StringBuilder()
            .AppendLine("GAEP exact Managed Run evidence detail")
            .AppendLine()
            .AppendLine($"Managed Run: {summary.ManagedRunId:D}")
            .AppendLine($"Governed Run: {summary.RunId:D}")
            .AppendLine($"Product / Initiative: {summary.ProductId:D} / {summary.InitiativeId:D}")
            .AppendLine($"State / mode: {summary.State} / {summary.Mode}")
            .AppendLine($"Provider: {summary.AdapterId} / {summary.AgentId} / {summary.ModelId}")
            .AppendLine(
                $"Recovery: {summary.RecoveryStatus}; attempt {summary.AttemptNumber}; " +
                $"checkpoints {summary.WorkflowCheckpointCount}")
            .AppendLine($"Artifact status: {detail.ArtifactStatus}")
            .AppendLine($"Bindings digest: {summary.BindingsDigest}");
        if (detail.Result is { } result)
        {
            output.AppendLine()
                .AppendLine("Verified result:")
                .AppendLine($"  Result: {result.ResultId:D} ({result.ResultDigest})")
                .AppendLine($"  Terminal state: {result.TerminalState}")
                .AppendLine(
                    $"  Provider disposition: {result.ProviderDisposition}; termination cause: {result.TerminationCause}")
                .AppendLine($"  Governed outcome: {result.OutcomeStatus} ({result.OutcomeBasis})")
                .AppendLine($"  Warnings: {(result.WarningCodes.Count == 0 ? "none" : string.Join(", ", result.WarningCodes))}")
                .AppendLine(
                    $"  Started / ended: {result.StartedAt.ToString("O", CultureInfo.InvariantCulture)} / " +
                    result.EndedAt.ToString("O", CultureInfo.InvariantCulture));
        }
        else
        {
            output.AppendLine("No committed result/evidence pair is bound to this record. No terminal outcome is inferred.");
        }
        if (detail.Evidence is { } evidence)
        {
            output.AppendLine()
                .AppendLine("Verified evidence:")
                .AppendLine($"  Evidence: {evidence.EvidenceId:D} ({evidence.EvidenceDigest})")
                .AppendLine(
                    $"  Events: {evidence.EventCount}; lifecycle={evidence.EventTypeCounts["lifecycle"]}; " +
                    $"output={evidence.EventTypeCounts["output"]}; item={evidence.EventTypeCounts["item"]}; " +
                    $"approval={evidence.EventTypeCounts["approval"]}; warning={evidence.EventTypeCounts["warning"]}; " +
                    $"error={evidence.EventTypeCounts["error"]}")
                .AppendLine(
                    $"  Workflow: {evidence.WorkflowStrategy}; {evidence.CompletedStepCount}/{evidence.WorkflowStepCount} " +
                    $"steps; {evidence.WorkflowAttemptCount} attempts")
                .AppendLine(
                    $"  Charter gates: evidence={evidence.CharterEvidenceStatus}; stop={evidence.CharterStopStatus}; " +
                    $"reason={evidence.TerminalReasonCode}")
                .AppendLine(
                    $"  Actual effects: not-observed={evidence.ActualEffectCounts["not-observed"]}; " +
                    $"provisional={evidence.ActualEffectCounts["observed-provisional"]}; " +
                    $"applied={evidence.ActualEffectCounts["applied"]}; blocked={evidence.ActualEffectCounts["blocked"]}; " +
                    $"unknown={evidence.ActualEffectCounts["unknown"]}");
            if (evidence.Staging is { } staging)
            {
                output.AppendLine(
                        $"  Staging: {staging.ApplyState}; changes={staging.ChangeCount}; excluded={staging.ExcludedPathCount}")
                    .AppendLine(
                        $"  Stage digests: baseline={staging.BaselineDigest}; final={staging.FinalDigest}; " +
                        $"inventory={staging.ChangedInventoryDigest}");
            }
            else
            {
                output.AppendLine("  Staging: not present");
            }
            output.AppendLine($"  Captured: {evidence.CapturedAt.ToString("O", CultureInfo.InvariantCulture)}");
        }
        if (detail.ApplyDecision is { } decision)
        {
            output.AppendLine()
                .AppendLine("Verified apply-decision evidence (observation only):")
                .AppendLine($"  Receipt: {decision.ReceiptId:D} ({decision.ReceiptDigest})")
                .AppendLine(
                    $"  Bound revision: {decision.ManagedRunRevision}; " +
                    $"changed inventory count={decision.ChangedInventoryCount}; " +
                    $"write-envelope count={decision.WriteEnvelopeCount}")
                .AppendLine($"  Decided: {decision.DecidedAt.ToString("O", CultureInfo.InvariantCulture)}");
        }
        return output.AppendLine()
            .AppendLine(
                "Boundary: provider completion is separate from governed outcome. Apply-decision evidence records a past exact " +
                "decision and grants this view no apply, discard, approval, Tool, write, effect, implementation-readiness, " +
                "release, or future Run authority.")
            .Append(
                "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, " +
                "workspace paths, and credentials are withheld.")
            .ToString();
    }

    private static PortableAgentSettingValue ParseSelectSetting(AgentSelectionSetting setting, string raw)
    {
        var option = setting.Options?.FirstOrDefault(option => option.Value == raw)
            ?? throw new ArgumentException($"Select one verified value for {setting.Label}.");
        return new PortableAgentText(option.Value);
    }

    private static PortableAgentSettingValue ParseNumberSetting(AgentSelectionSetting setting, string raw)
    {
        if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) || !double.IsFinite(number))
        {
            throw new ArgumentException($"{setting.Label} must be a finite number.");
        }
        if (setting.Minimum.HasValue && number < setting.Minimum.Value)
        {
            throw new ArgumentException($"{setting.Label} must be at least {setting.Minimum.Value.ToString(CultureInfo.InvariantCulture)}.");
        }
        if (setting.Maximum.HasValue && number > setting.Maximum.Value)
        {
            throw new ArgumentException($"{setting.Label} must be at most {setting.Maximum.Value.ToString(CultureInfo.InvariantCulture)}.");
        }
        return new PortableAgentNumber(number);
    }

    private static PortableAgentSettingValue ParseStringListSetting(AgentSelectionSetting setting, string raw)
    {
        var items = raw.Split(',', StringSplitOptions.TrimEntries);
        if (items.Length == 0 || items.Any(string.IsNullOrEmpty))
        {
            throw new ArgumentException($"{setting.Label} must be a comma-separated list of non-empty values.");
        }
        return new PortableAgentTextList(Array.AsReadOnly(items
            .Select(item => PortableDesignProtocol.ValidatePortableSettingInput(item, setting.Label, minimum: 1))
            .ToArray()));
    }

    private static string RenderSettingValue(PortableAgentSettingValue value) => value switch
    {
        PortableAgentText text => text.Value,
        PortableAgentNumber number => number.Value.ToString(CultureInfo.InvariantCulture),
        PortableAgentBoolean boolean => boolean.Value.ToString().ToLowerInvariant(),
        PortableAgentTextList list => string.Join(", ", list.Value),
        _ => "unsupported",
    };

    private static bool IsTerminalRun(AgentRun run) => run.State is
        AgentRunState.Completed or AgentRunState.Failed or AgentRunState.Cancelled;

    private static bool SamePortableBinding(AgentSelection left, AgentSelection right) =>
        SamePortableBinding(left, right.AdapterId, right.ModelId, right.Settings);

    private static bool SamePortableBinding(
        AgentSelection left,
        string adapterId,
        string modelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings) =>
        left.AdapterId == adapterId && left.ModelId == modelId &&
        PortableDesignProtocol.PortableSettingsEqual(left.Settings, settings);

    private static bool SameExactSelection(AgentSelection left, AgentSelection right) =>
        left.SchemaVersion == right.SchemaVersion && left.AdapterId == right.AdapterId && left.AgentId == right.AgentId &&
        left.ModelId == right.ModelId && left.ModelTruthClass == right.ModelTruthClass && left.ModelAlias == right.ModelAlias &&
        left.SelectedAt == right.SelectedAt && left.CapabilityDigest == right.CapabilityDigest &&
        PortableDesignProtocol.PortableSettingsEqual(left.Settings, right.Settings);

    private static bool SameExactRun(AgentRun left, AgentRun right) =>
        left.SchemaVersion == right.SchemaVersion && left.Id == right.Id && left.Revision == right.Revision &&
        left.CharterId == right.CharterId && left.CharterDigest == right.CharterDigest &&
        left.ProductId == right.ProductId && left.InitiativeId == right.InitiativeId &&
        SameExactSelection(left.Agent, right.Agent) && left.State == right.State &&
        left.ProviderSessionRef == right.ProviderSessionRef && left.StartedAt == right.StartedAt &&
        left.EndedAt == right.EndedAt && left.PreviousRunId == right.PreviousRunId;

    private static bool SameInitiativeEntryBinding(InitiativeEntryContext left, InitiativeEntryContext right)
    {
        var leftAssessment = left.Assessment;
        var rightAssessment = right.Assessment;
        return left.Initiative == right.Initiative &&
            leftAssessment.InitiativeId == rightAssessment.InitiativeId &&
            leftAssessment.InitiativeRevision == rightAssessment.InitiativeRevision &&
            leftAssessment.ProductId == rightAssessment.ProductId &&
            leftAssessment.ProductRevision == rightAssessment.ProductRevision &&
            leftAssessment.ProductDigest == rightAssessment.ProductDigest &&
            leftAssessment.Classification == rightAssessment.Classification &&
            leftAssessment.Applicability == rightAssessment.Applicability &&
            leftAssessment.State == rightAssessment.State &&
            leftAssessment.Reasons.SequenceEqual(rightAssessment.Reasons, StringComparer.Ordinal);
    }

    private static string YesNo(bool value) => value ? "yes" : "no";

    private static string RenderSummary(PortableDesignSnapshotSummary summary) => new StringBuilder()
        .AppendLine($"Bundle ID: {summary.BundleId:D}")
        .AppendLine($"Product ID: {summary.ProductId:D}")
        .AppendLine($"Initiative ID: {(summary.InitiativeId.HasValue ? summary.InitiativeId.Value.ToString("D") : "not-bound")}")
        .AppendLine($"Classification: {PortableName(summary.Classification)}")
        .AppendLine($"Governance: {summary.Governance.State}; human review required={summary.Governance.HumanReviewRequired.ToString().ToLowerInvariant()}")
        .AppendLine($"Source review: {PortableName(summary.SourceReview.Status)} upstream claim; GAEP approval={summary.SourceReview.GaepApproval.ToString().ToLowerInvariant()}")
        .AppendLine($"Source: {summary.Source.Tool}; {PortableName(summary.Source.ExportMethod)}")
        .AppendLine($"Counts: artifacts={summary.Counts.Artifacts}, normalized tokens={summary.Counts.NormalizedDesignTokens}, validation checks={summary.Counts.ValidationChecks}, limitations={summary.Counts.RecordedLimitations}")
        .AppendLine($"Snapshot digest: {summary.Digests.Snapshot}")
        .AppendLine($"Evidence digest: {summary.Digests.Evidence}")
        .AppendLine($"Manifest digest: {summary.Digests.Manifest}")
        .AppendLine($"Inventory digest: {summary.Digests.ArtifactInventory}")
        .AppendLine($"Source exported: {summary.Timestamps.SourceExportedAt.ToString("O", CultureInfo.InvariantCulture)}")
        .AppendLine($"Imported: {summary.Timestamps.ImportedAt.ToString("O", CultureInfo.InvariantCulture)}")
        .Append($"Privacy: {summary.PrivacyBoundary}")
        .ToString();

    private static Guid ParseBundleId(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (!Guid.TryParseExact(value.Trim(), "D", out var bundleId) || bundleId == Guid.Empty)
        {
            throw new ArgumentException("Bundle ID must be a non-empty UUID.", nameof(value));
        }
        return bundleId;
    }

    private static Guid ParseRequiredId(string value, string label)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (!Guid.TryParseExact(value.Trim(), "D", out var id) || id == Guid.Empty)
        {
            throw new ArgumentException($"{label} must be a non-empty UUID.", nameof(value));
        }
        return id;
    }

    private static string PortableName<T>(T value) where T : struct, Enum
    {
        var name = value.ToString();
        var output = new StringBuilder(name.Length + 4);
        for (var index = 0; index < name.Length; index++)
        {
            if (index > 0 && char.IsUpper(name[index])) output.Append('-');
            output.Append(char.ToLowerInvariant(name[index]));
        }
        return output.ToString();
    }

    private static bool IsNetworkPath(string path)
    {
        if (path.StartsWith("//", StringComparison.Ordinal) || path.StartsWith("\\\\", StringComparison.Ordinal)) return true;
        return Uri.TryCreate(path, UriKind.Absolute, out var uri) && !uri.IsFile;
    }
}
