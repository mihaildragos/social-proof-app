/**
 * Social Proof Widget Configuration System
 * Version: 1.0.0
 *
 * This module provides configuration management and validation for the widget.
 */

(function (window) {
  "use strict";

  // Configuration schema and validation
  const CONFIG_SCHEMA = {
    apiKey: {
      type: "string",
      required: true,
      validate: (value) => typeof value === "string" && value.length > 0,
    },
    siteId: {
      type: "string",
      required: true,
      validate: (value) => typeof value === "string" && value.length > 0,
    },
    apiUrl: {
      type: "string",
      required: false,
      default: "https://api.socialproof.app",
      validate: (value) => /^https?:\/\/.+/.test(value),
    },
    websocketUrl: {
      type: "string",
      required: false,
      default: "wss://ws.socialproof.app",
      validate: (value) => /^wss?:\/\/.+/.test(value),
    },
    position: {
      type: "string",
      required: false,
      default: "bottom-right",
      options: ["top-left", "top-right", "bottom-left", "bottom-right", "center"],
      validate: (value) =>
        ["top-left", "top-right", "bottom-left", "bottom-right", "center"].includes(value),
    },
    maxNotifications: {
      type: "number",
      required: false,
      default: 3,
      min: 1,
      max: 10,
      validate: (value) => Number.isInteger(value) && value >= 1 && value <= 10,
    },
    displayDuration: {
      type: "number",
      required: false,
      default: 5000,
      min: 1000,
      max: 30000,
      validate: (value) => Number.isInteger(value) && value >= 1000 && value <= 30000,
    },
    animationDuration: {
      type: "number",
      required: false,
      default: 300,
      min: 100,
      max: 1000,
      validate: (value) => Number.isInteger(value) && value >= 100 && value <= 1000,
    },
    showCloseButton: {
      type: "boolean",
      required: false,
      default: true,
      validate: (value) => typeof value === "boolean",
    },
    enableSound: {
      type: "boolean",
      required: false,
      default: false,
      validate: (value) => typeof value === "boolean",
    },
    theme: {
      type: "string",
      required: false,
      default: "light",
      options: ["light", "dark", "custom"],
      validate: (value) => ["light", "dark", "custom"].includes(value),
    },
    customStyles: {
      type: "object",
      required: false,
      default: {},
      validate: (value) => typeof value === "object" && value !== null,
    },
    debug: {
      type: "boolean",
      required: false,
      default: false,
      validate: (value) => typeof value === "boolean",
    },
    retryAttempts: {
      type: "number",
      required: false,
      default: 3,
      min: 1,
      max: 10,
      validate: (value) => Number.isInteger(value) && value >= 1 && value <= 10,
    },
    retryDelay: {
      type: "number",
      required: false,
      default: 2000,
      min: 1000,
      max: 10000,
      validate: (value) => Number.isInteger(value) && value >= 1000 && value <= 10000,
    },
    heartbeatInterval: {
      type: "number",
      required: false,
      default: 30000,
      min: 10000,
      max: 120000,
      validate: (value) => Number.isInteger(value) && value >= 10000 && value <= 120000,
    },
    // Advanced configuration options
    filters: {
      type: "object",
      required: false,
      default: {},
      validate: (value) => typeof value === "object" && value !== null,
    },
    targeting: {
      type: "object",
      required: false,
      default: {},
      validate: (value) => typeof value === "object" && value !== null,
    },
    customEvents: {
      type: "object",
      required: false,
      default: {},
      validate: (value) => typeof value === "object" && value !== null,
    },
  };

  // Predefined configuration templates
  const CONFIG_TEMPLATES = {
    minimal: {
      position: "bottom-right",
      maxNotifications: 1,
      displayDuration: 3000,
      showCloseButton: false,
      theme: "light",
    },
    standard: {
      position: "bottom-right",
      maxNotifications: 3,
      displayDuration: 5000,
      showCloseButton: true,
      theme: "light",
      enableSound: false,
    },
    aggressive: {
      position: "bottom-right",
      maxNotifications: 5,
      displayDuration: 8000,
      showCloseButton: true,
      theme: "light",
      enableSound: true,
    },
    mobile: {
      position: "bottom-right",
      maxNotifications: 2,
      displayDuration: 4000,
      showCloseButton: true,
      theme: "light",
      customStyles: {
        fontSize: "12px",
        maxWidth: "280px",
      },
    },
    ecommerce: {
      position: "bottom-left",
      maxNotifications: 3,
      displayDuration: 6000,
      showCloseButton: true,
      theme: "light",
      filters: {
        types: ["purchase", "review"],
        minAmount: 10,
      },
    },
    saas: {
      position: "top-right",
      maxNotifications: 2,
      displayDuration: 4000,
      showCloseButton: true,
      theme: "light",
      filters: {
        types: ["signup", "conversion"],
      },
    },
  };

  /**
   * Configuration Manager Class
   */
  class SocialProofConfig {
    constructor() {
      this.config = {};
      this.errors = [];
      this.warnings = [];
    }

    /**
     * Validate configuration against schema
     */
    validate(config) {
      this.errors = [];
      this.warnings = [];
      const validatedConfig = {};

      // Check required fields
      for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
        if (schema.required && !(key in config)) {
          this.errors.push(`Required field '${key}' is missing`);
          continue;
        }

        const value = config[key];

        // Use default if not provided
        if (value === undefined || value === null) {
          if (schema.default !== undefined) {
            validatedConfig[key] = schema.default;
          }
          continue;
        }

        // Type validation
        if (schema.type === "string" && typeof value !== "string") {
          this.errors.push(`Field '${key}' must be a string`);
          continue;
        }

        if (schema.type === "number" && typeof value !== "number") {
          this.errors.push(`Field '${key}' must be a number`);
          continue;
        }

        if (schema.type === "boolean" && typeof value !== "boolean") {
          this.errors.push(`Field '${key}' must be a boolean`);
          continue;
        }

        if (schema.type === "object" && (typeof value !== "object" || value === null)) {
          this.errors.push(`Field '${key}' must be an object`);
          continue;
        }

        // Range validation for numbers
        if (schema.type === "number") {
          if (schema.min !== undefined && value < schema.min) {
            this.errors.push(`Field '${key}' must be at least ${schema.min}`);
            continue;
          }
          if (schema.max !== undefined && value > schema.max) {
            this.errors.push(`Field '${key}' must be at most ${schema.max}`);
            continue;
          }
        }

        // Options validation
        if (schema.options && !schema.options.includes(value)) {
          this.errors.push(`Field '${key}' must be one of: ${schema.options.join(", ")}`);
          continue;
        }

        // Custom validation
        if (schema.validate && !schema.validate(value)) {
          this.errors.push(`Field '${key}' failed validation`);
          continue;
        }

        validatedConfig[key] = value;
      }

      // Check for unknown fields
      for (const key of Object.keys(config)) {
        if (!(key in CONFIG_SCHEMA)) {
          this.warnings.push(`Unknown field '${key}' will be ignored`);
        }
      }

      return {
        config: validatedConfig,
        errors: this.errors,
        warnings: this.warnings,
        isValid: this.errors.length === 0,
      };
    }

    /**
     * Apply configuration template
     */
    applyTemplate(templateName, baseConfig = {}) {
      if (!(templateName in CONFIG_TEMPLATES)) {
        throw new Error(`Unknown template: ${templateName}`);
      }

      const template = CONFIG_TEMPLATES[templateName];
      return { ...baseConfig, ...template };
    }

    /**
     * Get available templates
     */
    getTemplates() {
      return Object.keys(CONFIG_TEMPLATES);
    }

    /**
     * Get template configuration
     */
    getTemplate(templateName) {
      return CONFIG_TEMPLATES[templateName] || null;
    }

    /**
     * Merge configurations with priority
     */
    merge(...configs) {
      return configs.reduce((merged, config) => {
        return { ...merged, ...config };
      }, {});
    }

    /**
     * Get configuration schema
     */
    getSchema() {
      return CONFIG_SCHEMA;
    }

    /**
     * Generate configuration documentation
     */
    generateDocs() {
      const docs = [];

      for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
        const doc = {
          name: key,
          type: schema.type,
          required: schema.required || false,
          default: schema.default,
          description: this.getFieldDescription(key),
        };

        if (schema.options) {
          doc.options = schema.options;
        }

        if (schema.min !== undefined) {
          doc.min = schema.min;
        }

        if (schema.max !== undefined) {
          doc.max = schema.max;
        }

        docs.push(doc);
      }

      return docs;
    }

    /**
     * Get field description
     */
    getFieldDescription(field) {
      const descriptions = {
        apiKey: "Your API key for authentication",
        siteId: "Unique identifier for your site",
        apiUrl: "Base URL for the API server",
        websocketUrl: "WebSocket server URL for real-time connections",
        position: "Position of notifications on the screen",
        maxNotifications: "Maximum number of notifications to show simultaneously",
        displayDuration: "How long notifications are displayed (milliseconds)",
        animationDuration: "Duration of show/hide animations (milliseconds)",
        showCloseButton: "Whether to show close button on notifications",
        enableSound: "Whether to play sound when notifications appear",
        theme: "Visual theme for notifications",
        customStyles: "Custom CSS styles to apply to the widget",
        debug: "Enable debug logging to console",
        retryAttempts: "Number of connection retry attempts",
        retryDelay: "Delay between retry attempts (milliseconds)",
        heartbeatInterval: "Interval for connection heartbeat (milliseconds)",
        filters: "Filters to apply to incoming notifications",
        targeting: "Targeting rules for notification display",
        customEvents: "Custom event handlers and callbacks",
      };

      return descriptions[field] || "No description available";
    }

    /**
     * Detect optimal configuration based on environment
     */
    detectOptimalConfig(baseConfig = {}) {
      const detected = { ...baseConfig };

      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      if (isMobile) {
        detected.maxNotifications = Math.min(detected.maxNotifications || 3, 2);
        detected.displayDuration = Math.min(detected.displayDuration || 5000, 4000);
        detected.customStyles = {
          ...detected.customStyles,
          fontSize: "12px",
          maxWidth: "280px",
        };
      }

      // Detect slow connection
      if (navigator.connection && navigator.connection.effectiveType) {
        const slowConnections = ["slow-2g", "2g"];
        if (slowConnections.includes(navigator.connection.effectiveType)) {
          detected.retryDelay = Math.max(detected.retryDelay || 2000, 5000);
          detected.heartbeatInterval = Math.max(detected.heartbeatInterval || 30000, 60000);
        }
      }

      // Detect reduced motion preference
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        detected.animationDuration = Math.min(detected.animationDuration || 300, 150);
      }

      // Detect dark mode preference
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        detected.theme = detected.theme || "dark";
      }

      return detected;
    }

    /**
     * Export configuration as JSON
     */
    export(config) {
      return JSON.stringify(config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    import(jsonString) {
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        throw new Error("Invalid JSON configuration");
      }
    }

    /**
     * Create configuration builder
     */
    builder() {
      return new ConfigBuilder();
    }
  }

  /**
   * Configuration Builder Class
   */
  class ConfigBuilder {
    constructor() {
      this.config = {};
    }

    apiKey(key) {
      this.config.apiKey = key;
      return this;
    }

    siteId(id) {
      this.config.siteId = id;
      return this;
    }

    position(pos) {
      this.config.position = pos;
      return this;
    }

    maxNotifications(max) {
      this.config.maxNotifications = max;
      return this;
    }

    displayDuration(duration) {
      this.config.displayDuration = duration;
      return this;
    }

    theme(themeName) {
      this.config.theme = themeName;
      return this;
    }

    enableSound(enabled = true) {
      this.config.enableSound = enabled;
      return this;
    }

    showCloseButton(show = true) {
      this.config.showCloseButton = show;
      return this;
    }

    debug(enabled = true) {
      this.config.debug = enabled;
      return this;
    }

    customStyles(styles) {
      this.config.customStyles = { ...this.config.customStyles, ...styles };
      return this;
    }

    filters(filterConfig) {
      this.config.filters = { ...this.config.filters, ...filterConfig };
      return this;
    }

    template(templateName) {
      const configManager = new SocialProofConfig();
      this.config = configManager.applyTemplate(templateName, this.config);
      return this;
    }

    build() {
      const configManager = new SocialProofConfig();
      const validation = configManager.validate(this.config);

      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(", ")}`);
      }

      return validation.config;
    }
  }

  // Expose to global scope
  window.SocialProofConfig = SocialProofConfig;
  window.SocialProofConfigBuilder = ConfigBuilder;

  // Helper function for quick configuration
  window.createSocialProofConfig = function (options = {}) {
    const configManager = new SocialProofConfig();

    // Apply optimal detection if requested
    if (options.autoDetect) {
      options = configManager.detectOptimalConfig(options);
    }

    // Apply template if specified
    if (options.template) {
      options = configManager.applyTemplate(options.template, options);
      delete options.template;
    }

    const validation = configManager.validate(options);

    if (!validation.isValid) {
      console.error("Social Proof Widget Configuration Errors:", validation.errors);
      if (validation.warnings.length > 0) {
        console.warn("Social Proof Widget Configuration Warnings:", validation.warnings);
      }
      return null;
    }

    if (validation.warnings.length > 0) {
      console.warn("Social Proof Widget Configuration Warnings:", validation.warnings);
    }

    return validation.config;
  };
})(window);
