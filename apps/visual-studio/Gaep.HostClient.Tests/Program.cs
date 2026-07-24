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
        var badRunsRoot = Path.Combine(temporaryRoot, "bad-runs");
        var badHandoffRoot = Path.Combine(temporaryRoot, "bad-handoff");
        var badHandoffBindingRoot = Path.Combine(temporaryRoot, "bad-handoff-binding");
        var badDashboardBindingRoot = Path.Combine(temporaryRoot, "bad-dashboard-binding");
        var badDashboardApplicabilityRoot = Path.Combine(temporaryRoot, "bad-dashboard-applicability");
        var badDashboardDigestRoot = Path.Combine(temporaryRoot, "bad-dashboard-digest");
        var badDashboardPrivateRoot = Path.Combine(temporaryRoot, "bad-dashboard-private");
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
        Directory.CreateDirectory(badRunsRoot);
        Directory.CreateDirectory(badHandoffRoot);
        Directory.CreateDirectory(badHandoffBindingRoot);
        Directory.CreateDirectory(badDashboardBindingRoot);
        Directory.CreateDirectory(badDashboardApplicabilityRoot);
        Directory.CreateDirectory(badDashboardDigestRoot);
        Directory.CreateDirectory(badDashboardPrivateRoot);
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

        var dashboard = await client.ReadPhaseDashboardAsync(product);
        Check(dashboard.Phase == DeliveryPhaseId.Phase0Foundation &&
              dashboard.Panels.Select(panel => panel.Id).SequenceEqual([
                  "foundation-summary", "change-impact", "agent-model",
              ]),
            "Typed phase dashboard preserves the explicit phase and canonical three-panel order");
        Check(dashboard.Panels.Select(panel => panel.State).SequenceEqual([
                  "attention-required", "active", "active",
              ]) && dashboard.ProductDigest == product.Digest,
            "Typed phase dashboard preserves conservative applicability state and exact Product binding");
        var dashboardOutput = await new ProductWorkflowController(client).ReadPhaseDashboardAsync();
        Check(dashboardOutput.Contains("GAEP phase-scoped dashboard framework", StringComparison.Ordinal) &&
              dashboardOutput.Contains("applicability=unknown (not-evaluated)", StringComparison.Ordinal) &&
              dashboardOutput.Contains("grants no mutation, applicability, phase-entry", StringComparison.Ordinal) &&
              !dashboardOutput.Contains("Founder Product", StringComparison.Ordinal) &&
              !dashboardOutput.Contains(PrivateRoot, StringComparison.Ordinal) &&
              !dashboardOutput.Contains(PrivateCredential, StringComparison.Ordinal),
            "Phase-dashboard workflow renders only bounded metadata and an explicit no-authority boundary");
        foreach (var hostileRoot in new[]
                 {
                     badDashboardBindingRoot,
                     badDashboardApplicabilityRoot,
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
                "Phase dashboard rejects hostile binding, applicability, digest, and private-field drift");
        }
        await ExpectAsync<ArgumentException>(
            () => client.ReadPhaseDashboardAsync(product with { Digest = "sha256:not-a-digest" }),
            "Invalid Product dashboard digests fail before transport");

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

    private static async Task RunFakeHostAsync(string workspace)
    {
        var productReadCount = 0;
        var changeProductContext = Path.GetFileName(workspace) == "product-change";
        var badReadiness = Path.GetFileName(workspace) == "bad-readiness";
        var badSelection = Path.GetFileName(workspace) == "bad-selection";
        var badRuns = Path.GetFileName(workspace) == "bad-runs";
        var badHandoff = Path.GetFileName(workspace) == "bad-handoff";
        var badHandoffBinding = Path.GetFileName(workspace) == "bad-handoff-binding";
        var badDashboardBinding = Path.GetFileName(workspace) == "bad-dashboard-binding";
        var badDashboardApplicability = Path.GetFileName(workspace) == "bad-dashboard-applicability";
        var badDashboardDigest = Path.GetFileName(workspace) == "bad-dashboard-digest";
        var badDashboardPrivate = Path.GetFileName(workspace) == "bad-dashboard-private";
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
                case "dashboard.framework":
                    await HandlePhaseDashboardAsync(
                        id,
                        parameters,
                        badDashboardBinding,
                        badDashboardApplicability,
                        badDashboardDigest,
                        badDashboardPrivate);
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
        RefreshCanonicalDigest(dashboard, "compositionDigest");
        if (invalidateDigest)
        {
            ((Dictionary<string, object?>[])dashboard["panels"]!)[0]["title"] = "Forged dashboard title";
        }
        if (includePrivateField) dashboard["sourceRoot"] = $"{PrivateRoot}/{PrivateCredential}";
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
