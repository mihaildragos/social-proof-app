import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIntegrationsServiceUrl } from "@/lib/service-urls";
import { getShopifyWebhookHeaders, validateShopifyOrderPayload } from "@/lib/webhook-security";

interface SimulateWebhookRequest {
  shop_domain: string;
  order_data: {
    customer: {
      email: string;
      first_name: string;
      last_name: string;
      city?: string;
      country?: string;
    };
    products: Array<{
      id: string;
      title: string;
      price: string;
      quantity: number;
      image?: string;
    }>;
    currency: string;
    total_price: string;
  };
}

/**
 * POST /api/test-control-panel/simulate-webhook
 * Simulate a Shopify webhook event by creating a properly formatted order and sending it to the integrations service
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SimulateWebhookRequest = await request.json();
    const { shop_domain, order_data } = body;

    if (!shop_domain || !order_data) {
      return NextResponse.json(
        { error: "Missing required fields: shop_domain and order_data" },
        { status: 400 }
      );
    }

    // Generate a unique order ID for the simulation
    const orderId = Math.floor(1000000 + Math.random() * 9000000);

    // Create a properly formatted Shopify order webhook payload
    const shopifyOrderPayload = {
      id: orderId,
      email: order_data.customer.email,
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      number: orderId,
      note: "Test order created by Social Proof Test Control Panel",
      token: `test_token_${orderId}`,
      gateway: "manual",
      test: true,
      total_price: order_data.total_price,
      subtotal_price: order_data.total_price,
      total_weight: 0,
      total_tax: "0.00",
      taxes_included: false,
      currency: order_data.currency,
      financial_status: "paid",
      confirmed: true,
      total_discounts: "0.00",
      total_line_items_price: order_data.total_price,
      cart_token: `test_cart_${orderId}`,
      buyer_accepts_marketing: false,
      name: `#${orderId}`,
      referring_site: "",
      landing_site: "/",
      cancelled_at: null,
      cancel_reason: null,
      total_price_usd: order_data.total_price,
      checkout_token: `test_checkout_${orderId}`,
      reference: null,
      user_id: null,
      location_id: null,
      source_identifier: null,
      source_url: null,
      processed_at: new Date().toISOString(),
      device_id: null,
      phone: null,
      customer_url: `https://${shop_domain}/customer`,
      order_number: orderId,
      discount_applications: [],
      discount_codes: [],
      note_attributes: [],
      payment_gateway_names: ["manual"],
      processing_method: "manual",
      checkout_id: Math.floor(10000000 + Math.random() * 90000000),
      source_name: "web",
      fulfillment_status: null,
      tax_lines: [],
      tags: "test-order",
      contact_email: order_data.customer.email,
      order_status_url: `https://${shop_domain}/orders/${orderId}/authenticate?key=test_key`,
      presentment_currency: order_data.currency,
      total_line_items_price_set: {
        shop_money: {
          amount: order_data.total_price,
          currency_code: order_data.currency,
        },
        presentment_money: {
          amount: order_data.total_price,
          currency_code: order_data.currency,
        },
      },
      total_discounts_set: {
        shop_money: {
          amount: "0.00",
          currency_code: order_data.currency,
        },
        presentment_money: {
          amount: "0.00",
          currency_code: order_data.currency,
        },
      },
      total_shipping_price_set: {
        shop_money: {
          amount: "0.00",
          currency_code: order_data.currency,
        },
        presentment_money: {
          amount: "0.00",
          currency_code: order_data.currency,
        },
      },
      subtotal_price_set: {
        shop_money: {
          amount: order_data.total_price,
          currency_code: order_data.currency,
        },
        presentment_money: {
          amount: order_data.total_price,
          currency_code: order_data.currency,
        },
      },
      total_price_set: {
        shop_money: {
          amount: order_data.total_price,
          currency_code: order_data.currency,
        },
        presentment_money: {
          amount: order_data.total_price,
          currency_code: order_data.currency,
        },
      },
      total_tax_set: {
        shop_money: {
          amount: "0.00",
          currency_code: order_data.currency,
        },
        presentment_money: {
          amount: "0.00",
          currency_code: order_data.currency,
        },
      },
      line_items: order_data.products.map((product) => ({
        id: Math.floor(1000000000 + Math.random() * 9000000000),
        variant_id: Math.floor(100000000 + Math.random() * 900000000),
        title: product.title,
        quantity: product.quantity,
        sku: `TEST-SKU-${product.id}`,
        variant_title: null,
        vendor: "Test Vendor",
        fulfillment_service: "manual",
        product_id: parseInt(product.id),
        requires_shipping: true,
        taxable: true,
        gift_card: false,
        name: product.title,
        variant_inventory_management: "shopify",
        properties: [],
        product_exists: true,
        fulfillable_quantity: product.quantity,
        grams: 500,
        price: product.price,
        total_discount: "0.00",
        fulfillment_status: null,
        price_set: {
          shop_money: {
            amount: product.price,
            currency_code: order_data.currency,
          },
          presentment_money: {
            amount: product.price,
            currency_code: order_data.currency,
          },
        },
        total_discount_set: {
          shop_money: {
            amount: "0.00",
            currency_code: order_data.currency,
          },
          presentment_money: {
            amount: "0.00",
            currency_code: order_data.currency,
          },
        },
        discount_allocations: [],
        duties: [],
        admin_graphql_api_id: `gid://shopify/LineItem/${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        tax_lines: [],
      })),
      shipping_address:
        order_data.customer.city && order_data.customer.country ?
          {
            first_name: order_data.customer.first_name,
            address1: "123 Test Street",
            phone: null,
            city: order_data.customer.city,
            zip: "12345",
            province: null,
            country: order_data.customer.country,
            last_name: order_data.customer.last_name,
            address2: null,
            company: null,
            latitude: null,
            longitude: null,
            name: `${order_data.customer.first_name} ${order_data.customer.last_name}`,
            country_code: order_data.customer.country === "United States" ? "US" : "XX",
            province_code: null,
          }
        : null,
      billing_address: {
        first_name: order_data.customer.first_name,
        address1: "123 Test Street",
        phone: null,
        city: order_data.customer.city || "Test City",
        zip: "12345",
        province: null,
        country: order_data.customer.country || "Test Country",
        last_name: order_data.customer.last_name,
        address2: null,
        company: null,
        latitude: null,
        longitude: null,
        name: `${order_data.customer.first_name} ${order_data.customer.last_name}`,
        country_code: order_data.customer.country === "United States" ? "US" : "XX",
        province_code: null,
      },
      customer: {
        id: Math.floor(1000000 + Math.random() * 9000000),
        email: order_data.customer.email,
        accepts_marketing: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        first_name: order_data.customer.first_name,
        last_name: order_data.customer.last_name,
        orders_count: 1,
        state: "enabled",
        total_spent: order_data.total_price,
        last_order_id: orderId,
        note: "Test customer",
        verified_email: true,
        multipass_identifier: null,
        tax_exempt: false,
        phone: null,
        tags: "test-customer",
        last_order_name: `#${orderId}`,
        currency: order_data.currency,
        addresses: [],
        admin_graphql_api_id: `gid://shopify/Customer/${Math.floor(1000000 + Math.random() * 9000000)}`,
        default_address: null,
      },
      fulfillments: [],
      refunds: [],
      admin_graphql_api_id: `gid://shopify/Order/${orderId}`,
    };

    // Validate the generated payload
    if (!validateShopifyOrderPayload(shopifyOrderPayload)) {
      return NextResponse.json(
        { error: "Generated order payload failed validation" },
        { status: 500 }
      );
    }

    // Generate webhook headers with proper HMAC signature
    const webhookHeaders = getShopifyWebhookHeaders(shopifyOrderPayload, shop_domain);

    // Send the webhook to the integrations service
    const integrationsUrl = getIntegrationsServiceUrl();
    const webhookUrl = `${integrationsUrl}/api/webhooks/shopify/orders/create`;

    console.log(`Sending simulated webhook to: ${webhookUrl}`);
    console.log(`Shop domain: ${shop_domain}`);
    console.log(`Order ID: ${orderId}`);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify(shopifyOrderPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webhook failed with status ${response.status}:`, errorText);

      return NextResponse.json(
        {
          success: false,
          error: `Webhook delivery failed: ${response.status} ${response.statusText}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: "Webhook event simulated successfully",
      order_id: orderId,
      shop_domain: shop_domain,
      integrations_response: result,
    });
  } catch (error: any) {
    console.error("Error simulating webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
