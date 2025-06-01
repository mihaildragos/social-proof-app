"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  id?: string;
}

export interface WebSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

export interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  connectionAttempts: number;
}

export function useWebSocket(options: WebSocketOptions) {
  const {
    url,
    protocols,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    socket: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    connectionAttempts: 0,
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    if (state.isConnecting || state.isConnected) {
      return;
    }

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    try {
      const socket = new WebSocket(url, protocols);

      socket.onopen = (event) => {
        setState((prev) => ({
          ...prev,
          socket,
          isConnected: true,
          isConnecting: false,
          error: null,
          connectionAttempts: 0,
        }));

        // Start heartbeat
        if (heartbeatInterval > 0) {
          heartbeatTimeoutRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
            }
          }, heartbeatInterval);
        }

        onOpen?.(event);
      };

      socket.onclose = (event) => {
        setState((prev) => ({
          ...prev,
          socket: null,
          isConnected: false,
          isConnecting: false,
        }));

        // Clear heartbeat
        if (heartbeatTimeoutRef.current) {
          clearInterval(heartbeatTimeoutRef.current);
        }

        onClose?.(event);

        // Attempt reconnection if not manually closed
        if (shouldReconnectRef.current && event.code !== 1000) {
          setState((prev) => {
            const newAttempts = prev.connectionAttempts + 1;
            if (newAttempts <= reconnectAttempts) {
              reconnectTimeoutRef.current = setTimeout(() => {
                connect();
              }, reconnectInterval);
            } else {
              setState((prevState) => ({
                ...prevState,
                error: `Failed to reconnect after ${reconnectAttempts} attempts`,
              }));
            }
            return {
              ...prev,
              connectionAttempts: newAttempts,
            };
          });
        }
      };

      socket.onerror = (event) => {
        setState((prev) => ({
          ...prev,
          error: "WebSocket connection error",
          isConnecting: false,
        }));

        onError?.(event);
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle pong responses
          if (message.type === "pong") {
            return;
          }

          setState((prev) => ({
            ...prev,
            lastMessage: message,
          }));

          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to create WebSocket connection",
        isConnecting: false,
      }));
    }
  }, [
    url,
    protocols,
    reconnectAttempts,
    reconnectInterval,
    heartbeatInterval,
    onOpen,
    onClose,
    onError,
    onMessage,
  ]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    if (state.socket) {
      state.socket.close(1000, "Manual disconnect");
    }

    setState((prev) => ({
      ...prev,
      socket: null,
      isConnected: false,
      isConnecting: false,
    }));
  }, [state.socket]);

  const sendMessage = useCallback(
    (message: Omit<WebSocketMessage, "timestamp">) => {
      if (state.socket && state.isConnected) {
        const fullMessage: WebSocketMessage = {
          ...message,
          timestamp: Date.now(),
        };
        state.socket.send(JSON.stringify(fullMessage));
        return true;
      }
      return false;
    },
    [state.socket, state.isConnected]
  );

  const reconnect = useCallback(() => {
    disconnect();
    shouldReconnectRef.current = true;
    setState((prev) => ({ ...prev, connectionAttempts: 0 }));
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearInterval(heartbeatTimeoutRef.current);
      }
      if (state.socket) {
        state.socket.close();
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    sendMessage,
  };
}
