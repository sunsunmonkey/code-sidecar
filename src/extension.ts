import * as vscode from "vscode";
import { AgentWebviewProvider } from "./AgentWebviewProvider";
export function activate(context: vscode.ExtensionContext) {
  const provider = new AgentWebviewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "coding-agent-slim.SidebarProvider",
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("coding-agent-slim.helloWorld", () => {
      provider.postMessage("hello world");
    })
  );
}

export function deactivate() {}
