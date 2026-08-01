import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createServer } from "node:http"
import { existsSync } from "node:fs"
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { build } from "esbuild"
import visualScenarioData from "../apps/vscode/src/studio-visual-scenarios.json" with { type: "json" }

import {
  readRepositoryRegularFile,
  writeExclusiveRepositoryFile,
} from "./lib/repository-files.mjs"
import { parseVitestSummary } from "./vscode_local_e2e_report.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const baselineRoot = "apps/vscode/test/visual/baselines/p3b22"
const baselineManifestPath = `${baselineRoot}/manifest.json`
const defaultChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const nonce = "visual_fixture_nonce_1234567890"

export const visualFocusedTestFiles = [
  "apps/vscode/src/studio-document.test.ts",
  "apps/vscode/src/studio-visual-fixtures.test.ts",
  "apps/vscode/src/studio-accessibility.test.ts",
]

export const visualScenarioMatrix = Object.freeze(visualScenarioData.map((scenario) => Object.freeze({ ...scenario })))

const reportInputFiles = [
  "apps/vscode/src/studio-client.ts",
  "apps/vscode/src/studio-document.ts",
  "apps/vscode/src/studio-protocol.ts",
  "apps/vscode/src/studio-styles.ts",
  "apps/vscode/src/studio-visual-fixtures.ts",
  "apps/vscode/src/studio-visual-fixtures.test.ts",
  "apps/vscode/src/studio-visual-scenarios.json",
  "apps/vscode/test/visual/browser-entry.ts",
  "scripts/vscode_visual_regression.mjs",
  "scripts/vscode_visual_regression.test.mjs",
]

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function exactKeys(value, keys) {
  return isObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
}

export function validateVisualScenarioMatrix(scenarios = visualScenarioMatrix) {
  if (!Array.isArray(scenarios) || scenarios.length !== 6) {
    throw new Error("Visual fixture matrix must contain exactly six scenarios")
  }
  const ids = new Set()
  const routes = new Set()
  const surfaces = new Set()
  const themes = new Set()
  for (const scenario of scenarios) {
    if (!exactKeys(scenario, ["id", "route", "surface", "width", "height", "theme", "purpose"]) ||
        typeof scenario.id !== "string" || !/^[a-z0-9-]{8,80}$/u.test(scenario.id) || ids.has(scenario.id) ||
        typeof scenario.route !== "string" || typeof scenario.surface !== "string" ||
        !Number.isInteger(scenario.width) || scenario.width < 320 || scenario.width > 1920 ||
        !Number.isInteger(scenario.height) || scenario.height < 640 || scenario.height > 1200 ||
        !["light", "dark"].includes(scenario.theme) ||
        typeof scenario.purpose !== "string" || scenario.purpose.length < 20 || scenario.purpose.length > 240) {
      throw new Error("Visual fixture scenario is malformed, duplicated, or outside its bound")
    }
    ids.add(scenario.id)
    routes.add(scenario.route)
    surfaces.add(scenario.surface)
    themes.add(scenario.theme)
  }
  if (!["overview", "delivery", "scope", "trace"].every((route) => routes.has(route)) ||
      !["ready", "empty", "invalid"].every((surface) => surfaces.has(surface)) ||
      !["light", "dark"].every((theme) => themes.has(theme)) ||
      !scenarios.some(({ width }) => width >= 480 && width < 720) ||
      !scenarios.some(({ width }) => width >= 1200)) {
    throw new Error("Visual fixture matrix does not cover the required route, state, theme, and responsive classes")
  }
  return { scenarios: scenarios.length, routes: routes.size, surfaces: surfaces.size, themes: themes.size }
}

export function inspectPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength < 33 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("Visual baseline is not a bounded PNG image")
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width < 320 || width > 1920 || height < 640 || height > 1200 || bytes.byteLength > 16 * 1024 * 1024) {
    throw new Error("Visual baseline PNG dimensions or bytes exceed the supported bound")
  }
  return { width, height, bytes: bytes.byteLength, sha256: sha256(bytes) }
}

