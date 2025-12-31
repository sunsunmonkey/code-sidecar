/**
 * MCP Manager - Manages all MCP server connections and provides unified interface
 */

import * as vscode from "vscode";
import { MCPClient } from "./MCPClient";
import { logger } from "code-sidecar-shared/utils/logger";
import type {
  MCPServerConfig,
  MCPServerState,
  MCPToolDefinition,
  MCPConfiguration,
  MCPMarketItem,
} from "code-sidecar-shared/types/mcp";

// Built-in MCP Market data
const MCP_MARKET_ITEMS: MCPMarketItem[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and manage files on the local filesystem",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem@latest",
      "${workspaceFolder}",
    ],
    category: "file-system",
    tags: ["files", "directories", "io"],
    featured: true,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Interact with GitHub repositories, issues, and pull requests",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github@latest"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
    category: "development",
    tags: ["git", "github", "vcs"],
    featured: true,
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query and manage PostgreSQL databases",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres@latest"],
    env: { POSTGRES_CONNECTION_STRING: "" },
    category: "database",
    tags: ["database", "sql", "postgres"],
    featured: true,
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Query and manage SQLite databases",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-sqlite@latest",
      "--db-path",
      "${workspaceFolder}/database.db",
    ],
    category: "database",
    tags: ["database", "sql", "sqlite"],
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Fetch and parse content from URLs",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch@latest"],
    category: "web",
    tags: ["http", "fetch", "web"],
  },
  {
    id: "puppeteer",
    name: "Puppeteer",
    description: "Browser automation and web scraping",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer@latest"],
    category: "web",
    tags: ["browser", "automation", "scraping"],
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Search the web using Brave Search API",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search@latest"],
    env: { BRAVE_API_KEY: "" },
    category: "web",
    tags: ["search", "web"],
  },
  {
    id: "memory",
    name: "Memory",
    description: "Persistent memory storage for conversations",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory@latest"],
    category: "productivity",
    tags: ["memory", "storage", "persistence"],
  },
  {
    id: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Step-by-step reasoning and problem solving",
    author: "Anthropic",
    repository: "https://github.com/modelcontextprotocol/servers",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking@latest"],
    category: "ai",
    tags: ["reasoning", "thinking", "ai"],
  },
  {
    id: "everything",
    name: "Everything",
    description: "Fast file search using Everything search engine (Windows)",
    author: "Community",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything@latest"],
    category: "file-system",
    tags: ["search", "files", "windows"],
  },
];

const MCP_STORAGE_KEY = "mcp.servers";

