using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.ToolWindows;
using Microsoft.VisualStudio.RpcContracts.RemoteUI;

namespace Gaep.VisualStudio;

[VisualStudioContribution]
public sealed class GaepToolWindow : ToolWindow
{
    private GaepToolWindowData? dataContext;

    public GaepToolWindow()
    {
        Title = "GAEP Product Studio";
    }

    public override ToolWindowConfiguration ToolWindowConfiguration => new()
    {
        Placement = ToolWindowPlacement.DocumentWell,
    };

    public override Task InitializeAsync(CancellationToken cancellationToken)
    {
        dataContext = new GaepToolWindowData(Extensibility);
        return Task.CompletedTask;
    }

    public override Task<IRemoteUserControl> GetContentAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IRemoteUserControl>(new GaepToolWindowControl(dataContext));
    }
}
