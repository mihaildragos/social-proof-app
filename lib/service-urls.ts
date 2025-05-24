/**
 * Environment-aware service URL resolution
 * Handles Docker vs localhost vs production environments
 */

export interface ServiceUrls {
  integrations: string;
  notificationStream: string;
  notifications: string;
  users: string;
  analytics: string;
  billing: string;
  externalMocks: string;
}

/**
 * Detect current environment
 * @returns Environment type
 */
export function detectEnvironment(): 'docker' | 'localhost' | 'production' {
  // Check if we're in Docker container
  if (process.env.NODE_ENV === 'development' && process.env.KAFKA_BROKERS?.includes('kafka:')) {
    return 'docker';
  }
  
  // Check if we're in production
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // Default to localhost for development
  return 'localhost';
}

/**
 * Get service URLs based on environment
 * @param forBrowser - Whether URLs are for browser (external) or server (internal) use
 * @returns Service URLs object
 */
export function getServiceUrls(forBrowser: boolean = false): ServiceUrls {
  const env = detectEnvironment();
  
  switch (env) {
    case 'docker':
      if (forBrowser) {
        // Browser needs external localhost URLs
        return {
          integrations: 'http://localhost:3001',
          notificationStream: 'http://localhost:3002',
          notifications: 'http://localhost:3003',
          users: 'http://localhost:3004',
          analytics: 'http://localhost:3005',
          billing: 'http://localhost:3006',
          externalMocks: 'http://localhost:4000',
        };
      } else {
        // Server-side can use internal Docker service names
        return {
          integrations: 'http://integrations-service:3001',
          notificationStream: 'http://notification-stream-service:3002',
          notifications: 'http://notifications-service:3003',
          users: 'http://users-service:3004',
          analytics: 'http://analytics-service:3005',
          billing: 'http://billing-service:3006',
          externalMocks: 'http://external-mocks:4000',
        };
      }
      
    case 'production':
      // Production URLs would come from environment variables
      return {
        integrations: process.env.INTEGRATIONS_SERVICE_URL || 'https://integrations.yourapp.com',
        notificationStream: process.env.NOTIFICATION_STREAM_SERVICE_URL || 'https://stream.yourapp.com',
        notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'https://notifications.yourapp.com',
        users: process.env.USERS_SERVICE_URL || 'https://users.yourapp.com',
        analytics: process.env.ANALYTICS_SERVICE_URL || 'https://analytics.yourapp.com',
        billing: process.env.BILLING_SERVICE_URL || 'https://billing.yourapp.com',
        externalMocks: process.env.EXTERNAL_MOCKS_URL || 'https://mocks.yourapp.com',
      };
      
    case 'localhost':
    default:
      // Development localhost URLs
      return {
        integrations: process.env.INTEGRATIONS_SERVICE_URL || 'http://localhost:3000',
        notificationStream: process.env.NOTIFICATION_STREAM_SERVICE_URL || 'http://localhost:3000',
        notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3000',
        users: process.env.USERS_SERVICE_URL || 'http://localhost:3000',
        analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3000',
        billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3000',
        externalMocks: process.env.EXTERNAL_MOCKS_URL || 'http://localhost:3000',
      };
  }
}

/**
 * Get specific service URL
 * @param service - Service name
 * @param forBrowser - Whether URL is for browser use
 * @returns Service URL
 */
export function getServiceUrl(service: keyof ServiceUrls, forBrowser: boolean = false): string {
  const urls = getServiceUrls(forBrowser);
  return urls[service];
}

/**
 * Get integrations service URL specifically
 * @param forBrowser - Whether URL is for browser use
 * @returns Integrations service URL
 */
export function getIntegrationsServiceUrl(forBrowser: boolean = false): string {
  return getServiceUrl('integrations', forBrowser);
}

/**
 * Get notification stream service URL specifically
 * @param forBrowser - Whether URL is for browser use
 * @returns Notification stream service URL
 */
export function getNotificationStreamServiceUrl(forBrowser: boolean = false): string {
  return getServiceUrl('notificationStream', forBrowser);
}

/**
 * Check if a service is healthy
 * @param serviceUrl - Service URL to check
 * @returns Promise resolving to health status
 */
export async function checkServiceHealth(serviceUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error(`Health check failed for ${serviceUrl}:`, error);
    return false;
  }
}

/**
 * Wait for service to be healthy
 * @param serviceUrl - Service URL to wait for
 * @param maxAttempts - Maximum number of attempts
 * @param delayMs - Delay between attempts in milliseconds
 * @returns Promise resolving when service is healthy
 */
export async function waitForServiceHealth(
  serviceUrl: string, 
  maxAttempts: number = 10, 
  delayMs: number = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isHealthy = await checkServiceHealth(serviceUrl);
    if (isHealthy) {
      return true;
    }
    
    if (attempt < maxAttempts) {
      console.log(`Service ${serviceUrl} not ready, attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  console.error(`Service ${serviceUrl} failed to become healthy after ${maxAttempts} attempts`);
  return false;
} 