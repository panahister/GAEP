import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const options = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key || !value || !["--output", "--kotlin-output"].includes(key)) {
    throw new Error("Usage: build_engine_bundle.mjs --output <path> --kotlin-output <path>")
  }
  options.set(key, value)
}

function repositoryOutput(name) {
  const value = options.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  const output = resolve(repositoryRoot, value)
  const path = relative(repositoryRoot, output)
  if (path === "" || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`${name} must stay inside the repository`)
  }
  return output
}

const output = repositoryOutput("--output")
const kotlinOutput = repositoryOutput("--kotlin-output")
await Promise.all([mkdir(dirname(output), { recursive: true }), mkdir(dirname(kotlinOutput), { recursive: true })])
await build({
  absWorkingDir: repositoryRoot,
  entryPoints: ["apps/engine-host/src/main.ts"],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  minify: false,
  logLevel: "info",
})

const digest = createHash("sha256").update(await readFile(output)).digest("hex")
await writeFile(kotlinOutput, [
  "package dev.gaep.rider",
  "",
  "internal object PackagedEngineBuild {",
  `    const val SHA256 = \"${digest}\"`,
  "}",
  "",
].join("\n"), "utf8")
process.stdout.write(`PASS deterministic GAEP engine bundle sha256:${digest}\n`)
