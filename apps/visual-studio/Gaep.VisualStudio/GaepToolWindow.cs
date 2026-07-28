using System.IO;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.ToolWindows;
using Microsoft.VisualStudio.RpcContracts.RemoteUI;

namespace Gaep.VisualStudio;

/// <summary>
/// GAEP-P0-CS02 — a real VisualStudio.Extensibility Tool Window that hosts the read-only provider/model
/// dashboard. Its content drives the full CS02 workflow (providerCatalog → selectProviderModel →
/// startReadOnlyAnalysis → readAnalysisRun → cancelAnalysisRun) over the packaged Engine Host
/// protocol v3, launching only the digest-verified win32-x64 SEA embedded in the VSIX (INV-21/22).
/// </summary>
[VisualStudioContribution]
public sealed class GaepToolWindow : ToolWindow
{
    private GaepToolWindowControl? control;

    public GaepToolWindow()
    {
        this.Title = "GAEP Provider / Model";
    }

    public override ToolWindowConfiguration ToolWindowConfiguration => new()
    {
        Placement = ToolWindowPlacement.DocumentWell,
    };

    public override async Task<IRemoteUserControl> GetContentAsync(CancellationToken cancellationToken)
    {
        // Resolve the actual open Product root via the Workspaces API (never CurrentDirectory), and the
        // installed extension directory, so the tool window launches only the embedded, digest-verified
        // Engine Host (never a PATH executable).
        var workspacePath = await GaepSolutionLocator.ResolveProductRootAsync(this.Extensibility, cancellationToken);
        var installDir = Path.GetDirectoryName(typeof(GaepToolWindow).Assembly.Location) ?? AppContext.BaseDirectory;
        this.control = new GaepToolWindowControl(workspacePath, installDir);
        return this.control;
    }

    protected override void Dispose(bool isDisposing)
    {
        if (isDisposing)
        {
            this.control?.Dispose();
            this.control = null;
        }

        base.Dispose(isDisposing);
    }
}
