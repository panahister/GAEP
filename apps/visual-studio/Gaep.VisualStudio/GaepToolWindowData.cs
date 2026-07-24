using System.Runtime.Serialization;
using Microsoft.VisualStudio.Extensibility.UI;

namespace Gaep.VisualStudio;

[DataContract]
internal sealed class GaepToolWindowData : NotifyPropertyChangedObject
{
    [DataMember]
    public string Heading { get; } = "GAEP Product Studio";

    [DataMember]
    public string Summary { get; } =
        "This native Visual Studio shell hosts GAEP outside the IDE process and keeps Product authority in the shared local engine.";

    [DataMember]
    public string EngineBoundary { get; } =
        "The packaged host client resolves and fingerprints GAEP_ENGINE_EXECUTABLE, optionally enforces GAEP_ENGINE_SHA256, and uses the bounded protocol-v2 stdio contract.";

    [DataMember]
    public string Limitation { get; } =
        "This checkpoint provides the native installable shell. Interactive Product workflows and Windows installation evidence remain pending.";
}
