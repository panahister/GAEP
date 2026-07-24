import { rm } from "node:fs/promises"
import { resolve } from "node:path"

import { build } from "esbuild"

const root = resolve(import.meta.dirname)

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