export function validateVisualBaselineManifest(manifest, rendererFingerprint, scenarios = visualScenarioMatrix) {
  validateVisualScenarioMatrix(scenarios)
  if (!exactKeys(manifest, ["schemaVersion", "kind", "renderer", "source", "scenarios", "authorityBoundary", "limitations"]) ||
      manifest.schemaVersion !== 1 || manifest.kind !== "gaep-vscode-product-studio-visual-baseline" ||
      !exactKeys(manifest.renderer, ["name", "product", "version", "fingerprint"]) ||
      manifest.renderer.name !== "chrome-headless" || manifest.renderer.product !== "Google Chrome" ||
      typeof manifest.renderer.version !== "string" || !/^\d+(?:\.\d+){3}$/u.test(manifest.renderer.version) ||
      manifest.renderer.fingerprint !== rendererFingerprint ||
      !exactKeys(manifest.source, ["bundleSha256", "scenarioCatalogSha256"]) ||
      !/^[0-9a-f]{64}$/u.test(manifest.source.bundleSha256) ||
      !/^[0-9a-f]{64}$/u.test(manifest.source.scenarioCatalogSha256) ||
      !Array.isArray(manifest.scenarios) || manifest.scenarios.length !== scenarios.length ||
      !Array.isArray(manifest.limitations) || manifest.limitations.length < 3 ||
      typeof manifest.authorityBoundary !== "string") {
    throw new Error("Visual baseline manifest is malformed or bound to a different renderer")
  }
  const expectedById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
  for (const entry of manifest.scenarios) {
    if (!exactKeys(entry, ["id", "route", "surface", "theme", "viewport", "image", "dom"]) ||
        !expectedById.has(entry.id) ||
        !exactKeys(entry.viewport, ["width", "height"]) ||
        !exactKeys(entry.image, ["path", "bytes", "sha256", "width", "height"]) ||
        !exactKeys(entry.dom, ["ready", "tableCount"]) || entry.dom.ready !== true ||
        !Number.isInteger(entry.dom.tableCount) || entry.dom.tableCount < 0 ||
        typeof entry.image.path !== "string" ||
        entry.image.path !== `${baselineRoot}/${entry.id}.png` ||
        !Number.isInteger(entry.image.bytes) || entry.image.bytes < 33 || entry.image.bytes > 16 * 1024 * 1024 ||
        !/^[0-9a-f]{64}$/u.test(entry.image.sha256)) {
      throw new Error("Visual baseline manifest contains a malformed or unbounded scenario entry")
    }
    const expected = expectedById.get(entry.id)
    if (entry.route !== expected.route || entry.surface !== expected.surface || entry.theme !== expected.theme ||
        entry.viewport.width !== expected.width || entry.viewport.height !== expected.height ||
        entry.image.width !== expected.width || entry.image.height !== expected.height ||
        (entry.route === "delivery" && entry.dom.tableCount !== 45)) {
      throw new Error("Visual baseline scenario differs from the exact fixture catalog")
    }
    expectedById.delete(entry.id)
  }
  if (expectedById.size !== 0) throw new Error("Visual baseline manifest omits a fixture scenario")
  return { scenarios: manifest.scenarios.length, renderer: manifest.renderer.fingerprint }
}

export function compareVisualCapture(entry, baselineBytes, candidateBytes) {
  const baseline = inspectPng(baselineBytes)
  const candidate = inspectPng(candidateBytes)
  if (baseline.sha256 !== entry.image.sha256 || baseline.bytes !== entry.image.bytes ||
      baseline.width !== entry.image.width || baseline.height !== entry.image.height) {
    throw new Error(`Committed visual baseline is tampered or stale: ${entry.id}`)
  }
  if (candidate.width !== entry.viewport.width || candidate.height !== entry.viewport.height) {
    throw new Error(`Visual candidate viewport differs from baseline: ${entry.id}`)
  }
  if (candidate.sha256 !== baseline.sha256 || !candidateBytes.equals(baselineBytes)) {
    throw new Error(`Visual regression detected: ${entry.id}`)
  }
  return candidate
}

export function validateVisualSourceBinding(manifest, bundleBytes, scenarioCatalogBytes) {
  if (!isObject(manifest?.source) ||
      manifest.source.bundleSha256 !== sha256(bundleBytes) ||
      manifest.source.scenarioCatalogSha256 !== sha256(scenarioCatalogBytes)) {
    throw new Error("Visual baseline source binding is stale or tampered")
  }
  return manifest.source
}

