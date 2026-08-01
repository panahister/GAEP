import * as vscode from "vscode"

import {
  estimateGaepWorkflowTokens,
  gaepWorkflowLanguageModelDescriptor,
  gaepWorkflowLanguageModelVendor,
} from "./gaep-workflow-language-model-contract.js"

export const gaepWorkflowLanguageModelInformation: vscode.LanguageModelChatInformation = gaepWorkflowLanguageModelDescriptor

function requestMessageText(message: vscode.LanguageModelChatRequestMessage): string {
  return message.content
    .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
    .map((part) => part.value)
    .join("\n")
}

export function registerGaepWorkflowLanguageModel(context: vscode.ExtensionContext): vscode.Disposable {
  const provider: vscode.LanguageModelChatProvider = {
    provideLanguageModelChatInformation: () => [gaepWorkflowLanguageModelInformation],
    provideLanguageModelChatResponse: async (_model, messages, _options, progress) => {
      const addressedToGaep = messages.some((message) => /@gaep|\/initialize|\/help/iu.test(requestMessageText(message)))
      progress.report(new vscode.LanguageModelTextPart(addressedToGaep
        ? "Use the @gaep participant and its slash commands. GAEP governed workflows do not require this local model to generate an answer."
        : "This local model only enables GAEP governed conversational workflows. Start with @gaep /help."))
    },
    provideTokenCount: async (_model, value) => estimateGaepWorkflowTokens(
      typeof value === "string" ? value : requestMessageText(value),
    ),
  }
  const registration = vscode.lm.registerLanguageModelChatProvider(gaepWorkflowLanguageModelVendor, provider)
  context.subscriptions.push(registration)
  return registration
}
