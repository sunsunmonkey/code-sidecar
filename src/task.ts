import OpenAI from "openai";
import { ApiConfiguration, ApiHandler } from "./apiHandler";
import { AgentWebviewProvider } from "./AgentWebviewProvider";

export class Task {
  constructor(
    private provider: AgentWebviewProvider,
    private apiConfiguration: ApiConfiguration,
    private message: string
  ) {}

  async start() {
    const apiHandler = new ApiHandler(this.apiConfiguration);
    const systemPrompt = "";
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: this.message },
    ];

    const stream = apiHandler.createMassage(systemPrompt, messages);

    for await (const chunk of stream) {
      console.log(chunk);
      this.provider.postMessage(chunk);
    }
  }
}
