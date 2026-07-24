import { createHash } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import { resolve } from "node:path"

import { build } from "esbuild"

const root = resolve(import.meta.dirname)
const packagedEnginePath = resolve(root, "dist/gaep-engine.mjs")

await rm(resolve(root, "dist"), { recursive: true, force: true })
await build({
  absWorkingDir: root,
  entryPoints: [resolve(root, "../engine-host/src/main.ts")],
  outfile: packagedEnginePath,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  minify: false,
  logLevel: "info",
})

const packagedEngineSha256 = createHash("sha256")
  .update(await readFile(packagedEnginePath))
  .digest("hex")

await build({
  absWorkingDir: root,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: false,
  minify: false,
  logLevel: "info",
  define: {
    __GAEP_PACKAGED_ENGINE_SHA256__: JSON.stringify(`sha256:${packagedEngineSha256}`),
  },
})

if (process.argv.includes("--tests")) {
  await rm(resolve(root, "dist-test"), { recursive: true, force: true })
  await build({
    absWorkingDir: root,
    entryPoints: ["tests/unit.test.ts"],
    outfile: "dist-test/unit.test.mjs",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: false,
    minify: false,
    logLevel: "info",
  })
}