export function composeVisualRegressionReport({
  checkpoint,
  observedAt,
  renderer,
  baselineManifestSha256,
  focused,
  captures,
  sourceDigests,
}) {
  if (focused.status !== "passed" || focused.files !== visualFocusedTestFiles.length || focused.tests < 20 ||
      !Array.isArray(captures) || captures.length !== visualScenarioMatrix.length ||
      captures.some((capture) => capture.status !== "exact-match")) {
    throw new Error("Visual regression report cannot compose from an incomplete verification")
  }
  return {
    schemaVersion: 1,
    kind: "gaep-local-vscode-fixture-visual-regression-report",
    scope: {
      host: "vscode",
      execution: "local-offline-loopback-browser",
      repositoryCheckpoint: checkpoint,
      observedAt,
      normalProfile: "not-touched",
      otherHostMatrices: "not-run",
      externalSystems: "not-used",
      liveFigma: "not-used",
    },
    result: "fixture-baselines-exact-human-design-acceptance-pending",
    renderer,
    baseline: {
      path: baselineManifestPath,
      manifestSha256: baselineManifestSha256,
      comparison: "exact-png-bytes",
      environmentBound: true,
    },
    focusedVerification: {
      status: "passed",
      files: [...visualFocusedTestFiles],
      fileCount: focused.files,
      tests: focused.tests,
      skipped: focused.skipped,
    },
    captures,
    coverage: {
      scenarios: captures.length,
      routes: ["overview", "delivery", "scope", "trace"],
      workflowStates: ["ready", "empty", "invalid"],
      responsiveClasses: ["compact-under-720", "wide-at-least-1200"],
      themes: ["light", "dark"],
      deliveryTablesBound: 45,
    },
    sourceDigests,
    privacy: {
      loopbackOnly: true,
      externalNetworkDisabled: true,
      rawBrowserOutputIncluded: false,
      absoluteMachinePathsIncluded: false,
      environmentValuesIncluded: false,
      secretsIncluded: false,
    },
    authorityBoundary: "This report establishes exact offline fixture PNG equality for one recorded local Chrome renderer only. It grants no Figma, semantic, perceptual, native-display, human design, Product Owner, security, release, publication, deployment, provider, or other-host acceptance authority.",
    limitations: [
      "Exact PNG bytes are intentionally renderer, operating-system, font, and scale-factor bound; a renderer change requires explicit baseline review rather than automatic acceptance.",
      "The fixtures exercise the real Product Studio client with deterministic metadata, not current live Figma content or real Product source truth.",
      "Viewport screenshots do not prove every scroll position, display scale, VS Code theme, GPU path, native webview, or perceptual quality outcome.",
      "No human visual review or Product Owner acceptance is recorded.",
    ],
  }
}

function parseArguments(args) {
  const options = {
    mode: "verify",
    chrome: defaultChrome,
    output: undefined,
    checkpoint: "working-tree",
    observedAt: "not-recorded",
  }
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === "--verify") options.mode = "verify"
    else if (flag === "--update-baselines") options.mode = "update"
    else if (["--chrome", "--output", "--checkpoint", "--observed-at"].includes(flag)) {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
      if (flag === "--chrome") options.chrome = value
      if (flag === "--output") options.output = value
      if (flag === "--checkpoint") options.checkpoint = value
      if (flag === "--observed-at") options.observedAt = value
      index += 1
    } else throw new Error(`Unknown argument: ${flag}`)
  }
  if (!isAbsolute(options.chrome) || !existsSync(options.chrome)) throw new Error("A readable absolute local Chrome binary is required")
  if (!/^(?:working-tree|[0-9a-f]{7,64})$/u.test(options.checkpoint)) {
    throw new Error("--checkpoint must be working-tree or a Git object ID")
  }
  if (options.observedAt !== "not-recorded" && Number.isNaN(Date.parse(options.observedAt))) {
    throw new Error("--observed-at must be an ISO-8601 timestamp")
  }
  if (options.mode === "update" && options.output) throw new Error("Baseline update cannot emit a verification report")
  return options
}

async function runCommand(executable, args, { output = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: repositoryRoot,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += chunk
      if (output) process.stdout.write(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
      if (output) process.stderr.write(chunk)
    })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) resolvePromise({ stdout, stderr })
      else reject(new Error(`Local visual command failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}`))
    })
  })
}

