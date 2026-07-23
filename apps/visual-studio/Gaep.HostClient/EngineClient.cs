using System.Diagnostics;
using System.Text.Json;

namespace Gaep.HostClient;

public sealed class EngineClient : IAsyncDisposable
{
    private readonly string workspacePath;
    private readonly string engineExecutable;
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private Process? process;
    private long nextId;
    private bool disposed;

    public EngineClient(string workspacePath, string? engineExecutable = null)
    {
        this.workspacePath = Path.GetFullPath(workspacePath);
        this.engineExecutable = engineExecutable
            ?? Environment.GetEnvironmentVariable("GAEP_ENGINE_EXECUTABLE")
            ?? "gaep-engine";
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
            EnsureStarted();
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
            var response = await process.StandardOutput.ReadLineAsync(cancellationToken)
                ?? throw new InvalidOperationException("GAEP engine closed before responding.");
            var document = JsonDocument.Parse(response);
            if (!document.RootElement.TryGetProperty("id", out var responseId) || responseId.GetInt64() != id)
            {
                document.Dispose();
                throw new InvalidOperationException("GAEP engine returned an unexpected response identity.");
            }
            return document;
        }
        finally
        {
            requestGate.Release();
        }
    }

    private void EnsureStarted()
    {
        if (process is { HasExited: false }) return;
        process?.Dispose();
        var start = new ProcessStartInfo
        {
            FileName = engineExecutable,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        start.ArgumentList.Add("--workspace");
        start.ArgumentList.Add(workspacePath);
        process = Process.Start(start) ?? throw new InvalidOperationException("Unable to start the GAEP engine host.");
        process.ErrorDataReceived += static (_, _) => { };
        process.BeginErrorReadLine();
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        await requestGate.WaitAsync();
        try
        {
            if (disposed) return;
            disposed = true;
            if (process is null) return;
            process.StandardInput.Close();
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync();
            }
            process.Dispose();
            process = null;
        }
        finally
        {
            requestGate.Release();
        }
    }
}
