/**
 * Custom hook for VSCode API communication
 * Encapsulates message sending and receiving between webview and extension
 * Requirements: 4.1
 */

import { useEffect, useCallback, useRef } from 'react';

// VSCode API type
interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

// Declare the acquireVsCodeApi function
declare function acquireVsCodeApi(): VSCodeAPI;

/**
 * Hook for accessing VSCode API
 * Provides a stable reference to the VSCode API and message handling utilities
 * 
 * @returns Object containing vscode API and helper functions
 */
export function useVSCodeApi() {
  // Store VSCode API in a ref to ensure it's only acquired once
  const vsCodeApiRef = useRef<VSCodeAPI | null>(null);

  // Acquire VSCode API on first render
  if (!vsCodeApiRef.current) {
    vsCodeApiRef.current = acquireVsCodeApi();
  }

  /**
   * Send a message to the extension
   * @param message - The message to send
   */
  const postMessage = useCallback((message: any) => {
    vsCodeApiRef.current?.postMessage(message);
  }, []);

  /**
   * Get the persisted state
   * @returns The persisted state
   */
  const getState = useCallback(() => {
    return vsCodeApiRef.current?.getState();
  }, []);

  /**
   * Set the persisted state
   * @param state - The state to persist
   */
  const setState = useCallback((state: any) => {
    vsCodeApiRef.current?.setState(state);
  }, []);

  return {
    vscode: vsCodeApiRef.current,
    postMessage,
    getState,
    setState,
  };
}

/**
 * Hook for listening to messages from the extension
 * 
 * @param handler - Callback function to handle incoming messages
 * @param dependencies - Dependencies array for the handler callback
 */
export function useMessageListener<T = any>(
  handler: (message: T) => void,
  dependencies: React.DependencyList = []
) {
  const handlerRef = useRef(handler);

  // Update handler ref when dependencies change
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler, ...dependencies]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent<T>) => {
      handlerRef.current(event.data);
    };

    window.addEventListener('message', messageHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);
}

/**
 * Combined hook that provides both VSCode API and message listening
 * 
 * @param messageHandler - Optional callback function to handle incoming messages
 * @returns Object containing vscode API and helper functions
 */
export function useVSCodeApiWithListener<T = any>(
  messageHandler?: (message: T) => void
) {
  const api = useVSCodeApi();

  useMessageListener(messageHandler || (() => {}), [messageHandler]);

  return api;
}
