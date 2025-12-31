import type { UserMessage } from "code-sidecar-shared/types/messages";

type MessageHandler<K extends UserMessage["type"]> = (
  message: Extract<UserMessage, { type: K }>
) => Promise<void> | void;

type AnyMessageHandler = (message: UserMessage) => Promise<void> | void;

export class MessageHandlerRegistry {
  private handlers: Partial<Record<UserMessage["type"], AnyMessageHandler>> = {};

  register<K extends UserMessage["type"]>(
    type: K,
    handler: MessageHandler<K>
  ): void {
    this.handlers[type] = handler as AnyMessageHandler;
  }

  async handle(message: UserMessage): Promise<void> {
    const handler = this.handlers[message.type];
    if (handler) {
      await handler(message);
    }
  }
}