/**
 * MCP Manager handles all MCP server management
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private configs: MCPServerConfig[] = [];
  private context: vscode.ExtensionContext;
  private onStateChangeCallback?: (state: MCPServerState) => void;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initialize MCP Manager and load saved configurations
   */
  async initialize(): Promise<void> {
    await this.loadConfigs();

    // Auto-connect enabled servers
    for (const config of this.configs) {
      if (config.enabled && config.autoConnect) {
        this.connectServer(config.id).catch((err) => {
          logger.debug(
            `[MCPManager] Auto-connect failed for ${config.name}:`,
            err
          );
        });
      }
    }

    logger.debug(
      `[MCPManager] Initialized with ${this.configs.length} servers`
    );
  }

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: (state: MCPServerState) => void): void {
    this.onStateChangeCallback = callback;
  }

  /**
   * Load server configurations from storage
   */
  private async loadConfigs(): Promise<void> {
    const stored =
      this.context.globalState.get<MCPServerConfig[]>(MCP_STORAGE_KEY);
    this.configs = stored || [];
  }

  /**
   * Save server configurations to storage
   */
  private async saveConfigs(): Promise<void> {
    await this.context.globalState.update(MCP_STORAGE_KEY, this.configs);
  }

  /**
   * Get all server configurations
   */
  getServers(): MCPServerConfig[] {
    return [...this.configs];
  }

  /**
   * Get all server states
   */
  getServerStates(): MCPServerState[] {
    return this.configs.map((config) => {
      const client = this.clients.get(config.id);
      if (client) {
        return client.getState();
      }
      return {
        id: config.id,
        status: "disconnected" as const,
        tools: [],
      };
    });
  }

  /**
   * Get a specific server configuration
   */
  getServer(serverId: string): MCPServerConfig | undefined {
    return this.configs.find((c) => c.id === serverId);
  }

  /**
   * Add a new server configuration
   */
  async addServer(
    server: Omit<MCPServerConfig, "id">
  ): Promise<MCPServerConfig> {
    const newServer: MCPServerConfig = {
      ...server,
      id: `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    this.configs.push(newServer);
    await this.saveConfigs();

    logger.debug(`[MCPManager] Added server: ${newServer.name}`);
    return newServer;
  }

  /**
   * Update a server configuration
   */
  async updateServer(server: MCPServerConfig): Promise<void> {
    const index = this.configs.findIndex((c) => c.id === server.id);
    if (index === -1) {
      throw new Error(`Server ${server.id} not found`);
    }

    // Disconnect if currently connected
    const client = this.clients.get(server.id);
    if (client) {
      client.disconnect();
      this.clients.delete(server.id);
    }

    this.configs[index] = server;
    await this.saveConfigs();

    logger.debug(`[MCPManager] Updated server: ${server.name}`);
  }

  /**
   * Remove a server configuration
   */
  async removeServer(serverId: string): Promise<void> {
    const index = this.configs.findIndex((c) => c.id === serverId);
    if (index === -1) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Disconnect if currently connected
    const client = this.clients.get(serverId);
    if (client) {
      client.disconnect();
      this.clients.delete(serverId);
    }

    const removed = this.configs.splice(index, 1)[0];
    await this.saveConfigs();

    logger.debug(`[MCPManager] Removed server: ${removed.name}`);
  }

  /**
   * Connect to a server
   */
  async connectServer(serverId: string): Promise<void> {
    const config = this.configs.find((c) => c.id === serverId);
    if (!config) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (!config.enabled) {
      throw new Error(`Server ${config.name} is disabled`);
    }

    // Check if already connected
    let client = this.clients.get(serverId);
    if (client && client.status === "connected") {
      return;
    }

    // Create new client
    client = new MCPClient(config, (state) => {
      this.onStateChangeCallback?.(state);
    });

    this.clients.set(serverId, client);

    try {
      await client.connect();
    } catch (error) {
      // Client state already updated via callback
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  disconnectServer(serverId: string): void {
    const client = this.clients.get(serverId);
    if (client) {
      client.disconnect();
      this.clients.delete(serverId);
    }
  }

  /**
   * Get all available tools from connected servers
   */
  getAllTools(): {
    serverId: string;
    serverName: string;
    tool: MCPToolDefinition;
  }[] {
    const tools: {
      serverId: string;
      serverName: string;
      tool: MCPToolDefinition;
    }[] = [];

    for (const [serverId, client] of this.clients) {
      if (client.status === "connected") {
        const config = this.configs.find((c) => c.id === serverId);
        const serverName = config?.name || serverId;

        for (const tool of client.tools) {
          tools.push({
            serverId,
            serverName,
            tool,
          });
        }
      }
    }

    return tools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * Get MCP Market items
   */
  getMarketItems(): MCPMarketItem[] {
    return MCP_MARKET_ITEMS;
  }

  /**
   * Install a server from the market
   */
  async installFromMarket(itemId: string): Promise<MCPServerConfig> {
    const item = MCP_MARKET_ITEMS.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`Market item ${itemId} not found`);
    }

    // Check if already installed
    const existing = this.configs.find(
      (c) =>
        c.command === item.command &&
        JSON.stringify(c.args) === JSON.stringify(item.args)
    );
    if (existing) {
      throw new Error(`${item.name} is already installed`);
    }

    // Process workspace folder placeholder
    const workspaceFolder =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    const processedArgs = item.args?.map((arg) =>
      arg.replace("${workspaceFolder}", workspaceFolder)
    );

    return this.addServer({
      name: item.name,
      description: item.description,
      command: item.command,
      args: processedArgs,
      env: item.env,
      enabled: true,
      autoConnect: false,
    });
  }

  /**
   * Dispose all connections
   */
  dispose(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}
