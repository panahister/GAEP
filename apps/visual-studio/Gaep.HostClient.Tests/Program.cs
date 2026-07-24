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
        if (args.Contains("--workspace", StringComparer.Ordinal))
        {
            await RunFakeHostAsync();
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
        Directory.CreateDirectory(bundleRoot);
        Directory.CreateDirectory(invalidSourceRoot);
        var executable = Environment.ProcessPath;
        Check(executable is not null && File.Exists(executable), "Test app host executable is available");

        await using var client = new EngineClient(temporaryRoot, executable);
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

    private static async Task RunFakeHostAsync()
    {
        while (await Console.In.ReadLineAsync() is { } line)
        {
            using var request = JsonDocument.Parse(line);
            var root = request.RootElement;
            var id = root.GetProperty("id").GetInt64();
            if (!HasOnlyProperties(root, "jsonrpc", "id", "method", "params", "protocolVersion") ||
                root.GetProperty("jsonrpc").GetString() != "2.0" || root.GetProperty("protocolVersion").GetInt32() != 2)
            {
                await WriteErrorAsync(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ENVELOPE");
                continue;
            }
            var method = root.GetProperty("method").GetString();
            var parameters = root.GetProperty("params");
            switch (method)
            {
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

    private static async Task HandleImportAsync(long id, JsonElement parameters)
    {
        if (!HasOnlyProperties(parameters, "bundleRoot", "expectedProductId", "expectedProductRevision", "actorId") ||
            parameters.GetProperty("expectedProductId").GetString() != ProductId.ToString("D") ||
            parameters.GetProperty("expectedProductRevision").GetInt64() != 7 ||
            parameters.GetProperty("actorId").GetString() is not ("founder.portable-design-review" or "founder.review"))
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
