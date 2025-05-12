/**
 * Type definitions for Shopify webhook payloads
 */

export interface ShopifyOrderWebhookPayload {
  id: number;
  admin_graphql_api_id: string;
  app_id?: number;
  browser_ip?: string;
  buyer_accepts_marketing?: boolean;
  cancel_reason?: string;
  cancelled_at?: string;
  cart_token?: string;
  checkout_id?: number;
  checkout_token?: string;
  client_details?: {
    accept_language?: string;
    browser_height?: number;
    browser_ip?: string;
    browser_width?: number;
    session_hash?: string;
    user_agent?: string;
  };
  closed_at?: string;
  confirmed?: boolean;
  created_at: string;
  currency: string;
  current_subtotal_price?: string;
  current_total_discounts?: string;
  current_total_price?: string;
  current_total_tax?: string;
  customer?: {
    id: number;
    email?: string;
    accepts_marketing?: boolean;
    created_at?: string;
    updated_at?: string;
    first_name?: string;
    last_name?: string;
    state?: string;
    note?: string;
    verified_email?: boolean;
    multipass_identifier?: string;
    tax_exempt?: boolean;
    phone?: string;
    tags?: string;
    currency?: string;
    admin_graphql_api_id?: string;
  };
  customer_locale?: string;
  device_id?: number;
  discount_codes?: Array<{
    code: string;
    amount: string;
    type: string;
  }>;
  email?: string;
  financial_status?: string;
  fulfillment_status?: string;
  gateway?: string;
  landing_site?: string;
  landing_site_ref?: string;
  line_items: Array<{
    id: number;
    admin_graphql_api_id?: string;
    fulfillable_quantity?: number;
    fulfillment_service?: string;
    fulfillment_status?: string;
    gift_card?: boolean;
    grams?: number;
    name: string;
    price: string;
    product_exists?: boolean;
    product_id?: number;
    properties?: Array<{ name: string; value: string }>;
    quantity: number;
    requires_shipping?: boolean;
    sku?: string;
    taxable?: boolean;
    title: string;
    total_discount?: string;
    variant_id?: number;
    variant_inventory_management?: string;
    variant_title?: string;
    vendor?: string;
  }>;
  location_id?: number;
  name: string;
  note?: string;
  note_attributes?: Array<{ name: string; value: string }>;
  number?: number;
  order_number: number;
  order_status_url?: string;
  payment_gateway_names?: string[];
  phone?: string;
  presentment_currency?: string;
  processed_at?: string;
  processing_method?: string;
  reference?: string;
  referring_site?: string;
  source_identifier?: string;
  source_name?: string;
  source_url?: string;
  subtotal_price: string;
  tags?: string;
  tax_lines?: Array<{
    price: string;
    rate: number;
    title: string;
  }>;
  taxes_included?: boolean;
  test?: boolean;
  token?: string;
  total_discounts: string;
  total_line_items_price: string;
  total_price: string;
  total_tax: string;
  total_tip_received?: string;
  total_weight?: number;
  updated_at: string;
  user_id?: number;
  billing_address?: Address;
  shipping_address?: Address;
  shipping_lines?: Array<{
    id: number;
    carrier_identifier?: string;
    code?: string;
    delivery_category?: string;
    discounted_price?: string;
    phone?: string;
    price: string;
    source?: string;
    title: string;
  }>;
}

export interface Address {
  first_name?: string;
  address1?: string;
  phone?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  last_name?: string;
  address2?: string;
  company?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
  country_code?: string;
  province_code?: string;
}

export interface ShopifyOrderEvent {
  source: 'shopify';
  event_type: 'order.created';
  shop: string;
  timestamp: string;
  data: {
    id: number;
    order_number: number;
    total_price: string;
    currency: string;
    created_at: string;
    customer: {
      id: number;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    } | null;
    shipping_address: {
      city?: string;
      province?: string;
      country?: string;
      zip?: string;
    } | null;
    line_items: Array<{
      id: number;
      product_id?: number;
      variant_id?: number;
      title: string;
      quantity: number;
      price: string;
    }>;
  };
} 