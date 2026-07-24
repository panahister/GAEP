using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.Extensibility;

namespace Gaep.VisualStudio;

[VisualStudioContribution]
public sealed class GaepExtension : Extension
{
    public override ExtensionConfiguration ExtensionConfiguration => new()
    {
        Metadata = new(
            id: "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9",
            version: ExtensionAssemblyVersion,
            publisherName: "GAEP",
            displayName: "GAEP Product Studio",
            description: "A governed local Product Studio shell for Visual Studio."),
    };

    protected override void InitializeServices(IServiceCollection serviceCollection)
    {
        base.InitializeServices(serviceCollection);
    }
}
