using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Gaep.HostClient;

public sealed class EngineClient : IAsyncDisposable
{
    private const int MaxResponseFrameBytes = 1024 * 1024;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private readonly string workspacePath;
    private readonly string requestedEngineExecutable;
    private readonly string? configuredEngineDigest;
    private readonly PackagedEngineModule? packagedEngineModule;
    private readonly string? configuredPackagedEngineDigest;
    private readonly IReadOnlyDictionary<string, string> childEnvironment;
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private readonly byte[] responseReadBuffer = new byte[8192];
    private readonly List<byte> pendingResponseBytes = [];
    private Process? process;
    private string? boundEnginePath;
    private string? boundEngineDigest;
    private string? boundPackagedEnginePath;
    private string? boundPackagedEngineDigest;
    private long nextId;
    private bool disposed;

    public EngineClient(
        string workspacePath,
        string? engineExecutable = null,
        string? expectedEngineSha256 = null,
        PackagedEngineModule? packagedEngineModule = null,
        IReadOnlyDictionary<string, string>? sourceEnvironment = null)
    {
        this.workspacePath = Path.GetFullPath(workspacePath);
        requestedEngineExecutable = engineExecutable
            ?? Environment.GetEnvironmentVariable("GAEP_ENGINE_EXECUTABLE")
            ?? "gaep-engine";
        configuredEngineDigest = NormalizeDigest(
            expectedEngineSha256 ?? Environment.GetEnvironmentVariable("GAEP_ENGINE_SHA256"));
        this.packagedEngineModule = packagedEngineModule;
        configuredPackagedEngineDigest = NormalizeDigest(packagedEngineModule?.ExpectedSha256);
        if (packagedEngineModule is not null && configuredPackagedEngineDigest is null)
        {
            throw new ArgumentException(
                "Expected packaged engine SHA-256 must contain exactly 64 hexadecimal characters.",
                nameof(packagedEngineModule));
        }
        childEnvironment = VisualStudioEngineClientFactory.SafeEngineEnvironment(
            sourceEnvironment ?? CaptureEnvironment());
    }

    public async Task<ProductBinding> ReadProductBindingAsync(CancellationToken cancellationToken = default)
    {
        using var response = await RequestWorkflowAsync(
            "readProduct",
            new Dictionary<string, object?>(),
            protocolVersion: null,
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            PortableDesignProtocol.ParseProductBindingResponse);
    }

