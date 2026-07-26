namespace Gaep.HostClient;

/// <summary>The outcome of resolving a Product root from a set of project paths.</summary>
public enum ProductRootKind
{
    Found,
    NotFound,
    Ambiguous,
}

/// <summary>A deterministic Product-root resolution result.</summary>
public sealed record ProductRootResolution(ProductRootKind Kind, string? Root, IReadOnlyList<string> Candidates);

/// <summary>
/// GAEP-P0-CS02 — pure, dependency-free Product-root selection. Given the open solution's project
/// paths and a predicate that reports whether a directory contains the governed <c>.gaep</c> Product
/// structure, it walks each project's ancestor chain to the NEAREST governed root and selects a single
/// deterministic Product root. It never silently picks the first project directory, distinguishes a
/// missing root from an ambiguous one, and is stable regardless of project enumeration order. Unit-tested.
/// </summary>
public static class GaepProductRoot
{
    public static ProductRootResolution Resolve(IReadOnlyList<string> projectPaths, Func<string, bool> hasGaep)
    {
        var candidates = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var projectPath in projectPaths)
        {
            var directory = Directory.Exists(projectPath) ? projectPath : Path.GetDirectoryName(projectPath);
            var governed = NearestGovernedAncestor(directory, hasGaep);
            if (governed is not null)
            {
                candidates.Add(governed);
            }
        }

        var ordered = candidates.ToArray();
        return ordered.Length switch
        {
            0 => new ProductRootResolution(ProductRootKind.NotFound, null, ordered),
            1 => new ProductRootResolution(ProductRootKind.Found, ordered[0], ordered),
            _ => new ProductRootResolution(ProductRootKind.Ambiguous, null, ordered),
        };
    }

    /// <summary>Walk from <paramref name="startDirectory"/> upward and return the nearest ancestor
    /// (inclusive) that contains a governed <c>.gaep</c> structure, or null if none does.</summary>
    public static string? NearestGovernedAncestor(string? startDirectory, Func<string, bool> hasGaep)
    {
        var current = string.IsNullOrWhiteSpace(startDirectory) ? null : Path.GetFullPath(startDirectory);
        while (!string.IsNullOrEmpty(current))
        {
            if (hasGaep(current))
            {
                return current;
            }

            var parent = Path.GetDirectoryName(current);
            if (string.Equals(parent, current, StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            current = parent;
        }

        return null;
    }
}
