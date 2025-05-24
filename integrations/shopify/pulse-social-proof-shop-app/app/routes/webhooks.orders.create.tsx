import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { sendOrderEvent } from "../services/kafka.server";
import { ShopifyOrderWebhookPayload } from "../types/shopify";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  if (!payload) {
    return new Response("No payload", { status: 400 });
  }

  try {
    const orderPayload = payload as ShopifyOrderWebhookPayload;

    // Log the webhook data for debugging
    console.log(`Received ${topic} webhook from ${shop}`);
    console.log(`Order ID: ${orderPayload.id}`);
    console.log(
      `Customer: ${orderPayload.customer?.first_name} ${orderPayload.customer?.last_name}`
    );
    console.log(`Total price: ${orderPayload.total_price}`);

    // Extract the relevant order data for sending to Kafka
    const orderData = {
      id: orderPayload.id,
      order_number: orderPayload.order_number,
      total_price: orderPayload.total_price,
      currency: orderPayload.currency,
      created_at: orderPayload.created_at,
      customer:
        orderPayload.customer ?
          {
            id: orderPayload.customer.id,
            first_name: orderPayload.customer.first_name,
            last_name: orderPayload.customer.last_name,
            email: orderPayload.customer.email,
            phone: orderPayload.customer.phone,
          }
        : null,
      shipping_address:
        orderPayload.shipping_address ?
          {
            city: orderPayload.shipping_address.city,
            province: orderPayload.shipping_address.province,
            country: orderPayload.shipping_address.country,
            zip: orderPayload.shipping_address.zip,
          }
        : null,
      line_items:
        orderPayload.line_items?.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          title: item.name || item.title,
          quantity: item.quantity,
          price: item.price,
        })) || [],
    };

    // Send the order data to Kafka
    await sendOrderEvent(shop, orderPayload.id.toString(), orderData);
    console.log(`Successfully sent order ${orderPayload.id} to Kafka`);

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("Error processing order webhook:", error);

    // Still return 200 to acknowledge receipt to Shopify
    // This prevents Shopify from retrying webhooks that might fail due to Kafka issues
    return new Response("Webhook received, but processing failed", { status: 200 });
  }
};
