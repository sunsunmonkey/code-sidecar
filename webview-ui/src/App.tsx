import { useState } from "react";
import { ChatPage } from "./pages/ChatPage";
import { ConfigPage } from "./pages/ConfigPage";

type Tab = "chat" | "config";

/**
 * Main App component for the AI Coding Assistant webview
 */
function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <>
      <ChatPage isActive={tab === "chat"} onOpenConfig={() => setTab("config")} />
      <ConfigPage isActive={tab === "config"} onBack={() => setTab("chat")} />
    </>
  );
}

export default App;
