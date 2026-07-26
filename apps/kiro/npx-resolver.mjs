// GAEP-P0-CS02 — platform-safe `npx` executable name. On Windows the runnable is `npx.cmd`; passing
// bare `npx` to execFileSync (without shell) yields `spawnSync npx ENOENT`. Kept as a tiny pure
// function so it is unit-testable and used by the Kiro packager without enabling `shell:true`.
export function npxExecutable(platform = process.platform) {
  return platform === "win32" ? "npx.cmd" : "npx"
}
