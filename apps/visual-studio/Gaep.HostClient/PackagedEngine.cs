using System.Security.Cryptography;

namespace Gaep.HostClient;

public sealed record PackagedEngineModule(string Path, string ExpectedSha256);

public static class VisualStudioPackagedEngine
{
    private const int MaxEngineBytes = 8 * 1024 * 1024;

    public static PackagedEngineModule Materialize(string? cacheRoot = null)
    {
        var bytes = ReadVerifiedResource();
        var root = cacheRoot ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "GAEP",
            "engines");
        if (string.IsNullOrWhiteSpace(root))
        {
            throw new InvalidOperationException("The local GAEP engine cache root could not be resolved.");
        }
        root = Path.GetFullPath(root);
        var digestRoot = Path.Combine(root, PackagedEngineBuild.Sha256);
        Directory.CreateDirectory(digestRoot);
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(
                digestRoot,
                UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }

        var target = Path.Combine(digestRoot, "gaep-engine.mjs");
        if (!File.Exists(target))
        {
            var candidate = Path.Combine(digestRoot, $".{Guid.NewGuid():N}.tmp");
            try
            {
                using (var output = new FileStream(
                    candidate,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    bufferSize: 8192,
                    FileOptions.WriteThrough))
                {
                    output.Write(bytes);
                    output.Flush(flushToDisk: true);
                }
                try
                {
                    File.Move(candidate, target);
                }
                catch (IOException) when (File.Exists(target))
                {
                    // Another verified host instance won the digest-keyed cache race.
                }
            }
            finally
            {
                if (File.Exists(candidate)) File.Delete(candidate);
            }
        }
        VerifyRegularFile(target, PackagedEngineBuild.Sha256);
        return new PackagedEngineModule(target, PackagedEngineBuild.Sha256);
    }

    private static byte[] ReadVerifiedResource()
    {
        var assembly = typeof(VisualStudioPackagedEngine).Assembly;
        using var input = assembly.GetManifestResourceStream(PackagedEngineBuild.ResourceName)
            ?? throw new InvalidOperationException("The package-local GAEP engine resource is missing.");
        using var output = new MemoryStream();
        var buffer = new byte[8192];
        while (true)
        {
            var read = input.Read(buffer, 0, buffer.Length);
            if (read == 0) break;
            if (output.Length + read > MaxEngineBytes)
            {
                throw new InvalidOperationException("The package-local GAEP engine exceeds its 8 MiB boundary.");
            }
            output.Write(buffer, 0, read);
        }
        var bytes = output.ToArray();
        if (bytes.Length == 0 || !StringComparer.Ordinal.Equals(Sha256(bytes), PackagedEngineBuild.Sha256))
        {
            throw new InvalidOperationException("The package-local GAEP engine does not match its embedded identity.");
        }
        return bytes;
    }

    private static void VerifyRegularFile(string path, string expectedDigest)
    {
        var info = new FileInfo(path);
        if (!info.Exists || info.LinkTarget is not null || info.Length is < 1 or > MaxEngineBytes)
        {
            throw new InvalidOperationException("The materialized GAEP engine is not a bounded regular file.");
        }
        using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        var digest = Convert.ToHexString(SHA256.HashData(input)).ToLowerInvariant();
        if (!StringComparer.Ordinal.Equals(digest, expectedDigest))
        {
            throw new InvalidOperationException("The materialized GAEP engine does not match its embedded identity.");
        }
    }

    private static string Sha256(byte[] bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
}

public static class VisualStudioEngineClientFactory
{
    public static EngineClient Create(
        string workspacePath,
        IReadOnlyDictionary<string, string>? environment = null,
        string? cacheRoot = null)
    {
        environment ??= CaptureEnvironment();
        var external = EnvironmentValue(environment, "GAEP_ENGINE_EXECUTABLE")?.Trim();
        if (!string.IsNullOrEmpty(external))
        {
            return new EngineClient(
                workspacePath,
                external,
                EnvironmentValue(environment, "GAEP_ENGINE_SHA256"),
                sourceEnvironment: environment);
        }

        var runtime = EnvironmentValue(environment, "GAEP_ENGINE_RUNTIME_EXECUTABLE")?.Trim();
        if (string.IsNullOrEmpty(runtime) || !Path.IsPathRooted(runtime))
        {
            throw new ArgumentException(
                "Set GAEP_ENGINE_RUNTIME_EXECUTABLE to one absolute Node-compatible runtime before using the package-local Visual Studio engine. PATH fallback is disabled.");
        }
        return new EngineClient(
            workspacePath,
            runtime,
            EnvironmentValue(environment, "GAEP_ENGINE_RUNTIME_SHA256"),
            VisualStudioPackagedEngine.Materialize(cacheRoot),
            environment);
    }

    internal static Dictionary<string, string> SafeEngineEnvironment(
        IReadOnlyDictionary<string, string> source)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var name in new[]
        {
            "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP",
            "SYSTEMROOT", "WINDIR", "PATHEXT", "COMSPEC",
        })
        {
            var value = EnvironmentValue(source, name);
            if (value is not null) result[name] = value;
        }
        result["GAEP_HOST_SURFACE"] = "visual-studio-product-studio";
        return result;
    }

    internal static string? EnvironmentValue(IReadOnlyDictionary<string, string> source, string requested) =>
        source.FirstOrDefault(entry => string.Equals(entry.Key, requested, StringComparison.OrdinalIgnoreCase)).Value;

    private static Dictionary<string, string> CaptureEnvironment()
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (System.Collections.DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            if (entry.Key is string key && entry.Value is string value) result[key] = value;
        }
        return result;
    }
}
