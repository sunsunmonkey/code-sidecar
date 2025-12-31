import { useState } from "react";
import { ChatPage } from "./pages/ChatPage";
import { ConfigPage } from "./pages/ConfigPage";
import { MCPPanel } from "./components/MCPPanel";

type Tab = "chat" | "config" | "mcp";

/**
 * Main App component for the AI Coding Assistant webview
 */
function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <>
      <ChatPage
        isActive={tab === "chat"}
        onOpenConfig={() => setTab("config")}
        onOpenMCP={() => setTab("mcp")}
      />
      <ConfigPage isActive={tab === "config"} onBack={() => setTab("chat")} />
      <MCPPanel isActive={tab === "mcp"} onBack={() => setTab("chat")} />
    </>
  );
}

export default App;