async function runChromeCapture(executable, args, screenshotPath, scenario) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: repositoryRoot,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let ready
    let settled = false
    let terminationTimer
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => {
      settled = true
      clearInterval(poll)
      clearTimeout(deadline)
      reject(error)
    })
    const poll = setInterval(() => {
      if (ready || !existsSync(screenshotPath) || !stdout.includes('data-visual-ready="true"')) return
      void readFile(screenshotPath).then((bytes) => {
        const image = inspectPng(bytes)
        const dom = parseRenderedDom(stdout, scenario)
        ready = { bytes, image, dom, stdout, stderr }
        child.kill("SIGTERM")
        terminationTimer = setTimeout(() => child.kill("SIGKILL"), 2_000)
      }).catch(() => undefined)
    }, 100)
    const deadline = setTimeout(() => {
      if (settled) return
      settled = true
      clearInterval(poll)
      child.kill("SIGKILL")
      reject(new Error(`Local Chrome did not complete the visual fixture within 20 seconds: ${scenario.id}`))
    }, 20_000)
    child.on("exit", (code, signal) => {
      if (settled) return
      settled = true
      clearInterval(poll)
      clearTimeout(deadline)
      clearTimeout(terminationTimer)
      if (ready) resolvePromise(ready)
      else reject(new Error(
        `Local Chrome exited before the fixture capture completed (${signal ? `signal ${signal}` : `exit code ${String(code)}`}): ${scenario.id}`,
      ))
    })
  })
}

async function chromeIdentity(chrome) {
  const result = await runCommand(chrome, ["--version"])
  const match = /^Google Chrome (\d+(?:\.\d+){3})\s*$/u.exec(result.stdout.trim())
  if (!match) throw new Error("Local visual renderer did not return a supported Google Chrome version")
  const version = match[1]
  return {
    name: "chrome-headless",
    product: "Google Chrome",
    version,
    fingerprint: `google-chrome-${version}-headless-dsf1`,
  }
}

function visualDocument() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}'; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAEP Product Studio visual fixture</title>
</head>
<body data-studio-channel="visual_fixture_channel_1234567890" data-studio-route="overview">
  <div id="studio-root" aria-busy="true"></div>
  <div id="studio-live-polite" class="live-region" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="studio-live-assertive" class="live-region" role="alert" aria-live="assertive" aria-atomic="true"></div>
  <script nonce="${nonce}">
    globalThis.acquireVsCodeApi = () => ({ postMessage: () => undefined, getState: () => undefined, setState: () => undefined });
  </script>
  <script src="/bundle.js"></script>
</body>
</html>`
}

async function startFixtureServer(bundleBytes) {
  const document = visualDocument()
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    if (url.pathname === "/bundle.js") {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      response.end(bundleBytes)
      return
    }
    if (url.pathname === "/fixture") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; img-src 'self' data:; style-src 'nonce-${nonce}'; script-src 'self' 'nonce-${nonce}'; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`,
        "X-Content-Type-Options": "nosniff",
      })
      response.end(document)
      return
    }
    response.writeHead(404, { "Content-Type": "text/plain" })
    response.end("not found")
  })
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const address = server.address()
  if (!isObject(address) || typeof address.port !== "number") throw new Error("Local visual fixture server did not bind")
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())),
  }
}

function parseRenderedDom(dom, scenario) {
  const body = /<body\b[^>]*>/u.exec(dom)?.[0]
  if (!body || !body.includes('data-visual-ready="true"') ||
      !body.includes(`data-visual-scenario="${scenario.id}"`) ||
      !body.includes(`data-visual-route="${scenario.route}"`) ||
      !body.includes(`data-visual-surface="${scenario.surface}"`)) {
    throw new Error(`Product Studio fixture did not reach the exact rendered state: ${scenario.id}`)
  }
  const tableMatch = /data-visual-tables="(\d+)"/u.exec(body)
  if (!tableMatch) throw new Error(`Product Studio fixture did not report its table count: ${scenario.id}`)
  const innerWidth = Number(/data-visual-inner-width="(\d+)"/u.exec(body)?.[1])
  if (innerWidth !== scenario.width) {
    throw new Error(
      `Product Studio CSS viewport differs from the fixture width: ${scenario.id} expected ${scenario.width}, received ${innerWidth}`,
    )
  }
  const tableCount = Number(tableMatch[1])
  if (!Number.isInteger(tableCount) || tableCount < 0 || (scenario.route === "delivery" && tableCount !== 45)) {
    throw new Error(`Product Studio fixture table projection is incomplete: ${scenario.id}`)
  }
  return { ready: true, tableCount }
}

