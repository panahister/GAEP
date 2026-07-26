using Gaep.HostClient;

namespace Gaep.VisualStudio;

/// <summary>
/// GAEP-P0-CS02 — the read-only provider/model workflow driven over the shared Engine Host
/// (protocol v3): dashboardProjection, providerCatalog, selectProviderModel, startReadOnlyAnalysis,
/// readAnalysisRun, and cancelAnalysisRun. It derives no truth of its own (INV-11); every result is
/// the raw governed payload returned by the engine over the same persistent client per Product root.
/// </summary>
public sealed class GaepToolWindowContent : IAsyncDisposable
{
    private readonly EngineClient client;

    public GaepToolWindowContent(string workspacePath, string extensionInstallDir)
    {
        // One persistent client per Product root, reused across every v3 call.
        this.client = new EngineClient(workspacePath, extensionInstallDir);
    }

    public Task<string> LoadProjectionJsonAsync(CancellationToken cancellationToken)
        => this.RequestResultAsync("dashboardProjection", null, cancellationToken);

    public Task<string> ProviderCatalogJsonAsync(CancellationToken cancellationToken)
        => this.RequestResultAsync("providerCatalog", null, cancellationToken);

    // Request construction + validation is centralized in the unit-tested GaepRequests (no empty
    // Context Pack list; non-blank objective; run-scoped params) so the UI cannot form an invalid call.
    public Task<string> SelectProviderModelAsync(string adapterId, string modelId, CancellationToken cancellationToken)
        => this.RequestResultAsync("selectProviderModel", GaepRequests.SelectProviderModel(adapterId, modelId), cancellationToken);

    public Task<string> StartReadOnlyAnalysisAsync(string objective, IReadOnlyList<string> contextPackIds, CancellationToken cancellationToken)
        => this.RequestResultAsync("startReadOnlyAnalysis", GaepRequests.StartReadOnlyAnalysis(objective, contextPackIds), cancellationToken);

    public Task<string> ReadAnalysisRunAsync(string analysisRunId, CancellationToken cancellationToken)
        => this.RequestResultAsync("readAnalysisRun", GaepRequests.RunScoped(analysisRunId), cancellationToken);

    public Task<string> CancelAnalysisRunAsync(string analysisRunId, CancellationToken cancellationToken)
        => this.RequestResultAsync("cancelAnalysisRun", GaepRequests.RunScoped(analysisRunId), cancellationToken);

    private async Task<string> RequestResultAsync(string method, IReadOnlyDictionary<string, object?>? parameters, CancellationToken cancellationToken)
    {
        using var response = await this.client.RequestAsync(method, parameters, cancellationToken);
        return response.RootElement.GetProperty("result").GetRawText();
    }

    public ValueTask DisposeAsync() => this.client.DisposeAsync();
}
