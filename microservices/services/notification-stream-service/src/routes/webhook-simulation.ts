import express, { Request, Response } from 'express';
import crypto from 'crypto';

const router = express.Router();

// Simple logger
const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[WEBHOOK-SIM-INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[WEBHOOK-SIM-ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WEBHOOK-SIM-WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
};

// Simulate Shopify order creation webhook
router.post('/shopify/orders-create', async (req: Request, res: Response) => {
  try {
    logger.info('Received Shopify order creation webhook simulation', {
      headers: req.headers,
      body: req.body
    });

    // Extract shop domain from headers or body
    const shopDomain = req.headers['x-shopify-shop-domain'] as string || req.body.shop_domain || 'test-shop.myshopify.com';
    
    // Generate a simulated order
    const simulatedOrder = {
      id: Math.floor(Math.random() * 1000000),
      order_number: Math.floor(Math.random() * 10000),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_price: (Math.random() * 200 + 10).toFixed(2),
      currency: 'USD',
      financial_status: 'paid',
      fulfillment_status: null,
      customer: {
        id: Math.floor(Math.random() * 100000),
        email: 'customer@example.com',
        first_name: 'John',
        last_name: 'Doe',
        orders_count: Math.floor(Math.random() * 10) + 1
      },
      line_items: [
        {
          id: Math.floor(Math.random() * 1000000),
          product_id: Math.floor(Math.random() * 100000),
          title: 'Sample Product',
          quantity: Math.floor(Math.random() * 3) + 1,
          price: (Math.random() * 100 + 5).toFixed(2)
        }
      ],
      shipping_address: {
        first_name: 'John',
        last_name: 'Doe',
        address1: '123 Main St',
        city: 'New York',
        province: 'NY',
        country: 'United States',
        zip: '10001'
      }
    };

    // Create a notification event
    const notificationEvent = {
      event_type: 'order.created',
      platform: 'shopify',
      site_id: req.body.site_id || 'test-site',
      timestamp: new Date().toISOString(),
      source_created_at: simulatedOrder.created_at,
      order: {
        id: simulatedOrder.id,
        order_number: simulatedOrder.order_number,
        total_price: simulatedOrder.total_price,
        currency: simulatedOrder.currency,
        financial_status: simulatedOrder.financial_status,
        fulfillment_status: simulatedOrder.fulfillment_status,
        total_items: simulatedOrder.line_items.reduce((sum, item) => sum + item.quantity, 0)
      },
      customer: simulatedOrder.customer,
      product: {
        name: simulatedOrder.line_items[0].title,
        price: simulatedOrder.line_items[0].price
      },
      location: {
        city: simulatedOrder.shipping_address.city,
        province: simulatedOrder.shipping_address.province,
        country: simulatedOrder.shipping_address.country
      }
    };

    // Send notification via the notification system
    try {
      const notificationResponse = await fetch('http://localhost:3002/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: req.body.organization_id || 'test-org',
          siteId: req.body.site_id || 'test-site',
          payload: {
            type: 'popup',
            message: `${notificationEvent.customer.first_name} just purchased ${notificationEvent.product.name} from ${notificationEvent.location.city}`,
            data: notificationEvent,
          },
          priority: 'normal',
          channels: ['web']
        })
      });

      if (notificationResponse.ok) {
        const notificationResult = await notificationResponse.json();
        logger.info('Notification sent successfully', { notificationResult });
      } else {
        logger.error('Failed to send notification', { 
          status: notificationResponse.status,
          statusText: notificationResponse.statusText
        });
      }
    } catch (notificationError) {
      logger.error('Error sending notification', { error: notificationError });
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Webhook simulation processed successfully',
      order: simulatedOrder,
      notification: notificationEvent
    });

  } catch (error) {
    logger.error('Error processing webhook simulation', { error });
    res.status(500).json({
      error: 'Failed to process webhook simulation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for webhook simulation
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'webhook-simulation',
    timestamp: new Date().toISOString()
  });
});

export default router; 