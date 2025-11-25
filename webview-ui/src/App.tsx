import { useRef, useState } from "react";
import { useEvent } from "react-use";
import "./App.css";
const vscode = acquireVsCodeApi();

function App() {
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEvent("message", (e: MessageEvent) => {
    console.log(e.data);
    setMessage(e.data);
  });

  const postMessage = async () => {
    vscode.postMessage(input.current?.value);
  };

  return (
    <>
      <p>{message}</p>
      <div className="card">
        <input ref={input}></input>
        <button onClick={postMessage}>postMessage</button>
      </div>
    </>
  );
}

export default App;
