/**
 * MCP (Model Context Protocol) type definitions
 */

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  autoConnect?: boolean;
}

/**
 * MCP Tool definition from server
 */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, MCPToolPropertySchema>;
    required?: string[];
  };
}

export interface MCPToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

/**
 * MCP Server connection status
 */
export type MCPConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * MCP Server runtime state
 */
export interface MCPServerState {
  id: string;
  status: MCPConnectionStatus;
  tools: MCPToolDefinition[];
  error?: string;
  lastConnected?: number;
}

/**
 * MCP Market item
 */
export interface MCPMarketItem {
  id: string;
  name: string;
  description: string;
  author: string;
  repository?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  category: MCPCategory;
  tags?: string[];
  featured?: boolean;
}

export type MCPCategory =
  | "file-system"
  | "database"
  | "web"
  | "development"
  | "productivity"
  | "ai"
  | "other";

/**
 * MCP configuration stored in extension
 */
export interface MCPConfiguration {
  servers: MCPServerConfig[];
}

/**
 * MCP Tool call request
 */
export interface MCPToolCall {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
  serverId: string;
  toolName: string;
  content: unknown;
  isError: boolean;
  error?: string;
}

/**
 * MCP Messages for webview communication
 */
export type MCPMessage =
  | { type: "mcp_get_servers" }
  | { type: "mcp_add_server"; server: Omit<MCPServerConfig, "id"> }
  | { type: "mcp_update_server"; server: MCPServerConfig }
  | { type: "mcp_remove_server"; serverId: string }
  | { type: "mcp_connect_server"; serverId: string }
  | { type: "mcp_disconnect_server"; serverId: string }
  | { type: "mcp_get_market" }
  | { type: "mcp_install_from_market"; itemId: string };

export type MCPResponse =
  | {
      type: "mcp_servers_list";
      servers: MCPServerConfig[];
      states: MCPServerState[];
    }
  | { type: "mcp_server_added"; server: MCPServerConfig }
  | { type: "mcp_server_updated"; server: MCPServerConfig }
  | { type: "mcp_server_removed"; serverId: string }
  | { type: "mcp_server_state_changed"; state: MCPServerState }
  | { type: "mcp_market_list"; items: MCPMarketItem[] }
  | { type: "mcp_error"; message: string };
