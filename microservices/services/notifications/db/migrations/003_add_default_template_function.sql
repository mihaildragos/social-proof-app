-- Migration: 003_add_default_template_function.sql
-- Description: Add function to create default notification templates for test sites
-- Created: 2025-05-26

BEGIN;

-- Add config column to templates table if it doesn't exist
ALTER TABLE templates ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Create a function to add default template for any test site
CREATE OR REPLACE FUNCTION add_default_template_for_test_site(target_site_id UUID)
RETURNS UUID AS $$
DECLARE
    template_id UUID;
BEGIN
    INSERT INTO templates (
        site_id,
        name,
        description,
        css_content,
        html_content,
        config,
        is_default
    ) VALUES (
        target_site_id,
        'Default Order Notification',
        'Default template for order notifications',
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
    },
    "channels": ["web"],
    "eventTypes": ["order.created"]
  }',
        true
    )
    RETURNING id INTO template_id;
    
    RETURN template_id;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to automatically add default template when a test site is created
CREATE OR REPLACE FUNCTION auto_add_default_template()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add template for test sites (check if settings contains is_test_site: true)
    IF NEW.settings IS NOT NULL AND (NEW.settings->>'is_test_site')::boolean = true THEN
        -- Check if a default template already exists for this site
        IF NOT EXISTS (
            SELECT 1 FROM templates 
            WHERE site_id = NEW.id 
            AND name = 'Default Order Notification'
        ) THEN
            -- Add default template
            PERFORM add_default_template_for_test_site(NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: We can't create the trigger here because the sites table might not exist
-- in the notifications service database. The trigger should be created when
-- sites are managed in this database, or the function can be called manually
-- when creating test sites.

COMMIT; 