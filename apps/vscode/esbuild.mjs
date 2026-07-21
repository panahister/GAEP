import { build } from "esbuild"

await Promise.all([
  build({
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["vscode"],
    sourcemap: true,
    minify: false,
    logLevel: "info",
  }),
  build({
    entryPoints: ["src/studio-client.ts"],
    outfile: "dist/studio-client.js",
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2023",
    sourcemap: true,
    minify: false,
    logLevel: "info",
  }),
])
