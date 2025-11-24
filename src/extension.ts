import * as vscode from "vscode";
import { AgentWebviewProvider } from "./AgentWebviewProvider";
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "coding-agent-slim.SidebarProvider",
      new AgentWebviewProvider(context)
    )
  );
}

export function deactivate() {}