    public async Task<InitiativeEntryRecord> ReadInitiativeAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "readInitiative",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseInitiativeResponse(envelope, initiativeId));
    }

    public async Task<InitiativeEntryAssessment> AssessInitiativeEntryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "assessInitiativeEntry",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseInitiativeEntryAssessmentResponse(envelope, initiativeId));
    }

    public async Task<SourceGovernanceProjection> ReadSourceGovernanceAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "source.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseSourceGovernanceResponse(envelope, initiativeId));
    }

    public async Task<BusinessUnderstandingProjection> ReadBusinessUnderstandingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "business.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBusinessUnderstandingResponse(envelope, initiativeId));
    }

    public async Task<BusinessCapabilityMapProjection> ReadBusinessCapabilityMapAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "business.capabilities.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBusinessCapabilityMapResponse(envelope, initiativeId));
    }

    public async Task<ValueStreamModelProjection> ReadValueStreamModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "business.valueStreams.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseValueStreamModelResponse(envelope, initiativeId));
    }

    public async Task<OperatingModelProjection> ReadOperatingModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "business.operatingModels.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseOperatingModelResponse(envelope, initiativeId));
    }

    public async Task<BusinessRuleCatalogProjection> ReadBusinessRuleCatalogAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "business.businessRules.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBusinessRuleCatalogResponse(envelope, initiativeId));
    }

    public async Task<BusinessArchitectureBaselineProjection> ReadBusinessArchitectureBaselineAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "business.architectureBaselines.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBusinessArchitectureBaselineResponse(envelope, initiativeId));
    }

    public async Task<SystemSolutionArchitectureProjection> ReadSystemSolutionArchitectureAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "architecture.systemSolution.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseSystemSolutionArchitectureResponse(envelope, initiativeId));
    }

    public async Task<BoundedContextModelProjection> ReadBoundedContextModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "architecture.boundedContexts.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBoundedContextModelResponse(envelope, initiativeId));
    }

    public async Task<SecurityPrivacyAssessmentProjection> ReadSecurityPrivacyAssessmentAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "security.privacyThreat.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseSecurityPrivacyAssessmentResponse(envelope, initiativeId));
    }

    public async Task<ProcessModelProjection> ReadProcessModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "process.models.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseProcessModelResponse(envelope, initiativeId));
    }

    public async Task<DataModelProjection> ReadDataModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "data.models.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDataModelResponse(envelope, initiativeId));
    }

    public async Task<AuthorizationModelProjection> ReadAuthorizationModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "authorization.models.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseAuthorizationModelResponse(envelope, initiativeId));
    }

    public async Task<EventIntegrationModelProjection> ReadEventIntegrationModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "integration.models.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseEventIntegrationModelResponse(envelope, initiativeId));
    }

    public async Task<FailureRecoveryModelProjection> ReadFailureRecoveryModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "recovery.models.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseFailureRecoveryModelResponse(envelope, initiativeId));
    }

    public async Task<ArchitectureChallengeModelProjection> ReadArchitectureChallengeModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "challenge.models.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseArchitectureChallengeModelResponse(envelope, initiativeId));
    }

    public async Task<DecisionRegisterProjection> ReadDecisionRegisterAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "decision.registers.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDecisionRegisterResponse(envelope, initiativeId));
    }

    public async Task<RiskRegisterProjection> ReadRiskRegisterAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "risk.registers.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseRiskRegisterResponse(envelope, initiativeId));
    }

    public async Task<EvidenceRegistryProjection> ReadEvidenceRegistryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "evidence.registries.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseEvidenceRegistryResponse(envelope, initiativeId));
    }

    public async Task<EndToEndTraceabilityProjection> ReadEndToEndTraceabilityAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "traceability.graphs.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseEndToEndTraceabilityResponse(envelope, initiativeId));
    }

    public async Task<P0P4ReadinessGateProjection> ReadP0P4ReadinessGateAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "readiness.gates.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseP0P4ReadinessGateResponse(envelope, initiativeId));
    }

    public async Task<P5HandoffPackageProjection> ReadP5HandoffPackageAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "handoff.p5.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseP5HandoffPackageResponse(envelope, initiativeId));
    }

    public async Task<DesignApplicabilityProjection> ReadDesignApplicabilityAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.applicability.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignApplicabilityResponse(envelope, initiativeId));
    }

    public async Task<DesignPersonaRoleProjection> ReadDesignPersonaRoleModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.personas.roles.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignPersonaRoleResponse(envelope, initiativeId));
    }

    public async Task<UserJourneyProjection> ReadUserJourneyModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.journeys.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseUserJourneyResponse(envelope, initiativeId));
    }

    public async Task<InformationArchitectureProjection> ReadInformationArchitectureModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.informationArchitecture.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseInformationArchitectureResponse(envelope, initiativeId));
    }

    public async Task<ScreenStateInventoryProjection> ReadScreenStateInventoryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.screenStateInventory.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseScreenStateInventoryResponse(envelope, initiativeId));
    }

    public async Task<DesignRequirementsProjection> ReadDesignRequirementsAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.requirements.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignRequirementsResponse(envelope, initiativeId));
    }

    public async Task<DesignSystemTokenContractProjection> ReadDesignSystemTokenContractAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.systemTokenContract.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignSystemTokenContractResponse(envelope, initiativeId));
    }

    public async Task<BacklogHierarchyProjection> ReadBacklogHierarchyAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "backlog.hierarchy.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBacklogHierarchyResponse(envelope, initiativeId));
    }

    public async Task<MvpSliceDefinitionProjection> ReadMvpSliceDefinitionAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.mvpSlices.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseMvpSliceDefinitionResponse(envelope, initiativeId));
    }

    public async Task<PrioritizationModelProjection> ReadPrioritizationModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.prioritization.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePrioritizationModelResponse(envelope, initiativeId));
    }

    public async Task<AcceptanceCriteriaProjection> ReadAcceptanceCriteriaAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.acceptanceCriteria.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseAcceptanceCriteriaResponse(envelope, initiativeId));
    }

    public async Task<DefinitionOfReadyProjection> ReadDefinitionOfReadyAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.definitionOfReady.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDefinitionOfReadyResponse(envelope, initiativeId));
    }

    public async Task<DefinitionOfDoneProjection> ReadDefinitionOfDoneAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.definitionOfDone.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDefinitionOfDoneResponse(envelope, initiativeId));
    }

    public async Task<ImplementationUnitModelProjection> ReadImplementationUnitModelAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.implementationUnits.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseImplementationUnitModelResponse(envelope, initiativeId));
    }

    public async Task<DependencyMappingProjection> ReadDependencyMappingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.dependencyMapping.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDependencyMappingResponse(envelope, initiativeId));
    }

    public async Task<TechnologyProfileProjection> ReadTechnologyProfileAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.technologyProfile.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseTechnologyProfileResponse(envelope, initiativeId));
    }

    public async Task<BoilerplateRegistryProjection> ReadBoilerplateRegistryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.boilerplateRegistry.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBoilerplateRegistryResponse(envelope, initiativeId));
    }

    public async Task<BoilerplateSelectionBindingProjection> ReadBoilerplateSelectionBindingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.boilerplateSelectionBinding.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBoilerplateSelectionBindingResponse(envelope, initiativeId));
    }

    public async Task<BoilerplateCompatibilityValidationProjection> ReadBoilerplateCompatibilityValidationAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.boilerplateCompatibilityValidation.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseBoilerplateCompatibilityValidationResponse(envelope, initiativeId));
    }

    public async Task<FigmaToBoilerplateMappingProjection> ReadFigmaToBoilerplateMappingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.figmaToBoilerplateMapping.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseFigmaToBoilerplateMappingResponse(envelope, initiativeId));
    }

    public async Task<DesignToCodeBindingRegistryProjection> ReadDesignToCodeBindingRegistryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.designToCodeBindingRegistry.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignToCodeBindingRegistryResponse(envelope, initiativeId));
    }

    public async Task<RouteScreenComponentMappingProjection> ReadRouteScreenComponentMappingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.routeScreenComponentMapping.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseRouteScreenComponentMappingResponse(envelope, initiativeId));
    }

    public async Task<TestMethodologyProjection> ReadTestMethodologyAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.testMethodology.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseTestMethodologyResponse(envelope, initiativeId));
    }

    public async Task<TestInventoryProjection> ReadTestInventoryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.testInventory.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseTestInventoryResponse(envelope, initiativeId));
    }

    public async Task<HighLevelDesignProjection> ReadHighLevelDesignAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "planning.highLevelDesign.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseHighLevelDesignResponse(envelope, initiativeId));
    }

    public async Task<AccessibilityDesignRulesProjection> ReadAccessibilityDesignRulesAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.accessibilityRules.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseAccessibilityDesignRulesResponse(envelope, initiativeId));
    }

    public async Task<ResponsiveMultiPlatformTargetsProjection> ReadResponsiveMultiPlatformTargetsAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.responsiveMultiPlatformTargets.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseResponsiveMultiPlatformTargetsResponse(envelope, initiativeId));
    }

    public async Task<ManualFigmaExecutionPathProjection> ReadManualFigmaExecutionPathAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.manualFigmaExecutionPath.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManualFigmaExecutionPathResponse(envelope, initiativeId));
    }

    public async Task<FigmaMcpCapabilityDiscoveryProjection> ReadFigmaMcpCapabilityDiscoveryAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.figmaMcpCapabilityDiscovery.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseFigmaMcpCapabilityDiscoveryResponse(envelope, initiativeId));
    }

    public async Task<FigmaReadSnapshotProjection> ReadFigmaReadSnapshotAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.figmaReadSnapshot.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseFigmaReadSnapshotResponse(envelope, initiativeId));
    }

    public async Task<FigmaContextImportProjection> ReadFigmaContextImportAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.figmaContextImport.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseFigmaContextImportResponse(envelope, initiativeId));
    }

    public async Task<OutboundDesignBriefPackageProjection> ReadOutboundDesignBriefPackageAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.outboundDesignBriefPackage.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseOutboundDesignBriefPackageResponse(envelope, initiativeId));
    }

    public async Task<GovernedFigmaWriteProjection> ReadGovernedFigmaWriteAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.governedFigmaWrite.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseGovernedFigmaWriteResponse(envelope, initiativeId));
    }

    public async Task<FinalizedFigmaSnapshotImportProjection> ReadFinalizedFigmaSnapshotImportAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.finalizedFigmaSnapshotImport.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseFinalizedFigmaSnapshotImportResponse(envelope, initiativeId));
    }

    public async Task<DesignToRequirementBindingProjection> ReadDesignToRequirementBindingAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.designToRequirementBinding.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignToRequirementBindingResponse(envelope, initiativeId));
    }

    public async Task<DesignerReadyGateProjection> ReadDesignerReadyGateAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.designerReadyGate.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignerReadyGateResponse(envelope, initiativeId));
    }

    public async Task<DesignDeltaProjection> ReadDesignDeltaAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.designDelta.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignDeltaResponse(envelope, initiativeId));
    }

    public async Task<DesignConflictResolutionProjection> ReadDesignConflictResolutionAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.designConflictResolution.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignConflictResolutionResponse(envelope, initiativeId));
    }

    public async Task<HumanDesignApprovalProjection> ReadHumanDesignApprovalAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.humanDesignApproval.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseHumanDesignApprovalResponse(envelope, initiativeId));
    }

    public async Task<DesignBaselineProjection> ReadDesignBaselineAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.designBaseline.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignBaselineResponse(envelope, initiativeId));
    }

    public async Task<DesignDriftDetectionProjection> ReadDesignDriftDetectionAsync(
        Guid initiativeId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        using var response = await RequestPortableDesignAsync(
            "design.designDriftDetection.snapshot",
            new Dictionary<string, object?> { ["initiativeId"] = initiativeId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseDesignDriftDetectionResponse(envelope, initiativeId));
    }

    public async Task<InitiativeEntryRecord> ClassifyInitiativeAsync(
        Guid initiativeId,
        long expectedInitiativeRevision,
        InitiativeClassificationInput classification,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        PortableDesignProtocol.ValidateProductRevision(expectedInitiativeRevision);
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        var serializedClassification = PortableDesignProtocol.SerializeInitiativeClassificationInput(classification);
        using var response = await RequestPortableDesignAsync(
            "classifyInitiative",
            new Dictionary<string, object?>
            {
                ["initiativeId"] = initiativeId,
                ["expectedInitiativeRevision"] = expectedInitiativeRevision,
                ["actorId"] = normalizedActorId,
                ["classification"] = serializedClassification,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseInitiativeResponse(
                envelope,
                initiativeId,
                expectedInitiativeRevision,
                normalizedActorId,
                expectedClassificationInput: serializedClassification));
    }

    public async Task<InitiativeEntryRecord> ResolveInitiativeApplicabilityAsync(
        Guid initiativeId,
        long expectedInitiativeRevision,
        InitiativeApplicabilityMatrixInput applicability,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must not be empty.", nameof(initiativeId));
        PortableDesignProtocol.ValidateProductRevision(expectedInitiativeRevision);
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        var completedApplicability = PortableDesignProtocol.CompleteInitiativeApplicabilityCoverage(
            applicability,
            normalizedActorId);
        var serializedApplicability = PortableDesignProtocol.SerializeInitiativeApplicabilityInput(completedApplicability);
        using var response = await RequestPortableDesignAsync(
            "resolveInitiativeApplicability",
            new Dictionary<string, object?>
            {
                ["initiativeId"] = initiativeId,
                ["expectedInitiativeRevision"] = expectedInitiativeRevision,
                ["actorId"] = normalizedActorId,
                ["applicability"] = serializedApplicability,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseInitiativeResponse(
                envelope,
                initiativeId,
                expectedInitiativeRevision,
                normalizedActorId,
                expectedApplicabilityInput: serializedApplicability));
    }

    public async Task<PhaseDashboardFramework> ReadPhaseDashboardAsync(
        ProductBinding product,
        DeliveryPhaseId phase = DeliveryPhaseId.Phase0Foundation,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        if (product.Id == Guid.Empty) throw new ArgumentException("Product identity must not be empty.", nameof(product));
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        using var response = await RequestPortableDesignAsync(
            "dashboard.framework",
            new Dictionary<string, object?>
            {
                ["phase"] = PortableDesignProtocol.SerializeDeliveryPhase(phase),
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePhaseDashboardResponse(envelope, phase, product));
    }

    public async Task<Phase2UxFigmaDashboard> ReadPhase2UxFigmaDashboardAsync(
        ProductBinding product,
        InitiativeEntryRecord initiative,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(initiative);
        if (product.Id == Guid.Empty || initiative.Id == Guid.Empty || initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative must target the exact current Product.", nameof(initiative));
        }
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductRevision(initiative.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        PortableDesignProtocol.ValidateProductDigest(initiative.Digest);
        using var response = await RequestPortableDesignAsync(
            "dashboard.phase2UxFigma",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
                ["expectedInitiativeId"] = initiative.Id,
                ["expectedInitiativeRevision"] = initiative.Revision,
                ["expectedInitiativeDigest"] = initiative.Digest,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePhase2UxFigmaDashboardResponse(envelope, product, initiative));
    }

    public async Task<Phase2ChangeImpactAgentModelDashboard> ReadPhase2ChangeImpactAgentModelDashboardAsync(
        ProductBinding product,
        InitiativeEntryRecord initiative,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(initiative);
        if (product.Id == Guid.Empty || initiative.Id == Guid.Empty || initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative must target the exact current Product.", nameof(initiative));
        }
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductRevision(initiative.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        PortableDesignProtocol.ValidateProductDigest(initiative.Digest);
        var capabilities = await ProbeAgentReadinessAsync(cancellationToken);
        var selection = await ReadAgentSelectionAsync(cancellationToken);
        IReadOnlyDictionary<string, object?> expectedSelection = selection.Status switch
        {
            AgentSelectionStatus.Selected when selection.Selection is not null =>
                new Dictionary<string, object?>
                {
                    ["status"] = "selected",
                    ["selectionDigest"] = selection.Selection.SelectionDigest,
                },
            AgentSelectionStatus.MigrationRequired when selection.PortableCandidate is not null =>
                new Dictionary<string, object?>
                {
                    ["status"] = "migration-required",
                    ["selectionDigest"] = selection.PortableCandidate.SelectionDigest,
                },
            AgentSelectionStatus.Unselected => new Dictionary<string, object?> { ["status"] = "unselected" },
            AgentSelectionStatus.Invalid => new Dictionary<string, object?> { ["status"] = "invalid" },
            _ => throw new ArgumentException("Agent Selection state is incomplete.", nameof(product)),
        };
        var expectedCapabilities = capabilities
            .OrderBy(capability => $"{capability.AdapterId}:{capability.AgentId}", StringComparer.Ordinal)
            .Select(capability => (IReadOnlyDictionary<string, object?>)new Dictionary<string, object?>
            {
                ["adapterId"] = capability.AdapterId,
                ["agentId"] = capability.AgentId,
                ["capabilityDigest"] = capability.CapabilityDigest,
            })
            .ToArray();
        var agentModelParams = new Dictionary<string, object?>
        {
            ["expectedProductId"] = product.Id,
            ["expectedProductRevision"] = product.Revision,
            ["expectedProductDigest"] = product.Digest,
            ["expectedSelection"] = expectedSelection,
            ["expectedCapabilities"] = expectedCapabilities,
        };
        using var response = await RequestPortableDesignAsync(
            "dashboard.phase2ChangeImpactAgentModel",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
                ["expectedInitiativeId"] = initiative.Id,
                ["expectedInitiativeRevision"] = initiative.Revision,
                ["expectedInitiativeDigest"] = initiative.Digest,
                ["agentModel"] = agentModelParams,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePhase2ChangeImpactAgentModelDashboardResponse(
                envelope, product, initiative, capabilities, selection));
    }

    public async Task<Phase1SummaryDashboard> ReadPhase1SummaryAsync(
        ProductBinding product,
        InitiativeEntryRecord initiative,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(initiative);
        if (product.Id == Guid.Empty || initiative.Id == Guid.Empty || initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative must target the exact current Product.", nameof(initiative));
        }
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductRevision(initiative.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        PortableDesignProtocol.ValidateProductDigest(initiative.Digest);
        using var response = await RequestPortableDesignAsync(
            "dashboard.phase1Summary",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
                ["expectedInitiativeId"] = initiative.Id,
                ["expectedInitiativeRevision"] = initiative.Revision,
                ["expectedInitiativeDigest"] = initiative.Digest,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePhase1SummaryResponse(envelope, product, initiative));
    }

    public async Task<Phase1ChangeImpactDashboard> ReadPhase1ChangeImpactAsync(
        ProductBinding product,
        InitiativeEntryRecord initiative,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(initiative);
        ArgumentNullException.ThrowIfNull(change);
        if (product.Id == Guid.Empty || initiative.Id == Guid.Empty || change.RecordId == Guid.Empty ||
            initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Phase 1 Change/Impact request must bind one exact Product, Initiative, and Change.");
        }
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductRevision(initiative.Revision);
        PortableDesignProtocol.ValidateProductRevision(change.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        PortableDesignProtocol.ValidateProductDigest(initiative.Digest);
        PortableDesignProtocol.ValidateProductDigest(change.Digest);
        using var response = await RequestPortableDesignAsync(
            "dashboard.phase1ChangeImpact",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
                ["expectedInitiativeId"] = initiative.Id,
                ["expectedInitiativeRevision"] = initiative.Revision,
                ["expectedInitiativeDigest"] = initiative.Digest,
                ["expectedChangeId"] = change.RecordId,
                ["expectedChangeRevision"] = change.Revision,
                ["expectedChangeDigest"] = change.Digest,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePhase1ChangeImpactResponse(envelope, product, initiative, change));
    }

    public async Task<ChangeImpactChangeCatalog> ListChangeImpactChangesAsync(
        ProductBinding product,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        if (product.Id == Guid.Empty) throw new ArgumentException("Product identity must not be empty.", nameof(product));
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        using var response = await RequestPortableDesignAsync(
            "dashboard.changeImpact.changes",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseChangeImpactChangeCatalogResponse(envelope, product));
    }

    public async Task<ChangeImpactDashboard> ReadChangeImpactAsync(
        ProductBinding product,
        ChangeImpactChangeReference change,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(change);
        if (product.Id == Guid.Empty || change.RecordId == Guid.Empty)
        {
            throw new ArgumentException("Product and Change identities must not be empty.");
        }
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductRevision(change.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        PortableDesignProtocol.ValidateProductDigest(change.Digest);
        using var response = await RequestPortableDesignAsync(
            "dashboard.changeImpact",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
                ["expectedChangeId"] = change.RecordId,
                ["expectedChangeRevision"] = change.Revision,
                ["expectedChangeDigest"] = change.Digest,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseChangeImpactDashboardResponse(envelope, product, change));
    }

    public async Task<AgentModelDashboard> ReadAgentModelAsync(
        ProductBinding product,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        if (product.Id == Guid.Empty) throw new ArgumentException("Product identity must not be empty.", nameof(product));
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        var capabilities = await ProbeAgentReadinessAsync(cancellationToken);
        var selection = await ReadAgentSelectionAsync(cancellationToken);
        IReadOnlyDictionary<string, object?> expectedSelection = selection.Status switch
        {
            AgentSelectionStatus.Selected when selection.Selection is not null =>
                new Dictionary<string, object?>
                {
                    ["status"] = "selected",
                    ["selectionDigest"] = selection.Selection.SelectionDigest,
                },
            AgentSelectionStatus.MigrationRequired when selection.PortableCandidate is not null =>
                new Dictionary<string, object?>
                {
                    ["status"] = "migration-required",
                    ["selectionDigest"] = selection.PortableCandidate.SelectionDigest,
                },
            AgentSelectionStatus.Unselected => new Dictionary<string, object?> { ["status"] = "unselected" },
            AgentSelectionStatus.Invalid => new Dictionary<string, object?> { ["status"] = "invalid" },
            _ => throw new ArgumentException("Agent Selection state is incomplete.", nameof(product)),
        };
        var expectedCapabilities = capabilities
            .OrderBy(capability => $"{capability.AdapterId}:{capability.AgentId}", StringComparer.Ordinal)
            .Select(capability => (IReadOnlyDictionary<string, object?>)new Dictionary<string, object?>
            {
                ["adapterId"] = capability.AdapterId,
                ["agentId"] = capability.AgentId,
                ["capabilityDigest"] = capability.CapabilityDigest,
            })
            .ToArray();
        using var response = await RequestPortableDesignAsync(
            "dashboard.agentModel",
            new Dictionary<string, object?>
            {
                ["expectedProductId"] = product.Id,
                ["expectedProductRevision"] = product.Revision,
                ["expectedProductDigest"] = product.Digest,
                ["expectedSelection"] = expectedSelection,
                ["expectedCapabilities"] = expectedCapabilities,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseAgentModelDashboardResponse(
                envelope,
                product,
                capabilities,
                selection));
    }

    public async Task<Phase1AgentModelDashboard> ReadPhase1AgentModelAsync(
        ProductBinding product,
        InitiativeEntryRecord initiative,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(product);
        ArgumentNullException.ThrowIfNull(initiative);
        if (product.Id == Guid.Empty || initiative.Id == Guid.Empty || initiative.ProductId != product.Id)
        {
            throw new ArgumentException("The Initiative must target the exact current Product.", nameof(initiative));
        }
        PortableDesignProtocol.ValidateProductRevision(product.Revision);
        PortableDesignProtocol.ValidateProductRevision(initiative.Revision);
        PortableDesignProtocol.ValidateProductDigest(product.Digest);
        PortableDesignProtocol.ValidateProductDigest(initiative.Digest);
        var capabilities = await ProbeAgentReadinessAsync(cancellationToken);
        var selection = await ReadAgentSelectionAsync(cancellationToken);
        IReadOnlyDictionary<string, object?> expectedSelection = selection.Status switch
        {
            AgentSelectionStatus.Selected when selection.Selection is not null =>
                new Dictionary<string, object?>
                {
                    ["status"] = "selected",
                    ["selectionDigest"] = selection.Selection.SelectionDigest,
                },
            AgentSelectionStatus.MigrationRequired when selection.PortableCandidate is not null =>
                new Dictionary<string, object?>
                {
                    ["status"] = "migration-required",
                    ["selectionDigest"] = selection.PortableCandidate.SelectionDigest,
                },
            AgentSelectionStatus.Unselected => new Dictionary<string, object?> { ["status"] = "unselected" },
            AgentSelectionStatus.Invalid => new Dictionary<string, object?> { ["status"] = "invalid" },
            _ => throw new ArgumentException("Agent Selection state is incomplete.", nameof(product)),
        };
        var expectedCapabilities = capabilities
            .OrderBy(capability => $"{capability.AdapterId}:{capability.AgentId}", StringComparer.Ordinal)
            .Select(capability => (IReadOnlyDictionary<string, object?>)new Dictionary<string, object?>
            {
                ["adapterId"] = capability.AdapterId,
                ["agentId"] = capability.AgentId,
                ["capabilityDigest"] = capability.CapabilityDigest,
            })
            .ToArray();
        var agentModelParams = new Dictionary<string, object?>
        {
            ["expectedProductId"] = product.Id,
            ["expectedProductRevision"] = product.Revision,
            ["expectedProductDigest"] = product.Digest,
            ["expectedSelection"] = expectedSelection,
            ["expectedCapabilities"] = expectedCapabilities,
        };
        using var response = await RequestPortableDesignAsync(
            "dashboard.phase1AgentModel",
            new Dictionary<string, object?>
            {
                ["expectedInitiativeId"] = initiative.Id,
                ["expectedInitiativeRevision"] = initiative.Revision,
                ["expectedInitiativeDigest"] = initiative.Digest,
                ["agentModel"] = agentModelParams,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParsePhase1AgentModelResponse(
                envelope,
                product,
                initiative,
                capabilities,
                selection));
    }

    public async Task<IReadOnlyList<AgentReadinessSnapshot>> ProbeAgentReadinessAsync(
        CancellationToken cancellationToken = default)
    {
        using var response = await RequestWorkflowAsync(
            "probeAgents",
            new Dictionary<string, object?>(),
            protocolVersion: null,
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            PortableDesignProtocol.ParseAgentReadinessResponse);
    }

    public async Task<AgentSelectionState> ReadAgentSelectionAsync(CancellationToken cancellationToken = default)
    {
        using var response = await RequestPortableDesignAsync(
            "readAgentSelection",
            new Dictionary<string, object?>(),
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            PortableDesignProtocol.ParseAgentSelectionStateResponse);
    }

    public async Task<AgentSelection> SelectAgentAsync(
        string adapterId,
        string modelId,
        IReadOnlyDictionary<string, PortableAgentSettingValue> settings,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var normalizedAdapterId = PortableDesignProtocol.ValidateSelectionIdentifier(adapterId, "Adapter ID");
        var normalizedModelId = PortableDesignProtocol.ValidateSelectionIdentifier(modelId, "Model ID");
        var normalizedSettings = PortableDesignProtocol.SerializePortableAgentSettings(settings);
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        using var response = await RequestPortableDesignAsync(
            "selectAgent",
            new Dictionary<string, object?>
            {
                ["adapterId"] = normalizedAdapterId,
                ["modelId"] = normalizedModelId,
                ["settings"] = normalizedSettings,
                ["actorId"] = normalizedActorId,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            PortableDesignProtocol.ParseAgentSelectionResponse);
    }

    public async Task<IReadOnlyList<AgentRun>> ListRunsAsync(CancellationToken cancellationToken = default)
    {
        using var response = await RequestPortableDesignAsync(
            "listRuns",
            new Dictionary<string, object?>(),
            cancellationToken);
        return ParsePortableDesignResponse(response, PortableDesignProtocol.ParseAgentRunsResponse);
    }

    public async Task<AgentHandoff> CreateHandoffAsync(
        Guid fromRunId,
        Guid productId,
        Guid initiativeId,
        string toAdapterId,
        string toAgentId,
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
        if (fromRunId == Guid.Empty) throw new ArgumentException("Source Run ID must be a non-empty UUID.", nameof(fromRunId));
        if (productId == Guid.Empty) throw new ArgumentException("Product ID must be a non-empty UUID.", nameof(productId));
        if (initiativeId == Guid.Empty) throw new ArgumentException("Initiative ID must be a non-empty UUID.", nameof(initiativeId));
        var normalizedAdapterId = PortableDesignProtocol.ValidateSelectionIdentifier(toAdapterId, "Target Adapter ID");
        var normalizedAgentId = PortableDesignProtocol.ValidateSelectionIdentifier(toAgentId, "Target Agent ID");
        var normalizedModelId = PortableDesignProtocol.ValidateSelectionIdentifier(toModelId, "Target Model ID");
        var normalizedSettings = PortableDesignProtocol.SerializePortableAgentSettings(toSettings);
        var normalizedReason = PortableDesignProtocol.ValidateHandoffText(reason, "Handoff reason", 2, 5_000);
        var normalizedCompleted = PortableDesignProtocol.ValidateHandoffTextList(completedWork, "Completed work");
        var normalizedUnresolved = PortableDesignProtocol.ValidateHandoffTextList(unresolvedMatters, "Unresolved matters");
        var normalizedDecisions = PortableDesignProtocol.ValidateHandoffTextList(decisions, "Decisions");
        var normalizedEvidence = PortableDesignProtocol.ValidateHandoffTextList(evidence, "Evidence");
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        using var response = await RequestPortableDesignAsync(
            "createHandoff",
            new Dictionary<string, object?>
            {
                ["actorId"] = normalizedActorId,
                ["handoff"] = new Dictionary<string, object?>
                {
                    ["fromRunId"] = fromRunId,
                    ["toAdapterId"] = normalizedAdapterId,
                    ["toModelId"] = normalizedModelId,
                    ["toSettings"] = normalizedSettings,
                    ["reason"] = normalizedReason,
                    ["completedWork"] = normalizedCompleted,
                    ["unresolvedMatters"] = normalizedUnresolved,
                    ["decisions"] = normalizedDecisions,
                    ["evidence"] = normalizedEvidence,
                },
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseAgentHandoffResponse(
                envelope,
                fromRunId,
                productId,
                initiativeId,
                normalizedAdapterId,
                normalizedAgentId,
                normalizedModelId,
                toSettings,
                normalizedReason,
                normalizedCompleted,
                normalizedUnresolved,
                normalizedDecisions,
                normalizedEvidence));
    }

    public async Task<ManagedReadOnlyPreview> PreviewManagedReadOnlyAsync(
        Guid charterId,
        Guid workflowPlanId,
        CancellationToken cancellationToken = default)
    {
        if (charterId == Guid.Empty)
        {
            throw new ArgumentException("Charter ID must be a non-empty UUID.", nameof(charterId));
        }
        if (workflowPlanId == Guid.Empty)
        {
            throw new ArgumentException("Workflow Plan ID must be a non-empty UUID.", nameof(workflowPlanId));
        }
        using var response = await RequestPortableDesignAsync(
            "managed.readonly.preview",
            new Dictionary<string, object?>
            {
                ["charterId"] = charterId,
                ["workflowPlanId"] = workflowPlanId,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManagedReadOnlyPreviewResponse(
                envelope,
                charterId,
                workflowPlanId));
    }

    public async Task<ManagedReadOnlyReceipt> ExecuteManagedReadOnlyAsync(
        ManagedReadOnlyPreview preview,
        int timeoutMs,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        PortableDesignProtocol.ValidateManagedReadOnlyPreview(preview);
        if (timeoutMs is < 1_000 or > 300_000)
        {
            throw new ArgumentOutOfRangeException(
                nameof(timeoutMs),
                "Managed read-only timeout must be between 1,000 and 300,000 milliseconds.");
        }
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        using var response = await RequestPortableDesignAsync(
            "managed.readonly.execute",
            new Dictionary<string, object?>
            {
                ["actorId"] = normalizedActorId,
                ["charterId"] = preview.CharterId,
                ["workflowPlanId"] = preview.WorkflowPlanId,
                ["expectedPreviewDigest"] = preview.PreviewDigest,
                ["timeoutMs"] = timeoutMs,
                ["confirmation"] = "attest-exact-managed-readonly-preview",
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManagedReadOnlyReceiptResponse(envelope, preview));
    }

    public async Task<ManagedRunSummaryPage> ListManagedEvidenceAsync(
        int offset = 0,
        int limit = 100,
        string? snapshotDigest = null,
        int? expectedTotal = null,
        CancellationToken cancellationToken = default)
    {
        PortableDesignProtocol.ValidateManagedEvidencePage(offset, limit, snapshotDigest, expectedTotal);
        var parameters = new Dictionary<string, object?>
        {
            ["offset"] = offset,
            ["limit"] = limit,
        };
        if (snapshotDigest is not null) parameters["snapshotDigest"] = snapshotDigest;
        using var response = await RequestPortableDesignAsync(
            "managed.evidence.list",
            parameters,
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManagedRunSummaryPageResponse(
                envelope,
                offset,
                limit,
                snapshotDigest,
                expectedTotal));
    }

    public async Task<ManagedEvidenceDetail> ReadManagedEvidenceAsync(
        Guid managedRunId,
        CancellationToken cancellationToken = default)
    {
        if (managedRunId == Guid.Empty)
        {
            throw new ArgumentException("Managed Run ID must be a non-empty UUID.", nameof(managedRunId));
        }
        using var response = await RequestPortableDesignAsync(
            "managed.evidence.read",
            new Dictionary<string, object?> { ["managedRunId"] = managedRunId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManagedEvidenceDetailResponse(envelope, managedRunId));
    }

    public async Task<ManagedReviewPreview> ReadManagedReviewAsync(
        Guid managedRunId,
        CancellationToken cancellationToken = default)
    {
        if (managedRunId == Guid.Empty)
        {
            throw new ArgumentException("Managed Run ID must be a non-empty UUID.", nameof(managedRunId));
        }
        using var response = await RequestPortableDesignAsync(
            "managed.review.read",
            new Dictionary<string, object?> { ["managedRunId"] = managedRunId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManagedReviewPreviewResponse(envelope, managedRunId));
    }

    public Task<ManagedReviewTransition> ApplyManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        CancellationToken cancellationToken = default) =>
        DecideManagedReviewAsync(preview, actorId, "apply-exact-managed-review", cancellationToken);

    public Task<ManagedReviewTransition> DiscardManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        CancellationToken cancellationToken = default) =>
        DecideManagedReviewAsync(preview, actorId, "discard-exact-managed-review", cancellationToken);

    private async Task<ManagedReviewTransition> DecideManagedReviewAsync(
        ManagedReviewPreview preview,
        string actorId,
        string decision,
        CancellationToken cancellationToken)
    {
        PortableDesignProtocol.ValidateManagedReviewPreview(preview);
        if (decision is not ("apply-exact-managed-review" or "discard-exact-managed-review"))
        {
            throw new ArgumentException("Managed review decision is invalid.", nameof(decision));
        }
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        var method = decision == "apply-exact-managed-review" ? "managed.review.apply" : "managed.review.discard";
        using var response = await RequestPortableDesignAsync(
            method,
            new Dictionary<string, object?>
            {
                ["actorId"] = normalizedActorId,
                ["managedRunId"] = preview.ManagedRunId,
                ["expectedManagedRunRevision"] = preview.ManagedRunRevision,
                ["expectedPreviewDigest"] = preview.PreviewDigest,
                ["confirmation"] = decision,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            envelope => PortableDesignProtocol.ParseManagedReviewTransitionResponse(envelope, preview, decision));
    }

    public async Task<PortableDesignSnapshotSummary> ImportPortableDesignSnapshotAsync(
        string bundleRoot,
        Guid expectedProductId,
        long expectedProductRevision,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (expectedProductId == Guid.Empty)
        {
            throw new ArgumentException("Expected Product ID must be a non-empty UUID.", nameof(expectedProductId));
        }
        var normalizedBundleRoot = PortableDesignProtocol.NormalizeBundleRoot(bundleRoot);
        PortableDesignProtocol.ValidateProductRevision(expectedProductRevision);
        var normalizedActorId = PortableDesignProtocol.ValidateActorId(actorId);
        using var response = await RequestPortableDesignAsync(
            "productStudio.portableDesign.import",
            new Dictionary<string, object?>
            {
                ["bundleRoot"] = normalizedBundleRoot,
                ["expectedProductId"] = expectedProductId,
                ["expectedProductRevision"] = expectedProductRevision,
                ["actorId"] = normalizedActorId,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            element => PortableDesignProtocol.ParseSnapshotResponse(element, expectedProductId: expectedProductId));
    }

    public async Task<PortableDesignSnapshotPage> ListPortableDesignSnapshotsAsync(
        int offset = 0,
        int limit = PortableDesignProtocol.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        PortableDesignProtocol.ValidatePage(offset, limit);
        using var response = await RequestPortableDesignAsync(
            "productStudio.portableDesign.list",
            new Dictionary<string, object?>
            {
                ["offset"] = offset,
                ["limit"] = limit,
            },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            element => PortableDesignProtocol.ParsePageResponse(element, offset, limit));
    }

    public async Task<PortableDesignSnapshotSummary> ReadPortableDesignSnapshotAsync(
        Guid bundleId,
        CancellationToken cancellationToken = default)
    {
        if (bundleId == Guid.Empty)
        {
            throw new ArgumentException("Bundle ID must be a non-empty UUID.", nameof(bundleId));
        }
        using var response = await RequestPortableDesignAsync(
            "productStudio.portableDesign.read",
            new Dictionary<string, object?> { ["bundleId"] = bundleId },
            cancellationToken);
        return ParsePortableDesignResponse(
            response,
            element => PortableDesignProtocol.ParseSnapshotResponse(element, expectedBundleId: bundleId));
    }

    public Task<JsonDocument> RequestAsync(
        string method,
        IReadOnlyDictionary<string, object?>? parameters = null,
        CancellationToken cancellationToken = default) =>
        RequestAsync(method, parameters, protocolVersion: null, cancellationToken);

    private async Task<JsonDocument> RequestAsync(
        string method,
        IReadOnlyDictionary<string, object?>? parameters,
        int? protocolVersion,
        CancellationToken cancellationToken)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        await requestGate.WaitAsync(cancellationToken);
        try
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            StartIfNeeded();
            var id = Interlocked.Increment(ref nextId);
            var envelope = new Dictionary<string, object?>
            {
                ["jsonrpc"] = "2.0",
                ["id"] = id,
                ["method"] = method,
                ["params"] = parameters ?? new Dictionary<string, object?>(),
            };
            if (protocolVersion.HasValue) envelope["protocolVersion"] = protocolVersion.Value;
            var request = JsonSerializer.Serialize(envelope);
            if (StrictUtf8.GetByteCount(request) > MaxResponseFrameBytes)
            {
                throw new EngineHostException(
                    -32_001,
                    "FRAME_TOO_LARGE",
                    "The GAEP engine request exceeded the configured frame boundary.");
            }
            await process!.StandardInput.WriteLineAsync(request.AsMemory(), cancellationToken);
            await process.StandardInput.FlushAsync(cancellationToken);
            var response = await ReadBoundedResponseAsync(cancellationToken);
            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(response);
            }
            catch (JsonException)
            {
                throw InvalidHostResponse();
            }
            if (!document.RootElement.TryGetProperty("id", out var responseId) ||
                !responseId.TryGetInt64(out var returnedId) || returnedId != id)
            {
                document.Dispose();
                throw InvalidHostResponse();
            }
            return document;
        }
        catch
        {
            await StopProcessAsync();
            throw;
        }
        finally
        {
            requestGate.Release();
        }
    }

    private async Task<JsonDocument> RequestPortableDesignAsync(
        string method,
        IReadOnlyDictionary<string, object?> parameters,
        CancellationToken cancellationToken)
        => await RequestWorkflowAsync(
            method,
            parameters,
            PortableDesignProtocol.ProtocolVersion,
            cancellationToken);

    private async Task<JsonDocument> RequestWorkflowAsync(
        string method,
        IReadOnlyDictionary<string, object?> parameters,
        int? protocolVersion,
        CancellationToken cancellationToken)
    {
        try
        {
            return await RequestAsync(method, parameters, protocolVersion, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (EngineHostException)
        {
            throw;
        }
        catch
        {
            throw PortableDesignProtocol.HostUnavailable();
        }
    }

    private static EngineHostException InvalidHostResponse() => new(
        -32_603,
        "HOST_RESPONSE_INVALID",
        "The GAEP engine returned a response that could not be verified.");

    private static EngineHostException HostUnavailable() => new(
        -32_603,
        "HOST_UNAVAILABLE",
        "The GAEP engine host could not complete the request.");

    private static T ParsePortableDesignResponse<T>(JsonDocument response, Func<JsonElement, T> parse)
    {
        try
        {
            return parse(response.RootElement);
        }
        catch (EngineHostException)
        {
            throw;
        }
        catch
        {
            throw PortableDesignProtocol.InvalidResponse();
        }
    }

    private void StartIfNeeded()
    {
        if (process is { HasExited: false }) return;
        process?.Dispose();
        process = null;
        pendingResponseBytes.Clear();
        var identity = ResolveAndVerifyEngine();
        var packagedIdentity = ResolveAndVerifyPackagedEngine();
        var start = new ProcessStartInfo
        {
            FileName = identity.Path,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        start.Environment.Clear();
        foreach (var entry in childEnvironment) start.Environment[entry.Key] = entry.Value;
        if (packagedIdentity is not null) start.ArgumentList.Add(packagedIdentity.Value.Path);
        start.ArgumentList.Add("--workspace");
        start.ArgumentList.Add(workspacePath);
        var started = Process.Start(start) ?? throw new InvalidOperationException("Unable to start the GAEP engine host.");
        try
        {
            started.ErrorDataReceived += static (_, _) => { };
            started.BeginErrorReadLine();
            var postStartDigest = ComputeDigest(identity.Path);
            if (!StringComparer.Ordinal.Equals(postStartDigest, identity.Digest))
            {
                throw new InvalidOperationException("The GAEP engine executable changed while the host process was starting.");
            }
            if (packagedIdentity is not null &&
                !StringComparer.Ordinal.Equals(
                    ComputeDigest(packagedIdentity.Value.Path),
                    packagedIdentity.Value.Digest))
            {
                throw new InvalidOperationException("The packaged GAEP engine changed while the host process was starting.");
            }
            process = started;
        }
        catch
        {
            try
            {
                if (!started.HasExited) started.Kill(entireProcessTree: true);
            }
            catch
            {
                // Preserve the launch-verification failure while still releasing the handle.
            }
            started.Dispose();
            throw;
        }
    }

    private (string Path, string Digest) ResolveAndVerifyEngine()
    {
        var path = ResolveExecutable(requestedEngineExecutable);
        var digest = ComputeDigest(path);
        if (configuredEngineDigest is not null && !StringComparer.Ordinal.Equals(configuredEngineDigest, digest))
        {
            throw new InvalidOperationException("The GAEP engine executable does not match the configured SHA-256 digest.");
        }
        if (boundEnginePath is not null && !PathComparer.Equals(boundEnginePath, path))
        {
            throw new InvalidOperationException("The resolved GAEP engine executable changed after this client was bound.");
        }
        if (boundEngineDigest is not null && !StringComparer.Ordinal.Equals(boundEngineDigest, digest))
        {
            throw new InvalidOperationException("The bound GAEP engine executable changed after this client was created.");
        }
        boundEnginePath ??= path;
        boundEngineDigest ??= digest;
        return (path, digest);
    }

    private (string Path, string Digest)? ResolveAndVerifyPackagedEngine()
    {
        if (packagedEngineModule is null) return null;
        var path = ResolveAbsoluteRegularFile(packagedEngineModule.Path);
        var digest = ComputeDigest(path);
        if (!StringComparer.Ordinal.Equals(configuredPackagedEngineDigest, digest))
        {
            throw new InvalidOperationException("The packaged GAEP engine does not match its embedded SHA-256 digest.");
        }
        if (boundPackagedEnginePath is not null && !PathComparer.Equals(boundPackagedEnginePath, path))
        {
            throw new InvalidOperationException("The resolved packaged GAEP engine changed after this client was bound.");
        }
        if (boundPackagedEngineDigest is not null &&
            !StringComparer.Ordinal.Equals(boundPackagedEngineDigest, digest))
        {
            throw new InvalidOperationException("The bound packaged GAEP engine changed after this client was created.");
        }
        boundPackagedEnginePath ??= path;
        boundPackagedEngineDigest ??= digest;
        return (path, digest);
    }

    private static StringComparer PathComparer => OperatingSystem.IsWindows()
        ? StringComparer.OrdinalIgnoreCase
        : StringComparer.Ordinal;

    private string ResolveExecutable(string requested)
    {
        var candidates = new List<string>();
        if (Path.IsPathRooted(requested) || requested.Contains(Path.DirectorySeparatorChar) ||
            requested.Contains(Path.AltDirectorySeparatorChar))
        {
            candidates.Add(Path.GetFullPath(requested));
        }
        else
        {
            var extensions = OperatingSystem.IsWindows()
                ? (VisualStudioEngineClientFactory.EnvironmentValue(childEnvironment, "PATHEXT") ?? ".EXE;.CMD;.BAT")
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                : [""];
            foreach (var directory in (VisualStudioEngineClientFactory.EnvironmentValue(childEnvironment, "PATH") ?? "")
                         .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                foreach (var extension in extensions)
                {
                    candidates.Add(Path.Combine(directory, requested.EndsWith(extension, StringComparison.OrdinalIgnoreCase)
                        ? requested
                        : requested + extension));
                }
            }
        }
        foreach (var candidate in candidates)
        {
            if (!File.Exists(candidate)) continue;
            var file = new FileInfo(candidate);
            var target = file.LinkTarget is null ? null : file.ResolveLinkTarget(returnFinalTarget: true);
            return Path.GetFullPath(target?.FullName ?? file.FullName);
        }
        throw new FileNotFoundException("The GAEP engine executable could not be resolved to an existing file.");
    }

    private static string ResolveAbsoluteRegularFile(string requested)
    {
        if (!Path.IsPathRooted(requested))
        {
            throw new ArgumentException("The package-local GAEP engine path must be absolute.", nameof(requested));
        }
        var file = new FileInfo(Path.GetFullPath(requested));
        if (!file.Exists)
        {
            throw new FileNotFoundException("The package-local GAEP engine could not be resolved to an existing file.");
        }
        var target = file.LinkTarget is null ? null : file.ResolveLinkTarget(returnFinalTarget: true);
        var resolved = new FileInfo(Path.GetFullPath(target?.FullName ?? file.FullName));
        if (!resolved.Exists || (resolved.Attributes & FileAttributes.Directory) != 0)
        {
            throw new InvalidOperationException("The resolved package-local GAEP engine is not a regular file.");
        }
        return resolved.FullName;
    }

    private static string ComputeDigest(string path)
    {
        using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Convert.ToHexString(SHA256.HashData(input)).ToLowerInvariant();
    }

    private static string? NormalizeDigest(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.StartsWith("sha256:", StringComparison.Ordinal)) normalized = normalized[7..];
        if (normalized.Length != 64 || normalized.Any(character => !Uri.IsHexDigit(character)))
        {
            throw new ArgumentException("Expected engine SHA-256 must contain exactly 64 hexadecimal characters.", nameof(value));
        }
        return normalized;
    }

    private static Dictionary<string, string> CaptureEnvironment()
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (System.Collections.DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            if (entry.Key is string key && entry.Value is string value) result[key] = value;
        }
        return result;
    }

    private async Task<string> ReadBoundedResponseAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            var newline = pendingResponseBytes.IndexOf((byte)'\n');
            if (newline >= 0)
            {
                if (newline > MaxResponseFrameBytes)
                {
                    throw new EngineHostException(
                        -32_002,
                        "RESPONSE_TOO_LARGE",
                        "The GAEP engine response exceeded the configured frame boundary.");
                }
                var length = newline > 0 && pendingResponseBytes[newline - 1] == (byte)'\r' ? newline - 1 : newline;
                var frame = pendingResponseBytes.GetRange(0, length).ToArray();
                pendingResponseBytes.RemoveRange(0, newline + 1);
                try
                {
                    return StrictUtf8.GetString(frame);
                }
                catch (DecoderFallbackException)
                {
                    throw new EngineHostException(
                        -32_700,
                        "INVALID_UTF8",
                        "The GAEP engine response was not valid UTF-8.");
                }
            }
            if (pendingResponseBytes.Count > MaxResponseFrameBytes)
            {
                throw new EngineHostException(
                    -32_002,
                    "RESPONSE_TOO_LARGE",
                    "The GAEP engine response exceeded the configured frame boundary.");
            }
            var read = await process!.StandardOutput.BaseStream.ReadAsync(responseReadBuffer, cancellationToken);
            if (read == 0) throw HostUnavailable();
            pendingResponseBytes.AddRange(responseReadBuffer.AsSpan(0, read).ToArray());
        }
    }

    private async Task StopProcessAsync()
    {
        var current = process;
        process = null;
        pendingResponseBytes.Clear();
        if (current is null) return;
        try
        {
            try
            {
                current.StandardInput.Close();
            }
            catch
            {
                // Cleanup is best-effort after a protocol or transport failure.
            }
            try
            {
                if (!current.HasExited) current.Kill(entireProcessTree: true);
            }
            catch
            {
                // The process may have exited between the state check and the kill request.
            }
            try
            {
                await current.WaitForExitAsync();
            }
            catch
            {
                // Preserve the initiating failure; disposal below still releases the handle.
            }
        }
        finally
        {
            current.Dispose();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        await requestGate.WaitAsync();
        try
        {
            if (disposed) return;
            disposed = true;
            await StopProcessAsync();
        }
        finally
        {
            requestGate.Release();
        }
    }
}
