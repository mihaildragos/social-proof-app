-- Migration: 002_add_default_notification_template.sql
-- Description: Add default notification template for test site
-- Created: 2025-05-26
BEGIN;

-- Insert default notification template for test site (only if it doesn't exist)
INSERT INTO
    templates (
        site_id,
        name,
        description,
        css,
        html,
        content,
        channels,
        event_types,
        status
    )
SELECT
    '83bbcff3-1932-41a6-9e1a-08b93374dd64',
    'Test Site Order Notification',
    'Default template for test site order notifications',
        '.notification {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    padding: 16px;
    border-radius: 8px;
    background-color: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    max-width: 400px;
    border-left: 4px solid #10b981;
    margin: 8px;
    animation: slideIn 0.3s ease-out;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .notification-icon {
    width: 48px;
    height: 48px;
    margin-right: 12px;
    border-radius: 6px;
    overflow: hidden;
    background-color: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .notification-icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .notification-icon-fallback {
    width: 24px;
    height: 24px;
    background-color: #10b981;
    border-radius: 50%;
  }
  
  .notification-content {
    flex: 1;
  }
  
  .notification-title {
    font-weight: 600;
    font-size: 14px;
    color: #111827;
    margin-bottom: 4px;
  }
  
  .notification-message {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.4;
  }
  
  .notification-time {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 4px;
  }
  
  .customer-name {
    font-weight: 500;
    color: #374151;
  }
  
  .product-name {
    font-weight: 500;
    color: #10b981;
  }
  
  .price {
    font-weight: 600;
    color: #111827;
  }',
        '<div class="notification">
    <div class="notification-icon">
      {{#if item.image_url}}
        <img src="{{item.image_url}}" alt="{{item.title}}" onerror="this.style.display=''none''; this.nextElementSibling.style.display=''block'';" />
        <div class="notification-icon-fallback" style="display: none;"></div>
      {{else}}
        <div class="notification-icon-fallback"></div>
      {{/if}}
    </div>
    <div class="notification-content">
      <div class="notification-title">🎉 New Purchase!</div>
      <div class="notification-message">
        <span class="customer-name">{{customer.first_name}}</span>
        {{#if customer.city}}
          from {{customer.city}}{{#if customer.country}}, {{customer.country}}{{/if}}
        {{/if}}
        just purchased 
        <span class="product-name">{{item.title}}</span>
        for <span class="price">{{order.currency}} {{order.total_price}}</span>
      </div>
      <div class="notification-time">Just now</div>
    </div>
  </div>',
        '{
    "variables": {
      "productTitle": {
        "path": "item.title",
        "default": "a product"
      },
      "productImage": {
        "path": "item.image_url",
        "default": null
      },
      "totalPrice": {
        "path": "order.total_price",
        "default": "0.00"
      },
      "currency": {
        "path": "order.currency",
        "default": "USD"
      },
      "customerName": {
        "path": "customer.first_name",
        "default": "Someone"
      },
      "customerCity": {
        "path": "customer.city",
        "default": null
      },
      "customerCountry": {
        "path": "customer.country",
        "default": null
      }
    },
    "settings": {
      "displayDuration": 5000,
      "position": "bottom-right",
      "animation": "slide",
      "showCloseButton": true
    }
  }',
        '{web}',
        '{order.created}',
        'active'
WHERE NOT EXISTS (
    SELECT 1 FROM templates 
    WHERE site_id = '83bbcff3-1932-41a6-9e1a-08b93374dd64' 
    AND name = 'Test Site Order Notification'
);

COMMIT;