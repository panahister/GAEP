export type ProductInitializationPresentation =
  | { state: "initialized" }
  | { state: "uninitialized"; message: string; action: "Initialize Product" }
  | { state: "partial"; message: string; action: "Show Diagnostics" }

export function productInitializationPresentation(
  gaepDirectoryExists: boolean,
  manifestExists: boolean,
): ProductInitializationPresentation {
  if (manifestExists) return { state: "initialized" }
  if (gaepDirectoryExists) {
    return {
      state: "partial",
      message: "This folder contains partial GAEP state but no .gaep/manifest.json. Initialization is disabled to preserve that state; inspect diagnostics before continuing.",
      action: "Show Diagnostics",
    }
  }
  return {
    state: "uninitialized",
    message: "This workspace folder is not a GAEP Product yet. Initialize Product before selecting an agent or model.",
    action: "Initialize Product",
  }
}
