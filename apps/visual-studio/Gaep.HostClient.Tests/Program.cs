using System.Security.Cryptography;
using System.Runtime.Loader;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Gaep.HostClient;

internal static class Program
{
    private static readonly Guid ProductId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid InitiativeId = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid BundleId = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly Guid MissingBundleId = Guid.Parse("44444444-4444-4444-8444-444444444444");
    private static readonly Guid ExtraFieldBundleId = Guid.Parse("55555555-5555-4555-8555-555555555555");
    private static readonly Guid MismatchedBundleId = Guid.Parse("66666666-6666-4666-8666-666666666666");
    private static readonly Guid OversizedBundleId = Guid.Parse("77777777-7777-4777-8777-777777777777");
    private static readonly Guid ExtraErrorEnvelopeBundleId = Guid.Parse("88888888-8888-4888-8888-888888888888");
    private static readonly Guid WrongErrorCodeBundleId = Guid.Parse("99999999-9999-4999-8999-999999999999");
    private static readonly Guid RunId = Guid.Parse("12121212-1212-4121-8121-121212121212");
    private static readonly Guid CharterId = Guid.Parse("13131313-1313-4131-8131-131313131313");
    private static readonly Guid HandoffId = Guid.Parse("14141414-1414-4141-8141-141414141414");
    private static readonly Guid WorkflowPlanId = Guid.Parse("15151515-1515-4151-8151-151515151515");
    private static readonly Guid ManagedRunId = Guid.Parse("16161616-1616-4161-8161-161616161616");
    private static readonly Guid GovernedManagedRunId = Guid.Parse("17171717-1717-4171-8171-171717171717");
    private static readonly Guid WorkflowStepId = Guid.Parse("18181818-1818-4181-8181-181818181818");
    private static readonly Guid ManagedResultId = Guid.Parse("19191919-1919-4191-8191-191919191919");
    private static readonly Guid ManagedEvidenceId = Guid.Parse("20202020-2020-4202-8202-202020202020");
    private static readonly Guid ManagedApplyDecisionId = Guid.Parse("21212121-2121-4212-8212-212121212121");
    private static readonly Guid RecordOnlyManagedRunId = Guid.Parse("22222222-2222-4222-8222-222222222223");
    private static readonly Guid StagedManagedRunId = Guid.Parse("23232323-2323-4323-8323-232323232323");
    private static readonly Guid StagedResultId = Guid.Parse("24242424-2424-4424-8424-242424242424");
    private static readonly Guid StagedEvidenceId = Guid.Parse("25252525-2525-4525-8525-252525252525");
    private static readonly Guid TransitionedResultId = Guid.Parse("26262626-2626-4626-8626-262626262626");
    private static readonly Guid TransitionedEvidenceId = Guid.Parse("27272727-2727-4727-8727-272727272727");
    private static readonly Guid ReviewApplyDecisionId = Guid.Parse("28282828-2828-4828-8828-282828282828");
    private static readonly Guid ChangeId = Guid.Parse("29292929-2929-4929-8929-292929292929");
    private static readonly Guid ChangeWorkItemId = Guid.Parse("30303030-3030-4030-8030-303030303030");
    private static readonly Guid ChangeTraceId = Guid.Parse("31313131-3131-4131-8131-313131313131");
    private static readonly Guid ChangeDecisionId = Guid.Parse("32323232-3232-4232-8232-323232323232");
    private static readonly Guid ChangeRiskId = Guid.Parse("34343434-3434-4434-8434-343434343434");
    private static readonly Guid InitiativeDecisionId = Guid.Parse("35353535-3535-4535-8535-353535353535");
    private static readonly Guid SourceId = Guid.Parse("36363636-3636-4636-8636-363636363636");
    private static readonly Guid SourceBaselineId = Guid.Parse("37373737-3737-4737-8737-373737373737");
    private static readonly Guid SourceProvenanceId = Guid.Parse("38383838-3838-4838-8838-383838383838");
    private static readonly Guid BusinessUnderstandingId = Guid.Parse("39393939-3939-4939-8939-393939393939");
    private static readonly Guid StakeholderModelId = Guid.Parse("40404040-4040-4040-8040-404040404040");
    private static readonly Guid OutcomeModelId = Guid.Parse("41414141-4141-4141-8141-414141414141");
    private static readonly Guid BusinessCapabilityMapId = Guid.Parse("42424242-4242-4242-8242-424242424242");
    private static readonly Guid ValueStreamModelId = Guid.Parse("43434343-4343-4343-8343-434343434343");
    private static readonly Guid OperatingModelId = Guid.Parse("44444444-4444-4444-8444-444444444444");
    private static readonly Guid BusinessRuleCatalogId = Guid.Parse("45454545-4545-4545-8545-454545454545");
    private static readonly Guid BusinessArchitectureBaselineId = Guid.Parse("46464646-4646-4646-8646-464646464646");
    private static readonly Guid SystemSolutionArchitectureId = Guid.Parse("47474747-4747-4747-8747-474747474747");
    private static readonly Guid BoundedContextModelId = Guid.Parse("48484848-4848-4848-8848-484848484848");
    private static readonly Guid SecurityPrivacyAssessmentId = Guid.Parse("49494949-4949-4949-8949-494949494949");
    private static readonly Guid ProcessModelId = Guid.Parse("50505050-5050-4050-8050-505050505050");
    private static readonly Guid DataModelId = Guid.Parse("51515151-5151-4151-8151-515151515151");
    private static readonly Guid AuthorizationModelId = Guid.Parse("52525252-5252-4252-8252-525252525252");
    private static readonly Guid EventIntegrationModelId = Guid.Parse("53535353-5353-4353-8353-535353535353");
    private static readonly Guid FailureRecoveryModelId = Guid.Parse("54545454-5454-4454-8454-545454545454");
    private static readonly Guid ArchitectureChallengeModelId = Guid.Parse("56565656-5656-4656-8656-565656565656");
    private static readonly Guid DecisionRegisterId = Guid.Parse("57575757-5757-4757-8757-575757575757");
    private static readonly Guid RiskRegisterId = Guid.Parse("58585858-5858-4858-8858-585858585858");
    private static readonly Guid EvidenceRegistryId = Guid.Parse("59595959-5959-4959-8959-595959595959");
    private static readonly Guid EndToEndTraceabilityId = Guid.Parse("60606060-6060-4060-8060-606060606060");
    private static readonly Guid P0P4ReadinessGateId = Guid.Parse("61616161-6161-4161-8161-616161616161");
    private static readonly Guid P5HandoffPackageId = Guid.Parse("62626262-6262-4262-8262-626262626262");
    private static readonly Guid DesignApplicabilityId = Guid.Parse("63636363-6363-4363-8363-636363636363");
    private static readonly Guid DesignPersonaRoleId = Guid.Parse("64646464-6464-4464-8464-646464646464");
    private static readonly Guid UserJourneyId = Guid.Parse("65656565-6565-4565-8565-656565656565");
    private static readonly Guid InformationArchitectureId = Guid.Parse("66666666-6666-4666-8666-666666666666");
    private static readonly Guid ScreenStateInventoryId = Guid.Parse("67676767-6767-4767-8767-676767676767");
    private static readonly Guid DesignRequirementsId = Guid.Parse("68686868-6868-4868-8868-686868686868");
    private static readonly Guid BacklogHierarchyId = Guid.Parse("91919191-9191-4191-8191-919191919191");
    private static readonly Guid MvpSliceDefinitionId = Guid.Parse("92929292-9292-4292-8292-929292929292");
    private static readonly Guid PrioritizationModelId = Guid.Parse("93939393-9393-4393-8393-939393939393");
    private static readonly Guid AcceptanceCriteriaId = Guid.Parse("94949494-9494-4494-8494-949494949494");
    private static readonly Guid DefinitionOfReadyId = Guid.Parse("95959595-9595-4595-8595-959595959595");
    private static readonly Guid DefinitionOfDoneId = Guid.Parse("96969696-9696-4696-8696-969696969696");
    private static readonly Guid ImplementationUnitModelId = Guid.Parse("97979797-9797-4797-8797-979797979797");
    private static readonly Guid DependencyMappingId = Guid.Parse("98989898-9898-4898-8898-989898989898");
    private static readonly Guid TechnologyProfileId = Guid.Parse("89898989-8989-4989-8989-898989898989");
    private static readonly Guid BoilerplateRegistryId = Guid.Parse("90909090-9090-4090-8090-909090909090");
    private static readonly Guid BoilerplateSelectionBindingId = Guid.Parse("a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9");
    private static readonly Guid BoilerplateCompatibilityValidationId = Guid.Parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    private static readonly Guid DesignSystemTokenContractId = Guid.Parse("69696969-6969-4969-8969-696969696969");
    private static readonly Guid AccessibilityDesignRulesId = Guid.Parse("70707070-7070-4070-8070-707070707070");
    private static readonly Guid ResponsiveMultiPlatformTargetsId = Guid.Parse("71717171-7171-4171-8171-717171717171");
    private static readonly Guid ManualFigmaExecutionPathId = Guid.Parse("72727272-7272-4272-8272-727272727272");
    private static readonly Guid FigmaMcpCapabilityDiscoveryId = Guid.Parse("73737373-7373-4373-8373-737373737373");
    private static readonly Guid FigmaReadSnapshotId = Guid.Parse("74747474-7474-4474-8474-747474747474");
    private static readonly Guid FigmaContextImportId = Guid.Parse("75757575-7575-4575-8575-757575757575");
    private static readonly Guid OutboundDesignBriefPackageId = Guid.Parse("76767676-7676-4676-8676-767676767676");
    private static readonly Guid GovernedFigmaWriteId = Guid.Parse("77777777-7777-4777-8777-777777777777");
    private static readonly Guid FinalizedFigmaSnapshotImportId = Guid.Parse("78787878-7878-4878-8878-787878787878");
    private static readonly Guid DesignToRequirementBindingId = Guid.Parse("79797979-7979-4979-8979-797979797979");
    private static readonly Guid DesignerReadyGateId = Guid.Parse("80808080-8080-4080-8080-808080808080");
    private static readonly Guid DesignDeltaId = Guid.Parse("81818181-8181-4181-8181-818181818181");
    private static readonly Guid DesignConflictResolutionId = Guid.Parse("82828282-8282-4282-8282-828282828282");
    private static readonly Guid HumanDesignApprovalId = Guid.Parse("83838383-8383-4383-8383-838383838383");
    private static readonly Guid DesignBaselineId = Guid.Parse("84848484-8484-4484-8484-848484848484");
    private static readonly Guid DesignDriftDetectionId = Guid.Parse("87878787-8787-4787-8787-878787878787");
    private const string CompletenessPolicyVersion = "gaep-initiative-classification-completeness-v1";
    private const string SubjectCatalogVersion = "gaep-initiative-applicability-subjects-v1";
    private const int SubjectCatalogCount = 49;
    private static readonly string CompletenessPolicyDigest = $"sha256:{new string('e', 64)}";
    private static readonly string SubjectCatalogDigest = $"sha256:{new string('f', 64)}";
    private const string PrivateRoot = "/Users/private/design-bundle";
    private const string PrivateCredential = "PRIVATE-OAUTH-TOKEN";
    private static int passed;

    private static async Task<int> Main(string[] args)
    {
        var packageArgument = Array.IndexOf(args, "--verify-package");
        if (packageArgument >= 0)
        {
            var packagePath = packageArgument + 1 < args.Length ? args[packageArgument + 1] : string.Empty;
            VerifyPackageAssembly(packagePath);
            return 0;
        }
        var workspaceArgument = Array.IndexOf(args, "--workspace");
        if (workspaceArgument >= 0)
        {
            var workspace = workspaceArgument + 1 < args.Length ? args[workspaceArgument + 1] : string.Empty;
            await RunFakeHostAsync(workspace);
            return 0;
        }

        var temporaryRoot = Path.Combine(Path.GetTempPath(), $"gaep-visual-studio-client-{Guid.NewGuid():N}");
        Directory.CreateDirectory(temporaryRoot);
        try
        {
            await RunClientTestsAsync(temporaryRoot);
            Console.WriteLine($"GAEP Visual Studio host-client tests: PASS ({passed})");
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine($"GAEP Visual Studio host-client tests: FAIL: {error.GetType().Name}: {error.Message}");
            return 1;
        }
        finally
        {
            Directory.Delete(temporaryRoot, recursive: true);
        }
    }

    private static async Task RunClientTestsAsync(string temporaryRoot)
    {
        var bundleRoot = Path.Combine(temporaryRoot, "portable-bundle");
        var invalidSourceRoot = Path.Combine(temporaryRoot, "source-error");
        var badReadinessRoot = Path.Combine(temporaryRoot, "bad-readiness");
        var badSelectionRoot = Path.Combine(temporaryRoot, "bad-selection");
        var badInitiativePrivateRoot = Path.Combine(temporaryRoot, "bad-initiative-private");
        var badInitiativeAssessmentAuthorityRoot = Path.Combine(temporaryRoot, "bad-initiative-assessment-authority");
        var badInitiativeAssessmentBindingRoot = Path.Combine(temporaryRoot, "bad-initiative-assessment-binding");
        var badInitiativeAssessmentPolicyRoot = Path.Combine(temporaryRoot, "bad-initiative-assessment-policy");
        var badInitiativeAssessmentCoverageRoot = Path.Combine(temporaryRoot, "bad-initiative-assessment-coverage");
        var badInitiativeClassificationBindingRoot = Path.Combine(temporaryRoot, "bad-initiative-classification-binding");
        var badInitiativeApplicabilityBindingRoot = Path.Combine(temporaryRoot, "bad-initiative-applicability-binding");
        var badSourceSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-source-snapshot-binding");
        var badSourceSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-source-snapshot-digest");
        var badSourceSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-source-snapshot-private");
        var badBusinessSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-business-snapshot-binding");
        var badBusinessSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-business-snapshot-digest");
        var badBusinessSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-business-snapshot-private");
        var badCapabilitySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-capability-snapshot-binding");
        var badCapabilitySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-capability-snapshot-digest");
        var badCapabilitySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-capability-snapshot-private");
        var badValueStreamSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-value-stream-snapshot-binding");
        var badValueStreamSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-value-stream-snapshot-digest");
        var badValueStreamSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-value-stream-snapshot-private");
        var badOperatingModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-operating-model-snapshot-binding");
        var badOperatingModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-operating-model-snapshot-digest");
        var badOperatingModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-operating-model-snapshot-private");
        var badBusinessRuleSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-business-rule-snapshot-binding");
        var badBusinessRuleSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-business-rule-snapshot-digest");
        var badBusinessRuleSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-business-rule-snapshot-private");
        var badBusinessArchitectureBaselineSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-business-architecture-baseline-snapshot-binding");
        var badBusinessArchitectureBaselineSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-business-architecture-baseline-snapshot-digest");
        var badBusinessArchitectureBaselineSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-business-architecture-baseline-snapshot-private");
        var badSystemSolutionArchitectureSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-system-solution-architecture-snapshot-binding");
        var badSystemSolutionArchitectureSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-system-solution-architecture-snapshot-digest");
        var badSystemSolutionArchitectureSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-system-solution-architecture-snapshot-private");
        var badBoundedContextSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-bounded-context-snapshot-binding");
        var badBoundedContextSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-bounded-context-snapshot-digest");
        var badBoundedContextSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-bounded-context-snapshot-private");
        var badSecurityPrivacySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-security-privacy-snapshot-binding");
        var badSecurityPrivacySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-security-privacy-snapshot-digest");
        var badSecurityPrivacySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-security-privacy-snapshot-private");
        var badProcessModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-process-model-snapshot-binding");
        var badProcessModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-process-model-snapshot-digest");
        var badProcessModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-process-model-snapshot-private");
        var badDataModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-data-model-snapshot-binding");
        var badDataModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-data-model-snapshot-digest");
        var badDataModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-data-model-snapshot-private");
        var badAuthorizationModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-authorization-model-snapshot-binding");
        var badAuthorizationModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-authorization-model-snapshot-digest");
        var badAuthorizationModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-authorization-model-snapshot-private");
        var badEventIntegrationModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-event-integration-model-snapshot-binding");
        var badEventIntegrationModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-event-integration-model-snapshot-digest");
        var badEventIntegrationModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-event-integration-model-snapshot-private");
        var badFailureRecoveryModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-failure-recovery-model-snapshot-binding");
        var badFailureRecoveryModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-failure-recovery-model-snapshot-digest");
        var badFailureRecoveryModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-failure-recovery-model-snapshot-private");
        var badArchitectureChallengeSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-architecture-challenge-snapshot-binding");
        var badArchitectureChallengeSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-architecture-challenge-snapshot-digest");
        var badArchitectureChallengeSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-architecture-challenge-snapshot-private");
        var badDecisionRegisterSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-decision-register-snapshot-binding");
        var badDecisionRegisterSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-decision-register-snapshot-digest");
        var badDecisionRegisterSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-decision-register-snapshot-private");
        var badRiskRegisterSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-risk-register-snapshot-binding");
        var badRiskRegisterSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-risk-register-snapshot-digest");
        var badRiskRegisterSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-risk-register-snapshot-private");
        var badEvidenceRegistrySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-evidence-registry-snapshot-binding");
        var badEvidenceRegistrySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-evidence-registry-snapshot-digest");
        var badEvidenceRegistrySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-evidence-registry-snapshot-private");
        var badTraceabilitySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-traceability-snapshot-binding");
        var badTraceabilitySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-traceability-snapshot-digest");
        var badTraceabilitySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-traceability-snapshot-private");
        var badReadinessGateSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-readiness-gate-snapshot-binding");
        var badReadinessGateSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-readiness-gate-snapshot-digest");
        var badReadinessGateSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-readiness-gate-snapshot-private");
        var badP5HandoffSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-p5-handoff-snapshot-binding");
        var badP5HandoffSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-p5-handoff-snapshot-digest");
        var badP5HandoffSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-p5-handoff-snapshot-private");
        var badDesignApplicabilitySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-design-applicability-snapshot-binding");
        var badDesignApplicabilitySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-design-applicability-snapshot-digest");
        var badDesignApplicabilitySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-design-applicability-snapshot-private");
        var badDesignPersonaRoleSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-design-persona-role-snapshot-binding");
        var badDesignPersonaRoleSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-design-persona-role-snapshot-digest");
        var badDesignPersonaRoleSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-design-persona-role-snapshot-private");
        var badUserJourneySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-user-journey-snapshot-binding");
        var badUserJourneySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-user-journey-snapshot-digest");
        var badUserJourneySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-user-journey-snapshot-private");
        var badInformationArchitectureSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-information-architecture-snapshot-binding");
        var badInformationArchitectureSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-information-architecture-snapshot-digest");
        var badInformationArchitectureSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-information-architecture-snapshot-private");
        var badScreenStateInventorySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-screen-state-inventory-snapshot-binding");
        var badScreenStateInventorySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-screen-state-inventory-snapshot-digest");
        var badScreenStateInventorySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-screen-state-inventory-snapshot-private");
        var badDesignRequirementsSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-design-requirements-snapshot-binding");
        var badDesignRequirementsSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-design-requirements-snapshot-digest");
        var badDesignRequirementsSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-design-requirements-snapshot-private");
        var badBacklogHierarchySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-backlog-hierarchy-snapshot-binding");
        var badBacklogHierarchySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-backlog-hierarchy-snapshot-digest");
        var badBacklogHierarchySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-backlog-hierarchy-snapshot-private");
        var badMvpSliceSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-mvp-slice-snapshot-binding");
        var badMvpSliceSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-mvp-slice-snapshot-digest");
        var badMvpSliceSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-mvp-slice-snapshot-private");
        var badMvpSliceHierarchyBindingRoot = Path.Combine(temporaryRoot, "bad-mvp-slice-hierarchy-binding");
        var badPrioritizationSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-prioritization-snapshot-binding");
        var badPrioritizationSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-prioritization-snapshot-digest");
        var badPrioritizationSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-prioritization-snapshot-private");
        var badPrioritizationMvpBindingRoot = Path.Combine(temporaryRoot, "bad-prioritization-mvp-binding");
        var badAcceptanceCriteriaSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-acceptance-criteria-snapshot-binding");
        var badAcceptanceCriteriaSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-acceptance-criteria-snapshot-digest");
        var badAcceptanceCriteriaSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-acceptance-criteria-snapshot-private");
        var badAcceptanceCriteriaHierarchyBindingRoot = Path.Combine(temporaryRoot, "bad-acceptance-criteria-hierarchy-binding");
        var badAcceptanceCriteriaMvpBindingRoot = Path.Combine(temporaryRoot, "bad-acceptance-criteria-mvp-binding");
        var badAcceptanceCriteriaPrioritizationBindingRoot = Path.Combine(temporaryRoot, "bad-acceptance-criteria-prioritization-binding");
        var badDefinitionOfReadySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-snapshot-binding");
        var badDefinitionOfReadySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-snapshot-digest");
        var badDefinitionOfReadySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-snapshot-private");
        var badDefinitionOfReadyHierarchyBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-hierarchy-binding");
        var badDefinitionOfReadyMvpBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-mvp-binding");
        var badDefinitionOfReadyPrioritizationBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-prioritization-binding");
        var badDefinitionOfReadyCriteriaBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-ready-criteria-binding");
        var badDefinitionOfDoneSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-snapshot-binding");
        var badDefinitionOfDoneSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-snapshot-digest");
        var badDefinitionOfDoneSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-snapshot-private");
        var badDefinitionOfDoneHierarchyBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-hierarchy-binding");
        var badDefinitionOfDoneMvpBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-mvp-binding");
        var badDefinitionOfDonePrioritizationBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-prioritization-binding");
        var badDefinitionOfDoneCriteriaBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-criteria-binding");
        var badDefinitionOfDoneReadyBindingRoot = Path.Combine(temporaryRoot, "bad-definition-of-done-ready-binding");
        var badImplementationUnitModelSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-snapshot-binding");
        var badImplementationUnitModelSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-snapshot-digest");
        var badImplementationUnitModelSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-snapshot-private");
        var badImplementationUnitModelHierarchyBindingRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-hierarchy-binding");
        var badImplementationUnitModelMvpBindingRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-mvp-binding");
        var badImplementationUnitModelCriteriaBindingRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-criteria-binding");
        var badImplementationUnitModelReadyBindingRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-ready-binding");
        var badImplementationUnitModelDoneBindingRoot = Path.Combine(temporaryRoot, "bad-implementation-unit-model-done-binding");
        var badDependencyMappingSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-dependency-mapping-snapshot-binding");
        var badDependencyMappingSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-dependency-mapping-snapshot-digest");
        var badDependencyMappingSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-dependency-mapping-snapshot-private");
        var badDependencyMappingHierarchyBindingRoot = Path.Combine(temporaryRoot, "bad-dependency-mapping-hierarchy-binding");
        var badDependencyMappingMvpBindingRoot = Path.Combine(temporaryRoot, "bad-dependency-mapping-mvp-binding");
        var badDependencyMappingUnitModelBindingRoot = Path.Combine(temporaryRoot, "bad-dependency-mapping-unit-model-binding");
        var badTechnologyProfileSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-technology-profile-snapshot-binding");
        var badTechnologyProfileSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-technology-profile-snapshot-digest");
        var badTechnologyProfileSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-technology-profile-snapshot-private");
        var badTechnologyProfileUnitModelBindingRoot = Path.Combine(temporaryRoot, "bad-technology-profile-unit-model-binding");
        var badTechnologyProfileDependencyMappingBindingRoot = Path.Combine(temporaryRoot, "bad-technology-profile-dependency-mapping-binding");
        var badBoilerplateRegistrySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-registry-snapshot-binding");
        var badBoilerplateRegistrySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-boilerplate-registry-snapshot-digest");
        var badBoilerplateRegistrySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-boilerplate-registry-snapshot-private");
        var badBoilerplateRegistryUnitModelBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-registry-unit-model-binding");
        var badBoilerplateRegistryTechnologyProfileBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-registry-technology-profile-binding");
        var badBoilerplateSelectionBindingSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-snapshot-binding");
        var badBoilerplateSelectionBindingSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-snapshot-digest");
        var badBoilerplateSelectionBindingSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-snapshot-private");
        var badBoilerplateSelectionBindingUnitModelBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-unit-model-binding");
        var badBoilerplateSelectionBindingDependencyMappingBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-dependency-mapping-binding");
        var badBoilerplateSelectionBindingTechnologyProfileBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-technology-profile-binding");
        var badBoilerplateSelectionBindingRegistryBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-selection-binding-registry-binding");
        var badBoilerplateCompatibilityValidationSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-snapshot-binding");
        var badBoilerplateCompatibilityValidationSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-snapshot-digest");
        var badBoilerplateCompatibilityValidationSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-snapshot-private");
        var badBoilerplateCompatibilityValidationUnitModelBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-unit-model-binding");
        var badBoilerplateCompatibilityValidationDependencyMappingBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-dependency-mapping-binding");
        var badBoilerplateCompatibilityValidationTechnologyProfileBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-technology-profile-binding");
        var badBoilerplateCompatibilityValidationRegistryBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-registry-binding");
        var badBoilerplateCompatibilityValidationSelectionBindingRoot = Path.Combine(temporaryRoot, "bad-boilerplate-compatibility-validation-selection-binding");
        var badDesignSystemTokenContractSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-design-system-token-contract-snapshot-binding");
        var badDesignSystemTokenContractSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-design-system-token-contract-snapshot-digest");
        var badDesignSystemTokenContractSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-design-system-token-contract-snapshot-private");
        var badAccessibilityDesignRulesSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-accessibility-design-rules-snapshot-binding");
        var badAccessibilityDesignRulesSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-accessibility-design-rules-snapshot-digest");
        var badAccessibilityDesignRulesSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-accessibility-design-rules-snapshot-private");
        var badResponsiveMultiPlatformTargetsSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-responsive-multi-platform-targets-snapshot-binding");
        var badResponsiveMultiPlatformTargetsSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-responsive-multi-platform-targets-snapshot-digest");
        var badResponsiveMultiPlatformTargetsSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-responsive-multi-platform-targets-snapshot-private");
        var badManualFigmaExecutionPathSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-manual-figma-execution-path-snapshot-binding");
        var badManualFigmaExecutionPathSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-manual-figma-execution-path-snapshot-digest");
        var badManualFigmaExecutionPathSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-manual-figma-execution-path-snapshot-private");
        var badFigmaMcpCapabilityDiscoverySnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-figma-mcp-capability-discovery-snapshot-binding");
        var badFigmaMcpCapabilityDiscoverySnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-figma-mcp-capability-discovery-snapshot-digest");
        var badFigmaMcpCapabilityDiscoverySnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-figma-mcp-capability-discovery-snapshot-private");
        var badFigmaReadSnapshotBindingRoot = Path.Combine(temporaryRoot, "bad-figma-read-snapshot-binding");
        var badFigmaReadSnapshotDigestRoot = Path.Combine(temporaryRoot, "bad-figma-read-snapshot-digest");
        var badFigmaReadSnapshotPrivateRoot = Path.Combine(temporaryRoot, "bad-figma-read-snapshot-private");
        var badFigmaContextImportBindingRoot = Path.Combine(temporaryRoot, "bad-figma-context-import-binding");
        var badFigmaContextImportDigestRoot = Path.Combine(temporaryRoot, "bad-figma-context-import-digest");
        var badFigmaContextImportPrivateRoot = Path.Combine(temporaryRoot, "bad-figma-context-import-private");
        var badOutboundDesignBriefPackageBindingRoot = Path.Combine(temporaryRoot, "bad-outbound-design-brief-package-binding");
        var badOutboundDesignBriefPackageDigestRoot = Path.Combine(temporaryRoot, "bad-outbound-design-brief-package-digest");
        var badOutboundDesignBriefPackagePrivateRoot = Path.Combine(temporaryRoot, "bad-outbound-design-brief-package-private");
        var badGovernedFigmaWriteBindingRoot = Path.Combine(temporaryRoot, "bad-governed-figma-write-binding");
        var badGovernedFigmaWriteDigestRoot = Path.Combine(temporaryRoot, "bad-governed-figma-write-digest");
        var badGovernedFigmaWritePrivateRoot = Path.Combine(temporaryRoot, "bad-governed-figma-write-private");
        var badFinalizedFigmaSnapshotImportBindingRoot = Path.Combine(temporaryRoot, "bad-finalized-figma-snapshot-import-binding");
        var badFinalizedFigmaSnapshotImportDigestRoot = Path.Combine(temporaryRoot, "bad-finalized-figma-snapshot-import-digest");
        var badFinalizedFigmaSnapshotImportPrivateRoot = Path.Combine(temporaryRoot, "bad-finalized-figma-snapshot-import-private");
        var badDesignToRequirementBindingBindingRoot = Path.Combine(temporaryRoot, "bad-design-to-requirement-binding-binding");
        var badDesignToRequirementBindingDigestRoot = Path.Combine(temporaryRoot, "bad-design-to-requirement-binding-digest");
        var badDesignToRequirementBindingPrivateRoot = Path.Combine(temporaryRoot, "bad-design-to-requirement-binding-private");
        var badDesignerReadyGateBindingRoot = Path.Combine(temporaryRoot, "bad-designer-ready-gate-binding");
        var badDesignerReadyGateDigestRoot = Path.Combine(temporaryRoot, "bad-designer-ready-gate-digest");
        var badDesignerReadyGatePrivateRoot = Path.Combine(temporaryRoot, "bad-designer-ready-gate-private");
        var badDesignDeltaBindingRoot = Path.Combine(temporaryRoot, "bad-design-delta-binding");
        var badDesignDeltaDigestRoot = Path.Combine(temporaryRoot, "bad-design-delta-digest");
        var badDesignDeltaPrivateRoot = Path.Combine(temporaryRoot, "bad-design-delta-private");
        var badDesignConflictResolutionBindingRoot = Path.Combine(temporaryRoot, "bad-design-conflict-resolution-binding");
        var badDesignConflictResolutionDigestRoot = Path.Combine(temporaryRoot, "bad-design-conflict-resolution-digest");
        var badDesignConflictResolutionPrivateRoot = Path.Combine(temporaryRoot, "bad-design-conflict-resolution-private");
        var badHumanDesignApprovalBindingRoot = Path.Combine(temporaryRoot, "bad-human-design-approval-binding");
        var badHumanDesignApprovalDigestRoot = Path.Combine(temporaryRoot, "bad-human-design-approval-digest");
        var badHumanDesignApprovalPrivateRoot = Path.Combine(temporaryRoot, "bad-human-design-approval-private");
        var badDesignBaselineBindingRoot = Path.Combine(temporaryRoot, "bad-design-baseline-binding");
        var badDesignBaselineDigestRoot = Path.Combine(temporaryRoot, "bad-design-baseline-digest");
        var badDesignBaselinePrivateRoot = Path.Combine(temporaryRoot, "bad-design-baseline-private");
        var badDesignDriftBindingRoot = Path.Combine(temporaryRoot, "bad-design-drift-binding");
        var badDesignDriftDigestRoot = Path.Combine(temporaryRoot, "bad-design-drift-digest");
        var badDesignDriftPrivateRoot = Path.Combine(temporaryRoot, "bad-design-drift-private");
        var badRunsRoot = Path.Combine(temporaryRoot, "bad-runs");
        var badHandoffRoot = Path.Combine(temporaryRoot, "bad-handoff");
        var badHandoffBindingRoot = Path.Combine(temporaryRoot, "bad-handoff-binding");
        var badDashboardBindingRoot = Path.Combine(temporaryRoot, "bad-dashboard-binding");
        var badDashboardApplicabilityRoot = Path.Combine(temporaryRoot, "bad-dashboard-applicability");
        var badDashboardEvidenceCuesRoot = Path.Combine(temporaryRoot, "bad-dashboard-evidence-cues");
        var badDashboardDigestRoot = Path.Combine(temporaryRoot, "bad-dashboard-digest");
        var badDashboardPrivateRoot = Path.Combine(temporaryRoot, "bad-dashboard-private");
        var badPhase2DashboardDigestRoot = Path.Combine(temporaryRoot, "bad-phase2-dashboard-digest");
        var badPhase2DashboardPrivateRoot = Path.Combine(temporaryRoot, "bad-phase2-dashboard-private");
        var badPhase2DashboardCatalogRoot = Path.Combine(temporaryRoot, "bad-phase2-dashboard-catalog");
        var badPhase2IntegratedBindingRoot = Path.Combine(temporaryRoot, "bad-phase2-integrated-binding");
        var badPhase2IntegratedDigestRoot = Path.Combine(temporaryRoot, "bad-phase2-integrated-digest");
        var badPhase2IntegratedPrivateRoot = Path.Combine(temporaryRoot, "bad-phase2-integrated-private");
        var badChangeCatalogBindingRoot = Path.Combine(temporaryRoot, "bad-change-catalog-binding");
        var badChangeCatalogDigestRoot = Path.Combine(temporaryRoot, "bad-change-catalog-digest");
        var badChangeCatalogPrivateRoot = Path.Combine(temporaryRoot, "bad-change-catalog-private");
        var badChangeImpactBindingRoot = Path.Combine(temporaryRoot, "bad-change-impact-binding");
        var badChangeImpactCountRoot = Path.Combine(temporaryRoot, "bad-change-impact-count");
        var badChangeImpactFreshnessRoot = Path.Combine(temporaryRoot, "bad-change-impact-freshness");
        var badChangeImpactEvidenceCuesRoot = Path.Combine(temporaryRoot, "bad-change-impact-evidence-cues");
        var badChangeImpactDigestRoot = Path.Combine(temporaryRoot, "bad-change-impact-digest");
        var badChangeImpactPrivateRoot = Path.Combine(temporaryRoot, "bad-change-impact-private");
        var badAgentModelBindingRoot = Path.Combine(temporaryRoot, "bad-agent-model-binding");
        var badAgentModelCountRoot = Path.Combine(temporaryRoot, "bad-agent-model-count");
        var badAgentModelFreshnessRoot = Path.Combine(temporaryRoot, "bad-agent-model-freshness");
        var badAgentModelMetricsRoot = Path.Combine(temporaryRoot, "bad-agent-model-metrics");
        var badAgentModelEvidenceCuesRoot = Path.Combine(temporaryRoot, "bad-agent-model-evidence-cues");
        var badAgentModelDigestRoot = Path.Combine(temporaryRoot, "bad-agent-model-digest");
        var badAgentModelPrivateRoot = Path.Combine(temporaryRoot, "bad-agent-model-private");
        var badPhase1AgentModelCountRoot = Path.Combine(temporaryRoot, "bad-phase1-agent-model-count");
        var badPhase1AgentModelDigestRoot = Path.Combine(temporaryRoot, "bad-phase1-agent-model-digest");
        var badPhase1AgentModelPrivateRoot = Path.Combine(temporaryRoot, "bad-phase1-agent-model-private");
        var badManagedPreviewRoot = Path.Combine(temporaryRoot, "bad-managed-preview");
        var badManagedCriterionRoot = Path.Combine(temporaryRoot, "bad-managed-criterion");
        var badManagedDigestRoot = Path.Combine(temporaryRoot, "bad-managed-digest");
        var badManagedReceiptRoot = Path.Combine(temporaryRoot, "bad-managed-receipt");
        var badManagedBindingRoot = Path.Combine(temporaryRoot, "bad-managed-binding");
        var badManagedEvidencePageRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-page");
        var badManagedEvidenceCountRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-count");
        var badManagedEvidenceSnapshotRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-snapshot");
        var badManagedEvidenceTotalRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-total");
        var badManagedEvidenceDetailRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-detail");
        var badManagedEvidenceBindingRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-binding");
        var badManagedEvidenceApplyBindingRoot = Path.Combine(temporaryRoot, "bad-managed-evidence-apply-binding");
        var badManagedReviewDigestRoot = Path.Combine(temporaryRoot, "bad-managed-review-digest");
        var badManagedReviewPrivateRoot = Path.Combine(temporaryRoot, "bad-managed-review-private");
        var badManagedReviewBindingRoot = Path.Combine(temporaryRoot, "bad-managed-review-binding");
        var badManagedReviewPathRoot = Path.Combine(temporaryRoot, "bad-managed-review-path");
        var badManagedReviewMetadataRoot = Path.Combine(temporaryRoot, "bad-managed-review-metadata");
        var badManagedTransitionDigestRoot = Path.Combine(temporaryRoot, "bad-managed-transition-digest");
        var badManagedTransitionPrivateRoot = Path.Combine(temporaryRoot, "bad-managed-transition-private");
        var staleManagedReviewRoot = Path.Combine(temporaryRoot, "stale-managed-review");
        Directory.CreateDirectory(bundleRoot);
        Directory.CreateDirectory(invalidSourceRoot);
        Directory.CreateDirectory(badReadinessRoot);
        Directory.CreateDirectory(badSelectionRoot);
        Directory.CreateDirectory(badInitiativePrivateRoot);
        Directory.CreateDirectory(badInitiativeAssessmentAuthorityRoot);
        Directory.CreateDirectory(badInitiativeAssessmentBindingRoot);
        Directory.CreateDirectory(badInitiativeAssessmentPolicyRoot);
        Directory.CreateDirectory(badInitiativeAssessmentCoverageRoot);
        Directory.CreateDirectory(badInitiativeClassificationBindingRoot);
        Directory.CreateDirectory(badInitiativeApplicabilityBindingRoot);
        Directory.CreateDirectory(badSourceSnapshotBindingRoot);
        Directory.CreateDirectory(badSourceSnapshotDigestRoot);
        Directory.CreateDirectory(badSourceSnapshotPrivateRoot);
        Directory.CreateDirectory(badBusinessSnapshotBindingRoot);
        Directory.CreateDirectory(badBusinessSnapshotDigestRoot);
        Directory.CreateDirectory(badBusinessSnapshotPrivateRoot);
        Directory.CreateDirectory(badCapabilitySnapshotBindingRoot);
        Directory.CreateDirectory(badCapabilitySnapshotDigestRoot);
        Directory.CreateDirectory(badCapabilitySnapshotPrivateRoot);
        Directory.CreateDirectory(badValueStreamSnapshotBindingRoot);
        Directory.CreateDirectory(badValueStreamSnapshotDigestRoot);
        Directory.CreateDirectory(badValueStreamSnapshotPrivateRoot);
        Directory.CreateDirectory(badOperatingModelSnapshotBindingRoot);
        Directory.CreateDirectory(badOperatingModelSnapshotDigestRoot);
        Directory.CreateDirectory(badOperatingModelSnapshotPrivateRoot);
        Directory.CreateDirectory(badBusinessRuleSnapshotBindingRoot);
        Directory.CreateDirectory(badBusinessRuleSnapshotDigestRoot);
        Directory.CreateDirectory(badBusinessRuleSnapshotPrivateRoot);
        Directory.CreateDirectory(badBusinessArchitectureBaselineSnapshotBindingRoot);
        Directory.CreateDirectory(badBusinessArchitectureBaselineSnapshotDigestRoot);
        Directory.CreateDirectory(badBusinessArchitectureBaselineSnapshotPrivateRoot);
        Directory.CreateDirectory(badSystemSolutionArchitectureSnapshotBindingRoot);
        Directory.CreateDirectory(badSystemSolutionArchitectureSnapshotDigestRoot);
        Directory.CreateDirectory(badSystemSolutionArchitectureSnapshotPrivateRoot);
        Directory.CreateDirectory(badBoundedContextSnapshotBindingRoot);
        Directory.CreateDirectory(badBoundedContextSnapshotDigestRoot);
        Directory.CreateDirectory(badBoundedContextSnapshotPrivateRoot);
        Directory.CreateDirectory(badSecurityPrivacySnapshotBindingRoot);
        Directory.CreateDirectory(badSecurityPrivacySnapshotDigestRoot);
        Directory.CreateDirectory(badSecurityPrivacySnapshotPrivateRoot);
        Directory.CreateDirectory(badProcessModelSnapshotBindingRoot);
        Directory.CreateDirectory(badProcessModelSnapshotDigestRoot);
        Directory.CreateDirectory(badProcessModelSnapshotPrivateRoot);
        Directory.CreateDirectory(badDataModelSnapshotBindingRoot);
        Directory.CreateDirectory(badDataModelSnapshotDigestRoot);
        Directory.CreateDirectory(badDataModelSnapshotPrivateRoot);
        Directory.CreateDirectory(badAuthorizationModelSnapshotBindingRoot);
        Directory.CreateDirectory(badAuthorizationModelSnapshotDigestRoot);
        Directory.CreateDirectory(badAuthorizationModelSnapshotPrivateRoot);
        Directory.CreateDirectory(badEventIntegrationModelSnapshotBindingRoot);
        Directory.CreateDirectory(badEventIntegrationModelSnapshotDigestRoot);
        Directory.CreateDirectory(badEventIntegrationModelSnapshotPrivateRoot);
        Directory.CreateDirectory(badFailureRecoveryModelSnapshotBindingRoot);
        Directory.CreateDirectory(badFailureRecoveryModelSnapshotDigestRoot);
        Directory.CreateDirectory(badFailureRecoveryModelSnapshotPrivateRoot);
        Directory.CreateDirectory(badArchitectureChallengeSnapshotBindingRoot);
        Directory.CreateDirectory(badArchitectureChallengeSnapshotDigestRoot);
        Directory.CreateDirectory(badArchitectureChallengeSnapshotPrivateRoot);
        Directory.CreateDirectory(badDecisionRegisterSnapshotBindingRoot);
        Directory.CreateDirectory(badDecisionRegisterSnapshotDigestRoot);
        Directory.CreateDirectory(badDecisionRegisterSnapshotPrivateRoot);
        Directory.CreateDirectory(badRiskRegisterSnapshotBindingRoot);
        Directory.CreateDirectory(badRiskRegisterSnapshotDigestRoot);
        Directory.CreateDirectory(badRiskRegisterSnapshotPrivateRoot);
        Directory.CreateDirectory(badEvidenceRegistrySnapshotBindingRoot);
        Directory.CreateDirectory(badEvidenceRegistrySnapshotDigestRoot);
        Directory.CreateDirectory(badEvidenceRegistrySnapshotPrivateRoot);
        Directory.CreateDirectory(badTraceabilitySnapshotBindingRoot);
        Directory.CreateDirectory(badTraceabilitySnapshotDigestRoot);
        Directory.CreateDirectory(badTraceabilitySnapshotPrivateRoot);
        Directory.CreateDirectory(badReadinessGateSnapshotBindingRoot);
        Directory.CreateDirectory(badReadinessGateSnapshotDigestRoot);
        Directory.CreateDirectory(badReadinessGateSnapshotPrivateRoot);
        Directory.CreateDirectory(badP5HandoffSnapshotBindingRoot);
        Directory.CreateDirectory(badP5HandoffSnapshotDigestRoot);
        Directory.CreateDirectory(badP5HandoffSnapshotPrivateRoot);
        Directory.CreateDirectory(badDesignApplicabilitySnapshotBindingRoot);
        Directory.CreateDirectory(badDesignApplicabilitySnapshotDigestRoot);
        Directory.CreateDirectory(badDesignApplicabilitySnapshotPrivateRoot);
        Directory.CreateDirectory(badDesignPersonaRoleSnapshotBindingRoot);
        Directory.CreateDirectory(badDesignPersonaRoleSnapshotDigestRoot);
        Directory.CreateDirectory(badDesignPersonaRoleSnapshotPrivateRoot);
        Directory.CreateDirectory(badUserJourneySnapshotBindingRoot);
        Directory.CreateDirectory(badUserJourneySnapshotDigestRoot);
        Directory.CreateDirectory(badUserJourneySnapshotPrivateRoot);
        Directory.CreateDirectory(badInformationArchitectureSnapshotBindingRoot);
        Directory.CreateDirectory(badInformationArchitectureSnapshotDigestRoot);
        Directory.CreateDirectory(badInformationArchitectureSnapshotPrivateRoot);
        Directory.CreateDirectory(badScreenStateInventorySnapshotBindingRoot);
        Directory.CreateDirectory(badScreenStateInventorySnapshotDigestRoot);
        Directory.CreateDirectory(badScreenStateInventorySnapshotPrivateRoot);
        Directory.CreateDirectory(badDesignRequirementsSnapshotBindingRoot);
        Directory.CreateDirectory(badDesignRequirementsSnapshotDigestRoot);
        Directory.CreateDirectory(badDesignRequirementsSnapshotPrivateRoot);
        Directory.CreateDirectory(badBacklogHierarchySnapshotBindingRoot);
        Directory.CreateDirectory(badBacklogHierarchySnapshotDigestRoot);
        Directory.CreateDirectory(badBacklogHierarchySnapshotPrivateRoot);
        Directory.CreateDirectory(badMvpSliceSnapshotBindingRoot);
        Directory.CreateDirectory(badMvpSliceSnapshotDigestRoot);
        Directory.CreateDirectory(badMvpSliceSnapshotPrivateRoot);
        Directory.CreateDirectory(badMvpSliceHierarchyBindingRoot);
        Directory.CreateDirectory(badPrioritizationSnapshotBindingRoot);
        Directory.CreateDirectory(badPrioritizationSnapshotDigestRoot);
        Directory.CreateDirectory(badPrioritizationSnapshotPrivateRoot);
        Directory.CreateDirectory(badPrioritizationMvpBindingRoot);
        Directory.CreateDirectory(badDesignSystemTokenContractSnapshotBindingRoot);
        Directory.CreateDirectory(badDesignSystemTokenContractSnapshotDigestRoot);
        Directory.CreateDirectory(badDesignSystemTokenContractSnapshotPrivateRoot);
        Directory.CreateDirectory(badAccessibilityDesignRulesSnapshotBindingRoot);
        Directory.CreateDirectory(badAccessibilityDesignRulesSnapshotDigestRoot);
        Directory.CreateDirectory(badAccessibilityDesignRulesSnapshotPrivateRoot);
        Directory.CreateDirectory(badResponsiveMultiPlatformTargetsSnapshotBindingRoot);
        Directory.CreateDirectory(badResponsiveMultiPlatformTargetsSnapshotDigestRoot);
        Directory.CreateDirectory(badResponsiveMultiPlatformTargetsSnapshotPrivateRoot);
        Directory.CreateDirectory(badManualFigmaExecutionPathSnapshotBindingRoot);
        Directory.CreateDirectory(badManualFigmaExecutionPathSnapshotDigestRoot);
        Directory.CreateDirectory(badManualFigmaExecutionPathSnapshotPrivateRoot);
        Directory.CreateDirectory(badFigmaMcpCapabilityDiscoverySnapshotBindingRoot);
        Directory.CreateDirectory(badFigmaMcpCapabilityDiscoverySnapshotDigestRoot);
        Directory.CreateDirectory(badFigmaMcpCapabilityDiscoverySnapshotPrivateRoot);
        Directory.CreateDirectory(badFigmaReadSnapshotBindingRoot);
        Directory.CreateDirectory(badFigmaReadSnapshotDigestRoot);
        Directory.CreateDirectory(badFigmaReadSnapshotPrivateRoot);
        Directory.CreateDirectory(badFigmaContextImportBindingRoot);
        Directory.CreateDirectory(badFigmaContextImportDigestRoot);
        Directory.CreateDirectory(badFigmaContextImportPrivateRoot);
        Directory.CreateDirectory(badOutboundDesignBriefPackageBindingRoot);
        Directory.CreateDirectory(badOutboundDesignBriefPackageDigestRoot);
        Directory.CreateDirectory(badOutboundDesignBriefPackagePrivateRoot);
        Directory.CreateDirectory(badGovernedFigmaWriteBindingRoot);
        Directory.CreateDirectory(badGovernedFigmaWriteDigestRoot);
        Directory.CreateDirectory(badGovernedFigmaWritePrivateRoot);
        Directory.CreateDirectory(badFinalizedFigmaSnapshotImportBindingRoot);
        Directory.CreateDirectory(badFinalizedFigmaSnapshotImportDigestRoot);
        Directory.CreateDirectory(badFinalizedFigmaSnapshotImportPrivateRoot);
        Directory.CreateDirectory(badDesignToRequirementBindingBindingRoot);
        Directory.CreateDirectory(badDesignToRequirementBindingDigestRoot);
        Directory.CreateDirectory(badDesignToRequirementBindingPrivateRoot);
        Directory.CreateDirectory(badDesignerReadyGateBindingRoot);
        Directory.CreateDirectory(badDesignerReadyGateDigestRoot);
        Directory.CreateDirectory(badDesignerReadyGatePrivateRoot);
        Directory.CreateDirectory(badDesignDeltaBindingRoot);
        Directory.CreateDirectory(badDesignDeltaDigestRoot);
        Directory.CreateDirectory(badDesignDeltaPrivateRoot);
        Directory.CreateDirectory(badDesignConflictResolutionBindingRoot);
        Directory.CreateDirectory(badDesignConflictResolutionDigestRoot);
        Directory.CreateDirectory(badDesignConflictResolutionPrivateRoot);
        Directory.CreateDirectory(badHumanDesignApprovalBindingRoot);
        Directory.CreateDirectory(badHumanDesignApprovalDigestRoot);
        Directory.CreateDirectory(badHumanDesignApprovalPrivateRoot);
        Directory.CreateDirectory(badDesignBaselineBindingRoot);
        Directory.CreateDirectory(badDesignBaselineDigestRoot);
        Directory.CreateDirectory(badDesignBaselinePrivateRoot);
        Directory.CreateDirectory(badDesignDriftBindingRoot);
        Directory.CreateDirectory(badDesignDriftDigestRoot);
        Directory.CreateDirectory(badDesignDriftPrivateRoot);
        Directory.CreateDirectory(badRunsRoot);
        Directory.CreateDirectory(badHandoffRoot);
        Directory.CreateDirectory(badHandoffBindingRoot);
        Directory.CreateDirectory(badDashboardBindingRoot);
        Directory.CreateDirectory(badDashboardApplicabilityRoot);
        Directory.CreateDirectory(badDashboardEvidenceCuesRoot);
        Directory.CreateDirectory(badDashboardDigestRoot);
        Directory.CreateDirectory(badDashboardPrivateRoot);
        Directory.CreateDirectory(badPhase2DashboardDigestRoot);
        Directory.CreateDirectory(badPhase2DashboardPrivateRoot);
        Directory.CreateDirectory(badPhase2DashboardCatalogRoot);
        Directory.CreateDirectory(badPhase2IntegratedBindingRoot);
        Directory.CreateDirectory(badPhase2IntegratedDigestRoot);
        Directory.CreateDirectory(badPhase2IntegratedPrivateRoot);
        Directory.CreateDirectory(badChangeCatalogBindingRoot);
        Directory.CreateDirectory(badChangeCatalogDigestRoot);
        Directory.CreateDirectory(badChangeCatalogPrivateRoot);
        Directory.CreateDirectory(badChangeImpactBindingRoot);
        Directory.CreateDirectory(badChangeImpactCountRoot);
        Directory.CreateDirectory(badChangeImpactFreshnessRoot);
        Directory.CreateDirectory(badChangeImpactEvidenceCuesRoot);
        Directory.CreateDirectory(badChangeImpactDigestRoot);
        Directory.CreateDirectory(badChangeImpactPrivateRoot);
        Directory.CreateDirectory(badAgentModelBindingRoot);
        Directory.CreateDirectory(badAgentModelCountRoot);
        Directory.CreateDirectory(badAgentModelFreshnessRoot);
        Directory.CreateDirectory(badAgentModelMetricsRoot);
        Directory.CreateDirectory(badAgentModelEvidenceCuesRoot);
        Directory.CreateDirectory(badAgentModelDigestRoot);
        Directory.CreateDirectory(badAgentModelPrivateRoot);
        Directory.CreateDirectory(badPhase1AgentModelCountRoot);
        Directory.CreateDirectory(badPhase1AgentModelDigestRoot);
        Directory.CreateDirectory(badPhase1AgentModelPrivateRoot);
        Directory.CreateDirectory(badManagedPreviewRoot);
        Directory.CreateDirectory(badManagedCriterionRoot);
        Directory.CreateDirectory(badManagedDigestRoot);
        Directory.CreateDirectory(badManagedReceiptRoot);
        Directory.CreateDirectory(badManagedBindingRoot);
        Directory.CreateDirectory(badManagedEvidencePageRoot);
        Directory.CreateDirectory(badManagedEvidenceCountRoot);
        Directory.CreateDirectory(badManagedEvidenceSnapshotRoot);
        Directory.CreateDirectory(badManagedEvidenceTotalRoot);
        Directory.CreateDirectory(badManagedEvidenceDetailRoot);
        Directory.CreateDirectory(badManagedEvidenceBindingRoot);
        Directory.CreateDirectory(badManagedEvidenceApplyBindingRoot);
        Directory.CreateDirectory(badManagedReviewDigestRoot);
        Directory.CreateDirectory(badManagedReviewPrivateRoot);
        Directory.CreateDirectory(badManagedReviewBindingRoot);
        Directory.CreateDirectory(badManagedReviewPathRoot);
        Directory.CreateDirectory(badManagedReviewMetadataRoot);
        Directory.CreateDirectory(badManagedTransitionDigestRoot);
        Directory.CreateDirectory(badManagedTransitionPrivateRoot);
        Directory.CreateDirectory(staleManagedReviewRoot);
        var executable = Environment.ProcessPath;
        Check(executable is not null && File.Exists(executable), "Test app host executable is available");

        var safeEnvironment = VisualStudioEngineClientFactory.SafeEngineEnvironment(
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Path"] = "/safe/bin",
                ["pathext"] = ".EXE;.CMD",
                ["OPENAI_API_KEY"] = "private-openai-key",
                ["AWS_SECRET_ACCESS_KEY"] = "private-aws-secret",
                ["HOME"] = "/private/home",
            });
        Check(safeEnvironment["PATH"] == "/safe/bin" && safeEnvironment["PATHEXT"] == ".EXE;.CMD" &&
              safeEnvironment["GAEP_HOST_SURFACE"] == "visual-studio-product-studio" &&
              !safeEnvironment.ContainsKey("OPENAI_API_KEY") &&
              !safeEnvironment.ContainsKey("AWS_SECRET_ACCESS_KEY") &&
              !safeEnvironment.ContainsKey("HOME"),
            "Visual Studio engine environment preserves launch essentials and strips inherited provider authority");

        var accessibleFixture = AccessibleTableFixture();
        var sortedAccessible = AccessibleDashboardTables.View(
            accessibleFixture,
            sortKey: "state",
            sortDirection: AccessibleTableSortDirection.Ascending);
        Check(sortedAccessible.Rows.Select(row => row.Id).SequenceEqual(["row-c", "row-a", "row-b"]),
            "Accessible metadata tables sort deterministically with row-ID tie breaking");
        var filteredAccessible = AccessibleDashboardTables.View(
            accessibleFixture,
            filter: "PENDING",
            sortKey: "name",
            sortDirection: AccessibleTableSortDirection.Descending);
        Check(filteredAccessible.Rows.Select(row => row.Id).SequenceEqual(["row-b", "row-a"]),
            "Accessible metadata tables filter only visible cells before deterministic sorting");
        Expect<ArgumentOutOfRangeException>(
            () => AccessibleDashboardTables.View(accessibleFixture, filter: new string('x', 257)),
            "Accessible metadata filters reject more than 256 characters");
        Expect<ArgumentException>(
            () => AccessibleDashboardTables.View(
                accessibleFixture,
                sortKey: "hidden",
                sortDirection: AccessibleTableSortDirection.Ascending),
            "Accessible metadata sorts reject hidden columns");
        var formulaView = AccessibleDashboardTables.View(accessibleFixture, filter: "SUM");
        Check(AccessibleDashboardTables.Csv(formulaView) ==
              "\"Name\",\"State\"\r\n\"'=SUM(A1:A2)\",\"complete\"" &&
              !AccessibleDashboardTables.Csv(formulaView).Contains("Bravo", StringComparison.Ordinal) &&
              AccessibleDashboardTables.Render(formulaView).Contains(
                  "Showing 1 of 3 verified rows; 2 omitted upstream; source total 5.",
                  StringComparison.Ordinal),
            "Accessible metadata CSV contains only filtered visible rows, neutralizes formulas, and renders exact totals");
        Expect<ArgumentOutOfRangeException>(
            () => AccessibleDashboardTables.Exact(accessibleFixture with { Total = 4 }),
            "Accessible metadata tables reject unreconciled totals");
        Expect<ArgumentException>(
            () => AccessibleDashboardTables.Exact(accessibleFixture with
            {
                Rows = new[]
                {
                    new AccessibleTableRow("row-a", new Dictionary<string, string>
                    {
                        ["name"] = "Alpha",
                        ["state"] = "pending",
                        ["secret"] = "withheld",
                    }),
                },
                Total = 3,
                Omitted = 2,
            }),
            "Accessible metadata tables reject non-visible row fields");

        var packagedWorkspace = Path.Combine(temporaryRoot, "packaged-workspace");
        var packagedCache = Path.Combine(temporaryRoot, "packaged-cache");
        Directory.CreateDirectory(packagedWorkspace);
        var nodeExecutable = FindExecutable("node");
        var packageEnvironment = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["PATH"] = Environment.GetEnvironmentVariable("PATH") ?? string.Empty,
            ["GAEP_ENGINE_RUNTIME_EXECUTABLE"] = nodeExecutable,
            ["GAEP_ENGINE_RUNTIME_SHA256"] = Sha256File(nodeExecutable),
            ["OPENAI_API_KEY"] = "private-openai-key",
        };
        await ExpectAsync<ArgumentException>(
            () => Task.FromResult(VisualStudioEngineClientFactory.Create(
                packagedWorkspace,
                new Dictionary<string, string> { ["PATH"] = packageEnvironment["PATH"] },
                packagedCache)),
            "Package mode rejects a mutable PATH-only runtime lookup");
        await using (var packagedClient = VisualStudioEngineClientFactory.Create(
            packagedWorkspace,
            packageEnvironment,
            packagedCache))
        {
            var emptyEvidence = await packagedClient.ListManagedEvidenceAsync(offset: 0, limit: 100);
            Check(emptyEvidence.Offset == 0 && emptyEvidence.Limit == 100 && emptyEvidence.Total == 0 &&
                  emptyEvidence.Items.Count == 0 && !emptyEvidence.HasMore,
                "Embedded package engine executes a real empty managed-evidence request through the strict client");
        }
        Check(!Directory.Exists(Path.Combine(packagedWorkspace, ".gaep")),
            "Read-only packaged-engine evidence flow does not create workspace state");

        var materializedEngine = VisualStudioPackagedEngine.Materialize(packagedCache);
        var mismatchedRuntimeEnvironment = new Dictionary<string, string>(packageEnvironment, StringComparer.OrdinalIgnoreCase)
        {
            ["GAEP_ENGINE_RUNTIME_SHA256"] = new string('0', 64),
        };
        await using (var mismatchedRuntimeClient = VisualStudioEngineClientFactory.Create(
            packagedWorkspace,
            mismatchedRuntimeEnvironment,
            packagedCache))
        {
            var mismatch = await CaptureHostErrorAsync(() => mismatchedRuntimeClient.ListManagedEvidenceAsync());
            Check(mismatch.Kind == "HOST_UNAVAILABLE" &&
                  !mismatch.Message.Contains(nodeExecutable, StringComparison.Ordinal),
                "A mismatched absolute runtime identity fails closed without reflecting its local path");
        }
        await using (var mismatchedClient = new EngineClient(
            packagedWorkspace,
            nodeExecutable,
            Sha256File(nodeExecutable),
            materializedEngine with { ExpectedSha256 = new string('0', 64) },
            packageEnvironment))
        {
            var mismatch = await CaptureHostErrorAsync(() => mismatchedClient.ListManagedEvidenceAsync());
            Check(mismatch.Kind == "HOST_UNAVAILABLE" &&
                  !mismatch.Message.Contains(materializedEngine.Path, StringComparison.Ordinal),
                "A mismatched embedded module identity fails closed without reflecting its local path");
        }

        await using var client = new EngineClient(temporaryRoot, executable);
        var product = await client.ReadProductBindingAsync();
        var expectedProductDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        Check(product == new ProductBinding(ProductId, "Founder Product", 7, expectedProductDigest),
            "Typed Product binding returns exact identity, revision, and canonical digest while omitting unrelated fields");
        Check(!JsonSerializer.Serialize(product).Contains(PrivateRoot, StringComparison.Ordinal),
            "Typed Product binding does not expose unrelated private Product fields");

        var initiative = await client.ReadInitiativeAsync(InitiativeId);
        var initialAssessment = await client.AssessInitiativeEntryAsync(InitiativeId);
        Check(initiative.Revision == 3 && initiative.ProductId == ProductId && initiative.Classification is null &&
              initiative.Applicability is null && initialAssessment.InitiativeRevision == 3 &&
              initialAssessment.Classification.Status == "missing" &&
              initialAssessment.Classification.Completeness.Status == "missing" &&
              initialAssessment.Applicability.Status == "missing" &&
              initialAssessment.Applicability.Coverage.Status == "unavailable" &&
              initialAssessment.State == "attention-required",
            "Typed Initiative entry read preserves exact missing classification/applicability truth");
        var classificationInput = InitiativeClassificationFixture();
        await ExpectAsync<ArgumentException>(
            () => client.ClassifyInitiativeAsync(
                InitiativeId,
                initiative.Revision,
                classificationInput with { Sensitivities = ["none", "security"] },
                "founder.review"),
            "Initiative classification rejects contradictory sensitivities before transport");
        var classified = await client.ClassifyInitiativeAsync(
            InitiativeId,
            initiative.Revision,
            classificationInput,
            "founder.review");
        Check(classified.Revision == 4 && classified.Classification is not null &&
              classified.Classification.PrimaryType == "feature" &&
              classified.Classification.ProductRevision == product.Revision &&
              classified.Classification.ProductDigest == product.Digest &&
              classified.Classification.ClassifiedBy == "founder.review" && classified.Applicability is null,
            "Initiative classification response is bound to exact content, actor, Product, and next revision");
        var applicabilityInput = InitiativeApplicabilityFixture();
        var invalidDecision = applicabilityInput.Decisions.Single() with
        {
            Status = "conditionally-required",
            Conditions = Array.Empty<string>(),
        };
        await ExpectAsync<ArgumentException>(
            () => client.ResolveInitiativeApplicabilityAsync(
                InitiativeId,
                classified.Revision,
                applicabilityInput with { Decisions = [invalidDecision] },
                "founder.review"),
            "Initiative applicability rejects conditional decisions without conditions before transport");
        var resolved = await client.ResolveInitiativeApplicabilityAsync(
            InitiativeId,
            classified.Revision,
            applicabilityInput,
            "founder.review");
        Check(resolved.Revision == 5 && resolved.Applicability is not null &&
              resolved.Applicability.State == "current" && resolved.Applicability.InitiativeRevision == 5 &&
              resolved.Applicability.DecisionCount == 1 && resolved.Applicability.UnresolvedSubjectCount == 48 &&
              resolved.Applicability.EvaluatedBy == "founder.review" &&
              resolved.Applicability.SubjectCatalog == applicabilityInput.SubjectCatalog &&
              resolved.Applicability.ClassificationDigest == resolved.Classification?.Digest,
            "Initiative applicability response is bound to exact content, actor, classification, and next revision");
        var initiativeController = new ProductWorkflowController(client);
        var initiativeContext = await initiativeController.ReadInitiativeEntryContextAsync(InitiativeId);
        var initiativeOutput = ProductWorkflowController.RenderInitiativeEntry(initiativeContext);
        Check(initiativeContext.Assessment.State == "attention-required" &&
              initiativeContext.Assessment.Classification.Status == "current" &&
              initiativeContext.Assessment.Classification.Completeness.Status == "complete" &&
              initiativeContext.Assessment.Applicability.Status == "current" &&
              initiativeContext.Assessment.Applicability.Coverage.Status == "complete" &&
              initiativeContext.Assessment.Applicability.Coverage.CoveredSubjectCount == 49 &&
              initiativeContext.Assessment.Applicability.Coverage.MissingSubjectCount == 0 &&
              initiativeOutput.Contains("GAEP Initiative entry assessment", StringComparison.Ordinal) &&
              initiativeOutput.Contains("Classification completeness: complete", StringComparison.Ordinal) &&
              initiativeOutput.Contains("Canonical subject coverage: 49/49", StringComparison.Ordinal) &&
              initiativeOutput.Contains("grants no approval, readiness, not-applicable inference", StringComparison.Ordinal) &&
              !initiativeOutput.Contains("Private Initiative title", StringComparison.Ordinal) &&
              !initiativeOutput.Contains("founder.review", StringComparison.Ordinal) &&
              !initiativeOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !initiativeOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Initiative entry controller revalidates exact Product context and renders privacy-minimal no-authority truth");
        var nonCanonicalDecision = applicabilityInput.Decisions.Single() with
        {
            Subject = new InitiativeApplicabilitySubject(
                "activity",
                "non-canonical-review",
                "Non-canonical review"),
        };
        await ExpectAsync<ArgumentException>(
            () => client.ResolveInitiativeApplicabilityAsync(
                InitiativeId,
                resolved.Revision,
                applicabilityInput with { Decisions = [nonCanonicalDecision] },
                "founder.review"),
            "Initiative applicability rejects non-canonical subjects before transport");

        await using (var hostileClient = new EngineClient(badInitiativePrivateRoot, executable))
        {
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadInitiativeAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" && !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Initiative read rejects excess private response fields");
        }
        await using (var hostileClient = new EngineClient(badInitiativeAssessmentAuthorityRoot, executable))
        {
            var invalid = await CaptureHostErrorAsync(() =>
                new ProductWorkflowController(hostileClient).ReadInitiativeEntryContextAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID",
                "Initiative entry rejects forged assessment authority");
        }
        await using (var hostileClient = new EngineClient(badInitiativeAssessmentPolicyRoot, executable))
        {
            var invalid = await CaptureHostErrorAsync(() =>
                new ProductWorkflowController(hostileClient).ReadInitiativeEntryContextAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID",
                "Initiative entry rejects an assessment without exact classification policy truth");
        }
        await using (var hostileClient = new EngineClient(badInitiativeAssessmentCoverageRoot, executable))
        {
            var invalid = await CaptureHostErrorAsync(() =>
                new ProductWorkflowController(hostileClient).ReadInitiativeEntryContextAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID",
                "Initiative entry rejects an assessment without exact applicability coverage truth");
        }
        await using (var hostileClient = new EngineClient(badInitiativeAssessmentBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadInitiativeEntryContextAsync(InitiativeId),
                "Initiative entry rejects an assessment bound to a different Product digest");
        }
        await using (var hostileClient = new EngineClient(badInitiativeClassificationBindingRoot, executable))
        {
            var hostileInitiative = await hostileClient.ReadInitiativeAsync(InitiativeId);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ClassifyInitiativeAsync(
                InitiativeId,
                hostileInitiative.Revision,
                classificationInput,
                "founder.review"));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID",
                "Initiative classification rejects actor/content substitution");
        }
        await using (var hostileClient = new EngineClient(badInitiativeApplicabilityBindingRoot, executable))
        {
            var hostileInitiative = await hostileClient.ReadInitiativeAsync(InitiativeId);
            var hostileClassified = await hostileClient.ClassifyInitiativeAsync(
                InitiativeId,
                hostileInitiative.Revision,
                classificationInput,
                "founder.review");
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ResolveInitiativeApplicabilityAsync(
                InitiativeId,
                hostileClassified.Revision,
                applicabilityInput,
                "founder.review"));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID",
                "Initiative applicability rejects actor/content substitution");
        }

        var sourceProjection = await client.ReadSourceGovernanceAsync(InitiativeId);
        Check(sourceProjection.ProductId == product.Id &&
              sourceProjection.ProductRevision == product.Revision &&
              sourceProjection.ProductDigest == product.Digest &&
              sourceProjection.InitiativeId == resolved.Id &&
              sourceProjection.InitiativeRevision == resolved.Revision &&
              sourceProjection.InitiativeDigest == resolved.Digest &&
              sourceProjection.AssessmentState == "ready" &&
              sourceProjection.SourceCount == 1 &&
              sourceProjection.BaselineCount == 1 &&
              sourceProjection.ProvenanceCount == 1 &&
              sourceProjection.Sources.Single().SemanticAuthority == "authoritative · product requirements" &&
              sourceProjection.Baselines.Single().AssessmentStatus == "current" &&
              sourceProjection.Provenance.Single().TargetKind == "governed-record",
            "Typed Source governance preserves exact Product, Initiative, Source, candidate Baseline, and Provenance metadata");
        var sourceOutput = await initiativeController.ReadSourceGovernanceAsync(InitiativeId);
        Check(sourceOutput.Contains("GAEP Source governance", StringComparison.Ordinal) &&
              sourceOutput.Contains("1 Sources · 1 candidate Baselines · 1 Provenance records", StringComparison.Ordinal) &&
              sourceOutput.Contains("grants no Baseline designation, approval, readiness", StringComparison.Ordinal) &&
              !sourceOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !sourceOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Source governance workflow renders bounded private-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badSourceSnapshotDigestRoot, badSourceSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadSourceGovernanceAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Source governance rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badSourceSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadSourceGovernanceAsync(InitiativeId),
                "Source governance rejects a projection bound to a substituted Initiative digest");
        }

        var businessProjection = await client.ReadBusinessUnderstandingAsync(InitiativeId);
        Check(businessProjection.ProductId == product.Id &&
              businessProjection.ProductRevision == product.Revision &&
              businessProjection.ProductDigest == product.Digest &&
              businessProjection.InitiativeId == resolved.Id &&
              businessProjection.InitiativeRevision == resolved.Revision &&
              businessProjection.InitiativeDigest == resolved.Digest &&
              businessProjection.AssessmentState == "complete-for-review" &&
              businessProjection.BusinessUnderstanding?.ObjectiveCount == 3 &&
              businessProjection.StakeholderModel?.StakeholderCount == 8 &&
              businessProjection.OutcomeModel?.CountermetricCount == 1,
            "Typed Business Understanding preserves exact Product, Initiative, governed record, assessment, and count metadata");
        var businessOutput = await initiativeController.ReadBusinessUnderstandingAsync(InitiativeId);
        Check(businessOutput.Contains("GAEP governed Business Understanding", StringComparison.Ordinal) &&
              businessOutput.Contains("3 objectives · 2 constraints · 1 assumptions", StringComparison.Ordinal) &&
              businessOutput.Contains(
                  "grants no approval, appointment, decision, readiness, or action authority",
                  StringComparison.Ordinal) &&
              !businessOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !businessOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !businessOutput.Contains("personalAssignment", StringComparison.Ordinal),
            "Business Understanding workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badBusinessSnapshotDigestRoot, badBusinessSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBusinessUnderstandingAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Business Understanding rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badBusinessSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBusinessUnderstandingAsync(InitiativeId),
                "Business Understanding rejects a projection rebound to a substituted Product revision");
        }

        var capabilityProjection = await client.ReadBusinessCapabilityMapAsync(InitiativeId);
        Check(capabilityProjection.ProductId == product.Id &&
              capabilityProjection.ProductRevision == product.Revision &&
              capabilityProjection.ProductDigest == product.Digest &&
              capabilityProjection.InitiativeId == resolved.Id &&
              capabilityProjection.InitiativeRevision == resolved.Revision &&
              capabilityProjection.InitiativeDigest == resolved.Digest &&
              capabilityProjection.AssessmentState == "attention-required" &&
              capabilityProjection.CapabilityMap?.CapabilityCount == 7 &&
              capabilityProjection.CapabilityMap?.OwnedCapabilityCount == 6 &&
              capabilityProjection.CapabilityMap?.CriticalGapCount == 1,
            "Typed Business Capability Map preserves exact Product, Initiative, assessment, and count metadata");
        var capabilityOutput = await initiativeController.ReadBusinessCapabilityMapAsync(InitiativeId);
        Check(capabilityOutput.Contains("GAEP governed Business Capability Map", StringComparison.Ordinal) &&
              capabilityOutput.Contains("7 capabilities · 6 owned · 2 open gaps", StringComparison.Ordinal) &&
              capabilityOutput.Contains(
                  "grants no priority approval, baseline, readiness, or action authority",
                  StringComparison.Ordinal) &&
              !capabilityOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !capabilityOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !capabilityOutput.Contains("capabilityNarrative", StringComparison.Ordinal),
            "Business Capability Map workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badCapabilitySnapshotDigestRoot, badCapabilitySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBusinessCapabilityMapAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Business Capability Map rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badCapabilitySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBusinessCapabilityMapAsync(InitiativeId),
                "Business Capability Map rejects a projection rebound to a substituted Product revision");
        }

        var valueStreamProjection = await client.ReadValueStreamModelAsync(InitiativeId);
        Check(valueStreamProjection.ProductId == product.Id &&
              valueStreamProjection.ProductRevision == product.Revision &&
              valueStreamProjection.ProductDigest == product.Digest &&
              valueStreamProjection.InitiativeId == resolved.Id &&
              valueStreamProjection.InitiativeRevision == resolved.Revision &&
              valueStreamProjection.InitiativeDigest == resolved.Digest &&
              valueStreamProjection.AssessmentState == "attention-required" &&
              valueStreamProjection.ValueStreamModel?.ValueStreamCount == 3 &&
              valueStreamProjection.ValueStreamModel?.OwnedValueStreamCount == 2 &&
              valueStreamProjection.ValueStreamModel?.CriticalBottleneckCount == 1,
            "Typed Value Stream Model preserves exact Product, Initiative, assessment, and count metadata");
        var valueStreamOutput = await initiativeController.ReadValueStreamModelAsync(InitiativeId);
        Check(valueStreamOutput.Contains("GAEP governed Value Stream Model", StringComparison.Ordinal) &&
              valueStreamOutput.Contains("3 value streams · 2 owned · 9 stages", StringComparison.Ordinal) &&
              valueStreamOutput.Contains(
                  "grants no baseline, priority, readiness, or action authority",
                  StringComparison.Ordinal) &&
              !valueStreamOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !valueStreamOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !valueStreamOutput.Contains("valueStreamNarrative", StringComparison.Ordinal),
            "Value Stream Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badValueStreamSnapshotDigestRoot, badValueStreamSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadValueStreamModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Value Stream Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badValueStreamSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadValueStreamModelAsync(InitiativeId),
                "Value Stream Model rejects a projection rebound to a substituted Product revision");
        }

        var operatingProjection = await client.ReadOperatingModelAsync(InitiativeId);
        Check(operatingProjection.ProductId == product.Id &&
              operatingProjection.ProductRevision == product.Revision &&
              operatingProjection.ProductDigest == product.Digest &&
              operatingProjection.InitiativeId == resolved.Id &&
              operatingProjection.InitiativeRevision == resolved.Revision &&
              operatingProjection.InitiativeDigest == resolved.Digest &&
              operatingProjection.AssessmentState == "attention-required" &&
              operatingProjection.OperatingModel?.RoleCount == 6 &&
              operatingProjection.OperatingModel?.DecisionRightCount == 8 &&
              operatingProjection.UnfundedCapacityCount == 3,
            "Typed Operating Model preserves exact Product, Initiative, assessment, and structural metadata");
        var operatingOutput = await initiativeController.ReadOperatingModelAsync(InitiativeId);
        Check(operatingOutput.Contains("GAEP governed Operating Model", StringComparison.Ordinal) &&
              operatingOutput.Contains("6 roles · 2 governance systems · 8 decision rights", StringComparison.Ordinal) &&
              operatingOutput.Contains(
                  "grants no appointment, funding, baseline, readiness, or action authority",
                  StringComparison.Ordinal) &&
              !operatingOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !operatingOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !operatingOutput.Contains("operatingNarrative", StringComparison.Ordinal),
            "Operating Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badOperatingModelSnapshotDigestRoot, badOperatingModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadOperatingModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Operating Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badOperatingModelSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadOperatingModelAsync(InitiativeId),
                "Operating Model rejects a projection rebound to a substituted Product revision");
        }

        var businessRuleProjection = await client.ReadBusinessRuleCatalogAsync(InitiativeId);
        Check(businessRuleProjection.ProductId == product.Id &&
              businessRuleProjection.ProductRevision == product.Revision &&
              businessRuleProjection.ProductDigest == product.Digest &&
              businessRuleProjection.InitiativeId == resolved.Id &&
              businessRuleProjection.InitiativeRevision == resolved.Revision &&
              businessRuleProjection.InitiativeDigest == resolved.Digest &&
              businessRuleProjection.AssessmentState == "attention-required" &&
              businessRuleProjection.BusinessRuleCatalog?.RuleCount == 7 &&
              businessRuleProjection.BusinessRuleCatalog?.ExceptionCount == 2 &&
              businessRuleProjection.UnverifiedEnforcementTargetCount == 2,
            "Typed Business Rule Catalog preserves exact Product, Initiative, assessment, and candidate-rule metadata");
        var businessRuleOutput = await initiativeController.ReadBusinessRuleCatalogAsync(InitiativeId);
        Check(businessRuleOutput.Contains("GAEP governed Business Rule Catalog", StringComparison.Ordinal) &&
              businessRuleOutput.Contains("7 rules · 7 source-backed · 3 non-exceptionable", StringComparison.Ordinal) &&
              businessRuleOutput.Contains(
                  "does not evaluate policy, grant exceptions, deploy enforcement",
                  StringComparison.Ordinal) &&
              !businessRuleOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !businessRuleOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !businessRuleOutput.Contains("ruleNarrative", StringComparison.Ordinal),
            "Business Rule Catalog workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badBusinessRuleSnapshotDigestRoot, badBusinessRuleSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBusinessRuleCatalogAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Business Rule Catalog rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badBusinessRuleSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBusinessRuleCatalogAsync(InitiativeId),
                "Business Rule Catalog rejects a projection rebound to a substituted Product revision");
        }

        var businessArchitectureBaselineProjection = await client.ReadBusinessArchitectureBaselineAsync(InitiativeId);
        Check(businessArchitectureBaselineProjection.ProductId == product.Id &&
              businessArchitectureBaselineProjection.ProductRevision == product.Revision &&
              businessArchitectureBaselineProjection.ProductDigest == product.Digest &&
              businessArchitectureBaselineProjection.InitiativeId == resolved.Id &&
              businessArchitectureBaselineProjection.InitiativeRevision == resolved.Revision &&
              businessArchitectureBaselineProjection.InitiativeDigest == resolved.Digest &&
              businessArchitectureBaselineProjection.AssessmentState == "attention-required" &&
              businessArchitectureBaselineProjection.Baseline?.CoveredElementCount == 27 &&
              businessArchitectureBaselineProjection.Baseline?.IntegrationClaimCount == 8 &&
              businessArchitectureBaselineProjection.ConsistencyGapCount == 2,
            "Typed Business Architecture Baseline preserves exact Product, Initiative, assessment, and candidate metadata");
        var businessArchitectureBaselineOutput =
            await initiativeController.ReadBusinessArchitectureBaselineAsync(InitiativeId);
        Check(businessArchitectureBaselineOutput.Contains(
                  "GAEP governed Business Architecture Baseline candidate",
                  StringComparison.Ordinal) &&
              businessArchitectureBaselineOutput.Contains(
                  "27 covered · 25 included · 1 excluded · 1 unresolved",
                  StringComparison.Ordinal) &&
              businessArchitectureBaselineOutput.Contains(
                  "does not designate or approve a baseline, establish readiness",
                  StringComparison.Ordinal) &&
              !businessArchitectureBaselineOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !businessArchitectureBaselineOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !businessArchitectureBaselineOutput.Contains("architectureNarrative", StringComparison.Ordinal),
            "Business Architecture Baseline workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[]
                 {
                     badBusinessArchitectureBaselineSnapshotDigestRoot,
                     badBusinessArchitectureBaselineSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(
                () => hostileClient.ReadBusinessArchitectureBaselineAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Business Architecture Baseline rejects hostile digest and private-field drift");
        }

        var definitionOfReadyProjection = await client.ReadDefinitionOfReadyAsync(InitiativeId);
        Check(definitionOfReadyProjection.ProductId == product.Id &&
              definitionOfReadyProjection.ProductRevision == product.Revision &&
              definitionOfReadyProjection.ProductDigest == product.Digest &&
              definitionOfReadyProjection.InitiativeId == resolved.Id &&
              definitionOfReadyProjection.InitiativeRevision == resolved.Revision &&
              definitionOfReadyProjection.InitiativeDigest == resolved.Digest &&
              definitionOfReadyProjection.Result == "attention-required" &&
              definitionOfReadyProjection.ReviewState == "held" &&
              definitionOfReadyProjection.SubjectCount == 16 &&
              definitionOfReadyProjection.PolicyEntryCount == 9 &&
              definitionOfReadyProjection.ExpectedEvaluationCount == 144 &&
              definitionOfReadyProjection.EvaluationCount == 140 &&
              definitionOfReadyProjection.CandidateSatisfiedCount == 130 &&
              definitionOfReadyProjection.NotApplicableCount == 12 &&
              definitionOfReadyProjection.MissingEvaluationCount == 4,
            "Typed Definition of Ready projection preserves exact Product, Initiative, assessment, evaluation, and privacy-safe metadata");
        var definitionOfReadyOutput = await initiativeController.ReadDefinitionOfReadyAsync(InitiativeId);
        Check(definitionOfReadyOutput.Contains("GAEP governed Definition of Ready candidate", StringComparison.Ordinal) &&
              definitionOfReadyOutput.Contains("16 Story/Task subjects · 9 prerequisites · 140/144 evaluations · 4 missing", StringComparison.Ordinal) &&
              definitionOfReadyOutput.Contains("candidate pass is an evaluation result, not admission", StringComparison.Ordinal) &&
              !definitionOfReadyOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !definitionOfReadyOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !definitionOfReadyOutput.Contains("itemEvaluations", StringComparison.Ordinal),
            "Definition of Ready workflow renders privacy-safe metadata with an explicit evaluation-not-admission boundary");
        foreach (var hostileRoot in new[] { badDefinitionOfReadySnapshotDigestRoot, badDefinitionOfReadySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDefinitionOfReadyAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Definition of Ready projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badDefinitionOfReadySnapshotBindingRoot,
                     badDefinitionOfReadyHierarchyBindingRoot,
                     badDefinitionOfReadyMvpBindingRoot,
                     badDefinitionOfReadyPrioritizationBindingRoot,
                     badDefinitionOfReadyCriteriaBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDefinitionOfReadyAsync(InitiativeId),
                "Definition of Ready workflow rejects substituted Product or current planning dependency bindings");
        }

        var definitionOfDoneProjection = await client.ReadDefinitionOfDoneAsync(InitiativeId);
        Check(definitionOfDoneProjection.ProductId == product.Id &&
              definitionOfDoneProjection.ProductRevision == product.Revision &&
              definitionOfDoneProjection.ProductDigest == product.Digest &&
              definitionOfDoneProjection.InitiativeId == resolved.Id &&
              definitionOfDoneProjection.InitiativeRevision == resolved.Revision &&
              definitionOfDoneProjection.InitiativeDigest == resolved.Digest &&
              definitionOfDoneProjection.Result == "attention-required" &&
              definitionOfDoneProjection.ReviewState == "held" &&
              definitionOfDoneProjection.SubjectCount == 4 &&
              definitionOfDoneProjection.PolicyEntryCount == 6 &&
              definitionOfDoneProjection.ExpectedEvaluationCount == 24 &&
              definitionOfDoneProjection.EvaluationCount == 21 &&
              definitionOfDoneProjection.CandidateSatisfiedCount == 14 &&
              definitionOfDoneProjection.NotApplicableCount == 3 &&
              definitionOfDoneProjection.MissingEvaluationCount == 3 &&
              definitionOfDoneProjection.StaleDefinitionOfReadyCount == 0,
            "Typed Definition of Done projection preserves exact Product, Initiative, dependency, evaluation, and privacy-safe metadata");
        var definitionOfDoneOutput = await initiativeController.ReadDefinitionOfDoneAsync(InitiativeId);
        Check(definitionOfDoneOutput.Contains("GAEP governed Definition of Done candidate", StringComparison.Ordinal) &&
              definitionOfDoneOutput.Contains("4 Story/Task subjects · 6 completion prerequisites · 21/24 evaluations · 3 missing", StringComparison.Ordinal) &&
              definitionOfDoneOutput.Contains("candidate pass is an evaluation result, not completion", StringComparison.Ordinal) &&
              definitionOfDoneOutput.Contains("no rules, rationales, evidence identities, assessor identities", StringComparison.Ordinal) &&
              !definitionOfDoneOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !definitionOfDoneOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !definitionOfDoneOutput.Contains("itemEvaluations", StringComparison.Ordinal),
            "Definition of Done workflow renders privacy-safe metadata with an explicit evaluation-not-completion boundary");
        foreach (var hostileRoot in new[] { badDefinitionOfDoneSnapshotDigestRoot, badDefinitionOfDoneSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDefinitionOfDoneAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Definition of Done projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badDefinitionOfDoneSnapshotBindingRoot,
                     badDefinitionOfDoneHierarchyBindingRoot,
                     badDefinitionOfDoneMvpBindingRoot,
                     badDefinitionOfDonePrioritizationBindingRoot,
                     badDefinitionOfDoneCriteriaBindingRoot,
                     badDefinitionOfDoneReadyBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDefinitionOfDoneAsync(InitiativeId),
                "Definition of Done workflow rejects substituted Product or current planning dependency bindings");
        }
        var implementationUnitModelProjection = await client.ReadImplementationUnitModelAsync(InitiativeId);
        Check(implementationUnitModelProjection.ProductId == product.Id &&
              implementationUnitModelProjection.ProductRevision == product.Revision &&
              implementationUnitModelProjection.ProductDigest == product.Digest &&
              implementationUnitModelProjection.InitiativeId == resolved.Id &&
              implementationUnitModelProjection.InitiativeRevision == resolved.Revision &&
              implementationUnitModelProjection.InitiativeDigest == resolved.Digest &&
              implementationUnitModelProjection.State == "attention-required" &&
              implementationUnitModelProjection.ReviewState == "held" &&
              implementationUnitModelProjection.UnitCount == 3 &&
              implementationUnitModelProjection.SubjectCount == 4 &&
              implementationUnitModelProjection.RequirementReferenceCount == 5 &&
              implementationUnitModelProjection.RepositoryCandidateCount == 3 &&
              implementationUnitModelProjection.OwnerCandidateCount == 3 &&
              implementationUnitModelProjection.DependencyEdgeCount == 2 &&
              implementationUnitModelProjection.CandidateAssessedBlastRadiusCount == 2 &&
              implementationUnitModelProjection.NotAssessedBlastRadiusCount == 1 &&
              implementationUnitModelProjection.StaleDefinitionOfDoneCount == 0,
            "Typed Implementation Unit Model projection preserves exact Product, Initiative, dependency, membership, placement, impact, and privacy-safe metadata");
        var implementationUnitModelOutput = await initiativeController.ReadImplementationUnitModelAsync(InitiativeId);
        Check(implementationUnitModelOutput.Contains("GAEP governed Implementation Unit Model candidate", StringComparison.Ordinal) &&
              implementationUnitModelOutput.Contains("3 units · 4 Story/Task subjects · 5 Requirement references", StringComparison.Ordinal) &&
              implementationUnitModelOutput.Contains("2 dependency edges · 2 blast radii candidate-assessed · 1 not assessed", StringComparison.Ordinal) &&
              implementationUnitModelOutput.Contains("no unit titles, boundaries, Story, Task, or Requirement identities", StringComparison.Ordinal) &&
              implementationUnitModelOutput.Contains("does not establish repository truth, owner appointment", StringComparison.Ordinal) &&
              !implementationUnitModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !implementationUnitModelOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !implementationUnitModelOutput.Contains("modulePath", StringComparison.Ordinal) &&
              !implementationUnitModelOutput.Contains("ownerCandidate", StringComparison.Ordinal) &&
              !implementationUnitModelOutput.Contains("subjectNodeIds", StringComparison.Ordinal),
            "Implementation Unit Model workflow renders privacy-safe metadata with explicit repository, ownership, dependency, impact, implementation, and action boundaries");
        foreach (var hostileRoot in new[] { badImplementationUnitModelSnapshotDigestRoot, badImplementationUnitModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadImplementationUnitModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Implementation Unit Model projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badImplementationUnitModelSnapshotBindingRoot,
                     badImplementationUnitModelHierarchyBindingRoot,
                     badImplementationUnitModelMvpBindingRoot,
                     badImplementationUnitModelCriteriaBindingRoot,
                     badImplementationUnitModelReadyBindingRoot,
                     badImplementationUnitModelDoneBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadImplementationUnitModelAsync(InitiativeId),
                "Implementation Unit Model workflow rejects substituted Product or current planning dependency bindings");
        }
        var dependencyMappingProjection = await client.ReadDependencyMappingAsync(InitiativeId);
        Check(dependencyMappingProjection.ProductId == product.Id &&
              dependencyMappingProjection.ProductRevision == product.Revision &&
              dependencyMappingProjection.ProductDigest == product.Digest &&
              dependencyMappingProjection.InitiativeId == resolved.Id &&
              dependencyMappingProjection.InitiativeRevision == resolved.Revision &&
              dependencyMappingProjection.InitiativeDigest == resolved.Digest &&
              dependencyMappingProjection.State == "attention-required" &&
              dependencyMappingProjection.ReviewState == "held" &&
              dependencyMappingProjection.NodeCount == 3 &&
              dependencyMappingProjection.EdgeCount == 2 &&
              dependencyMappingProjection.RequiredEdgeCount == 1 &&
              dependencyMappingProjection.ConditionalEdgeCount == 1 &&
              dependencyMappingProjection.CriticalPathUnitCount == 2 &&
              dependencyMappingProjection.CriticalPathCandidateEffortPoints == 13 &&
              dependencyMappingProjection.StaleImplementationUnitModelCount == 0,
            "Typed Dependency Mapping projection preserves exact Product, Initiative, prerequisite, graph, critical-path, and privacy-safe metadata");
        var dependencyMappingOutput = await initiativeController.ReadDependencyMappingAsync(InitiativeId);
        Check(dependencyMappingOutput.Contains("GAEP governed Dependency Mapping candidate", StringComparison.Ordinal) &&
              dependencyMappingOutput.Contains("3 nodes · 2 edges · 1 required · 1 conditional · 0 advisory", StringComparison.Ordinal) &&
              dependencyMappingOutput.Contains("2 units · 13 candidate effort points · 1 roots · 1 leaves", StringComparison.Ordinal) &&
              dependencyMappingOutput.Contains("no unit, node, edge, evidence, rationale, estimate, owner, repository, module", StringComparison.Ordinal) &&
              dependencyMappingOutput.Contains("does not establish dependency truth or completeness, critical-path authority", StringComparison.Ordinal) &&
              !dependencyMappingOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !dependencyMappingOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !dependencyMappingOutput.Contains("candidateEffortPoints", StringComparison.Ordinal) &&
              !dependencyMappingOutput.Contains("modulePath", StringComparison.Ordinal) &&
              !dependencyMappingOutput.Contains("predecessorUnitId", StringComparison.Ordinal),
            "Dependency Mapping workflow renders privacy-safe metadata with explicit graph, path, sequencing, implementation, and action boundaries");
        foreach (var hostileRoot in new[] { badDependencyMappingSnapshotDigestRoot, badDependencyMappingSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDependencyMappingAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Dependency Mapping projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badDependencyMappingSnapshotBindingRoot,
                     badDependencyMappingHierarchyBindingRoot,
                     badDependencyMappingMvpBindingRoot,
                     badDependencyMappingUnitModelBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDependencyMappingAsync(InitiativeId),
                "Dependency Mapping workflow rejects substituted Product or current planning dependency bindings");
        }
        var technologyProfileProjection = await client.ReadTechnologyProfileAsync(InitiativeId);
        Check(technologyProfileProjection.ProductId == product.Id &&
              technologyProfileProjection.ProductRevision == product.Revision &&
              technologyProfileProjection.ProductDigest == product.Digest &&
              technologyProfileProjection.InitiativeId == resolved.Id &&
              technologyProfileProjection.InitiativeRevision == resolved.Revision &&
              technologyProfileProjection.InitiativeDigest == resolved.Digest &&
              technologyProfileProjection.State == "attention-required" &&
              technologyProfileProjection.ReviewState == "held" &&
              technologyProfileProjection.UnitProfileCount == 3 &&
              technologyProfileProjection.TechnologyChoiceCount == 5 &&
              technologyProfileProjection.ExactVersionCandidateCount == 3 &&
              technologyProfileProjection.RangeVersionCandidateCount == 1 &&
              technologyProfileProjection.UnresolvedVersionCount == 1 &&
              technologyProfileProjection.ConstraintCount == 4 &&
              technologyProfileProjection.UnsupportedChoiceCount == 1 &&
              technologyProfileProjection.CompatibilityConflictCount == 1 &&
              technologyProfileProjection.LicenseProhibitedCount == 0 &&
              technologyProfileProjection.SecurityNonconformantCount == 0 &&
              technologyProfileProjection.StaleImplementationUnitModelCount == 0 &&
              technologyProfileProjection.StaleDependencyMappingCount == 0,
            "Typed Technology Profile projection preserves exact Product, Initiative, prerequisite, selection, compatibility, policy, and privacy-safe metadata");
        var technologyProfileOutput = await initiativeController.ReadTechnologyProfileAsync(InitiativeId);
        Check(technologyProfileOutput.Contains("GAEP governed Technology Profile candidate", StringComparison.Ordinal) &&
              technologyProfileOutput.Contains("3 unit profiles · 5 choices · 3 exact versions · 1 ranges · 1 unresolved versions · 4 constraints", StringComparison.Ordinal) &&
              technologyProfileOutput.Contains("1 unsupported · 1 lifecycle risks · 1 compatibility conflicts", StringComparison.Ordinal) &&
              technologyProfileOutput.Contains("no technology names, versions, constraints, evidence, rationale, unit, architecture", StringComparison.Ordinal) &&
              technologyProfileOutput.Contains("does not establish technology approval, support commitment, compatibility truth or completeness", StringComparison.Ordinal) &&
              !technologyProfileOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !technologyProfileOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !technologyProfileOutput.Contains("technologyName", StringComparison.Ordinal) &&
              !technologyProfileOutput.Contains("versionRange", StringComparison.Ordinal) &&
              !technologyProfileOutput.Contains("constraintText", StringComparison.Ordinal),
            "Technology Profile workflow renders privacy-safe metadata with explicit technology, compatibility, policy, approval, implementation, and action boundaries");
        foreach (var hostileRoot in new[] { badTechnologyProfileSnapshotDigestRoot, badTechnologyProfileSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadTechnologyProfileAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Technology Profile projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badTechnologyProfileSnapshotBindingRoot,
                     badTechnologyProfileUnitModelBindingRoot,
                     badTechnologyProfileDependencyMappingBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadTechnologyProfileAsync(InitiativeId),
                "Technology Profile workflow rejects substituted Product or current planning dependency bindings");
        }
        var boilerplateRegistryProjection = await client.ReadBoilerplateRegistryAsync(InitiativeId);
        Check(boilerplateRegistryProjection.ProductId == product.Id &&
              boilerplateRegistryProjection.ProductRevision == product.Revision &&
              boilerplateRegistryProjection.ProductDigest == product.Digest &&
              boilerplateRegistryProjection.InitiativeId == resolved.Id &&
              boilerplateRegistryProjection.InitiativeRevision == resolved.Revision &&
              boilerplateRegistryProjection.InitiativeDigest == resolved.Digest &&
              boilerplateRegistryProjection.State == "attention-required" &&
              boilerplateRegistryProjection.ReviewState == "held" &&
              boilerplateRegistryProjection.EntryCount == 4 &&
              boilerplateRegistryProjection.ExactVersionCandidateCount == 2 &&
              boilerplateRegistryProjection.RangeVersionCandidateCount == 1 &&
              boilerplateRegistryProjection.UnresolvedVersionCount == 1 &&
              boilerplateRegistryProjection.MandatoryCandidateCount == 2 &&
              boilerplateRegistryProjection.IntegrityMismatchCount == 1 &&
              boilerplateRegistryProjection.TechnologyConflictCount == 1 &&
              boilerplateRegistryProjection.LicenseProhibitedCount == 0 &&
              boilerplateRegistryProjection.SecurityNonconformantCount == 0 &&
              boilerplateRegistryProjection.StaleImplementationUnitModelCount == 0 &&
              boilerplateRegistryProjection.StaleTechnologyProfileCount == 0,
            "Typed Boilerplate Registry projection preserves exact Product, Initiative, prerequisite, asset, compatibility, policy, and privacy-safe metadata");
        var boilerplateRegistryOutput = await initiativeController.ReadBoilerplateRegistryAsync(InitiativeId);
        Check(boilerplateRegistryOutput.Contains("GAEP governed Boilerplate Registry candidate", StringComparison.Ordinal) &&
              boilerplateRegistryOutput.Contains("4 entries · 2 exact versions · 1 ranges · 1 unresolved versions · 2 mandatory candidates", StringComparison.Ordinal) &&
              boilerplateRegistryOutput.Contains("1 unavailable · 1 integrity gaps · 1 provenance gaps · 1 missing evidence", StringComparison.Ordinal) &&
              boilerplateRegistryOutput.Contains("no boilerplate names, locators, versions, capabilities, limitations, evidence, rationale", StringComparison.Ordinal) &&
              boilerplateRegistryOutput.Contains("does not establish organizational designation, endorsement, approval", StringComparison.Ordinal) &&
              !boilerplateRegistryOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !boilerplateRegistryOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !boilerplateRegistryOutput.Contains("sourceReference", StringComparison.Ordinal) &&
              !boilerplateRegistryOutput.Contains("versionCandidate", StringComparison.Ordinal) &&
              !boilerplateRegistryOutput.Contains("private capability", StringComparison.Ordinal),
            "Boilerplate Registry workflow renders privacy-safe metadata with explicit asset, compatibility, policy, designation, selection, implementation, and action boundaries");
        foreach (var hostileRoot in new[] { badBoilerplateRegistrySnapshotDigestRoot, badBoilerplateRegistrySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBoilerplateRegistryAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Boilerplate Registry projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badBoilerplateRegistrySnapshotBindingRoot,
                     badBoilerplateRegistryUnitModelBindingRoot,
                     badBoilerplateRegistryTechnologyProfileBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBoilerplateRegistryAsync(InitiativeId),
                "Boilerplate Registry workflow rejects substituted Product or current planning dependency bindings");
        }
        var boilerplateSelectionBindingProjection = await client.ReadBoilerplateSelectionBindingAsync(InitiativeId);
        Check(boilerplateSelectionBindingProjection.ProductId == product.Id &&
              boilerplateSelectionBindingProjection.ProductRevision == product.Revision &&
              boilerplateSelectionBindingProjection.ProductDigest == product.Digest &&
              boilerplateSelectionBindingProjection.InitiativeId == resolved.Id &&
              boilerplateSelectionBindingProjection.InitiativeRevision == resolved.Revision &&
              boilerplateSelectionBindingProjection.InitiativeDigest == resolved.Digest &&
              boilerplateSelectionBindingProjection.State == "attention-required" &&
              boilerplateSelectionBindingProjection.ReviewState == "held" &&
              boilerplateSelectionBindingProjection.DecisionCount == 4 &&
              boilerplateSelectionBindingProjection.SelectedCandidateCount == 2 &&
              boilerplateSelectionBindingProjection.NotApplicableCandidateCount == 1 &&
              boilerplateSelectionBindingProjection.DeferredCandidateCount == 1 &&
              boilerplateSelectionBindingProjection.MissingUnitDecisionCount == 1 &&
              boilerplateSelectionBindingProjection.InvalidSelectionCount == 1 &&
              boilerplateSelectionBindingProjection.StaleDependencyMappingCount == 0 &&
              boilerplateSelectionBindingProjection.StaleBoilerplateRegistryCount == 0,
            "Typed Boilerplate Selection and Binding projection preserves exact Product, Initiative, prerequisite, decision, and privacy-safe metadata");
        var boilerplateSelectionBindingOutput = await initiativeController.ReadBoilerplateSelectionBindingAsync(InitiativeId);
        Check(boilerplateSelectionBindingOutput.Contains("GAEP governed Boilerplate Selection and Binding candidate", StringComparison.Ordinal) &&
              boilerplateSelectionBindingOutput.Contains("4 decisions · 2 selected · 1 not applicable · 1 deferred · 0 not assessed", StringComparison.Ordinal) &&
              boilerplateSelectionBindingOutput.Contains("1 missing unit decisions · 1 invalid selections · 1 registry gaps", StringComparison.Ordinal) &&
              boilerplateSelectionBindingOutput.Contains("no boilerplate names, locators, versions, unit or profile identities", StringComparison.Ordinal) &&
              boilerplateSelectionBindingOutput.Contains("does not establish organizational designation, endorsement, approval", StringComparison.Ordinal) &&
              !boilerplateSelectionBindingOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !boilerplateSelectionBindingOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !boilerplateSelectionBindingOutput.Contains("boilerplateRegistryEntryId", StringComparison.Ordinal) &&
              !boilerplateSelectionBindingOutput.Contains("technologyProfileId", StringComparison.Ordinal) &&
              !boilerplateSelectionBindingOutput.Contains("private rationale", StringComparison.Ordinal),
            "Boilerplate Selection and Binding workflow renders privacy-safe metadata with explicit decision, designation, selection, implementation, and action boundaries");
        foreach (var hostileRoot in new[] { badBoilerplateSelectionBindingSnapshotDigestRoot, badBoilerplateSelectionBindingSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBoilerplateSelectionBindingAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Boilerplate Selection and Binding projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badBoilerplateSelectionBindingSnapshotBindingRoot,
                     badBoilerplateSelectionBindingUnitModelBindingRoot,
                     badBoilerplateSelectionBindingDependencyMappingBindingRoot,
                     badBoilerplateSelectionBindingTechnologyProfileBindingRoot,
                     badBoilerplateSelectionBindingRegistryBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBoilerplateSelectionBindingAsync(InitiativeId),
                "Boilerplate Selection and Binding workflow rejects substituted Product or current planning dependency bindings");
        }
        var boilerplateCompatibilityValidationProjection = await client.ReadBoilerplateCompatibilityValidationAsync(InitiativeId);
        Check(boilerplateCompatibilityValidationProjection.ProductId == product.Id &&
              boilerplateCompatibilityValidationProjection.ProductRevision == product.Revision &&
              boilerplateCompatibilityValidationProjection.ProductDigest == product.Digest &&
              boilerplateCompatibilityValidationProjection.InitiativeId == resolved.Id &&
              boilerplateCompatibilityValidationProjection.InitiativeRevision == resolved.Revision &&
              boilerplateCompatibilityValidationProjection.InitiativeDigest == resolved.Digest &&
              boilerplateCompatibilityValidationProjection.State == "attention-required" &&
              boilerplateCompatibilityValidationProjection.ReviewState == "held" &&
              boilerplateCompatibilityValidationProjection.SelectedBindingCount == 2 &&
              boilerplateCompatibilityValidationProjection.SubjectCount == 2 &&
              boilerplateCompatibilityValidationProjection.DimensionAssessmentCount == 28 &&
              boilerplateCompatibilityValidationProjection.CompatibleCandidateCount == 1 &&
              boilerplateCompatibilityValidationProjection.ExceptionCandidateCount == 1 &&
              boilerplateCompatibilityValidationProjection.InvalidSubjectCount == 1 &&
              boilerplateCompatibilityValidationProjection.MissingEvidenceCount == 1 &&
              boilerplateCompatibilityValidationProjection.ExpiredAssessmentCount == 1 &&
              boilerplateCompatibilityValidationProjection.SelectionBindingGapCount == 0,
            "Typed Boilerplate Compatibility Validation projection preserves exact Product, Initiative, prerequisite, subject, dimension, and privacy-safe metadata");
        var boilerplateCompatibilityValidationOutput = await initiativeController.ReadBoilerplateCompatibilityValidationAsync(InitiativeId);
        Check(boilerplateCompatibilityValidationOutput.Contains("GAEP governed Boilerplate Compatibility Validation candidate", StringComparison.Ordinal) &&
              boilerplateCompatibilityValidationOutput.Contains("2 selected bindings · 2 subjects · 28 dimension assessments", StringComparison.Ordinal) &&
              boilerplateCompatibilityValidationOutput.Contains("1 compatible · 0 incompatible · 1 exception candidates · 0 not assessed", StringComparison.Ordinal) &&
              boilerplateCompatibilityValidationOutput.Contains("1 invalid subjects · 0 missing dimensions · 1 missing evidence", StringComparison.Ordinal) &&
              boilerplateCompatibilityValidationOutput.Contains("no boilerplate names, locators, versions, unit, profile, entry, or binding identities", StringComparison.Ordinal) &&
              boilerplateCompatibilityValidationOutput.Contains("does not establish compatibility truth or completeness", StringComparison.Ordinal) &&
              !boilerplateCompatibilityValidationOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !boilerplateCompatibilityValidationOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !boilerplateCompatibilityValidationOutput.Contains("boilerplateRegistryEntryId", StringComparison.Ordinal) &&
              !boilerplateCompatibilityValidationOutput.Contains("bindingDecisionId", StringComparison.Ordinal) &&
              !boilerplateCompatibilityValidationOutput.Contains("private claim", StringComparison.Ordinal),
            "Boilerplate Compatibility Validation workflow renders privacy-safe metadata with explicit validation, selection, implementation, and action boundaries");
        foreach (var hostileRoot in new[]
                 {
                     badBoilerplateCompatibilityValidationSnapshotDigestRoot,
                     badBoilerplateCompatibilityValidationSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBoilerplateCompatibilityValidationAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Boilerplate Compatibility Validation projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badBoilerplateCompatibilityValidationSnapshotBindingRoot,
                     badBoilerplateCompatibilityValidationUnitModelBindingRoot,
                     badBoilerplateCompatibilityValidationDependencyMappingBindingRoot,
                     badBoilerplateCompatibilityValidationTechnologyProfileBindingRoot,
                     badBoilerplateCompatibilityValidationRegistryBindingRoot,
                     badBoilerplateCompatibilityValidationSelectionBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBoilerplateCompatibilityValidationAsync(InitiativeId),
                "Boilerplate Compatibility Validation workflow rejects substituted Product or current planning dependency bindings");
        }
        await using (var hostileClient = new EngineClient(
                         badBusinessArchitectureBaselineSnapshotBindingRoot,
                         executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBusinessArchitectureBaselineAsync(InitiativeId),
                "Business Architecture Baseline rejects a projection rebound to a substituted Product revision");
        }

        var systemSolutionArchitectureProjection = await client.ReadSystemSolutionArchitectureAsync(InitiativeId);
        Check(systemSolutionArchitectureProjection.ProductId == product.Id &&
              systemSolutionArchitectureProjection.ProductRevision == product.Revision &&
              systemSolutionArchitectureProjection.ProductDigest == product.Digest &&
              systemSolutionArchitectureProjection.InitiativeId == resolved.Id &&
              systemSolutionArchitectureProjection.InitiativeRevision == resolved.Revision &&
              systemSolutionArchitectureProjection.InitiativeDigest == resolved.Digest &&
              systemSolutionArchitectureProjection.AssessmentState == "attention-required" &&
              systemSolutionArchitectureProjection.Architecture?.ElementCount == 9 &&
              systemSolutionArchitectureProjection.Architecture?.QualityAttributeCount == 5 &&
              systemSolutionArchitectureProjection.UnresolvedDecisionCount == 2,
            "Typed System/Solution Architecture preserves exact Product, Initiative, assessment, and candidate metadata");
        var systemSolutionArchitectureOutput =
            await initiativeController.ReadSystemSolutionArchitectureAsync(InitiativeId);
        Check(systemSolutionArchitectureOutput.Contains(
                  "GAEP governed System/Solution Architecture candidate",
                  StringComparison.Ordinal) &&
              systemSolutionArchitectureOutput.Contains(
                  "4 concerns · 3 views · 9 elements · 12 relations",
                  StringComparison.Ordinal) &&
              systemSolutionArchitectureOutput.Contains(
                  "does not designate or approve an architecture baseline, establish readiness",
                  StringComparison.Ordinal) &&
              !systemSolutionArchitectureOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !systemSolutionArchitectureOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !systemSolutionArchitectureOutput.Contains("architectureNarrative", StringComparison.Ordinal),
            "System/Solution Architecture workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[]
                 {
                     badSystemSolutionArchitectureSnapshotDigestRoot,
                     badSystemSolutionArchitectureSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(
                () => hostileClient.ReadSystemSolutionArchitectureAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "System/Solution Architecture rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(
                         badSystemSolutionArchitectureSnapshotBindingRoot,
                         executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadSystemSolutionArchitectureAsync(InitiativeId),
                "System/Solution Architecture rejects a projection rebound to a substituted Product revision");
        }

        var boundedContextProjection = await client.ReadBoundedContextModelAsync(InitiativeId);
        Check(boundedContextProjection.ProductId == product.Id &&
              boundedContextProjection.ProductRevision == product.Revision &&
              boundedContextProjection.ProductDigest == product.Digest &&
              boundedContextProjection.InitiativeId == resolved.Id &&
              boundedContextProjection.InitiativeRevision == resolved.Revision &&
              boundedContextProjection.InitiativeDigest == resolved.Digest &&
              boundedContextProjection.AssessmentState == "attention-required" &&
              boundedContextProjection.Model?.BoundedContextCount == 3 &&
              boundedContextProjection.Model?.ContractCount == 4 &&
              boundedContextProjection.UnmappedCrossContextRelationCount == 2,
            "Typed Bounded Context Model preserves exact Product, Initiative, assessment, and candidate metadata");
        var boundedContextOutput = await initiativeController.ReadBoundedContextModelAsync(InitiativeId);
        Check(boundedContextOutput.Contains(
                  "GAEP governed Bounded Context and Ownership candidate",
                  StringComparison.Ordinal) &&
              boundedContextOutput.Contains(
                  "3 contexts · 1 core contexts · 11 language terms · 4 contracts · 3 relationships",
                  StringComparison.Ordinal) &&
              boundedContextOutput.Contains(
                  "does not appoint owners, accept ownership, approve boundaries or contracts",
                  StringComparison.Ordinal) &&
              !boundedContextOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !boundedContextOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !boundedContextOutput.Contains("ubiquitousLanguage", StringComparison.Ordinal),
            "Bounded Context workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[]
                 {
                     badBoundedContextSnapshotDigestRoot,
                     badBoundedContextSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(
                () => hostileClient.ReadBoundedContextModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Bounded Context Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badBoundedContextSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBoundedContextModelAsync(InitiativeId),
                "Bounded Context Model rejects a projection rebound to a substituted Product revision");
        }

        var securityPrivacyProjection = await client.ReadSecurityPrivacyAssessmentAsync(InitiativeId);
        Check(securityPrivacyProjection.ProductId == product.Id &&
              securityPrivacyProjection.ProductRevision == product.Revision &&
              securityPrivacyProjection.ProductDigest == product.Digest &&
              securityPrivacyProjection.InitiativeId == resolved.Id &&
              securityPrivacyProjection.InitiativeRevision == resolved.Revision &&
              securityPrivacyProjection.InitiativeDigest == resolved.Digest &&
              securityPrivacyProjection.AssessmentState == "attention-required" &&
              securityPrivacyProjection.Assessment?.AssetCount == 4 &&
              securityPrivacyProjection.Assessment?.ControlCount == 6 &&
              securityPrivacyProjection.UnresolvedRequirementCount == 3,
            "Typed Security, Privacy, and Threat Assessment preserves exact Product, Initiative, status, and candidate metadata");
        var securityPrivacyOutput = await initiativeController.ReadSecurityPrivacyAssessmentAsync(InitiativeId);
        Check(securityPrivacyOutput.Contains(
                  "GAEP governed Security, Privacy, and Threat Assessment candidate",
                  StringComparison.Ordinal) &&
              securityPrivacyOutput.Contains(
                  "4 assets · 5 actors · 3 trust boundaries · 2 data classes · 4 data flows · 6 controls · 7 threats",
                  StringComparison.Ordinal) &&
              securityPrivacyOutput.Contains(
                  "does not approve a threat model, attest control effectiveness, accept risk",
                  StringComparison.Ordinal) &&
              !securityPrivacyOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !securityPrivacyOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !securityPrivacyOutput.Contains("threatScenario", StringComparison.Ordinal),
            "Security, Privacy, and Threat workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[]
                 {
                     badSecurityPrivacySnapshotDigestRoot,
                     badSecurityPrivacySnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(
                () => hostileClient.ReadSecurityPrivacyAssessmentAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Security, Privacy, and Threat Assessment rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badSecurityPrivacySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadSecurityPrivacyAssessmentAsync(InitiativeId),
                "Security, Privacy, and Threat Assessment rejects a projection rebound to a substituted Product revision");
        }

        var processModelProjection = await client.ReadProcessModelAsync(InitiativeId);
        Check(processModelProjection.ProductId == product.Id &&
              processModelProjection.ProductRevision == product.Revision &&
              processModelProjection.ProductDigest == product.Digest &&
              processModelProjection.InitiativeId == resolved.Id &&
              processModelProjection.InitiativeRevision == resolved.Revision &&
              processModelProjection.InitiativeDigest == resolved.Digest &&
              processModelProjection.AssessmentState == "attention-required" &&
              processModelProjection.Model?.ProcessCount == 3 &&
              processModelProjection.Model?.TransitionCount == 11 &&
              processModelProjection.UnresolvedRequirementCount == 4,
            "Typed Process Model preserves exact Product, Initiative, status, and candidate metadata");
        var processModelOutput = await initiativeController.ReadProcessModelAsync(InitiativeId);
        Check(processModelOutput.Contains("GAEP governed Process Model candidate", StringComparison.Ordinal) &&
              processModelOutput.Contains(
                  "3 processes · 9 steps · 5 state dimensions · 18 state values · 11 transitions · 8 events · 4 approval requirements",
                  StringComparison.Ordinal) &&
              processModelOutput.Contains(
                  "does not approve workflows, grant transition or execution authority",
                  StringComparison.Ordinal) &&
              !processModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !processModelOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !processModelOutput.Contains("transitionGuard", StringComparison.Ordinal),
            "Process Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badProcessModelSnapshotDigestRoot, badProcessModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadProcessModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Process Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badProcessModelSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadProcessModelAsync(InitiativeId),
                "Process Model rejects a projection rebound to a substituted Product revision");
        }

        var dataModelProjection = await client.ReadDataModelAsync(InitiativeId);
        Check(dataModelProjection.ProductId == product.Id &&
              dataModelProjection.ProductRevision == product.Revision &&
              dataModelProjection.ProductDigest == product.Digest &&
              dataModelProjection.InitiativeId == resolved.Id &&
              dataModelProjection.InitiativeRevision == resolved.Revision &&
              dataModelProjection.InitiativeDigest == resolved.Digest &&
              dataModelProjection.AssessmentState == "attention-required" &&
              dataModelProjection.Model?.EntityCount == 6 &&
              dataModelProjection.Model?.RelationshipCount == 8 &&
              dataModelProjection.UnresolvedRequirementCount == 4,
            "Typed Data Model preserves exact Product, Initiative, status, and candidate metadata");
        var dataModelOutput = await initiativeController.ReadDataModelAsync(InitiativeId);
        Check(dataModelOutput.Contains("GAEP governed Data Model candidate", StringComparison.Ordinal) &&
              dataModelOutput.Contains(
                  "6 entities · 24 attributes · 8 relationships · 6 lifecycles · 5 transformations",
                  StringComparison.Ordinal) &&
              dataModelOutput.Contains(
                  "does not approve a data model or classification, appoint ownership",
                  StringComparison.Ordinal) &&
              !dataModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !dataModelOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !dataModelOutput.Contains("entityAttribute", StringComparison.Ordinal),
            "Data Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badDataModelSnapshotDigestRoot, badDataModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDataModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Data Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDataModelSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDataModelAsync(InitiativeId),
                "Data Model rejects a projection rebound to a substituted Product revision");
        }

        var authorizationModelProjection = await client.ReadAuthorizationModelAsync(InitiativeId);
        Check(authorizationModelProjection.ProductId == product.Id &&
              authorizationModelProjection.ProductRevision == product.Revision &&
              authorizationModelProjection.ProductDigest == product.Digest &&
              authorizationModelProjection.InitiativeId == resolved.Id &&
              authorizationModelProjection.InitiativeRevision == resolved.Revision &&
              authorizationModelProjection.InitiativeDigest == resolved.Digest &&
              authorizationModelProjection.AssessmentState == "attention-required" &&
              authorizationModelProjection.Model?.PrincipalCount == 5 &&
              authorizationModelProjection.Model?.RuleCount == 9 &&
              authorizationModelProjection.UnresolvedRequirementCount == 6,
            "Typed Authorization Model preserves exact Product, Initiative, status, and candidate metadata");
        var authorizationModelOutput = await initiativeController.ReadAuthorizationModelAsync(InitiativeId);
        Check(authorizationModelOutput.Contains("GAEP governed Authorization Model candidate", StringComparison.Ordinal) &&
              authorizationModelOutput.Contains(
                  "5 principals · 6 role assignments · 7 resources · 8 actions · 3 approval bindings · 9 rules",
                  StringComparison.Ordinal) &&
              authorizationModelOutput.Contains(
                  "does not verify identity, approve role assignments or standing authority",
                  StringComparison.Ordinal) &&
              !authorizationModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !authorizationModelOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !authorizationModelOutput.Contains("principalIdentifier", StringComparison.Ordinal),
            "Authorization Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badAuthorizationModelSnapshotDigestRoot, badAuthorizationModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadAuthorizationModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Authorization Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badAuthorizationModelSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadAuthorizationModelAsync(InitiativeId),
                "Authorization Model rejects a projection rebound to a substituted Product revision");
        }

        var eventIntegrationModelProjection = await client.ReadEventIntegrationModelAsync(InitiativeId);
        Check(eventIntegrationModelProjection.ProductId == product.Id &&
              eventIntegrationModelProjection.ProductRevision == product.Revision &&
              eventIntegrationModelProjection.ProductDigest == product.Digest &&
              eventIntegrationModelProjection.InitiativeId == resolved.Id &&
              eventIntegrationModelProjection.InitiativeRevision == resolved.Revision &&
              eventIntegrationModelProjection.InitiativeDigest == resolved.Digest &&
              eventIntegrationModelProjection.AssessmentState == "attention-required" &&
              eventIntegrationModelProjection.Model?.EventTypeCount == 10 &&
              eventIntegrationModelProjection.Model?.RouteCount == 7 &&
              eventIntegrationModelProjection.UnresolvedRequirementCount == 7,
            "Typed Event and Integration Model preserves exact Product, Initiative, status, and candidate metadata");
        var eventIntegrationModelOutput = await initiativeController.ReadEventIntegrationModelAsync(InitiativeId);
        Check(eventIntegrationModelOutput.Contains("GAEP governed Event and Integration Model candidate", StringComparison.Ordinal) &&
              eventIntegrationModelOutput.Contains(
                  "10 event types · 11 commands · 4 adapters · 5 external contracts · 6 mappings · 7 routes",
                  StringComparison.Ordinal) &&
              eventIntegrationModelOutput.Contains(
                  "does not prove event occurrence, send or deliver commands",
                  StringComparison.Ordinal) &&
              !eventIntegrationModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !eventIntegrationModelOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !eventIntegrationModelOutput.Contains("eventPayload", StringComparison.Ordinal),
            "Event and Integration Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badEventIntegrationModelSnapshotDigestRoot, badEventIntegrationModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadEventIntegrationModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Event and Integration Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badEventIntegrationModelSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadEventIntegrationModelAsync(InitiativeId),
                "Event and Integration Model rejects a projection rebound to a substituted Product revision");
        }

        var failureRecoveryModelProjection = await client.ReadFailureRecoveryModelAsync(InitiativeId);
        Check(failureRecoveryModelProjection.ProductId == product.Id &&
              failureRecoveryModelProjection.ProductRevision == product.Revision &&
              failureRecoveryModelProjection.ProductDigest == product.Digest &&
              failureRecoveryModelProjection.InitiativeId == resolved.Id &&
              failureRecoveryModelProjection.InitiativeRevision == resolved.Revision &&
              failureRecoveryModelProjection.InitiativeDigest == resolved.Digest &&
              failureRecoveryModelProjection.AssessmentState == "attention-required" &&
              failureRecoveryModelProjection.Model?.FailureModeCount == 8 &&
              failureRecoveryModelProjection.Model?.RecoveryPlanCount == 4 &&
              failureRecoveryModelProjection.UnresolvedRequirementCount == 6,
            "Typed Failure and Recovery Model preserves exact Product, Initiative, status, and candidate metadata");
        var failureRecoveryModelOutput = await initiativeController.ReadFailureRecoveryModelAsync(InitiativeId);
        Check(failureRecoveryModelOutput.Contains("GAEP governed Failure and Recovery Model candidate", StringComparison.Ordinal) &&
              failureRecoveryModelOutput.Contains(
                  "8 failure modes · 6 retry policies · 5 compensation plans · 4 recovery plans · 3 recovery evidence definitions",
                  StringComparison.Ordinal) &&
              failureRecoveryModelOutput.Contains(
                  "does not prove failure occurrence, establish retry safety",
                  StringComparison.Ordinal) &&
              !failureRecoveryModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !failureRecoveryModelOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !failureRecoveryModelOutput.Contains("recoveryEvidence", StringComparison.Ordinal),
            "Failure and Recovery Model workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badFailureRecoveryModelSnapshotDigestRoot, badFailureRecoveryModelSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadFailureRecoveryModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Failure and Recovery Model rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badFailureRecoveryModelSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadFailureRecoveryModelAsync(InitiativeId),
                "Failure and Recovery Model rejects a projection rebound to a substituted Product revision");
        }

        var architectureChallengeProjection = await client.ReadArchitectureChallengeModelAsync(InitiativeId);
        Check(architectureChallengeProjection.ProductId == product.Id &&
              architectureChallengeProjection.ProductRevision == product.Revision &&
              architectureChallengeProjection.ProductDigest == product.Digest &&
              architectureChallengeProjection.InitiativeId == resolved.Id &&
              architectureChallengeProjection.InitiativeRevision == resolved.Revision &&
              architectureChallengeProjection.InitiativeDigest == resolved.Digest &&
              architectureChallengeProjection.AssessmentState == "attention-required" &&
              architectureChallengeProjection.Model?.ChallengeSubjectCount == 9 &&
              architectureChallengeProjection.Model?.FindingCount == 6 &&
              architectureChallengeProjection.UnrespondedFindingCount == 1,
            "Typed Architecture Challenge preserves exact Product, Initiative, status, and candidate metadata");
        var architectureChallengeOutput = await initiativeController.ReadArchitectureChallengeModelAsync(InitiativeId);
        Check(architectureChallengeOutput.Contains("GAEP governed Architecture Challenge candidate", StringComparison.Ordinal) &&
              architectureChallengeOutput.Contains(
                  "9 challenge subjects · 7 assumptions · 4 alternatives · 6 findings · 5 responses",
                  StringComparison.Ordinal) &&
              architectureChallengeOutput.Contains("does not complete independent review", StringComparison.Ordinal) &&
              !architectureChallengeOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !architectureChallengeOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !architectureChallengeOutput.Contains("challengeContent", StringComparison.Ordinal),
            "Architecture Challenge workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badArchitectureChallengeSnapshotDigestRoot, badArchitectureChallengeSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadArchitectureChallengeModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Architecture Challenge rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badArchitectureChallengeSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadArchitectureChallengeModelAsync(InitiativeId),
                "Architecture Challenge rejects a projection rebound to a substituted Product revision");
        }

        var decisionRegisterProjection = await client.ReadDecisionRegisterAsync(InitiativeId);
        Check(decisionRegisterProjection.ProductId == product.Id &&
              decisionRegisterProjection.ProductRevision == product.Revision &&
              decisionRegisterProjection.ProductDigest == product.Digest &&
              decisionRegisterProjection.InitiativeId == resolved.Id &&
              decisionRegisterProjection.InitiativeRevision == resolved.Revision &&
              decisionRegisterProjection.InitiativeDigest == resolved.Digest &&
              decisionRegisterProjection.AssessmentState == "attention-required" &&
              decisionRegisterProjection.Register?.DecisionCount == 7 &&
              decisionRegisterProjection.UnresolvedDecisionCount == 2 &&
              decisionRegisterProjection.SelectedPendingDecisionCount == 3,
            "Typed Decision Register preserves exact Product, Initiative, status, and candidate metadata");
        var decisionRegisterOutput = await initiativeController.ReadDecisionRegisterAsync(InitiativeId);
        Check(decisionRegisterOutput.Contains("GAEP governed Decision Register candidate", StringComparison.Ordinal) &&
              decisionRegisterOutput.Contains(
                  "2 unresolved decisions · 3 selected pending decisions · 1 deferred decisions",
                  StringComparison.Ordinal) &&
              decisionRegisterOutput.Contains("does not establish decision effectiveness", StringComparison.Ordinal) &&
              !decisionRegisterOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !decisionRegisterOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !decisionRegisterOutput.Contains("decisionQuestion", StringComparison.Ordinal),
            "Decision Register workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badDecisionRegisterSnapshotDigestRoot, badDecisionRegisterSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDecisionRegisterAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Decision Register rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDecisionRegisterSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDecisionRegisterAsync(InitiativeId),
                "Decision Register rejects a projection rebound to a substituted Product revision");
        }

        var riskRegisterProjection = await client.ReadRiskRegisterAsync(InitiativeId);
        Check(riskRegisterProjection.ProductId == product.Id &&
              riskRegisterProjection.ProductRevision == product.Revision &&
              riskRegisterProjection.ProductDigest == product.Digest &&
              riskRegisterProjection.InitiativeId == resolved.Id &&
              riskRegisterProjection.InitiativeRevision == resolved.Revision &&
              riskRegisterProjection.InitiativeDigest == resolved.Digest &&
              riskRegisterProjection.AssessmentState == "attention-required" &&
              riskRegisterProjection.Register?.RiskCount == 9 &&
              riskRegisterProjection.NotAssessedRiskCount == 2 &&
              riskRegisterProjection.UnresolvedResidualRiskCount == 3 &&
              riskRegisterProjection.UnverifiedControlCount == 4,
            "Typed Risk Register preserves exact Product, Initiative, status, and candidate metadata");
        var riskRegisterOutput = await initiativeController.ReadRiskRegisterAsync(InitiativeId);
        Check(riskRegisterOutput.Contains("GAEP governed Risk Register candidate", StringComparison.Ordinal) &&
              riskRegisterOutput.Contains(
                  "2 not assessed · 3 residual risks · 4 control effectiveness gaps",
                  StringComparison.Ordinal) &&
              riskRegisterOutput.Contains("does not establish assessment fact", StringComparison.Ordinal) &&
              !riskRegisterOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !riskRegisterOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !riskRegisterOutput.Contains("riskStatement", StringComparison.Ordinal),
            "Risk Register workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badRiskRegisterSnapshotDigestRoot, badRiskRegisterSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadRiskRegisterAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Risk Register rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badRiskRegisterSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadRiskRegisterAsync(InitiativeId),
                "Risk Register rejects a projection rebound to a substituted Product revision");
        }

        var evidenceRegistryProjection = await client.ReadEvidenceRegistryAsync(InitiativeId);
        Check(evidenceRegistryProjection.ProductId == product.Id &&
              evidenceRegistryProjection.ProductRevision == product.Revision &&
              evidenceRegistryProjection.ProductDigest == product.Digest &&
              evidenceRegistryProjection.InitiativeId == resolved.Id &&
              evidenceRegistryProjection.InitiativeRevision == resolved.Revision &&
              evidenceRegistryProjection.InitiativeDigest == resolved.Digest &&
              evidenceRegistryProjection.AssessmentState == "attention-required" &&
              evidenceRegistryProjection.Registry?.ClaimCount == 12 &&
              evidenceRegistryProjection.Registry?.EvidenceItemCount == 18 &&
              evidenceRegistryProjection.Registry?.LinkCount == 21 &&
              evidenceRegistryProjection.StaleOrUnknownEvidenceCount == 4,
            "Typed Evidence Registry preserves exact Product, Initiative, status, and candidate metadata");
        var evidenceRegistryOutput = await initiativeController.ReadEvidenceRegistryAsync(InitiativeId);
        Check(evidenceRegistryOutput.Contains("GAEP governed Evidence Registry candidate", StringComparison.Ordinal) &&
              evidenceRegistryOutput.Contains(
                  "2 claims not assessed · 3 evidence items not assessed · 1 adverse dispositions pending",
                  StringComparison.Ordinal) &&
              evidenceRegistryOutput.Contains("does not establish claim validation", StringComparison.Ordinal) &&
              !evidenceRegistryOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !evidenceRegistryOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !evidenceRegistryOutput.Contains("claimStatement", StringComparison.Ordinal),
            "Evidence Registry workflow renders privacy-safe metadata with an explicit no-authority boundary");
        foreach (var hostileRoot in new[] { badEvidenceRegistrySnapshotDigestRoot, badEvidenceRegistrySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadEvidenceRegistryAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Evidence Registry rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badEvidenceRegistrySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadEvidenceRegistryAsync(InitiativeId),
                "Evidence Registry rejects a projection rebound to a substituted Product revision");
        }

        var traceabilityProjection = await client.ReadEndToEndTraceabilityAsync(InitiativeId);
        Check(traceabilityProjection.ProductId == product.Id &&
              traceabilityProjection.ProductRevision == product.Revision &&
              traceabilityProjection.ProductDigest == product.Digest &&
              traceabilityProjection.InitiativeId == resolved.Id &&
              traceabilityProjection.InitiativeRevision == resolved.Revision &&
              traceabilityProjection.InitiativeDigest == resolved.Digest &&
              traceabilityProjection.AssessmentState == "attention-required" &&
              traceabilityProjection.Traceability?.NodeCount == 44 &&
              traceabilityProjection.Traceability?.RelationshipCount == 12 &&
              traceabilityProjection.Traceability?.LinkCount == 67 &&
              traceabilityProjection.Traceability?.TransformationCount == 5 &&
              traceabilityProjection.MissingSpineCount == 1,
            "Typed End-to-End Traceability preserves exact Product, Initiative, status, and candidate metadata");
        var traceabilityOutput = await initiativeController.ReadEndToEndTraceabilityAsync(InitiativeId);
        Check(traceabilityOutput.Contains("GAEP governed End-to-End Traceability candidate", StringComparison.Ordinal) &&
              traceabilityOutput.Contains("1 missing spine segments", StringComparison.Ordinal) &&
              traceabilityOutput.Contains(
                  "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
                  StringComparison.Ordinal) &&
              traceabilityOutput.Contains("does not establish relationship truth", StringComparison.Ordinal) &&
              !traceabilityOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !traceabilityOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !traceabilityOutput.Contains("linkRationale", StringComparison.Ordinal),
            "End-to-End Traceability workflow renders privacy-safe metadata with explicit coverage and no-authority boundaries");
        foreach (var hostileRoot in new[] { badTraceabilitySnapshotDigestRoot, badTraceabilitySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadEndToEndTraceabilityAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "End-to-End Traceability rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badTraceabilitySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadEndToEndTraceabilityAsync(InitiativeId),
                "End-to-End Traceability rejects a projection rebound to a substituted Product revision");
        }

        var readinessProjection = await client.ReadP0P4ReadinessGateAsync(InitiativeId);
        Check(readinessProjection.ProductId == product.Id &&
              readinessProjection.ProductRevision == product.Revision &&
              readinessProjection.ProductDigest == product.Digest &&
              readinessProjection.InitiativeId == resolved.Id &&
              readinessProjection.InitiativeRevision == resolved.Revision &&
              readinessProjection.InitiativeDigest == resolved.Digest &&
              readinessProjection.Result == "failed" &&
              readinessProjection.Gate?.OutputCount == 25 &&
              readinessProjection.Gate?.EvaluationDefinitionDigest == $"sha256:{new string('e', 64)}" &&
              readinessProjection.ApplicableOutputCount == 20 &&
              readinessProjection.SatisfiedOutputCount == 17 &&
              readinessProjection.UnresolvedDecisionCount == 2 &&
              readinessProjection.AdverseEvidenceCount == 1,
            "Typed P0-P4 Readiness Gate preserves exact Product, Initiative, evaluation, and candidate metadata");
        var readinessGateOutput = await initiativeController.ReadP0P4ReadinessGateAsync(InitiativeId);
        Check(readinessGateOutput.Contains("GAEP governed P0-P4 Readiness Gate candidate", StringComparison.Ordinal) &&
              readinessGateOutput.Contains("17/20 applicable satisfied", StringComparison.Ordinal) &&
              readinessGateOutput.Contains("a-passing-gate-is-an-evaluation-result-not-permission", StringComparison.Ordinal) &&
              readinessGateOutput.Contains("does not grant approval", StringComparison.Ordinal) &&
              !readinessGateOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !readinessGateOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !readinessGateOutput.Contains("waiverRationale", StringComparison.Ordinal),
            "P0-P4 Readiness Gate workflow renders privacy-safe metadata with explicit evaluation and no-authority boundaries");
        foreach (var hostileRoot in new[] { badReadinessGateSnapshotDigestRoot, badReadinessGateSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadP0P4ReadinessGateAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "P0-P4 Readiness Gate rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badReadinessGateSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadP0P4ReadinessGateAsync(InitiativeId),
                "P0-P4 Readiness Gate rejects a projection rebound to a substituted Product revision");
        }

        var p5HandoffProjection = await client.ReadP5HandoffPackageAsync(InitiativeId);
        Check(p5HandoffProjection.ProductId == product.Id &&
              p5HandoffProjection.ProductRevision == product.Revision &&
              p5HandoffProjection.ProductDigest == product.Digest &&
              p5HandoffProjection.InitiativeId == resolved.Id &&
              p5HandoffProjection.InitiativeRevision == resolved.Revision &&
              p5HandoffProjection.InitiativeDigest == resolved.Digest &&
              p5HandoffProjection.AssessmentState == "attention-required" &&
              p5HandoffProjection.ReadinessResult == "incomplete" &&
              p5HandoffProjection.TransferState == "held" &&
              p5HandoffProjection.Handoff?.ItemCount == 25 &&
              p5HandoffProjection.Handoff?.RequirementCount == 66 &&
              p5HandoffProjection.Handoff?.DeliveryMode == "disconnected",
            "Typed P5 Handoff Package preserves exact Product, Initiative, candidate inventory, and transfer metadata");
        var p5HandoffOutput = await initiativeController.ReadP5HandoffPackageAsync(InitiativeId);
        Check(p5HandoffOutput.Contains("GAEP governed P5 Handoff Package candidate", StringComparison.Ordinal) &&
              p5HandoffOutput.Contains("17 included · 3 exact references · 4 candidate not applicable · 1 unresolved", StringComparison.Ordinal) &&
              p5HandoffOutput.Contains("source ownership remains retained", StringComparison.Ordinal) &&
              p5HandoffOutput.Contains("complete for review is not acknowledgement", StringComparison.Ordinal) &&
              !p5HandoffOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !p5HandoffOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !p5HandoffOutput.Contains("itemContent", StringComparison.Ordinal),
            "P5 Handoff Package workflow renders privacy-safe metadata with explicit ownership and no-authority boundaries");
        foreach (var hostileRoot in new[] { badP5HandoffSnapshotDigestRoot, badP5HandoffSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadP5HandoffPackageAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "P5 Handoff Package rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badP5HandoffSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadP5HandoffPackageAsync(InitiativeId),
                "P5 Handoff Package rejects a projection rebound to a substituted Product revision");
        }

        var designApplicabilityProjection = await client.ReadDesignApplicabilityAsync(InitiativeId);
        Check(designApplicabilityProjection.ProductId == product.Id &&
              designApplicabilityProjection.ProductRevision == product.Revision &&
              designApplicabilityProjection.ProductDigest == product.Digest &&
              designApplicabilityProjection.InitiativeId == resolved.Id &&
              designApplicabilityProjection.InitiativeRevision == resolved.Revision &&
              designApplicabilityProjection.InitiativeDigest == resolved.Digest &&
              designApplicabilityProjection.AssessmentState == "attention-required" &&
              designApplicabilityProjection.ReviewState == "held" &&
              designApplicabilityProjection.ScopeCount == 2 &&
              designApplicabilityProjection.DecisionCount == 8 &&
              designApplicabilityProjection.Candidate?.ScopeCount == 2,
            "Typed Design Applicability preserves exact Product, Initiative, assessment, and candidate coverage metadata");
        var designApplicabilityOutput = await initiativeController.ReadDesignApplicabilityAsync(InitiativeId);
        Check(designApplicabilityOutput.Contains("GAEP governed Design Applicability candidate", StringComparison.Ordinal) &&
              designApplicabilityOutput.Contains("Coverage: 2 scopes · 8 explicit", StringComparison.Ordinal) &&
              designApplicabilityOutput.Contains("silence is never not applicable", StringComparison.Ordinal) &&
              designApplicabilityOutput.Contains("does not approve design", StringComparison.Ordinal) &&
              !designApplicabilityOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designApplicabilityOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designApplicabilityOutput.Contains("rationale", StringComparison.Ordinal) &&
              !designApplicabilityOutput.Contains("journey", StringComparison.OrdinalIgnoreCase),
            "Design Applicability workflow renders privacy-safe metadata with explicit no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignApplicabilitySnapshotDigestRoot, badDesignApplicabilitySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignApplicabilityAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Applicability rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignApplicabilitySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignApplicabilityAsync(InitiativeId),
                "Design Applicability rejects a projection rebound to a substituted Product revision");
        }

        var designPersonaRoleProjection = await client.ReadDesignPersonaRoleModelAsync(InitiativeId);
        Check(designPersonaRoleProjection.ProductId == product.Id &&
              designPersonaRoleProjection.ProductRevision == product.Revision &&
              designPersonaRoleProjection.ProductDigest == product.Digest &&
              designPersonaRoleProjection.InitiativeId == resolved.Id &&
              designPersonaRoleProjection.InitiativeRevision == resolved.Revision &&
              designPersonaRoleProjection.InitiativeDigest == resolved.Digest &&
              designPersonaRoleProjection.AssessmentState == "attention-required" &&
              designPersonaRoleProjection.ReviewState == "held" &&
              designPersonaRoleProjection.PersonaCount == 2 &&
              designPersonaRoleProjection.DesignRoleCount == 1 &&
              designPersonaRoleProjection.Candidate?.PersonaCount == 2,
            "Typed Design Personas and Roles preserves exact Product, Initiative, assessment, and privacy-safe coverage metadata");
        var designPersonaRoleOutput = await initiativeController.ReadDesignPersonaRoleModelAsync(InitiativeId);
        Check(designPersonaRoleOutput.Contains("GAEP governed Design Personas and Roles candidate", StringComparison.Ordinal) &&
              designPersonaRoleOutput.Contains("Coverage: 2 personas · 1 design roles · 4/5 participant categories", StringComparison.Ordinal) &&
              designPersonaRoleOutput.Contains("no persona validation", StringComparison.Ordinal) &&
              designPersonaRoleOutput.Contains("role appointment", StringComparison.Ordinal) &&
              !designPersonaRoleOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designPersonaRoleOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designPersonaRoleOutput.Contains("personaBehavior", StringComparison.Ordinal) &&
              !designPersonaRoleOutput.Contains("constraints", StringComparison.OrdinalIgnoreCase),
            "Design Personas and Roles workflow renders privacy-safe metadata with explicit no-validation and no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignPersonaRoleSnapshotDigestRoot, badDesignPersonaRoleSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignPersonaRoleModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Personas and Roles rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignPersonaRoleSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignPersonaRoleModelAsync(InitiativeId),
                "Design Personas and Roles rejects a projection rebound to a substituted Product revision");
        }

        var userJourneyProjection = await client.ReadUserJourneyModelAsync(InitiativeId);
        Check(userJourneyProjection.ProductId == product.Id &&
              userJourneyProjection.ProductRevision == product.Revision &&
              userJourneyProjection.ProductDigest == product.Digest &&
              userJourneyProjection.InitiativeId == resolved.Id &&
              userJourneyProjection.InitiativeRevision == resolved.Revision &&
              userJourneyProjection.InitiativeDigest == resolved.Digest &&
              userJourneyProjection.AssessmentState == "attention-required" &&
              userJourneyProjection.ReviewState == "held" &&
              userJourneyProjection.JourneyCount == 2 &&
              userJourneyProjection.TouchpointCount == 3 &&
              userJourneyProjection.FailurePathCount == 2 &&
              userJourneyProjection.RecoveryPathCount == 2 &&
              userJourneyProjection.Candidate?.JourneyCount == 2,
            "Typed User Journeys preserves exact Product, Initiative, assessment, and privacy-safe path metadata");
        var userJourneyOutput = await initiativeController.ReadUserJourneyModelAsync(InitiativeId);
        Check(userJourneyOutput.Contains("GAEP governed User Journeys candidate", StringComparison.Ordinal) &&
              userJourneyOutput.Contains("Inventory: 2 journeys · 3 touchpoints", StringComparison.Ordinal) &&
              userJourneyOutput.Contains("2 primary · 2 success · 2 failure · 2 recovery", StringComparison.Ordinal) &&
              userJourneyOutput.Contains("no observed-behavior proof", StringComparison.Ordinal) &&
              userJourneyOutput.Contains("journey validation", StringComparison.Ordinal) &&
              !userJourneyOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !userJourneyOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !userJourneyOutput.Contains("journeyStep", StringComparison.Ordinal) &&
              !userJourneyOutput.Contains("touchpoint content", StringComparison.OrdinalIgnoreCase),
            "User Journeys workflow renders privacy-safe metadata with explicit no-validation and no-authority boundaries");
        foreach (var hostileRoot in new[] { badUserJourneySnapshotDigestRoot, badUserJourneySnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadUserJourneyModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "User Journeys rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badUserJourneySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadUserJourneyModelAsync(InitiativeId),
                "User Journeys rejects a projection rebound to a substituted Product revision");
        }

        var informationArchitectureProjection = await client.ReadInformationArchitectureModelAsync(InitiativeId);
        Check(informationArchitectureProjection.ProductId == product.Id &&
              informationArchitectureProjection.ProductRevision == product.Revision &&
              informationArchitectureProjection.ProductDigest == product.Digest &&
              informationArchitectureProjection.InitiativeId == resolved.Id &&
              informationArchitectureProjection.InitiativeRevision == resolved.Revision &&
              informationArchitectureProjection.InitiativeDigest == resolved.Digest &&
              informationArchitectureProjection.AssessmentState == "attention-required" &&
              informationArchitectureProjection.ReviewState == "held" &&
              informationArchitectureProjection.NodeCount == 6 &&
              informationArchitectureProjection.RootNodeCount == 2 &&
              informationArchitectureProjection.RouteCount == 8 &&
              informationArchitectureProjection.Candidate?.NodeCount == 6,
            "Typed Information Architecture preserves exact Product, Initiative, assessment, and privacy-safe hierarchy metadata");
        var informationArchitectureOutput = await initiativeController.ReadInformationArchitectureModelAsync(InitiativeId);
        Check(informationArchitectureOutput.Contains("GAEP governed Information Architecture candidate", StringComparison.Ordinal) &&
              informationArchitectureOutput.Contains("Inventory: 6 nodes · 2 roots · 8 routes", StringComparison.Ordinal) &&
              informationArchitectureOutput.Contains("2 weak-evidence nodes · 1 weak-evidence routes", StringComparison.Ordinal) &&
              informationArchitectureOutput.Contains("no findability", StringComparison.Ordinal) &&
              informationArchitectureOutput.Contains("content validation", StringComparison.Ordinal) &&
              !informationArchitectureOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !informationArchitectureOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !informationArchitectureOutput.Contains("nodeLabel", StringComparison.Ordinal) &&
              !informationArchitectureOutput.Contains("private route", StringComparison.OrdinalIgnoreCase),
            "Information Architecture workflow renders privacy-safe metadata with explicit no-validation and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badInformationArchitectureSnapshotDigestRoot, badInformationArchitectureSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadInformationArchitectureModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Information Architecture rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badInformationArchitectureSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadInformationArchitectureModelAsync(InitiativeId),
                "Information Architecture rejects a projection rebound to a substituted Product revision");
        }

        var screenStateInventoryProjection = await client.ReadScreenStateInventoryAsync(InitiativeId);
        Check(screenStateInventoryProjection.ProductId == product.Id &&
              screenStateInventoryProjection.ProductRevision == product.Revision &&
              screenStateInventoryProjection.ProductDigest == product.Digest &&
              screenStateInventoryProjection.InitiativeId == resolved.Id &&
              screenStateInventoryProjection.InitiativeRevision == resolved.Revision &&
              screenStateInventoryProjection.InitiativeDigest == resolved.Digest &&
              screenStateInventoryProjection.AssessmentState == "attention-required" &&
              screenStateInventoryProjection.ReviewState == "held" &&
              screenStateInventoryProjection.PlatformCount == 3 &&
              screenStateInventoryProjection.ScreenCount == 9 &&
              screenStateInventoryProjection.StateCount == 18 &&
              screenStateInventoryProjection.Candidate?.VariantCount == 5,
            "Typed Screen and State Inventory preserves exact Product, Initiative, assessment, and privacy-safe inventory metadata");
        var screenStateInventoryOutput = await initiativeController.ReadScreenStateInventoryAsync(InitiativeId);
        Check(screenStateInventoryOutput.Contains("GAEP governed Screen and State Inventory candidate", StringComparison.Ordinal) &&
              screenStateInventoryOutput.Contains("Inventory: 9 screens · 18 states · 5 variants", StringComparison.Ordinal) &&
              screenStateInventoryOutput.Contains("2 weak-evidence items", StringComparison.Ordinal) &&
              screenStateInventoryOutput.Contains("no UI completeness", StringComparison.Ordinal) &&
              screenStateInventoryOutput.Contains("accessibility proof", StringComparison.Ordinal) &&
              !screenStateInventoryOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !screenStateInventoryOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !screenStateInventoryOutput.Contains("screenLabel", StringComparison.Ordinal) &&
              !screenStateInventoryOutput.Contains("private screen", StringComparison.OrdinalIgnoreCase),
            "Screen and State Inventory workflow renders privacy-safe metadata with explicit no-proof and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badScreenStateInventorySnapshotDigestRoot, badScreenStateInventorySnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadScreenStateInventoryAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Screen and State Inventory rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badScreenStateInventorySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadScreenStateInventoryAsync(InitiativeId),
                "Screen and State Inventory rejects a projection rebound to a substituted Product revision");
        }

        var designRequirementsProjection = await client.ReadDesignRequirementsAsync(InitiativeId);
        Check(designRequirementsProjection.ProductId == product.Id &&
              designRequirementsProjection.ProductRevision == product.Revision &&
              designRequirementsProjection.ProductDigest == product.Digest &&
              designRequirementsProjection.InitiativeId == resolved.Id &&
              designRequirementsProjection.InitiativeRevision == resolved.Revision &&
              designRequirementsProjection.InitiativeDigest == resolved.Digest &&
              designRequirementsProjection.AssessmentState == "attention-required" &&
              designRequirementsProjection.ReviewState == "held" &&
              designRequirementsProjection.CatalogCompletenessState == "not-assessed" &&
              designRequirementsProjection.RequirementCount == 12 &&
              designRequirementsProjection.MustPriorityCount == 5 &&
              designRequirementsProjection.RepresentedOutcomeCount == 4 &&
              designRequirementsProjection.Candidate?.WorkItemCount == 10,
            "Typed Design Requirements preserves exact Product, Initiative, assessment, outcome, backlog, and privacy-safe inventory metadata");
        var designRequirementsOutput = await initiativeController.ReadDesignRequirementsAsync(InitiativeId);
        Check(designRequirementsOutput.Contains("GAEP governed Design Requirements candidate", StringComparison.Ordinal) &&
              designRequirementsOutput.Contains("12 requirements · 5 must-priority · 10 Work Items", StringComparison.Ordinal) &&
              designRequirementsOutput.Contains("3 weak-evidence requirements", StringComparison.Ordinal) &&
              designRequirementsOutput.Contains("no requirement validity", StringComparison.Ordinal) &&
              !designRequirementsOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designRequirementsOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designRequirementsOutput.Contains("requirementStatement", StringComparison.Ordinal) &&
              !designRequirementsOutput.Contains("private requirement", StringComparison.OrdinalIgnoreCase),
            "Design Requirements workflow renders privacy-safe metadata with explicit no-validity and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badDesignRequirementsSnapshotDigestRoot, badDesignRequirementsSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignRequirementsAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Requirements rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignRequirementsSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignRequirementsAsync(InitiativeId),
                "Design Requirements rejects a projection rebound to a substituted Product revision");
        }

        var backlogHierarchyProjection = await client.ReadBacklogHierarchyAsync(InitiativeId);
        Check(backlogHierarchyProjection.ProductId == product.Id &&
              backlogHierarchyProjection.ProductRevision == product.Revision &&
              backlogHierarchyProjection.ProductDigest == product.Digest &&
              backlogHierarchyProjection.InitiativeId == resolved.Id &&
              backlogHierarchyProjection.InitiativeRevision == resolved.Revision &&
              backlogHierarchyProjection.InitiativeDigest == resolved.Digest &&
              backlogHierarchyProjection.AssessmentState == "attention-required" &&
              backlogHierarchyProjection.ReviewState == "held" &&
              backlogHierarchyProjection.HierarchyCompletenessState == "not-assessed" &&
              backlogHierarchyProjection.NodeCount == 24 &&
              backlogHierarchyProjection.EpicCount == 2 &&
              backlogHierarchyProjection.FeatureCount == 5 &&
              backlogHierarchyProjection.StoryCount == 8 &&
              backlogHierarchyProjection.TaskCount == 9 &&
              backlogHierarchyProjection.Candidate?.RequirementTraceCount == 17,
            "Typed Backlog Hierarchy preserves exact Product, Initiative, assessment, topology, trace, and privacy-safe inventory metadata");
        var backlogHierarchyOutput = await initiativeController.ReadBacklogHierarchyAsync(InitiativeId);
        Check(backlogHierarchyOutput.Contains("GAEP governed Backlog Hierarchy candidate", StringComparison.Ordinal) &&
              backlogHierarchyOutput.Contains("2 Epics · 5 Features · 8 Stories · 9 Tasks", StringComparison.Ordinal) &&
              backlogHierarchyOutput.Contains("1 untraced delivery nodes", StringComparison.Ordinal) &&
              backlogHierarchyOutput.Contains("no backlog objectives", StringComparison.Ordinal) &&
              !backlogHierarchyOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !backlogHierarchyOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !backlogHierarchyOutput.Contains("workItemObjective", StringComparison.Ordinal),
            "Backlog Hierarchy workflow renders privacy-safe metadata with explicit no-content and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badBacklogHierarchySnapshotDigestRoot, badBacklogHierarchySnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadBacklogHierarchyAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Backlog Hierarchy rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badBacklogHierarchySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadBacklogHierarchyAsync(InitiativeId),
                "Backlog Hierarchy rejects a projection rebound to a substituted Product revision");
        }

        var mvpSliceProjection = await client.ReadMvpSliceDefinitionAsync(InitiativeId);
        Check(mvpSliceProjection.ProductId == product.Id &&
              mvpSliceProjection.ProductRevision == product.Revision &&
              mvpSliceProjection.ProductDigest == product.Digest &&
              mvpSliceProjection.InitiativeId == resolved.Id &&
              mvpSliceProjection.InitiativeRevision == resolved.Revision &&
              mvpSliceProjection.InitiativeDigest == resolved.Digest &&
              mvpSliceProjection.AssessmentState == "attention-required" &&
              mvpSliceProjection.ReviewState == "held" &&
              mvpSliceProjection.ScopeCompletenessState == "not-assessed" &&
              mvpSliceProjection.ScopeNodeCount == 24 &&
              mvpSliceProjection.MvpNodeCount == 16 &&
              mvpSliceProjection.LaterNodeCount == 5 &&
              mvpSliceProjection.ExcludedNodeCount == 3 &&
              mvpSliceProjection.SliceCount == 4 &&
              mvpSliceProjection.StoryCount == 7 &&
              mvpSliceProjection.TaskCount == 9 &&
              mvpSliceProjection.HierarchyDigest == mvpSliceProjection.Candidate?.HierarchyDigest,
            "Typed MVP and Vertical Slice projection preserves exact Product, Initiative, hierarchy, assessment, scope, slice, and privacy-safe inventory metadata");
        var mvpSliceOutput = await initiativeController.ReadMvpSliceDefinitionAsync(InitiativeId);
        Check(mvpSliceOutput.Contains("GAEP governed MVP and Vertical Slice candidate", StringComparison.Ordinal) &&
              mvpSliceOutput.Contains("24 nodes · 16 MVP · 5 later · 3 excluded", StringComparison.Ordinal) &&
              mvpSliceOutput.Contains("4 slices · 7 Stories · 9 Tasks", StringComparison.Ordinal) &&
              mvpSliceOutput.Contains("no slice titles", StringComparison.Ordinal) &&
              !mvpSliceOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !mvpSliceOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !mvpSliceOutput.Contains("sliceRationale", StringComparison.Ordinal),
            "MVP and Vertical Slice workflow renders privacy-safe metadata with explicit no-content and no-authority boundaries");
        foreach (var hostileRoot in new[] { badMvpSliceSnapshotDigestRoot, badMvpSliceSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadMvpSliceDefinitionAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "MVP and Vertical Slice projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[] { badMvpSliceSnapshotBindingRoot, badMvpSliceHierarchyBindingRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadMvpSliceDefinitionAsync(InitiativeId),
                "MVP and Vertical Slice workflow rejects substituted Product or current Backlog Hierarchy bindings");
        }

        var prioritizationProjection = await client.ReadPrioritizationModelAsync(InitiativeId);
        Check(prioritizationProjection.ProductId == product.Id &&
              prioritizationProjection.ProductRevision == product.Revision &&
              prioritizationProjection.ProductDigest == product.Digest &&
              prioritizationProjection.InitiativeId == resolved.Id &&
              prioritizationProjection.InitiativeRevision == resolved.Revision &&
              prioritizationProjection.InitiativeDigest == resolved.Digest &&
              prioritizationProjection.AssessmentState == "attention-required" &&
              prioritizationProjection.ReviewState == "held" &&
              prioritizationProjection.SubjectCount == 4 &&
              prioritizationProjection.ScoredSubjectCount == 3 &&
              prioritizationProjection.UnassessedSubjectCount == 1 &&
              prioritizationProjection.EvidenceReferenceCount == 12 &&
              prioritizationProjection.TieCount == 1,
            "Typed Prioritization Model projection preserves exact Product, Initiative, assessment, coverage, and privacy-safe metadata");
        var prioritizationOutput = await initiativeController.ReadPrioritizationModelAsync(InitiativeId);
        Check(prioritizationOutput.Contains("GAEP governed Prioritization Model candidate", StringComparison.Ordinal) &&
              prioritizationOutput.Contains("4 slices · 3 scored · 1 unassessed · 12 evidence references", StringComparison.Ordinal) &&
              prioritizationOutput.Contains("no dimension estimates", StringComparison.Ordinal) &&
              !prioritizationOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !prioritizationOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !prioritizationOutput.Contains("dimensionEstimate", StringComparison.Ordinal),
            "Prioritization Model workflow renders privacy-safe metadata with explicit no-content and no-authority boundaries");
        foreach (var hostileRoot in new[] { badPrioritizationSnapshotDigestRoot, badPrioritizationSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadPrioritizationModelAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Prioritization Model projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[] { badPrioritizationSnapshotBindingRoot, badPrioritizationMvpBindingRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadPrioritizationModelAsync(InitiativeId),
                "Prioritization Model workflow rejects substituted Product or current MVP bindings");
        }

        var acceptanceCriteriaProjection = await client.ReadAcceptanceCriteriaAsync(InitiativeId);
        Check(acceptanceCriteriaProjection.ProductId == product.Id &&
              acceptanceCriteriaProjection.ProductRevision == product.Revision &&
              acceptanceCriteriaProjection.ProductDigest == product.Digest &&
              acceptanceCriteriaProjection.InitiativeId == resolved.Id &&
              acceptanceCriteriaProjection.InitiativeRevision == resolved.Revision &&
              acceptanceCriteriaProjection.InitiativeDigest == resolved.Digest &&
              acceptanceCriteriaProjection.AssessmentState == "attention-required" &&
              acceptanceCriteriaProjection.ReviewState == "held" &&
              acceptanceCriteriaProjection.CriterionSetCompletenessState == "not-assessed" &&
              acceptanceCriteriaProjection.RequirementCoverageState == "not-assessed" &&
              acceptanceCriteriaProjection.SubjectCount == 16 &&
              acceptanceCriteriaProjection.CoveredSubjectCount == 15 &&
              acceptanceCriteriaProjection.CriterionCount == 28 &&
              acceptanceCriteriaProjection.TestableCriterionCount == 26 &&
              acceptanceCriteriaProjection.RequirementTraceCount == 34 &&
              acceptanceCriteriaProjection.VerificationMethodCount == 5,
            "Typed Acceptance Criteria projection preserves exact Product, Initiative, assessment, coverage, and privacy-safe metadata");
        var acceptanceCriteriaOutput = await initiativeController.ReadAcceptanceCriteriaAsync(InitiativeId);
        Check(acceptanceCriteriaOutput.Contains("GAEP governed Acceptance Criteria candidate", StringComparison.Ordinal) &&
              acceptanceCriteriaOutput.Contains("16 Story/Task subjects · 15 covered · 1 uncovered · 28 criteria · 26 testable", StringComparison.Ordinal) &&
              acceptanceCriteriaOutput.Contains("no criterion text", StringComparison.Ordinal) &&
              !acceptanceCriteriaOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !acceptanceCriteriaOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !acceptanceCriteriaOutput.Contains("criterionText", StringComparison.Ordinal),
            "Acceptance Criteria workflow renders privacy-safe metadata with explicit no-content and no-authority boundaries");
        foreach (var hostileRoot in new[] { badAcceptanceCriteriaSnapshotDigestRoot, badAcceptanceCriteriaSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadAcceptanceCriteriaAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Acceptance Criteria projection rejects hostile digest and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badAcceptanceCriteriaSnapshotBindingRoot,
                     badAcceptanceCriteriaHierarchyBindingRoot,
                     badAcceptanceCriteriaMvpBindingRoot,
                     badAcceptanceCriteriaPrioritizationBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadAcceptanceCriteriaAsync(InitiativeId),
                "Acceptance Criteria workflow rejects substituted Product or current planning dependency bindings");
        }

        var designSystemTokenContractProjection = await client.ReadDesignSystemTokenContractAsync(InitiativeId);
        Check(designSystemTokenContractProjection.ProductId == product.Id &&
              designSystemTokenContractProjection.ProductRevision == product.Revision &&
              designSystemTokenContractProjection.ProductDigest == product.Digest &&
              designSystemTokenContractProjection.InitiativeId == resolved.Id &&
              designSystemTokenContractProjection.InitiativeRevision == resolved.Revision &&
              designSystemTokenContractProjection.InitiativeDigest == resolved.Digest &&
              designSystemTokenContractProjection.AssessmentState == "attention-required" &&
              designSystemTokenContractProjection.ReviewState == "held" &&
              designSystemTokenContractProjection.CatalogCompletenessState == "not-assessed" &&
              designSystemTokenContractProjection.DesignSystemCount == 2 &&
              designSystemTokenContractProjection.TokenCount == 48 &&
              designSystemTokenContractProjection.VariableCount == 19 &&
              designSystemTokenContractProjection.ComponentCount == 12 &&
              designSystemTokenContractProjection.Candidate?.RepresentedRequirementCount == 10,
            "Typed Design System and Token Contract preserves exact Product, Initiative, assessment, coverage, and privacy-safe inventory metadata");
        var designSystemTokenContractOutput = await initiativeController.ReadDesignSystemTokenContractAsync(InitiativeId);
        Check(designSystemTokenContractOutput.Contains("GAEP governed Design System and Token Contract candidate", StringComparison.Ordinal) &&
              designSystemTokenContractOutput.Contains("2 systems · 48 tokens · 3 collections · 19 variables · 12 components", StringComparison.Ordinal) &&
              designSystemTokenContractOutput.Contains("4 accessibility review", StringComparison.Ordinal) &&
              designSystemTokenContractOutput.Contains("no system, token, variable", StringComparison.Ordinal) &&
              !designSystemTokenContractOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designSystemTokenContractOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designSystemTokenContractOutput.Contains("tokenValue", StringComparison.Ordinal),
            "Design System and Token Contract workflow renders privacy-safe metadata with explicit no-validity and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badDesignSystemTokenContractSnapshotDigestRoot, badDesignSystemTokenContractSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignSystemTokenContractAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design System and Token Contract rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignSystemTokenContractSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignSystemTokenContractAsync(InitiativeId),
                "Design System and Token Contract rejects a projection rebound to a substituted Product revision");
        }

        var accessibilityDesignRulesProjection = await client.ReadAccessibilityDesignRulesAsync(InitiativeId);
        Check(accessibilityDesignRulesProjection.ProductId == product.Id &&
              accessibilityDesignRulesProjection.ProductRevision == product.Revision &&
              accessibilityDesignRulesProjection.ProductDigest == product.Digest &&
              accessibilityDesignRulesProjection.InitiativeId == resolved.Id &&
              accessibilityDesignRulesProjection.InitiativeRevision == resolved.Revision &&
              accessibilityDesignRulesProjection.InitiativeDigest == resolved.Digest &&
              accessibilityDesignRulesProjection.AssessmentState == "attention-required" &&
              accessibilityDesignRulesProjection.ReviewState == "held" &&
              accessibilityDesignRulesProjection.CatalogCompletenessState == "not-assessed" &&
              accessibilityDesignRulesProjection.TargetCount == 12 &&
              accessibilityDesignRulesProjection.RuleCount == 18 &&
              accessibilityDesignRulesProjection.CheckCount == 24 &&
              accessibilityDesignRulesProjection.HumanReviewedCheckCount == 17 &&
              accessibilityDesignRulesProjection.Candidate?.RepresentedRequirementCount == 10,
            "Typed Accessibility Design Rules preserves exact Product, Initiative, assessment, coverage, and privacy-safe inventory metadata");
        var accessibilityDesignRulesOutput = await initiativeController.ReadAccessibilityDesignRulesAsync(InitiativeId);
        Check(accessibilityDesignRulesOutput.Contains("GAEP governed Accessibility Design Rules candidate", StringComparison.Ordinal) &&
              accessibilityDesignRulesOutput.Contains("12 targets · 18 rules · 24 checks", StringComparison.Ordinal) &&
              accessibilityDesignRulesOutput.Contains("17 human-reviewed", StringComparison.Ordinal) &&
              accessibilityDesignRulesOutput.Contains("no accessibility conformance", StringComparison.Ordinal) &&
              !accessibilityDesignRulesOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !accessibilityDesignRulesOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !accessibilityDesignRulesOutput.Contains("ruleProcedure", StringComparison.Ordinal),
            "Accessibility Design Rules workflow renders privacy-safe metadata with explicit no-conformance and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badAccessibilityDesignRulesSnapshotDigestRoot, badAccessibilityDesignRulesSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadAccessibilityDesignRulesAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Accessibility Design Rules rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badAccessibilityDesignRulesSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadAccessibilityDesignRulesAsync(InitiativeId),
                "Accessibility Design Rules rejects a projection rebound to a substituted Product revision");
        }

        var responsiveMultiPlatformTargetsProjection = await client.ReadResponsiveMultiPlatformTargetsAsync(InitiativeId);
        Check(responsiveMultiPlatformTargetsProjection.ProductId == product.Id &&
              responsiveMultiPlatformTargetsProjection.ProductRevision == product.Revision &&
              responsiveMultiPlatformTargetsProjection.ProductDigest == product.Digest &&
              responsiveMultiPlatformTargetsProjection.InitiativeId == resolved.Id &&
              responsiveMultiPlatformTargetsProjection.InitiativeRevision == resolved.Revision &&
              responsiveMultiPlatformTargetsProjection.InitiativeDigest == resolved.Digest &&
              responsiveMultiPlatformTargetsProjection.AssessmentState == "attention-required" &&
              responsiveMultiPlatformTargetsProjection.ReviewState == "held" &&
              responsiveMultiPlatformTargetsProjection.TargetCatalogState == "candidate-complete" &&
              responsiveMultiPlatformTargetsProjection.BreakpointCatalogState == "not-assessed" &&
              responsiveMultiPlatformTargetsProjection.BehaviorCatalogState == "not-assessed" &&
              responsiveMultiPlatformTargetsProjection.PlatformTargetCount == 3 &&
              responsiveMultiPlatformTargetsProjection.BreakpointCount == 5 &&
              responsiveMultiPlatformTargetsProjection.BehaviorCount == 14 &&
              responsiveMultiPlatformTargetsProjection.CheckCount == 22 &&
              responsiveMultiPlatformTargetsProjection.HumanReviewedCheckCount == 17 &&
              responsiveMultiPlatformTargetsProjection.Candidate?.RepresentedRequirementCount == 10,
            "Typed Responsive and Multi-Platform Targets preserves exact Product, Initiative, assessment, coverage, and privacy-safe inventory metadata");
        var responsiveMultiPlatformTargetsOutput = await initiativeController.ReadResponsiveMultiPlatformTargetsAsync(InitiativeId);
        Check(responsiveMultiPlatformTargetsOutput.Contains("GAEP governed Responsive and Multi-Platform Targets candidate", StringComparison.Ordinal) &&
              responsiveMultiPlatformTargetsOutput.Contains("3 platform targets · 5 breakpoints · 14 behaviors · 22 checks", StringComparison.Ordinal) &&
              responsiveMultiPlatformTargetsOutput.Contains("17 human-reviewed", StringComparison.Ordinal) &&
              responsiveMultiPlatformTargetsOutput.Contains("no responsive completeness", StringComparison.Ordinal) &&
              !responsiveMultiPlatformTargetsOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !responsiveMultiPlatformTargetsOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !responsiveMultiPlatformTargetsOutput.Contains("behaviorProcedure", StringComparison.Ordinal),
            "Responsive and Multi-Platform Targets workflow renders privacy-safe metadata with explicit no-completeness and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badResponsiveMultiPlatformTargetsSnapshotDigestRoot, badResponsiveMultiPlatformTargetsSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadResponsiveMultiPlatformTargetsAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Responsive and Multi-Platform Targets rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badResponsiveMultiPlatformTargetsSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadResponsiveMultiPlatformTargetsAsync(InitiativeId),
                "Responsive and Multi-Platform Targets rejects a projection rebound to a substituted Product revision");
        }

        var manualFigmaExecutionPathProjection = await client.ReadManualFigmaExecutionPathAsync(InitiativeId);
        Check(manualFigmaExecutionPathProjection.ProductId == product.Id &&
              manualFigmaExecutionPathProjection.ProductRevision == product.Revision &&
              manualFigmaExecutionPathProjection.ProductDigest == product.Digest &&
              manualFigmaExecutionPathProjection.InitiativeId == resolved.Id &&
              manualFigmaExecutionPathProjection.InitiativeRevision == resolved.Revision &&
              manualFigmaExecutionPathProjection.InitiativeDigest == resolved.Digest &&
              manualFigmaExecutionPathProjection.AssessmentState == "attention-required" &&
              manualFigmaExecutionPathProjection.ReviewState == "held" &&
              manualFigmaExecutionPathProjection.GuideCatalogState == "candidate-complete" &&
              manualFigmaExecutionPathProjection.HandoffCatalogState == "candidate-complete" &&
              manualFigmaExecutionPathProjection.ReturnContractState == "not-assessed" &&
              manualFigmaExecutionPathProjection.ScopeCount == 3 &&
              manualFigmaExecutionPathProjection.InstructionCount == 5 &&
              manualFigmaExecutionPathProjection.CheckCount == 24 &&
              manualFigmaExecutionPathProjection.HumanReviewedCheckCount == 19 &&
              manualFigmaExecutionPathProjection.Candidate?.RepresentedRequirementCount == 10,
            "Typed Manual Figma Execution Path preserves exact Product, Initiative, assessment, coverage, and privacy-safe inventory metadata");
        var manualFigmaExecutionPathOutput = await initiativeController.ReadManualFigmaExecutionPathAsync(InitiativeId);
        Check(manualFigmaExecutionPathOutput.Contains("GAEP governed Manual Figma Execution Path candidate", StringComparison.Ordinal) &&
              manualFigmaExecutionPathOutput.Contains("3 scopes · 5 instruction stages · 24 checks", StringComparison.Ordinal) &&
              manualFigmaExecutionPathOutput.Contains("19 human-reviewed", StringComparison.Ordinal) &&
              manualFigmaExecutionPathOutput.Contains("no Figma connection", StringComparison.Ordinal) &&
              !manualFigmaExecutionPathOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !manualFigmaExecutionPathOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !manualFigmaExecutionPathOutput.Contains("handoffContent", StringComparison.Ordinal),
            "Manual Figma Execution Path workflow renders privacy-safe metadata with explicit disconnected and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badManualFigmaExecutionPathSnapshotDigestRoot, badManualFigmaExecutionPathSnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadManualFigmaExecutionPathAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Manual Figma Execution Path rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badManualFigmaExecutionPathSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadManualFigmaExecutionPathAsync(InitiativeId),
                "Manual Figma Execution Path rejects a projection rebound to a substituted Product revision");
        }

        var figmaMcpCapabilityDiscoveryProjection = await client.ReadFigmaMcpCapabilityDiscoveryAsync(InitiativeId);
        Check(figmaMcpCapabilityDiscoveryProjection.ProductId == product.Id &&
              figmaMcpCapabilityDiscoveryProjection.ProductRevision == product.Revision &&
              figmaMcpCapabilityDiscoveryProjection.ProductDigest == product.Digest &&
              figmaMcpCapabilityDiscoveryProjection.InitiativeId == resolved.Id &&
              figmaMcpCapabilityDiscoveryProjection.InitiativeRevision == resolved.Revision &&
              figmaMcpCapabilityDiscoveryProjection.InitiativeDigest == resolved.Digest &&
              figmaMcpCapabilityDiscoveryProjection.AssessmentState == "attention-required" &&
              figmaMcpCapabilityDiscoveryProjection.ReviewState == "held" &&
              figmaMcpCapabilityDiscoveryProjection.CatalogState == "candidate-observation-complete" &&
              figmaMcpCapabilityDiscoveryProjection.PermissionModelState == "candidate-separated" &&
              figmaMcpCapabilityDiscoveryProjection.LimitCatalogState == "not-assessed" &&
              figmaMcpCapabilityDiscoveryProjection.VersionCatalogState == "not-assessed" &&
              figmaMcpCapabilityDiscoveryProjection.ToolCount == 7 &&
              figmaMcpCapabilityDiscoveryProjection.AdvertisedToolCount == 5 &&
              figmaMcpCapabilityDiscoveryProjection.ReadToolCount == 3 &&
              figmaMcpCapabilityDiscoveryProjection.WriteToolCount == 2 &&
              figmaMcpCapabilityDiscoveryProjection.HumanReviewedToolCount == 4 &&
              figmaMcpCapabilityDiscoveryProjection.Candidate?.ToolCount == 7,
            "Typed Figma MCP Capability Discovery preserves exact Product, Initiative, assessment, catalog, and privacy-safe inventory metadata");
        var figmaMcpCapabilityDiscoveryOutput = await initiativeController.ReadFigmaMcpCapabilityDiscoveryAsync(InitiativeId);
        Check(figmaMcpCapabilityDiscoveryOutput.Contains("GAEP governed Figma MCP Capability Discovery candidate", StringComparison.Ordinal) &&
              figmaMcpCapabilityDiscoveryOutput.Contains("7 tool observations · 5 advertised", StringComparison.Ordinal) &&
              figmaMcpCapabilityDiscoveryOutput.Contains("4 human-reviewed", StringComparison.Ordinal) &&
              figmaMcpCapabilityDiscoveryOutput.Contains("no Figma connection or call", StringComparison.Ordinal) &&
              !figmaMcpCapabilityDiscoveryOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !figmaMcpCapabilityDiscoveryOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !figmaMcpCapabilityDiscoveryOutput.Contains("toolNames", StringComparison.Ordinal),
            "Figma MCP Capability Discovery workflow renders privacy-safe metadata with explicit disconnected and no-authority boundaries");
        foreach (var hostileRoot in new[] {
                     badFigmaMcpCapabilityDiscoverySnapshotDigestRoot, badFigmaMcpCapabilityDiscoverySnapshotPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadFigmaMcpCapabilityDiscoveryAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Figma MCP Capability Discovery rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badFigmaMcpCapabilityDiscoverySnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadFigmaMcpCapabilityDiscoveryAsync(InitiativeId),
                "Figma MCP Capability Discovery rejects a projection rebound to a substituted Product revision");
        }

        var figmaReadSnapshotProjection = await client.ReadFigmaReadSnapshotAsync(InitiativeId);
        Check(figmaReadSnapshotProjection.ProductId == product.Id &&
              figmaReadSnapshotProjection.ProductRevision == product.Revision &&
              figmaReadSnapshotProjection.ProductDigest == product.Digest &&
              figmaReadSnapshotProjection.InitiativeId == resolved.Id &&
              figmaReadSnapshotProjection.InitiativeRevision == resolved.Revision &&
              figmaReadSnapshotProjection.InitiativeDigest == resolved.Digest &&
              figmaReadSnapshotProjection.AssessmentState == "attention-required" &&
              figmaReadSnapshotProjection.ReviewState == "held" &&
              figmaReadSnapshotProjection.SnapshotCompletenessState == "partial" &&
              figmaReadSnapshotProjection.ProvenanceState == "partial" &&
              figmaReadSnapshotProjection.FileCount == 2 &&
              figmaReadSnapshotProjection.ComponentCount == 12 &&
              figmaReadSnapshotProjection.VariableCollectionCount == 3 &&
              figmaReadSnapshotProjection.VariableCount == 18 &&
              figmaReadSnapshotProjection.HumanReviewedItemCount == 25 &&
              figmaReadSnapshotProjection.Candidate?.FileCount == 2,
            "Typed Figma Read Snapshot preserves exact Product, Initiative, assessment, catalog, and privacy-safe inventory metadata");
        var figmaReadSnapshotOutput = await initiativeController.ReadFigmaReadSnapshotAsync(InitiativeId);
        Check(figmaReadSnapshotOutput.Contains("GAEP governed Figma Read Snapshot candidate", StringComparison.Ordinal) &&
              figmaReadSnapshotOutput.Contains("2 files · 12 components · 3 variable collections · 18 variables", StringComparison.Ordinal) &&
              figmaReadSnapshotOutput.Contains("25 human-reviewed", StringComparison.Ordinal) &&
              figmaReadSnapshotOutput.Contains("no Figma connection or call", StringComparison.Ordinal) &&
              !figmaReadSnapshotOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !figmaReadSnapshotOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !figmaReadSnapshotOutput.Contains("fileNames", StringComparison.Ordinal),
            "Figma Read Snapshot workflow renders privacy-safe metadata with explicit disconnected and no-authority boundaries");
        foreach (var hostileRoot in new[] { badFigmaReadSnapshotDigestRoot, badFigmaReadSnapshotPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadFigmaReadSnapshotAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Figma Read Snapshot rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badFigmaReadSnapshotBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadFigmaReadSnapshotAsync(InitiativeId),
                "Figma Read Snapshot rejects a projection rebound to a substituted Product revision");
        }

        var figmaContextImportProjection = await client.ReadFigmaContextImportAsync(InitiativeId);
        Check(figmaContextImportProjection.ProductId == product.Id &&
              figmaContextImportProjection.ProductRevision == product.Revision &&
              figmaContextImportProjection.ProductDigest == product.Digest &&
              figmaContextImportProjection.InitiativeId == resolved.Id &&
              figmaContextImportProjection.InitiativeRevision == resolved.Revision &&
              figmaContextImportProjection.InitiativeDigest == resolved.Digest &&
              figmaContextImportProjection.AssessmentState == "attention-required" &&
              figmaContextImportProjection.ReviewState == "held" &&
              figmaContextImportProjection.ContextSelectionState == "partial" &&
              figmaContextImportProjection.ProvenanceState == "partial" &&
              figmaContextImportProjection.PreviewState == "candidate-generated" &&
              figmaContextImportProjection.ContextPackCount == 2 &&
              figmaContextImportProjection.SectionCount == 8 &&
              figmaContextImportProjection.ContextItemCount == 24 &&
              figmaContextImportProjection.TargetCount == 2 &&
              figmaContextImportProjection.HumanReviewedSectionCount == 5 &&
              figmaContextImportProjection.RepresentedRequirementCount == 7 &&
              figmaContextImportProjection.Candidate?.ContextPackCount == 2,
            "Typed Figma Context Import preserves exact Product, Initiative, assessment, selection, and privacy-safe inventory metadata");
        var figmaContextImportOutput = await initiativeController.ReadFigmaContextImportAsync(InitiativeId);
        Check(figmaContextImportOutput.Contains("GAEP governed Figma Context Import candidate", StringComparison.Ordinal) &&
              figmaContextImportOutput.Contains("2 Context Packs · 8 sections · 24 Context Items · 2 Figma targets", StringComparison.Ordinal) &&
              figmaContextImportOutput.Contains("5 human-reviewed", StringComparison.Ordinal) &&
              figmaContextImportOutput.Contains("no context packaging or transfer", StringComparison.Ordinal) &&
              !figmaContextImportOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !figmaContextImportOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !figmaContextImportOutput.Contains("contextItems", StringComparison.Ordinal),
            "Figma Context Import workflow renders privacy-safe metadata with explicit no-transfer and no-authority boundaries");
        foreach (var hostileRoot in new[] { badFigmaContextImportDigestRoot, badFigmaContextImportPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadFigmaContextImportAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Figma Context Import rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badFigmaContextImportBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadFigmaContextImportAsync(InitiativeId),
                "Figma Context Import rejects a projection rebound to a substituted Product revision");
        }

        var outboundPackageProjection = await client.ReadOutboundDesignBriefPackageAsync(InitiativeId);
        Check(outboundPackageProjection.ProductId == product.Id &&
              outboundPackageProjection.ProductRevision == product.Revision &&
              outboundPackageProjection.ProductDigest == product.Digest &&
              outboundPackageProjection.InitiativeId == resolved.Id &&
              outboundPackageProjection.InitiativeRevision == resolved.Revision &&
              outboundPackageProjection.InitiativeDigest == resolved.Digest &&
              outboundPackageProjection.AssessmentState == "attention-required" &&
              outboundPackageProjection.ReviewState == "held" &&
              outboundPackageProjection.ManifestState == "partial" &&
              outboundPackageProjection.ProvenanceState == "partial" &&
              outboundPackageProjection.RedactionReviewState == "partial" &&
              outboundPackageProjection.PreviewState == "candidate-generated" &&
              outboundPackageProjection.ContextPackCount == 2 &&
              outboundPackageProjection.EntryCount == 8 &&
              outboundPackageProjection.ContextItemCount == 24 &&
              outboundPackageProjection.RecipientCount == 2 &&
              outboundPackageProjection.HumanReviewedEntryCount == 5 &&
              outboundPackageProjection.RepresentedRequirementCount == 7 &&
              outboundPackageProjection.Candidate?.ManifestFormat == "gaep-outbound-design-brief-package-v1",
            "Typed Outbound Design Brief Package preserves exact Product, Initiative, assessment, manifest, and privacy-safe inventory metadata");
        var outboundPackageOutput = await initiativeController.ReadOutboundDesignBriefPackageAsync(InitiativeId);
        Check(outboundPackageOutput.Contains("GAEP governed Outbound Design Brief Package candidate", StringComparison.Ordinal) &&
              outboundPackageOutput.Contains("2 Context Packs · 8 entries · 24 Context Items · 2 recipients", StringComparison.Ordinal) &&
              outboundPackageOutput.Contains("5 human-reviewed", StringComparison.Ordinal) &&
              outboundPackageOutput.Contains("no package materialization or context transfer", StringComparison.Ordinal) &&
              !outboundPackageOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !outboundPackageOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !outboundPackageOutput.Contains("entries=", StringComparison.Ordinal),
            "Outbound Design Brief Package workflow renders privacy-safe receipt metadata with explicit no-transfer and no-authority boundaries");
        foreach (var hostileRoot in new[] { badOutboundDesignBriefPackageDigestRoot, badOutboundDesignBriefPackagePrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadOutboundDesignBriefPackageAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Outbound Design Brief Package rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badOutboundDesignBriefPackageBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadOutboundDesignBriefPackageAsync(InitiativeId),
                "Outbound Design Brief Package rejects a projection rebound to a substituted Product revision");
        }

        var governedWriteProjection = await client.ReadGovernedFigmaWriteAsync(InitiativeId);
        Check(governedWriteProjection.ProductId == product.Id &&
              governedWriteProjection.ProductRevision == product.Revision &&
              governedWriteProjection.ProductDigest == product.Digest &&
              governedWriteProjection.InitiativeId == resolved.Id &&
              governedWriteProjection.InitiativeRevision == resolved.Revision &&
              governedWriteProjection.InitiativeDigest == resolved.Digest &&
              governedWriteProjection.AssessmentState == "attention-required" &&
              governedWriteProjection.ReviewState == "held" &&
              governedWriteProjection.WritePlanState == "held" &&
              governedWriteProjection.PreviewState == "candidate-generated" &&
              governedWriteProjection.ApprovalState == "pending" &&
              governedWriteProjection.PermissionEvidenceState == "missing" &&
              governedWriteProjection.IdempotencyState == "defined" &&
              governedWriteProjection.ReplayProtectionState == "defined" &&
              governedWriteProjection.RecoveryPlanState == "defined" &&
              governedWriteProjection.WriteExecutionState == "not-performed" &&
              governedWriteProjection.WriteResultState == "not-recorded" &&
              governedWriteProjection.SelectedEntryCount == 8 &&
              governedWriteProjection.Candidate?.RequestFormat == "gaep-governed-figma-write-request-v1" &&
              governedWriteProjection.Candidate?.OutboundPackage.Revision == 2,
            "Typed Governed Figma Write preserves exact Product, Initiative, governance, safety, and privacy-safe receipt metadata");
        var governedWriteOutput = await initiativeController.ReadGovernedFigmaWriteAsync(InitiativeId);
        Check(governedWriteOutput.Contains("GAEP governed Figma Write authorization-review candidate", StringComparison.Ordinal) &&
              governedWriteOutput.Contains("approval pending · permission evidence missing", StringComparison.Ordinal) &&
              governedWriteOutput.Contains("8 selected entries", StringComparison.Ordinal) &&
              governedWriteOutput.Contains("no package materialization or context transfer", StringComparison.Ordinal) &&
              governedWriteOutput.Contains("permission grant", StringComparison.Ordinal) &&
              !governedWriteOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !governedWriteOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !governedWriteOutput.Contains("approvalActor=", StringComparison.Ordinal),
            "Governed Figma Write workflow renders privacy-safe receipt metadata with explicit no-effect and no-authority boundaries");
        foreach (var hostileRoot in new[] { badGovernedFigmaWriteDigestRoot, badGovernedFigmaWritePrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadGovernedFigmaWriteAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Governed Figma Write rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badGovernedFigmaWriteBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadGovernedFigmaWriteAsync(InitiativeId),
                "Governed Figma Write rejects a projection rebound to a substituted Product revision");
        }

        var finalizedImportProjection = await client.ReadFinalizedFigmaSnapshotImportAsync(InitiativeId);
        Check(finalizedImportProjection.ProductId == product.Id &&
              finalizedImportProjection.ProductRevision == product.Revision &&
              finalizedImportProjection.ProductDigest == product.Digest &&
              finalizedImportProjection.InitiativeId == resolved.Id &&
              finalizedImportProjection.InitiativeRevision == resolved.Revision &&
              finalizedImportProjection.InitiativeDigest == resolved.Digest &&
              finalizedImportProjection.AssessmentState == "attention-required" &&
              finalizedImportProjection.ReviewState == "held" &&
              finalizedImportProjection.ReturnAuthorizationState == "missing" &&
              finalizedImportProjection.ReconciliationState == "partial" &&
              finalizedImportProjection.ProvenanceState == "partial" &&
              finalizedImportProjection.SnapshotCompletenessState == "partial" &&
              finalizedImportProjection.ImportExecutionState == "not-performed" &&
              finalizedImportProjection.ImportResultState == "not-recorded" &&
              finalizedImportProjection.ItemCount == 18 &&
              finalizedImportProjection.HumanReviewedItemCount == 12 &&
              finalizedImportProjection.SourceRecordedItemCount == 4 &&
              finalizedImportProjection.NotAssessedItemCount == 2 &&
              finalizedImportProjection.Candidate?.ConflictCount == 4,
            "Typed Finalized Figma Snapshot Import preserves exact Product, Initiative, reconciliation, evidence, and privacy-safe receipt metadata");
        var finalizedImportOutput = await initiativeController.ReadFinalizedFigmaSnapshotImportAsync(InitiativeId);
        Check(finalizedImportOutput.Contains("GAEP finalized Figma Snapshot Import review candidate", StringComparison.Ordinal) &&
              finalizedImportOutput.Contains("return authorization missing", StringComparison.Ordinal) &&
              finalizedImportOutput.Contains("18 items · 4 conflicts", StringComparison.Ordinal) &&
              finalizedImportOutput.Contains("no content transfer or import", StringComparison.Ordinal) &&
              finalizedImportOutput.Contains("permission grant", StringComparison.Ordinal) &&
              !finalizedImportOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !finalizedImportOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !finalizedImportOutput.Contains("authorizationActor=", StringComparison.Ordinal),
            "Finalized Figma Snapshot Import workflow renders privacy-safe receipt metadata with explicit no-import and no-authority boundaries");
        foreach (var hostileRoot in new[] { badFinalizedFigmaSnapshotImportDigestRoot, badFinalizedFigmaSnapshotImportPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadFinalizedFigmaSnapshotImportAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Finalized Figma Snapshot Import rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badFinalizedFigmaSnapshotImportBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadFinalizedFigmaSnapshotImportAsync(InitiativeId),
                "Finalized Figma Snapshot Import rejects a projection rebound to a substituted Product revision");
        }

        var designBindingProjection = await client.ReadDesignToRequirementBindingAsync(InitiativeId);
        Check(designBindingProjection.ProductId == product.Id &&
              designBindingProjection.ProductRevision == product.Revision &&
              designBindingProjection.ProductDigest == product.Digest &&
              designBindingProjection.InitiativeId == resolved.Id &&
              designBindingProjection.InitiativeRevision == resolved.Revision &&
              designBindingProjection.InitiativeDigest == resolved.Digest &&
              designBindingProjection.AssessmentState == "attention-required" &&
              designBindingProjection.ReviewState == "held" &&
              designBindingProjection.ReconciliationState == "partial" &&
              designBindingProjection.CandidateCoverageState == "partial" &&
              designBindingProjection.ProvenanceState == "exact" &&
              designBindingProjection.BindingCount == 7 &&
              designBindingProjection.HumanReviewedBindingCount == 5 &&
              designBindingProjection.Candidate?.DesignItemCoverageCount == 4 &&
              designBindingProjection.Candidate?.SubjectCoverageCount == 5 &&
              designBindingProjection.Candidate?.ConflictCount == 3,
            "Typed Design-to-Requirement Binding preserves exact Product, Initiative, dependency, coverage, and privacy-safe candidate metadata");
        var designBindingOutput = await initiativeController.ReadDesignToRequirementBindingAsync(InitiativeId);
        Check(designBindingOutput.Contains("GAEP Design-to-Requirement Binding review candidate", StringComparison.Ordinal) &&
              designBindingOutput.Contains("reconciliation partial", StringComparison.Ordinal) &&
              designBindingOutput.Contains("7 bindings · 4 design items · 5 governed subjects · 3 conflicts", StringComparison.Ordinal) &&
              designBindingOutput.Contains("no relationship-truth or coverage-completeness proof", StringComparison.Ordinal) &&
              designBindingOutput.Contains("permission grant", StringComparison.Ordinal) &&
              !designBindingOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designBindingOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designBindingOutput.Contains("humanAttribution=", StringComparison.Ordinal),
            "Design-to-Requirement Binding workflow renders privacy-safe exact dependency metadata with explicit no-proof and no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignToRequirementBindingDigestRoot, badDesignToRequirementBindingPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignToRequirementBindingAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design-to-Requirement Binding rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignToRequirementBindingBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignToRequirementBindingAsync(InitiativeId),
                "Design-to-Requirement Binding rejects a projection rebound to a substituted Product revision");
        }

        var designerReadyGateProjection = await client.ReadDesignerReadyGateAsync(InitiativeId);
        Check(designerReadyGateProjection.ProductId == product.Id &&
              designerReadyGateProjection.ProductRevision == product.Revision &&
              designerReadyGateProjection.ProductDigest == product.Digest &&
              designerReadyGateProjection.InitiativeId == resolved.Id &&
              designerReadyGateProjection.InitiativeRevision == resolved.Revision &&
              designerReadyGateProjection.InitiativeDigest == resolved.Digest &&
              designerReadyGateProjection.AssessmentState == "attention-required" &&
              designerReadyGateProjection.CandidateResult == "incomplete" &&
              designerReadyGateProjection.ReviewState == "held" &&
              designerReadyGateProjection.PrerequisiteCount == 12 &&
              designerReadyGateProjection.SatisfiedCount == 9 &&
              designerReadyGateProjection.HumanReviewedCount == 10 &&
              designerReadyGateProjection.Candidate?.PrerequisiteCount == 12,
            "Typed Designer-Ready Gate preserves exact Product, Initiative, prerequisite, assessment, and privacy-safe candidate metadata");
        var designerReadyGateOutput = await initiativeController.ReadDesignerReadyGateAsync(InitiativeId);
        Check(designerReadyGateOutput.Contains("GAEP Designer-Ready Gate candidate", StringComparison.Ordinal) &&
              designerReadyGateOutput.Contains("9 satisfied · 1 not-applicable candidates · 10/12 human-reviewed", StringComparison.Ordinal) &&
              designerReadyGateOutput.Contains("12 exact", StringComparison.Ordinal) &&
              designerReadyGateOutput.Contains("evaluation result, not permission or readiness", StringComparison.Ordinal) &&
              designerReadyGateOutput.Contains("implementation, or action authority", StringComparison.Ordinal) &&
              !designerReadyGateOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designerReadyGateOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designerReadyGateOutput.Contains("criteria=", StringComparison.Ordinal),
            "Designer-Ready Gate workflow renders privacy-safe exact assessment metadata with explicit no-readiness and no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignerReadyGateDigestRoot, badDesignerReadyGatePrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignerReadyGateAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Designer-Ready Gate rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignerReadyGateBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignerReadyGateAsync(InitiativeId),
                "Designer-Ready Gate rejects a projection rebound to a substituted Product revision");
        }

        var designDeltaProjection = await client.ReadDesignDeltaAsync(InitiativeId);
        Check(designDeltaProjection.ProductId == product.Id &&
              designDeltaProjection.ProductRevision == product.Revision &&
              designDeltaProjection.ProductDigest == product.Digest &&
              designDeltaProjection.InitiativeId == resolved.Id &&
              designDeltaProjection.InitiativeRevision == resolved.Revision &&
              designDeltaProjection.InitiativeDigest == resolved.Digest &&
              designDeltaProjection.AssessmentState == "attention-required" &&
              designDeltaProjection.CandidateResult == "conflict-candidate" &&
              designDeltaProjection.ReviewState == "held" &&
              designDeltaProjection.DeltaCount == 6 &&
              designDeltaProjection.ConflictingCount == 1 &&
              designDeltaProjection.HumanReviewedCount == 3 &&
              designDeltaProjection.Candidate?.DeltaCount == 6,
            "Typed Design Delta preserves exact Product, Initiative, comparison, assessment, and privacy-safe candidate metadata");
        var designDeltaOutput = await initiativeController.ReadDesignDeltaAsync(InitiativeId);
        Check(designDeltaOutput.Contains("GAEP Design Delta candidate", StringComparison.Ordinal) &&
              designDeltaOutput.Contains("12 source items · 14 target items · 6 deltas", StringComparison.Ordinal) &&
              designDeltaOutput.Contains("2 added · 1 changed · 1 conflicting", StringComparison.Ordinal) &&
              designDeltaOutput.Contains("comparison partial · provenance partial", StringComparison.Ordinal) &&
              designDeltaOutput.Contains("no delta or external completeness", StringComparison.Ordinal) &&
              designDeltaOutput.Contains("implementation, or action authority", StringComparison.Ordinal) &&
              !designDeltaOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designDeltaOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designDeltaOutput.Contains("deltaContent=", StringComparison.Ordinal),
            "Design Delta workflow renders privacy-safe exact comparison metadata with explicit no-completeness and no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignDeltaDigestRoot, badDesignDeltaPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignDeltaAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Delta rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignDeltaBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignDeltaAsync(InitiativeId),
                "Design Delta rejects a projection rebound to a substituted Product revision");
        }

        var designConflictResolutionProjection = await client.ReadDesignConflictResolutionAsync(InitiativeId);
        Check(designConflictResolutionProjection.ProductId == product.Id &&
              designConflictResolutionProjection.ProductRevision == product.Revision &&
              designConflictResolutionProjection.ProductDigest == product.Digest &&
              designConflictResolutionProjection.InitiativeId == resolved.Id &&
              designConflictResolutionProjection.InitiativeRevision == resolved.Revision &&
              designConflictResolutionProjection.InitiativeDigest == resolved.Digest &&
              designConflictResolutionProjection.AssessmentState == "attention-required" &&
              designConflictResolutionProjection.CandidateResult == "escalation-plan-candidate" &&
              designConflictResolutionProjection.ReviewState == "held" &&
              designConflictResolutionProjection.ConflictCount == 5 &&
              designConflictResolutionProjection.ResolutionCount == 4 &&
              designConflictResolutionProjection.EscalateCount == 1 &&
              designConflictResolutionProjection.HumanReviewedCount == 3 &&
              designConflictResolutionProjection.Candidate?.ResolutionCount == 4,
            "Typed Design Conflict Resolution preserves exact Product, Initiative, conflict, assessment, and privacy-safe candidate metadata");
        var designConflictResolutionOutput = await initiativeController.ReadDesignConflictResolutionAsync(InitiativeId);
        Check(designConflictResolutionOutput.Contains("GAEP Design Conflict Resolution candidate", StringComparison.Ordinal) &&
              designConflictResolutionOutput.Contains("5 conflicts · 4 resolution candidates", StringComparison.Ordinal) &&
              designConflictResolutionOutput.Contains("1 accept source · 1 accept target · 1 merge", StringComparison.Ordinal) &&
              designConflictResolutionOutput.Contains("separation of duties not enforced", StringComparison.Ordinal) &&
              designConflictResolutionOutput.Contains("does not enforce separation of duties", StringComparison.Ordinal) &&
              designConflictResolutionOutput.Contains("implementation or action authority", StringComparison.Ordinal) &&
              !designConflictResolutionOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designConflictResolutionOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designConflictResolutionOutput.Contains("resolutionContent=", StringComparison.Ordinal),
            "Design Conflict Resolution workflow renders privacy-safe exact metadata with explicit no-separation and no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignConflictResolutionDigestRoot, badDesignConflictResolutionPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignConflictResolutionAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Conflict Resolution rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignConflictResolutionBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignConflictResolutionAsync(InitiativeId),
                "Design Conflict Resolution rejects a projection rebound to a substituted Product revision");
        }

        var humanDesignApprovalProjection = await client.ReadHumanDesignApprovalAsync(InitiativeId);
        Check(humanDesignApprovalProjection.ProductId == product.Id &&
              humanDesignApprovalProjection.ProductRevision == product.Revision &&
              humanDesignApprovalProjection.ProductDigest == product.Digest &&
              humanDesignApprovalProjection.InitiativeId == resolved.Id &&
              humanDesignApprovalProjection.InitiativeRevision == resolved.Revision &&
              humanDesignApprovalProjection.InitiativeDigest == resolved.Digest &&
              humanDesignApprovalProjection.AssessmentState == "attention-required" &&
              humanDesignApprovalProjection.CandidateResult == "approved-candidate" &&
              humanDesignApprovalProjection.ReviewState == "recorded-human-decision" &&
              humanDesignApprovalProjection.PrerequisiteCount == 5 &&
              humanDesignApprovalProjection.CompletePrerequisiteCount == 4 &&
              humanDesignApprovalProjection.ApproveCount == 1 &&
              humanDesignApprovalProjection.ApproverAuthorityState == "not-established" &&
              humanDesignApprovalProjection.Candidate?.Subject.ItemCount == 18,
            "Typed Human Design Approval preserves exact Product, Initiative, subject, assessment, and privacy-safe decision metadata");
        var humanDesignApprovalOutput = await initiativeController.ReadHumanDesignApprovalAsync(InitiativeId);
        Check(humanDesignApprovalOutput.Contains("GAEP Human Design Approval decision candidate", StringComparison.Ordinal) &&
              humanDesignApprovalOutput.Contains("4/5 complete", StringComparison.Ordinal) &&
              humanDesignApprovalOutput.Contains("1 approve · 0 reject", StringComparison.Ordinal) &&
              humanDesignApprovalOutput.Contains("approver not-established · separation of duties not-established", StringComparison.Ordinal) &&
              humanDesignApprovalOutput.Contains("does not verify approver authority", StringComparison.Ordinal) &&
              humanDesignApprovalOutput.Contains("implementation or action authority", StringComparison.Ordinal) &&
              !humanDesignApprovalOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !humanDesignApprovalOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !humanDesignApprovalOutput.Contains("decisionRationale=", StringComparison.Ordinal),
            "Human Design Approval workflow renders privacy-safe exact metadata with explicit no-approval and no-authority boundaries");
        foreach (var hostileRoot in new[] { badHumanDesignApprovalDigestRoot, badHumanDesignApprovalPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadHumanDesignApprovalAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Human Design Approval rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badHumanDesignApprovalBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadHumanDesignApprovalAsync(InitiativeId),
                "Human Design Approval rejects a projection rebound to a substituted Product revision");
        }

        var designBaselineProjection = await client.ReadDesignBaselineAsync(InitiativeId);
        Check(designBaselineProjection.ProductId == product.Id &&
              designBaselineProjection.ProductRevision == product.Revision &&
              designBaselineProjection.ProductDigest == product.Digest &&
              designBaselineProjection.InitiativeId == resolved.Id &&
              designBaselineProjection.InitiativeRevision == resolved.Revision &&
              designBaselineProjection.InitiativeDigest == resolved.Digest &&
              designBaselineProjection.AssessmentState == "attention-required" &&
              designBaselineProjection.CandidateResult == "supersession-candidate" &&
              designBaselineProjection.ReviewState == "ready-for-human-review" &&
              designBaselineProjection.CandidateSetCount == 1 &&
              designBaselineProjection.DesignationCandidateCount == 1 &&
              designBaselineProjection.SupersessionCandidateCount == 1 &&
              designBaselineProjection.ApprovalDeterminationState == "not-established" &&
              designBaselineProjection.BaselineDesignationState == "not-established" &&
              designBaselineProjection.Candidate?.SemanticVersion == "2.0.0" &&
              designBaselineProjection.Candidate?.DesignationKind == "supersede-baseline-candidate",
            "Typed Design Baseline preserves exact Product, Initiative, version, lineage, approval-candidate, and privacy-safe designation metadata");
        var designBaselineOutput = await initiativeController.ReadDesignBaselineAsync(InitiativeId);
        Check(designBaselineOutput.Contains("GAEP Design Baseline version candidate", StringComparison.Ordinal) &&
              designBaselineOutput.Contains("1 set · 1 designation · 1 supersession", StringComparison.Ordinal) &&
              designBaselineOutput.Contains("Version: 2.0.0", StringComparison.Ordinal) &&
              designBaselineOutput.Contains("approval determination not-established · baseline designation not-established", StringComparison.Ordinal) &&
              designBaselineOutput.Contains("does not convert an approval candidate into approval", StringComparison.Ordinal) &&
              designBaselineOutput.Contains("implementation or action authority", StringComparison.Ordinal) &&
              !designBaselineOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designBaselineOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designBaselineOutput.Contains("designRationale=", StringComparison.Ordinal),
            "Design Baseline workflow renders privacy-safe exact version metadata with explicit no-designation and no-authority boundaries");
        foreach (var hostileRoot in new[] { badDesignBaselineDigestRoot, badDesignBaselinePrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignBaselineAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Baseline rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignBaselineBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignBaselineAsync(InitiativeId),
                "Design Baseline rejects a projection rebound to a substituted Product revision");
        }

        var designDriftProjection = await client.ReadDesignDriftDetectionAsync(InitiativeId);
        Check(designDriftProjection.ProductId == product.Id &&
              designDriftProjection.ProductRevision == product.Revision &&
              designDriftProjection.ProductDigest == product.Digest &&
              designDriftProjection.InitiativeId == resolved.Id &&
              designDriftProjection.InitiativeRevision == resolved.Revision &&
              designDriftProjection.InitiativeDigest == resolved.Digest &&
              designDriftProjection.AssessmentState == "attention-required" &&
              designDriftProjection.CandidateResult == "incomplete" &&
              designDriftProjection.ReviewState == "held" &&
              designDriftProjection.ImplementationTargetCount == 5 &&
              designDriftProjection.ObservationCount == 9 &&
              designDriftProjection.RequirementToDesignCount == 4 &&
              designDriftProjection.DesignToImplementationCount == 5 &&
              designDriftProjection.DriftCount == 5 &&
              designDriftProjection.BlockerCount == 1 &&
              designDriftProjection.RemediationCandidateCount == 4 &&
              designDriftProjection.Candidate?.DesignBaseline.BaselineDesignationState == "not-established" &&
              designDriftProjection.Candidate?.ImplementationTargetCatalogRevision == 2,
            "Typed Design Drift Detection preserves exact Product, Initiative, dependency, catalog, comparison, count, and privacy-safe state metadata");
        var designDriftOutput = await initiativeController.ReadDesignDriftDetectionAsync(InitiativeId);
        Check(designDriftOutput.Contains("GAEP Design Drift Detection candidate", StringComparison.Ordinal) &&
              designDriftOutput.Contains("4 requirement-to-design · 5 design-to-implementation", StringComparison.Ordinal) &&
              designDriftOutput.Contains("3 conformant · 5 drift · 1 unassessed", StringComparison.Ordinal) &&
              designDriftOutput.Contains("4 recorded", StringComparison.Ordinal) &&
              designDriftOutput.Contains("does not establish an actual Baseline Set", StringComparison.Ordinal) &&
              designDriftOutput.Contains("grant action authority", StringComparison.Ordinal) &&
              !designDriftOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !designDriftOutput.Contains(PrivateCredential, StringComparison.Ordinal) &&
              !designDriftOutput.Contains("implementationContent=", StringComparison.Ordinal),
            "Design Drift Detection workflow renders privacy-safe exact comparison metadata with explicit no-baseline and no-action boundaries");
        foreach (var hostileRoot in new[] { badDesignDriftDigestRoot, badDesignDriftPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalid = await CaptureHostErrorAsync(() => hostileClient.ReadDesignDriftDetectionAsync(InitiativeId));
            Check(invalid.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalid.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalid.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Design Drift Detection rejects hostile digest and private-field drift");
        }
        await using (var hostileClient = new EngineClient(badDesignDriftBindingRoot, executable))
        {
            await ExpectAsync<ArgumentException>(
                () => new ProductWorkflowController(hostileClient).ReadDesignDriftDetectionAsync(InitiativeId),
                "Design Drift Detection rejects a projection rebound to a substituted Product revision");
        }

        var dashboard = await client.ReadPhaseDashboardAsync(product);
        Check(dashboard.Phase == DeliveryPhaseId.Phase0Foundation &&
              dashboard.Panels.Select(panel => panel.Id).SequenceEqual([
                  "foundation-summary", "change-impact", "agent-model",
              ]) && dashboard.EvidenceCues.Freshness == "current" &&
              dashboard.EvidenceCues.ConfidenceState == "not-assessed",
            "Typed phase dashboard preserves the explicit phase, canonical panel order, and governed evidence cues");
        Check(dashboard.Panels.Select(panel => panel.State).SequenceEqual([
                  "attention-required", "active", "active",
              ]) && dashboard.ProductDigest == product.Digest,
            "Typed phase dashboard preserves conservative applicability state and exact Product binding");
        var dashboardOutput = await new ProductWorkflowController(client).ReadPhaseDashboardAsync();
        Check(dashboardOutput.Contains("GAEP phase-scoped dashboard framework", StringComparison.Ordinal) &&
              dashboardOutput.Contains("Evidence freshness: current", StringComparison.Ordinal) &&
              dashboardOutput.Contains("Confidence: not assessed", StringComparison.Ordinal) &&
              dashboardOutput.Contains("applicability=unknown (not-evaluated)", StringComparison.Ordinal) &&
              dashboardOutput.Contains("grants no mutation, applicability, phase-entry", StringComparison.Ordinal) &&
              !dashboardOutput.Contains("Founder Product", StringComparison.Ordinal) &&
              !dashboardOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !dashboardOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Phase-dashboard workflow renders only bounded metadata and an explicit no-authority boundary");
        var phaseTables = await new ProductWorkflowController(client).ReadPhaseDashboardTablesAsync();
        Check(phaseTables.Select(table => table.Id).SequenceEqual(["phase-panels"]) &&
              phaseTables.Single().Rows.Count == 3 &&
              phaseTables.Single().SnapshotDigest == dashboard.CompositionDigest,
            "Accessible Phase tables preserve the exact panel rows and composition digest");
        var phase2Initiative = await client.ReadInitiativeAsync(InitiativeId);
        var phase2Dashboard = await client.ReadPhase2UxFigmaDashboardAsync(product, phase2Initiative);
        Check(phase2Dashboard.Sources.Count == 23 && phase2Dashboard.PhaseState == "attention-required" &&
              phase2Dashboard.UnavailableSourceCount == 23 && phase2Dashboard.FigmaConnectionState == "not-established" &&
              phase2Dashboard.FigmaWriteExecutionState == "not-performed" &&
              phase2Dashboard.FigmaImportExecutionState == "not-performed",
            "Typed Phase 2 UX/Figma dashboard preserves the canonical source catalog and explicit no-effect state");
        var phase2Controller = new ProductWorkflowController(client);
        var phase2Output = await phase2Controller.ReadPhase2UxFigmaDashboardAsync(InitiativeId);
        Check(phase2Output.Contains("GAEP exact Phase 2 UX and Figma dashboard", StringComparison.Ordinal) &&
              phase2Output.Contains("23 unavailable · 23 expected", StringComparison.Ordinal) &&
              phase2Output.Contains("Product Owner acceptance: not established", StringComparison.Ordinal) &&
              phase2Output.Contains("grants no completeness, validity, approval, baseline", StringComparison.Ordinal) &&
              !phase2Output.Contains("Founder Product", StringComparison.Ordinal) &&
              !phase2Output.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !phase2Output.Contains(PrivateCredential, StringComparison.Ordinal),
            "Phase 2 UX/Figma workflow renders only bounded metadata and explicit no-authority state");
        var phase2Tables = await phase2Controller.ReadPhase2UxFigmaDashboardTablesAsync(InitiativeId);
        Check(phase2Tables.Select(table => table.Id).SequenceEqual(["phase2-summary", "phase2-sources"]) &&
              phase2Tables.Last().Rows.Count == 23 &&
              phase2Tables.All(table => table.SnapshotDigest == phase2Dashboard.SnapshotDigest) &&
              phase2Tables.All(table => table.AuthorityBoundary.Contains("not-a-second-source-of-truth", StringComparison.Ordinal)),
            "Accessible Phase 2 tables preserve the exact source rows, digest, and authority boundary");
        foreach (var hostileRoot in new[] { badPhase2DashboardCatalogRoot, badPhase2DashboardDigestRoot, badPhase2DashboardPrivateRoot })
        {
            await using var hostileDashboardClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileDashboardClient.ReadProductBindingAsync();
            var hostileInitiative = await hostileDashboardClient.ReadInitiativeAsync(InitiativeId);
            var invalidDashboard = await CaptureHostErrorAsync(
                () => hostileDashboardClient.ReadPhase2UxFigmaDashboardAsync(hostileProduct, hostileInitiative));
            Check(invalidDashboard.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidDashboard.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidDashboard.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Phase 2 dashboard rejects hostile digest and private-field drift");
        }

        var phase2Integrated = await client.ReadPhase2ChangeImpactAgentModelDashboardAsync(product, phase2Initiative);
        Check(
            phase2Integrated.Synchronization.State == "attention-required" &&
            phase2Integrated.Impact.State == "current-bounded-observation" &&
            phase2Integrated.Capabilities.Shown == 2 &&
            phase2Integrated.RunLaunchAuthority == "not-granted" &&
            phase2Integrated.ProductOwnerAcceptance == "not-established",
            "Typed integrated Phase 2 dashboard preserves bounded synchronization, impact, execution, and no-authority truth");
        var phase2IntegratedOutput = await phase2Controller.ReadPhase2ChangeImpactAgentModelDashboardAsync(InitiativeId);
        Check(
            phase2IntegratedOutput.Contains("GAEP exact Phase 2 Change, Impact, Agent and Model dashboard", StringComparison.Ordinal) &&
            phase2IntegratedOutput.Contains("Synchronization: attention-required", StringComparison.Ordinal) &&
            phase2IntegratedOutput.Contains("Impact boundary: bounded-not-complete", StringComparison.Ordinal) &&
            phase2IntegratedOutput.Contains("Capabilities: 2/2 shown", StringComparison.Ordinal) &&
            phase2IntegratedOutput.Contains("not a second source of truth", StringComparison.Ordinal) &&
            !phase2IntegratedOutput.Contains("Founder Product", StringComparison.Ordinal) &&
            !phase2IntegratedOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
            !phase2IntegratedOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Integrated Phase 2 workflow renders bounded private-safe metadata and explicit no-authority state");
        var phase2IntegratedTables = await phase2Controller.ReadPhase2ChangeImpactAgentModelDashboardTablesAsync(InitiativeId);
        Check(
            phase2IntegratedTables.Select(table => table.Id).SequenceEqual(new[]
            {
                "phase2-synchronization-change", "phase2-bounded-impact", "phase2-agent-model-execution",
            }, StringComparer.Ordinal) &&
            phase2IntegratedTables.All(table => table.SnapshotDigest == phase2Integrated.SnapshotDigest) &&
            phase2IntegratedTables.All(table => table.AuthorityBoundary.Contains("not-a-second-source-of-truth", StringComparison.Ordinal)),
            "Integrated Phase 2 accessible tables expose three exact read-only metadata groups");
        foreach (var hostileRoot in new[]
                 {
                     badPhase2IntegratedBindingRoot, badPhase2IntegratedDigestRoot, badPhase2IntegratedPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileClient.ReadProductBindingAsync();
            var hostileInitiative = await hostileClient.ReadInitiativeAsync(InitiativeId);
            var error = await CaptureHostErrorAsync(
                () => hostileClient.ReadPhase2ChangeImpactAgentModelDashboardAsync(hostileProduct, hostileInitiative));
            Check(error.Kind == "HOST_RESPONSE_INVALID" &&
                  !error.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !error.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile integrated Phase 2 response is rejected without private detail");
        }
        var phase1Initiative = phase2Initiative;
        var phase1Summary = await client.ReadPhase1SummaryAsync(product, phase1Initiative);
        Check(phase1Summary.InitiativeId == InitiativeId && phase1Summary.PhaseState == "attention-required" &&
              phase1Summary.AttentionSignalCount == 2 && phase1Summary.DeclaredGapCount == 0 &&
              phase1Summary.ReadinessResult == "not-assessed" && phase1Summary.FreshnessState == "current",
            "Typed Phase 1 summary preserves exact Initiative binding and conservative governed signals");
        var phase1Output = await new ProductWorkflowController(client).ReadPhase1SummaryAsync(InitiativeId);
        Check(phase1Output.Contains("GAEP exact Phase 1 summary and readiness dashboard", StringComparison.Ordinal) &&
              phase1Output.Contains("Owners: unbound", StringComparison.Ordinal) &&
              phase1Output.Contains("grants no readiness, approval, acceptance", StringComparison.Ordinal) &&
              !phase1Output.Contains("Founder Product", StringComparison.Ordinal) &&
              !phase1Output.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !phase1Output.Contains(PrivateCredential, StringComparison.Ordinal),
            "Phase 1 summary workflow renders only exact bounded metadata and explicit no-authority state");
        foreach (var hostileRoot in new[]
                 {
                     badDashboardBindingRoot,
                     badDashboardApplicabilityRoot,
                     badDashboardEvidenceCuesRoot,
                     badDashboardDigestRoot,
                     badDashboardPrivateRoot,
                 })
        {
            await using var hostileDashboardClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileDashboardClient.ReadProductBindingAsync();
            var invalidDashboard = await CaptureHostErrorAsync(
                () => hostileDashboardClient.ReadPhaseDashboardAsync(hostileProduct));
            Check(invalidDashboard.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidDashboard.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidDashboard.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Phase dashboard rejects hostile binding, applicability, evidence-cue, digest, and private-field drift");
        }
        await ExpectAsync<ArgumentException>(
            () => client.ReadPhaseDashboardAsync(product with { Digest = "sha256:not-a-digest" }),
            "Invalid Product dashboard digests fail before transport");

        var changeCatalog = await client.ListChangeImpactChangesAsync(product);
        Check(changeCatalog.ProductId == ProductId && changeCatalog.Total == 1 && changeCatalog.Omitted == 0 &&
              changeCatalog.Items.Single().RecordId == ChangeId &&
              changeCatalog.Items.Single().EffectEnvelope.SequenceEqual(["reversible-change"]),
            "Typed Change catalog preserves one exact current metadata-only Change binding");
        var phase1ChangeImpact = await client.ReadPhase1ChangeImpactAsync(
            product,
            phase1Initiative,
            changeCatalog.Items.Single());
        Check(phase1ChangeImpact.Outputs.Count == 25 &&
              phase1ChangeImpact.CurrentTraceObservedOutputCount == 0 &&
              phase1ChangeImpact.AttentionRequiredOutputCount == 0 &&
              phase1ChangeImpact.ImpactNotEstablishedOutputCount == 25 &&
              phase1ChangeImpact.Outputs.All(output => output.RevalidationState == "not-established") &&
              phase1ChangeImpact.FreshnessState == "current",
            "Typed Phase 1 Change/Impact dashboard preserves the complete conservative P0-P4 output catalog");
        var phase1ChangeOutput = await new ProductWorkflowController(client).ReadPhase1ChangeImpactAsync(
            InitiativeId,
            new ChangeImpactContext(product, changeCatalog),
            changeCatalog.Items.Single());
        Check(phase1ChangeOutput.Contains("GAEP exact Phase 1 Change and impact dashboard", StringComparison.Ordinal) &&
              phase1ChangeOutput.Contains("25 impact not established", StringComparison.Ordinal) &&
              phase1ChangeOutput.Contains("Owners: unbound", StringComparison.Ordinal) &&
              phase1ChangeOutput.Contains("absence does not prove no impact", StringComparison.Ordinal) &&
              !phase1ChangeOutput.Contains("Founder Product", StringComparison.Ordinal) &&
              !phase1ChangeOutput.Contains("Private Change title", StringComparison.Ordinal) &&
              !phase1ChangeOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !phase1ChangeOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Phase 1 Change/Impact workflow renders bounded output coverage and explicit no-authority state");
        var changeDashboard = await client.ReadChangeImpactAsync(product, changeCatalog.Items.Single());
        Check(changeDashboard.Change.RecordId == ChangeId && changeDashboard.Freshness.State == "current" &&
              changeDashboard.EvidenceCues.Freshness == "current" &&
              changeDashboard.EvidenceCues.ConfidenceState == "not-assessed" &&
              changeDashboard.WorkItems.Count == 1 &&
              changeDashboard.ChangedArtifacts.Single().Locator.Kind == "workspace-relative" &&
              changeDashboard.EffectTargets.Single().Locator.Kind == "logical" &&
              changeDashboard.AffectedUnits.Single().Endpoint.RecordType == "risk" &&
              changeDashboard.AffectedUnits.Single().Trace.AssessedState == "valid" &&
              changeDashboard.Decisions.Single().Outcome == "not-selected" &&
              changeDashboard.Risks.Single().Acceptance == "not-accepted" && !changeDashboard.Limits.Truncated,
            "Typed Change/Impact dashboard preserves exact bounded records, trace, governance and freshness metadata");
        var changeController = new ProductWorkflowController(client);
        var changeContext = await changeController.ReadChangeImpactContextAsync();
        var changeOutput = await changeController.ReadChangeImpactAsync(changeContext, changeContext.Catalog.Items.Single());
        Check(changeOutput.Contains("GAEP exact Change and impact dashboard", StringComparison.Ordinal) &&
              changeOutput.Contains("Evidence freshness: current", StringComparison.Ordinal) &&
              changeOutput.Contains("Confidence: not assessed", StringComparison.Ordinal) &&
              changeOutput.Contains("Approval: not established", StringComparison.Ordinal) &&
              changeOutput.Contains("absence of a trace link does not prove absence of impact", StringComparison.Ordinal) &&
              changeOutput.Contains("grants no Change approval, risk acceptance, mutation", StringComparison.Ordinal) &&
              !changeOutput.Contains("Founder Product", StringComparison.Ordinal) &&
              !changeOutput.Contains("Private Change title", StringComparison.Ordinal) &&
              !changeOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !changeOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Change/Impact workflow renders metadata only with explicit coverage and no-authority boundaries");
        var changeTables = await changeController.ReadChangeImpactTablesAsync(
            changeContext,
            changeContext.Catalog.Items.Single());
        Check(changeTables.Select(table => table.Id).SequenceEqual([
                  "change-work-items",
                  "changed-artifacts",
                  "effect-targets",
                  "affected-units",
                  "related-decisions",
                  "related-risks",
              ]) && changeTables.All(table => table.SnapshotDigest == changeDashboard.SnapshotDigest),
            "Accessible Change/Impact tables preserve all six exact categories and the verified snapshot digest");
        foreach (var hostileRoot in new[]
                 {
                     badChangeCatalogBindingRoot,
                     badChangeCatalogDigestRoot,
                     badChangeCatalogPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileClient.ReadProductBindingAsync();
            var invalidCatalog = await CaptureHostErrorAsync(
                () => hostileClient.ListChangeImpactChangesAsync(hostileProduct));
            Check(invalidCatalog.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidCatalog.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidCatalog.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Change catalog rejects hostile binding, digest, and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badChangeImpactBindingRoot,
                     badChangeImpactCountRoot,
                     badChangeImpactFreshnessRoot,
                     badChangeImpactEvidenceCuesRoot,
                     badChangeImpactDigestRoot,
                     badChangeImpactPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileClient.ReadProductBindingAsync();
            var hostileChange = (await hostileClient.ListChangeImpactChangesAsync(hostileProduct)).Items.Single();
            var invalidDashboard = await CaptureHostErrorAsync(
                () => hostileClient.ReadChangeImpactAsync(hostileProduct, hostileChange));
            Check(invalidDashboard.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidDashboard.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidDashboard.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Change/Impact dashboard rejects hostile binding, count, freshness, evidence-cue, digest, and private-field drift");
        }
        await ExpectAsync<ArgumentException>(
            () => client.ReadChangeImpactAsync(
                product,
                changeCatalog.Items.Single() with { Digest = "sha256:not-a-digest" }),
            "Invalid Change dashboard digests fail before transport");

        var agentModel = await client.ReadAgentModelAsync(product);
        Check(agentModel.ProductDigest == product.Digest && agentModel.Capabilities.Count == 2 &&
              agentModel.Selection.Status == "unselected" && agentModel.Freshness.State == "current" &&
              agentModel.EvidenceCues.Freshness == "current" &&
              agentModel.EvidenceCues.ConfidenceState == "not-assessed" &&
              agentModel.CapabilityLimit.Total == 2 && !agentModel.Truncated &&
              agentModel.Runs.Count == 0 && agentModel.Handoffs.Count == 0,
            "Typed Agent/Model dashboard preserves exact unselected capability and freshness metadata");
        var agentModelJson = JsonSerializer.Serialize(agentModel);
        Check(!agentModelJson.Contains("Founder Product", StringComparison.Ordinal) &&
              !agentModelJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !agentModelJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed Agent/Model dashboard withholds Product text, private paths, and credentials");
        var agentModelOutput = await new ProductWorkflowController(client).ReadAgentModelAsync();
        Check(agentModelOutput.Contains("GAEP exact Agent and Model dashboard", StringComparison.Ordinal) &&
              agentModelOutput.Contains("Evidence freshness: current", StringComparison.Ordinal) &&
              agentModelOutput.Contains("Confidence: not assessed", StringComparison.Ordinal) &&
              agentModelOutput.Contains("Provider usage: unavailable", StringComparison.Ordinal) &&
              agentModelOutput.Contains("cannot select or switch an agent", StringComparison.Ordinal) &&
              !agentModelOutput.Contains("Founder Product", StringComparison.Ordinal) &&
              !agentModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !agentModelOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Agent/Model workflow renders metadata only with unavailable metrics and explicit no-authority boundaries");
        var agentModelTables = await new ProductWorkflowController(client).ReadAgentModelTablesAsync();
        Check(agentModelTables.Select(table => table.Id).SequenceEqual([
                  "agent-capabilities",
                  "agent-selection",
                  "agent-runs",
                  "agent-handoffs",
                  "provider-metrics",
              ]) && agentModelTables.All(table => table.SnapshotDigest == agentModel.SnapshotDigest),
            "Accessible Agent/Model tables preserve all five exact categories and the verified snapshot digest");

        var phase1AgentModel = await client.ReadPhase1AgentModelAsync(product, phase1Initiative);
        Check(phase1AgentModel.InitiativeId == phase1Initiative.Id &&
              phase1AgentModel.AgentModel.SnapshotDigest == agentModel.SnapshotDigest &&
              phase1AgentModel.Capabilities.Total == 2 && phase1AgentModel.Capabilities.Detected == 1 &&
              phase1AgentModel.Runs.Total == 0 && phase1AgentModel.LiveProviderQuality == "not-assessed" &&
              phase1AgentModel.SemanticOutputQuality == "not-assessed" &&
              phase1AgentModel.ProductOwnerAcceptance == "not-established",
            "Typed Phase 1 Agent/Model projection preserves exact Initiative execution truth and absent authority");
        var phase1AgentModelJson = JsonSerializer.Serialize(phase1AgentModel);
        Check(!phase1AgentModelJson.Contains("Founder Product", StringComparison.Ordinal) &&
              !phase1AgentModelJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !phase1AgentModelJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed Phase 1 Agent/Model projection withholds Product text, private paths, and credentials");
        var phase1AgentModelOutput = await new ProductWorkflowController(client)
            .ReadPhase1AgentModelAsync(InitiativeId);
        Check(phase1AgentModelOutput.Contains("GAEP exact Phase 1 Agent and Model execution truth", StringComparison.Ordinal) &&
              phase1AgentModelOutput.Contains("Capabilities: 2/2 shown; 1 detected; 1 unavailable", StringComparison.Ordinal) &&
              phase1AgentModelOutput.Contains("Live provider quality: not-assessed", StringComparison.Ordinal) &&
              phase1AgentModelOutput.Contains("Product Owner acceptance: not-established", StringComparison.Ordinal) &&
              phase1AgentModelOutput.Contains("does not establish provider readiness or quality", StringComparison.Ordinal) &&
              !phase1AgentModelOutput.Contains("Founder Product", StringComparison.Ordinal) &&
              !phase1AgentModelOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !phase1AgentModelOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Phase 1 Agent/Model workflow renders Initiative execution truth with explicit no-authority boundaries");
        foreach (var hostileRoot in new[]
                 {
                     badPhase1AgentModelCountRoot,
                     badPhase1AgentModelDigestRoot,
                     badPhase1AgentModelPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileClient.ReadProductBindingAsync();
            var hostileInitiative = await hostileClient.ReadInitiativeAsync(InitiativeId);
            var invalidDashboard = await CaptureHostErrorAsync(
                () => hostileClient.ReadPhase1AgentModelAsync(hostileProduct, hostileInitiative));
            Check(invalidDashboard.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidDashboard.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidDashboard.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Phase 1 Agent/Model dashboard rejects hostile count, digest, and private-field drift");
        }
        foreach (var hostileRoot in new[]
                 {
                     badAgentModelBindingRoot,
                     badAgentModelCountRoot,
                     badAgentModelFreshnessRoot,
                     badAgentModelMetricsRoot,
                     badAgentModelEvidenceCuesRoot,
                     badAgentModelDigestRoot,
                     badAgentModelPrivateRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var hostileProduct = await hostileClient.ReadProductBindingAsync();
            var invalidDashboard = await CaptureHostErrorAsync(
                () => hostileClient.ReadAgentModelAsync(hostileProduct));
            Check(invalidDashboard.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidDashboard.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidDashboard.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Agent/Model dashboard rejects hostile binding, count, freshness, metric, evidence-cue, digest, and private-field drift");
        }
        await ExpectAsync<ArgumentException>(
            () => client.ReadAgentModelAsync(product with { Digest = "sha256:not-a-digest" }),
            "Invalid Agent/Model Product digests fail before transport");

        var readiness = await client.ProbeAgentReadinessAsync();
        Check(readiness.Select(snapshot => snapshot.AgentId).SequenceEqual(["claude-code", "codex"]),
            "Typed readiness returns deterministic Codex and Claude observations");
        Check(!readiness[0].Detected && readiness[1].Models.Any(model => model.Id == "gpt-5.6-codex") &&
              readiness[1].SettingsCount == 1 && readiness[1].Settings.Single().Key == "reasoningEffort" &&
              readiness[1].Settings.Single().Kind == "select" && !readiness[1].Settings.Single().Sensitive,
            "Typed readiness projects observed availability, models, and portable setting descriptors");
        var readinessProperties = typeof(AgentReadinessSnapshot).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!readinessProperties.Overlaps(["Executable", "ExecutablePath", "Path", "Token", "Credentials", "DefaultValue"]),
            "Public readiness type excludes executable paths, credentials, tokens, and setting defaults");
        var readinessJson = JsonSerializer.Serialize(readiness);
        Check(!readinessJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !readinessJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed readiness omits private paths and credentials");

        var initialSelection = await client.ReadAgentSelectionAsync();
        Check(initialSelection.Status == AgentSelectionStatus.Unselected && initialSelection.Selection is null,
            "Typed selection state starts explicitly unselected");
        var controller = new ProductWorkflowController(client);
        var selectionContext = await controller.ReadAgentSelectionContextAsync();
        Check(selectionContext.Available.Select(snapshot => snapshot.AgentId).SequenceEqual(["codex"]),
            "Selection context exposes detected executable adapters only");
        var selectionSettings = ProductWorkflowController.BuildAgentSelectionSettings(
            selectionContext.Available.Single(),
            new Dictionary<string, string> { ["reasoningEffort"] = "high" });
        var selectionOutput = await controller.SelectAgentAsync(
            "openai-codex",
            "gpt-5.6-codex",
            selectionSettings,
            "founder.review");
        Check(selectionOutput.Contains("GAEP guarded Agent Selection", StringComparison.Ordinal) &&
              selectionOutput.Contains("codex", StringComparison.Ordinal) &&
              selectionOutput.Contains("gpt-5.6-codex", StringComparison.Ordinal) &&
              selectionOutput.Contains("does not start a provider", StringComparison.Ordinal) &&
              !selectionOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !selectionOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Selection workflow renders path-free non-executing portable state");
        var selectedState = await client.ReadAgentSelectionAsync();
        Check(selectedState.Status == AgentSelectionStatus.Selected &&
              selectedState.Selection?.AdapterId == "openai-codex" &&
              selectedState.Selection.Settings["reasoningEffort"] == new PortableAgentText("high"),
            "Typed selection read returns the exact persisted portable state");
        var selectionJson = JsonSerializer.Serialize(selectedState);
        Check(!selectionJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !selectionJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed Agent Selection excludes private paths and credentials");
        var selectionProperties = typeof(AgentSelection).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!selectionProperties.Overlaps(["Executable", "ExecutablePath", "Path", "Token", "Credentials"]),
            "Public Agent Selection has no machine-local runtime or credential fields");
        var selectedAgentModel = await client.ReadAgentModelAsync(product);
        Check(selectedAgentModel.Selection.Status == "selected" &&
              selectedAgentModel.Selection.CapabilityState == "stale" &&
              selectedAgentModel.Freshness.State == "attention-required" &&
              selectedAgentModel.EvidenceCues.Freshness == "stale" &&
              selectedAgentModel.Capabilities.Count(capability => capability.Selected) == 1,
            "Agent/Model dashboard exposes selected capability drift without promoting readiness");
        var selectedAgentModelJson = JsonSerializer.Serialize(selectedAgentModel);
        Check(!selectedAgentModelJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !selectedAgentModelJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Selected Agent/Model dashboard remains private-safe");
        await ExpectAsync<ArgumentException>(
            () => client.SelectAgentAsync(
                "openai-codex",
                "gpt-5.6-codex",
                new Dictionary<string, PortableAgentSettingValue> { ["apiKey"] = new PortableAgentText("private") },
                "founder.review"),
            "Secret-bearing setting keys fail before transport");
        await ExpectAsync<ArgumentException>(
            () => client.SelectAgentAsync(
                "openai-codex",
                "gpt-5.6-codex",
                new Dictionary<string, PortableAgentSettingValue>
                {
                    ["reasoningEffort"] = new PortableAgentText("/Users/private/config"),
                },
                "founder.review"),
            "Path-bearing setting values fail before transport");

        var runs = await client.ListRunsAsync();
        Check(runs.Count == 1 && runs[0].Id == RunId && runs[0].State == AgentRunState.Completed &&
              runs[0].Agent.ModelId == "gpt-5.6-codex" && runs[0].EndedAt.HasValue,
            "Typed Run history returns the exact latest terminal source binding");
        var runJson = JsonSerializer.Serialize(runs);
        Check(!runJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !runJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed Run history omits private paths and credentials");
        var runProperties = typeof(AgentRun).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!runProperties.Overlaps(["Executable", "ExecutablePath", "Path", "Token", "Credentials"]),
            "Public Run history has no machine-local executable, path, token, or credential fields");

        var managedPreview = await controller.PreviewManagedReadOnlyAsync(
            CharterId.ToString("D"),
            WorkflowPlanId.ToString("D"));
        Check(managedPreview.CharterId == CharterId && managedPreview.WorkflowPlanId == WorkflowPlanId &&
              managedPreview.StepIds.SequenceEqual([WorkflowStepId]) && managedPreview.Gates.Count == 6 &&
              managedPreview.ReadScopeCount == 2 && managedPreview.PreviewDigest.StartsWith("sha256:", StringComparison.Ordinal),
            "Managed read-only preview binds exact identities, steps, gates, reads, and canonical digest");
        var managedPreviewJson = JsonSerializer.Serialize(managedPreview);
        Check(!managedPreviewJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedPreviewJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed managed read-only preview omits private paths and credentials");
        var managedPreviewProperties = typeof(ManagedReadOnlyPreview).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!managedPreviewProperties.Overlaps([
                "Path", "Token", "Credential", "RawOutput", "ProviderSession", "ToolDefinitions",
            ]),
            "Public managed read-only preview has no path, credential, raw-output, provider-session, or tool-definition fields");
        var managedPreviewOutput = ProductWorkflowController.RenderManagedReadOnlyPreview(managedPreview);
        Check(managedPreviewOutput.Contains(managedPreview.PreviewDigest, StringComparison.Ordinal) &&
              managedPreviewOutput.Contains("Every Tool permission is denied", StringComparison.Ordinal) &&
              managedPreviewOutput.Contains("This preview does not execute work", StringComparison.Ordinal),
            "Managed read-only preview renders exact digest and non-authority boundaries");
        var managedReceipt = await client.ExecuteManagedReadOnlyAsync(managedPreview, 120_000, "founder.review");
        Check(managedReceipt.RunId == GovernedManagedRunId && managedReceipt.ManagedRunId == ManagedRunId &&
              managedReceipt.PreviewDigest == managedPreview.PreviewDigest && managedReceipt.State == "completed" &&
              managedReceipt.ProviderDisposition == "completed" && managedReceipt.OutcomeStatus == "satisfied",
            "Typed managed read-only receipt binds exact Run identities, preview, provider disposition, and governed outcome");
        var managedReceiptJson = JsonSerializer.Serialize(managedReceipt);
        Check(!managedReceiptJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedReceiptJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed managed read-only receipt omits private paths and credentials");
        var managedReceiptProperties = typeof(ManagedReadOnlyReceipt).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!managedReceiptProperties.Overlaps([
                "Path", "Token", "Credential", "RawOutput", "ProviderSession", "SourceBytes",
            ]),
            "Public managed read-only receipt has no path, credential, raw-output, provider-session, or source-byte fields");
        var managedReceiptOutput = await controller.ExecuteManagedReadOnlyAsync(
            managedPreview,
            "founder.review",
            timeoutMs: 120_000);
        Check(managedReceiptOutput.Contains(GovernedManagedRunId.ToString("D"), StringComparison.Ordinal) &&
              managedReceiptOutput.Contains(ManagedRunId.ToString("D"), StringComparison.Ordinal) &&
              managedReceiptOutput.Contains("Governed outcome: satisfied", StringComparison.Ordinal) &&
              managedReceiptOutput.Contains("Provider completion and governed outcome are separate claims", StringComparison.Ordinal) &&
              !managedReceiptOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedReceiptOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Managed read-only workflow renders a private-safe receipt with separate provider and outcome truth");
        await ExpectAsync<ArgumentOutOfRangeException>(
            () => client.ExecuteManagedReadOnlyAsync(managedPreview, 999, "founder.review"),
            "Managed read-only timeout is bounded before transport");
        await ExpectAsync<ArgumentException>(
            () => client.ExecuteManagedReadOnlyAsync(
                managedPreview with { PreviewDigest = $"sha256:{new string('0', 64)}" },
                120_000,
                "founder.review"),
            "A locally forged managed preview digest fails before transport");
        var privateCriterionGate = managedPreview.Gates[0] with
        {
            Criteria = Array.AsReadOnly(new[] { $"Inspect {PrivateRoot}; token={PrivateCredential}" }),
        };
        await ExpectAsync<ArgumentException>(
            () => client.ExecuteManagedReadOnlyAsync(
                managedPreview with
                {
                    Gates = Array.AsReadOnly(new[] { privateCriterionGate }.Concat(managedPreview.Gates.Skip(1)).ToArray()),
                },
                120_000,
                "founder.review"),
            "Private-path and secret-shaped managed criteria fail before transport");

        foreach (var hostileRoot in new[] { badManagedPreviewRoot, badManagedCriterionRoot, badManagedDigestRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalidPreview = await CaptureHostErrorAsync(() => hostileClient.PreviewManagedReadOnlyAsync(CharterId, WorkflowPlanId));
            Check(invalidPreview.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidPreview.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidPreview.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile managed preview fields, criteria, and digests fail closed without reflection");
        }
        foreach (var hostileRoot in new[] { badManagedReceiptRoot, badManagedBindingRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var preview = await hostileClient.PreviewManagedReadOnlyAsync(CharterId, WorkflowPlanId);
            var invalidReceipt = await CaptureHostErrorAsync(() =>
                hostileClient.ExecuteManagedReadOnlyAsync(preview, 120_000, "founder.review"));
            Check(invalidReceipt.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidReceipt.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidReceipt.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile managed receipt private fields and identity rebinding fail closed without reflection");
        }

        var managedEvidencePage = await client.ListManagedEvidenceAsync(offset: 0, limit: 100);
        Check(managedEvidencePage.Items.Count == 1 && managedEvidencePage.Items[0].ManagedRunId == ManagedRunId &&
              managedEvidencePage.Total == 3 && managedEvidencePage.OmittedCount == 2 && managedEvidencePage.HasMore &&
              managedEvidencePage.Items[0].HasResult && managedEvidencePage.Items[0].HasApplyDecision,
            "Managed evidence inventory preserves exact bounded page, total, omission, result, and apply-decision truth");
        var repeatedManagedEvidencePage = await client.ListManagedEvidenceAsync(
            offset: 0,
            limit: 100,
            snapshotDigest: managedEvidencePage.SnapshotDigest);
        Check(repeatedManagedEvidencePage.SnapshotDigest == managedEvidencePage.SnapshotDigest,
            "Managed evidence pagination binds the exact snapshot digest on reuse");
        var nextManagedEvidencePage = await client.ListManagedEvidenceAsync(
            offset: 1,
            limit: 100,
            snapshotDigest: managedEvidencePage.SnapshotDigest,
            expectedTotal: managedEvidencePage.Total);
        Check(nextManagedEvidencePage.Offset == 1 && nextManagedEvidencePage.Items.Count == 2 &&
              nextManagedEvidencePage.Total == managedEvidencePage.Total && nextManagedEvidencePage.OmittedCount == 1 &&
              !nextManagedEvidencePage.HasMore,
            "Managed evidence later-page navigation preserves exact snapshot, total, omission, and terminal-page truth");
        Check(ProductWorkflowController.RenderManagedEvidencePage(nextManagedEvidencePage)
                .Contains("Offset / limit: 1 / 100", StringComparison.Ordinal),
            "Managed evidence later-page rendering exposes exact offset and limit truth");
        var managedEvidenceJson = JsonSerializer.Serialize(managedEvidencePage);
        Check(!managedEvidenceJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedEvidenceJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed Managed Run inventory omits private paths and credentials");
        var managedEvidencePageOutput = await controller.ListManagedEvidenceAsync();
        Check(managedEvidencePageOutput.Contains("Displayed: 1 of 3", StringComparison.Ordinal) &&
              managedEvidencePageOutput.Contains("Omitted from this page: 2", StringComparison.Ordinal) &&
              managedEvidencePageOutput.Contains("cannot start, resume, cancel, apply, discard, approve", StringComparison.Ordinal) &&
              !managedEvidencePageOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedEvidencePageOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Managed evidence inventory renders exact omission truth and no authority without private reflection");

        var managedEvidenceDetail = await client.ReadManagedEvidenceAsync(ManagedRunId);
        Check(managedEvidenceDetail.Summary.ManagedRunId == ManagedRunId &&
              managedEvidenceDetail.Result?.ResultId == ManagedResultId &&
              managedEvidenceDetail.Evidence?.EvidenceId == ManagedEvidenceId &&
              managedEvidenceDetail.Evidence.EventTypeCounts.Values.Sum() == managedEvidenceDetail.Evidence.EventCount &&
              managedEvidenceDetail.Evidence.Staging?.ChangeCount == 0 &&
              managedEvidenceDetail.ApplyDecision?.ReceiptId == ManagedApplyDecisionId,
            "Managed evidence detail binds exact result, evidence counts, staging, and apply-decision projection");
        var managedEvidenceDetailJson = JsonSerializer.Serialize(managedEvidenceDetail);
        Check(!managedEvidenceDetailJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedEvidenceDetailJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed Managed Run detail omits private paths, provider content, and credentials");
        var managedEvidenceDetailOutput = await controller.ReadManagedEvidenceAsync(ManagedRunId.ToString("D"));
        Check(managedEvidenceDetailOutput.Contains("GAEP exact Managed Run evidence detail", StringComparison.Ordinal) &&
              managedEvidenceDetailOutput.Contains("Provider disposition: completed", StringComparison.Ordinal) &&
              managedEvidenceDetailOutput.Contains("Governed outcome: satisfied", StringComparison.Ordinal) &&
              managedEvidenceDetailOutput.Contains("Verified apply-decision evidence (observation only)", StringComparison.Ordinal) &&
              managedEvidenceDetailOutput.Contains("grants this view no apply, discard, approval", StringComparison.Ordinal) &&
              !managedEvidenceDetailOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !managedEvidenceDetailOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Managed evidence detail renders provider, outcome, and prior decision as separate private-safe claims");
        var recordOnlyDetail = await client.ReadManagedEvidenceAsync(RecordOnlyManagedRunId);
        Check(recordOnlyDetail.ArtifactStatus == "record-only" && recordOnlyDetail.Result is null &&
              recordOnlyDetail.Evidence is null && recordOnlyDetail.ApplyDecision is null &&
              recordOnlyDetail.Summary.State == "running" && !recordOnlyDetail.Summary.HasResult,
            "Record-only Managed Run detail remains non-terminal and does not invent result, evidence, or decision truth");
        var recordOnlyOutput = await controller.ReadManagedEvidenceAsync(RecordOnlyManagedRunId.ToString("D"));
        Check(recordOnlyOutput.Contains("No committed result/evidence pair is bound", StringComparison.Ordinal) &&
              recordOnlyOutput.Contains("No terminal outcome is inferred", StringComparison.Ordinal),
            "Record-only Managed Run rendering explicitly refuses to infer a terminal outcome");
        var managedDetailProperties = typeof(ManagedEvidenceDetail).GetProperties()
            .Select(property => property.Name)
            .ToHashSet();
        Check(!managedDetailProperties.Overlaps([
                "Path", "ChangedPaths", "SourceBytes", "RawOutput", "ProviderOutput", "Credential", "ProcessState",
            ]),
            "Public Managed Run evidence detail has no path, source-byte, raw-output, credential, or process-state fields");
        await ExpectAsync<ArgumentOutOfRangeException>(
            () => client.ListManagedEvidenceAsync(offset: 2_001, limit: 100),
            "Managed evidence offset is bounded before transport");
        await ExpectAsync<ArgumentOutOfRangeException>(
            () => client.ListManagedEvidenceAsync(offset: 0, limit: 201),
            "Managed evidence page size is bounded before transport");
        await ExpectAsync<ArgumentException>(
            () => client.ListManagedEvidenceAsync(offset: 0, limit: 100, snapshotDigest: "not-a-digest"),
            "Managed evidence snapshot digest is validated before transport");
        await ExpectAsync<ArgumentOutOfRangeException>(
            () => client.ListManagedEvidenceAsync(offset: 0, limit: 100, expectedTotal: 2_001),
            "Managed evidence expected total is bounded before transport");
        await ExpectAsync<ArgumentException>(
            () => client.ReadManagedEvidenceAsync(Guid.Empty),
            "Managed evidence exact read rejects an empty Run identity before transport");

        foreach (var hostileRoot in new[] { badManagedEvidencePageRoot, badManagedEvidenceCountRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalidPage = await CaptureHostErrorAsync(() => hostileClient.ListManagedEvidenceAsync());
            Check(invalidPage.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidPage.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidPage.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile Managed Run private fields and omission drift fail closed without reflection");
        }
        await using (var hostileClient = new EngineClient(badManagedEvidenceSnapshotRoot, executable))
        {
            var invalidSnapshot = await CaptureHostErrorAsync(() => hostileClient.ListManagedEvidenceAsync(
                offset: 0,
                limit: 100,
                snapshotDigest: managedEvidencePage.SnapshotDigest));
            Check(invalidSnapshot.Kind == "HOST_RESPONSE_INVALID",
                "Managed Run inventory snapshot substitution fails closed");
        }
        await using (var hostileClient = new EngineClient(badManagedEvidenceTotalRoot, executable))
        {
            var invalidTotal = await CaptureHostErrorAsync(() => hostileClient.ListManagedEvidenceAsync(
                offset: 1,
                limit: 100,
                snapshotDigest: managedEvidencePage.SnapshotDigest,
                expectedTotal: managedEvidencePage.Total));
            Check(invalidTotal.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidTotal.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidTotal.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Managed Run inventory total drift fails closed without private reflection");
        }
        foreach (var hostileRoot in new[]
                 {
                     badManagedEvidenceDetailRoot,
                     badManagedEvidenceBindingRoot,
                     badManagedEvidenceApplyBindingRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalidDetail = await CaptureHostErrorAsync(() => hostileClient.ReadManagedEvidenceAsync(ManagedRunId));
            Check(invalidDetail.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidDetail.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidDetail.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile Managed Run detail private fields and evidence/apply binding drift fail closed without reflection");
        }

        var stagedReview = await controller.ReadManagedReviewAsync(StagedManagedRunId.ToString("D"));
        Check(stagedReview.ManagedRunId == StagedManagedRunId && stagedReview.ManagedRunRevision == 3 &&
              stagedReview.State == "review-required" && stagedReview.CanApply && stagedReview.CanDiscard &&
              stagedReview.PostApplyGatePolicy == "record-not-assessed" && stagedReview.Staging.OmittedCount == 0 &&
              stagedReview.Staging.ChangeCount == stagedReview.Staging.ChangedInventory.Count &&
              stagedReview.Staging.ChangedInventory.Select(change => change.Path)
                  .SequenceEqual(["src/new.cs", "src/review.cs"]) &&
              stagedReview.ApplyConfirmation?.WriteEnvelope.SequenceEqual(["src"]) == true,
            "Managed staged review binds exact revision, complete inventory, write envelope, and non-outcome policy");
        var stagedReviewJson = JsonSerializer.Serialize(stagedReview);
        Check(!stagedReviewJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !stagedReviewJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed managed staged review omits private paths, source bytes, and credentials");
        var stagedReviewOutput = ProductWorkflowController.RenderManagedReviewPreview(stagedReview);
        Check(stagedReviewOutput.Contains("Exact changed-file inventory", StringComparison.Ordinal) &&
              stagedReviewOutput.Contains("src/review.cs", StringComparison.Ordinal) &&
              stagedReviewOutput.Contains("authorizes no mutation", StringComparison.Ordinal) &&
              stagedReviewOutput.Contains("Workflow gates not assessed", StringComparison.Ordinal),
            "Managed staged review renders exact metadata and the non-authority boundary");

        var applyTransition = await controller.ApplyManagedReviewAsync(stagedReview, "founder.review");
        Check(applyTransition.Decision == "apply-exact-managed-review" &&
              applyTransition.SourcePreviewDigest == stagedReview.PreviewDigest &&
              applyTransition.ManagedRunRevision == 4 && applyTransition.State == "failed" &&
              applyTransition.Detail.Result?.OutcomeStatus == "failed" &&
              applyTransition.Detail.Evidence?.Staging?.ApplyState == "applied" &&
              applyTransition.Detail.ApplyDecision?.ManagedRunRevision == 3,
            "Exact apply verifies the advanced persisted transition and explicit not-success outcome");
        var applyTransitionJson = JsonSerializer.Serialize(applyTransition);
        Check(!applyTransitionJson.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !applyTransitionJson.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed exact apply transition omits private paths and credentials");
        var applyTransitionOutput = ProductWorkflowController.RenderManagedReviewTransition(applyTransition);
        Check(applyTransitionOutput.Contains("Persisted state: failed", StringComparison.Ordinal) &&
              applyTransitionOutput.Contains("governed outcome satisfaction", StringComparison.Ordinal) &&
              applyTransitionOutput.Contains("cleanup remain separate claims", StringComparison.Ordinal),
            "Exact apply transition renders persisted state without outcome or cleanup overclaim");

        var discardTransition = await controller.DiscardManagedReviewAsync(stagedReview, "founder.review");
        Check(discardTransition.Decision == "discard-exact-managed-review" &&
              discardTransition.State == "discarded" && !discardTransition.CanApply && !discardTransition.CanDiscard &&
              discardTransition.Detail.Evidence?.Staging?.ApplyState == "discarded" &&
              discardTransition.Detail.ApplyDecision is null,
            "Exact discard verifies discarded state without inventing apply-decision evidence");
        await ExpectAsync<ArgumentException>(
            () => client.ApplyManagedReviewAsync(
                stagedReview with { PreviewDigest = $"sha256:{new string('0', 64)}" },
                "founder.review"),
            "A locally forged staged-review digest fails before transport");
        var reboundChanges = stagedReview.Staging.ChangedInventory.Select((change, index) =>
            index == 0 ? change with { Path = $"{PrivateRoot}/secret.cs" } : change).ToArray();
        var reboundReviewError = await CaptureHostErrorAsync(() => client.DiscardManagedReviewAsync(
            stagedReview with
            {
                Staging = stagedReview.Staging with { ChangedInventory = Array.AsReadOnly(reboundChanges) },
            },
            "founder.review"));
        Check(reboundReviewError.Kind == "HOST_RESPONSE_INVALID" &&
              !reboundReviewError.Message.Contains(PrivateRoot, StringComparison.Ordinal),
            "A locally rebound absolute review path fails before transport without reflection");

        foreach (var hostileRoot in new[]
                 {
                     badManagedReviewDigestRoot,
                     badManagedReviewPrivateRoot,
                     badManagedReviewBindingRoot,
                     badManagedReviewPathRoot,
                     badManagedReviewMetadataRoot,
                 })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var invalidReview = await CaptureHostErrorAsync(() => hostileClient.ReadManagedReviewAsync(StagedManagedRunId));
            Check(invalidReview.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidReview.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidReview.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile staged-review private, path, metadata, rebound, and digest responses fail closed without reflection");
        }
        foreach (var hostileRoot in new[] { badManagedTransitionDigestRoot, badManagedTransitionPrivateRoot })
        {
            await using var hostileClient = new EngineClient(hostileRoot, executable);
            var hostilePreview = await hostileClient.ReadManagedReviewAsync(StagedManagedRunId);
            var invalidTransition = await CaptureHostErrorAsync(() =>
                hostileClient.ApplyManagedReviewAsync(hostilePreview, "founder.review"));
            Check(invalidTransition.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidTransition.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidTransition.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Hostile managed-review transition private fields and digest drift fail closed without reflection");
        }
        await using (var staleClient = new EngineClient(staleManagedReviewRoot, executable))
        {
            var stalePreview = await staleClient.ReadManagedReviewAsync(StagedManagedRunId);
            var staleError = await CaptureHostErrorAsync(() =>
                staleClient.ApplyManagedReviewAsync(stalePreview, "founder.review"));
            Check(staleError.Kind == "MANAGED_REVIEW_CHANGED" && staleError.Code == -32_029 &&
                  !staleError.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !staleError.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Stale staged-review decisions preserve the stable private-safe changed error");
        }

        var handoffContext = await controller.ReadAgentHandoffContextAsync();
        Check(handoffContext.SourceRun.Id == RunId && handoffContext.Current.ModelId == "gpt-5.6-codex" &&
              handoffContext.Available.Single(snapshot => snapshot.AgentId == "codex").Detected,
            "Handoff context binds the latest terminal Run, exact current selection, and observed adapter");
        var targetSettings = ProductWorkflowController.BuildAgentSelectionSettings(
            handoffContext.Available.Single(snapshot => snapshot.AgentId == "codex"),
            new Dictionary<string, string> { ["reasoningEffort"] = "medium" });
        var handoffOutput = await controller.CreateAgentHandoffAsync(
            handoffContext,
            "openai-codex",
            "gpt-5.6-codex-next",
            targetSettings,
            "Switch to the reviewed model",
            ["Selection workflow completed"],
            ["Native Visual Studio acceptance remains"],
            ["Keep execution disabled"],
            ["evidence/visual-studio-selection.json"],
            "founder.review");
        Check(handoffOutput.Contains("GAEP versioned Agent Handoff", StringComparison.Ordinal) &&
              handoffOutput.Contains(HandoffId.ToString("D"), StringComparison.Ordinal) &&
              handoffOutput.Contains(RunId.ToString("D"), StringComparison.Ordinal) &&
              handoffOutput.Contains("gpt-5.6-codex-next", StringComparison.Ordinal) &&
              handoffOutput.Contains("did not start or resume a provider", StringComparison.Ordinal) &&
              !handoffOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !handoffOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Versioned handoff renders an exact private-safe non-executing receipt");
        var switchedSelection = await client.ReadAgentSelectionAsync();
        Check(switchedSelection.Status == AgentSelectionStatus.Selected &&
              switchedSelection.Selection?.ModelId == "gpt-5.6-codex-next" &&
              switchedSelection.Selection.Settings["reasoningEffort"] == new PortableAgentText("medium"),
            "Successful handoff atomically records the exact changed portable selection");
        var handoffProperties = typeof(AgentHandoff).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!handoffProperties.Overlaps([
                "Executable", "ExecutablePath", "Path", "Token", "Credentials", "ProviderSession", "Session",
            ]),
            "Public handoff receipt has no executable, path, token, credential, or provider-session fields");
        await ExpectAsync<ArgumentException>(
            () => CreateTestHandoffAsync(client, reason: $"Inspect {PrivateRoot}/{PrivateCredential}"),
            "Absolute-path and credential-bearing handoff reasons fail before transport");

        await using (var badRunsClient = new EngineClient(badRunsRoot, executable))
        {
            var invalidRuns = await CaptureHostErrorAsync(() => badRunsClient.ListRunsAsync());
            Check(invalidRuns.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidRuns.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidRuns.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Run history rejects an unexpected private executable path without reflecting it");
        }

        await using (var badHandoffClient = new EngineClient(badHandoffRoot, executable))
        {
            var invalidHandoff = await CaptureHostErrorAsync(() => CreateTestHandoffAsync(badHandoffClient));
            Check(invalidHandoff.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidHandoff.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidHandoff.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Handoff receipt rejects an unexpected private executable path without reflecting it");
        }

        await using (var badHandoffBindingClient = new EngineClient(badHandoffBindingRoot, executable))
        {
            var mismatchedHandoff = await CaptureHostErrorAsync(() => CreateTestHandoffAsync(badHandoffBindingClient));
            Check(mismatchedHandoff.Kind == "HOST_RESPONSE_INVALID",
                "Handoff receipt rejects a returned target setting that differs from the exact request");
        }

        await using (var badReadinessClient = new EngineClient(badReadinessRoot, executable))
        {
            var invalidReadiness = await CaptureHostErrorAsync(() => badReadinessClient.ProbeAgentReadinessAsync());
            Check(invalidReadiness.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidReadiness.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidReadiness.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Readiness rejects an unexpected private executable path without reflecting it");
        }

        await using (var badSelectionClient = new EngineClient(badSelectionRoot, executable))
        {
            var invalidSelection = await CaptureHostErrorAsync(() => badSelectionClient.ReadAgentSelectionAsync());
            Check(invalidSelection.Kind == "HOST_RESPONSE_INVALID" &&
                  !invalidSelection.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
                  !invalidSelection.Message.Contains(PrivateCredential, StringComparison.Ordinal),
                "Selection state rejects an unexpected private executable path without reflecting it");
        }
        var imported = await client.ImportPortableDesignSnapshotAsync(
            bundleRoot,
            ProductId,
            expectedProductRevision: 7,
            actorId: "founder.portable-design-review");
        Check(imported.BundleId == BundleId && imported.ProductId == ProductId, "Import returns exact Product-bound metadata");
        Check(imported.Governance.State == "pending-human-review" && imported.Governance.HumanReviewRequired,
            "Imported metadata remains pending human review");
        Check(imported.SourceReview.Status == PortableDesignSourceReviewStatus.Approved &&
              !imported.SourceReview.GaepApproval && imported.SourceReview.ClaimLabel.Contains("not GAEP approval", StringComparison.Ordinal),
            "Upstream approval is non-authoritative");
        Check(imported.Counts == new PortableDesignCounts(2, 1, 6, 5), "Only bounded aggregate counts are returned");

        var serialized = JsonSerializer.Serialize(imported);
        Check(!serialized.Contains(bundleRoot, StringComparison.Ordinal) &&
              !serialized.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !serialized.Contains(PrivateCredential, StringComparison.Ordinal),
            "Typed metadata omits roots, paths, and credentials");
        var exposedNames = typeof(PortableDesignSnapshotSummary).GetProperties().Select(property => property.Name).ToHashSet();
        Check(!exposedNames.Overlaps(["BundleRoot", "ArtifactPath", "Artifacts", "Tokens", "TokenValue", "SourceBytes", "Credentials"]),
            "Public summary type has no private-content fields");
        var importParameters = typeof(EngineClient)
            .GetMethod(nameof(EngineClient.ImportPortableDesignSnapshotAsync))!
            .GetParameters()
            .Select(parameter => parameter.Name)
            .ToArray();
        Check(importParameters.SequenceEqual([
            "bundleRoot", "expectedProductId", "expectedProductRevision", "actorId", "cancellationToken",
        ]), "Typed import exposes only the absolute local folder, exact Product context, actor, and cancellation");
        Check(!importParameters.Any(parameter => parameter is not null &&
              (parameter.Contains("archive", StringComparison.OrdinalIgnoreCase) ||
               parameter.Contains("fig", StringComparison.OrdinalIgnoreCase) ||
               parameter.Contains("oauth", StringComparison.OrdinalIgnoreCase) ||
               parameter.Contains("url", StringComparison.OrdinalIgnoreCase) ||
               parameter.Contains("account", StringComparison.OrdinalIgnoreCase))),
            "Typed import has no archive, proprietary, OAuth, network, or account fields");

        var page = await client.ListPortableDesignSnapshotsAsync(offset: 0, limit: 1);
        Check(page.Items.Count == 1 && page.Items[0].BundleId == BundleId && !page.HasMore,
            "Bounded list returns the exact page metadata");
        Check(page.GovernanceBoundary.Contains("pending human review", StringComparison.Ordinal),
            "List preserves the governance boundary");
        var read = await client.ReadPortableDesignSnapshotAsync(BundleId);
        Check(read == imported, "Exact read returns the requested bundle metadata");

        var productOutput = await controller.ReadProductAsync();
        Check(productOutput.Contains("Product: Founder Product", StringComparison.Ordinal) &&
              productOutput.Contains($"Product ID: {ProductId:D}", StringComparison.Ordinal) &&
              productOutput.Contains("Revision: 7", StringComparison.Ordinal) &&
              !productOutput.Contains(PrivateRoot, StringComparison.Ordinal),
            "Product workflow renders exact public binding metadata only");
        var readinessOutput = await controller.ReadAgentReadinessAsync();
        Check(readinessOutput.Contains("OpenAI Codex", StringComparison.Ordinal) &&
              readinessOutput.Contains("Anthropic Claude Code", StringComparison.Ordinal) &&
              readinessOutput.Contains("Observation only", StringComparison.Ordinal) &&
              readinessOutput.Contains("cannot select a model", StringComparison.Ordinal) &&
              !readinessOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !readinessOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Product workflow renders path-free observation-only readiness");
        var listOutput = await controller.ListPortableDesignSnapshotsAsync();
        Check(listOutput.Contains("Portable design metadata: 1 of 1", StringComparison.Ordinal) &&
              listOutput.Contains("pending human review", StringComparison.Ordinal) &&
              !listOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !listOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Product workflow lists bounded governed metadata without private content");
        var readOutput = await controller.ReadPortableDesignSnapshotAsync(BundleId.ToString("D"));
        Check(readOutput.Contains($"Bundle ID: {BundleId:D}", StringComparison.Ordinal) &&
              readOutput.Contains("GAEP approval=false", StringComparison.Ordinal),
            "Product workflow reads one exact governed snapshot");
        var importOutput = await controller.ImportPortableDesignSnapshotAsync(
            bundleRoot,
            "gaep.visual-studio-local-human");
        Check(importOutput.Contains("exact Product revision 7", StringComparison.Ordinal) &&
              importOutput.Contains("remains pending human review", StringComparison.Ordinal) &&
              !importOutput.Contains(bundleRoot, StringComparison.Ordinal),
            "Product workflow binds import to two matching Product reads and omits the local root");
        Check(ProductWorkflowController.NormalizeWorkspacePath(temporaryRoot) == Path.GetFullPath(temporaryRoot),
            "Product workflow accepts an existing absolute local workspace");
        await ExpectAsync<ArgumentException>(
            () => Task.FromResult(ProductWorkflowController.NormalizeWorkspacePath("relative/workspace")),
            "Relative workspaces fail before engine launch");
        Check(!ProductWorkflowController.SafeError(new InvalidOperationException($"secret={PrivateCredential}"))
                .Contains(PrivateCredential, StringComparison.Ordinal),
            "Unexpected workflow failures map to a stable private message");

        var changingWorkspace = Path.Combine(temporaryRoot, "product-change");
        Directory.CreateDirectory(changingWorkspace);
        await using var changingClient = new EngineClient(changingWorkspace, executable);
        var changingController = new ProductWorkflowController(changingClient);
        var changed = await CaptureHostErrorAsync(() => changingController.ImportPortableDesignSnapshotAsync(
            bundleRoot,
            "gaep.visual-studio-local-human"));
        Check(changed.Kind == "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED" &&
              changed.Code == -32_031,
            "Product workflow stops when identity or revision changes between binding reads");

        await ExpectAsync<ArgumentException>(
            () => client.ImportPortableDesignSnapshotAsync("relative/bundle", ProductId, 7, "founder.review"),
            "Relative bundle roots fail before transport");
        await ExpectAsync<ArgumentException>(
            () => client.ImportPortableDesignSnapshotAsync(bundleRoot, ProductId, 0, "founder.review"),
            "Non-positive Product revisions fail before transport");
        await ExpectAsync<ArgumentException>(
            () => client.ImportPortableDesignSnapshotAsync(bundleRoot, Guid.Empty, 7, "founder.review"),
            "Empty Product identities fail before transport");
        await ExpectAsync<ArgumentException>(
            () => client.ImportPortableDesignSnapshotAsync(bundleRoot, ProductId, 7, "not a portable actor"),
            "Non-portable actors fail before transport");
        await ExpectAsync<ArgumentOutOfRangeException>(
            () => client.ListPortableDesignSnapshotsAsync(offset: 10_001, limit: 1),
            "List offset is capped at 10,000");
        await ExpectAsync<ArgumentOutOfRangeException>(
            () => client.ListPortableDesignSnapshotsAsync(offset: 0, limit: 201),
            "List page size is capped at 200");
        await ExpectAsync<ArgumentException>(
            () => client.ReadPortableDesignSnapshotAsync(Guid.Empty),
            "Empty bundle identities fail before transport");

        var sourceError = await CaptureHostErrorAsync(() => client.ImportPortableDesignSnapshotAsync(
            invalidSourceRoot,
            ProductId,
            7,
            "founder.review"));
        Check(sourceError.Kind == "PORTABLE_DESIGN_SOURCE_INVALID" &&
              sourceError.Message == "The local portable design bundle did not pass bounded validation." &&
              !sourceError.Message.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !sourceError.Message.Contains(PrivateCredential, StringComparison.Ordinal),
            "Raw host errors map to a stable private source error");

        var missing = await CaptureHostErrorAsync(() => client.ReadPortableDesignSnapshotAsync(MissingBundleId));
        Check(missing.Kind == "PORTABLE_DESIGN_NOT_FOUND" && !missing.Message.Contains(PrivateRoot, StringComparison.Ordinal),
            "Missing exact reads use a stable private error");
        var unexpectedField = await CaptureHostErrorAsync(() => client.ReadPortableDesignSnapshotAsync(ExtraFieldBundleId));
        Check(unexpectedField.Kind == "HOST_RESPONSE_INVALID" &&
              !unexpectedField.Message.Contains(PrivateRoot, StringComparison.Ordinal),
            "Unexpected private response fields fail closed");
        var mismatched = await CaptureHostErrorAsync(() => client.ReadPortableDesignSnapshotAsync(MismatchedBundleId));
        Check(mismatched.Kind == "HOST_RESPONSE_INVALID", "Exact read rejects a different bundle identity");
        var extraErrorEnvelope = await CaptureHostErrorAsync(() => client.ReadPortableDesignSnapshotAsync(ExtraErrorEnvelopeBundleId));
        Check(extraErrorEnvelope.Kind == "HOST_RESPONSE_INVALID" &&
              !extraErrorEnvelope.Message.Contains(PrivateRoot, StringComparison.Ordinal),
            "Error envelopes reject extra result and private root fields");
        var wrongErrorCode = await CaptureHostErrorAsync(() => client.ReadPortableDesignSnapshotAsync(WrongErrorCodeBundleId));
        Check(wrongErrorCode.Kind == "HOST_RESPONSE_INVALID",
            "Allowlisted host error kinds reject a mismatched numeric code");
        var overfullPage = await CaptureHostErrorAsync(() => client.ListPortableDesignSnapshotsAsync(offset: 9_999, limit: 200));
        Check(overfullPage.Kind == "HOST_RESPONSE_INVALID", "Response pages cannot exceed the requested hard limit");

        var oversized = await CaptureHostErrorAsync(() => client.ReadPortableDesignSnapshotAsync(OversizedBundleId));
        Check(oversized.Kind == "RESPONSE_TOO_LARGE", "The existing one MiB response-frame bound remains enforced");
    }

    private static Task<AgentHandoff> CreateTestHandoffAsync(
        EngineClient client,
        string reason = "Switch to the reviewed model") =>
        client.CreateHandoffAsync(
            RunId,
            ProductId,
            InitiativeId,
            "openai-codex",
            "codex",
            "gpt-5.6-codex-next",
            new Dictionary<string, PortableAgentSettingValue>
            {
                ["reasoningEffort"] = new PortableAgentText("medium"),
            },
            reason,
            ["Selection workflow completed"],
            ["Native Visual Studio acceptance remains"],
            ["Keep execution disabled"],
            ["evidence/visual-studio-selection.json"],
            "founder.review");

    private static AccessibleMetadataTable AccessibleTableFixture() => AccessibleDashboardTables.Exact(
        new AccessibleMetadataTable(
            "verified-runs",
            "Verified Runs",
            new[]
            {
                new AccessibleTableColumn("name", "Name"),
                new AccessibleTableColumn("state", "State"),
            },
            new[]
            {
                new AccessibleTableRow("row-b", new Dictionary<string, string>
                {
                    ["name"] = "Bravo",
                    ["state"] = "pending",
                }),
                new AccessibleTableRow("row-a", new Dictionary<string, string>
                {
                    ["name"] = "Alpha",
                    ["state"] = "pending",
                }),
                new AccessibleTableRow("row-c", new Dictionary<string, string>
                {
                    ["name"] = "=SUM(A1:A2)",
                    ["state"] = "complete",
                }),
            },
            5,
            2,
            $"sha256:{new string('a', 64)}",
            "already-verified-bounded-metadata-only",
            "table-does-not-authorize-run-or-effects"));

    private static async Task<EngineHostException> CaptureHostErrorAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (EngineHostException error)
        {
            passed++;
            return error;
        }
        throw new InvalidOperationException("Expected a stable EngineHostException.");
    }

    private static async Task ExpectAsync<TException>(Func<Task> action, string description)
        where TException : Exception
    {
        try
        {
            await action();
        }
        catch (TException)
        {
            passed++;
            return;
        }
        throw new InvalidOperationException($"Expected {typeof(TException).Name}: {description}");
    }

    private static void Expect<TException>(Action action, string description)
        where TException : Exception
    {
        try
        {
            action();
        }
        catch (TException)
        {
            passed++;
            return;
        }
        throw new InvalidOperationException($"Expected {typeof(TException).Name}: {description}");
    }

    private static void Check(bool condition, string description)
    {
        if (!condition) throw new InvalidOperationException(description);
        passed++;
    }

    private static string FindExecutable(string name)
    {
        var extensions = OperatingSystem.IsWindows()
            ? (Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT")
                .Split(';', StringSplitOptions.RemoveEmptyEntries)
            : [string.Empty];
        foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? string.Empty)
                     .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            foreach (var extension in extensions)
            {
                var candidate = Path.Combine(
                    directory,
                    name.EndsWith(extension, StringComparison.OrdinalIgnoreCase) ? name : name + extension);
                if (File.Exists(candidate)) return Path.GetFullPath(candidate);
            }
        }
        throw new FileNotFoundException($"The {name} test runtime was not found.");
    }

    private static string Sha256File(string path)
    {
        using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Convert.ToHexString(SHA256.HashData(input)).ToLowerInvariant();
    }

    private static void VerifyPackageAssembly(string requestedPath)
    {
        const string resourceName = "Gaep.HostClient.PackagedEngine.gaep-engine.mjs";
        const int maxEngineBytes = 8 * 1024 * 1024;
        var packagePath = Path.GetFullPath(requestedPath);
        var packageInfo = new FileInfo(packagePath);
        if (!packageInfo.Exists || packageInfo.LinkTarget is not null || packageInfo.Length is < 1 or > 16 * 1024 * 1024)
        {
            throw new InvalidOperationException("The packaged Visual Studio HostClient assembly is missing or unsafe.");
        }

        using var expectedResource = typeof(VisualStudioPackagedEngine).Assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException("The independently built HostClient engine resource is missing.");
        if (expectedResource.Length is < 1 or > maxEngineBytes)
        {
            throw new InvalidOperationException("The independently built HostClient engine resource is outside its boundary.");
        }
        var expectedDigest = Convert.ToHexString(SHA256.HashData(expectedResource)).ToLowerInvariant();

        var loadContext = new AssemblyLoadContext("gaep-visual-studio-package-verifier", isCollectible: true);
        try
        {
            var packageAssembly = loadContext.LoadFromAssemblyPath(packagePath);
            var resources = packageAssembly.GetManifestResourceNames();
            if (resources.Count(name => name == resourceName) != 1)
            {
                throw new InvalidOperationException("The packaged Visual Studio HostClient engine resource is missing or ambiguous.");
            }
            using var packagedResource = packageAssembly.GetManifestResourceStream(resourceName)
                ?? throw new InvalidOperationException("The packaged Visual Studio HostClient engine resource cannot be read.");
            if (packagedResource.Length is < 1 or > maxEngineBytes)
            {
                throw new InvalidOperationException("The packaged Visual Studio HostClient engine resource is outside its boundary.");
            }
            var packagedDigest = Convert.ToHexString(SHA256.HashData(packagedResource)).ToLowerInvariant();
            if (!StringComparer.Ordinal.Equals(packagedDigest, expectedDigest))
            {
                throw new InvalidOperationException("The packaged Visual Studio HostClient engine differs from the verified build resource.");
            }
            Console.WriteLine($"GAEP Visual Studio packaged HostClient engine resource: PASS (sha256:{packagedDigest})");
        }
        finally
        {
            loadContext.Unload();
        }
    }

    private static InitiativeClassificationInput InitiativeClassificationFixture() => new(
        PrimaryType: "feature",
        SecondaryTypes: ["integration"],
        SystemState: "brownfield",
        ChangePosture: "existing",
        Motivations: ["business-driven", "technical"],
        Characteristics: new InitiativeClassificationCharacteristics(
            "ui-bearing",
            "data-bearing",
            "integration-heavy",
            ["interactive", "asynchronous"],
            "internal"),
        Regulated: false,
        PolicyDomains: ["governance"],
        Sensitivities: ["security", "privacy"],
        ExpectedLifetime: "long-lived",
        MaintenanceHorizon: "Maintained across the supported Founder lifecycle",
        Risk: new InitiativeClassificationRisk("multi-unit", "partially-reversible", "normal", "high"),
        Dependencies: ["Shared engine protocol"],
        AffectedAssets: ["Visual Studio Product Studio"],
        Owner: "Founder product owner",
        AccountableAuthority: "Founder product owner",
        Confidence: new InitiativeClassificationConfidence("high", "Current strict contract and host evidence"),
        Evidence: [new InitiativeEntrySource("requirement", "P1-02 and P1-03")],
        UnresolvedQuestions: Array.Empty<string>(),
        Rationale: "This Initiative adds a governed product workflow through the shared engine.");

    private static InitiativeApplicabilityMatrixInput InitiativeApplicabilityFixture() => new(
        Decisions:
        [
            new InitiativeApplicabilityDecisionInput(
                Subject: new InitiativeApplicabilitySubject(
                    "test-method",
                    "consumer-contract-testing",
                    "Consumer contract testing"),
                Status: "required",
                Rationale: "The Initiative requires an exact governed entry review before later lifecycle work.",
                Sources: [new InitiativeEntrySource("requirement", "P1-02 and P1-03")],
                Owner: "Founder product owner",
                AccountableApprover: null,
                Dependencies: ["shared-engine"],
                Conditions: Array.Empty<string>(),
                ReviewTriggers: ["Initiative or Product revision changes"],
                Approval: new InitiativeApplicabilityApproval("not-required", Array.Empty<string>()),
                RelatedRecords: Array.Empty<InitiativeRelatedRecord>(),
                RelatedImplementationUnits: ["visual-studio-product-studio"]),
        ],
        UnresolvedSubjects: Array.Empty<InitiativeUnresolvedSubject>(),
        SubjectCatalog: new InitiativeApplicabilitySubjectCatalogBinding(
            SubjectCatalogVersion,
            SubjectCatalogDigest,
            SubjectCatalogCount));

    private static async Task RunFakeHostAsync(string workspace)
    {
        var productReadCount = 0;
        var changeProductContext = Path.GetFileName(workspace) == "product-change";
        var badReadiness = Path.GetFileName(workspace) == "bad-readiness";
        var badSelection = Path.GetFileName(workspace) == "bad-selection";
        var badInitiativePrivate = Path.GetFileName(workspace) == "bad-initiative-private";
        var badInitiativeAssessmentAuthority = Path.GetFileName(workspace) == "bad-initiative-assessment-authority";
        var badInitiativeAssessmentBinding = Path.GetFileName(workspace) == "bad-initiative-assessment-binding";
        var badInitiativeAssessmentPolicy = Path.GetFileName(workspace) == "bad-initiative-assessment-policy";
        var badInitiativeAssessmentCoverage = Path.GetFileName(workspace) == "bad-initiative-assessment-coverage";
        var badInitiativeClassificationBinding = Path.GetFileName(workspace) == "bad-initiative-classification-binding";
        var badInitiativeApplicabilityBinding = Path.GetFileName(workspace) == "bad-initiative-applicability-binding";
        var badSourceSnapshotBinding = Path.GetFileName(workspace) == "bad-source-snapshot-binding";
        var badSourceSnapshotDigest = Path.GetFileName(workspace) == "bad-source-snapshot-digest";
        var badSourceSnapshotPrivate = Path.GetFileName(workspace) == "bad-source-snapshot-private";
        var badBusinessSnapshotBinding = Path.GetFileName(workspace) == "bad-business-snapshot-binding";
        var badBusinessSnapshotDigest = Path.GetFileName(workspace) == "bad-business-snapshot-digest";
        var badBusinessSnapshotPrivate = Path.GetFileName(workspace) == "bad-business-snapshot-private";
        var badCapabilitySnapshotBinding = Path.GetFileName(workspace) == "bad-capability-snapshot-binding";
        var badCapabilitySnapshotDigest = Path.GetFileName(workspace) == "bad-capability-snapshot-digest";
        var badCapabilitySnapshotPrivate = Path.GetFileName(workspace) == "bad-capability-snapshot-private";
        var badValueStreamSnapshotBinding = Path.GetFileName(workspace) == "bad-value-stream-snapshot-binding";
        var badValueStreamSnapshotDigest = Path.GetFileName(workspace) == "bad-value-stream-snapshot-digest";
        var badValueStreamSnapshotPrivate = Path.GetFileName(workspace) == "bad-value-stream-snapshot-private";
        var badOperatingModelSnapshotBinding = Path.GetFileName(workspace) == "bad-operating-model-snapshot-binding";
        var badOperatingModelSnapshotDigest = Path.GetFileName(workspace) == "bad-operating-model-snapshot-digest";
        var badOperatingModelSnapshotPrivate = Path.GetFileName(workspace) == "bad-operating-model-snapshot-private";
        var badBusinessRuleSnapshotBinding = Path.GetFileName(workspace) == "bad-business-rule-snapshot-binding";
        var badBusinessRuleSnapshotDigest = Path.GetFileName(workspace) == "bad-business-rule-snapshot-digest";
        var badBusinessRuleSnapshotPrivate = Path.GetFileName(workspace) == "bad-business-rule-snapshot-private";
        var badBusinessArchitectureBaselineSnapshotBinding =
            Path.GetFileName(workspace) == "bad-business-architecture-baseline-snapshot-binding";
        var badBusinessArchitectureBaselineSnapshotDigest =
            Path.GetFileName(workspace) == "bad-business-architecture-baseline-snapshot-digest";
        var badBusinessArchitectureBaselineSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-business-architecture-baseline-snapshot-private";
        var badSystemSolutionArchitectureSnapshotBinding =
            Path.GetFileName(workspace) == "bad-system-solution-architecture-snapshot-binding";
        var badSystemSolutionArchitectureSnapshotDigest =
            Path.GetFileName(workspace) == "bad-system-solution-architecture-snapshot-digest";
        var badSystemSolutionArchitectureSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-system-solution-architecture-snapshot-private";
        var badBoundedContextSnapshotBinding =
            Path.GetFileName(workspace) == "bad-bounded-context-snapshot-binding";
        var badBoundedContextSnapshotDigest =
            Path.GetFileName(workspace) == "bad-bounded-context-snapshot-digest";
        var badBoundedContextSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-bounded-context-snapshot-private";
        var badSecurityPrivacySnapshotBinding =
            Path.GetFileName(workspace) == "bad-security-privacy-snapshot-binding";
        var badSecurityPrivacySnapshotDigest =
            Path.GetFileName(workspace) == "bad-security-privacy-snapshot-digest";
        var badSecurityPrivacySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-security-privacy-snapshot-private";
        var badProcessModelSnapshotBinding =
            Path.GetFileName(workspace) == "bad-process-model-snapshot-binding";
        var badProcessModelSnapshotDigest =
            Path.GetFileName(workspace) == "bad-process-model-snapshot-digest";
        var badProcessModelSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-process-model-snapshot-private";
        var badDataModelSnapshotBinding =
            Path.GetFileName(workspace) == "bad-data-model-snapshot-binding";
        var badDataModelSnapshotDigest =
            Path.GetFileName(workspace) == "bad-data-model-snapshot-digest";
        var badDataModelSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-data-model-snapshot-private";
        var badAuthorizationModelSnapshotBinding =
            Path.GetFileName(workspace) == "bad-authorization-model-snapshot-binding";
        var badAuthorizationModelSnapshotDigest =
            Path.GetFileName(workspace) == "bad-authorization-model-snapshot-digest";
        var badAuthorizationModelSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-authorization-model-snapshot-private";
        var badEventIntegrationModelSnapshotBinding =
            Path.GetFileName(workspace) == "bad-event-integration-model-snapshot-binding";
        var badEventIntegrationModelSnapshotDigest =
            Path.GetFileName(workspace) == "bad-event-integration-model-snapshot-digest";
        var badEventIntegrationModelSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-event-integration-model-snapshot-private";
        var badFailureRecoveryModelSnapshotBinding =
            Path.GetFileName(workspace) == "bad-failure-recovery-model-snapshot-binding";
        var badFailureRecoveryModelSnapshotDigest =
            Path.GetFileName(workspace) == "bad-failure-recovery-model-snapshot-digest";
        var badFailureRecoveryModelSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-failure-recovery-model-snapshot-private";
        var badArchitectureChallengeSnapshotBinding =
            Path.GetFileName(workspace) == "bad-architecture-challenge-snapshot-binding";
        var badArchitectureChallengeSnapshotDigest =
            Path.GetFileName(workspace) == "bad-architecture-challenge-snapshot-digest";
        var badArchitectureChallengeSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-architecture-challenge-snapshot-private";
        var badDecisionRegisterSnapshotBinding =
            Path.GetFileName(workspace) == "bad-decision-register-snapshot-binding";
        var badDecisionRegisterSnapshotDigest =
            Path.GetFileName(workspace) == "bad-decision-register-snapshot-digest";
        var badDecisionRegisterSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-decision-register-snapshot-private";
        var badRiskRegisterSnapshotBinding =
            Path.GetFileName(workspace) == "bad-risk-register-snapshot-binding";
        var badRiskRegisterSnapshotDigest =
            Path.GetFileName(workspace) == "bad-risk-register-snapshot-digest";
        var badRiskRegisterSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-risk-register-snapshot-private";
        var badEvidenceRegistrySnapshotBinding =
            Path.GetFileName(workspace) == "bad-evidence-registry-snapshot-binding";
        var badEvidenceRegistrySnapshotDigest =
            Path.GetFileName(workspace) == "bad-evidence-registry-snapshot-digest";
        var badEvidenceRegistrySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-evidence-registry-snapshot-private";
        var badTraceabilitySnapshotBinding =
            Path.GetFileName(workspace) == "bad-traceability-snapshot-binding";
        var badTraceabilitySnapshotDigest =
            Path.GetFileName(workspace) == "bad-traceability-snapshot-digest";
        var badTraceabilitySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-traceability-snapshot-private";
        var badReadinessGateSnapshotBinding =
            Path.GetFileName(workspace) == "bad-readiness-gate-snapshot-binding";
        var badReadinessGateSnapshotDigest =
            Path.GetFileName(workspace) == "bad-readiness-gate-snapshot-digest";
        var badReadinessGateSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-readiness-gate-snapshot-private";
        var badP5HandoffSnapshotBinding =
            Path.GetFileName(workspace) == "bad-p5-handoff-snapshot-binding";
        var badP5HandoffSnapshotDigest =
            Path.GetFileName(workspace) == "bad-p5-handoff-snapshot-digest";
        var badP5HandoffSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-p5-handoff-snapshot-private";
        var badDesignApplicabilitySnapshotBinding =
            Path.GetFileName(workspace) == "bad-design-applicability-snapshot-binding";
        var badDesignApplicabilitySnapshotDigest =
            Path.GetFileName(workspace) == "bad-design-applicability-snapshot-digest";
        var badDesignApplicabilitySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-design-applicability-snapshot-private";
        var badDesignPersonaRoleSnapshotBinding =
            Path.GetFileName(workspace) == "bad-design-persona-role-snapshot-binding";
        var badDesignPersonaRoleSnapshotDigest =
            Path.GetFileName(workspace) == "bad-design-persona-role-snapshot-digest";
        var badDesignPersonaRoleSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-design-persona-role-snapshot-private";
        var badUserJourneySnapshotBinding =
            Path.GetFileName(workspace) == "bad-user-journey-snapshot-binding";
        var badUserJourneySnapshotDigest =
            Path.GetFileName(workspace) == "bad-user-journey-snapshot-digest";
        var badUserJourneySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-user-journey-snapshot-private";
        var badInformationArchitectureSnapshotBinding =
            Path.GetFileName(workspace) == "bad-information-architecture-snapshot-binding";
        var badInformationArchitectureSnapshotDigest =
            Path.GetFileName(workspace) == "bad-information-architecture-snapshot-digest";
        var badInformationArchitectureSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-information-architecture-snapshot-private";
        var badScreenStateInventorySnapshotBinding =
            Path.GetFileName(workspace) == "bad-screen-state-inventory-snapshot-binding";
        var badScreenStateInventorySnapshotDigest =
            Path.GetFileName(workspace) == "bad-screen-state-inventory-snapshot-digest";
        var badScreenStateInventorySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-screen-state-inventory-snapshot-private";
        var badDesignRequirementsSnapshotBinding =
            Path.GetFileName(workspace) == "bad-design-requirements-snapshot-binding";
        var badDesignRequirementsSnapshotDigest =
            Path.GetFileName(workspace) == "bad-design-requirements-snapshot-digest";
        var badDesignRequirementsSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-design-requirements-snapshot-private";
        var badBacklogHierarchySnapshotBinding =
            Path.GetFileName(workspace) == "bad-backlog-hierarchy-snapshot-binding";
        var badBacklogHierarchySnapshotDigest =
            Path.GetFileName(workspace) == "bad-backlog-hierarchy-snapshot-digest";
        var badBacklogHierarchySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-backlog-hierarchy-snapshot-private";
        var badMvpSliceSnapshotBinding =
            Path.GetFileName(workspace) == "bad-mvp-slice-snapshot-binding";
        var badMvpSliceSnapshotDigest =
            Path.GetFileName(workspace) == "bad-mvp-slice-snapshot-digest";
        var badMvpSliceSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-mvp-slice-snapshot-private";
        var badMvpSliceHierarchyBinding =
            Path.GetFileName(workspace) == "bad-mvp-slice-hierarchy-binding";
        var badPrioritizationSnapshotBinding =
            Path.GetFileName(workspace) == "bad-prioritization-snapshot-binding";
        var badPrioritizationSnapshotDigest =
            Path.GetFileName(workspace) == "bad-prioritization-snapshot-digest";
        var badPrioritizationSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-prioritization-snapshot-private";
        var badPrioritizationMvpBinding =
            Path.GetFileName(workspace) == "bad-prioritization-mvp-binding";
        var badAcceptanceCriteriaSnapshotBinding =
            Path.GetFileName(workspace) == "bad-acceptance-criteria-snapshot-binding";
        var badAcceptanceCriteriaSnapshotDigest =
            Path.GetFileName(workspace) == "bad-acceptance-criteria-snapshot-digest";
        var badAcceptanceCriteriaSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-acceptance-criteria-snapshot-private";
        var badAcceptanceCriteriaHierarchyBinding =
            Path.GetFileName(workspace) == "bad-acceptance-criteria-hierarchy-binding";
        var badAcceptanceCriteriaMvpBinding =
            Path.GetFileName(workspace) == "bad-acceptance-criteria-mvp-binding";
        var badAcceptanceCriteriaPrioritizationBinding =
            Path.GetFileName(workspace) == "bad-acceptance-criteria-prioritization-binding";
        var badDefinitionOfReadySnapshotBinding =
            Path.GetFileName(workspace) == "bad-definition-of-ready-snapshot-binding";
        var badDefinitionOfReadySnapshotDigest =
            Path.GetFileName(workspace) == "bad-definition-of-ready-snapshot-digest";
        var badDefinitionOfReadySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-definition-of-ready-snapshot-private";
        var badDefinitionOfReadyHierarchyBinding =
            Path.GetFileName(workspace) == "bad-definition-of-ready-hierarchy-binding";
        var badDefinitionOfReadyMvpBinding =
            Path.GetFileName(workspace) == "bad-definition-of-ready-mvp-binding";
        var badDefinitionOfReadyPrioritizationBinding =
            Path.GetFileName(workspace) == "bad-definition-of-ready-prioritization-binding";
        var badDefinitionOfReadyCriteriaBinding =
            Path.GetFileName(workspace) == "bad-definition-of-ready-criteria-binding";
        var badDefinitionOfDoneSnapshotBinding =
            Path.GetFileName(workspace) == "bad-definition-of-done-snapshot-binding";
        var badDefinitionOfDoneSnapshotDigest =
            Path.GetFileName(workspace) == "bad-definition-of-done-snapshot-digest";
        var badDefinitionOfDoneSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-definition-of-done-snapshot-private";
        var badDefinitionOfDoneHierarchyBinding =
            Path.GetFileName(workspace) == "bad-definition-of-done-hierarchy-binding";
        var badDefinitionOfDoneMvpBinding =
            Path.GetFileName(workspace) == "bad-definition-of-done-mvp-binding";
        var badDefinitionOfDonePrioritizationBinding =
            Path.GetFileName(workspace) == "bad-definition-of-done-prioritization-binding";
        var badDefinitionOfDoneCriteriaBinding =
            Path.GetFileName(workspace) == "bad-definition-of-done-criteria-binding";
        var badDefinitionOfDoneReadyBinding =
            Path.GetFileName(workspace) == "bad-definition-of-done-ready-binding";
        var badImplementationUnitModelSnapshotBinding =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-snapshot-binding";
        var badImplementationUnitModelSnapshotDigest =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-snapshot-digest";
        var badImplementationUnitModelSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-snapshot-private";
        var badImplementationUnitModelHierarchyBinding =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-hierarchy-binding";
        var badImplementationUnitModelMvpBinding =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-mvp-binding";
        var badImplementationUnitModelCriteriaBinding =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-criteria-binding";
        var badImplementationUnitModelReadyBinding =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-ready-binding";
        var badImplementationUnitModelDoneBinding =
            Path.GetFileName(workspace) == "bad-implementation-unit-model-done-binding";
        var badDependencyMappingSnapshotBinding =
            Path.GetFileName(workspace) == "bad-dependency-mapping-snapshot-binding";
        var badDependencyMappingSnapshotDigest =
            Path.GetFileName(workspace) == "bad-dependency-mapping-snapshot-digest";
        var badDependencyMappingSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-dependency-mapping-snapshot-private";
        var badDependencyMappingHierarchyBinding =
            Path.GetFileName(workspace) == "bad-dependency-mapping-hierarchy-binding";
        var badDependencyMappingMvpBinding =
            Path.GetFileName(workspace) == "bad-dependency-mapping-mvp-binding";
        var badDependencyMappingUnitModelBinding =
            Path.GetFileName(workspace) == "bad-dependency-mapping-unit-model-binding";
        var badTechnologyProfileSnapshotBinding =
            Path.GetFileName(workspace) == "bad-technology-profile-snapshot-binding";
        var badTechnologyProfileSnapshotDigest =
            Path.GetFileName(workspace) == "bad-technology-profile-snapshot-digest";
        var badTechnologyProfileSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-technology-profile-snapshot-private";
        var badTechnologyProfileUnitModelBinding =
            Path.GetFileName(workspace) == "bad-technology-profile-unit-model-binding";
        var badTechnologyProfileDependencyMappingBinding =
            Path.GetFileName(workspace) == "bad-technology-profile-dependency-mapping-binding";
        var badBoilerplateRegistrySnapshotBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-registry-snapshot-binding";
        var badBoilerplateRegistrySnapshotDigest =
            Path.GetFileName(workspace) == "bad-boilerplate-registry-snapshot-digest";
        var badBoilerplateRegistrySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-boilerplate-registry-snapshot-private";
        var badBoilerplateRegistryUnitModelBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-registry-unit-model-binding";
        var badBoilerplateRegistryTechnologyProfileBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-registry-technology-profile-binding";
        var badBoilerplateSelectionBindingSnapshotBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-snapshot-binding";
        var badBoilerplateSelectionBindingSnapshotDigest =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-snapshot-digest";
        var badBoilerplateSelectionBindingSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-snapshot-private";
        var badBoilerplateSelectionBindingUnitModelBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-unit-model-binding";
        var badBoilerplateSelectionBindingDependencyMappingBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-dependency-mapping-binding";
        var badBoilerplateSelectionBindingTechnologyProfileBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-technology-profile-binding";
        var badBoilerplateSelectionBindingRegistryBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-selection-binding-registry-binding";
        var badBoilerplateCompatibilityValidationSnapshotBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-snapshot-binding";
        var badBoilerplateCompatibilityValidationSnapshotDigest =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-snapshot-digest";
        var badBoilerplateCompatibilityValidationSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-snapshot-private";
        var badBoilerplateCompatibilityValidationUnitModelBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-unit-model-binding";
        var badBoilerplateCompatibilityValidationDependencyMappingBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-dependency-mapping-binding";
        var badBoilerplateCompatibilityValidationTechnologyProfileBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-technology-profile-binding";
        var badBoilerplateCompatibilityValidationRegistryBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-registry-binding";
        var badBoilerplateCompatibilityValidationSelectionBinding =
            Path.GetFileName(workspace) == "bad-boilerplate-compatibility-validation-selection-binding";
        var badDesignSystemTokenContractSnapshotBinding =
            Path.GetFileName(workspace) == "bad-design-system-token-contract-snapshot-binding";
        var badDesignSystemTokenContractSnapshotDigest =
            Path.GetFileName(workspace) == "bad-design-system-token-contract-snapshot-digest";
        var badDesignSystemTokenContractSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-design-system-token-contract-snapshot-private";
        var badAccessibilityDesignRulesSnapshotBinding =
            Path.GetFileName(workspace) == "bad-accessibility-design-rules-snapshot-binding";
        var badAccessibilityDesignRulesSnapshotDigest =
            Path.GetFileName(workspace) == "bad-accessibility-design-rules-snapshot-digest";
        var badAccessibilityDesignRulesSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-accessibility-design-rules-snapshot-private";
        var badResponsiveMultiPlatformTargetsSnapshotBinding =
            Path.GetFileName(workspace) == "bad-responsive-multi-platform-targets-snapshot-binding";
        var badResponsiveMultiPlatformTargetsSnapshotDigest =
            Path.GetFileName(workspace) == "bad-responsive-multi-platform-targets-snapshot-digest";
        var badResponsiveMultiPlatformTargetsSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-responsive-multi-platform-targets-snapshot-private";
        var badManualFigmaExecutionPathSnapshotBinding =
            Path.GetFileName(workspace) == "bad-manual-figma-execution-path-snapshot-binding";
        var badManualFigmaExecutionPathSnapshotDigest =
            Path.GetFileName(workspace) == "bad-manual-figma-execution-path-snapshot-digest";
        var badManualFigmaExecutionPathSnapshotPrivate =
            Path.GetFileName(workspace) == "bad-manual-figma-execution-path-snapshot-private";
        var badFigmaMcpCapabilityDiscoverySnapshotBinding =
            Path.GetFileName(workspace) == "bad-figma-mcp-capability-discovery-snapshot-binding";
        var badFigmaMcpCapabilityDiscoverySnapshotDigest =
            Path.GetFileName(workspace) == "bad-figma-mcp-capability-discovery-snapshot-digest";
        var badFigmaMcpCapabilityDiscoverySnapshotPrivate =
            Path.GetFileName(workspace) == "bad-figma-mcp-capability-discovery-snapshot-private";
        var badFigmaReadSnapshotBinding = Path.GetFileName(workspace) == "bad-figma-read-snapshot-binding";
        var badFigmaReadSnapshotDigest = Path.GetFileName(workspace) == "bad-figma-read-snapshot-digest";
        var badFigmaReadSnapshotPrivate = Path.GetFileName(workspace) == "bad-figma-read-snapshot-private";
        var badFigmaContextImportBinding = Path.GetFileName(workspace) == "bad-figma-context-import-binding";
        var badFigmaContextImportDigest = Path.GetFileName(workspace) == "bad-figma-context-import-digest";
        var badFigmaContextImportPrivate = Path.GetFileName(workspace) == "bad-figma-context-import-private";
        var badOutboundDesignBriefPackageBinding = Path.GetFileName(workspace) == "bad-outbound-design-brief-package-binding";
        var badOutboundDesignBriefPackageDigest = Path.GetFileName(workspace) == "bad-outbound-design-brief-package-digest";
        var badOutboundDesignBriefPackagePrivate = Path.GetFileName(workspace) == "bad-outbound-design-brief-package-private";
        var badGovernedFigmaWriteBinding = Path.GetFileName(workspace) == "bad-governed-figma-write-binding";
        var badGovernedFigmaWriteDigest = Path.GetFileName(workspace) == "bad-governed-figma-write-digest";
        var badGovernedFigmaWritePrivate = Path.GetFileName(workspace) == "bad-governed-figma-write-private";
        var badFinalizedFigmaSnapshotImportBinding = Path.GetFileName(workspace) == "bad-finalized-figma-snapshot-import-binding";
        var badFinalizedFigmaSnapshotImportDigest = Path.GetFileName(workspace) == "bad-finalized-figma-snapshot-import-digest";
        var badFinalizedFigmaSnapshotImportPrivate = Path.GetFileName(workspace) == "bad-finalized-figma-snapshot-import-private";
        var badDesignToRequirementBindingBinding = Path.GetFileName(workspace) == "bad-design-to-requirement-binding-binding";
        var badDesignToRequirementBindingDigest = Path.GetFileName(workspace) == "bad-design-to-requirement-binding-digest";
        var badDesignToRequirementBindingPrivate = Path.GetFileName(workspace) == "bad-design-to-requirement-binding-private";
        var badDesignerReadyGateBinding = Path.GetFileName(workspace) == "bad-designer-ready-gate-binding";
        var badDesignerReadyGateDigest = Path.GetFileName(workspace) == "bad-designer-ready-gate-digest";
        var badDesignerReadyGatePrivate = Path.GetFileName(workspace) == "bad-designer-ready-gate-private";
        var badDesignDeltaBinding = Path.GetFileName(workspace) == "bad-design-delta-binding";
        var badDesignDeltaDigest = Path.GetFileName(workspace) == "bad-design-delta-digest";
        var badDesignDeltaPrivate = Path.GetFileName(workspace) == "bad-design-delta-private";
        var badDesignConflictResolutionBinding = Path.GetFileName(workspace) == "bad-design-conflict-resolution-binding";
        var badDesignConflictResolutionDigest = Path.GetFileName(workspace) == "bad-design-conflict-resolution-digest";
        var badDesignConflictResolutionPrivate = Path.GetFileName(workspace) == "bad-design-conflict-resolution-private";
        var badHumanDesignApprovalBinding = Path.GetFileName(workspace) == "bad-human-design-approval-binding";
        var badHumanDesignApprovalDigest = Path.GetFileName(workspace) == "bad-human-design-approval-digest";
        var badHumanDesignApprovalPrivate = Path.GetFileName(workspace) == "bad-human-design-approval-private";
        var badDesignBaselineBinding = Path.GetFileName(workspace) == "bad-design-baseline-binding";
        var badDesignBaselineDigest = Path.GetFileName(workspace) == "bad-design-baseline-digest";
        var badDesignBaselinePrivate = Path.GetFileName(workspace) == "bad-design-baseline-private";
        var badDesignDriftBinding = Path.GetFileName(workspace) == "bad-design-drift-binding";
        var badDesignDriftDigest = Path.GetFileName(workspace) == "bad-design-drift-digest";
        var badDesignDriftPrivate = Path.GetFileName(workspace) == "bad-design-drift-private";
        var badRuns = Path.GetFileName(workspace) == "bad-runs";
        var badHandoff = Path.GetFileName(workspace) == "bad-handoff";
        var badHandoffBinding = Path.GetFileName(workspace) == "bad-handoff-binding";
        var badDashboardBinding = Path.GetFileName(workspace) == "bad-dashboard-binding";
        var badDashboardApplicability = Path.GetFileName(workspace) == "bad-dashboard-applicability";
        var badDashboardEvidenceCues = Path.GetFileName(workspace) == "bad-dashboard-evidence-cues";
        var badDashboardDigest = Path.GetFileName(workspace) == "bad-dashboard-digest";
        var badDashboardPrivate = Path.GetFileName(workspace) == "bad-dashboard-private";
        var badPhase2DashboardDigest = Path.GetFileName(workspace) == "bad-phase2-dashboard-digest";
        var badPhase2DashboardPrivate = Path.GetFileName(workspace) == "bad-phase2-dashboard-private";
        var badPhase2DashboardCatalog = Path.GetFileName(workspace) == "bad-phase2-dashboard-catalog";
        var badPhase2IntegratedBinding = Path.GetFileName(workspace) == "bad-phase2-integrated-binding";
        var badPhase2IntegratedDigest = Path.GetFileName(workspace) == "bad-phase2-integrated-digest";
        var badPhase2IntegratedPrivate = Path.GetFileName(workspace) == "bad-phase2-integrated-private";
        var badChangeCatalogBinding = Path.GetFileName(workspace) == "bad-change-catalog-binding";
        var badChangeCatalogDigest = Path.GetFileName(workspace) == "bad-change-catalog-digest";
        var badChangeCatalogPrivate = Path.GetFileName(workspace) == "bad-change-catalog-private";
        var badChangeImpactBinding = Path.GetFileName(workspace) == "bad-change-impact-binding";
        var badChangeImpactCount = Path.GetFileName(workspace) == "bad-change-impact-count";
        var badChangeImpactFreshness = Path.GetFileName(workspace) == "bad-change-impact-freshness";
        var badChangeImpactEvidenceCues = Path.GetFileName(workspace) == "bad-change-impact-evidence-cues";
        var badChangeImpactDigest = Path.GetFileName(workspace) == "bad-change-impact-digest";
        var badChangeImpactPrivate = Path.GetFileName(workspace) == "bad-change-impact-private";
        var badAgentModelBinding = Path.GetFileName(workspace) == "bad-agent-model-binding";
        var badAgentModelCount = Path.GetFileName(workspace) == "bad-agent-model-count";
        var badAgentModelFreshness = Path.GetFileName(workspace) == "bad-agent-model-freshness";
        var badAgentModelMetrics = Path.GetFileName(workspace) == "bad-agent-model-metrics";
        var badAgentModelEvidenceCues = Path.GetFileName(workspace) == "bad-agent-model-evidence-cues";
        var badAgentModelDigest = Path.GetFileName(workspace) == "bad-agent-model-digest";
        var badAgentModelPrivate = Path.GetFileName(workspace) == "bad-agent-model-private";
        var badPhase1AgentModelCount = Path.GetFileName(workspace) == "bad-phase1-agent-model-count";
        var badPhase1AgentModelDigest = Path.GetFileName(workspace) == "bad-phase1-agent-model-digest";
        var badPhase1AgentModelPrivate = Path.GetFileName(workspace) == "bad-phase1-agent-model-private";
        var badManagedPreview = Path.GetFileName(workspace) == "bad-managed-preview";
        var badManagedCriterion = Path.GetFileName(workspace) == "bad-managed-criterion";
        var badManagedDigest = Path.GetFileName(workspace) == "bad-managed-digest";
        var badManagedReceipt = Path.GetFileName(workspace) == "bad-managed-receipt";
        var badManagedBinding = Path.GetFileName(workspace) == "bad-managed-binding";
        var badManagedEvidencePage = Path.GetFileName(workspace) == "bad-managed-evidence-page";
        var badManagedEvidenceCount = Path.GetFileName(workspace) == "bad-managed-evidence-count";
        var badManagedEvidenceSnapshot = Path.GetFileName(workspace) == "bad-managed-evidence-snapshot";
        var badManagedEvidenceTotal = Path.GetFileName(workspace) == "bad-managed-evidence-total";
        var badManagedEvidenceDetail = Path.GetFileName(workspace) == "bad-managed-evidence-detail";
        var badManagedEvidenceBinding = Path.GetFileName(workspace) == "bad-managed-evidence-binding";
        var badManagedEvidenceApplyBinding = Path.GetFileName(workspace) == "bad-managed-evidence-apply-binding";
        var badManagedReviewDigest = Path.GetFileName(workspace) == "bad-managed-review-digest";
        var badManagedReviewPrivate = Path.GetFileName(workspace) == "bad-managed-review-private";
        var badManagedReviewBinding = Path.GetFileName(workspace) == "bad-managed-review-binding";
        var badManagedReviewPath = Path.GetFileName(workspace) == "bad-managed-review-path";
        var badManagedReviewMetadata = Path.GetFileName(workspace) == "bad-managed-review-metadata";
        var badManagedTransitionDigest = Path.GetFileName(workspace) == "bad-managed-transition-digest";
        var badManagedTransitionPrivate = Path.GetFileName(workspace) == "bad-managed-transition-private";
        var staleManagedReview = Path.GetFileName(workspace) == "stale-managed-review";
        Dictionary<string, object?>? selectedAgent = null;
        Dictionary<string, object?>? initiativeClassification = null;
        Dictionary<string, object?>? initiativeApplicability = null;
        var initiativeRevision = 3L;
        while (await Console.In.ReadLineAsync() is { } line)
        {
            using var request = JsonDocument.Parse(line);
            var root = request.RootElement;
            var id = root.GetProperty("id").GetInt64();
            var method = root.GetProperty("method").GetString();
            var isPathFreeRead = method is "readProduct" or "probeAgents";
            var validEnvelope = isPathFreeRead
                ? HasOnlyProperties(root, "jsonrpc", "id", "method", "params")
                : HasOnlyProperties(root, "jsonrpc", "id", "method", "params", "protocolVersion") &&
                  root.GetProperty("protocolVersion").GetInt32() == 2;
            if (!validEnvelope || root.GetProperty("jsonrpc").GetString() != "2.0")
            {
                await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ENVELOPE");
                continue;
            }
            var parameters = root.GetProperty("params");
            switch (method)
            {
                case "readProduct":
                    productReadCount++;
                    await HandleReadProductAsync(
                        id,
                        parameters,
                        changeProductContext && productReadCount > 1 ? 8 : 7);
                    break;
                case "probeAgents":
                    await HandleProbeAgentsAsync(id, parameters, badReadiness);
                    break;
                case "readInitiative":
                    await HandleReadInitiativeAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badInitiativePrivate);
                    break;
                case "assessInitiativeEntry":
                    await HandleAssessInitiativeEntryAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badInitiativeAssessmentAuthority,
                        badInitiativeAssessmentBinding,
                        badInitiativeAssessmentPolicy,
                        badInitiativeAssessmentCoverage);
                    break;
                case "classifyInitiative":
                    initiativeClassification = await HandleClassifyInitiativeAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        badInitiativeClassificationBinding);
                    if (initiativeClassification is not null)
                    {
                        initiativeRevision++;
                        initiativeApplicability = null;
                    }
                    break;
                case "resolveInitiativeApplicability":
                    initiativeApplicability = await HandleResolveInitiativeApplicabilityAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        badInitiativeApplicabilityBinding);
                    if (initiativeApplicability is not null) initiativeRevision++;
                    break;
                case "source.snapshot":
                    await HandleSourceGovernanceAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badSourceSnapshotBinding,
                        badSourceSnapshotDigest,
                        badSourceSnapshotPrivate);
                    break;
                case "business.snapshot":
                    await HandleBusinessUnderstandingAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBusinessSnapshotBinding,
                        badBusinessSnapshotDigest,
                        badBusinessSnapshotPrivate);
                    break;
                case "business.capabilities.snapshot":
                    await HandleBusinessCapabilityMapAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badCapabilitySnapshotBinding,
                        badCapabilitySnapshotDigest,
                        badCapabilitySnapshotPrivate);
                    break;
                case "business.valueStreams.snapshot":
                    await HandleValueStreamModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badValueStreamSnapshotBinding,
                        badValueStreamSnapshotDigest,
                        badValueStreamSnapshotPrivate);
                    break;
                case "business.operatingModels.snapshot":
                    await HandleOperatingModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badOperatingModelSnapshotBinding,
                        badOperatingModelSnapshotDigest,
                        badOperatingModelSnapshotPrivate);
                    break;
                case "business.businessRules.snapshot":
                    await HandleBusinessRuleCatalogAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBusinessRuleSnapshotBinding,
                        badBusinessRuleSnapshotDigest,
                        badBusinessRuleSnapshotPrivate);
                    break;
                case "business.architectureBaselines.snapshot":
                    await HandleBusinessArchitectureBaselineAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBusinessArchitectureBaselineSnapshotBinding,
                        badBusinessArchitectureBaselineSnapshotDigest,
                        badBusinessArchitectureBaselineSnapshotPrivate);
                    break;
                case "architecture.systemSolution.snapshot":
                    await HandleSystemSolutionArchitectureAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badSystemSolutionArchitectureSnapshotBinding,
                        badSystemSolutionArchitectureSnapshotDigest,
                        badSystemSolutionArchitectureSnapshotPrivate);
                    break;
                case "architecture.boundedContexts.snapshot":
                    await HandleBoundedContextModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBoundedContextSnapshotBinding,
                        badBoundedContextSnapshotDigest,
                        badBoundedContextSnapshotPrivate);
                    break;
                case "security.privacyThreat.snapshot":
                    await HandleSecurityPrivacyAssessmentAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badSecurityPrivacySnapshotBinding,
                        badSecurityPrivacySnapshotDigest,
                        badSecurityPrivacySnapshotPrivate);
                    break;
                case "process.models.snapshot":
                    await HandleProcessModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badProcessModelSnapshotBinding,
                        badProcessModelSnapshotDigest,
                        badProcessModelSnapshotPrivate);
                    break;
                case "data.models.snapshot":
                    await HandleDataModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDataModelSnapshotBinding,
                        badDataModelSnapshotDigest,
                        badDataModelSnapshotPrivate);
                    break;
                case "authorization.models.snapshot":
                    await HandleAuthorizationModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badAuthorizationModelSnapshotBinding,
                        badAuthorizationModelSnapshotDigest,
                        badAuthorizationModelSnapshotPrivate);
                    break;
                case "integration.models.snapshot":
                    await HandleEventIntegrationModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badEventIntegrationModelSnapshotBinding,
                        badEventIntegrationModelSnapshotDigest,
                        badEventIntegrationModelSnapshotPrivate);
                    break;
                case "recovery.models.snapshot":
                    await HandleFailureRecoveryModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badFailureRecoveryModelSnapshotBinding,
                        badFailureRecoveryModelSnapshotDigest,
                        badFailureRecoveryModelSnapshotPrivate);
                    break;
                case "challenge.models.snapshot":
                    await HandleArchitectureChallengeModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badArchitectureChallengeSnapshotBinding,
                        badArchitectureChallengeSnapshotDigest,
                        badArchitectureChallengeSnapshotPrivate);
                    break;
                case "decision.registers.snapshot":
                    await HandleDecisionRegisterAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDecisionRegisterSnapshotBinding,
                        badDecisionRegisterSnapshotDigest,
                        badDecisionRegisterSnapshotPrivate);
                    break;
                case "risk.registers.snapshot":
                    await HandleRiskRegisterAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badRiskRegisterSnapshotBinding,
                        badRiskRegisterSnapshotDigest,
                        badRiskRegisterSnapshotPrivate);
                    break;
                case "evidence.registries.snapshot":
                    await HandleEvidenceRegistryAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badEvidenceRegistrySnapshotBinding,
                        badEvidenceRegistrySnapshotDigest,
                        badEvidenceRegistrySnapshotPrivate);
                    break;
                case "traceability.graphs.snapshot":
                    await HandleEndToEndTraceabilityAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badTraceabilitySnapshotBinding,
                        badTraceabilitySnapshotDigest,
                        badTraceabilitySnapshotPrivate);
                    break;
                case "readiness.gates.snapshot":
                    await HandleP0P4ReadinessGateAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badReadinessGateSnapshotBinding,
                        badReadinessGateSnapshotDigest,
                        badReadinessGateSnapshotPrivate);
                    break;
                case "handoff.p5.snapshot":
                    await HandleP5HandoffPackageAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badP5HandoffSnapshotBinding,
                        badP5HandoffSnapshotDigest,
                        badP5HandoffSnapshotPrivate);
                    break;
                case "design.applicability.snapshot":
                    await HandleDesignApplicabilityAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignApplicabilitySnapshotBinding,
                        badDesignApplicabilitySnapshotDigest,
                        badDesignApplicabilitySnapshotPrivate);
                    break;
                case "design.personas.roles.snapshot":
                    await HandleDesignPersonaRoleAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignPersonaRoleSnapshotBinding,
                        badDesignPersonaRoleSnapshotDigest,
                        badDesignPersonaRoleSnapshotPrivate);
                    break;
                case "design.journeys.snapshot":
                    await HandleUserJourneyAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badUserJourneySnapshotBinding,
                        badUserJourneySnapshotDigest,
                        badUserJourneySnapshotPrivate);
                    break;
                case "design.informationArchitecture.snapshot":
                    await HandleInformationArchitectureAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badInformationArchitectureSnapshotBinding,
                        badInformationArchitectureSnapshotDigest,
                        badInformationArchitectureSnapshotPrivate);
                    break;
                case "design.screenStateInventory.snapshot":
                    await HandleScreenStateInventoryAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badScreenStateInventorySnapshotBinding,
                        badScreenStateInventorySnapshotDigest,
                        badScreenStateInventorySnapshotPrivate);
                    break;
                case "design.requirements.snapshot":
                    await HandleDesignRequirementsAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignRequirementsSnapshotBinding,
                        badDesignRequirementsSnapshotDigest,
                        badDesignRequirementsSnapshotPrivate);
                    break;
                case "backlog.hierarchy.snapshot":
                    await HandleBacklogHierarchyAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBacklogHierarchySnapshotBinding,
                        badBacklogHierarchySnapshotDigest,
                        badBacklogHierarchySnapshotPrivate);
                    break;
                case "planning.mvpSlices.snapshot":
                    await HandleMvpSliceDefinitionAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badMvpSliceSnapshotBinding,
                        badMvpSliceSnapshotDigest,
                        badMvpSliceSnapshotPrivate,
                        badMvpSliceHierarchyBinding);
                    break;
                case "planning.prioritization.snapshot":
                    await HandlePrioritizationModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badPrioritizationSnapshotBinding,
                        badPrioritizationSnapshotDigest,
                        badPrioritizationSnapshotPrivate,
                        badPrioritizationMvpBinding);
                    break;
                case "planning.acceptanceCriteria.snapshot":
                    await HandleAcceptanceCriteriaAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badAcceptanceCriteriaSnapshotBinding,
                        badAcceptanceCriteriaSnapshotDigest,
                        badAcceptanceCriteriaSnapshotPrivate,
                        badAcceptanceCriteriaHierarchyBinding,
                        badAcceptanceCriteriaMvpBinding,
                        badAcceptanceCriteriaPrioritizationBinding);
                    break;
                case "planning.definitionOfReady.snapshot":
                    await HandleDefinitionOfReadyAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDefinitionOfReadySnapshotBinding,
                        badDefinitionOfReadySnapshotDigest,
                        badDefinitionOfReadySnapshotPrivate,
                        badDefinitionOfReadyHierarchyBinding,
                        badDefinitionOfReadyMvpBinding,
                        badDefinitionOfReadyPrioritizationBinding,
                        badDefinitionOfReadyCriteriaBinding);
                    break;
                case "planning.definitionOfDone.snapshot":
                    await HandleDefinitionOfDoneAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDefinitionOfDoneSnapshotBinding,
                        badDefinitionOfDoneSnapshotDigest,
                        badDefinitionOfDoneSnapshotPrivate,
                        badDefinitionOfDoneHierarchyBinding,
                        badDefinitionOfDoneMvpBinding,
                        badDefinitionOfDonePrioritizationBinding,
                        badDefinitionOfDoneCriteriaBinding,
                        badDefinitionOfDoneReadyBinding);
                    break;
                case "planning.implementationUnits.snapshot":
                    await HandleImplementationUnitModelAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badImplementationUnitModelSnapshotBinding,
                        badImplementationUnitModelSnapshotDigest,
                        badImplementationUnitModelSnapshotPrivate,
                        badImplementationUnitModelHierarchyBinding,
                        badImplementationUnitModelMvpBinding,
                        badImplementationUnitModelCriteriaBinding,
                        badImplementationUnitModelReadyBinding,
                        badImplementationUnitModelDoneBinding);
                    break;
                case "planning.dependencyMapping.snapshot":
                    await HandleDependencyMappingAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDependencyMappingSnapshotBinding,
                        badDependencyMappingSnapshotDigest,
                        badDependencyMappingSnapshotPrivate,
                        badDependencyMappingHierarchyBinding,
                        badDependencyMappingMvpBinding,
                        badDependencyMappingUnitModelBinding);
                    break;
                case "planning.technologyProfile.snapshot":
                    await HandleTechnologyProfileAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badTechnologyProfileSnapshotBinding,
                        badTechnologyProfileSnapshotDigest,
                        badTechnologyProfileSnapshotPrivate,
                        badTechnologyProfileUnitModelBinding,
                        badTechnologyProfileDependencyMappingBinding);
                    break;
                case "planning.boilerplateRegistry.snapshot":
                    await HandleBoilerplateRegistryAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBoilerplateRegistrySnapshotBinding,
                        badBoilerplateRegistrySnapshotDigest,
                        badBoilerplateRegistrySnapshotPrivate,
                        badBoilerplateRegistryUnitModelBinding,
                        badBoilerplateRegistryTechnologyProfileBinding);
                    break;
                case "planning.boilerplateSelectionBinding.snapshot":
                    await HandleBoilerplateSelectionBindingAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBoilerplateSelectionBindingSnapshotBinding,
                        badBoilerplateSelectionBindingSnapshotDigest,
                        badBoilerplateSelectionBindingSnapshotPrivate,
                        badBoilerplateSelectionBindingUnitModelBinding,
                        badBoilerplateSelectionBindingDependencyMappingBinding,
                        badBoilerplateSelectionBindingTechnologyProfileBinding,
                        badBoilerplateSelectionBindingRegistryBinding);
                    break;
                case "planning.boilerplateCompatibilityValidation.snapshot":
                    await HandleBoilerplateCompatibilityValidationAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badBoilerplateCompatibilityValidationSnapshotBinding,
                        badBoilerplateCompatibilityValidationSnapshotDigest,
                        badBoilerplateCompatibilityValidationSnapshotPrivate,
                        badBoilerplateCompatibilityValidationUnitModelBinding,
                        badBoilerplateCompatibilityValidationDependencyMappingBinding,
                        badBoilerplateCompatibilityValidationTechnologyProfileBinding,
                        badBoilerplateCompatibilityValidationRegistryBinding,
                        badBoilerplateCompatibilityValidationSelectionBinding);
                    break;
                case "design.systemTokenContract.snapshot":
                    await HandleDesignSystemTokenContractAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignSystemTokenContractSnapshotBinding,
                        badDesignSystemTokenContractSnapshotDigest,
                        badDesignSystemTokenContractSnapshotPrivate);
                    break;
                case "design.accessibilityRules.snapshot":
                    await HandleAccessibilityDesignRulesAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badAccessibilityDesignRulesSnapshotBinding,
                        badAccessibilityDesignRulesSnapshotDigest,
                        badAccessibilityDesignRulesSnapshotPrivate);
                    break;
                case "design.responsiveMultiPlatformTargets.snapshot":
                    await HandleResponsiveMultiPlatformTargetsAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badResponsiveMultiPlatformTargetsSnapshotBinding,
                        badResponsiveMultiPlatformTargetsSnapshotDigest,
                        badResponsiveMultiPlatformTargetsSnapshotPrivate);
                    break;
                case "design.manualFigmaExecutionPath.snapshot":
                    await HandleManualFigmaExecutionPathAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badManualFigmaExecutionPathSnapshotBinding,
                        badManualFigmaExecutionPathSnapshotDigest,
                        badManualFigmaExecutionPathSnapshotPrivate);
                    break;
                case "design.figmaMcpCapabilityDiscovery.snapshot":
                    await HandleFigmaMcpCapabilityDiscoveryAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badFigmaMcpCapabilityDiscoverySnapshotBinding,
                        badFigmaMcpCapabilityDiscoverySnapshotDigest,
                        badFigmaMcpCapabilityDiscoverySnapshotPrivate);
                    break;
                case "design.figmaReadSnapshot.snapshot":
                    await HandleFigmaReadSnapshotAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badFigmaReadSnapshotBinding,
                        badFigmaReadSnapshotDigest,
                        badFigmaReadSnapshotPrivate);
                    break;
                case "design.figmaContextImport.snapshot":
                    await HandleFigmaContextImportAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badFigmaContextImportBinding,
                        badFigmaContextImportDigest,
                        badFigmaContextImportPrivate);
                    break;
                case "design.outboundDesignBriefPackage.snapshot":
                    await HandleOutboundDesignBriefPackageAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badOutboundDesignBriefPackageBinding,
                        badOutboundDesignBriefPackageDigest,
                        badOutboundDesignBriefPackagePrivate);
                    break;
                case "design.governedFigmaWrite.snapshot":
                    await HandleGovernedFigmaWriteAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badGovernedFigmaWriteBinding,
                        badGovernedFigmaWriteDigest,
                        badGovernedFigmaWritePrivate);
                    break;
                case "design.finalizedFigmaSnapshotImport.snapshot":
                    await HandleFinalizedFigmaSnapshotImportAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badFinalizedFigmaSnapshotImportBinding,
                        badFinalizedFigmaSnapshotImportDigest,
                        badFinalizedFigmaSnapshotImportPrivate);
                    break;
                case "design.designToRequirementBinding.snapshot":
                    await HandleDesignToRequirementBindingAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignToRequirementBindingBinding,
                        badDesignToRequirementBindingDigest,
                        badDesignToRequirementBindingPrivate);
                    break;
                case "design.designerReadyGate.snapshot":
                    await HandleDesignerReadyGateAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignerReadyGateBinding,
                        badDesignerReadyGateDigest,
                        badDesignerReadyGatePrivate);
                    break;
                case "design.designDelta.snapshot":
                    await HandleDesignDeltaAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignDeltaBinding,
                        badDesignDeltaDigest,
                        badDesignDeltaPrivate);
                    break;
                case "design.designConflictResolution.snapshot":
                    await HandleDesignConflictResolutionAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignConflictResolutionBinding,
                        badDesignConflictResolutionDigest,
                        badDesignConflictResolutionPrivate);
                    break;
                case "design.humanDesignApproval.snapshot":
                    await HandleHumanDesignApprovalAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badHumanDesignApprovalBinding,
                        badHumanDesignApprovalDigest,
                        badHumanDesignApprovalPrivate);
                    break;
                case "design.designBaseline.snapshot":
                    await HandleDesignBaselineAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignBaselineBinding,
                        badDesignBaselineDigest,
                        badDesignBaselinePrivate);
                    break;
                case "design.designDriftDetection.snapshot":
                    await HandleDesignDriftDetectionAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badDesignDriftBinding,
                        badDesignDriftDigest,
                        badDesignDriftPrivate);
                    break;
                case "dashboard.framework":
                    await HandlePhaseDashboardAsync(
                        id,
                        parameters,
                        badDashboardBinding,
                        badDashboardApplicability,
                        badDashboardEvidenceCues,
                        badDashboardDigest,
                        badDashboardPrivate);
                    break;
                case "dashboard.phase2UxFigma":
                    await HandlePhase2UxFigmaDashboardAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badPhase2DashboardCatalog,
                        badPhase2DashboardDigest,
                        badPhase2DashboardPrivate);
                    break;
                case "dashboard.phase2ChangeImpactAgentModel":
                    await HandlePhase2ChangeImpactAgentModelDashboardAsync(
                        id,
                        parameters,
                        selectedAgent,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badPhase2IntegratedBinding,
                        badPhase2IntegratedDigest,
                        badPhase2IntegratedPrivate);
                    break;
                case "dashboard.phase1Summary":
                    await HandlePhase1SummaryAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability);
                    break;
                case "dashboard.phase1ChangeImpact":
                    await HandlePhase1ChangeImpactAsync(
                        id,
                        parameters,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability);
                    break;
                case "dashboard.changeImpact.changes":
                    await HandleChangeImpactCatalogAsync(
                        id,
                        parameters,
                        badChangeCatalogBinding,
                        badChangeCatalogDigest,
                        badChangeCatalogPrivate);
                    break;
                case "dashboard.changeImpact":
                    await HandleChangeImpactAsync(
                        id,
                        parameters,
                        badChangeImpactBinding,
                        badChangeImpactCount,
                        badChangeImpactFreshness,
                        badChangeImpactEvidenceCues,
                        badChangeImpactDigest,
                        badChangeImpactPrivate);
                    break;
                case "dashboard.agentModel":
                    await HandleAgentModelAsync(
                        id,
                        parameters,
                        selectedAgent,
                        badAgentModelBinding,
                        badAgentModelCount,
                        badAgentModelFreshness,
                        badAgentModelMetrics,
                        badAgentModelEvidenceCues,
                        badAgentModelDigest,
                        badAgentModelPrivate);
                    break;
                case "dashboard.phase1AgentModel":
                    await HandlePhase1AgentModelAsync(
                        id,
                        parameters,
                        selectedAgent,
                        initiativeRevision,
                        initiativeClassification,
                        initiativeApplicability,
                        badPhase1AgentModelCount,
                        badPhase1AgentModelDigest,
                        badPhase1AgentModelPrivate);
                    break;
                case "readAgentSelection":
                    if (!HasOnlyProperties(parameters))
                    {
                        await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SELECTION READ");
                    }
                    else if (badSelection)
                    {
                        var hostile = AgentSelection();
                        hostile["runtimeExecutable"] = $"{PrivateRoot}/{PrivateCredential}";
                        await WriteResultAsync(id, new Dictionary<string, object?>
                        {
                            ["status"] = "selected",
                            ["selection"] = hostile,
                        });
                    }
                    else
                    {
                        await WriteResultAsync(id, selectedAgent is null
                            ? new Dictionary<string, object?> { ["status"] = "unselected" }
                            : new Dictionary<string, object?>
                            {
                                ["status"] = "selected",
                                ["selection"] = selectedAgent,
                            });
                    }
                    break;
                case "selectAgent":
                    selectedAgent = await HandleSelectAgentAsync(id, parameters);
                    break;
                case "listRuns":
                    if (!HasOnlyProperties(parameters))
                    {
                        await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID RUN LIST");
                    }
                    else
                    {
                        await WriteResultAsync(id, new[] { AgentRun(badRuns) });
                    }
                    break;
                case "createHandoff":
                    selectedAgent = await HandleCreateHandoffAsync(
                        id,
                        parameters,
                        badHandoff,
                        badHandoffBinding);
                    break;
                case "managed.readonly.preview":
                    await HandleManagedReadOnlyPreviewAsync(
                        id,
                        parameters,
                        badManagedPreview,
                        badManagedCriterion,
                        badManagedDigest);
                    break;
                case "managed.readonly.execute":
                    await HandleManagedReadOnlyExecuteAsync(
                        id,
                        parameters,
                        badManagedReceipt,
                        badManagedBinding);
                    break;
                case "managed.evidence.list":
                    await HandleManagedEvidenceListAsync(
                        id,
                        parameters,
                        badManagedEvidencePage,
                        badManagedEvidenceCount,
                        badManagedEvidenceSnapshot,
                        badManagedEvidenceTotal);
                    break;
                case "managed.evidence.read":
                    await HandleManagedEvidenceReadAsync(
                        id,
                        parameters,
                        badManagedEvidenceDetail,
                        badManagedEvidenceBinding,
                        badManagedEvidenceApplyBinding);
                    break;
                case "managed.review.read":
                    await HandleManagedReviewReadAsync(
                        id,
                        parameters,
                        badManagedReviewDigest,
                        badManagedReviewPrivate,
                        badManagedReviewBinding,
                        badManagedReviewPath,
                        badManagedReviewMetadata);
                    break;
                case "managed.review.apply":
                    await HandleManagedReviewDecisionAsync(
                        id,
                        parameters,
                        "apply-exact-managed-review",
                        staleManagedReview,
                        badManagedTransitionDigest,
                        badManagedTransitionPrivate);
                    break;
                case "managed.review.discard":
                    await HandleManagedReviewDecisionAsync(
                        id,
                        parameters,
                        "discard-exact-managed-review",
                        staleManagedReview,
                        badManagedTransitionDigest,
                        badManagedTransitionPrivate);
                    break;
                case "productStudio.portableDesign.import":
                    await HandleImportAsync(id, parameters);
                    break;
                case "productStudio.portableDesign.list":
                    await HandleListAsync(id, parameters);
                    break;
                case "productStudio.portableDesign.read":
                    await HandleReadAsync(id, parameters);
                    break;
                default:
                    await WriteErrorAsync(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE UNKNOWN METHOD");
                    break;
            }
        }
    }

    private static async Task HandleReadInitiativeAsync(
        long id,
        JsonElement parameters,
        long revision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID INITIATIVE READ");
            return;
        }
        var result = InitiativeRecord(revision, classification, applicability);
        if (includePrivateField) result["workspaceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleSourceGovernanceAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeInitiativeBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SOURCE GOVERNANCE");
            return;
        }
        var assessedAt = "2026-07-25T00:03:00.000Z";
        var baselineDigest = $"sha256:{new string('a', 64)}";
        var membershipDigest = $"sha256:{new string('b', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var initiativeBinding = new Dictionary<string, object?>
        {
            ["id"] = InitiativeId.ToString("D"),
            ["revision"] = initiativeRevision,
            ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
            ["state"] = "active",
        };
        var source = new Dictionary<string, object?>
        {
            ["id"] = SourceId.ToString("D"),
            ["revision"] = 1,
            ["title"] = "Reviewed repository source",
            ["sourceType"] = "repository",
            ["owner"] = new Dictionary<string, object?>
            {
                ["kind"] = "human",
                ["id"] = "founder.source-review",
            },
            ["semanticAuthority"] = new Dictionary<string, object?>
            {
                ["standing"] = "authoritative",
                ["domain"] = "product requirements",
                ["scope"] = new[] { "Initiative source governance" },
            },
            ["knowledgeDisposition"] = "confirmed",
            ["informationClassification"] = "internal",
            ["freshness"] = "fresh",
            ["availability"] = "available",
            ["contentDigest"] = $"sha256:{new string('c', 64)}",
            ["recordDigest"] = $"sha256:{new string('d', 64)}",
            ["updatedAt"] = "2026-07-25T00:02:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "source-governance-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = 7,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7))),
            },
            ["initiative"] = initiativeBinding,
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "source-governance-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = 7,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["sourceCount"] = 1,
                ["baselineCount"] = 1,
                ["provenanceCount"] = 1,
                ["staleSourceCount"] = 0,
                ["unknownAuthorityCount"] = 0,
                ["unbaselinedSourceCount"] = 0,
                ["unprovenancedSourceCount"] = 0,
                ["state"] = "ready",
                ["reasons"] = Array.Empty<string>(),
                ["currentBaseline"] = new Dictionary<string, object?>
                {
                    ["id"] = SourceBaselineId.ToString("D"),
                    ["revision"] = 1,
                    ["digest"] = baselineDigest,
                    ["membershipDigest"] = membershipDigest,
                    ["status"] = "current",
                    ["memberCount"] = 1,
                },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action",
            },
            ["sources"] = new[] { source },
            ["baselines"] = new[]
            {
                new Dictionary<string, object?>
                {
                    ["id"] = SourceBaselineId.ToString("D"),
                    ["revision"] = 1,
                    ["title"] = "Candidate source baseline",
                    ["state"] = "candidate",
                    ["membershipDigest"] = membershipDigest,
                    ["memberCount"] = 1,
                    ["assessmentStatus"] = "current",
                    ["updatedAt"] = "2026-07-25T00:02:30.000Z",
                },
            },
            ["provenance"] = new[]
            {
                new Dictionary<string, object?>
                {
                    ["id"] = SourceProvenanceId.ToString("D"),
                    ["targetKind"] = "governed-record",
                    ["targetDigest"] = $"sha256:{new string('e', 64)}",
                    ["disposition"] = "confirmed",
                    ["sourceCount"] = 1,
                    ["transformationCount"] = 1,
                    ["recordedAt"] = "2026-07-25T00:02:45.000Z",
                },
            },
            ["limits"] = new Dictionary<string, object?>
            {
                ["sources"] = SourceProjectionLimit(),
                ["baselines"] = SourceProjectionLimit(),
                ["provenance"] = SourceProjectionLimit(),
            },
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials",
            ["authorityBoundary"] =
                "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (forgeInitiativeBinding)
        {
            initiativeBinding["digest"] = $"sha256:{new string('0', 64)}";
            RefreshCanonicalDigest(result, "snapshotDigest");
        }
        if (mutateAfterDigest) source["title"] = "Forged source title";
        if (includePrivateField) result["privateRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static Dictionary<string, object?> SourceProjectionLimit() => new()
    {
        ["shown"] = 1,
        ["total"] = 1,
        ["omitted"] = 0,
    };

    private static async Task HandleBusinessUnderstandingAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BUSINESS UNDERSTANDING");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-25T00:04:00.000Z";
        var businessDigest = $"sha256:{new string('3', 64)}";
        var stakeholderDigest = $"sha256:{new string('4', 64)}";
        var outcomeDigest = $"sha256:{new string('5', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var outcome = new Dictionary<string, object?>
        {
            ["id"] = OutcomeModelId.ToString("D"),
            ["revision"] = 1,
            ["digest"] = outcomeDigest,
            ["state"] = "candidate",
            ["outcomeCount"] = 2,
            ["measureCount"] = 4,
            ["countermetricCount"] = 1,
            ["burdenMeasureCount"] = 1,
            ["observedBaselineCount"] = 4,
            ["updatedAt"] = "2026-07-25T00:03:40.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "business-understanding-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "business-understanding-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["businessUnderstanding"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BusinessUnderstandingId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = businessDigest,
                },
                ["stakeholderModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = StakeholderModelId.ToString("D"),
                    ["revision"] = 1,
                    ["digest"] = stakeholderDigest,
                },
                ["outcomeModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = OutcomeModelId.ToString("D"),
                    ["revision"] = 1,
                    ["digest"] = outcomeDigest,
                },
                ["stakeholderCount"] = 8,
                ["representedStakeholderCategoryCount"] = 8,
                ["unresolvedStakeholderCategoryCount"] = 0,
                ["verifiedAuthorityCount"] = 0,
                ["unverifiedAuthorityCount"] = 0,
                ["outcomeCount"] = 2,
                ["measureCount"] = 4,
                ["observedBaselineCount"] = 4,
                ["unresolvedQuestionCount"] = 0,
                ["blockingQuestionCount"] = 0,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "complete-for-review",
                ["reasons"] = Array.Empty<string>(),
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action",
            },
            ["businessUnderstanding"] = new Dictionary<string, object?>
            {
                ["id"] = BusinessUnderstandingId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = businessDigest,
                ["state"] = "candidate",
                ["objectiveCount"] = 3,
                ["constraintCount"] = 2,
                ["assumptionCount"] = 1,
                ["unresolvedQuestionCount"] = 0,
                ["glossaryTermCount"] = 5,
                ["updatedAt"] = "2026-07-25T00:03:30.000Z",
            },
            ["stakeholderModel"] = new Dictionary<string, object?>
            {
                ["id"] = StakeholderModelId.ToString("D"),
                ["revision"] = 1,
                ["digest"] = stakeholderDigest,
                ["state"] = "candidate",
                ["stakeholderCount"] = 8,
                ["representedCategoryCount"] = 8,
                ["unresolvedCategoryCount"] = 0,
                ["verifiedAuthorityCount"] = 0,
                ["updatedAt"] = "2026-07-25T00:03:35.000Z",
            },
            ["outcomeModel"] = outcome,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials",
            ["authorityBoundary"] =
                "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) outcome["measureCount"] = 5;
        if (includePrivateField) result["personalAssignment"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBusinessCapabilityMapAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BUSINESS CAPABILITY MAP");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-25T00:04:10.000Z";
        var mapDigest = $"sha256:{new string('6', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var map = new Dictionary<string, object?>
        {
            ["id"] = BusinessCapabilityMapId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = mapDigest,
            ["state"] = "candidate",
            ["capabilityCount"] = 7,
            ["ownedCapabilityCount"] = 6,
            ["openGapCount"] = 2,
            ["criticalGapCount"] = 1,
            ["candidatePriorityCount"] = 6,
            ["updatedAt"] = "2026-07-25T00:04:09.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "business-capability-map-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "business-capability-map-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["capabilityMap"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BusinessCapabilityMapId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = mapDigest,
                },
                ["capabilityCount"] = 7,
                ["ownedCapabilityCount"] = 6,
                ["unownedCapabilityCount"] = 1,
                ["objectiveCoverageCount"] = 3,
                ["outcomeCoverageCount"] = 2,
                ["openGapCount"] = 2,
                ["criticalGapCount"] = 1,
                ["unknownCurrentMaturityCount"] = 1,
                ["unassessedPriorityCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more capabilities do not have a candidate owner" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action",
            },
            ["capabilityMap"] = map,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials",
            ["authorityBoundary"] =
                "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) map["openGapCount"] = 3;
        if (includePrivateField) result["capabilityNarrative"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleValueStreamModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID VALUE STREAM MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-25T00:05:00.000Z";
        var modelDigest = $"sha256:{new string('7', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = ValueStreamModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["state"] = "candidate",
            ["valueStreamCount"] = 3,
            ["ownedValueStreamCount"] = 2,
            ["stageCount"] = 9,
            ["dependencyCount"] = 2,
            ["openBottleneckCount"] = 2,
            ["criticalBottleneckCount"] = 1,
            ["updatedAt"] = "2026-07-25T00:04:59.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "value-stream-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "value-stream-model-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["valueStreamModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ValueStreamModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["valueStreamCount"] = 3,
                ["ownedValueStreamCount"] = 2,
                ["unownedValueStreamCount"] = 1,
                ["stageCount"] = 9,
                ["dependencyCount"] = 2,
                ["capabilityCoverageCount"] = 6,
                ["outcomeCoverageCount"] = 2,
                ["absentFlowEvidenceCount"] = 1,
                ["openBottleneckCount"] = 2,
                ["criticalBottleneckCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more value streams do not have a candidate owner" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action",
            },
            ["valueStreamModel"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials",
            ["authorityBoundary"] =
                "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["openBottleneckCount"] = 3;
        if (includePrivateField) result["valueStreamNarrative"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleOperatingModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID OPERATING MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T07:00:00.000Z";
        var modelDigest = $"sha256:{new string('8', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = OperatingModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["state"] = "candidate",
            ["roleCount"] = 6,
            ["decisionRightCount"] = 8,
            ["forumCount"] = 2,
            ["cycleCount"] = 3,
            ["updatedAt"] = "2026-07-26T06:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "operating-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "operating-model-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["operatingModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = OperatingModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["roleCount"] = 6,
                ["governanceSystemCount"] = 2,
                ["unassignedAppointingAuthorityCount"] = 1,
                ["insufficientCapacityCount"] = 2,
                ["unfundedCapacityCount"] = 3,
                ["decisionRightCount"] = 8,
                ["unassignedDecisionAuthorityCount"] = 1,
                ["forumCount"] = 2,
                ["cycleCount"] = 3,
                ["supportCapacityGapCount"] = 1,
                ["emergencyAuthorityGapCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more candidate roles have no candidate appointing authority" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
            },
            ["operatingModel"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials",
            ["authorityBoundary"] =
                "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["roleCount"] = 7;
        if (includePrivateField) result["operatingNarrative"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBusinessRuleCatalogAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BUSINESS RULE CATALOG");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T08:30:00.000Z";
        var catalogDigest = $"sha256:{new string('9', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var catalog = new Dictionary<string, object?>
        {
            ["id"] = BusinessRuleCatalogId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = catalogDigest,
            ["state"] = "candidate",
            ["ruleCount"] = 7,
            ["enforcementTargetCount"] = 4,
            ["exceptionCount"] = 2,
            ["nonExceptionableRuleCount"] = 3,
            ["updatedAt"] = "2026-07-26T08:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "business-rule-catalog-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "business-rule-catalog-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["businessRuleCatalog"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BusinessRuleCatalogId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = catalogDigest,
                },
                ["ruleCount"] = 7,
                ["sourceBackedRuleCount"] = 7,
                ["nonExceptionableRuleCount"] = 3,
                ["enforcementTargetCount"] = 4,
                ["unassignedEnforcementTargetCount"] = 1,
                ["unverifiedEnforcementTargetCount"] = 2,
                ["exceptionCount"] = 2,
                ["unassignedExceptionAuthorityCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more enforcement targets have no candidate assignment" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
            },
            ["businessRuleCatalog"] = catalog,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials",
            ["authorityBoundary"] =
                "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) catalog["ruleCount"] = 8;
        if (includePrivateField) result["ruleNarrative"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBusinessArchitectureBaselineAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BUSINESS ARCHITECTURE BASELINE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T09:30:00.000Z";
        var baselineDigest = $"sha256:{new string('a', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var baseline = new Dictionary<string, object?>
        {
            ["id"] = BusinessArchitectureBaselineId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = baselineDigest,
            ["membershipDigest"] = $"sha256:{new string('d', 64)}",
            ["state"] = "candidate",
            ["coveredElementCount"] = 27,
            ["integrationClaimCount"] = 8,
            ["consistencyGapCount"] = 2,
            ["updatedAt"] = "2026-07-26T09:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "business-architecture-baseline-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "business-architecture-baseline-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["baseline"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BusinessArchitectureBaselineId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = baselineDigest,
                },
                ["coveredElementCount"] = 27,
                ["includedElementCount"] = 25,
                ["excludedElementCount"] = 1,
                ["unresolvedElementCount"] = 1,
                ["integrationClaimCount"] = 8,
                ["consistencyCheckCount"] = 6,
                ["consistencyGapCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more candidate architecture elements remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action",
            },
            ["baseline"] = baseline,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
            ["authorityBoundary"] =
                "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) baseline["coveredElementCount"] = 28;
        if (includePrivateField) result["architectureNarrative"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleSystemSolutionArchitectureAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SYSTEM SOLUTION ARCHITECTURE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T10:30:00.000Z";
        var architectureDigest = $"sha256:{new string('b', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var architecture = new Dictionary<string, object?>
        {
            ["id"] = SystemSolutionArchitectureId.ToString("D"),
            ["revision"] = 3,
            ["digest"] = architectureDigest,
            ["membershipDigest"] = $"sha256:{new string('e', 64)}",
            ["state"] = "candidate",
            ["concernCount"] = 4,
            ["viewCount"] = 3,
            ["elementCount"] = 9,
            ["qualityAttributeCount"] = 5,
            ["decisionCount"] = 4,
            ["updatedAt"] = "2026-07-26T10:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "system-solution-architecture-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "system-solution-architecture-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["architecture"] = new Dictionary<string, object?>
                {
                    ["recordId"] = SystemSolutionArchitectureId.ToString("D"),
                    ["revision"] = 3,
                    ["digest"] = architectureDigest,
                },
                ["concernCount"] = 4,
                ["viewCount"] = 3,
                ["elementCount"] = 9,
                ["relationCount"] = 12,
                ["qualityAttributeCount"] = 5,
                ["unresolvedQualityAttributeCount"] = 1,
                ["decisionCount"] = 4,
                ["unresolvedDecisionCount"] = 2,
                ["conformanceCriterionCount"] = 6,
                ["unresolvedConformanceCriterionCount"] = 1,
                ["lifecycleGapCount"] = 1,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more architecture decisions remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action",
            },
            ["architecture"] = architecture,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
            ["authorityBoundary"] =
                "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) architecture["elementCount"] = 10;
        if (includePrivateField) result["architectureNarrative"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBoundedContextModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BOUNDED CONTEXT MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T11:00:00.000Z";
        var modelDigest = $"sha256:{new string('3', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = BoundedContextModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('4', 64)}",
            ["state"] = "candidate",
            ["boundedContextCount"] = 3,
            ["contractCount"] = 4,
            ["relationshipCount"] = 3,
            ["updatedAt"] = "2026-07-26T10:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "bounded-context-ownership-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["assessment"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "bounded-context-ownership-assessment",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BoundedContextModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["boundedContextCount"] = 3,
                ["coreContextCount"] = 1,
                ["languageTermCount"] = 11,
                ["contractCount"] = 4,
                ["unresolvedContractCount"] = 1,
                ["relationshipCount"] = 3,
                ["unresolvedRelationshipCount"] = 1,
                ["unassignedArchitectureElementCount"] = 2,
                ["unownedDataAssetCount"] = 1,
                ["unmappedCrossContextRelationCount"] = 2,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more cross-context contracts remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials",
            ["authorityBoundary"] =
                "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["boundedContextCount"] = 4;
        if (includePrivateField) result["ubiquitousLanguage"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleSecurityPrivacyAssessmentAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SECURITY PRIVACY ASSESSMENT");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T11:15:00.000Z";
        var assessmentDigest = $"sha256:{new string('5', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var assessment = new Dictionary<string, object?>
        {
            ["id"] = SecurityPrivacyAssessmentId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = assessmentDigest,
            ["membershipDigest"] = $"sha256:{new string('6', 64)}",
            ["state"] = "candidate",
            ["assetCount"] = 4,
            ["trustBoundaryCount"] = 3,
            ["dataClassCount"] = 2,
            ["controlCount"] = 6,
            ["threatCount"] = 7,
            ["updatedAt"] = "2026-07-26T11:14:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "security-privacy-threat-assessment-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "security-privacy-threat-assessment-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["assessment"] = new Dictionary<string, object?>
                {
                    ["recordId"] = SecurityPrivacyAssessmentId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = assessmentDigest,
                },
                ["assetCount"] = 4,
                ["actorCount"] = 5,
                ["trustBoundaryCount"] = 3,
                ["dataClassCount"] = 2,
                ["dataFlowCount"] = 4,
                ["controlCount"] = 6,
                ["threatCount"] = 7,
                ["unresolvedThreatCount"] = 2,
                ["unverifiedControlCount"] = 1,
                ["unresolvedProcessingAuthorityCount"] = 1,
                ["uncoveredArchitectureElementCount"] = 0,
                ["unmappedArchitectureRelationCount"] = 1,
                ["unresolvedRequirementCount"] = 3,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Security or Data Profile requirements remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
            },
            ["assessment"] = assessment,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials",
            ["authorityBoundary"] =
                "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) assessment["assetCount"] = 5;
        if (includePrivateField) result["threatScenario"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleProcessModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PROCESS MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T11:30:00.000Z";
        var modelDigest = $"sha256:{new string('7', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = ProcessModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('8', 64)}",
            ["state"] = "candidate",
            ["processCount"] = 3,
            ["transitionCount"] = 11,
            ["approvalRequirementCount"] = 4,
            ["updatedAt"] = "2026-07-26T11:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "process-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "process-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ProcessModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["processCount"] = 3,
                ["stepCount"] = 9,
                ["stateDimensionCount"] = 5,
                ["stateValueCount"] = 18,
                ["transitionCount"] = 11,
                ["eventDefinitionCount"] = 8,
                ["approvalRequirementCount"] = 4,
                ["uncoveredValueStreamCount"] = 1,
                ["uncoveredBoundedContextCount"] = 2,
                ["uncoveredBusinessRuleCount"] = 3,
                ["unresolvedRequirementCount"] = 4,
                ["inconsistencyCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Process Model requirements remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials",
            ["authorityBoundary"] =
                "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["processCount"] = 4;
        if (includePrivateField) result["transitionGuard"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDataModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DATA MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T12:30:00.000Z";
        var modelDigest = $"sha256:{new string('9', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = DataModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('a', 64)}",
            ["state"] = "candidate",
            ["entityCount"] = 6,
            ["relationshipCount"] = 8,
            ["lifecycleCount"] = 6,
            ["updatedAt"] = "2026-07-26T12:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "data-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "data-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DataModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["entityCount"] = 6,
                ["attributeCount"] = 24,
                ["relationshipCount"] = 8,
                ["lifecycleCount"] = 6,
                ["transformationCount"] = 5,
                ["uncoveredBoundedContextCount"] = 1,
                ["uncoveredSecurityDataClassCount"] = 2,
                ["uncoveredProcessCount"] = 3,
                ["unresolvedSystemOfRecordCount"] = 1,
                ["unresolvedTransformationCount"] = 2,
                ["unresolvedRequirementCount"] = 4,
                ["inconsistencyCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Data Model requirements remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials",
            ["authorityBoundary"] =
                "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["entityCount"] = 7;
        if (includePrivateField) result["entityAttribute"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleAuthorizationModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID AUTHORIZATION MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T13:30:00.000Z";
        var modelDigest = $"sha256:{new string('b', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = AuthorizationModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('c', 64)}",
            ["state"] = "candidate",
            ["principalCount"] = 5,
            ["actionCount"] = 8,
            ["ruleCount"] = 9,
            ["updatedAt"] = "2026-07-26T13:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "authorization-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "authorization-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = AuthorizationModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["principalCount"] = 5,
                ["roleAssignmentCount"] = 6,
                ["resourceCount"] = 7,
                ["actionCount"] = 8,
                ["approvalBindingCount"] = 3,
                ["ruleCount"] = 9,
                ["uncoveredOperatingRoleCount"] = 1,
                ["uncoveredProcessCount"] = 2,
                ["uncoveredDataEntityCount"] = 3,
                ["unresolvedIdentityCount"] = 4,
                ["unresolvedRuleCount"] = 5,
                ["unresolvedRequirementCount"] = 6,
                ["inconsistencyCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Authorization Rules remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials",
            ["authorityBoundary"] =
                "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["principalCount"] = 6;
        if (includePrivateField) result["principalIdentifier"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleEventIntegrationModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID EVENT INTEGRATION MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T14:00:00.000Z";
        var modelDigest = $"sha256:{new string('d', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = EventIntegrationModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('e', 64)}",
            ["state"] = "candidate",
            ["eventTypeCount"] = 10,
            ["commandCount"] = 11,
            ["adapterCount"] = 4,
            ["externalContractCount"] = 5,
            ["mappingCount"] = 6,
            ["routeCount"] = 7,
            ["updatedAt"] = "2026-07-26T13:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "event-integration-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "event-integration-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = EventIntegrationModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["eventTypeCount"] = 10,
                ["commandCount"] = 11,
                ["adapterCount"] = 4,
                ["externalContractCount"] = 5,
                ["mappingCount"] = 6,
                ["routeCount"] = 7,
                ["uncoveredProcessEventCount"] = 1,
                ["uncoveredProcessCount"] = 2,
                ["uncoveredBoundedContextCount"] = 3,
                ["uncoveredDataEntityCount"] = 4,
                ["uncoveredAuthorizationActionCount"] = 5,
                ["unknownMappingTruthCount"] = 6,
                ["unresolvedRequirementCount"] = 7,
                ["inconsistencyCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more integration mappings remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["routeCount"] = 8;
        if (includePrivateField) result["eventPayload"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleFailureRecoveryModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID FAILURE RECOVERY MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T15:00:00.000Z";
        var modelDigest = $"sha256:{new string('c', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = FailureRecoveryModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('b', 64)}",
            ["state"] = "candidate",
            ["failureModeCount"] = 8,
            ["retryPolicyCount"] = 6,
            ["compensationPlanCount"] = 5,
            ["recoveryPlanCount"] = 4,
            ["recoveryEvidenceDefinitionCount"] = 3,
            ["updatedAt"] = "2026-07-26T14:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "failure-recovery-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "failure-recovery-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = FailureRecoveryModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["failureModeCount"] = 8,
                ["retryPolicyCount"] = 6,
                ["compensationPlanCount"] = 5,
                ["recoveryPlanCount"] = 4,
                ["recoveryEvidenceDefinitionCount"] = 3,
                ["uncoveredProcessCount"] = 1,
                ["uncoveredCommandCount"] = 2,
                ["uncoveredRouteCount"] = 3,
                ["uncoveredAuthorizationActionCount"] = 4,
                ["unresolvedRecoveryEvidenceCount"] = 5,
                ["unresolvedRequirementCount"] = 6,
                ["inconsistencyCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more recovery evidence definitions remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["recoveryPlanCount"] = 5;
        if (includePrivateField) result["recoveryEvidence"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleArchitectureChallengeModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ARCHITECTURE CHALLENGE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T16:00:00.000Z";
        var modelDigest = $"sha256:{new string('d', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var model = new Dictionary<string, object?>
        {
            ["id"] = ArchitectureChallengeModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = modelDigest,
            ["membershipDigest"] = $"sha256:{new string('a', 64)}",
            ["state"] = "candidate",
            ["challengeSubjectCount"] = 9,
            ["assumptionCount"] = 7,
            ["alternativeCount"] = 4,
            ["findingCount"] = 6,
            ["responseCount"] = 5,
            ["updatedAt"] = "2026-07-26T15:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "architecture-challenge-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "architecture-challenge-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["model"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ArchitectureChallengeModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = modelDigest,
                },
                ["challengeSubjectCount"] = 9,
                ["assumptionCount"] = 7,
                ["alternativeCount"] = 4,
                ["findingCount"] = 6,
                ["responseCount"] = 5,
                ["unrespondedFindingCount"] = 1,
                ["unresolvedAssumptionCount"] = 2,
                ["unresolvedRequirementCount"] = 3,
                ["inconsistencyCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more challenge findings remain unresponded" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
            },
            ["model"] = model,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) model["responseCount"] = 6;
        if (includePrivateField) result["challengeContent"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDecisionRegisterAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DECISION REGISTER");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T17:00:00.000Z";
        var registerDigest = $"sha256:{new string('d', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var register = new Dictionary<string, object?>
        {
            ["id"] = DecisionRegisterId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = registerDigest,
            ["membershipDigest"] = $"sha256:{new string('a', 64)}",
            ["state"] = "candidate",
            ["decisionCount"] = 7,
            ["updatedAt"] = "2026-07-26T16:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "decision-register-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "decision-register-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["register"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DecisionRegisterId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = registerDigest,
                },
                ["decisionCount"] = 7,
                ["unresolvedDecisionCount"] = 2,
                ["selectedPendingDecisionCount"] = 3,
                ["deferredDecisionCount"] = 1,
                ["unresolvedRequirementCount"] = 1,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 1,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Decision Questions remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
            },
            ["register"] = register,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) register["decisionCount"] = 8;
        if (includePrivateField) result["decisionQuestion"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleRiskRegisterAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID RISK REGISTER");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-26T18:00:00.000Z";
        var registerDigest = $"sha256:{new string('e', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var register = new Dictionary<string, object?>
        {
            ["id"] = RiskRegisterId.ToString("D"),
            ["revision"] = 3,
            ["digest"] = registerDigest,
            ["membershipDigest"] = $"sha256:{new string('b', 64)}",
            ["state"] = "candidate",
            ["riskCount"] = 9,
            ["updatedAt"] = "2026-07-26T17:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "risk-register-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "risk-register-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["register"] = new Dictionary<string, object?>
                {
                    ["recordId"] = RiskRegisterId.ToString("D"),
                    ["revision"] = 3,
                    ["digest"] = registerDigest,
                },
                ["riskCount"] = 9,
                ["notAssessedRiskCount"] = 2,
                ["unresolvedResidualRiskCount"] = 3,
                ["proposedTreatmentCount"] = 9,
                ["unassignedOwnerCount"] = 9,
                ["unverifiedControlCount"] = 4,
                ["unresolvedRequirementCount"] = 1,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 1,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Risk Assessments remain explicitly not assessed" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
            },
            ["register"] = register,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) register["riskCount"] = 10;
        if (includePrivateField) result["riskStatement"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleEvidenceRegistryAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID EVIDENCE REGISTRY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-27T00:00:00.000Z";
        var registryDigest = $"sha256:{new string('f', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var registry = new Dictionary<string, object?>
        {
            ["id"] = EvidenceRegistryId.ToString("D"),
            ["revision"] = 4,
            ["digest"] = registryDigest,
            ["membershipDigest"] = $"sha256:{new string('d', 64)}",
            ["state"] = "candidate",
            ["claimCount"] = 12,
            ["evidenceItemCount"] = 18,
            ["linkCount"] = 21,
            ["updatedAt"] = "2026-07-26T23:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "evidence-registry-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "evidence-registry-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["registry"] = new Dictionary<string, object?>
                {
                    ["recordId"] = EvidenceRegistryId.ToString("D"),
                    ["revision"] = 4,
                    ["digest"] = registryDigest,
                },
                ["claimCount"] = 12,
                ["evidenceItemCount"] = 18,
                ["linkCount"] = 21,
                ["notAssessedClaimCount"] = 2,
                ["notAssessedEvidenceCount"] = 3,
                ["adverseEvidencePendingDispositionCount"] = 1,
                ["staleOrUnknownEvidenceCount"] = 4,
                ["invalidatedEvidenceCount"] = 1,
                ["unresolvedLinkCount"] = 21,
                ["unresolvedRequirementCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 1,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Claims remain explicitly not assessed" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority",
            },
            ["registry"] = registry,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) registry["claimCount"] = 13;
        if (includePrivateField) result["claimStatement"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleEndToEndTraceabilityAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID END-TO-END TRACEABILITY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-27T00:00:00.000Z";
        var traceabilityDigest = $"sha256:{new string('a', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var traceability = new Dictionary<string, object?>
        {
            ["id"] = EndToEndTraceabilityId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = traceabilityDigest,
            ["membershipDigest"] = $"sha256:{new string('b', 64)}",
            ["state"] = "candidate",
            ["nodeCount"] = 44,
            ["relationshipCount"] = 12,
            ["linkCount"] = 67,
            ["transformationCount"] = 5,
            ["updatedAt"] = "2026-07-26T23:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "end-to-end-traceability-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "end-to-end-traceability-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["traceability"] = new Dictionary<string, object?>
                {
                    ["recordId"] = EndToEndTraceabilityId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = traceabilityDigest,
                },
                ["nodeCount"] = 44,
                ["relationshipCount"] = 12,
                ["linkCount"] = 67,
                ["transformationCount"] = 5,
                ["verifiedLinkCount"] = 40,
                ["proposedLinkCount"] = 20,
                ["invalidOrHistoricalLinkCount"] = 7,
                ["unresolvedEndpointCount"] = 2,
                ["notAssessedSemanticCount"] = 9,
                ["missingSpineCount"] = 1,
                ["unknownRelationshipCount"] = 2,
                ["unresolvedRequirementCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 1,
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more trace links remain explicitly not assessed" },
                ["assessedAt"] = assessedAt,
                ["coverageBoundary"] =
                    "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
                ["authorityBoundary"] =
                    "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority",
            },
            ["traceability"] = traceability,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) traceability["nodeCount"] = 45;
        if (includePrivateField) result["linkRationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleP0P4ReadinessGateAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID P0-P4 READINESS GATE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-27T00:00:00.000Z";
        var gateDigest = $"sha256:{new string('c', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var gate = new Dictionary<string, object?>
        {
            ["id"] = P0P4ReadinessGateId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = gateDigest,
            ["membershipDigest"] = $"sha256:{new string('d', 64)}",
            ["state"] = "candidate",
            ["evaluationDefinitionDigest"] = $"sha256:{new string('e', 64)}",
            ["outputCount"] = 25,
            ["waiverCount"] = 1,
            ["unresolvedDecisionCount"] = 2,
            ["conditionCount"] = 3,
            ["updatedAt"] = "2026-07-26T23:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "p0-p4-readiness-gate-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "p0-p4-readiness-gate-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["gate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = P0P4ReadinessGateId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = gateDigest,
                },
                ["outputCount"] = 25,
                ["applicableOutputCount"] = 20,
                ["notApplicableOutputCount"] = 4,
                ["unresolvedApplicabilityCount"] = 1,
                ["satisfiedOutputCount"] = 17,
                ["conditionalOutputCount"] = 1,
                ["incompleteOutputCount"] = 1,
                ["failedOutputCount"] = 1,
                ["blockedOutputCount"] = 0,
                ["staleOrUnknownOutputCount"] = 1,
                ["pendingOrInvalidWaiverCount"] = 1,
                ["unresolvedDecisionCount"] = 2,
                ["unmetConditionCount"] = 1,
                ["unresolvedRequirementCount"] = 2,
                ["adverseEvidenceCount"] = 1,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["inconsistencyCount"] = 0,
                ["unresolvedQuestionCount"] = 1,
                ["result"] = "failed",
                ["reasons"] = new[] { "One or more applicable outputs have adverse evidence" },
                ["assessedAt"] = assessedAt,
                ["gateBoundary"] = "a-passing-gate-is-an-evaluation-result-not-permission",
                ["authorityBoundary"] =
                    "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
            },
            ["gate"] = gate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) gate["outputCount"] = 24;
        if (includePrivateField) result["waiverRationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleP5HandoffPackageAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID P5 HANDOFF PACKAGE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-27T04:00:00.000Z";
        var handoffDigest = $"sha256:{new string('1', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var handoff = new Dictionary<string, object?>
        {
            ["id"] = P5HandoffPackageId.ToString("D"),
            ["revision"] = 3,
            ["digest"] = handoffDigest,
            ["membershipDigest"] = $"sha256:{new string('2', 64)}",
            ["state"] = "candidate",
            ["readinessStatusDigest"] = $"sha256:{new string('3', 64)}",
            ["itemCount"] = 25,
            ["requirementCount"] = 66,
            ["deliveryMode"] = "disconnected",
            ["updatedAt"] = "2026-07-27T03:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "p5-handoff-package-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "p5-handoff-package-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["handoff"] = new Dictionary<string, object?>
                {
                    ["recordId"] = P5HandoffPackageId.ToString("D"),
                    ["revision"] = 3,
                    ["digest"] = handoffDigest,
                },
                ["itemCount"] = 25,
                ["includedItemCount"] = 17,
                ["referenceOnlyItemCount"] = 3,
                ["omittedNotApplicableItemCount"] = 4,
                ["unresolvedItemCount"] = 1,
                ["staleOrUnknownItemCount"] = 2,
                ["lossyTransformationCount"] = 1,
                ["unresolvedRequirementCount"] = 2,
                ["conflictCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 0,
                ["readinessResult"] = "incomplete",
                ["transferState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "Candidate package retains unresolved review gaps" },
                ["assessedAt"] = assessedAt,
                ["handoffBoundary"] =
                    "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
                ["authorityBoundary"] =
                    "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority",
            },
            ["handoff"] = handoff,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations",
            ["authorityBoundary"] =
                "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) handoff["itemCount"] = 24;
        if (includePrivateField) result["itemContent"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignApplicabilityAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN APPLICABILITY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T04:00:00.000Z";
        var candidateDigest = $"sha256:{new string('4', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignApplicabilityId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('5', 64)}",
            ["state"] = "candidate",
            ["scopeCount"] = 2,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T03:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-applicability-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-applicability-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignApplicabilityId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["scopeCount"] = 2,
                ["decisionCount"] = 8,
                ["unresolvedDecisionCount"] = 1,
                ["blockedDecisionCount"] = 0,
                ["pendingApprovalCount"] = 1,
                ["rejectedApprovalCount"] = 0,
                ["unresolvedDepthCount"] = 1,
                ["unresolvedSourceCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more target scopes remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["scopeCount"] = 3;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignPersonaRoleAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN PERSONA ROLE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T08:30:00.000Z";
        var candidateDigest = $"sha256:{new string('6', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignPersonaRoleId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('7', 64)}",
            ["state"] = "candidate",
            ["personaCount"] = 2,
            ["designRoleCount"] = 1,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T08:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-persona-role-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-persona-role-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignPersonaRoleId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["personaCount"] = 2,
                ["designRoleCount"] = 1,
                ["representedParticipantCategoryCount"] = 4,
                ["unresolvedParticipantCategoryCount"] = 1,
                ["representedRoleKindCount"] = 1,
                ["unresolvedRoleKindCount"] = 1,
                ["weakEvidencePersonaCount"] = 1,
                ["humanReviewedPersonaCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more design participant categories remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials",
            ["authorityBoundary"] =
                "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["personaCount"] = 3;
        if (includePrivateField) result["personaBehavior"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleUserJourneyAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID USER JOURNEY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T09:30:00.000Z";
        var candidateDigest = $"sha256:{new string('8', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = UserJourneyId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('9', 64)}",
            ["state"] = "candidate",
            ["journeyCount"] = 2,
            ["touchpointCount"] = 3,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T09:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "user-journey-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "user-journey-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = UserJourneyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["journeyCount"] = 2,
                ["touchpointCount"] = 3,
                ["primaryPathCount"] = 2,
                ["successPathCount"] = 2,
                ["failurePathCount"] = 2,
                ["recoveryPathCount"] = 2,
                ["representedScopeCount"] = 1,
                ["unresolvedScopeCount"] = 1,
                ["weakEvidencePathCount"] = 2,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Design Applicability scopes have unresolved User Journey coverage" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["journeyCount"] = 3;
        if (includePrivateField) result["journeyStep"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleInformationArchitectureAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID INFORMATION ARCHITECTURE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T10:30:00.000Z";
        var candidateDigest = $"sha256:{new string('a', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = InformationArchitectureId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('b', 64)}",
            ["state"] = "candidate",
            ["nodeCount"] = 6,
            ["rootNodeCount"] = 2,
            ["routeCount"] = 8,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T10:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "information-architecture-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "information-architecture-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = InformationArchitectureId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["nodeCount"] = 6,
                ["rootNodeCount"] = 2,
                ["routeCount"] = 8,
                ["representedScopeCount"] = 1,
                ["unresolvedScopeCount"] = 1,
                ["weakEvidenceNodeCount"] = 2,
                ["weakEvidenceRouteCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Design Applicability scopes have unresolved Information Architecture coverage" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["nodeCount"] = 7;
        if (includePrivateField) result["nodeLabel"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleScreenStateInventoryAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SCREEN STATE INVENTORY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T11:30:00.000Z";
        var candidateDigest = $"sha256:{new string('c', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = ScreenStateInventoryId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('d', 64)}",
            ["state"] = "candidate",
            ["platformCount"] = 3,
            ["screenCount"] = 9,
            ["stateCount"] = 18,
            ["variantCount"] = 5,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T11:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "screen-state-inventory-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "screen-state-inventory-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ScreenStateInventoryId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["platformCount"] = 3,
                ["targetedPlatformCount"] = 2,
                ["unresolvedPlatformCount"] = 1,
                ["screenCount"] = 9,
                ["stateCount"] = 18,
                ["variantCount"] = 5,
                ["representedRouteCount"] = 7,
                ["unresolvedRouteCount"] = 1,
                ["representedScopeCount"] = 1,
                ["unresolvedScopeCount"] = 1,
                ["weakEvidenceItemCount"] = 2,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Information Architecture routes have unresolved Screen and State Inventory coverage" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["screenCount"] = 10;
        if (includePrivateField) result["screenLabel"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignRequirementsAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN REQUIREMENTS");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T12:30:00.000Z";
        var candidateDigest = $"sha256:{new string('e', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignRequirementsId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('f', 64)}",
            ["state"] = "candidate",
            ["requirementCount"] = 12,
            ["representedOutcomeCount"] = 4,
            ["workItemCount"] = 10,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T12:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-requirements-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-requirements-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignRequirementsId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["requirementCount"] = 12,
                ["mustPriorityCount"] = 5,
                ["representedOutcomeCount"] = 4,
                ["unresolvedOutcomeCount"] = 1,
                ["linkedBacklogRequirementCount"] = 8,
                ["notPlannedRequirementCount"] = 2,
                ["unresolvedBacklogRequirementCount"] = 2,
                ["workItemCount"] = 10,
                ["weakEvidenceRequirementCount"] = 3,
                ["staleBindingCount"] = 0,
                ["staleDomainReferenceCount"] = 1,
                ["staleSourceReferenceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["catalogCompletenessState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Design Requirements retain unresolved outcome or backlog coverage" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["requirementCount"] = 13;
        if (includePrivateField) result["requirementStatement"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBacklogHierarchyAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BACKLOG HIERARCHY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T09:20:00.000Z";
        var candidateDigest = $"sha256:{new string('8', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = BacklogHierarchyId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('9', 64)}",
            ["state"] = "candidate",
            ["nodeCount"] = 24,
            ["epicCount"] = 2,
            ["featureCount"] = 5,
            ["storyCount"] = 8,
            ["taskCount"] = 9,
            ["requirementTraceCount"] = 17,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T09:19:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "backlog-hierarchy-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "backlog-hierarchy-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["nodeCount"] = 24,
                ["epicCount"] = 2,
                ["featureCount"] = 5,
                ["storyCount"] = 8,
                ["taskCount"] = 9,
                ["rootCount"] = 2,
                ["leafCount"] = 12,
                ["requirementTraceCount"] = 17,
                ["untracedStoryTaskCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleWorkItemCount"] = 1,
                ["staleChangeCount"] = 0,
                ["staleRequirementCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["hierarchyCompletenessState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more backlog hierarchy gaps remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "backlog-hierarchy-status-is-observational-and-does-not-establish-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-level-counts-statuses-and-digests-only-not-backlog-objectives-criteria-scope-owner-requirement-content-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "backlog-hierarchy-projection-is-read-only-and-does-not-prioritize-commit-assign-admit-execute-or-authorize-implementation-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["taskCount"] = 10;
        if (includePrivateField) result["workItemObjective"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleMvpSliceDefinitionAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeHierarchyBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MVP SLICE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T10:20:00.000Z";
        var candidateDigest = $"sha256:{new string('a', 64)}";
        var hierarchyDigest = $"sha256:{new string(forgeHierarchyBinding ? 'c' : '8', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = MvpSliceDefinitionId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('b', 64)}",
            ["hierarchyDigest"] = hierarchyDigest,
            ["state"] = "candidate",
            ["scopeNodeCount"] = 24,
            ["mvpNodeCount"] = 16,
            ["laterNodeCount"] = 5,
            ["excludedNodeCount"] = 3,
            ["sliceCount"] = 4,
            ["storyCount"] = 7,
            ["taskCount"] = 9,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T10:19:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "mvp-slice-definition-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "mvp-slice-definition-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["hierarchy"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = hierarchyDigest,
                },
                ["scopeNodeCount"] = 24,
                ["mvpNodeCount"] = 16,
                ["laterNodeCount"] = 5,
                ["excludedNodeCount"] = 3,
                ["sliceCount"] = 4,
                ["storyCount"] = 7,
                ["taskCount"] = 9,
                ["dependencyCount"] = 3,
                ["unassignedMvpStoryTaskCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleHierarchyCount"] = 0,
                ["invalidScopeCount"] = 0,
                ["invalidSliceCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["scopeCompletenessState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more MVP scope or Vertical Slice candidates require review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "mvp-slice-definition-status-is-observational-and-does-not-establish-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-scope-and-slice-counts-statuses-and-digests-only-not-slice-titles-rationales-objectives-criteria-scope-content-requirement-content-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "mvp-slice-definition-projection-is-read-only-and-does-not-prioritize-commit-approve-scope-admit-assign-execute-or-authorize-implementation-or-action",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["taskCount"] = 10;
        if (includePrivateField) result["sliceRationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandlePrioritizationModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeMvpBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PRIORITIZATION");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T11:20:00.000Z";
        var candidateDigest = $"sha256:{new string('c', 64)}";
        var mvpDigest = $"sha256:{new string(forgeMvpBinding ? '9' : 'a', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = PrioritizationModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('d', 64)}",
            ["methodDigest"] = $"sha256:{new string('e', 64)}",
            ["rankingDigest"] = $"sha256:{new string('f', 64)}",
            ["state"] = "candidate",
            ["subjectCount"] = 4,
            ["scoredSubjectCount"] = 3,
            ["evidenceReferenceCount"] = 12,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T11:19:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "prioritization-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "prioritization-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = PrioritizationModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["mvpSliceDefinition"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = mvpDigest,
                },
                ["subjectCount"] = 4,
                ["scoredSubjectCount"] = 3,
                ["unassessedSubjectCount"] = 1,
                ["evidenceReferenceCount"] = 12,
                ["tieCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleMvpSliceDefinitionCount"] = 0,
                ["invalidSubjectCount"] = 1,
                ["invalidScoreCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Prioritization subjects require review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "prioritization-model-status-is-observational-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-method-membership-ranking-and-snapshot-digests-only-not-dimension-estimates-evidence-identities-uncertainty-slice-content-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "prioritization-model-projection-is-read-only-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["scoredSubjectCount"] = 4;
        if (includePrivateField) result["dimensionEstimate"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleAcceptanceCriteriaAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeHierarchyBinding,
        bool forgeMvpBinding,
        bool forgePrioritizationBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ACCEPTANCE CRITERIA");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T12:20:00.000Z";
        var candidateDigest = $"sha256:{new string('1', 64)}";
        var hierarchyDigest = $"sha256:{new string(forgeHierarchyBinding ? '7' : '8', 64)}";
        var mvpDigest = $"sha256:{new string(forgeMvpBinding ? '9' : 'a', 64)}";
        var prioritizationDigest = $"sha256:{new string(forgePrioritizationBinding ? 'b' : 'c', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = AcceptanceCriteriaId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["subjectCatalogDigest"] = $"sha256:{new string('2', 64)}",
            ["criterionCatalogDigest"] = $"sha256:{new string('3', 64)}",
            ["verificationMethodCatalogDigest"] = $"sha256:{new string('4', 64)}",
            ["coverageDigest"] = $"sha256:{new string('5', 64)}",
            ["subjectCount"] = 16,
            ["criterionCount"] = 28,
            ["testableCriterionCount"] = 26,
            ["requirementTraceCount"] = 34,
            ["verificationMethodCount"] = 5,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T12:19:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "acceptance-criteria-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "acceptance-criteria-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = AcceptanceCriteriaId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["hierarchy"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = hierarchyDigest,
                },
                ["mvpSliceDefinition"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = mvpDigest,
                },
                ["prioritizationModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = PrioritizationModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = prioritizationDigest,
                },
                ["subjectCount"] = 16,
                ["coveredSubjectCount"] = 15,
                ["uncoveredSubjectCount"] = 1,
                ["criterionCount"] = 28,
                ["testableCriterionCount"] = 26,
                ["unassessedCriterionCount"] = 2,
                ["requirementTraceCount"] = 34,
                ["uncoveredRequirementCount"] = 1,
                ["verificationMethodCount"] = 5,
                ["staleBindingCount"] = 0,
                ["staleHierarchyCount"] = 0,
                ["staleMvpSliceDefinitionCount"] = 0,
                ["stalePrioritizationModelCount"] = 0,
                ["invalidCriterionCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["criterionSetCompletenessState"] = "not-assessed",
                ["requirementCoverageState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Acceptance Criteria candidates require review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "acceptance-criteria-status-is-observational-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-subject-criterion-method-coverage-snapshot-digests-only-not-criterion-text-requirement-identities-verification-evidence-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "acceptance-criteria-projection-is-read-only-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["criterionCount"] = 29;
        if (includePrivateField) result["criterionText"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDefinitionOfReadyAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeHierarchyBinding,
        bool forgeMvpBinding,
        bool forgePrioritizationBinding,
        bool forgeAcceptanceCriteriaBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DEFINITION OF READY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T13:20:00.000Z";
        var candidateDigest = $"sha256:{new string('6', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DefinitionOfReadyId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["policyVersion"] = 3,
            ["validUntil"] = "2026-08-30T13:19:00.000Z",
            ["subjectCatalogDigest"] = $"sha256:{new string('2', 64)}",
            ["policyDigest"] = $"sha256:{new string('3', 64)}",
            ["evaluationDigest"] = $"sha256:{new string('4', 64)}",
            ["receiptDigest"] = $"sha256:{new string('5', 64)}",
            ["subjectCount"] = 16,
            ["policyEntryCount"] = 9,
            ["evaluationCount"] = 140,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T13:19:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "definition-of-ready-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "definition-of-ready-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DefinitionOfReadyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["hierarchy"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeHierarchyBinding ? '7' : '8', 64)}",
                },
                ["mvpSliceDefinition"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeMvpBinding ? '9' : 'a', 64)}",
                },
                ["prioritizationModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = PrioritizationModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgePrioritizationBinding ? 'b' : 'c', 64)}",
                },
                ["acceptanceCriteria"] = new Dictionary<string, object?>
                {
                    ["recordId"] = AcceptanceCriteriaId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeAcceptanceCriteriaBinding ? '0' : '1', 64)}",
                },
                ["subjectCount"] = 16,
                ["policyEntryCount"] = 9,
                ["expectedEvaluationCount"] = 144,
                ["evaluationCount"] = 140,
                ["candidateSatisfiedCount"] = 130,
                ["notSatisfiedCount"] = 3,
                ["notApplicableCount"] = 12,
                ["exceptionCandidateCount"] = 2,
                ["notAssessedCount"] = 2,
                ["staleEvaluationCount"] = 2,
                ["invalidEvaluationCount"] = 1,
                ["missingEvaluationCount"] = 4,
                ["staleBindingCount"] = 0,
                ["staleHierarchyCount"] = 0,
                ["staleMvpSliceDefinitionCount"] = 0,
                ["stalePrioritizationModelCount"] = 0,
                ["staleAcceptanceCriteriaCount"] = 0,
                ["expiredCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["result"] = "attention-required",
                ["reasons"] = new[] { "One or more item prerequisites require review" },
                ["assessedAt"] = assessedAt,
                ["gateBoundary"] =
                    "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
                ["authorityBoundary"] =
                    "definition-of-ready-status-is-observational-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths",
            ["gateBoundary"] =
                "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
            ["authorityBoundary"] =
                "definition-of-ready-projection-is-read-only-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["evaluationCount"] = 141;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDefinitionOfDoneAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeHierarchyBinding,
        bool forgeMvpBinding,
        bool forgePrioritizationBinding,
        bool forgeAcceptanceCriteriaBinding,
        bool forgeDefinitionOfReadyBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DEFINITION OF DONE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T14:20:00.000Z";
        var candidateDigest = $"sha256:{new string('e', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DefinitionOfDoneId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["policyVersion"] = 4,
            ["validUntil"] = "2026-08-30T14:19:00.000Z",
            ["subjectCatalogDigest"] = $"sha256:{new string('1', 64)}",
            ["policyDigest"] = $"sha256:{new string('2', 64)}",
            ["evaluationDigest"] = $"sha256:{new string('3', 64)}",
            ["receiptDigest"] = $"sha256:{new string('4', 64)}",
            ["subjectCount"] = 4,
            ["policyEntryCount"] = 6,
            ["evaluationCount"] = 21,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T14:19:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "definition-of-done-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "definition-of-done-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DefinitionOfDoneId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["hierarchy"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeHierarchyBinding ? '7' : '8', 64)}",
                },
                ["mvpSliceDefinition"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeMvpBinding ? '9' : 'a', 64)}",
                },
                ["prioritizationModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = PrioritizationModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgePrioritizationBinding ? 'b' : 'c', 64)}",
                },
                ["acceptanceCriteria"] = new Dictionary<string, object?>
                {
                    ["recordId"] = AcceptanceCriteriaId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeAcceptanceCriteriaBinding ? '0' : '1', 64)}",
                },
                ["definitionOfReady"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DefinitionOfReadyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeDefinitionOfReadyBinding ? '5' : '6', 64)}",
                },
                ["subjectCount"] = 4,
                ["policyEntryCount"] = 6,
                ["expectedEvaluationCount"] = 24,
                ["evaluationCount"] = 21,
                ["candidateSatisfiedCount"] = 14,
                ["notSatisfiedCount"] = 2,
                ["notApplicableCount"] = 3,
                ["exceptionCandidateCount"] = 1,
                ["notAssessedCount"] = 1,
                ["staleEvaluationCount"] = 1,
                ["invalidEvaluationCount"] = 2,
                ["missingEvaluationCount"] = 3,
                ["staleBindingCount"] = 0,
                ["staleHierarchyCount"] = 0,
                ["staleMvpSliceDefinitionCount"] = 0,
                ["stalePrioritizationModelCount"] = 0,
                ["staleAcceptanceCriteriaCount"] = 0,
                ["staleDefinitionOfReadyCount"] = 0,
                ["expiredCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["result"] = "attention-required",
                ["reasons"] = new[] { "One or more completion prerequisites require review" },
                ["assessedAt"] = assessedAt,
                ["gateBoundary"] =
                    "a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission",
                ["authorityBoundary"] =
                    "definition-of-done-status-is-observational-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths",
            ["gateBoundary"] =
                "a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission",
            ["authorityBoundary"] =
                "definition-of-done-projection-is-read-only-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["evaluationCount"] = 22;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleImplementationUnitModelAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeHierarchyBinding,
        bool forgeMvpBinding,
        bool forgeAcceptanceCriteriaBinding,
        bool forgeDefinitionOfReadyBinding,
        bool forgeDefinitionOfDoneBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID IMPLEMENTATION UNIT MODEL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T15:00:00.000Z";
        var candidateDigest = $"sha256:{new string('5', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = ImplementationUnitModelId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["membershipDigest"] = $"sha256:{new string('6', 64)}",
            ["placementDigest"] = $"sha256:{new string('7', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('8', 64)}",
            ["unitCount"] = 3,
            ["subjectCount"] = 4,
            ["requirementReferenceCount"] = 5,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T14:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "implementation-unit-model-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "implementation-unit-model-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ImplementationUnitModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["hierarchy"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeHierarchyBinding ? '7' : '8', 64)}",
                },
                ["mvpSliceDefinition"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeMvpBinding ? '9' : 'a', 64)}",
                },
                ["acceptanceCriteria"] = new Dictionary<string, object?>
                {
                    ["recordId"] = AcceptanceCriteriaId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeAcceptanceCriteriaBinding ? '0' : '1', 64)}",
                },
                ["definitionOfReady"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DefinitionOfReadyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeDefinitionOfReadyBinding ? '5' : '6', 64)}",
                },
                ["definitionOfDone"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DefinitionOfDoneId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeDefinitionOfDoneBinding ? 'd' : 'e', 64)}",
                },
                ["unitCount"] = 3,
                ["subjectCount"] = 4,
                ["requirementReferenceCount"] = 5,
                ["repositoryCandidateCount"] = 3,
                ["ownerCandidateCount"] = 3,
                ["dependencyEdgeCount"] = 2,
                ["candidateAssessedBlastRadiusCount"] = 2,
                ["notAssessedBlastRadiusCount"] = 1,
                ["missingSubjectCount"] = 1,
                ["invalidUnitCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleHierarchyCount"] = 0,
                ["staleMvpSliceDefinitionCount"] = 0,
                ["staleAcceptanceCriteriaCount"] = 0,
                ["staleDefinitionOfReadyCount"] = 0,
                ["staleDefinitionOfDoneCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more implementation-unit candidate boundaries require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "implementation-unit-model-status-is-observational-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-membership-placement-assessment-snapshot-digests-only-not-unit-titles-boundaries-subject-or-requirement-identities-repository-keys-module-paths-owner-identities-evidence-rationales-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "implementation-unit-model-projection-is-read-only-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["unitCount"] = 4;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDependencyMappingAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeHierarchyBinding,
        bool forgeMvpBinding,
        bool forgeImplementationUnitModelBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DEPENDENCY MAPPING");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T15:30:00.000Z";
        var candidateDigest = $"sha256:{new string('9', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DependencyMappingId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["graphDigest"] = $"sha256:{new string('a', 64)}",
            ["criticalPathDigest"] = $"sha256:{new string('b', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('c', 64)}",
            ["nodeCount"] = 3,
            ["edgeCount"] = 2,
            ["criticalPathUnitCount"] = 2,
            ["criticalPathCandidateEffortPoints"] = 13,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T15:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "dependency-mapping-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "dependency-mapping-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DependencyMappingId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["hierarchy"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BacklogHierarchyId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeHierarchyBinding ? '7' : '8', 64)}",
                },
                ["mvpSliceDefinition"] = new Dictionary<string, object?>
                {
                    ["recordId"] = MvpSliceDefinitionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeMvpBinding ? '9' : 'a', 64)}",
                },
                ["implementationUnitModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ImplementationUnitModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeImplementationUnitModelBinding ? '4' : '5', 64)}",
                },
                ["nodeCount"] = 3,
                ["edgeCount"] = 2,
                ["requiredEdgeCount"] = 1,
                ["conditionalEdgeCount"] = 1,
                ["advisoryEdgeCount"] = 0,
                ["rootNodeCount"] = 1,
                ["leafNodeCount"] = 1,
                ["criticalPathUnitCount"] = 2,
                ["criticalPathCandidateEffortPoints"] = 13,
                ["missingNodeCount"] = 1,
                ["missingDeclaredEdgeCount"] = 1,
                ["extraEdgeCount"] = 0,
                ["invalidNodeCount"] = 1,
                ["invalidEdgeCount"] = 1,
                ["cycleCount"] = 0,
                ["staleBindingCount"] = 0,
                ["staleHierarchyCount"] = 0,
                ["staleMvpSliceDefinitionCount"] = 0,
                ["staleImplementationUnitModelCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more dependency-map candidates require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "dependency-mapping-status-is-observational-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-graph-critical-path-assessment-snapshot-digests-only-not-unit-node-edge-evidence-rationale-estimate-owner-repository-module-requirement-architecture-risk-test-or-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "dependency-mapping-projection-is-read-only-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["nodeCount"] = 4;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleTechnologyProfileAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeImplementationUnitModelBinding,
        bool forgeDependencyMappingBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID TECHNOLOGY PROFILE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T16:30:00.000Z";
        var candidateDigest = $"sha256:{new string('6', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = TechnologyProfileId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["profileCatalogDigest"] = $"sha256:{new string('a', 64)}",
            ["selectionCatalogDigest"] = $"sha256:{new string('b', 64)}",
            ["compatibilityAssessmentReceiptDigest"] = $"sha256:{new string('c', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('d', 64)}",
            ["unitProfileCount"] = 3,
            ["technologyChoiceCount"] = 5,
            ["constraintCount"] = 4,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T16:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "technology-profile-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "technology-profile-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = TechnologyProfileId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["implementationUnitModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ImplementationUnitModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeImplementationUnitModelBinding ? '4' : '5', 64)}",
                },
                ["dependencyMapping"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DependencyMappingId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeDependencyMappingBinding ? '7' : '9', 64)}",
                },
                ["unitProfileCount"] = 3,
                ["technologyChoiceCount"] = 5,
                ["exactVersionCandidateCount"] = 3,
                ["rangeVersionCandidateCount"] = 1,
                ["unresolvedVersionCount"] = 1,
                ["constraintCount"] = 4,
                ["missingProfileCount"] = 1,
                ["invalidProfileCount"] = 1,
                ["missingEvidenceCount"] = 2,
                ["unsupportedChoiceCount"] = 1,
                ["lifecycleRiskCount"] = 1,
                ["compatibilityConflictCount"] = 1,
                ["licenseReviewRequiredCount"] = 1,
                ["licenseProhibitedCount"] = 0,
                ["securityReviewRequiredCount"] = 1,
                ["securityNonconformantCount"] = 0,
                ["exceptionCandidateCount"] = 1,
                ["constraintConflictCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleImplementationUnitModelCount"] = 0,
                ["staleDependencyMappingCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more technology-profile candidates require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "technology-profile-status-is-observational-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-profile-selection-compatibility-assessment-snapshot-digests-only-not-technology-names-versions-constraints-evidence-rationale-unit-architecture-repository-toolchain-license-security-policy-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "technology-profile-projection-is-read-only-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["unitProfileCount"] = 4;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBoilerplateRegistryAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeImplementationUnitModelBinding,
        bool forgeTechnologyProfileBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BOILERPLATE REGISTRY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T17:30:00.000Z";
        var candidateDigest = $"sha256:{new string('3', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = BoilerplateRegistryId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["entryCatalogDigest"] = $"sha256:{new string('4', 64)}",
            ["sourceCatalogDigest"] = $"sha256:{new string('5', 64)}",
            ["compatibilityAssessmentReceiptDigest"] = $"sha256:{new string('6', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('7', 64)}",
            ["entryCount"] = 4,
            ["mandatoryCandidateCount"] = 2,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T17:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "boilerplate-registry-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "boilerplate-registry-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BoilerplateRegistryId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["implementationUnitModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ImplementationUnitModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeImplementationUnitModelBinding ? '4' : '5', 64)}",
                },
                ["technologyProfile"] = new Dictionary<string, object?>
                {
                    ["recordId"] = TechnologyProfileId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeTechnologyProfileBinding ? '7' : '6', 64)}",
                },
                ["entryCount"] = 4,
                ["exactVersionCandidateCount"] = 2,
                ["rangeVersionCandidateCount"] = 1,
                ["unresolvedVersionCount"] = 1,
                ["mandatoryCandidateCount"] = 2,
                ["missingEvidenceCount"] = 1,
                ["unavailableEntryCount"] = 1,
                ["integrityMismatchCount"] = 1,
                ["provenanceGapCount"] = 1,
                ["unsupportedEntryCount"] = 1,
                ["lifecycleRiskCount"] = 1,
                ["technologyConflictCount"] = 1,
                ["architectureConflictCount"] = 1,
                ["licenseReviewRequiredCount"] = 1,
                ["licenseProhibitedCount"] = 0,
                ["securityReviewRequiredCount"] = 1,
                ["securityNonconformantCount"] = 0,
                ["exceptionCandidateCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleImplementationUnitModelCount"] = 0,
                ["staleTechnologyProfileCount"] = 0,
                ["invalidRegistryCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Boilerplate Registry candidates require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "boilerplate-registry-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-entry-source-compatibility-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-capabilities-limitations-evidence-rationale-technology-unit-architecture-repository-template-license-security-policy-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "boilerplate-registry-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["entryCount"] = 5;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBoilerplateSelectionBindingAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeImplementationUnitModelBinding,
        bool forgeDependencyMappingBinding,
        bool forgeTechnologyProfileBinding,
        bool forgeBoilerplateRegistryBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BOILERPLATE SELECTION BINDING");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T18:30:00.000Z";
        var candidateDigest = $"sha256:{new string('8', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = BoilerplateSelectionBindingId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["unitDecisionCatalogDigest"] = $"sha256:{new string('9', 64)}",
            ["selectionReceiptDigest"] = $"sha256:{new string('a', 64)}",
            ["bindingReceiptDigest"] = $"sha256:{new string('b', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('c', 64)}",
            ["decisionCount"] = 4,
            ["selectedCandidateCount"] = 2,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T18:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "boilerplate-selection-binding-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "boilerplate-selection-binding-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BoilerplateSelectionBindingId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["implementationUnitModel"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ImplementationUnitModelId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeImplementationUnitModelBinding ? '4' : '5', 64)}",
                },
                ["dependencyMapping"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DependencyMappingId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeDependencyMappingBinding ? '8' : '9', 64)}",
                },
                ["technologyProfile"] = new Dictionary<string, object?>
                {
                    ["recordId"] = TechnologyProfileId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeTechnologyProfileBinding ? '7' : '6', 64)}",
                },
                ["boilerplateRegistry"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BoilerplateRegistryId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = $"sha256:{new string(forgeBoilerplateRegistryBinding ? '2' : '3', 64)}",
                },
                ["decisionCount"] = 4,
                ["selectedCandidateCount"] = 2,
                ["notApplicableCandidateCount"] = 1,
                ["deferredCandidateCount"] = 1,
                ["notAssessedCount"] = 0,
                ["missingUnitDecisionCount"] = 1,
                ["invalidSelectionCount"] = 1,
                ["registryGapCount"] = 1,
                ["profileMismatchCount"] = 1,
                ["unitScopeMismatchCount"] = 1,
                ["versionMismatchCount"] = 1,
                ["missingEvidenceCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleImplementationUnitModelCount"] = 0,
                ["staleDependencyMappingCount"] = 0,
                ["staleTechnologyProfileCount"] = 0,
                ["staleBoilerplateRegistryCount"] = 0,
                ["invalidCandidateCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Boilerplate Selection and Binding decisions require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "boilerplate-selection-binding-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-unit-decision-selection-binding-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-or-profile-identities-rationale-conditions-alternatives-deviations-evidence-decision-roles-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "boilerplate-selection-binding-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["decisionCount"] = 5;
        if (includePrivateField) result["rationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleBoilerplateCompatibilityValidationAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField,
        bool forgeImplementationUnitModelBinding,
        bool forgeDependencyMappingBinding,
        bool forgeTechnologyProfileBinding,
        bool forgeBoilerplateRegistryBinding,
        bool forgeBoilerplateSelectionBinding)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID BOILERPLATE COMPATIBILITY VALIDATION");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T19:30:00.000Z";
        var candidateDigest = $"sha256:{new string('d', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        Dictionary<string, object?> Reference(Guid recordId, char digestCharacter) => new()
        {
            ["recordId"] = recordId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = $"sha256:{new string(digestCharacter, 64)}",
        };
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = BoilerplateCompatibilityValidationId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["state"] = "candidate",
            ["validationSubjectCatalogDigest"] = $"sha256:{new string('1', 64)}",
            ["dimensionCatalogDigest"] = $"sha256:{new string('2', 64)}",
            ["evidenceReceiptDigest"] = $"sha256:{new string('3', 64)}",
            ["validationReceiptDigest"] = $"sha256:{new string('4', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('5', 64)}",
            ["subjectCount"] = 2,
            ["compatibleCandidateCount"] = 1,
            ["incompatibleCandidateCount"] = 0,
            ["exceptionCandidateCount"] = 1,
            ["notAssessedCount"] = 0,
            ["dimensionAssessmentCount"] = 28,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T19:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "boilerplate-compatibility-validation-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "boilerplate-compatibility-validation-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = BoilerplateCompatibilityValidationId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["implementationUnitModel"] = Reference(ImplementationUnitModelId, forgeImplementationUnitModelBinding ? '4' : '5'),
                ["dependencyMapping"] = Reference(DependencyMappingId, forgeDependencyMappingBinding ? '8' : '9'),
                ["technologyProfile"] = Reference(TechnologyProfileId, forgeTechnologyProfileBinding ? '7' : '6'),
                ["boilerplateRegistry"] = Reference(BoilerplateRegistryId, forgeBoilerplateRegistryBinding ? '2' : '3'),
                ["boilerplateSelectionBinding"] = Reference(BoilerplateSelectionBindingId, forgeBoilerplateSelectionBinding ? '7' : '8'),
                ["selectedBindingCount"] = 2,
                ["subjectCount"] = 2,
                ["compatibleCandidateCount"] = 1,
                ["incompatibleCandidateCount"] = 0,
                ["exceptionCandidateCount"] = 1,
                ["notAssessedCount"] = 0,
                ["dimensionAssessmentCount"] = 28,
                ["missingSubjectCount"] = 0,
                ["invalidSubjectCount"] = 1,
                ["missingDimensionCount"] = 0,
                ["missingEvidenceCount"] = 1,
                ["expiredAssessmentCount"] = 1,
                ["conflictingOutcomeCount"] = 0,
                ["selectionBindingGapCount"] = 0,
                ["staleBindingCount"] = 0,
                ["staleImplementationUnitModelCount"] = 0,
                ["staleDependencyMappingCount"] = 0,
                ["staleTechnologyProfileCount"] = 0,
                ["staleBoilerplateRegistryCount"] = 0,
                ["staleSelectionBindingCount"] = 0,
                ["invalidCandidateCount"] = 0,
                ["unresolvedQuestionCount"] = 2,
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Boilerplate Compatibility Validation subjects require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "boilerplate-compatibility-validation-status-is-observational-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-subject-dimension-evidence-validation-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-profile-entry-or-binding-identities-claims-evidence-assessors-personal-data-secrets-credentials-or-machine-paths",
            ["authorityBoundary"] =
                "boilerplate-compatibility-validation-projection-is-read-only-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["subjectCount"] = 3;
        if (includePrivateField) result["claim"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignSystemTokenContractAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN SYSTEM TOKEN CONTRACT");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T13:30:00.000Z";
        var candidateDigest = $"sha256:{new string('1', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignSystemTokenContractId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('2', 64)}",
            ["state"] = "candidate",
            ["designSystemCount"] = 2,
            ["tokenCount"] = 48,
            ["variableCollectionCount"] = 3,
            ["variableCount"] = 19,
            ["componentCount"] = 12,
            ["representedRequirementCount"] = 10,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T13:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-system-token-contract-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-system-token-contract-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignSystemTokenContractId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["designSystemCount"] = 2,
                ["tokenCount"] = 48,
                ["variableCollectionCount"] = 3,
                ["variableCount"] = 19,
                ["componentCount"] = 12,
                ["representedRequirementCount"] = 10,
                ["unresolvedRequirementCount"] = 2,
                ["unresolvedOwnershipCount"] = 1,
                ["unresolvedCatalogItemCount"] = 3,
                ["accessibilityReviewGapCount"] = 4,
                ["staleBindingCount"] = 0,
                ["stalePortableSnapshotCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 2,
                ["catalogCompletenessState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more Design Systems, Tokens, Variables, or Components remain unresolved" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["tokenCount"] = 49;
        if (includePrivateField) result["tokenValue"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleAccessibilityDesignRulesAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ACCESSIBILITY DESIGN RULES");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T14:30:00.000Z";
        var candidateDigest = $"sha256:{new string('3', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = AccessibilityDesignRulesId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('4', 64)}",
            ["state"] = "candidate",
            ["targetCount"] = 12,
            ["ruleCount"] = 18,
            ["checkCount"] = 24,
            ["representedRequirementCount"] = 10,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T14:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "accessibility-design-rules-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "accessibility-design-rules-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = AccessibilityDesignRulesId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["targetCount"] = 12,
                ["ruleCount"] = 18,
                ["checkCount"] = 24,
                ["applicableRuleCount"] = 14,
                ["notApplicableRuleCount"] = 2,
                ["unresolvedRuleCount"] = 2,
                ["notAssessedCheckCount"] = 4,
                ["evidenceRecordedCheckCount"] = 3,
                ["humanReviewedCheckCount"] = 17,
                ["contradictedCheckCount"] = 1,
                ["representedRequirementCount"] = 10,
                ["unresolvedRequirementCount"] = 2,
                ["unresolvedOwnershipCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["catalogCompletenessState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more accessibility rules retain unresolved applicability or impact" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["ruleCount"] = 19;
        if (includePrivateField) result["ruleProcedure"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleResponsiveMultiPlatformTargetsAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID RESPONSIVE MULTI PLATFORM TARGETS");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T15:30:00.000Z";
        var candidateDigest = $"sha256:{new string('5', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = ResponsiveMultiPlatformTargetsId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('6', 64)}",
            ["state"] = "candidate",
            ["platformTargetCount"] = 3,
            ["breakpointCount"] = 5,
            ["behaviorCount"] = 14,
            ["checkCount"] = 22,
            ["representedRequirementCount"] = 10,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T15:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "responsive-multi-platform-targets-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "responsive-multi-platform-targets-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ResponsiveMultiPlatformTargetsId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["platformTargetCount"] = 3,
                ["breakpointCount"] = 5,
                ["behaviorCount"] = 14,
                ["checkCount"] = 22,
                ["applicableBehaviorCount"] = 12,
                ["unresolvedBehaviorCount"] = 2,
                ["notAssessedCheckCount"] = 3,
                ["evidenceRecordedCheckCount"] = 2,
                ["humanReviewedCheckCount"] = 17,
                ["contradictedCheckCount"] = 1,
                ["representedRequirementCount"] = 10,
                ["unresolvedRequirementCount"] = 2,
                ["unresolvedOwnershipCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["targetCatalogState"] = "candidate-complete",
                ["breakpointCatalogState"] = "not-assessed",
                ["behaviorCatalogState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "Responsive behavior and breakpoint catalogs retain unresolved review gaps" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["behaviorCount"] = 15;
        if (includePrivateField) result["behaviorProcedure"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleManualFigmaExecutionPathAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANUAL FIGMA EXECUTION PATH");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T18:30:00.000Z";
        var candidateDigest = $"sha256:{new string('7', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = ManualFigmaExecutionPathId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('8', 64)}",
            ["state"] = "candidate",
            ["scopeCount"] = 3,
            ["instructionCount"] = 5,
            ["checkCount"] = 24,
            ["representedRequirementCount"] = 10,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T18:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "manual-figma-execution-path-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "manual-figma-execution-path-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = ManualFigmaExecutionPathId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["scopeCount"] = 3,
                ["instructionCount"] = 5,
                ["checkCount"] = 24,
                ["notAssessedCheckCount"] = 3,
                ["evidenceRecordedCheckCount"] = 2,
                ["humanReviewedCheckCount"] = 19,
                ["contradictedCheckCount"] = 1,
                ["representedRequirementCount"] = 10,
                ["unresolvedRequirementCount"] = 2,
                ["unresolvedOwnershipCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["guideCatalogState"] = "candidate-complete",
                ["handoffCatalogState"] = "candidate-complete",
                ["returnContractState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "The manual return contract retains unresolved review gaps" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "manual-figma-execution-path-status-is-observational-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-handoff-content-instructions-figma-identifiers-returned-design-source-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["scopeCount"] = 4;
        if (includePrivateField) result["handoffContent"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleFigmaMcpCapabilityDiscoveryAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID FIGMA MCP CAPABILITY DISCOVERY");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T19:30:00.000Z";
        var candidateDigest = $"sha256:{new string('9', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = FigmaMcpCapabilityDiscoveryId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('a', 64)}",
            ["state"] = "candidate",
            ["toolCount"] = 7,
            ["advertisedToolCount"] = 5,
            ["readToolCount"] = 3,
            ["writeToolCount"] = 2,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T19:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "figma-mcp-capability-discovery-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "figma-mcp-capability-discovery-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = FigmaMcpCapabilityDiscoveryId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["toolCount"] = 7,
                ["advertisedToolCount"] = 5,
                ["unavailableToolCount"] = 1,
                ["unknownAvailabilityCount"] = 1,
                ["readToolCount"] = 3,
                ["writeToolCount"] = 2,
                ["unknownEffectCount"] = 1,
                ["notAssessedToolCount"] = 1,
                ["sourceRecordedToolCount"] = 2,
                ["humanReviewedToolCount"] = 4,
                ["unresolvedPermissionCount"] = 2,
                ["unresolvedLimitCount"] = 1,
                ["unresolvedVersionCount"] = 3,
                ["unresolvedOwnershipCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["catalogState"] = "candidate-observation-complete",
                ["permissionModelState"] = "candidate-separated",
                ["limitCatalogState"] = "not-assessed",
                ["versionCatalogState"] = "not-assessed",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more source-recorded candidate observations require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "figma-mcp-capability-discovery-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-tool-names-schemas-permissions-limits-versions-source-content-personal-content-secrets-credentials-or-figma-content",
            ["authorityBoundary"] =
                "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["toolCount"] = 8;
        if (includePrivateField) result["toolNames"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleFigmaReadSnapshotAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID FIGMA READ SNAPSHOT");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-28T20:30:00.000Z";
        var candidateDigest = $"sha256:{new string('b', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = FigmaReadSnapshotId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('c', 64)}",
            ["state"] = "candidate",
            ["fileCount"] = 2,
            ["componentCount"] = 12,
            ["variableCollectionCount"] = 3,
            ["variableCount"] = 18,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-28T20:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "figma-read-snapshot-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "figma-read-snapshot-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = FigmaReadSnapshotId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["fileCount"] = 2,
                ["componentCount"] = 12,
                ["variableCollectionCount"] = 3,
                ["variableCount"] = 18,
                ["sourceRecordedItemCount"] = 5,
                ["humanReviewedItemCount"] = 25,
                ["notAssessedItemCount"] = 5,
                ["staleFileCount"] = 1,
                ["unknownFreshnessFileCount"] = 1,
                ["unresolvedTypeCount"] = 2,
                ["unresolvedOwnershipCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["snapshotCompletenessState"] = "partial",
                ["provenanceState"] = "partial",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more source-recorded snapshot observations require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "figma-read-snapshot-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-file-component-variable-names-external-identities-values-source-content-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["fileCount"] = 3;
        if (includePrivateField) result["fileNames"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleFigmaContextImportAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID FIGMA CONTEXT IMPORT");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T09:30:00.000Z";
        var candidateDigest = $"sha256:{new string('d', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = FigmaContextImportId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('e', 64)}",
            ["state"] = "candidate",
            ["contextPackCount"] = 2,
            ["sectionCount"] = 8,
            ["contextItemCount"] = 24,
            ["targetCount"] = 2,
            ["representedRequirementCount"] = 7,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-29T09:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "figma-context-import-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "figma-context-import-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = FigmaContextImportId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["contextPackCount"] = 2,
                ["sectionCount"] = 8,
                ["contextItemCount"] = 24,
                ["targetCount"] = 2,
                ["humanReviewedSectionCount"] = 5,
                ["sourceRecordedSectionCount"] = 2,
                ["notAssessedSectionCount"] = 1,
                ["unresolvedRedactionCount"] = 1,
                ["representedRequirementCount"] = 7,
                ["unresolvedRequirementCount"] = 2,
                ["unresolvedOwnershipCount"] = 1,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["contextSelectionState"] = "partial",
                ["provenanceState"] = "partial",
                ["previewState"] = "candidate-generated",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more selected sections require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "figma-context-import-status-is-observational-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-or-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["contextItemCount"] = 25;
        if (includePrivateField) result["contextItems"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleOutboundDesignBriefPackageAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID OUTBOUND DESIGN BRIEF PACKAGE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T10:30:00.000Z";
        var candidateDigest = $"sha256:{new string('f', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = OutboundDesignBriefPackageId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('a', 64)}",
            ["state"] = "candidate",
            ["manifestFormat"] = "gaep-outbound-design-brief-package-v1",
            ["manifestDigest"] = $"sha256:{new string('b', 64)}",
            ["payloadDigest"] = $"sha256:{new string('c', 64)}",
            ["contextPackCount"] = 2,
            ["entryCount"] = 8,
            ["contextItemCount"] = 24,
            ["recipientCount"] = 2,
            ["representedRequirementCount"] = 7,
            ["unresolvedDisclosureCount"] = 3,
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-29T10:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "outbound-design-brief-package-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "outbound-design-brief-package-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = OutboundDesignBriefPackageId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["contextPackCount"] = 2,
                ["entryCount"] = 8,
                ["contextItemCount"] = 24,
                ["recipientCount"] = 2,
                ["humanReviewedEntryCount"] = 5,
                ["sourceRecordedEntryCount"] = 2,
                ["notAssessedEntryCount"] = 1,
                ["unresolvedRedactionCount"] = 1,
                ["representedRequirementCount"] = 7,
                ["unresolvedRequirementCount"] = 2,
                ["unresolvedDisclosureCount"] = 3,
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["manifestState"] = "partial",
                ["provenanceState"] = "partial",
                ["redactionReviewState"] = "partial",
                ["previewState"] = "candidate-generated",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more outbound package entries require human review" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "outbound-design-brief-package-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-transformation-disclosure-or-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["contextItemCount"] = 25;
        if (includePrivateField) result["entries"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleGovernedFigmaWriteAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID GOVERNED FIGMA WRITE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T14:00:00.000Z";
        var candidateDigest = $"sha256:{new string('1', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = GovernedFigmaWriteId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('2', 64)}",
            ["state"] = "candidate",
            ["requestFormat"] = "gaep-governed-figma-write-request-v1",
            ["requestDigest"] = $"sha256:{new string('3', 64)}",
            ["effectDigest"] = $"sha256:{new string('4', 64)}",
            ["outboundPackage"] = new Dictionary<string, object?>
            {
                ["recordId"] = OutboundDesignBriefPackageId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('5', 64)}",
                ["membershipDigest"] = $"sha256:{new string('6', 64)}",
                ["manifestDigest"] = $"sha256:{new string('7', 64)}",
                ["payloadDigest"] = $"sha256:{new string('8', 64)}",
            },
            ["externalFileIdentityDigest"] = $"sha256:{new string('9', 64)}",
            ["expectedExternalVersionDigest"] = $"sha256:{new string('a', 64)}",
            ["selectedEntryCount"] = 8,
            ["previewState"] = "candidate-generated",
            ["previewDigest"] = $"sha256:{new string('b', 64)}",
            ["approvalState"] = "pending",
            ["permissionEvidenceState"] = "missing",
            ["idempotencyState"] = "defined",
            ["recoveryPlanState"] = "defined",
            ["reviewState"] = "held",
            ["writeExecutionState"] = "not-performed",
            ["updatedAt"] = "2026-07-29T13:59:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "governed-figma-write-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "governed-figma-write-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = GovernedFigmaWriteId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["selectedEntryCount"] = 8,
                ["unresolvedDisclosureCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["previewState"] = "candidate-generated",
                ["approvalState"] = "pending",
                ["permissionEvidenceState"] = "missing",
                ["idempotencyState"] = "defined",
                ["replayProtectionState"] = "defined",
                ["recoveryPlanState"] = "defined",
                ["writePlanState"] = "held",
                ["reviewState"] = "held",
                ["writeExecutionState"] = "not-performed",
                ["writeResultState"] = "not-recorded",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "Exact permission evidence is missing" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "governed-figma-write-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-approval-actor-permission-evidence-recovery-or-personal-content-secrets-or-credentials",
            ["authorityBoundary"] =
                "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["selectedEntryCount"] = 9;
        if (includePrivateField) result["approvalActor"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleFinalizedFigmaSnapshotImportAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID FINALIZED FIGMA SNAPSHOT IMPORT");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T15:30:00.000Z";
        var candidateDigest = $"sha256:{new string('c', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var governedWrite = new Dictionary<string, object?>
        {
            ["recordId"] = GovernedFigmaWriteId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = $"sha256:{new string('1', 64)}",
            ["membershipDigest"] = $"sha256:{new string('2', 64)}",
            ["requestDigest"] = $"sha256:{new string('3', 64)}",
            ["effectDigest"] = $"sha256:{new string('4', 64)}",
            ["externalFileIdentityDigest"] = $"sha256:{new string('5', 64)}",
            ["expectedExternalVersionDigest"] = $"sha256:{new string('6', 64)}",
        };
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = FinalizedFigmaSnapshotImportId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('7', 64)}",
            ["state"] = "candidate",
            ["governedWrite"] = governedWrite,
            ["externalFileIdentityDigest"] = $"sha256:{new string('5', 64)}",
            ["returnedExternalVersionDigest"] = $"sha256:{new string('8', 64)}",
            ["payloadDigest"] = $"sha256:{new string('9', 64)}",
            ["receiptDigest"] = $"sha256:{new string('a', 64)}",
            ["reconciliationDigest"] = $"sha256:{new string('b', 64)}",
            ["itemCount"] = 18,
            ["conflictCount"] = 4,
            ["returnAuthorizationState"] = "missing",
            ["reconciliationState"] = "partial",
            ["provenanceState"] = "partial",
            ["reviewState"] = "held",
            ["importExecutionState"] = "not-performed",
            ["updatedAt"] = "2026-07-29T15:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "finalized-figma-snapshot-import-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "finalized-figma-snapshot-import-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = FinalizedFigmaSnapshotImportId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["itemCount"] = 18,
                ["humanReviewedItemCount"] = 12,
                ["sourceRecordedItemCount"] = 4,
                ["notAssessedItemCount"] = 2,
                ["openConflictCount"] = 3,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 5,
                ["returnAuthorizationState"] = "missing",
                ["reconciliationState"] = "partial",
                ["provenanceState"] = "partial",
                ["snapshotCompletenessState"] = "partial",
                ["reviewState"] = "held",
                ["importExecutionState"] = "not-performed",
                ["importResultState"] = "not-recorded",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "Exact return authorization is missing" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-names-external-identities-source-content-authorization-actor-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["itemCount"] = 19;
        if (includePrivateField) result["authorizationActor"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignToRequirementBindingAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN TO REQUIREMENT BINDING");
            return;
        }
        static Dictionary<string, object?> Dependency(
            Guid recordId,
            int revision,
            string catalogProperty,
            char digestSeed,
            char membershipSeed,
            char catalogSeed) => new()
            {
                ["recordId"] = recordId.ToString("D"),
                ["revision"] = revision,
                ["digest"] = $"sha256:{new string(digestSeed, 64)}",
                ["membershipDigest"] = $"sha256:{new string(membershipSeed, 64)}",
                [catalogProperty] = $"sha256:{new string(catalogSeed, 64)}",
            };
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T16:30:00.000Z";
        var candidateDigest = $"sha256:{new string('d', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignToRequirementBindingId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('e', 64)}",
            ["state"] = "candidate",
            ["finalizedSnapshot"] = Dependency(FinalizedFigmaSnapshotImportId, 2, "itemCatalogDigest", '1', '2', '3'),
            ["designRequirements"] = Dependency(DesignRequirementsId, 3, "requirementCatalogDigest", '4', '5', '6'),
            ["decisionRegister"] = Dependency(DecisionRegisterId, 4, "decisionCatalogDigest", '7', '8', '9'),
            ["reconciliationDigest"] = $"sha256:{new string('a', 64)}",
            ["bindingCount"] = 7,
            ["designItemCoverageCount"] = 4,
            ["subjectCoverageCount"] = 5,
            ["conflictCount"] = 3,
            ["reconciliationState"] = "partial",
            ["candidateCoverageState"] = "partial",
            ["provenanceState"] = "exact",
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-29T16:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-to-requirement-binding-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-to-requirement-binding-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignToRequirementBindingId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["bindingCount"] = 7,
                ["humanReviewedBindingCount"] = 5,
                ["designItemCount"] = 4,
                ["boundDesignItemCount"] = 3,
                ["unboundDesignItemCount"] = 1,
                ["requirementCount"] = 3,
                ["boundRequirementCount"] = 2,
                ["unboundRequirementCount"] = 1,
                ["decisionCount"] = 2,
                ["boundDecisionCount"] = 1,
                ["unboundDecisionCount"] = 1,
                ["openConflictCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["reconciliationState"] = "partial",
                ["candidateCoverageState"] = "partial",
                ["provenanceState"] = "exact",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more governed subjects remain unbound" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-external-identities-requirement-text-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["bindingCount"] = 8;
        if (includePrivateField) result["humanAttribution"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignerReadyGateAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGNER READY GATE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T22:25:00.000Z";
        var candidateDigest = $"sha256:{new string('1', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignerReadyGateId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('2', 64)}",
            ["state"] = "candidate",
            ["prerequisiteCount"] = 12,
            ["prerequisiteCatalogDigest"] = $"sha256:{new string('3', 64)}",
            ["evaluationCatalogDigest"] = $"sha256:{new string('4', 64)}",
            ["exceptionCatalogDigest"] = $"sha256:{new string('5', 64)}",
            ["assessmentDefinitionDigest"] = $"sha256:{new string('6', 64)}",
            ["assessmentReceiptDigest"] = $"sha256:{new string('7', 64)}",
            ["candidateResult"] = "incomplete",
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-29T22:24:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "designer-ready-gate-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "designer-ready-gate-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignerReadyGateId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["prerequisiteCount"] = 12,
                ["satisfiedCount"] = 9,
                ["notApplicableCount"] = 1,
                ["unsatisfiedCount"] = 1,
                ["notAssessedCount"] = 1,
                ["staleOrUnknownCount"] = 2,
                ["humanReviewedCount"] = 10,
                ["pendingExceptionCount"] = 1,
                ["grantedExceptionCandidateCount"] = 1,
                ["invalidExceptionCount"] = 1,
                ["staleBindingCount"] = 2,
                ["staleSourceReferenceCount"] = 3,
                ["unresolvedQuestionCount"] = 4,
                ["candidateResult"] = "incomplete",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more prerequisites remain incomplete" },
                ["assessedAt"] = assessedAt,
                ["gateBoundary"] =
                    "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness",
                ["authorityBoundary"] =
                    "designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) candidate["prerequisiteCount"] = 11;
        if (includePrivateField) result["criteria"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignDeltaAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN DELTA");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-29T23:12:00.000Z";
        var candidateDigest = $"sha256:{new string('8', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignDeltaId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('9', 64)}",
            ["state"] = "candidate",
            ["designerReadyGate"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignerReadyGateId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('1', 64)}",
                ["membershipDigest"] = $"sha256:{new string('2', 64)}",
                ["prerequisiteCatalogDigest"] = $"sha256:{new string('3', 64)}",
                ["assessmentReceiptDigest"] = $"sha256:{new string('4', 64)}",
                ["candidateResult"] = "incomplete",
            },
            ["finalizedSnapshot"] = new Dictionary<string, object?>
            {
                ["recordId"] = FinalizedFigmaSnapshotImportId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('5', 64)}",
                ["membershipDigest"] = $"sha256:{new string('6', 64)}",
                ["itemCatalogDigest"] = $"sha256:{new string('7', 64)}",
                ["reconciliationDigest"] = $"sha256:{new string('8', 64)}",
                ["reviewState"] = "held",
            },
            ["designBinding"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignToRequirementBindingId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('9', 64)}",
                ["membershipDigest"] = $"sha256:{new string('a', 64)}",
                ["bindingCatalogDigest"] = $"sha256:{new string('b', 64)}",
                ["reconciliationDigest"] = $"sha256:{new string('c', 64)}",
                ["reviewState"] = "held",
            },
            ["sourceSnapshotDigest"] = $"sha256:{new string('d', 64)}",
            ["targetSnapshotDigest"] = $"sha256:{new string('e', 64)}",
            ["comparisonDefinitionDigest"] = $"sha256:{new string('f', 64)}",
            ["comparisonReceiptDigest"] = $"sha256:{new string('0', 64)}",
            ["deltaCatalogDigest"] = $"sha256:{new string('1', 64)}",
            ["deltaCount"] = 6,
            ["comparisonState"] = "partial",
            ["provenanceState"] = "partial",
            ["candidateResult"] = "conflict-candidate",
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-29T23:11:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-delta-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-delta-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignDeltaId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["sourceItemCount"] = 12,
                ["targetItemCount"] = 14,
                ["deltaCount"] = 6,
                ["addedCount"] = 2,
                ["changedCount"] = 1,
                ["conflictingCount"] = 1,
                ["missingCount"] = 1,
                ["staleCount"] = 1,
                ["unmappedCount"] = 0,
                ["humanReviewedCount"] = 3,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedMappingCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["comparisonState"] = "partial",
                ["provenanceState"] = "partial",
                ["candidateResult"] = "conflict-candidate",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "The candidate contains an unresolved conflicting delta" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) ((Dictionary<string, object?>)result["status"]!)["deltaCount"] = 5;
        if (includePrivateField) result["deltaContent"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignConflictResolutionAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN CONFLICT RESOLUTION");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T00:10:00.000Z";
        var candidateDigest = $"sha256:{new string('2', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignConflictResolutionId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('3', 64)}",
            ["state"] = "candidate",
            ["designDelta"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignDeltaId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('8', 64)}",
                ["membershipDigest"] = $"sha256:{new string('9', 64)}",
                ["deltaCatalogDigest"] = $"sha256:{new string('1', 64)}",
                ["comparisonReceiptDigest"] = $"sha256:{new string('0', 64)}",
                ["conflictingCount"] = 5,
                ["candidateResult"] = "conflict-candidate",
                ["reviewState"] = "ready-for-human-review",
            },
            ["resolutionDefinitionDigest"] = $"sha256:{new string('4', 64)}",
            ["resolutionReceiptDigest"] = $"sha256:{new string('5', 64)}",
            ["resolutionCatalogDigest"] = $"sha256:{new string('6', 64)}",
            ["conflictCount"] = 5,
            ["resolutionCount"] = 4,
            ["coverageState"] = "partial",
            ["provenanceState"] = "partial",
            ["candidateResult"] = "escalation-plan-candidate",
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T00:09:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-conflict-resolution-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-conflict-resolution-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignConflictResolutionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["conflictCount"] = 5,
                ["resolutionCount"] = 4,
                ["acceptSourceCount"] = 1,
                ["acceptTargetCount"] = 1,
                ["mergeCount"] = 1,
                ["rejectChangeCount"] = 0,
                ["escalateCount"] = 1,
                ["humanReviewedCount"] = 3,
                ["distinctActorDeclaredCount"] = 2,
                ["expiredCandidateCount"] = 1,
                ["unresolvedConflictCount"] = 1,
                ["unresolvedQuestionCount"] = 2,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["coverageState"] = "partial",
                ["provenanceState"] = "partial",
                ["candidateResult"] = "escalation-plan-candidate",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "The candidate records unresolved design conflicts" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) ((Dictionary<string, object?>)result["status"]!)["resolutionCount"] = 3;
        if (includePrivateField) result["resolutionContent"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleHumanDesignApprovalAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID HUMAN DESIGN APPROVAL");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T00:55:00.000Z";
        var candidateDigest = $"sha256:{new string('2', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = HumanDesignApprovalId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('3', 64)}",
            ["state"] = "candidate",
            ["prerequisiteCatalogDigest"] = $"sha256:{new string('4', 64)}",
            ["subject"] = new Dictionary<string, object?>
            {
                ["kind"] = "finalized-figma-snapshot-import-candidate",
                ["recordId"] = FinalizedFigmaSnapshotImportId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('5', 64)}",
                ["membershipDigest"] = $"sha256:{new string('6', 64)}",
                ["externalFileIdentityDigest"] = $"sha256:{new string('7', 64)}",
                ["returnedExternalVersionDigest"] = $"sha256:{new string('8', 64)}",
                ["itemCatalogDigest"] = $"sha256:{new string('9', 64)}",
                ["itemCount"] = 18,
            },
            ["scopeDigest"] = $"sha256:{new string('a', 64)}",
            ["decisionDefinitionDigest"] = $"sha256:{new string('b', 64)}",
            ["decisionReceiptDigest"] = $"sha256:{new string('c', 64)}",
            ["decisionKind"] = "approve-candidate",
            ["decisionDigest"] = $"sha256:{new string('d', 64)}",
            ["decisionLifecycleState"] = "active-candidate",
            ["candidateResult"] = "approved-candidate",
            ["reviewState"] = "recorded-human-decision",
            ["updatedAt"] = "2026-07-30T00:54:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "human-design-approval-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "human-design-approval-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = HumanDesignApprovalId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["prerequisiteCount"] = 5,
                ["completePrerequisiteCount"] = 4,
                ["decisionCount"] = 1,
                ["approveCount"] = 1,
                ["rejectCount"] = 0,
                ["requestChangeCount"] = 0,
                ["abstainCount"] = 0,
                ["expiredDecisionCount"] = 1,
                ["revokedDecisionCount"] = 0,
                ["staleBindingCount"] = 1,
                ["staleSourceReferenceCount"] = 2,
                ["unresolvedQuestionCount"] = 3,
                ["candidateResult"] = "approved-candidate",
                ["reviewState"] = "recorded-human-decision",
                ["approverAuthorityState"] = "not-established",
                ["separationOfDutiesEnforcementState"] = "not-established",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "The recorded human design decision candidate is expired" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) ((Dictionary<string, object?>)result["status"]!)["completePrerequisiteCount"] = 5;
        if (includePrivateField) result["decisionRationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignBaselineAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN BASELINE");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T01:40:00.000Z";
        var candidateDigest = $"sha256:{new string('e', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var subject = new Dictionary<string, object?>
        {
            ["kind"] = "finalized-figma-snapshot-import-candidate",
            ["recordId"] = FinalizedFigmaSnapshotImportId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = $"sha256:{new string('5', 64)}",
            ["membershipDigest"] = $"sha256:{new string('6', 64)}",
            ["externalFileIdentityDigest"] = $"sha256:{new string('7', 64)}",
            ["returnedExternalVersionDigest"] = $"sha256:{new string('8', 64)}",
            ["itemCatalogDigest"] = $"sha256:{new string('9', 64)}",
            ["itemCount"] = 18,
        };
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignBaselineId.ToString("D"),
            ["revision"] = 3,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('f', 64)}",
            ["state"] = "candidate",
            ["humanDesignApproval"] = new Dictionary<string, object?>
            {
                ["kind"] = "human-design-approval-candidate",
                ["recordId"] = HumanDesignApprovalId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('2', 64)}",
                ["membershipDigest"] = $"sha256:{new string('3', 64)}",
                ["decisionReceiptDigest"] = $"sha256:{new string('c', 64)}",
                ["subjectDigest"] = $"sha256:{new string('5', 64)}",
                ["scopeDigest"] = $"sha256:{new string('a', 64)}",
                ["candidateResult"] = "approved-candidate",
                ["reviewState"] = "recorded-human-decision",
                ["assessmentDigest"] = $"sha256:{new string('1', 64)}",
                ["assessmentState"] = "complete-for-recorded-decision",
            },
            ["subject"] = subject,
            ["scopeDigest"] = $"sha256:{new string('a', 64)}",
            ["baselineLineageId"] = "85858585-8585-4585-8585-858585858585",
            ["candidateSetId"] = "86868686-8686-4686-8686-868686868686",
            ["candidateSetRevision"] = 3,
            ["semanticVersion"] = "2.0.0",
            ["versionPolicyDigest"] = $"sha256:{new string('2', 64)}",
            ["designationDefinitionDigest"] = $"sha256:{new string('3', 64)}",
            ["designationReceiptDigest"] = $"sha256:{new string('4', 64)}",
            ["designationKind"] = "supersede-baseline-candidate",
            ["designationDigest"] = $"sha256:{new string('5', 64)}",
            ["supersedes"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignBaselineId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('6', 64)}",
                ["membershipDigest"] = $"sha256:{new string('7', 64)}",
                ["baselineLineageId"] = "85858585-8585-4585-8585-858585858585",
                ["semanticVersion"] = "1.0.0",
            },
            ["candidateResult"] = "supersession-candidate",
            ["reviewState"] = "ready-for-human-review",
            ["updatedAt"] = "2026-07-30T01:39:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-baseline-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-baseline-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignBaselineId.ToString("D"),
                    ["revision"] = 3,
                    ["digest"] = candidateDigest,
                },
                ["candidateSetCount"] = 1,
                ["designationCandidateCount"] = 1,
                ["supersessionCandidateCount"] = 1,
                ["withdrawalCandidateCount"] = 0,
                ["restorationCandidateCount"] = 0,
                ["expiredDesignationCount"] = 1,
                ["staleBindingCount"] = 2,
                ["staleSourceReferenceCount"] = 3,
                ["unresolvedQuestionCount"] = 4,
                ["candidateResult"] = "supersession-candidate",
                ["reviewState"] = "ready-for-human-review",
                ["approvalDeterminationState"] = "not-established",
                ["baselineDesignationState"] = "not-established",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "The baseline designation candidate is expired" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-baseline-status-is-observational-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-version-axes-counts-results-and-digests-only-not-design-content-rationale-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) ((Dictionary<string, object?>)result["status"]!)["candidateSetCount"] = 0;
        if (includePrivateField) result["designRationale"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleDesignDriftDetectionAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgeProductBinding,
        bool mutateAfterDigest,
        bool includePrivateField)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DESIGN DRIFT");
            return;
        }
        var productRevision = forgeProductBinding ? 8 : 7;
        var assessedAt = "2026-07-30T03:30:00.000Z";
        var candidateDigest = $"sha256:{new string('4', 64)}";
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var candidate = new Dictionary<string, object?>
        {
            ["id"] = DesignDriftDetectionId.ToString("D"),
            ["revision"] = 2,
            ["digest"] = candidateDigest,
            ["membershipDigest"] = $"sha256:{new string('5', 64)}",
            ["state"] = "candidate",
            ["designBaseline"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignBaselineId.ToString("D"),
                ["revision"] = 3,
                ["digest"] = $"sha256:{new string('e', 64)}",
                ["membershipDigest"] = $"sha256:{new string('f', 64)}",
                ["baselineLineageId"] = "85858585-8585-4585-8585-858585858585",
                ["candidateSetId"] = "86868686-8686-4686-8686-868686868686",
                ["candidateSetRevision"] = 3,
                ["semanticVersion"] = "2.0.0",
                ["designationReceiptDigest"] = $"sha256:{new string('4', 64)}",
                ["baselineDesignationState"] = "not-established",
            },
            ["returnedFigmaSnapshot"] = new Dictionary<string, object?>
            {
                ["recordId"] = FinalizedFigmaSnapshotImportId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('5', 64)}",
                ["membershipDigest"] = $"sha256:{new string('6', 64)}",
                ["externalFileIdentityDigest"] = $"sha256:{new string('7', 64)}",
                ["returnedExternalVersionDigest"] = $"sha256:{new string('8', 64)}",
                ["itemCatalogDigest"] = $"sha256:{new string('9', 64)}",
            },
            ["designRequirements"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignRequirementsId.ToString("D"),
                ["revision"] = 3,
                ["digest"] = $"sha256:{new string('a', 64)}",
                ["membershipDigest"] = $"sha256:{new string('b', 64)}",
                ["requirementCatalogDigest"] = $"sha256:{new string('c', 64)}",
            },
            ["designTrace"] = new Dictionary<string, object?>
            {
                ["recordId"] = DesignToRequirementBindingId.ToString("D"),
                ["revision"] = 2,
                ["digest"] = $"sha256:{new string('d', 64)}",
                ["membershipDigest"] = $"sha256:{new string('e', 64)}",
                ["reconciliationDigest"] = $"sha256:{new string('f', 64)}",
            },
            ["implementationTargetCatalogRevision"] = 2,
            ["implementationTargetCatalogDigest"] = $"sha256:{new string('0', 64)}",
            ["comparisonPolicyDigest"] = $"sha256:{new string('1', 64)}",
            ["comparisonDigest"] = $"sha256:{new string('2', 64)}",
            ["implementationTargetCount"] = 5,
            ["observationCount"] = 9,
            ["remediationCandidateCount"] = 4,
            ["candidateResult"] = "incomplete",
            ["reviewState"] = "held",
            ["updatedAt"] = "2026-07-30T03:29:00.000Z",
        };
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "design-drift-detection-projection",
            ["product"] = new Dictionary<string, object?>
            {
                ["id"] = ProductId.ToString("D"),
                ["revision"] = productRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(productRevision))),
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["id"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord)),
                ["state"] = "active",
            },
            ["status"] = new Dictionary<string, object?>
            {
                ["schemaVersion"] = 1,
                ["kind"] = "design-drift-detection-status",
                ["productId"] = ProductId.ToString("D"),
                ["productRevision"] = productRevision,
                ["initiativeId"] = InitiativeId.ToString("D"),
                ["initiativeRevision"] = initiativeRevision,
                ["candidate"] = new Dictionary<string, object?>
                {
                    ["recordId"] = DesignDriftDetectionId.ToString("D"),
                    ["revision"] = 2,
                    ["digest"] = candidateDigest,
                },
                ["implementationTargetCount"] = 5,
                ["humanReviewedImplementationTargetCount"] = 4,
                ["observationCount"] = 9,
                ["humanReviewedObservationCount"] = 8,
                ["requirementToDesignCount"] = 4,
                ["designToImplementationCount"] = 5,
                ["conformantCount"] = 3,
                ["driftCount"] = 5,
                ["unassessedCount"] = 1,
                ["blockerCount"] = 1,
                ["highSeverityCount"] = 2,
                ["remediationCandidateCount"] = 4,
                ["expiredRemediationCandidateCount"] = 1,
                ["staleBindingCount"] = 2,
                ["staleSourceReferenceCount"] = 3,
                ["unresolvedQuestionCount"] = 1,
                ["candidateResult"] = "incomplete",
                ["reviewState"] = "held",
                ["state"] = "attention-required",
                ["reasons"] = new[] { "One or more exact comparison subjects remain not assessed" },
                ["assessedAt"] = assessedAt,
                ["authorityBoundary"] =
                    "design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
            },
            ["candidate"] = candidate,
            ["observedAt"] = assessedAt,
            ["privacyBoundary"] =
                "projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
            ["authorityBoundary"] =
                "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
        };
        RefreshCanonicalDigest(result, "snapshotDigest");
        if (mutateAfterDigest) ((Dictionary<string, object?>)result["status"]!)["observationCount"] = 8;
        if (includePrivateField) result["implementationContent"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, result);
    }

    private static async Task HandleAssessInitiativeEntryAsync(
        long id,
        JsonElement parameters,
        long revision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool forgedAuthority,
        bool forgedProductBinding,
        bool omitCompleteness,
        bool omitCoverage)
    {
        if (!HasOnlyProperties(parameters, "initiativeId") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID INITIATIVE ASSESSMENT");
            return;
        }
        var classificationDigest = classification is null
            ? null
            : CanonicalDigest(JsonSerializer.SerializeToElement(classification));
        var applicabilityDigest = applicability is null
            ? null
            : CanonicalDigest(JsonSerializer.SerializeToElement(applicability));
        var decisions = applicability is null
            ? Array.Empty<JsonElement>()
            : JsonSerializer.SerializeToElement(applicability["decisions"]).EnumerateArray().ToArray();
        var unresolvedCount = applicability is null
            ? 0
            : JsonSerializer.SerializeToElement(applicability["unresolvedSubjects"]).GetArrayLength();
        var pendingHuman = decisions.Count(decision => decision.GetProperty("status").GetString() == "awaiting-human-decision");
        var blocked = decisions.Count(decision => decision.GetProperty("status").GetString() == "blocked");
        var pendingApproval = decisions.Count(decision => decision.GetProperty("approval").GetProperty("state").GetString() == "pending");
        var rejectedApproval = decisions.Count(decision => decision.GetProperty("approval").GetProperty("state").GetString() == "rejected");
        var coveredSubjects = Math.Min(decisions.Length + unresolvedCount, SubjectCatalogCount);
        var missingSubjects = classification is null ? 0 : SubjectCatalogCount - coveredSubjects;
        var reasons = new List<string>();
        if (classification is null) reasons.Add("Initiative classification is missing");
        if (applicability is null) reasons.Add("Initiative applicability is missing");
        if (applicability is not null && missingSubjects > 0)
            reasons.Add("Initiative applicability does not cover every canonical subject");
        if (unresolvedCount > 0) reasons.Add("Initiative applicability has unresolved subjects");
        if (pendingHuman > 0) reasons.Add("Initiative applicability awaits human decisions");
        if (blocked > 0) reasons.Add("Initiative applicability contains blocked decisions");
        if (pendingApproval > 0) reasons.Add("Initiative applicability has pending approvals");
        if (rejectedApproval > 0) reasons.Add("Initiative applicability has rejected approvals");
        var result = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "initiative-entry-assessment",
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["initiativeRevision"] = revision,
            ["productId"] = ProductId.ToString("D"),
            ["productRevision"] = 7,
            ["productDigest"] = forgedProductBinding
                ? $"sha256:{new string('f', 64)}"
                : CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7))),
            ["classification"] = classification is null
                ? new Dictionary<string, object?>
                {
                    ["status"] = "missing",
                    ["completeness"] = new Dictionary<string, object?>
                    {
                        ["status"] = "missing",
                        ["policyVersion"] = CompletenessPolicyVersion,
                        ["policyDigest"] = CompletenessPolicyDigest,
                        ["unknownDimensionCount"] = 0,
                        ["unresolvedQuestionCount"] = 0,
                        ["missingConditionalDimensionCount"] = 0,
                        ["confidenceSufficient"] = false,
                    },
                }
                : new Dictionary<string, object?>
                {
                    ["status"] = "current",
                    ["digest"] = classificationDigest,
                    ["completeness"] = new Dictionary<string, object?>
                    {
                        ["status"] = "complete",
                        ["policyVersion"] = CompletenessPolicyVersion,
                        ["policyDigest"] = CompletenessPolicyDigest,
                        ["unknownDimensionCount"] = 0,
                        ["unresolvedQuestionCount"] = 0,
                        ["missingConditionalDimensionCount"] = 0,
                        ["confidenceSufficient"] = true,
                    },
                },
            ["applicability"] = applicability is null
                ? new Dictionary<string, object?>
                {
                    ["status"] = "missing",
                    ["decisionCount"] = 0,
                    ["unresolvedSubjectCount"] = 0,
                    ["pendingHumanDecisionCount"] = 0,
                    ["blockedDecisionCount"] = 0,
                    ["pendingApprovalCount"] = 0,
                    ["rejectedApprovalCount"] = 0,
                    ["coverage"] = classification is null
                        ? new Dictionary<string, object?>
                        {
                            ["status"] = "unavailable",
                            ["subjectCount"] = 0,
                            ["coveredSubjectCount"] = 0,
                            ["missingSubjectCount"] = 0,
                            ["unexpectedSubjectCount"] = 0,
                            ["mismatchedSubjectCount"] = 0,
                        }
                        : new Dictionary<string, object?>
                        {
                            ["status"] = "missing",
                            ["catalogVersion"] = SubjectCatalogVersion,
                            ["catalogDigest"] = SubjectCatalogDigest,
                            ["subjectCount"] = SubjectCatalogCount,
                            ["coveredSubjectCount"] = 0,
                            ["missingSubjectCount"] = SubjectCatalogCount,
                            ["unexpectedSubjectCount"] = 0,
                            ["mismatchedSubjectCount"] = 0,
                        },
                }
                : new Dictionary<string, object?>
                {
                    ["status"] = "current",
                    ["matrixRevision"] = 1,
                    ["digest"] = applicabilityDigest,
                    ["decisionCount"] = decisions.Length,
                    ["unresolvedSubjectCount"] = unresolvedCount,
                    ["pendingHumanDecisionCount"] = pendingHuman,
                    ["blockedDecisionCount"] = blocked,
                    ["pendingApprovalCount"] = pendingApproval,
                    ["rejectedApprovalCount"] = rejectedApproval,
                    ["coverage"] = new Dictionary<string, object?>
                    {
                        ["status"] = missingSubjects == 0 ? "complete" : "incomplete",
                        ["catalogVersion"] = SubjectCatalogVersion,
                        ["catalogDigest"] = SubjectCatalogDigest,
                        ["subjectCount"] = SubjectCatalogCount,
                        ["coveredSubjectCount"] = coveredSubjects,
                        ["missingSubjectCount"] = missingSubjects,
                        ["unexpectedSubjectCount"] = 0,
                        ["mismatchedSubjectCount"] = 0,
                    },
                },
            ["state"] = reasons.Count == 0 ? "ready" : blocked > 0 || rejectedApproval > 0 ? "blocked" : "attention-required",
            ["reasons"] = reasons,
            ["assessedAt"] = "2026-07-25T01:05:00.000Z",
            ["authorityBoundary"] = forgedAuthority
                ? "assessment-grants-ready-authority"
                : "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
        };
        if (omitCompleteness && result["classification"] is Dictionary<string, object?> classificationAssessment)
            classificationAssessment.Remove("completeness");
        if (omitCoverage && result["applicability"] is Dictionary<string, object?> applicabilityAssessment)
            applicabilityAssessment.Remove("coverage");
        await WriteResultAsync(id, result);
    }

    private static async Task<Dictionary<string, object?>?> HandleClassifyInitiativeAsync(
        long id,
        JsonElement parameters,
        long revision,
        bool mismatchActor)
    {
        if (!HasOnlyProperties(parameters, "initiativeId", "expectedInitiativeRevision", "actorId", "classification") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != revision ||
            parameters.GetProperty("actorId").GetString() != "founder.review")
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID INITIATIVE CLASSIFICATION");
            return null;
        }
        var classification = parameters.GetProperty("classification").EnumerateObject()
            .ToDictionary(property => property.Name, property => (object?)property.Value.Clone(), StringComparer.Ordinal);
        classification["productProfile"] = "software";
        classification["productRevision"] = 7;
        classification["productDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        classification["completenessPolicyVersion"] = CompletenessPolicyVersion;
        classification["completenessPolicyDigest"] = CompletenessPolicyDigest;
        classification["classifiedBy"] = HumanActor(mismatchActor ? "hostile.actor" : "founder.review");
        classification["classifiedAt"] = "2026-07-25T01:01:00.000Z";
        classification["authorityBoundary"] =
            "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority";
        await WriteResultAsync(id, InitiativeRecord(revision + 1, classification, null));
        return classification;
    }

    private static async Task<Dictionary<string, object?>?> HandleResolveInitiativeApplicabilityAsync(
        long id,
        JsonElement parameters,
        long revision,
        Dictionary<string, object?>? classification,
        bool mismatchActor)
    {
        if (classification is null ||
            !HasOnlyProperties(parameters, "initiativeId", "expectedInitiativeRevision", "actorId", "applicability") ||
            parameters.GetProperty("initiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != revision ||
            parameters.GetProperty("actorId").GetString() != "founder.review")
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID INITIATIVE APPLICABILITY");
            return null;
        }
        var actor = mismatchActor ? "hostile.actor" : "founder.review";
        var input = parameters.GetProperty("applicability");
        var decisions = input.GetProperty("decisions").EnumerateArray().Select((decision, index) =>
        {
            var value = decision.EnumerateObject()
                .ToDictionary(property => property.Name, property => (object?)property.Value.Clone(), StringComparer.Ordinal);
            value["id"] = index == 0 ? InitiativeDecisionId.ToString("D") : Guid.NewGuid().ToString("D");
            value["revision"] = 1;
            value["initiativeRevision"] = revision + 1;
            value["decidedBy"] = HumanActor(actor);
            value["decidedAt"] = "2026-07-25T01:03:00.000Z";
            value["authorityBoundary"] =
                "applicability-decision-does-not-grant-approval-readiness-or-action-authority";
            return value;
        }).ToArray();
        var applicability = new Dictionary<string, object?>
        {
            ["decisions"] = decisions,
            ["unresolvedSubjects"] = input.GetProperty("unresolvedSubjects").Clone(),
            ["schemaVersion"] = 1,
            ["kind"] = "initiative-applicability-matrix",
            ["revision"] = 1,
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["productId"] = ProductId.ToString("D"),
            ["initiativeRevision"] = revision + 1,
            ["classificationDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(classification)),
            ["subjectCatalog"] = input.GetProperty("subjectCatalog").Clone(),
            ["state"] = "current",
            ["evaluatedBy"] = HumanActor(actor),
            ["evaluatedAt"] = "2026-07-25T01:03:00.000Z",
            ["authorityBoundary"] =
                "applicability-matrix-does-not-grant-approval-readiness-or-action-authority",
        };
        await WriteResultAsync(id, InitiativeRecord(revision + 1, classification, applicability));
        return applicability;
    }

    private static Dictionary<string, object?> InitiativeRecord(
        long revision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability)
    {
        var value = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["id"] = InitiativeId.ToString("D"),
            ["kind"] = "initiative",
            ["revision"] = revision,
            ["productId"] = ProductId.ToString("D"),
            ["title"] = "Private Initiative title",
            ["outcome"] = "Deliver governed Initiative entry truth",
            ["scope"] = new[] { "Initiative classification" },
            ["exclusions"] = Array.Empty<string>(),
            ["state"] = "active",
            ["createdAt"] = "2026-07-25T01:00:00.000Z",
            ["updatedAt"] = "2026-07-25T01:04:00.000Z",
        };
        if (classification is not null) value["classification"] = classification;
        if (applicability is not null) value["applicability"] = applicability;
        return value;
    }

    private static Dictionary<string, object?> HumanActor(string id) => new()
    {
        ["kind"] = "human",
        ["id"] = id,
    };

    private static async Task<Dictionary<string, object?>?> HandleSelectAgentAsync(long id, JsonElement parameters)
    {
        if (!HasOnlyProperties(parameters, "adapterId", "modelId", "settings", "actorId") ||
            parameters.GetProperty("adapterId").GetString() != "openai-codex" ||
            parameters.GetProperty("modelId").GetString() != "gpt-5.6-codex" ||
            parameters.GetProperty("actorId").GetString() is not ("founder.review" or "gaep.visual-studio-local-human") ||
            !HasOnlyProperties(parameters.GetProperty("settings"), "reasoningEffort") ||
            parameters.GetProperty("settings").GetProperty("reasoningEffort").GetString() != "high")
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SELECTION");
            return null;
        }
        var selection = AgentSelection(new Dictionary<string, object?> { ["reasoningEffort"] = "high" });
        await WriteResultAsync(id, selection);
        return selection;
    }

    private static Dictionary<string, object?> AgentSelection(Dictionary<string, object?>? settings = null) => new()
    {
        ["schemaVersion"] = 2,
        ["adapterId"] = "openai-codex",
        ["agentId"] = "codex",
        ["modelId"] = "gpt-5.6-codex",
        ["modelTruthClass"] = "observed",
        ["modelAlias"] = false,
        ["settings"] = settings ?? new Dictionary<string, object?> { ["reasoningEffort"] = "high" },
        ["selectedAt"] = "2026-07-24T08:05:00.000Z",
        ["capabilityDigest"] = $"sha256:{new string('e', 64)}",
    };

    private static Dictionary<string, object?> TargetAgentSelection()
    {
        var selection = AgentSelection(new Dictionary<string, object?> { ["reasoningEffort"] = "medium" });
        selection["modelId"] = "gpt-5.6-codex-next";
        selection["selectedAt"] = "2026-07-24T08:10:00.000Z";
        selection["capabilityDigest"] = $"sha256:{new string('f', 64)}";
        return selection;
    }

    private static Dictionary<string, object?> AgentRun(bool includePrivatePath = false)
    {
        var run = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["id"] = RunId.ToString("D"),
            ["revision"] = 3,
            ["charterId"] = CharterId.ToString("D"),
            ["charterDigest"] = $"sha256:{new string('1', 64)}",
            ["productId"] = ProductId.ToString("D"),
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["agent"] = AgentSelection(),
            ["state"] = "completed",
            ["providerSessionRef"] = $"sha256:{new string('2', 64)}",
            ["startedAt"] = "2026-07-24T08:00:00.000Z",
            ["endedAt"] = "2026-07-24T08:04:00.000Z",
        };
        if (includePrivatePath) run["runtimeExecutable"] = $"{PrivateRoot}/{PrivateCredential}";
        return run;
    }

    private static async Task<Dictionary<string, object?>?> HandleCreateHandoffAsync(
        long id,
        JsonElement parameters,
        bool includePrivatePath,
        bool mismatchTargetSetting)
    {
        if (!HasOnlyProperties(parameters, "actorId", "handoff") ||
            parameters.GetProperty("actorId").GetString() != "founder.review" ||
            !parameters.TryGetProperty("handoff", out var handoff) ||
            !HasOnlyProperties(
                handoff,
                "fromRunId",
                "toAdapterId",
                "toModelId",
                "toSettings",
                "reason",
                "completedWork",
                "unresolvedMatters",
                "decisions",
                "evidence") ||
            handoff.GetProperty("fromRunId").GetString() != RunId.ToString("D") ||
            handoff.GetProperty("toAdapterId").GetString() != "openai-codex" ||
            handoff.GetProperty("toModelId").GetString() != "gpt-5.6-codex-next" ||
            !HasOnlyProperties(handoff.GetProperty("toSettings"), "reasoningEffort") ||
            handoff.GetProperty("toSettings").GetProperty("reasoningEffort").GetString() != "medium" ||
            handoff.GetProperty("reason").GetString() != "Switch to the reviewed model" ||
            !StringArrayEquals(handoff.GetProperty("completedWork"), "Selection workflow completed") ||
            !StringArrayEquals(handoff.GetProperty("unresolvedMatters"), "Native Visual Studio acceptance remains") ||
            !StringArrayEquals(handoff.GetProperty("decisions"), "Keep execution disabled") ||
            !StringArrayEquals(handoff.GetProperty("evidence"), "evidence/visual-studio-selection.json"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID HANDOFF");
            return null;
        }
        var target = TargetAgentSelection();
        var receipt = AgentHandoff(target);
        if (includePrivatePath) receipt["runtimeExecutable"] = $"{PrivateRoot}/{PrivateCredential}";
        if (mismatchTargetSetting)
        {
            target["settings"] = new Dictionary<string, object?> { ["reasoningEffort"] = "high" };
        }
        await WriteResultAsync(id, receipt);
        return target;
    }

    private static Dictionary<string, object?> AgentHandoff(Dictionary<string, object?> target) => new()
    {
        ["schemaVersion"] = 1,
        ["id"] = HandoffId.ToString("D"),
        ["productId"] = ProductId.ToString("D"),
        ["initiativeId"] = InitiativeId.ToString("D"),
        ["fromRunId"] = RunId.ToString("D"),
        ["toAgent"] = target,
        ["reason"] = "Switch to the reviewed model",
        ["workspaceBaseline"] = new Dictionary<string, object?>
        {
            ["gitHead"] = "abcdef1",
            ["dirty"] = true,
            ["changedFiles"] = new[] { "src/index.cs" },
            ["truthClass"] = "observed",
        },
        ["completedWork"] = new[] { "Selection workflow completed" },
        ["unresolvedMatters"] = new[] { "Native Visual Studio acceptance remains" },
        ["decisions"] = new[] { "Keep execution disabled" },
        ["evidence"] = new[] { "evidence/visual-studio-selection.json" },
        ["capabilityDifferences"] = new[] { "Model changes from gpt-5.6-codex to gpt-5.6-codex-next." },
        ["createdAt"] = "2026-07-24T08:10:00.000Z",
    };

    private static async Task HandleManagedReadOnlyPreviewAsync(
        long id,
        JsonElement parameters,
        bool includePrivateField,
        bool includePrivateCriterion,
        bool invalidateDigest)
    {
        if (!HasOnlyProperties(parameters, "charterId", "workflowPlanId") ||
            parameters.GetProperty("charterId").GetString() != CharterId.ToString("D") ||
            parameters.GetProperty("workflowPlanId").GetString() != WorkflowPlanId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED PREVIEW");
            return;
        }
        await WriteResultAsync(id, ManagedReadOnlyPreview(includePrivateField, includePrivateCriterion, invalidateDigest));
    }

    private static async Task HandleManagedReadOnlyExecuteAsync(
        long id,
        JsonElement parameters,
        bool includePrivateField,
        bool mismatchBinding)
    {
        var preview = ManagedReadOnlyPreview();
        if (!HasOnlyProperties(
                parameters,
                "actorId", "charterId", "workflowPlanId", "expectedPreviewDigest", "timeoutMs", "confirmation") ||
            parameters.GetProperty("actorId").GetString() != "founder.review" ||
            parameters.GetProperty("charterId").GetString() != CharterId.ToString("D") ||
            parameters.GetProperty("workflowPlanId").GetString() != WorkflowPlanId.ToString("D") ||
            parameters.GetProperty("expectedPreviewDigest").GetString() != (string)preview["previewDigest"]! ||
            parameters.GetProperty("timeoutMs").GetInt32() != 120_000 ||
            parameters.GetProperty("confirmation").GetString() != "attest-exact-managed-readonly-preview")
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED EXECUTION");
            return;
        }
        var receipt = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-readonly-receipt",
            ["previewDigest"] = preview["previewDigest"],
            ["runId"] = GovernedManagedRunId.ToString("D"),
            ["managedRunId"] = ManagedRunId.ToString("D"),
            ["productId"] = ProductId.ToString("D"),
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["adapterId"] = "openai-codex",
            ["agentId"] = "codex",
            ["modelId"] = "gpt-5.6-codex",
            ["mode"] = "codex-staged",
            ["state"] = "completed",
            ["providerDisposition"] = "completed",
            ["outcomeStatus"] = "satisfied",
            ["outcomeBasis"] = "postcondition-evaluator",
            ["eventCount"] = 5,
            ["completedStepCount"] = 1,
            ["totalStepCount"] = 1,
            ["resultDigest"] = $"sha256:{new string('8', 64)}",
            ["evidenceDigest"] = $"sha256:{new string('9', 64)}",
            ["warnings"] = Array.Empty<string>(),
            ["startedAt"] = "2026-07-24T09:00:00.000Z",
            ["endedAt"] = "2026-07-24T09:00:05.000Z",
            ["authorityBoundary"] = "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
        };
        if (includePrivateField) receipt["rawProviderOutput"] = $"{PrivateRoot}/{PrivateCredential}";
        if (mismatchBinding) receipt["modelId"] = "private-unbound-model";
        await WriteResultAsync(id, receipt);
    }

    private static async Task HandleManagedEvidenceListAsync(
        long id,
        JsonElement parameters,
        bool includePrivateField,
        bool invalidateOmittedCount,
        bool substituteSnapshot,
        bool substituteTotal)
    {
        var hasSnapshot = parameters.TryGetProperty("snapshotDigest", out var snapshotDigest);
        var offset = parameters.GetProperty("offset").GetInt32();
        if (!(hasSnapshot
                ? HasOnlyProperties(parameters, "offset", "limit", "snapshotDigest")
                : HasOnlyProperties(parameters, "offset", "limit")) ||
            offset is not (0 or 1) ||
            (offset > 0 && !hasSnapshot) ||
            parameters.GetProperty("limit").GetInt32() != 100 ||
            (hasSnapshot && snapshotDigest.GetString() != $"sha256:{new string('6', 64)}"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED EVIDENCE LIST");
            return;
        }
        var page = ManagedEvidencePage(offset);
        if (includePrivateField)
        {
            var items = (Dictionary<string, object?>[])page["items"]!;
            items[0]["localStagePath"] = $"{PrivateRoot}/{PrivateCredential}";
        }
        if (invalidateOmittedCount) page["omittedCount"] = 0;
        if (substituteSnapshot) page["snapshotDigest"] = $"sha256:{new string('7', 64)}";
        if (substituteTotal && offset == 1)
        {
            page["total"] = 4;
            page["omittedCount"] = 2;
            page["hasMore"] = true;
        }
        await WriteResultAsync(id, page);
    }

    private static async Task HandleManagedEvidenceReadAsync(
        long id,
        JsonElement parameters,
        bool includePrivateField,
        bool mismatchEvidenceBinding,
        bool mismatchApplyBinding)
    {
        if (!HasOnlyProperties(parameters, "managedRunId") ||
            !Guid.TryParseExact(parameters.GetProperty("managedRunId").GetString(), "D", out var parsedManagedRunId) ||
            parsedManagedRunId != ManagedRunId && parsedManagedRunId != RecordOnlyManagedRunId)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED EVIDENCE READ");
            return;
        }
        var detail = parsedManagedRunId == RecordOnlyManagedRunId
            ? RecordOnlyManagedEvidenceDetail()
            : ManagedEvidenceDetail();
        if (includePrivateField) detail["rawProviderOutput"] = $"{PrivateRoot}/{PrivateCredential}";
        if (mismatchEvidenceBinding)
        {
            ((Dictionary<string, object?>)detail["evidence"]!)["evidenceDigest"] = $"sha256:{new string('0', 64)}";
        }
        if (mismatchApplyBinding)
        {
            ((Dictionary<string, object?>)detail["applyDecision"]!)["receiptDigest"] = $"sha256:{new string('0', 64)}";
        }
        await WriteResultAsync(id, detail);
    }

    private static async Task HandleManagedReviewReadAsync(
        long id,
        JsonElement parameters,
        bool invalidateDigest,
        bool includePrivateField,
        bool mismatchBinding,
        bool includePrivatePath,
        bool incompleteMetadata)
    {
        if (!HasOnlyProperties(parameters, "managedRunId") ||
            parameters.GetProperty("managedRunId").GetString() != StagedManagedRunId.ToString("D"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED REVIEW READ");
            return;
        }
        var preview = ManagedReviewPreview();
        if (invalidateDigest) preview["previewDigest"] = $"sha256:{new string('0', 64)}";
        if (includePrivateField) preview["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        if (mismatchBinding)
        {
            ((Dictionary<string, object?>)preview["applyConfirmation"]!)["reviewEvidenceId"] =
                ManagedEvidenceId.ToString("D");
            RefreshCanonicalDigest(preview, "previewDigest");
        }
        if (includePrivatePath || incompleteMetadata)
        {
            var staging = (Dictionary<string, object?>)preview["staging"]!;
            var inventory = (Dictionary<string, object?>[])staging["changedInventory"]!;
            if (includePrivatePath) inventory[0]["path"] = $"{PrivateRoot}/secret.cs";
            if (incompleteMetadata) inventory[0].Remove("afterMode");
            var inventoryDigest = CanonicalDigest(JsonSerializer.SerializeToElement(inventory));
            staging["changedInventoryDigest"] = inventoryDigest;
            ((Dictionary<string, object?>)preview["applyConfirmation"]!)["changedInventoryDigest"] = inventoryDigest;
            RefreshCanonicalDigest(preview, "previewDigest");
        }
        await WriteResultAsync(id, preview);
    }

    private static async Task HandleManagedReviewDecisionAsync(
        long id,
        JsonElement parameters,
        string decision,
        bool staleReview,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var preview = ManagedReviewPreview();
        if (!HasOnlyProperties(
                parameters,
                "actorId", "managedRunId", "expectedManagedRunRevision", "expectedPreviewDigest", "confirmation") ||
            parameters.GetProperty("actorId").GetString() is not ("founder.review" or "gaep.visual-studio-local-human") ||
            parameters.GetProperty("managedRunId").GetString() != StagedManagedRunId.ToString("D") ||
            parameters.GetProperty("expectedManagedRunRevision").GetInt64() != 3 ||
            parameters.GetProperty("expectedPreviewDigest").GetString() != (string)preview["previewDigest"]! ||
            parameters.GetProperty("confirmation").GetString() != decision)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED REVIEW DECISION");
            return;
        }
        if (staleReview)
        {
            await WriteErrorAsync(
                id,
                -32_029,
                "MANAGED_REVIEW_CHANGED",
                $"{PrivateRoot}; token={PrivateCredential}");
            return;
        }
        var transition = ManagedReviewTransition(decision);
        if (invalidateDigest) transition["transitionDigest"] = $"sha256:{new string('0', 64)}";
        if (includePrivateField) transition["localJournalPath"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, transition);
    }

    private static Dictionary<string, object?> ManagedReviewPreview()
    {
        var inventory = new[]
        {
            new Dictionary<string, object?>
            {
                ["path"] = "src/new.cs",
                ["kind"] = "added",
                ["afterDigest"] = $"sha256:{new string('1', 64)}",
                ["afterSize"] = 24,
                ["afterMode"] = 0x1a4,
            },
            new Dictionary<string, object?>
            {
                ["path"] = "src/review.cs",
                ["kind"] = "modified",
                ["beforeDigest"] = $"sha256:{new string('2', 64)}",
                ["afterDigest"] = $"sha256:{new string('3', 64)}",
                ["beforeSize"] = 80,
                ["afterSize"] = 96,
                ["beforeMode"] = 0x1a4,
                ["afterMode"] = 0x1a4,
            },
        };
        var inventoryDigest = CanonicalDigest(JsonSerializer.SerializeToElement(inventory));
        var writeEnvelope = new[] { "src" };
        var preview = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-review-preview",
            ["managedRunId"] = StagedManagedRunId.ToString("D"),
            ["managedRunRevision"] = 3,
            ["runId"] = GovernedManagedRunId.ToString("D"),
            ["productId"] = ProductId.ToString("D"),
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["mode"] = "codex-staged",
            ["state"] = "review-required",
            ["canApply"] = true,
            ["canDiscard"] = true,
            ["hasLocalJournal"] = false,
            ["bindingsDigest"] = $"sha256:{new string('4', 64)}",
            ["result"] = new Dictionary<string, object?>
            {
                ["resultId"] = StagedResultId.ToString("D"),
                ["resultDigest"] = $"sha256:{new string('5', 64)}",
                ["terminalState"] = "review-required",
                ["providerDisposition"] = "completed",
                ["outcomeStatus"] = "not-assessed",
                ["outcomeBasis"] = "not-evaluated",
                ["warningCodes"] = new[] { "provider-output-redacted", "staging-read-confinement-unattested" },
                ["evidenceId"] = StagedEvidenceId.ToString("D"),
                ["evidenceDigest"] = $"sha256:{new string('6', 64)}",
            },
            ["staging"] = new Dictionary<string, object?>
            {
                ["evidenceId"] = StagedEvidenceId.ToString("D"),
                ["evidenceDigest"] = $"sha256:{new string('6', 64)}",
                ["baselineDigest"] = $"sha256:{new string('7', 64)}",
                ["finalDigest"] = $"sha256:{new string('8', 64)}",
                ["applyState"] = "pending",
                ["changeCount"] = inventory.Length,
                ["changedInventoryLimit"] = 512,
                ["omittedCount"] = 0,
                ["changedInventory"] = inventory,
                ["changedInventoryDigest"] = inventoryDigest,
                ["excludedPathCount"] = 0,
                ["excludedPathSetDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(Array.Empty<string>())),
            },
            ["applyConfirmation"] = new Dictionary<string, object?>
            {
                ["decision"] = "apply-exact-reviewed-inventory",
                ["reviewEvidenceId"] = StagedEvidenceId.ToString("D"),
                ["reviewEvidenceDigest"] = $"sha256:{new string('6', 64)}",
                ["changedInventoryDigest"] = inventoryDigest,
                ["writeEnvelope"] = writeEnvelope,
                ["writeEnvelopeDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(writeEnvelope)),
            },
            ["postApplyGatePolicy"] = "record-not-assessed",
            ["authorityBoundary"] = "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision",
            ["privacyBoundary"] = "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted.",
            ["cleanupBoundary"] = "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
        };
        preview["previewDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(preview));
        return preview;
    }

    private static Dictionary<string, object?> ManagedReviewTransition(string decision)
    {
        var preview = ManagedReviewPreview();
        var applied = decision == "apply-exact-managed-review";
        var state = applied ? "failed" : "discarded";
        var transition = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-review-transition",
            ["decision"] = decision,
            ["sourcePreviewDigest"] = preview["previewDigest"],
            ["sourceManagedRunRevision"] = 3,
            ["managedRunId"] = StagedManagedRunId.ToString("D"),
            ["managedRunRevision"] = 4,
            ["state"] = state,
            ["canApply"] = false,
            ["canDiscard"] = false,
            ["hasLocalJournal"] = applied,
            ["detail"] = TransitionedManagedEvidenceDetail(state, applied),
            ["authorityBoundary"] = "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup",
            ["cleanupBoundary"] = "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
        };
        transition["transitionDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(transition));
        return transition;
    }

    private static Dictionary<string, object?> TransitionedManagedEvidenceDetail(string state, bool applied)
    {
        var resultDigest = $"sha256:{new string('9', 64)}";
        var evidenceDigest = $"sha256:{new string('a', 64)}";
        var applyDecisionDigest = $"sha256:{new string('b', 64)}";
        var preview = ManagedReviewPreview();
        var summary = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-run-summary",
            ["managedRunId"] = StagedManagedRunId.ToString("D"),
            ["runId"] = GovernedManagedRunId.ToString("D"),
            ["productId"] = ProductId.ToString("D"),
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["mode"] = "codex-staged",
            ["state"] = state,
            ["adapterId"] = "openai-codex",
            ["agentId"] = "codex",
            ["modelId"] = "gpt-5.6-codex",
            ["attemptNumber"] = 1,
            ["recoveryStatus"] = "recovered",
            ["workflowCheckpointCount"] = 0,
            ["hasResult"] = true,
            ["hasApplyDecision"] = applied,
            ["bindingsDigest"] = $"sha256:{new string('4', 64)}",
            ["resultDigest"] = resultDigest,
            ["createdAt"] = "2026-07-24T08:29:59.000Z",
            ["startedAt"] = "2026-07-24T08:30:00.000Z",
            ["updatedAt"] = "2026-07-24T08:30:02.000Z",
            ["endedAt"] = "2026-07-24T08:30:02.000Z",
            ["authorityBoundary"] = "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
        };
        if (applied) summary["applyDecisionDigest"] = applyDecisionDigest;
        var detail = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-evidence-detail",
            ["summary"] = summary,
            ["artifactStatus"] = "verified-result-and-evidence",
            ["result"] = new Dictionary<string, object?>
            {
                ["resultId"] = TransitionedResultId.ToString("D"),
                ["resultDigest"] = resultDigest,
                ["providerDisposition"] = "completed",
                ["terminationCause"] = "normal",
                ["outcomeStatus"] = "failed",
                ["outcomeBasis"] = "not-evaluated",
                ["terminalState"] = state,
                ["evidenceId"] = TransitionedEvidenceId.ToString("D"),
                ["evidenceDigest"] = evidenceDigest,
                ["warningCodes"] = applied
                    ? new[] { "provider-output-redacted" }
                    : new[] { "provider-output-redacted", "local-cleanup-pending" },
                ["startedAt"] = "2026-07-24T08:30:00.000Z",
                ["endedAt"] = "2026-07-24T08:30:02.000Z",
            },
            ["evidence"] = new Dictionary<string, object?>
            {
                ["evidenceId"] = TransitionedEvidenceId.ToString("D"),
                ["evidenceDigest"] = evidenceDigest,
                ["eventCount"] = 2,
                ["eventTypeCounts"] = new Dictionary<string, object?>
                {
                    ["lifecycle"] = 1,
                    ["output"] = 1,
                    ["item"] = 0,
                    ["approval"] = 0,
                    ["warning"] = 0,
                    ["error"] = 0,
                },
                ["eventsDigest"] = $"sha256:{new string('c', 64)}",
                ["workflowStrategy"] = "sequential",
                ["workflowStepCount"] = 1,
                ["workflowAttemptCount"] = 1,
                ["completedStepCount"] = 0,
                ["charterEvidenceStatus"] = "not-assessed",
                ["charterStopStatus"] = "not-assessed",
                ["terminalReasonCode"] = applied ? "workflow-output-gate-failed" : "staged-review-discarded",
                ["staging"] = new Dictionary<string, object?>
                {
                    ["changeCount"] = 2,
                    ["excludedPathCount"] = 0,
                    ["applyState"] = applied ? "applied" : "discarded",
                    ["baselineDigest"] = $"sha256:{new string('7', 64)}",
                    ["finalDigest"] = $"sha256:{new string('8', 64)}",
                    ["changedInventoryDigest"] = ((Dictionary<string, object?>)preview["staging"]!)["changedInventoryDigest"],
                    ["excludedPathSetDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(Array.Empty<string>())),
                },
                ["actualEffectCounts"] = new Dictionary<string, object?>
                {
                    ["not-observed"] = 0,
                    ["observed-provisional"] = 0,
                    ["applied"] = applied ? 1 : 0,
                    ["blocked"] = applied ? 0 : 1,
                    ["unknown"] = 0,
                },
                ["capturedAt"] = "2026-07-24T08:30:02.000Z",
            },
            ["authorityBoundary"] = "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
            ["privacyBoundary"] = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
        };
        if (applied)
        {
            detail["applyDecision"] = new Dictionary<string, object?>
            {
                ["receiptId"] = ReviewApplyDecisionId.ToString("D"),
                ["receiptDigest"] = applyDecisionDigest,
                ["managedRunRevision"] = 3,
                ["changedInventoryCount"] = 2,
                ["writeEnvelopeCount"] = 1,
                ["changedInventoryDigest"] = ((Dictionary<string, object?>)preview["staging"]!)["changedInventoryDigest"],
                ["writeEnvelopeDigest"] = ((Dictionary<string, object?>)preview["applyConfirmation"]!)["writeEnvelopeDigest"],
                ["decidedAt"] = "2026-07-24T08:30:01.000Z",
            };
        }
        return detail;
    }

    private static void RefreshCanonicalDigest(Dictionary<string, object?> value, string digestKey)
    {
        value.Remove(digestKey);
        value[digestKey] = CanonicalDigest(JsonSerializer.SerializeToElement(value));
    }

    private static Dictionary<string, object?> ManagedRunSummary() => new()
    {
        ["schemaVersion"] = 1,
        ["kind"] = "managed-run-summary",
        ["managedRunId"] = ManagedRunId.ToString("D"),
        ["runId"] = GovernedManagedRunId.ToString("D"),
        ["productId"] = ProductId.ToString("D"),
        ["initiativeId"] = InitiativeId.ToString("D"),
        ["mode"] = "codex-staged",
        ["state"] = "completed",
        ["adapterId"] = "openai-codex",
        ["agentId"] = "codex",
        ["modelId"] = "gpt-5.6-codex",
        ["attemptNumber"] = 1,
        ["recoveryStatus"] = "not-required",
        ["workflowCheckpointCount"] = 0,
        ["hasResult"] = true,
        ["hasApplyDecision"] = true,
        ["bindingsDigest"] = $"sha256:{new string('7', 64)}",
        ["resultDigest"] = $"sha256:{new string('8', 64)}",
        ["applyDecisionDigest"] = $"sha256:{new string('b', 64)}",
        ["createdAt"] = "2026-07-24T09:00:00.000Z",
        ["startedAt"] = "2026-07-24T09:00:00.000Z",
        ["updatedAt"] = "2026-07-24T09:00:05.000Z",
        ["endedAt"] = "2026-07-24T09:00:05.000Z",
        ["authorityBoundary"] = "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
    };

    private static Dictionary<string, object?> ManagedEvidencePage(int offset = 0)
    {
        Dictionary<string, object?>[] items;
        if (offset == 0)
        {
            items = [ManagedRunSummary()];
        }
        else
        {
            var second = ManagedRunSummary();
            second["managedRunId"] = "29292929-2929-4929-8929-292929292929";
            second["runId"] = "30303030-3030-4030-8030-303030303030";
            var third = ManagedRunSummary();
            third["managedRunId"] = "31313131-3131-4131-8131-313131313131";
            third["runId"] = "32323232-3232-4232-8232-323232323232";
            items = [second, third];
        }
        return new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-run-summary-page",
            ["items"] = items,
            ["offset"] = offset,
            ["limit"] = 100,
            ["total"] = 3,
            ["omittedCount"] = 3 - items.Length,
            ["snapshotDigest"] = $"sha256:{new string('6', 64)}",
            ["hasMore"] = offset + items.Length < 3,
            ["authorityBoundary"] = "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
            ["privacyBoundary"] = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
        };
    }

    private static Dictionary<string, object?> ManagedEvidenceDetail() => new()
    {
        ["schemaVersion"] = 1,
        ["kind"] = "managed-evidence-detail",
        ["summary"] = ManagedRunSummary(),
        ["artifactStatus"] = "verified-result-and-evidence",
        ["result"] = new Dictionary<string, object?>
        {
            ["resultId"] = ManagedResultId.ToString("D"),
            ["resultDigest"] = $"sha256:{new string('8', 64)}",
            ["providerDisposition"] = "completed",
            ["terminationCause"] = "normal",
            ["outcomeStatus"] = "satisfied",
            ["outcomeBasis"] = "postcondition-evaluator",
            ["terminalState"] = "completed",
            ["evidenceId"] = ManagedEvidenceId.ToString("D"),
            ["evidenceDigest"] = $"sha256:{new string('9', 64)}",
            ["warningCodes"] = Array.Empty<string>(),
            ["startedAt"] = "2026-07-24T09:00:00.000Z",
            ["endedAt"] = "2026-07-24T09:00:05.000Z",
        },
        ["evidence"] = new Dictionary<string, object?>
        {
            ["evidenceId"] = ManagedEvidenceId.ToString("D"),
            ["evidenceDigest"] = $"sha256:{new string('9', 64)}",
            ["eventCount"] = 5,
            ["eventTypeCounts"] = new Dictionary<string, object?>
            {
                ["lifecycle"] = 2,
                ["output"] = 1,
                ["item"] = 1,
                ["approval"] = 1,
                ["warning"] = 0,
                ["error"] = 0,
            },
            ["eventsDigest"] = $"sha256:{new string('a', 64)}",
            ["workflowStrategy"] = "sequential",
            ["workflowStepCount"] = 1,
            ["workflowAttemptCount"] = 1,
            ["completedStepCount"] = 1,
            ["charterEvidenceStatus"] = "satisfied",
            ["charterStopStatus"] = "satisfied",
            ["terminalReasonCode"] = "workflow-completed",
            ["staging"] = new Dictionary<string, object?>
            {
                ["changeCount"] = 0,
                ["excludedPathCount"] = 0,
                ["applyState"] = "applied",
                ["baselineDigest"] = $"sha256:{new string('c', 64)}",
                ["finalDigest"] = $"sha256:{new string('c', 64)}",
                ["changedInventoryDigest"] = $"sha256:{new string('d', 64)}",
                ["excludedPathSetDigest"] = $"sha256:{new string('e', 64)}",
            },
            ["actualEffectCounts"] = new Dictionary<string, object?>
            {
                ["not-observed"] = 1,
                ["observed-provisional"] = 0,
                ["applied"] = 0,
                ["blocked"] = 0,
                ["unknown"] = 0,
            },
            ["capturedAt"] = "2026-07-24T09:00:05.000Z",
        },
        ["applyDecision"] = new Dictionary<string, object?>
        {
            ["receiptId"] = ManagedApplyDecisionId.ToString("D"),
            ["receiptDigest"] = $"sha256:{new string('b', 64)}",
            ["managedRunRevision"] = 5,
            ["changedInventoryCount"] = 0,
            ["writeEnvelopeCount"] = 0,
            ["changedInventoryDigest"] = $"sha256:{new string('d', 64)}",
            ["writeEnvelopeDigest"] = $"sha256:{new string('f', 64)}",
            ["decidedAt"] = "2026-07-24T09:00:06.000Z",
        },
        ["authorityBoundary"] = "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
        ["privacyBoundary"] = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
    };

    private static Dictionary<string, object?> RecordOnlyManagedEvidenceDetail()
    {
        var summary = ManagedRunSummary();
        summary["managedRunId"] = RecordOnlyManagedRunId.ToString("D");
        summary["state"] = "running";
        summary["hasResult"] = false;
        summary["hasApplyDecision"] = false;
        summary.Remove("resultDigest");
        summary.Remove("applyDecisionDigest");
        summary.Remove("endedAt");
        return new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-evidence-detail",
            ["summary"] = summary,
            ["artifactStatus"] = "record-only",
            ["authorityBoundary"] = "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
            ["privacyBoundary"] = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
        };
    }

    private static Dictionary<string, object?> ManagedReadOnlyPreview(
        bool includePrivateField = false,
        bool includePrivateCriterion = false,
        bool invalidateDigest = false)
    {
        var gates = new[]
        {
            ManagedGate("charter:required-evidence", null, "charter-evidence", ["Record verified output evidence"]),
            ManagedGate("charter:stop-conditions", null, "charter-stop-conditions", ["Stop on any attempted write"]),
            ManagedGate($"step:{WorkflowStepId:D}:preconditions", WorkflowStepId, "preconditions", ["Read scope remains exact"]),
            ManagedGate($"step:{WorkflowStepId:D}:outputs", WorkflowStepId, "outputs", ["Return an observation summary"]),
            ManagedGate($"step:{WorkflowStepId:D}:evidence", WorkflowStepId, "evidence", ["Record deterministic evidence"]),
            ManagedGate($"step:{WorkflowStepId:D}:stop-conditions", WorkflowStepId, "stop-conditions", ["Stop if a Tool is requested"]),
        };
        if (includePrivateCriterion)
        {
            var criteria = new[] { $"Inspect {PrivateRoot}; token={PrivateCredential}" };
            gates[0]["criteria"] = criteria;
            gates[0]["criteriaDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(criteria));
        }
        var preview = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "managed-readonly-preview",
            ["productId"] = ProductId.ToString("D"),
            ["initiativeId"] = InitiativeId.ToString("D"),
            ["charterId"] = CharterId.ToString("D"),
            ["charterDigest"] = $"sha256:{new string('3', 64)}",
            ["workflowPlanId"] = WorkflowPlanId.ToString("D"),
            ["workflowPlanDigest"] = $"sha256:{new string('4', 64)}",
            ["adapterId"] = "openai-codex",
            ["agentId"] = "codex",
            ["modelId"] = "gpt-5.6-codex",
            ["selectionDigest"] = $"sha256:{new string('5', 64)}",
            ["strategy"] = "sequential",
            ["stepIds"] = new[] { WorkflowStepId.ToString("D") },
            ["contextPackCount"] = 1,
            ["readScopeCount"] = 2,
            ["gates"] = gates,
            ["authorityBoundary"] = "managed-readonly-preview-does-not-grant-execution-or-effect-authority",
        };
        preview["previewDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(preview));
        if (includePrivateField) preview["workspacePath"] = $"{PrivateRoot}/{PrivateCredential}";
        if (invalidateDigest) preview["previewDigest"] = $"sha256:{new string('0', 64)}";
        return preview;
    }

    private static Dictionary<string, object?> ManagedGate(
        string key,
        Guid? stepId,
        string phase,
        string[] criteria)
    {
        var gate = new Dictionary<string, object?>
        {
            ["key"] = key,
            ["phase"] = phase,
            ["criteria"] = criteria,
            ["criteriaDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(criteria)),
        };
        if (stepId.HasValue) gate["stepId"] = stepId.Value.ToString("D");
        return gate;
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

    private static bool StringArrayEquals(JsonElement value, string expected) =>
        value.ValueKind == JsonValueKind.Array && value.GetArrayLength() == 1 &&
        value[0].ValueKind == JsonValueKind.String && value[0].GetString() == expected;

    private static async Task HandleReadProductAsync(long id, JsonElement parameters, long revision)
    {
        if (!HasOnlyProperties(parameters))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PRODUCT READ");
            return;
        }
        await WriteResultAsync(id, ProductRecord(revision));
    }

    private static Dictionary<string, object?> ProductRecord(long revision) => new()
    {
        ["id"] = ProductId.ToString("D"),
        ["name"] = "Founder Product",
        ["revision"] = revision,
        ["lifecycleState"] = "candidate",
        ["privateWorkspace"] = PrivateRoot,
    };

    private static async Task HandlePhaseDashboardAsync(
        long id,
        JsonElement parameters,
        bool mismatchBinding,
        bool invalidateApplicability,
        bool invalidateEvidenceCues,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        if (!HasOnlyProperties(
                parameters,
                "phase", "expectedProductId", "expectedProductRevision", "expectedProductDigest") ||
            parameters.GetProperty("phase").GetString() != "phase-0-1a-foundation" ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID DASHBOARD REQUEST");
            return;
        }
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "phase-dashboard-framework",
            ["catalogVersion"] = "gaep-phase-dashboards-v1",
            ["product"] = new Dictionary<string, object?>
            {
                ["recordType"] = "product",
                ["recordId"] = ProductId.ToString("D"),
                ["revision"] = 7,
                ["digest"] = mismatchBinding ? $"sha256:{new string('0', 64)}" : productDigest,
            },
            ["phase"] = new Dictionary<string, object?>
            {
                ["id"] = "phase-0-1a-foundation",
                ["label"] = "Phase 0 / 1A — Four-IDE Platform Foundation",
            },
            ["panels"] = new[]
            {
                PhaseDashboardPanel(
                    "foundation-summary",
                    "phase",
                    "Foundation summary and readiness",
                    invalidateApplicability ? "applicable" : "unknown",
                    "not-evaluated",
                    invalidateApplicability ? "active" : "attention-required"),
                PhaseDashboardPanel("change-impact", "change-impact", "Change and impact", "applicable", "phase-contract", "active"),
                PhaseDashboardPanel("agent-model", "agent-model", "Agent and model", "applicable", "phase-contract", "active"),
            },
            ["evidenceCues"] = DashboardEvidenceCues("current"),
            ["observedAt"] = "2026-07-24T12:00:00.000Z",
            ["sourceBoundary"] = "governed-repository-and-engine-only",
            ["limitations"] = new[]
            {
                "The selected phase scopes presentation only; it does not prove phase entry, completion, acceptance, or release readiness.",
                "The phase dashboard remains attention-required until a governed applicability decision is bound.",
            },
            ["authorityBoundary"] =
                "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
        };
        if (invalidateEvidenceCues)
        {
            ((Dictionary<string, object?>)dashboard["evidenceCues"]!)["freshness"] = "unknown";
        }
        RefreshCanonicalDigest(dashboard, "compositionDigest");
        if (invalidateDigest)
        {
            ((Dictionary<string, object?>[])dashboard["panels"]!)[0]["title"] = "Forged dashboard title";
        }
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, dashboard);
    }

    private static async Task HandlePhase2UxFigmaDashboardAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability,
        bool invalidateCatalogDigest,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var initiativeDigest = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord));
        if (!HasOnlyProperties(
                parameters,
                "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
                "expectedInitiativeRevision", "expectedInitiativeDigest") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest ||
            parameters.GetProperty("expectedInitiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != initiativeRevision ||
            parameters.GetProperty("expectedInitiativeDigest").GetString() != initiativeDigest)
        {
            await WriteErrorAsync(id, -32_602, "PHASE2_UX_FIGMA_PARAMS_INVALID", "PRIVATE PHASE 2 DASHBOARD PARAMS");
            return;
        }
        var definitions = new[]
        {
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
        };
        var sources = definitions.Select(definition => new Dictionary<string, object?>
        {
            ["id"] = definition.Item1,
            ["title"] = definition.Item2,
            ["group"] = definition.Item3,
            ["projectionKind"] = definition.Item4,
            ["availability"] = "unavailable",
        }).ToArray();
        static Dictionary<string, object?> ZeroCounts(params string[] names) =>
            names.ToDictionary(name => name, _ => (object?)0, StringComparer.Ordinal);
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "phase-2-ux-figma-dashboard",
            ["viewDefinitionVersion"] = "gaep-phase-2-ux-figma-dashboard-v1",
            ["phase"] = new Dictionary<string, object?>
            {
                ["id"] = "phase-2-design",
                ["label"] = "Phase 2 — UX and Figma Loop",
            },
            ["product"] = new Dictionary<string, object?>
            {
                ["recordType"] = "product",
                ["recordId"] = ProductId.ToString("D"),
                ["revision"] = 7,
                ["digest"] = productDigest,
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["recordType"] = "initiative",
                ["recordId"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = initiativeDigest,
                ["state"] = initiativeRecord["state"],
            },
            ["sources"] = sources,
            ["experience"] = ZeroCounts(
                "personaCount", "designRoleCount", "journeyCount", "touchpointCount", "informationArchitectureNodeCount",
                "routeCount", "screenCount", "stateCount", "variantCount"),
            ["designSystem"] = ZeroCounts(
                "requirementCount", "designSystemCount", "tokenCount", "componentCount", "accessibilityRuleCount",
                "accessibilityCheckCount", "platformTargetCount", "breakpointCount"),
            ["figma"] = ZeroCounts(
                "fileCount", "componentCount", "variableCount", "designBindingCount", "humanReviewedBindingCount",
                "unboundDesignItemCount").Concat(new Dictionary<string, object?>
                {
                    ["connectionState"] = "not-established",
                    ["writeExecutionState"] = "not-performed",
                    ["importExecutionState"] = "not-performed",
                }).ToDictionary(value => value.Key, value => value.Value, StringComparer.Ordinal),
            ["governance"] = new Dictionary<string, object?>
            {
                ["designerReadyCandidateResult"] = "not-assessed",
                ["humanApprovalCandidateResult"] = "not-assessed",
                ["baselineCandidateResult"] = "not-assessed",
                ["baselineDesignationState"] = "not-established",
                ["driftCandidateResult"] = "not-assessed",
                ["approvalState"] = "not-established",
                ["readinessState"] = "not-established",
                ["remediationEffectState"] = "not-applied",
            },
            ["drift"] = ZeroCounts(
                "observationCount", "requirementToDesignCount", "designToImplementationCount", "conformantCount",
                "driftCount", "unassessedCount", "blockerCount", "highSeverityCount", "remediationCandidateCount"),
            ["freshness"] = ZeroCounts("staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount")
                .Concat(new Dictionary<string, object?> { ["state"] = "current" })
                .ToDictionary(value => value.Key, value => value.Value, StringComparer.Ordinal),
            ["phaseStatus"] = new Dictionary<string, object?>
            {
                ["state"] = "attention-required",
                ["expectedSourceCount"] = 23,
                ["currentSourceCount"] = 0,
                ["attentionRequiredSourceCount"] = 0,
                ["unavailableSourceCount"] = 23,
                ["sourceCatalogDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(sources)),
                ["productOwnerAcceptance"] = "not-established",
                ["readinessAuthority"] = "not-established",
                ["phaseEntryAuthority"] = "not-established",
            },
            ["evidenceCues"] = DashboardEvidenceCues("unknown"),
            ["observedAt"] = "2026-07-30T03:10:00.000Z",
            ["sourceBoundary"] = "current-governed-product-initiative-and-phase-2-projections-only",
            ["privacyBoundary"] =
                "dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions",
            ["limitations"] = new[]
            {
                "Missing projections remain explicitly unavailable and do not establish completeness.",
                "No approval, Baseline Set, readiness, Figma, remediation, implementation, release, or action authority is granted.",
            },
            ["authorityBoundary"] =
                "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority",
        };
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        if (invalidateCatalogDigest)
        {
            ((Dictionary<string, object?>)dashboard["phaseStatus"]!)["sourceCatalogDigest"] = $"sha256:{new string('0', 64)}";
        }
        RefreshCanonicalDigest(dashboard, "snapshotDigest");
        if (invalidateDigest) ((Dictionary<string, object?>)dashboard["phaseStatus"]!)["unavailableSourceCount"] = 22;
        await WriteResultAsync(id, dashboard);
    }

    private static async Task HandlePhase1SummaryAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var initiativeDigest = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord));
        if (!HasOnlyProperties(
                parameters,
                "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
                "expectedInitiativeRevision", "expectedInitiativeDigest") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest ||
            parameters.GetProperty("expectedInitiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != initiativeRevision ||
            parameters.GetProperty("expectedInitiativeDigest").GetString() != initiativeDigest)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PHASE1 SUMMARY REQUEST");
            return;
        }

        static Dictionary<string, object?> ReadinessGaps() => new()
        {
            ["applicability"] = 0,
            ["conditional"] = 0,
            ["incomplete"] = 0,
            ["failed"] = 0,
            ["blocked"] = 0,
            ["staleOrUnknown"] = 0,
            ["waivers"] = 0,
            ["decisions"] = 0,
            ["conditions"] = 0,
            ["requirements"] = 0,
            ["adverseEvidence"] = 0,
            ["bindings"] = 0,
            ["sourceReferences"] = 0,
            ["inconsistencies"] = 0,
            ["questions"] = 0,
            ["total"] = 0,
        };
        static Dictionary<string, object?> HandoffGaps() => new()
        {
            ["unresolvedItems"] = 0,
            ["staleOrUnknownItems"] = 0,
            ["requirements"] = 0,
            ["conflicts"] = 0,
            ["questions"] = 0,
            ["bindings"] = 0,
            ["sourceReferences"] = 0,
            ["total"] = 0,
        };

        var summary = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "phase-1-summary-readiness-dashboard",
            ["phase"] = new Dictionary<string, object?>
            {
                ["id"] = "phase-1b-product",
                ["label"] = "Phase 1B — Product P0–P4",
            },
            ["product"] = new Dictionary<string, object?>
            {
                ["recordType"] = "product",
                ["recordId"] = ProductId.ToString("D"),
                ["revision"] = 7,
                ["digest"] = productDigest,
            },
            ["initiative"] = new Dictionary<string, object?>
            {
                ["recordType"] = "initiative",
                ["recordId"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = initiativeDigest,
                ["state"] = "active",
            },
            ["readiness"] = new Dictionary<string, object?>
            {
                ["snapshotDigest"] = $"sha256:{new string('1', 64)}",
                ["result"] = "not-assessed",
                ["assessedAt"] = "2026-07-27T12:00:00.000Z",
                ["outputs"] = new Dictionary<string, object?>
                {
                    ["total"] = 0,
                    ["applicable"] = 0,
                    ["notApplicable"] = 0,
                    ["unresolvedApplicability"] = 0,
                    ["satisfied"] = 0,
                },
                ["gaps"] = ReadinessGaps(),
                ["reasonCount"] = 1,
                ["attentionRequired"] = true,
                ["authorityBoundary"] = "readiness-result-is-evaluation-only-not-permission-or-product-readiness",
            },
            ["handoff"] = new Dictionary<string, object?>
            {
                ["snapshotDigest"] = $"sha256:{new string('2', 64)}",
                ["state"] = "attention-required",
                ["transferState"] = "draft",
                ["assessedAt"] = "2026-07-27T12:00:01.000Z",
                ["items"] = new Dictionary<string, object?>
                {
                    ["total"] = 0,
                    ["included"] = 0,
                    ["referenceOnly"] = 0,
                    ["omittedNotApplicable"] = 0,
                    ["unresolved"] = 0,
                },
                ["gaps"] = HandoffGaps(),
                ["reasonCount"] = 1,
                ["attentionRequired"] = true,
                ["authorityBoundary"] = "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority",
            },
            ["phaseStatus"] = new Dictionary<string, object?>
            {
                ["state"] = "attention-required",
                ["declaredGapCount"] = 0,
                ["attentionSignalCount"] = 2,
                ["productOwnerAcceptance"] = "not-established",
                ["readinessAuthority"] = "not-established",
                ["phaseEntryAuthority"] = "not-established",
            },
            ["owners"] = new Dictionary<string, object?>
            {
                ["state"] = "unbound",
                ["boundOwnerCount"] = 0,
                ["basis"] = "no-governed-phase-owner-assignment-is-bound",
            },
            ["freshness"] = new Dictionary<string, object?>
            {
                ["state"] = "current",
                ["readinessObservedAt"] = "2026-07-27T12:00:02.000Z",
                ["handoffObservedAt"] = "2026-07-27T12:00:03.000Z",
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["basis"] = "exact-current-projections-and-declared-binding-freshness",
            },
            ["evidenceCues"] = DashboardEvidenceCues("current"),
            ["observedAt"] = "2026-07-27T12:00:04.000Z",
            ["sourceBoundary"] = "current-governed-product-initiative-readiness-and-handoff-projections-only",
            ["privacyBoundary"] = "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials",
            ["limitations"] = new[]
            {
                "Phase ownership remains unbound until a governed phase-owner assignment record is available.",
            },
            ["authorityBoundary"] = "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority",
        };
        RefreshCanonicalDigest(summary, "snapshotDigest");
        await WriteResultAsync(id, summary);
    }

    private static async Task HandlePhase1ChangeImpactAsync(
        long id,
        JsonElement parameters,
        long initiativeRevision,
        Dictionary<string, object?>? classification,
        Dictionary<string, object?>? applicability)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var initiativeRecord = InitiativeRecord(initiativeRevision, classification, applicability);
        var initiativeDigest = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord));
        var change = ChangeReference();
        if (!HasOnlyProperties(
                parameters,
                "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
                "expectedInitiativeRevision", "expectedInitiativeDigest", "expectedChangeId", "expectedChangeRevision",
                "expectedChangeDigest") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest ||
            parameters.GetProperty("expectedInitiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != initiativeRevision ||
            parameters.GetProperty("expectedInitiativeDigest").GetString() != initiativeDigest ||
            parameters.GetProperty("expectedChangeId").GetString() != ChangeId.ToString("D") ||
            parameters.GetProperty("expectedChangeRevision").GetInt64() != 3 ||
            parameters.GetProperty("expectedChangeDigest").GetString() != (string)change["digest"]!)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PHASE1 CHANGE IMPACT REQUEST");
            return;
        }
        var outputKinds = new (string OutputKind, string RecordKind)[]
        {
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
        };
        var outputs = outputKinds.Select(item => new Dictionary<string, object?>
        {
            ["outputKind"] = item.OutputKind,
            ["recordKind"] = item.RecordKind,
            ["readiness"] = new Dictionary<string, object?>
            {
                ["applicability"] = "not-assessed",
                ["evaluationState"] = "not-assessed",
                ["freshness"] = "unknown",
                ["subjectCount"] = 0,
            },
            ["impact"] = new Dictionary<string, object?>
            {
                ["state"] = "not-established",
                ["exactMatchedSubjectCount"] = 0,
                ["staleSubjectBindingCount"] = 0,
                ["traceReferenceCount"] = 0,
                ["validTraceCount"] = 0,
                ["unresolvedTraceCount"] = 0,
                ["staleTraceCount"] = 0,
                ["invalidTraceCount"] = 0,
                ["upstreamTraceCount"] = 0,
                ["downstreamTraceCount"] = 0,
                ["revalidationState"] = "not-established",
                ["coverageBoundary"] = "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact",
            },
            ["handoff"] = new Dictionary<string, object?>
            {
                ["disposition"] = "not-established",
                ["freshness"] = "unknown",
                ["subjectCount"] = 0,
            },
        }).ToArray();
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "phase-1-change-impact-dashboard",
            ["phase"] = new Dictionary<string, object?>
            {
                ["id"] = "phase-1b-product",
                ["label"] = "Phase 1B — Product P0–P4",
            },
            ["product"] = ExactReference("product", ProductId, 7, productDigest),
            ["initiative"] = new Dictionary<string, object?>
            {
                ["recordType"] = "initiative",
                ["recordId"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = initiativeDigest,
                ["state"] = "active",
            },
            ["change"] = change,
            ["sources"] = new Dictionary<string, object?>
            {
                ["changeImpactSnapshotDigest"] = $"sha256:{new string('7', 64)}",
                ["readinessSnapshotDigest"] = $"sha256:{new string('8', 64)}",
                ["handoffSnapshotDigest"] = $"sha256:{new string('9', 64)}",
            },
            ["changeScope"] = new Dictionary<string, object?>
            {
                ["workItemCount"] = 1,
                ["changedArtifactCount"] = 1,
                ["effectTargetCount"] = 1,
                ["affectedUnitCount"] = 1,
                ["decisionCount"] = 1,
                ["riskCount"] = 1,
                ["unresolvedTraceLinkCount"] = 0,
                ["staleTraceLinkCount"] = 0,
                ["invalidTraceLinkCount"] = 0,
                ["traceAnalysisTruncated"] = false,
            },
            ["outputs"] = outputs,
            ["coverage"] = new Dictionary<string, object?>
            {
                ["state"] = "bounded-not-complete",
                ["outputCount"] = 25,
                ["applicableOutputCount"] = 0,
                ["currentTraceObservedOutputCount"] = 0,
                ["attentionRequiredOutputCount"] = 0,
                ["impactNotEstablishedOutputCount"] = 25,
                ["revalidationNotEstablishedOutputCount"] = 25,
                ["basis"] = "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results",
                ["coverageBoundary"] = "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact",
            },
            ["owners"] = new Dictionary<string, object?>
            {
                ["state"] = "unbound",
                ["boundOutputOwnerCount"] = 0,
                ["basis"] = "no-governed-phase-output-owner-assignment-is-bound",
            },
            ["governance"] = new Dictionary<string, object?>
            {
                ["changeApproval"] = "not-established",
                ["riskAcceptanceAuthority"] = "not-established",
                ["revalidationAuthority"] = "not-established",
                ["productOwnerAcceptance"] = "not-established",
                ["effectAuthority"] = "not-established",
            },
            ["freshness"] = new Dictionary<string, object?>
            {
                ["state"] = "current",
                ["changeImpactEvaluatedAt"] = "2026-07-27T12:04:00.000Z",
                ["readinessObservedAt"] = "2026-07-27T12:04:01.000Z",
                ["handoffObservedAt"] = "2026-07-27T12:04:02.000Z",
                ["staleBindingCount"] = 0,
                ["staleSourceReferenceCount"] = 0,
                ["traceAttentionLinkCount"] = 0,
                ["traceAnalysisTruncated"] = false,
                ["basis"] = "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness",
            },
            ["evidenceCues"] = new Dictionary<string, object?>
            {
                ["freshness"] = "current",
                ["confidence"] = new Dictionary<string, object?>
                {
                    ["state"] = "not-assessed",
                    ["basis"] = "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness",
                },
            },
            ["observedAt"] = "2026-07-27T12:04:03.000Z",
            ["sourceBoundary"] = "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only",
            ["privacyBoundary"] = "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials",
            ["limitations"] = new[]
            {
                "Outputs without exact trace matches remain impact not established rather than unaffected.",
            },
            ["authorityBoundary"] = "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority",
        };
        RefreshCanonicalDigest(dashboard, "snapshotDigest");
        await WriteResultAsync(id, dashboard);
    }

    private static Dictionary<string, object?> PhaseDashboardPanel(
        string id,
        string role,
        string title,
        string status,
        string basis,
        string state) =>
        new()
        {
            ["id"] = id,
            ["role"] = role,
            ["title"] = title,
            ["applicability"] = new Dictionary<string, object?>
            {
                ["status"] = status,
                ["basis"] = basis,
            },
            ["state"] = state,
        };

    private static Dictionary<string, object?> ChangeRecord() => new()
    {
        ["schemaVersion"] = 1,
        ["kind"] = "change",
        ["id"] = ChangeId.ToString("D"),
        ["productId"] = ProductId.ToString("D"),
        ["revision"] = 3,
        ["initiativeId"] = InitiativeId.ToString("D"),
        ["title"] = "Private Change title is withheld",
        ["summary"] = "Private Change summary is withheld.",
        ["baseline"] = new Dictionary<string, object?>
        {
            ["kind"] = "genesis",
            ["declaration"] = "No earlier projection.",
            ["rationale"] = "First projection.",
        },
        ["state"] = "active",
        ["effectEnvelope"] = new[] { "reversible-change" },
        ["createdAt"] = "2026-07-24T12:01:00.000Z",
        ["updatedAt"] = "2026-07-24T12:02:00.000Z",
    };

    private static Dictionary<string, object?> ChangeReference()
    {
        var change = ChangeRecord();
        return new Dictionary<string, object?>
        {
            ["recordType"] = "change",
            ["recordId"] = ChangeId.ToString("D"),
            ["revision"] = 3,
            ["digest"] = CanonicalDigest(JsonSerializer.SerializeToElement(change)),
            ["state"] = "active",
            ["effectEnvelope"] = new[] { "reversible-change" },
        };
    }

    private static async Task HandleChangeImpactCatalogAsync(
        long id,
        JsonElement parameters,
        bool mismatchBinding,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        if (!HasOnlyProperties(parameters, "expectedProductId", "expectedProductRevision", "expectedProductDigest") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID CHANGE CATALOG REQUEST");
            return;
        }
        var catalog = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "change-impact-change-catalog",
            ["product"] = ExactReference(
                "product",
                ProductId,
                7,
                mismatchBinding ? $"sha256:{new string('0', 64)}" : productDigest),
            ["items"] = new[] { ChangeReference() },
            ["total"] = 1,
            ["omitted"] = 0,
            ["observedAt"] = "2026-07-24T12:03:00.000Z",
            ["sourceBoundary"] = "current-governed-change-metadata-only",
            ["limitations"] = new[]
            {
                "The catalog contains exact current Change metadata only; Product text, Change text, and source content are withheld.",
            },
            ["authorityBoundary"] = "change-catalog-selection-does-not-approve-change-or-authorize-effects",
        };
        RefreshCanonicalDigest(catalog, "snapshotDigest");
        if (invalidateDigest)
        {
            ((Dictionary<string, object?>[])catalog["items"]!)[0]["state"] = "blocked";
        }
        if (includePrivateField) catalog["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, catalog);
    }

    private static async Task HandleChangeImpactAsync(
        long id,
        JsonElement parameters,
        bool mismatchBinding,
        bool invalidateCount,
        bool invalidateFreshness,
        bool invalidateEvidenceCues,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var change = ChangeReference();
        if (!HasOnlyProperties(
                parameters,
                "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedChangeId",
                "expectedChangeRevision", "expectedChangeDigest") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest ||
            parameters.GetProperty("expectedChangeId").GetString() != ChangeId.ToString("D") ||
            parameters.GetProperty("expectedChangeRevision").GetInt64() != 3 ||
            parameters.GetProperty("expectedChangeDigest").GetString() != (string)change["digest"]!)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID CHANGE IMPACT REQUEST");
            return;
        }
        if (mismatchBinding) change["digest"] = $"sha256:{new string('0', 64)}";
        var workItem = ExactReference("work-item", ChangeWorkItemId, 2, $"sha256:{new string('3', 64)}");
        var decision = ExactReference("decision", ChangeDecisionId, 1, $"sha256:{new string('4', 64)}");
        var risk = ExactReference("risk", ChangeRiskId, 1, $"sha256:{new string('5', 64)}");
        var limits = new Dictionary<string, object?>
        {
            ["workItems"] = ChangeImpactLimit(),
            ["changedArtifacts"] = ChangeImpactLimit(),
            ["effectTargets"] = ChangeImpactLimit(),
            ["affectedUnits"] = ChangeImpactLimit(),
            ["decisions"] = ChangeImpactLimit(),
            ["risks"] = ChangeImpactLimit(),
            ["truncated"] = false,
        };
        if (invalidateCount) ((Dictionary<string, object?>)limits["workItems"]!)["total"] = 2;
        var freshness = new Dictionary<string, object?>
        {
            ["state"] = invalidateFreshness ? "attention-required" : "current",
            ["evaluatedAt"] = "2026-07-24T12:04:00.000Z",
            ["unresolvedTraceLinks"] = 0,
            ["invalidTraceLinks"] = 0,
            ["staleTraceLinks"] = 0,
            ["staleGovernanceReferences"] = 0,
            ["traceAnalysisTruncated"] = false,
            ["coverageBoundary"] = "absence-of-a-trace-link-does-not-prove-absence-of-impact",
        };
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "change-impact-dashboard",
            ["product"] = ExactReference("product", ProductId, 7, productDigest),
            ["change"] = change,
            ["workItems"] = new[]
            {
                new Dictionary<string, object?>
                {
                    ["record"] = workItem,
                    ["state"] = "in-progress",
                },
            },
            ["changedArtifacts"] = new[]
            {
                ChangeArtifact(workItem, new Dictionary<string, object?>
                {
                    ["kind"] = "workspace-relative",
                    ["path"] = "apps/visual-studio/Gaep.HostClient/PortableDesignProtocol.cs",
                }),
            },
            ["effectTargets"] = new[]
            {
                ChangeArtifact(workItem, new Dictionary<string, object?>
                {
                    ["kind"] = "logical",
                    ["value"] = "package.build",
                }),
            },
            ["affectedUnits"] = new[]
            {
                new Dictionary<string, object?>
                {
                    ["direction"] = "upstream",
                    ["relationship"] = "affects",
                    ["endpoint"] = risk,
                    ["trace"] = new Dictionary<string, object?>
                    {
                        ["recordId"] = ChangeTraceId.ToString("D"),
                        ["revision"] = 1,
                        ["assessmentDigest"] = $"sha256:{new string('6', 64)}",
                        ["assessedState"] = "valid",
                    },
                },
            },
            ["governance"] = new Dictionary<string, object?>
            {
                ["approval"] = new Dictionary<string, object?>
                {
                    ["state"] = "not-established",
                    ["basis"] = "current-contract-has-no-change-approval-record",
                },
                ["decisions"] = new[]
                {
                    new Dictionary<string, object?>
                    {
                        ["record"] = decision,
                        ["state"] = "open",
                        ["outcome"] = "not-selected",
                    },
                },
                ["risks"] = new[]
                {
                    new Dictionary<string, object?>
                    {
                        ["record"] = risk,
                        ["state"] = "open",
                        ["likelihood"] = "possible",
                        ["impact"] = "major",
                        ["acceptance"] = "not-accepted",
                    },
                },
                ["authorityBoundary"] = "decisions-and-risk-acceptance-do-not-approve-the-change",
            },
            ["freshness"] = freshness,
            ["evidenceCues"] = DashboardEvidenceCues("current"),
            ["limits"] = limits,
            ["observedAt"] = "2026-07-24T12:05:00.000Z",
            ["sourceBoundary"] = "current-governed-records-and-bounded-trace-analysis",
            ["limitations"] = new[]
            {
                "Only persisted Work Item scopes and trace links are shown; missing trace does not prove missing impact.",
                "The current record model has no general Change approval record, so approval remains not established.",
            },
            ["authorityBoundary"] =
                "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects",
        };
        if (invalidateEvidenceCues)
        {
            ((Dictionary<string, object?>)dashboard["evidenceCues"]!)["freshness"] = "stale";
        }
        RefreshCanonicalDigest(dashboard, "snapshotDigest");
        if (invalidateDigest) ((Dictionary<string, object?>)dashboard["change"]!)["state"] = "blocked";
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, dashboard);
    }

    private static Dictionary<string, object?>? BuildAgentModelDashboard(
        JsonElement parameters,
        Dictionary<string, object?>? selectedAgent,
        bool mismatchBinding,
        bool invalidateCount,
        bool invalidateFreshness,
        bool invalidateMetrics,
        bool invalidateEvidenceCues,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var readiness = ReadinessSnapshots();
        var expectedCapabilities = readiness.Select(snapshot => new Dictionary<string, object?>
        {
            ["adapterId"] = snapshot["adapterId"],
            ["agentId"] = snapshot["agentId"],
            ["capabilityDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(snapshot)),
        })
            .OrderBy(
                value => $"{value["adapterId"]}:{value["agentId"]}",
                StringComparer.Ordinal)
            .ToArray();
        var expectedSelection = selectedAgent is null
            ? new Dictionary<string, object?> { ["status"] = "unselected" }
            : new Dictionary<string, object?>
            {
                ["status"] = "selected",
                ["selectionDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(selectedAgent)),
            };
        if (!HasOnlyProperties(
                parameters,
                "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedSelection",
                "expectedCapabilities") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest ||
            CanonicalDigest(parameters.GetProperty("expectedSelection")) !=
                CanonicalDigest(JsonSerializer.SerializeToElement(expectedSelection)) ||
            CanonicalDigest(parameters.GetProperty("expectedCapabilities")) !=
                CanonicalDigest(JsonSerializer.SerializeToElement(expectedCapabilities)))
        {
            return null;
        }
        var capabilities = readiness.Select(snapshot =>
        {
            var source = JsonSerializer.SerializeToElement(snapshot);
            var limitationValues = source.GetProperty("limitations").EnumerateArray()
                .Select(value => value.GetString()!).ToArray();
            return new Dictionary<string, object?>
            {
                ["adapterId"] = source.GetProperty("adapterId").GetString(),
                ["adapterVersion"] = source.GetProperty("adapterVersion").GetString(),
                ["agentId"] = source.GetProperty("agentId").GetString(),
                ["agentLabel"] = source.GetProperty("agentLabel").GetString(),
                ["runtimeVersion"] = source.TryGetProperty("runtimeVersion", out var runtimeVersion)
                    ? runtimeVersion.GetString()
                    : null,
                ["capabilityDigest"] = CanonicalDigest(source),
                ["detected"] = source.GetProperty("detected").GetBoolean(),
                ["executionInterface"] = source.GetProperty("executionInterface").GetString(),
                ["interfaceMaturity"] = source.GetProperty("interfaceMaturity").GetString(),
                ["support"] = new Dictionary<string, object?>
                {
                    ["resume"] = source.GetProperty("supportsResume").GetBoolean(),
                    ["cancel"] = source.GetProperty("supportsCancel").GetBoolean(),
                    ["checkpoints"] = source.GetProperty("supportsCheckpoints").GetBoolean(),
                    ["modelDiscovery"] = source.GetProperty("supportsModelDiscovery").GetBoolean(),
                    ["toolSelection"] = source.GetProperty("supportsToolSelection").GetBoolean(),
                },
                ["modelCount"] = source.GetProperty("models").GetArrayLength(),
                ["limitations"] = new Dictionary<string, object?>
                {
                    ["values"] = limitationValues,
                    ["shown"] = limitationValues.Length,
                    ["total"] = limitationValues.Length,
                    ["omitted"] = 0,
                },
                ["observedAt"] = source.GetProperty("observedAt").GetString(),
                ["selected"] = selectedAgent is not null &&
                    Equals(selectedAgent["adapterId"], source.GetProperty("adapterId").GetString()) &&
                    Equals(selectedAgent["agentId"], source.GetProperty("agentId").GetString()),
            };
        }).OrderBy(
            value => $"{value["adapterId"]}:{value["agentId"]}",
            StringComparer.Ordinal).ToArray();
        Dictionary<string, object?> selection;
        if (selectedAgent is null)
        {
            selection = new Dictionary<string, object?> { ["status"] = "unselected" };
        }
        else
        {
            var selectedCapability = capabilities.Single(value =>
                Equals(value["adapterId"], selectedAgent["adapterId"]) &&
                Equals(value["agentId"], selectedAgent["agentId"]));
            selection = new Dictionary<string, object?>
            {
                ["status"] = "selected",
                ["selectionDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(selectedAgent)),
                ["adapterId"] = selectedAgent["adapterId"],
                ["agentId"] = selectedAgent["agentId"],
                ["modelId"] = selectedAgent["modelId"],
                ["modelTruthClass"] = selectedAgent["modelTruthClass"],
                ["modelAlias"] = selectedAgent["modelAlias"],
                ["settings"] = selectedAgent["settings"],
                ["selectedAt"] = selectedAgent["selectedAt"],
                ["capabilityDigest"] = selectedAgent["capabilityDigest"],
                ["capabilityState"] = Equals(
                    selectedCapability["capabilityDigest"],
                    selectedAgent["capabilityDigest"])
                    ? "current"
                    : "stale",
            };
        }
        var selectionCapabilityState = (string)(Equals(selection["status"], "selected")
            ? selection["capabilityState"]!
            : selection["status"]!);
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "agent-model-dashboard",
            ["product"] = ExactReference(
                "product",
                ProductId,
                7,
                mismatchBinding ? $"sha256:{new string('0', 64)}" : productDigest),
            ["capabilities"] = capabilities,
            ["selection"] = selection,
            ["runs"] = Array.Empty<object>(),
            ["handoffs"] = Array.Empty<object>(),
            ["providerMetrics"] = new Dictionary<string, object?>
            {
                ["usage"] = AgentModelUnavailableMetric(),
                ["cost"] = invalidateMetrics
                    ? new Dictionary<string, object?> { ["state"] = "available", ["amount"] = 0 }
                    : AgentModelUnavailableMetric(),
            },
            ["freshness"] = new Dictionary<string, object?>
            {
                ["state"] = invalidateFreshness
                    ? "attention-required"
                    : selectionCapabilityState == "stale" ? "attention-required" : "current",
                ["selectionCapabilityState"] = selectionCapabilityState,
                ["oldestCapabilityObservedAt"] = "2026-07-24T08:00:00.000Z",
                ["newestCapabilityObservedAt"] = "2026-07-24T08:00:00.000Z",
                ["truncated"] = false,
                ["coverageBoundary"] =
                    "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness",
            },
            ["evidenceCues"] = DashboardEvidenceCues(selectionCapabilityState == "stale" ? "stale" : "current"),
            ["limits"] = new Dictionary<string, object?>
            {
                ["capabilities"] = AgentModelLimit(2, invalidateCount ? 3 : 2),
                ["runs"] = AgentModelLimit(0),
                ["handoffs"] = AgentModelLimit(0),
                ["managedRuns"] = AgentModelLimit(0),
                ["truncated"] = false,
            },
            ["observedAt"] = "2026-07-24T12:06:00.000Z",
            ["sourceBoundary"] =
                "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
            ["limitations"] = new[]
            {
                "Capability truth is bounded to current portable observations and does not prove provider-account readiness.",
                "Current managed records have no provider usage or cost contract, so both metrics remain unavailable.",
            },
            ["authorityBoundary"] =
                "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
        };
        if (invalidateEvidenceCues)
        {
            ((Dictionary<string, object?>)((Dictionary<string, object?>)dashboard["evidenceCues"]!)["confidence"]!)["state"] =
                "supported";
        }
        RefreshCanonicalDigest(dashboard, "snapshotDigest");
        if (invalidateDigest) capabilities[0]["agentLabel"] = "Forged label";
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        return dashboard;
    }

    private static async Task HandleAgentModelAsync(
        long id,
        JsonElement parameters,
        Dictionary<string, object?>? selectedAgent,
        bool mismatchBinding,
        bool invalidateCount,
        bool invalidateFreshness,
        bool invalidateMetrics,
        bool invalidateEvidenceCues,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var dashboard = BuildAgentModelDashboard(
            parameters,
            selectedAgent,
            mismatchBinding,
            invalidateCount,
            invalidateFreshness,
            invalidateMetrics,
            invalidateEvidenceCues,
            invalidateDigest,
            includePrivateField);
        if (dashboard is null)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID AGENT MODEL REQUEST");
        }
        else
        {
            await WriteResultAsync(id, dashboard);
        }
    }

    private static async Task HandlePhase2ChangeImpactAgentModelDashboardAsync(
        long id,
        JsonElement parameters,
        Dictionary<string, object?>? selectedAgent,
        long initiativeRevision,
        Dictionary<string, object?>? initiativeClassification,
        Dictionary<string, object?>? initiativeApplicability,
        bool mismatchBinding,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var initiativeRecord = InitiativeRecord(initiativeRevision, initiativeClassification, initiativeApplicability);
        var initiativeDigest = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord));
        if (!HasOnlyProperties(
                parameters,
                "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
                "expectedInitiativeRevision", "expectedInitiativeDigest", "agentModel") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("expectedProductDigest").GetString() != productDigest ||
            parameters.GetProperty("expectedInitiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != initiativeRevision ||
            parameters.GetProperty("expectedInitiativeDigest").GetString() != initiativeDigest)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PHASE 2 INTEGRATED REQUEST");
            return;
        }
        var agentModel = BuildAgentModelDashboard(
            parameters.GetProperty("agentModel"), selectedAgent, mismatchBinding: false, invalidateCount: false,
            invalidateFreshness: false, invalidateMetrics: false, invalidateEvidenceCues: false,
            invalidateDigest: false, includePrivateField: false);
        if (agentModel is null)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PHASE 2 INTEGRATED REQUEST");
            return;
        }
        var capabilities = (Dictionary<string, object?>[])agentModel["capabilities"]!;
        var detected = capabilities.LongCount(capability => Equals(capability["detected"], true));
        var selected = capabilities.LongCount(capability => Equals(capability["selected"], true));
        var selection = (Dictionary<string, object?>)agentModel["selection"]!;
        var nestedFreshness = (Dictionary<string, object?>)agentModel["freshness"]!;
        static Dictionary<string, object?> ZeroCounts(params string[] names) =>
            names.ToDictionary(name => name, _ => (object?)0, StringComparer.Ordinal);
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "phase-2-change-impact-agent-model-dashboard",
            ["viewDefinitionVersion"] = "gaep-phase-2-change-impact-agent-model-dashboard-v1",
            ["phase"] = new Dictionary<string, object?>
            {
                ["id"] = "phase-2-design",
                ["label"] = "Phase 2 — UX and Figma Loop",
            },
            ["product"] = ExactReference("product", ProductId, 7, mismatchBinding ? $"sha256:{new string('0', 64)}" : productDigest),
            ["initiative"] = new Dictionary<string, object?>
            {
                ["recordType"] = "initiative",
                ["recordId"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = initiativeDigest,
                ["state"] = initiativeRecord["state"],
            },
            ["sources"] = new Dictionary<string, object?>
            {
                ["phase2UxFigmaSnapshotDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(new { fixture = "phase2" })),
                ["phase2SourceCatalogDigest"] = CanonicalDigest(JsonSerializer.SerializeToElement(new { expected = 23 })),
                ["agentModelSnapshotDigest"] = agentModel["snapshotDigest"],
            },
            ["synchronizationChange"] = new Dictionary<string, object?>
            {
                ["state"] = "attention-required",
                ["designDelta"] = "unavailable",
                ["conflictResolution"] = "unavailable",
                ["humanDesignApproval"] = "unavailable",
                ["designBaseline"] = "unavailable",
                ["designDriftDetection"] = "unavailable",
                ["figmaConnectionState"] = "not-established",
                ["figmaWriteExecutionState"] = "not-performed",
                ["figmaImportExecutionState"] = "not-performed",
                ["synchronizationEffectState"] = "not-applied",
            },
            ["impact"] = ZeroCounts(
                "requirementCount", "designBindingCount", "unboundDesignItemCount", "driftObservationCount", "driftCount",
                "unassessedCount", "blockerCount", "highSeverityCount", "remediationCandidateCount", "staleBindingCount",
                "staleSourceReferenceCount", "unresolvedQuestionCount").Concat(new Dictionary<string, object?>
                {
                    ["state"] = "current-bounded-observation",
                    ["coverage"] = "bounded-not-complete",
                    ["impactCompleteness"] = "not-established",
                    ["designValidity"] = "not-established",
                    ["revalidationState"] = "not-established",
                }).ToDictionary(value => value.Key, value => value.Value, StringComparer.Ordinal),
            ["agentModel"] = new Dictionary<string, object?>
            {
                ["selectionState"] = selection["status"],
                ["capabilities"] = new Dictionary<string, object?>
                {
                    ["shown"] = capabilities.LongLength,
                    ["total"] = capabilities.LongLength,
                    ["omitted"] = 0,
                    ["detected"] = detected,
                    ["unavailable"] = capabilities.LongLength - detected,
                    ["selected"] = selected,
                },
                ["runs"] = ZeroCounts(
                    "shown", "total", "omitted", "terminal", "nonTerminal", "managedObserved", "resultBound", "actualEffectCount"),
                ["managedRuns"] = ZeroCounts("shown", "total", "omitted"),
                ["handoffs"] = ZeroCounts("shown", "total", "omitted", "pendingAcknowledgement", "acknowledged"),
                ["providerMetrics"] = new Dictionary<string, object?> { ["usage"] = "unavailable", ["cost"] = "unavailable" },
                ["liveProviderQuality"] = "not-assessed",
                ["semanticOutputQuality"] = "not-assessed",
            },
            ["freshness"] = new Dictionary<string, object?>
            {
                ["state"] = "attention-required",
                ["phase2State"] = "attention-required",
                ["agentModelState"] = nestedFreshness["state"],
                ["selectionCapabilityState"] = nestedFreshness["selectionCapabilityState"],
                ["phase2ObservedAt"] = "2026-07-30T03:10:00.000Z",
                ["agentModelObservedAt"] = agentModel["observedAt"],
                ["oldestCapabilityObservedAt"] = nestedFreshness["oldestCapabilityObservedAt"],
                ["newestCapabilityObservedAt"] = nestedFreshness["newestCapabilityObservedAt"],
                ["truncated"] = false,
            },
            ["governance"] = new Dictionary<string, object?>
            {
                ["humanDesignApproval"] = "not-established",
                ["baselineDesignation"] = "not-established",
                ["impactAcceptance"] = "not-established",
                ["providerAccountReadiness"] = "not-established",
                ["providerPreference"] = "not-established",
                ["automaticSelectionAuthority"] = "not-granted",
                ["runLaunchAuthority"] = "not-granted",
                ["effectAuthority"] = "not-granted",
                ["phaseReadinessAuthority"] = "not-established",
                ["productOwnerAcceptance"] = "not-established",
            },
            ["evidenceCues"] = DashboardEvidenceCues("unknown"),
            ["observedAt"] = "2026-07-30T03:12:00.000Z",
            ["sourceBoundary"] = "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only",
            ["privacyBoundary"] =
                "dashboard-exposes-identities-digests-counts-statuses-and-times-not-design-content-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-permissions-or-machine-paths",
            ["limitations"] = new[]
            {
                "Synchronization and impact panels remain exact bounded derived evidence.",
                "Agent and model counts remain bounded to the exact current Initiative.",
                "No dashboard state grants approval, baseline, readiness, remediation, launch, or effect authority.",
            },
            ["authorityBoundary"] =
                "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority",
        };
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        RefreshCanonicalDigest(dashboard, "snapshotDigest");
        if (invalidateDigest)
        {
            ((Dictionary<string, object?>)dashboard["agentModel"]!)["capabilities"] = new Dictionary<string, object?>
            {
                ["shown"] = capabilities.LongLength,
                ["total"] = capabilities.LongLength,
                ["omitted"] = 0,
                ["detected"] = 0,
                ["unavailable"] = capabilities.LongLength - detected,
                ["selected"] = selected,
            };
        }
        await WriteResultAsync(id, dashboard);
    }

    private static async Task HandlePhase1AgentModelAsync(
        long id,
        JsonElement parameters,
        Dictionary<string, object?>? selectedAgent,
        long initiativeRevision,
        Dictionary<string, object?>? initiativeClassification,
        Dictionary<string, object?>? initiativeApplicability,
        bool invalidateCount,
        bool invalidateDigest,
        bool includePrivateField)
    {
        var initiativeRecord = InitiativeRecord(
            initiativeRevision,
            initiativeClassification,
            initiativeApplicability);
        var initiativeDigest = CanonicalDigest(JsonSerializer.SerializeToElement(initiativeRecord));
        if (!HasOnlyProperties(
                parameters,
                "expectedInitiativeId", "expectedInitiativeRevision", "expectedInitiativeDigest", "agentModel") ||
            parameters.GetProperty("expectedInitiativeId").GetString() != InitiativeId.ToString("D") ||
            parameters.GetProperty("expectedInitiativeRevision").GetInt64() != initiativeRevision ||
            parameters.GetProperty("expectedInitiativeDigest").GetString() != initiativeDigest)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PHASE 1 AGENT MODEL REQUEST");
            return;
        }
        var agentModel = BuildAgentModelDashboard(
            parameters.GetProperty("agentModel"),
            selectedAgent,
            mismatchBinding: false,
            invalidateCount: false,
            invalidateFreshness: false,
            invalidateMetrics: false,
            invalidateEvidenceCues: false,
            invalidateDigest: false,
            includePrivateField: false);
        if (agentModel is null)
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PHASE 1 AGENT MODEL REQUEST");
            return;
        }
        var capabilities = (Dictionary<string, object?>[])agentModel["capabilities"]!;
        var detected = capabilities.LongCount(capability => Equals(capability["detected"], true));
        var selected = capabilities.LongCount(capability => Equals(capability["selected"], true));
        var productDigest = CanonicalDigest(JsonSerializer.SerializeToElement(ProductRecord(7)));
        var nestedFreshness = (Dictionary<string, object?>)agentModel["freshness"]!;
        var dashboard = new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["kind"] = "phase-1-agent-model-dashboard",
            ["phase"] = new Dictionary<string, object?>
            {
                ["id"] = "phase-1b-product",
                ["label"] = "Phase 1B — Product P0–P4",
            },
            ["product"] = ExactReference("product", ProductId, 7, productDigest),
            ["initiative"] = new Dictionary<string, object?>
            {
                ["recordType"] = "initiative",
                ["recordId"] = InitiativeId.ToString("D"),
                ["revision"] = initiativeRevision,
                ["digest"] = initiativeDigest,
                ["state"] = "active",
            },
            ["source"] = new Dictionary<string, object?>
            {
                ["agentModelSnapshotDigest"] = agentModel["snapshotDigest"],
                ["scope"] = "exact-current-initiative",
            },
            ["agentModel"] = agentModel,
            ["executionTruth"] = new Dictionary<string, object?>
            {
                ["capabilities"] = new Dictionary<string, object?>
                {
                    ["shown"] = capabilities.LongLength,
                    ["total"] = invalidateCount ? capabilities.LongLength + 1 : capabilities.LongLength,
                    ["omitted"] = 0,
                    ["detected"] = detected,
                    ["unavailable"] = capabilities.LongLength - detected,
                    ["selected"] = selected,
                },
                ["runs"] = new Dictionary<string, object?>
                {
                    ["shown"] = 0,
                    ["total"] = 0,
                    ["omitted"] = 0,
                    ["terminal"] = 0,
                    ["nonTerminal"] = 0,
                    ["managedObserved"] = 0,
                    ["resultBound"] = 0,
                    ["actualEffectCount"] = 0,
                    ["outcomes"] = new Dictionary<string, object?>
                    {
                        ["satisfied"] = 0,
                        ["failed"] = 0,
                        ["notAssessed"] = 0,
                        ["indeterminate"] = 0,
                    },
                },
                ["managedRuns"] = AgentModelLimit(0),
                ["handoffs"] = new Dictionary<string, object?>
                {
                    ["shown"] = 0,
                    ["total"] = 0,
                    ["omitted"] = 0,
                    ["pendingAcknowledgement"] = 0,
                    ["acknowledged"] = 0,
                },
                ["providerMetrics"] = new Dictionary<string, object?>
                {
                    ["usage"] = "unavailable",
                    ["cost"] = "unavailable",
                },
                ["liveProviderQuality"] = "not-assessed",
                ["semanticOutputQuality"] = "not-assessed",
            },
            ["freshness"] = new Dictionary<string, object?>
            {
                ["state"] = nestedFreshness["state"],
                ["selectionCapabilityState"] = nestedFreshness["selectionCapabilityState"],
                ["oldestCapabilityObservedAt"] = nestedFreshness["oldestCapabilityObservedAt"],
                ["newestCapabilityObservedAt"] = nestedFreshness["newestCapabilityObservedAt"],
                ["agentModelObservedAt"] = agentModel["observedAt"],
                ["truncated"] = false,
                ["basis"] = "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage",
            },
            ["governance"] = new Dictionary<string, object?>
            {
                ["providerAccountReadiness"] = "not-established",
                ["providerPreference"] = "not-established",
                ["automaticSelectionAuthority"] = "not-granted",
                ["handoffAcknowledgementAuthority"] = "not-granted",
                ["runLaunchAuthority"] = "not-granted",
                ["effectAuthority"] = "not-granted",
                ["phaseReadinessAuthority"] = "not-established",
                ["productOwnerAcceptance"] = "not-established",
            },
            ["observedAt"] = "2026-07-24T12:06:01.000Z",
            ["sourceBoundary"] =
                "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only",
            ["privacyBoundary"] =
                "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths",
            ["limitations"] = new[]
            {
                "Capability observations prove only bounded adapter/runtime metadata, not provider account readiness.",
                "Provider usage and cost remain unavailable because no governed provider metric contract is bound.",
            },
            ["authorityBoundary"] =
                "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority",
        };
        RefreshCanonicalDigest(dashboard, "snapshotDigest");
        if (invalidateDigest)
        {
            ((Dictionary<string, object?>)((Dictionary<string, object?>)dashboard["executionTruth"]!)["capabilities"]!)["detected"] = 2;
        }
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, dashboard);
    }

    private static Dictionary<string, object?> AgentModelUnavailableMetric() => new()
    {
        ["state"] = "unavailable",
        ["basis"] = "current-managed-records-have-no-provider-usage-or-cost-contract",
    };

    private static Dictionary<string, object?> DashboardEvidenceCues(string freshness) => new()
    {
        ["freshness"] = freshness,
        ["confidence"] = new Dictionary<string, object?>
        {
            ["state"] = "not-assessed",
            ["basis"] = "no-governed-confidence-evaluation-is-bound",
        },
    };

    private static Dictionary<string, object?> AgentModelLimit(int shown, int? total = null) => new()
    {
        ["shown"] = shown,
        ["total"] = total ?? shown,
        ["omitted"] = (total ?? shown) - shown,
    };

    private static Dictionary<string, object?> ExactReference(
        string recordType,
        Guid recordId,
        long revision,
        string digest) =>
        new()
        {
            ["recordType"] = recordType,
            ["recordId"] = recordId.ToString("D"),
            ["revision"] = revision,
            ["digest"] = digest,
        };

    private static Dictionary<string, object?> ChangeArtifact(
        Dictionary<string, object?> workItem,
        Dictionary<string, object?> locator) =>
        new()
        {
            ["sourceWorkItem"] = workItem,
            ["locator"] = locator,
        };

    private static Dictionary<string, object?> ChangeImpactLimit() => new()
    {
        ["shown"] = 1,
        ["total"] = 1,
        ["omitted"] = 0,
    };

    private static async Task HandleProbeAgentsAsync(long id, JsonElement parameters, bool includePrivatePath)
    {
        if (!HasOnlyProperties(parameters))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID READINESS");
            return;
        }
        var snapshots = ReadinessSnapshots();
        if (includePrivatePath) snapshots[0]["runtimeExecutable"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, snapshots);
    }

    private static async Task HandleImportAsync(long id, JsonElement parameters)
    {
        if (!HasOnlyProperties(parameters, "bundleRoot", "expectedProductId", "expectedProductRevision", "actorId") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("actorId").GetString() is not (
                "founder.portable-design-review" or "founder.review" or "gaep.visual-studio-local-human"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PARAMS");
            return;
        }
        var bundleRoot = parameters.GetProperty("bundleRoot").GetString()!;
        if (Path.GetFileName(bundleRoot) == "source-error")
        {
            await WriteErrorAsync(
                id,
                -32_030,
                "PORTABLE_DESIGN_SOURCE_INVALID",
                $"Malformed bundle at {PrivateRoot}; password={PrivateCredential}");
            return;
        }
        await WriteResultAsync(id, Snapshot());
    }

    private static async Task HandleListAsync(long id, JsonElement parameters)
    {
        if (!HasOnlyProperties(parameters, "offset", "limit"))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID LIST");
            return;
        }
        var offset = parameters.GetProperty("offset").GetInt32();
        var limit = parameters.GetProperty("limit").GetInt32();
        var items = offset == 9_999
            ? Enumerable.Range(0, 201).Select(_ => Snapshot()).ToArray()
            : offset == 0 ? [Snapshot()] : [];
        await WriteResultAsync(id, new Dictionary<string, object?>
        {
            ["items"] = items,
            ["offset"] = offset,
            ["limit"] = limit,
            ["total"] = offset == 9_999 ? 10_200 : 1,
            ["hasMore"] = offset == 9_999,
            ["governanceBoundary"] = "Every item remains pending human review; source review is an upstream claim only.",
            ["privacyBoundary"] = "Items contain validated metadata and digests only; local paths and source content are omitted.",
        });
    }

    private static async Task HandleReadAsync(long id, JsonElement parameters)
    {
        if (!HasOnlyProperties(parameters, "bundleId") ||
            !Guid.TryParseExact(parameters.GetProperty("bundleId").GetString(), "D", out var bundleId))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID READ");
            return;
        }
        if (bundleId == MissingBundleId)
        {
            await WriteErrorAsync(id, -32_035, "PORTABLE_DESIGN_NOT_FOUND", $"Missing {PrivateRoot}; token={PrivateCredential}");
            return;
        }
        if (bundleId == ExtraErrorEnvelopeBundleId)
        {
            await Console.Out.WriteLineAsync(JsonSerializer.Serialize(new
            {
                jsonrpc = "2.0",
                id,
                error = new
                {
                    code = -32_035,
                    message = $"Missing {PrivateRoot}; token={PrivateCredential}",
                    data = new { kind = "PORTABLE_DESIGN_NOT_FOUND" },
                },
                result = Snapshot(),
                bundleRoot = PrivateRoot,
            }));
            await Console.Out.FlushAsync();
            return;
        }
        if (bundleId == WrongErrorCodeBundleId)
        {
            await WriteErrorAsync(
                id,
                -32_030,
                "PORTABLE_DESIGN_NOT_FOUND",
                $"Mismatched kind and code at {PrivateRoot}; password={PrivateCredential}");
            return;
        }
        if (bundleId == OversizedBundleId)
        {
            await Console.Out.WriteLineAsync(JsonSerializer.Serialize(new
            {
                jsonrpc = "2.0",
                id,
                result = new { padding = new string('x', 1024 * 1024 + 1) },
            }));
            await Console.Out.FlushAsync();
            return;
        }
        var snapshot = Snapshot(bundleId == MismatchedBundleId ? BundleId : bundleId);
        if (bundleId == ExtraFieldBundleId) snapshot["bundleRoot"] = $"{PrivateRoot}/{PrivateCredential}";
        await WriteResultAsync(id, snapshot);
    }

    private static Dictionary<string, object?> Snapshot(Guid? bundleId = null) => new()
    {
        ["schemaVersion"] = 1,
        ["kind"] = "portable-design-snapshot-summary",
        ["bundleId"] = (bundleId ?? BundleId).ToString("D"),
        ["productId"] = ProductId.ToString("D"),
        ["initiativeId"] = InitiativeId.ToString("D"),
        ["title"] = "Imported Product Design",
        ["classification"] = "confidential",
        ["governance"] = new Dictionary<string, object?>
        {
            ["state"] = "pending-human-review",
            ["humanReviewRequired"] = true,
            ["claimBoundary"] = "import-validation-is-not-design-approval-or-baseline",
            ["nonEscalation"] = "not-gaep-approval-design-baseline-implementation-or-release-readiness",
        },
        ["sourceReview"] = new Dictionary<string, object?>
        {
            ["status"] = "approved",
            ["claimLabel"] = "approved upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness",
            ["gaepApproval"] = false,
        },
        ["source"] = new Dictionary<string, object?>
        {
            ["tool"] = "figma",
            ["exportMethod"] = "manual-export",
        },
        ["counts"] = new Dictionary<string, object?>
        {
            ["artifacts"] = 2,
            ["normalizedDesignTokens"] = 1,
            ["validationChecks"] = 6,
            ["recordedLimitations"] = 5,
        },
        ["digests"] = new Dictionary<string, object?>
        {
            ["snapshot"] = $"sha256:{new string('a', 64)}",
            ["evidence"] = $"sha256:{new string('b', 64)}",
            ["manifest"] = $"sha256:{new string('c', 64)}",
            ["artifactInventory"] = $"sha256:{new string('d', 64)}",
        },
        ["timestamps"] = new Dictionary<string, object?>
        {
            ["sourceExportedAt"] = "2026-07-24T00:00:00.000Z",
            ["importedAt"] = "2026-07-24T00:01:00.000Z",
        },
        ["privacyBoundary"] = "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.",
    };

    private static List<Dictionary<string, object?>> ReadinessSnapshots() =>
    [
        new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["adapterId"] = "openai-codex",
            ["adapterVersion"] = "0.1.0",
            ["agentId"] = "codex",
            ["agentLabel"] = "OpenAI Codex",
            ["runtimeVersion"] = "0.42.0",
            ["detected"] = true,
            ["executionInterface"] = "cli-jsonl",
            ["interfaceMaturity"] = "beta",
            ["supportsResume"] = true,
            ["supportsCancel"] = true,
            ["supportsCheckpoints"] = true,
            ["supportsModelDiscovery"] = true,
            ["supportsToolSelection"] = true,
            ["settings"] = new[]
            {
                new Dictionary<string, object?>
                {
                    ["key"] = "reasoningEffort",
                    ["label"] = "Reasoning effort",
                    ["description"] = "Provider-declared reasoning effort for a future governed run.",
                    ["kind"] = "select",
                    ["required"] = false,
                    ["sensitive"] = false,
                    ["options"] = new[]
                    {
                        new Dictionary<string, object?> { ["value"] = "high", ["label"] = "High" },
                        new Dictionary<string, object?> { ["value"] = "medium", ["label"] = "Medium" },
                    },
                    ["truthClass"] = "provider-declared",
                },
            },
            ["models"] = new[]
            {
                new Dictionary<string, object?>
                {
                    ["id"] = "gpt-5.6-codex",
                    ["label"] = "GPT-5.6 Codex",
                    ["description"] = "Observed local Codex model metadata.",
                    ["reasoningOptions"] = new[] { "high" },
                    ["contextWindow"] = 200_000,
                    ["inputModalities"] = new[] { "text", "image" },
                    ["truthClass"] = "observed",
                    ["alias"] = false,
                },
                new Dictionary<string, object?>
                {
                    ["id"] = "gpt-5.6-codex-next",
                    ["label"] = "GPT-5.6 Codex Next",
                    ["description"] = "Observed local Codex model metadata for a reviewed handoff target.",
                    ["reasoningOptions"] = new[] { "medium", "high" },
                    ["contextWindow"] = 200_000,
                    ["inputModalities"] = new[] { "text", "image" },
                    ["truthClass"] = "observed",
                    ["alias"] = false,
                },
            },
            ["limitations"] = new[] { "Capability observation does not authorize execution." },
            ["observedAt"] = "2026-07-24T08:00:00.000Z",
        },
        new Dictionary<string, object?>
        {
            ["schemaVersion"] = 1,
            ["adapterId"] = "anthropic-claude-code",
            ["adapterVersion"] = "0.1.0",
            ["agentId"] = "claude-code",
            ["agentLabel"] = "Anthropic Claude Code",
            ["detected"] = false,
            ["executionInterface"] = "unavailable",
            ["interfaceMaturity"] = "unknown",
            ["supportsResume"] = false,
            ["supportsCancel"] = false,
            ["supportsCheckpoints"] = false,
            ["supportsModelDiscovery"] = false,
            ["supportsToolSelection"] = false,
            ["settings"] = Array.Empty<object>(),
            ["models"] = Array.Empty<object>(),
            ["limitations"] = new[] { "The local Claude Code runtime was not observed." },
            ["observedAt"] = "2026-07-24T08:00:00.000Z",
        },
    ];

    private static async Task WriteResultAsync(long id, object result)
    {
        await Console.Out.WriteLineAsync(JsonSerializer.Serialize(new { jsonrpc = "2.0", id, result }));
        await Console.Out.FlushAsync();
    }

    private static async Task WriteErrorAsync(long id, int code, string kind, string rawMessage)
    {
        await Console.Out.WriteLineAsync(JsonSerializer.Serialize(new
        {
            jsonrpc = "2.0",
            id,
            error = new
            {
                code,
                message = rawMessage,
                data = new
                {
                    kind,
                    detail = new { bundleRoot = PrivateRoot, credential = PrivateCredential },
                },
            },
        }));
        await Console.Out.FlushAsync();
    }

    private static bool HasOnlyProperties(JsonElement element, params string[] names)
    {
        var allowed = names.ToHashSet(StringComparer.Ordinal);
        var actual = element.EnumerateObject().Select(property => property.Name).ToArray();
        return actual.Length == allowed.Count && actual.All(allowed.Contains);
    }
}
