using Microsoft.VisualStudio.Extensibility;

namespace Gaep.VisualStudio;

/// <summary>GAEP-P0-CS02 — Visual Studio extension identity (id Gaep.VisualStudio, version 0.2.0).</summary>
[VisualStudioContribution]
public sealed class GaepExtension : Extension
{
    public override ExtensionConfiguration ExtensionConfiguration => new()
    {
        Metadata = new(
            id: "Gaep.VisualStudio",
            version: this.ExtensionAssemblyVersion,
            publisherName: "gaep",
            displayName: "GAEP for Visual Studio",
            description: "Governed provider/model read-only analysis over the shared GAEP Engine Host (protocol v3)."),
    };
}
