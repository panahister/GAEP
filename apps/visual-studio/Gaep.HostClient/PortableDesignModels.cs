namespace Gaep.HostClient;

public enum PortableDesignClassification
{
    Public,
    Internal,
    Confidential,
    Restricted,
}

public enum PortableDesignSourceReviewStatus
{
    Unreviewed,
    Reviewed,
    Approved,
}

public enum PortableDesignExportMethod
{
    ManualExport,
    DesignToolExport,
    PluginExport,
}

public sealed record ProductBinding(
    Guid Id,
    string Name,
    long Revision,
    string Digest);

public enum DeliveryPhaseId
{
    Phase0Foundation,
    Phase1Product,
    Phase1Acceptance,
    Phase2Design,
    Phase3Readiness,
    Phase3Implementation,
    Phase4ReleaseLearning,
}

public sealed record PhaseDashboardDecision(
    Guid RecordId,
    long Revision,
    string Digest);

public sealed record PhaseDashboardApplicability(
    string Status,
    string Basis,
    PhaseDashboardDecision? Decision);

public sealed record PhaseDashboardPanel(
    string Id,
    string Role,
    string Title,
    PhaseDashboardApplicability Applicability,
    string State);

public sealed record DashboardEvidenceCues(
    string Freshness,
    string ConfidenceState,
    string ConfidenceBasis);

public sealed record PhaseDashboardFramework(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    DeliveryPhaseId Phase,
    string PhaseLabel,
    IReadOnlyList<PhaseDashboardPanel> Panels,
    DashboardEvidenceCues EvidenceCues,
    DateTimeOffset ObservedAt,
    string SourceBoundary,
    IReadOnlyList<string> Limitations,
    string CompositionDigest);

public sealed record Phase1SummaryDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    string PhaseState,
    long DeclaredGapCount,
    int AttentionSignalCount,
    string ReadinessResult,
    long ReadinessSatisfiedOutputs,
    long ReadinessApplicableOutputs,
    long ReadinessTotalOutputs,
    long ReadinessGapCount,
    string HandoffState,
    string HandoffTransferState,
    long HandoffIncludedItems,
    long HandoffTotalItems,
    long HandoffGapCount,
    string FreshnessState,
    long StaleBindingCount,
    long StaleSourceReferenceCount,
    DateTimeOffset ObservedAt,
    string SourceBoundary,
    string PrivacyBoundary,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);

public sealed record Phase1ChangeImpactOutput(
    string OutputKind,
    string RecordKind,
    string ReadinessApplicability,
    string ReadinessEvaluationState,
    string ReadinessFreshness,
    long ReadinessSubjectCount,
    string ImpactState,
    long ExactMatchedSubjectCount,
    long TraceReferenceCount,
    string HandoffDisposition,
    string HandoffFreshness,
    string RevalidationState);

public sealed record Phase1ChangeImpactDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    ChangeImpactChangeReference Change,
    long ChangedArtifactCount,
    long EffectTargetCount,
    long AffectedUnitCount,
    IReadOnlyList<Phase1ChangeImpactOutput> Outputs,
    int CurrentTraceObservedOutputCount,
    int AttentionRequiredOutputCount,
    int ImpactNotEstablishedOutputCount,
    string FreshnessState,
    long TraceAttentionLinkCount,
    long StaleBindingCount,
    DateTimeOffset ObservedAt,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);

public sealed record ChangeImpactChangeReference(
    Guid RecordId,
    long Revision,
    string Digest,
    string State,
    IReadOnlyList<string> EffectEnvelope);

public sealed record ChangeImpactChangeCatalog(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    IReadOnlyList<ChangeImpactChangeReference> Items,
    long Total,
    long Omitted,
    DateTimeOffset ObservedAt,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);

public sealed record ChangeImpactExactReference(
    string RecordType,
    Guid RecordId,
    long Revision,
    string Digest);

public sealed record ChangeImpactLocator(string Kind, string Value);

public sealed record ChangeImpactWorkItem(ChangeImpactExactReference Record, string State);

public sealed record ChangeImpactArtifact(
    ChangeImpactExactReference SourceWorkItem,
    ChangeImpactLocator Locator);

public sealed record ChangeImpactTraceEndpoint(
    string RecordType,
    string RecordId,
    long? Revision,
    string? Digest);

public sealed record ChangeImpactTraceAssessment(
    Guid RecordId,
    long Revision,
    string AssessmentDigest,
    string AssessedState);

public sealed record ChangeImpactAffectedUnit(
    string Direction,
    string Relationship,
    ChangeImpactTraceEndpoint Endpoint,
    ChangeImpactTraceAssessment Trace);

