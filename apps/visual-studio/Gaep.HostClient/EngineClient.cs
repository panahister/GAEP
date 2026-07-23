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
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private readonly byte[] responseReadBuffer = new byte[8192];
    private readonly List<byte> pendingResponseBytes = [];
    private Process? process;
    private string? boundEnginePath;
    private string? boundEngineDigest;
    private long nextId;
    private bool disposed;

    public EngineClient(
        string workspacePath,
        string? engineExecutable = null,
        string? expectedEngineSha256 = null)
    {
        this.workspacePath = Path.GetFullPath(workspacePath);
        requestedEngineExecutable = engineExecutable
            ?? Environment.GetEnvironmentVariable("GAEP_ENGINE_EXECUTABLE")
            ?? "gaep-engine";
        configuredEngineDigest = NormalizeDigest(
            expectedEngineSha256 ?? Environment.GetEnvironmentVariable("GAEP_ENGINE_SHA256"));
    }

    public async Task<JsonDocument> RequestAsync(
        string method,
        IReadOnlyDictionary<string, object?>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        await requestGate.WaitAsync(cancellationToken);
        try
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            StartIfNeeded();
            var id = Interlocked.Increment(ref nextId);
            var request = JsonSerializer.Serialize(new
            {
                jsonrpc = "2.0",
                id,
                method,
                @params = parameters ?? new Dictionary<string, object?>(),
            });
            await process!.StandardInput.WriteLineAsync(request.AsMemory(), cancellationToken);
            await process.StandardInput.FlushAsync(cancellationToken);
            var response = await ReadBoundedResponseAsync(cancellationToken);
            var document = JsonDocument.Parse(response);
            if (!document.RootElement.TryGetProperty("id", out var responseId) || responseId.GetInt64() != id)
            {
                document.Dispose();
                throw new InvalidOperationException("GAEP engine returned an unexpected response identity.");
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

    private void StartIfNeeded()
    {
        if (process is { HasExited: false }) return;
        process?.Dispose();
        process = null;
        pendingResponseBytes.Clear();
        var identity = ResolveAndVerifyEngine();
        var start = new ProcessStartInfo
        {
            FileName = identity.Path,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
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

    private static StringComparer PathComparer => OperatingSystem.IsWindows()
        ? StringComparer.OrdinalIgnoreCase
        : StringComparer.Ordinal;

    private static string ResolveExecutable(string requested)
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
                ? (Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT").Split(';', StringSplitOptions.RemoveEmptyEntries)
                : [""];
            foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? "")
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

    private async Task<string> ReadBoundedResponseAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            var newline = pendingResponseBytes.IndexOf((byte)'\n');
            if (newline >= 0)
            {
                if (newline > MaxResponseFrameBytes)
                {
                    throw new InvalidOperationException("GAEP engine response exceeds the configured byte limit.");
                }
                var length = newline > 0 && pendingResponseBytes[newline - 1] == (byte)'\r' ? newline - 1 : newline;
                var frame = pendingResponseBytes.GetRange(0, length).ToArray();
                pendingResponseBytes.RemoveRange(0, newline + 1);
                return StrictUtf8.GetString(frame);
            }
            if (pendingResponseBytes.Count > MaxResponseFrameBytes)
            {
                throw new InvalidOperationException("GAEP engine response exceeds the configured byte limit.");
            }
            var read = await process!.StandardOutput.BaseStream.ReadAsync(responseReadBuffer, cancellationToken);
            if (read == 0) throw new InvalidOperationException("GAEP engine closed before responding.");
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
