using System.IO;
using Gaep.HostClient;
using Microsoft.VisualStudio.Extensibility;
using Microsoft.VisualStudio.ProjectSystem.Query;

namespace Gaep.VisualStudio;

/// <summary>
/// GAEP-P0-CS02 — resolve the open solution / Product root via the VisualStudio.Extensibility
/// Workspaces API. It prefers a solution/workspace root that already contains the governed
/// <c>.gaep</c> structure; otherwise it walks each project's ancestors to the nearest governed root
/// via the pure, unit-tested <see cref="GaepProductRoot"/>. It NEVER silently picks the first project
/// directory and NEVER falls back to <see cref="Environment.CurrentDirectory"/>; a missing or ambiguous
/// Product root is reported (null) so the caller shows a clear message rather than guessing.
/// </summary>
internal static class GaepSolutionLocator
{
    private static bool HasGaep(string directory) => Directory.Exists(Path.Combine(directory, ".gaep"));

    public static async Task<string?> ResolveProductRootAsync(VisualStudioExtensibility extensibility, CancellationToken cancellationToken)
    {
        var projects = await extensibility.Workspaces().QueryProjectsAsync(
            query => query.With(project => project.Path).With(project => project.Name),
            cancellationToken);

        var projectPaths = projects
            .Select(project => project.Path)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => path!)
            .ToArray();

        // Prefer a common ancestor that actually contains the governed .gaep structure — this handles
        // the solution/repository root for multi-project solutions. Only a single, unambiguous governed
        // root is accepted.
        var resolution = GaepProductRoot.Resolve(projectPaths, HasGaep);
        return resolution.Kind == ProductRootKind.Found ? resolution.Root : null;
    }
}
