/**
 * Social Proof Widget Analytics Tracking
 * Version: 1.0.0
 * 
 * This module provides comprehensive analytics tracking for the widget,
 * including user interactions, performance metrics, and business intelligence.
 */

(function(window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.SocialProofAnalytics) {
    return;
  }

  // Analytics configuration
  const ANALYTICS_CONFIG = {
    endpoint: 'https://api.socialproof.app/analytics/events',
    batchSize: 10,
    flushInterval: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
    enableDebug: false,
    enablePerformanceTracking: true,
    enableErrorTracking: true,
    enableUserTracking: true,
    enableSessionTracking: true
  };

  // Event queue and state
  let eventQueue = [];
  let sessionId = null;
  let userId = null;
  let deviceId = null;
  let flushTimer = null;
  let isOnline = navigator.onLine;
  let performanceObserver = null;
  let errorHandler = null;

  /**
   * Analytics Manager Class
   */
  class SocialProofAnalytics {
    constructor(config = {}) {
      this.config = { ...ANALYTICS_CONFIG, ...config };
      this.init();
    }

    /**
     * Initialize analytics system
     */
    init() {
      this.generateIds();
      this.setupEventListeners();
      this.setupPerformanceTracking();
      this.setupErrorTracking();
      this.setupSessionTracking();
      this.startFlushTimer();
      
      this.log('Analytics initialized', {
        sessionId,
        deviceId,
        config: this.config
      });
    }

    /**
     * Generate unique identifiers
     */
    generateIds() {
      // Generate or retrieve session ID
      sessionId = this.getSessionId();
      
      // Generate or retrieve device ID
      deviceId = this.getDeviceId();
      
      // User ID will be set when available
      userId = this.getUserId();
    }

    /**
     * Get or generate session ID
     */
    getSessionId() {
      let id = sessionStorage.getItem('sp_session_id');
      if (!id) {
        id = this.generateUUID();
        sessionStorage.setItem('sp_session_id', id);
        sessionStorage.setItem('sp_session_start', Date.now().toString());
      }
      return id;
    }

    /**
     * Get or generate device ID
     */
    getDeviceId() {
      let id = localStorage.getItem('sp_device_id');
      if (!id) {
        id = this.generateUUID();
        localStorage.setItem('sp_device_id', id);
      }
      return id;
    }

    /**
     * Get user ID from various sources
     */
    getUserId() {
      // Try to get from various sources
      return localStorage.getItem('sp_user_id') ||
             window.socialProofUserId ||
             this.extractUserIdFromCookies() ||
             null;
    }

    /**
     * Extract user ID from cookies
     */
    extractUserIdFromCookies() {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'sp_user_id' || name === 'user_id') {
          return value;
        }
      }
      return null;
    }

    /**
     * Generate UUID
     */
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    /**
     * Track event
     */
    track(eventName, properties = {}) {
      const event = this.createEvent(eventName, properties);
      this.addToQueue(event);
      
      this.log('Event tracked', event);
      
      // Flush immediately for critical events
      if (this.isCriticalEvent(eventName)) {
        this.flush();
      }
    }

    /**
     * Create event object
     */
    createEvent(eventName, properties) {
      const timestamp = Date.now();
      const page = this.getPageInfo();
      const device = this.getDeviceInfo();
      const session = this.getSessionInfo();

      return {
        event: eventName,
        timestamp,
        sessionId,
        deviceId,
        userId,
        properties: {
          ...properties,
          page,
          device,
          session,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          online: isOnline
        }
      };
    }

    /**
     * Get page information
     */
    getPageInfo() {
      return {
        url: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        title: document.title,
        encoding: document.characterSet,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    }

    /**
     * Get device information
     */
    getDeviceInfo() {
      const screen = window.screen;
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      return {
        type: this.getDeviceType(),
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        },
        connection: connection ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        } : null,
        memory: navigator.deviceMemory || null,
        cores: navigator.hardwareConcurrency || null,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack
      };
    }

    /**
     * Get device type
     */
    getDeviceType() {
      const userAgent = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        return 'tablet';
      }
      if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
        return 'mobile';
      }
      return 'desktop';
    }

    /**
     * Get session information
     */
    getSessionInfo() {
      const startTime = parseInt(sessionStorage.getItem('sp_session_start') || Date.now());
      const duration = Date.now() - startTime;
      
      return {
        startTime,
        duration,
        pageViews: this.getPageViews(),
        isNewSession: duration < 30000 // New if less than 30 seconds
      };
    }

    /**
     * Get page views count
     */
    getPageViews() {
      let count = parseInt(sessionStorage.getItem('sp_page_views') || '0');
      count++;
      sessionStorage.setItem('sp_page_views', count.toString());
      return count;
    }

    /**
     * Check if event is critical
     */
    isCriticalEvent(eventName) {
      const criticalEvents = [
        'widget_error',
        'notification_conversion',
        'page_unload',
        'widget_disconnected'
      ];
      return criticalEvents.includes(eventName);
    }

    /**
     * Add event to queue
     */
    addToQueue(event) {
      eventQueue.push(event);
      
      // Auto-flush if queue is full
      if (eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }

    /**
     * Flush event queue
     */
    async flush() {
      if (eventQueue.length === 0) {
        return;
      }

      const events = [...eventQueue];
      eventQueue = [];

      try {
        await this.sendEvents(events);
        this.log('Events flushed successfully', { count: events.length });
      } catch (error) {
        this.log('Failed to flush events', error);
        // Re-add events to queue for retry
        eventQueue.unshift(...events);
      }
    }

    /**
     * Send events to server
     */
    async sendEvents(events, retryCount = 0) {
      if (!isOnline) {
        throw new Error('Offline - events will be retried');
      }

      try {
        const response = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SP-Device-ID': deviceId,
            'X-SP-Session-ID': sessionId
          },
          body: JSON.stringify({
            events,
            metadata: {
              sdk: 'social-proof-widget',
              version: '1.0.0',
              timestamp: Date.now()
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.log('Events sent successfully', result);
        
      } catch (error) {
        if (retryCount < this.config.retryAttempts) {
          this.log(`Retrying send events (${retryCount + 1}/${this.config.retryAttempts})`, error);
          
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryCount))
          );
          
          return this.sendEvents(events, retryCount + 1);
        }
        
        throw error;
      }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Online/offline status
      window.addEventListener('online', () => {
        isOnline = true;
        this.track('connection_restored');
        this.flush(); // Flush queued events
      });

      window.addEventListener('offline', () => {
        isOnline = false;
        this.track('connection_lost');
      });

      // Page visibility
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.track('page_hidden');
          this.flush(); // Flush before page becomes hidden
        } else {
          this.track('page_visible');
        }
      });

      // Page unload
      window.addEventListener('beforeunload', () => {
        this.track('page_unload');
        this.flushSync(); // Synchronous flush for page unload
      });

      // Focus/blur
      window.addEventListener('focus', () => {
        this.track('window_focus');
      });

      window.addEventListener('blur', () => {
        this.track('window_blur');
      });

      // Scroll tracking
      let scrollTimer = null;
      window.addEventListener('scroll', () => {
        if (scrollTimer) {
          clearTimeout(scrollTimer);
        }
        
        scrollTimer = setTimeout(() => {
          const scrollPercent = Math.round(
            (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
          );
          
          this.track('page_scroll', {
            scrollPercent,
            scrollY: window.scrollY
          });
        }, 1000);
      });

      // Click tracking
      document.addEventListener('click', (event) => {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();
        
        // Track clicks on important elements
        if (['a', 'button', 'input'].includes(tagName) || target.onclick) {
          this.track('element_click', {
            tagName,
            className: target.className,
            id: target.id,
            text: target.textContent?.substring(0, 100),
            href: target.href,
            x: event.clientX,
            y: event.clientY
          });
        }
      });
    }

    /**
     * Setup performance tracking
     */
    setupPerformanceTracking() {
      if (!this.config.enablePerformanceTracking) {
        return;
      }

      // Navigation timing
      window.addEventListener('load', () => {
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          if (navigation) {
            this.track('page_performance', {
              loadTime: navigation.loadEventEnd - navigation.loadEventStart,
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              firstPaint: this.getFirstPaint(),
              firstContentfulPaint: this.getFirstContentfulPaint()
            });
          }
        }, 0);
      });

      // Performance observer for paint timing
      if ('PerformanceObserver' in window) {
        try {
          performanceObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'paint') {
                this.track('paint_timing', {
                  name: entry.name,
                  startTime: entry.startTime
                });
              }
            }
          });
          
          performanceObserver.observe({ entryTypes: ['paint'] });
        } catch (error) {
          this.log('Performance observer not supported', error);
        }
      }
    }

    /**
     * Get first paint timing
     */
    getFirstPaint() {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? firstPaint.startTime : null;
    }

    /**
     * Get first contentful paint timing
     */
    getFirstContentfulPaint() {
      const paintEntries = performance.getEntriesByType('paint');
      const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      return firstContentfulPaint ? firstContentfulPaint.startTime : null;
    }

    /**
     * Setup error tracking
     */
    setupErrorTracking() {
      if (!this.config.enableErrorTracking) {
        return;
      }

      // Global error handler
      errorHandler = (event) => {
        this.track('javascript_error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          userAgent: navigator.userAgent
        });
      };

      window.addEventListener('error', errorHandler);

      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.track('unhandled_promise_rejection', {
          reason: event.reason?.toString(),
          stack: event.reason?.stack
        });
      });
    }

    /**
     * Setup session tracking
     */
    setupSessionTracking() {
      if (!this.config.enableSessionTracking) {
        return;
      }

      // Track session start
      this.track('session_start');

      // Track session heartbeat every 30 seconds
      setInterval(() => {
        if (!document.hidden) {
          this.track('session_heartbeat');
        }
      }, 30000);
    }

    /**
     * Start flush timer
     */
    startFlushTimer() {
      if (flushTimer) {
        clearInterval(flushTimer);
      }

      flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }

    /**
     * Synchronous flush for page unload
     */
    flushSync() {
      if (eventQueue.length === 0) {
        return;
      }

      const events = [...eventQueue];
      eventQueue = [];

      // Use sendBeacon for reliable delivery during page unload
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          events,
          metadata: {
            sdk: 'social-proof-widget',
            version: '1.0.0',
            timestamp: Date.now()
          }
        });

        navigator.sendBeacon(this.config.endpoint, data);
        this.log('Events sent via beacon', { count: events.length });
      }
    }

    /**
     * Set user ID
     */
    setUserId(id) {
      userId = id;
      localStorage.setItem('sp_user_id', id);
      this.track('user_identified', { userId: id });
    }

    /**
     * Set custom properties
     */
    setProperties(properties) {
      this.customProperties = { ...this.customProperties, ...properties };
    }

    /**
     * Track conversion
     */
    trackConversion(conversionData) {
      this.track('conversion', {
        ...conversionData,
        timestamp: Date.now()
      });
    }

    /**
     * Track revenue
     */
    trackRevenue(amount, currency = 'USD', properties = {}) {
      this.track('revenue', {
        amount,
        currency,
        ...properties
      });
    }

    /**
     * Get analytics summary
     */
    getSummary() {
      return {
        sessionId,
        deviceId,
        userId,
        queueLength: eventQueue.length,
        isOnline,
        config: this.config
      };
    }

    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
      this.config.enableDebug = enabled;
    }

    /**
     * Log debug messages
     */
    log(...args) {
      if (this.config.enableDebug) {
        console.log('[SocialProofAnalytics]', ...args);
      }
    }

    /**
     * Destroy analytics instance
     */
    destroy() {
      // Flush remaining events
      this.flushSync();

      // Clear timers
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }

      // Disconnect observers
      if (performanceObserver) {
        performanceObserver.disconnect();
        performanceObserver = null;
      }

      // Remove error handler
      if (errorHandler) {
        window.removeEventListener('error', errorHandler);
        errorHandler = null;
      }

      // Clear queue
      eventQueue = [];

      this.log('Analytics destroyed');
    }
  }

  // Expose to global scope
  window.SocialProofAnalytics = SocialProofAnalytics;

  // Auto-initialize if config is provided
  if (window.socialProofAnalyticsConfig) {
    window.SocialProofAnalytics = new SocialProofAnalytics(window.socialProofAnalyticsConfig);
  } else {
    // Create default instance
    window.SocialProofAnalytics = new SocialProofAnalytics();
  }

})(window, document); 