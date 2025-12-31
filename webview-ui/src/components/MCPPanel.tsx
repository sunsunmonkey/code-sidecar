/**
 * MCP Panel - Configuration and management UI for MCP servers
 */

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  Settings,
  Store,
  ChevronLeft,
  ExternalLink,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Server,
  Wrench,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { useVSCodeApi, useMessageListener } from "../hooks/useVSCodeApi";
import type {
  MCPServerConfig,
  MCPServerState,
  MCPMarketItem,
  MCPConnectionStatus,
  MCPCategory,
} from "code-sidecar-shared/types/mcp";
import type {
  WebviewMessage,
  UserMessage,
} from "code-sidecar-shared/types/messages";

interface MCPPanelProps {
  isActive: boolean;
  onBack: () => void;
}

type MCPView = "servers" | "market" | "add" | "edit";

const CATEGORY_LABELS: Record<MCPCategory, string> = {
  "file-system": "文件系统",
  database: "数据库",
  web: "网络",
  development: "开发工具",
  productivity: "生产力",
  ai: "AI",
  other: "其他",
};

const STATUS_CONFIG: Record<
  MCPConnectionStatus,
  { icon: React.ReactNode; label: string; color: string }
> = {
  disconnected: {
    icon: <PowerOff className="w-3.5 h-3.5" />,
    label: "未连接",
    color: "text-[var(--vscode-disabledForeground)]",
  },
  connecting: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: "连接中",
    color: "text-[var(--vscode-charts-yellow)]",
  },
  connected: {
    icon: <Power className="w-3.5 h-3.5" />,
    label: "已连接",
    color: "text-[var(--vscode-charts-green)]",
  },
  error: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: "错误",
    color: "text-[var(--vscode-errorForeground)]",
  },
};

