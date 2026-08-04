import type * as vscode from "vscode"

export function createRecordingChatResponseStream(
  target: vscode.ChatResponseStream,
  recordMarkdown: (value: string) => void,
): vscode.ChatResponseStream {
  return {
    markdown(value) {
      recordMarkdown(typeof value === "string" ? value : value.value)
      target.markdown(value)
    },
    anchor(value, title) {
      target.anchor(value, title)
    },
    button(command) {
      target.button(command)
    },
    filetree(value, baseUri) {
      target.filetree(value, baseUri)
    },
    progress(value) {
      target.progress(value)
    },
    reference(value, iconPath) {
      target.reference(value, iconPath)
    },
    push(part) {
      target.push(part)
    },
  }
}
