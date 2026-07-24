using Microsoft.VisualStudio.Extensibility.UI;

namespace Gaep.VisualStudio;

internal sealed class GaepToolWindowControl : RemoteUserControl
{
    public GaepToolWindowControl(object? dataContext, SynchronizationContext? synchronizationContext = null)
        : base(dataContext, synchronizationContext)
    {
    }
}