export const MCPPanel = ({ isActive, onBack }: MCPPanelProps) => {
  const { postMessage } = useVSCodeApi();
  const [view, setView] = useState<MCPView>("servers");
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [serverStates, setServerStates] = useState<Map<string, MCPServerState>>(
    new Map()
  );
  const [marketItems, setMarketItems] = useState<MCPMarketItem[]>([]);
  const [marketSearch, setMarketSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MCPCategory | "all">(
    "all"
  );
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  // Form state for add/edit
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    command: "",
    args: "",
    env: "",
    enabled: true,
    autoConnect: false,
  });

  const handleMessage = useCallback((message: WebviewMessage) => {
    switch (message.type) {
      case "mcp_servers_list":
        setServers(message.servers);
        const stateMap = new Map<string, MCPServerState>();
        message.states.forEach((s) => stateMap.set(s.id, s));
        setServerStates(stateMap);
        setIsLoading(false);
        break;
      case "mcp_server_added":
        setServers((prev) => [...prev, message.server]);
        setView("servers");
        break;
      case "mcp_server_updated":
        setServers((prev) =>
          prev.map((s) => (s.id === message.server.id ? message.server : s))
        );
        setView("servers");
        break;
      case "mcp_server_removed":
        setServers((prev) => prev.filter((s) => s.id !== message.serverId));
        setServerStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(message.serverId);
          return newMap;
        });
        break;
      case "mcp_server_state_changed":
        setServerStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.state.id, message.state);
          return newMap;
        });
        break;
      case "mcp_market_list":
        setMarketItems(message.items);
        break;
      case "mcp_error":
        console.error("MCP Error:", message.message);
        break;
    }
  }, []);

  useMessageListener<WebviewMessage>(handleMessage, [handleMessage]);

  useEffect(() => {
    if (isActive) {
      const msg: UserMessage = { type: "mcp_get_servers" };
      postMessage(msg);
      const marketMsg: UserMessage = { type: "mcp_get_market" };
      postMessage(marketMsg);
    }
  }, [isActive, postMessage]);

  const handleConnect = (serverId: string) => {
    const msg: UserMessage = { type: "mcp_connect_server", serverId };
    postMessage(msg);
  };

  const handleDisconnect = (serverId: string) => {
    const msg: UserMessage = { type: "mcp_disconnect_server", serverId };
    postMessage(msg);
  };

  const handleRemove = (serverId: string) => {
    const msg: UserMessage = { type: "mcp_remove_server", serverId };
    postMessage(msg);
  };

  const handleEdit = (server: MCPServerConfig) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      description: server.description || "",
      command: server.command,
      args: server.args?.join(" ") || "",
      env: server.env
        ? Object.entries(server.env)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n")
        : "",
      enabled: server.enabled,
      autoConnect: server.autoConnect || false,
    });
    setView("edit");
  };

  const handleAddNew = () => {
    setEditingServer(null);
    setFormData({
      name: "",
      description: "",
      command: "",
      args: "",
      env: "",
      enabled: true,
      autoConnect: false,
    });
    setView("add");
  };

  const handleInstallFromMarket = (itemId: string) => {
    const msg: UserMessage = { type: "mcp_install_from_market", itemId };
    postMessage(msg);
  };

  const handleSubmit = () => {
    const args = formData.args.trim()
      ? formData.args.trim().split(/\s+/)
      : undefined;
    const envLines = formData.env.trim().split("\n").filter(Boolean);
    const env =
      envLines.length > 0
        ? Object.fromEntries(
            envLines.map((line) => {
              const [key, ...rest] = line.split("=");
              return [key.trim(), rest.join("=").trim()];
            })
          )
        : undefined;

    if (editingServer) {
      const msg: UserMessage = {
        type: "mcp_update_server",
        server: {
          id: editingServer.id,
          name: formData.name,
          description: formData.description || undefined,
          command: formData.command,
          args,
          env,
          enabled: formData.enabled,
          autoConnect: formData.autoConnect,
        },
      };
      postMessage(msg);
    } else {
      const msg: UserMessage = {
        type: "mcp_add_server",
        server: {
          name: formData.name,
          description: formData.description || undefined,
          command: formData.command,
          args,
          env,
          enabled: formData.enabled,
          autoConnect: formData.autoConnect,
        },
      };
      postMessage(msg);
    }
  };

  const filteredMarketItems = marketItems.filter((item) => {
    const matchesSearch =
      !marketSearch ||
      item.name.toLowerCase().includes(marketSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(marketSearch.toLowerCase()) ||
      item.tags?.some((t) =>
        t.toLowerCase().includes(marketSearch.toLowerCase())
      );
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isActive) {
    return null;
  }

  // 获取当前视图的标题和返回操作
  const getHeaderConfig = () => {
    switch (view) {
      case "market":
        return { title: "MCP 市场", onBack: () => setView("servers") };
      case "add":
        return { title: "添加服务器", onBack: () => setView("servers") };
      case "edit":
        return { title: "编辑服务器", onBack: () => setView("servers") };
      default:
        return { title: "MCP 服务器", onBack };
    }
  };

  const headerConfig = getHeaderConfig();

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-sideBar-background)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--vscode-panel-border)]">
        <Button variant="ghost" size="icon" onClick={headerConfig.onBack}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-medium flex-1">{headerConfig.title}</h2>
        {view === "servers" && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView("market")}
              title="MCP 市场"
            >
              <Store className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddNew}
              title="添加服务器"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "servers" && (
          <ServerList
            servers={servers}
            serverStates={serverStates}
            isLoading={isLoading}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
        )}

        {view === "market" && (
          <MarketView
            items={filteredMarketItems}
            installedIds={servers.map((s) => s.name)}
            search={marketSearch}
            selectedCategory={selectedCategory}
            onSearchChange={setMarketSearch}
            onCategoryChange={setSelectedCategory}
            onInstall={handleInstallFromMarket}
          />
        )}

        {(view === "add" || view === "edit") && (
          <ServerForm
            formData={formData}
            isEdit={view === "edit"}
            onChange={setFormData}
            onSubmit={handleSubmit}
            onCancel={() => setView("servers")}
          />
        )}
      </div>
    </div>
  );
};

// Server List Component
interface ServerListProps {
  servers: MCPServerConfig[];
  serverStates: Map<string, MCPServerState>;
  isLoading: boolean;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onEdit: (server: MCPServerConfig) => void;
  onRemove: (id: string) => void;
}

