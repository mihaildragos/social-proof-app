"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface SSEMessage {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

export interface SSEOptions {
  url: string;
  withCredentials?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOpen?: () => void;
  onMessage?: (message: SSEMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

export interface SSEState {
  eventSource: EventSource | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: SSEMessage | null;
  connectionAttempts: number;
}

export function useSSE(options: SSEOptions) {
  const {
    url,
    withCredentials = false,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    onOpen,
    onMessage,
    onError,
    onClose,
  } = options;

  const [state, setState] = useState<SSEState>({
    eventSource: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    connectionAttempts: 0,
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
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
      const eventSource = new EventSource(url, {
        withCredentials,
      });

      eventSource.onopen = () => {
        setState((prev) => ({
          ...prev,
          eventSource,
          isConnected: true,
          isConnecting: false,
          error: null,
          connectionAttempts: 0,
        }));

        onOpen?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = {
            type: event.type || "message",
            data: event.data ? JSON.parse(event.data) : null,
            id: event.lastEventId,
          };

          setState((prev) => ({
            ...prev,
            lastMessage: message,
          }));

          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
          const message: SSEMessage = {
            type: event.type || "message",
            data: event.data,
            id: event.lastEventId,
          };

          setState((prev) => ({
            ...prev,
            lastMessage: message,
          }));

          onMessage?.(message);
        }
      };

      eventSource.onerror = (event) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        onError?.(event);

        // Attempt reconnection
        if (shouldReconnectRef.current && eventSource.readyState === EventSource.CLOSED) {
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

      // Add custom event listeners for different message types
      const handleCustomEvent = (eventType: string) => (event: MessageEvent) => {
        try {
          const message: SSEMessage = {
            type: eventType,
            data: event.data ? JSON.parse(event.data) : null,
            id: event.lastEventId,
          };

          setState((prev) => ({
            ...prev,
            lastMessage: message,
          }));

          onMessage?.(message);
        } catch (error) {
          console.error(`Failed to parse SSE ${eventType} message:`, error);
        }
      };

      // Common event types for social proof notifications
      eventSource.addEventListener("notification", handleCustomEvent("notification"));
      eventSource.addEventListener("analytics", handleCustomEvent("analytics"));
      eventSource.addEventListener("status", handleCustomEvent("status"));
      eventSource.addEventListener("heartbeat", handleCustomEvent("heartbeat"));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to create SSE connection",
        isConnecting: false,
      }));
    }
  }, [url, withCredentials, reconnectAttempts, reconnectInterval, onOpen, onMessage, onError]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (state.eventSource) {
      state.eventSource.close();
    }

    setState((prev) => ({
      ...prev,
      eventSource: null,
      isConnected: false,
      isConnecting: false,
    }));

    onClose?.();
  }, [state.eventSource, onClose]);

  const reconnect = useCallback(() => {
    disconnect();
    shouldReconnectRef.current = true;
    setState((prev) => ({ ...prev, connectionAttempts: 0 }));
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // Subscribe to specific event types
  const subscribe = useCallback(
    (eventType: string, handler: (data: any) => void) => {
      if (state.eventSource) {
        const eventHandler = (event: MessageEvent) => {
          try {
            const data = event.data ? JSON.parse(event.data) : null;
            handler(data);
          } catch (error) {
            console.error(`Failed to parse ${eventType} event:`, error);
            handler(event.data);
          }
        };

        state.eventSource.addEventListener(eventType, eventHandler);

        // Return unsubscribe function
        return () => {
          if (state.eventSource) {
            state.eventSource.removeEventListener(eventType, eventHandler);
          }
        };
      }

      return () => {};
    },
    [state.eventSource]
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (state.eventSource) {
        state.eventSource.close();
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    subscribe,
  };
}
