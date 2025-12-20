/**
 * Text content in assistant message
 */
export type TextContent = {
  type: "text";
  content: string;
  partial?: boolean;
};

/**
 * Tool use request from assistant
 */
export type ToolUse = {
  type: "tool_use";
  name: string;
  params: Record<string, any>;
  partial?: boolean;
};

/**
 * Content types in assistant message
 */
export type AssistantMessageContent = ToolUse | TextContent;

/**
 * Streaming-friendly assistant message parser.
 * Parses tool calls and text as chunks arrive to avoid reparsing the full string.
 */
export class AssistantMessageParser {
  private contentBlocks: AssistantMessageContent[] = [];
  private currentTextContent: TextContent | undefined = undefined;
  private currentTextContentStartIndex = 0;
  private currentToolUse: ToolUse | undefined = undefined;
  private currentToolUseStartIndex = 0;
  private currentParamName: string | undefined = undefined;
  private currentParamValueStartIndex = 0;
  private readonly maxAccumulatorSize = 1024 * 1024; // 1MB limit
  private readonly maxParamLength = 1024 * 100; // 100KB per parameter limit
  private accumulator = "";
  private readonly toolOpeningTags: string[];
  private readonly paramOpeningTags: string[];
  private readonly validToolNames: string[];

  constructor(toolNames: string[], paramNames: string[]) {
    this.validToolNames = toolNames;
    this.toolOpeningTags = toolNames.map((name) => `<${name}>`);
    this.paramOpeningTags = paramNames.map((name) => `<${name}>`);
    this.reset();
  }

  /**
   * Reset the parser state.
   */
  public reset(): void {
    this.contentBlocks = [];
    this.currentTextContent = undefined;
    this.currentTextContentStartIndex = 0;
    this.currentToolUse = undefined;
    this.currentToolUseStartIndex = 0;
    this.currentParamName = undefined;
    this.currentParamValueStartIndex = 0;
    this.accumulator = "";
  }

  /**
   * Returns the current parsed content blocks
   */
  public getContentBlocks(): AssistantMessageContent[] {
    return this.contentBlocks.slice();
  }

  /**
   * Process a new chunk of text and update the parser state.
   * @param chunk The new chunk of text to process.
   */
  public processChunk(chunk: string): AssistantMessageContent[] {
    if (this.accumulator.length + chunk.length > this.maxAccumulatorSize) {
      throw new Error("Assistant message exceeds maximum allowed size");
    }

    const accumulatorStartLength = this.accumulator.length;

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      this.accumulator += char;
      const currentPosition = accumulatorStartLength + i;

      if (this.currentToolUse && this.currentParamName) {
        const currentParamValue = this.accumulator.slice(
          this.currentParamValueStartIndex
        );

        if (currentParamValue.length > this.maxParamLength) {
          this.currentParamName = undefined;
          this.currentParamValueStartIndex = 0;
          continue;
        }

        const paramClosingTag = `</${this.currentParamName}>`;
        if (currentParamValue.endsWith(paramClosingTag)) {
          const paramValue = currentParamValue.slice(
            0,
            -paramClosingTag.length
          );
          this.currentToolUse.params[this.currentParamName] =
            this.currentParamName === "content"
              ? paramValue.replace(/^\n/, "").replace(/\n$/, "")
              : paramValue.trim();
          this.currentParamName = undefined;
          continue;
        }

        this.currentToolUse.params[this.currentParamName] = currentParamValue;
        continue;
      }

      if (this.currentToolUse) {
        const currentToolValue = this.accumulator.slice(
          this.currentToolUseStartIndex
        );
        const toolUseClosingTag = `</${this.currentToolUse.name}>`;
        if (currentToolValue.endsWith(toolUseClosingTag)) {
          this.currentToolUse.partial = false;
          this.currentToolUse = undefined;
          continue;
        }

        let startedParam = false;
        for (const paramOpeningTag of this.paramOpeningTags) {
          if (this.accumulator.endsWith(paramOpeningTag)) {
            const paramName = paramOpeningTag.slice(1, -1);
            this.currentParamName = paramName;
            this.currentParamValueStartIndex = this.accumulator.length;
            startedParam = true;
            break;
          }
        }

        if (startedParam) {
          continue;
        }

        const contentParamName = "content";
        if (
          this.currentToolUse.name === "write_file" &&
          this.accumulator.endsWith(`</${contentParamName}>`)
        ) {
          const toolContent = this.accumulator.slice(
            this.currentToolUseStartIndex
          );
          const contentStartTag = `<${contentParamName}>`;
          const contentEndTag = `</${contentParamName}>`;
          const contentStartIndex =
            toolContent.indexOf(contentStartTag) + contentStartTag.length;
          const contentEndIndex = toolContent.lastIndexOf(contentEndTag);

          if (
            contentStartIndex !== -1 &&
            contentEndIndex !== -1 &&
            contentEndIndex > contentStartIndex
          ) {
            this.currentToolUse.params[contentParamName] = toolContent
              .slice(contentStartIndex, contentEndIndex)
              .replace(/^\n/, "")
              .replace(/\n$/, "");
          }
        }

        continue;
      }

      let didStartToolUse = false;
      for (const toolUseOpeningTag of this.toolOpeningTags) {
        if (this.accumulator.endsWith(toolUseOpeningTag)) {
          const extractedToolName = toolUseOpeningTag.slice(1, -1);

          if (!this.validToolNames.includes(extractedToolName)) {
            continue;
          }

          this.currentToolUse = {
            type: "tool_use",
            name: extractedToolName,
            params: {},
            partial: true,
          };

          this.currentToolUseStartIndex = this.accumulator.length;

          if (this.currentTextContent) {
            this.currentTextContent.partial = false;
            this.currentTextContent.content = this.currentTextContent.content
              .slice(0, -toolUseOpeningTag.slice(0, -1).length)
              .trim();
            this.currentTextContent = undefined;
          }

          this.contentBlocks.push(this.currentToolUse);
          didStartToolUse = true;
          break;
        }
      }

      if (!didStartToolUse) {
        if (this.currentTextContent === undefined) {
          this.currentTextContentStartIndex = currentPosition;

          this.currentTextContent = {
            type: "text",
            content: this.accumulator
              .slice(this.currentTextContentStartIndex)
              .trim(),
            partial: true,
          };

          this.contentBlocks.push(this.currentTextContent);
        } else {
          this.currentTextContent.content = this.accumulator
            .slice(this.currentTextContentStartIndex)
            .trim();
        }
      }
    }

    return this.getContentBlocks();
  }

  /**
   * Finalize any partial content blocks.
   * Should be called after processing the last chunk.
   */
  public finalizeContentBlocks(): void {
    for (const block of this.contentBlocks) {
      if (block.partial) {
        block.partial = false;
      }
      if (block.type === "text" && typeof block.content === "string") {
        block.content = block.content.trim();
      }
    }
  }
}