async function captureScenario(chrome, renderer, serverOrigin, temporaryRoot, scenario) {
  const screenshotPath = resolve(temporaryRoot, `${scenario.id}.png`)
  const profilePath = resolve(temporaryRoot, `profile-${scenario.id}`)
  await mkdir(profilePath, { recursive: true })
  const url = `${serverOrigin}/fixture?scenario=${encodeURIComponent(scenario.id)}`
  const result = await runChromeCapture(chrome, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-background-networking",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-domain-reliability",
    "--disable-extensions",
    "--disable-notifications",
    "--disable-push-messaging",
    "--disable-sync",
    "--metrics-recording-only",
    "--safebrowsing-disable-auto-update",
    "--disable-features=OptimizationHints,OptimizationGuideModelDownloading,MediaRouter,Translate,AutofillServerCommunication,CertificateTransparencyComponentUpdater",
    "--host-resolver-rules=MAP * 0.0.0.0,EXCLUDE 127.0.0.1,EXCLUDE localhost",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profilePath}`,
    `--window-size=${scenario.width},${scenario.height}`,
    `--screenshot=${screenshotPath}`,
    "--virtual-time-budget=2000",
    "--dump-dom",
    url,
  ], screenshotPath, scenario)
  const { bytes, image } = result
  if (image.width !== scenario.width || image.height !== scenario.height) {
    throw new Error(`Chrome screenshot dimensions differ from the fixture viewport: ${scenario.id}`)
  }
  return {
    scenario,
    renderer,
    screenshotPath,
    bytes,
    image,
    dom: result.dom,
  }
}

async function sourceDigests() {
  const entries = []
  for (const path of [...reportInputFiles, baselineManifestPath].sort()) {
    const artifact = await readRepositoryRegularFile(repositoryRoot, path, { maximumBytes: 16 * 1024 * 1024 })
    entries.push({ path, bytes: artifact.bytes.byteLength, sha256: sha256(artifact.bytes) })
  }
  return entries
}

function assertPrivacySafe(report) {
  const serialized = JSON.stringify(report)
  for (const prefix of ["/Users/", "/home/", "C:\\Users\\", "/tmp/", "/private/tmp/"]) {
    if (serialized.includes(prefix)) throw new Error(`Visual report contains an absolute path prefix: ${prefix}`)
  }
  if (report.sourceDigests.some((entry) => isAbsolute(entry.path) ||
      relative(repositoryRoot, resolve(repositoryRoot, entry.path)).startsWith(".."))) {
    throw new Error("Visual report contains a source path outside the repository")
  }
}

export async function runVisualRegression(args = process.argv.slice(2)) {
  const options = parseArguments(args)
  validateVisualScenarioMatrix()
  const renderer = await chromeIdentity(options.chrome)
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "gaep-vscode-visual-"))
  let server
  try {
    const bundlePath = resolve(temporaryRoot, "visual-browser-bundle.js")
    await build({
      entryPoints: [resolve(repositoryRoot, "apps/vscode/test/visual/browser-entry.ts")],
      outfile: bundlePath,
      bundle: true,
      platform: "browser",
      format: "iife",
      target: "es2023",
      sourcemap: false,
      minify: false,
      logLevel: "silent",
      absWorkingDir: repositoryRoot,
    })
    const bundleBytes = await readFile(bundlePath)
    server = await startFixtureServer(bundleBytes)
    const captures = []
    for (const scenario of visualScenarioMatrix) {
      captures.push(await captureScenario(options.chrome, renderer, server.origin, temporaryRoot, scenario))
      process.stdout.write(`Visual fixture rendered: ${scenario.id}\n`)
    }

    const scenarioCatalog = await readRepositoryRegularFile(
      repositoryRoot,
      "apps/vscode/src/studio-visual-scenarios.json",
      { maximumBytes: 128 * 1024 },
    )
    if (options.mode === "update") {
      if (existsSync(resolve(repositoryRoot, baselineManifestPath))) {
        throw new Error("Visual baseline manifest already exists; baseline replacement requires a separate reviewed change")
      }
      for (const capture of captures) {
        await writeExclusiveRepositoryFile(
          repositoryRoot,
          `${baselineRoot}/${capture.scenario.id}.png`,
          capture.bytes,
        )
      }
      const manifest = {
        schemaVersion: 1,
        kind: "gaep-vscode-product-studio-visual-baseline",
        renderer,
        source: {
          bundleSha256: sha256(bundleBytes),
          scenarioCatalogSha256: sha256(scenarioCatalog.bytes),
        },
        scenarios: captures.map((capture) => ({
          id: capture.scenario.id,
          route: capture.scenario.route,
          surface: capture.scenario.surface,
          theme: capture.scenario.theme,
          viewport: { width: capture.scenario.width, height: capture.scenario.height },
          image: {
            path: `${baselineRoot}/${capture.scenario.id}.png`,
            bytes: capture.image.bytes,
            sha256: capture.image.sha256,
            width: capture.image.width,
            height: capture.image.height,
          },
          dom: capture.dom,
        })),
        authorityBoundary: "This manifest binds deterministic offline Product Studio fixture PNGs for one exact local Chrome renderer. It is not Figma, perceptual, native-display, human design, Product Owner, release, publication, deployment, provider, or other-host acceptance.",
        limitations: [
          "Baselines are renderer, operating-system, font, and scale-factor bound.",
          "Fixtures are deterministic local metadata, not current live Figma or real Product source truth.",
          "Viewport captures do not prove every scroll position, theme, display, GPU, or native webview path.",
          "Human visual and Product Owner acceptance remain pending.",
        ],
      }
      validateVisualBaselineManifest(manifest, renderer.fingerprint)
      await writeExclusiveRepositoryFile(repositoryRoot, baselineManifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      process.stdout.write(`GAEP Product Studio visual baselines written: ${baselineManifestPath}\n`)
      return manifest
    }

    const baselineArtifact = await readRepositoryRegularFile(repositoryRoot, baselineManifestPath, { maximumBytes: 1024 * 1024 })
    const manifest = JSON.parse(baselineArtifact.bytes.toString("utf8"))
    validateVisualBaselineManifest(manifest, renderer.fingerprint)
    validateVisualSourceBinding(manifest, bundleBytes, scenarioCatalog.bytes)
    const manifestEntries = new Map(manifest.scenarios.map((entry) => [entry.id, entry]))
    const verifiedCaptures = []
    for (const capture of captures) {
      const entry = manifestEntries.get(capture.scenario.id)
      if (!entry) throw new Error(`Visual baseline entry is absent: ${capture.scenario.id}`)
      const baseline = await readRepositoryRegularFile(repositoryRoot, entry.image.path, { maximumBytes: 16 * 1024 * 1024 })
      const compared = compareVisualCapture(entry, baseline.bytes, capture.bytes)
      verifiedCaptures.push({
        id: capture.scenario.id,
        route: capture.scenario.route,
        surface: capture.scenario.surface,
        theme: capture.scenario.theme,
        width: compared.width,
        height: compared.height,
        bytes: compared.bytes,
        sha256: compared.sha256,
        tableCount: capture.dom.tableCount,
        status: "exact-match",
      })
    }
    const vitestEntry = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs")
    if (!existsSync(vitestEntry)) throw new Error("The local Vitest entrypoint is unavailable")
    const focusedOutput = await runCommand(process.execPath, [
      vitestEntry,
      "run",
      ...visualFocusedTestFiles,
      "--maxWorkers=2",
    ], { output: true })
    const report = composeVisualRegressionReport({
      checkpoint: options.checkpoint,
      observedAt: options.observedAt,
      renderer,
      baselineManifestSha256: sha256(baselineArtifact.bytes),
      focused: parseVitestSummary(`${focusedOutput.stdout}\n${focusedOutput.stderr}`),
      captures: verifiedCaptures,
      sourceDigests: await sourceDigests(),
    })
    assertPrivacySafe(report)
    const serialized = `${JSON.stringify(report, null, 2)}\n`
    if (options.output) {
      const path = await writeExclusiveRepositoryFile(repositoryRoot, options.output, serialized)
      process.stdout.write(`GAEP local VS Code visual regression report written: ${path}\n`)
    } else process.stdout.write(serialized)
    return report
  } finally {
    if (server) await server.close()
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runVisualRegression()
