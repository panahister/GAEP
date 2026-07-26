using Microsoft.VisualStudio.Extensibility.UI;

namespace Gaep.VisualStudio;

/// <summary>
/// GAEP-P0-CS02 — the remote UI content for the GAEP Tool Window. Its data context exposes the CS02
/// v3 actions (dashboard, provider catalog, select Claude/sonnet, start, refresh, cancel) and renders
/// the raw governed engine payloads; it derives no truth of its own (INV-11).
/// </summary>
internal sealed class GaepToolWindowControl : RemoteUserControl
{
    public GaepToolWindowControl(string? workspacePath, string installDir)
        : base(dataContext: new GaepToolWindowViewModel(workspacePath, installDir))
    {
    }
}