public sealed record ChangeImpactDecision(
    ChangeImpactExactReference Record,
    string State,
    string Outcome);

public sealed record ChangeImpactRisk(
    ChangeImpactExactReference Record,
    string State,
    string Likelihood,
    string Impact,
    string Acceptance);

public sealed record ChangeImpactFreshness(
    string State,
    DateTimeOffset EvaluatedAt,
    long UnresolvedTraceLinks,
    long InvalidTraceLinks,
    long StaleTraceLinks,
    long StaleGovernanceReferences,
    bool TraceAnalysisTruncated);

public sealed record ChangeImpactLimit(long Shown, long Total, long Omitted);

public sealed record ChangeImpactLimits(
    ChangeImpactLimit WorkItems,
    ChangeImpactLimit ChangedArtifacts,
    ChangeImpactLimit EffectTargets,
    ChangeImpactLimit AffectedUnits,
    ChangeImpactLimit Decisions,
    ChangeImpactLimit Risks,
    bool Truncated);

public sealed record ChangeImpactDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    ChangeImpactChangeReference Change,
    IReadOnlyList<ChangeImpactWorkItem> WorkItems,
    IReadOnlyList<ChangeImpactArtifact> ChangedArtifacts,
    IReadOnlyList<ChangeImpactArtifact> EffectTargets,
    IReadOnlyList<ChangeImpactAffectedUnit> AffectedUnits,
    IReadOnlyList<ChangeImpactDecision> Decisions,
    IReadOnlyList<ChangeImpactRisk> Risks,
    ChangeImpactFreshness Freshness,
    DashboardEvidenceCues EvidenceCues,
    ChangeImpactLimits Limits,
    DateTimeOffset ObservedAt,
    string SourceBoundary,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);

public sealed record AgentModelReadiness(
    string Id,
    string Label,
    string TruthClass,
    bool Alias);

public abstract record PortableAgentSettingValue;

public sealed record PortableAgentText(string Value) : PortableAgentSettingValue;

public sealed record PortableAgentNumber(double Value) : PortableAgentSettingValue;

public sealed record PortableAgentBoolean(bool Value) : PortableAgentSettingValue;

public sealed record PortableAgentTextList(IReadOnlyList<string> Value) : PortableAgentSettingValue;

public sealed record AgentSettingOption(
    string Value,
    string Label,
    string? Description);

public sealed record AgentSelectionSetting(
    string Key,
    string Label,
    string Description,
    string Kind,
    bool Required,
    bool Sensitive,
    PortableAgentSettingValue? DefaultValue,
    IReadOnlyList<AgentSettingOption>? Options,
    double? Minimum,
    double? Maximum,
    string TruthClass);

public sealed record AgentSelection(
    int SchemaVersion,
    string AdapterId,
    string AgentId,
    string ModelId,
    string ModelTruthClass,
    bool? ModelAlias,
    IReadOnlyDictionary<string, PortableAgentSettingValue> Settings,
    DateTimeOffset SelectedAt,
    string CapabilityDigest,
    string SelectionDigest);

public enum AgentSelectionStatus
{
    Unselected,
    Selected,
    MigrationRequired,
    Invalid,
}

public sealed record AgentSelectionState(
    AgentSelectionStatus Status,
    AgentSelection? Selection,
    AgentSelection? PortableCandidate);

public enum AgentRunState
{
    Prepared,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
    Unknown,
}

public sealed record AgentRun(
    int SchemaVersion,
    Guid Id,
    long? Revision,
    Guid CharterId,
    string? CharterDigest,
    Guid ProductId,
    Guid InitiativeId,
    AgentSelection Agent,
    AgentRunState State,
    string? ProviderSessionRef,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EndedAt,
    Guid? PreviousRunId);

public sealed record HandoffWorkspaceBaseline(
    string? GitHead,
    bool? Dirty,
    IReadOnlyList<string> ChangedFiles,
    string? TruthClass,
    string? ObservationError);

public sealed record AgentHandoff(
    int SchemaVersion,
    Guid Id,
    Guid ProductId,
    Guid InitiativeId,
    Guid FromRunId,
    AgentSelection ToAgent,
    string Reason,
    HandoffWorkspaceBaseline WorkspaceBaseline,
    IReadOnlyList<string> CompletedWork,
    IReadOnlyList<string> UnresolvedMatters,
    IReadOnlyList<string> Decisions,
    IReadOnlyList<string> Evidence,
    IReadOnlyList<string> CapabilityDifferences,
    DateTimeOffset CreatedAt,
    DateTimeOffset? AcknowledgedAt);

