/**
 * MCP Client - Handles communication with MCP servers via stdio
 * Uses JSON-RPC 2.0 protocol over stdin/stdout
 */

import { spawn, ChildProcess } from "child_process";
import { logger } from "code-sidecar-shared/utils/logger";
import type {
  MCPServerConfig,
  MCPToolDefinition,
  MCPConnectionStatus,
  MCPServerState,
} from "code-sidecar-shared/types/mcp";

interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

/**
 * MCP Client manages connection to a single MCP server
 */
export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private buffer = "";
  private _status: MCPConnectionStatus = "disconnected";
  private _tools: MCPToolDefinition[] = [];
  private _error?: string;

  private readonly onStatusChange: (state: MCPServerState) => void;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly config: MCPServerConfig,
    onStatusChange: (state: MCPServerState) => void
  ) {
    this.onStatusChange = onStatusChange;
  }

  get id(): string {
    return this.config.id;
  }

  get status(): MCPConnectionStatus {
    return this._status;
  }

  get tools(): MCPToolDefinition[] {
    return this._tools;
  }

  get error(): string | undefined {
    return this._error;
  }

  getState(): MCPServerState {
    return {
      id: this.config.id,
      status: this._status,
      tools: this._tools,
      error: this._error,
      lastConnected: this._status === "connected" ? Date.now() : undefined,
    };
  }

  private setStatus(status: MCPConnectionStatus, error?: string): void {
    this._status = status;
    this._error = error;
    this.onStatusChange(this.getState());
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this._status === "connected" || this._status === "connecting") {
      return;
    }

    this.setStatus("connecting");
    logger.debug(`[MCPClient] Connecting to server: ${this.config.name}`);
    logger.debug(
      `[MCPClient] Command: ${this.config.command} ${(
        this.config.args || []
      ).join(" ")}`
    );

    try {
      // Create a promise that rejects if process exits early
      let processExited = false;
      let exitError: Error | null = null;
      let stderrOutput = "";

      // Spawn the MCP server process
      this.process = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      // Handle stdout data
      this.process.stdout?.on("data", (data: Buffer) => {
        this.handleData(data.toString());
      });

      // Handle stderr for logging and error capture
      this.process.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        stderrOutput += output;
        logger.debug(`[MCPClient ${this.config.name}] stderr: ${output}`);
      });

      // Handle process exit
      this.process.on("exit", (code) => {
        logger.debug(
          `[MCPClient ${this.config.name}] Process exited with code: ${code}`
        );
        processExited = true;
        if (code !== 0 && this._status === "connecting") {
          exitError = new Error(
            `MCP server process exited with code ${code}. ${
              stderrOutput
                ? `Error: ${stderrOutput.trim()}`
                : "Check if the command is correct and the package is installed."
            }`
          );
        }
        this.handleDisconnect();
      });

      // Handle process error
      this.process.on("error", (err) => {
        logger.debug(`[MCPClient ${this.config.name}] Process error:`, err);
        processExited = true;
        exitError = err;
        this.setStatus("error", err.message);
      });

      // Wait a bit to see if process exits immediately
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (processExited || exitError) {
        throw exitError || new Error("Process exited unexpectedly");
      }

      // Initialize the connection
      await this.initialize();

      // List available tools
      await this.listTools();

      this.setStatus("connected");
      logger.debug(
        `[MCPClient] Connected to server: ${this.config.name}, tools: ${this._tools.length}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(
        `[MCPClient] Failed to connect to ${this.config.name}:`,
        error
      );
      this.setStatus("error", message);
      this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Client disconnected"));
      this.pendingRequests.delete(id);
    }

    this._tools = [];
    this.buffer = "";
    this.setStatus("disconnected");
    logger.debug(`[MCPClient] Disconnected from server: ${this.config.name}`);
  }

  private handleDisconnect(): void {
    if (this._status !== "disconnected") {
      this.disconnect();
    }
  }

  /**
   * Handle incoming data from the server
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete messages (newline-delimited JSON)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          logger.debug(
            `[MCPClient ${this.config.name}] Failed to parse message:`,
            line
          );
        }
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
   */
  private handleMessage(message: JSONRPCResponse | JSONRPCNotification): void {
    if ("id" in message && message.id !== undefined) {
      // Response to a request
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      // Notification from server
      logger.debug(`[MCPClient ${this.config.name}] Notification:`, message);
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    if (!this.process?.stdin) {
      throw new Error("Not connected to MCP server");
    }

    const id = ++this.requestId;
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.REQUEST_TIMEOUT);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const message = JSON.stringify(request) + "\n";
      this.process!.stdin!.write(message);
    });
  }

  /**
   * Initialize the MCP connection
   */
  private async initialize(): Promise<void> {
    const result = await this.sendRequest<{
      protocolVersion: string;
      capabilities: unknown;
      serverInfo: { name: string; version: string };
    }>("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "CodeSidecar",
        version: "0.0.1",
      },
    });

    logger.debug(`[MCPClient ${this.config.name}] Initialized:`, result);

    // Send initialized notification
    const notification: JSONRPCNotification = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    };
    this.process!.stdin!.write(JSON.stringify(notification) + "\n");
  }

  /**
   * List available tools from the server
   */
  private async listTools(): Promise<void> {
    const result = await this.sendRequest<{ tools: MCPToolDefinition[] }>(
      "tools/list"
    );
    this._tools = result.tools || [];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (this._status !== "connected") {
      throw new Error(`MCP server ${this.config.name} is not connected`);
    }

    const tool = this._tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(
        `Tool ${toolName} not found on server ${this.config.name}`
      );
    }

    logger.debug(
      `[MCPClient ${this.config.name}] Calling tool: ${toolName}`,
      args
    );

    const result = await this.sendRequest<{ content: unknown[] }>(
      "tools/call",
      {
        name: toolName,
        arguments: args,
      }
    );

    return result.content;
  }
}
