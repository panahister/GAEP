using System.Runtime.Serialization;
using Gaep.HostClient;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Shell;
using Microsoft.VisualStudio.Extensibility.UI;

namespace Gaep.VisualStudio;

[DataContract]
internal sealed class GaepToolWindowData : NotifyPropertyChangedObject
{
    private readonly VisualStudioExtensibility extensibility;
    private readonly SemaphoreSlim requestGate = new(1, 1);
    private string workspacePath = Environment.GetEnvironmentVariable("GAEP_WORKSPACE_PATH") ?? string.Empty;
    private string bundlePath = string.Empty;
    private string bundleId = string.Empty;
    private string status = "GAEP engine has not been contacted";
    private string output = "Set one absolute local workspace folder, then refresh the Product.";
    private bool busy;

    public GaepToolWindowData(VisualStudioExtensibility extensibility)
    {
        this.extensibility = extensibility ?? throw new ArgumentNullException(nameof(extensibility));
        RefreshProductCommand = new AsyncCommand(RefreshProductAsync);
        ListDesignImportsCommand = new AsyncCommand(ListDesignImportsAsync);
        ReadDesignImportCommand = new AsyncCommand(ReadDesignImportAsync);
        ImportDesignBundleCommand = new AsyncCommand(ImportDesignBundleAsync);
    }

    [DataMember]
    public string Heading { get; } = "GAEP Product Studio";

    [DataMember]
    public string Summary { get; } =
        "The Visual Studio extension runs outside the IDE process and keeps Product authority in the shared local GAEP engine.";

    [DataMember]
    public string GovernanceBoundary { get; } =
        "Portable-design imports remain pending human review. Upstream approval is not GAEP approval, a Design Baseline, implementation readiness, or release readiness. Only validated metadata and digests are displayed.";

    [DataMember]
    public IAsyncCommand RefreshProductCommand { get; }

    [DataMember]
    public IAsyncCommand ListDesignImportsCommand { get; }

    [DataMember]
    public IAsyncCommand ReadDesignImportCommand { get; }

    [DataMember]
    public IAsyncCommand ImportDesignBundleCommand { get; }

    [DataMember]
    public string WorkspacePath
    {
        get => workspacePath;
        set => SetProperty(ref workspacePath, value ?? string.Empty);
    }

    [DataMember]
    public string BundlePath
    {
        get => bundlePath;
        set => SetProperty(ref bundlePath, value ?? string.Empty);
    }

    [DataMember]
    public string BundleId
    {
        get => bundleId;
        set => SetProperty(ref bundleId, value ?? string.Empty);
    }

    [DataMember]
    public string Status
    {
        get => status;
        private set => SetProperty(ref status, value);
    }

    [DataMember]
    public string Output
    {
        get => output;
        private set => SetProperty(ref output, value);
    }

    [DataMember]
    public bool Busy
    {
        get => busy;
        private set => SetProperty(ref busy, value);
    }

    private Task RefreshProductAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Refreshing Product",
            (controller, token) => controller.ReadProductAsync(token),
            cancellationToken);

    private Task ListDesignImportsAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Listing design imports",
            (controller, token) => controller.ListPortableDesignSnapshotsAsync(token),
            cancellationToken);

    private Task ReadDesignImportAsync(object? commandParameter, CancellationToken cancellationToken) =>
        RunRequestAsync(
            "Reading design import",
            (controller, token) => controller.ReadPortableDesignSnapshotAsync(BundleId, token),
            cancellationToken);

    private Task ImportDesignBundleAsync(object? commandParameter, CancellationToken cancellationToken)
    {
        var actorId = Environment.GetEnvironmentVariable("GAEP_ACTOR_ID") ?? "gaep.visual-studio-local-human";
        return RunRequestAsync(
            "Importing local bundle",
            (controller, token) => controller.ImportPortableDesignSnapshotAsync(BundlePath, actorId, token),
            cancellationToken,
            confirmImport: true);
    }

    private async Task RunRequestAsync(
        string label,
        Func<ProductWorkflowController, CancellationToken, Task<string>> action,
        CancellationToken cancellationToken,
        bool confirmImport = false)
    {
        if (!await requestGate.WaitAsync(0, cancellationToken))
        {
            Status = "A GAEP request is already running";
            return;
        }
        Busy = true;
        Status = $"{label}…";
        try
        {
            if (confirmImport)
            {
                var confirmed = await extensibility.Shell().ShowPromptAsync(
                    "Import one local folder as metadata and digests only? The result remains pending human review even when upstream sourceReview says approved.",
                    PromptOptions.OK.WithCancel(cancelReturns: false, cancelIsDefault: true),
                    cancellationToken);
                if (!confirmed)
                {
                    Status = "Import cancelled";
                    return;
                }
            }
            var workspace = ProductWorkflowController.NormalizeWorkspacePath(WorkspacePath);
            await using var client = new EngineClient(workspace);
            var controller = new ProductWorkflowController(client);
            Output = await action(controller, cancellationToken);
            Status = "GAEP engine ready";
        }
        catch (Exception error)
        {
            Status = error is OperationCanceledException ? "GAEP request cancelled" : "GAEP request stopped";
            Output = ProductWorkflowController.SafeError(error);
        }
        finally
        {
            Busy = false;
            requestGate.Release();
        }
    }
}
