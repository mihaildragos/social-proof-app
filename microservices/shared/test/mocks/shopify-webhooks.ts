import crypto from 'crypto';

/**
 * Mock Shopify webhook utilities for testing
 */
export class ShopifyWebhookMock {
  private secret: string;

  constructor(secret: string = 'test_webhook_secret') {
    this.secret = secret;
  }

  /**
   * Generate HMAC signature for Shopify webhook verification
   */
  generateHmac(payload: any): string {
    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = hmac.update(Buffer.from(JSON.stringify(payload))).digest('base64');
    return digest;
  }

  /**
   * Create mock headers for a Shopify webhook
   */
  createHeaders(payload: any): Record<string, string> {
    const hmac = this.generateHmac(payload);
    return {
      'X-Shopify-Topic': 'orders/create',
      'X-Shopify-Hmac-Sha256': hmac,
      'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
      'X-Shopify-API-Version': '2023-07',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate mock order created webhook
   */
  orderCreatedWebhook(options: {
    orderId?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    total?: string;
    productIds?: number[];
  } = {}): { payload: any; headers: Record<string, string> } {
    const {
      orderId = 1001,
      email = 'customer@example.com',
      firstName = 'Test',
      lastName = 'Customer',
      total = '99.95',
      productIds = [11111, 22222]
    } = options;

    const payload = {
      id: orderId,
      email: email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      number: orderId,
      total_price: total,
      currency: 'USD',
      financial_status: 'paid',
      customer: {
        id: 1234567890,
        email: email,
        first_name: firstName,
        last_name: lastName
      },
      line_items: productIds.map((id, index) => ({
        id: id,
        product_id: id,
        title: `Test Product ${index + 1}`,
        quantity: 1,
        price: (parseFloat(total) / productIds.length).toFixed(2)
      })),
      shipping_address: {
        city: 'New York',
        province: 'NY',
        country: 'US',
        zip: '10001'
      }
    };

    const headers = this.createHeaders(payload);
    
    return { payload, headers };
  }

  /**
   * Generate mock customer created webhook
   */
  customerCreatedWebhook(options: {
    customerId?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
  } = {}): { payload: any; headers: Record<string, string> } {
    const {
      customerId = 1234567890,
      email = 'customer@example.com',
      firstName = 'Test',
      lastName = 'Customer'
    } = options;

    const payload = {
      id: customerId,
      email: email,
      first_name: firstName,
      last_name: lastName,
      phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verified_email: true,
      tags: '',
      addresses: []
    };

    const headers = {
      ...this.createHeaders(payload),
      'X-Shopify-Topic': 'customers/create'
    };
    
    return { payload, headers };
  }
}

export default ShopifyWebhookMock; 