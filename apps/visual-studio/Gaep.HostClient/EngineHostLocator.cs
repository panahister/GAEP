using System.Security.Cryptography;

namespace Gaep.HostClient;

/// <summary>
/// GAEP-P0-CS02 — resolve and digest-verify the bundled Engine Host SEA (INV-21/22).
/// CS02 ships only the win32-x64 SEA. A production extension launches ONLY the bundled runtime
/// after verifying its SHA-256 against the sibling engine-host.sha256; it never resolves
/// gaep-engine from PATH. A development override is honored only when GAEP_DEV_ENGINE=1.
/// </summary>
public static class EngineHostLocator
{
    public static string ResolveVerified(string extensionInstallDir)
    {
        if (Environment.GetEnvironmentVariable("GAEP_DEV_ENGINE") == "1")
        {
            var dev = Environment.GetEnvironmentVariable("GAEP_ENGINE_EXECUTABLE");
            if (!string.IsNullOrEmpty(dev)) return dev!;
        }

        var runtime = Path.Combine(extensionInstallDir, "EngineHost", "gaep-engine-host-0.2.0-win32-x64.exe");
        var sidecar = runtime + ".sha256";
        if (!File.Exists(runtime)) throw new InvalidOperationException("engine-host-platform-unsupported: no bundled runtime for win32-x64.");
        if (!File.Exists(sidecar)) throw new InvalidOperationException("engine-host-integrity-failed: missing digest sidecar.");

        var expectedRaw = File.ReadAllText(sidecar).Trim().Split(' ')[0];
        var expected = expectedRaw.StartsWith("sha256:") ? expectedRaw : "sha256:" + expectedRaw;
        using var sha = SHA256.Create();
        var actual = "sha256:" + Convert.ToHexString(sha.ComputeHash(File.ReadAllBytes(runtime))).ToLowerInvariant();
        if (actual != expected) throw new InvalidOperationException("engine-host-integrity-failed: digest mismatch; refusing to start.");
        return runtime;
    }
}
