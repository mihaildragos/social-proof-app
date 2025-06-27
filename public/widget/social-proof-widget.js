/**
 * Social Proof Widget - Embeddable Notification System
 * Version: 1.0.0
 *
 * This widget provides real-time social proof notifications for websites.
 * It can be embedded on any website to show live activity and boost conversions.
 */

(function (window, document) {
  "use strict";

  // Prevent multiple initializations
  if (window.SocialProofWidget) {
    return;
  }

  // Widget configuration defaults
  const DEFAULT_CONFIG = {
    apiKey: null,
    siteId: null,
    apiUrl: "https://api.pulsesocialproof.app",
    websocketUrl: "wss://ws.pulsesocialproof.app",
    position: "bottom-right",
    maxNotifications: 3,
    displayDuration: 5000,
    animationDuration: 300,
    showCloseButton: true,
    enableSound: false,
    theme: "light",
    customStyles: {},
    debug: false,
    retryAttempts: 3,
    retryDelay: 2000,
    heartbeatInterval: 30000,
  };

  // Widget state
  let config = {};
  let notifications = [];
  let websocket = null;
  let eventSource = null;
  let isConnected = false;
  let retryCount = 0;
  let heartbeatTimer = null;
  let container = null;

  /**
   * Main Widget Class
   */
  class SocialProofWidget {
    constructor(userConfig = {}) {
      this.init(userConfig);
    }

    /**
     * Initialize the widget
     */
    init(userConfig) {
      config = { ...DEFAULT_CONFIG, ...userConfig };

      if (!config.apiKey || !config.siteId) {
        this.log("Error: apiKey and siteId are required");
        return;
      }

      this.log("Initializing Social Proof Widget", config);

      // Load external dependencies
      this.loadDependencies()
        .then(() => {
          this.createContainer();
          this.loadStyles();
          this.connectToServer();
          this.bindEvents();
        })
        .catch((error) => {
          this.log("Failed to initialize widget:", error);
        });
    }

    /**
     * Load external dependencies
     */
    loadDependencies() {
      return Promise.all([
        this.loadScript("/widget/config.js"),
        this.loadScript("/widget/analytics.js"),
        this.loadStylesheet("/widget/styles.css"),
      ]);
    }

    /**
     * Load external script
     */
    loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    /**
     * Load external stylesheet
     */
    loadStylesheet(href) {
      return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
      });
    }

    /**
     * Create widget container
     */
    createContainer() {
      container = document.createElement("div");
      container.id = "social-proof-widget";
      container.className = `sp-widget sp-position-${config.position} sp-theme-${config.theme}`;

      // Apply custom styles
      if (config.customStyles) {
        Object.assign(container.style, config.customStyles);
      }

      document.body.appendChild(container);
    }

    /**
     * Load widget styles
     */
    loadStyles() {
      if (!document.getElementById("sp-widget-styles")) {
        const style = document.createElement("style");
        style.id = "sp-widget-styles";
        style.textContent = this.getDefaultStyles();
        document.head.appendChild(style);
      }
    }

    /**
     * Get default widget styles
     */
    getDefaultStyles() {
      return `
        .sp-widget {
          position: fixed;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: none;
        }
        
        .sp-position-top-left { top: 20px; left: 20px; }
        .sp-position-top-right { top: 20px; right: 20px; }
        .sp-position-bottom-left { bottom: 20px; left: 20px; }
        .sp-position-bottom-right { bottom: 20px; right: 20px; }
        .sp-position-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
        
        .sp-notification {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-bottom: 10px;
          max-width: 350px;
          opacity: 0;
          pointer-events: auto;
          transform: translateX(100%);
          transition: all ${DEFAULT_CONFIG.animationDuration}ms ease-out;
        }
        
        .sp-notification.sp-show {
          opacity: 1;
          transform: translateX(0);
        }
        
        .sp-notification-content {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .sp-notification-icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }
        
        .sp-notification-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.4;
          color: #333;
        }
        
        .sp-notification-close {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          color: #999;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .sp-notification-close:hover {
          color: #666;
        }
        
        .sp-theme-dark .sp-notification {
          background: #2d3748;
          color: white;
        }
        
        .sp-theme-dark .sp-notification-text {
          color: #e2e8f0;
        }
        
        @media (max-width: 480px) {
          .sp-widget {
            left: 10px !important;
            right: 10px !important;
            width: auto !important;
          }
          
          .sp-notification {
            max-width: none;
          }
        }
      `;
    }

    /**
     * Connect to notification server
     */
    connectToServer() {
      this.connectWebSocket();

      // Fallback to SSE if WebSocket fails
      setTimeout(() => {
        if (!isConnected) {
          this.connectSSE();
        }
      }, 3000);
    }

    /**
     * Connect via WebSocket
     */
    connectWebSocket() {
      try {
        const wsUrl = `${config.websocketUrl}/notifications/${config.siteId}?apiKey=${config.apiKey}`;
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          this.log("WebSocket connected");
          isConnected = true;
          retryCount = 0;
          this.startHeartbeat();
          this.trackEvent("widget_connected", { method: "websocket" });
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            this.log("Failed to parse WebSocket message:", error);
          }
        };

        websocket.onclose = () => {
          this.log("WebSocket disconnected");
          isConnected = false;
          this.stopHeartbeat();
          this.handleReconnection();
        };

        websocket.onerror = (error) => {
          this.log("WebSocket error:", error);
          this.trackEvent("widget_error", { method: "websocket", error: error.message });
        };
      } catch (error) {
        this.log("Failed to create WebSocket connection:", error);
        this.connectSSE();
      }
    }

    /**
     * Connect via Server-Sent Events
     */
    connectSSE() {
      try {
        const sseUrl = `${config.apiUrl}/sse/notifications/${config.siteId}?apiKey=${config.apiKey}`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          this.log("SSE connected");
          isConnected = true;
          retryCount = 0;
          this.trackEvent("widget_connected", { method: "sse" });
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            this.log("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          this.log("SSE error");
          isConnected = false;
          this.handleReconnection();
        };
      } catch (error) {
        this.log("Failed to create SSE connection:", error);
      }
    }

    /**
     * Handle incoming messages
     */
    handleMessage(data) {
      if (data.type === "notification") {
        this.showNotification(data.payload);
      } else if (data.type === "pong") {
        // Heartbeat response
        this.log("Heartbeat received");
      }
    }

    /**
     * Show notification
     */
    showNotification(notificationData) {
      if (notifications.length >= config.maxNotifications) {
        this.removeOldestNotification();
      }

      const notification = this.createNotificationElement(notificationData);
      notifications.push(notification);
      container.appendChild(notification);

      // Animate in
      setTimeout(() => {
        notification.classList.add("sp-show");
      }, 10);

      // Auto-remove after duration
      setTimeout(() => {
        this.removeNotification(notification);
      }, config.displayDuration);

      // Play sound if enabled
      if (config.enableSound) {
        this.playNotificationSound();
      }

      // Track notification display
      this.trackEvent("notification_shown", {
        notificationId: notificationData.id,
        type: notificationData.type,
      });
    }

    /**
     * Create notification DOM element
     */
    createNotificationElement(data) {
      const notification = document.createElement("div");
      notification.className = "sp-notification";
      notification.dataset.id = data.id;

      const content = document.createElement("div");
      content.className = "sp-notification-content";

      // Icon
      if (data.icon) {
        const icon = document.createElement("div");
        icon.className = "sp-notification-icon";
        icon.innerHTML = this.getIcon(data.type);
        content.appendChild(icon);
      }

      // Text content
      const text = document.createElement("div");
      text.className = "sp-notification-text";
      text.innerHTML = this.formatMessage(data.message, data.metadata);
      content.appendChild(text);

      // Close button
      if (config.showCloseButton) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "sp-notification-close";
        closeBtn.innerHTML = "×";
        closeBtn.onclick = () => {
          this.removeNotification(notification);
          this.trackEvent("notification_closed", { notificationId: data.id });
        };
        content.appendChild(closeBtn);
      }

      notification.appendChild(content);

      // Click handler
      notification.onclick = (e) => {
        if (e.target !== closeBtn) {
          this.handleNotificationClick(data);
        }
      };

      return notification;
    }

    /**
     * Get icon for notification type
     */
    getIcon(type) {
      const icons = {
        purchase: "🛒",
        signup: "👤",
        review: "⭐",
        visitor_count: "👥",
        custom: "🔔",
      };
      return icons[type] || icons.custom;
    }

    /**
     * Format notification message
     */
    formatMessage(message, metadata = {}) {
      return message
        .replace(/\{customer\}/g, metadata.customer || "Someone")
        .replace(/\{product\}/g, metadata.product || "a product")
        .replace(/\{location\}/g, metadata.location || "somewhere")
        .replace(/\{count\}/g, metadata.count || "0")
        .replace(/\{rating\}/g, "⭐".repeat(metadata.rating || 5));
    }

    /**
     * Handle notification click
     */
    handleNotificationClick(data) {
      if (data.cta && data.cta.url) {
        window.open(data.cta.url, "_blank", "noopener,noreferrer");
      }

      this.trackEvent("notification_clicked", {
        notificationId: data.id,
        type: data.type,
        url: data.cta?.url,
      });
    }

    /**
     * Remove notification
     */
    removeNotification(notification) {
      notification.classList.remove("sp-show");

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }

        const index = notifications.indexOf(notification);
        if (index > -1) {
          notifications.splice(index, 1);
        }
      }, config.animationDuration);
    }

    /**
     * Remove oldest notification
     */
    removeOldestNotification() {
      if (notifications.length > 0) {
        this.removeNotification(notifications[0]);
      }
    }

    /**
     * Play notification sound
     */
    playNotificationSound() {
      try {
        const audio = new Audio(
          "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
        );
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore audio play errors
        });
      } catch (error) {
        this.log("Failed to play notification sound:", error);
      }
    }

    /**
     * Start heartbeat
     */
    startHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }

      heartbeatTimer = setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(
            JSON.stringify({
              type: "ping",
              timestamp: Date.now(),
            })
          );
        }
      }, config.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    /**
     * Handle reconnection
     */
    handleReconnection() {
      if (retryCount < config.retryAttempts) {
        retryCount++;
        this.log(`Attempting reconnection ${retryCount}/${config.retryAttempts}`);

        setTimeout(() => {
          this.connectToServer();
        }, config.retryDelay * retryCount);
      } else {
        this.log("Max retry attempts reached");
        this.trackEvent("widget_disconnected", { reason: "max_retries" });
      }
    }

    /**
     * Bind events
     */
    bindEvents() {
      // Page visibility change
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.trackEvent("page_hidden");
        } else {
          this.trackEvent("page_visible");
          // Reconnect if needed
          if (!isConnected) {
            this.connectToServer();
          }
        }
      });

      // Window beforeunload
      window.addEventListener("beforeunload", () => {
        this.trackEvent("page_unload");
        this.disconnect();
      });
    }

    /**
     * Track analytics event
     */
    trackEvent(eventName, data = {}) {
      if (window.SocialProofAnalytics) {
        window.SocialProofAnalytics.track(eventName, {
          ...data,
          siteId: config.siteId,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
      isConnected = false;
      this.stopHeartbeat();

      if (websocket) {
        websocket.close();
        websocket = null;
      }

      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      config = { ...config, ...newConfig };

      if (container) {
        container.className = `sp-widget sp-position-${config.position} sp-theme-${config.theme}`;

        if (config.customStyles) {
          Object.assign(container.style, config.customStyles);
        }
      }
    }

    /**
     * Show/hide widget
     */
    setVisible(visible) {
      if (container) {
        container.style.display = visible ? "block" : "none";
      }
    }

    /**
     * Get current status
     */
    getStatus() {
      return {
        connected: isConnected,
        notificationCount: notifications.length,
        retryCount: retryCount,
        config: config,
      };
    }

    /**
     * Log debug messages
     */
    log(...args) {
      if (config.debug) {
        console.log("[SocialProofWidget]", ...args);
      }
    }

    /**
     * Destroy widget
     */
    destroy() {
      this.disconnect();

      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }

      const styles = document.getElementById("sp-widget-styles");
      if (styles && styles.parentNode) {
        styles.parentNode.removeChild(styles);
      }

      notifications = [];
      container = null;
    }
  }

  // Auto-initialize if config is provided
  if (window.socialProofConfig) {
    window.SocialProofWidget = new SocialProofWidget(window.socialProofConfig);
  } else {
    // Expose constructor for manual initialization
    window.SocialProofWidget = SocialProofWidget;
  }
})(window, document);
