import * as vscode from "vscode";
import { Task } from "./task";
import { ApiConfiguration } from "./apiHandler";

export class AgentWebviewProvider implements vscode.WebviewViewProvider {
  private webview: vscode.Webview | undefined;
  private currentTask: Task | undefined = undefined;
  private apiConfiguration: ApiConfiguration = {
    model: "tencent/Hunyuan-MT-7B",
    apiKey: "sk-lhnpwtcdxoisnmrpvcdgzuaqdrqtpjlrebdbzikldxgqtvbl",
    baseUrl: "https://api.siliconflow.cn/v1/",
  };
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Thenable<void> | void {
    this.webview = webviewView.webview;

    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview-ui",
        "dist",
        "assets",
        "index.js"
      )
    );

    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview-ui",
        "dist",
        "assets",
        "index.css"
      )
    );

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>webview-ui</title>
    <script type="module" crossorigin src=${scriptUri}></script>
    <link rel="stylesheet" crossorigin href=${styleUri}>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

    webviewView.webview.onDidReceiveMessage(async (message: string) => {
      vscode.window.showInformationMessage(message);
      this.currentTask = new Task(this.apiConfiguration, message);
      this.currentTask.start();
    });
  }

  postMessage(message: string) {
    this.webview?.postMessage(message);
  }
}
