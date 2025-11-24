import { useState } from "react";
import { useEvent } from "react-use";
import "./App.css";
const vscode = acquireVsCodeApi();

function App() {
  const [message, setMessage] = useState("");
  useEvent("message", (e: MessageEvent) => {
    console.log(e.data);
    setMessage(e.data);
  });

  const postMessage = async () => {
    vscode.postMessage("Hello World");
  };

  return (
    <>
      <p>{message}111</p>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={postMessage}>postMessage</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
