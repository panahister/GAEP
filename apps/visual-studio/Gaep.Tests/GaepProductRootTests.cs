using Gaep.HostClient;
using Xunit;

namespace Gaep.Tests;

public class GaepProductRootTests
{
    // A predicate over a fixed set of directories that "contain" .gaep.
    private static Func<string, bool> Governed(params string[] roots)
    {
        var set = new HashSet<string>(roots.Select(Path.GetFullPath), StringComparer.OrdinalIgnoreCase);
        return dir => set.Contains(Path.GetFullPath(dir));
    }

    [Fact]
    public void OneProjectNestedBelowTheProductRoot_ResolvesToTheRoot()
    {
        var root = Path.GetFullPath("/repo");
        var resolution = GaepProductRoot.Resolve(
            new[] { "/repo/src/App/App.csproj" },
            Governed(root));
        Assert.Equal(ProductRootKind.Found, resolution.Kind);
        Assert.Equal(root, resolution.Root);
    }

    [Fact]
    public void MultipleProjectsUnderOneProductRoot_ResolveToThatSingleRoot()
    {
        var root = Path.GetFullPath("/repo");
        var resolution = GaepProductRoot.Resolve(
            new[] { "/repo/src/Api/Api.csproj", "/repo/src/Web/Web.csproj", "/repo/tests/T/T.csproj" },
            Governed(root));
        Assert.Equal(ProductRootKind.Found, resolution.Kind);
        Assert.Equal(root, resolution.Root);
    }

    [Fact]
    public void NoGaepProductRoot_IsReportedAsNotFound_NeverTheFirstProjectDirectory()
    {
        var resolution = GaepProductRoot.Resolve(
            new[] { "/repo/src/App/App.csproj" },
            Governed());
        Assert.Equal(ProductRootKind.NotFound, resolution.Kind);
        Assert.Null(resolution.Root);
    }

    [Fact]
    public void ProjectsUnderDifferentGovernedRoots_AreReportedAsAmbiguous()
    {
        var resolution = GaepProductRoot.Resolve(
            new[] { "/repoA/src/App/App.csproj", "/repoB/src/Lib/Lib.csproj" },
            Governed(Path.GetFullPath("/repoA"), Path.GetFullPath("/repoB")));
        Assert.Equal(ProductRootKind.Ambiguous, resolution.Kind);
        Assert.Null(resolution.Root);
        Assert.Equal(2, resolution.Candidates.Count);
    }

    [Fact]
    public void ResolutionIsStableRegardlessOfProjectEnumerationOrder()
    {
        var root = Path.GetFullPath("/repo");
        var forward = GaepProductRoot.Resolve(
            new[] { "/repo/a/a.csproj", "/repo/b/b.csproj", "/repo/c/c.csproj" }, Governed(root));
        var reversed = GaepProductRoot.Resolve(
            new[] { "/repo/c/c.csproj", "/repo/b/b.csproj", "/repo/a/a.csproj" }, Governed(root));
        Assert.Equal(forward.Kind, reversed.Kind);
        Assert.Equal(forward.Root, reversed.Root);
    }

    [Fact]
    public void NearestGovernedAncestor_PrefersTheClosestGovernedDirectory()
    {
        var outer = Path.GetFullPath("/repo");
        var inner = Path.GetFullPath("/repo/team");
        var nearest = GaepProductRoot.NearestGovernedAncestor("/repo/team/App/src", Governed(outer, inner));
        Assert.Equal(inner, nearest);
    }
}
