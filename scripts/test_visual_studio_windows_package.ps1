[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $VsixPath,

    [Parameter(Mandatory = $true)]
    [string] $EvidencePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $IsWindows) {
    throw "The Visual Studio VSIX installation probe requires Windows."
}

$extensionId = "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9"
$maximumVsixBytes = 128MB
$maximumManifestBytes = 1MB
$maximumManifestCount = 20000
$resolvedVsix = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $VsixPath).Path)
$vsix = Get-Item -LiteralPath $resolvedVsix -Force
if (-not $vsix.PSIsContainer -and
    -not ($vsix.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -and
    $vsix.Length -ge 1 -and
    $vsix.Length -le $maximumVsixBytes) {
    $vsixDigest = (Get-FileHash -LiteralPath $resolvedVsix -Algorithm SHA256).Hash.ToLowerInvariant()
} else {
    throw "The Visual Studio VSIX is missing, linked, empty, or outside its 128 MiB boundary."
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio/Installer/vswhere.exe"
if (-not (Test-Path -LiteralPath $vswhere -PathType Leaf)) {
    throw "The Visual Studio instance locator is unavailable."
}
$instancesJson = (& $vswhere -products * -version "[17.14,18.0)" -requires Microsoft.VisualStudio.Component.CoreEditor -format json) -join [Environment]::NewLine
$instances = @($instancesJson | ConvertFrom-Json)
if ($instances.Count -lt 1) {
    throw "No Visual Studio 2022 instance at or above 17.14 is available."
}
$instance = $instances |
    Sort-Object { [version] $_.installationVersion } -Descending |
    Select-Object -First 1
$instanceId = [string] $instance.instanceId
$installationVersion = [string] $instance.installationVersion
$installer = Join-Path ([string] $instance.installationPath) "Common7/IDE/VSIXInstaller.exe"
if ([string]::IsNullOrWhiteSpace($instanceId) -or
    [string]::IsNullOrWhiteSpace($installationVersion) -or
    -not (Test-Path -LiteralPath $installer -PathType Leaf)) {
    throw "The selected Visual Studio 2022 instance is incomplete."
}

$extensionsRoot = Join-Path $env:LOCALAPPDATA "Microsoft/VisualStudio"

function Get-GaepInstalledManifests {
    if (-not (Test-Path -LiteralPath $extensionsRoot -PathType Container)) {
        return @()
    }
    $manifests = @(Get-ChildItem -LiteralPath $extensionsRoot -Filter extension.vsixmanifest -File -Recurse -Force)
    if ($manifests.Count -gt $maximumManifestCount) {
        throw "The Visual Studio extension manifest inventory exceeds its 20,000-file boundary."
    }
    $matches = @()
    foreach ($manifest in $manifests) {
        if (($manifest.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or
            $manifest.Length -lt 1 -or
            $manifest.Length -gt $maximumManifestBytes) {
            continue
        }
        try {
            [xml] $document = [System.IO.File]::ReadAllText($manifest.FullName)
            $identity = $document.SelectSingleNode("//*[local-name()='Identity']")
            if ($null -ne $identity -and $identity.Id -eq $extensionId) {
                $matches += $manifest.FullName
            }
        } catch [System.Xml.XmlException] {
            continue
        }
    }
    return @($matches)
}

function Assert-InstalledCount([int] $Expected, [string] $Stage) {
    $actual = @(Get-GaepInstalledManifests).Count
    if ($actual -ne $Expected) {
        throw "The GAEP Visual Studio extension installation count is invalid after $Stage."
    }
}

function Invoke-VsixInstaller([string[]] $Arguments, [string] $Stage) {
    & $installer @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "VSIXInstaller failed during $Stage with exit code $LASTEXITCODE."
    }
}

$installArguments = @("/quiet", "/shutdownprocesses", "/instanceIds:$instanceId", $resolvedVsix)
$uninstallArguments = @("/quiet", "/shutdownprocesses", "/instanceIds:$instanceId", "/uninstall:$extensionId")

try {
    Assert-InstalledCount 0 "the clean-runner preflight"
    Invoke-VsixInstaller $installArguments "installation"
    Assert-InstalledCount 1 "installation"
    Invoke-VsixInstaller $uninstallArguments "uninstallation"
    Assert-InstalledCount 0 "uninstallation"
    Invoke-VsixInstaller $installArguments "reinstallation"
    Assert-InstalledCount 1 "reinstallation"
} finally {
    if (@(Get-GaepInstalledManifests).Count -gt 0) {
        Invoke-VsixInstaller $uninstallArguments "final cleanup"
    }
}
Assert-InstalledCount 0 "final cleanup"

$revision = [string] $env:GITHUB_SHA
if ($revision -notmatch "^[0-9a-fA-F]{40}$") {
    throw "The CI revision is missing or invalid."
}
$receipt = [ordered] @{
    schemaVersion = 1
    kind = "gaep-visual-studio-windows-package-lifecycle-v1"
    recordedAt = [DateTimeOffset]::UtcNow.ToString("O")
    revision = $revision.ToLowerInvariant()
    runnerImage = [string] $env:ImageOS
    visualStudioVersion = $installationVersion
    package = [ordered] @{
        id = $extensionId
        version = "0.1.0.0"
        bytes = $vsix.Length
        digest = "sha256:$vsixDigest"
    }
    lifecycle = [ordered] @{
        install = "verified"
        uninstall = "verified-absent"
        reinstall = "verified"
        cleanup = "verified-absent"
    }
    remainingRequirements = @(
        "Visual Studio activation and rendered Remote UI automation",
        "installed-package engine workflow",
        "real-provider managed read-only and staged-review workflows",
        "supported Windows and Visual Studio matrix",
        "publisher provenance, signing, and Product Owner acceptance"
    )
    claimBoundary = "This receipt proves one ephemeral Windows runner package lifecycle only. It is not activation, UI, provider, signing, supported-matrix, release, or human acceptance evidence."
}

$resolvedEvidence = [System.IO.Path]::GetFullPath($EvidencePath)
if (Test-Path -LiteralPath $resolvedEvidence) {
    throw "The Visual Studio lifecycle evidence path already exists."
}
$evidenceDirectory = Split-Path -Parent $resolvedEvidence
[System.IO.Directory]::CreateDirectory($evidenceDirectory) | Out-Null
$serialized = $receipt | ConvertTo-Json -Depth 5
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($resolvedEvidence, "$serialized`n", $utf8)
Write-Output "GAEP Visual Studio Windows VSIX install lifecycle: PASS"
