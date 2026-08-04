export const productChatLauncherCommands = [
  "initialize",
  "adopt",
  "revise",
  "initiative",
  "edit",
  "continue",
  "classification",
  "applicability",
  "intake",
  "align",
  "manifest",
  "record",
  "baseline",
  "provenance",
  "author",
  "mode",
  "suggest",
  "roles",
  "resolve",
  "advisor",
  "agent",
  "model",
  "accept",
  "status",
  "review",
  "back",
  "commit",
  "cancel",
  "help",
] as const

const supportedProductChatLauncherCommands = new Set<string>(productChatLauncherCommands)

export function resolveProductChatLauncherCommand(requestedCommand: unknown): string {
  if (requestedCommand === undefined) return "initialize"
  return typeof requestedCommand === "string" && supportedProductChatLauncherCommands.has(requestedCommand)
    ? requestedCommand
    : "help"
}
