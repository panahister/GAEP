import assert from "node:assert/strict"
import { lstat, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const workflowPath = resolve(repositoryRoot, ".github/workflows/visual-studio-windows.yml")
const probePath = resolve(repositoryRoot, "scripts/test_visual_studio_windows_package.ps1")

async function boundedRegularText(path, maximumBytes) {
  const metadata = await lstat(path)
  assert.equal(metadata.isFile(), true)
  assert.equal(metadata.isSymbolicLink(), false)
  assert.equal(metadata.size > 0 && metadata.size <= maximumBytes, true)
  return readFile(path, "utf8")
}

describe("Visual Studio Windows CI contract", () => {
  it("uses a bounded least-authority VS 2022 package job with immutable actions", async () => {
    const workflow = await boundedRegularText(workflowPath, 64 * 1024)
    assert.match(workflow, /^name: Visual Studio Windows package$/mu)
    assert.match(workflow, /^permissions:\n  contents: read$/mu)
    assert.match(workflow, /^    runs-on: windows-2022$/mu)
    assert.match(workflow, /^    timeout-minutes: 35$/mu)
    assert.match(workflow, /persist-credentials: false/u)
    assert.match(workflow, /run: npm ci/u)
    assert.match(workflow, /run: npm run test:visual-studio:host/u)
    assert.match(workflow, /test_visual_studio_windows_package\.ps1/u)
    assert.match(workflow, /verify_visual_studio_windows_receipt\.mjs/u)
    assert.match(workflow, /if-no-files-found: error/u)
    assert.match(workflow, /retention-days: 14/u)
    assert.doesNotMatch(workflow, /pull_request_target|workflow_run|id-token: write|contents: write|secrets\./u)

    const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)].map((match) => match[1])
    assert.equal(uses.length, 4)
    assert.equal(uses.every((value) => /^actions\/[a-z-]+@[0-9a-f]{40}$/u.test(value)), true)
    assert.deepEqual(uses, [
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e",
      "actions/setup-dotnet@c2fa09f4bde5ebb9d1777cf28262a3eb3db3ced7",
      "actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f",
    ])
  })

  it("keeps the Windows installation receipt bounded, private, and non-accepting", async () => {
    const probe = await boundedRegularText(probePath, 64 * 1024)
    for (const marker of [
      'Set-StrictMode -Version Latest',
      '"[17.14,18.0)"',
      "$maximumVsixBytes = 128MB",
      "$maximumManifestCount = 20000",
      'Assert-InstalledCount 0 "the clean-runner preflight"',
      'Assert-InstalledCount 1 "installation"',
      'Assert-InstalledCount 0 "uninstallation"',
      'Assert-InstalledCount 1 "reinstallation"',
      'Assert-InstalledCount 0 "final cleanup"',
      'kind = "gaep-visual-studio-windows-package-lifecycle-v1"',
      'version = "0.1.0.0"',
      "It is not activation, UI, provider, signing, supported-matrix, release, or human acceptance evidence.",
    ]) {
      assert.equal(probe.includes(marker), true, `Missing Windows lifecycle marker: ${marker}`)
    }
    assert.doesNotMatch(probe, /Invoke-Expression|\biex\b|DownloadString|Invoke-WebRequest|Remove-Item\s+-Recurse/u)
    const receipt = probe.slice(probe.indexOf("$receipt ="), probe.indexOf("$resolvedEvidence ="))
    assert.doesNotMatch(receipt, /installationPath|instanceId|extensionsRoot/u)
  })
})