public sealed record ManagedReadOnlyGatePreview(
    string Key,
    Guid? StepId,
    string Phase,
    IReadOnlyList<string> Criteria,
    string CriteriaDigest);

public sealed record ManagedReadOnlyPreview(
    int SchemaVersion,
    string Kind,
    Guid ProductId,
    Guid InitiativeId,
    Guid CharterId,
    string CharterDigest,
    Guid WorkflowPlanId,
    string WorkflowPlanDigest,
    string AdapterId,
    string AgentId,
    string ModelId,
    string SelectionDigest,
    string Strategy,
    IReadOnlyList<Guid> StepIds,
    int ContextPackCount,
    int ReadScopeCount,
    IReadOnlyList<ManagedReadOnlyGatePreview> Gates,
    string AuthorityBoundary,
    string PreviewDigest);

public sealed record ManagedReadOnlyReceipt(
    int SchemaVersion,
    string Kind,
    string PreviewDigest,
    Guid RunId,
    Guid ManagedRunId,
    Guid ProductId,
    Guid InitiativeId,
    string AdapterId,
    string AgentId,
    string ModelId,
    string Mode,
    string State,
    string ProviderDisposition,
    string OutcomeStatus,
    string OutcomeBasis,
    int EventCount,
    int CompletedStepCount,
    int TotalStepCount,
    string ResultDigest,
    string EvidenceDigest,
    IReadOnlyList<string> Warnings,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    string AuthorityBoundary);

public sealed record ManagedRunSummary(
    int SchemaVersion,
    string Kind,
    Guid ManagedRunId,
    Guid RunId,
    Guid ProductId,
    Guid InitiativeId,
    string Mode,
    string State,
    string AdapterId,
    string AgentId,
    string ModelId,
    int AttemptNumber,
    string RecoveryStatus,
    int WorkflowCheckpointCount,
    bool HasResult,
    bool HasApplyDecision,
    string BindingsDigest,
    string? ResultDigest,
    string? ApplyDecisionDigest,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? EndedAt,
    string AuthorityBoundary);

public sealed record ManagedRunSummaryPage(
    int SchemaVersion,
    string Kind,
    IReadOnlyList<ManagedRunSummary> Items,
    int Offset,
    int Limit,
    int Total,
    int OmittedCount,
    string SnapshotDigest,
    bool HasMore,
    string AuthorityBoundary,
    string PrivacyBoundary);

public sealed record ManagedEvidenceResult(
    Guid ResultId,
    string ResultDigest,
    string ProviderDisposition,
    string TerminationCause,
    string OutcomeStatus,
    string OutcomeBasis,
    string TerminalState,
    Guid EvidenceId,
    string EvidenceDigest,
    IReadOnlyList<string> WarningCodes,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt);

public sealed record ManagedStagingProjection(
    int ChangeCount,
    int ExcludedPathCount,
    string ApplyState,
    string BaselineDigest,
    string FinalDigest,
    string ChangedInventoryDigest,
    string ExcludedPathSetDigest);

public sealed record ManagedEvidenceProjection(
    Guid EvidenceId,
    string EvidenceDigest,
    int EventCount,
    IReadOnlyDictionary<string, int> EventTypeCounts,
    string EventsDigest,
    string WorkflowStrategy,
    int WorkflowStepCount,
    int WorkflowAttemptCount,
    int CompletedStepCount,
    string CharterEvidenceStatus,
    string CharterStopStatus,
    string TerminalReasonCode,
    ManagedStagingProjection? Staging,
    IReadOnlyDictionary<string, int> ActualEffectCounts,
    DateTimeOffset CapturedAt);

public sealed record ManagedApplyDecisionProjection(
    Guid ReceiptId,
    string ReceiptDigest,
    int ManagedRunRevision,
    int ChangedInventoryCount,
    int WriteEnvelopeCount,
    string ChangedInventoryDigest,
    string WriteEnvelopeDigest,
    DateTimeOffset DecidedAt);

public sealed record ManagedEvidenceDetail(
    int SchemaVersion,
    string Kind,
    ManagedRunSummary Summary,
    string ArtifactStatus,
    ManagedEvidenceResult? Result,
    ManagedEvidenceProjection? Evidence,
    ManagedApplyDecisionProjection? ApplyDecision,
    string AuthorityBoundary,
    string PrivacyBoundary);

public sealed record ManagedChangedFile(
    string Path,
    string Kind,
    string? BeforeDigest,
    string? AfterDigest,
    long? BeforeSize,
    long? AfterSize,
    int? BeforeMode,
    int? AfterMode);

