import * as vscode from "vscode";
import { AgentWebviewProvider } from "./ui/AgentWebviewProvider";

export async function activate(context: vscode.ExtensionContext) {
  const provider = new AgentWebviewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "code-sidecar.SidebarProvider",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  // 注册分析选中代码的命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "code-sidecar.analyzeSelectedCode",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        const fileName = editor.document.fileName;
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        const analysisPrompt = `${fileName}:${startLine}-${endLine}

\`\`\`
${selectedText}
\`\`\`
`;
        provider.setInputValue(analysisPrompt);

        // vscode 自带的关于 webview 的命令，自动唤醒 webview 
        vscode.commands.executeCommand(
          "code-sidecar.SidebarProvider.focus"
        );
      }
    )
  );
}

export function deactivate() {}
