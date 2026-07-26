using System.Runtime.Serialization;
using Gaep.HostClient;
using Microsoft.VisualStudio.Extensibility.UI;

namespace Gaep.VisualStudio;

/// <summary>
/// GAEP-P0-CS02 — data context for the GAEP Tool Window. Provider, model, Context Pack IDs, and the
/// objective are entered by the user (never hardcoded Claude/sonnet, never an empty Context Pack list);
/// each async command issues one protocol-v3 call over the shared, persistent Engine Host client and
/// shows the raw governed payload. Request construction/validation lives in the unit-tested
/// <see cref="GaepRequests"/>. When no solution is open, actions are disabled with a clear message.
/// </summary>
[DataContract]
internal sealed class GaepToolWindowViewModel : NotifyPropertyChangedObject, IAsyncDisposable
{
    private readonly GaepToolWindowContent? workflow;
    private string status;
    private string output = string.Empty;
    private string adapterId = string.Empty;
    private string modelId = string.Empty;
    private string contextPackIds = string.Empty;
    private string objective = string.Empty;
    private string? lastRunId;

    public GaepToolWindowViewModel(string? workspacePath, string installDir)
    {
        this.workflow = workspacePath is null ? null : new GaepToolWindowContent(workspacePath, installDir);
        this.status = workspacePath is null
            ? "Open a solution/Product before using GAEP."
            : "GAEP engine has not been contacted";

        this.Dashboard = new AsyncCommand((_, ct) => this.RunAsync("dashboard", w => w.LoadProjectionJsonAsync(ct), ct));
        this.ProviderCatalog = new AsyncCommand((_, ct) => this.RunAsync("provider catalog", w => w.ProviderCatalogJsonAsync(ct), ct));
        this.SelectProviderModel = new AsyncCommand((_, ct) => this.RunSelectAsync(ct));
        this.StartAnalysis = new AsyncCommand((_, ct) => this.RunStartAsync(ct));
        this.RefreshRun = new AsyncCommand((_, ct) => this.RunRunScopedAsync("refresh run", (w, id) => w.ReadAnalysisRunAsync(id, ct), ct));
        this.CancelRun = new AsyncCommand((_, ct) => this.RunRunScopedAsync("cancel run", (w, id) => w.CancelAnalysisRunAsync(id, ct), ct));
    }

    [DataMember]
    public string Status { get => this.status; set => this.SetProperty(ref this.status, value); }

    [DataMember]
    public string Output { get => this.output; set => this.SetProperty(ref this.output, value); }

    [DataMember]
    public string AdapterId { get => this.adapterId; set => this.SetProperty(ref this.adapterId, value); }

    [DataMember]
    public string ModelId { get => this.modelId; set => this.SetProperty(ref this.modelId, value); }

    [DataMember]
    public string ContextPackIds { get => this.contextPackIds; set => this.SetProperty(ref this.contextPackIds, value); }

    [DataMember]
    public string Objective { get => this.objective; set => this.SetProperty(ref this.objective, value); }

    [DataMember]
    public AsyncCommand Dashboard { get; }

    [DataMember]
    public AsyncCommand ProviderCatalog { get; }

    [DataMember]
    public AsyncCommand SelectProviderModel { get; }

    [DataMember]
    public AsyncCommand StartAnalysis { get; }

    [DataMember]
    public AsyncCommand RefreshRun { get; }

    [DataMember]
    public AsyncCommand CancelRun { get; }

    private Task RunSelectAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Validate the entered provider/model up front (GaepRequests throws on blanks).
            _ = GaepRequests.SelectProviderModel(this.AdapterId, this.ModelId);
        }
        catch (ArgumentException ex)
        {
            this.Status = ex.Message;
            return Task.CompletedTask;
        }

        return this.RunAsync("select provider/model", w => w.SelectProviderModelAsync(this.AdapterId, this.ModelId, cancellationToken), cancellationToken);
    }

    private Task RunStartAsync(CancellationToken cancellationToken)
    {
        var ids = this.ContextPackIds.Split(',').Select(id => id.Trim()).Where(id => id.Length > 0).ToArray();
        try
        {
            // Enforce a non-blank objective and at least one governed Context Pack ID.
            _ = GaepRequests.StartReadOnlyAnalysis(this.Objective, ids);
        }
        catch (ArgumentException ex)
        {
            this.Status = ex.Message;
            return Task.CompletedTask;
        }

        return this.RunAsync("start analysis", w => w.StartReadOnlyAnalysisAsync(this.Objective, ids, cancellationToken), cancellationToken);
    }

    private async Task RunAsync(string label, Func<GaepToolWindowContent, Task<string>> call, CancellationToken cancellationToken)
    {
        if (this.workflow is null)
        {
            this.Status = "Open a solution/Product before using GAEP.";
            return;
        }

        this.Status = $"Running {label}...";
        try
        {
            var result = await call(this.workflow);
            var runId = GaepRequests.ExtractRunId(result);
            if (runId is not null)
            {
                this.lastRunId = runId;
            }

            this.Output = result;
            this.Status = "GAEP engine ready";
        }
        catch (Exception ex)
        {
            this.Output = ex.Message;
            this.Status = "GAEP engine unavailable";
        }
    }

    private Task RunRunScopedAsync(string label, Func<GaepToolWindowContent, string, Task<string>> call, CancellationToken cancellationToken)
    {
        if (this.lastRunId is null)
        {
            this.Status = "Start an analysis first";
            return Task.CompletedTask;
        }

        var runId = this.lastRunId;
        return this.RunAsync(label, w => call(w, runId), cancellationToken);
    }

    public ValueTask DisposeAsync() => this.workflow?.DisposeAsync() ?? ValueTask.CompletedTask;
}