public sealed record ManagedReviewResult(
    Guid ResultId,
    string ResultDigest,
    string TerminalState,
    string ProviderDisposition,
    string OutcomeStatus,
    string OutcomeBasis,
    IReadOnlyList<string> WarningCodes,
    Guid EvidenceId,
    string EvidenceDigest);

public sealed record ManagedReviewStaging(
    Guid EvidenceId,
    string EvidenceDigest,
    string BaselineDigest,
    string FinalDigest,
    string ApplyState,
    int ChangeCount,
    int ChangedInventoryLimit,
    int OmittedCount,
    IReadOnlyList<ManagedChangedFile> ChangedInventory,
    string ChangedInventoryDigest,
    int ExcludedPathCount,
    string ExcludedPathSetDigest);

public sealed record ManagedReviewApplyConfirmation(
    string Decision,
    Guid ReviewEvidenceId,
    string ReviewEvidenceDigest,
    string ChangedInventoryDigest,
    IReadOnlyList<string> WriteEnvelope,
    string WriteEnvelopeDigest);

public sealed record ManagedReviewPreview(
    int SchemaVersion,
    string Kind,
    Guid ManagedRunId,
    long ManagedRunRevision,
    Guid RunId,
    Guid ProductId,
    Guid InitiativeId,
    string Mode,
    string State,
    bool CanApply,
    bool CanDiscard,
    bool HasLocalJournal,
    string BindingsDigest,
    ManagedReviewResult Result,
    ManagedReviewStaging Staging,
    ManagedReviewApplyConfirmation? ApplyConfirmation,
    string PostApplyGatePolicy,
    string AuthorityBoundary,
    string PrivacyBoundary,
    string CleanupBoundary,
    string PreviewDigest);

public sealed record ManagedReviewTransition(
    int SchemaVersion,
    string Kind,
    string Decision,
    string SourcePreviewDigest,
    long SourceManagedRunRevision,
    Guid ManagedRunId,
    long ManagedRunRevision,
    string State,
    bool CanApply,
    bool CanDiscard,
    bool HasLocalJournal,
    ManagedEvidenceDetail Detail,
    string AuthorityBoundary,
    string CleanupBoundary,
    string TransitionDigest);

public sealed record AgentReadinessSnapshot(
    int SchemaVersion,
    string AdapterId,
    string AdapterVersion,
    string AgentId,
    string AgentLabel,
    string? RuntimeVersion,
    bool Detected,
    string ExecutionInterface,
    string InterfaceMaturity,
    bool SupportsResume,
    bool SupportsCancel,
    bool SupportsCheckpoints,
    bool SupportsModelDiscovery,
    bool SupportsToolSelection,
    int SettingsCount,
    IReadOnlyList<AgentSelectionSetting> Settings,
    IReadOnlyList<AgentModelReadiness> Models,
    IReadOnlyList<string> Limitations,
    DateTimeOffset ObservedAt,
    string CapabilityDigest);

public sealed record AgentModelLimit(long Shown, long Total, long Omitted);

public sealed record AgentModelCapability(
    string AdapterId,
    string AdapterVersion,
    string AgentId,
    string AgentLabel,
    string? RuntimeVersion,
    string CapabilityDigest,
    bool Detected,
    string ExecutionInterface,
    string InterfaceMaturity,
    long ModelCount,
    long LimitationShown,
    long LimitationTotal,
    DateTimeOffset ObservedAt,
    bool Selected);

public sealed record AgentModelSelectionProjection(
    string Status,
    string? SelectionDigest,
    string? AdapterId,
    string? AgentId,
    string? ModelId,
    string? ModelTruthClass,
    bool? ModelAlias,
    IReadOnlyDictionary<string, PortableAgentSettingValue> Settings,
    DateTimeOffset? SelectedAt,
    string? CapabilityDigest,
    string? CapabilityState);

public sealed record AgentModelManagedProjection(
    string Status,
    Guid? RecordId,
    string? State,
    long? AttemptNumber,
    string? ResultStatus,
    string? ProviderDisposition,
    string? OutcomeStatus,
    Guid? EvidenceId,
    long? EventCount,
    long? ActualEffectCount);

public sealed record AgentModelRunProjection(
    Guid RecordId,
    long Revision,
    Guid InitiativeId,
    string State,
    string AdapterId,
    string AgentId,
    string ModelId,
    AgentModelManagedProjection Managed);

