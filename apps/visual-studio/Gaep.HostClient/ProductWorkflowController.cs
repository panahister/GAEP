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
