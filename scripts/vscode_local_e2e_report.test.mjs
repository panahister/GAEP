import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { assertContentManifestsEqual } from "../apps/vscode/test/e2e/package-content.mjs"
import {
  readRepositoryRegularFile,
  writeExclusiveRepositoryFile,
} from "./lib/repository-files.mjs"
import {
  composeReport,
  focusedTestFiles,
  parseNativeResult,
  parseVitestSummary,
} from "./vscode_local_e2e_report.mjs"

const native = {
  schemaVersion: 1,
  scope: "local-isolated-vscode",
  phases: ["open", "reopen", "multi-root", "installed"],
  packageLifecycle: {
    status: "passed",
    exactPackage: "gaep.gaep-vscode@0.1.0",
    previousPackage: "gaep.gaep-vscode@0.0.9",
    bytes: 1_234,
    sha256: "a".repeat(64),
    contentManifestSha256: "b".repeat(64),
    contentFiles: 7,
    operations: ["previous-install", "upgrade", "reinstall", "rollback", "uninstall", "absence", "final-install"],
  },
  workspaceFingerprint: "unchanged",
  restartReopen: "explicit-command-after-isolated-restart",
  normalProfileTouched: false,
  externalSystemsUsed: false,
  otherHostMatricesRun: false,
}

test("parses only a passing focused summary", () => {
  assert.deepEqual(parseVitestSummary(" Test Files  10 passed (10)\n Tests  151 passed (151)"), {
    status: "passed",
    files: 10,
    tests: 151,
    skipped: 0,
  })
  assert.throws(() => parseVitestSummary("Tests failed"), /passing file and test summary/u)
})

test("requires the bounded VS Code-only native phases and safeguards", () => {
  const parsed = parseNativeResult(`noise\nGAEP_LOCAL_VSCODE_NATIVE_RESULT=${JSON.stringify(native)}\n`)
  assert.deepEqual(parsed, native)
  assert.throws(
    () => parseNativeResult(`GAEP_LOCAL_VSCODE_NATIVE_RESULT=${JSON.stringify({ ...native, normalProfileTouched: true })}`),
    /exceeded the local VS Code-only scope/u,
  )
  assert.throws(
    () => parseNativeResult(`GAEP_LOCAL_VSCODE_NATIVE_RESULT=${JSON.stringify({ ...native, rawOutput: "unexpected" })}`),
    /fields differ from the exact supported schema/u,
  )
  assert.throws(
    () => parseNativeResult(`GAEP_LOCAL_VSCODE_NATIVE_RESULT=${JSON.stringify({
      ...native,
      packageLifecycle: { ...native.packageLifecycle, environment: { TOKEN: "unexpected" } },
    })}`),
    /fields differ from the exact supported schema/u,
  )
})

test("composes one privacy-safe authority-bounded report", () => {
  const report = composeReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    focused: { status: "passed", files: 10, tests: 151, skipped: 0 },
    native,
    sourceDigests: [{ path: "apps/vscode/src/studio-session.test.ts", bytes: 1, sha256: "0".repeat(64) }],
  })
  assert.equal(report.result, "passed")
  assert.deepEqual(report.focusedVerification.files, focusedTestFiles)
  assert.equal(report.coverage.find((entry) => entry.id === "surface-states")?.status, "passed")
  assert.equal(report.scope.otherHostMatrices, "not-run")
  assert.equal(report.privacy.rawCommandOutputIncluded, false)
  assert.match(report.authorityBoundary, /grants no Product/u)
})

test("rejects repository output and package reads through symlinks", {
  skip: process.platform === "win32",
}, async () => {
  const temporary = await mkdtemp(join(tmpdir(), "gaep-repository-files-"))
  const repository = join(temporary, "repository")
  const external = join(temporary, "external")
  await Promise.all([repository, external].map((path) => mkdir(path, { recursive: true })))
  try {
    const written = await writeExclusiveRepositoryFile(repository, "reports/result.json", "{}\n")
    assert.equal(written, "reports/result.json")
    assert.equal(await readFile(join(repository, written), "utf8"), "{}\n")
    await assert.rejects(
      writeExclusiveRepositoryFile(repository, "reports/result.json", "replacement\n"),
      /already exists/u,
    )

    await writeFile(join(external, "preserved.json"), "preserved\n")
    await symlink(join(external, "preserved.json"), join(repository, "reports", "redirect.json"))
    await assert.rejects(
      writeExclusiveRepositoryFile(repository, "reports/redirect.json", "overwritten\n"),
      /already exists|symbolic link/u,
    )
    assert.equal(await readFile(join(external, "preserved.json"), "utf8"), "preserved\n")

    await writeFile(join(external, "package.vsix"), "external package\n")
    await symlink(external, join(repository, "redirected-artifacts"))
    await assert.rejects(
      readRepositoryRegularFile(repository, "redirected-artifacts/package.vsix"),
      /symbolic links/u,
    )

    await mkdir(join(repository, "artifacts"))
    await writeFile(join(repository, "artifacts", "package.vsix"), "local package\n")
    const local = await readRepositoryRegularFile(repository, "artifacts/package.vsix")
    assert.equal(local.bytes.toString("utf8"), "local package\n")
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test("requires exact installed and archive content manifests", () => {
  const expected = {
    entries: [{ path: "dist/extension.cjs", bytes: 10, sha256: "a".repeat(64) }],
    contentManifestSha256: "b".repeat(64),
  }
  assert.doesNotThrow(() => assertContentManifestsEqual(expected, structuredClone(expected)))
  assert.throws(() => assertContentManifestsEqual(expected, {
    ...expected,
    entries: [{ ...expected.entries[0], sha256: "c".repeat(64) }],
  }), /differs from the source VSIX/u)
})
