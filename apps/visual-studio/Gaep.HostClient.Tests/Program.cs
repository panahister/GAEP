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
    private const string PrivateRoot = "/Users/private/design-bundle";
    private const string PrivateCredential = "PRIVATE-OAUTH-TOKEN";
    private static int passed;

    private static async Task<int> Main(string[] args)
    {
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
        Directory.CreateDirectory(bundleRoot);
        Directory.CreateDirectory(invalidSourceRoot);
        Directory.CreateDirectory(badReadinessRoot);
        Directory.CreateDirectory(badSelectionRoot);
        var executable = Environment.ProcessPath;
        Check(executable is not null && File.Exists(executable), "Test app host executable is available");

        await using var client = new EngineClient(temporaryRoot, executable);
        var product = await client.ReadProductBindingAsync();
        Check(product == new ProductBinding(ProductId, "Founder Product", 7),
            "Typed Product binding returns exact identity and revision while ignoring unrelated Product fields");
        Check(!JsonSerializer.Serialize(product).Contains(PrivateRoot, StringComparison.Ordinal),
            "Typed Product binding does not expose unrelated private Product fields");

        var readiness = await client.ProbeAgentReadinessAsync();
        Check(readiness.Select(snapshot => snapshot.AgentId).SequenceEqual(["claude-code", "codex"]),
            "Typed readiness returns deterministic Codex and Claude observations");
        Check(!readiness[0].Detected && readiness[1].Models.Single().Id == "gpt-5.6-codex" &&
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

    private static async Task RunFakeHostAsync(string workspace)
    {
        var productReadCount = 0;
        var changeProductContext = Path.GetFileName(workspace) == "product-change";
        var badReadiness = Path.GetFileName(workspace) == "bad-readiness";
        var badSelection = Path.GetFileName(workspace) == "bad-selection";
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

    private static async Task HandleReadProductAsync(long id, JsonElement parameters, long revision)
    {
        if (!HasOnlyProperties(parameters))
        {
            await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PRODUCT READ");
            return;
        }
        await WriteResultAsync(id, new Dictionary<string, object?>
        {
            ["id"] = ProductId.ToString("D"),
            ["name"] = "Founder Product",
            ["revision"] = revision,
            ["lifecycleState"] = "candidate",
            ["privateWorkspace"] = PrivateRoot,
        });
    }

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
                    ["options"] = new[] { new Dictionary<string, object?> { ["value"] = "high", ["label"] = "High" } },
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