const ServerList = ({
  servers,
  serverStates,
  isLoading,
  onConnect,
  onDisconnect,
  onEdit,
  onRemove,
}: ServerListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-[var(--vscode-descriptionForeground)]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-sm text-[var(--vscode-descriptionForeground)] gap-2">
        <Server className="w-8 h-8 opacity-50" />
        <p>暂无 MCP 服务器</p>
        <p className="text-xs">点击右上角添加或从市场安装</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {servers.map((server) => {
        const state = serverStates.get(server.id);
        const status = state?.status || "disconnected";
        const statusConfig = STATUS_CONFIG[status];
        const tools = state?.tools || [];

        return (
          <div
            key={server.id}
            className="rounded-lg bg-[var(--vscode-editor-background)] p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {server.name}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs ${statusConfig.color}`}
                  >
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>
                {server.description && (
                  <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-0.5 truncate">
                    {server.description}
                  </p>
                )}
                {status === "connected" && tools.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
                    <Wrench className="w-3 h-3" />
                    <span>{tools.length} 个工具可用</span>
                  </div>
                )}
                {status === "error" && state?.error && (
                  <p className="text-xs text-[var(--vscode-errorForeground)] mt-1">
                    {state.error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {status === "connected" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDisconnect(server.id)}
                    title="断开连接"
                  >
                    <PowerOff className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onConnect(server.id)}
                    disabled={!server.enabled || status === "connecting"}
                    title="连接"
                  >
                    {status === "connecting" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(server)}
                  title="设置"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(server.id)}
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Market View Component
interface MarketViewProps {
  items: MCPMarketItem[];
  installedIds: string[];
  search: string;
  selectedCategory: MCPCategory | "all";
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: MCPCategory | "all") => void;
  onInstall: (id: string) => void;
}

const MarketView = ({
  items,
  installedIds,
  search,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onInstall,
}: MarketViewProps) => {
  const categories: (MCPCategory | "all")[] = [
    "all",
    "file-system",
    "database",
    "web",
    "development",
    "productivity",
    "ai",
    "other",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-[var(--vscode-panel-border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--vscode-descriptionForeground)]" />
          <Input
            placeholder="搜索 MCP 服务器..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-[var(--vscode-panel-border)]">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "ghost"}
            size="sm"
            onClick={() => onCategoryChange(cat)}
            className="whitespace-nowrap text-xs"
          >
            {cat === "all" ? "全部" : CATEGORY_LABELS[cat]}
          </Button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--vscode-descriptionForeground)]">
            没有找到匹配的服务器
          </div>
        ) : (
          items.map((item) => {
            const isInstalled = installedIds.includes(item.name);
            return (
              <div
                key={item.id}
                className="rounded-lg bg-[var(--vscode-editor-background)] p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.name}</span>
                      {item.featured && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-0.5">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--vscode-descriptionForeground)]">
                      <span>{item.author}</span>
                      <span>·</span>
                      <span>{CATEGORY_LABELS[item.category]}</span>
                      {item.repository && (
                        <>
                          <span>·</span>
                          <a
                            href={item.repository}
                            className="flex items-center gap-0.5 text-[var(--vscode-textLink-foreground)] hover:underline"
                          >
                            GitHub
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant={isInstalled ? "secondary" : "default"}
                    size="sm"
                    disabled={isInstalled}
                    onClick={() => onInstall(item.id)}
                  >
                    {isInstalled ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        已安装
                      </>
                    ) : (
                      "安装"
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Server Form Component
interface ServerFormProps {
  formData: {
    name: string;
    description: string;
    command: string;
    args: string;
    env: string;
    enabled: boolean;
    autoConnect: boolean;
  };
  isEdit: boolean;
  onChange: (data: ServerFormProps["formData"]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const ServerForm = ({
  formData,
  isEdit,
  onChange,
  onSubmit,
  onCancel,
}: ServerFormProps) => {
  const isValid = formData.name.trim() && formData.command.trim();

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium text-sm">
        {isEdit ? "编辑服务器" : "添加服务器"}
      </h3>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">名称 *</label>
          <Input
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="My MCP Server"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">描述</label>
          <Input
            value={formData.description}
            onChange={(e) =>
              onChange({ ...formData, description: e.target.value })
            }
            placeholder="可选描述"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">命令 *</label>
          <Input
            value={formData.command}
            onChange={(e) => onChange({ ...formData, command: e.target.value })}
            placeholder="npx"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">参数</label>
          <Input
            value={formData.args}
            onChange={(e) => onChange({ ...formData, args: e.target.value })}
            placeholder="-y @modelcontextprotocol/server-filesystem ."
          />
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
            以空格分隔的参数列表
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">环境变量</label>
          <textarea
            value={formData.env}
            onChange={(e) => onChange({ ...formData, env: e.target.value })}
            placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
            className="w-full h-20 px-2 py-1.5 text-[13px] rounded-sm resize-none
              text-[var(--vscode-input-foreground)] bg-[var(--vscode-input-background)]
              border border-[var(--vscode-input-border,var(--vscode-panel-border))]
              outline-none focus:border-[var(--vscode-focusBorder)]
              placeholder:text-[var(--vscode-input-placeholderForeground)] placeholder:opacity-70"
          />
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
            每行一个，格式: KEY=value
          </p>
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <label className="text-xs font-medium">启用</label>
            <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
              禁用后服务器将不可连接
            </p>
          </div>
          <Switch
            checked={formData.enabled}
            onCheckedChange={(checked) =>
              onChange({ ...formData, enabled: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <label className="text-xs font-medium">自动连接</label>
            <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
              扩展启动时自动连接
            </p>
          </div>
          <Switch
            checked={formData.autoConnect}
            onCheckedChange={(checked) =>
              onChange({ ...formData, autoConnect: checked })
            }
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button onClick={onSubmit} disabled={!isValid} className="flex-1">
          {isEdit ? "保存" : "添加"}
        </Button>
      </div>
    </div>
  );
};
