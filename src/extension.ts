import * as vscode from "vscode";
import { AgentWebviewProvider } from "./ui/AgentWebviewProvider";

export async function activate(context: vscode.ExtensionContext) {
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

  // Register configuration command - navigates to config page in main webview
  // Requirements: 1.1, 10.1, 10.2, 10.3, 10.4, 10.5
  context.subscriptions.push(
    vscode.commands.registerCommand("coding-agent-slim.configureApi", async () => {
      await vscode.commands.executeCommand("coding-agent-slim.openConfiguration");
    })
  );

  // Register command to open configuration interface (Requirement: 1.1)
  context.subscriptions.push(
    vscode.commands.registerCommand("coding-agent-slim.openConfiguration", () => {
      // Focus the main webview and navigate to config page
      vscode.commands.executeCommand("coding-agent-slim.SidebarProvider.focus");
      provider.navigateToConfig();
    })
  );

  // Check if API is configured and show setup wizard if needed (Requirement: 1.5)
  await checkAndShowSetupWizard(context, provider.getConfigurationManager());
}

/**
 * Check if API is configured and automatically open configuration interface if not
 * Requirement: 1.5 - First-time setup wizard
 * 
 * @param context Extension context
 * @param configManager Configuration manager instance
 */
async function checkAndShowSetupWizard(
  context: vscode.ExtensionContext,
  configManager: any
): Promise<void> {
  try {
    // Check if this is the first activation (no API key configured)
    const isConfigured = await configManager.isApiConfigured();
    
    if (!isConfigured) {
      // Show welcome message and automatically open configuration interface
      const result = await vscode.window.showInformationMessage(
        'Welcome to AI Coding Assistant! Let\'s get you set up.',
        'Configure Now',
        'Later'
      );

      if (result === 'Configure Now') {
        // Open the configuration webview
        await vscode.commands.executeCommand('coding-agent-slim.openConfiguration');
      }
    }
  } catch (error) {
    console.error('[Extension] Failed to check configuration status:', error);
  }
}

export function deactivate() {}
