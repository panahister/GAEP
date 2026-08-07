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
  "inspect",
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

const commandsRequiringCurrentConversation = new Set<string>([
  "accept",
  "back",
  "cancel",
  "commit",
  "inspect",
  "manifest",
  "record",
  "resolve",
  "review",
  "roles",
  "suggest",
])

export function resolveProductChatLauncherCommand(requestedCommand: unknown): string {
  if (requestedCommand === undefined) return "initialize"
  return typeof requestedCommand === "string" && supportedProductChatLauncherCommands.has(requestedCommand)
    ? requestedCommand
    : "help"
}

export function shouldSubmitProductChatLauncher(
  requestedCommand: unknown,
  executeImmediately?: unknown,
): boolean {
  if (typeof executeImmediately === "boolean") return executeImmediately
  return typeof requestedCommand === "string" && supportedProductChatLauncherCommands.has(requestedCommand)
}

/**
 * Draft actions are meaningful only in the conversation that owns their portable
 * metadata. This guard prevents a button from discarding the visible proposal by
 * opening a new Chat before /accept or /commit is submitted.
 */
export function shouldStartFreshProductChatSession(
  requestedCommand: unknown,
  requestedFreshSession?: unknown,
): boolean {
  if (requestedFreshSession !== true) return false
  const command = resolveProductChatLauncherCommand(requestedCommand)
  return !commandsRequiringCurrentConversation.has(command)
}
