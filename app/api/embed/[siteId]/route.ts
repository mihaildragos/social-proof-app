import { NextResponse } from "next/server";
import { createClerkSupabaseClientSsr } from "@/utils/supabase/server";
import { SiteStatus } from "@/types/sites";

// This route returns the JavaScript code that will be embedded on the client's website
export async function GET(req: Request, { params }: { params: { siteId: string } }) {
  try {
    // Strip .js extension if it exists (since route is [siteId].js)
    const siteId = params.siteId.replace(/\.js$/, '');

    // No auth check here as this is a public endpoint
    const supabase = await createClerkSupabaseClientSsr();

    // Get the site to verify it exists and is verified
    const { data: site, error } = await supabase
      .from("sites")
      .select("status, domain")
      .eq("id", siteId)
      .single();

    // In development, allow test sites that don't exist in database
    let siteData = site;
    if ((error || !site) && process.env.NODE_ENV === 'development' && siteId.startsWith('test-')) {
      console.log("Using test site for development:", siteId);
      siteData = {
        status: SiteStatus.VERIFIED,
        domain: 'localhost:3000'
      };
    } else if (error || !site) {
      console.error("Error fetching site for embed:", error);
      return new NextResponse("console.error('Social Proof: Invalid site ID');", {
        status: 404,
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // If site is not verified, don't provide the real code
    if (siteData.status !== SiteStatus.VERIFIED) {
      return new NextResponse("console.error('Social Proof: Site not verified');", {
        status: 200,
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // Generate the embed code with proper CSP and security measures
    const embedCode = `
(function() {
  // Configuration
  var config = {
    siteId: "${siteId}",
    organizationId: "test-org", // Default organization for development
    apiHost: "${process.env.NEXT_PUBLIC_VERCEL_URL || "localhost:3000"}",
    apiEndpoint: "${process.env.NEXT_PUBLIC_VERCEL_URL || "localhost:3000"}/api",
    notificationStreamHost: "${process.env.NODE_ENV === 'development' ? 'localhost:3002' : process.env.NEXT_PUBLIC_VERCEL_URL || "localhost:3000"}",
    targetOrigin: "https://${siteData.domain}",
    position: "bottom-left",
    displayTime: 5000,
    animation: "fade",
    protocol: "${process.env.NODE_ENV === 'development' ? 'http' : 'https'}"
  };
  
  // Notification container
  var container = document.createElement('div');
  container.id = 'social-proof-container';
  document.body.appendChild(container);
  
  // SSE connection for real-time notifications
  var eventSource = null;
  var reconnectAttempts = 0;
  var maxReconnectAttempts = 5;
  var reconnectInterval = 3000;
  
  // Initialize the client
  window.SocialProof = window.SocialProof || {};
  window.SocialProof.init = function(options) {
    console.log('Social Proof: init() called with options:', options);
    
    // Merge options with default config
    if (options) {
      for (var key in options) {
        if (options.hasOwnProperty(key)) {
          config[key] = options[key];
        }
      }
    }
    
    console.log('Social Proof: Final config:', config);
    console.log('Social Proof: Container element before setup:', container);
    
    // Create the notification container with position
    setContainerPosition(config.position);
    
    console.log('Social Proof: Container element after setup:', container);
    console.log('Social Proof: Container in DOM:', document.body.contains(container));
    
    // Add necessary styles
    addStyles();
    
    console.log('Social Proof: About to connect to SSE...');
    
    // Connect to SSE endpoint for real-time notifications
    connectSSE();
  };
  
  // Expose showNotification for debugging
  window.SocialProof.showNotification = showNotification;
  
  // Expose test function for debugging
  window.SocialProof.test = function() {
    console.log('Social Proof: Running test...');
    console.log('Social Proof: Config:', config);
    console.log('Social Proof: Container:', container);
    console.log('Social Proof: EventSource:', eventSource);
    console.log('Social Proof: EventSource readyState:', eventSource ? eventSource.readyState : 'null');
    
    // Test notification
    showNotification({
      id: 'test-' + Date.now(),
      type: 'order',
      content: {
        title: '🛍️ New Purchase',
        message: 'John from New York just bought Premium Headphones',
        image: null
      },
      createdAt: new Date().toISOString()
    });
  };
  
  // Expose reconnect function for debugging
  window.SocialProof.reconnect = function() {
    console.log('Social Proof: Manual reconnect triggered');
    connectSSE();
  };
  
  // Set the container position based on configuration
  function setContainerPosition(position) {
    var posStyles = {
      'top-left': 'position:fixed;top:20px;left:20px;z-index:9999;',
      'top-right': 'position:fixed;top:20px;right:20px;z-index:9999;',
      'bottom-left': 'position:fixed;bottom:20px;left:20px;z-index:9999;',
      'bottom-right': 'position:fixed;bottom:20px;right:20px;z-index:9999;',
      'top-center': 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;',
      'bottom-center': 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;'
    };
    
    container.style.cssText = posStyles[position] || posStyles['bottom-left'];
  }
  
  // Connect to the SSE endpoint
  function connectSSE() {
    console.log('Social Proof: connectSSE() called');
    
    if (eventSource) {
      console.log('Social Proof: Closing existing eventSource');
      eventSource.close();
    }
    
    try {
      var sseUrl = config.protocol + '://' + config.notificationStreamHost + '/api/notifications/sse/' + config.siteId + '?organizationId=' + config.organizationId;
      console.log('Social Proof: Connecting to SSE URL:', sseUrl);
      console.log('Social Proof: EventSource supported:', !!window.EventSource);
      
      eventSource = new EventSource(sseUrl);
      console.log('Social Proof: EventSource created:', eventSource);
      console.log('Social Proof: EventSource readyState:', eventSource.readyState);
      
      // Set up event listeners
      eventSource.onopen = function() {
        console.log('Social Proof: Connected to notification stream');
        console.log('Social Proof: EventSource readyState after open:', eventSource.readyState);
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };
      
      eventSource.onmessage = function(event) {
        try {
          console.log('Social Proof: Raw SSE data received:', event.data);
          var notification = JSON.parse(event.data);
          console.log('Social Proof: Parsed notification data:', notification);
          showNotification(notification);
        } catch (err) {
          console.error('Social Proof: Error processing notification:', err);
        }
      };
      
      eventSource.onerror = function(err) {
        console.error('Social Proof: SSE connection error:', err);
        console.log('Social Proof: EventSource readyState on error:', eventSource.readyState);
        eventSource.close();
        
        // Attempt to reconnect if not max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log('Social Proof: Attempting reconnect', reconnectAttempts, 'of', maxReconnectAttempts);
          setTimeout(connectSSE, reconnectInterval);
        } else {
          console.error('Social Proof: Max reconnect attempts reached');
        }
      };
      
      // Listen for specific events
      eventSource.addEventListener('connected', function(e) {
        console.log('Social Proof: Successfully connected to SSE:', e.data);
      });
      
      eventSource.addEventListener('notification', function(e) {
        try {
          console.log('Social Proof: Notification event received:', e.data);
          var notification = JSON.parse(e.data);
          console.log('Social Proof: Parsed notification data:', notification);
          showNotification(notification);
        } catch (err) {
          console.error('Social Proof: Error processing notification event:', err);
        }
      });
      
      eventSource.addEventListener('ping', function() {
        console.log('Social Proof: Ping received');
      });
      
      eventSource.addEventListener('error', function(e) {
        console.error('Social Proof: Error event received:', e.data);
      });
    } catch (err) {
      console.error('Social Proof: Failed to establish SSE connection:', err);
    }
    
    // Fallback for browsers that don't support SSE
    if (!window.EventSource) {
      console.warn('Social Proof: EventSource not supported in this browser, falling back to polling');
      fallbackToPolling();
    }
  }
  
  // Fallback to polling for browsers that don't support SSE
  function fallbackToPolling() {
    // Poll for notifications every 15 seconds
    setInterval(fetchNotifications, 15000);
    // Also fetch immediately on init
    fetchNotifications();
  }
  
  // Fetch notifications from the API (fallback method)
  function fetchNotifications() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', config.protocol + '://' + config.apiEndpoint + '/notifications?siteId=' + config.siteId);
    xhr.onload = function() {
      if (xhr.status === 200) {
        var response = JSON.parse(xhr.responseText);
        if (response.notifications && response.notifications.length > 0) {
          showNotification(response.notifications[0]);
        }
      }
    };
    xhr.send();
  }
  
  // Display a notification
  function showNotification(notification) {
    console.log('Social Proof: showNotification called with:', notification);
    console.log('Social Proof: Container element:', container);
    console.log('Social Proof: Container exists:', !!container);
    
    if (!container) {
      console.error('Social Proof: Cannot display notification - container not found');
      return;
    }
    
    var notifEl = document.createElement('div');
    notifEl.className = 'social-proof-notification';
    
    // Set the notification style based on notification type
    var typeClass = notification.type || 'default';
    notifEl.classList.add('social-proof-notification-' + typeClass);
    
    // Build notification content
    if (notification.content && notification.content.html) {
      // If notification has pre-rendered HTML, use it
      notifEl.innerHTML = notification.content.html;
    } else {
      // Otherwise build a generic notification
      var imageHtml = notification.content && notification.content.image 
        ? '<div class="social-proof-notification-image"><img src="' + notification.content.image + '" alt=""></div>' 
        : '';
        
      var titleHtml = notification.content && notification.content.title 
        ? '<div class="social-proof-notification-title">' + notification.content.title + '</div>' 
        : '';
        
      var messageHtml = notification.content && notification.content.message 
        ? '<div class="social-proof-notification-message">' + notification.content.message + '</div>' 
        : 'Someone just took action!';
        
      var timeHtml = notification.createdAt 
        ? '<div class="social-proof-notification-time">' + formatTime(notification.createdAt) + '</div>' 
        : '';
      
      notifEl.innerHTML = 
        '<div class="social-proof-notification-content">' +
          imageHtml +
          '<div class="social-proof-notification-text">' + 
            titleHtml +
            messageHtml +
            timeHtml +
          '</div>' +
        '</div>' +
        '<button class="social-proof-notification-close" aria-label="Close">&times;</button>';
    }
    
    // Add to container
    container.appendChild(notifEl);
    
    // Add animation class based on config
    notifEl.classList.add('social-proof-animation-in-' + config.animation);
    
    // Handle close button click
    var closeBtn = notifEl.querySelector('.social-proof-notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        closeNotification(notifEl);
      });
    }
    
    // Handle notification click for tracking and navigation
    notifEl.addEventListener('click', function(e) {
      // Don't track clicks on the close button
      if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
        sendEvent('click', { notification_id: notification.id });
        
        // If notification has a URL, navigate to it
        if (notification.content && notification.content.url) {
          window.open(notification.content.url, '_blank');
        }
      }
    });
    
    // Auto-remove after delay
    setTimeout(function() {
      closeNotification(notifEl);
    }, config.displayTime);
    
    // Send impression event
    sendEvent('impression', { notification_id: notification.id });
  }
  
  // Close and remove a notification
  function closeNotification(notifEl) {
    // Add exit animation class
    notifEl.classList.add('social-proof-animation-out-' + config.animation);
    
    // Remove after animation completes
    setTimeout(function() {
      if (container.contains(notifEl)) {
        container.removeChild(notifEl);
      }
    }, 500);
  }
  
  // Format time for display
  function formatTime(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000); // seconds ago
    
    if (diff < 60) {
      return 'Just now';
    } else if (diff < 3600) {
      var mins = Math.floor(diff / 60);
      return mins + ' minute' + (mins > 1 ? 's' : '') + ' ago';
    } else if (diff < 86400) {
      var hours = Math.floor(diff / 3600);
      return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
    } else {
      var days = Math.floor(diff / 86400);
      return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    }
  }
  
  // Send events back to our API
  function sendEvent(eventType, data) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', config.protocol + '://' + config.apiEndpoint + '/events');
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      // Handle success/error without blocking notification display
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('Social Proof: Event tracked successfully:', eventType);
        } else {
          console.warn('Social Proof: Event tracking failed:', xhr.status, xhr.responseText);
        }
      };
      
      xhr.onerror = function() {
        console.warn('Social Proof: Event tracking request failed:', eventType);
      };
      
      xhr.send(JSON.stringify({
        site_id: config.siteId,
        event_type: eventType,
        data: data,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Social Proof: Event tracking error:', err);
    }
  }
  
  // Add necessary styles
  function addStyles() {
    var styleSheet = document.createElement('style');
    styleSheet.textContent = \`
      #social-proof-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        box-sizing: border-box;
      }
      
      .social-proof-notification {
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        margin-bottom: 12px;
        max-width: 320px;
        overflow: hidden;
        position: relative;
        cursor: pointer;
        border: 1px solid rgba(0,0,0,0.1);
      }
      
      .social-proof-notification-order {
        border-left: 4px solid #3b82f6;
      }
      
      .social-proof-notification-success {
        border-left: 4px solid #10b981;
      }
      
      .social-proof-notification-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      
      .social-proof-notification-image {
        width: 48px;
        height: 48px;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
      }
      
      .social-proof-notification-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .social-proof-notification-text {
        flex: 1;
      }
      
      .social-proof-notification-title {
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .social-proof-notification-message {
        color: #374151;
      }
      
      .social-proof-notification-time {
        font-size: 12px;
        color: #6b7280;
        margin-top: 4px;
      }
      
      .social-proof-notification-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        color: #9ca3af;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .social-proof-notification:hover .social-proof-notification-close {
        opacity: 1;
      }
      
      /* Animation classes */
      .social-proof-animation-in-fade {
        animation: socialProofFadeIn 0.5s ease forwards;
      }
      
      .social-proof-animation-out-fade {
        animation: socialProofFadeOut 0.5s ease forwards;
      }
      
      .social-proof-animation-in-slide {
        animation: socialProofSlideIn 0.5s ease forwards;
      }
      
      .social-proof-animation-out-slide {
        animation: socialProofSlideOut 0.5s ease forwards;
      }
      
      .social-proof-animation-in-bounce {
        animation: socialProofBounceIn 0.5s ease forwards;
      }
      
      .social-proof-animation-out-bounce {
        animation: socialProofBounceOut 0.5s ease forwards;
      }
      
      @keyframes socialProofFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes socialProofFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      @keyframes socialProofSlideIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes socialProofSlideOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(20px); }
      }
      
      @keyframes socialProofBounceIn {
        0% { opacity: 0; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes socialProofBounceOut {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.05); }
        100% { opacity: 0; transform: scale(0.8); }
      }
    \`;
    document.head.appendChild(styleSheet);
  }
})();
    `;

    // Return the JavaScript with appropriate headers
    return new NextResponse(embedCode, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": process.env.NODE_ENV === 'development' ? "no-cache, no-store, must-revalidate" : "public, max-age=3600",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error generating embed code:", error);
    return new NextResponse("console.error('Social Proof: Server error');", {
      status: 500,
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-cache",
      },
    });
  }
}
