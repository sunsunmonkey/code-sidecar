import { useRef, useState } from "react";
import { useEvent } from "react-use";
import "./App.css";
import { MarkdownHooks } from "react-markdown";
const vscode = acquireVsCodeApi();

function App() {
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEvent("message", (e: MessageEvent) => {
    setMessage(message + e.data);
  });

  const postMessage = async () => {
    vscode.postMessage(input.current?.value);
  };

  return (
    <>
      <MarkdownHooks>{message}</MarkdownHooks>
      <div className="card">
        <input ref={input}></input>
        <button onClick={postMessage}>postMessage</button>
      </div>
    </>
  );
}

export default App;