public sealed record AgentModelHandoffProjection(
    Guid RecordId,
    Guid FromRunId,
    string ToAdapterId,
    string ToAgentId,
    string ToModelId,
    string State,
    DateTimeOffset CreatedAt);

public sealed record AgentModelFreshness(
    string State,
    string SelectionCapabilityState,
    DateTimeOffset OldestCapabilityObservedAt,
    DateTimeOffset NewestCapabilityObservedAt,
    bool Truncated);

public sealed record AgentModelDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    IReadOnlyList<AgentModelCapability> Capabilities,
    AgentModelSelectionProjection Selection,
    IReadOnlyList<AgentModelRunProjection> Runs,
    IReadOnlyList<AgentModelHandoffProjection> Handoffs,
    AgentModelFreshness Freshness,
    DashboardEvidenceCues EvidenceCues,
    AgentModelLimit CapabilityLimit,
    AgentModelLimit RunLimit,
    AgentModelLimit HandoffLimit,
    AgentModelLimit ManagedRunLimit,
    bool Truncated,
    DateTimeOffset ObservedAt,
    string SourceBoundary,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);

public sealed record Phase1AgentModelCapabilityTruth(
    long Shown,
    long Total,
    long Omitted,
    long Detected,
    long Unavailable,
    long Selected);

public sealed record Phase1AgentModelOutcomeTruth(
    long Satisfied,
    long Failed,
    long NotAssessed,
    long Indeterminate);

public sealed record Phase1AgentModelRunTruth(
    long Shown,
    long Total,
    long Omitted,
    long Terminal,
    long NonTerminal,
    long ManagedObserved,
    long ResultBound,
    long ActualEffectCount,
    Phase1AgentModelOutcomeTruth Outcomes);

public sealed record Phase1AgentModelHandoffTruth(
    long Shown,
    long Total,
    long Omitted,
    long PendingAcknowledgement,
    long Acknowledged);

public sealed record Phase1AgentModelDashboard(
    Guid ProductId,
    long ProductRevision,
    string ProductDigest,
    Guid InitiativeId,
    long InitiativeRevision,
    string InitiativeDigest,
    string InitiativeState,
    AgentModelDashboard AgentModel,
    Phase1AgentModelCapabilityTruth Capabilities,
    Phase1AgentModelRunTruth Runs,
    AgentModelLimit ManagedRuns,
    Phase1AgentModelHandoffTruth Handoffs,
    string FreshnessState,
    string SelectionCapabilityState,
    string LiveProviderQuality,
    string SemanticOutputQuality,
    string ProductOwnerAcceptance,
    DateTimeOffset ObservedAt,
    string SourceBoundary,
    string PrivacyBoundary,
    IReadOnlyList<string> Limitations,
    string SnapshotDigest);

public sealed record PortableDesignGovernanceMetadata(
    string State,
    bool HumanReviewRequired,
    string ClaimBoundary,
    string NonEscalation);

public sealed record PortableDesignSourceReviewMetadata(
    PortableDesignSourceReviewStatus Status,
    string ClaimLabel,
    bool GaepApproval);

public sealed record PortableDesignSourceMetadata(
    string Tool,
    PortableDesignExportMethod ExportMethod);

public sealed record PortableDesignCounts(
    int Artifacts,
    int NormalizedDesignTokens,
    int ValidationChecks,
    int RecordedLimitations);

public sealed record PortableDesignDigests(
    string Snapshot,
    string Evidence,
    string Manifest,
    string ArtifactInventory);

public sealed record PortableDesignTimestamps(
    DateTimeOffset SourceExportedAt,
    DateTimeOffset ImportedAt);

public sealed record PortableDesignSnapshotSummary(
    int SchemaVersion,
    string Kind,
    Guid BundleId,
    Guid ProductId,
    Guid? InitiativeId,
    string Title,
    PortableDesignClassification Classification,
    PortableDesignGovernanceMetadata Governance,
    PortableDesignSourceReviewMetadata SourceReview,
    PortableDesignSourceMetadata Source,
    PortableDesignCounts Counts,
    PortableDesignDigests Digests,
    PortableDesignTimestamps Timestamps,
    string PrivacyBoundary);

public sealed record PortableDesignSnapshotPage(
    IReadOnlyList<PortableDesignSnapshotSummary> Items,
    int Offset,
    int Limit,
    int Total,
    bool HasMore,
    string GovernanceBoundary,
    string PrivacyBoundary);

public sealed class EngineHostException : Exception
{
    internal EngineHostException(int code, string kind, string message)
        : base(message)
    {
        Code = code;
        Kind = kind;
    }

    public int Code { get; }

    public string Kind { get; }
}
