using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;

namespace Gaep.VisualStudio;

[VisualStudioContribution]
public sealed class OpenGaepToolWindowCommand : Command
{
    public override CommandConfiguration CommandConfiguration => new("%Gaep.OpenProductStudio.DisplayName%")
    {
        Placements = [CommandPlacement.KnownPlacements.ToolsMenu],
        Icon = new(ImageMoniker.KnownValues.ToolWindow, IconSettings.IconAndText),
    };

    public override async Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
    {
        await Extensibility.Shell().ShowToolWindowAsync<GaepToolWindow>(activate: true, cancellationToken);
    }
}
