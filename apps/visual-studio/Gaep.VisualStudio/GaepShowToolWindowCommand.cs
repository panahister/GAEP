using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.Extensibility.Commands;
using Microsoft.VisualStudio.Extensibility.ToolWindows;

namespace Gaep.VisualStudio;

/// <summary>
/// GAEP-P0-CS02 — the command that opens the GAEP Provider/Model Tool Window (Extensions ▸ GAEP).
/// </summary>
[VisualStudioContribution]
public sealed class GaepShowToolWindowCommand : Command
{
    public override CommandConfiguration CommandConfiguration => new("GAEP: Open Provider/Model")
    {
        Placements = new[] { CommandPlacement.KnownPlacements.ExtensionsMenu },
        Icon = new(ImageMoniker.KnownValues.ToolWindow, IconSettings.IconAndText),
    };

    public override Task ExecuteCommandAsync(IClientContext context, CancellationToken cancellationToken)
        => this.Extensibility.Shell().ShowToolWindowAsync<GaepToolWindow>(activate: true, cancellationToken);
}
